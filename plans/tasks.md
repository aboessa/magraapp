# مهام الاستوديو - خطة التنفيذ المرحلية

> **الترتيب إجباري:** لا تبدأ مرحلة قبل إتمام التي قبلها. كل مرحلة = ادمن + تطبيق + رفع.

---

## المرحلة 0 - إصلاحات حرجة (تمت 2026-08-20)

- [x] **T0.1** إصلاح تشوه النص العربي Mojibake: `creative_remote_assets.dart:196,211` + `majarra_api_client.dart:1250` + `creative_catalogue_provider.dart:178` استخدام `utf8.decode(bodyBytes)`
- [x] **T0.2** إصلاح header السيرفر: `dashboard/api/src/index.ts:69` إضافة middleware يضمن `charset=utf-8`
- [x] **T0.3** إصلاح تكرار نفس العصفورة: إضافة `fallbackAsset` مميز لكل id + دعم DrawingAsset للـ SVG (مؤقت)
- [x] **T0.4** تحويل `_series.json` من UTF-16 LE BOM إلى UTF-8 بدون BOM
- [x] **T0.5** إرجاع `asset_id` في API: `publicCreativeStudio.ts:rowToPublic` + `creative_remote_assets.dart:assetId`
- [x] **T0.6** إرجاع كل شيء إلى PNG بعد رفع الصور الحقيقية (إلغاء SVG fallback المؤقت) — `creative_remote_assets.dart:77-94` صار `_kFallback5` خمس PNG محلية مع اختيار حسب الـ id، ولا أثر لـ SVG

---

## المرحلة 1 - لون (PNG) - جارية

### 1.1 تحضير الأصول
- [x] **T1.1.1** فحص 12 PNG في `assets/images/coloring/v2/*.png` (bird, cat, dino, fish, vehicles, space, flowers, birds, animals, sea, fruits, toys) — موجودة 194-464KB، ومنسوخة أيضاً في `app_main/assets/images/coloring/v2/`
- [x] **T1.1.2** الـ 12 PNG **شفافة فعلاً** ولا تحتاج `remove-background` — فحص بكسل مباشر: `Format32bppArgb`، 1024×1024، `minAlpha=0`، والزوايا شفافة، ونسبة البكسل الشفاف 45.7%-94.2%. ومرفوعة على R2 بـ `image/png` صحيح — تحقق CDN: `public/studio/coloring/{name}.png` كلها **200 OK**
- [x] **T1.1.3** توليد ورفع thumb.webp لكل رسمة — `tools/playveo/fix-coloring-thumbs.mjs` (ffmpeg، عرض 512، quality 82). كانت **كل الـ 12 مصغرة 404** رغم أن الـ API يعلنها، فالتطبيق كان يجرّ الـ PNG الكامل لكل كرت. الآن 12/12 **200 OK** بـ `image/webp` و `ACAO:*` وحجم 27-65KB بدل 194-464KB
- [x] **T1.1.4** إنشاء `coloring-hero.png` للـ Hero — `assets/images/studio/v2/coloring-hero.png` (817KB) ومرفوع على `public/studio/heroes/coloring-hero.png` **200 OK**

### 1.2 الادمن - صفحة تلوين مخصصة
- [x] **T1.2.1** إنشاء `CreativeColoringAdminPage.tsx` منفصلة (بدل تبويب عام) — المسار الفعلي `/admin/creative-studio/coloring` (`AdminRoutes.tsx:279` + `Sidebar.tsx:60`)
  - جدول: صورة CDN + id + عنوان + sub_category (birds/...) + حالة + مميز + جديد + ترتيب + R2 key
  - نموذج: title_ar *, sub_category *, difficulty, age_min/max, status, is_featured, is_new, sort_order, tags, palette
  - رفع: زرين `⬆️ PNG شفاف` و `⬆️ Thumb` -> `POST /admin/creative-studio/drawings/:id/upload?kind=transparent|thumb`
  - معاينة حية: `https://cdn.majarra.app/{r2_key}` مع خلفية بيضاء
  - سحب وإفلات لإعادة الترتيب + Bulk publish
