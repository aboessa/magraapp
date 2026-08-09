# تقرير تدقيق تطبيق مجرة (Flutter) — Gap Analysis

**التاريخ:** 2026-08-07
**النطاق:** `F:\Projects\cartoonapp\app_main` مقابل كل وثائق التخطيط في المستودع + الـ API الفعلي في `dashboard\api`
**الأدلة:** `flutter analyze`، `flutter build web --release`، قراءة كل ملفات `lib/` (56 ملف)، قراءة مصادر الـ Worker، قياس حجم الأصول
**لم يُعدَّل أي ملف من التطبيق.**

---

## 1. الملخص التنفيذي

**التطبيق لا يُبنى. لا يمكن إنتاج نسخة قابلة للتشغيل من الكود الحالي.**

دليل قاطع:

```
$ flutter analyze
error - Undefined name 'isTelevision'
        - lib\features\home\presentation\shells\adaptive_home_shell.dart:44:23
18 issues found.

$ flutter build web --release
Error: The getter 'isTelevision' isn't defined for the type '_AdaptiveHomeShellState'.
Error: Compilation failed.
Error: Failed to compile application for the Web.
```

هذا يعني أن كل ما يلي في التقرير هو تحليل لكود **لم يُشغَّل ولم يُختبر** في صورته الحالية.

### التقييم العام

ما هو موجود فعلاً هو **نموذج أولي بصري (visual prototype / clickable mockup) عالي الجودة الفنية**، مبني بعناية على مستوى التصميم — نظام ألوان منظم، تدرّجات سينمائية، Focus management للتلفزيون، احترام `MediaQuery.disableAnimationsOf` في كل الانتقالات، معالجة ذكية لمشكلة mojibake العربي في `content_dtos.dart`، ومنطق fallback علائقي مدروس في `content_repository.dart`.

لكنه **ليس تطبيق منتج**. الفجوة ليست في «ميزات ناقصة» بل في أن **طبقة البيانات والمنطق غير موجودة تحت واجهة كاملة**:

| الحقيقة | الدليل |
|---|---|
| لا يوجد مشغّل فيديو | `video_player` و `chewie` في `pubspec.yaml` لكن **صفر استخدام** في `lib/`. `playback_page.dart` يعرض صورة مصغّرة ثابتة + `Timer` يزيد شريط تقدّم وهمي |
| لا يوجد تخزين محلي / كاش | `hive_flutter` و `shared_preferences` في `pubspec.yaml`، **صفر استخدام** |
| لا يوجد تتبّع تقدّم | `updateProgress()` معرّفة في الـ API client، **لا تُنادى من أي مكان** |
| لا توجد اختبارات | لا مجلد `test/` ولا `integration_test/` على الإطلاق |
| لا توجد ترجمة (i18n) | لا ملفات `.arb`، لا `l10n.yaml`، كل النصوص مكتوبة حرفياً داخل الـ widgets |
| لا يوجد تحليلات | `MajarraAnalytics` معرّفة بالكامل، **صفر مواضع نداء** |
| لا توجد إشعارات | لا `firebase_messaging`، لا `POST_NOTIFICATIONS` في المانيفست |
| لا يوجد توقيع للإصدار | `build.gradle.kts` لا يحتوي `signingConfigs` (تعليق صريح يقول ذلك) |
| بوابة ولي الأمر مفتوحة | `parent_pin_page.dart:29` — `if (_pin.text == '1234' \|\| _pin.text.length >= 4)` → **أي 4 أرقام تنجح** |

### نسبة الإنجاز الإجمالية

| البعد | النسبة |
|---|---|
| واجهة/تصميم بصري | ~75% |
| منطق تطبيقي حقيقي | ~12% |
| ربط بالخدمة الخلفية | ~8% |
| جاهزية للإنتاج | **~5%** |
| **مرجّح إجمالي** | **~20–25%** |

### الحكم على جاهزية الإنتاج

**غير جاهز — وليست المسافة قصيرة.** ثلاثة عوائق مستقلة، كل منها كافٍ لمنع الإصدار:

1. **الكود لا يُترجم** (compile error).
2. **الـ backend لا يوجد به محتوى منشور**: كل السلاسل والحلقات في migrations بحالة `status='draft'` / `is_published=0`، ولا توجد `content_assets` مزروعة. أي أن نقاط النهاية العامة تُرجع مصفوفات فارغة، والتطبيق يعمل حالياً **دائماً** على `LocalCatalog` المحلي المزيّف.
3. **لا يوجد مسار دفع/تشغيل/تحميل حقيقي** — لا DRM، لا تراخيص، لا تنزيل، لا شراء.

### تنبيه أمني منفصل عن الـ Flutter

`dashboard\api\.secrets.local.txt` موجود داخل شجرة المستودع. يجب التحقق فوراً من أنه مُستثنى في `.gitignore`، وتدوير أي مفاتيح ظهرت فيه.

---

## 2. تغطية التنفيذ لكل وحدة

| الوحدة | النسبة | ما هو موجود | ما هو غائب |
|---|---|---|---|
| **معمارية المشروع** | 60% | فصل `app/` `core/` `features/` بنمط feature-first؛ `domain/data/presentation` في `home` فقط | لا `domain/` ولا `data/` في 11 من 13 feature؛ لا `core/l10n`, `core/security`, `core/entitlements`, `core/media_protection`, `core/age` (كلها مطلوبة نصاً في `PLAN_PHASE_1_DETAILED.md:67-93` و `TECH_STACK.md:126`) |
| **التوجيه (Routing)** | 45% | 21 مسار في `app_router.dart` تعمل | صفر route guards (المطلوب 3: Parent Session / Child Session / Parental Area)؛ لا deep linking؛ `/planets?planetId=X` يُهمل الـ query param تماماً؛ لا `redirect`؛ `initialLocation: '/'` يتخطى تسجيل الدخول |
| **إدارة الحالة** | 30% | Riverpod، `homeCatalogProvider`, `childProvider`, `deviceProfileProvider` | لا providers مرتبطة بـ `activeChildId`؛ لا invalidation عند تبديل الطفل؛ `childProvider` حالة ذاكرة فقط (تُفقد عند إعادة التشغيل)؛ معظم الحالة `setState` محلية داخل الصفحات |
| **الموديلات** | 55% | `Planet/SeriesItem/EpisodeItem/BookItem/ExperienceItem/HomeCatalog` + DTOs بتحويل آمن | لا `Child`, `Parent`, `Entitlement`, `Device`, `Progress`, `Mastery`, `LearningObjective`, `Attempt`, `GamePack`, `Story`, `Project`؛ لا `copyWith`/`==`/`hashCode` في أي موديل؛ لا serialization توليدي |
| **المستودعات (Repositories)** | 25% | `ContentRepository.loadHome()` فقط، بمنطق fallback علائقي جيد | لا repository لـ auth / family / playback / progress / billing / downloads / search |
| **ربط الـ API** | 8% | 5 نقاط تُنادى فعلاً: `login`, `register`, `planets`, `series`, `episodes` | 8 دوال معرّفة وميتة + مسارات خاطئة (تفصيل في §7) |
| **المصادقة** | 20% | login/register يعملان؛ التوكنات في `flutter_secure_storage` | لا refresh (الـ access token عمره **900 ثانية**، ولا كود يجدّده → التطبيق يفقد الجلسة بعد 15 دقيقة)؛ لا logout؛ لا نسيان كلمة المرور؛ لا تحقق بريد؛ لا session restore عند الإقلاع؛ لا 401 interceptor |
| **بوابة ولي الأمر** | 5% | شاشة PIN موجودة | **الفحص وهمي ويمرّ دائماً**؛ لا biometric (الزر `onPressed: () {}`)؛ لا PIN في الـ backend إطلاقاً (لا عمود ولا route) |
| **ملفات الأطفال** | 10% | شاشة اختيار + فلترة بالعمر | 3 أطفال **مكتوبين حرفياً** في الكود (ليلى/عمر/سارة)؛ `POST /family/children` غير مستخدم؛ لا إضافة/تعديل/حذف؛ لا حفظ للاختيار |
| **التخزين المحلي** | 5% | `flutter_secure_storage` للتوكنات فقط | `hive_flutter` + `shared_preferences` غير مستخدمين؛ لا كاش للكتالوج؛ لا طوابير أوفلاين؛ لا حفظ إعدادات |
| **الوسائط/التشغيل** | 5% | واجهة مشغّل كاملة بصرياً | لا `VideoPlayerController`؛ لا HLS/DASH؛ لا DRM؛ لا captions حقيقية (زر CC يقلب bool فقط)؛ لا جودة فعلية؛ لا fullscreen؛ لا next episode؛ لا PiP؛ `Timer.periodic` في `initState` **لا يُلغى في `dispose`** (تسريب) |
| **التنزيل/الأوفلاين** | 2% | `OfflineService` بثوابت + bottom sheet | الكلاس **غير مستخدم في أي مكان**؛ لا تنزيل؛ لا تراخيص؛ لا يوجد أي endpoint تنزيل في الـ backend أصلاً |
| **الإشعارات** | 0% | — | لا شيء. زر «ذكرني» في `_ComingSoonRail` زخرفة |
| **الترجمة/RTL** | 25% | `Locale('ar')` مثبت + delegates + `EdgeInsetsDirectional`/`PositionedDirectional` بشكل منهجي جيد | لا `.arb`؛ لا `l10n.yaml`؛ لا `AppLocalizations`؛ `supportedLocales` تعلن `en` بلا ترجمات؛ القارئ يعرض `fr` في القائمة بلا نص فرنسي |
| **معالجة الأخطاء** | 30% | `MajarraApiException`؛ error views في Home والتفاصيل؛ `errorBuilder` في الراوتر | `catch (_)` يبتلع الأخطاء؛ الرسائل الخام (`HTTP 500: <body>`) تُعرض للمستخدم؛ لا تمييز شبكة/سيرفر/تصريح؛ لا retry/backoff؛ `error: (_, __) => Text('خطأ')` في `/planets` |
| **الأمان** | 15% | secure storage؛ فحص `https` قبل `Image.network`؛ allowlist في التحليلات | بوابة PIN مكسورة؛ لا cert pinning؛ لا `FLAG_SECURE` (مطلوب نصاً)؛ لا حماية لقطة شاشة؛ لا تحقق `installation_id` حقيقي (`'dev-install-$email'`) |
| **الأداء** | 30% | `Sliver*`، `PageStorageKey`، `ListView.separated`، `webp` متاح | **20.79 MB أصول** منها 13.68 MB PNG + 4.88 MB JPG مكرّرة بـ 2.23 MB WebP؛ الشعار 1.66 MB **مرتين**؛ لا `cacheWidth`/`ResizeImage`؛ لا كاش قرصي للصور الشبكية؛ `Column` داخل `Stack` في `_ProfileDestination`؛ إعادة بناء الشجرة كاملة على كل `setState` في `playback_page` كل ثانية |
| **الاختبارات** | 0% | — | لا مجلد `test/` ولا `integration_test/` |
| **الوصولية** | 40% | `Semantics` في الصور والبطاقات؛ `FocusableScale`؛ `ReadingOrderTraversalPolicy`؛ احترام reduce-motion في كل مكان | أهداف لمس أقل من 48dp (أزرار 36×36، `visualDensity: compact`، نصوص 9–10px)؛ نص 9px يفشل أي معيار تباين/حجم؛ لا `TextScaler 2.0` (تخطيطات بارتفاعات ثابتة ستنكسر)؛ لا بدائل نصية لنتائج الألعاب؛ لا بديل tap-then-tap |
| **التحليلات/التسجيل** | 3% | `MajarraAnalytics` بallowlist و PII filter (تصميم جيد) | **صفر مواضع نداء**؛ لا sink (`// TODO: Queue -> Analytics Engine`)؛ `print` فقط في debug؛ لا crash reporting |

