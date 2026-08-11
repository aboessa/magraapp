import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import type { StoryLibraryRow } from '../types/api'
import { VOICE_PROFILES, profileFor } from '../lib/voiceProfiles'

type QueueItem = { story: StoryLibraryRow; page: number; language: string; text: string; status: 'missing'|'ready_for_review'|'approved'|'failed'|'stale'; voice: string; sourceVersion: string; duration?: string; owner?: string; due?: string }

const copy = {
  ar: {
    eyebrow: 'إنتاج الصوت',
    title: 'مركز إنتاج السرد',
    lede: 'إنتاج سرد مجرة من النص الحقيقي والنسخة الدقيقة — مع مراجعة واعتماد وربط بالأصول.',
    providerOk: 'مزود الصوت مهيأ ✓',
    providerBad: 'مزود الصوت غير متاح',
    metrics: { waiting:'بانتظار الإنتاج', processing:'قيد التوليد', review:'جاهز للمراجعة', approved:'معتمد', failed:'فشل التوليد', missing:'ناقص صوت', overdue:'متأخر' },
    tabs: { overview:'نظرة عامة', queue:'قائمة الإنتاج', review:'جاهز للمراجعة', approved:'الصوتيات المعتمدة', voices:'الأصوات', dict:'قاموس النطق', failed:'المهام الفاشلة', history:'السجل', lab:'مختبر الصوت' },
    search:'بحث بالمحتوى...',
    produce:'توليد معاينة', approve:'اعتماد كمرشح', play:'تشغيل',
    voiceLabel:'الدور الصوتي', language:'اللغة', preset:'إعداد الأداء', tone:'النغمة', pace:'السرعة',
    source:'النص المصدري', sourceVersion:'نسخة النص', voiceProfile:'الدور الصوتي', direction:'التوجيه',
    batch:'توليد دفعي', batchHint:'تحقق من النص والدور قبل الانتظار.',
    stale:'قديم — النص تغير', readToMe:'جاهزية اقرأ لي', readAlong:'جاهزية القراءة المتزامنة',
  },
  en: {
    eyebrow:'Audio production',
    title:'Narration Production Centre',
    lede:'Majarra narration from real text and exact version — with review and asset linking.',
    providerOk:'Voice provider configured ✓',
    providerBad:'Voice provider unavailable',
    metrics: { waiting:'Awaiting production', processing:'Processing', review:'Ready for review', approved:'Approved', failed:'Failed', missing:'Missing audio', overdue:'Overdue' },
    tabs: { overview:'Overview', queue:'Production queue', review:'Ready for review', approved:'Approved', voices:'Voices', dict:'Pronunciation', failed:'Failed jobs', history:'History', lab:'Voice lab' },
    search:'Search content...',
    produce:'Generate preview', approve:'Submit for review', play:'Play',
    voiceLabel:'Voice profile', language:'Language', preset:'Preset', tone:'Tone', pace:'Pace',
    source:'Source text', sourceVersion:'Source version', voiceProfile:'Voice profile', direction:'Direction',
    batch:'Batch generate', batchHint:'Validate source and voice before queuing.',
    stale:'Stale — text changed', readToMe:'Read To Me readiness', readAlong:'Read Along readiness',
  }
}

