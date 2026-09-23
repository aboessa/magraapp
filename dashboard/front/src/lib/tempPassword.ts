/**
 * كلمة مرور مؤقتة لحساب إداريّ، من مولّدٍ تشفيريّ (`SEC-205`).
 *
 * ## العلّة
 *
 * كان التوليد `Math.random().toString(36).slice(2, 12) + 'Aa1!'` في موضعين في
 * `TeamAccessPage.tsx` — إنشاء حساب إداريّ، وإعادة تعيين كلمة مروره.
 *
 * و`Math.random()` ليس مولّدًا تشفيريًّا: في V8 هو xorshift128+ بحالةٍ داخلية
 * 128 بت، ومخرجاته قابلة للتنبّؤ رجعيًّا وتقدُّميًّا ممّن رأى مخرجاتٍ قليلة. وهو
 * مقبولٌ لمفتاح React ولاختيار عنصرٍ عشوائيّ، وغير مقبولٍ لبيانات اعتماد تفتح
 * لوحة الإدارة.
 *
 * و`.toString(36).slice(2, 12)` أضعف مما يبدو أيضًا: `Math.random()` تُعيد
 * `double` في [0,1)، فسلسلة الأساس-36 قد تقصر عن عشرة محارف فتُنتج كلمةً أقصر
 * من المتوقَّع بلا أن يلاحظ أحد.
 *
 * ## ما يفعله البديل
 *
 * `crypto.getRandomValues` — مولّدٌ تشفيريّ متاح في كل متصفّح يدعمه المشروع،
 * وبلا تبعية.
 *
 * و**الرفض بلا سقوطٍ خفيّ**: إن لم يوجد `crypto.getRandomValues` يُرمى خطأ.
 * الهبوط إلى `Math.random()` هنا كان سيُعيد العطل نفسه في صمت، وأسوأ منه: في
 * بيئةٍ لا أحد يفحصها.
 */

/// أبجديّة بلا محارف مُلتبسة: لا `0/O`، ولا `1/l/I`. كلمة المرور تُقرأ من شاشة
/// وتُكتب بيدٍ عند أوّل دخول، فمحرفٌ مُلتبس يُنتج «كلمة المرور خاطئة» لا خطرًا
/// أمنيًّا — لكنه يُنتج أيضًا عادةَ إعادة التعيين مرّةً بعد مرّة.
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SYMBOLS = '!@#$%^&*-_=+'
const ALPHABET = LOWER + UPPER + DIGITS + SYMBOLS

/// 24 محرفًا من أبجديّةٍ بـ77 محرفًا ≈ 150 بت عشوائيّة — أوسع بكثير من أي حدٍّ
/// عمليّ، والطول لا يُكلّف شيئًا لأنها تُلصَق لا تُحفَظ.
const LENGTH = 24

function randomBytes(count: number): Uint8Array {
  const source = globalThis.crypto
  if (!source?.getRandomValues) {
    throw new Error(
      'crypto.getRandomValues is unavailable — refusing to generate a credential '
      + 'from a non-cryptographic source',
    )
  }
  return source.getRandomValues(new Uint8Array(count))
}

/// يختار محرفًا واحدًا من [pool] بلا انحياز modulo.
///
/// `byte % pool.length` يُفضّل أوّل محارف الأبجديّة حين لا يقسم الطول 256. وهو
/// انحيازٌ صغير، لكن رفض البايتات الزائدة أرخص من تفسير حجمه.
function pick(pool: string): string {
  const limit = Math.floor(256 / pool.length) * pool.length
  for (;;) {
    const [byte] = randomBytes(1)
    if (byte < limit) return pool[byte % pool.length]
  }
}

/// كلمة مرور مؤقتة تستوفي أربع فئات محارف.
///
/// الفئات تُحقن أوّلًا ثم يُخلَط الناتج، فلا يكون موضع المحرف الكبير أو الرمز
/// معروفًا مسبقًا — وهو ما يحدث لو أُلحقت لاصقةٌ ثابتة مثل `'Aa1!'` في الآخر.
export function generateTemporaryPassword(): string {
  const required = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  const rest = Array.from({ length: LENGTH - required.length }, () => pick(ALPHABET))
  const characters = [...required, ...rest]

  // خلطُ فيشر-ييتس بمصدرٍ تشفيريّ. الخلط بـ`sort(() => Math.random() - 0.5)`
  // ليس خلطًا موحَّدًا، ويُعيد `Math.random()` إلى مسار الاعتماد من الباب الخلفي.
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const limit = Math.floor(256 / (index + 1)) * (index + 1)
    let byte = randomBytes(1)[0]
    while (byte >= limit) byte = randomBytes(1)[0]
    const target = byte % (index + 1)
    ;[characters[index], characters[target]] = [characters[target], characters[index]]
  }

  return characters.join('')
}
