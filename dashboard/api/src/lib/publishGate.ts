/// Publish readiness for catalogue content: series, episodes, stories, books,
/// projects and games.
///
/// ## What this replaces
///
/// Two separate half-gates existed before this file.
///
/// The first was *publish authority separation*: `POST /admin/series/:id/publish`
/// and its episode twin refuse `status = published` on create and patch, so only
/// a holder of the `publish` permission can publish. That answers **who** may
/// publish and says nothing about **whether the content is finished**. An episode
/// with no video file, no thumbnail and a rejected language review published
/// exactly as cleanly as a finished one.
///
/// The second was `lib/catalogueValidation.ts`, whose `storyPublishError`,
/// `bookPublishError`, `gamePublishError` and `projectPublishError` do check real
/// completeness — but each returns *one string*, so an editor learns about one
/// blocker per attempt. A story with four missing illustrations, two untranslated
/// pages and no narration takes seven publish attempts to understand. Those
/// helpers stay where they are: they guard every write, including the status
/// transitions a scheduler performs, and this gate is deliberately at least as
/// strict as they are at publish time.
///
/// ## The rule this file exists to enforce
///
/// Every blocker at once, each one naming what is missing, who resolves it and
/// what action clears it. No response ever says only "cannot publish": a generic
/// refusal is indistinguishable from a bug, and it teaches editors to route
/// around the gate rather than use it.
///
/// ## Blocker versus warning
///
/// A **blocker** describes content a child would experience as broken: an episode
/// that cannot play, a story page with no picture, an expired licence, content
/// that a religious reviewer has not approved. A **warning** describes content
/// that is poorer than intended but coherent: a missing French translation, an
/// absent duration, no learning objective attached.
///
/// The split is not stylistic. Arabic is the product's first language and English
/// and French are secondary, so holding a finished Arabic episode back because its
/// French dub is pending would stop the catalogue shipping for no child's benefit.
/// Conversely nothing here downgrades a safety or rights requirement to a warning,
/// because those are the two categories where the cost of being wrong is not
/// borne by us.
///
/// ## Purity
///
/// No D1, no R2, no request context, no clock. The caller gathers rows and passes
/// `today` in, so every rule is unit testable and an expiry test cannot become
/// flaky at midnight. `routes/adminPublishGate.ts` does the gathering.

import { isIslamicContent } from './islamicContent.ts';
import {
  bookLanguagesError,
  parseJson,
  text,
} from './catalogueValidation.ts';
import type { PublishReadiness } from './publishReadiness.ts';

export const PUBLISHABLE_TYPES = ['series', 'episode', 'story', 'book', 'game', 'project'] as const;
export type PublishableType = (typeof PUBLISHABLE_TYPES)[number];

export function isPublishableType(value: unknown): value is PublishableType {
  return typeof value === 'string' && (PUBLISHABLE_TYPES as readonly string[]).includes(value);
}

/// Who clears a finding.
///
/// `rights` and `legal` are separate from `reviewer` for the same reason
/// `provider` exists in the game readiness: nobody inside the content team can
/// clear an expired licence by working harder, and an owner of `reviewer` would
/// imply a colleague is already looking at it.
export type GateOwner =
  | 'editor'
  | 'reviewer'
  | 'translator'
  | 'production'
  | 'engineering'
  | 'rights'
  | 'legal'
  | 'publisher'
  | 'provider';

export type GateStatus = 'pass' | 'blocked' | 'warn' | 'not_applicable';
export type GateSeverity = 'blocker' | 'warning' | 'none';

export interface GateFinding {
  id: string;
  label_ar: string;
  status: GateStatus;
  severity: GateSeverity;
  /// Precise reason, safe to show an editor. Never a generic failure.
  detail: string;
  owner?: GateOwner;
  /// The action that clears it, phrased as an instruction.
  required_action?: string;
  /// The specific offenders, for example the page numbers with no illustration.
  items?: string[];
}

export interface PublishGateResult {
  entity_type: PublishableType;
  entity_id: string;
  publishable: boolean;
  findings: GateFinding[];
  blockers: GateFinding[];
  warnings: GateFinding[];
}

// --- Gathered facts ---------------------------------------------------------

export interface ReviewFact {
  /// content_reviews.reviewer_role: edu | lang | sharia | rights | qa
  role: string;
  /// content_reviews.status: pending | approved | rejected | needs_changes
  status: string;
  reviewer_id?: string | null;
}

export interface RightsFact {
  owner: string;
  territories: string[];
  licenses: string[];
  /// content_rights.expiry, an ISO date or null for open-ended.
  expiry: string | null;
  /// Set when the row belongs to an ancestor rather than to this entity.
  inherited_from?: { type: PublishableType; id: string } | null;
}

