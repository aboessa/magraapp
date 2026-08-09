/// Per-engine rules that a JSON Schema cannot express.
///
/// A schema can say `answer` is an integer. It cannot say the answer must equal the
/// number of stars actually on screen, that a `compare_sets` question claiming
/// `set_b` must really have more in `set_b`, that a `pattern_fill` sequence's
/// missing value must fit the arithmetic it claims, or that a `block_code`
/// reference solution must actually reach the goal.
///
/// Those are the errors that ship broken content: the pack validates, publishes,
/// and then a child is asked an unanswerable question or shown a hint that does not
/// work. Each rule here exists because a specific contract statement would
/// otherwise be unenforceable.
///
/// Everything is derived from `docs/games/engines/*.md`. Nothing invents a rule the
/// contracts do not state.

import { runBlockProgram, type BlockGridSpec } from './blockCodeSim.ts';
import { REGION_BOUNDS } from './mapRegions.ts';

export interface EngineRuleContext {
  ageMin: number;
  ageMax: number;
  forPublish: boolean;
  /// Whether the game row has a learning objective. `rhythm_tap` and
  /// `memory_flip` must not.
  hasLearningObjective?: boolean;
}

export interface EngineRuleResult {
  errors: string[];
  warnings: string[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/// Grapheme-ish length. Arabic letters here are single code points, but counting
/// code points rather than UTF-16 units avoids a surprise on any letter outside the
/// BMP.
function charCount(value: string): number {
  return [...value].length;
}

type LevelRule = (level: Record<string, unknown>, label: string, ctx: EngineRuleContext, out: EngineRuleResult) => void;

// ------------------------------------------------------------- count_quantity

const countQuantityLevel: LevelRule = (level, label, ctx, out) => {
  const mode = String(level.mode ?? '');
  const items = asArray(level.items).filter(isObject);
  const range = asArray(level.range).map(num);

  const ids = items.map((item) => String(item.id ?? ''));
  if (new Set(ids).size !== ids.length) out.errors.push(`${label}: duplicate item id`);

  for (const item of items) {
    const itemLabel = `${label} item "${String(item.id ?? '?')}"`;
    const options = asArray(item.options);
    const answer = item.answer;

    if (options.length && !options.some((option) => option === answer)) {
      out.errors.push(`${itemLabel}: answer ${JSON.stringify(answer)} is not among the options`);
    }

    if (mode === 'count_and_pick' || mode === 'drag_amount') {
      const sets = asArray(item.items).filter(isObject);
      const total = sets.reduce((sum, set) => sum + (num(set.count) ?? 0), 0);
      const expected = num(answer);
      if (expected !== null && total > 0 && expected !== total) {
        // The commonest authoring error in this engine, and it produces a question
        // no child can get right.
        out.errors.push(
          `${itemLabel}: answer is ${expected} but ${total} element(s) are on screen; `
          + 'the answer must be the number the child would actually count',
        );
      }
      if (range.length === 2 && expected !== null) {
        const [low, high] = range;
        if (low !== null && high !== null && (expected < low || expected > high)) {
          out.errors.push(`${itemLabel}: answer ${expected} falls outside the level range ${low}..${high}`);
        }
      }
    }

    if (mode === 'compare_sets') {
      const a = isObject(item.set_a) ? num(item.set_a.count) : null;
      const b = isObject(item.set_b) ? num(item.set_b.count) : null;
      if (a !== null && b !== null) {
        const truth = a > b ? 'set_a' : b > a ? 'set_b' : 'equal';
        // Whether the question asks for "more" or "fewer" is carried by
        // `question_key`, which is a translation key and not machine-readable, so
        // only the `equal` case can be checked in both directions. It is checked,
        // because an "equal" answer with unequal sets is wrong under any wording.
        if (answer === 'equal' && truth !== 'equal') {
          out.errors.push(`${itemLabel}: answer is "equal" but the sets hold ${a} and ${b}`);
        }
        if (truth === 'equal' && answer !== 'equal') {
          out.errors.push(`${itemLabel}: the sets are equal (${a} and ${b}) so the answer must be "equal"`);
        }
      }
    }

    if (mode === 'pattern_fill') {
      const sequence = asArray(item.sequence);
      const gaps = sequence.filter((entry) => entry === null).length;
      if (gaps !== 1) {
        out.errors.push(`${itemLabel}: exactly one position may be null, found ${gaps}`);
      }
      const values = sequence.map(num);
      const known = values.filter((value): value is number => value !== null);
      if (known.length >= 2 && gaps === 1) {
        // If the known values are an arithmetic progression, the missing one is
        // determined. `rule_key` claims a rule; this is what makes the claim true.
        const stepFromFirstTwo = (() => {
          const indices = values.map((value, index) => (value === null ? -1 : index)).filter((i) => i >= 0);
          if (indices.length < 2) return null;
          const [i0, i1] = indices;
          const v0 = values[i0]!;
          const v1 = values[i1]!;
          const gapCount = i1 - i0;
          return gapCount === 0 ? null : (v1 - v0) / gapCount;
        })();
        if (stepFromFirstTwo !== null && Number.isInteger(stepFromFirstTwo)) {
          const anchorIndex = values.findIndex((value) => value !== null);
          const anchor = values[anchorIndex]!;
          const arithmetic = values.every((value, index) =>
            value === null || value === anchor + (index - anchorIndex) * stepFromFirstTwo);
          if (arithmetic) {
            const missingIndex = values.findIndex((value) => value === null);
            const expected = anchor + (missingIndex - anchorIndex) * stepFromFirstTwo;
            if (num(answer) !== expected) {
              out.errors.push(
                `${itemLabel}: the sequence steps by ${stepFromFirstTwo}, so the missing value is `
                + `${expected}, not ${JSON.stringify(answer)}`,
              );
            }
          }
        }
      }
    }
  }

  // Elements the child must count, against the engine's own on-screen budget of 20.
  for (const item of items) {
    const sets = asArray(item.items).filter(isObject);
    const total = sets.reduce((sum, set) => sum + (num(set.count) ?? 0), 0);
    const compare = (isObject(item.set_a) ? num(item.set_a.count) ?? 0 : 0)
      + (isObject(item.set_b) ? num(item.set_b.count) ?? 0 : 0);
    const onScreen = Math.max(total, compare);
    if (onScreen > 20) {
      out.errors.push(`${label} item "${String(item.id ?? '?')}": ${onScreen} elements exceeds the engine's 20`);
    }
  }

  if (level.allow_recount_button === false) {
    // «زر «أعد العدّ» ظاهر دائمًا» — always visible.
    out.errors.push(`${label}: allow_recount_button must be true; the recount button is always visible`);
  }
};

// -------------------------------------------------------------- logic_pattern

const logicPatternLevel: LevelRule = (level, label, ctx, out) => {
  const mode = String(level.mode ?? '');
  const options = asArray(level.options).filter((o): o is string => typeof o === 'string');
  const answer = level.answer;

  if (options.length && !options.includes(String(answer))) {
    out.errors.push(`${label}: answer "${String(answer)}" is not among the options`);
  }

  const grid = asArray(level.grid);
  const sequence = asArray(level.sequence);
  const cells = grid.length ? grid.flatMap((row) => asArray(row)) : sequence;
  const gaps = cells.filter((cell) => cell === null).length;
  if (cells.length && gaps !== 1) {
    out.errors.push(`${label}: exactly one cell may be missing, found ${gaps}`);
  }

  const dimensions = asArray(level.changing_dimensions)
    .filter((d): d is string => typeof d === 'string');
  // «لا اعتماد على اللون وحده في أي مستوى» — an acceptance criterion, and the one
  // rule in this engine that makes it playable for a colour-blind child.
  if (dimensions.length === 1 && dimensions[0] === 'color') {
    out.errors.push(
      `${label}: colour may not be the only changing dimension; add shape, pattern, `
      + 'rotation, size or count so the puzzle is solvable without colour vision',
    );
  }

  if (mode === 'matrix_3x3' || mode === 'rule_infer') {
    if (level.require_explanation !== true) {
      out.errors.push(`${label}: "${mode}" must set require_explanation true; a correct answer without a reason may be a guess`);
    }
    const explainOptions = asArray(level.explain_options)
      .filter((o): o is string => typeof o === 'string');
    const explainAnswer = level.explain_answer;
    if (explainOptions.length && !explainOptions.includes(String(explainAnswer))) {
      out.errors.push(`${label}: explain_answer "${String(explainAnswer)}" is not among explain_options`);
    }
    if (typeof explainAnswer === 'string' && explainAnswer !== String(level.rule_key)) {
      // Not fatal — a level may phrase the rule differently in the explanation
      // list — but almost always a copy/paste slip worth surfacing.
      out.warnings.push(`${label}: explain_answer "${explainAnswer}" differs from rule_key "${String(level.rule_key)}"`);
    }
  }
};

// ----------------------------------------------------------------- word_build

/// Arabic joining behaviour: these letters never connect to what follows them, so a
/// following letter is `initial`, not `medial`.
const NON_CONNECTING_AR = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ة', 'ى', 'ء']);

const wordBuildLevel: LevelRule = (level, label, ctx, out) => {
  const language = String(level.language ?? '');
  const word = String(level.word ?? '');
  const slots = num(level.slots);
  const letters = asArray(level.letters).filter(isObject);
  const distractors = asArray(level.distractors).filter(isObject);

  if (slots !== null && letters.length !== slots) {
    out.errors.push(`${label}: ${letters.length} letter(s) for ${slots} slot(s); they must match`);
  }
  if (slots !== null && word && charCount(word) !== slots) {
    out.errors.push(`${label}: the word "${word}" has ${charCount(word)} letters but slots is ${slots}`);
  }

  const positions = letters.map((letter) => num(letter.position)).filter((p): p is number => p !== null);
  if (positions.length === letters.length) {
    const sorted = [...positions].sort((a, b) => a - b);
    sorted.forEach((value, index) => {
      if (value !== index + 1) {
        out.errors.push(`${label}: letter positions must run 1..${letters.length} without gaps, found ${sorted.join(',')}`);
      }
    });
  }

  // The letters, in position order, must spell the word. Otherwise the child
  // assembles something else and the engine still calls it correct.
  if (word && positions.length === letters.length) {
    const spelled = [...letters]
      .sort((a, b) => (num(a.position) ?? 0) - (num(b.position) ?? 0))
      .map((letter) => String(letter.char ?? ''))
      .join('');
    if (spelled !== word) {
      out.errors.push(`${label}: the letters spell "${spelled}" but the word is "${word}"`);
    }
  }

  // A distractor identical to a letter the word needs is unplayable: two
  // indistinguishable tiles, one accepted and one refused.
  const needed = new Set(letters.map((letter) => String(letter.char ?? '')));
  for (const distractor of distractors) {
    const char = String(distractor.char ?? '');
    if (needed.has(char)) {
      out.errors.push(`${label}: distractor "${char}" is also a letter of the word`);
    }
  }

  if (language === 'ar') {
    const ordered = [...letters].sort((a, b) => (num(a.position) ?? 0) - (num(b.position) ?? 0));
    ordered.forEach((letter, index) => {
      const form = String(letter.form ?? '');
      const char = String(letter.char ?? '');
      const previous = index > 0 ? String(ordered[index - 1].char ?? '') : null;
      const isFirst = index === 0;
      const isLast = index === ordered.length - 1;

      // «الحرف يُعرض بشكله الصحيح في الكلمة» — the form must be the one the letter
      // actually takes in this position, or the game teaches a shape that does not
      // occur.
      const previousConnects = previous !== null && !NON_CONNECTING_AR.has(previous);
      const expected = isFirst
        ? (ordered.length === 1 ? 'isolated' : 'initial')
        : isLast
          ? (previousConnects ? 'final' : 'isolated')
          : (previousConnects ? 'medial' : 'initial');

      if (form && form !== expected) {
        out.errors.push(
          `${label}: letter "${char}" at position ${index + 1} is marked "${form}" but takes the `
          + `"${expected}" form in "${word}"`
          + (previous && !previousConnects ? ` because "${previous}" does not join to the left` : ''),
        );
      }
      if (!form) {
        out.errors.push(`${label}: Arabic letters must declare their form; "${char}" does not`);
      }
      if (typeof letter.audio !== 'string' || !letter.audio) {
        out.errors.push(`${label}: Arabic letter "${char}" must name its sound recording`);
      }
    });
  }

  if (level.show_word_text_button !== true) {
    out.errors.push(`${label}: show_word_text_button must be true; it is what makes the game playable without hearing`);
  }
};

// ----------------------------------------------------------------- rhythm_tap

const rhythmTapLevel: LevelRule = (level, label, ctx, out) => {
  const lanes = num(level.lanes) ?? 1;
  const duration = num(level.track_duration_ms) ?? 0;
  const window = num(level.hit_window_ms) ?? 0;
  const notes = asArray(level.notes).filter(isObject);
  const levelNumber = num(level.level) ?? 1;

  if (level.never_fail !== true) {
    out.errors.push(`${label}: never_fail must be true; the track always plays to the end`);
  }
  if (level.visual_pulse !== true) {
    out.errors.push(`${label}: visual_pulse must be true; it is the alternative to hearing`);
  }

  let previous = -1;
  notes.forEach((note, index) => {
    const time = num(note.time_ms);
    const lane = num(note.lane);
    if (lane !== null && lane >= lanes) {
      out.errors.push(`${label}: note ${index} is in lane ${lane} but the level has ${lanes} lane(s)`);
    }
    if (time !== null && duration > 0 && time > duration) {
      out.errors.push(`${label}: note ${index} at ${time}ms falls after the ${duration}ms track ends`);
    }
    if (time !== null) {
      if (time < previous) {
        out.warnings.push(`${label}: notes are not in time order at index ${index}`);
      }
      previous = time;
    }
  });

  // «في preschool تُستخدم المستويات 1–2 فقط، وhit_window_ms لا تقل عن 450».
  if (ctx.ageMax <= 5) {
    if (window > 0 && window < 450) {
      out.errors.push(`${label}: hit_window_ms ${window} is below the 450ms floor for a preschool audience`);
    }
    if (levelNumber > 2) {
      out.errors.push(`${label}: preschool packs use levels 1 and 2 only, not level ${levelNumber}`);
    }
  }
};

// -------------------------------------------------------------- block_code

const blockCodeLevel: LevelRule = (level, label, ctx, out) => {
  const grid = isObject(level.grid) ? level.grid : {};
  const width = num(grid.w) ?? 0;
  const height = num(grid.h) ?? 0;
  const cells = (value: unknown): [number, number][] =>
    asArray(value)
      .map((entry) => {
        const pair = asArray(entry).map(num);
        return pair.length === 2 && pair[0] !== null && pair[1] !== null
          ? [pair[0], pair[1]] as [number, number]
          : null;
      })
      .filter((cell): cell is [number, number] => cell !== null);

  const walls = cells(grid.walls);
  const collectibles = cells(grid.collectibles);
  const start = cells([grid.start])[0];
  const goal = cells([grid.goal])[0];

  const inBounds = ([x, y]: [number, number]) => x >= 0 && y >= 0 && x < width && y < height;
  const same = (a?: [number, number], b?: [number, number]) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
  const isWall = (cell: [number, number]) => walls.some((wall) => same(wall, cell));

  for (const [name, list] of [['wall', walls], ['collectible', collectibles]] as const) {
    for (const cell of list) {
      if (!inBounds(cell)) out.errors.push(`${label}: ${name} at [${cell}] is outside the ${width}x${height} grid`);
    }
  }
  if (start && !inBounds(start)) out.errors.push(`${label}: start [${start}] is outside the grid`);
  if (goal && !inBounds(goal)) out.errors.push(`${label}: goal [${goal}] is outside the grid`);
  if (start && isWall(start)) out.errors.push(`${label}: start [${start}] is on a wall`);
  if (goal && isWall(goal)) out.errors.push(`${label}: goal [${goal}] is on a wall`);
  if (same(start, goal)) out.errors.push(`${label}: start and goal are the same cell`);
  for (const cell of collectibles) {
    if (isWall(cell)) out.errors.push(`${label}: collectible at [${cell}] is on a wall`);
  }

  const limit = num(level.block_limit);
  const optimal = num(level.optimal_blocks);
  if (limit !== null && optimal !== null && optimal > limit) {
    out.errors.push(`${label}: optimal_blocks ${optimal} exceeds block_limit ${limit}, so the star is unreachable`);
  }

  const allowed = new Set(
    asArray(level.allowed_blocks).filter((b): b is string => typeof b === 'string'),
  );
  const reference = asArray(level.reference_solution).filter((t): t is string => typeof t === 'string');

  for (const token of reference) {
    const kind = token.split(':')[0];
    if (!allowed.has(kind)) {
      out.errors.push(`${label}: reference_solution uses "${kind}", which is not in allowed_blocks`);
    }
  }
  if (reference.length && limit !== null && reference.length > limit) {
    out.errors.push(`${label}: reference_solution is ${reference.length} blocks, over the limit of ${limit}`);
  }

  // The reference solution is what the fourth help rung plays for a stuck child.
  // If it does not reach the goal, the ladder ends in a demonstration of failure.
  if (reference.length && start && goal && width > 0 && height > 0) {
    const spec: BlockGridSpec = {
      width,
      height,
      start,
      goal,
      facing: String(grid.facing ?? 'east'),
      walls,
      collectibles,
    };
    const outcome = runBlockProgram(spec, reference);
    if (!outcome.reachedGoal) {
      out.errors.push(
        `${label}: reference_solution does not solve the level `
        + `(ends at [${outcome.x},${outcome.y}]${outcome.collided ? ' after a collision' : ''}, `
        + `${outcome.collected} of ${collectibles.length} collected)`,
      );
    } else if (optimal !== null && reference.length > optimal) {
      out.warnings.push(
        `${label}: reference_solution is ${reference.length} blocks but optimal_blocks is ${optimal}; `
        + 'the demonstrated solution does not earn the star',
      );
    }
  }
};

// ------------------------------------------------------------------- sim_lab

const simLabLevel: LevelRule = (level, label, ctx, out) => {
  const variables = asArray(level.variables).filter(isObject);
  const relationships = isObject(level.expected_relationships) ? level.expected_relationships : {};
  const ids = variables.map((variable) => String(variable.id ?? ''));

  if (new Set(ids).size !== ids.length) out.errors.push(`${label}: duplicate variable id`);

  for (const key of Object.keys(relationships)) {
    if (!ids.includes(key)) {
      out.errors.push(`${label}: expected_relationships names "${key}", which is not a variable`);
    }
  }
  for (const id of ids) {
    if (!(id in relationships)) {
      out.errors.push(`${label}: variable "${id}" has no declared relationship; the simulation cannot respond to it`);
    }
  }

  // Every variable irrelevant means nothing to observe and nothing to explain.
  const values = Object.values(relationships);
  if (values.length && values.every((value) => value === 'none')) {
    out.errors.push(`${label}: every variable is declared "none", so the experiment has no observable outcome`);
  }

  for (const variable of variables) {
    const id = String(variable.id ?? '?');
    const min = num(variable.min);
    const max = num(variable.max);
    const step = num(variable.step);
    if (min !== null && max !== null && min >= max) {
      out.errors.push(`${label}: variable "${id}" has min ${min} not below max ${max}`);
    }
    if (min !== null && max !== null && step !== null && step > 0) {
      const steps = (max - min) / step;
      if (Math.abs(steps - Math.round(steps)) > 1e-9) {
        out.warnings.push(`${label}: variable "${id}" range ${min}..${max} is not a whole number of ${step} steps`);
      }
    }
  }

  const options = asArray(level.explanation_options).filter((o): o is string => typeof o === 'string');
  const answer = level.explanation_answer;
  if (options.length && !options.includes(String(answer))) {
    out.errors.push(`${label}: explanation_answer "${String(answer)}" is not among explanation_options`);
  }

  const hypotheses = asArray(level.hypothesis_options).filter((o): o is string => typeof o === 'string');
  if (new Set(hypotheses).size !== hypotheses.length) {
    out.errors.push(`${label}: duplicate hypothesis option`);
  }

  if (level.results_table !== true) {
    out.errors.push(`${label}: results_table must be true; the table is the accessible form of the result`);
  }

  // «أي تجربة منزلية لها safety_notes وsupervision_level = required».
  if (level.supervision_level === 'required') {
    const note = level.safety_note_key;
    if (typeof note !== 'string' || !note.trim()) {
      out.errors.push(`${label}: supervision_level "required" needs a safety_note_key`);
    }
  }
};

// -------------------------------------------------------------- timeline_map

const timelineMapLevel: LevelRule = (level, label, ctx, out) => {
  const mode = String(level.mode ?? '');
  const timeline = isObject(level.timeline) ? level.timeline : null;
  const map = isObject(level.map) ? level.map : null;
  const events = asArray(level.events).filter(isObject);

  const ids = events.map((event) => String(event.id ?? ''));
  if (new Set(ids).size !== ids.length) out.errors.push(`${label}: duplicate event id`);

  const needsYear = mode === 'timeline' || mode === 'both';
  const needsPlace = mode === 'map' || mode === 'both';

  if (needsYear && !timeline) out.errors.push(`${label}: mode "${mode}" needs a timeline`);
  if (needsPlace && !map) out.errors.push(`${label}: mode "${mode}" needs a map`);

  const from = timeline ? num(timeline.from) : null;
  const to = timeline ? num(timeline.to) : null;
  if (from !== null && to !== null && from >= to) {
    out.errors.push(`${label}: timeline.from ${from} must be before timeline.to ${to}`);
  }

  if (map && map.mirror_in_rtl !== false) {
    out.errors.push(`${label}: map.mirror_in_rtl must be false; geography is never mirrored`);
  }

  const region = map ? String(map.region ?? '') : '';
  const bounds = REGION_BOUNDS[region];
  if (map && region && !bounds) {
    out.warnings.push(`${label}: map region "${region}" has no known bounds; the whole world will be drawn`);
  }

  for (const event of events) {
    const eventLabel = `${label} event "${String(event.id ?? '?')}"`;
    if (needsYear) {
      const year = num(event.year);
      if (year === null) {
        out.errors.push(`${eventLabel}: needs a year in "${mode}" mode`);
      } else if (from !== null && to !== null && (year < from || year > to)) {
        out.errors.push(`${eventLabel}: year ${year} falls outside the timeline ${from}..${to}`);
      }
      if (num(event.tolerance_years) === null) {
        out.errors.push(`${eventLabel}: needs tolerance_years in "${mode}" mode`);
      }
    }
    if (needsPlace) {
      const lat = num(event.lat);
      const lon = num(event.lon);
      if (lat === null || lon === null) {
        out.errors.push(`${eventLabel}: needs lat and lon in "${mode}" mode`);
      } else if (bounds) {
        const inside = lat >= bounds.minLat && lat <= bounds.maxLat
          && lon >= bounds.minLon && lon <= bounds.maxLon;
        if (!inside) {
          out.errors.push(
            `${eventLabel}: [${lat}, ${lon}] is outside the "${region}" map, so the child could never place it`,
          );
        }
      }
      if (num(event.tolerance_km) === null) {
        out.errors.push(`${eventLabel}: needs tolerance_km in "${mode}" mode`);
      }
    }
  }

  const anchors = timeline ? asArray(timeline.anchors).filter(isObject) : [];
  for (const anchor of anchors) {
    const year = num(anchor.year);
    if (year !== null && from !== null && to !== null && (year < from || year > to)) {
      out.warnings.push(`${label}: anchor year ${year} is outside the visible timeline`);
    }
  }
};

// ---------------------------------------------------------------- dispatch

const LEVEL_RULES: Record<string, LevelRule> = {
  count_quantity: countQuantityLevel,
  logic_pattern: logicPatternLevel,
  word_build: wordBuildLevel,
  rhythm_tap: rhythmTapLevel,
  block_code: blockCodeLevel,
  sim_lab: simLabLevel,
  timeline_map: timelineMapLevel,
};

/// True when this module has semantic rules for the engine beyond its schema.
export function hasEngineRules(engineId: string): boolean {
  return engineId in LEVEL_RULES;
}

/// Applies the engine's semantic rules to every level of a pack.
export function validateEngineRules(
  engineId: string,
  pack: Record<string, unknown>,
  ctx: EngineRuleContext,
): EngineRuleResult {
  const out: EngineRuleResult = { errors: [], warnings: [] };
  const rule = LEVEL_RULES[engineId];
  if (!rule) return out;

  const levels = asArray(pack.levels).filter(isObject);
  for (const level of levels) {
    rule(level, `level ${String(level.level ?? '?')}`, ctx, out);
  }
  return out;
}
