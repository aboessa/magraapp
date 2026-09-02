import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { processFamilyEvent } from '../src/queue/familyEvents.ts';
import { familyAuditStatement, isAuditedFamilyEvent } from '../src/lib/familyAudit.ts';
import { FAMILY_EVENT_TYPES } from '../src/contracts/familyEvents.ts';

/// PRIV-102 — سجل تدقيق مسار العميل.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// `audit_logs` كان يحوي 32 صفًّا كلها إدارية وصفر صف لأي فعل على مسار الأسرة:
/// لا منح ترخيص تشغيل، ولا إبطال جهاز، ولا إنشاء جلسة، ولا تصدير بيانات، ولا
/// طلب حذف. وخطة الحماية تطلب أثرًا لكل جلسة وإلغاء
/// (تشفير المحتوي.md:1213) مع استثناء الرابط الكامل والتوكن وبيانات الطفل.
///
/// وعلّة ثانية اكتُشفت أثناء المعالجة: `FAMILY_EVENT_TYPES` كانت أقصر من قائمة
/// ما يُصدره الـDO فعلًا، فسبعة أنواع — منها `device.revoked`
/// و`downloads.revoked` و`parent_pin.changed` — كانت تُسلَّم إلى الطابور ثم
/// يرفضها `parseFamilyEvent` فتُستهلَك بـ`ack()` وتُفقَد. أي أن أهم ما يحتاجه
/// سجل التدقيق كان أول ما يُدمَّر صامتًا.

/// D1 مزيّف: يجمع كل بيان مُهيَّأ ويُعيد لا شيء من `first()`.
function fakeDb() {
  const batches = [];
  const statements = [];
  const db = {
    batches,
    statements,
    prepare(sql) {
      return {
        bind(...params) {
          const statement = { sql, params, async first() { return null; }, async run() { return { meta: {} }; } };
          statements.push(statement);
          return statement;
        },
      };
    },
    async batch(list) {
      batches.push(list);
      return list.map(() => ({ meta: { changes: 1 } }));
    },
  };
  return db;
}

function event(type, payload = {}, overrides = {}) {
  return {
    eventId: `event_${type.replace(/\W/g, '_')}_1`,
    type,
    schemaVersion: 1,
    parentId: 'parent_12345678',
    occurredAt: 1_700_000_000_000,
    payload,
    ...overrides,
  };
}

/// يستخرج صف التدقيق من دفعة الطابور، إن وُجد.
function auditRow(db) {
  const batch = db.batches.at(-1) ?? [];
  const rows = batch.filter((statement) => /INSERT OR IGNORE INTO family_audit_logs/.test(statement.sql));
  assert.ok(rows.length <= 1, 'حدث واحد لا يُنتج أكثر من صف تدقيق واحد');
  if (!rows.length) return null;
  const [eventId, parentId, action, actorKind, actorId, entityType, entityId, details, occurredAt] = rows[0].params;
  return {
    eventId, parentId, action, actorKind, actorId, entityType, entityId,
    details: JSON.parse(details), occurredAt,
  };
}

/* ------------------------------------------------------ ما يُدقَّق وما لا يُدقَّق */

test('منح ترخيص التشغيل يُسجَّل بمعرّف الترخيص', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('playback.started', {
    leaseId: 'lease_1', childId: 'child_1', assetId: 'asset_1',
    entityType: 'episode', entityId: 'ep_1', deviceId: 'device_1',
  }));

  const row = auditRow(db);
  assert.ok(row, 'منح الترخيص هو أهم فعل على المسار وكان بلا أثر');
  assert.equal(row.action, 'playback.started');
  assert.equal(row.entityType, 'playback_lease');
  assert.equal(row.entityId, 'lease_1');
  assert.equal(row.actorKind, 'parent');
  assert.equal(row.actorId, 'parent_12345678');
  assert.equal(row.occurredAt, 1_700_000_000_000);
});

