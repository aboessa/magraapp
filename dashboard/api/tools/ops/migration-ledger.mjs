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
/**
 * يستخرج حِمل JSON من مخرَج wrangler.
 *
 * ## العطل الذي أُصلح هنا، وكان خطيرًا
 *
 * كان السطر `JSON.parse(output.slice(output.indexOf('[')))` — «يسبقه سطر عنوان
 * فيُقطع إلى أوّل قوس». وذلك صحيح محليًّا وخاطئ على البُعد: مسار `--remote` يطبع
 * كتلة إعداد تحمل `[WARNING]`، فصار **أوّل قوس** هو قوس التحذير لا قوس النتائج.
 *
 * والأثر ليس رسالةً مشوَّهة: الأداة أعلنت **صفًّا واحدًا** في `d1_migrations`
 * باسم `undefined`، ومنه استنتجت أن **96 ترحيلًا معلَّق** على الإنتاج. والواقع
 * المقيس بالاستعلام المباشر: **84 مُطبَّقًا و15 معلَّقًا**.
 *
 * ومن يصدّق ذلك ويشغّل `migrate:remote` يطبّق السلسلة من `0001_init` على قاعدةٍ
 * فيها 157 جدولًا و874 أصلًا — أي `DROP TABLE` و`CREATE TABLE` على محتوى قائم.
 * فالأداة التي وُجدت لتمنع كارثةً كانت تُرشد إليها.
 *
 * ## الحلّ: اختر بالشكل لا بالموضع
 *
 * «أوّل قوس» و«أوّل JSON صالح» **كلاهما خاطئ**: مسار `--remote` يطبع حِملين، أوّلهما
 * جدول ملخَّص `[{"Total queries executed":1,...}]` وثانيهما النتائج. فاختيار
 * الأوّل الصالح يعطي الملخَّص — وهو ما فعلته نسخةٌ وسطى من هذا الإصلاح، فأنتجت
 * نفس العطل بسببٍ آخر.
 *
 * فالاختيار على **الشكل**: أوّل حِملٍ يحمل `results`. وذاك ثابتٌ في عقد
 * `wrangler d1 execute --json` بخلاف عدد البانرات وترتيبها.
 */
export function parseWranglerJson(output) {
  // رموز ANSI تُزال أوّلًا: `\x1b[` نفسها تحمل قوسًا، فهي مرشّحٌ كاذب.
  const clean = output.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
  const hasResults = (value) => (
    Array.isArray(value) ? value.some((item) => Array.isArray(item?.results))
      : Array.isArray(value?.results)
  );
  for (let at = clean.indexOf('['); at !== -1; at = clean.indexOf('[', at + 1)) {
    let parsed;
    try {
      parsed = JSON.parse(clean.slice(at));
    } catch {
      continue; // ليس بداية حِمل.
    }
    if (hasResults(parsed)) return parsed;
  }
  throw new Error(`no JSON payload with \`results\` in wrangler output:\n${clean.slice(0, 400)}`);
}

