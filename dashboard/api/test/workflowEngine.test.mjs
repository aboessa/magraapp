/// Tests for the workflow engine.
///
/// The behaviour being pinned is the one the audit found missing: a status string
/// must not be able to bypass a required gate, and a stage must be decidable only by
/// someone the template says may decide it.
///
/// Also pinned: parallel stages. The old model had a single `current_step` cursor,
/// which cannot express "translation approved, illustration in progress, narration
/// blocked on illustration" — and a tool that misdescribes people's work is a tool
/// they stop using.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  actionableStages,
  applyDecision,
  dueAt,
  overdueStages,
  runStatusFor,
  transitionRefusal,
  unmetDependencies,
  workflowPublishBlockers,
} from '../src/lib/workflowEngine.ts';
import { evaluatePublishGate } from '../src/lib/publishGate.ts';

const stage = (key, overrides = {}) => ({
  stage_key: key,
  name_ar: key,
  sort_order: 1,
  required_role: null,
  required_permission: null,
  sla_hours: null,
  escalate_after_hours: null,
  blocks_publish: true,
  depends_on: [],
  instructions_ar: null,
  ...overrides,
});

const runStage = (key, overrides = {}) => ({
  stage_key: key,
  status: 'pending',
  assignee_id: null,
  assignee_team_id: null,
  due_at: null,
  started_at: null,
  completed_at: null,
  decided_by: null,
  decision_comment: null,
  skip_reason: null,
  ...overrides,
});

const actor = (overrides = {}) => ({
  id: 'user-1', permissions: ['approve', 'review'], roles: [], teams: [], ...overrides,
});

/// The episode template's shape, as migration 0030 seeds it.
const episodeStages = [
  stage('editorial', { sort_order: 1, required_permission: 'edit_text', sla_hours: 72 }),
  stage('educational_review', { sort_order: 2, required_permission: 'review', depends_on: ['editorial'], sla_hours: 48 }),
  stage('language_review', { sort_order: 3, required_permission: 'review', depends_on: ['educational_review'], sla_hours: 48 }),
  stage('translation', { sort_order: 4, required_permission: 'edit_text', depends_on: ['language_review'], blocks_publish: false }),
  stage('media_production', { sort_order: 5, required_permission: 'upload_images', depends_on: ['language_review'] }),
  stage('qa', { sort_order: 6, required_permission: 'review', depends_on: ['media_production'] }),
  stage('publisher', { sort_order: 7, required_permission: 'publish', depends_on: ['qa'] }),
];

test('only stages whose dependencies are settled are actionable', () => {
  const runStages = episodeStages.map((entry) => runStage(entry.stage_key));
  const actionable = actionableStages(episodeStages, runStages).map((entry) => entry.stage.stage_key);
  assert.deepEqual(actionable, ['editorial']);
});

test('two independent stages are actionable at once', () => {
  // Translation and media production both depend only on the language review. A
  // single-cursor model cannot express this, which is why the cursor was replaced.
  const runStages = episodeStages.map((entry) => runStage(entry.stage_key, {
    status: ['editorial', 'educational_review', 'language_review'].includes(entry.stage_key) ? 'approved' : 'pending',
  }));
  const actionable = actionableStages(episodeStages, runStages).map((entry) => entry.stage.stage_key);
  assert.deepEqual(actionable, ['translation', 'media_production']);
});

test('a skipped dependency unblocks its dependents, an unstarted one does not', () => {
  const skipped = episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'editorial' ? 'skipped' : 'pending',
  }));
  assert.deepEqual(unmetDependencies(episodeStages[1], skipped), []);

  const pending = episodeStages.map((entry) => runStage(entry.stage_key));
  assert.deepEqual(unmetDependencies(episodeStages[1], pending), ['editorial']);
});

test('a stage refuses an actor without its required permission', () => {
  // Dependencies satisfied first, so the refusal under test is the permission one
  // and not the dependency one — the engine checks dependencies before authority,
  // because a stage nobody can start yet is not an authorisation question.
  const runStages = episodeStages.map((entry) => runStage(entry.stage_key, {
    status: ['editorial', 'educational_review', 'language_review'].includes(entry.stage_key)
      ? 'approved'
      : 'in_progress',
  }));
  const refusal = transitionRefusal(episodeStages[4], runStages, actor(), 'approved');
  assert.ok(refusal);
  assert.match(refusal, /upload_images/);

  assert.equal(
    transitionRefusal(episodeStages[4], runStages, actor({ permissions: ['upload_images'] }), 'approved'),
    null,
  );
});

test('a stage refuses an actor without its required role even when the permission is held', () => {
  const roleStage = stage('sharia_review', { required_permission: 'review', required_role: 'reviewer' });
  const runStages = [runStage('sharia_review', { status: 'in_progress' })];
  const refusal = transitionRefusal(roleStage, runStages, actor({ permissions: ['review'] }), 'approved');
  assert.match(refusal, /reviewer/);
  assert.equal(
    transitionRefusal(roleStage, runStages, actor({ permissions: ['review'], roles: ['reviewer'] }), 'approved'),
    null,
  );
});

