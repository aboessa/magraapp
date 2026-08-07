# مواصفة الألعاب — مجرة

> **انتقل التوثيق الكامل إلى [`docs/games/`](./docs/games/README.md).**
> هذا الملف فهرس مختصر يحفظ الروابط القديمة.

الإصدار: 2.0

## القرار التنفيذي

مجرة **لا تبني ألعابًا منفصلة**. تبني **12 محرك لعب** قابلًا لإعادة الاستخدام، وكل محرك يشغّل عددًا غير محدود من **حزم المحتوى** المخزّنة في `games.content_pack`.

12 محركًا × 3 حزم عند الإطلاق = **36 لعبة**، وتتوسع إلى 60–90 لعبة **بلا إصدار جديد على المتجر**.

## المستندات المشتركة

| المستند | الموضوع |
|---|---|
| [00 — نظرة عامة](./docs/games/00-overview.md) | القرار المعماري والمحركات والتوزيع العمري |
| [01 — التعدد اللغوي](./docs/games/01-localization-i18n.md) | `game_localizations`، تصنيف المحركات لغويًا، RTL، Flutter |
| [02 — عقد البيانات](./docs/games/02-data-contract.md) | `mechanics`، `content_pack`، `help_system`، التحقق |
| [03 — الصوت العربي](./docs/games/03-voice-arabic.md) | المبادئ، المفاتيح الإلزامية، التسجيل |
| [04 — التشجيع والفشل](./docs/games/04-encouragement-and-failure.md) | بنوك العبارات وسياسة الفشل المتكرر |
| [05 — الإتقان والقياس](./docs/games/05-mastery-and-measurement.md) | `attempts`، `mastery`، Durable Objects |
| [06 — إمكانية الوصول](./docs/games/06-accessibility.md) | اللمس، التباين، D-pad، الأوضاع المبسّطة |
| [07 — الأصول والهوية](./docs/games/07-assets-and-brand.md) | الألوان والنسب وقواعد الأصول |
| [08 — خطة التنفيذ](./docs/games/08-implementation-plan.md) | الأساس المشترك وموجات المحركات |
| [09 — تعريفات مكتمل](./docs/games/09-definition-of-done.md) | معايير القبول |

## المحركات الـ12

| المسار | المحركات |
|---|---|
| البراعم 3–5 | [مطابقة](./docs/games/engines/01-match-pairs.md) · [تتبّع وتلوين](./docs/games/engines/02-trace-color.md) · [تصنيف](./docs/games/engines/03-sort-bins.md) · [ذاكرة](./docs/games/engines/04-memory-flip.md) |
| المستكشفون 6–8 | [عدّ وكميات](./docs/games/engines/05-count-quantity.md) · [ترتيب تسلسل](./docs/games/engines/06-sequence-order.md) · [بناء الكلمة](./docs/games/engines/07-word-build.md) · [إيقاع ونغمة](./docs/games/engines/08-rhythm-tap.md) |
| الروّاد 9–12 | [منطق وأنماط](./docs/games/engines/09-logic-pattern.md) · [برمجة بالبلوكات](./docs/games/engines/10-block-code.md) · [مختبر محاكاة](./docs/games/engines/11-sim-lab.md) · [خط زمني وخريطة](./docs/games/engines/12-timeline-map.md) |

## المخططات

[`docs/games/schemas/`](./docs/games/schemas/README.md) — JSON Schema للتحقق الآلي من كل حزمة قبل النشر.
