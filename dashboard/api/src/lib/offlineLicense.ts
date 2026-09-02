/// ENC-001 — توقيع تراخيص الاستخدام دون إنترنت.
///
/// ## لماذا Ed25519 لا HMAC
///
/// كل توكن في هذا الـWorker موقَّع بـHMAC (`lib/security.ts`)، وهو الصحيح
/// لتوكن يتحقّق منه الخادم نفسه. لكن الترخيص دون إنترنت **يتحقّق منه العميل**
/// وهو غير متصل — فلو كان HMAC لاحتاج التطبيق السرّ نفسه، أي أن كل جهاز يحمل
/// مفتاح إصدار التراخيص ويستطيع أن يكتب لنفسه ترخيصًا أبديًّا. التوقيع
/// اللامتناظر يفصل الإصدار عن التحقّق: الخادم يوقّع بالمفتاح الخاص، والتطبيق
/// يتحقّق بالمفتاح العام المُبندل معه.
///
/// هذا أول استخدام لتوقيع لامتناظر مملوك لنا في هذا الـWorker (ما عدا مفاتيح
/// Google المستهلَكة في `services/`).
///
/// ## دوران المفاتيح
///
/// كل ترخيص يحمل `signature_key_id`، والتطبيق يبندل المفاتيح العامة بمعرّفاتها.
/// فتدوير المفتاح لا يُبطل التراخيص القائمة: تُوقَّع الجديدة بمعرّف جديد،
/// وتبقى القديمة قابلة للتحقّق بمفتاحها حتى تنتهي مدتها. بلا `signature_key_id`
/// كان أي تدوير يُعطّل كل ترخيص على كل جهاز في اللحظة نفسها.
///
/// ## الشكل
///
/// `base64url(payload).base64url(signature)` — نفس شكل `createSignedToken` في
/// `lib/security.ts` حتى لا يتعلّم العميل صيغتين. الحمولة JSON صريحة لأن
/// التطبيق يقرأ حقولها ليقرّر (الانتهاء، الجهاز، الإصدار) لا ليعرضها فقط.

import type { Env } from './db.ts';

/// ما يحمله الترخيص. كل حقل هنا يُتحقَّق منه في العميل، ولا حقل للعرض وحده.
export type OfflineLicenseClaims = {
  typ: 'offline_license';
  /// معرّف الترخيص في سلطة الأسرة، وهو ما يُبطَل به.
  lic: string;
  /// الأسرة والطفل والجهاز: نسخ ملف إلى جهاز آخر أو ملف طفل آخر لا يُفَك.
  sub: string;
  cid: string;
  did: string;
  /// عهد المصادقة عند الإصدار. إبطال أي جهاز يرفعه في الأسرة، فيصير كل ترخيص
  /// أقدم مرفوضًا عند أول اتصال بلا حاجة إلى قائمة إبطال.
  epoch: number;
  entity_type: string;
  entity_id: string;
  /// إصدار المحتوى: نشر إصدار جديد لا يجعل الترخيص القديم يفتح الملف الجديد.
  ver: number;
  rights: 'offline_playback';
  plan: 'free' | 'family' | 'family_plus';
  /// الأصول المرخَّصة ببصماتها وأحجامها (`ENC-007`). `null` لأصل لم تُحسب
  /// بصمته عند الاستيراد — والعميل يعرف الفرق بين «لا بصمة» و«بصمة لا تطابق».
  assets: Array<{ id: string; sha256: string | null; bytes: number | null }>;
  iat: number;
  exp: number;
  /// معرّف مفتاح التوقيع، ليعمل التدوير بلا إبطال ما هو قائم.
  kid: string;
};

export type SignedOfflineLicense = {
  token: string;
  claims: OfflineLicenseClaims;
};

/// معرّف المفتاح الحالي. يُغيَّر مع كل تدوير، ويبقى القديم في التطبيق للتحقّق.
const CURRENT_KEY_ID = 'majarra-offline-v1';

function base64UrlEncode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/// هل الإصدار مُهيَّأ؟ غياب المفتاح يعني **رفض** الإصدار لا إصدارًا بلا توقيع.
///
/// ترخيص بلا توقيع أسوأ من غياب الميزة: العميل يقبله فيصير كل جهاز قادرًا على
/// كتابة ترخيص لنفسه.
export function offlineLicensingIsConfigured(env: Env) {
  const value = env.OFFLINE_LICENSE_SIGNING_KEY;
  return typeof value === 'string' && value.trim().length >= 32;
}

let cachedKey: CryptoKey | null = null;
let cachedKeySource: string | null = null;

async function signingKey(env: Env) {
  const raw = env.OFFLINE_LICENSE_SIGNING_KEY;
  if (typeof raw !== 'string' || raw.trim().length < 32) {
    throw new Error('Offline licensing is not configured');
  }
  // الاستيراد مكلف نسبيًّا ويتكرّر لكل إصدار في نفس الـisolate، فيُحفَظ. المصدر
  // يُقارَن حتى لا يبقى مفتاح قديم مستعملًا بعد تدوير السرّ.
  if (cachedKey && cachedKeySource === raw) return cachedKey;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    decodeBase64(raw.trim()),
    { name: 'Ed25519' },
    false,
    ['sign'],
  );
  cachedKey = key;
  cachedKeySource = raw;
  return key;
}

/// يوقّع ترخيصًا. الحمولة كاملة قبل التوقيع: لا حقل يُضاف بعده.
export async function signOfflineLicense(
  env: Env,
  claims: Omit<OfflineLicenseClaims, 'typ' | 'kid'>,
): Promise<SignedOfflineLicense> {
  const complete: OfflineLicenseClaims = { typ: 'offline_license', ...claims, kid: CURRENT_KEY_ID };
  const payload = new TextEncoder().encode(JSON.stringify(complete));
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    await signingKey(env),
    payload,
  );
  return {
    token: `${base64UrlEncode(payload)}.${base64UrlEncode(new Uint8Array(signature))}`,
    claims: complete,
  };
}

export const OFFLINE_LICENSE_KEY_ID = CURRENT_KEY_ID;
