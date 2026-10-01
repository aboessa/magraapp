import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { authenticateParent, verifyParentProof, type ParentPrincipal } from '../lib/parentAuth.ts';
import { bodyOr400, NO_FIELDS, oneOf, text } from '../lib/requestSchema.ts';
import {
  loadManualSettings, MANUAL_METHOD_CODES, MANUAL_PERIODS, MAX_RECEIPT_BYTES, PERIOD_DAYS,
  publicManualOptions, receiptKey, RECEIPT_TYPES, sniffReceiptType,
} from '../lib/manualPayments.ts';

/// Manual payments, parent side (migration 0104).
///
///   GET  /api/v1/billing/manual/options               numbers, prices, the latest request
///   POST /api/v1/billing/manual/requests              { plan, period, method, sender, reference? }
///   POST /api/v1/billing/manual/requests/:id/receipt  raw image body (JPEG/PNG/WebP, ≤ 3 MiB)
///   POST /api/v1/billing/manual/requests/:id/cancel
///
/// Every write needs the `parent_area` proof: a child holding the phone must not
/// be able to report a payment in the parent's name. The amount and the days
/// come from the settings, never from the body.

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

const MAX_REQUESTS_PER_DAY = 6;

async function parent(c: { env: Env; req: { header(name: string): string | undefined } }, needsProof: boolean)
  : Promise<{ ok: true; principal: ParentPrincipal } | { ok: false; response: Response }> {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) {
    return { ok: false, response: Response.json({ success: false, error: 'Unauthorized' }, { status: auth.reason === 'unconfigured' ? 503 : 401 }) };
  }
  if (needsProof) {
    const proof = await verifyParentProof(c.env, {
      principal: auth.principal, header: c.req.header('X-Parent-Proof'), purpose: 'parent_area', consume: false,
    });
    if (!proof.ok) {
      return { ok: false, response: Response.json({ success: false, error: 'A current parent proof is required' }, { status: proof.reason === 'unconfigured' ? 503 : 403 }) };
    }
  }
  return { ok: true, principal: auth.principal };
}

type RequestRow = {
  id: string; plan: string; period: string; days: number; amount_egp: number; method_code: string;
  sender: string; reference: string | null; receipt_key: string | null; status: string;
  reject_reason: string | null; expires_at_ms: number | null; created_at: string; reviewed_at: string | null;
};

const view = (row: RequestRow) => ({
  id: row.id,
  plan: row.plan,
  period: row.period,
  days: row.days,
  amount_egp: row.amount_egp,
  method: row.method_code,
  sender: row.sender,
  reference: row.reference,
  has_receipt: row.receipt_key !== null,
  status: row.status,
  reject_reason: row.reject_reason,
  expires_at: row.expires_at_ms ? new Date(row.expires_at_ms).toISOString() : null,
  created_at: row.created_at,
  reviewed_at: row.reviewed_at,
});

const COLUMNS = 'id, plan, period, days, amount_egp, method_code, sender, reference, receipt_key, status, reject_reason, expires_at_ms, created_at, reviewed_at';

route.get('/options', async (c) => {
  const who = await parent(c, false);
  if (!who.ok) return who.response;
  const options = publicManualOptions(await loadManualSettings(c.env));
  const recent = await queryAll<RequestRow>(c.env.DB,
    `SELECT ${COLUMNS} FROM manual_payment_requests WHERE parent_id = ? ORDER BY created_at DESC LIMIT 5`,
    [who.principal.parentId]).catch(() => []);
  return c.json({ success: true, data: { ...options, requests: recent.map(view) } });
});