test('a blocked stage cannot be decided, whatever the actor holds', () => {
  const runStages = episodeStages.map((entry) => runStage(entry.stage_key));
  const refusal = transitionRefusal(
    episodeStages[6], runStages, actor({ permissions: ['publish', 'review', 'manage_permissions'] }), 'approved',
  );
  assert.match(refusal, /معلَّقة على مراحل غير مكتملة/);
});

test('skipping a required stage needs process authority, not stage authority', () => {
  // Otherwise "skip" is a way to approve without being allowed to approve.
  const runStages = [runStage('editorial', { status: 'in_progress' })];
  const stages = [episodeStages[0]];
  const refusal = transitionRefusal(stages[0], runStages, actor({ permissions: ['edit_text'] }), 'skipped');
  assert.match(refusal, /إدارة الصلاحيات/);
  assert.equal(
    transitionRefusal(stages[0], runStages, actor({ permissions: ['edit_text', 'manage_permissions'] }), 'skipped'),
    null,
  );
});

test('a settled stage is not re-decidable', () => {
  const runStages = [runStage('editorial', { status: 'approved' })];
  const refusal = transitionRefusal(episodeStages[0], runStages, actor({ permissions: ['edit_text'] }), 'approved');
  assert.match(refusal, /محسومة/);
});

test('requesting changes returns started dependents to pending and keeps earlier approvals', () => {
  const runStages = [
    runStage('editorial', { status: 'approved' }),
    runStage('educational_review', { status: 'approved' }),
    runStage('language_review', { status: 'in_progress' }),
    runStage('translation', { status: 'in_progress' }),
    runStage('media_production', { status: 'in_progress' }),
  ];
  const updates = applyDecision(episodeStages, runStages, 'language_review', 'changes_requested', 'user-1', '2026-08-09T10:00:00.000Z');
  const byKey = new Map(updates.map((update) => [update.stage_key, update.status]));
  assert.equal(byKey.get('language_review'), 'changes_requested');
  assert.equal(byKey.get('translation'), 'pending');
  assert.equal(byKey.get('media_production'), 'pending');
  // The two approvals that already happened are untouched: those reviewers did
  // review what they saw, and discarding it would cost the whole chain again.
  assert.equal(byKey.has('editorial'), false);
  assert.equal(byKey.has('educational_review'), false);
});

test('a run is approved only when every blocking stage is settled', () => {
  const almost = episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'publisher' ? 'pending' : 'approved',
  }));
  assert.equal(runStatusFor(episodeStages, almost), 'running');

  // Translation does not block, so a run can be approved with it still pending.
  const done = episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'translation' ? 'pending' : 'approved',
  }));
  assert.equal(runStatusFor(episodeStages, done), 'approved');

  const rejected = episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'qa' ? 'rejected' : 'approved',
  }));
  assert.equal(runStatusFor(episodeStages, rejected), 'rejected');
});

test('due dates come from the SLA, and overdue and escalated are distinguished', () => {
  const from = '2026-08-09T00:00:00.000Z';
  assert.equal(dueAt(stage('x', { sla_hours: 48 }), from), '2026-08-11T00:00:00.000Z');
  // No SLA is not an infinite SLA: "no target" must stay reportable as such.
  assert.equal(dueAt(stage('x'), from), null);

  const stages = [stage('qa', { sla_hours: 48, escalate_after_hours: 24 })];
  const runStages = [runStage('qa', { status: 'in_progress', due_at: '2026-08-09T00:00:00.000Z' })];

  const late = overdueStages(stages, runStages, '2026-08-09T12:00:00.000Z');
  assert.equal(late.length, 1);
  assert.equal(late[0].hours_late, 12);
  assert.equal(late[0].escalated, false);

  const escalated = overdueStages(stages, runStages, '2026-08-10T06:00:00.000Z');
  assert.equal(escalated[0].escalated, true);

  // An approved stage is never overdue, even long past its due date.
  assert.deepEqual(overdueStages(stages, [runStage('qa', { status: 'approved', due_at: '2026-01-01T00:00:00.000Z' })], '2026-08-09T00:00:00.000Z'), []);
});

// --- Publish gate integration ---------------------------------------------

const gateFacts = (workflow) => ({
  entity_type: 'episode',
  entity_id: 'episode-1',
  status: 'ready',
  is_test_fixture: false,
  reviews: [{ role: 'edu', status: 'approved' }, { role: 'lang', status: 'approved' }, { role: 'qa', status: 'approved' }],
  reviews_supported: true,
  rights: [{ owner: 'Majarra', territories: ['SA'], licenses: ['vod'], expiry: null }],
  rights_supported: true,
  assets: [],
  today: '2026-08-09',
  workflow,
  series_id: 'series-1',
  series_status: 'published',
  planet_id: 'qisas',
  source_type: null,
  religious_approved_at: null,
  video_master_url: 'https://media/ep.mp4',
  video_hls_1080: null,
  thumbnail_url: 'https://thumbs/ep.webp',
  duration_seconds: 400,
  captions_ar_url: 'https://media/ep.vtt',
  dubs: ['ar'],
  learning_objective_id: 'objective-1',
});

