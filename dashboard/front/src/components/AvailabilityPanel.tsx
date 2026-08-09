import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type {
  AvailabilityMode,
  AvailabilityReason,
  AvailabilityScope,
  AvailabilityView,
} from '../types/api'
import { usePreferences } from '../context/preferences'

/**
 * سياسة الإتاحة الجغرافية لعنصر واحد: الحالة الفعّالة، مصدرها، وتحريرها.
 *
 * ## لماذا «موروثة» و«مُلغاة» مكتوبتان بوضوح
 *
 * حالتان تبدوان متطابقتين على الشاشة ونتيجتهما مختلفة تمامًا: سلسلة متاحة لأن
 * أحدًا لم يقيّدها، وسلسلة متاحة لأن أحدًا ألغى تقييد الكوكب عليها. الأولى تتغيّر
 * تلقائيًا إن قُيِّد الكوكب غدًا، والثانية لا. إخفاء الفرق يجعل المشغّل يظنّ أنه
 * ضبط شيئًا لم يضبطه — أو العكس.
 *
 * ## معاينة بلد
 *
 * «هل هذا ظاهر في فرنسا؟» سؤال تشغيلي يومي، والإجابة عليه بالسفر ليست خيارًا.
 * الحقل يعيد التقييم على الخادم بنفس الدالة التي تفرضها المسارات العامة، فما
 * تُظهره المعاينة هو ما سيحدث فعلًا لا تقديرًا منفصلًا.
 */

const MODES: AvailabilityMode[] = ['worldwide', 'worldwide_except', 'selected_only', 'unavailable']
const REASONS: AvailabilityReason[] = ['rights', 'commercial', 'editorial', 'legal']

const copy = {
  ar: {
    title: 'الإتاحة الجغرافية',
    loading: 'جارٍ قراءة سياسة الإتاحة...',
    loadError: 'تعذر قراءة سياسة الإتاحة',
    saveError: 'تعذر حفظ سياسة الإتاحة',
    effective: 'الحالة الفعّالة',
    available: 'متاح',
    unavailable: 'غير متاح',
    sources: { explicit: 'مُلغاة على هذا العنصر', inherited: 'موروثة', default: 'الافتراضي (لا سياسة)' } as Record<string, string>,
    chain: 'سلسلة الوراثة',
    noPolicy: 'لا سياسة',
    previewCountry: 'معاينة بلد (رمز من حرفين)',
    preview: 'معاينة',
    mode: 'نمط الإتاحة',
    modes: {
      worldwide: 'عالميًا', worldwide_except: 'عالميًا باستثناء', selected_only: 'دول محددة فقط', unavailable: 'غير متاح',
    } as Record<string, string>,
    reason: 'السبب',
    reasons: { rights: 'حقوق', commercial: 'تجاري', editorial: 'تحريري', legal: 'قانوني' } as Record<string, string>,
    countries: 'الدول (رموز من حرفين، مفصولة بفاصلة)',
    countriesHint: 'مطلوبة لنمطَي «عالميًا باستثناء» و«دول محددة فقط».',
    languages: 'اللغات (اختياري)',
    platforms: 'المنصّات (اختياري: ios, android, web, tv)',
    startsAt: 'يبدأ في',
    endsAt: 'ينتهي في',
    note: 'ملاحظة تشغيلية',
    save: 'حفظ السياسة',
    saving: 'جارٍ الحفظ...',
    clear: 'إزالة التخصيص (العودة للوراثة)',
    clearHint: 'الإزالة لا تعني الإتاحة: العنصر يعود لسياسة أصله، وقد تكون مقيّدة.',
    confirmClear: 'إزالة سياسة هذا العنصر والعودة لسياسة أصله؟',
    permission: 'حفظ سياسة الإتاحة يحتاج صلاحية النشر.',
  },
  en: {
    title: 'Territory availability',
    loading: 'Reading the availability policy...',
    loadError: 'Unable to read the availability policy',
    saveError: 'Unable to save the availability policy',
    effective: 'Effective state',
    available: 'Available',
    unavailable: 'Unavailable',
    sources: { explicit: 'Overridden on this entity', inherited: 'Inherited', default: 'Default (no policy)' } as Record<string, string>,
    chain: 'Inheritance chain',
    noPolicy: 'no policy',
    previewCountry: 'Preview country (two-letter code)',
    preview: 'Preview',
    mode: 'Availability mode',
    modes: {
      worldwide: 'Worldwide', worldwide_except: 'Worldwide except', selected_only: 'Selected countries only', unavailable: 'Unavailable',
    } as Record<string, string>,
    reason: 'Reason',
    reasons: { rights: 'Rights', commercial: 'Commercial', editorial: 'Editorial', legal: 'Legal' } as Record<string, string>,
    countries: 'Countries (two-letter codes, comma separated)',
    countriesHint: 'Required for “worldwide except” and “selected only”.',
    languages: 'Languages (optional)',
    platforms: 'Platforms (optional: ios, android, web, tv)',
    startsAt: 'Starts at',
    endsAt: 'Ends at',
    note: 'Operational note',
    save: 'Save policy',
    saving: 'Saving...',
    clear: 'Remove override (fall back to inheritance)',
    clearHint: 'Removing is not the same as making it available: the entity falls back to its ancestor, which may itself be restricted.',
    confirmClear: 'Remove this entity’s policy and fall back to its ancestor?',
    permission: 'Saving an availability policy needs the publish permission.',
  },
}

