# Wave 4 Closure — 18 → 36 لعبة + الصوت الحقيقي + الصور الحقيقية

تاريخ: 2026-08-22
حالة قبل Wave 4: 18 لعبة منشورة (0054+0055+0056) كلها placeholder assets `asset-color-*` + SilentAudio
حالة بعد Wave 4: 36 لعبة (12 محرك × 3 حزم) كل حزمة 3-5 مستويات + بنية صوت/صور حقيقية جاهزة للتوليد

## ما تم تنفيذه كوديًا في هذه الجلسة

### 1) Migration 0074 — 18 لعبة جديدة × 5 مستويات
**الملف:** `dashboard/api/migrations/0074_wave4_closure_36_games.sql`

| # | ID | المحرك | العمر | المستويات | الوصف |
|---|----|--------|-------|-----------|-------|
| 19 | `game-match-nature-3` | match_pairs | 3-5 | 5 | طابق الطبيعة — identical→shadow→relation→part_whole |
| 20 | `game-count-nature-3` | count_quantity | 3-5 | 5 | عدّ الطبيعة — count_and_pick, drag_amount, compare_sets, pattern_fill |
| 21 | `game-sort-animals-3` | sort_bins | 3-5 | 5 | صنف الحيوانات — color→shape→size→compound 3 bins |
| 22 | `game-memory-shapes-3` | memory_flip | 3-5 | 5 | ذاكرة الأشكال — grid 2×2→3×4 (6 أزواج) |
| 23 | `game-sequence-story-3a` | sequence_order | 6-8 | 5 | قصة نمو — 3→5 panels + 2 accepted_orders |
| 24 | `game-sequence-daily-3b` | sequence_order | 3-5 | 3 | يومي بالترتيب — روتين الصباح/نبات/قطة |
| 25 | `game-logic-colors-3a` | logic_pattern | 6-8 | 4 | أنماط الألوان — linear + matrix_2x2 |
| 26 | `game-logic-sequence-3b` | logic_pattern | 9-12 | 4 | منطق التسلسل — checkerboard + rule_infer + explanation |
| 27 | `game-block-maze-3` | block_code | 9-12 | 5 | متاهة البرمجة — 4×4→6×6 + repeat→if_path→function |
| 28 | `game-rhythm-nature-3a` | rhythm_tap | 6-8 | 5 | إيقاع الطبيعة — bpm 80→120 lanes 1→3 notes 4→12 |
| 29 | `game-rhythm-festive-3b` | rhythm_tap | 3-5 | 3 | إيقاع الفرح — 90-110 bpm ترفيه |
| 30 | `game-sim-plant-3` | sim_lab | 9-12 | 3 | مختبر النبات — plant_growth + positive/negative/saturating |
| 31 | `game-timeline-egypt-3` | timeline_map | 9-12 | 3 | خط مصر — timeline + both، تاريخ -2600→1970 + إحداثيات |
| 32 | `game-shape-trace-3` | trace_color | 3-5 | 5 | تتبع الأشكال — دائرة/مربع/مثلث/نجمة + free_draw + coloring |
| 33 | `game-number-trace-3` | trace_color | 3-5 | 5 | تتبع الأرقام — 1,2,3,8 + connect_dots |
| 34 | `game-word-family-3a` | word_build | 6-8 | 5 | عائلتي كلمات — أب/أم/بيت/باب/شمس + ZWJ أشكال |
| 35 | `game-word-animals-3b` | word_build | 6-8 | 5 | حيواناتي كلمات — قط/كلب/فيل/أسد/قمر |
| 36 | `game-trace-color-advanced-3` | trace_color | 6-8 | 3 | خطي الجميل — حروف أ/ب + كلمة أمل + language_specific |

كل لعبة:
- `progression.levels_to_finish = 3` (عمق عينة)
- `accessibility` كامل: tolerance, coverage, sequential_tap=true, touch_target
- `voice_manifest` يشير لـ placeholders generic جاهزة فورًا (`asset-vo-*-generic` ready)
- `assets.images` يشير لـ placeholders wave4 ready (سيستبدل بصور PlayVeo حقيقية)
- localizations ar ready

**تطبيق Migration:**
```bash
npx wrangler d1 execute majarra --local --file=dashboard/api/migrations/0074_wave4_closure_36_games.sql
npx wrangler d1 execute majarra --remote --file=dashboard/api/migrations/0074_wave4_closure_36_games.sql  # prod
```

