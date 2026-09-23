import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { ViewSwitcher } from '../components/ViewSwitcher'
import type { ViewMode } from '../components/ViewSwitcher'

const copy = {
  ar: {
    eyebrow: 'التجارة وإدارة الاشتراكات',
    title: 'مركز الفوترة وإدارة الاشتراكات',
    lede: 'مزوّد الدفع يثبت الشراء، و FamilyState يمثل الحقيقة التشغيلية. نكشف الفجوات فوراً ونضمن تطابق الاستحقاق مع الفوترة.',
    refresh: 'تحديث البيانات',
    search: 'ابحث بالعائلة أو الخطة أو المزوّد…',
    metrics: {
      active: 'اشتراكات نشطة',
      grace: 'فترة سماح',
      expired: 'منتهية الصلاحية',
      mismatch: 'تناقضات استحقاق',
      refunded: 'مبالغ مستردة',
      descActive: 'استحقاق فعّال ومؤكد الآن',
      descGrace: 'ستنتهي قريباً بدون تجديد',
      descExpired: 'لا يوجد وصول مدفوع',
      descMismatch: 'المزوّد ≠ الاستحقاق الفعلي',
      descRefunded: 'أُلغي واستُرد مالياً',
    },
    tabs: {
      overview: 'نظرة عامة ومقاييس',
      subscriptions: 'سجل الاشتراكات',
      transactions: 'المعاملات المالية',
      mismatches: 'التناقضات ومطابقة الحقوق',
      refunds: 'المبالغ المستردة',
    },
    table: {
      family: 'العائلة',
      plan: 'الخطة',
      provider: 'المزوّد',
      providerState: 'حالة المزوّد',
      entitlement: 'الاستحقاق الفعلي',
      renewal: 'تاريخ التجديد',
      alert: 'التنبيه',
      open: 'مساحة العمل',
    },
    overview: {
      byPlan: 'توزيع الاشتراكات حسب الخطة',
      recent: 'أحدث عمليات الشراء والتحقق',
      trust: 'نموذج الثقة والمطابقة الثنائية',
      trustDesc: 'Google Play يمثل إثبات الدفع المالي · FamilyState يمثل قرار الوصول التشغيلي. أي فجوة تتطلب مهمة تسوية فورية وموثقة.',
      match: 'متطابق',
      mismatchLabel: 'تناقض',
    },
    empty: {
      subs: 'لا توجد اشتراكات مسجلة',
      subsHint: 'عند إتمام أول عملية شراء ناجحة من التطبيق ستظهر بياناتها هنا.',
      tx: 'لا توجد معاملات مالية معروضة',
      mis: 'لا توجد تناقضات — المزوّد والاستحقاق متطابقان تماماً',
      misHint: 'عند وجود أي فجوة بين المزوّد وقاعدة البيانات ستُدرج هنا فوراً كمهام تسوية.',
      refund: 'لا توجد سجلات استرداد مالي',
      refundHint: 'عمليات الاسترداد المالي الموثقة ستظهر هنا مع ربطها بالمعاملة الأصلية.',
    },
    kpis: 'مؤشرات حيّة',
    cardsView: 'بطاقات الاشتراكات',
    tableView: 'الجدول الشامل',
  },
  en: {
    eyebrow: 'Commerce & Monetization',
    title: 'Subscription & Billing Operations',
    lede: 'Payment provider proves purchase, FamilyState represents operational truth. Exposing gaps, ensuring entitlement reconciliation.',
    refresh: 'Refresh Data',
    search: 'Search family, plan, or provider…',
    metrics: {
      active: 'Active Subs',
      grace: 'Grace Period',
      expired: 'Expired',
      mismatch: 'Mismatches',
      refunded: 'Refunded',
      descActive: 'Active verified entitlement',
      descGrace: 'Expiring soon without renewal',
      descExpired: 'No paid access active',
      descMismatch: 'Provider ≠ Entitlement gap',
      descRefunded: 'Revoked & refunded',
    },
    tabs: {
      overview: 'Overview & Analytics',
      subscriptions: 'Subscriptions',
      transactions: 'Transactions',
      mismatches: 'Mismatches & Reconciliation',
      refunds: 'Refunds',
    },
    table: {
      family: 'Family',
      plan: 'Plan',
      provider: 'Provider',
      providerState: 'Provider State',
      entitlement: 'Effective Entitlement',
      renewal: 'Renewal Date',
      alert: 'Alert',
      open: 'Workspace',
    },
    overview: {
      byPlan: 'Distribution by Plan',
      recent: 'Recent Verified Purchases',
      trust: 'Two-Tier Trust Model',
      trustDesc: 'Google Play represents proof of payment · FamilyState represents real-time access. Any gap triggers audited reconciliation.',
      match: 'MATCH',
      mismatchLabel: 'MISMATCH',
    },
    empty: {
      subs: 'No subscriptions yet',
      subsHint: 'First successful purchase will appear here in real-time.',
      tx: 'No transactions found',
      mis: 'No mismatches — provider and entitlements perfectly aligned',
      misHint: 'Discrepancies will be listed here as audited reconciliation tasks.',
      refund: 'No refund records found',
      refundHint: 'Audited financial refunds will appear here linked to original transactions.',
    },
    kpis: 'Live Indicators',
    cardsView: 'Subscription Cards',
    tableView: 'Detailed Table',
  },
}

