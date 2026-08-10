import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { BulkActionBar, ColumnManager, QuickView, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { CalendarView, TreeView } from '../components/DataViews'
import type { CalendarItem, TreeNode } from '../components/DataViews'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import type { CmsLanguage, WebPageDetail, WebPageListRow } from '../types/api'

/**
 * صفحات الموقع العام: القائمة وأربع طرق عرض.
 *
 * ## لماذا الصفّ هو (مفتاح الصفحة، اللغة)
 *
 * `web_pages` مفتاحه `(page_key, language)`: الصفحة العامة ثلاثة عناوين لا مورد
 * واحد بثلاث تسميات، والعربية قد تكون منشورة والفرنسية في المراجعة. عرضها صفًّا
 * واحدًا بثلاث شارات كان سيُخفي أن حالة النشر مستقلّة لكل لغة — وهي المعلومة
 * الوحيدة التي تُطلب من هذه الشاشة كل يوم.
 *
 * ## البحث محلّي والفلاتر على الخادم
 *
 * `GET /admin/website/pages` يقبل `language` و`status` ولا يقبل بحثًا نصيًّا،
 * ويُعيد المجموعة كاملة (تُقاس بالعشرات لا بالآلاف). لذلك اللغة والحالة تُرسَلان
 * إلى الخادم، والبحث يُطبَّق هنا، والترقيم محلّي — وهذا مُعلَن في الواجهة بدل
 * تمرير `q` إلى مسار يتجاهله فيبدو البحث معطَّلًا.
 */

const copy = {
  ar: {
    eyebrow: 'الموقع العام',
    title: 'صفحات الموقع',
    lede: 'كل تغيير هنا يظهر على الموقع بلا نشر برمجي. الصفّ الواحد = صفحة بلغة واحدة، وحالة النشر مستقلّة لكل لغة.',
    search: 'بحث في العنوان أو المسار…',
    searchNote: 'البحث يُطبَّق في المتصفح؛ اللغة والحالة تُرسَلان إلى الخادم.',
    create: 'صفحة جديدة',
    pageKey: 'مفتاح الصفحة',
    language: 'اللغة',
    path: 'المسار',
    titleCol: 'العنوان',
    status: 'الحالة',
    sections: 'أقسام مُفعَّلة',
    seo: 'SEO',
    variants: 'نسخ لغوية',
    scheduled: 'موعد النشر',
    updated: 'آخر تحديث',
    kind: 'النوع',
    indexable: 'قابلة للفهرسة',
    open: 'تحرير',
    quick: 'عرض سريع',
    empty: 'لا صفحات مطابقة',
    emptyHint: 'غيّر البحث أو الفلاتر، أو أنشئ صفحة.',
    loadError: 'تعذر تحميل الصفحات',
    allLanguages: 'كل اللغات',
    allStatuses: 'كل الحالات',
    allKinds: 'كل الأنواع',
    yes: 'نعم',
    no: 'لا',
    hasSeo: 'لها SEO',
    noSeo: 'بلا SEO',
    createTitle: 'صفحة جديدة',
    createHint: 'المسار يُشتقّ من اللغة والاختصار. الصفحة تُنشأ مسوّدة دائمًا؛ النشر عملية مستقلّة.',
    keyField: 'مفتاح الصفحة (لاتيني)',
    keyHint: 'يجمع النسخ اللغوية معًا. اترك مجموعة الترجمة فارغة لتساوي المفتاح.',
    slugField: 'الاختصار (slug)',
    slugHint: 'أحرف لاتينية صغيرة وأرقام وشُرَط. الصفحة الرئيسية وحدها بلا اختصار.',
    titleField: 'العنوان',
    groupField: 'مجموعة الترجمة',
    kindField: 'نوع الصفحة',
    submit: 'إنشاء',
    creating: 'جارٍ الإنشاء…',
    cancel: 'إلغاء',
    publishSelected: 'نشر المحدَّد',
    publishing: 'جارٍ النشر…',
    publishResult: 'نتيجة النشر',
    published: 'نُشِرت',
    blocked: 'مرفوضة',
    readiness: 'جاهزية النشر',
    noBlockers: 'لا عوائق.',
    calendarEmpty: 'لا صفحات مجدولة. الجدولة تُضبَط من محرِّر الصفحة.',
    treeEmpty: 'لا مجموعات ترجمة.',
    group: 'مجموعة الترجمة',
    quickHint: 'قراءة سريعة. التحرير في الصفحة الكاملة.',
    openFull: 'فتح المحرِّر',
    loading: 'جارٍ التحميل…',
  },
  en: {
    eyebrow: 'Public website',
    title: 'Website pages',
    lede: 'Every change here reaches the site without a deployment. One row is one page in one language, and publication state is per language.',
    search: 'Search title or path…',
    searchNote: 'Search is applied in the browser; language and status are sent to the server.',
    create: 'New page',
    pageKey: 'Page key',
    language: 'Language',
    path: 'Path',
    titleCol: 'Title',
    status: 'Status',
    sections: 'Active sections',
    seo: 'SEO',
    variants: 'Language variants',
    scheduled: 'Scheduled for',
    updated: 'Updated',
    kind: 'Kind',
    indexable: 'Indexable',
    open: 'Edit',
    quick: 'Quick view',
    empty: 'No matching pages',
    emptyHint: 'Change the search or filters, or create a page.',
    loadError: 'Unable to load pages',
    allLanguages: 'All languages',
    allStatuses: 'All statuses',
    allKinds: 'All kinds',
    yes: 'Yes',
    no: 'No',
    hasSeo: 'Has SEO',
    noSeo: 'No SEO',
    createTitle: 'New page',
    createHint: 'The path is derived from language and slug. A page is always created as a draft; publishing is a separate operation.',
    keyField: 'Page key (latin)',
    keyHint: 'Groups the language variants. Leave the translation group empty to match the key.',
    slugField: 'Slug',
    slugHint: 'Lower-case letters, numbers and hyphens. Only the home page has no slug.',
    titleField: 'Title',
    groupField: 'Translation group',
    kindField: 'Page kind',
    submit: 'Create',
    creating: 'Creating…',
    cancel: 'Cancel',
    publishSelected: 'Publish selected',
    publishing: 'Publishing…',
    publishResult: 'Publish result',
    published: 'Published',
    blocked: 'Refused',
    readiness: 'Publish readiness',
    noBlockers: 'No blockers.',
    calendarEmpty: 'Nothing scheduled. Scheduling is set in the page editor.',
    treeEmpty: 'No translation groups.',
    group: 'Translation group',
    quickHint: 'A quick read. Editing happens on the full page.',
    openFull: 'Open editor',
    loading: 'Loading…',
  },
}

const LANGUAGES: CmsLanguage[] = ['ar', 'en', 'fr']
const STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived']
const KINDS = ['home', 'standard', 'landing', 'legal', 'help', 'index']
const LIMIT = 25

const DEFAULT_FILTERS = { language: '', status: '', kind: '', seo: '' }

const COLUMNS: ColumnDefinition[] = [
  { key: 'title', label: 'title', locked: true },
  { key: 'language', label: 'language' },
  { key: 'path', label: 'path' },
  { key: 'status', label: 'status' },
  { key: 'sections', label: 'sections' },
  { key: 'seo', label: 'seo' },
  { key: 'variants', label: 'variants' },
  { key: 'scheduled', label: 'scheduled' },
  { key: 'updated', label: 'updated' },
]

const statusTone: Record<string, string> = {
  published: 'active',
  scheduled: 'pending',
  review: 'pending',
  draft: 'draft',
  archived: 'archived',
}

export function WebsitePagesPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()

  const state = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT, defaultView: 'table' })
  const [rows, setRows] = useState<WebPageListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [quickId, setQuickId] = useState<string | null>(null)
  const [quick, setQuick] = useState<WebPageDetail | null>(null)
  const [quickLoading, setQuickLoading] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkResult, setBulkResult] = useState<Array<{ path: string; ok: boolean; message: string }>>([])

  const columns = useColumnPreferences('website-pages', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.webPages({
        language: state.filters.language || undefined,
        status: state.filters.status || undefined,
      })
      setRows(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [state.filters.language, state.filters.status, text.loadError])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!quickId) { setQuick(null); return }
    let cancelled = false
    setQuickLoading(true)
    void api.webPage(quickId)
      .then((response) => { if (!cancelled) setQuick(response.data) })
      .catch(() => { if (!cancelled) setQuick(null) })
      .finally(() => { if (!cancelled) setQuickLoading(false) })
    return () => { cancelled = true }
  }, [quickId])

  const filtered = useMemo(() => {
    const term = state.query.trim().toLowerCase()
    return rows.filter((row) => {
      if (state.filters.kind && row.kind !== state.filters.kind) return false
      if (state.filters.seo === '1' && row.has_seo === 0) return false
      if (state.filters.seo === '0' && row.has_seo > 0) return false
      if (!term) return true
      return row.title.toLowerCase().includes(term)
        || row.path.toLowerCase().includes(term)
        || row.page_key.toLowerCase().includes(term)
    })
  }, [rows, state.filters.kind, state.filters.seo, state.query])

  const paged = useMemo(
    () => filtered.slice(state.offset, state.offset + LIMIT),
    [filtered, state.offset],
  )

  const filterFields: FilterField[] = [
    {
      key: 'language',
      label: text.language,
      type: 'select',
      options: [{ value: '', label: text.allLanguages }, ...LANGUAGES.map((item) => ({ value: item, label: item }))],
    },
    {
      key: 'status',
      label: text.status,
      type: 'select',
      options: [{ value: '', label: text.allStatuses }, ...STATUSES.map((item) => ({ value: item, label: item }))],
    },
    {
      key: 'kind',
      label: text.kind,
      type: 'select',
      options: [{ value: '', label: text.allKinds }, ...KINDS.map((item) => ({ value: item, label: item }))],
    },
    {
      key: 'seo',
      label: text.seo,
      type: 'select',
      options: [
        { value: '', label: text.allStatuses },
        { value: '1', label: text.hasSeo },
        { value: '0', label: text.noSeo },
      ],
    },
  ]

  const calendarItems: CalendarItem[] = filtered
    .filter((row) => row.scheduled_at || row.published_at)
    .map((row) => ({
      id: row.id,
      at: (row.scheduled_at ?? row.published_at) as string,
      label: `${row.language} · ${row.title}`,
      tone: row.status === 'published' ? 'published' : 'scheduled',
      onOpen: () => navigate(adminPath(`website/pages/${row.id}`)),
    }))

  const treeNodes: TreeNode[] = useMemo(() => {
    const groups = new Map<string, WebPageListRow[]>()
    for (const row of filtered) groups.set(row.translation_group, [...(groups.get(row.translation_group) ?? []), row])
    return [...groups.entries()].map(([group, entries]) => ({
      id: group,
      label: group,
      badge: entries.length,
      children: entries.map((entry) => ({
        id: entry.id,
        label: `${entry.language} · ${entry.title}`,
        meta: entry.status,
        onOpen: () => navigate(adminPath(`website/pages/${entry.id}`)),
      })),
    }))
  }, [filtered, navigate])

  async function publishSelected() {
    setBulkBusy(true)
    const results: Array<{ path: string; ok: boolean; message: string }> = []
    for (const id of selected) {
      const row = rows.find((item) => item.id === id)
      try {
        await api.publishWebPage(id)
        results.push({ path: row?.path ?? id, ok: true, message: text.published })
      } catch (caught) {
        const message = caught instanceof ApiError
          ? [caught.message, ...(Array.isArray((caught.payload as { blockers?: Array<{ detail: string }> })?.blockers)
            ? ((caught.payload as { blockers: Array<{ detail: string }> }).blockers).map((blocker) => blocker.detail)
            : [])].join(' — ')
          : caught instanceof Error ? caught.message : text.blocked
        results.push({ path: row?.path ?? id, ok: false, message })
      }
    }
    setBulkResult(results)
    setSelected([])
    setBulkBusy(false)
    await load()
  }

  const view = state.view as ViewMode | 'calendar' | 'tree'

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <button className="button button--primary" type="button" onClick={() => setCreating(true)}>
          <Icon name="plus" size={16} />{text.create}
        </button>
      </section>

      <section className="panel panel--table">
        <header className="panel__header panel__header--filters">
          <div>
            <h3>{text.title} <span className="title-count">{filtered.length}</span></h3>
            <p className="panel__note">{text.searchNote}</p>
          </div>
          <ListToolbar
            searchValue={state.query}
            onSearchChange={state.setQuery}
            searchPlaceholder={text.search}
            fields={filterFields}
            values={state.filters}
            defaults={DEFAULT_FILTERS}
            onApply={(next) => state.setFilters(next)}
            onClear={state.clearFilters}
            onRemove={(key) => state.setFilter(key as keyof typeof DEFAULT_FILTERS & string, '')}
            trailing={
              <>
                <SavedViewsMenu
                  storageKey="website-pages"
                  currentSearch={state.search}
                  onApply={(search) => navigate({ pathname: adminPath('website/pages'), search })}
                />
                <ColumnManager
                  columns={COLUMNS.map((column) => ({ ...column, label: text[column.label as keyof typeof text] as string }))}
                  hidden={columns.hidden}
                  onToggle={columns.toggle}
                  onReset={columns.reset}
                />
                <div className="view-switcher-group">
                  <ViewSwitcher
                    value={(view === 'calendar' || view === 'tree' ? 'table' : view) as ViewMode}
                    onChange={(mode) => state.setView(mode)}
                    modes={['table', 'cards']}
                    locale={locale}
                  />
                  <button
                    type="button"
                    className={`view-switcher__button ${view === 'calendar' ? 'view-switcher__button--active' : ''}`}
                    aria-pressed={view === 'calendar'}
                    onClick={() => state.setView('calendar')}
                  ><Icon name="calendar" size={16} /><span>{locale === 'ar' ? 'تقويم' : 'Calendar'}</span></button>
                  <button
                    type="button"
                    className={`view-switcher__button ${view === 'tree' ? 'view-switcher__button--active' : ''}`}
                    aria-pressed={view === 'tree'}
                    onClick={() => state.setView('tree')}
                  ><Icon name="tree" size={16} /><span>{locale === 'ar' ? 'شجرة' : 'Tree'}</span></button>
                </div>
              </>
            }
          />
        </header>

        {loading && !rows.length ? <LoadingState /> : error && !rows.length ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState title={text.empty} description={text.emptyHint} />
        ) : view === 'calendar' ? (
          <div className="panel__body"><CalendarView items={calendarItems} emptyLabel={text.calendarEmpty} /></div>
        ) : view === 'tree' ? (
          <div className="panel__body"><TreeView nodes={treeNodes} emptyLabel={text.treeEmpty} /></div>
        ) : view === 'cards' ? (
          <>
            <ul className="card-grid">
              {paged.map((row) => (
                <li className="entity-card" key={row.id}>
                  <header>
                    <span className={`account-status account-status--${statusTone[row.status] ?? 'draft'}`}>{row.status}</span>
                    <span className="entity-card__lang" dir="ltr">{row.language}</span>
                  </header>
                  <h4>{row.title}</h4>
                  <code dir="ltr">{row.path}</code>
                  <dl>
                    <div><dt>{text.sections}</dt><dd>{row.active_sections}</dd></div>
                    <div><dt>{text.seo}</dt><dd>{row.has_seo ? text.yes : text.no}</dd></div>
                    <div><dt>{text.variants}</dt><dd>{row.language_variants}</dd></div>
                  </dl>
                  <footer>
                    <Link className="button button--ghost button--small" to={adminPath(`website/pages/${row.id}`)}>{text.open}</Link>
                    <button className="button button--ghost button--small" type="button" onClick={() => setQuickId(row.id)}>{text.quick}</button>
                  </footer>
                </li>
              ))}
            </ul>
            <Pagination total={filtered.length} limit={LIMIT} offset={state.offset} onOffsetChange={state.setOffset} locale={locale} />
          </>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="table-check">
                      <input
                        type="checkbox"
                        aria-label={locale === 'ar' ? 'تحديد كل الصفحات المعروضة' : 'Select all shown pages'}
                        checked={paged.length > 0 && paged.every((row) => selected.includes(row.id))}
                        onChange={(event) => setSelected(event.target.checked
                          ? [...new Set([...selected, ...paged.map((row) => row.id)])]
                          : selected.filter((id) => !paged.some((row) => row.id === id)))}
                      />
                    </th>
                    <th>{text.titleCol}</th>
                    {columns.isVisible('language') && <th>{text.language}</th>}
                    {columns.isVisible('path') && <th>{text.path}</th>}
                    {columns.isVisible('status') && <th>{text.status}</th>}
                    {columns.isVisible('sections') && <th>{text.sections}</th>}
                    {columns.isVisible('seo') && <th>{text.seo}</th>}
                    {columns.isVisible('variants') && <th>{text.variants}</th>}
                    {columns.isVisible('scheduled') && <th>{text.scheduled}</th>}
                    {columns.isVisible('updated') && <th>{text.updated}</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => (
                    <tr key={row.id}>
                      <td className="table-check">
                        <input
                          type="checkbox"
                          aria-label={`${text.open}: ${row.title}`}
                          checked={selected.includes(row.id)}
                          onChange={(event) => setSelected(event.target.checked
                            ? [...selected, row.id]
                            : selected.filter((id) => id !== row.id))}
                        />
                      </td>
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`website/pages/${row.id}`)}>
                          <div><strong>{row.title}</strong><small dir="ltr">{row.page_key}</small></div>
                        </Link>
                      </td>
                      {columns.isVisible('language') && <td dir="ltr">{row.language}</td>}
                      {columns.isVisible('path') && <td><code dir="ltr">{row.path}</code></td>}
                      {columns.isVisible('status') && (
                        <td><span className={`account-status account-status--${statusTone[row.status] ?? 'draft'}`}>{row.status}</span></td>
                      )}
                      {columns.isVisible('sections') && (
                        <td>{row.active_sections === 0
                          ? <span className="readiness-item readiness-item--warn readiness-pill">0</span>
                          : row.active_sections}</td>
                      )}
                      {columns.isVisible('seo') && (
                        <td>{row.has_seo
                          ? <span className="field__ok">{text.yes}</span>
                          : <span className="readiness-item readiness-item--warn readiness-pill">{text.no}</span>}</td>
                      )}
                      {columns.isVisible('variants') && <td>{row.language_variants}</td>}
                      {columns.isVisible('scheduled') && <td dir="ltr">{row.scheduled_at ?? '—'}</td>}
                      {columns.isVisible('updated') && <td dir="ltr">{row.updated_at}</td>}
                      <td className="table-actions">
                        <button className="button button--ghost button--small" type="button" onClick={() => setQuickId(row.id)}>{text.quick}</button>
                        <Link className="button button--ghost button--small" to={adminPath(`website/pages/${row.id}`)}>{text.open}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={filtered.length} limit={LIMIT} offset={state.offset} onOffsetChange={state.setOffset} locale={locale} />
          </>
        )}
      </section>

      <BulkActionBar
        count={selected.length}
        busy={bulkBusy}
        onClear={() => setSelected([])}
        actions={[{ key: 'publish', label: bulkBusy ? text.publishing : text.publishSelected, onRun: () => void publishSelected() }]}
      />

      <Modal open={bulkResult.length > 0} title={text.publishResult} onClose={() => setBulkResult([])}>
        <ul className="kv-list">
          {bulkResult.map((result) => (
            <li key={result.path}>
              <code dir="ltr">{result.path}</code>
              <span className={result.ok ? 'field__ok' : 'field__error'}>{result.message}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <QuickView
        open={!!quickId}
        title={quick?.page.title ?? text.quick}
        subtitle={text.quickHint}
        onClose={() => setQuickId(null)}
        footer={quickId ? <Link className="button button--primary" to={adminPath(`website/pages/${quickId}`)}>{text.openFull}</Link> : null}
      >
        {quickLoading ? <p className="data-unavailable">{text.loading}</p> : quick ? (
          <div className="entity-form">
            <ul className="kv-list">
              <li><span>{text.path}</span><code dir="ltr">{quick.page.path}</code></li>
              <li><span>{text.language}</span><span dir="ltr">{quick.page.language}</span></li>
              <li><span>{text.status}</span><span>{quick.page.status}</span></li>
              <li><span>{text.kind}</span><span dir="ltr">{quick.page.kind}</span></li>
              <li><span>{text.sections}</span><span>{quick.sections.filter((section) => section.is_active === 1).length} / {quick.sections.length}</span></li>
              <li><span>{text.group}</span><code dir="ltr">{quick.page.translation_group}</code></li>
              <li><span>{text.indexable}</span><span>{quick.page.is_indexable ? text.yes : text.no}</span></li>
            </ul>
            <h4>{text.readiness}</h4>
            {quick.readiness.length ? (
              <ul className="readiness-list">
                {quick.readiness.map((blocker) => (
                  <li className={`readiness-item readiness-item--${blocker.severity === 'blocker' ? 'blocked' : 'warn'}`} key={blocker.id}>
                    <strong>{blocker.id}</strong><span>{blocker.detail}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="field__ok">{text.noBlockers}</p>}
          </div>
        ) : null}
      </QuickView>

      <CreatePageDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => navigate(adminPath(`website/pages/${id}`))} />
    </div>
  )
}

function CreatePageDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [form, setForm] = useState({ page_key: '', language: 'ar' as CmsLanguage, title: '', slug: '', kind: 'standard', translation_group: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const response = await api.createWebPage({
        page_key: form.page_key.trim(),
        language: form.language,
        title: form.title.trim(),
        kind: form.kind,
        slug: form.kind === 'home' ? undefined : (form.slug.trim() || form.page_key.trim()),
        translation_group: form.translation_group.trim() || undefined,
      })
      onCreated(response.data.id)
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={text.createTitle} description={text.createHint} onClose={onClose}>
      <div className="entity-form">
        <label className="field">
          <span>{text.keyField} *</span>
          <input dir="ltr" value={form.page_key} onChange={(event) => setForm({ ...form, page_key: event.target.value })} />
          <small>{text.keyHint}</small>
        </label>
        <label className="field">
          <span>{text.titleField} *</span>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{text.language}</span>
            <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value as CmsLanguage })}>
              {LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{text.kindField}</span>
            <select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>
              {KINDS.map((kind) => <option value={kind} key={kind}>{kind}</option>)}
            </select>
          </label>
        </div>
        {form.kind !== 'home' && (
          <label className="field">
            <span>{text.slugField}</span>
            <input dir="ltr" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
            <small>{text.slugHint}</small>
          </label>
        )}
        <label className="field">
          <span>{text.groupField}</span>
          <input dir="ltr" value={form.translation_group} onChange={(event) => setForm({ ...form, translation_group: event.target.value })} />
        </label>
        {error && <p className="field__error" role="alert">{error}</p>}
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            disabled={busy || !form.page_key.trim() || !form.title.trim()}
            onClick={() => void submit()}
          >{busy ? text.creating : text.submit}</button>
          <button className="button button--ghost" type="button" onClick={onClose}>{text.cancel}</button>
        </div>
      </div>
    </Modal>
  )
}
