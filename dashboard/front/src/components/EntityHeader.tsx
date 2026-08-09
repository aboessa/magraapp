import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EntityThumbnail } from './EntityThumbnail'
import { Icon } from './Icon'
import type { Crumb } from './Breadcrumbs'
import { Breadcrumbs } from './Breadcrumbs'

/**
 * ترويسة موحّدة لصفحات تفاصيل الكيان (UX-46 «معيار صفحة التفاصيل» في
 * DASHBOARD v3): صورة + عنوان + سياق + حالة + إجراء أساسي، مع Breadcrumbs
 * وروابط تنقّل سابق/تالي اختيارية.
 */
export function EntityHeader({
  breadcrumbs,
  thumbnail,
  title,
  subtitle,
  meta,
  status,
  actions,
  prev,
  next,
}: {
  breadcrumbs?: Crumb[]
  thumbnail?: ReactNode
  title: string
  subtitle?: string
  /// عناصر سياق صغيرة تُعرض تحت العنوان (كوكب، مسار عمري، نوع...)
  meta?: ReactNode
  status?: ReactNode
  actions?: ReactNode
  prev?: { to: string; label: string } | null
  next?: { to: string; label: string } | null
}) {
  return (
    <section className="entity-header">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="entity-header__row">
        <div className="entity-header__identity">
          {thumbnail}
          <div>
            <div className="entity-header__title-row">
              <h2>{title}</h2>
              {status}
            </div>
            {subtitle && <p>{subtitle}</p>}
            {meta && <div className="entity-header__meta">{meta}</div>}
          </div>
        </div>
        <div className="entity-header__actions">
          {(prev || next) && (
            <div className="entity-header__nav">
              {prev ? (
                <Link className="icon-button" to={prev.to} title={prev.label}><Icon name="arrow" size={16} /></Link>
              ) : <span className="icon-button icon-button--disabled"><Icon name="arrow" size={16} /></span>}
              {next ? (
                <Link className="icon-button" to={next.to} title={next.label}><Icon name="arrow" size={16} /></Link>
              ) : <span className="icon-button icon-button--disabled"><Icon name="arrow" size={16} /></span>}
            </div>
          )}
          {actions}
        </div>
      </div>
    </section>
  )
}

export { EntityThumbnail }
