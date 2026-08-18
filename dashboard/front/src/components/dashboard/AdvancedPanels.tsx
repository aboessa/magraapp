import { Link } from 'react-router-dom'
import { adminPath } from '../../lib/adminPath'
import { Icon } from '../Icon'

export function AdvancedPanels({ teasers, locale }: { teasers:{cal7:number|null;transPending:number|null; transStale?:number|null; calDetail?:{total:number}; factoryRuns?:number|null}; locale:'ar'|'en' }) {
  return (
    <>
      <section className="dashboard-grid" style={{ gridTemplateColumns:'repeat(3, minmax(0,1fr))', gap:14 }}>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'التقويم':'Calendar'}</span><h3>7 {locale==='ar'?'أيام قادمة':'days ahead'}</h3></div><Link className="text-link" to={adminPath('calendar')}>{locale==='ar'?'التقويم':'Calendar'} <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'16px', textAlign:'center' }}>
            <strong style={{ fontSize:28 }}>{teasers.cal7 ?? '—'}</strong>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{locale==='ar'?'حدث مجدول':'scheduled events'}</div>
            <small style={{ color:'var(--muted)', fontSize:11, display:'block', marginTop:6 }}>/admin/calendar · total: {teasers.calDetail?.total ?? '—'}</small>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">Factory</span><h3>{locale==='ar'?'مصنع المحتوى':'Content factory'}</h3></div><Link className="text-link" to={adminPath('production/factory')}>Factory <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'16px', textAlign:'center' }}>
            <strong style={{ fontSize:28 }}>{teasers.factoryRuns ?? '—'}</strong>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{locale==='ar'?'تشغيل مصنع':'factory runs'}</div>
            <small style={{ color:'var(--muted)', fontSize:11, display:'block', marginTop:6 }}>/admin/production/factory</small>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">Quality</span><h3>{locale==='ar'?'الجودة':'Readiness'}</h3></div><Link className="text-link" to={adminPath('quality')}>Quality <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <small style={{ fontSize:12, color:'var(--text-soft)' }}>{locale==='ar'?'الجودة تُحسب لكل كيان عند فتحه — لا مجمع وهمي.':'Quality is per-entity on open — no fake aggregate.'}</small>
            <Link className="button button--ghost button--small" to={adminPath('quality')} style={{ justifyContent:'center' }}><Icon name="check" size={12} /> {locale==='ar'?'افتح فحص الجاهزية':'Open readiness check'}</Link>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">i18n</span><h3>{locale==='ar'?'الترجمة':'Translation'}</h3></div><Link className="text-link" to={adminPath('translation')}>{locale==='ar'?'المركز':'Center'} <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'16px', textAlign:'center' }}>
            <strong style={{ fontSize:28 }}>{teasers.transPending ?? '—'}</strong>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>{locale==='ar'?'وحدة معلّقة':'pending units'}</div>
            <small style={{ color:'var(--muted)', fontSize:11, display:'block', marginTop:6 }}>/admin/translation/queue · stale: {teasers.transStale ?? '—'}</small>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'التسويق':'Marketing'}</span><h3>{locale==='ar'?'مسار التحويل':'Acquisition funnel'}</h3></div><Link className="text-link" to={adminPath('campaigns')}>Campaigns <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'var(--muted)' }}>
              <span>Visitor → Account → Trial → Paid</span>
              <span className="status-badge status-badge--draft" style={{ fontSize:10 }}>UTM: source/medium</span>
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'يحتاج instrumentation للزوار — لا بيانات أطفال للإعلانات':'Needs visitor instrumentation — no child data for ads'}</small>
            <Link className="button button--ghost button--small" to={adminPath('campaigns')} style={{ justifyContent:'center' }}>{locale==='ar'?'إدارة الحملات':'Manage campaigns'}</Link>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">A/B</span><h3>{locale==='ar'?'التجارب':'Experiments'}</h3></div><span style={{ fontSize:10, padding:'3px 7px', borderRadius:999, background:'rgba(107,122,255,.12)', border:'1px solid rgba(107,122,255,.22)' }}>Phase 57</span></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <small style={{ fontSize:12, color:'var(--text-soft)' }}>{locale==='ar'?'التجارب على الأطفال لا تمس السلامة أو الحوكمة الدينية':'Experiments involving children must not touch safety or religious governance'}</small>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'الأساس جاهز — التحليل الإحصائي غير جاهز حتى اكتمال instrumentation':'Foundation ready — statistical analysis not ready until instrumentation is complete'}</small>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">Performance</span><h3>{locale==='ar'?'الأداء':'Core Web Vitals'}</h3></div><Link className="text-link" to={adminPath('analytics')}>Analytics <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:10 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
              {[
                {k:'LCP', v:'—', sub: locale==='ar'?'تحميل':'load'},
                {k:'CLS', v:'—', sub:'shift'},
                {k:'INP', v:'—', sub:'interact'},
              ].map(m=>(
                <div key={m.k} style={{ padding:'10px', border:'1px solid var(--line)', borderRadius:10, background:'var(--surface)', textAlign:'center' }}>
                  <small style={{ color:'var(--muted)', fontSize:11 }}>{m.k}</small><br/><strong style={{ fontSize:16 }}>{m.v}</strong><br/><small style={{ color:'var(--muted)', fontSize:10 }}>{m.sub}</small>
                </div>
              ))}
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'يحتاج RUM من التطبيق — لا قياس وهمي':'Needs RUM from app — no synthetic measurement'}</small>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">SEO</span><h3>{locale==='ar'?'صحة SEO':'SEO health'}</h3></div><Link className="text-link" to={adminPath('seo')}>SEO <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              <span className="status-badge status-badge--draft" style={{ fontSize:11 }}>noindex: —</span>
              <span className="status-badge status-badge--review" style={{ fontSize:11 }}>missing meta: —</span>
              <span className="status-badge status-badge--published" style={{ fontSize:11 }}>sitemap: —</span>
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'يُحسب من /admin/seo/overview — لا فهرسة وهمية':'Computed from /admin/seo/overview — no fake indexing'}</small>
          </div>
        </article>
      </section>

      <section className="dashboard-grid dashboard-grid--tracks">
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'جمعي':'Bulk'}</span><h3>{locale==='ar'?'عمليات جماعية':'Bulk ops'}</h3></div><Link className="text-link" to={adminPath('series')}>Series <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'12px 14px', display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
            {[
              {l: locale==='ar'?'تعيين مراجع':'Assign reviewer'},
              {l: locale==='ar'?'تغيير التصنيف':'Change category'},
              {l: locale==='ar'?'تغيير المسار':'Change track'},
              {l: locale==='ar'?'أرشفة':'Archive'},
            ].map(x=> <span key={x.l} style={{ padding:'7px 8px', border:'1px solid var(--line)', borderRadius:9, background:'var(--surface)', fontSize:12, textAlign:'center' }}>{x.l}</span>)}
          </div>
          <small style={{ color:'var(--muted)', fontSize:11, padding:'0 12px 10px', display:'block' }}>{locale==='ar'?'من أي قائمة — تحديد متعدد ثم إجراء جماعي':'From any list — multi-select then bulk action'}</small>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">Legal</span><h3>{locale==='ar'?'الصفحات القانونية':'Legal pages'}</h3></div><Link className="text-link" to={adminPath('settings')}>Settings <Icon name="arrow" size={12} /></Link></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              <span className="status-badge status-badge--draft" style={{ fontSize:11 }}>Privacy</span>
              <span className="status-badge status-badge--draft" style={{ fontSize:11 }}>Terms</span>
              <span className="status-badge status-badge--draft" style={{ fontSize:11 }}>Safety</span>
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'تُدار من /settings — نسخ محفوظة مع تدقيق':'Managed at /settings — versioned with audit'}</small>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header"><div><span className="panel__kicker">{locale==='ar'?'الخصوصية':'Privacy'}</span><h3>{locale==='ar'?'المدارس والشراكات':'Schools & partners'}</h3></div><div style={{ display:'flex', gap:6 }}><Link className="text-link" to={adminPath('school')}>Schools <Icon name="arrow" size={12} /></Link><Link className="text-link" to={adminPath('partnerships')}>Partners <Icon name="arrow" size={12} /></Link></div></header>
          <div style={{ padding:'14px 16px', display:'grid', gap:8 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <Link className="button button--ghost button--small" to={adminPath('school')}><Icon name="parents" size={12} /> {locale==='ar'?'المدارس':'Schools'}</Link>
              <Link className="button button--ghost button--small" to={adminPath('partnerships')}><Icon name="globe" size={12} /> {locale==='ar'?'الشراكات':'Partnerships'}</Link>
              <Link className="button button--ghost button--small" to={adminPath('audit-logs')}><Icon name="archive" size={12} /> Audit</Link>
            </div>
            <small style={{ color:'var(--muted)', fontSize:11 }}>{locale==='ar'?'طلبات الخصوصية و B2B — لا كشف لبيانات الأطفال':'Privacy requests & B2B — no child data exposure'}</small>
          </div>
        </article>
      </section>
    </>
  )
}
