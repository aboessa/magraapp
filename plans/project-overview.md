# مشروع مجرة - خطة الاستوديو الإبداعي V2 (PNG-first)

## الرؤية
استوديو إبداعي للأطفال 3-12 سنة، 10 أقسام، كل رسمة تُحمّل من R2/CDN بدون تضمين في APK، مع لوحة تحكم كاملة للتحكم في كل قسم.

> **قرار جوهري من العميل:** كل أقسام التلوين = صور PNG خطية احترافية (شفافة)، و `ارسم مثلي` = رسومات كاملة ملونة. لا SVG في الإنتاج.

## الأقسام (10) - التصنيف الجديد

### المجموعة A - الرسم والتلوين (محور الخطة الحالية)
| القسم | الـ category في DB | نوع الأصل | المصدر الحالي | مثال من الصور |
|-------|-------------------|-----------|---------------|---------------|
| **لون** | `coloring` + sub: `birds/animals/vehicles/space/flowers/sea/fruits/toys` | PNG شفاف `public/studio/coloring/{id}.png` + thumb.webp | `F:\Projects\cartoonapp\assets\images\coloring\v2\*.png` (12 ملف PNG احترافي 190-460KB) | `bird.png` عصفور أصفر/أزرق على غصن، خطوط سوداء سميكة مغلقة |
| **ارسم مثلي** | `draw_like_me` | PNG ملون كامل `public/studio/draw_like_me/{id}.png` + مرجع + قماش فارغ | غير موجود محلياً - يُنشأ عبر PlayVeo أو رفع يدوي | سلحفاة بحرية، باندا، زخرفة شرقية، سيارة صفراء (سكرين 1) |
| **وصل النقاط** | `connect_dots` | PNG نقاط مرقمة `public/studio/connect_dots/{id}.png` + geometry JSON {dots:[{x,y,order}]} | `assets/images/drawing/templates/dots-*.svg` (مؤقت SVG) | نجمة 12 نقطة (سكرين 6) |
| **أكمل الرسمة** | `complete` | PNG نصف مكتمل `public/studio/complete/{id}.png` + PNG مكتمل للمرجع | `assets/images/drawing/templates/complete-*.svg` (مؤقت) | فراشة نصف ملونة / نصف منقط (سكرين 7) |

### المجموعة B - التتبع والتعلم (موجود جزئياً)
| القسم | category | نوع الأصل | حالة التطبيق |
|-------|----------|-----------|--------------|
| تتبع الخطوط/الأشكال | `trace` | SVG مسارات `trace-*.svg` + نقاط NormalizedPoint | `trace_home_v2.dart` + `trace_board_v2.dart` - يعمل offline بـ SVG |
| الحروف | `letters` | SVG حروف عربية `letter-*.svg` | موجود |
| الأرقام | `numbers` | SVG أرقام `number-*.svg` | موجود |
| انسخ النمط | `copy_pattern` | SVG أنماط `copy-*.svg` | موجود |
| رسم حر / لوحاتي | `free_draw` + `prompt_draw` | قماش فارغ + خلفيات `boards/v2` | `my_boards_v2.dart` يعمل محلياً |

## البنية الحالية (Audit 2026-08-20)

### ما يعمل
- جدول `creative_drawings` في D1 يدعم كل الأقسام 10 (migration 0065)
- API public: `GET /api/v1/creative-studio/home` + `/drawings` + `/drawings/:id` - يُرجع CDN URLs
- API admin: `POST /api/v1/admin/creative-studio/drawings` + `/upload` + `/generate` (PlayVeo) - في `adminCreativeStudio.ts:525`
- لوحة ادمن: `CreativeStudioAdminPage.tsx:323` - تدير كل الأقسام 10 مع فلترة ورفع وتوليد وفهرسة
- تطبيق: `coloring_home_v2_live.dart` + `coloring_board_v2.dart` - يعمل R2-first مع fallback و Hive cache
- صور PNG احترافية موجودة في `assets/images/coloring/v2/*.png` (12 PNG) لكن خارج `app_main/assets` وغير مرفوعة لـ R2

### ما لا يعمل / النواقص
1. **Encoding عربي مشوه** في `خلاق` - السبب `jsonDecode(res.body)` بدل `utf8.decode(bodyBytes)` - تم إصلاحه
2. **تكرار نفس العصفورة** - fallback كان `bird.png` وحيد لكل الفشل - تم إصلاح مؤقت بـ SVG مميز لكنه ليس PNG المطلوب
3. **صور التلوين V2 PNG موجودة على القرص لكن غير مرفوعة لـ R2** لذلك CDN يرجع 404 وكل الكروت تقع في fallback
4. **الادمن الحالي عام** - لا يفرق بين متطلبات `لون` (يحتاج PNG شفاف + palette) و `ارسم مثلي` (يحتاج صورة كاملة ملونة + صورة مرجع) و `وصل` (يحتاج نقاط) و `أكمل` (يحتاج نصف+كامل)
5. **التطبيق يستخدم SVG fallback مؤقت** بينما المطلوب PNG - يجب إرجاع PNG بعد الرفع
6. **أقسام ارسم مثلي / وصل / أكمل** في التطبيق لا تزال تستخدم `bundled JSON` (`coloring_templates.json`, `dots-*.svg`) وليس R2 - تحتاج توصيل حي
7. **لا صفحة ادمن منفصلة لكل قسم** - العميل طلب صفحة تحكم لكل من: لون، ارسم مثلي، وصل، أكمل
8. **لوحة التلوين board** تدعم PNG فقط عبر `ui.instantiateImageCodec` - لا تدعم SVG - وهذا صحيح للـ PNG المطلوب، لكن الفولباك الحالي SVG يحتاج معالجة خاصة (تمت)
9. **مسار `app_main` لا يتضمن `assets/images/coloring/v2`** - يجب نسخ PNGs إلى `app_main/assets` أو الاعتماد كلياً على R2

## المبادئ
- **R2-first صفر تضمين:** لا صور في APK إلا `bird.png` 8KB كـ offline emergency + `hero-start-drawing.webp`
- **PNG شفاف للتلوين:** كل رسمة تلوين يجب أن تمر عبر `POST /v1/images/remove-background` ليُزال الأبيض ويبقى خط أسود على شفاف، لأن القماش أبيض `Multiply` والخلفية JPEG لا تنفع
- **ارسم مثلي = صورة كاملة:** لا إزالة خلفية، تُحفظ كما هي ملونة بالكامل للنسخ
- **CDN واحد:** `PUBLIC_ASSET_BASE_URL=https://cdn.majarra.app` أمام `THUMBS_BUCKET`

## الأهداف المرحلية
- المرحلة 0 (منتهية): إصلاح Encoding + إصلاح تكرار الصورة
- المرحلة 1 (التالية): تلوين PNG - رفع 12 PNG + ادمن متخصص + ربط التطبيق
- المرحلة 2: ارسم مثلي - صور كاملة
- المرحلة 3: وصل النقاط
- المرحلة 4: أكمل الرسمة
- المرحلة 5: تتبع وتعلم R2 (نقل من bundled إلى DB)

## المخاطر
- R2 فارغ = كل الشاشات بيضاء - يجب تعبئته قبل أي إطلاق
- PlayVeo تكلفة $0.15 لكل رسمة شفافة - يحتاج ميزانية أو رفع يدوي
- لوحة التلوين لا تعمل مع SVG - لذلك يجب الالتزام بـ PNG كما طلب العميل
