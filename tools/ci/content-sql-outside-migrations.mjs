#!/usr/bin/env node
// لا ملف SQL في المستودع يكتب في جداول المحتوى من خارج `migrations/`
// (`DATA-201`).
//
// ## العطل الذي وقع
//
// إنتاج الفيديو في 2026-09-03 سجّل وسائطه في الإنتاج بأربعة ملفات SQL شُغِّلت
// **بيدٍ** من `tools/ops/`: `thumbs-register.sql` (33 أصلًا) و`link-episodes.sql`
// (66 رابطًا) و`update-sizes.sql` (33 تحديثًا) و`mark-33-episodes-english.sql`.
// وكلّها غير متتبَّعة في git.
//
// والمستودع يملك سجلّ ترحيلات (`migrations/LEDGER.md`) وحرسًا في CI
// (`migration-ledger.mjs --require-applied`) ووظيفةَ بناءٍ من الصفر — وُجدت كلّها
// لأن بناء القاعدة من الصفر كان **مستحيلًا** (`DB-104`: التطبيق يتوقّف عند
// `0074` بانتهاك مفتاح أجنبي، 71 من 89 مُطبَّقًا). ثم صار تسجيل المحتوى يجري من
// خارج `migrations/` وخارج git، فالقدرة التي دُفع ثمنها — إعادة بناء الإنتاج من
// المستودع — تُنقَض كلّما شُغِّل أحد هذه الملفات، **ولا شيء يسجّل أنه شُغِّل**.
//
// ## ما يفحصه، وما لا يفحصه
//
// يفحص **الكتابة** (`INSERT`/`UPDATE`/`DELETE`/`REPLACE`) في جداول الكتالوج. ولا
// يمنع `SELECT`: سكربتات التشخيص والتقارير تقرأ بحقّ، ومنعُها يدفع كاتبها إلى
// تسميةٍ أخرى بدل تسجيلها. ولا يمنع الكتابة في **كل** جدول: `admin_users` يُبذَر
// بأداة تشغيل بقرارٍ مكتوب، وذلك ليس محتوًى يُعاد بناؤه.
//
// ## لماذا الملفات المُتجاهَلة في git خارج المِسحة
//
// المِسحة على الشجرة تصطدم بـ1.6 م.ب من ملفات تحميلٍ مُولَّدة في
// `dashboard/api/_*.sql`، وبنسخٍ احتياطية كاملة في `_backups/` و`.backups/`
// و`.tmp_covers/`. ولا شيء من ذلك في المستودع، ولا يراه CI على checkout نظيف.
// فبوابةٌ تفشل محليًّا وتخضرّ في CI ليست بوابة — تُقرأ ضجيجًا وتُعطَّل.
//
// ونطاقُ البند نفسه هو «المستودع يبني الإنتاج»، فما ليس في المستودع ليس من
// مسار البناء. **والثغرة المقابلة مُغلَقة لا موصوفة**: الفحص الثاني أدناه يرفض
// أي قاعدة `.gitignore` تُخفي ملف `.sql`، فلا يُنجي ملفًا من هذه المِسحة أن
// يُضاف إلى `.gitignore`.
//
// ## ملف SQL تصميميّ لا يُشغَّل
//
// `DATABASE_V2_SCHEMA.sql` مخطَّط PostgreSQL/Supabase بـRLS و`TIMESTAMPTZ`
// و`auth.uid()` — وهو **تصميم غير مطبَّق** (كما يقول
// `migrations/0085_drop_plan_limits_table.sql` صراحةً)، وتشغيله على D1 يفشل
// نحويًّا من أول سطر. فهو ليس سكربتًا شُغِّل بيدٍ، لكنه يحمل `INSERT INTO planets`.
//
// وحلُّه وسمٌ في رأسه، لا إعفاءٌ بالاسم في هذا الملف: نفس علاج `DOCS-101` لوثيقةٍ
// منقضية تُقرأ حقيقةً. والوسم يقول «هذا لا يُشغَّل»، ومن يكذب فيه يكذب في diff
// مقروء — وهو التبادل الذي قبله المستودع أصلًا في `doc-status`.
//
// الاستعمال:
//   node tools/ci/content-sql-outside-migrations.mjs [--check]
//   node tools/ci/content-sql-outside-migrations.mjs --self-test

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

/// جداول الكتالوج: صفٌّ فيها يجب أن يكون له ترحيلٌ يملكه.
const CONTENT_TABLES = new Set([
  'content_assets',
  'asset_links',
  'episodes',
  'episode_renditions',
  'episode_audio_tracks',
  'episode_subtitle_tracks',
  'series',
  'seasons',
  'planets',
  'stories',
  'story_pages',
  'story_page_localizations',
  'books',
  'games',
  'learning_objectives',
]);

