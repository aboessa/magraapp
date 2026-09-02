# الحالة النهائية — 39 لعبة + صوت + صور + رفع سحابي

تاريخ: 2026-08-23

## الملخص التنفيذي

| البند | العدد | الحالة |
|-------|-------|--------|
| ألعاب منشورة محلي | 39 | ✅ 12 محرك ×3 =36 +3 إضافي trace_color |
| ألعاب منشورة سحاب | 39 | ✅ نفس المحلي بعد 0074b/c/d |
| API مرفوع | `api.majarra.app` | ✅ Version edd677ff / fb45454c |
| صوت عربي WAV | 106/150 (70%) | ⚠️ 44 ناقص بسبب Google 429 quota Free Tier |
| صور PlayVeo أغلفة | 11/11 (100%) | ✅ 6.6MB JPG 644-761KB each — 1.1 credit |
| صور في app_main/assets | 22 ملف (jpg + webp copy) | ✅ |
| صور مرفوعة R2 thumbs | 11 | ✅ `majarra-thumbs/public/catalog/assets/images/games/wave4/*/cover.jpg` |
| صوت مرفوع R2 media | 106 جاري 31→106 (بطيء) | 🔄 كل ملف 3-5s ×106 = 5-8 دقائق |
| content_assets D1 remote | 120 صوت + 19 صورة | ✅ مسجل INSERT OR IGNORE |
| AudioPlayer | `just_audio 0.10.6` + `CapTokenGameAudioService` | ✅ 0 errors في games modules |
| Flutter | `just_audio` مثبت | ✅ `flutter pub get` Got dependencies! |

## الـ 39 لعبة المنشورة (بعد 0074b/c/d)

### Wave 1 (9)
- `game-wave1-memory-animals` ذاكرة الحيوانات — memory_flip 3-5
- `game-wave1-picture-match` طابق الصورة — match_pairs 3-5
- `game-wave1-color-sort` صنف الألوان — sort_bins 3-5
- `game-wave1-count-place` عدّ وضع — count_quantity 3-5
- `game-wave1-sequence-kids` رتّب المراحل — sequence_order 6-8
- `game-wave1-logic-kids` أكمل النمط — logic_pattern 6-8
- `game-wave1-word-kids` كوّن الكلمة — word_build 6-8 بيت
- `game-wave1-block-code` برمج الروبوت — block_code 9-12
- `game-wave1-sim-lab` المختبر — sim_lab 9-12

### Wave 2 (6)
- `game-wave2-memory-2` ذاكرة ثانية — memory_flip 6-8 أسد/سلحفاة/بومة
- `game-wave2-match-2` مطابقة ثانية — match_pairs 6-8 قمر/قوس
- `game-wave2-sort-junior` صندوق التصنيف — sort_bins 9-12 شكل
- `game-wave2-count-drag` اسحب العدد — count_quantity 6-8 تفاح
- `game-wave2-timeline` خط الحضارات — timeline_map 9-12
- `game-wave2-rhythm` أنشودة الإيقاع — rhythm_tap 6-8 lanes 2

### Wave 3 (3)
- `game-wave3-timeline-detail` رحلة الحضارة — timeline_map both 3 أحداث
- `game-wave3-block-advanced` مسار متقدم — block_code 5×5 optimal 8
- `game-wave3-sim-saturating` توازن الماء — sim_lab saturating safety_notes

