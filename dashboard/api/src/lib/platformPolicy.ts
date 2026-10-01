import type { Env } from './db.ts';
import { PLAN_LIMITS, PLAN_POLICY_VERSION, type Plan } from './familyPolicy.ts';

/**
 * Product policy an operator can change from the dashboard (`ADMIN-POLICY`).
 *
 * ## What this replaces, and what it keeps
 *
 * Plan limits used to be constants in `familyPolicy.ts`, on purpose: the old
 * limits table (dropped in 0085) was never read, and reading D1 on the path
 * that enforces a limit meant a D1 outage would either open the limit or refuse a
 * paying family. Both objections are answered here rather than ignored:
 *
 * - **One source of truth.** `platform_policy` (0098) is read by every enforcer
 *   and every screen through this module; nothing else stores these numbers.
 * - **A D1 failure changes nothing.** A reader that cannot reach D1 keeps the
 *   last value it read, and with none it uses the code defaults
 *   (`PLAN_LIMITS`, `TV_PAIRING_DEFAULTS`, `OFFLINE_LICENSE_DEFAULTS`). Those
 *   defaults stay in code for exactly that reason.
 * - **Every number is bounded.** An operator cannot type 0 devices and lock out
 *   every family, or 10 000 and remove the limit. Bounds live beside the
 *   defaults and are checked on write *and* on read.
 * - **Every change is versioned.** A refusal records the version it was decided
 *   under, so "refused under policy 5" can be explained a month later.
 *
 * Changes reach every isolate within `CACHE_TTL_MS`.
 *
 * ## What is deliberately not here
 *
 * Token lifetimes, pairing-code length, link-ticket lifetime, rate limits and
 * screen-time accounting are security controls. Loosening one from a web form
 * is an incident, not a setting, so they stay in code and need a reviewed deploy.
 */

export type PlanLimitValues = typeof PLAN_LIMITS[Plan];
export type PlanLimitField = keyof PlanLimitValues;
export type PlanLimitTable = Record<Plan, PlanLimitValues>;

export const PLANS: readonly Plan[] = ['free', 'family', 'family_plus'];

/// Inclusive [min, max] per field. Minimum 1 where 0 would lock families out.
export const PLAN_LIMIT_BOUNDS: Record<PlanLimitField, readonly [number, number]> = {
  children: [1, 10],
  devices: [1, 20],
  tvDevices: [0, 10],
  concurrentStreams: [1, 20],
  downloadDevices: [0, 20],
  offlineItems: [0, 200],
};

export type TvPairingPolicy = {
  /// How long a code on the TV stays valid. The pairing object caps this at 15.
  code_ttl_minutes: number;
  /// How often the TV asks whether its code was approved.
  poll_interval_seconds: number;
};
export const TV_PAIRING_DEFAULTS: TvPairingPolicy = { code_ttl_minutes: 10, poll_interval_seconds: 5 };
export const TV_PAIRING_BOUNDS: Record<keyof TvPairingPolicy, readonly [number, number]> = {
  code_ttl_minutes: [3, 15],
  // Below 3 s the poll limiter (40/min) would refuse three TVs behind one router.
  poll_interval_seconds: [3, 15],
};

export type OfflineLicensePolicy = {
  /// How long a download plays without the device coming back online.
  ttl_days: number;
};
export const OFFLINE_LICENSE_DEFAULTS: OfflineLicensePolicy = { ttl_days: 30 };
export const OFFLINE_LICENSE_BOUNDS: Record<keyof OfflineLicensePolicy, readonly [number, number]> = {
  ttl_days: [1, 30],
};

export type PolicySection = 'plan_limits' | 'tv_pairing' | 'offline_license';
export const POLICY_SECTIONS: readonly PolicySection[] = ['plan_limits', 'tv_pairing', 'offline_license'];

type SectionValue = {
  plan_limits: PlanLimitTable;
  tv_pairing: TvPairingPolicy;
  offline_license: OfflineLicensePolicy;
};

export type LoadedPolicy<T> = {
  value: T;
  version: number;
  /// `stored`: read from D1 now. `cached`: last good value (D1 unavailable).
  /// `default`: nothing stored, or nothing readable, so the code defaults.
  source: 'stored' | 'cached' | 'default';
  updated_at: string | null;
  updated_by: string | null;
};

export const CACHE_TTL_MS = 60_000;

function defaults<S extends PolicySection>(section: S): { value: SectionValue[S]; version: number } {
  if (section === 'plan_limits') {
    return { value: structuredClone(PLAN_LIMITS) as SectionValue[S], version: PLAN_POLICY_VERSION };
  }
  if (section === 'tv_pairing') return { value: { ...TV_PAIRING_DEFAULTS } as SectionValue[S], version: 0 };
  return { value: { ...OFFLINE_LICENSE_DEFAULTS } as SectionValue[S], version: 0 };
}

/* ------------------------------------------------------------- validation */

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function bounded(value: unknown, [min, max]: readonly [number, number]) {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function validateFlat<T extends Record<string, number>>(
  raw: unknown, bounds: Record<keyof T, readonly [number, number]>, label: string,
): Validation<T> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: `${label}: expected an object` };
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!(key in bounds)) return { ok: false, error: `${label}: unknown field ${key}` };
  }
  const out: Record<string, number> = {};
  for (const [key, range] of Object.entries(bounds) as Array<[string, readonly [number, number]]>) {
    if (!bounded(input[key], range)) {
      return { ok: false, error: `${label}.${key} must be a whole number between ${range[0]} and ${range[1]}` };
    }
    out[key] = input[key] as number;
  }
  return { ok: true, value: out as T };
}

