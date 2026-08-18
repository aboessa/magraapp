import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'

/**
 * جلساتي.
 *
 * ## الخلل الذي تسدّه هذه الشاشة
 *
 * كانت تعرض **مصفوفة وهمية مكتوبة في الملف** بجهازين مخترعين، وزرّ «سحب» في كل
 * صف بلا معالج، ونداء «سحب الجلسات الأخرى» يستدعي مسارًا بمعرّف غير صالح
 * (`'me'`) ويُهمل الخطأ. النتيجة أن جلسة مسروقة لم يكن ممكنًا **رؤيتها ولا
 * إبطالها** من اللوحة — وهي شاشة أمنية.
 *
 * والمسار القديم `GET /users/:id/sessions` يطلب صلاحية إدارة المستخدمين، فلا
 * يصلح لأن يرى الإداريّ العاديّ جلساته هو. لذلك تستعمل هذه الشاشة نقاطًا
 * **مقصورة على المتصل** (`/admin/auth/sessions`).
 */
const copy = {
  ar: {
    eyebrow: 'الجلسات',
    title: 'جلساتي',
    lede: 'أجهزة ومتصفحات سجّلت دخولك. إبطال جلسة يُخرجها فورًا.',
    revokeOther: 'سحب الجلسات الأخرى',
    revoke: 'سحب',
    revoking: 'يُسحب…',
    lastActive: 'آخر نشاط',
    created: 'أنشئت',
    expires: 'تنتهي',
    device: 'الجهاز / المتصفح',
    currentBadge: 'هذه الجلسة',
    noTokens: 'لا تُعرض رموز خام — البصمة فقط تُطابَق على الخادم.',
    empty: 'لا جلسات أخرى',
    revokedOne: 'أُبطلت الجلسة',
    revokedMany: (count: number) => `أُبطلت ${count} جلسة`,
    revokeFailed: 'تعذّر إبطال الجلسة',
    confirmOthers: 'إبطال كل الجلسات الأخرى؟ ستحتاج الأجهزة الأخرى إلى تسجيل دخول جديد.',
    unknownDevice: 'جهاز غير معروف',
  },
  en: {
    eyebrow: 'Sessions',
    title: 'My sessions',
    lede: 'Devices and browsers signed in as you. Revoking one ends it immediately.',
    revokeOther: 'Revoke other sessions',
    revoke: 'Revoke',
    revoking: 'Revoking…',
    lastActive: 'Last active',
    created: 'Created',
    expires: 'Expires',
    device: 'Device / browser',
    currentBadge: 'This session',
    noTokens: 'No raw tokens are shown — only the hash is matched, server-side.',
    empty: 'No other sessions',
    revokedOne: 'Session revoked',
    revokedMany: (count: number) => `${count} session(s) revoked`,
    revokeFailed: 'Could not revoke the session',
    confirmOthers: 'Revoke every other session? Other devices will have to sign in again.',
    unknownDevice: 'Unknown device',
  },
}

type SessionRow = {
  id: string
  user_agent: string | null
  source_ip: string | null
  created_at: string
  last_seen_at: string | null
  expires_at: string
  current: boolean
}

function when(value: string | null): string {
  if (!value) return '—'
  return String(value).slice(0, 16)
}

export function SessionsPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.mySessions()
      setRows(res.data ?? [])
    } catch (e) {
      // A failed read is stated, never rendered as "no sessions": on a security
      // screen those two answers have opposite meanings.
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const revokeOne = useCallback(async (id: string) => {
    setBusy(id)
    setNote(null)
    try {
      await api.revokeMySession(id)
      setNote(text.revokedOne)
      await load()
    } catch (e) {
      setNote(e instanceof Error ? e.message : text.revokeFailed)
    } finally {
      setBusy(null)
    }
  }, [load, text])

  const revokeOthers = useCallback(async () => {
    if (!window.confirm(text.confirmOthers)) return
    setBusy('others')
    setNote(null)
    try {
      const res = await api.revokeMyOtherSessions()
      setNote(text.revokedMany(res.data?.revoked ?? 0))
      await load()
    } catch (e) {
      setNote(e instanceof Error ? e.message : text.revokeFailed)
    } finally {
      setBusy(null)
    }
  }, [load, text])

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error} onRetry={() => void load()} />

  const others = rows.filter((row) => !row.current)

  return (
    <div className="page-stack" style={{ maxWidth: 720, margin: '0 auto' }}>
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <button
          className="button button--ghost"
          disabled={busy !== null || others.length === 0}
          onClick={() => void revokeOthers()}
        >
          {busy === 'others' ? text.revoking : text.revokeOther}
        </button>
      </section>

      <div className="panel" style={{ padding: 12 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>{text.noTokens}</p>
        {note && <p role="status" aria-live="polite" style={{ fontSize: 13 }}>{note}</p>}
        {rows.length === 0 ? (
          <EmptyState title={text.empty} description={text.lede} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{text.device}</th>
                <th>{text.lastActive}</th>
                <th>{text.created}</th>
                <th>{text.expires}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>
                      <strong>{row.user_agent ?? text.unknownDevice}</strong>
                      <br />
                      <small dir="ltr">{row.source_ip ?? '—'}</small>{' '}
                      {row.current && (
                        <span className="status-badge status-badge--published">{text.currentBadge}</span>
                      )}
                    </div>
                  </td>
                  <td>{when(row.last_seen_at)}</td>
                  <td>{when(row.created_at)}</td>
                  <td>{when(row.expires_at)}</td>
                  <td>
                    {row.current ? null : (
                      <button
                        className="button button--ghost button--small"
                        disabled={busy !== null}
                        onClick={() => void revokeOne(row.id)}
                      >
                        {busy === row.id ? text.revoking : text.revoke}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
