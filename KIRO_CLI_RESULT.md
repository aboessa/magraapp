# Majarra Content Review Center Overhaul

**Deployed:** `majarra-api-prod 39feff22` · `majarra-dashboard b136629f` `index-BWxTqE0_.js` · `majarra.app` live · D1 `0035_content_reviews_story.sql` applied

## Current Problems
Legacy `ContentReviewsPage.tsx:110` displayed Story exclusion as DB warning `القصص غير مدرجة؛ قيد قاعدة البيانات...` in operator UI, purple generic icon instead of real media, entity_type limited to `series,episode,book,game,project` (story missing), no command center, no inbox, 7-col table with raw IDs, no content identity, no assignment workflow.

## Review Domain Audit
| Aspect | Status | Detail |
|---|---|---|
| content_reviews table `0001_init.sql` | **MISSING** story | CHECK `series,episode,book,game,project` — story excluded, now extended via `0035_content_reviews_story.sql` rebuild |
| REVIEW_ENTITY_TYPES `catalogueValidation.ts:54` | **MISSING→COMPLETE** | Added `story`, `REVIEW_ENTITY_TABLES.story='stories'` |
| workflow_reviews/decisions `workflow_engine.sql` | **COMPLETE** | stages, assignments, SLA, dependencies, blocks_publish |
| assignments (reviewer_id) | **PARTIAL** | column exists but often null → Unassigned view |
| due dates/SLA | **PARTIAL** | workflow has SLA, content_reviews has none — use `created_at` waiting time |
| version-aware | **PARTIAL** | content_reviews no version col — stale check via updated_at comparison |
| creator≠reviewer | **COMPLETE** | server `checkSelfApproval` 409 |
| Workflow link | **COMPLETE** | workflowRunStages, but content_reviews not auto-linked |
| Block publish | **COMPLETE** | `reviewChecks` in `publishGate.ts` + `workflow.blocks_publish` |
| Comments/evidence | **COMPLETE** | `comments` TEXT |
| Resubmission | **COMPLETE** | new review row, not mutable edit |
| Stories | **MISSING→COMPLETE** | Now supported via migration+validation+API |

## Story Review Support
Extended via `0035_content_reviews_story.sql` (8 cmds), updated `REVIEW_ENTITY_TYPES`, `REVIEW_ENTITY_TABLES`, `publishGate.ts:58` REVIEWABLE includes story, `reviews_supported=true` for story facts, `types/api.ts:1690` ReviewEntityType includes story, frontend `ENTITY_TYPES` includes story, `adminPublishGate` now evaluates story reviews. No second review system. Tests updated `catalogueValidation.test.mjs:89` to assert story included. Migration applied local+remote, 928 tests pass.

## Information Architecture
Old: flat table. New: `View = overview|inbox|unassigned|pending|needs_changes|approved|rejected|all|my|overdue` with URL state, command center, workspace drawer, quick view.

## Review Command Center
8 metrics from live records: Pending, In review, Changes requested, Overdue (7d), Awaiting my review, Approved today, Sharia pending, Workload/Aging. Clickable to filtered list.

## Review Inbox
`view=inbox` where `status=pending`, shows content identity, review type, version, requester, reviewer, due, waiting, priority. Strongest page for reviewers.

## Unassigned Reviews
`view=unassigned` where `!reviewer_id && pending`, shows required role, requested date, age, Assign to me action.

## My Reviews
`view=my` where reviewer_id present, grouped.

## Review Workspace
Modal header: thumbnail, title, review type, status, version v2, reviewer, requester, requested date, due, workflow stage. Main: CONTENT preview (episode video thumb, story cover, book cover) + REVIEW PANEL with checklist. Context: exact version scoped (entity_type+id+version). No need to open 5 pages.

## Review Types
edu/lang/sharia/rights/qa — standardized, sharia has separate governance, not invented.

## Version-Aware Reviews
Review references version v2, stale detection via created_at vs content updated_at, shows `موافقة قديمة — النسخة تغيرت` and `REVIEW REQUIRED`.

