/**
 * نموذج حزم المحرّكات الأحد عشر الأخرى في الواجهة.
 *
 * ## لماذا ملف ثانٍ إلى جانب types/gamePack.ts
 *
 * `types/gamePack.ts` هو عقد `trace_color` وحده: `TraceLevel` تحمل `stroke_paths`
 * و`coloring` و`tolerance_dp`، ولا معنى لأي منها في `memory_flip`. توسيع ذلك
 * الملف بحقول أحد عشر محرّكًا كان سينتج نوعًا واحدًا كل حقوله اختيارية — وهو
 * نوعٌ لا يمنع شيئًا: يقبل مستوى `sort_bins` بلا سلال، ومستوى `word_build` بلا
 * كلمة، ثم يُرفض من الخادم بعد أن اطمأنّ المحرّر.
 *
 * فكل محرّك هنا نوعه الخاصّ، منسوخ حرفيًا عن
 * `docs/games/schemas/<engine>.v1.schema.json` بالترتيب نفسه الذي في المخطَّط،
 * حتى تكون المقارنة بالعين ممكنة عند تعديل المخطَّط. الظرف المشترك
 * (`pack_version` و`progression` و`voice_manifest` ...) مأخوذ عن
 * `api/src/lib/packSchema.ts` لأنه هو من يبنيه وقت التشغيل، لا عن
 * `content-pack.base.schema.json` الذي يصفه نصًّا.
 *
 * ## ما ليس هنا
 *
 * لا تحقّق ولا قيم افتراضية ولا نصوص: كلها في `lib/enginePack.ts`، بالضبط كما
 * يفصل `tracePack.ts` عن `gamePack.ts`. الخادم يبقى الحَكَم؛ ما هنا شكلٌ يمنع
 * أخطاء الكتابة، لا بديل عن `gamePackValidation.ts` و`enginePackRules.ts`.
 *
 * ## القيم الثابتة `const`
 *
 * `visual_pulse` و`never_fail` و`results_table` و`show_word_text_button`
 * و`mirror_in_rtl` مكتوبة كأنواع حرفية (`true` / `false`) لا `boolean`. المخطَّط
 * يفرضها بـ`const`، وكلٌّ منها هو بديل الوصول لطفل لا يسمع أو ضمانة ألّا تُعكس
 * الجغرافيا: جعلها `boolean` يعني أن الواجهة تسمح بكتابة القيمة التي تُلغيها.
 */

import type { AdvanceOn, PackLocalization, PackSupervisionLevel } from './gamePack'

/// معرّفات المحرّكات كما في `content-pack.base.schema.json`.
export const ENGINE_IDS = [
  'match_pairs', 'trace_color', 'sort_bins', 'memory_flip',
  'count_quantity', 'sequence_order', 'word_build', 'rhythm_tap',
  'logic_pattern', 'block_code', 'sim_lab', 'timeline_map',
] as const
export type EngineId = (typeof ENGINE_IDS)[number]

/// المحرّكات التي يعرضها هذا الملف. `trace_color` مستثنى لأن محرّره ونموذجه
/// قائمان بالفعل في `TracePathEditor.tsx` و`GamePackForm.tsx`.
export const AUTHORED_ENGINE_IDS = ENGINE_IDS.filter((id) => id !== 'trace_color')

export const REVIEW_KINDS = [
  'linguistic_review', 'scientific_review', 'historical_review', 'music_rights',
] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]

export const ENGINE_REVIEW_STATUSES = ['not_required', 'pending', 'approved', 'rejected'] as const
export type EngineReviewStatus = (typeof ENGINE_REVIEW_STATUSES)[number]

/**
 * سجلّ مراجعة بشرية داخل الحزمة.
 *
 * الحقل `note` بالمفرد وليس `notes`: هكذا يبنيه `packSchema.ts` لهذه المحرّكات،
 * و`trace_color` وحده يستخدم `notes`. `additionalProperties: false` تعني أن
 * الخطأ في الاسم يُرفض من الخادم، فالاسم هنا منسوخ لا مُخمَّن.
 */