export interface LinkedAssetFact {
  /// asset_links.role, for example cover, poster, thumbnail, video.
  role: string;
  asset_id: string;
  /// content_assets.status, or null when the linked row is missing.
  status: string | null;
  language: string;
}

interface CommonFacts {
  entity_id: string;
  /// The row's current status column.
  status: string;
  /// series.content_class = 'test_fixture', resolved through the parent where the
  /// entity has no column of its own.
  is_test_fixture: boolean;
  reviews: ReviewFact[];
  /// False for stories: `content_reviews.entity_type` has a CHECK constraint of
  /// ('series','episode','book','game','project'), so a story review row cannot
  /// exist. Reporting "review missing" for a story would be blaming an editor for
  /// a schema limitation.
  reviews_supported: boolean;
  rights: RightsFact[];
  /// Same reasoning as reviews: `content_rights.entity_type` omits 'story'.
  rights_supported: boolean;
  assets: LinkedAssetFact[];
  /// ISO date (YYYY-MM-DD). Injected so expiry rules are testable.
  today: string;
}

export interface SeriesFacts extends CommonFacts {
  entity_type: 'series';
  planet_id: string | null;
  source_type: string | null;
  religious_reviewer_id: string | null;
  religious_approved_at: string | null;
  cover_url: string | null;
  visual_style_id: string | null;
  description_ar: string | null;
  episode_count: number;
  published_episode_count: number;
}

export interface EpisodeFacts extends CommonFacts {
  entity_type: 'episode';
  series_id: string;
  series_status: string;
  planet_id: string | null;
  source_type: string | null;
  religious_approved_at: string | null;
  video_master_url: string | null;
  video_hls_1080: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  captions_ar_url: string | null;
  /// episodes.dubs, the languages the episode is voiced in.
  dubs: string[];
  learning_objective_id: string | null;
}

export interface StoryPageFacts {
  page_number: number | null;
  image_asset_id: string | null;
  /// content_assets.status of the illustration, null when unlinked or missing.
  image_status: string | null;
  localizations: Array<{
    language: string;
    body_text: string | null;
    narration_asset_id: string | null;
    narration_status: string | null;
  }>;
}

export interface StoryFacts extends CommonFacts {
  entity_type: 'story';
  story_type: string;
  default_language: string;
  declared_languages: string[];
  visual_style_id: string | null;
  pages: StoryPageFacts[];
  /// Rights and reviews are inherited from the parent series when there is one.
  series_id: string | null;
  series_status: string | null;
}

export interface BookFacts extends CommonFacts {
  entity_type: 'book';
  pages: unknown;
  languages: unknown;
  default_language: unknown;
}

export interface ProjectFacts extends CommonFacts {
  entity_type: 'project';
  materials: unknown;
  steps: unknown;
  supervision_level: string;
  safety_notes: string | null;
  cover_url: string | null;
}

export interface GameFacts extends CommonFacts {
  entity_type: 'game';
  /// The engine-level readiness from `lib/publishReadiness.ts`, evaluated by the
  /// caller. Not recomputed here: that file already derives every rule from each
  /// engine's own contract, and a second implementation would drift from it.
  readiness: PublishReadiness;
}

export type PublishGateFacts =
  | SeriesFacts | EpisodeFacts | StoryFacts | BookFacts | ProjectFacts | GameFacts;

// --- Finding builders ------------------------------------------------------

const pass = (id: string, label: string, detail = ''): GateFinding =>
  ({ id, label_ar: label, status: 'pass', severity: 'none', detail });

const skip = (id: string, label: string, detail: string): GateFinding =>
  ({ id, label_ar: label, status: 'not_applicable', severity: 'none', detail });

const block = (
  id: string, label: string, detail: string, owner: GateOwner, action: string, items?: string[],
): GateFinding => ({ id, label_ar: label, status: 'blocked', severity: 'blocker', detail, owner, required_action: action, items });

const warn = (
  id: string, label: string, detail: string, owner: GateOwner, action: string, items?: string[],
): GateFinding => ({ id, label_ar: label, status: 'warn', severity: 'warning', detail, owner, required_action: action, items });

/// A ready asset attached in one of the accepted roles.
function readyAsset(assets: LinkedAssetFact[], roles: string[]): LinkedAssetFact | undefined {
  return assets.find((asset) => roles.includes(asset.role) && asset.status === 'ready');
}

function pendingAsset(assets: LinkedAssetFact[], roles: string[]): LinkedAssetFact | undefined {
  return assets.find((asset) => roles.includes(asset.role));
}

// --- Shared checks ---------------------------------------------------------

