import type { Env } from '../lib/db.ts';
import {
  callDurable,
  identityForParent,
  setIdentityDirectoryStatus,
  tombstoneIdentityDirectory,
} from '../lib/doClient.ts';
// امتدادات `.ts` صريحة: مجموعة الاختبارات تعمل بـ`node --experimental-strip-types`
// الذي يطالب بالامتداد في الاستيراد النسبي ولا يستنتجه كما يفعل مُجمِّع wrangler.
// بلا الامتداد لا يمكن استيراد هذا الكائن في اختبار إطلاقًا — وهو أكبر ملف منطق
// في المشروع وكان بلا أي تغطية.
import { boundedInteger, deriveAgeTrack, isPlan, normalizeTracks, PLAN_LIMITS, planAllows, type AgeTrack, type Plan } from '../lib/familyPolicy.ts';
import { hashPassword, verifyPassword } from '../lib/security.ts';
import { addColumn, applySchemaSteps, readSchemaState, type SchemaState } from '../lib/doSchema.ts';
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
  deleted_at: number | null;
  profile_intent_version: number;
  profile_applied_version: number;
};

type LifecycleJob = {
  request_id: string;
  scope: 'child' | 'account';
  child_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  requested_at: number;
  next_attempt_at: number;
  processing_started_at: number | null;
  receipt_hash: string | null;
};

type ProfileSyncJob = {
  operation_id: string;
  display_name: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  next_attempt_at: number;
  processing_started_at: number | null;
  intent_version: number;
};

const JOB_PROCESSING_LEASE_MS = 5 * 60 * 1000;

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

/**
 * Column additions for `FamilyState`, applied by version.
 *
 * **Append only, and never renumber.** An existing object records the version it
 * reached, so changing a number would re-run or skip a step on every object that
 * already passed it. These twelve replace twelve `try { ALTER } catch {}` lines
 * whose failures were indistinguishable from success.
 */
export const FAMILY_SCHEMA_STEPS = [
  addColumn('family', 'parent_pin_hash', 'TEXT', 1),
  addColumn('family', 'parent_pin_failed_count', 'INTEGER NOT NULL DEFAULT 0', 2),
  addColumn('family', 'parent_pin_locked_until', 'INTEGER', 3),
  addColumn('family', 'parent_pin_version', 'INTEGER NOT NULL DEFAULT 0', 4),
  addColumn('family', 'deleted_at', 'INTEGER', 5),
  addColumn('family', 'profile_intent_version', 'INTEGER NOT NULL DEFAULT 0', 6),
  addColumn('family', 'profile_applied_version', 'INTEGER NOT NULL DEFAULT 0', 7),
  addColumn('lifecycle_jobs', 'processing_started_at', 'INTEGER', 8),
  addColumn('lifecycle_jobs', 'receipt_hash', 'TEXT', 9),
  addColumn('profile_sync_jobs', 'intent_version', 'INTEGER NOT NULL DEFAULT 0', 10),
  addColumn('attempts', 'game_id', 'TEXT', 11),
  addColumn('attempts', 'content_type', 'TEXT', 12),
];

/// The version a fully migrated `FamilyState` reaches.
export const FAMILY_SCHEMA_VERSION = FAMILY_SCHEMA_STEPS
  .reduce((highest, step) => Math.max(highest, step.version), 0);

