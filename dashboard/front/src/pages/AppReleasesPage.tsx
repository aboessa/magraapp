// @ts-nocheck
import { EmptyState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
export function AppReleasesPage(){
  const { locale }=usePreferences()
  return (
    <div className="page-stack">
      <section className="page-intro"><div><span className="eyebrow">App Control</span><h2>{locale==='ar'? 'إصدارات التطبيق والتوافق':'App Releases & Compatibility'}</h2><p>{locale==='ar'? 'الحد الأدنى للإصدار والتوافق — يُدار عبر Remote Config: min_app_version.':'Min version & compatibility — via Remote Config: min_app_version.'}</p></div></section>
      <div className="panel" style={{padding:16}}><h3>Compatibility</h3><p style={{fontSize:12, color:'var(--muted)'}}>Supported from App Version X shown in Home Builder per section. Old clients get fallback.</p>
        <table className="data-table"><thead><tr><th>Version</th><th>Released</th><th>Min required</th></tr></thead><tbody><tr><td>2.5.0</td><td>2026-08-01</td><td>2.4.0</td></tr></tbody></table>
      </div>
    </div>
  )
}
