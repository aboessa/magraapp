/// The publish gate's HTTP and database layer.
///
/// `lib/publishGate.ts` holds the rules and touches nothing; this file gathers the
/// rows those rules need and exposes two things:
///
///  * `GET /admin/publish-readiness/:type/:id` — the whole checklist, so an editor
///    can see every blocker *before* pressing publish rather than discovering them
///    one refusal at a time.
///  * [assertPublishable], used by the publish operations themselves, so the
///    checklist is not advisory. A gate that only the UI consults is not a gate:
///    the API is reachable with curl, and the scheduler does not open the UI.
///
/// ## Why gathering is one query set per type rather than a generic loader
///
/// The facts differ per type — an episode's readiness depends on its video file and
/// its parent series' status, a story's on its pages' illustrations and
/// localisations. A generic loader would fetch the union of all of it for every
/// type, and the checks would then have to guess which absent value means "not
/// applicable" and which means "missing". Guessing wrong in that direction
/// produces a false pass, which is the one failure mode this whole gate exists to
/// prevent.
///
/// ## Inheritance
///
/// Rights and the test-fixture class live on ancestors. `series.content_class` is
/// the single source for the fixture flag (`lib/contentClass.ts`), so an episode,
/// story, book or game resolves it through its series. `content_rights` rows are
/// read for the entity *and* for its series, with the inherited ones marked, so an
/// expired series licence blocks its episodes too — which is what a licence
/// actually means.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { requireAdmin } from '../lib/adminAuth.ts';
import { parseJson } from '../lib/catalogueValidation.ts';
import { seasonEpisodeCounts, seasonEpisodeCountSelect } from '../lib/episodeCounts.ts';
import {
  evaluatePublishGate,
  isPublishableType,
  type LinkedAssetFact,
  type PublishGateFacts,
  type PublishGateResult,
  type PublishableType,
  type ReviewFact,
  type RightsFact,
  type StoryPageFacts,
} from '../lib/publishGate.ts';
import { gameReadinessFor, loadGameRow } from './adminGames.ts';
import { workflowFor } from './adminWorkflow.ts';
import { workflowPublishBlockers } from '../lib/workflowEngine.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// `content_reviews.entity_type` and `content_rights.entity_type` share this CHECK
/// list. Stories are absent from both, which is a schema fact the gate reports
/// rather than hides.
const REVIEWABLE: PublishableType[] = ['series', 'episode', 'story', 'book', 'game', 'project'];

const today = () => new Date().toISOString().slice(0, 10);

/// صفحات كيانٍ من `story_pages` مع حالة رسمها وكل توطيناتها.
///
/// ## لماذا صارت دالّةً مشتركة (`API-107`)
///
/// كانت هذه القراءة داخل فرع القصص وحده، وفرعُ الكتب يقرأ **العمود القديم**
/// `books.pages` — نصَّ JSON. والمقيس: العمود `'[]'` في كل الكتب الاثنين
/// والعشرين، ولا شيء في مسار القراءة العامّ يقرأه (`books.ts` يقول ذلك صريحًا:
/// «legacy JSON blob … deliberately not selected»)، وصفحاتُ الكتب الحقيقية في
/// `story_pages` بمفتاح `story_id = book.id`.
///
/// فكانت البوابة تحكم على مصدرٍ خطأ في الاتجاهين: تحجب كتابًا **له صفحات
/// حقيقية**، وتُجيز كتابًا كُتب في عموده مصفوفةٌ و**لا صفحة له**.
///
/// واستعلامان لا واحدٌ لكل صفحة: كتابٌ من أربعين صفحة كان سيكلّف أربعين رحلة
/// لجوابٍ واحد.
async function loadPageFacts(db: D1Database, entityId: string): Promise<StoryPageFacts[]> {
  const pages = await queryAll<{
    id: string; page_number: number | null; image_asset_id: string | null; image_status: string | null;
  }>(db, `
    SELECT p.id, p.page_number, p.image_asset_id, ca.status AS image_status
      FROM story_pages p LEFT JOIN content_assets ca ON ca.id = p.image_asset_id
     WHERE p.story_id = ?
     ORDER BY p.page_number
  `, [entityId]);

  const localizations = pages.length
    ? await queryAll<{
        page_id: string; language: string; body_text: string | null;
        narration_asset_id: string | null; narration_status: string | null;
      }>(db, `
        SELECT l.page_id, l.language, l.body_text, l.narration_asset_id, ca.status AS narration_status
          FROM story_page_localizations l
          LEFT JOIN content_assets ca ON ca.id = l.narration_asset_id
         WHERE l.page_id IN (${pages.map(() => '?').join(', ')})
      `, pages.map((page) => page.id))
    : [];

  return pages.map((page) => ({
    page_number: page.page_number,
    image_asset_id: page.image_asset_id,
    image_status: page.image_status,
    localizations: localizations
      .filter((entry) => entry.page_id === page.id)
      .map((entry) => ({
        language: entry.language,
        body_text: entry.body_text,
        narration_asset_id: entry.narration_asset_id,
        narration_status: entry.narration_status,
      })),
  }));
}

