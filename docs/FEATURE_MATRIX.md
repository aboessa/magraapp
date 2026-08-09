# Majarra Admin — Canonical Feature Matrix

> GENERATED FILE. Do not edit by hand.
> `node tools/dashboard-audit/feature-matrix.mjs`
> Last generated: 2026-08-09

Evidence columns (page, endpoints, permission, audit, tests, UX affordances) are
read from the source on every run. The **Status** column comes from
`docs/FEATURE_MATRIX_VERDICTS.json`, where each verdict records how it was
verified; a route with no recorded verdict is `UNVERIFIED` rather than assumed.

Registered admin routes: **57**. Server routes parsed: **250**.
API client functions parsed: **174**.

| Status | Routes |
|---|---|
| COMPLETE | 30 |
| PARTIAL | 19 |
| MISSING | 8 |

## 1. Route matrix

| Route | Page | Status | API calls | Server endpoints | Permissions | Audit | Tests |
|---|---|---|---|---|---|---|---|
| `/` | DashboardPage.tsx | PARTIAL | 4 | 4/4 | — | — | 11 |
| `/settings` | SettingsPage.tsx | PARTIAL | 2 | 2/2 | publish | ✅ | 40 |
| `/taxonomy` | TaxonomyPage.tsx | COMPLETE | 8 | 8/8 | edit_metadata, create, archive | — | 2 |
| `/planets` | PlanetsPage.tsx | COMPLETE | 1 | 1/1 | — | — | 2 |
| `/planets/:id` | PlanetDetailPage.tsx | COMPLETE | 1 | 1/1 | — | — | 0 |
| `/skills` | SkillsPage.tsx | COMPLETE | 4 | 4/4 | edit_metadata, create, archive | — | 3 |
| `/objectives` | LearningObjectivesPage.tsx | COMPLETE | 6 | 6/6 | edit_metadata, create, archive | — | 3 |
| `/content-reviews` | ContentReviewsPage.tsx | PARTIAL | 4 | 4/4 | review | — | 1 |
| `/series` | SeriesPage.tsx | COMPLETE | 7 | 7/7 | edit_metadata, create, archive, publish | ✅ | 40 |
| `/series/:id` | SeriesDetailPage.tsx | COMPLETE | 1 | 1/1 | — | — | 1 |
| `/seasons` | SeasonsPage.tsx | COMPLETE | 5 | 5/5 | edit_metadata, create, archive | — | 12 |
| `/seasons/:id` | SeasonDetailPage.tsx | COMPLETE | 1 | 1/1 | — | — | 0 |
| `/episodes` | EpisodesPage.tsx | COMPLETE | 6 | 6/6 | edit_metadata, create, archive, publish | ✅ | 12 |
| `/episodes/:id` | EpisodeDetailPage.tsx | COMPLETE | 1 | 1/1 | — | — | 0 |
| `/characters` | CharactersPage.tsx | COMPLETE | 5 | 5/5 | edit_metadata, create, archive | — | 15 |
| `/characters/:id` | CharacterDetailPage.tsx | COMPLETE | 1 | 1/1 | — | — | 5 |
| `/stories` | StoriesPage.tsx | PARTIAL | 17 | 17/17 | edit_metadata, create, upload_images, archive | — | 22 |
| `/stories/:id` | StoriesPage.tsx | PARTIAL | 17 | 17/17 | edit_metadata, create, upload_images, archive | — | 22 |
| `/library-content` | LibraryContentPage.tsx | COMPLETE | 19 | 19/19 | edit_metadata, create, archive | — | 29 |
| `/library-content/:kind/:id` | LibraryContentDetailPage.tsx | COMPLETE | 3 | 3/3 | — | — | 27 |
| `/games/:id` | GameDetailPage.tsx | COMPLETE | 4 | 4/4 | — | — | 21 |
| `/games-ops` | GamesOpsPage.tsx | COMPLETE | 1 | 1/1 | — | — | 2 |
| `/games-audio-queue` | AudioProductionQueuePage.tsx | COMPLETE | 1 | 1/1 | — | — | 1 |
| `/games-art-queue` | ArtProductionQueuePage.tsx | COMPLETE | 1 | 1/1 | — | — | 1 |
| `/media` | MediaLibraryPage.tsx | COMPLETE | 6 | 6/6 | upload_images, create | — | 16 |
| `/media/:id` | AssetDetailPage.tsx | COMPLETE | 2 | 2/2 | — | — | 22 |
| `/visual-styles` | VisualStylesPage.tsx | COMPLETE | 4 | 4/4 | edit_metadata, create, archive | — | 0 |
| `/parents` | ParentsPage.tsx | PARTIAL | 3 | 3/3 | — | — | 0 |
| `/children` | ChildrenPage.tsx | PARTIAL | 1 | 1/1 | — | — | 6 |
| `/billing` | BillingPage.tsx | COMPLETE | 4 | 4/4 | — | — | 5 |
| `/analytics` | AnalyticsPage.tsx | PARTIAL | 1 | 1/1 | — | — | 0 |
| `/teams` | TeamsPage.tsx | COMPLETE | 3 | 3/3 | manage_team | — | 4 |
| `/roles` | RolesPage.tsx | PARTIAL | 3 | 3/3 | manage_permissions | — | 8 |
| `/team-access` | TeamAccessPage.tsx | COMPLETE | 6 | 6/6 | — | — | 7 |
| `/tasks` | MyTasksPage.tsx | PARTIAL | 1 | 1/1 | — | — | 0 |
| `/audit-logs` | AuditLogPage.tsx | COMPLETE | 1 | 1/1 | view_audit_log | — | 1 |
| `/failed-events` | FailedEventsPage.tsx | COMPLETE | 3 | 3/3 | publish | — | 2 |
| `/narration` | NarrationPage.tsx | PARTIAL | 3 | 3/3 | upload_audio | ✅ | 2 |
| `/quality` | QualityPage.tsx | PARTIAL | 2 | 2/2 | — | — | 1 |
| `/mastery` | MasteryPage.tsx | PARTIAL | 3 | 3/3 | — | — | 8 |
| `/app-experience` | AppExperiencePage.tsx | PARTIAL | 6 | 6/6 | edit_metadata, create | — | 0 |
| `/devices-admin` | DevicesAdminPage.tsx | PARTIAL | 1 | 1/1 | — | — | 4 |
| `/support-center` | SupportCenterPage.tsx | PARTIAL | 2 | 2/2 | — | ✅ | 2 |
| `/workflows` | WorkflowPage.tsx | COMPLETE | 8 | 8/8 | assign_members, review | ✅ | 2 |
| `/rights` | RightsPage.tsx | PARTIAL | 2 | 2/2 | create | ✅ | 7 |
| `/remote-config` | RemoteConfigPage.tsx | PARTIAL | 3 | 3/3 | publish | — | 1 |
| `/packages` | PackagesPage.tsx | COMPLETE | 1 | 1/1 | — | — | 2 |
| `/ops` | OpsPage.tsx | PARTIAL | 3 | 3/3 | — | — | 5 |
| `/campaigns` | CampaignsPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/revenue` | RevenuePage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/translation` | TranslationCenterPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/quiz` | QuizBuilderPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/recommendations` | RecommendationsPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/school` | SchoolAccountsPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/finance-advanced` | AdvancedFinancePage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/ops-sla` | OpsSlaPage.tsx | MISSING | 0 | 0/0 | — | — | 0 |
| `/partnerships` | PartnershipsPage.tsx | COMPLETE | 5 | 5/5 | edit_metadata, publish | ✅ | 40 |

## 2. Collection UX affordances (static evidence)

Presence of the affordance in the page source. It proves the control exists, not
that it behaves; behavioural findings belong in the verdict file.

| Route | Filters | Pagination | View modes | Thumbnails | Detail link | Loading | Empty | Error | Mutations |
|---|---|---|---|---|---|---|---|---|---|
| `/` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/settings` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/taxonomy` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/planets` | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/planets/:id` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/skills` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/objectives` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/content-reviews` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/series` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/series/:id` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/seasons` | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/seasons/:id` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/episodes` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/episodes/:id` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/characters` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/characters/:id` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/stories` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/stories/:id` | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/library-content` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/library-content/:kind/:id` | — | — | — | — | ✅ | ✅ | ✅ | ✅ | — |
| `/games/:id` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/games-ops` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/games-audio-queue` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/games-art-queue` | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `/media` | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/media/:id` | — | — | — | — | ✅ | ✅ | ✅ | ✅ | — |
| `/visual-styles` | ✅ | — | — | — | — | ✅ | — | ✅ | ✅ |
| `/parents` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/children` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/billing` | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/analytics` | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/teams` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/roles` | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/team-access` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/tasks` | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/audit-logs` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/failed-events` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/narration` | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/quality` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/mastery` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/app-experience` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/devices-admin` | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/support-center` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/workflows` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/rights` | ✅ | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/remote-config` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `/packages` | — | — | — | — | — | ✅ | ✅ | ✅ | — |
| `/ops` | — | — | — | — | — | ✅ | — | ✅ | — |
| `/campaigns` | — | — | — | — | — | — | ✅ | — | — |
| `/revenue` | — | — | — | — | — | — | — | — | — |
| `/translation` | — | — | — | — | — | — | — | — | — |
| `/quiz` | — | — | — | — | — | — | — | ✅ | — |
| `/recommendations` | — | — | — | — | — | — | ✅ | — | — |
| `/school` | — | — | — | — | — | — | — | — | — |
| `/finance-advanced` | — | — | — | — | — | — | — | — | — |
| `/ops-sla` | — | — | — | — | — | — | — | — | — |
| `/partnerships` | ✅ | ✅ | — | — | — | ✅ | ✅ | ✅ | ✅ |

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

