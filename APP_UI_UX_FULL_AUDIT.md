# تقرير التدقيق الشامل لتطبيق Majarra

**تاريخ اللقطة:** 11 أغسطس 2026
**النطاق:** تطبيق Flutter داخل `app_main`، ومسارات المحتوى العامة والإدارية ذات الصلة داخل `dashboard/api`
**الهدف:** حصر المكسور والناقص ومشكلات UI/UX في جميع الصفحات والأقسام، مع أولوية خاصة للقصص المصورة، الصوت متعدد اللغات، responsive، RTL، وإمكانية الوصول.

## 1. طريقة قراءة التقرير وحدوده

### درجات الثقة
- **[مؤكد بالكود]**: السلوك ظاهر مباشرة في المسارات أو النماذج أو الـwidgets الحالية.
- **[ملاحظ بصريًا]**: ظاهر في الصور المقدمة، لكنه قد يتأثر بإصدار build قديم أو browser zoom.
- **[يحتاج تحقق تشغيلي]**: لا يمكن إثباته من القراءة الساكنة وحدها، ويحتاج تشغيلًا على جهاز/مقاس أو بيانات حية.

### ما تم فحصه
- جميع GoRoutes المعرفة في `app_main/lib/app/router/app_router.dart`.
- أسطح Home/Search/Shorts/Profile الموجودة داخل الـshell حتى لو لم تكن لها URL مستقلة.
- قارئ القصص، مشغل الصوت، الفيديو، الكواكب، التفاصيل، الألعاب، الاستوديو، التنزيلات، الحساب، العضوية، الأجهزة، الإعدادات، الدعم، الخصوصية، المصادقة، الأطفال، PIN، ولوحة الوالد.
- public story API، نماذج Flutter، وبعض مسارات admin اللازمة لفهم قدرات الكوميكس والصوت.
- نظام breakpoints والثيم وبعض سلوكيات TV، RTL، reduced motion، focus، semantics، loading/empty/error.

### ما لم يتم فحصه تشغيليًا
- لم يُنفذ visual regression متعدد المقاسات، ولم تُختبر شاشة فعلية عند 320/600/1024/1366/1920 بكسل.
- لم يُختبر TalkBack أو VoiceOver أو قارئ شاشة الويب، ولم تُقَس نسب التباين من rendering فعلي.
- لم يُختبر keyboard/D-pad end-to-end على TV فعلي.
- لم تُقرأ D1 الحية، ولم يُنشر أو يُعدل أي محتوى، ولم يُفتح ملف أسرار مثل `dashboard/api/.dev.vars`.
- ملاحظة «ظهور صورتين معًا» لا يثبتها renderer الحالي؛ تفاصيل ذلك موضحة في قسم القارئ.

> معيار الوصول المرجعي المقترح لهذا التدقيق هو WCAG 2.2 AA، لكنه ليس ادعاء امتثال؛ إثبات الامتثال يحتاج الاختبارات اليدوية المذكورة أعلاه.

> **تنبيه حالة الوثيقة (بعد التنفيذ):** الأقسام **2–17** تحفظ لقطة العيوب الأصلية وخطة الإصلاح كما كانت وقت التدقيق، لذلك لا ينبغي قراءتها وحدها بوصفها الحالة الحالية. سجل التنفيذ المرجعي والحالة النهائية لكل بند موجودان في **القسم 18** أدناه؛ وعند التعارض تكون حالة القسم 18 هي الأحدث.

---

## 2. الحكم التنفيذي

**الحكم العام: التطبيق يملك أساسًا تقنيًا جيدًا في تشغيل الفيديو والثيم والتنزيل الجزئي، لكنه غير جاهز بعد ليُقدَّم كمنصة أطفال مكتملة.** أهم أسباب منع الإطلاق الكامل هي:

1. **حدود الوالد غير محكمة:** يمكن فتح `/parent` بعد المصادقة من دون إثبات PIN محفوظ على مستوى الراوتر، كما أن PIN يسمح fallback محليًا عند فشل الشبكة. هذه مشكلة صلاحيات وليست مجرد UX.
2. **الكوميكس ليس نظام كوميكس فعليًا بعد:** الإدارة تعرف bubbles وبعض الترجمات والمسارات الصوتية، لكن public API وFlutter لا ينقلان أو يرسمان panels/bubbles/read order، و`isComic` و`layout` غير مستخدمين.
3. **الصوت متعدد اللغات/الأصوات غير مكتمل:** القارئ يعرض اختيار `ar/en` ثابتًا ولا يتيح narrator/voice؛ تغيير اللغة قد يترك صفحات اللغة السابقة مع إظهار اللغة الجديدة.
4. **الـHome يعرض وعودًا غير حقيقية:** progress، الأكثر مشاهدة، رحلة تعليمية، قريبًا، الشخصيات، والصوتيات مشتقة من نفس catalog أو hardcoded؛ لذلك يتكرر المحتوى وتظهر أزرار لا تنفذ ما توحي به.
5. **بعض الوجهات صفحات شكلية أو غير موصلة:** Planets، TV Pairing، الشراء، الدعم، تغيير كلمة المرور، بعض الألعاب، واستكمال الاستوديو.
6. **الاستجابة ليست Adaptive كاملة:** يوجد breakpoint أساسي، لكن كثيرًا من المكونات لها أحجام ثابتة أو خياران فقط touch/TV؛ وهذا يفسر المحتوى الصغير والفراغات الكبيرة في الشاشات الواسعة.
7. **الوصول متفاوت:** Playback وHome فيهما جهود جيدة، بينما القارئ والبوابة وبعض البطاقات touch-centric وبأحجام نص 9–12px ومن دون بدائل keyboard/remote كافية.

### التقييم الإرشادي

الأرقام التالية **تقدير خبرة من الكود والصور وليست قياس usability معمليًا**:

| المجال | التقييم /10 | الخلاصة |
|---|---:|---|
| سلامة التنقل الأساسية | 6 | معظم routes موجودة، لكن عددًا منها يقود إلى placeholder أو مورد غير مضمون |
| اكتشاف المحتوى وHome | 4 | القصص أصبحت قابلة للإدراج، لكن الإنتاج ما زال يعتمد Home v1 وأقسامه غير صادقة أو مكررة |
| قارئ القصص والكوميكس | 2 | page turner بسيط، بلا بنية panels/bubbles أو تجربة لغات/صوت متكاملة |
| مشغل الصوت | 4 | تشغيل/seek/speed حقيقي، لكن بلا لغة/راوٍ/غلاف/فصول/background controls |
| تشغيل الفيديو | 7 | أقوى سطح حاليًا؛ captions/progress/shortcuts موجودة، لكن quality وautoplay غير فعليين |
| Responsive وDesktop | 4 | breakpoint موجود؛ إعادة التركيب والاستفادة من العرض غير كافيتين |
| TV وD-pad | 4 | بعض focus/shortcuts جيدة، لكن portal/reader/pairing وتجربة overscan غير مكتملة |
| RTL وLocalization | 5 | Directional APIs مستخدمة في مواضع، لكن اللغة ثابتة/strings hardcoded ومحتوى اللغات غير مضبوط |
| Accessibility | 4 | أجزاء جيدة، لكن القارئ والنصوص الصغيرة وfocus/semantics تمنع تقييمًا أعلى |
| الوالد والحماية | 2 | تقارير جزئية، لكن PIN والـroute guard يمثلان release blocker |
| الحساب/العضوية/الدعم | 3 | تعرض معلومات محدودة، بينما أهم العمليات disabled أو placeholders |

---

## 3. ما تم إصلاحه بالفعل أثناء المراجعة

هذه نقاط **ليست مفتوحة الآن** في نفس الصورة التي كانت عليها أولًا:

- إعادة القصص إلى `filteredCatalogProvider` بدل حذفها عند فلترة ملف الطفل.
- إضافة رسم `SearchResultKind.story` داخل البحث.
- إضافة القصص إلى Home v2.
- توسيع وتحسين NavigationRail على desktop.
- تحسين scaling الخاص بـHome v2 بعد 1024px، وتقليل ارتفاع billboard، وتقييد عرض البحث.

**التحقق المسجل بعد تلك التعديلات:**
- `flutter analyze` → `No issues found!`
- `flutter test` → 275 اختبارًا ناجحًا.
- `flutter build web` → ناجح، مع تحذيرات Wasm تخص `flutter_secure_storage_web`.

هذه النتائج تثبت التحليل/الاختبارات/build فقط؛ لا تثبت جودة responsive أو الوصول أو صحة البيانات الحية.

---

## 4. ترتيب المشكلات حسب الخطورة

### P0 — موانع إطلاق وحماية الوالد

