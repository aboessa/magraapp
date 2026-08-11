import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { ListToolbar } from '../components/AdvancedFilters'
import type { FilterField } from '../components/AdvancedFilters'
import { ColumnManager, SavedViewsMenu, useColumnPreferences } from '../components/ListTools'
import type { ColumnDefinition } from '../components/ListTools'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { useQuickCreate } from '../hooks/useQuickCreate'
import { useUrlListState } from '../hooks/useUrlListState'
import { statusLabels } from '../lib/labels'
import type { AssetRecord, ContentStatus, SeriesRecord, StoryDetail, StoryPageRecord, StoryRecord, StoryType, VisualStyleRecord } from '../types/api'

const statuses: ContentStatus[] = ['draft', 'writing', 'review_edu', 'review_lang', 'review_sharia', 'production', 'qa', 'ready', 'scheduled', 'published']
const types: StoryType[] = ['picture_book', 'audio_story', 'interactive', 'comic']
const typeLabels = { ar: { picture_book: 'كتاب مصور', audio_story: 'قصة صوتية', interactive: 'قصة تفاعلية', comic: 'كوميكس' }, en: { picture_book: 'Picture book', audio_story: 'Audio story', interactive: 'Interactive', comic: 'Comic' } }
type StoryForm = { title_ar: string; slug: string; series_id: string; type: StoryType; age_min: string; age_max: string; visual_style_id: string; languages: string; description_ar: string; status: ContentStatus }
const initial: StoryForm = { title_ar: '', slug: '', series_id: '', type: 'picture_book', age_min: '6', age_max: '8', visual_style_id: '', languages: 'ar,en', description_ar: '', status: 'draft' }

/// مفاتيح الفلاتر هي أسماء معاملات الاستعلام التي يقبلها `GET /admin/stories`
/// بالحرف (`q`, `status`, `type`, `series_id`, `limit`, `offset` في
/// `api/src/routes/adminContent.ts`). `status` و`series_id` يقبلهما المعالِج ولا
/// تعرضهما الشاشة، فلا يُرسَلان: الفلاتر المنقولة إلى العنوان هي نفسها التي كانت
/// الشاشة تُرسلها.
const DEFAULT_FILTERS = { type: '' }

/// حقل الدرج بيانات لا JSX، فتسميته تأتي من التعريف نفسه الذي يرسم شريحته.
const FILTER_FIELDS = (ar: boolean, locale: 'ar' | 'en'): FilterField[] => [
  {
    key: 'type',
    label: ar ? 'النوع' : 'Type',
    type: 'select',
    options: [
      { value: '', label: ar ? 'كل الأنواع' : 'All types' },
      ...types.map((item) => ({ value: item, label: typeLabels[locale][item] })),
    ],
  },
]

/// جدول القصص سبعة أعمدة، وهو أعرض من شاشة محمول. عمود القصة مُقفل: صفٌّ بلا اسم
/// لا هوية له، ومنه يُفتح المحرّر.
const COLUMNS: ColumnDefinition[] = [
  { key: 'story', label: 'story', locked: true },
  { key: 'type', label: 'type' },
  { key: 'series', label: 'series' },
  { key: 'languages', label: 'languages' },
  { key: 'pages', label: 'pages' },
  { key: 'status', label: 'status' },
]

const columnLabels = {
  ar: { story: 'القصة', type: 'النوع', series: 'السلسلة', languages: 'اللغات', pages: 'الصفحات', status: 'الحالة' },
  en: { story: 'Story', type: 'Type', series: 'Series', languages: 'Languages', pages: 'Pages', status: 'Status' },
}

function AssetImage({ id }: { id?: string | null }) {
  const [url, setUrl] = useState('')
  useEffect(() => { if (!id) { setUrl(''); return }; let active = true; let objectUrl = ''; void api.assetBlob(id).then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) } }).catch(() => setUrl('')); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) } }, [id])
  return url ? <img src={url} alt=""/> : <span><Icon name="media" size={28}/></span>
}

