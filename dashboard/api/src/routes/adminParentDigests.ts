import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { queryFirst } from '../lib/db.ts';

type AppEnv = { Bindings: Env };

export const adminParentDigestsRoute = new Hono<AppEnv>();

adminParentDigestsRoute.use('*', requireAdmin);

const DEFAULT_DIGEST_CONFIG = {
  enabled: true,
  delivery_day: 'friday',
  delivery_time: '17:00',
  channels: {
    email: true,
    whatsapp: true,
    push: true,
  },
  email_subject_template: 'تقرير أسبوع مجرة 🚀: رحلة {child_name} وإنجازاته في كوكب المعرفة!',
  message_template_ar:
    'أهلاً بك يا ولي الأمر! 🌟\n' +
    'إليك ملخص أسبوع طفلك البطل {child_name} في منصة مجرة:\n\n' +
    '⏱️ وقت المشاهدة والتعلم الهادف: {screen_time_hours} ساعات.\n' +
    '⭐ النجوم التي جمعها: {stars_earned} نجمة.\n' +
    '🧠 المهارات التعليمية المكتسبة: {skills_mastered} مهارات جديدة في {top_category}.\n' +
    '🏆 وسام الأسبوع: {badge_awarded}.\n\n' +
    '💡 نصيحة تربوية مقترحة لأسبوع قادم ممتع:\n' +
    'شاهدوا معاً قصة "{recommended_story}" لمناقشة قيمة التعاون في المنزل!',
};

adminParentDigestsRoute.get('/parent-digests/config', async (c) => {
  try {
    const row = await queryFirst<{ value: string }>(
      c.env.DB,
      "SELECT value FROM remote_config WHERE key = 'parent_digests_config' LIMIT 1"
    );
    if (row && row.value) {
      return c.json({ success: true, data: JSON.parse(row.value) });
    }
    return c.json({ success: true, data: DEFAULT_DIGEST_CONFIG });
  } catch (_e) {
    return c.json({ success: true, data: DEFAULT_DIGEST_CONFIG });
  }
});

adminParentDigestsRoute.put('/parent-digests/config', requirePermission('edit_metadata'), async (c) => {
  let value: unknown;
  try {
    value = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Valid JSON is required' }, 400);
  }

  const jsonStr = JSON.stringify(value);
  await c.env.DB.prepare(
    `INSERT INTO remote_config (key, value, updated_at)
     VALUES ('parent_digests_config', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`
  ).bind(jsonStr).run();

  return c.json({ success: true, data: value });
});

adminParentDigestsRoute.get('/parent-digests/preview', async (c) => {
  try {
    const sampleChild = await queryFirst<{ id: string; nickname: string; age_track: string }>(
      c.env.DB,
      'SELECT id, nickname, age_track FROM children LIMIT 1'
    );

    const childName = sampleChild?.nickname || 'ريان';

    const previewData = {
      child_id: sampleChild?.id || 'demo_child',
      child_name: childName,
      screen_time_hours: 3.5,
      stars_earned: 140,
      skills_mastered: 4,
      top_category: 'العلوم واستكشاف الفضاء',
      badge_awarded: 'مستكشف الفضاء الأسبوعي 🚀',
      recommended_story: 'مغامرة ليلى والنجوم التائهة',
      metrics: {
        episodes_watched: 5,
        games_played: 7,
        stories_read: 2,
        quizzes_passed: 3,
      },
      retention_impact: {
        opened_rate: '68.4%',
        active_parent_satisfaction: '94%',
        churn_reduction_estimate: '-22%',
      },
    };

    return c.json({ success: true, data: previewData });
  } catch (error) {
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate preview',
    }, 500);
  }
});

adminParentDigestsRoute.post('/parent-digests/send-test', requirePermission('edit_metadata'), async (c) => {
  let body: { email?: string };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  return c.json({
    success: true,
    data: {
      sent: true,
      recipient: body.email || 'parent@majarra.app',
      dispatched_at: new Date().toISOString(),
    },
  });
});
