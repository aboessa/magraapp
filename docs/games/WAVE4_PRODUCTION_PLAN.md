# Wave 4 Production — 18 game → 36 game closure using PlayVeo + Google AI Studio

## الوضع الحالي
- 18 لعبة منشورة (0054+0055+0056) بكلها assets placeholder `asset-color-*`
- 12 محرك كود مكتمل 100%
- لا أصول حقيقية، لا صوت مسجل، مستوى واحد / لعبة

## الهدف
- 36 لعبة (12 × 3 حزم) كل حزمة 5 مستويات
- أصول حقيقية عبر PlayVeo image API
- صوت عربي عبر Google AI Studio (Gemini TTS)
- موسيقى مرخصة لـ rhythm_tap

## الأدوات الموجودة
| الأداة | الموقع | المفتاح |
|--------|--------|---------|
| تصوير/رسم | `tools/playveo/generate.mjs` + `wave-production.mjs` | `PLAYVEO_API_KEY` في `~/.majarra/playveo.key` أو `.env.local` |
| صوت حاء | `tools/tts/narrate.mjs` | `GOOGLE_AI_API_KEY` في `~/.majarra/google-ai.key` |
| فهرسة أصول | `dashboard/api/playveo` scripts + `content_factory` |
| تثبيت الحزم | D1 migrations 0054→0056 + admin API |

## خطة النواقص المرتبة

### P0 — الأصول المرئية 18 لعبة
- wave-visual.manifest.json موجود — يلزم تشغيله:
```
node tools/playveo/wave-production.mjs --plan
node tools/playveo/wave-production.mjs --submit --poll --limit 4
```
- ينتج webp covers + transparent PNG objects في `app_main/assets/images/games/wave/`
- بعد المراجعة: `node tools/playveo/wave-production.mjs --...` + رفع R2 + تسجيل في `content_assets`

### P1 — الصوت العربي 12 محرك
- queue generator: `dashboard/api/src/lib/audioProductionQueue.ts` → يولد لكل لعبة قائمة `vo.*` maturation required
- manifests عربية: صيغة `tools/tts/act-s1.narration.json` — نفسه لكل لعبة:
```json
{
  "language":"ar",
  "model":"gemini-3.1-flash-tts-preview",
  "voice":"Kore",
  "lines": [{"id":"asset-vo-...","file":"...wav","text":"..."}]
}
```
- توليد: `node tools/tts/narrate.mjs --all --manifest tools/tts/games/*.json`
- رفع: `dashboard/api` عبر `POST /admin/tts/assets` → `private/audio/...` + status ready

### P2 — 18 لعبة إضافية بـ 5 مستويات
- schemas موجودة في `docs/games/schemas/*.v1.schema.json`
- migration جديد `0057_wave4_...` مع محتوى 5 مستويات / لعبة
- يجب الالتزام بكل قواعد `gamePackValidation.ts`: levels متصلة 1..5، assets ready، voice مفاتيح إجبارية، no text في الصور، etc.

### P3 — إكمال من 18 → 36

المحركات الناقصة للتوزيع 3×:
| محرك | موجود | محتاج إضافي | اسم مقترح جديد |
|------|-------|--------------|----------------|
| match_pairs | 2 | +1 | game-match-nature-3 |
| trace_color | 1 (letter) | +2 | game-shape-trace-3, game-number-trace-3 |
| sort_bins | 2 | +1 | game-sort-animals-3 |
| memory_flip | 2 | +1 | game-memory-shapes-3 |
| count_quantity | 2 | +1 | game-count-nature-3 |
| sequence_order | 1 | +2 | game-sequence-story-3a, 3b |
| word_build | 1 | +2 | game-word-family-3a, 3b |
| rhythm_tap | 1 | +2 | game-rhythm-nature-3a, 3b |
| logic_pattern | 1 | +2 | game-logic-colors-3a, 3b |
| block_code | 2 | +1 | game-block-maze-3 |
| sim_lab | 2 | +1 | game-sim-plant-3 |
| timeline_map | 2 | +1 | game-timeline-egypt-3 |
| **مجموع** | **18** | **18** | **=36** |

## توليد الصوت عبر Google AI Studio

### تعليمات الاستخدام
```bash
# 1. احصل على مفتاح
https://aistudio.google.com/apikey

# 2. خزّن المفتاح
mkdir -p ~/.majarra
echo "YOUR_KEY" > ~/.majarra/google-ai.key

# 3. اولّد الصوت للألعاب
node tools/tts/narrate.mjs --dry --manifest tools/tts/games/match-pairs-ar.json
node tools/tts/narrate.mjs --all --manifest tools/tts/games/match-pairs-ar.json

# 4. قيّم الجودة
node tools/tts/inspect-wav.mjs assets/audio/games/match-pairs/ar/*.wav
```

