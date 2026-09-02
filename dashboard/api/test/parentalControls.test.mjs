import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { FamilyState } from '../src/do/FamilyState.ts';
import { bedtimeCovers, loadScreenTimePolicy } from '../src/lib/parentalControls.ts';

/// فرض حدود ولي الأمر على التشغيل.
///
/// ## لماذا هذا الملف
///
/// `routes/childSettings.ts` كان يكتب `daily_minutes` و`max_session_minutes`
/// و`bedtime_start/end` بتحقق دقيق، ولا يقرؤها أي مسار تشغيل: البحث عن
/// `child_settings` في كل `src/` لم يكن يعطي نتيجة خارج ذلك الملف، وجدول
/// `child_screen_time_daily` كان بلا كاتب. أي أن شاشة الإعدادات كانت وعدًا
/// لولي الأمر بلا فرض.
///
/// كل توكيد هنا يقابل قرارًا يمكن أن ينحدر صامتًا: نافذة نوم تعبر منتصف الليل،
/// نبضة متأخرة تحرق الحدّ اليومي، عقد يبقى صالحًا بعد نهاية الوقت، وسياسة تُقرأ
/// من معرّف طفل يرسله العميل.

/* ------------------------------------------------------- نافذة النوم (دالة نقية) */

test('a bedtime window that crosses midnight covers both sides of it', () => {
  const at = (h, m = 0) => h * 60 + m;
  const start = at(20);
  const end = at(7);

  assert.equal(bedtimeCovers(at(21), start, end), true, '21:00 داخل النافذة');
  assert.equal(bedtimeCovers(at(2), start, end), true, '02:00 داخل النافذة');
  assert.equal(bedtimeCovers(at(6, 59), start, end), true, '06:59 داخل النافذة');
  assert.equal(bedtimeCovers(at(7), start, end), false, 'النهاية غير داخلة');
  assert.equal(bedtimeCovers(at(19, 59), start, end), false, 'قبل البداية');
});

test('a same-day window is a plain range', () => {
  const start = 13 * 60;
  const end = 15 * 60;
  assert.equal(bedtimeCovers(14 * 60, start, end), true);
  assert.equal(bedtimeCovers(12 * 60, start, end), false);
  assert.equal(bedtimeCovers(15 * 60, start, end), false);
});

test('a window whose ends are equal is disabled, not a 24-hour block', () => {
  // إعداد يبدو بريئًا (`22:00` → `22:00`) كان سيقفل التطبيق أربعًا وعشرين ساعة لو
  // فُسِّر كنافذة كاملة.
  for (const minute of [0, 8 * 60, 22 * 60, 23 * 60 + 59]) {
    assert.equal(bedtimeCovers(minute, 22 * 60, 22 * 60), false);
  }
});

/* ------------------------------------------------------------- قراءة السياسة */

/// D1 مُصغَّر: يعيد صفًا لكل استعلام حسب الجدول المذكور فيه.
function fakeDb({ settings = null, timezone = 'Africa/Cairo' } = {}) {
  return {
    prepare(sql) {
      const row = sql.includes('child_settings') ? settings : { timezone };
      return {
        bind() { return this; },
        async first() { return row; },
        async all() { return { results: row ? [row] : [] }; },
      };
    },
  };
}

test('a missing settings row applies the schema default rather than "no limit"', async () => {
  // الصف الغائب يعني أن ولي الأمر لم يفتح الإعدادات. `GET /child-settings/:id`
  // يُنشئ الصف بـ`daily_minutes = 30` (افتراضي المخطط)، فالفرض يطابق ما تعرضه
  // الشاشة. اعتبار الغياب «بلا حدّ» كان سيجعل الحماية اختيارية بالصمت.
  const policy = await loadScreenTimePolicy({ DB: fakeDb() }, 'parent_1', 'child_1');
  assert.equal(policy.dailyMinutes, 30);
  assert.equal(policy.maxSessionMinutes, null);
  assert.equal(policy.bedtimeActive, false);
  assert.equal(policy.bedtime, null);
});

test('the policy reads the parent timezone and computes the local date', async () => {
  const policy = await loadScreenTimePolicy(
    { DB: fakeDb({ timezone: 'Asia/Tokyo' }) },
    'parent_1',
    'child_1',
    // 2026-03-01T22:30:00Z هو 2026-03-02 في طوكيو: التاريخ المحلي هو مفتاح
    // الاحتساب اليومي، فاستخدام يوم UTC كان سيُصفّر الرصيد في منتصف مساء الطفل.
    new Date('2026-03-01T22:30:00Z'),
  );
  assert.equal(policy.timezone, 'Asia/Tokyo');
  assert.equal(policy.localDate, '2026-03-02');
});

