/// Publish readiness for a game, as a list of named checks.
///
/// ## Why not a boolean
///
/// The previous behaviour was a single 400 with one message, so an editor learned
/// about one blocker at a time and had to re-attempt a publish to discover the
/// next. A game typically has several: unproduced artwork, unrecorded audio, a
/// pending review, two unfinished translations. Reporting them together is the
/// difference between a checklist and a guessing game.
///
/// Each check carries its own status and, when it is not passing, *who or what*
/// resolves it. A missing recording is not an engineering task and should not look
/// like one.
///
/// ## Why it now covers twelve engines instead of one
///
/// The first version of this file was written while `trace_color` was the only
/// engine with a runtime, and it hard-coded that engine's world view: the
/// linguistic review was the only review it knew about, `simplified_motor
/// .tolerance_dp` was mandatory for every pack, and a learning objective was
/// mandatory unless every level was unscored.
///
/// Applied unchanged to the other eleven that is not merely incomplete, it is
/// wrong in both directions:
///
///  * `sim_lab`, `timeline_map`, `rhythm_tap` and `word_build` each carry a review
///    that a person outside engineering must grant. None of them was checked, so
///    an unreviewed science experiment or an unlicensed nasheed would have
///    published silently.
///  * `rhythm_tap` and `memory_flip` must **not** carry a learning objective
///    (`ENGINES_WITHOUT_MASTERY`). The old rule demanded one, which is the exact
///    inversion of the contract.
///  * `simplified_motor.tolerance_dp` describes a *drawing tolerance*. Demanding
///    it from `logic_pattern` would have blocked every pack in an engine that has
///    no geometry to be tolerant about, teaching editors that readiness output is
///    noise to be worked around.
///
/// So every rule here is derived from the engine's own contract
/// ([engineContract]) rather than from one engine's shape.
///
/// ## What every check must answer
///
/// Three questions, always: **what** is missing, **who** resolves it, and
/// **whether** it stops the publish. A check that answers only the first is why
/// production items get forgotten — "الصوت ناقص" with no owner is a note, not a
/// task. `detail` and `items` answer the first, `owner` the second, `status` the
/// third.
///
/// Pure: no database access, so every rule is unit testable. `routes/adminGames`
/// gathers the rows and calls [evaluatePublishReadiness].

import { engineContract, REVIEW_OWNERS } from './engineContracts.ts';

export type CheckStatus =
  /// Satisfied.
  | 'pass'
  /// Not satisfied, and it blocks publication.
  | 'blocked'
  /// Not satisfied, does not block publication.
  | 'warn'
  /// Does not apply to this game.
  | 'not_applicable';

/// Who resolves a failing check. Surfaced so the CMS can say "waiting on a
/// linguist" rather than implying an engineer forgot something.
///
/// `provider` is the one that exists purely because it is external: a font
/// foundry, a rights holder, a voice agency. Nobody inside the team can clear it
/// by working harder, and an owner of `production` would hide that.
export type CheckOwner = 'editor' | 'engineering' | 'reviewer' | 'production' | 'provider';

export interface ReadinessCheck {
  id: string;
  label_ar: string;
  status: CheckStatus;
  /// Precise reason, safe to show an editor. Never a generic failure.
  detail?: string;
  owner?: CheckOwner;
  /// Items that make this check fail, for example the specific missing assets.
  items?: string[];
}

export interface PublishReadiness {
  checks: ReadinessCheck[];
  /// True only when no check is `blocked`.
  publishable: boolean;
  /// Every blocking reason, in the order the checks are listed.
  blocking_reasons: string[];
}

/// One human review row from `content_reviews`, reduced to what readiness needs.
export interface ReadinessReviewRow {
  /// `content_reviews.reviewer_role`: edu | lang | sharia | rights | qa.
  role: string;
  /// `content_reviews.status`: pending | approved | rejected | needs_changes.
  status: string;
  reviewer?: string | null;
}

/// An asset attached to the *game* rather than named by the pack, i.e. an
/// `asset_links` row: the store cover, the catalogue illustration.
///
/// Kept separate from `assets` because the failure is different. A pack asset
/// that is missing breaks gameplay; a missing cover does not break gameplay but
/// puts a blank tile in a child's library, which is the kind of defect that
/// reaches a parent before it reaches a bug tracker.
export interface ReadinessProductionAsset {
  role: string;
  assetId: string | null;
  /// `content_assets.status`, or null when no row exists for the id.
  status: string | null;
}

