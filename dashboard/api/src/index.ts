import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { corsOptions } from './lib/corsOptions.ts';
import type { Env } from './lib/db.ts';
import adminRoute from './routes/admin.ts';
import accountRoute from './routes/account.ts';
import authRoute from './routes/auth.ts';
import billingRoute from './routes/billing.ts';
import booksRoute from './routes/books.ts';
import episodesRoute from './routes/episodes.ts';
import storiesRoute from './routes/stories.ts';
import gamesRoute from './routes/games.ts';
import creationsRoute from './routes/creations.ts';
import adminGamesRoute from './routes/adminGames.ts';
import adminRecommendationsRoute from './routes/adminRecommendations.ts';
import adminPublishRoute from './routes/adminPublish.ts';
import adminAiProvidersRoute from './routes/adminAiProviders.ts';
import familyRoute from './routes/family.ts';
import downloadsRoute from './routes/downloads.ts';
import mediaRoute from './routes/media.ts';
import planetsRoute from './routes/planets.ts';
import seriesRoute from './routes/series.ts';
import adminBillingRoute from './routes/adminBilling.ts';
import adminAnalyticsRoute from './routes/adminAnalytics.ts';
import adminPartnershipsRoute from './routes/adminPartnerships.ts';
import partnershipsRoute from './routes/partnerships.ts';
import adminSiteModeRoute from './routes/adminSiteMode.ts';
import siteModeRoute from './routes/siteMode.ts';
import publicSiteRoute, { siteFiles } from './routes/publicSite.ts';
import publicRenderRoute, { rootNegotiation } from './routes/publicRender.ts';
import adminAuthRoute from './routes/adminAuth.ts';
import adminUsersRoute from './routes/adminUsers.ts';
import adminSearchRoute from './routes/adminSearch.ts';
import adminCalendarRoute from './routes/adminCalendar.ts';
import adminCampaignsRoute from './routes/adminCampaigns.ts';
import appConfigRoute from './routes/appConfig.ts';
import adminEpisodeStreamingRoute from './routes/adminEpisodeStreaming.ts';
import recommendationsRoute from './routes/recommendations.ts';
import childSettingsRoute from './routes/childSettings.ts';
import adminSchoolsRoute from './routes/adminSchools.ts';
import analyticsIngestRoute from './routes/analyticsIngest.ts';
import notificationsRoute from './routes/notifications.ts';
import homeResolvedRoute from './routes/homeResolved.ts';
import creativeRoute from './routes/creative.ts';
import publicCreativeStudioRoute from './routes/publicCreativeStudio.ts';
import adminCreativeStudioRoute from './routes/adminCreativeStudio.ts';
import { handleFamilyEvents } from './queue/familyEvents.ts';
import { handleFamilyEventsDlq } from './queue/dlq.ts';
import {
  handleContentFactoryDlq,
  handleContentFactoryJobs,
  isContentFactoryQueue,
} from './queue/contentFactory.ts';
import { CLEANUP_CRON, handleScheduled } from './scheduled/cleanup.ts';
import { HEALTH_CHECK_CRON, runHealthChecks } from './scheduled/healthChecks.ts';
import { RELEASE } from './lib/release.ts';
import {
  adminLimit,
  analyticsLimit,
  billingLimit,
  creationWriteLimit,
  mediaSessionLimit,
  parentWriteLimit,
  strictAuthLimit,
} from './lib/rateLimit.ts';
import { baseSecurityHeaders } from './lib/securityHeaders.ts';

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

// SEC-108: HSTS و`nosniff` على **كل** استجابة، لا على المستندات وحدها.
//
// HSTS ترويسة على مستوى المضيف لا على مستوى المسار: المتصفّح يخزّنها للنطاق
// كلّه، فوضعها على صفحات HTML وحدها يعني أن أول اتصال بالـAPI لا يثبّت السياسة.
// و`nosniff` رخيصة ولا تكسر شيئًا.
//
// `set` لا `append`، لكن بعد `next()` وبشرط الغياب في حالة `Referrer-Policy`
// وحدها: `routes/media.ts` يضبط `no-referrer` وهي أصرم مما نضعه هنا، فالكتابة
// فوقها كانت ستُرخيها. أي أن هذا الوسيط يرفع الأرضية ولا يخفض سقفًا.
app.use('*', async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(baseSecurityHeaders())) {
    if (name === 'Referrer-Policy' && c.res.headers.has(name)) continue;
    c.res.headers.set(name, value);
  }
});

// عقد CORS في وحدة واحدة (`lib/corsOptions.ts`) لأن الاختبار كان ينسخ الإعداد
// إلى تطبيق خاص به، فبقي أخضر بينما كان حجب ترويسة يكسر العميل فعليًا.
app.use('/api/*', cors(corsOptions));

