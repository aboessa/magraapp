import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ISLAMIC_PLANET_IDS,
  isIslamicContent,
  validateIslamicFields,
} from '../src/lib/islamicContent.ts';

const APPROVED = {
  source_type: 'sira',
  religious_reviewer_id: 'reviewer-1',
  religious_approved_at: '2026-08-07T00:00:00.000Z',
};

test('the seeded planet id islamic triggers the religious gate', () => {
  // The regression: this used to compare against 'iman' only, so the seeded
  // 'islamic' planet bypassed review entirely. Verified against D1, whose
  // planets are abjad, alam, arqam, islamic, maharat, oloom, qisas, qiyam,
  // tarikh - there is no 'iman' row.
  assert.equal(isIslamicContent('islamic', null), true);
});

test('the legacy iman alias still triggers the gate', () => {
  assert.equal(isIslamicContent('iman', null), true);
  assert.deepEqual([...ISLAMIC_PLANET_IDS], ['islamic', 'iman']);
});

test('non-Islamic planets do not trigger the gate', () => {
  for (const planet of ['abjad', 'alam', 'arqam', 'maharat', 'oloom', 'qisas', 'qiyam', 'tarikh']) {
    assert.equal(isIslamicContent(planet, null), false, `${planet} must not require review`);
  }
  assert.equal(isIslamicContent(null, null), false);
});

test('scriptural source types require review on any planet', () => {
  for (const sourceType of ['quran', 'hadith', 'sira']) {
    assert.equal(isIslamicContent('oloom', sourceType), true);
  }
  assert.equal(isIslamicContent('oloom', 'adab'), false);
});

test('islamic content cannot publish without a source type', () => {
  const error = validateIslamicFields({}, 'islamic');
  assert.ok(error, 'publishing islamic content without source_type must fail');
  assert.match(error, /source_type/);
});

test('islamic content cannot publish without a reviewer', () => {
  const error = validateIslamicFields({ source_type: 'sira' }, 'islamic');
  assert.ok(error);
  assert.match(error, /religious_reviewer_id/);
});

test('islamic content cannot publish without an approval timestamp', () => {
  const error = validateIslamicFields(
    { source_type: 'sira', religious_reviewer_id: 'reviewer-1' },
    'islamic',
  );
  assert.ok(error);
  assert.match(error, /religious_approved_at/);
});

test('quran content requires surah and ayah', () => {
  const missing = validateIslamicFields({ ...APPROVED, source_type: 'quran' }, 'islamic');
  assert.ok(missing);
  assert.match(missing, /verse_surah/);
  const complete = validateIslamicFields(
    { ...APPROVED, source_type: 'quran', verse_surah: 1, verse_ayah: 1 },
    'islamic',
  );
  assert.equal(complete, null);
});

test('hadith content requires collection and number', () => {
  const missing = validateIslamicFields({ ...APPROVED, source_type: 'hadith' }, 'islamic');
  assert.ok(missing);
  assert.match(missing, /hadith_collection/);
  const complete = validateIslamicFields(
    { ...APPROVED, source_type: 'hadith', hadith_collection: 'bukhari', hadith_number: 1 },
    'islamic',
  );
  assert.equal(complete, null);
});

test('fully reviewed islamic content passes the gate', () => {
  assert.equal(validateIslamicFields(APPROVED, 'islamic'), null);
});

test('non-Islamic content is not asked for religious fields', () => {
  assert.equal(validateIslamicFields({}, 'abjad'), null);
  assert.equal(validateIslamicFields({}, null), null);
});
