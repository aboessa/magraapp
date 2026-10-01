/// APP-209: rank series for one child from what they liked, saved and watched.
///
/// Deliberately simple and explainable (a children's product, and a parent may
/// ask "why this?"): a candidate earns points for being like something the
/// child showed interest in. Same planet counts most, each shared category adds
/// a little. Nothing is inferred from other children.
///
/// Signals and weights:
/// - «عجبني» (like): 3
/// - «احفظ» (save):  2
/// - watched in the last 30 days: 1, plus 1 more past 10 minutes
///
/// Series the child already liked, saved or watched are not recommended back:
/// "continue watching" and "my list" already show them, and this rail is for
/// discovery.

export type SeriesFacts = { id: string; planet_id: string | null; categories: string[] };
export type SeriesSignal = { series_id: string; kind: 'like' | 'save' | 'watch'; minutes?: number };
export type Ranked = { series_id: string; score: number; reason: 'liked_similar' | 'watched_similar' };

const PLANET_MATCH = 1;
const CATEGORY_MATCH = 0.5;

function weight(signal: SeriesSignal): number {
  if (signal.kind === 'like') return 3;
  if (signal.kind === 'save') return 2;
  return (signal.minutes ?? 0) >= 10 ? 2 : 1;
}

export function rankSeries(candidates: SeriesFacts[], signals: SeriesSignal[], all: SeriesFacts[]): Ranked[] {
  const facts = new Map(all.map((s) => [s.id, s]));
  const known = new Set(signals.map((s) => s.series_id));
  const ranked: Ranked[] = [];

  for (const candidate of candidates) {
    if (known.has(candidate.id)) continue;
    let score = 0;
    let fromLike = 0;
    for (const signal of signals) {
      const source = facts.get(signal.series_id);
      if (!source) continue;
      let similarity = 0;
      if (source.planet_id && source.planet_id === candidate.planet_id) similarity += PLANET_MATCH;
      for (const category of candidate.categories) {
        if (source.categories.includes(category)) similarity += CATEGORY_MATCH;
      }
      if (similarity === 0) continue;
      const points = weight(signal) * similarity;
      score += points;
      if (signal.kind !== 'watch') fromLike += points;
    }
    if (score > 0) {
      ranked.push({
        series_id: candidate.id,
        score: Math.round(score * 100) / 100,
        reason: fromLike >= score / 2 ? 'liked_similar' : 'watched_similar',
      });
    }
  }

  // Ties keep the editorial order of `candidates` (sort is stable).
  return ranked.sort((a, b) => b.score - a.score);
}