export interface ReadinessInput {
  engineId: string;
  /// False when this deployment has no runtime schema for the engine.
  engineHasRuntimeSchema: boolean;
  /// Errors from `validateGamePack` run with `forPublish: true`.
  packErrors: string[];
  packWarnings: string[];
  /// Null when the pack is absent or unparseable.
  pack: Record<string, unknown> | null;
  objectiveId: string | null;
  objectiveCode: string | null;
  /// Primary skill, i.e. `learning_objectives.skill_id`.
  primarySkillId: string | null;
  secondarySkillIds: string[];
  /// Per-language localisation rows that exist for this game.
  localizations: Array<{
    language: string;
    status: string;
    hasTitle: boolean;
    hasInstructions: boolean;
    missingPromptKeys: string[];
    isMachineTranslated: boolean;
  }>;
  /// Prompt keys the pack expects to be translated.
  requiredPromptKeys: string[];
  /// Asset ids referenced by the pack, split by their state.
  assets: {
    required: string[];
    missing: string[];
    notReady: string[];
  };
  /// Audio asset ids specifically, so audio can be reported separately from art.
  audio: {
    required: string[];
    missing: string[];
    notReady: string[];
  };
  ageMin: number;
  ageMax: number;
  supervisionLevel: string;
  safetyNotes: string | null;
  /// True when the game is a test fixture, which must never reach production.
  isTestFixture: boolean;

  // --- Added when readiness grew past trace_color. All optional, because the
  // --- checks must degrade to `not_applicable` rather than to a false `pass`
  // --- when a caller has not gathered the evidence yet.

  /// Highest `pack_version` the deployed engine can run, from
  /// `game_engines.mechanics.engine_version`.
  supportedPackVersion?: number;
  /// Whether the shipped client registers a runtime for this engine.
  ///
  /// Distinct from [engineHasRuntimeSchema], which is a *server* fact. A pack can
  /// validate perfectly on an API that knows its schema while the app in a
  /// child's hand has no widget to play it, and that combination produces a
  /// published game that opens to an error screen.
  engineImplemented?: boolean;
  /// `content_reviews` rows for this game.
  reviews?: ReadinessReviewRow[];
  /// `asset_links` rows for this game with the linked asset's status.
  productionAssets?: ReadinessProductionAsset[];
  /// Age bounds of the attached learning objective, when it has any.
  objectiveAgeMin?: number | null;
  objectiveAgeMax?: number | null;
}

/// The languages a published game is expected to carry.
///
/// Arabic blocks publication; English and French warn. Majarra is an Arabic
/// product first, and holding a finished Arabic game back because its French
/// translation is pending would stop content shipping for no child's benefit.
export const REQUIRED_LANGUAGE = 'ar';
export const OPTIONAL_LANGUAGES = ['en', 'fr'] as const;

/// The four human reviews a pack can carry, in a fixed order.
///
/// All four are reported on every game, most of them as `not_applicable`. The
/// alternative — emitting only the review that applies — makes the response shape
/// depend on the engine, and a CMS that has to discover which review exists is a
/// CMS that will one day fail to show one.
export const REVIEW_KINDS = [
  'linguistic_review',
  'scientific_review',
  'historical_review',
  'music_rights',
] as const;

export type ReviewKind = typeof REVIEW_KINDS[number];

const REVIEW_LABELS: Record<ReviewKind, string> = {
  linguistic_review: 'المراجعة اللغوية',
  scientific_review: 'المراجعة العلمية',
  historical_review: 'المراجعة التاريخية',
  music_rights: 'حقوق الموسيقى',
};

/// Engines whose primary gesture is a drag, so a tap-only alternative is
/// mandatory rather than nice to have.
///
/// From the acceptance checklists in `docs/games/engines/*.md` — «بديل اللمس-اللمس
/// يعمل بدل السحب». A child with limited motor control, or one using a switch or
/// a television remote, cannot drag; without the alternative the game is not
/// harder for them, it is impossible. Tap-only engines (`memory_flip`,
/// `logic_pattern`, `rhythm_tap`) need no alternative because tapping already *is*
/// the interaction, and demanding the flag from them would train editors to set a
/// meaningless true.
export const DRAG_ENGINES: readonly string[] = [
  'trace_color', 'match_pairs', 'sort_bins', 'sequence_order',
  'word_build', 'count_quantity', 'timeline_map', 'block_code',
];

/// Engines whose levels carry traceable geometry, so `simplified_motor
/// .tolerance_dp` is a real quantity for them.
export const GEOMETRY_ENGINES: readonly string[] = ['trace_color'];

/// The touch-target floor for the youngest audience.
///
/// `docs/games/06-accessibility.md`: «هدف اللمس ≥ 48dp، و≥ 64dp في preschool».
/// A three-year-old's aim is not a smaller version of an adult's, and a target
/// that an adult hits reliably is one a preschooler hits by luck.
export const PRESCHOOL_TOUCH_TARGET_DP = 64;

