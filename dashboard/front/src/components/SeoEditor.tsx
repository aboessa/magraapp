import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { Icon } from './Icon'
import { MediaField } from './MediaPicker'
import { usePreferences } from '../context/preferences'
import type { CmsLanguage, CmsTranslation, SeoGuidance, SeoRecord, WebRedirect } from '../types/api'

/**
 * محرِّر SEO لكيان واحد، أيّ كيان.
 *
 * ## لماذا مكوّن واحد لا نسخة في كل شاشة
 *
 * `seo_meta` جدول واحد متعدّد الأنواع (صفحة، مقال، سلسلة، قصة، كوكب) لأن الحقول
 * متطابقة. لو كُتب المحرِّر في كل شاشة لانحرفت حدود الطول وقواعد التحقّق ونصّ
 * التحذير بين الشاشات، فيصير الرقم المعروض في شاشة مختلفًا عمّا يفرضه الخادم.
 * الحدود تأتي من `guidance` في جسم الخادم نفسه — لا أرقام مكتوبة هنا.
 *
 * ## التحذير ليس رفضًا
 *
 * الطول تحذير لأن محرّك البحث يقتطع ولا يرفض. الرابط المعياري غير https رفضٌ لأنه
 * ينتج وسمًا خاطئًا على صفحة عامة. الواجهة تحترم هذا الفرق بدل تلبيس الاثنين
 * لونًا أحمر واحدًا.
 */

const copy = {
  ar: {
    title: 'تحسين محرّكات البحث',
    lede: 'ما تراه محرّكات البحث ومنصّات المشاركة. الحدود أدناه هي حدود العرض التي يطبّقها الخادم نفسه.',
    seoTitle: 'عنوان SEO',
    description: 'وصف الميتا',
    canonical: 'الرابط المعياري (canonical)',
    canonicalHint: 'رابط https مطلق. اتركه فارغًا ليُشتقّ من مسار الصفحة.',
    robotsIndex: 'قابلة للفهرسة (index)',
    robotsFollow: 'تتبُّع الروابط (follow)',
    ogTitle: 'عنوان Open Graph',
    ogDescription: 'وصف Open Graph',
    ogImage: 'صورة المشاركة',
    structured: 'البيانات المهيكلة (JSON-LD)',
    structuredHint: 'كائن أو مصفوفة كائنات، ولكل كائن @type. تُضاف إلى ما يشتقّه الخادم لا تستبدله.',
    structuredInvalid: 'JSON غير صالح',
    structuredTypes: 'الأنواع المُعلَنة',
    preview: 'معاينة نتيجة البحث',
    previewEmpty: 'أضف عنوانًا ووصفًا لرؤية المعاينة.',
    save: 'حفظ SEO',
    saving: 'جارٍ الحفظ…',
    saved: 'حُفِظ',
    chars: 'حرفًا',
    tooLong: 'أطول من حدّ العرض؛ سيُقتطع.',
    tooShort: 'أقصر من الحدّ الموصى به؛ مساحة النتيجة تُهدَر.',
    warnings: 'تحذيرات الخادم',
    hreflang: 'اللغات البديلة (hreflang)',
    hreflangHint: 'النسخ المنشورة فقط تُدرَج في الوسم. النسخة غير المنشورة تُعرض هنا لتُنشَر أو تُحذف.',
    hreflangNone: 'لا نسخ لغوية أخرى في هذه المجموعة.',
    redirects: 'سجلّ التحويلات على هذا المسار',
    redirectsNone: 'لا تحويلات تخصّ هذا المسار.',
    published: 'منشورة',
    notPublished: 'غير منشورة',
    loadError: 'تعذر تحميل بيانات SEO',
    noIndexWarning: 'الصفحة معلَّمة noindex: لن تظهر في نتائج البحث حتى وهي منشورة.',
  },
  en: {
    title: 'Search engine optimisation',
    lede: 'What search engines and share cards display. The limits below are the ones the server itself applies.',
    seoTitle: 'SEO title',
    description: 'Meta description',
    canonical: 'Canonical URL',
    canonicalHint: 'Absolute https URL. Leave empty to derive it from the page path.',
    robotsIndex: 'Indexable (index)',
    robotsFollow: 'Follow links (follow)',
    ogTitle: 'Open Graph title',
    ogDescription: 'Open Graph description',
    ogImage: 'Share image',
    structured: 'Structured data (JSON-LD)',
    structuredHint: 'An object or array of objects, each with an @type. Appended to what the server derives, never replacing it.',
    structuredInvalid: 'Invalid JSON',
    structuredTypes: 'Declared types',
    preview: 'Search result preview',
    previewEmpty: 'Add a title and description to see the preview.',
    save: 'Save SEO',
    saving: 'Saving…',
    saved: 'Saved',
    chars: 'chars',
    tooLong: 'Longer than the display limit; it will be truncated.',
    tooShort: 'Shorter than recommended; search result space is wasted.',
    warnings: 'Server warnings',
    hreflang: 'Alternate languages (hreflang)',
    hreflangHint: 'Only published variants are emitted in the tag. Unpublished ones are listed here so they can be published or removed.',
    hreflangNone: 'No other language variants in this group.',
    redirects: 'Redirect history for this path',
    redirectsNone: 'No redirects involve this path.',
    published: 'Published',
    notPublished: 'Not published',
    loadError: 'Unable to load SEO data',
    noIndexWarning: 'This page is marked noindex: it will not appear in search results even when published.',
  },
}

