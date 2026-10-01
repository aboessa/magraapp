/**
 * Phone → television remote control for one family (`TV-002`).
 *
 * One object per family, addressed by parent id. Televisions that have the app
 * open hold a WebSocket here (`role: tv`); a phone showing the remote holds one
 * too (`role: remote`) so it hears the TV's state as it changes. Commands from a
 * phone arrive over HTTP (`/command`), are delivered to the TV's socket, and the
 * HTTP request waits briefly for the TV's acknowledgement so the phone can tell
 * the parent "playing" or "the child's screen time is over".
 *
 * ## Cost
 *
 * Sockets are accepted with the **Hibernation API** (`ctx.acceptWebSocket`), and
 * pings are answered by `setWebSocketAutoResponse` without waking the object.
 * An idle family therefore costs nothing while its TV sits on the home screen;
 * the object only runs when a command or a state change actually happens. Using
 * `ws.accept()` instead would bill wall-clock time for every connected minute.
 *
 * State that must survive hibernation — who is connected and what each TV is
 * playing — lives in each socket's serialized attachment, not in memory. The
 * only in-memory structure is the table of commands awaiting an ack, and that
 * exists only while the HTTP request that created it is in flight, which keeps
 * the object awake anyway.
 *
 * ## What is never sent
 *
 * A command carries content and child *ids*, never a URL or a media token. The
 * television requests its own playback session, so entitlement, parental rules,
 * screen time and the concurrent-stream limit are enforced for the TV exactly
 * as for any other playback.
 */

import type { Env } from '../lib/db.ts';

export type LinkRole = 'tv' | 'remote';

export type PlaybackState = {
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  episode_id: string | null;
  title: string | null;
  child_id: string | null;
  position_ms: number;
  duration_ms: number;
  updated_at: number;
};

type Attachment = {
  role: LinkRole;
  parentId: string;
  deviceId: string;
  sessionId: string;
  authEpoch: number;
  name: string | null;
  connectedAt: number;
  state: PlaybackState | null;
};

export const COMMANDS = ['play', 'pause', 'resume', 'stop', 'seek'] as const;
export type LinkCommand = typeof COMMANDS[number];

const STATUSES: readonly PlaybackState['status'][] = ['idle', 'loading', 'playing', 'paused', 'ended', 'error'];
const MAX_MESSAGE_BYTES = 4096;
/// A TV must open the player and obtain a playback session before it can say
/// "playing", so `play` gets longer than a pause.
const ACK_TIMEOUT_MS: Record<LinkCommand, number> = { play: 10_000, pause: 4_000, resume: 4_000, stop: 4_000, seek: 4_000 };
/// Application close codes (4000-4999 are ours).
export const CLOSE_REPLACED = 4000;
export const CLOSE_REVOKED = 4001;

type Envelope<T> = { success: boolean; data?: T; error?: string };

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function id(value: unknown, max = 128) {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function clampInt(value: unknown, max: number) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 0), max) : 0;
}

type Pending = { resolve: (ack: { ok: boolean; reason: string | null }) => void; deviceId: string };

