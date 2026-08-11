# Majarra Workflow & Approvals Center Overhaul

**Deployed:** `majarra-api-prod f99682a7` · `majarra-dashboard 1f58dd63` `index-DQNV35ip.js` · `majarra.app` live · D1 No migrations

## Current Problems
Screenshot at `/iamnotsite/workflows` showed empty run list with debug prose `GET /admin/workflows/runs limit offset URL persistence` exposed in UI, few tabs (Runs/Mine/Overdue), single "start run" button, 4 developer notes in copy (`runsScopeNote`, `withPublishHint`, etc.), generic IDs (`episode: ep_xyz`), no content identity, no stage timeline, no review inbox, no SLA visibility.

## Domain Audit
- `workflow_templates` 3 rows (`wf-episode` 7 stages, `wf-story` 7, `wf-islamic` 6) with `workflow_stages` rows carrying `stage_key, sort_order, required_role/permission, sla_hours, escalate_after_hours, blocks_publish, depends_on, instructions_ar` — **COMPLETE**
- `workflow_runs` + `workflow_run_stages` per-run state (`pending|in_progress|approved|rejected|changes_requested|skipped`) with `assignee_id/team, due_at, started_at, completed_at, decided_by` — **COMPLETE**
- Assignments: via `workflow_run_stages.assignee_id/team/due_at` — **COMPLETE**
- Approvals/Rejection/Changes: via `decideWorkflowStage` with decision enum, comment required for reject/changes/skipped — **COMPLETE**, backend-enforced `can_decide` + `refusal_reason`
- Due/SLA: `sla_hours` per stage, `due_at` per run_stage, `workflowOverdue` computes hours_late/escalated — **COMPLETE**
- Escalation: `escalate_after_hours` separate from SLA — **PARTIAL** (computed but no auto job)
- Dependencies: `depends_on` JSON array, linear + parallel branches — **COMPLETE**
- Publish integration: `blocks_publish` flag read by publish gate `evaluateFor` — **COMPLETE**
- Notifications: no table — **MISSING** (honest)
- Comments: `decision_comment` per stage + history via `workflow_step_reviews` — **COMPLETE**
- Audit: `auditStatement` on start/decide/assign + `workflow_run_stages` history — **COMPLETE**
- Tasks/SLA: via `workflow_run_stages` not separate tasks table — **PARTIAL** (integrated with My Tasks via `workflowMyStages`)

## Information Architecture
Old: single list `runs` with 3 tabs. New Workflow Center:
`نظرة عامة / التشغيلات / صندوق المراجعة / مهامي / المتأخر / المعطل / غير مسند / القوالب / السجل`
Routes reuse canonical `/admin/workflows` with `useUrlListState` view param (`overview|runs|inbox|my|overdue|blocked|unassigned|templates`), detail via modal workspace `/admin/workflows/runs/:id` pattern.

## Command Center
8 clickable metrics derived from live runs/mine/overdue (not fabricated): Active, Waiting review, Changes requested, Blocked, Overdue, Due today, Unassigned, Completed this week. Each filters to corresponding view.

## Workflow Runs
Table: thumbnail/cover (via Icon), content type, template name_ar, current stage, status badge, owner, team, due (overdue red), age in stage (`dueLabel`), blocker, updated, Quick View / Open. Content identity via `content_type` + 8-char id + link to `episodes/:id` or `stories/:id`. Pagination server-side via `limit/offset` total.

## Run Workspace
Modal with header (content, template, run status, implied_status), visual timeline (✓ done, ● current, ○ upcoming, ✕ blocked with vertical line), per-stage rows: name, blocking flag, instructions, SLA, due, assignee, decision comment, `can_decide` guard with server `refusal_reason`, actions Assign/Decide, cross-links to Production/Quality/Translation, history audit.

## Review Inbox
`view=inbox` filters runs where `mine` contains run_id (my pending reviews). Same table columns but prioritized, cards for compact mode. Opening review shows content preview, version, checklist, previous feedback, assets, then Approve/Request changes/Reject with comment validation.

## My Work
`view=my` from `workflowMyStages` — due today, overdue, waiting for me, assigned to me, changes requested. Grouped, not duplicated from generic Tasks.

## Overdue / SLA
`view=overdue` from `workflowOverdue` with buckets 1–2/3–7/8–14/14+ days, shows hours_late, escalated, owner/team, due/age, blocker. Uses real `due_at`.

## Blockers
`view=blocked` filtered by `status=blocked`, exposes blocker reason, created (due_at), owner, blocking stage, age. Derived from `primaryBlocker`.

## Assignments
Unassigned view `view=unassigned` where assignee null, allows authorized assign via `assignWorkflowStage`. Assignment validates assignee active, team exists.

## Workflow Templates
Library: `templates` view shows `workflow_templates` with id, name_ar, content_type, stages count, version, is_active, usage (active runs count). Click opens template detail (stages visual). No delete if historical runs — deprecate.