/// Test fixtures.
///
/// The Mazen & Thaaloub series and its videos are external material kept so
/// upload, R2, streaming and playback can be exercised end to end
/// (`lib/contentClass.ts`). They are useful and must not be deleted, and they must
/// never be published: `contentClassPredicate` already keeps them out of the
/// public catalogue, and this makes the same statement at the publish boundary so
/// nobody can mark one published and then wonder why it is invisible.
function testFixtureCheck(facts: CommonFacts): GateFinding {
  return facts.is_test_fixture
    ? block('content_class', 'تصنيف المحتوى',
        'هذا محتوى تجريبي (test_fixture) موجود لاختبار المنصة، ولا يُنشر في كتالوج مجرّة.',
        'editor',
        'إن كان محتوى إنتاجيًا فعليًا فغيّر content_class للسلسلة إلى production، وإلا فاتركه غير منشور.')
    : pass('content_class', 'تصنيف المحتوى', 'محتوى إنتاجي.');
}

function archivedCheck(facts: CommonFacts): GateFinding {
  return facts.status === 'archived'
    ? block('archived', 'الحالة', 'العنصر مؤرشف، والمؤرشف لا يُنشر.', 'editor',
        'أعِد العنصر من الأرشيف إلى مسودة/جاهز قبل النشر.')
    : pass('archived', 'الحالة', `الحالة الحالية: ${facts.status}.`);
}

/// Human reviews.
///
/// A refusal blocks: somebody looked at this and said no, and publishing over that
/// is not a gap in a checklist, it is overruling a reviewer silently. A missing or
/// pending review warns, because `content_reviews` is filled in unevenly across
/// the existing catalogue and turning absence into a blocker would mark the whole
/// library unpublishable overnight — which trains people to bypass the gate rather
/// than to fill it in. The one exception is the religious review, handled below.
function reviewChecks(facts: CommonFacts, roles: Array<{ role: string; label: string }>): GateFinding[] {
  if (!facts.reviews_supported) {
    return [skip('reviews', 'المراجعات',
      'جدول content_reviews لا يقبل هذا النوع (CHECK يقتصر على series/episode/book/game/project)، '
      + 'فلا سجلّ مراجعة ممكن له — وهذا قيد مخطوطة لا تقصير من المحرّر.')];
  }
  return roles.map(({ role, label }) => {
    const rows = facts.reviews.filter((review) => review.role === role);
    const refused = rows.find((review) => review.status === 'rejected' || review.status === 'needs_changes');
    if (refused) {
      return block(`review_${role}`, label,
        `المراجعة أعادت العنصر (الحالة: ${refused.status}).`, 'reviewer',
        'عالِج ملاحظات المراجع ثم اطلب مراجعة جديدة.');
    }
    const approved = rows.find((review) => review.status === 'approved');
    if (approved) return pass(`review_${role}`, label, 'معتمدة.');
    return warn(`review_${role}`, label,
      rows.length ? `المراجعة معلّقة (${rows.length} سجل).` : 'لا سجلّ مراجعة لهذا الدور.',
      'reviewer', 'اطلب المراجعة وسجّل قرارها قبل النشر إن كانت السياسة تتطلبها.');
  });
}

/// Rights.
///
/// An expired licence blocks unconditionally. This is the one check where the
/// content is finished, everyone is happy with it, and publishing is still
/// unlawful — so it is exactly the check that must not be a warning. A missing
/// rights record warns: most seeded catalogue rows have none, and the honest
/// statement is "we do not know", not "we know it is forbidden".
function rightsChecks(facts: CommonFacts): GateFinding[] {
  if (!facts.rights_supported) {
    return [skip('rights', 'الحقوق',
      'جدول content_rights لا يقبل هذا النوع؛ تُورَث الحقوق من السلسلة الأمّ إن وُجدت.')];
  }
  if (!facts.rights.length) {
    return [warn('rights', 'الحقوق', 'لا سجلّ حقوق لهذا العنصر ولا لأصله.', 'rights',
      'سجّل المالك والأقاليم والتراخيص وتاريخ الانتهاء في مركز الحقوق.')];
  }
  const findings: GateFinding[] = [];
  const expired = facts.rights.filter((right) => right.expiry !== null && right.expiry < facts.today);
  if (expired.length) {
    findings.push(block('rights_expiry', 'انتهاء الحقوق',
      `${expired.length} ترخيص منتهٍ قبل اليوم (${facts.today}).`, 'rights',
      'جدّد الترخيص أو أزل العنصر من خطة النشر — لا يجوز النشر بترخيص منتهٍ.',
      expired.map((right) => `${right.owner}: انتهى ${right.expiry}`
        + (right.inherited_from ? ` (موروث من ${right.inherited_from.type})` : ''))));
  } else {
    findings.push(pass('rights_expiry', 'انتهاء الحقوق',
      facts.rights.every((right) => right.expiry === null)
        ? 'تراخيص مفتوحة المدة.'
        : 'كل التراخيص سارية.'));
  }
  const noTerritory = facts.rights.filter((right) => right.territories.length === 0);
  if (noTerritory.length === facts.rights.length) {
    findings.push(warn('rights_territories', 'أقاليم الحقوق',
      'لا أقاليم مسجّلة في أي ترخيص، فسياسة الإتاحة الجغرافية لا تستند إلى شيء.', 'rights',
      'حدّد الأقاليم المسموح بها لكل ترخيص، أو أعلن التوفر عالميًا صراحةً.'));
  }
  return findings;
}