---

## 3. الميزات الغائبة كلياً

مصنّفة، مع موضع الطلب في الوثائق.

### 3.1 التشغيل والحماية
| # | الغائب | المصدر |
|---|---|---|
| M1 | مشغّل فيديو حقيقي (HLS/DASH، ABR 480/720/1080) | `PLAN_PHASE_1_DETAILED.md` (قسم Playback)، `TECH_STACK.md` |
| M2 | Multi-DRM (Widevine / FairPlay / PlayReady) | `تشفير المحتوي.md` — كامل؛ `PLAN_PHASE_0.md` (بوابة إثبات Phase 0) |
| M3 | Signed URLs + license server + key rotation | `تشفير المحتوي.md` |
| M4 | `FLAG_SECURE` + secure surface + شاشة «الحجب عند التسجيل» | `تشفير المحتوي.md`؛ ضمن 13 شاشة `PLAN_PHASE_0.md:36` |
| M5 | Dynamic pseudonymous watermark (لا يغطي الترجمة) | `تشفير المحتوي.md` |
| M6 | Captions فعلية (WebVTT) | متطلب صريح في خطة التشغيل |
| M7 | playback start / heartbeat / end مع lease | `PLAN_PHASE_1_DETAILED.md`؛ الـ backend يوفرها فعلاً |
| M8 | Autoplay معطّل افتراضياً خصوصاً preschool | مذكور نصاً؛ الإعداد موجود في UI لكنه لا يتصل بشيء |

### 3.2 التقدّم والإتقان
| # | الغائب | المصدر |
|---|---|---|
| M9 | مزامنة التقدّم لكل `child_id` مع `event_id` مستقر | `PLAN_PHASE_1_DETAILED.md:288` (`family/progress`) |
| M10 | آلة حالة الإتقان بـ 6 حالات وعتبات آخر 5 محاولات | `docs\content\90-learning-objectives.md` |
| M11 | كتالوج 46 هدفاً تعليمياً | `docs\content\90-learning-objectives.md` — والجدول **صفر صفوف** في الـ backend (عائق مزدوج) |
| M12 | `attempts` + Outbox + طوابير محلية بمفتاح `child_id`+`event_id` | `docs\games\02-data-contract.md` |
| M13 | «تابع المشاهدة» حقيقي | كتلة `continue_journey` في UX plan |

### 3.3 الألعاب
| # | الغائب | المصدر |
|---|---|---|
| M14 | `GameEngineRegistry` مركزي **قبل** أي محرّك | `TECH_STACK.md`، `docs\games\08-implementation-plan.md` |
| M15 | 12 محرّك ألعاب (5 في موجة MVP) — الموجود **محرّك ذاكرة واحد يُستخدم لكل الألعاب** | `GAMES_SPEC.md`، `docs\games\engines\*` |
| M16 | عقد `content_pack` مع 6 مفاتيح صوت إلزامية | `docs\games\02-data-contract.md` |
| M17 | سلّم المساعدة 2/3/4 مع زر إعادة دائم | `docs\games\04-encouragement-and-failure.md` |
| M18 | 36 حزمة إطلاق | `docs\games\schemas\*` |
| M19 | Flame + Rive/Lottie | `TECH_STACK.md` |
| M20 | جلب أصول اللعبة عبر capability token من R2 | `PLAN_PHASE_1_DETAILED.md` (US16b) |

### 3.4 القارئ والمشاريع
| # | الغائب | المصدر |
|---|---|---|
| M21 | محتوى قصص حقيقي (الموجود 4 صفحات ثابتة + إيموجي بدل الصور) | `docs\content\00-content-model.md` |
| M22 | تشغيل صوتي متزامن + تظليل كلمة/جملة (الموجود **لافتة نصية** تقول «تظليل الجملة الحالية») | `docs\planets\كوكب-القصص.md` |
| M23 | 4 أنواع محتوى (picture_book / audio_story / comic / interactive) بتخطيطات مختلفة | `docs\content\00-content-model.md` |
| M24 | ميزة «مشاريع» بالكامل — شاشة Project ضمن الـ13 | `PLAN_PHASE_0.md:36` |

### 3.5 الحساب والعائلة
| # | الغائب | المصدر |
|---|---|---|
| M25 | تسجيل موافقة (consent) منفصل عن البوابة مع نسخة السياسة + الطابع الزمني | `التصاريح والادوار والمستخدمين .md` |
| M26 | CRUD ملفات الأطفال بحقول `nickname/birth_month/birth_year/avatar_id/interests/language` | نفس الملف |
| M27 | انتقالات العمر 5→6 و 8→9 مع الحفاظ على البيانات + شاشة review/postpone | نفس الملف |
| M28 | إدارة أجهزة حقيقية + سحب صلاحية + شاشة Revoke Device | نفس الملف + `PLAN_PHASE_0.md:36` |
| M29 | حدود المشاهدة الأربعة + شاشة «Limit Reached» | نفس الملف |
| M30 | تقرير أسبوعي لكل طفل | `docs\DASHBOARD.md` |
| M31 | تصدير/حذف بيانات الطفل | `التصاريح والادوار والمستخدمين .md` |
| M32 | تحكم أبوي لكل عالم **ولكل رفّ** في كوكب الإيمان (6 أرفف) | `docs\content\91-islamic-governance.md` |
| M33 | اقتران TV بـ QR حقيقي (الرمز `'739 482'` ثابت في الكود) | `PLAN_PHASE_0.md:36` |

### 3.6 الاشتراك
| # | الغائب | المصدر |
|---|---|---|
| M34 | Google Play Billing + RevenueCat — التطبيق يعرض «EGP 99.90» ثابتاً | `TECH_STACK.md`، `SETUP_SECRETS.md` |
| M35 | شاشة مقارنة الباقات | `PLAN_PHASE_0.md:36` |
| M36 | تدفّق الترقية/التخفيض مع keep-selection | `التصاريح والادوار والمستخدمين .md` |

### 3.7 عام
| # | الغائب | المصدر |
|---|---|---|
| M37 | Onboarding من 9 خطوات | `MAJARRA_CINEMATIC_STREAMING_UX_PLAN.md` |
| M38 | صفحة عالم الإيمان بـ 6 أرفف | `docs\content\91-islamic-governance.md` |
| M39 | «مكتبتي» — الكلاس `_LibraryDestination` **مكتوب بالكامل وغير مربوط** (`unused_element`) | UX plan |
| M40 | بنية i18n بالكامل (`.arb`, `l10n.yaml`) | `docs\games\01-localization-i18n.md` — يسرد 6 عناصر إعداد مفقودة |
| M41 | إشعارات/تذكيرات | لا مصدر — **الوثائق نفسها لا تحدد طبقة إشعارات**؛ لكن UI يعرض «ذكرني» و«إشعارات المحتوى الجديد» → تعارض UI/وثائق |
| M42 | Deep linking | لا مصدر — **فجوة في الوثائق** (لا scheme ولا مسارات محددة في أي ملف) |

---

## 4. الميزات المنفّذة جزئياً

