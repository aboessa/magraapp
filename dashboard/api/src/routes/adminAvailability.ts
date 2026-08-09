/// Admin surface for territory availability.
///
/// Three operations, and the read is the important one: an operator looking at a
/// series must be able to tell whether its availability was *set here* or *inherited
/// from the planet or the platform default*, because those two states look identical
/// on screen and have completely different consequences when the parent changes.
/// `GET` therefore returns the whole resolved chain, not just the effective answer.
///
/// ## Why `publish` guards the writes
///
/// Availability decides what the public can see, which is the same authority as
/// publishing, and the permission set seeded in migration 0014 has no
/// `manage_rights`. Reusing `publish` is a deliberate choice over inventing a
/// permission that no role holds yet: an unheld permission means the feature is
/// unreachable, and the first person to notice would be an operator who cannot do
/// their job. When a rights role is introduced, this is the single place to change.
///
/// ## Deleting is not "make it available"
///
/// `DELETE` removes the override so the entity falls back to its ancestors, which
/// may itself be a restriction. The response returns the newly effective decision so
/// the operator sees what they actually got rather than assuming the content is now
/// worldwide. The global default row cannot be deleted: nothing would inherit from
/// it, and "no policy anywhere" is a state the resolver treats as available — a
/// silent unrestriction of the entire catalogue.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId, auditStatement } from '../lib/auditLog';
import {
  availabilityChainScopes,
  isAvailabilityScope,
  normalizeAvailabilityInput,
  resolveAvailability,
  type AvailabilityPolicy,
  type AvailabilityScope,
} from '../lib/availabilityPolicy.ts';
import {
  availabilityAncestors,
  availabilityContext,
  loadPolicies,
} from '../lib/requestGeo.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// The table each scope points at, so a policy cannot be written against an id that
/// does not exist. A dangling policy is worse than none: it looks configured, it
/// appears in the list, and it governs nothing.
const SCOPE_TABLES: Record<AvailabilityScope, string | null> = {
  global: null,
  planet: 'planets',
  series: 'series',
  season: 'seasons',
  episode: 'episodes',
  story: 'stories',
  book: 'books',
  game: 'games',
  project: 'projects',
};

async function entityExists(env: Env, scope: AvailabilityScope, id: string): Promise<boolean> {
  const table = SCOPE_TABLES[scope];
  if (!table) return scope === 'global' && id === 'global';
  const row = await queryFirst<{ id: string }>(env.DB, `SELECT id FROM ${table} WHERE id = ?`, [id]);
  return !!row;
}

/// The resolved chain plus the effective decision for one entity.
async function describe(env: Env, request: Request, scope: AvailabilityScope, id: string, country: string | null) {
  const ancestors = await availabilityAncestors(env, scope, id);
  const scopes = availabilityChainScopes(scope);
  const pairs = scopes
    .filter((candidate) => ancestors[candidate])
    .map((candidate) => ({ entity_type: candidate, entity_id: ancestors[candidate] as string }));
  const policies = await loadPolicies(env, pairs);
  const chain = pairs
    .map((pair) => ({
      entity_type: pair.entity_type,
      entity_id: pair.entity_id,
      policy: policies.find((policy) => policy.entity_type === pair.entity_type && policy.entity_id === pair.entity_id) ?? null,
    }));
  const ordered = chain
    .map((entry) => entry.policy)
    .filter((policy): policy is AvailabilityPolicy => !!policy);

  const context = availabilityContext(request, env, { country });
  const decision = resolveAvailability({ entity_type: scope, entity_id: id }, ordered, context);
  return {
    entity_type: scope,
    entity_id: id,
    /// The row set on this entity itself, or null when it only inherits.
    own_policy: ordered.find((policy) => policy.entity_type === scope && policy.entity_id === id) ?? null,
    chain,
    evaluated_for: { country: context.country, platform: context.platform, now: context.now },
    decision,
  };
}

/// `GET /admin/availability/:type/:id?country=SA`
///
/// `country` is a preview parameter: an operator asking "is this visible in France?"
/// must be able to answer it without travelling. It defaults to the request's own
/// country so the page is useful with no input.
route.get('/availability/:type/:id', requireAdmin, async (c) => {
  const scope = c.req.param('type');
  const id = c.req.param('id') ?? '';
  if (!isAvailabilityScope(scope)) {
    return c.json({ success: false, error: 'Unsupported availability scope' }, 400);
  }
  if (!await entityExists(c.env, scope, id)) {
    return c.json({ success: false, error: 'Entity not found' }, 404);
  }
  const requested = c.req.query('country');
  const country = requested && /^[A-Za-z]{2}$/.test(requested) ? requested.toUpperCase() : null;
  return c.json({
    success: true,
    data: await describe(c.env, c.req.raw, scope, id, country),
  });
});

