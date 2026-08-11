/// Planet endpoints: the collection with its real health signals, the workspace
/// aggregate, the content tree, and the three writes.
///
/// ## Why planets get their own router
///
/// They were four handlers inside `adminContent.ts` returning `name + colour +
/// series_count`, and the planet screens could not answer a single operational
/// question from them. Everything a planet workspace needs — content composition,
/// artwork, localisation, production, learning links, reviews, availability, audit —
/// reaches a planet through `series.planet_id`, so those joins are shared and belong
/// in one file rather than scattered through the router that also owns stories,
/// books, games and projects.
///
/// ## Two rules this file does not bend
///
/// **1. Zero and "cannot be read" are different answers.** Same rule and same helper
/// as `adminExecutive.ts`: [readRow] returns `null` when a statement fails, and
/// because every aggregate here is a single `SELECT` of scalar subqueries, SQLite
/// always returns exactly one row — so `null` never means "no rows matched". A module
/// built from a `null` row carries `unavailable` and no numbers.
///
/// **2. A metric that cannot be computed honestly is not shipped.** The audit behind
/// this file asked for playback analytics, per-planet production completion and a
/// planet publication state. None of the three exists:
///
/// * `watch_progress`, `attempts` and `mastery` are D1 tables with **no writer** —
///   child activity lives in the FamilyState Durable Object — so any per-planet view
///   count would be an invented zero. The analytics module says so instead.
/// * `production_requirements` stores only the human layer (owner, due date,
///   blocker). Completion is derived per item in `lib/productionMatrix.ts`, so a
///   planet-wide percentage would mean running that matrix for every episode and
///   story on the planet. This reports what is stored and names the board as the
///   place completion is computed.
/// * `planets` has one state column, `is_active`. No status, no `published_at`, no
///   publish gate — so this file never speaks of a planet being published. What a
///   planet does have is an availability policy (`content_availability` accepts
///   `entity_type='planet'`), and that is real.
///
/// ## Test fixtures
///
/// `series.content_class` separates supplied test material from Majarra content
/// (migration 0018). Every health and workspace counter restricts to
/// `content_class = 'production'`. The legacy `series_count` and `assets_count`
/// fields on list rows keep their original meaning, because `TaxonomyPage` and other
/// callers already read them.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { pathParam } from '../lib/routeParams.ts';
import {
  applyArtworkUrl,
  artworkSelect,
  publicAssetBaseUrl,
  PLANET_COVER_ROLES,
  PLANET_ICON_ROLES,
  SERIES_COVER_ROLES,
  EPISODE_THUMBNAIL_ROLES,
} from '../lib/assetUrls.ts';
import { requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { SQL_DEADLINE_PASSED } from '../lib/supportCrm.ts';
import { availabilityChainScopes } from '../lib/availabilityPolicy.ts';

type AppEnv = { Bindings: Env };
type Row = Record<string, unknown>;

const route = new Hono<AppEnv>();

/// The languages the platform actually models. There is no languages registry table:
/// `game_localizations` constrains these three by CHECK, `lib/productionMatrix.ts`
/// names one requirement per language, and the availability validator accepts the
/// same set. A wider list here would describe columns that do not exist.
const LANGUAGES = ['ar', 'en', 'fr'] as const;
type Language = (typeof LANGUAGES)[number];

/// Caps, advertised in `meta` so a capped tree is never read as the whole planet.
const TREE_SERIES_LIMIT = 60;
const TREE_EPISODE_LIMIT = 400;
const ACTIVITY_LIMIT = 14;
const LIST_LIMIT = 12;

/// How far ahead a rights expiry still counts as "expiring soon". 30 days is the
/// renewal notice period the rights screen already uses, so both screens agree on
/// which agreements are urgent.
const RIGHTS_EXPIRY_WINDOW_DAYS = 30;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const nullableText = (value: unknown): string | null | undefined => {
  if (value === null || value === '') return null;
  return typeof value === 'string' ? value.trim() || null : undefined;
};

const integer = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const boolInt = (value: unknown) => (value === true || value === 1 || value === '1' ? 1 : 0);

const slugify = (value: string, fallback: string) => {
  const slug = value.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return slug || `${fallback}-${crypto.randomUUID().slice(0, 8)}`;
};

const isConstraintError = (error: unknown) =>
  /UNIQUE|constraint|FOREIGN KEY/i.test(error instanceof Error ? error.message : String(error));

function audit(db: D1Database, c: never, action: string, entityId: string, details: unknown) {
  return auditStatement(db, actorId(c), action, 'planet', entityId, details);
}

/// One aggregate row, or `null` when the statement could not run. See the header.
async function readRow(db: D1Database, sql: string, params: unknown[] = []): Promise<Row | null> {
  try {
    return await queryFirst<Row>(db, sql, params);
  } catch {
    return null;
  }
}

/// A list, or `null` when the statement could not run — distinct from an empty list.
async function readRows<T>(db: D1Database, sql: string, params: unknown[] = []): Promise<T[] | null> {
  try {
    return await queryAll<T>(db, sql, params);
  } catch {
    return null;
  }
}

const num = (row: Row | null, key: string): number => Number(row?.[key] ?? 0);

// --- Shared SQL ------------------------------------------------------------

/// Everything on a planet, as CTEs, from the one column that points at a planet.
///
/// `stories`, `books`, `games` and `projects` may hang off no series at all, and an
/// unparented row cannot be attributed to any planet — so such rows are absent here
/// by construction. The workspace reports how many exist platform-wide rather than
/// letting a planet total imply it covers them.
const PLANET_SCOPE = `
  WITH ps AS (
    SELECT id, status, title_en, description_en, updated_at, source_type,
           religious_reviewer_id, religious_approved_at
      FROM series
     WHERE planet_id = ?1 AND content_class = 'production' AND status <> 'archived'
  ),
  pe AS (
    SELECT e.id, e.series_id, e.status, e.is_published, e.dubs, e.updated_at,
           e.learning_objective_id, e.thumbnail_url, e.video_master_url, e.captions_ar_url
      FROM episodes e WHERE e.series_id IN (SELECT id FROM ps)
  ),
  pst AS (
    SELECT st.id, st.status, st.default_language, st.languages
      FROM stories st WHERE st.series_id IN (SELECT id FROM ps)
  ),
  pg AS (
    SELECT g.id, g.status, g.learning_objective_id
      FROM games g
     WHERE g.series_id IN (SELECT id FROM ps)
        OR g.episode_id IN (SELECT id FROM pe)
  )
`;

/// A requirement row belonging to this planet, through its episode or story.
const PLANET_REQUIREMENTS = `
  FROM production_requirements pr
  LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
  LEFT JOIN stories st ON pr.content_type = 'story' AND st.id = pr.content_id
  JOIN series s ON s.id = COALESCE(e.series_id, st.series_id)
 WHERE s.planet_id = ?1 AND s.content_class = 'production'
`;

/// A review row on this planet's series or episodes. `content_reviews` cannot hold a
/// story row at all (its CHECK omits `'story'`), so stories are absent by schema and
/// must never be reported as "missing a review".
const PLANET_REVIEW_SCOPE = `
  (cr.entity_type = 'series' AND cr.entity_id IN (SELECT id FROM ps))
  OR (cr.entity_type = 'episode' AND cr.entity_id IN (SELECT id FROM pe))
`;

/// Whether a ready, public artwork row is linked for one of [roles].
///
/// Deliberately separate from the resolved URL: `publicAssetBaseUrl` returns null
/// when `PUBLIC_ASSET_BASE_URL` is unset, so every URL would be null on a worker
/// with no CDN — and reporting "no artwork" for a planet whose artwork is uploaded
/// and ready would send an operator to fix the wrong thing.
const artworkLinked = (entityType: string, idColumn: string, roles: readonly string[]) => `
  EXISTS (SELECT 1 FROM asset_links al JOIN content_assets ca ON ca.id = al.asset_id
           WHERE al.entity_type = '${entityType}' AND al.entity_id = ${idColumn}
             AND al.role IN (${roles.map((role) => `'${role}'`).join(', ')})
             AND ca.status = 'ready' AND ca.visibility = 'public'
             AND ca.kind NOT IN ('video', 'archive'))
`;

// --- The collection -------------------------------------------------------

interface PlanetHealth {
  series_total: number;
  series_published: number;
  series_pipeline: number;
  seasons_total: number;
  episodes_total: number;
  episodes_published: number;
  episodes_ready_unpublished: number;
  stories_total: number;
  books_total: number;
  games_total: number;
  projects_total: number;
  characters_total: number;
  artwork_icon: boolean;
  artwork_cover: boolean;
  has_description: boolean;
  production_blockers: number;
  reviews_pending: number;
  series_with_english_title: number;
  /// Newest `updated_at` across this planet's series and episodes. `planets` has no
  /// `updated_at` column, so this is content activity and is labelled as such.
  content_updated_at: string | null;
}

const LIST_SQL = `
  SELECT p.id, p.name_ar, p.name_en, p.description_ar, p.color_hex, p.icon_url,
         p.sort_order, p.is_active, p.created_at,
    (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.status <> 'archived') AS series_count,
    (SELECT COUNT(*) FROM asset_links al WHERE al.entity_type = 'planet' AND al.entity_id = p.id) AS assets_count,

    (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.content_class = 'production' AND s.status <> 'archived') AS h_series_total,
    (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.content_class = 'production' AND s.status = 'published') AS h_series_published,
    (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.content_class = 'production' AND s.status NOT IN ('published', 'archived')) AS h_series_pipeline,
    (SELECT COUNT(*) FROM seasons se JOIN series s ON s.id = se.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND s.status <> 'archived') AS h_seasons_total,
    (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND e.status <> 'archived') AS h_episodes_total,
    (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND e.is_published = 1) AS h_episodes_published,
    (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND e.status = 'ready' AND e.is_published = 0) AS h_episodes_ready_unpublished,
    (SELECT COUNT(*) FROM stories st JOIN series s ON s.id = st.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND st.status <> 'archived') AS h_stories_total,
    (SELECT COUNT(*) FROM books b JOIN series s ON s.id = b.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND b.status <> 'archived') AS h_books_total,
    (SELECT COUNT(*) FROM games g LEFT JOIN episodes ge ON ge.id = g.episode_id
       JOIN series s ON s.id = COALESCE(g.series_id, ge.series_id)
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND g.status <> 'archived') AS h_games_total,
    (SELECT COUNT(*) FROM projects pj LEFT JOIN episodes pje ON pje.id = pj.episode_id
       JOIN series s ON s.id = COALESCE(pj.series_id, pje.series_id)
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND pj.status <> 'archived') AS h_projects_total,
    (SELECT COUNT(*) FROM characters ch JOIN series s ON s.id = ch.series_id
      WHERE s.planet_id = p.id AND s.content_class = 'production' AND ch.status <> 'archived') AS h_characters_total,
    (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.content_class = 'production'
       AND s.status <> 'archived' AND s.title_en IS NOT NULL AND TRIM(s.title_en) <> '') AS h_series_english,

    ${artworkLinked('planet', 'p.id', PLANET_ICON_ROLES)} AS h_artwork_icon,
    ${artworkLinked('planet', 'p.id', PLANET_COVER_ROLES)} AS h_artwork_cover,

    (SELECT COUNT(*) FROM production_requirements pr
       LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
       LEFT JOIN stories st ON pr.content_type = 'story' AND st.id = pr.content_id
       JOIN series s ON s.id = COALESCE(e.series_id, st.series_id)
      WHERE s.planet_id = p.id AND s.content_class = 'production'
        AND pr.blocker IS NOT NULL AND TRIM(pr.blocker) <> '') AS h_production_blockers,

    (SELECT COUNT(*) FROM content_reviews cr WHERE cr.status = 'pending' AND (
        (cr.entity_type = 'series' AND cr.entity_id IN (SELECT id FROM series WHERE planet_id = p.id))
     OR (cr.entity_type = 'episode' AND cr.entity_id IN
          (SELECT e.id FROM episodes e JOIN series s ON s.id = e.series_id WHERE s.planet_id = p.id))
     )) AS h_reviews_pending,

    (SELECT MAX(stamp) FROM (
       SELECT MAX(s.updated_at) AS stamp FROM series s WHERE s.planet_id = p.id
       UNION ALL
       SELECT MAX(e.updated_at) FROM episodes e JOIN series s ON s.id = e.series_id WHERE s.planet_id = p.id
     )) AS h_content_updated_at,

    ${artworkSelect('icon_asset', 'planet', 'p.id', PLANET_ICON_ROLES)},
    ${artworkSelect('cover_asset', 'planet', 'p.id', PLANET_COVER_ROLES)}
  FROM planets p
  ORDER BY p.sort_order, p.created_at
`;

function planetHealth(row: Row): PlanetHealth {
  return {
    series_total: Number(row.h_series_total ?? 0),
    series_published: Number(row.h_series_published ?? 0),
    series_pipeline: Number(row.h_series_pipeline ?? 0),
    seasons_total: Number(row.h_seasons_total ?? 0),
    episodes_total: Number(row.h_episodes_total ?? 0),
    episodes_published: Number(row.h_episodes_published ?? 0),
    episodes_ready_unpublished: Number(row.h_episodes_ready_unpublished ?? 0),
    stories_total: Number(row.h_stories_total ?? 0),
    books_total: Number(row.h_books_total ?? 0),
    games_total: Number(row.h_games_total ?? 0),
    projects_total: Number(row.h_projects_total ?? 0),
    characters_total: Number(row.h_characters_total ?? 0),
    artwork_icon: Boolean(row.h_artwork_icon),
    artwork_cover: Boolean(row.h_artwork_cover),
    has_description: !!text(row.description_ar),
    production_blockers: Number(row.h_production_blockers ?? 0),
    reviews_pending: Number(row.h_reviews_pending ?? 0),
    series_with_english_title: Number(row.h_series_english ?? 0),
    content_updated_at: typeof row.h_content_updated_at === 'string' ? row.h_content_updated_at : null,
  };
}

/// Builds the client row by naming its fields rather than spreading the database row
/// and deleting the internal `h_*` aliases afterwards. Two reasons: a new aggregate
/// alias cannot leak by being forgotten in a delete list, and the database row is not
/// mutated, so the same rows can be read twice without the second read seeing a
/// stripped object.
function serializePlanetRow(row: Row) {
  return {
    id: String(row.id),
    name_ar: row.name_ar,
    name_en: row.name_en ?? null,
    description_ar: row.description_ar ?? null,
    color_hex: row.color_hex,
    icon_url: row.icon_url ?? null,
    cover_url: row.cover_url ?? null,
    sort_order: Number(row.sort_order ?? 0),
    is_active: Boolean(row.is_active),
    created_at: row.created_at ?? null,
    series_count: Number(row.series_count ?? 0),
    assets_count: Number(row.assets_count ?? 0),
    health: planetHealth(row),
  };
}

type PlanetListRow = ReturnType<typeof serializePlanetRow>;

const hasContent = (health: PlanetHealth) =>
  health.series_total + health.stories_total + health.games_total
  + health.books_total + health.projects_total > 0;

const isPublished = (health: PlanetHealth) => health.series_published + health.episodes_published > 0;

const artworkComplete = (health: PlanetHealth) => health.artwork_icon && health.artwork_cover;

/// `GET /admin/planets`
///
/// Filtering and sorting run on the worker over rows the database has already
/// aggregated — one statement, one row per planet, no N+1 and nothing fetched twice.
/// They are not pushed into SQL because the header summary must describe the whole
/// set while the table shows the filtered subset: deriving both from the same rows
/// makes it impossible for the summary to disagree with the list.
route.get('/planets', async (c) => {
  const baseUrl = publicAssetBaseUrl(c.env);
  const rows = await readRows<Row>(c.env.DB, LIST_SQL);
  if (!rows) {
    return c.json({
      success: false,
      error: 'تعذّرت قراءة جدول الكواكب ومؤشّراته. لا تُعرض أصفار بدل أرقام لم تُقرأ.',
    }, 503);
  }

  for (const row of rows) {
    applyArtworkUrl(row, 'icon_asset', 'icon_url', baseUrl);
    row.cover_url = null;
    applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl);
  }

  const all: PlanetListRow[] = rows.map(serializePlanetRow);

  // The historical parameter stays honoured: `include_inactive=1` was the only way
  // to see a disabled planet, and TaxonomyPage still sends it. An explicit `status`
  // filter implies the caller wants to reason about both states.
  const includeInactive = c.req.query('include_inactive') === '1' || !!c.req.query('status');
  const query = (c.req.query('q') ?? '').trim().toLowerCase();
  const status = c.req.query('status');
  const content = c.req.query('content');
  const artwork = c.req.query('artwork');
  const description = c.req.query('description');
  const production = c.req.query('production');
  /// Only English is offered as a localization filter, and only over series titles.
  /// `series.title_ar` is NOT NULL so an Arabic filter would match every planet, and
  /// no French title column exists at all — offering `fr` here would filter on a
  /// column that does not exist and report every planet as 0% French. The richer
  /// five-signal matrix lives on the workspace, where the denominators are visible.
  const localization = c.req.query('localization');
  const sort = c.req.query('sort') ?? 'order';

  let visible = all.filter((planet) => includeInactive || planet.is_active);
  if (query) {
    visible = visible.filter((planet) => [planet.name_ar, planet.name_en, planet.id]
      .some((value) => typeof value === 'string' && value.toLowerCase().includes(query)));
  }
  if (status === 'active') visible = visible.filter((planet) => planet.is_active);
  if (status === 'inactive') visible = visible.filter((planet) => !planet.is_active);
  if (content === 'has') visible = visible.filter((planet) => hasContent(planet.health));
  if (content === 'empty') visible = visible.filter((planet) => !hasContent(planet.health));
  if (content === 'published') visible = visible.filter((planet) => isPublished(planet.health));
  if (content === 'unpublished') visible = visible.filter((planet) => !isPublished(planet.health));
  if (artwork === 'complete') visible = visible.filter((planet) => artworkComplete(planet.health));
  if (artwork === 'missing') visible = visible.filter((planet) => !artworkComplete(planet.health));
  if (description === 'complete') visible = visible.filter((planet) => planet.health.has_description);
  if (description === 'missing') visible = visible.filter((planet) => !planet.health.has_description);
  if (production === 'blocked') visible = visible.filter((planet) => planet.health.production_blockers > 0);
  if (production === 'healthy') visible = visible.filter((planet) => planet.health.production_blockers === 0);
  /// `en_complete` means every non-archived production series on the planet carries an
  /// English title. A planet with no series at all is excluded from both buckets: it is
  /// neither complete nor incomplete, and putting it in either would send an operator
  /// to a planet with nothing to translate.
  if (localization === 'en_complete') {
    visible = visible.filter((planet) => planet.health.series_total > 0
      && planet.health.series_with_english_title >= planet.health.series_total);
  }
  if (localization === 'en_incomplete') {
    visible = visible.filter((planet) => planet.health.series_total > 0
      && planet.health.series_with_english_title < planet.health.series_total);
  }

  const weight = (planet: PlanetListRow) =>
    planet.health.series_total + planet.health.episodes_total + planet.health.stories_total
    + planet.health.games_total + planet.health.books_total + planet.health.projects_total;

  const collator = new Intl.Collator('ar');
  const sorted = [...visible];
  if (sort === 'name') sorted.sort((a, b) => collator.compare(String(a.name_ar), String(b.name_ar)));
  else if (sort === 'updated') {
    sorted.sort((a, b) => String(b.health.content_updated_at ?? '')
      .localeCompare(String(a.health.content_updated_at ?? '')));
  } else if (sort === 'content_desc') sorted.sort((a, b) => weight(b) - weight(a));
  else if (sort === 'content_asc') sorted.sort((a, b) => weight(a) - weight(b));
  else sorted.sort((a, b) => Number(a.sort_order) - Number(b.sort_order));

  const summary = {
    total: all.length,
    active: all.filter((planet) => planet.is_active).length,
    inactive: all.filter((planet) => !planet.is_active).length,
    with_published_content: all.filter((planet) => isPublished(planet.health)).length,
    without_published_content: all.filter((planet) => !isPublished(planet.health)).length,
    empty: all.filter((planet) => !hasContent(planet.health)).length,
    missing_artwork: all.filter((planet) => !artworkComplete(planet.health)).length,
    missing_description: all.filter((planet) => !planet.health.has_description).length,
    with_production_blockers: all.filter((planet) => planet.health.production_blockers > 0).length,
  };

  return c.json({
    success: true,
    data: sorted,
    meta: {
      total: sorted.length,
      summary,
      // Stated because these fields answer different questions, and a reader
      // comparing them deserves to know why they differ.
      notes: [
        'مؤشّرات health تستثني محتوى الاختبار (series.content_class = test_fixture)، بينما'
        + ' series_count و assets_count محفوظان بمعناهما الأصلي لأن شاشات أخرى تقرأهما.',
        'الكوكب بلا عمود updated_at، فـcontent_updated_at هو أحدث تعديل على سلاسله وحلقاته.',
        ...(baseUrl ? [] : ['PUBLIC_ASSET_BASE_URL غير مضبوط فروابط الصور تعود null؛ ومؤشّر وجود'
          + ' الصورة يُقرأ من asset_links لا من الرابط، فلا يُبلَّغ عن غياب صورة موجودة.']),
      ],
    },
  });
});

