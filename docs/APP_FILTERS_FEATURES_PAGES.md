# تطبيق مجرة - الفلاتر والمزايا والصفحات

> **المنصة:** Flutter 3.9 + Riverpod + GoRouter | **التصميم:** سينمائي داكن `DeepSpace #0B1026` | **اللغات:** العربية أولاً RTL

## 1. الفلاتر

### 1.1 فلتر الصفحة الرئيسية (Home Feed)

| الفلتر | الخيارات | التأثير |
|---|---|---|
| **العمر** | `3-5 براعم` / `6-8 مستكشفون` / `9-12 روّاد` | يفلتر السلاسل `age_min/max` عبر `child_provider.dart` |
| **الكوكب** | 9 كواكب (`أبجد/الأرقام/العلوم/القيم/القصص/الإبداع/المهارات/التاريخ/الإيمان`) | `planet_id` |
| **اللغة** | `ar` / `en` / `fr` | `language` |
| **النوع** | `شاهد/اقرأ/استمع/العب/تعلم` | `type` |
| **المدة** | `<5د / 5-10د / >10د` | `duration_seconds` |
| **التوفر** | `مجاني / Premium / Offline` | `is_free / offline_license` |

كل فلتر يعيد بناء `HomeFeedContract` عبر `BlockRenderer` ولا ينقل لصفحة جافة.

### 1.2 فلتر صفحة الكواكب

* 9 كواكب أفقية قابلة للسحب، كل كوكب يعرض سلاسله وحلقاته وأنشطته.
* `islamic` يظهر فقط بموافقة ولي الأمر (لا يعيد ترتيب البقية).

### 1.3 فلتر التفاصيل

* تبويبات: `الحلقات / الأنشطة / الشخصيات / المزيد مثل هذا`
* فلترة الحلقات حسب `track` و `status`

### 1.4 فلتر البحث

* نص حر + `chips` سريعة (`مغامرات/حكايات/علوم`...)
* فلترة حسب `title/description` + `planet` + `age` + `language`
* بحث صوتي (أيقونة `mic` + ضغط مطول على بوابة مجرة)

## 2. المزايا

| الميزة | الوصف | الملف |
|---|---|---|
| **شاهد** | سلاسل وحلقات وأفلام `2:3` + `Hero` سينمائي + `Continue` | `features/home/presentation/widgets/cinematic_hero.dart` |
| **اقرأ** | قصص مصورة `3:4` + `PageView` + `اقرأ لي/بنفسي/معي/صامت` + تابلت صفحتين | `features/reader/presentation/pages/story_reader_page.dart` |
| **استمع** | صوتيات `1:1` + مشغل `AudioPlayerPage` | `features/audio/presentation/pages/audio_player_page.dart` |
| **العب** | ألعاب `1:1` `GamePage` (ذاكرة/متاهة) + `Offline` | `features/games/presentation/pages/game_page.dart` |
| **تعلّم** | رحلات `learning_journey` + اختبارات | `features/home/presentation/widgets/home_feed.dart` |
| **البوابة** | حلقة 6 `شاهد/اقرأ/استمع/العب/تعلّم/اكتشف` + 9 كواكب + `اختر لي` | `features/home/presentation/widgets/majarra_portal.dart` |
| **التحميل** | `OfflineService` `max 25` + ترخيص `30 يوم` | `core/offline/offline_service.dart` |
| **المزامنة** | `content_progress` لكل `child_id` مع `Family DO` | `features/child/application/child_provider.dart` |
| **الحماية** | `FLAG_SECURE` + `Widevine/FairPlay` + علامة مائية | `features/playback/presentation/playback_page.dart` |

## 3. الصفحات (18 Route)

| المسار | الصفحة | الوصف |
|---|---|---|
| `/` | `HomePage` | `AdaptiveHomeShell` (موبايل `BottomNav` / تابلت `Rail` / TV `10-foot`) |
| `/planets` | `PlanetsPage` | استكشاف 9 كواكب + فلترة |
| `/series/:id` | `SeriesDetailsPage` | تفاصيل سينمائية + إعجاب/مفضلة/شير + تبويبات |
| `/playback/:episodeId` | `PlaybackPage` | مشغل `HLS` + `progress` + `quality/CC` + `token 2د` |
| `/reader/:seriesId` | `StoryReaderPage` | قارئ 4 أوضاع + ثنائي لغة |
| `/audio` | `AudioPlayerPage` | مشغل صوت دائري |
| `/game/:id` | `GamePage` | لعبة `1:1` |
| `/children` | `ChildSwitcherPage` | اختيار ملف `3-5/6-8/9-12` |
| `/parent` | `ParentDashboardPage` | تقارير منفصلة + وقت + سماحات |
| `/parent-pin` | `ParentPinPage` | `PIN 4` + بصمة |
| `/login` | `LoginPage` | بريد + كلمة مرور + `AuthStorage` |
| `/register` | `RegisterPage` | إنشاء `Family DO` |
| `/membership` | `MembershipPage` | باقة العائلة |
| `/watchlist` | `WatchlistPage` | المفضلة `Grid 2` |
| `/downloads` | `DownloadsPage` | التنزيلات + تخزين |
| `/account` | `AccountDataPage` | بيانات الحساب |
| `/devices` | `DevicesPage` | إدارة الأجهزة |
| `/settings` | `SettingsPage` | جودة/تحميل/WiFi |
| `/support` | `SupportPage` | دعم فني |
| `/privacy` | `PrivacyPage` | سياسة الخصوصية |
| `/tv-pairing` | `TvPairingPage` | `QR 739 482` |

## 4. التخصيص

* `preschool 3-5`: بطاقات كبيرة `64dp`، صوت افتراضي، لا بحث كتابي
* `kids 6-8`: توازن + بحث صوتي + 2-3 ألوان
* `junior 9-12`: كثافة معلومات أعلى، فلاتر أكثر، توهج أقل

## 5. التقنية

* `Riverpod` (`homeCatalogProvider` + `childProvider` + `filteredCatalogProvider`)
* `MajarraApiClient` (`ApiEnvironment` prod `api.majarra.app` + `getAccessToken` من `AuthStorage`)
* `CinematicBackground` + `PlanetSymbol` + `FocusableScale` (TV focus `1.045` + توهج سماوي)
