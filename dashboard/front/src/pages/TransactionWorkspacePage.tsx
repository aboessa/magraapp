import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'التجارة وسجلات المعاملات',
    title: 'مساحة عمل المعاملة المالية',
    back: 'العودة لمركز الفوترة',
    loading: 'جارٍ تحميل المعاملة…',
    loadError: 'تعذر تحميل المعاملة',
    transaction: 'المعاملة',
    family: 'العائلة',
    provider: 'المزوّد',
    product: 'المنتج',
    plan: 'الخطة',
    country: 'البلد',
    currency: 'العملة',
    gross: 'الإجمالي',
    status: 'الحالة',
    verified: 'تاريخ التحقق',
    refund: 'الاسترداد المالي',
    audit: 'سجل التدقيق للمعاملة',
  },
  en: {
    eyebrow: 'Commerce & Transactions',
    title: 'Transaction Workspace',
    back: 'Back to Billing',
    loading: 'Loading transaction…',
    loadError: 'Error loading transaction',
    transaction: 'Transaction',
    family: 'Family',
    provider: 'Provider',
    product: 'Product',
    plan: 'Plan',
    country: 'Country',
    currency: 'Currency',
    gross: 'Gross',
    status: 'Status',
    verified: 'Verified Date',
    refund: 'Refund',
    audit: 'Audit Log',
  },
}

function formatMs(v: any, loc: string) {
  if (typeof v !== 'number' || !v) return '—'
  return new Date(v).toLocaleString(loc === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function TransactionWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.transaction(id)
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
              'radial-gradient(circle, rgba(14, 165, 233, 0.22) 0%, rgba(99, 102, 241, 0.15) 60%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{ borderColor: 'rgba(14, 165, 233, 0.3)', color: '#0ea5e9' }}
            >
              <span className="status-dot-pulse" style={{ background: '#0ea5e9' }} />
              معاملة موثقة رسمياً
            </span>
          </div>
          <h1 className="catalog-hero__title" dir="ltr" style={{ fontSize: 24 }}>
            {data.id}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>
              العائلة:{' '}
              <strong dir="ltr">
                <Link to={adminPath(`customers/${data.parent_id}`)} style={{ color: 'var(--primary)' }}>
                  {data.parent_id}
                </Link>
              </strong>
            </span>
            <span>•</span>
            <span>
              المنتج: <strong dir="ltr">{data.product_id}</strong>
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
            to={adminPath(`billing/subscription/${data.id}`)}
            style={{ backdropFilter: 'blur(8px)' }}
          >
            <Icon name="subscriptions" size={14} />
            <span>مساحة الاشتراك</span>
          </Link>
        </div>
      </section>

      {/* 2. Side-by-side Bento Live Metric KPI Strip */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Icon name="check" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.status}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {data.provider_state}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#10b981' }}>
              الاستحقاق: {data.entitlement_status}
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
              {data.provider}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#0ea5e9' }}>
              Google Play Billing
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Icon name="subscriptions" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.plan}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {data.plan}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#a855f7' }}>
              الخطة التجارية
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="clock" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.verified}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 14 }}>
              {formatMs(data.verified_at_ms, locale)}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              تاريخ الاعتماد
            </span>
          </div>
        </div>
      </div>

      {/* 3. Transaction Details Bento Card */}
      <div className="page-stack" style={{ gap: 20 }}>
        <section className="catalog-filter-card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>بيانات المعاملة المالية</h3>
          <dl className="detail-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div>
              <dt>{text.family}</dt>
              <dd dir="ltr">
                <Link to={adminPath(`customers/${data.parent_id}`)} style={{ color: 'var(--primary)', fontWeight: 700 }}>
                  {data.parent_id}
                </Link>
              </dd>
            </div>
            <div>
              <dt>{text.provider}</dt>
              <dd>{data.provider}</dd>
            </div>
            <div>
              <dt>{text.product}</dt>
              <dd dir="ltr">{data.product_id}</dd>
            </div>
            <div>
              <dt>{text.plan}</dt>
              <dd><span className={`plan-badge plan-badge--${data.plan}`}>{data.plan}</span></dd>
            </div>
            <div>
              <dt>{text.status}</dt>
              <dd>{data.entitlement_status} / {data.provider_state}</dd>
            </div>
            <div>
              <dt>{text.verified}</dt>
              <dd>{formatMs(data.verified_at_ms, locale)}</dd>
            </div>
            <div>
              <dt>{text.refund}</dt>
              <dd>{data.entitlement_status === 'revoked' ? 'Refunded / Revoked' : '—'}</dd>
            </div>
            <div>
              <dt>فحص التكرار</dt>
              <dd>
                {data.is_duplicate ? (
                  <span className="track-badge" style={{ background: '#ef4444', color: '#fff' }}>توكن مكرر</span>
                ) : (
                  'سليم وغير مكرر'
                )}
              </dd>
            </div>
          </dl>

          <p className="readiness-note" style={{ marginTop: 16 }}>
            البيانات مستخرجة مباشرة من مزود الدفع Google Play، ورمز الشراء مشفر لضمان الأمان والخصوصية.
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--cs-glass-border)' }}>
            <Link className="button button--secondary button--small" to={adminPath(`billing/subscription/${data.id}`)}>
              <Icon name="subscriptions" size={13} />
              <span>مساحة عمل الاشتراك</span>
            </Link>
            <Link className="button button--ghost button--small" to={adminPath(`customers/${data.parent_id}`)}>
              <Icon name="parents" size={13} />
              <span>ملف العائلة 360</span>
            </Link>
          </div>
        </section>

        {/* 4. Audit Table */}
        <section className="catalog-filter-card" style={{ padding: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{text.audit}</h3>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>الإجراء</th>
                  <th>المسؤول / المشغّل</th>
                  <th>الوقت</th>
                </tr>
              </thead>
              <tbody>
                {(data.history ?? []).map((h: any) => (
                  <tr key={h.id}>
                    <td><span className="table-primary">{h.action}</span></td>
                    <td dir="ltr">{h.actor_id ?? '—'}</td>
                    <td dir="ltr">{h.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
