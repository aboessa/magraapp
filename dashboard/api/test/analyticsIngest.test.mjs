import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/// Telemetry ingest: identifier authority and parameter screening.
///
/// ## The defects these tests pin
///
/// The handler used to compute `authenticateParent` and then discard it.
/// `parent_id` fell back to the request body when unauthenticated, and
/// `child_id` was read from the body **unconditionally, with no ownership
/// check** — so any anonymous caller could write unbounded rows attributed to
/// arbitrary families and children. Nothing in the route was rate limited.
///
/// The PII screen was `/nickname|email|birth|query|text|transcript/i` applied to
/// the serialized params, which rejected any event whose *value* contained
/// "text" while accepting `child_name`, `dob` and `phone`. A substring match over
/// a blob cannot tell a key from a value, so it failed in both directions.

const writes = [];

function fakeDb() {
  return {
    prepare(sql) {
      return {
        bind: (...params) => ({
          async run() {
            writes.push({ sql, params });
            return { meta: { changes: 1 } };
          },
          async all() { return { results: [] }; },
          async first() { return null; },
        }),
        async run() { writes.push({ sql, params: [] }); return { meta: { changes: 1 } }; },
        async all() { return { results: [] }; },
        async first() { return null; },
      };
    },
  };
}

/// The Durable Object stub stands in for `FamilyState`, the ownership authority.
function env({ children = [], authenticated = false } = {}) {
  return {
    DB: fakeDb(),
    ENVIRONMENT: 'development',
    AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef', // secret-scan:allow test fixture
    CACHE: { async get() { return null; }, async put() {} },
    FAMILY_STATE: {
      idFromName: () => 'family-id',
      get: () => ({
        async fetch() {
          return new Response(JSON.stringify({ success: true, data: { children } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        },
      }),
    },
    __authenticated: authenticated,
  };
}

async function post(body, options = {}) {
  const { default: route } = await import('../src/routes/analyticsIngest.ts');
  return route.request('/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.authorization ? { Authorization: options.authorization } : {}),
    },
    body: JSON.stringify(body),
  }, env(options));
}

function lastWrite() {
  return writes[writes.length - 1];
}

test('an anonymous app_open is stored with no identifiers', async () => {
  writes.length = 0;
  const res = await post({ event: 'app_open' });

  assert.equal(res.status, 201);
  const write = lastWrite();
  assert.match(write.sql, /INSERT INTO analytics_events/);
  // (id, parent_id, child_id, event_name, params_json)
  assert.equal(write.params[1], null, 'parent_id is never attributed to an anonymous caller');
  assert.equal(write.params[2], null);
  assert.equal(write.params[3], 'app_open');
});

test('a body-supplied parent_id is refused outright, not silently ignored', async () => {
  // SEC-110 tightened this. It used to be *ignored*: the row was written with a
  // null parent and the caller got 201, so a client could believe its
  // attribution worked for as long as nobody read the table.
  //
  // The security property is unchanged — attribution never comes from the body —
  // but the answer is now honest. `parent_id` is not a declared field on this
  // endpoint, and an undeclared field is a mistake worth reporting.
  writes.length = 0;
  const res = await post({ event: 'app_open', parent_id: 'parent-victim', child_id: 'child-victim' });

  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.code, 'invalid_body');
  assert.deepEqual(payload.data.fields, ['parent_id']);
  assert.equal(writes.length, 0, 'nothing is written for a refused body');
});

test('an anonymous caller cannot write any other event', async () => {
  writes.length = 0;
  for (const event of ['video_started', 'content_completed', 'search', 'download_started']) {
    const res = await post({ event });
    assert.equal(res.status, 401, `${event} must require a session`);
  }
  assert.equal(writes.length, 0, 'nothing may be written for a refused event');
});

test('an unknown event name is refused', async () => {
  writes.length = 0;
  const res = await post({ event: 'exfiltrate' });
  assert.equal(res.status, 400);
  assert.equal(writes.length, 0);
});

test('params keys are allow-listed, so PII-shaped keys are refused', async () => {
  writes.length = 0;
  for (const key of ['child_name', 'dob', 'phone', 'email', 'nickname', 'address', 'query', 'transcript']) {
    const res = await post({ event: 'app_open', params: { [key]: 'value' } });
    assert.equal(res.status, 400, `${key} must be refused`);
    const payload = await res.json();
    assert.match(payload.error, /not allowed/);
  }
  assert.equal(writes.length, 0);
});