| الميزة | منفّذ | ناقص |
|---|---|---|
| **الشاشة الرئيسية / Dynamic Feed** | 13 كتلة تُرسم من `HomeFeedContract`؛ الفصل بين العقد والعرض سليم | العقد **مكتوب في الكود** (`forNewcomer()`/`forReturning()` ثابتتان) وليس من الخادم؛ `isReturning` دائماً `false` فلا يُستخدم عقد العائد أبداً؛ `BlockRenderer.shouldShowBlock` يُخفي فقط نوعين ويُهمل `hideWhenEmpty` عموماً؛ كتلتان في العقد (`language_rail`, `tv_games_rail`) غير موجودتين في `BlockType` |
| **بيانات الكتل** | كلها تُرسم | **كلها مزيّفة**: `mostWatched`=`series.take(5)`، `newReleases`=`series.reversed.take(5)`، `becauseYouWatched`=`series.skip(1).take(5)`، `continueJourney`=`series.take(4)` بتقدّم `0.42 + index*0.12`، `comingSoon`=`series.take(5)` بتواريخ `['15 أغسطس','22 أغسطس',...]`، `audioRail`=**ألعاب** معروضة كصوتيات، `characterOrbit`=بوسترات السلاسل بأول كلمة من العنوان، `seasonalBanner`=«رمضان» ثابت، `learningJourney`=«مغامرة الحروف الأولى» بتقدّم `0.34` وزر «تابع» `onPressed: () {}` |
| **صفحة تفاصيل السلسلة** | تخطيط كامل، تبويبات، حلقات حقيقية من الكتالوج | **بقايا منتج آخر ظاهرة للمستخدم**: `'HERO WATARU'`، `'مغامرات البطل'`، تصنيفات `'أكشن'`/`'خيال علمي'`، `'7+'`، `'حلقة أسبوعياً'` — كلها ثابتة لكل سلسلة. إعجابات `311` وتعليقات `12` ثابتة. كل حلقة موسومة «مجاني» بغض النظر عن `is_free`. تبويبان من ثلاثة نص «قريباً». المفضلة/الإعجاب حالة ذاكرة لا تُحفظ. زر التنزيل snackbar |
| **الملف الشخصي** | تخطيط كامل وتنقّل يعمل | `'مرحباً Abdallah!'`، `'abdallah@example.com'`، `'ابدأ من EGP 99.90'` ثابتة. والنص `'انطلق في مغامرة مع أقوى مسلسلات الأنمي'` **منسوخ من تطبيق أنمي** — لا علاقة له بمنتج أطفال تعليمي. صورة الأفاتار = بوستر «مغامرات الأرقام» |
| **البحث** | فلترة عنوان+وصف تعمل، حالة فارغة، رقائق مقترحة | عميل فقط على كتالوج محلي؛ لا endpoint بحث في الـ backend؛ يبحث في السلاسل فقط (لا حلقات/كتب/ألعاب)؛ «البحث الصوتي» snackbar؛ لا debounce؛ الاقتراحات `series[index % length]` تتكرر |
| **الفيديوهات القصيرة (Shorts)** | تدفّق رأسي + PageView | صور ثابتة لا فيديو؛ `1.2k` إعجاب و`86` تعليق ثابتة؛ كل الأزرار الجانبية `onTap: () {}`؛ نقاط التقدّم تُرسم واحدة لكل حلقة (سيتشوّه مع 100+ حلقة) |
| **صفحة الكواكب** | 9 كواكب، تبديل، رسم كوكب مخصص جيد | `selectedPlanetId` **لا يُمرَّر من الراوتر أبداً** → `/planets?planetId=X` ميت؛ الحلقات هنا غير قابلة للتشغيل (snackbar) بينما نفس الحلقات في الرئيسية تفتح المشغّل — **سلوك متناقض**؛ الأنشطة snackbar بينما في الرئيسية تفتح `/game/{id}` |
| **الإعدادات** | 6 مفاتيح تعمل بصرياً | لا شيء يُحفظ (`setState` فقط)؛ اللغة والمظهر `onTap: () {}`؛ «تسجيل خروج» `onPressed: () {}`؛ «1.2 GB» ثابت |
| **مسار العمر** | 3 مسارات مع فلترة | أسماء المسارات في `child_provider.dart` صحيحة لكن المنطق تقريبي؛ `experiences` تُفلتر بكوكب واحد لكل مسار + `abjad` (مبسّط جدًا)؛ **خلل: `filteredCatalogProvider` يبني `HomeCatalog` دون تمرير `books:`** → اختيار طفل يُفرِغ رفّ القصص |
| **بروفايل الجهاز/TV** | MethodChannel يعمل، shell منفصل، Focus policy | `_tvOverride` عبر `bool.fromEnvironment('MAJARRA_TV_MODE')` بلا حماية إنتاج؛ لا adapters أصلية؛ لا focus restore؛ TV يعتمد نفس صفحات الجوال |
| **تتبّع نمط الإدخال** | `InputModeTracker` مثبّت في `majarra_app.dart` ويعمل | **`AppInputModeScope.of()` لا يُنادى من أي widget** → البنية كلها write-only بلا أثر |
| **حالات الفراغ** | جيدة في: Home, Downloads, Watchlist, Search, Planets, Shorts | لا حالة فراغ في: Devices, Membership, AccountData, ParentDashboard, ChildSwitcher (كلها بيانات ثابتة فلا يمكن أن تفرغ) |
| **حالات التحميل** | `BrandLoadingView` في Home والتفاصيل | **`SkeletonCard` مكتوب ولا يُستخدم في أي مكان** رغم أن UX plan يحدده؛ لا loading في Downloads/Watchlist/Planets؛ لا حالة أوفلاين مخصصة (فقط لافتة fallback) |
| **إعادة المحاولة** | `ref.invalidate(homeCatalogProvider)` في 3 مواضع | لا retry في: التفاصيل، الكواكب، البحث، أي عملية auth |


---

## 5. المشكلات التقنية

### 5.1 عوائق البناء (Blocking)

**T1 — الكود لا يُترجم.**
`lib\features\home\presentation\shells\adaptive_home_shell.dart:44`
```dart
final isTablet = !isTelevision && context.layoutClass != ...
```
`isTelevision` ليس حقلاً في `AdaptiveHomeShell` ولا في `_AdaptiveHomeShellState`. السطر 40 يمرّر `isTelevision: false` إلى `buildHomeDestinations`، لكن السطر 44 يقرأ متغيراً غير موجود. الإصلاح سطر واحد (`const isTablet = ...` مع `false` أو استخراج الحقل)، لكن وجوده يعني أن **آخر تعديل على هذا الملف لم يُبنَ أبداً**، وهو مؤشر على غياب أي بوابة CI.

### 5.2 المعمارية

**T2 — انهيار الطبقات في 11 من 13 feature.**
`home` وحدها تحتوي `domain/`, `data/`, `application/`, `presentation/`. الباقي (`auth`, `child`, `parent`, `profile`, `playback`, `reader`, `games`, `audio`, `tv`, `search`, `shorts`, `details`, `planets`) عبارة عن `presentation/` فقط، مع بيانات ومنطق مكتوبين داخل ملفات الـ widget. هذا يخالف `PLAN_PHASE_1_DETAILED.md:67-93` نصاً.

**T3 — منطق الأعمال داخل الـ widgets.**
أمثلة قاطعة: فحص PIN داخل `_ParentPinPageState._verify`؛ منطق مطابقة لعبة الذاكرة كاملاً داخل `onTap` في `game_page.dart`؛ استدعاء API مباشر داخل `_LoginPageState._login`؛ قائمة الأطفال داخل `build()`.

**T4 — الصفحات تعتمد على `homeCatalogProvider` العام لجلب كيان واحد.**
`playback_page`, `series_details_page`, `downloads_page`, `watchlist_page`, والـ routes لـ `/reader` و `/game` كلها تُحمّل **الكتالوج بأكمله** ثم `.where(...).firstOrNull`. لا يوجد `episodeProvider(id)` أو `seriesProvider(id)`. مع كتالوج حقيقي (136 حلقة مخطّطة) هذا يجعل كل شاشة تنتظر تحميل كل شيء.

**T5 — تحويل نوع خاطئ في الراوتر.**
`app_router.dart` (route `/reader/:seriesId`) يبني `SeriesItem` مزيّفاً من `BookItem` مع `planetName: 'كوكب القصص'` و `episodesCount: 4` ثابتين، فقط ليُرضي واجهة `StoryReaderPage`. التعليق في الكود يقرّ بذلك: `// حوّل BookItem إلى SeriesItem مؤقتاً للقارئ`. `StoryReaderPage` يجب أن يقبل نوعاً خاصاً بالقارئ.

**T6 — تكرار كود واسع.**
نمط `Container` + `BoxDecoration(color: Color(0xFF111A3A).withValues(alpha: 0.72), borderRadius: circular(14), border: Border.all(Colors.white.withValues(alpha: 0.06)))` مكرّر **أكثر من 30 مرة** حرفياً عبر 12 ملفاً. لا يوجد `MajarraCard` أو `MajarraTile` مشترك. `_TileSwitch`/`_SwitchTile`/`_ProfileSettingTile`/`_SupportTile`/`_TileNav`/`_Field` (نسختان مختلفتان في ملفين) كلها نفس المكوّن بأسماء مختلفة.

**T7 — ألوان hex ثابتة تتجاوز `AppColors`.**
`AppColors` منظم جيداً، لكن `0xFF111A3A`, `0xFF0B1026`, `0xFF1B2550`, `0xFF121A38`, `0xFF101735`, `0xFF2A3447`, `0xFFE5485D`, `0xFF080C22`, `0xFF16204A`, `0xFF2A1B5A` تُستخدم حرفياً بدل الرموز. `brandcolor.md` يحدد لوحة كاملة رسمياً — التطبيق لا يتبعها.

**T8 — ملف ميت في `lib/`.**
`lib\features\home\presentation\widgets\home_destinations.dart.bak` — نسخة قديمة 35 مطابقة، يجب حذفها من الشجرة.

**T9 — كود ميت مؤكَّد من المحلّل.**
`_LibraryDestination` (فئة كاملة، 150 سطر)، `_unpublishedEpisode`، `_comingSoon`، `_openPlayback`، متغير `compact`، و6 imports غير مستخدمة. إضافة إلى ما لا يكتشفه المحلّل: `OfflineService`, `SkeletonCard`, `MajarraAnalytics`, `AppInputModeScope.of`, و8 دوال في `MajarraApiClient`.

### 5.3 الاعتماديات

**T10 — 4 حزم مثبّتة وغير مستخدمة.**
تحقّق بـ grep على كل `lib/`: `video_player`, `chewie`, `hive_flutter`, `shared_preferences` — **صفر imports**. هذه ليست مجرد وزن زائد: `video_player` و `chewie` يضيفان ExoPlayer/AVPlayer وأذونات إلى البناء الأصلي مقابل صفر وظيفة.

**T11 — تثبيت إصدارات غير متسق.**
معظم الحزم مثبّتة بدقة (`go_router: 14.6.2`) وهو جيد، لكن `video_player: ^2.9.2`, `chewie: ^1.8.3`, `hive_flutter: ^1.1.0` تستخدم نطاقات مفتوحة. وحيث إن `hive` مهجورة رسمياً لصالح `isar`/`hive_ce`، والوثائق تقول «Hive **أو Isar**»، فالقرار يحتاج مراجعة قبل الاستخدام.

**T12 — Flutter/Framework قديم.**
`Flutter 3.35.2 • Dart 3.9.0` بتاريخ 2025-08-25 (عمره ~12 شهراً). قبل الإصدار يجب الترقية لتلقّي إصلاحات الأمان.

**T13 — لا `dependency_overrides` ولا فحص تراخيص للخطوط.**
`google_fonts` يجلب `Readex Pro` **وقت التشغيل من الشبكة**. هذا يعني: (أ) أول إقلاع بلا إنترنت يعرض خطاً بديلاً، (ب) طلب شبكة خارجي إلى `fonts.gstatic.com` من تطبيق أطفال، (ج) الوثائق تطالب بفحص ترخيص الخط. الخط يجب أن يُحزَّم كأصل محلي.

### 5.4 الأمان

**T14 — بوابة ولي الأمر مكسورة تماماً (خطير).**
`parent_pin_page.dart:29`
```dart
if (_pin.text == '1234' || _pin.text.length >= 4) { context.go('/parent'); }
```
الشرط الثاني يجعل الأول عديم المعنى. **أي 4 أرقام تفتح منطقة ولي الأمر.** والوثيقة `التصاريح والادوار والمستخدمين .md` تنص على أن البوابة يجب أن تكون PIN أو biometric فقط، وأن التحقق يجب أن يكون على الخادم — والـ backend **لا يحتوي أي مسار PIN ولا عمود PIN** (مؤكَّد بمراجعة كل مصادر الـ Worker). فالنص المطمئن في الشاشة «PIN محفوظ في IdentityDO - لا يرسل للواجهة الأمامية» **غير صحيح**.

**T15 — لا تجديد للتوكن → فقدان جلسة مضمون.**
الـ access token عمره **900 ثانية** (مؤكَّد من مصدر الـ backend). `MajarraApiClient.refresh()` معرّفة ولا تُنادى. لا interceptor لـ 401. النتيجة: المستخدم يفقد الجلسة بعد 15 دقيقة، وكل نداء محمي يفشل بـ 401 يُعرض كنص خام.

