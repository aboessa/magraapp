import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'إدارة الاشتراكات والفوترة',
    title: 'مساحة عمل الاشتراك',
    back: 'العودة لمركز الفوترة',
    loading: 'جارٍ تحميل بيانات الاشتراك…',
    loadError: 'تعذر تحميل بيانات الاشتراك',
    overview: 'نظرة عامة',
    transactions: 'المعاملات المالية',
    entitlement: 'حالة الاستحقاق الفعلي',
    provider: 'حالة المزوّد (Google Play)',
    renewal: 'التجديد والانتهاء',
    history: 'السجل الزمني',
    support: 'الدعم الفني',
    audit: 'التدقيق',
    mismatch: 'تناقض استحقاق',
    renew: 'تاريخ التجديد',
    family: 'العائلة',
    plan: 'الخطة',
  },
  en: {
    eyebrow: 'Billing & Subscriptions',
    title: 'Subscription Workspace',
    back: 'Back to Billing',
    loading: 'Loading subscription details…',
    loadError: 'Error loading subscription',
    overview: 'Overview',
    transactions: 'Transactions',
    entitlement: 'Effective Entitlement',
    provider: 'Provider State (Google Play)',
    renewal: 'Renewal & Expiry',
    history: 'Timeline',
    support: 'Support',
    audit: 'Audit',
    mismatch: 'ENTITLEMENT MISMATCH',
    renew: 'Renewal Date',
    family: 'Family',
    plan: 'Plan',
  },
}

function formatMs(v: any, locale: string) {
  if (typeof v !== 'number' || !v) return '—'
  return new Date(v).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium' })
}

