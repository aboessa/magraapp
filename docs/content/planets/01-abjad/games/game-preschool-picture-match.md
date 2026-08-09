# طابق الصورة — `game-preschool-picture-match`

> 🔴 **حالة التنفيذ: `design only`.** هذه مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.** المحرك نفسه غير مُنفَّذ.

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-preschool-picture-match` |
| `title_ar` | طابق الصورة |
| الكوكب | `abjad` — [01-abjad](../README.md) |
| السلسلة | `luna-discovers-words` — لونا تكتشف الكلمات |
| `age_min` / `age_max` | 3 / 5 |
| المسار | `preschool` |
| `reading_level` | `pre_reader` |
| `interaction_mode` | `tap` |
| `supervision_level` | `none` |
| `difficulty` | `easy` |
| `max_attempts` | `null` — محاولات غير محدودة |
| المحرك المُعتمد | `match_pairs` |
| المحرك القديم في قاعدة البيانات | `engine-match` ❌ لا يطابق أي عقد محرك |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `lang.vocab.match_word_image` |
| الحلقة المرتبطة | [الحلقة 1 — الصورة والشيء](../luna-discovers-words/ep-01-picture-and-thing.md) |
| الهدف | يربط الطفل صورة الشيء بالشيء نفسه، ويسمع اسمه منطوقًا |
| المعيار | يطابق 3 من 4 أزواج صحيحة **من أول محاولة** |

الحلقة 1 تعلّم «صورة ← شيء». اللعبة **تقيس المهارة نفسها** بلا إضافة مفهوم جديد، والمفردات المستخدمة هي مفردات الحلقة ذاتها: تفاحة · كرة · قطة · بيت.

## المحرك المختار وتبريره

**`match_pairs`** — عقد المحرك: [`01-match-pairs.md`](../../../../games/engines/01-match-pairs.md).

عقد المحرك ينصّ على أن مساره الأساسي `preschool`، وأن مدخلاته `drag` و`tap`، وأن هدف اللمس 72dp، وأنه **بلا مؤقت وبلا فشل** (`max_attempts = NULL`) — وهذه بالضبط شروط لعبة لعمر 3–5. وأنواع الربط المعلنة في العقد تضمّ `identical` («صورة تفاحة ← صورة تفاحة»)، وهو النوع الذي تحتاجه الحلقة 1 حرفيًا. المحرك أيضًا `translatable`، فالحزمة تُترجَم بلا إعادة تأليف، ويكتب `score` = «الأزواج الصحيحة من أول محاولة» وهو المقياس الذي يطلبه معيار الحلقة. المحرك القديم `engine-match` لا يحمل مخططًا ولا سلّم مساعدة ولا سياسة فشل، فاستبداله بـ`match_pairs` ليس تجميلًا بل هو الشرط الذي يجعل اللعبة قابلة للتحقق على الخادم. لا يوجد أي توسيع فئة عمرية هنا: المسار المطلوب هو مسار المحرك الأساسي نفسه.

## الميكانيكا الأساسية

هدفان إلى ثلاثة **ثابتة** في أعلى الشاشة، وعنصران إلى ستة **متحركة** في الأسفل. يسحب الطفل العنصر إلى هدفه المطابق، أو — بديل السحب الإلزامي — **يلمس العنصر ثم يلمس الهدف**. كل لمسة تنطق اسم ما لُمس.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «هيا نلعب معًا!» مرة واحدة عند الفتح.
2. `vo.instruction`: «اسحب كل صورة إلى الصورة المثلها.» وزر إعادة التعليمة **ظاهر دائمًا**.
3. تُعرض الأهداف في الأعلى؛ عند لمس أي هدف يُنطق اسمه.
4. يختار الطفل عنصرًا: يُنطق اسمه ويتوهّج بإطار.
5. يسحبه إلى الهدف، أو يلمس الهدف.
6. **صحيح:** يستقر العنصر داخل الهدف بحركة لطيفة، وتُشغَّل عبارة تشجيع **كل 2–3 نجاحات لا كل نجاح**.
7. **غير صحيح:** يعود العنصر إلى مكانه في 200ms مع عبارة محاولة. **لا صوت سلبي إطلاقًا.**
8. عند اكتمال كل أزواج المستوى: `vo.level_complete` + لحن 1.2 ثانية.
9. بعد المستوى الثالث: `vo.game_complete` + ملصق واحد يُضاف إلى «مجموعتي».
10. الخروج متاح في أي لحظة، ويحفظ المستوى الحالي.

## المستويات

| المستوى | الهدف التعليمي للمستوى | الأهداف | العناصر المتحركة | المشتّتات | شرط النجاح |
|---:|---|---:|---:|---:|---|
| 1 | مطابقة شيئين مختلفين تمامًا في اللون والشكل | 2 | 2 | 0 | الزوجان صحيحان |
| 2 | مطابقة ثلاثة أشياء مألوفة | 3 | 3 | 0 | الأزواج الثلاثة صحيحة |
| 3 | مطابقة ثلاثة مع مشتّت واحد واضح | 3 | 4 | 1 | الأزواج الثلاثة صحيحة والمشتّت غير مستخدم |

**عدد العناصر المتحركة يشمل المشتّتات، والحد الأقصى 6** بحسب `max_elements_on_screen`.

## التدرّج في الصعوبة

يزيد التدرّج في **بُعد واحد فقط في كل مستوى**: عدد الأهداف أولًا (2 ← 3)، ثم وجود مشتّت واحد. لا يزيد عدد المشتّتات ولا يتغيّر نوع الربط ولا تُضاف تسميات جديدة في المستوى نفسه. ولا مؤقت في أي مستوى — بند إلزامي لكل محرك `preschool`.

## `instructions_ar` — كما يسمعها الطفل

> «هيا نلعب معًا! انظر إلى الصور في الأعلى. اسحب كل صورة إلى الصورة المثلها. المس الصورة لتسمع اسمها.»

نسخة `vo.instruction_repeat`: النص نفسه **أبطأ 15%**.

## منطق النجاح

- المستوى ينجح عندما **يستقر كل عنصر في هدفه الصحيح**. لا شرط زمن، ولا حد محاولات.
- `score` = الأزواج الصحيحة **من أول محاولة** · `max_score` = عدد الأزواج.
- تُكتب `attempts` **مرة واحدة لكل مستوى** بـ`event_id` ثابت عبر `POST /api/v1/family/progress`.
- `mastery` تُحدَّث على `lang.vocab.match_word_image` بحسب [05 — الإتقان](../../../../games/05-mastery-and-measurement.md).

## منطق الفشل

لا يوجد «فشل» في هذه اللعبة، ولا رسالة تصف الطفل بالتقصير، ولا عدّ أخطاء معروض له. السلّم مطبَّق مركزيًا كما في [04 — التشجيع والفشل](../../../../games/04-encouragement-and-failure.md):

| المحاولة غير الموفقة | ما يحدث |
|---:|---|
| 1 | العنصر يعود بحركة لطيفة + عبارة محاولة من بنك `preschool` |
| 2 | يتوهّج الهدف الصحيح بلون `#00D6F5` نبضتين + `vo.hint` |
| 3 | تُخفى المشتّتات ويبقى الزوج الصحيح فقط |
| 4 | ينتقل العنصر تلقائيًا إلى هدفه مع شرح صوتي |
| 5+ | «نلعب شيئًا آخر؟» مع اقتراح لعبة أسهل — **بلا أي وصف بالفشل** |