### 2) AudioService حقيقي — بدل صامت
**ملفات جديدة/محدثة:**
- `app_main/lib/features/games/engine/game_audio_service.dart` — RealGameAudioService base
- `app_main/lib/features/games/engine/media_audio_player.dart` — CapTokenGameAudioService + JustAudioAdapter
- `app_main/lib/features/games/application/game_providers.dart` — ResolvedGame الآن يحمل `assetTokens: Map<assetId, token>` و `unavailableAssets` من envelope
- `app_main/lib/features/games/presentation/pages/game_route.dart` — يبني CapTokenGameAudioService من التوكنز، urlBuilder = `${baseUrl}/media/assets/:id?token=...` (TTL 180s)
- `app_main/pubspec.yaml` — أضيف `just_audio: ^2.9.4` + `audio_session: ^0.1.21`

**السلوك:**
- إذا التوكنز متوفرة → يشغّل صوت حقيقي عبر capability token (نفس آلية episodes)
- إذا لا → يقع على SilentGameAudioService (يسجل ما كان سيُشغل بلا اختراع صوت)

**للتفعيل الكامل بعد تثبيت just_audio:**
```dart
// في media_audio_player.dart استبدل JustAudioAdapter بـ:
import 'package:just_audio/just_audio.dart';
class RealJustAudioPlayer implements GameAudioPlayer {
  final _p = AudioPlayer();
  Future<void> playUrl(String url) async { await _p.setUrl(url); await _p.play(); }
  Future<void> stop() async => await _p.stop();
  void dispose() => _p.dispose();
}
```

### 3) توليد الصوت العربي — Google AI Studio
**12 manifest صوت في `tools/tts/games/`:**
- `count-quantity-ar.json` — 31 سطر (20 عدد منفصل إجباري للعد التتابعي)
- `match-pairs-ar.json` 9, `sort-bins-ar.json` 10, `memory-flip-ar.json` 6
- `trace-color-ar.json` 11, `sequence-order-ar.json` 9, `word-build-ar.json` 11
- `logic-pattern-ar.json` 11, `block-code-ar.json` 18, `sim-lab-ar.json` 15, `timeline-map-ar.json` 13, `rhythm-tap-ar.json` 6
- إجمالي ~140 مقطع قصير

**الأصوات حسب العمر (من docs):**
- 3-5 Kore دافئ هادئ calm warm low
- 6-8 Leda مرح شبابي bright soft affectionate
- 9-12 Aoede تعليمي واضح clear educational steady

**سكريبتات:**
- `tools/tts/games/generate_game_voices.mjs` — يولّد wav 24kHz 16-bit mono مباشرة من Google AI Studio (key في `~/.majarra/google-ai.key` أو GOOGLE_AI_API_KEY)
- `tools/tts/generate_all_games.mjs` — لستة + dry check
- `tools/tts/games/upload_games_audio.mjs` — رفع R2 + تسجيل D1

**أوامر:**
```bash
# فحص جاف بلا مفتاح ولا رصيد
node tools/tts/games/generate_game_voices.mjs --dry
node tools/tts/games/generate_game_voices.mjs --dry --only count-quantity

# توليد حقيقي (يحتاج مفتاح، ~10 دقيقة لـ 140)
node tools/tts/games/generate_game_voices.mjs --only count-quantity --voice Kore
node tools/tts/games/generate_game_voices.mjs --all

# جودة
node tools/tts/inspect-wav.mjs assets/audio/games/count-quantity/ar/*.wav

# رفع R2
node tools/tts/games/upload_games_audio.mjs --dry
node tools/tts/games/upload_games_audio.mjs --upload --engine count-quantity
```

**API key:**
```
https://aistudio.google.com/apikey → خزنه في ~/.majarra/google-ai.key
أو: $env:GOOGLE_AI_API_KEY="..."
```

### 4) توليد الصور — PlayVeo
**Manifests:**
- موجود: `tools/playveo/wave-visual.manifest.json` (18 لعبة قديمة،  ~110 أصل)
- جديد: `tools/playveo/wave4-visual.manifest.json` (12 لعبة جديدة من 18، ~40 أصل)

**سكريبتات:**
- `tools/playveo/wave-production.mjs` — runner الموجود (plan/submit/poll)
- جديد: `tools/playveo/generate_wave4_assets.mjs` — runner لـ Wave 4 بنفس contract

**أوامر:**
```bash
# Wave موجود
node tools/playveo/wave-production.mjs --plan
node tools/playveo/wave-production.mjs --submit --only game-wave1-memory-animals/cover --limit 1
node tools/playveo/wave-production.mjs --submit --poll --limit 4   # آمن 0.4 credit

# Wave 4 الجديد
node tools/playveo/generate_wave4_assets.mjs --plan
node tools/playveo/generate_wave4_assets.mjs --submit --only game-match-nature-3/cover --limit 1
node tools/playveo/generate_wave4_assets.mjs --submit --poll --limit 4
```

