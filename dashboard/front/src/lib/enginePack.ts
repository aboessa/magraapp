/**
 * عقود المحرّكات وحزمها الابتدائية ودوالّها النقيّة.
 *
 * ## لماذا مرآة للعقد لا تعريف جديد
 *
 * `api/src/lib/engineContracts.ts` هو المصدر: هو من يرفض حزمة تدّعي دعم لوحة
 * التلفاز لمحرّك يحتاج مؤشِّرًا، أو تُعيد تصنيف محرّك «خاصّ بلغة» كقابل للترجمة.
 * نسخُه هنا ليس تكرارًا بلا داعٍ: بلا هذه المعرفة يبدأ المحرّر بحزمة يرفضها
 * الخادم عند أول حفظ، ثم يقرأ رسالة عن `supports_dpad` لم يرَ لها حقلًا. القيم
 * أدناه مكتوبة بالترتيب نفسه الذي في ملف الخادم لتسهيل مقارنتها عند تغييره.
 *
 * ## الحزمة الابتدائية ليست حزمة فارغة
 *
 * `emptyEnginePack` تُنتج حزمة **صالحة بنيويًا** لا كائنًا فارغًا: الظرف كامل،
 * ومستوى أول بحقوله المفروضة موجودة بقيم معقولة، والثوابت التي يفرضها المخطَّط
 * (`visual_pulse`، `never_fail`، `results_table`، `show_word_text_button`،
 * `mirror_in_rtl`) مكتوبة بقيمها الصحيحة ولا تُعرض للتعديل. السبب أن أوّل تجربة
 * محرّر محتوى مع محرّك جديد لا يجوز أن تكون قائمة أخطاء مخطَّط: من يبدأ بحزمة
 * مرفوضة يعود إلى SQL.
 *
 * ## القيم الافتراضية مأخوذة من العقود لا مختارة
 *
 * `flip_back_delay_ms = 1400` هو حدّ preschool في `04-memory-flip.md`،
 * و`hit_window_ms = 500` هو حدّ الوضع الحركي المبسّط في `08-rhythm-tap.md`،
 * و`min_touch_target_dp` يأتي من عقد المحرّك نفسه. أي رقم «مريح» مختار هنا كان
 * سيصير قيمة منشورة لأن أحدًا لم يغيّرها.
 */

import type { Locale } from '../context/preferences'
import type {
  BlockCell,
  BlockCodeLevel,
  BlockFacing,
  BlockGrid,
  CountQuantityLevel,
  EngineId,
  EngineLevelRecord,
  EnginePack,
  LetterPositionForm,
  LogicPatternLevel,
  MatchPairsLevel,
  MemoryFlipLevel,
  ReviewKind,
  RhythmTapLevel,
  SequenceOrderLevel,
  SimLabLevel,
  SortBinsLevel,
  TimelineMapLevel,
  WordBuildLevel,
} from '../types/enginePack'

// ---------------------------------------------------------------------------
// العقود
// ---------------------------------------------------------------------------

export type LanguageClass = 'translatable' | 'language_neutral' | 'language_specific'

export interface EngineContract {
  supportsDpad: boolean
  /// `undefined` تعني أن المحرّك لا يثبّت تصنيفًا لغويًا — `trace_color` وحده.
  languageClass?: LanguageClass
  minTouchTargetDp: number
  /// `false` للمحرّكين «ترفيه أولًا»: لا mastery، فلا هدف تعليمي.
  writesMastery: boolean
  requiredReview?: ReviewKind
}

export const ENGINE_CONTRACTS: Record<EngineId, EngineContract> = {
  trace_color: { supportsDpad: false, minTouchTargetDp: 48, writesMastery: true },
  match_pairs: { supportsDpad: true, languageClass: 'translatable', minTouchTargetDp: 56, writesMastery: true },
  sort_bins: { supportsDpad: true, languageClass: 'translatable', minTouchTargetDp: 56, writesMastery: true },
  memory_flip: { supportsDpad: true, languageClass: 'language_neutral', minTouchTargetDp: 56, writesMastery: false },
  sequence_order: { supportsDpad: true, languageClass: 'translatable', minTouchTargetDp: 56, writesMastery: true },
  count_quantity: { supportsDpad: true, languageClass: 'translatable', minTouchTargetDp: 56, writesMastery: true },
  logic_pattern: { supportsDpad: true, languageClass: 'language_neutral', minTouchTargetDp: 56, writesMastery: true },
  word_build: {
    supportsDpad: true, languageClass: 'language_specific', minTouchTargetDp: 56,
    writesMastery: true, requiredReview: 'linguistic_review',
  },
  rhythm_tap: {
    supportsDpad: true, languageClass: 'language_neutral', minTouchTargetDp: 72,
    writesMastery: false, requiredReview: 'music_rights',
  },
  block_code: { supportsDpad: true, languageClass: 'language_neutral', minTouchTargetDp: 48, writesMastery: true },
  sim_lab: {
    supportsDpad: true, languageClass: 'language_neutral', minTouchTargetDp: 48,
    writesMastery: true, requiredReview: 'scientific_review',
  },
  timeline_map: {
    supportsDpad: true, languageClass: 'translatable', minTouchTargetDp: 56,
    writesMastery: true, requiredReview: 'historical_review',
  },
}

