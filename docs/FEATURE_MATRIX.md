# Majarra Admin — Canonical Feature Matrix

> GENERATED FILE. Do not edit by hand.
> `node tools/dashboard-audit/feature-matrix.mjs`
> Last generated: 2026-08-10

Evidence columns (page, endpoints, permission, audit, tests, UX affordances) are
read from the source on every run. The **Status** column comes from
`docs/FEATURE_MATRIX_VERDICTS.json`, where each verdict records how it was
verified; a route with no recorded verdict is `UNVERIFIED` rather than assumed.

Registered admin routes: **67**. Server routes parsed: **315**.
API client functions parsed: **223**.

| Status | Routes |
|---|---|
| COMPLETE | 41 |
| PARTIAL | 18 |
| MISSING | 8 |

## 1. Route matrix

| Route | Page | Status | API calls | Server endpoints | Permissions | Audit | Tests |
|---|---|---|---|---|---|---|---|
| `/` | DashboardPage.tsx | PARTIAL | 5 | 5/5 | — | — | 16 |
| `/settings` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/taxonomy` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/planets` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/planets/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/skills` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/objectives` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/content-reviews` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/series` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/series/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/seasons` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/seasons/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/episodes` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/episodes/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/characters` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/characters/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/stories` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/stories/:id` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/library-content` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/library-content/:kind/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/games/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/games-ops` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/games-audio-queue` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/games-art-queue` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/media` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/media/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/visual-styles` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/parents` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/customers` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/customers/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/children` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/billing` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/analytics` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/teams` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/roles` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/team-access` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/tasks` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/production` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/calendar` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/audit-logs` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/failed-events` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/narration` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/quality` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/mastery` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/app-experience` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/devices-admin` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/support-center` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/workflows` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/rights` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/remote-config` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/packages` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/ops` | — | PARTIAL | 0 | 0/0 | — | — | 0 |
| `/campaigns` | CampaignsPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/revenue` | RevenuePage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/translation` | TranslationCenterPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/quiz` | QuizBuilderPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/recommendations` | RecommendationsPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/school` | SchoolAccountsPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/finance-advanced` | AdvancedFinancePage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/ops-sla` | OpsSlaPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/partnerships` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/website/pages` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/website/pages/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/blog/posts` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/blog/posts/:id` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/blog/taxonomy` | — | COMPLETE | 0 | 0/0 | — | — | 0 |
| `/seo` | — | COMPLETE | 0 | 0/0 | — | — | 0 |

## 2. Collection UX affordances (static evidence)

Presence of the affordance in the page source. It proves the control exists, not
that it behaves; behavioural findings belong in the verdict file.

| Route | Filters | Pagination | View modes | Thumbnails | Detail link | Loading | Empty | Error | Mutations |
|---|---|---|---|---|---|---|---|---|---|
| `/` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/campaigns` | — | — | — | — | — | — | ✅ | — | — |
| `/revenue` | — | — | — | — | — | — | — | — | — |
| `/translation` | — | — | — | — | — | — | — | — | — |
| `/quiz` | — | — | — | — | — | — | — | ✅ | — |
| `/recommendations` | — | — | — | — | — | — | ✅ | — | — |
| `/school` | — | — | — | — | — | — | — | — | — |
| `/finance-advanced` | — | — | — | — | — | — | — | — | — |
| `/ops-sla` | — | — | — | — | — | — | — | — | — |

## 3. Verdicts and how each was verified

### `/` — PARTIAL

- Verified by: code read 2026-08-09; api test qualityChecks/masteryReports touch the same aggregates
- Evidence: DashboardPage calls 4 client functions, all 4 resolve to mounted admin routes reading real D1 aggregates. No fabricated numbers.
- Gaps:
  - No date-range control (Today/7D/30D/custom) — every widget is all-time
  - No conversion, churn, MRR, failed-payment or SLA modules the programme asks for
  - Not role-aware: every signed-in admin sees the same widget set

### `/settings` — PARTIAL

- Verified by: code read 2026-08-09; api test siteMode.test.mjs
- Evidence: site-mode GET/PUT is real against D1 behind the publish permission.
- Gaps:
  - Only site mode is settable; no other platform setting is editable here

### `/taxonomy` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Full create/update/archive on planets and categories, 8/8 calls resolved, guards create/edit_metadata/archive.
- Gaps:
  - No bulk actions, no saved views

### `/planets` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real planet list with artwork thumbnails and card/table view modes; drills into /planets/:id.
- Gaps:
  - No URL-persisted filter state

### `/planets/:id` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real D1 detail with joins and COUNT(*) child counts; sections that cannot be filled say so explicitly instead of showing placeholders.
- Gaps:
  - Edit navigates to the list page where the form lives (deliberate split, not a defect)
  - No planet media or analytics section yet

### `/skills` — COMPLETE

- Verified by: code read 2026-08-09; api test objectiveSkills.test.mjs
- Evidence: Full CRUD with a usage check before delete and central audit.

### `/objectives` — COMPLETE

- Verified by: code read 2026-08-09; api test objectiveSkills.test.mjs
- Evidence: Full CRUD, db.batch age-track derivation, usage checks across episodes/games/projects, audit.
- Gaps:
  - No curriculum coverage report (planet -> age -> skill -> objective -> content gaps)

### `/content-reviews` — PARTIAL

- Verified by: code read 2026-08-09; api test separationOfDuties.test.mjs
- Evidence: Reviewer identity comes from the session, creator/approver separation is re-checked on approval, approved decisions cannot be edited or deleted.
- Gaps:
  - Reviews do not gate publication of series or episodes yet
  - No SLA or escalation

### `/series` — COMPLETE

- Verified by: code read 2026-08-09; api test routeGuards.test.mjs and publishGate.test.mjs
- Evidence: CRUD plus publish authority separation, and publication now passes a real readiness gate: the operation evaluates lib/publishGate.ts server-side, refuses with 409 and the full blocker list, audits the blocked attempt as publish_blocked, and records the accepted warnings with the publish. The UI opens the same readiness result before the button.
- Gaps:
  - No bulk actions
  - No saved views or column manager

### `/series/:id` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real detail workspace with seasons, episodes and related entities from D1.
- Gaps:
  - No rights/availability or production section

### `/seasons` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real CRUD, 5/5 calls resolved, guards create/edit_metadata/archive.

### `/seasons/:id` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real D1 detail with episode list.
- Gaps:
  - Season media section declared unavailable rather than shown

### `/episodes` — COMPLETE

