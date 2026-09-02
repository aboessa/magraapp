#!/usr/bin/env node
/**
 * Seed a demo family account for local testing.
 * 
 * Usage:
 *   node scripts/seed-demo-family.mjs [--api=http://127.0.0.1:8787]
 * 
 * Creates:
 *   Email: demo.family@majarra.app
 *   Password: DemoFamily123!@#
 *   PIN: 3535
 *   Plan: family (via direct DO manipulation OR via API if endpoint exists)
 *   Children: 3 profiles (preschool, kids)
 */

const API = process.argv.find(a => a.startsWith('--api='))?.split('=')[1] || 'http://127.0.0.1:8787';

const DEMO = {
  email: 'demo.family@majarra.app',
  password: 'DemoFamily123!@#',
  display_name: 'Ø£Ø³Ø±Ø© Ù…Ø¬Ø±Ø© Ø§Ù„ØªØ¬Ø±ÙŠØ¨ÙŠØ©',
  pin: '3535',
  children: [
    { nickname: 'Ù„ÙŠÙ„Ù‰', birth_month: 3, birth_year: 2020, avatar_id: 'avatar-girl-1', language: 'ar' },
    { nickname: 'Ø£Ø­Ù…Ø¯', birth_month: 6, birth_year: 2018, avatar_id: 'avatar-boy-2', language: 'ar' },
    { nickname: 'Ø³Ø§Ø±Ø©', birth_month: 1, birth_year: 2022, avatar_id: 'avatar-girl-2', language: 'ar' },
  ]
};

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
  });
  const data = await res.json().catch(()=>null);
  return { status: res.status, data };
}

async function main() {
  console.log(`Seeding demo family at ${API}`);

  // 1. Register
  let r = await req('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: DEMO.email,
      password: DEMO.password,
      display_name: DEMO.display_name,
    }),
    headers: { 'Idempotency-Key': 'demo-family-001' }
  });
  console.log('Register:', r.status, r.data?.success ? 'ok' : r.data?.error);
  let verificationToken = r.data?.data?.development_verification_token;
  
  if (!verificationToken && r.status === 400) {
    console.log('Account may already exist, trying login flow to get verification if needed...');
    // Try to get token via resend? For dev we can attempt to register again with different idempotency to get token
    r = await req('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: DEMO.email, password: DEMO.password, display_name: DEMO.display_name }),
      headers: { 'Idempotency-Key': `demo-family-${Date.now()}` }
    });
    verificationToken = r.data?.data?.development_verification_token;
    console.log('Retry register:', r.status, verificationToken ? 'got token' : r.data?.error);
  }

  // 2. Verify email if we have dev token
  if (verificationToken) {
    r = await req('/api/v1/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: verificationToken })
    });
    console.log('Verify email:', r.status, r.data?.success);
  } else {
    console.log('No verification token (production mode requires email). Attempting login anyway...');
  }

  // 3. Login
  r = await req('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: DEMO.email,
      password: DEMO.password,
      installation_id: 'demo-installation-id-1234567890',
      platform: 'web',
      device_name: 'Demo Web'
    })
  });
  console.log('Login:', r.status, r.data?.success ? `plan=${r.data.data.parent.plan}` : r.data?.error);
  if (!r.data?.success) throw new Error('Login failed');

  const accessToken = r.data.data.access_token;
  const parentId = r.data.data.parent.id;
  console.log(`Parent ID: ${parentId} Plan: ${r.data.data.parent.plan}`);

  // 4. Create PIN
  r = await req('/api/v1/family/parent-pin', {
    method: 'POST',
    body: JSON.stringify({ pin: DEMO.pin }),
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log('Create PIN:', r.status, r.data?.success ? `pin_version=${r.data.data.pin_version}` : r.data?.error);

  // 5. For granting family plan locally, you need to directly manipulate DO sqlite
  //    The script prints instructions instead.
  console.log(`
=== MANUAL STEP FOR LOCAL FAMILY PLAN ===
If plan is still 'free', grant family entitlement directly in DO storage:
  db: .wrangler/state/v3/do/majarra-api-FamilyState/*.sqlite
  sqlite3 <file> "INSERT INTO entitlements (id, source, provider_purchase_id, plan, status, starts_at, expires_at, updated_at) 
    VALUES ('demo-family-grant-001','admin_grant','demo-grant-001','family','active', ${Date.now()-10000}, ${Date.now()+31536000000}, ${Date.now()}) ON CONFLICT(id) DO UPDATE SET plan='family', status='active';"
Then re-login to see plan=family.
`);

  // 6. Create children (requires parent proof)
  for (const child of DEMO.children) {
    let verifyRes = await req('/api/v1/family/parent-pin/verify', {
      method: 'POST',
      body: JSON.stringify({ pin: DEMO.pin, purpose: 'manage_children' }),
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!verifyRes.data?.success) {
      console.log('PIN verify failed:', verifyRes.data?.error);
      continue;
    }
    const proof = verifyRes.data.data.parent_proof;
    r = await req('/api/v1/family/children', {
      method: 'POST',
      body: JSON.stringify(child),
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Parent-Proof': proof }
    });
    console.log(`Create child ${child.nickname}:`, r.status, r.data?.success ? `id=${r.data.data.id} track=${r.data.data.age_track}` : r.data?.error);
  }

  // 7. Final state
  r = await req('/api/v1/family/state', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  console.log('Final family state:', JSON.stringify(r.data, null, 2));

  console.log(`
=== DEMO FAMILY CREDENTIALS ===
Email: ${DEMO.email}
Password: ${DEMO.password}
Parent PIN: ${DEMO.pin}
API: ${API}
Parent ID: ${parentId}

Use in Flutter app:
  flutter run --dart-define=API_BASE_URL=${API} --dart-define=MAJARRA_ENV=development

Then login screen -> enter email/password.
`);
}

main().catch(e => { console.error(e); process.exit(1); });

