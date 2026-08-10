import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { BlockEditor, blockWordCount, embedAllowed } from '../components/BlockEditor'
import { Breadcrumbs } from '../components/Breadcrumbs'
import { DetailTabs } from '../components/DetailTabs'
import { Icon } from '../components/Icon'
import { MediaField, MediaThumb } from '../components/MediaPicker'
import { Modal } from '../components/Modal'
import { ErrorState, LoadingState } from '../components/PageState'
import { SeoEditor } from '../components/SeoEditor'
import { TimelineView } from '../components/DataViews'
import type { TimelineEntry } from '../components/DataViews'
import { usePreferences } from '../context/preferences'
import type {
  AuditRecord, BlogBlockDraft, BlogPostDetail, BlogTaxonomy, CmsBlocker, WebRedirect,
} from '../types/api'

/**
 * محرِّر مقال واحد.
 *
 * ## الحفظ التلقائي مشروط بصلاحية الكتل
 *
 * الخادم يرفض المصفوفة كاملة إن فسدت كتلة. حفظ تلقائي كل ثلاثين ثانية على مقال
 * فيه صورة بلا نصّ بديل يعني تسع رسائل خطأ في الدقيقة على شيء لم يطلبه المحرِّر.
 * لذلك يُفحَص الجسم محليًا أولًا، ويُعلَن التوقّف صراحةً بدل أن يصمت الحفظ
 * التلقائي ويظن المحرِّر عمله محفوظًا.
 *
 * ## الاتجاه من لغة المقال
 *
 * مقال عربي يُحرَّر ويُعايَن بـrtl، والإنجليزي والفرنسي بـltr، مهما كانت لغة
 * اللوحة. الفارق يظهر في أول سطر فيه رقم أو كلمة لاتينية.
 */