- Verified by: code read 2026-08-09; api test routeGuards.test.mjs and publishGate.test.mjs
- Evidence: CRUD plus the same publish authority separation, and the readiness gate now blocks an episode with no video file, no thumbnail, no Arabic voicing, an unpublished parent series, an expired licence or an unapproved blocking workflow stage - all reported at once with owner and required action.
- Gaps:
  - No bulk actions
  - The legacy /admin/quality endpoint still has no episode checks; the publish gate covers episodes instead

### `/episodes/:id` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real detail from D1 with characters and assets.
- Gaps:
  - Analytics section declared unavailable rather than faked

### `/characters` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real CRUD with artwork thumbnails.

### `/characters/:id` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real detail; usage in stories/pages declared unavailable rather than invented.

### `/stories` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: 17 calls, 15 resolved to mounted routes; page/bubble/localisation editing all write to D1.
- Gaps:
  - No ZIP import, ZIP template, manifest validation or pre-import preview
  - No version history or rollback for a story
  - No duplicate or missing-page detection

### `/stories/:id` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Same component as /stories with an id parameter.
- Gaps:
  - Not a distinct detail workspace: it reuses the collection page

### `/library-content` — COMPLETE

- Verified by: code read 2026-08-09; api test gamePackValidation/enginePacks
- Evidence: Books, games and projects with real CRUD and archive guards; engine pack authoring and validation behind real server rules.
- Gaps:
  - No bulk actions
  - No saved views

### `/library-content/:kind/:id` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Switches across three entity kinds with the correct route per kind and real asset_links.
- Gaps:
  - Book page editor and analytics declared not built rather than mocked

### `/games/:id` — COMPLETE

- Verified by: code read 2026-08-09; api test publishReadiness/publishReadinessEngines/gameLocalizations
- Evidence: Real readiness evaluation per engine contract, real pack preview, and localisation writes with INSERT ON CONFLICT plus audit.

### `/games-ops` — COMPLETE

- Verified by: code read 2026-08-10; api test gamesOps.test.mjs; live HTTP 2026-08-10 after the mount-order fix
- Evidence: Reads the real ops aggregate over game rows, packs and reviews. The endpoint was unreachable until 2026-08-10: adminGamesRoute was mounted after adminRoute, so GET /admin/games/ops and /admin/games/analytics were swallowed by route.get('/games/:id') in adminContent.ts and answered 404 Game not found. Unit tests could not see it because they call the route module directly. Found by the browser run watching the console; all four games endpoints now return 200 over HTTP.
- Gaps:
  - No retry/resolve actions from this screen

### `/games-audio-queue` — COMPLETE

- Verified by: code read 2026-08-09; api test audioProductionQueue.test.mjs
- Evidence: Derives the recording queue from pack-declared audio and asset state, not from a status column.
- Gaps:
  - Assignment and due dates are not stored per queue item

### `/games-art-queue` — COMPLETE

- Verified by: code read 2026-08-09; api test artProductionQueue.test.mjs
- Evidence: Derives the art queue from pack-referenced assets and their content_assets status.
- Gaps:
  - Assignment and due dates are not stored per queue item

### `/media` — COMPLETE

- Verified by: code read 2026-08-09; api test assetBuckets/assetUrls/assetClassification
- Evidence: Real multipart upload sessions to R2 through bucketForAsset, classification rules enforced server-side.
- Gaps:
  - No orphan-asset sweep
  - One lint warning outstanding in this file

### `/media/:id` — COMPLETE

- Verified by: code read 2026-08-09; api test assetUrls.test.mjs
- Evidence: Real preview streamed from R2 via range requests and real usage list from asset_links.

### `/visual-styles` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Full CRUD on visual_styles.
- Gaps:
  - No backend test covers this route

### `/parents` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Read-only by design: family_projection, child_projection and progress, with no write route existing server-side. Matches FamilyState authority.
- Gaps:
  - Not a Customer 360 workspace: no tabs for devices, downloads, payments, tickets, consents
  - No family detail route at all

### `/customers` — COMPLETE

- Verified by: code read 2026-08-09; api test adminDeviceOperations.test.mjs (17 tests)
- Evidence: Family list from the D1 projection with child, device and open-ticket counts, search and plan/status filters, server-side paging. Counts come from the projection deliberately: a list calling the Durable Object per row would be 25 calls per page, and the live read belongs in the workspace where it is declared.
- Gaps:
  - No saved views or column manager yet
  - Search matches the family id only; there is no e-mail index by design

### `/customers/:id` — COMPLETE

- Verified by: code read 2026-08-09; api test adminDeviceOperations.test.mjs asserts the data boundaries and the operator path; live E2E scripts/verify-customer360-e2e.mjs 43/43 2026-08-10
- Evidence: Customer 360 workspace with eight tabs. The authority (FamilyState) answers present-tense questions - effective plan, entitlement ledger, devices, sessions, active leases, auth epoch, progress count - and D1 answers history; every section names its source. One failed section degrades alone rather than failing the page. Device revoke, download revoke and projection resync call the operator command path with a mandatory reason, a stated irreversible-effect warning and audit written before the command. No store credentials and no child viewing history are exposed; reading the family is audited as customer_360.
- Gaps:
  - Consents are rendered as raw records because FamilyState returns an untyped shape
  - No refunds section: no refund data exists in any source
  - Internal notes live on support tickets rather than on the family

### `/children` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Was BROKEN (create/edit/archive controls calling routes that always answered 405); the controls were removed, not disabled, and the page states why child profiles are managed through the Family APIs.
- Gaps:
  - No admin-command path to FamilyState for legitimate support operations

### `/billing` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Real transaction and entitlement records from D1; deliberately shows no monetary totals because no pricing exists to compute them from.
- Gaps:
  - No revenue, refund or chargeback view (no data model for them yet)

### `/analytics` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Real joined D1 aggregates; the masking .catch(() => ({})) was removed so failures surface.
- Gaps:
  - No business analytics (conversion, churn, campaign performance)
  - No contextual per-entity analytics

### `/teams` — COMPLETE

- Verified by: code read 2026-08-09; api test adminScope.test.mjs
- Evidence: Real team CRUD after fixing a call that silently fell back to two invented teams.

### `/roles` — PARTIAL

- Verified by: code read 2026-08-09; api test adminUsers.test.mjs
- Evidence: Roles, permissions and grants are all real reads behind manage_permissions.
- Gaps:
  - No route exists to create a custom role or change a role's permissions; roles are seeded by migration only

### `/team-access` — COMPLETE

- Verified by: code read 2026-08-09; api test adminUsers/adminScope
- Evidence: Employee, role, password-reset and session-revoke operations with server-side canManage enforcement, not UI-only gating.
- Gaps:
  - Add-employee is a single large modal rather than a structured create flow