بعد التبسيط يُشجَّع النجاح **كاملًا لا منقوصًا**، ولا يُقفل الطفل خارج أي محتوى، ولا يُفقد أي ملصق مكتسب.

## النقاط والمكافآت

- **لا نقاط معروضة للطفل**، ولا نسبة دقة، ولا زمن.
- ملصق واحد هادئ عند إكمال اللعبة يُضاف إلى «مجموعتي»، ولا يُفقد أبدًا.
- **ممنوع:** عملة داخلية · شراء داخلي · صناديق عشوائية · إعلانات · streaks · مقارنة بأطفال آخرين.
- تقرير ولي الأمر بلغة وصفية: «يربط الكلمة بالصورة في معظم المحاولات» — لا نسب ولا عدّ أخطاء.

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح (كل 2–3 نجاحات) | «أحسنت!» · «نعم، صحيح!» · «وجدتها!» — بلا تكرار العبارة مرتين متتاليتين |
| محاولة | «جرّب مرة أخرى» · «قريب جدًا!» · «انظر مرة أخرى» — **لا تُقال كلمة «خطأ» إطلاقًا** |
| تلميح | «انظر إلى الشكل واللون معًا.» — تلميح للقاعدة لا للجواب |
| شرح عند الحل التلقائي | «هذه تفاحة، وهذه تفاحة. هما متماثلتان.» |
| إكمال اللعبة | «انتهينا! كان لعبًا جميلًا.» |

