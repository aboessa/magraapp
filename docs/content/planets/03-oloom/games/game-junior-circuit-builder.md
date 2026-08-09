# ابن الدائرة — `game-junior-circuit-builder`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.** المحرك نفسه غير مُنفَّذ.
>
> 🔴 **الحزمة لا تُنشر بلا توقيع مراجع سلامة** — بند صريح في [حزم كوكب علوم](../game-packs.md).

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-junior-circuit-builder` |
| `title_ar` | ابن الدائرة |
| الكوكب | `oloom` — [03-oloom](../README.md) |
| السلسلة | `future-lab` — مختبر المستقبل |
| `age_min` / `age_max` | 9 / 12 · المسار `junior` |
| `reading_level` / `interaction_mode` | `independent` / `independent` |
| `supervision_level` / `difficulty` | `recommended` / `hard` |
| `max_attempts` | `null` — محاولات غير محدودة · **والتوقع الخاطئ ليس محاولة فاشلة أصلًا** |
| المحرك المُعتمد | `sim_lab` — المحاكاة `circuit` |
| المحرك القديم في قاعدة البيانات | `engine-builder` ❌ لا يطابق أي عقد محرك |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `sci.energy.series_circuit` |
| الحلقة المرتبطة | [الحلقة 3 — الدائرة الكهربية](../future-lab/ep-03-circuit.md) |
| الهدف | يفسّر الطفل **تقاسم الطاقة في التوالي**: زيادة المصابيح تُخبي الضوء، وزيادة البطاريات ترفعه |
| المعيار | يختار التفسير الصحيح في 3 مستويات من 3 **بعد** تسجيل عدد كافٍ من المحاولات |

الحلقة 3 تطرح سؤالًا واحدًا: «بطارية واحدة تُشعل مصباحًا. فإن أضفنا مصباحين، هل نحصل على ضوء أكثر؟» واللعبة **لا تشرح الجواب**، بل تجعل الطفل يستخرجه من جدول نتائجه: يثبّت متغيرًا، يغيّر آخر، يقرأ العمود، ثم يفسّر. 🔴 **والحزمة لا تطلب من الطفل شيئًا في العالم الحقيقي إطلاقًا** — وهذا شرط، لا تفصيل.

## 🔴 بند السلامة — أشدّ بنود المنصة

هذه اللعبة موضوعها **قابل للتقليد بشيء قاتل**. البنود إلزامية ومأخوذة من `safety_notes` في الحلقة 3 ومن [حزم الكوكب](../game-packs.md):

| # | البند |
|---:|---|
| 1 | 🔴 **رسالة عند بدء كل مستوى:** «هذه محاكاة. لا تجرّب بكهرباء حقيقية.» — والصيغة **موجِّهة لا مخيفة** |
| 2 | 🔴 **رمز السلامة `#FF9F1C` ظاهر في زاوية الشاشة طول اللعب** بلا انقطاع |
| 3 | 🔴 **كل الأصول مخطّطية** — لا مقبس، ولا سلك واقعي، ولا شرارة، ولا دخان |
| 4 | 🔴 **لا بطارية قُرص (زرّية) في أي أصل** — لا شكلها ولا اسمها |
| 5 | 🔴 **لا نشاط منزلي مقترن بهذه اللعبة** — ولا زر «جرّبها في البيت» |
| 6 | 🔴 `supervision_level = recommended` مع `safety_note_key` غير فارغ في كل مستوى |
| 7 | 🔴 **لا تُنشر بلا توقيع مراجع سلامة وتوقيع مراجع علمي** |

## المحرك المختار وتبريره

**`sim_lab`** — عقد المحرك: [`11-sim-lab.md`](../../../../games/engines/11-sim-lab.md).

المحرك القديم `engine-builder` لا يقابل أي عقد، والاسم نفسه مضلِّل: ما تعلّمه الحلقة ليس **تجميع** دائرة بل **استنتاج علاقة** بين متغيّراتها. وعقد `sim_lab` يعلن مساره **`junior`** وهو مسار اللعبة، ويعلن ضمن محاكاته المدعومة عند الإطلاق **`circuit` بمتغيّري «عدد البطاريات، عدد المصابيح» وعلاقة «طردية / عكسية»** — أي أن هذه المحاكاة بالذات **موجودة نصًّا في العقد** ولا تحتاج توسيعًا. ومراحله الثلاث الإلزامية (توقّع ← جرّب ← فسّر) هي بنية الحلقة نفسها. والأهم قراره التربوي: **التوقع الخاطئ ليس فشلًا ولا يُخصم، و`score` يُحتسب من التفسير وحده** — وهذا ما يجعل اللعبة آمنة تربويًا لطفل يتوقع «ضوءًا أكثر» فيجد العكس. ويفرض العقد `results_table` نصيًا و`min_trials_before_explain` فيمنع التفسير قبل جمع بيانات كافية. البدائل مرفوضة بوضوح: `block_code` يبرمج ولا يقيس علاقة فيزيائية، و`logic_pattern` يستنتج قاعدة من أشكال لا من قياسات، و`sort_bins` يصنّف ولا يجرّب.

