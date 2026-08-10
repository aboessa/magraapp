import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailTabs } from '../components/DetailTabs'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { SectionEditor } from '../components/SectionEditor'
import { SeoEditor } from '../components/SeoEditor'
import { TimelineView } from '../components/DataViews'
import type { TimelineEntry } from '../components/DataViews'
import { usePreferences } from '../context/preferences'
import type { AuditRecord, CmsBlocker, WebPageDetail, WebRedirect, WebSectionDraft, WebSectionType } from '../types/api'

/**
 * مساحة عمل صفحة موقع واحدة.
 *
 * ## لماذا النشر ليس حقلًا في النموذج
 *
 * `PATCH /website/pages/:id` يرفض `status: 'published'` صراحةً، و`POST
 * /publish` هو المسار الوحيد: يقيّم الجاهزية ويردّ 409 بقائمة العوائق. هذه
 * الشاشة تعرض العوائق كما وصلت — كلٌّ منها بسببه — بدل «تعذر النشر». نفس
 * الانفصال المطبَّق على السلاسل والحلقات، لأن وجود انضباطَي نشر في منتج واحد
 * ينتهي دائمًا بأحدهما بلا بوابة.
 *
 * ## الاتجاه من اللغة لا من تفضيل المستخدم
 *
 * محتوى صفحة عربية يُحرَّر بـ`dir="rtl"` حتى لو كانت لوحة الإدارة بالإنجليزية،
 * والعكس. اتجاه المحرِّر يجب أن يطابق اتجاه ما سيراه الزائر، وإلا بدا النصّ
 * سليمًا في الإدارة ومقطوعًا على الموقع.
 */

