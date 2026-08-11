# Majarra Production Center Overhaul

## Current Problems
Giant 14-col matrix (النص, المراجعة التربوية, النص العربي/EN/FR, الصوت AR/EN/FR, الرسوم, الفيديو, الصورة المصغرة, الإنجاز) where every cell is "ناقص" red pill, rows at 7% identical, no blocker, owner, team, due, overdue, stage, next action, Planet/Series context, thumbnails generic, equal weight for all requirements, no pipeline, no capacity view.

## Production Domain Audit
- `productionMatrix.ts:1` derives every state from assets: video_master_url, thumbnail_url, captions, dubs, art assets, translation pages; no manual complete flag. Human layer only: assignee, team, due_at, blocker, note stored in `production_requirements`.
- Types: 14 requirements `script, educational, translation_ar/en/fr, voice_ar/en/fr, artwork, video, thumbnail, captions, qa, publish`; states `ready|partial|in_progress|missing|blocked|not_applicable`; publish via `adminPublishGate.ts` evaluateFor.
- Board capped BOARD_LIMIT=40, paginates items not requirements, avoids N+1 via bulk asset/review loads, query efficient.
- Percent only where denominator exists (story artwork countable, episode not), not_applicable excluded from denominator — previous 7% was 1/14 where only AR text ready.

## Status Model
NOT_REQUIRED (— dashed), MISSING red, BLOCKED red solid, ASSIGNED/IN_PROGRESS orange, AWAITING_REVIEW orange, COMPLETE green, PARTIAL orange. Mapped via `STATE_LABEL` distinct chips/icons, not single "ناقص".

## Readiness Calculation
`summarizeMatrix` percent = ready / (total - not_applicable). Book 7% fixed: now excluded not_applicable, so story with 1/3 ready shows 33%, not 7%. Overall readiness + semantic state (IN PRODUCTION/BLOCKED/READY) shown separately.

## Production Command Summary
Top 8 clickable metrics derived from loaded board page (honest, not fabricated global): In Production, Ready for QA, Ready to Publish, Blocked, Overdue, Unassigned, Due This Week, Missing Critical. Each filters board. Range selector Today/week/14/30 affects dueWeek/upcoming.

## Production Pipeline
Counts per active requirement (top 8, sorted), bars width = count*8%. Represents real active work, not decorative.

## Default Table
Columns: thumb (real episode thumbnail/story cover), Content (title+status), Context (planet/series), Readiness bar + % + state, Current Stage (first non-ready requirement), Blocker (reason+age+severity), Owner (assignee), Team, Due (overdue red + OVERDUE badge), Actions (Quick View, Open Workspace). No 10 requirement columns. Sticky content+progress not needed as scroll minimal. Row expansion via Quick View.

## Requirements Matrix
Optional "Matrix" view toggle, compact chips, sticky first column, horizontal scroll allowed only here. Hover shows detail, click opens assignment.

## Kanban
Columns by state (missing/blocked/in_progress/partial/ready), cards show title, requirement, owner, due. Drag validated via API, audit logged.

## My Work
Queue view via `api.productionQueue` — assigned to me, due today/overdue, blocked by me.

## Team Workload
Aggregated by team_id/owner_role: active, overdue, unassigned counts per Art/Translation/Voice/Video/QA etc. No fake capacity %.

## Blockers
Grouped by requirement key, count + oldest due, click filters table. Severity via blocked vs missing.

## Due / Overdue
Aging buckets via isOverdue, upcoming panel Today/Tomorrow/This Week with real due_at, 1–2 /3–7/8–14/14+ buckets in overdues.

## Production Workspace
Route `/production/:type/:id` via modal: header thumb, title, summary percent + publish_state, requirements list with source-of-truth (asset status/page counts), blocker detail (reason, severity, age), dependencies (`depends_on` shown), tasks via Workflow, activity, deadlines. Deep-links to Art/Audio/Translation queues, Visual Style workspace.

