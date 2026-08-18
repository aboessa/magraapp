import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../components/PageState'
import { usePreferences } from '../context/preferences'
import { adminPath } from '../lib/adminPath'
import { api } from '../lib/api'
import {
  factoryStateLabel,
  factoryStateTone,
  formatCredits,
  formatFactoryDate,
} from '../lib/contentFactoryUi'
import type {
  ContentFactoryAutomatedQcResultInput,
  ContentFactoryDetail,
  ContentFactoryJob,
  ContentFactoryRunState,
} from '../types/api'

const resumableRunStates = new Set<ContentFactoryRunState>(['queued', 'running', 'paused', 'partially_failed', 'failed'])
const failedJobStates = new Set([
  'submission_failed', 'provider_failed', 'provider_cancelled', 'polling_failed', 'timed_out',
  'download_failed', 'automated_qc_failed', 'human_review_rejected',
])
const replacementJobStates = new Set([
  'submission_failed', 'provider_failed', 'provider_cancelled', 'automated_qc_failed', 'human_review_rejected',
])

const copy = {
  ar: {
    back: 'العودة إلى مصنع المحتوى',
    eyebrow: 'الإنتاج · تشغيل مصنع المحتوى',
    title: 'تشغيل مصنع المحتوى',
    reload: 'تحديث',
    state: 'الحالة',
    jobs: 'المهام',
    blockers: 'العوائق',
    unpriced: 'غير المسعّر',
    estimateLow: 'الحد الأدنى',
    estimateHigh: 'الحد الأعلى',
    contingency: 'مع الاحتياطي',
    approvedCeiling: 'السقف المعتمد',
    exposure: 'التعرّض الحالي',
    gross: 'إجمالي معلن من المزود',
    refunds: 'مرتجعات مؤكدة',
    reservations: 'حجوزات نشطة',
    refundUnknown: 'توجد تكلفة معلنة لا تزال حالة استردادها غير معروفة؛ لا تُعامل كمرتجع.',
    planIdentity: 'هوية الخطة الثابتة',
    planHash: 'plan SHA-256',
    sourceHash: 'source SHA-256',
    inventoryHash: 'inventory SHA-256',
    manifest: 'manifest',
    createdBy: 'أنشأها',
    approvedBy: 'اعتمدها',
    dispatchedBy: 'شغّلها',
    approvalTitle: '1 · اعتماد سقف الإنفاق',
    approvalIntro: 'اعتماد مستقل في الخادم. منشئ التشغيل لا يستطيع اعتماد إنفاقه بنفسه.',
    ceiling: 'سقف الإنفاق بالرصيد',
    expiry: 'انتهاء الاعتماد (اختياري)',
    reason: 'سبب الاعتماد (اختياري)',
    confirmPlan: 'اكتب بصمة الخطة كاملة للتأكيد',
    hashMismatch: 'يجب أن تطابق البصمة المعروضة حرفيًا.',
    approve: 'اعتماد الإنفاق',
    approving: 'جارٍ الاعتماد...',
    approvalUnavailable: 'لا يمكن الاعتماد في هذه الحالة؛ أصلح العوائق/التسعير أو حدّث التشغيل.',
    dispatchTitle: '2 · إطلاق التشغيل المدفوع',
    dispatchIntro: 'هذه خطوة منفصلة وقد ترسل طلبات مدفوعة إلى المزود. لا يُرسل شيء قبل استيفاء كل التأكيدات.',
    dispatchHash: 'أعد كتابة بصمة الخطة المعتمدة',
    idempotency: 'مفتاح Idempotency (16–160 محرفًا)',
    paidCheck: 'أفهم أن هذا الإجراء يسمح بطلبات مدفوعة ضمن السقف المعتمد.',
    dispatchPhraseLabel: 'اكتب عبارة التأكيد',
    dispatchPhrase: 'تشغيل مدفوع',
    dispatch: 'إطلاق الطلبات المدفوعة',
    dispatching: 'جارٍ وضع المهام في الطابور...',
    dispatchUnavailable: 'لا يمكن التشغيل قبل اعتماد الإنفاق المطابق وخلو الخطة من العوائق والمكوّنات غير المسعّرة.',
    recoveryTitle: 'الاستئناف وإعادة المحاولة',
    resume: 'استئناف المحاولات الحالية',
    resuming: 'جارٍ الاستئناف...',
    resumeHint: 'الاستئناف يعيد poll/download/validation للمحاولة نفسها ولا يسمح بمحاولة مدفوعة جديدة.',
    retryJob: 'المهمة الفاشلة',
    allFailed: 'كل المهام الفاشلة فقط',
    retry: 'إعادة محاولة الفاشل فقط',
    retrying: 'جارٍ إعادة المحاولة...',
    noFailed: 'لا توجد مهام فاشلة قابلة لإعادة المحاولة.',
    replacementWarning: 'الاختيار يتضمن استبدالًا قد يُخصم مرة ثانية. يلزم قبول الخطر صراحةً.',
    allowNewAttempt: 'اسمح بإنشاء محاولة مدفوعة جديدة.',
    allowReplacementPaid: 'اسمح بإنفاق مدفوع للاستبدال ضمن السقف المعتمد.',
    acceptDuplicate: 'أقبل احتمال الخصم المكرر إذا كانت نتيجة المحاولة السابقة غير محسومة.',
    riskPhraseLabel: 'اكتب عبارة قبول الخطر',
    riskPhrase: 'أقبل خطر الخصم المكرر',
    completedAction: 'تم تنفيذ الأمر وتحديث بيانات التشغيل.',
    jobId: 'معرّف المهمة',
    kind: 'النوع',
    provider: 'المزوّد / العملية',
    jobState: 'حالة المهمة',
    jobEstimate: 'التقدير / المحجوز',
    attempt: 'المحاولة الحالية',
    attempts: 'محاولات المزود',
    sequence: 'التسلسل',
    providerJob: 'مهمة المزود',
    outcome: 'النتيجة',
    attemptCost: 'الإجمالي / المرتجع',
    asset: 'الأصل الخاص',
    stored: 'مخزّن',
    notStored: 'غير مخزّن',
    errorCode: 'رمز الخطأ',
    ledger: 'سجل التكلفة والمحجوزات',
    entryType: 'نوع القيد',
    amount: 'القيمة',
    source: 'المرجع',
    date: 'التاريخ',
    qc: 'الفحص الآلي',
    humanReview: 'المراجعة البشرية',
    gate: 'البوابة',
    decision: 'القرار',
    reviewer: 'المراجع',
    evidence: 'بصمة الدليل',
    qcActions: 'تسجيل QC والمراجعة المرتبطين بالأصل',
    qcJob: 'مهمة لها أصل خاص حالي',
    qcReport: 'تقرير أداة QC بصيغة JSON',
    qcReportHint: 'ألصق ناتج الأداة الذي يحتوي policy_version وresults لكل بوابة. الخادم يربطه ببصمتي الخطة والأصل ويعيد حساب بصمة الدليل.',
    qcAssetConfirm: 'اكتب بصمة الأصل الحالية لتأكيد السياق',
    recordQc: 'تسجيل دليل QC الآلي',
    recordingQc: 'جارٍ تسجيل الدليل...',
    noQcEligible: 'لا توجد محاولة حالية ذات أصل منزّل تقبل تقرير QC.',
    validationRetryHint: 'validation_failed لا يدخل retry المدفوع؛ صحّح تقرير/أداة التحقق ثم أعد تسجيل QC على الأصل نفسه هنا.',
    humanReviewAction: 'قرار مراجعة بشرية',
    reviewJob: 'مهمة اجتازت QC الآلي',
    reviewGate: 'بوابة المراجعة',
    reviewDecision: 'القرار',
    approveDecision: 'اعتماد',
    rejectDecision: 'رفض',
    reviewNotes: 'ملاحظات (إلزامية عند الرفض)',
    reviewHashConfirm: 'اكتب بصمة QC الآلي الحالية لتأكيد السياق',
    recordReview: 'تسجيل قرار المراجع',
    recordingReview: 'جارٍ تسجيل القرار...',
    noReviewEligible: 'لا توجد مهمة تنتظر مراجعة بشرية الآن.',
    qcReadOnly: 'كل دليل وقرار أدناه مرتبط ببصمات الخطة والأصل والمحاولة؛ تنزيل الأصل وحده لا يعني اعتماد master.',
    noRows: 'لا توجد سجلات بعد.',
    planBlockers: 'عوائق الخطة',
    noBlockers: 'لا توجد عوائق معلنة في manifest.',
    unpricedJobs: 'المهام غير المسعّرة',
    noUnpriced: 'لا توجد مهام غير مسعّرة.',
    rawManifest: 'عرض manifest الخام للقراءة فقط',
    credits: 'رصيد',
  },
  en: {
    back: 'Back to content factory',
    eyebrow: 'Production · Content factory run',
    title: 'Content factory run',
    reload: 'Refresh',
    state: 'State',
    jobs: 'Jobs',
    blockers: 'Blockers',
    unpriced: 'Unpriced',
    estimateLow: 'Low estimate',
    estimateHigh: 'High estimate',
    contingency: 'With contingency',
    approvedCeiling: 'Approved ceiling',
    exposure: 'Current exposure',
    gross: 'Provider-declared gross',
    refunds: 'Confirmed refunds',
    reservations: 'Active reservations',
    refundUnknown: 'A declared charge still has unknown refund status; it is not treated as refunded.',
    planIdentity: 'Immutable plan identity',
    planHash: 'plan SHA-256',
    sourceHash: 'source SHA-256',
    inventoryHash: 'inventory SHA-256',
    manifest: 'manifest',
    createdBy: 'Created by',
    approvedBy: 'Approved by',
    dispatchedBy: 'Dispatched by',
    approvalTitle: '1 · Approve spend ceiling',
    approvalIntro: 'A separate server-side approval. The run creator cannot approve their own spend.',
    ceiling: 'Spend ceiling in credits',
    expiry: 'Approval expiry (optional)',
    reason: 'Approval reason (optional)',
    confirmPlan: 'Type the complete plan fingerprint',
    hashMismatch: 'It must exactly match the displayed fingerprint.',
    approve: 'Approve spend',
    approving: 'Approving...',
    approvalUnavailable: 'This state is not approvable; resolve blockers/unpriced work or refresh the run.',
    dispatchTitle: '2 · Dispatch paid run',
    dispatchIntro: 'This is a separate step and may send paid provider requests. Nothing is sent until every confirmation is satisfied.',
    dispatchHash: 'Retype the approved plan fingerprint',
    idempotency: 'Idempotency key (16–160 characters)',
    paidCheck: 'I understand this action permits paid requests within the approved ceiling.',
    dispatchPhraseLabel: 'Type the confirmation phrase',
    dispatchPhrase: 'PAID DISPATCH',
    dispatch: 'Dispatch paid requests',
    dispatching: 'Queueing jobs...',
    dispatchUnavailable: 'Dispatch requires matching spend approval and a plan with no blockers or unpriced components.',
    recoveryTitle: 'Resume and retry',
    resume: 'Resume current attempts',
    resuming: 'Resuming...',
    resumeHint: 'Resume repeats poll/download/validation for the same attempt and never permits a new paid attempt.',
    retryJob: 'Failed job',
    allFailed: 'All failed jobs only',
    retry: 'Retry failed only',
    retrying: 'Retrying...',
    noFailed: 'There are no failed jobs eligible for retry.',
    replacementWarning: 'This selection includes replacement work that may be charged again. Explicit risk acceptance is required.',
    allowNewAttempt: 'Allow creation of a new paid attempt.',
    allowReplacementPaid: 'Allow replacement spend within the approved ceiling.',
    acceptDuplicate: 'I accept duplicate-charge risk if the previous attempt outcome is unresolved.',
    riskPhraseLabel: 'Type the risk acceptance phrase',
    riskPhrase: 'I ACCEPT DUPLICATE CHARGE RISK',
    completedAction: 'The command completed and the run data was refreshed.',
    jobId: 'Job ID',
    kind: 'Kind',
    provider: 'Provider / operation',
    jobState: 'Job state',
    jobEstimate: 'Estimate / reserved',
    attempt: 'Current attempt',
    attempts: 'Provider attempts',
    sequence: 'Sequence',
    providerJob: 'Provider job',
    outcome: 'Outcome',
    attemptCost: 'Gross / refund',
    asset: 'Private asset',
    stored: 'Stored',
    notStored: 'Not stored',
    errorCode: 'Error code',
    ledger: 'Cost and reservation ledger',
    entryType: 'Entry type',
    amount: 'Amount',
    source: 'Source',
    date: 'Date',
    qc: 'Automated QC',
    humanReview: 'Human review',
    gate: 'Gate',
    decision: 'Decision',
    reviewer: 'Reviewer',
    evidence: 'Evidence fingerprint',
    qcActions: 'Record asset-bound QC and review',
    qcJob: 'Job with a current private asset',
    qcReport: 'QC tool report as JSON',
    qcReportHint: 'Paste tool output containing policy_version and results for every gate. The server binds it to plan/asset fingerprints and recomputes the evidence fingerprint.',
    qcAssetConfirm: 'Type the current asset fingerprint to confirm context',
    recordQc: 'Record automated QC evidence',
    recordingQc: 'Recording evidence...',
    noQcEligible: 'No current downloaded asset is eligible for a QC report.',
    validationRetryHint: 'validation_failed is not a paid retry state; fix the validator/report and record QC again against the same asset here.',
    humanReviewAction: 'Human review decision',
    reviewJob: 'Job that passed automated QC',
    reviewGate: 'Review gate',
    reviewDecision: 'Decision',
    approveDecision: 'Approve',
    rejectDecision: 'Reject',
    reviewNotes: 'Notes (required on rejection)',
    reviewHashConfirm: 'Type the current automated-QC fingerprint to confirm context',
    recordReview: 'Record reviewer decision',
    recordingReview: 'Recording decision...',
    noReviewEligible: 'No job is currently awaiting human review.',
    qcReadOnly: 'Every item below is bound to the plan, asset and attempt fingerprints; downloading an asset alone never approves a master.',
    noRows: 'No records yet.',
    planBlockers: 'Plan blockers',
    noBlockers: 'The manifest declares no blockers.',
    unpricedJobs: 'Unpriced jobs',
    noUnpriced: 'There are no unpriced jobs.',
    rawManifest: 'View raw read-only manifest',
    credits: 'credits',
  },
}

