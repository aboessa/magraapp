import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import type { IconName } from './Icon'

/**
 * صورة كيان مع تدرّج احتياطي حقيقي (UX-6 / UX-20 في DASHBOARD v3).
 *
 * ## القاعدة
 *
 * لا يظهر دائرة حرف/أيقونة ثابتة إن وُجدت صورة فعلية (`src`). الاحتياط:
 * صورة حقيقية ← أيقونة ذات مغزى بلون الكيان ← حرف أول.
 *
 * لا تُخترع صورة: إن لم يصل `src` (لأن الخادم لم يُرسل رابطًا، أو فشل تحميل
 * الصورة) يُعرض الاحتياط بلا محاولة توليد بيانات لا وجود لها، تماشيًا مع
 * قاعدة UX-44 (لا بيانات وهمية لتحسين المظهر).
 */
export function EntityThumbnail({
  src,
  alt,
  label,
  color,
  icon,
  shape = 'rounded',
  size = 38,
}: {
  src?: string | null
  alt: string
  /// الحرف الاحتياطي إن لم توجد صورة ولا أيقونة
  label?: string
  /// خلفية الاحتياط، عادة لون الكوكب/السلسلة
  color?: string | null
  /// أيقونة احتياطية ذات مغزى (أفضل من حرف عندما لا يوجد اسم مناسب)
  icon?: IconName
  shape?: 'rounded' | 'circle' | 'square'
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed
  const style: CSSProperties = {
    width: size,
    height: size,
    background: showImage ? undefined : color || undefined,
    borderRadius: shape === 'circle' ? '50%' : shape === 'square' ? 8 : 10,
  }

  return (
    <span className={`entity-thumb entity-thumb--${shape}`} style={style}>
      {showImage ? (
        <img src={src ?? undefined} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : icon ? (
        <Icon name={icon} size={Math.round(size * 0.5)} />
      ) : (
        <span className="entity-thumb__letter">{(label || alt || '؟').charAt(0)}</span>
      )}
    </span>
  )
}
