/// The production matrix: what each content item still needs before it can ship.
///
/// Pure — no D1, no request, no clock. `routes/adminProduction.ts` gathers the rows.
///
/// ## Why the state is derived and only the ownership is stored
///
/// Every requirement's status here is computed from the artefacts themselves: the
/// video asset's `content_assets.status`, the pages that have a ready illustration,
/// the languages that actually have text, the review rows that exist. Nothing lets a
/// person set "ARTWORK: done".
///
/// That is the whole design decision, and it is deliberate. A stored status is a claim
/// that drifts from reality the moment the underlying asset is replaced, archived or
/// never uploaded — and a production board that says 100% while the episode has no
/// video file is worse than no board, because people stop checking. The dashboard has
/// already shipped that failure once: pages that displayed invented completion figures
/// were removed in an earlier session precisely because nobody could tell which
/// numbers were real.
///
/// What a person *does* own is the human layer: who is responsible, when it is due,
/// what is blocking them, and any note. Those cannot be derived and are stored
/// (`production_requirements`, migration 0032). So the matrix is honest about progress
/// and useful about accountability, and the two never contradict each other.
///
/// ## Percentages only where a denominator exists
///
/// `ARTWORK 60%` is meaningful for a story: 3 of 5 pages have a ready illustration.
/// It is meaningless for an episode, whose artwork is not a countable set, so the
/// episode reports a state and not a fraction. Inventing a denominator to fill the
/// column would be the same class of defect as inventing the status.

export const PRODUCTION_REQUIREMENTS = [
  'script', 'educational', 'translation_ar', 'translation_en', 'translation_fr',
  'voice_ar', 'voice_en', 'voice_fr', 'artwork', 'video', 'thumbnail',
  'captions', 'qa', 'publish',
] as const;
export type ProductionRequirement = (typeof PRODUCTION_REQUIREMENTS)[number];

export function isProductionRequirement(value: unknown): value is ProductionRequirement {
  return typeof value === 'string' && (PRODUCTION_REQUIREMENTS as readonly string[]).includes(value);
}

/// `not_applicable` is distinct from `missing` on purpose: an episode has no page
/// illustrations and a picture book has no video, and reporting either as missing
/// would make every item permanently incomplete.
export type RequirementState = 'ready' | 'partial' | 'in_progress' | 'missing' | 'blocked' | 'not_applicable';

/// Which team clears a requirement. Used to route the board, not to grant anything.
export type RequirementOwnerRole =
  | 'editor' | 'educational' | 'translator' | 'voice' | 'art' | 'video' | 'qa' | 'publisher';

export interface RequirementRow {
  key: ProductionRequirement;
  label_ar: string;
  state: RequirementState;
  /// 0–100 only when a real denominator exists; null otherwise.
  percent: number | null;
  /// Precise reason. Never a bare "missing".
  detail: string;
  owner_role: RequirementOwnerRole;
  /// The specific offenders, for example page numbers with no illustration.
  items: string[];
  /// Requirements that must be settled before this one can start.
  depends_on: ProductionRequirement[];
  /// Human layer, from `production_requirements`. Null when nobody has taken it.
  assignee_id: string | null;
  team_id: string | null
  due_at: string | null;
  blocker: string | null;
  note: string | null;
}

export interface ProductionAssignment {
  requirement: ProductionRequirement;
  assignee_id: string | null;
  team_id: string | null;
  due_at: string | null;
  blocker: string | null;
  note: string | null;
}

/// Facts for an episode.
export interface EpisodeProductionFacts {
  content_type: 'episode';
  content_id: string;
  title: string;
  status: string;
  /// asset_links roles present for this episode, with the linked asset's status.
  assets: Array<{ role: string; status: string | null; language: string }>;
  video_master_url: string | null;
  video_hls_1080: string | null;
  thumbnail_url: string | null;
  captions_ar_url: string | null;
  /// episodes.dubs — the languages the episode is voiced in.
  dubs: string[];
  learning_objective_id: string | null;
  reviews: Array<{ role: string; status: string }>;
  /// Blockers from the publish gate, so PUBLISH reports the real verdict.
  publish_blockers: string[];
  publish_evaluated: boolean;
}

