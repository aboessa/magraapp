import type { Env } from '../lib/db';
import { boundedInteger, deriveAgeTrack, isPlan, normalizeTracks, PLAN_LIMITS, planAllows, type AgeTrack, type Plan } from '../lib/familyPolicy';

type FamilyRow = {
  parent_id: string;
  display_name: string | null;
  status: 'active' | 'suspended';
  base_plan: Plan;
  auth_epoch: number;
};

type SessionRow = {
  id: string;
  device_id: string;
  auth_epoch: number;
  expires_at: number;
};

type FamilyEvent = {
  eventId: string;
  type: string;
  schemaVersion: number;
  parentId: string;
  occurredAt: number;
  payload: Record<string, unknown>;
};

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export class FamilyState {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private readonly sql: SqlStorage;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sql = state.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS family (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        parent_id TEXT NOT NULL UNIQUE,
        display_name TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
        base_plan TEXT NOT NULL DEFAULT 'free' CHECK (base_plan IN ('free', 'family', 'family_plus')),
        auth_epoch INTEGER NOT NULL DEFAULT 1 CHECK (auth_epoch >= 1),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS children (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        birth_month INTEGER NOT NULL,
        birth_year INTEGER NOT NULL,
        age_track TEXT NOT NULL CHECK (age_track IN ('preschool', 'kids', 'junior')),
        avatar_id TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'ar',
        interests_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS parental_settings (
        child_id TEXT PRIMARY KEY,
        settings_json TEXT NOT NULL DEFAULT '{}',
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        installation_id_hash TEXT NOT NULL UNIQUE,
        display_name TEXT,
        platform TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
        registered_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        auth_epoch INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        revoked_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS used_refresh_tokens (
        token_hash TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS entitlements (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        provider_purchase_id TEXT,
        plan TEXT NOT NULL CHECK (plan IN ('free', 'family', 'family_plus')),
        status TEXT NOT NULL CHECK (status IN ('active', 'grace', 'expired', 'revoked')),
        starts_at INTEGER NOT NULL,
        expires_at INTEGER,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS content_progress (
        child_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_id TEXT NOT NULL,
        position_ms INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
        device_id TEXT NOT NULL,
        sequence INTEGER NOT NULL DEFAULT 0,
        event_id TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (child_id, content_type, content_id)
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        episode_id TEXT,
        objective_id TEXT,
        score INTEGER,
        max_score INTEGER,
        answers_json TEXT NOT NULL DEFAULT '[]',
        time_spent_seconds INTEGER NOT NULL DEFAULT 0,
        help_used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS mastery (
        child_id TEXT NOT NULL,
        objective_id TEXT NOT NULL,
        level TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        correct_attempts INTEGER NOT NULL DEFAULT 0,
        last_attempt_at INTEGER,
        PRIMARY KEY (child_id, objective_id)
      );
      CREATE TABLE IF NOT EXISTS favorites (
        child_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (child_id, entity_type, entity_id)
      );
      CREATE TABLE IF NOT EXISTS playback_leases (
        id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'revoked', 'expired')),
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        last_heartbeat_at INTEGER NOT NULL,
        ended_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        response_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS outbox (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent')),
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        sent_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_children_status ON children(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status, last_seen_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_active ON auth_sessions(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_leases_active ON playback_leases(status, expires_at);
      CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status, available_at, created_at);
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (request.method === 'POST' && path === '/initialize') return this.initialize(request);
      if (request.method === 'POST' && path === '/sessions/create') return this.createSession(request);
      if (request.method === 'POST' && path === '/sessions/resolve') return this.resolveSession(request);
      if (request.method === 'POST' && path === '/sessions/refresh') return this.refreshSession(request);
      if (request.method === 'POST' && path === '/sessions/logout') return this.logout(request);
      if (request.method === 'GET' && path === '/children') return this.getChildren();
      if (request.method === 'POST' && path === '/children') return this.addChild(request);
      if (request.method === 'POST' && path === '/progress') return this.updateProgress(request);
      if (request.method === 'POST' && path === '/favorites') return this.updateFavorite(request);
      if (request.method === 'GET' && path === '/devices') return this.getDevices();
      if (request.method === 'POST' && path === '/devices/revoke') return this.revokeDevice(request);
      if (request.method === 'POST' && path === '/playback/start') return this.startPlayback(request);
      if (request.method === 'POST' && path === '/playback/heartbeat') return this.heartbeatPlayback(request);
      if (request.method === 'POST' && path === '/playback/end') return this.endPlayback(request);
      if (request.method === 'POST' && path === '/entitlements/apply') return this.applyEntitlement(request);
      if (request.method === 'GET' && path === '/state') return this.getState();
      return json({ success: false, error: 'Family operation not found' }, 404);
    } catch (error) {
      console.error('family_do_error', error instanceof Error ? error.message : String(error));
      return json({ success: false, error: 'Family service unavailable' }, 500);
    }
  }

  async alarm() {
    const queue = this.env.FAMILY_EVENTS;
    if (!queue) return;
    const rows = this.sql.exec<{ event_id: string; event_type: string; payload_json: string; created_at: number }>(`
      SELECT event_id, event_type, payload_json, created_at
      FROM outbox
      WHERE status = 'pending' AND available_at <= ?
      ORDER BY created_at ASC
      LIMIT 100
    `, Date.now()).toArray();
    if (!rows.length) return;

    try {
      await queue.sendBatch(rows.map((row) => ({ body: JSON.parse(row.payload_json) as FamilyEvent })));
      const now = Date.now();
      this.state.storage.transactionSync(() => {
        for (const row of rows) {
          this.sql.exec(`UPDATE outbox SET status = 'sent', sent_at = ? WHERE event_id = ? AND status = 'pending'`, now, row.event_id);
        }
        this.sql.exec(`DELETE FROM outbox WHERE status = 'sent' AND sent_at < ?`, now - 7 * 24 * 60 * 60 * 1000);
        this.sql.exec(`DELETE FROM idempotency_keys WHERE expires_at < ?`, now);
        this.sql.exec(`DELETE FROM used_refresh_tokens WHERE expires_at < ?`, now);
      });
    } catch (error) {
      const retryAt = Date.now() + 30_000;
      this.state.storage.transactionSync(() => {
        for (const row of rows) {
          this.sql.exec(`UPDATE outbox SET attempts = attempts + 1, available_at = ? WHERE event_id = ?`, retryAt, row.event_id);
        }
      });
      await this.state.storage.setAlarm(retryAt);
      throw error;
    }

    const remaining = this.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM outbox WHERE status = 'pending'`).toArray()[0]?.count ?? 0;
    if (remaining > 0) await this.state.storage.setAlarm(Date.now() + 1000);
  }

  private family(): FamilyRow | null {
    return this.sql.exec<FamilyRow>('SELECT parent_id, display_name, status, base_plan, auth_epoch FROM family WHERE singleton = 1').toArray()[0] ?? null;
  }

  private currentPlan(now = Date.now()): Plan {
    const paid = this.sql.exec<{ plan: string }>(`
      SELECT plan FROM entitlements
      WHERE status IN ('active', 'grace') AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY CASE plan WHEN 'family_plus' THEN 2 WHEN 'family' THEN 1 ELSE 0 END DESC
      LIMIT 1
    `, now).toArray()[0]?.plan;
    if (isPlan(paid)) return paid;
    return this.family()?.base_plan ?? 'free';
  }

  private activeSession(sessionId: string, now = Date.now()): SessionRow | null {
    const family = this.family();
    if (!family || family.status !== 'active') return null;
    return this.sql.exec<SessionRow>(`
      SELECT s.id, s.device_id, s.auth_epoch, s.expires_at
      FROM auth_sessions s JOIN devices d ON d.id = s.device_id
      WHERE s.id = ? AND s.status = 'active' AND s.expires_at > ?
        AND s.auth_epoch = ? AND d.status = 'active'
    `, sessionId, now, family.auth_epoch).toArray()[0] ?? null;
  }

  private addOutbox(type: string, payload: Record<string, unknown>, eventId = crypto.randomUUID()) {
    const family = this.family();
    if (!family) throw new Error('family_not_initialized');
    const event: FamilyEvent = {
      eventId,
      type,
      schemaVersion: 1,
      parentId: family.parent_id,
      occurredAt: Date.now(),
      payload,
    };
    this.sql.exec(`
      INSERT OR IGNORE INTO outbox (event_id, event_type, payload_json, available_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, eventId, type, JSON.stringify(event), event.occurredAt, event.occurredAt);
    return eventId;
  }

  private async scheduleOutbox() {
    if (!this.env.FAMILY_EVENTS) return;
    const existing = await this.state.storage.getAlarm();
    if (existing === null) await this.state.storage.setAlarm(Date.now() + 1000);
  }

  private async initialize(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.slice(0, 80) : null;
    const identityEpoch = boundedInteger(body.identity_epoch, 1, Number.MAX_SAFE_INTEGER);
    if (!parentId || identityEpoch === null) return json({ success: false, error: 'parent_id and identity_epoch are required' }, 400);
    const existing = this.family();
    if (existing && existing.parent_id !== parentId) return json({ success: false, error: 'Family identity conflict' }, 409);
    if (!existing) {
      const now = Date.now();
      this.state.storage.transactionSync(() => {
        this.sql.exec(`
          INSERT INTO family (singleton, parent_id, display_name, auth_epoch, created_at, updated_at)
          VALUES (1, ?, ?, ?, ?, ?)
        `, parentId, displayName, identityEpoch, now, now);
        this.addOutbox('family.initialized', { displayName, plan: 'free' });
      });
      await this.scheduleOutbox();
    }
    const family = this.family()!;
    return json({ success: true, data: { parent_id: family.parent_id, plan: this.currentPlan(), auth_epoch: family.auth_epoch } });
  }

  private async createSession(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const refreshHash = typeof body.refresh_token_hash === 'string' ? body.refresh_token_hash : '';
    const installationHash = typeof body.installation_id_hash === 'string' ? body.installation_id_hash : '';
    const platform = typeof body.platform === 'string' ? body.platform : '';
    const displayName = typeof body.device_name === 'string' ? body.device_name.slice(0, 80) : null;
    const expiresAt = boundedInteger(body.expires_at, Date.now() + 60_000, Date.now() + 90 * 24 * 60 * 60 * 1000);
    const family = this.family();
    if (!family || !sessionId || !refreshHash || !installationHash || !platform || expiresAt === null) {
      return json({ success: false, error: 'Invalid session request' }, 400);
    }

    const now = Date.now();
    const plan = this.currentPlan(now);
    const existingDevice = this.sql.exec<{ id: string; status: string }>(`
      SELECT id, status FROM devices WHERE installation_id_hash = ?
    `, installationHash).toArray()[0];
    if (existingDevice?.status === 'revoked') return json({ success: false, error: 'Device is revoked' }, 403);
    const activeDevices = this.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM devices WHERE status = 'active'`).toArray()[0]?.count ?? 0;
    if (!existingDevice && activeDevices >= PLAN_LIMITS[plan].devices) {
      return json({ success: false, error: 'This account has reached its device limit' }, 403);
    }

    const deviceId = existingDevice?.id ?? crypto.randomUUID();
    this.state.storage.transactionSync(() => {
      if (existingDevice) {
        this.sql.exec(`UPDATE devices SET display_name = COALESCE(?, display_name), last_seen_at = ? WHERE id = ?`, displayName, now, deviceId);
      } else {
        this.sql.exec(`
          INSERT INTO devices (id, installation_id_hash, display_name, platform, registered_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `, deviceId, installationHash, displayName, platform, now, now);
      }
      this.sql.exec(`
        INSERT INTO auth_sessions (
          id, device_id, refresh_token_hash, auth_epoch, expires_at, created_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, sessionId, deviceId, refreshHash, family.auth_epoch, expiresAt, now, now);
      this.addOutbox('session.created', { sessionId, deviceId, platform });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { session_id: sessionId, device_id: deviceId, plan, auth_epoch: family.auth_epoch, expires_at: expiresAt } }, 201);
  }

  private async resolveSession(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const expectedEpoch = boundedInteger(body.auth_epoch, 1, Number.MAX_SAFE_INTEGER);
    const session = this.activeSession(sessionId);
    const family = this.family();
    if (!session || !family || expectedEpoch === null || session.auth_epoch !== expectedEpoch) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    this.sql.exec(`UPDATE auth_sessions SET last_seen_at = ? WHERE id = ?`, Date.now(), sessionId);
    return json({ success: true, data: { parent_id: family.parent_id, session_id: session.id, device_id: session.device_id, plan: this.currentPlan(), auth_epoch: family.auth_epoch } });
  }

  private async refreshSession(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const currentHash = typeof body.current_hash === 'string' ? body.current_hash : '';
    const nextHash = typeof body.next_hash === 'string' ? body.next_hash : '';
    const now = Date.now();
    const family = this.family();
    const session = this.sql.exec<SessionRow & { refresh_token_hash: string; status: string }>(`
      SELECT id, device_id, auth_epoch, expires_at, refresh_token_hash, status FROM auth_sessions WHERE id = ?
    `, sessionId).toArray()[0];
    if (!family || !session || session.status !== 'active' || session.expires_at <= now || session.auth_epoch !== family.auth_epoch) {
      return json({ success: false, error: 'Refresh token is invalid or expired' }, 401);
    }

    if (session.refresh_token_hash !== currentHash) {
      const reused = this.sql.exec<{ session_id: string }>(`
        SELECT session_id FROM used_refresh_tokens WHERE token_hash = ? AND expires_at > ?
      `, currentHash, now).toArray()[0];
      if (reused?.session_id === sessionId) {
        this.revokeSession(sessionId, now);
        await this.scheduleOutbox();
      }
      return json({ success: false, error: 'Refresh token is invalid or expired' }, 401);
    }

    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        INSERT INTO used_refresh_tokens (token_hash, session_id, expires_at, used_at)
        VALUES (?, ?, ?, ?)
      `, currentHash, sessionId, session.expires_at, now);
      this.sql.exec(`
        UPDATE auth_sessions SET refresh_token_hash = ?, last_seen_at = ?
        WHERE id = ? AND status = 'active'
      `, nextHash, now, sessionId);
    });
    return json({ success: true, data: { session_id: sessionId, device_id: session.device_id, plan: this.currentPlan(), auth_epoch: family.auth_epoch, expires_at: session.expires_at } });
  }

  private revokeSession(sessionId: string, now = Date.now()) {
    this.state.storage.transactionSync(() => {
      this.sql.exec(`UPDATE auth_sessions SET status = 'revoked', revoked_at = ? WHERE id = ? AND status = 'active'`, now, sessionId);
      this.sql.exec(`UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE session_id = ? AND status = 'active'`, now, sessionId);
      this.addOutbox('session.revoked', { sessionId });
    });
  }

  private async logout(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    this.revokeSession(sessionId);
    await this.scheduleOutbox();
    return json({ success: true, data: { logged_out: true } });
  }

  private async getChildren() {
    const rows = this.sql.exec<{
      id: string; nickname: string; birth_month: number; birth_year: number; age_track: AgeTrack;
      avatar_id: string; language: string; interests_json: string; status: string;
    }>(`SELECT * FROM children WHERE status = 'active' ORDER BY created_at`).toArray();
    return json({ success: true, data: rows.map((row) => ({ ...row, interests: JSON.parse(row.interests_json) })) });
  }

  private async addChild(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const nickname = typeof body.nickname === 'string' ? body.nickname.trim().slice(0, 40) : '';
    const birthMonth = boundedInteger(body.birth_month, 1, 12);
    const birthYear = boundedInteger(body.birth_year, 1900, new Date().getUTCFullYear());
    const avatarId = typeof body.avatar_id === 'string' ? body.avatar_id.slice(0, 100) : '';
    const language = typeof body.language === 'string' ? body.language.slice(0, 10) : 'ar';
    const interests = Array.isArray(body.interests) ? body.interests.slice(0, 30) : [];
    if (!this.activeSession(sessionId) || !nickname || birthMonth === null || birthYear === null || !avatarId) {
      return json({ success: false, error: 'Invalid child profile' }, 400);
    }
    const track = deriveAgeTrack(birthMonth, birthYear);
    if (!track) return json({ success: false, error: 'Child must be between 3 and 12 years old' }, 400);
    const plan = this.currentPlan();
    const count = this.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM children WHERE status = 'active'`).toArray()[0]?.count ?? 0;
    if (count >= PLAN_LIMITS[plan].children) return json({ success: false, error: 'Child profile limit reached' }, 403);

    const childId = crypto.randomUUID();
    const now = Date.now();
    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        INSERT INTO children (
          id, nickname, birth_month, birth_year, age_track, avatar_id, language,
          interests_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, childId, nickname, birthMonth, birthYear, track, avatarId, language, JSON.stringify(interests), now, now);
      this.addOutbox('child.created', {
        childId,
        nickname,
        ageTrack: track,
        avatarId,
        language,
      });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { id: childId, nickname, age_track: track } }, 201);
  }

  private child(childId: string): { id: string; age_track: AgeTrack } | null {
    return this.sql.exec<{ id: string; age_track: AgeTrack }>(`
      SELECT id, age_track FROM children WHERE id = ? AND status = 'active'
    `, childId).toArray()[0] ?? null;
  }

  private async updateProgress(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const childId = typeof body.child_id === 'string' ? body.child_id : '';
    const contentId = typeof body.content_id === 'string' ? body.content_id : '';
    const contentType = typeof body.content_type === 'string' ? body.content_type : '';
    const eventId = typeof body.event_id === 'string' ? body.event_id : '';
    const positionMs = boundedInteger(body.position_ms, 0, Number.MAX_SAFE_INTEGER);
    const durationMs = boundedInteger(body.duration_ms, 0, Number.MAX_SAFE_INTEGER);
    const sequence = boundedInteger(body.sequence, 0, Number.MAX_SAFE_INTEGER) ?? 0;
    const session = this.activeSession(sessionId);
    if (!session || !this.child(childId) || !contentId || !contentType || !eventId || positionMs === null || durationMs === null) {
      return json({ success: false, error: 'Invalid progress update' }, 400);
    }

    const cached = this.sql.exec<{ response_json: string }>(`
      SELECT response_json FROM idempotency_keys WHERE key = ? AND operation = 'progress' AND expires_at > ?
    `, eventId, Date.now()).toArray()[0];
    if (cached) return json(JSON.parse(cached.response_json));

    const previous = this.sql.exec<{ sequence: number; position_ms: number; completed: number }>(`
      SELECT sequence, position_ms, completed FROM content_progress
      WHERE child_id = ? AND content_type = ? AND content_id = ?
    `, childId, contentType, contentId).toArray()[0];
    const accepted = !previous || sequence > previous.sequence || (sequence === previous.sequence && positionMs >= previous.position_ms);
    const completed = Boolean(previous?.completed) || Boolean(body.completed) || (durationMs > 0 && positionMs / durationMs >= 0.9);
    const response = { success: true, data: { accepted, completed } };
    const now = Date.now();

    this.state.storage.transactionSync(() => {
      if (accepted) {
        this.sql.exec(`
          INSERT INTO content_progress (
            child_id, content_type, content_id, position_ms, duration_ms, completed,
            device_id, sequence, event_id, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(child_id, content_type, content_id) DO UPDATE SET
            position_ms = excluded.position_ms,
            duration_ms = MAX(content_progress.duration_ms, excluded.duration_ms),
            completed = MAX(content_progress.completed, excluded.completed),
            device_id = excluded.device_id,
            sequence = excluded.sequence,
            event_id = excluded.event_id,
            updated_at = excluded.updated_at
        `, childId, contentType, contentId, positionMs, durationMs, completed ? 1 : 0, session.device_id, sequence, eventId, now);
        this.recordAttempt(body, childId, contentId, now);
        this.addOutbox(completed ? 'content.completed' : 'progress.updated', {
          childId, contentType, contentId, positionMs, durationMs, completed, sequence,
        }, eventId);
      }
      this.sql.exec(`
        INSERT INTO idempotency_keys (key, operation, response_json, expires_at)
        VALUES (?, 'progress', ?, ?)
      `, eventId, JSON.stringify(response), now + 7 * 24 * 60 * 60 * 1000);
    });
    if (accepted) await this.scheduleOutbox();
    return json(response);
  }

  private recordAttempt(body: Record<string, unknown>, childId: string, episodeId: string, now: number) {
    if (body.answers === undefined) return;
    const score = boundedInteger(body.score, 0, Number.MAX_SAFE_INTEGER);
    const maxScore = boundedInteger(body.max_score, 1, Number.MAX_SAFE_INTEGER);
    const timeSpent = boundedInteger(body.time_spent, 0, Number.MAX_SAFE_INTEGER) ?? 0;
    const objectiveId = typeof body.objective_id === 'string' ? body.objective_id : null;
    if (score === null || maxScore === null || score > maxScore) throw new Error('invalid_attempt');
    const passed = score / maxScore >= 0.5;
    this.sql.exec(`
      INSERT INTO attempts (
        id, child_id, episode_id, objective_id, score, max_score, answers_json,
        time_spent_seconds, help_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, crypto.randomUUID(), childId, episodeId, objectiveId, score, maxScore, JSON.stringify(body.answers), timeSpent, body.help_used === true ? 1 : 0, now);
    if (objectiveId) {
      this.sql.exec(`
        INSERT INTO mastery (child_id, objective_id, level, attempts, correct_attempts, last_attempt_at)
        VALUES (?, ?, ?, 1, ?, ?)
        ON CONFLICT(child_id, objective_id) DO UPDATE SET
          attempts = mastery.attempts + 1,
          correct_attempts = mastery.correct_attempts + excluded.correct_attempts,
          level = CASE
            WHEN mastery.correct_attempts + excluded.correct_attempts >= 3 THEN 'independent'
            WHEN mastery.correct_attempts + excluded.correct_attempts >= 1 THEN 'practicing'
            ELSE 'introduced'
          END,
          last_attempt_at = excluded.last_attempt_at
      `, childId, objectiveId, passed ? 'practicing' : 'introduced', passed ? 1 : 0, now);
    }
  }

  private async updateFavorite(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const childId = typeof body.child_id === 'string' ? body.child_id : '';
    const entityType = typeof body.entity_type === 'string' ? body.entity_type : '';
    const entityId = typeof body.entity_id === 'string' ? body.entity_id : '';
    const action = body.action === 'remove' ? 'remove' : 'add';
    if (!this.activeSession(sessionId) || !this.child(childId) || !entityType || !entityId) {
      return json({ success: false, error: 'Invalid favorite update' }, 400);
    }
    this.state.storage.transactionSync(() => {
      if (action === 'add') {
        this.sql.exec(`INSERT OR IGNORE INTO favorites (child_id, entity_type, entity_id, created_at) VALUES (?, ?, ?, ?)`, childId, entityType, entityId, Date.now());
      } else {
        this.sql.exec(`DELETE FROM favorites WHERE child_id = ? AND entity_type = ? AND entity_id = ?`, childId, entityType, entityId);
      }
      this.addOutbox('favorite.updated', { childId, entityType, entityId, action });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { action } });
  }

  private async startPlayback(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const childId = typeof body.child_id === 'string' ? body.child_id : '';
    const assetId = typeof body.asset_id === 'string' ? body.asset_id : '';
    const entityId = typeof body.entity_id === 'string' ? body.entity_id : '';
    const entityType = typeof body.entity_type === 'string' ? body.entity_type : '';
    const requiredPlan = isPlan(body.required_plan) ? body.required_plan : null;
    const allowedTracks = Array.isArray(body.allowed_tracks) ? body.allowed_tracks : [];
    const session = this.activeSession(sessionId);
    const child = this.child(childId);
    const plan = this.currentPlan();
    if (!session || !child || !assetId || !entityId || !entityType || !requiredPlan) {
      return json({ success: false, error: 'Playback request is invalid' }, 400);
    }
    if (!allowedTracks.includes(child.age_track)) return json({ success: false, error: 'Content is not available for this age track' }, 403);
    if (!planAllows(plan, requiredPlan)) return json({ success: false, error: 'An active subscription for this content tier is required' }, 403);

    const now = Date.now();
    this.sql.exec(`UPDATE playback_leases SET status = 'expired', ended_at = ? WHERE status = 'active' AND expires_at <= ?`, now, now);
    const active = this.sql.exec<{ count: number }>(`
      SELECT COUNT(*) AS count FROM playback_leases WHERE status = 'active' AND expires_at > ?
    `, now).toArray()[0]?.count ?? 0;
    if (active >= PLAN_LIMITS[plan].concurrentStreams) return json({ success: false, error: 'Concurrent stream limit reached' }, 429);

    const leaseId = crypto.randomUUID();
    const expiresAt = now + 15 * 60 * 1000;
    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        INSERT INTO playback_leases (
          id, child_id, device_id, session_id, asset_id, entity_type, entity_id,
          expires_at, created_at, last_heartbeat_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, leaseId, childId, session.device_id, sessionId, assetId, entityType, entityId, expiresAt, now, now);
      this.addOutbox('playback.started', { leaseId, childId, assetId, entityType, entityId, deviceId: session.device_id });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { lease_id: leaseId, expires_at: expiresAt, plan } }, 201);
  }

  private async heartbeatPlayback(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const leaseId = typeof body.lease_id === 'string' ? body.lease_id : '';
    const requiredPlan = isPlan(body.required_plan) ? body.required_plan : null;
    const allowedTracks = normalizeTracks(body.allowed_tracks);
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    if (!requiredPlan || !allowedTracks) return json({ success: false, error: 'Playback policy is required' }, 400);

    const now = Date.now();
    const lease = this.sql.exec<{ child_id: string; asset_id: string; entity_id: string }>(`
      SELECT child_id, asset_id, entity_id FROM playback_leases
      WHERE id = ? AND session_id = ? AND status = 'active' AND expires_at > ?
    `, leaseId, sessionId, now).toArray()[0];
    if (!lease) return json({ success: false, error: 'Playback lease is unavailable' }, 404);

    const child = this.child(lease.child_id);
    const plan = this.currentPlan(now);
    if (!child || !allowedTracks.includes(child.age_track) || !planAllows(plan, requiredPlan)) {
      this.state.storage.transactionSync(() => {
        this.sql.exec(`
          UPDATE playback_leases SET status = 'revoked', ended_at = ?
          WHERE id = ? AND session_id = ? AND status = 'active'
        `, now, leaseId, sessionId);
        this.addOutbox('playback.revoked', { leaseId, reason: 'policy_changed' });
      });
      await this.scheduleOutbox();
      return json({ success: false, error: 'Playback is no longer allowed' }, 403);
    }

    const expiresAt = now + 15 * 60 * 1000;
    const updated = this.sql.exec(`
      UPDATE playback_leases SET last_heartbeat_at = ?, expires_at = ?
      WHERE id = ? AND session_id = ? AND status = 'active' AND expires_at > ?
      RETURNING id
    `, now, expiresAt, leaseId, sessionId, now).toArray();
    if (!updated.length) return json({ success: false, error: 'Playback lease is unavailable' }, 404);
    return json({
      success: true,
      data: { lease_id: leaseId, expires_at: expiresAt, asset_id: lease.asset_id, entity_id: lease.entity_id },
    });
  }

  private async endPlayback(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const leaseId = typeof body.lease_id === 'string' ? body.lease_id : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    const now = Date.now();
    let ended = false;
    this.state.storage.transactionSync(() => {
      const updated = this.sql.exec(`
        UPDATE playback_leases SET status = 'ended', ended_at = ?
        WHERE id = ? AND session_id = ? AND status = 'active' RETURNING id
      `, now, leaseId, sessionId).toArray();
      ended = updated.length > 0;
      if (ended) this.addOutbox('playback.ended', { leaseId });
    });
    if (!ended) return json({ success: false, error: 'Playback lease is unavailable' }, 404);
    await this.scheduleOutbox();
    return json({ success: true, data: { ended: true } });
  }

  private async applyEntitlement(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id : '';
    const plan = isPlan(body.plan) ? body.plan : null;
    const status = typeof body.status === 'string' && ['active', 'grace', 'expired', 'revoked'].includes(body.status) ? body.status : null;
    const startsAt = boundedInteger(body.starts_at, 0, Number.MAX_SAFE_INTEGER);
    const expiresAt = body.expires_at === null ? null : boundedInteger(body.expires_at, 0, Number.MAX_SAFE_INTEGER);
    const observedAt = boundedInteger(body.observed_at, 1, Number.MAX_SAFE_INTEGER);
    if (!id || !plan || !status || startsAt === null || observedAt === null || (body.expires_at !== null && expiresAt === null)) {
      return json({ success: false, error: 'Invalid entitlement' }, 400);
    }
    const now = Date.now();
    this.state.storage.transactionSync(() => {
      // observed_at is the provider read time, so a slower older verification
      // response can never resurrect a revoked or expired entitlement.
      this.sql.exec(`
        INSERT INTO entitlements (id, source, provider_purchase_id, plan, status, starts_at, expires_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider_purchase_id = excluded.provider_purchase_id,
          plan = excluded.plan,
          status = excluded.status,
          starts_at = excluded.starts_at,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at
        WHERE excluded.updated_at >= entitlements.updated_at
      `, id, String(body.source ?? 'google_play'), body.provider_purchase_id ?? null, plan, status, startsAt, expiresAt, observedAt);
      const effectivePlan = this.currentPlan(now);
      this.addOutbox('entitlement.updated', {
        entitlementId: id, plan, status, expiresAt, effectivePlan, observedAt,
      });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { plan: this.currentPlan() } });
  }

  private async getDevices() {
    const rows = this.sql.exec<{
      id: string; installation_id_hash: string; display_name: string | null; platform: string; status: string; registered_at: number; last_seen_at: number;
    }>(`SELECT id, installation_id_hash, display_name, platform, status, registered_at, last_seen_at FROM devices ORDER BY last_seen_at DESC`).toArray();
    return json({ success: true, data: rows });
  }

  private async revokeDevice(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const deviceId = typeof body.device_id === 'string' ? body.device_id : '';
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    if (!deviceId) return json({ success: false, error: 'device_id is required' }, 400);
    const now = Date.now();
    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);
    // Revoke device and bump auth_epoch to invalidate all sessions on that device
    this.state.storage.transactionSync(() => {
      this.sql.exec(`UPDATE devices SET status = 'revoked', revoked_at = ? WHERE id = ? AND status = 'active'`, now, deviceId);
      this.sql.exec(`UPDATE auth_sessions SET status = 'revoked', revoked_at = ? WHERE device_id = ? AND status = 'active'`, now, deviceId);
      this.sql.exec(`UPDATE family SET auth_epoch = auth_epoch + 1, updated_at = ? WHERE singleton = 1`, now);
      this.sql.exec(`UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE device_id = ? AND status = 'active'`, now, deviceId);
      this.addOutbox('device.revoked', { deviceId });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { revoked: true } });
  }

  private async getState() {
    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);
    const children = this.sql.exec<{ id: string; nickname: string; age_track: string; avatar_id: string }>(`
      SELECT id, nickname, age_track, avatar_id FROM children WHERE status = 'active' ORDER BY created_at
    `).toArray();
    const progress = this.sql.exec(`
      SELECT child_id, content_type, content_id, position_ms, duration_ms, completed, updated_at
      FROM content_progress ORDER BY updated_at DESC LIMIT 50
    `).toArray();
    const favorites = this.sql.exec(`SELECT child_id, entity_type, entity_id, created_at FROM favorites ORDER BY created_at DESC LIMIT 100`).toArray();
    return json({ success: true, data: { family: { parent_id: family.parent_id, display_name: family.display_name, plan: this.currentPlan() }, children, progress, favorites } });
  }
}
