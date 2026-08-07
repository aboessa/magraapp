import { Icon } from './Icon'
import type { IconName } from './Icon'

export function StatCard({ label, value, description, icon, tone = 'blue' }: { label: string; value: string; description: string; icon: IconName; tone?: 'blue' | 'cyan' | 'yellow' | 'purple' }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <div className="stat-card__top"><span>{label}</span><span className="stat-card__icon"><Icon name={icon} size={21} /></span></div>
      <strong className="stat-card__value">{value}</strong>
      <p>{description}</p>
    </article>
  )
}