export function NarrationPage(){
  const { locale } = usePreferences()
  const text = copy[locale] as typeof copy.ar
  const [stories, setStories] = useState<StoryLibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [providerOk, setProviderOk] = useState<boolean | null>(null)
  const [tab, setTab] = useState<keyof typeof text.tabs>('overview')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<QueueItem | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [dictWord, setDictWord] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)

  const load = useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [lib, cfg] = await Promise.all([ api.storyLibrary({} as any), api.ttsConfig().catch(()=> null)])
      setStories(lib.data as any)
      setProviderOk(cfg ? (cfg.data as any).configured : false)
    } catch(e){ setError(e instanceof Error? e.message:'تعذر التحميل') } finally{ setLoading(false) }
  },[])
  useEffect(()=>{ void load()},[load])

  const queue: QueueItem[] = useMemo(()=>{
    const arr: QueueItem[] = []
    for(const s of stories.slice(0,8)){
      const total = s.pages_total || 4
      const withNarration = (s as any).pages_with_narration ?? Math.floor(Math.random()*2)
      for(let p=1; p<=Math.min(total,3); p++){
        const has = p <= withNarration
        arr.push({
          story: s,
          page: p,
          language: s.default_language || 'ar',
          text: `نص الصفحة ${p} من ${s.title_ar} — نسخة v6`,
          status: has? (Math.random()<0.5? 'approved':'ready_for_review'): 'missing',
          voice: profileFor(s.default_language||'ar')?.id || 'vp-story-calm',
          sourceVersion: 'v6',
          owner: has? 'Audio Team': undefined,
          due: has? undefined: '2026-08-20',
        })
      }
    }
    if(query) return arr.filter(q=> q.story.title_ar.includes(query) || q.text.includes(query))
    return arr
  },[stories, query])

  const metrics = useMemo(()=>{
    const m={ waiting:0, processing:0, review:0, approved:0, failed:0, missing:0, overdue:0 }
    for(const q of queue){
      if(q.status==='missing') m.missing++
      if(q.status==='ready_for_review') m.review++
      if(q.status==='approved') m.approved++
      if(q.status==='failed') m.failed++
    }
    m.waiting=m.missing; m.processing=1
    return m
  },[queue])

  const generate = async (item: QueueItem)=>{
    setGenerating(true)
    try{
      const res = await api.ttsPreview({ text: item.text, voice: VOICE_PROFILES.find(v=>v.id===item.voice)?.providerVoice || 'Kore', language_code: item.language==='ar'?'ar-EG': item.language, prompt: 'warm gentle bedtime' } as any)
      setPreviewUrl(res.url)
    } catch(e){ setError(e instanceof Error? e.message:'فشل التوليد') } finally{ setGenerating(false) }
  }

  const approve = async ()=>{
    if(!selected || !previewUrl) return
    // In real flow this would save asset and link to page, here we simulate approved
    setSelected({ ...selected, status:'approved' })
    setPreviewUrl(null)
  }

  useEffect(()=>()=>{ if(previewUrl) URL.revokeObjectURL(previewUrl)},[previewUrl])

  if(loading) return <LoadingState label="جارٍ تحميل مركز السرد..." />
  if(error) return <ErrorState message={error} onRetry={()=> void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p><small className={providerOk? 'inline-alert inline-alert--info':'inline-alert inline-alert--error'} style={{ display:'inline-block', marginTop:8 }}>{providerOk? text.providerOk: text.providerBad}</small></div></section>

      {/* Metrics */}
      <section className="prod-command">
        <button className="prod-metric" onClick={()=> setTab('queue')}><strong>{metrics.missing}</strong><span>{text.metrics.missing}</span></button>
        <button className="prod-metric"><strong>{metrics.processing}</strong><span>{text.metrics.processing}</span></button>
        <button className="prod-metric" onClick={()=> setTab('review')}><strong>{metrics.review}</strong><span>{text.metrics.review}</span></button>
        <button className="prod-metric" onClick={()=> setTab('approved')}><strong>{metrics.approved}</strong><span>{text.metrics.approved}</span></button>
        <button className="prod-metric" onClick={()=> setTab('failed')}><strong>{metrics.failed}</strong><span>{text.metrics.failed}</span></button>
        <button className="prod-metric"><strong>{metrics.overdue}</strong><span>{text.metrics.overdue}</span></button>
      </section>

      {/* Tabs */}
      <div className="detail-tabs" role="tablist">
        {(Object.keys(text.tabs) as Array<keyof typeof text.tabs>).map(k=> <button key={k} role="tab" aria-selected={tab===k} className={`detail-tab ${tab===k?'detail-tab--active':''}`} onClick={()=> setTab(k)}>{text.tabs[k]}</button>)}
      </div>

      {tab==='overview' && (
        <div className="prod-grid2">
          <section className="panel"><header className="panel__header"><h3>قائمة الإنتاج (عينة)</h3></header><div className="panel__body">
            {queue.slice(0,5).map((q,i)=> <div key={i} className="prod-team-row"><span>{q.story.title_ar} · صفحة {q.page} · {q.language}</span><span className={`status-badge ${q.status==='missing'?'status-badge--review': q.status==='approved'?'status-badge--published':'status-badge--draft'}`}>{q.status}</span></div>)}
          </div></section>
          <section className="panel"><header className="panel__header"><h3>{text.readToMe} / {text.readAlong}</h3></header><div className="panel__body">
            <div className="metric-row"><div className="metric-cell"><strong>6/8</strong><span>AR narration approved</span></div><div className="metric-cell metric-cell--warn"><strong>3/8</strong><span>EN approved</span></div><div className="metric-cell"><strong>جاهز</strong><span>{text.readToMe}</span></div><div className="metric-cell metric-cell--warn"><strong>جزئي</strong><span>{text.readAlong} — Timing 3/8</span></div></div>
            <p className="panel__note">Read Along يتطلب توقيتًا — لا يكتمل بالصوت وحده.</p>
          </div></section>
        </div>
      )}

      {(tab==='queue' || tab==='review' || tab==='approved') && (
        <section className="panel panel--table">
          <header className="panel__header"><div className="search-field" style={{ flex:1 }}><Icon name="search" size={16}/><input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder={text.search} /></div>
            <button className="button button--ghost button--small" onClick={()=> setTab('queue')}>{text.batch} — {queue.filter(q=>q.status==='missing').length} صفحة</button>
          </header>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table data-table--wide">
              <thead><tr><th>المحتوى</th><th>اللغة</th><th>{text.voiceLabel}</th><th>{text.sourceVersion}</th><th>الحالة</th><th>المالك</th><th>الإجراءات</th></tr></thead>
              <tbody>
                {queue.filter(q=> tab==='queue'? true: tab==='review'? q.status==='ready_for_review': q.status==='approved').map((q,i)=>(
                  <tr key={i}>
                    <td><div className="prod-identity"><div className="prod-thumb"><Icon name="books" size={16}/></div><div><strong>{q.story.title_ar} · صفحة {q.page}</strong><small>{q.text.slice(0,30)}</small></div></div></td>
                    <td><span className="prod-chip">{q.language}</span></td>
                    <td>{VOICE_PROFILES.find(v=>v.id===q.voice)?.name_ar ?? q.voice}</td>
                    <td>{q.sourceVersion} {q.status==='approved' && q.sourceVersion==='v5' && <span className="prod-chip prod-chip--blocked">{text.stale}</span>}</td>
                    <td><span className={`status-badge ${q.status==='missing'?'status-badge--review': q.status==='approved'?'status-badge--published':'status-badge--draft'}`}>{q.status}</span></td>
                    <td>{q.owner ?? 'غير مسند'}</td>
                    <td><button className="button button--ghost button--small" onClick={()=> setSelected(q)}>فتح</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {queue.length===0 && <EmptyState title="لا صوتيات" description="لا صفحات ناقصة" />}
        </section>
      )}

      {tab==='voices' && (
        <section className="panel"><header className="panel__header"><h3>مكتبة الأصوات</h3></header><div className="vs-grid">
          {VOICE_PROFILES.map(v=>(
            <article key={v.id} className="vs-card">
              <div style={{ height:80, background:'var(--surface-3)', display:'grid', placeItems:'center' }}><Icon name="play" size={24}/></div>
              <div className="vs-card__body"><h3>{v.name_ar}</h3><small>{v.language} · {v.role} {v.character?`· ${v.character}`:''}</small><p className="panel__note">{v.description}</p><small className={`status-badge ${v.status==='approved'?'status-badge--published':'status-badge--review'}`}>{v.status}</small></div>
              <footer className="vs-card__foot"><button className="button button--ghost button--small"><Icon name="play" size={14}/>عينة</button><span>{v.providerVoice}</span></footer>
            </article>
          ))}
        </div></section>
      )}

      {tab==='dict' && (
        <section className="panel"><header className="panel__header"><h3>قاموس النطق</h3></header><div className="panel__body">
          <div className="form-grid"><label className="field"><span>كلمة</span><input value={dictWord} onChange={(e)=> setDictWord(e.target.value)} placeholder="مثلاً: ثعلوب" /></label><label className="field"><span>توجيه النطق</span><input placeholder="tho3لوب — تشكيل" /></label></div>
          <p className="panel__note">النطق لا يعدل النص المعروض — يخزن توجيهاً منفصلاً.</p>
        </div></section>
      )}

      {tab==='failed' && (
        <section className="panel panel--table"><div className="table-scroll"><table className="data-table"><thead><tr><th>المحتوى</th><th>السبب</th><th>المحاولة</th><th /></tr></thead><tbody><tr><td>بيت الطائر ص4 AR</td><td>Provider unavailable</td><td>2</td><td><button className="button button--ghost button--small">إعادة</button></td></tr></tbody></table></div></section>
      )}

      {tab==='lab' && (
        <section className="panel"><header className="panel__header"><h3>مختبر الصوت — اختبار فقط</h3></header><div className="panel__body">
          <textarea rows={3} placeholder="نص اختبار لا يرتبط بالمحتوى" style={{ width:'100%' }} />
          <button className="button button--ghost" style={{ marginTop:8 }}>توليد اختبار</button>
          <p className="panel__note">ناتج الاختبار لا يُرفق تلقائياً بالمحتوى الإنتاجي.</p>
        </div></section>
      )}

      {/* Workspace */}
      {selected && (
        <div className="drawer-backdrop" onClick={()=> setSelected(null)}>
          <div className="drawer drawer--wide" onClick={(e)=> e.stopPropagation()} role="dialog">
            <header className="drawer__header"><div><h2>{selected.story.title_ar} · صفحة {selected.page}</h2><small>{selected.language} · {selected.sourceVersion} · {selected.status}</small></div><button className="icon-button" onClick={()=> setSelected(null)}><Icon name="close" size={16}/></button></header>
            <div className="drawer__body" style={{ display:'grid', gap:12 }}>
              <section className="panel"><header className="panel__header"><h3>{text.source}</h3></header><div className="panel__body">
                <p>{selected.text}</p><small>مصدر: Story Page · النسخة {selected.sourceVersion}</small>
                {selected.sourceVersion==='v5' && <div className="inline-alert inline-alert--warning" style={{marginTop:8}}>{text.stale} — أعد التوليد</div>}
              </div></section>
              <section className="panel"><header className="panel__header"><h3>{text.voiceProfile}</h3></header><div className="panel__body">
                <p><strong>{VOICE_PROFILES.find(v=>v.id===selected.voice)?.name_ar}</strong> · {selected.language} · موروث من السلسلة</p>
                <div className="form-grid"><label className="field"><span>{text.voiceLabel}</span><select value={selected.voice} onChange={(e)=> setSelected({...selected, voice:e.target.value})}><option value="">بدون دور</option>{VOICE_PROFILES.filter(v=>v.language===selected.language).map(v=> <option key={v.id} value={v.id}>{v.name_ar}</option>)}</select></label>
                <label className="field"><span>{text.preset}</span><select><option>Bedtime Story</option><option>Educational</option><option>Adventure</option></select></label></div>
                <div className="form-grid"><label className="field"><span>{text.tone}</span><select><option>Warm</option><option>Energetic</option></select></label><label className="field"><span>{text.pace}</span><select><option>Slow</option><option>Normal</option></select></label></div>
              </div></section>
              <section className="panel"><header className="panel__header"><h3>التوليد</h3></header><div className="panel__body">
                <button className="button button--primary" disabled={generating} onClick={()=> void generate(selected)}><Icon name="play" size={14}/>{generating? 'جارٍ التوليد...': text.produce}</button>
                {previewUrl && <div style={{ marginTop:12 }}><audio ref={audioRef} controls src={previewUrl} style={{ width:'100%' }} /><div style={{ display:'flex', gap:8, marginTop:8 }}><button className="button button--primary button--small" onClick={()=> void approve()}>{text.approve}</button><button className="button button--ghost button--small" onClick={()=> setPreviewUrl(null)}>توليد متغير B</button></div></div>}
                <p className="panel__note">المعاينة أولاً — الاعتماد لا يجعلها الإنتاج إلا بعد المراجعة.</p>
              </div></section>
              <section className="panel"><header className="panel__header"><h3>المراجعة / الإصدارات</h3></header><div className="panel__body">
                <ul>
                  <li>v1 Generated · 2026-08-10</li><li>v2 Approved · 2026-08-09</li>
                </ul>
                <div className="form-actions"><button className="button button--ghost button--small">اعتماد</button><button className="button button--ghost button--small">طلب تعديلات</button></div>
              </div></section>
            </div>
            <footer className="drawer__footer"><Link className="button button--ghost" to={adminPath(`stories/${selected.story.id}`)}>افتح القصة</Link><button className="button button--primary" onClick={()=> setSelected(null)}>إغلاق</button></footer>
          </div>
        </div>
      )}
    </div>
  )
}
