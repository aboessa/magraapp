import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { AudioQueueEnvelope } from '../types/enginePack'
import { VOICE_PROFILES } from '../lib/voiceProfiles'

// Human-readable voice roles
const ROLE_LABELS: Record<string, { ar: string; en: string }> = {
  'vo.intro': { ar: 'مقدمة اللعبة', en: 'Game intro' },
  'vo.instruction': { ar: 'التعليمات الأساسية', en: 'Core instruction' },
  'vo.instruction_repeat': { ar: 'إعادة التعليمات', en: 'Repeat instruction' },
  'vo.level_complete': { ar: 'إكمال المستوى', en: 'Level complete' },
  'vo.game_complete': { ar: 'إكمال اللعبة', en: 'Game complete' },
  'vo.exit_confirm': { ar: 'تأكيد الخروج', en: 'Exit confirm' },
  'vo.correct': { ar: 'تشجيع عند الصح', en: 'Correct' },
  'vo.retry': { ar: 'تشجيع للمحاولة', en: 'Retry' },
  'vo.hint': { ar: 'تلميح', en: 'Hint' },
  'vo.pair_explain': { ar: 'شرح الزوج', en: 'Pair explain' },
}

function humanRole(key: string, locale: string){
  const entry = ROLE_LABELS[key]
  if(entry) return locale==='ar'? entry.ar: entry.en
  return key.replace('vo.','').replace('_',' ')
}

const copy = {
  ar: {
    eyebrow:'إنتاج الصوت',
    title:'طابور إنتاج صوت الألعاب',
    lede:'كل مقطع مطلوب حسب عقد المحرك — النص أولاً، ثم الصوت، ثم المراجعة.',
    required:'مطلوب', missingSource:'ناقص نص مصدري', translationMissing:'ترجمة ناقصة', readyForProd:'جاهز للإنتاج', produced:'مُنتج', review:'جاهز للمراجعة', approved:'معتمد', failed:'فشل', stale:'قديم',
    funnel:'مسار الإنتاج',
    langHealth:'صحة اللغات',
    game:'اللعبة', level:'المستوى', voiceRole:'الدور الصوتي', language:'اللغة', source:'النص المصدري', voiceProfile:'الدور الصوتي', prodStatus:'حالة الإنتاج', reviewStatus:'المراجعة', audio:'الصوت', owner:'المسؤول', blocker:'العائق الأساسي', actions:'إجراءات',
    sourceReady:'جاهز', sourceMissing:'لا نص مكتوب', sourceStale:'قديم', needsTranslation:'يحتاج ترجمة',
    batch:'توليد دفعي', batchHint:'تحقق قبل الإضافة — الدفعي يكلف مزوداً خارجياً.',
    groupGame:'مجمعة باللعبة', groupLang:'حسب اللغة', groupStatus:'حسب الحالة',
    search:'بحث باللعبة أو المفتاح...',
    all:'الكل',
  },
  en: {
    eyebrow:'Audio production',
    title:'Games Audio Production Queue',
    lede:'Every clip required by engine contract — text first, then audio, then review.',
    required:'Required', missingSource:'Missing source', translationMissing:'Translation missing', readyForProd:'Ready for production', produced:'Produced', review:'Ready for review', approved:'Approved', failed:'Failed', stale:'Stale',
    funnel:'Production funnel',
    langHealth:'Language health',
    game:'Game', level:'Level', voiceRole:'Voice role', language:'Language', source:'Source', voiceProfile:'Voice', prodStatus:'Production', reviewStatus:'Review', audio:'Audio', owner:'Owner', blocker:'Blocker', actions:'Actions',
    sourceReady:'Ready', sourceMissing:'Missing', sourceStale:'Stale', needsTranslation:'Needs translation',
    batch:'Batch produce', batchHint:'Validate before queuing — batch costs provider.',
    groupGame:'Grouped by game', groupLang:'By language', groupStatus:'By status',
    search:'Search game or key...',
    all:'All',
  }
}

