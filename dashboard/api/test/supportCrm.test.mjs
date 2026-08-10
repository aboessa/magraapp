/// Tests for the Support CRM.
///
/// The behaviour being pinned is the pair of properties that make the difference
/// between a CRM and a list of rows: the two SLA clocks are measured correctly, and no
/// control claims to do something the platform cannot do.
///
/// The second half matters as much as the first. This dashboard has already shipped
/// controls that always failed — a child-profile form against a read-only server, a
/// device revoke against a session-guarded Durable Object — and the fix each time was
/// to remove the control and say why. `SUPPORTED_ACTIONS` and `UNAVAILABLE_ACTIONS`
/// encode that decision as data, and these tests keep it honest.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  resolveSlaPolicy,
  slaDueDates,
  slaState,
  stampsFirstResponse,
  SUPPORTED_ACTIONS,
  ticketCreateInput,
  ticketReference,
  transitionError,
  UNAVAILABLE_ACTIONS,
  TICKET_ACTIONS,
} from '../src/lib/supportCrm.ts';

const POLICIES = [
  { category: 'any', priority: 'urgent', first_response_minutes: 30, resolution_minutes: 240 },
  { category: 'any', priority: 'normal', first_response_minutes: 480, resolution_minutes: 4320 },
  { category: 'billing', priority: 'normal', first_response_minutes: 240, resolution_minutes: 1440 },
];

// --- SLA resolution --------------------------------------------------------

test('the most specific SLA policy wins, and absence is not a default', () => {
  assert.equal(resolveSlaPolicy(POLICIES, 'billing', 'normal').resolution_minutes, 1440);
  assert.equal(resolveSlaPolicy(POLICIES, 'playback', 'normal').resolution_minutes, 4320);
  // No matching policy means no target, not an invented one: a due date nobody
  // committed to is worse than an empty column.
  assert.equal(resolveSlaPolicy(POLICIES, 'playback', 'low'), null);
  assert.deepEqual(slaDueDates(null, '2026-08-09T00:00:00.000Z'), {
    first_response_due_at: null, resolution_due_at: null,
  });
});

test('due dates are derived from the policy minutes', () => {
  const due = slaDueDates(resolveSlaPolicy(POLICIES, 'any', 'urgent'), '2026-08-09T00:00:00.000Z');
  assert.equal(due.first_response_due_at, '2026-08-09T00:30:00.000Z');
  assert.equal(due.resolution_due_at, '2026-08-09T04:00:00.000Z');
});

// --- The two clocks --------------------------------------------------------

const ticket = (overrides = {}) => ({
  status: 'open',
  first_response_due_at: '2026-08-09T01:00:00.000Z',
  resolution_due_at: '2026-08-09T08:00:00.000Z',
  first_response_at: null,
  resolved_at: null,
  ...overrides,
});

test('a late first reply is a breach even when the ticket is resolved on time', () => {
  // This is the case a single resolution SLA cannot see, and it is the more common
  // complaint: nobody answered for two days, then it was fixed quickly.
  const state = slaState(ticket({
    status: 'resolved',
    first_response_at: '2026-08-09T03:00:00.000Z',
    resolved_at: '2026-08-09T04:00:00.000Z',
  }), '2026-08-20T00:00:00.000Z');
  assert.equal(state.first_response_breached, true);
  assert.equal(state.resolution_breached, false);
});

test('a settled ticket is judged at resolution time, not at now', () => {
  // Otherwise every historical ticket drifts into breach forever and the breach count
  // becomes a function of how long ago it happened.
  const state = slaState(ticket({
    status: 'closed',
    first_response_at: '2026-08-09T00:30:00.000Z',
    resolved_at: '2026-08-09T07:00:00.000Z',
  }), '2027-01-01T00:00:00.000Z');
  assert.equal(state.resolution_breached, false);
  assert.match(state.reason, /وقت الحلّ/);
});

test('waiting on the customer pauses the resolution clock', () => {
  const state = slaState(ticket({ status: 'waiting_customer', first_response_at: '2026-08-09T00:10:00.000Z' }), '2026-08-15T00:00:00.000Z');
  assert.equal(state.paused, true);
  assert.equal(state.resolution_breached, false);
  assert.equal(state.first_response_breached, false);
});

test('an unanswered live ticket past both due times breaches both', () => {
  const state = slaState(ticket(), '2026-08-09T10:00:00.000Z');
  assert.equal(state.first_response_breached, true);
  assert.equal(state.resolution_breached, true);
  assert.equal(state.resolution_minutes_late, 120);
});

test('a ticket with no policy has no target and no breach', () => {
  const state = slaState(ticket({ first_response_due_at: null, resolution_due_at: null }), '2027-01-01T00:00:00.000Z');
  assert.equal(state.first_response_breached, false);
  assert.equal(state.resolution_breached, false);
  assert.match(state.reason, /لا سياسة SLA/);
});

