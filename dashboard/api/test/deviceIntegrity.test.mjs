import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HIGH_RISK_LICENSE_TTL_MS,
  INTEGRITY_SIGNALS,
  integrityAuditDetails,
  integrityRisk,
  licenceTtlFor,
  parseIntegritySignals,
} from '../src/lib/deviceIntegrity.ts';
import { familyAuditStatement } from '../src/lib/familyAudit.ts';

/// SEC-107 — إشارات سلامة الجهاز: سياسة تخفيف لا حجب.

const BASE_TTL = 30 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------- القراءة */

test('الإشارات المعروفة وحدها تُقرأ', () => {
  assert.deepEqual(
    parseIntegritySignals({ root_binaries: true, emulator: false }),
    ['root_binaries'],
  );
});

test('اسم خارج القائمة يُهمَل ولا يصل إلى سجلّ الأودت', () => {
  // القائمة مغلقة: المفتوحة تجعل من `details` حقلَ نصّ حرّ يكتبه العميل — أي
  // قناة PII بلا حساب.
  const signals = parseIntegritySignals({
    root_binaries: true,
    'user@example.com': true,
    note: 'هاتف أحمد',
  });
  assert.deepEqual(signals, ['root_binaries']);
});

test('قيمة ليست true ليست رصدًا', () => {
  assert.deepEqual(parseIntegritySignals({ root_binaries: 'true', hooking: 1 }), []);
});

test('غياب الحقل أو شكله الخطأ لا يرفع خطأ', () => {
  for (const value of [undefined, null, 'root', 42, ['root_binaries']]) {
    assert.deepEqual(parseIntegritySignals(value), []);
  }
});

/* ------------------------------------------------------------------ الخطورة */

test('كسر امتياز الجهاز خطورة عالية', () => {
  for (const signal of ['root_binaries', 'root_manager_app', 'jailbreak_paths', 'sandbox_escape', 'hooking']) {
    assert.equal(integrityRisk([signal]), 'high', signal);
  }
});

test('المضاهي والمنقّح ومفاتيح التطوير خطورة مرتفعة لا عالية', () => {
  // هذه إشاراتُ بيئةٍ لا كسرِ امتياز: مضاهٍ يستخدمه فريقنا، وبناء بمفاتيح
  // تطوير على جهاز مطوّر. تقصير الترخيص عليها كان سيعاقب استخدامًا مشروعًا.
  for (const signal of ['emulator', 'debugger', 'test_keys']) {
    assert.equal(integrityRisk([signal]), 'elevated', signal);
  }
});

test('لا إشارة = لا خطورة', () => {
  assert.equal(integrityRisk([]), 'none');
});

test('كل إشارة معلَنة لها تصنيف', () => {
  // إضافة إشارة بلا تصنيف كانت ستجعلها تُرصد وتُرسل ولا تعني شيئًا.
  for (const signal of INTEGRITY_SIGNALS) {
    assert.notEqual(integrityRisk([signal]), 'none', `${signal} بلا تصنيف`);
  }
});

/* ------------------------------------------------------------------ السياسة */

test('الخطورة العالية تقصّر عمر الترخيص ولا تمنعه', () => {
  const ttl = licenceTtlFor('high', BASE_TTL);
  assert.equal(ttl, HIGH_RISK_LICENSE_TTL_MS);
  assert.ok(ttl > 0, 'التقصير ليس منعًا: الجهاز يظلّ يُنزّل ويشاهد');
  assert.ok(ttl < BASE_TTL);
});

test('ما دون العالية لا يُقصّر شيئًا', () => {
  assert.equal(licenceTtlFor('elevated', BASE_TTL), BASE_TTL);
  assert.equal(licenceTtlFor('none', BASE_TTL), BASE_TTL);
});

test('الأساس الأقصر يفوز على حدّ الخطورة', () => {
  const short = 60 * 60 * 1000;
  assert.equal(licenceTtlFor('high', short), short);
});

/* ------------------------------------------------------------------- التسجيل */

test('الحالة السليمة لا تُسجَّل', () => {
  assert.equal(integrityAuditDetails([], 'none'), null);
});

test('المُسجَّل أسماء إشارات ودرجة، بلا وصف جهاز', () => {
  const details = integrityAuditDetails(['hooking', 'root_binaries'], 'high');
  assert.deepEqual(details, { risk: 'high', signals: ['hooking', 'root_binaries'] });
  assert.deepEqual(Object.keys(details).sort(), ['risk', 'signals']);
});

test('الإشارات تصل إلى صفّ أودت الأسرة كما هي', () => {
  // السجلّ يمرّ بمنقّح `redactForAudit`، فلا بدّ من إثبات أن الإشارات ليست ممّا
  // يُمسَح: سطر بلا إشاراته لا يجيب عن السؤال الذي كُتب لأجله.
  const bound = [];
  const db = {
    prepare: () => ({ bind: (...args) => { bound.push(...args); return { args }; } }),
  };
  familyAuditStatement(db, {
    eventId: 'evt-1',
    parentId: 'parent-1',
    type: 'offline_license.issued',
    occurredAt: 1_700_000_000_000,
    payload: {
      licenseId: 'lic-1',
      integrity: { risk: 'high', signals: ['root_binaries'] },
    },
  });
  const details = JSON.parse(bound.find((value) => typeof value === 'string' && value.includes('integrity')));
  assert.equal(details.integrity.risk, 'high');
  assert.deepEqual(details.integrity.signals, ['root_binaries']);
});

/* -------------------------------------------------------------------- الربط */

const routeSource = readFileSync(
  fileURLToPath(new URL('../src/routes/downloads.ts', import.meta.url)),
  'utf8',
);
const doSource = readFileSync(
  fileURLToPath(new URL('../src/do/FamilyState.ts', import.meta.url)),
  'utf8',
);

test('السياسة تُطبَّق على مدّة الترخيص في مسار الجلسة', () => {
  assert.match(routeSource, /ttl_ms: licenceTtlFor\(risk, LICENSE_TTL_MS\)/);
  assert.match(routeSource, /integrity: integrityAuditDetails\(integritySignals, risk\)/);
});

test('الإشارات لا تردّ طلبًا واحدًا', () => {
  // معيار القبول «لا حجب تلقائيًّا»: أي ربط بين `risk` و`return c.json(..., 4xx)`
  // كان سيعني أسرة تدفع ولا تُنزّل بسبب استدلال.
  const guarded = routeSource.match(/if \([^)]*risk[^)]*\)[^\n]*\n[^\n]*return/g);
  assert.equal(guarded, null, 'الخطورة لا تُستخدم في رفض');
});

test('المشاهدة المتّصلة بلا فحص سلامة أصلًا', () => {
  // معيار القبول «نتيجة إيجابية خاطئة لا تمنع المشاهدة Online»: أضمن ما يحقّقه
  // ألّا يعرف مسار قدرات التشغيل بالإشارات شيئًا.
  const media = readFileSync(
    fileURLToPath(new URL('../src/routes/media.ts', import.meta.url)),
    'utf8',
  );
  assert.equal(/integrity|deviceIntegrity/.test(media), false);
});

test('الكائن الدائم يمرّر الإشارات ولا يقرّر بها', () => {
  assert.match(doSource, /const integrity = body\.integrity/);
  // لا عتبة ولا قائمة إشارات في الكائن: السياسة في ملف واحد، وتفرّقها يعني
  // تشدّدًا في موضع وتساهلًا في آخر.
  assert.equal(doSource.includes('root_binaries'), false);
  assert.equal(doSource.includes('HIGH_RISK'), false);
});