// ضمان ترميز UTF-8 صريح لكل استجابة JSON — يمنع Mojibake للعربية
// حتى لو Hono افتراضياً يضيف charset، نضمنه هنا لأن بعض العملاء (Dart http)
// يفسرون body كـ Latin1 عند غياب charset.
app.use('/api/*', async (c, next) => {
  await next();
  const ct = c.res.headers.get('Content-Type');
  if (ct && ct.includes('application/json') && !ct.includes('charset')) {
    c.res.headers.set('Content-Type', 'application/json; charset=utf-8');
  }
});

// حماية الحافة - يمنع الإساءة قبل وصولها للـ DO/D1
app.use('/api/v1/auth/*', strictAuthLimit);
app.use('/api/v1/account', strictAuthLimit);
app.use('/api/v1/account/*', strictAuthLimit);
app.use('/api/v1/billing/*', billingLimit);
app.use('/api/v1/admin/*', adminLimit);
// Telemetry writes a D1 row per call and accepts an anonymous `app_open`, so it
// needs its own quota. Its absence here was half of the ingest defect.
app.use('/api/v1/analytics/*', analyticsLimit);

// Session minting on the media path.
//
// `POST /episodes/:id/playback-sessions`, `/books/:id/audio-sessions` and
// `/stories/:id/audio-sessions` each mint a lease plus a capability token inside
// the family object. They were the most expensive authenticated writes in the API
// and had no quota at all, so a loop could farm media tokens as fast as the
// object would answer. Registered by prefix rather than by exact path because a
// limiter that misses a route is worse than a slightly wide one — and the reads
// on these prefixes are cheap enough that 40/minute never troubles a real child.
app.use('/api/v1/episodes/*', mediaSessionLimit);
app.use('/api/v1/books/*', mediaSessionLimit);
app.use('/api/v1/stories/*', mediaSessionLimit);
// Signed-media redemption. A short-lived token, but an unbounded redemption rate
// is still an egress amplifier.
app.use('/api/v1/media/*', mediaSessionLimit);

// جلسات التنزيل: كل نداء يُصدر قدرات وسائط، فحدّه حدّ مسار الوسائط.
app.use('/api/v1/downloads', mediaSessionLimit);
app.use('/api/v1/downloads/*', mediaSessionLimit);

// Parental-control writes, counted per parent rather than per address.
app.use('/api/v1/child-settings/*', parentWriteLimit);
app.use('/api/v1/notifications/*', parentWriteLimit);
app.use('/api/v1/family/*', parentWriteLimit);

// The one child-path endpoint that writes an R2 object, so an unconstrained loop
// costs storage rather than only CPU.
app.use('/api/v1/creations', creationWriteLimit);
app.use('/api/v1/creations/*', creationWriteLimit);

// تفاوض اللغة على الجذر قبل وصف الـAPI: المتصفّح يُحوَّل إلى /ar أو /en أو /fr،
// وأي عميل غير HTML يمرّ بـnext() إلى الوصف أدناه. باقي عارض الصفحات العامة
// مركّب في نهاية الملف بعد كل مسارات الـAPI، فلا يمكن لمقطع لغة أن يحجب
// /health أو /robots.txt أو /api/*.
app.route('/', rootNegotiation);

app.get('/', (c) => c.json({
  name: 'Majarra API',
  version: c.env.API_VERSION,
  environment: c.env.ENVIRONMENT,
  status: 'ok',
  release: RELEASE.commit,
}));
app.get('/health', (c) => c.json({ status: 'ok' }));

// أيّ إصدارٍ يعمل الآن؟ (`OPS-105`)
//
// السؤال لم يكن له جواب: النشر كان يدويًّا وغير موثَّق، و`API_VERSION` قيمتها `v1`
// دائمًا لأنها عقد الـAPI لا هوية البناء. والجواب يُؤخَذ من **الإنتاج نفسه** لا من
// سجلٍّ يُكتب بجانبه، لأن السجل يفترق عن الواقع أوّل مرّة يُنشر بيدٍ.
//
// وهي أيضًا ما يجعل النشر مُتحقَّقًا منه: مسار النشر يقرأ هذه النقطة بعد النشر
// ويوازن البصمة بالـcommit الذي بناه، فلا «نشرٌ نجح» ونسخةٌ قديمة تعمل.
//
// عامّة بلا مصادقة، وبصمة مقتطعة إلى ١٢ محرفًا: يُحتاج إليها في حادثةٍ ليلًا بلا
// مفتاح، والاثنا عشر تكفي للمطابقة. والكاملة في وسم الإصدار في git.
app.get('/version', (c) => c.json({
  commit: RELEASE.commit,
  built_at: RELEASE.builtAt,
  run: RELEASE.run,
  environment: c.env.ENVIRONMENT,
  api_version: c.env.API_VERSION,
}));

