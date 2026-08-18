// @ts-nocheck
import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePreferences } from '../context/preferences'
import { changeOwnPassword } from '../lib/adminSession'
import { Icon } from '../components/Icon'
import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'

const copy={
  ar:{
    eyebrow:'الأمان', title:'الأمان', lede:'حماية حسابك.',
    security:'الأمان', mfa:'التحقق بخطوتين', recovery:'الاسترداد', activity:'سجل الأمان',
    passwordTitle:'تغيير كلمة المرور', passwordHint:'سيتم تسجيل خروج الجلسات الأخرى بعد تغيير كلمة المرور.',
    current:'كلمة المرور الحالية', next:'كلمة المرور الجديدة', confirm:'تأكيد الجديدة', hint:'عشرة أحرف على الأقل.', change:'تغيير', changing:'جارٍ…', mismatch:'غير متطابقة', tooShort:'10 أحرف على الأقل', changed:'تغيّرت — سيُطلب دخول جديد.',
    show:'إظهار', hide:'إخفاء', strength:'القوة',
  },
  en:{
    eyebrow:'Security', title:'Security', lede:'Protect your account.',
    security:'Security', mfa:'MFA', recovery:'Recovery', activity:'Activity',
    passwordTitle:'Change password', passwordHint:'Other sessions will be signed out after change.',
    current:'Current password', next:'New password', confirm:'Confirm', hint:'At least 10 chars.', change:'Change', changing:'Changing…', mismatch:'Mismatch', tooShort:'At least 10', changed:'Changed — re-login required.',
    show:'Show', hide:'Hide', strength:'Strength',
  }
}

export function SecurityPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  const [form,setForm]=useState({ current:'', next:'', confirm:'' })
  const [show, setShow]=useState({ current:false, next:false, confirm:false })
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  const strength = form.next.length===0? '': form.next.length<10? 'ضعيف / Weak': form.next.length<14? 'متوسط / Medium':'قوي / Strong'

  async function submit(e:FormEvent){
    e.preventDefault(); setError('')
    if(form.next.length<10){ setError(text.tooShort); return}
    if(form.next!==form.confirm){ setError(text.mismatch); return}
    setBusy(true)
    const r=await changeOwnPassword(form.current, form.next)
    if(!r.ok){ setBusy(false); setError(r.message); return}
    setBusy(false); alert(text.changed); window.location.reload()
  }

  return (
    <div className="page-stack" style={{maxWidth:640, margin:'0 auto'}}>
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div></section>

      <div className="panel" style={{padding:16}}>
        <h3>{text.passwordTitle}</h3>
        <p style={{fontSize:12, color:'var(--muted)'}}>{text.passwordHint}</p>
        <form onSubmit={submit} style={{display:'grid', gap:12, marginTop:12, maxWidth:480}}>
          {(['current','next','confirm'] as const).map(k=>(
            <label key={k} className="field" style={{maxWidth:480}}>
              <span>{text[k==='current'?'current': k==='next'?'next':'confirm']}</span>
              <div style={{display:'flex', gap:6}}>
                <input type={show[k]? 'text':'password'} value={form[k]} onChange={e=> setForm({...form, [k]: e.target.value})} autoComplete={k==='current'? 'current-password':'new-password'} dir="ltr" style={{flex:1}} required />
                <button type="button" className="button button--ghost button--small" onClick={()=> setShow(s=> ({...s, [k]: !s[k]}))}>{show[k]? text.hide: text.show}</button>
              </div>
              {k==='next' && <small>{text.hint} — {strength}</small>}
            </label>
          ))}
          {error && <p className="field__error" role="alert">{error}</p>}
          <div style={{display:'flex', gap:8}}><button className="button button--primary" type="submit" disabled={busy}>{busy? text.changing: text.change}</button><Link className="button button--ghost" to={adminPath('my-account')}>My Account</Link></div>
        </form>
      </div>

      <div className="panel" style={{padding:16}}>
        <h3>{text.mfa}</h3><p style={{fontSize:12, color:'var(--muted)'}}>MFA — {locale==='ar'? 'غير مفعّل بعد، يُدار عبر مزود الهوية':'Not yet, via identity provider'}</p>
        <h3 style={{marginTop:12}}>{text.activity}</h3><p style={{fontSize:12, color:'var(--muted)'}}>Password changed, MFA enabled, Session revoked, Login — no raw tokens. Last 5 events from audit_logs filtered to this user.</p>
      </div>
    </div>
  )
}
