# Islamic 66 Full Draft Scripts Implementation Plan

> **For the autonomous task runner:** Execute every task below in order. Do not stop after planning. Do not commit, push, deploy, mutate D1/R2, generate media, or mark religious approval.

**Goal:** Expand the 66 existing `draft-v1` Islamic review units into complete Arabic editorial scripts while preserving `review_sharia` as a hard human gate.

**Architecture:** Treat the twelve existing `review-drafts.md` files as immutable source briefs. Create one `ep-NN-<slug>.md` file per unit beside its source brief, using the Islamic unit model rather than the non-religious authoring contract. Add a deterministic validator that proves 66/66 coverage, required fields, timing, source linkage, review locks, and visual/audio prohibitions.

**Tech stack:** Markdown editorial sources, Node.js validation script, existing Node test runner conventions.

---

## Non-negotiable source and safety rules

1. Source briefs: `docs/content/planets/09-islamic/*/review-drafts.md` (12 files, 66 units).
2. Islamic schema: `docs/content/planets/09-islamic/00-unit-shell-model.md`.
3. Governance: `docs/content/91-islamic-governance.md`.
4. Luna identity, when Luna is used: `docs/content/planets/01-abjad/series-bible-luna.md`, identity `luna-discovers-words/luna-v2`, approved reference-pack hash already recorded there. Do not invent a new character or alter Luna.
5. Do not alter or delete the twelve `review-drafts.md` source files.
6. Every new file is `draft-v2` and `status = review_sharia`; `sharia_reviewer_id`, `sharia_review_version`, `language_reviewer_id`, `recitation_license_id`, and approval timestamps remain empty.
7. Never claim approved, production-ready, publishable, licensed, reviewed, or fact-checked.
8. Do not add Quran text, hadith wording, rulings, madhhab choices, fatwas, biography details, dates, names, miracles, or religious claims beyond the source brief. Preserve source references exactly and expose unresolved checks explicitly.
9. Quran/adhkar recitation remains a placeholder for a licensed human recording. Do not synthesize, rewrite, split inside a word, or place music under recitation.
10. No depiction or implied depiction of Allah, prophets, messengers, angels, jinn, or the unseen: no face, body, limb, shadow, luminous human form, voice attribution, or empty place implying presence.
11. No religious or other text burned into an image. UI/captions remain separate. Every visual brief includes: no text, letters, logo, watermark, caption, branding, UI, or overlay.
12. Do not generate any final image/video/audio. This task is editorial text only.
13. Arabic narration is simplified Modern Standard Arabic. Use one age-appropriate idea per unit. Preschool has exactly one concrete practice action.
14. Religious meaning in English/French is out of scope and would require independent `review_sharia` per language.

## Required per-unit file structure

Create `docs/content/planets/09-islamic/<series>/ep-NN-<concise-english-slug>.md` with:

- Warning banner: `draft-v2`, `review_sharia`, not approved, not producible/publishable.
- Metadata table: `unit_id`, `series_id`, `unit_number`, `unit_type`, `title_ar`, `description_ar`, `source_duration_target`, normalized even `duration_seconds`, ages, track, production level, `source_reference`, Quran/hadith fields only where supplied by the source, reviewer/license fields blank, and `status = review_sharia`.
- `source_duration_target` preserves the original. If target seconds are odd, normalize production duration by +1 second so a 4/6/8/10-second beat plan is mathematically possible; never change by more than one second.
- One observable educational objective. For `audio_card`, use practice/listening completion only and no quiz or mastery score.
- Source boundary and open fact/review questions.
- Full Arabic script covering the declared duration, divided into editorial scenes.
- A machine-readable `production_beats_seconds` JSON array containing only 4, 6, 8, 10 and summing exactly to `duration_seconds`.
- Spoken-word budget at roughly 1.5 words/second or less, leaving explicit response/observation silence. Never pad with filler.
- Recitation and narration represented as separate tracks. Recitation blocks identify the licensed-source placeholder and have music locked off.
- Comprehension: none for `audio_card`; one question for `illustrated_unit`; two questions for `story_unit`/`knowledge_unit`. Questions test understanding, never faith or memorization.
- Parent guide, one safe family activity, visual restrictions, audio restrictions, required future assets, and blocking review checklist.
- Any recurring Luna visual mention references the approved `luna-v2` identity rather than redescribing or changing it.