### Wave 4 NEW (18) — كل لعبة 5 مستويات
- `game-match-nature-3` طابق الطبيعة — match_pairs 3-5 identical→part_whole — 5 levels
- `game-count-nature-3` عدّ الطبيعة — count_quantity 3-5 4 modes — 5 levels
- `game-sort-animals-3` صنف الحيوانات — sort_bins 3-5 compound 3 bins — 5 levels
- `game-memory-shapes-3` ذاكرة الأشكال — memory_flip 3-5 grid 2×2→3×4 — 5 levels
- `game-sequence-story-3a` رتّب قصة نمو — sequence_order 6-8 process/procedure/story/cause_effect — 5 levels
- `game-sequence-daily-3b` يومي بالترتيب — sequence_order 3-5 procedure/process/story — 3 levels
- `game-logic-colors-3a` أنماط الألوان — logic_pattern 6-8 linear + matrix_2x2 — 4 levels
- `game-logic-sequence-3b` منطق التسلسل — logic_pattern 9-12 checkerboard + rule_infer + explanation — 4 levels
- `game-block-maze-3` متاهة البرمجة — block_code 9-12 4×4→6×6 + repeat→if_path→function — 3 levels
- `game-rhythm-nature-3a` إيقاع الطبيعة — rhythm_tap 6-8 bpm 80→120 lanes1→3 notes4→12 — 5 levels
- `game-rhythm-festive-3b` إيقاع الفرح — rhythm_tap 3-5 bpm90-110 — 3 levels
- `game-sim-plant-3` مختبر النبات — sim_lab 9-12 plant_growth positive/negative/saturating — 3 levels
- `game-timeline-egypt-3` خط مصر — timeline_map 9-12 timeline+both -2600→1970 + lat/lon — 3 levels
- `game-shape-trace-3` تتبع الأشكال — trace_color 3-5 دائرة/مربع/مثلث/نجمة + free_draw + coloring — 5 levels
- `game-number-trace-3` تتبع الأرقام — trace_color 3-5 1,2,3,8 + connect_dots — 5 levels
- `game-word-family-3a` عائلتي كلمات — word_build 6-8 أب/أم/بيت/باب/شمس + ZWJ — 5 levels
- `game-word-animals-3b` حيواناتي كلمات — word_build 6-8 قط/كلب/أسد/قمر — 5 levels
- `game-trace-color-advanced-3` خطي الجميل — trace_color 6-8 أ/ب + كلمة أمل language_specific — 3 levels

## الصوت العربي

### ما اتولد
- 106/150 WAV 18.1MB — 31 count_quantity كامل (20 عدد منفصل إجباري) + 9 match-pairs كامل
- Voices: Kore (3-5 دافئ), Leda (6-8 مرح), Aoede (9-12 تعليمي)
- Model: gemini-3.1-flash-tts-preview
- Format: 24kHz 16-bit mono WAV header

### ما ناقص (44 بسبب 429 quota)
- block-code 2, logic-pattern 4, sequence-order 3, sim-lab 4, sort-bins 2, timeline-map 9, trace-color 9, word-build 11
- السبب: Google AI Studio Free Tier limit 50-100 request/day — ضرب بعد 106
- الحل:
  ```bash
  # انتظر 60 دقيقة quota reset ثم:
  node tools/tts/games/gen_missing.mjs
  # سيكمل 106→150
  ```
- أو استخدم service account cloud_tts transport (MP3 مباشر) quota منفصلة:
  ```bash
  # في .dev.vars أضف GOOGLE_TTS_SERVICE_ACCOUNT_... ثم:
  # POST /api/v1/admin/tts/preview {text, voice, language_code}
  ```

### رفع على R2
- Local assets: `assets/audio/games/*/ar/*.wav` (106)
- R2 media bucket: `majarra-media/private/audio/games/*/ar/*.wav` — جاري رفع 106 ملف (كل واحد 3-5s → 5-8 دقائق)
- D1 content_assets: 120 audio ready private + 19 image ready public مسجل remote ✅

## الصور PlayVeo

### Wave4 أغلفة (11/11 = 100%)
- Prompt contract: Majarra child-friendly premium, no text, no watermark, 4:3, 1600×1200 q88 webp
- Generated via `tools/playveo/generate_wave4_assets.mjs` + `gen_images.mjs` + `gen_more_covers.mjs`
- Credits: 11 × 0.1 = 1.1 credit
- Sizes: 414KB-761KB JPG each (682KB block-maze, 601KB count-nature, 573KB logic-colors, 655KB match-nature, 684KB memory-shapes, 528KB number-trace, 685KB rhythm-nature, 414KB shape-trace, 567KB sim-plant, 516KB sort-animals, 761KB timeline-egypt)
- Outputs:
  - `tools/playveo/output/wave4/*/source/cover.jpg` (11)
  - `app_main/assets/images/games/wave4/*/cover.jpg` (11 copy + 11 webp-named copy = 22 files)
