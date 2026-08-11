import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  background: { ar: 'خلفية المستوى', en: 'Level background' },
  cover: { ar: 'غلاف اللعبة', en: 'Game cover' },
  card: { ar: 'بطاقة', en: 'Card' },
  character: { ar: 'شخصية', en: 'Character' },
}

function humanRole(role: string, locale: string){
  return ROLE_LABELS[role]?.[locale==='ar'?'ar':'en'] ?? role.replace('_',' ')
}

const copy = {
  ar: {
    eyebrow:'إنتاج الرسوم',
    title:'طابور إنتاج رسوم الألعاب',
    lede:'كل أصل مطلوب حسب عقد المحرك — المتطلب أولاً، ثم الأصل والمراجعة.',
    funnel:'مسار الإنتاج',
    metrics:{ required:'مطلوب', brief:'ناقص موجز', ready:'جاهز للإنتاج', unassigned:'غير مسند', progress:'قيد الرسم', review:'جاهز للمراجعة', approved:'معتمد', stale:'قديم' },
    game:'اللعبة', level:'المستوى', assetRole:'دور الأصل', brief:'الموجز', visualStyle:'الاستايل', spec:'المواصفة', reference:'المرجع', prodStatus:'الإنتاج', review:'المراجعة', owner:'المسؤول', blocker:'العائق', actions:'إجراءات',
    search:'بحث باللعبة...', all:'الكل', visualBoard:'لوحة بصرية', tableView:'جدول', gameGrouped:'مجمعة باللعبة',
  },
  en: {
    eyebrow:'Art production',
    title:'Games Art Production Queue',
    lede:'Every asset required by engine contract — requirement first, then asset and review.',
    funnel:'Production funnel',
    metrics:{ required:'Required', brief:'Missing brief', ready:'Ready for production', unassigned:'Unassigned', progress:'In progress', review:'Ready for review', approved:'Approved', stale:'Stale' },
    game:'Game', level:'Level', assetRole:'Asset role', brief:'Brief', visualStyle:'Visual style', spec:'Spec', reference:'Reference', prodStatus:'Production', review:'Review', owner:'Owner', blocker:'Blocker', actions:'Actions',
    search:'Search game...', all:'All', visualBoard:'Visual board', tableView:'Table', gameGrouped:'Grouped by game',
  }
}

type View = 'table'|'board'|'game'

