/// One search across every admin entity, for the global command palette.
///
/// ## Why one endpoint and not a search box per screen
///
/// The dashboard has 66 routes. An operator who knows a series title, a ticket reference or
/// a family id should not have to know which of those 66 screens owns it first. That is the
/// whole value of a command palette, and it only works if a single call can answer "what in
/// this platform matches these letters".
///
/// ## Authorisation is part of the answer, not a filter on top of it
///
/// A palette that returns a series title and then 403s when the operator opens it has leaked
/// the title. So the scope rules are applied in SQL:
///
/// * **Superusers and platform-scoped grants** see everything, exactly as `lib/adminUsers.ts`
///   already defines those two cases.
/// * **Anyone else** is restricted to the planets and series their grants name. Catalogue
///   rows outside that set are not returned.
/// * **Platform sources** — families, tickets, staff, teams, website pages, blog posts,
///   rights — are omitted entirely for a scope-restricted operator, and the payload says which
///   types were omitted and why. A silently short result list teaches an operator that the
///   search is unreliable; a stated omission teaches them what their grants cover.
/// * Two sources carry their screen's own permission on top of that: staff needs
///   `manage_permissions` and teams needs `manage_team`, the same guards those screens use.
///
/// ## What has no table
///
/// Campaigns and releases are in the programme's entity list and in no migration. They are
/// returned in `unavailable` with the reason, rather than as empty groups that look like "no
/// matches" — the difference between "nothing found" and "nothing exists" is the difference
/// between an operator retrying and an operator filing a bug.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll } from '../lib/db.ts';
import { requireAdmin, type AdminVariables } from '../lib/adminAuth.ts';
import { isSuperuser } from '../lib/adminUsers.ts';

type AppEnv = { Bindings: Env; Variables: AdminVariables };

const route = new Hono<AppEnv>();

