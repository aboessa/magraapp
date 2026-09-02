# دليل تشغيل الصوت العربي للألعاب 36 + الصور عبر PlayVeo

## 1) الصوت العربي — Google AI Studio (Gemini TTS)

### المفتاح
```
https://aistudio.google.com/apikey
→ خزن المفتاح:
  mkdir -p ~/.majarra
  echo "YOUR_KEY" > ~/.majarra/google-ai.key
أو: $env:GOOGLE_AI_API_KEY = "key"
```

### Manifests جاهزة
كل محرك له ملف في `tools/tts/games/`:
```
count-quantity-ar.json   31 سطر (20 عدد منفصل)
match-pairs-ar.json       9 أسطر
sort-bins-ar.json        10
memory-flip-ar.json       6
trace-color-ar.json      11
sequence-order-ar.json    9
word-build-ar.json       11
logic-pattern-ar.json    11
block-code-ar.json       18 (كتل + نجوم)
sim-lab-ar.json          15 (مراحل علمية)
timeline-map-ar.json     13 (تلميحات زمنية)
rhythm-tap-ar.json        6
إجمالي ~140 مقطع قصير
```

### التوليد
```bash
# فحص جاف — لا مفتاح ولا رصيد
node tools/tts/games/generate_game_voices.mjs --dry

# محرك واحد
node tools/tts/games/generate_game_voices.mjs --only count-quantity --voice Kore

# الكل (يحتاج مفتاح، يستهلك وقت ~10 دقيقة لـ 140 مقطع)
node tools/tts/games/generate_game_voices.mjs --all

# جودة Wav
node tools/tts/inspect-wav.mjs assets/audio/games/count-quantity/ar/*.wav

# بديل بالناقل الحالي tools/tts/narrate.mjs
node tools/tts/narrate.mjs --dry --manifest tools/tts/games/count-quantity-ar.json
node tools/tts/narrate.mjs --all --manifest tools/tts/games/count-quantity-ar.json
```

### المخرجات
```
assets/audio/games/
  count-quantity/ar/vo-count-1-ar.wav … vo-count-20
  match-pairs/ar/vo-intro-ar.wav …
  ...
```
كل wav: 24kHz 16-bit mono header RIFF — نفس مقاسات act-s1.

### الرفع لـ R2
```bash
# عبر wrangler --remote (يحتاج login)
npx wrangler r2 object put majarra-media --file="assets/audio/games/count-quantity/ar/vo-count-1-ar.wav" --key="private/audio/games/count-quantity/ar/vo-count-1-ar.wav" --content-type="audio/wav" --remote

# دفعة عبر script
node tools/tts/games/upload_games_audio.mjs --dry
node tools/tts/games/upload_games_audio.mjs --upload --engine count-quantity
```

### التسجيل في D1
```sql
INSERT OR IGNORE INTO content_assets (id, kind, status, visibility, source, expected_path, title_ar, r2_key, bucket, mime_type, created_at)
VALUES ('asset-vo-cq-count-1','audio','ready','private','generated','private/audio/games/count-quantity/ar/vo-count-1-ar.wav','واحد','private/audio/games/count-quantity/ar/vo-count-1-ar.wav','media','audio/wav','2026-08-22T00:00:00Z');

-- ثم اربطه في voice_manifest للعبة:
-- UPDATE games SET content_pack = json_set(content_pack, '$.voice_manifest."vo.count.1"', 'asset-vo-cq-count-1') WHERE id='game-wave1-count-place';
```

## 2) الصور — PlayVeo

### المفتاح
```
~/.majarra/playveo.key  أو  PLAYVEO_API_KEY env  أو  .env.local
base_url = https://playveo-api.aboessa101.workers.dev
```

### Wave الموجود (18 لعبة قديمة)
```bash
node tools/playveo/wave-production.mjs --plan
node tools/playveo/wave-production.mjs --submit --poll --only game-wave1-memory-animals/cover --limit 1
node tools/playveo/wave-production.mjs --submit --poll --limit 6  # دفعة آمنة 0.6 credit
```

### Wave 4 الجديد (18 لعبة × covers + objects)
```bash
node tools/playveo/generate_wave4_assets.mjs --plan
node tools/playveo/generate_wave4_assets.mjs --submit --only game-match-nature-3/cover --limit 1
node tools/playveo/generate_wave4_assets.mjs --submit --poll --limit 4
```

