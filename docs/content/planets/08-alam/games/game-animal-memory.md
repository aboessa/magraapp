# ذاكرة الحيوانات — `game-animal-memory`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.** المحرك نفسه غير مُنفَّذ.

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-animal-memory` |
| `title_ar` | ذاكرة الحيوانات |
| الكوكب | `alam` — [08-alam](../README.md) |
| السلسلة | `explorers-adventures` — مغامرات المستكشفين |
| `age_min` / `age_max` | 6 / 8 · المسار `kids` |
| `reading_level` / `interaction_mode` | `emerging` / `tap` |
| `supervision_level` / `difficulty` | `none` / `easy` |
| `max_attempts` | `null` — محاولات غير محدودة |
| المحرك المُعتمد | `memory_flip` — النوعان `identical` ثم `related` |
| المحرك القديم في قاعدة البيانات | `engine-memory` ❌ لا يطابق أي عقد محرك |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `world.reason.combine_clues` |
| الحلقة المرتبطة | [الحلقة 1 — دلائل الصور](../explorers-adventures/ep-01-picture-clues.md) |
| الهدف (المستوى 3 فقط) | يربط الطفل الحيوان **بالدليل الذي يتركه**: أثر قدم · ريشة · عُشّ · قرص عسل |
| المعيار | يكشف الأزواج الستة المترابطة ويسمع شرح العلاقة لكل زوج |

🔴 **هذه اللعبة «ترفيه أولًا» بحكم عقد المحرك، ولا تُكتب لها `mastery` في المستويين 1 و2.** نصّ [05 — الإتقان](../../../../games/05-mastery-and-measurement.md) صريح: `memory_flip` بالحزم المتماثلة يكتب `attempts` فقط بلا `mastery`. والمستوى 3 (المترابط) هو الوحيد القابل للربط بهدف، وعقد المحرك يذكر **هدف مفردات**؛ ربطه هنا بهدف استنتاجي (`world.reason.combine_clues`) **يحتاج توقيعًا تحريريًا** وهو مسجَّل في `open_questions` بالمانيفست. حتى صدور التوقيع: **الافتراضي أن تُكتب `attempts` وحدها للمستويات الثلاثة**.

الحلقة 1 تعلّم أن **الدليل الواحد يرجّح ولا يُثبت**، وأن المستكشف يعيد النظر في الدلائل التي بين يديه. المستوى 3 يجسّد نصف هذه القاعدة تجسيدًا لعبيًا: كل بطاقة دليل تشير إلى صاحبها، والطفل يبني الربط بنفسه، ويسمع بعد كل زوج: «الريشة دليل على الحمامة.»

## المحرك المختار وتبريره

**`memory_flip`** — عقد المحرك: [`04-memory-flip.md`](../../../../games/engines/04-memory-flip.md).

عقد المحرك يعلن مساره صراحة: **«المسار: `preschool` + `kids`»** — فعمر 6–8 داخل المسار المعلن بلا أي توسيع فئة. ومدخلاته `tap` وحده، وهذا ما تحتاجه لعبة قلب بطاقات بلا سحب ولا دقة حركية. وشبكته تصل إلى 12 بطاقة (`max_elements_on_screen = 12`) فيستوعب المستوى بستة أزواج بلا خرق للحد. والأهم أن العقد يعرّف نوع الزوج `related` («مترابط لا متماثل») ويوفّر `explain_audio` لشرح العلاقة — وهذا بالضبط ما يحوّل شبكة ذاكرة إلى تمرين على الدليل. وسياسة الفشل في هذا المحرك **صمت مقصود بلا `vo.retry` إطلاقًا**، وهو ما يجعله اللعبة الأهدأ في الكوكب ومناسبًا كمدخل قبل الحزم القياسية. المحرك القديم `engine-memory` بلا مخطط ولا سلّم مساعدة ولا سياسة صمت، فاستبداله شرط للتحقق على الخادم. 🔴 **وما لا يجوز هو تحويل هذه اللعبة إلى مقياس صارم:** المحركان الترفيهيان في المنصة (`memory_flip` و`rhythm_tap`) موجودان تحديدًا حتى لا تصير المنصة مدرسة.

## الميكانيكا الأساسية

شبكة بطاقات مقلوبة بظهر موحّد (`Cosmic Indigo #1B236B` + نجمة `Star Yellow #FFD34D`). يلمس الطفل بطاقتين. إن تطابقتا — أو **تناسبتا** في المستوى 3 — بقيتا مكشوفتين مع توهج ناعم ونطق اسم البطاقة، وإلا عادتا للقلب بعد مهلة **بلا أي صوت أو عبارة**.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «هيا نبحث عن الأزواج!» مرة واحدة عند الفتح.
2. `vo.instruction`: «اقلب بطاقتين وابحث عن المتشابهتين.» — وفي المستوى 3: «اقلب بطاقتين وابحث عن اللتين تناسبان بعضهما.» زر إعادة التعليمة **ظاهر دائمًا**.
3. تُعرض الشبكة كلها مقلوبة. لا مؤقت، ولا عدّ محاولات معروض.
4. الطفل يلمس بطاقة: تُقلب بحركة قصيرة ويُنطق اسمها (`vo.card_label.*`).
5. يلمس بطاقة ثانية: تُقلب ويُنطق اسمها.
6. **تطابق:** تبقى البطاقتان مكشوفتين + `vo.pair_found` «وجدتها!» + توهج ناعم. وفي المستوى 3 يُضاف `vo.pair_explain`: «الريشة دليل على الحمامة.»
7. **لا تطابق:** البطاقتان تعودان بعد `flip_back_delay_ms`. **لا صوت، ولا عبارة، ولا اهتزاز.** الصمت هنا قرار تربوي لا نقص.
8. عند كشف كل الأزواج: `vo.level_complete` + لحن 1.2 ثانية.
9. بعد المستوى الثالث: `vo.game_complete` + ملصق واحد يُضاف إلى «مجموعتي».
10. الخروج متاح في أي لحظة (`vo.exit_confirm`) ويحفظ المستوى الحالي.

