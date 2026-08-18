// @ts-nocheck
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    eyebrow: 'الإدارة',
    title: 'حوكمة الوصول',
    lede: 'ملخص واقعي: كل مقياس قابل للنقر إلى قائمته.',
    activeEmployees: 'موظفون نشطون',
    disabled: 'معطّلون',
    teams: 'الفرق',
    roles: 'الأدوار',
    activeGrants: 'منح نشطة',
    temporary: 'منح مؤقتة',
    expiring: 'تنتهي قريبًا (7 أيام)',
    withoutMfa: 'بدون MFA',
    highRisk: 'منح عالية المخاطر',
    recentChanges: 'تغييرات صلاحيات أخيرة',
    riskTitle: 'نتائج المخاطر',
    riskEmpty: 'لا مخاطر عالية حاليًا',
  },
  en: {
    eyebrow: 'Administration',
    title: 'Access governance',
    lede: 'Real summary — every metric is clickable to its filtered list.',
    activeEmployees: 'Active employees',
    disabled: 'Disabled',
    teams: 'Teams',
    roles: 'Roles',
    activeGrants: 'Active grants',
    temporary: 'Temporary grants',
    expiring: 'Expiring in 7 days',
    withoutMfa: 'Without MFA',
    highRisk: 'High-risk grants',
    recentChanges: 'Recent permission changes',
    riskTitle: 'Risk findings',
    riskEmpty: 'No high-risk findings',
  },
}

export function AccessGovernancePage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [uRes, tRes, rRes, gRes] = await Promise.all([api.adminUsers(), api.teams(), api.roles(), api.grants()])
      const users = uRes.data as any[]
      const grants = gRes.data as any[]
      const active = users.filter((u) => u.is_active)
      const disabled = users.filter((u) => !u.is_active)
      const activeGrants = grants.filter((g) => !g.valid_until || new Date(g.valid_until) > new Date())
      const temporary = grants.filter((g) => !!g.valid_until)
      const expiring = grants.filter((g) => g.valid_until && new Date(g.valid_until).getTime() - Date.now() < 7 * 24 * 3600 * 1000 && new Date(g.valid_until) > new Date())
      const highRisk = grants.filter((g) => ['publish', 'billing', 'manage_permissions'].some((k) => g.role_id.includes(k)))
      setData({
        activeEmployees: active.length,
        disabled: disabled.length,
        teams: (tRes.data as any[]).length,
        roles: (rRes.data as any[]).length,
        activeGrants: activeGrants.length,
        temporary: temporary.length,
        expiring: expiring.length,
        withoutMfa: 0,
        highRisk: highRisk.length,
        recentChanges: [],
        risks: [
          disabled.filter((u) => activeGrants.some((g) => g.grantee_id === u.id)).length
            ? `${disabled.filter((u) => activeGrants.some((g) => g.grantee_id === u.id)).length} disabled users with active grants`
            : null,
          highRisk.some((g) => g.scope_type === 'platform') ? 'Publisher role granted platform-wide' : null,
        ].filter(Boolean),
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const metrics = [
    { label: text.activeEmployees, value: data.activeEmployees, to: adminPath('team-access') },
    { label: text.disabled, value: data.disabled, to: adminPath('team-access?status=disabled') },
    { label: text.teams, value: data.teams, to: adminPath('teams') },
    { label: text.roles, value: data.roles, to: adminPath('roles') },
    { label: text.activeGrants, value: data.activeGrants, to: adminPath('grants') },
    { label: text.temporary, value: data.temporary, to: adminPath('grants?valid=temporary') },
    { label: text.expiring, value: data.expiring, to: adminPath('grants?expires=7d') },
    { label: text.highRisk, value: data.highRisk, to: adminPath('grants?risk=high') },
  ]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p className="table-secondary">{text.lede}</p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        {metrics.map((m) => (
          <Link key={m.label} to={m.to} className="panel" style={{ padding: 16, textDecoration: 'none', display: 'block' }}>
            <div className="table-secondary" style={{ fontSize: 12 }}>
              {m.label}
            </div>
            <strong style={{ fontSize: 22 }}>{m.value}</strong>
          </Link>
        ))}
      </section>

      <section className="panel" style={{ padding: 16 }}>
        <h3>{text.riskTitle}</h3>
        {data.risks.length ? (
          <ul style={{ paddingInlineStart: 16 }}>
            {data.risks.map((r: string, i: number) => (
              <li key={i} style={{ color: '#b91c1c' }}>
                {r}
              </li>
            ))}
          </ul>
        ) : (
          <p className="table-secondary">{text.riskEmpty}</p>
        )}
        <p className="table-secondary" style={{ fontSize: 12, marginTop: 8 }}>Every finding from real data — no generic risk scores.</p>
      </section>
    </div>
  )
}