## الميكانيكا الأساسية

لوحة محاكاة مخطّطية: بطاريات ومصابيح موصولة **على التوالي**. لكل متغيّر منزلق **مع أزرار +/−**. الطفل يمرّ في ثلاث مراحل إلزامية لكل مستوى: يختار فرضية، ثم يجرّب قيمًا ويسجّل النتائج في **جدول نصّي**، ثم يختار التفسير.

## حلقة اللعب خطوة بخطوة

1. 🔴 رسالة السلامة: «هذه محاكاة. لا تجرّب بكهرباء حقيقية.» — تُقرأ صوتيًا وتُعرض نصيًا، ورمز السلامة يبقى ظاهرًا.
2. `vo.intro`: «مختبر مجرة. لنجرّب معًا.» ثم `vo.instruction`: «اتبع المراحل الثلاث: توقّع، جرّب، فسّر.»
3. **المرحلة 1 — توقّع:** `vo.stage_predict` «قبل أن نجرّب، ما توقعك؟» ويختار الطفل فرضية من الخيارات. `vo.prediction_recorded`: «سجّلنا توقعك. لنرَ النتيجة.» **بلا أي حكم على الفرضية.**
4. **المرحلة 2 — جرّب:** `vo.stage_experiment` «حرّك المنزلق، وراقب النتيجة.» كل تغيير يُنطق قيمته، والنتيجة تُضاف إلى الجدول: `vo.trial_recorded` «أضفنا النتيجة إلى الجدول.»
5. إن حاول الطفل التفسير قبل `min_trials_before_explain`: `vo.need_more_trials` «جرّب قيمة أخرى قبل التفسير.» — **منع لطيف لا رفض**.
6. **المرحلة 3 — فسّر:** `vo.stage_explain` «الآن فسّر ما حدث.» ويختار الطفل التفسير المرتبط بالبيانات.
7. **تفسير صحيح:** `vo.correct` من بنك `junior` + `vo.explain_final` يربط التفسير بالجدول.
8. **تفسير غير صحيح:** إشارة إلى **البيانات** لا إلى الطفل: «قارن نتيجتك عند بطارية واحدة وعند ثلاث.»
9. عند إكمال المستوى: `vo.level_complete`. وبعد المستوى الثالث: `vo.game_complete` + ملصق واحد في «مجموعتي».
10. الخروج متاح في أي لحظة ويحفظ **الجدول** كما هو.

## المستويات

| المستوى | الهدف | العناصر (متغيّرات + مقياس) | المشتّتات (تفسيرات خاطئة) | شرط النجاح |
|---:|---|---|---:|---|
| 1 | متغيّر واحد: **عدد المصابيح** على التوالي — علاقة **عكسية** | 1 متغيّر + سطوع كل مصباح · 3 محاولات على الأقل | 2 | تفسير صحيح واحد |
| 2 | متغيّر واحد: **عدد البطاريات** — علاقة **طردية**، مع قراءة الجدول | 1 متغيّر + سطوع · 3 محاولات | 2 | تفسير صحيح واحد |
| 3 | **المتغيّران معًا**: تثبيت أحدهما وتغيير الآخر | 2 متغيّران + سطوع · 4 محاولات | 3 | تفسير صحيح واحد يذكر **الاتجاهين** |

عدد العناصر على الشاشة في أسوأ حالة: منزلقان + مقياس + جدول + رمز سلامة = **5** ≤ `max_elements_on_screen = 6` ✓.

🔴 **المشتّتات هنا تفسيرات معقولة لا سخيفة:** «المصابيح تستهلك البطارية فيخبو الضوء» تفسير **قريب من الصحيح وغير دقيق**، وهو المشتّت الأهم في المستوى 1 لأنه يخلط بين **تقاسم الجهد الآني** و**نفاد الطاقة مع الزمن**.

## التدرّج في الصعوبة

