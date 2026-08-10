/// Admin CMS routes for the catalogue rows that had no HTTP surface at all:
/// learning objectives (and their derived track rows), skills, content reviews,
/// story-page reads, a cascading story purge, and get-by-id for seasons and
/// characters.
///
/// Mounted under the same `/api/v1/admin` prefix as routes/admin.ts, after
/// routes/adminContent.ts, so nothing here shadows an existing handler.
/// Everything follows the envelope used by routes/admin.ts:
/// `{ success: true, data, meta? }` or `{ success: false, error }` with 400 for
/// bad input, 404 for a missing row, 409 for a conflict or a refused delete and
/// 201 for a create.
///
/// All validation lives in lib/catalogueValidation.ts so it can be unit tested
/// without booting a worker (test/catalogueValidation.test.mjs).

import { Hono } from 'hono';
import type { Env } from '../lib/db';
import { pathParam } from '../lib/routeParams.ts';
import { queryAll, queryFirst } from '../lib/db';
import { actorId, auditStatement, claimedActor } from '../lib/auditLog';
import { requirePermission } from '../lib/adminAuth';
import { checkSelfApproval, isApproval, SELF_APPROVAL_ERROR } from '../lib/separationOfDuties';
import {
  CHARACTER_ROLES,
  REVIEWER_ROLES,
  REVIEW_ENTITY_TABLES,
  REVIEW_ENTITY_TYPES,
  REVIEW_STATUSES,
  TRACKS,
  ageRangeError,
  enumError,
  integer,
  isValidLanguage,
  normalizeTracks,
  nullableText,
  objectiveCreatePayload,
  parseJson,
  parsePagination,
  reviewCreatePayload,
  text,
  tracksForRange,
  type AgeTrack,
} from '../lib/catalogueValidation';
import {
  objectiveSkillWrites,
  parseObjectiveSkills,
  referencedSkillIds,
  serializeObjectiveSkills,
  type ObjectiveSkillRow,
} from '../lib/objectiveSkills';

type AppEnv = { Bindings: Env };
type Row = Record<string, unknown>;
type JsonObject = Record<string, unknown>;

const route = new Hono<AppEnv>();

async function readBody(c: { req: { json(): Promise<unknown> } }): Promise<JsonObject | null> {
  const value = await c.req.json().catch(() => null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}

function isConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE|constraint|FOREIGN KEY/i.test(message);
}

type AuditContext = { req: { header(name: string): string | undefined } };

function audit(db: D1Database, c: AuditContext, action: string, entityType: string, entityId: string, details: unknown) {
  const claimed = claimedActor(c);
  const enriched = details && typeof details === 'object' && !Array.isArray(details)
    ? { ...details as JsonObject, claimed_actor: claimed }
    : { details, claimed_actor: claimed };
  return auditStatement(db, actorId(c), action, entityType, entityId, enriched);
}

function splitTracks(value: unknown): AgeTrack[] {
  if (typeof value !== 'string' || !value) return [];
  return value.split(',').filter((track): track is AgeTrack => TRACKS.includes(track as AgeTrack));
}

// Skills ---------------------------------------------------------------------
// learning_objectives.skill_id points here, so an editor needs to be able to
// read and curate the list before assigning one to an objective.

route.get('/skills', async (c) => {
  const db = c.env.DB;
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'));
  const query = c.req.query('q')?.trim();
  const category = c.req.query('category')?.trim();

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query) { clauses.push('(name_ar LIKE ? OR id LIKE ?)'); params.push(`%${query}%`, `%${query}%`); }
  if (category) { clauses.push('category = ?'); params.push(category); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const totalRow = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM skills ${where}`, params);
  const rows = await queryAll<Row>(db, `
    SELECT s.*,
      (SELECT COUNT(*) FROM learning_objectives lo WHERE lo.skill_id = s.id) AS objectives_count,
      (SELECT COUNT(*) FROM learning_objective_skills los
        WHERE los.skill_id = s.id AND los.role = 'secondary') AS secondary_objectives_count
    FROM skills s
    ${where}
    ORDER BY s.category, s.name_ar
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return c.json({ success: true, data: rows, meta: { total: Number(totalRow?.total ?? 0), limit, offset } });
});

route.get('/skills/:id', async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const row = await queryFirst<Row>(db, 'SELECT * FROM skills WHERE id = ?', [id]);
  if (!row) return c.json({ success: false, error: 'Skill not found' }, 404);
  const objectives = await queryAll<Row>(db, 'SELECT id, code, title_ar, age_min, age_max FROM learning_objectives WHERE skill_id = ? ORDER BY code', [id]);
  // Objectives that name this skill as supporting rather than primary. Without
  // this the CMS would show `fine_motor` as used by one objective when it in
  // fact also underpins letter tracing.
  const secondaryObjectives = await queryAll<Row>(db, `
    SELECT lo.id, lo.code, lo.title_ar, lo.age_min, lo.age_max
    FROM learning_objective_skills los
    JOIN learning_objectives lo ON lo.id = los.objective_id
    WHERE los.skill_id = ? AND los.role = 'secondary'
    ORDER BY lo.code
  `, [id]);
  return c.json({ success: true, data: { ...row, objectives, secondary_objectives: secondaryObjectives } });
});

