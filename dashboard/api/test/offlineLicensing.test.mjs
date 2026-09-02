import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FamilyState } from '../src/do/FamilyState.ts';
import { PLAN_LIMITS } from '../src/lib/familyPolicy.ts';
import { FAMILY_EVENT_TYPES } from '../src/contracts/familyEvents.ts';
import { isAuditedFamilyEvent } from '../src/lib/familyAudit.ts';
import { processFamilyEvent } from '../src/queue/familyEvents.ts';
import { offlineLicensingIsConfigured, signOfflineLicense } from '../src/lib/offlineLicense.ts';

/// ENC-001 — سلطة ترخيص الاستخدام دون إنترنت.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// لم تكن هناك منظومة ترخيص أصلًا: صفر نقطة نهاية وصفر جدول. العميل يقرّر بنفسه
/// أن التنزيل مسموح، ويمنح نفسه ثلاثين يومًا محسوبة على ساعة الجهاز، والخادم لا
/// يعرف أن تنزيلًا حدث — فلا يعدّه ولا يحدّه ولا يبطله. وحدّ `downloadDevices`
/// في `PLAN_LIMITS` كان معلَنًا ولا يقرؤه أحد.
///
/// الحدود تُختبر على محرّك SQLite حقيقي (نفس تجهيزة `familyState.test.mjs`):
/// المسألة مسألة `COUNT` ثم `INSERT` داخل معاملة، ومحاكاة تُعيد صفوفًا معلَّبة
/// كانت ستثبت أن كاتب الاختبار فهم الاستعلام لا أن الاستعلام صحيح.

/* ------------------------------------------------------------------ the shim */

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

const rows = (db, sql) => db.prepare(sql).all();

/// أسرة بجلسة وطفل وباقة مدفوعة — أقلّ ما يحتاجه إصدار ترخيص.
async function seeded({ plan = 'family', sessions = 1 } = {}) {
  const db = new DatabaseSync(':memory:');
  const state = durableState(db);
  const queue = { batches: [] };
  const object = new FamilyState(state, {
    FAMILY_EVENTS: { async sendBatch(messages) { queue.batches.push(messages); } },
  });

  await call(object, post('/initialize', {
    parent_id: 'parent_00000001', display_name: 'أسرة', identity_epoch: 1,
  }));
  if (plan !== 'free') {
    const applied = await call(object, post('/entitlements/apply', {
      id: 'ent-1', source: 'google_play', plan, status: 'active',
      starts_at: Date.now() - 1000, expires_at: Date.now() + 30 * 86_400_000,
      observed_at: Date.now(),
    }));
    assert.equal(applied.status, 200, 'تجهيزة الاختبار تفترض استحقاقًا مطبَّقًا');
  }
  const created = [];
  for (let index = 0; index < sessions; index += 1) {
    const session = await call(object, post('/sessions/create', {
      session_id: `session-${index + 1}`,
      refresh_token_hash: `hash-${index + 1}`,
      installation_id_hash: `install-${index + 1}`,
      platform: 'android',
      device_name: `جهاز ${index + 1}`,
      expires_at: Date.now() + 30 * 86_400_000,
    }));
    created.push(session.body.data);
  }
  const child = await call(object, post('/children', {
    session_id: created[0].session_id,
    nickname: 'ليان',
    birth_month: 5,
    birth_year: new Date().getUTCFullYear() - 7,
    avatar_id: 'avatar-1',
    language: 'ar',
  }));
  return { object, db, state, queue, sessions: created, childId: child.body.data.id };
}

const issue = (context, overrides = {}) => call(context.object, post('/downloads/issue', {
  session_id: context.sessions[0].session_id,
  child_id: context.childId,
  entity_type: 'episode',
  entity_id: 'ep-1',
  content_version: 1,
  required_plan: 'family',
  allowed_tracks: ['preschool', 'kids', 'junior'],
  ttl_ms: 30 * 86_400_000,
  signature_key_id: 'majarra-offline-v1',
  assets: [{ asset_id: 'asset-1', byte_size: 1024, source_sha256: 'abc' }],
  ...overrides,
}));

/* ------------------------------------------------------------------ الإصدار */

test('الجدولان يُنشأان مع الكائن', async () => {
  const { db } = await seeded();
  const tables = rows(db, `SELECT name FROM sqlite_master WHERE type='table'`).map((row) => row.name);
  assert.ok(tables.includes('offline_licenses'));
  assert.ok(tables.includes('offline_license_assets'));
});