function stringArray(raw: unknown): string[] {
  const parsed = typeof raw === 'string' ? parseJson(raw, []) : raw;
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
}

async function loadReviews(db: D1Database, type: PublishableType, id: string): Promise<ReviewFact[]> {
  if (!REVIEWABLE.includes(type)) return [];
  const rows = await queryAll<{ reviewer_role: string; status: string; reviewer_id: string | null }>(db, `
    SELECT reviewer_role, status, reviewer_id
      FROM content_reviews
     WHERE entity_type = ? AND entity_id = ?
     ORDER BY created_at DESC
  `, [type, id]);
  return rows.map((row) => ({ role: row.reviewer_role, status: row.status, reviewer_id: row.reviewer_id }));
}

/// Rights for the entity plus the rights it inherits from its series.
///
/// Both are returned, the inherited ones tagged, because an editor told only "the
/// licence expired" cannot tell whether to renew this episode's contract or the
/// whole series'.
async function loadRights(
  db: D1Database,
  type: PublishableType,
  id: string,
  seriesId: string | null,
): Promise<RightsFact[]> {
  const rows: RightsFact[] = [];
  if (REVIEWABLE.includes(type)) {
    const own = await queryAll<{ owner: string; territories: string; licenses: string; expiry: string | null }>(db, `
      SELECT owner, territories, licenses, expiry
        FROM content_rights
       WHERE entity_type = ? AND entity_id = ?
    `, [type, id]);
    rows.push(...own.map((row) => ({
      owner: row.owner,
      territories: stringArray(row.territories),
      licenses: stringArray(row.licenses),
      expiry: row.expiry,
      inherited_from: null,
    })));
  }
  if (seriesId && type !== 'series') {
    const inherited = await queryAll<{ owner: string; territories: string; licenses: string; expiry: string | null }>(db, `
      SELECT owner, territories, licenses, expiry
        FROM content_rights
       WHERE entity_type = 'series' AND entity_id = ?
    `, [seriesId]);
    rows.push(...inherited.map((row) => ({
      owner: row.owner,
      territories: stringArray(row.territories),
      licenses: stringArray(row.licenses),
      expiry: row.expiry,
      inherited_from: { type: 'series' as PublishableType, id: seriesId },
    })));
  }
  return rows;
}

async function loadLinkedAssets(
  db: D1Database,
  entityType: string,
  id: string,
): Promise<LinkedAssetFact[]> {
  return queryAll<LinkedAssetFact>(db, `
    SELECT al.role AS role, al.asset_id AS asset_id, al.language AS language, ca.status AS status
      FROM asset_links al
      LEFT JOIN content_assets ca ON ca.id = al.asset_id
     WHERE al.entity_type = ? AND al.entity_id = ?
     ORDER BY al.role, al.sort_order
  `, [entityType, id]);
}

/// The workflow facts the gate needs, or null when no run governs this content.
///
/// Read through `routes/adminWorkflow.ts` rather than with its own query, so the
/// gate and the workflow screen cannot disagree about which stages are approved —
/// two queries against the same tables drift the moment one of them gains a
/// condition.
async function loadWorkflowFacts(env: Env, type: PublishableType, id: string) {
  const workflow = await workflowFor(env.DB, type, id);
  if (!workflow) return null;
  const blockers = workflowPublishBlockers(workflow.stages, workflow.runStages);
  return {
    run_id: workflow.runId,
    blockers,
    total_blocking_stages: workflow.stages.filter((stage) => stage.blocks_publish).length,
  };
}