export class FamilyState {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private readonly sql: SqlStorage;
  /**
   * Result of the schema run for this instantiation.
   *
   * Kept so `GET /schema` can report the version and any failure. Without it a
   * partially migrated object was undetectable — the old `try { ALTER } catch {}`
   * discarded the only evidence.
   */
  private readonly schema: SchemaState;

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
        deleted_at INTEGER,
        profile_intent_version INTEGER NOT NULL DEFAULT 0,
        profile_applied_version INTEGER NOT NULL DEFAULT 0,
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
    // Parent PIN state and one-time proof replay protection live with the
    // authoritative family/session ledger. Existing Durable Objects receive the
    // columns in place; new objects run the same idempotent upgrade path.
    //
    // These were `try { ALTER } catch {}`. They are now numbered steps applied by
    // `lib/doSchema.ts`, which inspects before mutating and records the version
    // reached — so a genuine failure is reported instead of being indistinguishable
    // from "already applied". The step list is assembled below and run in one pass
    // after every table exists.
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS used_parent_proofs (
        jti TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_used_parent_proofs_expiry
        ON used_parent_proofs(expires_at);

      CREATE TABLE IF NOT EXISTS lifecycle_jobs (
        request_id TEXT PRIMARY KEY,
        scope TEXT NOT NULL CHECK (scope IN ('child', 'account')),
        child_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        requested_at INTEGER NOT NULL,
        next_attempt_at INTEGER NOT NULL,
        processing_started_at INTEGER,
        receipt_hash TEXT,
        completed_at INTEGER,
        last_error_code TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_lifecycle_jobs_due
        ON lifecycle_jobs(status, next_attempt_at, requested_at);

      CREATE TABLE IF NOT EXISTS profile_sync_jobs (
        operation_id TEXT PRIMARY KEY,
        display_name TEXT,
        intent_version INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at INTEGER NOT NULL,
        processing_started_at INTEGER,
        completed_at INTEGER,
        last_error_code TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_profile_sync_jobs_due
        ON profile_sync_jobs(status, next_attempt_at);
    `);

    // Game attempts: `attempts` was created with `episode_id` only, and
    // `recordAttempt` was called with the game id in that column. D1's own
    // `attempts` table has both `episode_id` and `game_id` with
    // CHECK (episode_id IS NOT NULL OR game_id IS NOT NULL), so the DO and the
    // projection had diverged and per-game reporting was impossible.
    //
    // Added in place rather than by recreating the table: existing rows keep the
    // id they were written with, and `backfillGameAttempts` below moves the ones
    // that were games. Same pattern as the PIN columns above.

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

    // Column additions, applied by version after every table exists.
    //
    // Numbers are permanent: an existing object has recorded the version it
    // reached, so renumbering would re-run or skip steps. Append only.
    this.schema = applySchemaSteps(this.sql, FAMILY_SCHEMA_STEPS, 'FamilyState');

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
      /**
       * `GET /schema` — the schema version this object reached.
       *
       * Exists so a partially migrated object can be found. With one object per
       * family, a step that fails on a single instance leaves that family's data
       * shaped differently from everyone else's, and the previous
       * `try { ALTER } catch {}` left no trace of it at all.
       */
      'GET /schema': () => Response.json({
        success: true,
        data: {
          object: 'FamilyState',
          ...readSchemaState(this.sql),
          /// What the running code intends to reach, so "behind" is detectable
          /// without consulting the source.
          expected_version: FAMILY_SCHEMA_VERSION,
          last_run: this.schema,
        },
      }),
      'POST /initialize': (r) => this.initialize(r),
      'POST /sessions/create': (r) => this.createSession(r),
      'POST /sessions/resolve': (r) => this.resolveSession(r),
      'POST /sessions/refresh': (r) => this.refreshSession(r),
      'POST /sessions/logout': (r) => this.logout(r),
      'POST /sessions/revoke-all': (r) => this.revokeAllSessions(r),
      'POST /sessions/revoke-others': (r) => this.revokeOtherSessions(r),
      'POST /profile/update': (r) => this.updateProfile(r),
      'POST /export': (r) => this.exportData(r),
      'POST /lifecycle/request': (r) => this.requestLifecycle(r),
      'POST /lifecycle/status': (r) => this.lifecycleStatus(r),
      'POST /lifecycle/status-capability': (r) => this.lifecycleStatusCapability(r),
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
      'POST /parent-proof/validate': (r) => this.validateParentProof(r),
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

      // Operator commands. Prefixed `/admin` so the two authorisation stories are
      // visible in the route table itself: everything above proves a parent session,
      // everything here carries an operator id and a reason instead. Reached only from
      // `routes/adminDevices.ts`, which enforces the permission and audits first.
      'POST /admin/devices/revoke': (r) => this.adminRevokeDevice(r),
      'POST /admin/downloads/revoke': (r) => this.adminRevokeDownloads(r),
      'POST /admin/resync': (r) => this.adminResync(r),
      'GET /admin/inspect': () => this.adminInspect(),
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
    await this.processNextLifecycleJob();
    await this.processNextProfileSyncJob();

    const queue = this.env.FAMILY_EVENTS;
    const rows = queue
      ? this.sql.exec<{ event_id: string; event_type: string; payload_json: string; created_at: number }>(`
          SELECT event_id, event_type, payload_json, created_at
          FROM outbox
          WHERE status = 'pending' AND available_at <= ?
          ORDER BY created_at ASC
          LIMIT 100
        `, Date.now()).toArray()
      : [];

    if (queue && rows.length) {
      try {
        await queue.sendBatch(rows.map((row) => ({ body: JSON.parse(row.payload_json) as FamilyEvent })));
        const sentAt = Date.now();
        this.state.storage.transactionSync(() => {
          for (const row of rows) {
            this.sql.exec(
              `UPDATE outbox SET status = 'sent', sent_at = ? WHERE event_id = ? AND status = 'pending'`,
              sentAt,
              row.event_id,
            );
          }
        });
      } catch (error) {
        const retryAt = Date.now() + 30_000;
        this.state.storage.transactionSync(() => {
          for (const row of rows) {
            this.sql.exec(
              `UPDATE outbox SET attempts = attempts + 1, available_at = ? WHERE event_id = ?`,
              retryAt,
              row.event_id,
            );
          }
        });
        await this.state.storage.setAlarm(retryAt);
        console.error('family_outbox_delivery_failed');
        throw error;
      }
    }

    const now = Date.now();
    this.state.storage.transactionSync(() => {
      this.sql.exec(`DELETE FROM outbox WHERE status = 'sent' AND sent_at < ?`, now - 7 * 24 * 60 * 60 * 1000);
      this.sql.exec(`DELETE FROM idempotency_keys WHERE expires_at < ?`, now);
      this.sql.exec(`DELETE FROM used_refresh_tokens WHERE expires_at < ?`, now);
      this.sql.exec(`DELETE FROM used_parent_proofs WHERE expires_at < ?`, now);
    });

    const nextLifecycle = this.sql.exec<{ next_attempt_at: number | null }>(`
      SELECT MIN(CASE
        WHEN status = 'processing' THEN COALESCE(processing_started_at, updated_at) + ${JOB_PROCESSING_LEASE_MS}
        ELSE next_attempt_at
      END) AS next_attempt_at
      FROM lifecycle_jobs
      WHERE status IN ('pending', 'failed', 'processing')
    `).toArray()[0]?.next_attempt_at;
    const nextProfileSync = this.sql.exec<{ next_attempt_at: number | null }>(`
      SELECT MIN(CASE
        WHEN status = 'processing' THEN COALESCE(processing_started_at, updated_at) + ${JOB_PROCESSING_LEASE_MS}
        ELSE next_attempt_at
      END) AS next_attempt_at
      FROM profile_sync_jobs
      WHERE status IN ('pending', 'failed', 'processing')
    `).toArray()[0]?.next_attempt_at;
    const nextOutbox = queue
      ? this.sql.exec<{ available_at: number }>(`
          SELECT MIN(available_at) AS available_at FROM outbox WHERE status = 'pending'
        `).toArray()[0]?.available_at
      : undefined;
    const candidates = [nextLifecycle, nextProfileSync, nextOutbox]
      .filter((value): value is number => Number.isInteger(value));
    if (candidates.length) {
      await this.state.storage.setAlarm(Math.max(now + 1000, Math.min(...candidates)));
    }
  }

  private lifecycleErrorCode(error: unknown) {
    const value = error instanceof Error ? error.message : '';
    const allowed = new Set([
      'creation_storage_unconfigured',
      'identity_directory_unavailable',
      'identity_pending_failed',
      'identity_delete_failed',
      'identity_directory_update_failed',
    ]);
    return allowed.has(value) ? value : 'lifecycle_step_failed';
  }

  private async deleteCreationPrefix(prefix: string) {
    const bucket = this.env.CREATIONS_BUCKET;
    if (!bucket) throw new Error('creation_storage_unconfigured');
    let cursor: string | undefined;
    do {
      const listing = await bucket.list({ prefix, cursor, limit: 500 });
      const keys = listing.objects
        .map((object) => object.key)
        .filter((key) => key.startsWith(prefix));
      if (keys.length) await bucket.delete(keys);
      cursor = listing.truncated ? listing.cursor : undefined;
    } while (cursor);
  }

  private async processNextLifecycleJob() {
    const now = Date.now();
    const staleBefore = now - JOB_PROCESSING_LEASE_MS;
    const job = this.sql.exec<LifecycleJob>(`
      SELECT request_id, scope, child_id, status, attempts, requested_at,
             next_attempt_at, processing_started_at, receipt_hash
      FROM lifecycle_jobs
      WHERE (status IN ('pending', 'failed') AND next_attempt_at <= ?)
         OR (status = 'processing' AND COALESCE(processing_started_at, 0) <= ?)
      ORDER BY requested_at ASC
      LIMIT 1
    `, now, staleBefore).toArray()[0];
    if (!job) return;

    // Schedule lease recovery before changing the row to processing. If the DO
    // is evicted during an IdentityState or R2 await, this alarm will reclaim
    // the stale lease without relying on unrelated traffic.
    await this.scheduleWork(JOB_PROCESSING_LEASE_MS);

    const claimed = this.sql.exec(`
      UPDATE lifecycle_jobs
      SET status = 'processing', attempts = attempts + 1,
          processing_started_at = ?, last_error_code = NULL, updated_at = ?
      WHERE request_id = ?
        AND ((status IN ('pending', 'failed') AND next_attempt_at <= ?)
          OR (status = 'processing' AND COALESCE(processing_started_at, 0) <= ?))
      RETURNING request_id
    `, now, now, job.request_id, now, staleBefore).toArray();
    if (!claimed.length) return;

    const claimedJob: LifecycleJob = {
      ...job,
      status: 'processing',
      attempts: job.attempts + 1,
      processing_started_at: now,
    };
    try {
      if (claimedJob.scope === 'child') await this.processChildDeletion(claimedJob);
      else await this.processAccountDeletion(claimedJob);
    } catch (error) {
      const retryAt = Date.now() + Math.min(
        60 * 60 * 1000,
        30_000 * (2 ** Math.min(claimedJob.attempts, 7)),
      );
      this.sql.exec(`
        UPDATE lifecycle_jobs
        SET status = 'failed', processing_started_at = NULL,
            last_error_code = ?, next_attempt_at = ?, updated_at = ?
        WHERE request_id = ? AND status = 'processing' AND processing_started_at = ?
      `, this.lifecycleErrorCode(error), retryAt, Date.now(), claimedJob.request_id, now);
      console.error('family_lifecycle_step_failed', this.lifecycleErrorCode(error));
    }
  }

  private async processNextProfileSyncJob(operationId?: string) {
    const now = Date.now();
    const staleBefore = now - JOB_PROCESSING_LEASE_MS;
    const job = operationId
      ? this.sql.exec<ProfileSyncJob>(`
          SELECT operation_id, display_name, status, attempts, next_attempt_at,
                 processing_started_at, intent_version
          FROM profile_sync_jobs WHERE operation_id = ? AND status <> 'completed'
        `, operationId).toArray()[0]
      : this.sql.exec<ProfileSyncJob>(`
          SELECT operation_id, display_name, status, attempts, next_attempt_at,
                 processing_started_at, intent_version
          FROM profile_sync_jobs
          WHERE (status IN ('pending', 'failed') AND next_attempt_at <= ?)
             OR (status = 'processing' AND COALESCE(processing_started_at, 0) <= ?)
          ORDER BY intent_version ASC LIMIT 1
        `, now, staleBefore).toArray()[0];
    if (!job) return true;
    if (job.status === 'processing' && (job.processing_started_at ?? 0) > staleBefore) return false;
    if (job.status !== 'processing' && job.next_attempt_at > now && !operationId) return false;

    // Arm lease recovery before the durable claim. If alarm storage fails, the
    // row remains pending/failed rather than becoming an orphaned processing job.
    await this.scheduleWork(JOB_PROCESSING_LEASE_MS);

    const claimed = this.sql.exec(`
      UPDATE profile_sync_jobs
      SET status = 'processing', attempts = attempts + 1,
          processing_started_at = ?, last_error_code = NULL, updated_at = ?
      WHERE operation_id = ?
        AND (status IN ('pending', 'failed')
          OR (status = 'processing' AND COALESCE(processing_started_at, 0) <= ?))
      RETURNING operation_id
    `, now, now, job.operation_id, staleBefore).toArray();
    if (!claimed.length) return false;

    try {
      const family = this.family();
      if (!family || family.status !== 'active' || family.deleted_at !== null) {
        return false;
      }
      const locator = await identityForParent(this.env, family.parent_id);
      if (!locator || locator.status !== 'active') throw new Error('identity_directory_unavailable');
      const updated = await callDurable<{
        success: boolean;
        data?: { display_name: string | null; profile_version: number; applied: boolean };
      }>(locator.stub, '/profile/update', {
        body: {
          parent_id: family.parent_id,
          display_name: job.display_name,
          profile_version: job.intent_version,
        },
      });
      if (!updated.ok || updated.data?.success !== true) throw new Error('profile_identity_update_failed');

      const completedAt = Date.now();
      let finished = false;
      let projected = false;
      this.state.storage.transactionSync(() => {
        const currentFamily = this.family();
        const currentJob = this.sql.exec<{
          status: string;
          intent_version: number;
          processing_started_at: number | null;
        }>(`
          SELECT status, intent_version, processing_started_at
          FROM profile_sync_jobs WHERE operation_id = ?
        `, job.operation_id).toArray()[0];
        if (!currentFamily || currentFamily.status !== 'active' || currentFamily.deleted_at !== null
          || currentJob?.status !== 'processing' || currentJob.intent_version !== job.intent_version
          || currentJob.processing_started_at !== now) {
          return;
        }

        const completed = this.sql.exec<{ operation_id: string }>(`
          UPDATE profile_sync_jobs
          SET status = 'completed', completed_at = ?, processing_started_at = NULL,
              next_attempt_at = ?, updated_at = ?
          WHERE operation_id = ? AND status = 'processing' AND intent_version = ?
            AND processing_started_at = ?
          RETURNING operation_id
        `, completedAt, completedAt, completedAt,
        job.operation_id, job.intent_version, now).toArray();
        if (!completed.length) return;
        finished = true;

        // Only the latest accepted intent may project a display name. Identity
        // applies the same monotonic version, so an older retry cannot reverse a
        // newer value in either authority or projection.
        if (job.intent_version === currentFamily.profile_intent_version) {
          const familyUpdated = this.sql.exec(`
            UPDATE family
            SET display_name = ?, profile_applied_version = ?, updated_at = ?
            WHERE singleton = 1 AND status = 'active' AND deleted_at IS NULL
              AND profile_intent_version = ? AND profile_applied_version <= ?
            RETURNING parent_id
          `, job.display_name, job.intent_version, completedAt,
          job.intent_version, job.intent_version).toArray();
          if (familyUpdated.length) {
            this.addOutbox('family.updated', {
              displayName: job.display_name,
              profileVersion: job.intent_version,
            });
            projected = true;
          }
        }
      });
      if (!finished) return false;
      if (projected) await this.scheduleOutbox();
      return true;
    } catch (error) {
      const retryAt = Date.now() + Math.min(60 * 60 * 1000, 30_000 * (2 ** Math.min(job.attempts, 7)));
      this.sql.exec(`
        UPDATE profile_sync_jobs
        SET status = 'failed', processing_started_at = NULL,
            last_error_code = ?, next_attempt_at = ?, updated_at = ?
        WHERE operation_id = ? AND status = 'processing' AND processing_started_at = ?
      `, error instanceof Error && error.message === 'identity_directory_unavailable'
        ? 'identity_directory_unavailable'
        : 'profile_sync_failed', retryAt, Date.now(), job.operation_id, now);
      await this.scheduleWork(Math.max(1000, retryAt - Date.now()));
      return false;
    }
  }

  private ownsLifecycleLease(job: LifecycleJob) {
    const startedAt = job.processing_started_at;
    if (startedAt === null) return false;
    return Boolean(this.sql.exec<{ request_id: string }>(`
      SELECT request_id FROM lifecycle_jobs
      WHERE request_id = ? AND status = 'processing' AND processing_started_at = ?
    `, job.request_id, startedAt).toArray()[0]);
  }

  private async processChildDeletion(job: LifecycleJob) {
    const family = this.family();
    const leaseStartedAt = job.processing_started_at;
    if (!family || !job.child_id || leaseStartedAt === null) {
      throw new Error('lifecycle_step_failed');
    }
    await this.deleteCreationPrefix(`family/${family.parent_id}/child/${job.child_id}/`);

    const now = Date.now();
    this.state.storage.transactionSync(() => {
      const owned = this.sql.exec<{ request_id: string }>(`
        SELECT request_id FROM lifecycle_jobs
        WHERE request_id = ? AND status = 'processing' AND processing_started_at = ?
      `, job.request_id, leaseStartedAt).toArray()[0];
      if (!owned) return;
      this.sql.exec(`DELETE FROM parental_settings WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM content_progress WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM attempts WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM mastery WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM favorites WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM playback_leases WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM rewards WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM consents WHERE child_id = ?`, job.child_id);
      this.sql.exec(`DELETE FROM child_creations WHERE child_id = ?`, job.child_id);
      this.sql.exec(
        `DELETE FROM creation_object_deletions WHERE storage_key LIKE ?`,
        `family/${family.parent_id}/child/${job.child_id}/%`,
      );
      this.sql.exec(`DELETE FROM children WHERE id = ?`, job.child_id);
      this.addOutbox('child.deleted', { childId: job.child_id, requestId: job.request_id, scope: 'child' });
      this.sql.exec(`
        UPDATE lifecycle_jobs
        SET status = 'completed', completed_at = ?, processing_started_at = NULL,
            next_attempt_at = ?, updated_at = ?
        WHERE request_id = ? AND status = 'processing' AND processing_started_at = ?
      `, now, now, now, job.request_id, leaseStartedAt);
    });
  }

  private purgeAccountRows(parentId: string) {
    this.state.storage.transactionSync(() => {
      // Outbox payloads may contain historical display names or child metadata.
      // Remove every pre-deletion event before emitting the final tombstone.
      this.sql.exec(`DELETE FROM outbox`);
      for (const table of [
        'parental_settings',
        'content_progress',
        'attempts',
        'mastery',
        'favorites',
        'playback_leases',
        'rewards',
        'consents',
        'child_creations',
        'creation_object_deletions',
        'children',
        'entitlements',
        'used_refresh_tokens',
        'used_parent_proofs',
        'auth_sessions',
        'devices',
        'idempotency_keys',
        'profile_sync_jobs',
      ]) {
        this.sql.exec(`DELETE FROM ${table}`);
      }
      this.sql.exec(`
        UPDATE family
        SET display_name = NULL, parent_pin_hash = NULL,
            parent_pin_failed_count = 0, parent_pin_locked_until = NULL,
            status = 'suspended', updated_at = ?
        WHERE singleton = 1 AND parent_id = ?
      `, Date.now(), parentId);
    });
  }

  private async processAccountDeletion(job: LifecycleJob) {
    const family = this.family();
    const leaseStartedAt = job.processing_started_at;
    if (!family || leaseStartedAt === null) throw new Error('lifecycle_step_failed');
    if (!this.ownsLifecycleLease(job)) return;

    const identity = await identityForParent(this.env, family.parent_id);
    if (!this.ownsLifecycleLease(job)) return;
    if (!identity) throw new Error('identity_directory_unavailable');

    // A retry may resume after the identity and directory were already
    // tombstoned but before this job was marked complete. In that state the
    // randomized locator intentionally no longer points at the old Identity DO;
    // skip identity calls and finish the remaining idempotent cleanup.
    if (identity.status !== 'deleted') {
      const pending = await callDurable<{ success: boolean }>(identity.stub, '/account/deletion-pending', {
        body: { parent_id: family.parent_id, request_id: job.request_id },
      });
      if (!this.ownsLifecycleLease(job)) return;
      if (!pending.ok || pending.data?.success !== true) throw new Error('identity_pending_failed');
      if (!await setIdentityDirectoryStatus(this.env, family.parent_id, 'deletion_pending')) {
        throw new Error('identity_directory_update_failed');
      }
      if (!this.ownsLifecycleLease(job)) return;
    }

    await this.deleteCreationPrefix(`family/${family.parent_id}/`);
    if (!this.ownsLifecycleLease(job)) return;
    this.purgeAccountRows(family.parent_id);

    if (identity.status !== 'deleted') {
      const deleted = await callDurable<{ success: boolean }>(identity.stub, '/account/delete', {
        body: { parent_id: family.parent_id, request_id: job.request_id },
      });
      if (!this.ownsLifecycleLease(job)) return;
      if (!deleted.ok || deleted.data?.success !== true) throw new Error('identity_delete_failed');
      if (!await tombstoneIdentityDirectory(this.env, family.parent_id)) {
        throw new Error('identity_directory_update_failed');
      }
      if (!this.ownsLifecycleLease(job)) return;
    }

    const now = Date.now();
    this.state.storage.transactionSync(() => {
      if (!this.ownsLifecycleLease(job)) return;
      this.sql.exec(`
        UPDATE family
        SET display_name = NULL, status = 'suspended', deleted_at = ?, updated_at = ?
        WHERE singleton = 1
      `, now, now);
      this.addOutbox('family.deleted', { requestId: job.request_id, scope: 'account' });
      this.sql.exec(`
        UPDATE lifecycle_jobs
        SET status = 'completed', completed_at = ?, processing_started_at = NULL,
            next_attempt_at = ?, updated_at = ?
        WHERE request_id = ? AND status = 'processing' AND processing_started_at = ?
      `, now, now, now, job.request_id, leaseStartedAt);
    });
  }

  private family(): FamilyRow | null {
    return this.sql.exec<FamilyRow>(`
      SELECT parent_id, display_name, status, base_plan, auth_epoch, deleted_at,
             profile_intent_version, profile_applied_version
      FROM family WHERE singleton = 1
    `).toArray()[0] ?? null;
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

  private async scheduleWork(delayMs = 1000) {
    const now = Date.now();
    const target = now + Math.max(0, delayMs);
    const existing = await this.state.storage.getAlarm();
    // Some runtimes can still expose the timestamp of the alarm currently
    // executing. Treat a due timestamp as consumed so lease watchdogs are
    // always armed for the next wake-up.
    if (existing === null || existing <= now || existing > target) {
      await this.state.storage.setAlarm(target);
    }
  }

  private async scheduleOutbox() {
    if (!this.env.FAMILY_EVENTS) return;
    await this.scheduleWork();
  }

  // --- Operator commands ---------------------------------------------------
  //
  // ## Why these exist separately from the parent routes
  //
  // `revokeDevice` requires `activeSession(sessionId)`, and correctly so: a parent
  // revoking a device must prove they are that parent. An operator has no parent
  // session and must never be handed one, so the admin surface previously answered
  // 501 and said the operation was architecturally impossible.
  //
  // It is not impossible; it is a *different* operation with a different
  // authorisation story, and modelling it as the same one was the mistake. These
  // handlers take an operator identity and a reason instead of a session, and they
  // are reached only from `routes/adminDevices.ts`, which enforces the admin
  // permission and writes the audit row before calling.
  //
  // Three properties make this safe rather than a back door:
  //
  //  1. **No session is minted.** Nothing here creates or resolves a parent session,
  //     so an operator cannot act *as* the family — only on it.
  //  2. **The reason travels with the effect.** `actor_id` and `reason` are required
  //     and are written into the outbox event, so the projection and every downstream
  //     consumer records that this was an operator action, not a parent's.
  //  3. **Same state transitions as the parent path.** Revocation bumps `auth_epoch`
  //     and ends leases exactly as the parent path does, so there is no second,
  //     weaker notion of "revoked" in the system.

  /// Operator identity and reason, required on every command below.
  private operatorFrom(body: Record<string, unknown>): { actorId: string; reason: string } | null {
    const actorId = typeof body.actor_id === 'string' ? body.actor_id.trim() : '';
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!actorId || !reason) return null;
    return { actorId, reason: reason.slice(0, 500) };
  }

  /// `POST /admin/devices/revoke` — operator revocation.
  ///
  /// Bumps `auth_epoch` like the parent path, which is what actually signs the device
  /// out: without it the device keeps a valid session until expiry and the operator
  /// would report a revocation that had not happened yet.
  private async adminRevokeDevice(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const operator = this.operatorFrom(body);
    if (!operator) return json({ success: false, error: 'actor_id and reason are required' }, 400);
    const deviceId = typeof body.device_id === 'string' ? body.device_id : '';
    if (!deviceId) return json({ success: false, error: 'device_id is required' }, 400);

    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);

    const device = this.sql.exec<{ id: string; status: string }>(
      'SELECT id, status FROM devices WHERE id = ?', deviceId,
    ).toArray()[0];
    if (!device) return json({ success: false, error: 'Device not found for this family' }, 404);
    // Reported rather than treated as success: "already revoked" and "revoked by you
    // just now" are different answers on a support call.
    if (device.status !== 'active') {
      return json({ success: true, data: { revoked: false, status: device.status, already: true } });
    }

    const now = Date.now();
    this.state.storage.transactionSync(() => {
      this.sql.exec(`UPDATE devices SET status = 'revoked', revoked_at = ? WHERE id = ? AND status = 'active'`, now, deviceId);
      this.sql.exec(`UPDATE auth_sessions SET status = 'revoked', revoked_at = ? WHERE device_id = ? AND status = 'active'`, now, deviceId);
      this.sql.exec(`UPDATE family SET auth_epoch = auth_epoch + 1, updated_at = ? WHERE singleton = 1`, now);
      this.sql.exec(`UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE device_id = ? AND status = 'active'`, now, deviceId);
      this.addOutbox('device.revoked', {
        deviceId,
        // The projection and every downstream consumer can tell an operator action
        // from a parent's, which a shared payload shape would have hidden.
        by: 'operator',
        operator_id: operator.actorId,
        reason: operator.reason,
      });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { revoked: true, auth_epoch_bumped: true } });
  }

  /// `POST /admin/downloads/revoke` — ends offline access for one device.
  ///
  /// Distinct from revoking the device: a family that lost a tablet needs the device
  /// gone, while a family that hit a download limit needs only the offline copies
  /// invalidated and the device left signed in. Implemented as lease revocation
  /// because leases are what authorise offline media in this architecture; there is no
  /// separate downloads table, and inventing one would create a second truth.
  private async adminRevokeDownloads(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const operator = this.operatorFrom(body);
    if (!operator) return json({ success: false, error: 'actor_id and reason are required' }, 400);
    const deviceId = typeof body.device_id === 'string' ? body.device_id : '';

    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);

    const now = Date.now();
    let affected = 0;
    this.state.storage.transactionSync(() => {
      const rows = deviceId
        ? this.sql.exec<{ total: number }>(`SELECT COUNT(*) AS total FROM playback_leases WHERE device_id = ? AND status = 'active'`, deviceId).toArray()
        : this.sql.exec<{ total: number }>(`SELECT COUNT(*) AS total FROM playback_leases WHERE status = 'active'`).toArray();
      affected = Number(rows[0]?.total ?? 0);
      if (deviceId) {
        this.sql.exec(`UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE device_id = ? AND status = 'active'`, now, deviceId);
      } else {
        this.sql.exec(`UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE status = 'active'`, now);
      }
      this.addOutbox('downloads.revoked', {
        deviceId: deviceId || null,
        leases_revoked: affected,
        by: 'operator',
        operator_id: operator.actorId,
        reason: operator.reason,
      });
    });
    await this.scheduleOutbox();
    return json({ success: true, data: { leases_revoked: affected } });
  }

  /// `POST /admin/resync` — re-emits the family's current state to the projection.
  ///
  /// The projection is queue-fed, so a dropped or dead-lettered event leaves D1 behind
  /// the authority with no way back except waiting for the next change. This emits a
  /// snapshot event rather than writing D1 directly, which keeps the authority the
  /// authority: the same consumer applies it through the same path as every other
  /// event, so a resync cannot produce a shape the normal flow could not.
  private async adminResync(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const operator = this.operatorFrom(body);
    if (!operator) return json({ success: false, error: 'actor_id and reason are required' }, 400);

    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);

    const children = this.sql.exec<{ id: string; nickname: string; age_track: string; status: string }>(
      'SELECT id, nickname, age_track, status FROM children ORDER BY created_at',
    ).toArray();
    const devices = this.sql.exec<{ id: string; platform: string; status: string; last_seen_at: number }>(
      'SELECT id, platform, status, last_seen_at FROM devices ORDER BY last_seen_at DESC',
    ).toArray();

    this.state.storage.transactionSync(() => {
      this.addOutbox('family.resynced', {
        plan: this.currentPlan(),
        status: family.status,
        children: children.map((child) => ({ id: child.id, age_track: child.age_track, status: child.status })),
        device_count: devices.length,
        active_device_count: devices.filter((device) => device.status === 'active').length,
        by: 'operator',
        operator_id: operator.actorId,
        reason: operator.reason,
      });
    });
    await this.scheduleOutbox();
    return json({
      success: true,
      data: {
        plan: this.currentPlan(),
        status: family.status,
        child_count: children.length,
        device_count: devices.length,
        active_device_count: devices.filter((device) => device.status === 'active').length,
      },
    });
  }

  /// `GET /admin/inspect` — the operator's read of the authority.
  ///
  /// Deliberately narrower than `/state`: no nicknames, no progress rows, no favourites.
  /// An operator answering "why can this family not watch anything" needs the plan, the
  /// entitlement ledger, the device list and the lease count, and nothing about what a
  /// specific child watched. `child_projection` already carries what little child data
  /// the admin is allowed, and duplicating more of it here would widen the surface for
  /// no operational gain.
  private async adminInspect() {
    const family = this.family();
    if (!family) return json({ success: false, error: 'Family not found' }, 404);
    const now = Date.now();

    const entitlements = this.sql.exec<{
      plan: string; status: string; source: string; expires_at: number | null; updated_at: number;
    }>(`
      SELECT plan, status, source, expires_at, updated_at FROM entitlements ORDER BY updated_at DESC
    `).toArray();
    const devices = this.sql.exec<{
      id: string; display_name: string | null; platform: string; status: string;
      registered_at: number; last_seen_at: number;
    }>(`
      SELECT id, display_name, platform, status, registered_at, last_seen_at
        FROM devices ORDER BY last_seen_at DESC
    `).toArray();
    const leases = this.sql.exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM playback_leases WHERE status = 'active' AND expires_at > ?`, now,
    ).toArray()[0];
    const sessions = this.sql.exec<{ total: number }>(
      `SELECT COUNT(*) AS total FROM auth_sessions WHERE status = 'active' AND expires_at > ?`, now,
    ).toArray()[0];
    const children = this.sql.exec<{ total: number; active: number }>(`
      SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active FROM children
    `).toArray()[0];
    // A count only. Customer 360 needs to know whether the family has used the product
    // at all; it must not receive what any individual child watched, and returning rows
    // here would put that in an operator's browser for no operational gain.
    const progress = this.sql.exec<{ total: number }>(
      'SELECT COUNT(*) AS total FROM content_progress',
    ).toArray()[0];

    return json({
      success: true,
      data: {
        parent_id: family.parent_id,
        status: family.status,
        base_plan: family.base_plan,
        effective_plan: this.currentPlan(now),
        // Exposed because it is the number that explains "why did every device sign
        // out": each revocation increments it and invalidates older sessions.
        auth_epoch: family.auth_epoch,
        entitlements,
        devices,
        active_leases: Number(leases?.total ?? 0),
        active_sessions: Number(sessions?.total ?? 0),
        child_count: Number(children?.total ?? 0),
        active_child_count: Number(children?.active ?? 0),
        progress_records: Number(progress?.total ?? 0),
      },
    });
  }

  private async initialize(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.slice(0, 80) : null;
    const identityEpoch = boundedInteger(body.identity_epoch, 1, Number.MAX_SAFE_INTEGER);
    if (!parentId || identityEpoch === null) return json({ success: false, error: 'parent_id and identity_epoch are required' }, 400);
    const existing = this.family();
    if (existing && existing.parent_id !== parentId) return json({ success: false, error: 'Family identity conflict' }, 409);
    if (existing && (existing.status !== 'active' || existing.deleted_at !== null)) {
      return json({ success: false, error: 'Account is not active' }, 410);
    }
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
    if (!family || family.status !== 'active' || family.deleted_at !== null
      || !sessionId || !refreshHash || !installationHash || !platform || expiresAt === null) {
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

  private async revokeAllSessions(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const reason = body.reason === 'password_reset' ? 'password_reset' : null;
    const operationId = typeof body.operation_id === 'string'
      && body.operation_id.length >= 8 && body.operation_id.length <= 200
      ? body.operation_id
      : null;
    const family = this.family();
    if (!parentId || !reason) {
      return json({ success: false, error: 'Invalid session revocation request' }, 400);
    }
    // An email can be verified and reset before the account's first login. In
    // that state no FamilyState row or session exists yet, so there is nothing
    // to revoke and the reset must not become permanently unusable.
    if (!family) {
      return json({
        success: true,
        data: { revoked: 0, auth_epoch: 1, family_initialized: false },
      });
    }
    if (family.parent_id !== parentId) {
      return json({ success: false, error: 'Invalid session revocation request' }, 400);
    }

    const idempotencyKey = operationId === null ? null : `password-reset:${operationId}`;
    if (idempotencyKey !== null) {
      const cached = this.sql.exec<{ response_json: string }>(`
        SELECT response_json FROM idempotency_keys
        WHERE key = ? AND operation = 'sessions_revoke_all' AND expires_at > ?
      `, idempotencyKey, Date.now()).toArray()[0];
      if (cached) return json(JSON.parse(cached.response_json));
    }

    const now = Date.now();
    const active = this.sql.exec<{ total: number }>(`
      SELECT COUNT(*) AS total FROM auth_sessions WHERE status = 'active'
    `).toArray()[0]?.total ?? 0;
    const response = {
      success: true,
      data: { revoked: active, auth_epoch: family.auth_epoch + 1 },
    };
    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        UPDATE auth_sessions SET status = 'revoked', revoked_at = ? WHERE status = 'active'
      `, now);
      this.sql.exec(`
        UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE status = 'active'
      `, now);
      this.sql.exec(`UPDATE family SET auth_epoch = auth_epoch + 1, updated_at = ? WHERE singleton = 1`, now);
      this.addOutbox('session.revoked', { scope: 'all', reason, count: active });
      if (idempotencyKey !== null) {
        this.sql.exec(`
          INSERT INTO idempotency_keys (key, operation, response_json, expires_at)
          VALUES (?, 'sessions_revoke_all', ?, ?)
          ON CONFLICT(key) DO UPDATE SET response_json = excluded.response_json,
            expires_at = excluded.expires_at
        `, idempotencyKey, JSON.stringify(response), now + 30 * 60 * 1000);
      }
    });
    await this.scheduleOutbox();
    return json(response);
  }

  private async revokeOtherSessions(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const session = this.activeSession(sessionId);
    const family = this.family();
    if (!session || !family) return json({ success: false, error: 'Unauthorized' }, 401);

    const now = Date.now();
    const nextEpoch = family.auth_epoch + 1;
    const revoked = this.sql.exec<{ total: number }>(`
      SELECT COUNT(*) AS total FROM auth_sessions WHERE id <> ? AND status = 'active'
    `, sessionId).toArray()[0]?.total ?? 0;
    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        UPDATE auth_sessions SET status = 'revoked', revoked_at = ?
        WHERE id <> ? AND status = 'active'
      `, now, sessionId);
      this.sql.exec(`
        UPDATE playback_leases SET status = 'revoked', ended_at = ?
        WHERE session_id <> ? AND status = 'active'
      `, now, sessionId);
      this.sql.exec(`UPDATE family SET auth_epoch = ?, updated_at = ? WHERE singleton = 1`, nextEpoch, now);
      this.sql.exec(`UPDATE auth_sessions SET auth_epoch = ?, last_seen_at = ? WHERE id = ?`, nextEpoch, now, sessionId);
      this.addOutbox('session.revoked', { scope: 'others', sessionId, count: revoked });
    });
    await this.scheduleOutbox();
    return json({
      success: true,
      data: {
        revoked,
        parent_id: family.parent_id,
        session_id: sessionId,
        device_id: session.device_id,
        plan: this.currentPlan(now),
        auth_epoch: nextEpoch,
      },
    });
  }

