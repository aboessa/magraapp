import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';

type AppEnv = { Bindings: Env };

export const adminScreentimeRoute = new Hono<AppEnv>();

adminScreentimeRoute.use('*', requireAdmin);

export interface TrackPolicy {
  track: 'preschool' | 'kids' | 'junior';
  daily_limit_minutes: number;
  bedtime_lock_enabled: boolean;
  bedtime_start: string; // "20:00"
  bedtime_end: string;   // "07:00"
  break_interval_minutes: number; // e.g. 20 min reminder
  learn_before_play: boolean; // Must finish educational content before games
  learn_required_minutes: number;
}

export interface ScreentimeGlobalConfig {
  policies: TrackPolicy[];
  strict_pin_lock: boolean;
  allow_parent_override: boolean;
  eye_care_blue_light_reminder: boolean;
  updated_at: string;
}

let screentimeConfig: ScreentimeGlobalConfig = {
  policies: [
    {
      track: 'preschool',
      daily_limit_minutes: 45,
      bedtime_lock_enabled: true,
      bedtime_start: '19:30',
      bedtime_end: '07:30',
      break_interval_minutes: 15,
      learn_before_play: true,
      learn_required_minutes: 15,
    },
    {
      track: 'kids',
      daily_limit_minutes: 60,
      bedtime_lock_enabled: true,
      bedtime_start: '20:30',
      bedtime_end: '07:00',
      break_interval_minutes: 20,
      learn_before_play: true,
      learn_required_minutes: 20,
    },
    {
      track: 'junior',
      daily_limit_minutes: 90,
      bedtime_lock_enabled: true,
      bedtime_start: '21:30',
      bedtime_end: '06:30',
      break_interval_minutes: 30,
      learn_before_play: false,
      learn_required_minutes: 0,
    },
  ],
  strict_pin_lock: true,
  allow_parent_override: true,
  eye_care_blue_light_reminder: true,
  updated_at: new Date().toISOString(),
};

/**
 * GET /screentime-policies
 */
adminScreentimeRoute.get('/screentime-policies', async (c) => {
  return c.json({
    success: true,
    data: screentimeConfig,
  });
});

/**
 * PUT /screentime-policies
 */
adminScreentimeRoute.put('/screentime-policies', requirePermission('edit_metadata'), async (c) => {
  const body: Partial<ScreentimeGlobalConfig> = await c.req.json<Partial<ScreentimeGlobalConfig>>().catch(() => ({}));

  if (body.policies && Array.isArray(body.policies)) {
    screentimeConfig.policies = body.policies;
  }
  if (body.strict_pin_lock !== undefined) screentimeConfig.strict_pin_lock = Boolean(body.strict_pin_lock);
  if (body.allow_parent_override !== undefined) screentimeConfig.allow_parent_override = Boolean(body.allow_parent_override);
  if (body.eye_care_blue_light_reminder !== undefined) screentimeConfig.eye_care_blue_light_reminder = Boolean(body.eye_care_blue_light_reminder);
  screentimeConfig.updated_at = new Date().toISOString();

  return c.json({
    success: true,
    data: screentimeConfig,
    message: 'تم تحديث سياسات وقت الشاشة والرقابة الأبوية بنجاح',
  });
});