test('a legitimate value containing the word "text" is accepted', async () => {
  // The old denylist searched the serialized JSON, so this was rejected while
  // `child_name` sailed through.
  writes.length = 0;
  const res = await post({
    event: 'app_open',
    params: { source: 'text_only_mode', mode: 'read_to_me', position_ms: 1200 },
  });

  assert.equal(res.status, 201);
  const stored = JSON.parse(lastWrite().params[4]);
  assert.deepEqual(stored, { source: 'text_only_mode', mode: 'read_to_me', position_ms: 1200 });
});

test('nested params are refused, because free text hides in them', async () => {
  writes.length = 0;
  const res = await post({ event: 'app_open', params: { source: { nested: 'child name here' } } });
  assert.equal(res.status, 400);
  assert.equal(writes.length, 0);
});

test('an over-long param value is refused', async () => {
  writes.length = 0;
  const res = await post({ event: 'app_open', params: { source: 'x'.repeat(200) } });
  assert.equal(res.status, 400);
  assert.equal(writes.length, 0);
});

test('params must be an object, not an array or scalar', async () => {
  writes.length = 0;
  for (const params of [['a'], 'a', 5]) {
    const res = await post({ event: 'app_open', params });
    assert.equal(res.status, 400);
  }
  assert.equal(writes.length, 0);
});

// The quota used to be asserted here by matching `index.ts` as text, justified by
// a comment claiming the middleware was out of this suite's reach. It is not:
// `rateLimit.test.mjs` mounts the worker — so the claim now lives there as a real
// request that reads `X-RateLimit-Limit` off the response, with a control case
// proving a non-analytics path does not spend the analytics budget (`QA-104`).
//
// A source match would have stayed green if the mount path were changed to one
// that never matches a live request, which is exactly the defect it guarded.

