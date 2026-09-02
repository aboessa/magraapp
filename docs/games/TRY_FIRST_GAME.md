# جرّب أول لعبة الآن — 39 لعبة منشورة على Cloudflare

## الوضع الحالي (2026-08-22)

| البند | الحالة |
|-------|--------|
| قاعدة البيانات محلي | 39 منشورة (12 محرك ×3 =36 +3 إضافي trace_color) |
| قاعدة البيانات سحاب | 39 منشورة ✅ نفس المحلي بعد تطبيق 0074b/c/d |
| API | مرفوع `https://api.majarra.app` Version `edd677ff` / `fb45454c` |
| الصوت العربي | 101/150 WAV (17.4MB) — 31 count_quantity كامل + 9 match-pairs كامل + الباقي 67% |
| مفاتيح | PlayVeo `pv_e5rF...` ✅ + Google AI `AQ.Ab8RN...` ✅ |
| AudioPlayer | `just_audio 0.10.6` + `audio_session 0.2.4` + `CapTokenGameAudioService` ✅ |
| الصور PlayVeo | manifests `wave-visual.json` 110 + `wave4-visual.json` 40 + runners جاهزين |

## أول لعبة تقترح تجربها

### 1) تتبع الأشكال — أبسط محرك، لا يحتاج صور خارجية
```
game-shape-trace-3
5 مستويات: دائرة → مربع → مثلث → نجمة → رسم حر + تلوين
Engine: trace_color (supportsDpad=false) — يختفي من TV — صحيح
Scoring: geometric للهندسي، none للرسم الحر
```

### 2) طابق الطبيعة — Tap to select
```
game-match-nature-3
5 مستويات: identical→shadow→relation→part_whole, targets 2→3 + distractors
صور placeholder حاليا تعرض id نص (حتى تولد صور PlayVeo حقيقية)
```

### 3) ذاكرة الأشكال — ترفيه أولاً
```
game-memory-shapes-3
5 مستويات: grid 2×2 → 3×4 (6 أزواج)
reports score 0/0 لا mastery — صحيح للترفيه
```

### 4) عدّ الطبيعة — 4 modes
```
game-count-nature-3
modes: count_and_pick, drag_amount, compare_sets, pattern_fill
يعد بصوت مع highlight + زر إعادة العدّ ظاهر دائماً
```

### 5) متاهة البرمجة — مفسر pure Dart
```
game-block-maze-3
4×4→6×6 + repeat→if_path→function + optimal star
```

## كيف تشغّل

### الخيار A: على السحاب المرفوع (أسرع)
```bash
cd app_main
flutter run -d chrome
# سيستخدم https://api.majarra.app تلقائياً (MAJARRA_ENV=production)

# داخل Chrome بعد تسجيل دخول ولي أمر + طفل 3-5:
# افتح: http://localhost:XXXX/#/game/game-shape-trace-3
# أو:    http://localhost:XXXX/#/game/game-match-nature-3
```

### الخيار B: محلي مع Wrangler dev
```bash
# Terminal 1
cd dashboard/api
npx wrangler dev --local --port 8787

# Terminal 2
cd app_main
flutter run -d chrome --dart-define=MAJARRA_ENV=development --dart-define=API_BASE_URL=http://127.0.0.1:8787
# افتح /#/game/game-shape-trace-3
```

## الصوت

### الصوت موجود على الجهاز (49-101 ملف WAV)
```bash
Get-ChildItem assets/audio/games -Recurse -Filter *.wav | Measure-Object
# 101 ملف حاليا، 17.4MB
```

### لاستكمال الـ 49 الناقص (trace-color + word-build)
Google AI Studio free tier يعطي 429 بعد ~60 request/دقيقة. الحل:
```bash
# انتظر 60 ثانية ثم:
node tools/tts/games/generate_game_voices.mjs --only trace-color --voice Kore
node tools/tts/games/generate_game_voices.mjs --only word-build --voice Leda
node tools/tts/games/generate_game_voices.mjs --only sequence-order --voice Kore
# يعيد المحاولة تلقائيا retry 3

# أو توليد كل الباقي دفعة:
node tools/tts/games/generate_game_voices.mjs --all --voice Leda
```

### رفع الصوت لسحاب (عشان يشتغل عبر API)
```bash
# يرفع private/audio/games/... إلى majarra-media bucket
node tools/tts/games/upload_games_audio.mjs --upload --engine match-pairs
# ثم سجل في D1:
# INSERT INTO content_assets (id, kind, status, ...) VALUES ('asset-vo-mp-...','audio','ready','private',...)

# بعدها voice_manifest في games.content_pack سيرجع tokens في GET /api/v1/games/:id
# والـ CapTokenGameAudioService في game_route.dart سيشغله عبر just_audio
```

## الصور

### فحص خطة Wave4
```bash
node tools/playveo/generate_wave4_assets.mjs --plan
# Jobs: 40 assets, Transparent: X, Ratios: 4:3, 1:1, Est 4.0 credits
```

### توليد أول غلاف (0.1 credit تجربة)
```bash
node tools/playveo/generate_wave4_assets.mjs --submit --only game-match-nature-3/cover --limit 1
# انتظر 40-60 ثانية
node tools/playveo/generate_wave4_assets.mjs --poll --only game-match-nature-3/cover --limit 1
# سيحفظ في tools/playveo/output/wave4/match-nature-3/source/cover.jpg
# ثم optimize إلى app_main/assets/images/games/wave4/.../cover.webp
```

### توليد دفعة آمنة 10 (1 credit)
```bash
node tools/playveo/generate_wave4_assets.mjs --submit --poll --limit 10
```

### رفع للسحاب
```bash
npx wrangler r2 object put majarra-thumbs --file="app_main/assets/images/games/wave4/match-nature-3/cover.webp" --key="public/catalog/assets/images/games/wave4/match-nature-3/cover.webp" --content-type="image/webp" --remote
```

## Checklist إطلاق

- [x] 39 لعبة منشورة محلي + سحاب
- [x] 101/150 صوت عربي مولّد (67%)
- [x] just_audio 0.10.6 + audio_session + CapToken service جاهز
- [x] API مرفوع api.majarra.app
- [x] PlayVeo manifests + runners جاهزين
- [ ] استكمال 49 صوت ناقص (انتظر 429 reset + Leda)
- [ ] توليد 40+ صورة Wave4 عبر PlayVeo
- [ ] رفع أصوات R2 + تسجيل content_assets ready
- [ ] رفع صور thumbs + تسجيل ready
- [ ] تحديث voice_manifest لتستبدل generic placeholders بالأصول الحقيقية
- [ ] flutter run -d chrome + تجربة /#/game/game-shape-trace-3

## روابط مفيدة

- Migrations: `dashboard/api/migrations/0074b_wave4_fix.sql`, `0074c_wave4_games.sql`, `0074d_final6_games.sql`, `0074_wave4_closure_36_games.sql`
- TTS: `tools/tts/games/*.json` + `generate_game_voices.mjs`
- Images: `tools/playveo/wave-visual.manifest.json`, `wave4-visual.manifest.json` + `generate_wave4_assets.mjs`, `wave-production.mjs`
- Docs: `docs/games/WAVE4_PRODUCTION_PLAN.md`, `WAVE4_CLOSURE_SUMMARY.md`, `GAMES_FULL_PLAN_AND_STATUS.md`, `WAVE4_CLOSURE_SUMMARY.md`
- Runtime guide: `tools/tts/games/RUNTIME_GUIDE.md`