const copy = {
  ar: {
    breadcrumb: 'صفحات الموقع',
    eyebrow: 'صفحة موقع',
    tabContent: 'الأقسام',
    tabSettings: 'الإعدادات',
    tabSeo: 'SEO',
    tabTranslations: 'اللغات',
    tabRevisions: 'المراجعات',
    tabAudit: 'سجلّ التدقيق',
    tabPreview: 'معاينة',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    saved: 'حُفِظ',
    saveSections: 'حفظ الأقسام',
    publish: 'نشر',
    publishing: 'جارٍ النشر…',
    published: 'منشورة',
    readiness: 'جاهزية النشر',
    noBlockers: 'لا عوائق. الصفحة قابلة للنشر.',
    blockers: 'عوائق تمنع النشر',
    warnings: 'تحذيرات لا تمنع النشر',
    publishBlocked: 'النشر مرفوض',
    title: 'العنوان',
    summary: 'الملخّص',
    slug: 'الاختصار',
    slugRedirect: 'تغيير اختصار صفحة منشورة يُنشئ تحويلًا 301 تلقائيًا من المسار القديم.',
    status: 'الحالة',
    schedule: 'موعد النشر',
    scheduleHint: 'الحالة «مجدولة» تتطلّب موعدًا؛ الخادم يرفض بلا موعد.',
    indexable: 'قابلة للفهرسة',
    path: 'المسار',
    kind: 'النوع',
    language: 'اللغة',
    group: 'مجموعة الترجمة',
    updated: 'آخر تحديث',
    publishedAt: 'نُشِرت في',
    revisions: 'المراجعات',
    revisionsHint: 'تُكتب نسخة كاملة قبل كل تعديل، فالمراجعة تحمل ما كان على وشك أن يُفقد.',
    rollback: 'استرجاع',
    rollbackTitle: 'استرجاع مراجعة',
    rollbackHint: 'يُسترجَع المحتوى والأقسام فقط. الحالة والمسار لا يُسترجعان: الاسترجاع لا يجب أن ينشر صفحة أوقفها أحد ولا أن يوقف صفحة حيّة.',
    rollbackConfirm: 'استرجاع النسخة',
    cancel: 'إلغاء',
    revisionsEmpty: 'لا مراجعات بعد.',
    auditEmpty: 'لا سجلّ تدقيق لهذه الصفحة.',
    auditHint: 'من audit_logs مُفلترًا على هذه الصفحة. الحفظ التلقائي لا يُكتب هنا بقصد.',
    translations: 'النسخ اللغوية',
    translationsHint: 'النسخ المنشورة فقط تُدرَج في hreflang. أنشئ نسخة جديدة من قائمة الصفحات بالمفتاح نفسه ومجموعة الترجمة نفسها.',
    translationsEmpty: 'لا نسخ لغوية أخرى.',
    openTranslation: 'فتح',
    previewTitle: 'معاينة البنية',
    previewHint: 'معاينة داخلية للبنية والنصّ باتجاه لغة الصفحة. ليست عرضًا نهائيًا: العارض العام هو من يرسم التصميم.',
    previewInactive: 'قسم مُعطَّل — لا يظهر للزوّار',
    loadError: 'تعذر تحميل الصفحة',
    notFound: 'الصفحة غير موجودة',
    unsaved: 'تعديلات غير محفوظة',
    sectionCount: 'أقسام',
    activeCount: 'مُفعَّلة',
    publicPath: 'المسار العام',
  },
  en: {
    breadcrumb: 'Website pages',
    eyebrow: 'Website page',
    tabContent: 'Sections',
    tabSettings: 'Settings',
    tabSeo: 'SEO',
    tabTranslations: 'Languages',
    tabRevisions: 'Revisions',
    tabAudit: 'Audit log',
    tabPreview: 'Preview',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    saveSections: 'Save sections',
    publish: 'Publish',
    publishing: 'Publishing…',
    published: 'Published',
    readiness: 'Publish readiness',
    noBlockers: 'No blockers. The page can be published.',
    blockers: 'Blockers preventing publication',
    warnings: 'Warnings that do not block publication',
    publishBlocked: 'Publish refused',
    title: 'Title',
    summary: 'Summary',
    slug: 'Slug',
    slugRedirect: 'Changing the slug of a published page creates a 301 redirect from the old path automatically.',
    status: 'Status',
    schedule: 'Scheduled for',
    scheduleHint: 'The scheduled status requires a time; the server refuses without one.',
    indexable: 'Indexable',
    path: 'Path',
    kind: 'Kind',
    language: 'Language',
    group: 'Translation group',
    updated: 'Updated',
    publishedAt: 'Published at',
    revisions: 'Revisions',
    revisionsHint: 'A full snapshot is written before every change, so a revision holds what was about to be lost.',
    rollback: 'Restore',
    rollbackTitle: 'Restore revision',
    rollbackHint: 'Content and sections only. Status and path are not restored: a rollback must not publish a page someone unpublished, nor unpublish a live one.',
    rollbackConfirm: 'Restore this version',
    cancel: 'Cancel',
    revisionsEmpty: 'No revisions yet.',
    auditEmpty: 'No audit entries for this page.',
    auditHint: 'From audit_logs filtered to this page. Autosaves are deliberately not written here.',
    translations: 'Language variants',
    translationsHint: 'Only published variants are emitted in hreflang. Create a new variant from the pages list with the same key and translation group.',
    translationsEmpty: 'No other language variants.',
    openTranslation: 'Open',
    previewTitle: 'Structure preview',
    previewHint: 'An internal preview of structure and text in the page language direction. Not a final rendering: the public renderer owns the design.',
    previewInactive: 'Disabled section — hidden from visitors',
    loadError: 'Unable to load the page',
    notFound: 'Page not found',
    unsaved: 'Unsaved changes',
    sectionCount: 'sections',
    activeCount: 'active',
    publicPath: 'Public path',
  },
}

const EDITABLE_STATUSES = ['draft', 'review', 'scheduled', 'archived']

