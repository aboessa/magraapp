# 90 — الأهداف التعليمية

> ⚠️ **جدول `learning_objectives` فارغ تمامًا في الإنتاج (0 صف).**
> هذا **أول ما يجب سدّه**، لأن كل قياس تعليمي يُربط به.

## لماذا هو حاجز

| المتأثر | الأثر |
|---|---|
| `mastery` | لا تعمل — تُقاس مقابل `objective_id` |
| `episodes.learning_objective_id` | فارغ في كل الـ33 حلقة |
| `games` | لا تُربط بمهارة |
| `attempts` | تُكتب بلا معنى تعليمي |
| تقارير ولي الأمر | بلا محتوى وصفي حقيقي |
| التوصيات | لا يمكن اقتراح «الخطوة التالية» |

## الجدول المرتبط

| الجدول | الغرض |
|---|---|
| `learning_objectives` | الهدف نفسه |
| `learning_objective_tracks` | ربط الهدف بالمسارات العمرية |
| `skills` | المهارات |
| `mastery` | إتقان الطفل لكل هدف |

## مستويات الإتقان

| المستوى | الشرط |
|---|---|
| `not_started` | لا محاولات |
| `introduced` | محاولة واحدة على الأقل |
| `practicing` | دقة 50–79% |
| `assisted` | دقة ≥ 80% **مع** مساعدة |
| `independent` | دقة ≥ 80% في 3 محاولات متتالية بلا مساعدة |
| `needs_review` | هبوط تحت 50% بعد `independent` |

التفاصيل في [مواصفة الألعاب — الإتقان والقياس](../games/05-mastery-and-measurement.md).

---

## الكتالوج المقترح

مقترح للإقرار. `id` نصي مقروء، والمسارات من `preschool` / `kids` / `junior`.

### اللغة — كوكب أبجد

| `id` | الهدف | المسارات |
|---|---|---|
| `lang.vocab.match_word_image` | يطابق الكلمة المنطوقة بصورتها | `preschool` |
| `lang.phonics.first_sound` | يميّز الصوت الأول في الكلمة | `preschool` |
| `lang.letters.trace_form` | يتتبّع شكل الحرف بترتيب رسم صحيح | `preschool` |
| `lang.vocab.name_objects` | يسمّي عناصر مألوفة | `preschool` |
| `lang.spelling.build_word` | يبني كلمة من حروفها | `kids` |
| `lang.reading.follow_narration` | يتابع النص المقروء مع السرد | `kids` |

### الرياضيات — كوكب أرقام

| `id` | الهدف | المسارات |
|---|---|---|
| `math.count.one_to_one` | يربط كل عنصر بواحد (مطابقة أحادية) | `preschool` |
| `math.count.to_five` | يعدّ حتى 5 | `preschool` |
| `math.count.to_ten` | يعدّ حتى 10 | `kids` |
| `math.compare.more_less` | يقارن مجموعتين | `preschool` · `kids` |
| `math.add.visual_sum` | يجمع بصريًا | `kids` |
| `math.subtract.visual` | يطرح بصريًا | `kids` |
| `math.pattern.complete` | يكمل نمطًا عدديًا | `kids` · `junior` |

### العلوم — كوكب علوم

| `id` | الهدف | المسارات |
|---|---|---|
| `sci.body.organ_function` | يربط العضو بوظيفته | `kids` |
| `sci.senses.identify` | يميّز الحواس ووظائفها | `kids` |
| `sci.method.predict` | يصوغ توقعًا قبل التجربة | `kids` · `junior` |
| `sci.method.explain_result` | يفسّر النتيجة من البيانات | `junior` |
| `sci.method.control_variable` | يثبّت متغيرًا ويغيّر آخر | `junior` |
| `sci.physics.light_air` | يفسّر ظواهر الضوء والهواء | `junior` |

### التصنيف والملاحظة — كوكب العالم حولنا

| `id` | الهدف | المسارات |
|---|---|---|
| `world.sort.by_color` | يصنّف باللون | `preschool` |
| `world.sort.by_shape` | يصنّف بالشكل | `preschool` |
| `world.sort.by_size` | يصنّف بالحجم | `preschool` |
| `world.sort.abstract_rule` | يصنّف بقاعدة مجرّدة | `kids` |
| `world.observe.infer_clues` | يستنتج من دلائل | `kids` |

