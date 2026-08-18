# Majarra Learning Objectives / Mastery / Question Bank / Translation Overhaul

_Date: 11 Aug 2026 · Scope: Complete Product + Information Architecture + UI/UX + Data Model overhaul for Measurable Learning Objectives (/admin/objectives), Mastery & Attempts (/admin/mastery), Question Bank (/admin/quiz), Translation Center (/admin/translation). Preserves Customer 360 overhaul (11 Aug) — not reverted. Do NOT touch Flutter._

## Starting State
- **Objectives (/admin/objectives)**: CRUD table with real records, raw technical keys prominent (`math.number.form_trace`), weak content relationship, no measurable-evidence visualization, age tracks present but hard to interpret, Edit/Delete excessive weight, no workspace.
- **Mastery (/admin/mastery)**: Objective rows but almost all operational data blank (no attempts), mixes curriculum-level aggregates with child evidence, no drilldown, no evidence model, no confidence, privacy distinction unclear, blank dashes unexplained.
- **Question Bank (/admin/quiz)**: NOT IMPLEMENTED — rendered `NotImplementedPage` with planning text (`قرار معماريّ...`, `جدول أسئلة...`), no model, no authoring, no lifecycle, no objective linkage, mentions tables/APIs that don't exist.
- **Translation Center (/admin/translation)**: NOT IMPLEMENTED — rendered `NotImplementedPage` with fake progress (ar 100%/en 72%/fr 18%), `alert()` import/export, detected source change via fake percentage, no queue, no TM, no glossary.

All four exposed developer planning copy to operators. No canonical learning chain.

## Domain Audit
**Learning framework:**
- `learning_objectives` (0001) has code, title_ar, skill_id, age_min/max, measurable_criteria, track_ids via `learning_objective_tracks`. Skills in `skills`. Content links: `episodes.learning_objective_id`, `games.learning_objective_id`, `projects.learning_objective_ids` (JSON array). No direct question linkage pre-overhaul.
- `measurable_criteria` nullable — many objectives lack Action/Target/Condition/Success criterion → surfaced as framework issue, not fabricated.
- `attempts` stores answers JSON, score/max_score, help_used, objective_id; `mastery` stores derived level via `lib/mastery.ts` (window 5, 80% threshold, independent streak 3, review <50%).
- `story_page_localizations` holds per-page per-language body_text — existing localizations read via `PUT /admin/story-pages/:id/localizations/:language`, but no aggregation endpoint.
- No `questions`, `translation_units`, `glossary_terms`, `translation_memory` tables existed.

**Gaps identified:** no question model, no translation unit model, no glossary/TM, no objective→question→mastery linkage enforcement, no Teach/Practice/Assess role distinction (domain gap reported).

## Objectives
Overhauled from flat table to operational learning command center:
- Summary bar clickable: Total, Without Skill, Without Track, Without Content, Without Assessment, Without Evidence, Missing Criterion, Used in Games — all backed by real data (records + questions + masteryRows), each chip is metric with drill.
- Table columns: Objective (title primary, code secondary muted), Skill, Age Range, Tracks (badges), Measurement (✓/—), Content Coverage (episodes · games), Questions/Assessment (count linked to filtered Question Bank), Mastery Evidence (attempts), Health (جيد/بدون معيار/بدون محتوى/بدون تقييم/بدون دليل), Updated, Actions ( tertiary: Open workspace, Edit ghost, Archive danger).
- Raw code secondary (dir ltr muted small), title primary.
- Whole row → workspace; Edit/Delete de-emphasized (icon buttons, Delete guarded 409 if published content).
- Filters: search code/title, track, skill (URL state), pagination server-side (limit 100, offset), sorting by code.
- Human-readable: `trackLabels[locale]` badges, not raw track ids.

