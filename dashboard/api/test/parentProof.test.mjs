import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  PARENT_PROOF_PURPOSES,
  SINGLE_USE_PURPOSES,
  parseParentProofPurpose,
} from '../src/lib/parentAuth.ts';

/// Parent-proof purposes (SEC-006).
///
/// ## The defect these tests pin
///
/// Fourteen purposes could be issued and **five were never checked by any
/// endpoint**: `manage_children`, `manage_consents`, `manage_billing`,
/// `delete_creation` and `approve_tv`. For those operations the gate was
/// decorative — the client asked for a PIN, the parent entered it, a purpose-bound
/// token was minted, and no handler ever looked at it.
///
/// The clearest instance was creations: `POST /creations/purge` required a consumed
/// proof to delete many drawings while `DELETE /creations/:id` required none, so
/// the gate could be bypassed by looping the unprotected path.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/// The source of every route file, concatenated, for "is this purpose used
/// anywhere" questions.
const routeSources = [
  'account', 'family', 'creations', 'childSettings', 'billing',
].map((name) => ({ name, source: read(`src/routes/${name}.ts`) }));

/* --------------------------------------------- every purpose must be enforced */

test('every issuable purpose is verified by at least one endpoint', () => {
  const definition = read('src/lib/parentAuth.ts');
  for (const purpose of PARENT_PROOF_PURPOSES) {
    const used = routeSources.filter(({ source }) => {
      // Occurrences inside the exchangeable-set derivation do not count; that set
      // is now computed from this very list, so it would make the check circular.
      return source.includes(`'${purpose}'`);
    });
    assert.ok(
      used.length > 0,
      `"${purpose}" can be issued but no route file mentions it — either verify it `
      + 'somewhere or remove it from PARENT_PROOF_PURPOSES',
    );
    // And the table in the doc comment must name it, so the mapping stays readable.
    assert.ok(
      definition.includes(`| \`${purpose}\``),
      `"${purpose}" is missing from the purpose/endpoint table`,
    );
  }
});

test('the two purposes with no endpoint were removed, not left issuable', () => {
  // `manage_billing` could only gate Google Play endpoints that have no client
  // caller and belong to a decision-blocked task; putting a PIN in front of
  // purchase verification would risk stranding a charged purchase.
  // `approve_tv` had no endpoint anywhere.
  for (const removed of ['manage_billing', 'support_ticket', 'approve_tv']) {
    assert.equal(
      PARENT_PROOF_PURPOSES.includes(removed), false,
      `${removed} must not be issuable`,
    );
    assert.equal(parseParentProofPurpose(removed), null, `${removed} must not parse`);
  }
  // And the removal is explained where someone would look for it.
  assert.match(read('src/lib/parentAuth.ts'), /Two purposes were removed rather than wired/);
});