## Task 1: Establish failing inventory validation

**Files:**
- Create: `tools/content/validate-islamic-full-scripts.mjs`
- Test/inputs: `docs/content/planets/09-islamic/*/review-drafts.md`

Implement a read-only Node validator that:

1. Derives expected unit IDs/counts from the 12 source briefs; expected total must be 66.
2. Finds new `ep-*.md` files under the same 12 series directories.
3. Fails unless every expected `unit_id` appears exactly once and no extra unit exists.
4. Checks every required section and metadata field described above.
5. Checks `draft-v2`, `review_sharia`, empty reviewer/license fields, and absence of `approved`, `published`, `production_ready`, `ruling`, `madhhab`, and `fatwa_ref` as metadata states/fields.
6. Parses `production_beats_seconds`, allows only 4/6/8/10, and checks its sum against `duration_seconds`.
7. Checks each source reference from the brief appears verbatim in the corresponding full script.
8. Checks every file contains the visual and audio restrictions, language-review warning, and no-brand/no-text clause.
9. Checks audio cards contain no scored comprehension section.
10. Prints per-series and total coverage, then exits nonzero on any violation.

Run before content generation and record the expected failure due to 0/66 full scripts.

## Tasks 2–13: Expand each series

Process these series sequentially, one file per unit:

1. `noor-qalbi` — 4
2. `preschool-adhkar-manners-prayer` — 12
3. `quran-treasures` — 6
4. `prophets-stories-kids` — 4
5. `prayer-step-by-step` — 4
6. `prophetic-guidance-kids` — 4
7. `daily-adhkar-kids` — 8
8. `quran-understanding-junior` — 6
9. `seerah-journey-junior` — 5
10. `worship-with-knowledge` — 5
11. `identity-ethics-junior` — 4
12. `seasons-of-goodness` — 4

For each series:

1. Read the entire source `review-drafts.md` before writing.
2. Preserve each unit ID, title, duration target, source, objective direction, existing narration facts, and prohibitions.
3. Expand with age-appropriate transitions, observation prompts, safe present-day examples, and explicit pauses; do not add religious facts.
4. Apply the required per-unit structure.
5. Run the validator after the series; the only acceptable failures are units in later unprocessed series. Fix all failures for the completed series before proceeding.

## Task 14: Reconcile indexes without overstating completion

**Files:**
- Modify: `docs/content/planets/09-islamic/README.md`
- Modify: `docs/content/planets/09-islamic/series-shells.md`
- Modify: `docs/content/CONTENT-COMPLETION-LEDGER-2026-09-03.md`

Update wording to distinguish:

- 66/66 complete editorial `draft-v2` scripts.
- 0/66 sharia-approved.
- 0 units authorized for production/publication.
- D1 registration state remains unchanged.
- Media state remains unchanged.

Do not replace historical source counts or claim human review.

## Task 15: Final validation

Run:

```powershell
node tools/content/validate-islamic-full-scripts.mjs
node --test dashboard/api/test/islamicContent.test.mjs
```

Then perform targeted scans and require zero violations:

- exactly 66 new `ep-*.md` files across the 12 series;
- 66 unique expected unit IDs;
- 66 `draft-v2` warnings;
- 66 `review_sharia` states;
- zero populated reviewer/license IDs;
- zero approval/publication claims;
- zero forbidden religious schema fields;
- all beat durations legal and sums exact;
- all source references preserved;
- no source `review-drafts.md` modified;
- no media generated; no D1/R2/network mutation.

Write a concise completion report to `docs/content/planets/09-islamic/FULL-SCRIPT-EXPANSION-REPORT-2026-09-03.md` containing per-series counts, validation command outputs, remaining human gates, and a clear statement that editorial completion is not religious approval.
