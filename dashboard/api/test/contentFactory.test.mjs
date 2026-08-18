import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  assertManifestReadyForApproval,
  parseFactoryManifest,
  parseFactoryMessage,
} from '../src/lib/contentFactory.ts';
import {
  APPROVED_FACTORY_VISUAL_IDENTITY_PACKS,
  CONTENT_FACTORY_VISUAL_IDENTITY_REGISTRY_SCHEMA,
} from '../src/lib/contentFactoryVisualIdentityRegistry.ts';
import {
  ContentFactoryQcError,
  createFactoryHumanReview,
  prepareAutomatedQc,
} from '../src/lib/contentFactoryQc.ts';
import {
  parseProviderResult,
  providerRequestForJob,
} from '../src/services/contentFactoryProvider.ts';
import {
  dispatchJobReservationsComplete,
  isContentFactoryQueue,
  processContentFactoryMessage,
  settleContentFactoryMessage,
} from '../src/queue/contentFactory.ts';
import {
  computeReferencePackSha256 as nodeReferencePackSha256,
  createManifest,
  sha256Hex as nodeSha256Hex,
} from '../../../tools/content-factory/lib/contract.mjs';

function manifestFixture() {
  const sourceHash = nodeSha256Hex('approved factory source');
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
  visualIdentity.reference_pack_sha256 = nodeReferencePackSha256(visualIdentity);
  return createManifest({
    manifest_id: 'factory/test/ep-01',
    entity: {
      entity_type: 'episode', entity_id: 'ep-01', planet_slug: '01-abjad',
      series_slug: 'luna-discovers-words', locale: 'ar', age_min: 3, age_max: 6,
    },
    visual_identity: visualIdentity,
    source: {
      path: 'docs/factory-test/ep-01.md', sha256: sourceHash,
      content_status: 'approved', duration_seconds: 15,
      reviews: [{
        review_type: 'editorial', required: true, status: 'approved',
        source_sha256: sourceHash, reviewer_id: 'reviewer-1',
        reviewed_at: '2026-08-12T09:00:00.000Z',
      }],
    },
    pipeline: { profile: 'cartoon_video_model_audio', eligibility: 'ready' },
    preflight: { manifest_ready: true, scene_plan_ready: true, prompt_plan_ready: true },
    jobs: [{
      job_id: 'scene-01', kind: 'video', provider: 'flux',
      operation: 'text-to-video-model-audio', duration_seconds: 15,
      input: { prompt: 'Safe Arabic model-audio scene', aspect_ratio: '16:9' },
      cost: {
        pricing_status: 'priced', pricing_key: 'flux.video.model-audio',
        low_credits: 0.75, high_credits: 0.75, basis: 'Observed provider rate',
      },
    }],
    budget: {
      pricing_version: 'test-v1', estimate_low_credits: 0.75,
      estimate_high_credits: 0.75, contingency_pct: 20,
      contingency_credits: 0.15, estimate_with_contingency_credits: 0.9,
      requested_ceiling_credits: 0.9, unpriced_job_ids: [],
    },
    quality: {
      policy_version: 'content-factory.qc/v1',
      automated_gates: [{ gate_id: 'video_decodable', required: true, status: 'not_run' }],
      human_gates: [{ gate_id: 'creative', required: true, status: 'pending' }],
    },
    blockers: [],
  });
}

test('Worker visual identity registry matches the version-controlled canonical registry', () => {
  const registry = JSON.parse(readFileSync(
    fileURLToPath(new URL('../../../tools/content-factory/visual-identity-registry.v1.json', import.meta.url)),
    'utf8',
  ));
  assert.equal(registry.schema_version, CONTENT_FACTORY_VISUAL_IDENTITY_REGISTRY_SCHEMA);
  assert.deepEqual([...APPROVED_FACTORY_VISUAL_IDENTITY_PACKS], registry.packs);
});

