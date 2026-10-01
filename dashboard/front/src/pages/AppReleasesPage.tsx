import { useCallback, useEffect, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { hasPermission } from '../lib/adminSession'
import { api } from '../lib/api'

/// ADM-304: app versions in use and the forced-update gate, from real data.
///
/// The page used to show a hardcoded release registry (2.5.0, "2.2% legacy
/// clients") with no API call. It now shows what the app reports with every
/// analytics event (`X-App-Version`) and edits the two `remote_config` keys the
/// app's update gate actually reads.

type Health = Awaited<ReturnType<typeof api.appHealth>>['data']

const copy = {
  ar: {
    eyebrow: 'التحكّم في التطبيق', title: 'إصدارات التطبيق والتحديث الإجباري',
    lede: 'الإصدارات اللي الأسر بتستخدمها فعلًا في آخر 30 يوم، وأقل إصدار مسموح بيه.',
    gate: 'التحديث الإجباري', minVersion: 'أقل إصدار مسموح (min_app_version)',
    storeUrl: 'رابط التحديث (forced_update_url)', save: 'حفظ', saving: 'جارٍ الحفظ…',
    saved: 'اتحفظ. التطبيقات بتقرا الإعداد ده خلال دقيقتين.',
    gateHint: 'أي نسخة أقدم من الرقم ده هتطلب من المستخدم يحدّث قبل ما يكمل.',
    denied: 'تحتاج صلاحية «نشر» لتغيير التحديث الإجباري.',
    versions: 'الإصدارات المستخدمة (آخر 30 يوم)', version: 'الإصدار', families: 'أسر', events: 'أحداث', lastSeen: 'آخر ظهور',
    unknown: 'غير مسجّل (أحداث قديمة)', blocked: 'هيتطلب منها التحديث',
    empty: 'لسه مفيش أحداث مسجّلة بإصدار التطبيق.',
    warnBlocks: (n: number) => `الحد ده هيطلب التحديث من ${n} أسرة نشطة.`,
  },
  en: {
    eyebrow: 'App control', title: 'App releases & forced update',
    lede: 'Versions families actually used in the last 30 days, and the minimum allowed.',
    gate: 'Forced update', minVersion: 'Minimum version (min_app_version)',
    storeUrl: 'Update link (forced_update_url)', save: 'Save', saving: 'Saving…',
    saved: 'Saved. Apps read this within two minutes.',
    gateHint: 'Any build older than this asks the user to update before continuing.',
    denied: 'The "publish" permission is required to change the forced update.',
    versions: 'Versions in use (last 30 days)', version: 'Version', families: 'Families', events: 'Events', lastSeen: 'Last seen',
    unknown: 'Not recorded (older events)', blocked: 'Will be asked to update',
    empty: 'No events recorded with an app version yet.',
    warnBlocks: (n: number) => `This minimum asks ${n} active families to update.`,
  },
}

/// Numeric comparison of dotted versions; `+build` and `-tag` are ignored.
function compareVersions(a: string, b: string) {
  const parts = (v: string) => v.split(/[+-]/)[0].split('.').map((n) => Number(n) || 0)
  const x = parts(a)
  const y = parts(b)
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    const left = x[i] === undefined ? 0 : x[i]
    const right = y[i] === undefined ? 0 : y[i]
    const d = left - right
    if (d !== 0) return d
  }
  return 0
}

export function AppReleasesPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const canPublish = hasPermission('publish')
  const [data, setData] = useState<Health | null>(null)
  const [error, setError] = useState('')
  const [minVersion, setMinVersion] = useState('')
  const [storeUrl, setStoreUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const health = (await api.appHealth()).data
      setData(health)
      setMinVersion(health.settings.min_app_version ?? '')
      setStoreUrl(health.settings.forced_update_url ?? '')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  if (error && !data) return <ErrorState message={error} onRetry={() => void load()} />
  if (!data) return <LoadingState />

  const validVersion = /^\d{1,4}(\.\d{1,4}){0,3}$/.test(minVersion.trim())
  const blockedFamilies = validVersion
    ? data.versions.filter((v) => v.version && compareVersions(v.version, minVersion.trim()) < 0)
      .reduce((sum, v) => sum + Number(v.families), 0)
    : 0
  const dirty = minVersion.trim() !== (data.settings.min_app_version ?? '') || storeUrl.trim() !== (data.settings.forced_update_url ?? '')

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      if (minVersion.trim() !== (data.settings.min_app_version ?? '')) {
        await api.saveRemoteConfig('min_app_version', { value: minVersion.trim() })
      }
      if (storeUrl.trim() !== (data.settings.forced_update_url ?? '')) {
        await api.saveRemoteConfig('forced_update_url', { value: storeUrl.trim() })
      }
      setSaved(true)
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content-studio-root">
      <section className="catalog-hero">
        <div className="catalog-hero__content">
          <div className="catalog-hero__meta"><span className="catalog-hero__eyebrow">{text.eyebrow}</span></div>
          <h1 className="catalog-hero__title">{text.title}</h1>
          <p className="catalog-hero__desc">{text.lede}</p>
        </div>
      </section>

      {error && <div className="panel panel--notice panel--notice--bad" role="alert"><strong>{error}</strong></div>}
      {saved && !dirty && <div className="panel panel--notice panel--notice--ok" role="status"><strong>{text.saved}</strong></div>}

      <section className="panel">
        <header className="panel__header"><div><h3>{text.gate}</h3><p className="panel__note">{text.gateHint}</p></div></header>
        {!canPublish && <p className="panel__note" role="status">{text.denied}</p>}
        <div className="field">
          <label htmlFor="min-version">{text.minVersion}</label>
          <input id="min-version" dir="ltr" value={minVersion} disabled={!canPublish || saving} onChange={(e) => setMinVersion(e.target.value)} placeholder="0.1.4" />
        </div>
        <div className="field field--wide">
          <label htmlFor="store-url">{text.storeUrl}</label>
          <input id="store-url" dir="ltr" value={storeUrl} disabled={!canPublish || saving} onChange={(e) => setStoreUrl(e.target.value)} placeholder="https://play.google.com/store/apps/details?id=com.majarra.majarra" />
        </div>
        {validVersion && blockedFamilies > 0 && (
          <p className="panel__note" role="note"><Icon name="warning" size={14} /> {text.warnBlocks(blockedFamilies)}</p>
        )}
        <div className="mode-actions__buttons">
          <button className="button button--primary" type="button" disabled={!canPublish || saving || !dirty || !validVersion} onClick={() => void save()}>
            <Icon name="check" size={15} />{saving ? text.saving : text.save}
          </button>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><div><h3>{text.versions}</h3></div></header>
        {data.versions.length === 0 ? <p className="panel__note">{text.empty}</p> : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <thead><tr><th>{text.version}</th><th>{text.families}</th><th>{text.events}</th><th>{text.lastSeen}</th><th /></tr></thead>
              <tbody>
                {data.versions.map((v) => (
                  <tr key={v.version ?? 'none'}>
                    <td dir="ltr">{v.version ?? text.unknown}</td>
                    <td>{v.families}</td>
                    <td>{v.events}</td>
                    <td dir="ltr">{v.last_seen}</td>
                    <td>{v.version && validVersion && compareVersions(v.version, minVersion.trim()) < 0 ? text.blocked : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
