import type { Env } from './db.ts';
import { queryFirst } from './db.ts';

/// Manual payments: the parent transfers by mobile wallet or InstaPay, reports
/// the transfer, and an operator approves it (migration 0104).
///
/// Prices are whole Egyptian pounds. The server copies the amount and the
/// number of days into the request at submission; the client never supplies
/// either.

export const MANUAL_METHOD_CODES = ['vodafone_cash', 'etisalat_cash', 'orange_cash', 'we_pay', 'instapay'] as const;
export type ManualMethodCode = typeof MANUAL_METHOD_CODES[number];
export const MANUAL_PERIODS = ['monthly', 'annual'] as const;
export type ManualPeriod = typeof MANUAL_PERIODS[number];
export const PERIOD_DAYS: Record<ManualPeriod, number> = { monthly: 30, annual: 365 };
export type ManualPlan = 'family' | 'family_plus';

export type ManualMethod = { code: ManualMethodCode; account: string; holder: string; enabled: boolean };
export type ManualPrices = Record<ManualPlan, Record<ManualPeriod, number | null>>;
export type ManualSettings = {
  enabled: boolean;
  methods: ManualMethod[];
  prices: ManualPrices;
  instructions: string;
  receipt_required: boolean;
  version: number;
  updated_at: string | null;
  updated_by: string | null;
};

export const METHOD_LABELS: Record<ManualMethodCode, string> = {
  vodafone_cash: 'فودافون كاش',
  etisalat_cash: 'اتصالات كاش',
  orange_cash: 'أورنج كاش',
  we_pay: 'وي باي',
  instapay: 'إنستاباي',
};

const EMPTY_PRICES: ManualPrices = {
  family: { monthly: null, annual: null },
  family_plus: { monthly: null, annual: null },
};

/// An Egyptian mobile number, or (InstaPay only) an address such as `name@instapay`.
const WALLET_NUMBER = /^01[0125][0-9]{8}$/;
const INSTAPAY_ADDRESS = /^[A-Za-z0-9._-]{2,40}@instapay$/;
const MAX_PRICE_EGP = 100_000;

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

/// Validates an operator's settings. Returns the normalised value or the first error.
export function validateManualSettings(input: unknown): { ok: true; value: Omit<ManualSettings, 'version' | 'updated_at' | 'updated_by'> } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'settings must be an object' };
  const body = input as Record<string, unknown>;
  const allowed = new Set(['enabled', 'methods', 'prices', 'instructions', 'receipt_required']);
  for (const key of Object.keys(body)) if (!allowed.has(key)) return { ok: false, error: `unknown field: ${key}` };
  if (typeof body.enabled !== 'boolean') return { ok: false, error: 'enabled must be boolean' };
  if (typeof body.receipt_required !== 'boolean') return { ok: false, error: 'receipt_required must be boolean' };
  const instructions = typeof body.instructions === 'string' ? body.instructions.trim() : '';
  if (instructions.length > 600) return { ok: false, error: 'instructions is too long (max 600)' };

  if (!Array.isArray(body.methods) || body.methods.length > MANUAL_METHOD_CODES.length) return { ok: false, error: 'methods must be a list' };
  const methods: ManualMethod[] = [];
  const seen = new Set<string>();
  for (const raw of body.methods) {
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'invalid method' };
    const m = raw as Record<string, unknown>;
    const code = m.code as ManualMethodCode;
    if (!MANUAL_METHOD_CODES.includes(code)) return { ok: false, error: `unknown method: ${String(m.code)}` };
    if (seen.has(code)) return { ok: false, error: `duplicate method: ${code}` };
    seen.add(code);
    const account = typeof m.account === 'string' ? m.account.trim().replace(/[\s-]/g, '') : '';
    const valid = WALLET_NUMBER.test(account) || (code === 'instapay' && INSTAPAY_ADDRESS.test(account.toLowerCase()));
    if (!valid) return { ok: false, error: `invalid account for ${code}` };
    const holder = typeof m.holder === 'string' ? m.holder.trim() : '';
    if (holder.length > 80) return { ok: false, error: `holder is too long for ${code}` };
    methods.push({ code, account: code === 'instapay' ? account.toLowerCase() : account, holder, enabled: m.enabled !== false });
  }

  const prices: ManualPrices = structuredClone(EMPTY_PRICES);
  const rawPrices = body.prices;
  if (!rawPrices || typeof rawPrices !== 'object') return { ok: false, error: 'prices must be an object' };
  for (const plan of ['family', 'family_plus'] as const) {
    const row = (rawPrices as Record<string, unknown>)[plan];
    if (row === undefined || row === null) continue;
    if (typeof row !== 'object') return { ok: false, error: `prices.${plan} must be an object` };
    for (const period of MANUAL_PERIODS) {
      const value = (row as Record<string, unknown>)[period];
      if (value === undefined || value === null) continue;
      if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > MAX_PRICE_EGP) {
        return { ok: false, error: `prices.${plan}.${period} must be a whole number of pounds (1-${MAX_PRICE_EGP})` };
      }
      prices[plan][period] = value as number;
    }
  }
  const anyPrice = Object.values(prices).some((row) => Object.values(row).some((v) => v !== null));
  if (body.enabled && (!methods.some((m) => m.enabled) || !anyPrice)) {
    return { ok: false, error: 'enabling manual payment needs at least one active method and one price' };
  }
  return { ok: true, value: { enabled: body.enabled, methods, prices, instructions, receipt_required: body.receipt_required } };
}