### `/tasks` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Real task list from D1 via /admin/tasks.
- Gaps:
  - View-only by design: no assign, complete or reassign from the UI
  - No per-item production requirement line (script/voice/video/QA)

### `/production` — COMPLETE

- Verified by: code read 2026-08-09; api test productionMatrix.test.mjs (19 tests); live E2E scripts/verify-production-e2e.mjs 63/63 2026-08-10
- Evidence: Requirement matrix per episode and story derived entirely from the artefacts: linked asset status, pages with a ready illustration, languages that actually have text or narration, review rows, and the publish gate's own verdict for the publish row. No endpoint accepts a status, asserted by test, so the board cannot claim work that does not exist. Percentages appear only where a denominator exists. Migration 0032 stores the human layer (assignee, team, due, blocker, note); a recorded blocker can turn in_progress into blocked and can never hide a finished asset. Three views: table, kanban grouped by requirement state, and my queue. The board is capped and states its cap.
- Gaps:
  - Covers episodes and stories only; books, games and projects have their own readiness surfaces
  - Assignment takes a user id typed in rather than a picker
  - No calendar view and no bulk reassignment

### `/calendar` — COMPLETE

- Verified by: code read 2026-08-10; api test adminSearchCalendar.test.mjs (26 tests); front test paletteCalendar.test.tsx (24 tests); browser run verify-dashboard.mjs 2026-08-10 (three views, keyboard move path)
- Evidence: One calendar over nine scheduled sources - episodes, series, stories, website pages, blog posts, home modules, production requirements, tasks and licence expiry - in one server window. Day, week and month; filters and the view in the URL; saved views; conflict chips that filter the set they count. It is a read model: every event declares the route, field and permission that can move it, and both the drag and the per-card date field call that route, so the entity endpoint stays the only writer and its revision, validation and audit still run. The screen states that no cron publishes a scheduled row (scheduled/cleanup.ts is the only cron and it deletes processed events), marks every scheduled event with that conflict, and reports two more: content scheduled past its licence expiry, and two episodes of one series on one day. Entities with no schedulable column (campaigns, releases, books, games) are named with the reason.
- Gaps:
  - Tasks and derived publication dates cannot be moved from here; each event says why
  - Text search is applied in the browser because the route accepts no q, and that is stated on screen
  - No scheduler exists to publish a scheduled row, so every scheduled date needs a manual publish

### `/audit-logs` — COMPLETE

- Verified by: code read 2026-08-09; api test auditLogDateFilter.test.mjs
- Evidence: Actor/action/entity filters and server-side pagination, plus from/to date filtering that rejects malformed and inverted ranges with 400.
- Gaps:
  - Central audit covers the main sensitive actions, not every action

### `/failed-events` — COMPLETE

- Verified by: code read 2026-08-09; api test dlqFamilyEvents.test.mjs
- Evidence: Replay and discard perform real DLQ work with duplicate detection and a mandatory discard reason, behind the publish permission.

### `/narration` — PARTIAL

- Verified by: code read 2026-08-09; api test narrationSave.test.mjs
- Evidence: Preview and generation go through a real Google TTS call; saving stores exactly the previewed bytes as a private content_assets row with audit.
- Gaps:
  - No narration lifecycle: generated/recorded/reviewed/approved/published are not modelled
  - No link from a saved narration to a specific episode or story page from this screen

### `/quality` — PARTIAL

- Verified by: code read 2026-08-09; api test qualityChecks.test.mjs
- Evidence: Per-type checks computed from D1 for series/story/book/game/project; export is real, restore refuses with 501.
- Gaps:
  - On-demand only: the publish operation does not require it to pass
  - No episode checks exist

### `/mastery` — PARTIAL

- Verified by: code read 2026-08-09; api test masteryReports.test.mjs
- Evidence: Real joined reads over behaviourally derived mastery data.
- Gaps:
  - Read-only by design (derived data)
  - No prerequisite or coverage view

### `/app-experience` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Real targeting (track/country/platform/plan/new-user), draft and schedule columns, and a preview endpoint that actually filters by targeting.
- Gaps:
  - Rollback restores the first-created state only: one version row, not a version history, while the UI says 'previous version'

### `/devices-admin` — PARTIAL

- Verified by: code read 2026-08-09; live E2E scripts/verify-device-e2e.mjs 44/44 2026-08-10
- Evidence: Read-only; the revoke control was removed rather than left disabled, and the page explains that FamilyState owns device state (server answers 501).
- Gaps:
  - No live device projection from FamilyState
  - No audited admin-command path for revoke or resync

### `/support-center` — COMPLETE

- Verified by: code read 2026-08-09; api test supportCrm.test.mjs (21 tests) and supportFamilyDevices.test.mjs (6 tests); live E2E scripts/verify-support-e2e.mjs 80/80 2026-08-10
- Evidence: Real CRM (migration 0031): tickets with reference, category, priority, status, family/subscription/purchase/device links, assignee and team, tags as rows, an event timeline, saved views, and stored SLA policies resolved most-specific-first. Two clocks are tracked and measured separately, a settled ticket is judged at resolution time rather than at now, and waiting_customer pauses the resolution clock. Status transitions are enforced (closed is terminal), raising priority re-derives both deadlines, escalation raises priority and moves the clock, and every write leaves both a timeline event and an audit row. Overdue filtering happens in SQL so the badge and the list agree. Operational actions accept only what the platform can perform; each unavailable one is refused with 501 and its own specific reason, which the UI lists instead of rendering a control that fails. Account lookup keeps its narrow field set, plus a live device read from FamilyState.
- Gaps:
  - No customer messaging, deliberately: no channel exists and no table pretends one does
  - Assignment takes a user id typed in rather than a picker
  - SLA policies are editable data but have no admin editor yet
  - Attachments are not supported

### `/workflows` — COMPLETE

- Verified by: code read 2026-08-09; api test workflowEngine.test.mjs (19 tests) and workflowReview.test.mjs
- Evidence: Real engine: stages as rows with ordering, dependencies, required role and permission, SLA and escalation hours and a blocks_publish flag (migration 0030, three seeded templates). Runs hold per-stage state so parallel stages are expressible; decisions enforce the stage's own requirement plus creator/approver separation, write both the stage state and the shared history table, start the clock on newly unblocked stages, and are audited. Blocking stages are consumed by the publish gate, so a status string no longer bypasses a required review. UI shows stages with server-supplied refusal reasons, assignment, my-stages and overdue views.
- Gaps:
  - Templates and stages are seeded by migration; there is no UI to author a new template
  - Assignment takes a user id typed in rather than a picker
  - Escalation is reported but sends no notification (no notification transport exists)