function d1(sql, remote) {
  const statement = sql.endsWith(';') ? sql : `${sql};`;

  // ‏`--env production` على البُعد: هو البيئة التي يطبّق عليها
  // `npm run migrate:remote`، فلو قاست الأداة بيئةً أخرى لكانت تُطمئن عن قاعدةٍ
  // غير التي ستُكتَب. (المعرّف نفسه في الاثنتين اليوم، والعلَم يمنع أن يصير غيره
  // بصمت.)
  const target = remote ? ['--remote', '--env', 'production'] : ['--local'];

  /* ‏**على البُعد `--command` لا `--file`، وهذا مقيس لا مُفضَّل.**

     ‏`wrangler d1 execute --remote --file` **يرفع الملف ويُشغّله استيرادًا
     دفعيًّا**، فيُرجع ملخَّص الاستيراد لا صفوف الاستعلام:

         { "results": [ { "Total queries executed": 1, "Rows read": 1,
                          "Rows written": 0, "Database size (MB)": "13.68" } ] }

     أي أن `SELECT` عبر `--file` على البُعد **لا يُرجع صفوفًا أبدًا**. وهو ما جعل
     هذه الأداة تقرأ صفًّا واحدًا باسم `undefined` فتستنتج أن 96 ترحيلًا معلَّق على
     إنتاجٍ فيه 84 مُطبَّقًا — إرشادٌ إلى `migrate:remote` على قاعدةٍ مكتملة.
     (ويُبلّغ ذلك المسار `"changed_db": true` على `SELECT` أيضًا.)

     و`--file` يبقى محليًّا: التعليق أعلى الملف يشرح أن الصدفة على Windows تُفسد
     SQL متعدّد الأسطر، و`--bisect` يرسل بياناتٍ كاملة محليًّا. */
  if (remote) {
    // حرسٌ على القيد الذي يجعل `--command` آمنًا: استعلامات هذه الأداة سطرٌ واحد
    // بلا اقتباس مزدوج. ومن يضيف استعلامًا متعدّد الأسطر يجب أن يفشل هنا بصوتٍ
    // عالٍ، لا أن يُرسل SQL مقطوعًا تُفسده الصدفة — وهو العطل الذي أضلّ `DB-104`.
    if (/[\n"]/.test(statement)) {
      throw new Error('استعلام البُعد يجب أن يكون سطرًا واحدًا بلا اقتباس مزدوج');
    }
    const output = execFileSync('npx', [
      'wrangler', 'd1', 'execute', 'majarra-db',
      ...target, '--json', '--command', `"${statement}"`,
    ], { encoding: 'utf8', shell: process.platform === 'win32' });
    const parsed = parseWranglerJson(output);
    return (Array.isArray(parsed) ? parsed[0] : parsed)?.results ?? [];
  }

  const dir = mkdtempSync(join(tmpdir(), 'majarra-d1-'));
  const path = join(dir, 'statement.sql');
  try {
    writeFileSync(path, statement, 'utf8');
    const output = execFileSync('npx', [
      'wrangler', 'd1', 'execute', 'majarra-db',
      ...target, '--json', '--file', path,
    ], { encoding: 'utf8', shell: process.platform === 'win32' });
    const parsed = parseWranglerJson(output);
    return (Array.isArray(parsed) ? parsed[0] : parsed)?.results ?? [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/// يُثبت أن مستخرِج JSON يتجاوز البانر والتحذير ورموز ANSI.
///
/// موجود لأن العطل الذي أُصلح أعلاه **لم يكن مرئيًّا في مخرَج الأداة**: أعلنت
/// رقمًا معقولًا (صفٌّ واحد) واستنتجت منه قرارًا كارثيًّا. فالحالة تُثبَّت هنا بنصٍّ
/// ثابت لا تشغيلٍ على قاعدة.
if (has('--self-test')) {
  const cases = [
    ['[WARNING]\nProcessing wrangler.jsonc configuration:\n[{"results":[{"name":"0001_init.sql"}]}]', 1],
    [`${String.fromCharCode(27)}[33m!${String.fromCharCode(27)}[0m [WARNING] x\n[{"results":[{"name":"a"},{"name":"b"}]}]`, 2],
    ['[{"results":[]}]', 0],
    // الحالة التي كسرت النسخة الوسطى: ملخَّصٌ صالح **قبل** النتائج.
    ['[{"Total queries executed":1,"Rows read":1759}]\n[{"results":[{"name":"a"}]}]', 1],
    // وملخَّصٌ وحده بلا نتائج: لا يُقبل بديلًا.
    ['[{"Total queries executed":1}]', null],
    ['no payload here', null],
  ];
  let failed = 0;
  for (const [input, expected] of cases) {
    try {
      const rows = parseWranglerJson(input)[0].results.length;
      if (rows !== expected) {
        failed += 1;
        console.error(`  FAIL: توقّعتُ ${expected} فجاء ${rows}`);
      }
    } catch (error) {
      if (expected !== null) {
        failed += 1;
        console.error(`  FAIL: رمى على حالة صالحة — ${String(error.message).slice(0, 80)}`);
      }
    }
  }
  if (failed) {
    console.error(`self-test: ${failed} من ${cases.length} فشلت`);
    process.exit(1);
  }
  console.log(`self-test: ${cases.length} حالة نجحت`);
  process.exit(0);
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

const appliedRows = d1('SELECT name FROM d1_migrations ORDER BY name', remote);

// حرس شكل: صفوفٌ بلا عمود `name` تعني أن ما قُرئ ليس نتائج الاستعلام. وهي
// الحالة التي مرّت صامتة: صفٌّ واحد باسم `undefined` قُرئ «قاعدة فارغة» فأُعلن
// 96 ترحيلًا معلَّقًا على قاعدة إنتاج مكتملة. الفشل بصوتٍ عالٍ هو الصحيح هنا،
// لأن القرار الذي يعتمد على هذا الرقم هو `migrate:remote`.
if (appliedRows.some((row) => typeof row?.name !== 'string')) {
  console.error('فشل: صفٌّ في `d1_migrations` بلا `name` نصّي — المخرَج المُحلَّل ليس نتائج الاستعلام.');
  console.error(`أوّل صفّ: ${JSON.stringify(appliedRows[0])}`);
  process.exit(1);
}

const applied = appliedRows.map((row) => row.name);
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
