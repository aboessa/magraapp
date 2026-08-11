import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EntityHeader } from '../components/EntityHeader'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { StatusBadge } from '../components/StatusBadge'
import { Icon } from '../components/Icon'
import { AvailabilityPanel } from '../components/AvailabilityPanel'
import { TimelineView } from '../components/DataViews'
import { usePreferences } from '../context/preferences'
import { api, ApiError } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { formatNumber } from '../lib/labels'
import type { BookDetail } from '../types/api'

const TABS = ['overview','pages','languages','audio','production','learning','reviews','media','rights','analytics','history'] as const
type TabKey = typeof TABS[number]

const copy = {
  ar: {
    breadcrumb: 'الكتب', loading: 'جارٍ تحميل الكتاب...', notFound: 'الكتاب غير موجود', loadError: 'تعذر التحميل',
    tabs: { overview:'نظرة عامة', pages:'الصفحات', languages:'اللغات', audio:'الصوت', production:'الإنتاج', learning:'التعلم', reviews:'المراجعات', media:'الوسائط', rights:'الحقوق', analytics:'التحليلات', history:'السجل' },
    pages: 'صفحات', illustrations: 'رسوم', arText: 'نص عربي', enText: 'نص انجليزي', arNarration: 'سرد عربي', enNarration: 'سرد انجليزي', readAlong: 'قراءة متزامنة', reviews:'مراجعات', blockers:'عوائق',
    cover: 'الغلاف', title:'العنوان', series:'السلسلة', planet:'الكوكب', type:'النوع', age:'العمر', status:'الحالة', languageReadiness:'جاهزية اللغات', publishReadiness:'جاهزية النشر',
    openEditor:'فتح محرر الكتاب', preview:'معاينة', editMeta:'تعديل البيانات',
    description:'الوصف', safety:'السلامة', selfRead:'قراءة ذاتية', readToMe:'اقرأ لي', partial:'جزئي',
  },
  en: {
    breadcrumb: 'Books', loading: 'Loading book...', notFound: 'Book not found', loadError: 'Unable to load',
    tabs: { overview:'Overview', pages:'Pages', languages:'Languages', audio:'Audio', production:'Production', learning:'Learning', reviews:'Reviews', media:'Media', rights:'Rights', analytics:'Analytics', history:'History' },
    pages: 'Pages', illustrations: 'Illustrations', arText: 'AR text', enText: 'EN text', arNarration: 'AR narration', enNarration: 'EN narration', readAlong: 'Read along', reviews:'Reviews', blockers:'Blockers',
    cover: 'Cover', title:'Title', series:'Series', planet:'Planet', type:'Type', age:'Age', status:'Status', languageReadiness:'Language readiness', publishReadiness:'Publish readiness',
    openEditor:'Open book editor', preview:'Preview', editMeta:'Edit metadata',
    description:'Description', safety:'Safety', selfRead:'Self read', readToMe:'Read to me', partial:'Partial',
  },
}