route.post('/requests', async (c) => {
  const who = await parent(c, true);
  if (!who.ok) return who.response;
  const parsed = await bodyOr400<{ plan: 'family' | 'family_plus'; period: 'monthly' | 'annual'; method: string; sender: string; reference?: string }>(c, {
    plan: oneOf(['family', 'family_plus']),
    period: oneOf(MANUAL_PERIODS),
    method: oneOf(MANUAL_METHOD_CODES),
    // The wallet number or InstaPay address the money came from.
    sender: text({ min: 3, max: 60, pattern: /^[\p{L}\p{N}@._+\- ]+$/u }),
    reference: text({ min: 1, max: 60, pattern: /^[\p{L}\p{N}#._\- ]+$/u, optional: true }),
  });
  if (!parsed.ok) return parsed.response;
  const { plan, period, method, sender, reference } = parsed.value;

  const options = publicManualOptions(await loadManualSettings(c.env));
  if (!options.enabled) return c.json({ success: false, error: 'Manual payment is not available' }, 503);
  if (!options.methods.some((m) => m.code === method)) return c.json({ success: false, error: 'This payment method is not available' }, 400);
  const offer = options.offers.find((o) => o.plan === plan && o.period === period);
  if (!offer) return c.json({ success: false, error: 'This plan is not available for manual payment' }, 400);

  const parentId = who.principal.parentId;
  const open = await queryFirst<{ id: string }>(c.env.DB,
    `SELECT id FROM manual_payment_requests WHERE parent_id = ? AND status = 'pending' LIMIT 1`, [parentId]);
  if (open) return c.json({ success: false, error: 'A payment is already under review', code: 'pending_exists', data: { id: open.id } }, 409);
  const today = await queryFirst<{ n: number }>(c.env.DB,
    `SELECT COUNT(*) AS n FROM manual_payment_requests WHERE parent_id = ? AND created_at > datetime('now', '-1 day')`, [parentId]);
  if (Number(today?.n ?? 0) >= MAX_REQUESTS_PER_DAY) return c.json({ success: false, error: 'Too many payment reports today' }, 429);

  const id = `mp-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
  await c.env.DB.prepare(`
    INSERT INTO manual_payment_requests (id, parent_id, plan, period, days, amount_egp, method_code, sender, reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, parentId, plan, period, PERIOD_DAYS[period], offer.amount_egp, method, sender.trim(), reference?.trim() || null).run();
  const row = await queryFirst<RequestRow>(c.env.DB, `SELECT ${COLUMNS} FROM manual_payment_requests WHERE id = ?`, [id]);
  return c.json({ success: true, data: row ? view(row) : { id } }, 201);
});

route.post('/requests/:id/receipt', async (c) => {
  const who = await parent(c, true);
  if (!who.ok) return who.response;
  const bucket = (c.env as unknown as { CREATIONS_BUCKET?: R2Bucket }).CREATIONS_BUCKET;
  if (!bucket) return c.json({ success: false, error: 'Receipt storage is not configured' }, 503);
  const id = c.req.param('id');
  const row = await queryFirst<{ id: string; status: string }>(c.env.DB,
    'SELECT id, status FROM manual_payment_requests WHERE id = ? AND parent_id = ?', [id, who.principal.parentId]);
  if (!row) return c.json({ success: false, error: 'Payment request not found' }, 404);
  if (row.status !== 'pending') return c.json({ success: false, error: 'This payment was already reviewed' }, 409);

  const declared = (c.req.header('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  const length = Number(c.req.header('Content-Length') ?? 0);
  if (length > MAX_RECEIPT_BYTES) return c.json({ success: false, error: 'Receipt is too large' }, 413);
  if (!RECEIPT_TYPES[declared]) return c.json({ success: false, error: 'Receipt must be a JPEG, PNG or WebP image' }, 415);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RECEIPT_BYTES) return c.json({ success: false, error: 'Receipt is too large or empty' }, 413);
  if (sniffReceiptType(bytes) !== declared) return c.json({ success: false, error: 'Receipt content does not match its type' }, 415);

  const key = receiptKey(who.principal.parentId, id, declared);
  if (!key) return c.json({ success: false, error: 'Invalid request' }, 400);
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: declared, cacheControl: 'private, no-store' },
    customMetadata: { parent_id: who.principal.parentId, request_id: id },
  });
  await c.env.DB.prepare(`UPDATE manual_payment_requests SET receipt_key = ? WHERE id = ? AND parent_id = ? AND status = 'pending'`)
    .bind(key, id, who.principal.parentId).run();
  return c.json({ success: true, data: { id, has_receipt: true } });
});

route.post('/requests/:id/cancel', async (c) => {
  const who = await parent(c, true);
  if (!who.ok) return who.response;
  const parsed = await bodyOr400<Record<string, never>>(c, NO_FIELDS);
  if (!parsed.ok) return parsed.response;
  const result = await c.env.DB.prepare(`
    UPDATE manual_payment_requests SET status = 'cancelled', reviewed_at = datetime('now')
     WHERE id = ? AND parent_id = ? AND status = 'pending'
  `).bind(c.req.param('id'), who.principal.parentId).run();
  if (!result.meta?.changes) return c.json({ success: false, error: 'No pending payment with this id' }, 404);
  return c.json({ success: true, data: { id: c.req.param('id'), status: 'cancelled' } });
});

export default route;
