# مجرة — التفاصيل التقنية وTech Stack

> **المرجع المعتمد:** يخضع هذا المستند لملف [`AGE_EXPERIENCE_PLAN_3_12.md`](./AGE_EXPERIENCE_PLAN_3_12.md)، وهو مصدر الحقيقة النهائي لقرارات العمر والتسجيل والتخصيص والمحتوى. يجب أن تدعم البنية منذ MVP مسارات `preschool` و`kids` و`junior` وعزل كل ملف طفل.

## 1. مبادئ معمارية ملزمة

- MVP يغطي الأعمار 3–12 بثلاثة مسارات: 3–5 `preschool`، و6–8 `kids`، و9–12 `junior`؛ عمر 12 داخل `junior`.
- الحساب لولي الأمر، مع ملف طفل واحد في Free وحتى 4 ملفات في Family وFamily Plus.
- إنشاء الطفل يعتمد على `nickname` و`birth_month` و`birth_year` و`avatar_id` و`interests` الاختيارية.
- الخادم يحسب `age_track` تلقائيًا؛ لا يثق في اختيار من العميل، ويرفض الأعمار دون 3 أو فوق 12.
- كل حالة طفل تحمل `child_id`: الإعدادات والتقدم والإتقان والمحاولات والتقارير والتوصيات والمفضلة والتنزيلات والوقت.
- دخول منطقة ولي الأمر عبر PIN أو biometric؛ يمنع استخدام سؤال حسابي. الموافقة الأبوية سجل مستقل عن بوابة الدخول.
- توصيات MVP Rules-based قابلة للتفسير، بلا AI مفتوح أو خصائص اجتماعية للأطفال.

## 2. تطبيق Flutter

- **Framework:** Flutter لتطبيق Android/iOS واحد مع دعم RTL وإمكانية تخصيص الواجهة حسب المسار.
- **State Management:** Riverpod، مع providers مرتبطة بـ`activeChildId` ويجري invalidation كامل عند تبديل الطفل.
- **Routing:** GoRouter مع حراس منفصلين لـParent Session وChild Session وParental Area.
- **Local Database/Cache:** Hive أو Isar للبيانات غير الحساسة والكاش المفصول باسم `child_id`.
- **Secure Storage:** `flutter_secure_storage` لرموز الجلسة ومواد PIN؛ لا يخزن PIN كنص صريح.
- **Biometric:** `local_auth`، مع PIN كخيار رجوع آمن، وقفل بعد عدد محاولات/زمن محدد.
- **Games:** Flame للمحركات الثنائية البسيطة، مع واجهات إدخال تختلف حسب المسار.
- **Animation:** Rive/Lottie بحركة قابلة للتقليل وفق إعداد Reduced Motion.
- **Localization:** العربية في MVP، وبنية ARB جاهزة للإنجليزية والفرنسية لاحقًا.
- **Media:** مشغل يدعم captions والاستكمال، مع Autoplay معطل افتراضيًا خصوصًا لـ`preschool`.

### فصل تجربة المسارات

يستخدم التطبيق Design Tokens مشتركة وTrack Theme/Configuration بدل نسخ التطبيق:

- `preschool`: صوت أولًا، نص قليل، touch targets كبيرة، لا بحث كتابي افتراضيًا.
- `kids`: عناوين قصيرة، بحث صوتي/موضوعي، تقدم مهاري.
- `junior`: كثافة أعلى، مظهر أقل طفولية، بحث وفلترة ومشروعات.

لا يعتمد إخفاء المحتوى على الواجهة فقط؛ كل استعلام محتوى يطبق العمر والمسار وسماح ولي الأمر على الخادم.

## 3. Backend: Supabase/Postgres

Supabase مناسب لـMVP عبر Auth وPostgres وRLS وStorage وEdge Functions. تُفصل بيئتا Staging وProduction، وتدار الأسرار خارج التطبيق.

### الكيانات الأساسية

```text
parents
children_profiles
child_settings
contents / series / seasons / episodes
skills / learning_objectives / prerequisites
child_progress / child_mastery / child_attempts
child_favorites / child_watchlists / child_downloads
child_reports / child_recommendations
consent_records / policy_versions / deletion_requests / audit_logs
subscriptions / entitlements
```

`children_profiles` يحتوي على:

```text
parent_id
nickname
birth_month
birth_year
age_track     # preschool | kids | junior، محسوب خادميًا
avatar_id
interests
language
onboarding_completed_at
```

### دالة العمر والمسار

- تحسب العمر من الشهر والسنة نسبة إلى تاريخ الخادم.
- تعيد `preschool` للأعمار 3–5، و`kids` للأعمار 6–8، و`junior` للأعمار 9–12.
- ترفض إنشاء ملف خارج 3–12.
- يعاد الحساب دوريًا وعند فتح الجلسة أو تاريخ الانتقال.
- يحفظ انتقال 5→6 و8→9 البيانات، ويدعم تأجيلًا محدودًا/طلب مراجعة بسياسة واضحة.
- فتح محتوى أعلى عمرًا يتطلب قرار ولي الأمر عبر PIN، ولا يغير الطفل مساره.

### RLS والعزل

- كل جدول طفل يحمل `child_id` مع foreign key و`on delete cascade` حين يلزم.
- سياسة الملكية تتحقق من أن `children_profiles.parent_id = auth.uid()`.
- تكتب سياسات `using` و`with check` لكل عمليات القراءة والإنشاء والتعديل والحذف.
- لا تقبل APIs الحساسة `parent_id` من العميل كمرجع ثقة.
- حد 1 أو 4 ملفات يفرض داخل transaction خادمية لمنع السباق.
- توصيات وتقارير ومؤقتات وكاش وتنزيلات منفصلة لكل طفل، ولا تجمع درجات أطفال مختلفين.
- اختبارات RLS تحاول وصولًا متقاطعًا بين حسابين وبين طفلين من الحساب نفسه.

## 4. تصنيف المحتوى والاستعلام

كل محتوى منشور يتضمن:

- `age_min` و`age_max` بين 3 و12.
- `track_ids` واحدًا أو أكثر.
- `reading_level` و`difficulty` و`duration_seconds`.
- أهداف تعلم ومتطلبات سابقة.
- نوع التفاعل ودرجة الحاجة لإشراف ولي الأمر.
- تنبيهات الحساسية أو الخوف أو الأدوات المنزلية.

خط أنابيب النشر يمنع نشر سجل ناقص. استعلام الاكتشاف يرشح بالترتيب: العمر/المسار، سماح ولي الأمر، اللغة، مهارات المراجعة، غير المكتمل، المدة، ثم التنويع. يحفظ سبب التوصية مع `child_id`.

## 5. الجلسات وبوابة ولي الأمر

- **Parent Session:** تنفيذ التسجيل والموافقة والدفع وإدارة الملفات والإعدادات والتقارير.
- **Child Session:** معرف طفل نشط وصلاحيات محدودة للمشاهدة واللعب والقراءة.
- **Parental Area Gate:** PIN مشتق بخوارزمية مناسبة ومخزن بصورة آمنة أو تحقق خادمي عند الحاجة، وbiometric عبر نظام الجهاز.
- لا تعد الموافقة الأبوية ناجحة لمجرد اجتياز PIN/biometric؛ تحفظ الموافقة بإصدار السياسة والتوقيت.
- عند تبديل الطفل: إلغاء الطلبات، تفريغ providers والكاش الحساس، ثم تحميل سياق الملف الجديد.
- الطفل لا يصل إلى الميلاد أو البريد أو الاشتراك أو تغيير المسار.

## 6. العرض متعدد الشاشات

الهاتف والتابلت يستخدمان Flutter shell مشتركة، بينما تستخدم منصات TV Presentation shell بواجهة 10-foot ويمكنها مشاركة domain/data/design tokens مع محولات تشغيل وإدخال أصلية حيث يفرض المتجر أو DRM ذلك.

| النمط | قاعدة الاختيار | متطلبات التخطيط والإدخال |
|---|---|---|
| Compact | أقل من 600 نقطة منطقية | هاتف portrait/landscape، عمود وتنقل سفلي، touch 48dp و64dp لـ`preschool` |
| Medium | 600–1023 | تابلت، شبكة أو master/detail، تنقل جانبي عند الملاءمة |
| Expanded touch | 1024 فأعلى | تابلت كبير، max-width وكثافة حسب المسار |
| TV 10-foot | منصة/ريموت ومسافة مشاهدة، لا العرض وحده | landscape، safe area، Focus حتمي، D-pad/Back/Play/Pause، استعادة Focus، بلا touch/hover |