export function SubscriptionWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<'overview' | 'transactions' | 'entitlement' | 'provider' | 'renewal'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.subscription(id)
      setData(res.data)
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

  const mismatch = data.has_mismatch

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: mismatch
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.25) 0%, rgba(245, 158, 11, 0.15) 60%, transparent 80%)'
              : 'radial-gradient(circle, rgba(16, 185, 129, 0.22) 0%, rgba(14, 165, 233, 0.15) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: mismatch ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                color: mismatch ? '#ef4444' : '#10b981',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: mismatch ? '#ef4444' : '#10b981' }}
              />
              {mismatch ? 'تنبيه: فجوة استحقاق' : 'الاستحقاق مطابق'}
            </span>
          </div>
          <h1 className="catalog-hero__title" dir="ltr" style={{ fontSize: 24 }}>
            {data.parent_id}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>
              الخطة: <strong>{data.plan}</strong>
            </span>
            <span>•</span>
            <span>
              المزوّد: <strong>{data.provider}</strong>
            </span>
            <span>•</span>
            <span>
              تاريخ التجديد: <strong>{formatMs(data.expires_at_ms, locale)}</strong>
            </span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('billing')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
          <Link
            className="button button--ghost"
            to={adminPath(`customers/${data.parent_id}`)}
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <Icon name="parents" size={14} />
            <span>Family 360</span>
          </Link>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="subscriptions" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.plan}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {data.plan}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              الاستحقاق الفعلي
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9' }}>
            <Icon name="globe" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.provider}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {data.provider_state}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#0ea5e9' }}>
              {data.provider}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">الاستحقاق التشغيلي</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {data.entitlement_status}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#a855f7' }}>
              FamilyState DO
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="clock" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.renew}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 16 }}>
              {formatMs(data.expires_at_ms, locale)}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              تاريخ نهاية الدورة
            </span>
          </div>
        </div>
      </div>

      {mismatch && (
        <div
          style={{
            padding: 16,
            borderRadius: 14,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Icon name="warning" size={20} style={{ color: '#ef4444' }} />
          <div style={{ fontSize: 13, color: 'var(--text)' }}>
            <strong>تنبيه فجوة استحقاق:</strong> Google Play: {data.provider_state} مقابل استحقاق العائلة: {data.entitlement_status} → {text.mismatch}
          </div>
        </div>
      )}

      {/* 3. Studio Tab Control Strip */}
      <div className="catalog-control-strip">
        <div className="catalog-control-strip__filter-pills">
          {(['overview', 'transactions', 'entitlement', 'provider', 'renewal'] as const).map((t) => (
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
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>تفاصيل وبيانات الاشتراك</h3>
            <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
              <div>
                <dt>{text.plan}</dt>
                <dd><span className={`plan-badge plan-badge--${data.plan}`}>{data.plan}</span></dd>
              </div>
              <div>
                <dt>{text.provider}</dt>
                <dd dir="ltr">{data.provider} — {data.product_id}</dd>
              </div>
              <div>
                <dt>حالة المزوّد</dt>
                <dd><span className="account-status account-status--active">{data.provider_state}</span></dd>
              </div>
              <div>
                <dt>الاستحقاق الفعلي</dt>
                <dd><span className="account-status account-status--active">{data.entitlement_status}</span></dd>
              </div>
              <div>
                <dt>{text.renew}</dt>
                <dd>{formatMs(data.expires_at_ms, locale)}</dd>
              </div>
              <div>
                <dt>تاريخ التحقق</dt>
                <dd>{formatMs(data.verified_at_ms, locale)}</dd>
              </div>
            </dl>

            <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--cs-glass-border)' }}>
              <Link className="button button--secondary button--small" to={adminPath(`customers/${data.parent_id}`)}>
                <Icon name="parents" size={13} />
                <span>Family 360</span>
              </Link>
              <Link className="button button--ghost button--small" to={adminPath(`billing/transaction/${data.id}`)}>
                <Icon name="sparkles" size={13} />
                <span>سجل المعاملة المالية</span>
              </Link>
            </div>
            <p className="readiness-note" style={{ marginTop: 12 }}>
              لا توجد أزرار إلغاء وهمية — إجراءات المزوّد تتم عبر المتجر وموثقة في سجل التسوية.
            </p>
          </section>
        )}

        {tab === 'transactions' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>المعاملات المرتبطة</h3>
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>المنتج</th>
                    <th>المزوّد</th>
                    <th>الاستحقاق</th>
                    <th>تاريخ التحقق</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.related_transactions ?? []).map((r: any) => (
                    <tr key={r.id}>
                      <td dir="ltr">{r.product_id}</td>
                      <td>{r.provider_state}</td>
                      <td>{r.entitlement_status}</td>
                      <td>{formatMs(r.verified_at_ms, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'entitlement' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{text.entitlement}</h3>
            <p style={{ fontSize: 14 }}>
              الخطة الفعالة من مصدر السلطة FamilyState:{' '}
              <strong className={`plan-badge plan-badge--${data.family_entitlement?.plan ?? data.plan}`}>
                {data.family_entitlement?.plan ?? data.plan}
              </strong>
            </p>
            <p className="readiness-note">مصدر السلطة المباشر هو FamilyState DO، وإسقاط D1 لا يتعارض معه.</p>
          </section>
        )}

        {tab === 'provider' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{text.provider}</h3>
            <p style={{ fontSize: 13 }}>المزوّد: <strong>{data.provider}</strong></p>
            <p style={{ fontSize: 13 }}>حالة المزوّد: <strong>{data.provider_state}</strong></p>
            <p style={{ fontSize: 13 }}>
              رمز التجزئة (Token Hash):{' '}
              <code dir="ltr" style={{ fontFamily: 'monospace', padding: '2px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: 4 }}>
                {String(data.purchase_token_hash).slice(0, 16)}…
              </code>
            </p>
          </section>
        )}

        {tab === 'renewal' && (
          <section className="catalog-filter-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>{text.renewal}</h3>
            <p style={{ fontSize: 13 }}>تاريخ البداية: <strong>{formatMs(data.starts_at_ms, locale)}</strong></p>
            <p style={{ fontSize: 13 }}>تاريخ الانتهاء: <strong>{formatMs(data.expires_at_ms, locale)}</strong></p>
          </section>
        )}
      </div>
    </div>
  )
}
