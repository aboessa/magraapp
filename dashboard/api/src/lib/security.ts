const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const PASSWORD_ITERATIONS = 100000;
const PASSWORD_ALGORITHM = 'pbkdf2-sha256';

function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value) as BufferSource);
  return new Uint8Array(signature);
}

export function hasUsableSecret(value: string | undefined): value is string {
  return typeof value === 'string' && encoder.encode(value).length >= 32;
}

export function randomToken(bytes = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value) as BufferSource);
  return base64Url(new Uint8Array(digest));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encoder.encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: salt as BufferSource,
    iterations: PASSWORD_ITERATIONS,
    hash: 'SHA-256',
  }, key, 256);
  return `${PASSWORD_ALGORITHM}$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [algorithm, iterationsText, saltText, expectedText] = stored.split('$');
  const iterations = Number(iterationsText);
  const salt = saltText ? fromBase64Url(saltText) : null;
  const expected = expectedText ? fromBase64Url(expectedText) : null;
  if (algorithm !== PASSWORD_ALGORITHM || !Number.isInteger(iterations) || iterations < 1 || !salt || !expected) return false;

  const key = await crypto.subtle.importKey('raw', encoder.encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: salt as BufferSource,
    iterations,
    hash: 'SHA-256',
  }, key, 256);
  return constantTimeEqual(new Uint8Array(derived), expected);
}

export async function createHmacSignature(value: string, secret: string) {
  if (!hasUsableSecret(secret)) throw new Error('Signing secret is not configured');
  return base64Url(await hmac(value, secret));
}

/// Encrypts a small server-side locator with authenticated encryption. The
/// purpose is included both in the HMAC-based key derivation and as AES-GCM
/// additional data, so the auth signing secret can be reused without allowing a
/// ciphertext from one domain to be opened in another.
export async function sealOpaqueValue(value: string, secret: string, purpose: string) {
  if (!hasUsableSecret(secret) || !purpose) throw new Error('Encryption secret is not configured');
  const keyBytes = await hmac(`majarra:opaque-key:v1:${purpose}`, secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({
    name: 'AES-GCM',
    iv: iv as BufferSource,
    additionalData: encoder.encode(`majarra:opaque-aad:v1:${purpose}`) as BufferSource,
  }, key, encoder.encode(value) as BufferSource);
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function openOpaqueValue(value: string, secret: string, purpose: string): Promise<string | null> {
  if (!hasUsableSecret(secret) || !purpose) return null;
  const [version, ivText, encryptedText, ...extra] = value.split('.');
  if (version !== 'v1' || !ivText || !encryptedText || extra.length) return null;
  const iv = fromBase64Url(ivText);
  const encrypted = fromBase64Url(encryptedText);
  if (!iv || iv.length !== 12 || !encrypted || encrypted.length < 16) return null;

  try {
    const keyBytes = await hmac(`majarra:opaque-key:v1:${purpose}`, secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );
    const plaintext = await crypto.subtle.decrypt({
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: encoder.encode(`majarra:opaque-aad:v1:${purpose}`) as BufferSource,
    }, key, encrypted as BufferSource);
    return decoder.decode(plaintext);
  } catch {
    return null;
  }
}

export async function verifyHmacSignature(value: string, signature: string, secret: string) {
  if (!hasUsableSecret(secret)) return false;
  const supplied = fromBase64Url(signature);
  if (!supplied) return false;
  return constantTimeEqual(supplied, await hmac(value, secret));
}

export async function createSignedToken(payload: Record<string, unknown>, secret: string) {
  if (!hasUsableSecret(secret)) throw new Error('Signing secret is not configured');
  const encodedPayload = base64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await hmac(encodedPayload, secret);
  return `${encodedPayload}.${base64Url(signature)}`;
}

export async function verifySignedToken<T extends Record<string, unknown>>(token: string, secret: string): Promise<T | null> {
  if (!hasUsableSecret(secret)) return null;
  const [encodedPayload, encodedSignature, ...extra] = token.split('.');
  if (!encodedPayload || !encodedSignature || extra.length) return null;
  const suppliedSignature = fromBase64Url(encodedSignature);
  if (!suppliedSignature) return null;

  const expectedSignature = await hmac(encodedPayload, secret);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  const bytes = fromBase64Url(encodedPayload);
  if (!bytes) return null;
  try {
    const parsed = JSON.parse(decoder.decode(bytes));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}
