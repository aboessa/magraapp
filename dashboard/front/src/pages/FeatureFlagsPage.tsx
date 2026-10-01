import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { hasPermission } from '../lib/adminSession'
import { api } from '../lib/api'
import type { FeatureFlagRecord } from '../types/api'

/// ADM-305: turn app features on and off without a new app build.
///
/// The app reads these from `/app-config` within about two minutes. A flag is
/// on for everyone or off for everyone; per-audience targeting is not
/// evaluated yet. Every change needs a reason, kept in the audit log.

/// Flags the app currently reads. Shown so an operator knows what a key does.
const KNOWN: Record<string, string> = {
  tv_cast: 'زرار «شغّل على التلفزيون» في المشغّل على الموبايل',
  continue_watching: 'صف «كمّل المشاهدة» في الشاشة الرئيسية',
}

export function FeatureFlagsPage() {
  const canPublish = hasPermission('publish')
  const [flags, setFlags] = useState<FeatureFlagRecord[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [newKey, setNewKey] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setFlags((await api.featureFlags()).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const save = async (key: string, enabled: boolean) => {
    setBusy(key)
    setError('')
    try {
      await api.saveFeatureFlag(key, enabled, reason.trim())
      if (key === newKey) setNewKey('')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  const remove = async (key: string) => {
    if (!window.confirm(`حذف العلَم ${key}؟ التطبيق هيرجع للقيمة الافتراضية.`)) return
    setBusy(key)
    try {
      await api.deleteFeatureFlag(key)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setBusy(null)
    }
  }

  if (error && !flags) return <ErrorState message={error} onRetry={() => void load()} />
  if (!flags) return <LoadingState />

  const reasonOk = reason.trim().length >= 3
  const missingKnown = Object.keys(KNOWN).filter((key) => !flags.some((flag) => flag.key === key))

  return (
    <div className="content-studio-root">
      <section className="catalog-hero">
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta"><span className="catalog-hero__eyebrow">التحكّم في التطبيق</span></div>
          <h1 className="catalog-hero__title">أعلام الميزات</h1>
          <p className="catalog-hero__desc">شغّل أو اقفل ميزة في التطبيق من غير نسخة جديدة. التغيير بيوصل للتطبيقات خلال دقيقتين، ولكل الناس.</p>
        </div>
      </section>

      {error && <div className="panel panel--notice panel--notice--bad" role="alert"><strong>{error}</strong></div>}
      {!canPublish && <div className="panel panel--notice" role="status"><strong>تحتاج صلاحية «نشر» لتغيير الأعلام.</strong></div>}

      <section className="panel">
        <div className="field field--wide">
          <label htmlFor="flag-reason">سبب التغيير (إجباري لأي تعديل)</label>
          <input id="flag-reason" value={reason} maxLength={500} disabled={!canPublish} onChange={(e) => setReason(e.target.value)} placeholder="مثال: إيقاف الكاست مؤقتًا لحد ما نصلّح مشكلة" />
        </div>
      </section>

      <section className="panel">
        <div className="table-scroll" tabIndex={0}>
          <table className="data-table">
            <thead><tr><th>المفتاح</th><th>بيتحكم في</th><th>الحالة</th><th /></tr></thead>
            <tbody>
              {flags.map((flag) => (
                <tr key={flag.key}>
                  <td dir="ltr"><code>{flag.key}</code></td>
                  <td>{KNOWN[flag.key] ?? '—'}</td>
                  <td>
                    <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        disabled={!canPublish || !reasonOk || busy !== null}
                        onChange={(e) => void save(flag.key, e.target.checked)}
                        aria-label={`${flag.key}: ${flag.enabled ? 'شغّال' : 'مقفول'}`}
                      />
                      {flag.enabled ? 'شغّال' : 'مقفول'}
                    </label>
                  </td>
                  <td>
                    <button className="button button--ghost button--small" type="button" disabled={!canPublish || busy !== null} onClick={() => void remove(flag.key)}>
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
              {missingKnown.map((key) => (
                <tr key={key}>
                  <td dir="ltr"><code>{key}</code></td>
                  <td>{KNOWN[key]}</td>
                  <td>افتراضي (شغّال)</td>
                  <td>
                    <button className="button button--ghost button--small" type="button" disabled={!canPublish || !reasonOk || busy !== null} onClick={() => void save(key, false)}>
                      اقفلها
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!reasonOk && canPublish && <p className="panel__note">اكتب سبب التغيير فوق عشان تقدر تعدّل.</p>}
      </section>

      <section className="panel">
        <header className="panel__header"><div><h3>علَم جديد</h3></div></header>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <div className="field">
            <label htmlFor="flag-new">المفتاح (حروف إنجليزية صغيرة و _)</label>
            <input id="flag-new" dir="ltr" value={newKey} onChange={(e) => setNewKey(e.target.value.toLowerCase())} placeholder="tv_trailers" />
          </div>
          <button className="button button--primary" type="button" disabled={!canPublish || !reasonOk || !/^[a-z][a-z0-9_]{1,63}$/.test(newKey) || busy !== null} onClick={() => void save(newKey, true)}>
            <Icon name="plus" size={15} />إضافة (شغّال)
          </button>
        </div>
        <p className="panel__note">العلَم الجديد مش هيعمل حاجة لحد ما التطبيق يبقى بيقراه في الكود.</p>
      </section>
    </div>
  )
}