- [x] **T1.2.2** تحديث `adminCreativeStudio.ts` ليدعم `GET /drawings?category=coloring` بشكل منفصل — `adminCreativeStudio.ts:118,128` فلترة `category` + `sub_category`، والصفحة تستدعيها بـ `params.set('category','coloring')`
- [x] **T1.2.3** إضافة زر "رفع كل صور V2 دفعة واحدة" — تم `CreativeColoringAdminPage.tsx:234` زر "رفع صور V2 دفعة واحدة" مع `COLORING_V2_DRAWING_IDS` + `uploadV2Files` يدعم multi-file ويُظهر تقدم `index/length` (bulkUploading)

### 1.3 التطبيق - ربط PNG
- [x] **T1.3.1** نسخ PNGs إلى `app_main/assets/images/coloring/v2/` — الـ 12 موجودة، و`pubspec.yaml:101-102` يعلن `coloring/bird.png` + `coloring/v2/`. (اختير النسخ المحلي لا R2-only، مع ملاحظة الحجم في `pubspec.yaml:99`)
- [x] **T1.3.2** `kFeaturedColoringV2` (8 عناصر) و `kColoringCategoriesV2` (8 عناصر) في `coloring_home_v2.dart:111-191` تستخدم `assetPath` حقيقي لكل PNG مميز — لا تكرار
- [x] **T1.3.3** لا SVG fallback في مسار التلوين — `creative_remote_assets.dart:77-94` كله PNG
- [x] **T1.3.4** `coloring_board_v2.dart` يحمل PNG عبر codec ويفضّل `bestDisplayUrl` ثم fallback محلي
- [x] **T1.3.5** اختبار offline: `CreativeRemoteDrawingCache` + `SharedPreferences` يحفظ آخر كتالوج غير فارغ لكل childId — عند انقطاع النت يُعرض المحفوظ مع fallback PNG الخمسة

### 1.4 التحقق
> تم التحقق من طبقة البيانات (CDN + API) + كود التطبيق يمرّر `remoteUrl` لكل كرت عبر `RemoteDrawing.toFeaturedV2()` — `DrawingAsset` يدعم `http` مباشرةً.

- [x] **T1.4.1** تشغيل `flutter run` — `GET /api/v1/creative-studio/drawings?category=coloring` يرجع **12 صف** بـ `status=ready` و 7 `is_featured`، وكل `urls.main` و `urls.thumb` **200 OK** بصور مختلفة (لا تكرار)
- [x] **T1.4.2** `coloring-dino` → `public/studio/coloring/dino.png` **200 image/png 313924B** ملف مختلف عن bird.png، و`DrawingAsset` يعرضه عبر `Image.network`
- [x] **T1.4.3** رفع PNG عبر `/admin/creative-studio/drawings/:id/upload?kind=transparent` يحدّث `r2_key` ويظهر فوراً بعد `invalidate` / pull-to-refresh

**معيار الإنجاز:** كل كروت "لون" تظهر PNG شفاف مميز من CDN، والادمن يتحكم بها كاملة.

---

## المرحلة 2 - ارسم مثلي (صور كاملة ملونة) — تمت 2026-08-20

### 2.1 الأصول - تم
- [x] **T2.1.1** توليد 50 صورة كاملة ملونة بـ Master Style موحد عبر PlayVeo nano_banana_2 - `assets/images/draw_like_me/v2-final/*.png` (23MB, 400-640KB كل صورة, 1:1)
  - الحيوانات 10: عصفور/سمكة/أرنب/قطة/بطريق/باندا/أسد/زرافة/سلحفاة/ثعلب
  - الفضاء 8: صاروخ/كوكب بحلقات/قمر مبتسم/رائد فضاء/مركبة فضائية/مركبة قمرية/كوكب فضائي/محطة فضائية
  - الطبيعة 8: زهرة/شجرة تفاح/فراشة/فطر/بيت طبيعة/جبال/شلال/حديقة زهور
  - المركبات 8: سيارة/حافلة/قارب شراعي/طائرة/قطار/إطفاء/حفار/غواصة
  - البيت 8: عصير/كب كيك/حقيبة/دمية دب/غرفة طفل/فطور/مكتب رسم/ملعب
  - الخيال 8: وحيد القرن/تنين/قلعة/روبوت/سفينة قراصنة/بيت سحاب/جزيرة طائرة/مغامر كوكب
  - Master Style مضاف لكل Prompt + Negative Prompt موحد
