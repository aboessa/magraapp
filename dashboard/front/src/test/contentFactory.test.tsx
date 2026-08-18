import { beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { renderWithProviders } from './harness'
import type {
  ContentFactoryDetail,
  ContentFactoryManifest,
  ContentFactoryRun,
  ContentFactoryRunState,
} from '../types/api'

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    contentFactoryRuns: vi.fn(),
    contentFactoryRun: vi.fn(),
    importContentFactoryPlan: vi.fn(),
    approveContentFactorySpend: vi.fn(),
    dispatchContentFactoryRun: vi.fn(),
    resumeContentFactoryRun: vi.fn(),
    retryContentFactoryFailed: vi.fn(),
    recordContentFactoryAutomatedQc: vi.fn(),
    recordContentFactoryHumanReview: vi.fn(),
  },
}))

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return { ...actual, api: apiMock }
})

const { ContentFactoryPage } = await import('../pages/ContentFactoryPage')
const { ContentFactoryRunPage } = await import('../pages/ContentFactoryRunPage')
const { adminPath } = await import('../lib/adminPath')

const PLAN_SHA = 'a'.repeat(64)
const SOURCE_SHA = 'b'.repeat(64)
const INVENTORY_SHA = 'c'.repeat(64)
const REFERENCE_PACK_SHA = '0132d294f45a6fe644d5b2034e86f15e4627ff146f5f8130247d41c9202905a7'
const CHARACTER_SHEET_SHA = '0edcd9e6280dbece120a3f6a6247dac55e0fac20a09489b54e37f04a08b20deb'
const VISUAL_GUIDE_SHA = 'ba579c39b4b462d7709e53fdb984601d8c926a3525c63dcbf0b05f02007ff1c6'

const MANIFEST: ContentFactoryManifest = {
  schema_version: 'content-factory.production-manifest/v1',
  manifest_id: 'manifest-luna-e01',
  revision: 1,
  entity: {
    entity_type: 'episode',
    entity_id: 'luna-e01',
    planet_slug: 'planet-one',
    series_slug: 'luna-discovers-words',
    locale: 'ar',
    title: 'لونا — الحلقة الأولى',
  },
  visual_identity: {
    identity_id: 'luna-discovers-words/luna-v2',
    version: 'luna-v2',
    series_slug: 'luna-discovers-words',
    status: 'approved',
    reference_pack_sha256: REFERENCE_PACK_SHA,
    references: [{
      kind: 'character_sheet',
      path: 'majarra_images/assets/images/characters/luna-preschool-character-sheet.png',
      sha256: CHARACTER_SHEET_SHA,
    }, {
      kind: 'visual_guide',
      path: 'tools/content-factory/reference-packs/luna-v2-visual-guide.json',
      sha256: VISUAL_GUIDE_SHA,
    }],
    approved_by: 'majarra-creative-direction',
    approved_at: '2026-08-12T00:00:00.000Z',
  },
  source: {
    path: 'content/luna/e01.json',
    sha256: SOURCE_SHA,
    content_status: 'locked',
    duration_seconds: 180,
    page_count: null,
    reviews: [],
  },
  pipeline: {
    profile: 'cartoon_video_model_audio',
    eligibility: 'ready',
    exclusion_code: null,
  },
  preflight: { manifest_ready: true, scene_plan_ready: true, prompt_plan_ready: true },
  jobs: [{
    job_id: 'luna-e01-video',
    kind: 'video',
    provider: 'playveo',
    operation: 'flux-video',
    state: 'planned',
    idempotency_key: 'luna-e01-video-key',
    dependencies: [],
    duration_seconds: 180,
    input: { prompt: 'bounded prompt' },
    cost: {
      pricing_status: 'priced',
      pricing_key: 'flux-video-second',
      low_credits: 8,
      high_credits: 9,
      basis: '180 seconds',
    },
  }],
  budget: {
    unit: 'credits',
    pricing_version: 'test-v1',
    estimate_low_credits: 8,
    estimate_high_credits: 9,
    contingency_pct: 15,
    contingency_credits: 1.35,
    estimate_with_contingency_credits: 10.35,
    requested_ceiling_credits: null,
    unpriced_job_ids: [],
  },
  quality: {
    policy_version: 'qc-v1',
    automated_gates: [{ gate_id: 'technical-video', required: true, status: 'not_run' }],
    human_gates: [{ gate_id: 'editorial-master', required: true, status: 'pending' }],
  },
  blockers: [],
  integrity: { source_sha256: SOURCE_SHA, plan_sha256: PLAN_SHA },
  spend_approval: null,
  metadata: { inventory_sha256: INVENTORY_SHA },
}