export class FamilyLink {
  private readonly ctx: DurableObjectState;
  private readonly env: Env;
  private readonly pending = new Map<string, Pending>();

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
    // Answered by the runtime without waking the object: keep-alives are free.
    try {
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    } catch {
      // Not available outside the Workers runtime (tests).
    }
  }

  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/connect') return this.connect(request);
    if (request.method !== 'POST') return json({ success: false, error: 'Not found' }, 404);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return json({ success: false, error: 'Invalid request' }, 400);
    if (pathname === '/devices') return this.devices();
    if (pathname === '/command') return this.command(body);
    return json({ success: false, error: 'Not found' }, 404);
  }

  /* ------------------------------------------------------------ connections */

  private connect(request: Request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ success: false, error: 'Expected a WebSocket upgrade' }, 426);
    }
    const meta = this.metaFromHeaders(request.headers);
    if (!meta) return json({ success: false, error: 'Invalid connection' }, 400);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.register(server, meta);
    return new Response(null, { status: 101, webSocket: client });
  }

  /// The Worker authenticates the ticket and passes the principal in headers;
  /// the object is not reachable from outside, so these are trusted.
  private metaFromHeaders(headers: Headers): Omit<Attachment, 'connectedAt' | 'state'> | null {
    const role = headers.get('X-Link-Role');
    const parentId = id(headers.get('X-Link-Parent'));
    const deviceId = id(headers.get('X-Link-Device'));
    const sessionId = id(headers.get('X-Link-Session'));
    const authEpoch = Number(headers.get('X-Link-Epoch'));
    const rawName = headers.get('X-Link-Name');
    const name = rawName ? decodeURIComponent(rawName).slice(0, 40) : null;
    if ((role !== 'tv' && role !== 'remote') || !parentId || !deviceId || !sessionId || !Number.isInteger(authEpoch)) {
      return null;
    }
    return { role, parentId, deviceId, sessionId, authEpoch, name };
  }

  /// Accepts a socket. Public so tests can drive it without a `WebSocketPair`.
  register(ws: WebSocket, meta: Omit<Attachment, 'connectedAt' | 'state'>) {
    // One live socket per TV: a reconnect replaces the stale one rather than
    // leaving two entries in the phone's list.
    if (meta.role === 'tv') {
      for (const old of this.ctx.getWebSockets(`device:${meta.deviceId}`)) {
        try { old.close(CLOSE_REPLACED, 'replaced'); } catch { /* already closed */ }
      }
    }
    this.ctx.acceptWebSocket(ws, [meta.role, `device:${meta.deviceId}`]);
    const attachment: Attachment = { ...meta, connectedAt: Date.now(), state: null };
    ws.serializeAttachment(attachment);
    ws.send(JSON.stringify({ type: 'hello', role: meta.role, device_id: meta.deviceId }));
    if (meta.role === 'remote') {
      ws.send(JSON.stringify({ type: 'devices', devices: this.tvList() }));
    } else {
      this.broadcastDevices();
    }
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message) as Record<string, unknown>;
    } catch {
      return;
    }
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment || attachment.role !== 'tv') return; // Remotes only listen.

    if (data.type === 'state') {
      const state = this.sanitizeState(data);
      if (!state) return;
      ws.serializeAttachment({ ...attachment, state });
      this.broadcast('remote', { type: 'state', device_id: attachment.deviceId, name: attachment.name, state });
      return;
    }

    if (data.type === 'ack') {
      const commandId = id(data.command_id);
      const waiter = commandId ? this.pending.get(commandId) : undefined;
      // An ack only resolves a command addressed to *this* TV.
      if (!waiter || waiter.deviceId !== attachment.deviceId) return;
      this.pending.delete(commandId!);
      waiter.resolve({
        ok: data.ok === true,
        reason: typeof data.reason === 'string' ? data.reason.slice(0, 64) : null,
      });
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.forget(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.forget(ws);
  }

  private forget(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment?.role === 'tv') this.broadcastDevices(ws);
  }

  private sanitizeState(data: Record<string, unknown>): PlaybackState | null {
    const status = data.status as PlaybackState['status'];
    if (!STATUSES.includes(status)) return null;
    return {
      status,
      episode_id: id(data.episode_id),
      title: typeof data.title === 'string' ? data.title.slice(0, 120) : null,
      child_id: id(data.child_id),
      position_ms: clampInt(data.position_ms, 24 * 3600_000),
      duration_ms: clampInt(data.duration_ms, 24 * 3600_000),
      updated_at: Date.now(),
    };
  }

  /* ------------------------------------------------------------- presence */

  private tvSockets(except?: WebSocket) {
    return this.ctx.getWebSockets('tv').filter((ws) => ws !== except && ws.readyState !== 3 /* CLOSED */);
  }

  private tvList(except?: WebSocket) {
    const seen = new Set<string>();
    const list: Array<{ device_id: string; name: string | null; connected_at: number; state: PlaybackState | null }> = [];
    for (const ws of this.tvSockets(except)) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (!a || seen.has(a.deviceId)) continue;
      seen.add(a.deviceId);
      list.push({ device_id: a.deviceId, name: a.name, connected_at: a.connectedAt, state: a.state });
    }
    return list;
  }

  private broadcast(tag: LinkRole, payload: unknown) {
    const text = JSON.stringify(payload);
    for (const ws of this.ctx.getWebSockets(tag)) {
      try { ws.send(text); } catch { /* closing */ }
    }
  }

  private broadcastDevices(except?: WebSocket) {
    this.broadcast('remote', { type: 'devices', devices: this.tvList(except) });
  }

  private devices() {
    return json({ success: true, data: this.tvList() });
  }

  /* ------------------------------------------------------------- commands */

  /// Is the TV's session still the one it connected with? A TV removed from the
  /// devices screen, or signed out by a password change, must stop taking
  /// commands at once rather than when its socket happens to drop.
  private async sessionIsLive(a: Attachment) {
    try {
      const stub = this.env.FAMILY_STATE.get(this.env.FAMILY_STATE.idFromName(a.parentId));
      const response = await stub.fetch(new Request('https://durable.internal/sessions/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: a.sessionId, auth_epoch: a.authEpoch }),
      }));
      const payload = await response.json().catch(() => null) as Envelope<{ device_id: string }> | null;
      return response.ok && payload?.success === true && payload.data?.device_id === a.deviceId;
    } catch {
      return false;
    }
  }

  private async command(body: Record<string, unknown>) {
    const deviceId = id(body.device_id);
    const command = body.command as LinkCommand;
    if (!deviceId || !COMMANDS.includes(command)) {
      return json({ success: false, error: 'Invalid command' }, 400);
    }

    const target = this.tvSockets().find((ws) => (ws.deserializeAttachment() as Attachment | null)?.deviceId === deviceId);
    const attachment = target?.deserializeAttachment() as Attachment | null | undefined;
    if (!target || !attachment) {
      return json({ success: false, error: 'The TV is not connected', code: 'tv_offline' }, 404);
    }
    if (!await this.sessionIsLive(attachment)) {
      try { target.close(CLOSE_REVOKED, 'session ended'); } catch { /* already closed */ }
      this.broadcastDevices(target);
      return json({ success: false, error: 'The TV is not connected', code: 'tv_offline' }, 404);
    }

    const commandId = crypto.randomUUID();
    const message: Record<string, unknown> = { type: 'command', command_id: commandId, command };
    if (command === 'play') {
      message.episode_id = body.episode_id;
      message.child_id = body.child_id;
      message.child_name = body.child_name ?? null;
      message.position_ms = clampInt(body.position_ms, 24 * 3600_000);
      message.from = typeof body.from === 'string' ? body.from.slice(0, 40) : null;
    }
    if (command === 'seek') {
      if (body.position_ms !== undefined) message.position_ms = clampInt(body.position_ms, 24 * 3600_000);
      if (body.delta_ms !== undefined) {
        const delta = Math.trunc(Number(body.delta_ms));
        if (Number.isFinite(delta) && Math.abs(delta) <= 3600_000) message.delta_ms = delta;
      }
      if (message.position_ms === undefined && message.delta_ms === undefined) {
        return json({ success: false, error: 'Invalid command' }, 400);
      }
    }

    const ack = new Promise<{ ok: boolean; reason: string | null } | null>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(commandId);
        resolve(null);
      }, ACK_TIMEOUT_MS[command]);
      this.pending.set(commandId, {
        deviceId,
        resolve: (value) => { clearTimeout(timer); resolve(value); },
      });
    });

    try {
      target.send(JSON.stringify(message));
    } catch {
      this.pending.delete(commandId);
      return json({ success: false, error: 'The TV is not connected', code: 'tv_offline' }, 404);
    }

    const result = await ack;
    if (!result) {
      return json({ success: false, error: 'The TV did not answer', code: 'tv_timeout' }, 504);
    }
    if (!result.ok) {
      return json({ success: false, error: 'The TV refused the command', code: result.reason ?? 'tv_refused' }, 409);
    }
    return json({ success: true, data: { delivered: true, command_id: commandId } });
  }
}