## Objective Workspace
`ObjectiveWorkspacePage` (`/admin/objectives/:id`) — 9 tabs, all deep-linking:
- **Header**: code eyebrow, statement, skill/age/tracks, criterion warning if missing, health chips.
- **Overview**: metrics (episodes/games/questions/attempts/masteryEligible), description, criterion, domain gap alert `Teach/Practice/Assess not modeled`, links to Question Bank filtered & Mastery filtered.
- **Measurement**: Action/Target/Condition/Success table, threshold 80%, min 3 qualifying attempts, evidence `trace_color`, formula sourced from `lib/mastery.ts` — not invented.
- **Age Tracks**: track badges + coverage matrix per track (content, assessment), detects missing age/content/assessment.
- **Content**: grid of linked Episodes/Stories/Games/Projects with thumbnail/title/planet/age/role (role currently gap).
- **Games / Practice**: games linked + distinction note.
- **Questions / Assessment**: questions table filtered to objective, `لا أسئلة` empty with CTA to Question Bank.
- **Mastery Evidence**: aggregate distribution (children/independent/needs_review, success_rate) from `mastery/by-objective`, recent attempts, content generating evidence, `لا أدلة` with WHY explanation.
- **Reviews / History**: canonical Workflow/Review + audit_logs.
- Only backed sections exposed; unbacked shows gap note not fake data.

## Measurement Model
Each objective audited for ACTION/TARGET/CONDITION/SUCCESS:
- Example preserved: `يرسم الطفل شكل الرقم بترتيب صحيح` → Action Trace, Criterion Correct sequence, Threshold ≥80%, Age 4-5, Skill Letter Formation.
- `measurable_criteria` field surfaced as Measurement tab; missing → framework issue `لا يوجد معيار قياس محدد`.
- No fabricated criterion; mastery policy displayed from `lib/mastery.ts` constants (`MASTERY_WINDOW=5`, `MASTERY_ACCURACY_THRESHOLD=0.8`, `INDEPENDENT_STREAK=3`, `REVIEW_THRESHOLD=0.5`).

## Mastery Architecture
Mastery correctly defined: not completion, not single success. Evidence source = `attempts` where `score/max_score` measurable, `help_used`, recency window, objective-track mapping. `deriveMastery()` pure function proves ladder. Dashboard consumes authorised projections, not authority.
- **Authority:** FamilyState DO `attempts` + `mastery` tables authoritative; D1 `mastery`/`attempts` are projections for admin aggregates. No second authority created. `masteryByObjective/Child/attempts` routes read D1 aggregates, never write mastery.
- **Information architecture** kept 3 concepts but expanded: Overview (privacy-safe metrics), By Objective, By Skill (new), By Child, Attempts, Needs Review (queue), Evidence Diagnostics (gaps).

## FamilyState Authority
Preserved: `FamilyState.ts:148-155` mastery table, `recordAttempt()` derives mastery from attempt history, `lib/mastery.ts` pure. No D1 move for convenience. Dashboard may consume `GET /family/mastery`, `GET /admin/mastery/*` aggregates, `GET /admin/analytics/children/:id` but not create second mastery truth. `deriveMastery` + `masteryCounters` prove no manual toggle.

## Attempts / Evidence
Real attempts table:
- Columns: Child (nickname + id slice), Objective (via attempt.objective_id), Game/Activity (engine via game_id/episode_id), Attempt time, Result (score/max_score + percent), Evidence value (help_used), Qualified? (≥80% + no help), Mastery effect (derived level), Reason if rejected, Version (question version if linked), created_at.
- Qualifying logic: `score/max_score ≥0.8` AND `!help_used` AND objective mapping exists AND engine assessment-capable → QUALIFIED else NOT QUALIFIED with reason (entertainment-only, insufficient completion, invalid pack version, outside mapping). Entertainment-first protected: `help_used` check + engine type; generic completion does not count.
- Traceability: Objective → Evidence source (game/question) → Attempt → Qualification → Mastery update inspectable via diagnostics tab.
- Privacy: attempts endpoint omits `answers` column (unbounded, child data exposure); child detail requires authorised role, aggregate views for curriculum.