### `/rights` — PARTIAL

- Verified by: code read 2026-08-09; api test availabilityPolicy.test.mjs (21 tests)
- Evidence: The registry form is unchanged and real. Enforcement now exists separately: content_availability (0029) plus lib/availabilityPolicy.ts is consulted by the public series list and detail, episode list and detail, playback start, the app-facing game endpoint and the book detail, refusing with 451. Expired content_rights blocks publication through the publish gate.
- Gaps:
  - This page still lists licences only; the availability policy is edited from the series and episode detail pages, not from here
  - Search, recommendations and the home builder do not filter by availability yet
  - Downloads have no availability check because there is no download endpoint

### `/remote-config` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: rollout_percent and targeting_json are really stored, behind the publish permission.
- Gaps:
  - No scheduling, no history or rollback, no typed value validation
  - No dedicated kill switches for registration/playback/downloads/games/uploads

### `/packages` — COMPLETE

- Verified by: code read 2026-08-09; api test familyState.test.mjs covers the same PLAN_LIMITS source
- Evidence: Reads familyPolicy.PLAN_LIMITS, the same authority FamilyState enforces, and returns pricing_available:false rather than inventing prices.
- Gaps:
  - No pricing, country, currency, versioning or grandfathering model — provider not configured

### `/ops` — PARTIAL

- Verified by: code read 2026-08-09
- Evidence: Shows only real D1-derived counters and names the metrics it cannot show (D1 latency, queue backlog, DLQ depth, cache hit) as requiring Cloudflare Analytics Engine.
- Gaps:
  - No Worker/queue/DO health, latency, retry or incident data
  - EXTERNAL_BLOCKER: Analytics Engine binding not configured

### `/campaigns` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no campaigns or notifications table in any migration and no API route. The page documents that push tokens must be stored in account_devices first.
- Gaps:
  - Whole marketing operations block absent

### `/revenue` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no revenue or MRR table exists and no monetary figure is computed. The previous version displayed entirely invented numbers.
- Gaps:
  - Requires per-plan, per-country pricing that does not exist yet

### `/translation` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no aggregate translation-status route exists, although story_page_localizations and game_localizations hold the underlying rows.
- Gaps:
  - No translator/reviewer assignment, due dates, glossary or stale-translation detection

### `/quiz` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no quiz, question or answer table in any migration.
- Gaps:
  - Architecture decision open: central question bank versus per-game questions

### `/recommendations` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no recommendation, pin or boost table and no route.
- Gaps:
  - Architecture decision open: extend home_experience_blocks versus a separate engine

### `/school` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no schools or classrooms table. The previous version displayed an invented school, invented pupils and invented mastery figures alongside privacy guarantees that were never implemented.
- Gaps:
  - Whole B2B block absent

### `/finance-advanced` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no cost table. The previous version showed invented cost, profitability and LTV, and its export button was an alert().

### `/ops-sla` — MISSING

- Verified by: code read 2026-08-09
- Evidence: NotImplementedPage; no SLA policy table. The previous version showed an invented compliance percentage and progress bar.

### `/partnerships` — COMPLETE

- Verified by: code read 2026-08-09
- Evidence: Status changes, notes, real e-mail resend through a configured provider and settings persistence — every control performs a real submit, and changes are audited.

### `/website/pages` — COMPLETE

- Verified by: code read 2026-08-10; front test websiteCms.test.tsx (18 tests); browser run verify-dashboard.mjs 2026-08-10
- Evidence: Pages list over GET /admin/website/pages with table, cards, calendar and translation-group tree views, a filter drawer whose state lives in the URL, removable chips, saved views, a column manager, and bulk publish that reports each refusal with the blockers the server returned. One row is one page in one language, because web_pages is keyed (page_key, language) and publication is per language.
- Gaps:
  - The server route accepts no text search and no paging, so search and paging are applied in the browser over the full set; this is stated on screen
  - Saved views are stored in localStorage for this browser only; a shared mechanism exists for support tickets alone

### `/website/pages/:id` — COMPLETE

- Verified by: code read 2026-08-10; front test websiteCms.test.tsx; browser run verify-dashboard.mjs 2026-08-10 (six tabs opened, publish attempt surfaced its blockers)
- Evidence: Page workspace: typed section editor per section type with reorder, activation, media picker with upload, and CTA validation mirroring the server; settings with slug, schedule and indexability; the shared SEO editor; translations; revisions with confirmed rollback; the page audit trail from audit_logs filtered by entity_id; and a structure preview in the page language direction. Publish is a separate operation and its 409 blocker list is rendered item by item.
- Gaps:
  - Preview is an internal structure preview, not the public renderer
  - Section reordering is by move buttons rather than drag and drop

### `/blog/posts` — COMPLETE

- Verified by: code read 2026-08-10; front test blogCms.test.tsx (22 tests); browser run verify-dashboard.mjs 2026-08-10
- Evidence: Post collection with table, cards carrying the real hero image, and a calendar over scheduled and published dates. Language, status, category and text search are sent to the server; author and SEO state are filtered in the browser and that split is stated on screen. A post with no author is flagged in the list because it blocks publication.
- Gaps:
  - The server caps the list at 100 rows and has no offset, so paging is local
  - Creating a post requires a latin slug; an Arabic-only title cannot be submitted, matching the server rule

### `/blog/posts/:id` — COMPLETE

- Verified by: code read 2026-08-10; front test blogCms.test.tsx; browser run verify-dashboard.mjs 2026-08-10 (blocks rendered, rtl confirmed, autosave state on screen)
- Evidence: Structured block editor for the ten server block types with the same validation the server applies, so an invalid block is shown before the save rather than after a 400. Autosave every thirty seconds, paused with an explicit notice while a block is invalid. Taxonomy, translations, the religious review gate as reviewer plus date, revisions labelled autosave or manual with rollback, the audit trail, the SEO editor, and a preview in the post language direction.
- Gaps:
  - Related Majarra content is entered as ids; there is no content picker yet
  - Rollback restores content only, matching the server: status and path are not restored

### `/blog/taxonomy` — COMPLETE

- Verified by: code read 2026-08-10; front test blogCms.test.tsx; browser run verify-dashboard.mjs 2026-08-10
- Evidence: Authors, per-language categories and shared tags over the three POST routes that previously had no caller. Categories are per language because a category is navigation a visitor reads; a tag is one row with three names because a tag is a filter, not a page.
- Gaps:
  - Create only: the server exposes no update or delete for authors, categories or tags
  - Tag post counts are read-only

### `/seo` — COMPLETE