test('Worker parser accepts the CLI canonical hash and rejects post-plan tampering', async () => {
  const manifest = manifestFixture();
  const parsed = await parseFactoryManifest(manifest);
  assert.equal(parsed.plan_sha256, manifest.integrity.plan_sha256);
  assert.equal(parsed.blocker_count, 0);
  assert.equal(parsed.unpriced_job_count, 0);
  assert.equal(parsed.estimate_with_contingency_micros, 900000);
  assert.doesNotThrow(() => assertManifestReadyForApproval(parsed));

  const tampered = structuredClone(manifest);
  tampered.jobs[0].input.prompt = 'Changed after fingerprint';
  await assert.rejects(
    () => parseFactoryManifest(tampered),
    (error) => error.code === 'PLAN_HASH_MISMATCH',
  );
});

test('Worker parser enforces approved, series-bound, current visual identity packs', async () => {
  const missing = manifestFixture();
  delete missing.visual_identity;
  await assert.rejects(
    () => parseFactoryManifest(missing),
    (error) => error.code === 'VISUAL_IDENTITY_REQUIRED',
  );

  const unapproved = manifestFixture();
  unapproved.visual_identity.status = 'pending';
  await assert.rejects(
    () => parseFactoryManifest(unapproved),
    (error) => error.code === 'VISUAL_IDENTITY_UNAPPROVED',
  );

  const mismatch = manifestFixture();
  mismatch.visual_identity.series_slug = 'other-series';
  await assert.rejects(
    () => parseFactoryManifest(mismatch),
    (error) => error.code === 'VISUAL_IDENTITY_SERIES_MISMATCH',
  );

  const forged = manifestFixture();
  forged.visual_identity.references[0].sha256 = nodeSha256Hex('forged-but-well-formed-sheet');
  forged.visual_identity.reference_pack_sha256 = nodeReferencePackSha256(forged.visual_identity);
  await assert.rejects(
    () => parseFactoryManifest(forged),
    (error) => error.code === 'VISUAL_IDENTITY_REGISTRY_MISMATCH',
  );

  const stale = manifestFixture();
  stale.visual_identity.references[0].path = 'assets/identity/factory-test/replaced-sheet.png';
  await assert.rejects(
    () => parseFactoryManifest(stale),
    (error) => error.code === 'VISUAL_IDENTITY_PACK_HASH_MISMATCH',
  );
});

test('Worker parser refuses credentials before any job can be persisted', async () => {
  const manifest = manifestFixture();
  manifest.jobs[0].input.api_key = 'must-never-cross-boundary';
  await assert.rejects(
    () => parseFactoryManifest(manifest),
    (error) => error.code === 'SECRET_IN_MANIFEST',
  );
});

test('QC reports are bound to the immutable gate set and reject secret-bearing evidence', async () => {
  const manifest = manifestFixture();
  const value = {
    policy_version: 'content-factory.qc/v1',
    results: [{ gate_id: 'video_decodable', status: 'passed', evidence: { probe_ref: 'private/probe-1.json' } }],
  };
  const first = await prepareAutomatedQc({
    manifest,
    value,
    plan_sha256: manifest.integrity.plan_sha256,
    asset_sha256: 'e'.repeat(64),
  });
  const second = await prepareAutomatedQc({
    manifest,
    value,
    plan_sha256: manifest.integrity.plan_sha256,
    asset_sha256: 'e'.repeat(64),
  });
  assert.equal(first.required_passed, true);
  assert.equal(first.status, 'passed');
  assert.equal(first.evidence_sha256, second.evidence_sha256);
  assert.match(first.evidence_sha256, /^[a-f0-9]{64}$/);

  await assert.rejects(
    () => prepareAutomatedQc({
      manifest,
      value: {
        ...value,
        results: [{ gate_id: 'video_decodable', status: 'passed', evidence: { api_key: 'must-not-persist' } }],
      },
      plan_sha256: manifest.integrity.plan_sha256,
      asset_sha256: 'e'.repeat(64),
    }),
    (error) => error instanceof ContentFactoryQcError && error.code === 'SECRET_IN_QC_EVIDENCE',
  );
});