/// Facts for a story.
export interface StoryProductionFacts {
  content_type: 'story';
  content_id: string;
  title: string;
  status: string;
  story_type: string;
  default_language: string;
  declared_languages: string[];
  assets: Array<{ role: string; status: string | null; language: string }>;
  pages: Array<{
    page_number: number | null;
    image_ready: boolean;
    /// Languages that have body text on this page.
    text_languages: string[];
    /// Languages with a ready narration asset on this page.
    narration_languages: string[];
  }>;
  reviews: Array<{ role: string; status: string }>;
  publish_blockers: string[];
  publish_evaluated: boolean;
}

export type ProductionFacts = EpisodeProductionFacts | StoryProductionFacts;

const LABELS: Record<ProductionRequirement, string> = {
  script: 'النصّ',
  educational: 'المراجعة التربوية',
  translation_ar: 'النصّ العربي',
  translation_en: 'الترجمة الإنجليزية',
  translation_fr: 'الترجمة الفرنسية',
  voice_ar: 'الصوت العربي',
  voice_en: 'الصوت الإنجليزي',
  voice_fr: 'الصوت الفرنسي',
  artwork: 'الرسوم',
  video: 'الفيديو',
  thumbnail: 'الصورة المصغّرة',
  captions: 'الترجمة المصاحبة',
  qa: 'ضمان الجودة',
  publish: 'النشر',
};

const OWNERS: Record<ProductionRequirement, RequirementOwnerRole> = {
  script: 'editor',
  educational: 'educational',
  translation_ar: 'editor',
  translation_en: 'translator',
  translation_fr: 'translator',
  voice_ar: 'voice',
  voice_en: 'voice',
  voice_fr: 'voice',
  artwork: 'art',
  video: 'video',
  thumbnail: 'art',
  captions: 'video',
  qa: 'qa',
  publish: 'publisher',
};

const DEPENDS: Partial<Record<ProductionRequirement, ProductionRequirement[]>> = {
  educational: ['script'],
  translation_en: ['translation_ar'],
  translation_fr: ['translation_ar'],
  voice_ar: ['translation_ar'],
  voice_en: ['translation_en'],
  voice_fr: ['translation_fr'],
  artwork: ['script'],
  video: ['artwork', 'voice_ar'],
  captions: ['video'],
  qa: ['video', 'artwork'],
  publish: ['qa'],
};

function row(
  key: ProductionRequirement,
  state: RequirementState,
  detail: string,
  options: { percent?: number | null; items?: string[] } = {},
): Omit<RequirementRow, 'assignee_id' | 'team_id' | 'due_at' | 'blocker' | 'note'> {
  return {
    key,
    label_ar: LABELS[key],
    state,
    percent: options.percent ?? null,
    detail,
    owner_role: OWNERS[key],
    items: options.items ?? [],
    depends_on: DEPENDS[key] ?? [],
  };
}

const assetReady = (
  assets: Array<{ role: string; status: string | null; language: string }>,
  roles: string[],
  language?: string,
) => assets.some((asset) => roles.includes(asset.role)
  && asset.status === 'ready'
  && (language === undefined || asset.language === language || asset.language === ''));

const assetPresent = (
  assets: Array<{ role: string; status: string | null; language: string }>,
  roles: string[],
) => assets.some((asset) => roles.includes(asset.role));

function reviewRow(
  key: ProductionRequirement,
  reviews: Array<{ role: string; status: string }>,
  reviewerRole: string,
) {
  const rows = reviews.filter((review) => review.role === reviewerRole);
  const refused = rows.find((review) => review.status === 'rejected' || review.status === 'needs_changes');
  if (refused) {
    return row(key, 'blocked', `المراجعة أعادت العمل (${refused.status}).`);
  }
  if (rows.some((review) => review.status === 'approved')) return row(key, 'ready', 'معتمدة.');
  if (rows.length) return row(key, 'in_progress', `المراجعة معلّقة (${rows.length} سجل).`);
  return row(key, 'missing', 'لا سجلّ مراجعة.');
}