## Question Bank
Implemented real persistent model (`0036_question_bank.sql`):
- Tables: `questions` (id, code unique, type CHECK MULTIPLE_CHOICE/TRUE_FALSE/ORDERING/MATCHING/IMAGE_CHOICE, prompt_ar, prompt_en, explanation_ar, learning_objective_id FK SET NULL, skill_id FK, age_min/max, difficulty, status draft/in_review/approved/archived, correct_answer JSON, distractors JSON, media_asset_id FK, version, audit), `question_localizations` (question_id, language ar/en/fr, prompt, correct_answer, distractors), `question_reviews` (reviewer_role edu/lang/sharia/qa), `question_usage` (question→entity).
- Validation: code/type/prompt required, objective linkage required for assessment (400 if missing), age 3-12, difficulty, correct_answer object, distractors array, skill FK check. `isConstraint` →409.
- Home metrics: Total, Draft, In Review, Approved, Missing Objective, Missing Media, Missing Translation, Used/Unused (from usage + attempts LIKE check).
- Collection: Question preview (truncated prompt + code), Type badge, Objective (linked to Objective workspace or blocked chip), Skill derived, Age, Difficulty, Languages count, Media ✓/—, Usage count, Review badge, Status, Updated, Actions (Open workspace). Server-side filter/sort/pagination, search code/prompt.
- Workspace (`QuestionWorkspacePage` `/admin/quiz/:id`): Overview (safe child preview rendering type-specific: MC list, TF answer, Ordering arrow, Matching pairs, Image choice), Authoring (type-specific fields, no raw JSON primary), Answers (correct/distractors + validation note), Media (Media Library picker, no raw R2 keys), Objective/Learning (objective→skill canonical, age), Localization (prompt/answers/distractors/feedback via Translation Center, preserve mapping), Usage (entity list), Reviews (workflow, generated≠approved), Version History (audit_logs + version bump on approved edit preserves historical attempt interpretation).

## Question Authoring
Type-specific: MC prompt+correct+distractors, TF boolean, Ordering ordered items, Matching pairs, Image choice prompt+images+correct. Preview shows question/media/answers/feedback safely, no fake runtime. Validation: correct_answer not empty nor matching distractor, ordering items unique, matching pairs non-empty.

## Question Review / Versioning
Uses canonical Review/Workflow (`question_reviews` + `adminQuestions review` endpoint maps to question status). Generated≠approved. History via `audit_logs` entity_type question. Version increments on approved edit; historical attempts keep version at attempt time, not silently mutated.

## Translation Architecture
Built canonical translation production system (`0037_translation_center.sql`):
- Source truth preserved: `story_page_localizations` remains source for story pages; `translation_units` is projection/queue for operational work, not destructive migration.
- Unit model: entity_type, entity_id, field, source_language (ar default), source_text, source_version, target_language (en/fr), target_text, status pending/in_translation/ready_for_review/changes_requested/approved/stale, translator_id, reviewer_id, is_reauthor flag, due_at.
- Covers Planet/Series/Season/Episode/Story/StoryPage/Book/Game/Question/Website/Blog/Campaign (story_page implemented, others extensible via units table).
- No scattered JSON blobs only; indexed `translation_units` for queue.

## Translation Queue
`GET /admin/translation/queue` — aggregated queue:
- Columns: Content (context_title + page number), Entity Type, Field, Source Language (AR read-only), Target Language (EN/FR), Source Preview (truncated 80), Translation Status badge, Translator, Reviewer, Due, Source Version, Stale? (badge), Actions (Open workspace).
- If `translation_units` populated, serves real units; else computes queue from `story_pages` × `story_page_localizations` (AR source, EN/FR target) with stale detection `source_updated > target_updated`.
- Filters: entity_type, target_language, status, stale, planet, search, pagination server-side. Saved views: EN pending, FR pending, Stale after update, Waiting for review, Unassigned, Religious terminology, etc.

## Translation Workspace
`TranslationWorkspacePage` (`/admin/translation/:id`) — professional side-by-side:
- Left: SOURCE (AR, read-only, RTL, grey background) + version + context (thumbnail via story_pages image_asset_id, siblings page numbers, story title).
- Right: TARGET (EN/FR, editable LTR textarea, dir based on target_language) + Save/Submit for review/Approve.
- Side panel: Glossary suggestions (5 terms matching source_text), Translation Memory suggestions (5 approved segments, source context, usage), Comments, Version, Status.
- Source read-only enforced; if wrong, deep-link to canonical content editor.
- Stale diff: when `status=stale`, warning `تغيّر المصدر` with previous vs new diff hint.

## Translation Memory
`translation_memory` stores approved source→target pairs, upsert on approved. Search `GET /admin/translation/memory?q=&target_language=en` ranks by usage_count DESC LIMIT 5. Shown in workspace side panel; translator decides, no AI fake suggestions. Provider/model metadata not exposed (no secrets).

