import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { Icon } from '../components/Icon'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    back: 'العودة للتراخيص',
    loading: 'جارٍ تحميل الترخيص...',
    loadError: 'تعذر تحميل بيانات الترخيص',
    overview: 'نظرة عامة',
    content: 'المحتوى المتأثر',
    territories: 'الأقاليم والتغطية',
    languages: 'اللغات المدعومة',
    platforms: 'المنصات والأجهزة',
    windows: 'نوافذ البث والصلاحية',
    commercial: 'الشروط التجارية',
    documents: 'المستندات والعقود',
    renewal: 'التجديد التلقائي',
    usage: 'إحصاءات الاستخدام',
    history: 'سجل العمليات والتدقيق',
    expiry: 'تاريخ الانتهاء',
    territory: 'النطاق الجغرافي',
    impact: 'الأثر التشغيلي',
    sensitive: 'بنود مالية حساسة — وصول مقيد ومحمي',
    owner: 'مالك الحق',
    licenseType: 'نوع الترخيص',
    activeStatus: 'نشط وصالح',
    expiringStatus: 'يقترب من الانتهاء',
    expiredStatus: 'منتهي الصلاحية',
    perpetual: 'ترخيص دائم',
    daysRemaining: 'يوم متبقٍ',
    allTerritories: 'عالمي (كل الأقاليم)',
    allLanguages: 'كل اللغات',
    allPlatforms: 'كل المنصات',
    fullAudit: 'سجل التدقيق الكامل',
  },
  en: {
    back: 'Back to Rights',
    loading: 'Loading license details...',
    loadError: 'Failed to load license details',
    overview: 'Overview',
    content: 'Affected Content',
    territories: 'Territories & Coverage',
    languages: 'Supported Languages',
    platforms: 'Platforms & Devices',
    windows: 'Windows & Validity',
    commercial: 'Commercial Terms',
    documents: 'Documents & Contracts',
    renewal: 'Auto Renewal',
    usage: 'Usage Metrics',
    history: 'Audit Log & History',
    expiry: 'Expiry Date',
    territory: 'Territory Coverage',
    impact: 'Operational Impact',
    sensitive: 'Financial terms restricted — access audited',
    owner: 'Rights Holder',
    licenseType: 'License Type',
    activeStatus: 'Active & Valid',
    expiringStatus: 'Expiring Soon',
    expiredStatus: 'Expired',
    perpetual: 'Perpetual',
    daysRemaining: 'days remaining',
    allTerritories: 'Worldwide',
    allLanguages: 'All Languages',
    allPlatforms: 'All Platforms',
    fullAudit: 'Full Audit Trail',
  },
}

function parseList(v: any): string[] {
  if (!v) return []
  if (Array.isArray(v)) return v
  try {
    const a = JSON.parse(v)
    return Array.isArray(a) ? a : []
  } catch {
    return String(v).split(',').map((s) => s.trim()).filter(Boolean)
  }
}

