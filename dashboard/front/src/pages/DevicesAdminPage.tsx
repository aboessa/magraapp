import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { AdminDeviceRecord } from '../types/api'

/**
 * سجل الأجهزة الإداري.
 *
 * D1 `account_devices` ليس مصدر السلطة الحي: FamilyState يملك الجهاز والجلسة
 * وplayback leases. لذلك لا تعرض هذه الصفحة سحب الجهاز كأنها عملية حقيقية إلى
 * أن يوجد إسقاط حي يربط صف القائمة بمعرّف جهاز الـDO. إبقاء الزر كان يغيّر صف
 * D1 قديمًا فقط ويؤكد للمسؤول نجاحًا زائفًا.
 */
const copy = {
  ar: {
    eyebrow: 'الأجهزة والتنزيلات',
    title: 'سجل الأجهزة',
    lede: 'سجل إداري للأجهزة المرصودة. لا تُستخدم هذه البيانات كسُلطة سحب الوصول.',
    device: 'الجهاز',
    parent: 'ولي الأمر',
    platform: 'النوع',
    status: 'الحالة المسجلة',
    lastSeen: 'آخر نشاط مسجل',
    never: '—',
    empty: 'لا أجهزة مسجَّلة',
    emptyHint: 'قد لا تكون الأجهزة الجديدة ظاهرة حتى يُستكمل إسقاط FamilyState.',
    loadError: 'تعذر تحميل سجل الأجهزة',
    authorityTitle: 'سحب الوصول غير متاح',
    authorityHint: 'الجهاز والجلسات الفعلية تدار في FamilyState، بينما هذه القائمة مبنية على سجل D1 قديم لا يثبت تطابق المعرّف. تم إيقاف السحب بدل تغيير سجل لا يوقف وصول التطبيق. يلزم إسقاط أجهزة حي مبني من أحداث FamilyState قبل تفعيل الإجراء.',
    downloadsTitle: 'التنزيلات غير معروضة',
    downloadsHint: 'لا يوجد جدول تنزيلات أو تراخيص Offline في البيانات الإدارية الحالية. حد أجهزة التنزيل وحده لا يثبت ما نُزِّل فعليًا، لذلك لا تعرض الصفحة إحصاءات أو إجراءات تنزيلات وهمية.',
  },
  en: {
    eyebrow: 'Devices and downloads',
    title: 'Device record',
    lede: 'An administrative record of observed devices. This data is not the authority for revoking access.',
    device: 'Device',
    parent: 'Parent',
    platform: 'Platform',
    status: 'Recorded status',
    lastSeen: 'Recorded last activity',
    never: '—',
    empty: 'No device records',
    emptyHint: 'New devices may not appear until the FamilyState projection is completed.',
    loadError: 'Unable to load the device record',
    authorityTitle: 'Access revocation is unavailable',
    authorityHint: 'Live devices and sessions are owned by FamilyState, while this list is built from a legacy D1 record that cannot prove identifier parity. Revocation is disabled rather than changing a row that does not stop app access. A live device projection from FamilyState events is required before enabling the action.',
    downloadsTitle: 'Downloads are not shown',
    downloadsHint: 'There is no downloads or offline-license table in the current administrative data. A download-device allowance alone does not prove what was downloaded, so this page does not invent download metrics or actions.',
  },
}

function formatDate(value: string | null, locale: 'ar' | 'en') {
  if (!value) return null
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
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td>
                      <span className="table-primary">{device.display_name || device.id}</span>
                      <span className="table-secondary" dir="ltr">{device.id.slice(0, 14)}…</span>
                    </td>
                    <td><span className="table-secondary">{device.parent_name ?? '—'}</span></td>
                    <td>{device.platform ?? '—'}</td>
                    <td>
                      <span className={`account-status account-status--${device.status === 'active' ? 'active' : 'archived'}`}>
                        {device.status}
                      </span>
                    </td>
                    <td><span className="table-secondary">{formatDate(device.last_seen_at, locale) ?? text.never}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : <EmptyState title={text.empty} description={text.emptyHint} />}

      <section className="panel panel--notice">
        <strong>{text.authorityTitle}</strong>
        <p>{text.authorityHint}</p>
      </section>

      <section className="panel panel--notice">
        <strong>{text.downloadsTitle}</strong>
        <p>{text.downloadsHint}</p>
      </section>
    </div>
  )
}