export function engineContract(engineId: string): EngineContract | undefined {
  return ENGINE_CONTRACTS[engineId as EngineId]
}

export const ENGINE_LABELS: Record<Locale, Record<EngineId, string>> = {
  ar: {
    trace_color: 'الرسم والتلوين',
    match_pairs: 'المطابقة',
    sort_bins: 'الفرز في سلال',
    memory_flip: 'الذاكرة',
    count_quantity: 'العدّ والكمّيات',
    sequence_order: 'الترتيب والتسلسل',
    word_build: 'بناء الكلمة',
    rhythm_tap: 'الإيقاع',
    logic_pattern: 'الأنماط المنطقية',
    block_code: 'البرمجة بالأوامر',
    sim_lab: 'المعمل التجريبي',
    timeline_map: 'الخطّ الزمني والخريطة',
  },
  en: {
    trace_color: 'Trace & colour',
    match_pairs: 'Match pairs',
    sort_bins: 'Sort into bins',
    memory_flip: 'Memory flip',
    count_quantity: 'Count & quantity',
    sequence_order: 'Sequence order',
    word_build: 'Word build',
    rhythm_tap: 'Rhythm tap',
    logic_pattern: 'Logic patterns',
    block_code: 'Block code',
    sim_lab: 'Simulation lab',
    timeline_map: 'Timeline & map',
  },
}

export function engineLabel(engineId: string, locale: Locale): string {
  return ENGINE_LABELS[locale][engineId as EngineId] ?? engineId
}

// ---------------------------------------------------------------------------
// أدوات عامّة
// ---------------------------------------------------------------------------

export const I18N_KEY_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/
export const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{3,128}$/
export const PACK_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/
export const VOICE_KEY_PATTERN = /^vo\.[a-z_]+(\.[A-Za-z0-9_-]+)?$/
export const BLOCK_TOKEN_PATTERN = /^[a-z_]+(:[0-9]+)?$/
export const SIM_ID_PATTERN = /^[a-z][a-z0-9_]*$/
export const LANGUAGE_TAG_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asRecords(value: unknown): Array<Record<string, unknown>> {
  return asArray(value).filter(isObject)
}

/**
 * معرّف تسلسلي جديد لا يصادم الموجود، بالصيغة التي يفرضها المخطَّط.
 *
 * الصيَغ (`^t[0-9]+$`، `^i[0-9]+$`، `^b[0-9]+$` ...) ليست تجميلًا: عناصر
 * `match_pairs` تشير إلى أهدافها بالمعرّف، والخادم يرفض معرّفًا لا يطابق الصيغة.
 * توليده هنا يعني أن المحرّر لا يكتب معرّفات يدويًا ولا يستطيع تكرارها.
 */
export function nextId(existing: readonly string[], prefix: string): string {
  const taken = new Set(existing)
  let candidate = existing.length + 1
  while (taken.has(`${prefix}${candidate}`)) candidate += 1
  return `${prefix}${candidate}`
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.round(parsed)))
}

/// حروف عربية لا تتّصل بما بعدها، فالحرف التالي لها يأخذ الشكل الأوّل لا الوسط.
///
/// منسوخة عن `NON_CONNECTING_AR` في `api/src/lib/enginePackRules.ts`. اختلافها عن
/// نسخة الخادم يعني محرّرًا يعرض شكلًا ثم يرفضه الخادم، فترتيب الحروف نفسه.
export const NON_CONNECTING_AR = new Set(['ا', 'أ', 'إ', 'آ', 'د', 'ذ', 'ر', 'ز', 'و', 'ة', 'ى', 'ء'])

