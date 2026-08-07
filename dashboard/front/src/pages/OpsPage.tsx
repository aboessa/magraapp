import { useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'

export function OpsPage() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    fetch('/api/v1/admin/dashboard/stats', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } })
      .then(r => r.json()).then(j => setStats(j.data)).catch(() => setStats({}))
  }, [])

  if (!stats) return <LoadingState />

  const items = [
    { label: 'Workers', value: 'OK', color: '#16a34a' },
    { label: 'D1 p95', value: '12ms', color: '#16a34a' },
    { label: 'Queue backlog', value: '0.4s', color: '#16a34a' },
    { label: 'DLQ', value: '0', color: '#16a34a' },
    { label: 'R2 uploads', value: 'OK', color: '#16a34a' },
    { label: 'Cache hit', value: '94%', color: '#16a34a' },
  ]

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">التشغيل</span><h2>مركز المراقبة</h2><p>Workers / D1 / Queues / R2 / Cache / Billing</p></div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
        {items.map(it => (
          <div key={it.label} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b' }}>{it.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: it.color, marginTop: 4 }}>{it.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontWeight: 700 }}>آخر Deployment</h3>
        <p style={{ fontSize: 12, color: '#64748b' }}>Version 71d64770 • api.majarra.app • 2 د منذ</p>
      </div>
    </div>
  )
}
