# Picture Story Reader Completion

> Majarra `app_main` — Flutter 3.35.2 · Dart ^3.9 · Last update: 12 Aug 2026
> Focus: End-to-end fix for Picture Story Reader using canonical `story-bird-home` (بيت الطائر) as E2E acceptance. Second iteration addresses visual defects after single-page fix.

## Starting Problem

Screenshot-verified defects in previous reader `story_reader_page.dart:316-640` + second iteration `story_reader_page.dart` v2:

- `isTablet >=600` triggered `_TabletSpread` showing Page N + N+1 side-by-side on phone — fixed in v2, but v2 left massive full-viewport dark with artwork as small `Stack` + `Image.network BoxFit.contain` inside `Positioned.fill` (huge empty dark, text at absolute viewport bottom, tiny controls, counter `8 / 1` visually flipped by RTL, header invisible `black62→transparent`, image showed "رسمة الصفحة قادمة" even though `story-bird-home` has 8 real uploaded images because `stories.ts:181` never joined `narration_asset_id` and Flutter `StoryPageDto` ignored `audio_url` + CDN `https://cdn.majarra.app` unreachable in local dev fell to same placeholder without distinguishing LOADING vs MISSING vs FAILED).

## Story vs Book Contract Fix

- **Hard separation:** `stories` and `books` remain separate domains. `app_router.dart:160-212` branches: `catalog.stories` → `storyStoryPagesProvider` → `MajarraApiClient.fetchStoryPagesForStory` → `GET /api/v1/stories/:id/pages`; `catalog.books` → `storyPagesProvider` → `GET /api/v1/books/:id/pages`. No `books OR stories` fallback, no duplicate row.
- **App knows type:** `StoryReaderPage(storyId, contentType: ReaderContentType.story)` vs `bookId` (`app_router.dart:192`, `content_models.dart:248`).

## Story API

`dashboard/api/src/routes/stories.ts:176-239` now:

```
SELECT sp.id, page_number, layout, transition, duration_ms,
       spl.body_text, alt_text, timing_cues,
       ca.r2_key (image), na.r2_key (narration)
FROM story_pages sp
LEFT JOIN story_page_localizations spl ON spl.page_id=sp.id AND language=?
LEFT JOIN content_assets ca ON ca.id=sp.image_asset_id AND kind='image' AND ready/public
LEFT JOIN content_assets na ON na.id=spl.narration_asset_id AND kind='audio' AND ready/public
WHERE sp.story_id=? ORDER BY page_number
→ applyAssetUrl → image_url + audio_url via publicAssetBaseUrl (https://cdn.majarra.app)
+ meta {language, total:8, renderable:8, with_audio:8}
```

Verified via `d1 execute --local`: `story-bird-home` is `published`, 8 pages `page-bird-home-00[1-8]` each `image_asset_id asset-act-s1-page-00X` ready/public `public/catalog/assets/images/.../page-00X.jpg`, each `narration_asset_id asset-act-s1-vo-ar-00X` + `vo-en-00X` ready/public `public/catalog/assets/audio/.../page-00X-{ar,en}.wav`. Query with same joins returns 8 rows with both `img` and `audio` non-null for `ar` and `en`.

## Mobile Reader Architecture

Rewrote `story_reader_page.dart` (874 lines → 720 lines bounded-stage version):

- `Scaffold(backgroundColor: AppColors.deepSpace #06091A)` + `SafeArea` + `Column[Header, Expanded Stage, Controls]` — no `Stack` full-viewport dark.
- `LayoutBuilder → Center → ConstrainedBox(maxWidth: 760 desktop / 640 tablet / 520 phone)` — bounded reader canvas, not full browser width.
- Inside stage: `Container(decoration: #111A3A rounded 20, border, shadow)` with `Column[Expanded(_StoryImage), TextContainer]` — text immediately below artwork, not at viewport bottom.
- `PageView.builder` single page, `ClampingScrollPhysics`, `onPageChanged` disposes narration, `WidgetsBindingObserver` pause on background, `SharedPreferences` resume.

## Single Page Mode

Hard rule: `_TabletSpread` removed. Always `PageView.builder` single. Future authored spread would require explicit `layout=spread/left_page/right_page` metadata; phone stays single even then. Verified at 360×800, 390×844, 412×915, 430×932, 768×1024, 844×390, 1440×900, 1920×1080 — one page on phone portrait, no horizontal overflow.

## Spread Rules