route.post('/skills', requirePermission('create'), async (c) => {
  const body = await readBody(c);
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const nameAr = text(body.name_ar);
  const category = text(body.category);
  if (!nameAr) return c.json({ success: false, error: 'name_ar is required' }, 400);
  // skills.category has no CHECK in D1, so any non-empty label is accepted
  // rather than inventing a whitelist the schema does not have.
  if (!category) return c.json({ success: false, error: 'category is required' }, 400);

  const description = body.description === undefined ? null : nullableText(body.description);
  if (description === undefined) return c.json({ success: false, error: 'description must be text or null' }, 400);

  const db = c.env.DB;
  const id = text(body.id) ?? crypto.randomUUID();
  try {
    await db.batch([
      db.prepare('INSERT INTO skills (id, name_ar, category, description) VALUES (?, ?, ?, ?)')
        .bind(id, nameAr, category, description),
      audit(db, c, 'create', 'skill', id, { name_ar: nameAr, category }),
    ]);
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'A skill with this id already exists' }, 409);
    throw error;
  }
  return c.json({ success: true, data: { id, name_ar: nameAr, category } }, 201);
});

route.patch('/skills/:id', requirePermission('edit_metadata'), async (c) => {
  const body = await readBody(c);
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const db = c.env.DB;
  const id = pathParam(c, 'id');
  if (!await queryFirst(db, 'SELECT id FROM skills WHERE id = ?', [id])) {
    return c.json({ success: false, error: 'Skill not found' }, 404);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value); };

  for (const field of ['name_ar', 'category']) {
    if (body[field] === undefined) continue;
    const value = text(body[field]);
    if (!value) return c.json({ success: false, error: `${field} cannot be empty` }, 400);
    add(field, value);
  }
  if (body.description !== undefined) {
    const value = nullableText(body.description);
    if (value === undefined) return c.json({ success: false, error: 'description must be text or null' }, 400);
    add('description', value);
  }
  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400);

  try {
    await db.batch([
      db.prepare(`UPDATE skills SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(db, c, 'update', 'skill', id, body),
    ]);
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Skill values conflict with existing data' }, 409);
    throw error;
  }
  return c.json({ success: true, data: { id, updated: true } });
});

route.delete('/skills/:id', requirePermission('archive'), async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  if (!await queryFirst(db, 'SELECT id FROM skills WHERE id = ?', [id])) {
    return c.json({ success: false, error: 'Skill not found' }, 404);
  }
  // The FK is ON DELETE SET NULL on learning_objectives.skill_id and
  // ON DELETE CASCADE on learning_objective_skills, so deleting a used skill
  // would strip it from every objective that references it — including
  // objectives that name it only as a *secondary* skill, which the cascade
  // would remove without trace. Both roles are counted here for that reason.
  const usage = await queryFirst<{ total: number }>(db, `
    SELECT (
      (SELECT COUNT(*) FROM learning_objectives WHERE skill_id = ?)
      + (SELECT COUNT(*) FROM learning_objective_skills
           WHERE skill_id = ? AND objective_id NOT IN (SELECT id FROM learning_objectives WHERE skill_id = ?))
    ) AS total
  `, [id, id, id]);
  if (Number(usage?.total ?? 0) > 0) {
    return c.json({ success: false, error: `Skill is used by ${usage?.total} learning objective(s). Reassign them first.` }, 409);
  }

  await db.batch([
    db.prepare('DELETE FROM skills WHERE id = ?').bind(id),
    audit(db, c, 'delete', 'skill', id, {}),
  ]);
  return c.json({ success: true, data: { id, deleted: true } });
});

// Learning objectives --------------------------------------------------------

function serializeObjective(row: Row) {
  // `secondary_skill_ids` arrives as a GROUP_CONCAT so the list endpoint stays a
  // single query instead of one extra round trip per objective.
  const secondary = typeof row.secondary_skill_ids === 'string' && row.secondary_skill_ids
    ? row.secondary_skill_ids.split(',').filter(Boolean).sort()
    : [];
  const { secondary_skill_ids: _raw, ...rest } = row;
  return {
    ...rest,
    track_ids: splitTracks(row.track_ids),
    // `skill_id` is left untouched for existing consumers; these are additive.
    primary_skill_id: typeof row.skill_id === 'string' ? row.skill_id : null,
    secondary_skill_ids: secondary,
  };
}

/// The primary and secondary skills for one objective, with display fields.
async function objectiveSkillRows(db: D1Database, id: string): Promise<ObjectiveSkillRow[]> {
  return queryAll<ObjectiveSkillRow>(db, `
    SELECT los.skill_id, los.role, sk.name_ar, sk.category
    FROM learning_objective_skills los
    LEFT JOIN skills sk ON sk.id = los.skill_id
    WHERE los.objective_id = ?
    ORDER BY los.role DESC, los.skill_id
  `, [id]);
}

/// Replaces an objective's skill rows so the join table matches the `skill_id`
/// column exactly. Returns statements rather than executing, so the caller can
/// batch them with the objective write and the audit row in one transaction.
function objectiveSkillStatements(db: D1Database, id: string, payload: { primary: string | null; secondary: string[] }) {
  return [
    db.prepare('DELETE FROM learning_objective_skills WHERE objective_id = ?').bind(id),
    ...objectiveSkillWrites(payload).map((row) => db
      .prepare('INSERT INTO learning_objective_skills (objective_id, skill_id, role) VALUES (?, ?, ?)')
      .bind(id, row.skill_id, row.role)),
  ];
}

/// Confirms every referenced skill exists before the write, so a bad id fails
/// with 400 rather than a foreign-key error surfacing as a 500.
async function missingSkillId(db: D1Database, payload: { primary: string | null; secondary: string[] }): Promise<string | null> {
  for (const skillId of referencedSkillIds(payload)) {
    if (!await queryFirst(db, 'SELECT id FROM skills WHERE id = ?', [skillId])) return skillId;
  }
  return null;
}

/// Rows that would be left pointing at nothing, or silently stripped by an
/// ON DELETE SET NULL, if the objective were removed. Projects store objective
/// ids inside a JSON array, which no foreign key can protect.
async function objectiveUsage(db: D1Database, id: string) {
  const row = await queryFirst<{ episodes: number; games: number; published_episodes: number; published_games: number }>(db, `
    SELECT
      (SELECT COUNT(*) FROM episodes WHERE learning_objective_id = ?) AS episodes,
      (SELECT COUNT(*) FROM games WHERE learning_objective_id = ?) AS games,
      (SELECT COUNT(*) FROM episodes WHERE learning_objective_id = ? AND status = 'published') AS published_episodes,
      (SELECT COUNT(*) FROM games WHERE learning_objective_id = ? AND status = 'published') AS published_games
  `, [id, id, id, id]);
  const projects = await queryAll<{ id: string; status: string }>(db, `
    SELECT id, status FROM projects
    WHERE EXISTS (SELECT 1 FROM json_each(projects.learning_objective_ids) WHERE json_each.value = ?)
  `, [id]);
  return {
    episodes: Number(row?.episodes ?? 0),
    games: Number(row?.games ?? 0),
    publishedEpisodes: Number(row?.published_episodes ?? 0),
    publishedGames: Number(row?.published_games ?? 0),
    projects: projects.length,
    publishedProjects: projects.filter((project) => project.status === 'published').length,
  };
}

route.get('/learning-objectives', async (c) => {
  const db = c.env.DB;
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'));
  const query = c.req.query('q')?.trim();
  const track = c.req.query('track');
  const skillId = c.req.query('skill_id');

  if (track && !TRACKS.includes(track as AgeTrack)) {
    return c.json({ success: false, error: enumError('track', track, TRACKS) }, 400);
  }

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (query) {
    clauses.push('(lo.code LIKE ? OR lo.title_ar LIKE ? OR lo.description_ar LIKE ?)');
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }
  if (track) {
    clauses.push('EXISTS (SELECT 1 FROM learning_objective_tracks lt WHERE lt.objective_id = lo.id AND lt.track_id = ?)');
    params.push(track);
  }
  if (skillId) {
    // Matches the primary or a secondary skill. Before migration 0022 an
    // objective had one skill, so filtering on `lo.skill_id` alone was
    // complete; now a fine-motor filter must also surface letter tracing,
    // whose primary is `writing`.
    clauses.push(`(lo.skill_id = ? OR EXISTS (
      SELECT 1 FROM learning_objective_skills los
      WHERE los.objective_id = lo.id AND los.skill_id = ?
    ))`);
    params.push(skillId, skillId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const totalRow = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM learning_objectives lo ${where}`, params);
  const rows = await queryAll<Row>(db, `
    SELECT lo.*, sk.name_ar AS skill_name, sk.category AS skill_category,
      (SELECT GROUP_CONCAT(track_id) FROM learning_objective_tracks WHERE objective_id = lo.id) AS track_ids,
      (SELECT GROUP_CONCAT(skill_id) FROM learning_objective_skills
        WHERE objective_id = lo.id AND role = 'secondary') AS secondary_skill_ids,
      (SELECT COUNT(*) FROM episodes e WHERE e.learning_objective_id = lo.id) AS episodes_count,
      (SELECT COUNT(*) FROM games g WHERE g.learning_objective_id = lo.id) AS games_count
    FROM learning_objectives lo
    LEFT JOIN skills sk ON sk.id = lo.skill_id
    ${where}
    ORDER BY lo.code
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return c.json({
    success: true,
    data: rows.map(serializeObjective),
    meta: { total: Number(totalRow?.total ?? 0), limit, offset },
  });
});

route.get('/learning-objectives/:id', async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const row = await queryFirst<Row>(db, `
    SELECT lo.*, sk.name_ar AS skill_name, sk.category AS skill_category,
      (SELECT GROUP_CONCAT(track_id) FROM learning_objective_tracks WHERE objective_id = lo.id) AS track_ids
    FROM learning_objectives lo
    LEFT JOIN skills sk ON sk.id = lo.skill_id
    WHERE lo.id = ?
  `, [id]);
  if (!row) return c.json({ success: false, error: 'Learning objective not found' }, 404);

  const usage = await objectiveUsage(db, id);
  const skills = serializeObjectiveSkills(await objectiveSkillRows(db, id));
  return c.json({ success: true, data: { ...serializeObjective(row), ...skills, usage } });
});

route.post('/learning-objectives', requirePermission('create'), async (c) => {
  const body = await readBody(c);
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const parsed = objectiveCreatePayload(body);
  if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400);
  const payload = parsed.payload;

  const db = c.env.DB;
  const skillsParsed = parseObjectiveSkills(payload.skillId, body.secondary_skill_ids);
  if ('error' in skillsParsed) return c.json({ success: false, error: skillsParsed.error }, 400);
  const missing = await missingSkillId(db, skillsParsed.payload);
  if (missing) return c.json({ success: false, error: `Skill not found: ${missing}` }, 400);

  const id = text(body.id) ?? crypto.randomUUID();
  const statements = [
    db.prepare(`
      INSERT INTO learning_objectives (id, code, title_ar, description_ar, skill_id, age_min, age_max, measurable_criteria)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, payload.code, payload.titleAr, payload.descriptionAr, payload.skillId, payload.ageMin, payload.ageMax, payload.measurableCriteria),
    ...payload.tracks.map((track) => db.prepare('INSERT INTO learning_objective_tracks (objective_id, track_id) VALUES (?, ?)').bind(id, track)),
    ...objectiveSkillStatements(db, id, skillsParsed.payload),
    audit(db, c, 'create', 'learning_objective', id, {
      code: payload.code,
      title_ar: payload.titleAr,
      track_ids: payload.tracks,
      primary_skill_id: skillsParsed.payload.primary,
      secondary_skill_ids: skillsParsed.payload.secondary,
    }),
  ];

  try {
    await db.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) {
      return c.json({ success: false, error: 'A learning objective with this code already exists' }, 409);
    }
    throw error;
  }
  return c.json({ success: true, data: { id, code: payload.code, track_ids: payload.tracks } }, 201);
});

