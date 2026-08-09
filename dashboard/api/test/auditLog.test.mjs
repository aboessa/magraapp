import assert from 'node:assert/strict';
import test from 'node:test';
import { redactForAudit } from '../src/lib/auditLog.ts';

test('redactForAudit removes credentials and child PII recursively', () => {
  const details = redactForAudit({
    password: 'temporary-password',
    nested: {
      purchase_token_hash: 'hashed-value',
      nickname: 'طفل',
      safe_value: 'kept',
    },
    entries: [{ email: 'parent@example.test', title: 'قصة' }],
  });

  assert.deepEqual(details, {
    password: '[redacted]',
    nested: {
      purchase_token_hash: '[redacted]',
      nickname: '[redacted]',
      safe_value: 'kept',
    },
    entries: [{ email: '[redacted]', title: 'قصة' }],
  });
});

test('redactForAudit removes signed URL grants while retaining a useful path', () => {
  assert.deepEqual(redactForAudit({
    artwork_url: 'https://assets.example.test/asset/image.png?token=grant#fragment',
    bearer_value: 'Bearer secret-token',
  }), {
    artwork_url: 'https://assets.example.test/asset/image.png?[redacted]',
    bearer_value: '[redacted]',
  });
});

test('redactForAudit bounds untrusted collections and deeply nested input', () => {
  const items = Array.from({ length: 52 }, (_, index) => index);
  const deep = { level: { level: { level: { level: { level: { level: 'hidden' } } } } } };
  const redacted = redactForAudit({ items, deep });

  assert.equal(redacted.items.length, 51);
  assert.equal(redacted.items.at(-1), '[2 more items omitted]');
  assert.equal(redacted.deep.level.level.level.level.level, '[depth-limit]');
});
