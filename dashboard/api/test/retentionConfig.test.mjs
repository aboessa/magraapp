import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyticsRetentionDays,
  handleScheduled,
  CLEANUP_CRON,
} from '../src/scheduled/cleanup.ts';

/// `PRIV-101` — مدّة الاحتفاظ مصدرها إعداد لا ثابت في الكود.
///
/// البند نفسه استشهد بالتعليق الذي كان فوق الثابت: «ينبغي أن ينتقل إلى الإعداد
/// إن قرّرت المراجعة رقمًا آخر». هذه الملفّة تُثبّت الانتقال وسلوكَ الحدود،
/// **ولا تُثبّت الرقم كقرار**: 180 هو ما ينفّذه النظام اليوم، وتغييره قرار
/// قانوني (`HUMAN-106`).

/// D1 وهمية تسجّل كل حذف مع معاملاته.
function fakeDb() {
  const deletes = [];
  return {
    deletes,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              deletes.push({ sql, params });
              return { meta: { changes: 3 } };
            },
          };
        },
      };
    },
  };
}

test('غياب الإعداد يعني ما ينفّذه النظام اليوم: 180 يومًا', () => {
  assert.equal(analyticsRetentionDays({}), 180);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: '' }), 180);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: '   ' }), 180);
});

test('قيمة معدّة صحيحة تُطاع', () => {
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: '90' }), 90);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: '30' }), 30);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: '1' }), 1);
  assert.equal(analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: '3650' }), 3650);
});

test('قيمة مشوّهة تعود إلى الافتراض وتُسجَّل، ولا تُعطّل الحذف', () => {
  const logged = [];
  const original = console.error;
  console.error = (...args) => logged.push(args);
  try {
    for (const bad of ['abc', '0', '-5', '3651', '12.5', 'NaN', 'Infinity']) {
      assert.equal(
        analyticsRetentionDays({ ANALYTICS_RETENTION_DAYS: bad }),
        180,
        `القيمة ${bad} كان يجب أن تعود إلى الافتراض`,
      );
    }
  } finally {
    console.error = original;
  }
  // الأثر مسجَّل بمفتاح قابل للبحث: إعدادٌ مرفوض بصمت هو إعدادٌ لا أحد يعلم
  // أنه لا يعمل.
  assert.equal(logged.length, 7);
  for (const entry of logged) {
    assert.equal(entry[0], 'cleanup_retention_invalid');
  }
});

test('المهمّة المجدولة تحذف بالمدّة المُعدَّة لا بالثابت', async () => {
  const db = fakeDb();
  await handleScheduled({ cron: CLEANUP_CRON }, {
    DB: db,
    ANALYTICS_RETENTION_DAYS: '45',
  });

  const analytics = db.deletes.find((d) => d.sql.includes('analytics_events'));
  assert.ok(analytics, 'لم يُنفَّذ حذف القياسات');
  // السلوك، لا شكل الكود: المُعامل المُمرَّر إلى SQLite هو ما يحدّد النافذة.
  assert.deepEqual(analytics.params, ['-45 days']);
});

test('سجلّ منع التكرار مدّته ثابتة ولا يتأثّر بإعداد القياسات', async () => {
  const db = fakeDb();
  await handleScheduled({ cron: CLEANUP_CRON }, {
    DB: db,
    ANALYTICS_RETENTION_DAYS: '45',
  });

  const ledger = db.deletes.find((d) => d.sql.includes('processed_family_events'));
  assert.ok(ledger);
  // ليس بيانات سلوك طفل بل منع تكرار تسليم، فلا يقع تحت قرار المراجعة.
  // المُعامل طابعٌ زمني: يُتحقَّق أنه نافذة 30 يومًا لا 45.
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;
  const drift = Math.abs((Date.now() - ledger.params[0]) - thirtyDays);
  assert.ok(drift < 5000, `نافذة السجلّ ليست 30 يومًا (فرق ${drift}ms)`);
});

test('جدولٌ آخر لا يشغّل هذه المهمّة', async () => {
  const db = fakeDb();
  await handleScheduled({ cron: '*/5 * * * *' }, { DB: db });
  assert.equal(db.deletes.length, 0);
});