/// The oldest age still inside the `preschool` track.
export const PRESCHOOL_AGE_MAX = 5;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function packLevels(pack: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return Array.isArray(pack?.levels)
    ? (pack!.levels as unknown[]).filter(isObject)
    : [];
}

function localizationCheck(
  input: ReadinessInput,
  language: string,
  blocking: boolean,
): ReadinessCheck {
  const id = `localization_${language}`;
  const label = `الترجمة (${language})`;
  const row = input.localizations.find((entry) => entry.language === language);

  // A language-specific pack is authored per language rather than translated, so
  // the absence of a second language is correct rather than incomplete.
  const isLanguageSpecific = input.pack?.localization === 'language_specific';
  if (!row) {
    if (isLanguageSpecific && language !== REQUIRED_LANGUAGE) {
      return {
        id, label_ar: label, status: 'not_applicable',
        detail: 'الحزمة language_specific: تُؤلَّف لكل لغة كلعبة مستقلّة ولا تُترجم.',
      };
    }
    return {
      id, label_ar: label, status: blocking ? 'blocked' : 'warn',
      detail: `لا يوجد صفّ ترجمة للغة ${language}.`,
      owner: 'editor',
    };
  }

  if (row.isMachineTranslated && isLanguageSpecific) {
    return {
      id, label_ar: label, status: 'blocked',
      detail: 'حزمة language_specific لا تُنشر مترجمة آليًا.',
      owner: 'editor',
    };
  }

  const gaps: string[] = [];
  if (!row.hasTitle) gaps.push('العنوان');
  if (!row.hasInstructions) gaps.push('التعليمات');
  if (row.missingPromptKeys.length) gaps.push(`${row.missingPromptKeys.length} نصّ توجيه`);

  if (gaps.length) {
    return {
      id, label_ar: label, status: blocking ? 'blocked' : 'warn',
      detail: `ناقص: ${gaps.join(' · ')}.`,
      owner: 'editor',
      items: row.missingPromptKeys,
    };
  }
  return { id, label_ar: label, status: 'pass' };
}

/// True when this pack puts Arabic letter shapes in front of a child.
///
/// Two cases, both from the contracts:
///
///  * `trace_color` levels with `mode: "letter"` — the child traces the glyph
///    itself, so the glyph *is* the content.
///  * `word_build` packs whose levels declare `language: "ar"` — the letter tiles
///    are «بطاقات حروف بخط عربي واضح للأطفال»
///    (`docs/games/engines/07-word-build.md`).
///
/// Rendering a glyph is not the same as rendering UI text: these are drawn large,
/// they are the thing being taught, and they ship inside the product. A licence
/// that does not cover that use is a licence that does not cover the product.
export function rendersArabicGlyphsToChild(
  engineId: string,
  pack: Record<string, unknown> | null,
): boolean {
  const levels = packLevels(pack);
  if (engineId === 'trace_color') {
    return levels.some((level) => level.mode === 'letter');
  }
  if (engineId === 'word_build') {
    // A pack with no declared language is assumed Arabic: this is an Arabic
    // product, `word_build` is `language_specific`, and guessing "not Arabic"
    // here would silently drop the blocker, which is the failure this check
    // exists to prevent.
    return levels.length > 0
      && levels.every((level) => level.language === undefined || level.language === 'ar');
  }
  return false;
}

/// Which of the four reviews this specific pack must have approved.
///
/// Mostly the engine's own `requiredReview`, with two content-driven additions
/// the engine contract cannot express:
///
///  * `trace_color` has no fixed review because a shapes pack needs none — but a
///    letter pack needs an Arabic linguist to approve the stroke order, or the
///    game teaches children to write letters backwards.
///  * Any pack that names a music `track` needs documented rights, whatever the
///    engine. `rhythm_tap` always does; an engine that gains background music
///    later must not slip through because its contract predates it.
export function requiredReviewKinds(
  engineId: string,
  pack: Record<string, unknown> | null,
): ReviewKind[] {
  const kinds = new Set<ReviewKind>();
  const contract = engineContract(engineId);
  if (contract?.requiredReview) kinds.add(contract.requiredReview);

  const levels = packLevels(pack);
  if (engineId === 'trace_color' && levels.some((level) => level.mode === 'letter')) {
    kinds.add('linguistic_review');
  }
  if (levels.some((level) => typeof level.track === 'string' && level.track)) {
    kinds.add('music_rights');
  }
  return REVIEW_KINDS.filter((kind) => kinds.has(kind));
}

