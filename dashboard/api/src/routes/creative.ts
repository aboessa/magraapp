import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';

type AppEnv = { Bindings: Env };
const app = new Hono<AppEnv>();

// Public: list reference activities (published/ready)
app.get('/creative/reference-activities', async (c) => {
  const db = c.env.DB;
  try {
    const rows = await db
      .prepare(
        `SELECT id, slug, title_ar, title_en, category, age_min, age_max, difficulty,
                reference_asset_id, thumbnail_asset_id, supported_modes, status
         FROM reference_activities
         WHERE status IN ('ready','published')
         ORDER BY category, title_ar`
      )
      .all();
    const data = (rows.results as any[]).map((r) => ({
      id: r.id,
      slug: r.slug,
      title_ar: r.title_ar,
      title_en: r.title_en,
      category: r.category,
      age_min: r.age_min,
      age_max: r.age_max,
      age_label: `${r.age_min}-${r.age_max}`,
      difficulty: r.difficulty,
      reference_asset_id: r.reference_asset_id,
      thumbnail_asset_id: r.thumbnail_asset_id,
      supported_modes: JSON.parse(r.supported_modes as string),
      status: r.status,
    }));
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

/// `GET /creative/reference-activities/:id` — single activity with its steps.
///
/// ## No client caller today, and why that is not a defect
///
/// A full search of `app_main/lib` finds only the bulk list
/// (`/creative/reference-activities`, consumed via `fetchReferenceFromApi` in
/// `creative_catalogue_provider.dart`, fixed in Task 13); the per-activity steps
/// shown in `reference_drawing_page.dart` come from the bundled
/// `assets/data/reference_steps.json` asset, not from this route.
///
/// A search of `dashboard/front/src` for `reference-activities` also finds no
/// caller. `CreativeStudioOverviewPage.tsx` and `ReferenceDrawingDetailPage.tsx`
/// do call a per-id "reference activity" path, but at `/api/admin/reference-
/// activities/:id` — a distinct, admin-prefixed route that does not exist
/// anywhere in `dashboard/api/src` (see `PROJECT_AUDIT_TASKS.md`, "Creative
/// Studio" section). That is a separate, pre-existing bug (dashboard calling a
/// route that was never built) and out of this task's scope; it is not a
/// caller of *this* public, unauthenticated route.
///
/// Kept rather than removed per Requirement 6.5: there is a plausible future
/// product use for a single reference activity with its steps — e.g. opening
/// one coloring activity from a deep link or a share/notification target
/// without fetching the whole catalogue. Removing it now would foreclose that
/// without saving anything, since the handler is small and already correct.
/// Revisit if a deep-link-to-activity feature is scoped; until then this
/// stays undocumented-but-dormant rather than deleted.
app.get('/creative/reference-activities/:id', async (c) => {
  const db = c.env.DB;
  const id = c.req.param('id');
  const row = await db
    .prepare(`SELECT * FROM reference_activities WHERE id = ? LIMIT 1`)
    .bind(id)
    .first();
  if (!row) return c.json({ success: false, error: 'not found' }, 404);
  const steps = await db
    .prepare(`SELECT * FROM reference_steps WHERE activity_id = ? ORDER BY step_order`)
    .bind(id)
    .all();
  return c.json({
    success: true,
    data: {
      ...(row as any),
      supported_modes: JSON.parse((row as any).supported_modes as string),
      steps: steps.results,
    },
  });
});

// Public: list coloring templates (derived from content_assets with coloring role)
// For now, returns ready coloring assets with minimal metadata. Full CMS coloring
// table will replace this when authoring UI ships.
app.get('/creative/coloring', async (c) => {
  const db = c.env.DB;
  try {
    const rows = await db
      .prepare(
        `SELECT id, title_ar, kind, status, expected_width, expected_height
         FROM content_assets
         WHERE id LIKE 'asset-color-%' AND status = 'ready'
         ORDER BY id`
      )
      .all();
    const data = (rows.results as any[]).map((r) => ({
      id: r.id.replace('asset-color-', ''),
      label: r.title_ar,
      assetId: r.id,
      status: r.status,
    }));
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

export default app;
