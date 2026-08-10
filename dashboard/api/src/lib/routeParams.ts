import type { Context } from 'hono'

/**
 * قراءة مقطع مسار كنصّ مؤكَّد.
 *
 * ## العلّة التي يعالجها
 *
 * `c.req.param('id')` نوعه `string | undefined` في Hono، لأن اسم المقطع نصّ حرّ
 * لا يعرف المُترجم أنه معلَن في المسار. النتيجة ٥٦ خطأ `TS2345` في ستة ملفات:
 * كلها «`string | undefined` لا يصلح مكان `string`» عند تمرير المعرّف إلى
 * `audit()` أو إلى دالة تطالب بنصّ.
 *
 * كان أمام هذه الأخطاء ثلاثة طرق:
 *
 * ١. **تأكيد بـ`!` أو `as string`.** يُسكت المُترجم ويكذب: لو صار المقطع غائبًا
 *    فعلًا لمرّ `undefined` إلى استعلام SQL بلا أي إشارة.
 * ٢. **توسيع كل دالة لتقبل `string | undefined`.** يُنقل الخطأ إلى الداخل حيث
 *    يصير `entity_id` في سجل التدقيق قابلًا للغياب — وهو أسوأ مكان لهذا الاحتمال.
 * ٣. **فحص حقيقي في مكان واحد.** وهو هذا.
 *
 * ## لماذا الرمي صحيح هنا ولا يمكن حدوثه
 *
 * مسار مُسجَّل بـ`/:id` لا يُطابِق طلبًا بلا ذلك المقطع، فالغياب مستحيل عمليًّا.
 * لكن الرمي ليس تجميلًا: لو تغيّر المسار يومًا وبقي القارئ كما هو، فالنتيجة خطأ
 * ٥٠٠ مع رسالة تسمّي المقطع الناقص في السجل — لا استعلام صامت على `undefined`
 * يُعيد صفًّا خاطئًا أو لا يُعيد شيئًا. الفشل المُعلَن أرخص من الفشل الصامت.
 *
 * `onError` في `index.ts` يحوّل الرمي إلى ٥٠٠ ويسجّله، وهو التصنيف الصحيح: خطأ
 * برمجة في التوجيه لا خطأ في الطلب.
 */
export function pathParam(c: Context<any, any, any>, name: string): string {
  const value = c.req.param(name)
  if (typeof value !== 'string' || value === '') {
    throw new Error(`route parameter "${name}" is missing; the route is registered without it`)
  }
  return value
}

/**
 * مقطع مسار اختياري: يُعيد `null` لا `undefined` عند الغياب.
 *
 * لمواضع الغياب فيها معنى حقيقي (مقطع اختياري في المسار). `null` صريح أفضل من
 * `undefined` لأن `queryFirst` يستقبل `unknown[]`، و`undefined` في مصفوفة رَبْط
 * D1 يُمرَّر كـNULL ضمنًا بينما `null` يقولها.
 */
export function optionalPathParam(c: Context<any, any, any>, name: string): string | null {
  const value = c.req.param(name)
  return typeof value === 'string' && value !== '' ? value : null
}