**T16 — `installation_id` مزيّف.**
`login_page.dart` يُرسل `'flutter-${_email.text.hashCode}'`؛ الـ API client الافتراضي `'dev-install-$email'`. الـ backend يربط الأجهزة بـ `sha256(installation_id)` ويفرض حدود أجهزة (1/4/8) عليه. معرّف مشتق من البريد يعني أن **كل أجهزة المستخدم تُحسب جهازاً واحداً**، ويجعل حدود الأجهزة والسحب بلا معنى. الوثيقة تطلب «hashed random install ID» وتحرّم IMEI ومعرّف الإعلان.

**T17 — لا حماية للمحتوى على الجهاز.**
لا `FLAG_SECURE`، لا secure surface، لا كشف تسجيل/مرآة، لا watermark. `تشفير المحتوي.md` يحددها كلها.

**T18 — رسائل خطأ خام تصل للمستخدم.**
`MajarraApiException('HTTP ${res.statusCode}: ${res.body}')` ثم `SnackBar(content: Text(e.message))` → جسم استجابة السيرفر كاملاً يُعرض للمستخدم النهائي. تسريب معلومات + تجربة سيئة.

**T19 — رمز تحقق التطوير يُعرض في الواجهة.**
`register_page.dart` يقرأ `development_verification_token` من الاستجابة ويعرضه في snackbar بلا فحص `kReleaseMode`. إن أعاد الخادم هذا الحقل يوماً في الإنتاج، سيُعرض.

**T20 — لا cert pinning ولا فحص `ENVIRONMENT`.**
`ApiEnvironment.staging` و `production` **نفس القيمة** `'https://api.majarra.app'`. و`custom` عبر `String.fromEnvironment('API_BASE_URL')` بلا allowlist → أي بناء يمكن توجيهه لأي مضيف. ولا يوجد أي فصل staging/production فعلي، وهو متطلب صريح.

**T21 — CORS مفتوح في الـ backend.**
خارج نطاق الـ Flutter لكنه يؤثر على أمان العميل: `origin: '*'` على كل المسارات المصادَقة في الـ Worker.

### 5.5 الأداء

**T22 — 20.79 MB أصول، أكثر من 85% منها زائد.**
قياس فعلي:
```
assets total: 20.79 MB
.png   12 ملف   13.68 MB
.jpg    6 ملف    4.88 MB
.webp  28 ملف    2.23 MB
```
- الشعار `majarra-logo.png` (1.66 MB) موجود **مرتين** (`majralogo.png` نسخة متطابقة بالبايت).
- 9 كواكب كـ PNG بحجم 0.85–1.39 MB، وسبعة منها لها نسخة `.webp` بحجم ~90 KB — و`LocalCatalog` يشير إلى **PNG** لا WebP.
- 6 بوسترات كـ JPG (0.69–1.06 MB) لكل منها نسخة WebP (62–167 KB).
تقدير الحجم بعد التنظيف: **< 3 MB**.

**T23 — لا `cacheWidth` / `ResizeImage` في أي مكان.**
`PlanetSymbol` يعرض PNG بحجم 1.39 MB في مربع 58px. Flutter يفكّ الترميز بالأبعاد الكاملة إلى ذاكرة GPU. تسع بطاقات كواكب في rail واحد = مئات الميغابايت من ذاكرة الصور على جهاز منخفض المواصفات.

**T24 — لا كاش قرصي للصور الشبكية.**
`CinematicImage` يستخدم `Image.network` الخام. لا `cached_network_image`. كل تمرير يعيد التحميل من الشبكة (كاش الذاكرة فقط).

**T25 — `Timer.periodic` مسرَّب.**
`playback_page.dart:35` — تُنشأ في `initState` وتُسند إلى متغير محلي غير محفوظ؛ `dispose` يُلغي `_hideTimer` فقط. المؤقّت يستمر بعد إزالة الصفحة، وكل نبضة تستدعي `setState` على شجرة كاملة.

**T26 — إعادة بناء مفرطة.**
`playback_page` يعيد بناء الشاشة كاملة (بما فيها `CinematicImage`) كل ثانية. `search_page` يعيد بناء كل الـ slivers على كل حرف بلا debounce. لا `const` constructors ولا `ValueListenableBuilder` لعزل التحديثات.

**T27 — Anti-patterns في التخطيط.**
`_ProfileDestination` يضع `Row` بـ `Expanded` داخل `Stack` بلا `Positioned` محدد؛ `_ComingSoonRail`/`_MostWatchedRail` تُنشئ `List` جديدة في كل `build`؛ ارتفاعات ثابتة (`height: 88`, `56`, `140`) ستنكسر مع `TextScaler 2.0` المطلوب.

**T28 — لا أهداف أداء رقمية للقياس عليها.**
**فجوة في الوثائق نفسها**: لا يوجد في أي ملف تخطيط رقم لزمن الإقلاع، معدل الإطارات، نسبة التخزين المؤقت، نسبة الجلسات بلا انهيار، أو حجم الحزمة. لا يمكن الحكم على «الأداء مقبول» بدون هذه الأرقام — يجب تحديدها.

### 5.6 القابلية للصيانة

**T29 — لا اختبارات على الإطلاق.**
لا `test/` ولا `integration_test/`. `PLAN_PHASE_1_DETAILED.md` يسرد ~18 فئة اختبار إلزامية (حدود العمر 3/5/6/8/9/12 ورفض 2/13، RLS عبر الحسابات، انتقالات العمر، golden/accessibility لكل Track Theme، مزامنة أوفلاين، سباق آخر مقعد، السحب، إسقاط heartbeat، التخفيض/السماح، مصفوفة phone/tablet/TV، انتهاء QR وإعادة استخدامه، اختبار نصّي يمنع ادعاء «حماية 100%»، بوابة QA الإسلامية بحذف كل حقل شرطي على حدة).

**T30 — لا CI ولا lint صارم.**
`analysis_options.yaml` سطر واحد: `include: package:flutter_lints/flutter.yaml`. لا `errors:` مخصصة، لا `custom_lint`, لا `riverpod_lint`. ولو وُجدت بوابة CI بسيطة لما وصل خطأ الترجمة إلى المستودع.

**T31 — تعليقات تشير إلى أسطر في وثائق.**
`analytics.dart:3` → `MAJARRA_CINEMATIC_STREAMING_UX_PLAN.md:594`؛ `feed_blocks.dart:3` → `:205`؛ `skeleton.dart:3` → `:567`. مراجع بأرقام أسطر تتعطّل مع أول تعديل للوثيقة. يجب الإشارة إلى عناوين أقسام.

**T32 — تعارض بين تعليقات الكود والواقع.**
`offline_service.dart:3` يقول «Family DO يصدر ترخيص قصير، R2 يخدم الملفات» — لا يوجد أي مسار ترخيص في الـ backend. `playback_page` يعرض «تقدم محفوظ في Family DO • token موقع 2د» — لا يُحفظ أي تقدّم. `child_switcher_page` يقول «يتم حفظه في Family DO» — لا يُحفظ. هذه تعليقات ونصوص واجهة تصف نظاماً غير موجود، وهي أخطر من الكود الناقص لأنها تُضلّل المراجع.

---

## 6. فجوات الواجهة وتجربة المستخدم

### 6.1 شاشات مطلوبة وغير موجودة
Onboarding (9 خطوات) · Consent · Create/Edit Child · Limit Reached · Revoke Device · Weekly Report · Plan Comparison · Export/Delete Child Data · Age-Transition Review · Capture-Blocked · صفحة عالم الإيمان (6 أرفف) · صفحة Project · صفحة Episode مستقلة · Forgot Password · Verify Email · شاشة أوفلاين مخصصة.

### 6.2 شاشات موجودة وغير مربوطة
| الشاشة | الحالة |
|---|---|
| `_LibraryDestination` | فئة كاملة (3 تبويبات، حالات فراغ، rails) — `unused_element`. لم تُدرج في `buildHomeDestinations` |
| `TvPairingPage` | مربوطة من `TvHomeShell` فقط → **لا يمكن الوصول إليها من الجوال**، وهي بطبيعتها ميزة تبدأ من الجوال |
| `PrivacyPage` | مربوطة مرتين: «سياسة الخصوصية» و«الشروط والأحكام» يفتحان نفس الصفحة |
| `/planets?planetId=X` | `PlanetsPage.selectedPlanetId` موجود ويعمل، لكن الراوتر لا يمرّره → كل نداءات `_openPlanet` تفتح الكوكب الأول |
| `/audio` | يستقبل `title`/`subtitle` كـ query params فقط — لا `id`، فلا يمكن تشغيل صوت حقيقي أبداً بهذا العقد |

### 6.3 تدفّقات مكسورة أو غير مكتملة
1. **الإقلاع يتخطى المصادقة.** `initialLocation: '/'` → الرئيسية مباشرة. لا فحص توكن، لا اختيار طفل. `/login` لا يُصل إليه إلا يدوياً.
2. **بعد `login` → `/children` → `context.go('/')`** وينتهي الأمر. لا يُقرأ `family/state`، لا يُحمَّل ترخيص، لا تُعاد تهيئة الـ providers.
3. **اختيار الطفل يُفقد عند إعادة التشغيل** (`ChildNotifier` ذاكرة فقط).
4. **اختيار الطفل يُفرِغ رفّ القصص** — `filteredCatalogProvider` لا يمرّر `books:`.
5. **`register` → snackbar → `/login`** بلا شاشة تحقق بريد، مع أن الـ backend **يمنع الدخول قبل التحقق** ويعيد 401 عاماً → المستخدم سيرى «كلمة مرور خاطئة» وهو محتار.
6. **لا logout فعلي** — زر في الإعدادات `onPressed: () {}`. `AuthStorage.clear()` معرّفة ولا تُنادى.
7. **التنزيل مسار مسدود** — 3 نقاط دخول (`_EpisodeTile.onDownload`, `DownloadsPage`, `OfflineService.showDownloadSheet`) لا شيء منها ينزّل، والأخيرة غير مربوطة أصلاً.
8. **الاشتراك مسار مسدود** — «إدارة الاشتراك» و«عرض كل الباقات» و«جرّب مجانًا» (في header الرئيسية يفتح صفحة سلسلة!) لا شيء منها يؤدي إلى دفع.
9. **سلوك متناقض لنفس المحتوى** — حلقة في الرئيسية تفتح المشغّل؛ نفس الحلقة في صفحة الكواكب تُظهر snackbar؛ وفي «مكتبتي» `onPressed: () {}`. لعبة في الرئيسية تفتح `/game/{id}`؛ في الكواكب snackbar.
10. **زر الرجوع بأيقونة `arrow_forward_rounded`** في 12 صفحة. صحيح في RTL بصرياً لكن دلالياً خاطئ لقارئ الشاشة، والأصح `Icons.arrow_back` مع `Directionality` أو `automaticallyImplyLeading`.

