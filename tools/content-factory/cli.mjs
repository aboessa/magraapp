#!/usr/bin/env node
import { readFile as nodeReadFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { assertManifest } from './lib/contract.mjs';
import { inventoryCheck, scanInventory } from './lib/inventory.mjs';
import { buildCatalogPlan } from './lib/plan.mjs';

const USAGE = `Majarra content factory

Read-only commands (no state writes, credentials, or network):
  inventory [--root PATH] [--json] [--check]
  plan      [--root PATH] [--json] [--check] [--contingency PCT]

Backend state/execution commands:
  import-manifest --manifest FILE --api-base-url URL
  approve-spend --run-id ID --api-base-url URL --confirm-plan-hash SHA256
                --ceiling-credits NUMBER [--expires-at ISO]
  run --run-id ID --api-base-url URL --confirm-plan-hash SHA256 --allow-paid
      --idempotency-key KEY
  resume --run-id ID --api-base-url URL
  retry-failed --run-id ID --api-base-url URL [--job-id ID]
               [--allow-new-paid-attempt --allow-paid --accept-duplicate-charge-risk]

Backend commands read only CONTENT_FACTORY_ADMIN_TOKEN (or --token-env NAME).
Provider API keys are never read by this CLI.`;

const BOOLEAN_OPTIONS = new Set([
  'json',
  'check',
  'allow-paid',
  'allow-new-paid-attempt',
  'accept-duplicate-charge-risk',
  'help',
]);

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const positionals = [];
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (!value.startsWith('--')) {
      positionals.push(value);
      continue;
    }
    const withoutPrefix = value.slice(2);
    const equal = withoutPrefix.indexOf('=');
    const key = equal >= 0 ? withoutPrefix.slice(0, equal) : withoutPrefix;
    if (BOOLEAN_OPTIONS.has(key)) {
      if (equal >= 0) throw new Error(`Boolean option --${key} does not accept a value`);
      options[key] = true;
      continue;
    }
    const optionValue = equal >= 0 ? withoutPrefix.slice(equal + 1) : rest[++index];
    if (!optionValue || optionValue.startsWith('--')) throw new Error(`Option --${key} requires a value`);
    options[key] = optionValue;
  }
  return { command, options, positionals };
}

function assertAllowedOptions(options, allowed) {
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new Error(`Unknown option: --${key}`);
  }
}

function requireOption(options, key) {
  const value = options[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`--${key} is required`);
  return value;
}

function writeLine(stream, value = '') {
  stream.write(`${value}\n`);
}

function formatInventory(inventory) {
  const totals = inventory.totals;
  return [
    `Inventory ${inventory.inventory_sha256}`,
    `Series: ${totals.series_count}`,
    `Video episodes: ${totals.episode_count}`,
    `Stories/pages: ${totals.story_count}/${totals.story_page_count}`,
    `Top-level units: ${totals.top_level_unit_count}`,
    `Duration: ${totals.catalog_duration_seconds}s (video ${totals.video_duration_seconds}s + stories ${totals.story_duration_seconds}s)`,
    `AI-eligible: ${totals.ai_eligible_series_count} series, ${totals.ai_eligible_episode_count} video episodes, ${totals.ai_eligible_story_count} stories (${totals.ai_eligible_bundle_count} bundles)`,
    `Excluded live-action episodes: ${totals.excluded_episode_count}`,
    `Blockers: ${inventory.blockers.length}; warnings: ${inventory.warnings.length}`,
    'Paid requests sent: 0',
  ].join('\n');
}

function formatPlan(plan) {
  return [
    `Plan ${plan.plan_sha256}`,
    `Mode: ${plan.mode}`,
    `Dispatchable jobs: ${plan.dispatchable_job_count}`,
    `AI-eligible bundles blocked pending manifests/reviews: ${plan.readiness.blocked_bundle_count}`,
    `Priced subtotal: ${plan.budget.priced_subtotal_credits} credits`,
    `Provisional video + story image scenario: ${plan.budget.provisional_all_video_and_story_image_scenario_credits} credits`,
    `Provisional scenario with ${plan.budget.contingency_pct}% contingency: ${plan.budget.provisional_scenario_with_contingency_credits} credits`,
    `Approved ceiling: ${plan.approved_ceiling_credits ?? 'none'}`,
    `Unpriced: ${plan.budget.unpriced_components.join(', ')}`,
    'Paid requests sent: 0',
  ].join('\n');
}

function safeApiBaseUrl(value) {
  const parsed = new URL(value);
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    throw new Error('--api-base-url must use HTTPS (HTTP is allowed only for localhost)');
  }
  parsed.pathname = parsed.pathname.replace(/\/$/, '');
  return parsed;
}

