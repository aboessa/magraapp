import { Link } from 'react-router-dom'
import { Icon } from './Icon'

export type Crumb = { label: string; to?: string }

/// شريط تنقل هرمي قابل للنقر بالكامل (UX-17 في DASHBOARD v3). آخر عنصر ثابت (الصفحة الحالية).
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (!items.length) return null
  return (
    <nav className="breadcrumbs" aria-label="breadcrumbs">
      {items.map((item, index) => (
        <span className="breadcrumbs__item" key={`${item.label}-${index}`}>
          {index > 0 && <Icon name="arrow" size={12} />}
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span className="breadcrumbs__current">{item.label}</span>}
        </span>
      ))}
    </nav>
  )
}
