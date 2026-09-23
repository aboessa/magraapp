import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { Icon } from '../components/Icon'

const copy = {
  ar: {
    eyebrow: 'إدارة الأجهزة والجلسات',
    back: 'العودة لمركز الأجهزة',
    loading: 'جارٍ تحميل بيانات الجهاز…',
    loadError: 'تعذر تحميل بيانات الجهاز',
    tabs: {
      overview: 'نظرة عامة ومقاييس',
      sessions: 'الجلسات النشطة',
      downloads: 'التنزيلات والرخص',
      security: 'الأمان وإجراءات السحب',
    },
    device: 'الجهاز',
    family: 'العائلة',
    parent: 'ولي الأمر',
    platform: 'المنصّة',
    status: 'الحالة',
    lastSeen: 'آخر ظهور',
    registeredAt: 'تاريخ التسجيل',
    revokedAt: 'تاريخ السحب',
    viewFamily: 'ملف العائلة 360',
    viewParent: 'ملف ولي الأمر',
    revoke: 'سحب الجهاز فوريًا',
    revokeTitle: 'سحب صلاحية الجهاز',
    revokeWarning: 'سيتم إلغاء صلاحية كافة جلسات هذا الجهاز فورًا وسيحتاج إلى تسجيل الدخول مجددًا من العائلة.',
    revokeDownloads: 'إلغاء التنزيلات المحلية',
    downloadsTitle: 'إلغاء رخص التنزيل دون اتصال',
    downloadsWarning: 'سيتم إنهاء رخصة الوصول دون اتصال (Offline Leases) على هذا الجهاز مع بقاء الجهاز موثقاً.',
    reason: 'السبب الإداري (إلزامي للتوثيق)',
    confirm: 'تنفيذ الإجراء',
    cancel: 'إلغاء',
    noSessions: 'لا توجد جلسات نشطة لهذا الجهاز حاليًا.',
    noDownloads: 'لا توجد تنزيلات محلية مسجلة لهذا الجهاز.',
    securityNote: 'الجلسات وتراخيص التشغيل تُدار بتنسيق مباشر مع سلطة FamilyState لحماية المحتوى.',
    notFound: 'الجهاز غير مسجل أو محذوف',
    degraded: 'تعذر جلب البيانات اللحظية الحية؛ يتم عرض البيانات المخزنة من آخر إسقاط.',
  },
  en: {
    eyebrow: 'Device & Session Studio',
    back: 'Back to Devices',
    loading: 'Loading device…',
    loadError: 'Unable to load device',
    tabs: {
      overview: 'Overview & KPIs',
      sessions: 'Active Sessions',
      downloads: 'Offline Downloads',
      security: 'Security & Actions',
    },
    device: 'Device',
    family: 'Family',
    parent: 'Parent',
    platform: 'Platform',
    status: 'Status',
    lastSeen: 'Last Seen',
    registeredAt: 'Registered',
    revokedAt: 'Revoked At',
    viewFamily: 'Family 360',
    viewParent: 'Parent Profile',
    revoke: 'Revoke Device',
    revokeTitle: 'Revoke Device Access',
    revokeWarning: 'Terminates all active sessions immediately. User will be logged out.',
    revokeDownloads: 'Revoke Offline Leases',
    downloadsTitle: 'Revoke Offline Downloads',
    downloadsWarning: 'Ends offline DRM playback licenses on this device while keeping registration active.',
    reason: 'Reason (Required for audit log)',
    confirm: 'Confirm Action',
    cancel: 'Cancel',
    noSessions: 'No active sessions recorded for this device.',
    noDownloads: 'No offline downloads recorded.',
    securityNote: 'Sessions and licenses are synchronized directly with FamilyState authority.',
    notFound: 'Device not found',
    degraded: 'Live data unavailable; showing cached projection.',
  },
}

