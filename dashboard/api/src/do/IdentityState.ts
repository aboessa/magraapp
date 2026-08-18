import { hashPassword, sha256Base64Url, verifyPassword } from '../lib/security.ts';
import { addColumn, applySchemaSteps, readSchemaState, type SchemaState } from '../lib/doSchema.ts';

type IdentityRow = {
  normalized_email: string;
  parent_id: string;
  display_name: string | null;
  password_hash: string;
  email_verified_at: number | null;
  auth_epoch: number;
  failed_login_count: number;
  locked_until: number | null;
  status: 'active' | 'deletion_pending' | 'deleted';
  deletion_request_id: string | null;
  deleted_at: number | null;
  profile_version: number;
};

const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const VERIFICATION_RESEND_INTERVAL_MS = 2 * 60 * 1000;
const PASSWORD_RESET_RESEND_INTERVAL_MS = 2 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 12 && value.length <= 256;
}

/**
 * Column additions for `IdentityState`, applied by version. Append only.
 *
 * Numbered independently of `FamilyState`: the two objects have separate storage
 * and separate version rows.
 */
export const IDENTITY_SCHEMA_STEPS = [
  addColumn('identity', 'status', "TEXT NOT NULL DEFAULT 'active'", 1),
  addColumn('identity', 'deletion_request_id', 'TEXT', 2),
  addColumn('identity', 'deleted_at', 'INTEGER', 3),
  addColumn('identity', 'profile_version', 'INTEGER NOT NULL DEFAULT 0', 4),
  addColumn('password_reset_tokens', 'pending_password_hash', 'TEXT', 5),
  addColumn('password_reset_tokens', 'claimed_at', 'INTEGER', 6),
  addColumn('password_reset_tokens', 'completed_at', 'INTEGER', 7),
];

export const IDENTITY_SCHEMA_VERSION = IDENTITY_SCHEMA_STEPS
  .reduce((highest, step) => Math.max(highest, step.version), 0);

