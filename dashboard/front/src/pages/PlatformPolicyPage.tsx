import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorState, LoadingState } from '../components/PageState'
import { Icon } from '../components/Icon'
import { usePreferences } from '../context/preferences'
import { hasPermission } from '../lib/adminSession'
import { api } from '../lib/api'
import type {
  PlanLimitField,
  PlanLimitTable,
  PlatformPolicySection,
  PlatformPolicySnapshot,
} from '../types/api'

/// ADMIN-POLICY: every product limit an operator may change, on one page.
///
/// Each section saves on its own, with a written reason that goes to the audit
/// log, and each save becomes a new policy version that refusals then cite.
/// Values are bounded by the server; the inputs show the same bounds so a
/// refusal is never a surprise.

const PLANS = ['free', 'family', 'family_plus'] as const
const FIELDS: PlanLimitField[] = ['devices', 'tvDevices', 'concurrentStreams', 'children', 'downloadDevices', 'offlineItems']

const copy = {
  ar: {
    eyebrow: 'الإعدادات', title: 'سياسة الباقات والمنصّة',
    lede: 'الأرقام اللي بيطبّقها السيرفر فعلًا على كل الأسر. أي حفظ بيتسجّل بسببه ويبقى نسخة جديدة من السياسة، ويوصل لكل السيرفرات خلال دقيقة.',
    plans: { free: 'مجانية', family: 'عائلية', family_plus: 'عائلية بلس' },
    fields: {
      devices: 'موبايل وتابلت', tvDevices: 'تلفزيونات', concurrentStreams: 'شاشات في نفس الوقت',
      children: 'ملفات أطفال', downloadDevices: 'أجهزة التنزيل', offlineItems: 'عناصر محفوظة أوفلاين',
    },
    hints: {
      devices: 'الأجهزة المسجّل عليها دخول دلوقتي. الجهاز اللي خرج مش بيتحسب.',
      tvDevices: 'منفصلة عن الموبايلات. صفر = الباقة من غير تلفزيون.',
      concurrentStreams: 'ده اللي بيمنع التفرج على أكتر من شاشة في نفس الوقت.',
      children: '', downloadDevices: 'صفر = التنزيل مش متاح في الباقة.', offlineItems: '',
    },
    sections: {
      plan_limits: 'حدود الباقات',
      tv_pairing: 'ربط التلفزيون',
      offline_license: 'المشاهدة من غير إنترنت',
    },
    tv: { code_ttl_minutes: 'صلاحية الكود (دقايق)', poll_interval_seconds: 'التلفزيون يسأل كل (ثواني)' },
    offline: { ttl_days: 'التنزيل يشتغل من غير نت لمدة (أيام)' },
    source: { stored: 'متعدّلة من اللوحة', cached: 'آخر قيمة محفوظة (قاعدة البيانات مش متاحة)', default: 'الافتراضي من الكود' },
    version: 'النسخة', updatedBy: 'آخر تعديل', reason: 'سبب التغيير (إجباري)',
    reasonPlaceholder: 'مثال: زيادة التلفزيونات في العائلية بعد طلبات الدعم',
    save: 'حفظ', saving: 'جارٍ الحفظ…', discard: 'تراجع', reset: 'رجوع للافتراضي',
    saved: 'اتحفظ. التغيير هيوصل لكل السيرفرات خلال دقيقة.',
    denied: 'تحتاج صلاحية «نشر» لتعديل السياسة.',
    range: (min: number, max: number) => `من ${min} لـ ${max}`,
    confirmReset: 'ترجع القسم ده للأرقام الافتراضية؟ هيتسجل نسخة جديدة.',
    notEditable: 'مش موجودة هنا عن قصد (إعدادات أمان بتتغير بمراجعة ونشر): مدد التوكنات، طول كود الربط، تذكرة الاتصال، حدود الطلبات، حساب وقت الشاشة.',
    lowerWarning: 'تقليل حد مش بيطرد حد دلوقتي: بيتطبّق على أول دخول أو تشغيل جاي.',
  },
  en: {
    eyebrow: 'Settings', title: 'Plan & platform policy',
    lede: 'The numbers the server actually enforces for every family. Each save is audited with its reason, becomes a new policy version, and reaches every server within a minute.',
    plans: { free: 'Free', family: 'Family', family_plus: 'Family Plus' },
    fields: {
      devices: 'Phones & tablets', tvDevices: 'TVs', concurrentStreams: 'Simultaneous streams',
      children: 'Child profiles', downloadDevices: 'Download devices', offlineItems: 'Offline items',
    },
    hints: {
      devices: 'Devices signed in right now. A signed-out device does not count.',
      tvDevices: 'Separate from phones. 0 = no TV on this plan.',
      concurrentStreams: 'This is what stops watching on several screens at once.',
      children: '', downloadDevices: '0 = downloads not included.', offlineItems: '',
    },
    sections: { plan_limits: 'Plan limits', tv_pairing: 'TV pairing', offline_license: 'Offline viewing' },
    tv: { code_ttl_minutes: 'Code valid for (minutes)', poll_interval_seconds: 'TV checks every (seconds)' },
    offline: { ttl_days: 'Downloads play offline for (days)' },
    source: { stored: 'Edited from the dashboard', cached: 'Last saved value (database unavailable)', default: 'Code default' },
    version: 'Version', updatedBy: 'Last change', reason: 'Reason for the change (required)',
    reasonPlaceholder: 'e.g. more TVs on Family after support requests',
    save: 'Save', saving: 'Saving…', discard: 'Discard', reset: 'Restore defaults',
    saved: 'Saved. It reaches every server within a minute.',
    denied: 'The "publish" permission is required to change policy.',
    range: (min: number, max: number) => `${min}–${max}`,
    confirmReset: 'Restore this section to the defaults? It becomes a new version.',
    notEditable: 'Not here on purpose (security settings changed by review and deploy): token lifetimes, pairing-code length, link ticket, rate limits, screen-time accounting.',
    lowerWarning: 'Lowering a limit evicts no one now: it applies at the next sign-in or playback.',
  },
}