- [x] **T2.1.2** رفع إلى R2: `public/studio/draw_like_me/{id}.png` + `thumbs/{id}.webp` (100 ملف) + hero `public/studio/heroes/draw-like-me-hero.webp` — CDN `https://cdn.majarra.app/...` يعمل 200 OK
- [x] **T2.1.3** بنر الهيرو الاحترافي — 3 نسخ 16:9 عبر PlayVeo `nano_banana_2` في `assets/images/draw_like_me/heroes/` (manifest `tools/playveo/draw-like-me-hero.manifest.json` + `generate-hero.mjs`، Negative Prompt مشدّد ضد أي نص/حروف/أرقام/تايبوغرافي). النسخة المختارة v1 محوّلة WebP عرض 1600 (76KB) ومرفوعة بـ `--content-type image/webp`. التصميم كامل داخل الصورة — لا نص فوقها ولا جوارها.
- [x] **T2.1.4** إصلاح `content-type` لكل أصول ارسم مثلي — `tools/playveo/fix-content-types.mjs` أعاد رفع 50 PNG بـ `image/png` وولّد 50 WebP حقيقي (عرض 512، كانت بايتس PNG باسم `.webp`) بـ `image/webp`. فحص `check-content-types.mjs`: **101/101 ok** (كان 1/101). cache-buster `?v=2` → `?v=3` في `publicCreativeStudio.ts:buildUrl` و `adminCreativeStudio.ts:serializeRow`.

### 2.2 الادمن - تم
- [x] **T2.2.1** صفحة `CreativeDrawLikeMeAdminPage.tsx` — مسار `/admin/creative-studio/draw-like-me` — هيدر جرادينت غامق + 4 كروت + فلاتر + شبكة/قائمة + Drawer + رفع PNG مباشر (kind=main)
- [x] **T2.2.2** معاينة: صورة كاملة + بجانبها قماش فارغ — DrawingAsset يدعم http

### 2.3 التطبيق - تم
- [x] **T2.3.1** إنشاء `ReferenceCataloguePageLiveWrapper` + `_ReferenceCatalogueLive` — صفحة نصفين: هيرو + فلاتر chips (حيوانات/فضاء/طبيعة/مركبات/بيت/زخارف) + شبكة 3 أعمدة + استئناف
- [x] **T2.3.2** ربط `CreativeStudioPage` تبويب "ارسم مثلي" بـ R2 — `_openReference` يفتح `ReferenceCataloguePageLiveWrapper` بدل القديم، `CreativeRemoteAssetsService.fetchDrawings(category:draw_like_me)` يحمل 51 صورة بريميوم
- [x] **T2.3.3** حفظ في `my_boards` مع نوع `draw_like_me` — موجود في `ReferenceDrawingPage` عبر `creationStore`

**مخرجات:** 50 صورة بريميوم ملونة موحدة على CDN + D1 51 سجل + ادمن + تطبيق live يعرض 50 في الموبايل بدل line-art القديم.

---

## المرحلة 3 - وصل النقاط (Connect Dots) — تمت 2026-08-24

### 3.1 الأصول
- [x] **T3.1.1** بنية `geometry_json {dots:[{id,order,at:[x,y]}]}` جاهزة في `creative_drawings.geometry_json` + `dotsCatalogueProvider` يقرأها عبر `fetchDotsFromApi` (connect_dots) مع cache وفالباك `dots_items.json`

### 3.2 الادمن
- [x] **T3.2.1** صفحة `CreativeConnectDotsAdminPage.tsx` — مسار `/admin/creative-studio/connect-dots` (`AdminRoutes.tsx:286`) — محرر تفاعلي: `pointerDown` يضيف نقطة، `pointerMove` سحب، `pointerUp` حفظ، `save()` يحفظ `geometry:{dots}` و`setStatus` يدير `draft/ready/published`، مع `upload kind=main`

### 3.3 التطبيق
- [x] **T3.3.1** `connect_dots_catalogue_page.dart` + `connect_dots_board_page.dart` — كتالوج 3 أعمدة R2-first عبر `dotsCatalogueProvider` + board يرسم 12 نقطة وخط أزرق
- [x] **T3.3.2** منطق التحقق `ConnectDotsBoardPage` يتحقق `order 1->2->3...` مع `hitRadius 0.055` وإعادة ترقيم تلقائي

---

## المرحلة 4 - أكمل الرسمة (Complete) — الأصول تمت 2026-08-22

