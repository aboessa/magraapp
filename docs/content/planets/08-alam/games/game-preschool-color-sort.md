# صنف الألوان — `game-preschool-color-sort`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.**

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-preschool-color-sort` |
| `title_ar` | صنف الألوان |
| الكوكب | `alam` — العالم حولنا |
| السلسلة | `colors-around-us` — ألوان حولنا |
| `age_min` / `age_max` | 3 / 5 · المسار `preschool` |
| `reading_level` / `interaction_mode` | `pre_reader` / `tap` |
| `supervision_level` / `difficulty` | `none` / `easy` |
| `max_attempts` | `null` |
| المحرك المُعتمد | `sort_bins` — المعيار `color` |
| المحرك القديم | `engine-match` ❌ لا عقد له، والتصنيف ليس مطابقة |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `world.color.sort_two` |
| الحلقة المرتبطة | [الحلقة 2 — صنّف لونين](../colors-around-us/ep-02-sort-two-colors.md) |
| الهدف | يضع الطفل الشيء مع مجموعة لونه |
| المعيار | يصنّف 6 عناصر صحيحة في 3 من 4 محاولات |

الحلقة 2 **ليست عن لونين جديدين، بل عن فكرة المجموعة**: «ضعه مع ما يشبهه» لا «سمِّ اللون». اللعبة تقيس هذا المفهوم نفسه: التجميع بخصيصة واحدة.

## المحرك المختار وتبريره

**`sort_bins`** — عقد المحرك: [`03-sort-bins.md`](../../../../games/engines/03-sort-bins.md).

مسار المحرك الأساسي `preschool`، وهو المسار المطلوب هنا، فلا توسيع فئة. والعقد يعلن `criterion_type` بقيمة `color` ويجعل مستواه الأول «لون واحد مقابل آخر» بسلتين وأربعة عناصر — وهو تطابق حرفي مع حلقة «صنّف لونين». والأهم أن العقد يفرض **بندًا لا يمكن تجاهله**: السلة تُميَّز بـ**صورة ونصّ وصوت لا باللون وحده**، وهو ما يجعل اللعبة صالحة لطفل عمى الألوان — وهذه هي الحزمة التي فيها هذا البند أثقل من أي حزمة أخرى. العقد يوفّر كذلك `explain_on_correct` («التفاحة حمراء، فتذهب هنا») وهو التثبيت اللفظي الذي تطلبه الحلقة، و`score` = العناصر الصحيحة من أول محاولة وهو نفس معيار الحلقة. `match_pairs` يطابق مثيلًا بمثيل ولا يبني فكرة المجموعة، فـ`sort_bins` هو المحرك الصحيح لا البديل المقبول.

## الميكانيكا الأساسية

سلتان إلى ثلاث، كل سلة **بصورة ونصّ وصوت وشكل مقترن**، وأربعة إلى ثمانية عناصر. يسحب الطفل كل عنصر إلى سلته، أو **يلمس العنصر ثم يلمس السلة**. العنصر الصحيح يستقر داخل السلة بصريًا مع شرح صوتي قصير.

### 🔴 الاقتران لون–شكل — إلزامي

من [دليل سلسلة ألوان حولنا](../series-bible-colors-around-us.md): **أصفر = دائرة · أحمر = مثلّث · أزرق = مربّع**. الاقتران ثابت في كل مستوى، ويجعل التمييز ممكنًا **بلا لون**.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «هيا نرتّب معًا!»
2. `vo.instruction`: «ضع كل شيء أحمر في السلة الحمراء.» + زر إعادة التعليمة الدائم.
3. عند لمس السلة يُنطق اسمها: «الأصفر» · «الأحمر».
4. عند لمس العنصر يُنطق اسمه: «تفاحة».
5. الطفل يسحب العنصر أو يلمس السلة بعده.
6. **صحيح:** يستقر العنصر داخل السلة + `vo.explain_correct` «التفاحة حمراء، فتذهب هنا.»
7. **غير صحيح:** ارتداد لطيف + عبارة محاولة. **لا صوت سلبي.**
8. اكتمال المستوى ← `vo.level_complete` · اكتمال اللعبة ← «رتّبتها كلها! أحسنت.» + ملصق.

## المستويات

| المستوى | الهدف | السلات | العناصر | المشتّتات | شرط النجاح |
|---:|---|---:|---:|---:|---|
| 1 | لونان متقابلان: أصفر/دائرة مقابل أحمر/مثلّث | 2 | 4 | 0 | العناصر الأربعة في سلاتها |
| 2 | اللونان نفسهما بعناصر أكثر تنوعًا | 2 | 6 | 0 | العناصر الستة في سلاتها |
| 3 | ثلاثة ألوان: + أزرق/مربّع | 3 | 6 | 0 | العناصر الستة في سلاتها |

**لا مشتّتات في هذا المحرك** — كل عنصر له سلة صحيحة. الصعوبة من عدد السلات وعدد العناصر. الحد الأقصى: 8 عناصر + 3 سلات.

## التدرّج في الصعوبة

لونان ← لونان بعناصر أكثر ← ثلاثة ألوان. المستوى 3 هو الأصعب لأن ثلاث سلات تحتاج **مقارنتين لا واحدة**. لا يُخلط معيار ثانٍ (شكل أو حجم) في أي مستوى — الحزمة تعلّم خصيصة واحدة، والخصيصتان معًا حزمة لاحقة. لا مؤقت.

## `instructions_ar` — كما يسمعها الطفل

> «هيا نرتّب معًا! هذه سلة الأصفر، وهذه سلة الأحمر. المس السلة لتسمع اسمها. ثم ضع كل شيء مع سلة لونه. لا نستعجل.»

`vo.instruction_repeat` = النص نفسه أبطأ 15%.

## منطق النجاح

- المستوى ينجح عندما **يستقر كل عنصر في سلته الصحيحة**. لا مؤقت ولا حد محاولات.
- `score` = العناصر الصحيحة **من أول محاولة** · `max_score` = عدد العناصر.
- `attempts` مرة واحدة لكل مستوى · `mastery` على `world.color.sort_two`.

## منطق الفشل

| المحاولة | ما يحدث |
|---:|---|
| 1 | ارتداد لطيف + عبارة محاولة من بنك `preschool` |
| 2 | **توهّج السلة الصحيحة** + `vo.hint` «انظر إلى اللون مرة أخرى.» |
| 3 | إخفاء سلة خاطئة (تقليل الاختيار) |
| 4 | نقل تلقائي مع شرح: «التفاحة حمراء، فتذهب هنا.» |
| 5+ | اقتراح لعبة أسهل — **بلا أي وصف بالفشل** |

لا كلمة «خطأ»، ولا عدّ أخطاء ظاهر، ولا قفل محتوى. بعد التبسيط يُشجَّع النجاح كاملًا.

## النقاط والمكافآت

لا نقاط ولا زمن للطفل. ملصق واحد عند إكمال اللعبة، لا يُفقد أبدًا. لا عملة ولا شراء ولا إعلانات ولا مقارنة بأطفال آخرين. تقرير ولي الأمر: «يجمع الأشياء بلونها؛ يحتاج تدريبًا عند ثلاث مجموعات».

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح | «نعم، صحيح!» · «جميل جدًا!» — كل 2–3 نجاحات |
| محاولة | «لا بأس، حاول» · «انظر مرة أخرى» — لا كلمة «خطأ» |
| شرح عند الصحيح | «التفاحة حمراء، فتذهب مع الأحمر.» |
| تلميح | «انظر إلى لون السلة، وإلى شكلها أيضًا.» |
| إكمال اللعبة | «رتّبتها كلها! أحسنت.» |

## إمكانية الوصول

- هدف اللمس **64dp** (حد `preschool`).
- 🔴 **السلة بصورة + نصّ + صوت + شكل مقترن — لا باللون وحده.** بند من عقد المحرك، وهو شرط قبول الحزمة.
- 🔴 **العناصر داخل كل لون متنوعة الشكل** لكن السلة تحمل شكلها المقترن، فيبقى للطفل الذي لا يميّز اللون **دليل غير لوني**.
- **بديل السحب إلزامي:** لمس العنصر ثم لمس السلة.
- وصف بديل لكل عنصر ولكل سلة · ترتيب قراءة منطقي RTL/LTR.
- لا مؤقت · لا وميض > 3Hz · `TextScaler` 2.0× · احترام «تقليل الحركة» · يعمل بالـD-pad.
- 🔴 **لا بطاقة شمس في أي مستوى** — بند سلامة مُستعار من [الحلقة 1](../colors-around-us/ep-01-find-yellow.md): الحزمة تُلعَب مرارًا، وبطاقة شمس فيها تُبطل حذفها من الحلقة.
- 🔴 **لا أشياء صغيرة تُبلَع** في أي نشاط عائلي مرتبط — بند سلامة من الحلقة 2.

## `help_system`

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

## حزمة المحتوى — `content_pack`

مطابقة لـ[`sort_bins.v1.schema.json`](../../../../games/schemas/sort_bins.v1.schema.json).

```json
{
  "pack_version": 1,
  "engine_id": "sort_bins",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "criterion_key": "sort.by_color",
      "criterion_type": "color",
      "bins": [
        { "id": "b1", "label_key": "color.yellow", "image": "asset-bin-yellow-circle", "audio": "asset-vo-color-yellow" },
        { "id": "b2", "label_key": "color.red", "image": "asset-bin-red-triangle", "audio": "asset-vo-color-red" }
      ],
      "items": [
        { "id": "i1", "image": "asset-banana", "bin": "b1", "label_key": "object.banana", "audio": "asset-vo-banana", "explain_audio": "asset-vo-explain-banana" },
        { "id": "i2", "image": "asset-lemon", "bin": "b1", "label_key": "object.lemon", "audio": "asset-vo-lemon", "explain_audio": "asset-vo-explain-lemon" },
        { "id": "i3", "image": "asset-apple-red", "bin": "b2", "label_key": "object.apple", "audio": "asset-vo-apple", "explain_audio": "asset-vo-explain-apple" },
        { "id": "i4", "image": "asset-tomato", "bin": "b2", "label_key": "object.tomato", "audio": "asset-vo-tomato", "explain_audio": "asset-vo-explain-tomato" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    },
    {
      "level": 2,
      "criterion_key": "sort.by_color",
      "criterion_type": "color",
      "bins": [
        { "id": "b1", "label_key": "color.yellow", "image": "asset-bin-yellow-circle", "audio": "asset-vo-color-yellow" },
        { "id": "b2", "label_key": "color.red", "image": "asset-bin-red-triangle", "audio": "asset-vo-color-red" }
      ],
      "items": [
        { "id": "i1", "image": "asset-banana", "bin": "b1", "label_key": "object.banana", "audio": "asset-vo-banana", "explain_audio": "asset-vo-explain-banana" },
        { "id": "i2", "image": "asset-lemon", "bin": "b1", "label_key": "object.lemon", "audio": "asset-vo-lemon", "explain_audio": "asset-vo-explain-lemon" },
        { "id": "i3", "image": "asset-duckling", "bin": "b1", "label_key": "object.duckling", "audio": "asset-vo-duckling", "explain_audio": "asset-vo-explain-duckling" },
        { "id": "i4", "image": "asset-apple-red", "bin": "b2", "label_key": "object.apple", "audio": "asset-vo-apple", "explain_audio": "asset-vo-explain-apple" },
        { "id": "i5", "image": "asset-tomato", "bin": "b2", "label_key": "object.tomato", "audio": "asset-vo-tomato", "explain_audio": "asset-vo-explain-tomato" },
        { "id": "i6", "image": "asset-ladybird", "bin": "b2", "label_key": "object.ladybird", "audio": "asset-vo-ladybird", "explain_audio": "asset-vo-explain-ladybird" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    },
    {
      "level": 3,
      "criterion_key": "sort.by_color",
      "criterion_type": "color",
      "bins": [
        { "id": "b1", "label_key": "color.yellow", "image": "asset-bin-yellow-circle", "audio": "asset-vo-color-yellow" },
        { "id": "b2", "label_key": "color.red", "image": "asset-bin-red-triangle", "audio": "asset-vo-color-red" },
        { "id": "b3", "label_key": "color.blue", "image": "asset-bin-blue-square", "audio": "asset-vo-color-blue" }
      ],
      "items": [
        { "id": "i1", "image": "asset-banana", "bin": "b1", "label_key": "object.banana", "audio": "asset-vo-banana", "explain_audio": "asset-vo-explain-banana" },
        { "id": "i2", "image": "asset-lemon", "bin": "b1", "label_key": "object.lemon", "audio": "asset-vo-lemon", "explain_audio": "asset-vo-explain-lemon" },
        { "id": "i3", "image": "asset-apple-red", "bin": "b2", "label_key": "object.apple", "audio": "asset-vo-apple", "explain_audio": "asset-vo-explain-apple" },
        { "id": "i4", "image": "asset-ladybird", "bin": "b2", "label_key": "object.ladybird", "audio": "asset-vo-ladybird", "explain_audio": "asset-vo-explain-ladybird" },
        { "id": "i5", "image": "asset-blue-ball", "bin": "b3", "label_key": "object.ball", "audio": "asset-vo-ball", "explain_audio": "asset-vo-explain-ball" },
        { "id": "i6", "image": "asset-blue-cup", "bin": "b3", "label_key": "object.cup", "audio": "asset-vo-cup", "explain_audio": "asset-vo-explain-cup" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    }
  ],
  "assets": {
    "images": [
      "asset-bin-yellow-circle", "asset-bin-red-triangle", "asset-bin-blue-square",
      "asset-banana", "asset-lemon", "asset-duckling",
      "asset-apple-red", "asset-tomato", "asset-ladybird",
      "asset-blue-ball", "asset-blue-cup"
    ],
    "audio": [
      "asset-vo-color-yellow", "asset-vo-color-red", "asset-vo-color-blue",
      "asset-vo-banana", "asset-vo-lemon", "asset-vo-duckling",
      "asset-vo-apple", "asset-vo-tomato", "asset-vo-ladybird",
      "asset-vo-ball", "asset-vo-cup",
      "asset-vo-explain-banana", "asset-vo-explain-lemon", "asset-vo-explain-duckling",
      "asset-vo-explain-apple", "asset-vo-explain-tomato", "asset-vo-explain-ladybird",
      "asset-vo-explain-ball", "asset-vo-explain-cup"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gcs-intro",
    "vo.instruction": "asset-vo-gcs-instruction",
    "vo.instruction_repeat": "asset-vo-gcs-instruction-slow",
    "vo.hint": "asset-vo-gcs-hint",
    "vo.retry": "asset-vo-retry-preschool",
    "vo.correct": "asset-vo-correct-preschool",
    "vo.level_complete": "asset-vo-level-complete",
    "vo.game_complete": "asset-vo-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — 3 سلات بشكل مقترن + 8 عناصر `1:1` شفافة + غلاف | ❌ مطلوب |
| `voice_prompts` — 9 مفاتيح + اسم كل سلة وعنصر + شرح لكل عنصر | ❌ مطلوب |
| `engine_implementation` — `sort_bins` | ❌ غير مُنفَّذ |
| ترحيل `engine_id` من `engine-match` إلى `sort_bins` | ❌ مطلوب |

🔴 **لا نصّ مطبوع داخل الصور.** 🔴 **لا بطاقة شمس.** 🔴 **حواف الأشكال ناعمة — لا شكل حادّ واقعي.**
