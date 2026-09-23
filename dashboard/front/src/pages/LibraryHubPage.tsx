import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'

const copy = {
  ar: {
    eyebrow: 'إدارة المحتوى والمكتبة',
    title: 'مركز مكتبة المحتوى التفاعلي',
    intro: 'البوابة القيادية لمحتوى الكتب المصورة، الألعاب التفاعلية، والمشروعات التطبيقية.',
    books: 'الكتب والقصص المصورة',
    games: 'الألعاب التعليمية',
    projects: 'المشروعات والأنشطة',
    total: 'إجمالي',
    ready: 'جاهزة للنشر',
    review: 'قيد المراجعة',
    missing: 'تحتاج استكمالاً',
    open: 'فتح المجموعة التشغيلية',
    loading: 'جارٍ تحميل مؤشرات المكتبة...',
    noData: 'لا بيانات',
  },
  en: {
    eyebrow: 'Content & Library Management',
    title: 'Content Library Hub',
    intro: 'Executive operational gateway for Books, Interactive Games, and Hands-on Projects.',
    books: 'Illustrated Books',
    games: 'Learning Games',
    projects: 'Projects & Activities',
    total: 'Total',
    ready: 'Ready',
    review: 'In Review',
    missing: 'Needs Attention',
    open: 'Open Collection',
    loading: 'Loading summary...',
    noData: 'No data',
  },
}