export function validatePlanLimits(raw: unknown): Validation<PlanLimitTable> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'plan_limits: expected an object' };
  const input = raw as Record<string, unknown>;
  for (const key of Object.keys(input)) {
    if (!PLANS.includes(key as Plan)) return { ok: false, error: `plan_limits: unknown plan ${key}` };
  }
  const out = {} as PlanLimitTable;
  for (const plan of PLANS) {
    const checked = validateFlat<PlanLimitValues>(input[plan], PLAN_LIMIT_BOUNDS, plan);
    if (!checked.ok) return checked;
    out[plan] = checked.value;
  }
  return { ok: true, value: out };
}

export function validateSection<S extends PolicySection>(section: S, raw: unknown): Validation<SectionValue[S]> {
  if (section === 'plan_limits') return validatePlanLimits(raw) as Validation<SectionValue[S]>;
  if (section === 'tv_pairing') {
    return validateFlat<TvPairingPolicy>(raw, TV_PAIRING_BOUNDS, 'tv_pairing') as Validation<SectionValue[S]>;
  }
  return validateFlat<OfflineLicensePolicy>(raw, OFFLINE_LICENSE_BOUNDS, 'offline_license') as Validation<SectionValue[S]>;
}

export function isPolicySection(value: unknown): value is PolicySection {
  return typeof value === 'string' && (POLICY_SECTIONS as readonly string[]).includes(value);
}

/* ---------------------------------------------------------------- reading */

type CacheEntry = { loaded: LoadedPolicy<unknown>; at: number };
const cache = new Map<PolicySection, CacheEntry>();

/// Tests and the writer call this so the next read goes to D1.
export function resetPolicyCache(section?: PolicySection) {
  if (section) cache.delete(section);
  else cache.clear();
}

type Row = { value_json: string; version: number; updated_at: string | null; updated_by: string | null };

export async function loadPolicy<S extends PolicySection>(
  env: Pick<Env, 'DB'> | Partial<Pick<Env, 'DB'>>,
  section: S,
  now = Date.now(),
): Promise<LoadedPolicy<SectionValue[S]>> {
  const hit = cache.get(section);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.loaded as LoadedPolicy<SectionValue[S]>;

  const fallback = defaults(section);
  const asDefault: LoadedPolicy<SectionValue[S]> = {
    value: fallback.value, version: fallback.version, source: 'default', updated_at: null, updated_by: null,
  };
  const db = env.DB;
  if (!db) return asDefault;

  let row: Row | null;
  try {
    row = await db.prepare(
      `SELECT value_json, version, updated_at, updated_by FROM platform_policy WHERE section = ?`,
    ).bind(section).first<Row>();
  } catch (error) {
    console.error('platform_policy_read_failed', section, error instanceof Error ? error.message : String(error));
    // Last good value first: a D1 blip must not flip an edited limit back.
    if (hit) return { ...(hit.loaded as LoadedPolicy<SectionValue[S]>), source: 'cached' };
    return asDefault;
  }

  let loaded = asDefault;
  if (row) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(row.value_json);
    } catch {
      parsed = null;
    }
    const checked = validateSection(section, parsed);
    if (checked.ok) {
      loaded = {
        value: checked.value, version: row.version, source: 'stored',
        updated_at: row.updated_at, updated_by: row.updated_by,
      };
    } else {
      // Only the writer below can produce a row, and it validates. An invalid
      // row is therefore tampering or a bad manual edit: say so, use defaults.
      console.error('platform_policy_invalid_row', section, checked.error);
    }
  }
  cache.set(section, { loaded, at: now });
  return loaded;
}

export async function loadPlanLimits(env: Partial<Pick<Env, 'DB'>>) {
  const loaded = await loadPolicy(env, 'plan_limits');
  return { limits: loaded.value, version: loaded.version };
}

/* ---------------------------------------------------------------- writing */

/// Validates, stores and bumps the version. Returns the stored policy.
export async function writePolicy<S extends PolicySection>(
  db: D1Database, section: S, raw: unknown, actor: string,
): Promise<Validation<LoadedPolicy<SectionValue[S]>>> {
  const checked = validateSection(section, raw);
  if (!checked.ok) return checked;
  // The first stored version follows the code default's, so versions only grow.
  const firstVersion = defaults(section).version + 1;
  await db.prepare(`
    INSERT INTO platform_policy (section, value_json, version, updated_at, updated_by)
    VALUES (?, ?, ?, datetime('now'), ?)
    ON CONFLICT(section) DO UPDATE SET
      value_json = excluded.value_json,
      version = platform_policy.version + 1,
      updated_at = datetime('now'),
      updated_by = excluded.updated_by
  `).bind(section, JSON.stringify(checked.value), firstVersion, actor).run();
  resetPolicyCache(section);
  return { ok: true, value: await loadPolicy({ DB: db }, section) };
}

/// Restores the code defaults as a *new* version rather than deleting the row:
/// deleting would drop the version back to the default's, and a refusal logged
/// under "policy 5" must never be confused with a later one under "policy 5".
export async function resetPolicy(db: D1Database, section: PolicySection, actor: string) {
  return writePolicy(db, section, defaults(section).value, actor);
}

export function policyDefaults() {
  return {
    plan_limits: defaults('plan_limits').value,
    tv_pairing: defaults('tv_pairing').value,
    offline_license: defaults('offline_license').value,
  };
}

export function policyBounds() {
  return {
    plan_limits: PLAN_LIMIT_BOUNDS,
    tv_pairing: TV_PAIRING_BOUNDS,
    offline_license: OFFLINE_LICENSE_BOUNDS,
  };
}
