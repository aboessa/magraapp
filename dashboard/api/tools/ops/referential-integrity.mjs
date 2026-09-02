#!/usr/bin/env node
/**
 * فحص سلامة مرجعية: هل الإنفاذ قائم، وهل ثمّة صفٌّ يتيم (`DB-103`).
 *
 * الاستعمال:
 *   node tools/ops/referential-integrity.mjs            # القاعدة المحلية
 *   node tools/ops/referential-integrity.mjs --remote    # الإنتاج (يحتاج اعتمادًا)
 *   node tools/ops/referential-integrity.mjs --coverage  # ومعه جردُ التغطية
 *
 * ## تصحيح الفرضية أوّلًا
 *
 * البند بُني على أن «D1/SQLite لا يفرض `FOREIGN KEY` افتراضيًّا». والمقيس على
 * القاعدة المحلية: `PRAGMA foreign_keys` = **1**، وإدراجُ مرجعٍ غير موجود يُرفض
 * بـ`SQLITE_CONSTRAINT_FOREIGNKEY`. ويؤكّده حادث `DB-104`: ترحيلةٌ **توقّفت**
 * على انتهاك مفتاح أجنبي. أي أن الإنفاذ قائم، لا معطَّل.
 *
 * فالخطر ليس «قيدٌ لا يُفرض» بل ثلاثة أشياء أخرى، وهذا الفحص يقيسها:
 *
 * 1. **أن يُطفأ الإنفاذ** — بأمرٍ في ترحيلة أو بتغيّرٍ في المنصّة. `PRAGMA
 *    foreign_keys` يُقاس صريحًا فلا يُفترض.
 * 2. **صفوفٌ يتيمة سابقة** — كُتبت في نافذةٍ كان الإنفاذ فيها مُطفأً، أو
 *    بترحيلةٍ أطفأته. القيدُ لا ينظر إلى الماضي، و`PRAGMA foreign_key_check`
 *    ينظر.
 * 3. **مراجع بلا قيد أصلًا** — وهذه ما لا يراها أي إنفاذ: عمودٌ يحمل معرّفًا
 *    ولا `REFERENCES` عليه. تُجرَد بـ`--coverage`.
 *
 * ولا قائمة جداول مكتوبة يدويًّا هنا: الأولان يسألان SQLite نفسه، والثالث
 * يُشتَقّ من `sqlite_master`. قائمةٌ يدوية تكون صحيحةً اليوم وخاطئةً عند أوّل
 * ترحيل — وهو الدرس الذي كرّره هذا الأودت.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const has = (flag) => process.argv.includes(flag);
const remote = has('--remote');

/// يُمرّر SQL عبر ملف لا عبر وسيط سطر أوامر.
///
/// نفس سبب `migration-ledger.mjs`: تمرير SQL كوسيط على Windows يُفسده
/// الاقتباس، فيُنتج فشلًا مُختلقًا يُنسَب إلى بيان سليم.
function d1(sql) {
  const dir = mkdtempSync(join(tmpdir(), 'majarra-fk-'));
  const path = join(dir, 'statement.sql');
  try {
    writeFileSync(path, sql.endsWith(';') ? sql : `${sql};`, 'utf8');
    const output = execFileSync('npx', [
      'wrangler', 'd1', 'execute', 'majarra-db',
      remote ? '--remote' : '--local',
      '--json', '--file', path,
    ], { encoding: 'utf8', shell: process.platform === 'win32' });
    const parsed = JSON.parse(output.slice(output.indexOf('[')));
    return Array.isArray(parsed) ? parsed : [parsed];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/// يحكم على القراءتين. **دالّة نقيّة** لأن الحالة الفاشلة لا تُلفَّق في قاعدة:
///
/// جرّبتُ صنع صفٍّ يتيم محليًّا بثلاث طرق — `PRAGMA foreign_keys=OFF` ثم
/// إدراج، وإدراجُ مرجعٍ غير موجود، وجدولٌ يرجع إلى جدولٍ غير موجود — و**رفض
/// D1 الثلاث**. أي أن الإنفاذ ليس قابلًا للتعطيل من SQL، وهذا خبرٌ جيّد يجعل
/// فرع «صفوف يتيمة» غير قابل للاختبار على قاعدة حقيقية.
///
/// فبقي أن يُختبَر **الحكم** لا القاعدة: `test/referentialIntegrity.test.mjs`
/// يُغذّي هذه الدالّة صفوفًا مُصطنَعة. وحرسٌ لم أرَه يفشل ليس حرسًا.
export function evaluateIntegrity({ foreignKeysPragma, orphanRows }) {
  const enforced = Number(foreignKeysPragma ?? 0) === 1;
  const orphans = orphanRows ?? [];

  // `foreign_key_check` يُعيد: الجدول، ورقم الصفّ، والجدول المرجَعي، ورقم القيد.
  // واسم العمود الأوّل `table` وهي كلمة محجوزة، فتصل أحيانًا مُقتبَسة.
  const byPair = new Map();
  for (const row of orphans) {
    const child = row.table ?? row['"table"'] ?? '(مجهول)';
    const key = `${child} → ${row.parent}`;
    byPair.set(key, (byPair.get(key) ?? 0) + 1);
  }

  return {
    ok: enforced && orphans.length === 0,
    enforced,
    orphanCount: orphans.length,
    brokenPairs: [...byPair.entries()]
      .map(([pair, count]) => ({ pair, count }))
      .sort((a, b) => b.count - a.count),
  };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  main();
}

function main() {
  const scope = remote ? 'الإنتاج' : 'القاعدة المحلية';

  const [pragma] = d1('PRAGMA foreign_keys');
  const [check] = d1('PRAGMA foreign_key_check');
  const verdict = evaluateIntegrity({
    foreignKeysPragma: pragma?.results?.[0]?.foreign_keys,
    orphanRows: check?.results,
  });

  console.log(
    `${scope} — إنفاذ المفاتيح الأجنبية: ${verdict.enforced ? 'قائم (1)' : 'مُطفأ (0)'}`,
  );
  if (!verdict.enforced) {
    console.error(
      '\nالإنفاذ مُطفأ. كل مرجعٍ في المخطَّط صار اقتراحًا، والصفوف اليتيمة تُكتب '
      + 'بلا خطأ. ابحث عن `PRAGMA foreign_keys=OFF` في ترحيلةٍ أو إعدادٍ.',
    );
  }

  console.log(`صفوف يتيمة: ${verdict.orphanCount}`);
  if (verdict.orphanCount) {
    console.error('\nمراجع مكسورة (جدول → الجدول المرجَعي: عدد الصفوف):');
    for (const { pair, count } of verdict.brokenPairs) {
      console.error(`  ${count.toString().padStart(6)}  ${pair}`);
    }
    console.error(
      '\nهذه صفوفٌ لا يمنعها الإنفاذ لأنها كُتبت قبله أو في نافذةٍ كان مُطفأً فيها. '
      + 'القيد لا ينظر إلى الماضي.',
    );
  }

  coverage();

  if (!verdict.ok) process.exit(1);
  console.log('\nسليم.');
}

function coverage() {

/* ------------------------- 3. جردُ التغطية: مراجعٌ بلا قيد (اختياري) */

  if (!has('--coverage')) return;

  // **SQLite تُجيب، لا تعبيرٌ نمطيّ يُخمّن.**
  //
  // جرّبتُ قراءة DDL من `sqlite_master` وتحليل `REFERENCES` بتعبير نمطي: أعطى
  // **139** عمودًا مقابل **120** من `PRAGMA foreign_key_list` — تسعة عشر عمودًا
  // لها قيدٌ ووُصفت بأنها بلا قيد، لأن الصيغ متعدّدة (قيدٌ على مستوى الجدول،
  // وأعمدةٌ متعدّدة الأسطر). وجردٌ يبالغ لا يُقرأ.
  //
  // والصيغة الأولى كانت تسأل SQLite لكن بنداء `wrangler` لكل جدول: نحو ثلاثمئة
  // نداء وأكثر من دقيقة، وفحصٌ بهذا الثمن لا يُشغَّل. فالحلّ: **بيانات كثيرة في
  // نداءٍ واحد** — wrangler يُعيد نتيجةً لكل بيان بالترتيب.
  const [tables] = d1(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name",
  );
  const names = (tables?.results ?? []).map((row) => row.name);

  // بيانان لكل جدول، بالترتيب: أعمدته ثم قيوده.
  const batch = names
    .map((table) => `PRAGMA table_info(${table});\nPRAGMA foreign_key_list(${table});`)
    .join('\n');
  const answers = d1(batch);

  /// عمودٌ اسمه يقول إنه مرجع. تقريبٌ **مُعلَن**: قد يُفلت عمودٌ مرجعيّ باسمٍ
  /// مختلف، ولا يخترع مرجعًا غير موجود.
  const looksLikeReference = (column) => /_id$/.test(column) && column !== 'id';

  const uncovered = [];
  names.forEach((table, index) => {
    const columns = answers[index * 2]?.results ?? [];
    const constrained = new Set(
      (answers[index * 2 + 1]?.results ?? []).map((row) => row.from),
    );
    for (const column of columns) {
      if (looksLikeReference(column.name) && !constrained.has(column.name)) {
        uncovered.push(`${table}.${column.name}`);
      }
    }
  });

  console.log(`\nأعمدةٌ تبدو مراجع وبلا قيد: ${uncovered.length}`);
  for (const column of uncovered) console.log(`  ${column}`);
  console.log(
    '\nهذه ليست إخفاقًا بالضرورة: بعضها مرجعٌ إلى كائنٍ دائم لا إلى جدول D1، '
    + 'وبعضها معرّفٌ خارجي (متجر، مزوّد). الجرد للقراءة البشرية لا للبوابة.',
  );
}