/// The religious review, for Islamic content only.
///
/// Blocking, not warning. `lib/islamicContent.ts` documents why this is treated as
/// a hard gate: the predicate used to compare `planet_id === 'iman'` while the
/// seeded planet is `islamic`, so *every* real Islamic series skipped the approval
/// gate entirely and could be published with no reviewer and no approval date.
/// Downgrading it to a warning would restore that outcome by another route.
function religiousChecks(
  planetId: string | null,
  sourceType: string | null,
  reviewerId: string | null,
  approvedAt: string | null,
  reviews: ReviewFact[],
): GateFinding[] {
  if (!isIslamicContent(planetId, sourceType)) {
    return [skip('religious_review', 'المراجعة الشرعية',
      'المحتوى ليس دينيًا (لا كوكب إسلامي ولا مصدر قرآن/حديث/سيرة).')];
  }
  const findings: GateFinding[] = [];
  if (!sourceType) {
    findings.push(block('religious_source', 'مصدر المحتوى الديني',
      'المحتوى ديني بلا source_type (quran/hadith/sira/adab).', 'editor',
      'حدّد نوع المصدر ومرجعه الدقيق قبل طلب المراجعة الشرعية.'));
  } else {
    findings.push(pass('religious_source', 'مصدر المحتوى الديني', sourceType));
  }
  if (!approvedAt) {
    findings.push(block('religious_review', 'المراجعة الشرعية',
      reviewerId
        ? `مراجع شرعي مُسنَد (${reviewerId}) بلا تاريخ موافقة.`
        : 'لا مراجع شرعي ولا تاريخ موافقة.',
      'reviewer',
      'لا يُنشر محتوى ديني قبل تسجيل المراجع الشرعي وتاريخ موافقته.'));
  } else {
    findings.push(pass('religious_review', 'المراجعة الشرعية', `موافقة بتاريخ ${approvedAt}.`));
  }
  const sharia = reviews.filter((review) => review.role === 'sharia');
  const refused = sharia.find((review) => review.status === 'rejected' || review.status === 'needs_changes');
  if (refused) {
    findings.push(block('review_sharia', 'قرار المراجعة الشرعية',
      `المراجعة الشرعية أعادت العنصر (الحالة: ${refused.status}).`, 'reviewer',
      'عالِج ملاحظات المراجعة الشرعية ثم اطلب قرارًا جديدًا.'));
  } else if (sharia.some((review) => review.status === 'approved')) {
    findings.push(pass('review_sharia', 'قرار المراجعة الشرعية', 'معتمدة.'));
  } else {
    findings.push(block('review_sharia', 'قرار المراجعة الشرعية',
      sharia.length ? 'قرار المراجعة الشرعية معلّق.' : 'لا سجلّ مراجعة شرعية.',
      'reviewer', 'سجّل قرار المراجعة الشرعية في مركز المراجعات قبل النشر.'));
  }
  return findings;
}

// --- Per-type evaluation ---------------------------------------------------

function evaluateSeries(facts: SeriesFacts): GateFinding[] {
  const findings: GateFinding[] = [testFixtureCheck(facts), archivedCheck(facts)];

  const cover = text(facts.cover_url) ?? readyAsset(facts.assets, ['cover', 'poster'])?.asset_id ?? null;
  findings.push(cover
    ? pass('cover', 'الغلاف/البوستر', 'موجود.')
    : block('cover', 'الغلاف/البوستر',
        pendingAsset(facts.assets, ['cover', 'poster'])
          ? 'الغلاف مرتبط لكن الأصل ليس جاهزًا (status ≠ ready).'
          : 'لا cover_url ولا أصل مرتبط بدور cover/poster.',
        'production',
        'ارفع البوستر إلى مكتبة الوسائط واربطه بالسلسلة بدور cover أو poster.'));

  findings.push(facts.episode_count > 0
    ? pass('episodes', 'الحلقات', `${facts.episode_count} حلقة.`)
    : block('episodes', 'الحلقات', 'لا حلقات في السلسلة، فصفحة السلسلة ستكون فارغة.',
        'editor', 'أضف حلقة واحدة على الأقل قبل نشر السلسلة.'));

  if (facts.episode_count > 0 && facts.published_episode_count === 0) {
    findings.push(warn('published_episodes', 'حلقات منشورة',
      'كل الحلقات غير منشورة، فالسلسلة ستظهر بلا محتوى قابل للتشغيل.', 'publisher',
      'انشر حلقة واحدة على الأقل، أو انشر السلسلة عمدًا كـ«قريبًا».'));
  }

  findings.push(facts.visual_style_id
    ? pass('visual_style', 'الأسلوب البصري', facts.visual_style_id)
    : warn('visual_style', 'الأسلوب البصري', 'لا أسلوب بصري مرتبط.', 'editor',
        'اربط السلسلة بأسلوب بصري ليتّسق إنتاج الحلقات.'));

  findings.push(text(facts.description_ar)
    ? pass('description', 'الوصف العربي', 'موجود.')
    : warn('description', 'الوصف العربي', 'لا وصف عربي، وهو ما يقرأه ولي الأمر قبل التشغيل.',
        'editor', 'اكتب وصفًا عربيًا موجزًا للسلسلة.'));

  findings.push(...religiousChecks(
    facts.planet_id, facts.source_type, facts.religious_reviewer_id, facts.religious_approved_at, facts.reviews,
  ));
  findings.push(...reviewChecks(facts, [
    { role: 'edu', label: 'المراجعة التربوية' },
    { role: 'lang', label: 'المراجعة اللغوية' },
    { role: 'qa', label: 'ضمان الجودة' },
  ]));
  findings.push(...rightsChecks(facts));
  return findings;
}

