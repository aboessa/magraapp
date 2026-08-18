import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type {
  HomeBlockRecord,
  HomeBlockVersion,
  HomeBuilderMeta,
  HomePreviewEnvelope,
  HomeTargeting,
  HomeVersionsMeta,
} from '../types/api'

/**
 * App Home Builder — the logged-in child's Home screen inside Majarra.
 * Not the marketing site (that is the Website CMS).
 *
 * ## What changed, and why the previous warning is gone
 *
 * This screen used to carry a permanent banner saying Flutter ignored its
 * configuration, and it was telling the truth: the app rendered a hardcoded list
 * of rows from `feed_blocks.dart` and a hardcoded sliver order in
 * `home_feed.dart`, and nothing read `/api/v1/home/resolved`. The Save, Cancel,
 * Publish, Rollback and content-picker buttons were all `disabled`, the version
 * table was two invented rows (`v3 Active owner 2026-08-11`), and the resolver
 * diagnostics printed "Fallback applied: none" unconditionally.
 *
 * The app now resolves its Home from this configuration
 * (`home_layout.dart`, `resolvedHomeContractProvider`), so the buttons here do
 * something and the warning would be false. Two honest limits remain and are
 * stated in the UI rather than hidden:
 *
 * - **No content picker.** Editorial rows draw from the catalogue by type; there
 *   is no per-row item selection on the server, so the control is absent rather
 *   than present-and-disabled.
 * - **No publish/draft workflow.** `is_draft` exists per block and is exposed as
 *   a checkbox. There is no separate "publish the whole layout" transition, so no
 *   button claims one.
 */

type Persona = {
  id: string
  label: string
  language: string
  track: string
  plan: string
  country: string
  appVersion: string
}

/// Personas are preview inputs only — they set the query the resolver receives.
/// Every dimension here is one the resolver implements.
const PERSONAS: Persona[] = [
  { id: 'p1', label: 'AR · preschool · free · EG', language: 'ar', track: 'preschool', plan: 'free', country: 'EG', appVersion: '1.0.0' },
  { id: 'p2', label: 'AR · kids · family · EG', language: 'ar', track: 'kids', plan: 'family', country: 'EG', appVersion: '1.0.0' },
  { id: 'p3', label: 'AR · junior · family_plus · SA', language: 'ar', track: 'junior', plan: 'family_plus', country: 'SA', appVersion: '1.0.0' },
]

const BLOCK_LABELS: Record<string, { ar: string; en: string }> = {
  hero_slider: { ar: 'شريط البطل', en: 'Hero carousel' },
  content_rail: { ar: 'صف محتوى', en: 'Content rail' },
  planet_orbit: { ar: 'مدار الكواكب', en: 'Planet orbit' },
  feature_banner: { ar: 'لافتة مميزة', en: 'Feature banner' },
  learning_journey: { ar: 'رحلة التعلّم', en: 'Learning journey' },
  audio_rail: { ar: 'صف صوتي', en: 'Audio rail' },
  character_orbit: { ar: 'مدار الشخصيات', en: 'Character orbit' },
  seasonal_banner: { ar: 'لافتة موسمية', en: 'Seasonal banner' },
  welcome: { ar: 'ترحيب', en: 'Welcome' },
  coming_soon: { ar: 'قادم قريبًا', en: 'Coming soon' },
  watch_free: { ar: 'شاهد مجانًا', en: 'Watch free' },
  new_releases: { ar: 'إصدارات جديدة', en: 'New releases' },
  most_watched: { ar: 'الأكثر مشاهدة', en: 'Most watched' },
  continue_watching: { ar: 'أكمل ما بدأت', en: 'Continue watching' },
  continue_drawing: { ar: 'أكمل رسمتك', en: 'Continue drawing' },
  explore_majarra: { ar: 'استكشف مجرة', en: 'Explore Majarra' },
  creative_studio: { ar: 'استوديو الإبداع', en: 'Creative studio' },
  new_episodes: { ar: 'حلقات جديدة', en: 'New episodes' },
  recently_added: { ar: 'أضيف حديثًا', en: 'Recently added' },
  games: { ar: 'ألعاب', en: 'Games' },
  stories: { ar: 'قصص', en: 'Stories' },
  audio: { ar: 'صوتيات', en: 'Audio' },
  recommended: { ar: 'اخترنا لك', en: 'Recommended' },
  because_you_watched: { ar: 'لأنك شاهدت', en: 'Because you watched' },
  seasonal: { ar: 'موسمي', en: 'Seasonal' },
}

