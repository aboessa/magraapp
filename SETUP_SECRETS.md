# إعداد الأسرار وإجراءات التشغيل

> **آخر تحديث: 2026-08-26.** الأرقام والمسارات هنا مُتحقَّق منها مقابل الكود. ما يخص الفجوات المفتوحة موجود في `AUDIT_FULL_2026.md` بمعرّفاته.
>
> **لا توجد بيئة staging.** قرار مالك: المنتج في مرحلة تطوير وكل شيء يعمل على الإنتاج مباشرة. الأمر الوحيد للنشر هو `--env production`، وبيئتا التطبيق هما `development` (تصل إلى الإنتاج أو إلى loopback عبر تجاوز العنوان) و`production`.

---

## 0. بذر أول حساب مسؤول ثم إبطال المفتاح المشترك — `SEC-102`

**لماذا هذا أول بند.** `admin_users` صفر صفًا اليوم. في هذه الحالة يقبل `lib/adminAuth.ts` المفتاح المشترك `ADMIN_API_KEY` كباب وحيد: هوية واحدة للفريق كله، وسجل تدقيق يكتب `legacy-admin-key` بدل شخص، ولا سبيل لسحب وصول فرد دون تبديل المفتاح على الجميع. وبمجرد وجود مستخدم واحد **يرفض الحرس المفتاح تلقائيًّا**.

```powershell
$env:MAJARRA_ADMIN_API_KEY = "<القيمة من أسرار الإنتاج>"
node tools/ops/seed-admin.mjs --base https://api.majarra.app --email owner@example.com --name "اسم المالك" --role owner
```

المفتاح يُقرأ من البيئة لا من وسيط سطر أوامر (سطر الأوامر يُسجَّل في تاريخ الصدفة وقائمة العمليات). السكربت:

1. يرفض العمل إن وُجد مستخدم بالفعل — يُبذَر الأول فقط.
2. يولّد كلمة مرور مؤقتة ويطبعها مرة واحدة؛ الخادم يضبط `must_change_password`.
3. **يعيد الفحص ويؤكد أن المفتاح المشترك صار يُرفض بـ401.** بلا هذا الفحص لا أحد يعرف أن الباب أُغلق.

بعد النجاح:

```powershell
npx wrangler secret delete ADMIN_API_KEY --env production
```

ثم احذف السطر من `dashboard/api/.secrets.local.txt`. الأدوار المتاحة في القاعدة: `owner`, `system_admin`, `content_manager`, `publisher`, `reviewer`, `planet_manager`, `section_lead`, `content_creator`, `illustrator`, `sound_engineer`, `translator`, `viewer`.

---

## 1. نظافة الأسرار المحلية — `OPS-104`

الأسرار **غير متتبَّعة في git** (مُتحقَّق منه بـ`git ls-files --error-unmatch`)، و`.gitignore` يغطّي `.secrets*` و`.env.*` و`*.log` و`.wrangler/` و`.backups/` و`dashboard/api/.tmp/`. الخطر المتبقي ليس git بل القرص:

| الملف | المحتوى | الإجراء |
|---|---|---|
| `dashboard/api/.secrets.local.txt` | أزواج محلي/إنتاج لـ`AUTH_TOKEN_SECRET`, `MEDIA_TOKEN_SECRET`, `ADMIN_API_KEY` | المصدر هو `wrangler secret`. احذف `ADMIN_API_KEY` بعد §0، ولا تُضِف أسرارًا جديدة إلى هذا الملف |
| `dashboard/api/.dev.vars` | أسرار التطوير المحلي | مطلوب لتشغيل `wrangler dev` — يبقى، ولا يحمل أسرار إنتاج |
| `dashboard/api/*.log` (منها `devA.log` بحجم 3.96 MB) | مخرَج جلسات `wrangler dev` حقيقية | **احذفها.** قد تحتوي رموز دخول كاملة |
| `dashboard/api/probe-*.json` | استجابات نقطة الدخول | **احذفها** |
| `dashboard/api/.tmp/` | مخلَّفات استيراد ومهام | **احذفها** |

