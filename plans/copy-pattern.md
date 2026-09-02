# خطة انسخ النمط — Copy Pattern

> المرحلة 6 - قسم مستقل في الاستوديو الإبداعي. الصور من Backend API + R2، والـFlutter مسؤول عن اللعب والـmicro-animations فقط. الترتيب: ادمن + تطبيق + رفع لكل مستوى.

---

## 1) فكرة النشاط

الطفل يشاهد Pattern ثم: ينسخه بنفس الترتيب / يكمل العنصر التالي / يملأ عناصر ناقصة / يعيده من الذاكرة في المستويات المتقدمة.

مثال: `كوكب → نجمة → صاروخ → كوكب → نجمة → ؟` → الجواب `صاروخ`. أو لوحة من 3 عناصر يعيد ترتيبها كاملة.

## 2) المعمارية

```
Admin CMS
  ↓
Backend API
  ↓
Database ──── R2 Media Storage
  ↓               ↓
Pattern Data    PNG/WebP Assets
  ↓               ↓
       Flutter App
            ↓
    Pattern Runtime Engine
```

- R2: PNG/WebP + thumbnails + icons + pattern element artwork (+ صوت اختياري).
- Database: النشاط + sequence + answer + تصنيف + عمر + صعوبة + mode + asset IDs + hints + حالة النشر.
- API: بيانات النشاط + asset metadata + URLs + pattern configuration.
- Flutter: Rendering + Drag&Drop + Tap + Snap animation + Validation + Hint + Undo + Success feedback + Save/Resume.

### 3) الصور لا تُخزن داخل الـActivity

لا نخزن `imageUrl` في كل نشاط. النشاط يشير إلى `assetId` مثل `planet-purple`، والمكتبة تحله إلى R2 object `patterns/space/planet-purple.webp`. يسمح بتغيير الصورة مستقبلاً بدون تعديل الأنشطة.

## 4) مكتبة الأصول — 50 عنصر reusable

نفس 50 أصل تبني مئات الأنشطة بدون توليد صور جديدة لكل نشاط:

- **أشكال (8):** Circle/Square/Triangle/Star/Heart/Diamond/Hexagon/Red-circle — tokens لامعة مستديرة 3D.
- **فضاء (8):** Rocket/Planet/Moon/Space-star/Earth/Astronaut/UFO/Satellite.
- **حيوانات (10):** Bird/Cat/Dog/Panda/Rabbit/Fish/Butterfly/Turtle/Lion/Dino.
- **طبيعة (8):** Sun/Cloud/Flower/Tree/Leaf/Mushroom/Apple/Rainbow.
- **مركبات (8):** Car/Bus/Train/Plane/Boat/Balloon/Truck/Excavator.
- **أشياء وطعام (8):** Gift/Balloon/Pencil/Ball/Book/Cupcake/Banana/Cup.

الأسماء الثابتة: `circle-blue`, `square-yellow`, `rocket-red`, `planet-purple` ... إلخ.

## 5) مواصفات الصور

- WebP transparent مفضل، PNG مسموح. مقاس 512×512 أو 384×384 موحد.
- عنصر واحد فقط، خلفية شفافة، لا نص، لا UI، لا علامة مائية، silhouette واضحة، تباين قوي، بدون تفاصيل صغيرة جداً.
- Master Style ثابت في نهاية كل Prompt:

> Premium child-friendly game asset for an Arabic kids app, polished cute 3D-cartoon illustration, simple rounded geometry, bold readable silhouette, bright harmonious colors, soft studio lighting, subtle dimensional shading, centered single object, front or simple three-quarter view, isolated on transparent background, no environment, no floor, no text, no letters, no numbers, no logo, no watermark, no UI, no border, no frame, no extra objects, consistent Majarra kids app visual style, easy to recognize at small mobile size, 1:1 square composition, transparent PNG.

- Negative Prompt موحد للـ50: `multiple objects, group of objects, scene, landscape, environment, background, white background, text, letters, numbers, Arabic writing, English writing, watermark, logo, UI, card, button, frame, border, photorealistic, realistic photography, complex details, tiny details, dark horror style, scary face, deformed shape, duplicated object, extra limbs, cropped object, messy composition, heavy shadow, busy background`

### قائمة الـ50 Prompt

