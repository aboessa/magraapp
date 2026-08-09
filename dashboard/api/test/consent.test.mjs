/// Tests for parental consent.
///
/// The behaviour being pinned is the one the storage document promised and the code
/// did not enforce: absence of a row means no consent, and a revocation wins.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CONSENT_TYPES,
  CONSENT_VERSIONS,
  evaluateConsent,
  isConsentType,
  parseConsentWrite,
} from '../src/lib/consent.ts';

const row = (overrides = {}) => ({
  consent_type: 'child_creations',
  child_id: 'child-1',
  version: '1',
  granted_at: '2026-08-09 00:00:00',
  revoked_at: null,
  ...overrides,
});

test('child_creations is a recognised consent type', () => {
  assert.ok(isConsentType('child_creations'));
  assert.ok(CONSENT_TYPES.includes('child_creations'));
  assert.ok(!isConsentType('share_publicly'));
});

test('no row means no consent', () => {
  // The default the storage document states, and the one the upload route now
  // actually enforces.
  const decision = evaluateConsent([], 'child_creations', 'child-1');
  assert.equal(decision.granted, false);
  assert.equal(decision.reason, 'never_granted');
  assert.equal(decision.required_version, CONSENT_VERSIONS.child_creations);
});

test('a granted row for the child is consent', () => {
  assert.equal(evaluateConsent([row()], 'child_creations', 'child-1').granted, true);
});

test('a family-wide row covers every child', () => {
  // A parent answering for the household should not have to repeat it per profile.
  const decision = evaluateConsent([row({ child_id: null })], 'child_creations', 'child-9');
  assert.equal(decision.granted, true);
});

test('a row for a different child does not decide for a sibling', () => {
  const decision = evaluateConsent([row({ child_id: 'child-2' })], 'child_creations', 'child-1');
  assert.equal(decision.granted, false);
  assert.equal(decision.reason, 'never_granted');
});

test('a revocation wins over an earlier grant', () => {
  // Revocation must win or a parent's withdrawal would be silently ignored.
  const decision = evaluateConsent(
    [row({ revoked_at: '2026-08-09 01:00:00' })],
    'child_creations',
    'child-1',
  );
  assert.equal(decision.granted, false);
  assert.equal(decision.reason, 'revoked');
});

test('a later grant after a revocation restores consent', () => {
  const decision = evaluateConsent(
    [row({ revoked_at: '2026-08-09 01:00:00' }), row()],
    'child_creations',
    'child-1',
  );
  assert.equal(decision.granted, true);
});

test('an outdated version is not consent', () => {
  // If what is stored or how long it is kept changes, the previous yes was to a
  // different question.
  const decision = evaluateConsent([row({ version: '0' })], 'child_creations', 'child-1');
  assert.equal(decision.granted, false);
  assert.equal(decision.reason, 'version_superseded');
});

test('consent for one type says nothing about another', () => {
  // The reason child_creations is separate: agreeing to telemetry is not agreeing
  // to image retention.
  const rows = [row({ consent_type: 'data_collection' })];
  assert.equal(evaluateConsent(rows, 'child_creations', 'child-1').granted, false);
  assert.equal(evaluateConsent(rows, 'data_collection', 'child-1').granted, true);
});

test('a write must name the current version', () => {
  // Defaulting it would let a stale app grant consent for terms it never showed.
  const stale = parseConsentWrite({ consent_type: 'child_creations', version: '0' });
  assert.ok('error' in stale);
  assert.match(stale.error, /not current/);

  const missing = parseConsentWrite({ consent_type: 'child_creations' });
  assert.ok('error' in missing);
  assert.match(missing.error, /version is required/);
});

test('a valid grant and a valid revoke both parse', () => {
  const grant = parseConsentWrite({
    consent_type: 'child_creations', version: '1', child_id: 'child-1',
  });
  assert.ok('write' in grant);
  assert.equal(grant.write.revoke, false);
  assert.equal(grant.write.childId, 'child-1');

  const revoke = parseConsentWrite({
    consent_type: 'child_creations', version: '1', revoke: true,
  });
  assert.ok('write' in revoke);
  assert.equal(revoke.write.revoke, true);
  // Omitted child id means family-wide.
  assert.equal(revoke.write.childId, null);
});

test('an unknown consent type is refused', () => {
  const result = parseConsentWrite({ consent_type: 'sell_to_partners', version: '1' });
  assert.ok('error' in result);
  assert.match(result.error, /consent_type must be one of/);
});

test('every consent type has a declared version', () => {
  for (const type of CONSENT_TYPES) {
    assert.equal(typeof CONSENT_VERSIONS[type], 'string', type);
    assert.ok(CONSENT_VERSIONS[type].length > 0, type);
  }
});
