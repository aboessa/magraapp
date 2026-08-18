import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/PageState'
import { Modal } from '../components/Modal'
import { usePreferences } from '../context/preferences'
import { adminPath } from '../lib/adminPath'
import { api } from '../lib/api'
import {
  contentFactoryRunStates,
  factoryStateLabel,
  factoryStateTone,
  formatCredits,
  formatFactoryDate,
} from '../lib/contentFactoryUi'
import type {
  ContentFactoryListMeta,
  ContentFactoryManifest,
  ContentFactoryRun,
  ContentFactoryRunState,
} from '../types/api'

const PAGE_SIZE = 20

const copy = {
  ar: {
    eyebrow: 'الإنتاج · مصنع المحتوى',
    title: 'خطط وتشغيل مصنع المحتوى',
    lede: 'استورد خطة ثابتة، راجع العوائق والتكلفة، ثم افتح تشغيلًا لاعتماد الإنفاق وإطلاقه بخطوتين منفصلتين.',
    importPlan: 'استيراد خطة',
    importTitle: 'استيراد manifest ثابت',
    importDescription: 'هذه الخطوة تحفظ الخطة فقط. لا تعتمد إنفاقًا، لا تنشئ محاولة، ولا تتصل بأي مزوّد مدفوع.',
    manifestFile: 'ملف manifest بصيغة JSON',
    manifestJson: 'JSON الخطة',
    fileHint: 'اختيار الملف يقرأه محليًا فقط؛ لن يُرسل شيء قبل الضغط على «حفظ الخطة».',
    jsonHint: 'يجب أن تحتوي الخطة على visual_identity معتمدة، وأن تكون spend_approval مساوية لـ null؛ اعتماد الإنفاق يتم بواسطة شخص آخر.',
    savePlan: 'حفظ الخطة فقط',
    saving: 'جارٍ الحفظ...',
    cancel: 'إلغاء',
    invalidJson: 'الملف ليس manifest صالحًا: تحقق من JSON وschema_version وvisual_identity المعتمدة ومن أن spend_approval تساوي null.',
    state: 'حالة التشغيل',
    allStates: 'كل الحالات',
    totalRuns: 'إجمالي التشغيلات',
    blocked: 'محجوبة',
    awaitingApproval: 'بانتظار اعتماد الإنفاق',
    active: 'في الطابور أو قيد التشغيل',
    entity: 'المحتوى',
    profile: 'مسار الإنتاج',
    estimate: 'التكلفة المقدّرة',
    blockers: 'العوائق / غير المسعّر',
    planHash: 'بصمة الخطة',
    created: 'أُنشئت',
    open: 'فتح التشغيل',
    empty: 'لا توجد تشغيلات مصنع',
    emptyHint: 'استورد manifest مخططًا أو غيّر مرشح الحالة. الاستيراد وحده لا يطلق أي طلب مدفوع.',
    previous: 'السابق',
    next: 'التالي',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} من ${total}`,
    credits: 'رصيد',
  },
  en: {
    eyebrow: 'Production · Content factory',
    title: 'Content factory plans and runs',
    lede: 'Import an immutable plan, review blockers and cost, then open a run to approve spend and dispatch in two separate steps.',
    importPlan: 'Import plan',
    importTitle: 'Import immutable manifest',
    importDescription: 'This step stores the plan only. It does not approve spend, create an attempt, or call a paid provider.',
    manifestFile: 'JSON manifest file',
    manifestJson: 'Plan JSON',
    fileHint: 'Selecting a file reads it locally only; nothing is sent until “Save plan” is pressed.',
    jsonHint: 'An approved visual_identity is required and spend_approval must be null; a different operator records spend approval.',
    savePlan: 'Save plan only',
    saving: 'Saving...',
    cancel: 'Cancel',
    invalidJson: 'This is not a valid manifest: check JSON, schema_version, approved visual_identity, and that spend_approval is null.',
    state: 'Run state',
    allStates: 'All states',
    totalRuns: 'Total runs',
    blocked: 'Blocked',
    awaitingApproval: 'Awaiting spend approval',
    active: 'Queued or running',
    entity: 'Content',
    profile: 'Pipeline',
    estimate: 'Estimated cost',
    blockers: 'Blockers / unpriced',
    planHash: 'Plan fingerprint',
    created: 'Created',
    open: 'Open run',
    empty: 'No content factory runs',
    emptyHint: 'Import a planned manifest or change the state filter. Importing alone never makes a paid request.',
    previous: 'Previous',
    next: 'Next',
    pageRange: (from: number, to: number, total: number) => `${from}–${to} of ${total}`,
    credits: 'credits',
  },
}

const emptyMeta: ContentFactoryListMeta = { total: 0, limit: PAGE_SIZE, offset: 0, by_state: {} }

function parsedManifest(value: string): ContentFactoryManifest | null {
  try {
    const parsed = JSON.parse(value) as Partial<ContentFactoryManifest> | null
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    if (parsed.schema_version !== 'content-factory.production-manifest/v1') return null
    if (parsed.spend_approval !== null || !Array.isArray(parsed.jobs)) return null
    if (!Object.hasOwn(parsed, 'visual_identity')) return null
    const identity = parsed.visual_identity
    const liveActionInventory = parsed.pipeline?.profile === 'live_action'
      && parsed.pipeline.eligibility === 'excluded'
      && parsed.jobs.length === 0
    if (identity === null) return liveActionInventory ? parsed as ContentFactoryManifest : null
    if (!identity
      || identity.status !== 'approved'
      || identity.series_slug !== parsed.entity?.series_slug
      || !/^[a-f0-9]{64}$/.test(identity.reference_pack_sha256)
      || !Array.isArray(identity.references)
      || !identity.references.some((reference) => reference.kind === 'character_sheet')
      || !identity.references.some((reference) => reference.kind === 'visual_guide')
      || identity.references.some((reference) => !/^[a-f0-9]{64}$/.test(reference.sha256))) return null
    return parsed as ContentFactoryManifest
  } catch {
    return null
  }
}

export function ContentFactoryPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const navigate = useNavigate()
  const [runs, setRuns] = useState<ContentFactoryRun[]>([])
  const [meta, setMeta] = useState<ContentFactoryListMeta>(emptyMeta)
  const [state, setState] = useState<ContentFactoryRunState | ''>('')
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [manifestText, setManifestText] = useState('')
  const [fileName, setFileName] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.contentFactoryRuns({ state: state || undefined, limit: PAGE_SIZE, offset })
      setRuns(response.data)
      setMeta(response.meta)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : locale === 'ar' ? 'تعذر تحميل التشغيلات' : 'Unable to load runs')
    } finally {
      setLoading(false)
    }
  }, [locale, offset, state])

  useEffect(() => { void load() }, [load])

  const closeImport = () => {
    if (importing) return
    setImportOpen(false)
    setImportError('')
  }

  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setImportError('')
    setManifestText(await file.text())
  }

  const submitImport = async (event: FormEvent) => {
    event.preventDefault()
    const manifest = parsedManifest(manifestText)
    if (!manifest) {
      setImportError(text.invalidJson)
      return
    }
    setImporting(true)
    setImportError('')
    try {
      const response = await api.importContentFactoryPlan(manifest)
      setImportOpen(false)
      setManifestText('')
      setFileName('')
      navigate(adminPath(`production/factory/${response.data.id}`))
    } catch (reason) {
      setImportError(reason instanceof Error ? reason.message : text.invalidJson)
    } finally {
      setImporting(false)
    }
  }

  const from = meta.total === 0 ? 0 : offset + 1
  const to = Math.min(offset + runs.length, meta.total)
  const activeCount = (meta.by_state.queued ?? 0) + (meta.by_state.running ?? 0)

  return (
    <div className="page-stack factory-page">
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{text.title}</h2>
          <p>{text.lede}</p>
        </div>
        <div className="page-intro__actions">
          <button className="button button--primary" type="button" onClick={() => setImportOpen(true)}>{text.importPlan}</button>
        </div>
      </section>

      <section className="factory-metrics" aria-label={text.totalRuns}>
        <div className="factory-metric"><strong>{meta.total}</strong><span>{text.totalRuns}</span></div>
        <div className="factory-metric factory-metric--danger"><strong>{meta.by_state.blocked ?? 0}</strong><span>{text.blocked}</span></div>
        <div className="factory-metric factory-metric--warning"><strong>{meta.by_state.awaiting_spend_approval ?? 0}</strong><span>{text.awaitingApproval}</span></div>
        <div className="factory-metric factory-metric--active"><strong>{activeCount}</strong><span>{text.active}</span></div>
      </section>

      <section className="panel factory-list-panel">
        <header className="panel__header factory-toolbar">
          <h3>{text.title}</h3>
          <label className="field factory-state-filter">
            <span>{text.state}</span>
            <select value={state} onChange={(event) => { setState(event.target.value as ContentFactoryRunState | ''); setOffset(0) }}>
              <option value="">{text.allStates}</option>
              {contentFactoryRunStates.map((value) => <option key={value} value={value}>{factoryStateLabel(locale, value)}</option>)}
            </select>
          </label>
        </header>

        {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : runs.length === 0 ? (
          <EmptyState title={text.empty} description={text.emptyHint} />
        ) : (
          <>
            <div className="table-scroll" tabIndex={0} aria-label={text.title}>
              <table className="data-table factory-table">
                <thead><tr>
                  <th>{text.entity}</th>
                  <th>{text.state}</th>
                  <th>{text.profile}</th>
                  <th>{text.estimate}</th>
                  <th>{text.blockers}</th>
                  <th>{text.planHash}</th>
                  <th>{text.created}</th>
                  <th><span className="sr-only">{text.open}</span></th>
                </tr></thead>
                <tbody>{runs.map((run) => (
                  <tr key={run.id}>
                    <td><strong>{run.series_slug}</strong><small>{run.entity_type} · {run.entity_id}</small></td>
                    <td><span className={`factory-state factory-state--${factoryStateTone(run.state)}`}>{factoryStateLabel(locale, run.state)}</span></td>
                    <td><code>{run.pipeline_profile}</code></td>
                    <td><strong>{formatCredits(run.estimate_with_contingency_credits, locale)}</strong><small>{text.credits} · {formatCredits(run.estimate_low_credits, locale)}–{formatCredits(run.estimate_high_credits, locale)}</small></td>
                    <td><strong>{run.blocker_count} / {run.unpriced_job_count}</strong></td>
                    <td><code className="factory-hash" title={run.plan_sha256}>{run.plan_sha256}</code></td>
                    <td>{formatFactoryDate(run.created_at, locale)}</td>
                    <td><Link className="button button--secondary button--small" to={adminPath(`production/factory/${run.id}`)}>{text.open}</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <footer className="factory-pagination">
              <span aria-live="polite">{text.pageRange(from, to, meta.total)}</span>
              <div>
                <button className="button button--ghost button--small" type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>{text.previous}</button>
                <button className="button button--ghost button--small" type="button" disabled={offset + runs.length >= meta.total} onClick={() => setOffset(offset + PAGE_SIZE)}>{text.next}</button>
              </div>
            </footer>
          </>
        )}
      </section>

      <Modal open={importOpen} title={text.importTitle} description={text.importDescription} onClose={closeImport}>
        <form className="entity-form factory-import-form" onSubmit={(event) => void submitImport(event)}>
          <label className="field">
            <span>{text.manifestFile}</span>
            <input type="file" accept=".json,application/json" onChange={(event) => void chooseFile(event)} />
            <small>{fileName || text.fileHint}</small>
          </label>
          <label className="field">
            <span>{text.manifestJson}</span>
            <textarea rows={12} value={manifestText} onChange={(event) => { setManifestText(event.target.value); setImportError('') }} spellCheck={false} />
            <small>{text.jsonHint}</small>
          </label>
          {importError ? <p className="factory-inline-error" role="alert">{importError}</p> : null}
          <div className="factory-form-actions">
            <button className="button button--secondary" type="button" onClick={closeImport} disabled={importing}>{text.cancel}</button>
            <button className="button button--primary" type="submit" disabled={importing || !manifestText.trim()}>{importing ? text.saving : text.savePlan}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