  private async updateProfile(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const operationId = typeof body.operation_id === 'string'
      && body.operation_id.length >= 8 && body.operation_id.length <= 200
      ? body.operation_id
      : '';
    const displayName = body.display_name === null
      ? null
      : typeof body.display_name === 'string' && body.display_name.trim().length > 0
        ? body.display_name.trim().slice(0, 80)
        : undefined;
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    if (!operationId || displayName === undefined) {
      return json({ success: false, error: 'A valid display_name and operation_id are required' }, 400);
    }

    // Guarantee a wake-up before persisting a new intent. Recheck the session
    // after the alarm I/O because another request may revoke it during await.
    await this.scheduleWork();
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);

    const existing = this.sql.exec<{
      display_name: string | null;
      status: string;
      intent_version: number;
    }>(`
      SELECT display_name, status, intent_version
      FROM profile_sync_jobs WHERE operation_id = ?
    `, operationId).toArray()[0];
    if (existing && existing.display_name !== displayName) {
      return json({ success: false, error: 'Idempotency key is bound to another profile update' }, 409);
    }
    if (existing?.status === 'completed') {
      return json({ success: true, data: { display_name: displayName, synchronized: true } });
    }

    const now = Date.now();
    if (!existing) {
      let intentVersion: number | null = null;
      this.state.storage.transactionSync(() => {
        const version = this.sql.exec<{ profile_intent_version: number }>(`
          UPDATE family
          SET profile_intent_version = profile_intent_version + 1, updated_at = ?
          WHERE singleton = 1 AND status = 'active' AND deleted_at IS NULL
          RETURNING profile_intent_version
        `, now).toArray()[0]?.profile_intent_version;
        if (!Number.isInteger(version)) return;
        intentVersion = version;
        this.sql.exec(`
          INSERT INTO profile_sync_jobs (
            operation_id, display_name, intent_version, status, attempts,
            next_attempt_at, updated_at
          ) VALUES (?, ?, ?, 'pending', 0, ?, ?)
        `, operationId, displayName, version, now, now);
      });
      if (intentVersion === null) {
        return json({ success: false, error: 'Account is not active' }, 410);
      }
    }
    const synchronized = await this.processNextProfileSyncJob(operationId);
    if (!synchronized) {
      return json({
        success: false,
        error: 'Profile synchronization is pending and will be retried',
        data: { operation_id: operationId, synchronized: false },
      }, 503);
    }
    return json({ success: true, data: { display_name: displayName, synchronized: true } });
  }

  private async exportData(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    const family = this.family();
    if (!family || family.deleted_at !== null) return json({ success: false, error: 'Family not found' }, 404);

    const parseJson = (value: string, fallback: unknown) => {
      try { return JSON.parse(value); } catch { return fallback; }
    };
    const children = this.sql.exec<{
      id: string;
      nickname: string;
      birth_month: number;
      birth_year: number;
      age_track: string;
      avatar_id: string;
      language: string;
      interests_json: string;
      status: string;
      created_at: number;
      updated_at: number;
    }>(`
      SELECT id, nickname, birth_month, birth_year, age_track, avatar_id, language,
             interests_json, status, created_at, updated_at
      FROM children ORDER BY created_at
    `).toArray().map((row) => ({
      ...row,
      interests: parseJson(row.interests_json, []),
      interests_json: undefined,
    }));
    const settings = this.sql.exec<{ child_id: string; settings_json: string; updated_at: number }>(`
      SELECT child_id, settings_json, updated_at FROM parental_settings ORDER BY child_id
    `).toArray().map((row) => ({
      child_id: row.child_id,
      settings: parseJson(row.settings_json, {}),
      updated_at: row.updated_at,
    }));
    const attempts = this.sql.exec<{
      id: string;
      child_id: string;
      episode_id: string | null;
      game_id: string | null;
      content_type: string | null;
      objective_id: string | null;
      score: number | null;
      max_score: number | null;
      answers_json: string;
      time_spent_seconds: number;
      help_used: number;
      created_at: number;
    }>(`
      SELECT id, child_id, episode_id, game_id, content_type, objective_id, score,
             max_score, answers_json, time_spent_seconds, help_used, created_at
      FROM attempts ORDER BY created_at
    `).toArray().map((row) => ({
      ...row,
      answers: parseJson(row.answers_json, []),
      answers_json: undefined,
    }));

    return json({
      success: true,
      data: {
        family: {
          parent_id: family.parent_id,
          display_name: family.display_name,
          status: family.status,
          base_plan: family.base_plan,
          effective_plan: this.currentPlan(),
        },
        children,
        parental_settings: settings,
        devices: this.sql.exec(`
          SELECT id, display_name, platform, status, registered_at, last_seen_at, revoked_at
          FROM devices ORDER BY registered_at
        `).toArray(),
        sessions: this.sql.exec(`
          SELECT id, device_id, status, expires_at, created_at, last_seen_at, revoked_at
          FROM auth_sessions ORDER BY created_at
        `).toArray(),
        entitlements: this.sql.exec(`
          SELECT id, source, plan, status, starts_at, expires_at, updated_at
          FROM entitlements ORDER BY updated_at
        `).toArray(),
        progress: this.sql.exec(`
          SELECT child_id, content_type, content_id, position_ms, duration_ms,
                 completed, sequence, updated_at
          FROM content_progress ORDER BY updated_at
        `).toArray(),
        attempts,
        mastery: this.sql.exec(`
          SELECT child_id, objective_id, level, attempts, correct_attempts, last_attempt_at
          FROM mastery ORDER BY child_id, objective_id
        `).toArray(),
        favorites: this.sql.exec(`
          SELECT child_id, entity_type, entity_id, created_at FROM favorites ORDER BY created_at
        `).toArray(),
        rewards: this.sql.exec(`
          SELECT id, child_id, reward_key, source_type, source_id, earned_at
          FROM rewards ORDER BY earned_at
        `).toArray(),
        creations: this.sql.exec(`
          SELECT id, child_id, game_id, drawing_mode, mime_type, width, height,
                 byte_size, created_at, updated_at, deleted_at
          FROM child_creations ORDER BY created_at
        `).toArray(),
        consents: this.sql.exec(`
          SELECT consent_type, child_id, version, granted_at, revoked_at
          FROM consents ORDER BY granted_at
        `).toArray(),
        playback: this.sql.exec(`
          SELECT id, child_id, device_id, asset_id, entity_type, entity_id, status,
                 expires_at, created_at, last_heartbeat_at, ended_at
          FROM playback_leases ORDER BY created_at
        `).toArray(),
      },
    });
  }

  private async lifecycleStatus(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    const expectedScope = body.scope === 'child' || body.scope === 'account' ? body.scope : null;
    const expectedChildId = typeof body.child_id === 'string' ? body.child_id : null;
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    const row = this.sql.exec<{
      request_id: string;
      scope: 'child' | 'account';
      child_id: string | null;
      status: string;
      attempts: number;
      requested_at: number;
      completed_at: number | null;
      last_error_code: string | null;
      updated_at: number;
    }>(`
      SELECT request_id, scope, child_id, status, attempts, requested_at,
             completed_at, last_error_code, updated_at
      FROM lifecycle_jobs WHERE request_id = ?
    `, requestId).toArray()[0];
    if (!row) return json({ success: false, error: 'Deletion request not found' }, 404);
    if ((expectedScope !== null && row.scope !== expectedScope)
      || (expectedScope === 'child' && row.child_id !== expectedChildId)) {
      return json({ success: false, error: 'Idempotency key is bound to another deletion request' }, 409);
    }
    return json({ success: true, data: row });
  }

  private async lifecycleStatusCapability(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    const receiptHash = typeof body.receipt_hash === 'string' ? body.receipt_hash : '';
    if (!requestId || !/^[A-Za-z0-9_-]{43}$/.test(receiptHash)) {
      return json({ success: false, error: 'Deletion receipt is invalid' }, 400);
    }
    const row = this.sql.exec<{
      request_id: string;
      scope: string;
      child_id: string | null;
      status: string;
      attempts: number;
      requested_at: number;
      completed_at: number | null;
      last_error_code: string | null;
      updated_at: number;
      receipt_hash: string | null;
    }>(`
      SELECT request_id, scope, child_id, status, attempts, requested_at,
             completed_at, last_error_code, updated_at, receipt_hash
      FROM lifecycle_jobs WHERE request_id = ? AND scope = 'account'
    `, requestId).toArray()[0];
    if (!row || row.receipt_hash !== receiptHash) {
      return json({ success: false, error: 'Deletion receipt is invalid' }, 404);
    }
    const { receipt_hash: _, ...safe } = row;
    return json({ success: true, data: safe });
  }

  private async requestLifecycle(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const requestId = typeof body.request_id === 'string' && body.request_id.length >= 8 && body.request_id.length <= 200
      ? body.request_id
      : '';
    const scope = body.scope === 'child' || body.scope === 'account' ? body.scope : null;
    const childId = scope === 'child' && typeof body.child_id === 'string' ? body.child_id : null;
    const receiptHash = scope === 'account' && typeof body.receipt_hash === 'string'
      && /^[A-Za-z0-9_-]{43}$/.test(body.receipt_hash)
      ? body.receipt_hash
      : null;
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    if (!requestId || !scope || (scope === 'child' && !childId) || (scope === 'account' && !receiptHash)) {
      return json({ success: false, error: 'Invalid deletion request' }, 400);
    }

    // Arm the worker before the irreversible acceptance transaction. A storage
    // alarm failure can still return 5xx here, but can never do so after the
    // account has been suspended or the child archived.
    await this.scheduleWork();
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);

    const existing = this.sql.exec<{
      request_id: string;
      scope: 'child' | 'account';
      child_id: string | null;
      status: string;
      attempts: number;
      requested_at: number;
      completed_at: number | null;
      last_error_code: string | null;
      updated_at: number;
      receipt_hash: string | null;
    }>(`
      SELECT request_id, scope, child_id, status, attempts, requested_at,
             completed_at, last_error_code, updated_at, receipt_hash
      FROM lifecycle_jobs WHERE request_id = ?
    `, requestId).toArray()[0];
    if (existing) {
      if (existing.scope !== scope || existing.child_id !== childId
        || (scope === 'account' && existing.receipt_hash !== receiptHash)) {
        return json({ success: false, error: 'Idempotency key is bound to another deletion request' }, 409);
      }
      const { receipt_hash: _, ...safe } = existing;
      return json({ success: true, data: safe }, 202);
    }
    if (scope === 'child' && !this.child(childId!)) {
      return json({ success: false, error: 'Active child profile not found' }, 404);
    }
    if (scope === 'account') {
      const pending = this.sql.exec<{ request_id: string }>(`
        SELECT request_id FROM lifecycle_jobs
        WHERE scope = 'account' AND status <> 'completed' LIMIT 1
      `).toArray()[0];
      if (pending) return json({ success: false, error: 'Account deletion is already pending' }, 409);
    }

    const now = Date.now();
    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        INSERT INTO lifecycle_jobs (
          request_id, scope, child_id, receipt_hash, status, attempts,
          requested_at, next_attempt_at, updated_at
        ) VALUES (?, ?, ?, ?, 'pending', 0, ?, ?, ?)
      `, requestId, scope, childId, receiptHash, now, now, now);
      if (scope === 'account') {
        this.sql.exec(`UPDATE family SET status = 'suspended', auth_epoch = auth_epoch + 1, updated_at = ? WHERE singleton = 1`, now);
        this.sql.exec(`UPDATE auth_sessions SET status = 'revoked', revoked_at = ? WHERE status = 'active'`, now);
        this.sql.exec(`UPDATE playback_leases SET status = 'revoked', ended_at = ? WHERE status = 'active'`, now);
      } else {
        // Archive immediately, before the asynchronous R2 sweep. Every
        // child-scoped write resolves through child(), which only returns active
        // rows, so no new progress/favorite/creation can race the deletion.
        this.sql.exec(`UPDATE children SET status = 'archived', updated_at = ? WHERE id = ? AND status = 'active'`, now, childId);
        this.sql.exec(`
          UPDATE playback_leases SET status = 'revoked', ended_at = ?
          WHERE child_id = ? AND status = 'active'
        `, now, childId);
      }
      this.addOutbox('family.deletion_requested', {
        requestId,
        scope,
        childId,
      });
    });
    return json({
      success: true,
      data: {
        request_id: requestId,
        scope,
        child_id: childId,
        status: 'pending',
        requested_at: now,
      },
    }, 202);
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

  // ---- Parent PIN and signed parent-proof state ----

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
    const row = this.sql.exec<{
      parent_id: string;
      parent_pin_hash: string | null;
      parent_pin_version: number;
    }>(`
      SELECT parent_id, parent_pin_hash, parent_pin_version
      FROM family WHERE singleton = 1
    `).toArray()[0];
    if (!row) return json({ success: false, error: 'Family not found' }, 404);

    const expectedPinVersion = boundedInteger(body.expected_pin_version, 1, Number.MAX_SAFE_INTEGER);
    if (row.parent_pin_hash && expectedPinVersion !== row.parent_pin_version) {
      return json({ success: false, error: 'A current parent proof is required to change the PIN' }, 403);
    }

    const hash = await hashPassword(pin);
    const now = Date.now();
    const nextPinVersion = Math.max(0, row.parent_pin_version) + 1;
    this.state.storage.transactionSync(() => {
      this.sql.exec(
        `UPDATE family
         SET parent_pin_hash = ?, parent_pin_failed_count = 0,
             parent_pin_locked_until = NULL, parent_pin_version = ?, updated_at = ?
         WHERE singleton = 1`,
        hash, nextPinVersion, now,
      );
      // Versioning invalidates proofs cryptographically; deleting consumed JTIs
      // also keeps this small state bounded after a credential change.
      this.sql.exec(`DELETE FROM used_parent_proofs`);
      this.addOutbox(row.parent_pin_hash ? 'parent_pin.changed' : 'parent_pin.enrolled', {
        parentId: row.parent_id,
        pinVersion: nextPinVersion,
      });
    });
    await this.scheduleOutbox();
    return json({
      success: true,
      data: {
        enrolled: true,
        changed: row.parent_pin_hash !== null,
        pin_version: nextPinVersion,
      },
    });
  }

  private async verifyParentPin(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const pin = typeof body.pin === 'string' ? body.pin : '';
    if (!this.activeSession(sessionId)) return json({ success: false, error: 'Unauthorized' }, 401);
    const row = this.sql.exec<{
      parent_pin_hash: string | null;
      parent_pin_failed_count: number;
      parent_pin_locked_until: number | null;
      parent_pin_version: number;
    }>(`
      SELECT parent_pin_hash, parent_pin_failed_count,
             parent_pin_locked_until, parent_pin_version
      FROM family WHERE singleton = 1
    `).toArray()[0];
    if (!row?.parent_pin_hash || row.parent_pin_version < 1) {
      return json({ success: false, error: 'No PIN has been set' }, 404);
    }
    const now = Date.now();
    if (row.parent_pin_locked_until !== null && row.parent_pin_locked_until > now) {
      return json({ success: false, error: 'Too many attempts', locked_until: row.parent_pin_locked_until }, 423);
    }
    // Clear stale lockout.
    if (row.parent_pin_locked_until !== null && row.parent_pin_locked_until <= now) {
      this.sql.exec(`UPDATE family SET parent_pin_failed_count = 0, parent_pin_locked_until = NULL WHERE singleton = 1`);
      row.parent_pin_failed_count = 0;
      row.parent_pin_locked_until = null;
    }
    const ok = await verifyPassword(pin, row.parent_pin_hash);
    if (ok) {
      this.sql.exec(`UPDATE family SET parent_pin_failed_count = 0, parent_pin_locked_until = NULL WHERE singleton = 1`);
      return json({
        success: true,
        data: { verified: true, pin_version: row.parent_pin_version },
      });
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

  private async validateParentProof(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : '';
    const expectedEpoch = boundedInteger(body.auth_epoch, 1, Number.MAX_SAFE_INTEGER);
    const pinVersion = boundedInteger(body.pin_version, 1, Number.MAX_SAFE_INTEGER);
    const expiresAt = boundedInteger(body.expires_at, Date.now() + 1, Date.now() + 10 * 60 * 1000);
    const purpose = typeof body.purpose === 'string' && /^[a-z_]{3,40}$/.test(body.purpose)
      ? body.purpose
      : '';
    const jti = typeof body.jti === 'string' && body.jti.length >= 16 && body.jti.length <= 128
      ? body.jti
      : '';
    const consume = body.consume === true;
    const family = this.family();
    const session = this.activeSession(sessionId);
    const pin = this.sql.exec<{ parent_pin_hash: string | null; parent_pin_version: number }>(`
      SELECT parent_pin_hash, parent_pin_version FROM family WHERE singleton = 1
    `).toArray()[0];
    if (!family || !session || expectedEpoch === null || pinVersion === null
      || expiresAt === null || !purpose || !jti || family.auth_epoch !== expectedEpoch
      || session.auth_epoch !== expectedEpoch || !pin?.parent_pin_hash
      || pin.parent_pin_version !== pinVersion) {
      return json({ success: false, error: 'Parent proof is invalid or expired' }, 403);
    }

    const now = Date.now();
    this.sql.exec(`DELETE FROM used_parent_proofs WHERE expires_at <= ?`, now);
    // A consumed destructive capability is invalid for both validation and
    // consumption. This blocks replay before callers perform password hashing
    // or mutate lockout counters.
    const alreadyUsed = this.sql.exec<{ jti: string }>(`
      SELECT jti FROM used_parent_proofs WHERE jti = ?
    `, jti).toArray()[0];
    if (alreadyUsed) {
      return json({ success: false, error: 'Parent proof has already been used' }, 403);
    }
    if (consume) {
      this.sql.exec(`
        INSERT INTO used_parent_proofs (jti, session_id, purpose, expires_at, used_at)
        VALUES (?, ?, ?, ?, ?)
      `, jti, sessionId, purpose, expiresAt, now);
    }

    return json({ success: true, data: { pin_version: pin.parent_pin_version } });
  }
}
