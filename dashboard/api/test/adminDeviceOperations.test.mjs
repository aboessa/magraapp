/// Tests for the operator device path and the Customer 360 composition.
///
/// Two properties, and both are about boundaries rather than features.
///
/// **The operator path must not become a parent path.** `FamilyState.revokeDevice`
/// requires `activeSession`, correctly: a parent revoking a device must prove they are
/// that parent. The admin commands added alongside it take an operator id and a reason
/// instead — and the failure mode to guard against is not "it does not work", it is
/// "someone later makes it mint a session, or reuses the parent handler, or writes D1
/// directly". Each of those is asserted against.
///
/// **Customer 360 must not become a child-surveillance screen.** The support lookup was
/// deliberately narrowed once already (no install hashes, no purchase hashes, no
/// `auth_epoch` to the client). This asserts the same discipline on the wider workspace:
/// no purchase tokens, no watch history, progress as a count only.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (path) => readFileSync(fileURLToPath(new URL(`../src/${path}`, import.meta.url)), 'utf8');
const strip = (source) => source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const familyState = strip(read('do/FamilyState.ts'));
const devicesRoute = strip(read('routes/adminDevices.ts'));
const customerRoute = strip(read('routes/adminCustomer.ts'));

const handler = (source, name) => {
  // Accepts both `private async x(` and `private x(`: `operatorFrom` is synchronous, and
  // an async-only matcher silently found nothing and asserted against an empty string.
  const start = source.search(new RegExp(`private (?:async )?${name}\\(`));
  assert.notEqual(start, -1, `${name} does not exist`);
  const end = source.indexOf('\n  private ', start + 1);
  return source.slice(start, end === -1 ? undefined : end);
};

// --- The operator path -----------------------------------------------------

test('the operator commands are registered under their own prefix', () => {
  // The prefix is the point: the two authorisation stories are visible in the route
  // table rather than buried in the handlers.
  for (const path of ['POST /admin/devices/revoke', 'POST /admin/downloads/revoke', 'POST /admin/resync', 'GET /admin/inspect']) {
    assert.match(familyState, new RegExp(`'${path.replace(/\//g, '\\/')}'`), `${path} is not registered`);
  }
});

test('the parent revoke path still proves a parent session', () => {
  // The new path must not have loosened the old one.
  assert.match(handler(familyState, 'revokeDevice'), /activeSession\(sessionId\)/);
});

test('every operator command requires an actor and a reason', () => {
  for (const name of ['adminRevokeDevice', 'adminRevokeDownloads', 'adminResync']) {
    const body = handler(familyState, name);
    assert.match(body, /operatorFrom\(body\)/, `${name} does not read the operator`);
    assert.match(body, /actor_id and reason are required/, `${name} does not require both`);
  }
  const operator = handler(familyState, 'operatorFrom');
  assert.match(operator, /actor_id/);
  assert.match(operator, /reason/);
});

test('no operator command mints or resolves a parent session', () => {
  // An operator may act *on* a family, never *as* one.
  for (const name of ['adminRevokeDevice', 'adminRevokeDownloads', 'adminResync', 'adminInspect']) {
    const body = handler(familyState, name);
    assert.doesNotMatch(body, /createSession|resolveSession|activeSession/, `${name} touches sessions`);
    assert.doesNotMatch(body, /INSERT INTO auth_sessions/, `${name} writes a session`);
  }
});

test('operator revocation performs the same state transition as the parent path', () => {
  // A second, weaker notion of "revoked" would be worse than no feature: the device
  // would appear revoked while keeping a valid session until expiry.
  const body = handler(familyState, 'adminRevokeDevice');
  assert.match(body, /auth_epoch = auth_epoch \+ 1/);
  assert.match(body, /UPDATE auth_sessions SET status = 'revoked'/);
  assert.match(body, /UPDATE playback_leases SET status = 'revoked'/);
  // An already-revoked device is reported, not silently treated as a fresh success.
  assert.match(body, /already: true/);
});

test('operator actions are attributable in the event stream', () => {
  for (const name of ['adminRevokeDevice', 'adminRevokeDownloads', 'adminResync']) {
    const body = handler(familyState, name);
    assert.match(body, /by: 'operator'/, `${name} does not mark the actor kind`);
    assert.match(body, /operator_id: operator\.actorId/, `${name} does not carry the operator id`);
    assert.match(body, /reason: operator\.reason/, `${name} does not carry the reason`);
  }
});