test('telemetry retention is enforced by the daily cron', () => {
  const source = readFileSync(fileURLToPath(new URL('../src/scheduled/cleanup.ts', import.meta.url)), 'utf8');
  assert.match(source, /DELETE FROM analytics_events WHERE created_at < datetime\('now', \?\)/);
  assert.match(source, /ANALYTICS_RETENTION_DAYS/);
  // A failure must be visible rather than swallowed: a silently growing table is
  // the failure mode that matters here.
  assert.match(source, /console\.error\('cleanup_failed'/);
});

/* ------------------------------------------ PRIV-103: من أين تُعرف الملكية */

/// بيئةٌ تُجيب استعلام الإسقاط، وتَعُدّ نداءات الكائن الدائم **حسب مساره**.
///
/// التفريق ضروري ولم يكن بديهيًّا: `authenticateParent` نفسه ينادي
/// `/sessions/resolve` للتحقّق من الجلسة والحقبة، فعدُّ «كل النداءات» كان
/// سيُثبت شيئًا غير المقصود. شكوى البند هي `/state` — حالةُ الأسرة **كاملة**
/// لكل حدث — فذاك ما يُقاس.
function ownershipEnv({ projected = [], doChildren = [] } = {}) {
  const calls = { state: 0, resolve: 0, projectionQueries: [] };
  const env = {
    DB: {
      prepare(sql) {
        const answer = async (params) => {
          if (!sql.includes('child_projection')) return null;
          calls.projectionQueries.push({ sql, params });
          const [childId, parentId] = params;
          return projected.some(
            (row) => row.child_id === childId
              && row.parent_id === parentId
              && row.status === 'active',
          )
            ? { 1: 1 }
            : null;
        };
        return {
          bind: (...params) => ({
            async run() { return { meta: { changes: 1 } }; },
            async all() { return { results: [] }; },
            first: () => answer(params),
          }),
          async run() { return { meta: { changes: 1 } }; },
          async all() { return { results: [] }; },
          async first() { return null; },
        };
      },
    },
    ENVIRONMENT: 'development',
    AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef', // secret-scan:allow test fixture
    CACHE: { async get() { return null; }, async put() {} },
    FAMILY_STATE: {
      idFromName: () => 'family-id',
      get: () => ({
        async fetch(request) {
          const { pathname } = new URL(request.url);
          if (pathname === '/sessions/resolve') {
            calls.resolve += 1;
            return Response.json({
              success: true,
              data: {
                parent_id: OWNER_ID,
                session_id: OWNER_SESSION,
                device_id: 'device-owner-1',
                plan: 'family',
                auth_epoch: 1,
              },
            });
          }
          if (pathname === '/state') {
            calls.state += 1;
            return Response.json({ success: true, data: { children: doChildren } });
          }
          return Response.json({ success: false, error: pathname }, { status: 404 });
        },
      }),
    },
  };
  return { env, calls };
}

const OWNER_ID = 'parent-owner-1';
const OWNER_SESSION = 'session-owner-1';

async function postAsOwner(env, body) {
  const { createParentAccessToken } = await import('../src/lib/parentAuth.ts');
  const token = await createParentAccessToken(env, {
    parentId: OWNER_ID,
    sessionId: OWNER_SESSION,
    deviceId: 'device-owner-1',
    plan: 'family',
    authEpoch: 1,
  });
  const { default: route } = await import('../src/routes/analyticsIngest.ts');
  return route.request('/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }, env);
}

test('طفل مُسقَط: يُقبل الحدث بلا استدعاء حالة الأسرة كاملةً', async () => {
  const { env: e, calls } = ownershipEnv({
    projected: [{ child_id: 'child-1', parent_id: OWNER_ID, status: 'active' }],
  });
  const res = await postAsOwner(e, { event: 'video_started', child_id: 'child-1' });

  assert.equal(res.status, 201);
  // هذا هو البند بعينه: كان كل حدث يجرّ `/state`.
  assert.equal(calls.state, 0, 'استُدعيت حالة الأسرة مع أن الإسقاط يكفي');
  assert.equal(calls.projectionQueries.length, 1);

  // والاستعلام نفسه يُقيَّد بالأب وبالحالة النشطة. بلا هذا التأكيد كان إسقاط
  // `parent_id` من الشرط يبقى مارًّا: الاختبار المجاور («صفٌّ لأبٍ آخر») يمرّ
  // في الحالتين، لأن الرفض يأتيه من السلطة لا من الاستعلام.
  const query = calls.projectionQueries[0];
  assert.match(query.sql, /parent_id = \?/);
  assert.match(query.sql, /status = 'active'/);
  assert.deepEqual(query.params, ['child-1', OWNER_ID]);
});

test('التحقّق يمرّ بالأب: صفٌّ لأبٍ آخر لا يُخوّل', async () => {
  // لو سقط `parent_id` من الشرط لصار أي أبٍ يكتب قياسات عن طفل غيره.
  const { env: e } = ownershipEnv({
    projected: [{ child_id: 'child-1', parent_id: 'parent-other', status: 'active' }],
    doChildren: [],
  });
  const res = await postAsOwner(e, { event: 'video_started', child_id: 'child-1' });

  assert.equal(res.status, 403);
});

test('إسقاطٌ متأخّر: السلطة تُسأل فيُقبل الحدث ولا يُفقَد', async () => {
  // طفلٌ أُنشئ قبل لحظة ولم يكتبه الطابور بعد، وأوّلُ أحداثه هي ما يقيس رحلة
  // التهيئة — فالرفض على تأخّرٍ كان سيفقد أنفعَ القياسات.
  const { env: e, calls } = ownershipEnv({
    projected: [],
    doChildren: [{ id: 'child-new' }],
  });
  const res = await postAsOwner(e, { event: 'video_started', child_id: 'child-new' });

  assert.equal(res.status, 201);
  assert.equal(calls.state, 1, 'السلطة تُسأل عند غياب الصفّ');
});

test('طفلٌ مؤرشَف: لا يُخوَّل من الإسقاط، وتُسأل السلطة فتنفيه', async () => {
  const { env: e, calls } = ownershipEnv({
    projected: [{ child_id: 'child-1', parent_id: OWNER_ID, status: 'archived' }],
    doChildren: [],
  });
  const res = await postAsOwner(e, { event: 'video_started', child_id: 'child-1' });

  assert.equal(res.status, 403);
  assert.equal(calls.state, 1);
});

test('معرّف طفلٍ مُختلَق يُرفض', async () => {
  const { env: e } = ownershipEnv({ projected: [], doChildren: [{ id: 'child-1' }] });
  const res = await postAsOwner(e, { event: 'video_started', child_id: 'child-forged' });

  assert.equal(res.status, 403);
});
