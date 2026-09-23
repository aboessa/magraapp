import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { RELEASE } from '../src/lib/release.ts';
import { PLACEHOLDER, identityFrom, renderRelease } from '../tools/ci/write-release.mjs';

/// `OPS-105` — «أيّ إصدارٍ يعمل الآن؟» سؤالٌ يجيب عنه الإنتاج نفسه.
///
/// ## العلّة
///
/// النشر كان يدويًّا وغير موثَّق، ولا شيء يربط ما يعمل بـcommit مُتحقَّق منه.
/// و`API_VERSION` قيمتها `v1` قبل النشر وبعده لأنها **عقد الـAPI** لا هوية البناء،
/// فقراءتها كإجابة تُطمئن بلا معلومة.

const read = (relative) => readFileSync(
  fileURLToPath(new URL(`../${relative}`, import.meta.url)),
  'utf8',
);

/* ----------------------------------------------- الملف المُولَّد لا ينحرف */

test('`src/lib/release.ts` المتتبَّع هو مخرَج القالب بقيَم النائب', () => {
  // مصدرٌ واحد: القالب في `write-release.mjs`. وبلا هذه الموازنة يمكن أن يُحرَّر
  // الملف بيد فيختلف عن مخرَج المسار الذي ينشر — ويظهر الفرق في الإنتاج وحده.
  assert.equal(read('src/lib/release.ts'), renderRelease(PLACEHOLDER));
});

test('قيَم النائب `unknown` لا فراغ ولا تاريخ مُختلَق', () => {
  // بناءٌ محلي أو نشرٌ يدوي **لا يعرف** رقم الإصدار. و`''` تُقرأ حقلًا ناقصًا،
  // وتاريخُ اللحظة يُقرأ حقيقةً — والصدق هنا أنفع من كليهما.
  assert.deepEqual(RELEASE, { commit: 'unknown', builtAt: 'unknown', run: 'unknown' });
});

/* --------------------------------------------------- اشتقاق الهوية */

test('البصمة تُقتطع إلى ١٢ محرفًا عند الكتابة', () => {
  // الاقتطاع في موضع واحد: لو اقتطع الكاتبُ بطولٍ والموازِنُ بعد النشر بطولٍ آخر،
  // فشل التحقّق على نشرٍ سليم.
  const identity = identityFrom(['--commit', '0123456789abcdef0123', '--run', '77']);
  assert.equal(identity.commit, '0123456789ab');
  assert.equal(identity.run, '77');
});

test('وسائط ناقصة تعطي النائب لا نصفَ هوية', () => {
  assert.equal(identityFrom(['--commit', 'abc123']).run, 'unknown');
  assert.equal(identityFrom([]).commit, 'unknown');
  assert.deepEqual(identityFrom(['--reset']), PLACEHOLDER);
});

test('وقت البناء ISO بلا كسور الثانية', () => {
  const identity = identityFrom(['--commit', 'abc123'], new Date('2026-08-28T21:04:05.123Z'));
  assert.equal(identity.builtAt, '2026-08-28T21:04:05Z');
});

test('القالب يرفض قيمة تكسر ملف TypeScript', () => {
  // القيَم تُكتب داخل نصّ مقتبَس، فاقتباسٌ أو سطر جديد فيها يُنتج ملفًا لا يُترجَم —
  // أو أسوأ: يُترجَم بشيء آخر.
  for (const bad of ["a'b", 'a"b', 'a\\b', 'a\nb']) {
    assert.throws(() => renderRelease({ ...PLACEHOLDER, commit: bad }), /محرف غير مسموح/);
  }
  assert.throws(() => renderRelease({ ...PLACEHOLDER, commit: '' }), /نصًّا غير فارغ/);
});

/* ------------------------------------------------- النقطة النهائية */

