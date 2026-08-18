# Majarra Master Audit Backlog

## How To Use This File

- This file is the **actionable output** of the repository-wide audit performed on **2026-08-15**. The narrative evidence lives in `KIRO_LAST_REPORT.md`.
- Task IDs are **stable**. When this file is regenerated, never renumber an existing ID. Add new IDs at the end of the relevant area sequence.
- One root cause = **one task**, with all affected areas listed. Do not split a single configuration defect into per-screen tasks.
- Every task carries evidence as `path:line`. If you cannot reproduce the evidence, re-audit before implementing.
- `Status` uses the audit taxonomy: COMPLETE / PARTIAL / MISSING / TEST-FIXTURE-ONLY / SPEC-DOC-ONLY / HARDCODED / PLACEHOLDER / DEAD-UNUSED / DUPLICATED / DISCONNECTED / OWNER-DECISION / EXTERNAL-DEP / HUMAN-REVIEW.
- Effort is **relative engineering size** (XS/S/M/L/XL), not a calendar promise.
- Nothing in this file has been implemented. No production code, schema, migration, content status or review state was changed during the audit.

## Current Audit Baseline

| Item | Value |
|---|---|
| Audit date | 2026-08-15 |
| Branch / HEAD | `master` @ `166907d` (`admin(skills): Learning Framework overhaul`) |
| Working tree | 354 changed/untracked paths — **not a clean tree**; audit reflects working-tree state, not HEAD |
| Flutter | `flutter analyze` clean; `flutter test` **304 passed** |
| Worker API | `npm test` **960 passed**; `tsc --noEmit` clean |
| Admin | `tsc --noEmit` clean (**but 28 pages carry `@ts-nocheck`**); `vitest` 284 passed; `npm run build` OK |
| Database evidence | **local** D1 `majarra-db` only (`dashboard/api/.wrangler`), rebuilt 2026-08-12. Remote/production D1 and R2 **NOT-VERIFIED** |
| Content assets in DB | 119 total — **all images**. 0 audio, 0 video, 0 renditions |
| Published content | series 10, episodes 20, seasons 0, stories 0, books 0, games 19, projects 0 |
| Playable content | **0 episodes**, **0 stories**, **0 books**, 3 fully-formed games |
| Docs | 301 project-relevant `.md`; 3520 unchecked checkboxes across 164 files |

## Task Counts

| Priority | Count | Meaning |
|---|---:|---|
| **P0 — Launch blockers** | **25** | Security, data integrity, or a core flow that is broken end to end |
| **P1 — Production essentials** | **37** | Required before a serious/scaled launch |
| **P2 — Product & operational quality** | **26** | Quality, maintainability, operability |
| **P3 — Future / optional** | **11** | Deferred scope; do not build yet |
| **Total engineering tasks** | **99** | |
| Documentation cleanup | 6 | `DOCS-*` |
| Human review (non-engineering) | 12 | `HUMAN-*` |
| External dependencies | 7 | `EXT-*` |
| Owner decisions | 10 | `DECIDE-*` |

> **Reading the P0 list correctly:** the majority of P0s are **not code defects**. They are (a) three genuine authorization holes, (b) a dead CI pipeline, (c) a migration ledger that no longer matches reality, and (d) the fact that **no audio or video asset exists in the database at all**, which makes every "watch" and "listen" surface unplayable regardless of code quality. The application code is in considerably better shape than the content and operations around it.

---

# P0 — Launch Blockers

## Security

### SEC-001 — Unauthenticated admin endpoint writes editorial recommendations shown to every child

**Priority:** P0
**Area:** API / Security / Recommendations
**Status:** MISSING

**Problem**
`POST /api/v1/recommendations/admin` performs no authentication and no authorization whatsoever, then inserts into `home_recommendations`, which is served to children's home rails.

**Evidence**
`dashboard/api/src/routes/recommendations.ts:50-58`. Line 51 is the entire authorization design: `// reuse requireAdmin via parentAuth? simple check Authorization contains admin`. Route registered in `dashboard/api/src/index.ts`. Not caught by `dashboard/api/test/routeGuards.test.mjs:59-61`, which only inspects files whose name starts with `admin`.

**Current behavior**
Any anonymous caller can pin, hide or inject a series into any child's home feed (or all children, with `child_id` null), with an attacker-chosen `priority` and `is_pinned`.

**Expected behavior**
The endpoint requires an authenticated admin principal with an explicit permission scope, is audit-logged, validates `series_id` against existing published content, and rejects unknown `child_id`.

**Implementation scope**
Move the endpoint into an `admin*` route module (so the guard sweep covers it), apply the existing `requirePermission` helper (`dashboard/api/src/lib/adminAuth.ts:170-193`), add an audit write, validate the body, and extend the guard-sweep test to cover every mutating route file.

**Dependencies** API; depends on TEST-001 for the regression net.

**Effort** S

**Acceptance criteria**
- [ ] Anonymous `POST /api/v1/recommendations/admin` returns 401 and writes nothing.
- [ ] A valid admin without the recommendations permission returns 403.
- [ ] A successful call produces an `audit_logs` row naming the actor.
- [ ] `routeGuards.test.mjs` fails if this route loses its guard.

**Do not do**
Do not implement authorization by substring-matching the `Authorization` header.

### SEC-002 — HLS manifest hands premium video capability tokens to any authenticated parent

**Priority:** P0
**Area:** API / Security / Streaming
**Status:** MISSING

**Problem**
`GET /api/v1/episodes/:id/hls/master.m3u8` authenticates the parent and then issues media capability tokens for private video assets without checking entitlement, playback lease, territory, or child context — and falls back to the primary private asset when no renditions exist.

**Evidence**
`dashboard/api/src/routes/episodes.ts:419-437`: `authenticateParent` only (`:421`), no `required_plan` check, no `availabilityFor`, no `/playback/start` lease, fabricated lease id `lid: hls-${Date.now()}` (`:431`), rendition fallback to `catalog.media.asset_id` (`:426`). The correct, fully-gated path is `dashboard/api/src/routes/episodes.ts:277-297`.

**Current behavior**
A free-tier or out-of-territory account that can authenticate can obtain playable tokens for paid video and bypass concurrency limits, because no lease is created or counted.

**Expected behavior**
The manifest path enforces the same contract as `/playback/start`: entitlement/`required_plan`, availability/territory refusal (451), a real playback lease that counts against concurrency, child ownership, and per-rendition tokens minted only after those checks pass.

**Implementation scope**
Refactor the manifest handler to call the same gating helpers as the playback path; return 402/403/451 as appropriate; reuse the issued lease id; add tests for free-plan, wrong-territory, and concurrency-exceeded cases.

**Dependencies** API; Media capability tokens; interacts with STREAM-001 (there is no video to serve yet, so this is exploitable only after content lands — fix before any video is published).

**Effort** M

**Acceptance criteria**
- [ ] A parent without the required plan receives a refusal and **no** media token.
- [ ] A request from a restricted territory returns 451.
- [ ] Tokens are only minted after a lease exists, and the lease id in the token is the real one.
- [ ] Concurrency limits apply to HLS playback identically to progressive playback.
- [ ] Tests cover all four refusals.

**Do not do**
Do not "temporarily" leave the fallback-to-primary-asset branch in place.

### SEC-003 — Analytics ingest accepts unauthenticated writes with spoofable identifiers, no quota and no retention

**Priority:** P0
**Area:** API / Security / Analytics / Privacy
**Status:** PARTIAL

**Problem**
`POST /api/v1/analytics/events` computes authentication and then discards it: `parent_id` is taken from the request body when unauthenticated, and `child_id` is **always** taken from the body with no ownership check. The route has no rate limit and the stored table has no retention job.

**Evidence**
`dashboard/api/src/routes/analyticsIngest.ts:11-23` (auth computed at `:11`, `parentId` fallback `:18`, `childId` from body `:19`, insert `:20`). `/api/v1/analytics/*` is absent from the rate-limit registration in `dashboard/api/src/index.ts:93-97`. PII screening is a substring regex over serialized params (`:19`) that misses `child_name`, `dob`, `phone` and never inspects the ids themselves. `scheduled/cleanup.ts` has no `analytics_events` retention.

**Current behavior**
An anonymous caller can write unbounded rows attributed to arbitrary families and children, growing D1 without limit and corrupting any future metric.

**Expected behavior**
Events are attributed only to the authenticated principal; `child_id` is verified against `FamilyState` ownership; the endpoint is rate-limited per principal and per IP; a retention window is enforced by the daily cron; the PII denylist checks keys structurally, not by substring.

**Implementation scope**
Reject unauthenticated writes (or gate a strict `app_open`-only anonymous path with its own quota and no ids), verify child ownership, register the route with the rate limiter, add a retention delete to the cron, and replace the regex screen with a key allowlist.

**Dependencies** API; Durable Objects (FamilyState ownership); Cron.

**Effort** M

**Acceptance criteria**
- [ ] Anonymous event writes are rejected, or accepted only with no ids and under quota.
- [ ] A parent cannot write an event for a child they do not own.
- [ ] Rate limiting is enforced and covered by a test.
- [ ] The cron deletes events older than the agreed retention window.
- [ ] `child_name` / `dob` / `phone` keys are rejected.

**Do not do**
Do not rely on the client to omit PII.

### SEC-004 — Permission grants allow privilege escalation to owner and self-lockout

**Priority:** P0
**Area:** API / Admin / RBAC
**Status:** PARTIAL

**Problem**
`POST /users/:id/grants` never compares the granted role against the actor's own privilege level, so any holder of `manage_permissions` can mint an `owner` grant. Separately, an actor can delete their own `manage_permissions` grant and lock themselves out.

**Evidence**
`dashboard/api/src/lib/adminUsers.ts:246-263` (no privilege comparison on grant) and `:266-296` (self-grant removal permitted). Last-owner protection (`:277-287`) and self-deactivation protection (`:180-184`) **are** implemented, which shows the intent.

**Current behavior**
A scoped administrator with permission management can escalate to full ownership silently; an owner can accidentally remove their own ability to manage permissions.

**Expected behavior**
An actor may never grant a role whose privilege exceeds their own; removing one's own `manage_permissions` grant is refused with an explicit error; both paths are audit-logged.

**Implementation scope**
Add a privilege-ordering comparison to the grant path, refuse self-removal of the managing permission, extend audit metadata, and add tests for escalation and lockout.

**Dependencies** API; Admin RBAC.

**Effort** S

**Acceptance criteria**
- [ ] A non-owner with `manage_permissions` cannot create an `owner` grant (403 + audit).
- [ ] An actor cannot delete their own `manage_permissions` grant.
- [ ] Tests cover escalation and self-lockout.

**Do not do**
Do not enforce this only in the admin UI — `TeamAccessPage`/`GrantsPage` are `@ts-nocheck` and cannot be the control point.

## Operations

### OPS-001 — CI has never run, and the 960 API tests never execute in it

**Priority:** P0
**Area:** Operations / CI
**Status:** MISSING

**Problem**
Three independent defects mean there is no automated gate on any change: the workflow triggers on a branch that does not exist, the worker job invokes a script that does not exist, and the failure is masked by a fallback.

**Evidence**
`.github/workflows/ci.yml:3-7` triggers on `main`; `git branch` shows only `master`. `.github/workflows/ci.yml:38` runs `npm run check 2>/dev/null || npx tsc --noEmit`; `dashboard/api/package.json` has no `check` script, so the job always degrades to a typecheck and the 960 tests never run. There is no admin/front-end job at all.

**Current behavior**
Every merge is unverified. `flutter analyze`, `flutter test`, the worker test suite, the admin test suite and the admin build are all local-only rituals.

**Expected behavior**
CI runs on the real default branch and on pull requests, and executes: Flutter analyze + test, worker `npm test` + typecheck, admin typecheck + vitest + build, and the content-pacing check. A failing suite blocks the merge.

**Implementation scope**
Fix the branch trigger, replace `npm run check` with `npm test && npm run typecheck:types`, add an admin job, remove the error-masking fallbacks, and add secret scanning plus dependency audit steps.

**Dependencies** Operations; blocks the reliability of every other task's acceptance criteria.

**Effort** S

**Acceptance criteria**
- [ ] A pushed commit produces a workflow run on the actual default branch.
- [ ] The worker job fails when a worker test fails (verified by a deliberate temporary failure in a scratch branch).
- [ ] Admin typecheck, tests and build run in CI.
- [ ] No CI step swallows a non-zero exit code.

**Do not do**
Do not add `|| true` or `2>/dev/null` to any CI step.

### OPS-002 — Migration ledger no longer matches the migration directory; remote apply is unsafe

**Priority:** P0
**Area:** Operations / Database
**Status:** HUMAN-REVIEW

**Problem**
The applied-migrations table and the `migrations/` directory disagree in both directions, and some content was applied twice under different numbers. Running `migrate:remote` in this state risks re-applying destructive statements.

**Evidence**
Verified query against local D1: 59 recorded vs 59 files, but the sets differ.
Recorded with **no file on disk**: `0051_wave1_games.sql`, `0052_wave2_depth.sql`, `0053_wave3_final.sql` (applied 2026-08-12). Files carrying the same content were re-recorded as `0054_wave1_games.sql`, `0055_wave2_depth.sql`, `0056_wave3_final.sql` (applied 2026-08-14) — including a destructive archive `UPDATE` at `0054_wave1_games.sql:22`. Duplicate `0018_*` and `0051_*` number pairs exist on disk.
Present on disk but **not recorded**: `0058_story_page_dwell.sql`, `0059_story_page_dwell_backfill.sql`, `0060_story_page_dwell_recompute.sql` — yet `story_pages.dwell_ms` exists and is populated 194/194, because these were applied with `d1 execute --file` rather than `migrations apply`. Code merged 2026-08-15 already reads the column (`dashboard/api/src/routes/books.ts`, `adminStories.ts`, `stories.ts`).
Additionally `dashboard/api/package.json` defines `deploy:staging` / `migrate:staging` with `--env staging`, which `dashboard/api/wrangler.jsonc` does not define (only `production`), and `migrate:staging` passes the binding name `DB` instead of the database name.

**Current behavior**
Local schema is correct but unrecorded for 0058-0060. Remote state is unknown. A `migrate:remote` could fail on already-present columns or re-run the wave content and re-archive rows.

**Expected behavior**
A single reconciled ledger; every applied file recorded exactly once; idempotent guards on data migrations; a documented, rehearsed procedure for bringing remote to parity; staging either defined or the scripts removed.

**Implementation scope**
Audit the remote `d1_migrations` and remote schema read-only first; produce a reconciliation plan (record-only entries vs real applies); make the wave data migrations idempotent before any replay; resolve the duplicate `0018_*`/`0051_*` numbering; define or delete the staging environment.

**Dependencies** D1; Operations; requires **owner sign-off before touching remote** (see DECIDE-001).

**Effort** M

**Acceptance criteria**
- [ ] Remote `d1_migrations` and remote schema are documented as read-only evidence before any change.
- [ ] Local and remote ledgers list the same files, once each.
- [ ] Re-running any migration twice is proven harmless in a scratch database.
- [ ] `deploy:staging` / `migrate:staging` either work against a defined environment or are removed.

**Do not do**
Do not rewrite migration history. Do not run `migrate:remote` or any `--remote` write until this task is approved and the plan reviewed.

### OPS-003 — No administrator account exists in the audited database

**Priority:** P0
**Area:** Operations / Admin
**Status:** MISSING (local) / NOT-VERIFIED (production)

**Problem**
The audited database contains zero admin users and zero credentials, so the dashboard cannot be logged into at all. Bootstrap depends on a pre-seed shared key path.

**Evidence**
`SELECT COUNT(*) FROM admin_users` → 0; `admin_credentials` → 0. Pre-seed shared-key path is deliberately limited at `dashboard/api/src/lib/adminAuth.ts:74-78`.

**Current behavior**
On this database, no admin operation is possible. Whether production has accounts is unverified.

**Expected behavior**
A documented, auditable bootstrap procedure: first owner created via the pre-seed path, shared key then disabled, at least two owners to survive last-owner protection, and the state verified.

**Implementation scope**
Write and rehearse the bootstrap runbook; verify production account state read-only; confirm the shared key cannot be used once accounts exist.

**Dependencies** Operations; Admin RBAC; Human (owner credentials).

**Effort** XS

**Acceptance criteria**
- [ ] Production admin account state is verified and recorded.
- [ ] Runbook exists and has been executed once against a scratch environment.
- [ ] At least two owner accounts exist in production.
- [ ] The pre-seed shared key is proven inert after bootstrap.

**Do not do**
Do not create accounts as part of this audit.

## Core App

### APP-001 — Guest/demo mode with a hardcoded demo child ships in the production build

**Priority:** P0
**Area:** Flutter / Core App
**Status:** HARDCODED

**Problem**
A guest entry point and a hardcoded fake child are compiled into the app with no environment gate, and the resulting session has no tokens, so everything the child then taps fails.

**Evidence**
`app_main/lib/features/auth/presentation/pages/login_page.dart:300-360` (guest entry, no `AppConfig` gate) with `childId: 'demo-child'` at `:321`; `app_main/lib/features/child/application/child_provider.dart:49`; hardcoded `_demoChildren` at `app_main/lib/features/child/presentation/pages/child_switcher_page.dart:120-128`; special-cased at `app_main/lib/features/auth/application/auth_controller.dart:171`.

**Current behavior**
A real user can enter the app as a guest, is presented with a fabricated child profile, and then hits silent failures in games, playback and progress because no credentials exist.

**Expected behavior**
Either no guest mode in release builds, or a genuine, server-backed trial session. The `demo-child` literal does not exist in release code paths.

**Implementation scope**
Decide the product answer (see DECIDE-002), then gate or remove the guest path and the demo child list, and add a test asserting the literal is absent from release configuration.

**Dependencies** Flutter; Product decision (DECIDE-002).

**Effort** S

**Acceptance criteria**
- [ ] No guest/demo entry is reachable in a release build.
- [ ] `demo-child` appears in no runtime code path.
- [ ] A test fails if a fabricated child profile is constructed outside tests.

**Do not do**
Do not leave the guest button visible-but-disabled; remove the affordance.

### APP-002 — A backend outage silently substitutes a fake bundled catalogue

**Priority:** P0
**Area:** Flutter / Core App / Error Handling
**Status:** HARDCODED / DISCONNECTED

**Problem**
Every catalogue endpoint failure is swallowed and replaced with a hardcoded local catalogue, so an outage presents as a browsable-but-dead app instead of an error.

**Evidence**
`app_main/lib/features/home/data/content_repository.dart:250-262` swallows errors and falls back to `app_main/lib/features/home/data/local_catalog.dart:5-460` (9 planets, 5 series, 7 episodes, 16 books, 1 story) — none of which has a `videoUrl`. Nothing is logged (`crash_reporter.dart:56` is a memory-only no-op).

**Current behavior**
During an outage a child sees a full home screen of content whose every tap dead-ends, and the operator receives no signal.

**Expected behavior**
A failed catalogue read surfaces an error state with retry, is distinguishable from "no content", and is reported to telemetry. Any offline snapshot used must be a real previously-fetched cache (which exists: `catalog_cache.dart`), never invented rows.

**Implementation scope**
Remove the invented-catalogue fallback, route failures to the existing error view, prefer the real disk cache, and report the failure once telemetry exists (ANALYTICS-001).

**Dependencies** Flutter; ANALYTICS-001 for reporting.

**Effort** S

**Acceptance criteria**
- [ ] With the API unreachable and no cache, the app shows an error with retry, not content.
- [ ] With a valid cache, cached content is shown and labelled as offline.
- [ ] `local_catalog.dart` is no longer reachable from production code paths.
- [ ] A test simulates total API failure and asserts the error state.

**Do not do**
Do not delete the disk cache path — it is correct and tested.

### APP-003 — A real person's name is hardcoded into the bottom navigation

**Priority:** P0
**Area:** Flutter / Core App
**Status:** HARDCODED

**Problem**
The profile tab label is the literal string `عبدالله` rather than the active child's name.

**Evidence**
`app_main/lib/features/home/presentation/widgets/majarra_bottom_navigation.dart:96`.

**Current behavior**
Every user of the app sees the same hardcoded name on the primary navigation bar.

**Expected behavior**
The label shows the active child's display name, or a generic localized label when none is selected.

**Implementation scope**
Read from `childProvider`; add a widget test asserting the label follows the active child and that no personal-name literal remains.

