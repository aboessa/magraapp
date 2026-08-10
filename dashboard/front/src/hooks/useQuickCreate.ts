import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * يفتح نموذج الإنشاء الخاص بالصفحة عند وصولها بـ`?new=1`.
 *
 * ## لماذا علم في العنوان لا نموذج في لوحة الأوامر
 *
 * نموذج إنشاء السلسلة يعرف الكواكب والمسارات العمرية وتحقّقات الخادم الخاصة به،
 * ونموذج المقال يعرف قاعدة الـslug اللاتيني. نسخ أيّهما في لوحة الأوامر يُنتج
 * نموذجًا ثانيًا ينحرف عن الأول عند أول تغيير في القواعد. فالأمر يفتح الصفحة
 * المالكة، وهذه الخطّافة تجعلها تفتح نموذجها هي.
 *
 * ## يُنفَّذ مرة واحدة ثم يُنظَّف العنوان
 *
 * العلم يُحذف من العنوان بعد التنفيذ بـ`replace`، فثلاثة أمور:
 *
 * ١. إغلاق النموذج لا يُعيد فتحه عند أي إعادة رسم.
 * ٢. الرجوع بزرّ المتصفح لا يُعيد فتحه أيضًا.
 * ٣. الرابط الذي يُنسخ من شريط العنوان بعدها رابط قائمة لا رابط «افتح نموذجًا».
 */
export function useQuickCreate(onTrigger: () => void) {
  const [searchParams, setSearchParams] = useSearchParams()
  // مرجع لا حالة: تغيير الحالة يُعيد الرسم، وإعادة الرسم قبل حذف العلم كانت
  // ستنادي النموذج مرتين.
  const fired = useRef(false)
  // المُنادى في مرجع أيضًا: الصفحات تُعرّف `openCreate` كدالة جديدة في كل رسم،
  // فلو كانت في تبعيات الأثر لعمل الأثر عند كل رسم بلا داعٍ.
  const callback = useRef(onTrigger)
  callback.current = onTrigger

  useEffect(() => {
    if (fired.current) return
    if (searchParams.get('new') !== '1') return
    fired.current = true
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
    callback.current()
  }, [searchParams, setSearchParams])
}