- Verified by: code read 2026-08-10; api test seoAudit.test.mjs (25 tests); front test seo.test.tsx (19 tests); browser run verify-dashboard.mjs 2026-08-10
- Evidence: SEO operations over GET /admin/seo/audit: issues grouped by check and filterable by check, severity and entity, each linking to the editor that fixes it; a coverage tab naming every check that is not implemented and why; sitemap state; and redirect management. The internal audit and external search-engine indexing are separate tabs, and index_status_available is false and displayed as such.
- Gaps:
  - Live index status needs a Search Console integration that is not configured; the screen says so rather than showing a number
  - External link checking is not implemented because it needs a network crawl per link

## 4. Server endpoints with no admin-UI caller

Either a deliberate app-facing or public route, or backend-only work with no
operator surface. Listed so the second case cannot hide.

| File | Verb | Path | Permission | Audit |
|---|---|---|---|---|
| admin.ts | GET | `/api/v1/admin/series` | — | — |
| admin.ts | GET | `/api/v1/admin/series/:id` | — | — |
| admin.ts | POST | `/api/v1/admin/series` | create | ✅ |
| admin.ts | PATCH | `/api/v1/admin/series/:id` | edit_metadata | ✅ |
| admin.ts | POST | `/api/v1/admin/series/:id/publish` | publish | ✅ |
| admin.ts | DELETE | `/api/v1/admin/series/:id` | archive | ✅ |
| admin.ts | GET | `/api/v1/admin/episodes` | — | — |
| admin.ts | GET | `/api/v1/admin/episodes/:id` | — | — |
| admin.ts | POST | `/api/v1/admin/episodes` | create | ✅ |
| admin.ts | PATCH | `/api/v1/admin/episodes/:id` | edit_metadata | ✅ |
| admin.ts | POST | `/api/v1/admin/episodes/:id/publish` | publish | ✅ |
| admin.ts | DELETE | `/api/v1/admin/episodes/:id` | archive | ✅ |
| adminAnalytics.ts | GET | `/api/v1/admin/analytics/overview` | — | — |
| adminAnalytics.ts | GET | `/api/v1/admin/analytics/children/:childId` | — | — |
| adminAppExperience.ts | GET | `/api/v1/admin/home-experience` | — | — |
| adminAppExperience.ts | POST | `/api/v1/admin/home-experience` | create | — |
| adminAppExperience.ts | PATCH | `/api/v1/admin/home-experience/:id` | edit_metadata | — |
| adminAppExperience.ts | POST | `/api/v1/admin/home-experience/:id/rollback` | edit_metadata | — |
| adminAppExperience.ts | POST | `/api/v1/admin/home-experience/reorder` | edit_metadata | — |
| adminAppExperience.ts | DELETE | `/api/v1/admin/home-experience/:id` | archive | — |
| adminAppExperience.ts | GET | `/api/v1/admin/home-experience/preview` | — | — |
| adminAppExperience.ts | GET | `/api/v1/admin/devices` | — | — |
| adminAppExperience.ts | POST | `/api/v1/admin/devices/:id/revoke` | archive | — |
| adminAppExperience.ts | GET | `/api/v1/admin/remote-config` | — | — |
| adminAppExperience.ts | PUT | `/api/v1/admin/remote-config/:key` | publish | — |
| adminAppExperience.ts | GET | `/api/v1/admin/feature-flags` | — | — |
| adminAppExperience.ts | GET | `/api/v1/admin/support/family/:id` | — | ✅ |
| adminAppExperience.ts | GET | `/api/v1/admin/support/family/:id/devices` | — | ✅ |
| adminAppExperience.ts | POST | `/api/v1/admin/rights` | create | ✅ |
| adminAssets.ts | GET | `/api/v1/admin/assets` | — | — |
| adminAssets.ts | GET | `/api/v1/admin/assets/stats` | — | — |
| adminAssets.ts | GET | `/api/v1/admin/assets/:id` | — | — |
| adminAssets.ts | POST | `/api/v1/admin/assets` | create | — |
| adminAssets.ts | PATCH | `/api/v1/admin/assets/:id` | edit_metadata | — |
| adminAssets.ts | DELETE | `/api/v1/admin/assets/:id` | archive | — |
| adminAssets.ts | POST | `/api/v1/admin/assets/import-catalog` | create | — |
| adminAssets.ts | PUT | `/api/v1/admin/assets/:id/links` | edit_metadata | — |
| adminAssets.ts | PUT | `/api/v1/admin/assets/:id/content` | upload_images | — |
| adminAssets.ts | POST | `/api/v1/admin/asset-upload-sessions` | upload_images | — |
| adminAssets.ts | PUT | `/api/v1/admin/asset-upload-sessions/:id/parts/:part` | upload_images | — |
| adminAssets.ts | POST | `/api/v1/admin/asset-upload-sessions/:id/complete` | upload_images | — |
| adminAssets.ts | DELETE | `/api/v1/admin/asset-upload-sessions/:id` | upload_images | — |
| adminAssets.ts | GET | `/api/v1/admin/assets/:id/content` | — | — |
| adminAuth.ts | GET | `/api/v1/admin/auth/status` | — | — |
| adminAuth.ts | POST | `/api/v1/admin/auth/login` | — | — |
| adminAuth.ts | GET | `/api/v1/admin/auth/me` | — | — |
| adminAuth.ts | POST | `/api/v1/admin/auth/logout` | — | — |
| adminAuth.ts | POST | `/api/v1/admin/auth/logout-all` | — | — |
| adminAuth.ts | POST | `/api/v1/admin/auth/change-password` | — | — |
| adminAvailability.ts | GET | `/api/v1/admin/availability/:type/:id` | — | — |
| adminAvailability.ts | PUT | `/api/v1/admin/availability/:type/:id` | publish | ✅ |
| adminAvailability.ts | DELETE | `/api/v1/admin/availability/:type/:id` | publish | ✅ |
| adminAvailability.ts | GET | `/api/v1/admin/availability` | — | — |
| adminBackup.ts | GET | `/api/v1/admin/backup/:type/:id` | — | — |
| adminBackup.ts | POST | `/api/v1/admin/restore` | publish | — |
| adminBackup.ts | GET | `/api/v1/admin/quality/:type/:id` | — | — |
| adminBilling.ts | GET | `/api/v1/admin/billing/stats` | — | — |
| adminBilling.ts | GET | `/api/v1/admin/billing/purchases` | — | — |
| adminBilling.ts | GET | `/api/v1/admin/billing/entitlements` | — | — |
| adminBlog.ts | GET | `/api/v1/admin/blog/taxonomy` | — | — |
| adminBlog.ts | POST | `/api/v1/admin/blog/authors` | create | ✅ |
| adminBlog.ts | POST | `/api/v1/admin/blog/categories` | create | ✅ |
| adminBlog.ts | POST | `/api/v1/admin/blog/tags` | create | — |
| adminBlog.ts | GET | `/api/v1/admin/blog/posts` | — | — |
| adminBlog.ts | GET | `/api/v1/admin/blog/posts/:id` | — | — |
| adminBlog.ts | POST | `/api/v1/admin/blog/posts` | create | ✅ |
| adminBlog.ts | PATCH | `/api/v1/admin/blog/posts/:id` | edit_text | ✅ |
| adminBlog.ts | POST | `/api/v1/admin/blog/posts/:id/publish` | publish | ✅ |
| adminBlog.ts | POST | `/api/v1/admin/blog/posts/:id/rollback` | edit_text | ✅ |
| adminCalendar.ts | GET | `/api/v1/admin/calendar` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/skills` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/skills/:id` | — | — |
| adminCatalogue.ts | POST | `/api/v1/admin/skills` | create | — |
| adminCatalogue.ts | PATCH | `/api/v1/admin/skills/:id` | edit_metadata | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/skills/:id` | archive | — |
| adminCatalogue.ts | GET | `/api/v1/admin/learning-objectives` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/learning-objectives/:id` | — | — |
| adminCatalogue.ts | POST | `/api/v1/admin/learning-objectives` | create | — |
| adminCatalogue.ts | PATCH | `/api/v1/admin/learning-objectives/:id` | edit_metadata | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/learning-objectives/:id` | archive | — |
| adminCatalogue.ts | POST | `/api/v1/admin/learning-objectives/:id/tracks/rederive` | edit_metadata | — |
| adminCatalogue.ts | GET | `/api/v1/admin/content-reviews/:id` | — | — |
| adminCatalogue.ts | POST | `/api/v1/admin/content-reviews` | review | — |
| adminCatalogue.ts | PATCH | `/api/v1/admin/content-reviews/:id` | review | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/content-reviews/:id` | review | — |
| adminCatalogue.ts | GET | `/api/v1/admin/stories/:id/pages` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/story-pages/:id` | — | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/story-pages/:id/localizations/:language` | edit_text | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/stories/:id/purge` | delete_draft | — |
| adminCatalogue.ts | GET | `/api/v1/admin/seasons/:id` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/characters/:id` | — | — |
| adminContent.ts | GET | `/api/v1/admin/planets` | — | — |
| adminContent.ts | GET | `/api/v1/admin/planets/:id` | — | — |
| adminContent.ts | POST | `/api/v1/admin/planets` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/planets/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/planets/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/categories` | — | — |
| adminContent.ts | POST | `/api/v1/admin/categories` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/categories/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/categories/:id` | archive | — |
| adminContent.ts | PUT | `/api/v1/admin/series/:id/categories` | edit_metadata | — |
| adminContent.ts | GET | `/api/v1/admin/visual-styles` | — | — |
| adminContent.ts | POST | `/api/v1/admin/visual-styles` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/visual-styles/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/visual-styles/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/seasons` | — | — |
| adminContent.ts | POST | `/api/v1/admin/seasons` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/seasons/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/seasons/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/characters` | — | — |
| adminContent.ts | POST | `/api/v1/admin/characters` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/characters/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/characters/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/game-engines` | — | — |
| adminContent.ts | GET | `/api/v1/admin/books` | — | — |
| adminContent.ts | GET | `/api/v1/admin/books/:id` | — | — |
| adminContent.ts | POST | `/api/v1/admin/books` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/books/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/books/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/games` | — | — |
| adminContent.ts | GET | `/api/v1/admin/games/:id` | — | — |
| adminContent.ts | POST | `/api/v1/admin/games` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/games/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/games/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/projects` | — | — |
| adminContent.ts | GET | `/api/v1/admin/projects/:id` | — | — |
| adminContent.ts | POST | `/api/v1/admin/projects` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/projects/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/projects/:id` | archive | — |
| adminContent.ts | GET | `/api/v1/admin/stories` | — | — |
| adminContent.ts | GET | `/api/v1/admin/stories/:id` | — | — |
| adminContent.ts | POST | `/api/v1/admin/stories` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/stories/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/stories/:id` | archive | — |
| adminContent.ts | POST | `/api/v1/admin/stories/:id/pages` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/story-pages/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/story-pages/:id` | archive | — |
| adminContent.ts | PUT | `/api/v1/admin/story-pages/:id/localizations/:language` | edit_metadata | — |
| adminContent.ts | POST | `/api/v1/admin/story-pages/:id/bubbles` | create | — |
| adminContent.ts | PATCH | `/api/v1/admin/story-bubbles/:id` | edit_metadata | — |
| adminContent.ts | DELETE | `/api/v1/admin/story-bubbles/:id` | archive | — |
| adminCustomer.ts | GET | `/api/v1/admin/customers` | — | — |
| adminCustomer.ts | GET | `/api/v1/admin/customers/:id` | — | ✅ |
| adminDevices.ts | GET | `/api/v1/admin/families/:id/device-state` | — | ✅ |
| adminDevices.ts | POST | `/api/v1/admin/families/:id/devices/:deviceId/revoke` | manage_permissions | ✅ |
| adminDevices.ts | POST | `/api/v1/admin/families/:id/downloads/revoke` | manage_permissions | ✅ |
| adminDevices.ts | POST | `/api/v1/admin/families/:id/resync` | manage_permissions | ✅ |
| adminFamilyProjection.ts | GET | `/api/v1/admin/parents` | — | — |
| adminFamilyProjection.ts | GET | `/api/v1/admin/parents/:id` | — | — |
| adminFamilyProjection.ts | GET | `/api/v1/admin/children` | — | — |
| adminFamilyProjection.ts | GET | `/api/v1/admin/children/:id` | — | — |
| adminFamilyProjection.ts | POST | `/api/v1/admin/children` | — | — |
| adminFamilyProjection.ts | PATCH | `/api/v1/admin/children/:id` | — | — |
| adminFamilyProjection.ts | DELETE | `/api/v1/admin/children/:id` | — | — |
| adminFamilyProjection.ts | GET | `/api/v1/admin/failed-family-events` | — | — |
| adminFamilyProjection.ts | POST | `/api/v1/admin/failed-family-events/:id/replay` | publish | — |
| adminFamilyProjection.ts | POST | `/api/v1/admin/failed-family-events/:id/discard` | publish | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/readiness` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/preview` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/localizations` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/localizations/:language` | — | — |
| adminGames.ts | PUT | `/api/v1/admin/games/:id/localizations/:language` | edit_text | ✅ |
| adminGames.ts | GET | `/api/v1/admin/games/production/audio` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/production/art` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/analytics` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/ops` | — | — |
| adminMastery.ts | GET | `/api/v1/admin/mastery/by-objective` | — | — |
| adminMastery.ts | GET | `/api/v1/admin/mastery/by-child` | — | — |
| adminMastery.ts | GET | `/api/v1/admin/attempts` | — | — |
| adminPartnerships.ts | GET | `/api/v1/admin/partnerships` | — | — |
| adminPartnerships.ts | GET | `/api/v1/admin/partnerships/settings` | — | — |
| adminPartnerships.ts | PUT | `/api/v1/admin/partnerships/settings` | publish | ✅ |
| adminPartnerships.ts | GET | `/api/v1/admin/partnerships/:id` | — | — |
| adminPartnerships.ts | PATCH | `/api/v1/admin/partnerships/:id` | edit_metadata | ✅ |
| adminPartnerships.ts | POST | `/api/v1/admin/partnerships/:id/resend` | edit_metadata | ✅ |
| adminPlans.ts | GET | `/api/v1/admin/plans` | — | — |
| adminProduction.ts | GET | `/api/v1/admin/production/:type/:id` | — | — |
| adminProduction.ts | GET | `/api/v1/admin/production/board` | — | — |
| adminProduction.ts | PUT | `/api/v1/admin/production/:type/:id/:requirement` | assign_members | ✅ |
| adminProduction.ts | GET | `/api/v1/admin/production/my-queue` | — | — |
| adminPublishGate.ts | GET | `/publish-readiness/:type/:id` | — | — |
| adminSearch.ts | GET | `/api/v1/admin/search` | — | — |
| adminSeo.ts | GET | `/api/v1/admin/seo/:type/:id` | — | — |
| adminSeo.ts | PUT | `/api/v1/admin/seo/:type/:id` | edit_metadata | ✅ |
| adminSeo.ts | GET | `/api/v1/admin/seo/redirects` | — | — |
| adminSeo.ts | POST | `/api/v1/admin/seo/redirects` | publish | ✅ |
| adminSeo.ts | DELETE | `/api/v1/admin/seo/redirects/:id` | publish | ✅ |
| adminSeo.ts | GET | `/api/v1/admin/seo/audit` | — | — |
| adminSeo.ts | GET | `/api/v1/admin/seo/slug-check` | — | — |
| adminSiteMode.ts | GET | `/api/v1/admin/site-mode` | — | — |
| adminSiteMode.ts | PUT | `/api/v1/admin/site-mode` | publish | ✅ |
| adminSiteMode.ts | POST | `/api/v1/admin/site-mode/reset` | publish | ✅ |
| adminSupport.ts | GET | `/api/v1/admin/support/tickets` | — | — |
| adminSupport.ts | POST | `/api/v1/admin/support/tickets` | assign_members | ✅ |
| adminSupport.ts | GET | `/api/v1/admin/support/tickets/:id` | — | — |
| adminSupport.ts | PATCH | `/api/v1/admin/support/tickets/:id` | assign_members | ✅ |
| adminSupport.ts | POST | `/api/v1/admin/support/tickets/:id/notes` | assign_members | ✅ |
| adminSupport.ts | POST | `/api/v1/admin/support/tickets/:id/first-response` | assign_members | ✅ |
| adminSupport.ts | POST | `/api/v1/admin/support/tickets/:id/escalate` | assign_members | ✅ |
| adminSupport.ts | POST | `/api/v1/admin/support/tickets/:id/actions` | manage_permissions | ✅ |
| adminSupport.ts | GET | `/api/v1/admin/support/sla` | — | — |
| adminSupport.ts | GET | `/api/v1/admin/support/views` | — | — |
| adminSupport.ts | POST | `/api/v1/admin/support/views` | assign_members | — |
| adminSupport.ts | DELETE | `/api/v1/admin/support/views/:id` | assign_members | — |
| adminTeams.ts | GET | `/api/v1/admin/teams` | — | — |
| adminTeams.ts | POST | `/api/v1/admin/teams` | manage_team | — |
| adminTeams.ts | GET | `/api/v1/admin/teams/:id` | — | — |
| adminTeams.ts | GET | `/api/v1/admin/roles` | — | — |
| adminTeams.ts | GET | `/api/v1/admin/permissions` | — | — |
| adminTeams.ts | GET | `/api/v1/admin/grants` | manage_permissions | — |
| adminTeams.ts | POST | `/api/v1/admin/grants` | manage_permissions | — |
| adminTeams.ts | DELETE | `/api/v1/admin/grants/:id` | manage_permissions | — |
| adminTeams.ts | GET | `/api/v1/admin/workflows/runs` | — | — |
| adminTeams.ts | POST | `/api/v1/admin/workflows/runs/:id/review` | approve | ✅ |
| adminTeams.ts | GET | `/api/v1/admin/audit-logs` | view_audit_log | — |
| adminTts.ts | GET | `/api/v1/admin/tts/config` | — | — |
| adminTts.ts | POST | `/api/v1/admin/tts/preview` | upload_audio | — |
| adminTts.ts | POST | `/api/v1/admin/tts/assets` | upload_audio | ✅ |
| adminUsers.ts | GET | `/api/v1/adminadminUser` | — | ✅ |
| adminUsers.ts | GET | `/api/v1/admin/users` | — | — |
| adminUsers.ts | POST | `/api/v1/admin/users` | — | — |
| adminUsers.ts | PATCH | `/api/v1/admin/users/:id` | — | — |
| adminUsers.ts | POST | `/api/v1/admin/users/:id/reset-password` | — | — |
| adminUsers.ts | POST | `/api/v1/admin/users/:id/grants` | — | — |
| adminUsers.ts | DELETE | `/api/v1/admin/users/:id/grants/:grantId` | — | — |
| adminUsers.ts | GET | `/api/v1/admin/users/:id/sessions` | — | — |
| adminUsers.ts | POST | `/api/v1/admin/users/:id/revoke-sessions` | — | — |
| adminWebsite.ts | GET | `/api/v1/admin/website/pages` | — | — |
| adminWebsite.ts | GET | `/api/v1/admin/website/pages/:id` | — | — |
| adminWebsite.ts | POST | `/api/v1/admin/website/pages` | create | ✅ |
| adminWebsite.ts | PATCH | `/api/v1/admin/website/pages/:id` | edit_metadata | ✅ |
| adminWebsite.ts | PUT | `/api/v1/admin/website/pages/:id/sections` | edit_text | ✅ |
| adminWebsite.ts | POST | `/api/v1/admin/website/pages/:id/publish` | publish | ✅ |
| adminWebsite.ts | POST | `/api/v1/admin/website/pages/:id/rollback` | publish | ✅ |
| adminWorkflow.ts | GET | `/api/v1/adminadminUser` | — | — |
| adminWorkflow.ts | GET | `/api/v1/admin/workflows/templates` | — | — |
| adminWorkflow.ts | POST | `/api/v1/admin/workflows/runs` | assign_members | ✅ |
| adminWorkflow.ts | GET | `/api/v1/admin/workflows/runs/:id` | — | — |
| adminWorkflow.ts | POST | `/api/v1/admin/workflows/runs/:id/stages/:key/assign` | assign_members | ✅ |
| adminWorkflow.ts | POST | `/api/v1/admin/workflows/runs/:id/stages/:key/decision` | review | ✅ |
| adminWorkflow.ts | GET | `/api/v1/admin/workflows/overdue` | — | — |
| adminWorkflow.ts | GET | `/api/v1/admin/workflows/my-stages` | — | — |
| auth.ts | POST | `/api/v1/auth/register` | — | — |
| auth.ts | POST | `/api/v1/auth/resend-verification` | — | — |
| auth.ts | POST | `/api/v1/auth/verify-email` | — | — |
| auth.ts | POST | `/api/v1/auth/login` | — | — |
| auth.ts | POST | `/api/v1/auth/refresh` | — | — |
| auth.ts | GET | `/api/v1/auth/me` | — | — |
| auth.ts | POST | `/api/v1/auth/logout` | — | — |
| billing.ts | GET | `/api/v1/billing/status` | — | — |
| billing.ts | GET | `/api/v1/billing/google-play/context` | — | — |
| billing.ts | POST | `/api/v1/billing/google-play/verify` | — | — |
| billing.ts | POST | `/api/v1/billing/google-play/rtdn` | — | — |
| books.ts | GET | `/api/v1/books` | — | — |
| books.ts | GET | `/api/v1/books/:id` | — | — |
| books.ts | GET | `/api/v1/books/:id/pages` | — | — |
| books.ts | POST | `/api/v1/books/:id/audio-sessions` | — | — |
| creations.ts | POST | `/api/v1/creations` | — | — |
| creations.ts | GET | `/api/v1/creations` | — | — |
| creations.ts | GET | `/api/v1/creations/:id/image` | — | — |
| creations.ts | DELETE | `/api/v1/creations/:id` | — | — |
| creations.ts | POST | `/api/v1/creations/purge` | — | — |
| creations.ts | POST | `/api/v1/creations/reconcile` | — | — |
| episodes.ts | GET | `/api/v1/episodes` | — | — |
| episodes.ts | GET | `/api/v1/episodes/:id` | — | — |
| episodes.ts | POST | `/api/v1/episodes/:id/playback-sessions` | — | — |
| episodes.ts | POST | `/api/v1/episodes/:id/playback-sessions/:leaseId/heartbeat` | — | — |
| episodes.ts | POST | `/api/v1/episodes/:id/playback-sessions/:leaseId/end` | — | — |
| episodes.ts | GET | `/api/v1/episodes/:id/stream` | — | — |
| episodes.ts | POST | `/api/v1/episodes/:id/progress` | — | — |
| family.ts | GET | `/api/v1/family/state` | — | — |
| family.ts | GET | `/api/v1/family/children` | — | — |
| family.ts | POST | `/api/v1/family/children` | — | — |
| family.ts | POST | `/api/v1/family/progress` | — | — |
| family.ts | GET | `/api/v1/family/progress` | — | — |
| family.ts | GET | `/api/v1/family/mastery` | — | — |
| family.ts | GET | `/api/v1/family/consents` | — | — |
| family.ts | POST | `/api/v1/family/consents` | — | — |
| family.ts | GET | `/api/v1/family/rewards` | — | — |
| family.ts | POST | `/api/v1/family/rewards` | — | — |
| family.ts | POST | `/api/v1/family/favorites` | — | — |
| family.ts | GET | `/api/v1/family/devices` | — | — |
| family.ts | POST | `/api/v1/family/devices/revoke` | — | — |
| family.ts | POST | `/api/v1/family/parent-pin` | — | — |
| family.ts | POST | `/api/v1/family/parent-pin/verify` | — | — |
| games.ts | GET | `/api/v1/games/:id` | — | — |
| media.ts | GET | `/api/v1/media/assets/:assetId` | — | — |
| partnerships.ts | POST | `/api/v1/partnerships` | — | — |
| partnerships.ts | GET | `/api/v1/partnerships/status` | — | — |
| planets.ts | GET | `/api/v1/planets` | — | — |
| planets.ts | GET | `/api/v1/planets/:id` | — | — |
| publicRender.ts | GET | `/` | — | — |
| publicRender.ts | GET | `/:language/blog` | — | — |
| publicRender.ts | GET | `/:language/blog/:slug` | — | — |
| publicRender.ts | GET | `/:language/series/:slug` | — | — |
| publicRender.ts | GET | `/:language/planets/:planetId` | — | — |
| publicRender.ts | GET | `/:language` | — | — |
| publicRender.ts | GET | `/:language/:slug` | — | — |
| publicSite.ts | GET | `/resolve` | — | — |
| publicSite.ts | GET | `/page` | — | — |
| publicSite.ts | GET | `/blog` | — | — |
| publicSite.ts | GET | `/blog/post` | — | — |
| publicSite.ts | GET | `/sitemap.xml` | — | — |
| publicSite.ts | GET | `/sitemap-pages.xml` | — | — |
| publicSite.ts | GET | `/sitemap-blog.xml` | — | — |
| publicSite.ts | GET | `/sitemap-catalogue.xml` | — | — |
| publicSite.ts | GET | `/sitemap-index.xml` | — | — |
| series.ts | GET | `/api/v1/series` | — | — |
| series.ts | GET | `/api/v1/series/:id` | — | — |
| siteMode.ts | GET | `/api/v1/site-mode` | — | — |

Orphan count: **310** of 315.

## 5. API client functions the matrix could not resolve to a server route

A name here means the static match failed — a dynamic path, a differently mounted
prefix, or a genuinely absent endpoint. Each needs a human check before any
verdict above it can be trusted.

| Client function | Method | Path | Called from |
|---|---|---|---|

Unresolved: **0**.

## 6. Calls the API client does not define

None. Every `api.*` call in every registered page resolves to a client
function, and every client function resolves to a mounted server route.
