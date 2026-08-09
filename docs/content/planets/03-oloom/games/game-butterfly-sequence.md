# دورة الفراشة — `game-butterfly-sequence`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.**

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-butterfly-sequence` |
| `title_ar` | دورة الفراشة |
| الكوكب | `oloom` |
| السلسلة في قاعدة البيانات | `discover-your-body` — اكتشف جسمك ⚠️ **انظر «إشكال الإسناد» أدناه** |
| `age_min` / `age_max` | 6 / 8 · المسار `kids` |
| `reading_level` / `interaction_mode` | `emerging` / `guided` |
| `supervision_level` / `difficulty` | `recommended` / `medium` |
| `max_attempts` | `null` |
| المحرك المُعتمد | `sequence_order` — النوع `process` |
| المحرك القديم | `engine-sequence` ❌ لا عقد له ولا مخطط |

## ⚠️ إشكال الإسناد — قرار بشري مطلوب

اللعبة مُسندة في `0003_launch_content.sql` إلى `series-kids-body` أي [اكتشف جسمك](../series-bible-discover-body.md)، وهي سلسلة `knowledge` **عن جسم الإنسان وحده**: القلب · الحواس · التنفس · العظام · الطعام · النظافة. **لا تعلّم هذه السلسلة أي دورة حياة**، ولا تنشر هدفًا يقيس مراحل نمو كائن حي. وعنوان اللعبة وفنّها المطلوب (بيضة → يسروع → خادرة → فراشة) موضوع آخر.

المعالجة المعتمدة في هذه المواصفة:

| البند | القرار |
|---|---|
| العنوان والمعرّف والعمر | **يبقى كما هو** — لا نُعيد تسمية صفّ قائم |
| `objective_code` | `sci.observe.living_thing` — هدف قائم في **نفس الكوكب** من سلسلة [ألاحظ وأتعجّب · الحلقة 5](../alahiz-wa-ataajjab/ep-05-living-thing.md) |
| الحلقة المرتبطة الرسمية | `discover-your-body` الحلقة 5 (طعامي وطاقتي) — **سلسلة اللعبة في قاعدة البيانات**، وهي الحلقة التي تُبنى عليها حزمة `sequence_order` قائمة (`so-dyb-ep5`) وترتّب عملية بيولوجية |
| التوصية | 🔴 **إعادة إسناد اللعبة إلى سلسلة تعلّم دورات الحياة، أو إضافة حلقة دورة حياة إلى سلسلة علوم.** قرار تحريري لا يجوز لي حسمه، ومُدرَج في `open_questions` بالمانيفست |

المواصفة أدناه **صحيحة بنيويًا مع أي من الخيارين** لأنها لا تعتمد على نصّ حلقة بعينها، بل على مهارة **ترتيب مراحل عملية بيولوجية** — وهي مشتركة بين «رحلة الطعام» و«دورة الفراشة».

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `sci.observe.living_thing` |
| الهدف | يرتّب الطفل مراحل نمو الكائن الحي بالترتيب الصحيح، ويعرف أن الدورة **تُغلق** |
| المعيار | يرتّب دورة من 4 مراحل صحيحة في 3 من 4 محاولات |

## المحرك المختار وتبريره

**`sequence_order`** — عقد المحرك: [`06-sequence-order.md`](../../../../games/engines/06-sequence-order.md).

العقد يعلن أن مسار المحرك الأساسي **`kids`** وهو مسار اللعبة، وأن أحد أنواعه `process` بمثال حرفي «خطوات نمو النبات» — أي عملية بيولوجية متدرّجة، وهو نوع دورة الفراشة نفسه. والمخطط يقبل 3–6 لوحات ويربط كل لوحة بـ`position` مع `accepted_orders`، فيسمح بترتيب واحد صحيح حيث الترتيب واحد فعلًا. وسلوك الخطأ في العقد هو ما يجعله صالحًا لهذا العمر: **اللوحة الخاطئة تهتز وتعود، والصحيحة تثبت — لا إعادة من الصفر**. و`narrate_on_complete` يسرد الدورة كاملة بعد الإكمال، وهو التثبيت التعليمي المطلوب. `score = 1` عند الترتيب الصحيح و`max_score = 1`، فالقياس نظيف: الترتيب صحيح أو غير مكتمل. البديل `logic_pattern` مرفوض لأنه يقيس استنتاج قاعدة مجرّدة بلا زمن، و`match_pairs` لا يعبّر عن ترتيب إطلاقًا. المحرك القديم `engine-sequence` بلا مخطط ولا `accepted_orders` ولا سلّم مساعدة.

## الميكانيكا الأساسية

لوحات مبعثرة (3–5) تُرتَّب على شريط **يتبع اتجاه القراءة** (من اليمين لليسار في العربية). يسحب الطفل اللوحة إلى خانتها، أو **يلمس اللوحة ثم يلمس الخانة**. اللوحة الصحيحة تثبت وتبقى. بعد إكمال الترتيب يُسرَد التسلسل صوتيًا.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «هيا نرتّب المراحل!»
2. `vo.instruction`: «رتّب المراحل من البداية إلى النهاية.» + زر إعادة التعليمة الدائم.
3. عند لمس أي لوحة يُنطق وصفها: «بيضة صغيرة على ورقة».
4. الطفل يضع اللوحة في خانة.
5. **صحيح:** تثبت اللوحة بحركة لطيفة، والخانة التالية تصبح المتوقّعة.
6. **غير صحيح:** تهتز اللوحة وتعود، **وما ثبت يبقى ثابتًا** + عبارة محاولة. لا صوت سلبي.
7. عند اكتمال الترتيب: `vo.narrate_complete` سرد الدورة كاملة، ثم `vo.level_complete`.
8. المستوى 3 يضيف اللوحة الخامسة التي **تُغلق الدورة** (بيض جديد)، ويُنطق: «وتبدأ الدورة من جديد.»
9. بعد المستوى الثالث: `vo.game_complete` + ملصق واحد.

## المستويات

| المستوى | الهدف | اللوحات (العناصر) | المشتّتات | شرط النجاح |
|---:|---|---:|---:|---|
| 1 | ثلاث مراحل بفارق مرئي واضح جدًا: بيضة · يسروع · فراشة | 3 | 0 | الترتيب مطابق لـ`accepted_orders` |
| 2 | أربع مراحل — تُضاف **الخادرة** بين اليسروع والفراشة | 4 | 0 | الترتيب مطابق |
| 3 | خمس لوحات — تُضاف **بيض جديد** فتُغلق الدورة | 5 | 0 | الترتيب مطابق |

**لا مشتّتات في هذا المحرك** — كل لوحة جزء من التسلسل. الصعوبة من عدد اللوحات وقرب المراحل بصريًا. الحد الأقصى 6 لوحات.

## التدرّج في الصعوبة

ثلاث مراحل متباعدة بصريًا ← إضافة المرحلة **الأقرب التباسًا** (الخادرة، لأنها ساكنة وتشبه ورقة ملتوية) ← إغلاق الدورة بلوحة خامسة تعلّم أن الدورة **ليست خطًا ينتهي**. لا مؤقت في أي مستوى، ولا يُطلب في أي مستوى ذكر مدد زمنية بالأيام (تختلف بين الأنواع، ولا نُقرّر رقمًا غير موثق).

## `instructions_ar` — كما يسمعها الطفل

> «كل كائن حي يمرّ بمراحل. انظر إلى اللوحات، ورتّبها من البداية إلى النهاية. المس اللوحة لتسمع وصفها. اللوحة التي تثبت في مكانها الصحيح تبقى، فلا تقلق.»

`vo.instruction_repeat` = النص نفسه أبطأ.

## منطق النجاح

- المستوى ينجح عندما يطابق الترتيب أحد `accepted_orders`.
- `score` = 1 عند الترتيب الصحيح · `max_score` = 1 (بحسب [05](../../../../games/05-mastery-and-measurement.md)).
- `attempts` مرة واحدة لكل مستوى بـ`event_id` ثابت · `mastery` على `sci.observe.living_thing`.

## منطق الفشل

| المحاولة | ما يحدث |
|---:|---|
| 1 | اللوحة الخاطئة تهتز وتعود؛ **الصحيحة تثبت** · عبارة محاولة من بنك `kids` |
| 2 | توهّج الخانة الصحيحة للوحة المحمولة + `vo.hint` «ما الذي يحدث أولًا؟» |
| 3 | تثبيت أول لوحة صحيحة تلقائيًا |
| 4 | ترتيب كامل مع سرد صوتي للدورة |
| 5+ | «نلعب شيئًا آخر؟» مع اقتراح أسهل — بلا وصف بالفشل |

**لا إعادة من الصفر إطلاقًا**، ولا عدّ أخطاء ظاهر، ولا قفل محتوى.

## النقاط والمكافآت

لا نقاط ولا زمن ولا نسب للطفل. ملصق واحد عند إكمال اللعبة، لا يُفقد. لا عملة ولا شراء ولا إعلانات ولا مقارنة. تقرير ولي الأمر: «يرتّب مراحل نمو الكائن الحي؛ يحتاج تمييز مرحلة الخادرة».

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح | «أحسنت، رتّبتها صح!» · «تفكير ممتاز!» — كل 2–3 نجاحات |
| محاولة | «اقتربت! انظر للخطوة الأولى» · «حاول مرة أخرى، أنت تفهمها» |
| تلميح | «ما الذي يحدث أولًا؟ أصغر مرحلة تبدأ.» |
| سرد الإكمال | «البيضة تصير يسروعًا، ثم خادرة ساكنة، ثم فراشة تطير.» |
| المستوى 3 | «والفراشة تضع بيضًا جديدًا، فتبدأ الدورة من جديد.» |
| إكمال اللعبة | «رتّبتها صح! أحسنت.» |

## إمكانية الوصول

- هدف اللمس 64dp · **بديل السحب إلزامي:** لمس اللوحة ثم لمس الخانة.
- 🔴 **الاتجاه يتبع اللغة تلقائيًا** — الشريط من اليمين لليسار في العربية، ويُختبر في `ar` و`en` إلزاميًا.
- كل لوحة لها **نصّ مرئي ووصف بديل**، فاللعبة قابلة للعب بلا صوت.
- لا اعتماد على اللون: المراحل تختلف **شكلًا وحجمًا**، والخانة الصحيحة تُبرَز بإطار ورمز لا بلون وحده.
- لا مؤقت · لا وميض > 3Hz · `TextScaler` 2.0× · احترام «تقليل الحركة» · يعمل بالـD-pad.
- 🔴 **حدود التصوير:** الرسم رمزي مبسّط لا واقعي عياني، بلا ملمس لزج ولا تقريب مقزّز — بند مستعار من [قواعد كوكب علوم البصرية](../series-bible-discover-body.md).

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

مطابقة لـ[`sequence_order.v1.schema.json`](../../../../games/schemas/sequence_order.v1.schema.json).

```json
{
  "pack_version": 1,
  "engine_id": "sequence_order",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "sequence_type": "process",
      "prompt_key": "seq.butterfly_stages",
      "direction": "reading_order",
      "panels": [
        { "id": "p1", "image": "asset-bf-egg", "position": 1, "caption_key": "seq.bf.egg", "audio": "asset-vo-bf-egg" },
        { "id": "p2", "image": "asset-bf-caterpillar", "position": 2, "caption_key": "seq.bf.caterpillar", "audio": "asset-vo-bf-caterpillar" },
        { "id": "p3", "image": "asset-bf-butterfly", "position": 3, "caption_key": "seq.bf.butterfly", "audio": "asset-vo-bf-butterfly" }
      ],
      "accepted_orders": [["p1", "p2", "p3"]],
      "narrate_on_complete": true
    },
    {
      "level": 2,
      "sequence_type": "process",
      "prompt_key": "seq.butterfly_stages",
      "direction": "reading_order",
      "panels": [
        { "id": "p1", "image": "asset-bf-egg", "position": 1, "caption_key": "seq.bf.egg", "audio": "asset-vo-bf-egg" },
        { "id": "p2", "image": "asset-bf-caterpillar", "position": 2, "caption_key": "seq.bf.caterpillar", "audio": "asset-vo-bf-caterpillar" },
        { "id": "p3", "image": "asset-bf-chrysalis", "position": 3, "caption_key": "seq.bf.chrysalis", "audio": "asset-vo-bf-chrysalis" },
        { "id": "p4", "image": "asset-bf-butterfly", "position": 4, "caption_key": "seq.bf.butterfly", "audio": "asset-vo-bf-butterfly" }
      ],
      "accepted_orders": [["p1", "p2", "p3", "p4"]],
      "narrate_on_complete": true
    },
    {
      "level": 3,
      "sequence_type": "process",
      "prompt_key": "seq.butterfly_cycle_closes",
      "direction": "reading_order",
      "panels": [
        { "id": "p1", "image": "asset-bf-egg", "position": 1, "caption_key": "seq.bf.egg", "audio": "asset-vo-bf-egg" },
        { "id": "p2", "image": "asset-bf-caterpillar", "position": 2, "caption_key": "seq.bf.caterpillar", "audio": "asset-vo-bf-caterpillar" },
        { "id": "p3", "image": "asset-bf-chrysalis", "position": 3, "caption_key": "seq.bf.chrysalis", "audio": "asset-vo-bf-chrysalis" },
        { "id": "p4", "image": "asset-bf-butterfly", "position": 4, "caption_key": "seq.bf.butterfly", "audio": "asset-vo-bf-butterfly" },
        { "id": "p5", "image": "asset-bf-new-eggs", "position": 5, "caption_key": "seq.bf.new_eggs", "audio": "asset-vo-bf-new-eggs" }
      ],
      "accepted_orders": [["p1", "p2", "p3", "p4", "p5"]],
      "narrate_on_complete": true
    }
  ],
  "assets": {
    "images": [
      "asset-bf-egg", "asset-bf-caterpillar", "asset-bf-chrysalis",
      "asset-bf-butterfly", "asset-bf-new-eggs"
    ],
    "audio": [
      "asset-vo-bf-egg", "asset-vo-bf-caterpillar", "asset-vo-bf-chrysalis",
      "asset-vo-bf-butterfly", "asset-vo-bf-new-eggs"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gbs-intro",
    "vo.instruction": "asset-vo-gbs-instruction",
    "vo.instruction_repeat": "asset-vo-gbs-instruction-slow",
    "vo.hint": "asset-vo-gbs-hint",
    "vo.retry": "asset-vo-retry-kids",
    "vo.correct": "asset-vo-correct-kids",
    "vo.narrate_complete": "asset-vo-gbs-narrate",
    "vo.level_complete": "asset-vo-level-complete-kids",
    "vo.game_complete": "asset-vo-game-complete-kids",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — 5 لوحات `4:3` بأسلوب موحّد + غلاف | ❌ مطلوب |
| `voice_prompts` — 10 مفاتيح + وصف كل مرحلة + سرد الدورة | ❌ مطلوب |
| `engine_implementation` — `sequence_order` | ❌ غير مُنفَّذ |
| ترحيل `engine_id` من `engine-sequence` إلى `sequence_order` | ❌ مطلوب |
| **قرار تحريري على إسناد السلسلة** (انظر أعلى الملف) | ❌ مطلوب |
| مراجعة علمية لترتيب المراحل ومسمياتها العربية | ❌ مطلوب |

🔴 **لا نصّ مطبوع داخل اللوحات.** 🔴 **لا مدة زمنية بالأيام في أي تسمية** — لا نُقرّر رقمًا غير موثق.
