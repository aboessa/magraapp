import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { raiseAlert, resolveAlert } from '../src/lib/opsAlerts.ts';
import { runHealthChecks, HEALTH_CHECK_CRON } from '../src/scheduled/healthChecks.ts';
import { opsAlertEmailIsConfigured } from '../src/services/email.ts';

/// OPS-106 — رصد فعلي: فحوص تكتب، وتنبيهات تصل، وإغلاق تلقائي.

const read = (relative) => readFileSync(
  fileURLToPath(new URL(`../${relative}`, import.meta.url)),
  'utf8',
);

/// D1 وهمية تُجيب حسب مقطع من نصّ الاستعلام، وتسجّل كل كتابة.
function fakeDb(answers = {}, options = {}) {
  const writes = [];
  const rowsFor = (sql) => {
    for (const [needle, value] of Object.entries(answers)) {
      if (sql.includes(needle)) return value;
    }
    return null;
  };
  return {
    writes,
    prepare(sql) {
      const statement = {
        bind(...params) {
          return {
            async run() {
              if (options.failWrites) throw new Error('D1 unavailable');
              writes.push({ sql, params });
              return { meta: { changes: options.changes ?? 1 } };
            },
            async first() {
              if (options.failReads) throw new Error('D1 unavailable');
              return rowsFor(sql);
            },
          };
        },
        async run() {
          writes.push({ sql, params: [] });
          return { meta: { changes: options.changes ?? 1 } };
        },
        async first() {
          if (options.failReads) throw new Error('D1 unavailable');
          return rowsFor(sql);
        },
      };
      return statement;
    },
  };
}

const quietEnv = (db, extra = {}) => ({ DB: db, ...extra });

async function withQuietConsole(run) {
  const error = console.error;
  const log = console.log;
  console.error = () => {};
  console.log = () => {};
  try {
    return await run();
  } finally {
    console.error = error;
    console.log = log;
  }
}

/* ---------------------------------------------------------------- التنبيهات */

test('التنبيه يُرفَع مرة واحدة لكل حالة حيّة', async () => {
  // `changes: 0` هو ما تُعيده القاعدة حين يمنع الفهرس الفريد الجزئي الإدراج —
  // أي أن التنبيه مفتوح أصلًا. وهذا المسار هو الشائع: عطل مستمرّ ينادي كل دورة.
  const existing = fakeDb({}, { changes: 0 });
  const result = await raiseAlert(quietEnv(existing), {
    fingerprint: 'dlq:pending', serviceId: 'queue_dlq', severity: 'high', condition: 'x',
  });
  assert.equal(result.raised, false);
  assert.equal(result.id, null);
  // ولا كتابة ثانية: لا تحديث تسليم ولا رسالة.
  assert.equal(existing.writes.length, 1);
});

test('التنبيه الجديد يُدرَج ثم تُسجَّل نتيجة تسليمه', async () => {
  const db = fakeDb();
  const result = await raiseAlert(quietEnv(db), {
    fingerprint: 'dlq:pending', serviceId: 'queue_dlq', severity: 'high', condition: 'حدث فاشل',
  });
  assert.equal(result.raised, true);
  assert.match(db.writes[0].sql, /INSERT OR IGNORE INTO ops_alerts/);
  assert.match(db.writes[1].sql, /notify_outcome/);
  // بلا `OPS_ALERT_EMAIL` النتيجة `unconfigured` **صريحة** لا `NULL`: النظام
  // يكتب التنبيهات ولا أحد يستقبلها، وهذه أخطر حالة فلا تُخلَط بـ«لم يُحاول».
  assert.equal(result.notified, 'unconfigured');
  assert.equal(db.writes[1].params[0], 'unconfigured');
});

test('التنبيه يُسلَّم فعلًا حين تُهيَّأ القناة', async () => {
  // معيار القبول الثاني. المزوّد وهمي، والمقصود إثبات أن المسار يصل إليه بجسم
  // فيه ما يلزم للتصرّف: الحالة، والخدمة، والبصمة.
  const sent = [];
  const db = fakeDb();
  const env = quietEnv(db, {
    EMAIL_FROM: 'ops@majarra.app',
    OPS_ALERT_EMAIL: 'oncall@majarra.app',
    EMAIL: { send: async (message) => { sent.push(message); return { id: 'msg-1' }; } },
  });
  assert.equal(opsAlertEmailIsConfigured(env), true);

  const result = await raiseAlert(env, {
    fingerprint: 'dlq:pending', serviceId: 'queue_dlq', severity: 'high',
    condition: '3 أحداث عائلة فاشلة معلَّقة',
  });

  assert.equal(result.notified, 'sent');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'oncall@majarra.app');
  assert.match(sent[0].subject, /high/);
  assert.match(sent[0].text, /3 أحداث عائلة فاشلة معلَّقة/);
  assert.match(sent[0].text, /queue_dlq/);
  assert.match(sent[0].text, /dlq:pending/);
});

