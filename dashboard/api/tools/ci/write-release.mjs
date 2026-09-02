#!/usr/bin/env node
/**
 * يكتب هوية الإصدار في `src/lib/release.ts` قبل النشر (`OPS-105`).
 *
 * ## لماذا ملفٌ في الحزمة لا متغيّر بيئة
 *
 * السؤال «أيّ إصدارٍ يعمل الآن؟» لم يكن له جواب. و`API_VERSION` في
 * `wrangler.jsonc` قيمته `v1` دائمًا: هي **عقد الـAPI** لا هوية البناء، فتقول
 * الشيء نفسه قبل النشر وبعده.
 *
 * والهوية تُخبَز في الحزمة نفسها، لا تُمرَّر بـ`wrangler deploy --var`، لأن دلالة
 * دمج `--var` مع `vars` المُعلَنة في الإعداد ليست شيئًا نريد المقامرة عليه في
 * مسار النشر: لو استبدلت الخريطة بدل أن تضيف إليها، فقدت `ENVIRONMENT` و
 * `API_VERSION` وانكسر الإنتاج **بعد** خضرة كل الفحوص. والملف المُولَّد لا دلالة
 * فيه تُفاجئ: ما يُقرأ هو ما كُتب.
 *
 * ## القالب هنا هو المصدر
 *
 * الملف المتتبَّع في المستودع يحمل قيَم النائب (`unknown`)، وهو **مخرَج هذا القالب
 * نفسه** — يثبّت ذلك اختبارٌ يوازن الاثنين. فلا نسخة تنحرف عن الأخرى بتحرير يدوي،
 * ولا تنبيه «الملف تغيّر» يظهر في كل جولة CI.
 *
 * ## الاستخدام
 *
 *   node tools/ci/write-release.mjs --commit <sha> --run <id>
 *   node tools/ci/write-release.mjs --reset      # يعيد قيَم النائب
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// قيمة كل حقل حين لا يكون البناء صادرًا عن CI: تطوير محلي، أو اختبار، أو نشر
/// يدوي. و«unknown» صريحة مقصودة: أفضل من `''` تُقرأ كحقلٍ ناقص، ومن تاريخٍ
/// مُختلَق يُقرأ كأنه حقيقة.
export const PLACEHOLDER = { commit: 'unknown', builtAt: 'unknown', run: 'unknown' };

const TARGET = fileURLToPath(new URL('../../src/lib/release.ts', import.meta.url));

/// النصّ الكامل لـ`src/lib/release.ts` بقيَم مُعطاة.
export function renderRelease({ commit, builtAt, run }) {
  for (const [key, value] of Object.entries({ commit, builtAt, run })) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`قيمة ${key} يجب أن تكون نصًّا غير فارغ`);
    }
    // القيَم تُكتب داخل نصّ TypeScript، فأي اقتباس أو سطر جديد فيها يكسر الملف.
    // والمصدر هو بيئة CI، فالتحقّق حرسٌ لا تشكيك في نيّة.
    if (/['"\\\r\n]/.test(value)) throw new Error(`قيمة ${key} فيها محرف غير مسموح`);
  }
  return `/// هوية البناء — يُولَّد بـ\`tools/ci/write-release.mjs\` (\`OPS-105\`).
///
/// **لا يُحرَّر بيد.** القيَم أدناه قيَم النائب، وتُستبدل في مسار النشر وحده. وأي
/// تحرير يدوي يُفشل \`test/release.test.mjs\` لأنه يوازن الملف بمخرَج القالب.
///
/// و\`unknown\` جوابٌ صادق لا نقصٌ: بناءٌ محلي أو نشرٌ يدوي **لا يعرف** رقم الإصدار،
/// وإعلان ذلك أنفع من تاريخٍ مُختلَق يُقرأ كأنه حقيقة.

export interface ReleaseIdentity {
  /// أوّل ١٢ محرفًا من بصمة الـcommit، أو \`unknown\`.
  ///
  /// مقتطعة لا كاملة: الاثنا عشر تكفي للمطابقة في مستودع واحد، والنقطة النهائية
  /// عامّة بلا مصادقة. والبصمة الكاملة محفوظة في وسم الإصدار في git.
  readonly commit: string;
  /// وقت البناء بصيغة ISO‏-8601 بالتوقيت العالمي، أو \`unknown\`.
  readonly builtAt: string;
  /// رقم جولة CI التي أنتجت البناء، أو \`unknown\`.
  readonly run: string;
}

export const RELEASE: ReleaseIdentity = {
  commit: '${commit}',
  builtAt: '${builtAt}',
  run: '${run}',
};
`;
}

/// الهوية من وسائط سطر الأوامر. مفصولة عن الكتابة لتُختبَر بلا لمس ملف.
export function identityFrom(args, now = new Date()) {
  if (args.includes('--reset')) return { ...PLACEHOLDER };
  const valueOf = (flag) => {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    // البصمة تُقتطع **هنا** لا في وقت التشغيل: ما يُخبَز في الحزمة هو ما يُقرأ
    // منها، فلا موضع ثانٍ يقتطع بطولٍ مختلف فتفشل الموازنة بعد النشر.
    commit: (valueOf('--commit') ?? '').slice(0, 12) || PLACEHOLDER.commit,
    builtAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    run: valueOf('--run') || PLACEHOLDER.run,
  };
}

if (process.argv[1]?.endsWith('write-release.mjs')) {
  const args = process.argv.slice(2);
  const next = identityFrom(args);

  if (!args.includes('--reset') && next.commit === PLACEHOLDER.commit) {
    console.error('يحتاج --commit <sha> (أو --reset لقيَم النائب)');
    process.exit(2);
  }

  const rendered = renderRelease(next);
  const before = readFileSync(TARGET, 'utf8');
  writeFileSync(TARGET, rendered, 'utf8');
  console.log(`${before === rendered ? 'بلا تغيير' : 'كُتِب'}: commit=${next.commit} run=${next.run}`);
}
