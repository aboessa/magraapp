/**
 * One television pairing attempt (`TV-001`).
 *
 * ## The flow this object serialises
 *
 * 1. A television that has no session asks for a code (`/create`). It receives
 *    the short code to display and a long `poll_secret` that only it knows.
 * 2. A parent who is signed in on a phone looks the code up (`/describe`), sees
 *    which device is asking, and approves it with a PIN-bound proof. The Worker
 *    claims the attempt (`/claim`), creates a real family session for the
 *    television's installation, and parks the sealed tokens here (`/complete`).
 * 3. The television polls with its secret (`/poll`) and receives the tokens
 *    **once**. The record is consumed in the same step.
 *
 * ## Why a Durable Object per code
 *
 * Every step is a compare-and-set on one record: two phones approving the same
 * code, or a poll racing an approval, must resolve to exactly one winner. KV
 * cannot give that (eventual consistency, ~1 write/s per key). Addressing by
 * `idFromName('tv-pair:<code>')` makes the code itself the lock, and
 * `blockConcurrencyWhile` makes each read-modify-write atomic.
 *
 * ## What is stored
 *
 * Hashes, not secrets: the poll secret and the installation id arrive already
 * hashed. The only credential material ever held is the token pair between
 * approval and pick-up, sealed by the Worker with a purpose-bound key, and it is
 * deleted on pick-up or by the alarm two minutes after approval at the latest.
 */

export type PairingStatus = 'pending' | 'approving' | 'approved' | 'consumed';

type PairingRecord = {
  status: PairingStatus;
  pollSecretHash: string;
  installationIdHash: string;
  platform: string;
  deviceName: string | null;
  createdAt: number;
  expiresAt: number;
  parentId: string | null;
  approvingSince: number | null;
  sealedTokens: string | null;
};

const STORAGE_KEY = 'pairing';

/// Bounds on what the Worker may ask for, so a malformed internal call cannot
/// create a code that lives for a day.
const MIN_TTL_MS = 60_000;
const MAX_TTL_MS = 15 * 60_000;

/// How long approved tokens wait for the television to collect them.
export const PICKUP_WINDOW_MS = 2 * 60_000;

/// A claim that never completed (the Worker died mid-approval) stops blocking
/// the code after this long, so another approval can proceed.
const STALE_CLAIM_MS = 30_000;

