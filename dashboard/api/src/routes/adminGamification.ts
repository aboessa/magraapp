import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { queryFirst } from '../lib/db.ts';

type AppEnv = { Bindings: Env };

export const adminGamificationRoute = new Hono<AppEnv>();

adminGamificationRoute.use('*', requireAdmin);

const DEFAULT_GAMIFICATION_CONFIG = {
  streaks: {
    enabled: true,
    max_multiplier: 3.0,
    daily_rewards: [
      { day: 1, stars: 10, bonus: null },
      { day: 2, stars: 15, bonus: null },
      { day: 3, stars: 25, bonus: 'double_stars_30m' },
      { day: 4, stars: 30, bonus: null },
      { day: 5, stars: 40, bonus: 'special_avatar_frame' },
      { day: 6, stars: 50, bonus: null },
      { day: 7, stars: 100, bonus: 'super_cosmic_chest' },
    ],
  },
  economy: {
    stars_per_episode: 20,
    stars_per_game_completed: 15,
    stars_per_story_read: 25,
    stars_per_perfect_drawing: 30,
    stars_per_quiz_passed: 40,
    daily_cap: 500,
  },
  badges: [
    { id: 'b_explorer', code: 'space_explorer', name_ar: 'مستكشف الفضاء', name_en: 'Space Explorer', icon: '🚀', category: 'exploration', unlock_condition: 'visit_all_planets', stars_reward: 100 },
    { id: 'b_bookworm', code: 'story_master', name_ar: 'حكيم القصص', name_en: 'Story Master', icon: '📚', category: 'reading', unlock_condition: 'read_10_stories', stars_reward: 150 },
    { id: 'b_artist', code: 'creative_artist', name_ar: 'فنان مجرة', name_en: 'Majarra Artist', icon: '🎨', category: 'creativity', unlock_condition: 'complete_15_drawings', stars_reward: 200 },
    { id: 'b_streak7', code: 'streak_week', name_ar: 'بطل الاستمرار', name_en: 'Weekly Champion', icon: '🔥', category: 'consistency', unlock_condition: 'login_7_days_streak', stars_reward: 250 },
    { id: 'b_scholar', code: 'quiz_genius', name_ar: 'عبقري الأسئلة', name_en: 'Quiz Genius', icon: '🧠', category: 'learning', unlock_condition: 'pass_5_quizzes_perfect', stars_reward: 300 },
  ],
  parent_controls: {
    require_parent_approval_for_redemptions: true,
    weekly_screen_time_milestone_reward: true,
    allow_custom_parent_rewards: true,
  },
};

adminGamificationRoute.get('/gamification', async (c) => {
  try {
    const row = await queryFirst<{ value: string }>(
      c.env.DB,
      "SELECT value FROM remote_config WHERE key = 'gamification_config' LIMIT 1"
    );

    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      return c.json({ success: true, data: parsed });
    }

    return c.json({ success: true, data: DEFAULT_GAMIFICATION_CONFIG });
  } catch (_e) {
    return c.json({ success: true, data: DEFAULT_GAMIFICATION_CONFIG });
  }
});

adminGamificationRoute.put('/gamification', requirePermission('edit_metadata'), async (c) => {
  let value: unknown;
  try {
    value = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'A JSON object is required' }, 400);
  }
  if (!value || typeof value !== 'object') {
    return c.json({ success: false, error: 'Valid gamification config JSON object is required' }, 400);
  }

  const jsonStr = JSON.stringify(value);

  await c.env.DB.prepare(
    `INSERT INTO remote_config (key, value, updated_at)
     VALUES ('gamification_config', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = datetime('now')`
  ).bind(jsonStr).run();

  return c.json({ success: true, data: value });
});