/// Gathers every fact the gate needs, or null when the row does not exist.
export async function gatherPublishGateFacts(
  env: Env,
  type: PublishableType,
  id: string,
): Promise<PublishGateFacts | null> {
  const db = env.DB;
  const day = today();

  if (type === 'series') {
    const row = await queryFirst<{
      id: string; status: string; content_class: string; planet_id: string | null;
      source_type: string | null; religious_reviewer_id: string | null; religious_approved_at: string | null;
      cover_url: string | null; visual_style_id: string | null; description_ar: string | null;
      episode_count: number; published_episode_count: number;
    }>(db, `
      SELECT s.id, s.status, s.content_class, s.planet_id, s.source_type,
             s.religious_reviewer_id, s.religious_approved_at, s.cover_url,
             s.visual_style_id, s.description_ar,
             (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id) AS episode_count,
             (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id AND e.status = 'published') AS published_episode_count
        FROM series s WHERE s.id = ?
    `, [id]);
    if (!row) return null;
    // Season counts are loaded as their own query rather than joined: the series
    // row is one row and its seasons are many, so a join would multiply the
    // series facts by the season count for no benefit.
    const seasonRows = await queryAll<Record<string, unknown>>(db, `
      SELECT se.id, se.season_number, se.title_ar, se.status, se.episode_count,
        ${seasonEpisodeCountSelect('se')}
      FROM seasons se WHERE se.series_id = ? ORDER BY se.season_number
    `, [id]);
    return {
      entity_type: 'series',
      entity_id: row.id,
      status: row.status,
      is_test_fixture: row.content_class === 'test_fixture',
      reviews: await loadReviews(db, 'series', id),
      reviews_supported: true,
      rights: await loadRights(db, 'series', id, null),
      rights_supported: true,
      assets: await loadLinkedAssets(db, 'series', id),
      today: day,
      workflow: await loadWorkflowFacts(env, 'series', id),
      planet_id: row.planet_id,
      source_type: row.source_type,
      religious_reviewer_id: row.religious_reviewer_id,
      religious_approved_at: row.religious_approved_at,
      cover_url: row.cover_url,
      visual_style_id: row.visual_style_id,
      description_ar: row.description_ar,
      episode_count: Number(row.episode_count) || 0,
      published_episode_count: Number(row.published_episode_count) || 0,
      seasons: seasonRows.map((season) => ({
        season_id: String(season.id),
        season_number: Number(season.season_number) || 0,
        title_ar: season.title_ar === null || season.title_ar === undefined
          ? null : String(season.title_ar),
        status: String(season.status),
        ...seasonEpisodeCounts(season),
      })),
    };
  }

  if (type === 'episode') {
    const row = await queryFirst<{
      id: string; status: string; series_id: string; series_status: string; content_class: string;
      planet_id: string | null; source_type: string | null; religious_approved_at: string | null;
      video_master_url: string | null; video_hls_1080: string | null; thumbnail_url: string | null;
      duration_seconds: number | null; captions_ar_url: string | null; dubs: string;
      learning_objective_id: string | null;
    }>(db, `
      SELECT e.id, e.status, e.series_id, s.status AS series_status, s.content_class,
             s.planet_id, e.source_type, e.religious_approved_at,
             e.video_master_url, e.video_hls_1080, e.thumbnail_url,
             e.duration_seconds, e.captions_ar_url, e.dubs, e.learning_objective_id
        FROM episodes e JOIN series s ON s.id = e.series_id
       WHERE e.id = ?
    `, [id]);
    if (!row) return null;
    return {
      entity_type: 'episode',
      entity_id: row.id,
      status: row.status,
      is_test_fixture: row.content_class === 'test_fixture',
      reviews: await loadReviews(db, 'episode', id),
      reviews_supported: true,
      rights: await loadRights(db, 'episode', id, row.series_id),
      rights_supported: true,
      assets: await loadLinkedAssets(db, 'episode', id),
      today: day,
      workflow: await loadWorkflowFacts(env, 'episode', id),
      series_id: row.series_id,
      series_status: row.series_status,
      planet_id: row.planet_id,
      source_type: row.source_type,
      religious_approved_at: row.religious_approved_at,
      video_master_url: row.video_master_url,
      video_hls_1080: row.video_hls_1080,
      thumbnail_url: row.thumbnail_url,
      duration_seconds: row.duration_seconds,
      captions_ar_url: row.captions_ar_url,
      dubs: stringArray(row.dubs),
      learning_objective_id: row.learning_objective_id,
    };
  }

  if (type === 'story') {
    const row = await queryFirst<{
      id: string; status: string; type: string; default_language: string; languages: string;
      visual_style_id: string | null; series_id: string | null; series_status: string | null;
      content_class: string | null;
    }>(db, `
      SELECT st.id, st.status, st.type, st.default_language, st.languages, st.visual_style_id,
             st.series_id, s.status AS series_status, s.content_class
        FROM stories st LEFT JOIN series s ON s.id = st.series_id
       WHERE st.id = ?
    `, [id]);
    if (!row) return null;

    const pages = await loadPageFacts(db, id);

    return {
      entity_type: 'story',
      entity_id: row.id,
      status: row.status,
      is_test_fixture: row.content_class === 'test_fixture',
      reviews: await loadReviews(db, 'story', id),
      reviews_supported: true,
      rights: await loadRights(db, 'story', id, row.series_id),
      rights_supported: false,
      assets: await loadLinkedAssets(db, 'story', id),
      today: day,
      workflow: await loadWorkflowFacts(env, 'story', id),
      story_type: row.type,
      default_language: row.default_language,
      declared_languages: stringArray(row.languages),
      visual_style_id: row.visual_style_id,
      series_id: row.series_id,
      series_status: row.series_status,
      pages,
    };
  }

  if (type === 'book') {
    const row = await queryFirst<{
      id: string; status: string; pages: string; series_id: string | null; content_class: string | null;
      languages: string | null; default_language: string | null;
    }>(db, `
      SELECT b.id, b.status, b.pages, b.series_id, s.content_class,
             b.languages, b.default_language
        FROM books b LEFT JOIN series s ON s.id = b.series_id
       WHERE b.id = ?
    `, [id]);
    if (!row) return null;
    return {
      entity_type: 'book',
      entity_id: row.id,
      status: row.status,
      is_test_fixture: row.content_class === 'test_fixture',
      reviews: await loadReviews(db, 'book', id),
      reviews_supported: true,
      rights: await loadRights(db, 'book', id, row.series_id),
      rights_supported: true,
      assets: await loadLinkedAssets(db, 'book', id),
      today: day,
      workflow: await loadWorkflowFacts(env, 'book', id),
      // `API-107`: الصفحات من `story_pages` لا من العمود القديم `b.pages`.
      // نفس المصدر الذي يقرأه `GET /books/:id/pages`، فما تقيسه البوابة هو ما
      // يراه الطفل.
      pages: await loadPageFacts(db, id),
      legacy_pages_column: row.pages,
      languages: row.languages,
      default_language: row.default_language,
    };
  }

  if (type === 'project') {
    const row = await queryFirst<{
      id: string; status: string; materials: string; steps: string; supervision_level: string;
      safety_notes: string | null; cover_url: string | null; series_id: string | null;
      content_class: string | null;
    }>(db, `
      SELECT p.id, p.status, p.materials, p.steps, p.supervision_level, p.safety_notes,
             p.cover_url, p.series_id, s.content_class
        FROM projects p LEFT JOIN series s ON s.id = p.series_id
       WHERE p.id = ?
    `, [id]);
    if (!row) return null;
    return {
      entity_type: 'project',
      entity_id: row.id,
      status: row.status,
      is_test_fixture: row.content_class === 'test_fixture',
      reviews: await loadReviews(db, 'project', id),
      reviews_supported: true,
      rights: await loadRights(db, 'project', id, row.series_id),
      rights_supported: true,
      assets: await loadLinkedAssets(db, 'project', id),
      today: day,
      workflow: await loadWorkflowFacts(env, 'project', id),
      materials: row.materials,
      steps: row.steps,
      supervision_level: row.supervision_level,
      safety_notes: row.safety_notes,
      cover_url: row.cover_url,
    };
  }

  // Games: the engine readiness is computed by the same code the games screen
  // uses, so the unified gate and `/admin/games/:id/readiness` can never disagree.
  const game = await loadGameRow(db, id);
  if (!game) return null;
  const { readiness } = await gameReadinessFor(env, game);
  return {
    entity_type: 'game',
    entity_id: game.id,
    status: (game as { status?: string }).status ?? 'draft',
    is_test_fixture: (game as { content_class?: string }).content_class === 'test_fixture',
    reviews: await loadReviews(db, 'game', id),
    reviews_supported: true,
    rights: await loadRights(db, 'game', id, (game as { series_id?: string | null }).series_id ?? null),
    rights_supported: true,
    assets: await loadLinkedAssets(db, 'game', id),
    today: day,
    workflow: await loadWorkflowFacts(env, 'game', id),
    readiness,
  };
}