```powershell
Remove-Item dashboard/api/*.log, dashboard/api/probe-*.json -ErrorAction SilentlyContinue
Remove-Item dashboard/api/.tmp -Recurse -Force -ErrorAction SilentlyContinue
```

**أي سرّ ظهر في سجل تطوير يُعتبر مكشوفًا ويُدوَّر.** تدوير `AUTH_TOKEN_SECRET` اليوم يُخرج كل أولياء الأمور من جلساتهم فورًا، لأن التوكنات بلا معرّف مفتاح (`SEC-109`) — لذلك يُدوَّر في نافذة صيانة معلَنة حتى يُنفَّذ دعم `kid`.

---

## 2. Resend (البريد) — يمنع أي تسجيل

```powershell
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put EMAIL_VERIFICATION_URL --env production
```

- المفتاح من https://resend.com/api-keys ونطاق `majarra.app` موثَّق في Resend عبر DNS TXT.
- `EMAIL_VERIFICATION_URL` مثال: `https://majarra.app/verify?token={token}`.
- الكود: `dashboard/api/src/services/email.ts` يرجع 503 حتى تُضبط الأسرار، وفي `development` يرجع `development_verification_token` مباشرة.

---

## 3. Google Play — يمنع الاشتراكات · `API-104` · `EXT-102`

- منتجان في Play Console: `majarra_family` و`majarra_family_plus`. الحزمة `com.majarra.majarra`.
- Service Account مع `Play Developer API` ومفتاح JSON.
- RTDN: Pub/Sub topic → Push إلى `https://api.majarra.app/api/v1/billing/google-play/rtdn`.

```powershell
npx wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON --env production
```

> **حالة فعلية:** `plan_pricing` صفر صفًا و`store_products` ثلاثة منتجات بلا أسعار، ولا عميل ينادي `google-play/verify` بعد. الأسرار وحدها لا تفتح الشراء — انظر `API-104` و`DECIDE-102`.

---

## 4. أصل وسائط واحد على الأقل — `CNT-101`

لاختبار `capability → R2` من طرف إلى طرف:

1. ارفع أصلًا عبر `POST /api/v1/admin/assets`.
2. تحقّق: `SELECT COUNT(*) FROM content_assets WHERE kind='video'` — القيمة اليوم **صفر**، ولذلك كل حلقة منشورة (20) غير قابلة للتشغيل.
3. الحلقة تحتاج ربطًا في `asset_links` بدور `stream` أو `video`، لا وجود الأصل وحده — هذا هو الشرط الذي يفحصه `routes/episodes.ts`.

---

## 4.5 مفتاح توقيع تراخيص الاستخدام دون إنترنت — `ENC-001`

`OFFLINE_LICENSE_SIGNING_KEY` مفتاح **Ed25519 خاص** بترميز PKCS8/base64. بلا هذا
السرّ يردّ `POST /api/v1/downloads/sessions` بـ**503** ولا يُنزَّل شيء — وهذا
مقصود: ترخيص بلا توقيع يقبله العميل، فيصير كل جهاز قادرًا على كتابة ترخيص أبديّ
لنفسه.

**لماذا لامتناظر لا HMAC كبقية التوكنات:** الترخيص يتحقّق منه **العميل وهو غير
متصل**. لو كان HMAC لاحتاج التطبيق نفس السرّ، أي أن مفتاح الإصدار يُوزَّع على كل
جهاز.

### التوليد

بـNode (يعمل على Windows بلا أدوات إضافية):

```bash
node -e "const{generateKeyPairSync}=require('node:crypto');console.log(generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'der'}).toString('base64'))"
```

أو بـopenssl إن كان متاحًا:

```bash
openssl genpkey -algorithm ed25519 -outform DER | base64 -w0
```

الناتج سطر واحد طوله 64 حرفًا. يُنشر كسرّ:

```bash
cd dashboard/api
npx wrangler secret put OFFLINE_LICENSE_SIGNING_KEY --env production
```

