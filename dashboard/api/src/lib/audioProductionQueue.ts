/// The voice-over production queue: every clip the catalogue needs, recorded or not.
///
/// ## The failure this exists to prevent
///
/// Audio was tracked as a count. `publishReadiness` could say «3 تسجيلات صوتية
/// غير جاهزة» and list three asset ids, which is enough to know a game is
/// blocked and useless for actually recording anything. A voice agency cannot
/// work from `asset-vo-tc-intro`; it needs to know which line, in which language,
/// for which level, and what the child is supposed to hear.
///
/// Worse, the count only ever saw ids the pack had *already been given*. A clip
/// that nobody had thought of yet did not appear as missing — it did not appear at
/// all. `count_quantity` is the clearest case: the contract requires twenty
/// separate number clips («أرقام العدّ: مقاطع منفصلة لكل رقم 1–20»,
/// `docs/games/03-voice-arabic.md`) because the engine speaks numbers in sequence
/// while highlighting each element, so a single pre-recorded sentence cannot work.
/// A pack whose `voice_manifest` binds only six keys was therefore reported as
/// needing zero recordings while being twenty short.
///
/// So this module derives the requirement from the **contract**, not from the
/// pack, and then reports what the pack and the asset table have actually
/// achieved against it. The difference between "what is bound" and "what is
/// needed" is the entire product.
///
/// ## Three rules that are not negotiable
///
///  1. **Nothing is ever reported ready that is not ready.** `production_status`
///     is `ready` only when `content_assets.status = 'ready'`. Every other state,
///     including `failed` and `archived`, is `pending`, and an unbound key or a
///     dangling id is `missing`. A queue that optimistically reports progress is
///     how a launch discovers on the day that a third of its audio does not exist.
///  2. **No recording is invented.** `source_text` is either text a human
///     authored — in `game_localizations` or in the pack itself — or `null`.
///     `source_text_origin` says which, so nobody mistakes a pack literal for an
///     approved script.
///  3. **A non-Arabic language does not inherit the Arabic clip.** At runtime
///     `lib/gameDelivery.ts` merges the per-language overrides over the pack
///     defaults, so a French session falls back to the Arabic recording rather
///     than to silence. That is right for playback and wrong for production: here
///     a French row with no French override is `missing`, because it is.
///
/// Pure, so the requirement tables are unit testable without a database.
/// `routes/adminGames` supplies the rows.

import { BASE_REQUIRED_VOICE_KEYS } from './packSchema.ts';

/// Where the asset id for a requirement is bound.
///
/// Two mechanisms exist and they are not interchangeable. `voice_manifest` keys
/// are pack-wide semantic slots. Per-element recordings — a letter's sound, an
/// item's name — are bound on the element itself, because there is one per element
/// and the manifest's key pattern (`^vo\.[a-z_]+(\.[A-Za-z0-9_-]+)?$`) cannot even
/// express an Arabic letter as a key.
export type VoiceBinding = 'voice_manifest' | 'level_field';

