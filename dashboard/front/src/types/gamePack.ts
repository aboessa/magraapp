/**
 * نموذج حزمة trace_color في الواجهة.
 *
 * ## لماذا ملف منفصل عن types/api.ts
 *
 * هذه الأنواع ليست شكل استجابة HTTP، بل هي **عقد المحرّك نفسه**:
 * `dashboard/api/src/schemas/trace_color.v1.schema.json`. الحزمة تُخزَّن في
 * `games.content_pack` وتُقرأ حرفيًا في التطبيق، فأي انحراف بين ما يؤلّفه
 * المحرّر هنا وبين المخطَّط يعني حزمة يرفضها الخادم أو — أسوأ — حزمة تُقبل ثم
 * لا تعمل عند الطفل.
 *
 * القوائم أدناه (`TRACE_MODES` و`SCORING_MODES` ...) مكتوبة بالترتيب نفسه الذي
 * في `enum` المخطَّط، حتى تكون المقارنة بالعين ممكنة عند تعديل المخطَّط.
 *
 * ## ما ليس هنا
 *
 * لا تحقّق ولا قيم افتراضية: كلها في lib/tracePack.ts لتبقى دوالًا نقيّة يمكن
 * قراءتها ومقارنتها بـ lib/gamePackValidation.ts في الخادم. الخادم هو الحَكَم؛
 * ما هنا تنبيهات مبكرة لا بديل عنه.
 */

export const TRACE_MODES = [
  'line', 'curve', 'shape', 'number', 'letter', 'path',
  'connect_dots', 'coloring', 'free_draw', 'copy_pattern',
  'complete_drawing', 'draw_from_prompt',
] as const
export type TraceMode = (typeof TRACE_MODES)[number]

export const SCORING_MODES = ['geometric', 'geometric_ordered', 'sequence', 'discrete', 'none'] as const
export type TraceScoring = (typeof SCORING_MODES)[number]

export const COMPLETION_RULES = ['all_strokes_complete', 'all_dots_connected', 'child_taps_done'] as const
export type CompletionRule = (typeof COMPLETION_RULES)[number]

export const LETTER_FORMS = ['isolated', 'initial', 'medial', 'final'] as const
export type LetterForm = (typeof LETTER_FORMS)[number]

export const WRITING_DIRECTIONS = ['rtl', 'ltr'] as const
export type WritingDirection = (typeof WRITING_DIRECTIONS)[number]

export const PACK_LOCALIZATIONS = ['language_neutral', 'translatable', 'language_specific'] as const
export type PackLocalization = (typeof PACK_LOCALIZATIONS)[number]

export const SUPERVISION_LEVELS = ['none', 'recommended', 'required'] as const
export type PackSupervisionLevel = (typeof SUPERVISION_LEVELS)[number]

export const ADVANCE_ON = ['level_complete', 'manual'] as const
export type AdvanceOn = (typeof ADVANCE_ON)[number]

export const REVIEW_STATUSES = ['not_required', 'pending', 'approved', 'rejected'] as const
export type LinguisticReviewStatus = (typeof REVIEW_STATUSES)[number]

/// نوع الخطّة: النقطة تُلمَس ولا تُسحَب، فتحمل نقطة واحدة بالضبط.
export const STROKE_KINDS = ['stroke', 'dot'] as const
export type StrokeKind = (typeof STROKE_KINDS)[number]

export const STROKE_DIRECTIONS = ['forward', 'reverse'] as const
export type StrokeDirection = (typeof STROKE_DIRECTIONS)[number]

/// إحداثيّة في فضاء الحزمة 0..1، تُحلّ على القماش وقت التشغيل.
export type NormalizedPoint = [number, number]

export interface TraceStroke {
  /// `^s[0-9]+$`
  id: string
  order: number
  points: NormalizedPoint[]
  direction?: StrokeDirection
  type?: StrokeKind
}

export interface TraceColoring {
  enabled: boolean
  regions?: string[]
  /// 3..6 ألوان بصيغة `#RRGGBB` بأحرف كبيرة، كما يفرض المخطَّط.
  palette?: string[]
  template_asset?: string
}

export interface TraceConnectDot {
  /// `^d[0-9]+$`
  id: string
  order: number
  at: NormalizedPoint
  label_key?: string
}

export interface TraceCompletion {
  rule: CompletionRule
  min_strokes?: number
}