const parseJson = (raw: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

const toDrafts = (detail: WebPageDetail): WebSectionDraft[] => detail.sections.map((section) => ({
  key: section.id,
  section_type: section.section_type as WebSectionType,
  is_active: section.is_active === 1,
  content: parseJson(section.content_json),
  cta: parseJson(section.cta_json),
  media_asset_id: section.media_asset_id,
}))

export function WebsitePageEditor() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const params = useParams()
  const navigate = useNavigate()
  const pageId = params.id ?? ''

  const [detail, setDetail] = useState<WebPageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sections, setSections] = useState<WebSectionDraft[]>([])
  const [dirty, setDirty] = useState(false)
  const [savingSections, setSavingSections] = useState(false)
  const [savedNote, setSavedNote] = useState('')
  const [settings, setSettings] = useState({ title: '', summary: '', slug: '', status: 'draft', scheduled_at: '', is_indexable: true })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [publishBlockers, setPublishBlockers] = useState<CmsBlocker[] | null>(null)
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null)
  const [audit, setAudit] = useState<AuditRecord[]>([])
  const [redirects, setRedirects] = useState<WebRedirect[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.webPage(pageId)
      setDetail(response.data)
      setSections(toDrafts(response.data))
      setDirty(false)
      setSettings({
        title: response.data.page.title,
        summary: response.data.page.summary ?? '',
        slug: response.data.page.slug,
        status: response.data.page.status,
        scheduled_at: response.data.page.scheduled_at ?? '',
        is_indexable: response.data.page.is_indexable !== 0,
      })
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 404 ? text.notFound : caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [pageId, text.loadError, text.notFound])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!pageId) return
    let cancelled = false
    void api.auditLogs({ entity_type: 'web_page', entity_id: pageId, limit: 50 })
      .then((response) => { if (!cancelled) setAudit(response.data) })
      .catch(() => { if (!cancelled) setAudit([]) })
    void api.seoRedirects()
      .then((response) => { if (!cancelled) setRedirects(response.data) })
      .catch(() => { if (!cancelled) setRedirects([]) })
    return () => { cancelled = true }
  }, [pageId])

  const language = detail?.page.language ?? 'ar'
  const contentDir = language === 'ar' ? 'rtl' : 'ltr'
  const isPublished = detail?.page.status === 'published'

  async function saveSections() {
    setSavingSections(true)
    setSavedNote('')
    setSettingsError('')
    try {
      await api.saveWebPageSections(pageId, sections.map((section) => ({
        section_type: section.section_type,
        is_active: section.is_active,
        content: section.content,
        cta: section.cta,
        media_asset_id: section.media_asset_id,
      })))
      setSavedNote(text.saved)
      await load()
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSavingSections(false)
    }
  }

  async function saveSettings() {
    setSavingSettings(true)
    setSettingsError('')
    setSavedNote('')
    try {
      const payload: Record<string, unknown> = {
        title: settings.title,
        summary: settings.summary,
        is_indexable: settings.is_indexable,
      }
      if (detail?.page.kind !== 'home') payload.slug = settings.slug
      // الحالة تُرسَل فقط إن كانت قابلة للتعديل هنا: 'published' يرفضها الخادم،
      // فإرسالها يُنتج 400 على تعديل عنوان بريء.
      if (EDITABLE_STATUSES.includes(settings.status)) {
        payload.status = settings.status
        if (settings.status === 'scheduled') payload.scheduled_at = settings.scheduled_at
      }
      await api.updateWebPage(pageId, payload)
      setSavedNote(text.saved)
      await load()
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSavingSettings(false)
    }
  }

  async function publish() {
    setPublishing(true)
    setPublishBlockers(null)
    setSettingsError('')
    try {
      const response = await api.publishWebPage(pageId)
      setPublishBlockers(response.data.warnings ?? [])
      await load()
    } catch (caught) {
      if (caught instanceof ApiError) {
        const payload = caught.payload as { blockers?: CmsBlocker[]; warnings?: CmsBlocker[] } | null
        setPublishBlockers([...(payload?.blockers ?? []), ...(payload?.warnings ?? [])])
        setSettingsError(caught.message)
      } else {
        setSettingsError(caught instanceof Error ? caught.message : text.loadError)
      }
    } finally {
      setPublishing(false)
    }
  }

  async function rollback(version: number) {
    try {
      await api.rollbackWebPage(pageId, version)
      setRollbackVersion(null)
      await load()
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : text.loadError)
      setRollbackVersion(null)
    }
  }

  const revisionEntries: TimelineEntry[] = useMemo(
    () => (detail?.revisions ?? []).map((revision) => ({
      id: revision.id,
      at: revision.created_at,
      title: `v${revision.version}${revision.note ? ` — ${revision.note}` : ''}`,
      actor: revision.created_by_name,
      detail: (
        <button className="button button--ghost button--small" type="button" onClick={() => setRollbackVersion(revision.version)}>
          <Icon name="refresh" size={13} />{text.rollback}
        </button>
      ),
    })),
    [detail?.revisions, text.rollback],
  )

  const auditEntries: TimelineEntry[] = audit.map((record) => ({
    id: record.id,
    at: record.created_at,
    title: record.action,
    actor: record.actor_id,
    detail: record.details ? <code dir="ltr" className="audit-details">{record.details}</code> : null,
    tone: record.action === 'publish_blocked' ? 'warn' : record.action === 'publish' ? 'good' : 'default',
  }))

  if (loading && !detail) return <LoadingState />
  if (error && !detail) return <ErrorState message={error} onRetry={() => void load()} />
  if (!detail) return null

  const activeSections = sections.filter((section) => section.is_active).length

  return (
    <div className="page-stack">
      <Breadcrumbs
        items={[
          { label: text.breadcrumb, to: adminPath('website/pages') },
          { label: detail.page.title },
        ]}
      />

      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow} · {detail.page.language}</span>
          <h2>{detail.page.title}</h2>
          <p><code dir="ltr">{detail.page.path}</code> · {sections.length} {text.sectionCount} ({activeSections} {text.activeCount})</p>
        </div>
        <div className="page-intro__actions">
          <span className={`account-status account-status--${isPublished ? 'active' : 'draft'}`}>{detail.page.status}</span>
          <button className="button button--primary" type="button" disabled={publishing} onClick={() => void publish()}>
            <Icon name="upload" size={15} />{publishing ? text.publishing : text.publish}
          </button>
        </div>
      </section>

      {settingsError && <p className="panel panel--notice field__error" role="alert">{settingsError}</p>}
      {savedNote && <p className="panel panel--notice field__ok" role="status">{savedNote}</p>}

      <section className="panel">
        <div className="panel__header"><h3>{text.readiness}</h3></div>
        <div className="entity-form">
          {detail.readiness.length ? (
            <ul className="readiness-list">
              {detail.readiness.map((blocker) => (
                <li className={`readiness-item readiness-item--${blocker.severity === 'blocker' ? 'blocked' : 'warn'}`} key={blocker.id}>
                  <strong>{blocker.id}</strong><span>{blocker.detail}</span>
                </li>
              ))}
            </ul>
          ) : <p className="field__ok">{text.noBlockers}</p>}
        </div>
      </section>

      <DetailTabs
        tabs={[
          {
            key: 'sections',
            label: text.tabContent,
            badge: sections.length,
            content: (
              <div className="panel" dir={contentDir}>
                <div className="panel__header">
                  <h3>{text.tabContent}</h3>
                  <div className="panel__actions">
                    {dirty && <span className="field__warn">{text.unsaved}</span>}
                    <button className="button button--primary" type="button" disabled={savingSections} onClick={() => void saveSections()}>
                      <Icon name="check" size={15} />{savingSections ? text.saving : text.saveSections}
                    </button>
                  </div>
                </div>
                <div className="panel__body">
                  <SectionEditor
                    sections={sections}
                    canEdit
                    onChange={(next) => { setSections(next); setDirty(true) }}
                  />
                </div>
              </div>
            ),
          },
          {
            key: 'settings',
            label: text.tabSettings,
            content: (
              <div className="panel">
                <div className="panel__header"><h3>{text.tabSettings}</h3></div>
                <div className="entity-form">
                  <label className="field">
                    <span>{text.title}</span>
                    <input dir={contentDir} value={settings.title} onChange={(event) => setSettings({ ...settings, title: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>{text.summary}</span>
                    <textarea dir={contentDir} rows={3} value={settings.summary} onChange={(event) => setSettings({ ...settings, summary: event.target.value })} />
                  </label>
                  {detail.page.kind !== 'home' && (
                    <label className="field">
                      <span>{text.slug}</span>
                      <input dir="ltr" value={settings.slug} onChange={(event) => setSettings({ ...settings, slug: event.target.value })} />
                      <small>{text.slugRedirect}</small>
                    </label>
                  )}
                  <div className="field-row">
                    <label className="field">
                      <span>{text.status}</span>
                      <select value={settings.status} onChange={(event) => setSettings({ ...settings, status: event.target.value })}>
                        {isPublished && <option value="published">{text.published}</option>}
                        {EDITABLE_STATUSES.map((status) => <option value={status} key={status}>{status}</option>)}
                      </select>
                      {isPublished && <small>{text.slugRedirect}</small>}
                    </label>
                    <label className="field">
                      <span>{text.schedule}</span>
                      <input
                        type="datetime-local"
                        value={settings.scheduled_at ? settings.scheduled_at.slice(0, 16) : ''}
                        onChange={(event) => setSettings({ ...settings, scheduled_at: event.target.value ? new Date(event.target.value).toISOString() : '' })}
                      />
                      <small>{text.scheduleHint}</small>
                    </label>
                  </div>
                  <label className="checkbox">
                    <input type="checkbox" checked={settings.is_indexable} onChange={(event) => setSettings({ ...settings, is_indexable: event.target.checked })} />
                    <span>{text.indexable}</span>
                  </label>

                  <ul className="kv-list">
                    <li><span>{text.publicPath}</span><code dir="ltr">{detail.page.path}</code></li>
                    <li><span>{text.kind}</span><span dir="ltr">{detail.page.kind}</span></li>
                    <li><span>{text.language}</span><span dir="ltr">{detail.page.language}</span></li>
                    <li><span>{text.group}</span><code dir="ltr">{detail.page.translation_group}</code></li>
                    <li><span>{text.updated}</span><span dir="ltr">{detail.page.updated_at}</span></li>
                    <li><span>{text.publishedAt}</span><span dir="ltr">{detail.page.published_at ?? '—'}</span></li>
                  </ul>

                  <div className="form-actions">
                    <button className="button button--primary" type="button" disabled={savingSettings} onClick={() => void saveSettings()}>
                      <Icon name="check" size={15} />{savingSettings ? text.saving : text.save}
                    </button>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'seo',
            label: text.tabSeo,
            content: (
              <SeoEditor
                entityType="web_page"
                entityId={pageId}
                path={detail.page.path}
                language={detail.page.language}
                translations={detail.translations}
                redirects={redirects}
                onSaved={() => void load()}
              />
            ),
          },
          {
            key: 'translations',
            label: text.tabTranslations,
            badge: detail.translations.length,
            content: (
              <div className="panel">
                <div className="panel__header"><div><h3>{text.translations}</h3><p>{text.translationsHint}</p></div></div>
                <div className="entity-form">
                  {detail.translations.length ? (
                    <ul className="kv-list">
                      {detail.translations.map((translation) => (
                        <li key={translation.id}>
                          <span dir="ltr">{translation.language} · <code>{translation.path}</code></span>
                          <span>
                            <span className={`account-status account-status--${translation.status === 'published' ? 'active' : 'draft'}`}>{translation.status}</span>
                            <Link className="button button--ghost button--small" to={adminPath(`website/pages/${translation.id}`)}>{text.openTranslation}</Link>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="data-unavailable">{text.translationsEmpty}</p>}
                </div>
              </div>
            ),
          },
          {
            key: 'revisions',
            label: text.tabRevisions,
            badge: detail.revisions.length,
            content: (
              <div className="panel">
                <div className="panel__header"><div><h3>{text.revisions}</h3><p>{text.revisionsHint}</p></div></div>
                <div className="panel__body">
                  <TimelineView entries={revisionEntries} emptyLabel={text.revisionsEmpty} />
                </div>
              </div>
            ),
          },
          {
            key: 'audit',
            label: text.tabAudit,
            badge: audit.length,
            content: (
              <div className="panel">
                <div className="panel__header"><div><h3>{text.tabAudit}</h3><p>{text.auditHint}</p></div></div>
                <div className="panel__body">
                  <TimelineView entries={auditEntries} emptyLabel={text.auditEmpty} />
                </div>
              </div>
            ),
          },
          {
            key: 'preview',
            label: text.tabPreview,
            content: (
              <div className="panel">
                <div className="panel__header"><div><h3>{text.previewTitle}</h3><p>{text.previewHint}</p></div></div>
                <div className="panel__body">
                  <div className="cms-preview" dir={contentDir} lang={language}>
                    <h1>{settings.title}</h1>
                    {settings.summary && <p className="cms-preview__summary">{settings.summary}</p>}
                    {sections.map((section, index) => (
                      <section className={`cms-preview__section ${section.is_active ? '' : 'cms-preview__section--inactive'}`} key={section.key}>
                        <header>
                          <code dir="ltr">{index + 1}. {section.section_type}</code>
                          {!section.is_active && <small>{text.previewInactive}</small>}
                        </header>
                        {typeof section.content.headline === 'string' && <h2>{section.content.headline}</h2>}
                        {typeof section.content.heading === 'string' && <h3>{section.content.heading}</h3>}
                        {typeof section.content.subheadline === 'string' && <p>{section.content.subheadline}</p>}
                        {typeof section.content.body === 'string' && <p>{section.content.body}</p>}
                        {Array.isArray(section.content.items) && (
                          <ul>
                            {(section.content.items as Array<Record<string, unknown>>).map((item, itemIndex) => (
                              <li key={itemIndex}>
                                {String(item.title ?? item.question ?? item.label ?? item.name ?? item.quote ?? '')}
                                {item.answer || item.body || item.value ? ` — ${String(item.answer ?? item.body ?? item.value)}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                        {typeof section.cta.label === 'string' && section.cta.label && (
                          <p className="cms-preview__cta">
                            {String(section.cta.label)} → <code dir="ltr">{String(section.cta.href ?? '')}</code>
                          </p>
                        )}
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={publishBlockers !== null}
        title={settingsError ? text.publishBlocked : text.readiness}
        onClose={() => setPublishBlockers(null)}
      >
        {publishBlockers?.length ? (
          <ul className="readiness-list">
            {publishBlockers.map((blocker) => (
              <li className={`readiness-item readiness-item--${blocker.severity === 'blocker' ? 'blocked' : 'warn'}`} key={blocker.id}>
                <strong>{blocker.id}</strong><span>{blocker.detail}</span>
              </li>
            ))}
          </ul>
        ) : <p className="field__ok">{text.noBlockers}</p>}
      </Modal>

      <Modal open={rollbackVersion !== null} title={text.rollbackTitle} description={text.rollbackHint} onClose={() => setRollbackVersion(null)}>
        <div className="form-actions">
          <button className="button button--primary" type="button" onClick={() => rollbackVersion !== null && void rollback(rollbackVersion)}>
            {text.rollbackConfirm} v{rollbackVersion}
          </button>
          <button className="button button--ghost" type="button" onClick={() => setRollbackVersion(null)}>{text.cancel}</button>
        </div>
      </Modal>

      <button className="button button--ghost" type="button" onClick={() => navigate(adminPath('website/pages'))}>
        {text.breadcrumb}
      </button>
    </div>
  )
}
