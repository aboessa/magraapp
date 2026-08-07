import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'

export function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res: any = await (api as any).teams?.() ?? await fetch('/api/v1/admin/teams', { headers: { Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` } }).then(r => r.json())
      setTeams(res.data || [])
    } catch {
      setTeams([{ id: 'team-qisas', name_ar: 'فريق كوكب القصص', members_count: 3 }, { id: 'team-oloom', name_ar: 'فريق كوكب العلوم', members_count: 2 }])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function create() {
    if (!name.trim()) return
    await fetch('/api/v1/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${window.sessionStorage.getItem('majarra-admin-token') || ''}` }, body: JSON.stringify({ name_ar: name, planet_id: 'qisas' }) })
    setName('')
    void load()
  }

  if (loading) return <LoadingState />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div><span className="eyebrow">الفرق والأعضاء</span><h2>إدارة الفرق</h2><p>كل فريق له نطاق (كوكب/قسم) وصلاحيات افتراضية</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم الفريق" style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0' }} />
          <button className="button button--primary" onClick={() => void create()}><Icon name="plus" size={14}/> إنشاء فريق</button>
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {teams.map(t => (
          <div key={t.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 36, height: 36, borderRadius: 8, background: '#eef2ff', display: 'grid', placeItems: 'center' }}><Icon name="parents" size={18}/></span>
              <div><strong>{t.name_ar}</strong><br/><small style={{ color: '#64748b' }}>{t.members_count ?? 0} أعضاء</small></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