const copy = {
  ar: {
    eyebrow: 'التحكم في التطبيق',
    title: 'بناء الصفحة الرئيسية',
    lede: 'ما يراه الطفل بعد تسجيل الدخول — ليس الموقع العام. لكل صف: ترتيب، عنوان، استهداف، جدولة.',
    liveNote: 'التطبيق يقرأ هذا الإعداد من /api/v1/home/resolved. التغيير يظهر عند إعادة تحميل الصفحة الرئيسية في التطبيق.',
    sections: 'الأقسام', preview: 'معاينة المُحلِّل', addSection: 'قسم جديد',
    enabled: 'مفعل', disabled: 'معطل', system: 'نظام', editorial: 'تحريري',
    draft: 'مسودة', active: 'نشط',
    targeting: 'الاستهداف', schedule: 'الجدولة',
    moveUp: 'تحريك لأعلى', moveDown: 'تحريك لأسفل',
    versions: 'النسخ', save: 'حفظ', cancel: 'تراجع', delete: 'حذف',
    empty: 'لا أقسام', emptyHint: 'أضف قسمًا لتحديد ما يراه الطفل.',
    everyone: 'الجميع', persona: 'شخصية المعاينة',
    unsaved: 'تغييرات غير محفوظة',
    saved: 'تم الحفظ',
    noVersions: 'لا نسخ محفوظة لهذا القسم بعد. تُسجَّل نسخة عند كل تعديل.',
    restore: 'استعادة', restoring: 'جارٍ الاستعادة…',
    notRestorable: 'نسخة الإنشاء — لا حالة أسبق',
    legacyNote: 'توجد سجلات أقدم من تطبيق سابق لا تحمل الاستهداف ولا الإعداد، فلا يمكن الاستعادة إليها.',
    noPicker: 'لا يوجد اختيار عناصر لكل صف: الخادم يبني محتوى الصف من نوعه، فلا واجهة تدّعي غير ذلك.',
    systemNote: 'هذا صف نظام: الخادم يحسب محتواه من حالة الطفل. العنوان والترتيب والاستهداف والجدولة قابلة للتحكم، والمحتوى لا.',
    minVersion: 'أدنى إصدار تطبيق',
    newUser: 'مستخدم جديد فقط',
    anyUser: 'كل المستخدمين',
    confirmDelete: 'حذف القسم نهائيًا؟ تُحفظ حالته الأخيرة في النسخ.',
    diagnostics: 'تشخيص المُحلِّل',
    matched: 'مطابق', excluded: 'مستثنى', inactive: 'معطل', draftCount: 'مسودة', schedule2: 'خارج الجدولة',
  },
  en: {
    eyebrow: 'App control',
    title: 'Home Builder',
    lede: 'What the logged-in child sees — not the marketing site. Per row: order, title, targeting, schedule.',
    liveNote: 'The app reads this configuration from /api/v1/home/resolved. Changes appear when Home is reloaded in the app.',
    sections: 'Sections', preview: 'Resolver preview', addSection: 'Add section',
    enabled: 'Enabled', disabled: 'Disabled', system: 'System', editorial: 'Editorial',
    draft: 'Draft', active: 'Active',
    targeting: 'Targeting', schedule: 'Schedule',
    moveUp: 'Move up', moveDown: 'Move down',
    versions: 'Versions', save: 'Save', cancel: 'Revert', delete: 'Delete',
    empty: 'No sections', emptyHint: 'Add a section to control Home.',
    everyone: 'Everyone', persona: 'Preview persona',
    unsaved: 'Unsaved changes',
    saved: 'Saved',
    noVersions: 'No versions recorded for this section yet. One is written on every edit.',
    restore: 'Restore', restoring: 'Restoring…',
    notRestorable: 'Creation record — no earlier state',
    legacyNote: 'Older records exist from a previous implementation without targeting or config; they cannot be restored to.',
    noPicker: 'There is no per-row item picker: the server builds each row from its type, so no control claims otherwise.',
    systemNote: 'This is a system row: the server computes its contents from the child\u2019s own state. Title, order, targeting and schedule are yours; the contents are not.',
    minVersion: 'Minimum app version',
    newUser: 'New users only',
    anyUser: 'All users',
    confirmDelete: 'Delete this section permanently? Its final state is kept in versions.',
    diagnostics: 'Resolver diagnostics',
    matched: 'Matched', excluded: 'Excluded', inactive: 'Disabled', draftCount: 'Draft', schedule2: 'Out of schedule',
  },
}

