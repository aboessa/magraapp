/**
 * Runtime verification of the Islamic religious-review publishing gate.
 *
 * Non-mutating by design. Every case below is expected to be REJECTED with 400
 * before `db.batch` runs (see routes/admin.ts: the gate returns early), so the
 * target series must still be `draft` afterwards. The caller checks that.
 *
 * Usage: node scripts/verify-islamic-gate.mjs [baseUrl] [seriesId]
 */

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787';
const SERIES = process.argv[3] ?? 'series-faith-kids-quran';

const cases = [
  {
    name: 'publish with no religious fields at all',
    body: { status: 'published' },
    expectContains: 'source_type',
  },
  {
    name: 'publish as quran without surah/ayah',
    body: { status: 'published', source_type: 'quran' },
    expectContains: 'verse_surah',
  },
  {
    name: 'publish as quran with surah/ayah but no reviewer',
    body: { status: 'published', source_type: 'quran', verse_surah: 1, verse_ayah: 1 },
    expectContains: 'religious_reviewer_id',
  },
  {
    name: 'publish with reviewer but no approval timestamp',
    body: {
      status: 'published',
      source_type: 'quran',
      verse_surah: 1,
      verse_ayah: 1,
      religious_reviewer_id: 'reviewer-runtime-probe',
    },
    expectContains: 'religious_approved_at',
  },
  {
    name: 'publish as hadith without collection/number',
    body: { status: 'published', source_type: 'hadith' },
    expectContains: 'hadith_collection',
  },
];

let pass = 0;
let fail = 0;

for (const test of cases) {
  let status = 0;
  let payload = '';
  try {
    const res = await fetch(`${BASE}/api/v1/admin/series/${SERIES}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(test.body),
    });
    status = res.status;
    payload = await res.text();
  } catch (error) {
    console.log(`FAIL  ${test.name} -> transport error: ${error.message}`);
    fail += 1;
    continue;
  }

  const rejected = status === 400;
  const matched = payload.includes(test.expectContains);
  if (rejected && matched) {
    console.log(`PASS  ${test.name} -> 400 ${payload}`);
    pass += 1;
  } else {
    console.log(`FAIL  ${test.name} -> ${status} ${payload} (wanted 400 containing "${test.expectContains}")`);
    fail += 1;
  }
}

console.log(`\ngate cases: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