| ID | المشكلة | الأثر | الدليل | الإجراء المطلوب |
|---|---|---|---|---|
| P0-01 | **[مؤكد بالكود] `/parent` يحتاج auth فقط ولا يحتاج proof لحظي من PIN.** صفحة `/parent-pin` منفصلة وليست guard ملازمًا لمسار الوالد. | deep link أو تنقل مباشر يستطيع تجاوز تجربة PIN بعد تسجيل الدخول. | `_guardRedirect` في `app_main/lib/app/router/app_router.dart`، ومسارا `/parent` و`/parent-pin`. | إضافة `ParentAccessState` موثوق وقصير العمر، وحماية `/parent` وكل عمليات الوالد على مستوى router/API، مع redirect إلى PIN عند غياب الإثبات. |
| P0-02 | **[مؤكد بالكود] PIN يعمل fail-open:** عند فشل server/network يوجد fallback محلي يسمح بفتح سطح الوالد، رغم أن النص يقدمه كحد server. | فقدان معنى الحماية عند انقطاع الشبكة أو فشل الخادم. | صفحة PIN وتدفق التحقق في feature الوالد. | التحول إلى fail-closed للعمليات الحساسة. إن لزم offline mode فيكون read-only وبإثبات مشفر سبق إصداره، لا قبولًا تلقائيًا. |
| P0-03 | **[مؤكد بالكود] الحساب والأجهزة والإعدادات والعضوية والخصوصية ظاهرة في سطح الطفل ولا تدخل ضمن `childRequired` أو parent gate واضح.** | طفل يستطيع الوصول إلى بيانات أو إعدادات وعمليات تخص ولي الأمر. | `home_destinations.dart` و`app_router.dart`. | تصنيف routes إلى child/public/parent-sensitive، وإجبار PIN قبل الحساب، الأجهزة، billing، الخصوصية والعمليات الحساسة. |

### P1 — الوظائف الأساسية وتجربة المحتوى

| ID | المشكلة | الأثر | الدليل | الإجراء المطلوب |
|---|---|---|---|---|
| P1-01 | **الكوميكس لا يملك عقد بيانات/renderer كاملًا.** public API لا يعيد bubbles؛ `timing_cues` يُعاد لكنه يُهمل؛ `isComic` و`page.layout` لا يغيران الرسم. | كل أنواع القصة تنتهي إلى صورة واحدة ونص وصوت اختياري، بلا panels أو bubbles أو ترتيب قراءة. | `dashboard/api/src/routes/stories.ts`، `content_dtos.dart`، `content_models.dart`، `story_reader_page.dart`. | توحيد contract للكوميكس ثم بناء renderer بحسب `single/spread/panels` مع bubbles مترجمة وترتيب قراءة صريح. |
| P1-02 | **تبديل اللغة قد يعرض لغة خاطئة بصمت.** إذا أعاد API صفحات فارغة، تتغير `_language` بينما تبقى `_pages` القديمة. كما تُبتلع أخطاء fetch وتتحول إلى `[]`. | الطفل يختار English وقد يستمر في رؤية/سماع العربية دون رسالة خطأ. | `_switchLanguage` في `story_reader_page.dart`، و`fetchStoryPages*` في API client. | لا تبديل للحالة حتى نجاح الطلب؛ استخدام states واضحة `loading/data/missingTranslation/error` وزر retry، ومسح/حجب الصفحة القديمة عند عدم توافق اللغة. |
| P1-03 | **مسار القارئ غامض:** `/reader/:seriesId` يستخدم نفس المعامل للـstory/book/series، وseries بلا pages ينتج قارئًا فارغًا. | deep links غير محددة وقد تنتهي بصفحة فارغة. | `app_router.dart` و`story_reader_page.dart`. | مسارات typed مثل `/stories/:storyId/read`، أو route argument يحدد النوع ويُتحقق منه قبل البناء. |
| P1-04 | **Home يُخفي كل شيء إذا كانت `catalog.series` فارغة، حتى مع وجود stories/books/episodes.** | مكتبة قصص منشورة يمكن أن تبدو فارغة بالكامل. | شرط البداية في `HomeFeed.build` داخل `home_feed.dart`. | حساب empty state على مجموع أنواع المحتوى، وإظهار كل rail متاح بصورة مستقلة. |
| P1-05 | **أقسام Home تقدم بيانات مصطنعة على أنها شخصية/حقيقية.** Continue Journey له progress ثابت، Learning Journey hardcoded، Most Watched هو `series.take(5)`, New Releases هو reverse، Character Orbit مشتق من أول كلمة، Coming Soon يعيد نفس السلاسل، Audio Rail يستخدم experiences. | تكرار شديد، فقدان الثقة، وأزرار تعد بوظائف غير موجودة. | `_BlockSliver` والـwidgets التابعة في `home_feed.dart`. | ربط كل block بمصدر حقيقي، أو إخفاؤه. منع progress/ranking/reminder الوهمي، وإضافة dedup policy بين rails. |
| P1-06 | **الإنتاج `/` يستخدم Home v1 بينما معظم إصلاحات العرض الجديدة في `/home-v2`.** | المستخدم لا يحصل تلقائيًا على أفضل layout تمت إضافته. | routes في `app_router.dart` وHome v1/v2. | اختيار نسخة واحدة production، أو backport كامل مع feature flag واختبار A/B واضح؛ لا إبقاء نسختين مختلفتين وظيفيًا بلا حوكمة. |
| P1-07 | **Planets تعرض affordances غير عاملة:** EpisodeCard يعرض SnackBar بدل playback، وExperienceCard يقول قيد التجهيز بدل فتح game، والـempty state يساوي `SizedBox.shrink()`. | بطاقات تبدو قابلة للتشغيل لكنها لا تعمل، وصفحة فارغة بلا تفسير. | `planets_page.dart`. | الربط بـ`/playback/:id` و`/game/:id` عند قابلية التشغيل، وتعطيل بصري واضح خلاف ذلك، وإضافة empty/error/retry. |
| P1-08 | **IDs الألعاب المحلية ليست مضمونة أن تطابق rows الخادم، والاستوديو غير موصل كمسار مباشر، وContinue Editing غير مربوط.** | Home قد يفتح Game unavailable، واستكمال رسمة موجودة يصبح غير قابل للوصول. | `game_route.dart`، `creative_studio_page.dart`، `MyCollectionRoute`/`MyCollectionPage`. | مصدر IDs موحد من API، route صريح للاستوديو مع drawing/template ID، وربط الاستكمال وحالات الخطأ برسالة صديقة للطفل. |
| P1-09 | **Child switcher يعرض طفل demo عند API empty/failure لأي حساب، وليس demo account فقط.** | يخفي فشل الشبكة أو حالة الأسرة الفارغة ويخلط بيانات وهمية بحساب حقيقي. | `_demoChildrenIfNeeded` في `child_provider.dart`. | قصر demo على session معلّمة صراحة، وفصل empty عن offline/error مع retry وإنشاء طفل. |
| P1-10 | **القارئ والصوت لا يقدمان اختيار narrator/voice أو tracks متعددة، واللغة ثابتة في `ar/en`.** | الميزة الأساسية التي طلبها المنتج—صوت بأكثر من لغة/صوت—غير موجودة. | `story_reader_page.dart` و`audio_player_page.dart`. | languages/tracks من API، selector للغة والراوي، persistence مستقل لكل قصة، fallback معلن، وربط timing عند توفره. |
| P1-11 | **قارئ القصة ضعيف للوحة المفاتيح/TV وقارئ الشاشة:** tap zones غير مرئية، بلا Shortcuts/Actions، و`altText` لا يصل إلى `semanticLabel`. | التنقل غير مكتشف، D-pad لا يكفي، والصورة الأساسية غير موصوفة للمستخدم الكفيف. | `story_reader_page.dart`. | أزرار مرئية، swipe اختياري لا وحيد، shortcuts، focus واضح، Semantics للصورة والصفحة والحالة الصوتية. |

### P2 — نواقص كبيرة لكنها لا تكسر الحد الأمني الأساسي