function publishRow(facts: ProductionFacts) {
  if (!facts.publish_evaluated) {
    return row('publish', 'not_applicable', 'لم تُقيَّم بوابة النشر في هذا التحميل.');
  }
  if (facts.status === 'published') return row('publish', 'ready', 'منشور.');
  if (facts.publish_blockers.length) {
    return row('publish', 'blocked', `${facts.publish_blockers.length} عائق في بوابة النشر.`, {
      items: facts.publish_blockers,
    });
  }
  return row('publish', 'in_progress', 'كل العوائق مُعالَجة؛ في انتظار قرار النشر.');
}

function episodeRows(facts: EpisodeProductionFacts) {
  const rows: Array<ReturnType<typeof row>> = [];

  // The script is a linked document, not a column: `episodes` has no script field, and
  // inventing one from `description_ar` would report a synopsis as a finished script.
  rows.push(assetReady(facts.assets, ['script', 'screenplay'])
    ? row('script', 'ready', 'مستند نصّ مرتبط وجاهز.')
    : assetPresent(facts.assets, ['script', 'screenplay'])
      ? row('script', 'in_progress', 'مستند النصّ مرتبط لكنه ليس جاهزًا.')
      : row('script', 'missing', 'لا مستند نصّ مرتبط بالحلقة (بدور script).'));

  rows.push(facts.learning_objective_id
    ? reviewRow('educational', facts.reviews, 'edu')
    : row('educational', 'missing', 'لا هدف تعليمي مرتبط، فلا موضوع للمراجعة التربوية.'));

  // Arabic text for an episode is the script plus its language review; the episode has
  // no page text of its own.
  rows.push(reviewRow('translation_ar', facts.reviews, 'lang'));

  for (const [key, language] of [['translation_en', 'en'], ['translation_fr', 'fr']] as const) {
    rows.push(assetReady(facts.assets, ['script', 'subtitle', 'captions'], language)
      ? row(key, 'ready', `أصل نصّي جاهز بلغة ${language}.`)
      : row(key, 'missing', `لا أصل نصّي مرتبط بلغة ${language}.`));
  }

  for (const [key, language] of [['voice_ar', 'ar'], ['voice_en', 'en'], ['voice_fr', 'fr']] as const) {
    const dubbed = facts.dubs.includes(language);
    const audio = assetReady(facts.assets, ['audio', 'dub', 'voice'], language);
    rows.push(dubbed || audio
      ? row(key, 'ready', dubbed ? `مُعلَن في dubs (${language}).` : `أصل صوتي جاهز (${language}).`)
      : row(key, 'missing', `لا أداء صوتي بلغة ${language}.`));
  }

  // No countable denominator for episode artwork, so a state and no percentage.
  rows.push(assetReady(facts.assets, ['artwork', 'image', 'background', 'still'])
    ? row('artwork', 'ready', 'أصول فنية جاهزة مرتبطة.')
    : assetPresent(facts.assets, ['artwork', 'image', 'background', 'still'])
      ? row('artwork', 'in_progress', 'أصول فنية مرتبطة وغير جاهزة.')
      : row('artwork', 'missing', 'لا أصول فنية مرتبطة.'));

  const video = facts.video_master_url || facts.video_hls_1080 || assetReady(facts.assets, ['video', 'stream', 'video_master']);
  rows.push(video
    ? row('video', 'ready', 'ملف فيديو متاح.')
    : assetPresent(facts.assets, ['video', 'stream', 'video_master'])
      ? row('video', 'in_progress', 'الفيديو مرتبط ولم تكتمل معالجته.')
      : row('video', 'missing', 'لا ملف فيديو ولا أصل مرتبط.'));

  rows.push(facts.thumbnail_url || assetReady(facts.assets, ['thumbnail', 'thumb', 'cover'])
    ? row('thumbnail', 'ready', 'مصغّرة متاحة.')
    : row('thumbnail', 'missing', 'لا مصغّرة، فستظهر الحلقة كبطاقة فارغة.'));

  rows.push(facts.captions_ar_url || assetReady(facts.assets, ['subtitle', 'captions'], 'ar')
    ? row('captions', 'ready', 'ترجمة عربية مصاحبة متاحة.')
    : row('captions', 'missing', 'لا ترجمة مصاحبة عربية.'));

  rows.push(reviewRow('qa', facts.reviews, 'qa'));
  rows.push(publishRow(facts));
  return rows;
}