test('حساب مستحقّ يحصل على ترخيص معلَّق بأصوله', async () => {
  const context = await seeded();
  const result = await issue(context);

  assert.equal(result.status, 201);
  assert.equal(result.body.data.licence.status, 'pending');
  assert.equal(result.body.data.licence.child_id, context.childId);
  assert.equal(result.body.data.licence.device_id, context.sessions[0].device_id);
  // العهد يُلتقَط عند الإصدار: هو ما يجعل إبطال أي جهاز يُبطل ما قبله.
  assert.equal(result.body.data.licence.auth_epoch, 1);
  assert.deepEqual(result.body.data.assets, [
    { asset_id: 'asset-1', byte_size: 1024, source_sha256: 'abc' },
  ]);
  assert.equal(rows(context.db, `SELECT COUNT(*) AS c FROM offline_licenses`)[0].c, 1);
});

test('الباقة المجانية تُرفض صراحةً لا بإخفاء زر', async () => {
  // `PLAN_LIMITS.free.downloadDevices === 0` كان معلَنًا ولا يقرؤه أحد.
  assert.equal(PLAN_LIMITS.free.downloadDevices, 0);
  const context = await seeded({ plan: 'free' });
  const result = await issue(context, { required_plan: 'free' });
  assert.equal(result.status, 402);
  assert.equal(result.body.code, 'offline_not_in_plan');
  assert.equal(rows(context.db, `SELECT COUNT(*) AS c FROM offline_licenses`)[0].c, 0);
});

test('محتوى فوق الباقة يُرفض بلا إصدار أي شيء', async () => {
  // معيار القبول: «يرفض حسابًا بلا استحقاق بلا إصدار أي رابط أو مفتاح».
  const context = await seeded({ plan: 'family' });
  const result = await issue(context, { required_plan: 'family_plus' });
  assert.equal(result.status, 402);
  assert.equal(rows(context.db, `SELECT COUNT(*) AS c FROM offline_licenses`)[0].c, 0);
});

test('مسار عمري لا يطابق الطفل يُرفض', async () => {
  const context = await seeded();
  const result = await issue(context, { allowed_tracks: ['preschool'] });
  assert.equal(result.status, 403);
});

test('إعادة الطلب لنفس العنصر تُعيد الترخيص نفسه ولا تستهلك حدًّا', async () => {
  // انقطاع شبكة بعد الإصدار يجعل العميل يعيد الطلب. لو أُصدر ترخيص ثانٍ لاستُهلك
  // حدّ العناصر بلا تنزيل جديد.
  const context = await seeded();
  const first = await issue(context);
  const second = await issue(context);
  assert.equal(second.status, 200);
  assert.equal(second.body.data.reused, true);
  assert.equal(second.body.data.licence.id, first.body.data.licence.id);
  assert.equal(rows(context.db, `SELECT COUNT(*) AS c FROM offline_licenses`)[0].c, 1);
});

/* -------------------------------------------------------------------- الحدود */

test('حدّ العناصر يُفرض خادميًّا', async () => {
  const context = await seeded({ plan: 'family' });
  const limit = PLAN_LIMITS.family.offlineItems;
  for (let index = 0; index < limit; index += 1) {
    const result = await issue(context, { entity_id: `ep-${index}` });
    assert.equal(result.status, 201, `العنصر ${index} كان يجب أن يُقبل`);
  }
  const overflow = await issue(context, { entity_id: 'ep-overflow' });
  assert.equal(overflow.status, 409);
  assert.equal(overflow.body.code, 'offline_item_limit');
  assert.equal(overflow.body.data.limit, limit);
});

test('حدّ أجهزة التنزيل يُفرض على الأجهزة لا على التراخيص', async () => {
  // ثلاثة أجهزة على باقة حدّها جهازان: الثالث يُرفض حتى لو بقي حدّ عناصر.
  const context = await seeded({ plan: 'family', sessions: 3 });
  assert.equal(PLAN_LIMITS.family.downloadDevices, 2);

  for (const [index, session] of context.sessions.slice(0, 2).entries()) {
    const result = await issue(context, {
      session_id: session.session_id,
      entity_id: `ep-${index}`,
    });
    assert.equal(result.status, 201);
  }
  const third = await issue(context, {
    session_id: context.sessions[2].session_id,
    entity_id: 'ep-third',
  });
  assert.equal(third.status, 409);
  assert.equal(third.body.code, 'download_device_limit');
});

