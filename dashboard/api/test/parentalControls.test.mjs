import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

test('a child with no configured control is under no limit at all', async () => {
  /// ## قرار المالك (2026-09-23، `DECIDE-108`)
  ///
  /// «لا وقت نوم وكدا، لازم ولي الأمر يفعّل الموضوع ده.» فالغياب يعني **لم
  /// يفعّله ولي الأمر**، لا «طبّق الافتراض».
  ///
  /// وهذا التوكيد كان معكوسًا: كان يثبّت `dailyMinutes === 30` بحجّة مطابقة ما
  /// تعرضه الشاشة. والحجّة متماسكة داخليًّا وخاطئة في نتيجتها — `GET
  /// /child-settings/:id` يُدرج الصفّ بالافتراضات لمجرّد **فتح الشاشة**، و`PUT`
  /// لم يقبل `null`، و`Slider` يبدأ من 5. فكان ولي الأمر يُمنَح حدًّا لم يطلبه ثم
  /// لا يملك إلغاءه، ويُفرَض على الفيديو فعلًا في `startPlayback`.
  const policy = await loadScreenTimePolicy({ DB: fakeDb() }, 'parent_1', 'child_1');
  assert.equal(policy.dailyMinutes, null, 'an unset daily limit must not be enforced');
  assert.equal(policy.maxSessionMinutes, null);
  assert.equal(policy.bedtimeActive, false);
  assert.equal(policy.bedtime, null);
});

test('an explicit daily limit is still enforced once the parent sets one', async () => {
  // القرار «اختياري» لا «مُعطَّل»: ما يضبطه ولي الأمر يسري كاملًا.
  const policy = await loadScreenTimePolicy(
    {
      DB: fakeDb({
        settings: {
          daily_minutes: 45,
          max_session_minutes: null,
          bedtime_start: null,
          bedtime_end: null,
        },
      }),
    },
    'parent_1',
    'child_1',
  );
  assert.equal(policy.dailyMinutes, 45);
});

test('the schema can represent "no daily limit", not only the lib', async () => {
  /// ## لماذا يُفحَص المخطَّط لا الدالّة وحدها
  ///
  /// قبل `0093` كان العمود `NOT NULL DEFAULT 30 CHECK (BETWEEN 5 AND 180)` —
  /// ثلاثة قيود تجعل «لا حدّ» **غير قابل للتمثيل في القاعدة**. فدالّةٌ تُرجع
  /// `null` فوق مخطَّطٍ يرفض `null` تمرّ في الاختبار وتفشل عند أوّل كتابة حقيقية.
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0093_daily_limit_opt_in.sql', import.meta.url)),
    'utf8',
  );
  assert.match(
    migration,
    /daily_minutes INTEGER CHECK \(daily_minutes IS NULL OR daily_minutes BETWEEN 5 AND 180\)/,
    'daily_minutes must be nullable with no default',
  );
  assert.doesNotMatch(
    migration.split('child_settings_pre_0093')[1] ?? migration,
    /daily_minutes INTEGER NOT NULL/,
    'the rebuilt table must not reintroduce NOT NULL',
  );
  // والصفوف تُنقل لا تُصفَّر: صفٌّ يحمل 30 لا يُفرَّق عن صفٍّ اختاره ولي أمره.
  assert.match(migration, /INSERT INTO child_settings \([\s\S]*?\)\s*SELECT/);

  // ومسار الكتابة يقبل الإلغاء، وإلّا بقي الحدّ يُضبَط ولا يُلغى.
  const settingsRoute = readFileSync(
    fileURLToPath(new URL('../src/routes/childSettings.ts', import.meta.url)),
    'utf8',
  );
  assert.match(
    settingsRoute,
    /daily_minutes: integer\(\{ min: 5, max: 180, optional: true, nullable: true \}\)/,
    'PUT must accept daily_minutes: null so a parent can switch the limit off',
  );
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

/// `API-201`: بوابة الوقت لأسطح بلا عقد تشغيل (السرد الصوتي).
const checkScreenTime = (object, childId) => call(object, post('/screen-time/check', {
  session_id: 'session-1',
  child_id: childId,
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

/* --------------------------------- `API-201`: السرد الصوتي تحت نفس الحدود */

/// ## العطل الذي تحرس منه هذه المجموعة
///
/// `books.ts` و`stories.ts` يمنحان توكن وسائط للسرد **بلا عقد تشغيل**، وذلك
/// قرارٌ صحيح: العقد وُجد لسقف التزامن، والسقف مقصورٌ على الفيديو في الخطة، فعدّ
/// حكايةٍ قبل النوم عليه كان سيمنع أبًا يقرأ لطفل بينما يشاهد آخر.
///
/// لكن ترك العقد ترك معه **وقت النوم والحدّ اليومي**، وهما ليسا تزامنًا. فكان
/// طفلٌ يُرفَض له الفيديو في التاسعة مساءً يحصل على الكتب المسموعة في التاسعة
/// مساءً — والرقابة التي يضبطها ولي الأمر تُقرأ عامّةً وهي على ثلث المحتوى.

test('bedtime refuses a narration session, not only a video lease', async () => {
  // نافذة تغطّي كل ساعة إلا واحدة، فالاختبار لا يعتمد على وقت التشغيل.
  const { object, childId } = await seededFamily({
    daily_minutes: 60,
    max_session_minutes: null,
    bedtime_start: '00:00',
    bedtime_end: '23:59',
  });

  const refused = await checkScreenTime(object, childId);
  assert.equal(refused.status, 403);
  // الرمز هو ما يجعل العميل يعرض «انتهى وقتك» لا «هذا المحتوى يتطلب اشتراكًا»:
  // الثانية تدفع ولي الأمر إلى صفحة الدفع، وهي جواب خاطئ تمامًا لطفلٍ نام وقته.
  assert.equal(refused.body.code, 'screen_time_bedtime');
});

test('a spent daily limit refuses narration and reports the numbers', async () => {
  const { object, childId, db } = await seededFamily({
    daily_minutes: 30,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });

  // قبل استهلاك الحدّ: مسموح.
  const allowed = await checkScreenTime(object, childId);
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
  assert.equal(allowed.body.data.allowed, true);

  // الرصيد نفسه الذي يكتبه الفيديو: فحدٌّ استهلكه المشاهدة يمنع السرد.
  // وهذا جوهر البند — لا رصيدان منفصلان لطفل واحد.
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    'INSERT INTO screen_time_daily (child_id, activity_date, watched_seconds, updated_at) VALUES (?, ?, ?, ?)',
  ).run(childId, today, 30 * 60, Date.now());

  const refused = await checkScreenTime(object, childId);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'screen_time_daily_limit');
  assert.equal(refused.body.data.limit_seconds, 30 * 60);
  assert.ok(refused.body.data.used_seconds >= 30 * 60);
});

test('narration is allowed when no limit is configured', async () => {
  const { object, childId } = await seededFamily({
    daily_minutes: null,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });
  const allowed = await checkScreenTime(object, childId);
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));
});