test('إبطال الترخيص وإنهاؤه يُسجَّلان أيضًا', async () => {
  for (const type of ['playback.revoked', 'playback.ended']) {
    const db = fakeDb();
    await processFamilyEvent({ DB: db }, event(type, { leaseId: 'lease_9', reason: 'policy_changed' }));
    const row = auditRow(db);
    assert.ok(row, `${type} يجب أن يُسجَّل: بلا الإبطال لا يمكن إثبات أن المنع حدث`);
    assert.equal(row.entityId, 'lease_9');
  }
});

test('إبطال الجهاز وإبطال التنزيلات يُسجَّلان على الجهاز', async () => {
  for (const type of ['device.revoked', 'downloads.revoked']) {
    const db = fakeDb();
    await processFamilyEvent({ DB: db }, event(type, { deviceId: 'device_7' }));
    const row = auditRow(db);
    assert.ok(row, `${type} كان يُرفَض في المستهلك ويُفقَد كليًّا`);
    assert.equal(row.entityType, 'device');
    assert.equal(row.entityId, 'device_7');
  }
});

test('إنشاء الجلسة يُسجَّل، وإبطال الجلسات كلها يُنسَب إلى الأسرة لا إلى جلسة', async () => {
  const created = fakeDb();
  await processFamilyEvent({ DB: created }, event('session.created', {
    sessionId: 'session_1', deviceId: 'device_1', platform: 'android',
  }));
  assert.equal(auditRow(created).entityType, 'auth_session');
  assert.equal(auditRow(created).entityId, 'session_1');

  // `scope: 'all'` لا يحمل معرّف جلسة؛ صفٌّ بـ`entity_id = null` على نوع
  // `auth_session` كان سيقرأ كأنه جلسة مجهولة بدل «كل جلسات هذه الأسرة».
  const revokedAll = fakeDb();
  await processFamilyEvent({ DB: revokedAll }, event('session.revoked', {
    scope: 'all', reason: 'parent_pin_changed', count: 3,
  }));
  const row = auditRow(revokedAll);
  assert.equal(row.entityType, 'family');
  assert.equal(row.entityId, 'parent_12345678');
  assert.equal(row.details.count, 3);
});

test('تصدير البيانات وطلب الحذف والحذف يُسجَّلون', async () => {
  for (const [type, payload, expectedEntity] of [
    ['data.exported', { sections: 14, rows: { children: 2 } }, 'family'],
    ['family.deletion_requested', { requestId: 'req_1', scope: 'account' }, 'family'],
    ['family.deleted', { requestId: 'req_1', scope: 'account' }, 'family'],
    ['child.deleted', { childId: 'child_3', requestId: 'req_2' }, 'child'],
  ]) {
    const db = fakeDb();
    await processFamilyEvent({ DB: db }, event(type, payload));
    const row = auditRow(db);
    assert.ok(row, `${type} بلا أثر يعني أن حذف بيانات طفل غير قابل للإثبات`);
    assert.equal(row.entityType, expectedEntity);
  }
});

test('طلب حذف طفل يُنسَب إلى الطفل لا إلى الأسرة', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('family.deletion_requested', {
    requestId: 'req_5', scope: 'child', childId: 'child_8',
  }));
  const row = auditRow(db);
  assert.equal(row.entityType, 'child');
  assert.equal(row.entityId, 'child_8');
});

test('الأحداث السلوكية عالية الحجم لا تُدقَّق', async () => {
  // صفٌّ لكل نبضة تقدّم يحوّل سجل التدقيق إلى سجل مشاهدة طفل: يطمر الأفعال
  // الأمنية ويخالف الخصوصية التي أُنشئ لحمايتها.
  for (const type of ['progress.updated', 'content.completed', 'favorite.updated']) {
    const db = fakeDb();
    await processFamilyEvent({ DB: db }, event(type, {
      childId: 'child_1', contentType: 'episode', contentId: 'ep_1',
      positionMs: 1000, durationMs: 2000, completed: false, sequence: 1,
      entityType: 'episode', entityId: 'ep_1', action: 'added',
    }));
    assert.equal(auditRow(db), null, `${type} سلوك لا فعل أمني`);
    assert.equal(isAuditedFamilyEvent(type), false);
  }
});