const WRITE = /\b(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|REPLACE\s+INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_][A-Za-z0-9_]*)/gi;

/// مجلداتٌ لا تُمشى. `migrations` لأنها **الموضع الصحيح** للكتابة؛ والبقية
/// لتكلفة المشي فقط — صحّة النطاق يحكمها فلتر `git check-ignore` أدناه لا هذه
/// القائمة.
const SKIP_DIRS = new Set([
  'migrations',
  '.git',
  'node_modules',
  '.dart_tool',
  'build',
  '.wrangler',
  '.wrangler-ci',
  '.wrangler-dry-run',
]);

/// الملفات المُعترَف بها كسجلٍّ لما شُغِّل بيدٍ قبل وجود هذا الحرس.
///
/// **قائمةٌ مُجمَّدة لا إعفاء مفتوح**: محتواها صار في
/// `migrations/0092_register_first_episode_media.sql`، وتبقى هي لأن حذفها يُفقد
/// سجلّ ما شُغِّل على الإنتاج. وملفٌ جديد لا يُضاف إليها — يُضاف ترحيلًا.
const HISTORICAL_OPS_SQL = new Set([
  'tools/ops/link-episodes.sql',
  'tools/ops/thumbs-register.sql',
  'tools/ops/update-sizes.sql',
  'tools/ops/mark-33-episodes-english.sql',
]);

/// وسمُ ملفٍ تصميميّ لا يُنفَّذ على أي قاعدة. يُفحَص على الوسم لا على نثرٍ عربي،
/// لأن حرسًا على النثر يرصد الملف الذي **يشرح** الوسم ويمرّ على ملفٍ نُسخ رأسه
/// بلا معنى — فخٌّ تكرّر في هذا المستودع سبع مرّات.
/// المسافات متسامَح فيها، والنصّ لا: `-- sql-status: obsolete` وحده يُعفي، وما
/// بعده على السطر يُبطله.
const NOT_EXECUTED_MARKER = /^--\s*sql-status:\s*obsolete\s*$/;

/// الوسم يُقبل في رأس الملف فقط: سطرٌ في المنتصف يُخفي نفسه عن القارئ.
const MARKER_WINDOW = 20;

/// قواعد `.gitignore` القائمة التي تُخفي ملف `.sql`، بتاريخها.
///
/// الثلاثة مُولَّدة في 2026-08-07/08 بـ`scripts/_audit_gen_sql.mjs`، ولا يوجد في
/// المستودع ما يُثبت هل شُغِّلت على الإنتاج أم على قاعدةٍ محلية — وهي فجوةٌ
/// مُعلَنة في `migrations/LEDGER.md` لا مُرقَّعة بتخمين. وقاعدةٌ رابعة تفشل هنا.
const HISTORICAL_IGNORED_SQL = new Set([
  'dashboard/api/_audit_apply.sql',
  'dashboard/api/_slate_load.sql',
  'dashboard/api/_completion_load.sql',
]);

/// يُزيل التعليقات قبل الفحص: `-- INSERT INTO episodes` في شرحٍ ليس كتابة.
export function stripComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

/// أسماء جداول الكتالوج التي يكتب فيها هذا النص، مرتَّبة.
export function contentTablesWritten(sql) {
  const written = new Set();
  for (const match of stripComments(sql).matchAll(WRITE)) {
    const table = match[1].toLowerCase();
    if (CONTENT_TABLES.has(table)) written.add(table);
  }
  return [...written].sort();
}

/// هل يُعلن هذا الملف في رأسه أنه تصميمٌ لا يُشغَّل؟
export function declaresNotExecuted(sql) {
  return sql
    .split(/\r?\n/, MARKER_WINDOW)
    .some((line) => NOT_EXECUTED_MARKER.test(line.trim()));
}

function sqlFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      sqlFiles(join(dir, entry.name), out);
    } else if (entry.name.endsWith('.sql')) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/// المسارات التي يتجاهلها git، من بين المُعطاة.
