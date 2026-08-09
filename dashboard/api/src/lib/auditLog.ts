/// Shared audit-log helper.
///
/// Lifted out of routes/admin.ts so every admin module writes the same
/// audit_logs row shape instead of keeping a private copy. routes/admin.ts and
/// routes/adminCatalogue.ts both import it.
///
/// ## Redaction
///
/// `details` used to be serialized verbatim, and two callers pass a whole request
/// body (routes/admin.ts:488 and :734). The protection plan forbids audit records
/// from carrying credentials, full signed URLs, or child PII:
///
///   * `تشفير المحتوي.md:253-262` — a signed URL is an access key; never log it
///   * `تشفير المحتوي.md:1213` — audit logs must exclude full URL, token, key, PII
///   * `معماريه d1 kv.ini:1046` — telemetry excludes tokens and signed URLs
///
/// [redactForAudit] enforces that at the single point where every audit row is
/// built, so a new caller cannot forget it. It is a deny-list on key names plus a
/// value scrubber, applied recursively.

/// Key names whose values are replaced wholesale.
///
/// Matched case-insensitively as a substring, so `purchase_token`,
/// `refreshToken` and `X-Api-Key` are all covered by three entries.
const REDACTED_KEY_PATTERNS = [
  'token',
  'secret',
  'password',
  'passcode',
  'pin',
  'authorization',
  'auth_header',
  'apikey',
  'api_key',
  'private_key',
  'signature',
  'credential',
  'cookie',
  'session_id',
  'sessionid',
  // Child-identifying fields. The plan allows a pseudonymous child_id but not a
  // nickname or birth date (تشفير المحتوي.md:1213).
  'nickname',
  'birth_month',
  'birth_year',
  'birthdate',
  'email',
  'phone',
] as const;

const REDACTED = '[redacted]';

/// Caps on what a single audit row may contain, so one oversized body cannot
/// bloat the table or hide a real record in noise.
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 50;
const MAX_DEPTH = 6;
const MAX_SERIALIZED_LENGTH = 8_000;

function keyIsSensitive(key: string) {
  const lowered = key.toLowerCase();
  return REDACTED_KEY_PATTERNS.some((pattern) => lowered.includes(pattern));
}

/// Strips query strings and fragments from anything URL-shaped.
///
/// A signed URL carries its capability in the query string, so the path alone is
/// safe to keep for debugging while the grant is discarded. Bearer values are
/// dropped entirely.
function scrubString(value: string): string {
  const trimmed = value.trim();

  if (/^bearer\s+/i.test(trimmed)) return REDACTED;

  // A JWT-shaped value is a credential regardless of the field it arrived in.
  if (/^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/.test(trimmed)) {
    return REDACTED;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const hadGrant = url.search.length > 0 || url.hash.length > 0;
      return `${url.origin}${url.pathname}${hadGrant ? '?[redacted]' : ''}`;
    } catch {
      return REDACTED;
    }
  }

  return trimmed.length > MAX_STRING_LENGTH
    ? `${trimmed.slice(0, MAX_STRING_LENGTH)}…[truncated]`
    : trimmed;
}

/// Recursively removes credentials and PII from an audit payload.
///
/// Exported so callers and tests can reason about the exact shape that will be
/// persisted. Depth is bounded rather than trusted: an admin payload is
/// attacker-influenced input, and a cyclic or deeply nested object must not be
/// able to stall the request.
export function redactForAudit(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;

  if (depth >= MAX_DEPTH) return '[depth-limit]';

  if (typeof value === 'string') return scrubString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();

  // Functions, symbols and anything else non-serializable are dropped rather
  // than allowed to throw inside JSON.stringify.
  if (typeof value !== 'object') return null;

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redactForAudit(item, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[${value.length - MAX_ARRAY_ITEMS} more items omitted]`);
    }
    return items;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    result[key] = keyIsSensitive(key) ? REDACTED : redactForAudit(entry, depth + 1);
  }
  return result;
}

/// Serializes a redacted payload, failing safe if it still cannot be encoded.
function serializeDetails(details: unknown): string {
  let encoded: string;
  try {
    encoded = JSON.stringify(redactForAudit(details ?? {}) ?? {});
  } catch {
    // A cycle survives redaction only if it is reachable within MAX_DEPTH; record
    // that the payload was unloggable rather than losing the audit row entirely.
    return JSON.stringify({ error: 'details_not_serializable' });
  }
  if (encoded.length <= MAX_SERIALIZED_LENGTH) return encoded;
  return JSON.stringify({
    error: 'details_truncated',
    original_length: encoded.length,
    preview: encoded.slice(0, 1_000),
  });
}

export function auditStatement(
  db: D1Database,
  actor: string,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown,
): D1PreparedStatement {
  return db.prepare(`
    INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    crypto.randomUUID(),
    actor,
    action,
    entityType,
    entityId,
    serializeDetails(details),
  );
}

/// Resolves the audit actor from the authenticated session.
///
/// ## The defect this fixes
///
/// This function used to `return 'admin-api-key'` unconditionally, ignoring the
/// request entirely. `routes/admin.ts` and `routes/adminCatalogue.ts` both use
/// it, so **every** series, episode and catalogue mutation recorded a literal
/// placeholder as its actor — even once real admin accounts existed and the
/// session identity was sitting in the context. "Who changed this?" was
/// unanswerable for the two largest route files in the CMS.
///
/// The original comment was right that a spoofable `X-Admin-Actor` header must
/// not be trusted as identity. The mistake was concluding that no identity was
/// available: `requireAdmin` sets `adminUser` on the context from a verified
/// session row, and that id is the correct actor.
///
/// Falls back to `legacy-admin-key` only when there is genuinely no session,
/// which `lib/adminAuth.ts` permits solely before the first admin user is
/// seeded. The claimed header is still recorded inside `details` by callers, so
/// it can be reviewed without being trusted.
export function actorId(c: {
  req: { header(name: string): string | undefined };
  get?: (key: string) => unknown;
}): string {
  const user = c.get?.('adminUser') as { id?: string } | undefined;
  if (user?.id) return user.id;
  return 'legacy-admin-key';
}

export function claimedActor(c: { req: { header(name: string): string | undefined } }): string | null {
  return c.req.header('X-Admin-Actor') ?? null;
}