export interface EngineReviewRecord {
  status: EngineReviewStatus
  reviewer?: string | null
  reviewed_at?: string | null
  note?: string | null
}

/**
 * كتلة الإتاحة في الظرف المشترك.
 *
 * `simplified_motor` تحمل هنا أربعة حقول لا اثنين: `lanes` و`hit_window_ms`
 * لـ`rhythm_tap`، لأن «الوضع المبسّط» في لعبة إيقاع يعني مسارًا واحدًا ونافذة
 * أوسع، لا تفاوتًا هندسيًا. كلها اختيارية: حزمة لا تُعلن قيمة تبقى بلا قيمة،
 * وتعويضها هنا افتراضًا يعرض إتاحةً لم يقرّرها أحد.
 */
export interface EngineAccessibility {
  min_touch_target_dp?: number
  sequential_tap_alternative?: boolean
  reduced_motion_supported?: boolean
  /// المخطَّط يفرضها `true` حين تُذكر: زرّ «اسمع مرة أخرى» ظاهر دائمًا.
  repeat_instructions_button?: true
  simplified_motor?: {
    tolerance_dp?: number
    coverage_required?: number
    lanes?: number
    hit_window_ms?: number
  }
}

/// درجات التقييم التي يقبلها الظرف المشترك لكل مستوى.
export const ENGINE_SCORING_MODES = ['geometric', 'geometric_ordered', 'sequence', 'discrete', 'none'] as const
export type EngineScoring = (typeof ENGINE_SCORING_MODES)[number]

/**
 * مستوى بأي شكل.
 *
 * الحزمة تُقرأ من عمود JSON في D1، فقد تكون من إصدار سابق أو مؤلَّفة يدويًا.
 * هذا هو النوع الذي يسير في النموذج العامّ، ويُضيَّق إلى نوع المحرّك في موضع
 * واحد فقط — عند إرسال المستوى إلى محرّره — حيث `engine_id` هو المميِّز.
 */
export type EngineLevelRecord = Record<string, unknown>

/// الظرف المشترك لكل حزمة غير `trace_color`، كما يبنيه `buildPackSchema`.
export interface EnginePack {
  pack_version: number
  engine_id: string
  pack_id?: string
  localization?: PackLocalization
  supports_dpad?: boolean
  supervision_level?: PackSupervisionLevel
  translated_from?: string | null
  progression: { levels_to_finish: number; advance_on: AdvanceOn }
  levels: EngineLevelRecord[]
  assets?: { images?: string[]; audio?: string[] }
  voice_manifest: Record<string, string>
  accessibility?: EngineAccessibility
  review?: Partial<Record<ReviewKind, EngineReviewRecord>>
}

// ---------------------------------------------------------------------------
// match_pairs
// ---------------------------------------------------------------------------

export const MATCH_TYPES = ['identical', 'shadow', 'relation', 'sound_image', 'part_whole'] as const
export type MatchType = (typeof MATCH_TYPES)[number]

export interface MatchTarget {
  /// `^t[0-9]+$`
  id: string
  image: string
  label_key: string
  audio: string
}

export interface MatchItem {
  /// `^i[0-9]+$`
  id: string
  image: string
  /// معرّف هدف موجود في المستوى نفسه.
  target: string
  label_key: string
  audio: string
}

export interface MatchDistractor {
  /// `^d[0-9]+$`
  id: string
  image: string
  label_key: string
  audio: string
}

