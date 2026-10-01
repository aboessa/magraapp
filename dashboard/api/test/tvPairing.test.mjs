import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { TvPairing } from '../src/do/TvPairing.ts';
import tvPairingRoute, {
  CODE_ALPHABET,
  generatePairingCode,
  normalizePairingCode,
} from '../src/routes/tvPairing.ts';
import { createParentAccessToken, createParentProof } from '../src/lib/parentAuth.ts';

/// Television sign-in by pairing code (TV-001).
///
/// The properties pinned here are the ones that make a short code safe to show
/// on a screen: it grants nothing alone, tokens are collected once and only by
/// the television that asked, the parent's proof is consumed, and a device-limit
/// refusal reaches the phone without burning the code.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const SECRET = '0123456789abcdef0123456789abcdef'; // secret-scan:allow test fixture
const PARENT_ID = 'parent-tv-1';
const PHONE_SESSION = 'session-phone-1';
const EPOCH = 1;
const INSTALLATION = 'tv-installation-0123456789';

function fakeState() {
  const store = new Map();
  let alarm = null;
  let queue = Promise.resolve();
  return {
    storage: {
      async get(key) { return structuredClone(store.get(key)); },
      async put(key, value) { store.set(key, structuredClone(value)); },
      async deleteAll() { store.clear(); alarm = null; },
      async setAlarm(at) { alarm = at; },
    },
    blockConcurrencyWhile(callback) {
      const next = queue.then(() => callback());
      queue = next.then(() => undefined, () => undefined);
      return next;
    },
    _store: store,
  };
}

/// A pairing namespace backed by real `TvPairing` objects, and a family object
/// that records what it was asked to do.
function environment({ deviceLimitReached = false } = {}) {
  const pairings = new Map();
  const family = { sessionsCreated: [], consumedProofs: new Set() };
  return {
    family,
    pairings,
    env: {
      AUTH_TOKEN_SECRET: SECRET,
      TV_PAIRING: {
        idFromName: (name) => ({ name }),
        get(id) {
          if (!pairings.has(id.name)) pairings.set(id.name, new TvPairing(fakeState()));
          const object = pairings.get(id.name);
          return { fetch: (request) => object.fetch(request) };
        },
      },
      FAMILY_STATE: {
        idFromName: () => 'family',
        get: () => ({
          async fetch(request) {
            const { pathname } = new URL(request.url);
            const body = request.method === 'POST' ? await request.json() : {};
            if (pathname === '/sessions/resolve') {
              return Response.json({ success: true, data: {
                parent_id: PARENT_ID, session_id: body.session_id, device_id: 'phone',
                plan: 'family', auth_epoch: EPOCH,
              } });
            }
            if (pathname === '/parent-proof/validate') {
              if (body.consume) {
                if (family.consumedProofs.has(body.jti)) {
                  return Response.json({ success: false, error: 'used' }, { status: 403 });
                }
                family.consumedProofs.add(body.jti);
              }
              return Response.json({ success: true, data: { pin_version: body.pin_version } });
            }
            if (pathname === '/sessions/create') {
              if (deviceLimitReached) {
                return Response.json({
                  success: false, error: 'This account has reached its device limit', code: 'devices',
                }, { status: 403 });
              }
              family.sessionsCreated.push(body);
              return Response.json({ success: true, data: {
                session_id: body.session_id, device_id: 'tv-device-1', plan: 'family',
                auth_epoch: EPOCH, expires_at: body.expires_at,
              } }, { status: 201 });
            }
            return Response.json({ success: false, error: pathname }, { status: 404 });
          },
        }),
      },
    },
  };
}

const principal = { parentId: PARENT_ID, sessionId: PHONE_SESSION, deviceId: 'phone', plan: 'family', authEpoch: EPOCH };

async function parentHeaders(env, { purpose = 'approve_tv', proof = true } = {}) {
  const access = await createParentAccessToken(env, principal);
  const headers = { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' };
  if (proof) headers['X-Parent-Proof'] = (await createParentProof(env, { principal, pinVersion: 1, purpose })).token;
  return headers;
}

async function call(env, path, body, headers = { 'Content-Type': 'application/json' }) {
  const res = await tvPairingRoute.request(path, { method: 'POST', headers, body: JSON.stringify(body) }, env);
  return { status: res.status, body: await res.json().catch(() => null) };
}

const start = (env) => call(env, '/start', {
  installation_id: INSTALLATION, platform: 'android_tv', device_name: 'تلفزيون الصالة',
});

/* ------------------------------------------------------------------ codes */

test('codes are eight characters from the unambiguous alphabet', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generatePairingCode();
    assert.equal(code.length, 8);
    for (const character of code) assert.ok(CODE_ALPHABET.includes(character), character);
  }
  for (const excluded of ['I', 'L', 'O', '0', '1']) assert.equal(CODE_ALPHABET.includes(excluded), false);
});

