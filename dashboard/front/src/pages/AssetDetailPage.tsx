import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { AssetDetail } from '../types/api'

function bytes(value?: number | null) {
  if (!value) return '—'
  const units = ['B', 'KB', 'MB', 'GB']; let size = value; let index = 0
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`
}
function AssetViewer({ asset }: { asset: AssetDetail }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (asset.status !== 'ready' || !['image', 'audio', 'video'].includes(asset.kind)) return
    let active = true; let objectUrl = ''
    void api.assetBlob(asset.id).then((blob) => { if (active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) } }).catch(() => undefined)
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [asset.id, asset.kind, asset.status])
  if (!url) return <div className="asset-viewer__empty"><Icon name={asset.kind === 'audio' || asset.kind === 'video' ? 'play' : 'media'} size={34} /><span>{asset.status === 'ready' ? '…' : asset.status}</span></div>
  if (asset.kind === 'image') return <img className="asset-viewer__image" src={url} alt={asset.title_ar} />
  if (asset.kind === 'audio') return <audio className="asset-viewer__audio" src={url} controls preload="metadata" />
  return <video className="asset-viewer__video" src={url} controls preload="metadata" />
}
function assetEntityPath(entityType: string, entityId: string) {
  const routes: Record<string, string> = {
    planet: `planets/${entityId}`,
    series: `series/${entityId}`,
    episode: `episodes/${entityId}`,
    character: `characters/${entityId}`,
    book: `library-content/books/${entityId}`,
    game: `library-content/games/${entityId}`,
    project: `library-content/projects/${entityId}`,
    story: 'stories',
    story_page: 'stories',
    season: 'seasons',
    category: 'taxonomy',
  }
  return routes[entityType] ? adminPath(routes[entityType]) : null
}
export function AssetDetailPage() {
  const { locale } = usePreferences(); const ar = locale === 'ar'; const { id = '' } = useParams()
  const [asset, setAsset] = useState<AssetDetail | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState('')
  const load = useCallback(async () => { setLoading(true); setError(''); try { setAsset((await api.asset(id)).data) } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الأصل' : 'Unable to load asset') } finally { setLoading(false) } }, [ar, id])
  useEffect(() => { void load() }, [load])
  if (loading && !asset) return <LoadingState label={ar ? 'جارٍ تحميل الأصل...' : 'Loading asset...'} />
  if (error && !asset) return <ErrorState message={error} onRetry={() => void load()} />
  if (!asset) return <EmptyState title={ar ? 'الأصل غير موجود' : 'Asset not found'} description="" />
  return <div className="page-stack">
    <EntityHeader breadcrumbs={[{ label: ar ? 'مكتبة الوسائط' : 'Media library', to: adminPath('media') }, { label: asset.title_ar }]} title={asset.title_ar} subtitle={asset.original_filename || asset.expected_path || undefined} meta={<><span>{asset.kind}</span><span>{bytes(asset.size_bytes)}</span><span>{asset.visibility}</span></>} status={<span className={`asset-status asset-status--${asset.status}`}>{asset.status}</span>} actions={<Link className="button button--secondary" to={adminPath('media')}><Icon name="edit" size={16} />{ar ? 'إدارة' : 'Manage'}</Link>} />
    <DetailTabs tabs={[
      { key: 'preview', label: ar ? 'المعاينة' : 'Preview', content: <section className="asset-viewer panel"><AssetViewer asset={asset} /></section> },
      { key: 'details', label: ar ? 'التفاصيل' : 'Details', content: <section className="panel"><div className="detail-fields detail-panel-pad"><div><span>{ar ? 'الحالة' : 'Status'}</span><strong>{asset.status}</strong></div><div><span>{ar ? 'النوع' : 'Kind'}</span><strong>{asset.kind}</strong></div><div><span>{ar ? 'المسار' : 'Path'}</span><strong dir="ltr">{asset.expected_path || asset.r2_key || '—'}</strong></div><div><span>{ar ? 'اللغة' : 'Language'}</span><strong>{asset.language || '—'}</strong></div><div><span>{ar ? 'الأبعاد المتوقعة' : 'Expected dimensions'}</span><strong>{asset.expected_width && asset.expected_height ? `${asset.expected_width}×${asset.expected_height}` : '—'}</strong></div><div><span>{ar ? 'الأسلوب البصري' : 'Visual style'}</span><strong>{asset.visual_style_name || '—'}</strong></div></div></section> },
      { key: 'usage', label: ar ? 'أماكن الاستخدام' : 'Usage', badge: asset.links.length, content: asset.links.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>{ar ? 'الكيان' : 'Entity'}</th><th>{ar ? 'الدور' : 'Role'}</th><th>{ar ? 'اللغة' : 'Language'}</th><th>{ar ? 'الترتيب' : 'Order'}</th></tr></thead><tbody>{asset.links.map((link) => { const path = assetEntityPath(link.entity_type, link.entity_id); return <tr key={link.id}><td>{path ? <Link to={path}>{link.entity_type} · {link.entity_id}</Link> : <span>{link.entity_type} · {link.entity_id}</span>}</td><td>{link.role}</td><td>{link.language || '—'}</td><td>{link.sort_order}</td></tr> })}</tbody></table></div> : <EmptyState title={ar ? 'الأصل غير مرتبط' : 'Asset is not linked'} description={ar ? 'لا توجد روابط asset_links مسجلة لهذا الأصل.' : 'No asset_links are recorded for this asset.'} /> },
    ]} />
  </div>
}
