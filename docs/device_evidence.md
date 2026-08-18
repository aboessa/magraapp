# Device Evidence — Creative Studio (Drawing)

> Captured from widget-level verification (no physical lab available this run).
> For a full physical-device run, attach real screenshots to this file and re-run
> `flutter test` on device (`flutter run -d <device>`).

## Build
- Commit: (current working tree)
- Flutter: 3.35.x / Dart 3.9
- `pubspec.lock`: `flutter_svg 2.3.0`, `vector_graphics 1.2.x` (see `flutter pub get`)
- D1 ledger: 64 migrations (0061/0062 creative registry), `No migrations to apply` local+remote
- API ledger: `dashboard/api` `tsc --noEmit` pass, 1133 pass

## Screens verified (widget / `setSurfaceSize`)

| Flow | Widget / provider | Sizes | Result | Screenshot |
|---|---|---|---|---|
| Creative Studio home | `CreativeStudioPage` → `_CatalogColoringSection` + `_CatalogGenericSection` x7 via providers | 390×844, 768×1024 | No clip, RTL ok, bundled JSON 40/15/4/10/12/12/8/6/30/29 loads, no overflow | `drawing_asset_render_test: phone/tablet` |
| Trace (shape/line/diagonal/zigzag/wave) | `trace_items.json` → `StudioCatalogItem.strokePaths` → `GamePack` | 390×844, 768×1024 | Stroke 0..1 normalized, ≥2 points, `geometric`, `BackgroundAsset` resolves | `creative_studio_e2e: Trace/Letter/Number` |
| Letter (ا/ب/ل/ن, dot 1-point) | `letter_items.json` baa/noon `type:dot` | same | `StrokeKind.dot` enforces 1 point, body-before-dot ordering | same |
| Number (1..10) | `number_items.json` 10 | same | 0..1 coords, each asset `asset-number-*` ready local | same |
| Dots (star→boat2) | `dots_items.json` 12 | same | `ConnectDot` ordered 1..n, `at` 0..1 | `dots packs have ordered dots` |
| Complete (half-sun→robot) 12 | `complete_items.json` | same | `complete_drawing` + `child_taps_done` | `Complete/Copy child_taps_done` |
| Copy (sequence→mixed) 8 | `copy_items.json` | same | same contract | same |
| Prompt (home→alam) 6 | `prompt_items.json` icon prompt | same | Free-draw, no asset required, `prompt_drawing` | `Prompt items exist` |
| Coloring (bird→stars-planets 40) | `coloring_templates.json` regions | same | ≥3 pts, bounds 0..1, area ≥0.0005, `template_asset` ready, `bgHex` preserved | `Coloring packs have regions` + `containsPoint/hitRegionAt` mirror `coloring_regions.dart` |
| Reference (ref-cat→ref-arabesque 30) | `reference_activities.json` + `reference_steps.json` 29 | 390×844 phone / 768×1024 tablet | `ref-cat → قطة` resolves, steps 5 ordered, deep link `ref-cat` vs `cat` both resolve | `Reference deep link` + `Reference steps ordered` |
| Deep link `/studio/coloring/:id` | `ColoringDeepLinkResolver` → `coloringCatalogueAsync` | cold start, cached, no network, malformed, unknown | Known → same template as category tap; unknown/malformed → null deterministic, no wrong fallback | `deep_link_smoke_test` 5 |
| Deep link `/studio/reference/:id` | `ReferenceDeepLinkResolver` → `referenceActivityAsync` | same 5 scenarios | Same | same |
| Deep link `/studio/trace/:id` | `TraceDeepLinkResolver` → `traceItemAsync` (trace+letter+number unified) | same 5 scenarios | `alif` letter, `5` number via unified search | same |
| Re-import idempotency | Provider reload `c1` vs `c2` | — | Stable IDs 40/40, packId identical (`deep_link IDs stable`) | `deep_link stable` |

## RTL / Safe area / Touch
- RTL: `Directionality(textDirection: rtl)` with `DrawingAsset` retains size>0, no clip.
- Safe area: `CreativeStudioPage` `SingleChildScrollView` + `SafeArea` bottom save button + `AppBar` titles.
- Touch: `trace_geometry` `tolerance_dp` / `coverage_required` = 24/0.8 (trace) vs 40/0.6 simplified; Dots hit via `min_touch_target_dp` 48 — verified via `effectiveTouchTarget` unit vs widget size 48+.

## Offline / Cache
- Offline cold start: bundled JSON in `assets/data/` (10 files committed) loads before network; `SharedPreferences` cache (`majarra.creative.coloring/reference`) is secondary (primary still bundled, `fallbackActivations` counts if ever empty).
- No-network packaged JSON: `traceItemAsync('line-h')` resolves offline (proved in `deep_link_smoke_test`).

## How to reproduce on hardware
```bash
flutter run -d <android_phone> --dart-define=FLAVOR=dev
flutter run -d <iphone>       # if iOS target
# Open Studio → each section → select item → interact → save → reopen → deep link
# flutter test test/creative_studio_e2e_test.dart -d <device>  # widget sizes already 390×844 / 768×1024
```

## Known visual debt (not blocking)
- Coloring polygons: rectangular approximations (`[0.2,0.3]→[0.8,0.7]`) — see `docs/creative_source_of_truth.md` Phase 13. Editor at `/admin/creative-studio/authoring` (DrawingAuthoringPage) now visual with `containsPoint` preview matching runtime.
- Islamic/Sharia review: `game-letter-tracing` draft, `linguistic` gate honest.

## Hash / version at capture
- `assets/data/*.json`: 10 committed, `git diff --stat -- assets/data/` == 0 expected after re-export
- `d1_migrations`: 64 rows (0061 hardening + 0062 publish)
- `drawing_asset_map`: 124 ids, 122 SVGs, 2 intentional dupes, `flutter_svg 2.3.0` direct dep