بُعد واحد في كل مستوى: أولًا العلاقة **العكسية** وحدها (وهي المفارقة التي تفتح الحلقة)، ثم العلاقة **الطردية** مع تدريب صريح على **قراءة الجدول**، ثم **ضبط المتغيّرات**: أن يثبّت الطفل واحدًا ويغيّر الآخر ويفسّر الاتجاهين معًا. عدد المحاولات المطلوبة يرتفع من 3 إلى 4 لأن متغيّرين يحتاجان بيانات أكثر. لا مؤقت، ولا حد لعدد التجارب الأقصى.

## `instructions_ar` — كما يسمعها الطفل

> «هذه محاكاة على الشاشة. **لا تجرّب بكهرباء حقيقية أبدًا.** أمامك دائرة على التوالي: بطاريات ومصابيح. اتبع ثلاث مراحل. أولًا: توقّع ماذا يحدث للسطوع — وتوقعك مسجَّل ولا يُحسب عليك خطأً. ثانيًا: غيّر القيمة بالمنزلق أو بزرّي زائد وناقص، وراقب الجدول يمتلئ. ثالثًا: اختر التفسير الذي تدلّ عليه أرقامك أنت. وإن كان توقعك مختلفًا عن النتيجة، فهذا **اكتشاف** لا خطأ.»

`vo.instruction_repeat` = النص نفسه بلا تسريع.

## منطق النجاح

- المستوى ينجح **بإكمال المراحل الثلاث مع تفسير صحيح**، ولا يُقبل التفسير قبل `min_trials_before_explain`.
- `score` = **1 للتفسير فقط** · `max_score` = 1 — بحسب [05](../../../../games/05-mastery-and-measurement.md): «`sim_lab`: التوقع الخاطئ **لا يُخصم**. التفسير وحده يُقاس.»
- `attempts` تُكتب **مرة واحدة لكل مستوى** بـ`event_id` ثابت عبر `POST /api/v1/family/progress`.
- `mastery` تُحدَّث على `sci.energy.series_circuit`؛ والوصول إلى `independent` يتطلب **تفسيرًا صحيحًا بلا مساعدة في 3 محاولات**.
- 🔴 `answers` تُسجّل **التوقع والتفسير كبندين منفصلين** بلا أي بيانات شخصية، حتى يرى ولي الأمر أن الطفل غيّر رأيه بالبيانات.

## منطق الفشل

بحسب [04 — التشجيع والفشل](../../../../games/04-encouragement-and-failure.md)، وهذا المحرك **مستثنى صريحًا** من وصف التوقع بالفشل:

| الحالة | ما يحدث |
|---|---|
| توقّع خاطئ | 🔴 «لنرَ ما سيحدث فعلًا.» — **بلا أي سلبية، وبلا خصم، ولا يُحتسب محاولة فاشلة** |
| تفسير خاطئ (1) | «قارن نتيجتك عند مصباح واحد وعند ثلاثة.» — إشارة إلى **البيانات** |
| تفسير خاطئ (2) | إبراز **جدول النتائج المسجّلة** والعمود الحاسم |
| تفسير خاطئ (3) | استبعاد خيار واحد |
| تفسير خاطئ (4) | شرح كامل **مربوط بأرقام الطفل نفسه**، ثم متابعة عادية |
| 5+ | «نلعب شيئًا آخر؟» مع اقتراح تجربة أبسط — **بلا أي وصف بالفشل** |

🔴 **لا رسالة تُوحي بأن الفرضية الخاطئة عيب.** ولا عدّ أخطاء معروض، ولا قفل لأي مستوى، ولا فقدان لأي ملصق. تقرير ولي الأمر وصفي: «يجمع بيانات كافية قبل التفسير، ويحتاج تدريبًا على تثبيت متغيّر واحد» — لا نسب ولا عدّ أخطاء.

## النقاط والمكافآت

لا نقاط ولا زمن ولا نسبة دقة معروضة للطفل. ملصق هادئ واحد عند إكمال اللعبة يُضاف إلى «مجموعتي» ولا يُفقد أبدًا. **ممنوع:** عملة داخلية · شراء داخلي · صناديق عشوائية · إعلانات · streaks · لوحة ترتيب · مقارنة بأطفال آخرين.

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| تسجيل التوقع | «سجّلنا توقعك. لنرَ النتيجة.» |
| تسجيل محاولة | «أضفنا النتيجة إلى الجدول.» |
| محاولات غير كافية | «جرّب قيمة أخرى قبل التفسير.» |
| نجاح | «تحليل دقيق.» · «صحيح — لاحظت القاعدة.» — بنبرة `junior` |
| تفسير غير صحيح | «ليس هذا التفسير. راجع الجدول.» |
| شرح نهائي — المستوى 1 | «المصابيح على التوالي **تتقاسم** الجهد نفسه، فيخبو ضوء كل مصباح.» |
| شرح نهائي — المستوى 2 | «زيادة البطاريات ترفع الجهد الكلي، فيزداد السطوع.» |
| شرح نهائي — المستوى 3 | «البطاريات ترفع السطوع، والمصابيح تخفضه. وحين تغيّر واحدًا فقط ترى أثره وحده.» |
| إكمال اللعبة | «أتممت التجربة وفسّرتها.» |

