import assert from 'node:assert/strict';
import test from 'node:test';

/// OPS-202: first-party crash reports. Pins the privacy shape (no message, no
/// free-text frames), anonymous acceptance without identity, and grouping.

const writes = [];

function env() {
  return {
    DB: {
      prepare(sql) {
        const stmt = {
          bind: (...params) => ({
            async run() { writes.push({ sql, params }); return { meta: { changes: 1 } }; },
          }),
          async run() { writes.push({ sql, params: [] }); return { meta: { changes: 1 } }; },
        };
        return stmt;
      },
    },
    ENVIRONMENT: 'development',
    AUTH_TOKEN_SECRET: '0123456789abcdef0123456789abcdef', // secret-scan:allow test fixture
    CACHE: { async get() { return null; }, async put() {} },
  };
}

async function post(body, headers = {}) {
  const { default: route } = await import('../src/routes/crashIngest.ts');
  return route.request('/crashes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }, env());
}

const valid = {
  error_type: 'RangeError',
  frames: [
    'package:majarra/features/home/presentation/home_page.dart:42:7 HomePage.build',
    'dart:async/zone.dart:1234',
  ],
  context: 'flutter_error',
  fatal: true,
  platform: 'android',
  device_kind: 'tv',
};

test('an anonymous crash is stored with no identity', async () => {
  writes.length = 0;
  const res = await post(valid, { 'X-App-Version': '0.1.7+2014' });
  assert.equal(res.status, 201);
  const insert = writes.find((w) => /INSERT INTO app_crash_reports/.test(w.sql));
  assert.ok(insert);
  // (id, fingerprint, error_type, frames_json, context, fatal, app_version, platform, device_kind, parent_id, occurred_at)
  assert.equal(insert.params[2], 'RangeError');
  assert.equal(insert.params[5], 1);
  assert.equal(insert.params[6], '0.1.7+2014');
  assert.equal(insert.params[8], 'tv');
  assert.equal(insert.params[9], null, 'no parent id without a session');
});

test('a message field is refused, not stored', async () => {
  const res = await post({ ...valid, message: 'Hello Ahmed' });
  assert.equal(res.status, 400);
});

test('a frame carrying free text is refused', async () => {
  const res = await post({ ...valid, frames: ['child name is Ahmed, age 5'] });
  assert.equal(res.status, 400);
});

test('more than 12 frames is refused', async () => {
  const res = await post({ ...valid, frames: Array(13).fill('dart:core/errors.dart:1') });
  assert.equal(res.status, 400);
});

test('an unshaped app version header is dropped', async () => {
  writes.length = 0;
  const res = await post(valid, { 'X-App-Version': '<script>' });
  assert.equal(res.status, 201);
  const insert = writes.find((w) => /INSERT INTO app_crash_reports/.test(w.sql));
  assert.equal(insert.params[6], null);
});

test('a future client clock is recorded as now', async () => {
  writes.length = 0;
  const before = Date.now();
  await post({ ...valid, occurred_at: 4_000_000_000_000 });
  const insert = writes.find((w) => /INSERT INTO app_crash_reports/.test(w.sql));
  assert.ok(Date.parse(insert.params[10]) >= before - 1000);
  assert.ok(Date.parse(insert.params[10]) <= Date.now() + 1000);
});

test('the frames the app produces pass the server shape', async () => {
  // Mirrors `crash_upload_test.dart`: closures keep `<>`, SDK frames keep dots.
  const res = await post({ ...valid, frames: [
    'package:majarra/app/majarra_app.dart:10:3 <anonymous_closure>',
    'dart:async/zone.dart:1399:13 _rootRun',
  ] });
  assert.equal(res.status, 201);
});

test('same type and top frames share a fingerprint; a different line does not', async () => {
  const { crashFingerprint } = await import('../src/routes/crashIngest.ts');
  const a = await crashFingerprint('RangeError', valid.frames);
  const b = await crashFingerprint('RangeError', [...valid.frames, 'dart:core/x.dart:9']);
  const moved = await crashFingerprint('RangeError', ['package:majarra/a.dart:43', valid.frames[1]]);
  assert.equal(a.length, 32);
  assert.equal(a, (await crashFingerprint('RangeError', valid.frames)));
  assert.notEqual(a, moved);
  // Frames beyond the fifth do not split a group; the sixth here is third, so it does.
  assert.notEqual(a, b);
});