### المفتاح العام

يُشتَقّ من الخاص ولا يُكتب في مستند: نسخة مكتوبة تتقادم مع أول تدوير، ثم يُبنى
تطبيق يحمل مفتاحًا لا يطابق ما يوقّع به الخادم — فيُرفض **كل** ترخيص على كل
جهاز.

```bash
cd dashboard/api
node tools/ops/offline-license-public-key.mjs                 # من .dev.vars المحلي
node tools/ops/offline-license-public-key.mjs --key "<base64>" # من قيمة صريحة
```

احتفظ بمخرجه **قبل** نشر السرّ: أسرار Cloudflare لا تُقرأ بعد كتابتها بالتصميم.

### حالة بيئة التطوير المحلية

**مفتاح تطوير مولَّد بالفعل** ومكتوب في `dashboard/api/.dev.vars`
(غير متتبَّع في git — `dashboard/api/.gitignore:12`)، ومُتحقَّق منه: يُستورَد
بـ`crypto.subtle.importKey('pkcs8', …, 'Ed25519')` ويوقّع 64 بايت ويتحقّق
مفتاحه العام من التوقيع ويرفض حمولة مُعدَّلة.

هذا المفتاح **للتطوير المحلي وحده**. الإنتاج يحتاج مفتاحًا مستقلًّا يُنشر
بالأمر أعلاه، ولا يُنسَخ مفتاح التطوير إليه.

### التدوير

كل ترخيص يحمل `signature_key_id` (اليوم `majarra-offline-v1`، ثابت في
`src/lib/offlineLicense.ts`). التدوير:

1. ولّد مفتاحًا جديدًا وغيّر `CURRENT_KEY_ID` إلى `…-v2`.
2. انشر التطبيق وهو يبندل **المفتاحين** العامّين بمعرّفيهما.
3. ثم بدّل السرّ في الـWorker.

بهذا الترتيب تبقى التراخيص القائمة قابلة للتحقّق حتى تنتهي مدتها (30 يومًا).
تبديل السرّ قبل نشر التطبيق يُعطّل كل ترخيص على كل جهاز في اللحظة نفسها.

**لا تضع هذا المفتاح في `platform_settings` ولا في أي جدول:** أعمدة D1 نصّية
مقروءة من كل من يملك وصولًا إلى القاعدة.

---

## 4.8 مستقبِل تنبيهات العمليات — `OPS-106`

**بلا هذا الإعداد يعمل الرصد ولا يصل أحدًا.** الفحوص تكتب صفوفها، والتنبيهات
تُرفَع وتظهر في شاشة العمليات، لكن لا بريد يُرسَل — ويُسجَّل ذلك صراحةً في
`ops_alerts.notify_outcome = 'unconfigured'` بدل افتراض وصول لم يحدث.

```powershell
npx wrangler secret put OPS_ALERT_EMAIL --env production   # بريد من يشغّل النظام
```

**ليس بريد مستخدم ولا `EMAIL_FROM`.** التنبيه يذهب إلى من يستطيع التصرّف.

ويحتاج مزوّد تسليم قائمًا: إمّا ربط `send_email` (مُعلَن في `wrangler.jsonc`) أو
`RESEND_API_KEY`. والتحقّق:

```powershell
npx wrangler secret list --env production | Select-String OPS_ALERT_EMAIL
```

### ما يُرسِل تنبيهًا

| البصمة | الشرط | الدرجة |
|---|---|---|
| `dlq:pending` | حدث عائلة فاشل واحد أو أكثر | high |
| `d1:unreachable` | `SELECT 1` يفشل | critical |
| `d1:slow` | الاستعلام البسيط ≥ ثانية | medium |
| `queue:stale` | لا حدث مُسقَط منذ ٦٠ دقيقة | high |

التنبيه **واحد لكل حالة حيّة** بفضل فهرس فريد جزئي على `fingerprint`، ويُغلَق
تلقائيًّا حين تزول حالته. فعطلٌ يعيش يومًا يُنتج رسالة واحدة لا ٢٨٨.