// مصادقة اللوحة قبل adminRoute: مسارات الدخول لا يمكن أن تتطلّب جلسة لأنها
// هي التي تُنشئها، وترتيب التركيب يجعل حرس adminRoute لا يمسّها.
app.route('/api/v1/admin/auth', adminAuthRoute);
// البحث الشامل والتقويم قبل adminRoute: كلاهما يعلن مساره الكامل (`/search`,
// `/calendar`) ويحرس نفسه بـrequireAdmin، وتركيبهما هنا يجعلهما يُطابَقان قبل
// أي مسار عام في adminRoute.
app.route('/api/v1/admin', adminSearchRoute);
app.route('/api/v1/admin', adminCalendarRoute);
app.route('/api/v1/admin', adminCampaignsRoute);
// Drawing-game readiness, ops and production queues. **Before** adminRoute, not after.
//
// Mounted after it, `GET /admin/games/ops` and `GET /admin/games/analytics` were both
// swallowed by `route.get('/games/:id')` in adminContent.ts — two segments each, so the
// literal `ops` and `analytics` bound as an id and the answer was
// `{"error":"Game not found"}` with a 404. The Games Operations screen therefore never
// worked, and no unit test could see it: those tests call the route module directly, so the
// shadowing only exists once both are mounted on one app. Found by the browser run, which
// watches the console of every route.
//
// Same class of defect as the billing and analytics double-prefix bug recorded below.
app.route('/api/v1/admin', adminGamesRoute);
// Declares its full path (`/recommendations`) and guards itself with
// requireAdmin, so it is mounted before adminRoute for the same reason the
// routers above are: a two-segment literal must not bind as an `:id` on a
// generic admin route.
app.route('/api/v1/admin', adminRecommendationsRoute);
// B2B Schools — must be before adminRoute otherwise /:id swallows
app.route('/api/v1/admin', adminSchoolsRoute);
// Publishing for stories, books, games and projects. Mounted before adminRoute
// because it declares three-segment literals (`/stories/:id/publish`) that must
// not be reached through a generic two-segment route first.
app.route('/api/v1/admin', adminPublishRoute);
// سجل مزوّدي الذكاء الاصطناعي. قبل adminRoute لأن مساراته متعدّدة المقاطع
// (`/ai/models/:id/probe`, `/ai/tasks/:taskId/routes`)، وهي نفس العلّة التي
// أصابت `/admin/games/ops` و`/admin/billing/*` من قبل. ويحرس نفسه بـrequireAdmin
// لأن التركيب المباشر لا يورّث حرس adminRoute.
app.route('/api/v1/admin', adminAiProvidersRoute);
// استوديو المبدعين admin — قبل adminRoute نفس علة billing/ops: لو بعده، /games/:id يبتلعها
// كان في السطر الأخير وفشل لوحة الإدارة بالوصول لها. R2-first كامل.
app.route('/api/v1/admin', adminCreativeStudioRoute);
app.route('/api/v1/admin', adminRoute);
app.route('/api/v1/auth', authRoute);
app.route('/api/v1/account', accountRoute);
app.route('/api/v1/billing', billingRoute);
app.route('/api/v1/media', mediaRoute);
app.route('/api/v1/planets', planetsRoute);
app.route('/api/v1/series', seriesRoute);
app.route('/api/v1/episodes', episodesRoute);
app.route('/api/v1/games', gamesRoute);
app.route('/api/v1/creations', creationsRoute);
app.route('/api/v1/books', booksRoute);
app.route('/api/v1/stories', storiesRoute);
app.route('/api/v1/family', familyRoute);
// ENC-001: جلسة التنزيل تُصدر قدرات وسائط وترخيصًا موقَّعًا، فحصّتها حصّة مسار
// الوسائط لا حصّة الكتابة الأبوية: كل جلسة تُصدر توكنات، وهي أغلى ما يُمنَح.
app.route('/api/v1/downloads', downloadsRoute);
app.route('/api/v1/partnerships', partnershipsRoute);
// حالة الموقع عامة بلا مصادقة: صفحة الهبوط تستعلم عنها قبل أن تعرض أي شيء
app.route('/api/v1/site-mode', siteModeRoute);
app.route('/api/v1/admin', adminEpisodeStreamingRoute);
app.route('/api/v1/app-config', appConfigRoute);
app.route('/api/v1/recommendations', recommendationsRoute);
app.route('/api/v1/child-settings', childSettingsRoute);
app.route('/api/v1/analytics', analyticsIngestRoute);
app.route('/api/v1/notifications', notificationsRoute);
app.route('/api/v1/home', homeResolvedRoute);
app.route('/api/v1', creativeRoute);
// المحتوى العام للموقع والمدونة: صفحات، مقالات، حلّ المسار والتحويلات، وكل
// بيانات الرأس (canonical/robots/OG/hreflang/JSON-LD) محسوبة على الخادم.
app.route('/api/v1/site', publicSiteRoute);
// sitemap.xml وrobots.txt على الجذر: يجلبهما الزاحف مباشرةً ولا يشغّل التطبيق.
app.route('/', siteFiles);
// يُركَّبان على /api/v1/admin لا على بادئتهما الكاملة.
//
// معالِجاتهما تصرّح بمسارات كاملة بالفعل (`/billing/stats`، `/analytics/overview`)،
// فتركيبهما على `/api/v1/admin/billing` كان يضاعف البادئة وينتج
// `/api/v1/admin/billing/billing/stats`. النتيجة أن كل نقاط الفواتير
// والتحليلات كانت تُعيد 404 ولم تعمل قط، وأخفى ذلك أن الحرس يرفض بـ401 قبل
// أن يصل الطلب إلى التوجيه فبدت الاستجابة كأنها مشكلة صلاحيات.
app.route('/api/v1/admin', adminBillingRoute);
app.route('/api/v1/admin', adminAnalyticsRoute);
app.route('/api/v1/admin/partnerships', adminPartnershipsRoute);
app.route('/api/v1/admin/site-mode', adminSiteModeRoute);
// إدارة المستخدمين تُركَّب على نفس البادئة قبل adminRoute، فمساراتها /users
// تُطابق أولًا. مركّبة صراحةً لا داخل adminRoute حتى لا تعتمد على ترتيب
// التركيب هناك.
app.route('/api/v1/admin', adminUsersRoute);
// public creative studio — قبل publicRenderRoute و publicSite حتى لا يعترضها
// مقاطع اللغة العامة. كان ناقصاً تماماً سابقاً!
app.route('/api/v1', publicCreativeStudioRoute);
// Drawing-game readiness and preview are mounted above, before adminRoute.