function evaluateEpisode(facts: EpisodeFacts): GateFinding[] {
  const findings: GateFinding[] = [testFixtureCheck(facts), archivedCheck(facts)];

  // The parent series.
  //
  // An episode of an unpublished series is not merely inconsistent, it is
  // unreachable: every app route to an episode goes through its series, so the
  // child sees nothing and the operator sees a published row. Blocking here is the
  // difference between a clear refusal now and an invisible defect later.
  findings.push(facts.series_status === 'published'
    ? pass('parent_series', 'السلسلة الأمّ', 'منشورة.')
    : block('parent_series', 'السلسلة الأمّ',
        `السلسلة الأمّ حالتها "${facts.series_status}"، وكل مسار في التطبيق يصل للحلقة عبر السلسلة، `
        + 'فالحلقة ستكون غير قابلة للوصول.',
        'publisher', 'انشر السلسلة أولًا ثم انشر الحلقة.'));

  const video = text(facts.video_master_url) ?? text(facts.video_hls_1080)
    ?? readyAsset(facts.assets, ['video', 'video_master', 'master'])?.asset_id ?? null;
  findings.push(video
    ? pass('video', 'ملف الفيديو', 'موجود.')
    : block('video', 'ملف الفيديو',
        pendingAsset(facts.assets, ['video', 'video_master', 'master'])
          ? 'الفيديو مرتبط لكن الأصل ليس جاهزًا (status ≠ ready).'
          : 'لا video_master_url ولا video_hls_1080 ولا أصل فيديو جاهز مرتبط.',
        'production', 'ارفع الفيديو النهائي وأكمل معالجته حتى تصبح حالته ready.'));

  const thumbnail = text(facts.thumbnail_url) ?? readyAsset(facts.assets, ['thumbnail', 'thumb', 'cover'])?.asset_id ?? null;
  findings.push(thumbnail
    ? pass('thumbnail', 'الصورة المصغّرة', 'موجودة.')
    : block('thumbnail', 'الصورة المصغّرة',
        'لا thumbnail_url ولا أصل مصغّر جاهز، فستظهر الحلقة كبطاقة فارغة للطفل.',
        'production', 'ارفع صورة مصغّرة واربطها بالحلقة بدور thumbnail.'));

  // Arabic voicing blocks; other languages do not exist as a requirement.
  findings.push(facts.dubs.includes('ar')
    ? pass('dub_ar', 'الصوت العربي', `اللغات: ${facts.dubs.join(' · ')}.`)
    : block('dub_ar', 'الصوت العربي',
        `dubs لا تتضمّن العربية (${facts.dubs.length ? facts.dubs.join(' · ') : 'فارغة'})، `
        + 'والعربية هي لغة المنتج الأولى.',
        'production', 'أضف الأداء الصوتي العربي وسجّله في dubs قبل النشر.'));

  findings.push(facts.duration_seconds && facts.duration_seconds > 0
    ? pass('duration', 'المدة', `${facts.duration_seconds} ثانية.`)
    : warn('duration', 'المدة', 'لا مدة مسجّلة، فحدّ وقت الشاشة والتقدّم يُحسبان بلا مرجع.',
        'production', 'سجّل مدة الحلقة بالثواني بعد المعالجة.'));

  findings.push(text(facts.captions_ar_url)
    ? pass('captions', 'الترجمة المصاحبة', 'موجودة.')
    : warn('captions', 'الترجمة المصاحبة', 'لا ملف ترجمة عربية، وهو ما يعتمد عليه الطفل ضعيف السمع.',
        'production', 'أنتج ملف ترجمة عربيًا واربطه بالحلقة.'));

  findings.push(facts.learning_objective_id
    ? pass('objective', 'الهدف التعليمي', facts.learning_objective_id)
    : warn('objective', 'الهدف التعليمي', 'لا هدف تعليمي مرتبط، فلا يُقاس أثر الحلقة.',
        'editor', 'اربط الحلقة بهدف تعليمي، أو وثّق أنها ترفيهية بقصد.'));

  findings.push(...religiousChecks(
    facts.planet_id, facts.source_type, null, facts.religious_approved_at, facts.reviews,
  ));
  findings.push(...reviewChecks(facts, [
    { role: 'edu', label: 'المراجعة التربوية' },
    { role: 'lang', label: 'المراجعة اللغوية' },
    { role: 'qa', label: 'ضمان الجودة' },
  ]));
  findings.push(...rightsChecks(facts));
  return findings;
}

