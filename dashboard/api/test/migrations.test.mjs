import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// `DB-101` — سجل ترحيلات خطّي واحد.
///
/// ## العلّة التي يمنعها هذا الملف
///
/// اسم ملف الترحيل هو **مفتاح** جدول `d1_migrations`. فإعادة تسميته تجعله يبدو
/// غير مُطبَّق فيُطبَّق ثانيةً، ويبقى الصفّ القديم يشير إلى ملف لا وجود له.
///
/// وقد حدث: ثلاثة ملفات (`0051`–`0053`) أُعيد ترقيمها إلى (`0054`–`0056`) بعد
/// تطبيقها، فصار في القاعدة المحلية **٩٢ صفًّا مقابل ٨٩ ملفًا**، وأُعيد تنفيذ
/// محتواها. ونجا ذلك لأن بذورها `INSERT OR IGNORE` — حظًّا لا تصميمًا.
///
/// ولهذا يثبّت هذا الاختبار **قائمة الملفات نفسها** في `LEDGER.md`: لا إضافة ولا
/// حذف ولا إعادة تسمية تمرّ بلا تحديث السجل، وتحديثه يعني أن أحدًا قرأ القاعدة.

const migrationsDir = fileURLToPath(new URL('../migrations/', import.meta.url));
const ledger = readFileSync(`${migrationsDir}LEDGER.md`, 'utf8');

const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const listed = (() => {
  const start = ledger.indexOf('MIGRATION-LIST:BEGIN');
  const end = ledger.indexOf('MIGRATION-LIST:END');
  assert.ok(start > 0 && end > start, 'LEDGER.md must carry a delimited file list');
  return ledger.slice(ledger.indexOf('\n', start), end)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.sql'));
})();

/* ------------------------------------------------------- القائمة هي العقد */

test('كل ملف ترحيل مُدرَج في السجل، ولا سطر في السجل بلا ملف', () => {
  // إعادة تسمية ملف تُظهر نفسها هنا كإضافة وحذف معًا، فلا تمرّ صامتة.
  assert.deepEqual(files, listed);
});

test('عدد الملفات مُعلَن في السجل', () => {
  assert.match(ledger, new RegExp(`## الملفات \\(${files.length}\\)`),
    `حدّث العدد في LEDGER.md إلى ${files.length}`);
});

/* --------------------------------------------------------- شكل الأسماء */

test('كل اسم يتبع `NNNN_snake_case.sql`', () => {
  // والحرف اللاحق (`0074b`) مسموح للملفات القائمة وحدها: القائمة أدناه مغلقة.
  const LETTERED = ['0074b_wave4_fix.sql', '0074c_wave4_games.sql', '0074d_final6_games.sql'];
  for (const name of files) {
    if (LETTERED.includes(name)) continue;
    assert.match(name, /^\d{4}_[a-z0-9_]+\.sql$/, `اسم غير قياسي: ${name}`);
  }
});

test('لا صيغة فرعية جديدة بحرف لاحق', () => {
  // الحرف لا يُرتَّب مع الأرقام بأي منطق مقروء، ويوحي بأن الأصل «نسخة أولى»
  // بينما هو مُطبَّق ولا يُعدَّل.
  const lettered = files.filter((name) => /^\d{4}[a-z]_/.test(name));
  assert.deepEqual(lettered.sort(), [
    '0074b_wave4_fix.sql', '0074c_wave4_games.sql', '0074d_final6_games.sql',
  ], 'الإصلاح بترحيل برقم جديد لا بحرف لاحق');
});

/* ------------------------------------------------- التكرار والفجوات */

const numberOf = (name) => name.slice(0, 4);

test('الأرقام المكرَّرة هي الثلاثة الموثَّقة ولا غيرها', () => {
  // مكرَّرٌ لا يكسر ترتيب wrangler (يرتّب بالاسم الكامل)، لكنه يجعل «0051» لا
  // تعني ملفًا واحدًا في محادثة — وهو ما أخفى إعادة الترقيم أصلًا.
  const counts = new Map();
  for (const name of files) {
    // الصيغ الفرعية (`0074b`) تشترك في الرقم بحكم تعريفها، ولها اختبارها أعلاه.
    // عدُّها تكرارًا هنا كان سيخلط حالتين لكل واحدة قاعدتها.
    if (/^\d{4}[a-z]_/.test(name)) continue;
    const key = numberOf(name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const duplicated = [...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key).sort();
  assert.deepEqual(duplicated, ['0018', '0051', '0081'], 'لا رقم مكرَّر جديد');
  for (const key of duplicated) {
    assert.match(ledger, new RegExp(`\\| ${key} \\|`), `الرقم المكرَّر ${key} يجب أن يُوثَّق`);
  }
});

test('كل فجوة موثَّقة بسببها', () => {
  const numbers = new Set(files.map((name) => Number(numberOf(name))));
  const highest = Math.max(...numbers);
  const gaps = [];
  for (let candidate = 1; candidate <= highest; candidate += 1) {
    if (!numbers.has(candidate)) gaps.push(String(candidate).padStart(4, '0'));
  }
  assert.deepEqual(gaps, ['0020', '0052', '0053'], 'فجوة جديدة تحتاج سببًا في السجل');
  for (const gap of gaps) {
    assert.match(ledger, new RegExp(gap), `الفجوة ${gap} يجب أن تُوثَّق`);
  }
});

/* ------------------------------------------- لا ترحيل خارج المجلد */

test('لا ملف ترحيل خارج `migrations_dir`', () => {
  // `migrations/catalog/0001_catalog_init.sql` كان خارجه: لا wrangler يطبّقه ولا
  // سكربت ينادِيه، ومع ذلك يُعلن `series` و`episodes` بأربعة أعمدة مقابل
  // ثلاثين في `0001_init.sql`. أي مخطَّط ثانٍ متناقض ينتظر من يطبّقه بالخطأ.
  const stray = [];
  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const inner of readdirSync(migrationsDir + entry.name)) {
      if (inner.endsWith('.sql')) stray.push(`${entry.name}/${inner}`);
    }
  }
  assert.deepEqual(stray, [], 'ترحيل خارج المجلد لا يُطبَّق ولا يُراجَع');
  assert.equal(
    existsSync(`${migrationsDir}catalog/0001_catalog_init.sql`),
    false,
    'المخطَّط الثاني المتناقض حُذف في الدفعة 26',
  );
});

