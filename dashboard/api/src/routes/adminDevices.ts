/// Admin device operations: the operator path to the FamilyState authority.
///
/// ## What this replaces
///
/// `POST /admin/devices/:id/revoke` answered 501 with an accurate explanation: the
/// Durable Object's revoke handler requires an active parent session, and an operator
/// has none. That was truthful and it was not the feature — the operation is not
/// impossible, it is a *different* operation with a different authorisation story, and
/// treating it as the same one is what made it look impossible.
///
/// `do/FamilyState.ts` now exposes `/admin/*` commands that take an operator identity
/// and a reason instead of a session. This router is their only caller.
///
/// ## The three rules every command here follows
///
///  1. **Permission, then reason, then audit, then effect.** The audit row is written
///     before the command is sent, so an operator action that fails mid-flight still
///     leaves evidence that it was attempted. Recording only successes is how a
///     partially-applied revocation becomes invisible.
///  2. **No D1 write.** Device and entitlement state stays in FamilyState. D1's
///     `account_devices` is a projection and is updated by the event the command emits,
///     not by this router — writing both would create two truths that disagree the
///     first time the queue is slow.
///  3. **No session is minted.** Nothing here lets an operator act *as* a family.
///
/// ## Why `manage_permissions` guards the writes
///
/// Signing every device out of a paying family is closer to an account-administration
/// act than to a content act, and the seeded permission set (migration 0014) has no
/// customer-operations permission. `manage_permissions` is the narrowest existing
/// permission that only account administrators hold. Inventing a new one that no role
/// holds would make the feature unreachable — the same trap avoided in the workflow and
/// support routers.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { queryFirst } from '../lib/db.ts';
import { requireAdmin, requirePermission } from '../lib/adminAuth.ts';
import { actorId, auditStatement } from '../lib/auditLog.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';

type AppEnv = { Bindings: Env };

const route = new Hono<AppEnv>();

/// Confirms the family exists before touching the authority.
///
/// Read from the projection rather than from the Durable Object: a stub is created on
/// demand for *any* id, so calling the object first would silently create an empty
/// family for a typo and report success against it.
async function familyExists(env: Env, parentId: string): Promise<boolean> {
  const row = await queryFirst<{ parent_id: string }>(env.DB, `
    SELECT parent_id FROM family_projection WHERE parent_id = ?
  `, [parentId]);
  return !!row;
}

function requireReason(body: Record<string, unknown> | null): string | null {
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  return reason ? reason.slice(0, 500) : null;
}

/// `GET /admin/families/:id/device-state` — the operator's read of the authority.
route.get('/families/:id/device-state', requireAdmin, async (c) => {
  const parentId = c.req.param('id') ?? '';
  if (!await familyExists(c.env, parentId)) return c.json({ success: false, error: 'Family not found' }, 404);

  const result = await callDurable<{ success: boolean; data?: Record<string, unknown> }>(
    familyStub(c.env, parentId), '/admin/inspect', { method: 'GET' },
  );
  if (!result.ok || !result.data?.success) {
    // An unreachable authority is not "no devices": only one of those answers means the
    // family can sign in.
    return c.json({
      success: false,
      error: 'Family state is unavailable right now',
      data: { source: 'family_state', reachable: false },
    }, 503);
  }

  await auditStatement(c.env.DB, actorId(c), 'view', 'family_device_state', parentId, {
    source: 'family_state',
  }).run();

  return c.json({ success: true, data: { ...result.data.data, source: 'family_state' } });
});

