import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTENT_CLASSES,
  contentClassPredicate,
  isContentClass,
  shouldServeTestFixtures,
} from '../src/lib/contentClass.ts';

// Mazen & Thaaloub was supplied as external material to test upload, R2, asset linking,
// streaming and playback. It is not Majarra content. `series.content_class` is how the
// catalogue tells the two apart; these tests pin the rules that keep it from leaking.

test('only production and test_fixture are valid content classes', () => {
  assert.deepEqual([...CONTENT_CLASSES], ['production', 'test_fixture']);
  assert.equal(isContentClass('production'), true);
  assert.equal(isContentClass('test_fixture'), true);
  assert.equal(isContentClass('demo'), false);
  assert.equal(isContentClass(''), false);
  assert.equal(isContentClass(undefined), false);
});

test('test fixtures are hidden by default when the flag is absent', () => {
  assert.equal(shouldServeTestFixtures({}), false);
  assert.equal(shouldServeTestFixtures({ ENVIRONMENT: 'development' }), false);
});

test('an explicit opt-in works outside production', () => {
  assert.equal(shouldServeTestFixtures({ ENVIRONMENT: 'development', INCLUDE_TEST_FIXTURES: 'true' }), true);
  assert.equal(shouldServeTestFixtures({ ENVIRONMENT: 'development', INCLUDE_TEST_FIXTURES: '1' }), true);
  assert.equal(shouldServeTestFixtures({ ENVIRONMENT: 'staging', INCLUDE_TEST_FIXTURES: 'TRUE' }), true);
});

test('production refuses the opt-in however it is spelled', () => {
  for (const flag of ['true', '1', 'TRUE', 'True']) {
    assert.equal(
      shouldServeTestFixtures({ ENVIRONMENT: 'production', INCLUDE_TEST_FIXTURES: flag }),
      false,
      `production must not serve fixtures for INCLUDE_TEST_FIXTURES=${flag}`,
    );
  }
});

test('a garbage flag value fails closed rather than open', () => {
  for (const flag of ['yes', 'on', 'maybe', '2', 'false', '0', '']) {
    assert.equal(shouldServeTestFixtures({ ENVIRONMENT: 'development', INCLUDE_TEST_FIXTURES: flag }), false);
  }
});

test('the predicate restricts to production content when fixtures are hidden', () => {
  const sql = contentClassPredicate('s', false);
  assert.equal(sql, " AND s.content_class = 'production'");
  assert.match(sql, /^ AND /, 'must be safe to append to an existing WHERE clause');
});

test('the predicate is empty when fixtures are allowed, so callers can interpolate unconditionally', () => {
  assert.equal(contentClassPredicate('s', true), '');
});

test('the predicate honours the caller table alias', () => {
  assert.equal(contentClassPredicate('ser', false), " AND ser.content_class = 'production'");
});
