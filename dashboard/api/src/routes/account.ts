import { Hono } from 'hono';
import type { Env } from '../lib/db.ts';
import { callDurable, familyStub, identityForParent } from '../lib/doClient.ts';
import { sha256Base64Url } from '../lib/security.ts';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  authenticateParent,
  createParentAccessToken,
  verifyParentProof,
  type ParentPrincipal,
  type ParentProofPurpose,
} from '../lib/parentAuth.ts';

type AppEnv = { Bindings: Env };
type JsonBody = Record<string, unknown>;
type Envelope<T> = { success: boolean; data?: T; error?: string };

const accountRoute = new Hono<AppEnv>();

async function body(c: { req: { json(): Promise<unknown> } }): Promise<JsonBody | null> {
  const value = await c.req.json().catch(() => null);
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonBody : null;
}

function unauthorized(reason: 'unconfigured' | 'unauthorized') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured' ? 'Parent authentication is not configured' : 'Unauthorized',
  }, { status: reason === 'unconfigured' ? 503 : 401 });
}

function proofDenied(reason: 'unconfigured' | 'invalid') {
  return Response.json({
    success: false,
    error: reason === 'unconfigured'
      ? 'Parent authentication is not configured'
      : 'A current parent proof is required',
  }, { status: reason === 'unconfigured' ? 503 : 403 });
}

function forward(result: { status: number; data: unknown }) {
  return Response.json(
    result.data ?? { success: false, error: 'Account service unavailable' },
    { status: result.status },
  );
}

async function requireProof(
  env: Env,
  principal: ParentPrincipal,
  header: string | undefined,
  purpose: ParentProofPurpose,
  consume = false,
) {
  return verifyParentProof(env, { principal, header, purpose, consume });
}

async function identity(env: Env, parentId: string) {
  return identityForParent(env, parentId);
}

function requestId(value: string | undefined) {
  const normalized = value?.trim();
  return normalized && normalized.length >= 8 && normalized.length <= 200
    ? normalized
    : crypto.randomUUID();
}

async function requestDeletionWithRecovery(
  env: Env,
  parentId: string,
  requestBody: Record<string, unknown>,
  statusPath: '/lifecycle/status' | '/lifecycle/status-capability',
  statusBody: Record<string, unknown>,
) {
  const stub = familyStub(env, parentId);
  const submit = () => callDurable<unknown>(stub, '/lifecycle/request', { body: requestBody });
  const resolveStatus = () => callDurable<unknown>(stub, statusPath, { body: statusBody });

  try {
    return await submit();
  } catch {
    // A rejected Worker→DO fetch has no authoritative outcome: the DO may have
    // committed before its response was lost. Resolve by the same idempotency
    // key, retry once, then resolve again before emitting an explicit unknown.
  }

  try {
    const resolved = await resolveStatus();
    if (resolved.ok) return { ...resolved, status: 202 };
  } catch {}

  let retryResult: Awaited<ReturnType<typeof submit>> | undefined;
  try {
    retryResult = await submit();
    if (retryResult.ok) return retryResult;
  } catch {}

  try {
    const resolved = await resolveStatus();
    if (resolved.ok) return { ...resolved, status: 202 };
    // A 404 is the only authoritative proof that this same key has no accepted
    // job. Preserve a concrete retry rejection instead of misclassifying it as
    // an ambiguous outcome; if the retry was also lost, the 404 itself is final.
    if (resolved.status === 404) return retryResult ?? resolved;
  } catch {}

  return {
    ok: false,
    status: 503,
    data: {
      success: false,
      error: 'Deletion outcome could not be confirmed',
      code: 'deletion_outcome_unknown',
      request_id: requestBody.request_id,
    },
  };
}

accountRoute.get('/profile', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'parent_area',
  );
  if (!proof.ok) return proofDenied(proof.reason);

  const locator = await identity(c.env, auth.principal.parentId);
  if (!locator || locator.status !== 'active') {
    return c.json({ success: false, error: 'Account identity is unavailable' }, 503);
  }
  return forward(await callDurable(locator.stub, '/profile', {
    body: { parent_id: auth.principal.parentId },
  }));
});

