/// Request geography, and the D1 side of availability resolution.
///
/// Split from `lib/availabilityPolicy.ts` so the rules stay pure and unit testable
/// while the parts that need a request and a database live here.
///
/// ## Where the country comes from
///
/// `request.cf.country` — Cloudflare's own geolocation, set at the edge before the
/// Worker runs. It is used rather than any client-supplied value because a client
/// can claim any country it likes, and a territory restriction that a client can
/// opt out of by editing a header is not a restriction.
///
/// Two other signals were considered and rejected as the *primary* source:
///
///  * **Account country** — correct for billing and store entitlements, and it is
///    the right signal for pricing. It is the wrong one for a licence: a family
///    that registered in one country and is travelling in another is physically in
///    the second, and distribution deals are written about where the content is
///    consumed.
///  * **Store country** — only known for purchases, absent for free users, and
///    unavailable for web.
///
/// They remain available to callers that need them: [availabilityContext] accepts
/// an override, so a playback path that has the account country can pass it and the
/// caller decides which is authoritative for that surface.
///
/// ## The development header
///
/// `X-Majarra-Country` is honoured only when `ENVIRONMENT` is not `production`.
/// Without it, local development and the E2E suite cannot exercise a restricted
/// territory at all, because `request.cf` is absent outside the edge. Refusing it in
/// production is not a configuration choice — it is checked in code, so enabling it
/// there would take a code change and a review.

import type { Env } from './db';
import {
  availabilityChainScopes,
  resolveAvailability,
  type AvailabilityContext,
  type AvailabilityDecision,
  type AvailabilityPolicy,
  type AvailabilityScope,
} from './availabilityPolicy.ts';
import { queryAll } from './db';

const COUNTRY_HEADER = 'X-Majarra-Country';
const PLATFORM_HEADER = 'X-Majarra-Platform';

export function requestCountry(request: Request, env: Env): string | null {
  const edge = (request as Request & { cf?: { country?: string } }).cf?.country;
  if (typeof edge === 'string' && /^[A-Z]{2}$/.test(edge)) return edge;

  const claimed = request.headers.get(COUNTRY_HEADER);
  const isProduction = String(env.ENVIRONMENT ?? '').trim().toLowerCase() === 'production';
  if (!isProduction && claimed && /^[A-Za-z]{2}$/.test(claimed.trim())) {
    return claimed.trim().toUpperCase();
  }
  // `T1` (Tor) and `XX` (unknown) are reported by Cloudflare and are not countries;
  // returning them as if they were would make a `selected_only` list impossible to
  // satisfy while looking as though geography was known.
  return null;
}

export function requestPlatform(request: Request): string | null {
  const claimed = request.headers.get(PLATFORM_HEADER);
  if (!claimed) return null;
  const value = claimed.trim().toLowerCase();
  return ['ios', 'android', 'web', 'tv'].includes(value) ? value : null;
}

export function availabilityContext(
  request: Request,
  env: Env,
  overrides: Partial<AvailabilityContext> = {},
): AvailabilityContext {
  return {
    country: overrides.country ?? requestCountry(request, env),
    language: overrides.language ?? null,
    platform: overrides.platform ?? requestPlatform(request),
    now: overrides.now ?? new Date().toISOString(),
  };
}

