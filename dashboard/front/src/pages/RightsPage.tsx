import { useEffect, useState } from 'react'

export function RightsPage() {
  const [rights, setRights] = useState<any[]>([])

  useEffect(() => {
    fetch('/api/v1/admin/rights', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json()).then(j => setRights(j.data || [])).catch(() => setRights([]))
  }, [])

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">الحقوق والتراخيص</span><h2>إدارة الحقوق</h2><p>مالك الحق، النوع، الدول، اللغات، الأجهزة، الباقات، Offline، التواريخ - ينبه قبل الانتهاء ويخفي تلقائياً</p></div>
        <button className="button button--primary" onClick={async () => { const content_id = prompt('content_id'); const owner = prompt('مالك الحق'); if (!content_id || !owner) return; await fetch('/api/v1/admin/rights', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ content_id, owner, license_type: 'exclusive', countries: ['EG','SA'], languages: ['ar'], expiry_date: '2027-12-31' }) }); location.reload() }}>إضافة حق</button>
      </section>
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f8fafc', textAlign: 'start' }}><th style={{ padding: 10 }}>المحتوى</th><th>المالك</th><th>النوع</th><th>الانتهاء</th></tr></thead>
          <tbody>
            {rights.length ? rights.map((r: any) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={{ padding: 10 }}>{r.content_id}</td>
                <td>{r.owner}</td>
                <td>{r.license_type}</td>
                <td style={{ color: r.expiry_date && new Date(r.expiry_date) < new Date() ? '#dc2626' : '#16a34a' }}>{r.expiry_date || 'دائم'}</td>
              </tr>
            )) : <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>لا يوجد حقوق - أضف أول حق</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