///
/// `check-ignore` يُرجع 1 إذا لم يُطابق شيئًا — وهي حالةٌ صحيحة لا خطأ. وأي رمز
/// آخر يعني أن git لم يعمل، فيُرفَع: مِسحةٌ بلا فلترٍ تُبلّغ عن نسخٍ احتياطية
/// محلية كأنها مخالفات، ومِسحةٌ تتجاهل الفشل تُعفي الشجرة كلّها بصمت.
function gitIgnored(relPaths) {
  if (relPaths.length === 0) return new Set();
  const result = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd: repoRoot,
    input: relPaths.join('\n'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git check-ignore exited ${result.status}: ${result.stderr?.trim()}`);
  }
  return new Set(result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
}

/// قواعد `.gitignore` التي تُخفي ملف `.sql`. النفي (`!`) استثناءٌ لا إخفاء.
function gitignoreSqlRules() {
  const source = readFileSync(join(repoRoot, '.gitignore'), 'utf8');
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('!') && line.endsWith('.sql'));
}

function check() {
  const failures = [];

  const files = sqlFiles(repoRoot);
  // حرس عدم الخلاء: مِسحةٌ تجمع صفر ملف تُبلّغ نظافةً لا تعني شيئًا — وهو الفخّ
  // الذي وقع في هذا المستودع مرّتين (`tsc` على صفر ملف، ومولِّد جدول المزايا).
  if (files.length === 0) {
    failures.push('المِسحة لم تجد أي ملف `.sql` — مشيها معطوب.');
  }

  const relPaths = files.map((file) => relative(repoRoot, file).split(sep).join('/'));
  const ignored = gitIgnored(relPaths);
  const candidates = relPaths.filter((rel) => !ignored.has(rel));
  if (relPaths.length > 0 && candidates.length === 0) {
    failures.push('الفلتر استبعد كل ملفات SQL — لا شيء يُفحَص، وهذا عطلٌ لا نظافة.');
  }

  const offenders = [];
  const notExecuted = [];
  for (const rel of candidates) {
    if (HISTORICAL_OPS_SQL.has(rel)) continue;
    const source = readFileSync(join(repoRoot, rel), 'utf8');
    if (declaresNotExecuted(source)) {
      notExecuted.push(rel);
      continue;
    }
    const written = contentTablesWritten(source);
    if (written.length) offenders.push(`${rel} → ${written.join(', ')}`);
  }
  if (offenders.length) {
    failures.push(
      'كتابةٌ في جداول المحتوى من خارج `migrations/`. موضعها ترحيلٌ مرقَّم مُسجَّل\n'
      + '  في `LEDGER.md`: ملفٌ يُشغَّل بيدٍ يُترك الإنتاج والمستودع متباعدين ولا شيء\n'
      + `  يسجّل ذلك (\`DATA-201\`).\n${offenders.map((line) => `    - ${line}`).join('\n')}\n`
      + '  وإن كان الملف تصميمًا لا يُشغَّل على أي قاعدة، فأعلن ذلك بسطر\n'
      + '  `-- sql-status: obsolete` في رأسه.',
    );
  }

  // إعفاءٌ لملفٍ محذوف يُخفي أن الحرس صار أوسع مما يظنّ قارئه.
  for (const rel of HISTORICAL_OPS_SQL) {
    if (!statSync(join(repoRoot, ...rel.split('/')), { throwIfNoEntry: false })) {
      failures.push(`\`${rel}\` مُعفى في \`HISTORICAL_OPS_SQL\` ولا وجود له — احذفه من القائمة.`);
    }
  }

  const rules = gitignoreSqlRules();
  const newRules = rules.filter((rule) => !HISTORICAL_IGNORED_SQL.has(rule));
  if (newRules.length) {
    failures.push(
      'قاعدة `.gitignore` تُخفي ملف `.sql`، وهي المخرج الوحيد من المِسحة أعلاه:\n'
      + `${newRules.map((rule) => `    - ${rule}`).join('\n')}\n`
      + '  إن كان الملف يكتب محتوًى فموضعه ترحيل؛ وإن كان تشخيصًا فلا حاجة لإخفائه.',
    );
  }
  const staleRules = [...HISTORICAL_IGNORED_SQL].filter((rule) => !rules.includes(rule));
  if (staleRules.length) {
    failures.push(
      `قاعدة مُعفاة لم تبق في \`.gitignore\`: ${staleRules.join(', ')} — احذفها من `
      + '`HISTORICAL_IGNORED_SQL`.',
    );
  }

  if (failures.length) {
    console.error('content-sql-outside-migrations: فشل\n');
    for (const failure of failures) console.error(`  • ${failure}\n`);
    process.exit(1);
  }

  console.log(
    `content-sql-outside-migrations: سليم — ${candidates.length} ملف SQL في المستودع خارج `
    + `\`migrations/\`، منها ${HISTORICAL_OPS_SQL.size} مُعفاة تاريخيًّا و${notExecuted.length} `
    + 'مُعلنة أنها لا تُشغَّل، وصفر كتابة جديدة في جداول المحتوى. '
    + `(${relPaths.length - candidates.length} ملفًا مُتجاهَلًا في git خارج النطاق.)`,
  );
  if (notExecuted.length) {
    console.log(`  لا تُشغَّل (\`sql-status: obsolete\`): ${notExecuted.join(', ')}`);
  }
}

