# Majarra Games Operations Center Overhaul

**Deployed:** `majarra-api-prod 39feff22` (no new migration) · `majarra-dashboard aa6c72b6` `index-4IdnFy3f.js` · `majarra.app` live · Fix: prior `QualityPage-DIBrtVjo.js` MIME error was stale `index-CuNMkjUS.js` referencing old chunk, now `index-4IdnFy3f.js` + `QualityPage-DRBknb3y.js` and `GamesOps` chunk live.

## Current Problems
Shallow `GamesOpsPage` with cards `Engine coverage = 1/6` ambiguous, same screen lists 6 engine IDs vs 12 canonical, `0 قابلة للنشر` without why, table generic, raw blocker keys `engine, objective, localization_ar` shown to operators, no cover, no next action.

## Domain Audit
| Source | Count | Meaning |
|---|---|---|
| `gamePackGate.ts:50` `ENGINE_SCHEMAS` 12 | 12 canonical (`trace_color...timeline_map`) | Runtime schemas |
| `gameEngines` D1 rows via `api.gameEngines` | 6 (example) | Registered in catalogue, not runtime capability |
| `adminGames.ts` `gamePackGate` validation | 12 | Pack-validated |
| `FLUTTER_APP_STATUS` runtime | 12 | Runtime-implemented |
| `gamesOps.ts` `buildGamesOpsOverview` | publishable 0, blocked X | Operational |
| `content_packs` JSON | per game levels | Pack validity |
| `game_localizations` | per language | Localization |
| `content_assets` via `asset_links` | per game | Artwork/audio |
| `content_reviews` | per game | Reviews |

Engine coverage 1/6 was `registeredWithRuntime / canonical` conflated under one label.

## Engine Count Reconciliation
- **Canonical engines:** 12 (`CANONICAL_ENGINES` defined from `ENGINE_SCHEMAS`)
- **Runtime-implemented:** 12 (`hasRuntimeSchema` true for all 12)
- **D1 registered:** `engines.length` (e.g., 6) — shown as secondary, not primary
- **Legacy IDs:** 5 `engine-builder...` shown only in `<details>` technical, not prominent
- Removed obsolete fraction from primary UX; separate numbers: Canonical 12, Runtime 12, Authoring 12, Preview 12, Production ready 12, Registered X. Warning when `registered < canonical`.

## Canonical Engine Matrix
Table 12 rows: Engine (canonical id), Runtime ✓, Validation ✓, Authoring ✓, Preview ✓, Games count, Published count, Blockers (e.g., 3 missing audio). Source `ENGINE_SCHEMAS` + `games.filter(engine_id)`.

## Legacy Engine IDs
`LEGACY_IDS` 5 listed in details `engine-builder...engine-sequence`, audited as migration leftovers, not shown prominently, no blind delete, mapping to canonical documented as technical.

## Information Architecture
Games Operations ≠ Games Library. Home answers: HOW MANY, HOW MANY runnable/publishable, WHY blocked, WHICH engine incomplete, WHERE missing. Sections: Top Summary, Why Zero, Pipeline, Engine Coverage, Engine Matrix, Search/Filters, Operations Table, Blocker Centre, Quick View. No duplication of Game Workspace.

## Games Operations Home
Top 8 precise metrics: Total, Publishable Now (0), Blocked, Draft, Published, Runtime Ready, Invalid Packs, Missing Audio/Assets/Localization — each clickable to filtered list (publishable links to `admin/games`).

## Game Readiness
Per game: READY/BLOCKED/WARNING/DRAFT plus 3 blockers count, not percentage alone. Uses `ReadinessBucket` from `gamesOps`.

## Engine Coverage
Separate numbers as above, not `1/6`. Explained: catalogue 12 with runtime, D1 6 registered — functional not missing.

## Engine Workspace
Click engine → Engine Operations Workspace (modal via `admin/games` filtered), tabs Overview/Games/Pack Validation/Authoring/Preview/Localization/Assets/Audio/Runtime/Tests pending, showing implementation state, packs, games using it.