test('جهاز مُرخَّص أصلًا لا يُحسب مرة ثانية', async () => {
  const context = await seeded({ plan: 'family', sessions: 2 });
  await issue(context, { entity_id: 'ep-a' });
  // نفس الجهاز، عنصر آخر: الحدّ حدّ أجهزة لا حدّ تراخيص.
  const second = await issue(context, { entity_id: 'ep-b' });
  assert.equal(second.status, 201);
});

/* ------------------------------------------------- الاكتمال والتجديد والإبطال */

test('الاكتمال ينقل الترخيص إلى نشط ويحمل أصوله في الحدث', async () => {
  const context = await seeded();
  const issued = await issue(context);
  const completed = await call(context.object, post('/downloads/complete', {
    session_id: context.sessions[0].session_id,
    licence_id: issued.body.data.licence.id,
  }));
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.licence.status, 'active');

  const events = rows(context.db, `SELECT event_type, payload_json FROM outbox ORDER BY created_at`);
  const completion = events.find((row) => row.event_type === 'offline_license.completed');
  assert.ok(completion);
  // الأصول مع الاكتمال لا مع الإصدار: صفوف `child_downloads` تعني «الملف على
  // الجهاز»، وكتابتها قبل الاكتمال تجعلها تكذب.
  assert.equal(JSON.parse(completion.payload_json).payload.assets.length, 1);
});

test('الاكتمال لا يُحيي ترخيصًا مسحوبًا', async () => {
  const context = await seeded();
  const issued = await issue(context);
  await call(context.object, post('/downloads/revoke', {
    session_id: context.sessions[0].session_id,
    licence_id: issued.body.data.licence.id,
  }));
  const completed = await call(context.object, post('/downloads/complete', {
    session_id: context.sessions[0].session_id,
    licence_id: issued.body.data.licence.id,
  }));
  // `revoked` حالة نهائية بالتعريف.
  assert.equal(completed.status, 404);
  assert.equal(
    rows(context.db, `SELECT status FROM offline_licenses`)[0].status,
    'revoked',
  );
});

test('التجديد يُصدر سجلًّا جديدًا ويخلف القديم ولا يُحييه', async () => {
  const context = await seeded();
  const issued = await issue(context);
  const licenceId = issued.body.data.licence.id;
  const renewed = await call(context.object, post('/downloads/renew', {
    session_id: context.sessions[0].session_id,
    licence_id: licenceId,
    ttl_ms: 30 * 86_400_000,
    signature_key_id: 'majarra-offline-v1',
  }));

  assert.equal(renewed.status, 201);
  const fresh = renewed.body.data.licence;
  assert.notEqual(fresh.id, licenceId);
  assert.equal(fresh.status, 'active');
  const stored = rows(context.db, `SELECT id, status, renewed_from FROM offline_licenses ORDER BY issued_at`);
  assert.equal(stored.length, 2);
  assert.equal(stored[0].status, 'superseded');
  assert.equal(stored[1].renewed_from, licenceId);
  // الأصول تُنسَخ إلى السجل الجديد، وإلا صار ترخيصًا بلا ما يرخّصه.
  assert.equal(renewed.body.data.assets.length, 1);
});

test('التجديد يُرفض إن سقط الاشتراك', async () => {
  const context = await seeded({ plan: 'family' });
  const issued = await issue(context);
  // الاستحقاق ينتهي بعد الإصدار: التجديد لا يجوز أن يمدّد ما لم يُدفَع.
  context.db.prepare(`UPDATE entitlements SET status = 'expired'`).run();
  const renewed = await call(context.object, post('/downloads/renew', {
    session_id: context.sessions[0].session_id,
    licence_id: issued.body.data.licence.id,
    ttl_ms: 30 * 86_400_000,
  }));
  assert.equal(renewed.status, 402);
});

test('انتهاء المدة يُنهي الترخيص عند أول عدّ', async () => {
  const context = await seeded();
  const issued = await issue(context);
  context.db.prepare(`UPDATE offline_licenses SET expires_at = ?`).run(Date.now() - 1000);
  // العدّ يمرّ على `sweep` أولًا، فالمنتهي لا يُحسب في الحدود ولا يُعاد استخدامه.
  const again = await issue(context);
  assert.equal(again.status, 201);
  assert.notEqual(again.body.data.licence.id, issued.body.data.licence.id);
  const statuses = rows(context.db, `SELECT status FROM offline_licenses ORDER BY issued_at`).map((row) => row.status);
  assert.deepEqual(statuses, ['expired', 'pending']);
});