## المستويات

| المستوى | الهدف | الشبكة | البطاقات | الأزواج (العناصر) | المشتّتات | شرط النجاح |
|---:|---|---|---:|---:|---:|---|
| 1 | ذاكرة عاملة على 4 أزواج متماثلة من حيوانات الحيّ | 2×4 | 8 | 4 | 0 | كشف الأزواج الأربعة |
| 2 | 6 أزواج متماثلة — سعة أكبر بنفس القاعدة | 3×4 | 12 | 6 | 0 | كشف الأزواج الستة |
| 3 | 6 أزواج **مترابطة**: الحيوان ← الدليل الذي يتركه | 3×4 | 12 | 6 | 0 | كشف الأزواج الستة وسماع شرح كل علاقة |

🔴 **لا مشتّتات في أي مستوى.** المحرك لا يعرّف مشتّتات: كل بطاقة على الشبكة نصف زوج قائم، وإضافة بطاقة بلا زوج تجعل اللعبة غير قابلة للإكمال وتخرق شرط الفوز «كشف كل الأزواج». ما يقوم بدور الصعوبة هو **سعة الشبكة** و**نوع الربط**.

## التدرّج في الصعوبة

بُعد واحد في كل مستوى: أولًا **السعة** (4 ← 6 أزواج)، ثم **نوع الربط** (متماثل ← مترابط) بنفس السعة. المستوى 3 لا يزيد عدد البطاقات لأن الحمل الجديد **معرفي لا ذاكري**: على الطفل أن يتذكر موضع البطاقة وأن يستنتج العلاقة معًا. و`flip_back_delay_ms` يعود إلى **1200ms** في المستوى 3 بعد أن نزل إلى 1000ms في المستوى 2 — زيادة المهلة مع زيادة الحمل المعرفي، لا العكس. لا مؤقت في أي مستوى.

## `instructions_ar` — كما يسمعها الطفل

> «هيا نبحث عن الأزواج! البطاقات كلها مقلوبة. المس بطاقة، ثم المس بطاقة أخرى. إن كانتا متشابهتين بقيتا مكشوفتين. وفي المرحلة الأخيرة ابحث عن البطاقتين **اللتين تناسبان بعضهما**: الحيوان والدليل الذي يتركه. خُذ وقتك، فلا وقت محدد هنا.»

