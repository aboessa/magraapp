import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROVING_STATUSES,
  checkSelfApproval,
  isApproval,
  SELF_APPROVAL_ERROR,
} from '../src/lib/separationOfDuties.ts';

/// Regression coverage for plan section 9:
///
///   «الشخص الذي أنشأ أو عدّل المحتوى لا يعتمد النسخة نفسها اعتمادًا نهائيًا.»
///
/// This was enforced nowhere. One person could create content, review it,
/// approve it and publish it — exactly what the rule forbids. Worse,
/// `reviewer_id` came from the request body, so a reviewer could attribute the
/// approval to somebody else.

/// Minimal D1 stub. Only `prepare().bind().first()` is exercised, because that
/// is all `queryFirst` calls. Returning a canned row keeps the test focused on
/// the decision logic rather than on SQL.
function fakeDb(lastActor) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return lastActor === undefined ? null : { actor_id: lastActor };
            },
          };
        },
      };
    },
  };
}

const target = { entityType: 'story', entityId: 'story-1' };

test('only approval statuses are gated', () => {
  assert.deepEqual([...APPROVING_STATUSES], ['approved']);
  assert.equal(isApproval('approved'), true);
  // Asking for changes on your own work is harmless; the rule guards approval.
  assert.equal(isApproval('needs_changes'), false);
  assert.equal(isApproval('rejected'), false);
  assert.equal(isApproval('pending'), false);
  assert.equal(isApproval(undefined), false);
  assert.equal(isApproval(null), false);
});

test('the last author cannot approve their own work', async () => {
  const result = await checkSelfApproval(fakeDb('user-ahmed'), {
    ...target,
    approverId: 'user-ahmed',
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'self_approval');
  assert.equal(result.lastAuthor, 'user-ahmed');
});

test('a different person may approve', async () => {
  const result = await checkSelfApproval(fakeDb('user-ahmed'), {
    ...target,
    approverId: 'user-khaled',
  });
  assert.equal(result.ok, true);
});

test('no audit history means the rule cannot prove authorship, so it allows', async () => {
  // Blocking on absence of evidence would freeze review of all pre-existing
  // content for no security gain.
  const result = await checkSelfApproval(fakeDb(undefined), {
    ...target,
    approverId: 'user-ahmed',
  });
  assert.equal(result.ok, true);
});

test('legacy placeholder actors never match a real user', async () => {
  // Rows written before auditLog.actorId was fixed carry these literals. They
  // identify nobody, so they must not block anybody.
  for (const placeholder of ['admin-api-key', 'legacy-admin-key', 'admin']) {
    const result = await checkSelfApproval(fakeDb(placeholder), {
      ...target,
      approverId: placeholder,
    });
    assert.equal(result.ok, true, placeholder);
  }
});

test('an approver with a placeholder identity is not gated', async () => {
  const result = await checkSelfApproval(fakeDb('user-ahmed'), {
    ...target,
    approverId: 'legacy-admin-key',
  });
  assert.equal(result.ok, true);
});

test('a null actor in the audit row does not block', async () => {
  const result = await checkSelfApproval(fakeDb(null), {
    ...target,
    approverId: 'user-ahmed',
  });
  assert.equal(result.ok, true);
});

test('an explicit override bypasses the check without querying', async () => {
  // Section 9 permits the platform owner to override in an emergency, with the
  // reason recorded. The override is the caller's decision, not automatic.
  const db = {
    prepare() {
      throw new Error('should not query when overriding');
    },
  };
  const result = await checkSelfApproval(db, {
    ...target,
    approverId: 'user-ahmed',
    allowOverride: true,
  });
  assert.equal(result.ok, true);
});

test('the rejection message is in Arabic for the operator', () => {
  assert.match(SELF_APPROVAL_ERROR, /[\u0600-\u06FF]/);
  assert.match(SELF_APPROVAL_ERROR, /الفصل بين الإنشاء والاعتماد/);
});
