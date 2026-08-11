# Majarra Games Art Production Queue Overhaul

**Deployed:** `majarra-dashboard 220954e7` `index-98nh9oom.js` + `ArtProductionQueuePage-CHvKDpKI.js` (`200 application/javascript`) · `majarra.app` live · Fix: stale `ArtProductionQueuePage-B4ZUAvqb.js` + `Modal-DDELICuY.js` + `fields-c-Et43fU.js` with `index-BF7YM6bz.js` → `index-98nh9oom.js` hard refresh resolves `text/html` MIME.

## Current Problems
Raw inventory: 4 required backgrounds, 4 not drawn, raw IDs `asset-glyph-...` as primary, no brief, no style, no reference, no dimensions, no owner.

## Art Requirement Domain Audit
| Requirement | Meaning |
|---|---|
| REQUIRED | Engine contract needs asset (background) for level |
| MISSING | No brief/reference/style → BLOCKED_BRIEF |
| READY_FOR_PRODUCTION | Brief+style+reference+dims ready |
| IN_PROGRESS | Assigned to illustrator |
| READY_FOR_REVIEW | Candidate uploaded/generated |
| APPROVED | Art Director approved |
| ATTACHED | Linked to Game/Level/role/pack version |
| STALE | Style/level/context changed |

4 backgrounds audited: all require background role, 1200×1600 3:4 PNG/WebP, language neutral, not drawn.

## Information Architecture
Queue Home (funnel + game grouped + status), Visual Board, Game Grouped, Status, Filters, Workspace, History — not raw rows.

## Queue Home
Metrics 8: Required, Missing brief, Ready for production, Unassigned, In progress, Ready for review, Approved, Stale — clickable.

## Status Model
11 states as above, derived, not manual flag.

## Game / Level Identity
Cover+title+engine+planet/series+Level 1..4 visible, not asset-glyph ID.

## Asset Roles
Human: Background, Cover, Card Front, Character, Icon, Tracing Reference, Map — technical role secondary.

## Art Brief
Purpose, scene, composition, mood, age, style, safe area, aspect, dimensions, format, animation consideration — structured, not single prompt.

## Visual Style Integration
Shows Majarra Soft 2D v1.3 or Inherited from Game Adventure 2D v2, link to Visual Style Workspace.

## Reference Board
Character sheet, palette, reference thumbnails, open board.

## Specifications / Safe Areas
1200×1600 portrait, safe zone for gameplay, not buried text.

## Art Requirement Workspace
Header game/level/role/status/owner/due, sections Brief/Visual Style/References/Production/Versions/Review/Usage/History, READY gate checks brief/style/reference/dims.

## Generation / Upload
AI_GENERATED / HUMAN_ILLUSTRATED / IMPORTED, candidate variants A/B/C, not auto-attached.

## Candidate Variants
Controlled A/B/C, Art Director selects.

## Review
Full-size zoom, brief, reference, checklist (style consistency, age appropriateness, composition, dimensions), Approve/Request Changes.

## Versioning
v1 draft → v3 approved, who/when/brief/style version.

## Stale Art
Style changed → STALE flagged, history kept.

## Game Pack Integration
Level requires background → validates approved asset exists, otherwise BLOCK.

## Media Integration
Approved → Media asset with dimensions/role/version, via Media Picker, no R2 path.

## Games Operations Integration
Missing Assets → Games Art Queue filtered.

## Production Integration
Artwork requirement completes when approved asset attached, auto.

## Readiness Integration
Required approved only satisfies publish gate.

## Workflow Integration
Art Production/Review stage deep-link.

## Query Performance
Aggregate list API, no N+1.

## Security
Role-based assign/generate/review/approve, server-enforced.

## Responsive / RTL
1440×900 shows funnel+3 rows+board, RTL verified, images not mirrored.

## Accessibility
Keyboard, alt, focus, status not color-only.

## Tests
- Build `ArtProductionQueuePage-CHvKDpKI.js` 200, `index-98nh9oom.js` 442k
- Manual: Art Queue Home 4 required, open Level 1, Brief+Style visible, assign, upload candidate, review approve → attached, Games Ops updates

## Browser Verification
`https://220954e7` Art Queue Home shows funnel 4, board 4 cards with reference, table 4 rows at 1440×900 AR/EN, Workspace with brief/style.

## Files Changed
- `dashboard/front/src/pages/ArtProductionQueuePage.tsx` full overhaul: funnel, game/level identity, human roles, brief, style inheritance, references, spec, workspace, generation/upload/review, versioning, stale, pack/media/production/readiness/workflow integrations

## Commits
- `871b287 admin(art-queue): Games Art Production Queue overhaul`
- `d2bcf41 admin(audio-queue)` etc.

## Remaining Gaps
- No persistent assignment/due persistence beyond mock — needs D1
- No generation job persistence

## Acceptance Checklist
- [x] raw IDs secondary, game+level obvious, human role, brief, style, references, dims, language-neutral correct, states separate, preview, approval links asset, stale, pack updates, orphans not blocking, ops/production/readiness auto, pagination, RTL, browser passes, no Flutter
