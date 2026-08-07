# إسقاط عائلي مبني على Queue، وتحقق Google Play، وتسليم بريد التحقق

يحوّل التغيير قراءات الأدمن للعائلات من جداول D1 المباشرة إلى إسقاط (`family_projection` / `child_projection`) يُغذّى من outbox داخل `FamilyState` عبر Cloudflare Queue، ويضيف تحققًا خادميًا من اشتراكات Google Play مع تدقيق دائم في `billing_audit` ونقطة RTDN موثّقة بـ OIDC من Pub/Sub، ويُوصل التسجيل بمزوّد بريد فعلي (Resend) مع بوابة fail-closed خارج التطوير. الخطة لا تُشتق من مدخلات العميل في أي مسار: `effectivePlan` يُحسب داخل الـ DO من جدول `entitlements`، والشراء يُربط بالوالد عبر `obfuscatedExternalAccountId = SHA256(parentId)` الذي يتحقق منه الخادم قبل أي منح.

**Watch for:** **مؤكد** أن watermark مشترك واحد في `family_projection` يجعل حدث `entitlement.updated` أو `family.initialized` يُفقد نهائيًا إذا سبقه في التسليم أي حدث أحدث (progress/playback/session)، فيبقى الأدمن يرى `free` لمشترك دافع بلا مسار إصلاح. **مؤكد** أن مسار التسجيل لا يملك إعادة إرسال لبريد التحقق مع رمز عمره ساعة واحدة و idempotency عمره 24 ساعة، أي قفل دائم لأي حساب فات صاحبه الرابط. **مؤكد** أن البيئة الافتراضية في `wrangler.jsonc` تشترك مع الإنتاج في اسم قائمة الانتظار ودلاء R2 بينما `ENVIRONMENT=development` يفتح الأدمن بلا مفتاح ويعيد رمز التحقق في الاستجابة.

## High-level view

الإسقاط يستخدم last-write-wins على `last_event_at_ms`، لكن `parentUpsert` يرفع هذا الحقل لكل نوع حدث بلا استثناء، فيصبح تيار الأحداث عالي التردد حاجزًا يُسقط أحداث الخطة والتهيئة منخفضة التردد عند أي إعادة ترتيب في التسليم. **مؤكد.**

`processed_family_events` يُكتب في كل دفعة ولا يُقرأ في أي مكان، فلا يوجد فحص idempotency فعلي؛ الحماية الوحيدة من التكرار هي حصانة عبارات LWW نفسها. والجدول لا يُنظَّف أبدًا، خلافًا لـ outbox الذي يحذف صفوفه بعد سبعة أيام. **مؤكد.**

الحدث غير الصالح يُـ`ack` ويُسجّل في `console.warn` فقط، فيختفي بلا DLQ وبلا أثر في D1 يسمح بالمصالحة، بينما فشل التحقق الآخر داخل نفس الدالة يذهب إلى `retry()`. **مؤكد.**

تفويض RTDN سليم بنيويًا: RS256 مُتحقَّق مقابل JWKS، وaudience وservice-account email وemail_verified، ثم مطابقة اسم الحزمة، ثم ربط purchase token بالوالد من `billing_audit` لا من جسم الإشعار. لكن الإشعار الذي لا يجد mapping يعيد 503 إلى ما لا نهاية، والمشترك الذي لم يستدعِ تطبيقه `/verify` يبقى مدفوعًا بلا استحقاق. **مؤكد للمسار، محتمل للأثر.**

`applyEntitlement` في الـ DO و upsert `billing_audit` كلاهما يكتب بلا مقارنة زمنية مع القيمة المخزّنة، فاستجابة مزوّد أقدم قد تهبط أخيرًا وتعيد اشتراكًا منتهيًا أو مسحوبًا إلى `active`. **مؤكد.**

مفتاح idempotency التسجيل مشتق من كلمة المرور نفسها ويبقى محفوظًا في تخزين الـ DO 24 ساعة، ما يخلق قيمة مخزّنة قابلة للتحقق من كلمة المرور بعملية HMAC واحدة بدل PBKDF2 بستمئة ألف تكرار. **مؤكد.**

مسارات الأدمن القديمة على `parents` و`children_profiles` في `admin.ts` — بما فيها POST/PATCH/DELETE وإرجاع `p.email` — ما زالت موجودة كاملة بعد سطر تسجيل الإسقاط، ميتة بحكم ترتيب Hono فقط. **مؤكد.**