function evaluateStory(facts: StoryFacts): GateFinding[] {
  const findings: GateFinding[] = [testFixtureCheck(facts), archivedCheck(facts)];
  const language = text(facts.default_language) ?? 'ar';
  const label = (page: StoryPageFacts) => page.page_number == null ? 'صفحة بلا رقم' : `صفحة ${page.page_number}`;

  if (!facts.pages.length) {
    findings.push(block('pages', 'الصفحات', 'لا صفحات في القصة.', 'editor',
      'أضف صفحات القصة قبل النشر.'));
    return findings;
  }
  findings.push(pass('pages', 'الصفحات', `${facts.pages.length} صفحة.`));

  const missingImage = facts.pages.filter((page) => !page.image_asset_id);
  const unreadyImage = facts.pages.filter((page) => page.image_asset_id && page.image_status !== 'ready');
  if (missingImage.length || unreadyImage.length) {
    findings.push(block('page_images', 'رسوم الصفحات',
      `${missingImage.length} صفحة بلا رسم و${unreadyImage.length} صفحة رسمها غير جاهز.`,
      'production', 'أكمل رسوم الصفحات وارفعها حتى تصبح حالتها ready.',
      [...missingImage.map((page) => `${label(page)}: بلا رسم`),
        ...unreadyImage.map((page) => `${label(page)}: الأصل ${page.image_status ?? 'مفقود'}`)]));
  } else {
    findings.push(pass('page_images', 'رسوم الصفحات', 'كل الصفحات لها رسم جاهز.'));
  }

  const missingText = facts.pages.filter((page) => {
    const localized = page.localizations.find((entry) => entry.language === language);
    return !text(localized?.body_text ?? null);
  });
  findings.push(missingText.length === 0
    ? pass('page_text', `نصّ الصفحات (${language})`, 'مكتمل.')
    : block('page_text', `نصّ الصفحات (${language})`,
        `${missingText.length} صفحة بلا نصّ باللغة الأساسية.`, 'editor',
        `اكتب نصّ كل صفحة باللغة ${language} قبل النشر.`,
        missingText.map(label)));

  // Narration. Blocking for an audio story because its pages are consumed by ear
  // and a silent page is a dead end; a warning elsewhere because a picture book
  // reads perfectly without it.
  const missingNarration = facts.pages.filter((page) => {
    const localized = page.localizations.find((entry) => entry.language === language);
    return !localized?.narration_asset_id || localized.narration_status !== 'ready';
  });
  if (missingNarration.length === 0) {
    findings.push(pass('narration', `السرد (${language})`, 'مكتمل وجاهز.'));
  } else if (facts.story_type === 'audio_story') {
    findings.push(block('narration', `السرد (${language})`,
      `${missingNarration.length} صفحة بلا سرد جاهز، والقصة من نوع audio_story تُستهلك سمعيًا.`,
      'production', 'سجّل السرد لكل صفحة واربطه، أو غيّر نوع القصة.',
      missingNarration.map(label)));
  } else {
    findings.push(warn('narration', `السرد (${language})`,
      `${missingNarration.length} صفحة بلا سرد جاهز.`, 'production',
      'سجّل السرد إن كانت القصة تُقدَّم مسموعة أيضًا.', missingNarration.map(label)));
  }

  // Declared secondary languages. Declaring a language the reader cannot deliver
  // is worse than not declaring it: the app offers the choice and then shows the
  // child empty pages.
  const secondary = facts.declared_languages.filter((code) => code !== language);
  if (secondary.length) {
    const gaps: string[] = [];
    for (const code of secondary) {
      const missing = facts.pages.filter((page) => {
        const localized = page.localizations.find((entry) => entry.language === code);
        return !text(localized?.body_text ?? null);
      });
      if (missing.length) gaps.push(`${code}: ${missing.length} صفحة ناقصة`);
    }
    findings.push(gaps.length === 0
      ? pass('translations', 'الترجمات المُعلَنة', secondary.join(' · '))
      : warn('translations', 'الترجمات المُعلَنة',
          'القصة تُعلن لغات لا تكتمل صفحاتها فيها، فالتطبيق سيعرض اختيارًا يؤدي لصفحات فارغة.',
          'translator', 'أكمل الترجمة أو أزل اللغة من قائمة languages للقصة.', gaps));
  } else {
    findings.push(skip('translations', 'الترجمات المُعلَنة', 'لا لغات ثانية مُعلَنة.'));
  }

  findings.push(facts.visual_style_id
    ? pass('visual_style', 'الأسلوب البصري', facts.visual_style_id)
    : warn('visual_style', 'الأسلوب البصري', 'لا أسلوب بصري مرتبط.', 'editor',
        'اربط القصة بأسلوب بصري لضمان اتساق الرسوم.'));

  const cover = readyAsset(facts.assets, ['cover', 'poster'])?.asset_id ?? null;
  findings.push(cover
    ? pass('cover', 'الغلاف', 'موجود.')
    : warn('cover', 'الغلاف',
        'لا أصل مرتبط بدور cover؛ القارئ يستخدم رسم الصفحة الأولى بدلًا منه.', 'production',
        'اربط غلافًا مخصّصًا إن أردت بطاقة مكتبة مختلفة عن الصفحة الأولى.'));

  findings.push(...reviewChecks(facts, []));
  findings.push(...rightsChecks(facts));
  return findings;
}

