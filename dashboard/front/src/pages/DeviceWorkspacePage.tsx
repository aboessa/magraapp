import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { adminPath } from '../lib/adminPath'
import { DetailTabs } from '../components/DetailTabs'
import { EntityHeader } from '../components/EntityHeader'
import { Modal } from '../components/Modal'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

const copy = {
  ar: {
    eyebrow: 'الأجهزة', back: 'كل الأجهزة', loading: 'جارٍ تحميل الجهاز…', loadError: 'تعذر تحميل بيانات الجهاز',
    tabs: { overview: 'نظرة عامة', sessions: 'الجلسات', downloads: 'التنزيلات', security: 'الأمان', history: 'السجل' },
    device: 'الجهاز', family: 'العائلة', parent: 'ولي الأمر', platform: 'المنصّة', status: 'الحالة',
    lastSeen: 'آخر ظهور', registeredAt: 'تاريخ التسجيل', revokedAt: 'تاريخ السحب',
    viewFamily: 'ملف العائلة', viewParent: 'ولي الأمر',
    revoke: 'سحب الجهاز', revokeTitle: 'سحب جهاز', revokeWarning: 'سيتم إلغاء صلاحية جلسات هذا الجهاز وسيحتاج إلى تسجيل الدخول من جديد. لا يمكن التراجع.',
    revokeDownloads: 'إلغاء التنزيلات', downloadsTitle: 'إلغاء التنزيلات', downloadsWarning: 'سيتم إنهاء الوصول دون اتصال على هذا الجهاز. الجهاز يبقى مسجَّلًا.',
    reason: 'السبب (إلزامي)', confirm: 'تنفيذ', cancel: 'إلغاء',
    noSessions: 'لا جلسات نشطة لهذا الجهاز حاليًا.', noDownloads: 'لا تنزيلات مسجلة لهذا الجهاز.',
    securityNote: 'الجلسات والتراخيص تُدار من المصدر الأساسي للعائلة.',
    leaseStatus: 'حالة الترخيص', expiresAt: 'ينتهي', content: 'المحتوى',
    notFound: 'الجهاز غير موجود',
    degraded: 'تعذر تحميل البيانات الحية؛ البيانات المعروضة من السجل.',
    retry: 'إعادة المحاولة',
  },
  en: {
    eyebrow: 'Devices', back: 'All devices', loading: 'Loading device…', loadError: 'Unable to load device',
    tabs: { overview: 'Overview', sessions: 'Sessions', downloads: 'Downloads', security: 'Security', history: 'History' },
    device: 'Device', family: 'Family', parent: 'Parent', platform: 'Platform', status: 'Status',
    lastSeen: 'Last seen', registeredAt: 'Registered', revokedAt: 'Revoked at',
    viewFamily: 'Family file', viewParent: 'Parent',
    revoke: 'Revoke device', revokeTitle: 'Revoke device', revokeWarning: 'This signs out all sessions on this device. The device will need to sign in again. This cannot be undone.',
    revokeDownloads: 'Revoke downloads', downloadsTitle: 'Revoke downloads', downloadsWarning: 'Offline access on this device will be ended. The device stays registered.',
    reason: 'Reason (required)', confirm: 'Confirm', cancel: 'Cancel',
    noSessions: 'No active sessions for this device.', noDownloads: 'No downloads recorded for this device.',
    securityNote: 'Sessions and licences are managed from the family authority.',
    leaseStatus: 'Licence status', expiresAt: 'Expires', content: 'Content',
    notFound: 'Device not found',
    degraded: 'Live data unavailable; showing recorded data.',
    retry: 'Retry',
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
      if (!found) { setError(text.notFound); return }
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setLoading(false) }
  }, [id, text.loadError, text.notFound, text.degraded])

  useEffect(() => { void load() }, [load])
  const setTab = (key: string) => { const next = new URLSearchParams(searchParams); next.set('tab', key); setSearchParams(next, { replace: true }) }

  async function runAction() {
    if (!pending || !reason.trim() || !familyId) return
    setSaving(true)
    setActionError('')
    try {
      if (pending === 'revoke') await api.revokeFamilyDevice(familyId, id, reason.trim())
      else await api.revokeFamilyDownloads(familyId, reason.trim(), id)
      setPending(null)
      setReason('')
      setActionDone(pending === 'revoke' ? (locale === 'ar' ? 'تم سحب الجهاز.' : 'Device revoked.') : (locale === 'ar' ? 'تم إلغاء التنزيلات.' : 'Downloads revoked.'))
      await load()
    } catch (caught) { setActionError(caught instanceof Error ? caught.message : text.loadError) }
    finally { setSaving(false) }
  }

  if (loading) return <LoadingState label={text.loading} />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />
  if (!device) return <EmptyState title={text.notFound} description={id} />

  const liveDevice = liveDevices?.find((d: any) => d.id === id)
  const effectiveStatus = liveDevice?.status ?? device.status

  const overview = (
    <div className="page-stack">
      {liveError && <p className="inline-alert inline-alert--warn">{text.degraded} — {liveError}</p>}
      {actionDone && <p className="inline-alert inline-alert--success">{actionDone}</p>}
      <dl className="detail-list">
        <div><dt>{text.device}</dt><dd dir="ltr">{device.display_name || device.id}</dd></div>
        <div><dt>{text.platform}</dt><dd>{device.platform ?? '—'}</dd></div>
        <div><dt>{text.status}</dt><dd><span className={`account-status account-status--${effectiveStatus === 'active' ? 'active' : 'archived'}`}>{effectiveStatus}</span></dd></div>
        <div><dt>{text.family}</dt><dd><Link to={adminPath(`customers/${device.parent_id}`)}>{device.parent_name ?? device.parent_id}</Link></dd></div>
        <div><dt>{text.lastSeen}</dt><dd dir="ltr">{device.last_seen_at ?? '—'}</dd></div>
        <div><dt>{text.registeredAt}</dt><dd dir="ltr">{device.registered_at ?? '—'}</dd></div>
        {device.revoked_at && <div><dt>{text.revokedAt}</dt><dd dir="ltr">{device.revoked_at}</dd></div>}
      </dl>
      <div className="form-actions">
        <button className="button button--primary button--small" type="button" onClick={() => { setPending('revoke'); setReason(''); setActionError('') }}>{text.revoke}</button>
        <button className="button button--ghost button--small" type="button" onClick={() => { setPending('downloads'); setReason(''); setActionError('') }}>{text.revokeDownloads}</button>
        <Link className="button button--ghost button--small" to={adminPath(`customers/${device.parent_id}`)}>{text.viewFamily}</Link>
      </div>
      <p className="readiness-note">{text.securityNote}</p>
    </div>
  )

  const sessionsTab = liveDevice
    ? <div className="page-stack"><p className="readiness-note">{locale === 'ar' ? 'آخر ظهور: ' : 'Last seen: '}{new Date(Number(liveDevice.last_seen_at)).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB')}</p><p className="readiness-note">{text.securityNote}</p></div>
    : liveDevices === null
      ? <><p className="inline-alert inline-alert--warn">{text.degraded}</p><p className="readiness-note">{device.last_seen_at ?? text.noSessions}</p></>
      : <EmptyState title={text.noSessions} description={text.securityNote} />

  const downloadsTab = (
    <div className="page-stack">
      <p className="readiness-note">{locale === 'ar' ? 'التنزيلات ترتبط بتراخيص دون اتصال. إلغاؤها ينهي الوصول دون اتصال فقط.' : 'Downloads are offline licences. Revoking them ends offline access only.'}</p>
      <EmptyState title={text.noDownloads} description={text.securityNote} />
      <button className="button button--ghost button--small" type="button" onClick={() => { setPending('downloads'); setReason(''); setActionError('') }}>{text.revokeDownloads}</button>
    </div>
  )

  const securityTab = (
    <div className="page-stack">
      <h4>{text.securityNote}</h4>
      <dl className="detail-list">
        <div><dt>{text.status}</dt><dd>{effectiveStatus}</dd></div>
        <div><dt>{text.platform}</dt><dd>{device.platform ?? '—'}</dd></div>
        <div><dt>{text.lastSeen}</dt><dd>{device.last_seen_at ?? '—'}</dd></div>
      </dl>
      <div className="form-actions">
        <button className="button button--primary button--small" type="button" onClick={() => { setPending('revoke'); setReason(''); setActionError('') }}>{text.revoke}</button>
        <Link className="button button--ghost button--small" to={adminPath(`customers/${device.parent_id}`)}>{text.viewFamily}</Link>
      </div>
    </div>
  )

  return (
    <div className="page-stack">
      <EntityHeader
        breadcrumbs={[{ label: text.eyebrow, to: adminPath('devices-admin') }, { label: device.display_name || device.id.slice(0, 12) }]}
        title={device.display_name || device.id}
        subtitle={`${text.platform}: ${device.platform ?? '—'} · ${text.family}: ${device.parent_name ?? device.parent_id.slice(0, 8)}`}
        meta={<><span>{text.status}: {effectiveStatus}</span><span dir="ltr">{device.id.slice(0, 14)}…</span></>}
        status={<span className={`account-status account-status--${effectiveStatus === 'active' ? 'active' : 'archived'}`}>{effectiveStatus}</span>}
        actions={<Link className="button button--ghost" to={adminPath('devices-admin')}>{text.back}</Link>}
      />
      <DetailTabs active={activeTab} onChange={setTab} tabs={[
        { key: 'overview', label: text.tabs.overview, content: overview },
        { key: 'sessions', label: text.tabs.sessions, content: sessionsTab },
        { key: 'downloads', label: text.tabs.downloads, content: downloadsTab },
        { key: 'security', label: text.tabs.security, content: securityTab },
      ]} />
      {pending && (
        <Modal open title={pending === 'revoke' ? text.revokeTitle : text.downloadsTitle} onClose={() => setPending(null)}>
          <div className="entity-form">
            <p className="inline-alert inline-alert--error">{pending === 'revoke' ? text.revokeWarning : text.downloadsWarning}</p>
            {actionError && <p className="inline-alert inline-alert--error" role="alert">{actionError}</p>}
            <label className="field"><span>{text.reason}</span><textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></label>
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
