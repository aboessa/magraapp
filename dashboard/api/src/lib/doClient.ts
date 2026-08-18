import type { Env } from './db.ts';
import {
  createHmacSignature,
  hasUsableSecret,
  openOpaqueValue,
  randomToken,
  sealOpaqueValue,
  sha256Base64Url,
} from './security.ts';

type DurableResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

type DirectoryStatus = 'active' | 'deletion_pending' | 'deleted';

type DirectoryRow = {
  parent_id: string;
  email_hash: string;
  identity_name: string;
  status: DirectoryStatus;
};

export type IdentityLocator = {
  parentId: string | null;
  emailHash: string;
  identityName: string;
  status: DirectoryStatus | 'legacy';
  stub: DurableObjectStub;
};

const EMAIL_LOOKUP_DOMAIN = 'majarra:identity-directory:email:v1';
const IDENTITY_LOCATOR_PURPOSE = 'identity-directory-locator';
const SECURE_EMAIL_PREFIX = 'h1.';
const SEALED_LOCATOR_PREFIX = 'v1.';
const LEGACY_IDENTITY_NAME = /^[A-Za-z0-9_-]{32,128}$/;

function directorySecret(env: Env) {
  const secret = env.AUTH_TOKEN_SECRET;
  if (!hasUsableSecret(secret)) throw new Error('identity_directory_unavailable');
  return secret;
}

async function secureEmailLookup(env: Env, normalizedEmail: string) {
  const signature = await createHmacSignature(
    `${EMAIL_LOOKUP_DOMAIN}\0${normalizedEmail}`,
    directorySecret(env),
  );
  return `${SECURE_EMAIL_PREFIX}${signature}`;
}

async function readDirectoryByEmailHash(env: Env, emailHash: string) {
  try {
    return await env.DB.prepare(`
      SELECT parent_id, email_hash, identity_name, status
      FROM identity_directory WHERE email_hash = ?
    `).bind(emailHash).first<DirectoryRow>();
  } catch (error) {
    console.error('identity_directory_lookup_failed', error instanceof Error ? error.message : String(error));
    throw new Error('identity_directory_unavailable');
  }
}

async function openIdentityName(env: Env, stored: string) {
  if (stored.startsWith(SEALED_LOCATOR_PREFIX)) {
    const opened = await openOpaqueValue(stored, directorySecret(env), IDENTITY_LOCATOR_PURPOSE);
    if (!opened || !LEGACY_IDENTITY_NAME.test(opened)) throw new Error('identity_directory_unavailable');
    return opened;
  }
  // Migration-only compatibility. New writes always seal this locator before it
  // reaches D1, so a leaked directory cannot expose the historical email hash.
  if (!LEGACY_IDENTITY_NAME.test(stored)) throw new Error('identity_directory_unavailable');
  return stored;
}

async function sealIdentityName(env: Env, identityName: string) {
  if (!LEGACY_IDENTITY_NAME.test(identityName)) throw new Error('identity_directory_unavailable');
  return sealOpaqueValue(identityName, directorySecret(env), IDENTITY_LOCATOR_PURPOSE);
}

async function migrateDirectoryRow(
  env: Env,
  row: DirectoryRow,
  secureHash: string,
): Promise<{ row: DirectoryRow; identityName: string }> {
  const identityName = await openIdentityName(env, row.identity_name);
  if (row.email_hash === secureHash && row.identity_name.startsWith(SEALED_LOCATOR_PREFIX)) {
    return { row, identityName };
  }

  const sealedName = await sealIdentityName(env, identityName);
  try {
    const result = await env.DB.prepare(`
      UPDATE identity_directory
      SET email_hash = ?, identity_name = ?, updated_at = datetime('now')
      WHERE parent_id = ? AND email_hash = ? AND identity_name = ?
    `).bind(secureHash, sealedName, row.parent_id, row.email_hash, row.identity_name).run();
    if (Number(result.meta.changes ?? 0) === 1) {
      return {
        row: { ...row, email_hash: secureHash, identity_name: sealedName },
        identityName,
      };
    }
  } catch {
    // A concurrent request may have completed the same migration. Re-read the
    // keyed lookup below; any other conflict remains a fail-closed error.
  }

  const current = await readDirectoryByEmailHash(env, secureHash);
  if (!current || current.parent_id !== row.parent_id) throw new Error('identity_directory_unavailable');
  return { row: current, identityName: await openIdentityName(env, current.identity_name) };
}

export function familyStub(env: Env, parentId: string) {
  return env.FAMILY_STATE.get(env.FAMILY_STATE.idFromName(parentId));
}

export function identityStubByName(env: Env, identityName: string) {
  return env.IDENTITY_STATE.get(env.IDENTITY_STATE.idFromName(identityName));
}

/// Resolves an email to its stable identity object. New directory keys are a
/// domain-separated HMAC. A historical raw SHA-256 key is queried only as a
/// migration fallback and is replaced, together with the encrypted DO locator,
/// before the row is returned.
export async function resolveIdentity(env: Env, normalizedEmail: string): Promise<IdentityLocator> {
  const emailHash = await secureEmailLookup(env, normalizedEmail);
  const legacyIdentityName = await sha256Base64Url(normalizedEmail);
  let row = await readDirectoryByEmailHash(env, emailHash);
  if (!row) row = await readDirectoryByEmailHash(env, legacyIdentityName);

  if (!row) {
    return {
      parentId: null,
      emailHash,
      identityName: legacyIdentityName,
      status: 'legacy',
      stub: identityStubByName(env, legacyIdentityName),
    };
  }

  const migrated = await migrateDirectoryRow(env, row, emailHash);
  return {
    parentId: migrated.row.parent_id,
    emailHash: migrated.row.email_hash,
    identityName: migrated.identityName,
    status: migrated.row.status,
    stub: identityStubByName(env, migrated.identityName),
  };
}

