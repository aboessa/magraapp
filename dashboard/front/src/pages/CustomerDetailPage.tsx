import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import type { Customer360, FamilyAuthorityState } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'العملاء',
    loading: 'جارٍ تحميل ملف العائلة…',
    loadError: 'تعذر تحميل ملف العائلة',
    plan: 'الباقة',
    effectivePlan: 'الباقة الفعّالة',
    status: 'الحالة',
    children: 'الأطفال',
    devices: 'الأجهزة',
    tickets: 'التذاكر',
    sessions: 'الجلسات النشطة',
    leases: 'التنزيلات النشطة',
    progress: 'سجلات التقدّم',
    liveSource: 'المصدر: FamilyState (حيّ)',
    projectionSource: 'المصدر: إسقاط D1 (متأخّر بطبيعته)',
    tabs: { overview: 'نظرة عامة', children: 'الأطفال', subscription: 'الاشتراك', devices: 'الأجهزة', purchases: 'المدفوعات', tickets: 'الدعم', consents: 'الموافقات', audit: 'السجل' },
    revoke: 'سحب الجهاز',
    revokeDownloads: 'إلغاء التنزيلات',
    resync: 'إعادة مزامنة الإسقاط',
    reason: 'السبب (إلزامي)',
    confirm: 'تنفيذ',
    cancel: 'إلغاء',
    revokeTitle: 'سحب جهاز',
    revokeWarning: 'سيتم إلغاء صلاحية جلسات هذا الجهاز وسيحتاج إلى تسجيل الدخول من جديد. لا يمكن التراجع.',
    downloadsTitle: 'إلغاء التنزيلات',
    downloadsWarning: 'سيتم إنهاء الوصول دون اتصال على الأجهزة المحددة. الأجهزة تبقى مسجلة.',
    resyncTitle: 'إعادة مزامنة الإسقاط',
    resyncWarning: 'يُصدر لقطة من مصدر السلطة إلى الطابور؛ يتحدّث إسقاط D1 عند تسليم الحدث لا فورًا.',
    reference: 'المرجع',
    subject: 'الموضوع',
    priority: 'الأولوية',
    openTicket: 'فتح في الدعم',
    noTickets: 'لا تذاكر لهذه العائلة',
    noChildren: 'لا ملفات أطفال',
    noDevices: 'لا أجهزة',
    noPurchases: 'لا سجل مدفوعات',
    noBilling: 'لا سجل استحقاق',
    noAudit: 'لا سجل عمليات',
    noConsents: 'لا موافقات مسجَّلة',
    action: 'العملية',
    actor: 'الفاعل',
    date: 'التاريخ',
    nickname: 'الاسم',
    track: 'المسار',
    privacyNote: 'لا يعرض هذا الملف تاريخ مشاهدة أي طفل ولا مفاتيح شراء: التقدّم عدد فقط.',
    back: 'كل العائلات',
    device: 'الجهاز',
    platform: 'المنصّة',
    lastSeen: 'آخر ظهور',
    product: 'المنتج',
    entitlementStatus: 'حالة الاستحقاق',
    expires: 'ينتهي',
    entitlements: 'الاستحقاقات',
    familyHeader: 'ملف العائلة',
    degraded: 'تعذر تحميل بعض البيانات',
    retry: 'إعادة المحاولة',
    unlinkFamily: 'العائلة',
    viewFamily: 'عرض العائلة',
    viewParent: 'ولي الأمر',
    viewChild: 'الطفل',
    viewDevice: 'الجهاز',
    supportOpen: 'تذاكر مفتوحة',
  },
  en: {
    eyebrow: 'Customers',
    loading: 'Loading the family file…',
    loadError: 'Unable to load the family file',
    plan: 'Plan',
    effectivePlan: 'Effective plan',
    status: 'Status',
    children: 'Children',
    devices: 'Devices',
    tickets: 'Tickets',
    sessions: 'Active sessions',
    leases: 'Active downloads',
    progress: 'Progress records',
    liveSource: 'Source: FamilyState (live)',
    projectionSource: 'Source: D1 projection (behind by design)',
    tabs: { overview: 'Overview', children: 'Children', subscription: 'Subscription', devices: 'Devices', purchases: 'Payments', tickets: 'Support', consents: 'Consents', audit: 'History' },
    revoke: 'Revoke device',
    revokeDownloads: 'Revoke downloads',
    resync: 'Resync projection',
    reason: 'Reason (required)',
    confirm: 'Confirm',
    cancel: 'Cancel',
    revokeTitle: 'Revoke device',
    revokeWarning: 'This will sign out all sessions on this device. The device will need to sign in again. This cannot be undone.',
    downloadsTitle: 'Revoke downloads',
    downloadsWarning: 'This ends offline access on the selected devices. Devices remain registered.',
    resyncTitle: 'Resync the projection',
    resyncWarning: 'Emits a snapshot from the authority onto the queue; the D1 projection updates when the event is delivered, not immediately.',
    reference: 'Reference',
    subject: 'Subject',
    priority: 'Priority',
    openTicket: 'Open in Support',
    noTickets: 'No tickets for this family',
    noChildren: 'No child profiles',
    noDevices: 'No devices',
    noPurchases: 'No payment records',
    noBilling: 'No entitlement history',
    noAudit: 'No audit history',
    noConsents: 'No recorded consents',
    action: 'Action',
    actor: 'Actor',
    date: 'Date',
    nickname: 'Name',
    track: 'Track',
    privacyNote: 'This workspace shows no child viewing history and no purchase keys: progress is a count only.',
    back: 'All families',
    device: 'Device',
    platform: 'Platform',
    lastSeen: 'Last seen',
    product: 'Product',
    entitlementStatus: 'Entitlement status',
    expires: 'Expires',
    entitlements: 'Entitlements',
    familyHeader: 'Family file',
    degraded: 'Some data could not be loaded',
    retry: 'Retry',
    unlinkFamily: 'Family',
    viewFamily: 'View family',
    viewParent: 'Parent',
    viewChild: 'Child',
    viewDevice: 'Device',
    supportOpen: 'Open tickets',
  },
}