accountRoute.patch('/profile', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'parent_area',
  );
  if (!proof.ok) return proofDenied(proof.reason);

  const value = await body(c);
  const displayName = value?.display_name === null
    ? null
    : typeof value?.display_name === 'string' && value.display_name.trim().length > 0
      ? value.display_name.trim().slice(0, 80)
      : undefined;
  if (displayName === undefined) {
    return c.json({ success: false, error: 'A valid display_name is required' }, 400);
  }

  const operationId = requestId(c.req.header('Idempotency-Key'));
  const familyUpdate = await callDurable<Envelope<{
    display_name: string | null;
    synchronized: boolean;
  }>>(
    familyStub(c.env, auth.principal.parentId),
    '/profile/update',
    {
      body: {
        session_id: auth.principal.sessionId,
        operation_id: operationId,
        display_name: displayName,
      },
    },
  );
  return forward(familyUpdate);
});

accountRoute.post('/change-password', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);

  const value = await body(c);
  const currentPassword = typeof value?.current_password === 'string' ? value.current_password : '';
  const newPassword = typeof value?.new_password === 'string' ? value.new_password : '';
  if (currentPassword.length < 1 || newPassword.length < 12 || newPassword.length > 256) {
    return c.json({ success: false, error: 'Current password and a new password of at least 12 characters are required' }, 400);
  }

  const proof = await requireProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'change_password',
    true,
  );
  if (!proof.ok) return proofDenied(proof.reason);

  const locator = await identity(c.env, auth.principal.parentId);
  if (!locator || locator.status !== 'active') {
    return c.json({ success: false, error: 'Account identity is unavailable' }, 503);
  }
  const verified = await callDurable<Envelope<{ verified: boolean }>>(locator.stub, '/password/verify', {
    body: {
      parent_id: auth.principal.parentId,
      password: currentPassword,
      new_password: newPassword,
    },
  });
  if (!verified.ok || !verified.data?.success) return forward(verified);

  // Rotate the family epoch before installing the new identity credential. If
  // the identity commit fails, old sessions are already closed and the current
  // password remains valid for a safe retry.
  const rotated = await callDurable<Envelope<{
    revoked: number;
    parent_id: string;
    session_id: string;
    device_id: string;
    plan: ParentPrincipal['plan'];
    auth_epoch: number;
  }>>(familyStub(c.env, auth.principal.parentId), '/sessions/revoke-others', {
    body: { session_id: auth.principal.sessionId },
  });
  const session = rotated.data?.success ? rotated.data.data : null;
  if (!rotated.ok || !session) {
    return c.json({ success: false, error: 'Active sessions could not be rotated. The password was not changed.' }, 503);
  }

  const changed = await callDurable<Envelope<{ changed: boolean }>>(locator.stub, '/password/change', {
    body: {
      parent_id: auth.principal.parentId,
      current_password: currentPassword,
      new_password: newPassword,
    },
  });
  if (!changed.ok || !changed.data?.success) return forward(changed);

  const nextPrincipal: ParentPrincipal = {
    parentId: session.parent_id,
    sessionId: session.session_id,
    deviceId: session.device_id,
    plan: session.plan,
    authEpoch: session.auth_epoch,
  };
  return c.json({
    success: true,
    data: {
      changed: true,
      other_sessions_revoked: session.revoked,
      access_token: await createParentAccessToken(c.env, nextPrincipal),
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    },
  });
});

