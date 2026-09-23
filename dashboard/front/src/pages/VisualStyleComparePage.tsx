import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { VisualStyleRecord } from '../types/api'
import { familyLabels, familyOf } from '../lib/visualStyleFamilies'
import { StylePreview } from '../components/visualStyles/StylePreview'

export function VisualStyleComparePage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const [params] = useSearchParams()
  const ids = (params.get('ids') ?? '').split(',').filter(Boolean).slice(0, 4)
  const [items, setItems] = useState<VisualStyleRecord[]>([])

  useEffect(() => {
    void api.visualStyles(true).then((res) => setItems(res.data.filter((s) => ids.includes(s.id))))
  }, [params])

  if (!ids.length) {
    return (
      <div className="page-stack">
        <section className="page-intro">
          <div>
            <span className="eyebrow">{ar ? 'مقارنة الاستايلات' : 'Style Comparison'}</span>
            <h2>{ar ? 'لم يتم اختيار استايلات' : 'No styles selected'}</h2>
            <p>{ar ? 'يرجى العودة إلى مكتبة الاستايلات البصرية وتحديد 2 إلى 4 استايلات للمقارنة.' : 'Please return to Visual Styles library and select 2 to 4 styles to compare.'}</p>
          </div>
          <Link className="button button--primary" to={adminPath('visual-styles')}>
            <Icon name="arrow" size={16} />
            {ar ? 'العودة للاستايلات' : 'Back to Styles'}
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{ar ? 'معمل المقارنة الفنية' : 'Art Direction Comparison'}</span>
          <h2>{ar ? `مقارنة الاستايلات البصرية (${items.length})` : `Style Compare (${items.length})`}</h2>
          <p>{ar ? 'فحص ومقارنة التوافق البصري ولوحات الألوان وعقود التوليد بين الاستايلات المختارة.' : 'Direct visual comparison of color palettes, medium compatibility, and prompt contracts.'}</p>
        </div>
        <Link className="button button--ghost" to={adminPath('visual-styles')}>
          <Icon name="arrow" size={16} />
          {ar ? 'العودة للمكتبة' : 'Back to Library'}
        </Link>
      </section>

      {/* COMPARATIVE BENTO GRID */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length || 1}, minmax(0, 1fr))`, gap: 20 }}>
        {items.map((style) => {
          const fam = familyOf(style)
          return (
            <article key={style.id} className="vs-card-item">
              <div className="vs-card-item__preview-wrapper">
                <StylePreview style={style} size="card" />
                <span className={`vs-family-badge vs-family--${fam}`}>
                  {(familyLabels as any)[locale][fam]}
                </span>
              </div>
              <div className="vs-card-item__body">
                <h3 className="vs-card-item__title">{ar ? style.name_ar : style.name_en}</h3>
                <div className="vs-card-item__slug">{style.slug} · {style.medium}</div>
                <div style={{ margin: '8px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--muted)', background: 'var(--surface-2)', padding: 8, borderRadius: 8 }}>
                  <strong>{ar ? 'عقد التوليد:' : 'Prompt:'}</strong> {style.prompt_fragment.slice(0, 100)}...
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="character-trait-pill">{style.production_level}</span>
                  <span className="character-trait-pill">{style.age_tracks.join(' · ')}</span>
                </div>
              </div>
              <footer className="vs-card-item__foot">
                <Link className="button button--primary button--small" to={adminPath(`visual-styles/${style.id}`)} style={{ width: '100%', justifyContent: 'center' }}>
                  {ar ? 'فتح مساحة العمل' : 'Open Workspace'}
                </Link>
              </footer>
            </article>
          )
        })}
      </div>

      {/* DETAILED SPECIFICATION TABLE */}
      <div className="panel panel--table">
        <header className="panel__header">
          <h3>{ar ? 'جدول المقارنة التفصيلي' : 'Specification Matrix'}</h3>
        </header>
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table data-table--wide">
            <thead>
              <tr>
                <th style={{ width: 180 }}>{ar ? 'المعيار' : 'Criterion'}</th>
                {items.map((s) => (
                  <th key={s.id}>{ar ? s.name_ar : s.name_en}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>{ar ? 'العائلة البصرية' : 'Family'}</strong></td>
                {items.map((s) => (
                  <td key={s.id}>{(familyLabels as any)[locale][familyOf(s)]}</td>
                ))}
              </tr>
              <tr>
                <td><strong>{ar ? 'الوسيط الفني' : 'Medium'}</strong></td>
                {items.map((s) => (
                  <td key={s.id}><span className="character-trait-pill">{s.medium}</span></td>
                ))}
              </tr>
              <tr>
                <td><strong>{ar ? 'مستوى الإنتاج' : 'Production'}</strong></td>
                {items.map((s) => (
                  <td key={s.id}>{s.production_level}</td>
                ))}
              </tr>
              <tr>
                <td><strong>{ar ? 'الفئات العمرية' : 'Age Tracks'}</strong></td>
                {items.map((s) => (
                  <td key={s.id}>{s.age_tracks.join(', ')}</td>
                ))}
              </tr>
              <tr>
                <td><strong>{ar ? 'المحددات السلبية' : 'Negative Prompt'}</strong></td>
                {items.map((s) => (
                  <td key={s.id} dir="ltr" style={{ fontSize: 12 }}>{s.negative_prompt || '—'}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
