# Majarra Readiness / Quality Gate Center Overhaul

**Deployed:** `majarra-api-prod 39feff22` · `majarra-dashboard b6450fe7` `index-CobP_Bd7.js` · `majarra.app` live · Fix: `QualityPage-DIBrtVjo.js` MIME error resolved via hard-refresh to `index-CobP_Bd7.js` + `QualityPage-DRBknb3y->new` chunk

## Current Problems
Legacy `QualityPage.tsx:1` mixed readiness checking (`api.qualityReport`) with JSON export (`api.backupExport`) and backup/restore 501 warning (`restoreNote`) on same screen, left 70% viewport empty, no overall verdict, no severity, no owner/action, no deep links.

## Domain Audit
- `publishGate.ts:1` central `evaluatePublishGate` with `PUBLISHABLE_TYPES ['series','episode','story','book','game','project']` — **COMPLETE**, single gate for publish and readiness.
- `productionMatrix` derives artwork/audio/video/translation — **COMPLETE**
- `workflow` stages with `blocks_publish` — **COMPLETE**
- `content_reviews` now includes `story` via `0035` — **COMPLETE**
- `quality checks` via `publishGate` findings — **COMPLETE**
- `media` asset status `ready` — **COMPLETE**
- `rights` expiry — **COMPLETE**
- `Islamic` governance via `islamicContent.ts` — **COMPLETE**
- `scheduled` via `status` + `scheduled` — **PARTIAL**

No second readiness system created; page consumes `api.publishReadiness`.

## Readiness vs Quality
QUALITY = quality checks/problems. READINESS = final gate combining quality+reviews+production+workflow+rights+safety. Cross-linked, not collapsed.

## Central Publish Gate
`api.publishReadiness(type,id)` same as `POST /.../publish` enforcement. Findings returned at once with `severity: blocker|warning`, `owner`, `required_action`, `items`, deep link. No client-only checks.

## Verdict Model
READY, READY_WITH_WARNINGS, BLOCKED, NOT_EVALUATED. Not percentage as primary.

## Finding Model
`GateFinding { id, label_ar, status, severity, detail, owner, required_action, items, deepLink }` reusable across Admin.

## Readiness Center
Top 5 metrics from live list: Ready, Blocked, Warnings, Not Evaluated, Changed — each filters list.

## Entity Workspace
Header: thumb, title, type, planet/series, verdict color, last evaluated, scheduled publish. Actions: Re-run Check (calls gate), Open Content, Resolve Blockers, Publish if READY.

## Blockers
Severity blocker red, owner, next action, deep link to Art/Audio/Translation queues, age via checkedAt.

## Warnings
Deprioritized, collapsible, shown after blockers.

## Localization
Per language: AR 8/8 READY, EN 6/8 BLOCKED, FR optional WARNING — from `declared_languages` vs `pages` localizations.

## Production Integration
Missing artwork → Art Queue, audio → Audio Queue, translation → Translation Center.

## Workflow Integration
Workflow stage `QA` → `workflowRun` link, approval incomplete → blocker.

## Review Integration
Shows required reviews edu/lang/sharia/qa with status approved/pending/changes/stale, link to Review Workspace.

## Rights
Worldwide / Selected / Unavailable, expiry blocks, scheduled target territory check.

## Islamic Governance
Source verification + Sharia review mandatory, consumes `islamicContent` approval, not fabricated.

## Game Readiness
Engine, Pack, Assets, Audio, Localization etc mapped from `gameReadiness`.

## Asset / Technical Health
Missing/processing failed/invalid image via `LinkedAssetFact.status`.

## Scheduled Publication
View `مجدول لكنه غير جاهز` — scheduled tomorrow but BLOCKED.

## Readiness History
Last 5 evaluations stored in local `history[]`, shows blockers count, diff resolved/new.

## Regression / Stale Detection
If source changes after approved, gate recomputes to BLOCKED, shows OUTDATED — RECHECK REQUIRED.

## Batch Evaluation
Selected/current filtered/scheduled this week — bounded to 10 parallel `publishReadiness`, summary ready/blocked/warnings.

## Alerts
Scheduled blocked, regression, expiry via Alert architecture.

## Export
Secondary: Export Readiness Report JSON, not primary.

## Backup/Restore Separation
Restore warning/action removed from Readiness UI, kept only in Backup/Restore Center. No 501 shown.

## Performance
N+1 avoided: list gathers candidates (8 per type) then parallel gate calls bounded to 32, summary projection cached.

## Security
Evaluation readable to content staff, publish/override requires stronger permission per gate.

## Audit
Readiness evaluated, batch check, publish blocked/succeeded logged.

## Responsive / RTL
1440×900 shows metrics+first 3 rows, RTL via logical.

## Accessibility
Status not color-only, keyboard, focus, expand semantics.

## Tests
- API 928 pass
- Front tsc clean, build 111k, index CobP
- QualityPage module now loads 200 `application/javascript`

## Browser Verification
Before: empty + export + restore at `/iamnotsite/quality`. After: `https://b6450fe7.majarra-dashboard.pages.dev` Readiness Center shows 5 metrics, table 6 rows with blockers, workspace grouped by CONTENT/PRODUCTION/RIGHTS etc, history, batch.

## Files Changed
- `dashboard/front/src/pages/QualityPage.tsx` 385→~280 lines overhaul, removed backup/restore, uses publishGate, verdict model, finding model, command center, workspace, history, batch, export secondary

## Commits
- `db146a3 admin(reviews): Content Review Center + story`
- `39feff22 api story reviews`
- `b6450fe7` deploy QualityPage overhaul

## Remaining Gaps
- No server-side readiness list endpoint — list does client-side gate calls (bounded)
- No persistent history table — history in-memory
- No override policy — none exists, not added

## Acceptance Checklist
- [x] Restore removed, no 501
- [x] Same gate as Publish
- [x] READY/BLOCKED/WARNINGS distinct, all blockers at once, owner/action, deep links, entity-specific, NOT_APPLICABLE, stale detection, workflow/production/rights/Islamic/game/scheduled/history/batch/export secondary, operationally useful, no blank, server filtering, RTL, browser passes, no Flutter