test('resync emits a snapshot event instead of writing the projection', () => {
  const body = handler(familyState, 'adminResync');
  assert.match(body, /addOutbox\('family\.resynced'/);
  assert.doesNotMatch(body, /family_projection|child_projection/);
});

test('the inspect read is narrower than the app state read', () => {
  const body = handler(familyState, 'adminInspect');
  // Plan, entitlements, devices, leases, sessions — the things that explain why a family
  // cannot watch. Not nicknames, not favourites, not progress rows.
  for (const field of ['effective_plan', 'entitlements', 'devices', 'active_leases', 'active_sessions']) {
    assert.match(body, new RegExp(field), `${field} missing from inspect`);
  }
  assert.doesNotMatch(body, /nickname/);
  assert.doesNotMatch(body, /FROM favorites/);
  // Progress is a count only.
  assert.match(body, /COUNT\(\*\) AS total FROM content_progress/);
  assert.doesNotMatch(body, /SELECT child_id, content_type/);
});

// --- The admin router ------------------------------------------------------

test('the admin router audits before it acts', () => {
  // A command that fails mid-flight must still show it was attempted, and by whom.
  for (const marker of ['device_revoke_requested', 'downloads_revoke_requested']) {
    assert.match(devicesRoute, new RegExp(`'${marker}'`), `${marker} is not audited`);
    const requestedAt = devicesRoute.indexOf(marker);
    const calledAt = devicesRoute.indexOf('callDurable', requestedAt);
    assert.ok(requestedAt < calledAt, `${marker} is audited after the command`);
  }
});

test('every admin device write needs a reason and the account permission', () => {
  const writes = [...devicesRoute.matchAll(/route\.post\('([^']+)',\s*requirePermission\('([a-z_]+)'\)/g)];
  assert.equal(writes.length, 3, `expected three guarded writes, found ${writes.length}`);
  for (const [, path, permission] of writes) {
    assert.equal(permission, 'manage_permissions', `${path} is guarded by ${permission}`);
  }
  assert.match(devicesRoute, /reason is required for a device revocation/);
});

test('the admin router never writes device state to D1', () => {
  // D1's account_devices is a projection; writing it here would create a second truth
  // that disagrees the first time the queue is slow.
  assert.doesNotMatch(devicesRoute, /UPDATE account_devices|INSERT INTO account_devices|DELETE FROM account_devices/);
  // It reads the projection only to confirm the family exists, so a typo cannot create
  // an empty Durable Object and report success against it.
  assert.match(devicesRoute, /SELECT parent_id FROM family_projection/);
});

test('an unreachable authority is 503 and never an empty result', () => {
  assert.match(devicesRoute, /reachable: false/);
  assert.match(devicesRoute, /503/);
});

// --- Customer 360 ----------------------------------------------------------

test('customer 360 reads the authority for the present and D1 for history', () => {
  assert.match(customerRoute, /'\/admin\/inspect'/);
  assert.match(customerRoute, /FROM family_projection/);
  assert.match(customerRoute, /FROM child_projection/);
  assert.match(customerRoute, /FROM billing_audit/);
  assert.match(customerRoute, /FROM support_tickets/);
  assert.match(customerRoute, /FROM audit_logs/);
});

test('one failed section does not fail the whole workspace', () => {
  // A 503 for the entire page because the Durable Object blinked would make the screen
  // useless exactly when it is needed.
  assert.match(customerRoute, /available: false/);
  assert.match(customerRoute, /authority_available/);
  assert.doesNotMatch(customerRoute, /return c\.json\([\s\S]{0,200}503\)/);
});

test('customer 360 exposes no store credential and no watch history', () => {
  assert.doesNotMatch(customerRoute, /purchase_token_hash|raw_response_hash/);
  assert.doesNotMatch(customerRoute, /FROM watch_progress|content_progress/);
  // Progress is a count sourced from the authority, and its absence is stated rather
  // than reported as zero.
  assert.match(customerRoute, /progress_records/);
  assert.match(customerRoute, /progress_summary/);
});

test('reading a family is audited', () => {
  assert.match(customerRoute, /'customer_360'/);
  assert.match(customerRoute, /auditStatement\(/);
});

test('customer 360 queries no table that does not exist', () => {
  // An always-failing query hidden behind .catch() reports "no data" forever, which is
  // the same class of defect as an invented number.
  const tables = [...customerRoute.matchAll(/FROM ([a-z_]+)/g)].map((match) => match[1]);
  const known = new Set([
    'family_projection', 'child_projection', 'account_devices', 'billing_audit',
    'google_play_purchases', 'support_tickets', 'audit_logs',
  ]);
  for (const table of tables) {
    assert.ok(known.has(table), `unknown table in customer 360: ${table}`);
  }
});
