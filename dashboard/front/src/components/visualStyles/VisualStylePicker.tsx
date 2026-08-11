import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { VisualStyleRecord } from '../../types/api'
import { familyLabels, familyOf } from '../../lib/visualStyleFamilies'
import { usePreferences } from '../../context/preferences'
import { StylePreview } from './StylePreview'

export function VisualStylePicker({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { locale } = usePreferences()
  const [items, setItems] = useState<VisualStyleRecord[]>([])
  const [family, setFamily] = useState('')
  useEffect(() => { void api.visualStyles(true).then((r) => setItems(r.data.filter((s) => s.is_active))) }, [])
  const filtered = items.filter((s) => !family || familyOf(s) === family)
  return (
    <div className="vs-picker">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <select value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value="">كل العائلات</option>
          {Array.from(new Set(items.map((s) => familyOf(s)))).map((f) => <option key={f} value={f}>{(familyLabels as any)[locale][f]}</option>)}
        </select>
        <button type="button" className="button button--ghost" onClick={() => onChange(null)}>بلا استايل</button>
      </div>
      <div className="vs-grid" style={{ padding: 0 }}>
        {filtered.slice(0, 12).map((s) => (
          <button key={s.id} type="button" onClick={() => onChange(s.id)} className={`vs-card ${value === s.id ? 'vs-card--selected' : ''}`} style={{ textAlign: 'start' }}>
            <StylePreview style={s} />
            <div className="vs-card__body"><strong>{locale === 'ar' ? s.name_ar : s.name_en}</strong><small>{s.slug} · {familyOf(s)}</small></div>
          </button>
        ))}
      </div>
    </div>
  )
}