test('an unknown timezone falls back instead of refusing playback', async () => {
  // حقل إعدادات تالف لا يجوز أن يمنع الطفل من المشاهدة؛ هذه عقوبة لا حماية.
  const policy = await loadScreenTimePolicy(
    { DB: fakeDb({ timezone: 'Mars/Olympus' }) },
    'parent_1',
    'child_1',
    new Date('2026-03-01T12:00:00Z'),
  );
  assert.match(policy.localDate, /^\d{4}-\d{2}-\d{2}$/);
});

test('bedtime is active when the local clock is inside the window', async () => {
  const settings = {
    daily_minutes: 60,
    max_session_minutes: 20,
    bedtime_start: '20:00',
    bedtime_end: '07:00',
  };
  const db = fakeDb({ settings, timezone: 'Africa/Cairo' });
  // 21:00 في القاهرة (UTC+2 شتاءً).
  const inside = await loadScreenTimePolicy({ DB: db }, 'p', 'c', new Date('2026-01-10T19:00:00Z'));
  assert.equal(inside.bedtimeActive, true);
  assert.deepEqual(inside.bedtime, { start: '20:00', end: '07:00' });
  assert.equal(inside.maxSessionMinutes, 20);

  // 15:00 في القاهرة.
  const outside = await loadScreenTimePolicy({ DB: db }, 'p', 'c', new Date('2026-01-10T13:00:00Z'));
  assert.equal(outside.bedtimeActive, false);
});

/* --------------------------------------------------------- الفرض داخل الكائن */

function sqlStorage(db) {
  return {
    exec(sql, ...params) {
      if (params.length === 0 && /;\s*\S/.test(sql)) {
        db.exec(sql);
        return { toArray: () => [] };
      }
      const statement = db.prepare(sql);
      const rows = statement.all(...params);
      return { toArray: () => rows };
    },
  };
}

function durableState(db) {
  const state = {
    alarms: [],
    storage: {
      sql: sqlStorage(db),
      transactionSync(fn) {
        db.exec('BEGIN');
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      async setAlarm(at) { state.alarms.push(at); },
      async getAlarm() { return state.alarms.length ? state.alarms[state.alarms.length - 1] : null; },
    },
  };
  return state;
}

const post = (path, body) => new Request(`https://do.local${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

async function call(object, request) {
  const response = await object.fetch(request);
  return { status: response.status, body: await response.json().catch(() => null) };
}

/// أسرة بجلسة نشطة وطفل واحد، مع سياسة يحدّدها الاختبار.
async function seededFamily(settings) {
  const db = new DatabaseSync(':memory:');
  const state = durableState(db);
  const object = new FamilyState(state, {
    DB: fakeDb({ settings }),
    FAMILY_EVENTS: { async sendBatch() {} },
  });

  await call(object, post('/initialize', {
    parent_id: 'parent_00000001',
    display_name: 'أسرة تجربة',
    identity_epoch: 1,
  }));
  await call(object, post('/sessions/create', {
    session_id: 'session-1',
    refresh_token_hash: 'hash-1',
    installation_id_hash: 'install-1',
    platform: 'android',
    device_name: 'هاتف',
    expires_at: Date.now() + 30 * 24 * 60 * 60 * 1000,
  }));
  const child = await call(object, post('/children', {
    session_id: 'session-1',
    nickname: 'سلمى',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
  }));
  assert.equal(child.status, 201, `child creation failed: ${JSON.stringify(child.body)}`);

  return { object, state, db, childId: child.body.data.id };
}

const startPlayback = (object, childId) => call(object, post('/playback/start', {
  session_id: 'session-1',
  child_id: childId,
  asset_id: 'asset-1',
  entity_type: 'episode',
  entity_id: 'episode-1',
  required_plan: 'free',
  allowed_tracks: ['preschool', 'kids', 'junior'],
}));

const heartbeat = (object, leaseId) => call(object, post('/playback/heartbeat', {
  session_id: 'session-1',
  lease_id: leaseId,
  required_plan: 'free',
  allowed_tracks: ['preschool', 'kids', 'junior'],
}));

test('bedtime refuses a new lease with a code the client can act on', async () => {
  // نافذة تغطّي كل ساعة إلا واحدة، فالاختبار لا يعتمد على وقت التشغيل.
  const { object, childId, db } = await seededFamily({
    daily_minutes: 60,
    max_session_minutes: null,
    bedtime_start: '00:00',
    bedtime_end: '23:59',
  });

  const refused = await startPlayback(object, childId);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'screen_time_bedtime');
  // ولا عقد يُنشأ: إنشاؤه ثم سحبه في النبضة التالية يعني دقائق مشاهدة في وقت النوم.
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM playback_leases').all()[0].c, 0);
});

test('an exhausted daily budget refuses a new lease', async () => {
  const { object, childId, db } = await seededFamily({
    daily_minutes: 30,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });

  const first = await startPlayback(object, childId);
  assert.equal(first.status, 201, JSON.stringify(first.body));
  await call(object, post('/playback/end', { session_id: 'session-1', lease_id: first.body.data.lease_id }));

  // استهلاك الرصيد كما تفعله النبضة، بالكتابة في نفس الجدول الذي يقرؤه الفرض.
  const localDate = (await loadScreenTimePolicy({ DB: fakeDb() }, 'p', childId)).localDate;
  db.prepare(`
    INSERT INTO screen_time_daily (child_id, activity_date, watched_seconds, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(childId, localDate, 30 * 60, Date.now());

  const refused = await startPlayback(object, childId);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'screen_time_daily_limit');
});

