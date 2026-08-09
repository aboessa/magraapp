import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BUBBLE_KINDS,
  CHARACTER_ROLES,
  CONTENT_STATUSES,
  DIFFICULTIES,
  INTERACTION_MODES,
  PAGE_LAYOUTS,
  PRICE_TIERS,
  READING_LEVELS,
  RELEASE_STATUSES,
  REVIEWER_ROLES,
  REVIEW_ENTITY_TABLES,
  REVIEW_ENTITY_TYPES,
  REVIEW_STATUSES,
  STORY_TYPES,
  SUPERVISION_LEVELS,
  TRACKS,
  WATCH_ORDERS,
  ageRangeError,
  bookLanguagesError,
  bookPublishError,
  engineIdError,
  enumError,
  gamePublishError,
  isAgeRange,
  isReleaseStatus,
  isValidLanguage,
  normalizeTracks,
  objectiveCreatePayload,
  parsePagination,
  projectPublishError,
  reviewCreatePayload,
  storyPublishError,
  tracksForRange,
  uniqueStringArray,
} from '../src/lib/catalogueValidation.ts';

// Enum rejection paths -------------------------------------------------------
// Each list below mirrors a CHECK constraint read out of D1 with
// `SELECT sql FROM sqlite_master`. A value outside the list must never reach
// SQLite, otherwise a constraint failure surfaces to the editor as a 500.

test('every catalogue enum rejects an unknown value and accepts each allowed one', () => {
  const cases = [
    ['status', CONTENT_STATUSES],
    ['type', STORY_TYPES],
    ['reading_level', READING_LEVELS],
    ['interaction_mode', INTERACTION_MODES],
    ['supervision_level', SUPERVISION_LEVELS],
    ['price_tier', PRICE_TIERS],
    ['difficulty', DIFFICULTIES],
    ['role', CHARACTER_ROLES],
    ['layout', PAGE_LAYOUTS],
    ['kind', BUBBLE_KINDS],
    ['watch_order', WATCH_ORDERS],
    ['track', TRACKS],
    ['entity_type', REVIEW_ENTITY_TYPES],
    ['reviewer_role', REVIEWER_ROLES],
    ['status', REVIEW_STATUSES],
  ];

  for (const [field, allowed] of cases) {
    for (const value of allowed) {
      assert.equal(enumError(field, value, allowed), null, `${field}=${value} must be accepted`);
    }
    const rejected = enumError(field, 'definitely-not-valid', allowed);
    assert.ok(rejected, `${field} must reject an unknown value`);
    assert.match(rejected, new RegExp(`Invalid ${field}`));
    // The message has to name the legal values or an editor cannot self-correct.
    for (const value of allowed) assert.match(rejected, new RegExp(value));
  }
});

test('enum validation rejects empty strings, whitespace and non-strings', () => {
  for (const bad of ['', '   ', null, undefined, 5, {}, [], true]) {
    assert.ok(enumError('status', bad, CONTENT_STATUSES), `${JSON.stringify(bad)} must be rejected`);
  }
});

test('enum checks are case sensitive, matching SQLite CHECK semantics', () => {
  assert.ok(enumError('status', 'Published', CONTENT_STATUSES));
  assert.ok(enumError('status', 'PUBLISHED', CONTENT_STATUSES));
  assert.equal(enumError('status', 'published', CONTENT_STATUSES), null);
});

test('content review entity types exclude story, matching the live CHECK', () => {
  // content_reviews CHECK is entity_type IN ('series','episode','book','game','project').
  // A review row for a story would fail the constraint, so it must be a 400.
  assert.ok(enumError('entity_type', 'story', REVIEW_ENTITY_TYPES));
  assert.deepEqual(REVIEW_ENTITY_TYPES, ['series', 'episode', 'book', 'game', 'project']);
  // Every reviewable type must map to a real table for the existence check.
  for (const type of REVIEW_ENTITY_TYPES) {
    assert.ok(REVIEW_ENTITY_TABLES[type], `${type} needs a table mapping`);
  }
  assert.equal(REVIEW_ENTITY_TABLES.episode, 'episodes');
});

// Age ranges -----------------------------------------------------------------

test('age ranges outside 3-12 are rejected', () => {
  assert.equal(ageRangeError(3, 12), null);
  assert.equal(ageRangeError(6, 6), null);
  assert.ok(ageRangeError(2, 8), 'age_min below 3 must fail');
  assert.ok(ageRangeError(3, 13), 'age_max above 12 must fail');
  assert.ok(ageRangeError(0, 0));
  assert.ok(ageRangeError(13, 14));
  assert.ok(ageRangeError(null, 8));
  assert.ok(ageRangeError(6, null));
});