/* ----------------------------------------------------------- الفاعل والخصوصية */

test('الفعل الإداري يُنسَب إلى المسؤول لا إلى وليّ الأمر', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('device.revoked', {
    deviceId: 'device_2', by: 'operator', operator_id: 'admin_42', reason: 'lost device',
  }));
  const row = auditRow(db);
  assert.equal(row.actorKind, 'operator');
  assert.equal(row.actorId, 'admin_42');
  // السبب يسافر مع الأثر: إبطال بلا سبب مكتوب لا يُراجَع.
  assert.equal(row.details.reason, 'lost device');
});

test('حمولة بـby=operator بلا معرّف لا تُنسَب إلى وليّ الأمر', async () => {
  // الخطأ الآمن هو «مسؤول مجهول» لا «وليّ الأمر فعلها».
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('device.revoked', { deviceId: 'd', by: 'operator' }));
  assert.equal(auditRow(db).actorId, 'unknown_operator');
});

test('اسم الطفل وتاريخ ميلاده لا يدخلان السجل', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('child.created', {
    childId: 'child_5', nickname: 'ليان', ageTrack: 'kids',
    birth_month: 4, birth_year: 2019, avatarId: 'avatar_2',
  }));
  const row = auditRow(db);
  assert.equal(row.details.nickname, '[redacted]');
  assert.equal(row.details.birth_month, '[redacted]');
  assert.equal(row.details.birth_year, '[redacted]');
  // المعرّف المستعار مسموح، وهو ما يجعل السجل مفيدًا أصلًا.
  assert.equal(row.details.childId, 'child_5');
  assert.equal(row.details.ageTrack, 'kids');
});

test('التوكن والرابط المُوقَّع لا يدخلان السجل', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('playback.started', {
    leaseId: 'lease_2',
    media_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl',
    url: 'https://cdn.example.com/hls/master.m3u8?token=abc123&exp=999',
  }));
  const row = auditRow(db);
  assert.equal(row.details.media_token, '[redacted]');
  assert.equal(row.details.url, 'https://cdn.example.com/hls/master.m3u8?[redacted]');
});

/* --------------------------------------------------------- الذرّية والتكرار */

test('صف التدقيق يُكتب في نفس دفعة الإسقاط', async () => {
  // كتابة منفصلة تعني احتمال نجاح الإسقاط وفشل الأثر، أي حالة متغيّرة بلا سجل.
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('entitlement.updated', {
    entitlementId: 'ent_1', plan: 'family_plus', status: 'active',
    effectivePlan: 'family_plus', expiresAt: 1_700_000_100_000, observedAt: 1_700_000_000_000,
  }));
  assert.equal(db.batches.length, 1, 'دفعة واحدة، لا كتابتان مستقلّتان');
  const batch = db.batches[0];
  const auditIndex = batch.findIndex((s) => /family_audit_logs/.test(s.sql));
  const processedIndex = batch.findIndex((s) => /processed_family_events/.test(s.sql));
  assert.ok(auditIndex > -1 && processedIndex > -1);
  assert.ok(auditIndex < processedIndex, 'الأثر قبل علامة المعالجة في نفس المعاملة');
  assert.equal(auditRow(db).entityId, 'ent_1');
});

test('الإدراج idempotent على معرّف الحدث', () => {
  // الطابور at-least-once، وإعادة التشغيل من failed_family_events تمرّ بنفس
  // المعالج، فإدراج عادي كان سينتج صفًّا لكل محاولة تسليم.
  const db = fakeDb();
  const statement = familyAuditStatement(db, event('session.created', { sessionId: 's1' }));
  assert.match(statement.sql, /INSERT OR IGNORE INTO family_audit_logs/);
  assert.equal(statement.params[0], 'event_session_created_1');
});

