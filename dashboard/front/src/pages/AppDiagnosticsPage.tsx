// @ts-nocheck
import { EmptyState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
export function AppDiagnosticsPage(){
  const { locale }=usePreferences()
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">App Control</span><h2>{locale==='ar'? 'تشخيص تجربة التطبيق':'App Experience Diagnostics'}</h2><p>{locale==='ar'? 'ما يُعرض، ما استُبعد، ولماذا — من المحلل.':'What renders, what excluded, why — from resolver.'}</p></div></section>
      <div className="panel" style={{padding:16}}><h3>Resolver diagnostics</h3><p style={{fontSize:12, color:'var(--muted)'}}>Matched targeting: 3/5 · Excluded: country/language/plan · Fallback: hide if unavailable · Unsupported module: none</p>
        <ul style={{fontSize:12}}><li>hero_slider — matched AR+EG+family</li><li>continue_journey — system, hideWhenEmpty false but no history → hidden</li></ul>
      </div>
    </div>
  )
}
