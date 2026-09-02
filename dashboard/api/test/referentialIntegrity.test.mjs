import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { evaluateIntegrity } from '../tools/ops/referential-integrity.mjs';

/// `DB-103` — سلامة مرجعية: الحكم مُختبَر، والفرضية مُصحَّحة.
///
/// ## الفرضية التي نُقضت بالقياس
///
/// البند بُني على أن «D1/SQLite لا يفرض `FOREIGN KEY` افتراضيًّا». والمقيس على
/// القاعدة المحلية:
///
/// - `PRAGMA foreign_keys` = **1**.
/// - إدراجُ مرجعٍ غير موجود يُرفض بـ`SQLITE_CONSTRAINT_FOREIGNKEY`.
/// - `PRAGMA foreign_keys=OFF` ثمّ إدراج: **رُفض أيضًا** — الإنفاذ غير قابل
///   للتعطيل من SQL.
/// - جدولٌ يرجع إلى جدولٍ غير موجود: يُرفض عند الإنشاء.
/// - وحادث `DB-104` يؤكّده: ترحيلةٌ **توقّفت** على انتهاك مفتاح أجنبي.
///
/// أي أن الإنفاذ قائم. ولذلك **لا يمكن تلفيق صفٍّ يتيم** في قاعدة حقيقية لأجل
/// اختبار المِسحة — فيُختبَر الحكم بصفوفٍ مُصطنَعة، وهذا هو سبب كون
/// `evaluateIntegrity` دالّةً نقيّة مُصدَّرة.

test('قاعدة سليمة: إنفاذٌ قائم وصفر يتيم', () => {
  const verdict = evaluateIntegrity({ foreignKeysPragma: 1, orphanRows: [] });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.enforced, true);
  assert.equal(verdict.orphanCount, 0);
  assert.deepEqual(verdict.brokenPairs, []);
});

test('إنفاذٌ مُطفأ يُفشل الفحص وإن لم يكن ثمّة يتيم', () => {
  // لأن الإطفاء ليس عطلًا مؤجَّلًا: من تلك اللحظة كل مرجعٍ في المخطَّط اقتراح،
  // والصفوف اليتيمة تُكتب بلا خطأ. فالفحص يفشل على **القدرة** لا على الأثر.
  const verdict = evaluateIntegrity({ foreignKeysPragma: 0, orphanRows: [] });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.enforced, false);
});

test('غياب القراءة يُقرأ إطفاءً لا نجاحًا', () => {
  // `undefined` تعني أن `PRAGMA` لم يُجب. تفسيرُها «قائم» هو نفس عطل «قراءةٌ
  // فاشلة تُشحن صفرًا» الذي أصلحه `ADM-106`.
  for (const value of [undefined, null, '', 'yes']) {
    assert.equal(
      evaluateIntegrity({ foreignKeysPragma: value, orphanRows: [] }).enforced,
      false,
      `القيمة ${JSON.stringify(value)} لا تُثبت الإنفاذ`,
    );
  }
});

test('الصفوف اليتيمة تُجمَّع بالزوج (جدول → مرجَعه) وتُرتَّب بالعدد', () => {
  const verdict = evaluateIntegrity({
    foreignKeysPragma: 1,
    orphanRows: [
      { table: 'access_grants', rowid: 1, parent: 'roles', fkid: 0 },
      { table: 'access_grants', rowid: 2, parent: 'roles', fkid: 0 },
      { table: 'access_grants', rowid: 3, parent: 'roles', fkid: 0 },
      { table: 'asset_links', rowid: 9, parent: 'content_assets', fkid: 0 },
    ],
  });

  assert.equal(verdict.ok, false);
  assert.equal(verdict.orphanCount, 4);
  // الترتيب بالعدد لأن «ثلاثة صفوف» و«ثلاثة آلاف» عطلان مختلفان، والأكبر أوّلًا.
  assert.deepEqual(verdict.brokenPairs, [
    { pair: 'access_grants → roles', count: 3 },
    { pair: 'asset_links → content_assets', count: 1 },
  ]);
});

test('اسم العمود المحجوز `table` يُقرأ مُقتبَسًا كما يصل', () => {
  // `table` كلمة محجوزة، فبعض النواقل تُعيدها `"table"`. وبلا هذا يظهر الجدول
  // «(مجهول)» في تقريرٍ غرضه أن يقول **أين** العطل.
  const verdict = evaluateIntegrity({
    foreignKeysPragma: 1,
    orphanRows: [{ '"table"': 'billing_audit', rowid: 4, parent: 'parents', fkid: 0 }],
  });
  assert.deepEqual(verdict.brokenPairs, [{ pair: 'billing_audit → parents', count: 1 }]);
});

test('المِسحة تسأل SQLite ولا تحمل قائمة جداول مكتوبة يدويًّا', () => {
  // خاصّية بنيوية على الملف: قائمةٌ يدوية تكون صحيحةً اليوم وخاطئةً عند أوّل
  // ترحيل — وهو الدرس الذي كرّره هذا الأودت (`CNT-104`).
  const source = readFileSync(
    fileURLToPath(new URL('../tools/ops/referential-integrity.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(source, /PRAGMA foreign_key_check/);
  assert.match(source, /PRAGMA foreign_keys/);
  assert.match(source, /FROM sqlite_master/);
  assert.match(source, /PRAGMA foreign_key_list/);
});
