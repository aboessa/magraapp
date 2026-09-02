const API = 'https://api.majarra.app';
const ACCOUNTS = [
  { email: 'demo.family@majarra.app', password: 'DemoFamily123!@#', pin: '3535' },
  { email: 'demo.family2@majarra.app', password: 'DemoFamily123!@#', pin: '3535' },
];

const CHILDREN = [
  { nickname: 'Ù„ÙŠÙ„Ù‰', birth_month: 3, birth_year: 2020, avatar_id: 'avatar-girl-1', language: 'ar' },
  { nickname: 'Ø£Ø­Ù…Ø¯', birth_month: 6, birth_year: 2018, avatar_id: 'avatar-boy-2', language: 'ar' },
  { nickname: 'Ø³Ø§Ø±Ø©', birth_month: 1, birth_year: 2022, avatar_id: 'avatar-girl-2', language: 'ar' },
];

async function login(email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email, password, installation_id: 'fix-ar-123456789012345', platform: 'web', device_name: 'Fix Script' }),
  });
  const j = await res.json();
  if (!j.success) throw new Error(`login failed ${email}: ${j.error}`);
  return j.data.access_token;
}

async function verifyPin(token, pin, purpose) {
  const res = await fetch(`${API}/api/v1/family/parent-pin/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pin, purpose }),
  });
  const j = await res.json();
  if (!j.success) throw new Error(`pin verify failed ${purpose}: ${j.error}`);
  return j.data.parent_proof;
}

async function getChildren(token) {
  const res = await fetch(`${API}/api/v1/family/children`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await res.json();
  return j.data || [];
}

async function deleteChild(token, childId, proof) {
  const res = await fetch(`${API}/api/v1/account/children/${childId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'X-Parent-Proof': proof },
  });
  const j = await res.json().catch(() => ({}));
  console.log(`delete ${childId}: ${res.status} ${j.success ? 'ok' : j.error}`);
  return j;
}

async function createChild(token, proof, child) {
  const res = await fetch(`${API}/api/v1/family/children`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}`, 'X-Parent-Proof': proof },
    body: JSON.stringify(child),
  });
  const j = await res.json();
  console.log(`create ${child.nickname}: ${res.status} ${j.success ? j.data.id + ' ' + j.data.nickname : j.error}`);
  // dump raw bytes
  if (j.success) console.log(`  raw nickname: ${j.data.nickname} | age_track ${j.data.age_track}`);
  return j;
}

for (const acc of ACCOUNTS) {
  console.log(`\n=== Fixing ${acc.email} ===`);
  const token = await login(acc.email, acc.password);
  const existing = await getChildren(token);
  console.log(`Existing ${existing.length} children`);
  for (const ch of existing) {
    console.log(` Deleting ${ch.id} nickname=${ch.nickname}`);
    const proofDel = await verifyPin(token, acc.pin, 'delete_child');
    await deleteChild(token, ch.id, proofDel);
    // wait for DO to process deletion job
    await new Promise(r => setTimeout(r, 2000));
  }
  // recreate
  for (const child of CHILDREN) {
    const proofCreate = await verifyPin(token, acc.pin, 'manage_children');
    await createChild(token, proofCreate, child);
    await new Promise(r => setTimeout(r, 800));
  }
  const after = await getChildren(token);
  console.log(`After fix ${after.length} children:`);
  for (const c of after) console.log(`  ${c.id} nickname=${c.nickname} track=${c.age_track}`);
}

console.log('\nDone fixing Arabic names');