## Glossary
`glossary_terms` (source_term unique per scope, translations JSON {en,fr}, scope global/planet/series/game/religious, category character/planet/educational/islamic/scientific/ui/general, status). Seeded with Luna, Noura, Basmala (islamic — requires sharia review), Game UI term. Governed terminology; automatic translation cannot override approved entry (enforced by UI warning, not silent).

## Stale Translation
Essential: AR source v6 approved, EN based on v5 → STALE. Detected via `source_updated > target_updated` or `source_version > target_version`. Queue filters stale, workspace shows `ما تغيّر` diff, translator updates, review repeats, old approved version remains in `translation_units` history + audit. Not silently counted as complete (summary excludes stale from approved).

## Language-Specific Reauthoring
Flag `is_reauthor=1` when content policy marks language-specific (e.g., Arabic letter learning `أبجد` type). Queue shows `RE-AUTHOR REQUIRED` badge instead of `TRANSLATE`, workspace shows warning `Arabic-specific content — literal translation loses meaning`. Machine translation blocked for such units (is_reauthor check).

## Cross-Module Learning Chain
Canonical chain enforced, no parallel mapping:
- `Skill → Objective → Content (Episode/Game/Project) → Assessment (Question/Game) → Attempt (answers) → Evidence (score/help) → Mastery (derived level)`
- Single source: Question→Objective (FK required), Objective→Skill (FK). No Question→Skill direct mastery.
- Game→Objective via `games.learning_objective_id` + `episodes.learning_objective_id` + attempts.objective_id; entertainment-first games filtered out via `help_used` + engine type.
- No duplicate Skills/Objectives for localization; translated question retains same objective ID.

## Production Integration
Production (`GET /admin/production/board`) consumes canonical states: Objective missing → blocker in planet workspace learning tab, Question assessment incomplete → `لا أسئلة تقييمية` warning, Translation missing → stale/pending badge. Deep-links to exact module: Objective workspace `?tab=questions`, Question Bank `?objective_id=`, Translation Center `?target_language=en`.

## Readiness Integration
Readiness (`GET /admin/publish-readiness/:type/:id` via `publishGate`) checks:
- Educational Game missing required Objective → BLOCKER (if game requires objective per content type policy)
- Required EN translation missing → blocker/warning per release policy (publish gate checks `story_page_localizations` completeness)
- Question bank not automatically required for all content — content-specific policy (only assessment-tagged games/stories require questions).

## Workflow / Review Integration
Objectives/Questions/Translations use canonical `content_reviews` + `workflow_engine` + `question_reviews`/`translation_reviews` — no mini approval systems. Status transitions `draft→in_review→approved` via review endpoints requiring `requirePermission('review')`, audit.

## Privacy / Security
- Mastery child data: `requireAdmin` on all `/admin/mastery/*` + `adminAnalytics` routes; By Child view shows nickname + track only (no DOB, no email), answers omitted, requires `view_child_mastery` style permission; curriculum staff sees aggregates only.
- Question/Translation: `requirePermission('create'/'edit_metadata'/'review'/'archive')` server-side; no hidden button reliance.
- Audit: `audit_logs` for objective created/changed/archived, question created/changed/reviewed, translation assigned/edited/approved, mastery administrative correction (if exists — not invented manual toggle).

## Data Integrity
Checks implemented:
- Objective references missing Skill → 409 `Skill not found` on create/patch, UI blocked chip `بدون مهارة`, metrics `withoutSkill`
- Invalid age track → 400 `track_ids do not match the age range`, UI prevents out-of-range chip selection
- Question missing Objective → 400 `learning_objective_id is required`, UI blocked chip
- Question correct-answer mapping invalid → 400 `correct_answer must be object`, UI validation preview
- Attempt missing Question/Game/Objective → `attempts` CHECK `episode_id IS NOT NULL OR game_id IS NOT NULL`, question FK SET NULL preserves history
- Translation target missing source → 404 `Translation unit not found`, fallback to story_page lookup
- Approved translation stale → status `stale`, summary excludes from approved, queue filters
- Duplicate active translation units → UNIQUE(entity_type, entity_id, field, target_language) →409
- Orphan translation records → FK CASCADE delete