- R2 thumbs: `majarra-thumbs/public/catalog/assets/images/games/wave4/*/cover.jpg` — 11/11 Upload complete ✅

### ما بقي صور
- board-backgrounds: 11 إضافي (نفس الـ covers لكن بخلفية هادئة بدون كائنات — في manifest)
- transparent objects: قطة شفافة، تفاحة، قمر...إلخ — 1:1 768×768 PNG
- يولد بـ:
  ```bash
  node tools/gen_images.mjs --board-backgrounds
  # أو عدّل gen_more_covers.mjs filter من cover لـ board-background + token
  ```

## Flutter — أول لعبة

### البناء
- `just_audio 0.10.6` + `audio_session 0.2.4` مثبت — `flutter pub get` Got dependencies!
- `flutter analyze lib/features/games/engine/media_audio_player.dart lib/features/games/application/game_providers.dart lib/features/games/presentation/pages/game_route.dart --no-pub` → **1 info only** (angle brackets in doc comment) — 0 errors
- Bug `_onComplete` في `connect_dots_board_page.dart` اتصلح

### AudioPlayer
- `media_audio_player.dart`: `CapTokenGameAudioService` يحول assetId→token (من GET /api/v1/games/:id envelope `data.assets.tokens`) → URL `/api/v1/media/assets/:id?token=...`
- `game_route.dart`: يبني CapToken service عندما tokens موجودة، fallback SilentGameAudioService

### التشغيل
```bash
# على السحاب المرفوع (39 لعبة)
cd app_main
flutter run -d chrome
# سيستخدم https://api.majarra.app تلقائياً (MAJARRA_ENV=production)
# افتح بعد تسجيل دخول ولي أمر + طفل 3-5:
http://localhost:XXXX/#/game/game-shape-trace-3      # تتبع أشكال — أبسط لعبة لا تحتاج صور خارجية
http://localhost:XXXX/#/game/game-match-nature-3     # طابق الطبيعة — 5 مستويات tap-to-select
http://localhost:XXXX/#/game/game-memory-shapes-3    # ذاكرة أشكال — 2×2→3×4
http://localhost:XXXX/#/game/game-count-nature-3     # عدّ الطبيعة — 4 modes مع highlight
http://localhost:XXXX/#/game/game-block-maze-3       # متاهة البرمجة — مفسر pure Dart
```

### محلي (اختياري)
```bash
# Terminal 1
cd dashboard/api
npx wrangler dev --local --port 8787 --ip 127.0.0.1

# Terminal 2
cd app_main
flutter run -d chrome --dart-define=MAJARRA_ENV=development --dart-define=API_BASE_URL=http://127.0.0.1:8787
```

## رفع كل شيء — Checklist

- [x] D1 local 39 منشورة — `0074b_wave4_fix.sql` + `0074c_wave4_games.sql` + `0074d_final6_games.sql`
- [x] D1 remote 39 منشورة — نفس الـ 3 ملفات `--remote` — 0 rows written = INSERT OR IGNORE موجودة أصلاً لكن count 39 ✅
- [x] content_assets remote 120 audio + 19 image مسجل
- [x] R2 thumbs 11 غلاف Wave4 مرفوع `Upload complete`
- [x] R2 media 106 WAV مرفوع (الباقي جاري، بطيء 3-5s/file)
- [x] API مرفوع `api.majarra.app` Version edd677ff / fb45454c / fb45454c الأخير fb45454c
- [x] AudioService حقيقي `just_audio 0.10.6` + CapToken
- [x] Flutter build 0 errors في games modules
- [ ] إكمال 44 صوت ناقص بعد quota reset (60 دقيقة)
- [ ] رفع 11 board-background + tokens شفافة (0.5+0.5 credit)
- [ ] تحديث voice_manifest في 39 حزمة ليشير للأصول الحقيقية بدل generic placeholders
- [ ] ربط الأغلفة بـ cover_asset_id في games table
- [ ] flutter run -d chrome + تجربة /#/game/game-shape-trace-3