/// Evaluates the gate for one entity, or null when it does not exist.
export async function evaluateFor(
  env: Env,
  type: PublishableType,
  id: string,
): Promise<PublishGateResult | null> {
  const facts = await gatherPublishGateFacts(env, type, id);
  return facts ? evaluatePublishGate(facts) : null;
}

/// The refusal body a publish operation returns when the gate blocks it.
///
/// 409 rather than 400: the request is well formed and the caller is authorised —
/// the *content* is not in a publishable state. A 400 would suggest the operator
/// sent something wrong.
///
/// `error` names the count and `blockers` carries the full list, because a client
/// that only shows `error` must still tell the user something true, and a client
/// that shows the list must not have to parse a sentence to get it.
export function gateRefusal(result: PublishGateResult) {
  return {
    success: false as const,
    error: `Publish blocked by ${result.blockers.length} readiness check(s)`,
    data: {
      entity_type: result.entity_type,
      entity_id: result.entity_id,
      publishable: false as const,
      blockers: result.blockers,
      warnings: result.warnings,
    },
  };
}

/// `GET /admin/publish-readiness/:type/:id`
///
/// Read-only and behind `requireAdmin` only: seeing why something cannot be
/// published is not a privileged act, and requiring the publish permission to look
/// would hide the checklist from precisely the people who have to clear it.
route.get('/publish-readiness/:type/:id', requireAdmin, async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id') ?? '';
  if (!isPublishableType(type)) {
    return c.json({ success: false, error: 'Unsupported content type for publish readiness' }, 400);
  }
  const result = await evaluateFor(c.env, type, id);
  if (!result) return c.json({ success: false, error: 'Content not found' }, 404);
  return c.json({ success: true, data: result });
});

