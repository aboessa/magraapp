import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '../Icon'
import { ErrorState, LoadingState } from '../PageState'
import { usePreferences } from '../../context/preferences'
import { api } from '../../lib/api'
import { LOCALIZATION_STATUSES } from '../../types/gamePack'
import type { GameLocalizationRecord, GameLocalizationsEnvelope, LocalizationStatus } from '../../types/gamePack'

/**
 * تأليف الترجمات لكل لغة.
 *
 * ## اللغات تأتي من الخادم
 *
 * `languages` في الاستجابة هي مصدر القائمة المعروضة، لا مصفوفة مكتوبة هنا.
 * إضافة لغة رابعة تعني تعديل `GAME_LANGUAGES` وقيد CHECK في المهاجرة — ولا سطر
 * واحد في هذه الشاشة. الحقول نفسها مبنيّة من `required_prompt_keys` و
 * `voice_keys` التي تُشتقّ من الحزمة، فلا قائمة مفاتيح مكرَّرة تنحرف عنها.
 *
 * ## الهندسة ليست لغة
 *
 * الإحداثيّات مشتركة بين كل اللغات وليست ضمن هذه الشاشة إطلاقًا: تكرارها لكل لغة
 * يعني إصلاح الخطّة ثلاث مرات ثم تركها تنحرف. وحزمة `language_specific` — أشكال
 * الحروف العربية مثلًا — **لا تُترجم**: تُؤلَّف كلعبة مستقلّة بصفّ خاص بها
 * وهندسة خاصة بها. الترجمة الآلية لها مرفوضة من الخادم لا مُستحسَن تجنّبها.
 */

const copy = {
  ar: {
    kicker: 'اللغات',
    title: 'الترجمات',
    intro: 'العنوان والتعليمات ونصوص التوجيه لكل لغة. الهندسة مشتركة ولا تُترجم.',
    loading: 'جارٍ تحميل الترجمات...',
    loadError: 'تعذر تحميل الترجمات',
    saveError: 'تعذر حفظ الترجمة',
    saved: 'حُفظت الترجمة.',
    refresh: 'تحديث',
    save: 'حفظ اللغة',
    saving: 'جارٍ الحفظ...',
    titleField: 'العنوان',
    instructions: 'التعليمات',
    prompts: 'نصوص التوجيه',
    promptsHint: 'المفاتيح من الحزمة نفسها. المفتاح بلا نصّ يظهر للطفل كما هو.',
    missing: 'ناقص',
    present: 'مكتمل',
    extraPrompts: 'مفاتيح لا يشير إليها أي مستوى',
    voice: 'صوت خاص بهذه اللغة',
    voiceHint: 'يستبدل الأصل المُعلَن في الحزمة. الصوت خاصّ بكل لغة بطبيعته، بخلاف الهندسة.',
    status: 'حالة الترجمة',
    statuses: {
      draft: 'مسودة', review_lang: 'مراجعة لغوية', ready: 'جاهزة',
      published: 'منشورة', archived: 'مؤرشفة',
    } as Record<LocalizationStatus, string>,
    translatedFrom: 'مترجمة من',
    none: 'ليست ترجمة',
    machine: 'ترجمة آليّة',
    machineHint: 'تُعلَن صراحةً حتى تُراجَع بشريًا قبل الجاهزية.',
    geometryNote: 'الإحداثيّات والتفاوت والتغطية مشتركة بين كل اللغات: تُحرَّر في تبويب الحزمة مرة واحدة.',
    specificNote: 'هذه الحزمة language_specific: تُؤلَّف لكل لغة كلعبة مستقلّة بهندستها الخاصة ولا تُترجم. الترجمة الآليّة لها مرفوضة من الخادم.',
    noRow: 'لا صفّ ترجمة لهذه اللغة بعد. الحفظ يُنشئه.',
    updated: 'آخر تحديث',
    policy: 'سياسة الترجمة',
    warnings: 'تنبيهات الخادم',
    coverage: (done: number, total: number) => `${done} من ${total} نصّ توجيه`,
  },
  en: {
    kicker: 'Languages',
    title: 'Localizations',
    intro: 'Title, instructions and prompt text per language. Geometry is shared and is not translated.',
    loading: 'Loading localizations...',
    loadError: 'Unable to load localizations',
    saveError: 'Unable to save the localization',
    saved: 'Localization saved.',
    refresh: 'Refresh',
    save: 'Save language',
    saving: 'Saving...',
    titleField: 'Title',
    instructions: 'Instructions',
    prompts: 'Prompt text',
    promptsHint: 'The keys come from the pack itself. A key with no text is shown to the child as-is.',
    missing: 'Missing',
    present: 'Complete',
    extraPrompts: 'Keys no level references',
    voice: 'Voice for this language',
    voiceHint: 'Overrides the asset declared in the pack. Audio is per-language by nature, unlike geometry.',
    status: 'Localization status',
    statuses: {
      draft: 'Draft', review_lang: 'Language review', ready: 'Ready',
      published: 'Published', archived: 'Archived',
    } as Record<LocalizationStatus, string>,
    translatedFrom: 'Translated from',
    none: 'Not a translation',
    machine: 'Machine translated',
    machineHint: 'Declared explicitly so it is reviewed by a human before it can be ready.',
    geometryNote: 'Coordinates, tolerance and coverage are shared across every language and are edited once in the pack tab.',
    specificNote: 'This pack is language_specific: each language is authored as an independent game with its own geometry and is never translated. Machine translation is refused by the server.',
    noRow: 'No localization row for this language yet. Saving creates it.',
    updated: 'Last updated',
    policy: 'Localization policy',
    warnings: 'Server warnings',
    coverage: (done: number, total: number) => `${done} of ${total} prompts`,
  },
}