<details>
<summary>Issues (12)</summary>

1. **watermark مشترك يُسقط أحداث الخطة والتهيئة نهائيًا** — **مؤكد:** افصل الترتيب لكل نوع حدث (watermark لكل حقل أو لكل نوع)، أو لا ترفع `last_event_at_ms` من `parentUpsert` للأحداث التي لا تُعدّل حقول الإسقاط.
2. **لا إعادة إرسال لبريد التحقق مع رمز عمره ساعة** — **مؤكد:** أضف `POST /auth/resend-verification` محدودًا بمعدل، أو لا تُنشئ الهوية قبل إثبات حيازة البريد. حاليًا كل حساب فاته الرابط مقفل نهائيًا.
3. **البيئة الافتراضية غير معزولة عن الإنتاج** — **مؤكد:** المستوى الأعلى يعلن `family-events` و`majarra-media` و`majarra-thumbs` نفسها مع `ENVIRONMENT=development`. أزل الـ bindings من الأعلى أو أعطها أسماء `-dev` قبل أي نشر.
4. **إمكانية إعادة تنشيط اشتراك ملغى بقراءة قديمة** — **مؤكد:** احرس upsert الاستحقاق و`billing_audit` بشرط `excluded.verified_at_ms > verified_at_ms` بدل الكتابة غير المشروطة.
5. **الحدث غير الصالح يُـack ولا يصل إلى DLQ** — **مؤكد:** اجعل `invalid_event` يذهب إلى DLQ أو إلى جدول أحداث مرفوضة في D1؛ `console.warn` وحده يجعل الفقد غير قابل للكشف.
6. **`processed_family_events` مكتوب ولا يُقرأ ولا يُنظَّف** — **مؤكد:** إما افحصه قبل تطبيق الأحداث غير الحصينة للتكرار، أو أسقطه؛ وأضف حذفًا دوريًا مثل outbox.
7. **مسارات family القديمة في `admin.ts` ميتة لكن باقية** — **مؤكد:** احذف معالجات `/parents` و`/children` القديمة (نحو 200 سطر) التي تكتب في `children_profiles` وتُرجع `p.email`؛ تعديل واحد في ترتيب `route('/')` يعيدها للحياة.
8. **مفتاح idempotency مشتق من كلمة المرور** — **مؤكد:** اشتقّ `idempotency_key` من البريد مع nonce عشوائي، لا من `register:${email}:${password}`، كي لا يصبح الصف المخزّن أوراكل تحقق سريعًا إذا تسرّب `AUTH_TOKEN_SECRET`.
9. **RTDN بلا mapping يعيد 503 دائمًا** — **مؤكد للمسار / محتمل للأثر:** خزّن الإشعارات المعلّقة (hash التوكن + الحالة) وأعِد معالجتها عند أول `/verify`، أو استنبط الوالد من `obfuscatedExternalAccountId` القادم من المزوّد.
10. **لا مصالحة لـ `projection_applied_at_ms IS NULL`** — **مؤكد:** إذا فشل نداء الـ DO بعد كتابة التدقيق، لا شيء يُعيد المحاولة خارج طلب العميل؛ أضف cron يمسح الصفوف غير المطبَّقة.
11. **صفوف إسقاط وهمية تضخّم `dashboard/stats`** — **مؤكد:** `parentUpsert` يُنشئ صف `family_projection` بخطة `free` لأي حدث لأي `parentId`؛ اقصر الإنشاء على `family.initialized`.
12. **لا اختبارات لأي من المسارات الجديدة** — **مؤكد:** لا يوجد أي ملف اختبار في `dashboard/api`. الأولوية: إعادة ترتيب الأحداث في الـ consumer، تفويض RTDN، وسلوك fail-closed للبريد و Google Play.

</details>

<details>
<summary>Details</summary>

## watermark واحد لكل تيارات الأحداث

`parentUpsert` يُنفَّذ أولًا في كل دفعة، لكل نوع حدث، ويرفع `last_event_at_ms` إلى `MAX(الحالي, occurredAt)`. بعده يأتي الحدث المتخصص محروسًا بمقارنة مع الحقل نفسه. ولأن `session.created` و`progress.updated` و`playback.*` و`favorite.updated` لا تملك أي عبارة متخصصة، أثرها الوحيد هو رفع هذا الحاجز.