function run(state: ContentFactoryRunState): ContentFactoryRun {
  const approved = state === 'approved' || ['queued', 'running', 'paused', 'awaiting_qc', 'awaiting_human_review', 'partially_failed', 'failed', 'completed'].includes(state)
  return {
    id: 'cfr-luna-e01',
    manifest_id: MANIFEST.manifest_id,
    revision: 1,
    entity_type: 'episode',
    entity_id: 'luna-e01',
    planet_slug: 'planet-one',
    series_slug: 'luna-discovers-words',
    pipeline_profile: 'cartoon_video_model_audio',
    source_sha256: SOURCE_SHA,
    plan_sha256: PLAN_SHA,
    inventory_sha256: INVENTORY_SHA,
    state,
    blocker_count: 0,
    unpriced_job_count: 0,
    estimate_low_credits: 8,
    estimate_high_credits: 9,
    estimate_with_contingency_credits: 10.35,
    approved_ceiling_credits: approved ? 12 : null,
    spend_approval_sha256: approved ? 'd'.repeat(64) : null,
    created_by: 'planner-1',
    approved_by: approved ? 'approver-2' : null,
    approved_at: approved ? '2026-08-12T09:00:00.000Z' : null,
    dispatched_by: null,
    dispatched_at: null,
    last_error_code: null,
    created_at: '2026-08-12T08:00:00.000Z',
    updated_at: '2026-08-12T09:00:00.000Z',
  }
}

function detail(state: ContentFactoryRunState, jobState = 'planned'): ContentFactoryDetail {
  const currentRun = run(state)
  return {
    run: currentRun,
    manifest: MANIFEST,
    jobs: [{
      id: 'cfj-1',
      job_id: 'luna-e01-video',
      kind: 'video',
      provider: 'playveo',
      operation: 'flux-video',
      idempotency_key: 'luna-e01-video-key',
      dependencies: [],
      duration_seconds: 180,
      count: null,
      page_index: null,
      state: jobState,
      estimate_low_credits: 8,
      estimate_high_credits: 9,
      reserved_credits: state === 'approved' ? 0 : 9,
      current_attempt_id: jobState === 'planned' ? null : 'attempt-1',
      created_at: currentRun.created_at,
      updated_at: currentRun.updated_at,
    }],
    attempts: [],
    cost_ledger: [],
    exposure: {
      provider_declared_gross_credits: 0,
      refunds_confirmed_credits: 0,
      active_reservations_credits: 0,
      total_exposure_credits: 0,
      refund_unknown: false,
    },
    qc_evidence: [],
    human_reviews: [],
  }
}

function detailWithAttempt(
  state: ContentFactoryRunState,
  jobState: string,
  attemptState: string,
  automatedQcSha: string | null = null,
): ContentFactoryDetail {
  const value = detail(state, jobState)
  value.attempts = [{
    id: 'attempt-1',
    factory_job_id: 'cfj-1',
    sequence: 1,
    state: attemptState,
    provider_job_id: 'provider-1',
    provider_model: 'flux',
    provider_declared_gross_credits: 9,
    refund_status: 'not_applicable',
    refund_confirmed_credits: 0,
    asset_sha256: 'e'.repeat(64),
    automated_qc_sha256: automatedQcSha,
    human_review_sha256: null,
    submission_outcome: 'acknowledged',
    error_code: null,
    is_current: 1,
    submitted_at: '2026-08-12T09:00:00.000Z',
    completed_at: '2026-08-12T09:02:00.000Z',
    created_at: '2026-08-12T09:00:00.000Z',
    updated_at: '2026-08-12T09:02:00.000Z',
    private_asset_stored: 1,
  }]
  return value
}