/// How long a consumed record is kept so a late duplicate poll gets a clean
/// "already used" instead of looking like an unknown code.
const TOMBSTONE_MS = 60_000;

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function text(value: unknown, max: number) {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

export class TvPairing {
  private readonly ctx: DurableObjectState;

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ success: false, error: 'Not found' }, 404);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') return json({ success: false, error: 'Invalid request' }, 400);

    switch (url.pathname) {
      case '/create': return this.create(body);
      case '/poll': return this.poll(body);
      case '/describe': return this.describe();
      case '/claim': return this.claim(body);
      case '/complete': return this.complete(body);
      case '/abort': return this.abort(body);
      default: return json({ success: false, error: 'Not found' }, 404);
    }
  }

  /// Removes whatever is left once the record can no longer be used.
  async alarm(): Promise<void> {
    const record = await this.read();
    if (!record) return;
    const now = Date.now();
    if (record.status === 'consumed' || now >= record.expiresAt) {
      await this.ctx.storage.deleteAll();
      return;
    }
    await this.ctx.storage.setAlarm(record.expiresAt);
  }

  private read() {
    return this.ctx.storage.get<PairingRecord>(STORAGE_KEY);
  }

  private async write(record: PairingRecord, alarmAt: number) {
    await this.ctx.storage.put(STORAGE_KEY, record);
    await this.ctx.storage.setAlarm(alarmAt);
  }

  private live(record: PairingRecord | undefined, now: number): record is PairingRecord {
    return Boolean(record) && record!.status !== 'consumed' && now < record!.expiresAt;
  }

  private create(body: Record<string, unknown>) {
    const pollSecretHash = text(body.poll_secret_hash, 128);
    const installationIdHash = text(body.installation_id_hash, 128);
    const platform = text(body.platform, 20);
    const deviceName = body.device_name === null || body.device_name === undefined
      ? null
      : text(body.device_name, 80);
    const ttl = Number(body.ttl_ms);
    if (!pollSecretHash || !installationIdHash || !platform
      || (body.device_name != null && deviceName === null)
      || !Number.isInteger(ttl) || ttl < MIN_TTL_MS || ttl > MAX_TTL_MS) {
      return json({ success: false, error: 'Invalid pairing request' }, 400);
    }

    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const existing = await this.read();
      // A code still in use is never overwritten: the Worker draws another one.
      // A consumed record's tombstone counts as in use until it lapses too.
      if (existing && now < existing.expiresAt) {
        return json({ success: false, error: 'Code is in use', code: 'code_in_use' }, 409);
      }
      const record: PairingRecord = {
        status: 'pending',
        pollSecretHash,
        installationIdHash,
        platform,
        deviceName,
        createdAt: now,
        expiresAt: now + ttl,
        parentId: null,
        approvingSince: null,
        sealedTokens: null,
      };
      await this.ctx.storage.deleteAll();
      await this.write(record, record.expiresAt);
      return json({ success: true, data: { expires_at: record.expiresAt } }, 201);
    });
  }

  private poll(body: Record<string, unknown>) {
    const pollSecretHash = text(body.poll_secret_hash, 128);
    if (!pollSecretHash) return json({ success: false, error: 'Invalid request' }, 400);

    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const record = await this.read();
      // Unknown and wrong-secret answer identically: the poll endpoint must not
      // confirm that a guessed code exists.
      if (!record || record.pollSecretHash !== pollSecretHash) {
        return json({ success: false, error: 'Pairing not found', code: 'pairing_expired' }, 410);
      }
      if (record.status === 'consumed' || now >= record.expiresAt) {
        return json({ success: false, error: 'Pairing expired', code: 'pairing_expired' }, 410);
      }
      if (record.status !== 'approved' || !record.sealedTokens) {
        return json({ success: true, data: { status: 'pending' } });
      }

      const sealed = record.sealedTokens;
      // Consumed and scrubbed in the same step that hands the tokens out, so a
      // second poll — even with the right secret — gets nothing.
      await this.write({
        ...record,
        status: 'consumed',
        sealedTokens: null,
        expiresAt: now + TOMBSTONE_MS,
      }, now + TOMBSTONE_MS);
      return json({ success: true, data: { status: 'approved', sealed_tokens: sealed } });
    });
  }

  private async describe() {
    const now = Date.now();
    const record = await this.read();
    if (!this.live(record, now) || record.status !== 'pending') {
      return json({ success: false, error: 'Pairing code not found', code: 'pairing_not_found' }, 404);
    }
    return json({
      success: true,
      data: {
        platform: record.platform,
        device_name: record.deviceName,
        created_at: record.createdAt,
        expires_at: record.expiresAt,
      },
    });
  }

  private claim(body: Record<string, unknown>) {
    const parentId = text(body.parent_id, 128);
    if (!parentId) return json({ success: false, error: 'Invalid request' }, 400);

    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const record = await this.read();
      if (!this.live(record, now)) {
        return json({ success: false, error: 'Pairing code not found', code: 'pairing_not_found' }, 404);
      }
      const staleClaim = record.status === 'approving'
        && record.approvingSince !== null && now - record.approvingSince > STALE_CLAIM_MS;
      if (record.status !== 'pending' && !staleClaim) {
        return json({ success: false, error: 'Pairing is already being approved', code: 'pairing_claimed' }, 409);
      }
      await this.write({ ...record, status: 'approving', parentId, approvingSince: now }, record.expiresAt);
      return json({
        success: true,
        data: {
          installation_id_hash: record.installationIdHash,
          platform: record.platform,
          device_name: record.deviceName,
        },
      });
    });
  }

  private complete(body: Record<string, unknown>) {
    const parentId = text(body.parent_id, 128);
    const sealedTokens = text(body.sealed_tokens, 16_384);
    if (!parentId || !sealedTokens) return json({ success: false, error: 'Invalid request' }, 400);

    return this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      const record = await this.read();
      if (!record || record.status !== 'approving' || record.parentId !== parentId) {
        return json({ success: false, error: 'Pairing is not being approved by this parent' }, 409);
      }
      const expiresAt = now + PICKUP_WINDOW_MS;
      await this.write({ ...record, status: 'approved', sealedTokens, expiresAt }, expiresAt);
      return json({ success: true, data: { approved: true, pickup_expires_at: expiresAt } });
    });
  }

  private abort(body: Record<string, unknown>) {
    const parentId = text(body.parent_id, 128);
    if (!parentId) return json({ success: false, error: 'Invalid request' }, 400);

    return this.ctx.blockConcurrencyWhile(async () => {
      const record = await this.read();
      if (!record || record.status !== 'approving' || record.parentId !== parentId) {
        return json({ success: true, data: { aborted: false } });
      }
      await this.write({ ...record, status: 'pending', parentId: null, approvingSince: null }, record.expiresAt);
      return json({ success: true, data: { aborted: true } });
    });
  }
}
