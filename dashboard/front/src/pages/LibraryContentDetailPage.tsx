import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { BookDetail, GameDetail, LibraryContentKind, ProjectDetail } from '../types/api'

type Detail = BookDetail | GameDetail | ProjectDetail
const validKinds: LibraryContentKind[] = ['books', 'games', 'projects']
function prettyJson(value: object) { return JSON.stringify(value, null, 2) }

export function LibraryContentDetailPage() {
  const { locale } = usePreferences()
  const ar = locale === 'ar'
  const { kind = '', id = '' } = useParams()
  const validKind = validKinds.includes(kind as LibraryContentKind) ? kind as LibraryContentKind : null
  const [item, setItem] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const labels = { books: ar ? 'كتاب' : 'Book', games: ar ? 'لعبة' : 'Game', projects: ar ? 'نشاط' : 'Activity' }
  const load = useCallback(async () => {
    if (!validKind) { setLoading(false); return }
    setLoading(true); setError('')
    try {
      const response = validKind === 'books' ? await api.book(id) : validKind === 'games' ? await api.game(id) : await api.project(id)
      setItem(response.data)
    } catch (caught) { setError(caught instanceof Error ? caught.message : ar ? 'تعذر تحميل المحتوى' : 'Unable to load content') }
    finally { setLoading(false) }
  }, [ar, id, validKind])
  useEffect(() => { void load() }, [load])
  if (!validKind) return <EmptyState title={ar ? 'نوع محتوى غير صالح' : 'Invalid content type'} description="" />
  if (loading && !item) return <LoadingState label={ar ? 'جارٍ تحميل المحتوى...' : 'Loading content...'} />
  if (error && !item) return <ErrorState message={error} onRetry={() => void load()} />
  if (!item) return <EmptyState title={ar ? 'العنصر غير موجود' : 'Content not found'} description="" />
  const game = validKind === 'games' ? item as GameDetail : null
  const book = validKind === 'books' ? item as BookDetail : null
  const project = validKind === 'projects' ? item as ProjectDetail : null
  const assets = item.assets ?? []
  return <div className="page-stack">
    <EntityHeader
      breadcrumbs={[{ label: ar ? 'الكتب والألعاب والأنشطة' : 'Books, games & activities', to: adminPath('library-content') }, { label: labels[validKind] }, { label: item.title_ar }]}
      title={item.title_ar}
      subtitle={project?.description_ar || game?.instructions_ar || undefined}
      meta={<><span>{item.age_min}–{item.age_max} {ar ? 'سنوات' : 'years'}</span><span>{item.is_free ? (ar ? 'مجاني' : 'Free') : (ar ? 'مدفوع' : 'Paid')}</span>{book && <span>{book.type}</span>}{game && <span>{game.engine_name || '—'}</span>}</>}
      status={<StatusBadge status={item.status} />}
      actions={<>
        {/* الاستوديو هو المكان الذي تُؤلَّف فيه الحزمة؛ هذه الصفحة تعرضها للقراءة */}
        {game && <Link className="button button--primary" to={adminPath(`games/${game.id}`)}><Icon name="games" size={16} />{ar ? 'استوديو الرسم' : 'Drawing studio'}</Link>}
        <Link className="button button--secondary" to={adminPath('library-content')}><Icon name="edit" size={16} />{ar ? 'تعديل' : 'Edit'}</Link>
      </>}
    />
    <DetailTabs tabs={[
      { key: 'overview', label: ar ? 'نظرة عامة' : 'Overview', content: <div className="dashboard-grid dashboard-grid--tracks"><article className="panel"><header className="panel__header"><h3>{ar ? 'بيانات التجربة' : 'Experience data'}</h3></header><div className="detail-fields"><div><span>{ar ? 'العمر' : 'Age'}</span><strong>{item.age_min}–{item.age_max}</strong></div><div><span>{ar ? 'المستوى القرائي' : 'Reading level'}</span><strong>{'reading_level' in item ? item.reading_level : '—'}</strong></div><div><span>{ar ? 'نمط التفاعل' : 'Interaction'}</span><strong>{'interaction_mode' in item ? item.interaction_mode : '—'}</strong></div><div><span>{ar ? 'الإشراف' : 'Supervision'}</span><strong>{item.supervision_level}</strong></div></div></article><article className="panel"><header className="panel__header"><h3>{ar ? 'السلامة' : 'Safety'}</h3></header><div className="detail-panel-pad">{item.safety_notes || <span className="data-unavailable">{ar ? 'لا توجد ملاحظات سلامة مسجلة.' : 'No safety notes recorded.'}</span>}</div></article></div> },
      ...(book ? [{ key: 'pages', label: ar ? 'الصفحات' : 'Pages', badge: book.pages.length, content: <div className="data-unavailable">{ar ? `يحتوي الكتاب على ${book.pages.length} صفحات مسجلة. محرر صفحات الكتب التفصيلي لم يُبنَ بعد؛ هذه ليست معاينة مصطنعة.` : `This book has ${book.pages.length} recorded pages. A dedicated book-page editor has not been built yet; no fabricated preview is shown.`}</div> }] : []),
      ...(game ? [{ key: 'game', label: ar ? 'الحزمة والتشغيل' : 'Pack & play', content: <div className="dashboard-grid dashboard-grid--tracks"><article className="panel"><header className="panel__header"><h3>{ar ? 'حزمة المحتوى' : 'Content pack'}</h3></header><pre className="detail-json">{prettyJson(game.content_pack)}</pre></article><article className="panel"><header className="panel__header"><h3>{ar ? 'نظام المساعدة' : 'Help system'}</h3></header><pre className="detail-json">{prettyJson(game.help_system)}</pre></article></div> }] : []),
      ...(project ? [{ key: 'activity', label: ar ? 'المواد والخطوات' : 'Materials & steps', content: <div className="dashboard-grid dashboard-grid--tracks"><article className="panel"><header className="panel__header"><h3>{ar ? 'المواد' : 'Materials'}</h3></header><ol className="detail-list">{project.materials.length ? project.materials.map((value) => <li key={value}>{value}</li>) : <li>{ar ? 'لا توجد مواد مسجلة.' : 'No materials recorded.'}</li>}</ol></article><article className="panel"><header className="panel__header"><h3>{ar ? 'الخطوات' : 'Steps'}</h3></header><ol className="detail-list">{project.steps.length ? project.steps.map((value) => <li key={value}>{value}</li>) : <li>{ar ? 'لا توجد خطوات مسجلة.' : 'No steps recorded.'}</li>}</ol></article></div> }] : []),
      { key: 'media', label: ar ? 'الوسائط المرتبطة' : 'Linked media', badge: assets.length, content: assets.length ? <div className="entity-grid">{assets.map((asset) => <Link className="entity-card" to={adminPath(`media/${asset.id}`)} key={asset.id}><div className="entity-card__media"><div className="entity-card__media--placeholder"><Icon name={asset.kind === 'audio' || asset.kind === 'video' ? 'play' : 'media'} size={26} /></div></div><strong>{asset.title_ar}</strong><small>{asset.kind} · {asset.status}</small><div className="entity-card__footer"><span>{(asset as AssetWithRole).role || 'asset'}</span><Icon name="arrow" size={14} /></div></Link>)}</div> : <EmptyState title={ar ? 'لا توجد أصول مرتبطة' : 'No linked assets'} description={ar ? 'لا يوجد أصل مرتبط بهذا العنصر في asset_links بعد.' : 'No asset is linked to this content in asset_links yet.'} /> },
      { key: 'analytics', label: ar ? 'الأداء' : 'Performance', content: <div className="data-unavailable">{ar ? 'لا توجد بيانات أداء أو إكمال خاصة بهذا العنصر في الخادم بعد.' : 'No performance or completion data specific to this item exists on the server yet.'}</div> },
    ]} />
  </div>
}
type AssetWithRole = { role?: string }
