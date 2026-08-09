import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { AssetKind, AssetRecord, AssetStats } from '../types/api'

const kinds: AssetKind[] = ['image', 'audio', 'video', 'subtitle', 'document', 'manifest', 'archive']
const supported = /\.(?:avif|gif|jpe?g|png|webp|mp3|m4a|ogg|wav|mp4|m4v|webm|srt|vtt|json|m3u8|pdf|zip)$/i

type UploadForm = { title_ar: string; kind: AssetKind; visibility: 'public' | 'private'; language: string; file: File | null }
const initialForm: UploadForm = { title_ar: '', kind: 'image', visibility: 'private', language: '', file: null }

function bytes(value?: number | null) {
  if (!value) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value; let index = 0
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`
}

function stem(value: string) {
  return value.replaceAll('\\', '/').replace(/^.*?(assets\/images\/)/i, '$1').replace(/\.[^.\/]+$/, '').toLowerCase()
}

function relativePath(file: File) {
  const path = file.webkitRelativePath || file.name
  const normalized = path.replaceAll('\\', '/')
  const assetsIndex = normalized.toLowerCase().indexOf('assets/images/')
  return assetsIndex >= 0 ? normalized.slice(assetsIndex) : normalized.split('/').slice(1).join('/') || file.name
}

function kindFor(file: File): AssetKind {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  if (/\.(srt|vtt)$/i.test(file.name)) return 'subtitle'
  if (/\.m3u8$/i.test(file.name)) return 'manifest'
  if (/\.zip$/i.test(file.name)) return 'archive'
  return 'document'
}

function visibilityFor(path: string): 'public' | 'private' {
  return /\/(landing|marketing|worlds|store)\//i.test(`/${path}`) ? 'public' : 'private'
}

function AssetPreview({ asset }: { asset: AssetRecord }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [url, setUrl] = useState('')
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } }, { rootMargin: '180px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!visible || asset.kind !== 'image' || asset.status !== 'ready') return
    let objectUrl = ''
    let active = true
    void api.assetBlob(asset.id).then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }).catch(() => undefined)
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [asset.id, asset.kind, asset.status, visible])
  return <div className="asset-card__preview" ref={ref}>{url ? <img src={url} alt=""/> : <Icon name={asset.kind === 'image' ? 'media' : asset.kind === 'audio' ? 'play' : 'archive'} size={30}/>}</div>
}

export function MediaLibraryPage() {
  const { locale } = usePreferences(); const ar = locale === 'ar'
  const [items, setItems] = useState<AssetRecord[]>([]); const [stats, setStats] = useState<AssetStats | null>(null); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0); const [query, setQuery] = useState(''); const [status, setStatus] = useState(''); const [kind, setKind] = useState(''); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [open, setOpen] = useState(false); const [form, setForm] = useState<UploadForm>(initialForm); const [saving, setSaving] = useState(false); const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set()); const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null)
  const pageSize = 48
  const load = useCallback(async () => { setLoading(true); setError(''); try { const [assets, assetStats] = await Promise.all([api.assets({ q: query, status, kind, limit: pageSize, offset }), api.assetStats()]); setItems(assets.data); setTotal(assets.meta.total); setStats(assetStats.data) } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الوسائط' : 'Unable to load media') } finally { setLoading(false) } }, [ar, kind, offset, query, status])
  useEffect(() => { const timer = window.setTimeout(() => void load(), 180); return () => clearTimeout(timer) }, [load])
  useEffect(() => setOffset(0), [kind, query, status])

  async function allCatalogAssets() {
    const first = await api.assets({ status: 'all', limit: 200, offset: 0 })
    if (first.meta.total <= 200) return first.data
    const second = await api.assets({ status: 'all', limit: 200, offset: 200 })
    return [...first.data, ...second.data]
  }

  async function uploadOne(asset: AssetRecord, file: File) {
    setUploadingIds((current) => new Set(current).add(asset.id))
    try { await api.uploadAssetFile(asset.id, file) }
    finally { setUploadingIds((current) => { const next = new Set(current); next.delete(asset.id); return next }) }
  }

  async function replaceAsset(asset: AssetRecord, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { await uploadOne(asset, file); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر استبدال الملف' : 'Unable to replace file') }
  }

  async function folderUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).filter((file) => supported.test(file.name))
    event.target.value = ''
    if (!files.length) return
    setProgress({ done: 0, total: files.length, failed: 0 }); setError('')
    try {
      const catalog = await allCatalogAssets()
      const byStem = new Map(catalog.map((asset) => [stem(asset.expected_path || asset.original_filename || ''), asset]))
      let cursor = 0; let done = 0; let failed = 0
      const workers = Array.from({ length: Math.min(3, files.length) }, async () => {
        while (cursor < files.length) {
          const file = files[cursor++]; const relative = relativePath(file)
          try {
            let asset = byStem.get(stem(relative))
            if (!asset) {
              const created = await api.createAsset({ title_ar: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), kind: kindFor(file), source: 'import', status: 'planned', original_filename: file.name, expected_path: relative, mime_type: file.type || undefined, visibility: visibilityFor(relative), metadata: { imported_from_folder: true } })
              asset = { id: created.data.id } as AssetRecord
            }
            await uploadOne(asset, file)
          } catch { failed += 1 }
          done += 1; setProgress({ done, total: files.length, failed })
        }
      })
      await Promise.all(workers); await load()
      if (failed) setError(ar ? `اكتمل الرفع مع فشل ${failed} ملف. أعد اختيار المجلد وسيُستكمل الباقي.` : `Upload finished with ${failed} failures. Select the folder again to retry.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر الرفع الجماعي' : 'Bulk upload failed') }
    finally { setTimeout(() => setProgress(null), 3500) }
  }

  async function importCatalog(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    try { const result = await api.importAssetCatalog(await file.text()); setError(''); window.alert(ar ? `تمت مزامنة ${result.data.total} أصل.` : `Synchronized ${result.data.total} assets.`); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر استيراد الكتالوج' : 'Catalog import failed') }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); if (!form.file || !form.title_ar.trim()) return; setSaving(true)
    try { const created = await api.createAsset({ title_ar: form.title_ar.trim(), kind: form.kind, source: 'upload', status: 'planned', original_filename: form.file.name, mime_type: form.file.type, visibility: form.visibility, language: form.language || null }); await api.uploadAssetFile(created.data.id, form.file); setOpen(false); setForm(initialForm); await load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر رفع الملف' : 'Upload failed') }
    finally { setSaving(false) }
  }

  const statusCount = (name: string) => Number(stats?.by_status.find((item) => item.status === name)?.count ?? 0)
  return <div className="page-stack"><section className="page-intro"><div><span className="eyebrow">R2 Media Library</span><h2>{ar ? 'مكتبة الوسائط' : 'Media library'}</h2><p>{ar ? 'ارفع الصور والصوت والفيديو والترجمات، أو اختر مجلد الصور كاملًا ليُطابق أسماء الكتالوج تلقائيًا.' : 'Upload images, audio, video, and subtitles, or select the entire image folder for automatic catalog matching.'}</p></div><div className="page-intro__actions"><label className="button button--ghost file-button"><Icon name="refresh" size={16}/>{ar ? 'استيراد الكتالوج' : 'Import catalog'}<input type="file" accept=".md,.txt" onChange={(event) => void importCatalog(event)}/></label><label className="button button--secondary file-button"><Icon name="upload" size={16}/>{ar ? 'رفع مجلد كامل' : 'Upload folder'}<input type="file" multiple {...({ webkitdirectory: '', directory: '' } as Record<string, string>)} onChange={(event) => void folderUpload(event)}/></label><button className="button button--primary" type="button" onClick={() => { setForm(initialForm); setOpen(true) }}><Icon name="plus" size={16}/>{ar ? 'رفع ملف' : 'Upload file'}</button></div></section>{progress && <div className="upload-progress"><div><strong>{ar ? 'جاري رفع الملفات' : 'Uploading files'}</strong><span>{progress.done}/{progress.total}{progress.failed ? ` — ${progress.failed} ${ar ? 'فشل' : 'failed'}` : ''}</span></div><progress max={progress.total} value={progress.done}/></div>}{error && <div className="inline-alert inline-alert--error">{error}</div>}<div className="media-stats"><article><span>{ar ? 'جاهز' : 'Ready'}</span><strong>{statusCount('ready')}</strong></article><article><span>{ar ? 'بانتظار الملف' : 'Planned'}</span><strong>{statusCount('planned')}</strong></article><article className="media-stats__warning"><span>{ar ? 'مقاس مؤقت' : 'Temporary size'}</span><strong>{items.filter((item) => item.quality === 'temporary_size_mismatch').length}</strong></article><article><span>{ar ? 'المساحة' : 'Storage'}</span><strong>{bytes(Number(stats?.storage.total_bytes ?? 0))}</strong></article></div><section className="panel"><header className="panel__header panel__header--filters"><div><span className="panel__kicker">{ar ? 'الأصول' : 'Assets'}</span><h3>{total}</h3></div><div className="filters-row"><label className="search-field"><Icon name="search" size={16}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={ar ? 'اسم أو مسار...' : 'Name or path...'}/></label><select value={kind} onChange={(event) => setKind(event.target.value)}><option value="">{ar ? 'كل الأنواع' : 'All kinds'}</option>{kinds.map((item) => <option value={item} key={item}>{item}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{ar ? 'الحالات النشطة' : 'Active statuses'}</option><option value="all">{ar ? 'الكل' : 'All'}</option><option value="planned">planned</option><option value="ready">ready</option><option value="failed">failed</option></select></div></header>{loading && !items.length ? <LoadingState label={ar ? 'جارٍ تحميل الوسائط...' : 'Loading media...'}/> : error && !items.length ? <ErrorState message={error} onRetry={() => void load()}/> : items.length ? <><div className="asset-grid">{items.map((asset) => { const actual = asset.metadata.actual_dimensions; const expected = asset.expected_width && asset.expected_height ? `${asset.expected_width}×${asset.expected_height}` : null; return <article className="asset-card" key={asset.id}><AssetPreview asset={asset}/><div className="asset-card__body"><div className="asset-card__title"><strong>{asset.title_ar}</strong><span className={`asset-status asset-status--${asset.status}`}>{asset.status}</span></div><small title={asset.expected_path || asset.original_filename || ''}>{asset.expected_path || asset.original_filename}</small><div className="asset-card__meta"><span>{asset.kind}</span><span>{bytes(asset.size_bytes)}</span><span>{asset.visibility}</span></div>{asset.quality === 'temporary_size_mismatch' && <div className="size-warning"><Icon name="refresh" size={14}/><span>{ar ? 'مؤقت' : 'Temporary'}: {actual ? `${actual.width}×${actual.height}` : '—'} → {expected || '—'}</span></div>}<div className="asset-card__actions"><label className="button button--ghost file-button"><Icon name="upload" size={14}/>{asset.status === 'ready' ? (ar ? 'استبدال' : 'Replace') : (ar ? 'رفع' : 'Upload')}<input type="file" disabled={uploadingIds.has(asset.id)} onChange={(event) => void replaceAsset(asset, event)}/></label><Link className="button button--ghost" to={adminPath(`media/${asset.id}`)}>{ar ? 'فتح' : 'Open'}</Link><span>{Number(asset.links_count ?? 0)} {ar ? 'روابط' : 'links'}</span></div></div></article> })}</div><footer className="pagination"><button className="button button--ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>{ar ? 'السابق' : 'Previous'}</button><span>{offset + 1}–{Math.min(offset + pageSize, total)} / {total}</span><button className="button button--ghost" disabled={offset + pageSize >= total} onClick={() => setOffset(offset + pageSize)}>{ar ? 'التالي' : 'Next'}</button></footer></> : <EmptyState title={ar ? 'مكتبة الوسائط فارغة' : 'Media library is empty'} description={ar ? 'استورد IMAGE_PROMPTS_CATALOG.md أو ارفع أول ملف.' : 'Import IMAGE_PROMPTS_CATALOG.md or upload the first file.'}/>}</section><Modal open={open} onClose={() => !saving && setOpen(false)} title={ar ? 'رفع أصل جديد' : 'Upload new asset'}><form className="entity-form" onSubmit={submit}><label className="field"><span>{ar ? 'الاسم *' : 'Title *'}</span><input value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })}/></label><div className="form-grid form-grid--three"><label className="field"><span>{ar ? 'النوع' : 'Kind'}</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as AssetKind })}>{kinds.map((item) => <option value={item} key={item}>{item}</option>)}</select></label><label className="field"><span>{ar ? 'الوصول' : 'Visibility'}</span><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as UploadForm['visibility'] })}><option value="private">private</option><option value="public">public</option></select></label><label className="field"><span>{ar ? 'اللغة' : 'Language'}</span><input value={form.language} placeholder="ar" onChange={(event) => setForm({ ...form, language: event.target.value })}/></label></div><label className="field"><span>{ar ? 'الملف *' : 'File *'}</span><input type="file" required onChange={(event) => { const file = event.target.files?.[0] || null; setForm({ ...form, file, title_ar: form.title_ar || file?.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') || '', kind: file ? kindFor(file) : form.kind }) }}/></label><div className="form-actions"><button className="button button--ghost" type="button" onClick={() => setOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</button><button className="button button--primary" disabled={saving || !form.file}>{saving ? (ar ? 'جارٍ الرفع...' : 'Uploading...') : (ar ? 'رفع' : 'Upload')}</button></div></form></Modal></div>
}