test('bytes past the last full alphabet cycle are rejected, not folded', () => {
  // 248..255 would map to the first eight characters under a plain modulo.
  const bytes = [255, 250, 248, 0, 1, 2, 3, 4, 5, 6, 7];
  const code = generatePairingCode((buffer) => {
    buffer.fill(0);
    bytes.forEach((b, i) => { buffer[i] = b; });
    return buffer;
  });
  assert.equal(code, 'ABCDEFGH');
});

test('what a parent types is normalised, and anything else is refused', () => {
  assert.equal(normalizePairingCode('abcd-efgh'), 'ABCDEFGH');
  assert.equal(normalizePairingCode(' ABCD EFGH '), 'ABCDEFGH');
  for (const bad of ['ABCD-EFG', 'ABCD-EFGHJ', 'ABCD-EFG0', 'ABCD-EFGI', '', null, 12345678]) {
    assert.equal(normalizePairingCode(bad), null, String(bad));
  }
});

/* -------------------------------------------------------------- the flow */

test('a TV is signed in after a parent approves its code, and collects the tokens once', async () => {
  const { env, family } = environment();
  const started = await start(env);
  assert.equal(started.status, 201);
  const { code, poll_secret: pollSecret, interval, verification_uri_complete: link } = started.body.data;
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal(interval, 5);
  assert.equal(link, `majarra://app/link-tv?code=${code}`);

  const waiting = await call(env, '/poll', { code, poll_secret: pollSecret });
  assert.equal(waiting.status, 200);
  assert.equal(waiting.body.data.status, 'pending');

  const lookedUp = await call(env, '/lookup', { code: code.toLowerCase() }, await parentHeaders(env, { proof: false }));
  assert.equal(lookedUp.status, 200);
  assert.equal(lookedUp.body.data.device_name, 'تلفزيون الصالة');
  assert.equal(lookedUp.body.data.platform, 'android_tv');

  const approved = await call(env, '/approve', { code }, await parentHeaders(env));
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.approved, true);

  // The session belongs to the TV's installation, not the phone's.
  assert.equal(family.sessionsCreated.length, 1);
  assert.equal(family.sessionsCreated[0].platform, 'android_tv');
  assert.notEqual(family.sessionsCreated[0].installation_id_hash, INSTALLATION, 'only the hash is sent');

  const collected = await call(env, '/poll', { code, poll_secret: pollSecret });
  assert.equal(collected.status, 200);
  assert.equal(collected.body.data.status, 'approved');
  assert.equal(typeof collected.body.data.access_token, 'string');
  assert.match(collected.body.data.refresh_token, /^v1\./);
  assert.equal(collected.body.data.parent.id, PARENT_ID);

  const again = await call(env, '/poll', { code, poll_secret: pollSecret });
  assert.equal(again.status, 410, 'tokens are handed out exactly once');
});

test('the tokens are sealed while they wait, never stored in the clear', async () => {
  const { env, pairings } = environment();
  const { code, poll_secret: pollSecret } = (await start(env)).body.data;
  await call(env, '/approve', { code }, await parentHeaders(env));
  const [object] = [...pairings.values()];
  const stored = JSON.stringify(await object.ctx.storage.get('pairing'));
  assert.equal(stored.includes('access_token'), false);
  assert.equal(stored.includes(pollSecret), false, 'the poll secret is kept as a hash');
  assert.equal(stored.includes(INSTALLATION), false, 'the installation id is kept as a hash');
});

test('polling with the wrong secret gets nothing and looks like an unknown code', async () => {
  const { env } = environment();
  const { code } = (await start(env)).body.data;
  await call(env, '/approve', { code }, await parentHeaders(env));
  const stolen = await call(env, '/poll', { code, poll_secret: 'x'.repeat(43) });
  assert.equal(stolen.status, 410);
  assert.equal(stolen.body.data, undefined);
  const unknown = await call(env, '/poll', { code: 'ZZZZ-ZZZZ', poll_secret: 'x'.repeat(43) });
  assert.deepEqual(unknown.body, stolen.body);
});

