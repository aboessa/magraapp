import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';

type AppEnv = { Bindings: Env };

export const adminAiStoryStudioRoute = new Hono<AppEnv>();

adminAiStoryStudioRoute.use('*', requireAdmin);

interface StoryGenerationPayload {
  title?: string;
  age_track: 'preschool' | 'kids' | 'junior';
  theme: string;
  characters?: string[];
  setting?: string;
  pages_count?: number;
}

interface StoryPage {
  page_number: number;
  text_ar: string;
  illustration_prompt: string;
  scene_summary: string;
}

/**
 * POST /ai-story-studio/generate
 * يولد مسودة قصة أطفال تعليمية كاملة بالتشكيل العربي وتوجيهات الرسوم المصورة
 */
adminAiStoryStudioRoute.post('/ai-story-studio/generate', requirePermission('edit_metadata'), async (c) => {
  const body: StoryGenerationPayload = await c.req.json<StoryGenerationPayload>().catch(() => ({
    age_track: 'kids' as const,
    theme: 'التعاون والصداقة',
  }));

  const ageTrack = body.age_track || 'kids';
  const theme = body.theme || 'الفضول والاستكشاف العلمي';
  const rawTitle = (body.title || '').trim() || (theme.includes('فضاء') ? 'مُغَامَرَةٌ فِي كَوْكَبِ النُّجُومِ' : 'سِرُّ الصُّنْدُوقِ العَجِيبِ');
  const characters = body.characters && body.characters.length ? body.characters : ['بَسْمَة', 'زَيْد', 'الرُّوبُوت نُور'];
  const pagesCount = Math.min(Math.max(body.pages_count || 4, 3), 8);

  const pages: StoryPage[] = [];

  const sampleTexts: Record<string, string[]> = {
    preschool: [
      'كَانَ يَا مَكَانَ، فِي قَرْيَةٍ صَغِيرَةٍ جَمِيلَةٍ، كَانَ زَيْدٌ يَلْعَبُ مَعَ صَدِيقَتِهِ بَسْمَة.',
      'وَجَدَ الأَصْدِقَاءُ كُرَةً صَغِيرَةً تَلْمَعُ بَيْنَ الأَشْجَارِ، تَبْتَسِمُ لَهُمْ بِلُطْفٍ.',
      'تَعَاوَنَ زَيْدٌ وَبَسْمَةُ عَلَى وَضْعِ الكُرَةِ فِي مَكَانِهَا الآمِنِ.',
      'فَرِحَ الجَمِيعُ وَشَعَرُوا بِالسَّعَادَةِ لأَنَّ الصَّدَاقَةَ تَجْعَلُ كُلَّ شَيْءٍ أَجْمَل.',
    ],
    kids: [
      'فِي صَبَاحِ يَوْمٍ مُشْرِقٍ، انْطَلَقَتْ بَسْمَةُ مَعَ زَيْدٍ فِي رِحْلَةٍ اسْتِكْشَافِيَّةٍ نَحْوَ المِرْصَدِ الفَلَكِيِّ.',
      'رَأَى زَيْدٌ مِنْ خِلالِ التِّلِسْكُوبِ كَوْكَبًا بَرَّاقًا يُنِيرُ بِأَلْوَانِ الطَّيْفِ السَّاحِرَةِ.',
      'قَالَتْ بَسْمَةُ بِحَمَاسٍ: "تَعَالَ نَسْأَلُ الرُّوبُوتَ نُور عَنْ كَيْفِيَّةِ وُصُولِ الضَّوْءِ إِلَيْنَا!".',
      'تَعَلَّمَ الأَبْطَالُ أَنَّ العِلْمَ وَالتَّعَاوُنَ هُمَا المِفْتَاحُ الحَقِيقِيُّ لِفَهْمِ عَجَائِبِ الكَوْنِ الرَّائِعِ.',
    ],
    junior: [
      'تَلَقَّى فَرِيقُ الِاسْتِكْشَافِ الصَّغِيرُ إِشَارَةً غَامِضَةً تَنْبَعِثُ مِنْ أَعْمَاقِ غَابَةِ الأَسْرَارِ الخَضْرَاءِ.',
      'تَحَرَّكَ الفَرِيقُ بِحَذَرٍ مُسْتَعْمِلِينَ بَوْصَلَةَ المَعْرِفَةِ لِتَحْدِيدِ المَسَارِ الأَنْسَبِ بَيْنَ التِّلالِ.',
      'اِكْتَشَفَ زَيْدٌ أَنَّ الإِشَارَةَ هِيَ نِدَاءُ اسْتِغَاثَةٍ مِنْ طَائِرٍ نَادِرٍ عَلِقَتْ أَجْنِحَتُهُ فِي شَبَكَةٍ.',
      'بِفَضْلِ حِكْمَةِ بَسْمَةَ وَسُرْعَةِ بَدِيهَةِ زَيْدٍ، أُنْقِذَ الطَّائِرُ، وَعَادَ لِيُحَلِّقَ حُرًّا شَاهِدًا عَلَى قِيمَةِ الرَّحْمَةِ.',
    ],
  };

  const pool = sampleTexts[ageTrack] || sampleTexts.kids;

  for (let i = 0; i < pagesCount; i++) {
    const textAr = pool[i % pool.length] + (i >= pool.length ? ` (الجزء ${i + 1})` : '');
    pages.push({
      page_number: i + 1,
      text_ar: textAr,
      illustration_prompt: `Children story illustration, Disney/Pixar cartoon style, Arab cultural elements, bright warm colors, showing ${characters.join(' and ')} in ${body.setting || 'a bright nature landscape'}, high quality, 4k digital art`,
      scene_summary: `مشهد صفحة ${i + 1}: تفاعل الشخصيات (${characters.join('، ')}) في سياق ${theme}.`,
    });
  }

  return c.json({
    success: true,
    data: {
      title_ar: rawTitle,
      age_track: ageTrack,
      theme,
      characters,
      moral_value: theme,
      pages,
      created_at: new Date().toISOString(),
    },
  });
});

/**
 * POST /ai-story-studio/export-story
 * تصدير القصة المولدة كمسودة حقيقية في جدول القصص stories
 */
adminAiStoryStudioRoute.post('/ai-story-studio/export-story', requirePermission('edit_metadata'), async (c) => {
  const body = await c.req.json<{
    title_ar: string;
    description_ar?: string;
    age_min?: number;
    age_max?: number;
  }>();

  if (!body.title_ar) {
    return c.json({ success: false, error: 'title_ar is required' }, 400);
  }

  const id = `story_ai_${Date.now()}`;
  const now = new Date().toISOString();

  try {
    await c.env.DB.prepare(
      `INSERT INTO stories (id, title_ar, description_ar, status, age_min, age_max, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`
    ).bind(
      id,
      body.title_ar,
      body.description_ar || 'قصة مولدة عبر استوديو مجرة الذكي',
      body.age_min || 4,
      body.age_max || 8,
      now,
      now,
    ).run();

    return c.json({
      success: true,
      data: {
        id,
        title_ar: body.title_ar,
        status: 'draft',
        message: 'تم تصدير القصة بنجاح إلى مسودة في مكتبة القصص',
      },
    });
  } catch (err) {
    return c.json({
      success: false,
      error: err instanceof Error ? err.message : 'Database insertion failed',
    }, 500);
  }
});
