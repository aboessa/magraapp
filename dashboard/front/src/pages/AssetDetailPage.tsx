import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { AssetDetail } from '../types/api'

function bytes(value?: number | null) {
  if (!value) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`
}

function AssetViewer({ asset }: { asset: AssetDetail }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (asset.status !== 'ready' || !['image', 'audio', 'video'].includes(asset.kind)) return
    let active = true
    let objectUrl = ''
    void api
      .assetBlob(asset.id)
      .then((blob) => {
        if (active) {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
      .catch(() => undefined)
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [asset.id, asset.kind, asset.status])

  if (!url) {
    return (
      <div
        style={{
          padding: 40,
          background: 'var(--surface-sunken)',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        <Icon name={asset.kind === 'audio' || asset.kind === 'video' ? 'play' : 'media'} size={38} />
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{asset.status === 'ready' ? 'Loading preview...' : asset.status}</span>
      </div>
    )
  }

  if (asset.kind === 'image') {
    return (
      <div style={{ background: '#09090b', padding: 20, borderRadius: 8, display: 'flex', justifyContent: 'center' }}>
        <img src={url} alt={asset.title_ar} style={{ maxWidth: '100%', maxHeight: 420, objectFit: 'contain' }} />
      </div>
    )
  }

  if (asset.kind === 'audio') {
    return (
      <div style={{ padding: 24, background: 'var(--surface-sunken)', borderRadius: 8 }}>
        <audio src={url} controls preload="metadata" style={{ width: '100%' }} />
      </div>
    )
  }

  return (
    <div style={{ background: '#000', borderRadius: 8, overflow: 'hidden' }}>
      <video src={url} controls preload="metadata" style={{ width: '100%', maxHeight: 420 }} />
    </div>
  )
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
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const { id = '' } = useParams()
  const [asset, setAsset] = useState<AssetDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'preview' | 'details' | 'usage'>('preview')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAsset((await api.asset(id)).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل الأصل' : 'Unable to load asset')
    } finally {
      setLoading(false)
    }
  }, [ar, id])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !asset) return <LoadingState label={ar ? 'جارٍ تحميل الأصل...' : 'Loading asset...'} />
  if (error && !asset) return <ErrorState message={error} onRetry={() => void load()} />
  if (!asset) return <EmptyState title={ar ? 'الأصل غير موجود' : 'Asset not found'} description="" />

  const links = asset.links || []

  return (
    <div className="page-stack">
      {/* Top Panoramic Command Strip */}
      <div className="admin-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Link to={adminPath('media')} className="button button--ghost button--small">
            <Icon name="arrow" size={14} />
            <span>{ar ? 'مكتبة الوسائط' : 'Media Library'}</span>
          </Link>
          <span className="live-status-pulse" />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 className="admin-page-title" style={{ margin: 0 }}>
                {asset.title_ar || asset.original_filename || id}
              </h1>
              <span className={`status-badge status-badge--${asset.status === 'ready' ? 'published' : 'draft'}`}>
                {asset.status}
              </span>
            </div>
            <p className="admin-page-subtitle" style={{ margin: 0 }} dir="ltr">
              {asset.expected_path || asset.r2_key || '—'} · {bytes(asset.size_bytes)} · {asset.kind}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Link className="button button--secondary button--small" to={adminPath('media')}>
            <Icon name="edit" size={14} />
            <span>{ar ? 'إدارة في المكتبة' : 'Manage'}</span>
          </Link>
          <button className="button button--secondary button--small" onClick={() => void load()}>
            <Icon name="refresh" size={14} />
          </button>
        </div>
      </div>

      {/* Bento Glass KPI Matrix */}
      <section className="bento-glass-matrix" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'نوع الأصل' : 'Asset Kind'}</span>
            <div className="bento-glass-card__icon"><Icon name="grid" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ textTransform: 'capitalize' }}>{asset.kind}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{asset.visibility || 'public'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'حجم الملف' : 'File Size'}</span>
            <div className="bento-glass-card__icon"><Icon name="clock" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{bytes(asset.size_bytes)}</div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend neutral">{asset.size_bytes ? `${asset.size_bytes.toLocaleString()} bytes` : '—'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الأبعاد البصرية' : 'Dimensions'}</span>
            <div className="bento-glass-card__icon"><Icon name="eye" size={16} /></div>
          </div>
          <div className="bento-glass-card__value" style={{ fontSize: 18 }}>
            {asset.expected_width && asset.expected_height ? `${asset.expected_width}×${asset.expected_height}` : '—'}
          </div>
          <div className="bento-glass-card__footer">
            <span className="bento-glass-card__trend positive">{asset.visual_style_name || 'Standard'}</span>
          </div>
        </article>

        <article className="bento-glass-card">
          <div className="bento-glass-card__header">
            <span className="bento-glass-card__title">{ar ? 'الارتباطات التشغيلية' : 'Usages'}</span>
            <div className="bento-glass-card__icon"><Icon name="link" size={16} /></div>
          </div>
          <div className="bento-glass-card__value">{links.length}</div>
          <div className="bento-glass-card__footer">
            <span className={`bento-glass-card__trend ${links.length > 0 ? 'positive' : 'neutral'}`}>
              {links.length > 0 ? (ar ? 'مربوط بكيانات' : 'Linked') : (ar ? 'أصل حر' : 'Unlinked')}
            </span>
          </div>
        </article>
      </section>

      {/* Tabs Bar */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10, overflowX: 'auto' }}>
        <button
          className={`button ${tab === 'preview' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('preview')}
        >
          {ar ? 'المعاينة التفاعلية' : 'Preview'}
        </button>
        <button
          className={`button ${tab === 'details' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('details')}
        >
          {ar ? 'البيانات الفنية و R2' : 'Details & Storage'}
        </button>
        <button
          className={`button ${tab === 'usage' ? 'button--primary' : 'button--ghost'} button--small`}
          onClick={() => setTab('usage')}
        >
          {ar ? 'أماكن الاستخدام' : 'Usage References'} ({links.length})
        </button>
      </div>

      {/* Enterprise Split Workspace (68% Operational Master / 32% Live Sticky Inspector) */}
      <div className="admin-split-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 18, alignItems: 'start' }}>
        {/* Operational Master Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {tab === 'preview' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="eye" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'معاينة الوسائط' : 'Asset Live Preview'}</h3>
              </div>
              <AssetViewer asset={asset} />
            </div>
          )}

          {tab === 'details' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Icon name="file-text" size={18} />
                <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'المواصفات الفنية وتخزين Cloudflare R2' : 'Technical Specifications'}</h3>
              </div>

              <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 12 }}>
                <div><dt>{ar ? 'الحالة' : 'Status'}</dt><dd><strong>{asset.status}</strong></dd></div>
                <div><dt>{ar ? 'النوع' : 'Kind'}</dt><dd><span className="track-badge">{asset.kind}</span></dd></div>
                <div><dt>{ar ? 'مسار التخزين (R2 Key)' : 'R2 Key'}</dt><dd><code dir="ltr">{asset.expected_path || asset.r2_key || '—'}</code></dd></div>
                <div><dt>{ar ? 'اللغة' : 'Language'}</dt><dd>{asset.language || '—'}</dd></div>
                <div><dt>{ar ? 'الأبعاد' : 'Dimensions'}</dt><dd>{asset.expected_width && asset.expected_height ? `${asset.expected_width}×${asset.expected_height}` : '—'}</dd></div>
                <div><dt>{ar ? 'الأسلوب البصري' : 'Visual Style'}</dt><dd>{asset.visual_style_name || '—'}</dd></div>
              </dl>
            </div>
          )}

          {tab === 'usage' && (
            <div className="panel" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name="link" size={18} />
                  <h3 style={{ margin: 0, fontSize: 16 }}>{ar ? 'الكيانات المستهلكة لهذا الأصل' : 'Referenced In'}</h3>
                </div>
                <span className="badge badge--pill">{links.length} usages</span>
              </div>

              {links.length ? (
                <div className="table-scroll" tabIndex={0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{ar ? 'الكيان' : 'Entity'}</th>
                        <th>{ar ? 'الدور' : 'Role'}</th>
                        <th>{ar ? 'اللغة' : 'Language'}</th>
                        <th>{ar ? 'الترتيب' : 'Order'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.map((link) => {
                        const path = assetEntityPath(link.entity_type, link.entity_id)
                        return (
                          <tr key={link.id}>
                            <td>
                              {path ? (
                                <Link to={path} style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                  {link.entity_type} · <code>{link.entity_id.slice(0, 8)}</code>
                                </Link>
                              ) : (
                                <span>{link.entity_type} · {link.entity_id}</span>
                              )}
                            </td>
                            <td><span className="badge badge--pill">{link.role}</span></td>
                            <td>{link.language || '—'}</td>
                            <td>{link.sort_order}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title={ar ? 'الأصل غير مرتبط' : 'Asset is not linked'}
                  description={ar ? 'لا توجد روابط asset_links مسجلة لهذا الأصل.' : 'No asset_links are recorded for this asset.'}
                />
              )}
            </div>
          )}
        </div>

        {/* Sticky Asset Inspector */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 16 }}>
          {/* CDN & Delivery */}
          <div className="panel" style={{ padding: 16 }}>
            <h4 style={{ margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="globe" size={16} />
              <span>{ar ? 'شبكة التوزيع (CDN)' : 'Edge Delivery'}</span>
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Cloudflare R2:</span>
                <span className="badge badge--pill">Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--muted)' }}>Cache TTL:</span>
                <strong>31536000s (Immutable)</strong>
              </div>
            </div>
          </div>

          {/* AI Media Copilot */}
          <div className="panel" style={{ padding: 16, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))', borderColor: 'rgba(99, 102, 241, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--primary)' }}>
              <Icon name="sparkles" size={16} />
              <strong style={{ fontSize: 13 }}>{ar ? 'مستشار الوسائط الذكي' : 'DAM Copilot'}</strong>
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, margin: 0, color: 'var(--muted)' }}>
              {links.length > 0
                ? (ar ? 'الأصل مستخدم في كيانات إنتاجية نشطة؛ لا يجوز حذفه أو استبدال مساره دون ترحيل الروابط.' : 'Asset has active downstream links. Safe-deletion gating is enforced.')
                : (ar ? 'أصل حر غير مرتبط بأي كيان؛ يمكن أرشفته بأمان إذا لم تكن هناك حاجة إليه.' : 'Unreferenced media asset eligible for storage cleanup or future tagging.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
