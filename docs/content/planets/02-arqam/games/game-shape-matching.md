# مطابقة الأشكال — `game-shape-matching`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.**

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-shape-matching` |
| `title_ar` | مطابقة الأشكال |
| الكوكب | `arqam` |
| السلسلة | `adventures-of-numbers` — مغامرات الأرقام |
| `age_min` / `age_max` | 6 / 8 · المسار `kids` |
| `reading_level` / `interaction_mode` | `emerging` / `guided` |
| `supervision_level` / `difficulty` | `none` / `easy` |
| `max_attempts` | `null` |
| المحرك المُعتمد | `match_pairs` — النوع `relation` |
| المحرك القديم | `engine-match` ❌ لا عقد له |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `math.pattern.complete` |
| الحلقة المرتبطة | [الحلقة 3 — جسر الأشكال](../adventures-of-numbers/ep-03-shapes-bridge.md) |
| الهدف | يختار الطفل **الشكل الذي يكمل النمط** بحسب قاعدته، لا بالتخمين |
| المعيار | يكمل 3 من 4 أنماط شكلية صحيحة من أول محاولة |

الحلقة 3 هي جسر ببلاطات بنمط 🔺⬜🔺⬜🔺 وفيه **فراغ**، وقاعدتها: «البلاطة الخطأ لن تثبت — يجب أن نستنتج القاعدة أولًا». هذه اللعبة هي **الطبقة المطابقة** من الحلقة: ثلاثة صفوف جسر ناقصة، والطفل يضع في كل صفّ بلاطته الصحيحة.

> **ملاحظة قياس صريحة:** الحلقة 3 تطلب أيضًا **تعليل** القاعدة. التعليل **لا يُقاس في هذه اللعبة** — يقيسه الحزمة القائمة [`lp-aon-ep3`](../game-packs.md) على `logic_pattern` التي تفرض `require_explanation`. هذه اللعبة تقيس **تطبيق القاعدة** فقط، وهذا مذكور هنا حتى لا يُفترض غير ذلك.

## المحرك المختار وتبريره

**`match_pairs`** — عقد المحرك: [`01-match-pairs.md`](../../../../games/engines/01-match-pairs.md).

عقد المحرك ينصّ على أن مساره الأساسي `preschool` **«ويمتد إلى `kids`»** — وهذه اللعبة في 6–8، أي داخل الامتداد المعلن لا خارجه، فلا حاجة إلى توقيع توسيع فئة. ونوع الربط `relation` معلن في العقد («العنصر ← ما يرتبط به») وهو ما تحتاجه اللعبة: كل بلاطة تُربَط بـ**الصفّ الذي تكمل نمطه**، لا بمثيلها. والعقد يسمح بـ3 أهداف ثابتة و6 عناصر متحركة و3 مشتّتات، وهو ما يكفي لثلاثة أنماط ومشتّتين في المستوى الأخير. و`score` = الأزواج الصحيحة من أول محاولة، فيقيس تطبيق القاعدة مرة واحدة لكل نمط بلا تكرار محاولات مُحسَنة. اخترنا `match_pairs` لا `logic_pattern` لسببين: الأول أن `logic_pattern` **يفرض التعليل** في مستوياته 4 و5 وهو ما تقيسه حزمة أخرى قائمة بالفعل لهذه الحلقة، والثاني أن نبرة `logic_pattern` الصوتية مُصمَّمة لبنك `junior` «المحترم غير الطفولي» وهي غير مناسبة لطفل السادسة. ولأن `match_pairs` يعمل بلا مؤقت وبلا فشل ويقبل بديل السحب باللمس، فهو الأنسب لهذا العمر.

## الميكانيكا الأساسية

في الأعلى **صفوف جسر** (2–3) كل صفّ يعرض نمطًا متكرّرًا وفي آخره **فراغ واضح**. في الأسفل بلاطات بأشكال هندسية. يسحب الطفل كل بلاطة إلى الفراغ الذي تكمله، أو **يلمس البلاطة ثم يلمس الصفّ**. البلاطة الصحيحة تثبت وتُكمل الجسر بصريًا؛ الخطأ **لا يثبت** — وهذه استعارة الحلقة نفسها.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «هيا نكمل الجسر!»
2. `vo.instruction`: «انظر إلى نمط كل صفّ، ثم اسحب البلاطة التي تكمله.» + زر إعادة التعليمة.
3. عند لمس صفّ يُنطق نمطه بالتتابع: «مثلّث، مربّع، مثلّث، مربّع، …».
4. عند لمس بلاطة يُنطق اسم شكلها: «مثلّث».
5. الطفل يسحبها إلى الفراغ أو يلمس الصفّ.
6. **صحيح:** تثبت البلاطة، ويُنطق سبب صحّتها: «القاعدة: مثلّث ثم مربّع، فالناقص مثلّث.»
7. **غير صحيح:** ترتدّ البلاطة بلطف + عبارة محاولة. **لا صوت سلبي، ولا يُهدَم ما ثبت.**
8. اكتمال المستوى ← `vo.level_complete` · اكتمال اللعبة ← ملصق واحد.

## المستويات

| المستوى | الهدف | الأهداف (صفوف الجسر) | العناصر المتحركة | المشتّتات | شرط النجاح |
|---:|---|---:|---:|---:|---|
| 1 | نمط بوحدة من شكلين: ▲■▲■؟ | 2 | 2 | 0 | الصفّان مكتملان |
| 2 | ثلاثة أنماط بوحدة من شكلين | 3 | 3 | 0 | الصفوف الثلاثة مكتملة |
| 3 | ثلاثة أنماط + بلاطتان مشتّتتان | 3 | 5 | 2 | الصفوف الثلاثة مكتملة والمشتّتان غير مستخدمين |

**العناصر المتحركة تشمل المشتّتات، والحد الأقصى 6.** المشتّت في المستوى 3 شكل موجود في أنماط أخرى (فلا يُستبعد باللون أو بالغرابة) بل **بموضعه في القاعدة**.

## التدرّج في الصعوبة

عدد الأنماط أولًا (2 ← 3)، ثم إضافة مشتّتين. **وحدة النمط تبقى من شكلين في كل المستويات** — لا نمط ثلاثي هنا، لأن الوحدة الثلاثية تغيّر مستوى التجريد وتحتاج تعليلًا، وهو ما تقيسه حزمة `logic_pattern`. الأشكال كلها **بنفس اللون** في كل المستويات، وإلا صار التمييز بالشكل تمييزًا باللون. لا مؤقت.

## `instructions_ar` — كما يسمعها الطفل

> «الجسر ناقص بلاطات. انظر إلى نمط كل صفّ: ما الذي يتكرر؟ ثم اسحب البلاطة التي تكمله. البلاطة الخطأ لن تثبت، ولا بأس — جرّب غيرها.»

`vo.instruction_repeat` = النص نفسه أبطأ.

## منطق النجاح

- المستوى ينجح عندما **يكتمل كل صفّ ببلاطته الصحيحة**. لا مؤقت ولا حد محاولات.
- `score` = الأنماط المكتملة **من أول محاولة** · `max_score` = عدد الأنماط.
- `attempts` مرة واحدة لكل مستوى بـ`event_id` ثابت · `mastery` على `math.pattern.complete`.

## منطق الفشل

| المحاولة | ما يحدث |
|---:|---|
| 1 | البلاطة ترتدّ بلطف + عبارة محاولة من بنك `kids` · **ما ثبت يبقى ثابتًا** |
| 2 | يتوهّج الصفّ المقصود، ويُنطق نمطه من أوله |
| 3 | تُخفى البلاطات المشتّتة |
| 4 | توضع البلاطة تلقائيًا مع شرح القاعدة كاملة |
| 5+ | «نلعب شيئًا آخر؟» مع اقتراح أسهل — بلا وصف بالفشل |

**«البلاطة الخطأ لا تثبت» تعليم لا عقاب:** لا يُهدَم الجسر، ولا تُعاد المحاولة من الصفر، ولا يُعدّ الخطأ ظاهرًا للطفل.

## النقاط والمكافآت

لا نقاط ولا زمن ولا نسب للطفل. ملصق واحد عند إكمال اللعبة، لا يُفقد أبدًا. لا عملة ولا شراء ولا إعلانات ولا مقارنة. تقرير ولي الأمر: «يطبّق قاعدة النمط الشكلي؛ التعليل يُتابَع في حزمة الأنماط».

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح | «أحسنت، رتّبتها صح!» · «لاحظت الفرق، جيد جدًا!» — كل 2–3 نجاحات |
| محاولة | «ليست هذه، جرّب مرة أخرى» · «اقتربت! انظر للخطوة الأولى» |
| تلميح | «ما الذي يتكرر في هذا الصفّ؟ عُدّ من أوله.» — للقاعدة لا للجواب |
| شرح | «القاعدة: مثلّث ثم مربّع. آخر بلاطة مربّع، فالناقص مثلّث.» |
| إكمال اللعبة | «اكتمل الجسر! عمل منظم، أحسنت.» |

## إمكانية الوصول

- هدف اللمس **72dp** بحسب عقد `match_pairs`.
- **بديل السحب إلزامي:** لمس البلاطة ثم لمس الصفّ.
- 🔴 **الأشكال تُميَّز بالشكل — وكلها بنفس اللون.** ولا يُدلّ على الصحيح/الخطأ بالأحمر/الأخضر وحدهما.
- 🔴 **حواف الأشكال ناعمة** — لا شكل حادّ واقعي.
- وصف بديل لكل بلاطة ولكل صفّ («الصفّ الأول: مثلّث، مربّع، مثلّث، مربّع، فراغ»).
- ترتيب النمط **يُعرَض باتجاه القراءة**، والقاعدة تُنطق صريحة حتى لا يعتمد الفهم على الاتجاه وحده.
- لا مؤقت · لا وميض > 3Hz · `TextScaler` 2.0× · احترام «تقليل الحركة» · يعمل بالـD-pad.
- اللعبة **قابلة للعب بلا صوت** بالكامل — القاعدة مرئية.

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

مطابقة لـ[`match_pairs.v1.schema.json`](../../../../games/schemas/match_pairs.v1.schema.json). كل «هدف» صورة صفّ جسر ناقص، وكل «عنصر» بلاطة شكل.

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "match_type": "relation",
      "prompt_key": "aon.ep3.complete_bridge",
      "targets": [
        { "id": "t1", "image": "asset-bridge-row-tri-sq", "label_key": "pattern.row_triangle_square", "audio": "asset-vo-row-tri-sq" },
        { "id": "t2", "image": "asset-bridge-row-cir-sq", "label_key": "pattern.row_circle_square", "audio": "asset-vo-row-cir-sq" }
      ],
      "items": [
        { "id": "i1", "image": "asset-tile-triangle", "target": "t1", "label_key": "shape.triangle", "audio": "asset-vo-triangle" },
        { "id": "i2", "image": "asset-tile-circle", "target": "t2", "label_key": "shape.circle", "audio": "asset-vo-circle" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 2,
      "match_type": "relation",
      "prompt_key": "aon.ep3.complete_bridge",
      "targets": [
        { "id": "t1", "image": "asset-bridge-row-tri-sq", "label_key": "pattern.row_triangle_square", "audio": "asset-vo-row-tri-sq" },
        { "id": "t2", "image": "asset-bridge-row-cir-sq", "label_key": "pattern.row_circle_square", "audio": "asset-vo-row-cir-sq" },
        { "id": "t3", "image": "asset-bridge-row-sq-cir", "label_key": "pattern.row_square_circle", "audio": "asset-vo-row-sq-cir" }
      ],
      "items": [
        { "id": "i1", "image": "asset-tile-triangle", "target": "t1", "label_key": "shape.triangle", "audio": "asset-vo-triangle" },
        { "id": "i2", "image": "asset-tile-circle", "target": "t2", "label_key": "shape.circle", "audio": "asset-vo-circle" },
        { "id": "i3", "image": "asset-tile-square", "target": "t3", "label_key": "shape.square", "audio": "asset-vo-square" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 3,
      "match_type": "relation",
      "prompt_key": "aon.ep3.complete_bridge",
      "targets": [
        { "id": "t1", "image": "asset-bridge-row-tri-cir", "label_key": "pattern.row_triangle_circle", "audio": "asset-vo-row-tri-cir" },
        { "id": "t2", "image": "asset-bridge-row-sq-tri", "label_key": "pattern.row_square_triangle", "audio": "asset-vo-row-sq-tri" },
        { "id": "t3", "image": "asset-bridge-row-cir-sq", "label_key": "pattern.row_circle_square", "audio": "asset-vo-row-cir-sq" }
      ],
      "items": [
        { "id": "i1", "image": "asset-tile-triangle", "target": "t1", "label_key": "shape.triangle", "audio": "asset-vo-triangle" },
        { "id": "i2", "image": "asset-tile-square", "target": "t2", "label_key": "shape.square", "audio": "asset-vo-square" },
        { "id": "i3", "image": "asset-tile-circle", "target": "t3", "label_key": "shape.circle", "audio": "asset-vo-circle" }
      ],
      "distractors": [
        { "id": "d1", "image": "asset-tile-rhombus", "label_key": "shape.rhombus", "audio": "asset-vo-rhombus" },
        { "id": "d2", "image": "asset-tile-hexagon", "label_key": "shape.hexagon", "audio": "asset-vo-hexagon" }
      ],
      "shuffle": true
    }
  ],
  "assets": {
    "images": [
      "asset-bridge-row-tri-sq", "asset-bridge-row-cir-sq", "asset-bridge-row-sq-cir",
      "asset-bridge-row-tri-cir", "asset-bridge-row-sq-tri",
      "asset-tile-triangle", "asset-tile-circle", "asset-tile-square",
      "asset-tile-rhombus", "asset-tile-hexagon"
    ],
    "audio": [
      "asset-vo-row-tri-sq", "asset-vo-row-cir-sq", "asset-vo-row-sq-cir",
      "asset-vo-row-tri-cir", "asset-vo-row-sq-tri",
      "asset-vo-triangle", "asset-vo-circle", "asset-vo-square",
      "asset-vo-rhombus", "asset-vo-hexagon"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gsm-intro",
    "vo.instruction": "asset-vo-gsm-instruction",
    "vo.instruction_repeat": "asset-vo-gsm-instruction-slow",
    "vo.hint": "asset-vo-gsm-hint",
    "vo.retry": "asset-vo-retry-kids",
    "vo.correct": "asset-vo-correct-kids",
    "vo.explain_rule": "asset-vo-gsm-explain-rule",
    "vo.level_complete": "asset-vo-level-complete-kids",
    "vo.game_complete": "asset-vo-game-complete-kids",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — 5 صفوف جسر `1:1` + 5 بلاطات أشكال بنفس اللون + غلاف | ❌ مطلوب |
| `voice_prompts` — 10 مفاتيح + نطق كل نمط وكل شكل | ❌ مطلوب |
| `engine_implementation` — `match_pairs` | ❌ غير مُنفَّذ |
| ترحيل `engine_id` من `engine-match` إلى `match_pairs` | ❌ مطلوب |

🔴 **لا نصّ مطبوع داخل الصور.** 🔴 **الأشكال بنفس اللون في كل مستوى.**