const copy = {
  ar: {
    breadcrumb: 'المقالات',
    eyebrow: 'مقال',
    tabBody: 'الجسم',
    tabSettings: 'الإعدادات',
    tabSeo: 'SEO',
    tabTaxonomy: 'التصنيف والوسوم',
    tabTranslations: 'اللغات',
    tabRevisions: 'المراجعات',
    tabAudit: 'سجلّ التدقيق',
    tabPreview: 'معاينة',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    saved: 'حُفِظ',
    publish: 'نشر',
    publishing: 'جارٍ النشر…',
    publishBlocked: 'النشر مرفوض',
    readiness: 'جاهزية النشر',
    noBlockers: 'لا عوائق. المقال قابل للنشر.',
    autosaveOn: 'الحفظ التلقائي مُفعَّل (كل ٣٠ ثانية عند وجود تعديل).',
    autosaveBlocked: 'الحفظ التلقائي متوقّف: كتلة غير صالحة سيرفضها الخادم. صحّح الكتل المُعلَّمة.',
    autosaveAt: 'آخر حفظ تلقائي',
    unsaved: 'تعديلات غير محفوظة',
    title: 'العنوان',
    slug: 'الاختصار',
    slugRedirect: 'تغيير اختصار مقال منشور يُنشئ تحويل 301 من المسار القديم.',
    excerpt: 'المقتطف',
    hero: 'الصورة الرئيسية',
    author: 'الكاتب',
    category: 'التصنيف',
    tags: 'الوسوم',
    tagsHint: 'وسم في كل سطر، لاتيني بشُرَط. الوسم غير الموجود يُنشأ تلقائيًا عند الحفظ.',
    status: 'الحالة',
    schedule: 'موعد النشر',
    scheduleHint: 'الحالة «مجدولة» تتطلّب موعدًا.',
    sourceType: 'نوع المصدر',
    sourceReference: 'مرجع المصدر',
    religiousTitle: 'المراجعة الشرعية',
    religiousHint: 'المقال الديني لا يُنشر بلا مراجع شرعي مُسمّى وتاريخ موافقة. الاثنان معًا هما ما يجعل الموافقة قابلة للنسبة.',
    reviewer: 'المراجع الشرعي',
    approvedAt: 'تاريخ الموافقة',
    isReligious: 'مُصنَّف محتوى دينيًا',
    words: 'كلمة',
    path: 'المسار',
    updated: 'آخر تحديث',
    publishedAt: 'نُشِر في',
    revisions: 'المراجعات',
    revisionsHint: 'الحفظ التلقائي يُوسَم ويُقلَّم إلى عشر نسخ؛ المراجعة اليدوية لا تُقلَّم.',
    autosaveTag: 'حفظ تلقائي',
    rollback: 'استرجاع',
    rollbackTitle: 'استرجاع مراجعة',
    rollbackHint: 'يُسترجَع العنوان والمقتطف والجسم والصورة فقط. الحالة والمسار لا يُسترجعان.',
    rollbackConfirm: 'استرجاع النسخة',
    cancel: 'إلغاء',
    revisionsEmpty: 'لا مراجعات بعد.',
    auditEmpty: 'لا سجلّ تدقيق لهذا المقال.',
    auditHint: 'الحفظ التلقائي لا يُكتب في سجلّ التدقيق بقصد: حفظ كل ثلاثين ثانية يُغرق كل إجراء حقيقي.',
    translations: 'النسخ اللغوية',
    translationsEmpty: 'لا نسخ لغوية أخرى.',
    open: 'فتح',
    previewHint: 'معاينة داخلية للبنية باتجاه لغة المقال. العارض العام هو من يرسم التصميم النهائي.',
    loadError: 'تعذر تحميل المقال',
    notFound: 'المقال غير موجود',
    none: '—',
    invalidBlocks: 'كتل غير صالحة',
  },
  en: {
    breadcrumb: 'Posts',
    eyebrow: 'Post',
    tabBody: 'Body',
    tabSettings: 'Settings',
    tabSeo: 'SEO',
    tabTaxonomy: 'Category and tags',
    tabTranslations: 'Languages',
    tabRevisions: 'Revisions',
    tabAudit: 'Audit log',
    tabPreview: 'Preview',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    publish: 'Publish',
    publishing: 'Publishing…',
    publishBlocked: 'Publish refused',
    readiness: 'Publish readiness',
    noBlockers: 'No blockers. The post can be published.',
    autosaveOn: 'Autosave is on (every 30 seconds while there are changes).',
    autosaveBlocked: 'Autosave is paused: an invalid block would be refused by the server. Fix the flagged blocks.',
    autosaveAt: 'Last autosave',
    unsaved: 'Unsaved changes',
    title: 'Title',
    slug: 'Slug',
    slugRedirect: 'Changing the slug of a published post creates a 301 redirect from the old path.',
    excerpt: 'Excerpt',
    hero: 'Hero image',
    author: 'Author',
    category: 'Category',
    tags: 'Tags',
    tagsHint: 'One tag per line, latin with hyphens. A tag that does not exist is created on save.',
    status: 'Status',
    schedule: 'Scheduled for',
    scheduleHint: 'The scheduled status requires a time.',
    sourceType: 'Source type',
    sourceReference: 'Source reference',
    religiousTitle: 'Religious review',
    religiousHint: 'A religious post cannot be published without a named reviewer and an approval date. Together they are what makes the approval attributable.',
    reviewer: 'Religious reviewer',
    approvedAt: 'Approval date',
    isReligious: 'Classified as religious content',
    words: 'words',
    path: 'Path',
    updated: 'Updated',
    publishedAt: 'Published at',
    revisions: 'Revisions',
    revisionsHint: 'Autosaves are flagged and pruned to ten; manual revisions are never pruned.',
    autosaveTag: 'autosave',
    rollback: 'Restore',
    rollbackTitle: 'Restore revision',
    rollbackHint: 'Title, excerpt, body and hero image only. Status and path are not restored.',
    rollbackConfirm: 'Restore this version',
    cancel: 'Cancel',
    revisionsEmpty: 'No revisions yet.',
    auditEmpty: 'No audit entries for this post.',
    auditHint: 'Autosaves are deliberately not audited: a write every thirty seconds would bury every real action.',
    translations: 'Language variants',
    translationsEmpty: 'No other language variants.',
    open: 'Open',
    previewHint: 'An internal structure preview in the post language direction. The public renderer owns the final design.',
    loadError: 'Unable to load the post',
    notFound: 'Post not found',
    none: '—',
    invalidBlocks: 'Invalid blocks',
  },
}