function storyRows(facts: StoryProductionFacts) {
  const rows: Array<ReturnType<typeof row>> = [];
  const total = facts.pages.length;
  const label = (page: { page_number: number | null }) => page.page_number == null ? 'صفحة بلا رقم' : `صفحة ${page.page_number}`;
  const pct = (count: number) => (total === 0 ? 0 : Math.round((count / total) * 100));

  if (total === 0) {
    rows.push(row('script', 'missing', 'لا صفحات في القصة.'));
  } else {
    const written = facts.pages.filter((page) => page.text_languages.includes(facts.default_language));
    rows.push(written.length === total
      ? row('script', 'ready', `كل الصفحات مكتوبة (${total}).`)
      : row('script', written.length ? 'partial' : 'missing',
          `${written.length} من ${total} صفحة مكتوبة باللغة الأساسية.`,
          {
            percent: pct(written.length),
            items: facts.pages.filter((page) => !page.text_languages.includes(facts.default_language)).map(label),
          }));
  }

  rows.push(reviewRow('educational', facts.reviews, 'edu'));

  // `content_reviews` has no 'story' entity type (CHECK), so a story's review rows do
  // not exist and cannot. Reporting them as missing would blame an editor for a schema
  // limitation, which the publish gate already refuses to do.
  const reviewsPossible = facts.reviews.length > 0;

  const arabicWritten = facts.pages.filter((page) => page.text_languages.includes(facts.default_language)).length;
  rows.push(total && arabicWritten === total
    ? row('translation_ar', 'ready', 'النصّ الأساسي مكتمل.')
    : row('translation_ar', arabicWritten ? 'partial' : 'missing',
        `${arabicWritten} من ${total} صفحة.`, { percent: pct(arabicWritten) }));

  for (const [key, language] of [['translation_en', 'en'], ['translation_fr', 'fr']] as const) {
    if (!facts.declared_languages.includes(language)) {
      rows.push(row(key, 'not_applicable', `اللغة ${language} غير مُعلَنة لهذه القصة.`));
      continue;
    }
    const done = facts.pages.filter((page) => page.text_languages.includes(language)).length;
    rows.push(done === total && total > 0
      ? row(key, 'ready', `مكتملة (${total}).`)
      : row(key, done ? 'partial' : 'missing', `${done} من ${total} صفحة.`, {
          percent: pct(done),
          items: facts.pages.filter((page) => !page.text_languages.includes(language)).map(label),
        }));
  }

  for (const [key, language] of [['voice_ar', 'ar'], ['voice_en', 'en'], ['voice_fr', 'fr']] as const) {
    const declared = language === facts.default_language || facts.declared_languages.includes(language);
    if (!declared) {
      rows.push(row(key, 'not_applicable', `اللغة ${language} غير مُعلَنة لهذه القصة.`));
      continue;
    }
    const done = facts.pages.filter((page) => page.narration_languages.includes(language)).length;
    // Narration is a requirement for an audio story and an option elsewhere; the state
    // is the same fraction either way, and which of them blocks a publish is the
    // publish gate's decision, not this board's.
    rows.push(done === total && total > 0
      ? row(key, 'ready', `سرد مكتمل (${total}).`)
      : row(key, done ? 'partial' : 'missing', `${done} من ${total} صفحة مسرودة.`, {
          percent: pct(done),
          items: facts.pages.filter((page) => !page.narration_languages.includes(language)).map(label),
        }));
  }

  const illustrated = facts.pages.filter((page) => page.image_ready).length;
  rows.push(total && illustrated === total
    ? row('artwork', 'ready', `كل الصفحات مرسومة (${total}).`)
    : row('artwork', illustrated ? 'partial' : 'missing',
        `${illustrated} من ${total} صفحة لها رسم جاهز.`, {
          percent: pct(illustrated),
          items: facts.pages.filter((page) => !page.image_ready).map(label),
        }));

  rows.push(row('video', 'not_applicable', 'القصص المصوّرة لا تحتوي فيديو.'));

  rows.push(assetReady(facts.assets, ['cover', 'poster'])
    ? row('thumbnail', 'ready', 'غلاف جاهز مرتبط.')
    : row('thumbnail', 'missing', 'لا غلاف مخصّص؛ يُستخدم رسم الصفحة الأولى.'));

  rows.push(row('captions', 'not_applicable', 'لا فيديو، فلا ترجمة مصاحبة.'));

  rows.push(reviewsPossible
    ? reviewRow('qa', facts.reviews, 'qa')
    : row('qa', 'not_applicable',
        'جدول content_reviews لا يقبل النوع story (CHECK)، فلا سجلّ مراجعة ممكن — قيد مخطوطة لا تقصير.'));

  rows.push(publishRow(facts));
  return rows;
}

