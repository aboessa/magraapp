import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  ContractError,
  assertDispatchReady,
  buildIdempotencyKey,
  computePlanSha256,
  computeReferencePackSha256,
  createManifest,
  createSpendApproval,
  sha256Hex,
  validateManifest,
} from '../lib/contract.mjs';

function approvedVisualIdentity() {
  const identity = {
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
  identity.reference_pack_sha256 = computeReferencePackSha256(identity);
  return identity;
}

function readyManifest(overrides = {}) {
  const sourceHash = sha256Hex('approved episode source');
  return createManifest({
    manifest_id: '01-abjad/luna/ep-01',
    entity: {
      entity_type: 'episode',
      entity_id: 'ep-01',
      planet_slug: '01-abjad',
      series_slug: 'luna-discovers-words',
      title: 'Episode 1',
      locale: 'ar',
      age_min: 3,
      age_max: 6,
    },
    visual_identity: approvedVisualIdentity(),
    source: {
      path: 'docs/content/planets/01-abjad/luna/ep-01.md',
      sha256: sourceHash,
      content_status: 'approved',
      duration_seconds: 15,
      reviews: [
        {
          review_type: 'editorial',
          required: true,
          status: 'approved',
          source_sha256: sourceHash,
          reviewer_id: 'reviewer-1',
          reviewed_at: '2026-08-12T10:00:00.000Z',
        },
      ],
    },
    pipeline: { profile: 'cartoon_video_model_audio', eligibility: 'ready' },
    preflight: { manifest_ready: true, scene_plan_ready: true, prompt_plan_ready: true },
    jobs: [
      {
        job_id: 'scene-01',
        kind: 'video',
        provider: 'flux',
        operation: 'text-to-video-model-audio',
        duration_seconds: 15,
        input: { prompt: 'Safe synthetic prompt' },
        cost: {
          pricing_status: 'priced',
          pricing_key: 'flux.video.model-audio',
          low_credits: 0.75,
          high_credits: 0.75,
          basis: 'Observed 15 second rate',
        },
      },
    ],
    budget: {
      pricing_version: 'test-v1',
      estimate_low_credits: 0.75,
      estimate_high_credits: 0.75,
      contingency_pct: 20,
      contingency_credits: 0.15,
      estimate_with_contingency_credits: 0.9,
      requested_ceiling_credits: 0.9,
      unpriced_job_ids: [],
    },
    quality: {
      policy_version: 'content-factory.qc/v1',
      automated_gates: [{ gate_id: 'video_decodable', required: true, status: 'not_run' }],
      human_gates: [{ gate_id: 'creative', required: true, status: 'pending' }],
    },
    blockers: [],
    ...overrides,
  });
}

test('production manifest schema is local, parseable, and pins v1', async () => {
  const raw = await readFile(new URL('../schemas/production-manifest.v1.schema.json', import.meta.url), 'utf8');
  const schema = JSON.parse(raw);
  assert.equal(schema.properties.schema_version.const, 'content-factory.production-manifest/v1');
  assert.equal(schema.properties.jobs.type, 'array');
  assert.ok(schema.required.includes('visual_identity'));
  assert.equal(schema.properties.visual_identity.oneOf[1].$ref, '#/$defs/visualIdentity');
  assert.equal(schema.$defs.visualIdentity.properties.status.const, 'approved');
  assert.ok(!('$id' in schema), 'schema must not require remote resolution');
});

test('trusted visual identity registry fingerprints real repository assets', async () => {
  const raw = await readFile(new URL('../visual-identity-registry.v1.json', import.meta.url), 'utf8');
  const registry = JSON.parse(raw);
  assert.equal(registry.schema_version, 'content-factory.visual-identity-registry/v1');
  assert.ok(registry.packs.length > 0);
  for (const pack of registry.packs) {
    assert.equal(pack.status, 'approved');
    assert.equal(pack.reference_pack_sha256, computeReferencePackSha256(pack));
    for (const reference of pack.references) {
      const bytes = await readFile(new URL(`../../../${reference.path}`, import.meta.url));
      assert.equal(sha256Hex(bytes), reference.sha256);
    }
  }
});

test('manifest fingerprints source, plan, and each job idempotently', () => {
  const manifest = readyManifest();
  assert.match(manifest.integrity.source_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.integrity.plan_sha256, /^[a-f0-9]{64}$/);
  assert.match(manifest.jobs[0].idempotency_key, /^cf-v1-[a-f0-9]{64}$/);
  assert.equal(validateManifest(manifest).valid, true);

  const tampered = structuredClone(manifest);
  tampered.jobs[0].input.prompt = 'Changed after approval';
  const result = validateManifest(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === 'PLAN_HASH_MISMATCH'));
});