/// Why a review does not apply, phrased so an editor can tell "not needed" from
/// "not done". A bare `not_applicable` invites the question this answers.
function reviewNotRequiredDetail(kind: ReviewKind, engineId: string): string {
  switch (kind) {
    case 'linguistic_review':
      return engineId === 'trace_color'
        ? 'لا حروف في الحزمة، فترتيب الرسم لا يحتاج حكمًا لغويًا.'
        : `محرّك "${engineId}" لا يعرض أشكال حروف تحتاج حكمًا لغويًا.`;
    case 'scientific_review':
      return 'لا محتوى علميًا يُدّعى صحّته في هذه الحزمة.';
    case 'historical_review':
      return 'لا وقائع تاريخية تُدّعى صحّتها في هذه الحزمة.';
    case 'music_rights':
      return 'الحزمة لا تستخدم مقطوعة موسيقية.';
  }
}

function reviewCheck(
  kind: ReviewKind,
  input: ReadinessInput,
  required: boolean,
): ReadinessCheck {
  const label = REVIEW_LABELS[kind];
  if (!required) {
    return {
      id: kind, label_ar: label, status: 'not_applicable',
      detail: reviewNotRequiredDetail(kind, input.engineId),
    };
  }

  const reviewBlock = isObject(input.pack?.review) ? input.pack!.review as Record<string, unknown> : {};
  const record = isObject(reviewBlock[kind]) ? reviewBlock[kind] as Record<string, unknown> : undefined;
  const status = typeof record?.status === 'string' ? record.status : 'pending';

  if (status === 'approved') {
    return {
      id: kind, label_ar: label, status: 'pass',
      detail: typeof record?.reviewer === 'string' ? record.reviewer : undefined,
    };
  }

  // Rights are not a review: nobody on the team can approve them, and treating
  // them as reviewer work is how an unlicensed nasheed reaches production while
  // everyone believes a colleague is looking at it.
  const owner: CheckOwner = kind === 'music_rights' ? 'provider' : 'reviewer';
  const who = REVIEW_OWNERS[kind] ?? 'a reviewer';
  const detail = kind === 'linguistic_review' && input.engineId === 'trace_color'
    ? `ترتيب رسم الحروف يحتاج مراجعة عربية معتمدة (الحالة: ${status}).`
    : `تحتاج موافقة ${who} (الحالة: ${status}).`;
  return { id: kind, label_ar: label, status: 'blocked', detail, owner };
}

