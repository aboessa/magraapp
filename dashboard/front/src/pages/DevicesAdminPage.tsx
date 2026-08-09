import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { AdminDeviceRecord } from '../types/api'

/**
 * أجهزة العائلات وسحب الوصول.
 *
 * ## ما كانت عليه
 *
 * `.catch()` كان يضع **جهازين مخترعين** بـ`last_seen_at: new Date()` — أي
 * أنهما يظهران نشطين «الآن» دائمًا، وهي أكثر كذبة مقنعة ممكنة على شاشة مراقبة
 * أجهزة.
 *
 * والأخطر: زر «إلغاء» كان ينادي `POST /admin/devices/:id/revoke` وهو مسار **لم
 * يكن موجودًا في الخادم**، ثم يعرض في `.then()` بلا فحص الاستجابة:
 * «تم الإلغاء - Audit Log + إشعار لولي الأمر». فكان يؤكّد ثلاثة أمور لم يحدث
 * أيٌّ منها. والسبب المُوعود بتسجيله كان مثبّتًا `'support'` ولا يُجمَع أصلًا.
 *
 * ## ما صارت عليه
 *
 * المسار أُضيف في الخادم (`adminAppExperience.ts`) ويسجّل السبب فعلًا في
 * audit_logs. السبب يُجمَع من المستخدم. والرسالة تُبنى من استجابة الخادم:
 * `parent_notified` يُعاد `false` صريحًا لأن الإشعار غير مُنفَّذ، فلا نَعِد به.
 */

const copy = {
  ar: {
    eyebrow: 'الأجهزة والتنزيلات',
    title: 'إدارة الأجهزة',
    lede: 'أجهزة العائلات المسجَّلة. سحب الجهاز يُبطل وصوله ويُسجَّل في سجل التدقيق.',
    device: 'الجهاز',
    parent: 'ولي الأمر',
    platform: 'النوع',
    status: 'الحالة',
    lastSeen: 'آخر نشاط',
    actions: 'إجراءات',
    revoke: 'سحب الوصول',
    revokeTitle: 'سحب وصول الجهاز',
    reason: 'سبب السحب',
    reasonHint: 'يُسجَّل في سجل التدقيق مع هويتك. اتركه فارغًا إن لم يكن هناك سبب محدّد.',
    confirm: 'تأكيد السحب',
    revoking: 'جارٍ السحب…',
    cancel: 'إلغاء',
    revoked: 'سُحب وصول الجهاز وسُجّل في سجل التدقيق.',
    revokedNoNotify: 'ملاحظة: إشعار ولي الأمر غير مُنفَّذ بعد، فلم يُرسَل إشعار.',
    alreadyRevoked: 'هذا الجهاز مسحوب بالفعل.',
    never: '—',
    empty: 'لا أجهزة مسجَّلة',
    emptyHint: 'الأجهزة تُسجَّل عند دخول ولي أمر من التطبيق.',
    loadError: 'تعذر تحميل الأجهزة',
    downloadsNote: 'التنزيلات غير معروضة',
    downloadsHint: 'عنوان القائمة يقول «الأجهزة والتنزيلات» لكن هذه الصفحة تعرض الأجهزة وحدها. لا جدول تنزيلات في قاعدة البيانات: account_devices يحمل حالة الجهاز وآخر نشاطه فقط، وحدّ أجهزة التنزيل مخزَّن في subscription_plan_limits.max_download_devices بلا سجلّ لما نُزِّل فعلًا. عرض التنزيلات يتطلّب جدولًا جديدًا لا واجهة جديدة.',
  },
  en: {
    eyebrow: 'Devices and downloads',
    title: 'Device management',
    lede: 'Registered family devices. Revoking a device invalidates its access and is recorded in the audit log.',
    device: 'Device',
    parent: 'Parent',
    platform: 'Platform',
    status: 'Status',
    lastSeen: 'Last seen',
    actions: 'Actions',
    revoke: 'Revoke access',
    revokeTitle: 'Revoke device access',
    reason: 'Reason for revoking',
    reasonHint: 'Recorded in the audit log with your identity. Leave empty if there is no specific reason.',
    confirm: 'Confirm revoke',
    revoking: 'Revoking…',
    cancel: 'Cancel',
    revoked: 'Device access revoked and recorded in the audit log.',
    revokedNoNotify: 'Note: parent notification is not implemented yet, so no notification was sent.',
    alreadyRevoked: 'This device was already revoked.',
    never: '—',
    empty: 'No registered devices',
    emptyHint: 'Devices are registered when a parent signs in from the app.',
    loadError: 'Unable to load devices',
    downloadsNote: 'Downloads are not shown',
    downloadsHint: 'The menu label says "Devices and downloads" but this page shows devices only. There is no downloads table in the database: account_devices holds device status and last activity, and the download-device allowance lives in subscription_plan_limits.max_download_devices with no record of what was actually downloaded. Showing downloads requires a new table, not a new screen.',
  },
}