/// يُثبت أن الكاشف يفشل على ما يجب أن يفشل عليه، ويمرّ على ما يجب أن يمرّ.
/// بوابةٌ لا تُثبِت قدرتها على الفشل تُقرأ خضرتها دليلًا وهي لا تقيس شيئًا.
function selfTest() {
  const cases = [
    ['INSERT INTO episodes (id) VALUES (\'x\');', ['episodes']],
    ['INSERT OR IGNORE INTO content_assets (id) VALUES (\'x\');', ['content_assets']],
    ['REPLACE INTO asset_links (id) VALUES (\'x\');', ['asset_links']],
    ['UPDATE series SET status=\'draft\';', ['series']],
    ['DELETE FROM story_pages WHERE id=\'x\';', ['story_pages']],
    ['insert into books (id) values (\'x\');', ['books']],
    ['INSERT INTO\n  games (id)\nVALUES (\'x\');', ['games']],
    // قراءةٌ ليست كتابة.
    ['SELECT * FROM episodes;', []],
    // تعليقٌ ليس كتابة، بالشكلين.
    ['-- INSERT INTO episodes (id) VALUES (\'x\');', []],
    ['/* INSERT INTO episodes (id) VALUES (\'x\'); */', []],
    // جدولٌ خارج الكتالوج.
    ['INSERT INTO admin_users (id) VALUES (\'x\');', []],
    ['INSERT INTO audit_logs (id) VALUES (\'x\');', []],
    // `DO UPDATE SET` لا يُسمّي جدولًا.
    ['INSERT INTO admin_users (id) VALUES (\'x\') ON CONFLICT(id) DO UPDATE SET id=id;', []],
    // كتابتان في ملفٍ واحد تُجمعان مرّة واحدة لكل جدول.
    ['INSERT INTO episodes (id) VALUES (\'a\'); UPDATE episodes SET id=\'b\';', ['episodes']],
  ];

  let failed = 0;
  for (const [sql, expected] of cases) {
    const actual = contentTablesWritten(sql);
    if (actual.join(',') !== expected.join(',')) {
      failed += 1;
      console.error(`  ✗ ${JSON.stringify(sql)}\n    توقُّع [${expected}] والنتيجة [${actual}]`);
    }
  }

  const markerCases = [
    ['-- sql-status: obsolete\nINSERT INTO planets (id) VALUES (\'x\');', true],
    ['-- a\n-- b\n--   sql-status: obsolete   \n', true],
    // خارج النافذة: وسمٌ مدفونٌ لا يُعلن نفسه لقارئ الملف.
    [`${'-- filler\n'.repeat(MARKER_WINDOW)}-- sql-status: obsolete\n`, false],
    ['-- sql-status: source\n', false],
    // نصٌّ بعد الوسم يُبطله: «obsolete, but we run it» ليس إعلانًا.
    ['-- sql-status: obsolete, but we still run it\n', false],
    ['INSERT INTO planets (id) VALUES (\'x\');', false],
  ];
  for (const [sql, expected] of markerCases) {
    const actual = declaresNotExecuted(sql);
    if (actual !== expected) {
      failed += 1;
      console.error(`  ✗ الوسم: ${JSON.stringify(sql.slice(0, 40))} توقُّع ${expected} والنتيجة ${actual}`);
    }
  }

  // ولا بدّ أن يرى المِسحة ملفات فعلًا: كاشفٌ صحيح ومشيٌ معطوب يمرّ أيضًا.
  const found = sqlFiles(repoRoot).length;
  if (found === 0) {
    failed += 1;
    console.error('  ✗ المشي لم يجد أي ملف `.sql` في المستودع.');
  }

  if (failed) {
    console.error(`\ncontent-sql-outside-migrations --self-test: ${failed} حالة فاشلة`);
    process.exit(1);
  }
  console.log(
    `content-sql-outside-migrations --self-test: ${cases.length + markerCases.length} حالة ناجحة، `
    + `والمشي يرى ${found} ملف SQL.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--self-test')) selfTest();
  else check();
}