export function RightsWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [data, setData] = useState<any>(null)
  const [tab, setTab] = useState<'overview' | 'content' | 'territories' | 'windows' | 'history'>('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.rightDetail(id)
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

  const isExpired = data.expiry_date && new Date(data.expiry_date).getTime() < Date.now()
  const daysRemaining = data.expiry_date
    ? Math.ceil((new Date(data.expiry_date).getTime() - Date.now()) / 86400000)
    : null
  const isExpiring = daysRemaining != null && daysRemaining > 0 && daysRemaining <= 60

  const countries = parseList(data.countries)
  const languages = parseList(data.languages)
  const devices = parseList(data.devices)

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{
            background: isExpired
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.2) 0%, rgba(180, 83, 9, 0.15) 50%, transparent 80%)'
              : isExpiring
              ? 'radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(168, 85, 247, 0.15) 50%, transparent 80%)'
              : 'radial-gradient(circle, rgba(16, 185, 129, 0.2) 0%, rgba(59, 130, 246, 0.15) 50%, transparent 80%)',
          }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <Link className="catalog-hero__eyebrow" to={adminPath('rights')}>
              ← {text.back}
            </Link>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: isExpired ? '#ef4444' : isExpiring ? '#f59e0b' : '#10b981',
                color: isExpired ? '#ef4444' : isExpiring ? '#f59e0b' : '#10b981',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: isExpired ? '#ef4444' : isExpiring ? '#f59e0b' : '#10b981' }}
              />
              {isExpired
                ? text.expiredStatus
                : isExpiring
                ? `${text.expiringStatus} (${daysRemaining} ${text.daysRemaining})`
                : text.activeStatus}
            </span>
          </div>
          <h1 className="catalog-hero__title">{data.series_title ?? data.content_id}</h1>
          <p className="catalog-hero__desc">
            {text.owner}: <strong>{data.owner}</strong> · {text.licenseType}:{' '}
            <span className="track-badge">{data.license_type}</span> · ID: <code dir="ltr">{id}</code>
          </p>
        </div>

        <div className="catalog-hero__actions">
          <Link
            className="button button--ghost"
            to={`${adminPath('audit-logs')}?entity_type=rights_license&entity_id=${encodeURIComponent(id)}`}
          >
            <Icon name="clock" size={15} />
            <span>{text.fullAudit}</span>
          </Link>
        </div>
      </section>

      {/* 2. Bento Glass KPI Cards */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div
            className="kpi-glass-card__icon"
            style={{
              background: isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: isExpired ? '#ef4444' : '#10b981',
            }}
          >
            <Icon name={isExpired ? 'alert-triangle' : 'shield'} size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.windows}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 20 }}>
              {isExpired ? text.expiredStatus : data.expiry_date ?? text.perpetual}
            </div>
            <span
              className="kpi-glass-card__trend"
              style={{ color: isExpired ? '#ef4444' : isExpiring ? '#f59e0b' : '#10b981' }}
            >
              {daysRemaining != null ? `${daysRemaining} ${text.daysRemaining}` : text.perpetual}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <Icon name="globe" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.territory}</span>
            <div className="kpi-glass-card__num">{countries.length ? countries.length : '∞'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#3b82f6' }}>
              {countries.length ? `${countries.length} دول` : text.allTerritories}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <Icon name="series" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.content}</span>
            <div className="kpi-glass-card__num">{(data.affected_content ?? []).length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#a855f7' }}>
              {locale === 'ar' ? 'سلاسل وعناصر مرتبطة' : 'Linked titles'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Icon name="star" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.licenseType}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18, textTransform: 'capitalize' }}>
              {data.license_type}
            </div>
            <span className="kpi-glass-card__trend" style={{ color: '#f59e0b' }}>
              {data.owner}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Navigation Studio Tabs */}
      <div className="catalog-control-strip" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1, padding: '4px 0' }}>
          {(['overview', 'content', 'territories', 'windows', 'history'] as const).map((t) => (
            <button
              key={t}
              className={`button ${tab === t ? 'button--primary' : 'button--ghost'} button--small`}
              onClick={() => setTab(t)}
            >
              {(text as any)[t] ?? t}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Tab Panels */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="info" size={18} />
              <span>{text.overview}</span>
            </h3>
            <dl style={{ display: 'grid', gridTemplateColumns: '120px 1fr', rowGap: 14, columnGap: 12, margin: 0 }}>
              <dt style={{ color: 'var(--text-muted)' }}>{text.territory}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{countries.join(', ') || text.allTerritories}</dd>

              <dt style={{ color: 'var(--text-muted)' }}>{text.languages}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{languages.join(', ') || text.allLanguages}</dd>

              <dt style={{ color: 'var(--text-muted)' }}>{text.platforms}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>{devices.join(', ') || text.allPlatforms}</dd>

              <dt style={{ color: 'var(--text-muted)' }}>{text.expiry}</dt>
              <dd style={{ margin: 0, fontWeight: 500 }}>
                {data.expiry_date ?? text.perpetual}{' '}
                {daysRemaining != null ? (
                  <span
                    className={`account-status account-status--${isExpired ? 'archived' : isExpiring ? 'review' : 'active'}`}
                    style={{ marginInlineStart: 8 }}
                  >
                    {daysRemaining} {text.daysRemaining}
                  </span>
                ) : null}
              </dd>
            </dl>
          </div>

          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="shield" size={18} />
              <span>{locale === 'ar' ? 'السياسة والضوابط القانونية' : 'Policy & Governance'}</span>
            </h3>
            <div className="inline-alert inline-alert--info" style={{ marginBottom: 14 }}>
              <strong>{locale === 'ar' ? 'نموذج النطاق الجغرافي:' : 'Territory Model:'}</strong>{' '}
              {locale === 'ar'
                ? 'عالمي / عالمي باستثناء / محدد فقط / غير متاح — متوافق كلياً مع محرك الإتاحة.'
                : 'Worldwide / Worldwide except / Selected only / Unavailable — enforced by Availability Engine.'}
            </div>
            <div className="inline-alert inline-alert--warning">
              <Icon name="lock" size={16} />
              <span>{text.sensitive}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'content' && (
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{text.content}</h3>
            <span className="track-badge">{(data.affected_content ?? []).length} {locale === 'ar' ? 'عنصر' : 'items'}</span>
          </div>

          {(data.affected_content ?? []).length === 0 ? (
            <EmptyState
              title={locale === 'ar' ? 'لا يوجد محتوى مرتبط حالياً' : 'No linked content'}
              description={locale === 'ar' ? 'يمكن ربط الأعمال وسلاسل الكتالوج بهذا العقد' : 'Attach catalog series or titles to this license'}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {(data.affected_content ?? []).map((c: any) => (
                <div
                  key={c.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>{c.title_ar}</strong>
                    <div style={{ marginTop: 4 }}>
                      <span className="track-badge">{c.status}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Link className="button button--ghost button--small" to={adminPath(`series/${c.id}`)}>
                      {locale === 'ar' ? 'مساحة العمل ←' : 'Open Workspace →'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="panel__note" style={{ marginTop: 16 }}>
            Rights → Content → canonical Content Workspace; Content Workspace → Rights
          </p>
          <p className="panel__note">
            Scheduled releases affected: {(data.affected_content ?? []).length} items
          </p>
        </div>
      )}

      {tab === 'territories' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 14 }}>{text.territories}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {countries.length ? (
                countries.map((c) => (
                  <span key={c} className="plan-badge" style={{ fontSize: 12 }} dir="ltr">
                    {c}
                  </span>
                ))
              ) : (
                <span className="table-secondary">{text.allTerritories}</span>
              )}
            </div>
            <p className="panel__note">Availability consistency enforced — no conflicting territory values.</p>
          </div>

          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 14 }}>{text.languages}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {languages.length ? (
                languages.map((l) => (
                  <span key={l} className="plan-badge" style={{ fontSize: 12 }} dir="ltr">
                    {l}
                  </span>
                ))
              ) : (
                <span className="table-secondary">{text.allLanguages}</span>
              )}
            </div>
          </div>

          <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
            <h3 style={{ marginBottom: 14 }}>{text.platforms}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {devices.length ? (
                devices.map((d) => (
                  <span key={d} className="plan-badge" style={{ fontSize: 12 }} dir="ltr">
                    {d}
                  </span>
                ))
              ) : (
                <span className="table-secondary">{text.allPlatforms}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'windows' && (
        <div className="panel" style={{ padding: 20, borderRadius: 12 }}>
          <h3 style={{ marginBottom: 16 }}>{text.windows}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div className="stat-card">
              <span>{locale === 'ar' ? 'بداية البث' : 'Window Start'}</span>
              <strong>—</strong>
              <small>{locale === 'ar' ? 'نافذة دائمة' : 'Immediate'}</small>
            </div>
            <div className="stat-card">
              <span>{locale === 'ar' ? 'نهاية البث' : 'Window End'}</span>
              <strong>{data.expiry_date ?? text.perpetual}</strong>
              <small>{daysRemaining != null ? `${daysRemaining} ${text.daysRemaining}` : text.perpetual}</small>
            </div>
            <div className="stat-card">
              <span>{locale === 'ar' ? 'الحالة التشغيلية' : 'Operational Status'}</span>
              <strong style={{ color: isExpired ? '#ef4444' : isExpiring ? '#f59e0b' : '#10b981' }}>
                {isExpired ? 'EXPIRED' : isExpiring ? 'EXPIRING' : 'ACTIVE'}
              </strong>
            </div>
          </div>
          <p className="panel__note">Expiry alerts: 90/60/30/7 days (policy)</p>
        </div>
      )}

      {tab === 'history' && (
        <div className="panel panel--table" style={{ padding: 20, borderRadius: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>{text.history}</h3>
            <Link
              className="button button--ghost button--small"
              to={`${adminPath('audit-logs')}?entity_type=rights_license&entity_id=${encodeURIComponent(id)}`}
            >
              <Icon name="clock" size={14} /> Full audit in Audit Log →
            </Link>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {(data.history ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {locale === 'ar' ? 'لا توجد سجلات سابقة' : 'No audit entries recorded'}
                    </td>
                  </tr>
                ) : (
                  (data.history ?? []).map((h: any) => (
                    <tr key={h.id}>
                      <td>
                        <strong>{h.action}</strong>
                      </td>
                      <td dir="ltr">{h.actor_id}</td>
                      <td>{h.created_at}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