// --- Transitions -----------------------------------------------------------

test('a closed ticket is terminal and says what to do instead', () => {
  const error = transitionError('closed', 'open');
  assert.ok(error);
  assert.match(error, /تذكرة جديدة/);
  // Resolved is a claim and claims turn out wrong, so it stays reopenable.
  assert.equal(transitionError('resolved', 'in_progress'), null);
  assert.equal(transitionError('open', 'open'), null);
});

test('the first response is stamped once, when the ticket leaves open', () => {
  assert.equal(stampsFirstResponse('open', 'in_progress', null), true);
  assert.equal(stampsFirstResponse('open', 'in_progress', '2026-08-09T00:00:00.000Z'), false);
  // Closing an untouched ticket is not a response to anybody.
  assert.equal(stampsFirstResponse('open', 'closed', null), false);
  assert.equal(stampsFirstResponse('in_progress', 'resolved', null), false);
});

// --- Input validation ------------------------------------------------------

test('tags are lower-cased and de-duplicated', () => {
  // "Refund" and "refund" as two tags makes every tag filter quietly wrong.
  const result = ticketCreateInput({ subject: 'x', category: 'billing', tags: ['Refund', 'refund', ' VAT '] });
  assert.ok('input' in result);
  assert.deepEqual(result.input.tags, ['refund', 'vat']);
  assert.equal(result.input.priority, 'normal');
});

test('a ticket without a subject or with an unknown category is refused', () => {
  assert.ok('error' in ticketCreateInput({ category: 'billing' }));
  assert.ok('error' in ticketCreateInput({ subject: 'x', category: 'nonsense' }));
  assert.ok('error' in ticketCreateInput({ subject: 'x', category: 'billing', priority: 'burning' }));
  assert.ok('error' in ticketCreateInput({ subject: 'x', category: 'billing', tags: 'refund' }));
});

test('references are readable and sortable', () => {
  assert.equal(ticketReference(1), 'MJ-000001');
  assert.equal(ticketReference(481), 'MJ-000481');
  assert.ok(ticketReference(9) < ticketReference(10), 'references must sort lexicographically');
});

// --- Honesty about actions -------------------------------------------------

test('every unsupported action carries its own specific reason', () => {
  for (const action of TICKET_ACTIONS) {
    if (SUPPORTED_ACTIONS.includes(action)) continue;
    const reason = UNAVAILABLE_ACTIONS[action];
    assert.ok(reason, `${action} has no reason`);
    // A generic sentence would tell an operator nothing about where to go instead.
    assert.ok(reason.length > 40, `${action} reason is too vague`);
  }
});

test('device revoke is listed as unavailable, matching the Durable Object', () => {
  assert.equal(SUPPORTED_ACTIONS.includes('device_revoke'), false);
  assert.match(UNAVAILABLE_ACTIONS.device_revoke, /جلسة والٍ/);
  const familyState = readFileSync(fileURLToPath(new URL('../src/do/FamilyState.ts', import.meta.url)), 'utf8');
  assert.match(familyState, /revokeDevice[\s\S]{0,400}activeSession\(sessionId\)/);
});

// --- Wiring ----------------------------------------------------------------

const source = readFileSync(fileURLToPath(new URL('../src/routes/adminSupport.ts', import.meta.url)), 'utf8');
const code = source.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const handler = (path, method = "post") => {
  const start = code.indexOf(`route.${method}('${path}'`);
  assert.notEqual(start, -1, `${method.toUpperCase()} ${path} does not exist`);
  const end = code.indexOf('\nroute.', start + 1);
  return code.slice(start, end === -1 ? undefined : end);
};