test('an inverted age range is rejected', () => {
  const error = ageRangeError(9, 6);
  assert.ok(error);
  assert.match(error, /age_max/);
  assert.equal(isAgeRange(9, 6), false);
  assert.equal(isAgeRange(6, 9), true);
});

test('isAgeRange agrees with ageRangeError on every integer pair in range', () => {
  for (let min = 0; min <= 14; min += 1) {
    for (let max = 0; max <= 14; max += 1) {
      assert.equal(
        isAgeRange(min, max),
        ageRangeError(min, max) === null,
        `disagreement at ${min}-${max}`,
      );
    }
  }
});

// Track derivation and the straddle rule ------------------------------------

test('objective tracks are derived from the age range the way episodes derive theirs', () => {
  assert.deepEqual(tracksForRange(3, 5), ['preschool']);
  assert.deepEqual(tracksForRange(6, 8), ['kids']);
  assert.deepEqual(tracksForRange(9, 12), ['junior']);
  assert.deepEqual(tracksForRange(3, 12), ['preschool', 'kids', 'junior']);
});

test('a range straddling two bands yields both tracks', () => {
  assert.deepEqual(tracksForRange(5, 6), ['preschool', 'kids']);
  assert.deepEqual(tracksForRange(8, 9), ['kids', 'junior']);
  assert.deepEqual(tracksForRange(4, 10), ['preschool', 'kids', 'junior']);
});

test('an omitted track list is derived, never left empty', () => {
  assert.deepEqual(normalizeTracks(undefined, 6, 8), ['kids']);
  assert.deepEqual(normalizeTracks(undefined, 5, 9), ['preschool', 'kids', 'junior']);
});

test('the straddle rule forbids a track the age range does not reach', () => {
  // 3-5 is preschool only, so claiming 'junior' must be refused rather than
  // silently written and later surfacing content to the wrong age band.
  assert.equal(normalizeTracks(['junior'], 3, 5), null);
  assert.equal(normalizeTracks(['preschool', 'junior'], 3, 5), null);
  assert.equal(normalizeTracks(['preschool'], 9, 12), null);
  // Narrowing within the applicable set is allowed.
  assert.deepEqual(normalizeTracks(['kids'], 5, 6), ['kids']);
  assert.deepEqual(normalizeTracks(['preschool', 'kids'], 5, 6), ['preschool', 'kids']);
});

test('track lists must be arrays of known non-empty track ids', () => {
  assert.equal(normalizeTracks([], 3, 12), null, 'an empty list is not a valid override');
  assert.equal(normalizeTracks('kids', 6, 8), null, 'a bare string is not a list');
  assert.equal(normalizeTracks(['toddler'], 3, 12), null);
  assert.equal(normalizeTracks([null], 3, 12), null);
  assert.equal(normalizeTracks([{}], 3, 12), null);
  // Duplicates collapse instead of producing a PRIMARY KEY collision on
  // learning_objective_tracks (objective_id, track_id).
  assert.deepEqual(normalizeTracks(['kids', 'kids'], 6, 8), ['kids']);
});

// Publish gates --------------------------------------------------------------

test('release statuses cover ready, scheduled and published only', () => {
  assert.deepEqual(RELEASE_STATUSES, ['ready', 'scheduled', 'published']);
  for (const status of RELEASE_STATUSES) assert.equal(isReleaseStatus(status), true);
  for (const status of ['draft', 'writing', 'review_edu', 'qa', 'archived']) {
    assert.equal(isReleaseStatus(status), false, `${status} must not trigger the publish gate`);
  }
});

test('a story with no pages cannot be released', () => {
  const error = storyPublishError([], 'picture_book', 'ar');
  assert.ok(error);
  assert.match(error, /at least one page/);
  assert.ok(storyPublishError(null, 'picture_book', 'ar'));
  assert.ok(storyPublishError(undefined, 'picture_book', 'ar'));
});

test('a story page without text in the default language blocks release', () => {
  const withoutText = [{ page_number: 1, localizations: [] }];
  const blank = [{ page_number: 1, localizations: [{ language: 'ar', body_text: '   ' }] }];
  const wrongLanguage = [{ page_number: 1, localizations: [{ language: 'en', body_text: 'Hello' }] }];

  for (const pages of [withoutText, blank, wrongLanguage]) {
    const error = storyPublishError(pages, 'picture_book', 'ar');
    assert.ok(error, 'a page without Arabic text must block release');
    assert.match(error, /needs text in ar/);
  }
});

