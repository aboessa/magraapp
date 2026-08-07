import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/db';
import adminRoute from './routes/admin';
import authRoute from './routes/auth';
import billingRoute from './routes/billing';
import episodesRoute from './routes/episodes';
import familyRoute from './routes/family';
import mediaRoute from './routes/media';
import planetsRoute from './routes/planets';
import seriesRoute from './routes/series';
import adminBillingRoute from './routes/adminBilling';
import adminAnalyticsRoute from './routes/adminAnalytics';
import { handleFamilyEvents } from './queue/familyEvents';
import { handleFamilyEventsDlq } from './queue/dlq';
import { handleScheduled } from './scheduled/cleanup';
import { adminLimit, billingLimit, strictAuthLimit } from './lib/rateLimit';

type AppEnv = { Bindings: Env };

const app = new Hono<AppEnv>();

app.use('/api/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-File-Name', 'X-File-Size', 'X-File-SHA256', 'X-Part-Size', 'X-Image-Width', 'X-Image-Height'],
  exposeHeaders: ['Content-Length', 'Content-Range', 'ETag'],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// حماية الحافة - يمنع الإساءة قبل وصولها للـ DO/D1
app.use('/api/v1/auth/*', strictAuthLimit);
app.use('/api/v1/billing/*', billingLimit);
app.use('/api/v1/admin/*', adminLimit);

app.get('/', (c) => c.json({
  name: 'Majarra API',
  version: c.env.API_VERSION,
  environment: c.env.ENVIRONMENT,
  status: 'ok',
}));
app.get('/health', (c) => c.json({ status: 'ok' }));

app.route('/api/v1/admin', adminRoute);
app.route('/api/v1/auth', authRoute);
app.route('/api/v1/billing', billingRoute);
app.route('/api/v1/media', mediaRoute);
app.route('/api/v1/planets', planetsRoute);
app.route('/api/v1/series', seriesRoute);
app.route('/api/v1/episodes', episodesRoute);
app.route('/api/v1/family', familyRoute);
app.route('/api/v1/admin/billing', adminBillingRoute);
app.route('/api/v1/admin/analytics', adminAnalyticsRoute);

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