test('human review fingerprints bind reviewer, plan, asset, automated evidence and rejection reason', async () => {
  const manifest = manifestFixture();
  const review = await createFactoryHumanReview({
    manifest,
    gate_id: 'creative',
    decision: 'approved',
    reviewer_id: 'reviewer-2',
    plan_sha256: manifest.integrity.plan_sha256,
    asset_sha256: 'e'.repeat(64),
    automated_qc_evidence_sha256: 'f'.repeat(64),
    reviewed_at: '2026-08-12T11:00:00.000Z',
    notes: 'Master reviewed against current fingerprints',
  });
  assert.match(review.review_sha256, /^[a-f0-9]{64}$/);
  assert.equal(review.automated_qc_evidence_sha256, 'f'.repeat(64));
  await assert.rejects(
    () => createFactoryHumanReview({
      manifest,
      gate_id: 'creative',
      decision: 'rejected',
      reviewer_id: 'reviewer-2',
      plan_sha256: manifest.integrity.plan_sha256,
      asset_sha256: 'e'.repeat(64),
      automated_qc_evidence_sha256: 'f'.repeat(64),
      reviewed_at: '2026-08-12T11:00:00.000Z',
      notes: '',
    }),
    (error) => error instanceof ContentFactoryQcError && error.code === 'REJECTION_NOTES_REQUIRED',
  );
});

test('factory queue messages are versioned, bounded, and routed separately', () => {
  const message = {
    schema_version: 'content-factory.job/v1',
    action: 'dispatch',
    run_id: 'cfr-12345678',
    job_id: 'scene-01',
    plan_sha256: 'a'.repeat(64),
    allow_new_paid_attempt: false,
    accept_duplicate_charge_risk: false,
  };
  assert.deepEqual(parseFactoryMessage(message), message);
  assert.equal(parseFactoryMessage({ ...message, schema_version: 'v2' }), null);
  assert.equal(parseFactoryMessage({ ...message, allow_new_paid_attempt: 'yes' }), null);
  assert.equal(isContentFactoryQueue('content-factory-jobs'), true);
  assert.equal(isContentFactoryQueue('content-factory-jobs-dev-dlq'), true);
  assert.equal(isContentFactoryQueue('family-events'), false);
});

test('non-failure queue waits are redelivered without consuming the retry budget', async () => {
  const body = { schema_version: 'content-factory.job/v1', action: 'dispatch' };
  const delivered = [];
  const first = {
    body,
    acked: 0,
    retries: [],
    ack() { this.acked += 1; },
    retry(options) { this.retries.push(options); },
  };
  await settleContentFactoryMessage(first, {
    accepted: true,
    disposition: 'reschedule',
    delay_seconds: 30,
    reason: 'factory_dependencies_not_approved',
  }, {
    CONTENT_FACTORY_JOBS: {
      async send(value, options) { delivered.push({ value, options }); },
    },
  });
  assert.deepEqual(delivered, [{ value: body, options: { delaySeconds: 30 } }]);
  assert.equal(first.acked, 1);
  assert.deepEqual(first.retries, []);

  const fallback = {
    body,
    acked: 0,
    retries: [],
    ack() { this.acked += 1; },
    retry(options) { this.retries.push(options); },
  };
  await settleContentFactoryMessage(fallback, {
    accepted: true,
    disposition: 'reschedule',
    delay_seconds: 30,
    reason: 'factory_dependencies_not_approved',
  }, {
    CONTENT_FACTORY_JOBS: {
      async send() { throw new Error('queue unavailable'); },
    },
  });
  assert.equal(fallback.acked, 0);
  assert.deepEqual(fallback.retries, [{ delaySeconds: 30 }]);
});