test('a story releases once every page carries default-language text', () => {
  const pages = [
    { page_number: 1, localizations: [{ language: 'ar', body_text: 'صفحة أولى' }] },
    { page_number: 2, localizations: [{ language: 'ar', body_text: 'صفحة ثانية' }] },
  ];
  assert.equal(storyPublishError(pages, 'picture_book', 'ar'), null);
});

test('one empty page among many still blocks release and names the page', () => {
  const pages = [
    { page_number: 1, localizations: [{ language: 'ar', body_text: 'نص' }] },
    { page_number: 2, localizations: [{ language: 'ar', body_text: '' }] },
    { page_number: 3, localizations: [{ language: 'ar', body_text: 'نص' }] },
  ];
  const error = storyPublishError(pages, 'picture_book', 'ar');
  assert.ok(error);
  assert.match(error, /page 2/);
});

test('narration satisfies the text gate and audio stories additionally require it', () => {
  const narratedOnly = [{ page_number: 1, localizations: [{ language: 'ar', narration_asset_id: 'asset-1' }] }];
  assert.equal(storyPublishError(narratedOnly, 'picture_book', 'ar'), null);
  assert.equal(storyPublishError(narratedOnly, 'audio_story', 'ar'), null);

  const textOnly = [{ page_number: 1, localizations: [{ language: 'ar', body_text: 'نص' }] }];
  const error = storyPublishError(textOnly, 'audio_story', 'ar');
  assert.ok(error, 'an audio story with no narration must not release');
  assert.match(error, /narration/);
});

test('the story gate follows the story default language', () => {
  const englishPages = [{ page_number: 1, localizations: [{ language: 'en', body_text: 'Once upon a time' }] }];
  assert.equal(storyPublishError(englishPages, 'picture_book', 'en'), null);
  assert.ok(storyPublishError(englishPages, 'picture_book', 'ar'));
});

test('a game without a content pack cannot be released', () => {
  for (const pack of [undefined, null, {}, '{}', '', 'not json', [], '[]', 5]) {
    const error = gamePublishError(pack);
    assert.ok(error, `content_pack ${JSON.stringify(pack)} must block release`);
    assert.match(error, /content_pack/);
  }
});

test('a game with a populated content pack passes the gate, as an object or as stored JSON text', () => {
  assert.equal(gamePublishError({ rounds: [{ answer: 'أ' }] }), null);
  assert.equal(gamePublishError('{"rounds":[{"answer":"أ"}]}'), null);
});

test('a book needs at least one page and a project needs materials and steps', () => {
  assert.ok(bookPublishError('[]'));
  assert.ok(bookPublishError([]));
  assert.ok(bookPublishError(null));
  assert.equal(bookPublishError([{ image: 'a.png' }]), null);
  assert.equal(bookPublishError('[{"image":"a.png"}]'), null);

  assert.match(projectPublishError('[]', '["step"]'), /material/);
  assert.match(projectPublishError('["glue"]', '[]'), /step/);
  assert.equal(projectPublishError('["glue"]', '["cut"]'), null);
  assert.equal(projectPublishError(['glue'], ['cut']), null);
});

// Book languages -------------------------------------------------------------
// books.languages and books.default_language carry no CHECK constraint, so
// SQLite would happily store a default language the book does not ship. A
// reader asking for that language would then find no text at all.

test('a book language set must be a non-empty list of unique valid codes', () => {
  assert.equal(bookLanguagesError(['ar'], 'ar'), null);
  assert.equal(bookLanguagesError(['ar', 'en'], 'ar'), null);
  assert.equal(bookLanguagesError(['ar-SA', 'en-US'], 'en-US'), null);

  assert.match(bookLanguagesError([], 'ar'), /languages must contain/);
  assert.match(bookLanguagesError('ar', 'ar'), /languages must contain/);
  assert.match(bookLanguagesError(null, 'ar'), /languages must contain/);
  // Duplicates would be a silent data error rather than a caught one.
  assert.match(bookLanguagesError(['ar', 'ar'], 'ar'), /languages must contain/);
  assert.match(bookLanguagesError(['ar', ''], 'ar'), /languages must contain/);
});