test('a family that never opened the settings screen is not gated at all', async () => {
  /// هذا هو الشرط الذي يجعل ربط البوابة مطابقًا لقرار المالك لا تشديدًا عليه:
  /// **لا صفّ إعدادات** — أي ولي أمرٍ لم يفعّل شيئًا — يمرّ من البوابة ومن عقد
  /// الفيديو معًا.
  ///
  /// والحالة ليست نظرية: `fakeDb()` بلا `settings` يحاكي غياب الصفّ، وهو ما كان
  /// يُنتج حدًّا 30 دقيقة قبل `0093`. فلو عاد ذلك الاستبدال يومًا، فشل هذا
  /// الاختبار **وليس** ذاك الذي يفحص الدالّة وحدها: هنا يُقاس الأثر على الطفل.
  const db = new DatabaseSync(':memory:');
  const state = durableState(db);
  const object = new FamilyState(state, {
    DB: fakeDb(),
    FAMILY_EVENTS: { async sendBatch() {} },
  });
  await call(object, post('/initialize', {
    parent_id: 'parent_00000002',
    display_name: 'أسرة بلا ضوابط',
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
    nickname: 'ياسين',
    birth_month: 3,
    birth_year: new Date().getUTCFullYear() - 6,
    avatar_id: 'avatar-2',
  }));
  assert.equal(child.status, 201, JSON.stringify(child.body));
  const childId = child.body.data.id;

  // عشر ساعات مُستهلَكة اليوم. الرقم مقصود: أي حدٍّ افتراضيّ مُتصوَّر (والقديم 30
  // دقيقة) كان سيرفض هنا. فالتوكيد يقيس **غياب الفرض** لا مجرّد نجاح نداء.
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    'INSERT INTO screen_time_daily (child_id, activity_date, watched_seconds, updated_at) VALUES (?, ?, ?, ?)',
  ).run(childId, today, 10 * 60 * 60, Date.now());

  const narration = await checkScreenTime(object, childId);
  assert.equal(narration.status, 200, JSON.stringify(narration.body));
  assert.equal(narration.body.data.allowed, true);

  const lease = await startPlayback(object, childId);
  assert.equal(lease.status, 201, JSON.stringify(lease.body));
});

