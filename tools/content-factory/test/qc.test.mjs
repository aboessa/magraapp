import assert from 'node:assert/strict';
import test from 'node:test';

import {
  QcError,
  assertMasterDeliverable,
  createHumanReview,
  createQcPolicy,
  evaluateAutomatedQc,
} from '../lib/qc.mjs';

const planSha256 = '1'.repeat(64);
const sourceSha256 = '2'.repeat(64);
const assetSha256 = '3'.repeat(64);

function passingEvidence() {
  return {
    plan_sha256: planSha256,
    expected_source_sha256: sourceSha256,
    source_sha256: sourceSha256,
    asset_sha256: assetSha256,
    video: {
      exists: true,
      decodable: true,
      has_video_stream: true,
      has_audio_stream: true,
      duration_seconds: 15.1,
      expected_duration_seconds: 15,
      duration_tolerance_seconds: 1,
      width: 1920,
      height: 1080,
      expected_aspect_ratio: 16 / 9,
      audio_duration_seconds: 15,
      probe_ref: 'private://evidence/probe.json',
    },
  };
}

test('provider completion only creates automated evidence, not approval', () => {
  const policy = createQcPolicy({ profile: 'cartoon_video_model_audio', tags: ['scientific'] });
  const automated = evaluateAutomatedQc(policy, passingEvidence());
  assert.equal(automated.status, 'passed');
  assert.match(automated.evidence_sha256, /^[a-f0-9]{64}$/);
  assert.ok(policy.human_gates.some((gate) => gate.gate_id === 'scientific_accuracy'));
  assert.throws(
    () => assertMasterDeliverable({
      automatedQc: automated,
      policy,
      humanReviews: [],
      planSha256,
      assetSha256,
    }),
    (error) => error instanceof QcError,
  );
});

test('master delivery requires every fingerprinted human gate', () => {
  const policy = createQcPolicy({ profile: 'cartoon_video_model_audio', tags: ['scientific'] });
  const automated = evaluateAutomatedQc(policy, passingEvidence());
  const reviews = policy.human_gates.map((gate, index) => createHumanReview({
    gateId: gate.gate_id,
    decision: 'approved',
    reviewerId: `reviewer-${index + 1}`,
    planSha256,
    assetSha256,
    automatedQcEvidenceSha256: automated.evidence_sha256,
    reviewedAt: `2026-08-12T1${index}:00:00.000Z`,
  }));
  const delivery = assertMasterDeliverable({
    automatedQc: automated,
    policy,
    humanReviews: reviews,
    planSha256,
    assetSha256,
  });
  assert.equal(delivery.deliverable, true);
  assert.match(delivery.delivery_fingerprint, /^[a-f0-9]{64}$/);

  reviews[0].asset_sha256 = '4'.repeat(64);
  assert.throws(() => assertMasterDeliverable({
    automatedQc: automated,
    policy,
    humanReviews: reviews,
    planSha256,
    assetSha256,
  }));
});

test('model-audio QC fails if the FLUX audio stream was removed', () => {
  const policy = createQcPolicy({ profile: 'cartoon_video_model_audio' });
  const evidence = passingEvidence();
  evidence.video.has_audio_stream = false;
  const automated = evaluateAutomatedQc(policy, evidence);
  assert.equal(automated.status, 'failed');
  assert.ok(automated.results.some((result) => result.gate_id === 'model_audio_present' && result.status === 'failed'));
});

test('illustrated stories require independent image, narration, and text layers per page', () => {
  const policy = createQcPolicy({ profile: 'illustrated_read_to_me', tags: ['bedtime'] });
  const pages = [1, 2].map((pageIndex) => ({
    page_index: pageIndex,
    image: { decodable: true, sha256: String(pageIndex + 4).repeat(64) },
    narration: { decodable: true, sha256: String(pageIndex + 6).repeat(64), duration_seconds: 8 },
    text_layer_present: true,
    text_baked_into_image: false,
  }));
  const automated = evaluateAutomatedQc(policy, {
    plan_sha256: planSha256,
    expected_source_sha256: sourceSha256,
    source_sha256: sourceSha256,
    package_sha256: assetSha256,
    story: { expected_page_count: 2, pages },
  });
  assert.equal(automated.status, 'passed');
  assert.ok(policy.human_gates.some((gate) => gate.gate_id === 'sleep_suitability'));

  pages[1].text_baked_into_image = true;
  const failed = evaluateAutomatedQc(policy, {
    expected_source_sha256: sourceSha256,
    source_sha256: sourceSha256,
    package_sha256: assetSha256,
    story: { expected_page_count: 2, pages },
  });
  assert.equal(failed.status, 'failed');
});
