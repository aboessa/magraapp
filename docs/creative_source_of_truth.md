# Creative Drawing — Source of Truth

> Authoritative path for every creative asset/activity from authoring to device.
> The bundled JSON is a bootstrap cache, not a second database.

## Flow

```
editor (Admin / DrawingAuthoringPage)
  → validate (lib/coloringPolygon.ts == engine/coloring_regions.dart)
  → catalogue JSON (assets/data/*.json — committed)
  → D1 registry (migrations 0061/0062: content_assets + asset_links + games + reference_activities)
  → API (GET /api/v1/creative/*, GET /api/v1/games/:id)
  → Flutter provider (creative_catalogue_provider.dart — cache → bundled JSON → API)
  → SharedPreferences cache
  → UI (CreativeStudio) / deep link resolver (app_router + creative_deep_links.dart)
```

## Rules

1. **Authoring source = registry.** The D1 rows (`reference_activities`, `content_assets`, `asset_links`, `games`) are the published truth. The JSON files in `assets/data/` are generated from that source (or vice-versa during offline-first bootstrap) but must never diverge silently.
2. **Normalized coordinates are authoritative.** Polygons / stroke paths / dots store `0..1`. Absolute pixels are never stored. The same template works on phone (390×844) and tablet (768×1024) by construction (`engine/coloring_regions.dart` and `lib/coloringPolygon.ts` share `polygonArea` / `containsPoint` / `hitRegionAt`).
3. **Bundled JSON = offline bootstrap.** `assets/data/coloring_templates.json` (40), `trace_items.json` (15), `letter_items.json` (4), `number_items.json` (10), `dots_items.json` (12), `complete_items.json` (12), `copy_items.json` (8), `prompt_items.json` (6), `reference_activities.json` (30), `reference_steps.json` (29) are committed. They are what the app renders on a cold start with no network and no cache. They are not edited by hand independently of D1 — they are re-exported when D1 changes.
4. **Re-import is idempotent.** `asset_links` IDs are `link-{entity}-{role}` and DDL uses `INSERT OR REPLACE` on stable `id`. Re-running migrations does not duplicate rows; `content_assets` status uses `INSERT OR IGNORE` with explicit ready rows only. Catalogue provider IDs are stable across restarts (tested in `deep_link_smoke_test.dart`).
5. **Version/hash when available.** `games.content_pack` carries `pack_version`; `creative_catalogue_provider` can attach `X-Content-Hash` from `GET /api/v1/creative/*` ETags when the archive path is live. Until then, commit hash + `d1_migrations` ledger (62 rows after dwell reconciliation) is the version.
6. **No silent divergence.** `content_integrity_test` (Phase 13) fails CI if JSON and D1 disagree on IDs, required fields, stroke/dot ordering, polygon validity, asset link existence, or published status. `deep_link` tests fail if an ID resolves differently from deep link vs category tap.
7. **Fallback is intentional resilience.** Dart literals in `creative_studio_page.dart` remain as a fallback only when every provider is empty. Normal production loading must not require them; `analytics` should count fallback activations (see Phase 14 telemetry).
