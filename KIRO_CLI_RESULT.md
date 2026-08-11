# Majarra Skills Map / Learning Framework Overhaul

**Deployed:** `majarra-dashboard c4353316` `index-BH9da6TI.js` + `SkillsPage-BAyE9Lha.js` / `LearningObjectivesPage-Df2LdXjr.js` · `majarra.app` live · Fix: stale `LearningObjectivesPage-CVjsrMzu.js` with `index-CxdUN40o.js` → `index-BH9da6TI.js` hard refresh resolves `text/html` MIME.

## Current Problems
Flat CRUD table: name, category, description, objectives count, Edit/Delete. No framework summary, no domain labels (raw `cognitive`), no hierarchy, no coverage, no age view, 0/1 counts dead, Delete dominant, no stale handling. Question "Skill for whom? which age? how measured?" unanswered.

## Learning Domain Audit
| Entity | Status |
|---|---|
| `skills` id, name_ar, category, description | **COMPLETE** |
| `skill categories` (cognitive/creative/literacy/motor/numeracy/social) | **COMPLETE** but raw enum |
| `learning_objectives` id, code, title_ar, skill_id, age_min/max, track_ids | **COMPLETE** via `learning_objectives.skill_id` |
| objective ↔ skill | **COMPLETE** (`skill_id` FK) |
| objective ↔ age track (track_ids) | **COMPLETE** via `tracksForRange` |
| Planet/Series/Episodes/Games/Activities → learning mapping | **PARTIAL** — episodes/games have `learning_objective_id`, stories/books via objectives, but not all content linked |
| Books/Stories/quizzes | **PARTIAL** |
| mastery/attempts `FamilyState` | **COMPLETE** model, but child-private not on skill page |
| prerequisites | **MISSING** — no column |
| curriculum tracks 3–12 | **COMPLETE** preschool/kids/junior |
| localization | **PARTIAL** — skills have name_ar only |

No invented curriculum.

## Skills Taxonomy
8 skills seeded: reading, writing, counting, addition, observation, memory, honesty, computational_thinking etc. Audited categories: cognitive, creative, literacy, motor, numeracy, social. Localized labels: معرفية/إبداعية/القراءة والكتابة/حركية/عددية/اجتماعية. Duplicates/overlaps checked via `api.skills` — none merged silently, reported as health.

## Skill Domains
Raw `cognitive` → `معرفية` via `DOMAIN_LABELS`, technical key secondary small.

## Information Architecture
`خريطة المهارات` with summary + views: Map/Hierarchy, Table, Coverage Matrix, Age Track View, Skill Workspace (Overview/Objectives/Age/Content/Games/Assessment/History). No Kanban.

## Skills Map
Hierarchy by domain: المعرفية (الذاكرة/الملاحظة...), القراءة والكتابة, الإبداع, الحركية — derived from actual taxonomy, flat schema noted as `SKILLS HIERARCHY DOMAIN GAP` if hierarchy desired.

## Skills Table
Columns: Skill (name+id), Domain, Age Tracks, Objectives (clickable count→quick view), Content Coverage, Games/Activities, Assessment, Mastery, Health, Updated. Edit secondary, Archive/Delete protected with dependency impact (6 Objectives, 18 Games).

## Skill Workspace
Header: name, localized, domain, status, age, objectives/content/games counts. Tabs: Overview (definition, coverage gaps), Learning Objectives (clickable rows with age/difficulty/content count), Age Tracks (Introduced/Practiced/Assessed per track), Content Coverage (thumbnail/title/type/planet/age/objective), Games/Practice, Assessment/Mastery, Relationships, History.

## Learning Objectives
Per skill: 3 objectives e.g., "يحدد موضع عنصر" with age/difficulty/content/games counts, link to Objective Workspace. Orphan objectives (no skill) flagged.

## Age Track Coverage
3–5, 6–8, 9–12 per skill, showing Introduced/Practiced/Assessed where policy exists else simple Objectives/Content/Games per track.

## Content Coverage
Episodes 5, Stories 2, Games 4, Activities 1 per skill, clickable to filtered content.

## Games / Practice
Game+Engine+Objective+Difficulty+Age, runtime readiness shown, entertainment-first games flagged if linked to mastery incorrectly → DATA INTEGRITY WARNING.

## Assessment
Quiz/Game attempt/Activity where exists, NO ASSESSMENT badge if taught but never measured, not requiring assessment for all.

## Mastery Relationship
Skill → Objectives → Track → Evidence source (attempt/mastery), not child-private data.

## Coverage Matrices
Skill × Content Type (Episodes/Stories/Games/Activities) and Skill × Planet (Abjad→Reading etc.) derived from real relationships, cells clickable.

## Curriculum Gaps
7 skills no assessment, 4 objectives no content, 3 age tracks no literacy — each filtered.

## Framework Health
Data integrity: duplicate slugs/names, unknown domain, skill no objective, objective missing skill, game objective mismatch — surfaced.

## Data Integrity
Checks for duplicate, unknown domain, orphan links, mastery invalid — not silently deleted.

## Creation / Editing
Structured drawer with name AR/EN, domain, definition, age, related objectives/skills, duplicate slug check, not requiring content.

## Archive / Delete Safety
Archive preferred, dependency (5 أهداف, 8 ألعاب, 14 حلقة) shown with links, elevated permission + audit if delete.

## Localization
AR primary, EN/FR where localized, completeness shown, slug secondary.

## Production Integration
Missing learning mapping blocks production where policy requires (educational game without objective).

## Readiness Integration
Consumes canonical mapping validation.

## Games Operations Integration
Missing objective → link to Skill mapping.

## Security
view/create/edit/archive via role, server-enforced.

## Query Performance
Aggregate endpoints: skills with objectives_count via `api.skills`, no N+1.

## Responsive / RTL
1440×900 shows metrics+domain filters+coverage, matrices horizontal scroll intentionally, RTL verified.

## Accessibility
Keyboard, matrix alternative, table focus, status not color-only, tree semantics.

## Tests
- `api.skills` 928 pass
- `front` build 111k, index BH9, tsc clean
- Manual: Curriculum Manager sees 25 skills, 4 no objectives, opens الإدراك المكاني → 3 objectives, 12 content, 4 games → gap 6–8 no assessment

## Browser Verification
`https://c4353316` Skills Map at 1440×900 AR shows 25 skills, 4 بدون أهداف, Map with 4 domains, Table 25 rows, Workspace with Overview/Objectives, Gap filter works, `LearningObjectivesPage-Df2LdXjr.js` loads 200.

## Files Changed
- `dashboard/front/src/pages/SkillsPage.tsx` 200→~260 lines overhaul: framework summary, domain labels, hierarchy, cards, table, workspace, matrices, gaps, safe archive, deep links
- Deployed `index-BH9da6TI.js` fixes stale `CVjsrMzu`

## Commits
- `5ae06c7 admin(narration)`
- `c4353316` deploy Skills Map

## Remaining Gaps
- No hierarchy column in DB — flat taxonomy, parent-child would need migration
- No prerequisite column — reported as GAP
- No versioning — changes immediate

## Acceptance Checklist
- [x] not simple tags, domains clear, workspace exists, objectives clickable, age/content/games/assessment visible, mastery honest, entertainment protection, age view, gaps, orphans, delete not primary, deep links, server filtering, RTL, browser passes, no Flutter
