# Resume Remaining 409 English/French Editions — Implementation Plan

> **For the autonomous task runner:** Execute every task sequentially against the canonical project `F:\Projects\cartoonapp`. Never treat the task-runner scaffold as catalog progress. Do not commit, push, deploy, mutate D1/R2, generate media, publish, or claim human approval.

**Goal:** Resume from the live state (AR 66/66, EN 7/208, FR 0/208) and produce the remaining complete editorial editions until EN 208/208 and FR 208/208.

**Architecture:** Enumerate only the 208 canonical source units in `F:\Projects\cartoonapp\docs\content\planets`: 117 direct `ep-*.md` episodes in planets 01–08, 25 `story-*.md` stories, and 66 direct Islamic `ep-*.md` units in planet 09. Write locale files only under each series' `_localizations/en` or `_localizations/fr`. Work one planet or small Islamic-series group at a time and verify the actual filesystem after every task.

**Editorial status:** Non-Islamic localized drafts remain `review_lang`. Every Islamic locale remains `review_sharia`, with empty reviewer, approval, and license fields and an explicit independent locale-specific sharia-review requirement. Editorial completion is not approval or publish readiness.

---

## Binding rules for every task

1. Read each full Arabic source before authoring. Never invent missing facts, religious sources, IDs, titles, or source references.
2. Each edition is complete: metadata, title/description, full narration/dialogue, scene/page briefs, vocabulary, questions/answers, mastery criteria where applicable, parent guide, family activity, safety notes, alt text, production notes, stable IDs, durations, asset keys, fact-check markers, and visual prohibitions.
3. Set `is_machine_translated: false`. Normal editions use `translated_from: ar`. The 12 Abjad language-specific units (`abni-kalima` and `luna-discovers-words`) use `translated_from: null` plus `adapted_from_concept: <Arabic source path>` and native English/French pedagogy rather than literal translation.
4. Preserve source order, age band, objective, facts, safety, exact durations, production beats, stable IDs, and Luna identity `luna-discovers-words/luna-v2` wherever present.
5. Islamic recitation text is not translated or synthesized. Keep a `language_neutral` licensed-recitation placeholder, separate narration/recitation tracks, no music with recitation, exact source references, anti-depiction restrictions, and `review_sharia` per locale.
6. Do not overwrite a valid existing locale edition. Repair incomplete existing editions when the validator identifies a concrete violation.
7. A task is complete only when a live count confirms its expected files. Never mark completion from plan checkboxes, generated scripts, manifests, or scaffold files.
8. If canonical filesystem access is denied twice, stop that task and report the exact blocker; do not fabricate content or mark it complete.

## Task 1: Restore canonical localization tooling and truthful baseline

- Verify `node tools/content/validate-islamic-full-scripts.mjs` passes 66/66 in `F:\Projects\cartoonapp`.
- Re-enumerate the canonical 208 sources, explicitly excluding `_localizations`, books, games, activities, bibles, READMEs, manifests, and model files.
- Restore or rebuild these files canonically (scaffold copies are inputs, not evidence):
  - `F:\Projects\cartoonapp\docs\content\_localization-source-index.json`
  - `F:\Projects\cartoonapp\docs\content\planets\_localizations-manifest.json`
  - `F:\Projects\cartoonapp\tools\content\validate-series-localizations.mjs`
- Verify the index paths and SHA-256 hashes against current canonical sources.
- Run the localization validator and record the truthful starting coverage; nonzero is expected while editions are missing.

## Tasks 2–9: Complete English planets 01–08

Process one canonical planet per task, reading every source and writing every missing complete English edition:

2. `01-abjad` — native English re-authoring for all 12 language-specific episodes; preserve and validate the 6 existing `abni-kalima` editions.
3. `02-arqam`
4. `03-oloom`
5. `04-qiyam`
6. `05-qisas` — include all 25 stories, including the 10 `audio-only-stories/story-*.md` sources.
7. `06-maharat`
8. `07-tarikh`
9. `08-alam`

After each task, count only `**/_localizations/en/*.md`, run the localization validator, and fix every violation belonging to the processed planet. Do not require global PASS until both locales are complete.

## Tasks 10–13: Complete English Islamic planet 09

Author complete English `review_sharia` editions from the Arabic `draft-v2` sources and immutable `review-drafts.md` boundaries. Process these groups sequentially:

10. `noor-qalbi`, `preschool-adhkar-manners-prayer`, `quran-treasures`
11. `prophets-stories-kids`, `prayer-step-by-step`, `prophetic-guidance-kids`
12. `daily-adhkar-kids`, `quran-understanding-junior`, `seerah-journey-junior`
13. `worship-with-knowledge`, `identity-ethics-junior`, `seasons-of-goodness`

After each group, verify exact expected file coverage and fix group-specific validator errors. Never populate reviewer/license/approval fields.

## Task 14: English gate

- Require exactly 208 canonical English files and no extras.
- Prove no French file is counted as English and no Arabic source hash changed.
- Fix all English-content validator violations, while missing French files may still keep the global validator nonzero.
- Do not proceed to French until English is genuinely 208/208.

## Tasks 15–22: Complete French planets 01–08

Process one canonical planet per task, authoring native, age-appropriate French with French punctuation and no English calques:

15. `01-abjad` — native French phonology/orthography re-authoring for all 12 episodes.
16. `02-arqam`
17. `03-oloom`
18. `04-qiyam`
19. `05-qisas` — include all 25 stories and audio-only stories.
20. `06-maharat`
21. `07-tarikh`
22. `08-alam`

After each task, count only `**/_localizations/fr/*.md`, run the validator, and fix every violation belonging to the processed planet.

## Tasks 23–26: Complete French Islamic planet 09

Author complete French `review_sharia` editions, preserving source boundaries and independent French sharia review:

23. `noor-qalbi`, `preschool-adhkar-manners-prayer`, `quran-treasures`
24. `prophets-stories-kids`, `prayer-step-by-step`, `prophetic-guidance-kids`
25. `daily-adhkar-kids`, `quran-understanding-junior`, `seerah-journey-junior`
26. `worship-with-knowledge`, `identity-ethics-junior`, `seasons-of-goodness`

After each group, verify exact expected file coverage and fix group-specific validator errors. Never populate reviewer/license/approval fields.

## Task 27: Final verification and truthful completion report

Only after live counts show EN 208 and FR 208, run from `F:\Projects\cartoonapp`:

```powershell
node tools/content/validate-islamic-full-scripts.mjs
node tools/content/validate-series-localizations.mjs
node --test dashboard/api/test/islamicContent.test.mjs
node --test dashboard/api/test/gameLocalizations.test.mjs
```

Require all four commands to pass. Then update current content documentation and write `F:\Projects\cartoonapp\docs\content\SERIES-LOCALIZATION-COMPLETION-REPORT-2026-09-04.md` with per-planet/series/locale counts and remaining human gates. State explicitly: AR 208/208 editorial units, EN 208/208 drafts, FR 208/208 drafts, Islamic approvals remain zero unless signed human evidence exists, and no D1/R2/media/publication action occurred.