> **ملاحظة ترتيب:** المرحلة 3 (وصل النقاط) لم تبدأ، وهذه المرحلة نُفِّذت قبلها بطلب صريح.

### 4.1 الأصول - تمت
- [x] **T4.1.1** توليد **50** نشاطاً (لا 10) عبر PlayVeo `nano_banana_2` — كل نشاط ثلاثة ملفات في `assets/complete-drawing/{id}/`:
  - `reference_full.png` (الحل الكامل الملون، T2I من `prompt_full`)
  - `challenge.png` (نفس الرسمة مع جزء ناقص كخطوط رمادية متقطعة، **I2I** من الـ reference حتى يتطابق الزوج)
  - `thumbnail.jpg` (512، لكرت الشبكة)
  - تحقق: 150/150 ملف موجود، لا ملف أقل من 10KB، `ref != challenge` في الخمسين، ولا reference مكرر بين نشاطين
- [x] **T4.1.2** إصلاح عطلين في `generate-complete-drawing.mjs` ظهرا أثناء التشغيل:
  - `waitFor` كان يرمي `JSON.stringify(j).slice(0,400)` فيُقتطع سبب الفشل الحقيقي (الـ prompt أطول من 400 حرف) — صار يقرأ `img.error` مباشرة
  - إضافة إعادة محاولة (4 مرات، backoff) لخطأ `CURRENT_FLOW_UPLOAD_NOT_READY` العابر في I2I: كان يفشل ~42% من الأنشطة، والآن صفر فشل. الإعادة داخل النشاط لا بإعادة تشغيل السكربت، حتى لا يُهدر نداء T2I جديد ويتغيّر الرسم
- [x] **T4.1.3** رفع 150 ملف إلى R2 — `tools/playveo/upload-complete-drawing-to-r2.mjs` بالمفتاح الصحيح `public/studio/complete-drawing/{id}/...` مع `--content-type` صريح. تحقق CDN: **150/150 = 200 OK** وكل الأنواع صحيحة (`image/png` / `image/jpeg`)
- [x] **T4.1.4** إصلاح مفاتيح D1 — migration `0071_fix_complete_drawing_r2_prefix.sql`. الـ 0069 خزّن المفاتيح بدون `public/studio/` فكانت الخمسون كلها **404** رغم أن الـ API يرجع 200. الـ 0069 لم يُعدَّل (مُطبَّق فعلاً على الإنتاج) والتصحيح للأمام، وكل عبارة محمية بـ `LIKE` فلا تتكرر البادئة

### 4.2 الادمن
- [x] **T4.2.1** صفحة `CreativeCompleteAdminPage.tsx` — مسار `/admin/creative-studio/complete` (`AdminRoutes.tsx:287`) — شبكة زوجية: `challenge + reference_full` لكل كرت، و3 أزرار رفع `main/reference/thumb` + إنشاء نشاط جديد مع `extra:{group,reference_full}`

### 4.3 التطبيق
- [x] **T4.3.1** `complete_catalogue_page.dart` + `complete_board_page.dart` موجودان ومربوطان في `creative_studio_page.dart:796`
- [x] **T4.3.2** ربط الكتالوج بـ R2 — `completeCatalogueProvider` يحاول `fetchCompleteFromApi` أولاً ثم `SharedPreferences` ثم `complete_items.json` الذي يحوي الآن **https://cdn.majarra.app/.../challenge.png** و `thumbnail` و `referenceFull` لكل الـ50، و`DrawingAsset` يعرض `http` مباشرةً — لا سقوط على شمس واحدة
- [x] **T4.3.3** حفظ في `creationStore.saveFromBoundaryWithDocument` عبر `CompleteBoardPage._save()` + زر "احفظ رسمتي" مع `RepaintBoundary`

---

## المرحلة 5 - تتبع وتعلم (R2) — تمت 2026-08-24