test('a malformed language code in a book language set is named in the error', () => {
  const error = bookLanguagesError(['ar', 'arabic-language'], 'ar');
  assert.ok(error);
  assert.match(error, /Invalid language code/);
  assert.match(error, /arabic-language/);
  assert.match(bookLanguagesError(['ar_SA'], 'ar_SA'), /Invalid language code/);
});

test('a book default_language must be present in its language list', () => {
  const error = bookLanguagesError(['ar', 'en'], 'fr');
  assert.ok(error);
  assert.match(error, /default_language must be one of languages/);
  assert.equal(bookLanguagesError(['ar', 'en'], 'en'), null);
});

test('a book default_language must itself be a valid, non-empty code', () => {
  assert.match(bookLanguagesError(['ar'], ''), /Invalid default_language/);
  assert.match(bookLanguagesError(['ar'], '   '), /Invalid default_language/);
  assert.match(bookLanguagesError(['ar'], null), /Invalid default_language/);
  assert.match(bookLanguagesError(['ar'], 12), /Invalid default_language/);
  assert.match(bookLanguagesError(['ar'], 'not_a_code'), /Invalid default_language/);
});

// Engine ids -----------------------------------------------------------------

test('an unknown engine_id is rejected before it reaches the foreign key', () => {
  const engines = ['engine_match', 'engine_sort'];
  assert.equal(engineIdError('engine_match', engines), null);

  const unknown = engineIdError('engine_ghost', engines);
  assert.ok(unknown);
  assert.match(unknown, /Game engine not found/);
  assert.match(unknown, /engine_ghost/);

  assert.match(engineIdError(null, engines), /engine_id is required/);
  assert.match(engineIdError('', engines), /engine_id is required/);
  assert.match(engineIdError('   ', engines), /engine_id is required/);
  assert.ok(engineIdError('engine_match', []), 'no engines configured means nothing validates');
});

// Learning objectives --------------------------------------------------------

test('a learning objective requires a code and a title', () => {
  assert.match(objectiveCreatePayload({ title_ar: 'هدف', age_min: 6, age_max: 8 }).error, /code/);
  assert.match(objectiveCreatePayload({ code: 'LO-1', age_min: 6, age_max: 8 }).error, /title_ar/);
});

test('a learning objective rejects an out-of-range age span', () => {
  assert.match(
    objectiveCreatePayload({ code: 'LO-1', title_ar: 'هدف', age_min: 2, age_max: 8 }).error,
    /3-12/,
  );
  assert.match(
    objectiveCreatePayload({ code: 'LO-1', title_ar: 'هدف', age_min: 9, age_max: 4 }).error,
    /age_max/,
  );
});

test('a learning objective derives its track rows from its age range', () => {
  const result = objectiveCreatePayload({ code: 'LO-1', title_ar: 'هدف', age_min: 5, age_max: 9 });
  assert.ok('payload' in result);
  assert.deepEqual(result.payload.tracks, ['preschool', 'kids', 'junior']);
  assert.equal(result.payload.ageMin, 5);
  assert.equal(result.payload.ageMax, 9);
  assert.equal(result.payload.skillId, null);

  const narrow = objectiveCreatePayload({ code: 'LO-2', title_ar: 'هدف', age_min: 6, age_max: 8 });
  assert.ok('payload' in narrow);
  assert.deepEqual(narrow.payload.tracks, ['kids']);
});

test('a learning objective honours an explicit track list within the straddle rule', () => {
  const ok = objectiveCreatePayload({
    code: 'LO-3', title_ar: 'هدف', age_min: 5, age_max: 6, track_ids: ['kids'],
  });
  assert.ok('payload' in ok);
  assert.deepEqual(ok.payload.tracks, ['kids']);

  const bad = objectiveCreatePayload({
    code: 'LO-4', title_ar: 'هدف', age_min: 3, age_max: 5, track_ids: ['junior'],
  });
  assert.match(bad.error, /track_ids do not match/);
});

test('learning objective nullable fields must be text or null', () => {
  assert.match(
    objectiveCreatePayload({ code: 'LO-5', title_ar: 'هدف', age_min: 6, age_max: 8, description_ar: 12 }).error,
    /description_ar/,
  );
  const cleared = objectiveCreatePayload({
    code: 'LO-6', title_ar: 'هدف', age_min: 6, age_max: 8, description_ar: null, skill_id: '',
  });
  assert.ok('payload' in cleared);
  assert.equal(cleared.payload.descriptionAr, null);
  assert.equal(cleared.payload.skillId, null);
});