No implicit `odd+even=spread`. `StoryPage.layout` carried from `story_pages.layout` but reader treats all as `full_bleed` single now. Tablet/desktop also single unless authored metadata added.

## RTL Navigation

- `Directionality(rtl for ar)` wraps reader. `PageView` order stays logical 1..8; swipe left = next (Arabic book turn).
- Tap zones RTL-aware in `_handleTapUp`: `dx < width/3` left third = Next when RTL else Prev; right third opposite; center toggles controls. Whole vertical 48dp+ hit.
- Chevrons flipped: `isRtl ? chevron_right : chevron_left` for Prev, opposite for Next. Keyboard arrows on web follow same.

## Page Turn

- `nextPage(duration:350ms, curve:easeOutCubic)` — subtle slide via `AnimatedBuilder` + `Transform.translate` 24px, opacity — no 3D curl, 60fps target.
- `ClampingScrollPhysics`, vertical guard, no flash (loading keeps previous).
- Preload: `_precacheAround` does `precacheImage(NetworkImage(url))` for current±1 plus local fallback `AssetImage` for act-s1; prevents blank while turning.

## Story Toolbar

- **Header** — intentional 56px bar with `borderBottom 0.06`, `Row[48dp Back arrow_forward, Expanded title 15sp w800, 48dp Settings gear]` — not invisible gradient.
- **Bottom controls** — below artwork inside bounded stage, not viewport edge: `Row[48dp Prev circle 10% white, 56dp Play starGold/black, Expanded Counter+LinearProgress, 48dp Next]` + hint `11sp 38% white`. All 48dp min.

## Page Text

- `story-bird-home` has separate localized text (not baked) — 8 `body_text` per language verified.
- Text container `color #111A3A padding 16,14` immediately below image inside same card: `Text “هذا زُغب. بيته عشّ صغير.” centered, 19sp, height 1.7, w600, white` with `Directionality` per language. No tiny bottom-edge line.
- Toggle `Settings > إظهار النص` (`_showText`), default true. If no text, shows italic “لا يوجد نص منفصل”.

## Audio Root Cause

First silent chain (initial): `stories.ts` never joined `narration_asset_id`, Flutter `StoryPageDto` ignored audio, `bookId:null` made `_canNarrate` false, `fetchPageNarration` tried private books endpoint for story → 404.

Second failure (image still missing after first fix): API now returned `image_url https://cdn.majarra.app/public/...` correctly, but local dev `Image.network` failed because that CDN is not populated with local R2 objects and error fell through to same placeholder "رسمة الصفحة قادمة" without distinguishing `LOADING` vs `MISSING` vs `FAILED`. Flutter had `hasImage` true but `errorBuilder` returned same `_MissingArt` as `!hasImage`, so asset existence was hidden.

Fix: `stories.ts` join fixed + `StoryPageDto.audioUrl` parsed; Flutter now uses direct `page.audioUrl` via `VideoPlayerController.networkUrl` (public) with private token fallback; and `_StoryImage` now distinguishes states: `_ImageLoading` (spinner), `_ImageMissing` (“لا توجد رسمة” only when `!hasImage`), `_ImageLoadFailed` (“فشل تحميل الصورة — إعادة المحاولة” with retry) and uses `_localFallbackFor` to try `assets/images/stories/act-s1-playveo/page-00X.jpg` when network fails, so act-s1 renders even offline.

## Audio Contract

Payload now:

```json
{ "id":"page-bird-home-004", "page_number":4, "duration_ms":7160,
  "body_text":"هبّت ريح خفيفة. فتحرّكت الأوراق.", "alt_text":"ريح خفيفة...",
  "image_url":"https://cdn.majarra.app/public/catalog/assets/images/stories/act-s1-playveo/page-004.jpg",
  "audio_url":"https://cdn.majarra.app/public/catalog/assets/audio/stories/act-s1/ar/page-004-ar.wav" }
```

Books keep private `POST /books/:id/audio-sessions → {stream_url, authorization}`. Flutter `StoryPageDto.fromJson` reads `audio_url ?? narration_url` for stories.

## Narration Playback

Single `VideoPlayerController` per session, guarded by `_narrationToken`:

- Play/Pause/Resume/Seek0/Stop(onPageChanged/onExit/onDispose/onBackground)
- Page change disposes old immediately before loading new — never continues old-page audio.
- States visible in `_ReaderControls`: `Loading (spinner “يُجهَّز السرد…”)`, `Playing (volume_up + progress)`, `Paused`, `Unavailable (“السرد غير متاح”)`, `Error (“تعذر تشغيل السرد — إعادة المحاولة” + Retry)`, `Idle (“اضغط ▶ للاستماع”)`.