export function evaluatePublishReadiness(input: ReadinessInput): PublishReadiness {
  const checks: ReadinessCheck[] = [];
  const contract = engineContract(input.engineId);
  const levels = packLevels(input.pack);

  checks.push(input.engineHasRuntimeSchema
    ? { id: 'engine', label_ar: 'المحرّك', status: 'pass', detail: input.engineId }
    : {
        id: 'engine', label_ar: 'المحرّك', status: 'blocked',
        detail: `لا يوجد عقد وقت تشغيل للمحرّك "${input.engineId}" في هذا الإصدار.`,
        owner: 'engineering',
      });

  // Client implementation, separate from the server contract above. Reported as
  // `not_applicable` when the caller did not supply the fact, never as a pass:
  // "we did not look" and "it is implemented" must not share a status.
  if (input.engineImplemented === undefined) {
    checks.push({
      id: 'implementation', label_ar: 'تنفيذ المحرّك في التطبيق', status: 'not_applicable',
      detail: 'لم تُقدَّم حالة تنفيذ المحرّك في التطبيق لهذا التقييم.',
    });
  } else if (input.engineImplemented) {
    checks.push({
      id: 'implementation', label_ar: 'تنفيذ المحرّك في التطبيق', status: 'pass',
      detail: `التطبيق يسجّل وقت تشغيل لمحرّك "${input.engineId}".`,
    });
  } else {
    checks.push({
      id: 'implementation', label_ar: 'تنفيذ المحرّك في التطبيق', status: 'blocked',
      detail: `التطبيق المنشور لا يسجّل محرّك "${input.engineId}"، فاللعبة ستُفتح على شاشة خطأ.`,
      owner: 'engineering',
    });
  }

  // Pack version. A pack from the future cannot be run by the engine that ships
  // today, and the failure is silent: the client reads fields it does not know
  // and renders a level missing whatever the new version added.
  //
  // Absence warns rather than blocks because `pack_validation` already refuses a
  // pack with no `pack_version` structurally — two blockers for one defect make
  // the checklist longer without making it more useful.
  const packVersion = Number(input.pack?.pack_version);
  const supported = input.supportedPackVersion;
  if (!Number.isFinite(packVersion) || packVersion < 1) {
    checks.push({
      id: 'pack_version', label_ar: 'إصدار الحزمة', status: 'warn',
      detail: 'الحزمة لا تُعلن pack_version صحيحًا.',
      owner: 'editor',
    });
  } else if (supported !== undefined && Number.isFinite(supported) && packVersion > supported) {
    checks.push({
      id: 'pack_version', label_ar: 'إصدار الحزمة', status: 'blocked',
      detail: `pack_version ${packVersion} أعلى من إصدار المحرّك المدعوم ${supported}.`,
      owner: 'engineering',
    });
  } else {
    checks.push({
      id: 'pack_version', label_ar: 'إصدار الحزمة', status: 'pass',
      detail: `pack_version ${packVersion}`,
    });
  }

  checks.push(input.packErrors.length === 0
    ? {
        id: 'pack_validation', label_ar: 'تحقّق الحزمة', status: 'pass',
        detail: input.packWarnings.length ? `${input.packWarnings.length} تنبيه` : undefined,
      }
    : {
        id: 'pack_validation', label_ar: 'تحقّق الحزمة', status: 'blocked',
        detail: `${input.packErrors.length} خطأ في الحزمة.`,
        owner: 'editor',
        items: input.packErrors,
      });

  // A wholly unscored pack measures nothing, so demanding a learning objective
  // would force an editor to attach one that can never be assessed. QISAS
  // creative response and free drawing are exactly that: real content with no
  // mark, and pretending otherwise is how a "creative reflection" ends up
  // producing a mastery level.
  const whollyUnscored = levels.length > 0 && levels.every((level) => level?.scoring === 'none');

  // The engine-level version of the same truth. `rhythm_tap` and `memory_flip`
  // write attempts and never mastery (`docs/games/05-mastery-and-measurement.md`),
  // and the mechanism is that their packs carry no objective. So an objective on
  // one of them is not an omission to be filled in — it is a blocker, and the
  // opposite of what the old rule demanded.
  const writesMastery = contract ? contract.writesMastery : true;

  if (!writesMastery) {
    checks.push(input.objectiveId
      ? {
          id: 'objective', label_ar: 'الهدف التعليمي', status: 'blocked',
          detail: `محرّك "${input.engineId}" لا يكتب إتقانًا، فلا يجوز ربطه بهدف تعليمي `
            + `(مرتبط حاليًا بـ "${input.objectiveCode ?? input.objectiveId}").`,
          owner: 'editor',
        }
      : {
          id: 'objective', label_ar: 'الهدف التعليمي', status: 'not_applicable',
          detail: `محرّك "${input.engineId}" ترفيهي أولًا: يكتب محاولات ولا يكتب إتقانًا.`,
        });
  } else if (input.objectiveId) {
    checks.push({ id: 'objective', label_ar: 'الهدف التعليمي', status: 'pass', detail: input.objectiveCode ?? undefined });
  } else if (whollyUnscored) {
    checks.push({
      id: 'objective', label_ar: 'الهدف التعليمي', status: 'not_applicable',
      detail: 'حزمة بلا تقييم: لا يُقاس فيها شيء، فلا هدف يُربَط بها.',
    });
  } else {
    checks.push({
      id: 'objective', label_ar: 'الهدف التعليمي', status: 'blocked',
      detail: 'لا هدف تعليمي مرتبط، فلا يمكن قياس الإتقان.',
      owner: 'editor',
    });
  }

  // Skills are a warning, not a blocker: an objective with no skill is legible to
  // a parent report through its own title, and 60 of the seeded objectives are in
  // that state already.
  checks.push(input.primarySkillId
    ? {
        id: 'skills', label_ar: 'المهارات', status: 'pass',
        detail: [input.primarySkillId, ...input.secondarySkillIds].join(' · '),
      }
    : whollyUnscored || !writesMastery
      ? {
          id: 'skills', label_ar: 'المهارات', status: 'not_applicable',
          detail: writesMastery ? undefined : 'لا إتقان يُقاس، فلا مهارة تُربَط.',
        }
      : {
          id: 'skills', label_ar: 'المهارات', status: 'warn',
          detail: 'الهدف بلا مهارة أساسية.',
          owner: 'editor',
        });

  // Age range. The bounds themselves are enforced by the pack validator and a D1
  // CHECK, so the blocking case here is the one neither of them can see: a game
  // offered to an age its own objective was never written for. A five-year-old
  // shown a junior objective's game is not stretched, they are set up to fail.
  const ageBoundsValid = Number.isInteger(input.ageMin) && Number.isInteger(input.ageMax)
    && input.ageMin <= input.ageMax && input.ageMin >= 3 && input.ageMax <= 12;
  if (!ageBoundsValid) {
    checks.push({
      id: 'age_range', label_ar: 'الفئة العمرية', status: 'blocked',
      detail: `المدى ${input.ageMin}–${input.ageMax} غير صالح؛ يجب أن يكون بين 3 و12 وألا يتجاوز الأدنى الأعلى.`,
      owner: 'editor',
    });
  } else {
    const objectiveMin = input.objectiveAgeMin ?? null;
    const objectiveMax = input.objectiveAgeMax ?? null;
    const overlaps = objectiveMin === null || objectiveMax === null
      || (input.ageMin <= objectiveMax && input.ageMax >= objectiveMin);
    checks.push(overlaps
      ? {
          id: 'age_range', label_ar: 'الفئة العمرية', status: 'pass',
          detail: `${input.ageMin}–${input.ageMax} سنة`,
        }
      : {
          id: 'age_range', label_ar: 'الفئة العمرية', status: 'warn',
          detail: `مدى اللعبة ${input.ageMin}–${input.ageMax} لا يتقاطع مع مدى الهدف `
            + `${objectiveMin}–${objectiveMax}.`,
          owner: 'editor',
        });
  }

  checks.push(localizationCheck(input, REQUIRED_LANGUAGE, true));
  for (const language of OPTIONAL_LANGUAGES) {
    checks.push(localizationCheck(input, language, false));
  }

  const artMissing = [...input.assets.missing, ...input.assets.notReady]
    .filter((id) => !input.audio.required.includes(id));
  checks.push(artMissing.length === 0
    ? { id: 'assets', label_ar: 'الأصول الفنية', status: 'pass' }
    : {
        id: 'assets', label_ar: 'الأصول الفنية', status: 'blocked',
        detail: `${artMissing.length} أصل غير جاهز.`,
        owner: 'production',
        items: artMissing,
      });

  const audioMissing = [...input.audio.missing, ...input.audio.notReady];
  checks.push(audioMissing.length === 0
    ? {
        id: 'audio', label_ar: 'الصوت', status: input.audio.required.length ? 'pass' : 'not_applicable',
        detail: input.audio.required.length ? undefined : 'الحزمة لا تطلب صوتًا.',
      }
    : {
        id: 'audio', label_ar: 'الصوت', status: 'blocked',
        detail: `${audioMissing.length} تسجيل صوتي غير جاهز.`,
        owner: 'production',
        items: audioMissing,
      });

  // Production assets: the cover and catalogue artwork, which live in
  // `asset_links` rather than in the pack. Warn rather than block — a blank tile
  // is bad and must be visible, but it is not a reason to withhold a finished
  // game from a child who would otherwise be playing it.
  if (input.productionAssets === undefined) {
    checks.push({
      id: 'production_assets', label_ar: 'أصول الإنتاج', status: 'not_applicable',
      detail: 'لم تُقدَّم روابط أصول اللعبة لهذا التقييم.',
    });
  } else {
    const unresolved = input.productionAssets.filter((asset) => asset.status !== 'ready');
    checks.push(unresolved.length === 0
      ? {
          id: 'production_assets', label_ar: 'أصول الإنتاج', status: input.productionAssets.length ? 'pass' : 'warn',
          detail: input.productionAssets.length
            ? `${input.productionAssets.length} أصل جاهز.`
            : 'لا غلاف ولا صورة كتالوج مرتبطة باللعبة.',
          owner: input.productionAssets.length ? undefined : 'production',
        }
      : {
          id: 'production_assets', label_ar: 'أصول الإنتاج', status: 'warn',
          detail: `${unresolved.length} أصل إنتاج غير جاهز.`,
          owner: 'production',
          items: unresolved.map((asset) => `${asset.role}: ${asset.assetId ?? 'غير مرتبط'} (${asset.status ?? 'مفقود'})`),
        });
  }

  const requiredReviews = requiredReviewKinds(input.engineId, input.pack);
  for (const kind of REVIEW_KINDS) {
    checks.push(reviewCheck(kind, input, requiredReviews.includes(kind)));
  }

  // The Arabic font licence.
  //
  // ## Why it is a check of its own and not a line in a rights document
  //
  // It is an **external** dependency with a long lead time and no internal
  // workaround, and it is invisible in every artefact an editor looks at: the
  // pack validates, the glyphs render on the developer's machine with whatever
  // font the OS provides, and nothing fails until a lawyer asks which licence
  // covers redistributing a typeface inside a paid children's app.
  //
  // `docs/games/engines/07-word-build.md` states it twice — «ترخيص الخط متحقق
  // منه» and, in the acceptance checklist, «ترخيص الخط العربي موثق» — and the
  // content manifest lists `arabic_font_license` in `production_required`
  // alongside the art and the voice-over. It is tracked here because a
  // requirement that lives only in prose is a requirement that gets remembered
  // once and forgotten afterwards.
  //
  // Evidence is a `content_reviews` row with `reviewer_role = 'rights'`, which is
  // the one place in D1 that records an external clearance. Owner is `provider`:
  // the foundry issues the licence, and no amount of internal effort substitutes
  // for it. It is never bypassed — an unavailable review row is `blocked`, not
  // `warn`, because the whole point is that it cannot be forgotten.
  if (!rendersArabicGlyphsToChild(input.engineId, input.pack)) {
    checks.push({
      id: 'arabic_font_license', label_ar: 'ترخيص الخطّ العربي', status: 'not_applicable',
      detail: 'الحزمة لا تعرض أشكال حروف عربية للطفل، فلا خطّ يُرخَّص.',
    });
  } else {
    const rights = (input.reviews ?? []).filter((row) => row.role === 'rights');
    const approved = rights.find((row) => row.status === 'approved');
    if (approved) {
      checks.push({
        id: 'arabic_font_license', label_ar: 'ترخيص الخطّ العربي', status: 'pass',
        detail: approved.reviewer
          ? `ترخيص موثّق (${approved.reviewer}).`
          : 'ترخيص موثّق في سجلّ الحقوق.',
      });
    } else {
      const state = rights.length ? rights.map((row) => row.status).join(' · ') : 'لا سجلّ';
      checks.push({
        id: 'arabic_font_license', label_ar: 'ترخيص الخطّ العربي', status: 'blocked',
        detail: `الحزمة تعرض حروفًا عربية للطفل وتحتاج ترخيص خطّ تجاريًا موثّقًا (الحالة: ${state}). `
          + 'يُقيَّد كسجلّ حقوق reviewer_role = rights.',
        owner: 'provider',
      });
    }
  }

  // Accessibility, engine-aware.
  //
  // The schema validates the *shape* of the accessibility block; this reports
  // whether the declarations an engine actually needs are present. Which ones
  // those are depends on the engine: a drawing tolerance is meaningless for
  // `logic_pattern`, and a drag alternative is meaningless for `memory_flip`.
  const accessibility = isObject(input.pack?.accessibility)
    ? input.pack!.accessibility as Record<string, unknown>
    : undefined;
  const simplified = isObject(accessibility?.simplified_motor)
    ? accessibility!.simplified_motor as Record<string, unknown>
    : undefined;
  const needsGeometryTolerance = GEOMETRY_ENGINES.includes(input.engineId);
  const needsTapAlternative = DRAG_ENGINES.includes(input.engineId);

  const accessibilityGaps: string[] = [];
  if (needsGeometryTolerance && !simplified?.tolerance_dp) {
    accessibilityGaps.push('الوضع الحركي المبسّط (simplified_motor.tolerance_dp)');
  }
  if (needsTapAlternative && accessibility?.sequential_tap_alternative !== true) {
    accessibilityGaps.push('بديل اللمس المتتابع (sequential_tap_alternative)');
  }
  if (accessibilityGaps.length) {
    checks.push({
      id: 'accessibility', label_ar: 'إمكانية الوصول', status: 'blocked',
      detail: `غير مُعلَن: ${accessibilityGaps.join(' · ')}.`,
      owner: 'editor',
      items: accessibilityGaps,
    });
  } else {
    const declared: string[] = [];
    if (simplified?.tolerance_dp) declared.push(`وضع مبسّط ${simplified.tolerance_dp}dp`);
    if (accessibility?.sequential_tap_alternative === true) declared.push('بديل اللمس المتتابع');
    if (accessibility?.reduced_motion_supported === true) declared.push('حركة مخفّفة');
    checks.push({
      id: 'accessibility', label_ar: 'إمكانية الوصول', status: 'pass',
      detail: declared.length ? declared.join(' · ') : undefined,
    });
  }

  // Touch targets, against the engine's own floor.
  //
  // Reported separately from `accessibility` because it is a number with an
  // engine-specific minimum rather than a declaration that exists or does not.
  // `rhythm_tap` asks for 72dp because the target moves; `preschool` raises every
  // engine's floor to 64dp. A pack declaring less than its engine's floor is a
  // pack whose targets a child will miss, and it must not publish on the grounds
  // that the field was filled in.
  const contractFloor = contract?.minTouchTargetDp ?? 48;
  const floor = input.ageMax <= PRESCHOOL_AGE_MAX
    ? Math.max(contractFloor, PRESCHOOL_TOUCH_TARGET_DP)
    : contractFloor;
  const declaredTarget = Number(accessibility?.min_touch_target_dp);
  if (!Number.isFinite(declaredTarget)) {
    // Warn, not block: the client applies its own floor, so an undeclared value
    // is a documentation gap rather than a small target. A declared value below
    // the floor is the opposite — an explicit instruction to shrink it.
    checks.push({
      id: 'touch_targets', label_ar: 'هدف اللمس', status: 'warn',
      detail: `الحزمة لا تُعلن min_touch_target_dp؛ الحدّ المطلوب لهذا المحرّك ${floor}dp.`,
      owner: 'editor',
    });
  } else if (declaredTarget < floor) {
    checks.push({
      id: 'touch_targets', label_ar: 'هدف اللمس', status: 'blocked',
      detail: `min_touch_target_dp المُعلَن ${declaredTarget}dp أقل من ${floor}dp المطلوبة لـ`
        + `"${input.engineId}"`
        + (input.ageMax <= PRESCHOOL_AGE_MAX ? ' في الفئة preschool' : '')
        + '.',
      owner: 'engineering',
    });
  } else {
    checks.push({
      id: 'touch_targets', label_ar: 'هدف اللمس', status: 'pass',
      detail: `${declaredTarget}dp ≥ ${floor}dp`,
    });
  }

  if (input.supervisionLevel === 'required') {
    checks.push(input.safetyNotes?.trim()
      ? { id: 'safety', label_ar: 'ملاحظات السلامة', status: 'pass' }
      : {
          id: 'safety', label_ar: 'ملاحظات السلامة', status: 'blocked',
          detail: 'الإشراف "required" يستلزم ملاحظات سلامة غير فارغة.',
          owner: 'editor',
        });
  } else {
    // A `sim_lab` level may demand supervision even when the game row does not,
    // and the level is the thing a child performs. Surfacing it as a warning
    // keeps the row-level and level-level statements from disagreeing silently.
    const levelDemandsSupervision = levels.some((level) => level.supervision_level === 'required');
    checks.push(levelDemandsSupervision
      ? {
          id: 'safety', label_ar: 'ملاحظات السلامة', status: 'warn',
          detail: 'مستوى في الحزمة يطلب إشرافًا بينما اللعبة تُعلن ' + `"${input.supervisionLevel}"`,
          owner: 'editor',
        }
      : { id: 'safety', label_ar: 'ملاحظات السلامة', status: 'not_applicable' });
  }

  // QA sign-off.
  //
  // A rejection blocks: someone tested this and said no. A pending or absent
  // review warns, because the publish gate itself lives in the workflow
  // (`workflow_step_reviews` plus `lib/separationOfDuties.ts`) and duplicating it
  // as a blocker here would mark every game in the catalogue unpublishable from
  // this endpoint's point of view — which trains people to ignore the endpoint.
  if (input.reviews === undefined) {
    checks.push({
      id: 'qa', label_ar: 'ضمان الجودة', status: 'not_applicable',
      detail: 'لم تُقدَّم سجلات المراجعة لهذا التقييم.',
    });
  } else {
    const qa = input.reviews.filter((row) => row.role === 'qa');
    const refused = qa.find((row) => row.status === 'rejected' || row.status === 'needs_changes');
    const approved = qa.find((row) => row.status === 'approved');
    if (refused) {
      checks.push({
        id: 'qa', label_ar: 'ضمان الجودة', status: 'blocked',
        detail: `ضمان الجودة أعاد اللعبة (الحالة: ${refused.status}).`,
        owner: 'reviewer',
      });
    } else if (approved) {
      checks.push({
        id: 'qa', label_ar: 'ضمان الجودة', status: 'pass',
        detail: approved.reviewer ?? undefined,
      });
    } else {
      checks.push({
        id: 'qa', label_ar: 'ضمان الجودة', status: 'warn',
        detail: qa.length ? `فحص ضمان الجودة معلّق (${qa.length} سجل).` : 'لا سجلّ فحص لضمان الجودة.',
        owner: 'reviewer',
      });
    }
  }

  if (input.isTestFixture) {
    checks.push({
      id: 'content_class', label_ar: 'تصنيف المحتوى', status: 'blocked',
      detail: 'محتوى تجريبي (test_fixture) لا يُنشر في الإنتاج.',
      owner: 'editor',
    });
  }

  const blocking = checks.filter((check) => check.status === 'blocked');
  return {
    checks,
    publishable: blocking.length === 0,
    // Every reason names its own check and carries its own detail. There is
    // deliberately no fallback sentence such as "cannot publish": a generic
    // string is what the first version of this endpoint returned, and it told an
    // editor nothing they could act on.
    blocking_reasons: blocking.map((check) => `${check.label_ar}: ${check.detail ?? 'غير مكتمل'}`),
  };
}