export async function identityStub(env: Env, normalizedEmail: string) {
  return (await resolveIdentity(env, normalizedEmail)).stub;
}

export async function identityForParent(env: Env, parentId: string): Promise<IdentityLocator | null> {
  try {
    let row = await env.DB.prepare(`
      SELECT parent_id, email_hash, identity_name, status
      FROM identity_directory WHERE parent_id = ?
    `).bind(parentId).first<DirectoryRow>();
    if (!row) return null;

    let identityName = await openIdentityName(env, row.identity_name);
    let targetEmailHash = row.email_hash;

    // Rows written by the pre-HMAC implementation can also be reached by
    // parent id. Ask the already-located IdentityState for its email, verify it
    // against the old digest, and migrate without ever copying the email to D1.
    if (row.status === 'active' && !row.email_hash.startsWith(SECURE_EMAIL_PREFIX)) {
      const profile = await callDurable<{
        success: boolean;
        data?: { parent_id: string; email: string };
      }>(identityStubByName(env, identityName), '/profile', {
        body: { parent_id: parentId },
      });
      const email = profile.data?.success === true ? profile.data.data?.email : null;
      if (!profile.ok || !email || profile.data?.data?.parent_id !== parentId
        || await sha256Base64Url(email) !== row.email_hash) {
        throw new Error('identity_directory_unavailable');
      }
      targetEmailHash = await secureEmailLookup(env, email);
    }

    if (targetEmailHash !== row.email_hash || !row.identity_name.startsWith(SEALED_LOCATOR_PREFIX)) {
      const sealedName = await sealIdentityName(env, identityName);
      const result = await env.DB.prepare(`
        UPDATE identity_directory
        SET email_hash = ?, identity_name = ?, updated_at = datetime('now')
        WHERE parent_id = ? AND email_hash = ? AND identity_name = ?
      `).bind(targetEmailHash, sealedName, parentId, row.email_hash, row.identity_name).run();
      if (Number(result.meta.changes ?? 0) !== 1) {
        const current = await env.DB.prepare(`
          SELECT parent_id, email_hash, identity_name, status
          FROM identity_directory WHERE parent_id = ?
        `).bind(parentId).first<DirectoryRow>();
        if (!current) throw new Error('identity_directory_unavailable');
        row = current;
        identityName = await openIdentityName(env, current.identity_name);
      } else {
        row = { ...row, email_hash: targetEmailHash, identity_name: sealedName };
      }
    }

    return {
      parentId: row.parent_id,
      emailHash: row.email_hash,
      identityName,
      status: row.status,
      stub: identityStubByName(env, identityName),
    };
  } catch {
    return null;
  }
}

export async function upsertIdentityDirectory(env: Env, values: {
  parentId: string;
  emailHash: string;
  identityName: string;
}) {
  if (!values.emailHash.startsWith(SECURE_EMAIL_PREFIX)) return false;
  try {
    const sealedName = await sealIdentityName(env, values.identityName);
    const result = await env.DB.prepare(`
      INSERT INTO identity_directory (parent_id, email_hash, identity_name, status)
      VALUES (?, ?, ?, 'active')
      ON CONFLICT(parent_id) DO UPDATE SET
        email_hash = excluded.email_hash,
        identity_name = excluded.identity_name,
        updated_at = datetime('now')
      WHERE identity_directory.status = 'active'
    `).bind(values.parentId, values.emailHash, sealedName).run();
    return Number(result.meta.changes ?? 0) === 1;
  } catch (error) {
    console.error('identity_directory_upsert_failed', error instanceof Error ? error.message : String(error));
    return false;
  }
}

export async function setIdentityDirectoryStatus(
  env: Env,
  parentId: string,
  status: 'deletion_pending',
) {
  try {
    const result = await env.DB.prepare(`
      UPDATE identity_directory SET status = ?, updated_at = datetime('now')
      WHERE parent_id = ? AND status = 'active'
    `).bind(status, parentId).run();
    if (Number(result.meta.changes ?? 0) === 1) return true;
    const current = await env.DB.prepare(`
      SELECT status FROM identity_directory WHERE parent_id = ?
    `).bind(parentId).first<{ status: DirectoryStatus }>();
    // Idempotent retries may observe the desired state, but a terminal deleted
    // row must never regress to deletion_pending.
    return current?.status === status;
  } catch {
    return false;
  }
}

export async function tombstoneIdentityDirectory(env: Env, parentId: string) {
  try {
    const tombstoneHash = `t1.${randomToken(32)}`;
    const tombstoneName = await sealIdentityName(env, randomToken(32));
    const result = await env.DB.prepare(`
      UPDATE identity_directory
      SET email_hash = ?, identity_name = ?, status = 'deleted', updated_at = datetime('now')
      WHERE parent_id = ? AND status = 'deletion_pending'
    `).bind(tombstoneHash, tombstoneName, parentId).run();
    if (Number(result.meta.changes ?? 0) === 1) return true;
    const current = await env.DB.prepare(`
      SELECT status FROM identity_directory WHERE parent_id = ?
    `).bind(parentId).first<{ status: DirectoryStatus }>();
    return current?.status === 'deleted';
  } catch {
    return false;
  }
}

export async function callDurable<T>(
  stub: DurableObjectStub,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<DurableResult<T>> {
  const response = await stub.fetch(new Request(`https://durable.internal${path}`, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  }));
  const data = await response.json().catch(() => null) as T | null;
  return { ok: response.ok, status: response.status, data };
}