test('queued dependencies keep rescheduling while another job awaits QC', async () => {
  const manifest = manifestFixture();
  const factoryRow = {
    run_id: 'cfr-awaiting-qc',
    run_state: 'awaiting_qc',
    plan_sha256: manifest.integrity.plan_sha256,
    manifest_json: JSON.stringify(manifest),
    approved_ceiling_micros: 900000,
    spend_approval_sha256: 'd'.repeat(64),
    spend_approval_status: 'approved',
    spend_approval_expires_at: '2099-01-01T00:00:00.000Z',
    blocker_count: 0,
    unpriced_job_count: 0,
    factory_job_id: 'cfj-dependent',
    job_id: 'scene-01',
    kind: 'video',
    provider: 'flux',
    operation: 'text-to-video-model-audio',
    idempotency_key: manifest.jobs[0].idempotency_key,
    dependencies_json: JSON.stringify(['parent-scene']),
    input_json: JSON.stringify(manifest.jobs[0].input),
    duration_seconds: 15,
    item_count: null,
    page_index: null,
    job_state: 'queued',
    estimate_low_micros: 750000,
    estimate_high_micros: 750000,
    reserved_micros: 750000,
  };
  const db = {
    prepare(sql) {
      return {
        bind() {
          return {
            async first() {
              if (sql.includes('FROM content_factory_runs r')) return factoryRow;
              if (sql.includes('FROM content_factory_attempts')) return null;
              if (sql.includes('SELECT COUNT(*) AS approved')) return { approved: 0 };
              throw new Error(`Unexpected query: ${sql}`);
            },
          };
        },
      };
    },
  };
  let providerCalls = 0;
  const result = await processContentFactoryMessage({ DB: db }, {
    schema_version: 'content-factory.job/v1',
    action: 'dispatch',
    run_id: factoryRow.run_id,
    job_id: factoryRow.job_id,
    plan_sha256: factoryRow.plan_sha256,
    allow_new_paid_attempt: false,
    accept_duplicate_charge_risk: false,
  }, async () => {
    providerCalls += 1;
    throw new Error('provider must not be reached');
  });
  assert.equal(result.disposition, 'reschedule');
  assert.equal(result.reason, 'factory_dependencies_not_approved');
  assert.equal(providerCalls, 0);
});

test('provider adapter keeps model audio and verified image payload shapes', () => {
  const video = manifestFixture().jobs[0];
  assert.deepEqual(providerRequestForJob(video).payload, {
    prompt: 'Safe Arabic model-audio scene',
    duration_seconds: 15,
    aspect_ratio: '16:9',
  });
  const image = {
    ...video,
    kind: 'image', operation: 'image-to-image', duration_seconds: undefined,
    count: 1,
    input: { prompt: 'identity lock', aspect_ratio: '16:9', image: 'data:image/png;base64,AAAA' },
  };
  assert.equal(providerRequestForJob(image).payload.image, 'data:image/png;base64,AAAA');
  assert.deepEqual(parseProviderResult({
    id: 'provider-1', status: 'completed', creditCost: 0.75,
    resultUrls: ['https://allowed.example/result.mp4'],
  }), {
    provider_job_id: 'provider-1', status: 'completed',
    provider_declared_gross_credits: 0.75,
    result_urls: ['https://allowed.example/result.mp4'], model: null,
  });
});

test('migration enforces immutable plans and the paid dispatch gate in SQLite', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0057_content_factory.sql', import.meta.url)),
    'utf8',
  );
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  db.prepare(`
    INSERT INTO content_factory_runs (
      id, manifest_id, schema_version, revision, entity_type, entity_id,
      planet_slug, series_slug, pipeline_profile, source_sha256, plan_sha256,
      manifest_json, state, blocker_count, unpriced_job_count,
      estimate_low_micros, estimate_high_micros,
      estimate_with_contingency_micros, created_by
    ) VALUES (?, ?, ?, 1, 'episode', ?, ?, ?, 'cartoon_video_model_audio', ?, ?,
              '{}', 'awaiting_spend_approval', 0, 0, 750000, 750000, 900000, ?)
  `).run(
    'cfr-test', 'manifest-test', 'content-factory.production-manifest/v1',
    'ep-01', '01-abjad', 'factory-test', 'b'.repeat(64), 'a'.repeat(64), 'author-1',
  );

  assert.throws(
    () => db.prepare("UPDATE content_factory_runs SET state='queued' WHERE id='cfr-test'").run(),
    /content_factory_paid_dispatch_not_approved/,
  );
  assert.throws(
    () => db.prepare("UPDATE content_factory_runs SET plan_sha256=? WHERE id='cfr-test'").run('c'.repeat(64)),
    /content_factory_plan_is_immutable/,
  );
  db.prepare(`
    UPDATE content_factory_runs
       SET state='approved', approved_ceiling_micros=900000,
           spend_approval_sha256=?, approved_by='approver-2',
           approved_at='2026-08-12T10:00:00.000Z'
     WHERE id='cfr-test'
  `).run('d'.repeat(64));
  db.prepare("UPDATE content_factory_runs SET state='queued' WHERE id='cfr-test'").run();
  assert.equal(db.prepare("SELECT state FROM content_factory_runs WHERE id='cfr-test'").get().state, 'queued');
  db.close();
});

