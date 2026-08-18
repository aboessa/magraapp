// @ts-nocheck
import { usePreferences } from '../context/preferences'
import { readAdminUser } from '../lib/adminSession'
import { Link } from 'react-router-dom'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'

const copy={
  ar:{ eyebrow:'حسابي', title:'حسابي', lede:'معلومات حسابك ودورك.', name:'الاسم', email:'البريد', role:'الدور', teams:'الفرق', language:'اللغة', theme:'المظهر', lastLogin:'آخر دخول', editProfile:'تعديل الملف', security:'الأمان', sessions:'الجلسات' },
  en:{ eyebrow:'My Account', title:'My Account', lede:'Your account and role.', name:'Name', email:'Email', role:'Role', teams:'Teams', language:'Language', theme:'Theme', lastLogin:'Last login', editProfile:'Edit profile', security:'Security', sessions:'Sessions' }
}
export function MyAccountPage(){
  const { locale }=usePreferences()
  const text=copy[locale]
  const self=readAdminUser()
  return (
    <div className="page-stack" style={{maxWidth:680, margin:'0 auto'}}>
      <section className="page-intro"><div><span className="eyebrow">{text.eyebrow}</span><h2>{text.title}</h2><p>{text.lede}</p></div></section>
      <div className="panel" style={{padding:16}}>
        <div style={{display:'flex', gap:16, alignItems:'center'}}>
          <div style={{width:64, height:64, borderRadius:999, background:'var(--primary)', display:'grid', placeItems:'center', color:'#fff', fontSize:24}}>{String(self?.email??'A').charAt(0).toUpperCase()}</div>
          <div><strong>{self?.display_name ?? self?.email ?? '—'}</strong><br/><span dir="ltr" style={{color:'var(--muted)'}}>{self?.email ?? ''}</span><br/><small>{text.role}: {(self?.roles??[]).join(', ')||'—'}</small></div>
        </div>
        <dl className="detail-list" style={{marginTop:16}}>
          <div><dt>{text.name}</dt><dd>{self?.display_name ?? '—'}</dd></div>
          <div><dt>{text.email}</dt><dd dir="ltr">{self?.email ?? '—'}</dd></div>
          <div><dt>{text.role}</dt><dd>{(self?.roles??[]).join(', ')||'—'}</dd></div>
          <div><dt>{text.language}</dt><dd>{locale==='ar'?'العربية':'English'}</dd></div>
          <div><dt>{text.lastLogin}</dt><dd>{String((self as any)?.last_login_at ?? '—')}</dd></div>
        </dl>
        <div style={{display:'flex', gap:8, marginTop:16}}>
          <Link className="button button--primary" to={adminPath('security')}><Icon name="rights" size={14}/>{text.security}</Link>
          <Link className="button button--ghost" to={adminPath('sessions')}><Icon name="clock" size={14}/>{text.sessions}</Link>
        </div>
      </div>

      <div className="panel" style={{padding:16}}>
        <h3>Left navigation + focused column</h3>
        <p style={{fontSize:12, color:'var(--muted)'}}>Settings use max-content width 680px, not stretched across 1200px. No infinite vertical page — navigation on left, content focused.</p>
      </div>
    </div>
  )
}
