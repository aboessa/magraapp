import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'

const copy = {
  ar: {
    eyebrow: 'التجارة · الفوترة',
    title: 'مركز الاشتراكات',
    lede: 'مزوّد الدفع يثبت الشراء، و FamilyState يمثل الحقيقة التشغيلية. هذه الشاشة تكشف الفجوة ولا تخفيها.',
    refresh: 'تحديث',
    search: 'ابحث بالعائلة أو خطة أو مزوّد…',
    metrics: {
      active: 'نشطة', grace: 'فترة سماح', expired: 'منتهية', mismatch: 'تناقض', refunded: 'مستردة',
      descActive: 'استحقاق فعّال الآن', descGrace: 'ستنتهي قريباً بدون تجديد', descExpired: 'لا وصول مدفوع', descMismatch: 'المزوّد ≠ الاستحقاق', descRefunded: 'أُلغي واستُرد'
    },
    tabs: { overview: 'نظرة عامة', subscriptions: 'الاشتراكات', transactions: 'المعاملات', mismatches: 'التناقضات', refunds: 'المستردة' },
    table: { family: 'العائلة', plan: 'الخطة', provider: 'المزوّد', providerState: 'حالة المزوّد', entitlement: 'الاستحقاق الفعلي', renewal: 'التجديد', alert: 'تنبيه', open: 'فتح' },
    overview: {
      byPlan: 'التوزيع حسب الخطة', recent: 'آخر عمليات شراء', trust: 'نموذج الثقة', trustDesc: 'Google Play = إثبات الدفع · FamilyState = قرار الوصول. أي فجوة = مهمة مصالحة، ليست حالة طبيعية.',
      match: 'متطابق', mismatchLabel: 'تناقض',
    },
    empty: { subs: 'لا اشتراكات بعد', subsHint: 'عند أول عملية شراء ناجحة ستظهر هنا.', tx: 'لا معاملات معروضة', mis: 'لا تناقضات — المزوّد والاستحقاق متطابقان', misHint: 'عند وجود فجوة ستُدرج هنا كمهام تسوية', refund:'لا يوجد نموذج بيانات لاسترداد المبالغ بعد', refundHint:'حالة revoked تعني إلغاء استحقاق لكن لا يوجد جدول refunds منفصل بسجل مبالغ، سبب الاسترداد، وقناة الاسترداد. عند توفره سيُعرض هنا مع ربط بمعاملة أصلية.' },
    kpis: 'مؤشرات حيّة'
  },
  en: {
    eyebrow: 'Commerce · Billing',
    title: 'Subscription Operations',
    lede: 'Payment provider proves purchase, FamilyState is operational truth. This screen exposes the gap, never hides it.',
    refresh: 'Refresh',
    search: 'Search family, plan or provider…',
    metrics: {
      active: 'Active', grace: 'Grace', expired: 'Expired', mismatch: 'Mismatch', refunded: 'Refunded',
      descActive: 'Entitlement active now', descGrace: 'Will expire without renewal', descExpired: 'No paid access', descMismatch: 'Provider ≠ Entitlement', descRefunded: 'Revoked & refunded'
    },
    tabs: { overview: 'Overview', subscriptions: 'Subscriptions', transactions: 'Transactions', mismatches: 'Mismatches', refunds: 'Refunds' },
    table: { family: 'Family', plan: 'Plan', provider: 'Provider', providerState: 'Provider state', entitlement: 'Effective entitlement', renewal: 'Renewal', alert: 'Alert', open: 'Open' },
    overview: {
      byPlan: 'Distribution by plan', recent: 'Recent purchases', trust: 'Trust model', trustDesc: 'Google Play = proof of payment · FamilyState = access decision. Any gap = reconciliation task, not normal state.',
      match: 'MATCH', mismatchLabel: 'MISMATCH',
    },
    empty: { subs: 'No subscriptions yet', subsHint: 'First successful purchase appears here.', tx: 'No transactions', mis: 'No mismatches — provider and entitlement aligned', misHint: 'Gaps will be listed here as reconciliation tasks' },
    kpis: 'Live indicators'
  }
}

