import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { callDurable, familyStub } from '../lib/doClient';
import { authenticateParent, type ParentPrincipal } from '../lib/parentAuth';

type AppEnv = { Bindings: Env };
type JsonBody = Record<string, unknown>;
type Envelope<T> = { success: boolean; data?: T; error?: string };

const familyRoute = new Hono<AppEnv>();

async function principal(c: { env: Env; req: { header(name: string): string | undefined } }) {
  return authenticateParent(c.env, c.req.header('Authorization'));
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

async function body(c: { req: { json(): Promise<unknown> } }): Promise<JsonBody | null> {
  const value = await c.req.json().catch(() => null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonBody : null;
}

function forward(result: { status: number; data: unknown }) {
  return Response.json(result.data ?? { success: false, error: 'Family service unavailable' }, { status: result.status });
}

async function state(env: Env, parent: ParentPrincipal) {
  return callDurable<Envelope<{
    family: unknown;
    children: Array<{ id: string }>;
    progress: Array<Record<string, unknown>>;
    favorites: Array<Record<string, unknown>>;
  }>>(familyStub(env, parent.parentId), '/state');
}

familyRoute.get('/state', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await state(c.env, auth.principal));
});

familyRoute.get('/children', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/children'));
});

familyRoute.post('/children', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await body(c);
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/children', {
    body: { ...value, session_id: auth.principal.sessionId },
  }));
});

familyRoute.post('/progress', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await body(c);
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const progressSeconds = typeof value.progress_seconds === 'number' ? value.progress_seconds : null;
  const durationSeconds = typeof value.duration_seconds === 'number' ? value.duration_seconds : null;
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/progress', {
    body: {
      ...value,
      session_id: auth.principal.sessionId,
      event_id: value.event_id ?? value.eventId ?? crypto.randomUUID(),
      content_id: value.content_id ?? value.episode_id,
      content_type: value.content_type ?? 'episode',
      position_ms: value.position_ms ?? value.positionMs ?? (progressSeconds === null ? undefined : Math.floor(progressSeconds * 1000)),
      duration_ms: value.duration_ms ?? value.durationMs ?? (durationSeconds === null ? 0 : Math.floor(durationSeconds * 1000)),
    },
  }));
});

familyRoute.get('/progress', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const childId = c.req.query('childId') ?? c.req.query('child_id');
  if (!childId) return c.json({ success: false, error: 'childId is required' }, 400);

  const result = await state(c.env, auth.principal);
  if (!result.ok || !result.data?.success || !result.data.data) return forward(result);
  const ownsChild = result.data.data.children.some((child) => child.id === childId);
  if (!ownsChild) return c.json({ success: false, error: 'Active child profile not found' }, 404);
  return c.json({
    success: true,
    data: result.data.data.progress.filter((item) => item.child_id === childId),
  });
});

familyRoute.post('/favorites', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await body(c);
  if (!value) return c.json({ success: false, error: 'A JSON object is required' }, 400);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/favorites', {
    body: { ...value, session_id: auth.principal.sessionId },
  }));
});

familyRoute.get('/devices', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/devices'));
});

familyRoute.post('/devices/revoke', async (c) => {
  const auth = await principal(c);
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await body(c);
  if (!value || typeof value.device_id !== 'string') return c.json({ success: false, error: 'device_id is required' }, 400);
  return forward(await callDurable(familyStub(c.env, auth.principal.parentId), '/devices/revoke', {
    body: { device_id: value.device_id, session_id: auth.principal.sessionId },
  }));
});

export default familyRoute;
