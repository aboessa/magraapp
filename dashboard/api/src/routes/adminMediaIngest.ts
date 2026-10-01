import { Hono } from 'hono';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { queryAll } from '../lib/db.ts';

type AppEnv = { Bindings: Env };

export const adminMediaIngestRoute = new Hono<AppEnv>();

adminMediaIngestRoute.use('*', requireAdmin);

interface EpisodeLookup {
  id: string;
  title_ar: string;
  series_id: string;
  series_title: string | null;
  season_number: number;
  episode_number: number;
}

adminMediaIngestRoute.post('/media-ingest/match', requirePermission('edit_metadata'), async (c) => {
  let body: { filenames: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON payload is required' }, 400);
  }

  const filenames = Array.isArray(body?.filenames) ? body.filenames : [];
  if (filenames.length === 0) {
    return c.json({ success: true, data: { matches: [] } });
  }

  // Load active episodes for matching
  const episodes = await queryAll<EpisodeLookup>(
    c.env.DB,
    `SELECT e.id, e.title_ar, e.series_id, s.title_ar as series_title,
            IFNULL(se.season_number, 1) as season_number, e.episode_number
     FROM episodes e
     LEFT JOIN series s ON e.series_id = s.id
     LEFT JOIN seasons se ON e.season_id = se.id
     LIMIT 500`
  );

  const matches = filenames.map((filename) => {
    const clean = filename.toLowerCase();

    // Detect field
    let field: 'thumbnail_url' | 'video_url' | 'subtitles' = 'video_url';
    if (/\b(thumb|poster|cover|art)\b|\.(jpg|jpeg|webp|png)$/i.test(clean)) {
      field = 'thumbnail_url';
    } else if (/\b(sub|subtitle|vtt|srt)\b|\.(vtt|srt)$/i.test(clean)) {
      field = 'subtitles';
    }

    // Match episode number: e05, ep05, ep_5, episode_5, _05
    const epMatch = clean.match(/(?:ep?|episode|حلقة|الحلقة)[_\-\s]*(\d+)/i) || clean.match(/[_\-\s](\d{1,3})[_\-\.]/);
    const parsedEpNum = epMatch ? parseInt(epMatch[1], 10) : null;

    // Match season number: s01, s1, season1
    const seasonMatch = clean.match(/(?:s|season|موسم)[_\-\s]*(\d+)/i);
    const parsedSeasonNum = seasonMatch ? parseInt(seasonMatch[1], 10) : null;

    let candidate = parsedEpNum
      ? episodes.find((ep) => {
          const epMatches = ep.episode_number === parsedEpNum;
          if (parsedSeasonNum) {
            return epMatches && ep.season_number === parsedSeasonNum;
          }
          return epMatches;
        })
      : null;

    return {
      filename,
      detected_field: field,
      parsed_episode_number: parsedEpNum,
      parsed_season_number: parsedSeasonNum,
      matched_episode_id: candidate ? candidate.id : null,
      episode_title: candidate ? candidate.title_ar : null,
      series_title: candidate ? candidate.series_title : null,
      confidence: candidate ? 'high' : 'unmatched',
    };
  });

  return c.json({
    success: true,
    data: {
      total: filenames.length,
      matched: matches.filter((m) => m.matched_episode_id !== null).length,
      matches,
    },
  });
});

adminMediaIngestRoute.post('/media-ingest/apply', requirePermission('edit_metadata'), async (c) => {
  let body: { updates: Array<{ episode_id: string; field: 'thumbnail_url' | 'video_url'; value: string }> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'JSON payload is required' }, 400);
  }

  const updates = Array.isArray(body?.updates) ? body.updates : [];
  let updatedCount = 0;

  for (const item of updates) {
    if (!item.episode_id || !item.field || !item.value) continue;
    if (item.field === 'thumbnail_url') {
      await c.env.DB.prepare(
        "UPDATE episodes SET thumbnail_url = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(item.value, item.episode_id).run();
      updatedCount += 1;
    }
  }

  return c.json({ success: true, data: { updated: updatedCount } });
});
