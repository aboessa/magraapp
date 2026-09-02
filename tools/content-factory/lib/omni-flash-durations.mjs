export const OMNI_FLASH_ALLOWED_DURATIONS = Object.freeze([4, 6, 8, 10]);

export function isOmniFlashDuration(value) {
  return Number.isInteger(value) && OMNI_FLASH_ALLOWED_DURATIONS.includes(value);
}

function boundaryReward(position, boundaries) {
  let distance = Number.POSITIVE_INFINITY;
  for (const boundary of boundaries) distance = Math.min(distance, Math.abs(position - boundary));
  if (distance === 0) return 1.2;
  if (distance === 1) return 0.7;
  if (distance === 2) return 0.25;
  return 0;
}

export function normalizeOmniFlashTotal(totalSeconds) {
  if (!Number.isInteger(totalSeconds) || totalSeconds < 4) {
    throw new RangeError('Omni Flash total duration must be an integer of at least 4 seconds');
  }
  return totalSeconds % 2 === 0 ? totalSeconds : totalSeconds + 1;
}

export function planOmniFlashDurations(totalSeconds, { boundaries = [] } = {}) {
  const normalizedTotalSeconds = normalizeOmniFlashTotal(totalSeconds);
  const usefulBoundaries = boundaries
    .filter((value) => Number.isFinite(value) && value > 0 && value < normalizedTotalSeconds);
  const best = new Array(normalizedTotalSeconds + 1).fill(null);
  best[0] = { cost: 0, durations: [] };

  for (let position = 0; position <= normalizedTotalSeconds; position += 1) {
    if (!best[position]) continue;
    for (const duration of [...OMNI_FLASH_ALLOWED_DURATIONS].reverse()) {
      const end = position + duration;
      if (end > normalizedTotalSeconds) continue;
      const clipCost = 1 + (10 - duration) * 0.035;
      const reward = end === normalizedTotalSeconds ? 0 : boundaryReward(end, usefulBoundaries);
      const candidate = {
        cost: best[position].cost + clipCost - reward,
        durations: [...best[position].durations, duration],
      };
      const current = best[end];
      if (!current || candidate.cost < current.cost - 1e-9
        || (Math.abs(candidate.cost - current.cost) < 1e-9
          && candidate.durations.length < current.durations.length)) {
        best[end] = candidate;
      }
    }
  }

  if (!best[normalizedTotalSeconds]) {
    throw new RangeError(`Cannot compose ${normalizedTotalSeconds}s from Omni Flash durations`);
  }
  return {
    source_total_seconds: totalSeconds,
    output_total_seconds: normalizedTotalSeconds,
    timing_adjustment_seconds: normalizedTotalSeconds - totalSeconds,
    durations: best[normalizedTotalSeconds].durations,
  };
}

export function buildOmniFlashBeats(totalSeconds, options = {}) {
  const plan = planOmniFlashDurations(totalSeconds, options);
  let start = 0;
  return {
    ...plan,
    beats: plan.durations.map((duration, index) => {
      const beat = {
        index: index + 1,
        start_seconds: start,
        end_seconds: start + duration,
        duration_seconds: duration,
      };
      start += duration;
      return beat;
    }),
  };
}