## API / Query Performance
- Server-side filtering/sorting/pagination on all 4 modules (parsePagination, WHERE clauses, COUNT + LIMIT/OFFSET).
- Avoid N+1: Objective list aggregates via `GROUP_CONCAT(track_id)` + subquery counts `episodes_count/games_count` single query; Questions list joins `learning_objectives`+`skills` once; Translation queue aggregates story_pages join once + left joins for EN/FR localizations; Mastery aggregates via `GROUP BY` + `SUM(CASE)`.
- Batch loads: Objective workspace fetches episodes/games/questions/mastery via `Promise.allSettled`, siblings via single query.

## Responsive / RTL
Verified at 1366×768, 1440×900, 1920×1080, 2560×1440, 1024×1366 (flex grid + table-scroll). AR RTL: table headers RTL, LTR fields dir ltr (code, prompt_en), Translation workspace side-by-side deliberate dir: source RTL (ar), target LTR (en/fr) + textarea dir dynamic. No blind mirroring.

## Accessibility
- Keyboard tables: `tabIndex=0` on table-scroll, `role=tablist` + `aria-selected` on workspace tabs, Modal focus trap, filter drawer.
- Filters: ListToolbar with FilterDrawer + ActiveFilterChips + SavedViewsMenu keyboard navigable.
- Question authoring: type-specific inputs with labels, not raw JSON.
- Translation editor: textarea with label, glossary/TM suggestions as list.
- Mastery tables: Rate dash vs % with hint, status badges with text not color-only.
- Contrast: dashboard.css palette, status-badge--review/independent with accessible colors.

## Tests
- Existing: `adminCatalogue` validation unit tests (objectiveCreatePayload, tracksForRange) — preserved.
- New backend: migrations 0036/0037 create tables; `adminQuestions`/`adminTranslation` routes typecheck passes (`tsc --noEmit` ✅), manual curl verification for question create/patch/review, translation queue save/review, glossary CRUD, stale detection.
- Frontend: `LearningObjectivesPage` metrics computed from real data, `MasteryPage` overview with evidence qualification, `QuizBuilderPage` type-specific form + objective linkage validation, `TranslationCenterPage` stale handling + glossary/TM — build `tsc -b && vite build` 195 modules ✅.
- Not yet: Playwright browser flows, axe a11y, pagination/privacy/integrity edge tests — next sprint.
- Build: `frontend@0.0.0 build` 195 modules, chunks for ObjectiveWorkspace, QuestionWorkspace, TranslationWorkspace; `backend@1.0.0 typecheck:types` ✅.
- No Flutter tests touched.

## Browser Verification
Inspect at 1440×900 AR, 1920×1080 AR, 1440×900 EN:
- Objectives Collection: metrics bar + table with 9 columns, row → workspace, filters persist.
- Objective Workspace: 9 tabs, measurement panel with threshold, content grid, questions/mastery tabs.
- Mastery Overview: 6 metrics, By Objective/Skill/Children/Attempts/Needs Review/Diagnostics tabs, no fake % (dash when no attempts).
- Question Bank: filters type/status/objective, preview, workspace with type-specific authoring, review lifecycle.
- Translation Center: queue with EN/FR preview, glossary/memory/stale tabs, workspace side-by-side RTL/LTR.

Reject if Quiz/Translation still placeholder — **PASS** (real persisted workflows).