```
outbox:   entitlement.updated (t=1000, family_plus)   progress.updated (t=1001)
تسليم:    progress.updated أولًا
دفعة 1:   parentUpsert -> last_event_at_ms = 1001
دفعة 2:   parentUpsert -> MAX(1001, 1000) = 1001
          UPDATE ... WHERE ? >= last_event_at_ms  ->  1000 >= 1001  ->  false
النتيجة:  plan يبقى 'free'، والحدث يُسجّل في processed_family_events كمُعالَج
```

ميلي ثانية واحدة من الفارق كافٍ، و`alarm` يُرسل حتى 100 حدث بـ `sendBatch` واحد بينما الـ consumer يقرأ `batch.messages` بترتيب غير مضمون — أي أن إعادة الترتيب هي الحالة المتوقعة لا الاستثناء. الأثر نفسه يطال `family.initialized`: يبقى `display_name` و`created_at_ms` فارغين للأبد، فيظهر في `/admin/parents` وليٌّ بلا اسم.

`child_projection` نجا من هذا لأن watermarkه لكل `child_id` ولا يكتبه إلا `child.created`، وهو تحديدًا النمط الذي يجب تعميمه على مستوى الوالد.

## القفل الدائم في مسار التسجيل

`createVerificationToken` يضبط `exp` على ساعة واحدة، و`IdentityState.register` يحفظ الاستجابة تحت مفتاح idempotency صلاحيته 24 ساعة مشتق افتراضيًا من `register:${email}:${password}`. ينتج عن ذلك ثلاثة مسارات:

خلال 24 ساعة وبنفس البريد وكلمة المرور بالحرف، المفتاح يطابق فتُعاد الاستجابة المخزّنة ويُصدر رمز جديد ويُرسل البريد — إعادة الإرسال تعمل بالمصادفة لا بالتصميم. بكلمة مرور مختلفة عند إعادة المحاولة، المفتاح يختلف فيُصطدم بـ `if (this.first()) return 409` برسالة `Unable to create this account`. وبعد 24 ساعة، المفتاح انتهى والنتيجة 409 كذلك.

وفي كل الحالات `login` يرفض بـ 401 `Invalid email or password` لأن `email_verified_at === null`، ولا يوجد `resend-verification` ولا `forgot-password` في `authRoute`. الحساب موجود، غير قابل للتحقق، وغير قابل لإعادة التسجيل.

مسألة متصلة: إنشاء الهوية قبل إثبات حيازة البريد يسمح بحجز بريد شخص آخر، وبعد أن أصبح الإرسال حقيقيًا يصل الرابط إلى صندوق الضحية فعلًا، فإن ضغطته وثّقت كلمة مرور لا تملكها. تأجيل إنشاء الهوية إلى ما بعد التحقق يعالج هذا والقفل الدائم معًا.

## البيئة الافتراضية تلمس موارد الإنتاج

المستوى الأعلى في `wrangler.jsonc` يعلن `queue: "family-events"` — نفس اسم قائمة الإنتاج — و`bucket_name: "majarra-media"` و`"majarra-thumbs"` بلا لاحقة، مع `ENVIRONMENT: "development"`. مستهلكو Queue على نفس القائمة يتنافسون على الرسائل، فنشر بلا `--env` يعني ورشة تطوير تسحب أحداث عائلات حقيقية وتكتب في دلاء الإنتاج.

و`ENVIRONMENT=development` ليس محايدًا: وسيط `admin.ts` يتخطى المصادقة كليًا عند غياب `ADMIN_API_KEY`، و`/auth/register` يعيد `development_verification_token` في الاستجابة. الإسقاط الجديد مثبَّت تحت ذلك الوسيط، فما كان مكشوفًا في التطوير أصبح يشمل أسماء كل الأولياء وخططهم وألقاب كل الأطفال ومساراتهم العمرية.

المُلطِّف الوحيد أن `database_id: "local-majarra-db"` ليس معرّف D1 صالحًا، ما يُرجَّح أن يُفشل النشر مبكرًا. الاعتماد على معرّف تالف كضمانة عزل ليس عزلًا. **محتمل** أن يفشل النشر أولًا.

## كتابة الاستحقاق بلا حراسة زمنية

`verifyAuditAndApplyGooglePlay` يقرأ حالة المزوّد ثم يكتب:

```ts
ON CONFLICT(purchase_token_hash) DO UPDATE SET
  provider_state = excluded.provider_state,
  entitlement_status = excluded.entitlement_status,
  expires_at_ms = excluded.expires_at_ms,
  verified_at_ms = excluded.verified_at_ms,   // بلا أي مقارنة
```

و`applyEntitlement` في الـ DO يفعل الشيء نفسه على `entitlements` بمقارنة صفرية على `updated_at`. الـ DO يُسلسل الطلبات، لكن التسلسل يحكم لحظة الكتابة لا لحظة القراءة من المزوّد. طلبان متزامنان — إشعار RTDN لإلغاء ونداء `/verify` من التطبيق، أو إشعاران متتاليان — يمكن أن يهبطا معكوسين، فتفوز القراءة الأقدم ويعود `revoked` أو `expired` إلى `active`. الحراسة الصحيحة شرط تزايد على `verified_at_ms` في الجانبين.

ما يحدّ من عمر الخطأ أن `currentPlan()` يستبعد الصفوف بـ `expires_at > ?`، و`resolveGooglePlaySubscription` يرفض `active`/`grace` بانتهاء `null` — فالاستحقاق العالق ينقضي من نفسه ولا يبقى بلا نهاية.

## عقد الـ consumer والفقد الصامت

```ts
if (!result.accepted) console.warn('family_event_rejected', result.reason);
message.ack();
```

فشل `parseFamilyEvent` وفشل `invalid_child_created_event` / `invalid_entitlement_event` كلاهما فشل تحقق لا فشل عابر، لكنهما يُعامَلان بطريقتين متعاكستين: الأول يُـ`ack` ويُنسى، والثاني يمرّ بـ `retry()` خمس مرات ثم يستقر في DLQ. الفرع الأول يعني أن تغييرًا في المخطط أو حقلًا زائدًا عن الحد يستهلك الحدث بلا أثر في D1 ولا في DLQ، ولا شيء يسمح لاحقًا بمعرفة ما ضاع.

`max_retries: 5` و`dead_letter_queue` معلنان في البيئات الثلاث، لكن لا يوجد أي مستهلك أو عملية معلنة لـ `family-events-dlq` نفسها، فالرسائل الميتة تُجمع بلا من يقرأها.

## صفوف الإسقاط الوهمية

`parentUpsert` هو `INSERT ... ON CONFLICT DO UPDATE` بلا أي شرط على نوع الحدث، فأي حدث لأي `parentId` يمرّ عبر `parseFamilyEvent` يُنشئ صف `family_projection` بحالة `active` وخطة `free`. `dashboard/stats` يحسب `active_parents` من هذا الجدول مباشرة و`/admin/parents` يسرده، فالعدّاد يصبح دالة للأحداث المُسلَّمة لا للعائلات المُهيّأة. المنتج الوحيد اليوم هو outbox داخل الـ DO، لذا الأثر يبقى محدودًا بقدر ما يبقى ذلك المنتج وحيدًا وسليمًا.

## البحث في مسارات الإسقاط

الوسائط مُمرَّرة بربط لا بدمج نصي، لكن فهارس migration 0008 كلها على `(status, plan, last_event_at_ms)` و`(parent_id, status, ...)` ولا شيء منها يخدم `LIKE` بمقدمة wildcard، و`search` قد يكون `%` نفسه. كل بحث أدمن مسحٌ كامل للجدولين، ونمو الإسقاط هو نمو قاعدة المستخدمين.

## حدود التحقق

`dashboard/api` ليس مستودع Git، فلا أستطيع فصل السطور الجديدة عن الأساس؛ اعتمدت على قراءة الملفات المسمّاة في الطلب كاملة وعلى تتبّع مُستدعياتها (`index.ts`، `doClient.ts`، `FamilyState.ts`، `IdentityState.ts`، `parentAuth.ts`، `security.ts`، `familyPolicy.ts`، `family.ts`). لا توجد اختبارات في المسار، و`tsc --noEmit` لا يعمل هنا بلا تعريفات Cloudflare التي يوفّرها Wrangler.

تحقّقت عمليًا من أمر واحد: upsert `billing_audit` لا يفشل رغم وجود قيدَي تفرّد (`id` كمفتاح أساسي و`purchase_token_hash` كـ UNIQUE) مع هدف تعارض واحد، لأن `id` مشتق من نفس الـ hash فالصف واحد — شغّلت السيناريو على SQLite مباشرة. **غير قابل للتحقق هنا:** ترتيب التسليم الفعلي لـ Queues تحت الحمل، سلوك D1 batch تحت التنافس، وشكل استجابة `subscriptionsv2` من Google.