- Verified by: code read 2026-08-09; api test gamesOps.test.mjs
- Evidence: Reads the real ops aggregate over game rows, packs and reviews.
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

- Verified by: code read 2026-08-09
- Evidence: Read-only; the revoke control was removed rather than left disabled, and the page explains that FamilyState owns device state (server answers 501).
- Gaps:
  - No live device projection from FamilyState
  - No audited admin-command path for revoke or resync

### `/support-center` — PARTIAL

- Verified by: code read 2026-08-09; api test supportFamilyDevices.test.mjs
- Evidence: Family lookup returns a deliberately narrow field set (no purchase or install hashes, no auth_epoch) and every lookup writes a 'view' audit row. Added a live device read that calls FamilyState, the authority, rather than the D1 projection: it drops installation_id_hash, answers 503 when the Durable Object is unreachable rather than reporting an empty device list, declares its source and that revoke is not an admin operation, and is audited as its own entity type.
- Gaps:
  - No tickets, categories, priority, SLA, assignment, timeline, notes or tags
  - No operational actions: entitlement resync, restore purchase, PIN reset and account recovery have no server capability; device revoke is architecturally impossible for an operator because FamilyState's revoke path requires a parent session

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

## 4. Server endpoints with no admin-UI caller

Either a deliberate app-facing or public route, or backend-only work with no
operator surface. Listed so the second case cannot hide.