**Dependencies** Flutter.

**Effort** XS

**Acceptance criteria**
- [ ] The tab label reflects the active child.
- [ ] With no child selected, a localized generic label is shown.
- [ ] A test fails if a hardcoded personal name is reintroduced.

### APP-004 — Forced-update gate cannot work: version is hardcoded and failures are swallowed

**Priority:** P0
**Area:** Flutter / Core App / Release
**Status:** HARDCODED

**Problem**
The minimum-version release gate compares against a hardcoded `'0.1.0'`, and any error in the check is discarded, so the gate can never force an update and can never be diagnosed. The `X-App-Version` header sent to the API is hardcoded too.

**Evidence**
`app_main/lib/app/majarra_app.dart:194` (`const current = '0.1.0'`) and `:202` (`catch (_) {}`); `app_main/lib/features/home/data/majarra_api_client.dart:1231` (hardcoded header). `package_info_plus` is already a dependency.

**Current behavior**
Shipping a build with a real version string leaves the comparison permanently wrong; server-side min-version enforcement is inert; API-side platform/version analytics and gating are fed a constant.

**Expected behavior**
The real package version drives both the gate and the header; a failed check is reported, not swallowed; the gate is covered by a test.

**Implementation scope**
Source the version from `package_info_plus`, propagate it to the API client, log check failures, and test below/at/above minimum.

**Dependencies** Flutter; API (`appConfig` min-version contract).

**Effort** S

**Acceptance criteria**
- [ ] Version comes from package metadata in both the gate and the header.
- [ ] A build below the server minimum is blocked; at or above is allowed.
- [ ] A failed version check is reported and does not silently pass.

## Content Production

### CONTENT-001 — No audio asset exists anywhere: every narration, voice-over and audio story is silent

**Priority:** P0
**Area:** Content / Media / AI Production
**Status:** MISSING

**Problem**
The database contains zero audio assets, so page narration, game voice-over, audio stories and any spoken instruction are unavailable across the entire product.

**Evidence**
`SELECT COUNT(*) FROM content_assets WHERE kind='audio'` → **0** (119 assets total, all `image`). All 194 `story_page_localizations` rows have `narration_asset_id IS NULL`. Games use `SilentGameAudioService` in the app; 18 of 19 published games also have no `instructions_ar` text, so there is neither voice nor text. TTS tooling exists (`tools/tts/narrate.mjs`, `dashboard/api/src/services/googleTts.ts`) and calibration is measured (`docs/content/narration-rate-calibration.json`), but no output has been ingested.

**Current behavior**
"Read to Me", audio stories and preschool game instructions cannot function. A pre-reader cannot use the product.

**Expected behavior**
Narration exists for every published story page and every published preschool game instruction, ingested as `content_assets(kind='audio', status='ready')` and linked, with measured durations written to `duration_ms`.

**Implementation scope**
Run the existing TTS pipeline for the approved scripts, ingest into R2 + `content_assets`, link per language, write measured durations, then re-run the dwell validator so advertised durations become truthful.

**Dependencies** Google TTS (EXT-002); R2; Media Library; Content; Human audio review (HUMAN-004); STORY-001; GAME-001.

**Effort** XL

**Acceptance criteria**
- [ ] Every published story page has a linked ready audio asset per published language.
- [ ] `story_pages.duration_ms` is populated from real file durations for those pages.
- [ ] Every published preschool game has spoken instructions or documented text-only justification.
- [ ] `node dashboard/api/tools/dwell_model.mjs report` shows measured (not estimated) narration for published stories.

**Do not do**
Do not pad audio files with silence to hit a duration target; do not treat estimated durations as measured.

### CONTENT-002 — No video asset exists: all 20 published episodes are unplayable

**Priority:** P0
**Area:** Content / Media / Streaming
**Status:** MISSING

**Problem**
There are no video assets and no renditions, and no `stream`/`video` asset link exists for any episode, so the exact predicate the API uses to resolve playable media returns zero rows.

**Evidence**
`content_assets` where `kind='video'` → **0**; `episode_renditions` → 0; the `catalogMedia` predicate (`dashboard/api/src/routes/episodes.ts:66-80`) matches 0 published episodes. All 20 published episodes also have `duration_seconds IS NULL`. `episode_audio_tracks` and `episode_subtitle_tracks` are both 0.

**Current behavior**
Twenty episodes are advertised in the catalogue with blank runtimes; tapping any of them reaches a player with no source.

**Expected behavior**
Every published episode has at least one ready private video asset (ideally renditions), a real duration, and thumbnails; episodes without media cannot be published.

**Implementation scope**
Produce/ingest video, generate renditions, populate durations and tracks, and add a publish-gate rule that refuses an episode with no playable media.

**Dependencies** Media pipeline; R2; PlayVeo/production (EXT-001); publish gate; ADMIN-001.

**Effort** XL

**Acceptance criteria**
- [ ] The `catalogMedia` predicate returns a row for every published episode.
- [ ] No published episode has a null duration.
- [ ] The publish gate blocks an episode with no ready video asset.

### CONTENT-003 — Seasons advertise 83 episodes that do not exist, and no season is published

**Priority:** P0
**Area:** Content / Data
**Status:** PARTIAL

**Problem**
Seventeen seasons carry an `episode_count` describing episodes that have no rows, and zero of the 39 seasons are published, so the series → season → episode navigation cannot resolve.

**Evidence**
Seasons: 39 total, **0 published** (31 draft, 8 `review_sharia`). 17 seasons declare a non-zero `episode_count` while the actual joined episode count is 0 — an 83-episode discrepancy.

**Current behavior**
A child entering a series either finds no season, or a season promising episodes that are absent.

**Expected behavior**
`episode_count` is derived from real rows (or removed as a stored field), and a season cannot be published while its declared episodes are missing.

**Implementation scope**
Decide derived-vs-stored for `episode_count`, reconcile the 17 rows, add a publish-gate rule, and add a data-quality check to the readiness reporting.

**Dependencies** D1; Admin publish gate; Content.

**Effort** M

**Acceptance criteria**
- [ ] No season row claims more episodes than exist.
- [ ] A season with zero publishable episodes cannot be published.
- [ ] A repeatable query proves parity between declared and actual counts.

**Do not do**
Do not "fix" the numbers by deleting the episode rows or by lowering counts without editorial review.

## Stories & Books

### STORY-001 — No story is publishable: every page lacks artwork and narration

**Priority:** P0
**Area:** Content / Stories / Media
**Status:** MISSING

**Problem**
All 194 story pages have no image and no narration asset, and no story is published, so the entire stories pillar is empty — while the story reader code, dwell timing model and offline cache are built and tested.

**Evidence**
`SELECT COUNT(*) FROM story_pages WHERE image_asset_id IS NULL` → **194/194**; all 194 localizations have `narration_asset_id IS NULL` and empty `timing_cues`; `stories` published → **0** (15 draft, 8 archived). Contradicted by `FLUTTER_APP_STATUS.md:34,160`, which certifies `story-bird-home` as published with 8/8 images and AR/EN narration ready.

**Current behavior**
`GET /api/v1/stories` returns nothing; the home stories rail renders an empty header. If published as-is, a child would see text on blank white with no voice.

**Expected behavior**
Published stories have one linked ready image per page, narration per published language, measured `duration_ms`, authored `dwell_ms` (already present 194/194), and pass the publish gate.

**Implementation scope**
Ingest the story artwork (122 SVG/PNG-class assets exist on disk for drawing, but story page art must be produced/linked), run narration (CONTENT-001), link assets, then publish through the gate that ADMIN-001 must first provide.

**Dependencies** CONTENT-001; ADMIN-001 (no story publish endpoint exists); Media/R2; Human art + linguistic review (HUMAN-003, HUMAN-005).

**Effort** XL

**Acceptance criteria**
- [ ] Every page of every published story has a linked ready image asset.
- [ ] Every page has narration for each published language, with measured durations.
- [ ] At least one story is published and renders end-to-end in the app with auto-turn.
- [ ] `FLUTTER_APP_STATUS.md` is corrected to match reality (see DOCS-001).

### BOOK-001 — No book is publishable; 13 of 22 drafts have no pages

**Priority:** P0
**Area:** Content / Books
**Status:** MISSING

**Problem**
Zero books are published, more than half the drafts contain no pages at all, and no book asset links exist, so the books pillar is empty end to end.

**Evidence**
`books` published → **0** (22 draft); 13/22 have an empty `pages` relationship; no `asset_links` rows for book assets; all 22 declare `["ar"]` only. The reader integration itself works — `dashboard/api/src/routes/books.ts` serves pages (and now `dwell_ms`).

**Current behavior**
The library's books surface is empty; a published book would render pages with no artwork.

**Expected behavior**
Books have pages, artwork, optional narration, and pass a publish gate.

**Implementation scope**
Author/ingest book pages and artwork, decide narration scope per book type, and provide a book publish path (ADMIN-001).

**Dependencies** ADMIN-001; Media/R2; CONTENT-001 (if narrated); Human review.

**Effort** L

**Acceptance criteria**
- [ ] No published book has a page without artwork.
- [ ] At least one book is published and readable end-to-end in the app.
- [ ] A book with zero pages cannot be published.

## Games & Creative

### GAME-001 — Only 3 of 87 games are fully formed; the sole published tracing game is a test fixture

**Priority:** P0
**Area:** Content / Games
**Status:** PARTIAL / TEST-FIXTURE-ONLY

**Problem**
Published games are largely unplayable in practice: most have no artwork, almost none have instructions, none has voice-over, none has a recorded content review, and the only published `trace_color` game is a test fixture that production gating hides — so production ships zero tracing/coloring game.

**Evidence**
87 games (19 published, 54 draft, 14 archived). Reachable by `/games` after gating: **10** (8 blocked by a draft parent series, 1 is a fixture); age-appropriate for a 5-year-old: **4**. Strictly complete (non-empty pack + asset + objective + ready `ar` localization): **3**. 18/19 published lack `instructions_ar`; 77/87 lack artwork; 39/87 have an empty `help_system`; `content_reviews` for `entity_type='game'` → **0**. `game-fixture-trace-circle` is `content_class='test_fixture'` **and** published. Objective linkage is degenerate: 6 of 9 Wave-1 games share `objective-world-shape-trace_form`.

**Current behavior**
A child sees ~10 tiles, most with a generic card, no instructions, no voice; a preschooler gets four. Tracing/coloring is absent.

**Expected behavior**
Every published game has a real pack, artwork, localized instructions (voiced for preschool), a distinct learning objective, and a recorded review; test fixtures are never published.

**Implementation scope**
Triage the 19 published games; unpublish or complete each; produce artwork and instructions; assign correct objectives; record reviews; publish a real tracing/coloring game; add a publish-gate rule refusing `content_class='test_fixture'`.

**Dependencies** CONTENT-001 (voice); Media/PlayVeo (EXT-001); CREATIVE-001 (rendering); ADMIN-001 (no game publish endpoint); Human art + pedagogical review.

**Effort** XL

**Acceptance criteria**
- [ ] No `content_class='test_fixture'` row can be published (enforced, with a test).
- [ ] Every published game has artwork, localized instructions and a distinct objective.
- [ ] At least one real tracing and one real coloring game are published and playable.
- [ ] Every published game has a recorded content review.

### CREATIVE-001 — All drawing, coloring and tracing artwork is unrenderable in the app

**Priority:** P0
**Area:** Flutter / Creative Studio / Assets
**Status:** MISSING (rendering path)

**Problem**
The asset map points at `.svg` files, the widgets render with `Image.asset`, no SVG package is present, and the bundle declaration is non-recursive — so none of the 122 shipped vector assets can appear.

**Evidence**
`app_main/lib/features/games/data/drawing_asset_map.dart` maps ~150 ids to `.svg` paths (115 grep hits); consumers use `Image.asset` at `app_main/lib/features/games/engine/trace_color_engine.dart:377`, `free_draw_surface.dart:549`, `creative_studio_page.dart:405`; `flutter_svg` appears in neither `pubspec.yaml` nor `pubspec.lock` (verified: zero matches); 122 `.svg` files exist under `assets/images/drawing/{templates,coloring,covers}/` while `pubspec.yaml:85` declares only the non-recursive `assets/images/drawing/`. Fallback is a grey placeholder (`trace_color_engine.dart:407`).

**Current behavior**
Every tracing, coloring and reference-drawing surface shows a grey placeholder box.

**Expected behavior**
Vector templates render correctly on all target platforms, with subdirectories bundled and a decision recorded on SVG-vs-raster.

**Implementation scope**
Choose SVG rendering (add and pin `flutter_svg`, switch consumers) or convert assets to raster; declare the subdirectories in `pubspec.yaml`; add a test that every id in the asset map resolves to a bundled, loadable asset.

**Dependencies** Flutter; Assets; DECIDE-003 (SVG vs raster).

**Effort** M

**Acceptance criteria**
- [ ] Every id in `drawing_asset_map.dart` loads a real asset at runtime.
- [ ] A test fails if a mapped asset is missing from the bundle.
- [ ] Tracing, coloring and reference-drawing screens display artwork on a device build.

**Do not do**
Do not silently swap in unrelated raster art to make screens look populated.

## Family & Commerce

### PARENT-001 — Parental controls are settable but never enforced, and their ownership gate always fails

**Priority:** P0
**Area:** API / Parent Controls / Trust
**Status:** DISCONNECTED

**Problem**
Screen-time, bedtime and related controls can be written by a parent but no runtime path reads or enforces them; separately, the endpoints gate ownership on a table that has no writer, so in production they return 404 regardless.

**Evidence**
`dashboard/api/src/routes/childSettings.ts:41-56` writes settings; grep for `child_screen_time_daily` across `dashboard/api/src` → **0** readers. Ownership is gated on `children_profiles` at `childSettings.ts:15,37`; `SELECT COUNT(*) FROM children_profiles` → **0** and no writer exists anywhere (the codebase states this at `adminPlanets.ts:26`).

**Current behavior**
The parent dashboard presents controls that do nothing, and in production the requests fail with 404 before even reaching the no-op.

**Expected behavior**
Controls are stored against the canonical child record, enforced server-side at playback/session start, and reflected in the app (bedtime path, autoplay, time limits) with a clear child-facing message when a limit is reached.

**Implementation scope**
Resolve the canonical child source of truth (DATA-001), re-point the ownership gate, implement enforcement at playback/lease issuance and in the app shell, and test each control end to end.

**Dependencies** DATA-001 (blocker); Durable Objects; Flutter; compliance/trust.

**Effort** L

**Acceptance criteria**
- [ ] A daily limit reached server-side refuses new playback with a specific, child-appropriate response.
- [ ] Bedtime windows are enforced server-side, not only displayed.
- [ ] Every control shown in the parent dashboard has a verified enforcement path or is removed from the UI.
- [ ] Tests cover limit-reached and bedtime refusals.

### DATA-001 — Canonical child/progress tables have no writer, so progress, mastery and recommendations are dead

**Priority:** P0
**Area:** Data / API / Architecture
**Status:** DISCONNECTED

**Problem**
`children_profiles`, `watch_progress`, and the D1 `mastery`/`attempts` tables are read by several features but written by nothing; the real state lives inside the `FamilyState` Durable Object. The result is a permanent empty/404 for every dependent feature and empty admin analytics.

**Evidence**
All four tables are 0 rows locally. Grep shows writes only inside the DO's own SQLite (`dashboard/api/src/do/FamilyState.ts:1979,2020`). Readers that depend on them: `childSettings.ts:15,37`, `recommendations.ts:17,21`, `adminMastery`, `adminAnalytics`. The codebase acknowledges the gap at `adminPlanets.ts:26`.

**Current behavior**
Continue-watching, recommendations, mastery reporting, parent reports and child settings all resolve to empty or 404 in production.

**Expected behavior**
One documented source of truth per domain. Either the DO projects into D1 (as `family-events` already does for other domains) or the readers query the DO. No feature reads a table nothing writes.

**Implementation scope**
Decide the pattern per domain (DECIDE-004), extend the existing `family-events` projection to cover children/progress/mastery, re-point readers, and add a startup/CI check that flags any table read by code but written by nothing.

**Dependencies** Durable Objects; Queues; D1; blocks PARENT-001, REC-001, ANALYTICS-002.

**Effort** L

**Acceptance criteria**
- [ ] Each of the four tables is either written by a documented projection or removed and its readers re-pointed.
- [ ] Continue-watching returns real data after playback in a test environment.
- [ ] Admin mastery/analytics pages show data derived from a real writer.
- [ ] A check exists that fails when code reads a table with no writer.

### BILLING-001 — Nothing can be purchased: no IAP path, disabled actions, and 13 locked episodes with no sellable product

**Priority:** P0
**Area:** Flutter / Commerce
**Status:** MISSING

**Problem**
There is no working purchase path anywhere: the membership screen's actions are disabled, the declared IAP dependency is never imported, and the commerce data is a seed skeleton — while paid content is already gated.

**Evidence**
`app_main/lib/features/profile/presentation/pages/membership_page.dart:90` (`onPressed: null` for both upgrade and manage); `in_app_purchase` declared in `pubspec.yaml:28-29` and never imported; `plan_pricing` → 0 rows, 3 `store_products` all `status='inactive'` with `base_price_minor IS NULL`, `entitlements` → 0; yet 13 published episodes have `is_free=0`.

**Current behavior**
A parent who hits the paywall cannot buy anything; the child sees a lock that cannot be opened.

**Expected behavior**
A complete purchase loop: real products and prices, store integration, receipt verification, entitlement grant, restore, and a paywall that reflects live entitlement state.

**Implementation scope**
Define plans/prices, wire store SDKs, implement server-side receipt verification (Google Play service already partially present at `dashboard/api/src/services/googlePlay.ts`), grant entitlements, implement restore/upgrade, and test the gate transition.

**Dependencies** Apple/Google store accounts and review (EXT-003); commerce data; API; Flutter; pricing decision (DECIDE-005).

**Effort** XL

**Acceptance criteria**
- [ ] A test purchase grants an entitlement server-side and unlocks gated content.
- [ ] Restore purchases re-grants entitlement on a fresh install.
- [ ] The paywall reflects live entitlement state, not a local flag.
- [ ] No published paid content exists without a purchasable product.

## Admin

### ADMIN-001 — Stories, books, games and projects can be authored but never published

**Priority:** P0
**Area:** Admin / API / Content
**Status:** MISSING

**Problem**
Only four publish endpoints exist in the entire API (series, episodes, website pages, blog posts). The content types that make up most of the catalogue have no publish path, which is the direct mechanical reason that 0 stories, 0 books and 0 projects are published.

**Evidence**
Publish endpoints found only for series, episodes, web pages and blog posts across `dashboard/api/src/routes/admin*.ts`. `StoryWorkspacePage` shows a readiness tab with no publish action; `QualityPage.tsx:306` renders a "Publish now" button with no `onClick`. D1: stories published 0, books 0, projects 0.

**Current behavior**
Editors can prepare content and see readiness, then have no way to publish it. The apparent content shortage is partly a missing endpoint, not only missing assets.

**Expected behavior**
Each publishable type has a server-side publish endpoint behind a permission and a readiness gate (assets, localization, review, rights), an audit trail, and an admin action wired to it.

**Implementation scope**
Extend the publish-gate library to stories/books/games/projects, add endpoints with permissions and audit, wire the admin buttons, and add tests for gate refusals.

**Dependencies** API; Admin; publish gate; blocks STORY-001, BOOK-001, GAME-001.

**Effort** L

**Acceptance criteria**
- [ ] A story/book/game/project can be published from the admin by an authorized user.
- [ ] Publishing is refused with named blockers when assets, localization, review or rights are missing.
- [ ] Every publish writes an audit row.
- [ ] `QualityPage`'s publish action either works or is removed.

### ADMIN-002 — Home Builder cannot be saved or published, and the app ignores its output anyway

**Priority:** P0
**Area:** Admin / Flutter / Home
**Status:** DISCONNECTED

**Problem**
The Home Builder's primary controls are hardcoded `disabled`, its version history is fabricated, and even if it worked the Flutter app never consumes the resolved configuration — so home layout is not editorially controllable despite a full UI and working endpoints.

