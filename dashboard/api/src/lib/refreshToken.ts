const VERSION = 'v1';
const IDENTIFIER_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;

export type RefreshTokenParts = {
  parentId: string;
  sessionId: string;
  secret: string;
};

export type ParsedRefreshToken = RefreshTokenParts & { signature: string };

function validParts(parts: RefreshTokenParts) {
  return IDENTIFIER_PATTERN.test(parts.parentId)
    && IDENTIFIER_PATTERN.test(parts.sessionId)
    && SECRET_PATTERN.test(parts.secret);
}

export function refreshTokenSigningInput(parts: RefreshTokenParts) {
  if (!validParts(parts)) throw new Error('Invalid refresh token components');
  return `${VERSION}.${parts.parentId}.${parts.sessionId}.${parts.secret}`;
}

export function createStructuredRefreshToken(parts: RefreshTokenParts, signature: string) {
  if (!SIGNATURE_PATTERN.test(signature)) throw new Error('Invalid refresh token signature');
  return `${refreshTokenSigningInput(parts)}.${signature}`;
}

export function parseStructuredRefreshToken(token: string): ParsedRefreshToken | null {
  const [version, parentId, sessionId, secret, signature, ...extra] = token.split('.');
  if (version !== VERSION || extra.length || !parentId || !sessionId || !secret || !signature) return null;
  const parts = { parentId, sessionId, secret };
  if (!validParts(parts) || !SIGNATURE_PATTERN.test(signature)) return null;
  return { ...parts, signature };
}