export class IdentityState {
  private readonly state: DurableObjectState;
  private readonly sql: SqlStorage;
  /**
   * Result of the most recent schema run, or null when the schema has not been
   * created yet.
   *
   * Not `readonly`: unlike `FamilyState`, this object deliberately creates no
   * storage until a real identity exists, so the run happens in `ensureSchema`
   * rather than the constructor. A random login probe must not allocate storage.
   */
  private schema: SchemaState | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sql = state.storage.sql;
    // A random login probe must not create durable storage. Schema creation and
    // upgrades run only after registration or when a real identity already exists.
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (request.method === 'GET' && path === '/schema') {
        // Reported without creating storage: an object that has never registered
        // legitimately has no schema, and probing it must not allocate one.
        return json({
          success: true,
          data: this.schemaExists()
            ? {
              object: 'IdentityState',
              ...readSchemaState(this.sql),
              expected_version: IDENTITY_SCHEMA_VERSION,
              last_run: this.schema,
            }
            : { object: 'IdentityState', version: null, expected_version: IDENTITY_SCHEMA_VERSION, provisioned: false },
        });
      }
      if (request.method === 'POST' && path === '/register') return await this.register(request);
      if (request.method === 'POST' && path === '/verify-email') return await this.verifyEmail(request);
      if (request.method === 'POST' && path === '/verification-request') return this.verificationRequest();
      if (request.method === 'POST' && path === '/verification-request/cancel') return await this.cancelVerificationRequest(request);
      if (request.method === 'POST' && path === '/login') return await this.login(request);
      if (request.method === 'POST' && path === '/profile') return await this.profile(request);
      if (request.method === 'POST' && path === '/profile/update') return await this.updateProfile(request);
      if (request.method === 'POST' && path === '/password/verify') return await this.verifyCurrentPassword(request);
      if (request.method === 'POST' && path === '/password/change') return await this.changePassword(request);
      if (request.method === 'POST' && path === '/password-reset/request') return await this.passwordResetRequest(request);
      if (request.method === 'POST' && path === '/password-reset/prepare') return await this.preparePasswordReset(request);
      if (request.method === 'POST' && path === '/password-reset/commit') return await this.commitPasswordReset(request);
      if (request.method === 'POST' && path === '/password-reset/cancel') return await this.cancelPasswordReset(request);
      if (request.method === 'POST' && path === '/account/deletion-pending') return await this.markDeletionPending(request);
      if (request.method === 'POST' && path === '/account/delete') return await this.deleteAccount(request);
      return json({ success: false, error: 'Identity operation not found' }, 404);
    } catch (error) {
      console.error('identity_do_error', error instanceof Error ? error.message : String(error));
      return json({ success: false, error: 'Identity service unavailable' }, 500);
    }
  }

  private schemaExists() {
    return Boolean(this.sql.exec<{ present: number }>(`
      SELECT 1 AS present FROM sqlite_master
      WHERE type = 'table' AND name = 'identity' LIMIT 1
    `).toArray()[0]);
  }

  private ensureSchema() {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS identity (
        singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
        normalized_email TEXT NOT NULL UNIQUE,
        parent_id TEXT NOT NULL UNIQUE,
        display_name TEXT,
        password_hash TEXT NOT NULL,
        email_verified_at INTEGER,
        auth_epoch INTEGER NOT NULL DEFAULT 1 CHECK (auth_epoch = 1),
        failed_login_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
        locked_until INTEGER,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'deletion_pending', 'deleted')),
        deletion_request_id TEXT,
        deleted_at INTEGER,
        profile_version INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        response_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        jti_hash TEXT PRIMARY KEY,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        used_at INTEGER,
        pending_password_hash TEXT,
        claimed_at INTEGER,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_identity_parent ON identity(parent_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_expiry
        ON password_reset_tokens(expires_at, used_at);
    `);
    // Column additions by version. These were seven `try { ALTER } catch {}`
    // lines, so a genuine failure looked exactly like "already applied" — and this
    // object holds the credential and password-reset ledger, where a missing
    // column is a security-relevant divergence, not a cosmetic one.
    this.schema = applySchemaSteps(this.sql, IDENTITY_SCHEMA_STEPS, 'IdentityState');
  }

  private prepareExisting() {
    if (!this.schemaExists()) return false;
    this.ensureSchema();
    return true;
  }

  private first(): IdentityRow | null {
    if (!this.prepareExisting()) return null;
    return this.sql.exec<IdentityRow>('SELECT * FROM identity WHERE singleton = 1').toArray()[0] ?? null;
  }

  private async register(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const normalizedEmail = typeof body.normalized_email === 'string' ? body.normalized_email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.slice(0, 80) : null;
    const idempotencyKey = typeof body.idempotency_key === 'string' && body.idempotency_key.length <= 200 ? body.idempotency_key : '';
    if (!normalizedEmail || !validPassword(password) || !idempotencyKey) {
      return json({ success: false, error: 'Invalid registration request' }, 400);
    }

    this.ensureSchema();
    const cached = this.sql.exec<{ response_json: string }>(`
      SELECT response_json FROM idempotency_keys WHERE key = ? AND operation = 'register' AND expires_at > ?
    `, idempotencyKey, Date.now()).toArray()[0];
    if (cached) return json(JSON.parse(cached.response_json), 201);
    if (this.first()) return json({ success: false, error: 'Unable to create this account' }, 409);

    const parentId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);
    const now = Date.now();
    const response = { success: true, data: { parent_id: parentId, display_name: displayName, auth_epoch: 1 } };
    this.state.storage.transactionSync(() => {
      this.sql.exec(`
        INSERT INTO identity (
          singleton, normalized_email, parent_id, display_name, password_hash,
          created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?)
      `, normalizedEmail, parentId, displayName, passwordHash, now, now);
      this.sql.exec(`
        INSERT INTO idempotency_keys (key, operation, response_json, expires_at)
        VALUES (?, 'register', ?, ?)
      `, idempotencyKey, JSON.stringify(response), now + 24 * 60 * 60 * 1000);
    });
    return json(response, 201);
  }

  private verifyEmail(request: Request) {
    const bodyPromise = request.json() as Promise<Record<string, unknown>>;
    return bodyPromise.then((body) => {
      const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
      const normalizedEmail = typeof body.normalized_email === 'string' ? body.normalized_email : '';
      const identity = this.first();
      if (!identity || identity.status !== 'active' || identity.parent_id !== parentId
        || identity.normalized_email !== normalizedEmail) {
        return json({ success: false, error: 'Verification token is invalid or expired' }, 400);
      }
      const now = Date.now();
      this.sql.exec(`
        UPDATE identity SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE singleton = 1
      `, now, now);
      return json({ success: true, data: { verified: true } });
    });
  }

  private verificationRequest() {
    const identity = this.first();
    const now = Date.now();
    if (!identity || identity.status !== 'active' || identity.email_verified_at !== null) {
      return json({ success: true, data: { resend: false } });
    }
    const throttle = this.sql.exec<{ expires_at: number }>(`
      SELECT expires_at FROM idempotency_keys
      WHERE operation = 'verification_resend' AND expires_at > ?
      LIMIT 1
    `, now).toArray()[0];
    if (throttle) return json({ success: true, data: { resend: false } });

    const deliveryId = crypto.randomUUID();
    this.sql.exec(`
      INSERT INTO idempotency_keys (key, operation, response_json, expires_at)
      VALUES (?, 'verification_resend', '{}', ?)
    `, deliveryId, now + VERIFICATION_RESEND_INTERVAL_MS);
    return json({
      success: true,
      data: {
        resend: true,
        delivery_id: deliveryId,
        parent_id: identity.parent_id,
        normalized_email: identity.normalized_email,
      },
    });
  }

  private async cancelVerificationRequest(request: Request) {
    const body = await this.readBody(request);
    const deliveryId = typeof body.delivery_id === 'string' ? body.delivery_id : '';
    if (!deliveryId) return json({ success: false, error: 'Invalid delivery request' }, 400);
    const removed = this.sql.exec(`
      DELETE FROM idempotency_keys
      WHERE key = ? AND operation = 'verification_resend'
      RETURNING key
    `, deliveryId).toArray().length > 0;
    return json({ success: true, data: { cancelled: removed } });
  }

  private async login(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const password = typeof body.password === 'string' ? body.password : '';
    const normalizedEmail = typeof body.normalized_email === 'string' ? body.normalized_email : '';
    const identity = this.first();
    const now = Date.now();
    if (!identity || identity.status !== 'active' || identity.email_verified_at === null
      || identity.normalized_email !== normalizedEmail) {
      return json({ success: false, error: 'Invalid email or password' }, 401);
    }
    if (identity.locked_until !== null && identity.locked_until > now) {
      return json({ success: false, error: 'Too many attempts. Please try again later.' }, 429);
    }

    const valid = await verifyPassword(password, identity.password_hash);
    const current = this.first();
    if (!current || current.status !== 'active' || current.parent_id !== identity.parent_id
      || current.normalized_email !== normalizedEmail
      || current.password_hash !== identity.password_hash) {
      return json({ success: false, error: 'Invalid email or password' }, 401);
    }
    if (!valid) {
      const failures = current.failed_login_count + 1;
      const lockedUntil = failures >= MAX_LOGIN_FAILURES ? now + LOCK_DURATION_MS : null;
      this.sql.exec(`
        UPDATE identity SET failed_login_count = ?, locked_until = ?, updated_at = ?
        WHERE singleton = 1 AND status = 'active' AND parent_id = ? AND password_hash = ?
      `, failures >= MAX_LOGIN_FAILURES ? 0 : failures, lockedUntil, now,
      current.parent_id, current.password_hash);
      return json({ success: false, error: 'Invalid email or password' }, 401);
    }

    const updated = this.sql.exec(`
      UPDATE identity SET failed_login_count = 0, locked_until = NULL, updated_at = ?
      WHERE singleton = 1 AND status = 'active' AND parent_id = ? AND password_hash = ?
      RETURNING parent_id
    `, now, current.parent_id, current.password_hash).toArray();
    if (!updated.length) return json({ success: false, error: 'Invalid email or password' }, 401);
    return json({
      success: true,
      data: {
        parent_id: current.parent_id,
        display_name: current.display_name,
        normalized_email: current.normalized_email,
        identity_epoch: current.auth_epoch,
      },
    });
  }

  private async readBody(request: Request) {
    return await request.json() as Record<string, unknown>;
  }

  private profile(request: Request) {
    return this.readBody(request).then((body) => {
      const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
      const identity = this.first();
      if (!identity || identity.status !== 'active' || identity.parent_id !== parentId) {
        return json({ success: false, error: 'Account identity is unavailable' }, 404);
      }
      return json({
        success: true,
        data: {
          parent_id: identity.parent_id,
          display_name: identity.display_name,
          email: identity.normalized_email,
          email_verified: identity.email_verified_at !== null,
        },
      });
    });
  }

  private updateProfile(request: Request) {
    return this.readBody(request).then((body) => {
      const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
      const displayName = body.display_name === null
        ? null
        : typeof body.display_name === 'string' && body.display_name.trim().length > 0
          ? body.display_name.trim().slice(0, 80)
          : undefined;
      const profileVersion = typeof body.profile_version === 'number'
        && Number.isInteger(body.profile_version) && body.profile_version >= 1
        ? body.profile_version
        : null;
      const identity = this.first();
      if (!identity || identity.status !== 'active' || identity.parent_id !== parentId) {
        return json({ success: false, error: 'Account identity is unavailable' }, 404);
      }
      if (displayName === undefined || profileVersion === null) {
        return json({ success: false, error: 'A valid display_name and profile_version are required' }, 400);
      }
      const now = Date.now();
      const updated = this.sql.exec(`
        UPDATE identity
        SET display_name = ?, profile_version = ?, updated_at = ?
        WHERE singleton = 1 AND status = 'active' AND profile_version <= ?
        RETURNING parent_id
      `, displayName, profileVersion, now, profileVersion).toArray();
      const current = this.first();
      if (!current || current.status !== 'active') {
        return json({ success: false, error: 'Account identity is unavailable' }, 404);
      }
      return json({
        success: true,
        data: {
          display_name: current.display_name,
          profile_version: current.profile_version,
          applied: updated.length === 1,
        },
      });
    });
  }

  private async checkCurrentPassword(identity: IdentityRow, candidate: string) {
    const initialNow = Date.now();
    const expectedHash = identity.password_hash;
    if (identity.locked_until !== null && identity.locked_until > initialNow) return 'locked' as const;
    if (identity.locked_until !== null) {
      const unlocked = this.sql.exec(`
        UPDATE identity SET failed_login_count = 0, locked_until = NULL, updated_at = ?
        WHERE singleton = 1 AND status = 'active' AND parent_id = ? AND password_hash = ?
        RETURNING parent_id
      `, initialNow, identity.parent_id, expectedHash).toArray();
      if (!unlocked.length) return 'unavailable' as const;
    }

    const passwordMatches = await verifyPassword(candidate, expectedHash);
    const current = this.first();
    const now = Date.now();
    if (!current || current.status !== 'active' || current.parent_id !== identity.parent_id
      || current.password_hash !== expectedHash) {
      return 'unavailable' as const;
    }
    if (current.locked_until !== null && current.locked_until > now) return 'locked' as const;

    if (passwordMatches) {
      const updated = this.sql.exec(`
        UPDATE identity SET failed_login_count = 0, locked_until = NULL, updated_at = ?
        WHERE singleton = 1 AND status = 'active' AND parent_id = ? AND password_hash = ?
        RETURNING parent_id
      `, now, identity.parent_id, expectedHash).toArray();
      return updated.length === 1 ? 'valid' as const : 'unavailable' as const;
    }

    const failures = current.failed_login_count + 1;
    const lockedUntil = failures >= MAX_LOGIN_FAILURES ? now + LOCK_DURATION_MS : null;
    const updated = this.sql.exec(`
      UPDATE identity SET failed_login_count = ?, locked_until = ?, updated_at = ?
      WHERE singleton = 1 AND status = 'active' AND parent_id = ? AND password_hash = ?
      RETURNING parent_id
    `, failures >= MAX_LOGIN_FAILURES ? 0 : failures, lockedUntil, now,
    identity.parent_id, expectedHash).toArray();
    if (!updated.length) return 'unavailable' as const;
    return lockedUntil === null ? 'invalid' as const : 'locked' as const;
  }

  private async verifyCurrentPassword(request: Request) {
    const body = await this.readBody(request);
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const candidate = typeof body.password === 'string' ? body.password : '';
    const nextPassword = body.new_password;
    const identity = this.first();
    if (!identity || identity.status !== 'active' || identity.parent_id !== parentId) {
      return json({ success: false, error: 'Current password is incorrect' }, 403);
    }
    if (nextPassword !== undefined && !validPassword(nextPassword)) {
      return json({ success: false, error: 'The new password must contain at least 12 characters' }, 400);
    }
    const result = await this.checkCurrentPassword(identity, candidate);
    if (result === 'locked') {
      return json({ success: false, error: 'Too many attempts. Please try again later.' }, 429);
    }
    if (result !== 'valid') return json({ success: false, error: 'Current password is incorrect' }, 403);
    const nextMatchesCurrent = typeof nextPassword === 'string'
      ? await verifyPassword(nextPassword, identity.password_hash)
      : false;
    const current = this.first();
    if (!current || current.status !== 'active' || current.parent_id !== parentId
      || current.password_hash !== identity.password_hash) {
      return json({ success: false, error: 'Current password is incorrect' }, 403);
    }
    if (nextMatchesCurrent) {
      return json({ success: false, error: 'The new password must be different' }, 400);
    }
    return json({ success: true, data: { verified: true } });
  }

  private async changePassword(request: Request) {
    const body = await this.readBody(request);
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const currentPassword = typeof body.current_password === 'string' ? body.current_password : '';
    const nextPassword = body.new_password;
    const identity = this.first();
    if (!identity || identity.status !== 'active' || identity.parent_id !== parentId) {
      return json({ success: false, error: 'Account identity is unavailable' }, 404);
    }
    if (!validPassword(nextPassword)) {
      return json({ success: false, error: 'The new password must contain at least 12 characters' }, 400);
    }
    const currentResult = await this.checkCurrentPassword(identity, currentPassword);
    if (currentResult === 'locked') {
      return json({ success: false, error: 'Too many attempts. Please try again later.' }, 429);
    }
    if (currentResult !== 'valid') {
      return json({ success: false, error: 'Current password is incorrect' }, 403);
    }
    const nextMatchesCurrent = await verifyPassword(nextPassword, identity.password_hash);
    let current = this.first();
    if (!current || current.status !== 'active' || current.parent_id !== parentId
      || current.password_hash !== identity.password_hash) {
      return json({ success: false, error: 'Account identity is unavailable' }, 404);
    }
    if (nextMatchesCurrent) {
      return json({ success: false, error: 'The new password must be different' }, 400);
    }
    const nextHash = await hashPassword(nextPassword);
    current = this.first();
    if (!current || current.status !== 'active' || current.parent_id !== parentId
      || current.password_hash !== identity.password_hash) {
      return json({ success: false, error: 'Account identity is unavailable' }, 404);
    }
    const updated = this.sql.exec(`
      UPDATE identity SET password_hash = ?, failed_login_count = 0,
        locked_until = NULL, updated_at = ?
      WHERE singleton = 1 AND status = 'active' AND parent_id = ? AND password_hash = ?
      RETURNING parent_id
    `, nextHash, Date.now(), parentId, identity.password_hash).toArray();
    if (!updated.length) {
      return json({ success: false, error: 'Account identity is unavailable' }, 404);
    }
    return json({ success: true, data: { changed: true } });
  }

  private async passwordResetRequest(request: Request) {
    const body = await this.readBody(request);
    const normalizedEmail = typeof body.normalized_email === 'string' ? body.normalized_email : '';
    const identity = this.first();
    const now = Date.now();
    if (!identity || identity.status !== 'active' || identity.email_verified_at === null
      || identity.normalized_email !== normalizedEmail) {
      return json({ success: true, data: { issue: false } });
    }
    const throttle = this.sql.exec<{ expires_at: number }>(`
      SELECT expires_at FROM idempotency_keys
      WHERE operation = 'password_reset_request' AND expires_at > ?
      LIMIT 1
    `, now).toArray()[0];
    if (throttle) return json({ success: true, data: { issue: false } });

    const jti = crypto.randomUUID();
    const jtiHash = await sha256Base64Url(jti);
    const expiresAt = now + PASSWORD_RESET_TTL_MS;
    let issued = false;
    this.state.storage.transactionSync(() => {
      // Recheck identity state after the asynchronous digest. Account deletion
      // may have fenced this object while WebCrypto was running.
      const currentIdentity = this.first();
      if (!currentIdentity || currentIdentity.status !== 'active'
        || currentIdentity.parent_id !== identity.parent_id
        || currentIdentity.normalized_email !== normalizedEmail
        || currentIdentity.email_verified_at === null) return;

      // Recheck after the asynchronous digest so interleaved requests cannot
      // both mint reset capabilities for this identity.
      const currentThrottle = this.sql.exec<{ expires_at: number }>(`
        SELECT expires_at FROM idempotency_keys
        WHERE operation = 'password_reset_request' AND expires_at > ?
        LIMIT 1
      `, now).toArray()[0];
      if (currentThrottle) return;

      // A newly issued reset supersedes every older JTI, including an unused
      // token whose email may still be open on another device.
      this.sql.exec(`DELETE FROM password_reset_tokens`);
      this.sql.exec(`DELETE FROM idempotency_keys WHERE operation = 'password_reset_request'`);
      this.sql.exec(`
        INSERT INTO password_reset_tokens (jti_hash, expires_at, created_at)
        VALUES (?, ?, ?)
      `, jtiHash, expiresAt, now);
      this.sql.exec(`
        INSERT INTO idempotency_keys (key, operation, response_json, expires_at)
        VALUES (?, 'password_reset_request', '{}', ?)
      `, `password-reset:${jtiHash}`, now + PASSWORD_RESET_RESEND_INTERVAL_MS);
      issued = true;
    });
    if (!issued) return json({ success: true, data: { issue: false } });

    return json({
      success: true,
      data: {
        issue: true,
        parent_id: identity.parent_id,
        normalized_email: identity.normalized_email,
        jti,
        expires_at: expiresAt,
      },
    });
  }

  private async preparePasswordReset(request: Request) {
    const body = await this.readBody(request);
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const jti = typeof body.jti === 'string' ? body.jti : '';
    const nextPassword = body.new_password;
    const identity = this.first();
    if (!identity || identity.status !== 'active' || identity.parent_id !== parentId
      || !jti || !validPassword(nextPassword)) {
      return json({ success: false, error: 'Password reset token is invalid or expired' }, 400);
    }

    const jtiHash = await sha256Base64Url(jti);
    const now = Date.now();
    const token = this.sql.exec<{
      expires_at: number;
      pending_password_hash: string | null;
      completed_at: number | null;
    }>(`
      SELECT expires_at, pending_password_hash, completed_at
      FROM password_reset_tokens WHERE jti_hash = ?
    `, jtiHash).toArray()[0];
    if (!token || token.expires_at <= now || token.completed_at !== null) {
      return json({ success: false, error: 'Password reset token is invalid or expired' }, 400);
    }
    if (token.pending_password_hash !== null) {
      const matchesPending = await verifyPassword(nextPassword, token.pending_password_hash);
      const currentIdentity = this.first();
      if (!currentIdentity || currentIdentity.status !== 'active'
        || currentIdentity.parent_id !== parentId) {
        return json({ success: false, error: 'Password reset token is invalid or expired' }, 400);
      }
      if (!matchesPending) {
        return json({ success: false, error: 'Password reset is already pending with different credentials' }, 409);
      }
      return json({
        success: true,
        data: { prepared: true, already_prepared: true, parent_id: currentIdentity.parent_id },
      });
    }

    const nextHash = await hashPassword(nextPassword);
    let claimed = false;
    let competingHash: string | null = null;
    this.state.storage.transactionSync(() => {
      const currentIdentity = this.first();
      if (!currentIdentity || currentIdentity.status !== 'active'
        || currentIdentity.parent_id !== parentId) return;
      const current = this.sql.exec<{
        expires_at: number;
        pending_password_hash: string | null;
        completed_at: number | null;
      }>(`
        SELECT expires_at, pending_password_hash, completed_at
        FROM password_reset_tokens WHERE jti_hash = ?
      `, jtiHash).toArray()[0];
      if (!current || current.expires_at <= Date.now() || current.completed_at !== null) return;
      if (current.pending_password_hash !== null) {
        competingHash = current.pending_password_hash;
        return;
      }
      const updated = this.sql.exec(`
        UPDATE password_reset_tokens
        SET pending_password_hash = ?, claimed_at = ?
        WHERE jti_hash = ? AND pending_password_hash IS NULL AND completed_at IS NULL
        RETURNING jti_hash
      `, nextHash, Date.now(), jtiHash).toArray();
      claimed = updated.length === 1;
    });

    if (!claimed) {
      if (competingHash !== null) {
        const matchesCompeting = await verifyPassword(nextPassword, competingHash);
        const currentIdentity = this.first();
        if (matchesCompeting && currentIdentity?.status === 'active'
          && currentIdentity.parent_id === parentId) {
          return json({
            success: true,
            data: { prepared: true, already_prepared: true, parent_id: currentIdentity.parent_id },
          });
        }
      }
      return json({ success: false, error: 'Password reset token is invalid or expired' }, 400);
    }
    return json({
      success: true,
      data: { prepared: true, already_prepared: false, parent_id: identity.parent_id },
    });
  }

  private async commitPasswordReset(request: Request) {
    const body = await this.readBody(request);
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const jti = typeof body.jti === 'string' ? body.jti : '';
    const identity = this.first();
    if (!identity || identity.status !== 'active' || identity.parent_id !== parentId || !jti) {
      return json({ success: false, error: 'Password reset token is invalid or expired' }, 400);
    }

    const jtiHash = await sha256Base64Url(jti);
    const now = Date.now();
    let committed = false;
    this.state.storage.transactionSync(() => {
      const currentIdentity = this.first();
      if (!currentIdentity || currentIdentity.status !== 'active'
        || currentIdentity.parent_id !== parentId) return;
      const token = this.sql.exec<{
        expires_at: number;
        pending_password_hash: string | null;
        completed_at: number | null;
      }>(`
        SELECT expires_at, pending_password_hash, completed_at
        FROM password_reset_tokens WHERE jti_hash = ?
      `, jtiHash).toArray()[0];
      if (!token || token.expires_at <= now || token.completed_at !== null
        || token.pending_password_hash === null) return;

      const identityUpdated = this.sql.exec(`
        UPDATE identity SET password_hash = ?, failed_login_count = 0,
          locked_until = NULL, updated_at = ?
        WHERE singleton = 1 AND status = 'active' AND parent_id = ?
        RETURNING parent_id
      `, token.pending_password_hash, now, parentId).toArray();
      if (!identityUpdated.length) return;
      const tokenUpdated = this.sql.exec(`
        UPDATE password_reset_tokens
        SET used_at = ?, completed_at = ?, pending_password_hash = NULL
        WHERE jti_hash = ? AND completed_at IS NULL
        RETURNING jti_hash
      `, now, now, jtiHash).toArray();
      if (!tokenUpdated.length) throw new Error('password_reset_commit_conflict');
      this.sql.exec(`DELETE FROM password_reset_tokens WHERE jti_hash <> ?`, jtiHash);
      this.sql.exec(`DELETE FROM idempotency_keys WHERE operation = 'password_reset_request'`);
      committed = true;
    });
    if (!committed) {
      // A completed token is deliberately not replay-successful: possession of
      // an old link must never become an oracle for account state.
      return json({ success: false, error: 'Password reset token is invalid or expired' }, 400);
    }
    return json({ success: true, data: { changed: true, parent_id: identity.parent_id } });
  }

  private async cancelPasswordReset(request: Request) {
    const body = await this.readBody(request);
    const jti = typeof body.jti === 'string' ? body.jti : '';
    if (!jti) return json({ success: false, error: 'Invalid delivery request' }, 400);
    const jtiHash = await sha256Base64Url(jti);
    let cancelled = false;
    this.state.storage.transactionSync(() => {
      const token = this.sql.exec<{
        pending_password_hash: string | null;
        completed_at: number | null;
      }>(`
        SELECT pending_password_hash, completed_at
        FROM password_reset_tokens WHERE jti_hash = ?
      `, jtiHash).toArray()[0];
      if (!token || token.pending_password_hash !== null || token.completed_at !== null) return;
      this.sql.exec(`DELETE FROM password_reset_tokens WHERE jti_hash = ?`, jtiHash);
      this.sql.exec(`
        DELETE FROM idempotency_keys
        WHERE key = ? AND operation = 'password_reset_request'
      `, `password-reset:${jtiHash}`);
      cancelled = true;
    });
    return json({ success: true, data: { cancelled } });
  }

  private async markDeletionPending(request: Request) {
    const body = await this.readBody(request);
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const requestId = typeof body.request_id === 'string' && body.request_id.length >= 8 && body.request_id.length <= 200
      ? body.request_id
      : '';
    const identity = this.first();
    if (!identity || identity.parent_id !== parentId || !requestId) {
      return json({ success: false, error: 'Account identity is unavailable' }, 404);
    }
    if (identity.status === 'deleted') {
      return json({
        success: true,
        data: { deletion_pending: false, deleted: true, request_id: identity.deletion_request_id },
      });
    }
    if (identity.deletion_request_id && identity.deletion_request_id !== requestId) {
      return json({ success: false, error: 'A different account deletion is already pending' }, 409);
    }
    this.sql.exec(`
      UPDATE identity SET status = 'deletion_pending', deletion_request_id = ?, updated_at = ?
      WHERE singleton = 1
    `, requestId, Date.now());
    return json({ success: true, data: { deletion_pending: true, request_id: requestId } });
  }

  private async deleteAccount(request: Request) {
    const body = await this.readBody(request);
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const requestId = typeof body.request_id === 'string' ? body.request_id : '';
    const identity = this.first();
    if (!identity || identity.parent_id !== parentId || !requestId) {
      return json({ success: false, error: 'Account identity is unavailable' }, 404);
    }
    if (identity.status === 'deleted') {
      return json({ success: true, data: { deleted: true, already_deleted: true } });
    }
    if (identity.status !== 'deletion_pending' || identity.deletion_request_id !== requestId) {
      return json({ success: false, error: 'Account deletion has not been authorized' }, 409);
    }

    const tombstonePassword = await hashPassword(`${crypto.randomUUID()}${crypto.randomUUID()}`);
    const tombstoneEmail = `deleted-${crypto.randomUUID()}@invalid.local`;
    const now = Date.now();
    let deleted = false;
    this.state.storage.transactionSync(() => {
      const updated = this.sql.exec(`
        UPDATE identity SET normalized_email = ?, display_name = NULL,
          password_hash = ?, email_verified_at = NULL, status = 'deleted',
          deleted_at = ?, failed_login_count = 0, locked_until = NULL, updated_at = ?
        WHERE singleton = 1 AND status = 'deletion_pending'
          AND parent_id = ? AND deletion_request_id = ?
        RETURNING parent_id
      `, tombstoneEmail, tombstonePassword, now, now, parentId, requestId).toArray();
      if (!updated.length) return;
      this.sql.exec(`DELETE FROM password_reset_tokens`);
      this.sql.exec(`DELETE FROM idempotency_keys`);
      deleted = true;
    });
    if (!deleted) {
      const current = this.first();
      if (current?.status === 'deleted' && current.parent_id === parentId
        && current.deletion_request_id === requestId) {
        return json({ success: true, data: { deleted: true, already_deleted: true } });
      }
      return json({ success: false, error: 'Account deletion has not been authorized' }, 409);
    }
    return json({ success: true, data: { deleted: true, already_deleted: false } });
  }
}
