# حزم ألعاب كوكب أرقام

بيانات `games.content_pack` الكاملة الجاهزة للـCMS. المواصفة المرجعية في [مواصفة الألعاب](../../../games/README.md).

## الفهرس

### عدّ معي · 3–5 · `preschool`

| الحزمة | المحرك | الحلقة | الهدف |
|---|---|---:|---|
| [`cq-cwm-ep1`](#cq-cwm-ep1) | `count_quantity` | 1 | `math.count.one_to_one` |
| [`cq-cwm-ep2`](#cq-cwm-ep2) | `count_quantity` | 2 | `math.count.to_five` |
| [`cq-cwm-ep3`](#cq-cwm-ep3) | `count_quantity` | 3 | `math.count.to_five` |
| [`cq-cwm-ep4`](#cq-cwm-ep4) | `count_quantity` | 4 | `math.compare.more_less` |
| [`lp-cwm-ep5`](#lp-cwm-ep5) | `logic_pattern` | 5 | `math.pattern.complete` |

### مغامرات الأرقام · 6–8 · `kids`

| الحزمة | المحرك | الحلقة | الهدف |
|---|---|---:|---|
| [`cq-aon-ep1`](#cq-aon-ep1) | `count_quantity` | 1 | `math.count.to_ten` |
| [`cq-aon-ep2`](#cq-aon-ep2) | `count_quantity` | 2 | `math.compare.more_less` |
| [`lp-aon-ep3`](#lp-aon-ep3) | `logic_pattern` | 3 | `math.pattern.complete` |
| [`cq-aon-ep4`](#cq-aon-ep4) | `count_quantity` | 4 | `math.add.visual_sum` |
| [`cq-aon-ep5`](#cq-aon-ep5) | `count_quantity` | 5 | `math.subtract.visual` |
| [`cq-aon-ep6`](#cq-aon-ep6) | `count_quantity` | 6 | `math.pattern.complete` |

كلها **`translatable`** — لا حزمة `language_specific` في هذا الكوكب.

## إعدادات مشتركة

### `preschool` — عدّ معي

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
  "age_min": 3, "age_max": 5,
  "reading_level": "pre_reader",
  "interaction_mode": "tap",
  "difficulty": "easy"
}
```

### `kids` — مغامرات الأرقام

```json
{
  "help_system": {
    "hint_after_failed_attempts": 2,
    "hint_type": "narrow_options",
    "repeat_instructions_button": true,
    "simplify_after_failed_attempts": 3,
    "solution_after_failed_attempts": 4,
    "counts_as_help_used": true
  },
  "max_attempts": null,
  "age_min": 6, "age_max": 8,
  "reading_level": "emerging",
  "interaction_mode": "guided",
  "difficulty": "medium"
}
```

`hint_type` يختلف: `preschool` يُبرز الهدف، و`kids` يُضيّق الخيارات — أنسب لعمر يفكّر بالاستبعاد.

**`numeral_system: "auto"` في كل حزم هذا الكوكب.**

---

## `cq-cwm-ep1`

**واحد لكل واحد** · `count_quantity` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "drag_amount", "range": [1, 3], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-chair-flat", "count": 2 }], "question_key": "cwm.one_per_target", "options": [1, 2, 3], "answer": 2 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "drag_amount", "range": [1, 4], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-chair-flat", "count": 3 }], "question_key": "cwm.one_per_target", "options": [2, 3, 4], "answer": 3 },
        { "id": "q2", "items": [{ "image": "asset-chair-flat", "count": 4 }], "question_key": "cwm.one_per_target", "options": [3, 4, 5], "answer": 4 },
        { "id": "q3", "items": [{ "image": "asset-chair-flat", "count": 2 }], "question_key": "cwm.one_per_target", "options": [1, 2, 3], "answer": 2 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "drag_amount", "range": [1, 5], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-chair-flat", "count": 5 }], "question_key": "cwm.one_per_target", "options": [4, 5, 6], "answer": 5 },
        { "id": "q2", "items": [{ "image": "asset-chair-flat", "count": 4 }], "question_key": "cwm.one_per_target", "options": [3, 4, 5], "answer": 4 },
        { "id": "q3", "items": [{ "image": "asset-chair-flat", "count": 3 }], "question_key": "cwm.one_per_target", "options": [2, 3, 4], "answer": 3 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-chair-flat", "asset-cup-flat"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-cq1-intro",
    "vo.instruction": "asset-vo-cq1-instruction",
    "vo.instruction_repeat": "asset-vo-cq1-instruction-slow",
    "vo.hint": "asset-vo-cq1-hint",
    "vo.recount": "asset-vo-recount",
    "vo.count.1": "asset-vo-num-1",
    "vo.count.2": "asset-vo-num-2",
    "vo.count.3": "asset-vo-num-3",
    "vo.count.4": "asset-vo-num-4",
    "vo.count.5": "asset-vo-num-5",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

| المفتاح | النص |
|---|---|
| `vo.instruction` | «ضع كوبًا واحدًا لكل كرسي.» |
| `vo.hint` | «هل عند كل كرسي كوب؟» |
| `vo.recount` | «هيا نعدّ مرة أخرى.» |

---

## `cq-cwm-ep2`

**ثلاثة أصدقاء** · `count_quantity` · 3 مستويات · يقيس **ثبات العدد**

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "count_and_pick", "range": [1, 3], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-teddy", "count": 2 }], "question_key": "cwm.how_many", "options": [1, 2, 3], "answer": 2 },
        { "id": "q2", "items": [{ "image": "asset-teddy", "count": 3 }], "question_key": "cwm.how_many", "options": [2, 3, 4], "answer": 3 },
        { "id": "q3", "items": [{ "image": "asset-ball-flat", "count": 1 }], "question_key": "cwm.how_many", "options": [1, 2], "answer": 1 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "count_and_pick", "range": [1, 3], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-teddy", "count": 3, "scattered": true }], "question_key": "cwm.how_many", "options": [2, 3, 4], "answer": 3 },
        { "id": "q2", "items": [{ "image": "asset-ball-flat", "count": 2, "scattered": true }], "question_key": "cwm.how_many", "options": [1, 2, 3], "answer": 2 },
        { "id": "q3", "items": [{ "image": "asset-teddy", "count": 3, "scattered": true }], "question_key": "cwm.how_many", "options": [2, 3, 4], "answer": 3 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "count_and_pick", "range": [1, 3], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-ball-mixed-size", "count": 3, "scattered": true }], "question_key": "cwm.how_many", "options": [2, 3, 4], "answer": 3 },
        { "id": "q2", "items": [{ "image": "asset-ball-mixed-size", "count": 2, "scattered": true }], "question_key": "cwm.how_many", "options": [1, 2, 3], "answer": 2 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-teddy", "asset-ball-flat", "asset-ball-mixed-size"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-cq2-intro",
    "vo.instruction": "asset-vo-cq2-instruction",
    "vo.instruction_repeat": "asset-vo-cq2-instruction-slow",
    "vo.hint": "asset-vo-cq2-hint",
    "vo.recount": "asset-vo-recount",
    "vo.count.1": "asset-vo-num-1",
    "vo.count.2": "asset-vo-num-2",
    "vo.count.3": "asset-vo-num-3",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**تصميم المستويات:** م1 مرتّبة · م2 **مبعثرة** (ثبات العدد) · م3 **مبعثرة بأحجام مختلفة** (الحجم ≠ العدد). تدرّج مقصود يقيس المفهومين.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «عُدّ الأشياء، ثم اختر الرقم.» |
| `vo.hint` | «المس كل شيء مرة واحدة أثناء العدّ.» |

---

## `cq-cwm-ep3`

**خمس نجوم** · `count_quantity` · 3 مستويات · يربط **الرقم بالكمية**

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "count_and_pick", "range": [1, 5], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 4 }], "question_key": "cwm.how_many", "options": [3, 4, 5], "answer": 4 },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 5 }], "question_key": "cwm.how_many", "options": [4, 5, 6], "answer": 5 },
        { "id": "q3", "items": [{ "image": "asset-star-flat", "count": 3 }], "question_key": "cwm.how_many", "options": [2, 3, 4], "answer": 3 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "count_and_pick", "range": [1, 5], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 5, "scattered": true }], "question_key": "cwm.how_many", "options": [4, 5, 6], "answer": 5 },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 2, "scattered": true }], "question_key": "cwm.how_many", "options": [1, 2, 3], "answer": 2 },
        { "id": "q3", "items": [{ "image": "asset-star-flat", "count": 4, "scattered": true }], "question_key": "cwm.how_many", "options": [3, 4, 5], "answer": 4 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "drag_amount", "range": [1, 5], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 5 }], "question_key": "cwm.drag_this_many", "options": [3, 4, 5], "answer": 4 },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 5 }], "question_key": "cwm.drag_this_many", "options": [2, 3, 5], "answer": 5 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-star-flat", "asset-card-num-1", "asset-card-num-2", "asset-card-num-3", "asset-card-num-4", "asset-card-num-5"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-cq3-intro",
    "vo.instruction": "asset-vo-cq3-instruction",
    "vo.instruction_repeat": "asset-vo-cq3-instruction-slow",
    "vo.hint": "asset-vo-cq3-hint",
    "vo.recount": "asset-vo-recount",
    "vo.count.1": "asset-vo-num-1",
    "vo.count.2": "asset-vo-num-2",
    "vo.count.3": "asset-vo-num-3",
    "vo.count.4": "asset-vo-num-4",
    "vo.count.5": "asset-vo-num-5",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**المستوى 3 معكوس الاتجاه:** من الرقم إلى الكمية. يقيس الربط الحقيقي لا الحفظ في اتجاه واحد.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «عُدّ النجوم، ثم اختر الرقم.» |
| `vo.instruction` (م3) | «اسحب هذا العدد من النجوم.» |
| `vo.hint` | «ابدأ العدّ من اليمين.» |

---

## `cq-cwm-ep4`

**أكثر أم أقل؟** · `count_quantity` · نمط `compare_sets` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "compare_sets", "range": [1, 5], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-apple-flat", "count": 3 }, "set_b": { "image": "asset-apple-flat", "count": 1 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "set_a" },
        { "id": "q2", "set_a": { "image": "asset-apple-flat", "count": 2 }, "set_b": { "image": "asset-apple-flat", "count": 4 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "set_b" },
        { "id": "q3", "set_a": { "image": "asset-apple-flat", "count": 3 }, "set_b": { "image": "asset-apple-flat", "count": 3 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "equal" }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "compare_sets", "range": [1, 6], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-star-flat", "count": 5 }, "set_b": { "image": "asset-star-flat", "count": 4 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "set_a" },
        { "id": "q2", "set_a": { "image": "asset-star-flat", "count": 4 }, "set_b": { "image": "asset-star-flat", "count": 4 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "equal" },
        { "id": "q3", "set_a": { "image": "asset-star-flat", "count": 2 }, "set_b": { "image": "asset-star-flat", "count": 6 }, "question_key": "count.which_less", "options": ["set_a", "set_b", "equal"], "answer": "set_a" }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "compare_sets", "range": [1, 6], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-ball-large", "count": 2 }, "set_b": { "image": "asset-ball-small", "count": 4 }, "question_key": "count.which_more_in_number", "options": ["set_a", "set_b", "equal"], "answer": "set_b" },
        { "id": "q2", "set_a": { "image": "asset-ball-large", "count": 3 }, "set_b": { "image": "asset-ball-small", "count": 3 }, "question_key": "count.which_more_in_number", "options": ["set_a", "set_b", "equal"], "answer": "equal" }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-apple-flat", "asset-star-flat", "asset-ball-large", "asset-ball-small"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5", "asset-vo-num-6", "asset-vo-more", "asset-vo-less", "asset-vo-equal"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-cq4-intro",
    "vo.instruction": "asset-vo-cq4-instruction",
    "vo.instruction_repeat": "asset-vo-cq4-instruction-slow",
    "vo.hint": "asset-vo-cq4-hint",
    "vo.recount": "asset-vo-recount",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**قواعد إلزامية:**
- `equal` في خيارات **كل** بند — وإلا تعلّم الطفل أن إحداهما دائمًا أكثر.
- **حالة تساوٍ** في كل مستوى.
- المستوى 3 يقيس **الحجم ≠ العدد**، والكرتان **نفس الشكل واللون** والفرق في الحجم فقط.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «أي مجموعة فيها أكثر؟» |
| `vo.hint` | «طابق واحدة مع واحدة.» |

---

## `lp-cwm-ep5`

**نمط بسيط** · `logic_pattern` · 3 مستويات · **أول حزمة `logic_pattern` لمسار البراعم**

```json
{
  "pack_version": 1,
  "engine_id": "logic_pattern",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "linear", "changing_dimensions": ["shape"],
      "sequence": ["asset-shape-star", "asset-shape-moon", "asset-shape-star", "asset-shape-moon", null],
      "options": ["asset-shape-star", "asset-shape-moon", "asset-shape-sun"],
      "answer": "asset-shape-star",
      "rule_key": "pattern.alternate_two",
      "require_explanation": false
    },
    {
      "level": 2, "mode": "linear_alt", "changing_dimensions": ["shape", "pattern"],
      "sequence": ["asset-circle-red-star", "asset-circle-blue-dot", "asset-circle-red-star", "asset-circle-blue-dot", null],
      "options": ["asset-circle-red-star", "asset-circle-blue-dot", "asset-circle-green-wave"],
      "answer": "asset-circle-red-star",
      "rule_key": "pattern.alternate_two",
      "require_explanation": false
    },
    {
      "level": 3, "mode": "linear_alt", "changing_dimensions": ["shape"],
      "sequence": ["asset-apple-flat", "asset-apple-flat", "asset-shape-star", "asset-apple-flat", "asset-apple-flat", null],
      "options": ["asset-apple-flat", "asset-shape-star", "asset-shape-moon"],
      "answer": "asset-shape-star",
      "rule_key": "pattern.two_one",
      "require_explanation": false
    }
  ],
  "assets": {
    "images": ["asset-shape-star", "asset-shape-moon", "asset-shape-sun", "asset-circle-red-star", "asset-circle-blue-dot", "asset-circle-green-wave", "asset-apple-flat", "asset-blank-slot"],
    "audio": []
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-lp5-intro",
    "vo.instruction": "asset-vo-lp5-instruction",
    "vo.instruction_repeat": "asset-vo-lp5-instruction-slow",
    "vo.hint": "asset-vo-lp5-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**قواعد إلزامية:**
- `require_explanation: false` — التعليل **لا يُطلب من البراعم**؛ يبدأ في `kids`.
- 🔴 كل عنصر مميّز بـ**شكل + نقش داخلي**، لا لون وحده. `asset-circle-red-star` بنجمة داخلية، و`asset-circle-blue-dot` بنقطة.
- المستوى 3 نمط **ثلاثي** يمنع التخمين بالتبادل.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «ما الشكل الذي يكمل النمط؟» |
| `vo.hint` | «ما الجزء الذي يعود دائمًا؟» |

---

## `cq-aon-ep1`

**عدّ النجوم** · `count_quantity` · 3 مستويات · **تقدير ثم عدّ**

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 7, "arranged": "row" }], "question_key": "count.how_many", "options": [6, 7, 8], "answer": 7 },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 9, "arranged": "row" }], "question_key": "count.how_many", "options": [8, 9, 10], "answer": 9 },
        { "id": "q3", "items": [{ "image": "asset-star-flat", "count": 10, "arranged": "row" }], "question_key": "count.how_many", "options": [9, 10, 11], "answer": 10 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 8, "scattered": true }], "question_key": "count.how_many", "options": [7, 8, 9], "answer": 8 },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 6, "scattered": true }], "question_key": "count.how_many", "options": [5, 6, 7], "answer": 6 },
        { "id": "q3", "items": [{ "image": "asset-star-flat", "count": 10, "scattered": true }], "question_key": "count.how_many", "options": [9, 10, 11], "answer": 10 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 9, "scattered": true }], "question_key": "count.estimate_then_count", "options": [8, 9, 10], "answer": 9, "estimate_first": true, "estimate_tolerance": 3 },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 7, "scattered": true }], "question_key": "count.estimate_then_count", "options": [6, 7, 8], "answer": 7, "estimate_first": true, "estimate_tolerance": 3 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-star-flat"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5", "asset-vo-num-6", "asset-vo-num-7", "asset-vo-num-8", "asset-vo-num-9", "asset-vo-num-10"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-aon1-intro",
    "vo.instruction": "asset-vo-aon1-instruction",
    "vo.instruction_repeat": "asset-vo-aon1-instruction-slow",
    "vo.hint": "asset-vo-aon1-hint",
    "vo.recount": "asset-vo-recount",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**`estimate_tolerance: 3`** — أي تقدير داخل ±3 **معقول ولا يُخصم منه**. التقدير لا يُصحَّح، بل يُقارن بالعدّ.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «عُدّ النجوم واختر العدد.» |