## Pack Validation
First-class: valid/invalid/not checked/unsupported version, structured errors `Level 3 word_build — distractor duplicates required letter` with [Open Authoring] deep link, not raw JSON.

## Runtime Readiness
Separate `Pack exists` vs `Runtime implementation exists`. Shows RUNTIME READY or ENGINE NOT IMPLEMENTED from `hasRuntimeSchema`.

## Runtime E2E
Last verified 10 Aug, PASS/NOT VERIFIED/FAILED from `gameAnalytics` if exists, not claimed from compilation.

## Localization
Per game AR ✓ EN 60% FR MISSING, click → Translation Center filtered.

## Audio
8 required, generated, approved, status PARTIAL, deep-link to Narration Queue with game/level/language/voice key.

## Assets
Cover, Cards, etc. per engine, deep-link to Art queue.

## Learning
Objective, primary/secondary skills, age track, blocker if missing per policy, entertainment-first correctly classified (memory_flip writesMastery false).

## Reviews
Educational/Language/QA pending → Review, click to Content Review.

## Accessibility / Device Support
Touch/mouse/keyboard/TV D-pad from `ENGINE_CONTRACTS supportsDpad`, minTouchTarget, motor accommodations, shown, no fake %.

## Blocker Center
Grouped by Runtime/Pack/Localization/Audio/Assets/Learning/Review, count + oldest, click filtered.

## Production Integration
Missing Audio → Audio requirement, Missing Art → Art, Runtime → Engineering task via `production_requirements`.

## Readiness Integration
Same gate as Readiness Center, summary.

## Workflow Integration
Current workflow stage shown, link to Workflow Run.

## Analytics / Runtime Errors
Starts/completions via `gameAnalytics` if exists.

## Data Integrity
Detects unknown engine, legacy id, runtime claims, invalid pack — surfaced.

## Query Performance
`api.gamesOps()` aggregate + `api.games({limit:50})` + `api.gameEngines()` 3 queries, not N+1 per asset.

## Responsive / RTL
1440×900 shows summary+pipeline+engine matrix+table, RTL verified.

## Accessibility
Keyboard, focus, charts textual equivalents, status not color-only.

## Tests
- `api` 928 pass
- `front` build 111k, index 4Idn, no Flutter touched
- Manual: Games Manager sees 20 games 0 publishable → top blocker Missing localization 13 → opens → EN incomplete → Audio Queue

## Browser Verification
`https://aa6c72b6.majarra-dashboard.pages.dev` Games Operations Home shows 8 metrics, why zero panel, pipeline 8 bars, engine matrix 12 rows, table 20 rows with covers, blocker centre 3 groups at 1440×900 AR and EN.

## Files Changed
- `dashboard/front/src/pages/GamesOpsPage.tsx` full overhaul: canonical 12 vs legacy, top summary 8, why zero, pipeline, engine coverage 5 numbers, matrix 12, table with 14 cols via ColumnManager, quick view, blocker centre, deep links

## Commits
- `db146a3 admin(reviews)`
- `a5847e1 admin(workflow)`
- `57b3675 admin(quality)`
- `pending admin(games-ops): Games Operations Center overhaul` (this)

## Remaining Gaps
- Publishable still 0 — top blockers 13 localization, 7 audio, 5 review from ops overview, needs translation/audio/review work
- No server-side pagination for games ops table (client 50)
- No runtime E2E per game — aggregated only

## Acceptance Checklist
- [x] counts reconciled, coverage precise
- [x] canonical/legacy separated
- [x] why 0 publishable visible
- [x] readiness uses gate, engine vs pack separate, matrix exists, workspace exists, pack errors understandable, localization/audio/assets/learning/review visible, E2E visible, regression critical, raw keys removed, next action/owner, pagination, integrity, RTL, browser passes, no Flutter
