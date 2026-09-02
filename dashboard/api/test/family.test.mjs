import assert from 'node:assert/strict';
import test from 'node:test';

// Validates: Requirement 6.3
//
// `fetchProgress` in the client sends `childId`; the server handler at
// `GET /family/progress` reads `c.req.query('childId') ?? c.req.query('child_id')`.
// These are contract tests that pin that both spellings are accepted today,
// rather than a fix for a defect — if either branch of that `??` regresses,
// one of the two success cases below fails.

import { createParentAccessToken } from '../src/lib/parentAuth.ts';

const PARENT_ID = 'parent-progress-1';
const SESSION_ID = 'session-progress-1';
const AUTH_EPOCH = 1;
const CHILD_ID = 'child-progress-1';

/// A fake `FAMILY_STATE` Durable Object namespace that distinguishes the two
/// paths the authenticated `/progress` handler drives it through:
/// `/sessions/resolve` (session/epoch check inside `authenticateParent`) and
/// `/state` (the ownership + progress source the route itself reads).
function env({ children = [{ id: CHILD_ID }], progress = [] } = {}) {
  return {
    AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef', // secret-scan:allow test fixture
    FAMILY_STATE: {
      idFromName: () => 'family-do-id',
      get: () => ({
        async fetch(request) {
          const { pathname } = new URL(request.url);
          if (pathname === '/sessions/resolve') {
            return Response.json({
              success: true,
              data: {
                parent_id: PARENT_ID,
                session_id: SESSION_ID,
                device_id: 'device-progress-1',
                plan: 'family',
                auth_epoch: AUTH_EPOCH,
              },
            });
          }
          if (pathname === '/state') {
            return Response.json({
              success: true,
              data: { family: {}, children, progress, favorites: [] },
            });
          }
          return Response.json({ success: false, error: `unexpected path ${pathname}` }, { status: 404 });
        },
      }),
    },
  };
}

async function bearerToken(testEnv) {
  const token = await createParentAccessToken(testEnv, {
    parentId: PARENT_ID,
    sessionId: SESSION_ID,
    deviceId: 'device-progress-1',
    plan: 'family',
    authEpoch: AUTH_EPOCH,
  });
  return `Bearer ${token}`;
}

async function getProgress(path, testEnv, authorization) {
  const { default: familyRoute } = await import('../src/routes/family.ts');
  const res = await familyRoute.request(path, {
    method: 'GET',
    headers: authorization ? { Authorization: authorization } : {},
  }, testEnv);
  return { status: res.status, body: await res.json().catch(() => null) };
}

test('GET /progress?childId=<id> (the name the client actually sends) returns 200 with that child\'s progress', async () => {
  const testEnv = env({
    progress: [
      { child_id: CHILD_ID, content_id: 'story-1', position_ms: 4000 },
      { child_id: 'some-other-child', content_id: 'story-2', position_ms: 1000 },
    ],
  });
  const authorization = await bearerToken(testEnv);

  const { status, body } = await getProgress(`/progress?childId=${CHILD_ID}`, testEnv, authorization);

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].child_id, CHILD_ID);
});

test('GET /progress?child_id=<id> (the snake_case alias) also returns 200 with the same progress', async () => {
  // This is the crux of Requirement 6.3: the server already accepts both
  // spellings, so this must succeed exactly like the childId case above.
  const testEnv = env({
    progress: [{ child_id: CHILD_ID, content_id: 'story-1', position_ms: 4000 }],
  });
  const authorization = await bearerToken(testEnv);

  const { status, body } = await getProgress(`/progress?child_id=${CHILD_ID}`, testEnv, authorization);

  assert.equal(status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.length, 1);
  assert.equal(body.data[0].child_id, CHILD_ID);
});

test('GET /progress with neither childId nor child_id returns 400 with "childId is required"', async () => {
  const testEnv = env();
  const authorization = await bearerToken(testEnv);

  const { status, body } = await getProgress('/progress', testEnv, authorization);

  assert.equal(status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error, 'childId is required');
});

test('GET /progress for a child not owned by the family returns 404 "Active child profile not found"', async () => {
  const testEnv = env({ children: [{ id: 'a-different-child' }] });
  const authorization = await bearerToken(testEnv);

  const { status, body } = await getProgress(`/progress?childId=${CHILD_ID}`, testEnv, authorization);

  assert.equal(status, 404);
  assert.equal(body.success, false);
  assert.equal(body.error, 'Active child profile not found');
});

test('GET /progress without a valid Authorization header is unauthorized', async () => {
  const testEnv = env();

  const { status, body } = await getProgress(`/progress?childId=${CHILD_ID}`, testEnv, undefined);

  assert.equal(status, 401);
  assert.equal(body.success, false);
});