function StoryPageEditor({ story, page, language, imageAssets, audioAssets, onReload }: { story: StoryDetail; page: StoryPageRecord; language: string; imageAssets: AssetRecord[]; audioAssets: AssetRecord[]; onReload: () => Promise<void> }) {
  const { locale } = usePreferences(); const ar = locale === 'ar'
  const localized = page.localizations.find((item) => item.language === language)
  const [text, setText] = useState(localized?.body_text ?? '')
  const [alt, setAlt] = useState(localized?.alt_text ?? '')
  const [narration, setNarration] = useState(localized?.narration_asset_id ?? '')
  const [saving, setSaving] = useState(false)
  useEffect(() => { setText(localized?.body_text ?? ''); setAlt(localized?.alt_text ?? ''); setNarration(localized?.narration_asset_id ?? '') }, [language, localized?.alt_text, localized?.body_text, localized?.narration_asset_id])
  async function save() { setSaving(true); try { await api.savePageLocalization(page.id, language, { body_text: text || null, alt_text: alt || null, narration_asset_id: narration || null, timing_cues: localized?.timing_cues ?? [] }); await onReload() } finally { setSaving(false) } }
  async function upload(file: File, kind: 'image' | 'audio') { const created = await api.createAsset({ title_ar: `${story.title_ar} - ${kind === 'image' ? `صفحة ${page.page_number}` : `صوت ${language} صفحة ${page.page_number}`}`, kind, source: 'upload', status: 'planned', original_filename: file.name, mime_type: file.type, visibility: 'private', language: kind === 'audio' ? language : null, metadata: { story_id: story.id, page_id: page.id } }); await api.uploadAssetFile(created.data.id, file); if (kind === 'image') await api.updateStoryPage(page.id, { image_asset_id: created.data.id }); else { setNarration(created.data.id); await api.savePageLocalization(page.id, language, { body_text: text || null, alt_text: alt || null, narration_asset_id: created.data.id, timing_cues: [] }) } await onReload() }
  async function addBubble() { const bubbleText = window.prompt(ar ? 'نص الفقاعة' : 'Bubble text'); if (!bubbleText) return; await api.createBubble(page.id, { kind: 'dialogue', localized_text: { [language]: bubbleText }, audio_tracks: {}, position_x: 50, position_y: 20, width: 32, height: 18, sort_order: page.bubbles.length }); await onReload() }
  async function removePage() { if (!window.confirm(ar ? 'حذف الصفحة وكل نصوصها وفقاعاتها؟' : 'Delete this page and its text/bubbles?')) return; await api.deleteStoryPage(page.id); await onReload() }
  return <article className="story-page-card"><header><div><span>{ar ? 'صفحة' : 'Page'} {page.page_number}</span><strong>{page.layout}</strong></div><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void removePage()}><Icon name="archive" size={14}/></button></header><div className="story-page-card__content"><div className="story-page-visual"><AssetImage id={page.image_asset_id}/><div className="story-page-visual__actions"><label className="button button--ghost file-button"><Icon name="upload" size={13}/>{page.image_asset_id ? (ar ? 'استبدال الصورة' : 'Replace image') : (ar ? 'رفع صورة' : 'Upload image')}<input type="file" accept="image/*" onChange={(event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, 'image') }}/></label><select value={page.image_asset_id ?? ''} onChange={(event) => void api.updateStoryPage(page.id, { image_asset_id: event.target.value || null }).then(onReload)}><option value="">{ar ? 'أو اختر من المكتبة' : 'Or select from library'}</option>{imageAssets.map((asset) => <option value={asset.id} key={asset.id}>{asset.title_ar}</option>)}</select></div></div><div className="story-page-fields"><label className="field"><span>{ar ? `نص الصفحة — ${language}` : `Page text — ${language}`}</span><textarea rows={5} value={text} onChange={(event) => setText(event.target.value)}/></label><label className="field"><span>{ar ? 'وصف الصورة لسهولة الوصول' : 'Accessible image description'}</span><input value={alt} onChange={(event) => setAlt(event.target.value)}/></label><div className="form-grid"><label className="field"><span>{ar ? 'صوت الراوي' : 'Narration'}</span><select value={narration} onChange={(event) => setNarration(event.target.value)}><option value="">{ar ? 'بدون صوت' : 'No narration'}</option>{audioAssets.filter((asset) => !asset.language || asset.language === language).map((asset) => <option value={asset.id} key={asset.id}>{asset.title_ar}</option>)}</select></label><label className="field"><span>{ar ? 'رفع تسجيل جديد' : 'Upload narration'}</span><input type="file" accept="audio/*" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file, 'audio') }}/></label></div><div className="story-page-actions"><button className="button button--secondary" type="button" onClick={() => void addBubble()}><Icon name="plus" size={13}/>{ar ? 'فقاعة اختيارية' : 'Optional bubble'}</button><button className="button button--primary" type="button" disabled={saving} onClick={() => void save()}>{ar ? 'حفظ النص والصوت' : 'Save text & audio'}</button></div>{page.bubbles.length > 0 && <div className="bubble-list">{page.bubbles.map((bubble) => <span key={bubble.id}>{bubble.localized_text[language] || bubble.localized_text.ar || '…'}<button type="button" onClick={() => void api.deleteBubble(bubble.id).then(onReload)}>×</button></span>)}</div>}</div></div></article>
}