### المخرجات
```
tools/playveo/output/wave4/<slug>/source/<asset>.jpg   (مصدر)
app_main/assets/images/games/wave4/<slug>/<asset>.webp|png  (optimized)
```

### الرفع
```bash
npx wrangler r2 object put majarra-thumbs --file="app_main/assets/images/games/wave4/match-nature-3/cover.webp" --key="public/catalog/assets/images/games/wave4/match-nature-3/cover.webp" --content-type="image/webp" --remote
INSERT INTO content_assets (id, kind, status, ...) VALUES ('asset-wave4-match-nature-cover','image','ready','public',...);
```

## 3) ربط الصوت الحقيقي في التطبيق

### Flutter
`app_main/lib/features/games/presentation/pages/game_route.dart` يبني الآن:
```dart
final tokens = widget.game.assetTokens; // assetId -> capability token from GET /api/v1/games/:id
CapTokenGameAudioService(
  player: JustAudioAdapter(), // يحتاج just_audio: ^2.9.4
  assetTokens: tokens,
  urlBuilder: (assetId, token) =>
    '${AppConfig.baseUrl}/api/v1/media/assets/$assetId?token=${Uri.encodeComponent(token)}',
)
```

إذا `assetTokens.isEmpty` → يقع على `SilentGameAudioService` حتى تتوفر أصول حقيقية.
أضف لـ pubspec.yaml:
```yaml
just_audio: ^2.9.4
audio_session: ^0.1.21
```

ثم في `media_audio_player.dart` صِل `AudioPlayer`:
```dart
import 'package:just_audio/just_audio.dart';
class RealJustAudioPlayer implements GameAudioPlayer {
  final _p = AudioPlayer();
  Future<void> playUrl(String url) async { await _p.setUrl(url); await _p.play(); }
  Future<void> stop() async => await _p.stop();
  void dispose() => _p.dispose();
}
```

### API
`GET /api/v1/games/:id?child_id=...` يرجع الآن:
```json
{
  "data": {
    "assets": {
      "tokens": {"asset-vo-intro-generic": "eyJ... (180s TTL)", ...},
      "unavailable": []
    }
  }
}
```
كل `assetId` في `content_pack.assets` أو `voice_manifest` له token إن كان ready في R2.

## 4) Wave 4 Migration — 18 لعبة × 5 مستويات

الملف `dashboard/api/migrations/0074_wave4_closure_36_games.sql` ينفذ:
- 18 لعبة جديدة (IDs `game-match-nature-3` ... `game-trace-color-advanced-3`)
- كل لعبة 3-5 مستويات متدرجة حسب المحرك
- 20 placeholder image asset + 14 audio generic placeholder (ready)
- localizations ar لكل واحدة
- يحقق 12 engine × 3 = 36 (كان 18، صار 36)

تطبيق:
```bash
npx wrangler d1 execute majarra --local --file=dashboard/api/migrations/0074_wave4_closure_36_games.sql
npx wrangler d1 execute majarra --remote --file=dashboard/api/migrations/0074_wave4_closure_36_games.sql  # prod
```

بعد تطبيق الـ migration + توليد voices + صور:
```bash
npm --prefix dashboard/api test -- gamePackValidation.test.mjs gameDelivery.test.mjs gameLocalizations.test.mjs
flutter test -d chrome --filter game  # في app_main
```

## 5) Checklist نشر 36 لعبة

- [ ] Migration 0074 مطبق local + remote
- [ ] 140+ صوت ar مولّد عبر generate_game_voices.mjs --all
- [ ] الصوتيات مرفوعة R2 private/audio/games/... ومسجلة في content_assets ready
- [ ] voice_manifest لكل من 36 لعبة يشير لأصول ready (بدل generic placeholders)
- [ ] ~80 صورة PlayVeo مولدة wave + wave4 covers + transparent objects
- [ ] الصور مرفوعة R2 thumbs bucket + content_assets ready
- [ ] just_audio مربوط في media_audio_player.dart (AudioPlayer().setUrl+play)
- [ ] GET /api/v1/games/:id يرجع tokens لكل asset
- [ ] GameRoute يبني CapTokenGameAudioService بالتوكنز
- [ ] اداء: preload فقط intro/instruction/count-1، باقي عند الحاجة
