import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, LoadingState } from '../components/PageState'
import { adminPath } from '../lib/adminPath'
import { usePreferences } from '../context/preferences'

interface RefRow {
  id: string
  title_ar: string
  category: string
  age_min: number
  age_max: number
  difficulty: string
  status: string
  thumbnail_asset_id: string
}

export default function CreativeStudioOverviewPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const [refs, setRefs] = useState<RefRow[]>([])
  const [filterCat, setFilterCat] = useState('الكل')
  const [filterAge, setFilterAge] = useState('الكل')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/reference-activities')
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setRefs(j.data)
      })
      .catch(() => setRefs([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = {
    total: refs.length,
    draft: refs.filter((r) => r.status === 'draft').length,
    ready: refs.filter((r) => r.status === 'ready').length,
    published: refs.filter((r) => r.status === 'published').length,
    animals: refs.filter((r) => r.category === 'حيوانات').length,
  }

  const filtered = refs.filter(
    (r) =>
      (filterCat === 'الكل' || r.category === filterCat) &&
      (filterAge === 'الكل' || `${r.age_min}-${r.age_max}` === filterAge) &&
      (!search || r.title_ar?.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <LoadingState />

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('creative-studio')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'استوديو الإبداع' : 'Creative Studio'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {ar ? 'الأنشطة المرجعية وارسم مثلي' : 'Reference Drawing & Draw-Like-Me Hub'}
              </h1>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {ar ? 'فهرس النماذج المرجعية لخطوات الرسم والتلوين التفاعلي' : 'Catalog of step-by-step reference models and interactive drawing activities'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link className="button button--primary button--small" to={adminPath('creative-studio/authoring')}>
            <Icon name="plus" size={14} />
            <span>{ar ? 'تأليف نشاط جديد' : 'New Activity'}</span>
          </Link>
          <button className="button button--secondary button--small" onClick={load}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'إجمالي الأنشطة' : 'Total Activities'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{metrics.total}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{metrics.published} {ar ? 'منشورة' : 'published'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'جاهزة للاستوديو' : 'Ready for App'}</span>
            <div className="bento-glass-card__icon"><Icon name="check" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{metrics.ready}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'معتمدة بالكامل' : 'Signed off'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'قيد الإعداد' : 'Draft Activities'}</span>
            <div className="bento-glass-card__icon"><Icon name="file-text" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{metrics.draft}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'تحتاج استكمال خطوات' : 'Needs steps'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'فئة الحيوانات' : 'Fauna Focus'}</span>
            <div className="bento-glass-card__icon"><Icon name="star" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{metrics.animals}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'الفئة الأكثر طلباً' : 'Top category'}</span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel" style={{ padding: 20 }}>
            {/* Filter Bar */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['الكل', 'حيوانات', 'فضاء', 'طبيعة', 'مركبات', 'بيت', 'زخارف'].map((c) => (
                  <button
                    key={c}
                    className={`button ${filterCat === c ? 'button--primary' : 'button--ghost'} button--small`}
                    onClick={() => setFilterCat(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder={ar ? 'بحث بالعنوان...' : 'Search title...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-sunken)', fontSize: 13 }}
                />
                <select
                  value={filterAge}
                  onChange={(e) => setFilterAge(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface-sunken)', fontSize: 13 }}
                >
                  <option value="الكل">{ar ? 'كل الأعمار' : 'All Ages'}</option>
                  <option value="4-5">4-5</option>
                  <option value="6-7">6-7</option>
                  <option value="8-9">8-9</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {filtered.length ? (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{ar ? 'النموذج' : 'Preview'}</th>
                      <th>{ar ? 'العنوان' : 'Title'}</th>
                      <th>{ar ? 'الفئة' : 'Category'}</th>
                      <th>{ar ? 'العمر' : 'Age'}</th>
                      <th>{ar ? 'الصعوبة' : 'Difficulty'}</th>
                      <th>{ar ? 'الحالة' : 'Status'}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.id}>
                        <td>
                          {r.thumbnail_asset_id ? (
                            <img
                              src={`/api/media/${r.thumbnail_asset_id}`}
                              alt=""
                              style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 6, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Icon name="palette" size={20} />
                            </div>
                          )}
                        </td>
                        <td>
                          <strong>{r.title_ar}</strong>
                        </td>
                        <td><span className="track-badge">{r.category}</span></td>
                        <td>{r.age_min}–{r.age_max}</td>
                        <td><span className="badge badge--pill">{r.difficulty}</span></td>
                        <td>
                          <span className={`status-badge status-badge--${r.status === 'published' ? 'published' : r.status === 'ready' ? 'review' : 'draft'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>
                          <Link className="button button--ghost button--small" to={adminPath(`creative-studio/reference/${r.id}`)}>
                            {ar ? 'فتح' : 'Open'}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={ar ? 'لا توجد أنشطة مطابقة' : 'No activities matched'} description="" />
            )}
          </div>
        </div>

        {/* Sticky Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="sparkles" size={16} />
              <span>{ar ? 'محركات الاستوديو' : 'Creative Engines'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to={adminPath('creative-studio/coloring')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="palette" size={14} />
                <span>{ar ? 'تلوين (Coloring)' : 'Coloring'}</span>
              </Link>
              <Link to={adminPath('creative-studio/connect-dots')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="grid" size={14} />
                <span>{ar ? 'وصل النقاط (Connect Dots)' : 'Connect Dots'}</span>
              </Link>
              <Link to={adminPath('creative-studio/complete')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="star" size={14} />
                <span>{ar ? 'أكمل الرسمة (Complete Drawing)' : 'Complete'}</span>
              </Link>
              <Link to={adminPath('creative-studio/trace')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="pen" size={14} />
                <span>{ar ? 'تتبع الخطوط (Trace)' : 'Trace'}</span>
              </Link>
            </div>
          </div>

          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الرسم التعليمي' : 'Drawing Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'تقسيم الرسم إلى 4-6 خطوات تدريجية يعزز المهارات الحركية الدقيقة لدى الأطفال دون إحباط.'
                : 'Scaffolding complex line art into 4-6 sequential strokes maximizes fine-motor skill mastery.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
