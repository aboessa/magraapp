import { useState } from 'react'
import { LoadingState } from '../components/PageState'

export function SupportCenterPage() {
  const [query, setQuery] = useState('')
  const [family, setFamily] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function search() {
    if (!query.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/support/family/${encodeURIComponent(query.trim())}`, { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json())
      setFamily(res.data)
    } catch {
      setFamily({ family: { parent_id: query, status: 'active' }, children: [], devices: [], entitlements: [] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">خدمة العملاء</span><h2>مركز الدعم</h2><p>بحث بالبريد أو Family ID - لا يرى بيانات الدفع الكاملة ولا يعدل المحتوى</p></div>
      </section>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="البريد أو Family ID" style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
        <button className="button button--primary" onClick={() => void search()}>بحث</button>
      </div>
      {loading ? <LoadingState /> : family ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <h3 style={{ fontWeight: 700 }}>الحساب: {family.family?.parent_id}</h3>
            <p style={{ fontSize: 12, color: '#64748b' }}>الباقة: {family.family?.plan || 'free'} • الأطفال: {(family.children || []).length} • الأجهزة: {(family.devices || []).length}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="button button--ghost" onClick={() => alert('إعادة مزامنة Entitlement')}>إعادة مزامنة</button>
              <button className="button button--ghost" onClick={() => alert('استعادة شراء')}>استعادة شراء</button>
              <button className="button button--ghost" onClick={() => alert('إعادة ضبط PIN')}>إعادة ضبط PIN</button>
              <button className="button button--ghost" onClick={() => alert('إنشاء تذكرة')}>تذكرة</button>
            </div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <h4 style={{ fontWeight: 700, fontSize: 13 }}>الأجهزة</h4>
            <ul style={{ fontSize: 12, paddingInlineStart: 16 }}>{(family.devices || []).map((d: any) => <li key={d.id}>{d.display_name || d.id} - {d.platform} - {d.status}</li>)}</ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}