test('initial dispatch CAS cannot create a phantom reservation for a losing request', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0057_content_factory.sql', import.meta.url)),
    'utf8',
  );
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  const runId = 'cfr-dispatch-race';
  const jobId = 'cfj-dispatch-race';
  const plan = 'a'.repeat(64);
  db.prepare(`
    INSERT INTO content_factory_runs (
      id, manifest_id, schema_version, revision, entity_type, entity_id,
      planet_slug, series_slug, pipeline_profile, source_sha256, plan_sha256,
      manifest_json, state, blocker_count, unpriced_job_count,
      estimate_low_micros, estimate_high_micros, estimate_with_contingency_micros,
      approved_ceiling_micros, spend_approval_sha256, created_by, approved_by, approved_at
    ) VALUES (?, 'manifest-race', 'content-factory.production-manifest/v1', 1,
      'episode', 'ep-race', '01-abjad', 'factory-test', 'cartoon_video_model_audio', ?, ?,
      '{}', 'approved', 0, 0, 750000, 750000, 900000, 900000, ?, 'planner-1',
      'approver-2', '2026-08-12T10:00:00.000Z')
  `).run(runId, 'b'.repeat(64), plan, 'd'.repeat(64));
  db.prepare(`
    INSERT INTO content_factory_jobs (
      id, run_id, job_id, kind, provider, operation, idempotency_key,
      state, estimate_low_micros, estimate_high_micros
    ) VALUES (?, ?, 'scene-01', 'video', 'flux', 'video',
      'factory-race-idempotency', 'planned', 750000, 750000)
  `).run(jobId, runId);

  const dispatch = (key, ledgerId) => {
    const run = db.prepare(`
      UPDATE content_factory_runs
         SET state = 'queued', dispatch_idempotency_key = ?
       WHERE id = ? AND state = 'approved' AND plan_sha256 = ?
    `).run(key, runId, plan);
    const job = db.prepare(`
      UPDATE content_factory_jobs SET state = 'queued', reserved_micros = 750000
       WHERE id = ? AND state = 'planned'
    `).run(jobId);
    const reservation = db.prepare(`
      INSERT OR IGNORE INTO content_factory_cost_ledger (
        id, run_id, factory_job_id, attempt_id, entry_type, amount_micros,
        source_ref, notes, created_by
      )
      SELECT ?, ?, ?, NULL, 'reservation', 750000, ?, 'initial dispatch reservation', 'publisher-1'
       WHERE EXISTS (
         SELECT 1 FROM content_factory_runs
          WHERE id = ? AND state = 'queued' AND dispatch_idempotency_key = ? AND plan_sha256 = ?
       )
         AND EXISTS (
         SELECT 1 FROM content_factory_jobs
          WHERE id = ? AND state = 'queued' AND current_attempt_id IS NULL AND reserved_micros = 750000
       )
    `).run(ledgerId, runId, jobId, `initial:${runId}:scene-01`, runId, key, plan, jobId);
    return { run: run.changes, job: job.changes, reservation: reservation.changes };
  };

  assert.deepEqual(dispatch('dispatch-key-first-0001', 'ledger-first'), {
    run: 1, job: 1, reservation: 1,
  });
  assert.deepEqual(dispatch('dispatch-key-loser-0002', 'ledger-loser'), {
    run: 0, job: 0, reservation: 0,
  });
  const exposure = db.prepare(`
    SELECT COUNT(*) AS count, SUM(amount_micros) AS amount
      FROM content_factory_cost_ledger WHERE run_id = ? AND entry_type = 'reservation'
  `).get(runId);
  assert.equal(exposure.count, 1);
  assert.equal(exposure.amount, 750000);
  db.close();
});

