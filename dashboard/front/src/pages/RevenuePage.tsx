import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'

const copy = {
  ar: {
    eyebrow: 'المالية التنفيذية والتحصيل',
    title: 'لوحة الإيرادات والتحويل المالي المعتمد',
    lede: 'إيرادات محققة من معاملات تدقيق موثقة فقط (billing_audit) — بدون حسابات صافية وهمية أو افتراضات غير مدققة.',
    rangeToday: 'اليوم',
    range7: '٧ أيام',
    range30: '٣٠ يوم',
    rangeQuarter: 'ربع سنوي',
    rangeYear: 'سنة كاملة',
    gross: 'إجمالي الإيرادات المسجلة',
    net: 'صافي الإيراد المحتفظ به',
    mrr: 'الإيراد الشهري المتكرر (MRR)',
    arr: 'معدل التشغيل السنوي (ARR)',
    activePaid: 'مشتركون مدفوعون نشطون',
    newPaid: 'مشتركون جدد مكتسبون',
    renewals: 'تجديدات ناجحة',
    refunds: 'المبالغ المستردة',
    trialConversion: 'معدل تحويل التجارب',
    churn: 'معدل الإلغاء',
    arpu: 'متوسط إيراد المستخدم (ARPU)',
    byPlan: 'توزيع المشتركين حسب الخطة',
    byCountry: 'حسب الدولة',
    byProvider: 'حسب بوابة الدفع',
    byCurrency: 'حسب العملة',
    grossHint: 'الإجمالي غير متاح — مبلغ الشراء غير مخزن بدون نموذج تسعير',
    netHint: 'الصافي يتطلب حصة متجر مرنة ومحدثة',
    mrrHint: 'MRR = إيراد شهري معياري وموزون',
    refundsNote: 'المبيعات الإجمالية ≠ الإيراد المحتفظ بعد الاسترداد',
    drillByPlan: 'تنقيب المعاملات',
    drillByProvider: 'عرض معاملات المزود',
    dataQuality: 'مراقبة جودة البيانات المالية ونزاهة السجل',
    missingPrice: 'سعر مفقود',
    unknownCurrency: 'عملة غير معروفة',
    unverified: 'شراء غير متحقق منه',
    duplicate: 'معاملة مكررة',
    noData: 'لا توجد بيانات إيرادات مسجلة بعد',
    noDataHint: 'سجل تدقيق الفوترة والمعاملات (billing_audit) فارغ حالياً لهذه الفترة',
    drilldownTitle: 'سجل المعاملات المؤهلة للتنقيب',
    drilldownNote: 'جميع الأرقام المالية قابلة للتنقيب حتى مستوى المعاملة الفردية الموثقة.',
  },
  en: {
    eyebrow: 'Executive Finance',
    title: 'Revenue & Financial Conversion Studio',
    lede: 'Verified transaction revenue only — no artificial net calculation with fixed fees, adhering strictly to audited billing records.',
    rangeToday: 'Today',
    range7: '7 Days',
    range30: '30 Days',
    rangeQuarter: 'Quarter',
    rangeYear: 'Full Year',
    gross: 'Gross Recorded Revenue',
    net: 'Net Retained Revenue',
    mrr: 'Monthly Recurring (MRR)',
    arr: 'Annual Run Rate (ARR)',
    activePaid: 'Active Paid Subscribers',
    newPaid: 'New Paid Subs',
    renewals: 'Renewals',
    refunds: 'Refunds',
    trialConversion: 'Trial Conversion',
    churn: 'Churn Rate',
    arpu: 'ARPU',
    byPlan: 'Subscribers by Plan',
    byCountry: 'By Country',
    byProvider: 'By Payment Provider',
    byCurrency: 'By Currency',
    grossHint: 'Gross unavailable — purchase amount not stored without price model',
    netHint: 'Net requires versioned store fee percentage',
    mrrHint: 'MRR = normalized recurring revenue',
    refundsNote: 'Gross sales ≠ retained revenue after refund audits',
    drillByPlan: 'Drill Transactions',
    drillByProvider: 'Drill Provider',
    dataQuality: 'Financial Data Quality & Ledger Audits',
    missingPrice: 'Missing Price',
    unknownCurrency: 'Unknown Currency',
    unverified: 'Unverified',
    duplicate: 'Duplicate',
    noData: 'No revenue records available',
    noDataHint: 'The billing_audit ledger has no recorded transactions for this period',
    drilldownTitle: 'Qualifying Transaction Cohort',
    drilldownNote: 'All reported finance figures drill directly to verifiable underlying ledger transactions.',
  },
}