### تشخيص الأحداث الفاشلة القائمة

```powershell
cd dashboard/api
node tools/ops/triage-failed-events.mjs --remote
```

تجمعها وتصنّفها (`replayable` / `placeholder` / `unknown_type`) وتطبع أمر القرار
لكل مجموعة. **لا تكتب شيئًا**: الإعادة والاستبعاد عبر مسارَي الإدارة ليُسجَّل فاعلهما.

---

## 4.7 تدوير أسرار التوكنات — `SEC-109`

`AUTH_TOKEN_SECRET` يوقّع توكن الوصول، وإثبات وليّ الأمر، وتوكن تحقّق البريد،
وتوكن إعادة كلمة المرور. و`MEDIA_TOKEN_SECRET` يوقّع قدرات الوسائط.

**قبل هذا البند كان تبديل أيّهما يُخرج كل مستخدم في اللحظة نفسها**، فكان التدوير
عمليًّا لا يحدث — وسرٌّ لا يُدوَّر هو سرٌّ يبقى إلى الأبد.

### كيف يعمل

كل توكن يحمل `kid` في حمولته: **بصمة مشتقّة من السرّ نفسه** لا اسمًا مكتوبًا في
الإعداد. فلا يمكن أن يفترق المعرّف عن سرّه، ولا حقل ثانٍ يُنسى عند التبديل.

والتحقّق يقرأ **حلقة** من سرّين: `AUTH_TOKEN_SECRET` ثم
`AUTH_TOKEN_SECRET_PREVIOUS` — والتوقيع بالحالي وحده دائمًا.

### الإجراء

```powershell
# 1) ولّد سرًّا جديدًا (٤٨ بايتًا عشوائيًّا)
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 2) انقل السرّ الحالي إلى خانة «السابق» أوّلًا — قبل تبديل الحالي
npx wrangler secret put AUTH_TOKEN_SECRET_PREVIOUS   # ألصق السرّ الحالي

# 3) ثم بدّل الحالي بالجديد
npx wrangler secret put AUTH_TOKEN_SECRET            # ألصق السرّ الجديد

# 4) بعد انقضاء النافذة (٣١ يومًا لـAUTH، وساعة تكفي لـMEDIA) احذف السابق
npx wrangler secret delete AUTH_TOKEN_SECRET_PREVIOUS
```

**الترتيب ملزم.** الخطوة 2 قبل 3: لو بُدِّل الحالي أوّلًا لوُجدت لحظةٌ لا يقبل
فيها الخادم توكنات أحد.

### طول النافذة

| السرّ | أطول ما يُوقَّع به | النافذة الدنيا |
|---|---|---|
| `AUTH_TOKEN_SECRET` | توكن التحديث (٣٠ يومًا) | **٣١ يومًا** |
| `MEDIA_TOKEN_SECRET` | قدرة وسائط (٣ دقائق) | **ساعة** |

ولسرّ الوسائط نفس الخطوات باسميه: `MEDIA_TOKEN_SECRET_PREVIOUS` ثم
`MEDIA_TOKEN_SECRET`. وقصر عمر قدراته لا يُلغي الحاجة إلى الحلقة: تبديلٌ بلا
نافذة يقطع كل مشاهدة **جارية** في تلك اللحظة.

والحذف في الخطوة 4 ليس تنظيفًا اختياريًّا: هو **ما يُبطل** توكنات السرّ القديم.
سرٌّ يبقى في الخانة السابقة إلى الأبد يعني تدويرًا لم يكتمل.

### حين يكون السرّ مسروقًا لا متقادمًا

**تجاوز الخطوة 2.** بدّل `AUTH_TOKEN_SECRET` وحده بلا خانة سابقة: كل مستخدم
يُخرَج، وهذا هو المطلوب. الحلقة لتدوير مُخطَّط لا لاحتواء تسريب.

---

## 4.6 المفاتيح العامة في بناء التطبيق — `ENC-005`

