import { useState } from 'react'
import type { FormEvent } from 'react'
import { usePreferences } from '../context/preferences'
import { changeOwnPassword, readAdminUser } from '../lib/adminSession'
import { Icon } from '../components/Icon'
import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'

const copy={
  ar:{
    eyebrow:'الأمان · حسابي',
    title:'أمان حسابك',
    lede:'حماية جلساتك وكلمات المرور. MFA قيد الخارطة، وكلمة المرور الحالية هي الطبقة الأساسية.',
    passwordTitle:'تغيير كلمة المرور',
    passwordHint:'سيتم تسجيل خروج جميع الجلسات الأخرى فوراً بعد تغيير كلمة المرور. الجلسة الحالية تبقى حتى تسجيل خروج يدوي.',
    current:'كلمة المرور الحالية', next:'كلمة المرور الجديدة', confirm:'تأكيد الجديدة',
    hint:'10 أحرف على الأقل، يُفضل 14+ مع حروف كبيرة وصغيرة وأرقام ورموز.',
    change:'تغيير كلمة المرور', changing:'جارٍ التغيير…',
    mismatch:'كلمة المرور الجديدة وتأكيدها غير متطابقين',
    tooShort:'10 أحرف على الأقل - الأمان الحالي يتطلب 12 حرفاً في التسجيل',
    changed:'تم التغيير - سيُطلب منك تسجيل دخول جديد في الأجهزة الأخرى.',
    show:'إظهار', hide:'إخفاء', strength:'قوة كلمة المرور',
    mfa:'التحقق بخطوتين (MFA)',
    mfaDesc:'غير مفعّل بعد - يُدار عبر مزود الهوية الخارجي. عند التفعيل، سيتطلب رمز TOTP بعد كلمة المرور. حالياً: كلمة مرور قوية (12+) + قفل حساب بعد 5 محاولات فاشلة لـ 15 دقيقة + تسجيل خروج الجلسات الأخرى عند تغيير كلمة المرور.',
    mfaStatus:'الحالة: غير مفعّل',
    recovery:'الاسترداد',
    recoveryDesc:'استرداد كلمة المرور عبر البريد مع رمز صالح لساعة واحدة + throttle دقيقتين + إبطال الجلسات بعد الاسترداد الناجح.',
    activity:'سجل النشاط الأمني',
    activityDesc:'أحداث: تغيير كلمة المرور، تفعيل MFA، سحب جلسة، تسجيل دخول، فشل تسجيل دخول (مقفل بعد 5 محاولات). لا يتم تخزين tokens خام - فقط hashes.',
    sessionsLink:'عرض الجلسات النشطة',
    accountLink:'حسابي',
  },
  en:{
    eyebrow:'Security · My Account',
    title:'Account security',
    lede:'Protect your sessions and passwords. MFA is on roadmap, strong password is current layer.',
    passwordTitle:'Change password',
    passwordHint:'All other sessions will be signed out immediately after change. Current session stays until manual sign-out.',
    current:'Current password', next:'New password', confirm:'Confirm new',
    hint:'At least 10 chars, 14+ with upper/lower/numbers/symbols recommended.',
    change:'Change password', changing:'Changing…',
    mismatch:'New password and confirmation mismatch',
    tooShort:'At least 10 chars - registration requires 12',
    changed:'Changed - other devices will be asked to re-login.',
    show:'Show', hide:'Hide', strength:'Password strength',
    mfa:'Two-factor auth (MFA)',
    mfaDesc:'Not yet - managed via external identity provider. When enabled, will require TOTP after password. Current: strong password (12+) + lockout after 5 failures for 15 min + other sessions sign-out on change.',
    mfaStatus:'Status: Not enabled',
    recovery:'Recovery',
    recoveryDesc:'Password reset via email with 1-hour token + 2-min throttle + sessions revoked after successful reset.',
    activity:'Security activity log',
    activityDesc:'Events: password changed, MFA enabled, session revoked, login, failed login (locked after 5). No raw tokens stored - hashes only.',
    sessionsLink:'View active sessions',
    accountLink:'My account',
  }
}