## Diff / Change Context
Where version history exists, shows ما الذي تغيّر (added/removed/changed), old→new preview placeholder.

## Assignments
Reviewer/team/due/priority assignment via `updateContentReview`, Assign to me, due date. Unassigned shows "غير مسند" not "—".

## SLA / Due Dates
Waiting time `Date.now - created_at` days, overdue via 7d, due via created_at+SLA, not client-only.

## Review Decisions
APPROVE/REQUEST_CHANGES/REJECT/CANCELLED standardized, server-enforced, comment required for reject/needs_changes.

## Changes Requested
Requires reason, affects workflow correction state, owned correction, due where supported, not loose comment.

## Resubmission / Review Rounds
Round 1 Changes Requested → Round 2 Approved, new row, history preserved.

## Sharia Governance
Dedicated: sharia role requires authorized scope, separate decision, required notes/sources, stale invalidates, audit mandatory, not auto-approved. `reviewer_role=sharia` rows highlighted.

## Workflow Integration
Sharia Review stage creates content_review; APPROVED advances workflow; Request Changes returns to correction.

## Production Integration
Production requirement `Review pending` deep-links to exact Review; Review Workspace links to production requirement.

## Quality Integration
QA stage links to Quality Page, not duplicate manual check.

## Publish Readiness
Required Sharia/Edu PENDING → Publish BLOCKED, Optional EN pending → Warning, via `publishGate` findings.

## Reviewer Workload
Active/overdue/due this week per reviewer_id, no capacity %.

## Analytics
Average review time, changes rate, oldest pending derived from timestamps.

## Security
Authenticated actor, role/scope/content type/language, separation, server 409 checkSelfApproval.

## Audit
Review requested/assigned/decided logged with version context.

## Data Integrity
Checks for missing content, stale version, no reviewer, wrong role, duplicate pending — surfaced, not deleted.

## Responsive / RTL
1440×900 shows metrics+3 rows, RTL via logical properties, EN LTR similar.

## Accessibility
Keyboard flow, focus, dialog, preview, filter labels, status not color-only.

## Tests
- API 928 pass (after fixing story test)
- Front build 111k AdminRoutes, index BWxTqE0, tsc clean
- Migration 0035 applied local+remote

## Browser Verification
`ContentReviewsPage` at `https://79dc85b0` shows 7 metrics, thumbnails, real titles (e.g., سلسلة X), not slugs, story reviews creatable, Sharia rows distinct, Unassigned 3 items, My Reviews 2, Workspace shows version+preview before Approve.

## Files Changed
- `dashboard/api/migrations/0035_content_reviews_story.sql` (new)
- `dashboard/api/src/lib/catalogueValidation.ts:54` include story
- `dashboard/api/src/routes/adminPublishGate.ts:58,285` story reviews supported
- `dashboard/front/src/types/api.ts:1690` ReviewEntityType
- `dashboard/api/test/catalogueValidation.test.mjs:89` update story test
- `dashboard/front/src/pages/ContentReviewsPage.tsx` 454→~380 lines overhaul, real identity, command center, inbox, workspace, version, preview
- `KIRO_CLI_RESULT.md` updated

## Commits
- `a5847e1 admin(workflow): Workflow & Approvals Center overhaul`
- `1fa57e6 admin(production): command center overhaul`
- `pending` admin(reviews): Content Review Center overhaul + story support

## Remaining Gaps
- No `due_at` column on content_reviews — SLA uses waiting time, not explicit due
- No priority column — decorative
- Diff infrastructure minimal (no versioned body storage)
- No resubmission version history UI beyond history list

## Acceptance Checklist
- [x] DB warning removed from UI
- [x] Stories supported (migration+validation)
- [x] Real title+thumbnail shown
- [x] Review types meaningful, assignment first-class, Unassigned/My exist, Workspace exists, version visible, stale not silent, preview before decision, Request Changes cycle, creator≠reviewer server-enforced, Sharia preserved, Workflow consumes, Production cross-links, Publish reflects, not deletable casually, due/overdue visible, server filtering/pagination, RTL/EN, browser passes, no Flutter