/* ------------------------------------------- التطابق مع المصدر ومع الترحيل */

const doSource = readFileSync(
  fileURLToPath(new URL('../src/do/FamilyState.ts', import.meta.url)),
  'utf8',
);

test('كل نوع يُصدره الـDO مقبول في عقد الأحداث', () => {
  // العلّة الأصلية: الـoutbox يقبل أي نوع، والمستهلك يرفض ما ليس في القائمة
  // ثم يُنهي الرسالة بـack — فقدان صامت. هذا الفحص يمنع تكرارها.
  const emitted = new Set();
  for (const match of doSource.matchAll(/addOutbox\(\s*(?:[^,]*\?\s*)?'([a-z_.]+)'(?:\s*:\s*'([a-z_.]+)')?/g)) {
    emitted.add(match[1]);
    if (match[2]) emitted.add(match[2]);
  }
  assert.ok(emitted.size >= 20, `عدد الأنواع المستخلصة غير معقول: ${emitted.size}`);
  const missing = [...emitted].filter((type) => !FAMILY_EVENT_TYPES.includes(type));
  assert.deepEqual(missing, [], `أنواع تُصدَر ولا يقبلها العقد فتُفقَد: ${missing.join(', ')}`);
});

test('تصدير بيانات الحساب يُصدر حدثًا بعدد الصفوف لا بمحتواها', () => {
  const index = doSource.indexOf("addOutbox('data.exported'");
  assert.ok(index > 0, 'GET /account/export كان أوسع قراءة على المسار وبلا أثر');
  const emission = doSource.slice(index, index + 200);
  assert.match(emission, /sections:/);
  assert.match(emission, /rows: exportedRowCounts/);
  // نسخ المحتوى إلى السجل يخلق نسخة ثانية أطول عمرًا من البيانات نفسها.
  assert.doesNotMatch(emission, /exported\.data\.children|nickname/);
});

test('الجدول يطابق ما يكتبه المستهلك', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0081_family_audit_logs.sql', import.meta.url)),
    'utf8',
  );
  assert.match(migration, /CREATE TABLE IF NOT EXISTS family_audit_logs/);
  assert.match(migration, /event_id TEXT PRIMARY KEY/, 'المفتاح هو ما يجعل الكتابة idempotent');
  assert.match(migration, /CHECK \(actor_kind IN \('parent', 'operator', 'system'\)\)/);
  for (const column of ['parent_id', 'action', 'actor_kind', 'entity_type', 'details', 'occurred_at_ms']) {
    assert.match(migration, new RegExp(`${column}[^,]*NOT NULL`), `${column} يجب أن يكون إلزاميًا`);
  }
  // الاستعلام السائد هو سجل أسرة واحدة زمنيًا عكسيًا.
  assert.match(migration, /idx_family_audit_parent[\s\S]*parent_id, occurred_at_ms DESC/);
});

test('السجل مقروء من اللوحة بصلاحية مستقلّة عن سجل اللوحة', () => {
  const migration = readFileSync(
    fileURLToPath(new URL('../migrations/0081_family_audit_logs.sql', import.meta.url)),
    'utf8',
  );
  // دمجه في audit_logs كان يعني أن كل من يملك view_audit_log يقرأ حركة الأسر.
  assert.match(migration, /'view_family_audit'/);

  const customer = readFileSync(
    fileURLToPath(new URL('../src/routes/adminCustomer.ts', import.meta.url)),
    'utf8',
  );
  assert.match(customer, /FROM family_audit_logs/, 'سجل لا يقرؤه أحد ليس سجلًا');
  assert.match(customer, /family_audit: familyAudit/);
  assert.match(customer, /family_audit: 'd1_history'/, 'المصدر يجب أن يُعلَن كما لبقية الأقسام');
});