test('قناة التنبيهات لا تتعلّق بإعداد رابط تأكيد البريد', () => {
  // `emailIsConfigured` تشترط `EMAIL_VERIFICATION_URL`. استعمالها هنا كان سيُسكِت
  // الرصد كلّه حين يتغيّر إعدادٌ لمسار آخر تمامًا.
  assert.equal(opsAlertEmailIsConfigured({
    EMAIL_FROM: 'ops@majarra.app',
    OPS_ALERT_EMAIL: 'oncall@majarra.app',
    RESEND_API_KEY: 'x'.repeat(40),
  }), true);
  assert.equal(opsAlertEmailIsConfigured({
    EMAIL_FROM: 'ops@majarra.app',
    RESEND_API_KEY: 'x'.repeat(40),
  }), false, 'بلا مستقبِل لا قناة');
  assert.equal(opsAlertEmailIsConfigured({
    EMAIL_FROM: 'ops@majarra.app',
    OPS_ALERT_EMAIL: 'oncall@majarra.app',
  }), false, 'بلا مزوّد لا قناة');
});

test('الإغلاق يشمل المُعتَرف به ولا يمسّ المُغلَق', async () => {
  const db = fakeDb();
  await resolveAlert(quietEnv(db), 'dlq:pending');
  assert.match(db.writes[0].sql, /status = 'resolved'/);
  assert.match(db.writes[0].sql, /status IN \('open', 'acknowledged'\)/);
});

/* ------------------------------------------------------------ دورة الفحص */

test('الدورة تكتب صفًّا لكل خدمة تستطيع قياسها', async () => {
  // معيار القبول الأول.
  const db = fakeDb({
    'SELECT 1 AS ok': { ok: 1 },
    'FROM failed_family_events': { pending: 0, oldest: null },
    'FROM processed_family_events': { last: new Date().toISOString().replace('T', ' ').slice(0, 19) },
  });
  const result = await withQuietConsole(() => runHealthChecks(quietEnv(db)));

  const checks = db.writes.filter((w) => /INSERT INTO ops_health_checks/.test(w.sql));
  assert.equal(result.written, 4);
  assert.deepEqual(
    checks.map((w) => w.params[1]).sort(),
    ['admin_api', 'd1', 'queue_dlq', 'queue_family_events'],
  );
  for (const check of checks) {
    assert.ok(['healthy', 'degraded', 'unknown'].includes(check.params[2]));
  }
});

test('حدث فاشل واحد يكفي لرفع تنبيه', async () => {
  // العتبة واحد لا عشرة: حدث فاشل يعني أسرةً بعينها إسقاطها متأخّر.
  const db = fakeDb({
    'SELECT 1 AS ok': { ok: 1 },
    'FROM failed_family_events': { pending: 1, oldest: '2026-08-20 10:00:00' },
    'FROM processed_family_events': { last: new Date().toISOString().replace('T', ' ').slice(0, 19) },
  });
  await withQuietConsole(() => runHealthChecks(quietEnv(db)));

  const alerts = db.writes.filter((w) => /INSERT OR IGNORE INTO ops_alerts/.test(w.sql));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].params[1], 'dlq:pending');
  assert.equal(alerts[0].params[3], 'high');
});

test('زوال الحالة يُغلق تنبيهها بلا تدخّل', async () => {
  // تنبيه يبقى مفتوحًا بعد زوال سببه يُدرِّب المشغّل على تجاهل الشاشة.
  const db = fakeDb({
    'SELECT 1 AS ok': { ok: 1 },
    'FROM failed_family_events': { pending: 0, oldest: null },
    'FROM processed_family_events': { last: new Date().toISOString().replace('T', ' ').slice(0, 19) },
  });
  await withQuietConsole(() => runHealthChecks(quietEnv(db)));

  const resolved = db.writes.filter((w) => /status = 'resolved'/.test(w.sql));
  assert.deepEqual(resolved.map((w) => w.params[0]).sort(), ['d1:slow', 'dlq:pending', 'queue:stale']);
});

test('قاعدة ساقطة تُنتج صفَّ انقطاع وتنبيهًا حرجًا ولا تُسقط الدورة', async () => {
  const db = fakeDb({}, { failReads: true });
  const result = await withQuietConsole(() => runHealthChecks(quietEnv(db)));

  assert.equal(result.written, 1, 'لا معنى لاستقصاء الباقي بقاعدة ساقطة');
  const check = db.writes.find((w) => /INSERT INTO ops_health_checks/.test(w.sql));
  assert.equal(check.params[2], 'outage');
  const alert = db.writes.find((w) => /INSERT OR IGNORE INTO ops_alerts/.test(w.sql));
  assert.equal(alert.params[1], 'd1:unreachable');
  assert.equal(alert.params[3], 'critical');
});

