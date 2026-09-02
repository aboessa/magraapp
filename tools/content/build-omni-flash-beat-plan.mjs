#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import {
  OMNI_FLASH_ALLOWED_DURATIONS,
} from '../content-factory/lib/omni-flash-durations.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PLANETS_ROOT = path.join(ROOT, 'docs', 'content', 'planets');
const OUTPUT_DIR = path.join(ROOT, 'docs', 'content', 'production');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'omni-flash-beat-plan.v1.json');
const REPORT_OUTPUT = path.join(OUTPUT_DIR, 'OMNI_FLASH_BEAT_PLAN.md');
const APPLY = process.argv.includes('--apply');
const GENERATED_START = '<!-- OMNI_FLASH_PRODUCTION_BEATS:START -->';
const GENERATED_END = '<!-- OMNI_FLASH_PRODUCTION_BEATS:END -->';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function seconds(minutes, rest) {
  return Number(minutes) * 60 + Number(rest);
}

function parseScenes(markdown) {
  const pattern = /^### المشهد\s+(\d+)[^\r\n]*?·\s*(\d+):(\d{2})[–-](\d+):(\d{2})/gmu;
  return [...markdown.matchAll(pattern)].map((match) => ({
    editorial_scene: Number(match[1]),
    start_seconds: seconds(match[2], match[3]),
    end_seconds: seconds(match[4], match[5]),
    heading: match[0].replace(/^###\s*/, '').trim(),
  }));
}

function cleanCell(value) {
  return value
    .replace(/\*+/g, '')
    .replace(/`/g, '')
    .replace(/^\s*[«“"]|[»”"]\s*$/g, '')
    .trim();
}

function withoutGeneratedPlan(markdown) {
  const start = markdown.indexOf(GENERATED_START);
  if (start < 0) return markdown;
  const end = markdown.indexOf(GENERATED_END, start);
  if (end < 0) throw new Error(`Generated Omni Flash block is missing its end marker`);
  return `${markdown.slice(0, start).trimEnd()}\n${markdown.slice(end + GENERATED_END.length).trimStart()}`;
}

function parseTimedEvents(markdown) {
  const pattern = /^\|\s*(\d+):(\d{2})\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/gmu;
  return [...markdown.matchAll(pattern)].map((match) => ({
    at_seconds: seconds(match[1], match[2]),
    speaker: cleanCell(match[3]),
    content: cleanCell(match[4]),
  }));
}

function beatIntent(events) {
  const text = events.map((event) => event.content).join(' ');
  if (/صمت|يفكر|انتظار/.test(text) && /؟/.test(text)) return 'question_response_window';
  if (/صمت|يفكر|انتظار/.test(text)) return 'intentional_silence';
  if (events.some((event) => event.speaker === 'مؤثر' || event.speaker === 'موسيقى')) return 'dialogue_with_action';
  return events.length > 0 ? 'continuous_dialogue' : 'visual_continuation';
}

function explicitSeconds(content) {
  const milliseconds = content.match(/(\d+(?:\.\d+)?)\s*ms/i);
  if (milliseconds) return Number(milliseconds[1]) / 1000;
  const secondsMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:ثوان(?:ي)?|ثانية|s)/i);
  return secondsMatch ? Number(secondsMatch[1]) : null;
}

function eventPerformanceSeconds(event) {
  const explicit = explicitSeconds(event.content);
  if (event.speaker === '—') {
    if (/صمت/.test(event.content) && explicit !== null) return Math.min(explicit, 6);
    if (/الطفل|يفكر|إجابة|توقّع|دورك/.test(event.content)) return Math.min(explicit ?? 3, 6);
    return 0;
  }
  if (event.speaker === 'موسيقى') return Math.min(explicit ?? 1.2, 2);
  if (event.speaker === 'مؤثر' || /نجمي/.test(event.speaker)) return Math.min(explicit ?? 1, 1.5);
  const wordCount = event.content.split(/\s+/u).filter(Boolean).length;
  return Math.max(1.2, wordCount / 2.15 + 0.35);
}

function supportedDuration(occupiedSeconds) {
  const duration = OMNI_FLASH_ALLOWED_DURATIONS.find((value) => value >= occupiedSeconds + 0.35);
  return duration ?? 10;
}

function packSceneEvents(scene, events, startingIndex) {
  const packed = [];
  let current = null;
  let nextIndex = startingIndex;
  const flush = () => {
    if (!current) return;
    const duration = supportedDuration(current.occupied_seconds);
    packed.push({
      beat_id: `B${String(nextIndex).padStart(3, '0')}`,
      duration_seconds: duration,
      editorial_scenes: [scene.editorial_scene],
      intent: beatIntent(current.events),
      occupied_seconds: Number(current.occupied_seconds.toFixed(2)),
      events: current.events,
    });
    nextIndex += 1;
    current = null;
  };

  for (const event of events) {
    const performanceSeconds = eventPerformanceSeconds(event);
    if (performanceSeconds <= 0) continue;
    if (!current) current = { occupied_seconds: 0, events: [] };
    if (current.occupied_seconds + performanceSeconds > 9.5 && current.events.length > 0) {
      flush();
      current = { occupied_seconds: 0, events: [] };
    }
    current.events.push({
      relative_at_seconds: Number(current.occupied_seconds.toFixed(2)),
      original_at_seconds: event.at_seconds,
      speaker: event.speaker,
      content: event.content,
      performance_seconds: Number(performanceSeconds.toFixed(2)),
    });
    current.occupied_seconds += performanceSeconds;
  }
  flush();
  if (packed.length === 0) {
    packed.push({
      beat_id: `B${String(nextIndex).padStart(3, '0')}`,
      duration_seconds: 4,
      editorial_scenes: [scene.editorial_scene],
      intent: 'visual_continuation',
      occupied_seconds: 3.5,
      events: [],
    });
    nextIndex += 1;
  }
  return { beats: packed, nextIndex };
}

function buildEpisode(file) {
  const markdown = withoutGeneratedPlan(fs.readFileSync(file, 'utf8'));
  const scenes = parseScenes(markdown);
  if (scenes.length === 0) return null;
  const sourceTotal = Math.max(...scenes.map((scene) => scene.end_seconds));
  const events = parseTimedEvents(markdown);
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const parts = relative.split('/');
  const planetIndex = parts.indexOf('planets');
  const beats = [];
  let nextIndex = 1;
  for (const scene of scenes) {
    const sceneEvents = events.filter((event) => event.at_seconds >= scene.start_seconds
      && event.at_seconds < scene.end_seconds);
    const packed = packSceneEvents(scene, sceneEvents, nextIndex);
    beats.push(...packed.beats);
    nextIndex = packed.nextIndex;
  }
  let cursor = 0;
  for (const beat of beats) {
    beat.start_seconds = cursor;
    beat.end_seconds = cursor + beat.duration_seconds;
    cursor = beat.end_seconds;
  }
  return {
    source_path: relative,
    planet: parts[planetIndex + 1],
    series: parts[planetIndex + 2],
    source_total_seconds: sourceTotal,
    output_total_seconds: cursor,
    removed_filler_seconds: sourceTotal - cursor,
    editorial_scene_count: scenes.length,
    beat_count: beats.length,
    beats,
  };
}

function escapeTableCell(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function formatClock(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const secondsPart = totalSeconds % 60;
  return `${minutes}:${String(secondsPart).padStart(2, '0')}`;
}

function productionBlock(episode) {
  const lines = [
    GENERATED_START,
    '',
    '## خطة إنتاج PlayVeo Omni Flash — المعتمدة للتوليد',
    '',
    '> هذا القسم هو مرجع التوليد الزمني. الجداول السابقة تبقى مرجعًا تحريريًا للمحتوى والسلامة، لا مددًا تُرسل إلى PlayVeo.',
    '> المدد المسموحة فقط: **4، 6، 8، 10 ثوانٍ**. لا يُنشأ كليب مستقل لمجرد انتهاء جملة.',
    '> الصمت الوارد هنا مقصود لتفاعل الطفل. أي زمن قديم غير ممثل هنا يُحذف أو يتحول إلى حركة بصرية موصوفة، ولا يُترك كسكوت تلقائي.',
    '',
    '| البند | القيمة |',
    '|---|---:|',
    `| المدة التحريرية القديمة | ${episode.source_total_seconds}ث |`,
    `| مدة نسخة Omni المقترحة | ${episode.output_total_seconds}ث |`,
    `| عدد كليبات Omni | ${episode.beat_count} |`,
    '',
  ];
  for (const beat of episode.beats) {
    lines.push(
      `### ${beat.beat_id} · ${formatClock(beat.start_seconds)}–${formatClock(beat.end_seconds)} · ${beat.duration_seconds}s`,
      '',
      `**المشهد التحريري:** ${beat.editorial_scenes.join(' + ')} · **نوع الأداء:** \`${beat.intent}\``,
      '',
      '| داخل الكليب | المتكلم/العنصر | النص أو الحركة حرفيًا | الزمن التقديري |',
      '|---:|---|---|---:|',
    );
    if (beat.events.length === 0) {
      lines.push('| 0.0ث | بصري | استمرار بصري هادف بلا سكوت غير مبرر | 3.5ث |');
    } else {
      for (const event of beat.events) {
        lines.push(`| ${event.relative_at_seconds.toFixed(2)}ث | ${escapeTableCell(event.speaker)} | ${escapeTableCell(event.content)} | ${event.performance_seconds.toFixed(2)}ث |`);
      }
    }
    lines.push('');
  }
  lines.push(GENERATED_END);
  return lines.join('\n');
}