### 6.4 عدم اتساق المكوّنات
- 7 تطبيقات مختلفة لنفس «بطاقة/بلاطة» (§T6).
- `_Field` معرّف مرتين بمعنيين مختلفين (`register_page.dart` = حقل إدخال؛ `account_data_page.dart` = صف عرض للقراءة).
- `ParentDashboardPage` **بثيم فاتح** (`Color(0xFFF5F7FC)`) داخل تطبيق داكن بالكامل، بألوان hex خاصة لا علاقة لها بـ `AppColors`. انتقال بصري صادم.
- ثلاثة أنماط bottom sheet مختلفة (جودة التشغيل، اختيار وضع القراءة، ورقة التنزيل) بحقن مختلف للحافة العلوية.

### 6.5 الاستجابة (Responsiveness)
- `AppBreakpoints` معرّف جيداً (599/1023/479) ويُستخدم للحشو.
- لكن `AdaptiveHomeShell` يُحسب `isTablet` بشروط مكرّرة تتجاوز `layoutClass` (`width >= 600 && height > 480`) — منطقان متوازيان لنفس القرار.
- `series_details_page` يحسب `compact` **ولا يستخدمه** (`unused_local_variable`) → صفحة التفاصيل لا تتكيّف فعلياً.
- التلفزيون يستخدم نفس صفحات الجوال بمقاسات مكبّرة، وليس shell بمنطق 10-foot كما تطلب `TECH_STACK.md`.
- لا تخطيط landscape خاص للمشغّل، ولا قفل اتجاه.

### 6.6 الوصولية
| المتطلب (من الوثائق) | الحالة |
|---|---|
| أهداف لمس 48dp / TV 64dp | **يفشل**: أزرار 36×36 و 28×28، `visualDensity: VisualDensity.compact`, `minimumSize: Size(0, 40)` |
| تباين 4.5:1 للنص | **يفشل**: نصوص بحجم 9–11px بـ `alpha: 0.42`–`0.62` على خلفيات داكنة |
| `TextScaler` حتى 2.0 | **يفشل**: ارتفاعات ثابتة (`height: 88/56/140/282/354`) ستقتطع النص |
| لا اعتماد على اللون وحده | **يفشل جزئياً**: حالة «مجاني/جديد/نشط» تُنقل بلون + نص (جيد)، لكن اختيار الكوكب يُنقل بالحدود واللون فقط |
| بدائل نصية لنتائج الألعاب | **غائب** |
| بديل tap-then-tap للسحب | **غائب** |
| سلّم مساعدة 2/3/4 بلا تأطير فاشل | **غائب** — «تلميح» واحد فقط |
| صالح صوتياً بالكامل لـ 3–5 سنوات | **غائب** — لا صوت في التطبيق إطلاقاً |
| احترام reduce-motion | **ينجح** — مُطبَّق باستمرار عبر `MediaQuery.disableAnimationsOf` |
| Semantics للصور | **ينجح** — `CinematicImage`, `PlanetSymbol`, `FocusableScale` |
| ترتيب focus حتمي على TV | **جزئي** — `ReadingOrderTraversalPolicy` + `NumericFocusOrder` في rail واحد فقط؛ لا focus restore |
| قارئ شاشة (TalkBack/VoiceOver) | لم يُختبر؛ ولا يوجد متطلب صريح في الوثائق — **فجوة توثيق** |

### 6.7 نص واجهة يجب إزالته قبل أي عرض
- `'HERO WATARU'` و `'مغامرات البطل'` — صفحة تفاصيل كل سلسلة.
- `'انطلق في مغامرة مع أقوى مسلسلات الأنمي'` — الملف الشخصي. نص منتج أنمي في تطبيق أطفال تعليمي.
- `'مرحباً Abdallah!'`, `'abdallah@example.com'`, `'Abdallah'` — بيانات مطوّر.
- `'EGP 99.90'`, `'ينتهي 12 يونيو 2026'`, `'+20 100 123 4567'`, `'739 482'`, `'1.2 GB'`, `'3 من 4 أجهزة'`.
- `'أكشن'`, `'خيال علمي'`, `'حلقة أسبوعياً'`, `'7+'` — تصنيفات لا تنطبق.
- تواريخ «قريباً» الوهمية `'15 أغسطس'…`.
- نصوص تصف بنية غير موجودة: «تقدم محفوظ في Family DO»، «PIN محفوظ في IdentityDO»، «الترخيص صالح حتى …».

---

## 7. فجوات التكامل مع الخدمة الخلفية

### 7.1 مسارات يناديها التطبيق ولا وجود لها (404 مؤكَّد)

| نداء العميل | الواقع في الـ Worker | الأثر |
|---|---|---|
| `GET /api/v1/books?limit=100` | لا يوجد مسار عام للكتب. `/books` موجود فقط داخل `adminContent.ts` أي `/api/v1/admin/books` (يتطلب `ADMIN_API_KEY`) | `fetchBooks()` تبتلع الخطأ بـ `catch (_) { return []; }` → **فشل صامت دائم**، والكتب تأتي دائماً من `LocalCatalog` |
| `POST /api/v1/episodes/{id}/playback-session` | الـ backend: `POST /:id/playback-sessions` (**جمع**) | 404. غير مستخدم حالياً فلا يظهر الخطأ — لكنه سيظهر لحظة ربط التشغيل |
| `GET /api/v1/billing/status` | الـ backend: `/api/v1/billing/google-play/context` و `/verify` | 404 |

### 7.2 مسارات موجودة في الـ backend ولا يستخدمها التطبيق

| المسار | ما يوفّره | مستخدم؟ |
|---|---|---|
| `POST /api/v1/auth/refresh` | تجديد التوكن (وهو **إلزامي** لأن العمر 900s) | لا (الدالة موجودة، لا نداء) |
| `GET /api/v1/auth/me` | بيانات ولي الأمر والخطة والجهاز | لا |
| `POST /api/v1/auth/logout` | إنهاء الجلسة | لا (الدالة غير معرّفة أصلاً) |
| `POST /api/v1/auth/verify-email` | تحقق البريد (يمنع الدخول قبله) | لا |
| `POST /api/v1/auth/resend-verification` | إعادة إرسال | لا (غير معرّفة) |
| `GET /api/v1/family/state` | العائلة والأطفال والأجهزة والتراخيص | لا |
| `GET/POST /api/v1/family/children` | قراءة وإنشاء ملفات الأطفال | لا (يُستخدم مصفوفة ثابتة بدلاً منها) |
| `POST/GET /api/v1/family/progress` | مزامنة التقدّم | لا |
| `POST /api/v1/family/favorites` | المفضلة | لا (المفضلة حالة ذاكرة) |
| `GET /api/v1/family/devices` + `/devices/revoke` | إدارة الأجهزة | لا (3 أجهزة ثابتة) |
| `POST /api/v1/episodes/:id/playback-sessions` + `/heartbeat` + `/end` | جلسة تشغيل بـ lease 15د | لا |
| `POST /api/v1/episodes/:id/progress` | تقدّم الحلقة | لا |
| `GET /api/v1/media/assets/:assetId` | بايتات الوسائط بـ capability token (TTL 180s)، يدعم Range | لا |
| `GET /api/v1/billing/google-play/context` + `/verify` | الشراء والتحقق | لا |
| `GET /api/v1/planets/:id`, `/series/:id`, `/episodes/:id` | جلب كيان واحد | لا (يُحمَّل الكتالوج كاملاً بدلاً منها — §T4) |

**النتيجة العددية:** من أصل ~30 مساراً موجّهاً للعميل، التطبيق يستخدم **5**.

### 7.3 بيانات ثابتة يجب أن تأتي من الـ API

| الموضع | البيانات الثابتة | المصدر الصحيح |
|---|---|---|
| `child_switcher_page.dart:14-18` | 3 أطفال (ليلى/عمر/سارة + معرّفات + مسارات) | `GET /family/children` |
| `parent_dashboard_page.dart` | تقارير 3 أطفال، أوقات المشاهدة، الحدود، السماحات | `GET /family/state` + تقارير |
| `devices_page.dart:13-17` | 3 أجهزة + «3 من 4» | `GET /family/devices` |
| `membership_page.dart` | «باقة العائلة»، EGP 99.90، تاريخ الانتهاء، الميزات | `GET /billing/google-play/context` |
| `account_data_page.dart` | الاسم، البريد، الهاتف، الأفاتار | `GET /auth/me` |
| `home_destinations.dart` (`_ProfileDestination`) | «Abdallah»، السعر، النص التسويقي | `GET /auth/me` |
| `series_details_page.dart` | التصنيفات، `7+`، الإعجابات 311، التعليقات 12، «حلقة أسبوعياً» | `GET /series/:id` |
| `home_feed.dart` | كل الكتل: mostWatched, newReleases, comingSoon (+تواريخ), becauseYouWatched, continueJourney (+تقدّم), audioRail, characterOrbit, seasonalBanner, learningJourney | endpoints ترتيب/توصيات/تقدّم — **معظمها غير موجود في الـ backend** |
| `story_reader_page.dart:38-58` | 4 صفحات قصة بالعربية والإنجليزية + إيموجي | `stories`/`story-pages` — **لا endpoint عام** |
| `game_page.dart` | `List.generate(8, (i) => i % 4)` | `content_pack` — **لا endpoint عام** |
| `tv_pairing_page.dart:12` | `const code = '739 482'` | endpoint اقتران — **غير موجود** |
| `feed_blocks.dart` | العقد بأكمله | `home-experience` (موجود admin فقط) |
| `local_catalog.dart` | 9 كواكب، 5 سلاسل، 7 حلقات، 5 ألعاب، 16 كتاباً | نقاط الكتالوج العامة |

### 7.4 مشكلات المزامنة والعقود

**B1 — التطبيق يعمل على `LocalCatalog` دائماً، اليوم.**
كل السلاسل والحلقات المزروعة في migrations بحالة `status='draft'` / `is_published=0`، ولا `content_assets` مزروعة. إذن `/planets` `/series` `/episodes` تُرجع مصفوفات فارغة → `hasRemoteSeries=false` → `ContentSource.local`. اللافتة «نعرض المكتبة المحلية الآمنة» تظهر دائماً. **لم يُختبر مسار البيانات الحقيقي ولا مرة.**

**B2 — عدم تطابق معرّفات الكواكب بين ثلاثة مصادر.**

| المصدر | المعرّفات |
|---|---|
| `LocalCatalog.planets` | abjad, arqam, oloom, qiyam, qisas, **ibdaa**, maharat, tarikh, **iman** |
| `PlanetDto._displayNames` | abjad, arqam, oloom, qiyam, qisas, maharat, tarikh, **alam**, **islamic** |
| migrations الـ backend | abjad, arqam, oloom, qiyam, qisas, maharat, tarikh, **alam**, **islamic** |

