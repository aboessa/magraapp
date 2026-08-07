import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LoadingState } from '../components/PageState'

export function BillingPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard().catch(() => null)
    fetch('/api/v1/admin/billing/stats', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } })
      .then(r => r.json())
      .then(j => setStats(j.data))
      .catch(() => setStats({ by_plan: [] }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>الاشتراكات والفوترة</h1>
      <p style={{ color: '#64748b', fontSize: 12 }}>Google Play هو مصدر الحقيقة - FamilyState يحتفظ بالاستحقاق السريع</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
        {(stats?.by_plan || []).map((row: any) => (
          <div key={row.plan} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{row.plan}</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{row.count}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontWeight: 700 }}>آخر عمليات الشراء (billing_audit)</h3>
        <pre style={{ fontSize: 11, overflow: 'auto', maxHeight: 200 }}>{JSON.stringify(stats?.recent_purchases?.slice(0, 5) || [], null, 2)}</pre>
      </div>
    </div>
  )
}