/**
 * الشكل الذي يأخذه الحرف فعلًا في موضعه من الكلمة.
 *
 * هذه الدالّة هي جوهر محرّر `word_build` العربي: الخادم يرفض حرفًا موسومًا
 * بشكل لا يأخذه في كلمته، لأن اللعبة حينها تعلّم شكلًا لا يوجد. عرض الشكل
 * المتوقَّع بجانب الحقل — لا مجرّد رفضه بعد الحفظ — هو ما يجعل الخطأ غير ممكن.
 *
 * `chars` هي حروف الكلمة بترتيب الموضع، و`index` موضع الحرف المطلوب.
 */
export function expectedArabicForm(chars: readonly string[], index: number): LetterPositionForm | null {
  if (index < 0 || index >= chars.length) return null
  const previous = index > 0 ? chars[index - 1] : null
  const previousConnects = previous !== null && previous !== undefined && !NON_CONNECTING_AR.has(previous)
  if (index === 0) return chars.length === 1 ? 'isolated' : 'initial'
  if (index === chars.length - 1) return previousConnects ? 'final' : 'isolated'
  return previousConnects ? 'medial' : 'initial'
}

/// حروف الكلمة كنقاط ترميز لا كوحدات UTF-16: العربية داخل BMP، لكن العدّ
/// بالنقاط يمنع مفاجأة عند أي حرف خارجها.
export function wordChars(word: string): string[] {
  return [...word]
}

// ---------------------------------------------------------------------------
// حدود مناطق الخريطة
// ---------------------------------------------------------------------------

export interface RegionBounds { minLat: number; maxLat: number; minLon: number; maxLon: number }

/// منسوخة عن `api/src/lib/mapRegions.ts`، والاثنان مقيَّدان بـ
/// `docs/games/fixtures/map_regions.json`. الخادم يرفض حدثًا خارج حدود منطقته،
/// فالمحرّر يحتاجها ليرسم الخريطة نفسها التي سيُقاس عليها.
export const WORLD_BOUNDS: RegionBounds = { minLat: -60, maxLat: 80, minLon: -180, maxLon: 180 }

export const REGION_BOUNDS: Record<string, RegionBounds> = {
  middle_east_north_africa: { minLat: 10, maxLat: 42, minLon: -18, maxLon: 63 },
  arab_world: { minLat: 10, maxLat: 40, minLon: -18, maxLon: 60 },
  world: WORLD_BOUNDS,
}

export function boundsForRegion(region: string): RegionBounds {
  return REGION_BOUNDS[region] ?? WORLD_BOUNDS
}

/// المناطق المعروفة، لتُعرض كقائمة اختيار بدل حقل نصّ حرّ.
export const KNOWN_REGIONS = Object.keys(REGION_BOUNDS)

// ---------------------------------------------------------------------------
// مفسّر block_code
// ---------------------------------------------------------------------------

export interface BlockOutcome {
  x: number
  y: number
  facing: BlockFacing
  collected: number
  collided: boolean
  reachedGoal: boolean
  steps: number
  /// مسار الروبوت خليّةً بخليّة، لرسمه في المحرّر. غير موجود في نسخة الخادم
  /// لأنها لا ترسم شيئًا؛ الدلالات نفسها والإضافة قراءة فقط.
  path: BlockCell[]
}

const FACINGS: readonly BlockFacing[] = ['north', 'east', 'south', 'west']

interface ParsedBlock { kind: string; count: number }

function parseToken(token: string): ParsedBlock | null {
  const [kind, rawCount] = token.split(':')
  if (!kind) return null
  const count = rawCount === undefined ? 2 : Number.parseInt(rawCount, 10)
  return { kind, count: Number.isFinite(count) ? count : 2 }
}

/**
 * تشغيل برنامج `block_code` على شبكته.
 *
 * ## لماذا مفسِّر ثالث
 *
 * المفسِّر الذي يلعب هو Dart، والذي يتحقّق هو `api/src/lib/blockCodeSim.ts`،
 * وكلاهما مقيَّد بـ`docs/games/fixtures/block_code_cases.json`. هذه النسخة
 * موجودة لسبب مختلف: `reference_solution` هو ما تعرضه الدرجة الرابعة من سلّم
 * المساعدة لطفل تعطّل أربع مرات، وبناؤه بلا رؤية أثره يعني تأليف حلٍّ يدخل في
 * حائط ثم اكتشافه من رسالة خادم. الدلالات منسوخة حرفيًا — بما فيها القراءتان
 * الموثَّقتان: `repeat:n` يكرّر الأمر التالي وحده، و`if_path` يحرس الأمر التالي
 * وحده — فما يقوله المحرّر هو ما سيقوله الخادم.
 */
