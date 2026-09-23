import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu, useColumnPreferences, ColumnManager } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { Pagination } from '../components/Pagination'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import { Modal } from '../components/Modal'

const STATUSES = ['pending', 'in_translation', 'ready_for_review', 'changes_requested', 'approved', 'stale']
const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  in_translation: 'قيد الترجمة',
  ready_for_review: 'جاهز للمراجعة',
  changes_requested: 'مطلوب تعديلات',
  approved: 'معتمد',
  stale: 'قديم ومعدل',
}
const LANGUAGES = ['ar', 'en', 'fr']
const ENTITIES = ['story_page', 'story', 'game', 'question', 'planet', 'series', 'episode', 'book']
const ENTITY_LABELS: Record<string, string> = {
  story_page: 'صفحة قصة',
  story: 'قصة رقمية',
  game: 'لعبة تفاعلية',
  question: 'سؤال تقييمي',
  planet: 'كوكب معرفي',
  series: 'سلسلة أنيميشن',
  episode: 'حلقة فيديو',
  book: 'كتاب مصور',
}

const copy = {
  ar: {
    eyebrow: 'التعريب والتوطين اللغوي',
    title: 'مركز الترجمة وإدارة المسارد',
    lede: 'إدارة ترجمة المحتوى التربوي من المصدر العربي إلى اللغات العالمية — مع ذاكرة ترجمة ذكية ومسرد لحماية المصطلحات.',
    add: 'ترجمة جديدة',
    refresh: 'تحديث البيانات',
    pending: 'قيد الانتظار',
    inProgress: 'قيد الترجمة',
    readyForReview: 'جاهز للمراجعة',
    changes: 'طلب تعديل',
    approved: 'معتمد',
    stale: 'محتوى معدل',
    content: 'طابور الترجمة',
    entityType: 'نوع العنصر',
    field: 'الحقل',
    sourceLang: 'لغة المصدر',
    targetLang: 'لغة الهدف',
    sourcePreview: 'نص المصدر',
    translationStatus: 'الحالة',
    noQueue: 'لا توجد عناصر مطابقة في طابور الترجمة',
    noQueueHint: 'غيّر الفلاتر أو اختر لغة أخرى للبحث.',
    glossaryTitle: 'مسرد المصطلحات الموحد (Glossary)',
    glossaryAdd: 'إضافة مصطلح للمسرد',
    term: 'المصطلح العربي',
    translations: 'الترجمات المعتمدة',
    scope: 'النطاق',
    category: 'التصنيف',
    tmTitle: 'ذاكرة الترجمة (Translation Memory)',
    staleTitle: 'ترجمات قديمة بحاجة لتحديث',
    cardsView: 'بطاقات الوحدات',
    tableView: 'الجدول الشامل',
    search: 'بحث في نصوص الترجمة…',
  },
  en: {
    eyebrow: 'Localization & Translation',
    title: 'Translation Center & Terminology Studio',
    lede: 'Comprehensive localization pipeline from verified Arabic sources with Translation Memory and standardized glossaries.',
    add: 'New Translation',
    refresh: 'Refresh',
    pending: 'Pending',
    inProgress: 'In Translation',
    readyForReview: 'Ready for Review',
    changes: 'Changes Requested',
    approved: 'Approved',
    stale: 'Stale Content',
    content: 'Translation Queue',
    entityType: 'Entity Type',
    field: 'Field',
    sourceLang: 'Source',
    targetLang: 'Target',
    sourcePreview: 'Source Text',
    translationStatus: 'Status',
    noQueue: 'No matching translation tasks',
    noQueueHint: 'Adjust filters or target language to find units.',
    glossaryTitle: 'Standardized Glossary',
    glossaryAdd: 'Add Term',
    term: 'Source Term (AR)',
    translations: 'Approved Translations',
    scope: 'Scope',
    category: 'Category',
    tmTitle: 'Translation Memory',
    staleTitle: 'Stale Translations Requiring Sync',
    cardsView: 'Unit Cards',
    tableView: 'Detailed Table',
    search: 'Search translations…',
  },
}

const COLUMNS: ColumnDefinition[] = [
  { key: 'content', label: 'content', locked: true },
  { key: 'entityType', label: 'entityType' },
  { key: 'field', label: 'field' },
  { key: 'sourceLang', label: 'sourceLang' },
  { key: 'targetLang', label: 'targetLang' },
  { key: 'sourcePreview', label: 'sourcePreview' },
  { key: 'translationStatus', label: 'translationStatus' },
]