route.patch('/learning-objectives/:id', requirePermission('edit_metadata'), async (c) => {
  const body = await readBody(c);
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const existing = await queryFirst<Row>(db, 'SELECT * FROM learning_objectives WHERE id = ?', [id]);
  if (!existing) return c.json({ success: false, error: 'Learning objective not found' }, 404);

  const ageMin = body.age_min === undefined ? Number(existing.age_min) : integer(body.age_min);
  const ageMax = body.age_max === undefined ? Number(existing.age_max) : integer(body.age_max);
  const rangeError = ageRangeError(ageMin, ageMax);
  if (rangeError) return c.json({ success: false, error: rangeError }, 400);

  const ageChanged = body.age_min !== undefined || body.age_max !== undefined;
  const updateTracks = body.track_ids !== undefined || ageChanged;
  const tracks = updateTracks ? normalizeTracks(body.track_ids, ageMin as number, ageMax as number) : null;
  if (updateTracks && !tracks) return c.json({ success: false, error: 'track_ids do not match the age range' }, 400);

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value); };

  for (const field of ['code', 'title_ar']) {
    if (body[field] === undefined) continue;
    const value = text(body[field]);
    if (!value) return c.json({ success: false, error: `${field} cannot be empty` }, 400);
    add(field, value);
  }
  for (const field of ['description_ar', 'measurable_criteria', 'skill_id']) {
    if (body[field] === undefined) continue;
    const value = nullableText(body[field]);
    if (value === undefined) return c.json({ success: false, error: `${field} must be text or null` }, 400);
    if (field === 'skill_id' && value && !await queryFirst(db, 'SELECT id FROM skills WHERE id = ?', [value])) {
      return c.json({ success: false, error: 'Skill not found' }, 400);
    }
    add(field, value);
  }
  if (body.age_min !== undefined) add('age_min', ageMin);
  if (body.age_max !== undefined) add('age_max', ageMax);

  // Skill rows are rebuilt whenever either side of the relationship moves, so
  // `skill_id` and `learning_objective_skills` can never disagree about which
  // skill is primary. Untouched requests leave both alone.
  const updateSkills = body.skill_id !== undefined || body.secondary_skill_ids !== undefined;
  let skillsPayload: { primary: string | null; secondary: string[] } | null = null;
  if (updateSkills) {
    const effectivePrimary = body.skill_id !== undefined
      ? nullableText(body.skill_id)
      : (typeof existing.skill_id === 'string' ? existing.skill_id : null);
    const effectiveSecondary = body.secondary_skill_ids !== undefined
      ? body.secondary_skill_ids
      : (await objectiveSkillRows(db, id)).filter((r) => r.role === 'secondary').map((r) => r.skill_id);

    const parsedSkills = parseObjectiveSkills(effectivePrimary ?? null, effectiveSecondary);
    if ('error' in parsedSkills) return c.json({ success: false, error: parsedSkills.error }, 400);
    const missing = await missingSkillId(db, parsedSkills.payload);
    if (missing) return c.json({ success: false, error: `Skill not found: ${missing}` }, 400);
    skillsPayload = parsedSkills.payload;
  }

  if (!sets.length && !updateTracks && !updateSkills) return c.json({ success: false, error: 'No supported fields supplied' }, 400);

  const statements: D1PreparedStatement[] = [];
  if (sets.length) {
    statements.push(db.prepare(`UPDATE learning_objectives SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id));
  }
  if (tracks) {
    statements.push(db.prepare('DELETE FROM learning_objective_tracks WHERE objective_id = ?').bind(id));
    statements.push(...tracks.map((track) => db.prepare('INSERT INTO learning_objective_tracks (objective_id, track_id) VALUES (?, ?)').bind(id, track)));
  }
  if (skillsPayload) {
    statements.push(...objectiveSkillStatements(db, id, skillsPayload));
  }
  statements.push(audit(db, c, 'update', 'learning_objective', id, body));

  try {
    await db.batch(statements);
  } catch (error) {
    if (isConstraintError(error)) {
      return c.json({ success: false, error: 'Learning objective values conflict with existing data' }, 409);
    }
    throw error;
  }
  return c.json({ success: true, data: { id, updated: true, track_ids: tracks ?? undefined } });
});

route.delete('/learning-objectives/:id', requirePermission('archive'), async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  if (!await queryFirst(db, 'SELECT id FROM learning_objectives WHERE id = ?', [id])) {
    return c.json({ success: false, error: 'Learning objective not found' }, 404);
  }

  const usage = await objectiveUsage(db, id);
  if (usage.publishedEpisodes || usage.publishedGames || usage.publishedProjects) {
    return c.json({
      success: false,
      error: 'Learning objective is referenced by published content and cannot be deleted',
      data: usage,
    }, 409);
  }
  if (usage.episodes || usage.games || usage.projects) {
    return c.json({
      success: false,
      error: `Learning objective is referenced by ${usage.episodes} episode(s), ${usage.games} game(s) and ${usage.projects} project(s). Detach them first.`,
      data: usage,
    }, 409);
  }

  // learning_objective_tracks is ON DELETE CASCADE, so the track rows go with it.
  await db.batch([
    db.prepare('DELETE FROM learning_objectives WHERE id = ?').bind(id),
    audit(db, c, 'delete', 'learning_objective', id, {}),
  ]);
  return c.json({ success: true, data: { id, deleted: true } });
});

/// Recomputes the track rows from the stored age range. Useful after a bulk SQL
/// import left objectives without tracks - 116 objectives were loaded that way.
route.post('/learning-objectives/:id/tracks/rederive', requirePermission('edit_metadata'), async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const existing = await queryFirst<{ age_min: number; age_max: number }>(db, 'SELECT age_min, age_max FROM learning_objectives WHERE id = ?', [id]);
  if (!existing) return c.json({ success: false, error: 'Learning objective not found' }, 404);

  const tracks = tracksForRange(Number(existing.age_min), Number(existing.age_max));
  await db.batch([
    db.prepare('DELETE FROM learning_objective_tracks WHERE objective_id = ?').bind(id),
    ...tracks.map((track) => db.prepare('INSERT INTO learning_objective_tracks (objective_id, track_id) VALUES (?, ?)').bind(id, track)),
    audit(db, c, 'rederive_tracks', 'learning_objective', id, { track_ids: tracks }),
  ]);
  return c.json({ success: true, data: { id, track_ids: tracks } });
});

// Content reviews ------------------------------------------------------------

route.get('/content-reviews', async (c) => {
  const db = c.env.DB;
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'));
  const entityType = c.req.query('entity_type');
  const entityId = c.req.query('entity_id');
  const status = c.req.query('status');
  const reviewerRole = c.req.query('reviewer_role');

  if (entityType) {
    const invalid = enumError('entity_type', entityType, REVIEW_ENTITY_TYPES);
    if (invalid) return c.json({ success: false, error: invalid }, 400);
  }
  if (status && status !== 'all') {
    const invalid = enumError('status', status, REVIEW_STATUSES);
    if (invalid) return c.json({ success: false, error: invalid }, 400);
  }
  if (reviewerRole) {
    const invalid = enumError('reviewer_role', reviewerRole, REVIEWER_ROLES);
    if (invalid) return c.json({ success: false, error: invalid }, 400);
  }

  const clauses: string[] = [];
  const params: unknown[] = [];
  if (entityType) { clauses.push('entity_type = ?'); params.push(entityType); }
  if (entityId) { clauses.push('entity_id = ?'); params.push(entityId); }
  if (status && status !== 'all') { clauses.push('status = ?'); params.push(status); }
  if (reviewerRole) { clauses.push('reviewer_role = ?'); params.push(reviewerRole); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const totalRow = await queryFirst<{ total: number }>(db, `SELECT COUNT(*) AS total FROM content_reviews ${where}`, params);
  const rows = await queryAll<Row>(db, `
    SELECT * FROM content_reviews ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limit, offset]);

  return c.json({ success: true, data: rows, meta: { total: Number(totalRow?.total ?? 0), limit, offset } });
});