function makeIdempotencyKey(runId: string) {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `dashboard:${runId}:${random}`.slice(0, 160)
}

function jobName(jobs: ContentFactoryJob[], factoryJobId: string) {
  return jobs.find((job) => job.id === factoryJobId)?.job_id ?? factoryJobId
}

export function ContentFactoryRunPage() {
  const { locale } = usePreferences()
  const text = copy[locale]
  const { runId = '' } = useParams<{ runId: string }>()
  const [detail, setDetail] = useState<ContentFactoryDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState<'approve' | 'dispatch' | 'resume' | 'retry' | 'qc' | 'review' | ''>('')

  const [approvalHash, setApprovalHash] = useState('')
  const [approvalCeiling, setApprovalCeiling] = useState('')
  const [approvalExpiry, setApprovalExpiry] = useState('')
  const [approvalReason, setApprovalReason] = useState('')

  const [dispatchHash, setDispatchHash] = useState('')
  const [dispatchKey, setDispatchKey] = useState('')
  const [paidConfirmed, setPaidConfirmed] = useState(false)
  const [dispatchPhrase, setDispatchPhrase] = useState('')

  const [retryJobId, setRetryJobId] = useState('')
  const [allowNewAttempt, setAllowNewAttempt] = useState(false)
  const [allowReplacementPaid, setAllowReplacementPaid] = useState(false)
  const [acceptDuplicate, setAcceptDuplicate] = useState(false)
  const [riskPhrase, setRiskPhrase] = useState('')

  const [qcJobId, setQcJobId] = useState('')
  const [qcReport, setQcReport] = useState('')
  const [qcAssetHash, setQcAssetHash] = useState('')
  const [reviewJobId, setReviewJobId] = useState('')
  const [reviewGate, setReviewGate] = useState('')
  const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved')
  const [reviewNotes, setReviewNotes] = useState('')
  const [reviewQcHash, setReviewQcHash] = useState('')

  const load = useCallback(async () => {
    if (!runId) {
      setError(locale === 'ar' ? 'معرّف التشغيل مفقود' : 'Run ID is missing')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const response = await api.contentFactoryRun(runId)
      setDetail(response.data)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : locale === 'ar' ? 'تعذر تحميل التشغيل' : 'Unable to load run')
    } finally {
      setLoading(false)
    }
  }, [locale, runId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!detail) return
    setApprovalCeiling((current) => current || String(detail.run.estimate_with_contingency_credits))
    setDispatchKey((current) => current || makeIdempotencyKey(detail.run.id))
  }, [detail])

  const failedJobs = useMemo(
    () => detail?.jobs.filter((job) => failedJobStates.has(job.state)) ?? [],
    [detail],
  )
  const selectedRetryJobs = retryJobId ? failedJobs.filter((job) => job.job_id === retryJobId) : failedJobs
  const replacementRequired = selectedRetryJobs.some((job) => replacementJobStates.has(job.state))
  const replacementConfirmed = !replacementRequired || (
    allowNewAttempt && allowReplacementPaid && acceptDuplicate && riskPhrase === text.riskPhrase
  )
  const qcEligibleJobs = useMemo(() => detail?.jobs.filter((job) => {
    const attempt = detail.attempts.find((item) => item.id === job.current_attempt_id)
    return Boolean(attempt?.private_asset_stored && attempt.asset_sha256 && [
      'downloaded', 'validation_failed', 'automated_qc_failed', 'awaiting_human_review', 'human_review_rejected',
    ].includes(attempt.state))
  }) ?? [], [detail])
  const reviewEligibleJobs = useMemo(() => detail?.jobs.filter((job) => {
    const attempt = detail.attempts.find((item) => item.id === job.current_attempt_id)
    return Boolean(attempt?.automated_qc_sha256 && ['awaiting_human_review', 'human_review_rejected'].includes(attempt.state))
  }) ?? [], [detail])
  const selectedQcJob = qcEligibleJobs.find((job) => job.job_id === qcJobId) ?? null
  const selectedQcAttempt = detail?.attempts.find((item) => item.id === selectedQcJob?.current_attempt_id) ?? null
  const selectedReviewJob = reviewEligibleJobs.find((job) => job.job_id === reviewJobId) ?? null
  const selectedReviewAttempt = detail?.attempts.find((item) => item.id === selectedReviewJob?.current_attempt_id) ?? null
  const humanGates = detail?.manifest.quality.human_gates ?? []

  if (loading) return <LoadingState />
  if (error || !detail) return <ErrorState message={error || (locale === 'ar' ? 'التشغيل غير موجود' : 'Run not found')} onRetry={() => void load()} />

  const { run, manifest, jobs, attempts, cost_ledger: ledger, exposure, qc_evidence: qc, human_reviews: reviews } = detail
  const approveReady = run.state === 'awaiting_spend_approval'
    && approvalHash === run.plan_sha256
    && Number.isFinite(Number(approvalCeiling))
    && Number(approvalCeiling) >= run.estimate_with_contingency_credits
  const dispatchReady = run.state === 'approved'
    && run.blocker_count === 0
    && run.unpriced_job_count === 0
    && dispatchHash === run.plan_sha256
    && dispatchKey.length >= 16
    && dispatchKey.length <= 160
    && paidConfirmed
    && dispatchPhrase === text.dispatchPhrase
  const qcReady = Boolean(
    selectedQcJob && selectedQcAttempt?.asset_sha256
    && qcAssetHash === selectedQcAttempt.asset_sha256
    && qcReport.trim(),
  )
  const reviewReady = Boolean(
    selectedReviewJob && selectedReviewAttempt?.asset_sha256 && selectedReviewAttempt.automated_qc_sha256
    && reviewGate
    && reviewQcHash === selectedReviewAttempt.automated_qc_sha256
    && (reviewDecision === 'approved' || reviewNotes.trim()),
  )

  const perform = async (kind: typeof busy, action: () => Promise<unknown>) => {
    setBusy(kind)
    setActionError('')
    setNotice('')
    try {
      await action()
      setNotice(text.completedAction)
      await load()
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : locale === 'ar' ? 'تعذر تنفيذ الأمر' : 'Unable to complete command')
    } finally {
      setBusy('')
    }
  }

  const approve = (event: FormEvent) => {
    event.preventDefault()
    if (!approveReady) return
    void perform('approve', () => api.approveContentFactorySpend(run.id, {
      confirmed_plan_sha256: approvalHash,
      ceiling_credits: Number(approvalCeiling),
      expires_at: approvalExpiry ? new Date(approvalExpiry).toISOString() : null,
      reason: approvalReason.trim() || undefined,
    }))
  }

  const dispatch = (event: FormEvent) => {
    event.preventDefault()
    if (!dispatchReady) return
    void perform('dispatch', () => api.dispatchContentFactoryRun(run.id, {
      confirmed_plan_sha256: dispatchHash,
      allow_paid: true,
    }, dispatchKey))
  }

  const retry = (event: FormEvent) => {
    event.preventDefault()
    if (failedJobs.length === 0 || !replacementConfirmed) return
    void perform('retry', () => api.retryContentFactoryFailed(run.id, {
      failed_only: true,
      ...(retryJobId ? { job_id: retryJobId } : {}),
      ...(replacementRequired ? {
        allow_new_paid_attempt: true as const,
        allow_paid: true as const,
        accept_duplicate_charge_risk: true as const,
      } : {}),
    }))
  }

  const recordAutomatedQc = (event: FormEvent) => {
    event.preventDefault()
    if (!qcReady || !selectedQcJob || !selectedQcAttempt?.asset_sha256) return
    let parsed: { policy_version?: unknown; results?: unknown }
    try {
      parsed = JSON.parse(qcReport) as { policy_version?: unknown; results?: unknown }
    } catch {
      setActionError(locale === 'ar' ? 'تقرير QC ليس JSON صالحًا.' : 'QC report is not valid JSON.')
      return
    }
    if (typeof parsed.policy_version !== 'string' || !Array.isArray(parsed.results)) {
      setActionError(locale === 'ar' ? 'يجب أن يحتوي التقرير policy_version وresults.' : 'The report must contain policy_version and results.')
      return
    }
    void perform('qc', () => api.recordContentFactoryAutomatedQc(run.id, selectedQcJob.job_id, {
      attempt_id: selectedQcAttempt.id,
      confirmed_plan_sha256: run.plan_sha256,
      confirmed_asset_sha256: selectedQcAttempt.asset_sha256!,
      policy_version: parsed.policy_version as string,
      results: parsed.results as ContentFactoryAutomatedQcResultInput[],
    }))
  }

  const recordHumanReview = (event: FormEvent) => {
    event.preventDefault()
    if (!reviewReady || !selectedReviewJob || !selectedReviewAttempt?.asset_sha256 || !selectedReviewAttempt.automated_qc_sha256) return
    void perform('review', () => api.recordContentFactoryHumanReview(run.id, selectedReviewJob.job_id, {
      attempt_id: selectedReviewAttempt.id,
      gate_id: reviewGate,
      decision: reviewDecision,
      confirmed_plan_sha256: run.plan_sha256,
      confirmed_asset_sha256: selectedReviewAttempt.asset_sha256!,
      confirmed_automated_qc_sha256: selectedReviewAttempt.automated_qc_sha256!,
      notes: reviewNotes.trim() || undefined,
    }))
  }

  return (
    <div className="page-stack factory-page">
      <Link className="story-back" to={adminPath('production/factory')}>← {text.back}</Link>
      <section className="page-intro">
        <div>
          <span className="eyebrow">{text.eyebrow}</span>
          <h2>{manifest.entity.title || `${text.title} · ${run.entity_id}`}</h2>
          <p>{run.series_slug} · {run.pipeline_profile}</p>
        </div>
        <div className="page-intro__actions">
          <span className={`factory-state factory-state--${factoryStateTone(run.state)}`}>{factoryStateLabel(locale, run.state)}</span>
          <button className="button button--secondary" type="button" onClick={() => void load()}>{text.reload}</button>
        </div>
      </section>

      <div className="factory-live-region" aria-live="polite" aria-atomic="true">{notice}</div>
      {actionError ? <p className="factory-inline-error" role="alert">{actionError}</p> : null}

      <section className="factory-metrics" aria-label={text.state}>
        <div className="factory-metric"><strong>{jobs.length}</strong><span>{text.jobs}</span></div>
        <div className="factory-metric factory-metric--danger"><strong>{run.blocker_count}</strong><span>{text.blockers}</span></div>
        <div className="factory-metric factory-metric--warning"><strong>{run.unpriced_job_count}</strong><span>{text.unpriced}</span></div>
        <div className="factory-metric factory-metric--active"><strong>{formatCredits(exposure.total_exposure_credits, locale)}</strong><span>{text.exposure} · {text.credits}</span></div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.planIdentity}</h3></header>
        <div className="factory-identity-grid">
          <div><span>{text.planHash}</span><code>{run.plan_sha256}</code></div>
          <div><span>{text.sourceHash}</span><code>{run.source_sha256}</code></div>
          <div><span>{text.inventoryHash}</span><code>{run.inventory_sha256 ?? '—'}</code></div>
          <div><span>{text.manifest}</span><code>{run.manifest_id} · r{run.revision}</code></div>
          <div><span>{text.createdBy}</span><strong>{run.created_by}</strong></div>
          <div><span>{text.approvedBy}</span><strong>{run.approved_by ?? '—'}</strong></div>
          <div><span>{text.dispatchedBy}</span><strong>{run.dispatched_by ?? '—'}</strong></div>
        </div>
      </section>

      <section className="factory-cost-grid" aria-label={text.contingency}>
        <div className="panel factory-cost-card"><span>{text.estimateLow}</span><strong>{formatCredits(run.estimate_low_credits, locale)}</strong><small>{text.credits}</small></div>
        <div className="panel factory-cost-card"><span>{text.estimateHigh}</span><strong>{formatCredits(run.estimate_high_credits, locale)}</strong><small>{text.credits}</small></div>
        <div className="panel factory-cost-card factory-cost-card--emphasis"><span>{text.contingency}</span><strong>{formatCredits(run.estimate_with_contingency_credits, locale)}</strong><small>{text.credits}</small></div>
        <div className="panel factory-cost-card"><span>{text.approvedCeiling}</span><strong>{formatCredits(run.approved_ceiling_credits, locale)}</strong><small>{text.credits}</small></div>
      </section>

      <section className="panel factory-exposure">
        <div><span>{text.gross}</span><strong>{formatCredits(exposure.provider_declared_gross_credits, locale)}</strong></div>
        <div><span>{text.refunds}</span><strong>{formatCredits(exposure.refunds_confirmed_credits, locale)}</strong></div>
        <div><span>{text.reservations}</span><strong>{formatCredits(exposure.active_reservations_credits, locale)}</strong></div>
        {exposure.refund_unknown ? <p className="factory-warning" role="note">{text.refundUnknown}</p> : null}
      </section>

      <section className="factory-actions-grid" aria-label={text.approvalTitle}>
        <form className="panel factory-action-card" onSubmit={approve}>
          <header><span className="factory-step">1</span><div><h3>{text.approvalTitle}</h3><p>{text.approvalIntro}</p></div></header>
          <label className="field"><span>{text.ceiling}</span><input type="number" min={run.estimate_with_contingency_credits} step="0.000001" value={approvalCeiling} onChange={(event) => setApprovalCeiling(event.target.value)} /></label>
          <label className="field"><span>{text.expiry}</span><input type="datetime-local" value={approvalExpiry} onChange={(event) => setApprovalExpiry(event.target.value)} /></label>
          <label className="field"><span>{text.reason}</span><textarea rows={2} maxLength={500} value={approvalReason} onChange={(event) => setApprovalReason(event.target.value)} /></label>
          <label className="field"><span>{text.confirmPlan}</span><input className="factory-hash-input" autoComplete="off" value={approvalHash} onChange={(event) => setApprovalHash(event.target.value.trim())} aria-describedby="approval-hash-hint" /></label>
          <small id="approval-hash-hint" className={approvalHash && approvalHash !== run.plan_sha256 ? 'factory-text-danger' : ''}>{text.hashMismatch}</small>
          {run.state !== 'awaiting_spend_approval' ? <p className="factory-action-note">{text.approvalUnavailable}</p> : null}
          <button className="button button--primary" type="submit" disabled={!approveReady || busy !== ''}>{busy === 'approve' ? text.approving : text.approve}</button>
        </form>

        <form className="panel factory-action-card factory-action-card--paid" onSubmit={dispatch}>
          <header><span className="factory-step">2</span><div><h3>{text.dispatchTitle}</h3><p>{text.dispatchIntro}</p></div></header>
          <label className="field"><span>{text.dispatchHash}</span><input className="factory-hash-input" autoComplete="off" value={dispatchHash} onChange={(event) => setDispatchHash(event.target.value.trim())} /></label>
          <label className="field"><span>{text.idempotency}</span><input autoComplete="off" minLength={16} maxLength={160} value={dispatchKey} onChange={(event) => setDispatchKey(event.target.value)} /></label>
          <label className="field factory-check"><input type="checkbox" checked={paidConfirmed} onChange={(event) => setPaidConfirmed(event.target.checked)} /><span>{text.paidCheck}</span></label>
          <label className="field"><span>{text.dispatchPhraseLabel}: <code>{text.dispatchPhrase}</code></span><input autoComplete="off" value={dispatchPhrase} onChange={(event) => setDispatchPhrase(event.target.value)} /></label>
          {run.state !== 'approved' || run.blocker_count > 0 || run.unpriced_job_count > 0 ? <p className="factory-action-note">{text.dispatchUnavailable}</p> : null}
          <button className="button factory-button--danger" type="submit" disabled={!dispatchReady || busy !== ''}>{busy === 'dispatch' ? text.dispatching : text.dispatch}</button>
        </form>
      </section>

      <section className="panel factory-recovery">
        <header className="panel__header"><div><h3>{text.recoveryTitle}</h3><p>{text.resumeHint}</p></div></header>
        <div className="factory-recovery__body">
          <button className="button button--secondary" type="button" disabled={!resumableRunStates.has(run.state) || busy !== ''} onClick={() => void perform('resume', () => api.resumeContentFactoryRun(run.id))}>{busy === 'resume' ? text.resuming : text.resume}</button>
          <form className="factory-retry-form" onSubmit={retry}>
            <label className="field"><span>{text.retryJob}</span><select value={retryJobId} disabled={failedJobs.length === 0} onChange={(event) => setRetryJobId(event.target.value)}><option value="">{text.allFailed}</option>{failedJobs.map((job) => <option key={job.id} value={job.job_id}>{job.job_id} · {job.state}</option>)}</select></label>
            {failedJobs.length === 0 ? <p className="factory-action-note">{text.noFailed}</p> : null}
            {replacementRequired ? <fieldset className="factory-risk-box"><legend>{text.replacementWarning}</legend>
              <label className="factory-check"><input type="checkbox" checked={allowNewAttempt} onChange={(event) => setAllowNewAttempt(event.target.checked)} /><span>{text.allowNewAttempt}</span></label>
              <label className="factory-check"><input type="checkbox" checked={allowReplacementPaid} onChange={(event) => setAllowReplacementPaid(event.target.checked)} /><span>{text.allowReplacementPaid}</span></label>
              <label className="factory-check"><input type="checkbox" checked={acceptDuplicate} onChange={(event) => setAcceptDuplicate(event.target.checked)} /><span>{text.acceptDuplicate}</span></label>
              <label className="field"><span>{text.riskPhraseLabel}: <code>{text.riskPhrase}</code></span><input value={riskPhrase} onChange={(event) => setRiskPhrase(event.target.value)} autoComplete="off" /></label>
            </fieldset> : null}
            <button className="button button--secondary" type="submit" disabled={failedJobs.length === 0 || !replacementConfirmed || busy !== ''}>{busy === 'retry' ? text.retrying : text.retry}</button>
          </form>
        </div>
      </section>

      <section className="panel">
        <header className="panel__header"><h3>{text.planBlockers}</h3></header>
        <div className="factory-two-column-list">
          <div><h4>{text.planBlockers}</h4>{manifest.blockers.length ? <ul>{manifest.blockers.map((blocker, index) => <li key={`${blocker.code}-${index}`}><strong>{blocker.code}</strong><span>{blocker.message}</span></li>)}</ul> : <p>{text.noBlockers}</p>}</div>
          <div><h4>{text.unpricedJobs}</h4>{manifest.budget.unpriced_job_ids.length ? <ul>{manifest.budget.unpriced_job_ids.map((id) => <li key={id}><code>{id}</code></li>)}</ul> : <p>{text.noUnpriced}</p>}</div>
        </div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header"><h3>{text.jobs}</h3></header>
        <div className="table-scroll" tabIndex={0}><table className="data-table factory-table"><thead><tr><th>{text.jobId}</th><th>{text.kind}</th><th>{text.provider}</th><th>{text.jobState}</th><th>{text.jobEstimate}</th><th>{text.attempt}</th></tr></thead><tbody>{jobs.map((job) => <tr key={job.id}><td><code>{job.job_id}</code></td><td>{job.kind}</td><td><strong>{job.provider}</strong><small>{job.operation}</small></td><td><span className="factory-job-state">{job.state}</span></td><td>{formatCredits(job.estimate_high_credits, locale)} / {formatCredits(job.reserved_credits, locale)}</td><td><code>{job.current_attempt_id ?? '—'}</code></td></tr>)}</tbody></table></div>
      </section>

      <section className="panel panel--table">
        <header className="panel__header"><h3>{text.attempts}</h3></header>
        {attempts.length ? <div className="table-scroll" tabIndex={0}><table className="data-table factory-table"><thead><tr><th>{text.jobId}</th><th>{text.sequence}</th><th>{text.state}</th><th>{text.providerJob}</th><th>{text.outcome}</th><th>{text.attemptCost}</th><th>{text.asset}</th><th>{text.errorCode}</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id}><td><code>{jobName(jobs, attempt.factory_job_id)}</code></td><td>{attempt.sequence}</td><td>{attempt.state}</td><td><code>{attempt.provider_job_id ?? '—'}</code><small>{attempt.provider_model ?? ''}</small></td><td>{attempt.submission_outcome ?? '—'}</td><td>{formatCredits(attempt.provider_declared_gross_credits, locale)} / {formatCredits(attempt.refund_confirmed_credits, locale)}</td><td>{attempt.private_asset_stored ? text.stored : text.notStored}</td><td><code>{attempt.error_code ?? '—'}</code></td></tr>)}</tbody></table></div> : <p className="factory-empty-row">{text.noRows}</p>}
      </section>

      <section className="panel panel--table">
        <header className="panel__header"><h3>{text.ledger}</h3></header>
        {ledger.length ? <div className="table-scroll" tabIndex={0}><table className="data-table factory-table"><thead><tr><th>{text.jobId}</th><th>{text.entryType}</th><th>{text.amount}</th><th>{text.source}</th><th>{text.date}</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id}><td><code>{jobName(jobs, entry.factory_job_id)}</code></td><td>{entry.entry_type}</td><td>{formatCredits(entry.amount_credits, locale)} {text.credits}</td><td><code>{entry.source_ref ?? '—'}</code><small>{entry.notes ?? ''}</small></td><td>{formatFactoryDate(entry.created_at, locale)}</td></tr>)}</tbody></table></div> : <p className="factory-empty-row">{text.noRows}</p>}
      </section>

      <section className="panel factory-qc-actions">
        <header className="panel__header"><div><h3>{text.qcActions}</h3><p>{text.qcReadOnly}</p></div></header>
        <div className="factory-actions-grid factory-qc-actions__body">
          <form className="factory-action-card" onSubmit={recordAutomatedQc}>
            <h4>{text.qc}</h4>
            <label className="field"><span>{text.qcJob}</span><select value={qcJobId} onChange={(event) => { setQcJobId(event.target.value); setQcAssetHash('') }}><option value="">—</option>{qcEligibleJobs.map((job) => <option key={job.id} value={job.job_id}>{job.job_id} · {job.state}</option>)}</select></label>
            {selectedQcAttempt?.asset_sha256 ? <p className="factory-action-note"><code>{selectedQcAttempt.asset_sha256}</code></p> : null}
            <label className="field"><span>{text.qcReport}</span><textarea rows={9} dir="ltr" spellCheck={false} value={qcReport} onChange={(event) => setQcReport(event.target.value)} aria-describedby="qc-report-hint" /></label>
            <small id="qc-report-hint">{text.qcReportHint}</small>
            <label className="field"><span>{text.qcAssetConfirm}</span><input className="factory-hash-input" value={qcAssetHash} onChange={(event) => setQcAssetHash(event.target.value.trim())} autoComplete="off" /></label>
            {qcEligibleJobs.length === 0 ? <p className="factory-action-note">{text.noQcEligible}</p> : null}
            <p className="factory-action-note">{text.validationRetryHint}</p>
            <button className="button button--secondary" type="submit" disabled={!qcReady || busy !== ''}>{busy === 'qc' ? text.recordingQc : text.recordQc}</button>
          </form>

          <form className="factory-action-card" onSubmit={recordHumanReview}>
            <h4>{text.humanReviewAction}</h4>
            <label className="field"><span>{text.reviewJob}</span><select value={reviewJobId} onChange={(event) => { setReviewJobId(event.target.value); setReviewQcHash('') }}><option value="">—</option>{reviewEligibleJobs.map((job) => <option key={job.id} value={job.job_id}>{job.job_id} · {job.state}</option>)}</select></label>
            <label className="field"><span>{text.reviewGate}</span><select value={reviewGate} onChange={(event) => setReviewGate(event.target.value)}><option value="">—</option>{humanGates.map((gate) => <option key={gate.gate_id} value={gate.gate_id}>{gate.gate_id}{gate.required ? ' *' : ''}</option>)}</select></label>
            <label className="field"><span>{text.reviewDecision}</span><select value={reviewDecision} onChange={(event) => setReviewDecision(event.target.value as 'approved' | 'rejected')}><option value="approved">{text.approveDecision}</option><option value="rejected">{text.rejectDecision}</option></select></label>
            <label className="field"><span>{text.reviewNotes}</span><textarea rows={3} maxLength={4000} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} /></label>
            {selectedReviewAttempt?.automated_qc_sha256 ? <p className="factory-action-note"><code>{selectedReviewAttempt.automated_qc_sha256}</code></p> : null}
            <label className="field"><span>{text.reviewHashConfirm}</span><input className="factory-hash-input" value={reviewQcHash} onChange={(event) => setReviewQcHash(event.target.value.trim())} autoComplete="off" /></label>
            {reviewEligibleJobs.length === 0 ? <p className="factory-action-note">{text.noReviewEligible}</p> : null}
            <button className="button button--primary" type="submit" disabled={!reviewReady || busy !== ''}>{busy === 'review' ? text.recordingReview : text.recordReview}</button>
          </form>
        </div>
      </section>

      <section className="factory-qc-grid">
        <div className="panel panel--table"><header className="panel__header"><div><h3>{text.qc}</h3><p>{manifest.quality.policy_version}</p></div></header>{qc.length ? <div className="table-scroll" tabIndex={0}><table className="data-table factory-table"><thead><tr><th>{text.jobId}</th><th>{text.gate}</th><th>{text.state}</th><th>{text.evidence}</th></tr></thead><tbody>{qc.map((item) => <tr key={item.id}><td><code>{jobName(jobs, item.factory_job_id)}</code></td><td>{item.gate_id}</td><td>{item.status}</td><td><code className="factory-hash" title={item.evidence_sha256}>{item.evidence_sha256}</code></td></tr>)}</tbody></table></div> : <p className="factory-empty-row">{text.noRows}</p>}</div>
        <div className="panel panel--table"><header className="panel__header"><h3>{text.humanReview}</h3></header>{reviews.length ? <div className="table-scroll" tabIndex={0}><table className="data-table factory-table"><thead><tr><th>{text.jobId}</th><th>{text.gate}</th><th>{text.decision}</th><th>{text.reviewer}</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td><code>{jobName(jobs, review.factory_job_id)}</code></td><td>{review.gate_id}</td><td>{review.decision}</td><td>{review.reviewer_id}<small>{review.notes ?? ''}</small></td></tr>)}</tbody></table></div> : <p className="factory-empty-row">{text.noRows}</p>}</div>
      </section>
      <details className="panel factory-manifest-details"><summary>{text.rawManifest}</summary><pre>{JSON.stringify(manifest, null, 2)}</pre></details>
    </div>
  )
}
