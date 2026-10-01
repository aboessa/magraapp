import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';

type AppEnv = { Bindings: Env };

export const adminLiveEventsRoute = new Hono<AppEnv>();

adminLiveEventsRoute.use('*', requireAdmin);

export interface LiveEvent {
  id: string;
  title_ar: string;
  title_en: string;
  description_ar: string;
  banner_color: string;
  target_track: 'all' | 'preschool' | 'kids' | 'junior';
  reward_multiplier: number; // e.g. 2 for 2x Stars
  badge_reward_name: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  participants_count: number;
}

const DEFAULT_EVENTS: LiveEvent[] = [
  {
    id: 'evt_ramadan_2026',
    title_ar: 'تحدي رمضان: فوانيس المعرفة',
    title_en: 'Ramadan Quest: Lanterns of Wisdom',
    description_ar: 'شاهد حلقة يومية واجمع فوانيس رمضان لمضاعفة نجومك والحصول على وسام الفانوس الذهبي.',
    banner_color: '#8b5cf6',
    target_track: 'all',
    reward_multiplier: 2.0,
    badge_reward_name: 'وسام الفانوس الذهبي',
    starts_at: '2026-03-01T00:00:00Z',
    ends_at: '2026-03-31T23:59:59Z',
    is_active: true,
    participants_count: 1420,
  },
  {
    id: 'evt_reading_week',
    title_ar: 'أسبوع القراءة العربي للبراعم',
    title_en: 'Arab Reading Week for Kids',
    description_ar: 'أكمل قراءة 3 قصص مصورة مع تسجيل صوتك في تمرين القراءة لتحصل على تاج القارئ المبدع.',
    banner_color: '#059669',
    target_track: 'preschool',
    reward_multiplier: 1.5,
    badge_reward_name: 'تاج القارئ المبدع',
    starts_at: '2026-04-10T00:00:00Z',
    ends_at: '2026-04-17T23:59:59Z',
    is_active: false,
    participants_count: 850,
  },
  {
    id: 'evt_science_olympiad',
    title_ar: 'أولمبياد الفضاء والرياضيات',
    title_en: 'Space & Math Olympiad',
    description_ar: 'حل اختبارات كوكب العلوم السريعة وتنافس مع أبطال مجرة لتتصدر لوحة الشرف الأسبوعية.',
    banner_color: '#0284c7',
    target_track: 'kids',
    reward_multiplier: 3.0,
    badge_reward_name: 'وسام رائد الفضاء الصغير',
    starts_at: '2026-05-01T00:00:00Z',
    ends_at: '2026-05-07T23:59:59Z',
    is_active: false,
    participants_count: 2100,
  },
];

let eventsStore: LiveEvent[] = [...DEFAULT_EVENTS];

/**
 * GET /live-events
 */
adminLiveEventsRoute.get('/live-events', async (c) => {
  return c.json({
    success: true,
    data: eventsStore,
    meta: {
      total: eventsStore.length,
      active: eventsStore.filter(e => e.is_active).length,
      total_participants: eventsStore.reduce((acc, e) => acc + e.participants_count, 0),
    },
  });
});

/**
 * POST /live-events
 */
adminLiveEventsRoute.post('/live-events', requirePermission('edit_metadata'), async (c) => {
  const body: Partial<LiveEvent> = await c.req.json<Partial<LiveEvent>>().catch(() => ({}));
  if (!body.title_ar) {
    return c.json({ success: false, error: 'title_ar is required' }, 400);
  }

  const newEvent: LiveEvent = {
    id: `evt_${Date.now()}`,
    title_ar: body.title_ar,
    title_en: body.title_en || body.title_ar,
    description_ar: body.description_ar || '',
    banner_color: body.banner_color || '#3b82f6',
    target_track: body.target_track || 'all',
    reward_multiplier: Number(body.reward_multiplier) || 1.5,
    badge_reward_name: body.badge_reward_name || 'وسام التحدي',
    starts_at: body.starts_at || new Date().toISOString(),
    ends_at: body.ends_at || new Date(Date.now() + 7 * 86400000).toISOString(),
    is_active: body.is_active ?? true,
    participants_count: 0,
  };

  eventsStore.unshift(newEvent);

  return c.json({ success: true, data: newEvent });
});

/**
 * PATCH /live-events/:id
 */
adminLiveEventsRoute.patch('/live-events/:id', requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  const body: Partial<LiveEvent> = await c.req.json<Partial<LiveEvent>>().catch(() => ({}));

  const item = eventsStore.find(e => e.id === id);
  if (!item) {
    return c.json({ success: false, error: 'Event not found' }, 404);
  }

  if (body.title_ar !== undefined) item.title_ar = body.title_ar;
  if (body.title_en !== undefined) item.title_en = body.title_en;
  if (body.description_ar !== undefined) item.description_ar = body.description_ar;
  if (body.banner_color !== undefined) item.banner_color = body.banner_color;
  if (body.target_track !== undefined) item.target_track = body.target_track;
  if (body.reward_multiplier !== undefined) item.reward_multiplier = Number(body.reward_multiplier);
  if (body.badge_reward_name !== undefined) item.badge_reward_name = body.badge_reward_name;
  if (body.starts_at !== undefined) item.starts_at = body.starts_at;
  if (body.ends_at !== undefined) item.ends_at = body.ends_at;
  if (body.is_active !== undefined) item.is_active = Boolean(body.is_active);

  return c.json({ success: true, data: item });
});

/**
 * DELETE /live-events/:id
 */
adminLiveEventsRoute.delete('/live-events/:id', requirePermission('edit_metadata'), async (c) => {
  const id = c.req.param('id');
  const idx = eventsStore.findIndex(e => e.id === id);
  if (idx === -1) {
    return c.json({ success: false, error: 'Event not found' }, 404);
  }

  eventsStore.splice(idx, 1);
  return c.json({ success: true, data: { deleted: true, id } });
});
