// Mark one completed PlayVeo asset as visually rejected and prepare a new attempt.
// The prior job remains in the attempts array with its review reason.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const STATE_PATH = path.join(import.meta.dirname, 'wave-production.jobs.json');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  const next = index >= 0 ? process.argv[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
}

const key = arg('only');
const reason = arg('reason');
const promptSuffix = arg('prompt-suffix');
if (!key || !reason || !promptSuffix) {
  throw new Error('Required: --only <exact-key> --reason <review-reason> --prompt-suffix <extra-prompt>');
}

const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
const matches = state.jobs.filter((job) => job.key === key);
if (matches.length !== 1) throw new Error(`Expected exactly one asset for ${key}; found ${matches.length}`);
const job = matches[0];
if (!job.job_id) throw new Error(`${key} has no completed attempt to archive`);

job.attempts ??= [];
job.attempts.push({
  job_id: job.job_id,
  status: 'rejected_visual',
  provider_status: job.status,
  provider_model: job.provider_model,
  credit_cost: job.credit_cost,
  submitted_at: job.submitted_at,
  completed_at: job.completed_at,
  review_reason: reason,
  result_count: job.result_count,
  source_checksum_sha256: job.source_checksum_sha256 ?? null,
  removed_checksum_sha256: job.removed_checksum_sha256 ?? null,
  target_checksum_sha256: job.target_checksum_sha256 ?? null,
});

job.prompt = `${job.prompt} REGENERATION CORRECTION: ${promptSuffix}`.replace(/\s+/g, ' ').trim();
job.prompt_sha256 = crypto.createHash('sha256').update(job.prompt).digest('hex');
job.job_id = null;
job.status = 'planned';
job.provider_model = null;
job.credit_cost = null;
job.submitted_at = null;
job.completed_at = null;
job.last_polled_at = null;
job.error = null;
job.result_count = 0;
job.downloaded = false;
job.downloaded_at = null;
job.download_error = null;
job.source_bytes = null;
job.source_checksum_sha256 = null;
job.background_removed = false;
job.background_removal_status = 'planned';
job.background_removal_started_at = null;
job.background_removal_completed_at = null;
job.background_removal_error = null;
job.removed_bytes = null;
job.removed_checksum_sha256 = null;
job.optimized = false;
job.optimized_at = null;
job.target_bytes = null;
job.target_checksum_sha256 = null;
job.quality_status = 'PENDING';
job.quality_failures = [];
job.quality_warnings = [];
job.visual_rejection_reason = reason;

state.updated_at = new Date().toISOString();
const temporary = `${STATE_PATH}.tmp`;
fs.writeFileSync(temporary, JSON.stringify(state, null, 2) + '\n');
fs.renameSync(temporary, STATE_PATH);
console.log(`Prepared visually rejected asset for regeneration: ${key}`);
