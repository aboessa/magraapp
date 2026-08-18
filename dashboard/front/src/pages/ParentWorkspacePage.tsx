import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { accountStatusLabels, planLabels, trackLabels } from '../lib/labels'
import type { ParentDetail } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'أولياء الأمور', back: 'كل أولياء الأمور', family: 'العائلة', loading: 'جارٍ تحميل حساب ولي الأمر…', loadError: 'تعذر تحميل حساب ولي الأمر',
    tabs: { overview: 'نظرة عامة', family: 'العائلة', children: 'الأطفال', subscription: 'الاشتراك', devices: 'الأجهزة', support: 'الدعم', consents: 'الموافقات', security: 'الأمان', audit: 'السجل' },
    status: 'الحالة', plan: 'الباقة', children: 'الأطفال', devices: 'الأجهزة', tickets: 'الدعم',
    noChildren: 'لا ملفات أطفال', createdAt: 'أُنشئ', lastActive: 'آخر نشاط',
    nickname: 'الاسم', track: 'المسار', viewChild: 'فتح ملف الطفل', viewFamily: 'ملف العائلة', openSupport: 'فتح مركز الدعم',
    privacyHint: 'إنشاء ملفات الأطفال يتم من حساب ولي الأمر.',
    noDevices: 'لا أجهزة مسجلة لهذه العائلة حاليًا.', noSupport: 'لا تذاكر مرتبطة بهذا الحساب.',
    securityTitle: 'حالة الحساب والأمان', lastLogin: 'آخر تسجيل دخول', sessions: 'الجلسات', verification: 'التحقق',
    subscriptionInfo: 'تفاصيل الاشتراك والاستحقاق متاحة في ملف العائلة.',
  },
  en: {
    eyebrow: 'Parents', back: 'All parents', family: 'Family', loading: 'Loading parent account…', loadError: 'Unable to load parent account',
    tabs: { overview: 'Overview', family: 'Family', children: 'Children', subscription: 'Subscription', devices: 'Devices', support: 'Support', consents: 'Consents', security: 'Security', audit: 'History' },
    status: 'Status', plan: 'Plan', children: 'Children', devices: 'Devices', tickets: 'Support',
    noChildren: 'No child profiles', createdAt: 'Created', lastActive: 'Last active',
    nickname: 'Name', track: 'Track', viewChild: 'Open child', viewFamily: 'Family file', openSupport: 'Open Support',
    privacyHint: 'Child profiles are created from the parent account.',
    noDevices: 'No devices registered for this family at the moment.', noSupport: 'No tickets linked to this account.',
    securityTitle: 'Account & security', lastLogin: 'Last sign-in', sessions: 'Sessions', verification: 'Verification',
    subscriptionInfo: 'Subscription and entitlement details are in the family file.',
  },
}