test('an unapproved blocking stage blocks publication', () => {
  const blockers = workflowPublishBlockers(episodeStages, episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'qa' ? 'in_progress' : 'approved',
  })));
  assert.deepEqual(blockers.map((blocker) => blocker.stage_key), ['qa']);

  const result = evaluatePublishGate(gateFacts({
    run_id: 'run-1', blockers, total_blocking_stages: 6,
  }));
  const finding = result.findings.find((entry) => entry.id === 'workflow');
  assert.equal(finding.severity, 'blocker');
  assert.equal(finding.owner, 'reviewer');
  assert.match(finding.items[0], /qa/);
  assert.equal(result.publishable, false);
  // This is the property the audit called out: a status string alone must not pass.
  assert.match(finding.required_action, /لا يُنشر المحتوى بتغيير حالته فقط/);
});

test('a non-blocking stage left pending does not block publication', () => {
  const blockers = workflowPublishBlockers(episodeStages, episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'translation' ? 'pending' : 'approved',
  })));
  assert.deepEqual(blockers, []);
  const result = evaluatePublishGate(gateFacts({ run_id: 'run-1', blockers, total_blocking_stages: 6 }));
  assert.equal(result.findings.find((entry) => entry.id === 'workflow').status, 'pass');
  assert.equal(result.publishable, true);
});

test('content with no workflow run warns instead of blocking', () => {
  // Demanding a run would mark the whole pre-existing library unpublishable, and the
  // first workaround anyone found would be to bypass the gate.
  const result = evaluatePublishGate(gateFacts(null));
  const finding = result.findings.find((entry) => entry.id === 'workflow');
  assert.equal(finding.severity, 'warning');
  assert.equal(result.publishable, true);
});

test('a rejected stage is reported as overruling a reviewer, not as incomplete', () => {
  const blockers = workflowPublishBlockers(episodeStages, episodeStages.map((entry) => runStage(entry.stage_key, {
    status: entry.stage_key === 'qa' ? 'rejected' : 'approved',
  })));
  assert.match(blockers[0].detail, /مرفوضة/);
});

// --- Wiring ----------------------------------------------------------------

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));
const read = (file) => readFileSync(routesDir + file, 'utf8');
const stripComments = (source) => source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('the decision endpoint enforces the stage requirement and separation of duties', () => {
  const code = stripComments(read('adminWorkflow.ts'));
  const start = code.indexOf("route.post('/workflows/runs/:id/stages/:key/decision'");
  assert.notEqual(start, -1);
  const handler = code.slice(start, code.indexOf('\nroute.', start + 1));
  assert.match(handler, /transitionRefusal\(/, 'the stage requirement is not enforced');
  assert.match(handler, /403/);
  assert.match(handler, /checkSelfApproval\(/, 'creator/approver separation is not applied');
  assert.match(handler, /auditStatement\(/, 'the decision is not audited');
  // The refusal must precede any write.
  assert.ok(handler.includes('DB.batch('), 'the handler does not write in a batch');
  assert.ok(handler.indexOf('transitionRefusal') < handler.indexOf('DB.batch('), 'the guard runs after the write');
});

test('starting a run refuses a template with no stages', () => {
  const code = stripComments(read('adminWorkflow.ts'));
  assert.match(code, /has no stages[\s\S]{0,80}409/);
});

test('the publish gate reads the workflow through the same loader the screen uses', () => {
  const gate = stripComments(read('adminPublishGate.ts'));
  assert.match(gate, /workflowFor\(/);
  assert.match(gate, /workflowPublishBlockers\(/);
  // Every publishable type must gather it, or one of them silently skips the gate.
  const occurrences = (gate.match(/loadWorkflowFacts\(env, '/g) ?? []).length;
  assert.equal(occurrences, 6, `expected six types to gather workflow facts, found ${occurrences}`);
});

test('the seeded templates match the approved stage lists', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0030_workflow_engine.sql', import.meta.url)), 'utf8',
  );
  for (const key of ['editorial', 'educational_review', 'language_review', 'translation', 'media_production', 'qa', 'publisher']) {
    assert.match(migration, new RegExp(`'${key}'`), `episode stage ${key} missing`);
  }
  for (const key of ['writer', 'editor', 'illustration', 'narration']) {
    assert.match(migration, new RegExp(`'${key}'`), `story stage ${key} missing`);
  }
  for (const key of ['structure', 'source_verification', 'sharia_review', 'media_review']) {
    assert.match(migration, new RegExp(`'${key}'`), `islamic stage ${key} missing`);
  }
  // Translation must not block; every Islamic stage must.
  assert.match(migration, /'translation', 'الترجمة', 4, 'translator', 'edit_text', 120, 72, 0/);
  assert.doesNotMatch(migration, /'sharia_review'[^\n]*, 0, '/);
});
