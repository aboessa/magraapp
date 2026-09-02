import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escalationRefusal,
  isLastOwnerGrant,
  permissionsBeyondActor,
  permissionsOfRole,
  roleBeyondActor,
  verifiedGrantedBy,
} from '../src/lib/privilegeGuard.ts';

/// SEC-103 — لا تُعطِ ما لا تملك.

/// D1 وهمية تُجيب بحسب مقطع من الاستعلام.
function fakeDb(answers = {}) {
  const asked = [];
  const rowsFor = (sql) => {
    for (const [needle, value] of Object.entries(answers)) {
      if (sql.includes(needle)) return value;
    }
    return null;
  };
  return {
    asked,
    prepare(sql) {
      asked.push(sql);
      const respond = {
        async all() {
          const value = rowsFor(sql);
          return { results: Array.isArray(value) ? value : [] };
        },
        async first() {
          const value = rowsFor(sql);
          return Array.isArray(value) ? value[0] ?? null : value;
        },
      };
      return { bind: () => respond, ...respond };
    },
  };
}

const actor = (permissions, roles = ['section_lead']) => ({
  id: 'user-1', email: 'a@b.c', display_name: 'A',
  roles, permissions, grants: [], must_change_password: false,
});

/* ------------------------------------------------------- المجموعة الفرعية */

test('منح صلاحية لا يملكها الفاعل يُرفض بأسمائها', () => {
  const missing = permissionsBeyondActor(
    actor(['view', 'create']),
    ['view', 'manage_permissions', 'publish'],
  );
  assert.deepEqual(missing, ['manage_permissions', 'publish']);
});

test('منح ما يملكه بالكامل يُقبل', () => {
  assert.equal(permissionsBeyondActor(actor(['view', 'create']), ['view']), null);
  assert.equal(permissionsBeyondActor(actor(['view']), []), null);
});

test('المالك ومدير النظام يتخطّيان الفحص', () => {
  // يملكان كل صلاحية أصلًا فالاختبار يمرّ لهما على كل حال، والتخطّي الصريح يُبقي
  // بذر مالك أوّل ممكنًا.
  for (const role of ['owner', 'system_admin']) {
    assert.equal(permissionsBeyondActor(actor([], [role]), ['manage_permissions']), null, role);
  }
});

test('دور يشبه اسم المالك لا يورث التخطّي', () => {
  assert.deepEqual(
    permissionsBeyondActor(actor([], ['owner_assistant']), ['manage_permissions']),
    ['manage_permissions'],
  );
});

test('وضع الطوارئ قبل بذر أول حساب يمرّ', () => {
  // لا فاعل ليُقارَن به. و`requireAdmin` يرفض هذا المسار بمجرد وجود مستخدم واحد.
  assert.equal(permissionsBeyondActor(undefined, ['manage_permissions']), null);
});

test('حامل manage_permissions بلا owner لا يستطيع منح owner', async () => {
  // معيار القبول الأول، بالحالة التي كانت تُصعّد فعلًا.
  const db = fakeDb({
    'FROM role_permissions': [
      { permission_id: 'view' },
      { permission_id: 'manage_permissions' },
      { permission_id: 'manage_billing' },
      { permission_id: 'publish' },
    ],
  });
  const missing = await roleBeyondActor(db, actor(['view', 'manage_permissions']), 'owner');
  assert.deepEqual(missing, ['manage_billing', 'publish']);
});

test('الصلاحيات تُقرأ من الحقيقة لا من قائمة مكتوبة', async () => {
  // رُفض عمود `rank` على `roles`: رقمٌ يُصان بيد إنسان بجانب `role_permissions`
  // يفترق عنها يومًا، وحرسٌ يسمح بما تمنعه الحقيقة أسوأ من غياب الحرس.
  const db = fakeDb({ 'FROM role_permissions': [{ permission_id: 'publish' }] });
  assert.deepEqual(await permissionsOfRole(db, 'publisher'), ['publish']);
  assert.ok(db.asked.some((sql) => sql.includes('role_permissions')));
});

test('الرفض يسمّي الناقص ويحمل رمزًا ثابتًا', () => {
  const refusal = escalationRefusal(['publish']);
  assert.equal(refusal.success, false);
  assert.equal(refusal.code, 'privilege_escalation');
  assert.deepEqual(refusal.details.missing_permissions, ['publish']);
});

/* --------------------------------------------------------- نسبة المنح */

test('granted_by يُخزَّن فقط إن طابق مستخدمًا قائمًا', async () => {
  // معيار القبول الثالث.
  const known = fakeDb({ 'FROM admin_users WHERE id': { id: 'user-1' } });
  assert.equal(await verifiedGrantedBy(known, actor([])), 'user-1');
});

test('هوية لا تقابل مستخدمًا تصير NULL لا نصًّا مختلقًا', async () => {
  // العمود يُعلن `REFERENCES admin_users(id)` وD1 لا يفرضه، فكان يستقبل
  // `'legacy-admin-key'` **وقيمة ترويسة يكتبها المتصل**. و«غير منسوب» أصدق من
  // «منسوب إلى كائن غير موجود»: الثانية كذبة يصعب اكتشافها في مراجعة.
  const missing = fakeDb({});
  assert.equal(await verifiedGrantedBy(missing, actor([])), null);
  assert.equal(await verifiedGrantedBy(missing, undefined), null);
});

/* ------------------------------------------------------- آخر مالك */

test('آخر منح ملكية لا يُحذف', async () => {
  const single = fakeDb({ 'FROM access_grants': { total: 1 } });
  assert.equal(await isLastOwnerGrant(single, 'owner'), true);
});

test('ملكية ثانية تجعل الحذف مسموحًا، وغير المالك لا يُفحَص', async () => {
  const two = fakeDb({ 'FROM access_grants': { total: 2 } });
  assert.equal(await isLastOwnerGrant(two, 'owner'), false);
  const untouched = fakeDb({});
  assert.equal(await isLastOwnerGrant(untouched, 'viewer'), false);
  assert.equal(untouched.asked.length, 0, 'دور غير المالك لا يستهلك استعلامًا');
});
