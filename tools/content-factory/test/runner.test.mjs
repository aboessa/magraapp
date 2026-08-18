import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  computeReferencePackSha256,
  createManifest,
  createSpendApproval,
  sha256Hex,
} from '../lib/contract.mjs';
import { runPlannedJob, resumeAttempt, retryFailedJob } from '../lib/runner.mjs';
import { transitionAttempt } from '../lib/state-machine.mjs';

function approvedManifest() {
  const sourceHash = sha256Hex('approved source');
  const visualIdentity = {
    identity_id: 'luna-discovers-words/luna-v2',
    version: 'luna-v2',
    series_slug: 'luna-discovers-words',
    status: 'approved',
    reference_pack_sha256: '',
    references: [{
      kind: 'character_sheet',
      path: 'majarra_images/assets/images/characters/luna-preschool-character-sheet.png',
      sha256: '0edcd9e6280dbece120a3f6a6247dac55e0fac20a09489b54e37f04a08b20deb',
    }, {
      kind: 'visual_guide',
      path: 'tools/content-factory/reference-packs/luna-v2-visual-guide.json',
      sha256: 'ba579c39b4b462d7709e53fdb984601d8c926a3525c63dcbf0b05f02007ff1c6',
    }],
    approved_by: 'majarra-creative-direction',
    approved_at: '2026-08-12T00:00:00.000Z',
  };
  visualIdentity.reference_pack_sha256 = computeReferencePackSha256(visualIdentity);
  const manifest = createManifest({
    manifest_id: 'factory/test/ep-01',
    entity: {
      entity_type: 'episode', entity_id: 'ep-01', planet_slug: '01-abjad',
      series_slug: 'luna-discovers-words', locale: 'ar', age_min: 3, age_max: 6,
    },
    visual_identity: visualIdentity,
    source: {
      path: 'test/ep-01.md', sha256: sourceHash, content_status: 'approved',
      duration_seconds: 15,
      reviews: [{
        review_type: 'editorial', required: true, status: 'approved', source_sha256: sourceHash,
        reviewer_id: 'reviewer-1', reviewed_at: '2026-08-12T09:00:00.000Z',
      }],
    },
    pipeline: { profile: 'cartoon_video_model_audio', eligibility: 'ready' },
    preflight: { manifest_ready: true, scene_plan_ready: true, prompt_plan_ready: true },
    jobs: [{
      job_id: 'scene-01', kind: 'video', provider: 'flux', operation: 'text-to-video-model-audio',
      duration_seconds: 15, input: { prompt: 'safe prompt' },
      cost: {
        pricing_status: 'priced', pricing_key: 'flux.video.model-audio',
        low_credits: 0.75, high_credits: 0.75, basis: 'test',
      },
    }],
    budget: {
      pricing_version: 'test', estimate_low_credits: 0.75, estimate_high_credits: 0.75,
      contingency_pct: 20, contingency_credits: 0.15,
      estimate_with_contingency_credits: 0.9, requested_ceiling_credits: 0.9,
      unpriced_job_ids: [],
    },
    quality: { policy_version: 'test', automated_gates: [], human_gates: [] },
    blockers: [],
  });
  return createSpendApproval(manifest, {
    approvedBy: 'owner-1', ceilingCredits: 0.9,
    confirmedPlanSha256: manifest.integrity.plan_sha256,
    approvedAt: '2026-08-12T10:00:00.000Z',
  });
}

class FakeRepository {
  constructor() {
    this.attempts = [];
    this.reservations = [];
    this.committed = 0;
    this.refunds = 0;
  }
  async findCurrentAttempt({ run_id, job_id }) {
    return this.attempts.findLast((attempt) => attempt.run_id === run_id && attempt.job_id === job_id && attempt.current !== false) ?? null;
  }
  async nextAttemptSequence({ run_id, job_id }) {
    return this.attempts.filter((attempt) => attempt.run_id === run_id && attempt.job_id === job_id).length + 1;
  }
  async saveAttempt(attempt) {
    const index = this.attempts.findIndex((item) => item.attempt_id === attempt.attempt_id);
    if (index >= 0) this.attempts[index] = structuredClone(attempt);
    else this.attempts.push(structuredClone(attempt));
  }
  async getBudgetSnapshot() {
    return {
      provider_declared_gross_credits: this.committed,
      refunds_confirmed_credits: this.refunds,
      reserved_credits: this.reservations.reduce((sum, item) => sum + item.amount_credits, 0),
    };
  }
  async reserveBudget(reservation) {
    const current = this.committed + this.reservations.reduce((sum, item) => sum + item.amount_credits, 0);
    if (current + reservation.amount_credits > reservation.approved_ceiling_credits) return { ok: false };
    this.reservations.push(reservation);
    return { ok: true };
  }
  async commitProviderCost({ attempt_id, provider_declared_gross_credits }) {
    const index = this.reservations.findIndex((item) => item.attempt_id === attempt_id);
    if (index >= 0) this.reservations.splice(index, 1);
    this.committed += provider_declared_gross_credits ?? 0;
  }
  async releaseBudgetReservation({ attempt_id }) {
    this.reservations = this.reservations.filter((item) => item.attempt_id !== attempt_id);
  }
}

const fixedNow = () => '2026-08-12T11:00:00.000Z';

