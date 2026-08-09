/**
 * Real HTTP round-trip and security verification for private child creations.
 *
 * Exercises: upload -> CREATIONS_BUCKET -> FamilyState metadata -> list ->
 * authorized read -> delete -> purge, and asserts the security boundary that
 * makes the whole design worth having.
 *
 * Requires a local secret for parent auth (`.dev.vars` with AUTH_TOKEN_SECRET)
 * and a bound CREATIONS_BUCKET, which wrangler dev provides locally.
 *
 * Usage:
 *   npx wrangler dev
 *   node scripts/verify-creations-e2e.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://127.0.0.1:8787';

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
  return ok;
}

async function call(path, { method = 'GET', body, token, raw, contentType } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(contentType ? { 'Content-Type': contentType } : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await response.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* binary or empty */ }
  return { status: response.status, json, text, headers: response.headers };
}

/// The smallest valid PNG: an 8-byte signature is what the server sniffs, and the
/// rest is a real 1x1 image so nothing downstream has to tolerate a stub.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF/AAAAAElFTkSuQmCC',
  'base64',
);

/// Authenticates a fresh family.
///
/// `/api/v1/auth/*` allows 5 requests per 60s per client, and one family costs
/// three (register, verify, login). A second family therefore has to wait out the
/// window rather than be skipped: proving another family cannot reach a creation is
/// the point of the exercise, so [waitOnLimit] trades 60 seconds for real evidence.
/// Authenticates a fresh family.
///
/// `/api/v1/auth/*` allows 5 requests per 60s per client and one family costs
/// three (register, verify, login), so two families in one run - and consecutive
/// runs - exceed it. Rather than skip the cross-family check, which is the whole
/// point of the exercise, this waits out the window once and retries.
async function authenticate(label) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const stamp = `${label}-${Date.now()}`;
    const email = `creations-e2e-${stamp}@example.test`;
    const password = 'Correct-Horse-9';
    const installation = `creations-${stamp}`;

    const registered = await call('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, display_name: 'أسرة', installation_id: installation, platform: 'android' },
    });
    const verification = registered.json?.data?.development_verification_token;

    if (verification) {
      await call('/api/v1/auth/verify-email', { method: 'POST', body: { token: verification } });
      const login = await call('/api/v1/auth/login', {
        method: 'POST',
        body: { email, password, installation_id: installation, platform: 'android' },
      });
      if (login.json?.data?.access_token) {
        return { token: login.json.data.access_token, status: login.status };
      }
      if (login.status !== 429) return { token: null, status: login.status, body: login.json };
    } else if (registered.status !== 429) {
      return { token: null, status: registered.status, body: registered.json };
    }

    if (attempt === 0) {
      console.log('      auth rate limit reached; waiting 62s for the window to reset');
      await new Promise((resolve) => setTimeout(resolve, 62_000));
    }
  }
  return { token: null, status: 429 };
}