/* --------------------------------------------------- ما يعرفه السجل */

test('السجل يذكر الحادثة وأثرها لا القاعدة وحدها', () => {
  // قاعدة بلا سببها تُنقَض عند أوّل ضيق وقت. والسبب هنا مقيس: ٩٢ صفًّا مقابل ٨٩
  // ملفًا، وثلاثة ترحيلات نُفِّذت مرّتين.
  for (const name of ['0051_wave1_games.sql', '0052_wave2_depth.sql', '0053_wave3_final.sql']) {
    assert.match(ledger, new RegExp(name.replace(/[.]/g, '\\.')), `السجل يجب أن يذكر ${name}`);
  }
  assert.match(ledger, /٩٢|92/, 'عدد الصفوف المقيس يجب أن يبقى في السجل');
  assert.match(ledger, /0074_wave4_closure_36_games\.sql/, 'موضع فشل البناء النظيف يجب أن يبقى موثَّقًا');
});

/* ------------------------------------------- البناء النظيف (`DB-104`) */

/// يقسّم ملفًّا إلى بياناته، مع تقشير تعليقات الرأس لا قصّ الكتلة بها.
function statementsOf(sql) {
  return sql
    .split(/;\s*$/m)
    .map((chunk) => chunk
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
      .trim())
    .filter(Boolean);
}

/// المعرّف الأوّل في كل صفّ من `INSERT ... VALUES`.
///
/// ماسحٌ يتتبّع الاقتباس والعمق بدل تعبير نمطي، لأن التعبير النمطي أخطأ مرّتين
/// هنا قبل أن يُستبدَل: مرّةً باشتراط أن يكون قوس الصفّ في بداية سطر (ونصف ملفات
/// البذر تكتب `VALUES (` ثم تنزل سطرًا)، ومرّةً بالنظر **داخل** نصوص JSON فحسب
/// مفاتيح الترجمة معرّفات ألعاب. وحرسٌ يصرخ في السليم يُعطَّل في أوّل أسبوع.
///
/// وما داخل الاقتباس لا يُقرأ أصلًا هنا، والمضاعَف (`''`) يُبتلع، فلا تُغلَق قيمة
/// نصفها نصّ.
function rowIds(statement) {
  const from = statement.search(/\bVALUES\b/i);
  if (from < 0) return [];
  const sql = statement.slice(from);
  const ids = [];
  let inLiteral = false;
  let depth = 0;
  let expectId = false;
  let literal = '';
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (inLiteral) {
      if (char !== "'") { literal += char; continue; }
      if (sql[index + 1] === "'") { literal += "'"; index += 1; continue; }
      inLiteral = false;
      if (expectId) { ids.push(literal); expectId = false; }
      continue;
    }
    if (char === "'") { inLiteral = true; literal = ''; continue; }
    if (char === '(') { depth += 1; if (depth === 1) expectId = true; continue; }
    if (char === ')') { depth = Math.max(0, depth - 1); if (depth === 0) expectId = false; continue; }
    if (char === ',' && depth === 1) expectId = false;
  }
  return ids;
}