`vo.instruction_repeat` = النص نفسه أبطأ.

## منطق النجاح

- المستوى ينجح **بكشف كل الأزواج**. لا شرط زمن، ولا حد محاولات، ولا نسبة دقة.
- `score` = `max_score` عند الإكمال · `max_score` = عدد الأزواج (4 ثم 6 ثم 6) — بحسب جدول الاحتساب في [05](../../../../games/05-mastery-and-measurement.md): «`memory_flip`: `score` = `max_score` عند الإكمال».
- `attempts` تُكتب **مرة واحدة لكل مستوى** بـ`event_id` ثابت عبر `POST /api/v1/family/progress`.
- 🔴 **لا `mastery`** للمستويين 1 و2. المستوى 3 لا يكتب `mastery` إلا بعد التوقيع التحريري المذكور أعلاه.

## منطق الفشل

🔴 **لا يوجد «خطأ» في هذه اللعبة إطلاقًا.** البطاقتان تعودان، وهذا كل ما يحدث. لا عبارة، ولا عدّ أخطاء، ولا وصف للطفل بالتقصير — بحسب [04 — التشجيع والفشل](../../../../games/04-encouragement-and-failure.md) الذي يستثني هذا المحرك نصًّا من التعليق: «`memory_flip`: **لا `vo.retry` إطلاقًا — صمت مقصود**».

| بعد | ما يحدث |
|---:|---|
| 6 محاولات غير موفقة | إبقاء بطاقة واحدة مكشوفة لثانية إضافية |
| 10 محاولات غير موفقة | كشف زوج واحد تلقائيًا **بهدوء بلا أي تعليق** |
| بعد ذلك | تتكرر المساعدة الهادئة كل 10 محاولات — **بلا تصاعد ولا رسالة** |

الكشف المساعد **لا يُعرض كإخفاق**، ولا يُقفل الطفل خارج أي مستوى، ولا يُفقد أي ملصق مكتسب. ولأن اللعبة ترفيهية، **لا تُقترح لعبة أسهل** ولا تُعرض رسالة «نلعب شيئًا آخر؟»: الخروج بيد الطفل وحده.

## النقاط والمكافآت

- 🔴 **لا نقاط، ولا مؤقت، ولا عدد محاولات معروض** — بند صريح في عقد المحرك ومعايير قبوله.
- ملصق واحد هادئ عند إكمال اللعبة يُضاف إلى «مجموعتي»، ولا يُفقد أبدًا.
- **ممنوع:** عملة داخلية · شراء داخلي · صناديق عشوائية · إعلانات · streaks · لوحة ترتيب · مقارنة بأطفال آخرين.
- تقرير ولي الأمر بلغة وصفية: «يتذكر مواضع ستة أزواج، ويربط الحيوان بالدليل الذي يتركه» — بلا نسب ولا عدّ أخطاء.

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| كشف زوج | «وجدتها!» — مع توهج ناعم لا وميض |
| عدم التطابق | 🔴 **صمت كامل** — لا عبارة ولا صوت |
| شرح العلاقة (المستوى 3) | «الريشة دليل على الحمامة.» · «أثر الأقدام دليل على القطة.» · «العُشّ دليل على العصفور.» |
| إكمال مستوى | «أكملت المستوى!» |
| إكمال اللعبة | «وجدت كل الأزواج! لعب جميل.» |

التشجيع **للجهد لا للذكاء**، وكل 2–3 نجاحات لا كل نجاح، ولا تُكرَّر العبارة نفسها مرتين متتاليتين — الطبقة المشتركة هي من يفرض ذلك لا المحرك.

## إمكانية الوصول

بحسب [06 — إمكانية الوصول](../../../../games/06-accessibility.md):