test('إبطال الجهاز يُبطل تراخيصه — لا يبقى ملف مرخَّصًا بعد سحب الجهاز', async () => {
  // ENC-010: هذا هو الانفصال الذي كان قائمًا. إبطال الجهاز كان يمسّ الجلسات
  // وعقود التشغيل، ولا يمسّ ملفًا محفوظًا على ذلك الجهاز.
  const context = await seeded({ plan: 'family', sessions: 2 });
  await issue(context, { entity_id: 'ep-a' });
  const target = context.sessions[0].device_id;

  const revoked = await call(context.object, post('/admin/devices/revoke', {
    device_id: target, actor_id: 'admin-1', reason: 'lost device',
  }));
  assert.equal(revoked.status, 200);
  assert.equal(
    rows(context.db, `SELECT status FROM offline_licenses WHERE device_id = '${target}'`)[0].status,
    'revoked',
  );
});

test('أمر المسؤول «إبطال التنزيلات» يُبطل التراخيص لا العقود وحدها', async () => {
  // كان يُبطل `playback_leases` فقط — أي أنه لا يفعل ما يسمّيه: عقد التشغيل
  // عمره دقائق ولا يمسّ ملفًا على جهاز غير متصل.
  const context = await seeded();
  await issue(context);
  const result = await call(context.object, post('/admin/downloads/revoke', {
    actor_id: 'admin-1', reason: 'limit abuse',
  }));
  assert.equal(result.status, 200);
  assert.equal(result.body.data.licences_revoked, 1);
  assert.equal(rows(context.db, `SELECT status FROM offline_licenses`)[0].status, 'revoked');
});

test('القائمة تُعيد الحدود مع ما هو مرخَّص', async () => {
  const context = await seeded();
  await issue(context);
  const listed = await call(context.object, post('/downloads/list', {
    session_id: context.sessions[0].session_id,
  }));
  assert.equal(listed.body.data.licences.length, 1);
  assert.equal(listed.body.data.limits.download_devices, PLAN_LIMITS.family.downloadDevices);
  assert.equal(listed.body.data.limits.offline_items, PLAN_LIMITS.family.offlineItems);
});

test('كل نقطة تتطلّب جلسة صالحة', async () => {
  const context = await seeded();
  for (const path of ['/downloads/issue', '/downloads/complete', '/downloads/renew', '/downloads/revoke', '/downloads/list']) {
    const result = await call(context.object, post(path, {
      session_id: 'not-a-session', licence_id: 'x', ttl_ms: 60_000, device_id: 'd',
    }));
    assert.ok(result.status === 401 || result.status === 400, `${path} → ${result.status}`);
  }
});

/* ----------------------------------------------------- الإسقاط في D1 والتدقيق */

function fakeDb() {
  const batches = [];
  const db = {
    batches,
    prepare(sql) {
      return {
        bind(...params) {
          return { sql, params, async first() { return null; }, async run() { return { meta: {} }; } };
        },
      };
    },
    async batch(list) { batches.push(list); return list.map(() => ({ meta: { changes: 1 } })); },
  };
  return db;
}

const event = (type, payload) => ({
  eventId: `event_${type}_1`,
  type,
  schemaVersion: 1,
  parentId: 'parent_12345678',
  occurredAt: 1_700_000_000_000,
  payload,
});

test('أنواع أحداث التراخيص معلَنة في العقد', () => {
  // نوع يُصدره الـDO ولا يقبله العقد يُستهلَك ويُفقَد صامتًا — العلّة نفسها التي
  // أُغلقت في PRIV-102.
  for (const type of [
    'offline_license.issued', 'offline_license.completed',
    'offline_license.renewed', 'offline_license.revoked',
  ]) {
    assert.ok(FAMILY_EVENT_TYPES.includes(type), `${type} غير معلَن`);
    // وكلها أفعال أمنية تُدقَّق: نسخة على جهاز تعيش أيامًا.
    assert.equal(isAuditedFamilyEvent(type), true, `${type} يجب أن يُدقَّق`);
  }
});

