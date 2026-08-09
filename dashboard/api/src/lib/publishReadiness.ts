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
/// Pure: no database access, so every rule is unit testable. `routes/adminGames`
/// gathers the rows and calls [evaluatePublishReadiness].

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
}

/// The languages a published game is expected to carry.
///
/// Arabic blocks publication; English and French warn. Majarra is an Arabic
/// product first, and holding a finished Arabic game back because its French
/// translation is pending would stop content shipping for no child's benefit.
export const REQUIRED_LANGUAGE = 'ar';
export const OPTIONAL_LANGUAGES = ['en', 'fr'] as const;

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

export function evaluatePublishReadiness(input: ReadinessInput): PublishReadiness {
  const checks: ReadinessCheck[] = [];

  checks.push(input.engineHasRuntimeSchema
    ? { id: 'engine', label_ar: 'المحرّك', status: 'pass', detail: input.engineId }
    : {
        id: 'engine', label_ar: 'المحرّك', status: 'blocked',
        detail: `لا يوجد عقد وقت تشغيل للمحرّك "${input.engineId}" في هذا الإصدار.`,
        owner: 'engineering',
      });

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
  const levelsForScoring = Array.isArray(input.pack?.levels)
    ? input.pack!.levels as Array<Record<string, unknown>>
    : [];
  const whollyUnscored = levelsForScoring.length > 0 &&
    levelsForScoring.every((level) => level?.scoring === 'none');

  if (input.objectiveId) {
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
    : whollyUnscored
      ? { id: 'skills', label_ar: 'المهارات', status: 'not_applicable' }
      : {
          id: 'skills', label_ar: 'المهارات', status: 'warn',
          detail: 'الهدف بلا مهارة أساسية.',
          owner: 'editor',
        });

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

  // Linguistic review. Only letter packs need it, and only a person can grant it.
  const levels = Array.isArray(input.pack?.levels) ? input.pack!.levels as Array<Record<string, unknown>> : [];
  const hasLetterLevel = levels.some((level) => level?.mode === 'letter');
  const review = (input.pack?.review as Record<string, unknown> | undefined)?.linguistic_review as
    Record<string, unknown> | undefined;
  const reviewStatus = typeof review?.status === 'string' ? review.status : 'pending';
  if (!hasLetterLevel) {
    checks.push({
      id: 'linguistic_review', label_ar: 'المراجعة اللغوية', status: 'not_applicable',
      detail: 'لا حروف في الحزمة، فترتيب الرسم لا يحتاج حكمًا لغويًا.',
    });
  } else if (reviewStatus === 'approved') {
    checks.push({
      id: 'linguistic_review', label_ar: 'المراجعة اللغوية', status: 'pass',
      detail: typeof review?.reviewer === 'string' ? review.reviewer : undefined,
    });
  } else {
    checks.push({
      id: 'linguistic_review', label_ar: 'المراجعة اللغوية', status: 'blocked',
      detail: `ترتيب رسم الحروف يحتاج مراجعة عربية معتمدة (الحالة: ${reviewStatus}).`,
      owner: 'reviewer',
    });
  }

  // Accessibility is structural and validated by the schema, so this check reports
  // it rather than re-deriving it.
  const accessibility = input.pack?.accessibility as Record<string, unknown> | undefined;
  const simplified = accessibility?.simplified_motor as Record<string, unknown> | undefined;
  const accessibilityOk = Boolean(simplified?.tolerance_dp) &&
    accessibility?.sequential_tap_alternative === true;
  checks.push(accessibilityOk
    ? {
        id: 'accessibility', label_ar: 'إمكانية الوصول', status: 'pass',
        detail: `وضع مبسّط ${simplified?.tolerance_dp}dp · بديل اللمس المتتابع`,
      }
    : {
        id: 'accessibility', label_ar: 'إمكانية الوصول', status: 'blocked',
        detail: 'الوضع الحركي المبسّط أو بديل اللمس المتتابع غير مُعلَن.',
        owner: 'editor',
      });

  if (input.supervisionLevel === 'required') {
    checks.push(input.safetyNotes?.trim()
      ? { id: 'safety', label_ar: 'ملاحظات السلامة', status: 'pass' }
      : {
          id: 'safety', label_ar: 'ملاحظات السلامة', status: 'blocked',
          detail: 'الإشراف "required" يستلزم ملاحظات سلامة غير فارغة.',
          owner: 'editor',
        });
  } else {
    checks.push({ id: 'safety', label_ar: 'ملاحظات السلامة', status: 'not_applicable' });
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
    blocking_reasons: blocking.map((check) => `${check.label_ar}: ${check.detail ?? 'غير مكتمل'}`),
  };
}
