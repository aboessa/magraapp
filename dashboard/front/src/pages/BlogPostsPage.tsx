import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useQuickCreate } from '../hooks/useQuickCreate'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, QuickView, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { CalendarView } from '../components/DataViews'
import type { CalendarItem } from '../components/DataViews'
import { MediaThumb } from '../components/MediaPicker'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import type { BlogPostDetail, BlogPostListRow, BlogTaxonomy, CmsLanguage } from '../types/api'

/**
 * مجموعة المدوّنة: جدول، بطاقات، وتقويم للجدولة.
 *
 * ## ما يُفلتَر على الخادم وما يُفلتَر هنا
 *
 * `GET /admin/blog/posts` يقبل `language` و`status` و`category_id` و`q`، ويحدّ
 * بمئة صفّ. الكاتب والوسم وحالة SEO ليست فلاتر خادم، فتُطبَّق هنا على المجموعة
 * المُعادة ويُعلَن ذلك — تمرير فلتر إلى مسار يتجاهله يجعل المحرِّر يظن نتيجته
 * مصفّاة وهي ليست.
 */

const copy = {
  ar: {
    eyebrow: 'المدوّنة',
    title: 'المقالات',
    lede: 'المقال بلغة واحدة هو صفّ واحد. الجسم كتل مهيكلة يتحقّق منها الخادم، لا HTML حرّ.',
    search: 'بحث في العنوان أو الاختصار…',
    note: 'اللغة والحالة والتصنيف والبحث تُرسَل إلى الخادم؛ الكاتب وحالة SEO يُفلتران في المتصفح على أول ١٠٠ صفّ.',
    create: 'مقال جديد',
    titleCol: 'العنوان',
    language: 'اللغة',
    status: 'الحالة',
    author: 'الكاتب',
    category: 'التصنيف',
    seo: 'SEO',
    variants: 'نسخ لغوية',
    scheduled: 'موعد النشر',
    updated: 'آخر تحديث',
    path: 'المسار',
    religious: 'محتوى ديني',
    open: 'تحرير',
    quick: 'عرض سريع',
    empty: 'لا مقالات مطابقة',
    emptyHint: 'غيّر البحث أو الفلاتر، أو أنشئ مقالًا.',
    loadError: 'تعذر تحميل المقالات',
    allLanguages: 'كل اللغات',
    allStatuses: 'كل الحالات',
    allCategories: 'كل التصنيفات',
    allAuthors: 'كل الكُتّاب',
    hasSeo: 'له SEO',
    noSeo: 'بلا SEO',
    yes: 'نعم',
    no: 'لا',
    createTitle: 'مقال جديد',
    createHint: 'الاختصار لاتيني دائمًا حتى للمقال العربي: رابط عربي مُرمَّز غير قابل للقراءة ولا للإملاء. المقال يُنشأ مسوّدة.',
    titleField: 'العنوان',
    slugField: 'الاختصار (لاتيني)',
    languageField: 'اللغة',
    categoryField: 'التصنيف',
    authorField: 'الكاتب',
    groupField: 'مجموعة الترجمة',
    groupHint: 'اتركها فارغة لمقال جديد؛ املأها بمجموعة مقال قائم لإنشاء ترجمة له.',
    submit: 'إنشاء',
    creating: 'جارٍ الإنشاء…',
    cancel: 'إلغاء',
    words: 'كلمة',
    readiness: 'جاهزية النشر',
    noBlockers: 'لا عوائق.',
    openFull: 'فتح المحرِّر',
    quickHint: 'قراءة سريعة. التحرير في الصفحة الكاملة.',
    loading: 'جارٍ التحميل…',
    calendarEmpty: 'لا مقالات مجدولة أو منشورة في هذا الشهر.',
    taxonomy: 'التصنيفات والكُتّاب',
    none: '—',
  },
  en: {
    eyebrow: 'Blog',
    title: 'Posts',
    lede: 'A post in one language is one row. The body is validated structured blocks, not free HTML.',
    search: 'Search title or slug…',
    note: 'Language, status, category and search are sent to the server; author and SEO state are filtered in the browser over the first 100 rows.',
    create: 'New post',
    titleCol: 'Title',
    language: 'Language',
    status: 'Status',
    author: 'Author',
    category: 'Category',
    seo: 'SEO',
    variants: 'Language variants',
    scheduled: 'Scheduled for',
    updated: 'Updated',
    path: 'Path',
    religious: 'Religious content',
    open: 'Edit',
    quick: 'Quick view',
    empty: 'No matching posts',
    emptyHint: 'Change the search or filters, or create a post.',
    loadError: 'Unable to load posts',
    allLanguages: 'All languages',
    allStatuses: 'All statuses',
    allCategories: 'All categories',
    allAuthors: 'All authors',
    hasSeo: 'Has SEO',
    noSeo: 'No SEO',
    yes: 'Yes',
    no: 'No',
    createTitle: 'New post',
    createHint: 'The slug is always latin, even for an Arabic post: a percent-encoded Arabic URL cannot be read or dictated. The post is created as a draft.',
    titleField: 'Title',
    slugField: 'Slug (latin)',
    languageField: 'Language',
    categoryField: 'Category',
    authorField: 'Author',
    groupField: 'Translation group',
    groupHint: 'Leave empty for a new post; set it to an existing post group to create a translation.',
    submit: 'Create',
    creating: 'Creating…',
    cancel: 'Cancel',
    words: 'words',
    readiness: 'Publish readiness',
    noBlockers: 'No blockers.',
    openFull: 'Open editor',
    quickHint: 'A quick read. Editing happens on the full page.',
    loading: 'Loading…',
    calendarEmpty: 'No posts scheduled or published this month.',
    taxonomy: 'Categories and authors',
    none: '—',
  },
}

