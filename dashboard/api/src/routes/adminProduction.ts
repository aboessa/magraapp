/// Production Centre endpoints: the requirement matrix per item, the board across the
/// catalogue, and the assignment writes.
///
/// `lib/productionMatrix.ts` derives every state; this gathers the rows and stores only
/// the human layer. Mounted on the admin prefix.
///
/// ## Why the board is capped rather than paginated by requirement
///
/// The board answers "what does the slate still need", which is a question about items,
/// so it pages over items and returns each one's full matrix. Paging over *requirements*
/// would split one episode across two pages and make every per-item percentage wrong.
/// The cap exists because each item costs a handful of queries, and an uncapped board
/// over a thousand-episode catalogue would be a timeout rather than a screen.

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { queryAll, queryFirst } from '../lib/db';
import { requireAdmin, requirePermission } from '../lib/adminAuth';
import { actorId, auditStatement } from '../lib/auditLog';
import {
  isProductionRequirement,
  productionMatrix,
  summarizeMatrix,
  type EpisodeProductionFacts,
  type ProductionAssignment,
  type ProductionFacts,
  type StoryProductionFacts,
} from '../lib/productionMatrix.ts';
import { evaluateFor } from './adminPublishGate.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// How many items one board request may resolve. See the header note.
const BOARD_LIMIT = 40;

const parseList = (raw: unknown): string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

async function loadAssignments(
  db: D1Database,
  contentType: string,
  contentIds: string[],
): Promise<Map<string, ProductionAssignment[]>> {
  if (!contentIds.length) return new Map();
  const rows = await queryAll<{
    content_id: string; requirement: string; assignee_id: string | null; team_id: string | null;
    due_at: string | null; blocker: string | null; note: string | null;
  }>(db, `
    SELECT content_id, requirement, assignee_id, team_id, due_at, blocker, note
      FROM production_requirements
     WHERE content_type = ? AND content_id IN (${contentIds.map(() => '?').join(', ')})
  `, [contentType, ...contentIds]);

  const map = new Map<string, ProductionAssignment[]>();
  for (const item of rows) {
    if (!isProductionRequirement(item.requirement)) continue;
    const list = map.get(item.content_id) ?? [];
    list.push({
      requirement: item.requirement,
      assignee_id: item.assignee_id,
      team_id: item.team_id,
      due_at: item.due_at,
      blocker: item.blocker,
      note: item.note,
    });
    map.set(item.content_id, list);
  }
  return map;
}

async function loadAssets(db: D1Database, entityType: string, ids: string[]) {
  if (!ids.length) return new Map<string, Array<{ role: string; status: string | null; language: string }>>();
  const rows = await queryAll<{ entity_id: string; role: string; status: string | null; language: string }>(db, `
    SELECT al.entity_id, al.role, al.language, ca.status
      FROM asset_links al
      LEFT JOIN content_assets ca ON ca.id = al.asset_id
     WHERE al.entity_type = ? AND al.entity_id IN (${ids.map(() => '?').join(', ')})
  `, [entityType, ...ids]);
  const map = new Map<string, Array<{ role: string; status: string | null; language: string }>>();
  for (const item of rows) {
    const list = map.get(item.entity_id) ?? [];
    list.push({ role: item.role, status: item.status, language: item.language ?? '' });
    map.set(item.entity_id, list);
  }
  return map;
}

async function loadReviews(db: D1Database, entityType: string, ids: string[]) {
  if (!ids.length) return new Map<string, Array<{ role: string; status: string }>>();
  const rows = await queryAll<{ entity_id: string; reviewer_role: string; status: string }>(db, `
    SELECT entity_id, reviewer_role, status FROM content_reviews
     WHERE entity_type = ? AND entity_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY created_at DESC
  `, [entityType, ...ids]);
  const map = new Map<string, Array<{ role: string; status: string }>>();
  for (const item of rows) {
    const list = map.get(item.entity_id) ?? [];
    list.push({ role: item.reviewer_role, status: item.status });
    map.set(item.entity_id, list);
  }
  return map;
}