test('الإصدار يُسقَط صفًّا معلَّقًا في media_licenses', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('offline_license.issued', {
    licenseId: 'lic-1', childId: 'child-1', deviceId: 'device-1', authEpoch: 3,
    entityType: 'episode', entityId: 'ep-1', contentVersion: 2,
    requiredPlan: 'family', expiresAt: 1_700_000_100_000,
    signatureKeyId: 'majarra-offline-v1',
  }));
  const statements = db.batches[0];
  const licence = statements.find((row) => /INSERT INTO media_licenses/.test(row.sql));
  assert.ok(licence);
  assert.equal(licence.params[0], 'lic-1');
  assert.equal(licence.params[9], 'pending');
  assert.equal(licence.params[10], 'majarra-offline-v1');
  // وسجل الأحداث append-only يُكتب لكل حدث تنزيل.
  assert.ok(statements.some((row) => /INSERT OR IGNORE INTO download_events/.test(row.sql)));
});

test('الاكتمال يكتب صفوف child_downloads من الترخيص نفسه', async () => {
  // الأعمدة تُقرأ من `media_licenses` بـSELECT لا تُمرَّر من الحدث: صفٌّ لا
  // ترخيص له لا يُكتب أصلًا، وهو معيار القبول «كل صف يطابق ترخيصًا».
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('offline_license.completed', {
    licenseId: 'lic-1', childId: 'child-1', deviceId: 'device-1',
    assets: [
      { assetId: 'asset-1', byteSize: 10, sourceSha256: 'aa' },
      { assetId: 'asset-2', byteSize: null, sourceSha256: null },
    ],
  }));
  const statements = db.batches[0];
  const downloads = statements.filter((row) => /INSERT OR IGNORE INTO child_downloads/.test(row.sql));
  assert.equal(downloads.length, 2);
  assert.match(downloads[0].sql, /FROM media_licenses l WHERE l\.id = \?/);
  assert.ok(statements.some((row) => /SET status = 'active'/.test(row.sql)));
});

test('الإبطال لا يكتب فوق حالة نهائية', async () => {
  const db = fakeDb();
  await processFamilyEvent({ DB: db }, event('offline_license.revoked', {
    licenseIds: ['lic-1', 'lic-2'], deviceId: 'device-1',
  }));
  const updates = db.batches[0].filter((row) => /SET status = 'revoked'/.test(row.sql));
  assert.equal(updates.length, 2);
  for (const update of updates) {
    assert.match(update.sql, /status IN \('pending', 'active', 'expired'\)/);
  }
});

/* -------------------------------------------------------- التوقيع والتهيئة */

const licenseSource = readFileSync(
  fileURLToPath(new URL('../src/lib/offlineLicense.ts', import.meta.url)),
  'utf8',
);
const routeSource = readFileSync(
  fileURLToPath(new URL('../src/routes/downloads.ts', import.meta.url)),
  'utf8',
);

test('الترخيص يُوقَّع فعلًا ويُتحقَّق منه بالمفتاح العام', async () => {
  // اختبار حقيقي لا فحص مصدر: يُولّد زوج مفاتيح، يوقّع عبر `signOfflineLicense`
  // نفسه، ثم يتحقّق بالمفتاح العام كما سيفعل التطبيق وهو غير متصل. هذا ما يثبت
  // أن صيغة السرّ (PKCS8/base64) هي التي يقبلها الاستيراد، وأن ما يُوقَّع هو
  // نفس البايتات التي تُرسَل.
  const { generateKeyPairSync, webcrypto } = await import('node:crypto');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const env = {
    OFFLINE_LICENSE_SIGNING_KEY: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
  };
  assert.equal(offlineLicensingIsConfigured(env), true);

  const claims = {
    lic: 'lic-1', sub: 'parent_1', cid: 'child_1', did: 'device_1', epoch: 4,
    entity_type: 'episode', entity_id: 'ep-1', ver: 2, rights: 'offline_playback',
    plan: 'family', assets: [{ id: 'asset-1', sha256: 'aa', bytes: 10 }],
    iat: 1_700_000_000, exp: 1_700_086_400,
  };
  const signed = await signOfflineLicense(env, claims);

  const [payload, signature] = signed.token.split('.');
  const decode = (value) => Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const verifier = await webcrypto.subtle.importKey(
    'spki', publicKey.export({ type: 'spki', format: 'der' }), { name: 'Ed25519' }, false, ['verify'],
  );
  assert.equal(
    await webcrypto.subtle.verify({ name: 'Ed25519' }, verifier, decode(signature), decode(payload)),
    true,
  );

  // الحمولة المُوقَّعة هي نفسها المُعلَنة، ومعها نوع المستند ومعرّف المفتاح.
  const decoded = JSON.parse(decode(payload).toString('utf8'));
  assert.equal(decoded.typ, 'offline_license');
  assert.equal(decoded.kid, signed.claims.kid);
  assert.equal(decoded.did, 'device_1');
  assert.equal(decoded.exp, claims.exp);

  // تغيير بايت واحد في الحمولة يُفشل التحقّق — وهو كل ما يحمي من تمديد المدة
  // بتحرير الملف على الجهاز.
  const forged = Buffer.from(JSON.stringify({ ...decoded, exp: decoded.exp + 86_400 }), 'utf8');
  assert.equal(
    await webcrypto.subtle.verify({ name: 'Ed25519' }, verifier, decode(signature), forged),
    false,
  );
});