function formatMs(value: number | null, locale: 'ar' | 'en') {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—'
  return new Date(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
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
        if (devicesRes.status === 'fulfilled') setDevices((devicesRes.value as any).data?.filter((d: any) => d.parent_id === id) ?? [])
      } catch {}
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  const setTab = (key: string) => { const next = new URLSearchParams(searchParams); next.set('tab', key); setSearchParams(next, { replace: true }) }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!detail) return <EmptyState title={text.loadError} description={id} />

  const overview = (
    <div className="page-stack">
      <div className="stat-grid">
        <div className="stat-card"><span>{text.plan}</span><strong><span className={`plan-badge plan-badge--${detail.plan}`}>{planLabels[locale][detail.plan]}</span></strong></div>
        <div className="stat-card"><span>{text.status}</span><strong><span className={`account-status account-status--${detail.status}`}>{accountStatusLabels[locale][detail.status]}</span></strong></div>
        <div className="stat-card"><span>{text.children}</span><strong>{detail.children.length}</strong></div>
        <div className="stat-card"><span>{text.devices}</span><strong>{devices.length}</strong></div>
      </div>
      <dl className="detail-list">
        <div><dt>{text.createdAt}</dt><dd dir="ltr">{formatMs(detail.created_at_ms, locale as 'ar' | 'en')}</dd></div>
        <div><dt>{text.lastActive}</dt><dd dir="ltr">{formatMs(detail.last_event_at_ms, locale as 'ar' | 'en')}</dd></div>
      </dl>
      <p className="readiness-note">{text.privacyHint}</p>
      <div className="form-actions">
        <Link className="button button--primary button--small" to={adminPath(`customers/${detail.parent_id}`)}>{text.viewFamily}</Link>
        <Link className="button button--ghost button--small" to={adminPath('support-center')}>{text.openSupport}</Link>
      </div>
    </div>
  )

  const childrenTab = detail.children.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>{text.nickname}</th><th>{text.track}</th><th>{text.status}</th><th /></tr></thead>
        <tbody>
          {detail.children.map((child) => (
            <tr key={child.child_id}>
              <td><strong>{child.nickname ?? '—'}</strong><small className="table-secondary" dir="ltr">{child.child_id}</small></td>
              <td>{child.age_track ? <span className={`track-badge track-badge--${child.age_track}`}>{trackLabels[locale][child.age_track]}</span> : '—'}</td>
              <td><span className={`account-status account-status--${child.status === 'active' ? 'active' : 'archived'}`}>{child.status}</span></td>
              <td><Link className="button button--ghost button--small" to={adminPath(`children/${child.child_id}`)}>{text.viewChild}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noChildren} description={text.privacyHint} />

  const familyTab = (
    <div className="page-stack">
      <p className="readiness-note">{text.subscriptionInfo}</p>
      <Link className="button button--primary" to={adminPath(`customers/${detail.parent_id}`)}>{text.viewFamily}: {detail.parent_id}</Link>
      <h4>{text.children} ({detail.children.length})</h4>
      {childrenTab}
    </div>
  )

  const subscriptionTab = (
    <div className="page-stack">
      <div className="stat-card"><span>{text.plan}</span><strong>{detail.plan}</strong></div>
      <p className="readiness-note">{text.subscriptionInfo}</p>
      <Link className="button button--ghost" to={adminPath(`customers/${detail.parent_id}`)}>{text.viewFamily}</Link>
      <Link className="button button--ghost" to={adminPath('billing')}>{locale === 'ar' ? 'الاشتراكات' : 'Subscriptions'}</Link>
    </div>
  )

  const devicesTab = devices.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>{text.devices}</th><th>Platform</th><th>{text.status}</th><th>{text.lastActive}</th><th /></tr></thead>
        <tbody>
          {devices.map((d: any) => (
            <tr key={d.id}><td><Link className="table-primary" to={adminPath(`devices/${d.id}`)}>{d.display_name || d.id.slice(0, 12)}</Link></td><td>{d.platform ?? '—'}</td><td>{d.status}</td><td>{d.last_seen_at ?? '—'}</td><td><Link className="button button--ghost button--small" to={adminPath(`devices/${d.id}`)}>Open</Link></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noDevices} description={text.viewFamily} action={<Link className="button button--ghost button--small" to={adminPath(`customers/${detail.parent_id}`)}>{text.viewFamily}</Link>} />

  const supportTab = supportTickets.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>Reference</th><th>Subject</th><th>Priority</th><th>Status</th><th /></tr></thead>
        <tbody>
          {supportTickets.map((ticket: any) => (
            <tr key={ticket.id}><td dir="ltr">{ticket.reference}</td><td>{ticket.subject}</td><td>{ticket.priority}</td><td>{ticket.status}</td><td><Link className="button button--ghost button--small" to={adminPath('support-center')}>{text.openSupport}</Link></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noSupport} description={text.openSupport} action={<Link className="button button--primary button--small" to={adminPath('support-center')}>{text.openSupport}</Link>} />

  const securityTab = (
    <div className="page-stack">
      <h4>{text.securityTitle}</h4>
      <dl className="detail-list">
        <div><dt>{text.status}</dt><dd><span className={`account-status account-status--${detail.status}`}>{accountStatusLabels[locale][detail.status]}</span></dd></div>
        <div><dt>{text.lastActive}</dt><dd dir="ltr">{formatMs(detail.last_event_at_ms, locale as 'ar' | 'en')}</dd></div>
        <div><dt>{text.plan}</dt><dd>{detail.plan}</dd></div>
      </dl>
      <p className="readiness-note">{locale === 'ar' ? 'الإجراءات الحساسة تتطلب سببًا وتُسجَّل في السجل.' : 'Sensitive actions require a reason and are audited.'}</p>
    </div>
  )

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.eyebrow, to: adminPath('parents') }, { label: detail.display_name || detail.parent_id }]}
        title={detail.display_name || detail.parent_id}
        subtitle={`${text.plan}: ${detail.plan}`}
        meta={<><span>{text.children}: {detail.children.length}</span><span>{text.devices}: {devices.length}</span></>}
        status={<span className={`account-status account-status--${detail.status}`}>{accountStatusLabels[locale][detail.status]}</span>}
        actions={<><Link className="button button--ghost" to={adminPath('parents')}>{text.back}</Link><Link className="button button--primary button--small" to={adminPath(`customers/${detail.parent_id}`)}>{text.viewFamily}</Link></>}
      />
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
          { key: 'security', label: text.tabs.security, content: securityTab },
        ]}
      />
    </div>
  )
}