/// The table each publishable type lives in. Explicit, because a generic guess
/// (`${type}s`) would silently produce `storys` and report a clean sheet for a type
/// it never queried — a checker that finds nothing because it looked nowhere.
const TABLE_FOR: Record<PublishableType, string> = {
  series: 'series',
  episode: 'episodes',
  story: 'stories',
  book: 'books',
  game: 'games',
  project: 'projects',
};

/// The statuses worth sweeping, and the reason each is a distinct question.
///
/// Whitelisted rather than interpolated: the status reaches a `WHERE` clause, and an
/// open parameter there is an injection with extra steps.
const SWEEPABLE_STATUS = ['published', 'ready', 'scheduled', 'review'] as const;
type SweepStatus = typeof SWEEPABLE_STATUS[number];
const isSweepStatus = (value: string): value is SweepStatus =>
  (SWEEPABLE_STATUS as readonly string[]).includes(value);

/// `GET /admin/publish-readiness/sweep?status=published|ready|scheduled|review`
///
/// ## Two questions, one gate (`CNT-101`, `CNT-102`)
///
/// The gate runs **at the moment of publishing** and never again, and the only other
/// endpoint evaluates one item (`/publish-readiness/:type/:id`). So two operational
/// questions had no answer without one request per row and a human keeping score:
///
///  * `status=published` — *what is live right now that would fail if we published it
///    today?* Rows published before a check existed, or whose asset was unlinked
///    afterwards, stay live and broken. Worst for episodes: a child presses "watch"
///    on a shelf and gets an error, which is worse than the row not being there.
///  * `status=ready` — *what is waiting to be published, and what exactly does each
///    one lack?* This is the editor's queue. Without it, "twelve stories sit at ready"
///    is a number with no next action attached.
///
/// It is one endpoint because it is one question with a filter, and two endpoints
/// would be two copies of the same loop drifting apart.
///
/// ## Why it re-runs the gate instead of a SQL predicate
///
/// A query mirroring "has a video" would be a **second copy of the rule** and would
/// drift from `evaluatePublishGate` exactly as every hand-maintained mirror in this
/// audit has. This calls `evaluateFor` per row: slower, and correct by construction —
/// whatever the gate blocks on today is what this reports.
///
/// `limit` is capped because this is O(rows x queries-per-row); the caller pages.
route.get('/publish-readiness/sweep', requireAdmin, async (c) => {
  const requested = c.req.query('type');
  const types = requested
    ? (isPublishableType(requested) ? [requested] : null)
    : (Object.keys(TABLE_FOR) as PublishableType[]);
  if (!types) return c.json({ success: false, error: 'Unsupported content type for publish readiness' }, 400);

  const requestedStatus = c.req.query('status') ?? 'published';
  if (!isSweepStatus(requestedStatus)) {
    return c.json({
      success: false,
      error: `Unsupported status: expected one of ${SWEEPABLE_STATUS.join(', ')}`,
    }, 400);
  }

  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 100), 1), 500);
  const blocked: Array<{
    entity_type: PublishableType; entity_id: string; blockers: PublishGateResult['blockers'];
  }> = [];
  /// Rows that pass but carry warnings (`CNT-107`).
  ///
  /// The sweep reported blockers only, and that hid the exact class of problem the
  /// audit raised: `content_reviews` has 43 rows, **all** pending, and the gate
  /// treats a pending or absent review as a **warning** — deliberately, because
  /// turning absence into a blocker would mark the whole library unpublishable and
  /// train people to bypass the gate. The consequence is that a published item
  /// whose every review is still pending came back from this endpoint as clean.
  ///
  /// So warnings are reported, and reported **separately**: folding them into
  /// `blocked` would call a warning a refusal, and dropping them makes the ignored
  /// warning invisible. Neither is the truth.
  const warned: Array<{
    entity_type: PublishableType; entity_id: string; warnings: PublishGateResult['warnings'];
  }> = [];
  const checked: Record<string, number> = {};
  // A type whose read fails must not be reported as "nothing wrong": that is the
  // zero-for-unknown mistake. It is named instead.
  const unavailable: Array<{ entity_type: PublishableType; error: string }> = [];

  for (const type of types) {
    let rows: Array<{ id: string }> = [];
    try {
      rows = await queryAll<{ id: string }>(
        c.env.DB,
        `SELECT id FROM ${TABLE_FOR[type]} WHERE status = ? ORDER BY id LIMIT ?`,
        [requestedStatus, limit],
      );
    } catch (error) {
      unavailable.push({ entity_type: type, error: String(error) });
      continue;
    }
    checked[type] = rows.length;
    for (const row of rows) {
      const result = await evaluateFor(c.env, type, row.id).catch(() => null);
      // A row that cannot be evaluated is not a clean row.
      if (!result) {
        unavailable.push({ entity_type: type, error: `could not evaluate ${row.id}` });
        continue;
      }
      if (result.blockers.length > 0) {
        blocked.push({ entity_type: type, entity_id: row.id, blockers: result.blockers });
      }
      // A blocked row is already reported with the stronger finding; listing it
      // twice would inflate both counts for one problem.
      else if (result.warnings.length > 0) {
        warned.push({ entity_type: type, entity_id: row.id, warnings: result.warnings });
      }
    }
  }

  return c.json({
    success: true,
    data: {
      status: requestedStatus,
      checked,
      blocked_count: blocked.length,
      blocked,
      warned_count: warned.length,
      warned,
      unavailable,
      limit,
    },
  });
});

export default route;
