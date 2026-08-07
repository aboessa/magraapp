# توثيق ألعاب مجرة

الإصدار: 2.0 · وثيقة تنفيذية كاملة

مجرة **لا تبني ألعابًا منفصلة**. تبني **12 محرك لعب** قابلًا لإعادة الاستخدام، وكل محرك يشغّل عددًا غير محدود من **حزم المحتوى** المخزّنة في `games.content_pack`.

12 محركًا × 3 حزم عند الإطلاق = **36 لعبة**، وتتوسع إلى 60–90 لعبة **بلا إصدار جديد على المتجر**.

## المستندات المشتركة

| # | المستند | الموضوع |
|---:|---|---|
| 00 | [نظرة عامة](./00-overview.md) | القرار المعماري، المحركات الـ12، التوزيع العمري |
| 01 | [التعدد اللغوي](./01-localization-i18n.md) | `game_localizations`، تصنيف المحركات لغويًا، RTL، Flutter |
| 02 | [عقد البيانات](./02-data-contract.md) | `mechanics`، `content_pack`، `help_system`، التحقق |
| 03 | [الصوت العربي](./03-voice-arabic.md) | المبادئ، المفاتيح الإلزامية، المؤثرات، التسجيل |
| 04 | [التشجيع والفشل](./04-encouragement-and-failure.md) | بنوك العبارات، سياسة الفشل المتكرر، المكافآت |
| 05 | [الإتقان والقياس](./05-mastery-and-measurement.md) | `attempts`، `mastery`، Durable Objects |
| 06 | [إمكانية الوصول](./06-accessibility.md) | اللمس، التباين، D-pad، الأوضاع المبسّطة |
| 07 | [الأصول والهوية](./07-assets-and-brand.md) | الألوان، النسب، قواعد الأصول |
| 08 | [خطة التنفيذ](./08-implementation-plan.md) | الأساس المشترك، موجات المحركات |
| 09 | [تعريفات مكتمل](./09-definition-of-done.md) | معايير القبول |

## المحركات الـ12

### البراعم `preschool` 3–5

| # | المحرك | `engine_id` | التصنيف اللغوي |
|---:|---|---|---|
| 1 | [مطابقة كبيرة](./engines/01-match-pairs.md) | `match_pairs` | `translatable` |
| 2 | [تتبّع وتلوين](./engines/02-trace-color.md) | `trace_color` | `language_specific` للحروف |
| 3 | [تصنيف](./engines/03-sort-bins.md) | `sort_bins` | `translatable` |
| 4 | [ذاكرة](./engines/04-memory-flip.md) | `memory_flip` | `language_neutral` · ترفيه أولًا |

### المستكشفون `kids` 6–8

| # | المحرك | `engine_id` | التصنيف اللغوي |
|---:|---|---|---|
| 5 | [عدّ وكميات](./engines/05-count-quantity.md) | `count_quantity` | `translatable` |
| 6 | [ترتيب تسلسل](./engines/06-sequence-order.md) | `sequence_order` | `translatable` |
| 7 | [بناء الكلمة](./engines/07-word-build.md) | `word_build` | `language_specific` |
| 8 | [إيقاع ونغمة](./engines/08-rhythm-tap.md) | `rhythm_tap` | `language_neutral` · ترفيه أولًا |

### الروّاد `junior` 9–12

| # | المحرك | `engine_id` | التصنيف اللغوي |
|---:|---|---|---|
| 9 | [منطق وأنماط](./engines/09-logic-pattern.md) | `logic_pattern` | `language_neutral` |
| 10 | [برمجة بالبلوكات](./engines/10-block-code.md) | `block_code` | `language_neutral` |
| 11 | [مختبر محاكاة](./engines/11-sim-lab.md) | `sim_lab` | `language_neutral` |
| 12 | [خط زمني وخريطة](./engines/12-timeline-map.md) | `timeline_map` | `translatable` |

## المخططات

[`schemas/`](./schemas/) — JSON Schema للتحقق الآلي من كل حزمة قبل النشر.

## حالة التوثيق

| البند | الحالة |
|---|---|
| مواصفة المحركات الـ12 | ✅ كاملة |
| مخططات JSON للتحقق | ✅ كاملة |
| سكربتات الصوت العربي | ✅ كاملة على مستوى المفاتيح |
| سياسة التشجيع والفشل | ✅ كاملة |
| بيانات مستويات كل حزمة (36 حزمة) | ⏳ عمل تحريري، ليس مواصفة |
| تسجيلات الصوت الفعلية | ⏳ إنتاج |
| كتالوج مفاتيح `.arb` | ⏳ يُولَّد مع التنفيذ |