function renderRun(value: ContentFactoryDetail) {
  apiMock.contentFactoryRun.mockResolvedValue({ success: true, data: value })
  return renderWithProviders(<ContentFactoryRunPage />, {
    route: adminPath(`production/factory/${value.run.id}`),
    path: `${adminPath('production/factory')}/:runId`,
  })
}

beforeEach(() => {
  const waiting = run('awaiting_spend_approval')
  apiMock.contentFactoryRuns.mockResolvedValue({
    success: true,
    data: [waiting],
    meta: { total: 1, limit: 20, offset: 0, by_state: { awaiting_spend_approval: 1 } },
  })
  apiMock.importContentFactoryPlan.mockResolvedValue({ success: true, data: waiting, meta: { duplicate: false } })
  apiMock.approveContentFactorySpend.mockResolvedValue({ success: true, data: run('approved') })
  apiMock.dispatchContentFactoryRun.mockResolvedValue({ success: true, data: run('queued') })
  apiMock.resumeContentFactoryRun.mockResolvedValue({ success: true, data: { run_id: waiting.id, queued_jobs: 1, mode: 'existing_attempts_only' } })
  apiMock.retryContentFactoryFailed.mockResolvedValue({ success: true, data: { run_id: waiting.id, queued_jobs: 1, replacement_jobs: 1, failed_only: true } })
  apiMock.recordContentFactoryAutomatedQc.mockResolvedValue({ success: true, data: {
    run_id: waiting.id, job_id: 'luna-e01-video', attempt_id: 'attempt-1', state: 'awaiting_human_review',
    required_passed: true, automated_qc_sha256: 'f'.repeat(64),
  } })
  apiMock.recordContentFactoryHumanReview.mockResolvedValue({ success: true, data: {
    run_id: waiting.id, job_id: 'luna-e01-video', attempt_id: 'attempt-1', gate_id: 'editorial-master',
    decision: 'approved', state: 'approved', review_sha256: '1'.repeat(64), human_reviews_sha256: '2'.repeat(64),
  } })
})

