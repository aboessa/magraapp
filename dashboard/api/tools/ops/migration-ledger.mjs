#!/usr/bin/env node
/**
 * سجل الترحيلات: مقارنة الملفات بما هو مُطبَّق فعلًا (`DB-101`).
 *
 * ## العلّة
 *
 * «ما المُطبَّق على الإنتاج؟» سؤالٌ لم يكن له جواب. والسجل المحلي وحده كان فيه
 * **٩٢ صفًّا مقابل ٨٩ ملفًا** — ثلاثة صفوف تشير إلى ملفات أُعيد تسميتها، فأُعيد
 * تنفيذ محتواها بأسمائها الجديدة.
 *
 * ## الأوضاع
 *
 *   --local            يقارن قاعدة التطوير
 *   --remote           يقارن الإنتاج (يحتاج بيانات اعتماد Cloudflare)
 *   --list             يطبع قائمة الملفات لتحديث LEDGER.md
 *   --bisect <file>    ينصّف ترحيلًا فاشلًا بيانًا بيانًا
 *   --require-applied  يفشل إن بقي ملفٌ معلَّقًا (بوابة البناء النظيف في CI)
 *
 * ولا يكتب شيئًا في القاعدة بأي وضع.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = fileURLToPath(new URL('../../migrations/', import.meta.url));
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

const files = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();

/**
 * ينفّذ SQL على D1 عبر **ملف مؤقّت** لا عبر `--command`.
 *
 * السبب ليس أناقة: `npx` على Windows مُصدِّف `.cmd`، وNode يرفض تشغيله بلا
 * `shell: true` (‏`EINVAL`)، ومع الصدفة يلزم اقتباسٌ يدويّ يُفسد أي استعلام فيه
 * سطر جديد. فالنتيجة كانت **فشلًا مُختلقًا يُنسَب إلى بيان SQL سليم** — وهو ما
 * أضلّ تشخيص `DB-104` دورةً كاملة. الملف يُخرِج SQL من مسار الصدفة أصلًا.
 */
function d1(sql, remote) {
  const dir = mkdtempSync(join(tmpdir(), 'majarra-d1-'));
  const path = join(dir, 'statement.sql');
  try {
    writeFileSync(path, sql.endsWith(';') ? sql : `${sql};`, 'utf8');
    const output = execFileSync('npx', [
      'wrangler', 'd1', 'execute', 'majarra-db',
      remote ? '--remote' : '--local',
      '--json', '--file', path,
    ], { encoding: 'utf8', shell: process.platform === 'win32' });
    // مخرَج wrangler يسبقه سطر عنوان، فيُقطع إلى أوّل قوس.
    const parsed = JSON.parse(output.slice(output.indexOf('[')));
    return (Array.isArray(parsed) ? parsed[0] : parsed)?.results ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (has('--list')) {
  console.log(files.join('\n'));
  process.exit(0);
}

const bisectIndex = args.indexOf('--bisect');
if (bisectIndex >= 0) {
  const target = args[bisectIndex + 1];
  if (!target) {
    console.error('--bisect يحتاج اسم ملف');
    process.exit(2);
  }
  // البيانات تُفصَل على `;` في نهاية سطر: كافٍ لهذه الملفات (لا مُشغَّلات ولا
  // دوالّ فيها فاصلة منقوطة داخلية)، ومُعلَن حتى لا يُفترض أنه محلّل SQL كامل.
  //
  // وتعليقات الرأس **تُقشَّر ولا تُقصَ الكتلة بها**: كلّ قطعة تبدأ بالتعليق الذي
  // كان يعلو بيانها، فإسقاط ما يبدأ بـ`--` كان يُسقط البيان نفسه. الأداة حينها
  // أعلنت «بيانًا واحدًا» في ملفٍ فيه عشرات، وسمّت السليم فاشلًا.
  const statements = readFileSync(MIGRATIONS + target, 'utf8')
    .split(/;\s*$/m)
    .map((chunk) => chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim())
    .filter(Boolean);

  console.log(`${statements.length} بيانًا في ${target}. التطبيق بيانًا بيانًا على القاعدة المحلية:\n`);
  for (const [index, statement] of statements.entries()) {
    const label = `${index + 1}/${statements.length}`;
    try {
      d1(statement, false);
      console.log(`  ok    ${label}  ${statement.slice(0, 70).replace(/\s+/g, ' ')}`);
    } catch (error) {
      console.error(`\n  FAIL  ${label}`);
      console.error(`  ${statement.slice(0, 400)}`);
      console.error(`\n  ${String(error.stderr ?? error.message).slice(0, 400)}`);
      process.exit(1);
    }
  }
  console.log('\nكل البيانات نجحت منفردة. الفشل إذن في تفاعل بينها أو في ترتيب الدفعة.');
  process.exit(0);
}

const remote = has('--remote');
if (!remote && !has('--local')) {
  console.error('اختر --local أو --remote (أو --list أو --bisect)');
  process.exit(2);
}

const applied = d1('SELECT name FROM d1_migrations ORDER BY name', remote).map((row) => row.name);
const orphans = applied.filter((name) => !files.includes(name));
const pending = files.filter((name) => !applied.includes(name));

console.log(`# الترحيلات — ${remote ? 'الإنتاج' : 'التطوير المحلي'}`);
console.log(`\nآخر فحص: ${new Date().toISOString()}`);
console.log(`\n- ملفات في المستودع: **${files.length}**`);
console.log(`- صفوف في \`d1_migrations\`: **${applied.length}**`);

console.log(`\n## صفوف بلا ملف (${orphans.length})`);
if (orphans.length === 0) console.log('\nلا شيء.');
else {
  console.log('\nكلٌّ منها ترحيلٌ **طُبِّق ثم أُعيد تسميته أو حُذف ملفه**. ومعناه أن محتواه');
  console.log('طُبِّق مرّة، وقد يُطبَّق ثانيةً بالاسم الجديد:\n');
  for (const name of orphans) console.log(`- \`${name}\``);
}

console.log(`\n## ملفات معلَّقة (${pending.length})`);
if (pending.length === 0) console.log('\nلا شيء. المستودع والقاعدة متطابقان.');
else for (const name of pending) console.log(`- \`${name}\``);

// المعلَّق ليس خطأً بذاته: على الإنتاج يعني أن المالك لم ينشر بعد. أما في بناءٍ
// نظيف فهو **انهيار في منتصف السلسلة** — وهو تحديدًا ما بقي مخفيًّا في `DB-104`
// حتى فُحص بيدٍ. فالحدّة تُطلَب صريحةً بعلَم، ولا تُستنتج من الوضع.
const requireApplied = has('--require-applied');
if (requireApplied && pending.length > 0) {
  console.error(`\nفشل: ${pending.length} ترحيلًا لم يُطبَّق. أوّل المعلَّق: ${pending[0]}`);
}
process.exitCode = (orphans.length > 0 || (requireApplied && pending.length > 0)) ? 1 : 0;