- تفصل `responsive_layout` عن `input_mode` وعن `age_track`؛ قد تكون شاشة كبيرة Touch وليست TV، وقد يحتاج TV إلى حجم منطقي مختلف.
- يستخدم TV ربط QR/رمز قصير من Parent Session على الهاتف. لا تكتب كلمات مرور طويلة ولا تنفذ موافقة أو شراء داخل Child Session.
- تختبر RTL وtext scaling وcaptions وReduced Motion وportrait/landscape و1080p/4K وoverscan/safe areas وريموت فعلي.
- وحدات Flutter المقترحة: `core/devices`، و`core/entitlements`، و`core/media_protection`، و`app/presentation_shells`، و`features/parent/devices`، مع adapters لكل منصة.

## 7. الفيديو والتنزيل وحماية الالتقاط

- استخدام مزود بث يدعم transcoding وAdaptive Bitrate و480p/720p/1080p عند الحاجة وcaptions وthumbnails وMulti-DRM.
- **Widevine** لـAndroid/Android TV والمنصات المتوافقة، و**FairPlay** لـiOS/iPadOS/tvOS، و**PlayReady** حيث تتطلب منصة TV/ويب مختارة. لا يعتمد اسم DRM وحده قبل إثبات دعم الجهاز والمزود في Phase 0.
- المحتوى المحمي يستخدم HLS/DASH مشفرًا، key rotation، license server، تراخيص online/offline قصيرة العمر، Signed URLs، وHDCP للإخراج/المشاركة حيث تسمح المنصة والحقوق.
- روابط المشاهدة لا تخزن دائمًا. يرتبط الترخيص بـ`parent_id + device_id + entitlement`، ويرتبط التقدم والتنزيل بـ`child_id`؛ لا يدخل nickname أو الميلاد في الترخيص.
- يستخدم Android/Android TV secure decoder/surface و`FLAG_SECURE` في الشاشات المحمية. على Apple تراقب طبقة المنصة حالة screen capture/mirroring وتوقف التشغيل أو تغطيه عند المنع؛ تنفذ الاستجابة وفق قدرات الإصدار ولا تفترض إمكان حظر كل Screenshot.
- الصور والأصول عالية القيمة تسلم بطلب مصادق ورابط قصير العمر، ويمكن تركيب watermark توزيعي متحرك يضم معرف حساب/جلسة pseudonymous وتوقيتًا تقريبيًا بلا بيانات طفل. تعطيل long-press/context menu مجرد احتكاك إضافي.
- لا يمكن للتطبيق منع كاميرا خارجية أو كل التقاط على كل نظام. لا تستخدم المتطلبات عبارة «حماية 100%»؛ تقاس الحماية بنجاح DRM وHDCP والتعتيم/الإيقاف وسحب الترخيص والعلامة المائية على المنصات المدعومة.
- تتبع buffering وبدء التشغيل والاستكمال والحماية بأحداث لا تتضمن اسم الطفل. حذف تنزيل طفل لا يؤثر في سجل طفل آخر، حتى إذا كان الأصل نفسه مشتركًا.

## 8. الاشتراكات والأجهزة عبر RevenueCat

- Entitlements: `free` و`family` و`family_plus`. RevenueCat يثبت الاستحقاق، لكن Backend هو مصدر الحقيقة لحدود الأجهزة والتشغيل والتنزيل.

| الباقة | ملفات الأطفال | `max_registered_devices` | `max_concurrent_streams` | `max_download_devices` |
|---|---:|---:|---:|---:|
| `free` | 1 | 1 | 1 | 0 |
| `family` | 4 | 4 | 2 | 2 |
| `family_plus` | 4 | 8 | 4 | 4 |

