import type { Env } from './db';
import { sha256Base64Url } from './security';

type DurableResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

export function familyStub(env: Env, parentId: string) {
  return env.FAMILY_STATE.get(env.FAMILY_STATE.idFromName(parentId));
}

export async function identityStub(env: Env, normalizedEmail: string) {
  const identityName = await sha256Base64Url(normalizedEmail);
  return env.IDENTITY_STATE.get(env.IDENTITY_STATE.idFromName(identityName));
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
