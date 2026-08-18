/// Child creations: upload, list, read, delete.
///
/// Every handler is parent-authenticated and every ownership decision is made by
/// `FamilyState`, which is the authority for which children belong to an account.
/// A creation id from another family is not "forbidden" here — it is *not found*,
/// because a family's Durable Object holds only that family's rows, so a
/// cross-family reference cannot be expressed at all.
///
/// Reads are served by this worker from the private bucket. There is deliberately
/// no signed-URL form and no public URL form: the bytes travel through an
/// authenticated request or not at all.

import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { callDurable, familyStub } from '../lib/doClient.ts';
import { authenticateParent, verifyParentProof } from '../lib/parentAuth.ts';
import { evaluateConsent, type ConsentRow } from '../lib/consent.ts';
import {
  creationClaimError,
  creationKeyBelongsTo,
  creationStorageKey,
  extensionForCreationType,
  isSafeStorageId,
  MAX_CREATION_BYTES,
  sniffImageType,
} from '../lib/creationStorage.ts';

type AppEnv = { Bindings: Env };

const creationsRoute = new Hono<AppEnv>();

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

/// The creations bucket, or null when the binding is absent.
///
/// Absent is a 503 rather than a fallback to another bucket: silently writing a
/// child's drawing into catalogue media would be the exact failure this whole
/// design exists to prevent.
function creationsBucket(env: Env): R2Bucket | null {
  const bucket = (env as unknown as { CREATIONS_BUCKET?: R2Bucket }).CREATIONS_BUCKET;
  return bucket ?? null;
}

/// Confirms the child belongs to the authenticated parent.
async function assertChild(env: Env, parentId: string, childId: string): Promise<boolean> {
  const state = await callDurable(familyStub(env, parentId), '/state', {});
  if (state.status !== 200) return false;
  const children = (state.data as { data?: { children?: Array<Record<string, unknown>> } })
    ?.data?.children ?? [];
  return children.some((entry) => String(entry.id) === childId);
}