export function runBlockProgram(
  grid: { width: number; height: number; start: BlockCell; goal: BlockCell; facing: string; walls: BlockCell[]; collectibles: BlockCell[] },
  tokens: readonly string[],
  functionTokens: readonly string[] = [],
  maxSteps = 500,
): BlockOutcome {
  let x = grid.start[0]
  let y = grid.start[1]
  let facingIndex = Math.max(0, FACINGS.indexOf(grid.facing as BlockFacing))
  const collected = new Set<string>()
  const path: BlockCell[] = [[x, y]]
  let collided = false
  let steps = 0

  const isWall = (cx: number, cy: number) => grid.walls.some(([wx, wy]) => wx === cx && wy === cy)
  const blocked = (cx: number, cy: number) =>
    cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height || isWall(cx, cy)

  const ahead = (): BlockCell => {
    switch (FACINGS[facingIndex]) {
      case 'north': return [x, y - 1]
      case 'south': return [x, y + 1]
      case 'east': return [x + 1, y]
      default: return [x - 1, y]
    }
  }

  const body = functionTokens.map(parseToken).filter((block): block is ParsedBlock => block !== null)

  const execute = (blocks: ParsedBlock[]) => {
    for (let index = 0; index < blocks.length; index += 1) {
      if (collided || steps >= maxSteps) return
      const block = blocks[index]
      if (!block) continue
      switch (block.kind) {
        case 'move': {
          const [nx, ny] = ahead()
          steps += 1
          if (blocked(nx, ny)) { collided = true; return }
          x = nx
          y = ny
          path.push([x, y])
          break
        }
        case 'turn_left':
          facingIndex = (facingIndex + 3) % 4
          steps += 1
          break
        case 'turn_right':
          facingIndex = (facingIndex + 1) % 4
          steps += 1
          break
        case 'collect':
          steps += 1
          if (grid.collectibles.some(([cx, cy]) => cx === x && cy === y)) collected.add(`${x},${y}`)
          break
        case 'repeat': {
          const next = blocks[index + 1]
          if (!next) { steps += 1; break }
          for (let round = 0; round < block.count; round += 1) {
            if (collided || steps >= maxSteps) break
            execute([next])
          }
          index += 1
          break
        }
        case 'if_path': {
          const next = blocks[index + 1]
          if (!next) { steps += 1; break }
          const [nx, ny] = ahead()
          if (!blocked(nx, ny)) execute([next])
          else steps += 1
          index += 1
          break
        }
        case 'function':
          execute(body)
          break
        default:
          steps += 1
      }
    }
  }

  execute(tokens.map(parseToken).filter((block): block is ParsedBlock => block !== null))

  const reachedGoal = !collided
    && x === grid.goal[0]
    && y === grid.goal[1]
    && collected.size >= grid.collectibles.length

  return { x, y, facing: FACINGS[facingIndex] ?? 'east', collected: collected.size, collided, reachedGoal, steps, path }
}

/// يحوّل مستوى `block_code` إلى المواصفة التي يقبلها المفسِّر.
export function blockGridSpec(grid: BlockGrid | undefined) {
  return {
    width: Number(grid?.w) || 0,
    height: Number(grid?.h) || 0,
    start: (grid?.start ?? [0, 0]) as BlockCell,
    goal: (grid?.goal ?? [0, 0]) as BlockCell,
    facing: String(grid?.facing ?? 'east'),
    walls: (grid?.walls ?? []) as BlockCell[],
    collectibles: (grid?.collectibles ?? []) as BlockCell[],
  }
}

// ---------------------------------------------------------------------------
// المستويات الابتدائية
// ---------------------------------------------------------------------------

/// مفتاح ترجمة ابتدائي لمستوى. مفتاح دلالي لا نصّ ظاهر: نصّ داخل الحزمة يجعلها
/// غير قابلة للترجمة، والخادم يرفضه بالصيغة.
function levelKey(engineId: string, level: number, suffix: string): string {
  return `game.${engineId}.level_${level}.${suffix}`
}

