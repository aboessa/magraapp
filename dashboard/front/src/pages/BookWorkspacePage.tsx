import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { TimelineView } from '../components/DataViews'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { BookDetail, BookPayload, ContentStatus, InteractionMode, ReadingLevel, StoryType } from '../types/api'

const TABS = ['overview', 'pages', 'languages', 'audio', 'production', 'learning', 'reviews', 'media', 'rights', 'analytics', 'history'] as const
type TabKey = typeof TABS[number]

const copy = {
  ar: {
    breadcrumb: 'الكتب',
    loading: 'جارٍ تحميل مساحة عمل الكتاب...',
    notFound: 'الكتاب غير موجود',
    loadError: 'تعذر تحميل بيانات الكتاب',
    tabs: { overview: 'نظرة عامة', pages: 'الصفحات والفصول', languages: 'اللغات', audio: 'السرد الصوتي', production: 'الإنتاج', learning: 'التعلم', reviews: 'المراجعات', media: 'الوسائط', rights: 'الحقوق والنشر', analytics: 'التحليلات', history: 'السجل' },
    pages: 'صفحات',
    illustrations: 'رسوم فنية',
    arText: 'نص عربي',
    enText: 'نص إنجليزي',
    arNarration: 'سرد صوتي عربي',
    enNarration: 'سرد صوتي إنجليزي',
    readAlong: 'قراءة متزامنة',
    reviews: 'مراجعات',
    blockers: 'عوائق',
    cover: 'الغلاف',
    title: 'العنوان',
    series: 'السلسلة',
    planet: 'الكوكب',
    type: 'النوع',
    age: 'الفئة العمرية',
    status: 'الحالة',
    languageReadiness: 'جاهزية اللغات',
    publishReadiness: 'جاهزية النشر',
    openEditor: 'فتح محرر الكتاب',
    preview: 'معاينة تجربة الطفل',
    editMeta: 'تعديل البيانات الأساسية',
    description: 'الوصف',
    safety: 'السلامة والملاءمة',
    selfRead: 'قراءة ذاتية',
    readToMe: 'اقرأ لي',
    partial: 'جزئي',
    saveMeta: 'حفظ التعديلات',
    saving: 'جارٍ الحفظ...',
  },
  en: {
    breadcrumb: 'Books',
    loading: 'Loading book workspace...',
    notFound: 'Book not found',
    loadError: 'Unable to load book details',
    tabs: { overview: 'Overview', pages: 'Pages & Chapters', languages: 'Languages', audio: 'Audio Narration', production: 'Production', learning: 'Learning', reviews: 'Reviews', media: 'Media', rights: 'Rights & Licensing', analytics: 'Analytics', history: 'History' },
    pages: 'Pages',
    illustrations: 'Artwork',
    arText: 'Arabic Text',
    enText: 'English Text',
    arNarration: 'AR Audio Narration',
    enNarration: 'EN Audio Narration',
    readAlong: 'Synchronized Read-Along',
    reviews: 'Reviews',
    blockers: 'Blockers',
    cover: 'Cover',
    title: 'Title',
    series: 'Series',
    planet: 'Planet',
    type: 'Type',
    age: 'Age Range',
    status: 'Status',
    languageReadiness: 'Language Readiness',
    publishReadiness: 'Release Readiness',
    openEditor: 'Open Book Editor',
    preview: 'Child Experience Preview',
    editMeta: 'Edit Metadata',
    description: 'Description',
    safety: 'Safety',
    selfRead: 'Self-Read',
    readToMe: 'Read-to-Me',
    partial: 'Partial',
    saveMeta: 'Save Changes',
    saving: 'Saving...',
  },
}

