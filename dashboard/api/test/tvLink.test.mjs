import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import { CLOSE_REPLACED, CLOSE_REVOKED, FamilyLink } from '../src/do/FamilyLink.ts';
import tvLinkRoute, { createLinkTicket } from '../src/routes/tvLink.ts';
import { createParentAccessToken } from '../src/lib/parentAuth.ts';

/// Play on the TV from the phone, and remote control (TV-002).

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const SECRET = '0123456789abcdef0123456789abcdef'; // secret-scan:allow test fixture
const PARENT = 'parent-link-1';

/* ----------------------------------------------------------- test doubles */

function fakeSocket() {
  let attachment = null;
  return {
    sent: [],
    closed: null,
    readyState: 1,
    tags: [],
    send(text) { if (this.readyState !== 1) throw new Error('closed'); this.sent.push(JSON.parse(text)); },
    close(code, reason) { this.closed = { code, reason }; this.readyState = 3; },
    serializeAttachment(value) { attachment = structuredClone(value); },
    deserializeAttachment() { return structuredClone(attachment); },
    last(type) { return [...this.sent].reverse().find((m) => m.type === type); },
  };
}

function fakeCtx() {
  const sockets = [];
  return {
    sockets,
    acceptWebSocket(ws, tags) { ws.tags = tags; sockets.push(ws); },
    getWebSockets(tag) { return sockets.filter((ws) => ws.readyState !== 3 && (!tag || ws.tags.includes(tag))); },
    setWebSocketAutoResponse() {},
  };
}

/// Family state double: sessions listed in `live` resolve, everything else is 401.
function familyEnv({ live = new Map(), children = [{ id: 'child-1', nickname: 'ليلى' }] } = {}) {
  return {
    AUTH_TOKEN_SECRET: SECRET,
    FAMILY_STATE: {
      idFromName: (name) => ({ name }),
      get: () => ({
        async fetch(request) {
          const { pathname } = new URL(request.url);
          const body = request.method === 'POST' ? await request.json() : {};
          if (pathname === '/sessions/resolve') {
            const device = live.get(body.session_id);
            if (!device) return Response.json({ success: false }, { status: 401 });
            return Response.json({ success: true, data: {
              parent_id: PARENT, session_id: body.session_id, device_id: device, plan: 'family', auth_epoch: 1,
            } });
          }
          if (pathname === '/children') return Response.json({ success: true, data: children });
          return Response.json({ success: false }, { status: 404 });
        },
      }),
    },
  };
}

const tvMeta = (deviceId = 'tv-1', sessionId = 'session-tv-1') => ({
  role: 'tv', parentId: PARENT, deviceId, sessionId, authEpoch: 1, name: 'تلفزيون الصالة',
});
const remoteMeta = { role: 'remote', parentId: PARENT, deviceId: 'phone-1', sessionId: 'session-phone', authEpoch: 1, name: null };

function setup() {
  const live = new Map([['session-tv-1', 'tv-1'], ['session-tv-2', 'tv-2'], ['session-phone', 'phone-1']]);
  const env = familyEnv({ live });
  const ctx = fakeCtx();
  const link = new FamilyLink(ctx, env);
  return { live, env, ctx, link };
}

