#!/usr/bin/env node
/**
 * نشرٌ مباشر إلى الإنتاج، بهويةٍ لا تُفقَد (`OPS-105`).
 *
 * ## لماذا سكربت لا `wrangler deploy` خامًا
 *
 * القرار (المالك، 2026-09-23): «احنا لسا تطوير — لما ترفع ارفع على Cloudflare
 * production علطول». فالنشر المباشر هو الافتراضي، لا الاستثناء. وذلك يجعل **مسار
 * النشر نفسه** هو الموضع الصحيح للأشياء التي تُنسى.
 *
 * وهوية البناء نُسيت مرّتين في يوم واحد: `tools/ci/write-release.mjs` يكتب
 * `src/lib/release.ts` قبل النشر، والملف المتتبَّع يحمل قيَم النائب (`unknown`).
 * فمن ينشر بـ`npx wrangler deploy` مباشرةً يشحن النائب، ويصير
 * `https://api.majarra.app/version` يقول `commit: "unknown"` — أي أن سؤال «أيّ
 * إصدارٍ يعمل الآن؟» يفقد جوابه. وقد حدث ذلك فعلًا في 2026-09-23 بعد نشرةٍ
 * مُختومة صحيحًا: نشرةٌ تالية من شجرة العمل محتها.
 *
 * فهذا السكربت يفعل الثلاثة في أمرٍ واحد: **يختم، ينشر، يُعيد النائب**. وترك
 * الخطوة الأخيرة يجعل `test/release.test.mjs` يفشل لأنه يوازن الملف المتتبَّع
 * بمخرَج القالب — وهو حرسٌ مقصود على ألّا تُودَع هوية بناءٍ محلّي.
 *
 * ## الصدق في الوسم: `run` يحمل حالة الشجرة
 *
 * `wrangler deploy` يحزم **شجرة العمل لا `HEAD`**. فبصمة الـcommit وحدها تكفي حين
 * تكون الشجرة نظيفة، وتكون **نصف الحقيقة** حين لا تكون. ولذلك يُكتب في `run`:
 *
 *   * `local-clean` — الشجرة مطابقة للـcommit، فالبصمة تصف المنشور تمامًا.
 *   * `local-dirty` — ثمّة تعديلات غير مُلتزَمة في الحزمة المنشورة.
 *
 * و«دفتر الملاحظات» هذا يظهر في `/version`، فيُقرأ الفرق بلا سؤال أحد.
 *
 * ## الأنواع: تُقاس وتُقال، ولا تمنع
 *
 * ‏`wrangler deploy` يبني بـesbuild، وهو **يُزيل الأنواع بلا فحصها**. فملفٌ لا
 * يجتاز `tsc --noEmit` يُنشَر بنجاح تامّ — وقد حدث ذلك في 2026-09-23 بملفَّي
 * مسارٍ جديدين. والمشروع في التطوير، فمنعُ النشر على خطأ نوعٍ يعطّل التكرار السريع
 * الذي طُلب صريحًا.
 *
 * فالسكربت **يقيس ويُعلن ولا يمنع**، ويقبل `--strict` لمن يريد بوابةً — وهو ما
 * يجب أن يصير الافتراض عند الإطلاق.
 *
 * الاستعمال:
 *   node tools/ci/deploy-prod.mjs            # اختم وانشر وأعِد النائب
 *   node tools/ci/deploy-prod.mjs --strict   # وافشل إن لم تجتز الأنواع
 *   node tools/ci/deploy-prod.mjs --dry-run  # ابنِ الحزمة بلا نشر
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const apiRoot = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);

const run = (command, commandArgs, options = {}) => spawnSync(command, commandArgs, {
  cwd: apiRoot,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  ...options,
});

function git(...gitArgs) {
  return execFileSync('git', gitArgs, { cwd: apiRoot, encoding: 'utf8' }).trim();
}

const commit = git('rev-parse', 'HEAD');
// `--porcelain` على المستودع كلّه لا على هذه الحزمة: الحزمة تستورد من الجذر، وشجرةٌ
// متسخة في أي موضع تعني أن المنشور ليس هو الـcommit.
const dirty = git('status', '--porcelain').length > 0;
const label = dirty ? 'local-dirty' : 'local-clean';

console.log(`commit: ${commit.slice(0, 12)}  tree: ${dirty ? 'DIRTY' : 'clean'}`);

const types = run('npx', ['tsc', '--noEmit']);
if (types.status !== 0) {
  console.error('\n‏`tsc --noEmit` لم يجتز. وesbuild يُزيل الأنواع بلا فحص، فهذا يُنشَر كما هو:');
  console.error((types.stdout || types.stderr || '').split('\n').slice(0, 20).join('\n'));
  if (has('--strict')) {
    console.error('\n‏--strict: توقّف قبل النشر.');
    process.exit(1);
  }
  console.error('\nيتابع النشر (المشروع في التطوير). استخدم --strict لتحويله بوابة.\n');
} else {
  console.log('tsc --noEmit: نظيف');
}

const stamp = run('node', ['tools/ci/write-release.mjs', '--commit', commit, '--run', label], {
  stdio: 'inherit',
});
if (stamp.status !== 0) {
  console.error('فشل ختم الهوية، فلا نشر: نشرةٌ بلا هوية هي العطل الذي وُجد هذا السكربت له.');
  process.exit(1);
}

try {
  const deployArgs = has('--dry-run')
    ? ['wrangler', 'deploy', '--dry-run', '--outdir', '.wrangler-dry-run', '--env', 'production']
    : ['wrangler', 'deploy', '--env', 'production'];
  const deploy = run('npx', deployArgs, { stdio: 'inherit' });
  if (deploy.status !== 0) process.exitCode = deploy.status ?? 1;
} finally {
  // **دائمًا**: النائب يعود سواء نجح النشر أم فشل. هويةٌ محلّية مُودَعة في git
  // تُفشل `release.test.mjs`، وهو الحرس الذي يمنع أن تُقرأ بصمةُ جهازِ مطوّر
  // كأنها إصدار.
  const reset = run('node', ['tools/ci/write-release.mjs', '--reset'], { stdio: 'inherit' });
  if (reset.status !== 0) {
    console.error('تنبيه: لم تُعَد قيَم النائب إلى `src/lib/release.ts` — أعِدها بيدك.');
    process.exitCode = 1;
  }
}

if (!has('--dry-run') && process.exitCode === undefined) {
  console.log('\nتحقّق: curl https://api.majarra.app/version');
}