/// Escapes the two LIKE wildcards so a query containing `%` matches a literal `%`.
///
/// Without this, a single `%` matches every row in the table, which is not a search result —
/// it is an accidental full dump ordered arbitrarily.
export function likeTerm(raw: string): string {
  return `%${raw.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/// The shortest query worth running.
///
/// One character matches most of the catalogue and returns an arbitrary slice of it, which
/// reads as a broken search rather than as a narrow one.
export const MIN_QUERY_LENGTH = 2;

export interface SearchResult {
  id: string;
  type: string;
  title: string;
  /// Extra identifying detail: a slug, a reference, a path, an e-mail.
  subtitle: string | null;
  status: string | null;
  /// Where the entity lives, relative to the admin base. The base itself is a client concern
  /// (`lib/adminPath.ts`), so the server never spells it out.
  admin_route: string;
  /// Resolved public artwork URL, or null. Never an asset id: the client cannot resolve one.
  image_url: string | null;
  /// Human context that makes two similar titles distinguishable — the parent series, the
  /// planet, the language.
  context: string | null;
}

export interface SearchGroup {
  type: string;
  results: SearchResult[];
}

/// Catalogue sources are planet-scoped; platform sources are not.
type SourceGroup = 'catalogue' | 'platform';

interface Source {
  type: string;
  group: SourceGroup;
  /// A permission the operator must hold for this source at all, or null.
  permission: string | null;
  run: (context: RunContext) => Promise<SearchResult[]>;
}

interface RunContext {
  db: D1Database;
  term: string;
  limit: number;
  /// null when the operator is unrestricted; otherwise the series ids they may see.
  allowedSeriesIds: string[] | null;
  allowedPlanetIds: string[] | null;
}

const placeholders = (values: unknown[]) => values.map(() => '?').join(', ');

/// Adds `AND <column> IN (...)` when the operator is restricted, and nothing when they are not.
function scopeClause(column: string, allowed: string[] | null): { sql: string; params: string[] } {
  if (allowed === null) return { sql: '', params: [] };
  if (!allowed.length) return { sql: ' AND 1 = 0', params: [] };
  return { sql: ` AND ${column} IN (${placeholders(allowed)})`, params: allowed };
}

const SOURCES: Source[] = [
  {
    type: 'planet',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedPlanetIds }) {
      const scope = scopeClause('p.id', allowedPlanetIds);
      const rows = await queryAll<{ id: string; name_ar: string; name_en: string | null; is_active: number }>(db, `
        SELECT p.id, p.name_ar, p.name_en, p.is_active FROM planets p
         WHERE (p.name_ar LIKE ? ESCAPE '\\' OR p.name_en LIKE ? ESCAPE '\\' OR p.id LIKE ? ESCAPE '\\')${scope.sql}
         ORDER BY p.sort_order LIMIT ?
      `, [term, term, term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'planet',
        title: row.name_ar,
        subtitle: row.name_en ?? row.id,
        status: row.is_active === 1 ? 'active' : 'archived',
        admin_route: `planets/${row.id}`,
        image_url: null,
        context: null,
      }));
    },
  },
  {
    type: 'series',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('s.id', allowedSeriesIds);
      const rows = await queryAll<{
        id: string; title_ar: string; title_en: string | null; slug: string; status: string;
        planet_name: string | null; cover_url: string | null;
      }>(db, `
        SELECT s.id, s.title_ar, s.title_en, s.slug, s.status, s.cover_url,
               p.name_ar AS planet_name
          FROM series s LEFT JOIN planets p ON p.id = s.planet_id
         WHERE (s.title_ar LIKE ? ESCAPE '\\' OR s.title_en LIKE ? ESCAPE '\\' OR s.slug LIKE ? ESCAPE '\\')${scope.sql}
         ORDER BY s.sort_order, s.title_ar LIMIT ?
      `, [term, term, term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'series',
        title: row.title_ar,
        subtitle: row.slug,
        status: row.status,
        admin_route: `series/${row.id}`,
        image_url: row.cover_url,
        context: row.planet_name,
      }));
    },
  },
  {
    type: 'season',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('se.series_id', allowedSeriesIds);
      const rows = await queryAll<{
        id: string; title_ar: string | null; season_number: number; status: string; series_title: string | null;
      }>(db, `
        SELECT se.id, se.title_ar, se.season_number, se.status, s.title_ar AS series_title
          FROM seasons se LEFT JOIN series s ON s.id = se.series_id
         WHERE (se.title_ar LIKE ? ESCAPE '\\' OR s.title_ar LIKE ? ESCAPE '\\')${scope.sql}
         ORDER BY se.season_number LIMIT ?
      `, [term, term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'season',
        title: row.title_ar ?? `الموسم ${row.season_number}`,
        subtitle: `#${row.season_number}`,
        status: row.status,
        admin_route: `seasons/${row.id}`,
        image_url: null,
        context: row.series_title,
      }));
    },
  },
  {
    type: 'episode',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('e.series_id', allowedSeriesIds);
      const rows = await queryAll<{
        id: string; title_ar: string; episode_number: number | null; status: string;
        thumbnail_url: string | null; series_title: string | null;
      }>(db, `
        SELECT e.id, e.title_ar, e.episode_number, e.status, e.thumbnail_url,
               s.title_ar AS series_title
          FROM episodes e LEFT JOIN series s ON s.id = e.series_id
         WHERE e.title_ar LIKE ? ESCAPE '\\'${scope.sql}
         ORDER BY e.episode_number LIMIT ?
      `, [term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'episode',
        title: row.title_ar,
        subtitle: row.episode_number === null ? null : `#${row.episode_number}`,
        status: row.status,
        admin_route: `episodes/${row.id}`,
        image_url: row.thumbnail_url,
        context: row.series_title,
      }));
    },
  },
  {
    type: 'character',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('ch.series_id', allowedSeriesIds);
      const rows = await queryAll<{ id: string; name_ar: string; role: string | null; status: string; series_title: string | null }>(db, `
        SELECT ch.id, ch.name_ar, ch.role, ch.status, s.title_ar AS series_title
          FROM characters ch LEFT JOIN series s ON s.id = ch.series_id
         WHERE ch.name_ar LIKE ? ESCAPE '\\'${scope.sql}
         ORDER BY ch.name_ar LIMIT ?
      `, [term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'character',
        title: row.name_ar,
        subtitle: row.role,
        status: row.status,
        admin_route: `characters/${row.id}`,
        image_url: null,
        context: row.series_title,
      }));
    },
  },
  {
    type: 'story',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      // A story may have no series, and a story with no series cannot be attributed to a
      // planet — so a scope-restricted operator does not see it. Guessing the other way would
      // make an unattributed row visible to everyone.
      const scope = scopeClause('st.series_id', allowedSeriesIds);
      const rows = await queryAll<{ id: string; title_ar: string; slug: string; status: string; type: string }>(db, `
        SELECT st.id, st.title_ar, st.slug, st.status, st.type FROM stories st
         WHERE (st.title_ar LIKE ? ESCAPE '\\' OR st.title_en LIKE ? ESCAPE '\\' OR st.slug LIKE ? ESCAPE '\\')${scope.sql}
         ORDER BY st.sort_order, st.title_ar LIMIT ?
      `, [term, term, term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'story',
        title: row.title_ar,
        subtitle: row.slug,
        status: row.status,
        admin_route: `stories/${row.id}`,
        image_url: null,
        context: row.type,
      }));
    },
  },
  {
    type: 'book',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('b.series_id', allowedSeriesIds);
      const rows = await queryAll<{ id: string; title_ar: string; status: string; type: string }>(db, `
        SELECT b.id, b.title_ar, b.status, b.type FROM books b
         WHERE b.title_ar LIKE ? ESCAPE '\\'${scope.sql}
         ORDER BY b.title_ar LIMIT ?
      `, [term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'book',
        title: row.title_ar,
        subtitle: row.type,
        status: row.status,
        admin_route: `library-content/book/${row.id}`,
        image_url: null,
        context: null,
      }));
    },
  },
  {
    type: 'game',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('g.series_id', allowedSeriesIds);
      const rows = await queryAll<{ id: string; title_ar: string; status: string; engine_id: string }>(db, `
        SELECT g.id, g.title_ar, g.status, g.engine_id FROM games g
         WHERE g.title_ar LIKE ? ESCAPE '\\'${scope.sql}
         ORDER BY g.title_ar LIMIT ?
      `, [term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'game',
        title: row.title_ar,
        subtitle: row.engine_id,
        status: row.status,
        admin_route: `games/${row.id}`,
        image_url: null,
        context: null,
      }));
    },
  },
  {
    type: 'project',
    group: 'catalogue',
    permission: null,
    async run({ db, term, limit, allowedSeriesIds }) {
      const scope = scopeClause('pr.series_id', allowedSeriesIds);
      const rows = await queryAll<{ id: string; title_ar: string; status: string }>(db, `
        SELECT pr.id, pr.title_ar, pr.status FROM projects pr
         WHERE pr.title_ar LIKE ? ESCAPE '\\'${scope.sql}
         ORDER BY pr.title_ar LIMIT ?
      `, [term, ...scope.params, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'project',
        title: row.title_ar,
        subtitle: null,
        status: row.status,
        admin_route: `library-content/project/${row.id}`,
        image_url: null,
        context: null,
      }));
    },
  },
  {
    type: 'media',
    group: 'platform',
    permission: null,
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; title_ar: string; kind: string; status: string; original_filename: string | null }>(db, `
        SELECT id, title_ar, kind, status, original_filename FROM content_assets
         WHERE title_ar LIKE ? ESCAPE '\\' OR original_filename LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'media',
        title: row.title_ar,
        subtitle: row.original_filename,
        status: row.status,
        admin_route: `media/${row.id}`,
        image_url: null,
        context: row.kind,
      }));
    },
  },
  {
    type: 'family',
    group: 'platform',
    permission: null,
    async run({ db, term, limit }) {
      // The family id is searchable and the display name is matched but not the e-mail: there
      // is no e-mail index by design (see the /customers verdict), and a palette is not the
      // place to introduce one.
      const rows = await queryAll<{ parent_id: string; display_name: string | null; plan: string; status: string }>(db, `
        SELECT parent_id, display_name, plan, status FROM family_projection
         WHERE parent_id LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\'
         ORDER BY last_event_at_ms DESC LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.parent_id,
        type: 'family',
        title: row.display_name ?? row.parent_id,
        subtitle: row.parent_id,
        status: row.status,
        admin_route: `customers/${row.parent_id}`,
        image_url: null,
        context: row.plan,
      }));
    },
  },
  {
    type: 'ticket',
    group: 'platform',
    permission: null,
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; reference: string; subject: string; status: string; priority: string }>(db, `
        SELECT id, reference, subject, status, priority FROM support_tickets
         WHERE reference LIKE ? ESCAPE '\\' OR subject LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'ticket',
        title: row.subject,
        subtitle: row.reference,
        status: row.status,
        admin_route: `support-center?ticket=${encodeURIComponent(row.id)}`,
        image_url: null,
        context: row.priority,
      }));
    },
  },
  {
    type: 'employee',
    group: 'platform',
    permission: 'manage_permissions',
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; display_name: string; email: string; is_active: number }>(db, `
        SELECT id, display_name, email, is_active FROM admin_users
         WHERE display_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
         ORDER BY display_name LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'employee',
        title: row.display_name,
        subtitle: row.email,
        status: row.is_active === 1 ? 'active' : 'disabled',
        admin_route: `team-access?q=${encodeURIComponent(row.email)}`,
        image_url: null,
        context: null,
      }));
    },
  },
  {
    type: 'team',
    group: 'platform',
    permission: 'manage_team',
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; name_ar: string; section: string | null; planet_id: string | null }>(db, `
        SELECT id, name_ar, section, planet_id FROM teams
         WHERE name_ar LIKE ? ESCAPE '\\' OR section LIKE ? ESCAPE '\\'
         ORDER BY name_ar LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'team',
        title: row.name_ar,
        subtitle: row.section,
        status: null,
        admin_route: 'teams',
        image_url: null,
        context: row.planet_id,
      }));
    },
  },
  {
    type: 'website_page',
    group: 'platform',
    permission: null,
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; title: string; path: string; language: string; status: string }>(db, `
        SELECT id, title, path, language, status FROM web_pages
         WHERE title LIKE ? ESCAPE '\\' OR path LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'website_page',
        title: row.title,
        subtitle: row.path,
        status: row.status,
        admin_route: `website/pages/${row.id}`,
        image_url: null,
        context: row.language,
      }));
    },
  },
  {
    type: 'blog_post',
    group: 'platform',
    permission: null,
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; title: string; path: string; language: string; status: string }>(db, `
        SELECT id, title, path, language, status FROM blog_posts
         WHERE title LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'blog_post',
        title: row.title,
        subtitle: row.path,
        status: row.status,
        admin_route: `blog/posts/${row.id}`,
        image_url: null,
        context: row.language,
      }));
    },
  },
  {
    type: 'rights',
    group: 'platform',
    permission: null,
    async run({ db, term, limit }) {
      const rows = await queryAll<{ id: string; owner: string; entity_type: string; entity_id: string; expiry: string | null }>(db, `
        SELECT id, owner, entity_type, entity_id, expiry FROM content_rights
         WHERE owner LIKE ? ESCAPE '\\' OR entity_id LIKE ? ESCAPE '\\'
         ORDER BY created_at DESC LIMIT ?
      `, [term, term, limit]);
      return rows.map((row) => ({
        id: row.id,
        type: 'rights',
        title: row.owner,
        subtitle: `${row.entity_type}: ${row.entity_id}`,
        status: row.expiry && row.expiry < new Date().toISOString().slice(0, 10) ? 'expired' : 'active',
        admin_route: 'rights',
        image_url: null,
        context: row.expiry,
      }));
    },
  },
];

/// Entity types the programme lists and no migration provides.
const UNAVAILABLE = [
  { type: 'campaign', reason: 'لا جدول حملات في أي مهاجرة، ولا مسار API. /campaigns تشرح ما ينقص.' },
  { type: 'release', reason: 'لا جدول إصدارات: جدولة النشر تُخزَّن على كل كيان لا كسجل إصدار.' },
];

/// Every type this endpoint can search, for the client's type filter.
export const SEARCH_TYPES = SOURCES.map((source) => ({ type: source.type, group: source.group }));

/// A session user as far as authorisation is concerned.
export interface SearchActor {
  roles: string[];
  permissions?: string[];
  grants?: Array<{ scope_type: string; scope_id?: string | null; permissions: string[] }>;
}

/// True when the operator's grants place no limit on which content they may see.
///
/// Exactly the two cases `lib/adminUsers.ts` already defines as unscoped: a superuser role, or
/// a grant at platform scope. `null` — the break-glass key path, permitted only before the
/// first admin user exists — is unrestricted for the same reason `requireAdmin` allows it at
/// all: there is no identity to scope by yet.
export function isUnrestricted(user: SearchActor | null | undefined): boolean {
  if (!user) return true;
  if (isSuperuser(user)) return true;
  return (user.grants ?? []).some((grant) => grant.scope_type === 'platform');
}

/// Chooses which sources to run, and records why each omitted one was omitted.
///
/// Separated from the handler and exported so the authorisation decision can be asserted
/// without a database: a rule that only exists inside a request handler is a rule that gets
/// tested by hoping.
export function selectSources(input: {
  user: SearchActor | null | undefined;
  requestedTypes: string[];
}): { sources: Source[]; omitted: Array<{ type: string; reason: string }> } {
  const unrestricted = isUnrestricted(input.user);
  const user = input.user;
  const omitted: Array<{ type: string; reason: string }> = [];
  const sources = SOURCES.filter((source) => {
    if (input.requestedTypes.length && !input.requestedTypes.includes(source.type)) return false;
    if (source.group === 'platform' && !unrestricted) {
      omitted.push({
        type: source.type,
        reason: 'منح الوصول مقصور على محتوى محدّد، فلا تُعرض نتائج على مستوى المنصّة.',
      });
      return false;
    }
    if (source.permission && user && !isSuperuser(user)
      && !(user.permissions ?? []).includes(source.permission)) {
      omitted.push({ type: source.type, reason: `يتطلّب صلاحية ${source.permission}.` });
      return false;
    }
    return true;
  });
  return { sources, omitted };
}

/// Resolves the catalogue a scope-restricted operator may see.
///
/// Series reachable through a planet grant are resolved once rather than as a correlated
/// subquery per source: nine sources would otherwise repeat the same join nine times.
export async function resolveCatalogueScope(
  db: D1Database,
  user: SearchActor,
): Promise<{ allowedSeriesIds: string[]; allowedPlanetIds: string[] }> {
  const grants = user.grants ?? [];
  const planetIds = grants.filter((grant) => grant.scope_type === 'planet' && grant.scope_id)
    .map((grant) => grant.scope_id as string);
  const seriesIds = grants.filter((grant) => grant.scope_type === 'series' && grant.scope_id)
    .map((grant) => grant.scope_id as string);

  const reachable = planetIds.length
    ? await queryAll<{ id: string }>(db,
        `SELECT id FROM series WHERE planet_id IN (${placeholders(planetIds)})`, planetIds)
    : [];
  const allowedSeriesIds = [...new Set([...seriesIds, ...reachable.map((row) => row.id)])];
  const seriesPlanets = allowedSeriesIds.length
    ? await queryAll<{ planet_id: string }>(db,
        `SELECT DISTINCT planet_id FROM series WHERE id IN (${placeholders(allowedSeriesIds)})`, allowedSeriesIds)
    : [];
  return {
    allowedSeriesIds,
    allowedPlanetIds: [...new Set([...planetIds, ...seriesPlanets.map((row) => row.planet_id)])],
  };
}

/// `GET /admin/search?q=...&types=series,episode&limit=5`
route.get('/search', requireAdmin, async (c) => {
  const raw = (c.req.query('q') ?? '').trim();
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '5', 10) || 5, 1), 20);
  const requestedTypes = (c.req.query('types') ?? '').split(',').map((value) => value.trim()).filter(Boolean);

  if (raw.length < MIN_QUERY_LENGTH) {
    return c.json({
      success: true,
      data: {
        query: raw, groups: [], total: 0, unavailable: UNAVAILABLE, failed: [],
        scope: { restricted: false, omitted_types: [] },
        min_length: MIN_QUERY_LENGTH,
        types: SEARCH_TYPES,
      },
    });
  }

  const user = c.get('adminUser');
  const unrestricted = isUnrestricted(user);

  let allowedPlanetIds: string[] | null = null;
  let allowedSeriesIds: string[] | null = null;
  if (!unrestricted && user) {
    const scope = await resolveCatalogueScope(c.env.DB, user);
    allowedSeriesIds = scope.allowedSeriesIds;
    allowedPlanetIds = scope.allowedPlanetIds;
  }

  const { sources, omitted } = selectSources({ user, requestedTypes });
  const term = likeTerm(raw);
  const context: RunContext = { db: c.env.DB, term, limit, allowedSeriesIds, allowedPlanetIds };

  const groups: SearchGroup[] = [];
  const failures: Array<{ type: string; reason: string }> = [];
  const settled = await Promise.allSettled(sources.map(async (source) => ({
    type: source.type,
    results: await source.run(context),
  })));
  for (const [index, outcome] of settled.entries()) {
    if (outcome.status === 'fulfilled') {
      if (outcome.value.results.length) groups.push(outcome.value);
    } else {
      // One failing source must not blank the palette. Naming it is what makes the gap
      // visible instead of looking like "no matches".
      failures.push({
        type: sources[index]?.type ?? 'unknown',
        reason: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason),
      });
    }
  }

  return c.json({
    success: true,
    data: {
      query: raw,
      groups,
      total: groups.reduce((sum, group) => sum + group.results.length, 0),
      unavailable: UNAVAILABLE,
      failed: failures,
      scope: { restricted: !unrestricted, omitted_types: omitted },
      types: SEARCH_TYPES,
    },
  });
});

export default route;
