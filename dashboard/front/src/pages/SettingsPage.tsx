// @ts-nocheck
import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'

const copy={
  ar:{ eyebrow:'الإعدادات', title:'الإعدادات', lede:'تم فصل الإعدادات — اختر وجهتك.', websiteMode:'وضع الموقع', websiteDesc:'LIVE / قادم قريباً / صيانة', myAccount:'حسابي', myDesc:'الملف، اللغة، المظهر', security:'الأمان', secDesc:'كلمة المرور، التحقق، السجل', sessions:'الجلسات', sessDesc:'الأجهزة المتصلة' },
  en:{ eyebrow:'Settings', title:'Settings', lede:'Settings have been split — choose destination.', websiteMode:'Website Mode', websiteDesc:'LIVE / Coming Soon / Maintenance', myAccount:'My Account', myDesc:'Profile, language, theme', security:'Security', secDesc:'Password, MFA, history', sessions:'Sessions', sessDesc:'Connected devices' }
}
export function SettingsPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  return (
    <div className="page-stack" style={{maxWidth:720, margin:'0 auto'}}>
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div></section>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
        <Link to={adminPath('website/mode')} className="panel" style={{padding:16, textDecoration:'none'}}><Icon name="globe" size={20}/><h3>{text.websiteMode}</h3><p style={{fontSize:12, color:'var(--muted)'}}>{text.websiteDesc}</p></Link>
        <Link to={adminPath('my-account')} className="panel" style={{padding:16, textDecoration:'none'}}><Icon name="parents" size={20}/><h3>{text.myAccount}</h3><p style={{fontSize:12, color:'var(--muted)'}}>{text.myDesc}</p></Link>
        <Link to={adminPath('security')} className="panel" style={{padding:16, textDecoration:'none'}}><Icon name="rights" size={20}/><h3>{text.security}</h3><p style={{fontSize:12, color:'var(--muted)'}}>{text.secDesc}</p></Link>
        <Link to={adminPath('sessions')} className="panel" style={{padding:16, textDecoration:'none'}}><Icon name="clock" size={20}/><h3>{text.sessions}</h3><p style={{fontSize:12, color:'var(--muted)'}}>{text.sessDesc}</p></Link>
      </div>
      <p style={{fontSize:12, color:'var(--muted)', marginTop:12}}>This hub replaces the previous giant vertical settings page — left navigation + focused column, max-width 720, sticky actions where needed.</p>
    </div>
  )
}
