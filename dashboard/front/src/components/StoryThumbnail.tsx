import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'

/**
 * غلاف قصة مع احتياط حقيقي.
 *
 * ## لماذا مكوّن مستقلّ عن `EntityThumbnail`
 *
 * `EntityThumbnail` مربّع بحجم ثابت لصفوف الجداول. غلاف القصة له نسبة كتاب
 * (3:4) ويظهر في ثلاثة سياقات مختلفة: خلية جدول صغيرة، وسط بطاقة يملأ العرض،
 * ومصغّرة في مسّاح الصفحات. فصله يجعل النسبة والاحتياط قرارًا واحدًا في ملفّ
 * واحد بدل أن يتكرّر في ثلاث شاشات.
 *
 * ## سلسلة الاحتياط
 *
 * غلاف حقيقي ← أول حرف من العنوان على لون الكوكب ← أيقونة كتاب.
 *
 * الحرف يسبق الأيقونة بقصد: أيقونة كتاب بنفسجية موحّدة لكل قصة هي بالضبط ما
 * كانت عليه الشاشة القديمة، فصار عشرون صفًّا متطابقًا بصريًّا. الحرف على لون
 * كوكب القصة يُعطي تمييزًا حقيقيًّا بلا اختراع صورة.
 *
 * الصورة المكسورة تسقط إلى الاحتياط نفسه عبر `onError`: صورة مكسورة تُخفي النقص،
 * أمّا الاحتياط فيُظهره.
 */
export function StoryThumbnail({
  src,
  alt,
  title,
  color,
  size = 44,
  fill = false,
}: {
  src?: string | null
  alt: string
  /// العنوان، لاستخراج الحرف الاحتياطي منه
  title?: string
  /// لون الكوكب، خلفيةً للاحتياط
  color?: string | null
  /// الضلع بالبكسل. يُهمَل عند `fill`.
  size?: number
  /// يملأ الحاوية بنسبة الكتاب بدل الحجم الثابت — لوسط البطاقة.
  fill?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  const style: CSSProperties = fill
    ? { background: showImage ? undefined : color || undefined }
    : { width: size, height: Math.round(size * 1.28), background: showImage ? undefined : color || undefined }

  return (
    <span
      className={`story-thumb ${fill ? 'story-thumb--fill' : ''} ${showImage ? '' : 'story-thumb--fallback'}`}
      style={style}
    >
      {showImage ? (
        <img src={src ?? undefined} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : title ? (
        <span className="story-thumb__letter" aria-hidden="true">{title.trim().charAt(0)}</span>
      ) : (
        <Icon name="books" size={fill ? 30 : Math.round(size * 0.46)} />
      )}
    </span>
  )
}
