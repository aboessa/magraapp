import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { DetailTabs } from '../components/DetailTabs'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { SavedViewsMenu } from '../components/ListTools'
import { useUrlListState } from '../hooks/useUrlListState'
import { usePreferences } from '../context/preferences'
import type { SeoAudit, SeoIssue, WebRedirect } from '../types/api'

/**
 * عمليّات SEO: التدقيق الداخلي، حالة الخريطة، التحويلات.
 *
 * ## الفصل الذي بُنيت هذه الشاشة حوله
 *
 * التدقيق الداخلي يُثبت ما في قاعدة البيانات: عنوان ناقص، عنوانان متطابقان،
 * رابط معياري يشير إلى لا شيء، مجموعة hreflang ناقصة. حالة الفهرسة الفعلية في
 * محرّكات البحث **ليست** معروفة — لا تكامل مع Search Console. الخادم يقول ذلك في
 * جسمه (`index_status_available: false`) وهذه الشاشة تعرضه في مساحة مستقلّة
 * ومُعلَّمة، لأن «صفر أخطاء» في لوحة موحّدة ستُقرأ كـ«الموقع مفهرس» — وهي جملة لا
 * أحد هنا يستطيع قولها.
 *
 * ## الفحوص غير المُنفَّذة معروضة بالاسم
 *
 * قائمة `coverage` من الخادم تُعرض كما هي، بما فيها ما لم يُنفَّذ وسببه. شاشة تُخفي
 * الفحص غير المُجرى تُنتج ثقة لا سند لها.
 */