export function SecurityPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  const user=readAdminUser()
  const [form,setForm]=useState({ current:'', next:'', confirm:'' })
  const [show, setShow]=useState({ current:false, next:false, confirm:false })
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)

  const strengthVal = form.next.length===0 ? 0 : form.next.length<10 ? 1 : form.next.length<14 ? 2 : 3
  const strengthLabel = form.next.length===0 ? '' : strengthVal===1 ? (locale==='ar'?'ضعيف':'Weak') : strengthVal===2 ? (locale==='ar'?'متوسط':'Medium') : (locale==='ar'?'قوي':'Strong')
  const strengthColor = strengthVal===1 ? '#ef4444' : strengthVal===2 ? '#f59e0b' : '#10b981'

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
    <div className="page-stack" style={{ maxWidth:760, margin:'0 auto', gap:18 }}>
      <style>{`
        .sec-hero{position:relative;border-radius:20px;border:1px solid var(--line);background:linear-gradient(160deg, var(--surface), var(--surface-2));padding:20px;overflow:hidden}
        .sec-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(520px 200px at 85% -10%, rgba(86,121,242,.12), transparent 60%), radial-gradient(380px 200px at -5% 110%, rgba(240,93,119,.06), transparent 70%)}
        .sec-hero>*{position:relative}
        .sec-kicker{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:999px;border:1px solid var(--line);background:var(--surface-2);font-size:10px;font-weight:700;color:var(--muted)}
        .sec-panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .sec-panel__head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:12px}
        .strength{height:6px;border-radius:999px;background:var(--surface-3);overflow:hidden;margin-top:6px}
        .strength span{display:block;height:100%;border-radius:inherit;transition:width .28s var(--ease, ease)}
      `}</style>

      <section className="sec-hero">
        <span className="sec-kicker"><Icon name="rights" size={12}/>{text.eyebrow}</span>
        <h2 style={{ marginTop:12, fontSize:22, letterSpacing:'-.03em' }}>{text.title}</h2>
        <p style={{ marginTop:8, color:'var(--text-soft)', fontSize:11, lineHeight:1.7, maxWidth:620 }}>{text.lede}</p>
        <div style={{ marginTop:10, display:'flex', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{user?.email ?? ''}</span>
          <span className="status-badge status-badge--published" style={{ fontSize:10 }}>{user?.display_name ?? ''}</span>
        </div>
      </section>

      <div className="sec-panel">
        <div className="sec-panel__head"><h3 style={{ fontSize:13 }}>{text.passwordTitle}</h3><span style={{ fontSize:10, color:'var(--muted)' }}>{text.passwordHint}</span></div>
        <div style={{ padding:16 }}>
          <form onSubmit={submit} style={{ display:'grid', gap:14, maxWidth:520 }}>
            {(['current','next','confirm'] as const).map(k=>(
              <label key={k} className="field">
                <span style={{ fontSize:11, fontWeight:700 }}>{text[k==='current'?'current': k==='next'?'next':'confirm']}</span>
                <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                  <input type={show[k]? 'text':'password'} value={form[k]} onChange={e=> setForm({...form, [k]: e.target.value})} autoComplete={k==='current'? 'current-password':'new-password'} dir="ltr" style={{ flex:1, height:40, borderRadius:10, border:'1px solid var(--line)', background:'var(--surface-2)', padding:'0 12px' }} required />
                  <button type="button" className="button button--ghost button--small" onClick={()=> setShow(s=> ({...s, [k]: !s[k]}))} style={{ height:40 }}>{show[k]? text.hide: text.show}</button>
                </div>
                {k==='next' && (
                  <>
                    <small style={{ color:'var(--muted)', fontSize:10 }}>{text.hint}</small>
                    <div className="strength"><span style={{ width: `${(strengthVal/3)*100}%`, background: strengthColor }} /></div>
                    {strengthLabel && <small style={{ color: strengthColor, fontWeight:700 }}>{text.strength}: {strengthLabel}</small>}
                  </>
                )}
              </label>
            ))}
            {error && <div className="inline-alert inline-alert--error" role="alert">{error}</div>}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}><button className="button button--primary" type="submit" disabled={busy}>{busy? text.changing: text.change}</button><Link className="button button--ghost" to={adminPath('my-account')}>{text.accountLink}</Link><Link className="button button--ghost" to={adminPath('sessions')}>{text.sessionsLink}</Link></div>
          </form>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div className="sec-panel" style={{ padding:16 }}>
          <h3 style={{ fontSize:12, display:'flex', alignItems:'center', gap:8 }}><Icon name="rights" size={14}/> {text.mfa}</h3>
          <div style={{ marginTop:8, padding:'10px 12px', borderRadius:10, background:'rgba(245,165,36,.08)', border:'1px solid rgba(245,165,36,.18)', fontSize:11, lineHeight:1.7, color:'var(--text-soft)' }}>{text.mfaDesc}</div>
          <span className="status-badge status-badge--review" style={{ marginTop:10, fontSize:10 }}>{text.mfaStatus}</span>
        </div>
        <div className="sec-panel" style={{ padding:16 }}>
          <h3 style={{ fontSize:12, display:'flex', alignItems:'center', gap:8 }}><Icon name="clock" size={14}/> {text.recovery}</h3>
          <p style={{ fontSize:11, color:'var(--muted)', lineHeight:1.7, marginTop:8 }}>{text.recoveryDesc}</p>
          <h3 style={{ fontSize:12, marginTop:14, display:'flex', alignItems:'center', gap:8 }}><Icon name="analytics" size={14}/> {text.activity}</h3>
          <p style={{ fontSize:11, color:'var(--muted)', lineHeight:1.7, marginTop:6 }}>{text.activityDesc}</p>
        </div>
      </div>
    </div>
  )
}