// --- The workspace --------------------------------------------------------

/// An item on "ما يحتاج إلى انتباه": a real count and the exact filtered screen that
/// resolves it. Never a count without a destination.
interface AttentionItem {
  key: string;
  label_ar: string;
  label_en: string;
  count: number;
  tone: 'warn' | 'danger';
  drill: string;
  note: string | null;
}

/// `GET /admin/planets/:id/workspace`
///
/// One request for the whole workspace rather than a dozen from the browser. A page
/// that fires twelve calls renders in twelve stages, and an operator reading a
/// half-drawn screen cannot tell "nothing is wrong" from "that panel never arrived".
/// The content tree and the production board stay separate: they are per-tab reads
/// whose size depends on the planet, and most sessions never open them.
route.get('/planets/:id/workspace', async (c) => {
  const id = pathParam(c, 'id');
  const db = c.env.DB;
  const baseUrl = publicAssetBaseUrl(c.env);

  const planet = await queryFirst<Row>(db, `
    SELECT p.*,
      (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.status <> 'archived') AS series_count,
      (SELECT COUNT(*) FROM asset_links al WHERE al.entity_type = 'planet' AND al.entity_id = p.id) AS assets_count,
      ${artworkLinked('planet', 'p.id', PLANET_ICON_ROLES)} AS h_artwork_icon,
      ${artworkLinked('planet', 'p.id', PLANET_COVER_ROLES)} AS h_artwork_cover,
      ${artworkSelect('icon_asset', 'planet', 'p.id', PLANET_ICON_ROLES)},
      ${artworkSelect('cover_asset', 'planet', 'p.id', PLANET_COVER_ROLES)}
    FROM planets p WHERE p.id = ?
  `, [id]);
  if (!planet) return c.json({ success: false, error: 'Planet not found' }, 404);
  applyArtworkUrl(planet, 'icon_asset', 'icon_url', baseUrl);
  planet.cover_url = null;
  applyArtworkUrl(planet, 'cover_asset', 'cover_url', baseUrl);
  const hasIcon = Boolean(planet.h_artwork_icon);
  const hasCover = Boolean(planet.h_artwork_cover);
  delete planet.h_artwork_icon;
  delete planet.h_artwork_cover;

  // --- content -----------------------------------------------------------
  const content = await readRow(db, `${PLANET_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM ps) AS series_total,
      (SELECT COUNT(*) FROM ps WHERE status = 'published') AS series_published,
      (SELECT COUNT(*) FROM ps WHERE status NOT IN ('published', 'archived')) AS series_pipeline,
      (SELECT COUNT(*) FROM ps WHERE status IN ('draft', 'writing')) AS series_early,
      (SELECT COUNT(*) FROM ps WHERE status IN ('review_edu', 'review_lang', 'review_sharia')) AS series_in_review,
      (SELECT COUNT(*) FROM ps WHERE status IN ('production', 'qa')) AS series_in_production,
      (SELECT COUNT(*) FROM ps WHERE status IN ('ready', 'scheduled')) AS series_ready,
      (SELECT COUNT(*) FROM seasons se WHERE se.series_id IN (SELECT id FROM ps)) AS seasons_total,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived') AS episodes_total,
      (SELECT COUNT(*) FROM pe WHERE is_published = 1) AS episodes_published,
      (SELECT COUNT(*) FROM pe WHERE status = 'ready' AND is_published = 0) AS episodes_ready_unpublished,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived'
         AND (video_master_url IS NULL OR TRIM(video_master_url) = '')) AS episodes_without_video,
      (SELECT COUNT(*) FROM pst WHERE status <> 'archived') AS stories_total,
      (SELECT COUNT(*) FROM pst WHERE status = 'published') AS stories_published,
      (SELECT COUNT(*) FROM pg WHERE status <> 'archived') AS games_total,
      (SELECT COUNT(*) FROM pg WHERE status = 'published') AS games_published,
      (SELECT COUNT(*) FROM books b WHERE b.series_id IN (SELECT id FROM ps) AND b.status <> 'archived') AS books_total,
      (SELECT COUNT(*) FROM projects pj WHERE (pj.series_id IN (SELECT id FROM ps)
          OR pj.episode_id IN (SELECT id FROM pe)) AND pj.status <> 'archived') AS projects_total,
      (SELECT COUNT(*) FROM characters ch WHERE ch.series_id IN (SELECT id FROM ps)
         AND ch.status <> 'archived') AS characters_total,
      (SELECT COUNT(*) FROM series s WHERE s.planet_id = ?1 AND s.content_class = 'test_fixture') AS fixture_series,
      (SELECT COUNT(*) FROM stories WHERE series_id IS NULL) AS unparented_stories,
      (SELECT COUNT(*) FROM games WHERE series_id IS NULL AND episode_id IS NULL) AS unparented_games,
      (SELECT COUNT(*) FROM books WHERE series_id IS NULL) AS unparented_books,
      (SELECT COUNT(*) FROM projects WHERE series_id IS NULL AND episode_id IS NULL) AS unparented_projects,
      (SELECT MAX(stamp) FROM (
         SELECT MAX(updated_at) AS stamp FROM ps
         UNION ALL SELECT MAX(updated_at) FROM pe
       )) AS content_updated_at
  `, [id]);
  const contentGap = content
    ? null
    : 'تعذّرت قراءة جداول المحتوى، فأعداد هذا الكوكب غير معروفة الآن — وليست أصفارًا.';

  // --- media -------------------------------------------------------------
  const planetAssets = await readRows<Row>(db, `
    SELECT al.id AS link_id, al.role, al.language, al.sort_order,
           ca.id AS asset_id, ca.title_ar, ca.kind, ca.status, ca.visibility,
           ca.mime_type, ca.size_bytes, ca.expected_width, ca.expected_height,
           ca.aspect_ratio, ca.updated_at
      FROM asset_links al JOIN content_assets ca ON ca.id = al.asset_id
     WHERE al.entity_type = 'planet' AND al.entity_id = ?
     ORDER BY al.role, al.sort_order
  `, [id]);
  const mediaCounts = await readRow(db, `${PLANET_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM ps) AS series_total,
      (SELECT COUNT(*) FROM ps WHERE NOT ${artworkLinked('series', 'ps.id', SERIES_COVER_ROLES)}) AS series_without_poster,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived') AS episodes_total,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived'
         AND NOT ${artworkLinked('episode', 'pe.id', EPISODE_THUMBNAIL_ROLES)}
         AND (thumbnail_url IS NULL OR TRIM(thumbnail_url) = '')) AS episodes_without_thumbnail
  `, [id]);
  const mediaGap = planetAssets && mediaCounts
    ? null
    : 'تعذّرت قراءة جداول الوسائط، فحصر صور هذا الكوكب غير معروف الآن.';

  // --- localisation ------------------------------------------------------
  //
  // Only signals that exist as columns. `books` has no language column at all, so
  // books are absent rather than reported as 0% translated, and `episodes.dubs` is a
  // declared list, labelled declared rather than delivered.
  const localization = await readRow(db, `${PLANET_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM ps) AS series_total,
      (SELECT COUNT(*) FROM ps WHERE title_en IS NOT NULL AND TRIM(title_en) <> '') AS series_title_en,
      (SELECT COUNT(*) FROM ps WHERE description_en IS NOT NULL AND TRIM(description_en) <> '') AS series_description_en,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived') AS episodes_total,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived' AND dubs LIKE '%"ar"%') AS episodes_dub_ar,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived' AND dubs LIKE '%"en"%') AS episodes_dub_en,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived' AND dubs LIKE '%"fr"%') AS episodes_dub_fr,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived'
         AND captions_ar_url IS NOT NULL AND TRIM(captions_ar_url) <> '') AS episodes_captions_ar,
      (SELECT COUNT(*) FROM story_pages sp WHERE sp.story_id IN (SELECT id FROM pst)) AS story_pages_total,
      (SELECT COUNT(*) FROM story_page_localizations l JOIN story_pages sp ON sp.id = l.page_id
        WHERE sp.story_id IN (SELECT id FROM pst) AND l.language = 'ar'
          AND l.body_text IS NOT NULL AND TRIM(l.body_text) <> '') AS story_text_ar,
      (SELECT COUNT(*) FROM story_page_localizations l JOIN story_pages sp ON sp.id = l.page_id
        WHERE sp.story_id IN (SELECT id FROM pst) AND l.language = 'en'
          AND l.body_text IS NOT NULL AND TRIM(l.body_text) <> '') AS story_text_en,
      (SELECT COUNT(*) FROM story_page_localizations l JOIN story_pages sp ON sp.id = l.page_id
        WHERE sp.story_id IN (SELECT id FROM pst) AND l.language = 'fr'
          AND l.body_text IS NOT NULL AND TRIM(l.body_text) <> '') AS story_text_fr,
      (SELECT COUNT(*) FROM story_page_localizations l JOIN story_pages sp ON sp.id = l.page_id
         JOIN content_assets ca ON ca.id = l.narration_asset_id
        WHERE sp.story_id IN (SELECT id FROM pst) AND l.language = 'ar' AND ca.status = 'ready') AS story_voice_ar,
      (SELECT COUNT(*) FROM story_page_localizations l JOIN story_pages sp ON sp.id = l.page_id
         JOIN content_assets ca ON ca.id = l.narration_asset_id
        WHERE sp.story_id IN (SELECT id FROM pst) AND l.language = 'en' AND ca.status = 'ready') AS story_voice_en,
      (SELECT COUNT(*) FROM story_page_localizations l JOIN story_pages sp ON sp.id = l.page_id
         JOIN content_assets ca ON ca.id = l.narration_asset_id
        WHERE sp.story_id IN (SELECT id FROM pst) AND l.language = 'fr' AND ca.status = 'ready') AS story_voice_fr,
      (SELECT COUNT(*) FROM pg WHERE status <> 'archived') AS games_total,
      (SELECT COUNT(*) FROM game_localizations gl WHERE gl.game_id IN (SELECT id FROM pg)
         AND gl.language = 'ar' AND gl.status IN ('ready', 'published')) AS games_loc_ar,
      (SELECT COUNT(*) FROM game_localizations gl WHERE gl.game_id IN (SELECT id FROM pg)
         AND gl.language = 'en' AND gl.status IN ('ready', 'published')) AS games_loc_en,
      (SELECT COUNT(*) FROM game_localizations gl WHERE gl.game_id IN (SELECT id FROM pg)
         AND gl.language = 'fr' AND gl.status IN ('ready', 'published')) AS games_loc_fr
  `, [id]);
  const localizationGap = localization
    ? null
    : 'تعذّرت قراءة جداول اللغات، فتغطية اللغات غير معروفة الآن.';

  // --- production --------------------------------------------------------
  const production = await readRow(db, `
    SELECT
      (SELECT COUNT(*) ${PLANET_REQUIREMENTS} AND pr.blocker IS NOT NULL AND TRIM(pr.blocker) <> '') AS blocked,
      (SELECT COUNT(*) ${PLANET_REQUIREMENTS} AND pr.due_at IS NOT NULL
         AND ${SQL_DEADLINE_PASSED('pr.due_at')}) AS past_due,
      (SELECT COUNT(*) ${PLANET_REQUIREMENTS} AND pr.assignee_id IS NULL AND pr.team_id IS NULL) AS unowned,
      (SELECT COUNT(DISTINCT pr.content_id) ${PLANET_REQUIREMENTS}) AS tracked_items
  `, [id]);
  const productionItems = await readRows<Row>(db, `
    SELECT pr.content_type, pr.content_id, pr.requirement, pr.blocker, pr.due_at,
           pr.assignee_id, pr.team_id, pr.note,
           COALESCE(e.title_ar, st.title_ar) AS title,
           s.id AS series_id, s.title_ar AS series_title,
           (SELECT display_name FROM admin_users WHERE id = pr.assignee_id) AS assignee_name,
           (SELECT name_ar FROM teams WHERE id = pr.team_id) AS team_name
      ${PLANET_REQUIREMENTS}
        AND ((pr.blocker IS NOT NULL AND TRIM(pr.blocker) <> '')
          OR (pr.due_at IS NOT NULL AND ${SQL_DEADLINE_PASSED('pr.due_at')}))
     ORDER BY pr.due_at IS NULL, pr.due_at
     LIMIT ${LIST_LIMIT}
  `, [id]);
  const productionGap = production
    ? null
    : 'تعذّرت قراءة جدول متطلبات الإنتاج، فأرقام الإنتاج غير معروفة الآن — وليست أصفارًا.';

  // --- learning ----------------------------------------------------------
  const learning = await readRow(db, `${PLANET_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived') AS episodes_total,
      (SELECT COUNT(*) FROM pe WHERE status <> 'archived' AND learning_objective_id IS NOT NULL) AS episodes_with_objective,
      (SELECT COUNT(*) FROM pg WHERE status <> 'archived') AS games_total,
      (SELECT COUNT(*) FROM pg WHERE status <> 'archived' AND learning_objective_id IS NOT NULL) AS games_with_objective,
      (SELECT COUNT(DISTINCT objective) FROM (
         SELECT learning_objective_id AS objective FROM pe WHERE learning_objective_id IS NOT NULL
         UNION SELECT learning_objective_id FROM pg WHERE learning_objective_id IS NOT NULL
       )) AS distinct_objectives,
      (SELECT COUNT(*) FROM learning_objectives) AS objectives_catalogue
  `, [id]);
  const objectiveRows = await readRows<Row>(db, `${PLANET_SCOPE}
    SELECT lo.id, lo.code, lo.title_ar, lo.age_min, lo.age_max,
           sk.id AS skill_id, sk.name_ar AS skill_name, sk.category AS skill_category,
           (SELECT COUNT(*) FROM pe WHERE pe.learning_objective_id = lo.id AND pe.status <> 'archived') AS episodes,
           (SELECT COUNT(*) FROM pg WHERE pg.learning_objective_id = lo.id AND pg.status <> 'archived') AS games
      FROM learning_objectives lo
      LEFT JOIN skills sk ON sk.id = lo.skill_id
     WHERE lo.id IN (SELECT learning_objective_id FROM pe WHERE learning_objective_id IS NOT NULL)
        OR lo.id IN (SELECT learning_objective_id FROM pg WHERE learning_objective_id IS NOT NULL)
     ORDER BY episodes + games DESC, lo.code
     LIMIT ${LIST_LIMIT}
  `, [id]);
  const learningGap = learning
    ? null
    : 'تعذّرت قراءة جداول الأهداف التعليمية، فتغطية التعلّم غير معروفة الآن.';

  // --- reviews and workflow ---------------------------------------------
  const reviews = await readRow(db, `${PLANET_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM content_reviews cr WHERE cr.status = 'pending' AND (${PLANET_REVIEW_SCOPE})) AS pending,
      (SELECT COUNT(*) FROM content_reviews cr WHERE cr.status = 'needs_changes' AND (${PLANET_REVIEW_SCOPE})) AS needs_changes,
      (SELECT COUNT(*) FROM content_reviews cr WHERE cr.status = 'approved' AND (${PLANET_REVIEW_SCOPE})) AS approved,
      (SELECT COUNT(*) FROM content_reviews cr WHERE cr.status = 'rejected' AND (${PLANET_REVIEW_SCOPE})) AS rejected,
      (SELECT COUNT(*) FROM workflow_runs wr WHERE wr.status = 'running'
         AND ((wr.content_type = 'episode' AND wr.content_id IN (SELECT id FROM pe))
           OR (wr.content_type = 'story' AND wr.content_id IN (SELECT id FROM pst))
           OR (wr.content_type = 'series' AND wr.content_id IN (SELECT id FROM ps)))) AS runs_running,
      (SELECT COUNT(*) FROM workflow_run_stages rs JOIN workflow_runs wr ON wr.id = rs.run_id
        WHERE wr.status = 'running' AND rs.due_at IS NOT NULL AND ${SQL_DEADLINE_PASSED('rs.due_at')}
          AND rs.status NOT IN ('approved', 'skipped')
          AND ((wr.content_type = 'episode' AND wr.content_id IN (SELECT id FROM pe))
            OR (wr.content_type = 'story' AND wr.content_id IN (SELECT id FROM pst))
            OR (wr.content_type = 'series' AND wr.content_id IN (SELECT id FROM ps)))) AS stages_overdue,
      (SELECT COUNT(*) FROM ps WHERE source_type IS NOT NULL
         AND (religious_reviewer_id IS NULL OR religious_approved_at IS NULL)) AS religious_pending,
      (SELECT COUNT(*) FROM ps WHERE source_type IS NOT NULL) AS religious_scoped
  `, [id]);
  /// The reviewer is joined to `admin_users` for the same reason the production query
  /// does it: a raw `reviewer_id` names nobody an operator can chase. The join is LEFT
  /// so a review whose reviewer row was removed still lists — losing the row would
  /// hide pending work, which is worse than showing an id.
  const reviewItems = await readRows<Row>(db, `${PLANET_SCOPE}
    SELECT cr.id, cr.entity_type, cr.entity_id, cr.reviewer_role, cr.reviewer_id,
           au.display_name AS reviewer_name,
           cr.status, cr.created_at, cr.comments,
           COALESCE((SELECT title_ar FROM series WHERE id = cr.entity_id),
                    (SELECT title_ar FROM episodes WHERE id = cr.entity_id)) AS title
      FROM content_reviews cr
      LEFT JOIN admin_users au ON au.id = cr.reviewer_id
     WHERE cr.status IN ('pending', 'needs_changes') AND (${PLANET_REVIEW_SCOPE})
     ORDER BY cr.created_at DESC
     LIMIT ${LIST_LIMIT}
  `, [id]);
  const reviewsGap = reviews
    ? null
    : 'تعذّرت قراءة جداول المراجعة وسير العمل، فأرقامها غير معروفة الآن — وليست أصفارًا.';

  // --- rights and availability ------------------------------------------
  const ownPolicy = await readRow(db, `
    SELECT entity_type, entity_id, mode, countries, languages, platforms,
           starts_at, ends_at, reason, note, updated_at
      FROM content_availability WHERE entity_type = 'planet' AND entity_id = ?
  `, [id]);
  const globalPolicy = await readRow(db, `
    SELECT mode, reason, note FROM content_availability WHERE entity_type = 'global'
  `);
  const availability = await readRow(db, `${PLANET_SCOPE}
    SELECT
      (SELECT COUNT(*) FROM content_availability ca WHERE ca.entity_type = 'series'
         AND ca.entity_id IN (SELECT id FROM ps)) AS series_overrides,
      (SELECT COUNT(*) FROM content_availability ca WHERE ca.entity_type = 'episode'
         AND ca.entity_id IN (SELECT id FROM pe)) AS episode_overrides,
      (SELECT COUNT(*) FROM content_availability ca WHERE ca.mode = 'unavailable'
         AND ((ca.entity_type = 'series' AND ca.entity_id IN (SELECT id FROM ps))
           OR (ca.entity_type = 'episode' AND ca.entity_id IN (SELECT id FROM pe)))) AS withheld,
      (SELECT COUNT(*) FROM content_availability ca WHERE ca.mode IN ('selected_only', 'worldwide_except')
         AND ((ca.entity_type = 'series' AND ca.entity_id IN (SELECT id FROM ps))
           OR (ca.entity_type = 'episode' AND ca.entity_id IN (SELECT id FROM pe)))) AS restricted
  `, [id]);
  const licences = await readRows<Row>(db, `${PLANET_SCOPE}
    SELECT rl.id, rl.content_id, rl.owner, rl.license_type, rl.countries, rl.languages,
           rl.expiry_date,
           COALESCE((SELECT title_ar FROM series WHERE id = rl.content_id),
                    (SELECT title_ar FROM episodes WHERE id = rl.content_id)) AS title
      FROM rights_licenses rl
     WHERE rl.content_id IN (SELECT id FROM ps) OR rl.content_id IN (SELECT id FROM pe)
     ORDER BY rl.expiry_date IS NULL, rl.expiry_date
     LIMIT ${LIST_LIMIT}
  `, [id]);
  const rightsGap = availability
    ? null
    : 'تعذّرت قراءة جداول الإتاحة، فحالة الإتاحة غير معروفة الآن.';

  // --- audit -------------------------------------------------------------
  const activity = await readRows<Row>(db, `${PLANET_SCOPE}
    SELECT al.id, al.actor_id, al.action, al.entity_type, al.entity_id, al.created_at,
           COALESCE((SELECT title_ar FROM series WHERE id = al.entity_id),
                    (SELECT title_ar FROM episodes WHERE id = al.entity_id),
                    (SELECT name_ar FROM planets WHERE id = al.entity_id)) AS title,
           (SELECT display_name FROM admin_users WHERE id = al.actor_id) AS actor_name
      FROM audit_logs al
     WHERE (al.entity_type = 'planet' AND al.entity_id = ?1)
        OR (al.entity_type = 'series' AND al.entity_id IN (SELECT id FROM ps))
        OR (al.entity_type = 'episode' AND al.entity_id IN (SELECT id FROM pe))
     ORDER BY al.created_at DESC
     LIMIT ${ACTIVITY_LIMIT}
  `, [id]);

  // --- language coverage, assembled with its denominators ----------------
  /// Where an operator goes to close a gap in this signal. Naming the deficit without
  /// offering the work that resolves it turns the matrix into a scoreboard, so every
  /// signal that can be acted on carries a destination.
  ///
  /// The destination is the screen that *owns* the field, not a filtered list of the
  /// exact missing rows: no list endpoint accepts "missing dub for language X" as a
  /// filter, and inventing a query string the target screen ignores would land the
  /// operator on an unfiltered list while implying it was filtered.
  const drillFor = (signalKey: string, language: Language): string | null => {
    if (language === 'fr' && signalKey === 'series_metadata') return null;
    if (language === 'ar' && signalKey === 'series_metadata') return null;
    switch (signalKey) {
      case 'series_metadata': return `/series?planet=${encodeURIComponent(id)}`;
      case 'episode_dubs': return `/translation?planet=${encodeURIComponent(id)}&language=${language}`;
      case 'story_text':
      case 'story_narration': return `/stories?planet=${encodeURIComponent(id)}`;
      case 'game_localizations': return `/games-ops?planet=${encodeURIComponent(id)}`;
      default: return null;
    }
  };

  const languages = LANGUAGES.map((language: Language) => {
    const series = num(localization, 'series_total');
    const episodes = num(localization, 'episodes_total');
    const storyPages = num(localization, 'story_pages_total');
    const games = num(localization, 'games_total');
    const signals = [
      {
        key: 'series_metadata',
        label_ar: 'عنوان السلسلة',
        done: language === 'ar' ? series : language === 'en' ? num(localization, 'series_title_en') : 0,
        total: series,
        unavailable: language === 'fr'
          ? 'لا عمود عنوان فرنسي في جدول السلاسل (title_ar و title_en فقط)، فلا قياس ممكن.'
          : null,
        note: language === 'ar'
          ? 'العنوان العربي حقل إلزامي في المخطوطة (NOT NULL)، فالتغطية كاملة بحكم القيد لا بحكم عمل تحريري.'
          : null,
      },
      {
        key: 'episode_dubs',
        label_ar: 'الصوت المُعلَن للحلقة',
        done: num(localization, `episodes_dub_${language}`),
        total: episodes,
        unavailable: null,
        note: 'العمود episodes.dubs قائمة مُعلَنة لا إثبات وجود ملف صوت؛ الملفات تُقاس في مركز الإنتاج.',
      },
      {
        key: 'story_text',
        label_ar: 'نصّ صفحات القصص',
        done: num(localization, `story_text_${language}`),
        total: storyPages,
        unavailable: null,
        note: null,
      },
      {
        key: 'story_narration',
        label_ar: 'سرد صفحات القصص',
        done: num(localization, `story_voice_${language}`),
        total: storyPages,
        unavailable: null,
        note: 'يُحتسب السرد الجاهز فقط (content_assets.status = ready).',
      },
      {
        key: 'game_localizations',
        label_ar: 'ترجمة الألعاب',
        done: num(localization, `games_loc_${language}`),
        total: games,
        unavailable: null,
        note: 'تُحتسب صفوف game_localizations بحالة ready أو published.',
      },
    ];
    return {
      language,
      /// The drill is attached only when the signal is both measurable and actually
      /// incomplete. A complete signal has no work to open, and an unmeasurable one
      /// would send the operator to a screen that cannot show the deficit.
      signals: signals.map((signal) => ({
        ...signal,
        drill: signal.unavailable === null && signal.total > 0 && signal.done < signal.total
          ? drillFor(signal.key, language)
          : null,
      })),
    };
  });

  // --- what needs attention ---------------------------------------------
  const attention: AttentionItem[] = [];
  const push = (item: AttentionItem) => { if (item.count > 0) attention.push(item); };
  const planetPath = `/planets/${encodeURIComponent(id)}`;

  if (!hasIcon || !hasCover) {
    attention.push({
      key: 'planet_artwork',
      label_ar: !hasIcon && !hasCover ? 'الكوكب بلا أيقونة ولا غلاف'
        : !hasIcon ? 'الكوكب بلا أيقونة' : 'الكوكب بلا غلاف',
      label_en: 'Planet artwork incomplete',
      count: (hasIcon ? 0 : 1) + (hasCover ? 0 : 1),
      tone: 'warn',
      drill: `${planetPath}?tab=media`,
      note: 'الأدوار المتوقّعة للكوكب: icon، وcover أو banner (lib/assetUrls.ts).',
    });
  }
  if (!text(planet.description_ar)) {
    attention.push({
      key: 'planet_description',
      label_ar: 'الكوكب بلا وصف',
      label_en: 'Planet has no description',
      count: 1,
      tone: 'warn',
      drill: `${planetPath}?tab=overview`,
      note: null,
    });
  }
  push({
    key: 'series_without_poster',
    label_ar: 'سلاسل بلا ملصق',
    label_en: 'Series without a poster',
    count: num(mediaCounts, 'series_without_poster'),
    tone: 'warn',
    drill: `${planetPath}?tab=media`,
    note: 'الملصق يُقرأ من asset_links بدور poster أو cover.',
  });
  push({
    key: 'episodes_without_thumbnail',
    label_ar: 'حلقات بلا صورة مصغّرة',
    label_en: 'Episodes without a thumbnail',
    count: num(mediaCounts, 'episodes_without_thumbnail'),
    tone: 'warn',
    drill: `${planetPath}?tab=media`,
    note: null,
  });
  push({
    key: 'production_blocked',
    label_ar: 'متطلبات إنتاج بعائق مُعلَن',
    label_en: 'Production requirements with a blocker',
    count: num(production, 'blocked'),
    tone: 'danger',
    drill: `${planetPath}?tab=production`,
    note: null,
  });
  push({
    key: 'production_past_due',
    label_ar: 'متطلبات مضى موعدها',
    label_en: 'Requirements past their due date',
    count: num(production, 'past_due'),
    tone: 'warn',
    drill: `${planetPath}?tab=production`,
    note: 'لا حالة إنجاز مخزَّنة في جدول المتطلبات، فهذا يعني «مضى الموعد» لا «مضى ولم يُنجَز».',
  });
  push({
    key: 'reviews_needs_changes',
    label_ar: 'مراجعات طُلبت فيها تعديلات',
    label_en: 'Reviews requesting changes',
    count: num(reviews, 'needs_changes'),
    tone: 'danger',
    drill: `${planetPath}?tab=reviews`,
    note: null,
  });
  push({
    key: 'reviews_pending',
    label_ar: 'مراجعات معلّقة',
    label_en: 'Pending reviews',
    count: num(reviews, 'pending'),
    tone: 'warn',
    drill: `${planetPath}?tab=reviews`,
    note: null,
  });
  push({
    key: 'religious_pending',
    label_ar: 'سلاسل بمصدر شرعي بلا اعتماد',
    label_en: 'Series with a religious source and no approval',
    count: num(reviews, 'religious_pending'),
    tone: 'danger',
    drill: `${planetPath}?tab=reviews`,
    note: 'بوابة النشر تمنع نشرها أصلًا (lib/islamicContent.ts).',
  });
  push({
    key: 'stages_overdue',
    label_ar: 'مراحل سير عمل مضى موعدها',
    label_en: 'Workflow stages past due',
    count: num(reviews, 'stages_overdue'),
    tone: 'warn',
    drill: '/workflows',
    note: null,
  });
  push({
    key: 'episodes_ready_unpublished',
    label_ar: 'حلقات جاهزة ولم تُنشر',
    label_en: 'Episodes ready but not published',
    count: num(content, 'episodes_ready_unpublished'),
    tone: 'warn',
    drill: '/episodes?status=ready',
    note: 'قائمة الحلقات تفلتر الحالة وحدها؛ هذا العدّاد يشترط is_published = 0 أيضًا.',
  });
  push({
    key: 'episodes_without_video',
    label_ar: 'حلقات بلا فيديو أصلي',
    label_en: 'Episodes without a master video',
    count: num(content, 'episodes_without_video'),
    tone: 'warn',
    drill: `${planetPath}?tab=production`,
    note: null,
  });
  push({
    key: 'episodes_without_objective',
    label_ar: 'حلقات بلا هدف تعليمي',
    label_en: 'Episodes with no learning objective',
    count: Math.max(0, num(learning, 'episodes_total') - num(learning, 'episodes_with_objective')),
    tone: 'warn',
    drill: `${planetPath}?tab=learning`,
    note: null,
  });

  const today = new Date().toISOString().slice(0, 10);
  const expiredLicences = (licences ?? []).filter((row) => {
    const expiry = typeof row.expiry_date === 'string' ? row.expiry_date.slice(0, 10) : '';
    return expiry !== '' && expiry < today;
  });
  /// A right that expires inside the window is not yet a failure but it is the last
  /// moment a renewal can be negotiated calmly, so it earns its own bucket rather
  /// than being folded into "expired" — by then the content is already unlicensed.
  const soonCutoff = new Date(Date.now() + RIGHTS_EXPIRY_WINDOW_DAYS * 86_400_000)
    .toISOString().slice(0, 10);
  const expiringLicences = (licences ?? []).filter((row) => {
    const expiry = typeof row.expiry_date === 'string' ? row.expiry_date.slice(0, 10) : '';
    return expiry !== '' && expiry >= today && expiry <= soonCutoff;
  });
  push({
    key: 'rights_expired',
    label_ar: 'اتفاقيات حقوق منتهية على محتوى هذا الكوكب',
    label_en: 'Expired rights agreements on this planet',
    count: expiredLicences.length,
    tone: 'danger',
    drill: '/rights',
    note: 'rights_licenses.content_id بلا عمود نوع، فالمطابقة بالمعرّف وحده.',
  });
  push({
    key: 'rights_expiring',
    label_ar: `اتفاقيات حقوق تنتهي خلال ${RIGHTS_EXPIRY_WINDOW_DAYS} يومًا`,
    label_en: `Rights agreements expiring within ${RIGHTS_EXPIRY_WINDOW_DAYS} days`,
    count: expiringLicences.length,
    tone: 'warn',
    drill: `${planetPath}?tab=rights`,
    note: null,
  });

  return c.json({
    success: true,
    data: {
      planet: { ...planet, is_active: Boolean(planet.is_active), artwork_icon: hasIcon, artwork_cover: hasCover },
      content: { ...(content ?? {}), unavailable: contentGap },
      media: {
        assets: planetAssets ?? [],
        series_total: num(mediaCounts, 'series_total'),
        series_without_poster: num(mediaCounts, 'series_without_poster'),
        episodes_total: num(mediaCounts, 'episodes_total'),
        episodes_without_thumbnail: num(mediaCounts, 'episodes_without_thumbnail'),
        expected_roles: { icon: [...PLANET_ICON_ROLES], cover: [...PLANET_COVER_ROLES] },
        cdn_configured: !!baseUrl,
        unavailable: mediaGap,
      },
      localization: {
        languages,
        configured: [...LANGUAGES],
        unavailable: localizationGap,
        notes: [
          'مجموعة اللغات من قيد game_localizations ومتطلبات مركز الإنتاج، لا من جدول لغات — لا يوجد جدول لغات.',
          'الكتب بلا عمود لغة في المخطوطة، فلا تظهر هنا بدل أن تُحتسب صفرًا.',
        ],
      },
      production: {
        ...(production ?? {}),
        items: productionItems ?? [],
        unavailable: productionGap,
        notes: [
          'لا نسبة اكتمال على مستوى الكوكب: الاكتمال يُشتقّ لكل عنصر على حدة في'
          + ' lib/productionMatrix.ts، ومركز الإنتاج هو من يحسبه لكل حلقة أو قصة.',
        ],
      },
      learning: {
        ...(learning ?? {}),
        objectives: objectiveRows ?? [],
        unavailable: learningGap,
        notes: [
          'لا ربط بين الكوكب ومنهج أهداف، فلا تُعرض «نسبة تغطية المنهج»؛ المعروض هو الأهداف'
          + ' المرتبطة فعلًا بحلقات وألعاب هذا الكوكب.',
          'projects.learning_objective_ids حقل JSON غير قابل للربط في SQL، فالمشروعات خارج هذا القياس.',
        ],
      },
      reviews: {
        ...(reviews ?? {}),
        items: reviewItems ?? [],
        unavailable: reviewsGap,
        notes: [
          'قيد content_reviews لا يقبل النوع story، فالقصص لا تحمل صفّ مراجعة — وغيابها ليس تقصيرًا.',
        ],
      },
      rights: {
        own_policy: ownPolicy ?? null,
        inherits_from: ownPolicy ? null : 'global',
        global_policy: globalPolicy ?? null,
        chain: availabilityChainScopes('episode'),
        ...(availability ?? {}),
        licences: licences ?? [],
        expired_licences: expiredLicences.length,
        unavailable: rightsGap,
        notes: [
          'الإتاحة لا تتقاطع: أقرب صفّ في السلسلة (حلقة ← موسم ← سلسلة ← كوكب ← عام) يفوز'
          + ' كاملًا، فوجود تجاوز على سلسلة يعني أن سياسة الكوكب لا تُطبَّق عليها.',
          'rights_licenses بلا عمود entity_type، فربط الاتفاقية بمحتوى هذا الكوكب يعتمد على'
          + ' مطابقة content_id بمعرّفات سلاسله وحلقاته.',
          'جدول content_rights لا يكتبه أي مسار إداري، فلا يُقرأ هنا حتى لا يُعرض صفر أبديّ.',
        ],
      },
      analytics: {
        unavailable: 'لا مقاييس مشاهدة أو تشغيل لكوكب في D1: جداول watch_progress و attempts و mastery'
          + ' بلا كاتب (حالة الطفل في FamilyState Durable Object)، و processed_family_events لا يحمل'
          + ' معرّف محتوى، فلا يمكن نسبة أي نشاط إلى كوكب. أي رقم هنا سيكون مُختلقًا.',
        source: 'FamilyState (سلطة نشاط الطفل) — لا إسقاط لكوكب في D1',
      },
      attention,
      activity: activity ?? [],
      generated_at: new Date().toISOString(),
    },
  });
});