const TRACKS = ['preschool', 'kids', 'junior']
const PLANS = ['free', 'family', 'family_plus']
const PLATFORMS = ['phone', 'tablet', 'tv']
const LANGUAGES = ['ar', 'en']

function blockLabel(type: string, locale: 'ar' | 'en') {
  return BLOCK_LABELS[type]?.[locale] ?? type
}

/// A one-line description of who a block reaches, using only real dimensions.
function targetingSentence(targeting: HomeTargeting, locale: 'ar' | 'en', everyone: string) {
  const parts: string[] = []
  const list = (values?: string[]) => (values?.length ? values.join('+') : null)
  const track = list(targeting.track)
  if (track) parts.push(track)
  const language = list(targeting.language)
  if (language) parts.push(language)
  const country = list(targeting.country)
  if (country) parts.push(country)
  const plan = list(targeting.plan)
  if (plan) parts.push(plan)
  const platform = list(targeting.platform)
  if (platform) parts.push(platform)
  if (targeting.min_app_version) parts.push(`≥ ${targeting.min_app_version}`)
  if (targeting.is_new_user !== undefined) {
    parts.push(targeting.is_new_user
      ? (locale === 'ar' ? 'جديد' : 'new')
      : (locale === 'ar' ? 'عائد' : 'returning'))
  }
  return parts.length ? parts.join(' · ') : everyone
}

/// `datetime-local` needs `YYYY-MM-DDTHH:mm` with no zone.
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/// Comma-separated free text to a normalized list, for country codes.
function parseCodes(value: string, upper: boolean) {
  const items = value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean)
  const unique = [...new Set(items.map((item) => (upper ? item.toUpperCase() : item.toLowerCase())))]
  return unique.length ? unique : undefined
}

