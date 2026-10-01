import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../PageState'
import { usePreferences } from '../../context/preferences'
import { api } from '../../lib/api'

/// Offline licences across families, from `GET /admin/downloads`.
///
/// Read-only on purpose: ending downloads is a command on the family's
/// authority and lives in the family file, where the reason is recorded.

type Row = Awaited<ReturnType<typeof api.adminDownloads>>['data'][number]
const STATUSES = ['', 'active', 'pending', 'expired', 'revoked', 'superseded'] as const

const copy = {
  ar: {
    title: 'التنزيلات (بدون إنترنت)', note: 'تراخيص مربوطة بجهاز، وتنتهي لوحدها. سحبها بيتعمل من ملف الأسرة.',
    all: 'كل الحالات', content: 'المحتوى', family: 'الأسرة', device: 'الجهاز', status: 'الحالة',
    size: 'الحجم', issued: 'صدر', expires: 'ينتهي', empty: 'مفيش تنزيلات لسه.',
    statuses: { active: 'شغال', pending: 'بيتنزل', expired: 'انتهى', revoked: 'اتسحب', superseded: 'اتجدد' } as Record<string, string>,
  },
  en: {
    title: 'Offline downloads', note: 'Device-bound licences that expire on their own. Revoke from the family file.',
    all: 'All statuses', content: 'Content', family: 'Family', device: 'Device', status: 'Status',
    size: 'Size', issued: 'Issued', expires: 'Expires', empty: 'No downloads yet.',
    statuses: { active: 'Active', pending: 'Downloading', expired: 'Expired', revoked: 'Revoked', superseded: 'Renewed' } as Record<string, string>,
  },
}

const mb = (bytes: number) => (bytes > 0 ? `${(bytes / 1_048_576).toFixed(1)} MB` : '—')
const day = (value: string | null) => (value ? value.slice(0, 10) : '—')

export function DownloadsPanel() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const [status, setStatus] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [byStatus, setByStatus] = useState<Record<string, number>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    setRows(null)
    try {
      const response = await api.adminDownloads({ status: status || undefined, limit: 100 })
      setRows(response.data)
      setByStatus(response.meta.by_status ?? {})
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }, [status])
  useEffect(() => { void load() }, [load])

  return (
    <section className="panel" aria-labelledby="downloads-title" style={{ padding: 18, borderRadius: 16 }}>
      <div className="panel__header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 id="downloads-title">{text.title}</h3>
          <p className="panel__note">{text.note}</p>
        </div>
        <label className="field">
          <span>{text.status}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value ? `${text.statuses[value]} (${byStatus[value] ?? 0})` : text.all}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : rows === null ? <LoadingState /> : rows.length === 0 ? (
        <p className="panel__note">{text.empty}</p>
      ) : (
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead>
              <tr><th>{text.content}</th><th>{text.family}</th><th>{text.device}</th><th>{text.status}</th><th>{text.size}</th><th>{text.issued}</th><th>{text.expires}</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.content_title ?? <code dir="ltr">{row.content_id}</code>}</td>
                  <td>{row.parent_name ?? <code dir="ltr">{row.parent_id}</code>}</td>
                  <td>{row.device_name ?? <code dir="ltr">{row.device_id}</code>}{row.platform ? <div className="panel__note" dir="ltr">{row.platform}</div> : null}</td>
                  <td>{text.statuses[row.status] ?? row.status}</td>
                  <td dir="ltr">{mb(row.bytes)}</td>
                  <td dir="ltr">{day(row.issued_at)}</td>
                  <td dir="ltr">{day(row.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