🔴 **الشرح يربط دائمًا بأرقام الطفل**، لا يقدّم قاعدة مجرّدة من فوق.

## إمكانية الوصول

بحسب [06 — إمكانية الوصول](../../../../games/06-accessibility.md):

- 🔴 **جدول النتائج نصّي** لا رسمًا بيانيًا فقط، ومتاح لقارئ الشاشة صفًّا صفًّا.
- 🔴 **أزرار +/− بديلة للمنزلق إلزامية** — لا يُشترط سحب دقيق.
- كل قيمة **تُنطق عند التغيير**، وكل صف جدول له وصف نصي («ثلاثة مصابيح، السطوع منخفض»).
- السطوع **لا يُدلّ عليه باللون وحده**: قيمة رقمية + وصف نصي + حجم توهج، مع **نقش** في المخطط.
- الرسوم المتحركة تُختصر عند «تقليل الحركة» **مع بقاء النتيجة النصية كاملة**.
- **لا مؤقت** · `TextScaler` حتى 2.0× بلا قطع نص · **لا وميض > 3Hz** — والسطوع يُعرض كتوهج ثابت لا نبض.
- يعمل بالـD-pad على TV: تنقّل بين المتغيّرات والأزرار والخيارات.
- 🔴 **اللعبة قابلة للعب بلا صوت بالكامل** — كل نطق له مقابل نصي.
- 🔴 **رمز السلامة له وصف بديل نصي** ولا يُعتمد على لونه البرتقالي وحده.

## `help_system`

```json
{
  "hint_after_failed_attempts": 2,
  "hint_type": "narrow_options",
  "repeat_instructions_button": true,
  "simplify_after_failed_attempts": 3,
  "solution_after_failed_attempts": 4,
  "counts_as_help_used": true
}
```

🔴 **العتبات تُحتسب على التفسير وحده.** التوقع الخاطئ **لا يزيد العدّاد إطلاقًا** — وهذا فرق جوهري عن كل المحركات الأخرى، ويجب أن يُنفَّذ في الطبقة المشتركة لا في المحرك.

## حزمة المحتوى — `content_pack`

مطابقة لـ[`sim_lab.v1.schema.json`](../../../../games/schemas/sim_lab.v1.schema.json) و[العقد الأساس](../../../../games/schemas/content-pack.base.schema.json). `results_table` إلزاميًا `true`، و`safety_note_key` غير فارغ في كل مستوى.