| ID | المشكلة | الأثر/الدليل المختصر |
|---|---|---|
| P2-01 | **Search محلي فقط وبصريًا قائمة `ListTile`.** | لا thumbnails/cards مناسبة للأطفال، لا suggestions/fuzzy/typo tolerance/ranking/server search؛ book وstory يحملان label «قصص» نفسه. `search_page.dart`. |
| P2-02 | **Series Details لا تعيد تركيب layout حسب الحجم.** | تعليق صريح في `series_details_page.dart`، Watch Now يبقى ظاهرًا بلا حلقات ثم Snackbar، وShare بلا deep link. |
| P2-03 | **Shorts ليست Shorts حقيقية.** | تستخدم كل episodes، بلا فلتر vertical/short، بلا autoplay preview، ونفس `PageView` العمودي على desktop/TV. `shorts_page.dart`. |
| P2-04 | **Quality في Playback تجميلية وautoplay setting غير مستهلك.** | تغيير `_quality` لا يبدل stream/bitrate؛ next يدوي؛ captions toggle قد يظهر بلا captions ولا توجد لغة captions؛ error بلا Retry. `playback_page.dart`. |
| P2-05 | **Audio Player ناقص product features.** | لا artwork حقيقي، لغة/راوٍ، sleep timer، queue/chapters، transcript، background/lock-screen controls؛ private narration غير قابلة للتنزيل لغياب license endpoint. `audio_player_page.dart`. |
| P2-06 | **Downloads لا تفتح المحتوى بعد اكتماله.** | pause/resume/delete/status موجودة، لكن ready item بلا Play/Open؛ الدعم الفعلي public audio فقط، لا video/private narration. `downloads_page.dart`. |
| P2-07 | **Watchlist أضيق من اسم «قائمتي».** | series فقط، بلا story/book/episode؛ العناصر unpublished تختفي مع count notice فقط. `watchlist_page.dart`. |
| P2-08 | **Account Data واجهة placeholder.** | الاسم/email/phone `—` وavatar بديل؛ `/auth/me` غير مستهلك؛ phone/password/edit disabled. الحذف الخاص بالرسومات يعمل. `account_data_page.dart`. |
| P2-09 | **Membership تعرض status لكن لا تنفذ شراء/إدارة.** | billing client غير integrated، والنص يقول downloads قيد التطوير رغم وجود DownloadManager جزئيًا. `membership_page.dart`. |
| P2-10 | **Support شبه معطلة.** | FAQ/report/suggest/phone disabled؛ license فقط يعمل. `support_page.dart`. |
| P2-11 | **Privacy ليست متسقة مع المنتج.** | تدّعي حذف بيانات طفل/تصدير التقدم/إيقاف analytics بلا surfaces واضحة، و«الشروط والأحكام» تفتح `/privacy`. `privacy_page.dart` و`home_destinations.dart`. |
| P2-12 | **Settings لا تتحكم فعليًا في كل السلوك.** | autoplay/quality/notifications تحتاج consumers؛ playback لا يستخدم autoplay/quality؛ اللغة read-only Arabic رغم دعم ar/en. `settings_page.dart`. |
| P2-13 | **Login/Register غير مكتملين.** | Forgot password disabled، demo tokens قد تسبب 401، platform=`android` وdeviceName=`Flutter` حتى web/iOS؛ footer غير قابل للنقر؛ register بلا confirm password/rules/terms checkbox ورسائل validation عامة. |
| P2-14 | **Parent Dashboard جزئي.** | progress/mastery/rewards موجودة جزئيًا، لكن time limits/schedules قيد الربط، وobjective IDs تظهر raw بدل أسماء مترجمة. |
| P2-15 | **TV Pairing placeholder صريح.** | لا endpoint ولا QR/code صالح؛ الصفحة تعرض «الخدمة غير متاحة بعد». `tv_pairing_page.dart`. |
| P2-16 | **بوابة Majarra touch-centric وبعض أفعالها placeholders.** | Listen وPlay ينتهيان SnackBar؛ المدار مبني على drag/tap ولا يملك traversal واضح؛ عرضه الأقصى 400px في الشاشة الواسعة. `majarra_portal.dart`. |
| P2-17 | **Portal لا يحمي حالة planets الفارغة.** | يمكن دخول وضع planets بعدد صفر؛ الرسم يقسم على count، وضغط المركز يحاول modulo/access لقائمة فارغة. `majarra_portal.dart`. |
| P2-18 | **Listener يتراكم في portal بعد كل drag.** | `_snapToNearest` يضيف listener جديدًا إلى `_snapController` في كل مرة ولا يزيل القديم؛ خطر rebuilds متكررة/تدهور مع الاستخدام. |
| P2-19 | **Responsive مبني على breakpoint عام لا composition كامل.** | `AppBreakpoints` = 599/1023 مع padding 18/32/52، لكن rails والبطاقات غالبًا touch/TV فقط وبأبعاد ثابتة؛ هذا لا يستغل tablet/desktop. `app_layout.dart` وHome widgets. |
| P2-20 | **لغة التطبيق التحريرية hardcoded في صفحات كثيرة.** | وجود ar/en على مستوى التطبيق لا يعني أن strings أو المحتوى remote لهما fallback صحيح؛ النصوص العربية المباشرة كثيرة في الملفات المدققة. |

### P3 — تحسينات وصقل

- توحيد جميع typography على `ThemeData.textTheme` بدل `TextStyle` خام بأحجام 9–12px.
- توحيد empty/error/loading components ورسائل الأطفال بدل SnackBars المتفرقة أو raw errors.
- إضافة artwork حقيقي للصوت، وتوحيد badges والحالات disabled/focus/pressed.
- تحسين مشاركة السلاسل بروابط deep links فعلية.
- توحيد تسمية «قصص»، «كتب»، «كوميكس»، «قصص صوتية» في Home/Search/Reader.
- إضافة analytics موحدة لفتح/فشل/إكمال قصة، تغيير لغة، تغيير راوٍ، والتنزيل، من دون PII أو signed URLs.
- إزالة المحتوى الموسمي hardcoded أو ربطه بجدول نشر وتاريخ بداية/نهاية.

---

## 5. تدقيق كل المسارات والصفحات

| المسار/السطح | الحالة | أهم المكسور أو الناقص | الأولوية |
|---|---|---|---|
| `/` Home v1 | جزئي | شرط `series.isEmpty` يخفي بقية الأنواع؛ rails وهمية/مكررة؛ قصص موجودة لكن توزيع desktop ثابت | P1 |
| `/home-v2` | أفضل بصريًا لكنه غير production | تحسينات responsive والقصص موجودة، لكن وجود نسختين يخلق اختلاف سلوك وصيانة | P1 |
| Search داخل shell | جزئي | local-only، تصميم ListTile، لا visual discovery أو fuzzy/ranking؛ تم إصلاح رسم story | P2 |
| Shorts داخل shell | مفهوم غير مكتمل | كل episodes تعامل كـshorts، لا فيديو preview ولا layout desktop/TV | P2 |
| Profile داخل shell | جزئي/حساس | avatar placeholder، CTA العضوية بلا tap، terms→privacy، routes حساسة بلا PIN واضح | P0/P2 |
| `/planets` | واجهة جيدة نسبيًا لكن الإجراءات معطلة | الحلقات والألعاب تعرض SnackBars، والـempty state صامت | P1 |
| `/series/:seriesId` | جزئي | لا adaptive layout، CTA تشغيل بلا episode، share بلا deep link | P2 |
| `/playback/:episodeId` | الأقوى حاليًا | تشغيل/captions/progress/shortcuts جيدة؛ quality وautoplay غير فعليين، captions/error UX ناقص | P2 |
| `/reader/:seriesId` | ضعيف جدًا | route ambiguous؛ لا comic renderer؛ لغة/صوت/semantics/keyboard/error states ناقصة | P1 |
| `/audio` | جزئي حقيقي | controls الأساسية تعمل؛ لا multi-language/narrator/artwork/chapters/background/offline private | P1/P2 |
| `/game/:gameId` | غير موثوق | local IDs قد لا تطابق server؛ raw error للطفل؛ unavailable محتمل | P1 |
| Creative Studio (لا route مباشر) | prototype | templates/regions hardcoded؛ «إكمال رسمة» ليس feature؛ continuation غير موصل | P1/P2 |
| `/watchlist` | جزئي | series فقط ولا يشمل القصص/الحلقات | P2 |
| `/my-collection` | جزئي | عرض الأعمال موجود، لكن استكمال التحرير غير موصل إلى route الاستوديو | P1 |
| `/downloads` | جزئي حقيقي | إدارة الحالة تعمل؛ لا Play/Open، وتغطية media محدودة | P2 |
| `/account` | placeholder جزئي | `/auth/me` غير مربوط والحقول فارغة؛ edit/phone/password disabled؛ يحتاج PIN | P0/P2 |
| `/devices` | حساس/يعتمد session | معرض لفشل demo token ويفترض أن يكون parent-gated | P0/P2 |
| `/membership` | read-only تقريبًا | status/limits حقيقية؛ purchase/manage disabled؛ يحتاج parent gate | P0/P2 |
| `/settings` | جزئي | قيم محفوظة لكن بعضها غير مستهلك؛ اللغة ثابتة؛ يحتاج فصل إعدادات الطفل/الوالد | P0/P2 |
| `/support` | شبه placeholder | أغلب actions disabled | P2 |
| `/privacy` | نص ثابت | claims بلا أدوات مقابلة، terms موجهة إليه خطأ، ويحتاج parent boundary | P0/P2 |
| `/login` | جزئي | forgot password disabled؛ platform metadata خطأ؛ footer غير تفاعلي | P2 |
| `/register` | جزئي | validation عام، بلا confirm/rules/consent واضح، footer غير تفاعلي | P2 |
| `/children` | جزئي | fallback demo يخفي empty/error الحقيقي؛ أخطاء الإنشاء عامة | P1 |
| `/parent-pin` | خطر وظيفي | fallback محلي fail-open | P0 |
| `/parent` | خطر صلاحيات + جزئي | route غير مربوط بإثبات PIN؛ تقارير جزئية؛ limits/schedules غير مربوطة | P0/P2 |
| `/tv-pairing` | placeholder معلن | لا code/QR/endpoint صالح | P2 |

### ملاحظة حول route guards

`_guardRedirect` يحمي child-required routes وبعض prefixes فقط. المطلوب ليس إضافة `/account` و`/parent` عشوائيًا إلى نفس القائمة؛ بل تعريف مصفوفة صلاحيات صريحة:

- **Public:** login/register/legal العام.
- **Authenticated family:** اختيار الطفل وربط الجلسة.
- **Child session:** home/search/read/watch/play ضمن العمر والاستحقاق.
- **Parent verified:** الحساب، الأجهزة، الاشتراك، الخصوصية، حذف/تصدير البيانات، controls، ولوحة الوالد.

---

## 6. قارئ القصص والكوميكس — التحليل المفصل

### 6.1 ما يفعله النظام الحالي

