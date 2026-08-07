# 02 — عقد بيانات المحرك والحزمة

## `game_engines.mechanics`

```json
{
  "engine_version": 1,
  "localization": "translatable",
  "input": ["tap", "drag"],
  "level_schema_ref": "match_pairs.v1",
  "supports_hints": true,
  "requires_audio": true,
  "min_touch_target_dp": 64,
  "max_elements_on_screen": 6,
  "supports_dpad": true,
  "has_timer": false
}
```

| الحقل | النوع | الوصف |
|---|---|---|
| `engine_version` | integer | نسخة المحرك؛ الحزم الأقدم يجب أن تعمل |
| `localization` | enum | `language_neutral` \| `translatable` \| `language_specific` |
| `input` | array | `tap` \| `drag` \| `continuous_drag` |
| `level_schema_ref` | string | مرجع مخطط JSON في `schemas/` |
| `supports_hints` | boolean | هل يدعم سلّم التلميح |
| `requires_audio` | boolean | هل الصوت إلزامي للعب |
| `min_touch_target_dp` | integer | 48 عادة، 64 لـ`preschool`، 72 لـ`match_pairs` |
| `max_elements_on_screen` | integer | حد أقصى صارم يفرضه الخادم |
| `supports_dpad` | boolean | `false` ⇒ يُخفى على TV |
| `has_timer` | boolean | `false` إلزاميًا لكل محرك `preschool` |

## قيم `mechanics` لكل محرك

| `engine_id` | `localization` | `max_elements` | `touch_dp` | `dpad` | `timer` |
|---|---|---:|---:|---|---|
| `match_pairs` | `translatable` | 6 | 72 | ✅ | ❌ |
| `trace_color` | `language_specific`* | 3 | 40** | ❌ | ❌ |
| `sort_bins` | `translatable` | 11 | 64 | ✅ | ❌ |
| `memory_flip` | `language_neutral` | 12 | 64 | ✅ | ❌ |
| `count_quantity` | `translatable` | 20 | 56 | ✅ | ❌ |
| `sequence_order` | `translatable` | 6 | 64 | ✅ | ❌ |
| `word_build` | `language_specific` | 8 | 56 | ✅ | ❌ |
| `rhythm_tap` | `language_neutral` | 3 | 72 | ✅ | ⏱*** |
| `logic_pattern` | `language_neutral` | 14 | 56 | ✅ | ❌ |
| `block_code` | `language_neutral` | 18 | 48 | ✅ | ❌ |
| `sim_lab` | `language_neutral` | 6 | 48 | ✅ | ❌ |
| `timeline_map` | `translatable` | 5 | 56 | ✅ | ❌ |

\* `language_neutral` للأشكال والأرقام، `language_specific` للحروف.
\*\* عرض المسار بصريًا؛ هامش الانحراف 24dp.
\*\*\* إيقاعي، لكن **لا فشل**.

## الشكل العام لـ`games.content_pack`

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": {
    "levels_to_finish": 3,
    "advance_on": "level_complete"
  },
  "levels": [ { "level": 1, "...": "خاص بكل محرك" } ],
  "assets": {
    "images": ["asset-id"],
    "audio": ["asset-id"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-intro",
    "vo.instruction": "asset-vo-instruction"
  }
}
```

## قواعد التحقق الإلزامية على الخادم

الخادم يرفض الحزمة عند أي خرق. **لا يُعتمد على تحقق الواجهة إطلاقًا.**

| # | القاعدة |
|---:|---|
| 1 | `levels.length` بين 1 و10 |
| 2 | أرقام `level` متصلة تبدأ من 1 بلا فراغات |
| 3 | كل `asset-id` موجود في `content_assets` وحالته `ready` |
| 4 | عدد العناصر في أي مستوى ≤ `max_elements_on_screen` |
| 5 | كل مفتاح صوتي إلزامي موجود في `voice_manifest` |
| 6 | `engine_id` في الحزمة = `games.engine_id` |
| 7 | `pack_version` ≤ `engine_version` المدعوم |
| 8 | لا نص مكتوب داخل الصور (تحقق تحريري موثق) |
| 9 | `age_min` ≤ `age_max`، وكلاهما بين 3 و12 |
| 10 | حزمة `language_specific` لها `translated_from = NULL` |
| 11 | كل مرجع داخلي (`target`, `bin`, `answer`) يشير إلى معرف موجود |
| 12 | أي نشاط منزلي له `safety_notes` غير فارغة و`supervision_level = required` |

## `games.help_system`

```json
{
  "hint_after_failed_attempts": 2,
  "hint_type": "highlight_target",
  "repeat_instructions_button": true,
  "simplify_after_failed_attempts": 3,
  "solution_after_failed_attempts": 4,
  "counts_as_help_used": true
}
```

| الحقل | القيمة الافتراضية | الوصف |
|---|---:|---|
| `hint_after_failed_attempts` | 2 | متى يظهر التلميح تلقائيًا |
| `hint_type` | — | `highlight_target` \| `narrow_options` \| `show_dimension` \| `direction_arrow` |
| `repeat_instructions_button` | `true` | **إلزامي `true` في كل الحزم** |
| `simplify_after_failed_attempts` | 3 | تقليل العناصر أو إزالة المشتّتات |
| `solution_after_failed_attempts` | 4 | عرض الحل مع شرح |
| `counts_as_help_used` | `true` | يضع `attempts.help_used = 1` |

هذا العقد هو ما يضمن أن الطفل **لا يعلق أبدًا**. التفاصيل في [04 — التشجيع والفشل](./04-encouragement-and-failure.md).

## واجهة الخادم

```
GET /api/v1/games/:id
```

| السلوك | التفاصيل |
|---|---|
| المصادقة | access token لولي الأمر + `child_id` |
| التحقق | ملكية الطفل، العمر، الخطة، عبر `FamilyDO` |
| اللغة | لغة الطفل، ثم `fallback` صريح: `ar` ← `en` |
| الأصول | capability قصيرة العمر من R2، كما في الفيديو |
| الاستجابة | الحزمة المنشورة فقط؛ المسودات لا تُسلَّم أبدًا |

## كتابة التقدم

اللعبة **لا تكتب في D1 مباشرة**:

```
POST /api/v1/family/progress
```

مع `event_id` ثابت لكل محاولة. التفاصيل في [05 — الإتقان والقياس](./05-mastery-and-measurement.md).