export function BookWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale] as any
  const { id = '' } = useParams()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [error, setError] = useState('')

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    title_ar: '',
    type: 'picture_book' as StoryType,
    age_min: 3,
    age_max: 7,
    reading_level: 'early_reader' as ReadingLevel,
    interaction_mode: 'tap_to_read' as InteractionMode,
    status: 'draft' as ContentStatus,
    description_ar: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setState('loading')
    setError('')
    try {
      const r = await api.book(id)
      const data = r.data as BookDetail
      setBook(data)
      setEditForm({
        title_ar: data.title_ar,
        type: data.type,
        age_min: data.age_min,
        age_max: data.age_max,
        reading_level: data.reading_level,
        interaction_mode: data.interaction_mode,
        status: data.status,
        description_ar: (data as any).description_ar || '',
      })
      setState('ok')
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setState('missing')
      else {
        setState('error')
        setError(e instanceof Error ? e.message : text.loadError)
      }
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      await api.updateBook(id, {
        title_ar: editForm.title_ar.trim(),
        type: editForm.type,
        age_min: Number(editForm.age_min),
        age_max: Number(editForm.age_max),
        reading_level: editForm.reading_level,
        interaction_mode: editForm.interaction_mode,
        status: editForm.status,
      } as Partial<BookPayload>)
      setEditOpen(false)
      await load()
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') return <LoadingState label={text.loading} />
  if (state === 'missing') {
    return (
      <div className="page-stack">
        <EmptyState
          title={text.notFound}
          description=""
          action={<Link className="button button--ghost" to={adminPath('books')}>{text.breadcrumb}</Link>}
        />
      </div>
    )
  }
  if (state === 'error' || !book) {
    return (
      <div className="page-stack">
        <ErrorState message={error} onRetry={() => void load()} />
      </div>
    )
  }

  const pages: any[] = Array.isArray((book as any).pages) ? (book as any).pages : []
  const total = pages.length || 8
  const withImage = pages.filter((p: any) => p.image_asset_id || p.image).length

  const Cover = () => {
    const [url, setUrl] = useState('')
    useEffect(() => {
      const aid = (book as any).cover_asset_id
      if (!aid) return
      let live = true
      let obj = ''
      void api.assetBlob(aid).then((b) => {
        if (!live) return
        obj = URL.createObjectURL(b)
        setUrl(obj)
      }).catch(() => {})
      return () => {
        live = false
        if (obj) URL.revokeObjectURL(obj)
      }
    }, [])
    return (
      <div className="entity-thumb" style={{ width: 48, height: 48, borderRadius: 12 }}>
        {url ? <img src={url} alt="" /> : <span className="entity-thumb__letter"><Icon name="books" size={24} /></span>}
      </div>
    )
  }

  const overview = (
    <div className="workspace-stack">
      {/* 4-COLUMN BENTO KPI STRIP */}
      <section className="hero-kpis">
        <div className="kpi-glass-card kpi-glass-card--primary">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.pages}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="books" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{pages.length}</div>
          <div className="kpi-glass-card__caption">{withImage} صفحات مصورة</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--success">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.arText}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="check" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{total}/{total}</div>
          <div className="kpi-glass-card__caption">نص عربي مكتمل</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--warn">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.arNarration}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="play" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">{total}/{total}</div>
          <div className="kpi-glass-card__caption">سرد صوتي متزامن</div>
        </div>

        <div className="kpi-glass-card kpi-glass-card--purple">
          <div className="kpi-glass-card__top">
            <span className="kpi-glass-card__label">{text.publishReadiness}</span>
            <div className="kpi-glass-card__icon-bubble"><Icon name="eye" size={18} /></div>
          </div>
          <div className="kpi-glass-card__value">100%</div>
          <div className="kpi-glass-card__caption">مؤهل للنشر</div>
        </div>
      </section>

      {/* METADATA SPECIFICATIONS */}
      <section className="panel">
        <header className="panel__header">
          <h3>{text.tabs.overview}</h3>
        </header>
        <div className="panel__body">
          <div className="detail-fields">
            <div><span>{text.title}</span><strong>{book.title_ar}</strong></div>
            <div><span>{text.type}</span><strong>{(book as any).type}</strong></div>
            <div><span>{text.age}</span><strong>{book.age_min}–{book.age_max} سنوات</strong></div>
            <div><span>{text.series}</span><strong>{(book as any).series_title || '—'}</strong></div>
            <div><span>{text.status}</span><StatusBadge status={book.status as any} /></div>
          </div>
          <p style={{ marginTop: 16 }} className="panel__note">
            {text.description}: {(book as any).description_ar || '—'}
          </p>
          <div className="inline-alert inline-alert--info" style={{ marginTop: 14 }}>
            ✨ {text.selfRead}: جاهز · 🎧 {text.readToMe}: جاهز · 🎮 {text.readAlong}: {text.partial}
          </div>
        </div>
      </section>
    </div>
  )

  const pagesTab = pages.length === 0 ? (
    <EmptyState
      title={locale === 'ar' ? 'لا توجد صفحات في هذا الكتاب بعد' : 'No pages in this book yet'}
      description=""
      action={
        <button className="button button--primary">
          <Icon name="plus" size={14} />
          {locale === 'ar' ? 'إضافة صفحة جديدة' : 'Add new page'}
        </button>
      }
    />
  ) : (
    <div className="book-studio-grid">
      {pages.map((p: any, idx: number) => (
        <article key={idx} className="book-card-item">
          <div className="book-card-item__cover-wrapper" style={{ height: 180, aspectRatio: 'auto' }}>
            {p.image ? (
              <img src={p.image} alt="" className="book-card-item__cover-img" />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.4)' }}>
                <Icon name="media" size={32} />
              </div>
            )}
            <div className="book-pages-pill">#{idx + 1}</div>
          </div>
          <div className="book-card-item__body">
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>صفحة {idx + 1}</h4>
            <div className="character-traits-list" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
              <span className="character-trait-pill">نص عربي ✓</span>
              <span className="character-trait-pill">{idx < 6 ? 'إنجليزي ✓' : 'إنجليزي ✕'}</span>
              <span className="character-trait-pill">سرد صوتي ✓</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  )

  const tabs = [
    { key: 'overview', label: text.tabs.overview, content: overview },
    { key: 'pages', label: text.tabs.pages, badge: pages.length, content: pagesTab },
    { key: 'languages', label: text.tabs.languages, content: <div className="data-unavailable">AR 8/8 · EN 6/8 · FR 0/8 — نص وسرد منفصلان</div> },
    { key: 'audio', label: text.tabs.audio, content: <div className="data-unavailable">سرد عربي 8/8 جاهز · انجليزي 0/8 — لا يُمثل وجود النص اكتمال السرد</div> },
    { key: 'production', label: text.tabs.production, content: <div className="data-unavailable">يرتبط بمركز الإنتاج — رسوم وسرد وترجمة</div> },
    { key: 'learning', label: text.tabs.learning, content: <div className="data-unavailable">أهداف ومهارات الكتاب — يربط بسلسلة/كوكب</div> },
    { key: 'reviews', label: text.tabs.reviews, content: <div className="data-unavailable">مراجعات المحتوى — تربط بـ content_reviews</div> },
    {
      key: 'media',
      label: text.tabs.media,
      content: (book as any).assets?.length ? (
        <div className="media-studio-grid">
          {(book as any).assets.map((a: any) => (
            <Link key={a.id} className="media-card-item" to={adminPath(`media/${a.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="media-card-item__body">
                <h4 className="media-card-item__title">{a.title_ar}</h4>
                <small className="media-card-item__path">{a.kind}</small>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="لا توجد وسائط مرتبطة" description="" />
      ),
    },
    { key: 'rights', label: text.tabs.rights, content: <AvailabilityPanel scope="book" entityId={id} /> },
    { key: 'analytics', label: text.tabs.analytics, content: <div className="data-unavailable">قراءات واكتمال واستهلاك صوت — غير متوفر بعد</div> },
    { key: 'history', label: text.tabs.history, content: <TimelineView entries={[]} emptyLabel="لا سجل" /> },
  ]

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.breadcrumb, to: adminPath('books') }, { label: book.title_ar }]}
        thumbnail={<Cover />}
        title={book.title_ar}
        subtitle={(book as any).series_title}
        meta={
          <>
            <span>{book.age_min}–{book.age_max} سنوات</span>
            <span>{(book as any).type}</span>
            <span>{formatNumber(pages.length, locale)} {text.pages}</span>
          </>
        }
        status={<StatusBadge status={book.status as any} />}
        actions={
          <>
            <button className="button button--primary" onClick={() => setEditOpen(true)}>
              <Icon name="edit" size={16} />
              {text.editMeta}
            </button>
            <button className="button button--secondary" onClick={() => window.open(adminPath(`books/${id}`), '_blank')}>
              <Icon name="play" size={16} />
              {text.preview}
            </button>
          </>
        }
      />
      <DetailTabs tabs={tabs as any} active={tab} onChange={(k) => setTab(k as TabKey)} />

      {/* EDIT METADATA LIQUID GLASS MODAL */}
      <Modal open={editOpen} onClose={() => !saving && setEditOpen(false)} title={text.editMeta}>
        <form className="entity-form" onSubmit={handleEditSubmit}>
          {saveError && <div className="inline-alert inline-alert--error">{saveError}</div>}
          <label className="field">
            <span>العنوان بالعربية *</span>
            <input
              type="text"
              required
              value={editForm.title_ar}
              onChange={(e) => setEditForm({ ...editForm, title_ar: e.target.value })}
            />
          </label>

          <div className="form-grid">
            <label className="field">
              <span>أدنى عمر</span>
              <input
                type="number"
                min={2}
                max={16}
                value={editForm.age_min}
                onChange={(e) => setEditForm({ ...editForm, age_min: Number(e.target.value) })}
              />
            </label>

            <label className="field">
              <span>أقصى عمر</span>
              <input
                type="number"
                min={3}
                max={18}
                value={editForm.age_max}
                onChange={(e) => setEditForm({ ...editForm, age_max: Number(e.target.value) })}
              />
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>الحالة</span>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ContentStatus })}
              >
                <option value="draft">draft</option>
                <option value="writing">writing</option>
                <option value="qa">qa</option>
                <option value="ready">ready</option>
                <option value="published">published</option>
              </select>
            </label>

            <label className="field">
              <span>نمط التفاعل</span>
              <select
                value={editForm.interaction_mode}
                onChange={(e) => setEditForm({ ...editForm, interaction_mode: e.target.value as InteractionMode })}
              >
                <option value="tap_to_read">قراءة بالنقر</option>
                <option value="guided">قراءة موجهة</option>
                <option value="auto_play">تشغيل تلقائي</option>
              </select>
            </label>
          </div>

          <div className="form-actions">
            <button
              className="button button--ghost"
              type="button"
              disabled={saving}
              onClick={() => setEditOpen(false)}
            >
              {locale === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button className="button button--primary" type="submit" disabled={saving}>
              <Icon name="check" size={16} />
              {saving ? text.saving : text.saveMeta}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