- يضاف `account_devices` بمعرف تثبيت عشوائي مجزأ واسم/منصة/آخر نشاط/حالة، و`playback_sessions` بـheartbeat وlease، و`media_licenses` لنوع online/offline والانتهاء والإلغاء. لا يستخدم IMEI أو advertising ID.
- تسجيل الجهاز وبدء التشغيل ومنح ترخيص التنزيل عمليات خادمية ذرية تستخدم قفلًا على الحساب لمنع السباق. ينتهي lease المتروك تلقائيًا، ولا يزال التطبيق يرسل end صريحًا عند الخروج.
- إدارة الأجهزة في Parent Dashboard خلف PIN/biometric. الإلغاء يسحب session/refresh tokens وتراخيص DRM والتنزيل ويمنع heartbeat التالي. لا يزيل النظام أقدم جهاز تلقائيًا عند بلوغ الحد.
- تطبيق TV المسجل يحتسب جهازًا. Cast/AirPlay من جهاز مسجل يحتسب تشغيلًا متزامنًا واحدًا، ولا يحتسب المستقبل جهازًا مستقلًا إلا عند تسجيل الحساب عليه.
- التحقق من الاستحقاق خادميًا عبر webhooks موقعة مع idempotency وإعادة المحاولة، مع الاستعادة والإلغاء وgrace period وفشل الدفع. أي تغيير لجدول الحدود قرار بإصدار متزامن مع الشروط وواجهات المقارنة والاختبارات.
- لا يُستخدم SDK الإعلانات ولا معرف إعلاني، ولا يُرسل nickname أو الميلاد إلى RevenueCat.

## 8. الخصوصية والأمان

- لا اسم حقيقي مطلوب للطفل، ولا يوم ميلاد كامل، ولا صورة حقيقية أو موقع دقيق أو جهات اتصال.
- تشفير النقل والتخزين، وإدارة أسرار، وrate limiting، وaudit logs لعمليات الوالد الحساسة.
- تصدير وحذف بيانات كل طفل بصورة مستقلة، مع سجل طلبات وحالة التنفيذ.
- Analytics بمخطط أحداث مصغر ومعرفات pseudonymous وفترات احتفاظ محددة.
- لا إعلانات أو دردشة أو تعليقات أو روابط خارجية أو نشر عام في تجربة الطفل.
- مراجعة أمنية للموردين، وdependency scanning، ونسخ احتياطية واختبار استعادة.

## 9. Offline والمزامنة

- الألعاب والقصص المحملة تعمل بلا اتصال ضمن صلاحيات الملف النشط.
- تخزن الطوابير المحلية كل حدث مع `child_id` وevent id لمنع التكرار عند المزامنة.
- حل التعارضات محدد لكل نوع بيانات؛ لا تُدمج سجلات طفلين.
- إعدادات ولي الأمر الحساسة مصدر حقيقتها الخادم ولا يعدلها Child Session بلا اتصال.
- تعرض حالة واضحة عند انقطاع الشبكة، بلا روابط خارجية أو التفاف على المحتوى المسموح.

## 10. Observability وQA

### مراقبة
- Crash reporting منزوع البيانات الشخصية.
- مقاييس API والفيديو والتنزيل والمزامنة والدفع والتوصيات.
- dashboards منفصلة حسب track من دون كشف هوية الطفل.

### اختبارات آلية
- Unit tests لحدود الأعمار 3/5/6/8/9/12 ورفض 2/13 وتغير الشهر.
- Integration tests لإنشاء 1–4 ملفات وحدود الباقات وPIN/biometric fallback.
- RLS tests للعزل بين الأسر والأطفال.
- Tests لانتقال 5→6 و8→9 مع بقاء التقدم والإعدادات والتقارير والتوصيات.
- Widget/golden/accessibility tests لكل Track Theme وRTL وأحجام الشاشات.
- Offline sync tests تضمن بقاء كل حدث مرتبطًا بطفله.

### QA مع المستخدمين
- 3–5: الصوت والأيقونات وحجم اللمس وعدم الحاجة للقراءة.
- 6–8: المهمة والرجوع والتشغيل والتغذية الراجعة.
- 9–12: عدم طفولية الواجهة والبحث والتحدي واستقلال القراءة.
- تعدد الأطفال: التبديل وعزل الوقت والتقارير والتنزيلات والمفضلة والتوصيات.

## 11. قرار التقنية للـMVP

اعتماد Flutter + Riverpod + GoRouter وSupabase/Postgres/RLS ومزود بث متخصص وRevenueCat وSecure Storage وPIN/biometric. معيار القبول المعماري ليس تشغيل المحتوى فقط، بل إثبات دعم المسارات الثلاثة منذ MVP وعزل جميع بيانات كل طفل على العميل والخادم وفي التخزين غير المتصل.