test('the narration gate creates no lease, so it cannot consume the concurrency cap', async () => {
  // هذا هو الشرط الذي يجعل البند إصلاحًا لا انحدارًا: لو أنشأت البوابة عقدًا
  // لعادت العلّة التي يشرحها `books.ts` — أبٌ يقرأ لطفل يمنع آخر من المشاهدة.
  const { object, childId, db } = await seededFamily({
    daily_minutes: 60,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });

  await checkScreenTime(object, childId);
  const leases = db.prepare('SELECT COUNT(*) AS n FROM playback_leases').all()[0]?.n ?? 0;
  assert.equal(leases, 0, 'a narration check must not create a playback lease');
});

test('the narration gate refuses a child outside the family', async () => {
  // معرّف الطفل يأتي من جسم الطلب، فالتحقق **داخل الكائن** هو ما يجعل معرّفًا من
  // أسرة أخرى غير قابل للتمثيل لا مرفوضًا فحسب.
  const { object } = await seededFamily({
    daily_minutes: 60,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });
  const refused = await checkScreenTime(object, 'child-from-another-family');
  assert.equal(refused.status, 404);
});

test('the narration gate refuses an unknown session', async () => {
  const { object, childId } = await seededFamily({
    daily_minutes: 60,
    max_session_minutes: null,
    bedtime_start: null,
    bedtime_end: null,
  });
  const refused = await call(object, post('/screen-time/check', {
    session_id: 'session-does-not-exist',
    child_id: childId,
  }));
  assert.equal(refused.status, 401);
});

test('both narration routes run the gate, and run it before minting a token', () => {
  /// ## القرار، ولماذا صار الربط صحيحًا
  ///
  /// `DECIDE-108` كان سؤال منتج لا هندسة، فبقيت الآلة مبنيّة والربط محجوبًا،
  /// وكان هنا توكيدٌ يُثبِّت **غياب** الربط حتى لا يُوصَل بالسهو.
  ///
  /// وقرار المالك (2026-09-23): الضوابط يفعّلها ولي الأمر، وما يفعّله يسري على
  /// السرد كما يسري على الفيديو. فسؤال «هل حكاية قبل النوم ممنوعة في وقت النوم؟»
  /// جوابه: نعم، إن فعّل ولي الأمر وقت النوم — ومن يريدها لا يفعّله. السلطة له لا
  /// لتخمينٍ في الخادم.
  ///
  /// ## ما يُثبَّت هنا، ولماذا هذان الشرطان تحديدًا
  ///
  /// **الترتيب**: البوابة قبل `createMediaToken`. توكنٌ يُصدَر ثم يُرفَض الطلب
  /// ليس رفضًا: التوكن صلاحيةٌ حاملة، ومن يملكه يقرأ الأصل مباشرةً من
  /// `/media/assets/:id`.
  ///
  /// **الملفّان معًا**: سطحان يمنحان توكن وسائط لنفس الطفل، فربط أحدهما يُنتج
  /// رقابةً تعمل على كتاب ولا تعمل على قصة — وهو أسوأ من لا رقابة، لأنه يُقرأ
  /// عاملًا.
  const strip = (source) => source
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  for (const file of ['books.ts', 'stories.ts']) {
    const source = strip(readFileSync(
      fileURLToPath(new URL(`../src/routes/${file}`, import.meta.url)),
      'utf8',
    ));

    const gateAt = source.indexOf("'/screen-time/check'");
    assert.notEqual(gateAt, -1, `${file}: the narration route must call /screen-time/check`);

    const tokenAt = source.indexOf('createMediaToken(c.env');
    assert.notEqual(tokenAt, -1, `${file}: expected a createMediaToken call to order against`);
    assert.ok(
      gateAt < tokenAt,
      `${file}: the screen-time gate must run BEFORE createMediaToken — a token minted `
      + 'then refused is still a bearer capability for the asset',
    );

    // ورفضُ البوابة يُمرَّر كما هو: `forward` يحفظ الرمز (`screen_time_bedtime`)
    // الذي يعرض للطفل «وقت النوم» بدل «هذا المحتوى يتطلب اشتراكًا».
    assert.match(
      source.slice(gateAt, tokenAt),
      /if \(!gate\.ok\) return forward\(gate\);/,
      `${file}: a gate refusal must be forwarded with its code intact`,
    );
  }
});

test('the screen-time endpoint stays reachable, so the decision is a wiring line', () => {
  // الآلة لا تُحذف بحجّة أنها غير موصولة: حذفُها يجعل القرار عملًا هندسيًّا من
  // جديد بدل سطرٍ واحد.
  const source = readFileSync(
    fileURLToPath(new URL('../src/do/FamilyState.ts', import.meta.url)),
    'utf8',
  );
  assert.match(source, /'POST \/screen-time\/check'/);
  assert.match(source, /private async checkScreenTime\(/);
});