// --- The content tree -----------------------------------------------------

/// `GET /admin/planets/:id/tree`
///
/// Planet → series → season → episode in three statements, assembled on the worker.
/// Kept out of the workspace payload because a planet with four hundred episodes
/// would enlarge the response for every reader who never opens the content tab.
route.get('/planets/:id/tree', async (c) => {
  const id = pathParam(c, 'id');
  const db = c.env.DB;
  const baseUrl = publicAssetBaseUrl(c.env);

  const exists = await queryFirst<Row>(db, 'SELECT id FROM planets WHERE id = ?', [id]);
  if (!exists) return c.json({ success: false, error: 'Planet not found' }, 404);

  const series = await queryAll<Row>(db, `
    SELECT s.id, s.title_ar, s.title_en, s.slug, s.status, s.type, s.age_min, s.age_max,
           s.sort_order, s.updated_at, s.content_class, s.cover_url,
      (SELECT COUNT(*) FROM seasons se WHERE se.series_id = s.id) AS seasons_count,
      (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.status <> 'archived') AS episodes_count,
      (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.is_published = 1) AS episodes_published,
      (SELECT GROUP_CONCAT(track_id) FROM series_tracks WHERE series_id = s.id) AS track_ids,
      ${artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES)}
    FROM series s
   WHERE s.planet_id = ? AND s.status <> 'archived'
   ORDER BY s.sort_order ASC, s.updated_at DESC
   LIMIT ${TREE_SERIES_LIMIT}
  `, [id]);
  for (const row of series) applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl);

  const seasons = await queryAll<Row>(db, `
    SELECT se.id, se.series_id, se.season_number, se.title_ar, se.theme_ar, se.status,
           se.release_date,
      (SELECT COUNT(*) FROM episodes e WHERE e.season_id = se.id AND e.status <> 'archived') AS episodes_count
      FROM seasons se
     WHERE se.series_id IN (SELECT id FROM series WHERE planet_id = ? AND status <> 'archived')
     ORDER BY se.series_id, se.season_number
  `, [id]);

  const episodeTotal = await queryFirst<{ total: number }>(db, `
    SELECT COUNT(*) AS total FROM episodes e
     WHERE e.series_id IN (SELECT id FROM series WHERE planet_id = ? AND status <> 'archived')
       AND e.status <> 'archived'
  `, [id]);

  const episodes = await queryAll<Row>(db, `
    SELECT e.id, e.series_id, e.season_id, e.episode_number, e.title_ar, e.status,
           e.is_published, e.updated_at, e.duration_seconds, e.learning_objective_id, e.dubs,
           CASE WHEN e.video_master_url IS NOT NULL AND TRIM(e.video_master_url) <> '' THEN 1 ELSE 0 END AS has_video,
           CASE WHEN e.captions_ar_url IS NOT NULL AND TRIM(e.captions_ar_url) <> '' THEN 1 ELSE 0 END AS has_captions,
           ${artworkLinked('episode', 'e.id', EPISODE_THUMBNAIL_ROLES)} AS thumbnail_asset,
           e.thumbnail_url
      FROM episodes e
     WHERE e.series_id IN (SELECT id FROM series WHERE planet_id = ? AND status <> 'archived')
       AND e.status <> 'archived'
     ORDER BY e.series_id, e.episode_number IS NULL, e.episode_number
     LIMIT ${TREE_EPISODE_LIMIT}
  `, [id]);

  const bySeries = new Map<string, Row[]>();
  for (const episode of episodes) {
    const key = String(episode.series_id);
    const normalized: Row = {
      ...episode,
      is_published: Boolean(episode.is_published),
      has_video: Boolean(episode.has_video),
      has_captions: Boolean(episode.has_captions),
      has_thumbnail: Boolean(episode.thumbnail_asset) || !!text(episode.thumbnail_url),
    };
    delete normalized.thumbnail_asset;
    bySeries.set(key, [...(bySeries.get(key) ?? []), normalized]);
  }

  const tree = series.map((row) => {
    const ownEpisodes = bySeries.get(String(row.id)) ?? [];
    return {
      ...row,
      track_ids: typeof row.track_ids === 'string' && row.track_ids ? String(row.track_ids).split(',') : [],
      seasons: seasons.filter((season) => season.series_id === row.id).map((season) => ({
        ...season,
        episodes: ownEpisodes.filter((episode) => episode.season_id === season.id),
      })),
      /// Episodes attached to no season are not hidden: they are the ones an operator
      /// most often needs to find.
      unassigned_episodes: ownEpisodes.filter((episode) => !episode.season_id),
      loaded_episodes: ownEpisodes.length,
    };
  });

  // The tree deliberately includes supplied test material, unlike every health
  // counter. Hiding it would make the workspace claim a planet has no such series
  // while the row is right there in the series list; counting it silently would make
  // the tree disagree with the header. So it is returned, counted separately, and
  // labelled — `content_class` is on every series row for exactly this.
  const fixtureSeries = series.filter((row) => row.content_class === 'test_fixture').length;

  return c.json({
    success: true,
    data: tree,
    meta: {
      series_limit: TREE_SERIES_LIMIT,
      episode_limit: TREE_EPISODE_LIMIT,
      series_returned: series.length,
      fixture_series: fixtureSeries,
      episodes_returned: episodes.length,
      episodes_total: Number(episodeTotal?.total ?? 0),
      truncated: series.length >= TREE_SERIES_LIMIT || episodes.length >= TREE_EPISODE_LIMIT,
      notes: fixtureSeries > 0
        ? ['الشجرة تعرض محتوى الاختبار (content_class = test_fixture) مع تمييزه، بينما'
          + ' مؤشّرات مساحة العمل تستثنيه — فالفرق بين العددين مقصود ومُعلَن.']
        : [],
    },
  });
});