/// Publish blockers per item.
///
/// Evaluated through the same gate the publish operation enforces, so the board's
/// PUBLISH row cannot disagree with what pressing publish would do. Skipped when
/// `withPublish` is false, because the gate costs several queries per item and a
/// forty-item board does not always need it.
async function loadPublishBlockers(
  env: Env,
  type: 'episode' | 'story',
  ids: string[],
  withPublish: boolean,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!withPublish) return map;
  for (const id of ids) {
    const result = await evaluateFor(env, type, id);
    if (result) map.set(id, result.blockers.map((blocker) => `${blocker.label_ar}: ${blocker.detail}`));
  }
  return map;
}

async function episodeFacts(env: Env, ids: string[], withPublish: boolean): Promise<EpisodeProductionFacts[]> {
  if (!ids.length) return [];
  const rows = await queryAll<{
    id: string; title_ar: string; status: string; video_master_url: string | null;
    video_hls_1080: string | null; thumbnail_url: string | null; captions_ar_url: string | null;
    dubs: string; learning_objective_id: string | null;
  }>(env.DB, `
    SELECT id, title_ar, status, video_master_url, video_hls_1080, thumbnail_url,
           captions_ar_url, dubs, learning_objective_id
      FROM episodes WHERE id IN (${ids.map(() => '?').join(', ')})
  `, ids);

  const [assets, reviews, blockers] = await Promise.all([
    loadAssets(env.DB, 'episode', ids),
    loadReviews(env.DB, 'episode', ids),
    loadPublishBlockers(env, 'episode', ids, withPublish),
  ]);

  return rows.map((item) => ({
    content_type: 'episode' as const,
    content_id: item.id,
    title: item.title_ar,
    status: item.status,
    assets: assets.get(item.id) ?? [],
    video_master_url: item.video_master_url,
    video_hls_1080: item.video_hls_1080,
    thumbnail_url: item.thumbnail_url,
    captions_ar_url: item.captions_ar_url,
    dubs: parseList(item.dubs),
    learning_objective_id: item.learning_objective_id,
    reviews: reviews.get(item.id) ?? [],
    publish_blockers: blockers.get(item.id) ?? [],
    publish_evaluated: withPublish,
  }));
}

async function storyFacts(env: Env, ids: string[], withPublish: boolean): Promise<StoryProductionFacts[]> {
  if (!ids.length) return [];
  const rows = await queryAll<{
    id: string; title_ar: string; status: string; type: string;
    default_language: string; languages: string;
  }>(env.DB, `
    SELECT id, title_ar, status, type, default_language, languages
      FROM stories WHERE id IN (${ids.map(() => '?').join(', ')})
  `, ids);

  // Pages and their localisations in two queries for the whole set, not per story: a
  // board of twenty forty-page stories would otherwise issue eight hundred queries.
  const pages = await queryAll<{ id: string; story_id: string; page_number: number | null; image_status: string | null }>(env.DB, `
    SELECT p.id, p.story_id, p.page_number, ca.status AS image_status
      FROM story_pages p LEFT JOIN content_assets ca ON ca.id = p.image_asset_id
     WHERE p.story_id IN (${ids.map(() => '?').join(', ')})
     ORDER BY p.page_number
  `, ids);
  const pageIds = pages.map((page) => page.id);
  const localizations = pageIds.length
    ? await queryAll<{ page_id: string; language: string; body_text: string | null; narration_status: string | null }>(env.DB, `
        SELECT l.page_id, l.language, l.body_text, ca.status AS narration_status
          FROM story_page_localizations l
          LEFT JOIN content_assets ca ON ca.id = l.narration_asset_id
         WHERE l.page_id IN (${pageIds.map(() => '?').join(', ')})
      `, pageIds)
    : [];

  const [assets, reviews, blockers] = await Promise.all([
    loadAssets(env.DB, 'story', ids),
    loadReviews(env.DB, 'story', ids),
    loadPublishBlockers(env, 'story', ids, withPublish),
  ]);

  return rows.map((item) => ({
    content_type: 'story' as const,
    content_id: item.id,
    title: item.title_ar,
    status: item.status,
    story_type: item.type,
    default_language: item.default_language,
    declared_languages: parseList(item.languages),
    assets: assets.get(item.id) ?? [],
    pages: pages.filter((page) => page.story_id === item.id).map((page) => {
      const rows = localizations.filter((entry) => entry.page_id === page.id);
      return {
        page_number: page.page_number,
        image_ready: page.image_status === 'ready',
        text_languages: rows.filter((entry) => (entry.body_text ?? '').trim()).map((entry) => entry.language),
        narration_languages: rows.filter((entry) => entry.narration_status === 'ready').map((entry) => entry.language),
      };
    }),
    reviews: reviews.get(item.id) ?? [],
    publish_blockers: blockers.get(item.id) ?? [],
    publish_evaluated: withPublish,
  }));
}