const copy = {
  ar: {
    eyebrow: 'SEO',
    title: 'عمليّات SEO',
    lede: 'تدقيق داخلي على قاعدة البيانات. ليس تقريرًا عن فهرسة محرّكات البحث.',
    tabIssues: 'المشاكل',
    tabCoverage: 'تغطية الفحوص',
    tabSitemap: 'خريطة الموقع',
    tabRedirects: 'التحويلات',
    tabIndex: 'الفهرسة الخارجية',
    refresh: 'إعادة التدقيق',
    errors: 'أخطاء',
    warnings: 'تحذيرات',
    auditedPages: 'صفحات مُدقَّقة',
    auditedPosts: 'مقالات مُدقَّقة',
    redirects: 'تحويلات',
    onlyPublished: 'يُدقَّق المنشور فقط: مسوّدة بلا وصف ليست عيبًا، وعرضها يُغرق المشاكل الحقيقية.',
    check: 'الفحص',
    severity: 'الخطورة',
    entity: 'الكيان',
    path: 'المسار',
    detail: 'التفصيل',
    open: 'فتح',
    allChecks: 'كل الفحوص',
    allSeverities: 'كل الدرجات',
    allTypes: 'كل الأنواع',
    error: 'خطأ',
    warning: 'تحذير',
    search: 'بحث في المسار أو التفصيل…',
    empty: 'لا مشاكل مطابقة',
    emptyHint: 'إمّا لا مشكلة في هذا الفحص، أو الفلاتر تستبعدها.',
    clean: 'لا مشاكل في التدقيق الداخلي',
    cleanHint: 'هذا يعني أن قاعدة البيانات نظيفة وفق الفحوص المُنفَّذة أدناه. لا يعني أن الموقع مفهرس.',
    loadError: 'تعذر تحميل التدقيق',
    coverageTitle: 'ما يُفحَص وما لا يُفحَص',
    coverageHint: 'قائمة معلنة من الخادم. الفحص غير المُنفَّذ مذكور بسببه لا مخفيًّا.',
    implemented: 'مُنفَّذ',
    notImplemented: 'غير مُنفَّذ',
    sitemapTitle: 'حالة خريطة الموقع',
    generatedOnRequest: 'تُولَّد عند كل طلب من قاعدة البيانات؛ لا ملف مخزَّن يمكن أن يتقادم.',
    includedUrls: 'عناوين مُدرَجة',
    excludedUnpublished: 'مستثناة (غير منشورة)',
    noindexPublished: 'منشورة ومعلَّمة noindex',
    redirectsTitle: 'التحويلات',
    from: 'من',
    to: 'إلى',
    code: 'الرمز',
    reason: 'السبب',
    createdBy: 'أنشأها',
    createdAt: 'التاريخ',
    addRedirect: 'تحويل جديد',
    deleteRedirect: 'حذف التحويل',
    redirectHint: 'التحويل إلى نفسه مرفوض، والتحويل فوق مسار تخدمه صفحة منشورة مرفوض: كلاهما يُسقط الصفحة بدل نقلها.',
    redirectsEmpty: 'لا تحويلات.',
    submit: 'إنشاء',
    cancel: 'إلغاء',
    creating: 'جارٍ الإنشاء…',
    deleteConfirm: 'حذف هذا التحويل؟ الروابط القديمة ستعود إلى 404.',
    delete: 'حذف',
    indexTitle: 'حالة الفهرسة في محرّكات البحث',
    indexUnavailable: 'غير متاحة',
    indexWhat: 'ما تحتاجه هذه الشاشة لتقول شيئًا عن الفهرسة',
    indexNeeds: [
      'تكامل مع Google Search Console أو ما يعادله (Bing Webmaster).',
      'بيانات اعتماد مخزَّنة كسرّ في العامل، لا في الواجهة.',
      'مزامنة دورية تحفظ آخر حالة معروفة لكل عنوان.',
    ],
    indexWhy: 'حتى ذلك الحين لا يُعرض هنا رقم واحد: عدّاد فهرسة مُختلق يُبنى عليه قرار تسويقي.',
  },
  en: {
    eyebrow: 'SEO',
    title: 'SEO operations',
    lede: 'An internal audit over the database. Not a report about search-engine indexing.',
    tabIssues: 'Issues',
    tabCoverage: 'Check coverage',
    tabSitemap: 'Sitemap',
    tabRedirects: 'Redirects',
    tabIndex: 'External indexing',
    refresh: 'Re-run audit',
    errors: 'Errors',
    warnings: 'Warnings',
    auditedPages: 'Pages audited',
    auditedPosts: 'Posts audited',
    redirects: 'Redirects',
    onlyPublished: 'Only published entities are audited: a draft with no description is not a defect, and reporting it buries the real issues.',
    check: 'Check',
    severity: 'Severity',
    entity: 'Entity',
    path: 'Path',
    detail: 'Detail',
    open: 'Open',
    allChecks: 'All checks',
    allSeverities: 'All severities',
    allTypes: 'All types',
    error: 'Error',
    warning: 'Warning',
    search: 'Search path or detail…',
    empty: 'No matching issues',
    emptyHint: 'Either this check found nothing, or the filters exclude it.',
    clean: 'No issues in the internal audit',
    cleanHint: 'This means the database is clean against the implemented checks below. It does not mean the site is indexed.',
    loadError: 'Unable to load the audit',
    coverageTitle: 'What is checked and what is not',
    coverageHint: 'Declared by the server. An unimplemented check is named with its reason rather than hidden.',
    implemented: 'Implemented',
    notImplemented: 'Not implemented',
    sitemapTitle: 'Sitemap state',
    generatedOnRequest: 'Generated per request from the database; there is no stored file that can go stale.',
    includedUrls: 'URLs included',
    excludedUnpublished: 'Excluded (unpublished)',
    noindexPublished: 'Published and marked noindex',
    redirectsTitle: 'Redirects',
    from: 'From',
    to: 'To',
    code: 'Code',
    reason: 'Reason',
    createdBy: 'Created by',
    createdAt: 'Created',
    addRedirect: 'New redirect',
    deleteRedirect: 'Delete redirect',
    redirectHint: 'A redirect to itself is refused, and a redirect over a path a published page serves is refused: both take the page down instead of moving it.',
    redirectsEmpty: 'No redirects.',
    submit: 'Create',
    cancel: 'Cancel',
    creating: 'Creating…',
    deleteConfirm: 'Delete this redirect? The old links go back to a 404.',
    delete: 'Delete',
    indexTitle: 'Search-engine index status',
    indexUnavailable: 'Unavailable',
    indexWhat: 'What this screen needs before it can say anything about indexing',
    indexNeeds: [
      'An integration with Google Search Console or an equivalent (Bing Webmaster).',
      'Credentials stored as a worker secret, not in the front end.',
      'A periodic sync storing the last known status per URL.',
    ],
    indexWhy: 'Until then, not one number is shown here: an invented index count is one a marketing decision gets built on.',
  },
}