export function TranslationCenterPage() {
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const navigate = useNavigate()
  const list = useUrlListState({ entity_type: '', target_language: '', status: '', stale: '' } as any, { limit: 25 })
  const { query, filters, offset, limit } = list
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [queue, setQueue] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<any>(null)
  const [glossary, setGlossary] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'queue' | 'glossary' | 'memory' | 'stale'>('queue')
  const [memoryQuery, setMemoryQuery] = useState('')
  const [memoryResults, setMemoryResults] = useState<any[]>([])
  const [memoryBusy, setMemoryBusy] = useState(false)
  const [memoryLang, setMemoryLang] = useState('en')
  const [glossaryModalOpen, setGlossaryModalOpen] = useState(false)
  const [glossaryForm, setGlossaryForm] = useState({ source_term: '', en: '', fr: '', scope: 'global', category: 'general' })
  const columns = useColumnPreferences('translation', COLUMNS)

  const searchMemory = useCallback(async (q: string, targetLang: string) => {
    if (q.trim().length < 3) {
      setMemoryResults([])
      return
    }
    setMemoryBusy(true)
    try {
      const res = await api.translationMemory(q.trim(), targetLang)
      setMemoryResults((res as any).data ?? [])
    } catch {
      setMemoryResults([])
    } finally {
      setMemoryBusy(false)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'memory') return
    const t = setTimeout(() => {
      void searchMemory(memoryQuery, memoryLang)
    }, 300)
    return () => clearTimeout(t)
  }, [memoryQuery, memoryLang, tab, searchMemory])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [qRes, gRes] = await Promise.all([
        api.translationQueue({ q: query, ...filters, limit, offset } as any),
        api.glossary({ limit: 50 } as any),
      ])
      setQueue((qRes as any).data || [])
      setTotal((qRes as any).meta?.total ?? (qRes as any).data?.length ?? 0)
      setSummary((qRes as any).meta?.summary)
      setGlossary((gRes as any).data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطأ في جلب بيانات الترجمة')
    } finally {
      setLoading(false)
    }
  }, [query, filters, limit, offset])

  useEffect(() => {
    const t = setTimeout(() => void load(), 200)
    return () => clearTimeout(t)
  }, [load])

  const handleCreateTerm = async () => {
    if (!glossaryForm.source_term.trim()) return
    try {
      await api.createGlossaryTerm({
        source_term: glossaryForm.source_term.trim(),
        translations: { en: glossaryForm.en.trim(), fr: glossaryForm.fr.trim() },
        scope: glossaryForm.scope,
        category: glossaryForm.category,
      } as any)
      setGlossaryModalOpen(false)
      setGlossaryForm({ source_term: '', en: '', fr: '', scope: 'global', category: 'general' })
      void load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل إضافة المصطلح')
    }
  }

  const filterFields: FilterField[] = [
    {
      key: 'entity_type',
      label: text.entityType,
      type: 'select',
      options: [
        { value: '', label: 'كل الكيانات' },
        ...ENTITIES.map((v) => ({ value: v, label: ENTITY_LABELS[v] ?? v })),
      ],
    },
    {
      key: 'target_language',
      label: text.targetLang,
      type: 'select',
      options: [
        { value: '', label: 'كل اللغات' },
        ...LANGUAGES.map((v) => ({ value: v, label: v.toUpperCase() })),
      ],
    },
    {
      key: 'status',
      label: text.translationStatus,
      type: 'select',
      options: [
        { value: '', label: 'كل الحالات' },
        ...STATUSES.map((v) => ({ value: v, label: STATUS_LABELS[v] ?? v })),
      ],
    },
  ]

  if (loading && !queue.length) return <LoadingState label="جارٍ تحميل مركز الترجمة..." />
  if (error && !queue.length) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(99, 102, 241, 0.12) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span className="catalog-hero__status-badge">
              <span className="status-dot-pulse" style={{ background: '#38bdf8' }} />
              {formatNumber(total, locale as any)} عنصر في خط الإنتاج
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
        <div className="catalog-hero__actions">
          <button className="button button--secondary" onClick={() => void load()} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="refresh" size={15} />
            <span>{text.refresh}</span>
          </button>
          <button className="cs-btn-primary" onClick={() => setGlossaryModalOpen(true)}>
            <Icon name="plus" size={16} />
            <span>{text.glossaryAdd}</span>
          </button>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card" onClick={() => list.setFilter('status', 'pending')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="clock" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.pending}</span>
            <div className="kpi-glass-card__num">
              {summary?.pending ?? queue.filter((q) => q.status === 'pending').length}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              بانتظار بدء التعريب
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => list.setFilter('status', 'ready_for_review')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="edit" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.readyForReview}</span>
            <div className="kpi-glass-card__num">
              {summary?.ready_for_review ?? queue.filter((q) => q.status === 'ready_for_review').length}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#818cf8' }}>
              مترجمة وتنتظر الاعتماد
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => list.setFilter('status', 'approved')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.approved}</span>
            <div className="kpi-glass-card__num">
              {summary?.approved ?? queue.filter((q) => q.status === 'approved').length}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              معتمدة ونشطة في التطبيق
            </span>
          </div>
        </div>

        <div className="kpi-glass-card" onClick={() => setTab('stale')} style={{ cursor: 'pointer' }}>
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.stale}</span>
            <div className="kpi-glass-card__num">
              {summary?.stale ?? queue.filter((q) => q.status === 'stale').length}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#f87171' }}>
              تغيّر النص العربي المصدر
            </span>
          </div>
        </div>
      </div>

      {/* 3. Catalog Control Strip */}
      <section className="catalog-control-strip">
        <div className="catalog-control-strip__left">
          <div className="filter-pill-group">
            {(['queue', 'glossary', 'memory', 'stale'] as const).map((t) => (
              <button
                key={t}
                className={`filter-pill ${tab === t ? 'filter-pill--active' : ''}`}
                onClick={() => setTab(t)}
              >
                {t === 'queue'
                  ? text.content
                  : t === 'glossary'
                  ? text.glossaryTitle
                  : t === 'memory'
                  ? text.tmTitle
                  : text.staleTitle}
              </button>
            ))}
          </div>
        </div>

        <div className="catalog-control-strip__right">
          {tab === 'queue' && (
            <>
              <ListToolbar
                searchValue={query}
                onSearchChange={list.setQuery}
                searchPlaceholder={text.search}
                fields={filterFields}
                values={filters as any}
                defaults={{ entity_type: '', target_language: '', status: '', stale: '' } as any}
                onApply={(next) => list.setFilters(next as any)}
                onClear={list.clearFilters}
                onRemove={(k) => list.setFilter(k as any, '')}
                trailing={
                  <>
                    <SavedViewsMenu
                      storageKey="translation"
                      currentSearch={list.search}
                      onApply={(s) => navigate(`${adminPath('translation')}${s}`)}
                    />
                    <ColumnManager
                      columns={COLUMNS.map((c) => ({ ...c, label: (text as any)[c.label] ?? c.label }))}
                      hidden={columns.hidden}
                      onToggle={columns.toggle}
                      onReset={columns.reset}
                    />
                  </>
                }
              />
              <div className="view-mode-toggle">
                <button
                  className={`view-mode-btn ${view === 'cards' ? 'view-mode-btn--active' : ''}`}
                  onClick={() => setView('cards')}
                >
                  <Icon name="grid" size={14} />
                  <span>{text.cardsView}</span>
                </button>
                <button
                  className={`view-mode-btn ${view === 'table' ? 'view-mode-btn--active' : ''}`}
                  onClick={() => setView('table')}
                >
                  <Icon name="bars" size={14} />
                  <span>{text.tableView}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 4. Tab contents */}
      {tab === 'queue' &&
        (queue.length === 0 ? (
          <EmptyState title={text.noQueue} description={text.noQueueHint} />
        ) : view === 'cards' ? (
          <>
            <div className="translation-studio-grid">
              {queue.map((row) => (
                <article key={row.id} className="translation-card-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="skill-domain-pill" style={{ color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                      {ENTITY_LABELS[row.entity_type] ?? row.entity_type}
                    </span>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 800,
                        background:
                          row.status === 'approved'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : row.status === 'stale'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color:
                          row.status === 'approved'
                            ? '#10b981'
                            : row.status === 'stale'
                            ? '#f87171'
                            : '#fbbf24',
                      }}
                    >
                      {STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
                      {row.context_title ?? row.entity_id.slice(0, 16)}
                    </h3>
                    <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                      الحقل: <code>{row.field}</code> {row.page_number ? `· ص ${row.page_number}` : ''}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: 'var(--surface-2)',
                      border: '1px solid var(--cs-glass-border)',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                      color: 'var(--text-soft)',
                      direction: 'rtl',
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 2 }}>نص المصدر العربي:</div>
                    {row.source_text?.slice(0, 90) ?? '—'}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: 'var(--muted)' }}>
                      اللغة: <strong>AR → {row.target_language?.toUpperCase()}</strong>
                    </span>
                    {row.is_reauthor && (
                      <span className="prod-chip prod-chip--blocked" style={{ fontSize: 11 }}>
                        يتطلب إعادة تأليف
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingTop: 10,
                      borderTop: '1px solid var(--cs-glass-border)',
                      marginTop: 'auto',
                    }}
                  >
                    <Link
                      to={adminPath(`translation/${row.id}`)}
                      className="button button--primary button--small"
                      style={{ textDecoration: 'none' }}
                    >
                      <span>محرر الترجمة</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div style={{ marginTop: 20 }}>
              <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
            </div>
          </>
        ) : (
          <section className="panel panel--table">
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table data-table--wide">
                <thead>
                  <tr>
                    <th>{text.content}</th>
                    {columns.isVisible('entityType') && <th>{text.entityType}</th>}
                    {columns.isVisible('field') && <th>{text.field}</th>}
                    <th>{text.sourceLang}</th>
                    <th>{text.targetLang}</th>
                    {columns.isVisible('sourcePreview') && <th>{text.sourcePreview}</th>}
                    {columns.isVisible('translationStatus') && <th>{text.translationStatus}</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link to={adminPath(`translation/${row.id}`)} style={{ textDecoration: 'none' }}>
                          <strong>{row.context_title ?? row.entity_id.slice(0, 12)}</strong>
                          <br />
                          <small className="table-secondary">
                            {row.entity_type} · {row.page_number ? `ص ${row.page_number}` : row.field}
                          </small>
                        </Link>
                      </td>
                      {columns.isVisible('entityType') && <td>{row.entity_type}</td>}
                      {columns.isVisible('field') && <td>{row.field}</td>}
                      <td>AR</td>
                      <td>{row.target_language?.toUpperCase()}</td>
                      {columns.isVisible('sourcePreview') && (
                        <td>
                          <span style={{ display: 'block', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {row.source_text?.slice(0, 80) ?? '—'}
                          </span>
                        </td>
                      )}
                      {columns.isVisible('translationStatus') && (
                        <td>
                          <span
                            className={`status-badge ${
                              row.status === 'approved'
                                ? 'status-badge--published'
                                : row.status === 'stale'
                                ? 'status-badge--review'
                                : ''
                            }`}
                          >
                            {STATUS_LABELS[row.status] ?? row.status}
                          </span>
                        </td>
                      )}
                      <td>
                        <Link className="button button--ghost button--small" to={adminPath(`translation/${row.id}`)}>
                          فتح
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={total} limit={limit} offset={offset} onOffsetChange={list.setOffset} locale={locale as any} />
          </section>
        ))}

      {tab === 'glossary' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{text.glossaryTitle}</h3>
              <p className="panel__note" style={{ margin: 0 }}>
                تثبيت ترجمة أسماء الشخصيات والكواكب والمصطلحات التربوية لضمان عدم الترجمة الحرفية.
              </p>
            </div>
            <button className="button button--primary button--small" onClick={() => setGlossaryModalOpen(true)}>
              <Icon name="plus" size={13} />
              <span>{text.glossaryAdd}</span>
            </button>
          </div>

          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.term}</th>
                  <th>الترجمة الإنجليزية (EN)</th>
                  <th>الترجمة الفرنسية (FR)</th>
                  <th>{text.scope}</th>
                  <th>{text.category}</th>
                </tr>
              </thead>
              <tbody>
                {glossary.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <strong>{g.source_term}</strong>
                    </td>
                    <td>{g.translations?.en ?? '—'}</td>
                    <td>{g.translations?.fr ?? '—'}</td>
                    <td>{g.scope}</td>
                    <td>
                      <span className="track-badge">{g.category}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'memory' && (
        <section className="panel" style={{ padding: 24, borderRadius: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: 18 }}>{text.tmTitle}</h3>
              <p className="panel__note" style={{ margin: 0 }}>
                محرك التوافق اللغوي: يسترجع الترجمات المعتمدة تاريخياً لتسريع عمل المترجمين دون اختلاق نصوص.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={memoryLang}
                onChange={(e) => setMemoryLang(e.target.value)}
                style={{
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid var(--cs-glass-border)',
                  background: 'var(--surface-2)',
                  padding: '0 10px',
                  color: 'var(--text)',
                }}
              >
                <option value="en">الإنجليزية (EN)</option>
                <option value="fr">الفرنسية (FR)</option>
                <option value="ar">العربية (AR)</option>
              </select>
            </div>
          </div>

          <div className="search-field" style={{ maxWidth: 480, marginTop: 16 }}>
            <Icon name="search" size={16} />
            <input
              value={memoryQuery}
              onChange={(e) => setMemoryQuery(e.target.value)}
              placeholder="ابحث في ذاكرة الترجمة... (اكتب 3 أحرف على الأقل)"
            />
          </div>

          {memoryBusy ? (
            <div style={{ padding: 20, color: 'var(--muted)' }}>جارٍ البحث في الذاكرة...</div>
          ) : memoryResults.length ? (
            <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
              {memoryResults.map((m: any, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid var(--cs-glass-border)',
                    background: 'var(--surface-2)',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: 14 }}>{m.source_text}</strong>
                    <span className="status-badge status-badge--published">{memoryLang.toUpperCase()}</span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--text-soft)',
                      background: 'var(--surface-3)',
                      padding: 10,
                      borderRadius: 8,
                    }}
                  >
                    {m.target_text}
                  </div>
                </div>
              ))}
            </div>
          ) : memoryQuery.trim().length >= 3 ? (
            <div style={{ marginTop: 16 }}>
              <EmptyState
                title="لا توجد نتائج سابقة"
                description={`لم يُعثر على ترجمة سابقة مطابقة لـ "${memoryQuery}" في ذاكرة اللغة ${memoryLang.toUpperCase()}`}
              />
            </div>
          ) : (
            <p className="panel__note" style={{ marginTop: 16 }}>
              اكتب كلمة أو عبارة للبحث في الذاكرة الترجمية واستعراض النصوص المعتمدة.
            </p>
          )}
        </section>
      )}

      {tab === 'stale' && (
        <section className="panel panel--table">
          <header className="panel__header">
            <h3>{text.staleTitle}</h3>
          </header>
          {queue.filter((q) => q.status === 'stale').length ? (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.content}</th>
                    <th>إصدار المصدر الحالي</th>
                    <th>الحالة</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {queue
                    .filter((q) => q.status === 'stale')
                    .map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.context_title}</strong>
                        </td>
                        <td>v{row.source_version}</td>
                        <td>
                          <span className="status-badge status-badge--review">{text.stale}</span>
                        </td>
                        <td>
                          <Link className="button button--ghost button--small" to={adminPath(`translation/${row.id}`)}>
                            تحديث الترجمة
                          </Link>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="كل الترجمات محدثة"
              description="عند تعديل النص العربي لأي قصة أو حلقة، تظهر وحداتها هنا تلقائياً لتحديثها."
            />
          )}
        </section>
      )}

      {/* Glossary Modal */}
      <Modal
        open={glossaryModalOpen}
        onClose={() => setGlossaryModalOpen(false)}
        title={text.glossaryAdd}
      >
        <div className="entity-form">
          <label className="field">
            <span>المصطلح باللغة العربية (المصدر) *</span>
            <input
              value={glossaryForm.source_term}
              onChange={(e) => setGlossaryForm({ ...glossaryForm, source_term: e.target.value })}
              placeholder="مثال: كوكب الحكمة، سراج، مغامرة"
            />
          </label>
          <div className="form-grid">
            <label className="field">
              <span>الترجمة الإنجليزية (EN) *</span>
              <input
                value={glossaryForm.en}
                onChange={(e) => setGlossaryForm({ ...glossaryForm, en: e.target.value })}
                placeholder="English translation"
              />
            </label>
            <label className="field">
              <span>الترجمة الفرنسية (FR)</span>
              <input
                value={glossaryForm.fr}
                onChange={(e) => setGlossaryForm({ ...glossaryForm, fr: e.target.value })}
                placeholder="Traduction française"
              />
            </label>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>النطاق</span>
              <select
                value={glossaryForm.scope}
                onChange={(e) => setGlossaryForm({ ...glossaryForm, scope: e.target.value })}
              >
                <option value="global">عام عبر كل التطبيق</option>
                <option value="character">اسم شخصية</option>
                <option value="planet">اسم كوكب</option>
                <option value="pedagogical">مصطلح تربوي</option>
              </select>
            </label>
            <label className="field">
              <span>التصنيف</span>
              <input
                value={glossaryForm.category}
                onChange={(e) => setGlossaryForm({ ...glossaryForm, category: e.target.value })}
                placeholder="مثال: character, geography, values"
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="button button--ghost" onClick={() => setGlossaryModalOpen(false)}>
              إلغاء
            </button>
            <button className="button button--primary" onClick={handleCreateTerm}>
              حفظ المصطلح
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