1. `GET /stories` في `dashboard/api/src/routes/stories.ts` يعيد القصص ذات `status='published'` فقط؛ هذا سلوك صحيح للنشر العام.
2. `GET /stories/:id/pages?language=...` يعيد `body_text`, `alt_text`, `timing_cues`, `image_url`, `audio_url`.
3. `StoryPageDto` في `content_dtos.dart` لا يحتفظ بـ`timing_cues`.
4. `StoryPage` في `content_models.dart` يحمل layout/text/image/audio، لكنه بلا panel geometry أو bubbles أو timing model.
5. `story_reader_page.dart` يستقبل `isComic` لكنه لا يستخدمه، ولا يقرأ `page.layout` لاختيار renderer.
6. كل صفحة تُعرض كصورة واحدة بـ`Image.network(..., fit: BoxFit.contain)` داخل `PageView`، مع نص/صوت اختياريين.
7. admin يدعم `story_bubbles`, `localized_text`, `audio_tracks` في `adminContent.ts`، لكن public API لا يعيد bubbles وFlutter لا يملك renderer لها.
8. `adminStories.ts` يصرح حاليًا بأن `timing_supported: false` و`panels_supported: false`، وأن قيمة layout المسماة panels لا تقابلها جداول هندسة أو ترتيب قراءة.

**النتيجة:** الاسم «كوميكس» حاليًا تصنيف محتوى فقط، وليس capability مكتملة.

### 6.2 ملاحظة «عرض صورتين معًا»

**[غير مثبتة في renderer الحالي]** الكود الحالي يرسم عنصر `StoryPageView` واحدًا وصورة network واحدة لكل index. لذلك الاحتمالات الأقرب هي:

- ملف artwork نفسه يحتوي صفحتين كـdouble-page spread.
- الإصدار المصور build قديم لا يطابق الكود الحالي.
- payload يعامل spread واحدًا كصورة واحدة، فيظهر بصريًا كصفحتين.
- browser zoom أو نسبة الصورة تجعل الصفحة تبدو مزدوجة.

لا ينبغي رفض الشكوى؛ المطلوب reproduction منظم:

1. تسجيل story ID وpage ID و`image_url` المعروضين.
2. فحص أبعاد ومحتوى الصورة المصدرية.
3. تثبيت commit/build والـviewport والـzoom عند 100%.
4. التأكد أن كل record يمثل page أم spread.
5. إضافة `displayMode` صريح بدل التخمين من أبعاد الصورة.

### 6.3 عيوب تجربة القراءة الحالية

- اللغات hardcoded إلى `ar` و`en` بدل `story.languages` أو tracks المتاحة.
- لا يوجد narrator/voice selector ولا preview للصوت.
- `_canNarrateDirect = _pages.any(hasAudio)` يفعّل «اقرأ لي» إذا كانت صفحة واحدة فقط تملك صوتًا؛ التجربة قد تتوقف في الصفحات التالية.
- `VideoPlayerController` مستخدم للصوت بدل abstraction صوت يدعم background/session/lock screen بصورة طبيعية.
- لا word highlighting أو sentence highlighting لأن timing غير محمول للنموذج.
- لا transcript/captions ولا اختيار سرعة/seek داخل القارئ؛ play/pause فقط وشريط تقدم غير تفاعلي.
- لا offline package للصور + tracks + metadata.
- التقدم محلي في `SharedPreferences` فقط، وليس family progress server.
- tap zones غير مرئية في ثلثي الشاشة؛ الطفل لا يعرف أين يضغط.
- لا keyboard arrows أو D-pad actions أو focus traversal مخصص.
- `altText` موجود في البيانات لكن لا يمر إلى `Image.semanticLabel`.
- controls وأزمنة كثيرة في نطاق 10–14px.

### 6.4 العقد المطلوب للكوميكس

ينبغي أن يفصل العقد بين **القصة** و**الإصدار اللغوي** و**المسار الصوتي** و**الصفحة/اللوحة**:

#### Story
- `id`, `type` (`picture_book`, `comic`, `audio_story`).
- `age_min`, `age_max`, `status`, `entitlement`.
- `available_languages`, `default_language`, `reading_direction`.
- cover/hero artwork مع dimensions وalt محلي.
- `content_version` وحقول cache/invalidation.

#### Page/Spread
- `id`, `order`, `display_mode` (`single`, `spread`, `panels`).
- image URL، width، height، checksum.
- alt text لكل لغة.
- هل الصورة صفحة واحدة أم spread صريح؛ لا استنتاج من العرض.

#### Panels/Bubbles
- panel ID وهندسة normalized من 0 إلى 1.
- `reading_order` صريح مستقل عن RTL البصري.
- bubble ID/type (`speech`, `thought`, `caption`, `sfx`).
- geometry، tail/anchor إن لزم، وlocalized text.
- style tokens محدودة وآمنة بدل HTML حر.

#### Audio tracks
- track ID، language، narrator ID/name، voice label، duration، availability/entitlement.
- page/segment timing cues، مع `start_ms/end_ms` وربط text token أو bubble ID.
- downloadable/license metadata من دون كشف signed URL طويل العمر.

### 6.5 تجربة القارئ المستهدفة

1. **شاشة بداية خفيفة:** غلاف، العنوان، مدة القراءة، اللغة، الراوي، «اقرأ بنفسي» و«اقرأ لي».
2. **صفحة واحدة افتراضيًا:** spread لا يُعرض إلا إذا metadata تقول spread، ومع وضع تكبير مناسب للشاشة الصغيرة.
3. **Comic mode:** صفحة كاملة أو Guided Panels؛ الانتقال حسب `reading_order` وليس حسب موقع بصري مفترض.
4. **Controls واضحة:** السابق/التالي، عداد الصفحة، play/pause، seek، السرعة، اللغة، الراوي، النص، التنزيل.
5. **مزامنة الصوت:** highlight للجملة أو bubble المتزامنة، مع fallback بلا highlight إن لم توجد cues.
6. **حالات واضحة:** ترجمة غير متاحة، مسار صوت ناقص، offline، خطأ صورة، انتهاء license، retry.
7. **Accessibility:** alt/description، أسماء وحالات controls، keyboard/D-pad، focus ظاهر، text scaling، reduced motion.
8. **Progress:** حفظ page/panel/time محليًا ثم مزامنته للأسرة عند الاتصال.

---

## 7. Home والاكتشاف والبحث

### 7.1 لماذا يظهر المحتوى قليلًا أو مكررًا؟

**[مؤكد بالكود]** عدة أقسام لا تملك query مستقلة:

- Continue Journey = أول أربع سلاسل + progress ثابت.
- Most Watched = أول خمس سلاسل.
- New Releases = نفس السلاسل معكوسة.
- Because You Watched = نفس السلاسل بعد تخطي أول عنصر.
- Character Orbit = السلاسل نفسها، واسم الشخصية أول كلمة من اسم السلسلة.
- Coming Soon = السلاسل نفسها مع badge، بلا release date.
- Feature Banner = أول سلسلة.
- Audio Rail = `experiences` وليس audio catalog.

مع catalog صغير، تكرار نفس بطاقتين في معظم rails نتيجة حتمية، وليس مجرد عيب spacing.

### 7.2 لماذا بدت الشاشة صغيرة ومكدسة يمينًا؟

- **[ملاحظ بصريًا]** الصور تعرض محتوى في جزء صغير يمينًا وفراغًا مركزيًا كبيرًا، وقد يكون browser zoom منخفضًا أو build قديمًا.
- **[مؤكد بالكود]** كثير من rails والبطاقات تستخدم أبعادًا ثابتة، وتفرق فقط بين `isTelevision` وtouch، لا بين medium/expanded.
- **[مؤكد بالكود]** `AppBreakpoints` يغير padding فقط في كثير من السياقات؛ لا يضمن grid أو max content width أو زيادة أحجام البطاقات حسب المساحة.
- اتجاه بداية rail من اليمين صحيح في RTL؛ الحل ليس عكسه LTR، بل توزيع المساحة وإعادة التركيب وإزالة التكرار.

### 7.3 قصة «بيت الطائر»

هناك ثلاثة شروط مختلفة يجب عدم خلطها:

1. **النشر:** public API يعرض `published` فقط؛ draft/غير مكتملة لن تظهر.
2. **العمر:** قصة مصنفة 3–5 يجب ألا تظهر تلقائيًا لملف 6–8. هذا سلوك صحيح، ولا ينبغي توسيع العمر فقط لإجبار الظهور.
3. **الاكتشاف:** تم إصلاح إدراج story في filtering والبحث وHome v2، لكن الإنتاج `/` ما زال يحتاج توحيد النسخة، وHome v1 يجب ألا يتوقف إذا لا توجد series.

معيار الاختبار الصحيح: ملف عمره ضمن 3–5 + قصة published + pages/cover جاهزة + query «بيت» يجب أن يعيد القصة. ملف 6–8 يجب أن يظهر له سبب عدم الأهلية في أدوات admin/QA، لا أن يتجاوز الفلتر.

### 7.4 Search المستهدف

- نتائج cards بصور ونوع المحتوى والعمر والمدة/عدد الصفحات.
- tabs أو filters: الكل، مشاهدة، قصص/كوميكس، صوت، ألعاب.
- normalization عربي: الهمزات، الياء/الألف المقصورة، التشكيل، المسافات.
- typo tolerance واقتراحات، ranking يبدأ exact title ثم prefix ثم tags/description.
- eligibility filtering على server والعميل، مع عدم كشف draft.
- recent searches آمنة ومحلية، وempty state مقترح بدل صفحة فارغة.

---