function matchPairsLevel(level: number): MatchPairsLevel {
  return {
    level,
    match_type: 'identical',
    prompt_key: levelKey('match_pairs', level, 'prompt'),
    // هدفان وعنصران: أصغر مستوى يقبله المخطَّط (`minItems: 2` للاثنين)، فلا
    // يبدأ المحرّر بحزمة مرفوضة.
    targets: [],
    items: [],
    shuffle: true,
    scoring: 'discrete',
  }
}

function sortBinsLevel(level: number): SortBinsLevel {
  return {
    level,
    criterion_key: levelKey('sort_bins', level, 'criterion'),
    criterion_type: 'shape',
    bins: [],
    items: [],
    explain_on_correct: false,
    shuffle: true,
    scoring: 'discrete',
  }
}

function memoryFlipLevel(level: number): MemoryFlipLevel {
  return {
    level,
    grid: [2, 2],
    pair_type: 'identical',
    pairs: [],
    // 1400 هو حدّ preschool في العقد، لا رقم مريح: البدء بـ800 يعني حزمة تُنشر
    // ثم تُرفض على مسار عمري كامل.
    flip_back_delay_ms: 1400,
    reveal_help_after_misses: 10,
    celebrate_each_pair: true,
    scoring: 'none',
  }
}

function sequenceOrderLevel(level: number): SequenceOrderLevel {
  return {
    level,
    sequence_type: 'story',
    prompt_key: levelKey('sequence_order', level, 'prompt'),
    direction: 'reading_order',
    panels: [],
    accepted_orders: [],
    narrate_on_complete: true,
    scoring: 'sequence',
  }
}

function countQuantityLevel(level: number): CountQuantityLevel {
  return {
    level,
    mode: 'count_and_pick',
    range: [1, 5],
    numeral_system: 'auto',
    items: [],
    count_aloud_on_error: true,
    // العقد يقول «زرّ أعد العدّ ظاهر دائمًا»، والخادم يرفض false.
    allow_recount_button: true,
    scoring: 'discrete',
  }
}

function logicPatternLevel(level: number): LogicPatternLevel {
  return {
    level,
    mode: 'linear',
    sequence: [null, null, null],
    options: [],
    answer: '',
    rule_key: levelKey('logic_pattern', level, 'rule'),
    // الشكل لا اللون: اللون وحده يُرفض من الخادم لأنه يُخرج طفلًا لا يميّز
    // الألوان من اللعبة كلها.
    changing_dimensions: ['shape'],
    require_explanation: false,
    scoring: 'discrete',
  }
}

function wordBuildLevel(level: number): WordBuildLevel {
  return {
    level,
    language: 'ar',
    word: '',
    word_audio: '',
    word_image: '',
    writing_direction: 'rtl',
    slots: 2,
    letters: [],
    show_word_text_button: true,
    scoring: 'discrete',
  }
}

function rhythmTapLevel(level: number): RhythmTapLevel {
  return {
    level,
    track: '',
    track_duration_ms: 30000,
    bpm: 90,
    lanes: 1,
    // 500 هو حدّ الوضع الحركي المبسّط، وأعلى من حدّ preschool (450): البدء من
    // الأوسع يجعل التضييق قرارًا واعيًا لا سهوًا.
    hit_window_ms: 500,
    accuracy_to_pass: 0.5,
    notes: [],
    visual_pulse: true,
    haptic_pulse: true,
    never_fail: true,
    scoring: 'discrete',
  }
}

function blockCodeLevel(level: number): BlockCodeLevel {
  return {
    level,
    grid: { w: 4, h: 4, start: [0, 0], facing: 'east', goal: [3, 0], walls: [], collectibles: [] },
    allowed_blocks: ['move'],
    block_limit: 6,
    optimal_blocks: 3,
    step_delay_ms: 600,
    show_grid_coordinates: false,
    reference_solution: [],
    scoring: 'discrete',
  }
}

function simLabLevel(level: number): SimLabLevel {
  return {
    level,
    sim: 'plant_growth',
    variables: [],
    measured: {
      id: 'growth',
      label_key: levelKey('sim_lab', level, 'measured'),
      unit_key: levelKey('sim_lab', level, 'unit'),
    },
    hypothesis_options: [],
    expected_relationships: {},
    explanation_options: [],
    explanation_answer: '',
    results_table: true,
    min_trials_before_explain: 3,
    supervision_level: 'none',
    safety_note_key: null,
    scoring: 'discrete',
  }
}