التطبيق يتحقّق من الترخيص وهو **غير متصل**، فيحتاج المفتاح العام وقت البناء لا
وقت التشغيل:

```bash
cd app_main
flutter build appbundle \
  --dart-define=OFFLINE_LICENSE_PUBLIC_KEYS=majarra-offline-v1:<spki-base64>
```

القيمة `kid:base64` وتُفصَل بفواصل لعدّة مفاتيح (لازم أثناء التدوير):

```
--dart-define=OFFLINE_LICENSE_PUBLIC_KEYS=majarra-offline-v1:AAA…,majarra-offline-v2:BBB…
```

المعرّف هو `CURRENT_KEY_ID` في `dashboard/api/src/lib/offlineLicense.ts`،
والقيمة مخرج `tools/ops/offline-license-public-key.mjs` كما هو (SPKI أو 32 بايت
خامّة — التطبيق يقبل الصيغتين).

**بناء بلا هذا الـdefine لا يشغّل أي محتوى محفوظ**: التحقّق يفشل بـ`notConfigured`
ويُعرض «حدّث التطبيق». هذا مقصود — قبول ترخيص غير متحقَّق منه يعيد الجهاز سلطةً
على صلاحيته الخاصة.

---

## 5. حماية الحافة

الحدود المُطبَّقة فعلًا في `src/lib/rateLimit.ts` و`src/index.ts` (لكل دقيقة):

| المسار | الحدّ | المفتاح |
|---|---:|---|
| `/auth/*` وَ`/account*` | 5 | IP |
| `/billing/*` | 20 | المستخدم |
| `/admin/*` | 600 | المستخدم |
| `/analytics/*` | 240 | IP |
| `/episodes/*`, `/books/*`, `/stories/*`, `/media/*` | 40 | المستخدم |
| `/family/*`, `/child-settings/*`, `/notifications/*` | 60 | المستخدم |
| `/creations*` | 30 | المستخدم |

الحدّ يُعلَن **في `index.ts` فقط**. تركيبه مرة ثانية على مستوى الموجّه يجعل الطلب الواحد يستهلك وحدتين — وهو العيب الذي كان يجعل حدّ الدخول المُعلَن 5 والفعلي 2 (`SEC-104`).

وللحماية على الحافة أيضًا: Cloudflare → Zone `majarra.app` → Security → Rate limiting → `/api/v1/auth/*` بـ10/10s Block.

---

## 6. النطاق المخصص

```json
"routes": [{ "pattern": "api.majarra.app/*", "zone_name": "majarra.app" }]
```

مضبوط في `wrangler.jsonc` تحت `env.production`. المطلوب: Zone `majarra.app` في الحساب، وNS موجَّه إلى Cloudflare، ثم `npx wrangler deploy --env production`.

---

## 7. Flutter — أهداف البناء

```bash
# الإنتاج (الافتراضي بلا أي define)
flutter build appbundle --release

# تطوير محلي مقابل wrangler dev
flutter run --dart-define=MAJARRA_ENV=development --dart-define=API_BASE_URL=http://127.0.0.1:8787
```

قائمة السماح في `core/env/app_environment.dart`: الإنتاج مضيف واحد (`api.majarra.app`)، والتطوير يضيف loopback ومضيف `workers.dev` القديم. أي قيمة أخرى لـ`MAJARRA_ENV` — بما فيها `staging` — تُحلّ إلى الإنتاج.

---

## 8. النشر — `OPS-105`

النشر يحدث **من CI على `master` بعد خضرة كل الوظائف**، ولا يحدث من جهاز أحد.

### التشغيل: سرّان، ولا تحرير ملف

أضف في المستودع (Settings → Secrets and variables → Actions):

| السرّ | من أين |
|---|---|
| `CLOUDFLARE_API_TOKEN` | توكن بصلاحية `Workers Scripts: Edit` على الحساب |
| `CLOUDFLARE_ACCOUNT_ID` | من لوحة Cloudflare |