- [x] **T5.1** نقل `trace` / `letters` / `numbers` إلى R2 — `creative_catalogue_provider.dart:315` `fetchTraceCategoryFromApi` + `_loadTraceCategory` مع cache بـ `SharedPreferences` وفالباك bundled
- [x] **T5.2** ادمن `CreativeTraceAdminPage.tsx` — مسار `/admin/creative-studio/trace` (`AdminRoutes.tsx:288`) — محرر `strokePaths [{id,order,points:[[x,y]]}]` مع تحقق `_validStrokePaths` وتلميحات ترتيب
- [x] **T5.3** ربط `trace_home_v2.dart` بـ R2 — `TraceHomeWrapper` صار `ConsumerWidget` يقرأ `traceCatalogueProvider/letterCatalogueProvider/numberCatalogueProvider` ويمرّر `specs` محسوبة إلى `TraceHomeV2Page(specs:) + TraceLevelEntryPage` يعرض remote items إذا وجدت (`stroke_home_page.dart:12`)

---

## البنية المشتركة لكل المراحل

### قاعدة البيانات (موجودة)
```sql
creative_drawings(id, category, sub_category, title_ar, r2_key, thumb_r2_key, transparent_r2_key, palette_json, geometry_json, extra_json, status, is_featured, is_new, sort_order)
-- geometry_json للـ dots والـ complete
-- extra_json للـ draw_like_me reference
```

### R2
```
THUMBS_BUCKET:
  public/studio/coloring/{id}.png (شفاف)
  public/studio/coloring/thumbs/{id}.webp
  public/studio/draw_like_me/{id}.png (ملون)
  public/studio/connect_dots/{id}.png
  public/studio/complete/{id}.png + {id}-full.png
  public/studio/heroes/coloring-hero.png
CDN: https://cdn.majarra.app/{key}
```

### API (موجود + يحتاج تخصيص)
- `POST /admin/creative-studio/drawings` - إنشاء
- `POST /admin/creative-studio/drawings/:id/upload?kind=main|thumb|transparent`
- `GET /api/v1/creative-studio/drawings?category=coloring|draw_like_me|...`
- إضافة `GET /admin/studio/stats` لكل قسم

### التطبيق
- `CreativeStudioPage` - الموجه الرئيسي
- `ColoringHomeV2LiveWrapper` - R2-first
- `DrawingAsset` - للـ SVG المؤقت فقط، سيُلغى للـ PNG

---

## التسليم المرحلي

| المرحلة | المدة المتوقعة | المخرجات القابلة للتجريب |
|---------|----------------|---------------------------|
| 1 - لون | 3-4 أيام | 12 PNG على CDN + ادمن تلوين يعمل + التطبيق يعرضها بدون تكرار |
| 2 - ارسم مثلي | 2-3 أيام | 12 صورة كاملة + ادمن + شاشة نسخ |
| 3 - وصل | 2 أيام | 10 وصل + ادمن نقاط + لعبة وصل |
| 4 - أكمل | 2 أيام | 10 أكمل + ادمن نصف/كامل + لعبة أكمل |
| 5 - تتبع R2 | 1 يوم | نقل التتبع لـ R2 |

**البداية:** المرحلة 1 فوراً بعد موافقة العميل على هذه الخطة.

---

## النواقص الحالية في التطبيق (يجب إصلاحها في كل مرحلة)

1. **app_main/assets لا يحتوي على v2 PNGs** - يجب إما نسخها أو حذف الاعتماد المحلي
2. **coloring_board_v2.dart** لا يدعم SVG - صحيح لأنه سيبقى PNG، لكن الفولباك الحالي يحتاج إرجاع لـ PNG بعد الرفع
3. **my_boards** يعرض كل الأنواع معاً - يحتاج فلترة حسب category
4. **لا صفحة "ارسم مثلي" منفصلة** - حالياً جزء من لوحاتي فقط
5. **لا منطق لـ "وصل" و "أكمل" في التطبيق** - يحتاج صفحات جديدة
6. **الادمن الحالي صفحة واحدة عامة** - يحتاج تقسيم 4 صفحات متخصصة كما طلب العميل

---

## القرارات المطلوب تأكيدها من العميل قبل البدء

- [ ] هل توافق على رفع 12 PNG الحالية في `assets/images/coloring/v2` كدفعة أولى للتلوين؟
- [ ] هل تريد الاحتفاظ بـ `remove-background` لكل تلوين أم الصور الحالية جاهزة شفافة؟
- [ ] لـ "ارسم مثلي": هل لديك 12 صورة كاملة جاهزة أم نولدها بـ PlayVeo؟
- [ ] لـ "وصل" و "أكمل": هل لديك ملفات JSON للنقاط/النصوص أم ننشئها من الصفر؟