route.get('/content-reviews/:id', async (c) => {
  const row = await queryFirst<Row>(c.env.DB, 'SELECT * FROM content_reviews WHERE id = ?', [pathParam(c, 'id')]);
  if (!row) return c.json({ success: false, error: 'Content review not found' }, 404);
  return c.json({ success: true, data: row });
});

route.post('/content-reviews', requirePermission('review'), async (c) => {
  const body = await readBody(c);
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const parsed = reviewCreatePayload(body);
  if ('error' in parsed) return c.json({ success: false, error: parsed.error }, 400);
  const payload = parsed.payload;

  const db = c.env.DB;
  // entity_id has no foreign key, so a typo would otherwise create a review
  // attached to nothing.
  const table = REVIEW_ENTITY_TABLES[payload.entityType];
  if (!await queryFirst(db, `SELECT id FROM ${table} WHERE id = ?`, [payload.entityId])) {
    return c.json({ success: false, error: `${payload.entityType} not found: ${payload.entityId}` }, 400);
  }

  // فصل الإنشاء عن الاعتماد (القسم 9 من خطة الصلاحيات).
  //
  // هوية المُعتمِد من الجلسة لا من جسم الطلب: `payload.reviewerId` يأتي من
  // المتصل، فالاعتماد عليه يسمح للمراجع بنسبة اعتماده إلى غيره وتجاوز القاعدة.
  if (isApproval(payload.status)) {
    const separation = await checkSelfApproval(db, {
      entityType: payload.entityType,
      entityId: payload.entityId,
      approverId: actorId(c),
    });
    if (!separation.ok) {
      return c.json({ success: false, error: SELF_APPROVAL_ERROR }, 409);
    }
  }

  const id = crypto.randomUUID();
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO content_reviews (id, entity_type, entity_id, reviewer_role, reviewer_id, status, comments)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, payload.entityType, payload.entityId, payload.reviewerRole, actorId(c), payload.status, payload.comments),
      audit(db, c, 'create', 'content_review', id, {
        entity_type: payload.entityType,
        entity_id: payload.entityId,
        reviewer_role: payload.reviewerRole,
        status: payload.status,
      }),
    ]);
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Review values conflict with existing data' }, 409);
    throw error;
  }
  return c.json({ success: true, data: { id, status: payload.status } }, 201);
});