test('visual identity pack is required, approved, series-bound, and internally fingerprinted', () => {
  const manifest = readyManifest();
  assert.equal(validateManifest(manifest).valid, true);
  assert.equal(
    manifest.visual_identity.reference_pack_sha256,
    computeReferencePackSha256(manifest.visual_identity),
  );

  const missing = structuredClone(manifest);
  delete missing.integrity;
  missing.spend_approval = null;
  delete missing.visual_identity;
  assert.throws(
    () => createManifest(missing),
    (error) => error instanceof ContractError
      && error.errors.some((item) => item.code === 'VISUAL_IDENTITY_REQUIRED'),
  );

  const mismatch = structuredClone(manifest);
  delete mismatch.integrity;
  mismatch.spend_approval = null;
  mismatch.visual_identity.series_slug = 'other-series';
  mismatch.visual_identity.reference_pack_sha256 = computeReferencePackSha256(mismatch.visual_identity);
  assert.throws(
    () => createManifest(mismatch),
    (error) => error.errors.some((item) => item.code === 'VISUAL_IDENTITY_SERIES_MISMATCH'),
  );

  const unapproved = structuredClone(manifest);
  delete unapproved.integrity;
  unapproved.spend_approval = null;
  unapproved.visual_identity.status = 'pending';
  assert.throws(
    () => createManifest(unapproved),
    (error) => error.errors.some((item) => item.code === 'VISUAL_IDENTITY_UNAPPROVED'),
  );

  const badReferenceHash = structuredClone(manifest);
  delete badReferenceHash.integrity;
  badReferenceHash.spend_approval = null;
  badReferenceHash.visual_identity.references[0].sha256 = 'not-a-sha256';
  badReferenceHash.visual_identity.reference_pack_sha256 = computeReferencePackSha256(badReferenceHash.visual_identity);
  assert.throws(
    () => createManifest(badReferenceHash),
    (error) => error.errors.some((item) => item.code === 'INVALID_VISUAL_REFERENCE_HASH'),
  );

  const missingGuide = structuredClone(manifest);
  delete missingGuide.integrity;
  missingGuide.spend_approval = null;
  missingGuide.visual_identity.references = missingGuide.visual_identity.references.filter(
    (reference) => reference.kind !== 'visual_guide',
  );
  missingGuide.visual_identity.reference_pack_sha256 = computeReferencePackSha256(missingGuide.visual_identity);
  assert.throws(
    () => createManifest(missingGuide),
    (error) => error.errors.some((item) => item.code === 'VISUAL_IDENTITY_GUIDE_REQUIRED'),
  );

  const forged = structuredClone(manifest);
  delete forged.integrity;
  forged.spend_approval = null;
  forged.visual_identity.references[0].sha256 = sha256Hex('forged-but-well-formed-sheet');
  forged.visual_identity.reference_pack_sha256 = computeReferencePackSha256(forged.visual_identity);
  assert.throws(
    () => createManifest(forged),
    (error) => error.errors.some((item) => item.code === 'VISUAL_IDENTITY_REGISTRY_MISMATCH'),
  );

  const stale = structuredClone(manifest);
  delete stale.integrity;
  stale.spend_approval = null;
  stale.visual_identity.references[0].path = 'assets/identity/luna/new-sheet.png';
  assert.throws(
    () => createManifest(stale),
    (error) => error.errors.some((item) => item.code === 'VISUAL_IDENTITY_PACK_HASH_MISMATCH'),
  );
});

