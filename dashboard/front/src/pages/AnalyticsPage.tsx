import { useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'

export function AnalyticsPage() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/v1/admin/analytics/overview', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } })
      .then(r => r.json())
      .then(j => setData(j.data))
      .catch(() => setData({}))
  }, [])

  if (!data) return <LoadingState />
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>الإحصائيات السلوكية</h1>
      <p style={{ color: '#64748b', fontSize: 12 }}>مجهولة الهوية - child_id فقط، لا PII</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#64748b' }}>إجمالي التشغيلات</div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{data.total_plays ?? 0}</div>
        </div>
        {(data.by_track || []).map((r: any) => (
          <div key={r.track_id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: '#64748b' }}>{r.track_id}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{r.count}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
        <h3 style={{ fontWeight: 700 }}>أحداث حديثة</h3>
        <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto' }}>{JSON.stringify(data.recent_events?.slice(0, 8) || [], null, 2)}</pre>
      </div>
    </div>
  )
}