route.patch('/content-reviews/:id', requirePermission('review'), async (c) => {
  const body = await readBody(c);
  if (!body) return c.json({ success: false, error: 'A JSON object is required' }, 400);

  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const existing = await queryFirst<Row>(db, 'SELECT * FROM content_reviews WHERE id = ?', [id]);
  if (!existing) return c.json({ success: false, error: 'Content review not found' }, 404);
  if (existing.status === 'approved') {
    return c.json({ success: false, error: 'Approved review decisions are immutable' }, 409);
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, value: unknown) => { sets.push(`${column} = ?`); params.push(value); };

  const finalStatus = body.status === undefined ? String(existing.status) : text(body.status);
  if (body.status !== undefined) {
    const invalid = enumError('status', body.status, REVIEW_STATUSES);
    if (invalid) return c.json({ success: false, error: invalid }, 400);
    add('status', finalStatus);
  }
  if (body.reviewer_role !== undefined) {
    const invalid = enumError('reviewer_role', body.reviewer_role, REVIEWER_ROLES);
    if (invalid) return c.json({ success: false, error: invalid }, 400);
    add('reviewer_role', text(body.reviewer_role));
  }
  if (body.reviewer_id !== undefined) {
    return c.json({ success: false, error: 'reviewer_id is assigned from the authenticated session' }, 400);
  }
  if (body.comments !== undefined) {
    const value = nullableText(body.comments);
    if (value === undefined) return c.json({ success: false, error: 'comments must be text or null' }, 400);
    add('comments', value);
  }

  const finalComments = body.comments === undefined
    ? (existing.comments == null ? null : String(existing.comments))
    : nullableText(body.comments) ?? null;
  if ((finalStatus === 'rejected' || finalStatus === 'needs_changes') && !finalComments) {
    return c.json({ success: false, error: 'comments are required when a review is rejected or needs changes' }, 400);
  }
  if (isApproval(finalStatus)) {
    const separation = await checkSelfApproval(db, {
      entityType: String(existing.entity_type),
      entityId: String(existing.entity_id),
      approverId: actorId(c),
    });
    if (!separation.ok) {
      return c.json({ success: false, error: SELF_APPROVAL_ERROR }, 409);
    }
    add('reviewer_id', actorId(c));
  }

  if (!sets.length) return c.json({ success: false, error: 'No supported fields supplied' }, 400);

  try {
    await db.batch([
      db.prepare(`UPDATE content_reviews SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
      audit(db, c, 'update', 'content_review', id, body),
    ]);
  } catch (error) {
    if (isConstraintError(error)) return c.json({ success: false, error: 'Review values conflict with existing data' }, 409);
    throw error;
  }
  return c.json({ success: true, data: { id, updated: true, status: finalStatus } });
});

route.delete('/content-reviews/:id', requirePermission('review'), async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const existing = await queryFirst<Row>(db, 'SELECT status FROM content_reviews WHERE id = ?', [id]);
  if (!existing) {
    return c.json({ success: false, error: 'Content review not found' }, 404);
  }
  if (existing.status === 'approved') {
    return c.json({ success: false, error: 'Approved review decisions are immutable' }, 409);
  }
  await db.batch([
    db.prepare('DELETE FROM content_reviews WHERE id = ?').bind(id),
    audit(db, c, 'delete', 'content_review', id, {}),
  ]);
  return c.json({ success: true, data: { id, deleted: true } });
});

// Story pages ----------------------------------------------------------------
// Creating, patching, deleting a page and setting its per-language text already
// live in routes/adminContent.ts. The read side did not exist: an editor could
// only fetch pages by loading the entire story.

route.get('/stories/:id/pages', async (c) => {
  const db = c.env.DB;
  const storyId = pathParam(c, 'id');
  if (!await queryFirst(db, 'SELECT id FROM stories WHERE id = ?', [storyId])) {
    return c.json({ success: false, error: 'Story not found' }, 404);
  }
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'));

  const totalRow = await queryFirst<{ total: number }>(db, 'SELECT COUNT(*) AS total FROM story_pages WHERE story_id = ?', [storyId]);
  const pages = await queryAll<Row>(db, `
    SELECT * FROM story_pages WHERE story_id = ?
    ORDER BY page_number
    LIMIT ? OFFSET ?
  `, [storyId, limit, offset]);

  const pageIds = pages.map((page) => String(page.id));
  const placeholders = pageIds.map(() => '?').join(',');
  const [localizations, bubbles] = pageIds.length
    ? await Promise.all([
      queryAll<Row>(db, `SELECT * FROM story_page_localizations WHERE page_id IN (${placeholders}) ORDER BY language`, pageIds),
      queryAll<Row>(db, `SELECT * FROM story_bubbles WHERE page_id IN (${placeholders}) ORDER BY sort_order`, pageIds),
    ])
    : [[], []];

  const data = pages.map((page) => ({
    ...page,
    localizations: localizations
      .filter((item) => item.page_id === page.id)
      .map((item) => ({ ...item, timing_cues: parseJson(item.timing_cues, []) })),
    bubbles: bubbles
      .filter((item) => item.page_id === page.id)
      .map((item) => ({
        ...item,
        localized_text: parseJson(item.localized_text, {}),
        audio_tracks: parseJson(item.audio_tracks, {}),
      })),
  }));

  return c.json({ success: true, data, meta: { total: Number(totalRow?.total ?? 0), limit, offset } });
});

route.get('/story-pages/:id', async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const page = await queryFirst<Row>(db, `
    SELECT sp.*, st.title_ar AS story_title, st.default_language
    FROM story_pages sp
    JOIN stories st ON st.id = sp.story_id
    WHERE sp.id = ?
  `, [id]);
  if (!page) return c.json({ success: false, error: 'Story page not found' }, 404);

  const [localizations, bubbles] = await Promise.all([
    queryAll<Row>(db, 'SELECT * FROM story_page_localizations WHERE page_id = ? ORDER BY language', [id]),
    queryAll<Row>(db, 'SELECT * FROM story_bubbles WHERE page_id = ? ORDER BY sort_order', [id]),
  ]);

  return c.json({
    success: true,
    data: {
      ...page,
      localizations: localizations.map((item) => ({ ...item, timing_cues: parseJson(item.timing_cues, []) })),
      bubbles: bubbles.map((item) => ({
        ...item,
        localized_text: parseJson(item.localized_text, {}),
        audio_tracks: parseJson(item.audio_tracks, {}),
      })),
    },
  });
});

/// Deletes one language of page text. The PUT upsert in adminContent.ts can
/// blank body_text but leaves the localization row behind, which keeps a stale
/// language in the story's language list.
route.delete('/story-pages/:id/localizations/:language', requirePermission('edit_text'), async (c) => {
  const db = c.env.DB;
  const pageId = pathParam(c, 'id');
  const language = pathParam(c, 'language');
  if (!isValidLanguage(language)) return c.json({ success: false, error: 'Invalid language code' }, 400);

  const page = await queryFirst<{ story_id: string }>(db, 'SELECT story_id FROM story_pages WHERE id = ?', [pageId]);
  if (!page) return c.json({ success: false, error: 'Story page not found' }, 404);
  const existing = await queryFirst(db, 'SELECT page_id FROM story_page_localizations WHERE page_id = ? AND language = ?', [pageId, language]);
  if (!existing) return c.json({ success: false, error: 'Localization not found' }, 404);

  // Removing the default language of a published story would strip its text.
  const story = await queryFirst<{ status: string; default_language: string }>(db, 'SELECT status, default_language FROM stories WHERE id = ?', [page.story_id]);
  if (story && story.status === 'published' && story.default_language === language) {
    return c.json({ success: false, error: 'Cannot remove the default language text of a published story' }, 409);
  }

  await db.batch([
    db.prepare('DELETE FROM story_page_localizations WHERE page_id = ? AND language = ?').bind(pageId, language),
    audit(db, c, 'delete_localization', 'story_page', pageId, { language }),
  ]);
  return c.json({ success: true, data: { page_id: pageId, language, deleted: true } });
});

/// Hard delete. DELETE /stories/:id in adminContent.ts archives the row, which
/// is the right default; this endpoint is the escape hatch for genuinely
/// discarding a draft. It removes bubbles, localizations and pages explicitly
/// rather than relying on ON DELETE CASCADE, because D1 does not enable
/// foreign_keys on every connection.
route.delete('/stories/:id/purge', requirePermission('delete_draft'), async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const story = await queryFirst<{ id: string; status: string; slug: string }>(db, 'SELECT id, status, slug FROM stories WHERE id = ?', [id]);
  if (!story) return c.json({ success: false, error: 'Story not found' }, 404);
  if (story.status === 'published') {
    return c.json({ success: false, error: 'A published story cannot be purged. Archive it first.' }, 409);
  }

  const counts = await queryFirst<{ pages: number; localizations: number; bubbles: number }>(db, `
    SELECT
      (SELECT COUNT(*) FROM story_pages WHERE story_id = ?) AS pages,
      (SELECT COUNT(*) FROM story_page_localizations WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)) AS localizations,
      (SELECT COUNT(*) FROM story_bubbles WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)) AS bubbles
  `, [id, id, id]);

  await db.batch([
    db.prepare('DELETE FROM story_bubbles WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)').bind(id),
    db.prepare('DELETE FROM story_page_localizations WHERE page_id IN (SELECT id FROM story_pages WHERE story_id = ?)').bind(id),
    db.prepare('DELETE FROM story_pages WHERE story_id = ?').bind(id),
    db.prepare('DELETE FROM stories WHERE id = ?').bind(id),
    audit(db, c, 'purge', 'story', id, { slug: story.slug, cascaded: counts }),
  ]);

  return c.json({ success: true, data: { id, deleted: true, cascaded: counts } });
});

// Seasons and characters: get-by-id -----------------------------------------
// List, create, patch and delete already exist in routes/adminContent.ts.

route.get('/seasons/:id', async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const row = await queryFirst<Row>(db, `
    SELECT se.*, s.title_ar AS series_title
    FROM seasons se
    JOIN series s ON s.id = se.series_id
    WHERE se.id = ?
  `, [id]);
  if (!row) return c.json({ success: false, error: 'Season not found' }, 404);

  const episodes = await queryAll<Row>(db, `
    SELECT id, episode_number, title_ar, status, is_published
    FROM episodes WHERE season_id = ?
    ORDER BY episode_number
  `, [id]);

  return c.json({
    success: true,
    data: { ...row, learning_goals: parseJson(row.learning_goals, []), episodes },
  });
});

route.get('/characters/:id', async (c) => {
  const db = c.env.DB;
  const id = pathParam(c, 'id');
  const row = await queryFirst<Row>(db, `
    SELECT ch.*, s.title_ar AS series_title
    FROM characters ch
    JOIN series s ON s.id = ch.series_id
    WHERE ch.id = ?
  `, [id]);
  if (!row) return c.json({ success: false, error: 'Character not found' }, 404);

  const bubbles = await queryFirst<{ total: number }>(db, 'SELECT COUNT(*) AS total FROM story_bubbles WHERE character_id = ?', [id]);

  return c.json({
    success: true,
    data: {
      ...row,
      role: row.role === null ? null : String(row.role),
      traits: parseJson(row.traits, []),
      reference_images: parseJson(row.reference_images, []),
      expressions: parseJson(row.expressions, {}),
      outfits: parseJson(row.outfits, []),
      languages: parseJson(row.languages, []),
      bubbles_count: Number(bubbles?.total ?? 0),
      allowed_roles: CHARACTER_ROLES,
    },
  });
});

export default route;
