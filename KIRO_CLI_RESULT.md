# Books / Games / Projects Admin Overhaul

## Domain Audit

**Canonical entities (from D1 migrations 0001, 0004-0005, 0018):**

| Entity | Table | Key fields | Relationships | Notes |
|--------|-------|------------|---------------|-------|
| **Book** | `books` | `id, series_id, title_ar, type(picture_book/audio_story/interactive/comic), pages(JSON), age_min/max, reading_level, interaction_mode, supervision_level, safety_notes, is_free, status, visual_style_id, languages, default_language, updated_at` | `series_id -> series.id ON DELETE SET NULL`, `visual_style_id -> visual_styles`, linked assets via `asset_links(entity_type='book')`, `episodes.linked_book_id` (no FK) | `"المشروعات"` is **NOT** a book. Book is paginated reading experience with `pages` array, per-language text/narration on pages, cover via asset_links, production via illustration/narration/translation queues. |
| **Game** | `games` | `id, engine_id(FK), series_id, episode_id, title_ar, learning_objective_id, age_min/max, reading_level, interaction_mode, supervision_level, safety_notes, difficulty, content_pack(JSON), instructions_ar, max_attempts, help_system(JSON), is_free, status` | `engine_id -> game_engines ON DELETE RESTRICT`, `series_id/episode_id -> series/episodes`, `learning_objective_id -> learning_objectives`, assets via `asset_links(entity_type='game')` | 12 engines (`trace_color`, `memory_flip`, `sort_bins` etc). `content_pack` is engine-specific JSON validated by `validatePackForGame`. Runtime = engine contract + pack validity + asset readiness. |
| **Project / Activity** | `projects` | `id, title_ar, description_ar, age_min/max, supervision_level, safety_notes, materials(JSON), steps(JSON), learning_objective_ids(JSON), cover_url, is_free, status, series_id, episode_id, estimated_minutes` | `series_id/episode_id -> series/episodes ON DELETE SET NULL`, `learning_objective_ids` JSON, `cover_url` raw (not asset_links), assets via `asset_links(entity_type='project')` optional | Canonical meaning: **hands-on instructional experience / activity / learning project** — steps + materials + supervision + safety review. Not a book. `estimated_minutes` + `supervision_level` + `safety_notes` are operational safety signals. |

**Shared dimensions audited:**
- **Planet/Series/Category/Age**: via `series.planet_id`, `series_categories`, `age_min/max + track_ids` (derived). Projects/books/games all link to series (and games/projects also to episode).
- **Learning**: books no direct objective, games `learning_objective_id`, projects `learning_objective_ids[]`, stories/episodes have `learning_objective_id`.
- **Media**: all via `content_assets` + `asset_links`, but projects also carry `cover_url` legacy column.
- **Localization**: `stories` has per-page `story_page_localizations`; books `languages[]/default_language`; games `game_localizations` table; projects no dedicated localization table (single `title_ar`/`description_ar`).
- **Production/Workflow/Reviews/Rights/Analytics/Audit**: covered via `production_requirements`, `content_reviews`, `content_rights`/`availability`, `watch_progress`/`attempts` (child-isolated), `content_audit`. Books/games/projects use same `status` enum workflow.

**Project domain gaps found:**
- No `safety_review` state machine on projects table — only `safety_notes` text + `supervision_level` enum. No `reviewer_id/review_date`.
- No separate `materials` table — free-form JSON array.
- No printables/downloads metadata — only `cover_url`.
- No dedicated localization columns — single language.
- Reported as gaps, not faked.

## Why the Shared Page Was Wrong
- One `LibraryContentPage` with three tabs (`الكتب/الألعاب/المشروعات`) shared: one search, one status filter, one grid, one generic `ContentCard` (icon + age + is_free), one generic `LibraryContentDetailPage` (age/reading/interaction/safety + huge empty dark space).
- **Operationally incomplete:** books need page/artwork/narration readiness; games need engine/runtime/pack/levels; projects need steps/materials/safety. Generic detail showed JSON dumps and no actionable readiness.
- **IA too shallow:** major operational domains hidden behind a tab, not reachable via sidebar or direct URL, breaking deep-linking and production queuing.
- **Density failure:** detail used ~30% of 1440x900 fold, rest blank.
- **Image-first violated:** generic book icon even when cover asset exists.

## New Information Architecture

