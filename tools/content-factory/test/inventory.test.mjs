import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { inventoryCheck, scanInventory } from '../lib/inventory.mjs';
import { buildCatalogPlan } from '../lib/plan.mjs';

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

test('canonical inventory matches the eight current planet indexes exactly', async () => {
  const inventory = await scanInventory({ root: workspaceRoot });
  assert.deepEqual(inventory.totals, {
    series_count: 24,
    episode_count: 117,
    story_count: 15,
    story_page_count: 194,
    top_level_unit_count: 132,
    catalog_duration_seconds: 36125,
    video_duration_seconds: 32150,
    story_duration_seconds: 3975,
    ai_eligible_series_count: 23,
    ai_eligible_episode_count: 111,
    ai_eligible_story_count: 15,
    ai_eligible_bundle_count: 126,
    excluded_episode_count: 6,
  });
  assert.equal(inventory.canonical_sources.length, 8);
  assert.equal(inventory.exclusions.length, 6);
  assert.ok(inventory.exclusions.every((item) => item.entity_key.includes('/try-it-at-home/')));
});

test('scanner reports source-backed conflicts and creates zero religious jobs', async () => {
  const inventory = await scanInventory({ root: workspaceRoot });
  const conflict = (path) => inventory.conflicts.find((item) => item.path.endsWith(path));
  assert.deepEqual(conflict('a-calm-tale/story-01-bird-home.md').details, {
    index_seconds: 160,
    source_card_seconds: 54,
    acceptance_seconds: 160,
  });
  assert.deepEqual(conflict('bedtime-stories/story-01-ant-journey.md').details, {
    index_seconds: 260,
    source_card_seconds: 123,
    acceptance_seconds: 260,
  });
  assert.deepEqual(conflict('09-islamic/series-shells.md').details, {
    advertised_units: 57,
    row_unit_total: 66,
  });
  assert.equal(inventory.islamic.written_unit_count, 0);
  assert.equal(inventory.islamic.generated_job_count, 0);
  assert.equal(inventoryCheck(inventory).ok, false);
});

test('catalog plan is non-dispatchable and separates estimates from unpriced work', async () => {
  const inventory = await scanInventory({ root: workspaceRoot });
  const plan = buildCatalogPlan(inventory);
  assert.equal(plan.mode, 'planning_only');
  assert.equal(plan.paid_dispatch_authorized, false);
  assert.equal(plan.approved_ceiling_credits, null);
  assert.equal(plan.dispatchable_job_count, 0);
  assert.equal(plan.readiness.ai_eligible_bundle_count, 126);
  assert.equal(plan.budget.explicitly_classified_video.episode_count, 75);
  assert.equal(plan.budget.explicitly_classified_video.duration_seconds, 24320);
  assert.equal(plan.budget.explicitly_classified_video.estimate_high_credits, 1216);
  assert.equal(plan.budget.unresolved_motion_story_scenario.episode_count, 36);
  assert.equal(plan.budget.unresolved_motion_story_scenario.scenario_credits, 310.5);
  assert.equal(plan.budget.illustrated_story_images_floor.image_count, 194);
  assert.equal(plan.budget.illustrated_story_images_floor.estimate_high_credits, 19.4);
  assert.equal(plan.budget.priced_subtotal_credits, 1235.4);
  assert.equal(plan.budget.provisional_all_video_and_story_image_scenario_credits, 1545.9);
  assert.equal(plan.budget.provisional_scenario_with_contingency_credits, 1777.785);
  assert.ok(plan.budget.unpriced_components.includes('story narration provider'));
  assert.ok(plan.entities.every((entity) => entity.generated_job_count === 0));
});
