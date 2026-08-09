import { useCallback, useEffect, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { api } from '../lib/api'
import type { FeatureFlagRecord, RemoteConfigRecord } from '../types/api'

/**
 * التحكم عن بعد وأعلام الميزات.
 *
 * ## ما كانت عليه — أسوأ حالة في اللوحة
 *
 * `/admin/remote-config` **لم يكن موجودًا في الخادم إطلاقًا**. النداء يعيد 404،
 * و404 ليس خطأ شبكة فلا يرمي `fetch`، لكن `r.json()` على جسم الـ404 يرمي —
 * فيمسك الـ`catch` ويضع ثلاثة أعلام مخترعة:
 *
 *   hero_enabled: true, rollout 100
 *   offline_enabled: true, rollout 100
 *   gate_enabled: false, rollout 0
 *
 * أي أن الصفحة كانت تعرض هذه القيم **دائمًا وفي كل الحالات**، ولا توجد حالة
 * واحدة تعرض فيها بيانات حقيقية. المسؤول يقرأ حالة نظام لا وجود لها.
 *
 * وزر «تعديل» كان `alert('تغيير Rollout/استهداف')` — إعلان عمّا كان سيفعله.
 *
 * ## ما صارت عليه
 *
 * جدول `remote_config` موجود من المهاجرة 0015 وطُبِّقت على الإنتاج، والمسار
 * أُضيف في الخادم مع `PUT` حقيقي. التعديل يحفظ فعلًا ويُسجَّل في التدقيق.
 */

const copy = {
  ar: {
    eyebrow: 'التحكم في التطبيق',
    title: 'التحكم عن بعد',
    lede: 'تفعيل أو تعطيل ميزة، وضبط نسبة الإطلاق التدريجي، بلا إصدار تطبيق جديد.',
    configTitle: 'إعدادات التحكم',
    flagsTitle: 'أعلام الميزات',
    key: 'المفتاح',
    value: 'القيمة',
    rollout: 'نسبة الإطلاق',
    targeting: 'الاستهداف',
    everyone: 'الجميع',
    updated: 'آخر تحديث',
    status: 'الحالة',
    enabled: 'مفعل',
    disabled: 'معطل',
    actions: 'إجراءات',
    edit: 'تعديل',
    editTitle: 'تعديل إعداد',
    valueLabel: 'القيمة (JSON)',
    valueHint: 'مثال: true أو false أو "نص" أو {"max":5}. تُحفظ كما تُكتب.',
    rolloutLabel: 'نسبة الإطلاق (%)',
    rolloutHint: 'من 0 إلى 100. القيمة 0 تعني معطّل لكل المستخدمين.',
    save: 'حفظ',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    saved: 'حُفظ الإعداد',
    invalidJson: 'القيمة ليست JSON صالحًا',
    invalidRollout: 'نسبة الإطلاق يجب أن تكون بين 0 و100',
    empty: 'لا إعدادات تحكم',
    emptyHint: 'الإعدادات تُضاف من قاعدة البيانات أو عبر الـAPI.',
    flagsEmpty: 'لا أعلام ميزات',
    flagsEmptyHint: 'أعلام الميزات تُبذَر مع المهاجرات.',
    loadError: 'تعذر تحميل الإعدادات',
  },
  en: {
    eyebrow: 'App control',
    title: 'Remote config',
    lede: 'Enable or disable a feature and set gradual rollout, without shipping a new app release.',
    configTitle: 'Config entries',
    flagsTitle: 'Feature flags',
    key: 'Key',
    value: 'Value',
    rollout: 'Rollout',
    targeting: 'Targeting',
    everyone: 'Everyone',
    updated: 'Last updated',
    status: 'Status',
    enabled: 'Enabled',
    disabled: 'Disabled',
    actions: 'Actions',
    edit: 'Edit',
    editTitle: 'Edit config entry',
    valueLabel: 'Value (JSON)',
    valueHint: 'Example: true, false, "text", or {"max":5}. Stored exactly as written.',
    rolloutLabel: 'Rollout percent',
    rolloutHint: '0 to 100. A value of 0 means disabled for everyone.',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    saved: 'Config saved',
    invalidJson: 'The value is not valid JSON',
    invalidRollout: 'Rollout must be between 0 and 100',
    empty: 'No config entries',
    emptyHint: 'Entries are added from the database or through the API.',
    flagsEmpty: 'No feature flags',
    flagsEmptyHint: 'Feature flags are seeded by migrations.',
    loadError: 'Unable to load config',
  },
}

/// عرض القيمة بشكل مقروء. الكائنات تُسلسَل، والمنطقية تُترجَم.
function displayValue(value: unknown, text: typeof copy.ar) {
  if (typeof value === 'boolean') return value ? text.enabled : text.disabled
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function isTruthy(value: unknown) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') return value !== '' && value !== 'false'
  return value !== null && value !== undefined
}

export function RemoteConfigPage() {
  const { locale } = usePreferences()
  const text = copy[locale]

  const [entries, setEntries] = useState<RemoteConfigRecord[]>([])
  const [flags, setFlags] = useState<FeatureFlagRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [selected, setSelected] = useState<RemoteConfigRecord | null>(null)
  const [valueText, setValueText] = useState('')
  const [rollout, setRollout] = useState('100')
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [configRes, flagRes] = await Promise.all([api.remoteConfig(), api.featureFlags()])
      setEntries(configRes.data)
      setFlags(flagRes.data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : text.loadError)
    } finally {
      setLoading(false)
    }
  }, [text.loadError])

  useEffect(() => { void load() }, [load])

  function openEdit(entry: RemoteConfigRecord) {
    setSelected(entry)
    setValueText(JSON.stringify(entry.value))
    setRollout(String(entry.rollout_percent))
    setModalError('')
  }

  async function save() {
    if (!selected) return

    // يُفحَص محليًا أولًا: خطأ مطبعي في JSON لا يستحق رحلة كاملة للخادم
    let parsed: unknown
    try {
      parsed = JSON.parse(valueText)
    } catch {
      setModalError(text.invalidJson)
      return
    }

    const percent = Number(rollout)
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) {
      setModalError(text.invalidRollout)
      return
    }

    setSaving(true)
    setModalError('')
    try {
      await api.saveRemoteConfig(selected.key, {
        value: parsed,
        rollout_percent: percent,
        targeting: selected.targeting,
      })
      setSelected(null)
      setNotice(text.saved)
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

      <section className="panel panel--table">
        <div className="panel__header">
          <h3>{text.configTitle}</h3>
          <span className="panel__kicker">{entries.length}</span>
        </div>
        {entries.length ? (
          <div className="table-scroll">
            <table className="data-table data-table--wide">
              <thead>
                <tr>
                  <th>{text.key}</th>
                  <th>{text.value}</th>
                  <th>{text.rollout}</th>
                  <th>{text.targeting}</th>
                  <th>{text.actions}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.key}>
                    <td>
                      {/* المفاتيح لاتينية فتُعرض يسارًا-يمينًا */}
                      <span className="table-primary" dir="ltr">{entry.key}</span>
                    </td>
                    <td>
                      <span className={isTruthy(entry.value) ? 'track-badge' : 'status-badge status-badge--draft'}>
                        {displayValue(entry.value, text)}
                      </span>
                    </td>
                    <td>
                      <span className="table-secondary" dir="ltr">{entry.rollout_percent}%</span>
                    </td>
                    <td>
                      <span className="table-secondary">
                        {Object.keys(entry.targeting ?? {}).length
                          ? JSON.stringify(entry.targeting)
                          : text.everyone}
                      </span>
                    </td>
                    <td>
                      <button className="button button--ghost" type="button" onClick={() => openEdit(entry)}>
                        {text.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.empty} description={text.emptyHint} />
        )}
      </section>

      <section className="panel panel--table">
        <div className="panel__header">
          <h3>{text.flagsTitle}</h3>
          <span className="panel__kicker">{flags.length}</span>
        </div>
        {flags.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{text.key}</th>
                  <th>{text.status}</th>
                  <th>{text.targeting}</th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <tr key={flag.key}>
                    <td><span className="table-primary" dir="ltr">{flag.key}</span></td>
                    <td>
                      <span className={flag.enabled ? 'track-badge' : 'status-badge status-badge--draft'}>
                        {flag.enabled ? text.enabled : text.disabled}
                      </span>
                    </td>
                    <td>
                      <span className="table-secondary">
                        {Object.keys(flag.targeting ?? {}).length
                          ? JSON.stringify(flag.targeting)
                          : text.everyone}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={text.flagsEmpty} description={text.flagsEmptyHint} />
        )}
      </section>

      {selected ? (
        <Modal open title={text.editTitle} onClose={() => setSelected(null)}>
          <div className="entity-form">
            <dl className="detail-list">
              <div>
                <dt>{text.key}</dt>
                <dd dir="ltr">{selected.key}</dd>
              </div>
              <div>
                <dt>{text.updated}</dt>
                <dd>{selected.updated_at}</dd>
              </div>
            </dl>

            <label className="field">
              <span>{text.valueLabel}</span>
              <input type="text" value={valueText} onChange={(event) => setValueText(event.target.value)} dir="ltr" />
              <small>{text.valueHint}</small>
            </label>

            <label className="field">
              <span>{text.rolloutLabel}</span>
              <input
                type="number"
                min={0}
                max={100}
                value={rollout}
                onChange={(event) => setRollout(event.target.value)}
                dir="ltr"
              />
              <small>{text.rolloutHint}</small>
            </label>

            {modalError ? <p className="form-error" role="alert">{modalError}</p> : null}

            <div className="form-actions">
              <button className="button button--ghost" type="button" onClick={() => setSelected(null)}>
                {text.cancel}
              </button>
              {/* حفظ حقيقي: كان alert() يعلن عمّا كان سيفعله */}
              <button className="button button--primary" type="button" disabled={saving} onClick={() => void save()}>
                {saving ? text.saving : text.save}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