interface AvailabilityRow {
  entity_type: AvailabilityScope;
  entity_id: string;
  mode: string;
  countries: string;
  languages: string;
  platforms: string;
  starts_at: string | null;
  ends_at: string | null;
  reason: string;
  note: string | null;
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function rowToPolicy(row: AvailabilityRow): AvailabilityPolicy {
  return {
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    mode: row.mode as AvailabilityPolicy['mode'],
    countries: parseList(row.countries),
    languages: parseList(row.languages),
    platforms: parseList(row.platforms),
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    reason: row.reason as AvailabilityPolicy['reason'],
    note: row.note,
  };
}

/// The ancestor ids of one entity, keyed by scope.
///
/// Built with one query per content type rather than a recursive walk: the chain is
/// at most five deep and entirely determined by two or three columns, so a single
/// row answers it. A per-level query would multiply every catalogue read by four.
export async function availabilityAncestors(
  env: Env,
  type: AvailabilityScope,
  id: string,
): Promise<Partial<Record<AvailabilityScope, string>>> {
  const chain: Partial<Record<AvailabilityScope, string>> = { global: 'global', [type]: id };
  const db = env.DB;

  if (type === 'episode') {
    const row = await db.prepare(`
      SELECT e.season_id, e.series_id, s.planet_id
        FROM episodes e JOIN series s ON s.id = e.series_id WHERE e.id = ?
    `).bind(id).first<{ season_id: string | null; series_id: string; planet_id: string }>();
    if (row) {
      if (row.season_id) chain.season = row.season_id;
      chain.series = row.series_id;
      chain.planet = row.planet_id;
    }
    return chain;
  }
  if (type === 'season') {
    const row = await db.prepare(`
      SELECT se.series_id, s.planet_id FROM seasons se JOIN series s ON s.id = se.series_id WHERE se.id = ?
    `).bind(id).first<{ series_id: string; planet_id: string }>();
    if (row) { chain.series = row.series_id; chain.planet = row.planet_id; }
    return chain;
  }
  if (type === 'series') {
    const row = await db.prepare('SELECT planet_id FROM series WHERE id = ?').bind(id)
      .first<{ planet_id: string }>();
    if (row) chain.planet = row.planet_id;
    return chain;
  }
  if (type === 'story' || type === 'book' || type === 'game' || type === 'project') {
    const table = { story: 'stories', book: 'books', game: 'games', project: 'projects' }[type];
    const row = await db.prepare(`
      SELECT x.series_id, s.planet_id FROM ${table} x LEFT JOIN series s ON s.id = x.series_id WHERE x.id = ?
    `).bind(id).first<{ series_id: string | null; planet_id: string | null }>();
    if (row?.series_id) chain.series = row.series_id;
    if (row?.planet_id) chain.planet = row.planet_id;
    return chain;
  }
  return chain;
}

/// Loads every policy that could apply to a set of (scope, id) pairs in one query.
export async function loadPolicies(
  env: Env,
  pairs: Array<{ entity_type: AvailabilityScope; entity_id: string }>,
): Promise<AvailabilityPolicy[]> {
  if (!pairs.length) return [];
  const clauses = pairs.map(() => '(entity_type = ? AND entity_id = ?)').join(' OR ');
  const params = pairs.flatMap((pair) => [pair.entity_type, pair.entity_id]);
  const rows = await queryAll<AvailabilityRow>(env.DB, `
    SELECT entity_type, entity_id, mode, countries, languages, platforms,
           starts_at, ends_at, reason, note
      FROM content_availability
     WHERE ${clauses}
  `, params);
  return rows.map(rowToPolicy);
}

/// Resolves availability for one entity, including its inherited policies.
export async function availabilityFor(
  env: Env,
  type: AvailabilityScope,
  id: string,
  context: AvailabilityContext,
): Promise<AvailabilityDecision> {
  const ancestors = await availabilityAncestors(env, type, id);
  const scopes = availabilityChainScopes(type);
  const pairs = scopes
    .map((scope) => ({ scope, entity_id: ancestors[scope] }))
    .filter((entry): entry is { scope: AvailabilityScope; entity_id: string } => !!entry.entity_id)
    .map((entry) => ({ entity_type: entry.scope, entity_id: entry.entity_id }));

  const policies = await loadPolicies(env, pairs);
  // Ordered nearest-first, which resolveAvailability requires: the chain order is
  // the whole semantics of the override.
  const chain = pairs
    .map((pair) => policies.find((policy) => policy.entity_type === pair.entity_type && policy.entity_id === pair.entity_id))
    .filter((policy): policy is AvailabilityPolicy => !!policy);

  return resolveAvailability({ entity_type: type, entity_id: id }, chain, context);
}

/// Batch resolution for a list, e.g. a page of the catalogue.
///
/// One ancestor query per row is still one query per row, so this takes the
/// ancestors the caller already has from its own SELECT (series and planet are
/// almost always joined already) and issues exactly one policy query for the whole
/// page. A twenty-row catalogue page therefore costs one extra query, not twenty.
export async function availabilityForBatch<T>(
  env: Env,
  type: AvailabilityScope,
  rows: T[],
  identify: (row: T) => { id: string; season_id?: string | null; series_id?: string | null; planet_id?: string | null },
  context: AvailabilityContext,
): Promise<Map<string, AvailabilityDecision>> {
  const pairs: Array<{ entity_type: AvailabilityScope; entity_id: string }> = [
    { entity_type: 'global', entity_id: 'global' },
  ];
  const seen = new Set<string>(['global:global']);
  const add = (scope: AvailabilityScope, id: string | null | undefined) => {
    if (!id) return;
    const key = `${scope}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    pairs.push({ entity_type: scope, entity_id: id });
  };
  for (const row of rows) {
    const identity = identify(row);
    add(type, identity.id);
    add('season', identity.season_id);
    add('series', identity.series_id);
    add('planet', identity.planet_id);
  }

  const policies = await loadPolicies(env, pairs);
  const byKey = new Map(policies.map((policy) => [`${policy.entity_type}:${policy.entity_id}`, policy]));
  const scopes = availabilityChainScopes(type);

  const decisions = new Map<string, AvailabilityDecision>();
  for (const row of rows) {
    const identity = identify(row);
    const ids: Partial<Record<AvailabilityScope, string>> = {
      global: 'global',
      [type]: identity.id,
    };
    if (identity.season_id) ids.season = identity.season_id;
    if (identity.series_id) ids.series = identity.series_id;
    if (identity.planet_id) ids.planet = identity.planet_id;

    const chain = scopes
      .map((scope) => (ids[scope] ? byKey.get(`${scope}:${ids[scope]}`) : undefined))
      .filter((policy): policy is AvailabilityPolicy => !!policy);
    decisions.set(identity.id, resolveAvailability({ entity_type: type, entity_id: identity.id }, chain, context));
  }
  return decisions;
}

/// The refusal body for a restricted request.
///
/// 451 rather than 403 or 404. 403 says "you are not allowed", which invites a user
/// to try signing in; 404 hides a real distinction and makes support unanswerable.
/// 451 (Unavailable For Legal Reasons) is the status defined for exactly this — the
/// resource exists and is withheld for territory or legal reasons.
///
/// The client is told the code and the country it was judged on, never the policy's
/// note or the internal reason chain: an end user does not need to know which
/// studio's contract excluded them, and an operator reads that from the admin.
export function availabilityRefusal(decision: AvailabilityDecision, country: string | null) {
  return {
    success: false as const,
    error: 'Content is not available in this territory',
    data: {
      available: false as const,
      code: decision.code,
      country,
    },
  };
}