export function DeviceWorkspacePage() {
  const { id = '' } = useParams()
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const [device, setDevice] = useState<any>(null)
  const [familyId, setFamilyId] = useState<string>('')
  const [liveDevices, setLiveDevices] = useState<any[] | null>(null)
  const [liveError, setLiveError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pending, setPending] = useState<'revoke' | 'downloads' | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionDone, setActionDone] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setLiveError('')
    try {
      const res = await api.devices()
      const found = (res.data as any[]).find((d) => d.id === id)
      if (!found) {
        setError(text.notFound)
        return
      }
      setDevice(found)
      setFamilyId(found.parent_id)
      try {
        const live = await api.familyDeviceState(found.parent_id)
        const liveList = (live.data as any).devices ?? []
        setLiveDevices(liveList)
      } catch (e) {
        setLiveError(e instanceof Error ? e.message : text.degraded)
        setLiveDevices(null)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [id, text.loadError, text.notFound, text.degraded])

  useEffect(() => {
    void load()
  }, [load])

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  async function runAction() {
    if (!pending || !reason.trim() || !familyId) return
    setSaving(true)
    setActionError('')
    try {
      if (pending === 'revoke') await api.revokeFamilyDevice(familyId, id, reason.trim())
      else await api.revokeFamilyDownloads(familyId, reason.trim(), id)
      setPending(null)
      setReason('')
      setActionDone(
        pending === 'revoke'
          ? locale === 'ar'
            ? 'تم سحب الجهاز وإلغاء صلاحية الجلسات بنجاح.'
            : 'Device revoked.'
          : locale === 'ar'
          ? 'تم إلغاء رخص التنزيلات دون اتصال.'
          : 'Downloads revoked.',
      )
      await load()
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!device) return <EmptyState title={text.notFound} description={id} />

  const liveDevice = liveDevices?.find((d: any) => d.id === id)
  const effectiveStatus = liveDevice?.status ?? device.status

  const overview = (
    <div className="page-stack">
      {liveError && (
        <p className="inline-alert inline-alert--warn">
          {text.degraded} — {liveError}
        </p>
      )}
      {actionDone && <p className="inline-alert inline-alert--success">{actionDone}</p>}

      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 14px', fontSize: 16 }}>تفاصيل الجهاز والاتصال</h4>
        <dl className="detail-list">
          <div>
            <dt>{text.device}</dt>
            <dd dir="ltr">{device.display_name || device.id}</dd>
          </div>
          <div>
            <dt>{text.platform}</dt>
            <dd>{device.platform ?? '—'}</dd>
          </div>
          <div>
            <dt>{text.status}</dt>
            <dd>
              <span
                className={`account-status account-status--${
                  effectiveStatus === 'active' ? 'active' : 'archived'
                }`}
              >
                {effectiveStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt>{text.family}</dt>
            <dd>
              <Link to={adminPath(`customers/${device.parent_id}`)}>
                {device.parent_name ?? device.parent_id}
              </Link>
            </dd>
          </div>
          <div>
            <dt>{text.lastSeen}</dt>
            <dd dir="ltr">{device.last_seen_at ?? '—'}</dd>
          </div>
          <div>
            <dt>{text.registeredAt}</dt>
            <dd dir="ltr">{device.registered_at ?? '—'}</dd>
          </div>
          {device.revoked_at && (
            <div>
              <dt>{text.revokedAt}</dt>
              <dd dir="ltr">{device.revoked_at}</dd>
            </div>
          )}
        </dl>
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => {
              setPending('revoke')
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
              setPending('downloads')
              setReason('')
              setActionError('')
            }}
          >
            {text.revokeDownloads}
          </button>
          <Link
            className="button button--ghost button--small"
            to={adminPath(`customers/${device.parent_id}`)}
          >
            <Icon name="parents" size={13} />
            <span>{text.viewFamily}</span>
          </Link>
        </div>
        <p className="readiness-note" style={{ marginTop: 14 }}>
          {text.securityNote}
        </p>
      </div>
    </div>
  )

  const sessionsTab = liveDevice ? (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <p className="readiness-note">
          {locale === 'ar' ? 'آخر نشاط موثق: ' : 'Last seen: '}
          {new Date(Number(liveDevice.last_seen_at)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB')}
        </p>
        <p className="readiness-note">{text.securityNote}</p>
      </div>
    </div>
  ) : liveDevices === null ? (
    <div className="page-stack">
      <p className="inline-alert inline-alert--warn">{text.degraded}</p>
      <p className="readiness-note">{device.last_seen_at ?? text.noSessions}</p>
    </div>
  ) : (
    <EmptyState title={text.noSessions} description={text.securityNote} />
  )

  const downloadsTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <p className="readiness-note">
          {locale === 'ar'
            ? 'التنزيلات ترتبط بتراخيص دون اتصال. إلغاؤها ينهي الوصول دون اتصال فقط.'
            : 'Downloads are offline licences. Revoking them ends offline access only.'}
        </p>
        <EmptyState title={text.noDownloads} description={text.securityNote} />
        <button
          className="button button--ghost button--small"
          type="button"
          onClick={() => {
            setPending('downloads')
            setReason('')
            setActionError('')
          }}
          style={{ marginTop: 12 }}
        >
          {text.revokeDownloads}
        </button>
      </div>
    </div>
  )

  const securityTab = (
    <div className="page-stack">
      <div className="panel" style={{ padding: 20, borderRadius: 18 }}>
        <h4 style={{ margin: '0 0 12px' }}>{text.securityNote}</h4>
        <dl className="detail-list">
          <div>
            <dt>{text.status}</dt>
            <dd>{effectiveStatus}</dd>
          </div>
          <div>
            <dt>{text.platform}</dt>
            <dd>{device.platform ?? '—'}</dd>
          </div>
          <div>
            <dt>{text.lastSeen}</dt>
            <dd>{device.last_seen_at ?? '—'}</dd>
          </div>
        </dl>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button
            className="button button--primary button--small"
            type="button"
            onClick={() => {
              setPending('revoke')
              setReason('')
              setActionError('')
            }}
          >
            {text.revoke}
          </button>
          <Link
            className="button button--ghost button--small"
            to={adminPath(`customers/${device.parent_id}`)}
          >
            {text.viewFamily}
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="content-studio-root">
      {/* 1. Panoramic Hero Banner */}
      <section className="catalog-hero">
        <div
          className="catalog-hero__glow"
          style={{ background: 'radial-gradient(circle, rgba(14, 165, 233, 0.25) 0%, rgba(99, 102, 241, 0.15) 60%, transparent 80%)' }}
        />
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta">
            <span className="catalog-hero__eyebrow">{text.eyebrow}</span>
            <span
              className="catalog-hero__status-badge"
              style={{
                borderColor: effectiveStatus === 'active' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)',
                color: effectiveStatus === 'active' ? '#10b981' : '#f87171',
              }}
            >
              <span
                className="status-dot-pulse"
                style={{ background: effectiveStatus === 'active' ? '#10b981' : '#f87171' }}
              />
              حالة الجهاز: {effectiveStatus}
            </span>
          </div>
          <h1 className="catalog-hero__title" style={{ fontSize: 24 }}>
            {device.display_name || device.id}
          </h1>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: 'var(--muted)', fontSize: 13, marginTop: 8 }}>
            <span>المنصة: <strong>{device.platform ?? '—'}</strong></span>
            <span>العائلة: <strong>{device.parent_name ?? device.parent_id}</strong></span>
            <span>المعرف: <code>{device.id.slice(0, 14)}…</code></span>
          </div>
        </div>
        <div className="catalog-hero__actions">
          <Link className="button button--secondary" to={adminPath('devices-admin')} style={{ backdropFilter: 'blur(8px)' }}>
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
            { key: 'sessions', label: text.tabs.sessions, content: sessionsTab },
            { key: 'downloads', label: text.tabs.downloads, content: downloadsTab },
            { key: 'security', label: text.tabs.security, content: securityTab },
          ]}
        />
      </div>

      {pending && (
        <Modal
          open
          title={pending === 'revoke' ? text.revokeTitle : text.downloadsTitle}
          onClose={() => setPending(null)}
        >
          <div className="entity-form">
            <p className="inline-alert inline-alert--error">
              {pending === 'revoke' ? text.revokeWarning : text.downloadsWarning}
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
                onChange={(e) => setReason(e.target.value)}
                autoFocus
                placeholder="اكتب سبب السحب أو الإلغاء للتوثيق الإداري..."
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