- هدف اللمس **64dp** · مدخل `tap` وحده، فلا حاجة إلى بديل سحب.
- كل بطاقة لها **وصف بديل نصي مترجم** يُقرأ عند الكشف، ولكل خلية شبكة وصف موضعها («الصف الثاني، البطاقة الثالثة»).
- **حركة القلب تُختصر** عند تفعيل «تقليل الحركة»، ويبقى الانتقال مفهومًا بلا حركة.
- **لا وميض** عند المطابقة — توهج ناعم فقط، ولا وميض > 3Hz في أي موضع.
- التطابق **لا يُدلّ عليه باللون وحده**: توهج + رمز + صوت اسم البطاقة.
- **لا مؤقت** · `TextScaler` حتى 2.0× بلا قطع نص · العناصر لا تُثبَّت في جهة واحدة (يد يمنى/يسرى).
- يعمل بالـD-pad على TV: تنقّل في الشبكة ثم زر تأكيد.
- 🔴 **اللعبة قابلة للعب بلا صوت بالكامل** — الربط بصري، والأسماء تُعرض كوصف نصي عند الكشف.
- 🔴 **صور الدلائل غير مخيفة:** أثر قدم ورِيشة وعُشّ وقرص عسل — **بلا عظام، ولا حيوان مصاب، ولا دم**. أثر القدم رسم واضح على رمل فاتح لا مشهد مطاردة.

## `help_system`

```json
{
  "hint_after_failed_attempts": 6,
  "hint_type": "highlight_target",
  "repeat_instructions_button": true,
  "simplify_after_failed_attempts": 10,
  "solution_after_failed_attempts": 10,
  "counts_as_help_used": false
}
```

🔴 **الفروق عن القيم الافتراضية مقصودة ومبرَّرة بعقد المحرك:** العتبات 6 و10 مأخوذة من جدول سلوك الخطأ في العقد لا من الافتراضي (2/3/4)، لأن «المحاولة غير الموفقة» في لعبة ذاكرة **حدث طبيعي في اللعب** لا مؤشر تعثر. و`counts_as_help_used = false` لأن الكشف الهادئ ليس مساعدة تعليمية ولا `mastery` تُكتب هنا أصلًا.

## حزمة المحتوى — `content_pack`

مطابقة لـ[`memory_flip.v1.schema.json`](../../../../games/schemas/memory_flip.v1.schema.json) و[العقد الأساس](../../../../games/schemas/content-pack.base.schema.json). **لا `vo.retry` في `voice_manifest`** — وهذا ليس نقصًا بل بند في العقد.

