import { hashPassword, verifyPassword } from '../lib/security';

type IdentityRow = {
  normalized_email: string;
  parent_id: string;
  display_name: string | null;
  password_hash: string;
  email_verified_at: number | null;
  auth_epoch: number;
  failed_login_count: number;
  locked_until: number | null;
};

const MAX_LOGIN_FAILURES = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const VERIFICATION_RESEND_INTERVAL_MS = 2 * 60 * 1000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export class IdentityState {
  private readonly state: DurableObjectState;
  private readonly sql: SqlStorage;

  constructor(state: DurableObjectState) {
    this.state = state;
    this.sql = state.storage.sql;
    // Do not initialize SQLite here. A login attempt for a random email may
    // instantiate a DO, but it must not create durable storage. Only a valid
    // registration request calls ensureSchema().
  }

  async fetch(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    try {
      if (request.method === 'POST' && path === '/register') return await this.register(request);
      if (request.method === 'POST' && path === '/verify-email') return this.verifyEmail(request);
      if (request.method === 'POST' && path === '/verification-request') return this.verificationRequest();
      if (request.method === 'POST' && path === '/login') return await this.login(request);
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
    if (this.schemaExists()) return;
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
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        response_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_identity_parent ON identity(parent_id);
    `);
  }

  private first(): IdentityRow | null {
    if (!this.schemaExists()) return null;
    return this.sql.exec<IdentityRow>('SELECT * FROM identity WHERE singleton = 1').toArray()[0] ?? null;
  }

  private async register(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const normalizedEmail = typeof body.normalized_email === 'string' ? body.normalized_email : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = typeof body.display_name === 'string' ? body.display_name.slice(0, 80) : null;
    const idempotencyKey = typeof body.idempotency_key === 'string' && body.idempotency_key.length <= 200 ? body.idempotency_key : '';
    if (!normalizedEmail || password.length < 12 || !idempotencyKey) {
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

  private async verifyEmail(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const parentId = typeof body.parent_id === 'string' ? body.parent_id : '';
    const normalizedEmail = typeof body.normalized_email === 'string' ? body.normalized_email : '';
    const identity = this.first();
    if (!identity || identity.parent_id !== parentId || identity.normalized_email !== normalizedEmail) {
      return json({ success: false, error: 'Verification token is invalid or expired' }, 400);
    }
    const now = Date.now();
    this.sql.exec(`
      UPDATE identity SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE singleton = 1
    `, now, now);
    return json({ success: true, data: { verified: true } });
  }

  // Returns the parent id only when a verification email may legitimately be
  // re-sent. The caller always answers the client generically, so this response
  // never becomes an account-existence oracle.
  private verificationRequest() {
    const identity = this.first();
    const now = Date.now();
    if (!identity || identity.email_verified_at !== null) {
      return json({ success: true, data: { resend: false } });
    }
    const throttle = this.sql.exec<{ expires_at: number }>(`
      SELECT expires_at FROM idempotency_keys
      WHERE key = 'verification-resend' AND operation = 'verification_resend' AND expires_at > ?
    `, now).toArray()[0];
    if (throttle) return json({ success: true, data: { resend: false } });
    this.sql.exec(`
      INSERT INTO idempotency_keys (key, operation, response_json, expires_at)
      VALUES ('verification-resend', 'verification_resend', '{}', ?)
      ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at
    `, now + VERIFICATION_RESEND_INTERVAL_MS);
    return json({
      success: true,
      data: { resend: true, parent_id: identity.parent_id, normalized_email: identity.normalized_email },
    });
  }

  private async login(request: Request) {
    const body = await request.json() as Record<string, unknown>;
    const password = typeof body.password === 'string' ? body.password : '';
    const identity = this.first();
    const now = Date.now();
    if (!identity || identity.email_verified_at === null) {
      return json({ success: false, error: 'Invalid email or password' }, 401);
    }
    if (identity.locked_until !== null && identity.locked_until > now) {
      return json({ success: false, error: 'Too many attempts. Please try again later.' }, 429);
    }

    const valid = await verifyPassword(password, identity.password_hash);
    if (!valid) {
      const failures = identity.failed_login_count + 1;
      const lockedUntil = failures >= MAX_LOGIN_FAILURES ? now + LOCK_DURATION_MS : null;
      this.sql.exec(`
        UPDATE identity SET failed_login_count = ?, locked_until = ?, updated_at = ? WHERE singleton = 1
      `, failures >= MAX_LOGIN_FAILURES ? 0 : failures, lockedUntil, now);
      return json({ success: false, error: 'Invalid email or password' }, 401);
    }

    this.sql.exec(`
      UPDATE identity SET failed_login_count = 0, locked_until = NULL, updated_at = ? WHERE singleton = 1
    `, now);
    return json({
      success: true,
      data: {
        parent_id: identity.parent_id,
        display_name: identity.display_name,
        // FamilyDO becomes the sole owner of auth_epoch after first login.
        identity_epoch: identity.auth_epoch,
      },
    });
  }
}