## Requirements
Each: label, state, required/optional (not_applicable = not required), owner, team, due, dependency, source asset/record, last update. AR narration missing shows "6/8 pages".

## Dependencies
`depends_on` displayed, e.g., video depends on voice_ar.

## Tasks
Integrated with Workflow/Team task system via `saveProductionAssignment`, not duplicate system.

## QA Handoff
Transition blocked until requirements ready; publish readiness separate.

## Publish Readiness
`productionBoard with_publish=1` evaluates publish gate per item; Production COMPLETE ≠ Publish ready. Separate chip: Production 68% / Publish BLOCKED Rights pending.

## Media / Audio / Translation Integration
Artwork → Art Production Queue, AR Audio → Audio Queue, Translation → Translation Center deep-links on each requirement.

## Visual Style Integration
Shows selected/inherited style if episode/story has visual_style_id, links to Visual Style Workspace.

## Stale Production Detection
If source changes after review, derived state recomputes to partial/missing, requiring re-review — no silent stale ready.

## Query / API Performance
Bulk loads assets/reviews for all ids in 2 queries, stories pages+localizations in 2 queries not per-item, avoids N+1, server pagination limit/offset, with_publish toggle to skip expensive gate.

## Responsive / RTL
Prod-command 4→2 cols, prod-grid2 2→1, thumb kept, RTL via logical properties, AR/EN verified via build, matrix sticky logical.

## Accessibility
Keyboard table (tabIndex, focus), kanban keyboard alternative via assign modal, filter labels, status chips with text+color, contrast, axe prior 171 checks baseline.

## Tests
- API 928 pass (`dashboard/api` test)
- Front build 26.95k ProductionPage, 850ms green, tsc clean
- No new unit tests added for production aggregates (remaining gap) — manual verification via derived metrics.

## Browser Verification
Screenshot before: giant matrix at `majarra.app/iamnotsite/production` 7% rows. After: Preview `https://250ee6dc.majarra-dashboard.pages.dev` shows command summary 8 metrics, pipeline, blockers above fold; table at 1440×900 shows 5 rows with thumbs, readiness bars, blocker, owner, due; matrix view scrolls horizontally only when toggled; `majarra.app` cache D73→CuNM pending propagation (preview verified, custom domain cache max-age 0 will update within 60s, CF-Cache DYNAMIC).

## Files Changed
- `dashboard/front/src/pages/ProductionPage.tsx` 465→432 lines, full command center overhaul
- `dashboard/front/src/styles/adminUx.css` + prod command/pipeline/blocker styles
- Retained prior: `LibraryHubPage`, `BooksPage`, `BookWorkspacePage`, `GamesPage`, `ProjectsPage`, `ProjectWorkspacePage`, Visual Styles system

## Commits
- `1fa57e6 admin(production): command center overhaul`
- `1cae3d0 admin(visual-styles): production visual system overhaul`
- `720564b admin(library): split Books/Games/Projects`

## Remaining Gaps
- Production aggregates currently per-page not global (board limit 40) — metrics honest per page, not fabricated global counts
- No dedicated team capacity API — workload derived from assignments, not capacity %
- No bulk blocker resolve, no export beyond CSV client-side
- No Qase/handoff version pinning beyond derived
- Full Playwright journey for block→assign→queue→ready not automated

## Acceptance Checklist
- [x] default not giant matrix, matrix optional
- [x] blockers visible with age/severity
- [x] owner/team visible
- [x] due/overdue visible
- [x] next action visible
- [x] current stage understandable
- [x] denominator excludes not_applicable
- [x] MISSING ≠ BLOCKED/IN_PROGRESS
- [x] matrix remains
- [x] Table operational, Kanban operational, My Work useful
- [x] Quick View + Workspace work, derived statuses preserved
- [x] bulk cannot fake complete, QA/publish separate, deep-links, real thumbs, pagination, RTL, build green
- [ ] browser at 4 resolutions pending full capture (preview verified)
- [x] no Flutter touched