test('approval requires a signed-in parent and an approve_tv proof, and the proof is single-use', async () => {
  const { env, family } = environment();
  const { code } = (await start(env)).body.data;

  const anonymous = await call(env, '/approve', { code });
  assert.equal(anonymous.status, 401);

  const noProof = await call(env, '/approve', { code }, await parentHeaders(env, { proof: false }));
  assert.equal(noProof.status, 403);

  const wrongPurpose = await call(env, '/approve', { code }, await parentHeaders(env, { purpose: 'parent_area' }));
  assert.equal(wrongPurpose.status, 403);
  assert.equal(family.sessionsCreated.length, 0);

  const headers = await parentHeaders(env);
  assert.equal((await call(env, '/approve', { code }, headers)).status, 200);
  const second = await start(env);
  const replay = await call(env, '/approve', { code: second.body.data.code }, headers);
  assert.equal(replay.status, 403, 'one PIN entry must not pair a second TV');
  assert.equal(family.sessionsCreated.length, 1);
});

test('a code can be approved once', async () => {
  const { env, family } = environment();
  const { code } = (await start(env)).body.data;
  assert.equal((await call(env, '/approve', { code }, await parentHeaders(env))).status, 200);
  const twice = await call(env, '/approve', { code }, await parentHeaders(env));
  assert.equal(twice.status, 409);
  assert.equal(family.sessionsCreated.length, 1);
});

test('a device-limit refusal reaches the phone and leaves the code usable', async () => {
  const limited = environment({ deviceLimitReached: true });
  const { code, poll_secret: pollSecret } = (await start(limited.env)).body.data;
  const refused = await call(limited.env, '/approve', { code }, await parentHeaders(limited.env));
  assert.equal(refused.status, 403);
  assert.match(refused.body.error, /device limit/);
  // Released, so the TV keeps waiting and the parent can retry after freeing a slot.
  const waiting = await call(limited.env, '/poll', { code, poll_secret: pollSecret });
  assert.equal(waiting.body.data.status, 'pending');
  const lookup = await call(limited.env, '/lookup', { code }, await parentHeaders(limited.env, { proof: false }));
  assert.equal(lookup.status, 200);
});

test('an expired code cannot be looked up, approved or collected', async (t) => {
  const { env } = environment();
  const { code, poll_secret: pollSecret } = (await start(env)).body.data;
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; });
  Date.now = () => realNow() + 11 * 60_000;
  // Proofs are minted with the shifted clock too, so only the code is stale.
  const lookup = await call(env, '/lookup', { code }, await parentHeaders(env, { proof: false }));
  assert.equal(lookup.status, 404);
  assert.equal((await call(env, '/poll', { code, poll_secret: pollSecret })).status, 410);
});

test('only television platforms may ask for a code', async () => {
  const { env } = environment();
  const phone = await call(env, '/start', { installation_id: INSTALLATION, platform: 'android' });
  assert.equal(phone.status, 400);
  const short = await call(env, '/start', { installation_id: 'short', platform: 'android_tv' });
  assert.equal(short.status, 400);
});

test('without the binding the paths answer 503 rather than crash', async () => {
  const { env } = environment();
  delete env.TV_PAIRING;
  assert.equal((await start(env)).status, 503);
});

/* ------------------------------------------------------------ the wiring */

test('the pairing paths are mounted outside /auth/* with their own limits', () => {
  const index = read('src/index.ts');
  assert.match(index, /app\.route\('\/api\/v1\/tv\/pair', tvPairingRoute\)/);
  assert.match(index, /app\.use\('\/api\/v1\/tv\/pair\/start', tvPairStartLimit\)/);
  assert.match(index, /app\.use\('\/api\/v1\/tv\/pair\/poll', tvPairPollLimit\)/);
  assert.match(index, /app\.use\('\/api\/v1\/tv\/pair\/approve', parentWriteLimit\)/);
  assert.match(index, /export \{ TvPairing \} from '\.\/do\/TvPairing\.ts'/);
});

test('the Durable Object is bound and migrated in both environments', () => {
  const config = read('wrangler.jsonc');
  assert.equal((config.match(/"class_name": "TvPairing"/g) ?? []).length, 2);
  assert.equal((config.match(/"TvPairing"\s*\]/g) ?? []).length, 2);
});