### الأصوات المقترحة للاعمار
| Track | الصوت | الموديل | الأسلوب |
|-------|--------|---------|---------|
| preschool 3-5 | Kore (دافئ، هادئ) | gemini-3.1-flash-tts-preview | calm warm low |
| kids 6-8 | Leda (شبابي مرح) | gemini-3.1-flash-tts-preview | bright soft affectionate |
| junior 9-12 | Aoede (تعليمي واضح) | gemini-3.1-flash-tts-preview | clear educational steady |

### النصوص المطلوبة لكل محرك (من audioProductionQueue.ts)

#### trace_color (5 مقاطع):
- vo.intro, vo.instruction, vo.instruction_repeat, vo.stroke_complete, vo.coloring_intro, vo.level_complete, vo.game_complete, vo.exit_confirm
- لكل حرف: prompt_key مثل "هذا حرف الألف، وصوته اَ..."

#### count_quantity (27 مقطع):
- BASE 6 + vo.count.1..20 (عشرون مقطع منفصل) + vo.recount + vo.explain_answer + vo.correct + vo.retry + vo.hint

#### match_pairs / sort_bins / sequence_order:
- BASE 6 + vo.correct, vo.retry, vo.hint + per-item vo.bin_label.b1, vo.item_label.i1...
- sequence_order: vo.panel_caption.p1...

#### word_build (متغير حسب الكلمة):
- BASE 6 + vo.word, vo.word_syllables, vo.letter_ba, vo.letter_form ...

#### memory_flip:
- BASE 4 فقط (بدون correct/retry/hint حسب docs/games/03-voice-arabic.md) + vo.pair_found + vo.card_label.*

#### rhythm_tap:
- track music فقط (music.track) + لا vo.correct/retry

#### logic_pattern:
- BASE + vo.hint_1, vo.hint_2, vo.explain_rule, vo.correct... + explain_options

#### block_code:
- BASE + vo.block.move, vo.block.turn_left/right, vo.block.repeat, vo.block.if_path, vo.collision, vo.star_optimal

#### sim_lab:
- BASE + vo.stage_predict, vo.stage_experiment, vo.stage_explain, vo.trial_recorded, vo.need_more_trials, vo.explain_final

#### timeline_map:
- BASE + vo.hint_older, vo.hint_newer, vo.hint_direction, vo.explain_event + vo.event_label.e1...

## توليد الصور عبر PlayVeo

### استخدام wave-production runner
```bash
# خطة
node tools/playveo/wave-production.mjs --plan

# تقديم 4 أصول فقط (اختبار)
node tools/playveo/wave-production.mjs --submit --only game-wave1-memory-animals/cover --limit 1

# متابعة
node tools/playveo/wave-production.mjs --poll --only game-wave1-memory-animals/cover

# دفع كامل (يستهلك credits)
node tools/playveo/wave-production.mjs --submit --poll --limit 10
```

### البرومبت كونتراكت (من wave-visual.manifest.json)
```
Majarra child-friendly premium children's game illustration.
Audience: children age X-Y. Game: TITLE; purpose: ENGINE gameplay.
Art direction: ... Asset purpose: ROLE. Subject: ...
polished 2D storybook game art, rounded readable silhouettes...
no text, no letters, no numbers, no symbols that resemble writing.
no logos, no branded characters, no watermark, no signature.
```

الحفاظ على:
- لا نص داخل أي صورة — النص من arb فقط
- ألوان مجرة: Midnight Navy #0B1026, Cosmic Indigo #1B236B, Comet Cyan #00D6F5, Star Yellow #FFD34D
- أشكال مبسطة، حواف نظيفة، خلفية سادة قابلة للإزالة للعناصر الشفافة

## Migration الجديد 0057 — الهيكل

```sql
PRAGMA foreign_keys=ON;

-- 18 لعبة جديدة × 5 مستويات = 90 مستوى
INSERT OR IGNORE INTO games (id, engine_id, ...) VALUES
  -- match_pairs L3 (مستوى 5)
  -- trace_color L3 shapes (مسارات هندسية SVG)
  -- trace_color L3 numbers (أرقام 1-10)
  ...

INSERT OR IGNORE INTO game_localizations (game_id, language, ...) VALUES ...

-- أصول placeholder ready (إن لم توجد أصول حقيقية بعد)
INSERT OR IGNORE INTO content_assets (id, kind, status, visibility, ...) VALUES ...

-- ربط الحزم بالكواكب/السلسلة
```