test('dispatch does not pass its gate when a reservation insert reports zero changes', () => {
  const changed = (value) => ({ meta: { changes: value } });
  assert.equal(dispatchJobReservationsComplete([
    changed(1), changed(1), changed(1), changed(1), changed(1),
  ], 2), true);
  assert.equal(dispatchJobReservationsComplete([
    changed(1), changed(1), changed(0), changed(1), changed(1),
  ], 2), false);
  assert.equal(dispatchJobReservationsComplete([
    changed(1), changed(1), changed(1), changed(1), changed(0),
  ], 2), false);
});

test('migration binds QC and human review rows to the current attempt before master approval', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0057_content_factory.sql', import.meta.url)),
    'utf8',
  );
  const db = new DatabaseSync(':memory:');
  db.exec(migration);
  const plan = 'a'.repeat(64);
  const asset = 'e'.repeat(64);
  const automated = 'f'.repeat(64);
  db.prepare(`
    INSERT INTO content_factory_runs (
      id, manifest_id, schema_version, revision, entity_type, entity_id,
      planet_slug, series_slug, pipeline_profile, source_sha256, plan_sha256,
      manifest_json, state, blocker_count, unpriced_job_count,
      estimate_low_micros, estimate_high_micros, estimate_with_contingency_micros, created_by
    ) VALUES ('cfr-qc', 'manifest-qc', 'content-factory.production-manifest/v1', 1,
      'episode', 'ep-qc', '01-abjad', 'factory-test', 'cartoon_video_model_audio', ?, ?, ?,
      'awaiting_qc', 0, 0, 1, 1, 1, 'planner-1')
  `).run('b'.repeat(64), plan, JSON.stringify({ quality: {
    automated_gates: [{ gate_id: 'video_decodable', required: true }],
    human_gates: [{ gate_id: 'creative', required: true }],
  } }));
  db.prepare(`
    INSERT INTO content_factory_jobs (
      id, run_id, job_id, kind, provider, operation, idempotency_key,
      state, estimate_low_micros, estimate_high_micros, current_attempt_id
    ) VALUES ('cfj-qc', 'cfr-qc', 'scene-qc', 'video', 'flux', 'video',
      'factory-qc-idempotency', 'downloaded', 1, 1, 'attempt-qc')
  `).run();
  db.prepare(`
    INSERT INTO content_factory_attempts (
      id, run_id, factory_job_id, sequence, state, idempotency_key,
      private_asset_key, asset_sha256, is_current
    ) VALUES ('attempt-qc', 'cfr-qc', 'cfj-qc', 1, 'downloaded',
      'factory-qc-attempt-key', 'private/asset.mp4', ?, 1)
  `).run(asset);

  assert.throws(
    () => db.prepare(`
      INSERT INTO content_factory_qc_evidence (
        id, run_id, factory_job_id, attempt_id, gate_id, status,
        plan_sha256, asset_sha256, evidence_sha256, evidence_key
      ) VALUES ('qc-bad', 'cfr-qc', 'cfj-qc', 'attempt-qc', 'video_decodable',
        'passed', ?, ?, ?, 'private/qc.json')
    `).run('c'.repeat(64), asset, '1'.repeat(64)),
    /content_factory_qc_context_mismatch/,
  );
  assert.throws(
    () => db.prepare("UPDATE content_factory_jobs SET state='approved' WHERE id='cfj-qc'").run(),
    /content_factory_job_qc_not_approved/,
  );
  assert.throws(
    () => db.prepare("UPDATE content_factory_runs SET state='completed' WHERE id='cfr-qc'").run(),
    /content_factory_run_jobs_not_approved/,
  );

  db.prepare(`
    INSERT INTO content_factory_qc_evidence (
      id, run_id, factory_job_id, attempt_id, gate_id, status,
      plan_sha256, asset_sha256, evidence_sha256, evidence_key
    ) VALUES ('qc-good', 'cfr-qc', 'cfj-qc', 'attempt-qc', 'video_decodable',
      'passed', ?, ?, ?, 'private/qc-good.json')
  `).run(plan, asset, '1'.repeat(64));
  db.prepare(`
    UPDATE content_factory_attempts
       SET state='awaiting_human_review', automated_qc_sha256=?
     WHERE id='attempt-qc'
  `).run(automated);
  assert.throws(
    () => db.prepare(`
      INSERT INTO content_factory_human_reviews (
        id, run_id, factory_job_id, attempt_id, gate_id, decision, reviewer_id,
        plan_sha256, asset_sha256, automated_qc_sha256, review_sha256, reviewed_at
      ) VALUES ('review-bad', 'cfr-qc', 'cfj-qc', 'attempt-qc', 'creative', 'approved',
        'reviewer-2', ?, ?, ?, ?, '2026-08-12T12:00:00.000Z')
    `).run(plan, asset, '0'.repeat(64), '2'.repeat(64)),
    /content_factory_human_review_context_mismatch/,
  );
  db.prepare(`
    INSERT INTO content_factory_human_reviews (
      id, run_id, factory_job_id, attempt_id, gate_id, decision, reviewer_id,
      plan_sha256, asset_sha256, automated_qc_sha256, review_sha256, reviewed_at
    ) VALUES ('review-good', 'cfr-qc', 'cfj-qc', 'attempt-qc', 'creative', 'approved',
      'reviewer-2', ?, ?, ?, ?, '2026-08-12T12:00:00.000Z')
  `).run(plan, asset, automated, '3'.repeat(64));
  db.prepare(`
    UPDATE content_factory_attempts
       SET state='approved', human_review_sha256=? WHERE id='attempt-qc'
  `).run('4'.repeat(64));
  db.prepare("UPDATE content_factory_jobs SET state='approved' WHERE id='cfj-qc'").run();
  db.prepare("UPDATE content_factory_runs SET state='completed' WHERE id='cfr-qc'").run();
  assert.equal(db.prepare("SELECT state FROM content_factory_runs WHERE id='cfr-qc'").get().state, 'completed');
  db.close();
});