/// `GET /admin/production/:type/:id` — the full matrix for one item.
route.get('/production/:type/:id', requireAdmin, async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id') ?? '';
  if (type !== 'episode' && type !== 'story') {
    return c.json({ success: false, error: 'Production tracking covers episodes and stories' }, 400);
  }

  const facts = type === 'episode'
    ? (await episodeFacts(c.env, [id], true))[0]
    : (await storyFacts(c.env, [id], true))[0];
  if (!facts) return c.json({ success: false, error: 'Content not found' }, 404);

  const assignments = (await loadAssignments(c.env.DB, type, [id])).get(id) ?? [];
  const rows = productionMatrix(facts, assignments);
  return c.json({
    success: true,
    data: {
      content_type: type,
      content_id: id,
      title: facts.title,
      status: facts.status,
      requirements: rows,
      summary: summarizeMatrix(rows),
    },
  });
});

/// `GET /admin/production/board`
///
/// One page of items with their matrices, for the table and the kanban. `with_publish=0`
/// skips the publish-gate evaluation, which is the expensive part.
route.get('/production/board', requireAdmin, async (c) => {
  const type = c.req.query('type') === 'story' ? 'story' : 'episode';
  const status = c.req.query('status');
  const seriesId = c.req.query('series_id');
  const withPublish = c.req.query('with_publish') !== '0';
  const limit = Math.min(Math.max(Number.parseInt(c.req.query('limit') ?? '20', 10) || 20, 1), BOARD_LIMIT);
  const offset = Math.max(Number.parseInt(c.req.query('offset') ?? '0', 10) || 0, 0);

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status) { clauses.push('status = ?'); params.push(status); }
  else {
    // Default view is the slate in production, not the archive: a board whose first
    // page is published and archived work answers no question anybody has.
    clauses.push("status NOT IN ('published', 'archived')");
  }
  if (seriesId) { clauses.push('series_id = ?'); params.push(seriesId); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const table = type === 'episode' ? 'episodes' : 'stories';

  const total = await queryFirst<{ total: number }>(c.env.DB, `SELECT COUNT(*) AS total FROM ${table} ${where}`, params);
  const ids = (await queryAll<{ id: string }>(c.env.DB, `
    SELECT id FROM ${table} ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?
  `, [...params, limit, offset])).map((row) => row.id);

  const facts: ProductionFacts[] = type === 'episode'
    ? await episodeFacts(c.env, ids, withPublish)
    : await storyFacts(c.env, ids, withPublish);
  const assignments = await loadAssignments(c.env.DB, type, ids);

  const items = facts.map((entry) => {
    const rows = productionMatrix(entry, assignments.get(entry.content_id) ?? []);
    return {
      content_type: entry.content_type,
      content_id: entry.content_id,
      title: entry.title,
      status: entry.status,
      requirements: rows,
      summary: summarizeMatrix(rows),
    };
  });

  return c.json({
    success: true,
    data: items,
    meta: {
      total: Number(total?.total ?? 0),
      limit,
      offset,
      publish_evaluated: withPublish,
      // Stated so a screen showing a capped board cannot present it as the whole slate.
      board_limit: BOARD_LIMIT,
    },
  });
});