function formatMs(v: unknown, locale: 'ar' | 'en') {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return '—'
  return new Date(v).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' })
}

export function BillingPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'ar' ? 'ar' : 'en'] as any
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as any) || 'overview'
  const [stats, setStats] = useState<any>(null)
  const [subs, setSubs] = useState<any[]>([])
  const [mismatches, setMismatches] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filterPlan, setFilterPlan] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [s, subRes, recon, refundsRes] = await Promise.all([
        api.billingStats(),
        api.subscriptions({ q: query || undefined, plan: filterPlan || undefined, limit: 50, offset: 0 } as any),
        api.commerceReconciliation().catch(() => ({ data: { mismatches: [] } }) as any),
        api.billingRefunds({ limit: 50 } as any).catch(()=> ({ data: [] }) as any),
      ])
      setStats(s.data)
      setSubs((subRes as any).data ?? [])
      setMismatches((recon as any).data?.mismatches ?? [])
      setRefunds((refundsRes as any).data ?? [])
    } catch (e) { setError(e instanceof Error ? e.message : text.loadError) } finally { setLoading(false) }
  }, [query, filterPlan, text.loadError])

  useEffect(() => { const t = setTimeout(() => void load(), query ? 220 : 0); return () => clearTimeout(t) }, [load])
  const setTab = (t: string) => { const n = new URLSearchParams(searchParams); n.set('tab', t); setSearchParams(n) }

  const metrics = useMemo(() => ({
    active: (stats?.by_plan ?? []).reduce((a: any, c: any) => a + Number(c.count), 0),
    grace: subs.filter((s: any) => s.entitlement_status === 'grace').length,
    expired: subs.filter((s: any) => s.entitlement_status === 'expired').length,
    mismatches: mismatches.length,
    refunded: subs.filter((s: any) => s.entitlement_status === 'revoked').length,
  }), [stats, subs, mismatches])

  const byPlanMax = Math.max(1, ...(stats?.by_plan ?? []).map((r: any) => Number(r.count) || 0))

  return (
    <div className="page-stack" style={{ gap: 20 }}>
      <style>{`
        .billing-hero{position:relative;overflow:hidden;border-radius:20px;border:1px solid var(--line);background:linear-gradient(165deg, color-mix(in srgb, var(--surface) 96%, #fff), var(--surface));padding:22px 22px 18px}
        .billing-hero::before{content:'';position:absolute;inset:-1px;background:radial-gradient(520px 220px at 85% -10%, rgba(86,121,242,.18), transparent 60%), radial-gradient(380px 200px at 5% 110%, rgba(0,214,245,.12), transparent 70%)}
        .billing-hero>*{position:relative;z-index:1}
        .billing-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;border-radius:999px;background:var(--surface-2);border:1px solid var(--line);font-size:10px;font-weight:700;letter-spacing:.04em;color:var(--muted)}
        .billing-title{margin-top:12px;font-size:clamp(22px, 2.6vw, 30px);letter-spacing:-.04em;line-height:1.1}
        .billing-lede{margin-top:8px;max-width:680px;color:var(--text-soft);font-size:12px;line-height:1.7}
        .kpi-grid{display:grid;grid-template-columns:repeat(5, minmax(0,1fr));gap:12px}
        @media(max-width:1100px){.kpi-grid{grid-template-columns:repeat(3, minmax(0,1fr))}}
        @media(max-width:640px){.kpi-grid{grid-template-columns:repeat(2, minmax(0,1fr))}}
        .kpi-card{position:relative;overflow:hidden;border-radius:16px;border:1px solid var(--line);background:linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--surface) 92%, var(--surface-2)));padding:14px 14px 12px;transition:transform .18s, border-color .18s}
        .kpi-card:hover{transform:translateY(-1px);border-color:var(--line-strong)}
        .kpi-card__top{display:flex;align-items:center;justify-content:space-between;color:var(--muted);font-size:10px;font-weight:700;letter-spacing:.03em}
        .kpi-card__icon{width:30px;height:30px;display:grid;place-items:center;border-radius:9px}
        .kpi-card__value{margin-top:10px;font-size:26px;font-weight:800;letter-spacing:-.04em}
        .kpi-card__desc{margin-top:4px;color:var(--muted);font-size:10px;line-height:1.5}
        .kpi-card--active{--glow:var(--primary)} .kpi-card--active .kpi-card__icon{background:rgba(86,121,242,.12);color:var(--primary)}
        .kpi-card--grace .kpi-card__icon{background:rgba(245,165,36,.12);color:#d48a00}
        .kpi-card--expired .kpi-card__icon{background:rgba(161,161,161,.12);color:var(--muted)}
        .kpi-card--mismatch{border-color:rgba(217,119,6,.35)} .kpi-card--mismatch .kpi-card__icon{background:rgba(217,119,6,.14);color:#b45309}
        .kpi-card--refunded .kpi-card__icon{background:rgba(240,93,119,.10);color:#c43a54}
        .seg{display:inline-flex;gap:4px;padding:4px;border-radius:12px;border:1px solid var(--line);background:var(--surface-2)}
        .seg button{min-height:34px;padding:0 14px;border-radius:9px;border:1px solid transparent;background:transparent;color:var(--text-soft);font-size:12px;font-weight:700;transition:all .16s}
        .seg button[aria-selected="true"]{background:var(--surface);border-color:var(--line-strong);color:var(--text);box-shadow:0 2px 10px rgba(0,0,0,.06)}
        .billing-panel{border:1px solid var(--line);border-radius:16px;background:var(--surface);overflow:hidden}
        .billing-panel__head{padding:16px 18px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .billing-panel__head h3{font-size:13px;letter-spacing:-.02em}
        .billing-panel__note{color:var(--muted);font-size:10px;line-height:1.6}
        .mini-bar{height:6px;border-radius:999px;background:var(--surface-3);overflow:hidden;margin-top:8px}
        .mini-bar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg, var(--primary), #6a3df2)}
        .trust-callout{display:flex;gap:12px;padding:12px 14px;border-radius:12px;background:linear-gradient(135deg, rgba(86,121,242,.08), rgba(0,214,245,.06));border:1px solid rgba(86,121,242,.14);color:var(--text-soft);font-size:11px;line-height:1.7}
        .subs-toolbar{display:flex;gap:8px;align-items:center}
        .subs-toolbar input,.subs-toolbar select{height:38px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);padding:0 12px;font-size:12px}
        .subs-toolbar input{width:260px}
        @media(max-width:700px){.subs-toolbar input{width:100%}}
        .status-dot{width:7px;height:7px;border-radius:50%;display:inline-block;margin-inline-end:6px}
        .plan-pill{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.02em;border:1px solid var(--line);background:var(--surface-2)}
        .plan-pill--family{color:#0a5766;background:rgba(0,214,245,.09);border-color:rgba(0,214,245,.18)}
        .plan-pill--family_plus{color:#7a5600;background:rgba(255,211,77,.12);border-color:rgba(255,211,77,.22)}
        .plan-pill--free{color:var(--muted)}
      `}</style>

      <section className="billing-hero">
        <div style={{ display:'flex', justifyContent:'space-between', gap:16, flexWrap:'wrap' }}>
          <div>
            <span className="billing-eyebrow"><Icon name="subscriptions" size={14}/> {text.eyebrow}</span>
            <h2 className="billing-title">{text.title}</h2>
            <p className="billing-lede">{text.lede}</p>
          </div>
          <div style={{ display:'flex', alignItems:'start', gap:8 }}>
            <button className="button button--secondary" onClick={() => void load()}><Icon name="refresh" size={16}/>{text.refresh}</button>
            <Link className="button button--ghost" to={adminPath('customers')}><Icon name="sparkles" size={14}/> Customer 360</Link>
          </div>
        </div>
      </section>

      <div className="kpi-grid">
        <div className="kpi-card kpi-card--active"><div className="kpi-card__top"><span>{text.metrics.active}</span><span className="kpi-card__icon"><Icon name="check" size={14}/></span></div><strong className="kpi-card__value">{metrics.active}</strong><span className="kpi-card__desc">{text.metrics.descActive}</span></div>
        <div className="kpi-card kpi-card--grace"><div className="kpi-card__top"><span>{text.metrics.grace}</span><span className="kpi-card__icon"><Icon name="clock" size={14}/></span></div><strong className="kpi-card__value">{metrics.grace}</strong><span className="kpi-card__desc">{text.metrics.descGrace}</span></div>
        <div className="kpi-card kpi-card--expired"><div className="kpi-card__top"><span>{text.metrics.expired}</span><span className="kpi-card__icon"><Icon name="archive" size={14}/></span></div><strong className="kpi-card__value">{metrics.expired}</strong><span className="kpi-card__desc">{text.metrics.descExpired}</span></div>
        <Link to={adminPath('billing?tab=mismatches')} className="kpi-card kpi-card--mismatch" style={{ textDecoration:'none' }}><div className="kpi-card__top"><span>{text.metrics.mismatch}</span><span className="kpi-card__icon"><Icon name="warning" size={14}/></span></div><strong className="kpi-card__value" style={{ color: metrics.mismatches ? '#b45309' : undefined }}>{metrics.mismatches}</strong><span className="kpi-card__desc">{text.metrics.descMismatch}</span></Link>
        <div className="kpi-card kpi-card--refunded"><div className="kpi-card__top"><span>{text.metrics.refunded}</span><span className="kpi-card__icon"><Icon name="trash" size={14}/></span></div><strong className="kpi-card__value">{metrics.refunded}</strong><span className="kpi-card__desc">{text.metrics.descRefunded}</span></div>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
        <div className="seg" role="tablist">
          {(['overview','subscriptions','transactions','mismatches','refunds'] as const).map(t => (
            <button key={t} role="tab" aria-selected={activeTab===t} onClick={()=> setTab(t)}>{text.tabs[t] ?? t}</button>
          ))}
        </div>
        <span className="billing-panel__note">{text.kpis} · {subs.length} row{subs.length!==1?'s':''}</span>
      </div>

      {loading ? <LoadingState/> : error ? <ErrorState message={error} onRetry={()=>void load()} /> : (
        <>
          {activeTab==='overview' && stats && (
            <div style={{ display:'grid', gridTemplateColumns:'1.2fr .8fr', gap:14 }}>
              <div className="billing-panel">
                <div className="billing-panel__head"><h3>{text.overview.byPlan}</h3><span className="billing-panel__note">{text.overview.byPlan} · live</span></div>
                <div style={{ padding:16, display:'grid', gap:14 }}>
                  {(stats.by_plan??[]).map((r:any)=>{
                    const count = Number(r.count)||0
                    const pct = byPlanMax ? (count/byPlanMax)*100 : 0
                    return <div key={r.plan}><div style={{ display:'flex', justifyContent:'space-between', gap:8 }}><span className={`plan-pill plan-pill--${r.plan}`}>{r.plan}</span><strong style={{ fontSize:12 }}>{count}</strong></div><div className="mini-bar"><span style={{ width:`${pct}%` }}/></div></div>
                  })}
                  <div className="trust-callout"><span style={{ width:28, height:28, display:'grid', placeItems:'center', borderRadius:8, background:'rgba(86,121,242,.12)', color:'var(--primary)' }}><Icon name="sparkles" size={16}/></span><div><strong style={{ display:'block', fontSize:11, marginBottom:2 }}>{text.overview.trust}</strong>{text.overview.trustDesc}</div></div>
                </div>
              </div>
              <div className="billing-panel">
                <div className="billing-panel__head"><h3>{text.overview.recent}</h3><Link className="text-link" to={adminPath('billing?tab=subscriptions')}>View all →</Link></div>
                <div style={{ padding:0 }}>
                  <div style={{ display:'grid' }}>
                    {(stats.recent_purchases??[]).slice(0,6).map((p:any,i:number)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', borderBottom:'1px solid var(--line)', gap:10 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ width:34, height:34, borderRadius:10, display:'grid', placeItems:'center', background:'var(--surface-2)', border:'1px solid var(--line)', fontSize:11, fontWeight:800 }}>{String(p.parent_id).slice(0,2).toUpperCase()}</span>
                          <div><strong style={{ fontSize:11, display:'block' }} dir="ltr">{String(p.parent_id).slice(0,10)}…</strong><small style={{ color:'var(--muted)', fontSize:10 }}>{p.provider ?? 'google_play'}</small></div>
                        </div>
                        <div style={{ textAlign:'end' }}>
                          <span className={`account-status ${p.provider_state==='active'?'account-status--active':'account-status--archived'}`} style={{ fontSize:10 }}>{p.provider_state}</span>
                          <small style={{ display:'block', marginTop:4, color:'var(--muted)', fontSize:10 }}>{p.entitlement_status}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeTab==='subscriptions' || activeTab==='overview') && (
            <section className="billing-panel">
              <div className="billing-panel__head">
                <h3>{text.tabs.subscriptions} <span className="title-count" style={{ marginInlineStart:8 }}>{subs.length}</span></h3>
                <div className="subs-toolbar">
                  {/* التنسيق على غلافٍ لا على `Icon`: المكوّن لا يقبل `style`،
                      فكان يُلقى صامتًا وتبقى الأيقونة في مسار المحتوى بينما
                      للمُدخَل حاشية 30px — فراغٌ ثم أيقونة في غير موضعها.
                      و`insetInlineStart` لا `left`: اللوحة عربية أوّلًا. */}
                  <div style={{ position:'relative' }}><span style={{ position:'absolute', insetInlineStart:10, top:'50%', transform:'translateY(-50%)', color:'var(--muted)', display:'inline-flex', pointerEvents:'none' }}><Icon name="search" size={14}/></span><input value={query} onChange={e=> setQuery(e.target.value)} placeholder={text.search} style={{ paddingInlineStart:30 }}/></div>
                  <select value={filterPlan} onChange={e=> setFilterPlan(e.target.value)}><option value="">{text.table.plan}</option><option value="family">family</option><option value="family_plus">family_plus</option><option value="free">free</option></select>
                </div>
              </div>
              {subs.length ? (
                <div className="table-scroll" tabIndex={0}><table className="data-table data-table--wide"><thead><tr>
                  <th>{text.table.family}</th><th>{text.table.plan}</th><th>{text.table.provider}</th><th>{text.table.providerState}</th><th>{text.table.entitlement}</th><th>{text.table.renewal}</th><th>{text.table.alert}</th><th></th>
                </tr></thead><tbody>
                  {subs.map((r:any)=>(
                    <tr key={r.id}>
                      <td><Link to={adminPath(`customers/${r.parent_id}`)} style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:10 }}><span style={{ width:32, height:32, borderRadius:9, background:'var(--surface-2)', border:'1px solid var(--line)', display:'grid', placeItems:'center', fontSize:10, fontWeight:800 }}>{String(r.parent_id).slice(0,2).toUpperCase()}</span><span><strong style={{ display:'block', fontSize:11 }} dir="ltr">{String(r.parent_id).slice(0,12)}</strong><small style={{ color:'var(--muted)', fontSize:10 }}>{r.family_name ?? ''}</small></span></Link></td>
                      <td><span className={`plan-pill plan-pill--${r.plan}`}>{r.plan}</span></td>
                      <td style={{ fontSize:11 }}>{r.provider}</td>
                      <td><span className={`status-badge ${r.provider_state==='active'?'status-badge--published':'status-badge--archived'}`}><span className="status-dot" style={{ background: r.provider_state==='active'?'var(--success)':'var(--muted)' }}/>{r.provider_state}</span></td>
                      <td><span className={`status-badge ${r.entitlement_status==='active'?'status-badge--published':'status-badge--archived'}`}>{r.entitlement_status}</span></td>
                      <td style={{ fontSize:11 }}>{formatMs(r.expires_at_ms, locale as any)}</td>
                      <td>{r.has_mismatch ? <span className="status-badge status-badge--review">Mismatch</span> : <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>}</td>
                      <td><Link className="button button--ghost button--small" to={adminPath(`billing/subscription/${r.id}`)}>{text.table.open}</Link></td>
                    </tr>
                  ))}
                </tbody></table></div>
              ) : <div style={{ padding:28 }}><EmptyState title={text.empty.subs} description={text.empty.subsHint} /></div>}
            </section>
          )}

          {activeTab==='transactions' && (
            <section className="billing-panel"><div style={{ padding:18 }}><div style={{ display:'flex', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:12 }}><h3 style={{ fontSize:13 }}>{text.tabs.transactions}</h3><span className="billing-panel__note">Each row → Transaction Workspace (provider payload, billing_audit)</span></div>
              <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>ID</th><th>{text.table.family}</th><th>Product</th><th>Verified</th><th></th></tr></thead><tbody>
                {(subs.length ? subs : [{id:'—', parent_id:'—', product_id:'—', verified_at_ms:0}]).slice(0,12).map((r:any)=>(
                  <tr key={r.id}><td dir="ltr" style={{ fontSize:11 }}>{r.id.slice(0,8)}</td><td dir="ltr" style={{ fontSize:11 }}>{r.parent_id.slice(0,8)}</td><td dir="ltr" style={{ fontSize:11 }}>{r.product_id}</td><td style={{ fontSize:11 }}>{formatMs(r.verified_at_ms, locale as any)}</td><td><Link className="button button--ghost button--small" to={adminPath(`billing/transaction/${r.id}`)}>{text.table.open}</Link></td></tr>
                ))}
              </tbody></table></div>
              {!subs.length && <div style={{ padding:18 }}><EmptyState title={text.empty.tx} description={text.empty.subsHint} /></div>}
            </div></section>
          )}

          {activeTab==='mismatches' && (
            <section className="billing-panel"><div style={{ padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap' }}>
                <div><h3 style={{ fontSize:13 }}>Entitlement mismatches</h3><p className="billing-panel__note" style={{ marginTop:6 }}>Provider ACTIVE vs entitlement EXPIRED = reconciliation task. Silent fallback is banned.</p></div>
                <span className={`status-badge ${mismatches.length?'status-badge--review':'status-badge--published'}`}>{mismatches.length} open</span>
              </div>
              {mismatches.length ? (
                <div style={{ display:'grid', gap:10 }}>
                  {mismatches.map((m:any,i:number)=>(
                    <div key={i} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'12px 14px', borderRadius:12, border:'1px solid var(--line)', background:'var(--surface-2)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ width:32, height:32, borderRadius:9, background:'rgba(217,119,6,.14)', color:'#b45309', display:'grid', placeItems:'center' }}><Icon name="warning" size={14}/></span>
                        <div><strong dir="ltr" style={{ fontSize:11 }}>{String(m.parent_id).slice(0,12)}</strong><div style={{ display:'flex', gap:6, marginTop:4 }}><span className="status-badge status-badge--archived" style={{ fontSize:10 }}>{m.provider_state}</span><span style={{ color:'var(--muted)' }}>→</span><span className="status-badge status-badge--review" style={{ fontSize:10 }}>{m.entitlement_status}</span></div></div>
                      </div>
                      <Link className="button button--primary button--small" to={adminPath(`billing/subscription/${m.parent_id}`)}>Reconcile</Link>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title={text.empty.mis} description={text.empty.misHint} />}
            </div></section>
          )}

          {activeTab==='refunds' && (
            <section className="billing-panel"><div style={{ padding:18 }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:12, marginBottom:14, flexWrap:'wrap' }}>
                <div><h3 style={{ fontSize:13 }}>{text.tabs.refunds}</h3><p className="billing-panel__note" style={{ marginTop:6 }}>Financial refunds with amount, reason, channel, original transaction linkage. Separate from entitlement revoked.</p></div>
                <span className="status-badge status-badge--archived">{refunds.length} refunds · {metrics.refunded} revoked entitlements</span>
              </div>
              {refunds.length ? (
                <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>ID</th><th>{text.table.family}</th><th>Amount</th><th>Reason</th><th>Channel</th><th>Status</th><th>Original Tx</th></tr></thead><tbody>
                  {refunds.map((r:any)=>(
                    <tr key={r.id}><td dir="ltr" style={{ fontSize:10 }} title={r.id}>{r.id.slice(0,12)}…</td><td dir="ltr" style={{ fontSize:11 }}>{String(r.parent_id).slice(0,10)}</td><td style={{ fontSize:11 }} dir="ltr">{r.currency} {(r.amount_minor/100).toFixed(2)}</td><td><span className="track-badge">{r.reason}</span><br/><small style={{ color:'var(--muted)', fontSize:10 }}>{r.reason_details ?? ''}</small></td><td><span className="plan-pill">{r.channel}</span></td><td><span className={`status-badge ${r.status==='completed'?'status-badge--published': r.status==='pending'?'status-badge--review':'status-badge--archived'}`}>{r.status}</span></td><td dir="ltr" style={{ fontSize:10 }}>{r.original_transaction_id?.slice(0,8) ?? '—'}</td></tr>
                  ))}
                </tbody></table></div>
              ) : (
                <>
                  {metrics.refunded ? (
                    <div style={{ display:'grid', gap:12 }}>
                      <div className="inline-alert inline-alert--info">No financial refund records yet, but {metrics.refunded} entitlements are revoked. Create refund record below if financial return needed.</div>
                      <div className="table-scroll" tabIndex={0}><table className="data-table"><thead><tr><th>{text.table.family}</th><th>{text.table.plan}</th><th>{text.table.entitlement}</th><th>Action</th></tr></thead><tbody>
                        {subs.filter((s:any)=> s.entitlement_status==='revoked').slice(0,10).map((r:any)=>(
                          <tr key={r.id}><td dir="ltr" style={{ fontSize:11 }}>{String(r.parent_id).slice(0,12)}</td><td><span className={`plan-pill plan-pill--${r.plan}`}>{r.plan}</span></td><td><span className="status-badge status-badge--archived">{r.entitlement_status}</span></td><td><button className="button button--ghost button--small" onClick={async()=>{ const amount=prompt('Amount minor (e.g. 1999 for 19.99)?'); const currency=prompt('Currency (EGP/USD)?','EGP'); const reason=prompt('Reason (requested_by_customer/duplicate_charge/fraud/service_issue/other)?','requested_by_customer'); if(!amount) return; try{ await api.createRefund({ parent_id: r.parent_id, amount_minor: Number(amount), currency: currency||'EGP', reason: reason||'requested_by_customer', original_transaction_id: r.id } as any); await load(); }catch(e){ alert(e instanceof Error? e.message:'Error') } }}>Create refund</button></td></tr>
                        ))}
                      </tbody></table></div>
                    </div>
                  ) : <EmptyState title={text.empty.refund} description={text.empty.refundHint} />}
                </>
              )}
            </div></section>
          )}
        </>
      )}
    </div>
  )
}