// Content reviews ------------------------------------------------------------

test('a review rejects an unknown entity type, reviewer role or status', () => {
  assert.match(
    reviewCreatePayload({ entity_type: 'planet', entity_id: 'x', reviewer_role: 'edu', status: 'approved' }).error,
    /Invalid entity_type/,
  );
  assert.match(
    reviewCreatePayload({ entity_type: 'episode', entity_id: 'x', reviewer_role: 'legal', status: 'approved' }).error,
    /Invalid reviewer_role/,
  );
  assert.match(
    reviewCreatePayload({ entity_type: 'episode', entity_id: 'x', reviewer_role: 'edu', status: 'maybe' }).error,
    /Invalid status/,
  );
  assert.match(
    reviewCreatePayload({ entity_type: 'episode', reviewer_role: 'edu', status: 'approved' }).error,
    /entity_id/,
  );
});

test('a reviewer can record approved, rejected and needs_changes', () => {
  const approved = reviewCreatePayload({
    entity_type: 'episode', entity_id: 'ep-1', reviewer_role: 'edu', status: 'approved',
  });
  assert.ok('payload' in approved);
  assert.equal(approved.payload.status, 'approved');
  assert.equal(approved.payload.comments, null);

  for (const status of ['rejected', 'needs_changes']) {
    const withReason = reviewCreatePayload({
      entity_type: 'game', entity_id: 'game-1', reviewer_role: 'qa', status, comments: 'يحتاج تبسيط',
    });
    assert.ok('payload' in withReason, `${status} with comments must be accepted`);
    assert.equal(withReason.payload.status, status);

    const withoutReason = reviewCreatePayload({
      entity_type: 'game', entity_id: 'game-1', reviewer_role: 'qa', status,
    });
    assert.match(withoutReason.error, /comments are required/);
  }
});

test('a review defaults to pending when no status is supplied', () => {
  const result = reviewCreatePayload({ entity_type: 'book', entity_id: 'book-1', reviewer_role: 'lang' });
  assert.ok('payload' in result);
  assert.equal(result.payload.status, 'pending');
});

// Pagination and small helpers ----------------------------------------------

test('pagination clamps the page size and floors the offset', () => {
  assert.deepEqual(parsePagination(undefined, undefined), { limit: 20, offset: 0 });
  assert.deepEqual(parsePagination('50', '100'), { limit: 50, offset: 100 });
  assert.deepEqual(parsePagination('5000', '0'), { limit: 100, offset: 0 });
  assert.deepEqual(parsePagination('0', '-10'), { limit: 1, offset: 0 });
  assert.deepEqual(parsePagination('abc', 'abc'), { limit: 20, offset: 0 });
});

test('a caller may raise the ceiling for a list that was previously unbounded', () => {
  // Bounding an endpoint at 20 for the first time hides rows the dashboard
  // already renders, and silent truncation looks like data loss rather than a
  // page size. These endpoints opt into a generous default instead.
  const options = { defaultLimit: 200, maxLimit: 500 };
  assert.deepEqual(parsePagination(undefined, undefined, options), { limit: 200, offset: 0 });
  assert.deepEqual(parsePagination('400', '0', options), { limit: 400, offset: 0 });
  // The ceiling still holds: an explicit request cannot exceed maxLimit.
  assert.deepEqual(parsePagination('9999', '0', options), { limit: 500, offset: 0 });
  assert.deepEqual(parsePagination('abc', undefined, options), { limit: 200, offset: 0 });
  // Defaults are unchanged when no options are passed, so existing callers keep
  // their behaviour.
  assert.deepEqual(parsePagination(undefined, undefined), { limit: 20, offset: 0 });
});

test('language codes are validated before they key a localization row', () => {
  for (const code of ['ar', 'en', 'ar-SA', 'en-US']) assert.equal(isValidLanguage(code), true, code);
  for (const code of ['', 'A', 'arabic-language', '../ar', 'ar_SA', 12, null]) {
    assert.equal(isValidLanguage(code), false, String(code));
  }
});

test('objective id lists reject duplicates and blanks', () => {
  assert.deepEqual(uniqueStringArray(['a', 'b']), ['a', 'b']);
  assert.equal(uniqueStringArray(['a', 'a']), null);
  assert.equal(uniqueStringArray(['a', '']), null);
  assert.equal(uniqueStringArray('a'), null);
});
