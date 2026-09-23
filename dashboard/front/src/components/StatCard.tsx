import { Icon } from './Icon'
import type { IconName } from './Icon'

export function StatCard({ label, value, description, icon, tone = 'blue' }: { label: string; value: string; description: string; icon: IconName; tone?: 'blue' | 'cyan' | 'yellow' | 'purple' }) {
  return (
    <article className={`stat-card kpi-glass-card stat-card--${tone} kpi-glass-card--${tone}`}>
      <div className="kpi-card__top">
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span className="kpi-icon-bubble stat-card__icon"><Icon name={icon} size={18} /></span>
      </div>
      <div>
        <strong className="stat-card__value kpi-card__value">{value}</strong>
        <p className="kpi-card__sub" style={{ margin: 0, marginTop: 4 }}>{description}</p>
      </div>
    </article>
  )
}