**هذا كلّ ما في المفتاح.** مهمّة `deploy` تقرأ وجود السرّين في وقت التشغيل: إن وُجدا
نشرت، وإن غابا بنت الحزمة وتوقّفت. ولا سطر في المستودع يحتاج تعديلًا.

والصياغة القديمة كانت مثبَّتة على `--dry-run` مع تعليق يشرح أن التوكن مطلوب — أي
طلبُ تغييرٍ متنكّرًا في صورة مسار: تُضاف الأسرار ثم **لا يُنشَر شيء** حتى يتذكّر أحدٌ
تحرير الملف.

> **تنبيه أوّل نشر:** ترحيل الكائنات الدائمة الموسوم `v4` (`RateLimiter`) يُطبَّق مع
> أوّل نشر حقيقي.

### ما يفعله المسار

1. يخبز بصمة الـcommit في الحزمة (`tools/ci/write-release.mjs`).
2. `wrangler deploy --env production`.
3. **يسأل الإنتاج نفسه** عن إصدارِه ويوازن: `GET https://api.majarra.app/version`.
   فإن لم تُطابق البصمةُ الـcommit خلال ستّ محاولات، فشلت الجولة. هذا ما يمنع
   «نشرٌ نجح» ونسخةٌ قديمة تخدم الطلبات.
4. يضع وسمًا مشروحًا `release/<تاريخ>-<sha7>` رسالته فيها **معرّف إصدار Cloudflare**
   ورابط الجولة. الوسم هو السجل الدائم الذي يربط الإصدار بالـcommit.

### «أيّ إصدارٍ يعمل الآن؟»

```powershell
curl https://api.majarra.app/version
```

يُجيب الإنتاج من الحزمة التي تعمل فيه: البصمة (١٢ محرفًا)، ووقت البناء، ورقم جولة
CI. والجواب من الإنتاج لا من سجلٍّ يُكتب بجانبه، لأن السجل يفترق عن الواقع أوّل مرّة
يُنشر بيدٍ.

و`api_version` في نفس الجواب شيء آخر: هي عقد الـAPI (`v1`) وقيمتها لا تتغيّر بالنشر.
وكانت هي كل ما يُعرَض قبل هذا البند — تُقرأ إجابةً وهي ليست إجابة.

### التراجع

نشرٌ سيّئ يُلغى في ثوانٍ، والإصدار السابق قائم في Cloudflare:

```powershell
cd dashboard/api
npx wrangler versions list --env production          # أحدثها أوّلًا
npx wrangler rollback <version-id> --env production -m "<السبب>"
curl https://api.majarra.app/version                 # تأكيد أن الراجع هو ما يعمل
```

ومعرّف إصدارٍ سابق يُعرَف أيضًا من وسم إصداره: `git show release/<تاريخ>-<sha7>`.

**غير مُختبَر على الإنتاج بعد** — لا يمكن اختباره بلا نشرٍ حقيقي. فأوّل نشر بعد
تمكين السرّين: نفّذ تراجعًا واحدًا مقصودًا ثم أعِد النشر، ووثّق الزمن الذي استغرقه.

### الترحيلات **لا تُطبَّق مع النشر** — بقرار

```powershell
npm run migrate:remote   # wrangler d1 migrations apply majarra-db --remote --env production
```

فعلٌ منفصل ومقصود. السبب: نشرٌ سيّئ يُلغيه `rollback` في ثوانٍ، **وترحيلٌ سيّئ لا
يُلغيه شيء** يملكه المسار. وربطهما يعني أن تغييرًا في المخطَّط يركب مع إصلاح نصّ
عابر، فيُطبَّق بلا أن ينظر إليه أحد.

**قبل أي `migrate:remote`:**

```powershell
node tools/ops/migration-ledger.mjs --remote
```

تطبع ما في السجل ولا ملف له، وما له ملف ولم يُطبَّق. والبناء النظيف من الصفر مضمون
بمهمّة `migrations` في CI (`DB-104`)، فما تبقّى هو التأكّد أن الإنتاج ليس متأخّرًا
بترحيلٍ غير مقصود.