test('runner cannot instantiate provider or reserve budget before paid gates pass', async () => {
  const manifest = approvedManifest();
  const repository = new FakeRepository();
  let providerFactories = 0;
  await assert.rejects(() => runPlannedJob({
    manifest, runId: 'run-01', jobId: 'scene-01', allowPaid: false, repository,
    providerFactory: async () => { providerFactories += 1; return {}; },
    now: fixedNow,
  }));
  assert.equal(providerFactories, 0);
  assert.equal(repository.reservations.length, 0);
  assert.equal(repository.attempts.length, 0);
});

test('authorized runner reserves atomically, submits once, and persists provider idempotency', async () => {
  const manifest = approvedManifest();
  const repository = new FakeRepository();
  let submits = 0;
  const result = await runPlannedJob({
    manifest, runId: 'run-01', jobId: 'scene-01', allowPaid: true, repository,
    providerFactory: async () => ({
      async submit(job) {
        submits += 1;
        assert.equal(job.idempotency_key, manifest.jobs[0].idempotency_key);
        return {
          provider_job_id: 'provider-1', status: 'pending',
          provider_declared_gross_credits: 0.75, result_urls: [], model: 'flux',
        };
      },
      async poll() { throw new Error('not used'); },
    }),
    now: fixedNow,
  });
  assert.equal(submits, 1);
  assert.equal(result.attempt.state, 'provider_pending');
  assert.equal(result.attempt.provider_job_id, 'provider-1');
  assert.equal(repository.committed, 0.75);
  assert.equal(repository.reservations.length, 0);

  await assert.rejects(() => runPlannedJob({
    manifest, runId: 'run-01', jobId: 'scene-01', allowPaid: true, repository,
    providerFactory: async () => { throw new Error('must not instantiate'); },
    now: fixedNow,
  }), /use resume or retry-failed/);
  assert.equal(submits, 1);
});

test('timeout resumes the same provider job without a second submission', async () => {
  const manifest = approvedManifest();
  const repository = new FakeRepository();
  let submits = 0;
  let polls = 0;
  const provider = {
    async submit() {
      submits += 1;
      return { provider_job_id: 'provider-1', status: 'pending', provider_declared_gross_credits: 0.75, result_urls: [] };
    },
    async poll(_job, providerJobId) {
      polls += 1;
      assert.equal(providerJobId, 'provider-1');
      return { provider_job_id: 'provider-1', status: 'processing', provider_declared_gross_credits: 0.75, result_urls: [] };
    },
  };
  await runPlannedJob({
    manifest, runId: 'run-01', jobId: 'scene-01', allowPaid: true, repository,
    providerFactory: async () => provider, now: fixedNow,
  });
  const pending = await repository.findCurrentAttempt({ run_id: 'run-01', job_id: 'scene-01' });
  await repository.saveAttempt(transitionAttempt(pending, 'timed_out', { at: fixedNow() }));

  const result = await retryFailedJob({
    manifest, runId: 'run-01', jobId: 'scene-01', repository,
    providerFactory: async () => provider, now: fixedNow,
  });
  assert.equal(result.action, 'resumed_poll');
  assert.equal(result.attempt.state, 'provider_processing');
  assert.equal(submits, 1);
  assert.equal(polls, 1);
});

test('resume downloads completed video to private storage without persisting signed URL', async () => {
  const manifest = approvedManifest();
  const repository = new FakeRepository();
  const provider = {
    async submit() {
      return { provider_job_id: 'provider-1', status: 'pending', provider_declared_gross_credits: 0.75, result_urls: [] };
    },
    async poll() {
      return {
        provider_job_id: 'provider-1', status: 'completed', provider_declared_gross_credits: 0.75,
        result_urls: ['https://signed.example/video.mp4'],
      };
    },
    async download() { return new TextEncoder().encode('private mp4 bytes'); },
  };
  await runPlannedJob({
    manifest, runId: 'run-01', jobId: 'scene-01', allowPaid: true, repository,
    providerFactory: async () => provider, now: fixedNow,
  });
  const result = await resumeAttempt({
    manifest, runId: 'run-01', jobId: 'scene-01', repository,
    providerFactory: async () => provider,
    assetStore: {
      async putPrivate(input) {
        assert.equal(input.content_type, 'video/mp4');
        return { private_key: `factory/${input.asset_sha256}.mp4` };
      },
    },
    now: fixedNow,
  });
  assert.equal(result.attempt.state, 'downloaded');
  assert.match(result.attempt.asset_sha256, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(result.attempt).includes('signed.example'));
});

test('superseded Luna v1 runner is resume-existing-only', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../../playveo/luna-e01/production.mjs', import.meta.url)),
    'utf8',
  );
  const apiStart = source.indexOf('async function api(method, route, body)');
  const postGuard = source.indexOf("method === 'POST' && MANIFEST.production_status === 'superseded_do_not_dispatch'", apiStart);
  const providerFetch = source.indexOf('const response = await fetch', apiStart);
  assert.ok(apiStart >= 0 && postGuard > apiStart && postGuard < providerFetch,
    'the HTTP adapter must reject every provider POST before fetch');
  assert.match(source,
    /if \(planned\.length && MANIFEST\.production_status === 'superseded_do_not_dispatch'\)[\s\S]*Skipped \$\{planned\.length\} unsubmitted/,
    'unsubmitted legacy work must be skipped rather than posted');
  assert.match(source,
    /const pollable = jobs\.filter[\s\S]*waitAndDownload\(state, job\)/,
    'existing provider job IDs must retain their polling/download path');
  assert.match(source,
    /MANIFEST\.production_status === 'superseded_do_not_dispatch' && hasArg\('retry-failed'\)/,
    'superseded legacy work must reject replacement attempts');
});