const LANGUAGES: CmsLanguage[] = ['ar', 'en', 'fr']
const STATUSES = ['draft', 'review', 'scheduled', 'published', 'archived']
const LIMIT = 25
const DEFAULT_FILTERS = { language: '', status: '', category_id: '', author: '', seo: '' }

const COLUMNS: ColumnDefinition[] = [
  { key: 'titleCol', label: 'titleCol', locked: true },
  { key: 'language', label: 'language' },
  { key: 'status', label: 'status' },
  { key: 'author', label: 'author' },
  { key: 'category', label: 'category' },
  { key: 'seo', label: 'seo' },
  { key: 'variants', label: 'variants' },
  { key: 'scheduled', label: 'scheduled' },
  { key: 'updated', label: 'updated' },
]

const statusTone: Record<string, string> = {
  published: 'active', scheduled: 'pending', review: 'pending', draft: 'draft', archived: 'archived',
}

export function BlogPostsPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()

  const state = useUrlListState(DEFAULT_FILTERS, { limit: LIMIT, defaultView: 'table' })
  const [rows, setRows] = useState<BlogPostListRow[]>([])
  const [taxonomy, setTaxonomy] = useState<BlogTaxonomy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  // ‏?new=1 من لوحة الأوامر يفتح حوار الإنشاء نفسه.
  useQuickCreate(() => setCreating(true))

  const [quickId, setQuickId] = useState<string | null>(null)
  const [quick, setQuick] = useState<BlogPostDetail | null>(null)
  const [quickLoading, setQuickLoading] = useState(false)

  const columns = useColumnPreferences('blog-posts', COLUMNS)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [posts, tax] = await Promise.all([
        api.blogPosts({
          language: state.filters.language || undefined,
          status: state.filters.status || undefined,
          category_id: state.filters.category_id || undefined,
          q: state.query.trim() || undefined,
        }),
        api.blogTaxonomy(),
      ])
      setRows(posts.data)
      setTaxonomy(tax.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [state.filters.category_id, state.filters.language, state.filters.status, state.query, text.loadError])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, state.query ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [load, state.query])

  useEffect(() => {
    if (!quickId) { setQuick(null); return }
    let cancelled = false
    setQuickLoading(true)
    void api.blogPost(quickId)
      .then((response) => { if (!cancelled) setQuick(response.data) })
      .catch(() => { if (!cancelled) setQuick(null) })
      .finally(() => { if (!cancelled) setQuickLoading(false) })
    return () => { cancelled = true }
  }, [quickId])

  const filtered = useMemo(() => rows.filter((row) => {
    if (state.filters.author && row.author_name !== state.filters.author) return false
    if (state.filters.seo === '1' && row.has_seo === 0) return false
    if (state.filters.seo === '0' && row.has_seo > 0) return false
    return true
  }), [rows, state.filters.author, state.filters.seo])

  const paged = useMemo(() => filtered.slice(state.offset, state.offset + LIMIT), [filtered, state.offset])

  const filterFields: FilterField[] = [
    { key: 'language', label: text.language, type: 'select', options: [{ value: '', label: text.allLanguages }, ...LANGUAGES.map((item) => ({ value: item, label: item }))] },
    { key: 'status', label: text.status, type: 'select', options: [{ value: '', label: text.allStatuses }, ...STATUSES.map((item) => ({ value: item, label: item }))] },
    {
      key: 'category_id',
      label: text.category,
      type: 'select',
      options: [{ value: '', label: text.allCategories }, ...(taxonomy?.categories ?? []).map((category) => ({ value: category.id, label: `${category.name} (${category.language})` }))],
      chip: (value) => `${text.category}: ${taxonomy?.categories.find((category) => category.id === value)?.name ?? value}`,
    },
    {
      key: 'author',
      label: text.author,
      type: 'select',
      options: [{ value: '', label: text.allAuthors }, ...(taxonomy?.authors ?? []).map((author) => ({ value: author.display_name, label: author.display_name }))],
    },
    {
      key: 'seo',
      label: text.seo,
      type: 'select',
      options: [{ value: '', label: text.allStatuses }, { value: '1', label: text.hasSeo }, { value: '0', label: text.noSeo }],
    },
  ]

  const calendarItems: CalendarItem[] = filtered
    .filter((row) => row.scheduled_at || row.published_at)
    .map((row) => ({
      id: row.id,
      at: (row.scheduled_at ?? row.published_at) as string,
      label: `${row.language} · ${row.title}`,
      tone: row.status === 'published' ? 'published' : 'scheduled',
      onOpen: () => navigate(adminPath(`blog/posts/${row.id}`)),
    }))

  const view = state.view as ViewMode | 'calendar'

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
            <p className="panel__note">{text.note}</p>
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
                  storageKey="blog-posts"
                  currentSearch={state.search}
                  onApply={(search) => navigate({ pathname: adminPath('blog/posts'), search })}
                />
                <ColumnManager
                  columns={COLUMNS.map((column) => ({ ...column, label: text[column.label as keyof typeof text] as string }))}
                  hidden={columns.hidden}
                  onToggle={columns.toggle}
                  onReset={columns.reset}
                />
                <div className="view-switcher-group">
                  <ViewSwitcher
                    value={(view === 'calendar' ? 'table' : view) as ViewMode}
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
        ) : view === 'cards' ? (
          <>
            <ul className="card-grid">
              {paged.map((row) => (
                <li className="entity-card entity-card--media" key={row.id}>
                  <MediaThumb assetId={row.hero_asset_id} size={140} alt={row.title} />
                  <header>
                    <span className={`account-status account-status--${statusTone[row.status] ?? 'draft'}`}>{row.status}</span>
                    <span className="entity-card__lang" dir="ltr">{row.language}</span>
                  </header>
                  <h4>{row.title}</h4>
                  <code dir="ltr">{row.path}</code>
                  <dl>
                    <div><dt>{text.author}</dt><dd>{row.author_name ?? text.none}</dd></div>
                    <div><dt>{text.category}</dt><dd>{row.category_name ?? text.none}</dd></div>
                    <div><dt>{text.seo}</dt><dd>{row.has_seo ? text.yes : text.no}</dd></div>
                  </dl>
                  <footer>
                    <Link className="button button--ghost button--small" to={adminPath(`blog/posts/${row.id}`)}>{text.open}</Link>
                    <button className="button button--ghost button--small" type="button" onClick={() => setQuickId(row.id)}>{text.quick}</button>
                  </footer>
                </li>
              ))}
            </ul>
            <Pagination total={filtered.length} limit={LIMIT} offset={state.offset} onOffsetChange={state.setOffset} locale={locale} />
          </>
        ) : (
          <>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{text.titleCol}</th>
                    {columns.isVisible('language') && <th>{text.language}</th>}
                    {columns.isVisible('status') && <th>{text.status}</th>}
                    {columns.isVisible('author') && <th>{text.author}</th>}
                    {columns.isVisible('category') && <th>{text.category}</th>}
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
                      <td>
                        <Link className="entity-cell entity-cell--button" to={adminPath(`blog/posts/${row.id}`)}>
                          <MediaThumb assetId={row.hero_asset_id} size={36} alt={row.title} />
                          <div>
                            <strong>{row.title}</strong>
                            <small dir="ltr">{row.path}</small>
                          </div>
                        </Link>
                      </td>
                      {columns.isVisible('language') && <td dir="ltr">{row.language}</td>}
                      {columns.isVisible('status') && (
                        <td><span className={`account-status account-status--${statusTone[row.status] ?? 'draft'}`}>{row.status}</span></td>
                      )}
                      {columns.isVisible('author') && (
                        <td>{row.author_name ?? <span className="readiness-item readiness-item--blocked readiness-pill">{text.none}</span>}</td>
                      )}
                      {columns.isVisible('category') && <td>{row.category_name ?? text.none}</td>}
                      {columns.isVisible('seo') && (
                        <td>{row.has_seo ? <span className="field__ok">{text.yes}</span> : <span className="readiness-item readiness-item--warn readiness-pill">{text.no}</span>}</td>
                      )}
                      {columns.isVisible('variants') && <td>{row.language_variants}</td>}
                      {columns.isVisible('scheduled') && <td dir="ltr">{row.scheduled_at ?? '—'}</td>}
                      {columns.isVisible('updated') && <td dir="ltr">{row.updated_at}</td>}
                      <td className="table-actions">
                        <button className="button button--ghost button--small" type="button" onClick={() => setQuickId(row.id)}>{text.quick}</button>
                        <Link className="button button--ghost button--small" to={adminPath(`blog/posts/${row.id}`)}>{text.open}</Link>
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

      <QuickView
        open={!!quickId}
        title={quick?.post.title ?? text.quick}
        subtitle={text.quickHint}
        onClose={() => setQuickId(null)}
        footer={quickId ? <Link className="button button--primary" to={adminPath(`blog/posts/${quickId}`)}>{text.openFull}</Link> : null}
      >
        {quickLoading ? <p className="data-unavailable">{text.loading}</p> : quick ? (
          <div className="entity-form">
            <MediaThumb assetId={quick.post.hero_asset_id} size={160} alt={quick.post.title} />
            <ul className="kv-list">
              <li><span>{text.path}</span><code dir="ltr">{quick.post.path}</code></li>
              <li><span>{text.language}</span><span dir="ltr">{quick.post.language}</span></li>
              <li><span>{text.status}</span><span>{quick.post.status}</span></li>
              <li><span>{text.words}</span><span>{quick.word_count}</span></li>
              <li><span>{text.religious}</span><span>{quick.is_religious ? text.yes : text.no}</span></li>
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

      <CreatePostDialog
        open={creating}
        taxonomy={taxonomy}
        onClose={() => setCreating(false)}
        onCreated={(id) => navigate(adminPath(`blog/posts/${id}`))}
      />
    </div>
  )
}

function CreatePostDialog({
  open,
  taxonomy,
  onClose,
  onCreated,
}: {
  open: boolean
  taxonomy: BlogTaxonomy | null
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [form, setForm] = useState({ title: '', slug: '', language: 'ar' as CmsLanguage, category_id: '', author_id: '', translation_group: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const response = await api.createBlogPost({
        title: form.title.trim(),
        slug: form.slug.trim(),
        language: form.language,
        category_id: form.category_id || undefined,
        author_id: form.author_id || undefined,
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

  const categories = (taxonomy?.categories ?? []).filter((category) => category.language === form.language)

  return (
    <Modal open={open} title={text.createTitle} description={text.createHint} onClose={onClose}>
      <div className="entity-form">
        <label className="field">
          <span>{text.titleField} *</span>
          <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
        </label>
        <label className="field">
          <span>{text.slugField} *</span>
          <input dir="ltr" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
        </label>
        <div className="field-row">
          <label className="field">
            <span>{text.languageField}</span>
            <select value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value as CmsLanguage, category_id: '' })}>
              {LANGUAGES.map((language) => <option value={language} key={language}>{language}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{text.categoryField}</span>
            <select value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}>
              <option value="">{text.none}</option>
              {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>{text.authorField}</span>
          <select value={form.author_id} onChange={(event) => setForm({ ...form, author_id: event.target.value })}>
            <option value="">{text.none}</option>
            {(taxonomy?.authors ?? []).map((author) => <option value={author.id} key={author.id}>{author.display_name}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{text.groupField}</span>
          <input dir="ltr" value={form.translation_group} onChange={(event) => setForm({ ...form, translation_group: event.target.value })} />
          <small>{text.groupHint}</small>
        </label>
        {error && <p className="field__error" role="alert">{error}</p>}
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            disabled={busy || !form.title.trim() || !form.slug.trim()}
            onClick={() => void submit()}
          >{busy ? text.creating : text.submit}</button>
          <button className="button button--ghost" type="button" onClick={onClose}>{text.cancel}</button>
        </div>
      </div>
    </Modal>
  )
}