| # | الاسم | Prompt |
|---|-------|--------|
|01| دائرة زرقاء | A single glossy bright blue circle token, slightly dimensional rounded 3D appearance, clean simple shape, soft highlight, centered. |
|02| مربع أصفر | A single bright golden-yellow rounded square token, softly beveled corners, glossy child-friendly 3D finish, centered. |
|03| مثلث سماوي | A single turquoise cyan rounded triangle token, soft beveled edges, simple glossy 3D appearance, centered. |
|04| نجمة صفراء | A single cute five-point golden yellow star, softly rounded tips, subtle glossy highlights, friendly premium 3D game asset. |
|05| قلب وردي | A single bright pink rounded heart icon, soft inflated 3D shape, glossy highlight, cute child-friendly appearance. |
|06| معين بنفسجي | A single purple diamond-shaped token with rounded corners, polished glossy finish, simple readable silhouette. |
|07| سداسي أخضر | A single bright green rounded hexagon token, subtle 3D depth and soft highlight, simple educational game asset. |
|08| دائرة حمراء | A single bright red circular token, smooth glossy 3D surface, bold clean silhouette, centered. |
|09| صاروخ | A cute small red, white and blue cartoon rocket pointing diagonally upward, one large blue round window, yellow fins and orange flame, simple compact proportions. |
|10| كوكب بنفسجي | A cute purple planet with a large orange and violet ring around it, glossy spherical body, simple attractive space-game icon. |
|11| قمر هلال | A cheerful golden crescent moon, softly rounded shape, tiny friendly smile, simple glossy 3D finish. |
|12| نجمة فضائية | A cute glowing yellow space star with rounded points, subtle happy face, polished 3D cartoon style. |
|13| كوكب الأرض | A simplified cute Earth globe, bright blue oceans and large green land shapes, smooth round 3D appearance, no tiny geographical detail. |
|14| رائد فضاء | A cute small child astronaut in a white spacesuit with blue and purple details, large round helmet visor, simple full-body pose, friendly expression. |
|15| طبق طائر | A cute purple and turquoise UFO, rounded dome, three small yellow lights underneath, simple symmetrical cartoon design. |
|16| قمر صناعي | A small cute satellite with a silver central body, two blue rectangular solar panels and tiny antenna, simplified child-friendly design. |
|17| عصفور | A cute little blue and yellow bird, rounded body, orange beak, one visible wing, big friendly eye, simple standing pose. |
|18| قطة | A cute orange kitten sitting upright, rounded head, cream belly, small triangular ears, curled tail and friendly large eyes. |
|19| كلب | A cheerful brown puppy sitting, floppy ears, cream muzzle and belly, simple rounded paws and happy expression. |
|20| باندا | A cute baby panda sitting, round white face, black ears and eye patches, simple compact body and friendly expression. |
|21| أرنب | A cute white rabbit sitting upright, long ears with pink inner sections, rounded paws and small fluffy tail. |
|22| سمكة | A cheerful tropical fish with turquoise-blue body, yellow fins and orange tail, simple large shapes and friendly eye. |
|23| فراشة | A cute colorful butterfly with symmetrical purple, pink and turquoise wings, yellow body and simple rounded patterns. |
|24| سلحفاة | A friendly green turtle viewed from the side, rounded green head, four simple legs and bright patterned shell with broad sections. |
|25| أسد صغير | A cute baby lion sitting, golden body, rounded orange mane, curved tail and friendly smiling face. |
|26| ديناصور | A friendly green baby dinosaur, rounded body, yellow belly, small purple back spikes and cheerful face, non-scary. |
|27| شمس | A cheerful bright yellow sun, round center with eight large rounded rays, subtle happy face, glossy cartoon finish. |
|28| سحابة | A cute fluffy light-blue and white cloud, simple rounded lobes, soft dimensional shading, compact silhouette. |
|29| زهرة | A single cheerful flower with six large pink petals, yellow center, short green stem and two simple leaves. |
|30| شجرة | A cute simplified tree, rounded bright green canopy, short brown trunk, broad simple shapes, no tiny leaves. |
|31| ورقة شجر | A single bright green leaf, clean oval shape with pointed tip and one simple center vein, polished cartoon appearance. |
|32| فطر | A cute red mushroom with large white spots, cream stem and rounded child-friendly proportions. |
|33| تفاحة | A bright red apple with green leaf and short brown stem, glossy rounded 3D appearance, simple silhouette. |
|34| قوس قزح | A small cute rainbow made of five broad colorful arcs ending in two tiny fluffy clouds, clean compact game icon. |
|35| سيارة حمراء | A cute compact red cartoon car viewed from a simple three-quarter angle, two large black wheels, blue windows and friendly rounded proportions. |
|36| حافلة | A cute yellow mini bus viewed from the side, rounded shape, four simple blue windows and two chunky wheels, no text. |
|37| قطار | A colorful toy-like train engine, blue cabin, red front, yellow details and large simple wheels, isolated single engine only. |
|38| طائرة | A cute blue and white passenger airplane pointing diagonally upward, rounded wings and tail, simplified proportions, no airline markings. |
|39| قارب | A small colorful boat with blue hull, red upper section and one simple white cabin, viewed slightly from the side. |
|40| منطاد | A cute hot air balloon with broad vertical panels in orange, yellow, turquoise and purple, small brown basket underneath. |
|41| شاحنة | A friendly blue delivery truck, compact cab, yellow cargo box and chunky black wheels, simple rounded design, no text. |
|42| حفار | A cute yellow excavator with blue cabin, black tracks and simplified articulated digging arm, compact construction vehicle icon. |
|43| هدية | A cute purple gift box with bright pink ribbon and large decorative bow, glossy premium 3D cartoon appearance. |
|44| بالونة | A single bright turquoise party balloon, rounded shape, small tied knot and short curved string, simple clean silhouette. |
|45| قلم رصاص | A cute chunky purple and yellow pencil positioned diagonally, sharpened tip and pink eraser, simple child-friendly proportions. |
|46| كرة | A bright colorful toy ball divided into large blue, yellow, red and green curved sections, glossy rounded appearance. |
|47| كتاب | A cute closed blue storybook with purple spine and simple yellow star decoration on the cover, no text. |
|48| كب كيك | A cute cupcake with yellow wrapper, pink frosting and one red cherry on top, simple clean shapes, no sprinkles that are too small. |
|49| موزة | A single cheerful curved yellow banana, polished cartoon appearance, simple thick silhouette, no face necessary. |
|50| كوب | A cute turquoise drinking cup with a short purple straw and simple rounded handle, clean child-friendly cartoon design. |

