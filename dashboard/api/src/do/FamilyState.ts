import type { Env } from '../lib/db';
// امتدادات `.ts` صريحة: مجموعة الاختبارات تعمل بـ`node --experimental-strip-types`
// الذي يطالب بالامتداد في الاستيراد النسبي ولا يستنتجه كما يفعل مُجمِّع wrangler.
// بلا الامتداد لا يمكن استيراد هذا الكائن في اختبار إطلاقًا — وهو أكبر ملف منطق
// في المشروع وكان بلا أي تغطية.
import { boundedInteger, deriveAgeTrack, isPlan, normalizeTracks, PLAN_LIMITS, planAllows, type AgeTrack, type Plan } from '../lib/familyPolicy.ts';
import { hashPassword, verifyPassword } from '../lib/security.ts';
import {
  deriveMastery,
  isMasteryLevel,
  masteryCounters,
  type MasteryAttempt,
} from '../lib/mastery.ts';

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
        /* Game attempts are filed here rather than in episode_id. Declared on the
           table so a fresh object has the column outright; the ALTER below exists
           only for objects created before it. */
        game_id TEXT,
        content_type TEXT,
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
    // C2 — parent PIN gate (server-side). Added after Phase 0 without a D1
    // migration: existing DO instances need the column added in place.
    try { this.sql.exec(`ALTER TABLE family ADD COLUMN parent_pin_hash TEXT`); } catch {}
    try { this.sql.exec(`ALTER TABLE family ADD COLUMN parent_pin_failed_count INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { this.sql.exec(`ALTER TABLE family ADD COLUMN parent_pin_locked_until INTEGER`); } catch {}

    // Game attempts: `attempts` was created with `episode_id` only, and
    // `recordAttempt` was called with the game id in that column. D1's own
    // `attempts` table has both `episode_id` and `game_id` with
    // CHECK (episode_id IS NOT NULL OR game_id IS NOT NULL), so the DO and the
    // projection had diverged and per-game reporting was impossible.
    //
    // Added in place rather than by recreating the table: existing rows keep the
    // id they were written with, and `backfillGameAttempts` below moves the ones
    // that were games. Same pattern as the PIN columns above.
    try { this.sql.exec(`ALTER TABLE attempts ADD COLUMN game_id TEXT`); } catch {}
    try { this.sql.exec(`ALTER TABLE attempts ADD COLUMN content_type TEXT`); } catch {}

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_attempts_child_objective
        ON attempts(child_id, objective_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_attempts_child_game
        ON attempts(child_id, game_id, created_at);

      /* Rewards. The smallest primitive that satisfies the ~15 content specs
         promising a sticker in «مجموعتي», and nothing more: no currency, no
         random drops, no streaks, no expiry. A reward, once earned, is kept. */
      CREATE TABLE IF NOT EXISTS rewards (
        id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        reward_key TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        earned_at INTEGER NOT NULL,
        /* One reward per child per source. Finishing the same game twice is
           encouraged and must not mint a second sticker, which is what would
           turn a keepsake into a farmable currency. */
        UNIQUE (child_id, reward_key, source_type, source_id)
      );
      CREATE INDEX IF NOT EXISTS idx_rewards_child ON rewards(child_id, earned_at);

      /* Child creations. Metadata only: the image itself lives in the private
         creations bucket, and this row is what proves a family owns it. There is
         deliberately no title or caption column - no free text written by a
         child is stored anywhere. */
      CREATE TABLE IF NOT EXISTS child_creations (
        id TEXT PRIMARY KEY,
        child_id TEXT NOT NULL,
        game_id TEXT,
        drawing_mode TEXT NOT NULL,
        storage_key TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        byte_size INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        /* Soft delete so a deletion can be reconciled with the bucket before the
           row disappears; hard-deleting first would orphan the object. */
        deleted_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_creations_child
        ON child_creations(child_id, deleted_at, created_at);

      /* Object deletions still owed to the bucket.
         A row can be removed in one transaction while the R2 object survives a
         failed request, and a deleted row leaves nothing pointing at the object
         to retry from. This table is that pointer: it is written in the same
         transaction as the soft delete and drained afterwards, so "row gone,
         blob remains" is a recoverable state rather than a permanent leak. */
      CREATE TABLE IF NOT EXISTS creation_object_deletions (
        storage_key TEXT PRIMARY KEY,
        requested_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );

      /* Parental consent.
         D1 has a parental_consents table from migration 0001, but its parent_id is
         a foreign key to parents(id), and a parent account lives in the Durable
         Objects and is never written to that D1 table - so the constraint can never
         be satisfied and an insert there always fails with a 500. Consent is family
         state, this object is the authority for the family, and storing it here
         removes a cross-store key that cannot hold.
         (No backticks in this comment: it sits inside a JS template literal.) */
      CREATE TABLE IF NOT EXISTS consents (
        id TEXT PRIMARY KEY,
        consent_type TEXT NOT NULL,
        /* NULL means the whole family, so a parent answering for the household
           does not have to repeat it per profile. */
        child_id TEXT,
        version TEXT NOT NULL,
        granted_at INTEGER NOT NULL,
        /* Revoked rather than deleted: a withdrawal is itself a record, and
           deleting the row would make "never asked" and "said no" the same. */
        revoked_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_consents_type
        ON consents(consent_type, child_id, revoked_at);
    `);

    this.backfillGameAttempts();
  }

  /// Moves game attempts out of `episode_id` into `game_id`.
  ///
  /// Rows written before the column existed put the game id in `episode_id`,
  /// because that was the only column available. They are identified by their
  /// `objective_id` matching no episode-linked attempt and by `content_type`
  /// being absent; rather than guess, only rows the DO itself can attribute are
  /// moved, and the original value is left in place so nothing is lost.
  private backfillGameAttempts(): void {
    try {
      this.sql.exec(`
        UPDATE attempts
           SET game_id = episode_id,
               content_type = 'game'
         WHERE game_id IS NULL
           AND content_type IS NULL
           AND episode_id IS NOT NULL
           AND episode_id LIKE 'game-%'
      `);
    } catch {
      // A backfill failure must not stop the object from serving requests; the
      // rows remain readable under their original column either way.
    }
  }

  /**
   * موجّه الكائن.
   *
   * ## علّة كانت هنا: `catch` لا يمسك شيئًا
   *
   * كانت كل فروع التوجيه تُعيد وعد المعالِج مباشرةً داخل `try`:
   *
   *   try { return this.initialize(request) } catch { ... }
   *
   * و`return promise` بلا `await` **يخرج من نطاق `try` قبل أن يُرفَض الوعد**،
   * فالـ`catch` لا يُنفَّذ أبدًا. أي أن مُعالِج الأخطاء كان ميتًا: أي رفض داخل
   * أي معالِج — جسم JSON مشوّه، أو قيد قاعدة بيانات — يتسرّب من الكائن كخطأ
   * غير مُلتقَط بدل أن يصير `500` بمظروف مفهوم. والأسوأ أن رسالة الخطأ الداخلية
   * كانت تتسرّب للمتصل بدل أن تُحجب.
   *
   * الإصلاح `await` واحد. أُثبت الفرق بتجربة مباشرة:
   *
   *   return handler()        →  الرفض يتسرّب
   *   return await handler()  →  الـcatch يعمل
   *
   * الجدول يفصل التوجيه عن التنفيذ فيصير `await` واحدًا لا تسعة عشر، ولا يبقى
   * فرعٌ يُنسى.
   */
  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const key = `${request.method} ${path}`;

    // Handlers may be synchronous (`getChildren`, `getState`) or asynchronous.
    // The union is what lets both sit in one table; `await` below normalises them,
    // which is also what keeps the catch reachable.
    const routes: Record<string, (request: Request) => Response | Promise<Response>> = {
      'POST /initialize': (r) => this.initialize(r),
      'POST /sessions/create': (r) => this.createSession(r),
      'POST /sessions/resolve': (r) => this.resolveSession(r),
      'POST /sessions/refresh': (r) => this.refreshSession(r),
      'POST /sessions/logout': (r) => this.logout(r),
      'GET /children': () => this.getChildren(),
      'POST /children': (r) => this.addChild(r),
      'POST /progress': (r) => this.updateProgress(r),
      'POST /favorites': (r) => this.updateFavorite(r),
      'GET /devices': () => this.getDevices(),
      'POST /devices/revoke': (r) => this.revokeDevice(r),
      'POST /playback/start': (r) => this.startPlayback(r),
      'POST /playback/heartbeat': (r) => this.heartbeatPlayback(r),
      'POST /playback/end': (r) => this.endPlayback(r),
      'POST /entitlements/apply': (r) => this.applyEntitlement(r),
      'GET /billing/status': () => this.getBillingStatus(),
      'GET /state': () => this.getState(),
      'POST /parent-pin': (r) => this.setParentPin(r),
      'POST /parent-pin/verify': (r) => this.verifyParentPin(r),
      'POST /rewards': (r) => this.grantReward(r),
      'GET /rewards': () => this.listRewards(),
      'GET /mastery': () => this.listMastery(),
      'GET /consents': () => this.listConsents(),
      'POST /consents': (r) => this.writeConsent(r),
      'POST /creations': (r) => this.registerCreation(r),
      'GET /creations': () => this.listCreations(),
      'POST /creations/delete': (r) => this.deleteCreation(r),
      'POST /creations/purge': (r) => this.purgeCreations(r),
      'GET /creations/pending-deletions': () => this.pendingDeletions(),
      'POST /creations/deletions-settled': (r) => this.settleDeletions(r),
    };

    const handler = routes[key];
    if (!handler) return json({ success: false, error: 'Family operation not found' }, 404);

    try {
      // `await` لا `return` مجرّدًا: بدونه يخرج التنفيذ من نطاق try قبل الرفض.
      return await handler(request);
    } catch (error) {
      console.error('family_do_error', error instanceof Error ? error.message : String(error));
      // الرسالة الداخلية لا تُعاد للمتصل: قد تحمل نصّ استعلام أو قيمة قيد.
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

  /// `eventId` is typed as a plain string, not the template-literal type
  /// `crypto.randomUUID()` returns: callers pass the client's `event_id`, which is
  /// an opaque idempotency key rather than a guaranteed UUID.
  private addOutbox(type: string, payload: Record<string, unknown>, eventId: string = crypto.randomUUID()) {
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
        this.recordAttempt(body, childId, contentType, contentId, now);
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

  /// Records one attempt and re-derives mastery from the attempt history.
  ///
  /// ## Why `maxScore` may now be zero
  ///
  /// It was previously bounded at a minimum of 1, which made an unscored level
  /// impossible to report: colouring and free drawing have nothing to measure,
  /// and the engine reports 0 out of 0 for them. Rejecting that would have meant
  /// either dropping the attempt entirely — losing the fact that the child played
  /// — or inventing a score for a drawing, which the whole contract forbids. Zero
  /// is now allowed and is excluded from the accuracy calculation rather than
  /// counted as a failure.
  private recordAttempt(
    body: Record<string, unknown>,
    childId: string,
    contentType: string,
    contentId: string,
    now: number,
  ) {
    if (body.answers === undefined) return;
    const score = boundedInteger(body.score, 0, Number.MAX_SAFE_INTEGER);
    const maxScore = boundedInteger(body.max_score, 0, Number.MAX_SAFE_INTEGER);
    const timeSpent = boundedInteger(body.time_spent, 0, Number.MAX_SAFE_INTEGER) ?? 0;
    const objectiveId = typeof body.objective_id === 'string' ? body.objective_id : null;
    if (score === null || maxScore === null || score > maxScore) throw new Error('invalid_attempt');

    // A game attempt is filed under `game_id`; an episode attempt under
    // `episode_id`. Previously everything went into `episode_id`, so a game's
    // accuracy could not be reported at all. An explicit `game_id`/`episode_id`
    // in the body wins over the inference, so a game linked to an episode can
    // record both.
    const isGame = contentType === 'game';
    const gameId = typeof body.game_id === 'string'
      ? body.game_id
      : (isGame ? contentId : null);
    const episodeId = typeof body.episode_id === 'string'
      ? body.episode_id
      : (isGame ? null : contentId);

    this.sql.exec(`
      INSERT INTO attempts (
        id, child_id, episode_id, game_id, content_type, objective_id, score, max_score,
        answers_json, time_spent_seconds, help_used, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      crypto.randomUUID(), childId, episodeId, gameId, contentType, objectiveId,
      score, maxScore, JSON.stringify(body.answers), timeSpent,
      body.help_used === true ? 1 : 0, now,
    );

    if (!objectiveId) return;

    // Mastery is derived from the attempt history rather than accumulated into a
    // counter. A lifetime counter never forgets, so one strong run years ago
    // outweighed five recent failures and `needs_review` could never be reached.
    const history = this.sql.exec<{ score: number; max_score: number; help_used: number; created_at: number }>(`
      SELECT score, max_score, help_used, created_at
        FROM attempts
       WHERE child_id = ? AND objective_id = ?
       ORDER BY created_at DESC
       LIMIT 50
    `, childId, objectiveId).toArray();

    const previous = this.sql.exec<{ level: string }>(`
      SELECT level FROM mastery WHERE child_id = ? AND objective_id = ?
    `, childId, objectiveId).toArray()[0];

    const attempts: MasteryAttempt[] = history.map((row) => ({
      score: Number(row.score ?? 0),
      maxScore: Number(row.max_score ?? 0),
      helpUsed: Number(row.help_used ?? 0) === 1,
      createdAt: Number(row.created_at ?? 0),
    }));

    const summary = deriveMastery(
      attempts,
      isMasteryLevel(previous?.level) ? previous.level : 'not_started',
    );
    const counters = masteryCounters(attempts);

    this.sql.exec(`
      INSERT INTO mastery (child_id, objective_id, level, attempts, correct_attempts, last_attempt_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(child_id, objective_id) DO UPDATE SET
        level = excluded.level,
        attempts = excluded.attempts,
        correct_attempts = excluded.correct_attempts,
        last_attempt_at = excluded.last_attempt_at
    `, childId, objectiveId, summary.level, counters.attempts, counters.correctAttempts, now);
  }

  // --- Rewards -------------------------------------------------------------
  //
  // The smallest primitive that fulfils the sticker promised by ~15 content
  // specs. Deliberately not a reward *system*: no currency, no random drops, no
  // streaks, no expiry, no loot boxes. A reward is earned once and kept.

  private async grantReward(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const childId = typeof body.child_id === 'string' ? body.child_id : '';
    const rewardKey = typeof body.reward_key === 'string' ? body.reward_key.trim() : '';
    const sourceType = typeof body.source_type === 'string' ? body.source_type : '';
    const sourceId = typeof body.source_id === 'string' ? body.source_id : '';

    if (!this.activeSession(sessionId) || !this.child(childId) || !rewardKey
      || !['game', 'episode', 'project'].includes(sourceType) || !sourceId) {
      return json({ success: false, error: 'Invalid reward grant' }, 400);
    }

    const now = Date.now();
    // INSERT OR IGNORE against the unique constraint is the duplicate guard.
    // Replaying the same completion is normal — a child replays a game they
    // enjoyed — and must not mint a second sticker.
    const inserted = this.sql.exec<{ id: string }>(`
      INSERT OR IGNORE INTO rewards (id, child_id, reward_key, source_type, source_id, earned_at)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `, crypto.randomUUID(), childId, rewardKey, sourceType, sourceId, now).toArray()[0];

    const row = inserted ?? this.sql.exec<{ id: string }>(`
      SELECT id FROM rewards
       WHERE child_id = ? AND reward_key = ? AND source_type = ? AND source_id = ?
    `, childId, rewardKey, sourceType, sourceId).toArray()[0];

    return json({
      success: true,
      data: {
        id: row?.id ?? null,
        reward_key: rewardKey,
        // The returned row exists only for the write, not a duplicate replay.
        newly_earned: Boolean(inserted),
      },
    });
  }

  /// Mastery per objective, for the parent report and for verifying that an
  /// attempt actually moved the ladder.
  ///
  /// Read-only and descriptive: the level names a state, and nothing here exposes
  /// a percentage or a comparison with another child.
  private listMastery() {
    const rows = this.sql.exec<{
      child_id: string; objective_id: string; level: string;
      attempts: number; correct_attempts: number; last_attempt_at: number | null;
    }>(`
      SELECT child_id, objective_id, level, attempts, correct_attempts, last_attempt_at
        FROM mastery ORDER BY last_attempt_at DESC
    `).toArray();
    return json({ success: true, data: { mastery: rows } });
  }

  // --- Parental consent ----------------------------------------------------

  private listConsents() {
    const rows = this.sql.exec<{
      consent_type: string; child_id: string | null; version: string;
      granted_at: number; revoked_at: number | null;
    }>(`
      SELECT consent_type, child_id, version, granted_at, revoked_at
        FROM consents ORDER BY granted_at DESC
    `).toArray();
    return json({ success: true, data: { consents: rows } });
  }

  /// Grants or revokes one consent.
  ///
  /// The policy — which row counts, and whether a revocation wins — lives in
  /// `lib/consent.ts` so it is testable without this object. This only stores.
  private async writeConsent(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const consentType = typeof body.consent_type === 'string' ? body.consent_type : '';
    const version = typeof body.version === 'string' ? body.version : '';
    const childId = typeof body.child_id === 'string' && body.child_id ? body.child_id : null;
    const revoke = body.revoke === true;

    if (!this.activeSession(sessionId) || !consentType || !version) {
      return json({ success: false, error: 'Invalid consent' }, 400);
    }
    if (childId !== null && !this.child(childId)) {
      return json({ success: false, error: 'Active child profile not found' }, 404);
    }

    const now = Date.now();
    if (revoke) {
      this.sql.exec(`
        UPDATE consents SET revoked_at = ?
         WHERE consent_type = ? AND (child_id IS ? OR child_id = ?) AND revoked_at IS NULL
      `, now, consentType, childId, childId);
      return json({ success: true, data: { consent_type: consentType, child_id: childId, granted: false } });
    }

    this.sql.exec(`
      INSERT INTO consents (id, consent_type, child_id, version, granted_at)
      VALUES (?, ?, ?, ?, ?)
    `, crypto.randomUUID(), consentType, childId, version, now);
    return json({
      success: true,
      data: { consent_type: consentType, child_id: childId, version, granted: true },
    });
  }

  private listRewards() {
    const rows = this.sql.exec<{
      id: string; child_id: string; reward_key: string;
      source_type: string; source_id: string; earned_at: number;
    }>(`
      SELECT id, child_id, reward_key, source_type, source_id, earned_at
        FROM rewards ORDER BY earned_at DESC
    `).toArray();
    return json({ success: true, data: { rewards: rows } });
  }

  // --- Child creations -----------------------------------------------------
  //
  // Metadata only. The image lives in the private creations bucket and this row
  // is what proves the family owns it. There is no title or caption column, so
  // no text a child wrote is ever stored.

  private async registerCreation(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const childId = typeof body.child_id === 'string' ? body.child_id : '';
    const storageKey = typeof body.storage_key === 'string' ? body.storage_key : '';
    const mimeType = typeof body.mime_type === 'string' ? body.mime_type : '';
    const drawingMode = typeof body.drawing_mode === 'string' ? body.drawing_mode : '';
    const gameId = typeof body.game_id === 'string' ? body.game_id : null;
    const width = boundedInteger(body.width, 1, 4096);
    const height = boundedInteger(body.height, 1, 4096);
    const byteSize = boundedInteger(body.byte_size, 1, 8 * 1024 * 1024);
    const creationId = typeof body.creation_id === 'string' && body.creation_id
      ? body.creation_id
      : crypto.randomUUID();

    if (!this.activeSession(sessionId) || !this.child(childId) || !storageKey
      || !drawingMode || width === null || height === null || byteSize === null) {
      return json({ success: false, error: 'Invalid creation' }, 400);
    }
    // Only raster image types a canvas export can produce. Anything else would
    // mean something other than a drawing is being stored here.
    if (!['image/png', 'image/webp'].includes(mimeType)) {
      return json({ success: false, error: 'Unsupported creation type' }, 415);
    }
    // The key must sit under this child's prefix. The route mints the key, but
    // the DO is the ownership authority and must not take that on trust.
    if (!storageKey.includes(`/child/${childId}/`)) {
      return json({ success: false, error: 'Creation key does not belong to this child' }, 403);
    }

    const now = Date.now();
    this.sql.exec(`
      INSERT INTO child_creations (
        id, child_id, game_id, drawing_mode, storage_key, mime_type,
        width, height, byte_size, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        storage_key = excluded.storage_key,
        byte_size = excluded.byte_size,
        updated_at = excluded.updated_at,
        deleted_at = NULL
    `, creationId, childId, gameId, drawingMode, storageKey, mimeType,
      width, height, byteSize, now, now);

    return json({ success: true, data: { id: creationId, storage_key: storageKey } });
  }

  private listCreations() {
    const rows = this.sql.exec<{
      id: string; child_id: string; game_id: string | null; drawing_mode: string;
      storage_key: string; mime_type: string; width: number; height: number;
      byte_size: number; created_at: number; updated_at: number;
    }>(`
      SELECT id, child_id, game_id, drawing_mode, storage_key, mime_type,
             width, height, byte_size, created_at, updated_at
        FROM child_creations
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
    `).toArray();
    return json({ success: true, data: { creations: rows } });
  }

  private async deleteCreation(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const creationId = typeof body.creation_id === 'string' ? body.creation_id : '';
    if (!this.activeSession(sessionId) || !creationId) {
      return json({ success: false, error: 'Invalid creation delete' }, 400);
    }

    const row = this.sql.exec<{ id: string; child_id: string; storage_key: string }>(`
      SELECT id, child_id, storage_key FROM child_creations WHERE id = ? AND deleted_at IS NULL
    `, creationId).toArray()[0];
    // A creation belonging to another family is simply not found here: this
    // object only holds one family's rows, so cross-family access cannot be
    // expressed, let alone granted.
    if (!row) return json({ success: false, error: 'Creation not found' }, 404);

    // Soft delete first. Hard-deleting the row before the object is removed would
    // orphan the object in the bucket with nothing left pointing at it.
    this.state.storage.transactionSync(() => {
      this.sql.exec(
        `UPDATE child_creations SET deleted_at = ?, updated_at = ? WHERE id = ?`,
        Date.now(), Date.now(), creationId,
      );
      this.sql.exec(
        `INSERT OR IGNORE INTO creation_object_deletions (storage_key, requested_at) VALUES (?, ?)`,
        row.storage_key, Date.now(),
      );
    });
    return json({ success: true, data: { id: creationId, storage_key: row.storage_key, deleted: true } });
  }

  /// Marks every creation for a child, or for the whole family, as deleted and
  /// queues their objects for removal.
  ///
  /// Idempotent: calling it twice is harmless, because the rows are already
  /// deleted and the deletion queue is keyed by storage key. The caller is
  /// expected to follow up with a prefix sweep of the bucket, which is
  /// authoritative and also removes objects this table never knew about.
  private async purgeCreations(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const childId = typeof body.child_id === 'string' ? body.child_id : null;
    if (!this.activeSession(sessionId)) {
      return json({ success: false, error: 'Invalid purge request' }, 400);
    }

    const rows = childId === null
      ? this.sql.exec<{ storage_key: string }>(`SELECT storage_key FROM child_creations`).toArray()
      : this.sql.exec<{ storage_key: string }>(
          `SELECT storage_key FROM child_creations WHERE child_id = ?`, childId,
        ).toArray();

    const now = Date.now();
    this.state.storage.transactionSync(() => {
      if (childId === null) {
        this.sql.exec(`UPDATE child_creations SET deleted_at = ?, updated_at = ? WHERE deleted_at IS NULL`, now, now);
      } else {
        this.sql.exec(
          `UPDATE child_creations SET deleted_at = ?, updated_at = ? WHERE child_id = ? AND deleted_at IS NULL`,
          now, now, childId,
        );
      }
      for (const row of rows) {
        this.sql.exec(
          `INSERT OR IGNORE INTO creation_object_deletions (storage_key, requested_at) VALUES (?, ?)`,
          row.storage_key, now,
        );
      }
    });

    return json({
      success: true,
      data: {
        scope: childId === null ? 'family' : 'child',
        child_id: childId,
        storage_keys: rows.map((row) => row.storage_key),
      },
    });
  }

  /// Object deletions still owed, oldest first.
  private pendingDeletions() {
    const rows = this.sql.exec<{ storage_key: string; requested_at: number; attempts: number }>(`
      SELECT storage_key, requested_at, attempts
        FROM creation_object_deletions
       ORDER BY requested_at
       LIMIT 200
    `).toArray();
    return json({ success: true, data: { pending: rows } });
  }

  /// Clears keys whose objects are confirmed gone, and records a failure for the
  /// rest so a permanently failing key is visible rather than silently retried
  /// forever.
  private async settleDeletions(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    if (!this.activeSession(sessionId)) {
      return json({ success: false, error: 'Invalid settle request' }, 400);
    }
    const settled = Array.isArray(body.settled) ? body.settled.filter((k): k is string => typeof k === 'string') : [];
    const failed = Array.isArray(body.failed) ? body.failed.filter((k): k is string => typeof k === 'string') : [];
    const error = typeof body.error === 'string' ? body.error.slice(0, 200) : null;

    this.state.storage.transactionSync(() => {
      for (const key of settled) {
        this.sql.exec(`DELETE FROM creation_object_deletions WHERE storage_key = ?`, key);
        // Once the object is gone the row has nothing left to describe, so the
        // soft delete becomes a hard one and the table stays bounded.
        this.sql.exec(`DELETE FROM child_creations WHERE storage_key = ? AND deleted_at IS NOT NULL`, key);
      }
      for (const key of failed) {
        this.sql.exec(
          `UPDATE creation_object_deletions SET attempts = attempts + 1, last_error = ? WHERE storage_key = ?`,
          error, key,
        );
      }
    });

    return json({ success: true, data: { settled: settled.length, failed: failed.length } });
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

  /// Subscription state for the account.
  ///
  /// Reports only what the entitlement ledger actually holds. The effective plan
  /// comes from [currentPlan], which is the same value used to enforce limits, so
  /// the screen cannot disagree with what the app allows.
  private async getBillingStatus() {
    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);
    const now = Date.now();

    // The entitlement that is currently granting access, if any. Ordered the
    // same way as `currentPlan` so both agree on which one wins.
    const active = this.sql.exec<{
      plan: string; status: string; source: string; starts_at: number; expires_at: number | null;
    }>(`
      SELECT plan, status, source, starts_at, expires_at FROM entitlements
      WHERE status IN ('active', 'grace') AND (expires_at IS NULL OR expires_at > ?)
      ORDER BY CASE plan WHEN 'family_plus' THEN 2 WHEN 'family' THEN 1 ELSE 0 END DESC
      LIMIT 1
    `, now).toArray()[0] ?? null;

    const plan = this.currentPlan(now);
    const limits = PLAN_LIMITS[plan];
    const activeChildren = this.sql.exec<{ count: number }>(
      `SELECT COUNT(*) AS count FROM children WHERE status = 'active'`,
    ).toArray()[0]?.count ?? 0;
    const activeDevices = this.sql.exec<{ count: number }>(
      `SELECT COUNT(*) AS count FROM devices WHERE status = 'active'`,
    ).toArray()[0]?.count ?? 0;

    return json({
      success: true,
      data: {
        plan,
        // `base_plan` is what the account falls back to once every paid
        // entitlement lapses.
        base_plan: family.base_plan ?? 'free',
        // Null when the account has never carried a paid entitlement, which the
        // client renders as "no subscription" rather than as an error.
        subscription: active === null ? null : {
          plan: active.plan,
          status: active.status,
          source: active.source,
          starts_at: new Date(active.starts_at).toISOString(),
          expires_at: active.expires_at === null
            ? null
            : new Date(active.expires_at).toISOString(),
          // A grace-period entitlement still grants access but signals a
          // payment problem the parent should act on.
          in_grace: active.status === 'grace',
        },
        limits: {
          children: limits.children,
          devices: limits.devices,
          concurrent_streams: limits.concurrentStreams,
          download_devices: limits.downloadDevices,
        },
        usage: { children: activeChildren, devices: activeDevices },
      },
    });
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

  // ---- C2: parent PIN (server-side gate) ----

  private static validatePin(pin: string): string | null {
    if (pin.length < 4 || pin.length > 6) return 'الرمز من 4 إلى 6 أرقام';
    if (!/^\d+$/.test(pin)) return 'الرمز أرقام فقط';
    if (/^(\d)\1*$/.test(pin)) return 'لا تستخدم رقمًا مكرّرًا';
    let asc = true;
    let desc = true;
    for (let i = 1; i < pin.length; i++) {
      const delta = pin.charCodeAt(i) - pin.charCodeAt(i - 1);
      if (delta !== 1) asc = false;
      if (delta !== -1) desc = false;
    }
    if (asc || desc) return 'لا تستخدم أرقامًا متتالية';
    return null;
  }

  private async setParentPin(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    const problem = FamilyState.validatePin(pin);
    if (problem) return json({ success: false, error: problem }, 400);
    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);
    const hash = await hashPassword(pin);
    const now = Date.now();
    this.sql.exec(
      `UPDATE family SET parent_pin_hash = ?, parent_pin_failed_count = 0, parent_pin_locked_until = NULL, updated_at = ? WHERE singleton = 1`,
      hash, now,
    );
    this.addOutbox('parent_pin.enrolled', { parentId: family.parent_id });
    await this.scheduleOutbox();
    return json({ success: true, data: { enrolled: true } });
  }

  private async verifyParentPin(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    const row = this.sql.exec<{ parent_pin_hash: string | null; parent_pin_failed_count: number; parent_pin_locked_until: number | null }>(
      `SELECT parent_pin_hash, parent_pin_failed_count, parent_pin_locked_until FROM family WHERE singleton = 1`,
    ).toArray()[0];
    if (!row?.parent_pin_hash) return json({ success: false, error: 'No PIN has been set' }, 404);
    const now = Date.now();
    if (row.parent_pin_locked_until !== null && row.parent_pin_locked_until > now) {
      return json({ success: false, error: 'Too many attempts', locked_until: row.parent_pin_locked_until }, 423);
    }
    // Clear stale lockout
    if (row.parent_pin_locked_until !== null && row.parent_pin_locked_until <= now) {
      this.sql.exec(`UPDATE family SET parent_pin_failed_count = 0, parent_pin_locked_until = NULL WHERE singleton = 1`);
      row.parent_pin_failed_count = 0;
      row.parent_pin_locked_until = null;
    }
    const ok = await verifyPassword(pin, row.parent_pin_hash);
    if (ok) {
      this.sql.exec(`UPDATE family SET parent_pin_failed_count = 0, parent_pin_locked_until = NULL WHERE singleton = 1`);
      return json({ success: true, data: { verified: true } });
    }
    const failures = (row.parent_pin_failed_count ?? 0) + 1;
    const MAX_FAILURES = 5;
    const LOCK_MS = 15 * 60 * 1000;
    if (failures >= MAX_FAILURES) {
      const until = now + LOCK_MS;
      this.sql.exec(`UPDATE family SET parent_pin_failed_count = 0, parent_pin_locked_until = ? WHERE singleton = 1`, until);
      return json({ success: false, error: 'Too many attempts', locked_until: until, attempts_remaining: 0 }, 423);
    }
    this.sql.exec(`UPDATE family SET parent_pin_failed_count = ? WHERE singleton = 1`, failures);
    return json({ success: false, error: 'Incorrect PIN', attempts_remaining: MAX_FAILURES - failures }, 403);
  }
}