/// The full matrix for one content item, with the stored ownership merged in.
export function productionMatrix(
  facts: ProductionFacts,
  assignments: ProductionAssignment[] = [],
): RequirementRow[] {
  const derived = facts.content_type === 'episode' ? episodeRows(facts) : storyRows(facts);
  const byKey = new Map(assignments.map((assignment) => [assignment.requirement, assignment]));
  return derived.map((entry) => {
    const assignment = byKey.get(entry.key);
    return {
      ...entry,
      assignee_id: assignment?.assignee_id ?? null,
      team_id: assignment?.team_id ?? null,
      due_at: assignment?.due_at ?? null,
      blocker: assignment?.blocker ?? null,
      note: assignment?.note ?? null,
      // A recorded blocker overrides a derived "in progress": if a person says they are
      // stuck, the board must show stuck. It cannot override `ready`, because the
      // artefact either exists or it does not, and a stale blocker note must not hide a
      // finished asset.
      state: assignment?.blocker && entry.state !== 'ready' && entry.state !== 'not_applicable'
        ? 'blocked'
        : entry.state,
    };
  });
}

export interface ProductionSummary {
  total: number;
  ready: number;
  partial: number;
  in_progress: number;
  missing: number;
  blocked: number;
  not_applicable: number;
  /// Completion over applicable requirements only, so a story is not penalised for
  /// having no video.
  percent: number;
  publish_state: RequirementState;
}

export function summarizeMatrix(rows: RequirementRow[]): ProductionSummary {
  const counts = {
    ready: 0, partial: 0, in_progress: 0, missing: 0, blocked: 0, not_applicable: 0,
  } as Record<RequirementState, number>;
  for (const entry of rows) counts[entry.state] += 1;

  const applicable = rows.filter((entry) => entry.state !== 'not_applicable');
  // A partial requirement counts as its own fraction rather than as half of one: a
  // story with 9 of 10 pages illustrated is not 50% through its artwork.
  const credit = applicable.reduce((sum, entry) => {
    if (entry.state === 'ready') return sum + 1;
    if (entry.percent !== null) return sum + entry.percent / 100;
    return sum;
  }, 0);

  return {
    total: rows.length,
    ...counts,
    percent: applicable.length ? Math.round((credit / applicable.length) * 100) : 0,
    publish_state: rows.find((entry) => entry.key === 'publish')?.state ?? 'not_applicable',
  };
}