test('طابور بلا أحداث قطّ ليس طابورًا متأخّرًا', async () => {
  // منصّة لم تُنتج حدثًا بعد. لو قُرئ ذلك تأخّرًا لبدأ الرصد حياته بتنبيه كاذب،
  // وأوّل تنبيه كاذب هو الذي يُعلّم المشغّل أن الشاشة لا تُقرأ.
  const db = fakeDb({
    'SELECT 1 AS ok': { ok: 1 },
    'FROM failed_family_events': { pending: 0, oldest: null },
    'FROM processed_family_events': { last: null },
  });
  await withQuietConsole(() => runHealthChecks(quietEnv(db)));

  const queueCheck = db.writes.find(
    (w) => /INSERT INTO ops_health_checks/.test(w.sql) && w.params[1] === 'queue_family_events',
  );
  assert.equal(queueCheck.params[2], 'unknown');
  const alerts = db.writes.filter((w) => /INSERT OR IGNORE INTO ops_alerts/.test(w.sql));
  assert.equal(alerts.length, 0);
});

test('فشل كتابة فحص لا يمنع بقيّة الفحوص', async () => {
  const db = fakeDb({
    'SELECT 1 AS ok': { ok: 1 },
    'FROM failed_family_events': { pending: 0, oldest: null },
    'FROM processed_family_events': { last: null },
  }, { failWrites: true });
  const result = await withQuietConsole(() => runHealthChecks(quietEnv(db)));
  assert.equal(result.written, 0);
  assert.equal(result.raised, 0);
});

/* ------------------------------------------------------------------ الربط */

test('الجدولان معلَنان في الإعداد وموزَّعان في الكود', () => {
  const wrangler = read('wrangler.jsonc');
  const index = read('src/index.ts');

  // تعبير في الإعداد بلا فرع في الكود يعمل ولا يفعل شيئًا — عطل صامت بلا خطأ.
  const declared = [...wrangler.matchAll(/"(\*\/5 \* \* \* \*|0 3 \* \* \*)"/g)].map((m) => m[1]);
  assert.ok(declared.includes(HEALTH_CHECK_CRON), 'فحص الصحة غير مُعلَن');
  assert.ok(declared.includes('0 3 * * *'), 'التنظيف غير مُعلَن');
  // مرّتان لكل تعبير: البيئات المُسمّاة لا ترث المشغّلات.
  assert.equal(declared.filter((c) => c === HEALTH_CHECK_CRON).length, 2);

  assert.match(index, /cron === HEALTH_CHECK_CRON/);
  assert.match(index, /cron === CLEANUP_CRON/);
  assert.match(index, /unhandled_cron/, 'تعبير بلا فرع يجب أن يصرخ');
});

test('الشاشة لم تبقَ تختلق حالة سليمة', () => {
  // كان `api.status` مثبَّتًا على `'healthy'` بلا أي قياس، مع `checked_at` من
  // لحظة قراءة الشاشة — أي أنها تختلق الشيء الوحيد الذي جاء المشغّل يسأل عنه.
  const source = read('src/routes/adminOpsReliability.ts');
  assert.equal(/status: 'healthy', checked_at: new Date\(\)/.test(source), false);
  assert.match(source, /FROM ops_health_checks WHERE service_id='admin_api'/);
});

test('الفهرس الفريد جزئي على الحيّ وحده', () => {
  const migration = read('migrations/0084_ops_alert_delivery.sql');
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_ops_alerts_live_fingerprint/);
  // بلا `WHERE` لصار تنبيهٌ أُغلق قبل شهر يمنع رفع نفس الحالة اليوم.
  assert.match(migration, /WHERE status IN \('open', 'acknowledged'\)/);
  assert.match(migration, /ADD COLUMN notified_at TEXT/);
  assert.match(migration, /ADD COLUMN notify_outcome TEXT/);
});

test('السياسة في ملف واحد: الدورة لا تفتح حادثة', () => {
  // الحادثة قرار إنسان: إعلان أن شيئًا يستحقّ تحقيقًا ومالكًا. وفتحها آليًّا
  // يُنتج حوادث بلا أصحاب تُغلَق كسلًا، فتفقد الكلمة معناها.
  const source = read('src/scheduled/healthChecks.ts');
  assert.equal(/INSERT INTO ops_incidents/.test(source), false);
});