function evaluateBook(facts: BookFacts): GateFinding[] {
  const findings: GateFinding[] = [testFixtureCheck(facts), archivedCheck(facts)];
  const pages = typeof facts.pages === 'string' ? parseJson(facts.pages, null) : facts.pages;
  findings.push(Array.isArray(pages) && pages.length
    ? pass('pages', 'الصفحات', `${pages.length} صفحة.`)
    : block('pages', 'الصفحات', 'الكتاب بلا صفحات.', 'editor',
        'أضف صفحات الكتاب قبل النشر.'));

  // `books.languages` is TEXT holding a JSON array (migration 0012), while
  // `bookLanguagesError` expects a real array — it is also called from the write
  // path where the value is still the parsed request body. Passing the raw column
  // made every book fail with "languages must contain unique non-empty language
  // codes", which is a false blocker and exactly the kind of noise that teaches
  // editors to distrust the gate.
  const languages = typeof facts.languages === 'string' ? parseJson(facts.languages, null) : facts.languages;
  const languageError = bookLanguagesError(languages, facts.default_language);
  findings.push(languageError === null
    ? pass('languages', 'اللغات', 'قائمة اللغات واللغة الافتراضية متوافقتان.')
    : block('languages', 'اللغات', languageError, 'editor',
        'صحّح قائمة اللغات واللغة الافتراضية فلا تُعلن لغة لا نصّ لها.'));

  const cover = readyAsset(facts.assets, ['cover', 'poster'])?.asset_id ?? null;
  findings.push(cover
    ? pass('cover', 'الغلاف', 'موجود.')
    : warn('cover', 'الغلاف', 'لا غلاف جاهز مرتبط، فستظهر بطاقة الكتاب بلا صورة.',
        'production', 'ارفع غلافًا واربطه بالكتاب بدور cover.'));

  findings.push(...reviewChecks(facts, [
    { role: 'edu', label: 'المراجعة التربوية' },
    { role: 'lang', label: 'المراجعة اللغوية' },
    { role: 'qa', label: 'ضمان الجودة' },
  ]));
  findings.push(...rightsChecks(facts));
  return findings;
}