export function StoriesPage() {
  const { locale } = usePreferences(); const ar = locale === 'ar'
  const { id: routeStoryId } = useParams()
  const navigate = useNavigate()
  const [items, setItems] = useState<StoryRecord[]>([]); const [series, setSeries] = useState<SeriesRecord[]>([]); const [styles, setStyles] = useState<VisualStyleRecord[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<StoryRecord | null>(null); const [form, setForm] = useState<StoryForm>(initial); const [saving, setSaving] = useState(false); const [detail, setDetail] = useState<StoryDetail | null>(null); const [detailLoading, setDetailLoading] = useState(false); const [language, setLanguage] = useState('ar'); const [imageAssets, setImageAssets] = useState<AssetRecord[]>([]); const [audioAssets, setAudioAssets] = useState<AssetRecord[]>([])
  // حالة القائمة في العنوان لا في الذاكرة: رابط «الكوميكس قيد الإنتاج» يجب أن
  // يفتح تلك المجموعة، وزرّ الرجوع من المحرّر يجب أن يُعيد نفس التصفية.
  const list = useUrlListState(DEFAULT_FILTERS, {})
  const { query, filters } = list
  const { type: typeFilter } = filters
  const columns = useColumnPreferences('stories', COLUMNS)
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [stories, seriesResponse, styleResponse] = await Promise.all([api.stories({ q: query, type: typeFilter }), api.series({ status: 'all', limit: 100 }), api.visualStyles()]); setItems(stories.data); setSeries(seriesResponse.data.filter((item) => item.status !== 'archived')); setStyles(styleResponse.data) } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل القصص' : 'Unable to load stories') } finally { setLoading(false) } }, [ar, query, typeFilter])
  useEffect(() => { const timer = setTimeout(() => void load(), 180); return () => clearTimeout(timer) }, [load])
  const loadDetail = useCallback(async (id = detail?.id) => { if (!id) return; setDetailLoading(true); try { const [storyResponse, images, audio] = await Promise.all([api.story(id), api.assets({ status: 'ready', kind: 'image', limit: 200 }), api.assets({ status: 'ready', kind: 'audio', limit: 200 })]); setDetail(storyResponse.data); setImageAssets(images.data); setAudioAssets(audio.data); if (!storyResponse.data.languages.includes(language)) setLanguage(storyResponse.data.default_language) } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل القصة' : 'Unable to load story') } finally { setDetailLoading(false) } }, [ar, detail?.id, language])
  useEffect(() => { if (routeStoryId && routeStoryId !== detail?.id) void loadDetail(routeStoryId) }, [detail?.id, loadDetail, routeStoryId])
  // ‏?new=1 من لوحة الأوامر يفتح نموذج القصة نفسه.
  useQuickCreate(() => create())

  function create() { setEditing(null); setForm({ ...initial, series_id: series[0]?.id || '', visual_style_id: styles[0]?.id || '' }); setOpen(true) }
  function edit(item: StoryRecord) { setEditing(item); setForm({ title_ar: item.title_ar, slug: item.slug, series_id: item.series_id ?? '', type: item.type, age_min: String(item.age_min), age_max: String(item.age_max), visual_style_id: item.visual_style_id ?? '', languages: item.languages.join(','), description_ar: item.description_ar ?? '', status: item.status }); setOpen(true) }
  async function submit(event: FormEvent) { event.preventDefault(); if (!form.title_ar.trim()) return; setSaving(true); const payload = { ...form, series_id: form.series_id || null, visual_style_id: form.visual_style_id || null, age_min: Number(form.age_min), age_max: Number(form.age_max), languages: form.languages.split(',').map((item) => item.trim()).filter(Boolean), default_language: form.languages.split(',')[0]?.trim() || 'ar' }; try { if (editing) await api.updateStory(editing.id, payload); else await api.createStory(payload); setOpen(false); await load() } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر حفظ القصة' : 'Unable to save story') } finally { setSaving(false) } }
  function selectStory(item: StoryRecord) { setLanguage(item.default_language); navigate(adminPath(`stories/${item.id}`)) }
  async function addPage() { if (!detail) return; await api.createStoryPage(detail.id, { layout: 'full_bleed' }); await loadDetail(detail.id) }
  async function archive(item: StoryRecord) { if (!window.confirm(ar ? 'أرشفة القصة؟' : 'Archive story?')) return; await api.archiveStory(item.id); await load() }
  if (routeStoryId && detailLoading && !detail) return <LoadingState label={ar ? 'جارٍ تحميل القصة...' : 'Loading story...'} />
  if (detail) return (
    <div className="page-stack story-editor--three">
      <section className="page-intro">
        <div>
          <button className="text-link story-back" type="button" onClick={() => { setDetail(null); navigate(adminPath('stories')) }}>← {ar ? 'كل القصص' : 'All stories'}</button>
          <h2>{detail.title_ar}</h2>
          <p>{typeLabels[locale][detail.type]} — {detail.pages.length} {ar ? 'صفحة' : 'pages'} — {detail.visual_style_name || (ar ? 'بدون استايل' : 'No style')}</p>
        </div>
        <div className="page-intro__actions">
          <select className="language-select" value={language} onChange={(event) => setLanguage(event.target.value)}>{detail.languages.map((item) => <option value={item} key={item}>{item.toUpperCase()}</option>)}</select>
          <button className="button button--ghost" type="button" onClick={() => void navigator.clipboard.writeText(detail.id)}><Icon name="edit" size={14}/>{ar ? 'نسخ' : 'Copy'}</button>
          <button className="button button--primary" type="button" onClick={() => void addPage()}><Icon name="plus" size={16}/>{ar ? 'إضافة صفحة' : 'Add page'}</button>
        </div>
      </section>

      <div className="editor-summary">
        <StatusBadge status={detail.status} />
        <span>{ar ? 'ترتيب الصفحات الحالي • رفع صور جماعي' : 'Current page order • Bulk image upload'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <label className="button button--ghost file-button" style={{ fontSize: 12 }}>
            <Icon name="upload" size={13}/>{ar ? 'رفع صور جماعي' : 'Bulk images'}
            <input type="file" accept="image/*" multiple onChange={async (e) => { const files = Array.from(e.target.files || []); for (let i = 0; i < files.length; i++) { const f = files[i]; const created = await api.createAsset({ title_ar: `${detail.title_ar} - صورة ${detail.pages.length + i + 1}`, kind: 'image', source: 'upload', status: 'ready', original_filename: f.name, mime_type: f.type, visibility: 'private' }); await api.uploadAssetFile(created.data.id, f); await api.createStoryPage(detail.id, { layout: 'full_bleed', image_asset_id: created.data.id }); } await loadDetail(detail.id); (e.target as HTMLInputElement).value = '' }} />
          </label>
        </div>
      </div>

      <div className="story-editor-layout">
        {/* Left: Page list */}
        <aside className="story-editor__nav">
          <div className="story-editor__nav-header">
            <strong>{ar ? 'الصفحات' : 'Pages'} ({detail.pages.length})</strong>
            <span style={{ fontSize: 11, color: '#64748b' }}>{ar ? 'الترتيب الحالي' : 'Current order'}</span>
          </div>
          <div className="story-pages-nav">
            {detail.pages.map((p, idx) => (
              <button key={p.id} className="story-page-thumb" onClick={() => document.getElementById(`page-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                <span className="thumb-number">{idx + 1}</span>
                <span className="thumb-preview"><AssetImage id={p.image_asset_id} /></span>
                <span className="thumb-title">{ar ? 'صفحة' : 'Page'} {p.page_number}</span>
              </button>
            ))}
            <button className="story-page-thumb story-page-thumb--add" onClick={() => void addPage()}><Icon name="plus" size={18}/><span>{ar ? 'إضافة صفحة' : 'Add page'}</span></button>
          </div>
        </aside>

        {/* Middle: Editor */}
        <main className="story-editor__main">
          {detailLoading && !detail.pages.length ? <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'}/> : detail.pages.length ? <div className="story-pages">{detail.pages.map((page) => <div id={`page-${page.id}`} key={page.id}><StoryPageEditor story={detail} page={page} language={language} imageAssets={imageAssets} audioAssets={audioAssets} onReload={() => loadDetail(detail.id)} /></div>)}</div> : <EmptyState title={ar ? 'القصة بلا صفحات' : 'Story has no pages'} description={ar ? 'أضف الصفحة الأولى ثم ارفع الصورة والنص والصوت لكل لغة.' : 'Add the first page, then upload its image, text, and narration per language.'} action={<button className="button button--primary" type="button" onClick={() => void addPage()}><Icon name="plus" size={16}/>{ar ? 'الصفحة الأولى' : 'First page'}</button>}/>}
        </main>

        {/* Right: Status */}
        <aside className="story-editor__status">
          <div className="status-card">
            <h4>{ar ? 'حالة القصة' : 'Status'}</h4>
            <div className="status-grid">
              <div><small>{ar ? 'الصور' : 'Images'}</small><strong style={{ color: detail.pages.every(p => p.image_asset_id) ? '#16a34a' : '#d97706' }}>{detail.pages.filter(p => p.image_asset_id).length} / {detail.pages.length}</strong></div>
              <div><small>{language.toUpperCase()} نص</small><strong>{detail.pages.filter(p => p.localizations.find(l => l.language === language)?.body_text).length} / {detail.pages.length}</strong></div>
              <div><small>{language.toUpperCase()} صوت</small><strong>{detail.pages.filter(p => p.localizations.find(l => l.language === language)?.narration_asset_id).length} / {detail.pages.length}</strong></div>
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <span className="data-unavailable">{ar ? 'معاينة الأجهزة غير متاحة بعد' : 'Device preview is not available yet'}</span>
              <button className="button button--ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(detail, null, 2))}>JSON</button>
            </div>
          </div>
          <div className="status-card" style={{ marginTop: 12 }}>
            <h4>{ar ? 'أخطاء النشر' : 'Publish errors'}</h4>
            <ul style={{ fontSize: 12, color: '#64748b', paddingInlineStart: 16 }}>
              {!detail.pages.every(p => p.image_asset_id) && <li>{ar ? 'صفحات بلا صور' : 'Pages without images'}</li>}
              {detail.pages.filter(p => !p.localizations.find(l => l.language === language)?.body_text).length > 0 && <li>{ar ? `نصوص ناقصة ${language}` : `Missing ${language} text`}</li>}
              {!detail.visual_style_id && <li>{ar ? 'بدون استايل بصري' : 'No visual style'}</li>}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
  return <div className="page-stack"><section className="page-intro"><div><span className="eyebrow">{ar ? 'القصص والكوميكس' : 'Stories & comics'}</span><h2>{ar ? 'محرر القصص المصورة' : 'Visual story editor'}</h2><p>{ar ? 'أنشئ قصة متعددة الصفحات واللغات، واربط صورة وصوتًا لكل صفحة. فقاعات الحوار اختيارية.' : 'Create multilingual paged stories with page images and narration. Dialogue bubbles remain optional.'}</p></div><button className="button button--primary" type="button" onClick={create}><Icon name="plus" size={16}/>{ar ? 'قصة جديدة' : 'New story'}</button></section>{error && <div className="inline-alert inline-alert--error">{error}</div>}<section className="panel panel--table"><header className="panel__header panel__header--filters"><div><span className="panel__kicker">{ar ? 'المكتبة' : 'Library'}</span><h3>{items.length}</h3></div><ListToolbar searchValue={query} onSearchChange={list.setQuery} searchPlaceholder={ar ? 'بحث...' : 'Search...'} fields={FILTER_FIELDS(ar, locale)} values={filters} defaults={DEFAULT_FILTERS} onApply={(next) => list.setFilters(next)} onClear={list.clearFilters} onRemove={(key) => list.setFilter(key as keyof typeof DEFAULT_FILTERS, '')} trailing={<><SavedViewsMenu storageKey="stories" currentSearch={list.search} onApply={(search) => navigate(`${adminPath('stories')}${search}`)}/><ColumnManager columns={COLUMNS.map((column) => ({ ...column, label: columnLabels[locale][column.label as keyof (typeof columnLabels)['ar']] }))} hidden={columns.hidden} onToggle={columns.toggle} onReset={columns.reset}/></>}/></header>{loading ? <LoadingState label={ar ? 'جارٍ التحميل...' : 'Loading...'}/> : items.length ? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{ar ? 'القصة' : 'Story'}</th>{columns.isVisible('type') && <th>{ar ? 'النوع' : 'Type'}</th>}{columns.isVisible('series') && <th>{ar ? 'السلسلة' : 'Series'}</th>}{columns.isVisible('languages') && <th>{ar ? 'اللغات' : 'Languages'}</th>}{columns.isVisible('pages') && <th>{ar ? 'الصفحات' : 'Pages'}</th>}{columns.isVisible('status') && <th>{ar ? 'الحالة' : 'Status'}</th>}<th/></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><button className="entity-cell entity-cell--button" type="button" onClick={() => void selectStory(item)}><span className="entity-avatar"><Icon name="books" size={18}/></span><div><strong>{item.title_ar}</strong><small>{item.slug}</small></div></button></td>{columns.isVisible('type') && <td>{typeLabels[locale][item.type]}</td>}{columns.isVisible('series') && <td>{item.series_title || '—'}</td>}{columns.isVisible('languages') && <td>{item.languages.join(' · ')}</td>}{columns.isVisible('pages') && <td>{Number(item.pages_count ?? 0)}</td>}{columns.isVisible('status') && <td><StatusBadge status={item.status}/></td>}<td><div className="table-actions"><button className="button button--ghost" type="button" onClick={() => void selectStory(item)}>{ar ? 'فتح المحرر' : 'Open editor'}</button><button className="icon-button icon-button--small" type="button" onClick={() => edit(item)} aria-label={`${ar ? 'تعديل' : 'Edit'}: ${item.title_ar}`}><Icon name="edit" size={14}/></button><button className="icon-button icon-button--small icon-button--danger" type="button" onClick={() => void archive(item)} aria-label={`${ar ? 'أرشفة' : 'Archive'}: ${item.title_ar}`}><Icon name="archive" size={14}/></button></div></td></tr>)}</tbody></table></div> : <EmptyState title={ar ? 'لا توجد قصص بعد' : 'No stories yet'} description={ar ? 'أنشئ أول قصة وأضف صفحاتها وصوتها.' : 'Create the first story and add pages and narration.'}/>}</section><Modal open={open} onClose={() => !saving && setOpen(false)} title={editing ? (ar ? 'تعديل القصة' : 'Edit story') : (ar ? 'قصة جديدة' : 'New story')}><form className="entity-form" onSubmit={submit}><div className="form-grid"><label className="field"><span>{ar ? 'العنوان *' : 'Title *'}</span><input value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })}/></label><label className="field"><span>Slug</span><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })}/></label></div><div className="form-grid form-grid--three"><label className="field"><span>{ar ? 'النوع' : 'Type'}</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as StoryType })}>{types.map((item) => <option value={item} key={item}>{typeLabels[locale][item]}</option>)}</select></label><label className="field"><span>{ar ? 'من عمر' : 'Min age'}</span><input type="number" min="3" max="12" value={form.age_min} onChange={(event) => setForm({ ...form, age_min: event.target.value })}/></label><label className="field"><span>{ar ? 'إلى عمر' : 'Max age'}</span><input type="number" min="3" max="12" value={form.age_max} onChange={(event) => setForm({ ...form, age_max: event.target.value })}/></label></div><div className="form-grid"><label className="field"><span>{ar ? 'السلسلة' : 'Series'}</span><select value={form.series_id} onChange={(event) => setForm({ ...form, series_id: event.target.value })}><option value="">—</option>{series.map((item) => <option value={item.id} key={item.id}>{item.title_ar}</option>)}</select></label><label className="field"><span>{ar ? 'الاستايل' : 'Visual style'}</span><select value={form.visual_style_id} onChange={(event) => setForm({ ...form, visual_style_id: event.target.value })}><option value="">—</option>{styles.map((item) => <option value={item.id} key={item.id}>{ar ? item.name_ar : item.name_en}</option>)}</select></label></div><label className="field"><span>{ar ? 'اللغات — افصل بفاصلة' : 'Languages — comma separated'}</span><input dir="ltr" value={form.languages} onChange={(event) => setForm({ ...form, languages: event.target.value })}/></label><label className="field"><span>{ar ? 'الوصف' : 'Description'}</span><textarea rows={3} value={form.description_ar} onChange={(event) => setForm({ ...form, description_ar: event.target.value })}/></label><label className="field"><span>{ar ? 'الحالة' : 'Status'}</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ContentStatus })}>{statuses.map((status) => <option value={status} key={status}>{statusLabels[locale][status]}</option>)}</select></label><div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="button button--primary" disabled={saving}>{ar ? 'حفظ' : 'Save'}</button></div></form></Modal></div>
}