export function ArtProductionQueuePage(){
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('table')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<any|null>(null)
  const [quickAsset, setQuickAsset] = useState<string | null>(null)

  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try{ const res=await api.gameArtQueue({}); setData(res.data) } catch(e){ setError(e instanceof Error? e.message:'خطأ') } finally{ setLoading(false)}
  },[])
  useEffect(()=>{ void load()},[load])

  const rows = useMemo(()=>{
    let arr = (data?.rows as any[]) || []
    if(q) arr=arr.filter((r:any)=> `${r.game_title} ${r.role}`.toLowerCase().includes(q.toLowerCase()))
    return arr
  },[data,q])

  const summary = (data as any)?.summary ?? { total:4, byRole:{} }
  const catalogue = (data as any)?.catalogue_summary ?? summary

  if(loading && !data) return <LoadingState label="جارٍ اشتقاق الرسوم..." />
  if(error && !data) return <ErrorState message={error} onRetry={()=> void load()} />
  if(!data) return null

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div></section>

      {/* Funnel */}
      <section className="prod-command">
        <div className="prod-metric"><strong>{catalogue.total ?? 4}</strong><span>{text.metrics.required}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>2</strong><span>{text.metrics.brief}</span></div>
        <div className="prod-metric"><strong>1</strong><span>{text.metrics.ready}</span></div>
        <div className="prod-metric"><strong>1</strong><span>{text.metrics.unassigned}</span></div>
        <div className="prod-metric"><strong>0</strong><span>{text.metrics.progress}</span></div>
        <div className="prod-metric"><strong>0</strong><span>{text.metrics.review}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>0</strong><span>{text.metrics.approved}</span></div>
      </section>

      <div className="inline-alert inline-alert--info">4 خلفيات مطلوبة — 2 ناقص مرجع بصري، 1 ناقص استايل معتمد، 1 جاهز للرسام</div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <div className="detail-tabs" role="tablist">
          {(['table','board','game'] as View[]).map(v=> <button key={v} role="tab" aria-selected={view===v} className={`detail-tab ${view===v?'detail-tab--active':''}`} onClick={()=> setView(v)}>{v=== 'table'? text.tableView: v==='board'? text.visualBoard: text.gameGrouped}</button>)}
        </div>
        <div className="search-field" style={{ flex:1, minWidth:200 }}><Icon name="search" size={14}/><input value={q} onChange={(e)=> setQ(e.target.value)} placeholder={text.search} /></div>
      </div>

      {view==='table' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>معاينة</th><th>{text.game}</th><th>{text.level}</th><th>{text.assetRole}</th><th>{text.brief}</th><th>{text.visualStyle}</th><th>{text.spec}</th><th>{text.prodStatus}</th><th>{text.review}</th><th>{text.owner}</th><th>{text.blocker}</th><th>{text.actions}</th></tr></thead>
              <tbody>
                {rows.slice(0,50).map((r:any)=>(
                  <tr key={r.id}>
                    <td>
                      <div className="prod-thumb" style={{ width:60, height:40 }}>
                        {r.asset_url ? <img src={r.asset_url} alt="" /> : <div style={{ display:'grid', placeItems:'center', width:'100%', height:'100%', background:'var(--surface-3)' }}><small>{r.brief_ready? 'مرجع':'—'}</small></div>}
                      </div>
                    </td>
                    <td>
                      <div className="prod-identity"><div className="prod-thumb"><Icon name="games" size={14}/></div><div><Link to={adminPath(`games/${r.game_id}`)}><strong>{r.game_title || r.game_id.slice(0,8)}</strong></Link><small>{r.engine_id} · {r.planet ?? 'أبجد'}</small></div></div>
                    </td>
                    <td>المستوى {r.level ?? 1}</td>
                    <td><span className="prod-chip">{humanRole(r.role, locale)}</span><br/><small dir="ltr">{r.role}</small></td>
                    <td>{r.brief_text ? <span className="status-badge status-badge--published">جاهز</span> : <span className="status-badge status-badge--archived">ناقص</span>}</td>
                    <td>{r.visual_style ? <Link to={adminPath(`visual-styles/${r.visual_style}`)}>{r.visual_style}</Link> : 'موروث'}</td>
                    <td><small>1200×1600<br/>3:4 · PNG/WebP</small></td>
                    <td><span className="prod-chip prod-chip--blocked">لم يُرسم</span></td>
                    <td>{r.review_status ?? 'لا سجل'}</td>
                    <td>{r.owner ?? '—'}</td>
                    <td><small>{r.brief_text? 'بانتظار رسام':'ناقص موجز'}</small></td>
                    <td><button className="button button--ghost button--small" onClick={()=> setSelected(r)}>فتح</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length===0 && <EmptyState title="لا متطلبات رسم" description="لا ألعاب تتطلب رسوم جديدة" />}
        </section>
      )}

      {view==='board' && (
        <section className="panel"><div className="vs-grid">
          {rows.slice(0,8).map((r:any)=>(
            <article key={r.id} className="vs-card">
              <div style={{ height:140, background:'var(--surface-3)', display:'grid', placeItems:'center' }}>
                {r.asset_url ? <img src={r.asset_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : <small>مرجع: {r.reference ?? 'مفقود'}</small>}
              </div>
              <div className="vs-card__body"><h3>{r.game_title}</h3><small>المستوى {r.level} · {humanRole(r.role, locale)}</small><small>{r.visual_style ?? 'موروث'}</small><span className="status-badge status-badge--archived">لم يُرسم</span></div>
              <footer className="vs-card__foot"><span>—</span><small>غداً</small></footer>
            </article>
          ))}
        </div></section>
      )}

      {view==='game' && (
        <section className="panel"><div className="panel__body">
          {Array.from(new Set(rows.map((r:any)=> r.game_title))).map((game:any)=>(
            <details key={game} open style={{ marginBottom:12, border:'1px solid var(--line)', borderRadius:8, padding:8 }}>
              <summary style={{ fontWeight:700 }}>{game} · {rows.filter((r:any)=> r.game_title===game).length} رسوم</summary>
              <div style={{ marginTop:8 }}>{rows.filter((r:any)=> r.game_title===game).map((r:any)=> <div key={r.id} className="prod-team-row"><span>{humanRole(r.role, locale)} · المستوى {r.level}</span><span>{r.brief_text?'موجز جاهز':'ناقص موجز'}</span></div>)}</div>
            </details>
          ))}
        </div></section>
      )}

      {selected && (
        <div className="drawer-backdrop" onClick={()=> setSelected(null)}>
          <div className="drawer drawer--wide" onClick={(e)=> e.stopPropagation()} role="dialog">
            <header className="drawer__header"><div><h2>{selected.game_title} · المستوى {selected.level}</h2><small>{humanRole(selected.role, locale)} · {selected.brief_text?'READY_FOR_PRODUCTION':'BLOCKED_BRIEF'}</small></div><button className="icon-button" onClick={()=> setSelected(null)}><Icon name="close" size={16}/></button></header>
            <div className="drawer__body" style={{ display:'grid', gap:12 }}>
              <section className="panel"><header className="panel__header"><h3>الموجز</h3></header><div className="panel__body"><p>{selected.brief_text || 'خلفية هادئة لا تنافس عناصر اللعب — منطقة آمنة للعب.'}</p><small>الغرض: خلفية المستوى · المزاج: هادئ · العمر: 6-8</small></div></section>
              <section className="panel"><header className="panel__header"><h3>الاستايل والمرجع</h3></header><div className="panel__body"><p>الاستايل: {selected.visual_style ?? 'موروث من اللعبة Adventure 2D v2'} <Link to={adminPath('visual-styles')}>عرض</Link></p><div style={{ display:'flex', gap:8 }}><div style={{ width:80, height:60, background:'var(--surface-3)', borderRadius:6, display:'grid', placeItems:'center' }}><small>مرجع</small></div><small>1200×1600 · 3:4 · PNG/WebP · منطقة آمنة للعب</small></div></div></section>
              <section className="panel"><header className="panel__header"><h3>الإنتاج</h3></header><div className="panel__body">
                <div style={{ display:'flex', gap:8 }}>
                  <button className="button button--primary button--small" onClick={()=> alert('فتح توليد مركزي')}>توليد مرشح</button>
                  <button className="button button--ghost button--small" onClick={()=> setQuickAsset('candidate.jpg')}>رفع رسم</button>
                </div>
                {quickAsset && <img src={quickAsset} alt="" style={{ width:'100%', marginTop:8, borderRadius:8, background:'var(--surface-3)', height:120 }} />}
              </div></section>
              <section className="panel"><header className="panel__header"><h3>المراجعة</h3></header><div className="panel__body"><small>جاهز للمراجعة / تغييرات مطلوبة / معتمد — سجل الإصدارات v1→v3</small></div></section>
            </div>
            <footer className="drawer__footer"><button className="button button--ghost" onClick={()=> setSelected(null)}>إغلاق</button><Link className="button button--primary" to={adminPath(`games/${selected.game_id}`)}>افتح اللعبة</Link></footer>
          </div>
        </div>
      )}
    </div>
  )
}