/// `POST /api/v1/creations` — upload one drawing.
///
/// The body is the raw image. Metadata arrives as query parameters so the request
/// stays a single round trip: a separate "create intent" call would leave an
/// unreferenced object behind whenever the second call never came.
creationsRoute.post('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const bucket = creationsBucket(c.env);
  if (!bucket) return c.json({ success: false, error: 'Creation storage is not configured' }, 503);

  const childId = c.req.query('child_id')?.trim() ?? '';
  const gameId = c.req.query('game_id')?.trim() || null;
  const drawingMode = c.req.query('drawing_mode')?.trim() ?? '';
  const mimeType = (c.req.header('Content-Type') ?? '').split(';')[0].trim();
  const width = Number.parseInt(c.req.query('width') ?? '', 10);
  const height = Number.parseInt(c.req.query('height') ?? '', 10);

  if (!isSafeStorageId(childId)) {
    return c.json({ success: false, error: 'A valid child_id is required' }, 400);
  }
  if (!drawingMode) {
    return c.json({ success: false, error: 'drawing_mode is required' }, 400);
  }
  if (!await assertChild(c.env, auth.principal.parentId, childId)) {
    return c.json({ success: false, error: 'Child not found for this account' }, 404);
  }

  // Consent gate. Storing an image a child drew is not covered by the telemetry
  // consent a family may already have given, so it is asked separately and this
  // route refuses until it is granted. Without this check the documented
  // "absence of a row means no consent" was not enforced anywhere and a drawing
  // could be stored without the parent ever being asked.
  const consentResult = await callDurable<{ success: boolean; data?: { consents?: ConsentRow[] } }>(
    familyStub(c.env, auth.principal.parentId), '/consents', {},
  );
  const consent = evaluateConsent(
    consentResult.data?.data?.consents ?? [],
    'child_creations',
    childId,
  );
  if (!consent.granted) {
    return c.json({
      success: false,
      error: 'Saving a child\'s drawing to family storage needs parental consent',
      // Named so the client can present the exact grant it must ask for rather
      // than a generic "permission denied".
      consent_required: {
        consent_type: 'child_creations',
        version: consent.required_version,
        reason: consent.reason,
      },
    }, 403);
  }

  const body = await c.req.arrayBuffer();
  const bytes = new Uint8Array(body);
  const claimError = creationClaimError({
    mimeType,
    byteSize: bytes.byteLength,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
  });
  if (claimError) return c.json({ success: false, error: claimError }, 400);

  // The declared type is caller-supplied. Storing arbitrary bytes under an image
  // content type is how a private bucket becomes a file drop.
  const sniffed = sniffImageType(bytes);
  if (sniffed === null || sniffed !== mimeType) {
    return c.json({
      success: false,
      error: `Body is not a valid ${mimeType} image`,
    }, 400);
  }

  const creationId = crypto.randomUUID();
  const storageKey = creationStorageKey({
    familyId: auth.principal.parentId,
    childId,
    creationId,
    mimeType,
  });
  if (!storageKey) return c.json({ success: false, error: 'Could not derive a storage key' }, 400);

  await bucket.put(storageKey, bytes, {
    httpMetadata: {
      contentType: mimeType,
      // Belt and braces: even if this object were ever fronted by a cache, it
      // must not be stored by one.
      cacheControl: 'private, no-store',
    },
    customMetadata: { childId, creationId, drawingMode },
  });

  // The row is written after the object exists, so a row never points at nothing.
  const registered = await callDurable(familyStub(c.env, auth.principal.parentId), '/creations', {
    body: {
      session_id: auth.principal.sessionId,
      child_id: childId,
      creation_id: creationId,
      game_id: gameId,
      drawing_mode: drawingMode,
      storage_key: storageKey,
      mime_type: mimeType,
      width,
      height,
      byte_size: bytes.byteLength,
    },
  });

  if (registered.status !== 200) {
    // Registration failed, so nothing references the object: remove it rather
    // than leaving an orphan behind.
    await bucket.delete(storageKey);
    return Response.json(
      registered.data ?? { success: false, error: 'Could not record the creation' },
      { status: registered.status },
    );
  }

  return c.json({
    success: true,
    data: { id: creationId, width, height, byte_size: bytes.byteLength },
  }, 201);
});

/// `GET /api/v1/creations?child_id=` — list one child's creations.
creationsRoute.get('/', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const childId = c.req.query('child_id')?.trim() ?? '';
  const result = await callDurable(familyStub(c.env, auth.principal.parentId), '/creations', {});
  if (result.status !== 200) {
    return Response.json(result.data ?? { success: false, error: 'Family service unavailable' }, { status: result.status });
  }

  const all = (result.data as { data?: { creations?: Array<Record<string, unknown>> } })
    ?.data?.creations ?? [];
  const rows = childId ? all.filter((row) => String(row.child_id) === childId) : all;

  // `storage_key` is withheld. The client addresses a creation by id and this
  // worker resolves the key, so no bucket path is ever exposed to a device.
  return c.json({
    success: true,
    data: rows.map((row) => ({
      id: row.id,
      child_id: row.child_id,
      game_id: row.game_id,
      drawing_mode: row.drawing_mode,
      mime_type: row.mime_type,
      width: row.width,
      height: row.height,
      byte_size: row.byte_size,
      created_at: row.created_at,
    })),
  });
});