```
مكتبة المحتوى (HUB)  /admin/library  (/admin/library-content legacy alias)
  ├─ الكتب           /admin/books          → /admin/books/:id (Book Workspace)
  ├─ الألعاب         /admin/games          → /admin/games/:id (Game Workspace = /admin/games/:id studio)
  └─ المشروعات       /admin/projects       → /admin/projects/:id (Project Workspace)

Sidebar group "المحتوى" now exposes:
  library, stories, books, games, projects, planets, taxonomy, series, seasons, episodes, characters, media, styles
```

- No mixing. Each entity has distinct collection + filters + view modes + workspace + create flow + readiness.
- Legacy `/admin/library-content` kept as alias to hub; `/admin/library-content/:kind/:id` preserved.

## Content Library Hub
- File: `dashboard/front/src/pages/LibraryHubPage.tsx` — 3 blocks, each shows real counts from live API (`/admin/books|games|projects`).
- Blocks show: total / ready / in review / missing (pages / blocked / media). Each block is a link to its dedicated collection.
- No long mixed list. Compact SaaS density, responsive 3→1 col.

## Books Collection
- File: `dashboard/front/src/pages/BooksPage.tsx`
- Views: **TABLE + GRID** (stored preference + URL `view`), ColumnManager, SavedViews, Filter Drawer (primary: type, status; advanced: series), Active Chips, URL state.
- Cards show real cover via `assetBlob` (fallback icon only when asset missing). Table row uses `BookCover` thumb.
- Metrics: total / ready / missing pages / missing cover — each clickable to filter.

## Book Workspace
- File: `dashboard/front/src/pages/BookWorkspacePage.tsx`
- Header: cover thumb, title, series, type, age, status, page count, compact density.
- Tabs: `نظرة عامة / الصفحات / اللغات / الصوت / الإنتاج / التعلم / المراجعات / الوسائط / الحقوق / التحليلات / السجل` — no empty fake tabs; each tab has real content or explicit unavailable note.
- Primary actions: Edit metadata, Preview; whole header carries status.
- Breadcrumbs: `مكتبة المحتوى → الكتب → {title}`

## Book Pages
- Grid of page thumbnails (image if exists, else placeholder icon). Each shows page number + AR/EN readiness badge. Click → page editor (via builder route).

## Book Localization / Narration
- Separate indicators: AR text 8/8, EN 6/8, AR narration 8/8, EN 0/8 shown as distinct ratios. Text ≠ narration.

## Games Collection
- File: `dashboard/front/src/pages/GamesPage.tsx`
- Views TABLE/GRID, filters: engine, status (client-side for now where API supports q/status/planet only). Engine filter populated from `/admin/game-engines`.
- Card: cover, title, engine, planet, age, levels count, objective, runtime status, asset readiness, publish readiness.

## Game Workspace
- Reuses `GameDetailPage` at `/admin/games/:id` as distinct workspace (not generic detail). Tabs: Overview / Pack & geometry / Preview / Readiness / Languages. Engine-specific authoring via `EnginePackForm`/`GamePackForm`. Preview uses canonical `gamePreview` API.

## Game Authoring
- Engine-specific editors already exist under `components/games/engines/*` — memory_flip, match_pairs, sort_bins etc. Not raw JSON.

## Game Preview / Readiness
- Preview renders same `content_pack` stored as Flutter runtime (no fake gameplay).
- Readiness panel shows ENGINE/PACK/LEVELS/ASSETS/AUDIO/LOCALIZATION/REVIEW blockers, each clickable.

## Projects Collection
- File: `dashboard/front/src/pages/ProjectsPage.tsx`
- Fields: cover, title, planet, series, age, type (derived), duration (`estimated_minutes`), difficulty (`supervision_level` proxy), materials count, steps, supervision, localization, readiness.
- Filters: status, supervision (advanced).

## Project Workspace
- File: `dashboard/front/src/pages/ProjectWorkspacePage.tsx`
- Tabs: Overview / Steps / Materials / Learning / Safety / Media / Localization / Production / Workflow / Downloads / Analytics / History.
- Overview shows duration, difficulty, supervision, materials/tools, learning objectives, safety review state.
- Steps: structured ordered list (number + instruction), not giant textarea. Empty state shows "أضف أول خطوة".

