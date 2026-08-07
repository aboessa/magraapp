import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boundedInteger,
  deriveAgeTrack,
  PLAN_LIMITS,
  planAllows,
} from '../src/lib/familyPolicy.ts';
import {
  createStructuredRefreshToken,
  parseStructuredRefreshToken,
  refreshTokenSigningInput,
} from '../src/lib/refreshToken.ts';
import {
  createHmacSignature,
  createSignedToken,
  hasUsableSecret,
  hashPassword,
  verifyHmacSignature,
  verifyPassword,
  verifySignedToken,
} from '../src/lib/security.ts';
import { parseFamilyEvent } from '../src/contracts/familyEvents.ts';
import { emailIsConfigured } from '../src/services/email.ts';
import {
  GooglePlayError,
  parseGooglePlayProducts,
  resolveGooglePlaySubscription,
} from '../src/services/googlePlay.ts';
import { googlePubSubIsConfigured, parseGoogleRtdn } from '../src/services/googleOidc.ts';

test('plan ordering and limits are enforced', () => {
  assert.equal(planAllows('family_plus', 'family'), true);
  assert.equal(planAllows('family', 'family_plus'), false);
  assert.equal(PLAN_LIMITS.free.concurrentStreams, 1);
  assert.equal(PLAN_LIMITS.family.concurrentStreams, 2);
  assert.equal(PLAN_LIMITS.family_plus.devices, 8);
});

test('age tracks use UTC month boundaries and reject unsupported ages', () => {
  const now = new Date('2026-08-06T12:00:00Z');
  assert.equal(deriveAgeTrack(8, 2023, now), 'preschool');
  assert.equal(deriveAgeTrack(7, 2020, now), 'kids');
  assert.equal(deriveAgeTrack(8, 2014, now), 'junior');
  assert.equal(deriveAgeTrack(7, 2013, now), null);
  assert.equal(deriveAgeTrack(13, 2020, now), null);
});

test('bounded integers reject fractional and out-of-range values', () => {
  assert.equal(boundedInteger('4', 1, 10), 4);
  assert.equal(boundedInteger(4.5, 1, 10), null);
  assert.equal(boundedInteger(11, 1, 10), null);
});

test('structured refresh tokens route to exactly one family and session', async () => {
  const parts = {
    parentId: 'parent_12345678',
    sessionId: 'session_12345678',
    secret: 'abcdefghijklmnopqrstuvwxyzABCDEFG_1234567890-',
  };
  const signingSecret = '0123456789abcdef0123456789abcdef';
  const signature = await createHmacSignature(refreshTokenSigningInput(parts), signingSecret);
  const token = createStructuredRefreshToken(parts, signature);
  const parsed = parseStructuredRefreshToken(token);
  assert.deepEqual(parsed, { ...parts, signature });
  assert.equal(await verifyHmacSignature(refreshTokenSigningInput(parsed), parsed.signature, signingSecret), true);
  assert.equal(await verifyHmacSignature(refreshTokenSigningInput(parsed), parsed.signature, 'abcdef0123456789abcdef0123456789'), false);
  assert.equal(parseStructuredRefreshToken(`v2.${parts.parentId}.${parts.sessionId}.${parts.secret}.${signature}`), null);
  assert.equal(parseStructuredRefreshToken(`${token}.extra`), null);
  assert.equal(parseStructuredRefreshToken('v1.short.session.secret.signature'), null);
});

test('signed tokens reject tampering and weak secrets', async () => {
  const secret = '0123456789abcdef0123456789abcdef';
  assert.equal(hasUsableSecret(secret), true);
  assert.equal(hasUsableSecret('too-short'), false);
  const token = await createSignedToken({ typ: 'test', sub: 'parent_12345678' }, secret);
  assert.deepEqual(await verifySignedToken(token, secret), { typ: 'test', sub: 'parent_12345678' });
  const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
  assert.equal(await verifySignedToken(tampered, secret), null);
  assert.equal(await verifySignedToken(token, 'abcdef0123456789abcdef0123456789'), null);
});

test('password hashes verify only the original password', async () => {
  const stored = await hashPassword('correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', stored), true);
  assert.equal(await verifyPassword('incorrect horse battery staple', stored), false);
  assert.equal(await verifyPassword('anything', 'malformed'), false);
});

test('family event contracts reject unknown and malformed queue messages', () => {
  const event = {
    eventId: 'event_12345678',
    type: 'child.created',
    schemaVersion: 1,
    parentId: 'parent_12345678',
    occurredAt: Date.now(),
    payload: { childId: 'child_12345678', ageTrack: 'kids' },
  };
  assert.deepEqual(parseFamilyEvent(event), event);
  assert.equal(parseFamilyEvent({ ...event, type: 'unknown.event' }), null);
  assert.equal(parseFamilyEvent({ ...event, schemaVersion: 2 }), null);
  assert.equal(parseFamilyEvent({ ...event, payload: [] }), null);
});