### القيم — كوكب قيم

| `id` | الهدف | المسارات |
|---|---|---|
| `values.honesty` | يختار التصرف الأمين | `kids` |
| `values.sharing` | يشارك ويتعاون | `kids` |
| `values.patience` | ينتظر دوره | `kids` |
| `values.responsibility` | يتحمّل مسؤولية | `kids` |

### السرد والتسلسل — كوكب قصص

| `id` | الهدف | المسارات |
|---|---|---|
| `story.sequence.order_events` | يرتّب أحداث قصة | `preschool` · `kids` |
| `story.comprehension.recall` | يتذكّر تفاصيل القصة | `kids` |
| `story.routine.daily_steps` | يرتّب خطوات روتين يومي | `preschool` |

### التفكير الحسابي — كوكب مهارات

| `id` | الهدف | المسارات |
|---|---|---|
| `skill.cs.sequence` | يرتّب أوامر بتسلسل صحيح | `junior` |
| `skill.cs.debug` | يكتشف خطأ منطقيًا ويصلحه | `junior` |
| `skill.cs.loop` | يستخدم التكرار لتقليل الخطوات | `junior` |
| `skill.cs.conditional` | يستخدم الشرط | `junior` |
| `skill.logic.infer_rule` | يستنتج قاعدة ويعلّلها | `junior` |

### التاريخ والجغرافيا — كوكب تاريخ

| `id` | الهدف | المسارات |
|---|---|---|
| `hist.timeline.place_event` | يضع الحدث في زمنه | `junior` |
| `hist.geo.place_location` | يحدّد موقعًا على الخريطة | `junior` |
| `hist.source.cite` | يميّز المصدر الموثوق | `junior` |

### الإيمان والآداب — كوكب الإيمان والآداب

> 🚧 محجوبة ببوابة الاعتماد الشرعي. الأهداف أدناه **مقترحة ولا تُعتمد** قبل مراجعة المرجع المؤهل.

| `id` | الهدف | المسارات |
|---|---|---|
| `faith.quran.listen_meaning` | يستمع لسورة قصيرة ويفهم معنى واحدًا ميسّرًا | `preschool` · `kids` |
| `faith.adhkar.recite` | يحفظ ذكرًا صحيحًا بالمصدر | `preschool` · `kids` |
| `faith.manners.apply` | يطبّق أدبًا عمليًا | `preschool` · `kids` |
| `faith.prayer.steps` | يرتّب خطوات الصلاة على الأصول المتفق عليها | `kids` |
| `faith.seerah.sequence` | يرتّب أحداث السيرة | `kids` · `junior` |
| `faith.worship.reason` | يربط العبادة بحكمتها | `junior` |
| `faith.identity.digital_ethics` | يتصرف بأخلاق في الفضاء الرقمي | `junior` |

---

## الإجمالي المقترح

| المجال | الأهداف |
|---|---:|
| اللغة | 6 |
| الرياضيات | 7 |
| العلوم | 6 |
| التصنيف والملاحظة | 5 |
| القيم | 4 |
| السرد والتسلسل | 3 |
| التفكير الحسابي | 5 |
| التاريخ والجغرافيا | 3 |
| الإيمان والآداب | 7 (معلّقة) |
| **الإجمالي** | **46** |

## قواعد إلزامية

1. **هدف واحد لكل حلقة** — الازدحام يُفقد القياس معناه.
2. الهدف يُربط بمسار عمري واحد على الأقل عبر `learning_objective_tracks`.
3. اللعبة المرتبطة بالحلقة تُقاس على **نفس الهدف**، وإلا لا معنى للربط.
4. حزم `memory_flip` المتماثلة و`rhythm_tap` **لا تُربط بهدف** لأنها ترفيه.
5. أي هدف بلا حلقة أو لعبة تقيسه = هدف ميت، يُحذف أو يُنتج له محتوى.

## الخطوة التالية

زرع هذا الكتالوج (بدون قسم الإيمان والآداب حتى فتح البوابة) في `learning_objectives` و`learning_objective_tracks`، ثم ربط الـ33 حلقة الحالية بأهدافها.

**هذا عمل قابل للتنفيذ فورًا على Cloudflare** ولا يحتاج إنتاجًا فنيًا.
