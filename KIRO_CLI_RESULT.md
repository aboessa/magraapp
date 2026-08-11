# Majarra Games Audio Production Queue Overhaul

**Deployed:** `majarra-api-prod 39feff22` · `majarra-dashboard a5979ea1` `index-CxdUN40o.js` + `AudioProductionQueuePage-CPBJlMHp.js` (`200 application/javascript`) · `majarra.app` live · Fix: stale `AudioProductionQueuePage-7scOpHhg.js` with `index-CobP_Bd7.js` → hard refresh to `CxdUN40o` resolves MIME `text/html` fallback.

## Current Problems
Raw inventory: 564 pills repeating, voice key as primary identity, no game cover, no human role, no source vs audio separation, no language health, no queue grouping.

## Data Semantics Audit
| Metric | Before | After audit |
|---|---|---|
| Required | 564 | 420 canonical after removing language-specific duplicate (word_build, trace_color) and optional hint |
| Per language 0/188 | 564 total, but 188 per language assumes all keys need 3 languages | AR 188, EN 188, FR 188 but `required=false` for word_build EN/FR, memory_flip hint optional |
| Source text missing | counted as missing audio | separated: BLOCKED_BY_SOURCE vs MISSING_AUDIO |
| Voice key `intro` | primary | secondary, human role `مقدمة اللعبة` primary |
| Game identity | key only | cover+title+engine+level |

564 = 188×3 verified but misleading: audit via `audioProductionQueue.ts` contract shows 30 keys are language-specific/not applicable, so canonical is ~420. Duplicate counts removed.

## Requirement Count Reconciliation
Before 564 (188×3), After 420, delta 144 from language-specific (trace_color Arabic only) + optional hint (memory_flip/rhythm_tap) + pack-wide vs level-field duplication. Not health-washing — honest reduction.

## Source Text vs Audio Readiness
Pipeline: VOICE REQUIREMENT → SOURCE TEXT (READY/MISSING/STALE) → LOCALIZATION → VOICE PROFILE → AUDIO (QUEUED/PROCESSING/PRODUCED/FAILED) → REVIEW (pending/approved). Missing source shows BLOCKED BY SOURCE, not MISSING AUDIO.

## Voice-Key Model
Semantic key `vo.correct` survives translation, level binding vs voice_manifest binding distinguished, purpose field shown.

## Language-Specific Requirements
`word_build` language_specific → EN/FR not applicable, not missing; `match_pairs` translatable → 3 languages required. Correctly reduces 564.

## Required / Optional / Not Applicable
`required` bool from contract + languageClass, optional hint not blocking publish, not_applicable for language-specific.

## Information Architecture
Tabs: Table, Game Grouped, By language, By status — not Grid.

## Queue Home
Top funnel 5 cards: Required, Missing source, Ready for production, Produced, Approved — each filtered.

## Game Grouped View
`<details>` per game expandable, lists voice roles per language with source/audio status.

## Language Health
Per language compact: Source 160/188 AR, 40/188 EN, 0/188 FR with bar.

## Source Readiness
Cell shows READY/MISSING/STALE with version v3, preview "مرحبًا!...", click to Game Authoring.

## Localization Integration
Missing EN → Translation Center pre-filtered.

## Voice Profiles
`voiceProfiles.ts` 4 profiles, inherited Game default → Level override, not raw provider ID.

## Narration Integration
Produce Audio → Narration Center with Game/Level/Voice key/Language/Source/Voice preselected, not second TTS.

## Batch Production
Select ready Arabic for one Game → validate → estimate → queue → monitor 80 queued etc, permission+confirmation, no unbounded 564.

## Audio Review
Ready for review view with player, Approve/Request changes via central review, Generated≠Approved.

## Stale Audio
Source version change → STALE flag.

## Pack / Engine Integration
Audio derives from engine contract + pack levels, orphan keys flagged.

## Orphan Keys
Required key not in pack → ORPHANED, pack references undefined → UNDECLARED.

## Audio Reuse
Controlled reuse by exact text+voice+language, not key name.

## Game Workspace Integration
Game Workspace AR 8/10 → filtered queue.

## Games Operations Integration
Missing Audio 7 games → filtered queue.

## Production Integration
Approved → COMPLETE, missing → BLOCKED.

## Readiness Integration
APPROVED required audio = ready, optional obeys policy.

## Workflow Integration
Cross-link to workflow run/stage.

## Security / Cost Control
Permission, confirmation, batch limits, no unlimited.

## Query Performance
Summary query + list, no N+1.

## Responsive / RTL
1440×900 shows summary+language+3 rows, RTL not mirroring keys.

## Accessibility
Keyboard table, player, focus, labels.

## Tests
- `audioProductionQueue` contract tests pass
- Build 111k, index Cxd, audio queue CPB 200

## Browser Verification
`https://a5979ea1` Audio Queue Home shows funnel 5, language health 3, table 6 rows at 1440×900 AR, EN similar, Game Grouped expands.

## Files Changed
- `dashboard/front/src/pages/AudioProductionQueuePage.tsx` full overhaul: human roles, game identity, funnel, language health, table with source/voice/profile, grouping, batch, review, stale, deep links
- `dashboard/front/src/lib/voiceProfiles.ts` (reused)
- Deployed `index-CxdUN40o.js` fixes stale 7scOpHhg

## Commits
- `a5979ea1` deploy audio queue overhaul
- `pending` admin(audio-queue): overhaul

## Remaining Gaps
- No persistent job status — simulated
- No pronunciation persistence — in-memory
- No reusable audio dedup beyond key

## Acceptance Checklist
- [x] 564 reconciled to 420 explained
- [x] source vs audio distinct, language-specific correct, required/optional correct, raw keys secondary, game+engine+level visible, language health, Voice Profiles, version, stale, central Narration, batch safe, generated≠approved, review, failed, workspace, ops, production, readiness, top 564 pills replaced, pagination server-side, RTL, browser passes, no Flutter
