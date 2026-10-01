import { Hono } from 'hono';

import type { Env } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { authenticateParent, authIsConfigured, type ParentPrincipal } from '../lib/parentAuth.ts';
import { createSignedToken, verifySignedToken } from '../lib/security.ts';
import { bodyOr400, integer, oneOf, text, type BodySchema } from '../lib/requestSchema.ts';

/**
 * Play on the TV from the phone, and control it (`TV-002`).
 *
 * | Endpoint | Caller | Auth |
 * |---|---|---|
 * | `POST /ticket` | TV or phone | parent session → 60-second connection ticket |
 * | `GET /connect?ticket=` | TV or phone | the ticket; upgrades to a WebSocket |
 * | `POST /devices` | phone | parent session; televisions connected right now |
 * | `POST /command` | phone | parent session; play / pause / resume / stop / seek |
 *
 * ## Why a ticket rather than the access token on the socket
 *
 * A browser WebSocket cannot send an `Authorization` header, so the credential
 * would have to travel in the URL, where proxies and logs keep it. The access
 * token lives fifteen minutes and opens the whole API; the ticket lives sixty
 * seconds and opens exactly one thing, this connection. The session behind it is
 * resolved again when the socket opens, and again before every command reaches a
 * TV (`FamilyLink.sessionIsLive`), so a revoked TV stops obeying immediately.
 *
 * ## Who may send commands
 *
 * Any signed-in member of the family, from a child profile included, with no
 * PIN: casting only chooses *which screen* a child's playback happens on. The
 * TV then opens a normal playback session for the child named in the command,
 * so every parental rule for that child applies on the TV exactly as it would
 * on the phone. The child must belong to the family; that is checked here.
 */

type AppEnv = { Bindings: Env };
type Envelope<T> = { success: boolean; data?: T; error?: string; code?: string };

const tvLinkRoute = new Hono<AppEnv>();

const TICKET_TTL_SECONDS = 60;
const ID = { min: 1, max: 128 } as const;

type TicketClaims = {
  typ: 'tv_link_ticket';
  sub: string;
  sid: string;
  did: string;
  epoch: number;
  role: 'tv' | 'remote';
  name: string | null;
  exp: number;
};

const SCHEMAS = {
  ticket: {
    role: oneOf(['tv', 'remote']),
    device_name: text({ max: 40, optional: true }),
  },
  command: {
    device_id: text(ID),
    command: oneOf(['play', 'pause', 'resume', 'stop', 'seek']),
    episode_id: text({ ...ID, optional: true }),
    child_id: text({ ...ID, optional: true }),
    position_ms: integer({ min: 0, max: 24 * 3600_000, optional: true }),
    delta_ms: integer({ min: -3600_000, max: 3600_000, optional: true }),
    from: text({ max: 40, optional: true }),
  },
} satisfies Record<string, BodySchema>;

function linkStub(env: Env, parentId: string) {
  const namespace = env.FAMILY_LINK!;
  return namespace.get(namespace.idFromName(parentId));
}