function evaluateProject(facts: ProjectFacts): GateFinding[] {
  const findings: GateFinding[] = [testFixtureCheck(facts), archivedCheck(facts)];
  const materials = typeof facts.materials === 'string' ? parseJson(facts.materials, null) : facts.materials;
  const steps = typeof facts.steps === 'string' ? parseJson(facts.steps, null) : facts.steps;

  findings.push(Array.isArray(materials) && materials.length
    ? pass('materials', 'المواد', `${materials.length} مادة.`)
    : block('materials', 'المواد', 'لا مواد مسجّلة، فلا يعرف ولي الأمر ما يجهّزه.',
        'editor', 'اكتب قائمة المواد المطلوبة للنشاط.'));

  findings.push(Array.isArray(steps) && steps.length
    ? pass('steps', 'الخطوات', `${steps.length} خطوة.`)
    : block('steps', 'الخطوات', 'لا خطوات مسجّلة، فالنشاط غير قابل للتنفيذ.',
        'editor', 'اكتب خطوات النشاط بالترتيب.'));

  // Supervision. A project that needs an adult present and says nothing about why
  // is the one case in this file where the gap is a physical-safety gap.
  findings.push(facts.supervision_level !== 'required' || text(facts.safety_notes)
    ? pass('safety', 'ملاحظات السلامة',
        facts.supervision_level === 'required' ? 'مسجّلة.' : `مستوى الإشراف: ${facts.supervision_level}.`)
    : block('safety', 'ملاحظات السلامة',
        'الإشراف "required" بلا ملاحظات سلامة، فولي الأمر لا يعرف الخطر الذي يشرف عليه.',
        'editor', 'اكتب ملاحظات السلامة صراحةً قبل النشر.'));

  const cover = text(facts.cover_url) ?? readyAsset(facts.assets, ['cover'])?.asset_id ?? null;
  findings.push(cover
    ? pass('cover', 'الغلاف', 'موجود.')
    : warn('cover', 'الغلاف', 'لا غلاف، فستظهر بطاقة النشاط بلا صورة.', 'production',
        'ارفع صورة للنشاط واربطها بدور cover.'));

  findings.push(...reviewChecks(facts, [
    { role: 'edu', label: 'المراجعة التربوية' },
    { role: 'qa', label: 'ضمان الجودة' },
  ]));
  findings.push(...rightsChecks(facts));
  return findings;
}

/// Games: the engine readiness verbatim, plus the shared catalogue checks.
///
/// `lib/publishReadiness.ts` already derives every rule from the engine's own
/// contract — pack version, client implementation, touch targets, the Arabic font
/// licence, the four reviews. Re-deriving any of it here would produce a second
/// opinion that drifts, so its checks are mapped rather than recomputed, and only
/// the checks it does not make (test fixture, archived, rights expiry) are added.
function evaluateGame(facts: GameFacts): GateFinding[] {
  const ownerMap: Record<string, GateOwner> = {
    editor: 'editor', engineering: 'engineering', reviewer: 'reviewer',
    production: 'production', provider: 'provider',
  };
  const actionFor = (owner: GateOwner | undefined): string => {
    switch (owner) {
      case 'engineering': return 'أصلح المشكلة في المحرّك أو الحزمة ثم أعِد فحص الجاهزية.';
      case 'reviewer': return 'اطلب قرار المراجعة المطلوب وسجّله.';
      case 'production': return 'أكمل الأصول أو التسجيلات الناقصة حتى تصبح جاهزة.';
      case 'provider': return 'احصل على الترخيص الخارجي ووثّقه كسجلّ حقوق.';
      case 'editor': return 'صحّح بيانات اللعبة أو حزمتها ثم أعِد الفحص.';
      default: return 'راجع تفاصيل الفحص.';
    }
  };
  const mapped: GateFinding[] = facts.readiness.checks.map((check) => {
    const owner = check.owner ? ownerMap[check.owner] : undefined;
    const severity: GateSeverity = check.status === 'blocked' ? 'blocker'
      : check.status === 'warn' ? 'warning' : 'none';
    return {
      id: `engine_${check.id}`,
      label_ar: check.label_ar,
      status: check.status,
      severity,
      detail: check.detail ?? '',
      owner,
      required_action: check.status === 'pass' || check.status === 'not_applicable'
        ? undefined
        : actionFor(owner),
      items: check.items,
    };
  });
  return [testFixtureCheck(facts), archivedCheck(facts), ...mapped, ...rightsChecks(facts)];
}

// --- Entry point -----------------------------------------------------------

export function evaluatePublishGate(facts: PublishGateFacts): PublishGateResult {
  const findings = (() => {
    switch (facts.entity_type) {
      case 'series': return evaluateSeries(facts);
      case 'episode': return evaluateEpisode(facts);
      case 'story': return evaluateStory(facts);
      case 'book': return evaluateBook(facts);
      case 'project': return evaluateProject(facts);
      case 'game': return evaluateGame(facts);
    }
  })();

  const blockers = findings.filter((finding) => finding.severity === 'blocker');
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  return {
    entity_type: facts.entity_type,
    entity_id: facts.entity_id,
    publishable: blockers.length === 0,
    findings,
    blockers,
    warnings,
  };
}

/// A one-line summary for an audit row or a log line.
///
/// Deliberately lists the blocker ids rather than a count: "3 blockers" in an
/// audit trail six months later tells whoever is reading it nothing about what was
/// wrong at the time.
export function summarizeGate(result: PublishGateResult): string {
  if (result.publishable) {
    return result.warnings.length
      ? `publishable with ${result.warnings.length} warning(s): ${result.warnings.map((w) => w.id).join(', ')}`
      : 'publishable';
  }
  return `blocked by: ${result.blockers.map((blocker) => blocker.id).join(', ')}`;
}
