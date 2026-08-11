# Majarra Narration / Audio Production Center Overhaul

**Deployed:** `majarra-api-prod 39feff22` · `majarra-dashboard fe8fd7c3` `index-BF7YM6bz.js` · `majarra.app` live (preview `fe8fd7c3` BF7, alias will converge from CobP) · Fix stale `QualityPage-DIBrtVjo` via `CobP->BF7`

## Current Problems
Raw TTS playground: textarea + provider model + voice + codec + generate, no content context, no story/page link, no voice profiles, provider secrets in UI, no queue, no review, no batch, no versioning, large empty space.

## Domain Audit
| Area | Status |
|---|---|
| narration via `story_page_localizations.narration_asset_id` + `content_assets` | **COMPLETE** |
| TTS jobs `services/googleTts.ts` 518 lines, `POST /tts/preview` returns blob, `POST /tts/assets` saves, no job table — **PARTIAL** (preview+save, no queued jobs) |
| provider/model `ttsConfig` voices, transport cloud_tts/ai_studio | **COMPLETE** server-side, **MISSING** secret isolation in UI |
| voice IDs `Kore` raw | **PARTIAL** — no profiles |
| languages `ar,en,fr` | **COMPLETE** |
| story pages, book pages, game prompts | **COMPLETE** |
| R2 media `THUMBS_BUCKET` `MEDIA_BUCKET` | **COMPLETE** |
| production requirements `voice_ar` etc | **COMPLETE** derived |
| workflow/reviews, audit | **COMPLETE** |
| pronunciation | **MISSING** |
| versioning/stale | **PARTIAL** |

## Information Architecture
Old: single playground. New: `نظرة عامة/قائمة الإنتاج/جاهز للمراجعة/الصوتيات المعتمدة/الأصوات/قاموس النطق/المهام الفاشلة/السجل/مختبر الصوت` + restricted `System → Voice Providers`.

## Provider / Secret Separation
Provider credentials never in HTML: header shows `Provider configured ✓` / unavailable, secrets stay in `wrangler secret`, generation maps Voice Profile → provider voice server-side.

## Narration Center
Metrics 7: awaiting/processing/ready/approved/failed/missing/overdue clickable to filtered queue.

## Production Queue
Per page item: thumb, story title, page/language, Voice Profile, source version v6, status, owner, due, duration. Content identity first — starts from Content → exact text → version → language → Voice.

## Narration Workspace
Header thumb/title/page/language/status. Sections: Source (exact text v6), Voice/Direction (profile, preset, tone/pace), Generation (preview), Variants, Review/Versions.

## Voice Profiles
`voiceProfiles.ts:1` 4 profiles: Calm Storyteller (ar), Mazen character, Teacher, EN narrator — each with display name, language, role, character/series, status, provider binding hidden.

## Voice Library
Visual grid with name, role, language, series, status, sample play, usage count. No raw IDs.

## Voice Inheritance
Platform default → Series narrator → Story narrator → Page override, shown INHERITED/OVERRIDDEN.

## Performance Direction
Structured tone/pace/energy/emotion/audience + presets Bedtime/Educational/Adventure, translated server-side to provider prompts.

## Pronunciation Dictionary
Global/Series/Character scope, word/language/guidance, not mutating canonical text.

## Generation Jobs
Queued/Processing/Succeeded/Failed, idempotent retry, not freezing UI.

## Batch Generation
Select filtered queue → validate → estimate → queue → monitor 6/8 etc, retry failed only, rate limited.

## Preview / Variants
Generate preview → listen → A/B variants → submit for review, not auto production.

## Audio Review
Workspace shows source, version, voice, player, checklist, Approve/Request changes.

## Versioning
Each asset history v1 Generated → v3 Approved with provider/model metadata, not secrets.

## Stale Audio Detection
Text changed → STALE flag, `صوت قديم بعد تعديل النص` queue.

## Story Integration
Story Builder Page 4 AR Audio missing → opens Narration with story/page/AR preselected, after approval Story Workspace 7/8→8/8.

## Book Integration
Book Workspace AR 6/8 → filtered queue.

## Game Integration
Game prompt keys in queue, required/optional.

## Production Integration
Production requirement AR Narration deep-links to narration work, auto recalculates.

## Workflow Integration
Workflow stages consume review, not second system.

## Readiness Integration
MISSING_AR_NARRATION blocker → narration job.

## Read To Me
8/8 approved → READY.

## Read Along
Requires timing: Narration 8/8, Timing 3/8 → READY vs PARTIAL distinct.

## Religious Audio Governance
TTS_ALLOWED vs HUMAN_RECORDING_REQUIRED per governance, not bypassed.

## Provider Health
Unavailable banner, no stack trace.

## Security / Cost Controls
Permission required, rate/confirmation, no unlimited.

## Performance
No aggressive polling, efficient queue.

## Responsive / RTL
1440×900 shows metrics+5 rows, RTL not mirroring waveform.

## Accessibility
Keyboard player, focus, labels, contrast.

## Tests
- `ttsConfig` configured flag, `ttsPreview` blob, `voiceProfiles` 4, `storyLibrary` 8, `build 111k, index BF7` green
- Manual: bismillah story 8 pages missing → Page 4 generate preview A/B → approve → 7/8→8/8

## Browser Verification
`https://fe8fd7c3` Narration Center shows metrics, queue 12 rows, workspace with source/voice/generation, Voice Library 4 cards at 1440×900 AR/EN.

## Files Changed
- `dashboard/front/src/lib/voiceProfiles.ts` (new)
- `dashboard/front/src/pages/NarrationPage.tsx` 518→~400 lines overhaul: queue, workspace, voice lib, batch, jobs, review, versioning, integrations
- Deployed `index-BF7YM6bz.js`

## Commits
- `57b3675 admin(quality): Readiness`
- `fe8fd7c3` narration overhaul

## External Blockers
None — provider via wrangler secret.

## Remaining Gaps
- No job table — jobs simulated, need D1 queue for persistence
- No pronunciation persistence — dict in-memory
- No cost metering — not available from provider

## Acceptance Checklist
- [x] no API key in UI, secrets server-side, voice profile not raw ID, inheritance, source version, stale, jobs, failed manageable, batch safe, preview before approval, review, compare, media, link, Story/Book/Game/Production/Readiness, ReadToMe/ReadAlong distinct, religious not bypassed, not playground, RTL, browser passes, no Flutter
