import test from 'node:test';
import assert from 'node:assert/strict';
import { ENGINES_WITHOUT_MASTERY } from '../src/lib/engineContracts.ts';

/**
 * `CNT-109` — «لماذا لا دليل لهذا الهدف؟» يُقاس ولا يُوصَف.
 *
 * ## العطل
 *
 * تبويب التشخيص في `MasteryPage` كان يكتب **عناوين أعمدته مكان قيمها**: ثلاث عبارات
 * ثابتة تتكرّر في كل صفّ من السبعة والخمسين. فالتبويب الذي يوجد ليجيب عن سبب غياب
 * الدليل كان يجيب بما **يشبه** الجواب ولا يقيس شيئًا — وأسوأ من الخلية الفارغة، لأن
 * القارئ يستنتج أن لكل هدفٍ محتوًى مرتبطًا وألعابًا قادرة، وهو عكس ما يُكشَف.
 *
 * ## ما تحرسه هذه المجموعة
 *
 * أن الأعداد تُقاس من قاعدة البيانات، وأن «قادرة على توليد دليل» **ليست** عدد
 * الألعاب المرتبطة: محرّكٌ لا يكتب إتقانًا لا يُنتج دليلًا أبدًا، فلعبةٌ عليه مرتبطةٌ
 * بهدفٍ هي خطأ ربط لا مصدر قياس. وأن المَعلَمات تُربَط بترتيب ظهورها في النصّ —
 * وخلطُ الترتيب هنا لا يُنتج خطأً بل **أرقامًا خاطئة**، وهي أسوأ الأعطال.
 */

function fakeDb({ answers = {}, recorder } = {}) {
  const rowsFor = (sql) => {
    for (const [needle, value] of Object.entries(answers)) {
      if (sql.includes(needle)) return value;
    }
    return null;
  };
  const statement = (sql, params = []) => ({
    bind(...next) { return statement(sql, next); },
    async first() { const r = rowsFor(sql); return Array.isArray(r) ? (r[0] ?? null) : r; },
    async all() {
      if (recorder) recorder.push({ sql, params });
      const r = rowsFor(sql);
      return { results: Array.isArray(r) ? r : (r ? [r] : []) };
    },
    async run() { return { meta: { changes: 1 } }; },
  });
  return { prepare: (sql) => statement(sql) };
}

async function byObjective(db) {
  const { default: route } = await import('../src/routes/adminMastery.ts');
  const env = { DB: db, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined };
  const response = await route.request('/mastery/by-objective', {}, env);
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null };
}

test('the engines that cannot produce evidence are declared, not guessed', () => {
  // الاختبار يقرأ نفس المصدر الذي تقرأه النقطة، فلا يصير قائمةً ثانية تتباعد.
  assert.ok(ENGINES_WITHOUT_MASTERY.length > 0, 'the contract list must not be empty');
  assert.ok(ENGINES_WITHOUT_MASTERY.includes('rhythm_tap'));
});

test('each objective carries measured counts, not repeated labels', async () => {
  const { status, data } = await byObjective(fakeDb({
    answers: {
      'FROM learning_objectives lo': [{
        id: 'obj-1', code: 'math.count', title_ar: 'العدّ', skill_id: 'sk-1',
        linked_episodes: 2, linked_games: 3, questions_count: 0, evidence_capable_games: 1,
        children_count: 0, independent_count: 0, needs_review_count: 0, not_started_count: 0,
        attempts: 0, correct_attempts: 0, last_attempt_at: null,
      }],
    },
  }));
  assert.equal(status, 200);
  const row = data[0];
  assert.equal(row.linked_episodes, 2);
  assert.equal(row.linked_games, 3);
  assert.equal(row.questions_count, 0);
  assert.equal(row.evidence_capable_games, 1, 'three linked games, one of which can produce evidence');
  // ولا محاولات: النسبة `null` لا صفر — «لا بيانات» ليست «نسبة نجاح صفر».
  assert.equal(row.success_rate, null);
});

test('the capable-games count excludes engines that never write mastery', async () => {
  const recorder = [];
  await byObjective(fakeDb({ recorder }));
  const listing = recorder.find((entry) => entry.sql.includes('FROM learning_objectives lo'));
  assert.ok(listing, 'the objective listing query was never issued');
  assert.match(listing.sql, /evidence_capable_games/);
  assert.match(listing.sql, /engine_id NOT IN/);
  // المَعلَمات: قائمة المحرّكات أوّلًا لأن `?` الخاصة بها تظهر في `SELECT` قبل
  // `WHERE`. لو انقلب الترتيب لعمل الاستعلام وأعاد أرقامًا خاطئة بصمت.
  assert.deepEqual(
    listing.params.slice(0, ENGINES_WITHOUT_MASTERY.length),
    [...ENGINES_WITHOUT_MASTERY],
  );
});

test('an objective linked only to games that cannot measure reports zero capable', async () => {
  // هذه هي الحالة التي يخطئ فيها عدُّ الألعاب المرتبطة: ثلاث ألعاب وصفر قياس.
  const { data } = await byObjective(fakeDb({
    answers: {
      'FROM learning_objectives lo': [{
        id: 'obj-2', code: 'music.beat', title_ar: 'الإيقاع', skill_id: null,
        linked_episodes: 0, linked_games: 3, questions_count: 0, evidence_capable_games: 0,
        children_count: 0, attempts: 0, correct_attempts: 0,
      }],
    },
  }));
  assert.equal(data[0].linked_games, 3);
  assert.equal(data[0].evidence_capable_games, 0);
});
