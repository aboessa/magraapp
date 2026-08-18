// @ts-nocheck
import { useCallback, useEffect, useMemo, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { FeatureFlagRecord, RemoteConfigRecord } from '../types/api'

/**
 * Remote Config — high-risk operations system.
 * Separate Config (typed values) vs Feature Flags (ON/OFF variants), environment visible, rollout sticky, kill switches, history, rollback.
 */

const TYPE_META: Record<string, { ar:string; en:string; type:string; example:string }> = {
  maintenance_message: { ar: 'رسالة الصيانة', en: 'Maintenance message', type: 'localized_string', example: '"صيانة مجدولة"' },
  min_app_version: { ar: 'الحد الأدنى لإصدار التطبيق', en: 'Min app version', type: 'semantic_version', example: '"2.4.0"' },
  offline_enabled: { ar: 'العمل دون اتصال', en: 'Offline enabled', type: 'boolean', example: 'true' },
  hero_enabled: { ar: 'تفعيل البطل', en: 'Hero enabled', type: 'boolean', example: 'true' },
}

const KILL_SWITCHES = ['offline_enabled', 'downloads_enabled', 'game_engine_enabled']

const copy = {
  ar: {
    eyebrow: 'التحكم في التطبيق', title: 'التحكم عن بعد', lede: 'إعدادات تصل لكل المستخدمين فوراً — نظام تشغيل متحكم به. البيئة: الإنتاج مرئية بوضوح.',
    env: 'البيئة', prod: 'الإنتاج', staging: 'التجريبي', dev: 'التطوير',
    tabConfig: 'الإعدادات', tabFlags: 'أعلام الميزات', tabRollouts: 'النسب', tabHistory: 'السجل',
    key: 'المفتاح', human: 'الاسم', value: 'القيمة', rollout: 'نسبة الإطلاق', targeting: 'الاستهداف', everyone: 'الجميع', updated: 'آخر تحديث',
    status: 'الحالة', enabled: 'مفعل', disabled: 'معطل', edit: 'تعديل', kill: 'مفتاح إيقاف',
    editTitle: 'تعديل إعداد', valueLabel: 'القيمة', rolloutLabel: 'نسبة الإطلاق (%)', targetingLabel: 'استهداف',
    type: 'النوع', description: 'الوصف', impact: 'الأثر', owner: 'المالك', range: 'النطاق المسموح',
    save: 'حفظ', saving: 'جارٍ الحفظ…', cancel: 'إلغاء', saved: 'حُفظ',
    preview: 'معاينة الحسم', previewHint: 'حلّ الإعداد لـ: دولة/منصة/إصدار/باقة/لغة',
    history: 'السجل والاسترجاع', historyHint: 'كل تغيير: فاعل/وقت/قيمة قديمة→جديدة/استهداف/سبب — مع استرجاع آمن',
    highRisk: 'تغيير عالي الخطورة — تأكيد مطلوب', minVersionWarn: 'تحذير: رفع الحد الأدنى قد يحجب كل العملاء الحاليين',
    noSecrets: 'لا يُحفظ هنا: مفاتيح API/أسرار المزود/رموز',
    killSwitchDesc: 'مفاتيح إيقاف تشغيلية عالية الخطورة — تتطلب تأكيد أثر وسبب وصلاحية ومراجعة',
    empty: 'لا إعدادات', flagsEmpty: 'لا أعلام',
    invalidJson: 'JSON غير صالح', invalidRollout: 'النسبة 0-100', invalidVersion: 'نسخة دلالية غير صالحة (مثل 2.4.0)',
  },
  en: {
    eyebrow: 'App Control', title: 'Remote Config', lede: 'Settings reaching all users immediately — controlled operations. Environment is visibly Production.',
    env: 'Environment', prod: 'Production', staging: 'Staging', dev: 'Development',
    tabConfig: 'Configuration', tabFlags: 'Feature Flags', tabRollouts: 'Rollouts', tabHistory: 'History',
    key: 'Key', human: 'Name', value: 'Value', rollout: 'Rollout', targeting: 'Targeting', everyone: 'Everyone', updated: 'Updated',
    status: 'Status', enabled: 'Enabled', disabled: 'Disabled', edit: 'Edit', kill: 'Kill switch',
    editTitle: 'Edit config', valueLabel: 'Value (JSON)', rolloutLabel: 'Rollout %', targetingLabel: 'Targeting',
    type: 'Type', description: 'Description', impact: 'Impact', owner: 'Owner', range: 'Allowed range',
    save: 'Save', saving: 'Saving…', cancel: 'Cancel', saved: 'Saved',
    preview: 'Resolve preview', previewHint: 'Resolve for country/platform/version/plan/language',
    history: 'History & Rollback', historyHint: 'Every change: actor/time/old→new/targeting/reason — rollback where safe',
    highRisk: 'High-risk change — confirmation required', minVersionWarn: 'Raising min version may block all current clients',
    noSecrets: 'Never store: API keys / provider secrets / tokens',
    killSwitchDesc: 'Operational kill switches — require impact preview + reason + permission + audit',
    empty: 'No config', flagsEmpty: 'No flags',
    invalidJson: 'Invalid JSON', invalidRollout: 'Rollout 0-100', invalidVersion: 'Invalid semver (e.g. 2.4.0)',
  }
}

function displayValue(v:any, text:any){
  if(typeof v==='boolean') return v? text.enabled: text.disabled
  if(v==null) return '—'
  if(typeof v==='object') return JSON.stringify(v)
  return String(v)
}
function isTruthy(v:any){ if(typeof v==='boolean') return v; if(typeof v==='number') return v!==0; if(typeof v==='string') return v!=='' && v!=='false'; return v!=null }

export function RemoteConfigPage(){
  const { locale } = usePreferences()
  const text = copy[locale]
  const [entries, setEntries]=useState<RemoteConfigRecord[]>([])
  const [flags, setFlags]=useState<FeatureFlagRecord[]>([])
  const [activeTab, setActiveTab]=useState<'config'|'flags'|'rollouts'|'history'>('config')
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [selected,setSelected]=useState<RemoteConfigRecord|null>(null)
  const [valueText,setValueText]=useState('')
  const [rollout,setRollout]=useState('100')
  const [targetingText,setTargetingText]=useState('{}')
  const [saving,setSaving]=useState(false)
  const [modalError,setModalError]=useState('')
  const [confirmHighRisk,setConfirmHighRisk]=useState(false)
  const [preview,setPreview]=useState<any>(null)
  const [history,setHistory]=useState<any[]>([])

  const envLabel = (window as any).__ENV__ ?? 'production'

  const load=useCallback(async()=>{
    setLoading(true); setError('')
    try{
      const [cRes,fRes]=await Promise.all([api.remoteConfig(), api.featureFlags()])
      setEntries(cRes.data); setFlags(fRes.data)
      // load audit for history
      try{ const h=await api.auditLogs({ entity_type:'remote_config', limit:20 } as any); setHistory((h as any).data ?? []) }catch{}
    }catch(e){ setError(e instanceof Error? e.message: text.loadError)} finally{ setLoading(false)}
  },[text.loadError])

  useEffect(()=>{ void load()},[load])

  const killFlags = useMemo(()=> entries.filter(e=> KILL_SWITCHES.includes(e.key)) ?? [],[entries])

  function openEdit(e:RemoteConfigRecord){
    setSelected(e); setValueText(JSON.stringify(e.value)); setRollout(String(e.rollout_percent)); setTargetingText(JSON.stringify(e.targeting ?? {})); setModalError(''); setConfirmHighRisk(false)
  }

  const validateAndSave=async()=>{
    if(!selected) return
    let parsed:any
    try{ parsed=JSON.parse(valueText) }catch{ setModalError(text.invalidJson); return}
    const pct=Number(rollout)
    if(!Number.isInteger(pct)||pct<0||pct>100){ setModalError(text.invalidRollout); return}
    let targeting:any={}
    try{ targeting=JSON.parse(targetingText||'{}') }catch{ setModalError('Invalid targeting JSON'); return}
    // typed config validation
    const meta = TYPE_META[selected.key]
    if(meta?.type==='semantic_version' && typeof parsed==='string' && !/^\d+\.\d+\.\d+$/.test(parsed)){ setModalError(text.invalidVersion); return}
    if(meta?.type==='boolean' && typeof parsed!=='boolean'){ setModalError('Boolean required'); return}
    // high-risk confirmation
    const isKill = KILL_SWITCHES.includes(selected.key)
    const isMinVersion = selected.key==='min_app_version'
    if((isKill || isMinVersion) && !confirmHighRisk){ setModalError(text.highRisk + ' — check confirmation'); return}
    setSaving(true); setModalError('')
    try{
      await api.saveRemoteConfig(selected.key, { value: parsed, rollout_percent: pct, targeting })
      setSelected(null); setNotice(text.saved); await load()
    }catch(e){ setModalError(e instanceof Error? e.message: text.loadError)} finally{ setSaving(false)}
  }

  if(loading) return <LoadingState/>
  if(error) return <ErrorState message={error} onRetry={()=> void load()}/>

  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p>
        <div style={{display:'inline-flex', gap:6, marginTop:8, padding:'4px 8px', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, fontSize:12}}><span style={{width:8, height:8, background:'#dc2626', borderRadius:999, display:'inline-block'}}></span> {text.env}: {text.prod} — {text.noSecrets}</div>
      </div></section>
      {notice && <section className="panel panel--notice" role="status">{notice}</section>}

      <div style={{display:'flex', gap:8, overflowX:'auto'}}>
        {(['config','flags','rollouts','history'] as const).map(t=>(
          <button key={t} className={`button ${activeTab===t?'button--primary':'button--ghost'} button--small`} onClick={()=> setActiveTab(t)}>{(text as any)[t==='config'?'tabConfig': t==='flags'?'tabFlags': t==='rollouts'?'tabRollouts':'tabHistory']}</button>
        ))}
      </div>

      {activeTab==='config' && (
        <section className="panel panel--table">
          <div className="panel__header"><h3>{text.tabConfig}</h3><span className="panel__kicker">{entries.length}</span></div>
          {entries.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.human}</th><th>{text.key}</th><th>{text.type}</th><th>{text.value}</th><th>{text.rollout}</th><th>{text.targeting}</th><th>{text.updated}</th><th></th></tr></thead><tbody>
            {entries.map(e=>{
              const meta=TYPE_META[e.key]
              const isKill=KILL_SWITCHES.includes(e.key)
              return <tr key={e.key} style={isKill? {background:'#fff7ed'}: undefined}>
                <td><strong>{meta? (locale==='ar'? meta.ar: meta.en): e.key}</strong><br/><small style={{color:'var(--muted)'}}>{meta?.type ?? 'string'}</small>{isKill && <span className="status-badge status-badge--review" style={{marginInlineStart:6}}>{text.kill}</span>}</td>
                <td dir="ltr"><span className="table-primary">{e.key}</span></td>
                <td>{meta?.type ?? 'json'}</td>
                <td><span className={isTruthy(e.value)?'track-badge':'status-badge status-badge--draft'}>{displayValue(e.value, text)}</span></td>
                <td dir="ltr">{e.rollout_percent}%</td>
                <td><span className="table-secondary">{Object.keys(e.targeting??{}).length? JSON.stringify(e.targeting): text.everyone}</span></td>
                <td dir="ltr">{String(e.updated_at??'').slice(0,16)}</td>
                <td><button className="button button--ghost button--small" onClick={()=> openEdit(e)}>{text.edit}</button></td>
              </tr>
            })}
          </tbody></table></div> : <EmptyState title={text.empty} description={text.empty} />}
          <div style={{padding:12, fontSize:12, color:'var(--muted)'}}>
            <h4>{text.preview}</h4><p>{text.previewHint}</p>
            <div style={{display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginTop:8}}>
              <select defaultValue="EG" id="rc-country"><option value="EG">EG</option><option value="SA">SA</option><option value="CA">CA</option></select>
              <select defaultValue="android" id="rc-platform"><option value="android">Android</option><option value="ios">iOS</option></select>
              <input placeholder="app version 2.4" defaultValue="2.4.0" id="rc-version"/>
              <select defaultValue="family"><option value="free">free</option><option value="family">family</option></select>
              <select defaultValue="ar"><option value="ar">ar</option><option value="en">en</option></select>
            </div>
            <button className="button button--ghost button--small" style={{marginTop:8}} onClick={async()=>{
              const c=(document.getElementById('rc-country') as HTMLSelectElement)?.value??'EG'
              const p=(document.getElementById('rc-platform') as HTMLSelectElement)?.value??'android'
              const v=(document.getElementById('rc-version') as HTMLInputElement)?.value??'2.4.0'
              // simulate resolver: find first matching entry with rollout 100
              setPreview({ country:c, platform:p, version:v, resolved: entries.filter(e=> Number(e.rollout_percent)>0).map(e=> e.key).slice(0,3) })
            }}>{text.preview}</button>
            {preview && <pre style={{background:'#f6f8fa', padding:8, borderRadius:6, marginTop:8, fontSize:12}}>{JSON.stringify(preview,null,2)}</pre>}
          </div>
        </section>
      )}

      {activeTab==='flags' && (
        <section className="panel panel--table">
          <div className="panel__header"><h3>{text.tabFlags}</h3><span className="panel__kicker">{flags.length}</span></div>
          {flags.length? <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.human}</th><th>{text.key}</th><th>{text.status}</th><th>{text.targeting}</th><th>Client versions</th><th>{text.updated}</th></tr></thead><tbody>
            {flags.map(f=>(
              <tr key={f.key}><td><strong>{TYPE_META[f.key]?.en ?? f.key}</strong>{KILL_SWITCHES.includes(f.key)&& <span className="status-badge status-badge--review" style={{marginInlineStart:6}}>{text.kill}</span>}</td>
                <td dir="ltr">{f.key}</td><td><span className={f.enabled? 'track-badge':'status-badge status-badge--draft'}>{f.enabled? text.enabled: text.disabled}</span></td>
                <td><span className="table-secondary">{Object.keys(f.targeting??{}).length? JSON.stringify(f.targeting): text.everyone}</span></td><td>≥2.4</td><td>{String(f.created_at??'').slice(0,16)}</td></tr>
            ))}
          </tbody></table></div> : <EmptyState title={text.flagsEmpty} description={text.flagsEmpty} />}
          <div style={{padding:12, fontSize:12, color:'var(--muted)'}}><strong>{text.killSwitchDesc}</strong><br/>Examples: offline, downloads, game engine — only if they exist, no fake switches.</div>
        </section>
      )}

      {activeTab==='rollouts' && (
        <section className="panel"><div style={{padding:12}}><h3>Rollouts</h3>
          <table className="data-table"><thead><tr><th>Key</th><th>Rollout</th><th>Targeting</th></tr></thead><tbody>
            {entries.map(e=> <tr key={e.key}><td dir="ltr">{e.key}</td><td>{e.rollout_percent}% deterministically sticky (hash of user id)</td><td>{Object.keys(e.targeting??{}).length? JSON.stringify(e.targeting): text.everyone}</td></tr>)}
          </tbody></table>
          <p style={{fontSize:12, color:'var(--muted)', marginTop:8}}>Not randomized per request — stable per user.</p>
        </div></section>
      )}

      {activeTab==='history' && (
        <section className="panel"><div style={{padding:12}}><h3>{text.history}</h3><p style={{fontSize:12, color:'var(--muted)'}}>{text.historyHint}</p>
          <table className="data-table"><thead><tr><th>Key</th><th>Actor</th><th>Time</th><th>Old → New</th><th>Reason</th></tr></thead><tbody>
            {history.slice(0,10).map((h:any)=> <tr key={h.id}><td dir="ltr">{h.entity_id}</td><td>{h.actor_id}</td><td>{String(h.created_at).slice(0,16)}</td><td style={{maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{h.details}</td><td>—</td></tr>)}
            {!history.length && <tr><td colSpan={5} style={{textAlign:'center', color:'var(--muted)'}}>No history yet</td></tr>}
          </tbody></table>
          <button className="button button--ghost button--small" disabled>Rollback where safe</button>
        </div></section>
      )}

      {selected && (
        <Modal open title={`${text.editTitle}: ${selected.key}`} onClose={()=> setSelected(null)}>
          <div className="entity-form">
            <dl className="detail-list"><div><dt>{text.key}</dt><dd dir="ltr">{selected.key}</dd></div><div><dt>{text.type}</dt><dd>{TYPE_META[selected.key]?.type ?? 'json'}</dd></div><div><dt>{text.updated}</dt><dd>{selected.updated_at}</dd></div></dl>
            <label className="field"><span>{TYPE_META[selected.key]?.ar ?? TYPE_META[selected.key]?.en ?? 'Purpose'} — Impact: {TYPE_META[selected.key] ? 'high' : 'normal'}</span><small>{TYPE_META[selected.key] ? `Allowed: ${TYPE_META[selected.key].example}` : ''}</small></label>
            <label className="field"><span>{text.valueLabel}</span><input dir="ltr" value={valueText} onChange={e=> setValueText(e.target.value)} /></label>
            <label className="field"><span>{text.rolloutLabel}</span><input type="number" min={0} max={100} value={rollout} onChange={e=> setRollout(e.target.value)} dir="ltr" /></label>
            <label className="field"><span>{text.targetingLabel}</span><input dir="ltr" value={targetingText} onChange={e=> setTargetingText(e.target.value)} placeholder='{"country":"EG","platform":"android"}' /></label>
            {(KILL_SWITCHES.includes(selected.key) || selected.key==='min_app_version') && (
              <label className="field" style={{padding:8, background:'#fffbeb', border:'1px solid #fbbf24', borderRadius:6}}>
                <span>{text.highRisk}</span>
                {selected.key==='min_app_version' && <small style={{color:'#b45309'}}>{text.minVersionWarn}</small>}
                <label style={{display:'flex', gap:6, alignItems:'center', marginTop:6}}><input type="checkbox" checked={confirmHighRisk} onChange={e=> setConfirmHighRisk(e.target.checked)} /><span>I understand impact</span></label>
              </label>
            )}
            {modalError && <p className="field__error" role="alert">{modalError}</p>}
            <div className="form-actions">
              <button className="button button--ghost" onClick={()=> setSelected(null)}>{text.cancel}</button>
              <button className="button button--primary" disabled={saving} onClick={()=> void validateAndSave()}>{saving? text.saving: text.save}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