test('routes separate plan import, spend approval, and paid dispatch', () => {
  const route = readFileSync(
    fileURLToPath(new URL('../src/routes/adminContentFactory.ts', import.meta.url)),
    'utf8',
  );
  assert.match(route, /post\('\/production\/factory\/plans', requirePermission\('create'\)/);
  assert.match(route, /post\('\/production\/factory\/:runId\/approve-spend', requirePermission\('approve'\)/);
  assert.match(route, /post\('\/production\/factory\/:runId\/dispatch', requirePermission\('publish'\)/);
  assert.match(route, /value\.allow_paid !== true/);
  assert.match(route, /Idempotency-Key/);
  assert.match(route, /CONTENT_FACTORY_JOBS/);
  assert.match(route, /post\('\/production\/factory\/:runId\/jobs\/:jobId\/automated-qc', requirePermission\('review'\)/);
  assert.match(route, /post\('\/production\/factory\/:runId\/jobs\/:jobId\/human-reviews', requirePermission\('review'\)/);
  assert.match(route, /confirmed_plan_sha256/);
  assert.match(route, /confirmed_asset_sha256/);
  assert.match(route, /confirmed_automated_qc_sha256/);
  const failedOnlyStates = route.match(/const FAILED_JOB_STATES = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.doesNotMatch(failedOnlyStates, /validation_failed/,
    'validation failures are corrected by re-submitting QC on the same asset, not provider retry');
  const resumableStates = route.match(/const RESUMABLE_JOB_STATES = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.doesNotMatch(resumableStates, /'queued'/,
    'resume is existing-attempts-only and cannot create an initial paid attempt');
  assert.match(route, /current_attempt_id IS NOT NULL/);
  assert.match(route, /state = 'queued' AND current_attempt_id IS NULL AND reserved_micros > 0/,
    'same-key dispatch recovery must redeliver only reserved jobs that never created an attempt');
  assert.match(route, /'awaiting_qc'[\s\S]*'awaiting_human_review'[\s\S]*'partially_failed'/,
    'same-key recovery must remain available while sibling jobs are in QC or failed states');
  assert.match(route, /INSERT OR IGNORE INTO content_factory_cost_ledger[\s\S]*dispatch_idempotency_key = \?[\s\S]*`initial:\$\{run\.id\}:\$\{job\.job_id\}`/,
    'initial reservations must be stable and conditional on winning the run dispatch CAS');
  const reservationGate = route.indexOf('if (!dispatchJobReservationsComplete(results, jobs.length))');
  const dispatchAudit = route.indexOf("auditStatement(c.env.DB, actor, 'dispatch_paid'", reservationGate);
  const queueSend = route.indexOf('await sendMessages(c.env.CONTENT_FACTORY_JOBS', dispatchAudit);
  assert.ok(reservationGate >= 0 && reservationGate < dispatchAudit && dispatchAudit < queueSend,
    'every reservation INSERT result must pass before dispatch audit or queue delivery');
  assert.match(route, /retry dispatch with the same Idempotency-Key/,
    'queue-send failures must direct callers to idempotent dispatch recovery, not resume');
  assert.match(route, /Replacement requires an active matching spend approval/);
  assert.doesNotMatch(route, /CREATIONS_BUCKET/);

  const queue = readFileSync(
    fileURLToPath(new URL('../src/queue/contentFactory.ts', import.meta.url)),
    'utf8',
  );
  assert.match(queue, /MEDIA_BUCKET\.put/);
  assert.match(queue, /r\.manifest_json/);
  assert.match(queue, /parseFactoryManifest\(parseJson\(row\.manifest_json, null\)\)/,
    'queued and resumed jobs must revalidate the immutable visual identity before provider access');
  assert.match(queue, /assertManifestReadyForApproval\(parsedManifest\)/);
  assert.match(queue, /assertActiveSpendApproval\(row\)/,
    'every new paid attempt must retain an active matching spend approval');
  assert.match(queue, /'approved', 'queued', 'running', 'paused', 'awaiting_qc',[\s\S]*'awaiting_human_review'/,
    'queued dependency messages must remain processable while sibling assets are in QC');
  assert.match(queue, /reason === 'factory_dependencies_not_approved'[\s\S]*disposition: 'reschedule'/,
    'unmet DAG dependencies must receive a fresh delayed message instead of exhausting queue retries');
  assert.match(queue, /CONTENT_FACTORY_JOBS\.send\(message\.body, \{ delaySeconds \}\)/,
    'non-failure waits must be acknowledged only after fresh delayed delivery succeeds');
  assert.match(queue, /attempt_creation_already_won/,
    'duplicate queue delivery must not submit the same newly-created attempt twice');
  assert.match(queue, /state = 'queued' AND current_attempt_id IS NULL THEN state/,
    'DLQ handling must preserve reserved jobs that never created an attempt');
  assert.match(queue, /message\.action !== 'dispatch'/,
    'resume cannot create an initial paid attempt');
  assert.match(queue, /export async function refreshContentFactoryRunState/);
  assert.match(queue, /approved === total \? 'completed'/,
    'only fully approved jobs complete a factory run');
  assert.doesNotMatch(queue, /CREATIONS_BUCKET/);
  assert.doesNotMatch(queue, /INSERT INTO content_costs/,
    'content_costs receives only approved actuals, never raw attempt charges');
});

test('index dispatches content factory queues before generic family and DLQ handlers', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/index.ts', import.meta.url)), 'utf8');
  const factory = source.indexOf('if (isContentFactoryQueue(queueName))');
  const familyDlq = source.indexOf("if (queueName.includes('-dlq'))", factory + 1);
  const family = source.indexOf('return handleFamilyEvents(', factory + 1);
  assert.ok(factory >= 0 && factory < familyDlq && familyDlq < family);
});