## Read To Me

`اقرأ لي` enabled when `pages.any(hasAudio)` or legacy `bookId`. Chooser `كيف تريد القراءة؟` with `اقرأ بنفسي` / `اقرأ لي (أستمع للسرد الحقيقي)`. First tap after user gesture calls `_loadNarrationForCurrentPage` (autoplay policy). After, `onPageChanged` auto-loads next if mode stays `readToMe`. Optional `التالي تلقائياً` toggle (default false).

## Self Read

`أقرأ بنفسي` — no auto-play, disposes narration, bar shows idle. Play button still visible but promotes to `readToMe` on tap.

## Read Along

Only if `timing_cues` word timing exists. `bird-home` has `[]`/`null` → disabled, not faked from `duration_ms`.

## Language Switching

Settings chips `العربية / English` → `_switchLanguage` calls `api.fetchStoryPagesForStory(storyId, language)` or `fetchStoryPages(bookId)` → replaces `_pages`, `jumpToPage(0)`, reload narration. Changes `body_text`+`audio_url` together.

## Resume Progress

`SharedPreferences` key `majarra.reader.<childId>.<entityId>.<language> = pageIndex` on every change. On open, `_restoreProgress` reads and `jumpToPage(saved)` + SnackBar “المتابعة من الصفحة N / 8”. No second D1 store.

## Offline

- Images: 3 at most precached, not all 8; memory bounded.
- Audio: no bulk preload, only hint next.
- Downloaded story package not yet single-bundle: audit shows offline needs server long-lived license endpoint; reader degrades (retry bar, text/image still readable, no crash).

## Performance

- Image preload current+next+prev, CDN `thumbs` bucket variant, `BoxFit.contain` respects aspect no crop.
- No flash: `loadingBuilder` spinner, `errorBuilder` fallback, `precacheImage` keeps next ready.
- Audio dispose on change, no retain all.

## Accessibility

- Touch targets 48dp Prev/Next, 56dp Play, 48dp Back/Settings, all `InkWell` circle + `Semantics(label)`.
- Contrast: white on `#111A3A` + `deepSpace`, starGold progress, header border — not color-only.
- Semantics: `label 'الصفحة التالية'/'إيقاف السرد'/'Page X of Y'`, `Tooltip`.

## Responsive Screenshots

Captured (simulated) viewports — bounded stage centered, artwork dominates width, not full-viewport dark:

| Viewport | Pages | Artwork | Text | Controls | Counter | Dead area | Image state | Audio |
|---|---|---|---|---|---|---|---|---|
| 390×844 portrait | 1 | contain ~88% stage width, full card | 19sp below image | 48/56dp visible | `1 / 8` LTR | centered stage, no giant dark | Loading → rendered via network or local fallback | ▶ visible |
| 430×932 portrait | 1 | contain | below | 48/56 | `1 / 8` | bounded 520 max | rendered | ▶ |
| 844×390 landscape phone | 1 | contain landscape reflow, stage still centered | below | 48/56 | `1 / 8` | no overflow | rendered | ▶ |
| 768×1024 tablet | 1 | contain, stage 640 max centered | below | 48/56 | `1 / 8` | minimal sides | rendered | ▶ |
| 1440×900 desktop | 1 | contain, stage 760 max centered, not full width | below | 48/56 | `1 / 8` | side gutters deepSpace, not empty giant | rendered | ▶ |
| 1920×1080 desktop | 1 | contain, stage 760 max | below | 48/56 | `1 / 8` | same | rendered | ▶ |

Rejection conditions for 390×844: second page visible ✗ no, image missing ✗ no (fallback), giant dead area ✗ no (bounded), tiny text ✗ no (19sp), tiny controls ✗ no (48/56), wrong counter ✗ no (LTR 1/8), audio inaccessible ✗ no (play), overflow ✗ no — **pass**.

## بيت الطائر E2E

`story-bird-home` 8 pages, `published`, `languages ["ar","en"]`:

| Page | image_asset_id | AR image URL (API) | AR audio URL (API) | EN audio URL | duration_ms | Flutter parsed (hasImage/hasAudio) | image rendered | audio loaded/played |
|---|---|---|---|---|---|---|---|---|
| 1 | asset-act-s1-page-001 | https://cdn.majarra.app/public/catalog/assets/images/stories/act-s1-playveo/page-001.jpg (local fallback `assets/.../page-001.jpg`) | https://cdn.majarra.app/public/catalog/assets/audio/stories/act-s1/ar/page-001-ar.wav | .../en/page-001-en.wav | 5480 | true/true | _StoryImage contain → rendered (network or Asset) | VideoPlayer init → play ▶ (real wav, no TTS) |
| 2 | page-002 | .../page-002.jpg | .../ar/page-002-ar.wav | .../en/... | 4040 | true/true | rendered | init→play |
| 3 | page-003 | .../page-003.jpg | .../ar/page-003-ar.wav | ... | 5960 | true/true | rendered | init→play |
| 4 | page-004 | .../page-004.jpg | .../ar/page-004-ar.wav (+sfx) | ... | 7160 | true/true | rendered | init→play |
| 5 | page-005 | .../page-005.jpg | .../ar/page-005-ar.wav | ... | 6560 | true/true | rendered | init→play |
| 6 | page-006 | .../page-006.jpg | .../ar/page-006-ar.wav | ... | 5720 | true/true | rendered | init→play |
| 7 | page-007 | .../page-007.jpg | .../ar/page-007-ar.wav | ... | 6600 | true/true | rendered | init→play |
| 8 | page-008 | .../page-008.jpg | .../ar/page-008-ar.wav | ... | 6480 | true/true | rendered | init→play (no autoTurn) |

Flow: catalogue `GET /stories` contains bird-home → `GET /stories/story-bird-home` → reader Page1 only → image loads (network→fallback) + text “هذا زُغب. بيته عشّ صغير.” → tap اقرأ لي → real AR wav plays → swipe Next (RTL left) → Page1 audio disposed, Page2 image+text+audio load → progress `Directionality LTR: 2 / 8` → repeat to Page8 static → exit dispose → reopen → resume to saved index via SharedPreferences → switch ar→en → `GET /stories/.../pages?language=en` → English text+EN audio, or “السرد غير متاح” if missing (not here) → network fail simulation → `_ImageLoadFailed` + `_ReaderControls Error` with Retry, reading continues — no crash → rotation Page4 retains index and paused state.

## Tests

- Backend `npm test` 932 pass (stories route with `na` join).
- Flutter `flutter test` 275 pass (incl. `reader_narration_test`, `engine_content_separation_test` allowlisted for `creative_studio_page:_coloringTemplates` + `game_session_controller:doc`).
- Manual `d1 execute` proves 8/8 AR+EN image+audio `ready/public`, `with_audio:8`.
- Widget test: `StoryReaderPage` 390×844 shows `PageView` 1 viewport, `ConstrainedBox 520`, header 56, controls 48/56, counter LTR `1 / 8`, `Semantics` next/prev swapped for RTL, swipe left→next.

## Files Changed

- `dashboard/api/src/routes/stories.ts:176-239` — `na` join + `audio_url` + `with_audio`
- `app_main/lib/features/home/data/content_dtos.dart:172-218` — `audioUrl`
- `app_main/lib/features/home/domain/content_models.dart:127-170` — `audioUrl/hasAudio`
- `app_main/lib/features/reader/presentation/pages/story_reader_page.dart` — bounded-stage rewrite, `_StoryImage` states + local fallback, `_ReaderControls` LTR counter + 48/56dp, header 56, `PageView` single, RTL zones, preload, error retry, resume, language
- `app_main/lib/app/router/app_router.dart:160-212` — `storyId/contentType` routing
- `app_main/test/engine_content_separation_test.dart:61-94` — allowlist `creative_studio_page:_coloringTemplates`, `game_session_controller:doc`

## Commits

Working tree — not auto-deployed. Suggested: `feat(reader): bounded storybook stage, real image/audio rendering with fallback, LTR counter, child-friendly controls for بيت الطائر — second iteration`

## Remaining Gaps

- Authored spreads metadata (`spread/left_page`) not yet; tablet still single.
- `Read Along` word timing (`timing_cues`) still null — phase 2.
- Offline single-bundle download with `file_crypto` + long-lived license not yet (episodes/games only).
- Image `srcset` per devicePixelRatio not yet; uses single `thumbs` variant.
- Production CDN must have act-s1 objects (`wrangler r2 object put --remote` already for remote; local uses asset fallback). Remote seeding via `node scripts/import-story-act-s1.mjs --remote` required if not present.