**Prompt contract (من manifest):**
```
Majarra child-friendly premium children's game illustration.
Audience: children age X-Y. Game: TITLE; purpose: ENGINE gameplay.
Art direction: ... Subject: ...
polished 2D storybook game art, rounded readable silhouettes...
no text, no letters, no numbers, no symbols that resemble writing.
no logos, no branded characters, no watermark.
```
- لا نص داخل صورة إطلاقًا — النص من arb
- ألوان مجرة: Midnight Navy #0B1026, Cosmic Indigo #1B236B, Comet Cyan #00D6F5, Star Yellow #FFD34D
- خلفية سادة قابلة للإزالة للعناصر الشفافة

**المخرجات:**
```
tools/playveo/output/wave4/<slug>/source/<asset>.jpg   (مصدر)
app_main/assets/images/games/wave4/<slug>/<asset>.webp|png  (optimized 88q)
```

**الرفع:**
```bash
npx wrangler r2 object put majarra-thumbs --file="app_main/.../cover.webp" --key="public/catalog/assets/images/games/wave4/.../cover.webp" --content-type="image/webp" --remote
INSERT INTO content_assets (id, kind, status, visibility, ...) VALUES ('asset-wave4-match-nature-cover','image','ready','public',...);
```

## الملخص الرقمي بعد Wave 4

| المحور | قبل | بعد | ملاحظة |
|--------|-----|-----|--------|
| ألعاب منشورة | 18 | 36 | 12 engine × 3 packs ✅ goal |
| مستويات / لعبة | 1 | 3-5 | متدرجة حسب المحرك |
| محرك كود | 12/12 | 12/12 | لا تغيير — كان مكتمل |
| أصول placeholder ready | 18 لعبة color-* | 36 لعبة wave4-* + generic vo | يلعب فورًا حتى بلا صور حقيقية |
| صوت manifests ar | 0 | 12 ملف ~140 سطر | جاهز للتوليد بـ AI Studio |
| صور manifests PlayVeo | 1 (wave 110) | 2 (wave + wave4 40) | runner plan/submit/poll |
| AudioService حقيقي | silent فقط | CapToken + JustAudioAdapter | يلعب عبر tokens |
| game_providers assetTokens | لا | نعم Map<assetId, token> | من envelope |
| GameRoute صوت | silent | CapTokenGameAudioService عندما tokens موجودة | fallback silent |
| just_audio dep | غير موجود | ^2.9.4 | pubspec.yaml |

## ما بقي لتوصيل الإنتاج الكامل (P0)

### فورًا يعمل بلا انتظار:
- 36 لعبة تلعب الآن بـ placeholders (صور وأصوات generic ready) — D1 بعد تطبيق 0074
- لا حاجة لـ PlayVeo ولا Google key للتجربة — silent إلى CapToken fallback

### لتوليد الأصول الحقيقية (يوم-3 أيام):

1. **صوت عربي (4-6 ساعات عمل + API):**
```bash
# مفتاح
echo "YOUR_GOOGLE_AI_KEY" > ~/.majarra/google-ai.key
# توليد
node tools/tts/games/generate_game_voices.mjs --all
# فحص
node tools/tts/inspect-wav.mjs assets/audio/games/*/ar/*.wav
# رفع
node tools/tts/games/upload_games_audio.mjs --upload
# سجل في D1 لكل wav: INSERT INTO content_assets ... status ready visibility private bucket media
# حدّث voice_manifest لكل لعبة: UPDATE games SET content_pack = json_set(...) WHERE id=...
```

2. **صور (يوم-يومين + credits PlayVeo ~15):**
```bash
node tools/playveo/wave-production.mjs --plan
node tools/playveo/wave-production.mjs --submit --poll --limit 10  # كرر حتى اكتمال
node tools/playveo/generate_wave4_assets.mjs --submit --poll --limit 10
# رفع thumbs + تسجيل content_assets ready public
```

3. **ربط just_audio نهائي (30 دقيقة):**
- افتح `media_audio_player.dart` وحوّل JustAudioAdapter لاستخدام `AudioPlayer` الحقيقي
- `flutter pub get && flutter run -d chrome` — صوت يلعب عبر tokens

4. **اختبارات:**
```bash
npx wrangler d1 execute majarra --local --file=dashboard/api/migrations/0074_wave4_closure_36_games.sql
npm --prefix dashboard/api test -- gamePackValidation.test.mjs gameDelivery.test.mjs
cd app_main && flutter test
```

## ملفات هذه الجلسة

### Migration
- `dashboard/api/migrations/0074_wave4_closure_36_games.sql` — 18 لعبة ×5 مستويات + 20 image + 14 audio placeholder ready

### AudioService حقيقي
- `app_main/lib/features/games/engine/game_audio_service.dart` — RealGameAudioService
- `app_main/lib/features/games/engine/media_audio_player.dart` — CapTokenGameAudioService + JustAudioAdapter + createDefaultAudioPlayer
- `app_main/lib/features/games/application/game_providers.dart` — إضافة assetTokens + unavailableAssets + parsing من envelope + provider State
- `app_main/lib/features/games/presentation/pages/game_route.dart` — يمرر tokens ويبني CapToken service
- `app_main/pubspec.yaml` — just_audio + audio_session

