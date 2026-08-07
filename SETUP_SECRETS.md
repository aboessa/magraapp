# إعداد الأسرار المطلوبة للإطلاق

هذا الملف يشرح ما تبقى لمنع الإطلاق (7 بنود من التقرير).

## 1. Resend (البريد) - يمنع أي تسجيل

**المطلوب منك:**
- `RESEND_API_KEY` من https://resend.com/api-keys
- نطاق موثق `majarra.app` في Resend -> DNS TXT
- `EMAIL_VERIFICATION_URL` مثال `https://majarra.app/verify?token={token}`

**التطبيق:**
```bash
npx wrangler secret put RESEND_API_KEY --env production
npx wrangler secret put EMAIL_VERIFICATION_URL --env production
# القيم محفوظة في .secrets.local.txt للمرجع المحلي
```

**الكود جاهز:** `dashboard/api/src/services/email.ts` يرجع 503 حتى تُضبط الأسرار، وفي `development` يرجع `development_verification_token` مباشرة.

## 2. Google Play - يمنع الاشتراكات

**المطلوب:**
- في Play Console أنشئ منتجين: `majarra_family` و `majarra_family_plus`
- Service Account مع `Play Developer API` + مفتاح JSON
- فعل RTDN: Pub/Sub topic -> Push to `https://api.majarra.app/api/v1/billing/google-play/rtdn` (أو https://majarra-api-prod.aboessa101.workers.dev/api/v1/billing/google-play/rtdn حتى تفعيل النطاق المخصص)
- الحزمة: `com.majarra.majarra`

```bash
npx wrangler secret put GOOGLE_PLAY_SERVICE_ACCOUNT_JSON --env production
```

## 3. أصل وسائط واحد على الأقل

حتى تختبر `capability -> R2`:

1. افتح `majarra-api-prod.aboessa101.workers.dev/admin` (أو `api.majarra.app/admin`)
2. ارفع فيديو واحد عبر `/api/v1/admin/assets` - سيُنشئ `content_assets` و `R2` object
3. تحقق: `SELECT count(*) FROM content_assets` يجب أن يكون >=1

## 4. حماية الحافة

تمت إضافتها برمجياً في `src/lib/rateLimit.ts` و `src/index.ts`:
- `/auth/*` 5 req/min per IP
- `/billing/*` 20 req/min
- `/admin/*` 30 req/min

وللحماية على الحافة أيضاً فعل WAF Rate Rule في Cloudflare Dashboard:
- Zone `majarra.app` -> Security -> Rate limiting -> Create rule -> `/api/v1/auth/*` 10/10s Block

## 5. نطاق مخصص

تمت إضافته في `wrangler.jsonc` production:
```json
"routes": [{ "pattern": "api.majarra.app/*", "zone_name": "majarra.app" }]
```

**المطلوب:**
- أضف Zone `majarra.app` لحسابك (إن لم يكن)
- غيّر NS لدى المسجل إلى Cloudflare
- `npx wrangler deploy --env production` سيربط المسار

بعدها غيّر RTDN audience إلى `https://api.majarra.app/api/v1/billing/google-play/rtdn`

## 6. Flutter

`app_main/lib/features/home/data/majarra_api_client.dart` الآن يدعم:
```dart
--dart-define=API_BASE_URL=https://api.majarra.app
--dart-define=API_BASE_URL=https://majarra-api-staging.aboessa101.workers.dev
```
وكل من `/auth /family /episodes/playback-session /billing` يرسل `Authorization: Bearer <access_token>` تلقائياً.

## 7. تنظيف (لا يمنع الإطلاق)

- سيتم حذف جداول `0006/0007` الميتة عبر `migrations/0010_cleanup.sql`
- معالجات `/admin/parents` القديمة ستحذف من `admin.ts`
- DLQ consumer سيضاف لـ `family-events-dlq`
- `processed_family_events` سينظف عبر Cron كل 30 يوم