type PendingAction = { kind: 'revoke'; deviceId: string } | { kind: 'downloads'; deviceId?: string } | { kind: 'resync' }

const isAvailable = (value: Customer360['authority']): value is FamilyAuthorityState => (value as { available?: boolean }).available !== false

export function CustomerDetailPage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const [data, setData] = useState<Customer360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.customer360(id)
      setData(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError])

  useEffect(() => { void load() }, [load])

  async function runAction() {
    if (!pending || !reason.trim()) return
    setSaving(true)
    setActionError('')
    try {
      if (pending.kind === 'revoke') await api.revokeFamilyDevice(id, pending.deviceId, reason.trim())
      else if (pending.kind === 'downloads') await api.revokeFamilyDownloads(id, reason.trim(), pending.deviceId)
      else { const response = await api.resyncFamily(id, reason.trim()); setNotice(response.data.note) }
      setPending(null)
      setReason('')
      await load()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <EmptyState title={text.loadError} description={id} />

  const authority = data.authority
  const live = isAvailable(authority) ? authority : null
  const authorityUnavailable = !live

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  const overview = (
    <div className="page-stack">
      {authorityUnavailable && <p className="inline-alert inline-alert--error" role="alert">{text.degraded} — {(authority as { reason?: string }).reason ?? ''} <button className="button button--ghost button--small" type="button" onClick={() => void load()}>{text.retry}</button></p>}
      <div className="stat-grid">
        <div className="stat-card"><span>{text.plan}</span><strong>{data.family.plan}</strong></div>
        <div className="stat-card"><span>{text.effectivePlan}</span><strong>{live ? live.effective_plan : '—'}</strong></div>
        <div className="stat-card"><span>{text.status}</span><strong>{data.family.status}</strong></div>
        <div className="stat-card"><span>{text.children}</span><strong>{data.children.length}</strong></div>
        <div className="stat-card"><span>{text.devices}</span><strong>{live ? live.devices.length : data.devices_projection.length}</strong></div>
        <div className="stat-card"><span>{text.tickets}</span><strong>{data.tickets.length}</strong></div>
        <div className="stat-card"><span>{text.sessions}</span><strong>{live ? live.active_sessions : '—'}</strong></div>
        <div className="stat-card"><span>{text.leases}</span><strong>{live ? live.active_leases : '—'}</strong></div>
      </div>
      {live && <p className="readiness-note">{text.liveSource}</p>}
      <p className="readiness-note">{text.privacyNote}</p>
      <div className="form-actions">
        <button className="button button--ghost" type="button" onClick={() => { setPending({ kind: 'resync' }); setReason(''); setActionError('') }}>{text.resync}</button>
        <button className="button button--ghost" type="button" onClick={() => { setPending({ kind: 'downloads' }); setReason(''); setActionError('') }}>{text.revokeDownloads}</button>
      </div>
      {notice && <p className="inline-alert inline-alert--success">{notice}</p>}
      <div className="panel panel--compact">
        <h4 style={{ margin: 0, fontSize: 13 }}>{text.familyHeader}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <Link className="button button--ghost button--small" to={adminPath(`parents/${data.family.parent_id}`)}>{text.viewParent}</Link>
          <Link className="button button--ghost button--small" to={adminPath(`support-center`)}>{text.supportOpen}: {data.tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length}</Link>
        </div>
      </div>
    </div>
  )

  const childrenTab = data.children.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>{text.nickname}</th><th>{text.track}</th><th>{text.status}</th><th /></tr></thead>
        <tbody>
          {data.children.map((child) => (
            <tr key={child.child_id}>
              <td><span className="table-primary">{child.nickname ?? '—'}</span></td>
              <td>{child.age_track ? <span className={`track-badge track-badge--${child.age_track}`}>{child.age_track}</span> : '—'}</td>
              <td>{child.status}</td>
              <td><Link className="button button--ghost button--small" to={adminPath(`children/${child.child_id}`)}>{text.viewChild}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noChildren} description={text.privacyNote} />

  const subscriptionTab = (
    <div className="page-stack">
      <p className="readiness-note">{live ? text.liveSource : text.degraded}</p>
      {live && live.entitlements.length ? (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead><tr><th>{text.plan}</th><th>{text.status}</th><th>{text.product}</th><th>{text.expires}</th></tr></thead>
            <tbody>
              {live.entitlements.map((entry, index) => (
                <tr key={`${entry.plan}-${index}`}>
                  <td>{entry.plan}</td><td>{entry.status}</td><td dir="ltr">{entry.source}</td>
                  <td dir="ltr">{entry.expires_at ? new Date(entry.expires_at).toISOString().slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="readiness-note">{text.noBilling}</p>}
      <h4>{text.entitlements} — {text.projectionSource}</h4>
      {data.billing.length ? (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead><tr><th>{text.product}</th><th>{text.plan}</th><th>{text.entitlementStatus}</th><th>{text.date}</th></tr></thead>
            <tbody>
              {data.billing.map((entry, index) => (
                <tr key={`${entry.product_id}-${index}`}>
                  <td dir="ltr">{entry.product_id}</td><td>{entry.plan}</td><td>{entry.entitlement_status}</td>
                  <td dir="ltr">{entry.created_at.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="readiness-note">{text.noBilling}</p>}
      <div style={{ marginTop: 8 }}>
        <Link className="button button--ghost button--small" to={adminPath('billing')}>{text.product} → {text.entitlements}</Link>
      </div>
    </div>
  )

  const devicesTab = (
    <div className="page-stack">
      {live ? <p className="readiness-note">{text.liveSource}</p> : <p className="inline-alert inline-alert--warn">{text.degraded}</p>}
      {live && live.devices.length ? (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead><tr><th>{text.device}</th><th>{text.platform}</th><th>{text.status}</th><th>{text.lastSeen}</th><th /></tr></thead>
            <tbody>
              {live.devices.map((device) => (
                <tr key={device.id}>
                  <td><Link className="table-primary" to={adminPath(`devices/${device.id}`)}>{device.display_name || device.id.slice(0, 12)}</Link><small className="table-secondary" dir="ltr">{device.id.slice(0, 14)}…</small></td>
                  <td>{device.platform}</td>
                  <td><span className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}>{device.status}</span></td>
                  <td dir="ltr">{new Date(Number(device.last_seen_at)).toISOString().slice(0, 16).replace('T', ' ')}</td>
                  <td>
                    <div className="table-actions">
                      <button className="button button--ghost button--small" type="button" disabled={device.status !== 'active'} onClick={() => { setPending({ kind: 'revoke', deviceId: device.id }); setReason(''); setActionError('') }}>{text.revoke}</button>
                      <button className="button button--ghost button--small" type="button" onClick={() => { setPending({ kind: 'downloads', deviceId: device.id }); setReason(''); setActionError('') }}>{text.revokeDownloads}</button>
                      <Link className="button button--ghost button--small" to={adminPath(`devices/${device.id}`)}>{text.viewDevice}</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="readiness-note">{text.noDevices}</p>}
      {data.devices_projection.length > 0 && (
        <>
          <h4 style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{text.projectionSource}</h4>
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.device}</th><th>{text.platform}</th><th>{text.status}</th><th>{text.lastSeen}</th></tr></thead>
              <tbody>
                {data.devices_projection.map((device) => (
                  <tr key={device.id}><td><Link className="table-primary" to={adminPath(`devices/${device.id}`)}>{device.display_name || device.id.slice(0, 12)}</Link></td><td>{device.platform}</td><td>{device.status}</td><td dir="ltr">{String(device.last_seen_at).slice(0, 16).replace('T', ' ')}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )

  const purchasesTab = data.purchases.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>{text.product}</th><th>{text.status}</th><th>{text.date}</th><th>{text.expires}</th></tr></thead>
        <tbody>
          {data.purchases.map((entry, index) => (
            <tr key={`${entry.product_id}-${index}`}><td dir="ltr">{entry.product_id}</td><td>{entry.purchase_state}</td><td dir="ltr">{entry.purchased_at?.slice(0, 10) ?? '—'}</td><td dir="ltr">{entry.expires_at?.slice(0, 10) ?? '—'}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noPurchases} description={text.product} />

  const ticketsTab = data.tickets.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>{text.reference}</th><th>{text.subject}</th><th>{text.priority}</th><th>{text.status}</th><th /></tr></thead>
        <tbody>
          {data.tickets.map((ticket) => (
            <tr key={ticket.id}><td dir="ltr"><span className="table-primary">{ticket.reference}</span></td><td>{ticket.subject}</td><td>{ticket.priority}</td><td>{ticket.status}</td><td><Link className="button button--ghost button--small" to={adminPath(`support-center`)}>{text.openTicket}</Link></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noTickets} description={text.tabs.tickets} action={<Link className="button button--primary button--small" to={adminPath('support-center')}>{text.openTicket}</Link>} />

  const consents = Array.isArray(data.consents) ? data.consents : null
  const consentsTab = consents === null ? <p className="inline-alert inline-alert--error">{(data.consents as { reason?: string }).reason}</p>
    : consents.length ? <ul className="readiness-list">{consents.map((entry, index) => <li key={index} className="readiness-item readiness-item--not_applicable"><p className="readiness-item__detail" dir="ltr">{JSON.stringify(entry)}</p></li>)}</ul>
    : <EmptyState title={text.noConsents} description={text.privacyNote} />

  const auditTab = data.audit.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead><tr><th>{text.action}</th><th>{text.actor}</th><th>{text.date}</th></tr></thead>
        <tbody>
          {data.audit.map((entry, index) => (
            <tr key={`${entry.action}-${index}`}><td>{entry.action} <small dir="ltr">{entry.entity_type}</small></td><td dir="ltr">{entry.actor_id}</td><td dir="ltr">{entry.created_at.slice(0, 16).replace('T', ' ')}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : <EmptyState title={text.noAudit} description={text.tabs.audit} />

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.eyebrow, to: adminPath('customers') }, { label: data.family.parent_id }]}
        title={data.family.parent_id}
        subtitle={`${text.plan}: ${data.family.plan}`}
        meta={<><span>{text.children}: {data.children.length}</span><span>{text.devices}: {live ? live.devices.length : data.devices_projection.length}</span><span>{text.tickets}: {data.tickets.length}</span></>}
        status={<span className={`account-status account-status--${data.family.status === 'active' ? 'active' : 'archived'}`}>{data.family.status}</span>}
        actions={<Link className="button button--ghost" to={adminPath('customers')}>{text.back}</Link>}
      />
      <DetailTabs
        active={activeTab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: text.tabs.overview, content: overview },
          { key: 'children', label: text.tabs.children, badge: data.children.length, content: childrenTab },
          { key: 'subscription', label: text.tabs.subscription, content: subscriptionTab },
          { key: 'devices', label: text.tabs.devices, badge: live?.devices.length, content: devicesTab },
          { key: 'purchases', label: text.tabs.purchases, badge: data.purchases.length, content: purchasesTab },
          { key: 'tickets', label: text.tabs.tickets, badge: data.tickets.length, content: ticketsTab },
          { key: 'consents', label: text.tabs.consents, content: consentsTab },
          { key: 'audit', label: text.tabs.audit, badge: data.audit.length, content: auditTab },
        ]}
      />
      {pending && (
        <Modal open title={pending.kind === 'revoke' ? text.revokeTitle : pending.kind === 'downloads' ? text.downloadsTitle : text.resyncTitle} onClose={() => setPending(null)}>
          <div className="entity-form">
            <p className="inline-alert inline-alert--error">{pending.kind === 'revoke' ? text.revokeWarning : pending.kind === 'downloads' ? text.downloadsWarning : text.resyncWarning}</p>
            {actionError && <p className="inline-alert inline-alert--error" role="alert">{actionError}</p>}
            <label className="field"><span>{text.reason}</span><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} autoFocus /></label>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setPending(null)}>{text.cancel}</button>
              <button className="button button--primary" type="button" disabled={!reason.trim() || saving} onClick={() => void runAction()}>{text.confirm}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