test('a heartbeat credits elapsed time and the first lease is capped by the remaining budget', async () => {
  const { object, childId, db } = await seededFamily({
    daily_minutes: 5, // خمس دقائق: الرصيد المتبقي أصغر من سقف العقد (15 دقيقة)
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });

  const started = await startPlayback(object, childId);
  assert.equal(started.status, 201);

  // العقد لا يجوز أن يبقى صالحًا بعد نهاية الرصيد: لو بقي خمس عشرة دقيقة لكسب
  // الطفل جلسة كاملة بعد انتهاء وقته لأن النبضة التالية تأتي بعد فوات الأوان.
  const ttl = started.body.data.expires_at - Date.now();
  assert.ok(ttl <= 5 * 60 * 1000 + 1000, `lease ttl was ${ttl}ms`);

  // نبضة بعد فارق مصطنع: نُرجع آخر نبضة دقيقتين للخلف ثم ننبض.
  db.prepare('UPDATE playback_leases SET last_heartbeat_at = ? WHERE id = ?')
    .run(Date.now() - 2 * 60 * 1000, started.body.data.lease_id);

  const beat = await heartbeat(object, started.body.data.lease_id);
  assert.equal(beat.status, 200);

  const credited = db.prepare('SELECT watched_seconds FROM screen_time_daily WHERE child_id = ?')
    .all(childId)[0]?.watched_seconds ?? 0;
  assert.ok(credited >= 115 && credited <= 125, `credited ${credited}s for a two-minute gap`);
});

test('a late heartbeat cannot burn the whole daily budget', async () => {
  const { object, childId, db } = await seededFamily({
    daily_minutes: 60,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });
  const started = await startPlayback(object, childId);

  // جهاز نام ساعتين. الفارق ليس مشاهدة، والاحتساب مقصوص عند خمس دقائق.
  db.prepare('UPDATE playback_leases SET last_heartbeat_at = ? WHERE id = ?')
    .run(Date.now() - 2 * 60 * 60 * 1000, started.body.data.lease_id);

  await heartbeat(object, started.body.data.lease_id);

  const credited = db.prepare('SELECT watched_seconds FROM screen_time_daily WHERE child_id = ?')
    .all(childId)[0]?.watched_seconds ?? 0;
  assert.equal(credited, 5 * 60, 'the credit is clamped to one heartbeat window');
});

test('the session-length limit revokes the lease on the next heartbeat', async () => {
  const { object, childId, db } = await seededFamily({
    daily_minutes: 180,
    max_session_minutes: 5,
    bedtime_start: null,
    bedtime_end: null,
  });
  const started = await startPlayback(object, childId);
  assert.equal(started.status, 201);

  // جلسة عمرها ست دقائق: أقدم من الحدّ.
  db.prepare('UPDATE playback_leases SET created_at = ?, last_heartbeat_at = ? WHERE id = ?')
    .run(Date.now() - 6 * 60 * 1000, Date.now() - 30 * 1000, started.body.data.lease_id);

  const beat = await heartbeat(object, started.body.data.lease_id);
  assert.equal(beat.status, 403);
  assert.equal(beat.body.code, 'screen_time_session_limit');
  assert.equal(
    db.prepare(`SELECT status FROM playback_leases WHERE id = ?`).all(started.body.data.lease_id)[0].status,
    'revoked',
    'a refusal that leaves the lease active would let the client keep streaming',
  );
});

test('time already watched is credited even when the same heartbeat refuses', async () => {
  // بلا هذا لصارت آخر فترة قبل كل رفض مجانية، فيتعلّم العميل أن يتجاهل الرفض.
  const { object, childId, db } = await seededFamily({
    daily_minutes: 180,
    max_session_minutes: 5,
    bedtime_start: null,
    bedtime_end: null,
  });
  const started = await startPlayback(object, childId);
  db.prepare('UPDATE playback_leases SET created_at = ?, last_heartbeat_at = ? WHERE id = ?')
    .run(Date.now() - 6 * 60 * 1000, Date.now() - 90 * 1000, started.body.data.lease_id);

  await heartbeat(object, started.body.data.lease_id);

  const credited = db.prepare('SELECT watched_seconds FROM screen_time_daily WHERE child_id = ?')
    .all(childId)[0]?.watched_seconds ?? 0;
  assert.ok(credited >= 85, `credited ${credited}s before refusing`);
});