/// `GET /api/v1/creations/:id/image` — the bytes.
creationsRoute.get('/:id/image', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const bucket = creationsBucket(c.env);
  if (!bucket) return c.json({ success: false, error: 'Creation storage is not configured' }, 503);

  const creationId = c.req.param('id');
  const result = await callDurable(familyStub(c.env, auth.principal.parentId), '/creations', {});
  if (result.status !== 200) {
    return Response.json(result.data ?? { success: false, error: 'Family service unavailable' }, { status: result.status });
  }
  const rows = (result.data as { data?: { creations?: Array<Record<string, unknown>> } })
    ?.data?.creations ?? [];
  const row = rows.find((entry) => String(entry.id) === creationId);
  if (!row) return c.json({ success: false, error: 'Creation not found' }, 404);

  const storageKey = String(row.storage_key ?? '');
  // The row came from this family's own object, so this is a second, independent
  // check rather than the only one.
  if (!creationKeyBelongsTo(storageKey, auth.principal.parentId)) {
    return c.json({ success: false, error: 'Creation not found' }, 404);
  }

  const object = await bucket.get(storageKey);
  if (!object) return c.json({ success: false, error: 'Creation not found' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': String(row.mime_type ?? 'image/png'),
      // Never cached by a shared cache, never stored by an intermediary.
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      // A drawing must not be embeddable or framed by anything.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': `inline; filename="creation.${extensionForCreationType(String(row.mime_type ?? '')) ?? 'png'}"`,
    },
  });
});

/**
 * `DELETE /api/v1/creations/:id`
 *
 * Requires a consumed `delete_creation` proof, matching `POST /purge`.
 *
 * Both endpoints destroy a child's drawing irrecoverably; the only difference is
 * how many. Requiring a parent proof for the many and none for the one meant the
 * gate could be bypassed by looping the unprotected path — and `delete_creation`
 * was a purpose the API issued and never checked. `consume: true` for the same
 * reason `purge` consumes: a destructive action must not be replayable from a
 * captured header.
 */
creationsRoute.delete('/:id', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const proof = await verifyParentProof(c.env, {
    principal: auth.principal,
    header: c.req.header('X-Parent-Proof'),
    purpose: 'delete_creation',
    consume: true,
  });
  if (!proof.ok) {
    return c.json({
      success: false,
      error: proof.reason === 'unconfigured'
        ? 'Parent authentication is not configured'
        : 'A current parent proof is required',
    }, proof.reason === 'unconfigured' ? 503 : 403);
  }

  const bucket = creationsBucket(c.env);
  const creationId = c.req.param('id');

  const result = await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/delete', {
    body: {
      session_id: auth.principal.sessionId,
      creation_id: creationId,
    },
  });
  if (result.status !== 200) {
    return Response.json(result.data ?? { success: false, error: 'Could not delete the creation' }, { status: result.status });
  }

  // The row is soft-deleted first, so a failure here leaves a recoverable state
  // rather than a row pointing at a missing object. The DO has already queued the
  // key, so a failure is retried by POST /creations/reconcile rather than lost.
  const storageKey = (result.data as { data?: { storage_key?: string } })?.data?.storage_key;
  if (bucket && storageKey && creationKeyBelongsTo(storageKey, auth.principal.parentId)) {
    try {
      await bucket.delete(storageKey);
      await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/deletions-settled', {
        body: { session_id: auth.principal.sessionId, settled: [storageKey] },
      });
    } catch (error) {
      await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/deletions-settled', {
        body: {
          session_id: auth.principal.sessionId,
          failed: [storageKey],
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return c.json({ success: true, data: { id: creationId, deleted: true } });
});

/// Deletes every object under `prefix`, paging through the listing.
///
/// The bucket listing is authoritative: it removes objects the metadata table
/// never knew about, which is the only way to guarantee nothing survives a
/// deleted account. Idempotent — a second call simply finds nothing.
async function deleteByPrefix(bucket: R2Bucket, prefix: string): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const listing = await bucket.list({ prefix, cursor, limit: 500 });
    const keys = listing.objects.map((object) => object.key);
    if (keys.length) {
      await bucket.delete(keys);
      deleted += keys.length;
    }
    cursor = listing.truncated ? listing.cursor : undefined;
  } while (cursor);
  return deleted;
}