export async function loadManualSettings(env: Env): Promise<ManualSettings> {
  const row = await queryFirst<{
    enabled: number; methods_json: string; prices_json: string; instructions: string;
    receipt_required: number; version: number; updated_at: string; updated_by: string | null;
  }>(env.DB, 'SELECT enabled, methods_json, prices_json, instructions, receipt_required, version, updated_at, updated_by FROM manual_payment_settings WHERE id = 1')
    .catch(() => null);
  if (!row) {
    return { enabled: false, methods: [], prices: structuredClone(EMPTY_PRICES), instructions: '', receipt_required: false, version: 0, updated_at: null, updated_by: null };
  }
  const methods = parseJson(row.methods_json, []);
  const prices = parseJson(row.prices_json, {});
  const normalised: ManualPrices = structuredClone(EMPTY_PRICES);
  for (const plan of ['family', 'family_plus'] as const) {
    for (const period of MANUAL_PERIODS) {
      const value = prices?.[plan]?.[period];
      normalised[plan][period] = Number.isInteger(value) && value > 0 ? value : null;
    }
  }
  return {
    enabled: Number(row.enabled) === 1,
    methods: Array.isArray(methods) ? methods : [],
    prices: normalised,
    instructions: row.instructions ?? '',
    receipt_required: Number(row.receipt_required) === 1,
    version: Number(row.version),
    updated_at: row.updated_at,
    updated_by: row.updated_by,
  };
}

/// What a parent may see: only active methods and set prices, and nothing at
/// all while the switch is off.
export function publicManualOptions(settings: ManualSettings) {
  const methods = settings.methods.filter((m) => m.enabled);
  const offers = (['family', 'family_plus'] as const).flatMap((plan) => MANUAL_PERIODS
    .filter((period) => settings.prices[plan][period] !== null)
    .map((period) => ({ plan, period, days: PERIOD_DAYS[period], amount_egp: settings.prices[plan][period] as number })));
  const enabled = settings.enabled && methods.length > 0 && offers.length > 0;
  return {
    enabled,
    methods: enabled ? methods.map((m) => ({ code: m.code, label: METHOD_LABELS[m.code], account: m.account, holder: m.holder })) : [],
    offers: enabled ? offers : [],
    instructions: enabled ? settings.instructions : '',
    receipt_required: settings.receipt_required,
  };
}

/// Receipt images: JPEG is what a phone screenshot or camera gives, so it is
/// accepted here on top of the PNG/WebP the drawings use.
export const RECEIPT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;

export function sniffReceiptType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';
  return null;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export function receiptKey(parentId: string, requestId: string, mimeType: string) {
  const ext = RECEIPT_TYPES[mimeType];
  if (!ext || !SAFE_ID.test(parentId) || !SAFE_ID.test(requestId)) return null;
  return `billing/receipts/${parentId}/${requestId}.${ext}`;
}

/// When a newly approved period ends. A renewal paid before the current manual
/// period of the same plan ends is added after it, so paying early loses nothing.
export async function manualExpiry(env: Env, parentId: string, plan: ManualPlan, days: number, now = Date.now()) {
  const current = await queryFirst<{ expires: number | null }>(env.DB, `
    SELECT MAX(expires_at_ms) AS expires FROM manual_payment_requests
     WHERE parent_id = ? AND plan = ? AND status = 'approved' AND expires_at_ms > ?
  `, [parentId, plan, now]);
  const base = Math.max(now, Number(current?.expires ?? 0));
  return base + days * 86_400_000;
}
