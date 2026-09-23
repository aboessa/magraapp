import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { accountStatusLabels, planLabels, trackLabels } from '../lib/labels'
import { Icon } from '../components/Icon'
import type { ParentDetail } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'إدارة أولياء الأمور',
    back: 'العودة لقائمة أولياء الأمور',
    family: 'العائلة',
    loading: 'جارٍ تحميل حساب ولي الأمر…',
    loadError: 'تعذر تحميل حساب ولي الأمر',
    tabs: {
      overview: 'نظرة عامة ومقاييس',
      family: 'ملف العائلة',
      children: 'الأطفال المرتبطون',
      subscription: 'الاشتراك والباقة',
      devices: 'الأجهزة المسجلة',
      support: 'تذاكر الدعم',
      security: 'الأمان والوصول',
    },
    status: 'حالة الحساب',
    plan: 'الباقة الحالية',
    children: 'الأطفال',
    devices: 'الأجهزة',
    tickets: 'الدعم',
    noChildren: 'لا توجد ملفات أطفال مضافة لهذا الحساب',
    createdAt: 'تاريخ إنشاء الحساب',
    lastActive: 'آخر ظهور في النظام',
    nickname: 'الاسم المستعار',
    track: 'المسار التعليمي',
    viewChild: 'فتح ملف الطفل',
    viewFamily: 'ملف العائلة 360',
    openSupport: 'فتح مركز الدعم',
    privacyHint: 'ملفات الأطفال محمية وتُدار بإشراف ولي الأمر مباشرة.',
    noDevices: 'لا توجد أجهزة مسجلة لهذه العائلة حاليًا.',
    noSupport: 'لا توجد تذاكر دعم مرتبطة بهذا الحساب.',
    securityTitle: 'حالة الحساب والأمان',
    subscriptionInfo: 'تفاصيل الدفع والاستحقاق الكاملة متوفرة في ملف العائلة 360.',
  },
  en: {
    eyebrow: 'Parent Accounts',
    back: 'Back to Parents',
    family: 'Family',
    loading: 'Loading parent account…',
    loadError: 'Unable to load parent account',
    tabs: {
      overview: 'Overview & KPIs',
      family: 'Family Profile',
      children: 'Children Profiles',
      subscription: 'Subscription',
      devices: 'Devices',
      support: 'Support',
      security: 'Security',
    },
    status: 'Status',
    plan: 'Plan',
    children: 'Children',
    devices: 'Devices',
    tickets: 'Support',
    noChildren: 'No child profiles registered yet',
    createdAt: 'Created At',
    lastActive: 'Last Active',
    nickname: 'Nickname',
    track: 'Track',
    viewChild: 'View Child',
    viewFamily: 'Family 360',
    openSupport: 'Open Support',
    privacyHint: 'Child profiles are created and managed directly by parents.',
    noDevices: 'No devices registered for this account.',
    noSupport: 'No tickets linked to this account.',
    securityTitle: 'Account & Security Status',
    subscriptionInfo: 'Detailed billing and entitlement records can be managed in Family 360.',
  },
}