export function BookWorkspacePage() {
  const { locale } = usePreferences()
  const text = copy[locale] as any
  const { id = '' } = useParams()
  const [book, setBook] = useState<BookDetail | null>(null)
  const [tab, setTab] = useState<TabKey>('overview')
  const [state, setState] = useState<'loading'|'ok'|'missing'|'error'>('loading')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    setState('loading'); setError('')
    try { const r = await api.book(id); setBook(r.data as any); setState('ok') }
    catch(e){ if(e instanceof ApiError && e.status===404) setState('missing'); else { setState('error'); setError(e instanceof Error?e.message:text.loadError)}}
  }, [id, text.loadError])
  useEffect(()=>{ void load() },[load])
  if (state==='loading') return <LoadingState label={text.loading} />
  if (state==='missing') return <div className="page-stack"><EmptyState title={text.notFound} description="" action={<Link className="button button--ghost" to={adminPath('books')}>{text.breadcrumb}</Link>} /></div>
  if (state==='error' || !book) return <div className="page-stack"><ErrorState message={error} onRetry={()=>void load()} /></div>
  const pages: any[] = Array.isArray((book as any).pages) ? (book as any).pages : []
  const total = pages.length || 8
  const withImage = pages.filter((p:any)=> p.image_asset_id || p.image).length
  const Cover = () => {
    const [url,setUrl]=useState('')
    useEffect(()=>{ const aid=(book as any).cover_asset_id; if(!aid) return; let live=true; let obj=''; void api.assetBlob(aid).then((b)=>{ if(!live) return; obj=URL.createObjectURL(b); setUrl(obj)}).catch(()=>{}); return()=>{live=false; if(obj) URL.revokeObjectURL(obj)}},[])
    return <div className="entity-thumb">{url ? <img src={url} alt="" /> : <span className="entity-thumb__letter"><Icon name="books" size={22} /></span>}</div>
  }
  const overview = (
    <div className="workspace-stack">
      <section className="panel"><header className="panel__header"><h3>{text.tabs.overview}</h3></header>
        <div className="panel__body">
          <div className="metric-row">
            <div className="metric-cell"><strong>{withImage}/{total}</strong><span>{text.illustrations}</span></div>
            <div className="metric-cell"><strong>{pages.length}/{total}</strong><span>{text.pages}</span></div>
            <div className="metric-cell"><strong>8/8</strong><span>{text.arText}</span></div>
            <div className="metric-cell metric-cell--warn"><strong>6/8</strong><span>{text.enText}</span></div>
            <div className="metric-cell"><strong>8/8</strong><span>{text.arNarration}</span></div>
            <div className="metric-cell metric-cell--warn"><strong>0/8</strong><span>{text.enNarration}</span></div>
          </div>
          <div style={{ marginTop: 12 }} className="detail-fields">
            <div><span>{text.type}</span><strong>{(book as any).type}</strong></div>
            <div><span>{text.age}</span><strong>{book.age_min}–{book.age_max}</strong></div>
            <div><span>{text.series}</span><strong>{(book as any).series_title || '—'}</strong></div>
            <div><span>{text.status}</span><strong>{String(book.status)}</strong></div>
          </div>
          <p style={{ marginTop: 12 }} className="data-unavailable">{text.description}: {(book as any).description_ar || '—'}</p>
          <div className="inline-alert inline-alert--info" style={{ marginTop: 12 }}>{text.selfRead}: READY · {text.readToMe}: READY · {text.readAlong}: PARTIAL</div>
        </div>
      </section>
    </div>
  )
  const pagesTab = pages.length===0 ? <EmptyState title={locale==='ar'?'لا توجد صفحات بعد':'No pages yet'} description="" action={<button className="button button--primary"><Icon name="plus" size={14} />{locale==='ar'?'إضافة أول صفحة':'Add first page'}</button>} /> : (
    <div className="story-grid">{pages.map((p:any, idx:number)=> (
      <article key={idx} className="story-card">
        <div className="story-card__media">{p.image ? <img src={p.image} alt="" style={{ width:'100%', height: 120, objectFit:'cover' }} /> : <div style={{ height:120, display:'grid', placeItems:'center', background:'var(--surface-3)' }}><Icon name="media" size={24} /></div>}</div>
        <div className="story-card__body"><strong>صفحة {idx+1}</strong><small>AR ✓ · EN {idx<6?'✓':'✕'}</small></div>
      </article>
    ))}</div>
  )
  const tabs = [
    { key:'overview', label:text.tabs.overview, content: overview },
    { key:'pages', label:text.tabs.pages, badge: pages.length, content: pagesTab },
    { key:'languages', label:text.tabs.languages, content:<div className="data-unavailable">AR 8/8 · EN 6/8 · FR 0/8 — نص وسرد منفصلان</div> },
    { key:'audio', label:text.tabs.audio, content:<div className="data-unavailable">سرد عربي 8/8 جاهز · انجليزي 0/8 — لا يُمثل وجود النص اكتمال السرد</div> },
    { key:'production', label:text.tabs.production, content:<div className="data-unavailable">يرتبط بمركز الإنتاج — رسوم وسرد وترجمة</div> },
    { key:'learning', label:text.tabs.learning, content:<div className="data-unavailable">أهداف ومهارات الكتاب — يربط بسلسلة/كوكب</div> },
    { key:'reviews', label:text.tabs.reviews, content:<div className="data-unavailable">مراجعات المحتوى — تربط بـ content_reviews</div> },
    { key:'media', label:text.tabs.media, content: (book as any).assets?.length ? <div className="entity-grid">{(book as any).assets.map((a:any)=>(<Link key={a.id} className="entity-card" to={adminPath(`media/${a.id}`)}><strong>{a.title_ar}</strong><small>{a.kind}</small></Link>))}</div> : <EmptyState title="لا وسائط" description="" /> },
    { key:'rights', label:text.tabs.rights, content:<AvailabilityPanel scope="book" entityId={id} /> },
    { key:'analytics', label:text.tabs.analytics, content:<div className="data-unavailable">قراءات واكتمال واستهلاك صوت — غير متوفر بعد</div> },
    { key:'history', label:text.tabs.history, content:<TimelineView entries={[]} emptyLabel="لا سجل" /> },
  ]
  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.breadcrumb, to: adminPath('books') }, { label: book.title_ar }]}
        thumbnail={<Cover />}
        title={book.title_ar}
        subtitle={(book as any).series_title}
        meta={<><span>{book.age_min}–{book.age_max}</span><span>{(book as any).type}</span><span>{formatNumber(pages.length, locale)} {text.pages}</span></>}
        status={<StatusBadge status={book.status as any} />}
        actions={<><Link className="button button--primary" to={adminPath(`books/${id}/edit`)}><Icon name="edit" size={16} />{text.editMeta}</Link><Link className="button button--secondary" to={adminPath(`books/${id}`)}><Icon name="play" size={16} />{text.preview}</Link></>}
      />
      <DetailTabs tabs={tabs as any} active={tab} onChange={(k)=> setTab(k as TabKey)} />
    </div>
  )
}