| File | Verb | Path | Permission | Audit |
|---|---|---|---|---|
| adminAppExperience.ts | DELETE | `/api/v1/admin/home-experience/:id` | archive | — |
| adminAppExperience.ts | POST | `/api/v1/admin/devices/:id/revoke` | archive | — |
| adminAssets.ts | PATCH | `/api/v1/admin/assets/:id` | edit_metadata | — |
| adminAssets.ts | DELETE | `/api/v1/admin/assets/:id` | archive | — |
| adminAssets.ts | PUT | `/api/v1/admin/assets/:id/links` | edit_metadata | — |
| adminAssets.ts | POST | `/api/v1/admin/asset-upload-sessions` | upload_images | — |
| adminAssets.ts | PUT | `/api/v1/admin/asset-upload-sessions/:id/parts/:part` | upload_images | — |
| adminAssets.ts | POST | `/api/v1/admin/asset-upload-sessions/:id/complete` | upload_images | — |
| adminAssets.ts | DELETE | `/api/v1/admin/asset-upload-sessions/:id` | upload_images | — |
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
| adminBackup.ts | POST | `/api/v1/admin/restore` | publish | — |
| adminCatalogue.ts | GET | `/api/v1/admin/skills/:id` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/content-reviews/:id` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/stories/:id/pages` | — | — |
| adminCatalogue.ts | GET | `/api/v1/admin/story-pages/:id` | — | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/story-pages/:id/localizations/:language` | edit_text | — |
| adminCatalogue.ts | DELETE | `/api/v1/admin/stories/:id/purge` | delete_draft | — |
| adminContent.ts | PUT | `/api/v1/admin/series/:id/categories` | edit_metadata | — |
| adminContent.ts | PATCH | `/api/v1/admin/story-bubbles/:id` | edit_metadata | — |
| adminFamilyProjection.ts | GET | `/api/v1/admin/children/:id` | — | — |
| adminFamilyProjection.ts | POST | `/api/v1/admin/children` | — | — |
| adminFamilyProjection.ts | PATCH | `/api/v1/admin/children/:id` | — | — |
| adminFamilyProjection.ts | DELETE | `/api/v1/admin/children/:id` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/preview` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/localizations` | — | — |
| adminGames.ts | GET | `/api/v1/admin/games/:id/localizations/:language` | — | — |
| adminGames.ts | PUT | `/api/v1/admin/games/:id/localizations/:language` | edit_text | ✅ |
| adminGames.ts | GET | `/api/v1/admin/games/analytics` | — | — |
| adminPartnerships.ts | GET | `/api/v1/admin/partnerships/:id` | — | — |
| adminPublishGate.ts | GET | `/publish-readiness/:type/:id` | — | — |
| adminSiteMode.ts | POST | `/api/v1/admin/site-mode/reset` | publish | ✅ |
| adminTeams.ts | GET | `/api/v1/admin/teams/:id` | — | — |
| adminTeams.ts | POST | `/api/v1/admin/grants` | manage_permissions | — |
| adminTeams.ts | DELETE | `/api/v1/admin/grants/:id` | manage_permissions | — |
| adminTeams.ts | POST | `/api/v1/admin/workflows/runs/:id/review` | approve | ✅ |
| adminUsers.ts | GET | `/api/v1/adminadminUser` | — | ✅ |
| adminUsers.ts | POST | `/api/v1/admin/users/:id/grants` | — | — |
| adminUsers.ts | DELETE | `/api/v1/admin/users/:id/grants/:grantId` | — | — |
| adminUsers.ts | GET | `/api/v1/admin/users/:id/sessions` | — | — |
| adminWorkflow.ts | GET | `/api/v1/adminadminUser` | — | — |
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
| planets.ts | GET | `/api/v1/planets/:id` | — | — |
| series.ts | GET | `/api/v1/series` | — | — |
| series.ts | GET | `/api/v1/series/:id` | — | — |
| siteMode.ts | GET | `/api/v1/site-mode` | — | — |

Orphan count: **100** of 250.

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