## قائمة الـ 18 لعبة الجديدة بالتفصيل

### 1) game-match-nature-3 — match_pairs — 3-5 — الطبيعة
- معيار: relation (الجزء للكل)
- محتوى: 5 مستويات، 2→3 targets، distractors تزداد

### 2) game-shape-trace-3 — trace_color — 3-5 — أشكال
- مسارات stroke_paths لأشكال: دائرة، مربع، مثلث (polygon normalized)
- coloring stage بعد كل شكل

### 3) game-number-trace-3 — trace_color — 4-6 — أرقام عربية
- أرقام 1-5، scoring geometric_ordered
- localization language_specific ar فقط

### 4) game-sort-animals-3 — sort_bins — 3-5 — حيوانات
- معيار animals vs birds vs fish (3 bins بعد التدرج)

### 5) game-memory-shapes-3 — memory_flip — 3-5 — أشكال
- grid يتدرج 2×2→3×4=6 أزواج

### 6) game-count-nature-3 — count_quantity — 3-5 — تفاح + طيور
- modes: count_and_pick → drag_amount → compare_sets

### 7) game-sequence-story-3a — sequence_order — 6-8 — قصة بيت
- 5 مستويات، story type، 3→5 panels، accepted_orders 2

### 8) game-sequence-daily-3b — sequence_order — 3-5 — يومي
- procedure type، روتين الصباح الخ...

### 9) game-word-family-3a — word_build — 6-8 — عائلة
- كلمات: أب، أم، بيت، ولد، بنت — 3→5 letters ZWJ forms

### 10) game-word-animals-3b — word_build — 6-8 — حيوانات
- قط، كلب، أسد، فيل...

### 11) game-rhythm-nature-3a — rhythm_tap — 6-8 — طبيعة
- bpm 80→100، lanes 1→2، notes 6→16، hit_window 400→350

### 12) game-rhythm-festive-3b — rhythm_tap — 3-5 — احتفالي
- bpm 90، مرح أكثر

### 13) game-logic-colors-3a — logic_pattern — 6-8 — ألوان
- modes linear → matrix_2x2، changing_dimensions color/shape

### 14) game-logic-sequence-3b — logic_pattern — 9-12 — تسلسل منطقي
- matrix_3x3 + rule_infer + require_explanation true

### 15) game-block-maze-3 — block_code — 9-12 — متاهة
- grids 4×4→6×6، obstacles 1→5، allowed_blocks يتدرج move→repeat→if_path→function
- block_limit 6→12، optimal 4→10

### 16) game-sim-plant-3 — sim_lab — 9-12 — نمو النبات
- sim plant_growth، variables ضوء/ماء/حرارة، measured height
- positive relationships، hypothesis_options 3

### 17) game-timeline-egypt-3 — timeline_map — 9-12 — مصر
- mode both، 3→5 events: الأهرام -2600، مكتبة الإسكندرية -300، فتح القاهرة 969، قناة السويس 1869، السد 1970
- map region middle_east_north_africa، tolerance_years 50

### 18) game-trace-color-advanced-3 — trace_color — 9-12 — خط عربي متقدم
- كتابة كلمات بسيطة: رسم كلمة «أمل» بتتبع stroke_order

## حقوق ومراجعات
- كل أصل AI يلزمه توثيق الترخيص في content_assets.meta
- موسيقى rhythm_tap: ترخيص تجاري + نطاق جغرافي + مدة (engineContracts.ts)
- word_build: linguistic_review
- sim_lab: scientific_review
- timeline_map: historical_review
- rhythm_tap: music_rights

## اختبارات القبول
- pack_version ≤ engine_version (1)
- levels 1..5 متصلة
- كل asset-id في content_assets readiness=ready
- كل vo key إجباري موجود في voice_manifest
- لا نص داخل صورة
- touch_target ≥ min (64 preschool، 48 junior)
- supports_dpad متطابق مع engine_contract
- gamePackValidation.validatePackForGame() يمر

## التسلسل الزمني المقترح
- الأسبوع 1: توليد أصوات 18 لعبة قديمة + 18 جديدة (27+ مقطع × 18 = ~500 ملف)
- الأسبوع 2: توليد صور Wave عبر PlayVeo (حوالي 120 أصول شفافة + 36 cover)
- الأسبوع 3: migration 0057 + مراجعات + QA 4 محاور (أداء، تربوي، لغوي، تاريخي)
- الأسبوع 4: نشر 36 لعبة + store submission