test('غياب السرّ أو قصره يُقرأ «غير مُهيَّأ»', () => {
  assert.equal(offlineLicensingIsConfigured({}), false);
  assert.equal(offlineLicensingIsConfigured({ OFFLINE_LICENSE_SIGNING_KEY: '' }), false);
  // قيمة قصيرة ليست مفتاحًا: قبولها كان سيعني فشل استيراد في وقت التشغيل بدل
  // رفض مبكّر واضح.
  assert.equal(offlineLicensingIsConfigured({ OFFLINE_LICENSE_SIGNING_KEY: 'short' }), false);
});

test('التوقيع لامتناظر لا HMAC', () => {
  // HMAC كان سيعني أن كل جهاز يحمل مفتاح الإصدار، فيكتب لنفسه ترخيصًا أبديًّا.
  assert.match(licenseSource, /name: 'Ed25519'/);
  // التعليقات تُنزَع: الملف يشرح لماذا **لا** HMAC، وفحصٌ يفشل على شرح صحيح
  // يدفع إلى حذف الشرح لا إلى إصلاح الكود.
  const code = licenseSource
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('///') && !line.trimStart().startsWith('//'))
    .join('\n');
  assert.doesNotMatch(code, /createHmacSignature|createSignedToken|Hmac/);
});

test('غياب المفتاح يرفض الإصدار ولا يُصدر ترخيصًا بلا توقيع', () => {
  assert.match(licenseSource, /offlineLicensingIsConfigured/);
  assert.match(routeSource, /Offline licensing is not configured/);
  assert.match(routeSource, /503/);
});

test('الترخيص يحمل كل ما يُتحقَّق منه في العميل', () => {
  // معيار القبول يسمّي الحقول: المعرّف والمفتاح والحساب والطفل والجهاز والعهد
  // والنوع والمحتوى والإصدار والحقوق والانتهاء ومعرّف مفتاح التوقيع.
  for (const field of ['lic', 'sub', 'cid', 'did', 'epoch', 'entity_type', 'entity_id', 'ver', 'rights', 'exp', 'kid']) {
    assert.match(licenseSource, new RegExp(`\\b${field}\\??:`), `الحقل ${field} غائب`);
  }
});

test('المسار لا يفرض حدًّا بنفسه', () => {
  // عدٌّ في الـWorker يسمح لطلبين متوازيين بتجاوز الحدّ. السلطة في الكائن.
  assert.doesNotMatch(routeSource, /PLAN_LIMITS/);
  assert.match(routeSource, /'\/downloads\/issue'/);
});

test('مدة الترخيص من الخادم لا من العميل', () => {
  // كانت `offlineLicenseDuration` ثابتًا في `download_manager.dart`.
  assert.match(routeSource, /LICENSE_TTL_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(routeSource, /ttl_ms: LICENSE_TTL_MS/);
});

test('الأدوار القابلة للتنزيل قائمة مغلقة', () => {
  // أصل بدور جديد لا يُنزَّل حتى يُضاف بقرار، فلا يتسرّب أصل داخلي إلى حزمة.
  assert.match(routeSource, /DOWNLOADABLE_ROLES/);
  assert.match(routeSource, /ca\.visibility = 'private'/);
  assert.match(routeSource, /ca\.status = 'ready'/);
});