## 6) تنظيم R2

```
creative-studio/patterns/
  shapes/{circle-blue.webp, square-yellow.webp, ...}
  space/{rocket-red.webp, planet-purple.webp, ...}
  animals/{bird-blue-yellow.webp, panda.webp, ...}
  nature/{flower-pink.webp, ...}
  vehicles/{car-red.webp, ...}
  objects/{gift-purple.webp, ...}
  thumbnails/{pattern-space-001.webp, ...}
```

Flutter يتعامل مع `assetId` فقط، لا المسار.

## 7) أنواع الأنشطة (Modes)

Copy / Continue / Missing / Color Pattern / Shape Pattern / Picture Pattern / Mixed / Direction / Memory — كلها من نفس الـ50 أصل (مثال: `⭐ 🌙 🚀 ⭐ 🌙 ?` أو `🔵 ? 🔺 🔵`)

## 8) مستويات الصعوبة

- سهل 3-5: AB/ABAB/AABB/ABC — 2-3 عناصر، 4-6 خانات، 0-1 مشتت.
- متوسط 5-7: AAB/ABB/ABC/ABAC/ABCD — 3-5 عناصر، 6-8 خانات، 1-3 مشتتات.
- متقدم 7-9: Mixed/Direction/Memory — 6-10 خانات، عنصر ناقص في الوسط.

## 9) الصفحة الرئيسية

Header "انسخ النمط" + Hero + فئات (الكل/أشكال/فضاء/حيوانات/طبيعة/مركبات/ألوان) + "ابدأ من حيث توقفت" + "اختر نمطاً" (Thumbnail + صعوبة + حالة).

## 10) شاشة النشاط

Header → تعليمات → النمط الأصلي → مساحتك `[ ][ ][ ]` → Element Bank (مع مشتتات) → Actions. مثال: 3 عناصر صحيحة + Moon مشتت.

## 11) طرق التحكم

Drag&Drop + Tap→Tap (مهم للأطفال الأصغر وذوي الاحتياجات).

## 12-13) الـAnimations

Static فقط. Flutter يعمل micro-interactions: Scale 1.07 اختيار، Snap عند Drop، Glow/Pop للصحيح، Pulse للتلميح، Confetti خفيف عند النجاح. لا حاجة لـ `rocket-animation.json`.

## 14) التلميحات — Help Ladder (1→4)

1 Highlight الخانة → 2 Highlight العنصر الصحيح → 3 Animation نحو الخانة → 4 وضع تلقائي. لا نبدأ بالإجابة.

## 15-16) الخطأ والنجاح

لا "خطأ" ولا "0/10" — "جرّب مرة أخرى" + Highlight. عند النجاح: "رائع! أكملت النمط" + Stars/Confetti + أزرار (نشاط جديد / مشابه / عودة).

## 17) Data Model

