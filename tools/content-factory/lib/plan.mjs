import { sha256Hex } from './contract.mjs';

export const CATALOG_PLAN_VERSION = 'content-factory.catalog-plan/v1';

const VIDEO_CREDITS_PER_SECOND = 0.05;
const STORY_IMAGE_CREDITS = 0.1;

function credits(value) {
  return Number(value.toFixed(6));
}

function allItems(inventory) {
  return inventory.series.flatMap((series) => series.items.map((item) => ({
    planet_slug: series.planet_slug,
    series_slug: series.series_slug,
    declared_production_level: series.declared_production_level,
    ...item,
  })));
}

function issueCounts(issues) {
  return Object.fromEntries([...issues.reduce((counts, issue) => {
    counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function itemKey(item) {
  return `${item.entity_type}:${item.planet_slug}/${item.series_slug}/${item.entity_id}`;
}

function hasBlockingIssue(item) {
  return item.issues.some((issue) => issue.severity === 'error' || issue.severity === 'hard_block');
}

export function buildCatalogPlan(inventory, { contingencyPct = 15 } = {}) {
  if (!Number.isFinite(contingencyPct) || contingencyPct < 0 || contingencyPct > 100) {
    throw new RangeError('contingencyPct must be between 0 and 100');
  }
  const items = allItems(inventory);
  const eligible = items.filter((item) => item.eligibility !== 'excluded');
  const eligibleEpisodes = eligible.filter((item) => item.entity_type === 'episode');
  const stories = eligible.filter((item) => item.entity_type === 'story');
  const explicitVideo = eligibleEpisodes.filter((item) => item.pipeline_profile === 'cartoon_video_model_audio');
  const unresolvedVideo = eligibleEpisodes.filter((item) => item.pipeline_profile === null);
  const explicitVideoSeconds = explicitVideo.reduce((sum, item) => sum + item.duration_seconds, 0);
  const unresolvedVideoSeconds = unresolvedVideo.reduce((sum, item) => sum + item.duration_seconds, 0);
  const pricedVideoCredits = credits(explicitVideoSeconds * VIDEO_CREDITS_PER_SECOND);
  const unresolvedVideoScenarioCredits = credits(unresolvedVideoSeconds * VIDEO_CREDITS_PER_SECOND);
  const storyImageCredits = credits(stories.reduce((sum, item) => sum + item.page_count, 0) * STORY_IMAGE_CREDITS);
  const pricedSubtotal = credits(pricedVideoCredits + storyImageCredits);
  const provisionalScenarioSubtotal = credits(pricedSubtotal + unresolvedVideoScenarioCredits);
  const contingencyCredits = credits(provisionalScenarioSubtotal * contingencyPct / 100);
  const provisionalWithContingency = credits(provisionalScenarioSubtotal + contingencyCredits);

  const entities = items.map((item) => {
    const reasons = [];
    if (item.eligibility === 'excluded') reasons.push(item.exclusion_code ?? 'EXCLUDED');
    if (hasBlockingIssue(item)) reasons.push(...item.issues
      .filter((issue) => issue.severity === 'error' || issue.severity === 'hard_block')
      .map((issue) => issue.code));
    if (item.eligibility !== 'excluded') {
      reasons.push('PRODUCTION_MANIFEST_MISSING', 'SCENE_OR_PAGE_PLAN_MISSING', 'PROMPT_PLAN_MISSING');
      reasons.push('HUMAN_SOURCE_REVIEWS_UNSIGNED');
    }
    return {
      entity_key: itemKey(item),
      source_path: item.source_path,
      source_sha256: item.source_sha256 ?? null,
      pipeline_profile: item.pipeline_profile,
      status: item.eligibility === 'excluded' ? 'excluded' : 'blocked',
      dispatchable: false,
      generated_job_count: 0,
      reasons: [...new Set(reasons)],
    };
  });

  const plan = {
    plan_version: CATALOG_PLAN_VERSION,
    mode: 'planning_only',
    inventory_sha256: inventory.inventory_sha256,
    paid_dispatch_authorized: false,
    approved_ceiling_credits: null,
    dispatchable_job_count: 0,
    readiness: {
      canonical_bundle_count: inventory.totals.top_level_unit_count,
      ai_eligible_bundle_count: inventory.totals.ai_eligible_bundle_count,
      excluded_bundle_count: inventory.exclusions.length,
      dispatchable_bundle_count: 0,
      blocked_bundle_count: eligible.length,
      source_conflict_count: inventory.conflicts.filter((issue) => issue.severity !== 'warning').length,
      inventory_blocker_count: inventory.blockers.length,
      blocker_codes: issueCounts(inventory.blockers),
    },
    budget: {
      unit: 'credits',
      pricing_basis: {
        flux_video_model_audio_per_second: VIDEO_CREDITS_PER_SECOND,
        flux_text_to_image_per_image: STORY_IMAGE_CREDITS,
      },
      explicitly_classified_video: {
        episode_count: explicitVideo.length,
        duration_seconds: explicitVideoSeconds,
        estimate_low_credits: pricedVideoCredits,
        estimate_high_credits: pricedVideoCredits,
      },
      unresolved_motion_story_scenario: {
        status: unresolvedVideo.length === 0 ? 'not_applicable' : 'unpriced_profile_assumption',
        episode_count: unresolvedVideo.length,
        duration_seconds: unresolvedVideoSeconds,
        assumed_profile: 'cartoon_video_model_audio',
        scenario_credits: unresolvedVideoScenarioCredits,
        approvable: false,
      },
      illustrated_story_images_floor: {
        story_count: stories.length,
        image_count: stories.reduce((sum, item) => sum + item.page_count, 0),
        estimate_low_credits: storyImageCredits,
        estimate_high_credits: storyImageCredits,
        excludes: ['narration', 'image_variants', 'retries', 'storage', 'delivery'],
      },
      priced_subtotal_credits: pricedSubtotal,
      provisional_all_video_and_story_image_scenario_credits: provisionalScenarioSubtotal,
      contingency_pct: contingencyPct,
      contingency_credits: contingencyCredits,
      provisional_scenario_with_contingency_credits: provisionalWithContingency,
      unpriced_components: [
        'motion_story pipeline selection',
        'story narration provider',
        'image variants',
        'provider retries',
        'storage and delivery',
      ],
      approved_ceiling_credits: null,
      note: 'Scenario amounts are planning evidence, not actual charges or spend approval.',
    },
    batches: [
      {
        batch_id: 'inventory-conflict-resolution',
        status: 'blocked',
        paid: false,
        entity_count: new Set(inventory.conflicts.filter((issue) => issue.entity_key).map((issue) => issue.entity_key)).size,
        purpose: 'Resolve source duration and index conflicts before manifest authoring.',
      },
      {
        batch_id: 'manifest-authoring',
        status: 'ready_for_non_paid_work',
        paid: false,
        entity_count: eligible.filter((item) => !hasBlockingIssue(item) && item.pipeline_profile).length,
        purpose: 'Author scene/page plans, prompts, source reviews, and immutable manifests. No provider dispatch.',
      },
      {
        batch_id: 'islamic-hold',
        status: 'hard_blocked',
        paid: false,
        entity_count: inventory.islamic.advertised_unit_count ?? 0,
        generated_job_count: 0,
        purpose: 'Await approved religious content and resolve shell count conflict.',
      },
      {
        batch_id: 'paid-production',
        status: 'not_authorized',
        paid: true,
        entity_count: 0,
        generated_job_count: 0,
        purpose: 'Created only after manifests, reviews, exact pricing, budget ceiling, and explicit approval.',
      },
    ],
    entities,
  };
  plan.plan_sha256 = sha256Hex(plan);
  return plan;
}