`ibdaa` و `iman` موجودان محلياً فقط؛ `alam` مفقود محلياً (رغم وجود `planet-alamna.png` في الأصول وعدم إدراجه في `LocalCatalog`). وبما أن `content_repository` يطابق بالمعرّف مع `orElse` يعود إلى **الفهرس** (`LocalCatalog.planets[entry.key % length]`)، فإن كوكباً بعيداً بمعرّف مجهول سيحصل على **صورة كوكب خاطئ تماماً**.
ملاحظة مهمة: بوابة النشر الإسلامية في الـ backend تفحص `planet_id === 'iman'` لكن المعرّف المزروع `'islamic'` → **البوابة لا تُفعَّل أبداً**. عيب في الطرفين.

**B3 — `lead_id` غير مُرجَع لكن مطلوب.**
استجابة `playback-sessions` لا تُرجع `lease_id`، بينما `heartbeat` و `end` يطلبان `:leaseId` في المسار. الحل الوحيد حالياً هو أن يفكّ العميل ترميز الـ capability token ويستخرج `lid` — عقد سيئ يجب إصلاحه في الـ backend قبل تنفيذ العميل.

**B4 — أربع اصطلاحات زمنية مختلفة في نفس الـ API.**
epoch ms (من الـ DO) · ISO 8601 (auth/playback/billing) · `'YYYY-MM-DD HH:MM:SS'` نصاً (D1) · لواحق `*_ms`. لا يوجد أي parsing للتواريخ في التطبيق الآن — سيصبح مصدر أخطاء فوري عند البدء.

**B5 — `is_free` بنوعين.**
`0|1` في المسارات العامة و `true|false` في مسارات الإدارة. `_boolean()` في `content_dtos.dart` يتعامل مع الحالتين (جيد) — لكن هذا التسامح يخفي عيباً في الـ API.

**B6 — ثلاث مفردات مختلفة للتقدّم.**
القانونية: `child_id/content_id/position_ms/duration_ms/sequence/completed/event_id`. و `/family/progress` يقبل أسماء بديلة (`episode_id`, `positionMs`, `progress_seconds`). و `/episodes/:id/progress` يقبل مفردات ثالثة (`progress_seconds`, `duration_seconds`, `is_completed`). العميل سيحتاج قراراً صريحاً: **استخدم `/family/progress` بالأسماء القانونية فقط**.

**B7 — `?childId=` camelCase وسط API كله snake_case.**

**B8 — لا endpoints للأوفلاين إطلاقاً.**
تحقُّق مؤكَّد: صفر مسارات تنزيل/ترخيص، وصفر ذكر لـ `media_licenses` / `child_downloads` في كل الـ 17 migration. إذن ميزة التنزيل **غير قابلة للتنفيذ على العميل اليوم** حتى لو أُريد.

**B9 — لا endpoints عامة لـ: books, stories, games, projects, categories, search, recommendations, continue-watching.**
هذا يعني أن قصص القارئ والألعاب والكتب ورفوف «الأكثر مشاهدة/لأنك شاهدت» **لا يمكن تغذيتها من الخادم بصورته الحالية**. الفجوة في الـ backend لا العميل.

**B10 — `/family/state` يعيد 404 قبل أول تسجيل دخول** (الـ DO لا يُهيّأ إلا عندها). العميل يجب أن يتعامل مع 404 كحالة «لا عائلة بعد» لا كخطأ.

**B11 — لا فصل بيئات.**
`ApiEnvironment.staging == production == 'https://api.majarra.app'`، و`legacy` يشير إلى `majarra-api-prod.aboessa101.workers.dev`. `wrangler.jsonc` يعرّف بيئة `production` واحدة فقط ويحذّر نصاً أن البيئة العلوية «for local development only and must never point at production queues or buckets» — لا توجد بيئة staging مُعرّفة على الجانبين.


---

## 8. قائمة فحص جاهزية الإنتاج

| البند | الحالة | الدليل / السبب |
|---|:---:|---|
| **أمان المصادقة** | ❌ | بوابة PIN تمرّ بأي 4 أرقام؛ لا تجديد توكن (عمره 900s)؛ `installation_id` مشتق من البريد؛ لا logout؛ لا session restore |
| **معالجة أخطاء الـ API** | ❌ | `catch (_)` يبتلع الأخطاء؛ جسم الاستجابة الخام يُعرض للمستخدم؛ لا تصنيف أخطاء؛ لا retry/backoff؛ لا 401 interceptor |
| **الدعم دون اتصال** | ❌ | لا تخزين محلي (`hive`/`shared_preferences` غير مستخدمين)؛ لا كاش كتالوج؛ لا طوابير؛ لا كشف اتصال؛ ولا endpoints أوفلاين في الـ backend أصلاً |
| **التحقق من صحة البيانات** | ❌ | لا `Form`/`TextFormField`/`validator` في أي مكان؛ فحص البريد = `isEmpty` فقط (لا نمط)؛ كلمة المرور = `length < 12` فقط؛ لا `TextInputFormatter` على حقل PIN؛ لا حدود طول |
| **معالجة الانهيارات** | ❌ | لا `FlutterError.onError`، لا `PlatformDispatcher.instance.onError`، لا `runZonedGuarded`، لا Crashlytics/Sentry، لا `ErrorWidget.builder` |
| **التسجيل (Logging)** | ❌ | `print` داخل `kDebugMode` فقط في `analytics.dart`. لا مُسجّل منظّم، لا مستويات، لا correlation id |
| **التحليلات** | ❌ | `MajarraAnalytics` مكتوبة (allowlist + PII filter، تصميم صحيح) لكن **صفر مواضع نداء** و`// TODO: Queue -> Analytics Engine` |
| **الإشعارات الفورية** | ❌ | لا حزمة، لا إذن `POST_NOTIFICATIONS`، لا `google-services.json`. **والوثائق نفسها لا تحدد طبقة إشعارات** — يجب حسم القرار |
| **Deep linking** | ❌ | لا `<data>` / `VIEW` / `BROWSABLE` في المانيفست؛ لا `CFBundleURLTypes` ولا Associated Domains في iOS؛ لا scheme في الوثائق |
| **الترجمة (i18n)** | ❌ | لا `.arb`، لا `l10n.yaml`، لا `generate: true`. `supportedLocales` تعلن `en` بلا ترجمات. RTL نفسه مُطبَّق جيداً عبر `*Directional` |
| **الأذونات** | ⚠️ | `INTERNET` فقط + `leanback`/`touchscreen` بـ `required=false` (صحيح للـ TV). ناقص كل ما تحتاجه الميزات المخططة (إشعارات، تخزين، biometric) |
| **التخزين الآمن** | ⚠️ | `flutter_secure_storage` مستخدم للتوكنات (صحيح). لكن لا `AndroidOptions(encryptedSharedPreferences: true)`، ولا معالجة لفشل Keystore، ولا PIN مخزّن أصلاً |
| **الاختبارات** | ❌ | صفر. لا `test/` ولا `integration_test/` |
| **إعداد البناء** | ❌ | لا flavors؛ لا `--dart-define` منظّم (`API_BASE_URL` فقط بلا allowlist)؛ لا ProGuard/R8 rules؛ لا `--split-debug-info`؛ لا `--obfuscate`؛ لا `minSdk`/`targetSdk` صريحة |
| **إدارة البيئات** | ❌ | `staging` و `production` **نفس URL**. لا فصل على جانب الـ Worker أيضاً |
| **توقيع التطبيق** | ❌ | لا `signingConfigs` ولا `key.properties` ولا keystore. تعليق `build.gradle.kts` يقرّ: «Release signing is intentionally not configured» |
| **جاهزية المتجر** | ❌ | `web/index.html` ما زال قالب Flutter الافتراضي (`"A new Flutter project."`, `<title>majarra</title>`)؛ `version: 0.1.0+1`؛ لا لقطات شاشة، لا سياسة خصوصية منشورة، لا إفصاح Data Safety، لا تصنيف عمري، لا استبيان Families Policy (**إلزامي** لتطبيق أطفال على Google Play) |

**النتيجة: 0 من 17 بنداً مكتمل. 2 جزئيان. 15 غير مبدوءين أو مكسورون.**

---

## 9. خطة عمل مصنّفة بالأولوية

الرمز: **C** حرِج · **H** مرتفع · **M** متوسط · **L** منخفض. التعقيد: **S** ≤يوم · **M** 2–5 أيام · **L** 1–3 أسابيع · **XL** >3 أسابيع.

### 🔴 C — حرِج (يمنع أي شيء آخر)

**C1 · إصلاح خطأ الترجمة**
الوصف: `isTelevision` غير معرّف. الملف: `adaptive_home_shell.dart:44`.
المتوقع: البناء ينجح. الحالي: `flutter build` يفشل.
الحل: تعريف الحقل بشكل صريح (تمرير `isTelevision` من `HomePage` كما يفعل `TvHomeShell`) لا مجرد استبداله بـ `false`.
اعتماديات: لا. التعقيد: **S**. الأولوية: **C**.

**C2 · إغلاق بوابة ولي الأمر**
الملف: `parent_pin_page.dart:29`. المتوقع: PIN يُتحقق منه على الخادم؛ الوصول يُمنح فقط بـ PIN صحيح أو biometric. الحالي: `|| _pin.text.length >= 4` يمرّر أي إدخال.
الحل: (أ) إضافة مسار `POST /api/v1/family/parent-pin/verify` + عمود hashed PIN في `IdentityState` DO — **غير موجود حالياً**، (ب) ربط `local_auth`، (ج) إزالة الفحص المحلي بالكامل، (د) اختبار يمنع الرجوع.
اعتماديات: عمل backend. التعقيد: **M**. الأولوية: **C**.

**C3 · بوابة CI**
المتوقع: `flutter analyze --fatal-infos --fatal-warnings` + `flutter test` + `flutter build appbundle` على كل PR. الحالي: لا شيء — لذلك وصل خطأ ترجمة إلى `main`.
الحل: GitHub Actions workflow؛ تشديد `analysis_options.yaml` بـ `errors:` و `riverpod_lint`.
اعتماديات: C1. التعقيد: **S**. الأولوية: **C**.

**C4 · تجديد التوكن + معالجة 401**
الوحدات: `majarra_api_client.dart`, `auth_storage.dart`, provider جديد `authControllerProvider`.
المتوقع: تجديد استباقي/تفاعلي، إعادة محاولة واحدة، دفع إلى `/login` عند فشل التجديد. الحالي: الجلسة تموت بعد 15 دقيقة صامتة.
ملاحظة حرجة: الـ backend **يُبطل الجلسة عند إعادة استخدام refresh token مُدوَّر** → يجب قفل تسلسلي (mutex) لتجنّب تجديدين متزامنين.
اعتماديات: C1. التعقيد: **M**. الأولوية: **C**.

**C5 · حراس المسارات + إقلاع المصادقة**
المتوقع: 3 حراس كما في `PLAN_PHASE_1_DETAILED.md` (Parent Session / Child Session / Parental Area). الحالي: `initialLocation: '/'` يتخطى كل شيء.
الحل: `GoRouter.redirect` + `refreshListenable` مربوطة بحالة المصادقة والطفل النشط.
اعتماديات: C4. التعقيد: **M**. الأولوية: **C**.