test('changing the reference pack changes both plan and job idempotency fingerprints', () => {
  const original = readyManifest();
  const changed = structuredClone(original);
  changed.visual_identity.identity_id = 'luna-discovers-words/luna-v3';
  changed.visual_identity.version = 'luna-v3';
  changed.visual_identity.references[0].sha256 = sha256Hex('approved-character-sheet-v3');
  changed.visual_identity.reference_pack_sha256 = computeReferencePackSha256(changed.visual_identity);
  changed.jobs[0].idempotency_key = buildIdempotencyKey({
    manifestId: changed.manifest_id,
    revision: changed.revision,
    sourceHash: changed.source.sha256,
    pipelineProfile: changed.pipeline.profile,
    visualIdentityPackSha256: changed.visual_identity.reference_pack_sha256,
    job: changed.jobs[0],
  });
  changed.integrity.plan_sha256 = computePlanSha256(changed);

  assert.notEqual(changed.integrity.plan_sha256, original.integrity.plan_sha256);
  assert.notEqual(changed.jobs[0].idempotency_key, original.jobs[0].idempotency_key);
  assert.ok(validateManifest(changed).errors.some((error) => error.code === 'VISUAL_IDENTITY_NOT_REGISTERED'));
});

test('paid dispatch needs exact approval, readiness, budget, and --allow-paid', () => {
  const manifest = readyManifest();
  assert.throws(
    () => assertDispatchReady(manifest, { allowPaid: true }),
    (error) => error instanceof ContractError
      && error.errors.some((item) => item.code === 'SPEND_NOT_APPROVED'),
  );

  const approved = createSpendApproval(manifest, {
    approvedBy: 'owner-1',
    ceilingCredits: 0.9,
    confirmedPlanSha256: manifest.integrity.plan_sha256,
    approvedAt: '2026-08-12T11:00:00.000Z',
  });
  assert.throws(
    () => assertDispatchReady(approved),
    (error) => error.errors.some((item) => item.code === 'PAID_FLAG_REQUIRED'),
  );
  const authorization = assertDispatchReady(approved, {
    allowPaid: true,
    now: new Date('2026-08-12T12:00:00.000Z'),
  });
  assert.deepEqual(authorization.selected_job_ids, ['scene-01']);

  assert.throws(
    () => assertDispatchReady(approved, {
      allowPaid: true,
      committedGrossCredits: 0.5,
      reservedCredits: 0.1,
    }),
    (error) => error.errors.some((item) => item.code === 'BUDGET_CEILING_EXCEEDED'),
  );
});

test('credentials are forbidden in immutable manifests', () => {
  const base = readyManifest();
  const input = structuredClone(base);
  delete input.integrity;
  input.spend_approval = null;
  input.jobs[0].input.api_key = 'never-store-this';
  assert.throws(
    () => createManifest(input),
    (error) => error instanceof ContractError
      && error.errors.some((item) => item.code === 'SECRET_IN_MANIFEST'),
  );
});

test('live action is inventory-only and unapproved religious content cannot create jobs', () => {
  const base = readyManifest();
  const liveInput = structuredClone(base);
  delete liveInput.integrity;
  liveInput.spend_approval = null;
  liveInput.pipeline = { profile: 'live_action', eligibility: 'excluded', exclusion_code: 'LIVE_ACTION' };
  assert.throws(
    () => createManifest(liveInput),
    (error) => error.errors.some((item) => item.code === 'LIVE_ACTION_AUTOMATION_FORBIDDEN'),
  );

  const religiousInput = structuredClone(base);
  delete religiousInput.integrity;
  religiousInput.spend_approval = null;
  religiousInput.entity.planet_slug = '09-islamic';
  religiousInput.blockers = [{
    code: 'RELIGIOUS_CONTENT_UNAPPROVED',
    severity: 'hard_block',
    message: 'No approved religious script exists.',
  }];
  assert.throws(
    () => createManifest(religiousInput),
    (error) => error.errors.some((item) => item.code === 'RELIGIOUS_GENERATION_FORBIDDEN'),
  );
});