accountRoute.get('/export', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'export_data',
    true,
  );
  if (!proof.ok) return proofDenied(proof.reason);

  const locator = await identity(c.env, auth.principal.parentId);
  if (!locator || locator.status !== 'active') {
    return c.json({ success: false, error: 'Account identity is unavailable' }, 503);
  }
  const [profile, family] = await Promise.all([
    callDurable<Envelope<Record<string, unknown>>>(locator.stub, '/profile', {
      body: { parent_id: auth.principal.parentId },
    }),
    callDurable<Envelope<Record<string, unknown>>>(
      familyStub(c.env, auth.principal.parentId),
      '/export',
      { body: { session_id: auth.principal.sessionId } },
    ),
  ]);
  if (!profile.ok || !profile.data?.success || !profile.data.data) return forward(profile);
  if (!family.ok || !family.data?.success || !family.data.data) return forward(family);

  const payload = {
    schema_version: 1,
    exported_at: new Date().toISOString(),
    account: profile.data.data,
    ...family.data.data,
  };
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="majarra-data-export-${date}.json"`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

accountRoute.get('/deletions/:requestId', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const proof = await requireProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'parent_area',
  );
  if (!proof.ok) return proofDenied(proof.reason);
  return forward(await callDurable(
    familyStub(c.env, auth.principal.parentId),
    '/lifecycle/status',
    {
      body: {
        session_id: auth.principal.sessionId,
        request_id: c.req.param('requestId'),
      },
    },
  ));
});

// Account deletion revokes the authenticating session immediately. Recovery
// therefore uses a client-generated 256-bit capability retained in secure
// storage, never a bearer session and never a secret in the URL.
accountRoute.post('/deletions/status', async (c) => {
  const value = await body(c);
  const parentId = typeof value?.parent_id === 'string' ? value.parent_id : '';
  const deletionRequestId = typeof value?.request_id === 'string' ? value.request_id : '';
  const receiptSecret = typeof value?.receipt_secret === 'string' ? value.receipt_secret : '';
  if (parentId.length < 8 || parentId.length > 200
    || deletionRequestId.length < 8 || deletionRequestId.length > 200
    || !/^[A-Za-z0-9_-]{43}$/.test(receiptSecret)) {
    return c.json({ success: false, error: 'Deletion receipt is invalid' }, 400);
  }
  const result = await callDurable(
    familyStub(c.env, parentId),
    '/lifecycle/status-capability',
    {
      body: {
        request_id: deletionRequestId,
        receipt_hash: await sha256Base64Url(receiptSecret),
      },
    },
  );
  return new Response(JSON.stringify(
    result.data ?? { success: false, error: 'Deletion receipt is invalid' },
  ), {
    status: result.status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

accountRoute.delete('/children/:childId', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const id = requestId(c.req.header('Idempotency-Key'));

  const existing = await callDurable(
    familyStub(c.env, auth.principal.parentId),
    '/lifecycle/status',
    {
      body: {
        session_id: auth.principal.sessionId,
        request_id: id,
        scope: 'child',
        child_id: c.req.param('childId'),
      },
    },
  );
  if (existing.ok) return forward(existing);

  const proof = await requireProof(
    c.env,
    auth.principal,
    c.req.header('X-Parent-Proof'),
    'delete_child',
    true,
  );
  if (!proof.ok) return proofDenied(proof.reason);
  const requestBody = {
    session_id: auth.principal.sessionId,
    request_id: id,
    scope: 'child' as const,
    child_id: c.req.param('childId'),
  };
  return forward(await requestDeletionWithRecovery(
    c.env,
    auth.principal.parentId,
    requestBody,
    '/lifecycle/status',
    requestBody,
  ));
});

accountRoute.delete('/delete', async (c) => {
  const auth = await authenticateParent(c.env, c.req.header('Authorization'));
  if (!auth.ok) return unauthorized(auth.reason);
  const value = await body(c);
  const currentPassword = typeof value?.current_password === 'string' ? value.current_password : '';
  const receiptSecret = typeof value?.receipt_secret === 'string' ? value.receipt_secret : '';
  if (!currentPassword) return c.json({ success: false, error: 'Current password is required' }, 400);
  if (!/^[A-Za-z0-9_-]{43}$/.test(receiptSecret)) {
    return c.json({ success: false, error: 'A valid deletion receipt is required' }, 400);
  }

  // Reject callers without the purpose-bound capability before password
  // verification can affect lockout counters or become a credential oracle.
  // Consume only after the password succeeds so a typo does not burn the proof.
  const proofHeader = c.req.header('X-Parent-Proof');
  const authorizedProof = await requireProof(
    c.env,
    auth.principal,
    proofHeader,
    'delete_account',
  );
  if (!authorizedProof.ok) return proofDenied(authorizedProof.reason);

  const locator = await identity(c.env, auth.principal.parentId);
  if (!locator || locator.status !== 'active') {
    return c.json({ success: false, error: 'Account identity is unavailable' }, 503);
  }
  const verified = await callDurable<Envelope<{ verified: boolean }>>(locator.stub, '/password/verify', {
    body: { parent_id: auth.principal.parentId, password: currentPassword },
  });
  if (!verified.ok || !verified.data?.success) return forward(verified);

  const proof = await requireProof(
    c.env,
    auth.principal,
    proofHeader,
    'delete_account',
    true,
  );
  if (!proof.ok) return proofDenied(proof.reason);

  const id = requestId(c.req.header('Idempotency-Key'));
  const receiptHash = await sha256Base64Url(receiptSecret);
  return forward(await requestDeletionWithRecovery(
    c.env,
    auth.principal.parentId,
    {
      session_id: auth.principal.sessionId,
      request_id: id,
      scope: 'account',
      receipt_hash: receiptHash,
    },
    '/lifecycle/status-capability',
    {
      request_id: id,
      receipt_hash: receiptHash,
    },
  ));
});

export default accountRoute;