**C6 · حذف بقايا منتج آخر من الواجهة**
`'HERO WATARU'`, `'مغامرات البطل'`, `'انطلق في مغامرة مع أقوى مسلسلات الأنمي'`, `'Abdallah'`, `'abdallah@example.com'`, `'EGP 99.90'`, `'+20 100 123 4567'`, `'739 482'`, التصنيفات الوهمية، تواريخ «قريباً»، والنصوص التي تصف بنية غير موجودة («تقدم محفوظ في Family DO»…).
لماذا حرِج: مخاطرة براءة اختراع/علامة تجارية + إضلال المراجعين والمستخدمين. التعقيد: **S**. الأولوية: **C**.

**C7 · نشر محتوى واحد كامل من الخادم (End-to-End)**
الوصف: سلسلة واحدة + حلقة واحدة بحالة `published` + أصل فيديو خاص مرفوع ومربوط بـ `role='stream'`.
لماذا حرِج: بدونه لا يمكن اختبار أي شيء حقيقي.
اعتماديات: عمل backend/محتوى. التعقيد: **M**. الأولوية: **C**.

> **تحديث 2026-08-08 — محجوب بالمحتوى، لا بالكود. لا يُحل بـ SQL.**
>
> تم التحقق بقراءة قاعدة D1 المحلية مباشرةً (19 migration مُطبَّقة):
>
> 1. **صفر أصول فيديو مزروعة في أي migration.** لا يوجد `INSERT INTO content_assets`
>    في أي ملف. الأصول الـ227 الموجودة محلياً رُفعت عبر لوحة الإدارة (CMS) إلى R2،
>    وليست جزءاً من الـ migrations. أي أن نسخة جديدة من القاعدة تبدأ بلا أي فيديو.
>
> 2. **`published` وحدها لا تكفي للتشغيل.** `routes/episodes.ts:58-74` يشترط صف
>    `asset_links` بـ `role IN ('stream','video')` + صف `content_assets` بحالة
>    `ready` و `visibility='private'` و `kind='video'`. بدونه يُرجع
>    `playback-sessions` رمز **404** ورسالة `Protected episode media is unavailable`.
>    لذلك نشر حلقة بلا أصل يُنتج محتوى **يظهر في الكتالوج ويفشل عند اللمس** — وهو
>    أسوأ من غيابه.
>
> 3. **الحلقات القابلة للتشغيل موجودة فعلاً، لكنها `test_fixture`.** 14 حلقة منشورة
>    ولها `role='stream'` سليم، وكلها تابعة لسلسلة واحدة (`مازن وثعلوب`) بحالة
>    `content_class='test_fixture'`. و `lib/contentClass.ts` يفرض
>    `content_class='production'` على كل المسارات العامة، و`shouldServeTestFixtures`
>    يرفض التفعيل نصاً عندما `ENVIRONMENT='production'`. هذا سلوك **صحيح ومقصود**:
>    مادة الاختبار لا يجوز أن تُشحن للجمهور.
>
> **تصحيح لما ورد سابقاً في هذا التقرير:** العبارة «التطبيق يعمل على `LocalCatalog`
> دائماً» غير دقيقة. مقابل بيئة التطوير المحلية تُرجع النقاط العامة الـ14 حلقة
> الاختبارية؛ الفراغ في الإنتاج سببه فلترة `test_fixture` لا نقص أعلام النشر.
>
> **الخلاصة:** كُتبت migration باسم `0020_publish_demo_content.sql` تضبط
> `status='published'` على سلسلتين وأربع حلقات، ثم **حُذفت** بعد التحقق: الحلقات
> الأربع لا تملك أصل `stream`، فكانت ستنشر محتوى غير قابل للتشغيل، وكانت ستُطبَّق
> تلقائياً على الإنتاج مع أول `migrate:remote`.
>
> ما يلزم فعلاً لإغلاق C7 (عمل محتوى/بنية تحتية، خارج نطاق الكود):
>   1. رفع فيديو واحد لسلسلة **إنتاجية** عبر خط الأصول إلى R2.
>   2. ربطه بـ `asset_links` بـ `role='stream'` و `content_assets.status='ready'`.
>   3. ضبط السلسلة والحلقة على `published` مع `content_class='production'`.

**C8 · توحيد معرّفات الكواكب**
المصادر الثلاثة متعارضة (`ibdaa`/`iman` مقابل `alam`/`islamic`). الحل: اعتماد migrations كمصدر حقيقة، تحديث `LocalCatalog` و `_displayNames`، إضافة كوكب `alam`، وإصلاح بوابة النشر الإسلامية في الـ backend (`'iman'` → `'islamic'`). واستبدال `orElse` القائم على الفهرس بأصل افتراضي محايد.
التعقيد: **S**. الأولوية: **C**.

### 🟠 H — مرتفع (يمنع MVP)

**H1 · مشغّل فيديو حقيقي** — استخدام `video_player`+`chewie` المثبّتين، ربط `POST /episodes/:id/playback-sessions`، إعادة إرسال ترويسة `authorization` حرفياً إلى `stream_url`، heartbeat كل ≤5د، `end` عند الخروج، دعم Range. عائق backend: `lease_id` غير مُرجَع (§B3). حذف `Timer` الوهمي. اعتماديات: C1, C4, C7. **XL**.

**H2 · مزامنة التقدّم** — نداء `POST /family/progress` بالحقول القانونية و `event_id` مستقر، كل 30–60s + عند الإيقاف/الخروج، طابور محلي بمفتاح `child_id`+`event_id`. اعتماديات: H1، تخزين محلي (H6). **L**.

**H3 · ملفات الأطفال الحقيقية** — استبدال المصفوفة الثابتة بـ `GET/POST /family/children`، حفظ الطفل النشط، إعادة تهيئة الـ providers عند التبديل، إصلاح خلل `books:` المفقود في `filteredCatalogProvider`، إضافة شاشتَي إنشاء/تعديل. **L**.

**H4 · بنية i18n** — `l10n.yaml` + `app_ar.arb` + `generate: true`، ترحيل **كل** النصوص الحرفية، إزالة `en` من `supportedLocales` حتى تُترجم، إزالة `fr` من قائمة القارئ. اعتماديات: C6 (لتجنّب ترحيل نصوص ستُحذف). **L**.

**H5 · معالجة أخطاء وحالات**
تعريف `AppFailure` (network/timeout/unauthorized/forbidden/notFound/server/unknown)، تعيين رسائل عربية آمنة، إزالة كل `catch (_)`، منع عرض جسم الاستجابة، إضافة retry بـ exponential backoff، ربط `SkeletonCard` (المكتوب وغير المستخدم) كحالة تحميل، وإضافة حالة أوفلاين مخصصة. **M**.

**H6 · تخزين محلي وكاش** — حسم `hive_ce` أم `isar` (Hive مهجورة)، كاش للكتالوج مُقسَّم بـ `child_id`، حفظ الإعدادات، طابور أحداث. **L**.

**H7 · التحقق من صحة الإدخال** — `Form` + `validator` لكل الحقول، نمط بريد، سياسة كلمة مرور مطابقة للخادم (≥12)، `FilteringTextInputFormatter.digitsOnly` + `maxLength` على PIN، أخطاء مضمّنة لا snackbars. **S**.

**H8 · التقاط الانهيارات** — `runZonedGuarded` + `FlutterError.onError` + `PlatformDispatcher.instance.onError` + `ErrorWidget.builder`، وربط مزوّد (Sentry أو Crashlytics) مع تنقية PII كما تطلب الوثائق. **M**.

**H9 · تفعيل التحليلات** — نداء `MajarraAnalytics` من مواضعها الفعلية، إضافة sink (طابور محلي → Analytics Engine)، وتوسيع الـ allowlist لتغطي أحداث التشغيل والألعاب. **فجوة توثيق**: لا كتالوج أحداث رسمي — يجب إنشاؤه. **M**.

**H10 · توقيع الإصدار وإدارة البيئات** — keystore + `key.properties` خارج المستودع، `signingConfigs`، flavors dev/staging/prod، فصل `staging` عن `production` في `ApiEnvironment` وفي `wrangler.jsonc`، allowlist للـ `API_BASE_URL`. **M**.

**H11 · تنظيف الأصول** — حذف نسخة الشعار المكرّرة (1.66 MB)، حذف PNG/JPG التي لها بديل WebP، توجيه `LocalCatalog` إلى WebP، توليد WebP للكواكب الناقصة (`alamna`, `iman`, `maharat`, `tarikh`)، حزم خط `Readex Pro` محلياً بدل جلبه من الشبكة. الأثر: **20.79 MB → أقل من 3 MB**. **S**.

**H12 · حزمة اختبارات أساسية** — إعداد `flutter_test` + `mocktail`؛ اختبارات وحدة لـ DTOs و mojibake وحدود العمر (3/5/6/8/9/12 ورفض 2/13) والـ fallback في `ContentRepository`؛ اختبارات widget لـ login/PIN/home؛ اختبار تكامل لتدفّق login→child→home. **L**.

**H13 · معالجة أخطاء العمليات المصادَقة** — 401 يعيد التوجيه، 403 يعرض ترقية، 409 يعرض تعارض جهاز، 429 يعرض تهدئة. اعتماديات: C4, H5. **S**.

### 🟡 M — متوسط

- **M1** فصل الطبقات: `domain/`+`data/`+`application/` لكل feature؛ إخراج المنطق من الـ widgets. **XL**
- **M2** providers لكل كيان (`episodeProvider(id)`, `seriesProvider(id)`) واستخدام `/{entity}/:id`. **M**
- **M3** مكتبة مكوّنات مشتركة (`MajarraCard`, `MajarraTile`, `MajarraSwitchTile`, `MajarraTextField`) لإزالة 30+ تكراراً؛ إلغاء `_Field` المزدوج. **L**
- **M4** ربط `_LibraryDestination` («مكتبتي») أو حذفه — لا يجوز بقاء 150 سطر ميت. **S**
- **M5** حذف كل الكود الميت: `.bak`، `OfflineService`، `SkeletonCard` (أو استخدامه)، `_openPlayback`، `_unpublishedEpisode`، `_comingSoon`، 6 imports، والدوال الميتة في الـ API client. **S**
- **M6** إصلاح `/planets?planetId=` (تمرير الـ query param) وتوحيد سلوك النقر على الحلقات/الألعاب عبر الشاشات. **S**
- **M7** المفضلة الحقيقية عبر `POST /family/favorites`، وقائمة المشاهدة المستمدة منها لا من `isFree`. **M**
- **M8** الاشتراك: `billing/google-play/context` + `verify` + `in_app_purchase`، وشاشة مقارنة الباقات. **XL**
- **M9** إدارة أجهزة حقيقية: `GET /family/devices` + `/revoke` + شاشة Revoke Device + شاشة Limit Reached. **L**
- **M10** لوحة ولي الأمر الحقيقية: بيانات من `family/state`، حدود قابلة للتعديل، تحكم أبوي لكل عالم/رفّ، وثيم داكن متسق. **L**
- **M11** تدفّق التحقق من البريد + نسيان كلمة المرور + logout فعلي. **M**
- **M12** إصلاحات الوصولية: كل الأهداف ≥48dp (TV 64dp)، لا نص <12px، رفع alpha للتباين، دعم `TextScaler 2.0` بارتفاعات مرنة. **L**
- **M13** إصلاحات الأداء: `cacheWidth`/`ResizeImage` على كل صورة، `cached_network_image`، إلغاء `Timer` المسرَّب، debounce على البحث، إزالة `Column` داخل `Stack`. **M**
- **M14** حسم قرار الإشعارات (**فجوة توثيق**) وتنفيذه أو إزالة عناصر واجهتها («ذكرني»، «إشعارات المحتوى الجديد»). **M**
- **M15** Deep linking (**فجوة توثيق**: لا scheme محدد) — تعريفه ثم تنفيذه على المنصتين. **M**