**Evidence**
`dashboard/front/src/pages/AppExperiencePage.tsx:259` (content picker `disabled`), `:265` (Save `disabled`), `:266` (Cancel `disabled`); the file's own header at `:20` states `CLIENT_INTEGRATION_MISSING - Builder controls stored config; production App Home currently ignores it`; preview failure silently substitutes a client-side simulation (`:126`). On the app side `resolvedHomeProvider` (`app_main/lib/features/home/application/home_providers.dart:198`) has **no consumers**, and block order is hardcoded twice (`feed_blocks.dart:60-95`, `home_feed.dart:156-260`). Server endpoints `PATCH /home-experience/:id` and `POST /home-experience/:id/rollback` exist with no UI caller.

**Current behavior**
Editors can reorder blocks but cannot save or publish; the child app renders a hardcoded layout regardless.

**Expected behavior**
Editorial home configuration is saved, versioned, previewed truthfully, published, and actually rendered by the app, with a safe fallback when the config is unavailable.

**Implementation scope**
Enable the save/publish/rollback actions against the existing endpoints; replace the fabricated history with real versions; make preview use the server resolver only; consume `resolvedHomeProvider` in the app and delete the duplicated hardcoded ordering.

**Dependencies** Admin; API; Flutter; HOME-001.

**Effort** L

**Acceptance criteria**
- [ ] Saving, publishing and rolling back a home configuration works and is audited.
- [ ] Preview output comes from the server resolver, never a client simulation.
- [ ] The app renders the published configuration, verified on device.
- [ ] Block order exists in exactly one place.

### ADMIN-003 — Admin Sessions screen presents a hardcoded mock array as live sessions, and Revoke does nothing

**Priority:** P0
**Area:** Admin / Security
**Status:** PLACEHOLDER

**Problem**
A security screen shows fabricated session rows and offers revocation controls that are inert, while the real endpoint sits unused — so an operator cannot see or terminate real admin sessions.

**Evidence**
`dashboard/front/src/pages/SessionsPage.tsx:24-28` (`const mock=[...]`, `setRows(mock)`), `:43` per-row Revoke button with no handler, `:38` calls `revokeAdminUserSessions('me')` with an invalid id and swallows the error. The real `GET /admin/users/:id/sessions` (`dashboard/api/src/lib/adminUsers.ts:299`) has no UI caller.

**Current behavior**
The screen always shows two invented devices; a compromised session cannot be identified or revoked from the admin.

**Expected behavior**
Real sessions listed for the authenticated admin (and, with permission, for others), with working single-session and revoke-all actions, and honest error states.

**Implementation scope**
Wire the existing endpoints, remove the mock, implement both revoke actions with confirmation, surface failures, and add a test.

**Dependencies** Admin; API.

**Effort** S

**Acceptance criteria**
- [ ] The list is populated exclusively from the API.
- [ ] Revoking a session invalidates it (verified by a subsequent 401).
- [ ] A failed revoke is shown to the operator.
- [ ] No mock array remains in the file.

## Testing

### TEST-001 — The tests that should have caught the P0 authorization holes are structurally blind

**Priority:** P0
**Area:** Testing / Security
**Status:** PARTIAL

**Problem**
Two suites give false assurance: the route-guard sweep only inspects files named `admin*`, and the CORS suite re-implements the configuration instead of importing the app. No test imports the worker entrypoint at all, so no test exercises real middleware composition.

**Evidence**
`dashboard/api/test/routeGuards.test.mjs:59-61` filters to `admin*.ts`, which is exactly why SEC-001 in `recommendations.ts` was invisible. `dashboard/api/test/cors.test.mjs:6-40` builds its own Hono app copying the config, so deleting `X-Platform` from `dashboard/api/src/index.ts:75` would leave all 8 CORS tests green; the `ALLOWED_ORIGINS` branch has zero coverage. No test imports `src/index.ts`. Zero coverage for media capability tokens, entitlement enforcement, auth HTTP flows, the main `family-events` consumer, and the cron.

**Current behavior**
960 passing tests coexist with three unauthenticated/under-authorized endpoints. The pass count overstates security assurance.

**Expected behavior**
The guard sweep covers every mutating route file; CORS is asserted against the real app; the highest-risk paths (tokens, entitlements, auth, queue consumer, cron) have tests.

**Implementation scope**
Broaden the sweep to all route modules with an explicit allowlist for intentionally public endpoints; rewrite the CORS suite to import `src/index.ts` and cover the origin branch; add contract tests for media tokens, entitlements, auth flows, the consumer and the cron.

**Dependencies** API; pairs with OPS-001 (tests must actually run).

**Effort** M

**Acceptance criteria**
- [ ] The guard sweep fails when any mutating endpoint loses its auth, in any route file.
- [ ] Removing an allowed CORS header fails a test.
- [ ] `ALLOWED_ORIGINS` behaviour is covered for allowed, disallowed and localhost origins.
- [ ] Media token, entitlement, auth-flow, consumer and cron tests exist and run in CI.

**Do not do**
Do not raise the test count without covering these paths; the count is already misleading.


---

# P1 — Production Essentials

## Security & API

### SEC-005 — Rate limiting is advisory and absent on the most abusable endpoints

**Priority:** P1
**Area:** API / Security
**Status:** PARTIAL

**Problem**
The limiter stores counters in per-isolate memory with a best-effort KV write whose errors are swallowed, so limits reset per isolate and are not enforced globally. Several sensitive endpoints are not registered with it at all.

**Evidence**
`dashboard/api/src/lib/rateLimit.ts:11-13,26-31,44-48` (in-memory map, swallowed KV errors). Registration list at `dashboard/api/src/index.ts:93-97` omits asset upload, audio sessions, playback start, analytics ingest, notifications and child settings.

**Current behavior**
A distributed caller can exceed intended limits; brute-force and flood protection is partial.

**Expected behavior**
A durable counter (KV with correct semantics, or a Durable Object) enforcing per-principal and per-IP limits on login, register, reset, audio sessions, playback start, upload, analytics ingest and notification writes.

**Implementation scope**
Replace the store, register the missing routes, surface `Retry-After`, and add tests asserting refusal after N attempts.

**Dependencies** API; KV or a new DO.

**Effort** M

**Acceptance criteria**
- [ ] Limits hold across isolates.
- [ ] All six unprotected endpoint groups are registered.
- [ ] A test proves refusal and `Retry-After`.
- [ ] KV failures are logged, not swallowed.

### SEC-006 — Parent-proof purposes are issuable but never verified, and proof requirements are inconsistent

**Priority:** P1
**Area:** API / Security / Parent Gate
**Status:** PARTIAL

**Problem**
Six parent-proof purposes can be issued but are never checked by any endpoint, and comparable destructive operations require different proof levels.

**Evidence**
`dashboard/api/src/lib/parentAuth.ts:21-35` (purposes), `dashboard/api/src/routes/family.ts:25-37`; `DELETE /creations/:id` requires no proof (`dashboard/api/src/routes/creations.ts:260`) while `/purge` does (`:332`).

**Current behavior**
The parent gate is decorative for those purposes; a child could reach destructive actions that the design intended to gate.

**Expected behavior**
Every purpose is either verified at the corresponding endpoint or removed; destructive operations on a child's data consistently require proof.

**Implementation scope**
Map purpose → endpoint, enforce verification, align the creations delete path, and test each gate.

**Dependencies** API; Flutter (parent gate UX).

**Effort** S

**Acceptance criteria**
- [ ] Each issued purpose is verified somewhere or deleted.
- [ ] Deleting a creation requires the same proof as purging.
- [ ] Tests cover missing/expired/wrong-purpose proof.

### SEC-007 — Media capability tokens are accepted in the query string

**Priority:** P1
**Area:** API / Security / Media
**Status:** PARTIAL

**Problem**
The media endpoint accepts the capability token as a query parameter, so it can leak into logs, referrers and shared URLs.

**Evidence**
`dashboard/api/src/routes/media.ts:19`. The HLS manifest deliberately embeds tokens in URLs (`episodes.ts:435`), which is why the query path exists.

**Current behavior**
Short-lived tokens may be persisted in access logs and observability tooling.

**Expected behavior**
Header-based tokens wherever the player allows; for HLS, short TTLs, one-time or path-scoped tokens, and documented log redaction.

**Implementation scope**
Prefer the `Authorization` header, keep the query path only for HLS with a reduced TTL, and confirm redaction in observability.

**Dependencies** API; Flutter player; STREAM-001.

**Effort** M

**Acceptance criteria**
- [ ] Non-HLS media requests use headers only.
- [ ] HLS token TTL is reduced and documented.
- [ ] Tokens are redacted in logs.

### SEC-008 — Durable Object schemas evolve through bare `try { ALTER } catch {}` with no version marker

**Priority:** P1
**Area:** API / Durable Objects / Data Integrity
**Status:** PARTIAL

**Problem**
Nineteen schema mutations across the two Durable Objects are wrapped in empty catches with no stored schema version, so a partially applied migration is undetectable.

**Evidence**
`dashboard/api/src/do/FamilyState.ts:239-245,291-293,304-305` and equivalents in `IdentityState.ts`.

**Current behavior**
A failed `ALTER` is indistinguishable from an already-applied one; divergence across DO instances cannot be detected.

**Expected behavior**
A stored schema version per DO instance, forward-only migrations applied by version, and failures surfaced.

**Implementation scope**
Add a version row, convert the ALTERs into ordered steps, log failures, and add tests for fresh vs upgraded instances.

**Dependencies** Durable Objects.

**Effort** M

**Acceptance criteria**
- [ ] Each DO reports its schema version.
- [ ] A deliberately failing step is visible, not swallowed.
- [ ] Fresh and upgraded instances converge to the same schema in tests.

## Operations

### OPS-004 — No secret scanning, dependency audit or release gate in the pipeline

**Priority:** P1
**Area:** Operations / Security
**Status:** MISSING

**Problem**
Nothing prevents a secret or a vulnerable dependency from being committed, and there is no release gate tying a deploy to a verified build.

**Evidence**
`.github/workflows/ci.yml` contains lint/test/build steps only (and those are broken — OPS-001). No secret-scanning or `npm audit`/`pub outdated` step. Local secret files are correctly ignored (`git check-ignore` confirms `.dev.vars`, `.secrets.local.txt`, `.env.*`), and no hardcoded credential was found in tracked source — so this is preventative, not remedial.

**Current behavior**
Hygiene depends entirely on individual discipline.

**Expected behavior**
CI blocks commits containing credential-shaped strings, reports dependency advisories, and requires a green pipeline before deploy.

**Implementation scope**
Add secret scanning, dependency audit, and a deploy job gated on the test jobs.

**Dependencies** OPS-001 (CI must run first).

**Effort** S

**Acceptance criteria**
- [ ] A test commit containing a fake key is blocked.
- [ ] Dependency advisories are reported per run.
- [ ] Deploy cannot run on a red pipeline.

### OPS-005 — Repository hygiene: 354 uncommitted paths, committed dev logs, generated artifacts

**Priority:** P1
**Area:** Operations
**Status:** PARTIAL

**Problem**
The working tree is far from clean, and build/run logs plus large generated artifacts are tracked or littering the tree, which makes it impossible to tell what is actually shipped.

**Evidence**
`git status --short` → 354 entries, including deleted vendor directories, `.new` source files (`app_main/lib/features/playback/presentation/playback_page.dart.new`), and committed logs (`dashboard/front/devfront.log` 35.8 kB, `dev-front.log` 34.9 kB, several `dashboard/api/dev*.log` up to 3.9 MB). Local D1 backup dumps and `.wrangler` dry-run outputs sit in the tree.

**Current behavior**
Reviewers cannot distinguish intended changes from residue; the audit itself had to reason about working-tree state rather than HEAD.

**Expected behavior**
A clean tree with intentional commits, logs and dumps ignored, and no `.new`/`.bak` source files.

**Implementation scope**
Triage the 354 paths into commit/ignore/delete, extend `.gitignore` for logs and dumps, and remove stale artifacts.

**Dependencies** Operations; owner review of what should be committed.

**Effort** M

**Acceptance criteria**
- [ ] `git status` is clean after triage.
- [ ] No `*.log` or D1 dump is tracked.
- [ ] No `.new`/`.bak` source files remain.

**Do not do**
Do not force-push, reset or discard uncommitted work without owner confirmation.

### OPS-006 — Deployment and rollback are manual and undocumented

**Priority:** P1
**Area:** Operations
**Status:** MISSING

**Problem**
There is no deploy pipeline, no rollback procedure, and no environment-promotion path; deploys are individual `wrangler` invocations from a workstation.

**Evidence**
`dashboard/api/package.json` deploy scripts only; `wrangler.jsonc` defines just `production` alongside the local default; no deploy job in CI; `dashboard/front/.env.production` is git-ignored, so production frontend configuration exists only on a workstation.

**Current behavior**
A bad deploy has no defined recovery, and production config is not reproducible.

**Expected behavior**
A documented deploy/rollback runbook, CI-driven deploys, and production configuration stored as managed secrets rather than a local file.

**Implementation scope**
Add a gated deploy job, document rollback for Worker/Pages/D1, and move frontend production config into managed configuration.

**Dependencies** OPS-001, OPS-002; Cloudflare (EXT-004).

**Effort** M

**Acceptance criteria**
- [ ] A rehearsed rollback restores the previous Worker version.
- [ ] Production frontend config is reproducible without a developer's machine.
- [ ] Deploys run from CI with an audit trail.

### OPS-007 — The daily cron and health checks are unverified and do almost nothing

**Priority:** P1
**Area:** Operations
**Status:** PARTIAL

**Problem**
A daily cron is configured but its work is minimal and untested, no retention exists for growing tables, and the 12 registered ops services have never produced a health check row.

**Evidence**
`wrangler.jsonc` `triggers.crons: ["0 3 * * *"]`; `dashboard/api/src/scheduled/cleanup.ts:3-17` (no analytics retention); `ops_health_checks` → 0 rows against 12 registered services; no cron test.

**Current behavior**
Unbounded table growth is unmanaged and operational dashboards have no input.

**Expected behavior**
The cron enforces retention on analytics/audit/temporary rows, records health checks, and is covered by a test.

**Implementation scope**
Implement retention windows, populate health checks, add a cron test, and surface failures.

**Dependencies** Cron; D1; ANALYTICS-002.

**Effort** M

**Acceptance criteria**
- [ ] Retention deletes rows past the agreed window.
- [ ] Health checks are recorded for all registered services.
- [ ] A test exercises the scheduled handler.

## Data & Content

### DATA-002 — 91 of 140 tables are empty and 14 are referenced by no code

**Priority:** P1
**Area:** Data / Architecture
**Status:** DEAD-UNUSED

**Problem**
Two-thirds of the schema is unpopulated and a subset is not referenced anywhere in the Worker, which makes it impossible to tell designed-but-unbuilt from abandoned.

**Evidence**
140 tables; 49 populated, **91 empty**; 14 have no reference in `dashboard/api/src` (including the entire `reference_activities`/`reference_steps` pair backing 30 authored coloring activities).

**Current behavior**
Schema, admin screens and docs imply capabilities that have no code path.

**Expected behavior**
Each table is classified as active, planned-with-owner, or deprecated; deprecated ones are documented for removal.

**Implementation scope**
Produce the classification, record it in a schema ownership doc, and open removal tasks for confirmed dead tables.

**Dependencies** D1; owner input for planned-vs-dead (DECIDE-006).

**Effort** M

**Acceptance criteria**
- [ ] Every table has a recorded classification and owner.
- [ ] Tables with no code reference are either wired or scheduled for removal.
- [ ] The classification is regenerable by a script.

**Do not do**
Do not drop any table during this task.

### DATA-003 — Public routes miss the production-content gate; the resolved-home fallback drops the draft guard

**Priority:** P1
**Area:** API / Data / Content Safety
**Status:** PARTIAL

**Problem**
Four public route modules apply no `contentClassPredicate`, and the resolved-home fallback path omits the draft guard, so test fixtures or draft content could be served the moment those types are published.

**Evidence**
No `contentClassPredicate` in `dashboard/api/src/routes/stories.ts`, `books.ts`, `planets.ts`, `recommendations.ts` (compare `series.ts:68,148`, `episodes.ts:118`, `games.ts:178,270`). `dashboard/api/src/routes/homeResolved.ts:26-37` masks a D1 failure as empty and then serves hardcoded blocks without the `is_draft` guard. No leak today only because published stories/books are 0.

**Current behavior**
The safety property holds by accident of empty content, not by construction.

**Expected behavior**
Every public read applies the same fixture/draft gate, verified by a test that publishes a fixture and asserts absence.

**Implementation scope**
Apply the predicate consistently, restore the draft guard in the fallback, and add a cross-route test.

**Dependencies** API; pairs with GAME-001 (fixture publishing).

**Effort** S

**Acceptance criteria**
- [ ] A published `test_fixture` row is invisible on every public endpoint in production mode.
- [ ] Draft content is never served by the resolved-home fallback.
- [ ] One test covers all public route modules.

### DATA-004 — 35 content reviews are pending, none approved, and published content is unreviewed

**Priority:** P1
**Area:** Data / Workflow / Governance
**Status:** PARTIAL

**Problem**
The review workflow exists but has never completed: no approval is recorded anywhere, and all 19 published games have zero review rows — including content in a religious/values context that the documentation requires be reviewed.

**Evidence**
`content_reviews` → 35 rows, all pending, 0 approvals; `entity_type='game'` → 0 rows. Documentation requires sleep review, linguistic review and Islamic governance sign-off (`docs/content/91-islamic-governance.md`, `docs/content/planets/05-qisas/00-story-page-model.md` §13).

**Current behavior**
Content can be published without the review the process mandates, and the audit trail shows no sign-off.

**Expected behavior**
Publishing requires the review types the governance model demands; approvals are recorded with actor and timestamp.

**Implementation scope**
Wire review requirements into the publish gate (ADMIN-001), backfill reviews for anything already published, and report review coverage in the admin.

**Dependencies** ADMIN-001; Human reviewers (HUMAN-001..005).

**Effort** M

**Acceptance criteria**
- [ ] Publishing is refused without the required approvals.
- [ ] Every published item has a recorded review.
- [ ] Review coverage is visible in the admin.

### DATA-005 — Learning objectives are degenerate: six games share one objective, mastery measures the wrong thing

**Priority:** P1
**Area:** Data / Learning
**Status:** PARTIAL

**Problem**
Objective linkage is largely copy-pasted, so mastery and parent reporting attribute unrelated activities to the same skill.

**Evidence**
6 of 9 Wave-1 games share `objective-world-shape-trace_form` (including `sim_lab`, `word_build`, `block_code`); one game has a NULL objective. 57 objectives exist, 7 unused, 11 have no linked skill.

**Current behavior**
Mastery percentages and parent reports are not meaningful.

**Expected behavior**
Each game maps to an objective that matches what it actually teaches; unused objectives are retired or used; skills are linked.

**Implementation scope**
Re-map objectives with pedagogical review, fill the NULL, link skills, and add a data check for suspicious sharing.

**Dependencies** Content; pedagogical review (HUMAN-002); DATA-001 (mastery has no writer).

**Effort** M

**Acceptance criteria**
- [ ] No objective is shared by unrelated engines.
- [ ] No published game has a NULL objective.
- [ ] A check flags an objective used by more than N unrelated engines.

### DATA-006 — Planet artwork is absent server-side and three planets lead nowhere

**Priority:** P1
**Area:** Data / Content / Home
**Status:** PARTIAL

**Problem**
All nine planets have no server-side icon, and three have no published series at all — including the largest slate in the database — so a child can enter a planet and find an empty room.

**Evidence**
All 9 planets have `icon_url IS NULL` (the app ships its own art, so this only breaks server-driven surfaces). `maharat`, `tarikh` and `islamic` have zero published production series; `islamic` holds 15 series (14 draft, 1 archived).

**Current behavior**
Any surface expecting a server planet image renders blank, and three planet destinations are dead ends.

**Expected behavior**
Planets either have server artwork or the field is retired; a planet with no publishable content is hidden or shows an honest "coming soon" state.

**Implementation scope**
Decide client-vs-server planet art (DECIDE-007), populate or retire `icon_url`, and add an empty-planet state or filter.

**Dependencies** Media; Content; Flutter.

**Effort** S

**Acceptance criteria**
- [ ] No planet renders a blank image on any surface.
- [ ] A planet with no published content cannot be entered, or states its state honestly.

### DATA-007 — The rights and licensing model is empty and never consulted at publish time

**Priority:** P1
**Area:** Data / Legal / Governance
**Status:** MISSING