export interface TraceLevel {
  level: number
  mode: TraceMode
  scoring: TraceScoring
  prompt_key: string
  completion: TraceCompletion
  language?: string
  glyph?: string
  letter_form?: LetterForm
  writing_direction?: WritingDirection
  stroke_paths?: TraceStroke[]
  dots?: TraceConnectDot[]
  tolerance_dp?: number
  coverage_required?: number
  guide_audio?: string
  background_asset?: string
  coloring?: TraceColoring
}

export interface SimplifiedMotor {
  tolerance_dp: number
  coverage_required: number
}

export interface PackAccessibility {
  /// اختيارية في النوع لا في المخطَّط: المخطَّط يفرضها، لكن حزمة مخزَّنة قد تكون
  /// ناقصة، وتعويضها بقيمة افتراضية عند القراءة يعرض «وضعًا مبسّطًا» لم يُعلَنه
  /// أحد — وهي جاهزية مُختلقة. الناقص يبقى ناقصًا ويُعرض كذلك.
  simplified_motor?: SimplifiedMotor
  /// المخطَّط يفرض `true`: بلا بديل للسحب المتّصل يُستبعَد أطفال صعوبات الحركة.
  sequential_tap_alternative?: boolean
  reduced_motion_supported?: boolean
  min_touch_target_dp?: number
}

export interface LinguisticReview {
  status: LinguisticReviewStatus
  reviewer?: string | null
  reviewed_at?: string | null
  notes?: string | null
}

export interface TracePack {
  pack_version: number
  engine_id: string
  pack_id?: string
  localization?: PackLocalization
  supports_dpad?: boolean
  supervision_level?: PackSupervisionLevel
  progression: { levels_to_finish: number; advance_on: AdvanceOn }
  levels: TraceLevel[]
  assets?: { images?: string[]; audio?: string[] }
  voice_manifest: Record<string, string>
  accessibility?: PackAccessibility
  review?: { linguistic_review?: LinguisticReview }
}

// ---------------------------------------------------------------------------
// أشكال استجابات مسارات الإدارة الخاصة بالألعاب.
// ---------------------------------------------------------------------------

export type ReadinessStatus = 'pass' | 'blocked' | 'warn' | 'not_applicable'
export type ReadinessOwner = 'editor' | 'engineering' | 'reviewer' | 'production' | 'provider'

export interface ReadinessCheck {
  id: string
  label_ar: string
  status: ReadinessStatus
  detail?: string
  owner?: ReadinessOwner
  items?: string[]
}

export interface ReadinessAsset {
  asset_id: string
  kind: 'audio' | 'image'
  /// حالة الأصل في content_assets، أو `missing` إن لم يوجد الصفّ أصلًا.
  state?: string
  ready: boolean
}

export interface GameReadiness {
  game_id: string
  status: string
  engine_id: string
  checks: ReadinessCheck[]
  publishable: boolean
  blocking_reasons: string[]
  pack_warnings: string[]
  assets: ReadinessAsset[]
  required_prompt_keys: string[]
  languages: string[]
}

export interface GamePreview {
  game_id: string
  engine_id: string
  status: string
  title: string
  instructions: string | null
  language: string | null
  available_languages: string[]
  /// الحزمة المخزَّنة كما هي. لا نموذج معاينة ثانٍ.
  content_pack: Record<string, unknown> | null
  prompts: Record<string, string>
  help_system: Record<string, unknown>
  validation: { errors: string[]; warnings: string[]; validated: boolean }
}

export const LOCALIZATION_STATUSES = ['draft', 'review_lang', 'ready', 'published', 'archived'] as const
export type LocalizationStatus = (typeof LOCALIZATION_STATUSES)[number]

export interface GameLocalizationRecord {
  language: string
  title: string | null
  instructions: string | null
  prompts: Record<string, string>
  voice_manifest: Record<string, string>
  status: string
  translated_from: string | null
  is_machine_translated: boolean
  updated_at?: string
}

export interface GameLocalizationsEnvelope {
  game_id: string
  /// اللغات المدعومة كما يعلنها الخادم، فإضافة لغة رابعة لا تحتاج تعديل واجهة.
  languages: string[]
  required_prompt_keys: string[]
  /// مفاتيح الصوت التي تعلنها الحزمة، لتُتاح إعادة تعريفها لكل لغة.
  voice_keys: string[]
  localization_policy: string | null
  localizations: GameLocalizationRecord[]
}

export interface GameLocalizationPayload {
  title?: string | null
  instructions?: string | null
  prompts?: Record<string, string>
  voice_manifest?: Record<string, string>
  status?: string
  translated_from?: string | null
  is_machine_translated?: boolean
}
