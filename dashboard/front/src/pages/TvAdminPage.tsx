import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { hasPermission } from '../lib/adminSession'
import { api } from '../lib/api'

/// ADM-306: a family's televisions — registered, connected now, and playing.
///
/// Per family, because TV state lives in each family's own objects; there is
/// no cross-family index to list every TV on the platform. Open it with the
/// parent id (from Customer 360) or `?family=<id>`.

type TvData = Awaited<ReturnType<typeof api.familyTvs>>['data']

const STATUS: Record<string, string> = {
  playing: 'شغّال', paused: 'متوقف مؤقتًا', loading: 'بيحمّل', ended: 'خلصت', idle: 'مستني', error: 'عطل',
}

function clock(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function TvAdminPage() {
  const [params, setParams] = useSearchParams()
  const [familyId, setFamilyId] = useState(params.get('family') ?? '')
  const [data, setData] = useState<TvData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const canRevoke = hasPermission('manage_permissions')

  const load = async (id = familyId.trim()) => {
    if (!id) return
    setLoading(true)
    setError('')
    setParams({ family: id }, { replace: true })
    try {
      setData((await api.familyTvs(id)).data)
    } catch (caught) {
      setData(null)
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  const revoke = async (deviceId: string, name: string | null) => {
    const reason = window.prompt(`سبب إلغاء ${name ?? 'التلفزيون'}؟ هيتقفل فورًا ومش هيقبل أوامر.`)
    if (!reason || reason.trim().length < 3) return
    try {
      await api.revokeFamilyDevice(familyId.trim(), deviceId, reason.trim())
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }

  const connected = new Map((data?.connected ?? []).map((tv) => [tv.device_id, tv]))

  return (
    <div className="content-studio-root">
      <section className="catalog-hero">
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta"><span className="catalog-hero__eyebrow">العملاء</span></div>
          <h1 className="catalog-hero__title">التلفزيونات</h1>
          <p className="catalog-hero__desc">تلفزيونات أسرة معيّنة: المسجّلة على الحساب، والمتصلة دلوقتي، وإيه اللي شغّال عليها.</p>
        </div>
      </section>

      <section className="panel">
        <form style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }} onSubmit={(e) => { e.preventDefault(); void load() }}>
          <div className="field field--wide">
            <label htmlFor="tv-family">معرّف ولي الأمر (parent id)</label>
            <input id="tv-family" dir="ltr" value={familyId} onChange={(e) => setFamilyId(e.target.value)} />
          </div>
          <button className="button button--primary" type="submit" disabled={!familyId.trim() || loading}>
            <Icon name="search" size={15} />عرض
          </button>
        </form>
      </section>

      {error && <div className="panel panel--notice panel--notice--bad" role="alert"><strong>{error}</strong></div>}
      {loading && <LoadingState />}

      {data && !loading && (
        <section className="panel">
          {data.registered === null && <p className="panel__note" role="status">حالة الأسرة مش متاحة دلوقتي (FamilyState).</p>}
          {data.connected === null && <p className="panel__note" role="status">حالة الاتصال مش متاحة دلوقتي (FamilyLink).</p>}
          {data.registered && data.registered.length === 0 ? <p className="panel__note">مفيش تلفزيونات مسجّلة على الحساب ده.</p> : (
            <div className="table-scroll" tabIndex={0}>
              <table className="data-table">
                <thead><tr><th>التلفزيون</th><th>الحالة</th><th>متصل دلوقتي</th><th>شغّال عليه</th><th>آخر ظهور</th><th /></tr></thead>
                <tbody>
                  {(data.registered ?? []).map((tv) => {
                    const live = connected.get(tv.id)
                    const state = live?.state
                    return (
                      <tr key={tv.id}>
                        <td>{tv.display_name ?? 'تلفزيون'} <small dir="ltr">({tv.platform})</small></td>
                        <td>{tv.status === 'revoked' ? 'ملغي' : 'نشط'}</td>
                        <td>{live ? 'أيوه' : 'لأ'}</td>
                        <td>{state && state.status !== 'idle'
                          ? `${STATUS[state.status] ?? state.status}${state.title ? `: ${state.title}` : ''} (${clock(state.position_ms)} / ${clock(state.duration_ms)})`
                          : '—'}</td>
                        <td dir="ltr">{new Date(tv.last_seen_at).toLocaleString()}</td>
                        <td>
                          {tv.status !== 'revoked' && (
                            <button className="button button--ghost button--small" type="button" disabled={!canRevoke} title={canRevoke ? undefined : 'تحتاج صلاحية manage_permissions'} onClick={() => void revoke(tv.id, tv.display_name)}>
                              إلغاء
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