**Problem**
Rights records do not exist and the publish gate does not consult them, while content with known open licence questions is already published.

**Evidence**
`rights_licenses` → 0 rows; no rights predicate in the publish gate; two published games depend on a font whose licence is flagged in the admin by a component that never renders (`dashboard/front/src/components/games/ArabicFontLicenceAlert.tsx`, unreferenced).

**Current behavior**
Live content carries unverified rights, with legal exposure and no record.

**Expected behavior**
Every published asset traces to a rights record; publishing is refused without one; the licence alert is reachable.

**Implementation scope**
Populate rights for existing assets, add a rights check to the publish gate, and surface the alert.

**Dependencies** Legal review (HUMAN-008); ADMIN-001.

**Effort** M

**Acceptance criteria**
- [ ] Publishing is refused when a required rights record is missing.
- [ ] All currently published assets have rights records or are unpublished.
- [ ] The font licence warning is visible in the admin.

## Home & Discovery

### HOME-001 — Most home rails resolve to nothing, and one block points at a client-local file

**Priority:** P1
**Area:** Home / Data / Flutter
**Status:** PARTIAL

**Problem**
Fourteen active home blocks render over data that does not exist, and a seasonal block references an asset path that is not backed by any asset row.

**Evidence**
14 blocks served; `continue_watching`, `continue_drawing`, `recommended` and `new_episodes` all depend on `watch_progress` / creations / analytics, which are 0 rows (DATA-001); 5 of 15 blocks have empty `config_json`; `block-seasonal-winter` points at `assets/images/seasonal/winter.webp`, a client-local path with no `content_assets` row.

**Current behavior**
Home shows headers with empty content beneath them, and a seasonal block whose art depends on client bundling.

**Expected behavior**
A block with no resolvable content is hidden rather than rendered empty; block imagery comes from the asset system.

**Implementation scope**
Hide-when-empty semantics in the resolver and the app, fill or remove empty configs, and migrate the seasonal asset into `content_assets`.

**Dependencies** DATA-001; ADMIN-002; Flutter.

**Effort** M

**Acceptance criteria**
- [ ] No rail renders with a header and zero items.
- [ ] Every block's imagery resolves through the asset system.
- [ ] Blocks with empty configuration are removed or completed.

## Streaming

### STREAM-001 — Quality selection and audio-track switching are parsed but never exposed

**Priority:** P1
**Area:** Flutter / Streaming
**Status:** PARTIAL

**Problem**
The player parses renditions and audio tracks and then ignores them, so there is no quality control and no dubbed-audio switching despite server support and UX documentation.

**Evidence**
`app_main/lib/features/playback/presentation/playback_page.dart:149,255-257,1490` (parsed, unused). Server side has `episode_renditions` and `episode_audio_tracks` (both currently 0 rows — see CONTENT-002).

**Current behavior**
Playback is single-quality, single-audio; on poor networks the child has no recourse.

**Expected behavior**
A quality selector (including Auto) and an audio-track selector when more than one exists, persisted per profile.

**Implementation scope**
Surface both selectors, wire them to the HLS variant/audio selection, persist the preference, and test with multi-rendition fixtures.

**Dependencies** CONTENT-002 (needs real renditions); SEC-002 (manifest gating).

**Effort** M

**Acceptance criteria**
- [ ] With multiple renditions, the selector switches variant and the choice persists.
- [ ] With multiple audio tracks, switching changes the audio without restarting position.
- [ ] Neither control appears when only one option exists.

### STREAM-002 — Subtitles, recap and credits markers are parsed and never used

**Priority:** P1
**Area:** Flutter / Streaming / Accessibility
**Status:** PARTIAL

**Problem**
Subtitle tracks and recap/credits markers are modelled and parsed but have no UI, so there are no captions (an accessibility requirement) and no skip-recap/next-up behaviour.

**Evidence**
`app_main/lib/features/home/data/content_dtos.dart:954-962` (markers parsed, unused); `episode_subtitle_tracks` → 0 rows. Skip-intro and next-episode **are** implemented.

**Current behavior**
No captions are available; recap and credits behave as ordinary playback.

**Expected behavior**
Caption rendering with size/contrast options, skip-recap, and a credits-triggered next-up affordance.

**Implementation scope**
Implement caption rendering and marker-driven affordances; author subtitle tracks for published episodes.

**Dependencies** CONTENT-002; Content authoring; A11Y-001.

**Effort** L

**Acceptance criteria**
- [ ] Captions render and can be toggled and styled.
- [ ] Recap and credits markers drive visible affordances.
- [ ] At least one published episode ships captions.

### STREAM-003 — The in-player rights check is a partial stub

**Priority:** P1
**Area:** Flutter / API / Streaming
**Status:** PARTIAL

**Problem**
The player's rights/territory handling is incomplete, leaving enforcement dependent on the server paths that SEC-002 shows are inconsistent.

**Evidence**
`app_main/lib/features/playback/presentation/playback_page.dart:352-380` (partial stub). The 451 availability policy is implemented server-side but undocumented.

**Current behavior**
Refusals may surface as generic errors rather than a clear explanation.

**Expected behavior**
Territory and rights refusals produce specific, child-appropriate messaging, with the server as the sole authority.

**Implementation scope**
Complete client handling of 402/403/451, remove client-side rights inference, and test each refusal.

**Dependencies** SEC-002; DATA-007.

**Effort** S

**Acceptance criteria**
- [ ] Each refusal code shows a distinct, appropriate message.
- [ ] No entitlement or territory decision is made client-side.

## Stories

### STORY-002 — The bedtime path, brightness curve and camera motion are mandatory in the spec and absent from code

**Priority:** P1
**Area:** Flutter / Stories / Product Differentiation
**Status:** SPEC-DOC-ONLY

**Problem**
The stories planet's differentiating claim — a calming bedtime mode with dimming pages, restricted motion and a no-exit completion screen — exists only in documentation.

**Evidence**
`docs/content/planets/05-qisas/00-story-page-model.md` §5 (brightness curve 1.00 → 0.70), §6 (bedtime path: no autoplay, no next story, no games, sleep timer), §8 (camera motion limits). Grep for `brightness`, `kenburns`, `bedtime` in `app_main/lib` → **0** matches. The reader implements dwell/auto-turn correctly, so the timing foundation exists.

**Current behavior**
Bedtime reading is identical to daytime reading; the documented calming design is unimplemented and the per-page `brightness`/`motion` fields have no consumer.

**Expected behavior**
A bedtime path honouring the brightness curve, motion limits, the two-static-final-pages rule, sleep timer and a terminal completion screen.

**Implementation scope**
Implement the path behind a parent/time trigger, consume the per-page fields, and test the curve, motion limits and completion behaviour.

**Dependencies** Flutter; Content (per-page `brightness`/`motion` values); DECIDE-008 (trigger policy).

**Effort** L

**Acceptance criteria**
- [ ] Brightness descends monotonically to the documented final value.
- [ ] The last two pages have no camera motion.
- [ ] The bedtime completion screen offers no route to further content.
- [ ] A sleep timer stops playback at the chosen interval.

### STORY-004 — Half of all story pages have no narration duration, and two incompatible pacing regimes coexist

**Priority:** P1
**Area:** Content / Stories / Data
**Status:** PARTIAL

**Problem**
`duration_ms` is null for 96 of 194 pages, so advertised story durations rest on estimates, and the dwell values fall into two very different pacing regimes across series.

**Evidence**
`story_pages`: `duration_ms IS NULL` on **96/194**; `dwell_ms` populated 194/194 (migrations 0058-0060). The validator reports 9 of 10 auto-turn stories as `estimated` rather than `measured` (`node dashboard/api/tools/dwell_model.mjs report`). Self-read series carry 3-6 s dwell against 9-18 s in bedtime series.

**Current behavior**
Catalogue durations for most stories are derived from a calibrated estimate, not from audio that exists (there is none — CONTENT-001).

**Expected behavior**
Every published page's `duration_ms` comes from a real audio file, and the validator reports `measured` with every story inside its editorial target.

**Implementation scope**
After narration is produced (CONTENT-001), write measured durations, re-run the allocator, and review the two flagged stories where narration length forces dwell below guidance.

**Dependencies** CONTENT-001; editorial review (HUMAN-004).

**Effort** M

**Acceptance criteria**
- [ ] No published story page has a null `duration_ms`.
- [ ] The validator reports `measured` for every published story.
- [ ] Every published story is PASS against its editorial target, or has a recorded editorial exception.

**Do not do**
Do not pad audio or fake `duration_ms` to reach a target.


## Offline

### OFFLINE-001 — Video and episode downloads have no entry point, so the encrypted download engine is unreachable

**Priority:** P1
**Area:** Flutter / Offline
**Status:** PARTIAL

**Problem**
A complete, tested AES-256-GCM download engine exists, but only audio stories can start a download. No episode or video surface offers a download action, so the downloads screen is permanently empty for video.

**Evidence**
`DownloadRequest(` is constructed in exactly one place: `app_main/lib/features/audio/presentation/pages/audio_player_page.dart:358` (audio stories, correctly gated). `DownloadButton` (`app_main/lib/features/downloads/presentation/download_button.dart:15`) has that single call site. `DownloadsPage` renders its empty state (`app_main/lib/features/profile/presentation/pages/downloads_page.dart:76-82`) for everything else. The engine has real tests (`test/download_engine_test.dart`).

**Current behavior**
Audio downloads work; video downloads cannot be initiated at all.

**Expected behavior**
A download affordance on episode/series surfaces, entitlement-checked, with an offline licence recheck, storage limits and quality choice.

**Implementation scope**
Add the entry points, enforce entitlement and storage limits, handle range-resume, and test the full offline playback path.

**Dependencies** CONTENT-002 (no video exists yet); BILLING-001 (downloads are a paid capability); SEC-002.

**Effort** M

**Acceptance criteria**
- [ ] An entitled parent can download a published episode and play it offline.
- [ ] A non-entitled account cannot start a download.
- [ ] Storage limits and resume are enforced and tested.

### OFFLINE-002 — Cached reader pages and catalogue survive logout and account switching

**Priority:** P1
**Area:** Flutter / Offline / Privacy
**Status:** PARTIAL

**Problem**
Logout clears sessions and media but not the content caches, so cached reader pages and catalogue data persist across accounts on a shared device.

**Evidence**
`app_main/lib/features/auth/application/auth_controller.dart:238-249` performs teardown without clearing `catalog_cache.dart` or the new `reader_page_cache.dart`. Both caches are otherwise correct, with TTLs and honest empty-response semantics.

**Current behavior**
A second family on the same device may see the previous family's cached catalogue and story pages.

**Expected behavior**
All content caches and per-child resume keys are cleared on logout and on account switch.

**Implementation scope**
Extend teardown to every cache and resume key, and add a test asserting no cached content survives logout.

**Dependencies** Flutter.

**Effort** XS

**Acceptance criteria**
- [ ] Logout clears catalogue, reader-page and resume state.
- [ ] Account switch clears the previous child's cached state.
- [ ] A test fails if a new cache is added without teardown.

## Analytics & Notifications

### ANALYTICS-001 — The app has no telemetry transport and no crash reporting

**Priority:** P1
**Area:** Flutter / Analytics / Operations
**Status:** PLACEHOLDER

**Problem**
Analytics and crash reporting are architectural shells: the crash reporter stores to memory and the analytics layer has no transport, so no production signal ever leaves a device.

**Evidence**
`app_main/lib/core/analytics/analytics.dart:77` — `TODO(backend)`, no transport; `app_main/lib/core/crash_reporter.dart:56` — memory-only, empty hook. The privacy allowlist/denylist design is genuinely good and tested; only delivery is missing.

**Current behavior**
Crashes, playback failures and the silent fallbacks in APP-002 are invisible to the operator.

**Expected behavior**
Batched, privacy-filtered event delivery with retry, plus crash reports with release/version context.

**Implementation scope**
Implement transport to the ingest endpoint (after SEC-003 secures it), add batching/retry/offline queueing, and wire crash reporting to a provider.

**Dependencies** SEC-003 (must be secured before the app writes to it); DECIDE-009 (crash provider).

**Effort** M

**Acceptance criteria**
- [ ] Events reach the server and appear in `analytics_events` attributed to the authenticated principal.
- [ ] Events queue offline and flush on reconnect.
- [ ] A crash produces a report with version context.
- [ ] The denylist is enforced client-side and server-side.

### ANALYTICS-002 — Nineteen admin panels display fabricated numbers, and no product metric is currently computable

**Priority:** P1
**Area:** Admin / Analytics / Trust
**Status:** PLACEHOLDER

**Problem**
Operational and product dashboards present invented figures with the same visual weight as real data, while the underlying event tables are empty, so no metric shown is trustworthy.

**Evidence**
19 fabricated metrics/panels documented in the admin audit, including ops telemetry capability, the ops timeline, a "5 minutes before 5xx spike" correlation, every Recommendations KPI, app diagnostics `3/5`, `PackagesPage` plan limits/streams/downloads, games pipeline `20/12/7/3`, engine coverage `12/12/12` and identical per-row verdicts on every game. Underlying data: `analytics_events`, `attempts`, `watch_progress`, `mastery`, `favorites`, `screen_time`, `question_usage` all **0 rows**. `RevenuePage` and `HeroKpis` are honest counter-examples that state `unavailable`.

**Current behavior**
Operators cannot distinguish measured from invented; decisions may be made on fiction.

**Expected behavior**
Every metric is either computed from stored data or explicitly labelled unavailable with a reason, following the `RevenuePage` pattern.

**Implementation scope**
Audit each of the 19 panels; delete or relabel; implement the metrics that become computable once ANALYTICS-001 and DATA-001 land; add a lint/test forbidding literal metric constants in dashboard components.

**Dependencies** ANALYTICS-001; DATA-001.

**Effort** M

**Acceptance criteria**
- [ ] No dashboard number originates from a literal in the component.
- [ ] Unavailable metrics state why.
- [ ] Each remaining metric has a documented query.

### NOTIF-001 — There is no push notification delivery, and the in-app inbox has no production writer

**Priority:** P1
**Area:** API / Flutter / Notifications
**Status:** MISSING

**Problem**
Notifications exist only as a table plus polling, with no FCM/APNs integration and no code path that creates a real notification.

**Evidence**
`notifications` → **0 rows**; the only writer is `POST /notifications/test` (`dashboard/api/src/routes/notifications.ts:29`); grep for FCM/APNs across `dashboard/api/src` returns a single string, and it is a refusal (`adminCampaigns.ts:51`).

**Current behavior**
No new-episode, download-complete, subscription-issue or creative-update notification can be delivered.

**Expected behavior**
Either a real delivery path (device registration, FCM/APNs, preferences, deep links, parent-vs-child routing) or an explicit decision to descope notifications for launch.

**Implementation scope**
Decide scope (DECIDE-010); if in scope, implement registration, delivery, preferences, deep links and the production writers for each event type.

**Dependencies** EXT-005 (FCM/APNs); DECIDE-010.

**Effort** L

**Acceptance criteria**
- [ ] A real event produces a notification without a test endpoint, or notifications are formally descoped and the UI removed.
- [ ] Preferences are honoured.
- [ ] Deep links open the correct destination.

## Localization

### I18N-001 — Localization is architecturally present but effectively unused; the language selector is inert

**Priority:** P1
**Area:** Flutter / Localization
**Status:** PARTIAL

**Problem**
The app has a localization framework and catalogues, yet UI text is overwhelmingly hardcoded Arabic, the locale is pinned in code, and the settings language row is read-only — so no user can change language and en/fr cannot be delivered.

**Evidence**
~1688 hardcoded Arabic literals in Dart against 15 `AppLocalizations.of` call sites; locale pinned at `app_main/lib/app/majarra_app.dart:76`; the same file passes `fr` at `:77` contrary to `app_main/lib/core/l10n/locale_catalog.dart:75-78`; language row read-only at `app_main/lib/features/profile/presentation/pages/settings_page.dart:78-81`. The admin has a comparable problem: ~290 hardcoded Arabic JSX strings across ~36 files, 3 Arabic-only routes, and bilingual concatenations shipped to users (`dashboard/front/src/pages/SecurityPage.tsx:32`).

**Current behavior**
The product is Arabic-only in practice, while documentation and content metadata advertise three languages.

**Expected behavior**
UI strings come from the catalogues, locale follows a user/child preference, and a language switch actually re-renders the app.

**Implementation scope**
Extract literals in priority order (child-facing screens first), unpin the locale, make the selector functional, resolve the `fr` inconsistency, and add a lint/test bounding new hardcoded literals.

**Dependencies** Flutter; Admin; translation review (HUMAN-005).

**Effort** XL

**Acceptance criteria**
- [ ] Switching language changes every child-facing screen.
- [ ] No new hardcoded user-visible literal can be added without failing a check.
- [ ] The advertised locale set matches what the catalogue supports.

### I18N-002 — Declared multi-language content does not exist

**Priority:** P1
**Area:** Content / Localization / Data
**Status:** MISSING

**Problem**
Content rows advertise languages they have no text for, so a language switch would produce empty pages rather than translations.

**Evidence**
`story_page_localizations`: ar 194 / en 0 / fr 0, while 8 stories declare `["ar","en"]`. 40 of 40 series lack `description_en`. 81 of 87 games have no `en`; 18 of 19 published games have no `en`. 29 of 29 coloring steps have no `instruction_en/fr`. Verified no *fake* translations exist (no row where `title_en = title_ar`) — the content is absent, not duplicated.

**Current behavior**
Declared language availability is untrue for every non-Arabic language.

**Expected behavior**
A row declares only languages it can actually serve; the API's language availability metadata reflects reality (it already computes this correctly).

**Implementation scope**
Correct the declared language arrays, then author translations for the launch language set; enforce at the publish gate that a declared language has text.

**Dependencies** Translation authoring (HUMAN-005); ADMIN-001.

**Effort** L

**Acceptance criteria**
- [ ] No content row declares a language with no text.
- [ ] The publish gate refuses a declared-but-empty language.
- [ ] Language availability shown in the app matches the database.

**Do not do**
Do not copy Arabic text into `en`/`fr` fields to satisfy a completeness check.

## Admin

### ADMIN-004 — Creative Studio admin screens call an endpoint that does not exist

**Priority:** P1
**Area:** Admin / API / Creative
**Status:** DISCONNECTED

**Problem**
Three sidebar-linked Creative Studio screens fetch `/api/admin/reference-activities`, which exists nowhere in the API, with the wrong path prefix and no auth header — so the 30 authored coloring activities are unmanageable.

**Evidence**
`dashboard/front/src/pages/CreativeStudioOverviewPage.tsx:11` and `dashboard/front/src/pages/ReferenceDrawingDetailPage.tsx:11` call that path; grep for `reference-activities` or `reference_activities` in `dashboard/api/src` → **0 matches**. The data exists (30 activities, 29 steps) but has no route. The same pages also use Tailwind-style class names that do not exist in `dashboard/front/src/styles`, so they are unstyled.

**Current behavior**
The screens show a permanent spinner or a permanent empty list, and are visually broken.

**Expected behavior**
Real admin endpoints for reference activities and steps with permissions and audit, consumed through the shared API client, with working styles.

**Implementation scope**
Implement the endpoints, switch the pages to the typed client, fix the styling, and add tests.

**Dependencies** API; Admin; CREATIVE-001 (asset rendering); DATA-002.

**Effort** M

**Acceptance criteria**
- [ ] The overview lists the real activities from the API.
- [ ] Detail and step editing persist and are audited.
- [ ] The pages use the project's stylesheet.

### ADMIN-005 — Twenty-eight admin pages disable type checking, including every RBAC and finance screen

**Priority:** P1
**Area:** Admin / Type Safety
**Status:** PARTIAL

**Problem**
A clean `tsc --noEmit` is misleading because 31% of pages opt out, and the opted-out set is precisely the security- and money-critical one.

**Evidence**
28 pages begin with `// @ts-nocheck`, including `TeamAccessPage`, `GrantsPage`, `RoleWorkspacePage`, `TeamsPage`, `BillingPage`, `PackagesPage`, `RevenuePage`.

**Current behavior**
Type errors in permission and billing screens are invisible; refactors can silently break them.

**Expected behavior**
No `@ts-nocheck` in RBAC or finance screens, and a declining budget for the rest.

**Implementation scope**
Remove the directive file by file starting with RBAC and finance, fix the resulting errors, and add a CI check capping the count.

