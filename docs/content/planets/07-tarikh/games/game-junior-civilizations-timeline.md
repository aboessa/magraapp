# خط الحضارات — `game-junior-civilizations-timeline`

> 🔴 **حالة التنفيذ: `design only`.** مواصفة تحريرية فقط. **لا كود، ولا فنّ، ولا صوت مسجّل.** المحرك نفسه غير مُنفَّذ.
>
> 🔴 **الحزمة لا تُنشر بلا مراجعة تاريخية معتمدة** — بند في [عقد المحرك](../../../../games/engines/12-timeline-map.md#معايير-القبول) وفي [حزم الكوكب](../game-packs.md).

## بطاقة اللعبة

| الحقل | القيمة |
|---|---|
| `id` | `game-junior-civilizations-timeline` |
| `title_ar` | خط الحضارات |
| الكوكب | `tarikh` — [07-tarikh](../README.md) |
| السلسلة | `journey-of-civilizations` — رحلة الحضارات |
| `age_min` / `age_max` | 9 / 12 · المسار `junior` |
| `reading_level` / `interaction_mode` | `independent` / `independent` |
| `supervision_level` / `difficulty` | `none` / `hard` |
| `max_attempts` | `null` — محاولات غير محدودة |
| المحرك المُعتمد | `timeline_map` — الأنماط `timeline` ثم `map` |
| المحرك القديم في قاعدة البيانات | `engine-sequence` ❌ لا يطابق أي عقد محرك |

## الهدف التعليمي المقاس

| الحقل | القيمة |
|---|---|
| `objective_code` | `hist.civ.trade_geography` |
| الحلقة المرتبطة | [الحلقة 4 — طرق التجارة](../journey-of-civilizations/ep-04-trade-routes.md) |
| الهدف | يضع الطفل الحدث في **زمنه** على خط الزمن، والمكان في **موقعه** على الخريطة، ويقبل أن التقريب في التاريخ ليس خطأً |
| المعيار | يضع 4 عناصر داخل هامش القبول، بـ3 من 4 صحيحة **من أول محاولة** |

الحلقة 4 تربط الحضارة بجغرافيتها: الطريق يمرّ بمكان، والمكان يفسّر لماذا نمت المدينة هناك. اللعبة تقيس هذا الربط في اتجاهين: **الزمن أولًا** (مستويان)، ثم **المكان** (مستوى ثالث) — وهو نفس تدرّج [حزم الكوكب](../game-packs.md) الذي يؤخّر الخريطة عن خط الزمن لسبب **حمل معرفي** لا ترتيب اعتباطي.

## المحرك المختار وتبريره

**`timeline_map`** — عقد المحرك: [`12-timeline-map.md`](../../../../games/engines/12-timeline-map.md).

المحرك القديم `engine-sequence` لا يقابل أي عقد، والبديل الظاهري `sequence_order` **يفقد نصف الهدف**: هو يرتّب لوحات ترتيبًا نسبيًا (أول ← آخر) ويكتب `score = 1` للمستوى كله، ولا يعرف سنةً ولا موقعًا ولا هامش تقريب. أما `timeline_map` فمساره المعلن **`junior`** وهو مسار اللعبة حرفيًا، وهدفه التعليمي المعلن **«تسلسل تاريخي · موقع جغرافي · ربط الزمان بالمكان»** — أي هدف الحلقة 4 نصًّا. ويعلن أنماطه الثلاثة `timeline` و`map` و`both`، ويوفّر `tolerance_years` و`tolerance_km` فيجعل **الهامش جزءًا من العقد** لا تسهيلًا؛ وهذا بند تربوي حاسم في هذا الكوكب: كثير من التواريخ تقديري، وطلب سنة بعينها **يعلّم الطفل دقّة زائفة**. ويفرض العقد **التخزين ميلاديًا دائمًا** مع عرض هجري أو ميلادي بحسب اللغة، و`mirror_in_rtl: false` للخريطة مقابل **عكس خط الزمن** في RTL. ويكتب `score` = العناصر الصحيحة من أول محاولة، وهو المقياس الذي يطلبه معيار اللعبة. 🔴 **ولا يوجد أي توسيع فئة عمرية هنا** — بخلاف حزمة `tm-neighborhood` في كوكب العالم حولنا التي تطلب `kids` وتحتاج توقيع فريق المحرك؛ هذه الحزمة على المسار المعلن نفسه.

## الميكانيكا الأساسية

**المستويان 1 و2:** خط زمن أفقي بمرساة مرجعية واحدة، وبطاقات أحداث تُسحب إلى موضعها على الخط — أو **تُلمس البطاقة ثم يُلمس الموضع، مع أزرار تحريك دقيق**. البطاقة تستقر إن كانت داخل `tolerance_years`.

**المستوى 3:** خريطة إقليمية بلا حدود سياسية، وبطاقات مدن تُسحب إلى موقعها. البطاقة تستقر إن كانت داخل `tolerance_km`.

🔴 **خط الزمن يُعكس في RTL. الخريطة لا تُعكس أبدًا.** والقاعدتان تعملان في التطبيق نفسه، ويجب أن تُختبرا صراحة في `ar` و`en`.

## حلقة اللعب خطوة بخطوة

1. `vo.intro`: «رحلة في الزمان والمكان.»
2. `vo.instruction`: «ضع كل حدث في زمنه على الخط.» — وفي المستوى 3: «ضع كل مكان على الخريطة.» + زر إعادة التعليمة **ظاهر دائمًا**.
3. تُعرض المرساة المرجعية على خط الزمن (`show_reference_anchor`) لتكون نقطة قياس معروفة.
4. عند لمس أي بطاقة يُنطق اسم الحدث (`vo.event_label.*`)، وكل موضع على الخط له وصف نصي («القرن الثامن الميلادي»).
5. الطفل يسحب البطاقة أو يلمس الموضع، ثم يضبط بأزرار التحريك الدقيق.
6. **داخل الهامش:** تستقر البطاقة + `vo.explain_event` يقول الحقيقة التاريخية موجزة.
7. **خارج الهامش:** توجيه **اتجاهي** لا رفض: «أقدم من ذلك.» · «أحدث من ذلك.» · «إلى الشرق أكثر.»
8. عند وضع كل العناصر: `vo.level_complete`.
9. بعد المستوى الثالث: `vo.game_complete` + ملصق واحد يُضاف إلى «مجموعتي».
10. الخروج متاح في أي لحظة ويحفظ المستوى الحالي.

## المستويات

| المستوى | الهدف | النمط | العناصر | المشتّتات | شرط النجاح (الهامش) |
|---:|---|---|---:|---:|---|
| 1 | ترتيب زمني بفوارق قرون واسعة | `timeline` | 3 أحداث | 0 | كل حدث داخل **±100 سنة** |
| 2 | ترتيب زمني أدقّ على مدى 900 سنة | `timeline` | 4 أحداث | 0 | كل حدث داخل **±75 سنة** |
| 3 | موقع جغرافي على طريق تجاري | `map` | 4 مدن | 0 | كل مدينة داخل **±300 كم** |

🔴 **لا مشتّتات في هذا المحرك:** لا توجد بطاقات زائدة ولا خيارات خاطئة معروضة. ما يقوم بدور الصعوبة هو **ضيق الهامش** و**تقارب الأحداث**. وعدد العناصر في أسوأ حالة 4 ≤ `max_elements_on_screen = 5` ✓.

🔴 **لا سنوات في المستوى 3.** نمط `map` يطلب الموقع وحده، والمخطط لا يوجب `year` للحدث؛ ودمج الزمان والمكان في شاشة واحدة (`both`) مؤجَّل إلى حزمة أعلى بحسب تدرّج الكوكب.

## التدرّج في الصعوبة

بُعد واحد في كل مستوى: أولًا **الترتيب الزمني بهامش واسع** (±100)، ثم **حدث رابع وهامش أضيق** (±75) على المدى نفسه، ثم **تغيير البُعد كله** من الزمن إلى المكان. لا يزيد عدد العناصر عن 4، ولا مؤقت، ولا حد محاولات. 🔴 **الهامش لا يضيق إلى أقل من ±75 سنة في هذه الحزمة** لأن ثلاثة من تواريخها تقديرية بطبيعتها، وطلب دقة أعلى من دقة المصدر خطأ منهجي لا تحدٍّ.

## `instructions_ar` — كما يسمعها الطفل

> «رحلة في الزمان والمكان. أمامك خط زمن، وعليه علامة مرجعية تعرفها. خُذ كل بطاقة وضعها في زمنها التقريبي — **والتقريب هنا ليس خطأً**، فكثير من التواريخ تقديري. إن ابتعدت سأقول لك: أقدم من ذلك، أو أحدث من ذلك. وفي المرحلة الأخيرة تتغيّر المهمة: ستضع مدنًا على خريطة طريق تجاري، وسأدلّك بالاتجاه: إلى الشرق أكثر، أو إلى الجنوب.»

`vo.instruction_repeat` = النص نفسه بلا تسريع.

## منطق النجاح

- المستوى ينجح بوضع **كل** العناصر داخل هامشها. لا مؤقت، ولا حد محاولات.
- `score` = العناصر الصحيحة **من أول محاولة** · `max_score` = عدد العناصر (3 ثم 4 ثم 4) — بحسب [05](../../../../games/05-mastery-and-measurement.md).
- `attempts` تُكتب **مرة واحدة لكل مستوى** بـ`event_id` ثابت عبر `POST /api/v1/family/progress`.
- `mastery` تُحدَّث على `hist.civ.trade_geography`.
- 🔴 **التقويم:** القيم تُخزَّن **ميلاديًا دائمًا**، والعرض هجري أو ميلادي بحسب اللغة والمنطقة، **والقيمة المعروضة لا تُخزَّن أبدًا**.

## منطق الفشل

بحسب [04 — التشجيع والفشل](../../../../games/04-encouragement-and-failure.md)، والتوجيه **اتجاهي** لا حكمي:

| المحاولة غير الموفقة | ما يحدث |
|---:|---|
| 1 | سهم واتجاه: «أقدم من ذلك.» · «أحدث من ذلك.» · «إلى الشرق أكثر.» — **بلا كلمة «خطأ»** |
| 2 | تضييق المدى المعروض حول الجواب (تكبير المقطع الزمني أو المنطقة) |
| 3 | إظهار **حدث مرجعي معروف** كمرساة إضافية |
| 4 | وضع العنصر تلقائيًا مع شرح تاريخي، ثم متابعة عادية |
| 5+ | «نلعب شيئًا آخر؟» مع اقتراح تحدٍّ أبسط — **بلا أي وصف بالفشل** |

🔴 **التقريب الصحيح يُمدَح لا الإصابة الحرفية** — بند في [الطبقات المشتركة للكوكب](../game-packs.md): «التشجيع يمدح **التقريب الصحيح** لا الإصابة الحرفية». ولا عدّ أخطاء معروض، ولا قفل لأي مستوى، ولا فقدان لأي ملصق. تقرير ولي الأمر وصفي: «يرتّب القرون ترتيبًا صحيحًا، ويحتاج تدريبًا على تقدير المواقع على الخريطة».

## النقاط والمكافآت

لا نقاط ولا زمن ولا نسبة دقة معروضة للطفل. ملصق هادئ واحد عند إكمال اللعبة يُضاف إلى «مجموعتي» ولا يُفقد أبدًا. **ممنوع:** عملة داخلية · شراء داخلي · صناديق عشوائية · إعلانات · streaks · لوحة ترتيب · مقارنة بأطفال آخرين.

## التغذية الراجعة التعليمية

| الحالة | ما يُنطق |
|---|---|
| نجاح | «استنتاج صحيح.» · «تحليل دقيق.» — بنبرة `junior`، كل 2–3 نجاحات |
| خارج الهامش زمنيًا | «أقدم من ذلك.» · «أحدث من ذلك.» |
| خارج الهامش مكانيًا | «إلى الشرق أكثر.» · «إلى الجنوب أكثر.» |
| تلميح | «ابدأ من العلامة المرجعية وعُدّ القرون منها.» · «ابحث عن النهر أولًا.» |
| شرح حدث | «بُنيت بغداد سنة 762 ميلادية.» |
| شرح مكاني | «دمشق على طريق يربط الساحل بالداخل.» |
| قاعدة عامة | «التقريب في التاريخ ليس خطأً.» |
| إكمال اللعبة | «أكملت الرحلة.» |

🔴 **لا معارك ولا حكّام في أي عنصر أو شرح** — قاعدة الكوكب، والعناصر كلها **مدن ومنشآت معرفة وأدوات**.

## إمكانية الوصول

بحسب [06 — إمكانية الوصول](../../../../games/06-accessibility.md):

- 🔴 **خط الزمن يُعكس في RTL · الخريطة لا تُعكس أبدًا** — والاختبار في `ar` و`en` إلزامي.
- 🔴 **بديل السحب إلزامي:** لمس العنصر ثم لمس الموضع، **مع أزرار تحريك دقيق** لضبط الموضع بلا دقة حركية.
- 🔴 **كل موضع له وصف نصي** («القرن الثامن الميلادي»، «شمال شرق الخريطة قرب النهر») — ولا يُعتمد على الموضع البصري وحده.
- هدف اللمس 56dp (الفئة `junior`).
- الصحيح/خارج الهامش **لا يُدلّ عليه باللون وحده**: سهم اتجاه + رمز + صوت.
- **لا مؤقت** · `TextScaler` حتى 2.0× بلا قطع نص · لا وميض > 3Hz · احترام «تقليل الحركة» (تضييق المدى يحدث بقفزة ثابتة لا بحركة).
- يعمل بالـD-pad على TV: تنقّل بين البطاقات والمواضع مع خطوة تحريك ثابتة.
- 🔴 **الخريطة محيّدة سياسيًا:** بلا حدود، وبلا أعلام، وبلا أسماء دول — تضاريس ومدن ونهر فقط.
- 🔴 **اللعبة قابلة للعب بلا صوت بالكامل** — كل توجيه اتجاهي له مقابل نصي وسهم مرئي.

## `help_system`

```json
{
  "hint_after_failed_attempts": 2,
  "hint_type": "direction_arrow",
  "repeat_instructions_button": true,
  "simplify_after_failed_attempts": 3,
  "solution_after_failed_attempts": 4,
  "counts_as_help_used": true
}
```

## 🔴 التواريخ — تحقق إلزامي قبل النشر

الحزمة **مواصفة تحريرية**، وكل سنة فيها **مرشَّحة للتحقق** لا مؤكَّدة. ولا تُنشر بلا مراجعة تاريخية معتمدة.

| العنصر | السنة المستخدمة | الحالة |
|---|---:|---|
| بناء بغداد | 762م | مأخوذة **حرفيًا من مثال [عقد المحرك](../../../../games/engines/12-timeline-map.md)** · تُراجَع مع الباقي |
| خريطة الإدريسي | 1154م | 🔴 `<FACT CHECK REQUIRED: سنة إنجاز خريطة الإدريسي>` |
| مرصد مراغة | 1259م | 🔴 `<FACT CHECK REQUIRED: سنة إنشاء مرصد مراغة>` |
| الطباعة بالحروف المعدنية المتحركة في أوروبا | نحو 1450م | 🔴 `<FACT CHECK REQUIRED: تاريخ تقريبي — يُقبل «نحو 1450» لا سنة بعينها>` |
| المرساة: بداية التقويم الهجري | 622م | مرساة **تقويمية** كما في مثال عقد المحرك · تُستخدم كنقطة قياس لا كمحتوى ديني |
| إحداثيات المدن الأربع | — | جغرافيا ثابتة · تُراجَع بالتدقيق العددي |

🔴 **الهوامش الواسعة (±100 و±75) ليست تسامحًا مع الجهل بل تعبيرًا عن دقة المصدر نفسه.**

## حزمة المحتوى — `content_pack`

مطابقة لـ[`timeline_map.v1.schema.json`](../../../../games/schemas/timeline_map.v1.schema.json) و[العقد الأساس](../../../../games/schemas/content-pack.base.schema.json). `unit` إلزاميًا `gregorian_year`، و`mirror_in_rtl` إلزاميًا `false`.

```json
{
  "pack_version": 1,
  "engine_id": "timeline_map",
  "progression": { "levels_to_finish": 3, "advance_on": "level_complete" },
  "levels": [
    {
      "level": 1,
      "mode": "timeline",
      "timeline": {
        "from": 600,
        "to": 1500,
        "unit": "gregorian_year",
        "display_calendar": "auto",
        "anchors": [
          { "year": 622, "label_key": "hist.anchor.hijri_epoch" }
        ]
      },
      "events": [
        { "id": "e1", "label_key": "hist.event.baghdad_founded", "image": "asset-tc-baghdad", "year": 762, "tolerance_years": 100, "explain_key": "hist.explain.baghdad" },
        { "id": "e2", "label_key": "hist.event.idrisi_map", "image": "asset-tc-idrisi-map", "year": 1154, "tolerance_years": 100, "explain_key": "hist.explain.idrisi_map" },
        { "id": "e3", "label_key": "hist.event.movable_type_europe", "image": "asset-tc-printing", "year": 1450, "tolerance_years": 100, "explain_key": "hist.explain.movable_type" }
      ],
      "show_reference_anchor": true
    },
    {
      "level": 2,
      "mode": "timeline",
      "timeline": {
        "from": 600,
        "to": 1500,
        "unit": "gregorian_year",
        "display_calendar": "auto",
        "anchors": [
          { "year": 622, "label_key": "hist.anchor.hijri_epoch" }
        ]
      },
      "events": [
        { "id": "e1", "label_key": "hist.event.baghdad_founded", "image": "asset-tc-baghdad", "year": 762, "tolerance_years": 75, "explain_key": "hist.explain.baghdad" },
        { "id": "e2", "label_key": "hist.event.idrisi_map", "image": "asset-tc-idrisi-map", "year": 1154, "tolerance_years": 75, "explain_key": "hist.explain.idrisi_map" },
        { "id": "e3", "label_key": "hist.event.maragheh_observatory", "image": "asset-tc-observatory", "year": 1259, "tolerance_years": 75, "explain_key": "hist.explain.maragheh" },
        { "id": "e4", "label_key": "hist.event.movable_type_europe", "image": "asset-tc-printing", "year": 1450, "tolerance_years": 75, "explain_key": "hist.explain.movable_type" }
      ],
      "show_reference_anchor": true
    },
    {
      "level": 3,
      "mode": "map",
      "map": {
        "region": "middle_east_north_africa",
        "projection": "equirectangular",
        "mirror_in_rtl": false
      },
      "events": [
        { "id": "e1", "label_key": "hist.place.baghdad", "image": "asset-tc-city-baghdad", "lat": 33.31, "lon": 44.36, "tolerance_km": 300, "explain_key": "hist.explain.place_baghdad" },
        { "id": "e2", "label_key": "hist.place.damascus", "image": "asset-tc-city-damascus", "lat": 33.51, "lon": 36.29, "tolerance_km": 300, "explain_key": "hist.explain.place_damascus" },
        { "id": "e3", "label_key": "hist.place.cairo", "image": "asset-tc-city-cairo", "lat": 30.04, "lon": 31.24, "tolerance_km": 300, "explain_key": "hist.explain.place_cairo" },
        { "id": "e4", "label_key": "hist.place.sanaa", "image": "asset-tc-city-sanaa", "lat": 15.35, "lon": 44.21, "tolerance_km": 300, "explain_key": "hist.explain.place_sanaa" }
      ],
      "show_reference_anchor": true
    }
  ],
  "assets": {
    "images": [
      "asset-tc-timeline-base", "asset-tc-map-base",
      "asset-tc-baghdad", "asset-tc-idrisi-map", "asset-tc-observatory", "asset-tc-printing",
      "asset-tc-city-baghdad", "asset-tc-city-damascus", "asset-tc-city-cairo", "asset-tc-city-sanaa"
    ],
    "audio": [
      "asset-vo-tc-baghdad", "asset-vo-tc-idrisi", "asset-vo-tc-observatory", "asset-vo-tc-printing",
      "asset-vo-tc-place-baghdad", "asset-vo-tc-place-damascus", "asset-vo-tc-place-cairo", "asset-vo-tc-place-sanaa",
      "asset-vo-tc-explain-baghdad", "asset-vo-tc-explain-idrisi", "asset-vo-tc-explain-maragheh",
      "asset-vo-tc-explain-printing"
    ]
  },
  "voice_manifest": {
    "vo.intro": "asset-vo-gct-intro",
    "vo.instruction": "asset-vo-gct-instruction",
    "vo.instruction_repeat": "asset-vo-gct-instruction-slow",
    "vo.hint_older": "asset-vo-hint-older",
    "vo.hint_newer": "asset-vo-hint-newer",
    "vo.hint_direction": "asset-vo-hint-direction",
    "vo.retry": "asset-vo-retry-junior",
    "vo.correct": "asset-vo-correct-junior",
    "vo.explain_event": "asset-vo-gct-explain-event",
    "vo.level_complete": "asset-vo-level-complete-junior",
    "vo.game_complete": "asset-vo-gct-game-complete",
    "vo.exit_confirm": "asset-vo-exit-confirm"
  }
}
```

## ما يلزم للإنتاج — لا شيء منه موجود

| البند | الحالة |
|---|---|
| `game_art` — خريطة أساس **محيّدة سياسيًا** + خط زمن + 8 بطاقات `4:3` | ❌ مطلوب |
| `voice_prompts` — 12 مفتاحًا + 8 أسماء + 4 شروح تاريخية | ❌ مطلوب |
| `engine_implementation` — محرك `timeline_map` نفسه | ❌ غير مُنفَّذ |
| ترحيل `engine_id` في قاعدة البيانات من `engine-sequence` إلى `timeline_map` | ❌ مطلوب |
| 🔴 **مراجعة تاريخية معتمدة** لكل سنة في جدول التحقق أعلاه | ❌ مانع نشر مطلق |
| اختبار RTL صريح: خط الزمن يُعكس والخريطة لا تُعكس | ❌ مطلوب |

🔴 **لا نصّ مطبوع داخل أي صورة** — أسماء المدن والأحداث من ملفات الترجمة وحدها، وهذا شرط لأن الحزمة `translatable`.