test('an unsupported action is refused with 501 and its reason, not recorded', () => {
  const actions = handler('/support/tickets/:id/actions');
  assert.match(actions, /SUPPORTED_ACTIONS\.includes\(action\)/);
  assert.match(actions, /501/);
  assert.match(actions, /UNAVAILABLE_ACTIONS/);
  // The refusal must come before any insert, or an impossible action leaves a
  // timeline entry claiming it happened.
  assert.ok(actions.indexOf('501') < actions.indexOf('INSERT INTO support_ticket_events'), 'the refusal is after the write');
  // Any operational action needs a reason and an audit row.
  assert.match(actions, /reason is required/);
  assert.match(actions, /auditStatement\(/);
});

test('an internal note never counts as a first response', () => {
  const notes = handler('/support/tickets/:id/notes');
  assert.doesNotMatch(notes, /first_response_at = \?/);
  const firstResponse = handler('/support/tickets/:id/first-response');
  // Recording a reply is explicit and single-use: overwriting it would erase the only
  // evidence of a late answer.
  assert.match(firstResponse, /channel is required/);
  assert.match(firstResponse, /already recorded and cannot be overwritten/);
  assert.match(firstResponse, /409/);
});

test('raising priority moves the deadlines with it', () => {
  const patch = handler('/support/tickets/:id', 'patch');
  assert.match(patch, /priority_change/);
  assert.match(patch, /slaDueDates\(resolveSlaPolicy/);
  assert.match(patch, /first_response_due_at = \?/);
});

test('escalation raises the priority and re-derives the clock', () => {
  const escalate = handler('/support/tickets/:id/escalate');
  assert.match(escalate, /reason is required/);
  assert.match(escalate, /slaDueDates\(/);
  assert.match(escalate, /escalated_at = datetime\('now'\)/);
  assert.match(escalate, /closed ticket cannot be escalated/);
});

test('overdue filtering happens in SQL so the count and the list agree', () => {
  const list = handler('/support/tickets', 'get');
  // The predicate is shared with the breach counters through SQL_DEADLINE_PASSED, so the
  // filter and the badge cannot drift apart in shape either.
  assert.match(list, /SQL_DEADLINE_PASSED\('t\.resolution_due_at'\)/);
  assert.match(list, /waiting_customer/);
  assert.match(list, /COUNT\(\*\) AS total/);
  // The raw text comparison must not come back: it was wrong inside one UTC day.
  assert.doesNotMatch(list, /resolution_due_at < datetime\('now'\)/);
});

test('a deadline that passed an hour ago compares as passed, not as future', () => {
  // The defect this pins: deadlines are stored as `2026-08-11T02:09:03.591Z` and
  // `datetime('now')` yields `2026-08-10 14:09:03`. Compared as text, 'T' (0x54) sorts
  // above ' ' (0x20), so within one UTC day every same-day breach read as still in the
  // future — invisible to the SQL filter and the badge while the JavaScript judgement per
  // row reported it correctly. Asserted as string algebra because that is what SQLite
  // does with these two values.
  const stored = '2026-08-11T02:09:03.591Z';
  const sqliteNow = '2026-08-11 03:00:00';
  assert.equal(stored < sqliteNow, false, 'the raw comparison is the defect');

  const normalise = (value) => value.slice(0, 19).replace('T', ' ');
  assert.equal(normalise(stored) < sqliteNow, true, 'the normalised comparison is correct');
  // And a deadline still in the future stays in the future: a fix that reports everything
  // as overdue would pass the first assertion alone.
  assert.equal(normalise('2026-08-11T04:00:00.000Z') < sqliteNow, false);
});

test('the breach counters use the same predicate as the overdue filter', () => {
  const sla = handler('/support/sla', 'get');
  assert.match(sla, /SQL_DEADLINE_PASSED\('first_response_due_at'\)/);
  assert.match(sla, /SQL_DEADLINE_PASSED\('resolution_due_at'\)/);
  assert.doesNotMatch(sla, /due_at < datetime\('now'\)/);
});

test('the transition table is served, so a board cannot hold a second copy of the workflow', async () => {
  // A kanban board must know the legal targets before a drag starts. If it kept its own
  // table, that table would be a second definition of the workflow and would drift from
  // transitionError() the first time a status was added.
  const { allowedTransitions, transitionError } = await import('../src/lib/supportCrm.ts');
  const table = allowedTransitions();

  assert.deepEqual(table.closed, [], 'closed is terminal');
  assert.ok(table.resolved.includes('in_progress'), 'resolved may be reopened: it is a claim');

  // The served table and the enforcer must agree in both directions, for every pair.
  for (const [from, targets] of Object.entries(table)) {
    for (const to of Object.keys(table)) {
      const allowedByTable = targets.includes(to) || from === to;
      const allowedByCheck = transitionError(from, to) === null;
      assert.equal(allowedByTable, allowedByCheck, `${from} -> ${to}`);
    }
  }

  assert.match(handler('/support/sla', 'get'), /transitions: allowedTransitions\(\)/);
});

test('the served transition table cannot be mutated by its caller', async () => {
  const { allowedTransitions } = await import('../src/lib/supportCrm.ts');
  allowedTransitions().closed.push('open');
  assert.deepEqual(allowedTransitions().closed, [], 'a copy is returned, not the rules');
});

test('reads need only requireAdmin while writes need a permission', () => {
  assert.match(code, /route\.get\('\/support\/tickets', requireAdmin/);
  assert.match(code, /route\.post\('\/support\/tickets', requirePermission\('assign_members'\)/);
  assert.match(code, /route\.post\('\/support\/tickets\/:id\/actions', requirePermission\('manage_permissions'\)/);
});

test('no table or route pretends to message a customer', () => {
  const migration = readFileSync(fileURLToPath(new URL('../migrations/0031_support_crm.sql', import.meta.url)), 'utf8');
  assert.doesNotMatch(migration, /CREATE TABLE[^\n]*support_messages/);
  assert.match(migration, /is_internal/);
  assert.doesNotMatch(code, /sendEmail\(/);
});
