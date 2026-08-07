# حزم ألعاب كوكب أبجد

بيانات `games.content_pack` الكاملة الجاهزة للـCMS. المواصفة المرجعية في [مواصفة الألعاب](../../../games/README.md).

## الفهرس

| الحزمة | المحرك | الحلقة | الهدف | لغويًا |
|---|---|---:|---|---|
| [`mp-luna-ep1`](#mp-luna-ep1) | `match_pairs` | 1 | `lang.vocab.match_word_image` | `translatable` |
| [`mp-luna-ep2`](#mp-luna-ep2) | `match_pairs` | 2 | `lang.vocab.match_word_image` | `translatable` |
| [`wb-luna-ep3`](#wb-luna-ep3) | `word_build` | 3 | `lang.phonics.first_sound` | **`language_specific`** |
| [`tc-luna-ep4`](#tc-luna-ep4) | `trace_color` | 4 | `lang.letters.trace_form` | **`language_specific`** |
| [`sb-luna-ep5`](#sb-luna-ep5) | `sort_bins` | 5 | `lang.vocab.name_objects` | `translatable` |
| [`mp-luna-ep6`](#mp-luna-ep6) | `match_pairs` | 6 | `lang.vocab.name_objects` | `translatable` |

## إعدادات مشتركة

كل حزم هذا الكوكب تستخدم:

```json
{
  "help_system": {
    "hint_after_failed_attempts": 2,
    "hint_type": "highlight_target",
    "repeat_instructions_button": true,
    "simplify_after_failed_attempts": 3,
    "solution_after_failed_attempts": 4,
    "counts_as_help_used": true
  },
  "max_attempts": null,
  "age_min": 3,
  "age_max": 5,
  "reading_level": "pre_reader",
  "interaction_mode": "tap",
  "supervision_level": "recommended",
  "difficulty": "easy",
  "is_free": 0
}
```

`max_attempts = null` — **محاولات غير محدودة في كل ألعاب البراعم**.

---

## `mp-luna-ep1`

**مطابقة الصورة بالشيء** · محرك `match_pairs` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "match_type": "identical",
      "prompt_key": "match.picture_to_thing",
      "targets": [
        { "id": "t1", "image": "asset-apple", "label_key": "word.apple", "audio": "asset-vo-apple" },
        { "id": "t2", "image": "asset-ball", "label_key": "word.ball", "audio": "asset-vo-ball" }
      ],
      "items": [
        { "id": "i1", "image": "asset-apple-pic", "target": "t1", "label_key": "word.apple", "audio": "asset-vo-apple" },
        { "id": "i2", "image": "asset-ball-pic", "target": "t2", "label_key": "word.ball", "audio": "asset-vo-ball" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 2,
      "match_type": "identical",
      "prompt_key": "match.picture_to_thing",
      "targets": [
        { "id": "t1", "image": "asset-apple", "label_key": "word.apple", "audio": "asset-vo-apple" },
        { "id": "t2", "image": "asset-cat", "label_key": "word.cat", "audio": "asset-vo-cat" },
        { "id": "t3", "image": "asset-house", "label_key": "word.house", "audio": "asset-vo-house" }
      ],
      "items": [
        { "id": "i1", "image": "asset-apple-pic", "target": "t1", "label_key": "word.apple", "audio": "asset-vo-apple" },
        { "id": "i2", "image": "asset-cat-pic", "target": "t2", "label_key": "word.cat", "audio": "asset-vo-cat" },
        { "id": "i3", "image": "asset-house-pic", "target": "t3", "label_key": "word.house", "audio": "asset-vo-house" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 3,
      "match_type": "identical",
      "prompt_key": "match.picture_to_thing",
      "targets": [
        { "id": "t1", "image": "asset-ball", "label_key": "word.ball", "audio": "asset-vo-ball" },
        { "id": "t2", "image": "asset-cat", "label_key": "word.cat", "audio": "asset-vo-cat" },
        { "id": "t3", "image": "asset-house", "label_key": "word.house", "audio": "asset-vo-house" }
      ],
      "items": [
        { "id": "i1", "image": "asset-ball-pic", "target": "t1", "label_key": "word.ball", "audio": "asset-vo-ball" },
        { "id": "i2", "image": "asset-cat-pic", "target": "t2", "label_key": "word.cat", "audio": "asset-vo-cat" },
        { "id": "i3", "image": "asset-house-pic", "target": "t3", "label_key": "word.house", "audio": "asset-vo-house" }
      ],
      "distractors": [
        { "id": "d1", "image": "asset-apple-pic", "label_key": "word.apple", "audio": "asset-vo-apple" }
      ],
      "shuffle": true
    }
  ],
  "assets": {
    "images": ["asset-apple","asset-apple-pic","asset-ball","asset-ball-pic","asset-cat","asset-cat-pic","asset-house","asset-house-pic"],
    "audio": ["asset-vo-apple","asset-vo-ball","asset-vo-cat","asset-vo-house"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-mp1-intro",
    "vo.instruction": "asset-vo-mp1-instruction",
    "vo.instruction_repeat": "asset-vo-mp1-instruction-slow",
    "vo.hint": "asset-vo-mp1-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### نصوص الصوت

| المفتاح | النص |
|---|---|
| `vo.intro` | «هيا نلعب معًا!» |
| `vo.instruction` | «اسحب كل صورة إلى الصورة المثلها.» |
| `vo.hint` | «انظر إلى الشكل مرة أخرى.» |

---

## `mp-luna-ep2`

**من الصوت إلى الصورة** · محرك `match_pairs` · نوع `sound_image` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "match_type": "sound_image",
      "prompt_key": "match.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-sun", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "t2", "image": "asset-water", "label_key": "word.water", "audio": "asset-vo-word-water" }
      ],
      "items": [
        { "id": "i1", "image": "asset-icon-sound", "target": "t1", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "i2", "image": "asset-icon-sound", "target": "t2", "label_key": "word.water", "audio": "asset-vo-word-water" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 2,
      "match_type": "sound_image",
      "prompt_key": "match.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-flower", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "t2", "image": "asset-door", "label_key": "word.door", "audio": "asset-vo-word-door" },
        { "id": "t3", "image": "asset-sun", "label_key": "word.sun", "audio": "asset-vo-word-sun" }
      ],
      "items": [
        { "id": "i1", "image": "asset-icon-sound", "target": "t1", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "i2", "image": "asset-icon-sound", "target": "t2", "label_key": "word.door", "audio": "asset-vo-word-door" },
        { "id": "i3", "image": "asset-icon-sound", "target": "t3", "label_key": "word.sun", "audio": "asset-vo-word-sun" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 3,
      "match_type": "sound_image",
      "prompt_key": "match.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-water", "label_key": "word.water", "audio": "asset-vo-word-water" },
        { "id": "t2", "image": "asset-flower", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "t3", "image": "asset-door", "label_key": "word.door", "audio": "asset-vo-word-door" }
      ],
      "items": [
        { "id": "i1", "image": "asset-icon-sound", "target": "t1", "label_key": "word.water", "audio": "asset-vo-word-water" },
        { "id": "i2", "image": "asset-icon-sound", "target": "t2", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "i3", "image": "asset-icon-sound", "target": "t3", "label_key": "word.door", "audio": "asset-vo-word-door" }
      ],
      "distractors": [
        { "id": "d1", "image": "asset-cat", "label_key": "word.cat", "audio": "asset-vo-cat" }
      ],
      "shuffle": true
    }
  ],
  "assets": {
    "images": ["asset-sun","asset-water","asset-flower","asset-door","asset-cat","asset-icon-sound"],
    "audio": ["asset-vo-word-sun","asset-vo-word-water","asset-vo-word-flower","asset-vo-word-door","asset-vo-cat"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-mp2-intro",
    "vo.instruction": "asset-vo-mp2-instruction",
    "vo.instruction_repeat": "asset-vo-mp2-instruction-slow",
    "vo.hint": "asset-vo-mp2-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### نصوص الصوت

| المفتاح | النص |
|---|---|
| `vo.instruction` | «استمع، ثم اسحب الصورة الصحيحة.» |
| `vo.hint` | «استمع مرة أخرى بهدوء.» |

**إلزامي:** العنصر المسحوب `asset-icon-sound` رمز صوت بصري + **موجة بصرية** — بديل الصوت لمن لا يسمع.

---

## `wb-luna-ep3`

**الصوت الأول** · محرك `word_build` · **`language_specific` — لا يُترجم**

⚠️ هذه الحزمة **مبسّطة** عن مواصفة `word_build` الكاملة: الطفل يختار **الحرف الأول فقط** لا يبني الكلمة كاملة، لأن عمره 4–5.

```json
{
  "pack_version": 1,
  "engine_id": "word_build",
  "progression": { "levels_to_finish": 4, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "language": "ar",
      "word": "بيت",
      "word_audio": "asset-vo-house",
      "word_image": "asset-house",
      "writing_direction": "rtl",
      "slots": 1,
      "letters": [
        { "char": "بـ", "form": "initial", "position": 1, "audio": "asset-vo-sound-ba" }
      ],
      "distractors": [
        { "char": "مـ", "form": "initial", "audio": "asset-vo-sound-ma" }
      ],
      "show_word_text_button": true
    },
    {
      "level": 2,
      "language": "ar",
      "word": "ماء",
      "word_audio": "asset-vo-word-water",
      "word_image": "asset-water",
      "writing_direction": "rtl",
      "slots": 1,
      "letters": [
        { "char": "مـ", "form": "initial", "position": 1, "audio": "asset-vo-sound-ma" }
      ],
      "distractors": [
        { "char": "سـ", "form": "initial", "audio": "asset-vo-sound-sa" }
      ],
      "show_word_text_button": true
    },
    {
      "level": 3,
      "language": "ar",
      "word": "سمكة",
      "word_audio": "asset-vo-word-fish",
      "word_image": "asset-fish",
      "writing_direction": "rtl",
      "slots": 1,
      "letters": [
        { "char": "سـ", "form": "initial", "position": 1, "audio": "asset-vo-sound-sa" }
      ],
      "distractors": [
        { "char": "بـ", "form": "initial", "audio": "asset-vo-sound-ba" },
        { "char": "قـ", "form": "initial", "audio": "asset-vo-sound-qa" }
      ],
      "show_word_text_button": true
    },
    {
      "level": 4,
      "language": "ar",
      "word": "قمر",
      "word_audio": "asset-vo-word-moon",
      "word_image": "asset-moon",
      "writing_direction": "rtl",
      "slots": 1,
      "letters": [
        { "char": "قـ", "form": "initial", "position": 1, "audio": "asset-vo-sound-qa" }
      ],
      "distractors": [
        { "char": "مـ", "form": "initial", "audio": "asset-vo-sound-ma" },
        { "char": "سـ", "form": "initial", "audio": "asset-vo-sound-sa" }
      ],
      "show_word_text_button": true
    }
  ],
  "assets": {
    "images": ["asset-house","asset-water","asset-fish","asset-moon","asset-glyph-ba-initial","asset-glyph-mim-initial","asset-glyph-sin-initial","asset-glyph-qaf-initial"],
    "audio": ["asset-vo-house","asset-vo-word-water","asset-vo-word-fish","asset-vo-word-moon","asset-vo-sound-ba","asset-vo-sound-ma","asset-vo-sound-sa","asset-vo-sound-qa"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-wb3-intro",
    "vo.instruction": "asset-vo-wb3-instruction",
    "vo.instruction_repeat": "asset-vo-wb3-instruction-slow",
    "vo.hint": "asset-vo-wb3-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### نصوص الصوت

| المفتاح | النص |
|---|---|
| `vo.instruction` | «استمع للكلمة، واختر أول صوت.» |
| `vo.hint` | «الكلمة تبدأ بهذا الصوت.» |

### قواعد إلزامية

| القاعدة | التفصيل |
|---|---|
| شكل الحرف | **`initial` لا `isolated`** — الحرف في بداية الكلمة يأخذ شكله الابتدائي |
| النطق | صوت الحرف لا اسمه: «بَ» لا «باء» |
| المشتّتات | من حروف **مختلفة المخرج**، لا متشابهة |
| النشر المترجم | **CMS يرفضه** — `translated_from` يجب أن يكون `NULL` |
| زر النص | `show_word_text_button: true` إلزامي |

---

## `tc-luna-ep4`

**حروف اسمي** · محرك `trace_color` · **`language_specific`** · `supports_dpad: false`

```json
{
  "pack_version": 1,
  "engine_id": "trace_color",
  "progression": { "levels_to_finish": 4, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "mode": "letter",
      "language": "ar",
      "glyph": "ا",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "points": [[0.50,0.22],[0.50,0.74]], "direction": "forward" }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-a",
      "coloring": { "enabled": true, "regions": ["r1"], "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"] }
    },
    {
      "level": 2,
      "mode": "letter",
      "language": "ar",
      "glyph": "ل",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "points": [[0.55,0.20],[0.55,0.62],[0.40,0.75],[0.30,0.68]], "direction": "forward" }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-la",
      "coloring": { "enabled": true, "regions": ["r1"], "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"] }
    },
    {
      "level": 3,
      "mode": "letter",
      "language": "ar",
      "glyph": "و",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "points": [[0.58,0.38],[0.48,0.32],[0.40,0.40],[0.48,0.50],[0.58,0.46]], "direction": "forward" },
        { "id": "s2", "order": 2, "points": [[0.58,0.46],[0.58,0.72]], "direction": "forward" }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-wa",
      "coloring": { "enabled": true, "regions": ["r1"], "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"] }
    },
    {
      "level": 4,
      "mode": "letter",
      "language": "ar",
      "glyph": "ن",
      "letter_form": "isolated",
      "writing_direction": "rtl",
      "stroke_paths": [
        { "id": "s1", "order": 1, "points": [[0.68,0.42],[0.62,0.62],[0.50,0.70],[0.38,0.62],[0.32,0.42]], "direction": "forward" },
        { "id": "s2", "order": 2, "points": [[0.50,0.28]], "type": "dot" }
      ],
      "tolerance_dp": 24,
      "coverage_required": 0.8,
      "guide_audio": "asset-vo-sound-na",
      "coloring": { "enabled": true, "regions": ["r1"], "palette": ["#FFD34D","#00D6F5","#FF6FAE","#6A3DF2","#FF9F1C"] }
    }
  ],
  "assets": {
    "images": ["asset-glyph-alif","asset-glyph-lam","asset-glyph-waw","asset-glyph-noon"],
    "audio": ["asset-vo-sound-a","asset-vo-sound-la","asset-vo-sound-wa","asset-vo-sound-na"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-tc4-intro",
    "vo.instruction": "asset-vo-tc4-instruction",
    "vo.instruction_repeat": "asset-vo-tc4-instruction-slow",
    "vo.hint": "asset-vo-tc4-hint",
    "vo.stroke_complete": "asset-vo-stroke-complete",
    "vo.coloring_intro": "asset-vo-coloring-intro",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### نصوص الصوت

| المفتاح | النص |
|---|---|
| `vo.instruction` | «ضع إصبعك على النقطة، واتبع الطريق.» |
| `vo.hint` | «ابدأ من النقطة المتوهجة.» |
| `vo.stroke_complete` | «أحسنت!» |
| `vo.coloring_intro` | «الآن لوّن كما تحب.» |

### ترتيب المستويات — قرار تربوي

الترتيب **من الأسهل رسمًا لا بترتيب حروف الاسم**: ا ← ل ← و ← ن.

«ن» آخرًا لأنها الوحيدة **بنقطة**، والنقطة مفهوم إضافي يُقدَّم بعد إتقان الضربة.

### قواعد إلزامية

| القاعدة | التفصيل |
|---|---|
| ترتيب الرسم | **الجسم أولًا ثم النقطة** — `order` يفرضه |
| النقطة | `type: "dot"` تُلمس **لا تُسحب** |
| التلوين | **بلا شرط نجاح** — لا يُحسب في `score` |
| الخروج عن المسار | الخط يتوقف · **لا إعادة من البداية** |
| الوضع المبسّط | هامش 40dp · تغطية 60% |
| TV | `supports_dpad: false` ⇒ **مخفية على TV** |
| المراجعة | 🔴 **إحداثيات المسارات تحتاج مراجعة خطّاط/مدقق لغوي معتمد** |

---

## `sb-luna-ep5`

**أين يوضع؟** · محرك `sort_bins` · معيار `abstract` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "sort_bins",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "criterion_key": "sort.by_room",
      "criterion_type": "abstract",
      "bins": [
        { "id": "b1", "label_key": "room.kitchen", "image": "asset-room-kitchen", "audio": "asset-vo-room-kitchen" },
        { "id": "b2", "label_key": "room.bedroom", "image": "asset-room-bedroom", "audio": "asset-vo-room-bedroom" }
      ],
      "items": [
        { "id": "i1", "image": "asset-cup", "bin": "b1", "label_key": "word.cup", "audio": "asset-vo-cup", "explain_audio": "asset-vo-explain-cup" },
        { "id": "i2", "image": "asset-bed", "bin": "b2", "label_key": "word.bed", "audio": "asset-vo-bed", "explain_audio": "asset-vo-explain-bed" },
        { "id": "i3", "image": "asset-spoon", "bin": "b1", "label_key": "word.spoon", "audio": "asset-vo-spoon", "explain_audio": "asset-vo-explain-spoon" },
        { "id": "i4", "image": "asset-pillow", "bin": "b2", "label_key": "word.pillow", "audio": "asset-vo-pillow", "explain_audio": "asset-vo-explain-pillow" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    },
    {
      "level": 2,
      "criterion_key": "sort.by_room",
      "criterion_type": "abstract",
      "bins": [
        { "id": "b1", "label_key": "room.kitchen", "image": "asset-room-kitchen", "audio": "asset-vo-room-kitchen" },
        { "id": "b2", "label_key": "room.living", "image": "asset-room-living", "audio": "asset-vo-room-living" }
      ],
      "items": [
        { "id": "i1", "image": "asset-chair", "bin": "b2", "label_key": "word.chair", "audio": "asset-vo-chair", "explain_audio": "asset-vo-explain-chair" },
        { "id": "i2", "image": "asset-cup", "bin": "b1", "label_key": "word.cup", "audio": "asset-vo-cup", "explain_audio": "asset-vo-explain-cup" },
        { "id": "i3", "image": "asset-window", "bin": "b2", "label_key": "word.window", "audio": "asset-vo-window", "explain_audio": "asset-vo-explain-window" },
        { "id": "i4", "image": "asset-spoon", "bin": "b1", "label_key": "word.spoon", "audio": "asset-vo-spoon", "explain_audio": "asset-vo-explain-spoon" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    },
    {
      "level": 3,
      "criterion_key": "sort.by_room",
      "criterion_type": "abstract",
      "bins": [
        { "id": "b1", "label_key": "room.kitchen", "image": "asset-room-kitchen", "audio": "asset-vo-room-kitchen" },
        { "id": "b2", "label_key": "room.bedroom", "image": "asset-room-bedroom", "audio": "asset-vo-room-bedroom" },
        { "id": "b3", "label_key": "room.living", "image": "asset-room-living", "audio": "asset-vo-room-living" }
      ],
      "items": [
        { "id": "i1", "image": "asset-cup", "bin": "b1", "label_key": "word.cup", "audio": "asset-vo-cup", "explain_audio": "asset-vo-explain-cup" },
        { "id": "i2", "image": "asset-spoon", "bin": "b1", "label_key": "word.spoon", "audio": "asset-vo-spoon", "explain_audio": "asset-vo-explain-spoon" },
        { "id": "i3", "image": "asset-bed", "bin": "b2", "label_key": "word.bed", "audio": "asset-vo-bed", "explain_audio": "asset-vo-explain-bed" },
        { "id": "i4", "image": "asset-pillow", "bin": "b2", "label_key": "word.pillow", "audio": "asset-vo-pillow", "explain_audio": "asset-vo-explain-pillow" },
        { "id": "i5", "image": "asset-chair", "bin": "b3", "label_key": "word.chair", "audio": "asset-vo-chair", "explain_audio": "asset-vo-explain-chair" },
        { "id": "i6", "image": "asset-window", "bin": "b3", "label_key": "word.window", "audio": "asset-vo-window", "explain_audio": "asset-vo-explain-window" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    }
  ],
  "assets": {
    "images": ["asset-cup","asset-spoon","asset-bed","asset-pillow","asset-chair","asset-window","asset-room-kitchen","asset-room-bedroom","asset-room-living"],
    "audio": ["asset-vo-cup","asset-vo-spoon","asset-vo-bed","asset-vo-pillow","asset-vo-chair","asset-vo-window","asset-vo-room-kitchen","asset-vo-room-bedroom","asset-vo-room-living"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-sb5-intro",
    "vo.instruction": "asset-vo-sb5-instruction",
    "vo.instruction_repeat": "asset-vo-sb5-instruction-slow",
    "vo.hint": "asset-vo-sb5-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### نصوص الصوت

| المفتاح | النص |
|---|---|
| `vo.instruction` | «ضع كل شيء في غرفته.» |
| `vo.hint` | «أين نستعمل هذا الشيء؟» |

### نصوص الشرح عند الصحيح

| المفتاح | النص |
|---|---|
| `asset-vo-explain-cup` | «نشرب في الكوب في المطبخ.» |
| `asset-vo-explain-spoon` | «نأكل بالمِلعقة في المطبخ.» |
| `asset-vo-explain-bed` | «ننام على السَّرير.» |
| `asset-vo-explain-pillow` | «الوِسادة على السَّرير.» |
| `asset-vo-explain-chair` | «نجلس على الكُرسي.» |
| `asset-vo-explain-window` | «النافِذة نرى منها.» |

**التلميح يسأل عن الوظيفة لا الموضع** — يوجّه للقاعدة لا للجواب.

---

## `mp-luna-ep6`

**مراجعة شاملة** · محرك `match_pairs` · نوع `relation` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "match_type": "relation",
      "prompt_key": "match.who_lives_where",
      "targets": [
        { "id": "t1", "image": "asset-tree", "label_key": "word.tree", "audio": "asset-vo-tree" },
        { "id": "t2", "image": "asset-house", "label_key": "word.house", "audio": "asset-vo-house" }
      ],
      "items": [
        { "id": "i1", "image": "asset-bird", "target": "t1", "label_key": "word.bird", "audio": "asset-vo-bird" },
        { "id": "i2", "image": "asset-cat", "target": "t2", "label_key": "word.cat", "audio": "asset-vo-cat" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 2,
      "match_type": "sound_image",
      "prompt_key": "match.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-tree", "label_key": "word.tree", "audio": "asset-vo-tree" },
        { "id": "t2", "image": "asset-bird", "label_key": "word.bird", "audio": "asset-vo-bird" },
        { "id": "t3", "image": "asset-flower", "label_key": "word.flower", "audio": "asset-vo-word-flower" }
      ],
      "items": [
        { "id": "i1", "image": "asset-icon-sound", "target": "t1", "label_key": "word.tree", "audio": "asset-vo-tree" },
        { "id": "i2", "image": "asset-icon-sound", "target": "t2", "label_key": "word.bird", "audio": "asset-vo-bird" },
        { "id": "i3", "image": "asset-icon-sound", "target": "t3", "label_key": "word.flower", "audio": "asset-vo-word-flower" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 3,
      "match_type": "identical",
      "prompt_key": "match.picture_to_thing",
      "targets": [
        { "id": "t1", "image": "asset-sun", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "t2", "image": "asset-tree", "label_key": "word.tree", "audio": "asset-vo-tree" },
        { "id": "t3", "image": "asset-cat", "label_key": "word.cat", "audio": "asset-vo-cat" }
      ],
      "items": [
        { "id": "i1", "image": "asset-sun-pic", "target": "t1", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "i2", "image": "asset-tree-pic", "target": "t2", "label_key": "word.tree", "audio": "asset-vo-tree" },
        { "id": "i3", "image": "asset-cat-pic", "target": "t3", "label_key": "word.cat", "audio": "asset-vo-cat" }
      ],
      "distractors": [
        { "id": "d1", "image": "asset-flower-pic", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "d2", "image": "asset-house-pic", "label_key": "word.house", "audio": "asset-vo-house" }
      ],
      "shuffle": true
    }
  ],
  "assets": {
    "images": ["asset-tree","asset-tree-pic","asset-bird","asset-house","asset-house-pic","asset-cat","asset-cat-pic","asset-sun","asset-sun-pic","asset-flower","asset-flower-pic","asset-icon-sound"],
    "audio": ["asset-vo-tree","asset-vo-bird","asset-vo-house","asset-vo-cat","asset-vo-word-sun","asset-vo-word-flower"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-mp6-intro",
    "vo.instruction": "asset-vo-mp6-instruction",
    "vo.instruction_repeat": "asset-vo-mp6-instruction-slow",
    "vo.hint": "asset-vo-mp6-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### تصميم المستويات — مراجعة متدرجة

| المستوى | النوع | المهارة المُراجَعة | من الحلقة |
|---:|---|---|---:|
| 1 | `relation` | علاقة منطقية | جديد |
| 2 | `sound_image` | صوت ← صورة | 2 |
| 3 | `identical` | صورة ← شيء + مشتّتان | 1 |

الترتيب مقصود: يبدأ بالجديد ثم يعود للأقدم — **الاسترجاع المتباعد** يثبّت الذاكرة أفضل من التكرار المتصل.

### نصوص الصوت

| المفتاح | النص |
|---|---|
| `vo.instruction` (م1) | «اسحب كل حيوان إلى بيته.» |
| `vo.instruction` (م2) | «استمع، ثم اسحب الصورة الصحيحة.» |
| `vo.instruction` (م3) | «اسحب كل صورة إلى الصورة المثلها.» |
| `vo.hint` | «انظر معي مرة أخرى.» |

---

## مفاتيح ترجمة مشتركة

```
match.picture_to_thing  = اسحب كل صورة إلى الصورة المثلها.
match.listen_and_find   = استمع، ثم اسحب الصورة الصحيحة.
match.who_lives_where   = اسحب كل حيوان إلى بيته.
sort.by_room            = ضع كل شيء في غرفته.
```

## أصوات مشتركة لكل الحزم

| المعرف | النص |
|---|---|
| `asset-vo-level-complete` | «أكملت المستوى!» |
| `asset-vo-game-complete` | «انتهينا! كان لعبًا جميلًا.» |
| `asset-vo-exit-confirm` | «نتوقف الآن؟» |
| `asset-vo-stroke-complete` | «أحسنت!» |
| `asset-vo-coloring-intro` | «الآن لوّن كما تحب.» |

عبارات النجاح والمحاولة **لا تُوضع في الحزم** — تأتي من [طبقة التشجيع المشتركة](../../../games/04-encouragement-and-failure.md).

---

## معايير قبول الحزم

- [ ] الحزم الستّ تجتاز مخططات [`schemas/`](../../../games/schemas/README.md).
- [ ] كل `asset-id` موجود في `content_assets` بحالة `ready`.
- [ ] عدد العناصر في كل مستوى ≤ `max_elements_on_screen`.
- [ ] كل المفاتيح الصوتية الإلزامية موجودة.
- [ ] `wb-luna-ep3` و`tc-luna-ep4` بـ`translated_from = NULL`.
- [ ] `tc-luna-ep4` مخفية على TV.
- [ ] بديل السحب (لمس ← لمس) يعمل في الحزم الخمس التي تستخدم السحب.
- [ ] لا حزمة تحتوي عبارات تشجيع خاصة بها.
- [ ] `max_attempts = null` في كل الحزم.
- [ ] لا نص مطبوع في أي أصل صورة.
- [ ] مراجعة لغوية معتمدة لـ`wb-luna-ep3` و`tc-luna-ep4`.