interface Draft {
  seo_title: string
  meta_description: string
  canonical_url: string
  robots_index: boolean
  robots_follow: boolean
  og_title: string
  og_description: string
  og_image_asset_id: string | null
  structured_data: string
}

const emptyDraft: Draft = {
  seo_title: '',
  meta_description: '',
  canonical_url: '',
  robots_index: true,
  robots_follow: true,
  og_title: '',
  og_description: '',
  og_image_asset_id: null,
  structured_data: '',
}

function toDraft(record: SeoRecord | null): Draft {
  if (!record) return emptyDraft
  return {
    seo_title: record.seo_title ?? '',
    meta_description: record.meta_description ?? '',
    canonical_url: record.canonical_url ?? '',
    robots_index: record.robots_index !== 0,
    robots_follow: record.robots_follow !== 0,
    og_title: record.og_title ?? '',
    og_description: record.og_description ?? '',
    og_image_asset_id: record.og_image_asset_id ?? null,
    structured_data: record.structured_data_json ?? '',
  }
}

function CharCount({ value, max, min, text }: { value: string; max: number; min?: number; text: typeof copy['ar'] }) {
  const length = value.trim().length
  if (!length) return null
  const tooLong = length > max
  const tooShort = min !== undefined && length < min
  return (
    <small className={tooLong ? 'field__warn' : tooShort ? 'field__warn' : 'field__ok'}>
      {length} / {max} {text.chars}
      {tooLong ? ` — ${text.tooLong}` : tooShort ? ` — ${text.tooShort}` : ''}
    </small>
  )
}