test('the exchangeable set is derived from the enforced list, not hand-written', () => {
  const source = read('src/routes/family.ts');
  // A hand-written list drifted from the enforced set and kept offering purposes
  // nothing checked; deriving it makes that impossible.
  assert.match(source, /PARENT_PROOF_PURPOSES\.filter\(\(purpose\) => purpose !== 'parent_area'\)/);
  assert.equal(
    /new Set<ParentProofPurpose>\(\[\s*'manage_children'/.test(source), false,
    'the literal list must be gone',
  );
});

test('parent_area is not exchangeable for itself', () => {
  // It is the proof a PIN entry already produces; exchanging it for itself would be
  // a way to extend a proof indefinitely without re-entering the PIN.
  assert.match(
    read('src/routes/family.ts'),
    /purpose !== 'parent_area'/,
  );
});

/* ------------------------------------------------- the specific enforcements */

/// Extracts one handler body from a route file.
function handler(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from > 0, `handler not found: ${start}`);
  const to = end ? source.indexOf(end, from) : source.length;
  return source.slice(from, to > from ? to : source.length);
}

test('creating a child profile requires manage_children', () => {
  const body = handler(
    read('src/routes/family.ts'),
    "familyRoute.post('/children'",
    "familyRoute.post('/progress'",
  );
  assert.match(body, /'manage_children'/);
  // The proof is checked before the request body is even parsed, so a refusal
  // cannot depend on the payload.
  assert.ok(
    body.indexOf("'manage_children'") < body.indexOf('await body(c)'),
    'the gate must precede the handler work',
  );
  assert.match(body, /parentProofDenied\(proof\.reason\)/);
});

test('writing a consent requires manage_consents, not the generic parent_area', () => {
  const body = handler(
    read('src/routes/family.ts'),
    "familyRoute.post('/consents'",
    '// --- Rewards',
  );
  assert.match(body, /'manage_consents'/);
  assert.equal(
    body.includes("'parent_area'"), false,
    'a consent write must not accept a token minted for browsing the parent area',
  );
});

test('reading the parent area still accepts parent_area', () => {
  // The tightening must not turn every read into a PIN prompt: `GET /family/devices`
  // and the child-settings reads are browsing, not managing.
  const family = read('src/routes/family.ts');
  const devices = handler(family, "familyRoute.get('/devices'", "familyRoute.post('/devices/revoke'");
  assert.match(devices, /'parent_area'/);
  assert.match(read('src/routes/childSettings.ts'), /purpose: 'parent_area'/);
});

test('deleting one creation requires the same consumed proof as purging many', () => {
  const source = read('src/routes/creations.ts');
  const single = handler(source, "creationsRoute.delete('/:id'", 'async function deleteByPrefix');
  const purge = handler(source, "creationsRoute.post('/purge'", 'creationsRoute.post(\'/reconcile\'');

  assert.match(single, /purpose: 'delete_creation'/);
  assert.match(purge, /purpose: 'purge_creations'/);
  // Both destroy a child's drawing irrecoverably; the only difference is how many.
  for (const [name, body] of [['delete', single], ['purge', purge]]) {
    assert.match(body, /consume: true/, `${name} must consume the proof`);
  }
  // The gate precedes the destructive call.
  assert.ok(
    single.indexOf("'delete_creation'") < single.indexOf('/creations/delete'),
    'the proof must be verified before the deletion is dispatched',
  );
});

test('destructive purposes are single-use and browsing purposes are not', () => {
  for (const purpose of [
    'delete_creation', 'purge_creations', 'delete_child', 'delete_account',
    'revoke_device', 'export_data', 'change_password', 'change_parent_pin',
  ]) {
    assert.ok(SINGLE_USE_PURPOSES.includes(purpose), `${purpose} must be single-use`);
  }
  // A parent moving between parent-area screens must not need a new PIN per screen.
  assert.equal(SINGLE_USE_PURPOSES.includes('parent_area'), false);
  // Every single-use purpose must still be an issuable one.
  for (const purpose of SINGLE_USE_PURPOSES) {
    assert.ok(PARENT_PROOF_PURPOSES.includes(purpose), `${purpose} is not issuable`);
  }
});

/* --------------------------------------- missing, wrong and expired proof */

test('a purpose value is validated strictly', () => {
  assert.equal(parseParentProofPurpose('parent_area'), 'parent_area');
  // Case, whitespace and near-misses are refused: a purpose is an exact token, and
  // a lenient parser here would let a proof minted for browsing authorise a delete.
  for (const bad of [
    'PARENT_AREA', ' parent_area', 'parent_area ', 'delete', '', null, undefined, 7, {},
    'delete_creations', // plural — not a purpose
  ]) {
    assert.equal(parseParentProofPurpose(bad), null, `"${String(bad)}" must not parse`);
  }
});

test('verification rejects a proof minted for a different purpose', () => {
  const source = read('src/lib/parentAuth.ts');
  const verify = handler(source, 'export async function verifyParentProof', 'export async function createParentSession');
  // The claim must equal the purpose the endpoint asked for. Without this a
  // `parent_area` proof would authorise `delete_account`.
  assert.match(verify, /claims\.purpose !== values\.purpose/);
  // And it must be bound to the same session and auth epoch, so a proof cannot
  // travel to another device or survive a password change.
  assert.match(verify, /claims\.sub !== values\.principal\.parentId/);
  assert.match(verify, /claims\.sid !== values\.principal\.sessionId/);
  assert.match(verify, /claims\.epoch !== values\.principal\.authEpoch/);
  // Expiry is checked in both directions: a future-dated `iat` is as invalid as an
  // expired `exp`.
  assert.match(verify, /isValidExpiry\(claims\.exp\)/);
  assert.match(verify, /claims\.iat > now \+ 30/);
  // Replay protection is delegated to the family object, which owns the jti ledger.
  assert.match(verify, /'\/parent-proof\/validate'/);
  assert.match(verify, /consume: values\.consume === true/);
});

test('a missing header is refused before any Durable Object call', () => {
  const verify = handler(
    read('src/lib/parentAuth.ts'),
    'export async function verifyParentProof',
    'export async function createParentSession',
  );
  assert.ok(
    verify.indexOf('if (!token) return { ok: false, reason: \'invalid\' }')
      < verify.indexOf('callDurable'),
    'an absent proof must not cost a round trip',
  );
});

/* -------------------------------------------------------- the client side */

test('the app requests the purpose each endpoint now requires', () => {
  const client = readFileSync(
    new URL('../../../app_main/lib/features/home/data/majarra_api_client.dart', import.meta.url),
    'utf8',
  );
  for (const [method, purpose] of [
    ['createChild', 'manage_children'],
    ['setConsent', 'manage_consents'],
    ['deleteCreation', 'delete_creation'],
    ['purgeCreations', 'purge_creations'],
    ['revokeDevice', 'revoke_device'],
  ]) {
    const from = client.indexOf(`${method}(`);
    assert.ok(from > 0, `${method} not found in the client`);
    const body = client.slice(from, from + 1400);
    assert.match(
      body, new RegExp(`authorizeParentAction\\('${purpose}'\\)`),
      `${method} must request a ${purpose} proof`,
    );
  }
  // The generic `parentProof: true` path remains for reads, and must not be used
  // for the consent write any more.
  const consent = client.slice(client.indexOf('setConsent('), client.indexOf('setConsent(') + 1000);
  assert.equal(
    /parentProof: true/.test(consent), false,
    'a consent write must send a purpose-bound token, not the ambient one',
  );
});

test('the app never asks for a purpose the server cannot verify', () => {
  const client = readFileSync(
    new URL('../../../app_main/lib/features/home/data/majarra_api_client.dart', import.meta.url),
    'utf8',
  );
  for (const match of client.matchAll(/authorizeParentAction\('([a-z_]+)'\)/g)) {
    assert.ok(
      PARENT_PROOF_PURPOSES.includes(match[1]),
      `the app requests "${match[1]}", which the server no longer issues`,
    );
  }
});