test('لا ترجمة لعبة تُدرَج قبل لعبتها في تسلسل الترحيلات', () => {
  // العطل الذي أوقف كل بناء نظيف عند `0074`: صفّ في `game_localizations` يشير
  // إلى لعبة يُدرَجها **نفس الملف بعده بثلاثة بيانات**. و`INSERT OR IGNORE` لا
  // يبتلع مخالفة مفتاح أجنبي — خيار `ON CONFLICT` لا يشمل `FOREIGN KEY` — فيفشل
  // الملف كلّه ويتوقّف كل ما بعده.
  //
  // والفحص هنا يحاكي **الحالة عند البيان** لا الحالة النهائية: ذلك بالضبط ما
  // أخطأ فيه الفحص اليدوي أوّل مرّة فأعلن أن كل المفاتيح «تحلّ».
  const known = new Set();
  const violations = [];
  for (const name of files) {
    for (const statement of statementsOf(readFileSync(migrationsDir + name, 'utf8'))) {
      if (/^INSERT\b[\s\S]*?\bINTO\s+games\s*\(/i.test(statement)) {
        for (const id of rowIds(statement)) known.add(id);
        continue;
      }
      if (!/^INSERT\b[\s\S]*?\bINTO\s+game_localizations\s*\(/i.test(statement)) continue;
      for (const id of rowIds(statement)) {
        if (!known.has(id)) violations.push(`${name}: ${id}`);
      }
    }
  }
  assert.deepEqual(violations, [], 'ترجمة قبل لعبتها تُفشل البناء النظيف عند هذا الملف');
});

test('الصفّ الذي كان يُفشل 0074 لم يعد فيه', () => {
  const sql = readFileSync(`${migrationsDir}0074_wave4_closure_36_games.sql`, 'utf8');
  // الصفّ الوحيد بحالة `draft` في الملف كان هو المخالف.
  assert.equal(sql.includes("'draft')"), false, 'صفّ الترجمة المُبكِّر أُسقط');
  assert.match(sql, /DB-104/, 'سبب تحرير ترحيل مُطبَّق يبقى في الملف');
});

test('ترحيل التقريب يُحدِّث ولا يُدرج', () => {
  // `UPDATE` بلا إدراج: إن غاب الصفّ فلا شيء يحدث ولا قيد مرجعي يُختبر — فلا
  // يُعيد الترحيلُ العطلَ الذي جاء يصلحه.
  const sql = readFileSync(`${migrationsDir}0087_db104_trace_localization_convergence.sql`, 'utf8');
  assert.match(sql, /^\s*UPDATE game_localizations/m);
  // التعليق يُقشَّر بلا `$`: الملفات بنهايات CRLF، و`.*$` لا يبلغ `\r`.
  //
  // والتقشير شرطٌ لا تحسين: التعليق **يشرح** المفتاح الخاطئ ويسمّي `INSERT OR
  // IGNORE` بالنصّ، فالفحص على الملف كلّه كان يقيس الشرح لا ما يُنفَّذ.
  const executable = sql.replace(/^--.*/gm, '');
  assert.equal(/INSERT\s+/i.test(executable), false, 'لا إدراج في ترحيل التقريب');
  assert.match(executable, /game\.trace\.word\.amal/, 'المفتاح الذي يطلبه المستوى الثالث');
  assert.equal(executable.includes('game.trace.free'), false, 'المفتاح المنقول عن لعبة أخرى يُزال');
});

test('السجل يعلن أن البناء النظيف مَحروس، لا أنه فاشل', () => {
  assert.equal(ledger.includes('يفشل اليوم'), false, 'الحالة تغيّرت فيُحدَّث السجل');
  assert.match(ledger, /--require-applied/, 'بوابة CI تُذكَر في السجل');
  assert.match(ledger, /0087_db104_trace_localization_convergence\.sql/);
});

test('CI يبني القاعدة من الصفر ويمنع المرور بملف معلَّق', () => {
  // بوابة لا توثيق: هذا الانهيار عاش شهورًا لأن كل بيئة قائمة بُنيت تدريجيًّا،
  // فلم يمرّ أحد على المسار من الصفر.
  const workflow = readFileSync(
    fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url)),
    'utf8',
  );
  assert.match(workflow, /^ {2}migrations:$/m, 'مهمّة البناء النظيف');
  assert.match(workflow, /migration-ledger\.mjs --local --require-applied/);
  // وبلا هذا تبقى المهمّة خارج شرط النشر فتفشل بلا أثر.
  assert.match(workflow, /needs: \[flutter, worker, admin, migrations,/);
});

test('أداة مقارنة السجل موجودة وتقرأ فقط', () => {
  const tool = readFileSync(
    fileURLToPath(new URL('../tools/ops/migration-ledger.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(tool, /--remote/);
  assert.match(tool, /--bisect/);
  assert.match(tool, /--require-applied/);
  // التعليق يُقشَّر سطرًا سطرًا: إسقاط القطعة التي تبدأ بـ`--` كان يُسقط بيانها
  // معه، فأعلنت الأداة «بيانًا واحدًا» في ملفٍ فيه تسعة وسمّت السليم فاشلًا.
  assert.match(tool, /startsWith\('--'\)/);
  // و`--file` بدل `--command`: الاقتباس اليدوي عبر `cmd.exe` كان يُفسد كل
  // استعلام فيه سطر جديد.
  assert.match(tool, /'--file'/);
  assert.equal(tool.includes("'--command'"), false, 'الاستعلام لا يمرّ بصدفة');
  assert.match(tool, /SELECT name FROM d1_migrations/);
  // أداةٌ تكتب في القاعدة أثناء تشخيصها تُغيّر ما تقيسه.
  assert.equal(/INSERT INTO|UPDATE |DELETE FROM/.test(tool), false, 'الأداة تقرأ ولا تكتب');
});
