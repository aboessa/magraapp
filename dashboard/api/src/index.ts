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
import familyRoute from './routes/family.ts';
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
import analyticsIngestRoute from './routes/analyticsIngest.ts';
import notificationsRoute from './routes/notifications.ts';
import homeResolvedRoute from './routes/homeResolved.ts';
import creativeRoute from './routes/creative.ts';
import { handleFamilyEvents } from './queue/familyEvents.ts';
import { handleFamilyEventsDlq } from './queue/dlq.ts';
import {
  handleContentFactoryDlq,
  handleContentFactoryJobs,
  isContentFactoryQueue,
} from './queue/contentFactory.ts';
import { handleScheduled } from './scheduled/cleanup.ts';
import {
  adminLimit,
  analyticsLimit,
  billingLimit,
  creationWriteLimit,
  mediaSessionLimit,
  parentWriteLimit,
  strictAuthLimit,
} from './lib/rateLimit.ts';

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

// عقد CORS في وحدة واحدة (`lib/corsOptions.ts`) لأن الاختبار كان ينسخ الإعداد
// إلى تطبيق خاص به، فبقي أخضر بينما كان حجب ترويسة يكسر العميل فعليًا.
app.use('/api/*', cors(corsOptions));

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
}));
app.get('/health', (c) => c.json({ status: 'ok' }));

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
// Publishing for stories, books, games and projects. Mounted before adminRoute
// because it declares three-segment literals (`/stories/:id/publish`) that must
// not be reached through a generic two-segment route first.
app.route('/api/v1/admin', adminPublishRoute);
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
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(event as ScheduledEvent, env))
  },
};

export default worker;
