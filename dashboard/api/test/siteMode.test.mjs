import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SITE_MODE,
  isSiteMode,
  isSiteModeSetting,
  normalizeEtaMinutes,
  normalizeLaunchAt,
  normalizeStatusMessage,
  SITE_MODES,
  SITE_MODE_SETTINGS,
  toPublicStatus,
} from '../src/lib/siteMode.ts';

/// Regression coverage for the public site mode gate.
///
/// Two invariants matter most and are asserted explicitly below:
///
/// 1. An unknown or missing mode must fall back to `construction`, not `live`.
///    Failing open here would publish an unlaunched site on any bad value.
/// 2. `Retry-After` is emitted for `maintenance` only. `construction` is a
///    pre-launch state, not a temporary outage, and telling search engines to
///    retry would be wrong; conversely omitting it during maintenance risks
///    them dropping already-indexed pages.

const EMPTY = {
  site_mode: 'construction',
  site_launch_at: '',
  site_status_message: '',
  maintenance_eta_minutes: '',
};

test('the three modes are live, construction and maintenance', () => {
  assert.deepEqual([...SITE_MODES], ['live', 'construction', 'maintenance']);
});

test('the default mode is construction, never live', () => {
  // A site that has not launched must not be exposed by an absent setting.
  assert.equal(DEFAULT_SITE_MODE, 'construction');
});

test('isSiteMode accepts only the known modes', () => {
  for (const mode of SITE_MODES) assert.equal(isSiteMode(mode), true, mode);
  for (const value of ['banana', 'LIVE', '', null, undefined, 0, {}]) {
    assert.equal(isSiteMode(value), false, JSON.stringify(value));
  }
});

test('only the four site settings keys are editable', () => {
  assert.deepEqual(
    [...SITE_MODE_SETTINGS],
    ['site_mode', 'site_launch_at', 'site_status_message', 'maintenance_eta_minutes'],
  );
  assert.equal(isSiteModeSetting('site_mode'), true);
  // An unrelated key must be rejected so the endpoint cannot write arbitrary settings
  assert.equal(isSiteModeSetting('partnership_inbox_email'), false);
  assert.equal(isSiteModeSetting('admin_api_key'), false);
  assert.equal(isSiteModeSetting(''), false);
});

test('an unknown stored mode degrades to construction rather than live', () => {
  const status = toPublicStatus({ ...EMPTY, site_mode: 'nonsense' });
  assert.equal(status.mode, 'construction');
});

test('Retry-After is emitted for maintenance only', () => {
  const maintenance = toPublicStatus({
    ...EMPTY, site_mode: 'maintenance', maintenance_eta_minutes: '45',
  });
  assert.equal(maintenance.retryAfterSeconds, 2700);

  // The same ETA value under construction must not produce a retry hint
  const construction = toPublicStatus({
    ...EMPTY, site_mode: 'construction', maintenance_eta_minutes: '45',
  });
  assert.equal(construction.retryAfterSeconds, null);

  const live = toPublicStatus({ ...EMPTY, site_mode: 'live', maintenance_eta_minutes: '45' });
  assert.equal(live.retryAfterSeconds, null);
});

test('maintenance with no ETA reports no retry hint instead of guessing one', () => {
  const status = toPublicStatus({ ...EMPTY, site_mode: 'maintenance' });
  assert.equal(status.mode, 'maintenance');
  assert.equal(status.retryAfterSeconds, null);
});

test('blank optional fields surface as null, not empty strings', () => {
  const status = toPublicStatus(EMPTY);
  assert.equal(status.launchAt, null);
  assert.equal(status.message, null);
  // Whitespace-only values are treated as unset too
  const padded = toPublicStatus({ ...EMPTY, site_launch_at: '   ', site_status_message: '  ' });
  assert.equal(padded.launchAt, null);
  assert.equal(padded.message, null);
});

test('a launch date is normalized to ISO so it renders unambiguously', () => {
  const normalized = normalizeLaunchAt('2027-03-01T09:00:00Z');
  assert.equal(normalized, '2027-03-01T09:00:00.000Z');
});

test('an empty launch date is allowed and means no announced date', () => {
  // Deliberate: inventing a launch date promises something not decided.
  assert.equal(normalizeLaunchAt(''), '');
  assert.equal(normalizeLaunchAt('   '), '');
});

test('an invalid launch date is rejected rather than silently dropped', () => {
  assert.equal(normalizeLaunchAt('not-a-date'), null);
  assert.equal(normalizeLaunchAt('2027-13-45'), null);
});

test('ETA minutes accept a sane range and reject the rest', () => {
  assert.equal(normalizeEtaMinutes('1'), '1');
  assert.equal(normalizeEtaMinutes('45'), '45');
  assert.equal(normalizeEtaMinutes('20160'), '20160');
  assert.equal(normalizeEtaMinutes(''), '');

  for (const bad of ['0', '-5', '20161', '1.5', 'soon', 'NaN']) {
    assert.equal(normalizeEtaMinutes(bad), null, bad);
  }
});

test('the status message is trimmed and capped at 500 characters', () => {
  assert.equal(normalizeStatusMessage('  hello  '), 'hello');
  assert.equal(normalizeStatusMessage('x'.repeat(600)).length, 500);
  assert.equal(normalizeStatusMessage(''), '');
});

test('a custom message is passed through verbatim for the visitor', () => {
  const message = 'نُحدّث مكتبة الحلقات';
  const status = toPublicStatus({ ...EMPTY, site_mode: 'maintenance', site_status_message: message });
  assert.equal(status.message, message);
});

test('the public status never exposes an internal settings key', () => {
  // The visitor payload is a fixed shape; leaking raw settings would expose
  // future internal keys the moment they are added to platform_settings.
  const status = toPublicStatus({ ...EMPTY, site_mode: 'live' });
  assert.deepEqual(
    Object.keys(status).sort(),
    ['launchAt', 'message', 'mode', 'retryAfterSeconds'],
  );
});