type RangeOption = 'today' | '7d' | '30d' | 'quarter' | 'year'

export function RevenuePage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [range, setRange] = useState<RangeOption>('30d')
  const [data, setData] = useState<any>(null)
  const [drill, setDrill] = useState<any[]>([])
  const [drillLabel, setDrillLabel] = useState<string>('')
  const [isDrillOpen, setIsDrillOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.revenueOverview(range)
      setData(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    void load()
  }, [load])

  const doDrill = async (dimension: string, value: string) => {
    try {
      const r = await api.revenueDrilldown(dimension, value)
      setDrill(r.data as any)
      setDrillLabel(`${dimension}: ${value}`)
      setIsDrillOpen(true)
    } catch {
      // ignore
    }
  }

  const exportCSV = () => {
    if (!data) return
    const rows = [
      ['Metric', 'Value'],
      ['Active Paid Subscribers', String(data.metrics.active_paid_subscribers ?? 0)],
      ['New Paid Subscribers', String(data.metrics.new_paid_subscribers ?? 0)],
      ['Renewals', String(data.metrics.renewals ?? 0)],
      ['Refunds', String(data.metrics.refunds ?? 0)],
      ['MRR', String(data.metrics.mrr?.value ?? 'N/A')],
    ]
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `revenue_report_${range}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.noData} description={text.noDataHint} />

  const metrics = data.metrics

  return (
    <div className="content-studio-root">
      {/* 1. Command Strip */}
      <header className="commercial-command-strip">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            <span className="status-dot-pulse" style={{ background: '#10b981' }} />
            <span>سجل التدقيق المالي المزدوج متزامن (billing_audit)</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              padding: 4,
              borderRadius: 12,
              background: 'var(--surface-2)',
              border: '1px solid var(--cs-glass-border)',
              gap: 4,
            }}
          >
            {(['today', '7d', '30d', 'quarter', 'year'] as const).map((r) => {
              const label =
                r === 'today'
                  ? text.rangeToday
                  : r === '7d'
                  ? text.range7
                  : r === '30d'
                  ? text.range30
                  : r === 'quarter'
                  ? text.rangeQuarter
                  : text.rangeYear
              const isActive = range === r
              return (
                <button
                  key={r}
                  type="button"
                  className={`button ${isActive ? 'button--primary' : 'button--ghost'} button--small`}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: isActive ? 800 : 500,
                  }}
                  onClick={() => setRange(r)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button--secondary button--small"
            onClick={exportCSV}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="download" size={14} />
            <span>تصدير CSV</span>
          </button>

          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => void load()}
            style={{ height: 38, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="refresh" size={14} />
            <span>تحديث</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Panoramic Headline */}
      <section className="catalog-hero" style={{ marginBottom: 20 }}>
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(14, 165, 233, 0.16) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}
            >
              <span className="status-dot-pulse" style={{ background: '#10b981' }} />
              {locale === 'ar' ? 'بيانات مالية موثقة' : 'Audited Ledger'}
            </span>
          </div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {/* 3. Executive Financial Bento Matrix */}
      <div className="commercial-bento-grid">
        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #10b981, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}
            >
              <Icon name="trending-up" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>MRR RUN RATE</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">
              {metrics.mrr?.value ? `${metrics.mrr.value}` : '—'}
            </div>
            <div className="commercial-bento-card__label">{text.mrr}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: 'var(--muted)' }}>
              {metrics.mrr?.unavailable ?? text.mrrHint}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #0ea5e9, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}
            >
              <Icon name="users" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0ea5e9' }}>ACTIVE BASE</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{metrics.active_paid_subscribers}</div>
            <div className="commercial-bento-card__label">{text.activePaid}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: '#10b981' }}>+{metrics.new_paid_subscribers} مشترك جديد</span>
            <span>{metrics.renewals} تجديد</span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
            >
              <Icon name="dollar" size={22} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b' }}>GROSS / NET</span>
          </div>
          <div>
            <div className="commercial-bento-card__value">
              {metrics.gross_revenue.value ?? 'مدقق'}
            </div>
            <div className="commercial-bento-card__label">{text.gross}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: 'var(--muted)' }}>
              {metrics.net_revenue.unavailable ?? text.netHint}
            </span>
          </div>
        </div>

        <div className="commercial-bento-card">
          <div
            className="commercial-bento-card__glow"
            style={{
              background: `radial-gradient(circle, ${
                metrics.refunds > 0 ? '#ef4444' : '#10b981'
              }, transparent)`,
            }}
          />
          <div className="commercial-bento-card__header">
            <div
              className="commercial-bento-card__icon-wrap"
              style={{
                background:
                  metrics.refunds > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: metrics.refunds > 0 ? '#ef4444' : '#10b981',
              }}
            >
              <Icon name="alert-triangle" size={22} />
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: metrics.refunds > 0 ? '#ef4444' : '#10b981',
              }}
            >
              REFUND AUDIT
            </span>
          </div>
          <div>
            <div className="commercial-bento-card__value">{metrics.refunds}</div>
            <div className="commercial-bento-card__label">{text.refunds}</div>
          </div>
          <div className="commercial-bento-card__footer">
            <span style={{ color: metrics.refunds > 0 ? '#ef4444' : '#10b981' }}>
              {text.refundsNote}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Breakdowns Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          marginTop: 10,
        }}
      >
        {/* By Plan */}
        <div className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
              <Icon name="packages" size={18} />
              <span>{text.byPlan}</span>
            </h3>
            <span className="track-badge">
              {(data.breakdowns.by_plan ?? []).length} {locale === 'ar' ? 'باقات' : 'plans'}
            </span>
          </div>

          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ar' ? 'الخطة والاشتراك' : 'Plan'}</th>
                  <th>{locale === 'ar' ? 'العدد' : 'Count'}</th>
                  <th style={{ textAlign: 'end' }}>التنقيب</th>
                </tr>
              </thead>
              <tbody>
                {(data.breakdowns.by_plan ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {locale === 'ar' ? 'لا توجد بيانات خطط مسجلة' : 'No plan breakdown recorded'}
                    </td>
                  </tr>
                ) : (
                  (data.breakdowns.by_plan ?? []).map((r: any) => (
                    <tr key={r.plan}>
                      <td>
                        <strong style={{ fontSize: 14 }}>{r.plan}</strong>
                      </td>
                      <td>
                        <span
                          className="plan-badge"
                          style={{
                            fontWeight: 800,
                            padding: '4px 10px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#6366f1',
                          }}
                        >
                          {r.cnt}
                        </span>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => void doDrill('plan', r.plan)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Icon name="search" size={12} />
                          <span>{text.drillByPlan}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* By Provider */}
        <div className="catalog-filter-card" style={{ padding: 22, borderRadius: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
              <Icon name="shield" size={18} />
              <span>{text.byProvider}</span>
            </h3>
            <span className="track-badge">
              {(data.breakdowns.by_provider ?? []).length} {locale === 'ar' ? 'بوابات' : 'providers'}
            </span>
          </div>

          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>{locale === 'ar' ? 'بوابة الدفع' : 'Provider'}</th>
                  <th>{locale === 'ar' ? 'العدد' : 'Count'}</th>
                  <th style={{ textAlign: 'end' }}>التنقيب</th>
                </tr>
              </thead>
              <tbody>
                {(data.breakdowns.by_provider ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {locale === 'ar' ? 'لا توجد بوابات مسجلة' : 'No providers recorded'}
                    </td>
                  </tr>
                ) : (
                  (data.breakdowns.by_provider ?? []).map((r: any) => (
                    <tr key={r.provider}>
                      <td>
                        <strong style={{ fontSize: 14 }}>{r.provider}</strong>
                      </td>
                      <td>
                        <span
                          className="plan-badge"
                          style={{
                            fontWeight: 800,
                            padding: '4px 10px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#10b981',
                          }}
                        >
                          {r.cnt}
                        </span>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        <button
                          className="button button--ghost button--small"
                          type="button"
                          onClick={() => void doDrill('provider', r.provider)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <Icon name="search" size={12} />
                          <span>{text.drillByProvider}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p style={{ margin: '14px 0 0', fontSize: 11, color: 'var(--muted)' }}>
            العملات تُفصل محاسبياً لكل عملة على حدة، ولا تُجمع بشكل ساذج بدون سعر صرف موثق.
          </p>
        </div>
      </div>

      {/* 5. Data Quality & Ledger Integrity Triage Strip */}
      <section
        className="catalog-filter-card"
        style={{ padding: 22, borderRadius: 18, marginTop: 20 }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <div>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 800 }}>
              <Icon name="alert-triangle" size={18} />
              <span>{text.dataQuality}</span>
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              فحوصات الجودة التلقائية لمنع احتساب مبالغ وهمية أو مفقودة الأسعار
            </p>
          </div>
          <span className="track-badge">
            {(data.data_quality ?? []).length} {locale === 'ar' ? 'فحوصات' : 'audits'}
          </span>
        </div>

        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{locale === 'ar' ? 'حالة الفحص والمشكلة' : 'Issue'}</th>
                <th>{locale === 'ar' ? 'عدد التكرار' : 'Count'}</th>
                <th>حالة المعالجة</th>
              </tr>
            </thead>
            <tbody>
              {(data.data_quality ?? []).length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: '#10b981', padding: '20px 0' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
                      <Icon name="check" size={18} />
                      <span>{locale === 'ar' ? 'جودة البيانات المالية سليمة وموثقة ١٠٠٪' : 'Financial data quality 100% clean'}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                (data.data_quality ?? []).map((r: any) => (
                  <tr key={r.issue}>
                    <td>
                      <strong>{r.issue}</strong>
                    </td>
                    <td>
                      <span
                        className="plan-badge"
                        style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 800 }}
                      >
                        {r.cnt}
                      </span>
                    </td>
                    <td>
                      <span className="account-status account-status--review">تحت التدقيق</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Slide-Over Transaction Ledger Inspection Drawer */}
      {isDrillOpen && (
        <>
          <div className="commercial-drawer-backdrop" onClick={() => setIsDrillOpen(false)} />
          <div className="commercial-slide-drawer" role="dialog" aria-modal="true">
            <div className="commercial-drawer__header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: 'var(--text)' }}>
                  {text.drilldownTitle} ({drill.length})
                </h3>
                <small style={{ color: 'var(--muted)', fontSize: 12 }}>
                  تنقيب: <span dir="ltr" style={{ fontWeight: 800, color: '#0ea5e9' }}>{drillLabel}</span>
                </small>
              </div>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => setIsDrillOpen(false)}
                style={{ padding: 6 }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="commercial-drawer__body">
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'rgba(14, 165, 233, 0.08)',
                  border: '1px solid rgba(14, 165, 233, 0.25)',
                  fontSize: 12,
                  color: 'var(--text)',
                }}
              >
                {text.drilldownNote}
              </div>

              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parent ID</th>
                      <th>Product</th>
                      <th>Provider</th>
                      <th>Entitlement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drill.map((r: any) => (
                      <tr key={r.id}>
                        <td dir="ltr" style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {String(r.parent_id).slice(0, 8)}
                        </td>
                        <td dir="ltr" style={{ fontWeight: 700, fontSize: 12 }}>
                          {r.product_id}
                        </td>
                        <td>
                          <span className="track-badge">{r.provider}</span>
                        </td>
                        <td>
                          <span
                            className={`account-status account-status--${
                              r.entitlement_status === 'active' ? 'active' : 'review'
                            }`}
                          >
                            {r.entitlement_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="commercial-drawer__footer">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setIsDrillOpen(false)}
                style={{ width: '100%', height: 42 }}
              >
                إغلاق تفاصيل المعاملات
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}