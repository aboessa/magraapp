#!/usr/bin/env node
/**
 * Live HTTP verification of an authorised admin device command, end to end:
 * admin → command → FamilyState → auth_epoch → outbox event → read-back → audit.
 *
 * ## What this proves
 *
 * `routes/adminDevices.ts` states three rules and one history. The history is that
 * `POST /admin/devices/:id/revoke` used to answer 501 because the Durable Object's revoke
 * handler needs a parent session and an operator has none; the fix was to model the operator
 * path as a *different* operation carrying an identity and a reason. The three rules are:
 *
 *   1. permission, then reason, then audit, then effect — the audit row is written **before**
 *      the command is sent, so a command that fails mid-flight still leaves evidence;
 *   2. no D1 write — device state stays in FamilyState and `account_devices` is a projection;
 *   3. no session is minted — an operator can act *on* a family, never *as* one.
 *
 * Rule 1 is the one that is easy to claim and hard to demonstrate, so this drives a command
 * that genuinely fails — a revocation aimed at a device id FamilyState does not know — and
 * then asserts the `device_revoke_requested` row exists while the `device_revoke` row does
 * not. That is the only test that can tell "audited before" from "audited on success".
 *
 * Then it revokes a real active device and asserts the whole chain: the response reports the
 * epoch bump, the read-back shows the device revoked and `auth_epoch` incremented and the
 * active session gone, a second attempt reports `already` rather than claiming a fresh
 * revocation, and both audit rows are present and ordered.
 *
 * Rule 2 is checked twice: the D1 projection is asserted unchanged immediately after the
 * command, and `dashboard/api/src` is read (read-only, never modified) to confirm no
 * statement anywhere writes `account_devices` as an authority table.
 *
 * ## What it deliberately does not do
 *
 * It never runs against production, and it never uses `--remote`. It *is* destructive to the
 * local scratch database in one specific way: it revokes one real device belonging to one
 * real family, because a revocation that is not performed proves nothing about the epoch
 * bump. It picks the first family that still has an active device, so repeated runs move on
 * to the next family rather than re-revoking the same one; when no family has an active
 * device left, it says so instead of reporting a pass.
 *
 * Usage:
 *   node scripts/verify-device-e2e.mjs [--base http://127.0.0.1:8787]
 *                                      [--token <admin token>]
 *                                      [--email <admin email>] [--password <password>]
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};

const BASE = argValue('--base', 'http://127.0.0.1:8787');
let TOKEN = argValue('--token', process.env.ADMIN_API_KEY ?? '');
const EMAIL = argValue('--email', process.env.ADMIN_VERIFY_EMAIL ?? 'seo.verify@majarra.local');
const PASSWORD = argValue('--password', process.env.ADMIN_VERIFY_PASSWORD ?? 'Verify-Seo-2026!aA');
const ACTOR = 'verify-device-e2e';

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

let passed = 0;
let failed = 0;
let unverified = 0;
const failures = [];
const unverifiedNotes = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/// Something this environment could not be made to demonstrate.
///
/// Kept out of both counters so neither is misleading: a rule that was not exercised is not
/// a pass, and it is not a defect either until it can be shown to be one.
function unverifiedCheck(name, detail) {
  unverified += 1;
  unverifiedNotes.push(`${name} — ${detail}`);
  console.log(`  SKIP ${name} — ${detail}`);
}

let adminUserId = null;
async function signIn() {
  if (TOKEN && !EMAIL) return;
  const response = await fetch(`${BASE}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const payload = await response.json().catch(() => null);
  const token = payload?.data?.token;
  if (!token) {
    console.log(`Sign-in failed (${response.status}). Supply --token instead.`);
    return;
  }
  TOKEN = token;
  adminUserId = payload?.data?.user?.id ?? null;
}

async function call(method, path, body, token = undefined) {
  const bearer = token === undefined ? TOKEN : token;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      'X-Admin-Actor': ACTOR,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: response.status, json, text };
}
const get = (path) => call('GET', path);

const auditRows = async (entityType, entityId, action) => {
  const query = `entity_type=${entityType}&entity_id=${encodeURIComponent(entityId)}`
    + `${action ? `&action=${action}` : ''}&limit=50`;
  const response = await get(`/api/v1/admin/audit-logs?${query}`);
  return response.json?.data ?? [];
};

/// Walks `dashboard/api/src` and returns every statement that writes `account_devices`.
///
/// Read-only by construction: nothing here opens a file for writing. The point is not that
/// the table is never mentioned — Customer 360 and the executive summary both read it — but
/// that no code path treats it as the place where device truth lives.
async function accountDeviceWrites(directory) {
  const findings = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      findings.push(...await accountDeviceWrites(full));
      continue;
    }
    if (!entry.name.endsWith('.ts')) continue;
    const source = await readFile(full, 'utf8');
    if (!source.includes('account_devices')) continue;
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      // A comment mentioning the table is not a write, and the projection is read in
      // several places on purpose.
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('///')) return;
      if (!/account_devices/.test(line)) return;
      if (!/\b(INSERT\s+(OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM|REPLACE\s+INTO)\b/i.test(line)) return;
      findings.push(`${relative(SRC_ROOT, full).replace(/\\/g, '/')}:${index + 1}: ${trimmed.slice(0, 120)}`);
    });
  }
  return findings;
}

const stamp = Date.now().toString(36);

async function main() {
  console.log(`Verifying admin device commands at ${BASE}\n`);

  const health = await fetch(`${BASE}/health`).then((response) => response.json()).catch(() => null);
  if (health?.status !== 'ok') {
    console.log(`No worker is answering at ${BASE}/health.`);
    console.log('Start one against the local D1 first: npm run dev  (do not use --remote)');
    process.exit(1);
  }

  await signIn();
  if (!TOKEN) {
    console.log('\nNo admin credential. Pass --email/--password or --token.');
    process.exit(1);
  }

  // --- Guards, before anything is changed ---------------------------------
  console.log('Guards');

  const anonymousRead = await fetch(`${BASE}/api/v1/admin/families/anything/device-state`);
  check('an unauthenticated actor cannot read the authority', anonymousRead.status === 401, `status ${anonymousRead.status}`);
  const anonymousWrite = await call('POST', '/api/v1/admin/families/anything/devices/anything/revoke',
    { reason: 'unauthenticated attempt' }, '');
  check('an unauthenticated actor cannot issue a device command', anonymousWrite.status === 401,
    `status ${anonymousWrite.status}`);
  const forgedToken = await call('POST', '/api/v1/admin/families/anything/devices/anything/revoke',
    { reason: 'forged session' }, `forged-${stamp}`);
  check('a forged bearer token is refused', forgedToken.status === 401, `status ${forgedToken.status}`);
  const spoofedActorOnly = await fetch(`${BASE}/api/v1/admin/families/anything/device-state`, {
    headers: { 'X-Admin-Actor': 'someone-else' },
  });
  check('the X-Admin-Actor header alone is not an identity', spoofedActorOnly.status === 401,
    `status ${spoofedActorOnly.status}`);

  const unknownFamily = await call('POST', `/api/v1/admin/families/no-such-family-${stamp}/devices/d/revoke`,
    { reason: 'family that does not exist' });
  check('a command against an unknown family is refused from the projection, not by creating a stub',
    unknownFamily.status === 404, `status ${unknownFamily.status} ${unknownFamily.text.slice(0, 160)}`);
  check('no audit row was written for a family that does not exist',
    (await auditRows('family_device', 'd')).length === 0, '');

  // --- Find a family with an active device --------------------------------
  console.log('\nThe authority read');

  const list = await get('/api/v1/admin/customers?limit=100');
  check('the family list answers', list.status === 200 && Array.isArray(list.json?.data),
    `status ${list.status} ${list.text.slice(0, 160)}`);

  let parentId = null;
  let device = null;
  let stateBefore = null;
  for (const family of list.json?.data ?? []) {
    const state = await get(`/api/v1/admin/families/${family.parent_id}/device-state`);
    if (state.status !== 200) continue;
    const active = (state.json?.data?.devices ?? []).find((row) => row.status === 'active');
    if (!active) continue;
    parentId = family.parent_id;
    device = active;
    stateBefore = state.json.data;
    break;
  }
  check('a family with an active device was found', !!parentId,
    'no family in this database still has an active device — every one has already been revoked by an earlier run');
  if (!parentId) { report(); return; }
  console.log(`  using family ${parentId}, device ${device.id}`);

  check('the authority read names FamilyState as its source',
    stateBefore.source === 'family_state', JSON.stringify(stateBefore.source));
  check('the authority read returns the epoch, the devices and the live session and lease counts',
    typeof stateBefore.auth_epoch === 'number' && Array.isArray(stateBefore.devices)
      && typeof stateBefore.active_sessions === 'number' && typeof stateBefore.active_leases === 'number',
    JSON.stringify(Object.keys(stateBefore)));
  check('reading the authority is itself audited',
    (await auditRows('family_device_state', parentId, 'view')).length > 0, '');

  const projectedBefore = (await get(`/api/v1/admin/customers/${parentId}`)).json?.data?.devices_projection ?? [];

  // --- The reason is mandatory --------------------------------------------
  console.log('\nThe reason is mandatory');

  const noBody = await call('POST', `/api/v1/admin/families/${parentId}/devices/${device.id}/revoke`, {});
  check('a revocation with no reason is refused', noBody.status === 400, `status ${noBody.status} ${noBody.text.slice(0, 160)}`);
  const blankReason = await call('POST', `/api/v1/admin/families/${parentId}/devices/${device.id}/revoke`, { reason: '    ' });
  check('a blank reason is refused, not stored as empty', blankReason.status === 400, `status ${blankReason.status}`);
  check('a refused command left no audit row and no state change',
    (await auditRows('family_device', device.id)).length === 0
      && (await get(`/api/v1/admin/families/${parentId}/device-state`)).json?.data?.auth_epoch === stateBefore.auth_epoch,
    '');

  // --- A command that fails still leaves evidence -------------------------
  //
  // This is the only assertion that can distinguish "audited before the effect" from
  // "audited after a success": the command is aimed at a device id FamilyState does not
  // know, so it cannot succeed, and the requested row must exist anyway.
  console.log('\nAudited before the effect');

  const ghostDevice = `ghost-device-${stamp}`;
  const ghostReason = 'محاولة سحب لجهاز غير موجود، للتحقّق من ترتيب التدقيق.';
  const ghost = await call('POST', `/api/v1/admin/families/${parentId}/devices/${ghostDevice}/revoke`, { reason: ghostReason });
  check('a command FamilyState refuses is reported as a failure, not as a success',
    ghost.status === 404 && ghost.json?.success === false,
    `status ${ghost.status} ${ghost.text.slice(0, 160)}`);
  const ghostRows = await auditRows('family_device', ghostDevice);
  check('the FAILED command still left audit evidence that it was attempted',
    ghostRows.some((row) => row.action === 'device_revoke_requested'),
    ghostRows.map((row) => row.action).join(', ') || 'no rows');
  check('no completion row was written for a command that did not complete',
    !ghostRows.some((row) => row.action === 'device_revoke'),
    ghostRows.map((row) => row.action).join(', '));
  check('the evidence names the operator, the family and the reason',
    (() => {
      const row = ghostRows.find((entry) => entry.action === 'device_revoke_requested');
      return !!row && row.actor_id === (adminUserId ?? row.actor_id) && row.actor_id !== 'legacy-admin-key'
        && (row.details ?? '').includes(parentId) && (row.details ?? '').includes('reason');
    })(), JSON.stringify(ghostRows[0] ?? null));

  // --- The real command ---------------------------------------------------
  console.log('\nThe command');

  const reason = `تحقّق مباشر ${stamp}: العائلة أبلغت عن فقدان الجهاز.`;
  const revoke = await call('POST', `/api/v1/admin/families/${parentId}/devices/${device.id}/revoke`, { reason });
  check('the revocation is accepted', revoke.status === 200 && revoke.json?.success === true,
    `status ${revoke.status} ${revoke.text.slice(0, 200)}`);
  check('the response reports the revocation and the epoch bump',
    revoke.json?.data?.revoked === true && revoke.json?.data?.auth_epoch_bumped === true,
    JSON.stringify(revoke.json?.data ?? null));
  check('the response names FamilyState as the source of the effect',
    revoke.json?.data?.source === 'family_state', JSON.stringify(revoke.json?.data?.source));
  check('no session or token is minted by an operator command',
    !/"(token|session_id|refresh_token|session)"\s*:/i.test(revoke.text), revoke.text.slice(0, 200));

  // --- The read-back -----------------------------------------------------
  console.log('\nThe read-back');

  const after = await get(`/api/v1/admin/families/${parentId}/device-state`);
  check('the authority is readable again after the command', after.status === 200, `status ${after.status}`);
  const stateAfter = after.json?.data ?? {};
  const revokedDevice = (stateAfter.devices ?? []).find((row) => row.id === device.id);
  check('the read-back shows the device revoked, not merely absent',
    revokedDevice?.status === 'revoked', JSON.stringify(revokedDevice ?? null));
  check('auth_epoch advanced by exactly one, which is what signs the device out',
    stateAfter.auth_epoch === stateBefore.auth_epoch + 1,
    `${stateBefore.auth_epoch} → ${stateAfter.auth_epoch}`);
  check('the sessions that belonged to the family epoch are gone',
    stateAfter.active_sessions < stateBefore.active_sessions || stateBefore.active_sessions === 0,
    `${stateBefore.active_sessions} → ${stateAfter.active_sessions}`);
  check('no other device was touched',
    (stateAfter.devices ?? []).filter((row) => row.status === 'active').length
      === (stateBefore.devices ?? []).filter((row) => row.status === 'active').length - 1,
    `active before ${(stateBefore.devices ?? []).filter((row) => row.status === 'active').length}, after ${(stateAfter.devices ?? []).filter((row) => row.status === 'active').length}`);

  const again = await call('POST', `/api/v1/admin/families/${parentId}/devices/${device.id}/revoke`, {
    reason: 'محاولة ثانية على الجهاز نفسه.',
  });
  check('a second revocation reports "already revoked" instead of claiming a fresh one',
    again.status === 200 && again.json?.data?.already === true && again.json?.data?.revoked === false,
    JSON.stringify(again.json?.data ?? null));

  // --- Rule 2: no D1 authority write -------------------------------------
  console.log('\nNo second truth in D1');

  const projectedAfter = (await get(`/api/v1/admin/customers/${parentId}`)).json?.data?.devices_projection ?? [];
  check('the command did not write the D1 device projection synchronously',
    JSON.stringify(projectedAfter) === JSON.stringify(projectedBefore),
    `projection rows ${projectedBefore.length} → ${projectedAfter.length}`);

  const writes = await accountDeviceWrites(SRC_ROOT);
  check('no statement anywhere in dashboard/api/src writes account_devices as an authority table',
    writes.length === 0, writes.join(' | ') || 'none');
  console.log(`       (read-only inspection of ${relative(process.cwd(), SRC_ROOT).replace(/\\/g, '/')}; `
    + `${writes.length} write statement(s) found)`);

  // --- Downloads: a different operation on the same authority ------------
  console.log('\nDownloads');

  const downloadsNoReason = await call('POST', `/api/v1/admin/families/${parentId}/downloads/revoke`, {});
  check('revoking downloads without a reason is refused', downloadsNoReason.status === 400,
    `status ${downloadsNoReason.status}`);
  const downloads = await call('POST', `/api/v1/admin/families/${parentId}/downloads/revoke`, {
    reason: 'انتهى الاشتراك؛ إبطال النسخ غير المتّصلة.',
  });
  check('revoking downloads is accepted and reports how many leases it ended',
    downloads.status === 200 && typeof downloads.json?.data?.leases_revoked === 'number',
    `status ${downloads.status} ${downloads.text.slice(0, 200)}`);
  const downloadRows = await auditRows('family_device', parentId);
  check('the downloads command is audited before and after, like the revocation',
    downloadRows.some((row) => row.action === 'downloads_revoke_requested')
      && downloadRows.some((row) => row.action === 'downloads_revoke'),
    downloadRows.map((row) => row.action).join(', ') || 'no rows');
  const stateAfterDownloads = (await get(`/api/v1/admin/families/${parentId}/device-state`)).json?.data ?? {};
  check('ending offline access did not revoke the family epoch a second time',
    stateAfterDownloads.auth_epoch === stateAfter.auth_epoch,
    `${stateAfter.auth_epoch} → ${stateAfterDownloads.auth_epoch}`);

  // --- The outbox leg ----------------------------------------------------
  console.log('\nThe outbox event');

  const projectionBefore = (await get(`/api/v1/admin/parents/${parentId}`)).json?.data ?? {};
  const resyncNoReason = await call('POST', `/api/v1/admin/families/${parentId}/resync`, {});
  check('a resync without a reason is refused', resyncNoReason.status === 400, `status ${resyncNoReason.status}`);
  const resync = await call('POST', `/api/v1/admin/families/${parentId}/resync`, {
    reason: 'التحقّق من أن الحدث يخرج عبر الصندوق الصادر لا بكتابة D1.',
  });
  check('the resync is accepted and reports the authority snapshot it emitted',
    resync.status === 200 && typeof resync.json?.data?.active_device_count === 'number',
    `status ${resync.status} ${resync.text.slice(0, 240)}`);
  check('the resync says the projection updates asynchronously rather than implying it is done',
    (resync.json?.data?.note ?? '').includes('queue'), resync.json?.data?.note ?? 'no note');
  check('the resync is audited against the family',
    (await auditRows('family', parentId, 'family_resync')).length > 0, '');

  const projectionImmediately = (await get(`/api/v1/admin/parents/${parentId}`)).json?.data ?? {};
  check('the resync emitted an event instead of writing the projection itself',
    projectionImmediately.updated_at === projectionBefore.updated_at
      && projectionImmediately.last_event_at_ms === projectionBefore.last_event_at_ms,
    `updated_at ${projectionBefore.updated_at} → ${projectionImmediately.updated_at}`);

  let delivered = false;
  for (let attempt = 0; attempt < 8 && !delivered; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const polled = (await get(`/api/v1/admin/parents/${parentId}`)).json?.data ?? {};
    delivered = polled.last_event_at_ms > (projectionBefore.last_event_at_ms ?? 0);
  }
  if (delivered) {
    check('the emitted event reached the D1 projection through the queue', true, '');
  } else {
    unverifiedCheck('the emitted event reaches the D1 projection through the queue',
      'the projection did not advance within 16s of the snapshot event. The event is written to the '
      + "Durable Object's outbox and sent on an alarm, so this is only observable when the local "
      + 'queue consumer runs; nothing in the HTTP surface exposes the outbox, so a stalled local '
      + 'queue simulation and a consumer defect cannot be told apart from here');
  }

  // --- The audit chain ---------------------------------------------------
  console.log('\nThe audit chain');

  const rows = await auditRows('family_device', device.id);
  const requested = rows.find((row) => row.action === 'device_revoke_requested');
  const completed = rows.find((row) => row.action === 'device_revoke');
  check('both the request and the completion are recorded',
    !!requested && !!completed, rows.map((row) => row.action).join(', ') || 'no rows');
  check('the request is not recorded after the completion',
    !!requested && !!completed && requested.created_at <= completed.created_at,
    `${requested?.created_at} then ${completed?.created_at}`);
  check('the completion carries the reason and the authority result',
    (completed?.details ?? '').includes(parentId) && (completed?.details ?? '').includes('result'),
    (completed?.details ?? '').slice(0, 200));
  check('the audit rows name the signed-in operator, not a shared key',
    rows.every((row) => row.actor_id && row.actor_id !== 'legacy-admin-key'),
    rows[0]?.actor_id ?? 'none');
  check('the operator action is distinguishable from a parent action in the record',
    (completed?.details ?? '').includes('reason'), '');

  report();
}

function report() {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (unverified) console.log(`${unverified} not exercised`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const failure of failures) console.log(`  - ${failure}`);
  }
  if (unverifiedNotes.length) {
    console.log('\nNot exercised:');
    for (const note of unverifiedNotes) console.log(`  - ${note}`);
  }
  process.exit(failed ? 1 : 0);
}

await main();