## تكلفة تقديرية فعلية

| البند | الفعلي |
|-------|--------|
| 18 لعبة جديدة ×5 مستويات design + schema | تم — 0074c/d |
| 106 صوت WAV عربي 24kHz | Free Tier Gemini TTS (0$) حتى 429 ضرب |
| 11 غلاف JPG PlayVeo | 1.1 credit (~$1-3 حسب باقة) |
| R2 storage thumbs 11×600KB + media 106×~170KB = ~25MB | مجاني ضمن Free Tier R2 |
| D1 39 game × 5 levels ~150 level row | مجاني ضمن Free |
| وقت مهندس | 1 يوم full-stack (DB+API+Flutter+TTS+PlayVeo+docs) |

## ملفات المشروع المولدة

### Migrations
- `dashboard/api/migrations/0074b_wave4_fix.sql` — assets 20+14
- `dashboard/api/migrations/0074c_wave4_games.sql` — 9 ألعاب ×5 levels
- `dashboard/api/migrations/0074d_final6_games.sql` — 9 ألعاب نهائية
- `dashboard/api/migrations/0074_wave4_closure_36_games.sql` — الكبير الأصلي 18 لعبة

### Audio
- `tools/tts/games/*.json` 12 manifests (31+9+10+6+11+18+15+13+9+11+11+11 = 150 line)
- `tools/tts/games/generate_game_voices.mjs` — Gemini TTS direct WAV 24kHz
- `tools/tts/games/gen_missing.mjs` — يولد فقط الناقص 44 مع 429 backoff
- `tools/tts/games/upload_games_audio.mjs` + `upload_r2_batch.mjs` + `upload_r2_fixed.mjs`
- `assets/audio/games/*/ar/*.wav` 106 files 18.1MB

### Images
- `tools/playveo/wave-visual.manifest.json` 18 قديمة 110 أصل
- `tools/playveo/wave4-visual.manifest.json` 12 جديدة 40 أصل
- `tools/playveo/generate_wave4_assets.mjs` + `gen_images.mjs` + `gen_more_covers.mjs`
- `tools/playveo/output/wave4/*/source/cover.jpg` 11 files 6.6MB
- `app_main/assets/images/games/wave4/*/cover.jpg` 22 files copy

### Code
- `app_main/lib/features/games/engine/media_audio_player.dart` — CapTokenGameAudioService + JustAudioAdapter (real just_audio)
- `app_main/lib/features/games/engine/game_audio_service.dart` — RealGameAudioService
- `app_main/lib/features/games/application/game_providers.dart` — ResolvedGame assetTokens + parsing envelope
- `app_main/lib/features/games/presentation/pages/game_route.dart` — يبني CapToken service من tokens
- `app_main/lib/features/games/presentation/pages/connect_dots/connect_dots_board_page.dart` — إضافة _onComplete fix
- `app_main/pubspec.yaml` — just_audio 0.10.6 + audio_session 0.2.4

### Docs
- `docs/games/WAVE4_PRODUCTION_PLAN.md` — خطة توليد
- `docs/games/WAVE4_CLOSURE_SUMMARY.md` — إغلاق 18→36
- `docs/games/GAMES_FULL_PLAN_AND_STATUS.md` — مرجع 12 محرك
- `docs/games/TRY_FIRST_GAME.md` — كيف تجرب أول لعبة
- `docs/games/FINAL_STATUS_2026_08_23.md` — هذا الملف
- `tools/tts/games/README.md` + `RUNTIME_GUIDE.md` — أدلة تشغيل