```json
{
  "pack_version": 1,
  "engine_id": "memory_flip",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "grid": [2, 4],
      "pair_type": "identical",
      "pairs": [
        { "a": "asset-am-cat", "b": "asset-am-cat-2", "sound_key": "animal.cat", "audio": "asset-vo-am-cat" },
        { "a": "asset-am-sparrow", "b": "asset-am-sparrow-2", "sound_key": "animal.sparrow", "audio": "asset-vo-am-sparrow" },
        { "a": "asset-am-turtle", "b": "asset-am-turtle-2", "sound_key": "animal.turtle", "audio": "asset-vo-am-turtle" },
        { "a": "asset-am-bee", "b": "asset-am-bee-2", "sound_key": "animal.bee", "audio": "asset-vo-am-bee" }
      ],
      "flip_back_delay_ms": 1200,
      "reveal_help_after_misses": 10,
      "celebrate_each_pair": true
    },
    {
      "level": 2,
      "grid": [3, 4],
      "pair_type": "identical",
      "pairs": [
        { "a": "asset-am-cat", "b": "asset-am-cat-2", "sound_key": "animal.cat", "audio": "asset-vo-am-cat" },
        { "a": "asset-am-sparrow", "b": "asset-am-sparrow-2", "sound_key": "animal.sparrow", "audio": "asset-vo-am-sparrow" },
        { "a": "asset-am-turtle", "b": "asset-am-turtle-2", "sound_key": "animal.turtle", "audio": "asset-vo-am-turtle" },
        { "a": "asset-am-bee", "b": "asset-am-bee-2", "sound_key": "animal.bee", "audio": "asset-vo-am-bee" },
        { "a": "asset-am-dove", "b": "asset-am-dove-2", "sound_key": "animal.dove", "audio": "asset-vo-am-dove" },
        { "a": "asset-am-squirrel", "b": "asset-am-squirrel-2", "sound_key": "animal.squirrel", "audio": "asset-vo-am-squirrel" }
      ],
      "flip_back_delay_ms": 1000,
      "reveal_help_after_misses": 10,
      "celebrate_each_pair": true
    },
    {
      "level": 3,
      "grid": [3, 4],
      "pair_type": "related",
      "pairs": [
        { "a": "asset-am-cat", "b": "asset-am-paw-tracks", "sound_key": "clue.cat_tracks", "audio": "asset-vo-am-cat-tracks", "explain_audio": "asset-vo-am-explain-cat" },
        { "a": "asset-am-dove", "b": "asset-am-feather", "sound_key": "clue.dove_feather", "audio": "asset-vo-am-dove-feather", "explain_audio": "asset-vo-am-explain-dove" },
        { "a": "asset-am-sparrow", "b": "asset-am-nest", "sound_key": "clue.sparrow_nest", "audio": "asset-vo-am-sparrow-nest", "explain_audio": "asset-vo-am-explain-sparrow" },
        { "a": "asset-am-bee", "b": "asset-am-honeycomb", "sound_key": "clue.bee_honeycomb", "audio": "asset-vo-am-bee-honeycomb", "explain_audio": "asset-vo-am-explain-bee" },
        { "a": "asset-am-squirrel", "b": "asset-am-cracked-nut", "sound_key": "clue.squirrel_nut", "audio": "asset-vo-am-squirrel-nut", "explain_audio": "asset-vo-am-explain-squirrel" },
        { "a": "asset-am-turtle", "b": "asset-am-sand-trail", "sound_key": "clue.turtle_trail", "audio": "asset-vo-am-turtle-trail", "explain_audio": "asset-vo-am-explain-turtle" }
      ],
      "flip_back_delay_ms": 1200,
      "reveal_help_after_misses": 10,
      "celebrate_each_pair": true
    }
  ],
  "assets": {
    "images": [
      "asset-am-card-back",
      "asset-am-cat", "asset-am-cat-2", "asset-am-sparrow", "asset-am-sparrow-2",
      "asset-am-turtle", "asset-am-turtle-2", "asset-am-bee", "asset-am-bee-2",
      "asset-am-dove", "asset-am-dove-2", "asset-am-squirrel", "asset-am-squirrel-2",
      "asset-am-paw-tracks", "asset-am-feather", "asset-am-nest",
      "asset-am-honeycomb", "asset-am-cracked-nut", "asset-am-sand-trail"
    ],
    "audio": [
      "asset-vo-am-cat", "asset-vo-am-sparrow", "asset-vo-am-turtle", "asset-vo-am-bee",
      "asset-vo-am-dove", "asset-vo-am-squirrel",
      "asset-vo-am-cat-tracks", "asset-vo-am-dove-feather", "asset-vo-am-sparrow-nest",
      "asset-vo-am-bee-honeycomb", "asset-vo-am-squirrel-nut", "asset-vo-am-turtle-trail",
      "asset-vo-am-explain-cat", "asset-vo-am-explain-dove", "asset-vo-am-explain-sparrow",
      "asset-vo-am-explain-bee", "asset-vo-am-explain-squirrel", "asset-vo-am-explain-turtle"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gam-intro",
    "vo.instruction": "asset-vo-gam-instruction",
    "vo.instruction_repeat": "asset-vo-gam-instruction-slow",
    "vo.pair_found": "asset-vo-pair-found",
    "vo.pair_explain": "asset-vo-gam-pair-explain",
    "vo.level_complete": "asset-vo-level-complete-kids",
    "vo.game_complete": "asset-vo-gam-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — 19 صورة `1:1` (12 حيوان + 6 دليل + ظهر بطاقة موحّد) + غلاف اللعبة | ❌ مطلوب |
| `voice_prompts` — 8 مفاتيح إلزامية + 12 اسم بطاقة + 6 شرح علاقة | ❌ مطلوب |
| `engine_implementation` — محرك `memory_flip` نفسه | ❌ غير مُنفَّذ |
| ترحيل `engine_id` في قاعدة البيانات من `engine-memory` إلى `memory_flip` | ❌ مطلوب |
| مراجعة تحريرية لربط المستوى 3 بهدف استنتاجي بدل هدف مفردات | ❌ مطلوب — في `open_questions` |

🔴 **لا نصّ مطبوع داخل أي صورة** — التسميات من ملفات الترجمة وحدها.