test('email delivery configuration requires all values and an HTTPS verification URL', () => {
  const configured = {
    RESEND_API_KEY: 're_test_key',
    EMAIL_FROM: 'Majarra <accounts@example.com>',
    EMAIL_VERIFICATION_URL: 'https://app.example.com/verify-email',
  };
  assert.equal(emailIsConfigured(configured), true);
  assert.equal(emailIsConfigured({ ...configured, RESEND_API_KEY: undefined }), false);
  assert.equal(emailIsConfigured({ ...configured, EMAIL_VERIFICATION_URL: 'http://app.example.com/verify-email' }), false);
});

test('Google Play product maps permit paid plans only', () => {
  assert.deepEqual(parseGooglePlayProducts('{"majarra_family":"family","majarra_plus":"family_plus"}'), {
    majarra_family: 'family',
    majarra_plus: 'family_plus',
  });
  assert.equal(parseGooglePlayProducts('{"majarra_free":"free"}'), null);
  assert.equal(parseGooglePlayProducts('{"bad product":"family"}'), null);
  assert.equal(parseGooglePlayProducts('not-json'), null);
});

test('Google Play subscriptions are bound to the authenticated parent and mapped server-side', async () => {
  const now = Date.parse('2026-08-06T12:00:00Z');
  const purchase = {
    startTime: '2026-08-01T00:00:00Z',
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    latestOrderId: 'GPA.1234-5678-9012-34567',
    externalAccountIdentifiers: { obfuscatedExternalAccountId: 'parent-hash' },
    lineItems: [{ productId: 'majarra_plus', expiryTime: '2026-09-01T00:00:00Z' }],
  };
  const result = await resolveGooglePlaySubscription(purchase, { majarra_plus: 'family_plus' }, 'parent-hash', now);
  assert.equal(result.plan, 'family_plus');
  assert.equal(result.entitlementStatus, 'active');
  assert.equal(result.providerPurchaseId, 'GPA.1234-5678-9012-34567');

  await assert.rejects(
    resolveGooglePlaySubscription(purchase, { majarra_plus: 'family_plus' }, 'another-parent', now),
    (error) => error instanceof GooglePlayError && error.code === 'invalid_purchase',
  );
  await assert.rejects(
    resolveGooglePlaySubscription(purchase, { another_product: 'family' }, 'parent-hash', now),
    (error) => error instanceof GooglePlayError && error.code === 'invalid_purchase',
  );
});

test('Google Play expiry and hold states cannot retain active access', async () => {
  const base = {
    startTime: '2026-07-01T00:00:00Z',
    externalAccountIdentifiers: { obfuscatedExternalAccountId: 'parent-hash' },
  };
  const expired = await resolveGooglePlaySubscription({
    ...base,
    subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
    lineItems: [{ productId: 'majarra_family', expiryTime: '2026-08-01T00:00:00Z' }],
  }, { majarra_family: 'family' }, 'parent-hash', Date.parse('2026-08-06T12:00:00Z'));
  assert.equal(expired.entitlementStatus, 'expired');

  const held = await resolveGooglePlaySubscription({
    ...base,
    subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD',
    lineItems: [{ productId: 'majarra_family', expiryTime: '2026-09-01T00:00:00Z' }],
  }, { majarra_family: 'family' }, 'parent-hash', Date.parse('2026-08-06T12:00:00Z'));
  assert.equal(held.entitlementStatus, 'revoked');
});

test('Google Pub/Sub configuration and RTDN payloads fail closed', () => {
  const config = {
    GOOGLE_PUBSUB_AUDIENCE: 'https://api.example.com/api/v1/billing/google-play/rtdn',
    GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'play-rtdn@example-project.iam.gserviceaccount.com',
  };
  assert.equal(googlePubSubIsConfigured(config), true);
  assert.equal(googlePubSubIsConfigured({ ...config, GOOGLE_PUBSUB_AUDIENCE: 'http://api.example.com/rtdn' }), false);
  assert.equal(googlePubSubIsConfigured({ ...config, GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL: 'attacker@example.com' }), false);

  const payload = Buffer.from(JSON.stringify({
    packageName: 'com.majarra.majarra',
    subscriptionNotification: { purchaseToken: 'purchase-token-value-that-is-long-enough' },
  })).toString('base64');
  assert.deepEqual(parseGoogleRtdn({ message: { data: payload } }), {
    test: false,
    packageName: 'com.majarra.majarra',
    purchaseToken: 'purchase-token-value-that-is-long-enough',
  });
  assert.equal(parseGoogleRtdn({ message: { data: 'not-base64-json' } }), null);
});