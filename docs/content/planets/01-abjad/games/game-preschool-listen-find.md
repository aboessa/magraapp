# استمع وابحث — `game-preschool-listen-find`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.**

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-preschool-listen-find` |
| `title_ar` | استمع وابحث |
| الكوكب | `abjad` |
| السلسلة | `luna-discovers-words` |
| `age_min` / `age_max` | 3 / 5 · المسار `preschool` |
| `reading_level` / `interaction_mode` | `pre_reader` / `tap` |
| `supervision_level` / `difficulty` | `none` / `easy` |
| `max_attempts` | `null` |
| المحرك المُعتمد | `match_pairs` — النوع `sound_image` |
| المحرك القديم | `engine-match` ❌ لا عقد له |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `lang.vocab.match_word_image` |
| الحلقة المرتبطة | [الحلقة 2 — استمع وابحث](../luna-discovers-words/ep-02-listen-and-find.md) |
| الهدف | يربط الطفل الكلمة **المنطوقة** بصورة الشيء بلا صورة وسيطة |
| المعيار | يختار 3 من 4 كلمات صحيحة **من أول استماع** |

المفردات هي مفردات الحلقة نفسها: **شمس · ماء · زهرة · باب** — اختيرت في الحلقة لأن أصواتها الأولى مختلفة تمامًا (ش/م/ز/ب) فلا يلتبس الطفل. اللعبة لا تضيف كلمة واحدة من خارج الحلقة.

## المحرك المختار وتبريره

**`match_pairs`** — عقد المحرك: [`01-match-pairs.md`](../../../../games/engines/01-match-pairs.md).

العقد يعلن `sound_image` نوع ربط مدعومًا صريحًا («كلمة منطوقة ‹قطة› ← صورة القطة») ويعطيه التعليمة الجاهزة «استمع، ثم اسحب الصورة الصحيحة»، وهو بالضبط انتقال الحلقة 2 من التمثيل البصري إلى التمثيل الصوتي. المسار الأساسي للمحرك `preschool`، وهو بلا مؤقت وبلا فشل وبهدف لمس 72dp، فيناسب عمر 3–5 بلا أي توسيع فئة. والعقد يشترط في المستوى المعتمد على الصوت **بديلًا بصريًا**، وهو ما تنفّذه هذه الحزمة عبر بطاقة الصوت المرقّمة والمشكَّلة (لا الملوَّنة وحدها) وزر إعادة النطق. `score` = الأزواج الصحيحة من أول محاولة، وهو نفس معيار الحلقة «3 من 4 من أول استماع». لا محرك آخر من الاثني عشر يجمع «صوت ← صورة» في مسار البراعم: `sort_bins` يصنّف بخصيصة لا يطابق نطقًا، و`word_build` يبني الحروف وهو `kids` ولمن يعرف الحروف.

## الميكانيكا الأساسية

في الأعلى **بطاقتان إلى ثلاث «بطاقات صوت»** — كل بطاقة تنطق كلمة واحدة عند لمسها، ولها رقم وشكل مميّز. في الأسفل صور الأشياء. يلمس الطفل بطاقة الصوت ليسمع «شَمس»، ثم يسحب صورة الشمس إليها، أو يلمس الصورة ثم يلمس البطاقة.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «هيا نلعب معًا! اليوم نلعب بأذنينا.»
2. `vo.instruction`: «استمع، ثم اسحب الصورة الصحيحة.» + زر إعادة التعليمة الدائم.
3. تُنطق كلمة البطاقة الأولى تلقائيًا مرة واحدة.
4. الطفل يلمس البطاقة **متى شاء** لإعادة سماع الكلمة — **لا حد لعدد مرات الاستماع**.
5. يسحب الصورة إلى البطاقة أو يلمس الصورة ثم البطاقة.
6. **صحيح:** تستقر الصورة على البطاقة، وتُعاد الكلمة مقترنة بالصورة، وتشجيع كل 2–3 نجاحات.
7. **غير صحيح:** ترتدّ الصورة بلطف + عبارة محاولة. **لا صوت سلبي.**
8. اكتمال المستوى ← `vo.level_complete`؛ اكتمال اللعبة ← `vo.game_complete` + ملصق.

## المستويات

| المستوى | الهدف | بطاقات الصوت | العناصر المتحركة | المشتّتات | شرط النجاح |
|---:|---|---:|---:|---:|---|
| 1 | كلمتان مختلفتان تمامًا في الصوت الأول | 2 | 2 | 0 | الزوجان صحيحان |
| 2 | ثلاث كلمات من الحلقة | 3 | 3 | 0 | الأزواج الثلاثة صحيحة |
| 3 | ثلاث كلمات + صورة مشتّتة واحدة | 3 | 4 | 1 | الأزواج الثلاثة صحيحة |

## التدرّج في الصعوبة

بُعد واحد في كل مستوى: عدد الكلمات (2 ← 3)، ثم مشتّت بصري واحد. **الكلمات نفسها لا تصعب** — تبقى أحادية أو ثنائية المقطع من الحلقة، لأن الصعوبة المقصودة هي التمييز السمعي لا طول الكلمة. لا مؤقت.

## `instructions_ar` — كما يسمعها الطفل

> «هيا نلعب بأذنينا! المس البطاقة لتسمع الكلمة. ثم اسحب الصورة الصحيحة إليها. اسمع كما تحب، لا نستعجل.»

`vo.instruction_repeat` = النص نفسه أبطأ 15%.

## منطق النجاح

- المستوى ينجح باستقرار كل صورة على بطاقة كلمتها.
- `score` = الأزواج الصحيحة من أول محاولة · `max_score` = عدد الأزواج.
- `attempts` مرة واحدة لكل مستوى بـ`event_id` ثابت · `mastery` على `lang.vocab.match_word_image`.

## منطق الفشل

لا فشل ولا قفل ولا عدّ أخطاء ظاهر. السلّم المركزي لـ[04](../../../../games/04-encouragement-and-failure.md):

| المحاولة | ما يحدث |
|---:|---|
| 1 | ارتداد لطيف + عبارة محاولة، و**إعادة نطق الكلمة تلقائيًا** |
| 2 | توهّج البطاقة الصحيحة نبضتين + `vo.hint` بالصوت الأول: «الكلمة تبدأ بـ شـ» |
| 3 | إخفاء المشتّت وإبقاء الزوج الصحيح |
| 4 | نقل تلقائي مع شرح: «هذه شَمس.» |
| 5+ | اقتراح لعبة أسهل بلا أي وصف بالفشل |

## النقاط والمكافآت

لا نقاط ولا زمن ولا دقة معروضة للطفل. ملصق واحد عند إكمال اللعبة، لا يُفقد أبدًا. لا عملة ولا شراء ولا إعلانات ولا مقارنة. تقرير ولي الأمر: «يميّز الكلمات المنطوقة الأربع؛ يحتاج تكرار سماع في كلمة واحدة».

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح | «نعم، صحيح!» · «وجدتها!» · «هكذا تمامًا!» بلا تكرار متتالٍ |
| محاولة | «هيا نجرب غيرها» · «انظر مرة أخرى» — لا كلمة «خطأ» |
| تلميح | «استمع للصوت الأول: شـ… شَمس.» |
| بعد الصحيح | «شَمس. أحسنت.» — تثبيت الاقتران صوت↔صورة |
| إكمال اللعبة | «انتهينا! كان لعبًا جميلًا.» |

## إمكانية الوصول

- هدف لمس 72dp · بديل السحب إلزامي (لمس ثم لمس) · لا مؤقت · لا وميض > 3Hz.
- بطاقات الصوت تُميَّز بـ**رقم وشكل** لا بلون وحده، ولها وصف بديل لقارئ الشاشة.
- زر «أعد الكلمة» ظاهر دائمًا وبلا حد استخدام.
- `TextScaler` 2.0× · احترام «تقليل الحركة» · يعمل بالـD-pad على TV.
- 🔴 **قيد معلن:** هذه الحزمة **`requires_audio: true`** — قواعدها سمعية بطبيعتها. البديل البصري المتاح هو عرض الكلمة **مكتوبة** على بطاقة الصوت عند تفعيل وضع «بلا صوت»، وهو بديل ناقص لطفل ما قبل القراءة الذي لا يسمع. لذلك **تُعرَض [طابق الصورة](./game-preschool-picture-match.md) كبديل مكافئ في الكتالوج**، وهي تقيس الهدف نفسه بصريًا بالكامل. هذا القيد **مذكور صريحًا** ولا يُعتبر مُحلولًا.

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

مطابقة لـ[`match_pairs.v1.schema.json`](../../../../games/schemas/match_pairs.v1.schema.json).

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "match_type": "sound_image",
      "prompt_key": "luna.ep2.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-sound-card-1", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "t2", "image": "asset-sound-card-2", "label_key": "word.water", "audio": "asset-vo-word-water" }
      ],
      "items": [
        { "id": "i1", "image": "asset-sun", "target": "t1", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "i2", "image": "asset-water", "target": "t2", "label_key": "word.water", "audio": "asset-vo-word-water" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 2,
      "match_type": "sound_image",
      "prompt_key": "luna.ep2.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-sound-card-1", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "t2", "image": "asset-sound-card-2", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "t3", "image": "asset-sound-card-3", "label_key": "word.door", "audio": "asset-vo-word-door" }
      ],
      "items": [
        { "id": "i1", "image": "asset-sun", "target": "t1", "label_key": "word.sun", "audio": "asset-vo-word-sun" },
        { "id": "i2", "image": "asset-flower", "target": "t2", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "i3", "image": "asset-door", "target": "t3", "label_key": "word.door", "audio": "asset-vo-word-door" }
      ],
      "distractors": [],
      "shuffle": true
    },
    {
      "level": 3,
      "match_type": "sound_image",
      "prompt_key": "luna.ep2.listen_and_find",
      "targets": [
        { "id": "t1", "image": "asset-sound-card-1", "label_key": "word.water", "audio": "asset-vo-word-water" },
        { "id": "t2", "image": "asset-sound-card-2", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "t3", "image": "asset-sound-card-3", "label_key": "word.door", "audio": "asset-vo-word-door" }
      ],
      "items": [
        { "id": "i1", "image": "asset-water", "target": "t1", "label_key": "word.water", "audio": "asset-vo-word-water" },
        { "id": "i2", "image": "asset-flower", "target": "t2", "label_key": "word.flower", "audio": "asset-vo-word-flower" },
        { "id": "i3", "image": "asset-door", "target": "t3", "label_key": "word.door", "audio": "asset-vo-word-door" }
      ],
      "distractors": [
        { "id": "d1", "image": "asset-sun", "label_key": "word.sun", "audio": "asset-vo-word-sun" }
      ],
      "shuffle": true
    }
  ],
  "assets": {
    "images": [
      "asset-sound-card-1", "asset-sound-card-2", "asset-sound-card-3",
      "asset-sun", "asset-water", "asset-flower", "asset-door"
    ],
    "audio": [
      "asset-vo-word-sun", "asset-vo-word-water",
      "asset-vo-word-flower", "asset-vo-word-door"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-glf-intro",
    "vo.instruction": "asset-vo-glf-instruction",
    "vo.instruction_repeat": "asset-vo-glf-instruction-slow",
    "vo.hint": "asset-vo-glf-hint",
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
| `game_art` — 4 صور أشياء + 3 بطاقات صوت محيّدة + غلاف | ❌ مطلوب |
| `voice_prompts` — 9 مفاتيح + نطق واضح لكل كلمة من الحلقة | ❌ مطلوب |
| `engine_implementation` — `match_pairs` + وضع `sound_image` | ❌ غير مُنفَّذ |
| ترحيل `engine_id` من `engine-match` إلى `match_pairs` | ❌ مطلوب |

🔴 **لا نصّ مطبوع داخل أي صورة.** 🔴 **لا صورة شمس ساطعة تُشجّع النظر إلى الشمس** — الرسم رمزي مسطّح.