describe('ContentFactoryPage', () => {
  test('selecting or pasting a manifest does not import until the explicit save action', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentFactoryPage />, { route: adminPath('production/factory') })

    expect(await screen.findByRole('link', { name: 'فتح التشغيل' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'استيراد خطة' }))
    const json = screen.getByLabelText(/JSON الخطة/)
    fireEvent.change(json, { target: { value: JSON.stringify(MANIFEST) } })

    expect(apiMock.importContentFactoryPlan).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'حفظ الخطة فقط' }))

    await waitFor(() => expect(apiMock.importContentFactoryPlan).toHaveBeenCalledWith(MANIFEST))
  })

  test('rejects an embedded spend approval before calling the server', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ContentFactoryPage />, { route: adminPath('production/factory') })
    await screen.findByRole('link', { name: 'فتح التشغيل' })
    await user.click(screen.getByRole('button', { name: 'استيراد خطة' }))
    fireEvent.change(screen.getByLabelText(/JSON الخطة/), {
      target: { value: JSON.stringify({ ...MANIFEST, spend_approval: { approved_by: 'planner-1' } }) },
    })
    await user.click(screen.getByRole('button', { name: 'حفظ الخطة فقط' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('spend_approval')
    expect(apiMock.importContentFactoryPlan).not.toHaveBeenCalled()
  })
  test('rejects a missing visual identity pack before calling the server', async () => {
    const user = userEvent.setup()
    const missingIdentity = structuredClone(MANIFEST) as Partial<ContentFactoryManifest>
    delete missingIdentity.visual_identity
    renderWithProviders(<ContentFactoryPage />, { route: adminPath('production/factory') })
    await screen.findByRole('link', { name: 'فتح التشغيل' })
    await user.click(screen.getByRole('button', { name: 'استيراد خطة' }))
    fireEvent.change(screen.getByLabelText(/JSON الخطة/), {
      target: { value: JSON.stringify(missingIdentity) },
    })
    await user.click(screen.getByRole('button', { name: 'حفظ الخطة فقط' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('visual_identity')
    expect(apiMock.importContentFactoryPlan).not.toHaveBeenCalled()
  })
  test('allows inventory-only live action manifests to use visual_identity null', async () => {
    const user = userEvent.setup()
    const liveAction: ContentFactoryManifest = {
      ...structuredClone(MANIFEST),
      visual_identity: null,
      pipeline: { profile: 'live_action', eligibility: 'excluded', exclusion_code: 'LIVE_ACTION' },
      jobs: [],
    }
    renderWithProviders(<ContentFactoryPage />, { route: adminPath('production/factory') })
    await screen.findByRole('link', { name: 'فتح التشغيل' })
    await user.click(screen.getByRole('button', { name: 'استيراد خطة' }))
    fireEvent.change(screen.getByLabelText(/JSON الخطة/), {
      target: { value: JSON.stringify(liveAction) },
    })
    await user.click(screen.getByRole('button', { name: 'حفظ الخطة فقط' }))

    await waitFor(() => expect(apiMock.importContentFactoryPlan).toHaveBeenCalledWith(liveAction))
  })
})

describe('ContentFactoryRunPage spend boundaries', () => {
  test('records approval only after the exact plan hash and ceiling are confirmed', async () => {
    const user = userEvent.setup()
    renderRun(detail('awaiting_spend_approval'))

    expect(await screen.findByText(/منشئ التشغيل لا يستطيع اعتماد إنفاقه بنفسه/)).toBeInTheDocument()
    const approveButton = screen.getByRole('button', { name: 'اعتماد الإنفاق' })
    expect(approveButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('اكتب بصمة الخطة كاملة للتأكيد'), { target: { value: PLAN_SHA } })
    expect(approveButton).toBeEnabled()
    await user.click(approveButton)

    await waitFor(() => expect(apiMock.approveContentFactorySpend).toHaveBeenCalledWith('cfr-luna-e01', {
      confirmed_plan_sha256: PLAN_SHA,
      ceiling_credits: 10.35,
      expires_at: null,
      reason: undefined,
    }))
    expect(apiMock.dispatchContentFactoryRun).not.toHaveBeenCalled()
  })

  test('dispatch remains disabled until hash, paid acknowledgement, phrase and idempotency key are all present', async () => {
    const user = userEvent.setup()
    renderRun(detail('approved'))

    const dispatchButton = await screen.findByRole('button', { name: 'إطلاق الطلبات المدفوعة' })
    expect(dispatchButton).toBeDisabled()
    fireEvent.change(screen.getByLabelText('أعد كتابة بصمة الخطة المعتمدة'), { target: { value: PLAN_SHA } })
    await user.click(screen.getByLabelText(/أفهم أن هذا الإجراء يسمح بطلبات مدفوعة/))
    fireEvent.change(screen.getByLabelText(/اكتب عبارة التأكيد/), { target: { value: 'تشغيل مدفوع' } })

    expect(dispatchButton).toBeEnabled()
    await user.click(dispatchButton)

    await waitFor(() => expect(apiMock.dispatchContentFactoryRun).toHaveBeenCalledTimes(1))
    const [id, payload, idempotencyKey] = apiMock.dispatchContentFactoryRun.mock.calls[0]
    expect(id).toBe('cfr-luna-e01')
    expect(payload).toEqual({ confirmed_plan_sha256: PLAN_SHA, allow_paid: true })
    expect(idempotencyKey).toMatch(/^dashboard:cfr-luna-e01:/)
    expect(idempotencyKey.length).toBeGreaterThanOrEqual(16)
  })

  test('resume calls only the existing-attempt endpoint', async () => {
    const user = userEvent.setup()
    renderRun(detail('paused', 'timed_out'))

    await user.click(await screen.findByRole('button', { name: 'استئناف المحاولات الحالية' }))
    await waitFor(() => expect(apiMock.resumeContentFactoryRun).toHaveBeenCalledWith('cfr-luna-e01'))
    expect(apiMock.dispatchContentFactoryRun).not.toHaveBeenCalled()
    expect(apiMock.retryContentFactoryFailed).not.toHaveBeenCalled()
  })

  test('replacement retry requires every duplicate-charge acknowledgement and the exact phrase', async () => {
    const user = userEvent.setup()
    renderRun(detail('failed', 'provider_failed'))

    const retryButton = await screen.findByRole('button', { name: 'إعادة محاولة الفاشل فقط' })
    expect(retryButton).toBeDisabled()
    await user.click(screen.getByLabelText('اسمح بإنشاء محاولة مدفوعة جديدة.'))
    await user.click(screen.getByLabelText('اسمح بإنفاق مدفوع للاستبدال ضمن السقف المعتمد.'))
    await user.click(screen.getByLabelText(/أقبل احتمال الخصم المكرر/))
    fireEvent.change(screen.getByLabelText(/اكتب عبارة قبول الخطر/), { target: { value: 'أقبل خطر الخصم المكرر' } })

    expect(retryButton).toBeEnabled()
    await user.click(retryButton)
    await waitFor(() => expect(apiMock.retryContentFactoryFailed).toHaveBeenCalledWith('cfr-luna-e01', {
      failed_only: true,
      allow_new_paid_attempt: true,
      allow_paid: true,
      accept_duplicate_charge_risk: true,
    }))
  })

  test('validation_failed is corrected by recording QC on the same asset, not by paid retry', async () => {
    const user = userEvent.setup()
    renderRun(detailWithAttempt('failed', 'validation_failed', 'validation_failed'))

    const retryButton = await screen.findByRole('button', { name: 'إعادة محاولة الفاشل فقط' })
    expect(retryButton).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('مهمة لها أصل خاص حالي'), 'luna-e01-video')
    fireEvent.change(screen.getByLabelText('تقرير أداة QC بصيغة JSON'), { target: { value: JSON.stringify({
      policy_version: 'qc-v1',
      results: [{ gate_id: 'technical-video', status: 'passed', evidence: { probe_ref: 'private/probe.json' } }],
    }) } })
    fireEvent.change(screen.getByLabelText('اكتب بصمة الأصل الحالية لتأكيد السياق'), { target: { value: 'e'.repeat(64) } })
    await user.click(screen.getByRole('button', { name: 'تسجيل دليل QC الآلي' }))

    await waitFor(() => expect(apiMock.recordContentFactoryAutomatedQc).toHaveBeenCalledWith('cfr-luna-e01', 'luna-e01-video', {
      attempt_id: 'attempt-1',
      confirmed_plan_sha256: PLAN_SHA,
      confirmed_asset_sha256: 'e'.repeat(64),
      policy_version: 'qc-v1',
      results: [{ gate_id: 'technical-video', status: 'passed', evidence: { probe_ref: 'private/probe.json' } }],
    }))
    expect(apiMock.retryContentFactoryFailed).not.toHaveBeenCalled()
  })

  test('human approval is bound to the current automated-QC fingerprint', async () => {
    const user = userEvent.setup()
    renderRun(detailWithAttempt('awaiting_human_review', 'awaiting_human_review', 'awaiting_human_review', 'f'.repeat(64)))

    await user.selectOptions(await screen.findByLabelText('مهمة اجتازت QC الآلي'), 'luna-e01-video')
    await user.selectOptions(screen.getByLabelText('بوابة المراجعة'), 'editorial-master')
    fireEvent.change(screen.getByLabelText('اكتب بصمة QC الآلي الحالية لتأكيد السياق'), { target: { value: 'f'.repeat(64) } })
    await user.click(screen.getByRole('button', { name: 'تسجيل قرار المراجع' }))

    await waitFor(() => expect(apiMock.recordContentFactoryHumanReview).toHaveBeenCalledWith('cfr-luna-e01', 'luna-e01-video', {
      attempt_id: 'attempt-1',
      gate_id: 'editorial-master',
      decision: 'approved',
      confirmed_plan_sha256: PLAN_SHA,
      confirmed_asset_sha256: 'e'.repeat(64),
      confirmed_automated_qc_sha256: 'f'.repeat(64),
      notes: undefined,
    }))
  })

  test('the loaded run has no detectable axe violations', async () => {
    const { container } = renderRun(detail('approved'))
    await screen.findByRole('heading', { name: 'لونا — الحلقة الأولى' })

    // jsdom لا يوفّر Canvas، لذلك لا يستطيع axe قياس التباين حسابيًا هنا؛
    // تبقى كل قواعد البنية والأسماء والعلاقات ولوحة المفاتيح مفعّلة.
    const result = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(result.violations).toEqual([])
  })
})