async function main() {
  console.log(`# creations end-to-end against ${BASE}\n`);

  const health = await call('/api/v1/site-mode');
  if (!check('dev server reachable', health.status < 500, `status ${health.status}`)) {
    console.log('\nStart the worker first:  npx wrangler dev');
    process.exit(1);
  }

  const auth = await authenticate('a');
  if (!check('parent authenticated', Boolean(auth.token), `status ${auth.status}`)) {
    console.log(JSON.stringify(auth.body ?? {}, null, 2));
    process.exit(1);
  }
  const token = auth.token;

  const child = await call('/api/v1/family/children', {
    method: 'POST', token,
    body: {
      nickname: 'سلمى', birth_month: 5,
      birth_year: new Date().getUTCFullYear() - 4,
      avatar_id: 'avatar-1', language: 'ar',
    },
  });
  const childId = child.json?.data?.id;
  if (!check('child profile created', Boolean(childId), `status ${child.status}`)) {
    console.log(JSON.stringify(child.json, null, 2));
    process.exit(1);
  }

  const query = `child_id=${childId}&game_id=game-fixture-trace-circle&drawing_mode=coloring&width=1&height=1`;

  // 1. Upload.
  const uploaded = await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: PNG_1X1, contentType: 'image/png',
  });
  const creationId = uploaded.json?.data?.id;
  check('a drawing uploads', uploaded.status === 201 && Boolean(creationId),
    `status ${uploaded.status} ${JSON.stringify(uploaded.json)}`);

  // 2. Metadata is listed, and the storage key is NOT exposed.
  const listed = await call(`/api/v1/creations?child_id=${childId}`, { token });
  const row = (listed.json?.data ?? []).find((entry) => entry.id === creationId);
  check('the creation is listed', Boolean(row), `status ${listed.status}`);
  check('the bucket key is never exposed to the client',
    row !== undefined && !('storage_key' in row),
    row ? Object.keys(row).join(',') : 'no row');

  // 3. Authorized read returns the bytes with no-store headers and no framing.
  const image = await call(`/api/v1/creations/${creationId}/image`, { token });
  check('an authorized read returns the image', image.status === 200,
    `status ${image.status}`);
  check('the response is never cached by a shared cache',
    /no-store/.test(image.headers.get('cache-control') ?? ''),
    image.headers.get('cache-control'));
  check('content sniffing is disabled',
    image.headers.get('x-content-type-options') === 'nosniff');
  check('the image cannot be framed or scripted',
    /sandbox/.test(image.headers.get('content-security-policy') ?? ''),
    image.headers.get('content-security-policy'));

  // 4. Unauthenticated read is refused.
  const anonymous = await call(`/api/v1/creations/${creationId}/image`);
  check('an unauthenticated read is refused', anonymous.status === 401,
    `status ${anonymous.status}`);

  // 5. A second family cannot read it. The id is a UUID, so this is the
  //    real-world attack: knowing the id must not be enough.
  const other = await authenticate('b');
  check('a second family authenticated', Boolean(other.token), `status ${other.status}`);
  if (other.token) {
    const cross = await call(`/api/v1/creations/${creationId}/image`, { token: other.token });
    check('another family cannot read the creation', cross.status === 404,
      `status ${cross.status}`);
    const crossList = await call(`/api/v1/creations?child_id=${childId}`, { token: other.token });
    check('another family sees none of this child\'s creations',
      (crossList.json?.data ?? []).length === 0, `${(crossList.json?.data ?? []).length} rows`);
    const crossDelete = await call(`/api/v1/creations/${creationId}`, {
      method: 'DELETE', token: other.token,
    });
    check('another family cannot delete the creation', crossDelete.status === 404,
      `status ${crossDelete.status}`);
  }

  // 6. A non-image body must not be storable, whatever content type it claims.
  const htmlBody = Buffer.from('<html><script>alert(1)</script></html>');
  const spoofed = await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: htmlBody, contentType: 'image/png',
  });
  check('a body that is not really a PNG is refused', spoofed.status === 400,
    `status ${spoofed.status}`);

  const svgBody = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  const svg = await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: svgBody, contentType: 'image/svg+xml',
  });
  check('SVG is refused outright', svg.status === 400, `status ${svg.status}`);

  // 7. Oversized uploads are refused before anything is written.
  const huge = Buffer.concat([PNG_1X1, Buffer.alloc(2 * 1024 * 1024 + 10)]);
  const oversized = await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: huge, contentType: 'image/png',
  });
  check('an oversized upload is refused', oversized.status === 400,
    `status ${oversized.status}`);

  // 8. A creation is not reachable through the public catalogue.
  const publicSeries = await call('/api/v1/series?limit=100');
  check('creations never appear in the public catalogue',
    !/creation|family\//i.test(publicSeries.text), 'catalogue scanned');
  const publicAsset = await call(`/api/v1/media/${creationId}`);
  check('the media route cannot serve a creation id',
    publicAsset.status >= 400, `status ${publicAsset.status}`);

  // 9. Delete removes both the row and the object.
  const deleted = await call(`/api/v1/creations/${creationId}`, { method: 'DELETE', token });
  check('the creation deletes', deleted.status === 200, `status ${deleted.status}`);
  const afterDelete = await call(`/api/v1/creations/${creationId}/image`, { token });
  check('a deleted creation is no longer readable', afterDelete.status === 404,
    `status ${afterDelete.status}`);

  // 10. Purge: upload two more, then purge the child and confirm nothing remains.
  const first = await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: PNG_1X1, contentType: 'image/png',
  });
  const second = await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: PNG_1X1, contentType: 'image/png',
  });
  check('two more creations uploaded',
    first.status === 201 && second.status === 201,
    `${first.status}/${second.status}`);

  const purged = await call('/api/v1/creations/purge', {
    method: 'POST', token, body: { child_id: childId },
  });
  check('purging the child succeeds', purged.status === 200,
    `status ${purged.status} ${JSON.stringify(purged.json?.data)}`);
  check('the bucket sweep removed the objects',
    Number(purged.json?.data?.objects_deleted) >= 2,
    `${purged.json?.data?.objects_deleted} deleted`);

  const afterPurge = await call(`/api/v1/creations?child_id=${childId}`, { token });
  check('no creations remain after a purge',
    (afterPurge.json?.data ?? []).length === 0,
    `${(afterPurge.json?.data ?? []).length} rows`);
  const readAfterPurge = await call(`/api/v1/creations/${first.json?.data?.id}/image`, { token });
  check('a purged creation is unreachable', readAfterPurge.status === 404,
    `status ${readAfterPurge.status}`);

  // 11. Purge is idempotent, which matters because account deletion may retry.
  const rePurge = await call('/api/v1/creations/purge', {
    method: 'POST', token, body: { child_id: childId },
  });
  check('purge is idempotent', rePurge.status === 200 &&
    Number(rePurge.json?.data?.objects_deleted) === 0,
    `${rePurge.json?.data?.objects_deleted} deleted`);

  // 12. Whole-family purge, as an account deletion would call it.
  await call(`/api/v1/creations?${query}`, {
    method: 'POST', token, raw: PNG_1X1, contentType: 'image/png',
  });
  const familyPurge = await call('/api/v1/creations/purge', { method: 'POST', token, body: {} });
  check('a whole-family purge succeeds', familyPurge.status === 200 &&
    familyPurge.json?.data?.scope === 'family',
    JSON.stringify(familyPurge.json?.data));
  const finalList = await call(`/api/v1/creations?child_id=${childId}`, { token });
  check('nothing survives an account-level purge',
    (finalList.json?.data ?? []).length === 0,
    `${(finalList.json?.data ?? []).length} rows`);

  // 13. Reconcile drains cleanly with nothing outstanding.
  const reconciled = await call('/api/v1/creations/reconcile', { method: 'POST', token });
  check('reconcile runs with nothing outstanding', reconciled.status === 200,
    JSON.stringify(reconciled.json?.data));

  console.log(`\n# ${failures === 0 ? 'all checks passed' : `${failures} check(s) failed`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('unexpected failure', error);
  process.exit(1);
});