export function AppExperiencePage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [blocks, setBlocks] = useState<HomeBlockRecord[]>([])
  const [meta, setMeta] = useState<HomeBuilderMeta | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [persona, setPersona] = useState<Persona>(PERSONAS[1])
  const [platform, setPlatform] = useState('phone')
  const [preview, setPreview] = useState<HomePreviewEnvelope | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [busy, setBusy] = useState(false)

  /// The edited copy of the selected block. Kept separate from `blocks` so the
  /// list always shows saved server state and Save/Revert mean something: the
  /// previous screen edited the list in place and then disabled Save, so typed
  /// changes silently vanished on reload.
  const [draft, setDraft] = useState<HomeBlockRecord | null>(null)
  const [versions, setVersions] = useState<HomeBlockVersion[] | null>(null)
  const [versionsMeta, setVersionsMeta] = useState<HomeVersionsMeta | null>(null)
  const [showVersions, setShowVersions] = useState(false)

  const selected = useMemo(
    () => blocks.find((block) => block.id === selectedId) ?? null,
    [blocks, selectedId],
  )
  const dirty = useMemo(
    () => Boolean(draft && selected && JSON.stringify(draft) !== JSON.stringify(selected)),
    [draft, selected],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.homeExperience()
      const sorted = [...response.data].sort((left, right) => left.sort_order - right.sort_order)
      setBlocks(sorted)
      setMeta(response.meta)
      setSelectedId((current) => {
        const next = current && sorted.some((block) => block.id === current)
          ? current
          : sorted[0]?.id ?? null
        return next
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // The draft follows the selection, discarding any unsaved edit to the previous
  // block — which is why the list marks the dirty row.
  useEffect(() => { setDraft(selected ? { ...selected } : null) }, [selected])

  const runPreview = useCallback(async () => {
    setPreviewError('')
    try {
      const response = await api.homeExperiencePreview({
        track: persona.track,
        language: persona.language,
        country: persona.country,
        plan: persona.plan,
        platform,
        app_version: persona.appVersion,
      })
      setPreview(response.data)
    } catch (caught) {
      // No local simulation. The old screen fell back to filtering the loaded
      // list in the browser with different rules than the server, and labelled
      // the result as a preview — so a failed request produced a confident wrong
      // answer.
      setPreview(null)
      setPreviewError(caught instanceof Error ? caught.message : 'Preview unavailable')
    }
  }, [persona, platform])

  useEffect(() => { if (!loading) void runPreview() }, [runPreview, loading, blocks])

  const move = async (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex((block) => block.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= blocks.length) return
    const reordered = [...blocks]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    setBusy(true)
    setError('')
    try {
      // The server requires the complete id list and assigns sort_order from the
      // array index, so the saved order is exactly what is shown.
      await api.reorderHomeBlocks(reordered.map((block) => block.id))
      await load()
      setNotice(text.saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const createBlock = async (type: string) => {
    setBusy(true)
    setError('')
    try {
      const created = await api.createHomeBlock({
        block_type: type,
        title_ar: blockLabel(type, 'ar'),
        // Created disabled so a new row cannot appear on a child's Home before
        // anyone has titled or targeted it.
        is_active: false,
        sort_order: blocks.length,
      })
      await load()
      setSelectedId(created.data.id)
      setShowAdd(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!draft || !selected) return
    setBusy(true)
    setError('')
    try {
      await api.updateHomeBlock(draft.id, {
        title_ar: draft.title_ar,
        is_active: Number(draft.is_active) === 1,
        is_draft: Number(draft.is_draft ?? 0) === 1,
        scheduled_at: draft.scheduled_at ?? null,
        expires_at: draft.expires_at ?? null,
        targeting: draft.targeting,
        config: draft.config,
      })
      await load()
      setNotice(text.saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!selected || !window.confirm(text.confirmDelete)) return
    setBusy(true)
    setError('')
    try {
      await api.deleteHomeBlock(selected.id)
      setSelectedId(null)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const openVersions = async () => {
    if (!selected) return
    setShowVersions(true)
    setVersions(null)
    setVersionsMeta(null)
    try {
      const response = await api.homeBlockVersions(selected.id)
      setVersions(response.data)
      setVersionsMeta(response.meta)
    } catch (caught) {
      setVersions([])
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }

  const restore = async (versionId: string) => {
    if (!selected) return
    setBusy(true)
    try {
      await api.rollbackHomeBlock(selected.id, versionId)
      setShowVersions(false)
      await load()
      setNotice(text.saved)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  const patchDraft = (change: Partial<HomeBlockRecord>) =>
    setDraft((current) => (current ? { ...current, ...change } : current))
  const patchTargeting = (change: Partial<HomeTargeting>) =>
    setDraft((current) => (current ? { ...current, targeting: { ...current.targeting, ...change } } : current))

  if (loading) return <LoadingState />
  if (error && !blocks.length) return <ErrorState message={error} onRetry={() => void load()} />

  const blockTypes = meta?.block_types ?? []

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--secondary" type="button" onClick={() => void openVersions()} disabled={!selected}>
            <Icon name="clock" size={14} />{text.versions}
          </button>
          <button className="button button--primary" type="button" onClick={() => setShowAdd(true)}>
            <Icon name="plus" size={14} />{text.addSection}
          </button>
        </div>
      </section>

      <div className="panel panel--notice" role="status">
        <Icon name="eye" size={16} /><span>{text.liveNote}</span>
      </div>

      {error && <div className="panel panel--notice" role="alert"><Icon name="warning" size={16} /><span>{error}</span></div>}
      {notice && !error && <div className="panel panel--notice" role="status"><Icon name="check" size={16} /><span>{notice}</span></div>}

      <div className="home-builder">
        {/* LEFT: the ordered section list */}
        <div className="panel">
          <div className="panel__header">
            <h3>{text.sections} ({blocks.length})</h3>
          </div>
          <div className="home-builder__list">
            {blocks.length ? blocks.map((block, index) => (
              <div
                key={block.id}
                className={`panel home-builder__row ${selectedId === block.id ? 'panel--active' : ''}`}
              >
                <button
                  type="button"
                  className="home-builder__select"
                  aria-pressed={selectedId === block.id}
                  onClick={() => setSelectedId(block.id)}
                >
                  <strong>{block.title_ar || blockLabel(block.block_type, locale)}</strong>
                  <span className={`status-badge ${Number(block.is_active) ? 'status-badge--published' : 'status-badge--draft'}`}>
                    {Number(block.is_active) ? text.enabled : text.disabled}
                  </span>
                  <small dir="ltr">{block.block_type}</small>
                  <small>
                    <span className="track-badge">{block.is_system ? text.system : text.editorial}</span>
                    {' '}{targetingSentence(block.targeting, locale, text.everyone)}
                  </small>
                  {Number(block.is_draft ?? 0) === 1 && <small>{text.draft}</small>}
                  {(block.targeting_invalid || block.config_invalid) && (
                    <small role="alert">{block.targeting_invalid || block.config_invalid}</small>
                  )}
                </button>
                <div className="home-builder__row-actions">
                  <button className="icon-button icon-button--small" type="button" aria-label={text.moveUp}
                    disabled={busy || index === 0} onClick={() => void move(block.id, -1)}>↑</button>
                  <button className="icon-button icon-button--small" type="button" aria-label={text.moveDown}
                    disabled={busy || index === blocks.length - 1} onClick={() => void move(block.id, 1)}>↓</button>
                  <span className="home-builder__position">#{index + 1}</span>
                </div>
              </div>
            )) : <EmptyState title={text.empty} description={text.emptyHint} />}
          </div>
        </div>

        {/* CENTER: what the resolver returns for the chosen persona */}
        <div className="panel">
          <div className="panel__header">
            <h3>{text.preview}</h3>
            <div className="home-builder__persona">
              <label className="field">
                <span>{text.persona}</span>
                <select value={persona.id} onChange={(event) => setPersona(PERSONAS.find((item) => item.id === event.target.value) ?? PERSONAS[1])}>
                  {PERSONAS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>platform</span>
                <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
                  {PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="home-builder__preview">
            {previewError && <ErrorState message={previewError} onRetry={() => void runPreview()} />}
            {!previewError && preview && (preview.blocks.length ? preview.blocks.map((block) => (
              <div key={block.id} className="home-builder__preview-row">
                <strong>{block.title || blockLabel(block.type, locale)}</strong>
                <small dir="ltr">{block.type} · {block.source}</small>
              </div>
            )) : <EmptyState title={text.empty} description={text.emptyHint} />)}
            {!previewError && preview && (
              <dl className="home-builder__diagnostics">
                <div><dt>{text.matched}</dt><dd>{preview.meta.matched}/{preview.meta.total_blocks}</dd></div>
                <div><dt>{text.excluded}</dt><dd>{preview.meta.excluded}</dd></div>
                <div><dt>{text.inactive}</dt><dd>{preview.meta.excluded_inactive}</dd></div>
                <div><dt>{text.draftCount}</dt><dd>{preview.meta.excluded_draft}</dd></div>
                <div><dt>{text.schedule2}</dt><dd>{preview.meta.excluded_schedule}</dd></div>
              </dl>
            )}
          </div>
        </div>

        {/* RIGHT: the editor */}
        <div className="panel home-builder__config">
          {draft ? (
            <>
              <div className="panel__header">
                <h3>{draft.title_ar || blockLabel(draft.block_type, locale)}</h3>
                <span className="panel__kicker" dir="ltr">{draft.block_type}</span>
              </div>
              <div className="home-builder__fields">
                {draft.is_system && <p className="table-secondary">{text.systemNote}</p>}

                <label className="field">
                  <span>{locale === 'ar' ? 'العنوان' : 'Title'}</span>
                  <input value={draft.title_ar ?? ''} onChange={(event) => patchDraft({ title_ar: event.target.value })} />
                </label>
                <label className="field">
                  <span>{locale === 'ar' ? 'العنوان الفرعي' : 'Subtitle'}</span>
                  <input
                    value={draft.config.subtitle ?? ''}
                    onChange={(event) => setDraft((current) => (current
                      ? { ...current, config: { ...current.config, subtitle: event.target.value || null } }
                      : current))}
                  />
                </label>
                <label className="field field--inline">
                  <input type="checkbox" checked={Number(draft.is_active) === 1}
                    onChange={(event) => patchDraft({ is_active: event.target.checked ? 1 : 0 })} />
                  <span>{text.enabled}</span>
                </label>
                <label className="field field--inline">
                  <input type="checkbox" checked={Number(draft.is_draft ?? 0) === 1}
                    onChange={(event) => patchDraft({ is_draft: event.target.checked ? 1 : 0 })} />
                  <span>{text.draft}</span>
                </label>

                <fieldset className="field">
                  <legend>{text.targeting}</legend>
                  <p className="table-secondary">{targetingSentence(draft.targeting, locale, text.everyone)}</p>
                  <label className="field">
                    <span>track</span>
                    <select multiple value={draft.targeting.track ?? []}
                      onChange={(event) => patchTargeting({
                        track: Array.from(event.target.selectedOptions, (option) => option.value),
                      })}>
                      {TRACKS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>language</span>
                    <select multiple value={draft.targeting.language ?? []}
                      onChange={(event) => patchTargeting({
                        language: Array.from(event.target.selectedOptions, (option) => option.value),
                      })}>
                      {LANGUAGES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>country</span>
                    <input dir="ltr" placeholder="EG, SA" value={(draft.targeting.country ?? []).join(', ')}
                      onChange={(event) => patchTargeting({ country: parseCodes(event.target.value, true) })} />
                  </label>
                  <label className="field">
                    <span>plan</span>
                    <select multiple value={draft.targeting.plan ?? []}
                      onChange={(event) => patchTargeting({
                        plan: Array.from(event.target.selectedOptions, (option) => option.value),
                      })}>
                      {PLANS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>platform</span>
                    <select multiple value={draft.targeting.platform ?? []}
                      onChange={(event) => patchTargeting({
                        platform: Array.from(event.target.selectedOptions, (option) => option.value),
                      })}>
                      {PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>{text.minVersion}</span>
                    <input dir="ltr" placeholder="2.4" value={draft.targeting.min_app_version ?? ''}
                      onChange={(event) => patchTargeting({ min_app_version: event.target.value || undefined })} />
                  </label>
                  <label className="field">
                    <span>{text.newUser}</span>
                    <select
                      value={draft.targeting.is_new_user === undefined ? '' : String(draft.targeting.is_new_user)}
                      onChange={(event) => patchTargeting({
                        is_new_user: event.target.value === '' ? undefined : event.target.value === 'true',
                      })}
                    >
                      <option value="">{text.anyUser}</option>
                      <option value="true">{locale === 'ar' ? 'جديد فقط' : 'New only'}</option>
                      <option value="false">{locale === 'ar' ? 'عائد فقط' : 'Returning only'}</option>
                    </select>
                  </label>
                </fieldset>

                <fieldset className="field">
                  <legend>{text.schedule}</legend>
                  <label className="field">
                    <span>{locale === 'ar' ? 'يبدأ' : 'Starts'}</span>
                    <input type="datetime-local" value={toLocalInput(draft.scheduled_at)}
                      onChange={(event) => patchDraft({ scheduled_at: fromLocalInput(event.target.value) })} />
                  </label>
                  <label className="field">
                    <span>{locale === 'ar' ? 'ينتهي' : 'Ends'}</span>
                    <input type="datetime-local" value={toLocalInput(draft.expires_at)}
                      onChange={(event) => patchDraft({ expires_at: fromLocalInput(event.target.value) })} />
                  </label>
                </fieldset>

                <p className="table-secondary">{text.noPicker}</p>

                <div className="home-builder__actions">
                  <button className="button button--primary" type="button" disabled={busy || !dirty} onClick={() => void save()}>
                    {text.save}
                  </button>
                  <button className="button button--ghost" type="button" disabled={busy || !dirty}
                    onClick={() => setDraft(selected ? { ...selected } : null)}>
                    {text.cancel}
                  </button>
                  <button className="button button--ghost button--danger" type="button" disabled={busy} onClick={() => void remove()}>
                    {text.delete}
                  </button>
                  {dirty && <span className="table-secondary">{text.unsaved}</span>}
                </div>
              </div>
            </>
          ) : <EmptyState title={text.empty} description={text.emptyHint} />}
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={text.addSection}>
        <div className="home-builder__types">
          {blockTypes.map((type) => (
            <button key={type} className="button button--ghost" type="button" disabled={busy}
              onClick={() => void createBlock(type)}>
              <strong>{blockLabel(type, locale)}</strong>
              <small dir="ltr">{type}</small>
              <span className="track-badge">
                {meta?.system_block_types.includes(type) ? text.system : text.editorial}
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={showVersions} onClose={() => setShowVersions(false)} title={text.versions}>
        <div className="home-builder__versions">
          {versions === null ? <LoadingState /> : versions.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ar' ? 'الوقت' : 'Time'}</th>
                  <th>{locale === 'ar' ? 'الإجراء' : 'Action'}</th>
                  <th>{locale === 'ar' ? 'الفاعل' : 'Actor'}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td dir="ltr">{version.created_at}</td>
                    <td>{version.action}</td>
                    <td dir="ltr">{version.actor_id}</td>
                    <td>
                      {version.restorable ? (
                        <button className="button button--ghost button--small" type="button" disabled={busy}
                          onClick={() => void restore(version.id)}>
                          {busy ? text.restoring : text.restore}
                        </button>
                      ) : <small className="table-secondary">{text.notRestorable}</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <EmptyState title={text.versions} description={text.noVersions} />}
          {versionsMeta && versionsMeta.legacy_records > 0 && (
            <p className="table-secondary" role="note">{text.legacyNote}</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