const DEFAULT_FILTERS = { check: '', severity: '', entity_type: '' }

const entityRoute = (issue: SeoIssue): string | null => {
  if (issue.entity_type === 'web_page') return adminPath(`website/pages/${issue.entity_id}`)
  if (issue.entity_type === 'blog_post') return adminPath(`blog/posts/${issue.entity_id}`)
  return null
}

export function SeoOperationsPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const navigate = useNavigate()

  const state = useUrlListState(DEFAULT_FILTERS, { limit: 100 })
  const [audit, setAudit] = useState<SeoAudit | null>(null)
  const [redirects, setRedirects] = useState<WebRedirect[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [creatingRedirect, setCreatingRedirect] = useState(false)
  const [deleting, setDeleting] = useState<WebRedirect | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [auditResponse, redirectResponse] = await Promise.all([api.seoAudit(), api.seoRedirects()])
      setAudit(auditResponse.data)
      setRedirects(redirectResponse.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  const checkIds = useMemo(
    () => [...new Set((audit?.issues ?? []).map((issue) => issue.id))].sort(),
    [audit?.issues],
  )

  const grouped = useMemo(() => {
    const map = new Map<string, SeoIssue[]>()
    for (const issue of audit?.issues ?? []) map.set(issue.id, [...(map.get(issue.id) ?? []), issue])
    return [...map.entries()].sort((left, right) => right[1].length - left[1].length)
  }, [audit?.issues])

  const filteredIssues = useMemo(() => {
    const term = state.query.trim().toLowerCase()
    return (audit?.issues ?? []).filter((issue) => {
      if (state.filters.check && issue.id !== state.filters.check) return false
      if (state.filters.severity && issue.severity !== state.filters.severity) return false
      if (state.filters.entity_type && issue.entity_type !== state.filters.entity_type) return false
      if (!term) return true
      return (issue.path ?? '').toLowerCase().includes(term) || issue.detail.toLowerCase().includes(term)
    })
  }, [audit?.issues, state.filters, state.query])

  const filterFields: FilterField[] = [
    {
      key: 'check',
      label: text.check,
      type: 'select',
      options: [{ value: '', label: text.allChecks }, ...checkIds.map((id) => ({ value: id, label: id }))],
    },
    {
      key: 'severity',
      label: text.severity,
      type: 'select',
      options: [
        { value: '', label: text.allSeverities },
        { value: 'error', label: text.error },
        { value: 'warning', label: text.warning },
      ],
    },
    {
      key: 'entity_type',
      label: text.entity,
      type: 'select',
      options: [
        { value: '', label: text.allTypes },
        { value: 'web_page', label: 'web_page' },
        { value: 'blog_post', label: 'blog_post' },
        { value: 'web_redirect', label: 'web_redirect' },
      ],
    },
  ]

  if (loading && !audit) return <LoadingState />
  if (error && !audit) return <ErrorState message={error} onRetry={() => void load()} />
  if (!audit) return null

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => void load()}>
          <Icon name="refresh" size={15} />{text.refresh}
        </button>
      </section>

      <section className="stat-row">
        <div className="stat-card stat-card--danger"><span>{text.errors}</span><strong>{audit.summary.errors}</strong></div>
        <div className="stat-card stat-card--warn"><span>{text.warnings}</span><strong>{audit.summary.warnings}</strong></div>
        <div className="stat-card"><span>{text.auditedPages}</span><strong>{audit.summary.audited_pages}</strong></div>
        <div className="stat-card"><span>{text.auditedPosts}</span><strong>{audit.summary.audited_posts}</strong></div>
        <div className="stat-card"><span>{text.redirects}</span><strong>{audit.summary.redirects}</strong></div>
      </section>

      <p className="panel panel--notice">
        <Icon name="warning" size={15} />
        <strong>{audit.source}</strong> — {audit.index_status_note}
      </p>

      <DetailTabs
        tabs={[
          {
            key: 'issues',
            label: text.tabIssues,
            badge: audit.issues.length,
            content: (
              <div className="page-stack">
                <section className="panel">
                  <div className="panel__header"><div><h3>{text.tabIssues}</h3><p>{text.onlyPublished}</p></div></div>
                  <div className="panel__body">
                    <ul className="issue-summary">
                      {grouped.map(([id, issues]) => (
                        <li key={id}>
                          <button
                            type="button"
                            className={`issue-summary__chip issue-summary__chip--${issues[0].severity} ${state.filters.check === id ? 'issue-summary__chip--active' : ''}`}
                            onClick={() => state.setFilter('check', state.filters.check === id ? '' : id)}
                          >
                            <span>{id}</span><strong>{issues.length}</strong>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </section>

                <section className="panel panel--table">
                  <header className="panel__header panel__header--filters">
                    <div><h3>{text.tabIssues} <span className="title-count">{filteredIssues.length}</span></h3></div>
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
                        <SavedViewsMenu
                          storageKey="seo-operations"
                          currentSearch={state.search}
                          onApply={(search) => navigate({ pathname: adminPath('seo'), search })}
                        />
                      }
                    />
                  </header>

                  {audit.issues.length === 0 ? (
                    <EmptyState title={text.clean} description={text.cleanHint} />
                  ) : filteredIssues.length === 0 ? (
                    <EmptyState title={text.empty} description={text.emptyHint} />
                  ) : (
                    <div className="table-scroll" tabIndex={0}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>{text.check}</th><th>{text.severity}</th><th>{text.entity}</th>
                            <th>{text.path}</th><th>{text.detail}</th><th />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredIssues.map((issue, index) => {
                            const route = entityRoute(issue)
                            return (
                              <tr key={`${issue.id}-${issue.entity_id}-${index}`}>
                                <td><code dir="ltr">{issue.id}</code></td>
                                <td>
                                  <span className={`readiness-item readiness-item--${issue.severity === 'error' ? 'blocked' : 'warn'} readiness-pill`}>
                                    {issue.severity === 'error' ? text.error : text.warning}
                                  </span>
                                </td>
                                <td dir="ltr">{issue.entity_type}</td>
                                <td><code dir="ltr">{issue.path ?? '—'}</code></td>
                                <td>{issue.detail}</td>
                                <td className="table-actions">
                                  {route && <Link className="button button--ghost button--small" to={route}>{text.open}</Link>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            ),
          },
          {
            key: 'coverage',
            label: text.tabCoverage,
            badge: audit.coverage.filter((entry) => !entry.implemented).length,
            content: (
              <section className="panel">
                <div className="panel__header"><div><h3>{text.coverageTitle}</h3><p>{text.coverageHint}</p></div></div>
                <div className="table-scroll" tabIndex={0}>
                  <table className="data-table">
                    <thead><tr><th>{text.check}</th><th>{text.severity}</th><th>{text.detail}</th></tr></thead>
                    <tbody>
                      {audit.coverage.map((entry) => (
                        <tr key={entry.id}>
                          <td><code dir="ltr">{entry.id}</code></td>
                          <td>
                            <span className={entry.implemented ? 'field__ok' : 'readiness-item readiness-item--blocked readiness-pill'}>
                              {entry.implemented ? text.implemented : text.notImplemented}
                            </span>
                          </td>
                          <td>{entry.note ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ),
          },
          {
            key: 'sitemap',
            label: text.tabSitemap,
            content: (
              <section className="panel">
                <div className="panel__header"><div><h3>{text.sitemapTitle}</h3><p>{text.generatedOnRequest}</p></div></div>
                <div className="entity-form">
                  <ul className="kv-list">
                    <li><span>{text.includedUrls}</span><strong>{audit.sitemap.included_urls}</strong></li>
                    <li><span>{text.excludedUnpublished}</span><strong>{audit.sitemap.excluded_unpublished}</strong></li>
                    <li><span>{text.noindexPublished}</span><strong>{audit.sitemap.noindex_published}</strong></li>
                  </ul>
                </div>
              </section>
            ),
          },
          {
            key: 'redirects',
            label: text.tabRedirects,
            badge: redirects.length,
            content: (
              <section className="panel panel--table">
                <header className="panel__header panel__header--filters">
                  <div><h3>{text.redirectsTitle}</h3><p>{text.redirectHint}</p></div>
                  <button className="button button--primary" type="button" onClick={() => setCreatingRedirect(true)}>
                    <Icon name="plus" size={15} />{text.addRedirect}
                  </button>
                </header>
                {redirects.length ? (
                  <div className="table-scroll" tabIndex={0}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>{text.from}</th><th>{text.to}</th><th>{text.code}</th>
                          <th>{text.reason}</th><th>{text.createdBy}</th><th>{text.createdAt}</th><th />
                        </tr>
                      </thead>
                      <tbody>
                        {redirects.map((redirect) => (
                          <tr key={redirect.id}>
                            <td><code dir="ltr">{redirect.from_path}</code></td>
                            <td><code dir="ltr">{redirect.to_path}</code></td>
                            <td dir="ltr">{redirect.status_code}</td>
                            <td>{redirect.reason ?? '—'}</td>
                            <td>{redirect.created_by_name ?? '—'}</td>
                            <td dir="ltr">{redirect.created_at}</td>
                            <td className="table-actions">
                              <button
                                className="button button--ghost button--small"
                                type="button"
                                onClick={() => setDeleting(redirect)}
                              >{text.delete}</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <EmptyState title={text.redirectsEmpty} description={text.redirectHint} />}
              </section>
            ),
          },
          {
            key: 'index',
            label: text.tabIndex,
            content: (
              <section className="panel panel--notice">
                <h3>{text.indexTitle}: <strong>{text.indexUnavailable}</strong></h3>
                <p>{audit.index_status_note}</p>
                <h4>{text.indexWhat}</h4>
                <ul className="planned-list">{text.indexNeeds.map((need) => <li key={need}>{need}</li>)}</ul>
                <p>{text.indexWhy}</p>
              </section>
            ),
          },
        ]}
      />

      <CreateRedirectDialog
        open={creatingRedirect}
        onClose={() => setCreatingRedirect(false)}
        onCreated={() => { setCreatingRedirect(false); void load() }}
      />

      <Modal open={!!deleting} title={text.deleteRedirect} description={text.deleteConfirm} onClose={() => setDeleting(null)}>
        <div className="form-actions">
          <button
            className="button button--danger"
            type="button"
            onClick={() => {
              if (!deleting) return
              void api.deleteSeoRedirect(deleting.id).then(() => { setDeleting(null); void load() }).catch(() => setDeleting(null))
            }}
          >{text.delete}</button>
          <button className="button button--ghost" type="button" onClick={() => setDeleting(null)}>{text.cancel}</button>
        </div>
      </Modal>
    </div>
  )
}

function CreateRedirectDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [form, setForm] = useState({ from_path: '', to_path: '', status_code: 301, reason: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      await api.createSeoRedirect({
        from_path: form.from_path.trim(),
        to_path: form.to_path.trim(),
        status_code: form.status_code,
        reason: form.reason.trim() || undefined,
      })
      onCreated()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={text.addRedirect} description={text.redirectHint} onClose={onClose}>
      <div className="entity-form">
        <label className="field">
          <span>{text.from} *</span>
          <input dir="ltr" value={form.from_path} onChange={(event) => setForm({ ...form, from_path: event.target.value })} placeholder="/ar/old-path" />
        </label>
        <label className="field">
          <span>{text.to} *</span>
          <input dir="ltr" value={form.to_path} onChange={(event) => setForm({ ...form, to_path: event.target.value })} placeholder="/ar/new-path" />
        </label>
        <label className="field">
          <span>{text.code}</span>
          <select value={form.status_code} onChange={(event) => setForm({ ...form, status_code: Number(event.target.value) })}>
            <option value={301}>301</option>
            <option value={302}>302</option>
            <option value={308}>308</option>
          </select>
        </label>
        <label className="field">
          <span>{text.reason}</span>
          <input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} />
        </label>
        {error && <p className="field__error" role="alert">{error}</p>}
        <div className="form-actions">
          <button
            className="button button--primary"
            type="button"
            disabled={busy || !form.from_path.startsWith('/') || !form.to_path.startsWith('/')}
            onClick={() => void submit()}
          >{busy ? text.creating : text.submit}</button>
          <button className="button button--ghost" type="button" onClick={onClose}>{text.cancel}</button>
        </div>
      </div>
    </Modal>
  )
}