**Dependencies** Admin; OPS-001.

**Effort** L

**Acceptance criteria**
- [ ] Zero `@ts-nocheck` in RBAC and finance pages.
- [ ] CI fails if the count increases.

### ADMIN-006 — Six admin routes/links are broken, two of them on the primary KPI row

**Priority:** P1
**Area:** Admin / Navigation
**Status:** DISCONNECTED

**Problem**
Navigation targets do not match declared routes, and two workspace routes read a parameter the route never supplies, producing empty-string API calls.

**Evidence**
`dashboard/front/src/components/HeroKpis.tsx:59` → `subscriptions` (actual route is `billing`); `HeroKpis.tsx:60` and `dashboard/front/src/pages/OpsPage.tsx:137` → `ops/sla` (actual `ops-sla`); `OpsPage.tsx:144` → `ops/services`; `ops/incidents` has no `:id`; `ops/queues/:name` supplies `name` while the component reads `id`.

**Current behavior**
Clicking the top-level KPIs lands on a not-found state; two workspaces call the API with an empty id.

**Expected behavior**
Every link resolves to a declared route with the parameters the component reads.

**Implementation scope**
Fix the six targets, align parameter names, and add a test that walks every `adminPath` literal against the route table.

**Dependencies** Admin.

**Effort** S

**Acceptance criteria**
- [ ] Every navigation target resolves.
- [ ] No component reads a route parameter the route does not define.
- [ ] A test fails on an unresolvable `adminPath`.

### ADMIN-007 — The richer library screen is unreachable while a stub is routed twice

**Priority:** P1
**Area:** Admin / Dead Code
**Status:** DEAD-UNUSED / DUPLICATED

**Problem**
A 537-line library screen with full CRUD for books, games and projects is not routed at all, while a 118-line stub occupies two routes.

**Evidence**
`dashboard/front/src/pages/LibraryContentPage.tsx` (42.6 kB, full CRUD, contains three dead links at `:492-494`) is absent from `AdminRoutes.tsx`; `LibraryHubPage.tsx` (118 LOC) is routed as both `library` and `library-content`.

**Current behavior**
Editors use a stub while the working implementation is dead code.

**Expected behavior**
One library screen, routed once, with the capabilities the team intends to keep.

**Implementation scope**
Decide which to keep (DECIDE-006 scope), route it, delete the other, and remove the duplicate route.

**Dependencies** Admin.

**Effort** S

**Acceptance criteria**
- [ ] One library route, one component.
- [ ] No dead links remain.

### ADMIN-008 — Fifty-four swallowed errors let a backend outage render as a healthy dashboard

**Priority:** P1
**Area:** Admin / Error Handling / Trust
**Status:** PARTIAL

**Problem**
Secondary reads are wrapped in empty catches, so failures appear as zeros and dashes beneath a badge claiming live data — the operator cannot distinguish an outage from a quiet day.

**Evidence**
54 swallowed errors across 25 files; 14 in `dashboard/front/src/pages/DashboardPage.tsx:129-166` under a "Live from database" badge at `:216`; 7 in `ContentReviewsPage.tsx` including a **status change that fails silently** at `:205`; 6 in `OpsPage.tsx:52-59` whose gaps are then filled by the fabricated telemetry in ANALYTICS-002; `AppExperiencePage.tsx:126` silently substitutes a client-side simulation for a failed preview.

**Current behavior**
Outages are invisible, and at least one mutating action (review status change) can fail with no feedback and no revert.

**Expected behavior**
Every failed read is attributed in the UI; mutating failures are surfaced and reverted; the "live" badge reflects actual success.

**Implementation scope**
Convert swallowed reads into per-panel error states using the existing `PageState` components, fix the review status mutation, remove the simulated preview, and add tests for partial-failure rendering.

**Dependencies** Admin.

**Effort** M

**Acceptance criteria**
- [ ] A failed panel read is visibly attributed, not shown as zero.
- [ ] A failed review status change shows an error and does not appear to succeed.
- [ ] The live-data badge is false when any read failed.

### ADMIN-009 — Mutating buttons are shown without permission gating, so scoped editors collide with 403s

**Priority:** P1
**Area:** Admin / RBAC / UX
**Status:** PARTIAL

**Problem**
The server authorization is sound, but roughly 18 pages render mutating controls without checking the actor's permissions, so scoped users discover their limits through failures.

**Evidence**
All 15 `hasPermission` sites have matching server guards (no UI-only-gated privileged action was found — the inverse of the usual defect), but ~18 pages show create/edit/publish controls with no gate.

**Current behavior**
A scoped editor clicks an action and receives a 403.

**Expected behavior**
Controls the actor cannot use are hidden or disabled with an explanation, while the server remains the authority.

**Implementation scope**
Apply the existing permission helper to mutating controls across the affected pages, and add a test for a scoped role's visible action set.

**Dependencies** Admin; SEC-004.

**Effort** M

**Acceptance criteria**
- [ ] A scoped role sees no action it cannot perform.
- [ ] Server guards remain unchanged and authoritative.

## Search, Recommendations, Performance, Testing

### SEARCH-001 — Search coverage, gating and zero-state are unverified across content types

**Priority:** P1
**Area:** Flutter / API / Search
**Status:** PARTIAL

**Problem**
Arabic normalization and debounce are implemented and tested, but there is no evidence that search covers every content type with correct permission/premium gating, and with no content published its behaviour cannot be observed.

**Evidence**
Arabic normalization tested (`app_main/test/arabic_search_test.dart`); coverage across stories/books/games/planets/creative and premium gating **NOT-VERIFIED** because published stories/books are 0 and most games are gated out.

**Current behavior**
Search returns results from the few published series/episodes/games only; other types are untestable today.

**Expected behavior**
Search covers every published type, respects entitlement and age gating, has a useful zero-state, and works offline against the cache or states that it cannot.

**Implementation scope**
Define the index contract per type, verify gating, implement zero-state and offline behaviour, and add tests per type with fixtures.

**Dependencies** CONTENT-001/002, STORY-001, BOOK-001 (needs content); API.

**Effort** M

**Acceptance criteria**
- [ ] Every published type is discoverable by search.
- [ ] Premium and age gating are enforced server-side in results.
- [ ] A zero-result query produces a helpful state, distinct from an error.

### REC-001 — Recommendations have no behavioural signal and only three editorial rows

**Priority:** P1
**Area:** API / Recommendations
**Status:** PARTIAL

**Problem**
The recommendation surface depends on progress tables that nothing writes and holds only three global editorial rows, so "Because You Watched" and cold-start behaviour cannot function.

**Evidence**
`home_recommendations` → 3 rows (all global, all targeting published series); `recommendations.ts:17,21` read `children_profiles` and `watch_progress`, both 0 rows with no writer (DATA-001). The write endpoint is the unauthenticated one in SEC-001.

**Current behavior**
The recommended rail is either empty or shows the same three editorial items to every child.

**Expected behavior**
Editorial pinning plus behavioural signal once progress exists, with age/language/rights/plan eligibility filtering, completed-content exclusion, an explainable reason, and a defined cold-start.

**Implementation scope**
After DATA-001, implement eligibility filtering and reason generation, define cold-start, and test each filter.

**Dependencies** DATA-001; SEC-001; ANALYTICS-001.

**Effort** M

**Acceptance criteria**
- [ ] Recommendations exclude ineligible content by age, language, rights and plan.
- [ ] Completed content is excluded.
- [ ] Each recommendation carries a reason derived from real data.
- [ ] Cold-start behaviour is defined and tested.

### PERF-001 — The app fetches every catalogue collection with a hard cap of 100 and no pagination

**Priority:** P1
**Area:** Flutter / API / Performance
**Status:** HARDCODED

**Problem**
Catalogue reads request `limit=100` per type with no paging, so the catalogue silently truncates as content grows and payloads scale with the whole library.

**Evidence**
`app_main/lib/features/home/data/majarra_api_client.dart:106,110,124,157`.

**Current behavior**
Invisible today (content is small), guaranteed to truncate later, with no user-visible signal.

**Expected behavior**
Paged or cursor-based catalogue reads with per-rail fetching, and a test proving no silent truncation.

**Implementation scope**
Introduce paging in the API and client, fetch per rail on demand, and assert completeness in tests.

**Dependencies** API; Flutter; HOME-001.

**Effort** M

**Acceptance criteria**
- [ ] More than 100 items of a type are all reachable.
- [ ] Home does not fetch the entire catalogue on launch.
- [ ] A test fails on silent truncation.

### TEST-002 — The two riskiest Flutter surfaces have zero tests

**Priority:** P1
**Area:** Testing / Flutter
**Status:** MISSING

**Problem**
The router's authentication/onboarding guard and the 3261-line playback page — the two places where a defect is most damaging — have no test coverage, while 304 tests cover lower-risk areas.

**Evidence**
No test references `_guardRedirect` (`app_main/lib/app/router/app_router.dart`); no test file targets `app_main/lib/features/playback/presentation/playback_page.dart` (3261 lines).

**Current behavior**
Regressions in access control or playback are caught only by manual use.

**Expected behavior**
Guard tests for every redirect decision, and playback tests for session/lease/refusal/resume/next-episode paths with a fake player.

**Implementation scope**
Add guard tests for each auth/child/PIN state, extract testable playback logic, and add refusal-path tests.

**Dependencies** Flutter; OPS-001.

**Effort** M

**Acceptance criteria**
- [ ] Every router redirect branch is covered.
- [ ] Playback refusal codes (402/403/451/429) are covered.
- [ ] Resume and next-episode behaviour are covered.


---

# P2 — Product & Operational Quality

## Flutter

### APP-005 — Remove dead code and unused dependencies from the app

**Priority:** P2 · **Area:** Flutter · **Status:** DEAD-UNUSED

**Problem** Unused packages, an unreachable duplicate route pair, a leftover `.new` source file and an entirely unused service inflate the binary and confuse maintenance.

**Evidence** Unused pub dependencies: `chewie`, `hive_flutter`, `in_app_purchase` (+android), `url_launcher`. Leftover `app_main/lib/features/playback/presentation/playback_page.dart.new`. `/explore` and `/library` routes are unreachable and duplicated as in-shell pages. `app_main/lib/core/net/connection_status.dart` has no consumers. ~10 API client methods and providers have no callers.

**Current behavior** Dead weight ships; readers cannot tell live code from residue.

**Expected behavior** No unused dependency, route, file or provider remains; `in_app_purchase` stays only when BILLING-001 uses it.

**Implementation scope** Remove after confirming each is genuinely unreferenced; keep dependencies that an approved P0/P1 task will consume.

**Dependencies** BILLING-001 (keeps `in_app_purchase`); APP-008 (keeps `connection_status`).

**Effort** S

**Acceptance criteria**
- [ ] `flutter analyze` clean after removal.
- [ ] No unreferenced route remains in the router.
- [ ] No `.new`/`.bak` files in `lib/`.

### APP-006 — Twelve silent-empty paths make outages look like missing content

**Priority:** P2 · **Area:** Flutter / Error Handling · **Status:** PARTIAL

**Problem** Beyond the catalogue fallback in APP-002, twelve code paths return empty collections on failure, and 103 `catch (_)` handlers hide the cause.

**Evidence** `progress_store.dart:96`, `majarra_api_client.dart:124`, `parent_reports.dart:143-151`, `my_collection_route.dart:29`, `home_providers.dart:218`, `majarra_app.dart:202`, `playback_page.dart:368,456,467,697`, `game_providers.dart:222-234`; 103 `catch (_)` across 35 files.

**Current behavior** A child or parent sees "nothing here" when the real answer is "the request failed".

**Expected behavior** Failure and emptiness are distinct in every user-facing surface; failures are reported once telemetry exists.

**Implementation scope** Convert each path to an error state with retry; keep deliberate best-effort catches but log them.

**Dependencies** ANALYTICS-001; APP-002.

**Effort** M

**Acceptance criteria**
- [ ] Each of the twelve paths distinguishes failure from empty.
- [ ] Every remaining silent catch has a comment justifying it.

### APP-007 — Navigation controls open the wrong destination

**Priority:** P2 · **Area:** Flutter / Navigation · **Status:** DISCONNECTED

**Problem** A search affordance navigates home, and two tablet rail labels open unrelated destinations.

**Evidence** `app_main/lib/features/home/presentation/pages/explore_page.dart:33` calls `context.go('/')` for search; `adaptive_home_shell.dart:110-121` labels (مقاطع / بحث) map to Explore/Library, contradicting `home_destinations.dart:46-51`.

**Current behavior** Tapping search returns the child to home; tablet users reach unexpected screens.

**Expected behavior** Every control opens its labelled destination on phone, tablet and TV shells.

**Implementation scope** Fix the targets, unify the destination table, and add a test walking labels to routes.

**Dependencies** Flutter.

**Effort** S

**Acceptance criteria**
- [ ] Search opens search on every shell.
- [ ] Every rail label matches its route in a test.

### APP-008 — There is no offline indicator despite a complete connectivity service

**Priority:** P2 · **Area:** Flutter / Offline / UX · **Status:** DEAD-UNUSED

**Problem** Connectivity monitoring exists and is tested but nothing consumes it, so the app never tells a child or parent that it is offline.

**Evidence** `app_main/lib/core/net/connection_status.dart` has no consumers; `test/connection_status_test.dart` covers it.

**Current behavior** Offline failures appear as generic errors or empty content.

**Expected behavior** A persistent, child-appropriate offline indicator, and offline-aware empty states.

**Implementation scope** Add a shell-level banner, use the status in error states, and reflect cached-content mode.

**Dependencies** APP-002; OFFLINE-002.

**Effort** S

**Acceptance criteria**
- [ ] Losing connectivity shows an indicator within a few seconds.
- [ ] Offline error states differ from server-error states.

### APP-009 — TV pairing is an honest placeholder

**Priority:** P2 · **Area:** Flutter / TV · **Status:** PLACEHOLDER

**Problem** The TV pairing screen shows a fixed `— — —` code and has no endpoint behind it.

**Evidence** `app_main/lib/features/.../tv_pairing_page.dart:37-50`.

**Current behavior** TV sign-in cannot be completed.

**Expected behavior** Either a real pairing flow (code issuance, polling, device binding) or removal of the screen until TV is in scope.

**Implementation scope** Implement pairing endpoints and device binding, or hide the entry point.

**Dependencies** API; DECIDE-006 (TV scope).

**Effort** M

**Acceptance criteria**
- [ ] A pairing code is issued by the server and binds a device, or the screen is not reachable.

## Performance

### PERF-002 — Query patterns that will not scale: N+1 HMAC, unbounded reads, whole-collection DO fetches

**Priority:** P2 · **Area:** API / Performance · **Status:** PARTIAL

**Problem** Several hot paths do per-item work or read unbounded collections and filter in the Worker.

**Evidence** `episodes.ts:425-435` (per-rendition DB read + HMAC inside a loop); `adminTeams.ts:235` (unbounded `tasks` query); `family.ts:145,169,257` (whole-collection DO reads filtered in the Worker); `media.ts:19` (token in query string, see SEC-007).

**Current behavior** Acceptable at current data volumes; degrades with content and family growth.

**Expected behavior** Batched reads, bounded queries with pagination, and DO-side filtering.

**Implementation scope** Batch the rendition asset reads, paginate admin lists, push filters into the DO, and measure before/after.

**Dependencies** API; SEC-002.

**Effort** M

**Acceptance criteria**
- [ ] Manifest generation issues one asset query, not one per rendition.
- [ ] No admin list endpoint is unbounded.
- [ ] DO reads return filtered results.

### PERF-003 — App performance has never been profiled

**Priority:** P2 · **Area:** Flutter / Performance · **Status:** NOT-VERIFIED

**Problem** No profiling evidence exists for the surfaces most likely to stutter, and image weight is unaudited.

**Evidence** No profiling artefacts in the repository; `assets/` contains multi-megabyte PNGs (planet art up to 1.4 MB); Story Reader, Home and game canvases are unmeasured.

**Current behavior** Performance claims cannot be made or refuted.

**Expected behavior** A profiling pass on low-end Android for Home, Story Reader, playback and one drawing engine, with recorded baselines and an image-weight budget.

**Implementation scope** Profile, record baselines, compress/convert oversized images, and fix the worst rebuild paths.

**Dependencies** Flutter; device access.

**Effort** M

**Acceptance criteria**
- [ ] Baseline frame timings recorded for four surfaces on a low-end device.
- [ ] No bundled image exceeds the agreed budget.
- [ ] Regressions are detectable against the baseline.

## Accessibility

### A11Y-001 — Text scaling and small fixed-size UI are likely to break layouts

**Priority:** P2 · **Area:** Flutter / Accessibility · **Status:** PARTIAL

**Problem** Semantics, touch targets and reduced motion are handled in many places, but text scaling is almost unhandled while rails have fixed heights and some labels are 10-11 px.

**Evidence** 114 `Semantics(` across 43 files, 26 reduced-motion checks, 33 minimum-touch-target references — but only **1** `textScaler` occurrence, alongside fixed-height rails and 10-11 px labels.

**Current behavior** At large system font sizes, content is likely to clip or overflow (unverified on device).

**Expected behavior** Layouts tolerate the platform's largest supported text scale without clipping, and no user-facing label is below the minimum legible size.

**Implementation scope** Audit fixed heights, adopt scalable typography, raise minimum label sizes, and add tests at large text scales.

**Dependencies** Flutter; A11Y-002 for verification.

**Effort** M

**Acceptance criteria**
- [ ] Key screens render without clipping at maximum text scale in a widget test.
- [ ] No user-facing label below the agreed minimum size.

### A11Y-002 — Accessibility has never been verified on a device or with assistive technology

**Priority:** P2 · **Area:** Flutter / Admin / Accessibility · **Status:** NOT-VERIFIED

**Problem** All accessibility evidence is code-shape only; no screen-reader, contrast, keyboard or TV-remote testing has been performed on either surface.

**Evidence** The Flutter and Admin audits both mark screen reader, contrast and remote navigation as NOT-VERIFIED. The admin has an `axe-core`/Playwright harness covering ~7 of 114 routes, excluded from CI, whose screenshots are byte-identical within a viewport.

**Current behavior** No conformance claim can be made.

**Expected behavior** A recorded pass with TalkBack/VoiceOver, measured contrast, keyboard and remote traversal, against a stated WCAG target for a children's product.

**Implementation scope** Define the target, run assisted testing on both surfaces, fix findings, and put the admin harness into CI across more routes.

**Dependencies** Device/assistive access; HUMAN-011.

**Effort** L

**Acceptance criteria**
- [ ] A documented screen-reader pass exists for the main child journeys.
- [ ] Contrast measurements recorded against the target.
- [ ] The admin a11y harness runs in CI over the main modules.

## Admin

### ADMIN-010 — Consolidate meaningful duplication in the admin

**Priority:** P2 · **Area:** Admin · **Status:** DUPLICATED

**Problem** Several capabilities exist twice, and one dead variant competes with the live one, raising the cost of every change.

**Evidence** Two list-state hooks (`useUrlListState` used by 31 pages vs `useListQuery` used by 0); two view-mode switchers (`DataViews.tsx`, `ViewSwitcher.tsx`); three upload idioms (`api.uploadAssetFile`, `MediaPicker`, inert buttons at `DrawingAuthoringPage.tsx:105`, `ReferenceDrawingDetailPage.tsx:26`); two thumbnail components; publish gating in `PublishReadinessDialog` and again in `QualityPage`; two API-call idioms (typed vs `(api as any).x?.()` with swallowing). `AdvancedFilters` and `ListTools` were checked and are complementary, not duplicated.

**Current behavior** Contributors pick arbitrarily; fixes land in one copy.

**Expected behavior** One chosen implementation per capability; the untyped swallowing idiom eliminated.

**Implementation scope** Choose per capability, migrate call sites, delete the loser, and forbid the `(api as any)` idiom by lint.

**Dependencies** ADMIN-008 (same call sites).

**Effort** M

**Acceptance criteria**
- [ ] One list-state hook, one view switcher, one upload path, one publish-readiness computation.
- [ ] No `(api as any)` calls remain.

### ADMIN-011 — Remove dead admin components and wire or retire orphan server endpoints

**Priority:** P2 · **Area:** Admin / API · **Status:** DEAD-UNUSED

**Problem** Several components are unreferenced, one is deliberately silenced, and eight server endpoints have no UI caller.

