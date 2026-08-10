import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { usePreferences } from '../context/preferences'
import type { AssetRecord } from '../types/api'

/**
 * اختيار وسائط للمحرِّرات: معاينة حقيقية + بحث في المكتبة + رفع من نفس المكان.
 *
 * ## لماذا صورة مُحمَّلة بالمصادقة لا `<img src>` مباشر
 *
 * `/admin/assets/:id/content` محروس بترويسة `Authorization`، فلا يمكن لعنصر
 * `<img>` جلبها. تُجلب هنا كـ`blob` ويُبنى `objectURL` ويُبطَل عند التفكيك،
 * وإلا تسرّبت مراجع لكل صورة في كل قائمة.
 *
 * ## لماذا الرفع داخل المنتقي
 *
 * صورة قسم في صفحة الموقع تُرفع في اللحظة نفسها التي يُكتب فيها القسم. إرسال
 * المحرِّر إلى مكتبة الوسائط في تبويب آخر ثم مطالبته بنسخ المعرّف هو المسار الذي
 * ينتهي بحقول معرّف فارغة وأقسام بلا صور.
 */

const copy = {
  ar: {
    pick: 'اختيار وسيط',
    pickerTitle: 'مكتبة الوسائط',
    pickerHint: 'ابحث ثم اختر، أو ارفع ملفًا جديدًا. الرفع يُنشئ أصلًا في المكتبة ويربطه هنا.',
    search: 'بحث',
    empty: 'لا وسائط مطابقة',
    loading: 'جارٍ التحميل…',
    status: 'الحالة',
    clear: 'إزالة',
    browse: 'استعراض',
    upload: 'رفع ملف',
    uploading: 'جارٍ الرفع…',
    uploadFailed: 'تعذر الرفع',
    missingPreview: 'لا معاينة',
    none: 'لا وسيط محدَّد',
    kindImage: 'صور',
    kindAudio: 'صوت',
  },
  en: {
    pick: 'Select media',
    pickerTitle: 'Media library',
    pickerHint: 'Search and select, or upload a new file. Uploading creates a library asset and links it here.',
    search: 'Search',
    empty: 'No matching media',
    loading: 'Loading…',
    status: 'Status',
    clear: 'Remove',
    browse: 'Browse',
    upload: 'Upload file',
    uploading: 'Uploading…',
    uploadFailed: 'Upload failed',
    missingPreview: 'No preview',
    none: 'No media selected',
    kindImage: 'Images',
    kindAudio: 'Audio',
  },
}

/// معاينة أصل واحد. تفشل بهدوء إلى شكل محايد: صورة مفقودة ليست خطأ صفحة.
export function MediaThumb({ assetId, size = 44, alt }: { assetId: string | null; size?: number; alt?: string }) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!assetId) { setUrl(null); setFailed(false); return }
    let objectUrl: string | null = null
    let cancelled = false
    setFailed(false)
    void api.assetBlob(assetId)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [assetId])

  if (!assetId) {
    return <span className="media-thumb media-thumb--none" style={{ width: size, height: size }} aria-hidden="true" />
  }
  if (url) {
    return <img className="media-thumb" style={{ width: size, height: size }} src={url} alt={alt ?? assetId} />
  }
  return (
    <span
      className={failed ? 'media-thumb media-thumb--failed' : 'media-thumb media-thumb--loading'}
      style={{ width: size, height: size }}
      role="img"
      aria-label={failed ? text.missingPreview : text.loading}
    >{failed ? '!' : ''}</span>
  )
}

export function MediaPicker({
  open,
  kind,
  onClose,
  onPick,
}: {
  open: boolean
  kind: 'image' | 'audio'
  onClose: () => void
  onPick: (assetId: string) => void
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [term, setTerm] = useState('')
  const [rows, setRows] = useState<AssetRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.assets({ kind, search: term, limit: 24 })
      setRows(response.data)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [kind, term])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => { void load() }, 250)
    return () => window.clearTimeout(timer)
  }, [load, open])

  async function upload(file: File) {
    setUploading(true)
    setUploadError('')
    try {
      const created = await api.createAsset({
        title_ar: file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
        kind,
        source: 'upload',
        status: 'planned',
        original_filename: file.name,
        mime_type: file.type || undefined,
        visibility: 'public',
      })
      await api.uploadAssetFile(created.data.id, file)
      onPick(created.data.id)
      onClose()
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : text.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal open={open} title={text.pickerTitle} description={text.pickerHint} onClose={onClose}>
      <div className="entity-form">
        <label className="field">
          <span>{text.search}</span>
          <input value={term} onChange={(event) => setTerm(event.target.value)} autoFocus />
        </label>

        <label className="field">
          <span>{text.upload}</span>
          <input
            type="file"
            accept={kind === 'image' ? 'image/*' : 'audio/*'}
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          {uploading && <small>{text.uploading}</small>}
          {uploadError && <small className="field__error">{uploadError}</small>}
        </label>

        {loading && <p className="data-unavailable">{text.loading}</p>}
        {!loading && !rows.length && <p className="data-unavailable">{text.empty}</p>}
        <ul className="media-picker">
          {rows.map((row) => (
            <li key={row.id}>
              <button type="button" className="media-picker__row" onClick={() => { onPick(row.id); onClose() }}>
                {kind === 'image' ? <MediaThumb assetId={row.id} size={48} /> : <Icon name="play" size={20} />}
                <span className="media-picker__meta">
                  <strong>{row.title_ar || row.id}</strong>
                  <code dir="ltr">{row.id}</code>
                  <small>{text.status}: <span dir="ltr">{row.status}</span></small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

/// حقل وسيط كامل: معاينة + معرّف + استعراض + إزالة.
export function MediaField({
  label,
  value,
  onChange,
  kind = 'image',
  hint,
}: {
  label: string
  value: string | null
  onChange: (assetId: string | null) => void
  kind?: 'image' | 'audio'
  hint?: string
}) {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [picking, setPicking] = useState(false)

  return (
    <div className="field media-field">
      <span>{label}</span>
      <div className="media-field__row">
        {kind === 'image' && <MediaThumb assetId={value} size={44} />}
        <input
          dir="ltr"
          value={value ?? ''}
          placeholder={text.none}
          onChange={(event) => onChange(event.target.value.trim() || null)}
        />
        <button className="button button--ghost" type="button" onClick={() => setPicking(true)}>
          <Icon name="search" size={15} />{text.browse}
        </button>
        {value && (
          <button className="icon-button icon-button--small" type="button" title={text.clear} aria-label={text.clear} onClick={() => onChange(null)}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {hint && <small>{hint}</small>}
      <MediaPicker open={picking} kind={kind} onClose={() => setPicking(false)} onPick={(id) => onChange(id)} />
    </div>
  )
}