function applyPlans(episodes) {
  for (const episode of episodes) {
    const absolute = path.join(ROOT, episode.source_path);
    const source = withoutGeneratedPlan(fs.readFileSync(absolute, 'utf8')).trimEnd();
    fs.writeFileSync(absolute, `${source}\n\n${productionBlock(episode)}\n`, 'utf8');
  }
}

const episodes = walk(PLANETS_ROOT)
  .filter((file) => file.endsWith('.md'))
  .map(buildEpisode)
  .filter(Boolean)
  .sort((left, right) => left.source_path.localeCompare(right.source_path));

const durationCounts = Object.fromEntries(OMNI_FLASH_ALLOWED_DURATIONS.map((duration) => [duration, 0]));
for (const episode of episodes) {
  for (const beat of episode.beats) durationCounts[beat.duration_seconds] += 1;
}
const totals = {
  episode_count: episodes.length,
  editorial_scene_count: episodes.reduce((sum, episode) => sum + episode.editorial_scene_count, 0),
  production_beat_count: episodes.reduce((sum, episode) => sum + episode.beat_count, 0),
  source_seconds: episodes.reduce((sum, episode) => sum + episode.source_total_seconds, 0),
  output_seconds: episodes.reduce((sum, episode) => sum + episode.output_total_seconds, 0),
  removed_filler_seconds: episodes.reduce((sum, episode) => sum + episode.removed_filler_seconds, 0),
  duration_counts: durationCounts,
};
const artifact = {
  schema_version: 'majarra.omni-flash-beat-plan/v1',
  provider: 'PlayVeo',
  model: 'omni-flash',
  allowed_durations_seconds: OMNI_FLASH_ALLOWED_DURATIONS,
  policy: {
    default: 'Use 10 seconds for a coherent spoken/action beat.',
    shorter_beats: 'Use 8, 6, or 4 seconds to land near editorial boundaries; never split merely because a sentence ended.',
    silence: 'Keep explicit child-response windows; remove filler silence between lines that belong to one thought.',
    pacing: 'Repack performance inside each editorial scene; shorten non-teaching pauses and intros, preserve explicit response silence.',
    exclusions: ['illustrated_read_to_me stories', 'unapproved religious shells'],
  },
  totals,
  episodes,
};

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(JSON_OUTPUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');

const byPlanet = Map.groupBy(episodes, (episode) => episode.planet);
const rows = [...byPlanet.entries()].map(([planet, items]) => {
  const beats = items.reduce((sum, item) => sum + item.beat_count, 0);
  const sourceSeconds = items.reduce((sum, item) => sum + item.source_total_seconds, 0);
  const outputSeconds = items.reduce((sum, item) => sum + item.output_total_seconds, 0);
  return `| ${planet} | ${items.length} | ${beats} | ${sourceSeconds} | ${outputSeconds} |`;
});
const report = `# خطة تقسيم PlayVeo Omni Flash\n\n` +
  `- المدد الوحيدة المسموحة: **4، 6، 8، 10 ثوانٍ**.\n` +
  `- المشهد التحريري يبقى كما هو، ويُنفّذ عبر production beats متصلة.\n` +
  `- 10 ثوانٍ هي الاختيار الأساسي؛ 8/6/4 لضبط حدود الفكرة أو السؤال أو الحركة.\n` +
  `- لا يُفصل الكلام لمجرد انتهاء جملة؛ الجمل التابعة للفكرة نفسها تبقى في beat واحد.\n` +
  `- الصمت المقصود لإجابة الطفل يبقى، وصمت الحشو يُحذف.\n` +
  `- الزمن المسترجع إمّا يُحذف في النسخة الأسرع، أو يتحول إلى حركة بصرية هادفة؛ لا يعود سكوتًا تلقائيًا.\n` +
  `- كوكب القصص مستثنى لأنه صفحات وصوت، وكوكب الإيمان مستثنى حتى الاعتماد.\n\n` +
  `## الإجمالي\n\n` +
  `- ملفات الحلقات: **${totals.episode_count}**\n` +
  `- المشاهد التحريرية: **${totals.editorial_scene_count}**\n` +
  `- كليبات الإنتاج: **${totals.production_beat_count}**\n` +
  `- توزيع المدد: ${Object.entries(durationCounts).map(([duration, count]) => `${duration}s=${count}`).join(' · ')}\n` +
  `- المساحة الزمنية المسترجعة من الجداول القديمة: **${totals.removed_filler_seconds}s**\n\n` +
  `## حسب الكوكب\n\n| الكوكب | ملفات | beats | الزمن القديم (ث) | الزمن المقترح (ث) |\n|---|---:|---:|---:|---:|\n${rows.join('\n')}\n\n` +
  `التفصيل الزمني والجمل المجمعة موجود في \`omni-flash-beat-plan.v1.json\`.\n`;
fs.writeFileSync(REPORT_OUTPUT, report, 'utf8');

if (APPLY) applyPlans(episodes);

console.log(JSON.stringify({
  json: path.relative(ROOT, JSON_OUTPUT),
  report: path.relative(ROOT, REPORT_OUTPUT),
  applied_to_source_scripts: APPLY ? episodes.length : 0,
  totals,
}, null, 2));
