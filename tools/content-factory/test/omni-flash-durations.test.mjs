import assert from 'node:assert/strict';
import test from 'node:test';

import {
  OMNI_FLASH_ALLOWED_DURATIONS,
  buildOmniFlashBeats,
  isOmniFlashDuration,
  planOmniFlashDurations,
} from '../lib/omni-flash-durations.mjs';

test('Omni Flash permits PlayVeo durations only', () => {
  assert.deepEqual(OMNI_FLASH_ALLOWED_DURATIONS, [4, 6, 8, 10]);
  for (const duration of OMNI_FLASH_ALLOWED_DURATIONS) assert.equal(isOmniFlashDuration(duration), true);
  for (const duration of [3, 5, 7, 9, 12, 15, 20]) assert.equal(isOmniFlashDuration(duration), false);
});

test('beat planning preserves even totals and uses only supported clips', () => {
  const plan = buildOmniFlashBeats(180, { boundaries: [15, 40, 70, 100, 130, 160] });
  assert.equal(plan.output_total_seconds, 180);
  assert.equal(plan.beats.reduce((sum, beat) => sum + beat.duration_seconds, 0), 180);
  assert.ok(plan.beats.every((beat) => isOmniFlashDuration(beat.duration_seconds)));
  assert.ok(plan.durations.includes(10));
});

test('odd editorial totals receive one second of visual tail instead of unsupported clips', () => {
  const plan = planOmniFlashDurations(105, { boundaries: [15, 40, 80] });
  assert.equal(plan.output_total_seconds, 106);
  assert.equal(plan.timing_adjustment_seconds, 1);
  assert.ok(plan.durations.every((duration) => isOmniFlashDuration(duration)));
});