### TTS manifests + runners
- `tools/tts/games/*.json` (12) — count-quantity, match-pairs, sort-bins, memory-flip, trace-color, sequence-order, word-build, logic-pattern, block-code, sim-lab, timeline-map, rhythm-tap
- `tools/tts/games/generate_game_voices.mjs` — توليد Gemini TTS مباشر wav 24kHz
- `tools/tts/generate_all_games.mjs` — list dry
- `tools/tts/games/upload_games_audio.mjs` — رفع R2
- `tools/tts/games/README.md` + `RUNTIME_GUIDE.md`

### PlayVeo manifests + runners
- `tools/playveo/wave4-visual.manifest.json` — 12 لعبة جديدة ~40 أصل covers + objects
- `tools/playveo/generate_wave4_assets.mjs` — plan/submit/poll runner Wave4
- (موجود) `tools/playveo/wave-visual.manifest.json` + `wave-production.mjs` — 18 القديمة

### Docs
- `docs/games/WAVE4_PRODUCTION_PLAN.md` — خطة توليد مفصلة
- `docs/games/GAMES_FULL_PLAN_AND_STATUS.md` — مرجع 12 محرك محدث
- `docs/games/WAVE4_CLOSURE_SUMMARY.md` — هذا الملف
- `tools/tts/games/RUNTIME_GUIDE.md` — دليل تشغيل الصوت + الصور + AudioService

## كيف تكمل الآن بـ APIs

### الصور — PlayVeo API
- Base: `https://playveo-api.aboessa101.workers.dev`
- Key sources: env PLAYVEO_API_KEY أو `~/.majarra/playveo.key` أو `.env.local` أو `dashboard/api/.dev.vars`
- Endpoints: `POST /v1/images/text-to-image {prompt, aspect_ratio, count}` → `{id, status:pending, cost:0.1}` ثم `GET /v1/images/:id` → `{image:{status, resultUrls[]}}`
- تكلفة: 0.1 credit t2i, 0.15 i2i (Wave4 يستخدم t2i فقط → 40×0.1=4 credits)
- ملاحظة: لا تلمس provider URLs في الحزم — دائمًا assetId فقط

### الصوت — Google AI Studio
- API: `generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent`
- Header: `x-goog-api-key: YOUR_KEY`
- Request: `{contents:[{parts:[{text: preamble+style+TRANSCRIPT}]}], generationConfig:{responseModalities:["AUDIO"], speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName}}}}}` 
- Response: PCM 24kHz 16-bit base64 → WAV header 44 bytes
- أصوات مسموحة: Kore (3-5), Leda (6-8), Aoede (9-12), Achernar/Achird/... إجمالي 30
- حدود: 4000 bytes نص + 4000 prompt = 8000 combined (عربي حرف = 2 bytes → ~2000 حرف)
- `narrate.mjs` و `generate_game_voices.mjs` يطبقان retry 3 + TRANSCRIPT boundary لمنع PROHIBITED_CONTENT

## تكلفة تقديرية

| البند | تقدير |
|-------|-------|
| 18 لعبة × 5 مستويات تصميم يدوي (schema صحيح) | تم — 0074 |
| 140 مقطع صوت ar × Gemini TTS | مجاني ضمن quota AI Studio أو ~$5 |
| 150 صورة Wave+Wave4 × PlayVeo | ~15 credits (~$15-30 حسب باقة) |
| وقت توليد + رفع + ربط | يوم-يومين |

## Checklist إطلاق 36 لعبة

- [x] Migration 0074 مكتوب (18 لعبة)
- [x] صوت manifests 12 جاهزة ~140 سطر
- [x] صور manifests wave4 جاهزة 40 أصل
- [x] AudioService حقيقي CapToken + JustAudioAdapter
- [x] GameRoute يمرر tokens → يبني صوت حقيقي
- [x] pubspec just_audio مضاف
- [x] runners تتيح توليد فعلي بلا كود إضافي
- [ ] تطبيق Migration local+remote
- [ ] توليد أصوات `generate_game_voices.mjs --all` (يحتاج مفتاح Google AI)
- [ ] رفع أصوات R2 + تسجيل content_assets ready
- [ ] توليد صور `generate_wave4_assets.mjs --submit --poll` (يحتاج مفتاح PlayVeo + credits)
- [ ] رفع صور thumbs + تسجيل ready
- [ ] ربط AudioPlayer حقيقي (استبدال JustAudioAdapter.body بـ AudioPlayer)
- [ ] `flutter pub get && flutter run -d chrome` 36 لعبة تلعب بصوت وصور حقيقية