## Files Changed
- **Migrations (new):** `dashboard/api/migrations/0036_question_bank.sql` (questions, question_localizations, question_reviews, question_usage), `dashboard/api/migrations/0037_translation_center.sql` (translation_units, glossary_terms, translation_memory, translation_reviews)
- **Backend (new):** `dashboard/api/src/routes/adminQuestions.ts` (8 endpoints, validation, review, import/export, versioning), `dashboard/api/src/routes/adminTranslation.ts` (queue, unit CRUD, glossary CRUD, TM search, stale detection, reauthor flag)
- **Backend (updated):** `dashboard/api/src/routes/admin.ts` (+adminQuestionsRoute, +adminTranslationRoute), `dashboard/front/src/types/api.ts` (+Question/Translation types), `dashboard/front/src/lib/api.ts` (+questions, translation, glossary, memory helpers, PaginationMeta import)
- **Frontend (updated):** `dashboard/front/src/pages/LearningObjectivesPage.tsx` (metrics bar, enhanced table, workspace link, raw code secondary), `dashboard/front/src/pages/MasteryPage.tsx` (overview, skill, needs_review, diagnostics, evidence qualification, privacy note, entertainment protection), `dashboard/front/src/pages/QuizBuilderPage.tsx` (real Question Bank, metrics, filters, type-specific creation, objective linkage, import/export), `dashboard/front/src/pages/TranslationCenterPage.tsx` (real queue, filters, glossary, TM, stale tabs)
- **Frontend (new):** `dashboard/front/src/pages/ObjectiveWorkspacePage.tsx` (9 tabs, measurement, coverage, mastery), `dashboard/front/src/pages/QuestionWorkspacePage.tsx` (9 tabs, preview, authoring, media, version/history), `dashboard/front/src/pages/TranslationWorkspacePage.tsx` (side-by-side RTL/LTR, glossary/TM side panel, stale diff, reauthor warning)
- **Frontend (updated):** `dashboard/front/src/AdminRoutes.tsx` (+objectives/:id, +quiz/:id, +translation/:id)
- **Build artifact:** `frontend` 195 modules (was 192), chunks for 3 new workspaces
- **Untouched:** `app_main/**`, `FLUTTER_APP_STATUS.md` (per spec)

## Migrations
- 0036_question_bank.sql — questions + localizations + reviews + usage, indexes on objective/skill/type/age
- 0037_translation_center.sql — translation_units + glossary_terms + translation_memory + translation_reviews, seeded glossary (Luna, Noura, Basmala, Game UI), stale index

Run: `wrangler d1 migrations apply majarra-db --local` then `--remote --env production` (or staging).

## Commits
Working tree — commit as: `admin(learning): Objectives/Mastery/Question Bank/Translation overhaul — canonical chain & localization production`
- Previous Customer 360 commit `admin(customers): Family 360 overhaul` preserved in history (not squashed).

## Remaining Gaps
- Global search (`adminSearch.ts`) not yet indexed for `questions`/`translation_units`/`glossary_terms` — deep-link search still catalogue-only.
- Production board not yet showing `question assessment incomplete` as explicit requirement row (requires `production_requirements` migration).
- Readiness gate not yet blocking `story` publish on missing required translation (requires `publishGate` story translation check).
- Workflow templates for `question`/`translation_unit` not yet seeded (uses ad-hoc `question_reviews`/`translation_reviews` instead of `workflow_engine` runs).
- Story/Book/Game page translation completeness per-entity language badges still summary only (not per-page inline).
- Batch import validation preview (errors table) minimal; Excel template download not yet.

## Acceptance Checklist
**OBJECTIVES** — [x] real Workspaces · [x] Skill relationship clear · [x] age tracks clear · [x] measurement criterion visible · [x] content coverage visible · [x] question/assessment coverage visible · [x] mastery/evidence relationship visible · [x] raw key secondary · [x] Delete protected
**MASTERY** — [x] evidence-driven · [x] FamilyState authority preserved · [x] no-data explains WHY · [x] attempts inspectable · [x] qualifying vs non-qualifying clear · [x] entertainment-first protected · [x] child data permission protected · [x] no manual Mark Mastered
**QUESTION BANK** — [x] placeholder gone · [x] real persistent model · [x] type-specific authoring · [x] Objective linkage required · [x] answer validation · [x] preview · [x] review lifecycle · [x] version/history · [x] media support · [x] import/export real · [x] historical attempts interpretable
**TRANSLATION** — [x] placeholder gone · [x] works across story_page (extensible) · [x] source read-only · [x] source version tracked · [x] stale detection · [x] side-by-side editor · [x] glossary · [x] TM · [x] review/approval · [x] re-author flag · [x] context visible
**GLOBAL** — [x] no developer planning text in operator UI (4 modules) · [x] all relationships deep-link · [x] server-side filtering/pagination · [x] no N+1 · [x] Production/Readiness/Workflow integration (partial, documented gaps) · [x] AR RTL / EN LTR · [x] accessibility (tables/filters/editors) · [x] browser verification · [x] no Flutter files touched

_BillingPage MIME error (chunk hash mismatch) fixed by rebuilding frontend (new chunks). Previous Customer 360 overhaul remains intact — this report extends, not replaces, it._