### 🟢 L — منخفض (بعد الإصدار)

- **L1** محرّكات الألعاب: `GameEngineRegistry` + Flame + 5 محرّكات موجة MVP + 36 حزمة (بحاجة endpoints غير موجودة). **XL**
- **L2** القارئ الحقيقي: 4 أنواع محتوى، صوت متزامن، تظليل كلمة/جملة (بحاجة endpoints غير موجودة). **XL**
- **L3** التنزيل والأوفلاين: **محجوب تماماً** — لا endpoints ولا جداول تراخيص في الـ backend. **XL**
- **L4** DRM وحماية المحتوى (`FLAG_SECURE`, watermark, capture detection). **XL**
- **L5** أهداف تعليمية + آلة إتقان 6 حالات — محجوب: جدول `learning_objectives` **صفر صفوف**. **XL**
- **L6** ميزة «مشاريع». **L**
- **L7** اقتران TV بـ QR حقيقي (بحاجة endpoint). **M**
- **L8** Onboarding 9 خطوات. **L**
- **L9** إنجليزية/فرنسية بعد استقرار البنية العربية. **L**
- **L10** الفيديوهات القصيرة كفيديو فعلي بدل صور. **L**
- **L11** golden tests لكل Track Theme. **L**
- **L12** ترقية Flutter من 3.35.2. **S**

---

## 10. خريطة الطريق النهائية

### المرحلة 0 — استعادة القدرة على البناء (2–3 أيام، تسلسلي)
`C1` → `C3` → `C6` → `C8` → `H11` → `M5`
مخرَج: التطبيق يُبنى، لا نص من منتج آخر، الأصول أقل من 3 MB، لا كود ميت، وبوابة CI تمنع الانحدار.
**بوابة:** `flutter analyze` بلا أخطاء ولا تحذيرات + بناء appbundle ناجح.

### المرحلة 1 — الأساس الأمني (أسبوع، متوازي جزئياً)
- المسار أ (backend، حاجز): مسار PIN + عمود hashed + إرجاع `lease_id` + مسار `/books` عام + محتوى منشور واحد (`C7`).
- المسار ب (عميل): `C4` → `C5` → `H13`
- المسار ج (متوازي): `H7`, `H8`, `H10`
**بوابة:** لا يمكن الوصول لمنطقة ولي الأمر بلا PIN صحيح؛ الجلسة تدوم >15 دقيقة؛ الانهيارات تُلتقط؛ يُنتج appbundle موقّع.

### المرحلة 2 — طبقة البيانات الحقيقية (2–3 أسابيع)
تسلسلي: `H6` (تخزين) → `H2` (تقدّم)
متوازي مع ما سبق: `H1` (مشغّل، الأطول)، `H3` (أطفال)، `H5` (أخطاء/حالات)، `H4` (i18n)
**بوابة:** فيديو حقيقي يعمل من الخادم؛ التقدّم يُحفظ ويستعيد؛ الأطفال من الـ API؛ صفر نص حرفي في الـ widgets.

### المرحلة 3 — تشديد (2 أسابيع، متوازي بالكامل)
`H9`, `H12`, `M2`, `M4`, `M6`, `M7`, `M11`, `M12`, `M13`
**بوابة:** تغطية اختبارات ≥40% على `core/` و `data/`؛ تدقيق وصولية ناجح؛ لا شاشة معزولة.

### المرحلة 4 — التسويق التجاري (3–4 أسابيع)
`M8` (اشتراك) → `M9` (أجهزة) → `M10` (لوحة ولي الأمر)
متوازي: `M3` (مكوّنات)، `M14`, `M15`
**بوابة:** شراء حقيقي في Sandbox؛ حدود الأجهزة والسحب تعمل؛ التحكم الأبوي يؤثر فعلاً على المحتوى المعروض.

### المرحلة 5 — ما يجب اكتماله قبل الإصدار (لا يُتجاوَز)
1. `C1`–`C8` كلها.
2. `H1`–`H13` كلها.
3. `M8`, `M9`, `M10`, `M12` (اشتراك + أجهزة + تحكم أبوي + وصولية) — لأنها متطلبات سلامة أطفال وسياسة متجر لا ميزات اختيارية.
4. استبيان **Google Play Families Policy** + إفصاح Data Safety + تصنيف عمري + سياسة خصوصية منشورة.
5. مصفوفة اختبار phone/tablet/TV.
6. اختبار نصّي يمنع أي ادعاء «حماية 100%» (مطلوب صريح).
7. `M1` (فصل الطبقات) — يمكن تأجيله بعد الإصدار لكن كل يوم تأجيل يضاعف كلفته.

### يمكن تأجيله بعد الإصدار الأول
`L1`–`L12` بالكامل. الألعاب والقارئ الكامل والتنزيل والأهداف التعليمية **محجوبة على الخادم** أصلاً، فلا معنى لجدولتها على العميل قبل بناء الـ endpoints والمحتوى.

---

## 11. التعارضات بين الوثائق والتنفيذ — ومن هو المرجع

| # | التعارض | المرجع الموصى به |
|---|---|---|
| 1 | معرّفات الكواكب: `LocalCatalog` (`ibdaa`,`iman`) ≠ `_displayNames`/migrations (`alam`,`islamic`) | **migrations الـ backend** — هي التي تربط المحتوى الحقيقي. يجب تصحيح الطرفين |
| 2 | 9 كواكب في التطبيق ≠ 8+islamic في الـ backend ≠ 10 صور في المستودع | **الـ backend**، مع فصل `islamic` كعالم مستقل بـ 6 أرفف كما في `docs\content\91-islamic-governance.md` |
| 3 | الوثائق تفرض DRM متعدد؛ الـ backend ينفّذ `protection: 'access_controlled_no_drm'` | **الوثائق** للهدف النهائي، لكن **الـ backend** هو واقع MVP. يجب إعلان «بلا DRM» كقرار موثّق لا كنقص خفي، مع منع أي ادعاء حماية في نص الواجهة |
| 4 | الوثائق تفصّل تراخيص أوفلاين وتشفير AES-256-GCM؛ الـ backend صفر جداول ومسارات | **الوثائق** — لكن الميزة غير قابلة للتنفيذ. أزل زر التنزيل من الواجهة حتى تُبنى |
| 5 | الوثائق: PIN يُتحقق على الخادم؛ الـ backend: لا PIN إطلاقاً؛ التطبيق: فحص وهمي | **الوثائق**. أضف المسار في الـ backend فوراً وأزل الفحص المحلي |
| 6 | عقد الـ home feed مكتوب في الكود؛ الـ backend يوفّر `home-experience` (admin فقط) | **الـ backend** — انقل العقد إلى الخادم وأضف مساراً عاماً؛ أبقِ `feed_blocks.dart` كـ fallback فقط |
| 7 | 4 أوضاع قراءة في `docs\games`/UX مقابل 2 في مصدر آخر | **UX plan** (4 أوضاع) — وهو ما نفّذه التطبيق فعلاً |
| 8 | 18 مسار مذكور مقابل 21 موجود | **الكود** (21) — حدّث الوثيقة |
| 9 | 134 مقابل 136 حلقة مخططة | يحتاج حسماً من مالك المحتوى — لا يؤثر على العميل |
| 10 | التوسيم `is_free` بنوعين (`0/1` مقابل `true/false`) | **snake_case + boolean حقيقي** — وحّد الـ backend؛ أبقِ تسامح `_boolean()` كشبكة أمان |
| 11 | 4 اصطلاحات زمنية في نفس الـ API | **epoch ms في كل مكان** — قرار واحد قبل أن يبدأ العميل بالتحليل |
| 12 | 3 مفردات لحقول التقدّم | **`/family/progress` بالأسماء القانونية** — واعتبر البقية مهجورة |
| 13 | «إشعارات المحتوى الجديد» و«ذكرني» في الواجهة بلا أي متطلب موثّق | **الوثائق** (لا إشعارات) → أزل عناصر الواجهة، أو أضف المتطلب رسمياً أولاً |
| 14 | `supportedLocales` تعلن `en`؛ الوثائق: عربي فقط في MVP | **الوثائق** — احذف `en` حتى تُترجم فعلاً |
| 15 | لوحة ولي الأمر بثيم فاتح داخل تطبيق داكن؛ `brandcolor.md` يعرّف لوحة موحّدة | **`brandcolor.md`** |
| 16 | `SETUP_SECRETS.md` يطلب `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`؛ الكود يقرأ متغيرات أخرى | **الكود** — صحّح الوثيقة |

### فجوات في الوثائق نفسها (يجب سدّها قبل التنفيذ، لا بعده)
1. **لا أرقام أداء** — لا زمن إقلاع، لا معدل إطارات، لا نسبة جلسات بلا انهيار، لا حجم حزمة. لا يمكن الحكم على الأداء ولا تعريف «تم».
2. **لا مستوى WCAG ولا نسب تباين محددة** (رغم ذكر 4.5:1 و 3:1 في وثيقة واحدة) ولا متطلب قارئ شاشة.
3. **لا كتالوج أحداث تحليلات** — `MajarraAnalytics` تحمل 11 اسماً مستمدة من UX plan، وهي غير كافية.
4. **لا مواصفة deep linking** (لا scheme، لا مسارات).
5. **لا طبقة إشعارات** رغم وجودها في الواجهة.
6. **لا مواصفة TTS ولا تظليل على مستوى الكلمة** رغم أن القارئ يعرض لافتة تدّعي ذلك.
7. **لا مواصفة CI/CD ولا توقيع ولا flavors ولا نظام ترقيم إصدارات**.
8. **لا مواصفة تايبوغرافيا** — لا عائلة خطوط في أي وثيقة، والتطبيق يجلب `Readex Pro` من الشبكة وقت التشغيل.