function formatMs(v: unknown, locale: 'ar' | 'en') {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return '—'
  return new Date(v).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' })
}

export function BillingPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'ar' ? 'ar' : 'en']
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const [stats, setStats] = useState<any>(null)
  const [subs, setSubs] = useState<any[]>([])
  const [mismatches, setMismatches] = useState<any[]>([])
  const [refunds, setRefunds] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [filterPlan, setFilterPlan] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [selectedSub, setSelectedSub] = useState<any | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  const copyToClipboard = (txt: string) => {
    if (!txt) return
    navigator.clipboard?.writeText(txt)
    setCopiedToken(true)
    setTimeout(() => setCopiedToken(false), 2200)
  }

  const exportCsv = () => {
    if (!subs.length) return
    const headers = ['ID', 'ParentID', 'FamilyName', 'Plan', 'Provider', 'ProviderState', 'Entitlement', 'RenewalDate']
    const rows = subs.map((s: any) => [
      `"${s.id ?? ''}"`,
      `"${s.parent_id ?? ''}"`,
      `"${s.family_name ?? ''}"`,
      `"${s.plan ?? ''}"`,
      `"${s.provider ?? ''}"`,
      `"${s.provider_state ?? ''}"`,
      `"${s.entitlement_status ?? ''}"`,
      `"${s.expires_at_ms ? new Date(s.expires_at_ms).toISOString() : ''}"`,
    ])
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `majarra-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, subRes, recon, refundsRes] = await Promise.all([
        api.billingStats(),
        api.subscriptions({ q: query || undefined, plan: filterPlan || undefined, limit: 50, offset: 0 } as any),
        api.commerceReconciliation().catch(() => ({ data: { mismatches: [] } }) as any),
        api.billingRefunds({ limit: 50 } as any).catch(() => ({ data: [] }) as any),
      ])
      setStats(s.data)
      setSubs((subRes as any).data ?? [])
      setMismatches((recon as any).data?.mismatches ?? [])
      setRefunds((refundsRes as any).data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading billing data')
    } finally {
      setLoading(false)
    }
  }, [query, filterPlan])

  useEffect(() => {
    const t = setTimeout(() => void load(), query ? 220 : 0)
    return () => clearTimeout(t)
  }, [load])

  const setTab = (t: string) => {
    const n = new URLSearchParams(searchParams)
    n.set('tab', t)
    setSearchParams(n)
  }

  const metrics = useMemo(
    () => ({
      active: (stats?.by_plan ?? []).reduce((a: any, c: any) => a + Number(c.count), 0),
      grace: subs.filter((s: any) => s.entitlement_status === 'grace').length,
      expired: subs.filter((s: any) => s.entitlement_status === 'expired').length,
      mismatches: mismatches.length,
      refunded: subs.filter((s: any) => s.entitlement_status === 'revoked').length,
    }),
    [stats, subs, mismatches],
  )

  const totalCount = metrics.active + metrics.grace + metrics.expired || 1
  const activePct = Math.round((metrics.active / totalCount) * 100)
  const gracePct = Math.round((metrics.grace / totalCount) * 100)
  const expiredPct = Math.max(0, 100 - activePct - gracePct)

  const byPlanMax = Math.max(1, ...(stats?.by_plan ?? []).map((r: any) => Number(r.count) || 0))

  const filteredSubs = useMemo(() => {
    return subs.filter((s: any) => {
      if (filterStatus !== 'all' && s.entitlement_status !== filterStatus) return false
      return true
    })
  }, [subs, filterStatus])

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Command & Live Sync Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(99, 102, 241, 0.16) 55%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: metrics.mismatches ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.3)',
                color: metrics.mismatches ? '#f59e0b' : '#10b981',
                background: metrics.mismatches ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: metrics.mismatches ? '#f59e0b' : '#10b981' }}
              />
              {metrics.mismatches ? `تنبيه: ${metrics.mismatches} فجوة تحتاج تسوية` : 'Google Play متطابق 100%'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
        <div className="catalog-hero__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={exportCsv}
            title="تصدير كشف المشتركين CSV"
          >
            <Icon name="download" size={15} />
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => void load()}
          >
            <Icon name="refresh" size={15} />
            <span>{text.refresh}</span>
          </button>
          <Link
            className="button button--ghost"
            to={adminPath('customers')}
          >
            <Icon name="parents" size={15} />
            <span>Customer 360</span>
          </Link>
        </div>
      </section>

      {/* 2. Executive Financial Bento Matrix */}
      <div className="hero-kpis" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {/* Bento 1: Active Entitlements & Plan Velocity */}
        <div
          className="kpi-glass-card"
          onClick={() => setTab('subscriptions')}
          style={{ cursor: 'pointer', borderColor: activeTab === 'subscriptions' ? 'var(--primary)' : undefined }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', margin: 0 }}>
              <Icon name="check" size={24} />
            </div>
            <span
              className="catalog-hero__status-badge"
              style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}
            >
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              قراءة حية
            </span>
          </div>
          <div className="kpi-glass-card__info" style={{ marginTop: 12 }}>
            <span className="kpi-glass-card__label">{text.metrics.active}</span>
            <div className="kpi-glass-card__num">{metrics.active}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
              {(stats?.by_plan ?? []).slice(0, 3).map((bp: any) => (
                <span key={bp.plan} className={`plan-badge plan-badge--${bp.plan}`} style={{ fontSize: 10.5, padding: '2px 8px' }}>
                  {bp.plan}: {bp.count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Bento 2: Lifecycle & Retention Health (Segmented Bar) */}
        <div className="kpi-glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', margin: 0 }}>
              <Icon name="clock" size={24} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
              {activePct}% معدل النشاط
            </span>
          </div>
          <div className="kpi-glass-card__info" style={{ marginTop: 12 }}>
            <span className="kpi-glass-card__label">سلامة دورة الاشتراك</span>
            <div className="billing-segmented-bar">
              <div className="billing-segmented-bar__seg billing-segmented-bar__seg--active" style={{ width: `${activePct}%` }} title={`نشط: ${metrics.active}`} />
              <div className="billing-segmented-bar__seg billing-segmented-bar__seg--grace" style={{ width: `${gracePct}%` }} title={`سماح: ${metrics.grace}`} />
              <div className="billing-segmented-bar__seg billing-segmented-bar__seg--expired" style={{ width: `${expiredPct}%` }} title={`منتهي: ${metrics.expired}`} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginTop: 4 }}>
              <span style={{ color: '#10b981' }}>{metrics.active} نشط</span>
              <span style={{ color: '#f59e0b' }}>{metrics.grace} سماح</span>
              <span style={{ color: '#94a3b8' }}>{metrics.expired} منتهي</span>
            </div>
          </div>
        </div>

        {/* Bento 3: Entitlement Reconciliation Radar (Google Play vs FamilyState) */}
        <div
          className="kpi-glass-card"
          onClick={() => setTab('mismatches')}
          style={{
            cursor: 'pointer',
            borderColor: metrics.mismatches ? 'rgba(239, 68, 68, 0.4)' : undefined,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div
              className="kpi-glass-card__icon"
              style={{
                background: metrics.mismatches ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: metrics.mismatches ? '#ef4444' : '#10b981',
                margin: 0,
              }}
            >
              <Icon name={metrics.mismatches ? 'warning' : 'shield'} size={24} />
            </div>
            <span
              style={{
                fontSize: 11,
                padding: '3px 10px',
                borderRadius: 999,
                fontWeight: 800,
                background: metrics.mismatches ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                color: metrics.mismatches ? '#ef4444' : '#10b981',
              }}
            >
              {metrics.mismatches ? 'فجوة تتطلب حل' : 'تطابق 100%'}
            </span>
          </div>
          <div className="kpi-glass-card__info" style={{ marginTop: 12 }}>
            <span className="kpi-glass-card__label">{text.metrics.mismatch}</span>
            <div className="kpi-glass-card__num" style={{ color: metrics.mismatches ? '#ef4444' : undefined }}>
              {metrics.mismatches}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: metrics.mismatches ? '#ef4444' : '#10b981' }}>
              {metrics.mismatches ? 'تفاوت بين المزوّد والوصول الفعلي' : 'Google Play متطابق مع قاعدة البيانات'}
            </span>
          </div>
        </div>

        {/* Bento 4: Financial Refunds & Revocations */}
        <div
          className="kpi-glass-card"
          onClick={() => setTab('refunds')}
          style={{ cursor: 'pointer', borderColor: activeTab === 'refunds' ? 'var(--primary)' : undefined }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
            <div className="kpi-glass-card__icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', margin: 0 }}>
              <Icon name="trash" size={24} />
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>
              {refunds.length} حركة مسجلة
            </span>
          </div>
          <div className="kpi-glass-card__info" style={{ marginTop: 12 }}>
            <span className="kpi-glass-card__label">{text.metrics.refunded}</span>
            <div className="kpi-glass-card__num">{metrics.refunded}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f87171' }}>
              {text.metrics.descRefunded}
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 Conditional Triage Attention Banner */}
      {metrics.mismatches > 0 && (
        <div className="billing-triage-banner">
          <div className="billing-triage-banner__content">
            <div className="billing-triage-banner__icon">
              <Icon name="warning" size={24} />
            </div>
            <div className="billing-triage-banner__text">
              <h4>رصد تفاوت في الاستحقاق: يوجد {metrics.mismatches} اشتراك يتطلب تسوية فورية</h4>
              <p>حالة الشراء في Google Play لا تطابق الاستحقاق الفعلي المسجل في FamilyState. يرجى مراجعة التناقضات وتسويتها لضمان استمرار وصول الأطفال لحساباتهم.</p>
            </div>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={() => setTab('mismatches')}
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <Icon name="sparkles" size={15} />
            <span>فحص وحل التناقضات الآن</span>
          </button>
        </div>
      )}

      {/* 3. Studio Tab Control Strip */}
      <div className="catalog-control-strip">
        <div className="catalog-control-strip__filter-pills">
          {(['overview', 'subscriptions', 'transactions', 'mismatches', 'refunds'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`filter-pill ${activeTab === t ? 'filter-pill--active' : ''}`}
              onClick={() => setTab(t)}
            >
              <span>{text.tabs[t] ?? t}</span>
              {t === 'mismatches' && metrics.mismatches > 0 && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#ef4444',
                    marginInlineStart: 6,
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {activeTab === 'subscriptions' && (
          <div className="catalog-control-strip__right">
            <ViewSwitcher
              modes={['cards', 'table']}
              current={viewMode}
              onChange={setViewMode}
              labels={{ cards: text.cardsView, table: text.tableView }}
            />
          </div>
        )}
      </div>

      {/* 4. Tab Contents */}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && stats && (
            <div className="page-stack" style={{ gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
                {/* Plans distribution card */}
                <section className="catalog-filter-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{text.overview.byPlan}</h3>
                    <span className="catalog-hero__status-badge">
                      <span className="status-dot-pulse" style={{ background: '#10b981' }} />
                      قراءة حية
                    </span>
                  </div>

                  <div style={{ display: 'grid', gap: 14 }}>
                    {(stats.by_plan ?? []).map((r: any) => {
                      const count = Number(r.count) || 0
                      const pct = byPlanMax ? (count / byPlanMax) * 100 : 0
                      return (
                        <div key={r.plan} style={{ display: 'grid', gap: 6 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span className={`plan-badge plan-badge--${r.plan}`}>{r.plan}</span>
                            <span style={{ fontSize: 13, fontWeight: 800 }}>{count} مشترك</span>
                          </div>
                          <div
                            style={{
                              height: 8,
                              borderRadius: 999,
                              background: 'var(--cs-glass-border)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                borderRadius: 'inherit',
                                background: 'linear-gradient(90deg, #10b981, #0ea5e9)',
                                transition: 'width 0.4s ease',
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}

                    <div
                      style={{
                        marginTop: 12,
                        padding: 14,
                        borderRadius: 12,
                        background: 'rgba(14, 165, 233, 0.08)',
                        border: '1px solid rgba(14, 165, 233, 0.2)',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <span style={{ color: '#0ea5e9', marginTop: 2 }}>
                        <Icon name="sparkles" size={18} />
                      </span>
                      <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                        <strong style={{ display: 'block', color: 'var(--text)', marginBottom: 2 }}>
                          {text.overview.trust}
                        </strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{text.overview.trustDesc}</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Recent Purchases */}
                <section className="catalog-filter-card" style={{ padding: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{text.overview.recent}</h3>
                    <button
                      type="button"
                      className="button button--ghost button--small"
                      onClick={() => setTab('subscriptions')}
                    >
                      <span>عرض الكل</span>
                      <Icon name="arrow" size={12} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {(stats.recent_purchases ?? []).slice(0, 5).map((p: any, i: number) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: 'var(--cs-glass-surface)',
                          border: '1px solid var(--cs-glass-border)',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 10,
                              background: 'rgba(99, 102, 241, 0.15)',
                              color: '#818cf8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {String(p.parent_id).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <strong style={{ fontSize: 13, display: 'block' }} dir="ltr">
                              {String(p.parent_id).slice(0, 14)}…
                            </strong>
                            <small style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                              {p.provider ?? 'Google Play'}
                            </small>
                          </div>
                        </div>

                        <div style={{ textAlign: 'end' }}>
                          <span
                            className={`account-status account-status--${
                              p.provider_state === 'active' ? 'active' : 'archived'
                            }`}
                          >
                            {p.provider_state}
                          </span>
                          <small style={{ display: 'block', marginTop: 4, color: 'var(--text-secondary)', fontSize: 10.5 }}>
                            {p.entitlement_status}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          )}

          {/* TAB 2: SUBSCRIPTIONS */}
          {activeTab === 'subscriptions' && (
            <div className="page-stack" style={{ gap: 16 }}>
              {/* Filter Bar */}
              <section className="catalog-filter-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 260, position: 'relative' }}>
                    <span
                      style={{
                        position: 'absolute',
                        insetInlineStart: 12,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--muted)',
                        pointerEvents: 'none',
                        display: 'flex',
                      }}
                    >
                      <Icon name="search" size={14} />
                    </span>
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={text.search}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        paddingInlineStart: 36,
                        borderRadius: 10,
                        background: 'var(--cs-glass-surface)',
                        border: '1px solid var(--cs-glass-border)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={filterPlan}
                      onChange={(e) => setFilterPlan(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'var(--cs-glass-surface)',
                        border: '1px solid var(--cs-glass-border)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    >
                      <option value="">كل الخطط</option>
                      <option value="family">خطة العائلة (Family)</option>
                      <option value="family_plus">العائلة بلس (Family Plus)</option>
                      <option value="free">المجانية (Free)</option>
                    </select>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        background: 'var(--cs-glass-surface)',
                        border: '1px solid var(--cs-glass-border)',
                        color: 'var(--text)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    >
                      <option value="all">كل الحالات</option>
                      <option value="active">استحقاق نشط (Active)</option>
                      <option value="grace">فترة سماح (Grace)</option>
                      <option value="expired">منتهي (Expired)</option>
                      <option value="revoked">مسترد / ملغى (Revoked)</option>
                    </select>

                    <span className="badge-count">{filteredSubs.length} مشترك</span>
                  </div>
                </div>
              </section>

              {filteredSubs.length === 0 ? (
                <EmptyState title={text.empty.subs} description={text.empty.subsHint} />
              ) : viewMode === 'cards' ? (
                <div className="commerce-studio-grid">
                  {filteredSubs.map((r: any) => (
                    <article key={r.id} className="commerce-card-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 12,
                              background: 'rgba(16, 185, 129, 0.15)',
                              color: '#10b981',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 13,
                              fontWeight: 800,
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                            }}
                          >
                            {String(r.parent_id).slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <Link
                              to={adminPath(`customers/${r.parent_id}`)}
                              style={{
                                color: 'var(--text)',
                                fontWeight: 800,
                                fontSize: 13,
                                textDecoration: 'none',
                                display: 'block',
                              }}
                              dir="ltr"
                            >
                              {String(r.parent_id).slice(0, 16)}
                            </Link>
                            <small style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                              {r.family_name || r.provider}
                            </small>
                          </div>
                        </div>

                        <span className={`plan-badge plan-badge--${r.plan}`}>{r.plan}</span>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          padding: 10,
                          borderRadius: 10,
                          background: 'rgba(0, 0, 0, 0.03)',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'block' }}>
                            {text.table.providerState}
                          </span>
                          <span
                            className={`account-status account-status--${
                              r.provider_state === 'active' ? 'active' : 'archived'
                            }`}
                            style={{ fontSize: 11 }}
                          >
                            {r.provider_state}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', display: 'block' }}>
                            {text.table.entitlement}
                          </span>
                          <span
                            className={`account-status account-status--${
                              r.entitlement_status === 'active' ? 'active' : 'archived'
                            }`}
                            style={{ fontSize: 11 }}
                          >
                            {r.entitlement_status}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          تاريخ التجديد: <strong style={{ color: 'var(--text)' }}>{formatMs(r.expires_at_ms, locale as any)}</strong>
                        </span>
                        {r.has_mismatch && (
                          <span className="track-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                            تناقض
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--cs-glass-border)' }}>
                        <button
                          type="button"
                          className="button button--secondary button--small"
                          onClick={() => setSelectedSub(r)}
                          style={{ flex: 1, justifyContent: 'center' }}
                        >
                          <Icon name="search" size={13} />
                          <span>فحص سريع</span>
                        </button>
                        <Link
                          className="button button--ghost button--small"
                          to={adminPath(`billing/subscription/${r.id}`)}
                          title={text.table.open}
                        >
                          <Icon name="sparkles" size={13} />
                        </Link>
                        <Link
                          className="button button--ghost button--small"
                          to={adminPath(`customers/${r.parent_id}`)}
                          title="ملف العائلة 360"
                        >
                          <Icon name="parents" size={13} />
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <section className="catalog-filter-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div className="table-scroll" tabIndex={0}>
                    <table className="data-table data-table--wide">
                      <thead>
                        <tr>
                          <th>{text.table.family}</th>
                          <th>{text.table.plan}</th>
                          <th>{text.table.provider}</th>
                          <th>{text.table.providerState}</th>
                          <th>{text.table.entitlement}</th>
                          <th>{text.table.renewal}</th>
                          <th>{text.table.alert}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSubs.map((r: any) => (
                          <tr key={r.id}>
                            <td>
                              <Link
                                to={adminPath(`customers/${r.parent_id}`)}
                                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}
                              >
                                <span
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: 9,
                                    background: 'var(--surface-2)',
                                    border: '1px solid var(--line)',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  {String(r.parent_id).slice(0, 2).toUpperCase()}
                                </span>
                                <span>
                                  <strong style={{ display: 'block', fontSize: 11 }} dir="ltr">
                                    {String(r.parent_id).slice(0, 12)}
                                  </strong>
                                  <small style={{ color: 'var(--muted)', fontSize: 10 }}>{r.family_name ?? ''}</small>
                                </span>
                              </Link>
                            </td>
                            <td>
                              <span className={`plan-badge plan-badge--${r.plan}`}>{r.plan}</span>
                            </td>
                            <td style={{ fontSize: 11 }}>{r.provider}</td>
                            <td>
                              <span
                                className={`account-status account-status--${
                                  r.provider_state === 'active' ? 'active' : 'archived'
                                }`}
                              >
                                {r.provider_state}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`account-status account-status--${
                                  r.entitlement_status === 'active' ? 'active' : 'archived'
                                }`}
                              >
                                {r.entitlement_status}
                              </span>
                            </td>
                            <td style={{ fontSize: 11 }}>{formatMs(r.expires_at_ms, locale as any)}</td>
                            <td>
                              {r.has_mismatch ? (
                                <span className="track-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
                                  Mismatch
                                </span>
                              ) : (
                                <span style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'end', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                className="button button--secondary button--small"
                                onClick={() => setSelectedSub(r)}
                                style={{ marginInlineEnd: 6 }}
                                title="فحص سريع للتوكن والبيانات"
                              >
                                <Icon name="search" size={13} />
                                <span>فحص</span>
                              </button>
                              <Link
                                className="button button--ghost button--small"
                                to={adminPath(`billing/subscription/${r.id}`)}
                              >
                                {text.table.open}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* TAB 3: TRANSACTIONS */}
          {activeTab === 'transactions' && (
            <section className="catalog-filter-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{text.tabs.transactions}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    سجل المعاملات والتوكنات الموثقة مباشرة من مزودي الدفع ومسار التدقيق.
                  </p>
                </div>
                <span className="catalog-hero__status-badge">
                  <span className="status-dot-pulse" style={{ background: '#0ea5e9' }} />
                  Billing Audit Log
                </span>
              </div>

              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>معرف المعاملة</th>
                      <th>{text.table.family}</th>
                      <th>المنتج</th>
                      <th>تاريخ التحقق</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {(subs.length ? subs : [{ id: '—', parent_id: '—', product_id: '—', verified_at_ms: 0 }])
                      .slice(0, 15)
                      .map((r: any) => (
                        <tr key={r.id}>
                          <td dir="ltr" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                            {r.id.slice(0, 12)}
                          </td>
                          <td dir="ltr" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                            {r.parent_id.slice(0, 12)}
                          </td>
                          <td dir="ltr" style={{ fontSize: 12 }}>
                            {r.product_id}
                          </td>
                          <td style={{ fontSize: 12 }}>{formatMs(r.verified_at_ms, locale as any)}</td>
                          <td>
                            <Link
                              className="button button--ghost button--small"
                              to={adminPath(`billing/transaction/${r.id}`)}
                            >
                              {text.table.open}
                            </Link>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* TAB 4: MISMATCHES */}
          {activeTab === 'mismatches' && (
            <section className="catalog-filter-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>تناقضات وفجوات الاستحقاق</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    حالة المزوّد نشطة ومسجلة في Google Play مقابل استحقاق غير مفعل في FamilyState — تتطلب مصالحة فورية.
                  </p>
                </div>
                <span className="badge-count" style={{ background: mismatches.length ? '#ef4444' : '#10b981', color: '#fff' }}>
                  {mismatches.length} مفتوحة
                </span>
              </div>

              {mismatches.length ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {mismatches.map((m: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: 16,
                        borderRadius: 14,
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'rgba(239, 68, 68, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Icon name="warning" size={18} />
                        </span>
                        <div>
                          <strong dir="ltr" style={{ fontSize: 13, display: 'block' }}>
                            {String(m.parent_id).slice(0, 16)}
                          </strong>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                            <span className="account-status account-status--archived">
                              المزود: {m.provider_state}
                            </span>
                            <span style={{ color: 'var(--muted)' }}>←</span>
                            <span className="account-status account-status--active" style={{ background: '#ef4444' }}>
                              الاستحقاق: {m.entitlement_status}
                            </span>
                          </div>
                        </div>
                      </div>

                      <Link
                        className="button button--primary button--small"
                        to={adminPath(`billing/subscription/${m.parent_id}`)}
                      >
                        إجراء التسوية
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title={text.empty.mis} description={text.empty.misHint} />
              )}
            </section>
          )}

          {/* TAB 5: REFUNDS */}
          {activeTab === 'refunds' && (
            <section className="catalog-filter-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{text.tabs.refunds}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    سجل المبالغ المستردة مالياً مع القناة والسبب وربط المعاملة الأصلية.
                  </p>
                </div>
                <span className="badge-count">
                  {refunds.length} استرداد مالي · {metrics.refunded} استحقاق مسحوب
                </span>
              </div>

              {refunds.length ? (
                <div className="table-scroll" tabIndex={0}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>المعرف</th>
                        <th>{text.table.family}</th>
                        <th>المبلغ</th>
                        <th>السبب</th>
                        <th>القناة</th>
                        <th>الحالة</th>
                        <th>المعاملة الأصلية</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refunds.map((r: any) => (
                        <tr key={r.id}>
                          <td dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace' }} title={r.id}>
                            {r.id.slice(0, 12)}…
                          </td>
                          <td dir="ltr" style={{ fontSize: 12 }}>
                            {String(r.parent_id).slice(0, 12)}
                          </td>
                          <td style={{ fontSize: 12 }} dir="ltr">
                            {r.currency} {(r.amount_minor / 100).toFixed(2)}
                          </td>
                          <td>
                            <span className="track-badge">{r.reason}</span>
                            {r.reason_details && (
                              <small style={{ color: 'var(--text-secondary)', display: 'block', fontSize: 10 }}>
                                {r.reason_details}
                              </small>
                            )}
                          </td>
                          <td>
                            <span className="plan-badge">{r.channel}</span>
                          </td>
                          <td>
                            <span
                              className={`account-status account-status--${
                                r.status === 'completed' ? 'active' : 'archived'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td dir="ltr" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                            {r.original_transaction_id?.slice(0, 10) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <>
                  {metrics.refunded ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 12,
                          background: 'rgba(14, 165, 233, 0.08)',
                          border: '1px solid rgba(14, 165, 233, 0.2)',
                          color: 'var(--text)',
                          fontSize: 13,
                        }}
                      >
                        يوجد {metrics.refunded} اشتراك بحالة استحقاق ملغاة (Revoked). يمكنك إنشاء سجل مالي رسمي عند الحاجة أدناه.
                      </div>
                      <div className="table-scroll" tabIndex={0}>
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>{text.table.family}</th>
                              <th>{text.table.plan}</th>
                              <th>{text.table.entitlement}</th>
                              <th>الإجراء</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subs
                              .filter((s: any) => s.entitlement_status === 'revoked')
                              .slice(0, 10)
                              .map((r: any) => (
                                <tr key={r.id}>
                                  <td dir="ltr" style={{ fontSize: 12, fontFamily: 'monospace' }}>
                                    {String(r.parent_id).slice(0, 16)}
                                  </td>
                                  <td>
                                    <span className={`plan-badge plan-badge--${r.plan}`}>{r.plan}</span>
                                  </td>
                                  <td>
                                    <span className="account-status account-status--archived">
                                      {r.entitlement_status}
                                    </span>
                                  </td>
                                  <td>
                                    <button
                                      className="button button--ghost button--small"
                                      onClick={async () => {
                                        const amount = prompt('المبلغ بالقروش أو السنتات (مثال 1999 لـ 19.99)?')
                                        const currency = prompt('العملة (EGP/USD)?', 'EGP')
                                        const reason = prompt(
                                          'السبب (requested_by_customer/duplicate_charge/fraud/service_issue/other)?',
                                          'requested_by_customer',
                                        )
                                        if (!amount) return
                                        try {
                                          await api.createRefund({
                                            parent_id: r.parent_id,
                                            amount_minor: Number(amount),
                                            currency: currency || 'EGP',
                                            reason: reason || 'requested_by_customer',
                                            original_transaction_id: r.id,
                                          } as any)
                                          await load()
                                        } catch (e) {
                                          alert(e instanceof Error ? e.message : 'Error')
                                        }
                                      }}
                                    >
                                      إنشاء استرداد مالي
                                    </button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <EmptyState title={text.empty.refund} description={text.empty.refundHint} />
                  )}
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* 5. Slide-Over Inspection Drawer (Master-Detail) */}
      {selectedSub && (
        <>
          <div
            className="subscription-drawer-overlay"
            onClick={() => setSelectedSub(null)}
          />
          <aside className="subscription-drawer" aria-label="تفاصيل فحص الاشتراك">
            <div className="subscription-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#6366f1',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 900,
                    fontSize: 16,
                  }}
                >
                  {String(selectedSub.parent_id).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--text)' }}>
                    {selectedSub.family_name || 'اشتراك عائلة'}
                  </h3>
                  <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                    معرّف الاشتراك: {selectedSub.id}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSelectedSub(null)}
                aria-label="إغلاق"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="subscription-drawer__body">
              {/* Status Chips Row */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`plan-badge plan-badge--${selectedSub.plan}`}>
                  الخطة: {selectedSub.plan}
                </span>
                <span
                  className={`account-status account-status--${
                    selectedSub.entitlement_status === 'active' ? 'active' : 'archived'
                  }`}
                >
                  الاستحقاق: {selectedSub.entitlement_status}
                </span>
                <span
                  className={`account-status account-status--${
                    selectedSub.provider_state === 'active' ? 'active' : 'archived'
                  }`}
                >
                  حالة المزوّد: {selectedSub.provider_state}
                </span>
                {selectedSub.has_mismatch && (
                  <span className="track-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
                    ⚠️ تناقض استحقاق
                  </span>
                )}
              </div>

              {/* Family Identity Box */}
              <div className="catalog-filter-card" style={{ padding: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  معرّف حساب العائلة (Parent ID)
                </span>
                <div className="token-copy-box" style={{ marginTop: 8 }}>
                  <code style={{ direction: 'ltr' }}>{selectedSub.parent_id}</code>
                  <button
                    type="button"
                    className="button button--ghost button--small"
                    onClick={() => copyToClipboard(selectedSub.parent_id)}
                    style={{ minHeight: 28, padding: '0 8px' }}
                  >
                    <Icon name={copiedToken ? 'check' : 'copy'} size={13} />
                    <span>{copiedToken ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>
              </div>

              {/* Payment Proof & Token Box */}
              <div className="catalog-filter-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
                    بيانات إثبات الدفع والمزوّد
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>
                    {selectedSub.provider || 'Google Play'}
                  </span>
                </div>

                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  <div>
                    <small style={{ color: 'var(--muted)', fontSize: 11, display: 'block', marginBottom: 4 }}>
                      رمز الشراء المالي (Purchase Token)
                    </small>
                    <div className="token-copy-box">
                      <code style={{ direction: 'ltr', wordBreak: 'break-all', fontSize: 11 }}>
                        {selectedSub.purchase_token || selectedSub.id || 'N/A'}
                      </code>
                      <button
                        type="button"
                        className="button button--ghost button--small"
                        onClick={() => copyToClipboard(selectedSub.purchase_token || selectedSub.id)}
                        style={{ minHeight: 28, padding: '0 8px' }}
                      >
                        <Icon name="copy" size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Entitlement Timeline */}
              <div className="catalog-filter-card" style={{ padding: 18 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  الخط الزمني وصلاحية الوصول
                </span>
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>تاريخ التجديد القادم:</span>
                    <strong style={{ color: 'var(--text)', fontSize: 13 }}>
                      {formatMs(selectedSub.expires_at_ms, locale as any)}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>نموذج المطابقة:</span>
                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: 12 }}>
                      Two-Tier Trust Model
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="subscription-drawer__footer">
              <Link
                className="button button--primary"
                to={adminPath(`billing/subscription/${selectedSub.id}`)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Icon name="sparkles" size={15} />
                <span>مساحة العمل الكاملة</span>
              </Link>
              <Link
                className="button button--secondary"
                to={adminPath(`customers/${selectedSub.parent_id}`)}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Icon name="parents" size={15} />
                <span>ملف العائلة 360</span>
              </Link>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

