#!/usr/bin/env node
/**
 * يطبع المفتاح العام المقابل لمفتاح توقيع تراخيص الاستخدام دون إنترنت.
 *
 * ## لماذا سكربت لا قيمة مكتوبة في مستند
 *
 * المفتاح العام يُبندَل في التطبيق للتحقّق من التراخيص وهو غير متصل
 * (`ENC-005`). ونسخه إلى مستند يعني نسخة تتقادم مع أول تدوير، ثم بناء تطبيق
 * يحمل مفتاحًا لا يطابق ما يوقّع به الخادم — وأثره أن **كل** ترخيص يُرفض على
 * كل جهاز. الاشتقاق من المصدر لا يتقادم.
 *
 * المفتاح الخاص لا يُطبَع ولا يُكتب في أي مخرج.
 *
 * ## الاستخدام
 *
 *   # من `.dev.vars` المحلي (بيئة التطوير)
 *   node tools/ops/offline-license-public-key.mjs
 *
 *   # من قيمة تُمرَّر صراحةً (مثلًا مفتاح الإنتاج عند إعداده)
 *   node tools/ops/offline-license-public-key.mjs --key "<base64-pkcs8>"
 *
 * لا يقرأ هذا السكربت سرّ الإنتاج من Cloudflare: أسرار الـWorker لا تُقرأ بعد
 * كتابتها بالتصميم. عند التدوير احتفظ بالمفتاح العام من هذا الأمر **قبل**
 * نشر السرّ.
 */

import { createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

const VAR_NAME = 'OFFLINE_LICENSE_SIGNING_KEY';

function fromArguments() {
  const index = process.argv.indexOf('--key');
  return index > -1 ? process.argv[index + 1]?.trim() : undefined;
}

function fromDevVars() {
  try {
    const content = readFileSync(new URL('../../.dev.vars', import.meta.url), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const [name, ...rest] = line.split('=');
      if (name?.trim() === VAR_NAME) return rest.join('=').trim();
    }
  } catch {
    // غياب الملف حالة عادية على جهاز لم يُهيَّأ للتطوير.
  }
  return undefined;
}

const raw = fromArguments() ?? process.env[VAR_NAME] ?? fromDevVars();
if (!raw) {
  console.error(`لا قيمة لـ${VAR_NAME}. مرّرها بـ--key أو ضعها في dashboard/api/.dev.vars`);
  console.error('التوليد: node -e "..." أو راجع SETUP_SECRETS.md §4.5');
  process.exit(1);
}

let publicKey;
try {
  publicKey = createPublicKey({
    key: Buffer.from(raw, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
} catch (error) {
  // رسالة صريحة: الخطأ الغالب هو لصق PEM بأسطره بدل base64 خامّ لـDER.
  console.error('تعذّر قراءة المفتاح الخاص. المتوقَّع: PKCS8/DER بترميز base64 في سطر واحد.');
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}

if (publicKey.asymmetricKeyType !== 'ed25519') {
  console.error(`نوع المفتاح ${publicKey.asymmetricKeyType} لا Ed25519. الترخيص يُوقَّع بـEd25519 وحده.`);
  process.exit(1);
}

console.log(publicKey.export({ type: 'spki', format: 'der' }).toString('base64'));