function formatDate(value: string | null, locale: 'ar' | 'en') {
  if (!value) return null
  // تواريخ D1 بصيغة "YYYY-MM-DD HH:MM:SS" بتوقيت UTC بلا لاحقة منطقة
  const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function DevicesAdminPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [devices, setDevices] = useState<AdminDeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState<AdminDeviceRecord | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.devices()
      setDevices(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  async function confirmRevoke() {
    if (!selected) return
    setSaving(true)
    setModalError('')
    try {
      const response = await api.revokeDevice(selected.id, reason.trim())
      setSelected(null)
      setReason('')
      // الرسالة تُبنى من استجابة الخادم لا من افتراض: كانت الواجهة تؤكّد
      // إشعار ولي الأمر بلا أي إشعار
      const parts = [response.data.already ? text.alreadyRevoked : text.revoked]
      if (response.data.parent_notified === false) parts.push(text.revokedNoNotify)
      setNotice(parts.join(' '))
      await load()
    } catch (caught) {
      setModalError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  return (
    <div className="page-stack">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
      </section>

      {notice ? <section className="panel panel--notice" role="status">{notice}</section> : null}

      {devices.length ? (
        <section className="panel panel--table">
          <div className="table-scroll">
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.device}</th>
                  <th>{text.parent}</th>
                  <th>{text.platform}</th>
                  <th>{text.status}</th>
                  <th>{text.lastSeen}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <span className="table-primary">{device.display_name || device.id}</span>
                      <span className="table-secondary" dir="ltr">{device.id.slice(0, 14)}…</span>
                    </td>
                    <td>
                      <span className="table-secondary">{device.parent_name ?? '—'}</span>
                    </td>
                    <td>{device.platform ?? '—'}</td>
                    <td>
                      <span className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}>
                        {device.status}
                      </span>
                    </td>
                    <td>
                      <span className="table-secondary">
                        {formatDate(device.last_seen_at, locale) ?? text.never}
                      </span>
                    </td>
                    <td>
                      {device.status === 'active' ? (
                        <button
                          className="button button--ghost"
                          type="button"
                          onClick={() => { setSelected(device); setReason(''); setModalError('') }}
                        >
                          {text.revoke}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <EmptyState title={text.empty} description={text.emptyHint} />
      )}

      {/* عنوان القائمة يَعِد بالتنزيلات وهذه الصفحة لا تعرضها. الحدّ يُعلَن بدل
          أن يُكتشف: لا جدول تنزيلات في قاعدة البيانات إطلاقًا. */}
      <section className="panel panel--notice">
        <strong>{text.downloadsNote}</strong>
        <p>{text.downloadsHint}</p>
      </section>

      {selected ? (
        <Modal open title={text.revokeTitle} onClose={() => setSelected(null)}>
          <div className="entity-form">
            <dl className="detail-list">
              <div>
                <dt>{text.device}</dt>
                <dd>{selected.display_name || selected.id}</dd>
              </div>
              <div>
                <dt>{text.parent}</dt>
                <dd>{selected.parent_name ?? '—'}</dd>
              </div>
            </dl>

            <label className="field">
              <span>{text.reason}</span>
              {/* يُجمَع فعلًا: كان مثبّتًا 'support' مع وعد بتسجيله */}
              <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} />
              <small>{text.reasonHint}</small>
            </label>

            {modalError ? <p className="form-error" role="alert">{modalError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setSelected(null)}>
                {text.cancel}
              </button>
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void confirmRevoke()}>
                {saving ? text.revoking : text.confirm}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
