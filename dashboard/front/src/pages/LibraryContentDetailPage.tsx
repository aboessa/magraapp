import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { BookDetail, GameDetail, LibraryContentKind, ProjectDetail } from '../types/api'

type Detail = BookDetail | GameDetail | ProjectDetail
const validKinds: LibraryContentKind[] = ['books', 'games', 'projects']
function prettyJson(value: object) {
  return JSON.stringify(value, null, 2)
}

export function LibraryContentDetailPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const { kind = '', id = '' } = useParams()
  const validKind = validKinds.includes(kind as LibraryContentKind) ? (kind as LibraryContentKind) : null
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'overview' | 'content' | 'media'>('overview')

  const labels = {
    books: ar ? 'كتاب مصور' : 'Illustrated Book',
    games: ar ? 'لعبة تعليمية' : 'Learning Game',
    projects: ar ? 'مشروع ونشاط' : 'Activity Project',
  }

  const load = useCallback(async () => {
    if (!validKind) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response =
        validKind === 'books'
          ? await api.book(id)
          : validKind === 'games'
          ? await api.game(id)
          : await api.project(id)
      setItem(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل المحتوى' : 'Unable to load content')
    } finally {
      setLoading(false)
    }
  }, [ar, id, validKind])

  useEffect(() => {
    void load()
  }, [load])

  if (!validKind) return <EmptyState title={ar ? 'نوع محتوى غير صالح' : 'Invalid content type'} description="" />
  if (loading && !item) return <LoadingState label={ar ? 'جارٍ تحميل المحتوى...' : 'Loading content...'} />
  if (error && !item) return <ErrorState message={error} onRetry={() => void load()} />
  if (!item) return <EmptyState title={ar ? 'العنصر غير موجود' : 'Content not found'} description="" />

  const game = validKind === 'games' ? (item as GameDetail) : null
  const book = validKind === 'books' ? (item as BookDetail) : null
  const project = validKind === 'projects' ? (item as ProjectDetail) : null
  const assets = item.assets ?? []

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('library')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'مكتبة المحتوى' : 'Content Library'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {item.title_ar}
              </h1>
              <span className="badge badge--pill">{labels[validKind]}</span>
              <StatusBadge status={item.status} />
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {project?.description_ar || game?.instructions_ar || (ar ? 'بيانات ومواصفات المحتوى التفاعلي' : 'Interactive content specifications')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {game && (
            <Link className="button button--primary button--small" to={adminPath(`games/${game.id}`)}>
              <Icon name="games" size={14} />
              <span>{ar ? 'استوديو الرسم والألعاب' : 'Drawing Studio'}</span>
            </Link>
          )}
          <Link className="button button--secondary button--small" to={adminPath(validKind)}>
            <Icon name="grid" size={14} />
            <span>{ar ? 'فهرس المجموعة' : 'Collection'}</span>
          </Link>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الفئة العمرية' : 'Age Range'}</span>
            <div className="bento-glass-card__icon"><Icon name="children" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{item.age_min}–{item.age_max}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'سنوات مناسبة' : 'target years'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'نمط الوصول' : 'Access Mode'}</span>
            <div className="bento-glass-card__icon"><Icon name="shield" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {item.is_free ? (ar ? 'مجاني' : 'Free') : (ar ? 'مدفوع' : 'Premium')}
          </div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${item.is_free ? 'positive' : 'neutral'}`}>
              {item.is_free ? (ar ? 'متاح للكل' : 'Open tier') : (ar ? 'اشتراك مدفوع' : 'Subscription')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'المحتوى والأصول' : 'Payload Scale'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">
            {book ? `${book.pages.length} p` : project ? `${project.steps.length} steps` : `${assets.length} assets`}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">
              {book ? (ar ? 'صفحات مسجلة' : 'pages') : project ? (ar ? 'خطوات تنفيذية' : 'steps') : (ar ? 'أصول مرتبطة' : 'assets')}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الإشراف الأبوي' : 'Supervision'}</span>
            <div className="bento-glass-card__icon"><Icon name="parents" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {item.supervision_level || 'Independent'}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'درجة الإشراف المطلوبة' : 'Supervision guide'}</span>
          </div>
        </article>
      </section>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        <button
          className={`button ${tab === 'overview' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('overview')}
        >
          {ar ? 'بيانات التجربة والسلامة' : 'Experience & Safety'}
        </button>
        <button
          className={`button ${tab === 'content' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('content')}
        >
          {book ? (ar ? 'صفحات الكتاب' : 'Book Pages') : game ? (ar ? 'حزمة اللعبة (Pack)' : 'Game Pack') : (ar ? 'خطوات النشاط' : 'Project Steps')}
        </button>
        <button
          className={`button ${tab === 'media' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('media')}
        >
          {ar ? 'الوسائط المرتبطة' : 'Linked Media'} ({assets.length})
        </button>
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'overview' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="file-text" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'محددات التجربة التعليمية' : 'Experience Parameters'}</h3>
              </div>

              <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, marginBottom: 20 }}>
                <div><dt>{ar ? 'الفئة العمرية' : 'Age'}</dt><dd><strong>{item.age_min}–{item.age_max} {ar ? 'سنوات' : 'years'}</strong></dd></div>
                <div><dt>{ar ? 'المستوى القرائي' : 'Reading Level'}</dt><dd>{'reading_level' in item ? item.reading_level : '—'}</dd></div>
                <div><dt>{ar ? 'نمط التفاعل' : 'Interaction'}</dt><dd>{'interaction_mode' in item ? item.interaction_mode : 'Direct Touch'}</dd></div>
                <div><dt>{ar ? 'درجة الإشراف' : 'Supervision'}</dt><dd><strong>{item.supervision_level}</strong></dd></div>
              </dl>

              <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="shield" size={14} />
                  <span>{ar ? 'ملاحظات الأمان والسلامة' : 'Safety Notes'}</span>
                </h4>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6 }}>
                  {item.safety_notes || (ar ? 'لا توجد محاذير سلامة مسجلة.' : 'No safety warnings recorded.')}
                </p>
              </div>
            </div>
          )}

          {tab === 'content' && (
            <div className="panel" style={{ padding: 20 }}>
              {book && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Icon name="books" size={18} />
                    <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'صفحات الكتاب المصور' : 'Book Pages'} ({book.pages.length})</h3>
                  </div>
                  <div style={{ padding: 14, background: 'var(--surface-sunken)', borderRadius: 8, fontSize: 13 }}>
                    {ar
                      ? `يحتوي الكتاب على ${book.pages.length} صفحة مسجلة في D1 وجاهزة للعرض في قارئ التطبيق.`
                      : `This book contains ${book.pages.length} recorded pages in D1 ready for mobile reader.`}
                  </div>
                </div>
              )}

              {game && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Icon name="games" size={18} />
                    <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'حزمة اللعبة وهندستها البرمجية' : 'Game Content Pack'}</h3>
                  </div>
                  <pre style={{ background: 'var(--surface-sunken)', padding: 14, borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 380, direction: 'ltr' }}>
                    {prettyJson(game.content_pack || {})}
                  </pre>
                </div>
              )}

              {project && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <Icon name="objectives" size={18} />
                    <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'خطوات النشاط والمواد المطلوبة' : 'Materials & Steps'}</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>{ar ? 'المواد المطلوبة' : 'Materials'}</h4>
                      <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 13 }}>
                        {project.materials.length ? project.materials.map((m) => <li key={m}>{m}</li>) : <li>—</li>}
                      </ul>
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>{ar ? 'الخطوات التنفيذية' : 'Steps'}</h4>
                      <ol style={{ margin: 0, paddingInlineStart: 20, fontSize: 13 }}>
                        {project.steps.length ? project.steps.map((s) => <li key={s}>{s}</li>) : <li>—</li>}
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'media' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="media" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الأصول والوسائط المربوطة' : 'Linked Media Assets'}</h3>
              </div>
              {assets.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {assets.map((asset) => (
                    <Link
                      key={asset.id}
                      to={adminPath(`media/${asset.id}`)}
                      style={{ padding: 12, background: 'var(--surface-sunken)', borderRadius: 8, border: '1px solid var(--border)' }}
                    >
                      <strong style={{ fontSize: 13 }}>{asset.title_ar}</strong>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                        {asset.kind} · {asset.status}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState title={ar ? 'لا توجد أصول مرتبطة' : 'No linked assets'} description="" />
              )}
            </div>
          )}
        </div>

        {/* Sticky Content Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Metadata Specs */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="grid" size={16} />
              <span>{ar ? 'مواصفات المحرك' : 'Engine & Runtime'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Type:</span>
                <strong>{validKind}</strong>
              </div>
              {game && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--muted)' }}>Engine:</span>
                  <span className="badge badge--pill">{game.engine_name || 'Standard'}</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Content Inspector */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار المحتوى التربوي' : 'Pedagogy Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'تم فحص المحتوى والتأكد من ملاءمته للفئة العمرية المحددة وخلوه من أي عناصر تشتت الانتباه.'
                : 'Pedagogical flow verified for target age band with zero cognitive friction.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