function timelineMapLevel(level: number): TimelineMapLevel {
  return {
    level,
    mode: 'timeline',
    timeline: { from: 600, to: 1500, unit: 'gregorian_year', display_calendar: 'auto', anchors: [] },
    events: [],
    show_reference_anchor: true,
    scoring: 'discrete',
  }
}

/// مستوى ابتدائي لكل محرّك، بحقوله المفروضة موجودة.
export function emptyEngineLevel(engineId: string, level: number): EngineLevelRecord {
  switch (engineId) {
    case 'match_pairs': return matchPairsLevel(level) as unknown as EngineLevelRecord
    case 'sort_bins': return sortBinsLevel(level) as unknown as EngineLevelRecord
    case 'memory_flip': return memoryFlipLevel(level) as unknown as EngineLevelRecord
    case 'sequence_order': return sequenceOrderLevel(level) as unknown as EngineLevelRecord
    case 'count_quantity': return countQuantityLevel(level) as unknown as EngineLevelRecord
    case 'logic_pattern': return logicPatternLevel(level) as unknown as EngineLevelRecord
    case 'word_build': return wordBuildLevel(level) as unknown as EngineLevelRecord
    case 'rhythm_tap': return rhythmTapLevel(level) as unknown as EngineLevelRecord
    case 'block_code': return blockCodeLevel(level) as unknown as EngineLevelRecord
    case 'sim_lab': return simLabLevel(level) as unknown as EngineLevelRecord
    case 'timeline_map': return timelineMapLevel(level) as unknown as EngineLevelRecord
    default: return { level }
  }
}

/**
 * حزمة ابتدائية صالحة بنيويًا لمحرّك.
 *
 * `supports_dpad` و`localization` تُملأ من العقد لا من اختيار المحرّر: الخادم
 * يرفض مخالفتهما، وعرضهما كحقلين حرّين يعني دعوة إلى خطأ ثم رسالة رفض عنه.
 */
export function emptyEnginePack(engineId: string, packId: string): EnginePack {
  const contract = engineContract(engineId)
  return {
    pack_version: 1,
    engine_id: engineId,
    pack_id: packId,
    localization: contract?.languageClass ?? 'language_neutral',
    supports_dpad: contract?.supportsDpad ?? true,
    supervision_level: 'none',
    progression: { levels_to_finish: 1, advance_on: 'level_complete' },
    levels: [emptyEngineLevel(engineId, 1)],
    assets: { images: [], audio: [] },
    voice_manifest: {},
    accessibility: {
      min_touch_target_dp: contract?.minTouchTargetDp ?? 48,
      sequential_tap_alternative: true,
      reduced_motion_supported: true,
      repeat_instructions_button: true,
    },
    review: contract?.requiredReview
      ? { [contract.requiredReview]: { status: 'pending' } }
      : {},
  }
}

/**
 * يقرأ حزمة مخزَّنة كما هي بلا إصلاح صامت.
 *
 * النظير الدقيق لـ`parsePack` في `tracePack.ts`، ولنفس السبب: الإصلاح الصامت
 * يخفي عن المحرّر ما يجب أن يراه. ما يُضمَن هنا هو أن المصفوفات والكائنات
 * موجودة حتى تُعرض الشاشة، لا أن القيم صحيحة.
 */
export function parseEnginePack(value: unknown, engineId: string): EnginePack | null {
  if (!isObject(value) || Object.keys(value).length === 0) return null
  const progression = isObject(value.progression) ? value.progression : {}
  const assets = isObject(value.assets) ? value.assets : {}
  const voice = isObject(value.voice_manifest) ? value.voice_manifest : {}
  const levels = asRecords(value.levels)

  return {
    ...value,
    pack_version: Number(value.pack_version) || 1,
    engine_id: typeof value.engine_id === 'string' ? value.engine_id : engineId,
    progression: {
      levels_to_finish: Number(progression.levels_to_finish) || levels.length || 1,
      advance_on: progression.advance_on === 'manual' ? 'manual' : 'level_complete',
    },
    levels,
    assets: {
      images: asArray(assets.images).filter((item): item is string => typeof item === 'string'),
      audio: asArray(assets.audio).filter((item): item is string => typeof item === 'string'),
    },
    voice_manifest: Object.fromEntries(
      Object.entries(voice).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    ),
  } as EnginePack
}