## 8. Responsive وDesktop وTV

### الوضع الحالي

`app_main/lib/core/layout/app_layout.dart` يعرف:

- compact حتى 599px.
- medium حتى 1023px.
- expanded بعد ذلك.
- الشاشة القصيرة حتى 479px تعامل compact.
- page padding = 18/32/52.

هذا أساس صحيح، لكنه لا يكفي وحده. كثير من الصفحات تستخدم fixed heights، `maxLines + ellipsis`، أو binary `isTelevision`.

### المطلوب حسب الفئة

| الفئة | التكوين المطلوب |
|---|---|
| Compact phone | rail/card كبيرة للمس، أزرار واضحة، صفحة قصة واحدة، controls لا تغطي النص، دعم portrait/landscape |
| Medium/tablet | بطاقات أكبر أو grid/rail هجين، max line length، pane اختياري للتفاصيل، لا تمديد phone UI فقط |
| Expanded desktop/web | content canvas بعرض منطقي 1200–1440 تقريبًا، hero حقيقي، grids متعددة الأعمدة، عدم ترك 80% من الشاشة فارغًا |
| TV | shell مستقل بالقدرات والمدخلات، overscan-safe margins، نص وبطاقات أكبر، focus ring قوي، D-pad كامل، لا اعتبار كل شاشة عريضة TV |

### مصفوفة التحقق المطلوبة

- Widths: 320، 360، 600، 768، 1024، 1366، 1920.
- portrait وlandscape حيث ينطبق.
- browser zoom 100% ثم 200% للنص/zoom.
- Arabic RTL وEnglish LTR ومحتوى mixed direction.
- touch، mouse/keyboard، وD-pad.
- لا overflow أو clipping أو نص أقل من الحجم المقروء، ولا action يعتمد hover أو gesture فقط.

---

## 9. RTL وLocalization

### الجيد

- استعمال `EdgeInsetsDirectional` و`PositionedDirectional` في مواضع كثيرة.
- اتجاه بداية rails يمينًا مناسب للعربية.
- خط Readex Pro محلي ومعلن بترخيص OFL في `app_theme.dart`، ولا يعتمد runtime download.

### الناقص

- Settings تعرض Arabic read-only رغم وجود ar/en.
- story language chips ثابتة وليست مشتقة من المحتوى.
- strings عربية hardcoded بكثافة، ما يمنع ترجمة chrome بصورة متسقة واكتشاف missing keys.
- لا سياسة fallback صريحة تفرق بين «الترجمة غير منشورة» و«خطأ شبكة» و«لا يوجد هذا المحتوى».
- raw objective IDs وreward keys/source IDs تظهر للمستخدم بدل localized names/artwork.
- يجب عدم عكس media play icon أو الزمن لمجرد RTL؛ أما arrows الخاصة بالصفحات فتتبع reading model الصريح.

### السياسة المقترحة

- app chrome في localization catalogs بمفاتيح semantic.
- editorial content من API، مع `available_languages`, default، وحالة publication لكل لغة.
- fallback معلن للمستخدم؛ لا تعرض العربية تحت اختيار English بصمت.
- أرقام/مدد/تواريخ من formatter محلي، لا concatenation ثابت.
- اختبار mixed Arabic/Latin/URLs والأرقام مع Readex Pro وtext scale كبير.

---

## 10. Accessibility

### نقاط جيدة موجودة

- `AppTheme` يضع body 15–17px وأزرارًا رئيسية بارتفاع 50px.
- Home يحتوي بعض focus order/autofocus للتلفاز.
- Playback يحتوي shortcuts/D-pad ودعم captions وتقدم.
- Portal يحترم `MediaQuery.disableAnimationsOf` ويملك reduced-motion grid.
- بعض الصور/الكواكب والـfallback notices لها semantics/live region.

### المخاطر المؤكدة

- عدد كبير من widgets يتجاوز الثيم بأحجام 9، 10، 10.5، 11، 11.5، 12px.
- بعض header actions ارتفاعها 40px، وأهداف GestureDetector غير مضمونة كحد لمس/semantics.
- قارئ القصة لا يستخدم `altText` ولا keyboard/D-pad ولا controls مرئية كافية.
- Portal يعتمد السحب والضغط في الوضع المتحرك؛ العناصر المداريّة GestureDetectors بلا نموذج focus/keyboard مكافئ واضح.
- fixed heights وellipsis قد تكسر 200% text scaling.
- captions في playback لا تملك language selection، والtoggle قد يظهر بلا track.
- صور المحتوى تحتاج تحديد decorative مقابل meaningful وعدم تكرار الإعلان.

### اختبارات لا بد منها قبل ادعاء WCAG

1. TalkBack Android وVoiceOver iOS على Home/Search/Reader/Playback/Parent PIN.
2. Keyboard فقط على web، وD-pad فقط على TV.
3. 200% text/zoom، reduced motion، high contrast إن أمكن.
4. قياس contrast للنص فوق hero/images والحالات focused/disabled.
5. ترتيب القراءة/focus بالعربية والإنجليزية.
6. التأكد أن كل gesture له زر أو action بديل.

---

## 11. حالات Loading / Empty / Error / Offline

| السطح | المشكلة | الحالة المطلوبة |
|---|---|---|
| Home | empty مبني على series فقط | empty حسب كل أنواع المحتوى، stale/local fallback واضح، retry |
| Story Reader | أخطاء fetch تتحول إلى `[]`، واللغة قد تبقي المحتوى القديم | typed error، missing translation منفصلة، skeleton، retry، عدم خلط اللغات |
| Planets | قائمة فارغة → `SizedBox.shrink()` | رسالة مرئية، اقتراح رجوع/تحديث |
| Child Switcher | error/empty → demo child | فصل demo/empty/offline/error |
| Game | raw `'$error'` للطفل | رسالة بسيطة + retry، والتفاصيل التقنية للـlogs فقط |
| Playback | error text بلا retry واضح | Retry/Back/Report، وحالة entitlement منفصلة عن network |
| Account | placeholders `—` بلا تفسير | loading ثم empty/error، لا خلط «غير موجود» و«فشل الطلب» |
| Downloads | ready بلا action | Open/Play، expired/license state، storage error/action |
| Portal planets | count صفر غير محمي | empty mode آمن أو تعطيل «اكتشف» |

---

## 12. المحتوى والنشر ومصادر البيانات

### فجوات العقد والنشر

- public stories صحيحة في إخفاء غير المنشور، لكن readiness يجب أن تشمل cover/pages/language/audio لا status فقط.
- bubbles/audio tracks الموجودة إداريًا ليست جزءًا من public contract الموحد.
- لا contract واضح يضمن توافق story IDs وbook IDs وseries IDs مع route واحد.
- LocalCatalog للألعاب ليس بديلًا آمنًا عن IDs الخادم.
- demo session/token/data يجب أن تكون namespace مستقلة وصريحة، لا fallback عام.

### بوابة نشر مقترحة للقصة

لا تصبح القصة `published` إلا إذا اجتازت:

- title/description/cover والعمر والنوع.
- لغة افتراضية منشورة.
- صفحة واحدة على الأقل، وكل page لها image صالح وorder فريد.
- alt text حسب السياسة التحريرية.
- إن كانت «اقرأ لي»: track كامل لكل الصفحات أو توضيح أنها partial؛ لا تفعيل الزر باستخدام `any(hasAudio)`.
- إن كانت comic panels: panel geometry وreading order وbubbles منشورة.
- preview آلي على compact/medium/expanded وRTL.
- content version محدث لإبطال cache.

---

## 13. خارطة الإصلاح المقترحة

الترتيب التالي ترتيب اعتماد، وليس تقدير مدة ملزمًا.

### المرحلة 0 — Release Gate والحقيقة الوظيفية

1. حماية `/parent` وكل parent-sensitive routes بإثبات PIN موثوق قصير العمر.
2. حذف fail-open المحلي للـPIN.
3. قصر demo children/tokens على demo session صريحة.
4. إخفاء أو تعطيل كل CTA غير موصل بوضوح بدل جعله يبدو عاملًا.
5. فصل typed loading/empty/offline/error في reader/children/planets/game.
6. اختيار Home production واحدة وإيقاف الاختلاف الصامت بين `/` و`/home-v2`.

### المرحلة 1 — القصص والكوميكس والصوت متعدد اللغات

1. اعتماد public content contract للقصة/الصفحة/panel/bubble/audio track/timing.
2. تحديث DTO/domain/repository من دون فقد `timing_cues`.
3. typed route للقصة بدل `:seriesId` العام.
4. بناء single/spread/panel renderers.
5. language + narrator selectors مبنيان على tracks الفعلية.
6. audio completeness policy ومزامنة timing/highlight.
7. offline package والتقدم المحلي/المتزامن.
8. semantics/keyboard/D-pad/text scaling للقارئ.

### المرحلة 2 — Home/Search/Planets/Media

1. تحويل كل Home block إلى query حقيقية، أو حذفه.
2. deduplication وترتيب content editorial/personalized واضح.
3. Home لا تعتمد على series كشرط وجود وحيد.
4. Search بصري مع server search وArabic normalization/ranking.
5. ربط Planets بالحلقات والألعاب الفعلية.
6. adaptive Series Details وShorts مخصصة فعلًا.
7. جعل playback quality/autoplay/captions حقيقية، وإكمال Audio Player.
8. إضافة Open/Play للتنزيلات ودعم أنواع media المعلنة فقط.