const post = (link, path, body) => link.fetch(new Request(`https://durable.internal${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}));

/// Delivers a command and lets the TV answer the way a real TV would.
async function commandWithAck(link, tv, body, ack = { ok: true }) {
  const pending = post(link, '/command', body);
  await new Promise((r) => setTimeout(r, 5));
  const message = tv.last('command');
  if (message && ack) {
    await link.webSocketMessage(tv, JSON.stringify({ type: 'ack', command_id: message.command_id, ...ack }));
  }
  const res = await pending;
  return { status: res.status, body: await res.json(), message };
}

/* ------------------------------------------------------------ presence */

test('a phone showing the remote sees which TVs are connected', async () => {
  const { link } = setup();
  const remote = fakeSocket();
  link.register(remote, remoteMeta);
  assert.deepEqual(remote.last('devices').devices, []);

  const tv = fakeSocket();
  link.register(tv, tvMeta());
  const listed = remote.last('devices').devices;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].device_id, 'tv-1');
  assert.equal(listed[0].name, 'تلفزيون الصالة');

  await link.webSocketClose(tv);
  tv.readyState = 3;
  await link.webSocketClose(tv);
  assert.deepEqual(remote.last('devices').devices, [], 'a TV that leaves disappears from the list');
});

test('a reconnecting TV replaces its stale socket instead of appearing twice', async () => {
  const { link } = setup();
  const first = fakeSocket();
  link.register(first, tvMeta());
  const second = fakeSocket();
  link.register(second, tvMeta());
  assert.equal(first.closed?.code, CLOSE_REPLACED);
  const res = await post(link, '/devices', {});
  assert.equal((await res.json()).data.length, 1);
});

test('TV state reaches the remote, sanitised, and survives in the socket attachment', async () => {
  const { link } = setup();
  const tv = fakeSocket();
  const remote = fakeSocket();
  link.register(tv, tvMeta());
  link.register(remote, remoteMeta);

  await link.webSocketMessage(tv, JSON.stringify({
    type: 'state', status: 'playing', episode_id: 'ep-1', title: 'الحلقة ١',
    child_id: 'child-1', position_ms: 12_345.9, duration_ms: -5, extra: 'ignored',
  }));
  const update = remote.last('state');
  assert.equal(update.device_id, 'tv-1');
  assert.equal(update.state.status, 'playing');
  assert.equal(update.state.position_ms, 12_345);
  assert.equal(update.state.duration_ms, 0);
  assert.equal('extra' in update.state, false);
  // Kept in the attachment, which is what survives hibernation.
  assert.equal(tv.deserializeAttachment().state.episode_id, 'ep-1');

  const before = remote.sent.length;
  await link.webSocketMessage(tv, JSON.stringify({ type: 'state', status: 'hacked' }));
  await link.webSocketMessage(tv, 'not json');
  await link.webSocketMessage(tv, 'x'.repeat(5000));
  assert.equal(remote.sent.length, before, 'malformed state is dropped');
});

test('a remote socket cannot send commands; it only listens', async () => {
  const { link } = setup();
  const tv = fakeSocket();
  const remote = fakeSocket();
  link.register(tv, tvMeta());
  link.register(remote, remoteMeta);
  await link.webSocketMessage(remote, JSON.stringify({ type: 'command', command: 'play' }));
  await link.webSocketMessage(remote, JSON.stringify({ type: 'state', status: 'playing' }));
  assert.equal(tv.last('command'), undefined);
  assert.equal(remote.last('state'), undefined);
});

/* ------------------------------------------------------------- commands */

test('a play command reaches the TV with ids only, and the phone hears the ack', async () => {
  const { link } = setup();
  const tv = fakeSocket();
  link.register(tv, tvMeta());
  const result = await commandWithAck(link, tv, {
    device_id: 'tv-1', command: 'play', episode_id: 'ep-1', child_id: 'child-1',
    child_name: 'ليلى', position_ms: 90_000, from: 'موبايل ماما',
  });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.message.episode_id, 'ep-1');
  assert.equal(result.message.child_id, 'child-1');
  assert.equal(result.message.child_name, 'ليلى');
  assert.equal(result.message.position_ms, 90_000);
  const serialized = JSON.stringify(result.message);
  for (const forbidden of ['http', 'token', 'stream']) {
    assert.equal(serialized.includes(forbidden), false, `a command must not carry ${forbidden}`);
  }
});

test('a TV that refuses says why, and the phone gets the reason', async () => {
  const { link } = setup();
  const tv = fakeSocket();
  link.register(tv, tvMeta());
  const result = await commandWithAck(link, tv, {
    device_id: 'tv-1', command: 'play', episode_id: 'ep-1', child_id: 'child-1',
  }, { ok: false, reason: 'screen_time_daily_limit' });
  assert.equal(result.status, 409);
  assert.equal(result.body.code, 'screen_time_daily_limit');
});

test('pause, resume, stop and seek are delivered', async () => {
  const { link } = setup();
  const tv = fakeSocket();
  link.register(tv, tvMeta());
  for (const body of [
    { command: 'pause' }, { command: 'resume' }, { command: 'stop' },
    { command: 'seek', delta_ms: -10_000 }, { command: 'seek', position_ms: 60_000 },
  ]) {
    const result = await commandWithAck(link, tv, { device_id: 'tv-1', ...body });
    assert.equal(result.status, 200, body.command);
    assert.equal(result.message.command, body.command);
  }
  assert.equal(tv.last('command').position_ms, 60_000);
  const bad = await post(link, '/command', { device_id: 'tv-1', command: 'seek' });
  assert.equal(bad.status, 400, 'a seek needs a target');
  const unknown = await post(link, '/command', { device_id: 'tv-1', command: 'format_disk' });
  assert.equal(unknown.status, 400);
});

test('an ack from a different TV does not answer the command', async () => {
  const { link } = setup();
  const tv1 = fakeSocket();
  const tv2 = fakeSocket();
  link.register(tv1, tvMeta('tv-1', 'session-tv-1'));
  link.register(tv2, tvMeta('tv-2', 'session-tv-2'));
  const pending = post(link, '/command', { device_id: 'tv-1', command: 'pause' });
  await new Promise((r) => setTimeout(r, 5));
  const { command_id } = tv1.last('command');
  await link.webSocketMessage(tv2, JSON.stringify({ type: 'ack', command_id, ok: false, reason: 'spoofed' }));
  await link.webSocketMessage(tv1, JSON.stringify({ type: 'ack', command_id, ok: true }));
  assert.equal((await pending).status, 200);
});

test('a TV that does not answer times out instead of hanging the phone', async (t) => {
  const { link } = setup();
  const tv = fakeSocket();
  link.register(tv, tvMeta());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = post(link, '/command', { device_id: 'tv-1', command: 'pause' });
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  t.mock.timers.tick(4_001);
  const res = await pending;
  assert.equal(res.status, 504);
  assert.equal((await res.json()).code, 'tv_timeout');
});

test('a TV removed from the devices screen stops obeying at once', async () => {
  const { link, live } = setup();
  const tv = fakeSocket();
  link.register(tv, tvMeta());
  live.delete('session-tv-1'); // Revoked or signed out.
  const res = await post(link, '/command', { device_id: 'tv-1', command: 'pause' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'tv_offline');
  assert.equal(tv.closed?.code, CLOSE_REVOKED);
  assert.equal(tv.last('command'), undefined, 'nothing is delivered to a revoked TV');
});

test('a command to a TV that is not connected says so', async () => {
  const { link } = setup();
  const res = await post(link, '/command', { device_id: 'tv-9', command: 'pause' });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).code, 'tv_offline');
});

/* --------------------------------------------------------------- routes */

function routeEnv() {
  const { env, link, live } = setup();
  env.FAMILY_LINK = { idFromName: (name) => ({ name }), get: () => ({ fetch: (r) => link.fetch(r) }) };
  return { env, link, live };
}

const phone = { parentId: PARENT, sessionId: 'session-phone', deviceId: 'phone-1', plan: 'family', authEpoch: 1 };

async function callRoute(env, path, { method = 'POST', body, headers = {} } = {}) {
  const res = await tvLinkRoute.request(path, {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, env);
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('connecting needs a WebSocket upgrade and a valid, live ticket', async () => {
  const { env, live } = routeEnv();
  const ticket = await createLinkTicket(env, phone, 'remote', null);
  assert.equal((await callRoute(env, `/connect?ticket=${ticket}`, { method: 'GET' })).status, 426);
  const upgrade = { Upgrade: 'websocket' };
  assert.equal((await callRoute(env, '/connect?ticket=forged', { method: 'GET', headers: upgrade })).status, 401);
  const access = await createParentAccessToken(env, phone);
  assert.equal(
    (await callRoute(env, `/connect?ticket=${access}`, { method: 'GET', headers: upgrade })).status, 401,
    'an access token is not a ticket',
  );
  live.delete('session-phone');
  assert.equal((await callRoute(env, `/connect?ticket=${ticket}`, { method: 'GET', headers: upgrade })).status, 401,
    'a ticket from a session that has since ended is refused');
});

test('a ticket is issued only to a signed-in family member', async () => {
  const { env } = routeEnv();
  assert.equal((await callRoute(env, '/ticket', { body: { role: 'tv' } })).status, 401);
  const auth = { Authorization: `Bearer ${await createParentAccessToken(env, phone)}` };
  const issued = await callRoute(env, '/ticket', { body: { role: 'remote' }, headers: auth });
  assert.equal(issued.status, 200);
  assert.equal(issued.body.data.expires_in, 60);
  assert.equal((await callRoute(env, '/ticket', { body: { role: 'admin' }, headers: auth })).status, 400);
});

test('a play command for a child outside the family never reaches the TV', async () => {
  const { env, link } = routeEnv();
  const tv = fakeSocket();
  link.register(tv, tvMeta());
  const auth = { Authorization: `Bearer ${await createParentAccessToken(env, phone)}` };
  const res = await callRoute(env, '/command', {
    body: { device_id: 'tv-1', command: 'play', episode_id: 'ep-1', child_id: 'child-of-someone-else' },
    headers: auth,
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'child_not_found');
  assert.equal(tv.last('command'), undefined);
  const missing = await callRoute(env, '/command', { body: { device_id: 'tv-1', command: 'play' }, headers: auth });
  assert.equal(missing.status, 400);
});

test('the device list leaves out the phone asking', async () => {
  const { env, link } = routeEnv();
  link.register(fakeSocket(), tvMeta());
  link.register(fakeSocket(), { ...tvMeta('phone-1', 'session-phone'), name: 'موبايل' });
  const auth = { Authorization: `Bearer ${await createParentAccessToken(env, phone)}` };
  const res = await callRoute(env, '/devices', { body: {}, headers: auth });
  assert.deepEqual(res.body.data.map((d) => d.device_id), ['tv-1']);
});

/* ---------------------------------------------------------------- wiring */

test('the link routes are mounted with their limits and the object is exported', () => {
  const index = read('src/index.ts');
  assert.match(index, /app\.route\('\/api\/v1\/tv\/link', tvLinkRoute\)/);
  assert.match(index, /app\.use\('\/api\/v1\/tv\/link\/command', tvRemoteLimit\)/);
  assert.match(index, /app\.use\('\/api\/v1\/tv\/link\/connect', tvPairPollLimit\)/);
  assert.match(index, /export \{ FamilyLink \} from '\.\/do\/FamilyLink\.ts'/);
  const config = read('wrangler.jsonc');
  assert.equal((config.match(/"class_name": "FamilyLink"/g) ?? []).length, 2);
  assert.equal((config.match(/"FamilyLink"\s*\]/g) ?? []).length, 2);
});

test('sockets use the Hibernation API, never accept()', () => {
  const source = read('src/do/FamilyLink.ts').replace(/^\s*(\/\/|\*).*$/gm, '');
  assert.match(source, /this\.ctx\.acceptWebSocket\(/);
  assert.match(source, /setWebSocketAutoResponse/);
  assert.equal(/\bserver\.accept\(\)|\bws\.accept\(\)/.test(source), false);
});