export function SeoEditor({
  entityType,
  entityId,
  path,
  language,
  translations,
  redirects,
  canEdit = true,
  onSaved,
}: {
  entityType: 'web_page' | 'blog_post' | 'series' | 'story' | 'planet'
  entityId: string
  /// المسار العام للكيان، يُعرض في معاينة النتيجة ويُستخدم لتصفية التحويلات
  path?: string
  language?: CmsLanguage
  translations?: CmsTranslation[]
  redirects?: WebRedirect[]
  canEdit?: boolean
  onSaved?: () => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [guidance, setGuidance] = useState<SeoGuidance>({ title_max: 60, description_min: 70, description_max: 160 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.seoMeta(entityType, entityId)
      setDraft(toDraft(response.data.seo))
      setGuidance(response.data.guidance)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [entityId, entityType, text.loadError])

  useEffect(() => { void load() }, [load])

  const structuredTypes = useMemo(() => {
    if (!draft.structured_data.trim()) return { types: [] as string[], invalid: false }
    try {
      const parsed = JSON.parse(draft.structured_data)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      return {
        types: list
          .map((item) => (item && typeof item === 'object' ? String((item as Record<string, unknown>)['@type'] ?? '') : ''))
          .filter(Boolean),
        invalid: false,
      }
    } catch {
      return { types: [], invalid: true }
    }
  }, [draft.structured_data])

  const pathRedirects = useMemo(
    () => (redirects ?? []).filter((redirect) => redirect.from_path === path || redirect.to_path === path),
    [path, redirects],
  )

  async function save() {
    setSaving(true)
    setError('')
    setWarnings([])
    setSaved(false)
    try {
      const response = await api.saveSeoMeta(entityType, entityId, {
        seo_title: draft.seo_title || null,
        meta_description: draft.meta_description || null,
        canonical_url: draft.canonical_url || null,
        robots_index: draft.robots_index,
        robots_follow: draft.robots_follow,
        og_title: draft.og_title || null,
        og_description: draft.og_description || null,
        og_image_asset_id: draft.og_image_asset_id || null,
        structured_data: draft.structured_data.trim() || null,
      })
      setWarnings(response.data.warnings ?? [])
      setSaved(true)
      onSaved?.()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="data-unavailable">{text.saving}</p>

  return (
    <div className="seo-editor">
      <section className="panel">
        <div className="panel__header"><div><h3>{text.title}</h3><p>{text.lede}</p></div></div>
        <div className="entity-form">
          <label className="field">
            <span>{text.seoTitle}</span>
            <input value={draft.seo_title} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, seo_title: event.target.value })} />
            <CharCount value={draft.seo_title} max={guidance.title_max} text={text} />
          </label>

          <label className="field">
            <span>{text.description}</span>
            <textarea rows={3} value={draft.meta_description} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, meta_description: event.target.value })} />
            <CharCount value={draft.meta_description} max={guidance.description_max} min={guidance.description_min} text={text} />
          </label>

          <label className="field">
            <span>{text.canonical}</span>
            <input dir="ltr" value={draft.canonical_url} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, canonical_url: event.target.value })} />
            <small>{text.canonicalHint}</small>
          </label>

          <div className="field-row">
            <label className="checkbox">
              <input type="checkbox" checked={draft.robots_index} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, robots_index: event.target.checked })} />
              <span>{text.robotsIndex}</span>
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={draft.robots_follow} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, robots_follow: event.target.checked })} />
              <span>{text.robotsFollow}</span>
            </label>
          </div>
          {!draft.robots_index && (
            <p className="panel--notice panel--inline"><Icon name="warning" size={15} />{text.noIndexWarning}</p>
          )}

          <label className="field">
            <span>{text.ogTitle}</span>
            <input value={draft.og_title} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, og_title: event.target.value })} />
          </label>
          <label className="field">
            <span>{text.ogDescription}</span>
            <textarea rows={2} value={draft.og_description} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, og_description: event.target.value })} />
          </label>
          <MediaField
            label={text.ogImage}
            value={draft.og_image_asset_id}
            onChange={(assetId) => setDraft({ ...draft, og_image_asset_id: assetId })}
          />

          <label className="field">
            <span>{text.structured}</span>
            <textarea
              dir="ltr"
              rows={5}
              value={draft.structured_data}
              disabled={!canEdit}
              onChange={(event) => setDraft({ ...draft, structured_data: event.target.value })}
            />
            <small>{text.structuredHint}</small>
            {structuredTypes.invalid && <small className="field__error">{text.structuredInvalid}</small>}
            {structuredTypes.types.length > 0 && (
              <small className="field__ok">{text.structuredTypes}: {structuredTypes.types.join(', ')}</small>
            )}
          </label>

          {error && <p className="field__error" role="alert">{error}</p>}
          {warnings.length > 0 && (
            <div className="panel--notice panel--inline">
              <strong>{text.warnings}</strong>
              <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}
          {saved && !warnings.length && <p className="field__ok" role="status">{text.saved}</p>}

          {canEdit && (
            <div className="form-actions">
              <button className="button button--primary" type="button" disabled={saving || structuredTypes.invalid} onClick={() => void save()}>
                <Icon name="check" size={15} />{saving ? text.saving : text.save}
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header"><h3>{text.preview}</h3></div>
        <div className="entity-form">
          {draft.seo_title || draft.meta_description ? (
            <div className="serp-preview" dir={language === 'ar' ? 'rtl' : 'ltr'}>
              <span className="serp-preview__path" dir="ltr">{path ?? ''}</span>
              <strong className="serp-preview__title">{draft.seo_title || '—'}</strong>
              <p className="serp-preview__description">{draft.meta_description || '—'}</p>
            </div>
          ) : <p className="data-unavailable">{text.previewEmpty}</p>}
        </div>
      </section>

      {translations && (
        <section className="panel">
          <div className="panel__header"><div><h3>{text.hreflang}</h3><p>{text.hreflangHint}</p></div></div>
          <div className="entity-form">
            {translations.length ? (
              <ul className="kv-list">
                {translations.map((translation) => (
                  <li key={translation.id}>
                    <span dir="ltr">{translation.language}</span>
                    <span>
                      <code dir="ltr">{translation.path}</code>{' '}
                      <span className={`account-status account-status--${translation.status === 'published' ? 'active' : 'archived'}`}>
                        {translation.status === 'published' ? text.published : text.notPublished}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="data-unavailable">{text.hreflangNone}</p>}
          </div>
        </section>
      )}

      {redirects && (
        <section className="panel">
          <div className="panel__header"><h3>{text.redirects}</h3></div>
          <div className="entity-form">
            {pathRedirects.length ? (
              <ul className="kv-list">
                {pathRedirects.map((redirect) => (
                  <li key={redirect.id}>
                    <code dir="ltr">{redirect.from_path} → {redirect.to_path}</code>
                    <span dir="ltr">{redirect.status_code}{redirect.reason ? ` · ${redirect.reason}` : ''}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="data-unavailable">{text.redirectsNone}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