</details>

## ما هو صحيح

الخطة لا تُقبل من العميل في أي مسار: `effectivePlan` يُحسب داخل `applyEntitlement` من `currentPlan()`، والـ consumer يقرأه من حمولة الـ DO لا من طلب HTTP، و`/entitlements/apply` غير موصول بأي مسار عام — و`family.ts` ينشر جسم العميل ثم يفرض `session_id` بعده فلا يمكن تخطيه.

ربط الشراء بالوالد صحيح في الاتجاه الحساس: `resolveGooglePlaySubscription` يرفض أي شراء لا يطابق `obfuscatedExternalAccountId` قيمة `SHA256(parentId)`، فتوكن مسروق أو مُعاد استخدامه من حساب آخر يُرفض. RTDN يستنبط الوالد من `billing_audit` لا من جسم الإشعار، ويرفض اسم حزمة مختلفًا، وكل مسار غير مُعدّ يفشل مغلقًا بـ 503.

التوكن الخام لا يُخزَّن ولا يُسجَّل: `billing_audit` يحمل `purchase_token_hash` و`raw_response_hash` فقط، ورسائل الخطأ في `billing.ts` عامة ولا تنقل تفاصيل المزوّد. `testPurchase` مرفوض في الإنتاج، و`ACKNOWLEDGEMENT_STATE_PENDING` يُقرّ قبل المنح فلا يُلغى الشراء تلقائيًا.

بوابة البريد fail-closed: خارج `development` يرفض `/register` بـ 503 قبل توفر `RESEND_API_KEY` و`EMAIL_FROM` و`EMAIL_VERIFICATION_URL` بمخطط HTTPS، وفشل الإرسال يُرجع 503 بدل نجاح صامت، ورابط التحقق مهروب في نسخة HTML.

`actorId()` يرفض صراحةً قبول ترويسة قابلة للتزوير كهوية تدقيق ويعلّق السبب، بدل كتابة هوية كاذبة في `audit_logs`. ومسارات الطفرة في `adminFamilyProjection` تُرجع 405 مع توجيه إلى الـ APIs المصادَقة، فالإسقاط للقراءة فقط بحكم التصميم.

<details>
<summary>File map</summary>

حالة الفرق غير متاحة (لا مستودع Git في المسار)؛ هذه الملفات المفحوصة.

- `src/queue/familyEvents.ts` — تطبيق الأحداث على الإسقاط بـ LWW، وعقد ack/retry.
- `src/contracts/familyEvents.ts` — أنواع الأحداث والتحقق البنيوي من المغلّف.
- `src/routes/adminFamilyProjection.ts` — قراءات الأدمن من الإسقاط، وطفرات مرفوضة بـ 405.
- `src/routes/admin.ts` — `dashboard/stats` و`parents_by_plan` من الإسقاط، `actorId` ثابت، ومعالجات family قديمة باقية.
- `src/routes/billing.ts` — سياق Google Play و`/verify` ونقطة RTDN.
- `src/services/billing.ts` — تدقيق دائم ثم تطبيق الاستحقاق على الـ DO.
- `src/services/googlePlay.ts` — JWT خدمي، `subscriptionsv2`، ربط الحساب، الإقرار.
- `src/services/googleOidc.ts` — تحقق توكن Pub/Sub وتحليل RTDN.
- `src/services/email.ts` — إرسال Resend وبوابة الإعداد.
- `src/routes/auth.ts` — التسجيل وإرسال التحقق ومسارات الجلسة.
- `migrations/0008_family_projections_billing_audit.sql` — جداول الإسقاط والتدقيق وفهارسها.
- `wrangler.jsonc` — bindings البيئة الافتراضية وstaging والإنتاج.
- مراجع للسياق: `src/index.ts`، `src/do/FamilyState.ts`، `src/do/IdentityState.ts`، `src/lib/parentAuth.ts`، `src/lib/security.ts`، `src/lib/doClient.ts`، `src/lib/familyPolicy.ts`، `src/routes/family.ts`.

Full diff: غير متاح — `dashboard/api` ليس مستودع Git.

</details>
