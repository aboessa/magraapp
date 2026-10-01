import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { authenticateParent } from '../lib/parentAuth.ts';
import { rankSeries, type SeriesSignal } from '../lib/recommendSeries.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

// GET /api/v1/recommendations?child_id= — rule-based + editorial
route.get('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const childId = c.req.query('child_id') ?? '';
  if (!childId) return c.json({ success: false, error: 'child_id required' }, 400);

  // validate child belongs to parent via projection (authoritative) – legacy children_profiles is not maintained
  // API-105: حُذف الرجوع إلى `children_profiles` — جدولٌ صفر صفًّا بلا كاتب، فلا
  // «حساب قديم» ينجو به. والتعليق أدناه يبقى شاهدًا على سبب ذلك.
  const child = await queryFirst(c.env.DB, `SELECT child_id AS id, age_track FROM child_projection WHERE child_id=? AND parent_id=? AND status='active'`, [childId, auth.principal.parentId]);
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404);

  // This endpoint previously read watch_progress (legacy table backed by children_profiles FK)
  // and home_recommendations, and then joined series by planet. The watch_progress read
  // fails with FK mismatch for child_projection-based children (new system), and even
  // when it succeeds the query uses `series_id` column that watch_progress doesn't have.
  // Return editorial picks + age-track-based suggestions – resilient to missing history.
  try {
    // editorial global + pinned (may be empty, that's ok)
    let editorial: { series_id: string; reason: string }[] = [];
    try {
      editorial = await queryAll<{ series_id: string; reason: string }>(c.env.DB, `SELECT series_id, reason FROM home_recommendations WHERE (child_id=? OR child_id IS NULL) AND is_hidden=0 ORDER BY is_pinned DESC, priority DESC LIMIT 12`, [childId]);
    } catch (_) {
      editorial = [];
    }

    let recs: { series_id: string; reason: string }[] = [...editorial];

    // APP-209: personal picks from what this child liked, saved and watched.
    // After the editorial pins (an editor's decision wins), before the age fill.
    if (recs.length < 12) {
      try {
        const personal = await personalPicks(c.env.DB, childId, (child as { age_track?: string }).age_track ?? null);
        const seen = new Set(recs.map((r) => r.series_id));
        for (const pick of personal) {
          if (seen.has(pick.series_id)) continue;
          recs.push({ series_id: pick.series_id, reason: pick.reason });
          seen.add(pick.series_id);
          if (recs.length >= 12) break;
        }
      } catch (error) {
        // Personalisation is an improvement, never a reason for an empty rail.
        console.warn('recommendations_personal_failed', error instanceof Error ? error.message : String(error));
      }
    }

    // If editorial empty or few, supplement by age track
    if (recs.length < 12) {
      try {
        const childRow = await queryFirst<{ age_track: string }>(c.env.DB, `SELECT age_track FROM child_projection WHERE child_id=?`, [childId]);
        if (childRow?.age_track) {
          const ageMin = childRow.age_track === 'preschool' ? 3 : childRow.age_track === 'kids' ? 6 : 9;
          const ageMax = childRow.age_track === 'preschool' ? 5 : childRow.age_track === 'kids' ? 8 : 12;
          const seen = new Set(recs.map(r => r.series_id));
          const candidates = await queryAll<{ id: string }>(c.env.DB, `SELECT id FROM series WHERE status='published' AND age_min <= ? AND age_max >= ? ORDER BY sort_order LIMIT 12`, [ageMax, ageMin]);
          for (const cand of candidates) {
            if (!seen.has(cand.id)) { recs.push({ series_id: cand.id, reason: 'age_track' }); seen.add(cand.id); }
            if (recs.length >= 12) break;
          }
        } else {
          // fallback: any published
          const seen = new Set(recs.map(r => r.series_id));
          const candidates = await queryAll<{ id: string }>(c.env.DB, `SELECT id FROM series WHERE status='published' ORDER BY sort_order LIMIT 12`, []);
          for (const cand of candidates) {
            if (!seen.has(cand.id)) { recs.push({ series_id: cand.id, reason: 'editorial' }); seen.add(cand.id); }
            if (recs.length >= 12) break;
          }
        }
      } catch (_) {
        // ignore
      }
    }

    const seenDedup = new Set<string>();
    recs = recs.filter(r => { if (seenDedup.has(r.series_id)) return false; seenDedup.add(r.series_id); return true; }).slice(0, 12);
    return c.json({ success: true, data: recs });
  } catch (error) {
    console.error('recommendations_error', error instanceof Error ? error.message : String(error));
    // Never surface 500 to browser_client – return empty recommendations instead
    return c.json({ success: true, data: [] });
  }
});

function ageRange(track: string | null): [number, number] | null {
  if (track === 'preschool') return [3, 5];
  if (track === 'kids') return [6, 8];
  if (track === 'junior') return [9, 12];
  return null;
}

/// APP-209: signals from D1 projections (`child_series_signals`, 0101, and
/// `child_watch_time_daily`, 0100), scored by `lib/recommendSeries.ts`.
async function personalPicks(db: D1Database, childId: string, track: string | null) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const [liked, watched, series, categories] = await Promise.all([
    queryAll<{ series_id: string; kind: 'like' | 'save' }>(db,
      `SELECT series_id, kind FROM child_series_signals WHERE child_id = ? AND active = 1`, [childId]),
    queryAll<{ series_id: string; seconds: number }>(db, `
      SELECT e.series_id, SUM(w.watched_seconds) AS seconds
        FROM child_watch_time_daily w
        JOIN episodes e ON e.id = w.content_id AND w.content_type = 'episode'
       WHERE w.child_id = ? AND w.activity_date >= ?
       GROUP BY e.series_id`, [childId, since]),
    queryAll<{ id: string; planet_id: string | null; age_min: number | null; age_max: number | null }>(db,
      `SELECT id, planet_id, age_min, age_max FROM series WHERE status = 'published' ORDER BY sort_order`),
    queryAll<{ series_id: string; category_id: string }>(db, `SELECT series_id, category_id FROM series_categories`),
  ]);
  const signals: SeriesSignal[] = [
    ...liked,
    ...watched.map((w) => ({ series_id: w.series_id, kind: 'watch' as const, minutes: Number(w.seconds) / 60 })),
  ];
  if (signals.length === 0) return [];

  const byId = new Map<string, string[]>();
  for (const row of categories) byId.set(row.series_id, [...(byId.get(row.series_id) ?? []), row.category_id]);
  const facts = series.map((s) => ({ id: s.id, planet_id: s.planet_id, categories: byId.get(s.id) ?? [] }));

  // A liked or saved series may be outside the child's age range now (a saved
  // show from last year); it still says something. Candidates must fit.
  const range = ageRange(track);
  const candidates = facts.filter((_, i) => {
    if (!range) return true;
    const s = series[i];
    return (s.age_min ?? 0) <= range[1] && (s.age_max ?? 99) >= range[0];
  });
  return rankSeries(candidates, signals, facts);
}

// Editorial pinning moved to `routes/adminRecommendations.ts`
// (`POST /api/v1/admin/recommendations`).
//
// It previously lived here as `POST /admin` with no authentication at all — the
// only authorization was a comment. Anything written to `home_recommendations`
// is served to children by the read above, so an anonymous caller could pin
// arbitrary content into every child's home rail. A public router is also
// outside the route-guard sweep, which only inspects `admin*` modules, so the
// hole was invisible to the one test written to catch it.

export default route;