const EDITABLE_STATUSES = ['draft', 'review', 'scheduled', 'archived']
const SOURCE_TYPES = ['quran', 'hadith', 'sira', 'adab', 'general']
const AUTOSAVE_MS = 30_000

/// نفس قواعد `validateBlocks` في الخادم، مُطبَّقة قبل الإرسال لا بعده.
export function invalidBlockIndexes(blocks: BlogBlockDraft[]): number[] {
  const invalid: number[] = []
  blocks.forEach((block, index) => {
    const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
    switch (block.type) {
      case 'heading': {
        const level = Number(block.level)
        if (!Number.isInteger(level) || level < 2 || level > 4 || !str(block.text)) invalid.push(index)
        break
      }
      case 'paragraph':
      case 'quote':
      case 'callout':
        if (!str(block.text)) invalid.push(index)
        break
      case 'list':
      case 'related_content':
        if (!Array.isArray(block.items) || !block.items.length || block.items.some((item) => !str(item))) invalid.push(index)
        break
      case 'image':
        if (!str(block.asset_id) || !str(block.alt)) invalid.push(index)
        break
      case 'embed':
        if (!str(block.url) || !embedAllowed(str(block.url))) invalid.push(index)
        break
      case 'cta':
        if (!str(block.label) || !str(block.href)) invalid.push(index)
        break
      case 'divider':
        break
    }
  })
  return invalid
}

const withKeys = (blocks: BlogPostDetail['post']['body']): BlogBlockDraft[] =>
  blocks.map((block, index) => ({ ...block, key: `loaded-${index}-${block.type}` }))

const stripKeys = (blocks: BlogBlockDraft[]) => blocks.map(({ key: _key, ...block }) => block)