| `vo.instruction` (م3) | «قدّر أولًا، ثم عُدّ لتتحقّق.» |
| `vo.hint` | «رتّبها في صف، ثم عُدّ.» |

---

## `cq-aon-ep2`

**الفرق** · `count_quantity` · نمط `compare_sets` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "compare_sets", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-apple-flat", "count": 6 }, "set_b": { "image": "asset-apple-flat", "count": 4 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "set_a" },
        { "id": "q2", "set_a": { "image": "asset-apple-flat", "count": 5 }, "set_b": { "image": "asset-apple-flat", "count": 5 }, "question_key": "count.which_more", "options": ["set_a", "set_b", "equal"], "answer": "equal" },
        { "id": "q3", "set_a": { "image": "asset-apple-flat", "count": 3 }, "set_b": { "image": "asset-apple-flat", "count": 8 }, "question_key": "count.which_less", "options": ["set_a", "set_b", "equal"], "answer": "set_a" }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "compare_sets", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-orange-flat", "count": 7 }, "set_b": { "image": "asset-orange-flat", "count": 4 }, "question_key": "count.difference_how_much", "options": [2, 3, 4], "answer": 3 },
        { "id": "q2", "set_a": { "image": "asset-orange-flat", "count": 9 }, "set_b": { "image": "asset-orange-flat", "count": 5 }, "question_key": "count.difference_how_much", "options": [3, 4, 5], "answer": 4 },
        { "id": "q3", "set_a": { "image": "asset-orange-flat", "count": 6 }, "set_b": { "image": "asset-orange-flat", "count": 6 }, "question_key": "count.difference_how_much", "options": [0, 1, 2], "answer": 0 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "compare_sets", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-grape-flat", "count": 8 }, "set_b": { "image": "asset-grape-flat", "count": 3 }, "question_key": "count.how_many_to_equal", "options": [4, 5, 6], "answer": 5 },
        { "id": "q2", "set_a": { "image": "asset-grape-flat", "count": 6 }, "set_b": { "image": "asset-grape-flat", "count": 2 }, "question_key": "count.how_many_to_equal", "options": [3, 4, 5], "answer": 4 }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-apple-flat", "asset-orange-flat", "asset-grape-flat", "asset-match-line"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5", "asset-vo-num-6", "asset-vo-num-7", "asset-vo-num-8", "asset-vo-num-9", "asset-vo-num-10"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-aon2-intro",
    "vo.instruction": "asset-vo-aon2-instruction",
    "vo.instruction_repeat": "asset-vo-aon2-instruction-slow",
    "vo.hint": "asset-vo-aon2-hint",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**تدرّج:** م1 «أيهما أكثر؟» · م2 «**بكم** أكثر؟» · م3 «كم نضيف لنتساوى؟». الثالث **تطبيق للفرق** لا حساب له.

الفرق `0` خيار في م2 — التساوي فرق صفر، مفهوم مهم.

| المفتاح | النص |
|---|---|
| `vo.instruction` (م2) | «بكم مجموعة أكثر من الأخرى؟» |
| `vo.instruction` (م3) | «كم نضيف لتتساوى المجموعتان؟» |
| `vo.hint` | «طابق، وانظر ما تبقّى بلا زوج.» |

---

## `lp-aon-ep3`

**جسر الأشكال** · `logic_pattern` · 3 مستويات · **تعليل إلزامي**

```json
{
  "pack_version": 1,
  "engine_id": "logic_pattern",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "linear", "changing_dimensions": ["shape"],
      "sequence": ["asset-tile-triangle", "asset-tile-square", "asset-tile-triangle", "asset-tile-square", null],
      "options": ["asset-tile-triangle", "asset-tile-square", "asset-tile-circle"],
      "answer": "asset-tile-triangle",
      "rule_key": "pattern.alternate_two",
      "require_explanation": false
    },
    {
      "level": 2, "mode": "linear_alt", "changing_dimensions": ["shape"],
      "sequence": ["asset-tile-square", "asset-tile-triangle", "asset-tile-triangle", "asset-tile-square", "asset-tile-triangle", "asset-tile-triangle", "asset-tile-square", null],
      "options": ["asset-tile-triangle", "asset-tile-square", "asset-tile-circle"],
      "answer": "asset-tile-triangle",
      "rule_key": "pattern.one_two",
      "require_explanation": true,
      "explain_options": ["rule.one_two", "rule.alternate_two", "rule.new_shape"],
      "explain_answer": "rule.one_two"
    },
    {
      "level": 3, "mode": "linear_alt", "changing_dimensions": ["shape", "pattern"],
      "sequence": ["asset-tile-circle", "asset-tile-triangle", "asset-tile-square", "asset-tile-circle", "asset-tile-triangle", null],
      "options": ["asset-tile-square", "asset-tile-circle", "asset-tile-triangle"],
      "answer": "asset-tile-square",
      "rule_key": "pattern.cycle_three",
      "require_explanation": true,
      "explain_options": ["rule.cycle_three", "rule.alternate_two", "rule.random"],
      "explain_answer": "rule.cycle_three"
    }
  ],
  "assets": {
    "images": ["asset-tile-triangle", "asset-tile-square", "asset-tile-circle", "asset-blank-slot", "asset-frame-unit"],
    "audio": []
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-lp3-intro",
    "vo.instruction": "asset-vo-lp3-instruction",
    "vo.instruction_repeat": "asset-vo-lp3-instruction-slow",
    "vo.instruction_explain": "asset-vo-lp3-instruction-explain",
    "vo.hint_1": "asset-vo-lp3-hint1",
    "vo.hint_2": "asset-vo-lp3-hint2",
    "vo.explain_rule": "asset-vo-lp3-explain",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**قواعد إلزامية:**
- التعليل **إلزامي في م2 و م3** — الفرق الجوهري عن حزمة البراعم.
- `rule.new_shape` مشتّت في م2 — **خطأ عدّاد نفسه** من الحلقة.
- م3 دورة **ثلاثية** لا تبادل.
- 🔴 البلاطات مميّزة بـ**شكل + نقش**، لا لون وحده.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «استنتج القاعدة، ثم اختر البلاطة الناقصة.» |
| `vo.instruction_explain` | «الآن اختر القاعدة التي استخدمتها.» |
| `vo.hint_1` | «ما الجزء الذي يعود دائمًا؟» |
| `vo.hint_2` | «كم بلاطة في الوحدة التي تتكرر؟» |

---

## `cq-aon-ep4`

**الجمع** · `count_quantity` · 3 مستويات · **تحقق معقولية**

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-apple-flat", "count": 3 }, { "image": "asset-apple-flat", "count": 2 }], "question_key": "count.sum_how_many", "options": [4, 5, 6], "answer": 5, "show_symbolic": true },
        { "id": "q2", "items": [{ "image": "asset-apple-flat", "count": 4 }, { "image": "asset-apple-flat", "count": 3 }], "question_key": "count.sum_how_many", "options": [6, 7, 8], "answer": 7, "show_symbolic": true },
        { "id": "q3", "items": [{ "image": "asset-apple-flat", "count": 2 }, { "image": "asset-apple-flat", "count": 2 }], "question_key": "count.sum_how_many", "options": [3, 4, 5], "answer": 4, "show_symbolic": true }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-orange-flat", "count": 5 }, { "image": "asset-orange-flat", "count": 4 }], "question_key": "count.sum_how_many", "options": [8, 9, 10], "answer": 9, "show_symbolic": true },
        { "id": "q2", "items": [{ "image": "asset-orange-flat", "count": 6 }, { "image": "asset-orange-flat", "count": 3 }], "question_key": "count.sum_how_many", "options": [8, 9, 10], "answer": 9, "show_symbolic": true },
        { "id": "q3", "items": [{ "image": "asset-orange-flat", "count": 7 }, { "image": "asset-orange-flat", "count": 2 }], "question_key": "count.sum_how_many", "options": [8, 9, 10], "answer": 9, "show_symbolic": true }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-grape-flat", "count": 5 }, { "image": "asset-grape-flat", "count": 3 }], "question_key": "count.which_unreasonable", "options": [2, 8, 9], "answer": 2, "reasonableness_check": true, "explain_key": "rule.sum_greater" },
        { "id": "q2", "items": [{ "image": "asset-grape-flat", "count": 4 }, { "image": "asset-grape-flat", "count": 4 }], "question_key": "count.which_unreasonable", "options": [3, 8, 10], "answer": 3, "reasonableness_check": true, "explain_key": "rule.sum_greater" }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-apple-flat", "asset-orange-flat", "asset-grape-flat", "asset-symbol-plus", "asset-symbol-equals", "asset-basket-small", "asset-basket-large"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5", "asset-vo-num-6", "asset-vo-num-7", "asset-vo-num-8", "asset-vo-num-9", "asset-vo-num-10", "asset-vo-plus", "asset-vo-equals"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-aon4-intro",
    "vo.instruction": "asset-vo-aon4-instruction",
    "vo.instruction_repeat": "asset-vo-aon4-instruction-slow",
    "vo.hint": "asset-vo-aon4-hint",
    "vo.recount": "asset-vo-recount",
    "vo.explain_answer": "asset-vo-aon4-explain",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**قواعد إلزامية:**
- `show_symbolic: true` — الجملة الرمزية تظهر **بعد** الجواب الصحيح لا قبله.
- المستوى 3 **يقيس التحقق من المعقولية** لا الحساب: أي جواب أصغر من إحدى المجموعتين مستحيل.
- المجموع ≤ 10 في كل البنود.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «كم المجموع؟» |
| `vo.instruction` (م3) | «أي جواب غير منطقي؟» |
| `vo.hint` | «ضُمّ المجموعتين وعُدّ الكل.» |
| `vo.explain_answer` | «المجموع أكبر من كل مجموعة.» |

---

## `cq-aon-ep5`

**الطرح** · `count_quantity` · 3 مستويات · **بمعنيين**

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-cookie-flat", "count": 6, "removed": 2 }], "question_key": "count.remainder_how_many", "options": [3, 4, 5], "answer": 4, "subtraction_mode": "removal", "show_symbolic": true },
        { "id": "q2", "items": [{ "image": "asset-cookie-flat", "count": 8, "removed": 3 }], "question_key": "count.remainder_how_many", "options": [4, 5, 6], "answer": 5, "subtraction_mode": "removal", "show_symbolic": true },
        { "id": "q3", "items": [{ "image": "asset-cookie-flat", "count": 5, "removed": 1 }], "question_key": "count.remainder_how_many", "options": [3, 4, 5], "answer": 4, "subtraction_mode": "removal", "show_symbolic": true }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 2, "mode": "compare_sets", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "set_a": { "image": "asset-grape-flat", "count": 7 }, "set_b": { "image": "asset-grape-flat", "count": 4 }, "question_key": "count.difference_how_much", "options": [2, 3, 4], "answer": 3, "subtraction_mode": "difference", "show_symbolic": true },
        { "id": "q2", "set_a": { "image": "asset-grape-flat", "count": 9 }, "set_b": { "image": "asset-grape-flat", "count": 5 }, "question_key": "count.difference_how_much", "options": [3, 4, 5], "answer": 4, "subtraction_mode": "difference", "show_symbolic": true },
        { "id": "q3", "set_a": { "image": "asset-grape-flat", "count": 6 }, "set_b": { "image": "asset-grape-flat", "count": 2 }, "question_key": "count.difference_how_much", "options": [3, 4, 5], "answer": 4, "subtraction_mode": "difference", "show_symbolic": true }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    },
    {
      "level": 3, "mode": "count_and_pick", "range": [1, 10], "numeral_system": "auto",
      "items": [
        { "id": "q1", "items": [{ "image": "asset-star-flat", "count": 6, "removed": 2 }], "question_key": "count.which_unreasonable", "options": [4, 8, 3], "answer": 8, "reasonableness_check": true, "explain_key": "rule.diff_smaller" },
        { "id": "q2", "items": [{ "image": "asset-star-flat", "count": 9, "removed": 4 }], "question_key": "count.which_unreasonable", "options": [5, 13, 2], "answer": 13, "reasonableness_check": true, "explain_key": "rule.diff_smaller" }
      ],
      "count_aloud_on_error": true, "allow_recount_button": true
    }
  ],
  "assets": {
    "images": ["asset-cookie-flat", "asset-grape-flat", "asset-star-flat", "asset-plate", "asset-symbol-minus", "asset-symbol-equals", "asset-match-line"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5", "asset-vo-num-6", "asset-vo-num-7", "asset-vo-num-8", "asset-vo-num-9", "asset-vo-num-10", "asset-vo-minus", "asset-vo-equals", "asset-vo-remainder"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-aon5-intro",
    "vo.instruction": "asset-vo-aon5-instruction",
    "vo.instruction_repeat": "asset-vo-aon5-instruction-slow",
    "vo.hint": "asset-vo-aon5-hint",
    "vo.recount": "asset-vo-recount",
    "vo.explain_answer": "asset-vo-aon5-explain",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**قواعد إلزامية:**
- **المعنيان في مستويين منفصلين:** م1 `removal` · م2 `difference`. هذا جوهر الحلقة.
- م3 يقيس **التحقق**: الباقي أكبر من البداية مستحيل.
- العناصر المُزالة **تخرج من الكادر**، لا تُشطب ولا تُلوّن أحمر.

| المفتاح | النص |
|---|---|
| `vo.instruction` (م1) | «كم الباقي بعد أن خرجت؟» |
| `vo.instruction` (م2) | «بكم المجموعة الأولى أكثر؟» |
| `vo.instruction` (م3) | «أي جواب غير منطقي؟» |
| `vo.hint` (م1) | «عُدّ ما بقي في الطبق.» |
| `vo.hint` (م2) | «طابق، وانظر ما تبقّى بلا زوج.» |
| `vo.explain_answer` | «الباقي أصغر من البداية دائمًا.» |

---

## `cq-aon-ep6`

**الأنماط العددية** · `count_quantity` · نمط `pattern_fill` · 3 مستويات

```json
{
  "pack_version": 1,
  "engine_id": "count_quantity",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1, "mode": "pattern_fill", "range": [1, 20], "numeral_system": "auto",
      "items": [
        { "id": "p1", "sequence": [2, 4, 6, null], "options": [7, 8, 9], "answer": 8, "rule_key": "pattern.skip_2" },
        { "id": "p2", "sequence": [5, 10, 15, null], "options": [18, 20, 25], "answer": 20, "rule_key": "pattern.skip_5" },
        { "id": "p3", "sequence": [10, 12, 14, null], "options": [15, 16, 18], "answer": 16, "rule_key": "pattern.skip_2" }
      ]
    },
    {
      "level": 2, "mode": "pattern_fill", "range": [1, 20], "numeral_system": "auto",
      "items": [
        { "id": "p1", "sequence": [20, 18, 16, null], "options": [12, 14, 15], "answer": 14, "rule_key": "pattern.back_2" },
        { "id": "p2", "sequence": [15, 12, 9, null], "options": [5, 6, 7], "answer": 6, "rule_key": "pattern.back_3" },
        { "id": "p3", "sequence": [3, 6, 9, null], "options": [11, 12, 13], "answer": 12, "rule_key": "pattern.skip_3" }
      ]
    },
    {
      "level": 3, "mode": "pattern_fill", "range": [1, 20], "numeral_system": "auto",
      "items": [
        { "id": "p1", "sequence": [4, null, 12, 16], "options": [6, 8, 10], "answer": 8, "rule_key": "pattern.skip_4" },
        { "id": "p2", "sequence": [18, 15, null, 9], "options": [11, 12, 13], "answer": 12, "rule_key": "pattern.back_3" }
      ]
    }
  ],
  "assets": {
    "images": ["asset-step-stone", "asset-step-blank", "asset-arc-plus-2", "asset-arc-minus-2", "asset-arc-plus-3"],
    "audio": ["asset-vo-num-1", "asset-vo-num-2", "asset-vo-num-3", "asset-vo-num-4", "asset-vo-num-5", "asset-vo-num-6", "asset-vo-num-7", "asset-vo-num-8", "asset-vo-num-9", "asset-vo-num-10", "asset-vo-num-11", "asset-vo-num-12", "asset-vo-num-13", "asset-vo-num-14", "asset-vo-num-15", "asset-vo-num-16", "asset-vo-num-18", "asset-vo-num-20"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-aon6-intro",
    "vo.instruction": "asset-vo-aon6-instruction",
    "vo.instruction_repeat": "asset-vo-aon6-instruction-slow",
    "vo.hint": "asset-vo-aon6-hint",
    "vo.explain_answer": "asset-vo-aon6-explain",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

**تدرّج:** م1 تصاعدي · م2 **تنازلي** · م3 **الفراغ في الوسط لا النهاية** — أصعب لأنه يحتاج تطبيق القاعدة في اتجاهين.

المدى يتجاوز 10 إلى **20** — يحتاج مقاطع صوتية جديدة ١١–٢٠.

| المفتاح | النص |
|---|---|
| `vo.instruction` | «ما الرقم الناقص؟» |
| `vo.hint` | «كم نزيد أو ننقص بين كل رقمين؟» |
| `vo.explain_answer` | «المقدار ثابت في كل خطوة.» |

---

## مفاتيح ترجمة مشتركة

```
cwm.one_per_target              = ضع واحدًا لكل مكان.
cwm.how_many                    = كم العدد؟
cwm.drag_this_many              = اسحب هذا العدد.
count.how_many                  = كم العدد؟
count.which_more                = أي مجموعة فيها أكثر؟
count.which_less                = أي مجموعة فيها أقل؟
count.which_more_in_number      = أي مجموعة فيها أكثر عددًا؟
count.difference_how_much       = بكم مجموعة أكثر؟
count.how_many_to_equal         = كم نضيف لتتساوى المجموعتان؟
count.sum_how_many              = كم المجموع؟
count.remainder_how_many        = كم الباقي؟
count.estimate_then_count       = قدّر أولًا، ثم عُدّ.
count.which_unreasonable        = أي جواب غير منطقي؟
pattern.skip_2                  = وثب اثنين
pattern.skip_3                  = وثب ثلاثة
pattern.skip_4                  = وثب أربعة
pattern.skip_5                  = وثب خمسة
pattern.back_2                  = تنازلي باثنين
pattern.back_3                  = تنازلي بثلاثة
pattern.alternate_two           = شكلان يتبادلان
pattern.two_one                 = عنصران ثم واحد
pattern.one_two                 = واحد ثم عنصران
pattern.cycle_three             = دورة من ثلاثة
rule.sum_greater                = المجموع أكبر من كل مجموعة
rule.diff_smaller               = الباقي أصغر من البداية
rule.new_shape                  = شكل جديد لم يظهر
rule.random                     = بلا قاعدة
```

⚠️ **جمل العدد لا تُترجم حرفيًا.** قواعد التمييز وتذكير العدد تختلف جذريًا بين اللغات؛ كل لغة تُصاغ بقواعدها.

## أصوات مشتركة

| المعرف | النص |
|---|---|
| `asset-vo-level-complete` | «أكملت المستوى!» |
| `asset-vo-game-complete` | «انتهينا! لعب ممتاز.» |
| `asset-vo-exit-confirm` | «نتوقف الآن؟» |
| `asset-vo-recount` | «هيا نعدّ مرة أخرى.» |
| `asset-vo-num-1` … `-20` | مقاطع الأرقام **منفصلة إلزاميًا** |
| `asset-vo-plus` | «زائد» |
| `asset-vo-minus` | «ناقص» |
| `asset-vo-equals` | «يساوي» |

عبارات النجاح والمحاولة **لا تُوضع في الحزم** — تأتي من [طبقة التشجيع المشتركة](../../../games/04-encouragement-and-failure.md).

---

## معايير قبول الحزم

- [ ] الحزم الـ11 تجتاز مخططات [`schemas/`](../../../games/schemas/README.md).
- [ ] كل `asset-id` موجود في `content_assets` بحالة `ready`.
- [ ] `numeral_system: "auto"` في كل حزمة.
- [ ] **مقاطع الأرقام منفصلة** ١–٢٠، لا جملة واحدة مسجّلة.
- [ ] `equal` في خيارات كل بند مقارنة.
- [ ] **حالة تساوٍ** في كل حزمة مقارنة.
- [ ] `estimate_tolerance = 3` ولا يُخصم من التقدير.
- [ ] `require_explanation: false` في حزمة البراعم، `true` في `kids`.
- [ ] 🔴 عناصر `logic_pattern` مميّزة بـ**شكل + نقش**، لا لون وحده.
- [ ] `show_symbolic` يظهر **بعد** الجواب لا قبله.
- [ ] رمزا `+` و`−` و`=` عناصر رسومية لا نص، **لا تنعكس في RTL**.
- [ ] العناصر المُزالة **تخرج من الكادر**، لا تُشطب.
- [ ] الكرتان الكبيرة والصغيرة **نفس الشكل واللون**.
- [ ] `max_attempts = null` في كل الحزم.
- [ ] بديل السحب (لمس ← لمس) يعمل في حزم `drag_amount`.
- [ ] لا حزمة تحتوي عبارات تشجيع خاصة بها.
- [ ] زر «أعد العدّ» ظاهر في كل حزم `count_quantity`.
- [ ] اتجاه التسلسل والعدّ يتبع اتجاه القراءة.
- [ ] لا نص مطبوع في أي أصل صورة.