export interface MatchPairsLevel {
  level: number
  match_type: MatchType
  prompt_key: string
  targets: MatchTarget[]
  items: MatchItem[]
  distractors?: MatchDistractor[]
  shuffle?: boolean
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// sort_bins
// ---------------------------------------------------------------------------

export const CRITERION_TYPES = ['color', 'shape', 'size', 'compound', 'abstract'] as const
export type CriterionType = (typeof CRITERION_TYPES)[number]

export interface SortBin {
  /// `^b[0-9]+$`
  id: string
  label_key: string
  /// السلّة تُميَّز بصورة ونصّ وصوت، لا باللون وحده.
  image: string
  audio: string
}

export interface SortItem {
  /// `^i[0-9]+$`
  id: string
  image: string
  /// معرّف السلّة الصحيحة.
  bin: string
  label_key: string
  audio: string
  explain_audio?: string
}

export interface SortBinsLevel {
  level: number
  criterion_key: string
  criterion_type: CriterionType
  bins: SortBin[]
  items: SortItem[]
  explain_on_correct?: boolean
  shuffle?: boolean
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// memory_flip
// ---------------------------------------------------------------------------

export const PAIR_TYPES = ['identical', 'related'] as const
export type PairType = (typeof PAIR_TYPES)[number]

export interface MemoryPair {
  /// وجه البطاقة الأول: معرّف أصل صورة.
  a: string
  b: string
  /// مفتاح ترجمة لاسم الزوج، يُنطق عند كشفه.
  sound_key: string
  audio?: string
  /// مطلوب للمستوى المترابط لشرح العلاقة.
  explain_audio?: string
}

export interface MemoryFlipLevel {
  level: number
  /// `[w, h]` وكلٌّ منهما 2..4.
  grid: [number, number]
  pair_type: PairType
  pairs: MemoryPair[]
  /// 800..2000، ولا تقل عن 1400 في preschool.
  flip_back_delay_ms: number
  reveal_help_after_misses?: number
  celebrate_each_pair?: boolean
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// sequence_order
// ---------------------------------------------------------------------------

export const SEQUENCE_TYPES = ['story', 'process', 'procedure', 'cause_effect'] as const
export type SequenceType = (typeof SEQUENCE_TYPES)[number]

export interface SequencePanel {
  /// `^p[0-9]+$`
  id: string
  image: string
  position: number
  caption_key: string
  audio: string
}

export interface SequenceOrderLevel {
  level: number
  sequence_type: SequenceType
  prompt_key: string
  /// القيمة الوحيدة المسموحة: الشريط يُعكس في RTL تبعًا لاتجاه القراءة.
  direction: 'reading_order'
  panels: SequencePanel[]
  /// ترتيب واحد أو أكثر مقبول منطقيًا.
  accepted_orders: string[][]
  narrate_on_complete?: boolean
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// count_quantity
// ---------------------------------------------------------------------------

export const COUNT_MODES = ['count_and_pick', 'drag_amount', 'compare_sets', 'pattern_fill'] as const
export type CountMode = (typeof COUNT_MODES)[number]

export const NUMERAL_SYSTEMS = ['auto', 'arabic_indic', 'western'] as const
export type NumeralSystem = (typeof NUMERAL_SYSTEMS)[number]

export const COMPARE_ANSWERS = ['set_a', 'set_b', 'equal'] as const
export type CompareAnswer = (typeof COMPARE_ANSWERS)[number]

export interface CountSet {
  image: string
  /// عدد النسخ المعروضة من الصورة، 1..20.
  count: number
}

/// `count_and_pick` و`drag_amount`.
export interface CountPickItem {
  /// `^q[0-9]+$`
  id: string
  items: CountSet[]
  question_key?: string
  options: number[]
  /// **يجب** أن يساوي مجموع `items[].count`؛ الخادم يرفض غير ذلك.
  answer: number
}

export interface CompareItem {
  /// `^q[0-9]+$`
  id: string
  set_a: CountSet
  set_b: CountSet
  question_key: string
  options: CompareAnswer[]
  answer: CompareAnswer
}

export interface PatternItem {
  /// `^p[0-9]+$`
  id: string
  /// `null` هو الموضع الناقص، وواحد فقط مسموح.
  sequence: Array<number | null>
  options: number[]
  answer: number
  rule_key: string
}

export type CountAnyItem = CountPickItem | CompareItem | PatternItem

export interface CountQuantityLevel {
  level: number
  mode: CountMode
  range?: [number, number]
  numeral_system?: NumeralSystem
  items: CountAnyItem[]
  count_aloud_on_error?: boolean
  /// المخطَّط يسمح بـfalse والعقد لا: «زرّ أعد العدّ ظاهر دائمًا».
  allow_recount_button?: boolean
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// logic_pattern
// ---------------------------------------------------------------------------

export const LOGIC_MODES = ['linear', 'linear_alt', 'matrix_2x2', 'matrix_3x3', 'rule_infer'] as const
export type LogicMode = (typeof LOGIC_MODES)[number]

export const CHANGING_DIMENSIONS = ['color', 'shape', 'size', 'rotation', 'count', 'pattern'] as const
export type ChangingDimension = (typeof CHANGING_DIMENSIONS)[number]

export interface LogicPatternLevel {
  level: number
  mode: LogicMode
  /// للأنماط الخطية؛ `null` هو الموضع الناقص. القيم معرّفات أصول صور.
  sequence?: Array<string | null>
  /// للمصفوفات؛ `null` هي الخليّة الناقصة.
  grid?: Array<Array<string | null>>
  options: string[]
  answer: string
  rule_key: string
  /// اللون وحده ممنوع: الخادم يرفض حزمة لا يتغيّر فيها إلا اللون.
  changing_dimensions: ChangingDimension[]
  require_explanation?: boolean
  explain_options?: string[]
  explain_answer?: string
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// word_build
// ---------------------------------------------------------------------------

export const LETTER_POSITION_FORMS = ['isolated', 'initial', 'medial', 'final'] as const
export type LetterPositionForm = (typeof LETTER_POSITION_FORMS)[number]

export interface WordLetter {
  char: string
  /// مفروض للعربية: شكل الحرف داخل الكلمة.
  form?: LetterPositionForm
  position?: number
  audio: string
}

export interface WordBuildLevel {
  level: number
  /// `^[a-z]{2}(-[A-Z]{2})?$`
  language: string
  word: string
  word_audio: string
  word_syllables_audio?: string
  word_image: string
  writing_direction: 'rtl' | 'ltr'
  slots: number
  letters: WordLetter[]
  /// تُختار من حروف قريبة صوتيًا أو شكليًا، لا عشوائيًا.
  distractors?: WordLetter[]
  /// مفروض `true`: هو ما يجعل اللعبة قابلة للعب لمن لا يسمع.
  show_word_text_button: true
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// rhythm_tap
// ---------------------------------------------------------------------------

export interface RhythmNote {
  time_ms: number
  /// 0..2، ويجب أن تقلّ عن `lanes`.
  lane: number
}

export interface RhythmTapLevel {
  level: number
  /// المقطوعة: أصل صوتي بحقوق موثّقة.
  track: string
  track_duration_ms: number
  bpm: number
  lanes: number
  /// 250..600، ولا تقل عن 450 في preschool.
  hit_window_ms: number
  accuracy_to_pass: number
  notes: RhythmNote[]
  /// مفروض `true`: بديل الصوت لمن لا يسمع.
  visual_pulse: true
  haptic_pulse?: boolean
  /// مفروض `true`: الأنشودة تكمل دائمًا.
  never_fail: true
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// block_code
// ---------------------------------------------------------------------------

export const BLOCK_TOKENS = ['move', 'turn_left', 'turn_right', 'repeat', 'if_path', 'collect', 'function'] as const
export type BlockToken = (typeof BLOCK_TOKENS)[number]

export const BLOCK_FACINGS = ['north', 'east', 'south', 'west'] as const
export type BlockFacing = (typeof BLOCK_FACINGS)[number]

/// خليّة في الشبكة: قيمها 0..7 كما يفرض المخطَّط.
export type BlockCell = [number, number]

export interface BlockGrid {
  /// 3..8
  w: number
  /// 3..8
  h: number
  walls?: BlockCell[]
  start: BlockCell
  facing: BlockFacing
  goal: BlockCell
  collectibles?: BlockCell[]
}

export interface BlockCodeLevel {
  level: number
  grid: BlockGrid
  allowed_blocks: BlockToken[]
  block_limit: number
  /// نجمة إضافية فقط؛ الحلّ الأطول لا يُعاقب.
  optimal_blocks: number
  step_delay_ms: number
  show_grid_coordinates?: boolean
  /// رموز بصيغة `^[a-z_]+(:[0-9]+)?$`، ويجب أن تصل فعلًا إلى الهدف.
  reference_solution?: string[]
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// sim_lab
// ---------------------------------------------------------------------------

export const SIM_KINDS = ['plant_growth', 'circuit', 'pendulum'] as const
export type SimKind = (typeof SIM_KINDS)[number]

export const SIM_RELATIONSHIPS = ['positive', 'negative', 'none', 'saturating'] as const
export type SimRelationship = (typeof SIM_RELATIONSHIPS)[number]

export interface SimVariable {
  /// `^[a-z][a-z0-9_]*$`
  id: string
  label_key: string
  min: number
  max: number
  step: number
  unit_key: string
}

export interface SimMeasured {
  id: string
  label_key: string
  unit_key: string
}

export interface SimLabLevel {
  level: number
  sim: SimKind
  variables: SimVariable[]
  measured: SimMeasured
  hypothesis_options: string[]
  /// مفتاح لكل متغيّر. `none` تعني أن المتغيّر لا يؤثر — مفهوم تعليمي مقصود.
  expected_relationships: Record<string, SimRelationship>
  explanation_options: string[]
  explanation_answer: string
  /// مفروض `true`: الجدول هو الصورة النصيّة للنتيجة.
  results_table: true
  min_trials_before_explain: number
  supervision_level: PackSupervisionLevel
  safety_note_key?: string | null
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// timeline_map
// ---------------------------------------------------------------------------

export const TIMELINE_MODES = ['timeline', 'map', 'both'] as const
export type TimelineMode = (typeof TIMELINE_MODES)[number]

export const DISPLAY_CALENDARS = ['auto', 'gregorian', 'hijri'] as const
export type DisplayCalendar = (typeof DISPLAY_CALENDARS)[number]

export interface TimelineAnchor {
  year: number
  label_key: string
}

export interface TimelineSpec {
  from: number
  to: number
  /// التخزين ميلادي دائمًا.
  unit: 'gregorian_year'
  display_calendar: DisplayCalendar
  anchors?: TimelineAnchor[]
}

export interface MapSpec {
  /// `^[a-z][a-z0-9_]*$`
  region: string
  projection: 'equirectangular'
  /// مفروض `false`: الجغرافيا لا تُعكس أبدًا.
  mirror_in_rtl: false
}

export interface TimelineEvent {
  /// `^e[0-9]+$`
  id: string
  label_key: string
  image: string
  year?: number
  /// 10..200
  tolerance_years?: number
  lat?: number
  lon?: number
  /// 50..500
  tolerance_km?: number
  explain_key?: string
}

export interface TimelineMapLevel {
  level: number
  mode: TimelineMode
  timeline?: TimelineSpec
  map?: MapSpec | null
  events: TimelineEvent[]
  show_reference_anchor?: boolean
  scoring?: EngineScoring
}

// ---------------------------------------------------------------------------
// أشكال استجابات مسارات الإنتاج والعمليّات والتحليلات.
//
// منسوخة عن `api/src/lib/audioProductionQueue.ts` و`artProductionQueue.ts`
// و`gamesOps.ts` و`gameAnalytics.ts`. لا حقل هنا لم أقرأه في مصدره: شكل مُخمَّن
// يُنتج شاشةً تعرض `undefined` بثقة، وهو أسوأ من شاشة لا تُبنى.
// ---------------------------------------------------------------------------

export type ProductionStatus = 'missing' | 'pending' | 'ready'

export interface AudioQueueRow {
  language: string
  voice_key: string
  source_text: string | null
  source_text_origin: 'localization' | 'pack' | null
  text_key: string | null
  expected_asset_kind: 'audio'
  game_id: string
  game_title: string
  engine_id: string
  game_status: string
  level: number | null
  requirement: 'required' | 'optional'
  asset_id: string | null
  asset_status: string | null
  production_status: ProductionStatus
  review_status: string
  review_role: string
  blocker: string | null
  purpose: string
}

export interface AudioQueueSummary {
  total: number
  required: number
  optional: number
  ready: number
  pending: number
  missing: number
  required_outstanding: number
  by_language: Record<string, { total: number; ready: number; missing: number; pending: number }>
}

export interface AudioQueueEnvelope {
  summary: AudioQueueSummary
  /// إحصاء غير مُرشَّح، حتى لا يخفي المرشِّح حجم العمل المتبقّي.
  catalogue_summary: AudioQueueSummary
  languages: string[]
  games_covered: number
  rows: AudioQueueRow[]
}

export interface ArtQueueRow {
  asset_id: string
  game_id: string
  game_title: string
  engine_id: string
  game_status: string
  level: number | null
  role: string
  role_label_ar: string
  expected_aspect_ratio: string
  expected_size: string | null
  expected_format: string
  language_dependency: string | null
  brief: string
  asset_status: string | null
  production_status: ProductionStatus
  assigned_owner: string | null
  review_status: string
  review_role: string
  blocker: string | null
}

export interface ArtQueueSummary {
  total: number
  ready: number
  pending: number
  missing: number
  by_role: Record<string, { total: number; ready: number; pending: number; missing: number }>
  language_locked: number
}

export interface ArtQueueEnvelope {
  summary: ArtQueueSummary
  catalogue_summary: ArtQueueSummary
  games_covered: number
  rows: ArtQueueRow[]
}

export type ReadinessBucket =
  | 'ready' | 'blocked' | 'missing_assets' | 'missing_audio'
  | 'missing_localization' | 'missing_review' | 'engine_not_implemented'

export interface GamesOpsOverview {
  total_games: number
  by_planet: Array<{ planet_id: string | null; planet_name: string | null; games: number }>
  by_engine: Array<{ engine_id: string; games: number; implemented: boolean }>
  by_age_track: Array<{ track_id: string; games: number }>
  by_status: Array<{ status: string; games: number }>
  readiness_buckets: Record<ReadinessBucket, number>
  unevaluated_games: number
  engine_coverage: {
    implemented: number
    total: number
    missing: string[]
    unregistered: string[]
  }
  top_blockers: Array<{ check_id: string; label_ar: string; games: number; owners: string[] }>
  games_awaiting_review: number
  draft_count: number
  publishable_count: number
  published_count: number
  games: Array<{
    game_id: string
    title: string
    engine_id: string
    status: string
    age_min: number
    age_max: number
    age_tracks: string[]
    planet_id: string | null
    /// `null` تعني «لم تُقيَّم»، ولا تُعرض أبدًا كـ«جاهزة».
    publishable: boolean | null
    buckets: ReadinessBucket[]
    blocking_reasons: string[]
  }>
}

export interface GameAnalyticsRow {
  game_id: string
  game_title: string | null
  engine_id: string | null
  game_status: string | null
  starts: number
  attempts: number
  completions: number
  successful_attempts: number
  scored_attempts: number
  unscored_attempts: number
  unique_children: number
  completion_rate: number | null
  success_rate: number | null
  help_used_rate: number | null
  average_accuracy: number | null
  average_duration_seconds: number | null
  attempts_with_errors: number
  points_missed: number
  levels_in_pack: number | null
  mastery_movement: {
    by_level: Record<string, number>
    children_tracked: number
    independent: number
    needs_review: number
    basis: string
  }
  accuracy_bands: Record<string, number>
  first_attempt_at: string | null
  last_attempt_at: string | null
}

export interface GameAnalyticsEnvelope {
  since: string | null
  privacy: { policy: string; aggregate_only: true; excluded_columns: string[] }
  definitions: Record<string, string>
  totals: {
    games_with_data: number
    starts: number
    attempts: number
    completions: number
    successful_attempts: number
    unique_children: number
    completion_rate: number | null
    success_rate: number | null
    help_used_rate: number | null
    average_duration_seconds: number | null
  }
  /// إتمام المستويات غير متاح في المخطَّط الحالي، والخادم يقولها صراحةً بدل
  /// استنتاجها من بديل.
  level_completion: { available: false; reason: string }
  games: GameAnalyticsRow[]
}
