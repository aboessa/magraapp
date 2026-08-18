import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryAll, queryFirst } from '../lib/db.ts';
import { authenticateParent } from '../lib/parentAuth.ts';

type AppEnv = { Bindings: Env };
const route = new Hono<AppEnv>();

// GET /api/v1/recommendations?child_id= — rule-based + editorial
route.get('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return c.json({ success: false, error: 'Unauthorized' }, 401);
  const childId = c.req.query('child_id') ?? '';
  if (!childId) return c.json({ success: false, error: 'child_id required' }, 400);

  // validate child belongs to parent via children_profiles
  const child = await queryFirst(c.env.DB, `SELECT id, age_track FROM children_profiles WHERE id=? AND parent_id=?`, [childId, auth.principal.parentId]);
  if (!child) return c.json({ success: false, error: 'Child not found' }, 404);

  // watch history recent: from FamilyState? we use D1 watch_progress fallback + D1 home_recommendations
  const history = await queryAll<{ series_id: string }>(c.env.DB, `SELECT series_id FROM watch_progress WHERE child_id=? ORDER BY updated_at DESC LIMIT 5`, [childId]);
  const recentSeriesIds = history.map(r => r.series_id);

  // editorial global + pinned
  const editorial = await queryAll<{ series_id: string; reason: string }>(c.env.DB, `SELECT series_id, reason FROM home_recommendations WHERE (child_id=? OR child_id IS NULL) AND is_hidden=0 ORDER BY is_pinned DESC, priority DESC LIMIT 12`, [childId]);

  // rule-based: same planet as recent, age-track match
  let recs: { series_id: string; reason: string }[] = [...editorial];
  if (recentSeriesIds.length) {
    const placeholders = recentSeriesIds.map(() => '?').join(',');
    const planetRows = await queryAll<{ planet_id: string }>(c.env.DB, `SELECT planet_id FROM series WHERE id IN (${placeholders})`, recentSeriesIds);
    const planets = [...new Set(planetRows.map(r => r.planet_id))];
    if (planets.length) {
      const seen = new Set(recs.map(r => r.series_id).concat(recentSeriesIds));
      const pPlace = planets.map(() => '?').join(',');
      const candidates = await queryAll<{ id: string }>(c.env.DB, `SELECT id FROM series WHERE planet_id IN (${pPlace}) AND status='published' ORDER BY sort_order LIMIT 12`, planets);
      for (const cand of candidates) {
        if (!seen.has(cand.id)) { recs.push({ series_id: cand.id, reason: 'similar_planet' }); seen.add(cand.id); }
        if (recs.length >= 12) break;
      }
    }
  }
  // dedup keep first
  const seen = new Set<string>();
  recs = recs.filter(r => { if (seen.has(r.series_id)) return false; seen.add(r.series_id); return true; }).slice(0, 12);
  return c.json({ success: true, data: recs });
});

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