type Draft = {
  title: string
  instructions: string
  prompts: Record<string, string>
  voice_manifest: Record<string, string>
  status: LocalizationStatus
  translated_from: string
  is_machine_translated: boolean
}

function draftOf(row: GameLocalizationRecord | null): Draft {
  return {
    title: row?.title ?? '',
    instructions: row?.instructions ?? '',
    prompts: { ...(row?.prompts ?? {}) },
    voice_manifest: { ...(row?.voice_manifest ?? {}) },
    status: (row?.status as LocalizationStatus) ?? 'draft',
    translated_from: row?.translated_from ?? '',
    is_machine_translated: row?.is_machine_translated ?? false,
  }
}

export function GameLocalizationPanel({ gameId }: { gameId: string }) {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [envelope, setEnvelope] = useState<GameLocalizationsEnvelope | null>(null)
  const [language, setLanguage] = useState('')
  const [draft, setDraft] = useState<Draft>(draftOf(null))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [warnings, setWarnings] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.gameLocalizations(gameId)
      setEnvelope(response.data)
      setLanguage((current) => current || response.data.languages[0] || 'ar')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [gameId, text.loadError])

  useEffect(() => { void load() }, [load])

  const row = useMemo(
    () => envelope?.localizations.find((entry) => entry.language === language) ?? null,
    [envelope, language],
  )

  useEffect(() => {
    setDraft(draftOf(row))
    setStatus('')
    setWarnings([])
  }, [row])

  if (loading && !envelope) return <LoadingState label={text.loading} />
  if (error && !envelope) return <ErrorState message={error} onRetry={() => void load()} />
  if (!envelope) return null

  const requiredKeys = envelope.required_prompt_keys
  const extraKeys = Object.keys(draft.prompts).filter((key) => !requiredKeys.includes(key)).sort()
  const done = requiredKeys.filter((key) => draft.prompts[key]?.trim()).length
  const isLanguageSpecific = envelope.localization_policy === 'language_specific'

  async function save() {
    setSaving(true)
    setError('')
    setStatus('')
    setWarnings([])
    try {
      const response = await api.saveGameLocalization(gameId, language, {
        title: draft.title.trim() || null,
        instructions: draft.instructions.trim() || null,
        prompts: draft.prompts,
        voice_manifest: draft.voice_manifest,
        status: draft.status,
        translated_from: draft.translated_from || null,
        is_machine_translated: draft.is_machine_translated,
      })
      setStatus(text.saved)
      setWarnings(response.data.warnings ?? [])
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.saveError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="panel">
      <header className="panel__header panel__header--filters">
        <div>
          <span className="panel__kicker">{text.kicker}</span>
          <h3>{text.title}</h3>
          <p>{text.intro}</p>
        </div>
        <div className="filters-row">
          <span className="track-badge">{text.policy}: {envelope.localization_policy ?? '—'}</span>
          <button className="button button--secondary" type="button" onClick={() => void load()}>
            <Icon name="refresh" size={16} />{text.refresh}
          </button>
        </div>
      </header>

      <div className="entity-form">
        <p className="panel--notice">{text.geometryNote}</p>
        {isLanguageSpecific && <p className="panel--notice">{text.specificNote}</p>}

        <nav className="library-tabs" role="tablist" aria-label={text.kicker}>
          {envelope.languages.map((code) => {
            const entry = envelope.localizations.find((item) => item.language === code)
            const complete = entry ? requiredKeys.every((key) => entry.prompts[key]) && Boolean(entry.title) : false
            return (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={code === language}
                className={code === language ? 'library-tab library-tab--active' : 'library-tab'}
                onClick={() => setLanguage(code)}
              >
                <span dir="ltr">{code}</span>
                <strong>{entry ? (complete ? text.present : text.missing) : '—'}</strong>
              </button>
            )
          })}
        </nav>

        {error && <div className="inline-alert inline-alert--error">{error}</div>}
        {status && <div className="inline-alert inline-alert--info">{status}</div>}
        {warnings.length > 0 && (
          <div className="inline-alert inline-alert--info">
            <strong>{text.warnings}</strong>
            <ul className="planned-list">{warnings.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        )}
        {!row && <p className="data-unavailable">{text.noRow}</p>}
        {row?.updated_at && <small>{text.updated}: <span dir="ltr">{row.updated_at}</span></small>}

        <div className="form-grid">
          <label className="field">
            <span>{text.titleField}</span>
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label className="field">
            <span>{text.status}</span>
            <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as LocalizationStatus })}>
              {LOCALIZATION_STATUSES.map((value) => <option value={value} key={value}>{text.statuses[value]}</option>)}
            </select>
          </label>
        </div>

        <label className="field">
          <span>{text.instructions}</span>
          <textarea rows={3} value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} />
        </label>

        <div className="form-grid">
          <label className="field">
            <span>{text.translatedFrom}</span>
            <select value={draft.translated_from} onChange={(event) => setDraft({ ...draft, translated_from: event.target.value })}>
              <option value="">{text.none}</option>
              {envelope.languages.filter((code) => code !== language).map((code) => <option value={code} key={code}>{code}</option>)}
            </select>
          </label>
          <div className="field">
            <span>{text.machine}</span>
            <label className="checkbox-control">
              <input
                type="checkbox"
                checked={draft.is_machine_translated}
                onChange={(event) => setDraft({ ...draft, is_machine_translated: event.target.checked })}
              />
              <span>{text.machine}</span>
            </label>
            <small>{text.machineHint}</small>
          </div>
        </div>

        <h4>{text.prompts} <span className="title-count">{text.coverage(done, requiredKeys.length)}</span></h4>
        <small>{text.promptsHint}</small>
        {requiredKeys.map((key) => (
          <label className="field" key={key}>
            <span>
              <code dir="ltr">{key}</code>{' '}
              <span className={draft.prompts[key]?.trim() ? 'library-pill library-pill--free' : 'library-pill library-pill--paid'}>
                {draft.prompts[key]?.trim() ? text.present : text.missing}
              </span>
            </span>
            <textarea
              rows={2}
              value={draft.prompts[key] ?? ''}
              onChange={(event) => setDraft({ ...draft, prompts: { ...draft.prompts, [key]: event.target.value } })}
            />
          </label>
        ))}

        {extraKeys.length > 0 && (
          <details className="readiness-items">
            <summary>{text.extraPrompts} ({extraKeys.length})</summary>
            {extraKeys.map((key) => (
              <label className="field" key={key}>
                <span><code dir="ltr">{key}</code></span>
                <textarea
                  rows={2}
                  value={draft.prompts[key] ?? ''}
                  onChange={(event) => setDraft({ ...draft, prompts: { ...draft.prompts, [key]: event.target.value } })}
                />
              </label>
            ))}
          </details>
        )}

        <h4>{text.voice}</h4>
        <small>{text.voiceHint}</small>
        {envelope.voice_keys.length === 0 ? <p className="data-unavailable">—</p> : (
          <div className="table-scroll" tabIndex={0}>
            <table className="data-table">
              <tbody>
                {envelope.voice_keys.map((key) => (
                  <tr key={key}>
                    <td><code dir="ltr">{key}</code></td>
                    <td>
                      <input
                        dir="ltr"
                        value={draft.voice_manifest[key] ?? ''}
                        onChange={(event) => {
                          const next = { ...draft.voice_manifest }
                          if (event.target.value.trim()) next[key] = event.target.value.trim()
                          else delete next[key]
                          setDraft({ ...draft, voice_manifest: next })
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="form-actions">
          <button className="button button--primary" type="button" onClick={() => void save()} disabled={saving || !language}>
            <Icon name="upload" size={16} />{saving ? text.saving : text.save}
          </button>
        </div>
      </div>
    </section>
  )
}