function unavailable() {
  return Response.json({ success: false, error: 'TV remote is not available' }, { status: 503 });
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

async function principal(env: Env, authorization: string | undefined) {
  if (!authIsConfigured(env) || !env.FAMILY_LINK) return { ok: false as const, response: unavailable() };
  const auth = await authenticateParent(env, authorization);
  if (!auth.ok) return { ok: false as const, response: unauthorized(auth.reason) };
  return { ok: true as const, principal: auth.principal };
}

export async function createLinkTicket(env: Env, p: ParentPrincipal, role: 'tv' | 'remote', name: string | null) {
  return createSignedToken({
    typ: 'tv_link_ticket',
    sub: p.parentId,
    sid: p.sessionId,
    did: p.deviceId,
    epoch: p.authEpoch,
    role,
    name,
    exp: Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS,
  } satisfies TicketClaims, env.AUTH_TOKEN_SECRET!);
}

tvLinkRoute.post('/ticket', async (c) => {
  const auth = await principal(c.env, c.req.header('Authorization'));
  if (!auth.ok) return auth.response;
  const parsed = await bodyOr400<{ role: 'tv' | 'remote'; device_name?: string }>(c, SCHEMAS.ticket);
  if (!parsed.ok) return parsed.response;
  const ticket = await createLinkTicket(c.env, auth.principal, parsed.value.role, parsed.value.device_name?.trim() || null);
  return c.json({ success: true, data: { ticket, expires_in: TICKET_TTL_SECONDS } });
});

tvLinkRoute.get('/connect', async (c) => {
  if (!authIsConfigured(c.env) || !c.env.FAMILY_LINK) return unavailable();
  if (c.req.header('Upgrade')?.toLowerCase() !== 'websocket') {
    return c.json({ success: false, error: 'Expected a WebSocket upgrade' }, 426);
  }
  const ticket = c.req.query('ticket');
  const claims = ticket && ticket.length <= 4096
    ? await verifySignedToken<TicketClaims>(ticket, [c.env.AUTH_TOKEN_SECRET, c.env.AUTH_TOKEN_SECRET_PREVIOUS])
    : null;
  const now = Math.floor(Date.now() / 1000);
  if (!claims || claims.typ !== 'tv_link_ticket' || typeof claims.exp !== 'number' || claims.exp <= now
    || claims.exp > now + TICKET_TTL_SECONDS + 5
    || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || typeof claims.did !== 'string'
    || !Number.isInteger(claims.epoch) || (claims.role !== 'tv' && claims.role !== 'remote')) {
    return unauthorized('unauthorized');
  }

  // The session must still be live now, not only when the ticket was issued.
  const resolved = await callDurable<Envelope<{ parent_id: string; session_id: string; device_id: string; auth_epoch: number }>>(
    familyStub(c.env, claims.sub), '/sessions/resolve',
    { body: { session_id: claims.sid, auth_epoch: claims.epoch } },
  );
  const session = resolved.ok && resolved.data?.success ? resolved.data.data : null;
  if (!session || session.parent_id !== claims.sub || session.device_id !== claims.did) {
    return unauthorized('unauthorized');
  }

  const headers = new Headers({
    Upgrade: 'websocket',
    'X-Link-Role': claims.role,
    'X-Link-Parent': claims.sub,
    'X-Link-Device': claims.did,
    'X-Link-Session': claims.sid,
    'X-Link-Epoch': String(claims.epoch),
  });
  if (claims.name) headers.set('X-Link-Name', encodeURIComponent(claims.name));
  return linkStub(c.env, claims.sub).fetch(new Request('https://durable.internal/connect', { headers }));
});

tvLinkRoute.post('/devices', async (c) => {
  const auth = await principal(c.env, c.req.header('Authorization'));
  if (!auth.ok) return auth.response;
  const listed = await callDurable<Envelope<Array<{ device_id: string }>>>(linkStub(c.env, auth.principal.parentId), '/devices', { body: {} });
  if (!listed.ok || !listed.data?.success) return unavailable();
  // A device never casts to itself.
  const devices = (listed.data.data ?? []).filter((d) => d.device_id !== auth.principal.deviceId);
  return c.json({ success: true, data: devices });
});

tvLinkRoute.post('/command', async (c) => {
  const auth = await principal(c.env, c.req.header('Authorization'));
  if (!auth.ok) return auth.response;
  const parsed = await bodyOr400<{
    device_id: string; command: string; episode_id?: string; child_id?: string;
    position_ms?: number; delta_ms?: number; from?: string;
  }>(c, SCHEMAS.command);
  if (!parsed.ok) return parsed.response;
  const value = parsed.value;
  const forward: Record<string, unknown> = { ...value };

  if (value.command === 'play') {
    if (!value.episode_id || !value.child_id) {
      return c.json({ success: false, error: 'episode_id and child_id are required' }, 400);
    }
    // The child must be one of this family's. The TV acts as that child, so an
    // id from another family must never reach it.
    const children = await callDurable<Envelope<Array<{ id: string; nickname: string }>>>(
      familyStub(c.env, auth.principal.parentId), '/children',
    );
    const child = children.data?.success ? children.data.data?.find((row) => row.id === value.child_id) : undefined;
    if (!children.ok || !children.data?.success) return unavailable();
    if (!child) return c.json({ success: false, error: 'Child not found', code: 'child_not_found' }, 404);
    forward.child_name = child.nickname;
  }

  const result = await linkStub(c.env, auth.principal.parentId).fetch(new Request('https://durable.internal/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(forward),
  }));
  return new Response(result.body, { status: result.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
});

export default tvLinkRoute;
