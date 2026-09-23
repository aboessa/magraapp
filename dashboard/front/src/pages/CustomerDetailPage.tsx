import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'
import type { Customer360, FamilyAuthorityState } from '../types/api'

const copy = {
  ar: {
    eyebrow: 'إدارة العملاء والاشتراكات',
    loading: 'جارٍ تحميل ملف العائلة 360…',
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
    tabs: {
      overview: 'نظرة عامة ومقاييس',
      children: 'ملفات الأطفال',
      subscription: 'الاشتراك والاستحقاق',
      devices: 'الأجهزة الموثقة',
      purchases: 'المدفوعات والمشتريات',
      tickets: 'الدعم الفني',
      consents: 'الموافقات والخصوصية',
      audit: 'سجل تدقيق اللوحة',
      familyAudit: 'سجل عمليات الأسرة',
    },
    revoke: 'سحب الجهاز',
    revokeDownloads: 'إلغاء التنزيلات',
    resync: 'إعادة مزامنة الإسقاط',
    reason: 'السبب (إلزامي للتدقيق)',
    confirm: 'تنفيذ',
    cancel: 'إلغاء',
    revokeTitle: 'سحب جهاز العائلة',
    revokeWarning: 'سيتم إلغاء صلاحية كافة جلسات هذا الجهاز وسيحتاج لإعادة تسجيل الدخول مجددًا. لا يمكن التراجع.',
    downloadsTitle: 'إلغاء تنزيلات الجهاز دون اتصال',
    downloadsWarning: 'سيتم إنهاء رخصة الوصول دون اتصال (Offline Leases) على الجهاز المختار مع بقائه مسجلاً.',
    resyncTitle: 'إعادة مزامنة إسقاط بيانات الأسرة',
    resyncWarning: 'يُصدر لقطة من مصدر السلطة إلى الطابور؛ يتحدّث إسقاط D1 عند تسليم الحدث لا فورًا.',
    reference: 'المرجع',
    subject: 'الموضوع',
    priority: 'الأولوية',
    openTicket: 'فتح في مركز الدعم',
    noTickets: 'لا توجد تذاكر دعم مسجلة لهذه العائلة',
    noChildren: 'لا توجد ملفات أطفال مضافة',
    noDevices: 'لا توجد أجهزة مسجلة',
    noPurchases: 'لا يوجد سجل مشتريات',
    noBilling: 'لا يوجد سجل استحقاق',
    noAudit: 'لا يوجد سجل تدقيق',
    noFamilyAudit: 'لا توجد عمليات مسجَّلة على هذه الأسرة',
    familyAuditNote: 'سجل الأنشطة الحقيقية: الجلسات، الأجهزة، وتراخيص التشغيل. مشفر وبلا كشف لخصوصية الطفل.',
    entity: 'الكيان',
    actorKind: { parent: 'وليّ الأمر', operator: 'المشرف', system: 'النظام الآلي' } as Record<string, string>,
    noConsents: 'لا توجد موافقات خصوصية مسجَّلة',
    action: 'العملية',
    actor: 'الفاعل',
    date: 'التاريخ',
    nickname: 'اسم الطفل المستعار',
    track: 'المسار العمري',
    privacyNote: 'لا يعرض هذا الملف تاريخ مشاهدة أي طفل ولا مفاتيح شراء: التقدّم عدد فقط.',
    back: 'العودة لقائمة العائلات',
    device: 'الجهاز',
    platform: 'نظام التشغيل',
    lastSeen: 'آخر ظهور',
    product: 'المنتج',
    entitlementStatus: 'حالة الاستحقاق',
    expires: 'تاريخ الانتهاء',
    entitlements: 'الاستحقاقات الفعالة',
    familyHeader: 'بيانات حساب العائلة',
    degraded: 'تعذر الاتصال بمحرك FamilyState الحي',
    retry: 'إعادة المحاولة',
    viewParent: 'ملف ولي الأمر',
    viewChild: 'ملف الطفل',
    viewDevice: 'تفاصيل الجهاز',
    supportOpen: 'تذاكر الدعم المفتوحة',
  },
  en: {
    eyebrow: 'Customer Management',
    loading: 'Loading Family 360 Profile…',
    loadError: 'Unable to load family profile',
    plan: 'Plan',
    effectivePlan: 'Effective Plan',
    status: 'Status',
    children: 'Children',
    devices: 'Devices',
    tickets: 'Tickets',
    sessions: 'Active Sessions',
    leases: 'Active Downloads',
    progress: 'Progress Records',
    liveSource: 'Source: FamilyState (Live Authority)',
    projectionSource: 'Source: D1 Projection (Eventual)',
    tabs: {
      overview: 'Overview & KPIs',
      children: 'Children Profiles',
      subscription: 'Subscription & Entitlements',
      devices: 'Authorized Devices',
      purchases: 'Payments',
      tickets: 'Support Tickets',
      consents: 'Consents & Privacy',
      audit: 'Admin Audit Log',
      familyAudit: 'Family Activity Log',
    },
    revoke: 'Revoke Device',
    revokeDownloads: 'Revoke Downloads',
    resync: 'Resync Projection',
    reason: 'Reason (Required for audit)',
    confirm: 'Confirm Action',
    cancel: 'Cancel',
    revokeTitle: 'Revoke Family Device',
    revokeWarning: 'This will terminate all active sessions on this device. Sign-in required again.',
    downloadsTitle: 'Revoke Offline Leases',
    downloadsWarning: 'Ends offline content playback permissions on the selected device.',
    resyncTitle: 'Resync D1 Projection',
    resyncWarning: 'Emits a snapshot from FamilyState authority queue to resynchronize the database.',
    reference: 'Reference',
    subject: 'Subject',
    priority: 'Priority',
    openTicket: 'Open in Support Center',
    noTickets: 'No tickets for this family',
    noChildren: 'No child profiles registered',
    noDevices: 'No registered devices',
    noPurchases: 'No purchase records found',
    noBilling: 'No billing history',
    noAudit: 'No audit logs',
    noFamilyAudit: 'No family activity recorded',
    familyAuditNote: 'Direct system operations: sessions, tokens, device registrations and policy changes.',
    entity: 'Entity',
    actorKind: { parent: 'Parent', operator: 'Operator', system: 'System' } as Record<string, string>,
    noConsents: 'No recorded consents',
    action: 'Action',
    actor: 'Actor',
    date: 'Date',
    nickname: 'Nickname',
    track: 'Age Track',
    privacyNote: 'Privacy compliance: Child viewing history is anonymized.',
    back: 'All Families',
    device: 'Device',
    platform: 'Platform',
    lastSeen: 'Last Seen',
    product: 'Product',
    entitlementStatus: 'Entitlement Status',
    expires: 'Expires',
    entitlements: 'Entitlements',
    familyHeader: 'Family Account Information',
    degraded: 'FamilyState live connection degraded',
    retry: 'Retry',
    viewParent: 'Parent Profile',
    viewChild: 'Child Profile',
    viewDevice: 'Device Details',
    supportOpen: 'Open Support Tickets',
  },
}