test('`/version` يُعلن الحقول الثلاثة من الحزمة لا من الإعداد', () => {
  const index = read('src/index.ts');
  assert.match(index, /app\.get\('\/version'/);
  for (const field of ['RELEASE.commit', 'RELEASE.builtAt', 'RELEASE.run']) {
    assert.ok(index.includes(field), `${field} يجب أن يُعلَن في /version`);
  }
});

test('`/version` مُركَّب قبل عارض الصفحات العامة', () => {
  // ترتيبٌ **دلالته الأسبقية** لا موضعه: عارض الصفحات مُركَّب على `/` ويطابق ما لم
  // يُطابَق قبله، فلو سبق `/version` لأجاب بصفحة HTML — أي «نشرٌ لم يُتحقَّق منه»
  // في كل جولة، بلا سبب ظاهر.
  const index = read('src/index.ts');
  const version = index.indexOf("app.get('/version'");
  const siteFiles = index.indexOf("app.route('/', siteFiles)");
  const publicRender = index.indexOf("app.route('/', publicRenderRoute)");
  assert.ok(version > 0 && siteFiles > 0 && publicRender > 0);
  assert.ok(version < siteFiles, '/version قبل ملفات الموقع');
  assert.ok(version < publicRender, '/version قبل العارض العام');
});

/* -------------------------------------------------- مسار النشر في CI */

const workflow = readFileSync(
  fileURLToPath(new URL('../../../.github/workflows/ci.yml', import.meta.url)),
  'utf8',
);

test('النشر يحدث فعلًا حين يوجد التوكن، ولا يحتاج تحرير ملف', () => {
  // العلّة التي يمنعها هذا: النسخة السابقة كانت مثبَّتة على `--dry-run` مع تعليق
  // يشرح أن التوكن مطلوب. أي أن المالك يضيف السرّين ثم **لا يُنشَر شيء** حتى
  // يتذكّر أحدٌ تحرير الملف. فالتوكن هنا شرطٌ في وقت التشغيل.
  assert.match(workflow, /^ {2}deploy:$/m);
  assert.match(workflow, /id: creds/);
  assert.match(workflow, /steps\.creds\.outputs\.present == 'true'/);
  assert.match(workflow, /steps\.creds\.outputs\.present == 'false'/);
  // والنشر الحقيقي بلا `--dry-run`.
  assert.match(workflow, /npx wrangler deploy --env production 2>&1/);
});

test('النشر لا يبدأ إلا بعد خضرة كل الوظائف ومن فرع الإصدار وحده', () => {
  assert.match(workflow, /needs: \[flutter, worker, admin, migrations, content-pacing, secrets, dependencies\]/);

  /* ‏**الاسمان معًا، وهذا تصحيح لعطل مقيس (2026-09-23).**

     كان التوكيد يثبّت `refs/heads/master` وحده. والمقيس على الخادم أن الفرع
     البعيد الوحيد هو `main` (`origin/HEAD -> origin/main`)، و`master` محليٌّ فقط
     يشير إلى نفس الـcommit. فوظيفة النشر كانت مشروطةً بمرجعٍ لا وجود له — أي
     **نشرٌ لا يُطلَق أبدًا**، وكل الوظائف خضراء فوقه.

     وهو نفس عطل `on:` معكوسًا: ذاك التعليق يقول إن القائمة كانت `main` وحدها
     و`main` لا وجود له، فأضاف `master`. والواقع أن `main` هو الموجود. فالعلاج
     الذي لا يتكرّر هو **قبول الاسمين في الموضعين**، لا اختيار أحدهما. */
  assert.match(
    workflow,
    /if: \(github\.ref == 'refs\/heads\/master' \|\| github\.ref == 'refs\/heads\/main'\) && github\.event_name == 'push'/,
  );

  // والمُطلِقات تحمل الاسمين أيضًا، وإلّا فشرطُ النشر يقبل فرعًا لا يبنيه أحد.
  assert.match(workflow, /branches: \[master, main\]/);
});

test('النشر يُتحقَّق منه بسؤال الإنتاج، ويُوسَم بربط الإصدار بالـcommit', () => {
  // «نشرٌ نجح» ونسخةٌ قديمة تخدم الطلبات هو ما تمنعه الموازنة.
  assert.match(workflow, /api\.majarra\.app\/version/);
  assert.match(workflow, /cut -c1-12/, 'يوازن بنفس طول الاقتطاع المخبوز');
  assert.match(workflow, /git tag -a "\$tag"/);
  assert.match(workflow, /contents: write/, 'الوسم يحتاج صلاحية كتابة');
});

test('النشر لا يُطبِّق ترحيلات', () => {
  // نشرٌ سيّئ يُلغيه `wrangler rollback` في ثوانٍ، وترحيلٌ سيّئ لا يُلغيه شيء يملكه
  // هذا المسار. فربطهما يعني أن تغييرًا في المخطَّط يركب مع إصلاح نصّ عابر.
  const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));
  assert.equal(/migrate:remote|migrations apply/.test(deployJob), false);
});
