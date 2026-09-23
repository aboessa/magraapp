import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'إدارة الباقات والخطط',
    title: 'مساحة عمل الخطة',
    back: 'العودة للباقات والأسعار',
    loading: 'جارٍ تحميل تفاصيل الخطة…',
    loadError: 'تعذر تحميل الخطة',
    overview: 'نظرة عامة والحدود',
    entitlements: 'مصفوفة الاستحقاقات',
    limits: 'الحدود التشغيلية',
    pricing: 'التسعير الإقليمي',
    store: 'منتجات المتاجر المرتبطة',
    trials: 'التجارب المجانية',
    promotions: 'العروض الترويجية',
    availability: 'الإتاحة',
    subscribers: 'المشتركون النشطون',
    history: 'السجل',
    limitChange: 'تنبيه: تغيير الحدود يؤثر فوراً على كافة عائلات هذه الخطة. يرجى توثيق الإجراء في سجل التدقيق.',
    priceUnavailable: 'التسعير غير متاح لهذه الخطة',
  },
  en: {
    eyebrow: 'Plans & Packaging Management',
    title: 'Plan Workspace',
    back: 'Back to Plans & Pricing',
    loading: 'Loading plan details…',
    loadError: 'Error loading plan',
    overview: 'Overview & Limits',
    entitlements: 'Entitlement Matrix',
    limits: 'Operational Limits',
    pricing: 'Regional Pricing',
    store: 'Store Products',
    trials: 'Free Trials',
    promotions: 'Promotions',
    availability: 'Availability',
    subscribers: 'Active Subscribers',
    history: 'History',
    limitChange: 'Notice: Mutating limits immediately affects all families on this tier. Audit trail recorded.',
    priceUnavailable: 'Price configuration unavailable for this plan',
  },
}

export function PlanWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<'overview' | 'pricing' | 'store' | 'subscribers'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.planDetail(id)
      setData(r.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.loadError} description={id} />

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background:
              'radial-gradient(circle, rgba(245, 158, 11, 0.22) 0%, rgba(14, 165, 233, 0.15) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}
            >
              <span className="status-dot-pulse" style={{ background: '#f59e0b' }} />
              {data.subscribers} مشترك نشط
            </span>
          </div>
          <h1 className="catalog-hero__title" dir="ltr" style={{ fontSize: 24 }}>
            {data.id}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>
              العروض/البلدان: <strong>{(data.pricing ?? []).length}</strong>
            </span>
            <span>•</span>
            <span>
              منتجات المتاجر: <strong>{(data.products ?? []).length}</strong>
            </span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('packages')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
          <Link
            className="button button--ghost"
            to={adminPath(`billing?plan=${data.id}`)}
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <Icon name="subscriptions" size={14} />
            <span>فلترة الاشتراكات</span>
          </Link>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="parents" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.subscribers}</span>
            <div className="kpi-glass-card__num">{data.subscribers}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              عائلات مشتركة حالياً
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
            <Icon name="devices" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">الأجهزة المسموحة</span>
            <div className="kpi-glass-card__num">{data.limits?.devices ?? 1}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#0ea5e9' }}>
              {data.limits?.children ?? 1} أطفال متاحين
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Icon name="play" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">البث المتزامن</span>
            <div className="kpi-glass-card__num">{data.limits?.concurrent_streams ?? 1}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#a855f7' }}>
              شاشات في نفس اللحظة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="upload" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">أجهزة التنزيل أوفلاين</span>
            <div className="kpi-glass-card__num">{data.limits?.download_devices ?? 0}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              رخص التخزين المحلي
            </span>
          </div>
        </div>
      </div>

      {/* 3. Studio Tab Navigation Strip */}
      <div className="catalog-control-strip">
        <div className="catalog-control-strip__filter-pills">
          {(['overview', 'pricing', 'store', 'subscribers'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`filter-pill ${tab === t ? 'filter-pill--active' : ''}`}
              onClick={() => setTab(t)}
            >
              <span>{(text as any)[t] ?? t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tab Content */}
      <div className="page-stack" style={{ gap: 20 }}>
        {tab === 'overview' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{text.entitlements}</h3>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>الميزة / الحد التشغيلي</th>
                    <th>القيمة المعتمدة</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>ملفات الأطفال (Children Profiles)</td>
                    <td><strong>{data.limits.children}</strong></td>
                  </tr>
                  <tr>
                    <td>الأجهزة المسموحة (Authorized Devices)</td>
                    <td><strong>{data.limits.devices}</strong></td>
                  </tr>
                  <tr>
                    <td>البث المتزامن (Concurrent Streams)</td>
                    <td><strong>{data.limits.concurrent_streams}</strong></td>
                  </tr>
                  <tr>
                    <td>أجهزة التنزيل دون اتصال (Offline Download Devices)</td>
                    <td><strong>{data.limits.download_devices}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="readiness-note" style={{ marginTop: 16 }}>
              {text.limitChange}
            </p>
          </section>
        )}

        {tab === 'pricing' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{text.pricing}</h3>
            {(data.pricing ?? []).length ? (
              <div className="table-scroll" tabIndex={0}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الدولة</th>
                      <th>المتجر / المزوّد</th>
                      <th>العملة</th>
                      <th>السعر</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pricing as any[]).map((p: any) => (
                      <tr key={p.id}>
                        <td><span className="plan-badge">{p.country}</span></td>
                        <td>{p.provider}</td>
                        <td>{p.currency}</td>
                        <td dir="ltr" style={{ fontWeight: 700 }}>
                          {p.price_minor != null ? (p.price_minor / 100).toFixed(2) : '—'}
                        </td>
                        <td>
                          <span className={`account-status account-status--${p.status === 'active' ? 'active' : 'archived'}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title={text.priceUnavailable} description="لا يوجد تكوين تسعير مستقل مسجل لهذه الخطة." />
            )}
          </section>
        )}

        {tab === 'store' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{text.store}</h3>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>معرف منتج المتجر (Store Product ID)</th>
                    <th>المزوّد</th>
                    <th>فترة الفوترة</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.products ?? []).map((p: any) => (
                    <tr key={p.id}>
                      <td dir="ltr" style={{ fontFamily: 'monospace' }}>{p.store_product_id}</td>
                      <td>{p.provider}</td>
                      <td>{p.billing_period}</td>
                      <td>
                        <span className={`account-status account-status--${p.status === 'active' ? 'active' : 'archived'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="readiness-note" style={{ marginTop: 12 }}>
              الربط بين الخطة ومنتجات المتاجر صريح وموثق، ولا يتم استنتاجه تخمينياً من السعر.
            </p>
          </section>
        )}

        {tab === 'subscribers' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>
              {text.subscribers}: {data.subscribers}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
              يمكنك الاطلاع على قائمة كافة العائلات والاشتراكات المعتمدة على هذه الخطة في مركز الفوترة.
            </p>
            <Link className="button button--primary button--small" to={adminPath(`billing?plan=${data.id}`)}>
              <span>عرض كافة المشتركين في خطة {data.id}</span>
              <Icon name="arrow" size={12} />
            </Link>
          </section>
        )}
      </div>
    </div>
  )
}