type PendingAction = { kind: 'revoke'; deviceId: string } | { kind: 'downloads'; deviceId?: string } | { kind: 'resync' }
const isAvailable = (value: Customer360['authority']): value is FamilyAuthorityState =>
  (value as { available?: boolean }).available !== false

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

  useEffect(() => {
    void load()
  }, [load])

  async function runAction() {
    if (!pending || !reason.trim()) return
    setSaving(true)
    setActionError('')
    try {
      if (pending.kind === 'revoke') await api.revokeFamilyDevice(id, pending.deviceId, reason.trim())
      else if (pending.kind === 'downloads')
        await api.revokeFamilyDownloads(id, reason.trim(), pending.deviceId)
      else {
        const response = await api.resyncFamily(id, reason.trim())
        setNotice(response.data.note)
      }
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
      {authorityUnavailable && (
        <p className="inline-alert inline-alert--error" role="alert">
          {text.degraded} — {(authority as { reason?: string }).reason ?? ''}{' '}
          <button className="button button--ghost button--small" type="button" onClick={() => void load()}>
            {text.retry}
          </button>
        </p>
      )}

      {/* Bento Metric Cards */}
      <div className="hero-kpis">
        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Icon name="parents" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.effectivePlan}</span>
            <div className="kpi-glass-card__num" style={{ fontSize: 18 }}>
              {live ? live.effective_plan : data.family.plan}
            </div>
            <span className="kpi-glass-card__trend">
              الحالة: {data.family.status}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899' }}>
            <Icon name="children" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.children}</span>
            <div className="kpi-glass-card__num">{data.children.length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#ec4899' }}>
              ملفات أطفال نشطة
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Icon name="devices" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.devices}</span>
            <div className="kpi-glass-card__num">{live ? live.devices.length : '—'}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#38bdf8' }}>
              {live ? `${live.active_sessions} جلسة نشطة` : 'غير متوفر'}
            </span>
          </div>
        </div>

        <div className="kpi-glass-card">
          <div className="kpi-glass-card__icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Icon name="warning" size={24} />
          </div>
          <div className="kpi-glass-card__info">
            <span className="kpi-glass-card__label">{text.tickets}</span>
            <div className="kpi-glass-card__num">{data.tickets.length}</div>
            <span className="kpi-glass-card__trend" style={{ color: '#fbbf24' }}>
              تذاكر استفسارات الدعم
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderRadius: 16,
          background: 'var(--surface-2)',
          border: '1px solid var(--cs-glass-border)',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            {live ? text.liveSource : text.projectionSource}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{text.privacyNote}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => {
              setPending({ kind: 'resync' })
              setReason('')
              setActionError('')
            }}
          >
            <Icon name="refresh" size={13} />
            <span>{text.resync}</span>
          </button>
          <button
            className="button button--ghost button--small"
            type="button"
            onClick={() => {
              setPending({ kind: 'downloads' })
              setReason('')
              setActionError('')
            }}
          >
            <span>{text.revokeDownloads}</span>
          </button>
        </div>
      </div>

      {notice && <p className="inline-alert inline-alert--success">{notice}</p>}

      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800 }}>{text.familyHeader}</h4>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="button button--ghost button--small" to={adminPath(`parents/${data.family.parent_id}`)}>
            <Icon name="parents" size={13} />
            <span>{text.viewParent}</span>
          </Link>
          <Link className="button button--ghost button--small" to={adminPath('support-center')}>
            <Icon name="warning" size={13} />
            <span>
              {text.supportOpen}:{' '}
              {data.tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )

  const childrenTab = data.children.length ? (
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
          {data.children.map((child) => (
            <tr key={child.child_id}>
              <td>
                <span className="table-primary">{child.nickname ?? '—'}</span>
              </td>
              <td>
                {child.age_track ? (
                  <span className={`track-badge track-badge--${child.age_track}`}>{child.age_track}</span>
                ) : (
                  '—'
                )}
              </td>
              <td>{child.status}</td>
              <td>
                <Link
                  className="button button--ghost button--small"
                  to={adminPath(`children/${child.child_id}`)}
                >
                  {text.viewChild}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title={text.noChildren} description={text.privacyNote} />
  )

  const subscriptionTab = (
    <div className="page-stack">
      <p className="readiness-note">{live ? text.liveSource : text.degraded}</p>
      {live && live.entitlements.length ? (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.plan}</th>
                <th>{text.status}</th>
                <th>{text.product}</th>
                <th>{text.expires}</th>
              </tr>
            </thead>
            <tbody>
              {live.entitlements.map((entry, index) => (
                <tr key={`${entry.plan}-${index}`}>
                  <td>{entry.plan}</td>
                  <td>{entry.status}</td>
                  <td dir="ltr">{entry.source}</td>
                  <td dir="ltr">
                    {entry.expires_at ? new Date(entry.expires_at).toISOString().slice(0, 10) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="readiness-note">{text.noBilling}</p>
      )}
      <h4>
        {text.entitlements} — {text.projectionSource}
      </h4>
      {data.billing.length ? (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.product}</th>
                <th>{text.plan}</th>
                <th>{text.entitlementStatus}</th>
                <th>{text.date}</th>
              </tr>
            </thead>
            <tbody>
              {data.billing.map((entry, index) => (
                <tr key={`${entry.product_id}-${index}`}>
                  <td dir="ltr">{entry.product_id}</td>
                  <td>{entry.plan}</td>
                  <td>{entry.entitlement_status}</td>
                  <td dir="ltr">{entry.created_at.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="readiness-note">{text.noBilling}</p>
      )}
    </div>
  )

  const devicesTab = (
    <div className="page-stack">
      {live ? (
        <p className="readiness-note">{text.liveSource}</p>
      ) : (
        <p className="inline-alert inline-alert--warn">{text.degraded}</p>
      )}
      {live && live.devices.length ? (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.device}</th>
                <th>{text.platform}</th>
                <th>{text.status}</th>
                <th>{text.lastSeen}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {live.devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    <Link className="table-primary" to={adminPath(`devices/${device.id}`)}>
                      {device.display_name || device.id.slice(0, 12)}
                    </Link>
                    <small className="table-secondary" dir="ltr">
                      {device.id.slice(0, 14)}…
                    </small>
                  </td>
                  <td>{device.platform}</td>
                  <td>
                    <span
                      className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}
                    >
                      {device.status}
                    </span>
                  </td>
                  <td dir="ltr">
                    {new Date(Number(device.last_seen_at)).toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        disabled={device.status !== 'active'}
                        onClick={() => {
                          setPending({ kind: 'revoke', deviceId: device.id })
                          setReason('')
                          setActionError('')
                        }}
                      >
                        {text.revoke}
                      </button>
                      <button
                        className="button button--ghost button--small"
                        type="button"
                        onClick={() => {
                          setPending({ kind: 'downloads', deviceId: device.id })
                          setReason('')
                          setActionError('')
                        }}
                      >
                        {text.revokeDownloads}
                      </button>
                      <Link className="button button--ghost button--small" to={adminPath(`devices/${device.id}`)}>
                        {text.viewDevice}
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="readiness-note">{text.noDevices}</p>
      )}
      <p className="readiness-note">
        {data.devices_projection.available === false
          ? `${text.projectionSource}: ${data.devices_projection.reason}`
          : text.projectionSource}
      </p>
    </div>
  )

  const purchasesTab =
    data.purchases.available === false ? (
      <EmptyState title={text.noPurchases} description={data.purchases.reason} />
    ) : (
      <EmptyState title={text.noPurchases} description={text.product} />
    )

  const ticketsTab = data.tickets.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{text.reference}</th>
            <th>{text.subject}</th>
            <th>{text.priority}</th>
            <th>{text.status}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.tickets.map((ticket) => (
            <tr key={ticket.id}>
              <td dir="ltr">
                <span className="table-primary">{ticket.reference}</span>
              </td>
              <td>{ticket.subject}</td>
              <td>{ticket.priority}</td>
              <td>{ticket.status}</td>
              <td>
                <Link className="button button--ghost button--small" to={adminPath('support-center')}>
                  {text.openTicket}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState
      title={text.noTickets}
      description={text.tabs.tickets}
      action={
        <Link className="button button--primary button--small" to={adminPath('support-center')}>
          {text.openTicket}
        </Link>
      }
    />
  )

  const consents = Array.isArray(data.consents) ? data.consents : null
  const consentsTab =
    consents === null ? (
      <p className="inline-alert inline-alert--error">{(data.consents as { reason?: string }).reason}</p>
    ) : consents.length ? (
      <ul className="readiness-list">
        {consents.map((entry, index) => (
          <li key={index} className="readiness-item readiness-item--not_applicable">
            <p className="readiness-item__detail" dir="ltr">
              {JSON.stringify(entry)}
            </p>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState title={text.noConsents} description={text.privacyNote} />
    )

  const auditTab = data.audit.length ? (
    <div className="table-scroll" tabIndex={0}>
      <table className="data-table">
        <thead>
          <tr>
            <th>{text.action}</th>
            <th>{text.actor}</th>
            <th>{text.date}</th>
          </tr>
        </thead>
        <tbody>
          {data.audit.map((entry, index) => (
            <tr key={`${entry.action}-${index}`}>
              <td>
                {entry.action} <small dir="ltr">{entry.entity_type}</small>
              </td>
              <td dir="ltr">{entry.actor_id}</td>
              <td dir="ltr">{entry.created_at.slice(0, 16).replace('T', ' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <EmptyState title={text.noAudit} description={text.tabs.audit} />
  )

  const familyAudit = data.family_audit ?? []
  const familyAuditTab = familyAudit.length ? (
    <div className="page-stack">
      <p className="readiness-note">{text.familyAuditNote}</p>
      <div className="table-scroll" tabIndex={0}>
        <table className="data-table">
          <thead>
            <tr>
              <th>{text.action}</th>
              <th>{text.actor}</th>
              <th>{text.entity}</th>
              <th>{text.date}</th>
            </tr>
          </thead>
          <tbody>
            {familyAudit.map((entry, index) => (
              <tr key={`${entry.action}-${entry.occurred_at_ms}-${index}`}>
                <td dir="ltr">{entry.action}</td>
                <td>
                  {text.actorKind[entry.actor_kind] ?? entry.actor_kind}
                  {entry.actor_kind === 'operator' && entry.actor_id ? (
                    <small dir="ltr"> {entry.actor_id}</small>
                  ) : null}
                </td>
                <td>
                  <small dir="ltr">
                    {entry.entity_type}
                    {entry.entity_id ? ` · ${entry.entity_id.slice(0, 12)}` : ''}
                  </small>
                </td>
                <td dir="ltr">
                  {new Date(entry.occurred_at_ms).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ) : (
    <EmptyState title={text.noFamilyAudit} description={text.familyAuditNote} />
  )

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, rgba(168, 85, 247, 0.15) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: data.family.status === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: data.family.status === 'active' ? '#10b981' : '#f87171',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: data.family.status === 'active' ? '#10b981' : '#f87171' }}
              />
              حساب العائلة: {data.family.status}
            </span>
          </div>
          <h1 className="catalog-hero__title" style={{ fontSize: 24 }} dir="ltr">
            {data.family.parent_id}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>الباقة: <strong>{data.family.plan}</strong></span>
            <span>الأطفال: <strong>{data.children.length}</strong></span>
            <span>الأجهزة: <strong>{live ? live.devices.length : '—'}</strong></span>
            <span>التذاكر: <strong>{data.tickets.length}</strong></span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('customers')} style={{ backdropFilter: 'blur(8px)' }}>
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
            { key: 'children', label: text.tabs.children, badge: data.children.length, content: childrenTab },
            { key: 'subscription', label: text.tabs.subscription, content: subscriptionTab },
            { key: 'devices', label: text.tabs.devices, badge: live?.devices.length, content: devicesTab },
            { key: 'purchases', label: text.tabs.purchases, content: purchasesTab },
            { key: 'tickets', label: text.tabs.tickets, badge: data.tickets.length, content: ticketsTab },
            { key: 'consents', label: text.tabs.consents, content: consentsTab },
            { key: 'audit', label: text.tabs.audit, badge: data.audit.length, content: auditTab },
            { key: 'family-audit', label: text.tabs.familyAudit, badge: familyAudit.length, content: familyAuditTab },
          ]}
        />
      </div>

      {/* Modal Actions */}
      {pending && (
        <Modal
          open
          title={
            pending.kind === 'revoke'
              ? text.revokeTitle
              : pending.kind === 'downloads'
              ? text.downloadsTitle
              : text.resyncTitle
          }
          onClose={() => setPending(null)}
        >
          <div className="entity-form">
            <p className="inline-alert inline-alert--error">
              {pending.kind === 'revoke'
                ? text.revokeWarning
                : pending.kind === 'downloads'
                ? text.downloadsWarning
                : text.resyncWarning}
            </p>
            {actionError && (
              <p className="inline-alert inline-alert--error" role="alert">
                {actionError}
              </p>
            )}
            <label className="field">
              <span>{text.reason}</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                autoFocus
                placeholder="اكتب سبب هذا الإجراء الإداري للتوثيق في سجل التدقيق..."
              />
            </label>
            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setPending(null)}>
                {text.cancel}
              </button>
              <button
                className="button button--primary"
                type="button"
                disabled={!reason.trim() || saving}
                onClick={() => void runAction()}
              >
                {saving ? 'جارٍ التنفيذ...' : text.confirm}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