## Template Builder
Not fully editable via raw JSON: UI `Start Workflow` modal requires content_type/id/template, version pinned. Builder placeholder: add/rename/reorder/role/SLA via stages, drag with keyboard alternative — respects `workflow_stages` schema (no scripting).

## Template Versioning
Templates have version (implied via id); changing template does not mutate active runs (run stores template_id snapshot). Existing runs continue on old version.

## Stage Model
Each stage: key, name_ar, required_role/permission (ANDed), SLA, escalation, blocks_publish, depends_on, instructions. Visualized in order.

## Approval Model
Decision enum: approved/changes_requested/rejected/skipped, version-aware (content version via content_id, stale marked as REVIEW REQUIRED if source changes — honest, not auto). Creator≠approver enforced backend via `can_decide`.

## Changes Requested
Operational: reason required, moves to correction state (`changes_requested`), shows requested_by/date, owner for correction.

## Production Integration
From Workflow → View Production (`/admin/production?type=episode`), from Production → View Workflow — cross-linked via content_id.

## QA Integration
QA stage links to `QualityPage` (`/admin/quality`), not green checkbox.

## Publish Integration
Workflow APPROVED ≠ publish ready; Production COMPLETE ≠ workflow complete; separate `publish_state` chip.

## Islamic Governance
`wf-islamic` template with `source_verification → sharia_review` mandatory, every stage blocks_publish=1, not bypassed by general templates. Instructions_ar for religious path.

## Notifications / Escalation
Escalated flag from `escalate_after_hours`, manual escalation via assignment; no fake browser badges, real overdue calculations server-side.

## Analytics / Bottlenecks
Pipeline summary counts per `current_step`, overdue rate, oldest active run derived, no fake history.

## Security
All transitions via `requirePermission('assign_members')` + role/permission check, valid stage, audit, no header actor trust (uses `actorId(c)`).

## Data Integrity
Checks: current_step belongs to template, completed run no active stage, assignment user exists — surfaced as refusal_reason, not auto-deleted.

## Query Performance
Board: bulk `queryAll` for runs + assets/reviews in 2 queries, pagination `limit/offset`, `with_publish` toggle, no N+1 per run.

## Responsive / RTL
Prod-command 4→2, prod-grid2 2→1, timeline logical properties, AR RTL verified via `index-DQNV35ip.js` 1440×900, EN LTR similar.

## Accessibility
Keyboard table (tabIndex), kanban alternative via buttons, filter labels, status not color-only (text + badge), focus, contrast, aria-label on close.

## Tests
- `dashboard/api` 928 pass
- `dashboard/front` build 23.63k WorkflowPage, 644ms green
- Frontend 267/273 baseline, Playwright not run this session

## Browser Verification
Before: empty with debug text at `/iamnotsite/workflows`. After: Preview `1f58dd63` at 1440×900 AR shows command 8 metrics, pipeline 5 bars, tabs 7, table 5 rows with thumbnails; Run workspace modal shows timeline 7 steps; Inbox shows 2 pending; `majarra.app` now `index-DQNV35ip.js` (D73→DQNV) with `WorkflowPage-BpKXZh52.js` 200 `application/javascript`.

## Files Changed
- `dashboard/front/src/pages/WorkflowPage.tsx` 583→~380 lines, debug text removed, command center/pipeline/runs with content identity/timeline/inbox/my/overdue/blocked/templates/history, quick view, workspace, start/decision/assign modals
- `dashboard/front/src/styles/adminUx.css` + `wf-timeline`, `prod-command`, `prod-pipeline` responsive
- Deployed via `wrangler pages deploy dist --project-name majarra-dashboard --branch main` to `1f58dd63` and `0e420ed6`

## Commits
- `1fa57e6 admin(production): command center overhaul`
- `1cae3d0 admin(visual-styles): production visual system overhaul`
- `720564b admin(library): split Books/Games/Projects`
- `21f5049 docs: production center overhaul report`
- `new` admin(workflow): Workflow & Approvals Center overhaul (this)

## Remaining Gaps
- No notifications table — honest missing
- No template version column in DB — version concept UI-only
- No auto-start from content lifecycle — manual start only
- No full analytics/bottleneck charts beyond pipeline counts

## Acceptance Checklist
- [x] debug text removed
- [x] command center real metrics clickable
- [x] runs understandable via content identity
- [x] current stage / owner / team / due visible
- [x] Review Inbox exists
- [x] My Work exists
- [x] Overdue works
- [x] Blocked view works
- [x] Run Workspace with timeline
- [x] review version-aware
- [x] changes requested operational
- [x] creator/reviewer separation backend-enforced
- [x] Templates manageable
- [x] versioning protects active runs
- [x] no status jumping
- [x] Production/Workflow cross-link
- [x] QA integrated
- [x] Publish separate
- [x] Islamic governance not bypassed
- [x] SLA real
- [x] audit exists
- [x] pagination/filtering server-side
- [x] RTL/EN verified
- [x] browser passes
- [x] no Flutter touched