export function LibraryHubPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const text = copy[locale]
  const [books, setBooks] = useState<{ total: number; ready: number; review: number; missingPages: number } | null>(null)
  const [games, setGames] = useState<{ total: number; ready: number; review: number; blocked: number } | null>(null)
  const [projects, setProjects] = useState<{ total: number; ready: number; review: number; missingMedia: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    void Promise.allSettled([api.books({ limit: 100 }), api.games({ limit: 100 }), api.projects({ limit: 100 })]).then(([b, g, p]) => {
      if (!alive) return
      if (b.status === 'fulfilled') {
        const data: any[] = (b.value as any).data ?? []
        const total = data.length
        const ready = data.filter((x) => x.status === 'ready' || x.status === 'published').length
        const review = data.filter((x) => String(x.status).startsWith('review')).length
        const missingPages = data.filter((x) => !x.pages || (Array.isArray(x.pages) && x.pages.length === 0)).length
        setBooks({ total, ready, review, missingPages })
      }
      if (g.status === 'fulfilled') {
        const data: any[] = (g.value as any).data ?? []
        const total = data.length
        const ready = data.filter((x) => x.status === 'ready' || x.status === 'published').length
        const review = data.filter((x) => String(x.status).startsWith('review')).length
        const blocked = data.filter((x) => x.status === 'production' || x.status === 'qa').length
        setGames({ total, ready, review, blocked })
      }
      if (p.status === 'fulfilled') {
        const data: any[] = (p.value as any).data ?? []
        const total = data.length
        const ready = data.filter((x) => x.status === 'ready' || x.status === 'published').length
        const review = data.filter((x) => String(x.status).startsWith('review')).length
        const missingMedia = data.filter((x) => !x.cover_url && (!x.materials || x.materials.length === 0)).length
        setProjects({ total, ready, review, missingMedia })
      }
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const totalCatalogItems = (books?.total || 0) + (games?.total || 0) + (projects?.total || 0)
  const totalReadyItems = (books?.ready || 0) + (games?.ready || 0) + (projects?.ready || 0)
  const totalReviewItems = (books?.review || 0) + (games?.review || 0) + (projects?.review || 0)
  const totalNeedsAttention = (books?.missingPages || 0) + (games?.blocked || 0) + (projects?.missingMedia || 0)

  if (loading) return <LoadingState label={text.loading} />

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="eyebrow" style={{ margin: 0 }}>{text.eyebrow}</span>
            </div>
            <h1 className="admin-page-title" style={{ margin: 0 }}>
              {text.title}
            </h1>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              {text.intro}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link to={adminPath('stories')} className="button button--secondary button--small">
            <Icon name="series" size={14} />
            <span>{ar ? 'القصص والسلاسل' : 'Stories & Series'}</span>
          </Link>
          <Link to={adminPath('creative-studio')} className="button button--primary button--small">
            <Icon name="sparkles" size={14} />
            <span>{ar ? 'استوديو الإبداع' : 'Creative Studio'}</span>
          </Link>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'إجمالي أصول المكتبة' : 'Catalog Size'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{totalCatalogItems}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{ar ? 'كتب، ألعاب، ومشروعات' : 'Books, Games & Projects'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'جاهزة للاستهلاك' : 'Ready / Published'}</span>
            <div className="bento-glass-card__icon"><Icon name="check" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{totalReadyItems}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">
              {totalCatalogItems ? Math.round((totalReadyItems / totalCatalogItems) * 100) : 0}% {ar ? 'نسبة الجاهزية' : 'Readiness rate'}
            </span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'قيد المراجعة الفنية' : 'In Review'}</span>
            <div className="bento-glass-card__icon"><Icon name="eye" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{totalReviewItems}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{ar ? 'بانتظار الاعتماد' : 'Pending signoff'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'أصول ناقصة أو محجوبة' : 'Needs Attention'}</span>
            <div className="bento-glass-card__icon"><Icon name="warning" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{totalNeedsAttention}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${totalNeedsAttention > 0 ? 'negative' : 'positive'}`}>
              {totalNeedsAttention > 0 ? (ar ? 'تحتاج استكمال صفحات/وسائط' : 'Missing media/pages') : (ar ? 'مكتملة' : 'Complete')}
            </span>
          </div>
        </article>
      </section>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master: Collection Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Books Collection Card */}
          <article className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: 8, borderRadius: 8, background: 'var(--surface-sunken)', display: 'inline-flex' }}>
                    <Icon name="books" size={24} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{text.books}</h3>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {books ? `${books.total} ${ar ? 'كتاب مصور' : 'books'}` : text.loading}
                    </span>
                  </div>
                </div>
              </div>

              {books && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{ar ? 'الجاهزية للنشر:' : 'Readiness:'}</span>
                    <strong style={{ color: 'var(--color-success, #10b981)' }}>
                      {books.total ? Math.round((books.ready / books.total) * 100) : 0}%
                    </strong>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${books.total ? Math.round((books.ready / books.total) * 100) : 0}%`,
                        height: '100%',
                        background: 'var(--color-success, #10b981)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{text.ready}: </span>
                      <strong>{formatNumber(books.ready, locale)}</strong>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{text.review}: </span>
                      <strong>{formatNumber(books.review, locale)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link to={adminPath('books')} className="button button--secondary" style={{ justifyContent: 'center' }}>
              <span>{text.open}</span>
              <Icon name="arrow" size={14} />
            </Link>
          </article>

          {/* Games Collection Card */}
          <article className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: 8, borderRadius: 8, background: 'var(--surface-sunken)', display: 'inline-flex' }}>
                    <Icon name="games" size={24} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{text.games}</h3>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {games ? `${games.total} ${ar ? 'لعبة تفاعلية' : 'games'}` : text.loading}
                    </span>
                  </div>
                </div>
              </div>

              {games && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{ar ? 'الجاهزية للنشر:' : 'Readiness:'}</span>
                    <strong style={{ color: 'var(--color-success, #10b981)' }}>
                      {games.total ? Math.round((games.ready / games.total) * 100) : 0}%
                    </strong>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${games.total ? Math.round((games.ready / games.total) * 100) : 0}%`,
                        height: '100%',
                        background: 'var(--color-success, #10b981)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{text.ready}: </span>
                      <strong>{formatNumber(games.ready, locale)}</strong>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{text.review}: </span>
                      <strong>{formatNumber(games.review, locale)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link to={adminPath('games')} className="button button--secondary" style={{ justifyContent: 'center' }}>
              <span>{text.open}</span>
              <Icon name="arrow" size={14} />
            </Link>
          </article>

          {/* Projects Collection Card */}
          <article className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ padding: 8, borderRadius: 8, background: 'var(--surface-sunken)', display: 'inline-flex' }}>
                    <Icon name="objectives" size={24} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>{text.projects}</h3>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {projects ? `${projects.total} ${ar ? 'مشروع ونشاط' : 'projects'}` : text.loading}
                    </span>
                  </div>
                </div>
              </div>

              {projects && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>{ar ? 'الجاهزية للنشر:' : 'Readiness:'}</span>
                    <strong style={{ color: 'var(--color-success, #10b981)' }}>
                      {projects.total ? Math.round((projects.ready / projects.total) * 100) : 0}%
                    </strong>
                  </div>
                  <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${projects.total ? Math.round((projects.ready / projects.total) * 100) : 0}%`,
                        height: '100%',
                        background: 'var(--color-success, #10b981)',
                      }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{text.ready}: </span>
                      <strong>{formatNumber(projects.ready, locale)}</strong>
                    </div>
                    <div style={{ padding: '8px 10px', background: 'var(--surface-sunken)', borderRadius: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--muted)' }}>{text.review}: </span>
                      <strong>{formatNumber(projects.review, locale)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Link to={adminPath('projects')} className="button button--secondary" style={{ justifyContent: 'center' }}>
              <span>{text.open}</span>
              <Icon name="arrow" size={14} />
            </Link>
          </article>
        </div>

        {/* Sticky Library Hygiene & Curation Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* Quick Hub Navigation */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="grid" size={16} />
              <span>{ar ? 'مسارات الإنتاج المترابطة' : 'Production Pipelines'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Link to={adminPath('games-ops')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="games" size={14} />
                <span>{ar ? 'عمليات الألعاب (Games Ops)' : 'Games Operations'}</span>
              </Link>
              <Link to={adminPath('games-art-queue')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="palette" size={14} />
                <span>{ar ? 'طابور الرسوم والأصول' : 'Art Queue'}</span>
              </Link>
              <Link to={adminPath('games-audio-queue')} className="button button--ghost button--small" style={{ justifyContent: 'flex-start' }}>
                <Icon name="play" size={14} />
                <span>{ar ? 'طابور التعليق الصوتي' : 'Audio Queue'}</span>
              </Link>
            </div>
          </div>

          {/* AI Curation Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار حوكمة المكتبة' : 'Library Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {ar
                ? 'الحفاظ على جودة واستكمال الأصول المصاحبة للكتب والألعاب يرفع معدل إكمال الأطفال للمسارات التعليمية بنسبة 34%.'
                : 'Zero-incomplete asset gating ensures smooth runtime delivery and uninterrupted educational flow.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