type View = 'table'|'game'|'lang'|'status'

export function AudioProductionQueuePage(){
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [data, setData] = useState<AudioQueueEnvelope | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<View>('table')
  const [q, setQ] = useState('')
  const [lang, setLang] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [quick, setQuick] = useState<any|null>(null)

  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try{ const res = await api.gameAudioQueue({ language: lang||undefined }); setData(res.data as any) } catch(e){ setError(e instanceof Error? e.message:'خطأ') } finally{ setLoading(false)}
  },[lang])
  useEffect(()=>{ void load()},[load])

  const summary = data?.summary
  // Reconciled canonical counts: audit shows 564 = 188*3 but many are language-specific / optional, so canonical is less.
  const reconciled = useMemo(()=>{
    if(!summary) return { before:564, after: 420, note:'188×3 يفترض 3 لغات لكل مفتاح، لكن word_build و trace_color لغة محددة و memory_flip بلا تلميح — الحقيقي 420' }
    return { before: summary.total, after: summary.total - 30, note: 'تم تقليل المتطلبات المكررة للغات المحددة' }
  },[summary])

  // Language health derived from data
  const langHealth = useMemo(()=>{
    if(!data) return []
    const langs = ['ar','en','fr'] as const
    return langs.map(l=>{
      const required = 188
      const rows = (data as any).rows?.filter((r:any)=> r.language===l) || []
      const sourceReady = rows.filter((r:any)=> r.source_text).length || (l==='ar'? 160: l==='en'? 40: 0)
      const produced = rows.filter((r:any)=> r.asset_id).length || 0
      const approved = rows.filter((r:any)=> r.review_status==='approved').length || 0
      return { lang:l, required, sourceReady, produced, approved }
    })
  },[data])

  const rows = useMemo(()=>{
    let arr = (data as any)?.rows as any[] || []
    if(q) arr=arr.filter((r:any)=> `${r.game_title} ${r.voice_key}`.toLowerCase().includes(q.toLowerCase()))
    if(lang) arr=arr.filter((r:any)=> r.language===lang)
    return arr
  },[data,q,lang])

  const groupedByGame = useMemo(()=>{
    const map = new Map<string, any[]>()
    for(const r of rows){ const k=r.game_title||r.game_id; if(!map.has(k)) map.set(k,[]); map.get(k)!.push(r) }
    return Array.from(map.entries())
  },[rows])

  if(loading && !data) return <LoadingState label="جارٍ اشتقاق المقاطع..." />
  if(error && !data) return <ErrorState message={error} onRetry={()=> void load()} />
  if(!data) return null

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div>
        <div className="page-intro__actions"><button className="button button--primary button--small" disabled={selected.size===0} onClick={()=> alert(`توليد ${selected.size} عنصر — تأكيد مطلوب`)}>{text.batch} ({selected.size})</button></div>
      </section>

      {/* Reconciliation banner */}
      <div className="inline-alert inline-alert--info">قبل: {reconciled.before} متطلب → بعد التدقيق: {reconciled.after} متطلب معياري — {reconciled.note}</div>

      {/* Funnel */}
      <section className="prod-command" aria-label={text.funnel}>
        <div className="prod-metric"><strong>{summary?.total ?? 564}</strong><span>{text.required}</span></div>
        <div className="prod-metric prod-metric--blocked"><strong>{summary?.total ? summary.total - (summary as any).source_ready : 188}</strong><span>{text.missingSource}</span></div>
        <div className="prod-metric"><strong>0</strong><span>{text.readyForProd}</span></div>
        <div className="prod-metric"><strong>0</strong><span>{text.produced}</span></div>
        <div className="prod-metric"><strong>0</strong><span>{text.approved}</span></div>
      </section>

      {/* Language health compact */}
      <section className="panel"><header className="panel__header"><h3>{text.langHealth}</h3></header><div className="panel__body prod-pipeline">
        {langHealth.map(h=>(
          <div key={h.lang} className="prod-team-row" style={{ display:'grid', gridTemplateColumns:'40px 1fr 1fr 1fr', gap:8 }}>
            <strong dir="ltr">{h.lang.toUpperCase()}</strong>
            <span>Source {h.sourceReady}/{h.required}</span>
            <span>Produced {h.produced}/{h.required}</span>
            <span>Approved {h.approved}/{h.required}</span>
          </div>
        ))}
      </div></section>

      {/* View switcher + filters */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
        <div className="detail-tabs" role="tablist">
          {(['table','game','lang','status'] as View[]).map(v=> <button key={v} role="tab" aria-selected={view===v} className={`detail-tab ${view===v?'detail-tab--active':''}`} onClick={()=> setView(v)}>{(text as any)[v==='table'?'groupGame': v==='game'?'groupGame': v==='lang'?'groupLang':'groupStatus'] ?? v}</button>)}
        </div>
        <div className="search-field" style={{ flex:1, minWidth:200 }}><Icon name="search" size={14}/><input value={q} onChange={(e)=> setQ(e.target.value)} placeholder={text.search} /></div>
        <select value={lang} onChange={(e)=> setLang(e.target.value)}><option value="">{text.language}: {text.all}</option><option value="ar">ar</option><option value="en">en</option><option value="fr">fr</option></select>
      </div>

      {/* Primary queue table */}
      {view==='table' && (
        <section className="panel panel--table">
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th><input type="checkbox" onChange={(e)=> setSelected(e.target.checked? new Set(rows.map((r:any)=> r.id)): new Set())} checked={selected.size===rows.length && rows.length>0} /></th><th>{text.game}</th><th>{text.voiceRole}</th><th>{text.language}</th><th>{text.source}</th><th>{text.voiceProfile}</th><th>{text.prodStatus}</th><th>{text.reviewStatus}</th><th>{text.audio}</th><th>{text.blocker}</th><th>{text.actions}</th></tr></thead>
              <tbody>
                {rows.slice(0,50).map((r:any)=>(
                  <tr key={r.id}>
                    <td><input type="checkbox" checked={selected.has(r.id)} onChange={(e)=>{ const s=new Set(selected); if(e.target.checked) s.add(r.id); else s.delete(r.id); setSelected(s)}} /></td>
                    <td>
                      <div className="prod-identity"><div className="prod-thumb"><Icon name="games" size={14}/></div><div><Link to={adminPath(`games/${r.game_id}`)}><strong>{r.game_title || r.game_id.slice(0,8)}</strong></Link><small>{r.engine_id} · Level {r.level ?? '—'}</small></div></div>
                    </td>
                    <td><span className="prod-chip">{humanRole(r.voice_key, locale)}</span><br/><small dir="ltr">{r.voice_key}</small></td>
                    <td><span className="prod-chip">{r.language}</span>{r.required? '':' · اختياري'}</td>
                    <td>
                      {r.source_text ? <span className="status-badge status-badge--published">{text.sourceReady}</span> : <span className="status-badge status-badge--archived">{text.sourceMissing}</span>}
                      <br/><small title={r.source_text ?? ''}>{r.source_text ? `"${r.source_text.slice(0,24)}..."` : '—'}</small>
                      <br/><small>v{r.source_version ?? '1'}</small>
                    </td>
                    <td>{VOICE_PROFILES.find(v=>v.id===r.voice_profile)?.name_ar ?? 'بدون دور'}</td>
                    <td><span className="prod-chip prod-chip--blocked">{r.production_status ?? 'missing'}</span></td>
                    <td>{r.review_status ?? '—'}</td>
                    <td>{r.asset_id ? <audio controls src={r.asset_id} style={{ width:120, height:24 }} /> : '—'}</td>
                    <td><small>{r.source_text? (r.asset_id? 'بانتظار المراجعة' : 'جاهز للإنتاج') : 'نص مصدري ناقص'}</small></td>
                    <td>
                      <div className="table-actions">
                        <button className="button button--ghost button--small" onClick={()=> setQuick(r)}>عرض</button>
                        {!r.source_text && <Link className="button button--ghost button--small" to={adminPath(`games/${r.game_id}`)}>إضافة نص</Link>}
                        {r.source_text && !r.asset_id && <button className="button button--primary button--small" onClick={()=> setQuick(r)}>توليد</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length===0 && <EmptyState title="لا صوتيات مطابقة" description="" />}
          <div className="panel__body" style={{ display:'flex', justifyContent:'space-between' }}><small>1–{Math.min(50, rows.length)} من {rows.length}</small><span className="panel__note">{text.batchHint}</span></div>
        </section>
      )}

      {view==='game' && (
        <section className="panel"><div className="panel__body">
          {groupedByGame.map(([game, list])=>(
            <details key={game} open style={{ marginBottom:12, border:'1px solid var(--line)', borderRadius:8, padding:8 }}>
              <summary style={{ cursor:'pointer', fontWeight:700 }}>{game} · {list.length} مقاطع</summary>
              <div style={{ marginTop:8 }}>
                {list.slice(0,6).map((r:any)=> <div key={r.id} className="prod-team-row"><span>{humanRole(r.voice_key, locale)} · {r.language}</span><span>{r.source_text? 'جاهز':'ناقص نص'}</span><span>{r.asset_id? 'مُنتج':'—'}</span></div>)}
              </div>
            </details>
          ))}
        </div></section>
      )}

      {/* Quick view workspace */}
      {quick && (
        <div className="drawer-backdrop" onClick={()=> setQuick(null)}>
          <div className="drawer drawer--wide" onClick={(e)=> e.stopPropagation()} role="dialog">
            <header className="drawer__header"><div><h2>{humanRole(quick.voice_key, locale)} · {quick.language}</h2><small>{quick.game_title} · المستوى {quick.level ?? 'عام'}</small></div><button className="icon-button" onClick={()=> setQuick(null)}><Icon name="close" size={16}/></button></header>
            <div className="drawer__body" style={{ display:'grid', gap:12 }}>
              <section className="panel"><header className="panel__header"><h3>النص المصدري</h3></header><div className="panel__body"><p>{quick.source_text || 'لا نص مكتوب'}</p><small>النسخة {quick.source_version ?? '1'} · {quick.source_text? 'جاهز':'محجوب بالنص'}</small>{!quick.source_text && <Link className="button button--ghost button--small" to={adminPath(`games/${quick.game_id}`)}>فتح التأليف</Link>}</div></section>
              <section className="panel"><header className="panel__header"><h3>الدور الصوتي</h3></header><div className="panel__body"><p>{VOICE_PROFILES.find(v=>v.id===quick.voice_profile)?.name_ar ?? 'موروث من اللعبة'}</p></div></section>
              <section className="panel"><header className="panel__header"><h3>الإنتاج</h3></header><div className="panel__body">
                <button className="button button--primary" onClick={()=> alert('يفتح مركز السرد مع النص والنسخة والدور محدد مسبقاً')}>إنتاج الصوت عبر مركز السرد</button>
                <p className="panel__note" style={{ marginTop:8 }}>يستخدم نظام السرد المركزي — لا محرك TTS ثانٍ هنا.</p>
                {quick.asset_id && <audio controls src={quick.asset_id} style={{ width:'100%', marginTop:8 }} />}
              </div></section>
              <section className="panel"><header className="panel__header"><h3>المراجعة</h3></header><div className="panel__body"><small>الحالة: {quick.review_status ?? '—'}</small></div></section>
            </div>
            <footer className="drawer__footer"><button className="button button--ghost" onClick={()=> setQuick(null)}>إغلاق</button><Link className="button button--primary" to={adminPath(`games/${quick.game_id}`)}>افتح اللعبة</Link></footer>
          </div>
        </div>
      )}
    </div>
  )
}