/// `PUT /admin/availability/:type/:id`
route.put('/availability/:type/:id', requirePermission('publish'), async (c) => {
  const scope = c.req.param('type');
  const id = c.req.param('id') ?? '';
  if (!isAvailabilityScope(scope)) {
    return c.json({ success: false, error: 'Unsupported availability scope' }, 400);
  }
  if (!await entityExists(c.env, scope, id)) {
    return c.json({ success: false, error: 'Entity not found' }, 404);
  }
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const normalized = normalizeAvailabilityInput({
    mode: body.mode,
    countries: body.countries,
    languages: body.languages,
    platforms: body.platforms,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
    reason: body.reason,
    note: body.note,
  });
  if ('error' in normalized) return c.json({ success: false, error: normalized.error }, 400);
  const policy = normalized.policy;

  const previous = await queryFirst<{ mode: string; countries: string; reason: string }>(c.env.DB, `
    SELECT mode, countries, reason FROM content_availability WHERE entity_type = ? AND entity_id = ?
  `, [scope, id]);

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO content_availability
        (id, entity_type, entity_id, mode, countries, languages, platforms,
         starts_at, ends_at, reason, note, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        mode = excluded.mode,
        countries = excluded.countries,
        languages = excluded.languages,
        platforms = excluded.platforms,
        starts_at = excluded.starts_at,
        ends_at = excluded.ends_at,
        reason = excluded.reason,
        note = excluded.note,
        updated_at = datetime('now')
    `).bind(
      `availability-${scope}-${id}`,
      scope, id, policy.mode,
      JSON.stringify(policy.countries), JSON.stringify(policy.languages), JSON.stringify(policy.platforms),
      policy.starts_at, policy.ends_at, policy.reason, policy.note, actorId(c),
    ),
    // Audited as its own action rather than a generic update: "who made this
    // unavailable in France, and when" is a question that gets asked by a lawyer,
    // and the answer must not require reading a diff of a JSON blob.
    auditStatement(c.env.DB, actorId(c), 'availability_set', scope, id, {
      previous_mode: previous?.mode ?? null,
      previous_countries: previous?.countries ?? null,
      mode: policy.mode,
      countries: policy.countries,
      reason: policy.reason,
      starts_at: policy.starts_at,
      ends_at: policy.ends_at,
    }),
  ]);

  return c.json({
    success: true,
    data: await describe(c.env, c.req.raw, scope, id, null),
  });
});

/// `DELETE /admin/availability/:type/:id` — removes the override, keeps inheritance.
route.delete('/availability/:type/:id', requirePermission('publish'), async (c) => {
  const scope = c.req.param('type');
  const id = c.req.param('id') ?? '';
  if (!isAvailabilityScope(scope)) {
    return c.json({ success: false, error: 'Unsupported availability scope' }, 400);
  }
  if (scope === 'global') {
    return c.json({
      success: false,
      error: 'The platform default cannot be deleted; change its mode instead',
    }, 409);
  }
  const existing = await queryFirst<{ mode: string; countries: string; reason: string }>(c.env.DB, `
    SELECT mode, countries, reason FROM content_availability WHERE entity_type = ? AND entity_id = ?
  `, [scope, id]);
  if (!existing) return c.json({ success: false, error: 'No availability override on this entity' }, 404);

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM content_availability WHERE entity_type = ? AND entity_id = ?').bind(scope, id),
    auditStatement(c.env.DB, actorId(c), 'availability_cleared', scope, id, {
      previous_mode: existing.mode,
      previous_countries: existing.countries,
      previous_reason: existing.reason,
    }),
  ]);

  return c.json({
    success: true,
    // The newly effective decision, because removing an override does not
    // necessarily make anything available.
    data: await describe(c.env, c.req.raw, scope, id, null),
  });
});

/// `GET /admin/availability` — every configured policy, for the rights workspace.
route.get('/availability', requireAdmin, async (c) => {
  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT a.id, a.entity_type, a.entity_id, a.mode, a.countries, a.languages,
           a.platforms, a.starts_at, a.ends_at, a.reason, a.note, a.updated_at,
           COALESCE(s.title_ar, p.name_ar, st.title_ar, b.title_ar, g.title_ar, pr.title_ar) AS entity_title
      FROM content_availability a
      LEFT JOIN series s ON a.entity_type = 'series' AND s.id = a.entity_id
      LEFT JOIN planets p ON a.entity_type = 'planet' AND p.id = a.entity_id
      LEFT JOIN stories st ON a.entity_type = 'story' AND st.id = a.entity_id
      LEFT JOIN books b ON a.entity_type = 'book' AND b.id = a.entity_id
      LEFT JOIN games g ON a.entity_type = 'game' AND g.id = a.entity_id
      LEFT JOIN projects pr ON a.entity_type = 'project' AND pr.id = a.entity_id
     ORDER BY a.entity_type, a.updated_at DESC
  `);
  return c.json({ success: true, data: rows, meta: { total: rows.length } });
});

export default route;