export function BlogPostEditor() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const params = useParams()
  const postId = params.id ?? ''

  const [detail, setDetail] = useState<BlogPostDetail | null>(null)
  const [taxonomy, setTaxonomy] = useState<BlogTaxonomy | null>(null)
  const [blocks, setBlocks] = useState<BlogBlockDraft[]>([])
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', hero_asset_id: null as string | null,
    author_id: '', category_id: '', status: 'draft', scheduled_at: '',
    source_type: '', source_reference: '', religious_reviewer_id: '', religious_approved_at: '',
    tags: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedNote, setSavedNote] = useState('')
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishBlockers, setPublishBlockers] = useState<CmsBlocker[] | null>(null)
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null)
  const [audit, setAudit] = useState<AuditRecord[]>([])
  const [redirects, setRedirects] = useState<WebRedirect[]>([])
  const dirtyRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [response, tax] = await Promise.all([api.blogPost(postId), api.blogTaxonomy()])
      setDetail(response.data)
      setTaxonomy(tax.data)
      setBlocks(withKeys(response.data.post.body))
      setForm({
        title: response.data.post.title,
        slug: response.data.post.slug,
        excerpt: response.data.post.excerpt ?? '',
        hero_asset_id: response.data.post.hero_asset_id,
        author_id: response.data.post.author_id ?? '',
        category_id: response.data.post.category_id ?? '',
        status: response.data.post.status,
        scheduled_at: response.data.post.scheduled_at ?? '',
        source_type: response.data.post.source_type ?? '',
        source_reference: response.data.post.source_reference ?? '',
        religious_reviewer_id: response.data.post.religious_reviewer_id ?? '',
        religious_approved_at: response.data.post.religious_approved_at ?? '',
        tags: response.data.tags.join('\n'),
      })
      setDirty(false)
      dirtyRef.current = false
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 404 ? text.notFound : caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [postId, text.loadError, text.notFound])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!postId) return
    let cancelled = false
    void api.auditLogs({ entity_type: 'blog_post', entity_id: postId, limit: 50 })
      .then((response) => { if (!cancelled) setAudit(response.data) })
      .catch(() => { if (!cancelled) setAudit([]) })
    void api.seoRedirects()
      .then((response) => { if (!cancelled) setRedirects(response.data) })
      .catch(() => { if (!cancelled) setRedirects([]) })
    return () => { cancelled = true }
  }, [postId])

  const invalid = useMemo(() => invalidBlockIndexes(blocks), [blocks])
  const language = detail?.post.language ?? 'ar'
  const contentDir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr'

  const buildPayload = useCallback((autosave: boolean) => {
    const payload: Record<string, unknown> = {
      title: form.title,
      excerpt: form.excerpt,
      body: stripKeys(blocks),
      hero_asset_id: form.hero_asset_id,
      author_id: form.author_id || null,
      category_id: form.category_id || null,
      source_type: form.source_type || null,
      source_reference: form.source_reference,
      religious_reviewer_id: form.religious_reviewer_id || null,
      religious_approved_at: form.religious_approved_at || null,
      tags: form.tags.split('\n').map((tag) => tag.trim()).filter(Boolean),
    }
    if (autosave) {
      payload.autosave = true
      return payload
    }
    if (form.slug && form.slug !== detail?.post.slug) payload.slug = form.slug
    if (EDITABLE_STATUSES.includes(form.status)) {
      payload.status = form.status
      if (form.status === 'scheduled') payload.scheduled_at = form.scheduled_at
    }
    return payload
  }, [blocks, detail?.post.slug, form])

  // الحفظ التلقائي: يعمل فقط مع تعديل قائم وكتل صالحة. `dirtyRef` تُقرأ داخل
  // المؤقّت فلا يُعاد تركيبه على كل ضغطة مفتاح.
  useEffect(() => { dirtyRef.current = dirty }, [dirty])
  useEffect(() => {
    if (!postId) return
    const timer = window.setInterval(() => {
      if (!dirtyRef.current || invalid.length) return
      void api.updateBlogPost(postId, buildPayload(true))
        .then(() => { setAutosavedAt(new Date().toISOString()) })
        .catch(() => { /* الحفظ التلقائي لا يُقاطع المحرِّر برسالة؛ الحفظ اليدوي يُظهر السبب */ })
    }, AUTOSAVE_MS)
    return () => window.clearInterval(timer)
  }, [buildPayload, invalid.length, postId])

  async function save() {
    setSaving(true)
    setError('')
    setSavedNote('')
    try {
      await api.updateBlogPost(postId, buildPayload(false))
      setSavedNote(text.saved)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  async function publish() {
    setPublishing(true)
    setError('')
    setPublishBlockers(null)
    try {
      const response = await api.publishBlogPost(postId)
      setPublishBlockers(response.data.warnings ?? [])
      await load()
    } catch (caught) {
      if (caught instanceof ApiError) {
        const payload = caught.payload as { blockers?: CmsBlocker[]; warnings?: CmsBlocker[] } | null
        setPublishBlockers([...(payload?.blockers ?? []), ...(payload?.warnings ?? [])])
        setError(caught.message)
      } else {
        setError(caught instanceof Error ? caught.message : text.loadError)
      }
    } finally {
      setPublishing(false)
    }
  }

  async function rollback(version: number) {
    try {
      await api.rollbackBlogPost(postId, version)
      setRollbackVersion(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
      setRollbackVersion(null)
    }
  }

  const revisionEntries: TimelineEntry[] = (detail?.revisions ?? []).map((revision) => ({
    id: revision.id,
    at: revision.created_at,
    title: `v${revision.version}${revision.is_autosave ? ` · ${text.autosaveTag}` : ''}${revision.note ? ` — ${revision.note}` : ''}`,
    actor: revision.created_by_name,
    tone: revision.is_autosave ? 'default' : 'good',
    detail: (
      <button className="button button--ghost button--small" type="button" onClick={() => setRollbackVersion(revision.version)}>
        <Icon name="refresh" size={13} />{text.rollback}
      </button>
    ),
  }))

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

  const categories = (taxonomy?.categories ?? []).filter((category) => category.language === language)
  const isPublished = detail.post.status === 'published'

  return (
    <div className="page-stack">
      <Breadcrumbs items={[{ label: text.breadcrumb, to: adminPath('blog/posts') }, { label: detail.post.title }]} />

      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow} · {detail.post.language}</span>
          <h2>{detail.post.title}</h2>
          <p><code dir="ltr">{detail.post.path}</code> · {blockWordCount(blocks)} {text.words}</p>
        </div>
        <div className="page-intro__actions">
          <span className={`account-status account-status--${isPublished ? 'active' : 'draft'}`}>{detail.post.status}</span>
          <button className="button button--secondary" type="button" disabled={saving} onClick={() => void save()}>
            <Icon name="check" size={15} />{saving ? text.saving : text.save}
          </button>
          <button className="button button--primary" type="button" disabled={publishing} onClick={() => void publish()}>
            <Icon name="upload" size={15} />{publishing ? text.publishing : text.publish}
          </button>
        </div>
      </section>

      <p className={invalid.length ? 'panel panel--notice field__error' : 'panel panel--notice'} role="status">
        {invalid.length ? text.autosaveBlocked : text.autosaveOn}
        {autosavedAt && !invalid.length && ` · ${text.autosaveAt}: ${new Date(autosavedAt).toLocaleTimeString()}`}
        {dirty && ` · ${text.unsaved}`}
      </p>
      {error && <p className="panel panel--notice field__error" role="alert">{error}</p>}
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
            key: 'body',
            label: text.tabBody,
            badge: blocks.length,
            content: (
              <div className="panel">
                <div className="panel__header">
                  <h3>{text.tabBody}</h3>
                  <div className="panel__actions">
                    {invalid.length > 0 && <span className="field__error">{text.invalidBlocks}: {invalid.map((index) => index + 1).join(', ')}</span>}
                    <button className="button button--primary" type="button" disabled={saving} onClick={() => void save()}>
                      <Icon name="check" size={15} />{saving ? text.saving : text.save}
                    </button>
                  </div>
                </div>
                <div className="panel__body">
                  <BlockEditor blocks={blocks} dir={contentDir} onChange={(next) => { setBlocks(next); setDirty(true) }} />
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
                    <input dir={contentDir} value={form.title} onChange={(event) => { setForm({ ...form, title: event.target.value }); setDirty(true) }} />
                  </label>
                  <label className="field">
                    <span>{text.slug}</span>
                    <input dir="ltr" value={form.slug} onChange={(event) => { setForm({ ...form, slug: event.target.value }); setDirty(true) }} />
                    <small>{text.slugRedirect}</small>
                  </label>
                  <label className="field">
                    <span>{text.excerpt}</span>
                    <textarea dir={contentDir} rows={3} value={form.excerpt} onChange={(event) => { setForm({ ...form, excerpt: event.target.value }); setDirty(true) }} />
                  </label>
                  <MediaField
                    label={text.hero}
                    value={form.hero_asset_id}
                    onChange={(assetId) => { setForm({ ...form, hero_asset_id: assetId }); setDirty(true) }}
                  />
                  <div className="field-row">
                    <label className="field">
                      <span>{text.status}</span>
                      <select value={form.status} onChange={(event) => { setForm({ ...form, status: event.target.value }); setDirty(true) }}>
                        {isPublished && <option value="published">published</option>}
                        {EDITABLE_STATUSES.map((status) => <option value={status} key={status}>{status}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>{text.schedule}</span>
                      <input
                        type="datetime-local"
                        value={form.scheduled_at ? form.scheduled_at.slice(0, 16) : ''}
                        onChange={(event) => { setForm({ ...form, scheduled_at: event.target.value ? new Date(event.target.value).toISOString() : '' }); setDirty(true) }}
                      />
                      <small>{text.scheduleHint}</small>
                    </label>
                  </div>

                  <fieldset className="section-cta">
                    <legend>{text.religiousTitle}</legend>
                    <p className="field__hint">{text.religiousHint}</p>
                    <p><strong>{text.isReligious}:</strong> {detail.is_religious ? 'نعم / Yes' : text.none}</p>
                    <div className="field-row">
                      <label className="field">
                        <span>{text.sourceType}</span>
                        <select value={form.source_type} onChange={(event) => { setForm({ ...form, source_type: event.target.value }); setDirty(true) }}>
                          <option value="">{text.none}</option>
                          {SOURCE_TYPES.map((type) => <option value={type} key={type}>{type}</option>)}
                        </select>
                      </label>
                      <label className="field">
                        <span>{text.sourceReference}</span>
                        <input value={form.source_reference} onChange={(event) => { setForm({ ...form, source_reference: event.target.value }); setDirty(true) }} />
                      </label>
                    </div>
                    <div className="field-row">
                      <label className="field">
                        <span>{text.reviewer}</span>
                        <input dir="ltr" value={form.religious_reviewer_id} onChange={(event) => { setForm({ ...form, religious_reviewer_id: event.target.value }); setDirty(true) }} />
                      </label>
                      <label className="field">
                        <span>{text.approvedAt}</span>
                        <input
                          type="date"
                          value={form.religious_approved_at ? form.religious_approved_at.slice(0, 10) : ''}
                          onChange={(event) => { setForm({ ...form, religious_approved_at: event.target.value ? new Date(event.target.value).toISOString() : '' }); setDirty(true) }}
                        />
                      </label>
                    </div>
                  </fieldset>

                  <ul className="kv-list">
                    <li><span>{text.path}</span><code dir="ltr">{detail.post.path}</code></li>
                    <li><span>{text.updated}</span><span dir="ltr">{detail.post.updated_at}</span></li>
                    <li><span>{text.publishedAt}</span><span dir="ltr">{detail.post.published_at ?? text.none}</span></li>
                  </ul>

                  <div className="form-actions">
                    <button className="button button--primary" type="button" disabled={saving} onClick={() => void save()}>
                      <Icon name="check" size={15} />{saving ? text.saving : text.save}
                    </button>
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'taxonomy',
            label: text.tabTaxonomy,
            content: (
              <div className="panel">
                <div className="panel__header"><h3>{text.tabTaxonomy}</h3></div>
                <div className="entity-form">
                  <div className="field-row">
                    <label className="field">
                      <span>{text.author}</span>
                      <select value={form.author_id} onChange={(event) => { setForm({ ...form, author_id: event.target.value }); setDirty(true) }}>
                        <option value="">{text.none}</option>
                        {(taxonomy?.authors ?? []).map((author) => <option value={author.id} key={author.id}>{author.display_name}</option>)}
                      </select>
                    </label>
                    <label className="field">
                      <span>{text.category}</span>
                      <select value={form.category_id} onChange={(event) => { setForm({ ...form, category_id: event.target.value }); setDirty(true) }}>
                        <option value="">{text.none}</option>
                        {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    <span>{text.tags}</span>
                    <textarea dir="ltr" rows={4} value={form.tags} onChange={(event) => { setForm({ ...form, tags: event.target.value }); setDirty(true) }} />
                    <small>{text.tagsHint}</small>
                  </label>
                  <div className="form-actions">
                    <button className="button button--primary" type="button" disabled={saving} onClick={() => void save()}>
                      <Icon name="check" size={15} />{saving ? text.saving : text.save}
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
                entityType="blog_post"
                entityId={postId}
                path={detail.post.path}
                language={detail.post.language}
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
                <div className="panel__header"><h3>{text.translations}</h3></div>
                <div className="entity-form">
                  {detail.translations.length ? (
                    <ul className="kv-list">
                      {detail.translations.map((translation) => (
                        <li key={translation.id}>
                          <span dir="ltr">{translation.language} · <code>{translation.path}</code></span>
                          <span>
                            <span className={`account-status account-status--${translation.status === 'published' ? 'active' : 'draft'}`}>{translation.status}</span>
                            <Link className="button button--ghost button--small" to={adminPath(`blog/posts/${translation.id}`)}>{text.open}</Link>
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
                <div className="panel__body"><TimelineView entries={revisionEntries} emptyLabel={text.revisionsEmpty} /></div>
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
                <div className="panel__body"><TimelineView entries={auditEntries} emptyLabel={text.auditEmpty} /></div>
              </div>
            ),
          },
          {
            key: 'preview',
            label: text.tabPreview,
            content: (
              <div className="panel">
                <div className="panel__header"><div><h3>{text.tabPreview}</h3><p>{text.previewHint}</p></div></div>
                <div className="panel__body">
                  <article className="cms-preview" dir={contentDir} lang={language}>
                    <h1>{form.title}</h1>
                    {form.excerpt && <p className="cms-preview__summary">{form.excerpt}</p>}
                    {form.hero_asset_id && <MediaThumb assetId={form.hero_asset_id} size={220} alt={form.title} />}
                    {blocks.map((block) => {
                      const value = typeof block.text === 'string' ? block.text : ''
                      switch (block.type) {
                        case 'heading':
                          return Number(block.level) === 2 ? <h2 key={block.key}>{value}</h2>
                            : Number(block.level) === 3 ? <h3 key={block.key}>{value}</h3>
                              : <h4 key={block.key}>{value}</h4>
                        case 'paragraph': return <p key={block.key}>{value}</p>
                        case 'quote': return <blockquote key={block.key}>{value}{typeof block.attribution === 'string' && block.attribution ? <footer>— {block.attribution}</footer> : null}</blockquote>
                        case 'callout': return <aside className={`cms-preview__callout cms-preview__callout--${String(block.tone ?? 'info')}`} key={block.key}>{value}</aside>
                        case 'list': return String(block.style) === 'number'
                          ? <ol key={block.key}>{(block.items as string[] ?? []).map((item, index) => <li key={index}>{item}</li>)}</ol>
                          : <ul key={block.key}>{(block.items as string[] ?? []).map((item, index) => <li key={index}>{item}</li>)}</ul>
                        case 'image': return (
                          <figure key={block.key}>
                            <MediaThumb assetId={String(block.asset_id ?? '') || null} size={220} alt={String(block.alt ?? '')} />
                            {typeof block.caption === 'string' && block.caption ? <figcaption>{block.caption}</figcaption> : null}
                          </figure>
                        )
                        case 'embed': return <p key={block.key}><code dir="ltr">{String(block.url ?? '')}</code></p>
                        case 'cta': return <p className="cms-preview__cta" key={block.key}>{String(block.label ?? '')} → <code dir="ltr">{String(block.href ?? '')}</code></p>
                        case 'related_content': return <ul key={block.key}>{(block.items as string[] ?? []).map((item, index) => <li key={index}><code dir="ltr">{item}</code></li>)}</ul>
                        case 'divider': return <hr key={block.key} />
                        default: return null
                      }
                    })}
                  </article>
                </div>
              </div>
            ),
          },
        ]}
      />

      <Modal open={publishBlockers !== null} title={error ? text.publishBlocked : text.readiness} onClose={() => setPublishBlockers(null)}>
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
    </div>
  )
}