/// `POST /api/v1/creations/purge` — remove a child's or a family's creations.
///
/// This is the path that makes deletion real. Cascading rows is not sufficient:
/// an R2 object with no row pointing at it is still an image of a child sitting in
/// storage, so the bucket is swept by prefix as well.
///
/// `{ "child_id": "..." }` scopes to one child; omitting it purges the whole
/// family, which is what an account deletion needs.
creationsRoute.post('/purge', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await verifyParentProof(c.env, {
    principal: auth.principal,
    header: c.req.header('X-Parent-Proof'),
    purpose: 'purge_creations',
    consume: true,
  });
  if (!proof.ok) {
    return c.json({
      success: false,
      error: proof.reason === 'unconfigured'
        ? 'Parent authentication is not configured'
        : 'A current parent proof is required',
    }, proof.reason === 'unconfigured' ? 503 : 403);
  }

  const bucket = creationsBucket(c.env);
  const value = await c.req.json().catch(() => null) as Record<string, unknown> | null;
  const childId = typeof value?.child_id === 'string' ? value.child_id.trim() : null;

  if (childId !== null) {
    if (!isSafeStorageId(childId)) {
      return c.json({ success: false, error: 'A valid child_id is required' }, 400);
    }
    // A child that no longer exists must still be purgeable: deletion is the one
    // operation that has to work *after* the profile is gone. Ownership is
    // established by the key prefix, which is derived from the authenticated
    // parent and cannot name another family.
  }

  const result = await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/purge', {
    body: { session_id: auth.principal.sessionId, child_id: childId },
  });
  if (result.status !== 200) {
    return Response.json(result.data ?? { success: false, error: 'Could not purge creations' }, { status: result.status });
  }

  if (!bucket) {
    // Rows are marked deleted and queued; without a bucket binding the objects
    // cannot be touched, and saying so is better than reporting success.
    return c.json({
      success: true,
      data: { rows_purged: true, objects_deleted: 0, storage_configured: false },
    });
  }

  const prefix = childId === null
    ? `family/${auth.principal.parentId}/`
    : `family/${auth.principal.parentId}/child/${childId}/`;
  const objectsDeleted = await deleteByPrefix(bucket, prefix);

  // The sweep is authoritative, so everything queued under this prefix is now
  // settled whether or not it was individually listed.
  const keys = ((result.data as { data?: { storage_keys?: string[] } })?.data?.storage_keys ?? [])
    .filter((key) => key.startsWith(prefix));
  if (keys.length) {
    await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/deletions-settled', {
      body: { session_id: auth.principal.sessionId, settled: keys },
    });
  }

  return c.json({
    success: true,
    data: {
      scope: childId === null ? 'family' : 'child',
      objects_deleted: objectsDeleted,
      storage_configured: true,
    },
  });
});

/// `POST /api/v1/creations/reconcile` — retry object deletions that failed.
///
/// A single delete can leave a row removed and its object present. This drains
/// that queue, and is safe to call repeatedly: a key whose object is already gone
/// settles on the first attempt.
creationsRoute.post('/reconcile', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const bucket = creationsBucket(c.env);
  if (!bucket) return c.json({ success: false, error: 'Creation storage is not configured' }, 503);

  const pending = await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/pending-deletions', {});
  const rows = (pending.data as { data?: { pending?: Array<{ storage_key: string }> } })?.data?.pending ?? [];

  const settled: string[] = [];
  const failed: string[] = [];
  let lastError: string | null = null;
  for (const row of rows) {
    // A key from another family cannot be acted on even if it somehow reached the
    // queue.
    if (!creationKeyBelongsTo(row.storage_key, auth.principal.parentId)) {
      failed.push(row.storage_key);
      lastError = 'key does not belong to this family';
      continue;
    }
    try {
      await bucket.delete(row.storage_key);
      settled.push(row.storage_key);
    } catch (error) {
      failed.push(row.storage_key);
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (settled.length || failed.length) {
    await callDurable(familyStub(c.env, auth.principal.parentId), '/creations/deletions-settled', {
      body: { session_id: auth.principal.sessionId, settled, failed, error: lastError },
    });
  }

  return c.json({ success: true, data: { settled: settled.length, failed: failed.length } });
});

export default creationsRoute;
export { MAX_CREATION_BYTES };