const csv = (values: string[]) => values.join(', ')
const parseCsv = (value: string) => value.split(',').map((item) => item.trim()).filter(Boolean)

export function AvailabilityPanel({ scope, entityId }: { scope: AvailabilityScope; entityId: string }) {
  const { locale } = usePreferences()
  const text = copy[locale === 'en' ? 'en' : 'ar']

  const [view, setView] = useState<AvailabilityView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [previewCountry, setPreviewCountry] = useState('')

  const [mode, setMode] = useState<AvailabilityMode>('worldwide')
  const [reason, setReason] = useState<AvailabilityReason>('rights')
  const [countries, setCountries] = useState('')
  const [languages, setLanguages] = useState('')
  const [platforms, setPlatforms] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(async (country?: string) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.availability(scope, entityId, country || undefined)
      setView(response.data)
      const own = response.data.own_policy
      // الحقول تُهيَّأ من سياسة العنصر نفسه لا من الفعّالة: تهيئتها من سياسة
      // موروثة تجعل أول «حفظ» ينسخ قيد الأصل إلى العنصر بلا قصد، فيصبح مُلغى
      // بلا أن يطلب أحد ذلك.
      if (own) {
        setMode(own.mode)
        setReason(own.reason)
        setCountries(csv(own.countries))
        setLanguages(csv(own.languages))
        setPlatforms(csv(own.platforms))
        setStartsAt(own.starts_at?.slice(0, 10) ?? '')
        setEndsAt(own.ends_at?.slice(0, 10) ?? '')
        setNote(own.note ?? '')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [entityId, scope, text.loadError])

  useEffect(() => { void load() }, [load])

  async function save() {
    setSaving(true)
    setError('')
    try {
      const response = await api.saveAvailability(scope, entityId, {
        mode,
        countries: parseCsv(countries),
        languages: parseCsv(languages),
        platforms: parseCsv(platforms),
        // تاريخ بلا وقت يُرسَل كبداية اليوم/نهايته بالتوقيت العالمي، لأن الخادم
        // يقارن سلاسل ISO ومقارنة تاريخ مجرّد بزمن كامل تُخطئ في يوم الحد.
        starts_at: startsAt ? `${startsAt}T00:00:00.000Z` : null,
        ends_at: endsAt ? `${endsAt}T23:59:59.999Z` : null,
        reason,
        note: note.trim() || null,
      })
      setView(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  async function clear() {
    if (!window.confirm(text.confirmClear)) return
    setSaving(true)
    setError('')
    try {
      const response = await api.clearAvailability(scope, entityId)
      setView(response.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  const decision = view?.decision
  const needsCountries = mode === 'worldwide_except' || mode === 'selected_only'

  return (
    <section className="panel">
      <header className="panel__header"><div><h3>{text.title}</h3></div></header>

      {loading && <p className="readiness-note" role="status">{text.loading}</p>}
      {error && <p className="inline-alert inline-alert--error" role="alert">{error}</p>}

      {decision && (
        <div className={`availability-state availability-state--${decision.available ? 'on' : 'off'}`}>
          <div className="availability-state__head">
            <strong>{text.effective}: {decision.available ? text.available : text.unavailable}</strong>
            <span className="availability-state__source">{text.sources[decision.source]}</span>
          </div>
          <p className="availability-state__message">{decision.message_ar}</p>
          {view?.evaluated_for.country && (
            <p className="readiness-note" dir="ltr">country={view.evaluated_for.country}</p>
          )}
        </div>
      )}

      {view && (
        <details className="readiness-group">
          <summary>{text.chain}</summary>
          <ul className="readiness-list">
            {view.chain.map((entry) => (
              <li key={`${entry.entity_type}:${entry.entity_id}`} className="readiness-item readiness-item--not_applicable">
                <div className="readiness-item__head">
                  <span className="readiness-item__label" dir="ltr">{entry.entity_type} · {entry.entity_id}</span>
                  <span className="readiness-item__owner">
                    {entry.policy ? `${text.modes[entry.policy.mode]} · ${text.reasons[entry.policy.reason]}` : text.noPolicy}
                  </span>
                </div>
                {entry.policy?.countries.length ? (
                  <p className="readiness-item__detail" dir="ltr">{csv(entry.policy.countries)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="filters-row">
        <label className="field">
          <span>{text.previewCountry}</span>
          <input value={previewCountry} maxLength={2} dir="ltr" onChange={(event) => setPreviewCountry(event.target.value.toUpperCase())} />
        </label>
        <button type="button" className="button button--ghost" onClick={() => void load(previewCountry)} disabled={loading}>
          {text.preview}
        </button>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>{text.mode}</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as AvailabilityMode)}>
            {MODES.map((item) => <option value={item} key={item}>{text.modes[item]}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{text.reason}</span>
          <select value={reason} onChange={(event) => setReason(event.target.value as AvailabilityReason)}>
            {REASONS.map((item) => <option value={item} key={item}>{text.reasons[item]}</option>)}
          </select>
        </label>
      </div>

      <label className="field">
        <span>{text.countries}</span>
        <input value={countries} dir="ltr" onChange={(event) => setCountries(event.target.value.toUpperCase())} placeholder="SA, AE, EG" />
        {needsCountries && <small>{text.countriesHint}</small>}
      </label>

      <div className="form-grid">
        <label className="field">
          <span>{text.languages}</span>
          <input value={languages} dir="ltr" onChange={(event) => setLanguages(event.target.value)} placeholder="ar, en, fr" />
        </label>
        <label className="field">
          <span>{text.platforms}</span>
          <input value={platforms} dir="ltr" onChange={(event) => setPlatforms(event.target.value)} placeholder="ios, android" />
        </label>
      </div>

      <div className="form-grid">
        <label className="field date-field"><span>{text.startsAt}</span><input type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
        <label className="field date-field"><span>{text.endsAt}</span><input type="date" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
      </div>

      <label className="field">
        <span>{text.note}</span>
        <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>

      <div className="form-actions">
        {view?.own_policy && (
          <button type="button" className="button button--ghost" onClick={() => void clear()} disabled={saving}>
            {text.clear}
          </button>
        )}
        <button type="button" className="button button--primary" onClick={() => void save()} disabled={saving}>
          {saving ? text.saving : text.save}
        </button>
      </div>
      <p className="readiness-note">{text.clearHint}</p>
      <p className="readiness-note">{text.permission}</p>
    </section>
  )
}