function formatMs(value: number | null, locale: 'ar' | 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  return new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function ParentWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const [detail, setDetail] = useState<ParentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [supportTickets, setSupportTickets] = useState<any[]>([])
  const [devices, setDevices] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.parentDetail(id)
      setDetail(res.data)
      try {
        const [ticketsRes, devicesRes] = await Promise.allSettled([
          api.supportTickets({ family_id: id, limit: 10 }),
          api.devices(),
        ])
        if (ticketsRes.status === 'fulfilled') setSupportTickets((ticketsRes.value as any).data ?? [])
        if (devicesRes.status === 'fulfilled')
          setDevices((devicesRes.value as any).data?.filter((d: any) => d.parent_id === id) ?? [])
      } catch {}
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => {
    void load()
  }, [load])

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!detail) return <EmptyState title={text.loadError} description={id} />

  const overview = (
    <div className="page-stack">
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="parents" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.plan}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {planLabels[locale][detail.plan] ?? detail.plan}
            </div>
            <span className="kpi-glass-card__trend">
              {accountStatusLabels[locale][detail.status] ?? detail.status}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
            <Icon name="children" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.children}</span>
            <div className="kpi-glass-card__num">{detail.children.length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#ec4899' }}>
              أطفال تحت الرعاية
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Icon name="devices" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.devices}</span>
            <div className="kpi-glass-card__num">{devices.length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#38bdf8' }}>
              أجهزة متصلة بالعائلة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.tickets}</span>
            <div className="kpi-glass-card__num">{supportTickets.length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              تذاكر استفسارات
            </span>
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 16 }}>معلومات الحساب والتسجيل</h4>
        <dl className="detail-list">
          <div>
            <dt>{text.createdAt}</dt>
            <dd dir="ltr">{formatMs(detail.created_at_ms, locale as 'ar' | 'en')}</dd>
          </div>
          <div>
            <dt>{text.lastActive}</dt>
            <dd dir="ltr">{formatMs(detail.last_event_at_ms, locale as 'ar' | 'en')}</dd>
          </div>
        </dl>
        <p className="readiness-note" style={{ marginTop: 14 }}>
          {text.privacyHint}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link className="button button--primary button--small" to={adminPath(`customers/${detail.parent_id}`)}>
            <Icon name="parents" size={13} />
            <span>{text.viewFamily}</span>
          </Link>
          <Link className="button button--ghost button--small" to={adminPath('support-center')}>
            <Icon name="warning" size={13} />
            <span>{text.openSupport}</span>
          </Link>
        </div>
      </div>
    </div>
  )

  const childrenTab = detail.children.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{text.nickname}</th>
            <th>{text.track}</th>
            <th>{text.status}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {detail.children.map((child) => (
            <tr key={child.child_id}>
              <td>
                <strong>{child.nickname ?? '—'}</strong>
                <br />
                <small className="table-secondary" dir="ltr">
                  {child.child_id}
                </small>
              </td>
              <td>
                {child.age_track ? (
                  <span className={`track-badge track-badge--${child.age_track}`}>
                    {trackLabels[locale][child.age_track]}
                  </span>
                ) : (
                  '—'
                )}
              </td>
              <td>
                <span
                  className={`account-status account-status--${child.status === 'active' ? 'active' : 'archived'}`}
                >
                  {child.status}
                </span>
              </td>
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`children/${child.child_id}`)}>
                  {text.viewChild}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title={text.noChildren} description={text.privacyHint} />
  )

  const familyTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <p className="readiness-note">{text.subscriptionInfo}</p>
        <Link className="button button--primary" to={adminPath(`customers/${detail.parent_id}`)}>
          {text.viewFamily}: {detail.parent_id}
        </Link>
      </div>
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 12px' }}>
          {text.children} ({detail.children.length})
        </h4>
        {childrenTab}
      </div>
    </div>
  )

  const subscriptionTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 10px' }}>الباقة الحالية</h4>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)', marginBottom: 8 }}>
          {planLabels[locale][detail.plan] ?? detail.plan}
        </div>
        <p className="readiness-note">{text.subscriptionInfo}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <Link className="button button--primary button--small" to={adminPath(`customers/${detail.parent_id}`)}>
            {text.viewFamily}
          </Link>
          <Link className="button button--ghost button--small" to={adminPath('billing')}>
            {locale === 'ar' ? 'إدارة الاشتراكات' : 'Billing'}
          </Link>
        </div>
      </div>
    </div>
  )

  const devicesTab = devices.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{text.devices}</th>
            <th>المنصة</th>
            <th>{text.status}</th>
            <th>{text.lastActive}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {devices.map((d: any) => (
            <tr key={d.id}>
              <td>
                <strong>{d.display_name || d.id.slice(0, 12)}</strong>
                <br />
                <small dir="ltr" className="table-secondary">
                  {d.id}
                </small>
              </td>
              <td>{d.platform}</td>
              <td>
                <span className={`account-status account-status--${d.status === 'active' ? 'active' : 'archived'}`}>
                  {d.status}
                </span>
              </td>
              <td dir="ltr">
                {d.last_seen_at ? new Date(Number(d.last_seen_at)).toISOString().slice(0, 16).replace('T', ' ') : '—'}
              </td>
              <td>
                <Link className="button button--ghost button--small" to={adminPath(`devices/${d.id}`)}>
                  تفاصيل الجهاز
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title={text.noDevices} description="لا توجد أجهزة متصلة بهذا الحساب حالياً" />
  )

  const supportTab = supportTickets.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            <th>المرجع</th>
            <th>الموضوع</th>
            <th>الأولوية</th>
            <th>الحالة</th>
          </tr>
        </thead>
        <tbody>
          {supportTickets.map((t: any) => (
            <tr key={t.id}>
              <td dir="ltr">
                <strong>{t.reference}</strong>
              </td>
              <td>{t.subject}</td>
              <td>{t.priority}</td>
              <td>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title={text.noSupport}
      description="لا توجد تذاكر دعم مسجلة"
      action={
        <Link className="button button--primary button--small" to={adminPath('support-center')}>
          {text.openSupport}
        </Link>
      }
    />
  )

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(56, 189, 248, 0.15) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: detail.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: detail.status === 'active' ? '#10b981' : '#f87171',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: detail.status === 'active' ? '#10b981' : '#f87171' }}
              />
              حساب: {accountStatusLabels[locale][detail.status] ?? detail.status}
            </span>
          </div>
          <h1 className="catalog-hero__title" style={{ fontSize: 24 }}>
            {detail.display_name || (detail as any).email || detail.parent_id}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>الباقة: <strong>{planLabels[locale][detail.plan]}</strong></span>
            <span>الأطفال: <strong>{detail.children.length}</strong></span>
            <span>الأجهزة: <strong>{devices.length}</strong></span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('parents')} style={{ backdropFilter: 'blur(8px)' }}>
            <Icon name="chevron-left" size={14} />
            <span>{text.back}</span>
          </Link>
        </div>
      </section>

      {/* 2. Detail tabs */}
      <div style={{ marginTop: 20 }}>
        <DetailTabs
          active={activeTab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: text.tabs.overview, content: overview },
            { key: 'family', label: text.tabs.family, content: familyTab },
            { key: 'children', label: text.tabs.children, badge: detail.children.length, content: childrenTab },
            { key: 'subscription', label: text.tabs.subscription, content: subscriptionTab },
            { key: 'devices', label: text.tabs.devices, badge: devices.length, content: devicesTab },
            { key: 'support', label: text.tabs.support, badge: supportTickets.length, content: supportTab },
          ]}
        />
      </div>
    </div>
  )
}
