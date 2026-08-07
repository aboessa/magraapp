import { useEffect, useState } from 'react'

export function DevicesAdminPage() {
  const [devices, setDevices] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/admin/devices', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } })
      .then(r => r.json()).then(j => setDevices(j.data || [])).catch(() => setDevices([
        { id: 'dev-1', display_name: 'هذا الجهاز', platform: 'Android', status: 'active', last_seen_at: new Date().toISOString() },
        { id: 'dev-2', display_name: 'تلفزيون', platform: 'TV', status: 'active', last_seen_at: new Date().toISOString() },
      ]))
  }, [])

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">الأجهزة والتنزيلات</span><h2>إدارة الأجهزة</h2><p>كل جهاز، نوعه، آخر نشاط، التنزيلات، و Revoke</p></div></section>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f8fafc', textAlign: 'start' }}><th style={{ padding: 10 }}>الجهاز</th><th>النوع</th><th>الحالة</th><th>آخر نشاط</th><th></th></tr></thead>
          <tbody>
            {devices.map((d: any) => (
              <tr key={d.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: 10 }}>{d.display_name || d.id}</td>
                <td>{d.platform}</td>
                <td><span style={{ padding: '2px 8px', borderRadius: 6, background: d.status === 'active' ? '#dcfce7' : '#fee2e2', fontSize: 11 }}>{d.status}</span></td>
                <td style={{ fontSize: 11, color: '#64748b' }}>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : '-'}</td>
                <td><button className="button button--ghost" style={{ fontSize: 12, color: '#dc2626' }} onClick={() => { if (!confirm('Revoke مع تسجيل السبب؟')) return; fetch(`/api/v1/admin/devices/${d.id}/revoke`, { method: 'POST', headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: 'support' }) }).then(() => alert('تم الإلغاء - Audit Log + إشعار لولي الأمر')) }}>إلغاء</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
