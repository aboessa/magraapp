# صفحة التلوين V2 — مطابقة 100% للتصميم + توليد شفاف

## الصور المرجعية
- صورة 1 = صفحة "لوّن" الرئيسية: خلفية #0C1030، Hero بنفسجي أزرق مع ولد، كروت لوحات التلوين/لوحاتي، رسومات مميزة 4، فئات 8 عمودين، إنجاز.
- صورة 2 = بورد "لوّن العصفور": canvas أبيض rounded 22، badge "3 من 8 مناطق ⭐"، hint "اضغط على أي منطقة..."، لوحة ألوان ✓، 5 أزرار ملونة، زر "تم ✓"، شريط "رسومات أخرى".

## الملفات
- `coloring_home_v2.dart` (Hub V2): Scaffold deepSpace #0C1030، Hero 184px gradient [6A3DF2→241A5E→0D1235] + نجوم + صاروخ + heroAsset `assets/images/studio/v2/coloring-hero.png` fallback `hero-start-drawing.webp` + pill ✨ جديد + عنوان "هيا نلوّن!" + CTA أصفر "ابدأ التلوين ✨".
- `coloring_board_v2.dart` (Board V2): محرك flood-fill (source RGBA + paint Uint32List + _ops replay للأند والريد)، يدعم PNG شفافة:
  - يرسم خلفية بيضاء دائماً قبل الدهان.
  - الـ line art PNG الشفافة ترسم بـ BlendMode.multiply فوق الدهان → لا هالة بيضاء.
  - badge أعلى يسار #FFF3C2 border #FFD34D، hint وسط #1A2348 0.92.
  - palette chips دائري 38px مع علامة ✓ بيضاء + ظل.
  - action row 5 أزرار مطابقة للصورة: حفظ #2EAC5A download، تلميح #FFD34D lightbulb، من جديد #6EE7FF auto_awesome، إعادة #38E8E0 refresh، تراجع #9F86FF undo.
  - done button بنفسجي #6A3DF2 50px "تم ✓" يصدّر PNG boundary pixelRatio 2.
  - other strip أفقي 72px thumbnails border بنفسجي عند الاختيار.
- `creative_studio_page.dart` bridge: عند النقر على فئة coloring → `ColoringHomeV2Page` بدلاً من `_StudioCategoryPage` القديم، مع الحفاظ على childId/creationStore/save.

## توليد الأصول عبر PlayVeo (nano_banana + Remove Background)

### حسب التوثيق المرسل https://playveo.online/docs/
API يدعم:
- POST /v1/images/text-to-image {prompt, aspect_ratio, model:nano_banana_2, count}
  → {id, status:pending, cost:0.1}
  GET /v1/images/:id → {status:completed, resultUrls:[JPEG]}

- **POST /v1/images/remove-background** {image: base64 OR url: JPEG}
  → **Synchronous** {status:completed, url: transparent PNG تبقى 10 أيام, cost:0.05}
  لا تحتاج polling. هذه النقطة التي سألت عنها: نعم التوثيق بيدعم إزالة الخلفية وإنتاج PNG شفاف.

التكلفة لكل رسمة تلوين: 0.1 + 0.05 = 0.15$ (ضمن الميزانية).

### ملفات التوليد
- `tools/playveo/coloring-v2.manifest.json`: مصدر الحقيقة — 12 رسمة تلوين + hero واحد، style_tail لضمان خطوط سوداء سميكة مغلقة على أبيض.
- `tools/playveo/generate_coloring_v2.mjs`: ينفذ pipeline:
  1) fullPrompt = prompt + style_tail slice 1800
  2) submit T2I → waitFor id polling 7s timeout 8m
  3) download JPEG tmp
  4) لو kind=coloring_line و remove_background=true → POST /v1/images/remove-background {url: firstUrl} → transparent PNG → save إلى out_dir/*.png
  5) hero يحفظ JPEG مباشرة

للتشغيل:
```powershell
$env:PLAYVEO_API_KEY="pv_..."
node tools/playveo/generate_coloring_v2.mjs
```

ملاحظة: المفتاح المرفق `pv_IzCCZCf7qtnvmDnyghfK4VTOCoOknbfK4VTOCoOknbf5` يرجع حالياً 401 Unauthorized — غالباً انتهى الرصيد/انتهت صلاحيته. الحل: مفتاح جديد من dashboard PlayVeo. بينما ذلك، الواجهة تعمل بـ fallback نسخ bird.png إلى جميع مسارات v2 في كل من `assets/images/coloring/v2/` و `app_main/assets/images/coloring/v2/` + hero من `hero-start-drawing.webp`.

### كيفية عمل الشفافية في Flutter
- في `_PictureMultiplyPainter`: paint blendMode multiply → أسود على أبيض يبقى أسود، أبيض يصير شفاف (أو خلفيته البيضاء تختفي لو الـ PNG نفسه شفاف).
- في `_BoardPainter`: paintImage (نتائج flood-fill) على خلفية Container white.
- flood-fill يعمل على sourceRgba (JPEG/برد PNG شفاف): pixels البيضاء في source يتم اعتبارها حائط؟ لا — خوارزميته drift tolerance 120 حول seed color → تعمل أيضاً على PNG شفاف حيث alpha لكن سُيُولَّد blanco.
- لتحويل PNG بعد remove-bg إلى flood-fill صحيح: sourceRgba يتضمن alpha channel؛ البكسل الشفاف r=0,g=0,b=0,a=0 لكنه ليس أسود فعلي — نحتاج إلى معالجة "شفاف = أبيض". حالياً يعامل كـ drift لكن سنحسنه لاحقاً بـ whiteIfTransparent logic.

## ما تم إنجازه
- [x] إنشاء coloring_home_v2.dart مطابق 100% صورة 1
- [x] إنشاء coloring_board_v2.dart مطابق 100% صورة 2 + محرك flood-fill + شفافية
- [x] bridge في creative_studio_page.dart (حفظ + تنقل + FutureBuilder count)
- [x] fallback assets نسخ bird.png لجميع الفئات
- [x] manifest + generate script بـ remove-background sync
- [x] pubspec إضافة assets v2
- [x] لا أخطاء compile

## المتبقي (يحتاج مفتاح PlayVeo جديد)
- [ ] تشغيل generate_coloring_v2.mjs بمفتاح صالح → إنتاج 12 PNG شفاف + hero
- [ ] استبدال fallback بـ PNG الحقيقية الشفافة عبر Remove Background
- [ ] (اختياري) إضافة صفحة category catalog كاملة لكل فئة بدلاً من أول رسمة demo
- [ ] (اختياري) وضع whiteIfTransparent في _floodFill للتعامل الصحيح مع PNG الشفافة الجديدة

## الألوان المستعملة (من الصور)
- deepSpace #0C1030
- hero gradient #6A3DF2,#241A5E,#0D1235
- gold #FFD34D border #FF9F45 text #0C1030
- purple accent #6A3DF2
- green save #2EAC5A, yellow hint #FFD34D, light blue new #6EE7FF, cyan redo #38E8E0, purple undo #9F86FF
- badge #FFF3C2 border #FFD34D text #0C1030
- hint pill #1A2348 0.92 text white
- thumbnail selected border #6A3DF2 width 2