function adminToken(options, env) {
  const name = options['token-env'] ?? 'CONTENT_FACTORY_ADMIN_TOKEN';
  const token = env[name];
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`${name} is required for backend execution commands`);
  }
  return token;
}

async function backendRequest({ fetchImpl, baseUrl, route, token, body, headers = {} }) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is unavailable');
  const response = await fetchImpl(new URL(`${baseUrl.pathname}${route}`, baseUrl), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text.slice(0, 1000) };
    }
  }
  if (!response.ok) {
    const error = new Error(payload?.error?.message ?? payload?.message ?? `Backend returned HTTP ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function readManifest(file, { root, readFile }) {
  const absolute = path.resolve(root, file);
  const manifest = JSON.parse(await readFile(absolute, 'utf8'));
  assertManifest(manifest);
  return manifest;
}

async function executeInventory(options, context) {
  assertAllowedOptions(options, new Set(['root', 'json', 'check']));
  const inventory = await scanInventory({
    root: path.resolve(options.root ?? context.root),
    readFile: context.readFile,
  });
  writeLine(context.stdout, options.json ? JSON.stringify(inventory, null, 2) : formatInventory(inventory));
  const check = inventoryCheck(inventory);
  return { exitCode: options.check && !check.ok ? 2 : 0, result: inventory };
}

async function executePlan(options, context) {
  assertAllowedOptions(options, new Set(['root', 'json', 'check', 'contingency']));
  const contingencyPct = options.contingency === undefined ? 15 : Number(options.contingency);
  const inventory = await scanInventory({
    root: path.resolve(options.root ?? context.root),
    readFile: context.readFile,
  });
  const plan = buildCatalogPlan(inventory, { contingencyPct });
  writeLine(context.stdout, options.json ? JSON.stringify(plan, null, 2) : formatPlan(plan));
  return { exitCode: options.check && plan.readiness.inventory_blocker_count > 0 ? 2 : 0, result: plan };
}

async function executeImportManifest(options, context) {
  assertAllowedOptions(options, new Set(['manifest', 'api-base-url', 'token-env', 'root']));
  const manifest = await readManifest(requireOption(options, 'manifest'), {
    root: path.resolve(options.root ?? context.root),
    readFile: context.readFile,
  });
  if (manifest.spend_approval !== null) {
    throw new Error('Embedded spend approval is forbidden; use approve-spend after import');
  }
  const baseUrl = safeApiBaseUrl(requireOption(options, 'api-base-url'));
  const token = adminToken(options, context.env);
  const payload = await backendRequest({
    fetchImpl: context.fetchImpl,
    baseUrl,
    route: '/admin/production/factory/plans',
    token,
    body: { manifest },
  });
  writeLine(context.stdout, JSON.stringify(payload, null, 2));
  return { exitCode: 0, result: payload };
}

async function executeApproveSpend(options, context) {
  assertAllowedOptions(options, new Set([
    'run-id', 'api-base-url', 'confirm-plan-hash', 'ceiling-credits',
    'expires-at', 'reason', 'token-env',
  ]));
  const runId = requireOption(options, 'run-id');
  const confirmedPlanHash = requireOption(options, 'confirm-plan-hash');
  if (!/^[a-f0-9]{64}$/.test(confirmedPlanHash)) throw new Error('--confirm-plan-hash must be lowercase SHA-256');
  const ceilingCredits = Number(requireOption(options, 'ceiling-credits'));
  if (!Number.isFinite(ceilingCredits) || ceilingCredits < 0) throw new Error('--ceiling-credits must be non-negative');
  const baseUrl = safeApiBaseUrl(requireOption(options, 'api-base-url'));
  const token = adminToken(options, context.env);
  const payload = await backendRequest({
    fetchImpl: context.fetchImpl,
    baseUrl,
    route: `/admin/production/factory/${encodeURIComponent(runId)}/approve-spend`,
    token,
    body: {
      confirmed_plan_sha256: confirmedPlanHash,
      ceiling_credits: ceilingCredits,
      expires_at: options['expires-at'] ?? null,
      ...(options.reason ? { reason: options.reason } : {}),
    },
  });
  writeLine(context.stdout, JSON.stringify(payload, null, 2));
  return { exitCode: 0, result: payload };
}

async function executeRun(options, context) {
  assertAllowedOptions(options, new Set([
    'run-id', 'api-base-url', 'confirm-plan-hash', 'allow-paid',
    'idempotency-key', 'token-env',
  ]));
  const runId = requireOption(options, 'run-id');
  const confirmedPlanHash = requireOption(options, 'confirm-plan-hash');
  if (!/^[a-f0-9]{64}$/.test(confirmedPlanHash)) throw new Error('--confirm-plan-hash must be lowercase SHA-256');
  if (options['allow-paid'] !== true) throw new Error('Paid dispatch requires --allow-paid');
  const idempotencyKey = requireOption(options, 'idempotency-key');
  if (idempotencyKey.length < 16 || idempotencyKey.length > 160) {
    throw new Error('--idempotency-key must contain 16-160 characters');
  }
  const baseUrl = safeApiBaseUrl(requireOption(options, 'api-base-url'));
  // Token access and network happen only after explicit paid intent and local input checks.
  const token = adminToken(options, context.env);
  const payload = await backendRequest({
    fetchImpl: context.fetchImpl,
    baseUrl,
    route: `/admin/production/factory/${encodeURIComponent(runId)}/dispatch`,
    token,
    headers: { 'Idempotency-Key': idempotencyKey },
    body: {
      confirmed_plan_sha256: confirmedPlanHash,
      allow_paid: true,
    },
  });
  writeLine(context.stdout, JSON.stringify(payload, null, 2));
  return { exitCode: 0, result: payload };
}

async function executeResume(options, context) {
  assertAllowedOptions(options, new Set(['run-id', 'api-base-url', 'token-env']));
  const runId = requireOption(options, 'run-id');
  const baseUrl = safeApiBaseUrl(requireOption(options, 'api-base-url'));
  const token = adminToken(options, context.env);
  const payload = await backendRequest({
    fetchImpl: context.fetchImpl,
    baseUrl,
    route: `/admin/production/factory/${encodeURIComponent(runId)}/resume`,
    token,
    body: { mode: 'resume_existing_attempts_only' },
  });
  writeLine(context.stdout, JSON.stringify(payload, null, 2));
  return { exitCode: 0, result: payload };
}

async function executeRetryFailed(options, context) {
  assertAllowedOptions(options, new Set([
    'run-id', 'job-id', 'api-base-url', 'token-env', 'allow-new-paid-attempt',
    'allow-paid', 'accept-duplicate-charge-risk',
  ]));
  const runId = requireOption(options, 'run-id');
  const allowNewPaidAttempt = options['allow-new-paid-attempt'] === true;
  if (allowNewPaidAttempt && options['allow-paid'] !== true) {
    throw new Error('--allow-new-paid-attempt also requires --allow-paid');
  }
  if (allowNewPaidAttempt && options['accept-duplicate-charge-risk'] !== true) {
    throw new Error('--allow-new-paid-attempt also requires --accept-duplicate-charge-risk');
  }
  const baseUrl = safeApiBaseUrl(requireOption(options, 'api-base-url'));
  const token = adminToken(options, context.env);
  const payload = await backendRequest({
    fetchImpl: context.fetchImpl,
    baseUrl,
    route: `/admin/production/factory/${encodeURIComponent(runId)}/retry-failed`,
    token,
    body: {
      ...(options['job-id'] ? { job_id: options['job-id'] } : {}),
      failed_only: true,
      allow_new_paid_attempt: allowNewPaidAttempt,
      allow_paid: options['allow-paid'] === true,
      accept_duplicate_charge_risk: options['accept-duplicate-charge-risk'] === true,
    },
  });
  writeLine(context.stdout, JSON.stringify(payload, null, 2));
  return { exitCode: 0, result: payload };
}

export async function executeCli(argv, {
  root = process.cwd(),
  readFile = nodeReadFile,
  env = process.env,
  fetchImpl = globalThis.fetch,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const { command, options, positionals } = parseArgs(argv);
  if (positionals.length > 0) throw new Error(`Unexpected positional arguments: ${positionals.join(' ')}`);
  if (!command || options.help || command === 'help') {
    writeLine(stdout, USAGE);
    return { exitCode: 0, result: null };
  }
  const context = { root, readFile, env, fetchImpl, stdout, stderr };
  switch (command) {
    case 'inventory': return executeInventory(options, context);
    case 'plan': return executePlan(options, context);
    case 'import-manifest': return executeImportManifest(options, context);
    case 'approve-spend': return executeApproveSpend(options, context);
    case 'run': return executeRun(options, context);
    case 'resume': return executeResume(options, context);
    case 'retry-failed': return executeRetryFailed(options, context);
    default: throw new Error(`Unknown command: ${command}\n\n${USAGE}`);
  }
}

const invokedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  executeCli(process.argv.slice(2)).then(({ exitCode }) => {
    process.exitCode = exitCode;
  }).catch((error) => {
    writeLine(process.stderr, `${error.name}: ${error.message}`);
    if (error.errors) writeLine(process.stderr, JSON.stringify(error.errors, null, 2));
    process.exitCode = 1;
  });
}