```json
{
  "pack_version": 1,
  "engine_id": "sim_lab",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "sim": "circuit",
      "variables": [
        { "id": "lamps_count", "label_key": "var.lamps_count", "min": 1, "max": 4, "step": 1, "unit_key": "unit.lamp" }
      ],
      "measured": { "id": "lamp_brightness", "label_key": "var.lamp_brightness", "unit_key": "unit.brightness_level" },
      "hypothesis_options": [
        "hyp.more_lamps_brighter",
        "hyp.more_lamps_dimmer",
        "hyp.more_lamps_no_change"
      ],
      "expected_relationships": { "lamps_count": "negative" },
      "explanation_options": [
        "exp.series_shares_voltage",
        "exp.lamps_drain_battery_fast",
        "exp.lamps_independent"
      ],
      "explanation_answer": "exp.series_shares_voltage",
      "results_table": true,
      "min_trials_before_explain": 3,
      "supervision_level": "recommended",
      "safety_note_key": "sci.safety.simulation_only_no_real_electricity"
    },
    {
      "level": 2,
      "sim": "circuit",
      "variables": [
        { "id": "batteries_count", "label_key": "var.batteries_count", "min": 1, "max": 4, "step": 1, "unit_key": "unit.battery" }
      ],
      "measured": { "id": "lamp_brightness", "label_key": "var.lamp_brightness", "unit_key": "unit.brightness_level" },
      "hypothesis_options": [
        "hyp.more_batteries_brighter",
        "hyp.more_batteries_dimmer",
        "hyp.more_batteries_no_change"
      ],
      "expected_relationships": { "batteries_count": "positive" },
      "explanation_options": [
        "exp.more_voltage_more_brightness",
        "exp.battery_count_irrelevant",
        "exp.brightness_depends_on_lamp_only"
      ],
      "explanation_answer": "exp.more_voltage_more_brightness",
      "results_table": true,
      "min_trials_before_explain": 3,
      "supervision_level": "recommended",
      "safety_note_key": "sci.safety.simulation_only_no_real_electricity"
    },
    {
      "level": 3,
      "sim": "circuit",
      "variables": [
        { "id": "batteries_count", "label_key": "var.batteries_count", "min": 1, "max": 4, "step": 1, "unit_key": "unit.battery" },
        { "id": "lamps_count", "label_key": "var.lamps_count", "min": 1, "max": 4, "step": 1, "unit_key": "unit.lamp" }
      ],
      "measured": { "id": "lamp_brightness", "label_key": "var.lamp_brightness", "unit_key": "unit.brightness_level" },
      "hypothesis_options": [
        "hyp.batteries_up_lamps_down",
        "hyp.both_increase_brightness",
        "hyp.only_lamps_matter",
        "hyp.only_batteries_matter"
      ],
      "expected_relationships": { "batteries_count": "positive", "lamps_count": "negative" },
      "explanation_options": [
        "exp.batteries_raise_lamps_share",
        "exp.both_raise_brightness",
        "exp.lamps_only_matter",
        "exp.nothing_matters"
      ],
      "explanation_answer": "exp.batteries_raise_lamps_share",
      "results_table": true,
      "min_trials_before_explain": 4,
      "supervision_level": "recommended",
      "safety_note_key": "sci.safety.simulation_only_no_real_electricity"
    }
  ],
  "assets": {
    "images": [
      "asset-cb-schematic-battery", "asset-cb-schematic-lamp-on", "asset-cb-schematic-lamp-dim",
      "asset-cb-schematic-wire", "asset-cb-results-table", "asset-cb-safety-badge"
    ],
    "audio": [
      "asset-vo-cb-value-1", "asset-vo-cb-value-2", "asset-vo-cb-value-3", "asset-vo-cb-value-4"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-cb-intro",
    "vo.instruction": "asset-vo-cb-instruction",
    "vo.instruction_repeat": "asset-vo-cb-instruction-slow",
    "vo.safety_notice": "asset-vo-cb-safety-notice",
    "vo.stage_predict": "asset-vo-stage-predict",
    "vo.stage_experiment": "asset-vo-stage-experiment",
    "vo.stage_explain": "asset-vo-stage-explain",
    "vo.prediction_recorded": "asset-vo-prediction-recorded",
    "vo.trial_recorded": "asset-vo-trial-recorded",
    "vo.need_more_trials": "asset-vo-need-more-trials",
    "vo.hint": "asset-vo-cb-hint",
    "vo.retry_explain": "asset-vo-retry-explain",
    "vo.correct": "asset-vo-correct-junior",
    "vo.explain_final": "asset-vo-cb-explain-final",
    "vo.level_complete": "asset-vo-level-complete-junior",
    "vo.game_complete": "asset-vo-cb-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

### مفاتيح الفرضيات والتفسيرات — ما تعنيه

| المفتاح | النص المنطوق |
|---|---|
| `hyp.more_lamps_dimmer` | «كلما زادت المصابيح خبا ضوء كل مصباح.» |
| `exp.series_shares_voltage` | «المصابيح على التوالي تتقاسم الجهد نفسه.» |
| `exp.lamps_drain_battery_fast` | 🔴 مشتّت **قريب من الصحيح**: «المصابيح تستهلك البطارية بسرعة.» — صحيح مع الزمن، لكنه **ليس** تفسير الخبو الآني |
| `exp.batteries_raise_lamps_share` | «البطاريات ترفع الجهد الكلي، والمصابيح تتقاسمه.» |

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — أصول **مخطّطية** فقط: بطارية، مصباح مضيء وخابٍ، سلك، جدول، رمز سلامة | ❌ مطلوب |
| `voice_prompts` — 17 مفتاحًا + نطق كل قيمة عند التغيير | ❌ مطلوب |
| `engine_implementation` — محرك `sim_lab` + محاكاة `circuit` | ❌ غير مُنفَّذ |
| ترحيل `engine_id` في قاعدة البيانات من `engine-builder` إلى `sim_lab` | ❌ مطلوب |
| 🔴 **توقيع مراجع سلامة** + **توقيع مراجع علمي** | ❌ مانع نشر مطلق |

🔴 **لا نصّ مطبوع داخل أي صورة** — تسميات الجدول والمتغيّرات من ملفات الترجمة وحدها.
