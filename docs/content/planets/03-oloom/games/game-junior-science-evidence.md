# دليل علمي — `game-junior-science-evidence`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.** المحرك نفسه غير مُنفَّذ.

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-junior-science-evidence` |
| `title_ar` | دليل علمي |
| الكوكب | `oloom` — [03-oloom](../README.md) |
| السلسلة | `science-in-a-minute` — علوم في دقيقة |
| `age_min` / `age_max` | 9 / 12 · المسار `junior` |
| `reading_level` / `interaction_mode` | `independent` / `independent` |
| `supervision_level` / `difficulty` | `none` / `medium` |
| `max_attempts` | `null` — محاولات غير محدودة |
| المحرك المُعتمد | `sort_bins` — المعيار `abstract` |
| المحرك القديم في قاعدة البيانات | `engine-match` ❌ لا يطابق أي عقد محرك |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `sci.method.evidence_claim` |
| الحلقة المرتبطة | [الحلقة 1 — انكسار الضوء](../science-in-a-minute/ep-01-light-refraction.md) — ومادة اللعبة من الحلقات 1 و2 و5 |
| الهدف | يُسند الطفل كل **مشاهدة** إلى **الدعوى التي تفسّرها**، ويميّز المشاهدة التي تبدو تابعة لدعوى وهي تابعة لأخرى |
| المعيار | يصنّف 8 مشاهدات على 3 دعاوى، بـ7 من 8 صحيحة **من أول محاولة** |

🔴 **ملاحظة على مصدر رمز الهدف:** `sci.method.evidence_claim` رمز **قائم في هذا الكوكب** — [جرّب في البيت · الحلقة 6](../try-it-at-home/ep-06-invisible-air.md) — وليس في سلسلة «علوم في دقيقة» نفسها. وإعادة استخدامه هو ما يفرضه [عقد التأليف](../../../AUTHORING_CONTRACT.md): «Reuse an existing code when the objective is genuinely the same»، والهدف هنا **هو هو**: ربط الدليل بالدعوى. وهذه سابقة مطبَّقة في هذه المجموعة نفسها: [دورة الفراشة](./game-butterfly-sequence.md) تستعير `sci.observe.living_thing` من سلسلة أخرى في الكوكب نفسه. وتسجيل الرمز على سلسلة «علوم في دقيقة» في جدول الأهداف مسألة إدارية مسجَّلة في `open_questions`.

سلسلة «علوم في دقيقة» تعرض في كل حلقة **ظاهرة مع تفسيرها** في 120 ثانية. اللعبة تقلب الاتجاه: تعرض **الظواهر مبعثرة** وتطلب إسناد كل واحدة إلى الدعوى التي تفسّرها. فمن حفظ التفسير أخطأ، ومن فهم المبدأ نجح — وهذا هو الفرق بين المعرفة والاستظهار.

## المحرك المختار وتبريره

**`sort_bins`** — عقد المحرك: [`03-sort-bins.md`](../../../../games/engines/03-sort-bins.md).

المحرك القديم `engine-match` مبهم، والبديل الطبيعي المتوقّع `match_pairs` **غير قانوني هنا**: عقده يعلن «المسار الأساسي `preschool` (يمتد إلى `kids`)» — ولا يعلن `junior` إطلاقًا، فإسناد لعبة 9–12 إليه خرق لحدود المحرك. أما `sort_bins` فيعلن نصًّا: **«المسار الأساسي `preschool` (يمتد إلى `kids` و`junior`)»** — فامتداد `junior` **معلن في العقد** ولا يحتاج توقيع فريق محرك. ومستواه الخامس معرَّف بـ**«قاعدة مجرّدة»** (`criterion_type: abstract`)، وهو ما تحتاجه دعوى علمية تمامًا: العنصر لا يُصنَّف بلونه ولا بشكله بل **بالمبدأ الذي يفسّره**. ويوفّر العقد `explain_on_correct` مع `explain_audio` لكل عنصر، فيصير كل تصنيف صحيح **جملة تفسير مسموعة** لا مجرد نقطة. وسلّم الخطأ (توهج السلة الصحيحة ← إخفاء سلة ← نقل تلقائي مع شرح) يوجّه إلى المبدأ لا إلى الجواب. البدائل: `logic_pattern` مرفوض لأنه `language_neutral` بأشكال هندسية ولا يحمل تسميات ولا شرحًا لغويًا، و`sim_lab` مرفوض لأنه يقيس تفسير **تجربة يجريها الطفل** لا إسناد مشاهدات جاهزة، و`sequence_order` يرتّب زمنيًا ولا يصنّف.

### ما يجب أن يُراجَع لأن الحزمة `junior` لا `preschool`

| البند | `sort_bins` كما هو | هذه الحزمة |
|---|---|---|
| هدف اللمس | 64dp (`preschool`) | 56dp — يكفي `junior` |
| نبرة الصوت | دافئة قصيرة | 🔴 **بنك `junior`** — «تحليل دقيق.» لا «أحسنت!» |
| المعيار | لون · شكل · حجم | 🔴 `abstract` **فقط** في المستويات الثلاثة |
| الشرح | «التفاحة حمراء» | 🔴 **جملة مبدأ**: «الضوء يتغير مساره عند دخوله الماء.» |

## الميكانيكا الأساسية

ثلاث سلات في أعلى الشاشة، كل سلة **دعوى علمية** مميّزة بصورة مخطّطية ونصّ وصوت. وفي الأسفل 4–8 بطاقات **مشاهدة**، كل واحدة صورة ظاهرة بلا نصّ. يسحب الطفل كل مشاهدة إلى الدعوى التي تفسّرها، أو **يلمس المشاهدة ثم يلمس السلة**. العنصر المصنّف صحيحًا يستقر في السلة ويُنطق تفسيره.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «ثلاث دعاوى، ومشاهدات مبعثرة. أسند كل مشاهدة إلى ما يفسّرها.»
2. `vo.instruction`: «أي مبدأ يفسّر كل مشاهدة؟» + زر إعادة التعليمة **ظاهر دائمًا**.
3. عند لمس أي سلة يُنطق نصّ الدعوى كاملًا (`vo.bin_label.*`)؛ وعند لمس أي مشاهدة يُنطق وصفها (`vo.item_label.*`).
4. الطفل يسند المشاهدة إلى سلة.
5. **صحيح:** تستقر البطاقة داخل السلة + `vo.explain_correct` يقول **المبدأ**: «الماء يحمل الضوء بسرعة مختلفة، فيبدو القلم مكسورًا.»
6. **غير صحيح:** ارتداد لطيف + عبارة محاولة من بنك `junior`، **بلا كلمة «خطأ»** وبلا صوت سلبي.
7. عند إسناد كل المشاهدات: `vo.level_complete`.
8. بعد المستوى الثالث: `vo.game_complete` + ملصق واحد يُضاف إلى «مجموعتي».
9. الخروج متاح في أي لحظة ويحفظ المستوى الحالي.

## المستويات

| المستوى | الهدف | السلات (الدعاوى) | العناصر (المشاهدات) | المشتّتات | شرط النجاح |
|---:|---|---:|---:|---:|---|
| 1 | التمييز بين مبدأين متباعدين: **الضوء ينكسر** / **الهواء يدفع** | 2 | 4 | 0 | 4 من 4 صحيحة |
| 2 | مبدأان أقرب: **الهواء يدفع** / **الماء يتحوّل** | 2 | 6 | 0 | 5 من 6 صحيحة من أول محاولة |
| 3 | ثلاثة مبادئ معًا، وفيها **مشاهدة تبدو تابعة لدعوى وهي تابعة لأخرى** | 3 | 8 | 1 حالة ملتبسة مقصودة | 7 من 8 صحيحة من أول محاولة |

عدد العناصر في أسوأ حالة: 8 مشاهدات + 3 سلات = داخل `max_elements_on_screen` المعلن للمحرك («8 عناصر + 3 سلات») ✓.

🔴 **الحالة الملتبسة في المستوى 3 هي قلب اللعبة:** «كأس مقلوب مغطّى بورقة والماء لا يسقط» تبدو مشاهدة عن **الماء**، وهي في الحقيقة دليل على **دفع الهواء**. من صنّفها في سلة الماء لم يخطئ عشوائيًا بل **صنّف بالموضوع لا بالمبدأ** — وهذا بالضبط ما تقيسه اللعبة. ولذلك شرحها الصوتي هو أطول شرح في الحزمة.

## التدرّج في الصعوبة

بُعد واحد في كل مستوى: أولًا **مبدأان متباعدان** بلا التباس، ثم **مبدأان متجاوران** (الهواء والماء يظهران في ظواهر متشابهة المشهد) بعدد عناصر أكبر، ثم **ثلاثة مبادئ** مع حالة ملتبسة واحدة. عدد السلات يزيد مرة واحدة فقط، والمعيار يبقى `abstract` في المستويات الثلاثة. لا مؤقت، ولا حد محاولات.

## `instructions_ar` — كما يسمعها الطفل

> «أمامك دعاوى علمية في السلات، ومشاهدات مبعثرة في الأسفل. مهمتك أن تُسند كل مشاهدة إلى الدعوى التي **تفسّرها** — لا إلى الدعوى التي تشبهها في الموضوع. المس أي سلة لتسمع دعواها، والمس أي مشاهدة لتسمع وصفها. وانتبه في المرحلة الأخيرة: مشاهدة واحدة فيها **ماء** لكن الذي يفسّرها **هواء**.»

`vo.instruction_repeat` = النص نفسه بلا تسريع.

## منطق النجاح

- المستوى ينجح بإسناد **كل** المشاهدات إسنادًا صحيحًا؛ وشرط الفوز في العقد «كل العناصر مصنّفة صحيحًا». والعتبات في جدول المستويات (5 من 6، 7 من 8) هي **عتبات الإتقان** التي تُقاس على `score`، لا شرط إكمال — فالطفل يواصل حتى تُسند كل بطاقة.
- `score` = العناصر الصحيحة **من أول محاولة** · `max_score` = عدد العناصر — بحسب [05](../../../../games/05-mastery-and-measurement.md).
- `attempts` تُكتب **مرة واحدة لكل مستوى** بـ`event_id` ثابت عبر `POST /api/v1/family/progress`.
- `mastery` تُحدَّث على `sci.method.evidence_claim`.

## منطق الفشل

بحسب [04 — التشجيع والفشل](../../../../games/04-encouragement-and-failure.md)، ونبرة `junior` محترمة بلا تصغير:

| المحاولة غير الموفقة | ما يحدث |
|---:|---|
| 1 | ارتداد لطيف + «ليست صحيحة. راجع ما **يفعله** الهواء وما يفعله الماء.» — **بلا كلمة «خطأ»** |
| 2 | توهج **السلة الصحيحة** مع نطق دعواها كاملة |
| 3 | إخفاء سلة خاطئة (تقليل الاختيار) |
| 4 | نقل تلقائي مع شرح كامل يربط المشاهدة بالمبدأ، ثم متابعة عادية |
| 5+ | «نلعب شيئًا آخر؟» مع اقتراح تحدٍّ أبسط — **بلا أي وصف بالفشل** |

🔴 **الحالة الملتبسة لا يُعلَّق عليها بلغة تقصير إطلاقًا.** عند الخطأ فيها تُقال جملة تصف **التصنيف** لا الطفل: «هذه مشاهدة يظهر فيها الماء، لكن الذي يمسكه هو الهواء.» ولا عدّ أخطاء معروض، ولا قفل لأي مستوى، ولا فقدان لأي ملصق مكتسب. تقرير ولي الأمر وصفي: «يميّز أثر الهواء عن أثر الماء، ويحتاج تدريبًا على الحالات التي يظهر فيها المبدآن معًا».

## النقاط والمكافآت

لا نقاط ولا زمن ولا نسبة دقة معروضة للطفل. ملصق هادئ واحد عند إكمال اللعبة يُضاف إلى «مجموعتي» ولا يُفقد أبدًا. **ممنوع:** عملة داخلية · شراء داخلي · صناديق عشوائية · إعلانات · streaks · لوحة ترتيب · مقارنة بأطفال آخرين.

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح | «تحليل دقيق.» · «صحيح — لاحظت القاعدة.» — كل 2–3 نجاحات لا كل نجاح |
| محاولة | «ليست صحيحة. راجع العلاقة بين المشاهدة والمبدأ.» |
| تلميح | «اسأل: ما الذي **تحرّك** في هذه المشاهدة؟» — مبدأ لا جواب |
| شرح صحيح — الضوء | «الضوء يسير في الماء بسرعة مختلفة، فيبدو القلم مكسورًا عند سطح الماء.» |
| شرح صحيح — الهواء | «الهواء حولنا يدفع في كل اتجاه، وهذا الدفع يرفع الماء في المصّاصة.» |
| شرح صحيح — الماء | «الماء يتحوّل بين بخار وسائل، فيتكاثف على السطح البارد.» |
| الحالة الملتبسة | «الماء لم يسقط لأن الورقة قوية، بل لأن **الهواء يدفع** الورقة من الأسفل.» |
| إكمال اللعبة | «أسندت كل مشاهدة إلى ما يفسّرها. أكملت التحدي.» |

🔴 **كل شرح جملة مبدأ واحدة** — لا محاضرة، ولا مصطلح غير مفسَّر، ولا نبرة طفولية.

## إمكانية الوصول

بحسب [06 — إمكانية الوصول](../../../../games/06-accessibility.md):

- 🔴 **السلة مميّزة بصورة + نص + صوت، لا باللون وحده** — بند إلزامي في معايير قبول المحرك.
- 🔴 **بديل السحب إلزامي:** لمس المشاهدة ثم لمس السلة.
- هدف اللمس 56dp (الفئة `junior`).
- **وصف بديل نصي مترجم لكل مشاهدة** («قلم في كأس ماء يبدو مكسورًا عند سطح الماء») — والوصف كافٍ للعب بلا صوت.
- الصحيح/الخطأ **لا يُدلّ عليه بالأحمر/الأخضر وحدهما**: رمز + حركة + صوت.
- **لا مؤقت** · `TextScaler` حتى 2.0× بلا قطع نص · لا وميض > 3Hz · احترام «تقليل الحركة» (الاستقرار في السلة له بديل ثابت).
- يعمل بالـD-pad على TV: تحديد مشاهدة ثم سلة ثم تأكيد.
- 🔴 **صور المشاهدات آمنة:** لا لهب، ولا كهرباء، ولا زجاج مكسور، ولا سائل مجهول. والكأس المقلوب يُرسم **على حوض** لا على طاولة، حتى لا يقرأه الطفل كتجربة يعيدها بلا إشراف.
- العناصر التفاعلية لا تُثبَّت في جهة واحدة (يد يمنى/يسرى).

## `help_system`

```json
{
  "hint_after_failed_attempts": 2,
  "hint_type": "show_dimension",
  "repeat_instructions_button": true,
  "simplify_after_failed_attempts": 3,
  "solution_after_failed_attempts": 4,
  "counts_as_help_used": true
}
```

`hint_type = show_dimension` هنا يعني **إبراز المبدأ المتغيّر** بين السلات (ما يفعله الهواء مقابل ما يفعله الماء)، لا إبراز السلة الصحيحة — التلميح يوجّه إلى القاعدة.

## حزمة المحتوى — `content_pack`

مطابقة لـ[`sort_bins.v1.schema.json`](../../../../games/schemas/sort_bins.v1.schema.json) و[العقد الأساس](../../../../games/schemas/content-pack.base.schema.json). كل `bin` يحمل صورة ونصًّا وصوتًا، وكل عنصر يحمل `explain_audio`، و`explain_on_correct` مفعّل في المستويات الثلاثة.

```json
{
  "pack_version": 1,
  "engine_id": "sort_bins",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "criterion_key": "sort.by_scientific_principle",
      "criterion_type": "abstract",
      "bins": [
        { "id": "b1", "label_key": "claim.light_bends", "image": "asset-se-bin-light", "audio": "asset-vo-se-bin-light" },
        { "id": "b2", "label_key": "claim.air_pushes", "image": "asset-se-bin-air", "audio": "asset-vo-se-bin-air" }
      ],
      "items": [
        { "id": "i1", "image": "asset-se-straw-bent", "bin": "b1", "label_key": "obs.straw_bent", "audio": "asset-vo-se-straw-bent", "explain_audio": "asset-vo-se-explain-straw-bent" },
        { "id": "i2", "image": "asset-se-rainbow", "bin": "b1", "label_key": "obs.rainbow", "audio": "asset-vo-se-rainbow", "explain_audio": "asset-vo-se-explain-rainbow" },
        { "id": "i3", "image": "asset-se-straw-suction", "bin": "b2", "label_key": "obs.straw_suction", "audio": "asset-vo-se-straw-suction", "explain_audio": "asset-vo-se-explain-straw-suction" },
        { "id": "i4", "image": "asset-se-balloon-release", "bin": "b2", "label_key": "obs.balloon_release", "audio": "asset-vo-se-balloon-release", "explain_audio": "asset-vo-se-explain-balloon" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    },
    {
      "level": 2,
      "criterion_key": "sort.by_scientific_principle",
      "criterion_type": "abstract",
      "bins": [
        { "id": "b1", "label_key": "claim.air_pushes", "image": "asset-se-bin-air", "audio": "asset-vo-se-bin-air" },
        { "id": "b2", "label_key": "claim.water_changes_state", "image": "asset-se-bin-water", "audio": "asset-vo-se-bin-water" }
      ],
      "items": [
        { "id": "i1", "image": "asset-se-sail-boat", "bin": "b1", "label_key": "obs.sail_boat", "audio": "asset-vo-se-sail-boat", "explain_audio": "asset-vo-se-explain-sail" },
        { "id": "i2", "image": "asset-se-straw-suction", "bin": "b1", "label_key": "obs.straw_suction", "audio": "asset-vo-se-straw-suction", "explain_audio": "asset-vo-se-explain-straw-suction" },
        { "id": "i3", "image": "asset-se-balloon-release", "bin": "b1", "label_key": "obs.balloon_release", "audio": "asset-vo-se-balloon-release", "explain_audio": "asset-vo-se-explain-balloon" },
        { "id": "i4", "image": "asset-se-steam-cup", "bin": "b2", "label_key": "obs.steam_cup", "audio": "asset-vo-se-steam-cup", "explain_audio": "asset-vo-se-explain-steam" },
        { "id": "i5", "image": "asset-se-condensation", "bin": "b2", "label_key": "obs.condensation", "audio": "asset-vo-se-condensation", "explain_audio": "asset-vo-se-explain-condensation" },
        { "id": "i6", "image": "asset-se-puddle-drying", "bin": "b2", "label_key": "obs.puddle_drying", "audio": "asset-vo-se-puddle-drying", "explain_audio": "asset-vo-se-explain-puddle" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    },
    {
      "level": 3,
      "criterion_key": "sort.by_scientific_principle",
      "criterion_type": "abstract",
      "bins": [
        { "id": "b1", "label_key": "claim.light_bends", "image": "asset-se-bin-light", "audio": "asset-vo-se-bin-light" },
        { "id": "b2", "label_key": "claim.air_pushes", "image": "asset-se-bin-air", "audio": "asset-vo-se-bin-air" },
        { "id": "b3", "label_key": "claim.water_changes_state", "image": "asset-se-bin-water", "audio": "asset-vo-se-bin-water" }
      ],
      "items": [
        { "id": "i1", "image": "asset-se-straw-bent", "bin": "b1", "label_key": "obs.straw_bent", "audio": "asset-vo-se-straw-bent", "explain_audio": "asset-vo-se-explain-straw-bent" },
        { "id": "i2", "image": "asset-se-prism", "bin": "b1", "label_key": "obs.prism_colors", "audio": "asset-vo-se-prism", "explain_audio": "asset-vo-se-explain-prism" },
        { "id": "i3", "image": "asset-se-lens-leaf", "bin": "b1", "label_key": "obs.lens_leaf", "audio": "asset-vo-se-lens-leaf", "explain_audio": "asset-vo-se-explain-lens" },
        { "id": "i4", "image": "asset-se-sail-boat", "bin": "b2", "label_key": "obs.sail_boat", "audio": "asset-vo-se-sail-boat", "explain_audio": "asset-vo-se-explain-sail" },
        { "id": "i5", "image": "asset-se-inverted-glass", "bin": "b2", "label_key": "obs.inverted_glass", "audio": "asset-vo-se-inverted-glass", "explain_audio": "asset-vo-se-explain-inverted-glass" },
        { "id": "i6", "image": "asset-se-cloud-rain", "bin": "b3", "label_key": "obs.cloud_rain", "audio": "asset-vo-se-cloud-rain", "explain_audio": "asset-vo-se-explain-cloud" },
        { "id": "i7", "image": "asset-se-condensation", "bin": "b3", "label_key": "obs.condensation", "audio": "asset-vo-se-condensation", "explain_audio": "asset-vo-se-explain-condensation" },
        { "id": "i8", "image": "asset-se-steam-cup", "bin": "b3", "label_key": "obs.steam_cup", "audio": "asset-vo-se-steam-cup", "explain_audio": "asset-vo-se-explain-steam" }
      ],
      "explain_on_correct": true,
      "shuffle": true
    }
  ],
  "assets": {
    "images": [
      "asset-se-bin-light", "asset-se-bin-air", "asset-se-bin-water",
      "asset-se-straw-bent", "asset-se-rainbow", "asset-se-prism", "asset-se-lens-leaf",
      "asset-se-straw-suction", "asset-se-balloon-release", "asset-se-sail-boat",
      "asset-se-inverted-glass", "asset-se-steam-cup", "asset-se-condensation",
      "asset-se-puddle-drying", "asset-se-cloud-rain"
    ],
    "audio": [
      "asset-vo-se-bin-light", "asset-vo-se-bin-air", "asset-vo-se-bin-water",
      "asset-vo-se-straw-bent", "asset-vo-se-rainbow", "asset-vo-se-prism", "asset-vo-se-lens-leaf",
      "asset-vo-se-straw-suction", "asset-vo-se-balloon-release", "asset-vo-se-sail-boat",
      "asset-vo-se-inverted-glass", "asset-vo-se-steam-cup", "asset-vo-se-condensation",
      "asset-vo-se-puddle-drying", "asset-vo-se-cloud-rain",
      "asset-vo-se-explain-straw-bent", "asset-vo-se-explain-rainbow", "asset-vo-se-explain-prism",
      "asset-vo-se-explain-lens", "asset-vo-se-explain-straw-suction", "asset-vo-se-explain-balloon",
      "asset-vo-se-explain-sail", "asset-vo-se-explain-inverted-glass", "asset-vo-se-explain-steam",
      "asset-vo-se-explain-condensation", "asset-vo-se-explain-puddle", "asset-vo-se-explain-cloud"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gse-intro",
    "vo.instruction": "asset-vo-gse-instruction",
    "vo.instruction_repeat": "asset-vo-gse-instruction-slow",
    "vo.hint": "asset-vo-gse-hint",
    "vo.explain_correct": "asset-vo-gse-explain-correct",
    "vo.retry": "asset-vo-retry-junior",
    "vo.correct": "asset-vo-correct-junior",
    "vo.level_complete": "asset-vo-level-complete-junior",
    "vo.game_complete": "asset-vo-gse-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### الدعاوى الثلاث كما تُنطق

| السلة | نصّ الدعوى | الحلقة المصدر |
|---|---|---|
| `claim.light_bends` | «الضوء يتغيّر مساره حين ينتقل بين الهواء والماء والزجاج.» | [1 · انكسار الضوء](../science-in-a-minute/ep-01-light-refraction.md) |
| `claim.air_pushes` | «الهواء حولنا يدفع في كل اتجاه.» | [2 · ضغط الهواء](../science-in-a-minute/ep-02-air-pressure.md) |
| `claim.water_changes_state` | «الماء يتحوّل بين بخار وسائل ويعود.» | [5 · دورة الماء](../science-in-a-minute/ep-05-water-cycle.md) |

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — 3 صور سلات مخطّطية + 12 صورة مشاهدة `1:1` + غلاف اللعبة | ❌ مطلوب |
| `voice_prompts` — 10 مفاتيح + 15 وصف مشاهدة/دعوى + 12 جملة تفسير | ❌ مطلوب |
| `engine_implementation` — محرك `sort_bins` نفسه | ❌ غير مُنفَّذ |
| ترحيل `engine_id` في قاعدة البيانات من `engine-match` إلى `sort_bins` | ❌ مطلوب |
| 🔴 **مراجعة علمية معتمدة** لكل إسناد مشاهدة ← مبدأ، وللحالة الملتبسة خاصةً | ❌ مانع نشر |
| تسجيل `sci.method.evidence_claim` على سلسلة «علوم في دقيقة» في جدول الأهداف | ❌ في `open_questions` |

🔴 **لا نصّ مطبوع داخل أي صورة** — نصوص الدعاوى وأوصاف المشاهدات من ملفات الترجمة وحدها.