type Drafts = {
  plan_limits: PlanLimitTable
  tv_pairing: PlatformPolicySnapshot['sections']['tv_pairing']['value']
  offline_license: PlatformPolicySnapshot['sections']['offline_license']['value']
}

function draftsOf(snapshot: PlatformPolicySnapshot): Drafts {
  return {
    plan_limits: structuredClone(snapshot.sections.plan_limits.value),
    tv_pairing: { ...snapshot.sections.tv_pairing.value },
    offline_license: { ...snapshot.sections.offline_license.value },
  }
}

export function PlatformPolicyPage() {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']
  const canPublish = hasPermission('publish')
  const [snapshot, setSnapshot] = useState<PlatformPolicySnapshot | null>(null)
  const [drafts, setDrafts] = useState<Drafts | null>(null)
  const [reasons, setReasons] = useState<Record<PlatformPolicySection, string>>({ plan_limits: '', tv_pairing: '', offline_license: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<PlatformPolicySection | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<PlatformPolicySection | null>(null)

  const apply = (next: PlatformPolicySnapshot) => {
    setSnapshot(next)
    setDrafts(draftsOf(next))
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      apply((await api.platformPolicy()).data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const dirty = useMemo(() => {
    if (!snapshot || !drafts) return { plan_limits: false, tv_pairing: false, offline_license: false }
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
    return {
      plan_limits: !same(drafts.plan_limits, snapshot.sections.plan_limits.value),
      tv_pairing: !same(drafts.tv_pairing, snapshot.sections.tv_pairing.value),
      offline_license: !same(drafts.offline_license, snapshot.sections.offline_license.value),
    }
  }, [snapshot, drafts])

  const save = async (section: PlatformPolicySection) => {
    if (!drafts) return
    setBusy(section)
    setError('')
    setSaved(null)
    try {
      apply((await api.savePlatformPolicy(section, drafts[section], reasons[section].trim())).data)
      setReasons((current) => ({ ...current, [section]: '' }))
      setSaved(section)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Save failed')
    } finally {
      setBusy(null)
    }
  }

  const reset = async (section: PlatformPolicySection) => {
    if (!window.confirm(text.confirmReset)) return
    setBusy(section)
    setError('')
    try {
      apply((await api.resetPlatformPolicy(section, reasons[section].trim() || 'restore defaults')).data)
      setSaved(section)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Reset failed')
    } finally {
      setBusy(null)
    }
  }

  if (loading) return <LoadingState />
  if (!snapshot || !drafts) return <ErrorState message={error} onRetry={() => void load()} />

  const setPlanValue = (plan: typeof PLANS[number], field: PlanLimitField, value: number) =>
    setDrafts((current) => current && ({
      ...current,
      plan_limits: { ...current.plan_limits, [plan]: { ...current.plan_limits[plan], [field]: value } },
    }))

  const lowered = PLANS.some((plan) => FIELDS.some((field) =>
    drafts.plan_limits[plan][field] < snapshot.sections.plan_limits.value[plan][field]))

  const meta = (section: PlatformPolicySection) => {
    const loaded = snapshot.sections[section]
    return (
      <p className="panel__note">
        {text.version} <strong>{loaded.version}</strong> · {text.source[loaded.source]}
        {loaded.updated_at && <> · {text.updatedBy}: {loaded.updated_by ?? '—'} ({loaded.updated_at})</>}
      </p>
    )
  }

  const actions = (section: PlatformPolicySection) => {
    const reasonOk = reasons[section].trim().length >= 3
    const fieldId = `policy-reason-${section}`
    return (
      <div className="mode-actions">
        <div className="field field--wide">
          <label htmlFor={fieldId}>{text.reason}</label>
          <input
            id={fieldId}
            value={reasons[section]}
            placeholder={text.reasonPlaceholder}
            maxLength={500}
            disabled={!canPublish || busy !== null}
            onChange={(event) => setReasons((current) => ({ ...current, [section]: event.target.value }))}
          />
        </div>
        <div className="mode-actions__buttons">
          <button className="button button--ghost" type="button" disabled={busy !== null || !canPublish} onClick={() => void reset(section)}>
            <Icon name="refresh" size={15} />{text.reset}
          </button>
          <button
            className="button button--ghost" type="button" disabled={!dirty[section] || busy !== null}
            onClick={() => setDrafts(draftsOf(snapshot))}
          >
            {text.discard}
          </button>
          <button
            className="button button--primary" type="button"
            disabled={!dirty[section] || !reasonOk || busy !== null || !canPublish}
            title={canPublish ? undefined : text.denied}
            onClick={() => void save(section)}
          >
            <Icon name="check" size={15} />{busy === section ? text.saving : text.save}
          </button>
        </div>
      </div>
    )
  }

  const numberInput = (id: string, label: string, value: number, [min, max]: [number, number], onChange: (n: number) => void) => (
    <input
      id={id}
      type="number"
      inputMode="numeric"
      aria-label={label}
      min={min}
      max={max}
      step={1}
      value={value}
      disabled={!canPublish || busy !== null}
      onChange={(event) => {
        const next = Number(event.target.value)
        if (Number.isFinite(next)) onChange(Math.trunc(next))
      }}
      style={{ width: '6rem' }}
    />
  )

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
      {saved && !dirty[saved] && <div className="panel panel--notice panel--notice--ok" role="status"><strong>{text.saved}</strong></div>}
      {!canPublish && <div className="panel panel--notice" role="status"><strong>{text.denied}</strong></div>}

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.sections.plan_limits}</span>
            <h3>{text.sections.plan_limits}</h3>
            {meta('plan_limits')}
          </div>
        </header>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{''}</th>
                {PLANS.map((plan) => <th key={plan} scope="col">{text.plans[plan]}</th>)}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((field) => {
                const bounds = snapshot.bounds.plan_limits[field]
                return (
                  <tr key={field}>
                    <th scope="row">
                      <div>{text.fields[field]}</div>
                      <small className="panel__note">{text.range(bounds[0], bounds[1])}{text.hints[field] ? ` · ${text.hints[field]}` : ''}</small>
                    </th>
                    {PLANS.map((plan) => (
                      <td key={plan}>
                        {numberInput(`limit-${plan}-${field}`, `${text.fields[field]} — ${text.plans[plan]}`,
                          drafts.plan_limits[plan][field], bounds, (n) => setPlanValue(plan, field, n))}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {lowered && <p className="panel__note" role="note"><Icon name="warning" size={14} /> {text.lowerWarning}</p>}
        {actions('plan_limits')}
      </section>

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.sections.tv_pairing}</span>
            <h3>{text.sections.tv_pairing}</h3>
            {meta('tv_pairing')}
          </div>
        </header>
        {(Object.keys(text.tv) as Array<keyof typeof text.tv>).map((key) => (
          <div className="field" key={key}>
            <label htmlFor={`tv-${key}`}>{text.tv[key]} <small>({text.range(...snapshot.bounds.tv_pairing[key])})</small></label>
            {numberInput(`tv-${key}`, text.tv[key], drafts.tv_pairing[key], snapshot.bounds.tv_pairing[key],
              (n) => setDrafts((current) => current && ({ ...current, tv_pairing: { ...current.tv_pairing, [key]: n } })))}
          </div>
        ))}
        {actions('tv_pairing')}
      </section>

      <section className="panel">
        <header className="panel__header">
          <div>
            <span className="panel__kicker">{text.sections.offline_license}</span>
            <h3>{text.sections.offline_license}</h3>
            {meta('offline_license')}
          </div>
        </header>
        <div className="field">
          <label htmlFor="offline-ttl_days">{text.offline.ttl_days} <small>({text.range(...snapshot.bounds.offline_license.ttl_days)})</small></label>
          {numberInput('offline-ttl_days', text.offline.ttl_days, drafts.offline_license.ttl_days, snapshot.bounds.offline_license.ttl_days,
            (n) => setDrafts((current) => current && ({ ...current, offline_license: { ttl_days: n } })))}
        </div>
        {actions('offline_license')}
      </section>

      <section className="panel panel--notice" role="note">
        <Icon name="rights" size={16} /> <span>{text.notEditable}</span>
      </section>
    </div>
  )
}