التشجيع **للجهد لا للذكاء**: «حاولت بتركيز» مقبولة، «أنت ذكي جدًا» ممنوعة.

## إمكانية الوصول

بحسب [06 — إمكانية الوصول](../../../../games/06-accessibility.md):

- هدف اللمس **72dp** (أعلى من حد `preschool` 64dp).
- **بديل السحب إلزامي:** لمس العنصر ثم لمس الهدف.
- كل صورة لها **وصف بديل نصي مترجم** لقارئ الشاشة، وترتيب قراءة منطقي في RTL وLTR.
- المشتّت **لا يُميَّز باللون وحده** — يختلف شكلًا وفئةً.
- الصحيح/الخطأ **لا يُدلّ عليهما بالأحمر/الأخضر وحدهما**: رمز + حركة + صوت.
- `TextScaler` حتى 2.0× بلا قطع نص · لا وميض > 3Hz · احترام «تقليل الحركة» ببديل ثابت لكل انتقال.
- **لا مؤقت.** العناصر التفاعلية لا تُثبَّت في جهة واحدة (يد يمنى/يسرى).
- يعمل بالـD-pad على TV: تحديد ثم زر تأكيد.
- اللعبة **قابلة للعب بالصوت وحده**، وقابلة للعب **بلا صوت** لأن المطابقة بصرية بالكامل.

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

مطابقة لـ[`match_pairs.v1.schema.json`](../../../../games/schemas/match_pairs.v1.schema.json) و[العقد الأساس](../../../../games/schemas/content-pack.base.schema.json).

```json
{
  "pack_version": 1,
  "engine_id": "match_pairs",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "match_type": "identical",
      "prompt_key": "luna.ep1.match_picture_thing",
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
      "prompt_key": "luna.ep1.match_picture_thing",
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
      "prompt_key": "luna.ep1.match_picture_thing",
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
    "images": [
      "asset-apple", "asset-apple-pic", "asset-ball", "asset-ball-pic",
      "asset-cat", "asset-cat-pic", "asset-house", "asset-house-pic"
    ],
    "audio": ["asset-vo-apple", "asset-vo-ball", "asset-vo-cat", "asset-vo-house"]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gpm-intro",
    "vo.instruction": "asset-vo-gpm-instruction",
    "vo.instruction_repeat": "asset-vo-gpm-instruction-slow",
    "vo.hint": "asset-vo-gpm-hint",
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
| `game_art` — 8 صور `1:1` بخلفية شفافة + غلاف اللعبة | ❌ مطلوب |
| `voice_prompts` — 9 مفاتيح صوتية + اسم كل عنصر | ❌ مطلوب |
| `engine_implementation` — محرك `match_pairs` نفسه | ❌ غير مُنفَّذ |
| ترحيل `engine_id` في قاعدة البيانات من `engine-match` إلى `match_pairs` | ❌ مطلوب |

🔴 **لا نصّ مطبوع داخل أي صورة** — التسميات من ملفات الترجمة وحدها.