// عارض الصفحات العامة كـHTML كامل في المستند الأول (SEO).
//
// آخر تركيب قبل notFound عن قصد: مقاطعه (`/:language`, `/:language/:slug`) عامّة،
// فلو رُكِّب قبل مسارات الـAPI لحجب /health و/robots.txt و/api/*. كل معالِج فيه
// يتحقّق أن المقطع الأول لغة CMS ويُمرّر ما عداه بـnext() إلى معالِج 404.
app.route('/', publicRenderRoute);

app.notFound((c) => c.json({ success: false, error: 'Route not found' }, 404));
app.onError((error, c) => {
  console.error('worker_request_error', error instanceof Error ? error.message : String(error));
  return c.json({ success: false, error: 'Internal server error' }, 500);
});

export { FamilyState } from './do/FamilyState.ts';
export { IdentityState } from './do/IdentityState.ts';
export { StoryCollab } from './do/StoryCollab.ts';
export { RateLimiter } from './do/RateLimiter.ts';

const worker: ExportedHandler<Env, unknown> = {
  fetch: app.fetch,
  async queue(batch, env, ctx) {
    // Paid content jobs have a dedicated contract and consumer. They must never
    // fall through to the family-event parser (or its DLQ) merely because both
    // are Cloudflare Queues.
    const queueName = (batch as any).queue ?? ''
    if (isContentFactoryQueue(queueName)) {
      if (queueName.includes('-dlq')) {
        return handleContentFactoryDlq(batch as MessageBatch<unknown>, env)
      }
      return handleContentFactoryJobs(batch as MessageBatch<unknown>, env)
    }
    if (queueName.includes('-dlq')) {
      return handleFamilyEventsDlq(batch as MessageBatch<unknown>, env)
    }
    return handleFamilyEvents(batch as MessageBatch<unknown>, env)
  },
  /// OPS-106: جدولان لا واحد.
  ///
  /// التنظيف يوميّ (`0 3 * * *`) والفحص كل خمس دقائق (`*/5 * * * *`). والتوزيع
  /// هنا **صريح**: لو أُضيف تعبير في `wrangler.jsonc` بلا فرع هنا، لصار الجدول
  /// يعمل ولا يفعل شيئًا — عطلٌ صامت لا يُنتج خطأً في أي سجلّ.
  async scheduled(event, env, ctx) {
    const cron = (event as ScheduledEvent).cron
    if (cron === HEALTH_CHECK_CRON) {
      ctx.waitUntil(runHealthChecks(env).then(
        (result) => console.log('health_checks', result.written, 'raised', result.raised),
        (error) => console.error('health_checks_failed', error),
      ))
      return
    }
    if (cron === CLEANUP_CRON) {
      ctx.waitUntil(handleScheduled(event as ScheduledEvent, env))
      return
    }
    console.error('unhandled_cron', cron)
  },
};

export default worker;
