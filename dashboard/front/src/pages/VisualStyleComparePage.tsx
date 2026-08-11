import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { VisualStyleRecord } from '../types/api'
import { familyLabels, familyOf } from '../lib/visualStyleFamilies'
import { StylePreview } from '../components/visualStyles/StylePreview'

export function VisualStyleComparePage() {
  const { locale } = usePreferences()
  const [params] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0,4)
  const [items, setItems] = useState<VisualStyleRecord[]>([])

  useEffect(() => {
    void api.visualStyles(true).then((res) => setItems(res.data.filter((s) => ids.includes(s.id)) ))
  }, [params])

  if (!ids.length) return <div className="page-stack"><p>Select 2–4 styles from collection to compare.</p><Link className="button button--ghost" to={adminPath('visual-styles')}>Back</Link></div>

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">مقارنة الاستايلات</span><h2>Style Compare ({items.length})</h2></div><Link className="button button--ghost" to={adminPath('visual-styles')}>Back</Link></section>
      <div className="panel panel--table"><div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr><th>Visual</th>{items.map((s)=><th key={s.id}>{locale==='ar'?s.name_ar:s.name_en}</th>)}</tr></thead>
      <tbody>
        <tr><td>Preview</td>{items.map((s)=><td key={s.id}><StylePreview style={s} /></td>)}</tr>
        <tr><td>Family</td>{items.map((s)=><td key={s.id}>{(familyLabels as any)[locale][familyOf(s)]}</td>)}</tr>
        <tr><td>Medium</td>{items.map((s)=><td key={s.id}>{s.medium}</td>)}</tr>
        <tr><td>Age</td>{items.map((s)=><td key={s.id}>{s.age_tracks.join(', ')}</td>)}</tr>
      </tbody></table></div></div>
    </div>
  )
}
