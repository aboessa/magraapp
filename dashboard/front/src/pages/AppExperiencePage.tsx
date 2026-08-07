import { useEffect, useState } from 'react'
import { LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'

type Block = { id: string; block_type: string; title_ar: string | null; sort_order: number; is_active: number; is_draft?: number; scheduled_at?: string | null; expires_at?: string | null; version?: number; targeting_json: string; config_json: string }

export function AppExperiencePage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/v1/admin/home-experience', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json()).catch(() => ({ data: [] }))
    setBlocks(res.data || [])
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  async function toggle(id: string, active: number) {
    await fetch(`/api/v1/admin/home-experience/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ is_active: active ? 0 : 1 }) })
    void load()
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = blocks.findIndex(b => b.id === id)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= blocks.length) return
    const order = [...blocks]
    const [moved] = order.splice(idx, 1)
    order.splice(newIdx, 0, moved)
    setBlocks(order)
    await fetch('/api/v1/admin/home-experience/reorder', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ order: order.map(b => b.id) }) })
  }

  if (loading) return <LoadingState />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">تجربة التطبيق</span><h2>بناء الصفحة الرئيسية</h2><p>تحكم في الـ Hero والصفوف والكواكب مع استهداف حسب الدولة/اللغة/العمر/الباقة/الجهاز</p></div>
        <button className="button button--primary" onClick={async () => { const title = window.prompt('اسم القسم'); if (!title) return; await fetch('/api/v1/admin/home-experience', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ block_type: 'content_rail', title_ar: title }) }); void load() }}><Icon name="plus" size={14}/> قسم جديد</button>
      </section>

      <div style={{ display: 'grid', gap: 10 }}>
        {blocks.map(b => {
          const targeting = JSON.parse(b.targeting_json || '{}')
          const isDraft = !!(b as any).is_draft
          const scheduled = (b as any).scheduled_at
          const expires = (b as any).expires_at
          return (
            <div key={b.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, opacity: b.is_active && !isDraft ? 1 : 0.6 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button className="icon-button" onClick={() => void move(b.id, -1)}>↑</button>
                <button className="icon-button" onClick={() => void move(b.id, 1)}>↓</button>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: b.is_active ? '#eef2ff' : '#f1f5f9', display: 'grid', placeItems: 'center' }}><Icon name={b.block_type === 'hero_slider' ? 'play' : 'dashboard'} size={16}/></div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: 13 }}>{b.title_ar || b.block_type} {isDraft && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>مسودة</span>}</strong><br/>
                <small style={{ color: '#64748b' }}>{b.block_type} • ترتيب {b.sort_order} • {targeting.plan ? `باقة ${targeting.plan}` : ''} {targeting.is_new_user ? '• مستخدم جديد' : ''} {scheduled ? `• من ${new Date(scheduled).toLocaleDateString()}` : ''} {expires ? `• حتى ${new Date(expires).toLocaleDateString()}` : ''}</small>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}><input type="checkbox" checked={!!b.is_active} onChange={() => void toggle(b.id, b.is_active)} /> مفعل</label>
                {isDraft && <button className="button button--ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={async () => { await fetch(`/api/v1/admin/home-experience/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ is_draft: 0 }) }); void load() }}>نشر</button>}
                <button className="button button--ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={async () => { if (!confirm('Rollback للإصدار السابق؟')) return; await fetch(`/api/v1/admin/home-experience/${b.id}/rollback`, { method: 'POST', headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }); void load() }}>Rollback</button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 16, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
        <h3 style={{ fontWeight: 700, fontSize: 13 }}>معاينة</h3>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="button button--ghost" onClick={async () => { const r = await fetch('/api/v1/admin/home-experience/preview?track=kids&country=EG&platform=mobile', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(x => x.json()); alert(JSON.stringify(r.data.blocks.slice(0, 3).map((b: any) => b.block_type), null, 2)) }}>موبايل</button>
          <button className="button button--ghost" onClick={async () => { const r = await fetch('/api/v1/admin/home-experience/preview?track=kids&country=EG&platform=tv', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(x => x.json()); alert(JSON.stringify(r.data.blocks.slice(0, 3).map((b: any) => b.block_type), null, 2)) }}>TV</button>
        </div>
      </div>
    </div>
  )
}
