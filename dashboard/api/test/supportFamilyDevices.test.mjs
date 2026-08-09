/// Tests for the live device read from FamilyState.
///
/// The gap this closes was recorded plainly in the previous audit: the admin devices
/// surface read a D1 projection only, so an operator on a support call could not tell
/// whether a parent's tablet was signed in *now*. `FamilyState` is the authority and
/// its `GET /devices` needs no parent session, so the read is possible; `POST
/// /devices/revoke` checks `activeSession` and therefore genuinely is not an admin
/// operation. This pins both halves — that the read exists, and that the write is not
/// claimed.
///
/// Source assertions rather than HTTP: exercising this needs a Durable Object, and
/// the suite runs on plain `node --test` with no Workers runtime. What is pinned is
/// the property that regressed and the properties that must not regress: the field
/// set, the failure mode, and the absence of an admin revoke path.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (file) => readFileSync(fileURLToPath(new URL(`../src/${file}`, import.meta.url)), 'utf8');
const stripComments = (source) => source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const routeSource = read('routes/adminAppExperience.ts');
const code = stripComments(routeSource);

const handler = (() => {
  const start = code.indexOf("route.get('/support/family/:id/devices'");
  assert.notEqual(start, -1, 'the live device endpoint does not exist');
  const end = code.indexOf('\nroute.', start + 1);
  return code.slice(start, end === -1 ? undefined : end);
})();

test('the live device read goes to FamilyState, not to the D1 projection', () => {
  assert.match(handler, /callDurable/);
  assert.match(handler, /familyStub\(c\.env, id\)/);
  assert.match(handler, /'\/devices'/);
  // Reading account_devices here would reintroduce the projection as the answer to a
  // present-tense question.
  assert.doesNotMatch(handler, /account_devices/);
});

test('an unreachable Durable Object is 503, not an empty device list', () => {
  // An empty list and an unreachable authority are different answers, and only one of
  // them means the parent can sign in.
  assert.match(handler, /!live\.ok \|\| !live\.data\?\.success/);
  assert.match(handler, /503/);
  assert.match(handler, /reachable: false/);
});

test('the device fingerprint is never returned', () => {
  // installation_id_hash identifies a device; an operator never needs it, and the
  // narrow field set of the family lookup exists for the same reason.
  assert.doesNotMatch(handler, /installation_id_hash/);
  for (const field of ['id', 'display_name', 'platform', 'status', 'registered_at', 'last_seen_at']) {
    assert.match(handler, new RegExp(`device\\.${field}`), `${field} is not returned`);
  }
});

test('the response states the authority and that revoke is unavailable', () => {
  assert.match(handler, /source: 'family_state'/);
  assert.match(handler, /revoke_available: false/);
});

test('the read is audited against its own entity type', () => {
  assert.match(handler, /'support_family_devices'/);
  assert.match(handler, /actorId\(c\)/);
});

test('no admin route claims to revoke a device through FamilyState', () => {
  // FamilyState.revokeDevice checks activeSession(sessionId), so an operator cannot
  // call it. Any admin route that appeared to would be a control that always fails —
  // the exact defect removed from ChildrenPage and DevicesAdminPage earlier.
  const familyState = stripComments(read('do/FamilyState.ts'));
  assert.match(familyState, /revokeDevice[\s\S]{0,400}activeSession\(sessionId\)/);

  const devicesRoute = stripComments(read('routes/adminFamilyProjection.ts'));
  assert.doesNotMatch(devicesRoute, /callDurable[\s\S]{0,200}devices\/revoke/);
});