/// `POST /admin/families/:id/devices/:deviceId/revoke`
route.post('/families/:id/devices/:deviceId/revoke', requirePermission('manage_permissions'), async (c) => {
  const parentId = c.req.param('id') ?? '';
  const deviceId = c.req.param('deviceId') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const reason = requireReason(body);
  if (!reason) return c.json({ success: false, error: 'reason is required for a device revocation' }, 400);
  if (!await familyExists(c.env, parentId)) return c.json({ success: false, error: 'Family not found' }, 404);

  // Audited before the effect: a command that fails mid-flight must still show that it
  // was attempted, and by whom.
  await auditStatement(c.env.DB, actorId(c), 'device_revoke_requested', 'family_device', deviceId, {
    parent_id: parentId, reason,
  }).run();

  const result = await callDurable<{ success: boolean; data?: Record<string, unknown>; error?: string }>(
    familyStub(c.env, parentId), '/admin/devices/revoke',
    { body: { device_id: deviceId, actor_id: actorId(c), reason } },
  );
  if (!result.ok || !result.data?.success) {
    return c.json({
      success: false,
      error: result.data?.error ?? 'Family state rejected the revocation',
    }, result.status === 404 ? 404 : 502);
  }

  await auditStatement(c.env.DB, actorId(c), 'device_revoke', 'family_device', deviceId, {
    parent_id: parentId, reason, result: result.data.data ?? {},
  }).run();

  return c.json({ success: true, data: { ...result.data.data, source: 'family_state' } });
});

/// `POST /admin/families/:id/downloads/revoke`
///
/// `device_id` is optional: omitting it ends offline access on every device, which is
/// the shape needed when a subscription lapses rather than when one tablet is lost.
route.post('/families/:id/downloads/revoke', requirePermission('manage_permissions'), async (c) => {
  const parentId = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const reason = requireReason(body);
  if (!reason) return c.json({ success: false, error: 'reason is required' }, 400);
  const deviceId = typeof body?.device_id === 'string' && body.device_id.trim() ? body.device_id.trim() : null;
  if (!await familyExists(c.env, parentId)) return c.json({ success: false, error: 'Family not found' }, 404);

  await auditStatement(c.env.DB, actorId(c), 'downloads_revoke_requested', 'family_device', deviceId ?? parentId, {
    parent_id: parentId, device_id: deviceId, reason,
  }).run();

  const result = await callDurable<{ success: boolean; data?: Record<string, unknown>; error?: string }>(
    familyStub(c.env, parentId), '/admin/downloads/revoke',
    { body: { device_id: deviceId, actor_id: actorId(c), reason } },
  );
  if (!result.ok || !result.data?.success) {
    return c.json({ success: false, error: result.data?.error ?? 'Family state rejected the request' }, 502);
  }

  await auditStatement(c.env.DB, actorId(c), 'downloads_revoke', 'family_device', deviceId ?? parentId, {
    parent_id: parentId, device_id: deviceId, reason, result: result.data.data ?? {},
  }).run();

  return c.json({ success: true, data: { ...result.data.data, source: 'family_state' } });
});

/// `POST /admin/families/:id/resync`
///
/// Re-emits the authority's current state so the D1 projection catches up after a
/// dropped or dead-lettered event. It does not write D1: the snapshot goes through the
/// same consumer as every other event, so a resync cannot produce a projection shape the
/// normal flow could not.
route.post('/families/:id/resync', requirePermission('manage_permissions'), async (c) => {
  const parentId = c.req.param('id') ?? '';
  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const reason = requireReason(body);
  if (!reason) return c.json({ success: false, error: 'reason is required' }, 400);
  if (!await familyExists(c.env, parentId)) return c.json({ success: false, error: 'Family not found' }, 404);

  const result = await callDurable<{ success: boolean; data?: Record<string, unknown>; error?: string }>(
    familyStub(c.env, parentId), '/admin/resync',
    { body: { actor_id: actorId(c), reason } },
  );
  if (!result.ok || !result.data?.success) {
    return c.json({ success: false, error: result.data?.error ?? 'Family state rejected the resync' }, 502);
  }

  await auditStatement(c.env.DB, actorId(c), 'family_resync', 'family', parentId, {
    reason, result: result.data.data ?? {},
  }).run();

  return c.json({
    success: true,
    data: {
      ...result.data.data,
      source: 'family_state',
      // The projection updates when the queue delivers the event, not synchronously.
      // Saying so prevents an operator refreshing D1 and concluding the resync failed.
      note: 'A snapshot event was emitted; the D1 projection updates when the queue delivers it.',
    },
  });
});

export default route;