export interface VoiceRequirement {
  /// The semantic key. Semantic and not textual, so it survives translation
  /// (`docs/games/03-voice-arabic.md`, principle 6).
  voiceKey: string;
  /// False for clips the contracts describe as conditional or as a bonus.
  required: boolean;
  /// The level this clip belongs to, or null when it is pack-wide.
  level: number | null;
  binding: VoiceBinding;
  /// Asset id already bound on the level, for `level_field` requirements.
  boundAssetId?: string | null;
  /// The i18n key whose translated text this clip must speak, when the pack names
  /// one. This is what makes a real script reachable instead of a guess.
  textKey?: string | null;
  /// Literal text authored in the pack, e.g. the word a `word_build` level
  /// teaches. Arabic by construction, so it is only offered as Arabic source.
  packText?: string | null;
  /// One line describing the clip, for the recording brief.
  purpose: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function levelsOf(pack: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return Array.isArray(pack?.levels) ? (pack!.levels as unknown[]).filter(isObject) : [];
}

function levelNumber(level: Record<string, unknown>, index: number): number {
  const value = Number(level.level);
  return Number.isFinite(value) && value > 0 ? value : index + 1;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function entries(level: Record<string, unknown>, key: string): Array<Record<string, unknown>> {
  const list = level[key];
  return Array.isArray(list) ? list.filter(isObject) : [];
}

/// Engines that never say «أحسنت» or «جرّب مرة أخرى».
///
/// «الكل عدا memory_flip وrhythm_tap» for `vo.correct` and `vo.retry`
/// (`docs/games/03-voice-arabic.md`), and `docs/games/04-encouragement-and-
/// failure.md` gives the reason for each: commenting on every failed flip spoils
/// the game, and in a rhythm game the music *is* the feedback. Requiring the clips
/// would have production record two lines that the engine is forbidden to play.
export const ENGINES_WITHOUT_FEEDBACK_VOICE: readonly string[] = ['memory_flip', 'rhythm_tap'];

/// Engines whose help ladder speaks a single `vo.hint`.
///
/// `logic_pattern` (two graded hints), `timeline_map` (directional hints) and the
/// two engines above are absent deliberately: they either name their hint clips
/// differently or have no spoken hint at all.
export const ENGINES_WITH_SPOKEN_HINT: readonly string[] = [
  'trace_color', 'match_pairs', 'sort_bins', 'sequence_order',
  'count_quantity', 'word_build', 'block_code', 'sim_lab',
];

/// How many separate number clips `count_quantity` needs.
export const COUNT_CLIP_MAX = 20;

/// The level from which `memory_flip` explains a pair aloud.
///
/// «`vo.pair_explain` — للمستوى 5». Below that the pairs are identical images and
/// there is nothing to explain, so the clip is optional rather than missing.
export const PAIR_EXPLAIN_FROM_LEVEL = 5;

/// Pack-wide clips every engine needs, plus the two feedback clips and the hint
/// where the engine has one.
function sharedRequirements(engineId: string): VoiceRequirement[] {
  const out: VoiceRequirement[] = BASE_REQUIRED_VOICE_KEYS.map((voiceKey) => ({
    voiceKey,
    required: true,
    level: null,
    binding: 'voice_manifest' as VoiceBinding,
    purpose: BASE_PURPOSES[voiceKey] ?? 'مفتاح صوتي أساسي',
  }));

  if (!ENGINES_WITHOUT_FEEDBACK_VOICE.includes(engineId)) {
    out.push({
      voiceKey: 'vo.correct', required: true, level: null, binding: 'voice_manifest',
      purpose: 'تشجيع عند النجاح، من بنك التشجيع لا جملة واحدة مكرّرة',
    });
    out.push({
      voiceKey: 'vo.retry', required: true, level: null, binding: 'voice_manifest',
      purpose: 'دعوة لإعادة المحاولة بنبرة دافئة، ليست نغمة فشل',
    });
  }
  if (ENGINES_WITH_SPOKEN_HINT.includes(engineId)) {
    out.push({
      voiceKey: 'vo.hint', required: true, level: null, binding: 'voice_manifest',
      purpose: 'تلميح يشير إلى القاعدة لا إلى الجواب',
    });
  }
  return out;
}

const BASE_PURPOSES: Record<string, string> = {
  'vo.intro': 'ترحيب عند فتح اللعبة، يُسمع مرة واحدة',
  'vo.instruction': 'التعليمة الأساسية التي يعتمد عليها طفل ما قبل القراءة',
  'vo.instruction_repeat': 'نفس التعليمة أبطأ، لزرّ «اسمع مرة أخرى» الظاهر دائمًا',
  'vo.level_complete': 'إنهاء مستوى',
  'vo.game_complete': 'إنهاء اللعبة',
  'vo.exit_confirm': 'تأكيد الخروج',
};

/// Per-engine clips, derived from the canonical tables.
///
/// The engine table in `docs/games/03-voice-arabic.md` is the authority for what
/// is mandatory; the per-engine documents add clips that they themselves qualify
/// as conditional, and those are marked optional here. Getting that split wrong in
/// either direction is expensive: a mandatory clip marked optional is a clip that
/// never gets recorded, and an optional clip marked mandatory is a studio session
/// spent on a line the engine will not play.
function engineRequirements(
  engineId: string,
  pack: Record<string, unknown> | null,
): VoiceRequirement[] {
  const out: VoiceRequirement[] = [];
  const levels = levelsOf(pack);
  const push = (requirement: VoiceRequirement) => out.push(requirement);

  switch (engineId) {
    case 'trace_color': {
      // Both are conditional on content the pack actually has: no strokes means
      // no stroke-complete praise, and no colouring level means no invitation to
      // colour.
      const hasStrokes = levels.some((level) => Array.isArray(level.stroke_paths) && level.stroke_paths.length > 0);
      const hasColoring = levels.some((level) => isObject(level.coloring) || level.mode === 'coloring');
      if (hasStrokes) {
        push({
          voiceKey: 'vo.stroke_complete', required: true, level: null, binding: 'voice_manifest',
          purpose: 'ثناء قصير عند إكمال ضربة رسم',
        });
      }
      if (hasColoring) {
        push({
          voiceKey: 'vo.coloring_intro', required: true, level: null, binding: 'voice_manifest',
          purpose: 'دعوة للتلوين الحر بعد التتبّع',
        });
      }
      break;
    }

    case 'count_quantity': {
      // Twenty separate clips, not one sentence. The engine speaks the numbers in
      // sequence while highlighting each element during a corrective recount, and
      // a pre-recorded sentence cannot be cut apart to do that.
      for (let number = 1; number <= COUNT_CLIP_MAX; number += 1) {
        push({
          voiceKey: `vo.count.${number}`, required: true, level: null, binding: 'voice_manifest',
          purpose: `الرقم ${number} منطوقًا كمقطع منفصل، للعدّ التتابعي مع إبراز كل عنصر`,
        });
      }
      push({
        voiceKey: 'vo.recount', required: true, level: null, binding: 'voice_manifest',
        purpose: 'دعوة لإعادة العدّ، وزرّ إعادة العدّ ظاهر دائمًا',
      });
      push({
        voiceKey: 'vo.explain_answer', required: true, level: null, binding: 'voice_manifest',
        purpose: 'شرح الجواب بعد الخطأ، مثل «خمسة أقل من ثمانية»',
      });
      break;
    }

    case 'sort_bins': {
      push({
        voiceKey: 'vo.explain_correct', required: true, level: null, binding: 'voice_manifest',
        purpose: 'شرح سبب صحّة الفرز، مثل «السمكة تعيش في الماء»',
      });
      levels.forEach((level, index) => {
        const number = levelNumber(level, index);
        for (const bin of entries(level, 'bins')) {
          const id = str(bin.id);
          if (!id) continue;
          push({
            voiceKey: `vo.bin_label.${id}`, required: true, level: number, binding: 'level_field',
            boundAssetId: str(bin.audio), textKey: str(bin.label_key),
            purpose: `اسم السلّة "${id}" منطوقًا عند لمسها`,
          });
        }
        for (const item of entries(level, 'items')) {
          const id = str(item.id);
          if (!id) continue;
          push({
            voiceKey: `vo.item_label.${id}`, required: true, level: number, binding: 'level_field',
            boundAssetId: str(item.audio), textKey: str(item.label_key),
            purpose: `اسم العنصر "${id}" منطوقًا عند لمسه`,
          });
          if (item.explain_audio !== undefined || level.explain_on_correct === true) {
            push({
              voiceKey: `vo.explain_correct.${id}`, required: false, level: number, binding: 'level_field',
              boundAssetId: str(item.explain_audio), textKey: str(item.label_key),
              purpose: `شرح خاص بالعنصر "${id}"`,
            });
          }
        }
      });
      break;
    }

    case 'match_pairs': {
      levels.forEach((level, index) => {
        const number = levelNumber(level, index);
        for (const key of ['items', 'targets', 'distractors'] as const) {
          for (const entry of entries(level, key)) {
            const id = str(entry.id);
            if (!id) continue;
            push({
              // A distractor is touched and named exactly like a real item, so it
              // needs the same clip; leaving it silent tells a child which tiles
              // are the decoys.
              voiceKey: `vo.item_label.${id}`, required: true, level: number, binding: 'level_field',
              boundAssetId: str(entry.audio), textKey: str(entry.label_key),
              purpose: `اسم "${id}" منطوقًا عند لمسه (${key})`,
            });
          }
        }
      });
      break;
    }

    case 'sequence_order': {
      push({
        voiceKey: 'vo.narrate_complete', required: true, level: null, binding: 'voice_manifest',
        purpose: 'سرد التسلسل كاملًا بعد إتمامه',
      });
      levels.forEach((level, index) => {
        const number = levelNumber(level, index);
        for (const panel of entries(level, 'panels')) {
          const id = str(panel.id);
          if (!id) continue;
          push({
            voiceKey: `vo.panel_caption.${id}`, required: true, level: number, binding: 'level_field',
            boundAssetId: str(panel.audio), textKey: str(panel.caption_key),
            purpose: `تعليق اللوحة "${id}"`,
          });
        }
      });
      break;
    }

    case 'word_build': {
      levels.forEach((level, index) => {
        const number = levelNumber(level, index);
        const word = str(level.word);
        push({
          voiceKey: 'vo.word', required: true, level: number, binding: 'level_field',
          boundAssetId: str(level.word_audio), packText: word,
          purpose: word ? `الكلمة "${word}" منطوقة بوضوح` : 'الكلمة منطوقة بوضوح',
        });
        push({
          voiceKey: 'vo.word_syllables', required: true, level: number, binding: 'level_field',
          boundAssetId: str(level.word_syllables_audio), packText: word,
          purpose: word ? `الكلمة "${word}" مقطّعة، مثل «قَ — مَ — ر»` : 'الكلمة مقطّعة',
        });
        // One clip per letter *per form used*: «أصوات الحروف: مقطع لكل حرف بكل شكل
        // مستخدم». The key is positional because the manifest key pattern accepts
        // only ASCII after the prefix, so an Arabic character cannot be a key.
        for (const letter of entries(level, 'letters')) {
          const position = Number(letter.position);
          const char = str(letter.char);
          const form = str(letter.form);
          const slot = Number.isFinite(position) && position > 0 ? `p${position}` : 'p0';
          push({
            voiceKey: `vo.letter.${slot}`, required: true, level: number, binding: 'level_field',
            boundAssetId: str(letter.audio), packText: char,
            purpose: char
              ? `صوت الحرف "${char}"${form ? ` بشكله ${form}` : ''} في الموضع ${slot}`
              : `صوت الحرف في الموضع ${slot}`,
          });
        }
      });
      break;
    }

    case 'memory_flip': {
      push({
        voiceKey: 'vo.pair_found', required: true, level: null, binding: 'voice_manifest',
        purpose: 'إعلان إيجاد زوج. ولا يوجد vo.retry في هذا المحرّك: الصمت مقصود',
      });
      levels.forEach((level, index) => {
        const number = levelNumber(level, index);
        for (const pair of entries(level, 'pairs')) {
          const a = str(pair.a);
          const b = str(pair.b);
          const id = a && b ? `${a}_${b}` : a ?? b;
          if (!id) continue;
          push({
            voiceKey: `vo.card_label.${id}`, required: true, level: number, binding: 'level_field',
            boundAssetId: str(pair.audio), textKey: str(pair.sound_key),
            purpose: `اسم البطاقة "${id}" منطوقًا`,
          });
          push({
            // Only from level 5, where pairs stop being identical and start being
            // associated, which is the only case with something to explain.
            voiceKey: `vo.pair_explain.${id}`,
            required: number >= PAIR_EXPLAIN_FROM_LEVEL,
            level: number,
            binding: 'level_field',
            boundAssetId: str(pair.explain_audio), textKey: str(pair.sound_key),
            purpose: `شرح العلاقة بين "${a ?? '?'}" و"${b ?? '?'}"`,
          });
        }
      });
      break;
    }

    case 'logic_pattern': {
      push({
        voiceKey: 'vo.instruction_explain', required: true, level: null, binding: 'voice_manifest',
        purpose: 'التعليمة الثانية: اختيار القاعدة المستخدمة',
      });
      push({
        voiceKey: 'vo.hint_1', required: true, level: null, binding: 'voice_manifest',
        purpose: 'التلميح الأول: ما يتغيّر بين الصفوف',
      });
      push({
        voiceKey: 'vo.hint_2', required: true, level: null, binding: 'voice_manifest',
        purpose: 'التلميح الثاني: بُعدان معًا',
      });
      push({
        voiceKey: 'vo.explain_rule', required: true, level: null, binding: 'voice_manifest',
        purpose: 'شرح القاعدة بعد الحل',
      });
      break;
    }

    case 'block_code': {
      // One clip per block token the levels actually allow. A block whose name a
      // pre-reading child cannot hear is a block they cannot use.
      const tokens = new Set<string>();
      for (const level of levels) {
        for (const token of Array.isArray(level.allowed_blocks) ? level.allowed_blocks : []) {
          if (typeof token === 'string' && token) tokens.add(token);
        }
      }
      for (const token of [...tokens].sort()) {
        push({
          voiceKey: `vo.block.${token}`, required: true, level: null, binding: 'voice_manifest',
          purpose: `اسم الأمر "${token}" منطوقًا`,
        });
      }
      push({
        voiceKey: 'vo.collision', required: true, level: null, binding: 'voice_manifest',
        purpose: 'توقّف روبو عند اصطدام، بصيغة سؤال لا تأنيب',
      });
      push({
        voiceKey: 'vo.star_optimal', required: true, level: null, binding: 'voice_manifest',
        purpose: 'ثناء على حلّ بعدد أوامر قليل',
      });
      break;
    }

    case 'sim_lab': {
      for (const [voiceKey, purpose] of [
        ['vo.stage_predict', 'المرحلة الأولى: اطلب التوقّع قبل التجربة'],
        ['vo.stage_experiment', 'المرحلة الثانية: حرّك المتغيّر وراقب'],
        ['vo.stage_explain', 'المرحلة الثالثة: فسّر ما حدث'],
        ['vo.trial_recorded', 'تسجيل محاولة في جدول النتائج'],
        ['vo.need_more_trials', 'رفض التفسير قبل عدد كافٍ من المحاولات'],
        ['vo.explain_final', 'الخلاصة العلمية بعد التفسير الصحيح'],
      ] as const) {
        push({ voiceKey, required: true, level: null, binding: 'voice_manifest', purpose });
      }
      // Present in the engine document but not in the canonical mandatory table,
      // so they are recorded when the budget allows rather than blocking a launch.
      push({
        voiceKey: 'vo.prediction_recorded', required: false, level: null, binding: 'voice_manifest',
        purpose: 'إقرار بتسجيل التوقّع',
      });
      push({
        voiceKey: 'vo.retry_explain', required: false, level: null, binding: 'voice_manifest',
        purpose: 'إعادة توجيه بعد تفسير خاطئ',
      });
      break;
    }

    case 'timeline_map': {
      for (const [voiceKey, purpose] of [
        ['vo.hint_older', 'تلميح: أقدم من ذلك'],
        ['vo.hint_newer', 'تلميح: أحدث من ذلك'],
        ['vo.hint_direction', 'تلميح اتجاه على الخريطة'],
        ['vo.explain_event', 'شرح الحدث بعد وضعه'],
      ] as const) {
        push({ voiceKey, required: true, level: null, binding: 'voice_manifest', purpose });
      }
      levels.forEach((level, index) => {
        const number = levelNumber(level, index);
        for (const event of entries(level, 'events')) {
          const id = str(event.id);
          if (!id) continue;
          push({
            voiceKey: `vo.event_label.${id}`, required: true, level: number, binding: 'voice_manifest',
            textKey: str(event.label_key),
            purpose: `اسم الحدث "${id}" منطوقًا`,
          });
        }
      });
      break;
    }

    case 'rhythm_tap': {
      // The one non-`vo.` row in this queue. The track is an audio production item
      // with the same lifecycle as a recording and a rights clearance of its own
      // («ترخيص تجاري + نطاق جغرافي + مدة»), and leaving it to the art queue would
      // file a nasheed with the illustrations.
      levelsOf(pack).forEach((level, index) => {
        push({
          voiceKey: 'music.track', required: true, level: levelNumber(level, index),
          binding: 'level_field', boundAssetId: str(level.track),
          purpose: 'المقطوعة الموسيقية للمستوى — تحتاج ترخيصًا تجاريًا موثّقًا',
        });
      });
      break;
    }

    default:
      break;
  }

  return out;
}

/// Every clip a game needs, contract first.
export function voiceRequirements(
  engineId: string,
  pack: Record<string, unknown> | null,
): VoiceRequirement[] {
  const shared = sharedRequirements(engineId);
  const specific = engineRequirements(engineId, pack);

  // A level-specific `vo.instruction` where the level names its own prompt: the
  // instruction differs per level in most engines («حسب match_type»), so one clip
  // per pack would say the wrong thing from level two onwards.
  const perLevel: VoiceRequirement[] = [];
  for (const [index, level] of levelsOf(pack).entries()) {
    const promptKey = str(level.prompt_key);
    if (!promptKey) continue;
    perLevel.push({
      voiceKey: 'vo.instruction', required: true, level: levelNumber(level, index),
      binding: 'voice_manifest', textKey: promptKey,
      purpose: `تعليمة المستوى ${levelNumber(level, index)}`,
    });
  }

  const all = [...shared, ...perLevel, ...specific];

  // Deduplicate on (key, level): a pack-wide `vo.instruction` and a level's own
  // instruction are different rows, but two identical rows are a bug that would
  // book the same session twice.
  const seen = new Set<string>();
  return all.filter((requirement) => {
    const id = `${requirement.voiceKey}#${requirement.level ?? ''}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/// The three states production cares about.
export type ProductionStatus = 'missing' | 'pending' | 'ready';

export interface AudioQueueLocalization {
  language: string;
  /// `game_localizations.status`.
  status: string;
  /// i18n key -> translated text.
  prompts: Record<string, string>;
  /// voice key -> asset id, overriding the pack default for this language.
  voiceManifest: Record<string, string>;
}

export interface AudioQueueGame {
  id: string;
  title: string;
  engineId: string;
  /// `games.status`; the queue covers draft and published alike, because audio is
  /// exactly the work that has to happen *before* publish.
  status: string;
  pack: Record<string, unknown> | null;
  localizations: AudioQueueLocalization[];
  /// `content_reviews` rows for this game.
  reviews: Array<{ role: string; status: string }>;
}

export interface AudioQueueOptions {
  /// Languages to enumerate, from `lib/gameDelivery.ts` rather than hard-coded.
  languages: readonly string[];
  /// asset id -> `content_assets.status`. Ids absent from the map have no row.
  assetStatus: Record<string, string>;
}

export interface AudioQueueRow {
  language: string;
  voice_key: string;
  /// The line to record, when a human has written one. Never generated.
  source_text: string | null;
  source_text_origin: 'localization' | 'pack' | null;
  /// The i18n key the text comes from, so an editor can go and write it.
  text_key: string | null;
  /// Always `audio`: this queue exists to produce `content_assets.kind = 'audio'`.
  expected_asset_kind: 'audio';
  game_id: string;
  game_title: string;
  engine_id: string;
  game_status: string;
  level: number | null;
  requirement: 'required' | 'optional';
  asset_id: string | null;
  /// Raw `content_assets.status`, so `failed` stays visible behind `pending`.
  asset_status: string | null;
  production_status: ProductionStatus;
  /// The human review that governs this clip, and its state.
  review_status: string;
  review_role: string;
  /// What stops this row, or null when nothing does.
  blocker: string | null;
  purpose: string;
}

/// Resolves the review that governs a clip.
///
/// Voice-over is a language artefact, so `lang` governs it: «معلّق بشري. لا صوت
/// اصطناعي في نسخة منشورة دون مراجعة وحقوق وموافقة موثقة». Music is a rights
/// artefact, so the track answers to `rights`. Filing both under one role would
/// let an approved script stand in for an unsigned licence.
function reviewFor(
  reviews: Array<{ role: string; status: string }>,
  role: string,
): string {
  const rows = reviews.filter((row) => row.role === role);
  if (!rows.length) return 'no_review_record';
  if (rows.some((row) => row.status === 'rejected')) return 'rejected';
  if (rows.some((row) => row.status === 'needs_changes')) return 'needs_changes';
  if (rows.some((row) => row.status === 'pending')) return 'pending';
  if (rows.some((row) => row.status === 'approved')) return 'approved';
  return rows[0].status;
}

/// Builds the queue for a set of games.
export function buildAudioProductionQueue(
  games: readonly AudioQueueGame[],
  options: AudioQueueOptions,
): AudioQueueRow[] {
  const rows: AudioQueueRow[] = [];

  for (const game of games) {
    const requirements = voiceRequirements(game.engineId, game.pack);
    const packVoice = isObject(game.pack?.voice_manifest)
      ? game.pack!.voice_manifest as Record<string, unknown>
      : {};

    for (const language of options.languages) {
      const localization = game.localizations.find((row) => row.language === language) ?? null;

      for (const requirement of requirements) {
        const override = localization?.voiceManifest?.[requirement.voiceKey] ?? null;
        const packDefault = requirement.binding === 'level_field'
          ? requirement.boundAssetId ?? null
          : str(packVoice[requirement.voiceKey]);

        // Arabic is the authored language, so the pack's own binding is its
        // recording. Another language has a recording only when it has an
        // override of its own; the runtime's fallback to Arabic is playback
        // behaviour and must not be mistaken for a delivered clip.
        const assetId = language === 'ar' ? override ?? packDefault : override;

        const assetStatus = assetId ? options.assetStatus[assetId] ?? null : null;
        const productionStatus: ProductionStatus = !assetId || assetStatus === null
          ? 'missing'
          : assetStatus === 'ready' ? 'ready' : 'pending';

        // Source text, in order of authority: the translation an editor wrote for
        // the key the pack names, then anything filed directly under the voice
        // key, then a literal the pack itself carries — and that last one only
        // for Arabic, because a pack literal is Arabic.
        let sourceText: string | null = null;
        let origin: AudioQueueRow['source_text_origin'] = null;
        const byTextKey = requirement.textKey ? localization?.prompts?.[requirement.textKey] : undefined;
        const byVoiceKey = localization?.prompts?.[requirement.voiceKey];
        if (typeof byTextKey === 'string' && byTextKey) {
          sourceText = byTextKey;
          origin = 'localization';
        } else if (typeof byVoiceKey === 'string' && byVoiceKey) {
          sourceText = byVoiceKey;
          origin = 'localization';
        } else if (language === 'ar' && requirement.packText) {
          sourceText = requirement.packText;
          origin = 'pack';
        }

        const reviewRole = requirement.voiceKey === 'music.track' ? 'rights' : 'lang';
        const reviewStatus = reviewFor(game.reviews, reviewRole);

        const blockers: string[] = [];
        if (productionStatus === 'missing') {
          blockers.push(assetId
            ? `الأصل "${assetId}" غير موجود في سجلّ الأصول`
            : `لا أصل مرتبط بالمفتاح "${requirement.voiceKey}" للغة ${language}`);
        } else if (productionStatus === 'pending') {
          blockers.push(`حالة الأصل "${assetStatus}" وليست ready`);
        }
        if (!sourceText) blockers.push('لا نصّ مصدر مكتوب لهذا المقطع');
        if (reviewStatus === 'rejected' || reviewStatus === 'needs_changes') {
          blockers.push(`المراجعة (${reviewRole}) أعادت العمل: ${reviewStatus}`);
        }

        rows.push({
          language,
          voice_key: requirement.voiceKey,
          source_text: sourceText,
          source_text_origin: origin,
          text_key: requirement.textKey ?? null,
          expected_asset_kind: 'audio',
          game_id: game.id,
          game_title: game.title,
          engine_id: game.engineId,
          game_status: game.status,
          level: requirement.level,
          requirement: requirement.required ? 'required' : 'optional',
          asset_id: assetId ?? null,
          asset_status: assetStatus,
          production_status: productionStatus,
          review_status: reviewStatus,
          review_role: reviewRole,
          blocker: blockers.length ? blockers.join(' · ') : null,
          purpose: requirement.purpose,
        });
      }
    }
  }

  return rows;
}

/// Every asset id the queue could possibly refer to, for one batched status lookup.
///
/// Exists so the route resolves `content_assets.status` in a handful of queries
/// instead of one per row. A per-row lookup on a catalogue-wide queue is hundreds
/// of round trips inside a Worker request, which is not a performance detail — it
/// is the difference between an endpoint that answers and one that times out and
/// therefore never gets used.
export function audioQueueAssetIds(games: readonly AudioQueueGame[]): string[] {
  const ids = new Set<string>();
  for (const game of games) {
    const packVoice = isObject(game.pack?.voice_manifest)
      ? game.pack!.voice_manifest as Record<string, unknown>
      : {};
    for (const value of Object.values(packVoice)) {
      const id = str(value);
      if (id) ids.add(id);
    }
    for (const requirement of voiceRequirements(game.engineId, game.pack)) {
      if (requirement.boundAssetId) ids.add(requirement.boundAssetId);
    }
    for (const localization of game.localizations) {
      for (const value of Object.values(localization.voiceManifest ?? {})) {
        const id = str(value);
        if (id) ids.add(id);
      }
    }
  }
  return [...ids];
}

export interface AudioQueueSummary {
  total: number;
  required: number;
  optional: number;
  ready: number;
  pending: number;
  missing: number;
  /// Required clips that are not ready. The number that matters for a launch.
  required_outstanding: number;
  by_language: Record<string, { total: number; ready: number; missing: number; pending: number }>;
}

/// Counts, derived from the rows rather than from a second query.
///
/// A summary computed independently of the list it summarises is a summary that
/// will one day disagree with it.
export function summarizeAudioQueue(rows: readonly AudioQueueRow[]): AudioQueueSummary {
  const summary: AudioQueueSummary = {
    total: rows.length,
    required: 0,
    optional: 0,
    ready: 0,
    pending: 0,
    missing: 0,
    required_outstanding: 0,
    by_language: {},
  };
  for (const row of rows) {
    if (row.requirement === 'required') summary.required += 1; else summary.optional += 1;
    summary[row.production_status] += 1;
    if (row.requirement === 'required' && row.production_status !== 'ready') {
      summary.required_outstanding += 1;
    }
    const bucket = summary.by_language[row.language] ??= { total: 0, ready: 0, missing: 0, pending: 0 };
    bucket.total += 1;
    bucket[row.production_status] += 1;
  }
  return summary;
}