```json
{
  "id": "pattern-space-001", "type": "copy_pattern",
  "title": {"ar": "نجوم وكواكب"}, "category": "space",
  "age": {"min": 4, "max": 6}, "difficulty": "easy",
  "mode": "continue",
  "sequence": ["planet-purple", "star-yellow", "rocket-red", "planet-purple", "star-yellow"],
  "answer": ["rocket-red"],
  "elementBank": ["rocket-red", "moon-blue", "planet-purple"],
  "thumbnailAssetId": "thumb-pattern-space-001",
  "hintMode": "progressive", "status": "published"
}
```

إن وُجد domain لـ copy_pattern يوسّع الموجود ولا ينشئ Schema منافس.

## 18) API

`GET /api/v1/creative/patterns` + `GET /api/v1/creative/patterns/:id` — يرجع `assetId` مع `imageUrl` المولدة من Media Service.

## 19) Admin CMS — القائمة

`Creative Studio → انسخ النمط` — جدول (Title/Category/Age/Difficulty/Mode/Status/Preview/Updated) + زر New Pattern.

## 20) Pattern Builder — أهم شاشة

Asset Library (اختيار Planet/Star/Rocket/Moon) + Drag&Drop لبناء Original Pattern + تحديد `?` للجواب + Element Bank + Preview.

## 21) رفع الأصول

`Pattern Asset Library → Upload Asset` (Name/Category/PNG/WebP/Alt/Status) → Validation → R2 → Media Library record → assetId → يظهر في Builder.

## 22) Readiness Validation

Pattern موجود + Correct answer + كل Asset Ready + Answer داخل Element Bank + Slots صحيحة + age/difficulty + Arabic title + Preview + لا Broken Media.

## 23-24) Cache و Save/Resume

Flutter cache لكل `assetId` (planet-purple مرة واحدة لـ 20 نشاط). الحفظ: childId/activityId/slotValues/currentStep/hintsUsed/completed/updatedAt.

## 25) Audio

`instructionAudioAssetId` اختياري لكل نشاط، الملف على R2، والـAPI يرجع URL.

## 26) Launch Content

50 أصل بصري → 30 نشاط أولي (10 سهل /12 متوسط /8 متقدم) → نفس الأصول تصنع 100+ لاحقاً بدون توليد جديد.

## 27-28) الـFlow النهائي

`Admin uploads PNG/WebP → Media Service → R2 → assetId → Pattern Builder → Create → Validate → Publish → API → Flutter (cached) → Child plays → Progress saved`

---

## 29) فصل الادمن — المطلوب تنفيذه

### القائمة الحالية ناقصة

| المسار | الحالة |
|---|---|
| `creative-studio/coloring` | `CreativeColoringAdminPage` ✓ |
| `creative-studio/draw-like-me` | `CreativeDrawLikeMeAdminPage` ✓ |
| `creative-studio/connect-dots` | `CreativeStudioAdminPage` عامة ✗ |
| `creative-studio/complete` | `CreativeStudioAdminPage` عامة ✗ |
| `creative-studio/trace` | `CreativeStudioAdminPage` عامة ✗ |
| `copy_pattern` | لا Route أصلاً ✗ |

### المطلوب

**A. مسار جديد:** `creative-studio/copy-pattern` → صفحة `CreativeCopyPatternAdminPage.tsx` + entry في `Sidebar.tsx` (انسخ النمط).

**B. فصل الصفحات الثلاث الوهمية:** كل مسار يخدم صفحة مخصصة:
- `connect-dots` → `CreativeConnectDotsAdminPage.tsx` (محرر نقاط تفاعلي + geometry_json)
- `complete` → `CreativeCompleteAdminPage.tsx` (رفع زوج reference_full/challenge + thumbnail)
- `trace` → `CreativeTraceAdminPage.tsx`

**C. مكتبة الأصول المشتركة:** تبويب `Pattern Asset Library` داخل صفحة انسخ النمط — جدول الأصول (Name/Category/Preview/Status) + زر Upload يرفع إلى `patterns/{category}/{assetId}.webp`.

**D. الـBuilder:** في نفس الصفحة، قسم ثانٍ يبني النشاط من المكتبة (Drag&Drop + تحديد الجواب + اختيار Element Bank) ويحفظ `sequence`/`answer`/`elementBank` في D1.

### ترتيب التنفيذ المقترح

1. كتابة هذه الخطة (هذا الملف) + إنشاء Route/Sidebar لانسخ النمط (لا يمس المحتوى).
2. توليد 50 أصل بصري عبر PlayVeo ورفعها إلى R2.
3. بناء `CreativeCopyPatternAdminPage` (قائمة + مكتبة + Builder).
4. بناء منطق التطبيق (PatternRuntimeEngine + شاشة النشاط).