### المرحلة 3 — الوالد والحساب والتجارة والدعم

1. ربط `/auth/me` وتحرير البيانات وتغيير كلمة المرور/استعادتها.
2. فصل إعدادات الطفل عن إعدادات الوالد وربط consumers.
3. billing purchase/manage أو إخفاء الوعود التجارية حتى الجاهزية.
4. FAQ/report/suggest وقنوات دعم حقيقية.
5. صفحة Terms منفصلة، ومطابقة privacy claims لأدوات حذف/تصدير/analytics فعلية.
6. ربط time limits/schedules وإظهار أسماء objectives/rewards المترجمة.

### المرحلة 4 — TV والوصول والصقل

1. pairing endpoint آمن وQR/code قصير العمر.
2. TV shell بoverscan/focus restoration/traversal واختبار remote.
3. إعادة تركيب كل الشاشات على compact/medium/expanded بدل تكبير ثابت.
4. توحيد typography والتباين والحالات المرئية.
5. screen-reader/keyboard/D-pad/200% text/manual contrast pass.
6. visual regression للـviewport matrix بالعربية والإنجليزية.

---

## 14. معايير القبول

### الحماية

- فتح `/parent` أو `/account` أو `/devices` أو `/membership` أو عمليات privacy الحساسة بلا proof يعيد إلى PIN.
- فشل الشبكة أثناء التحقق لا يمنح الوصول.
- انتهاء مدة proof أو تبديل الطفل يلغي الوصول الحساس.
- لا يظهر demo child أو demo token في حساب حقيقي عند empty/error.

### القارئ والكوميكس

- قصة single تعرض صورة واحدة؛ spread لا يظهر إلا بmetadata صريحة؛ panel mode يتبع `reading_order`.
- قصة لها العربية والإنجليزية وصوتان تعرض الخيارات الفعلية فقط، وتحفظ اختيار اللغة/الراوي.
- اختيار لغة بلا ترجمة يعرض «غير متاحة» ولا يبقي نص/صوت اللغة السابقة.
- زر «اقرأ لي» لا يظهر كمتاح إلا إذا policy اكتمال الصوت مستوفاة.
- الصورة لها semantic description؛ السابق/التالي/play/pause يعمل باللمس والkeyboard/D-pad.
- 200% text لا يخفي controls أو النص الأساسي.
- timing cues، إن كانت موجودة، تبرز الجملة/bubble الصحيحة ضمن tolerance متفق عليه.

### Home والبحث

- Home تعرض stories إذا كانت series صفرًا.
- لا تعرض progress/ranking/reminder غير حقيقي.
- لا يتكرر العنصر في rails متجاورة إلا بقرار editorial موثق.
- بحث «بيت» يعيد قصة «بيت الطائر» عندما تكون published وملف الطفل ضمن العمر.
- ملف 6–8 لا يتلقى قصة 3–5، ويستطيع QA/admin رؤية سبب الاستبعاد.
- كل نتيجة لها صورة، نوع، وحالة action واضحة.

### Responsive/RTL/TV

- لا overflow/clipping عند 320–1920px وعند 200% text.
- desktop يستخدم مساحة مفيدة من دون تمديد سطور النص أو ترك كتلة المحتوى في 15% من العرض.
- Arabic RTL له reading/focus order منطقي، وEnglish LTR يعاد تركيبه لا مجرد قلبه.
- TV يمكن إكمال Home→Details→Playback وHome→Reader بالـD-pad فقط مع focus ظاهر.
- لا يتم استنتاج TV من العرض وحده.

### الميديا والحساب

- quality تبدل stream/bitrate فعلًا أو تزال من UI.
- autoplay يحترم الإعداد، captions تظهر فقط عند وجود tracks مع اختيار لغة.
- download ready يفتح المحتوى، وlicense expiry له recovery واضح.
- الحساب يعرض بيانات `/auth/me` أو error صريح، لا `—` دائمًا.
- أي CTA شراء/دعم/تغيير كلمة مرور إما يعمل end-to-end أو يظهر disabled مع شرح غير مضلل.

---

## 15. خطة التحقق قبل الإطلاق

1. **Static:** `dart format --output=none --set-exit-if-changed` للملفات المعدلة، ثم `flutter analyze`.
2. **Behavior tests:** route guards/PIN، language switch stale prevention، content eligibility، reader mode mapping، Home non-series content، game ID resolution.
3. **Widget/golden tests:** Home/Search/Reader/Details عند compact/medium/expanded وar/en وtext scale 1.0/2.0.
4. **Integration:** login→child→story→language/voice→resume؛ parent PIN؛ download→offline open؛ playback captions/quality.
5. **Manual accessibility:** TalkBack، VoiceOver، keyboard، D-pad، reduced motion، contrast.
6. **Content QA:** published/draft، ages 3–5 و6–8، missing translation، partial audio، spread/panels، broken image/audio.
7. **Build smoke:** Android/Web/iOS المتاحة وTV target الفعلي؛ build pass لا يغني عن السيناريوهات السابقة.

---

## 16. فهرس الأدلة الرئيسية

- Routes/guards: `app_main/lib/app/router/app_router.dart`
- Breakpoints: `app_main/lib/core/layout/app_layout.dart`
- Theme: `app_main/lib/app/theme/app_theme.dart`
- Home v1: `app_main/lib/features/home/presentation/widgets/home_feed.dart`
- Home v2 model/shell/tokens/billboard:
  - `app_main/lib/features/home/presentation/v2/home_feed_model.dart`
  - `app_main/lib/features/home/presentation/shells/adaptive_home_shell.dart`
  - `app_main/lib/features/home/presentation/v2/home_v2_tokens.dart`
  - `app_main/lib/features/home/presentation/v2/home_billboard.dart`
- Portal: `app_main/lib/features/home/presentation/widgets/majarra_portal.dart`
- Profile destination: `app_main/lib/features/home/presentation/widgets/home_destinations.dart`
- Child filtering: `app_main/lib/features/child/application/child_provider.dart`
- Search: `app_main/lib/features/search/presentation/search_page.dart`
- Story DTO/domain:
  - `app_main/lib/features/home/data/content_dtos.dart`
  - `app_main/lib/features/home/domain/content_models.dart`
- Reader: `app_main/lib/features/reader/presentation/pages/story_reader_page.dart`
- Story public/admin APIs:
  - `dashboard/api/src/routes/stories.ts`
  - `dashboard/api/src/routes/adminContent.ts`
  - `dashboard/api/src/routes/adminStories.ts`
- Audio: `app_main/lib/features/audio/presentation/pages/audio_player_page.dart`
- Planets: `app_main/lib/features/planets/presentation/planets_page.dart`
- Shorts: `app_main/lib/features/shorts/presentation/shorts_page.dart`
- Details: `app_main/lib/features/details/presentation/series_details_page.dart`
- Playback: `app_main/lib/features/playback/presentation/playback_page.dart`
- Watchlist/downloads/account/membership/settings/support/privacy: الصفحات المناظرة تحت `app_main/lib/features/profile/presentation/pages/`
- Games/studio: `game_route.dart` و`creative_studio_page.dart` والـcollection route/page.
- TV: `app_main/lib/features/tv/presentation/pages/tv_pairing_page.dart`

---

## 17. الخلاصة النهائية

المشكلة التي ظهرت في صفحة القصة مثال صحيح على خلل أوسع: **الواجهة تعرض تصنيفات ووعودًا أكثر من القدرات المكتملة خلفها.** الأولوية ليست تجميل القارئ الحالي فقط، بل إكمال السلسلة كلها: نموذج البيانات → public API → publication readiness → Flutter models → renderer → اللغة/الراوي → حالات الخطأ/offline → accessibility.

الترتيب الآمن هو: **إغلاق بوابة الوالد أولًا، ثم بناء قارئ الكوميكس والصوت المتعدد كميزة كاملة، ثم تصحيح Home/Search والروابط الوهمية، وبعدها الحساب/التجارة/الدعم وTV والصقل.** بهذا الترتيب لا نجمّل surfaces ما زالت صلاحياتها أو بياناتها أو أفعالها غير صحيحة.

---

## 18. سجل التنفيذ النهائي والحالة الحالية

**تاريخ التحديث:** 11 أغسطس 2026
**مرجعية الحالة:** هذا القسم هو سجل الحالة الأحدث. الأقسام السابقة باقية بوصفها baseline للتدقيق وليست ادعاءً بأن كل عيب ما زال قائمًا.

### 18.1 معنى الحالات

- **Implemented:** نُفذ الإصلاح المطلوب على مستوى الكود والعقد المتاح، واجتاز التحقق الآلي ذي الصلة.
- **Honest limitation:** أُزيل السلوك المضلل أو نُفذ الجزء الممكن، لكن القدرة الأوسع غير موجودة ويُصرح بذلك في الواجهة بدل ادعائها.
- **External blocker:** الإكمال end-to-end يحتاج API أو عقد بيانات أو تكامل منصة غير موجود في المستودع الحالي.
- **Requires manual verification:** توجد معالجة على مستوى الكود، لكن إثبات النتيجة يحتاج جهازًا أو viewport أو قارئ شاشة أو بيانات إنتاج فعلية.

