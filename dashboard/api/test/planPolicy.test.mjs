import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  PLAN_LIMITS,
  PLAN_POLICY_VERSION,
  planLimitsFingerprint,
} from '../src/lib/familyPolicy.ts';

/// API-102 — مصدر حقيقة واحد لحدود الباقات، وإصدار مُسجَّل.

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relative) => readFileSync(root + relative, 'utf8');

/* ------------------------------------------------------- الإصدار والبصمة */

/// بصمة الأرقام المعتمدة لهذا الإصدار.
///
/// **حين تتغيّر أرقام `PLAN_LIMITS`:** ارفع `PLAN_POLICY_VERSION`، ثم حدّث هذا
/// النصّ من مخرَج `planLimitsFingerprint()`. الخطوتان معًا أو لا شيء.
const FINGERPRINT_V2 = [
  'family:children=4,concurrentStreams=2,devices=4,downloadDevices=2,offlineItems=4',
  'family_plus:children=4,concurrentStreams=4,devices=8,downloadDevices=4,offlineItems=4',
  'free:children=1,concurrentStreams=1,devices=1,downloadDevices=0,offlineItems=1',
].join('|');

test('تغيير الأرقام بلا رفع الإصدار يُفشل الجولة', () => {
  // هذا هو الحرس على المعيار الثالث. رقم إصدار لا يتغيّر مع ما يوصفه أسوأ من
  // غيابه: يجعل سجلًّا قديمًا يبدو مُفسَّرًا وهو ليس كذلك.
  assert.equal(PLAN_POLICY_VERSION, 2, 'ارفع الإصدار مع كل تغيير في الأرقام');
  assert.equal(
    planLimitsFingerprint(),
    FINGERPRINT_V2,
    'الأرقام تغيّرت: ارفع PLAN_POLICY_VERSION وحدّث FINGERPRINT في هذا الاختبار',
  );
});

test('البصمة حتمية ولا تتأثر بترتيب المفاتيح', () => {
  assert.equal(planLimitsFingerprint(), planLimitsFingerprint());
  // تُبنى من `PLAN_LIMITS` نفسها لا من نسخة مكتوبة، فلا يمكن أن تصف أرقامًا أخرى.
  assert.ok(planLimitsFingerprint().includes(`devices=${PLAN_LIMITS.family_plus.devices}`));
});

/* --------------------------------------------------- مصدر حقيقة واحد */

test('جدول الحدود أُسقط بمهاجرة', () => {
  // معيار القبول الثاني. الجدول كان **يبدو حيًّا**: أعمدته صحيحة، وصفوفه
  // مزروعة، وفيه `policy_version` — ولم يُدرَج في قائمة الجداول الميتة في 0010.
  // فأي عملية تسويق تعدّل صفًّا فيه وتظنّ أنها غيّرت حدًّا.
  const migration = read('migrations/0085_drop_plan_limits_table.sql');
  assert.match(migration, /DROP TABLE IF EXISTS subscription_plan_limits/);
});

test('لا سطر في المصدر يقرأ الجدول المُسقَط', () => {
  const offenders = [];
  const walk = (relative) => {
    for (const entry of readdirSync(root + relative, { withFileTypes: true })) {
      const next = `${relative}${entry.name}`;
      if (entry.isDirectory()) walk(`${next}/`);
      else if (entry.name.endsWith('.ts')) {
        // التعليقات تُحيَّد: شرحُ سببِ الإسقاط يذكر الاسم، وحرسٌ يُبلّغ عن توثيقه
        // حرسٌ يُتعلَّم تجاهله.
        const code = read(next).split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n');
        if (code.includes('subscription_plan_limits')) offenders.push(next);
      }
    }
  };
  walk('src/');
  assert.deepEqual(offenders, [], 'المصدر لا يعرف هذا الجدول');
});

test('الأرقام مُعلَنة في ملف واحد', () => {
  // مصدران للأرقام هو أصل البند. والمستهلكون يقرأون من `familyPolicy` ولا
  // يكتبون أرقامًا لأنفسهم.
  for (const consumer of ['src/routes/billing.ts', 'src/routes/adminPlans.ts', 'src/do/FamilyState.ts']) {
    assert.match(read(consumer), /PLAN_LIMITS/, `${consumer} يجب أن يقرأ السياسة`);
  }
  const policy = read('src/lib/familyPolicy.ts');
  assert.match(policy, /free: \{ children: 1/, 'الأرقام هنا');
});

/* ------------------------------------------- الإصدار مع كل قرار حدّ */

test('كل رفض حدٍّ يذكر الحدّ وقيمته وإصداره', () => {
  // معيار القبول الثالث. كان الرفض نصًّا وحده، فلا العميل يعرف أي رقم بلغه، ولا
  // من يقرأ سجلًّا بعد شهر يعرف على أي سياسة رُفض — والأرقام تتغيّر مع الباقات.
  const source = read('src/do/FamilyState.ts');
  assert.match(source, /function limitRefusal\(/);
  assert.match(source, /policy_version: PLAN_POLICY_VERSION/);

  for (const limit of ['children', 'devices', 'concurrent_streams', 'download_devices', 'offline_items']) {
    assert.match(
      source,
      new RegExp(`limitRefusal\\([^)]*'${limit}'`, 's'),
      `حدّ ${limit} يجب أن يُرفَض بالشكل الموحَّد`,
    );
  }
});

test('قرارات الحدّ الناجحة تحمل الإصدار إلى سجلّ الأودت', () => {
  // الرفض يذكر السياسة، والقبول كذلك: سجلٌّ يقول «أُنشئ» بلا سياسته لا يُفسِّر
  // لماذا رُفض التالي.
  const source = read('src/do/FamilyState.ts');
  const events = source.match(/addOutbox\('(child\.created|playback\.started|offline_license\.issued)'[\s\S]{0,700}?\}\)/g) ?? [];
  assert.equal(events.length, 3, 'أحداث قرارات الحدّ الثلاثة');
  for (const event of events) {
    assert.match(event, /policyVersion: PLAN_POLICY_VERSION/, event.slice(0, 60));
  }
});

test('الإصدار يُعلَن في كاتالوج الباقات', () => {
  const source = read('src/routes/adminPlans.ts');
  assert.match(source, /source: 'family_policy'/);
  assert.match(source, /policy_version: PLAN_POLICY_VERSION/);
});
