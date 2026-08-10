import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/db';
import adminRoute from './routes/admin';
import authRoute from './routes/auth';
import billingRoute from './routes/billing';
import booksRoute from './routes/books';
import episodesRoute from './routes/episodes';
import gamesRoute from './routes/games.ts';
import creationsRoute from './routes/creations.ts';
import adminGamesRoute from './routes/adminGames.ts';
import familyRoute from './routes/family';
import mediaRoute from './routes/media';
import planetsRoute from './routes/planets';
import seriesRoute from './routes/series';
import adminBillingRoute from './routes/adminBilling';
import adminAnalyticsRoute from './routes/adminAnalytics';
import adminPartnershipsRoute from './routes/adminPartnerships';
import partnershipsRoute from './routes/partnerships';
import adminSiteModeRoute from './routes/adminSiteMode';
import siteModeRoute from './routes/siteMode';
import publicSiteRoute, { siteFiles } from './routes/publicSite.ts';
import publicRenderRoute, { rootNegotiation } from './routes/publicRender.ts';
import adminAuthRoute from './routes/adminAuth';
import adminUsersRoute from './routes/adminUsers';
import adminSearchRoute from './routes/adminSearch.ts';
import adminCalendarRoute from './routes/adminCalendar.ts';
import { handleFamilyEvents } from './queue/familyEvents';
import { handleFamilyEventsDlq } from './queue/dlq';
import { handleScheduled } from './scheduled/cleanup';
import { adminLimit, billingLimit, strictAuthLimit } from './lib/rateLimit';

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

app.use('/api/*', cors({
  origin: '*',
  // X-Admin-Actor يُرسله عميل اللوحة على كل نداء إدارة (lib/api.ts).
  // غيابه من هذه القائمة يجعل المتصفح يحجب النداء بعد نجاح الـpreflight،
  // فتفشل اللوحة كلها عبر الأصول (majarra.app ← api.majarra.app) بلا خطأ ظاهر.
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Admin-Actor', 'X-File-Name', 'X-File-Size', 'X-File-SHA256', 'X-Part-Size', 'X-Image-Width', 'X-Image-Height'],
  exposeHeaders: ['Content-Length', 'Content-Range', 'ETag'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// حماية الحافة - يمنع الإساءة قبل وصولها للـ DO/D1
app.use('/api/v1/auth/*', strictAuthLimit);
app.use('/api/v1/billing/*', billingLimit);
app.use('/api/v1/admin/*', adminLimit);

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
app.route('/api/v1/admin', adminRoute);
app.route('/api/v1/auth', authRoute);
app.route('/api/v1/billing', billingRoute);
app.route('/api/v1/media', mediaRoute);
app.route('/api/v1/planets', planetsRoute);
app.route('/api/v1/series', seriesRoute);
app.route('/api/v1/episodes', episodesRoute);
app.route('/api/v1/games', gamesRoute);
app.route('/api/v1/creations', creationsRoute);
app.route('/api/v1/books', booksRoute);
app.route('/api/v1/family', familyRoute);
app.route('/api/v1/partnerships', partnershipsRoute);
// حالة الموقع عامة بلا مصادقة: صفحة الهبوط تستعلم عنها قبل أن تعرض أي شيء
app.route('/api/v1/site-mode', siteModeRoute);
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
// Drawing-game readiness and preview. Mounted on the admin prefix like the
// billing and analytics routes, whose handlers also declare full paths.
app.route('/api/v1/admin', adminGamesRoute);

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

export { FamilyState } from './do/FamilyState';
export { IdentityState } from './do/IdentityState';
export { StoryCollab } from './do/StoryCollab';

const worker: ExportedHandler<Env, unknown> = {
  fetch: app.fetch,
  async queue(batch, env, ctx) {
    // وجه كل batch حسب اسم الطابور
    const queueName = (batch as any).queue ?? ''
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