// --- Single planet (the cheap read) ---------------------------------------

/// `GET /admin/planets/:id` — the flat detail the drill-down used before the
/// workspace existed. Kept because the workspace aggregate is a dozen statements and
/// a caller that only needs the row and its series should not pay for them.
route.get('/planets/:id', async (c) => {
  const id = pathParam(c, 'id');
  const baseUrl = publicAssetBaseUrl(c.env);
  const row = await queryFirst<Row>(c.env.DB, `
    SELECT p.*,
      (SELECT COUNT(*) FROM series s WHERE s.planet_id = p.id AND s.status <> 'archived') AS series_count,
      (SELECT COUNT(*) FROM asset_links al WHERE al.entity_type = 'planet' AND al.entity_id = p.id) AS assets_count,
      ${artworkSelect('icon_asset', 'planet', 'p.id', PLANET_ICON_ROLES)},
      ${artworkSelect('cover_asset', 'planet', 'p.id', PLANET_COVER_ROLES)}
    FROM planets p WHERE p.id = ?
  `, [id]);
  if (!row) return c.json({ success: false, error: 'Planet not found' }, 404);
  applyArtworkUrl(row, 'icon_asset', 'icon_url', baseUrl);
  row.cover_url = null;
  applyArtworkUrl(row, 'cover_asset', 'cover_url', baseUrl);

  const series = await queryAll<Row>(c.env.DB, `
    SELECT s.id, s.title_ar, s.title_en, s.slug, s.type, s.age_min, s.age_max, s.status,
           s.cover_url, s.sort_order,
      (SELECT GROUP_CONCAT(track_id) FROM series_tracks WHERE series_id = s.id) AS track_ids,
      (SELECT COUNT(*) FROM episodes WHERE series_id = s.id AND status <> 'archived') AS episodes_count,
      ${artworkSelect('cover_asset', 'series', 's.id', SERIES_COVER_ROLES)}
    FROM series s WHERE s.planet_id = ? AND s.status <> 'archived'
    ORDER BY s.sort_order ASC, s.updated_at DESC
  `, [id]);
  for (const item of series) applyArtworkUrl(item, 'cover_asset', 'cover_url', baseUrl);

  const categories = await queryAll<Row>(c.env.DB, `
    SELECT c.id, c.name_ar, c.name_en, c.color_hex,
      (SELECT COUNT(*) FROM series_categories sc JOIN series s ON s.id = sc.series_id
        WHERE sc.category_id = c.id AND s.planet_id = ? AND s.status <> 'archived') AS series_count
    FROM categories c WHERE c.is_active = 1 ORDER BY c.sort_order
  `, [id]);

  return c.json({
    success: true,
    data: {
      ...row,
      is_active: Boolean(row.is_active),
      // Tracks arrive as a GROUP_CONCAT string; the dashboard types the field as an
      // array and maps over it, so it is split here rather than in the browser.
      series: series.map((item) => ({
        ...item,
        track_ids: typeof item.track_ids === 'string' && item.track_ids
          ? String(item.track_ids).split(',')
          : [],
      })),
      categories: categories.filter((item) => Number(item.series_count) > 0),
    },
  });
});