**Evidence** Unreferenced: `components/games/EnginePreview.tsx`, `components/games/ArabicFontLicenceAlert.tsx`, `components/visualStyles/VisualStylePicker.tsx`, `hooks/useListQuery.ts`. `DashboardPage.tsx:20-21` imports `BulkOpsPanel` then discards it with `void _BulkOpsPanel`. Endpoints with no caller: `DELETE /assets/:id` (`adminAssets.ts:335`), `PATCH|DELETE /skills/:id` (`adminCatalogue.ts:158,197`), `PATCH|DELETE /questions/:id` (`adminQuestions.ts:168,203`), `GET /users/:id/sessions` (`adminUsers.ts:299`), `POST /tts/assets` (`adminTts.ts:150`), `POST /home-experience/:id/rollback` and `PATCH /home-experience/:id` (`adminAppExperience.ts:59,78`).

**Current behavior** Capability exists on the server that no operator can reach; components rot.

**Expected behavior** Each orphan endpoint is either wired to a UI or documented as API-only; dead components are removed.

**Implementation scope** Wire the valuable ones (sessions → ADMIN-003, home-experience → ADMIN-002, licence alert → DATA-007), remove the rest.

**Dependencies** ADMIN-002, ADMIN-003, DATA-007.

**Effort** S

**Acceptance criteria**
- [ ] No unreferenced component remains.
- [ ] Every admin endpoint is reachable from the UI or marked API-only.

### ADMIN-012 — Responsive support is verified for 7 of 114 routes by a harness excluded from CI

**Priority:** P2 · **Area:** Admin / Responsive · **Status:** NOT-VISUALLY-VERIFIED

**Problem** Only a small fraction of admin routes has any viewport evidence, the harness does not run in CI, and its screenshots are byte-identical within each viewport, which undermines the evidence itself.

**Evidence** Browser harness covers ~7 of 114 routes; excluded from CI; identical screenshots per viewport (flagged for human review). The remaining 107 routes are unverified at 1366×768 / 1440×900 / 1920×1080.

**Current behavior** No defensible responsive claim for the admin.

**Expected behavior** The main modules verified at the three target widths, in CI, with meaningful screenshots.

**Implementation scope** Fix the harness so screenshots differ per route, extend coverage to the main modules, run in CI, and review output.

**Dependencies** OPS-001; A11Y-002 (same harness).

**Effort** M

**Acceptance criteria**
- [ ] Screenshots differ per route and are archived per run.
- [ ] The main modules are covered at all three widths in CI.

### ADMIN-013 — Story Builder authoring loop has unverified gaps

**Priority:** P2 · **Area:** Admin / Stories · **Status:** PARTIAL

**Problem** The builder exposes narration duration, dwell in seconds and estimated page experience correctly, but bulk image upload, automatic audio matching by page number, stable-id reordering and pre-publish error lists are not verified end to end.

**Evidence** Dwell/duration controls confirmed in `dashboard/front/src/pages/StoryBuilderPage.tsx` (seconds input, narration and estimated-experience readouts). The documented minimum builder capabilities (`docs/content/planets/05-qisas/00-story-page-model.md` §13) — bulk upload, audio auto-match, stable page IDs, pre-publish error list, three-device preview — are NOT-VERIFIED.

**Current behavior** Authoring a full story likely requires manual per-page work.

**Expected behavior** The documented builder minimum, with a pre-publish blocker list feeding ADMIN-001.

**Implementation scope** Verify each capability, implement the missing ones, and connect the blocker list to the publish gate.

**Dependencies** ADMIN-001; MEDIA-001.

**Effort** M

**Acceptance criteria**
- [ ] Bulk page image upload assigns pages in order.
- [ ] Audio files match pages automatically with a manual override.
- [ ] Reordering uses stable page IDs and never breaks text/audio linkage.
- [ ] A pre-publish blocker list is shown and matches the server gate.

## Data, Media & AI

### DATA-008 — Empty game packs and archived rows with `{}` payloads pollute the games domain

**Priority:** P2 · **Area:** Data / Games · **Status:** PARTIAL

**Problem** A meaningful share of game rows carry empty JSON payloads and empty help systems, making counts and readiness reporting unreliable.

**Evidence** 14 archived games have empty packs; 39 of 87 have an empty `help_system`; several packs are `{}`/`[]`.

**Current behavior** Dashboards count rows that cannot be played, which is one input to the fabricated readiness in ANALYTICS-002.

**Expected behavior** A pack is either valid against its engine schema or the row is not counted as content.

**Implementation scope** Validate packs against the engine schemas, mark or archive invalid ones, and exclude them from readiness counts.

**Dependencies** GAME-001; ANALYTICS-002.

**Effort** S

**Acceptance criteria**
- [ ] Every non-archived game pack validates against its engine schema.
- [ ] Readiness counts exclude invalid packs.

### DATA-009 — The website/blog surface is entirely unpublished and structurally empty

**Priority:** P2 · **Area:** Data / Website · **Status:** PARTIAL

**Problem** Nineteen web pages exist as drafts with no sections and no SEO metadata, so the public marketing surface has no content while the CMS for it is built.

**Evidence** `web_pages` → 19, all draft; `web_page_sections` → 0; `seo_meta` → 0. Site mode is `construction`.

**Current behavior** The public site cannot be published from the CMS.

**Expected behavior** Either authored pages with sections and SEO, or an explicit decision that the marketing site is out of scope for this repository.

**Implementation scope** Decide ownership (DECIDE-006), then author or descope.

**Dependencies** Content; DECIDE-006.

**Effort** M

**Acceptance criteria**
- [ ] Every published web page has sections and SEO metadata, or the surface is descoped.

### MEDIA-001 — Asset metadata is incomplete: 115 of 119 assets report zero bytes

**Priority:** P2 · **Area:** Media / Data · **Status:** PARTIAL

**Problem** Nearly every asset row lacks a real size, and image dimensions/variants are unverified, so the Media Library cannot report weight, and clients cannot size layouts from metadata.

**Evidence** 115 of 119 `content_assets` rows have `size_bytes = 0`; all 30 reference-activity assets are also zero-byte; variants and image optimization are NOT-VERIFIED.

**Current behavior** Storage reporting and layout hints are unusable; a zero size may indicate a failed ingest.

**Expected behavior** Ingest records real size, dimensions, mime and checksum; a check flags zero-byte rows.

**Implementation scope** Backfill metadata from R2, fix the ingest path, and add a data check.

**Dependencies** R2; Media Library.

**Effort** M

**Acceptance criteria**
- [ ] No ready asset has a zero size.
- [ ] Ingest records size, dimensions and checksum.
- [ ] A check fails on zero-byte ready assets.

### MEDIA-002 — Orphan assets, missing references and raw key exposure are unaudited

**Priority:** P2 · **Area:** Media / Security · **Status:** NOT-VERIFIED

**Problem** There is no routine that reports assets with no links, links pointing at missing assets, or places where a raw R2 key is exposed to an operator or client.

**Evidence** Referential integrity across the 19 main relationships is clean (0 orphans), but asset-link coverage, orphan assets and raw-key exposure in admin views were not fully verified; the admin audit notes raw IDs shown instead of names in several screens.

**Current behavior** Storage drift and key leakage would go unnoticed.

**Expected behavior** A scheduled report of orphan assets, broken links and unreferenced R2 objects; no raw key in any UI.

**Implementation scope** Add the report, surface it in the admin, and replace raw keys with names/thumbnails.

**Dependencies** MEDIA-001; OPS-007 (cron).

**Effort** M

**Acceptance criteria**
- [ ] A report lists orphan assets and broken links.
- [ ] No admin screen displays a raw R2 key.

### AI-001 — The Content Factory spends money and has no documentation, runbook or spend policy

**Priority:** P2 · **Area:** AI Production / Operations / Cost · **Status:** MISSING (documentation & controls)

**Problem** A substantial AI production subsystem — queue, cost ledger, spend approvals, QC gates — exists with essentially no documentation anywhere in 301 markdown files, so cost exposure and failure handling are undefined.

**Evidence** `dashboard/api/migrations/0057_content_factory.sql` (8 tables), `dashboard/api/src/routes/adminContentFactory.ts` (~48 kB), `dashboard/api/src/queue/contentFactory.ts` (~30 kB), `dashboard/api/src/lib/contentFactory*.ts`, `tools/content-factory/**`; grep across all `.md` → **1 incidental mention**.

**Current behavior** No spec, no runbook, no documented spend limits or approval policy; behaviour is known only by reading code.

**Expected behavior** A written spec and runbook covering job lifecycle, retries, DLQ handling, QC gates, provenance, cost ledger semantics and approval thresholds — plus enforced spend caps.

**Implementation scope** Document the subsystem, define and enforce spend caps and approval thresholds, and add alerting on cost and failure rates.

**Dependencies** DECIDE-006 (scope/ownership); EXT-001/EXT-002 (providers).

**Effort** M

**Acceptance criteria**
- [ ] A spec and runbook exist and match the code.
- [ ] A spend cap is enforced server-side and tested.
- [ ] Cost and failure alerts are defined.

**Note** This becomes **P0** the moment production jobs are enabled at volume, because there is currently no enforced ceiling on provider spend.

### AI-002 — Generation providers are integrated but not connected end to end into the Media Library

**Priority:** P2 · **Area:** AI Production / Media · **Status:** PARTIAL

**Problem** PlayVeo and TTS integrations exist along with extensive local tooling, but nothing they produce has landed in the asset system, so the pipeline has never been demonstrated end to end.

**Evidence** `tools/playveo/**`, `tools/tts/**` (~90 scripts across `tools/`), `dashboard/api/src/services/contentFactoryProvider.ts`, `googleTts.ts`; yet `content_assets` contains 0 audio and 0 video assets and 115 of 119 image rows are zero-byte.

**Current behavior** Generation happens outside the product; ingestion is manual and unproven.

**Expected behavior** A generation job produces an asset that appears in the Media Library with provenance, QC status and correct metadata, ready to link.

**Implementation scope** Complete the ingestion path, record provenance, and demonstrate one end-to-end job per media type.

**Dependencies** AI-001; MEDIA-001; EXT-001; EXT-002.

**Effort** L

**Acceptance criteria**
- [ ] One generated image, one audio and one video asset reach the Media Library with provenance and real metadata.
- [ ] Failed jobs are visible with a reason.

## Cross-cutting

### SEC-009 — A Durable Object is bound, migrated and exported but unreachable

**Priority:** P2 · **Area:** API / Dead Code · **Status:** DEAD-UNUSED

**Problem** `StoryCollab` is fully wired into configuration and the entrypoint but has no route, and its identity model would trust a client-asserted user id if it were ever exposed.

**Evidence** `dashboard/api/src/index.ts:196` (exported), `wrangler.jsonc` binding + migration tag `v3`, `dashboard/api/src/do/StoryCollab.ts:17-27` (self-asserted `user_id`).

**Current behavior** Unused surface carrying a latent authorization flaw.

**Expected behavior** Either removed (binding, migration tag and class), or exposed only after identity is derived from the authenticated session.

**Implementation scope** Decide (DECIDE-006); if kept, derive identity server-side before any route exists.

**Dependencies** Durable Objects; note that removing a DO migration tag requires care.

**Effort** S

**Acceptance criteria**
- [ ] Either no `StoryCollab` binding remains, or it is reachable with server-derived identity and tests.

### SEC-010 — Two email senders disagree on provider precedence

**Priority:** P2 · **Area:** API / Email · **Status:** DUPLICATED

**Problem** Two implementations choose providers in opposite order, so delivery behaviour depends on which module a caller happens to use.

**Evidence** `dashboard/api/src/services/email.ts:146-152` versus `dashboard/api/src/lib/email.ts:170-171`.

**Current behavior** Verification and reset emails may take different paths with different failure modes.

**Expected behavior** One sender with one precedence rule, one retry policy and one logging contract.

**Implementation scope** Consolidate, migrate callers, and test both provider configurations.

**Dependencies** EXT-006 (email provider).

**Effort** S

**Acceptance criteria**
- [ ] One email module remains.
- [ ] Provider precedence is documented and tested.

### CREATIVE-002 — Board autosave persists a 1×1 placeholder image

**Priority:** P2 · **Area:** Flutter / Creative · **Status:** PLACEHOLDER

**Problem** Autosave writes a one-pixel PNG instead of the child's artwork, so saved boards are effectively lost.

**Evidence** `app_main/lib/features/games/presentation/pages/board_editor_page.dart:152,170`.

**Current behavior** A child's saved board cannot be restored or shared meaningfully.

**Expected behavior** Autosave captures the real canvas at an appropriate resolution, locally and (if enabled) to the creations bucket.

**Implementation scope** Capture the canvas, store it, and verify restore and share.

**Dependencies** Creations R2 bucket; CREATIVE-001.

**Effort** S

**Acceptance criteria**
- [ ] A saved board restores with its artwork.
- [ ] Sharing exports the real image.

### CREATIVE-003 — The authored coloring library has no usable assets or steps

**Priority:** P2 · **Area:** Content / Creative · **Status:** PARTIAL

**Problem** Thirty reference activities are marked ready, but every asset is zero-byte, most have no steps, and no step has an asset — so the library cannot be used even once an API exists.

**Evidence** 30 activities all `ready`; 30/30 assets `size_bytes = 0`; 22/30 have no steps; 0/29 steps have any asset.

**Current behavior** "Ready" content is unusable; combined with ADMIN-004 it is also unmanageable.

**Expected behavior** Each activity has real artwork and complete steps before being marked ready.

**Implementation scope** Re-ingest assets, author missing steps, and add a readiness rule.

**Dependencies** ADMIN-004; MEDIA-001; CREATIVE-001.

**Effort** M

**Acceptance criteria**
- [ ] No activity is `ready` without artwork and steps.
- [ ] Step artwork loads in the app.

### OPS-008 — Feature flags have no inventory, and some are effectively permanent

**Priority:** P2 · **Area:** Operations / Configuration · **Status:** PARTIAL

**Problem** Flags are split across environment variables, remote config and code constants with no single inventory, so it is unclear which are live, which are dead and which are unsafe to flip.

**Evidence** `INCLUDE_TEST_FIXTURES` is an environment variable that correctly fails closed in production (`dashboard/api/src/lib/contentClass.ts:29-38`); the admin exposes both `remote-config` and `feature-flags` nav entries pointing at one route (`Sidebar.tsx:146,147`); app-side gates are code constants; no inventory document exists.

**Current behavior** Flag state must be inferred by reading three systems.

**Expected behavior** One inventory listing name, default, environment, consumer, admin controllability and lifecycle, with dead flags removed.

**Implementation scope** Produce the inventory, delete dead flags, and route real flags through one mechanism.

**Dependencies** Admin; API; Flutter.

**Effort** S

**Acceptance criteria**
- [ ] Every flag appears in the inventory with a consumer and a lifecycle.
- [ ] Dead flags are removed.
- [ ] Duplicate nav entries are resolved.

### TEST-003 — Admin test coverage is about 15% and omits every high-consequence flow

**Priority:** P2 · **Area:** Testing / Admin · **Status:** PARTIAL

**Problem** Fifteen test files cover 100 pages, and none covers publishing, RBAC, workflow, Home Builder, games operations, billing, ops or sessions.

**Evidence** 15 test files / 284 tests versus 100 page components; named zero-coverage flows listed in the admin audit.

**Current behavior** The screens that change content state and permissions are unprotected by tests.

**Expected behavior** Coverage for publish, RBAC visibility, workflow transitions, Home Builder save/publish and billing display.

**Implementation scope** Add tests per flow with mocked API contracts, prioritising publish and RBAC.

**Dependencies** ADMIN-001, ADMIN-002, ADMIN-003, SEC-004; OPS-001.

**Effort** M

**Acceptance criteria**
- [ ] Publish, RBAC visibility and workflow transitions have tests.
- [ ] Tests run in CI.

### TEST-004 — There is no visual or golden regression coverage on either surface

**Priority:** P2 · **Area:** Testing · **Status:** MISSING

**Problem** No golden tests exist for the app and no meaningful visual baseline exists for the admin, so layout regressions (including RTL) are invisible until noticed by hand.

**Evidence** No golden test files in `app_main/test`; admin screenshots are byte-identical within a viewport (ADMIN-012).

**Current behavior** Layout and RTL regressions ship silently.

**Expected behavior** Golden tests for key child screens in both directions, and a working admin visual baseline.

**Implementation scope** Add goldens for reader, home, player controls and one game; fix and extend the admin harness.

**Dependencies** ADMIN-012; OPS-001.

**Effort** M

**Acceptance criteria**
- [ ] Goldens exist for at least four child screens in ar and en.
- [ ] A deliberate layout change fails a golden.

---

# P3 — Future / Optional

> Do not build these yet. They are recorded so that documentation claiming them can be marked as future rather than missing.

### STORY-006 — Read Along mode with sentence-level highlighting
**Priority:** P3 · **Area:** Flutter / Stories · **Status:** SPEC-DOC-ONLY
**Problem** The documented third reading mode requires sentence timing that does not exist. **Evidence** `docs/content/planets/05-qisas/00-story-page-model.md` §3-4 (phase 2); `timing_cues` empty on all 194 localizations. **Current behavior** Two modes exist (Read to Me, Read myself). **Expected behavior** Sentence highlighting driven by authored timing, with dwell applied only after narration completes. **Implementation scope** Timing authoring tool, schema population, reader integration. **Dependencies** CONTENT-001; a waveform authoring tool. **Effort** L
**Acceptance criteria** - [ ] Highlighting follows real audio. - [ ] Auto-turn still waits for actual completion, then dwell.

### STORY-007 — Silent story mode (no text, no audio)
**Priority:** P3 · **Area:** Flutter / Stories · **Status:** SPEC-DOC-ONLY
**Problem** The documented fourth mode is unimplemented. **Evidence** same doc §4 (phase 2). **Current behavior** Absent. **Expected behavior** Image-only reading with manual turning. **Implementation scope** Reader mode plus mode picker entry. **Dependencies** STORY-001. **Effort** S
**Acceptance criteria** - [ ] Mode hides text and audio and never auto-turns.

### BOOK-003 — Comics panel-by-panel reading
**Priority:** P3 · **Area:** Flutter / Books · **Status:** SPEC-DOC-ONLY
**Problem** Panel geometry and panel-by-panel navigation are documented as phase 2; the `panels` layout deliberately renders one authored image with bubble overlays. **Evidence** `docs/content/planets/05-qisas/00-story-page-model.md` §9; `app_main/lib/features/reader/presentation/pages/story_reader_page.dart` `_panelsLayout`. **Current behavior** Whole-page comic rendering only. **Expected behavior** Panel coordinates with zoom and per-panel dialogue. **Implementation scope** Schema for panel geometry, authoring, reader navigation. **Dependencies** BOOK-001. **Effort** L
**Acceptance criteria** - [ ] Panels are authored and navigable with per-panel audio.

### STREAM-004 — DRM, HDCP and offline licences
**Priority:** P3 · **Area:** Streaming / Security · **Status:** SPEC-DOC-ONLY
**Problem** Documentation asserts DRM/HDCP protection and an offline licence endpoint as shipped; none exists. **Evidence** `docs/APP_FILTERS_FEATURES_PAGES.md:48` claims it; `app_main/lib/core/security/screen_capture_guard.dart:12` is a screen-capture flag only; grep for Widevine → docs only. **Current behavior** Screen-capture flag plus capability tokens; no DRM. **Expected behavior** A DRM decision driven by licensing requirements, not by documentation. **Implementation scope** Provider selection, packaging, licence server, offline licences. **Dependencies** EXT-004; licensor requirements; DECIDE-006. **Effort** XL
**Acceptance criteria** - [ ] A licensing requirement exists before any DRM work starts. - [ ] Documentation stops claiming DRM until then.

### APP-010 — Tablet two-page spread
**Priority:** P3 · **Area:** Flutter / Reader · **Status:** OWNER-DECISION
**Problem** The spec mandates a landscape two-page spread; the code deliberately renders a single page. **Evidence** page-model §7 versus the reader's single-page layout. **Current behavior** One page in landscape. **Expected behavior** Either the spread or a documented decision to drop it. **Implementation scope** Landscape layout plus auto-turn across two pages. **Dependencies** DECIDE-006. **Effort** M
**Acceptance criteria** - [ ] Spread implemented, or the spec updated to match the product decision.