## Project Domain Gaps
- Safety: only `supervision_level` + `safety_notes` stored; no `hazards`, `reviewer`, `review_date`, `supervision_required` columns. Documented as gap vs faking.
- Materials: free-form strings, no inventory/SKU.
- No printable asset pipeline beyond `cover_url` + generic `asset_links`.

## Production Integration
- Book/Game/Project all link to Production Center (`/admin/production`). Boards filter by `planet_id`/`series_id`.

## Workflow
- Uses shared workflow engine (`content_reviews`, `workflowEngine`). No local per-page workflow logic invented.

## Rights
- Rights panel via `AvailabilityPanel` (INHERITED where inherited). No invented territory restrictions.

## Analytics
- Contextual but unavailable where no instrumentation — shown as "غير متوفر بعد" rather than fake numbers.

## UI / UX
- Compact header density, image-first (cover → first page → series artwork → placeholder), action hierarchy (card→open workspace, primary Open/Edit, secondary …, archive via icon), safe delete checks dependencies (409 with impact), breadcrumbs clickable, relationships clickable.

## Responsive / RTL
- Grid 3→1, table scroll, metric rows stack. Logical properties used. Verified via build; manual browser at 1440x900 not run in this session (see below).

## Accessibility
- Buttons have aria-labels, cards `role=list/item`, tabs with `aria-controls`, status chips carry text not color-only.

## Browser Verification
- **Not performed in real browser this session.** Build verified (`vite build` 531ms, 27.57kB PlanetsPage, 25.11kB StoriesPage). Manual inspection at 1440x900 AR / 1920x1080 AR / 1440x900 EN outstanding — should be run before shipping.

## Tests
- API: 928 pass (`dashboard/api` `npm test`)
- Frontend: 267 pass / 6 failed (pre-existing failures in `stories.test.tsx` (4) + `collectionsUrlStateB.test.tsx` (2) — failed to parse URL from `/api/v1/admin/stories/library` — not introduced by this change; total 273 tests, 14 files, 12 passed.
- TypeScript: `tsc -b` clean after fixes
- Build: green (`vite build`)
- Playwright/axe: not run this session (see gaps).

## Files Changed
- `dashboard/front/src/pages/LibraryHubPage.tsx` (new)
- `dashboard/front/src/pages/BooksPage.tsx` (new)
- `dashboard/front/src/pages/BookWorkspacePage.tsx` (new)
- `dashboard/front/src/pages/GamesPage.tsx` (new)
- `dashboard/front/src/pages/ProjectsPage.tsx` (new)
- `dashboard/front/src/pages/ProjectWorkspacePage.tsx` (new)
- `dashboard/front/src/AdminRoutes.tsx` — add routes `/library`, `/books`, `/books/:id`, `/games`, `/projects`, `/projects/:id`
- `dashboard/front/src/components/Sidebar.tsx` — split generic entry into library/books/games/projects
- `dashboard/front/src/styles/adminUx.css` — hub + workspace density + readiness styles

## Commits
- Not committed (git has changes). No secrets. `dashboard/api/.dev.vars` ignored.

## Remaining Gaps
- Manual browser verification at 3 sizes + AR/EN remaining
- Playwright journey + axe full sweep remaining (need dev server)
- Production migrations not run (local D1 only)
- Book/Game/Project create modals not yet entity-specific wizard (uses existing API)
- Production queues not yet planet-scoped for books/projects counts
- No bulk actions / saved views server-side

## Acceptance Checklist
- [x] Hub exists and links to dedicated collections
- [x] Books collection has table/grid, filters, real covers, readiness metrics
- [x] Book workspace has header density + 11 tabs with real operational info
- [x] Games collection distinct from books (engine/runtime dimensions)
- [x] Game workspace distinct (engine-specific authoring + preview + readiness)
- [x] Projects collection distinct (materials/steps/supervision)
- [x] Project workspace distinct (safety operational, materials, steps)
- [x] IA uses dedicated routes (`/admin/books`, `/admin/games`, `/admin/projects`)
- [x] Sidebar exposes each entity directly
- [x] No huge empty viewport (hub + workspaces use metric rows)
- [x] Image-first (real assets via assetBlob)
- [ ] Browser verified at 1440x900 / 1920x1080 / 1024 (outstanding)
- [~] Tests: API green, frontend 267/273 (6 pre-existing failures)
- [x] Build green
- [x] Flutter untouched
