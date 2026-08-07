# مخططات التحقق من حزم الألعاب

JSON Schema (draft 2020-12) للتحقق الآلي من كل حزمة **قبل النشر**.

## المخططات

| الملف | المحرك |
|---|---|
| [`content-pack.base.schema.json`](./content-pack.base.schema.json) | العقد الأساس لكل الحزم |
| [`match_pairs.v1.schema.json`](./match_pairs.v1.schema.json) | `match_pairs` |
| [`trace_color.v1.schema.json`](./trace_color.v1.schema.json) | `trace_color` |
| [`sort_bins.v1.schema.json`](./sort_bins.v1.schema.json) | `sort_bins` |
| [`memory_flip.v1.schema.json`](./memory_flip.v1.schema.json) | `memory_flip` |
| [`count_quantity.v1.schema.json`](./count_quantity.v1.schema.json) | `count_quantity` |
| [`sequence_order.v1.schema.json`](./sequence_order.v1.schema.json) | `sequence_order` |
| [`word_build.v1.schema.json`](./word_build.v1.schema.json) | `word_build` |
| [`rhythm_tap.v1.schema.json`](./rhythm_tap.v1.schema.json) | `rhythm_tap` |
| [`logic_pattern.v1.schema.json`](./logic_pattern.v1.schema.json) | `logic_pattern` |
| [`block_code.v1.schema.json`](./block_code.v1.schema.json) | `block_code` |
| [`sim_lab.v1.schema.json`](./sim_lab.v1.schema.json) | `sim_lab` |
| [`timeline_map.v1.schema.json`](./timeline_map.v1.schema.json) | `timeline_map` |

## أين يُطبَّق التحقق

**على الخادم**، في مسار الإدارة قبل حفظ الحزمة أو نشرها. لا يُعتمد على تحقق الواجهة إطلاقًا.

## تحققات لا يعبّر عنها JSON Schema

هذه تُنفَّذ برمجيًا بعد نجاح تحقق المخطط:

| # | التحقق |
|---:|---|
| 1 | كل `asset-id` موجود في `content_assets` وحالته `ready` |
| 2 | أرقام `level` متصلة تبدأ من 1 بلا فراغات |
| 3 | عدد العناصر في كل مستوى ≤ `max_elements_on_screen` للمحرك |
| 4 | كل مرجع داخلي (`target`, `bin`, `answer`) يشير إلى معرف موجود في نفس المستوى |
| 5 | `engine_id` في الحزمة = `games.engine_id` |
| 6 | `pack_version` ≤ `engine_version` المدعوم |
| 7 | حزمة `language_specific` لها `translated_from = NULL` |
| 8 | `age_min ≤ age_max`، وكلاهما بين 3 و12 |
| 9 | أي نشاط منزلي له `safety_notes` غير فارغة و`supervision_level = required` |
| 10 | لا نص مطبوع داخل الصور (تحقق تحريري موثق، غير آلي) |

## ملاحظة

المخططات تصف **البنية**. الصحة التعليمية واللغوية والعلمية تحتاج مراجعة بشرية موثقة كما في [09 — تعريفات مكتمل](../09-definition-of-done.md).