لا تعني **Implemented** اجتياز WCAG أو visual QA أو صحة بيانات الإنتاج؛ هذه ادعاءات منفصلة لم تُثبت في هذه المراجعة.

### 18.2 Traceability — P0

| ID | الحالة | ما نُفذ وما بقي |
|---|---|---|
| P0-01 | **Honest limitation** | أضيف إثبات وصول والد قصير العمر، وربطت به تحويلات الراوتر للمسارات الحساسة بدل الاكتفاء بالمصادقة العامة. يبقى غياب credential خادمي مستقل ومحدد الصلاحية للوالد؛ بعض العمليات يفرض الخادم عليها auth فقط، لذلك لا يُدّعى أن حد الثقة server-side اكتمل. |
| P0-02 | **Implemented** | أزيل قبول PIN المحلي عند فشل الشبكة من المسار الحساس؛ الفشل لا يمنح وصولًا، وحالة الإثبات المحلية محدودة العمر وتُلغى مع تغيّر السياق ذي الصلة. |
| P0-03 | **Implemented** | صُنفت وجهات الحساب والأجهزة والعضوية والإعدادات والخصوصية ولوحة الوالد كوجهات حساسة، وأصبحت تمر عبر بوابة الوالد بدل ظهورها كوجهات طفل غير محمية. |

### 18.3 Traceability — P1

| ID | الحالة | ما نُفذ وما بقي |
|---|---|---|
| P1-01 | **Implemented** | وُسع عقد القصص في API وDTO/domain ليحمل أوضاع العرض واللوحات والفقاعات وترتيب القراءة وبيانات التوقيت/المسارات بدل إسقاطها، وأصبح القارئ يختار renderer بحسب metadata بدل معاملة كل قصة كصورة واحدة. |
| P1-02 | **Implemented** | تبديل اللغة صار انتقال حالة typed؛ لا تُعتمد اللغة الجديدة قبل نجاح جلبها، وتوجد حالات loading/missing/error/retry من دون إبقاء صفحات اللغة السابقة تحت اختيار جديد. |
| P1-03 | **Implemented** | فُصلت مسارات القراءة بحسب نوع المورد، وأصبح resolve يرفض المورد غير المناسب بدل فتح قارئ فارغ بمعامل `seriesId` غامض. |
| P1-04 | **Implemented** | لم تعد حالة Home الفارغة تعتمد على `series` وحدها؛ الأنواع المتاحة تُعرض مستقلًا ولا تختفي القصص/الكتب عند غياب السلاسل. |
| P1-05 | **Implemented** | أزيلت أو أخفيت الأقسام التي كانت تصطنع progress/ranking/reminder، وربطت الأقسام الباقية بمصادر حقيقية مع تقليل التكرار وعدم تقديم أول عناصر catalog كتخصيص مزعوم. |
| P1-06 | **Implemented** | وُحد مسار Home الإنتاجي مع التنفيذ المحسن بدل إبقاء `/` و`/home-v2` بقدرات متعارضة للمستخدم النهائي. |
| P1-07 | **Implemented** | أصبحت Planets مبنية على بيانات الخادم، مع فصل loading/error/empty/retry، وربط الحلقة القابلة للتشغيل بالـplayback واللعبة المدعومة بمسارها، وتعطيل غير المتاح بوضوح. |
| P1-08 | **Implemented** | أصبحت الألعاب المكتشفة مبنية على IDs الخادم وعقد engine/version صريح، وربط `/studio` والاستكمال والمجموعة/reference، مع retry ورسائل طفل آمنة بدل raw errors. لا يمكن إثبات تطابق صفوف الإنتاج من دون D1 الحية. |
| P1-09 | **Implemented** | قُصر demo child/fallback على جلسة demo صريحة، وفُصلت empty/offline/error للحساب الحقيقي مع retry بدل إدخال طفل وهمي. |
| P1-10 | **Honest limitation** | خيارات اللغة والمسارات الصوتية أصبحت مشتقة من البيانات الفعلية ولا تُختلق. لا يوجد في العقد الحالي narrator/voice catalogue معتمد، لذلك لا يظهر selector وهمي للراوي؛ إضافة رواة متعددين **External blocker** حتى يتوفر العقد والبيانات. |
| P1-11 | **Requires manual verification** | أضيفت controls مرئية وSemantics ووصف الصورة واختصارات keyboard/D-pad وfocus ظاهر وحالات صوت معلنة. التحليل والاختبارات الآلية نجحا، لكن TalkBack/VoiceOver وremote فعلي وقراءة ترتيب اللوحات تحتاج اختبار أجهزة يدويًا. |

### 18.4 Traceability — P2

| ID | الحالة | ما نُفذ وما بقي |
|---|---|---|
| P2-01 | **Honest limitation** | تحوّل البحث إلى نتائج بصرية مصنفة، مع recent searches آمنة، وتطبيع عربي واكتشاف الأنواع القابلة للملاحة. البحث ما زال على catalog المحمّل المتاح للعميل؛ لم يُخترع server ranking أو ادعاء fuzzy production غير موجود. |
| P2-02 | **Implemented** | Series Details تعيد تركيب العرض حسب المساحة، تفصل error/not-found، تستخدم أول حلقة قابلة للتشغيل، وتعطل الأفعال غير المتاحة بدل Snackbar نجاح مضلل. |
| P2-03 | **Honest limitation** | لم يعد السطح يدعي أنه منصة Shorts مستقلة؛ سُمي «مقاطع الحلقات» ويعرض حلقات قابلة للتشغيل فقط، مع D-pad ومؤشر bounded وSemantics. إنشاء short-form feed حقيقي يحتاج metadata/query مخصصة غير موجودة. |
| P2-04 | **Implemented** | احترم playback إعداد autoplay-next، ويعرض التشغيل اليدوي عند تعطيله؛ captions مرتبطة بملفات فعلية؛ أزيل اختيار الجودة/الصوت الذي لا يغير المصدر؛ عقد الجلسة المحمية يمرر `authorization` كما أعاده Worker ولا يرجع إلى raw catalog URL. |
| P2-05 | **External blocker** | controls الأساسية والـseek/speed وحالات الخطأ والاستجابة تحسنت، لكن narrator/chapters/transcript/background والـlock-screen audio تحتاج عقد بيانات وتكامل audio session غير موجودين. لا يُعرض نجاح وهمي لهذه القدرات. |
| P2-06 | **Honest limitation** | التنزيلات أصبحت child-scoped، responsive، ذات Semantics، وتفتح public audio الجاهز مع حالات expiry/error واضحة. تنزيل private video/narration متوقف عمدًا لغياب offline-media license endpoint. |
| P2-07 | **Honest limitation** | حُفظت القائمة وعُزلت حسب الوالد+الطفل مع persisted outbox ومزامنة قابلة لإعادة المحاولة، وسُميت بصدق «المسلسلات المحفوظة». لم يُدّع دعم story/book/episode قبل وجود typed union خادمي. |
| P2-08 | **Honest limitation** | صفحة الحساب تجلب `family.display_name` من `/family/state` مع loading/error/retry، وأزيل email/phone/password الوهمي. تحديث الملف والبريد والهاتف وكلمة المرور وحذف الحساب/الطفل غير ممكن end-to-end لغياب endpoints المستهلك المطلوبة. |
| P2-09 | **External blocker** | حالة العضوية والحدود تعرض بيانات حقيقية مع error/retry، والشراء/الإدارة معطلان بشرح صريح. لا يوجد Flutter purchase/manage billing client؛ verify backend وحده لا يكفي لبناء شراء آمن. |
| P2-10 | **External blocker** | أزيل وعد الرد خلال 24 ساعة وأي CTA نجاح غير موصل. FAQ/report/suggest/contact للمستهلك تحتاج خدمة ومسارات دعم حقيقية غير موجودة. |
| P2-11 | **Honest limitation** | نُقحت نسخة الخصوصية لتطابق القدرات الحالية، ولم تعد «الشروط» تفتح صفحة الخصوصية. حذف/تصدير البيانات وanalytics opt-out وصفحة Terms المعتمدة ما زالت حواجز خارجية ولا تدعي الواجهة توفرها. |
| P2-12 | **Honest limitation** | صار autoplay مستهلكًا فعليًا، وأزيلت quality/notifications التي لم يكن لها consumer. العربية هي اللغة الوحيدة القابلة للاختيار لأن بقية catalog/واجهة التطبيق ليست مكتملة؛ لا تُكشف English الجزئية كخيار منتج كامل. |
| P2-13 | **Honest limitation** | Login/Register أصبحا `Form` مع inline validation وautofill وconfirm password وقواعد وإدارة controllers، وmetadata المنصة/الجهاز حقيقية، مع installation UUID عشوائي غير PII وتدفق verify/resend للبريد. استعادة/تغيير كلمة المرور للمستهلك تبقى معطلة لغياب endpoint حقيقي. |
| P2-14 | **Honest limitation** | حُميت لوحة الوالد وأصبحت الحالات المتاحة صادقة، لكن time limits/schedules وبعض تقارير الأهداف ليست workflow مكتملًا في العقد الحالي؛ لم تُعرض كعمليات ناجحة وهي غير موصلة. |
| P2-15 | **External blocker** | TV pairing يظل غير متاح بوضوح؛ لا endpoint ولا code/QR قصير العمر، ولم يُنشأ pairing شكلي محلي. |
| P2-16 | **Implemented** | رُبطت أفعال Portal بالوجهات الحقيقية أو عُطلت بوضوح، وأضيف focus/keyboard behavior واستجابة أفضل بدل الاعتماد على drag/tap وSnackBars فقط. |
| P2-17 | **Implemented** | وضع الكواكب يحمي القائمة الفارغة ولا ينفذ قسمة/modulo أو وصولًا إلى عنصر غير موجود. |
| P2-18 | **Implemented** | أزيل تراكم listeners في حركة snap للبوابة وأصبحت دورة animation/listener مضبوطة وقابلة للتخلص. |
| P2-19 | **Requires manual verification** | أضيفت إعادة تركيب/max-width وWrap/scroll واتجاهات RTL للصفحات المتأثرة، وأزيل text-scale clamp، وحُسن focus التلفاز. مصفوفة 320–1920px و200% وoverscan لم تُنفذ على أجهزة فعلية. |
| P2-20 | **Honest limitation** | نُقلت النصوص المتأثرة إلى catalogs ووُلدت ملفات l10n، وأزيلت النسخ المضللة. ما زالت أجزاء قديمة تحتوي نصوصًا عربية مباشرة؛ لا يُدّعى اكتمال English/FR أو localization repository-wide. |