### APP-011 — TV shell and remote navigation completion
**Priority:** P3 · **Area:** Flutter / TV · **Status:** PARTIAL
**Problem** A TV shell exists but remote mappings, focus order and the documented TV reading modes are unverified. **Evidence** `tv_home_shell.dart`; page-model §7 TV table; APP-009 pairing placeholder. **Current behavior** Unverified on a TV device. **Expected behavior** Full remote control with correct focus and back-with-progress behaviour. **Implementation scope** Focus traversal, remote mappings, device testing. **Dependencies** APP-009; device access. **Effort** L
**Acceptance criteria** - [ ] Every documented remote button behaves as specified on hardware.

### I18N-003 — French across app, admin and content
**Priority:** P3 · **Area:** Localization · **Status:** MISSING
**Problem** French is referenced in code and content metadata but has no content and no admin support. **Evidence** `majarra_app.dart:77` passes `fr` against `locale_catalog.dart:75-78`; `fr` localization rows → 0; no `fr` admin. **Current behavior** French is advertised and undeliverable. **Expected behavior** Either full French support or removal of every French claim. **Implementation scope** Translation, content authoring, admin locale. **Dependencies** I18N-001, I18N-002; DECIDE-006. **Effort** XL
**Acceptance criteria** - [ ] French either works end to end or appears nowhere.

### REC-002 — Behavioural/personalised recommendations beyond rules
**Priority:** P3 · **Area:** Recommendations · **Status:** SPEC-DOC-ONLY
**Problem** Documentation implies personalisation that the system cannot support without behavioural data. **Evidence** REC-001; DATA-001. **Current behavior** Editorial rows only. **Expected behavior** Rule-based personalisation first; anything described as AI must be evidenced. **Implementation scope** After REC-001 and real signal, evaluate ranking. **Dependencies** REC-001; ANALYTICS-001. **Effort** L
**Acceptance criteria** - [ ] No surface claims personalisation it cannot compute.

### CREATIVE-004 — Collaborative drawing/story sessions
**Priority:** P3 · **Area:** Creative / Realtime · **Status:** DEAD-UNUSED
**Problem** A collaboration Durable Object exists with no product definition. **Evidence** SEC-009. **Current behavior** Unreachable. **Expected behavior** A defined product need before any realtime work. **Implementation scope** Product definition first. **Dependencies** SEC-009; DECIDE-006. **Effort** L
**Acceptance criteria** - [ ] A written product definition exists before implementation.

### ADMIN-014 — Saved views, bulk operations and calendar maturity
**Priority:** P3 · **Area:** Admin · **Status:** PARTIAL
**Problem** Saved views, bulk actions and calendar/timeline views exist unevenly across modules. **Evidence** `ListTools` used by 28 of 100 pages; `BulkOpsPanel` imported and discarded (`DashboardPage.tsx:20-21`). **Current behavior** Inconsistent operator ergonomics. **Expected behavior** Consistent behaviour on the high-volume modules. **Implementation scope** Extend to the modules that need it after P0/P1. **Dependencies** ADMIN-010. **Effort** M
**Acceptance criteria** - [ ] The high-volume modules share one saved-view and bulk-action pattern.

### NOTIF-002 — Campaign and rich notifications
**Priority:** P3 · **Area:** Notifications / Growth · **Status:** MISSING
**Problem** Campaign tooling exists in the admin while delivery does not. **Evidence** `adminCampaigns.ts:51` refuses push; NOTIF-001. **Current behavior** Campaigns cannot be delivered. **Expected behavior** Campaigns only after NOTIF-001. **Implementation scope** Depends on NOTIF-001. **Dependencies** NOTIF-001; EXT-005. **Effort** M
**Acceptance criteria** - [ ] No campaign UI implies a delivery channel that does not exist.


---

# Documentation Cleanup

> Docs are **evidence**, not truth. Three documents dated 2026-08-15 disagree with each other on asset counts (0 vs 119), episode counts (33 vs 81) and engine counts (5 vs 12), so recency cannot resolve a dispute. Verify against code and the database. **Do not delete any document** — supersede it.

### DOCS-001 — Correct the reports that certify content states the database contradicts
**Priority:** P1 · **Area:** Documentation · **Status:** OUTDATED
**Problem** Completion reports are being used as evidence of a state that does not exist, which is how "published, assets ready" claims persist against an empty database.
**Evidence** `FLUTTER_APP_STATUS.md:34,160` certifies `story-bird-home` as published with 8/8 images and AR/EN narration ready; the database says `draft`, all 8 pages have `image_asset_id IS NULL`, and 0 audio assets exist anywhere. It also contradicts `ACT-S1_PRODUCTION_HANDOFF.md:5`, which honestly states nothing was uploaded. 27 report-vs-reality and 12 doc-vs-doc contradictions are itemised in `.audit/D_docs.md` §6.
**Expected behavior** Each contradicted claim is corrected in place or marked superseded with a pointer to the verifying query.
**Effort** S · **Dependencies** none
**Acceptance criteria** - [ ] No root report asserts a publication or asset state that a stated query contradicts. - [ ] Each corrected claim cites the query used.

### DOCS-002 — Regenerate `FEATURE_MATRIX.md` and all content counts from live sources
**Priority:** P1 · **Area:** Documentation · **Status:** OUTDATED
**Problem** The primary admin status document is wrong on route count (67 vs 114 actual) and on 7 of its 8 "MISSING" modules; only `/school` remains a stub.
**Evidence** `docs/FEATURE_MATRIX.md:12,77-84` versus `dashboard/front/src/AdminRoutes.tsx` and `src/pages/*`.
**Expected behavior** Counts and module states are generated by a script from routes and the database, not hand-maintained.
**Effort** M · **Dependencies** OPS-001 (run it in CI)
**Acceptance criteria** - [ ] A script regenerates the matrix. - [ ] CI fails when the committed matrix is stale.

### DOCS-003 — Retire superseded architecture language (Home V2, `autoTurnAfterMs`, Postgres/RLS, phantom file paths)
**Priority:** P2 · **Area:** Documentation · **Status:** OUTDATED
**Problem** Documents describe architecture that no longer exists or never did, so new contributors implement against a phantom system.
**Evidence** `DATABASE_V2_SCHEMA.sql:565-598` describes Postgres row-level security (the system is D1/SQLite); `docs/APP_FILTERS_FEATURES_PAGES.md:43,46` references `core/offline/offline_service.dart` and `game_page.dart`, neither of which exists; retired `autoTurnAfterMs` language persists in several story specs; Home V2 is deleted in code.
**Expected behavior** Superseded sections carry a banner naming the current design.
**Effort** M · **Acceptance criteria** - [ ] No doc references a non-existent file path. - [ ] No doc presents `autoTurnAfterMs` or Home V2 as current.

### DOCS-004 — Document the undocumented subsystems
**Priority:** P2 · **Area:** Documentation · **Status:** MISSING
**Problem** Fifteen implemented clusters have no documentation, including money-spending and security-relevant ones.
**Evidence** Content Factory (AI-001), ~90 `tools/**` scripts, the dwell model, the `min_app_version` release gate, the identity/account-lifecycle Durable Object, Creative Studio, the 451 availability policy, and 14 app routes absent from the pages map.
**Expected behavior** Each has at least a purpose, contract, failure modes and owner.
**Effort** M · **Dependencies** AI-001
**Acceptance criteria** - [ ] Every subsystem above has a document. - [ ] Each names an owner.

### DOCS-005 — Resolve the 3520 unchecked checkboxes into either tasks or closed items
**Priority:** P2 · **Area:** Documentation · **Status:** PARTIAL
**Problem** Documentation carries 3520 unchecked checkboxes across 164 files, 681 TODO/pending/placeholder hits across 139 files, 104 blocker markers across 35 files and 68 phase-staging markers across 34 files, so nothing distinguishes live work from historical intent.
**Evidence** grep counts recorded in `.audit/D_docs.md` §5.
**Expected behavior** Acceptance checklists for shipped work are closed; genuinely open items are represented here rather than only in prose.
**Effort** L · **Acceptance criteria** - [ ] Checklists for shipped features are closed. - [ ] Every remaining open item maps to a task ID or is marked historical.

### DOCS-006 — De-duplicate the stories planet specification
**Priority:** P3 · **Area:** Documentation · **Status:** DUPLICATED
**Problem** The stories planet is specified in more than one place with divergent detail (including the default reading mode: the spec says Read to Me, the code defaults to Read myself).
**Evidence** `docs/content/planets/05-qisas/00-story-page-model.md` §4 versus `app_main/lib/features/reader/presentation/pages/story_reader_page.dart` (`_mode = ReadingMode.readMyself`), plus a root-level Arabic stories document.
**Expected behavior** One canonical page model; others link to it.
**Effort** S · **Acceptance criteria** - [ ] One canonical document. - [ ] The default reading mode is consistent between spec and code (or the divergence is a recorded decision).

---

# Technical Debt

Consolidated debt already captured as tasks — listed here so it can be scheduled as a theme rather than rediscovered:

| Theme | Tasks | Note |
|---|---|---|
| Silent error handling | APP-002, APP-006, ADMIN-008, SEC-008 | 103 `catch (_)` in the app, 54 swallowed in the admin, 29 in the API, 19 of them bare DO `ALTER` catches |
| Fabricated data in UI | ADMIN-002, ADMIN-003, ANALYTICS-002, DATA-008 | 19 admin panels, one mock session list, one simulated preview, one fabricated version history |
| Dead code | APP-005, ADMIN-007, ADMIN-011, SEC-009, DATA-002 | 91 empty tables, 14 unreferenced tables, 5 dead admin modules, 1 dead DO, unused pub packages |
| Duplication | ADMIN-010, SEC-010, HOME-001 | Two list hooks, three upload idioms, two email senders, block order in two places |
| Type-safety opt-outs | ADMIN-005 | 28 pages, including all RBAC and finance screens |
| Test integrity | TEST-001, TEST-002, TEST-003, TEST-004 | Passing counts overstate assurance; the guard sweep and CORS suite are structurally blind |
| Repository hygiene | OPS-005 | 354 uncommitted paths, committed logs, `.new` files, D1 dumps in-tree |
| Hardcoded product data | APP-003, APP-004, PERF-001, HOME-001, ANALYTICS-002 | See the Top 20 hardcodes list in `KIRO_LAST_REPORT.md` |

---

# Human Review Tasks

> Non-engineering work. Do not assign these to an implementation queue; they gate content publication.

| ID | Review | Why it is required | Blocks |
|---|---|---|---|
| **HUMAN-001** | Islamic/Sharia authority review | `docs/content/91-islamic-governance.md` requires sign-off for values and Islamic content; the `islamic` planet holds the largest slate (15 series) and none is published | DATA-004, GAME-001, content publication |
| **HUMAN-002** | Pedagogical review of learning objectives and mastery model | Objectives are degenerate (6 games share one) and mastery reporting is therefore meaningless | DATA-005 |
| **HUMAN-003** | Art direction review of story and game artwork | 194 story pages have no art; 77 of 87 games have none; consistency and age-appropriateness must be judged, not inferred | STORY-001, GAME-001 |
| **HUMAN-004** | Audio/narration review (voice, pacing, calm register) | Narration does not exist yet; the calibrated 3.52 Arabic letters/second register must be approved before bulk generation | CONTENT-001, STORY-004 |
| **HUMAN-005** | Linguistic review (Arabic) and translation review (en/fr) | Content declares languages it does not have; translation must be authored, not machine-copied | I18N-002, I18N-001 |
| **HUMAN-006** | Scientific review where stories touch science | The page model requires an explicit simile form when a story could contradict a science episode | STORY-001 |
| **HUMAN-007** | Historical review for the history planet | Accuracy claims in `docs/content/planets/07-tarikh/**` require a qualified reviewer | content publication |
| **HUMAN-008** | Legal/rights review: music, fonts, licensed assets | `rights_licenses` is empty; two published games depend on a font with an open licence question | DATA-007 |
| **HUMAN-009** | Privacy/child-safety review (COPPA-class obligations) | Analytics accepts unauthenticated child identifiers today; retention is undefined | SEC-003, OPS-007 |
| **HUMAN-010** | Sleep/child-development review of the bedtime path | The calming design is a product claim with a child-wellbeing dimension | STORY-002 |
| **HUMAN-011** | Accessibility verification with assistive technology | No screen-reader, contrast or remote testing has ever been done | A11Y-002 |
| **HUMAN-012** | Editorial review of the two stories whose dwell falls below guidance | `lost-star` and `old-lantern` need either shorter text or acceptance of a shorter viewing pause | STORY-004 |

---

# External Dependency Tasks

> Progress here is not controlled by engineering. Track separately and do not report as internal gaps.

| ID | Dependency | Current state | Launch blocker? | Action |
|---|---|---|---|---|
| **EXT-001** | PlayVeo (image/video generation) | Integrated in tooling and the Content Factory; API key present in local dev only; nothing generated has reached the asset system | Yes, indirectly — it is the intended source of most artwork | Confirm production key, quota and cost ceiling; prove one end-to-end ingest (AI-002) |
| **EXT-002** | Google AI Studio / Google TTS | Service code exists (`services/googleTts.ts`); narration measured and calibrated; **0 audio assets produced** | Yes — no narration means no pre-reader product | Confirm production credentials, voice licensing and per-minute cost; run the narration batch (CONTENT-001) |
| **EXT-003** | Apple App Store / Google Play (IAP + review) | `in_app_purchase` declared and never used; Google Play service partially present; 3 inactive store products | Yes — nothing is purchasable | Create products, complete store setup, budget for review cycles (BILLING-001) |
| **EXT-004** | Cloudflare (Workers, D1, R2, KV, Queues, Pages, DNS) | Production Worker route `api.majarra.app/*` and `cdn.majarra.app` configured; remote D1/R2 state unverified | Yes — remote migration parity is unresolved | Verify remote D1/R2 read-only, then execute OPS-002 |
| **EXT-005** | FCM / APNs | No integration at all | Only if launch promises notifications | Decide via DECIDE-010 before any work |
| **EXT-006** | Email delivery (Workers `send_email` / Resend) | Two divergent senders; verification and reset URLs point at `majarra.app` | Yes — email verification gates registration | Consolidate (SEC-010) and verify deliverability end to end |
| **EXT-007** | Arabic font licensing | An admin licence warning component exists but never renders; two published games depend on the font | Yes for those titles | Resolve the licence (HUMAN-008) and surface the warning |

---

# Owner Decision Tasks

> Each needs a decision, not an implementation. A recommended default is given so work is not blocked indefinitely.

### DECIDE-001 — Approve the remote database reconciliation plan
**Question** May we inspect and then reconcile the remote D1 migration ledger, given that local records three migrations whose files are gone and omits three that were applied by direct execute?
**Why** Any `migrate:remote` in the current state risks failing or replaying a destructive archive `UPDATE`.
**Options** (a) read-only inspection now, plan next, execute after sign-off; (b) execute immediately; (c) rebuild remote from a verified dump.
**Recommended** (a). **Impact** Blocks every schema change reaching production. **Related** OPS-002.

### DECIDE-002 — Guest/demo mode: remove or make real?
**Question** Should a signed-out visitor be able to enter the app at all?
**Why** A guest path with a fabricated child ships today and fails at every authenticated call.
**Options** (a) remove; (b) server-backed trial with a real child; (c) keep, gated to non-release builds.
**Recommended** (a) for launch, revisit as (b). **Impact** Trust and first-run experience. **Related** APP-001.

### DECIDE-003 — SVG or raster for drawing templates?
**Question** Add an SVG renderer, or convert the 122 vector templates to raster?
**Why** No drawing artwork renders today.
**Options** (a) add `flutter_svg`; (b) convert to raster at multiple densities; (c) hybrid.
**Recommended** (a) — the assets are authored as vectors and scale across canvas sizes. **Impact** All creative surfaces. **Related** CREATIVE-001.

### DECIDE-004 — Canonical source of truth for child, progress and mastery
**Question** Should the Durable Object project into D1, or should readers query the DO?
**Why** Four tables are read but never written, so several features are permanently empty.
**Options** (a) extend the existing `family-events` projection; (b) read through the DO; (c) hybrid — DO authoritative, D1 projection for analytics only.
**Recommended** (c), which matches the existing projection pattern. **Impact** Parent controls, recommendations, mastery, admin analytics. **Related** DATA-001.

### DECIDE-005 — Launch pricing, plan structure and what is free
**Question** What are the plans, prices, device/stream/download limits, and what stays free?
**Why** `plan_pricing` is empty, three products are inactive with no price, yet 13 published episodes are already gated.
**Options** to be proposed by the owner. **Recommended** a single paid tier plus a free sample set, decided before store setup. **Impact** BILLING-001, EXT-003, paywall copy.

### DECIDE-006 — Confirm launch scope: which surfaces are in, which are deferred
**Question** Which of these are in launch scope — TV, French, marketing website CMS, notifications, DRM, comics, collaborative drawing, the richer library screen?
**Why** Each has partial code and documentation that currently reads as a gap rather than a decision.
**Recommended** Launch as an Arabic-first phone/tablet product: stories, episodes, games and creative; defer TV, French, DRM, comics, collaboration and notifications. **Impact** Removes roughly a third of apparent gaps from the launch critical path. **Related** all P3 tasks.

### DECIDE-007 — Planet and content artwork: client-bundled or server-delivered?
**Question** Should planet art stay bundled in the app, or be served from the asset system?
**Why** All nine planets have a null server icon while the app ships its own art, so any server-driven surface renders blank.
**Options** (a) bundled and retire the field; (b) server-delivered with a bundled fallback.
**Recommended** (b) for content, (a) for the nine fixed planets. **Impact** DATA-006, MEDIA-001.

### DECIDE-008 — Bedtime path trigger policy
**Question** Should the bedtime path be time-triggered, parent-toggled, or both?
**Why** The documented calming design has no trigger defined in code.
**Recommended** Parent toggle plus an optional time window. **Impact** STORY-002, PARENT-001.

### DECIDE-009 — Crash and telemetry provider
**Question** Which provider for crash reporting and analytics delivery, given child-privacy constraints?
**Why** The app currently reports nothing anywhere.
**Recommended** First-party ingest for product events (already designed with an allowlist) plus a privacy-reviewed crash provider. **Impact** ANALYTICS-001, HUMAN-009.

### DECIDE-010 — Are notifications in launch scope?
**Question** Ship push notifications, or remove the notification surfaces for launch?
**Why** There is no delivery path at all, but admin campaign tooling and an in-app inbox exist.
**Recommended** Remove from launch scope and hide the surfaces. **Impact** NOTIF-001, NOTIF-002, EXT-005.

---

# Deferred / Do Not Build Yet

- All **P3** tasks.
- Anything depending on **DECIDE-006** until scope is confirmed.
- DRM (**STREAM-004**) until a licensor actually requires it — the current documentation claim is not a requirement.
- Personalised recommendations (**REC-002**) until real behavioural data exists (**DATA-001**, **ANALYTICS-001**).
- Collaborative features (**CREATIVE-004**) until a product definition exists.
- Removal of the 91 empty tables and 14 unreferenced tables until each is classified (**DATA-002**) — do not drop tables opportunistically.
- Any content publication until its publish gate and review requirements exist (**ADMIN-001**, **DATA-004**).

---

# Completion Tracking

## Batch 5 — completed 2026-08-15

Verified: API **1078 tests pass** (+62), tsc clean, dry-run builds 1888 KiB · Admin tsc clean, **297 tests / 17 files**, build OK · Flutter analyze clean, **333 tests pass** (+15). Full detail in `KIRO_LAST_REPORT.md` → *P0 Batch 5*.

