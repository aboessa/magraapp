# 00 — نموذج المحتوى

## التسلسل الهرمي والجداول

| المستوى | الجدول | المفتاح | الملاحظة |
|---|---|---|---|
| الكوكب | `planets` | `id` نصي مقروء (`abjad`) | 9 كواكب، لا `slug` |
| السلسلة/البرنامج | `series` | `id` + `slug` فريد | ترتبط بكوكب واحد إلزاميًا |
| الموسم | `seasons` | `id` | اختياري |
| الحلقة/الوحدة | `episodes` | `id` | ترتبط بسلسلة إلزاميًا |
| الهدف التعليمي | `learning_objectives` | `id` | يُربط بالحلقة واللعبة |
| اللعبة | `games` | `id` | `engine_id` + `content_pack` |
| الأصل | `content_assets` | `id` | يُربط بـ`asset_links` |

## أنواع السلاسل

| النوع | الوصف | مثال |
|---|---|---|
| `continuous` | شخصية ثابتة وقصة متصلة | لونا تكتشف الكلمات · روبو يبرمج |
| `anthology` | حلقات مستقلة بشخصيات مختلفة | حكاية وحكمة · حكاية هادئة |
| `knowledge` | معرفي بلا شخصية ثابتة | اكتشف جسمك · رحلة الحضارات |
| `presenter` | مقدم حقيقي | جرّب في البيت · علوم في دقيقة |
| `standalone` | وحدة مستقلة | — |

## مستويات الإنتاج

| المستوى | الوصف | التكلفة النسبية |
|---|---|---|
| `motion_story` | قصة متحركة بصور ثابتة وحركة كاميرا | الأقل |
| `limited_2d` | تحريك 2D محدود | متوسط |
| `full_2d` | تحريك 2D كامل | مرتفع |
| `live` | تصوير حقيقي بمقدم | متوسط |
| `stylized_3d` | 3D مبسّط | الأعلى |

## الحقول الإلزامية لكل حلقة

يمنع CMS النشر عند نقص أي منها:

| الحقل | القيد |
|---|---|
| `age_min` / `age_max` | بين 3 و12، و`age_max ≥ age_min` |
| `reading_level` | `pre_reader` \| `emerging` \| `independent` |
| `interaction_mode` | `tap` \| `guided` \| `mixed` \| `independent` |
| `supervision_level` | `none` \| `recommended` \| `required` |
| `duration_seconds` | > 0 |
| `learning_objective_id` | مطلوب لأي حلقة تُقاس |
| `captions_ar_url` | الترجمة المغلقة |
| `safety_notes` | غير فارغة لأي نشاط منزلي |
| أصل فيديو | `content_assets` بحالة `ready` |

## حالات العمل

```
draft → writing → review_edu → review_lang → [review_sharia] → production → qa → ready → scheduled → published
                                                                                                    ↘ archived
```

`review_sharia` إلزامية **فقط** لمحتوى كوكب `islamic`.

**كل الـ22 سلسلة و33 حلقة الحالية في حالة `draft`.**

## الحقول الشرطية لمحتوى `islamic`

| الحقل | الغرض |
|---|---|
| `source_type` | نوع المصدر |
| `source_reference` | المرجع |
| `verse_surah` / `verse_ayah` | موضع الآية |
| `hadith_collection` / `hadith_number` / `hadith_grade` | المصدر والدرجة |
| `religious_reviewer_id` | المراجع الشرعي |
| `religious_review_version` | نسخة المراجعة |
| `religious_approved_at` | تاريخ الاعتماد |
| `visual_restrictions` | القيود البصرية |

التفاصيل في [91 — الحوكمة الشرعية](./91-islamic-governance.md).

## الاشتراك والمجانية

| الحقل | القاعدة |
|---|---|
| `is_free` | الحلقة الأولى من كل سلسلة مجانية (نموذج الجذب) |
| `price_tier` | `free` \| `family` \| `family_plus` |

كل الـ22 سلسلة الحالية `price_tier = family`. **لا توجد سلسلة `family_plus` بعد**، وهذا يعني أن باقة Family Plus بلا محتوى حصري يبرّرها.

## ربط اللعبة بالحلقة

| الحقل | الوصف |
|---|---|
| `episodes.linked_game_id` | لعبة تُقترح بعد الحلقة |
| `episodes.linked_book_id` | كتاب/قصة مرتبطة |
| `games.episode_id` | الربط العكسي |

اللعبة تُبنى على أحد **12 محركًا** في [مواصفة الألعاب](../games/README.md)، لا كلعبة منفصلة.

## المراجع

- [`../../CONTENT_ARCHITECTURE_V2.md`](../../CONTENT_ARCHITECTURE_V2.md) — معمارية المحتوى
- [`../../CONTENT_PRODUCTION.md`](../../CONTENT_PRODUCTION.md) — خط الإنتاج
- [`../../AGE_EXPERIENCE_PLAN_3_12.md`](../../AGE_EXPERIENCE_PLAN_3_12.md) — تجربة الأعمار
- [`../games/README.md`](../games/README.md) — مواصفة الألعاب