/// `PUT /admin/production/:type/:id/:requirement` — the human layer.
///
/// There is no status field to set. `lib/productionMatrix.ts` explains why at length:
/// a stored status drifts from the artefacts and a board that lies is worse than none.
route.put('/production/:type/:id/:requirement', requirePermission('assign_members'), async (c) => {
  const type = c.req.param('type');
  const id = c.req.param('id') ?? '';
  const requirement = c.req.param('requirement') ?? '';
  if (type !== 'episode' && type !== 'story') {
    return c.json({ success: false, error: 'Production tracking covers episodes and stories' }, 400);
  }
  if (!isProductionRequirement(requirement)) {
    return c.json({ success: false, error: 'Unknown production requirement' }, 400);
  }

  const table = type === 'episode' ? 'episodes' : 'stories';
  const exists = await queryFirst<{ id: string }>(c.env.DB, `SELECT id FROM ${table} WHERE id = ?`, [id]);
  if (!exists) return c.json({ success: false, error: 'Content not found' }, 404);

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const text = (value: unknown, max: number) => {
    if (value === null || value === '') return null;
    return typeof value === 'string' ? value.trim().slice(0, max) || null : undefined;
  };
  const assignee = text(body.assignee_id, 120);
  const team = text(body.team_id, 120);
  const blocker = text(body.blocker, 500);
  const note = text(body.note, 1_000);
  if ([assignee, team, blocker, note].includes(undefined)) {
    return c.json({ success: false, error: 'assignee_id, team_id, blocker and note must be text or null' }, 400);
  }
  const dueAt = body.due_at === null || body.due_at === '' ? null
    : typeof body.due_at === 'string' && !Number.isNaN(Date.parse(body.due_at)) ? body.due_at
      : undefined;
  if (dueAt === undefined) return c.json({ success: false, error: 'due_at must be an ISO 8601 timestamp or null' }, 400);

  if (assignee) {
    const user = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE id = ? AND is_active = 1', [assignee]);
    if (!user) return c.json({ success: false, error: 'Assignee not found or inactive' }, 404);
  }
  if (team) {
    const row = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM teams WHERE id = ?', [team]);
    if (!row) return c.json({ success: false, error: 'Team not found' }, 404);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO production_requirements
        (id, content_type, content_id, requirement, assignee_id, team_id, due_at, blocker, note, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (content_type, content_id, requirement) DO UPDATE SET
        assignee_id = excluded.assignee_id,
        team_id = excluded.team_id,
        due_at = excluded.due_at,
        blocker = excluded.blocker,
        note = excluded.note,
        updated_by = excluded.updated_by,
        updated_at = datetime('now')
    `).bind(
      `prod-${type}-${id}-${requirement}`,
      type, id, requirement, assignee ?? null, team ?? null, dueAt, blocker ?? null, note ?? null, actorId(c),
    ),
    auditStatement(c.env.DB, actorId(c), 'production_assign', type, id, {
      requirement, assignee_id: assignee ?? null, team_id: team ?? null, due_at: dueAt, has_blocker: !!blocker,
    }),
  ]);

  return c.json({ success: true, data: { content_type: type, content_id: id, requirement } });
});

/// `GET /admin/production/my-queue` — the signed-in user's production assignments.
route.get('/production/my-queue', requireAdmin, async (c) => {
  const user = c.get('adminUser') as { id?: string } | undefined;
  if (!user?.id) {
    return c.json({ success: true, data: [], meta: { total: 0, reason: 'no_session_identity' } });
  }
  const rows = await queryAll(c.env.DB, `
    SELECT pr.content_type, pr.content_id, pr.requirement, pr.due_at, pr.blocker, pr.note,
           COALESCE(e.title_ar, s.title_ar) AS title,
           COALESCE(e.status, s.status) AS content_status
      FROM production_requirements pr
      LEFT JOIN episodes e ON pr.content_type = 'episode' AND e.id = pr.content_id
      LEFT JOIN stories s ON pr.content_type = 'story' AND s.id = pr.content_id
     WHERE pr.assignee_id = ?
     ORDER BY pr.due_at IS NULL, pr.due_at ASC
  `, [user.id]);
  return c.json({ success: true, data: rows, meta: { total: rows.length } });
});

export default route;