// --- Writes ---------------------------------------------------------------

route.post('/planets', requirePermission('create'), async (c) => {
  const value = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return c.json({ success: false, error: 'A JSON object is required' }, 400);
  }
  const nameAr = text(value.name_ar);
  if (!nameAr) return c.json({ success: false, error: 'name_ar is required' }, 400);
  const color = text(value.color_hex) ?? '#4ECDC4';
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return c.json({ success: false, error: 'color_hex must be a six-digit hex color' }, 400);
  }
  const id = text(value.id) ?? slugify(text(value.name_en) ?? nameAr, 'planet');

  try {
    await c.env.DB.batch([
      c.env.DB.prepare(`
        INSERT INTO planets (id, name_ar, name_en, description_ar, color_hex, icon_url, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, nameAr, nullableText(value.name_en) ?? null, nullableText(value.description_ar) ?? null,
        color, nullableText(value.icon_url) ?? null, integer(value.sort_order) ?? 0,
        value.is_active === undefined ? 1 : boolInt(value.is_active),
      ),
      audit(c.env.DB, c as never, 'create', id, value),
    ]);
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Planet id already exists' }, 409);
    throw error;
  }
  return c.json({ success: true, data: { id } }, 201);
});

route.patch('/planets/:id', requirePermission('edit_metadata'), async (c) => {
  const value = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return c.json({ success: false, error: 'A JSON object is required' }, 400);
  }
  const id = pathParam(c, 'id');
  if (!await queryFirst(c.env.DB, 'SELECT id FROM planets WHERE id = ?', [id])) {
    return c.json({ success: false, error: 'Planet not found' }, 404);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (field: string, fieldValue: unknown) => { sets.push(`${field} = ?`); params.push(fieldValue); };

  for (const field of ['name_ar', 'name_en', 'description_ar', 'icon_url']) {
    if (value[field] === undefined) continue;
    const parsed = field === 'name_ar' ? text(value[field]) : nullableText(value[field]);
    if (parsed === undefined || (field === 'name_ar' && !parsed)) {
      return c.json({ success: false, error: `Invalid ${field}` }, 400);
    }
    add(field, parsed);
  }
  if (value.color_hex !== undefined) {
    const color = text(value.color_hex);
    if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return c.json({ success: false, error: 'Invalid color_hex' }, 400);
    add('color_hex', color);
  }
  if (value.sort_order !== undefined) {
    const order = integer(value.sort_order);
    if (order === null) return c.json({ success: false, error: 'sort_order must be an integer' }, 400);
    add('sort_order', order);
  }
  if (value.is_active !== undefined) add('is_active', boolInt(value.is_active));
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400);

  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE planets SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
    audit(c.env.DB, c as never, 'update', id, value),
  ]);
  return c.json({ success: true, data: { id, updated: true } });
});

/// `DELETE /admin/planets/:id` — disables the planet, and states what that hides.
///
/// `series.planet_id` is `ON DELETE RESTRICT`, so a hard delete was never possible
/// and this route has always been a soft archive (`is_active = 0`). What it did not
/// do was tell the operator the consequence: a planet carrying published series
/// disappears from every new selection while its content stays live. So the
/// dependency counts are returned, and a planet that still has content requires an
/// explicit `?force=1` — the confirmation is enforced by the server, not by a
/// `window.confirm` in one client.
route.delete('/planets/:id', requirePermission('archive'), async (c) => {
  const id = pathParam(c, 'id');
  if (!await queryFirst(c.env.DB, 'SELECT id FROM planets WHERE id = ?', [id])) {
    return c.json({ success: false, error: 'Planet not found' }, 404);
  }

  const dependencies = await queryFirst<Record<string, number>>(c.env.DB, `
    SELECT
      (SELECT COUNT(*) FROM series WHERE planet_id = ?1 AND status <> 'archived') AS series,
      (SELECT COUNT(*) FROM series WHERE planet_id = ?1 AND status = 'published') AS published_series,
      (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
        WHERE s.planet_id = ?1 AND e.status <> 'archived') AS episodes,
      (SELECT COUNT(*) FROM episodes e JOIN series s ON s.id = e.series_id
        WHERE s.planet_id = ?1 AND e.is_published = 1) AS published_episodes
  `, [id]);

  const impact = {
    series: Number(dependencies?.series ?? 0),
    published_series: Number(dependencies?.published_series ?? 0),
    episodes: Number(dependencies?.episodes ?? 0),
    published_episodes: Number(dependencies?.published_episodes ?? 0),
  };

  if (impact.series > 0 && c.req.query('force') !== '1') {
    return c.json({
      success: false,
      error: 'هذا الكوكب يحمل محتوى. التعطيل يخفيه من كل اختيار جديد ولا يحذف بياناته،'
        + ' ولا يوقف نشر ما هو منشور. أعِد الطلب مع force=1 للتأكيد.',
      data: { id, requires_confirmation: true, impact },
    }, 409);
  }

  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE planets SET is_active = 0 WHERE id = ?').bind(id),
    audit(c.env.DB, c as never, 'archive', id, { impact, forced: c.req.query('force') === '1' }),
  ]);
  return c.json({ success: true, data: { id, is_active: false, impact } });
});

export default route;