### 18.5 Traceability — P3

| ID | الحالة | ما نُفذ وما بقي |
|---|---|---|
| P3-01 | **Requires manual verification** | أزيل قيد text-scale، وحُسنت القيود المرنة وmax-width في الأسطح المتأثرة. توحيد كل typography وقياس القراءة/التباين يحتاج visual pass كامل. |
| P3-02 | **Implemented** | وُحدت حالات loading/empty/error/retry ورسائل الطفل في القارئ وHome وPlanets والألعاب والحساب والأسطح المعدلة، ولم تعد الأخطاء الخام تُعرض في release. |
| P3-03 | **Honest limitation** | وُحدت disabled/focus/pressed وSemantics للبطاقات المتأثرة، لكن artwork الصوتي والبيانات التحريرية لا يمكن اختلاقهما عند غيابهما من المصدر. |
| P3-04 | **Honest limitation** | أزيلت أفعال المشاركة التي لا تنتج رابطًا صالحًا أو عُطلت بوضوح؛ إنشاء universal/deep-link production مع domain association لم يُثبت ضمن هذا النطاق. |
| P3-05 | **Implemented** | صُححت التسميات لتصف القدرة الفعلية، ومنها «المسلسلات المحفوظة» و«مقاطع الحلقات»، وفُصلت أنواع القصة/الكتاب/الكوميكس في الاكتشاف حيث يدعم العقد ذلك. |
| P3-06 | **Honest limitation** | بقي logging ضمن allowlist خالٍ من PII/signed URLs، وأضيفت/استُخدمت أحداث للقدرات المتاحة. لا يوجد analytics opt-out ولا ادعاء coverage لكل تفاعل أو تحقق من pipeline إنتاجي. |
| P3-07 | **Implemented** | أزيلت الوعود الموسمية/قريبًا المصطنعة من تجربة الإنتاج أو أصبحت لا تظهر إلا مع بيانات صالحة؛ لم يعد hardcoded catalog يقدم نفسه كجدول نشر حي. |

### 18.6 مطابقة معايير القبول

| مجموعة القبول | النتيجة الحالية |
|---|---|
| حماية المسارات الحساسة وfail-closed وdemo isolation | **محققة على مستوى Flutter/الراوتر والتخزين المحلي.** حد والد server-scoped مستقل ما زال غير متوفر، ولذلك لا يعد هذا إثبات authorization end-to-end للخادم. |
| single/spread/panels واللغة وعدم إبقاء محتوى قديم | **محققة على مستوى العقد والـrenderer وحالات Flutter.** narrator وتوقيت/جودة المحتوى الفعلي يعتمدان على بيانات منشورة، والاختبار البصري/الصوتي اليدوي ما زال مطلوبًا. |
| Home بلا series، ومنع الوعود الوهمية، وربط البحث والوجهات | **محققة في الكود** مع بقاء التحقق من بيانات الإنتاج ممنوعًا لعدم قراءة D1 الحية. |
| Quality/autoplay/captions | **محققة بصدق:** autoplay مستهلك، captions فعلية عند وجود track، والـquality غير القابلة للتبديل أزيلت بدل تزويرها. |
| Downloads/Watchlist | **محققة ضمن النطاق المعلن:** public audio للتنزيل وseries-only للحفظ؛ private offline وأنواع favorites الأخرى ليست مدعاة. |
| الحساب/العضوية/الدعم/legal | **جزئية وصادقة:** القراءة المتاحة تعمل، أما update/delete/export/reset/purchase/support/Terms فمعطلة أو غير معروضة كقدرات مكتملة. |
| Responsive/RTL/TV/accessibility | **معالجة كوديًا وغير مثبتة يدويًا.** لا ادعاء WCAG 2.2 AA أو اكتمال viewport/remote matrix. |

### 18.7 الحواجز الخارجية والقيود غير القابلة للحل الصادق داخل UI وحده

1. لا endpoints مستهلك حقيقية لاستعادة/تغيير كلمة المرور.
2. لا email/phone/profile update، ولا حذف حساب/طفل، ولا تصدير progress.
3. لا analytics opt-out contract.
4. لا private offline-media license endpoint.
5. لا consumer support/report/FAQ service.
6. لا وثيقة أو route معتمد للشروط والأحكام.
7. لا narrator catalogue أو chapters/transcript/background-audio contract.
8. لا Flutter purchase/manage billing client.
9. لا parent-scoped server credential مستقل للعمليات الحساسة؛ الحماية الحالية في العميل قصيرة العمر والخادم يفرض auth فقط على بعض العمليات.
10. لا TV pairing endpoint أو QR/code protocol.
11. لا يمكن إثبات game IDs أو اكتمال/صحة محتوى الإنتاج من دون D1 الحية، واستعلامها مستبعد عمدًا من هذا التدقيق.

### 18.8 ما يحتاج تحققًا يدويًا قبل الإطلاق

- TalkBack على Android وVoiceOver على iOS، وقارئ شاشة/keyboard على الويب.
- TV D-pad وfocus restoration وoverscan على جهاز/محاكي هدف فعلي.
- viewports: 320، 360، 600، 768، 1024، 1366، 1920؛ portrait/landscape؛ text/zoom 200%.
- contrast فوق الصور وحالات focus/disabled، وreduced motion.
- قصص single/spread/panels بصور وbubbles وتوقيت وصوت إنتاجي حقيقي.
- تشغيل offline/expiry على جهاز فعلي، وbackground/interruptions للوسائط المتاحة.

### 18.9 سجل التحقق المنفذ فعليًا

| الأمر/الفحص | النتيجة |
|---|---|
| `flutter gen-l10n` | نجح، Exit Code 0. |
| `dart format` للملفات المعدلة | نجح؛ الدفعة الرئيسية نسقت 70 ملفًا وغيّرت 27، ثم نُسقت إصلاحات lint اللاحقة. |
| `flutter analyze --no-pub` | `No issues found!`، Exit Code 0. |
| `flutter test --no-pub` | **275/275 passed**، Exit Code 0. لم تُنشأ اختبارات جديدة. |
| `npm run typecheck:types` داخل `dashboard/api` | نجح (`tsc --noEmit`)، Exit Code 0. |
| اختبارات API المستهدفة بعد إصلاح الفشل | **92/92 passed** (`enginePacks`, `gamePackValidation`, `routeGuards`). |
| `npm test` داخل `dashboard/api` | **932/932 passed**، Exit Code 0. |
| `flutter build web --no-pub --release --no-wasm-dry-run` | نجح وأنشأ `build/web`، Exit Code 0؛ ظهرت معلومات tree-shaking للخطوط فقط. |
| البحث عن النصين القديمين: «بالدخول توافق على الشروط وسياسة الخصوصية» و«فريق مجرة جاهز للإجابة خلال 24 ساعة» في l10n | لا توجد مطابقات. |
| `git diff --check` | Exit Code 0؛ لا أخطاء whitespace، فقط تحذيرات تحويل CRLF→LF في بعض الملفات. |

ظهر أول تشغيل شامل لاختبارات API بفشلين تم إصلاحهما قبل اعتماد النتيجة: استُبدل `anyOf` غير المدعوم بـ`oneOf` المكافئ للنوعين المتنافيين في نسختي schema، وأضيف `requirePermission('edit_metadata')` إلى سبعة مسارات تعديل `adminEpisodeStreaming`. بعد ذلك نجحت الاختبارات المستهدفة ثم المجموعة الكاملة.

### 18.10 حدود التحقق والنزاهة التشغيلية

- لم تُقرأ `dashboard/api/.dev.vars` أو ملفات أسرار، ولم تُستعلم D1 الحية.
- لم يحدث deploy أو commit أو push.
- لم تُحذف أو تُستبدل تعديلات المستخدم، ولم تُستخدم أوامر `reset/checkout/clean`.
- لم تُضف اختبارات جديدة تلقائيًا؛ استُخدمت الاختبارات القائمة فقط.
- نجاح analyze/tests/build يثبت سلامة آلية محدودة، ولا يثبت جودة بصرية أو امتثال WCAG أو صحة بيانات production أو سلوك أجهزة Apple/Android TV الفعلية.