| Task | What landed | Evidence |
|---|---|---|
| **ADMIN-002** ✅ | The Home Builder was a write-only screen whose own controls did not work. Save/Cancel/Publish/Rollback and the content picker were all literal `disabled`; version history was two invented rows; `PATCH` returned 200 for an id that did not exist; ids came from `Date.now()`; "rollback" restored a snapshot that had only ever held `{id, block_type, title_ar}` and therefore **erased** targeting and config; reorder accepted partial lists; nothing was audited; and the resolver existed twice with different rules so the preview could not match production. One module (`lib/homeExperience.ts`) now owns block types, targeting, config, scheduling and resolution, shared by the admin preview and `/api/v1/home/resolved`. Real immutable versions live in the **existing** `home_experience_versions` table, so no migration was needed. Flutter's hardcoded sliver order is gone: six rows that the widget emitted directly are now configurable block types, and `homeLayoutProvider` consumes the resolved contract while never throwing | `src/lib/homeExperience.ts`, `src/routes/adminAppExperience.ts`, `src/routes/homeResolved.ts`, `front/src/pages/AppExperiencePage.tsx`, `lib/features/home/application/home_layout.dart`, `.../home_providers.dart`, `.../feed_blocks.dart`, `.../home_feed.dart`, `test/homeExperience.test.mjs` (27), `test/homeBuilderE2E.test.mjs` (16), `homeBuilder.test.tsx` (10), `home_layout_test.dart` (12) |
| **CONTENT-003** ✅ | `seasons.episode_count` was a planning figure that every surface rendered as a number of episodes. Counts are now derived from canonical rows everywhere — `total_episodes`, `published_episodes`, `available_episodes` — and the plan is exposed as `planned_episode_count`, never as content, never to a child-facing surface. Writing `episode_count` is refused with a 400. The public series detail no longer selects it at all. New publish-gate rule: a **published** season claiming more than it holds blocks; the same gap on an unpublished season warns; a published season with zero episodes blocks. **No migration** — the column keeps its name and the honest naming happens in the DTOs | `src/lib/episodeCounts.ts`, `src/lib/publishGate.ts`, `src/routes/series.ts`, `src/routes/adminContent.ts`, `src/routes/adminCatalogue.ts`, `src/routes/adminPublishGate.ts`, `front/src/pages/SeasonsPage.tsx`, `lib/features/home/data/local_catalog.dart`, `test/episodeCounts.test.mjs` (19), `local_catalog_counts_test.dart` (3) |

### Corrections to my own audit

- **The "83 phantom episodes" figure was wrong; the verified total is 91.** `.audit/E_data.md:388-394` ran the query that produced the season count (17) but not one for the episode sum. It enumerated nine seasons (61) and abbreviated the remaining eight as «plus 8 more at 4/0 or 2/0», adding them as 22 — they actually total 30. The season count was correct; only the sum was not.
- **A second instance of the same defect was found on the client.** The bundled offline catalogue declared 8/10/7/12/6 episodes against **seven** bundled `EpisodeItem`s — 43 advertised, 7 shipped — and `series_details_page.dart` prefers the declared figure over the loaded list. Corrected and pinned by a test.
- **Two Home Builder defects were worse than recorded.** Rollback did not merely fail, it destroyed state; and the admin preview did not merely lack features, it filtered by different rules than production, so it could show an order a child would never receive.

## Batch 4 — completed 2026-08-15



Verified after the batch: API **1016 tests pass**, `tsc --noEmit` clean, `wrangler deploy --dry-run` builds · Flutter analyze clean, **318 tests pass** · Admin tsc clean, **287 tests pass**, build OK.

| Task | What landed | Evidence |
|---|---|---|
| **ADMIN-003** ✅ | The Sessions screen no longer shows a hardcoded array of two invented devices with an inert Revoke. Three **self-scoped** endpoints were added — list, revoke one, revoke others — each resolving the caller from the presented token and constraining every statement to that `user_id`, so there is no user id in any path and nothing to escalate. Revoking the current session from this screen is refused (that is what logout is for), and revoke-others deliberately spares the current session so a review click cannot sign you out. The raw token is never returned; the current session is identified by hash comparison | `src/routes/adminAuth.ts`, `front/src/lib/api.ts`, `front/src/pages/SessionsPage.tsx`, `test/routeGuards.test.mjs` |
| **APP-004** ✅ | The forced-update gate and the `X-App-Version` header both used a hardcoded `'0.1.0'`, so the gate could never fire and version analytics were fed a constant. Both now read `AppVersion`, loaded once at startup before any request goes out. A failed read resolves to `0.0.0` — **older than every published minimum** — so an unreadable version errs towards prompting an update rather than towards allowing an unsupported build to run. The `catch (_) {}` that hid check failures now reports through `CrashReporter` | `lib/core/env/app_version.dart`, `lib/app/majarra_app.dart`, `lib/main.dart`, `lib/features/home/data/majarra_api_client.dart`, `pubspec.yaml`, `test/app_version_test.dart` (10 tests) |

**The guard sweep earned its keep.** Adding the session endpoints broke `every mutating admin handler carries an authorization guard` immediately — which is the sweep working, since three new mutations had appeared with no `requirePermission`. They are genuinely self-scoped, so they are now **recorded exemptions with reasons** rather than silently allowed, and a new test pins the property that makes them safe: no user id in the path, every statement bound to the resolved caller, no token hash returned to the client. This is the same discipline the file already applied to `logout` and `change-password`.

**`package_info_plus` was declared, not added.** It was already resolved in `pubspec.lock` as a transitive package and is now pinned to that exact version (`9.0.1`), so the dependency graph is unchanged — the analyzer was correctly refusing a direct import of an undeclared package.

## Batch 3 — completed 2026-08-15

Verified after the batch: API **1015 tests pass**, `tsc --noEmit` clean, `wrangler deploy --dry-run` builds · Flutter analyze clean, **308 tests pass** · Admin tsc clean, **287 tests pass**, build OK.

| Task | What landed | Evidence |
|---|---|---|
| **ADMIN-001** ✅ | Publish endpoints now exist for **stories, books, games and projects** — the four publishable types that had none. One router, one contract: `requireAdmin` → `requirePermission('publish')` → server-side readiness gate → recorded state change, with warnings preserved in the audit row and blockers returned in full on 409. The `QualityPage` "Publish now" button, which had no handler at all, is wired to them and surfaces the blocker list rather than a bare failure | `src/routes/adminPublish.ts`, `src/index.ts`, `front/src/lib/api.ts`, `front/src/pages/QualityPage.tsx`, `test/adminPublish.test.mjs` (12 tests), `test/entrypoint.test.mjs` |

**What this does and does not unblock.** The gate already understood all six types (`lib/publishGate.ts` → `PUBLISHABLE_TYPES`); nothing was calling it for four of them. So "0 published stories" was partly a missing endpoint, not only missing assets. With the endpoint in place, the gate now correctly **refuses** those stories because their pages have no artwork and no narration — which is CONTENT-001 and STORY-001, and is the honest answer. ADMIN-001 removes the mechanical blocker; it does not create content.

**A deliberate divergence worth reviewing.** This handler **fails closed** when `evaluateFor` returns null, while the existing series and episode handlers treat that as `'not evaluated'` and publish anyway (`admin.ts:731`, `:1031`). Existence is already established before the gate runs, so a null result means the gate did not run — and publishing content the gate could not evaluate is the exact failure the gate exists to prevent. The two older handlers should be aligned to this; that is left as a follow-up rather than folded in, because tightening a live publish path deserves its own change and its own review.

## Batch 2 — completed 2026-08-15

Verified after the batch: API **1002 tests pass**, `tsc --noEmit` clean, `wrangler deploy --dry-run` builds (1853 KiB) · Flutter analyze clean, **308 tests pass** · Admin tsc clean, **287 tests pass**.

| Task | What landed | Evidence |
|---|---|---|
| **SEC-003** ✅ | Attribution is no longer taken from the caller: `parent_id` comes from the session only, `child_id` is verified against `FamilyState` ownership (403 if not owned), and an anonymous caller may write **only** `app_open` and **only** with no identifiers. The PII denylist regex over serialized JSON is replaced by a **key allowlist** with scalar-only values and length bounds. `/api/v1/analytics/*` is registered with a new `analyticsLimit` quota. The daily cron now enforces a 180-day retention window | `src/routes/analyticsIngest.ts`, `src/lib/rateLimit.ts`, `src/index.ts`, `src/scheduled/cleanup.ts`, `test/analyticsIngest.test.mjs` (10 tests) |
| **SEC-002** ✅ | The HLS manifest now **requires an existing lease** instead of fabricating one. It revalidates that lease through the same `/playback/heartbeat` DO call the heartbeat uses, so plan and concurrency are re-checked on every manifest fetch; it enforces territory (451); tokens are bound to the verified `lease.lease_id`; and the fallback that served the primary private asset when no renditions existed is gone. The playback session embeds the lease in the `stream_url` it returns, so the client is unchanged. The per-rendition asset query was also collapsed from N+1 into one `IN (…)` read | `src/routes/episodes.ts`, `test/hlsManifest.test.mjs` (10 tests) |
| **OPS-009** ✅ | 302 extensionless relative imports rewritten across 73 files, each verified to resolve to a real file before rewriting, plus one TypeScript parameter property removed from the dead `StoryCollab` DO. `await import('../src/index.ts')` now works | whole of `dashboard/api/src`, `src/do/StoryCollab.ts` |
| **TEST-001** ✅ *(extended)* | With the entrypoint importable, a real entrypoint suite now asserts what only a mounted app can show: CORS applied to `/api/*`, origin refusal, rate-limit registration on analytics and auth, the retired unauthenticated recommendations write being unreachable, `requireAdmin` refusing anonymously **once an admin is seeded**, and that two-segment admin literals are not shadowed by generic `:id` routes | `test/entrypoint.test.mjs` (9 tests) |

**Notes worth keeping**

- The entrypoint suite found two things on its first run. One was a test bug (a GET on a POST-only route is a correct 404). The other is a real property worth stating: with `admin_credentials` empty, `requireAdmin` allows the documented pre-seed break-glass path — so an assertion written against an empty database would have concluded, wrongly, that the guard was open. The suite now tests both postures explicitly. This is the same fresh-install state **OPS-003** reports.
- Retention of 180 days for `analytics_events` is a **policy default, not a legal determination**. It needs confirmation from the child-privacy review (**HUMAN-009**) and should move to configuration if that review sets a different figure.
- `analytics_events.child_id` has a foreign key to `children_profiles`, which has no writer (**DATA-001**). Ownership is therefore verified against `FamilyState`, the real authority, and the FK will only become satisfiable once DATA-001 lands. The verification itself is correct today.

## Batch 1 — completed 2026-08-15

Verified after the batch: API `npm run check` → **973 tests pass**, `tsc --noEmit` clean · Flutter `analyze` clean, **308 tests pass** · Admin `tsc` clean, **287 tests pass**, `npm run build` OK.

| Task | What landed | Evidence |
|---|---|---|
| **OPS-001** ✅ | Workflow triggers `master` and `main`; the worker job now runs `npm run typecheck:types` and `npm test` as separate steps with no `\|\|` fallback; a new `admin` job runs typecheck, vitest and build; added the `check` script CI referenced | `.github/workflows/ci.yml`, `dashboard/api/package.json` |
| **TEST-001** ✅ | Guard sweep extended from `admin*` only to **all 26 route modules**, resolving one level of local auth wrappers (`principal()` etc.) and carrying an explicit `ANONYMOUS_BY_DESIGN` allowlist of 10 endpoints. CORS config extracted to `src/lib/corsOptions.ts` and the suite now asserts the real exported object, including the previously untested `ALLOWED_ORIGINS` branch and lookalike-domain refusal | `dashboard/api/test/routeGuards.test.mjs`, `test/cors.test.mjs`, `src/lib/corsOptions.ts` |
| **SEC-001** ✅ | The unauthenticated `POST /api/v1/recommendations/admin` is removed. Editorial pinning now lives at `POST /api/v1/admin/recommendations` behind `requireAdmin` + `requirePermission('publish')`, with series validation, body validation and an audit write | `src/routes/adminRecommendations.ts`, `src/routes/recommendations.ts` (now read-only), `src/index.ts` |
| **SEC-004** ✅ | `permissionsBeyondActor()` refuses granting any role carrying a permission the actor does not hold (closes escalation to `owner`); `wouldLockOutSelf()` refuses removal of the actor's last `manage_permissions` grant. Both run before the write and are pinned by tests | `src/routes/adminUsers.ts` |
| **APP-003** ✅ | Profile tab label now follows the active child, with a generic fallback; a source-level guard fails if a personal-name literal returns | `majarra_bottom_navigation.dart`, `test/bottom_navigation_test.dart` |
| **OFFLINE-002** ✅ (partial scope) | `ReaderPageCache.clearAll()` added and wired into account teardown, asserted by seeding a cache entry and checking it is gone after logout. **The catalogue cache was already being cleared** — see corrections | `reader_page_cache.dart`, `auth_controller.dart`, `test/logout_tile_test.dart` |
| **DATA-003** ✅ | New `optionalContentClassPredicate()` applied to the public stories and books list, detail and existence reads (6 queries). NULL-tolerant on purpose so unparented content stays visible | `src/lib/contentClass.ts`, `src/routes/stories.ts`, `src/routes/books.ts`, `test/storyPageDwell.test.mjs` |
| **ADMIN-006** ✅ | `subscriptions` → `billing`, `ops/sla` → `ops-sla` (two sites), dead `ops/services` link removed and the service list no longer truncated to 6. A new test walks every literal navigation target against the route table | `HeroKpis.tsx`, `OpsPage.tsx`, `src/test/adminNavigation.test.tsx` |

**Deliberately not started in this batch:** SEC-002 (needs the entitlement/lease refactor), SEC-003 (see below), and everything requiring a migration, remote database access, content publication or an owner decision.

## Corrections to the audit, found while implementing

The audit is evidence-based but three findings were wrong or overstated. Recorded here rather than quietly fixed, because the task text still reads as originally written.

| Task | Original claim | What is actually true |
|---|---|---|
| **APP-002** | "Outage substitutes a fake catalogue **with no signal**" | The signal exists: `home_feed.dart:253` renders a `_FallbackNotice` with a retry action whenever `catalog.usesLocalFallback` is true, and `ContentSource` distinguishes remote/mixed/cached/bundled honestly at the data layer. The **real** remaining defects are narrower: the notice sits at the *bottom* of the feed after every rail, and bundled items have no `videoUrl` so taps still dead-end. Re-scope APP-002 to notice placement plus making bundled items non-tappable. Priority drops from P0 to **P1**. |
| **OFFLINE-002** | "Cached reader pages **and catalogue** survive logout" | The catalogue cache was already cleared at `auth_controller.dart` (`catalogCacheProvider.clear()`). Only the reader page cache — added earlier the same day — was missing. Now fixed. |
| **OFFLINE-001** | "Downloads cannot be started **at all**" | `DownloadButton` **is** used once, at `audio_player_page.dart:356`, correctly gated on an offline-licence check, so audio-story downloads work end to end. The accurate finding is that **video/episode** downloads have no entry point. Scope unchanged, description corrected. |

Method note: all three came from a delegated audit track and were caught by re-reading the code before editing it. The lesson for the next batch is the one the audit itself recorded — read the code, not the report.

## Newly discovered during implementation

### OPS-009 — 303 extensionless imports prevent any test from loading the worker entrypoint

**Priority:** P2
**Area:** API / Testing / Build
**Status:** PARTIAL

**Problem**
`src/index.ts` and 73 other files import relative modules without a file extension. The Workers bundler resolves this; Node's ESM loader does not. So no test can import the entrypoint, which is why no test has ever exercised real middleware composition, and why the CORS suite had to copy its configuration in the first place.

**Evidence**
Attempting `await import('../src/index.ts')` from a test fails with `ERR_MODULE_NOT_FOUND: .../src/routes/admin`. Measured: **303 extensionless relative imports across 74 files** under `dashboard/api/src`. Some files already use explicit `.ts` (e.g. `src/routes/stories.ts`), so both styles coexist.

**Current behavior**
Entrypoint-level testing is impossible; middleware order, route shadowing and mount precedence are only observable in a browser session. `src/routes/books.ts` also cannot be unit-tested for the same reason.

**Expected behavior**
Every relative import carries an explicit extension, and at least one test imports `src/index.ts` and asserts mount order and middleware composition.

**Implementation scope**
Mechanically add `.ts` to relative imports, verify `wrangler deploy --dry-run` and `tsc` still pass, then add an entrypoint test covering CORS, rate-limit registration and the route-shadowing rules the comments in `index.ts` document.

**Dependencies** API; pairs with TEST-001.

**Effort** M

**Acceptance criteria**
- [ ] `await import('../src/index.ts')` succeeds in a test.
- [ ] A test asserts that `/admin/games/ops` is not shadowed by `/games/:id`.
- [ ] `wrangler deploy --dry-run` and `tsc --noEmit` both pass unchanged.

**Do not do**
Do not mix the rewrite into a functional change; land it as one mechanical commit.

## Status table

| Priority | Total | Not started | In progress | Done |
|---|---:|---:|---:|---:|
| P0 | 25 | 14 | 0 | **11** |
| P1 | 37 | 34 | 0 | **3** |
| P2 | 28 | 26 | 0 | **2** |
| P3 | 11 | 11 | 0 | 0 |
| **Engineering total** | **101** | **85** | **0** | **16** |
| Documentation (`DOCS-*`) | 6 | 6 | 0 | 0 |
| Human review (`HUMAN-*`) | 12 | 12 | 0 | 0 |
| External (`EXT-*`) | 7 | 7 | 0 | 0 |
| Owner decisions (`DECIDE-*`) | 10 | 10 | 0 | 0 |

**All four authorization holes are closed** (SEC-001, SEC-002, SEC-003, SEC-004), the verification pipeline that would catch their return is real (OPS-001, TEST-001, OPS-009), content can be published (ADMIN-001), the release gate works (APP-004), a compromised admin session can be seen and revoked (ADMIN-003), the Home Builder controls the live app end to end (ADMIN-002), and no surface reports a season's editorial plan as its episode count (CONTENT-003).

**Every remaining P0 is blocked on something other than engineering.** There are **no** independently executable P0 tasks left.

| Blocked by | Tasks |
|---|---|
| **Media production** — the true critical path | CONTENT-001 (audio), CONTENT-002 (video), STORY-001, BOOK-001, GAME-001, CREATIVE-001 |
| **Owner decision or credentials** | OPS-002 (→ DECIDE-001), OPS-003 (admin bootstrap), BILLING-001 (→ DECIDE-005), APP-001 (→ DECIDE-002), DATA-001 (→ DECIDE-004), PARENT-001 *(after DATA-001)* |
| **Engineering, ready to start** | *(none)* |

### ADMIN-015 — Align the series and episode publish handlers with the fail-closed gate

**Priority:** P2
**Area:** API / Admin
**Status:** PARTIAL

**Problem**
`POST /series/:id/publish` and `POST /episodes/:id/publish` treat a null readiness result as `'not evaluated'` and publish anyway. Existence is verified before the gate runs, so a null means the gate could not evaluate — and publishing unevaluated content is what the gate exists to prevent.

**Evidence**
`src/routes/admin.ts:731` and `:1031` (`if (gate && !gate.publishable)`, then `readiness: gate ? summarizeGate(gate) : 'not evaluated'`). Compare `src/routes/adminPublish.ts`, which refuses with `readiness_not_evaluable` and audits the refusal.

**Expected behavior** All six publish paths fail closed, with one shared helper rather than three copies of the contract.

**Implementation scope** Extract the publish body into one helper used by all six types; keep the per-table `published_at` difference; add tests for the null-gate branch on series and episodes.

**Dependencies** API; ADMIN-001.

**Effort** S

**Acceptance criteria**
- [ ] A series or episode whose gate cannot evaluate is refused, not published.
- [ ] One helper implements the publish contract for all six types.
- [ ] The refusal is audited with a named reason.

## Suggested execution order

1. **Unblock verification first:** OPS-001 (make CI real) and TEST-001 (make the guard sweep and CORS tests honest). Without these, nothing below can be trusted as fixed.
2. **Close the three authorization holes:** SEC-001, SEC-002, SEC-003, then SEC-004.
3. **Resolve the data architecture:** DECIDE-004 → DATA-001, which unblocks PARENT-001, REC-001 and admin analytics.
4. **Make publication possible:** ADMIN-001, then DATA-004 review gating.
5. **Produce media:** CONTENT-001 (audio) and CONTENT-002 (video) — the longest lead time on the whole list, and the true launch constraint.
6. **Fix the visible lies:** APP-001, APP-002, APP-003, ADMIN-002, ADMIN-003, ANALYTICS-002.
7. **Then commerce:** DECIDE-005 → BILLING-001 with EXT-003.
8. **Then the remaining P1 set**, grouped by area to limit context switching.

## Recording progress

Update the tracking table and mark acceptance criteria in place. Never renumber an ID. When a task is superseded, keep the ID and record what replaced it.
