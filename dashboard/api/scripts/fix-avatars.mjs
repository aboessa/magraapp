const API = 'https://api.majarra.app';
const ACCOUNTS = [
  { email: 'demo.family@majarra.app', password: 'DemoFamily123!@#', pin: '3535' },
  { email: 'demo.family2@majarra.app', password: 'DemoFamily123!@#', pin: '3535' },
];

// Map old invalid avatar IDs to valid catalogue IDs
// luna = girl pink, nova = star, orbit = globe, comet = sparkle, astro = rocket, galaxy = flower, etc.
const CHILDREN = [
  { nickname: 'Ù„ÙŠÙ„Ù‰', birth_month: 3, birth_year: 2020, avatar_id: 'luna', language: 'ar' },
  { nickname: 'Ø£Ø­Ù…Ø¯', birth_month: 6, birth_year: 2018, avatar_id: 'comet', language: 'ar' },
  { nickname: 'Ø³Ø§Ø±Ø©', birth_month: 1, birth_year: 2022, avatar_id: 'nova', language: 'ar' },
];

async function login(email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email, password, installation_id: 'fix-av-123456789012345', platform: 'web', device_name: 'FixAv Script' }),
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
  console.log(` delete ${childId} -> ${res.status} ${j.success ? 'ok' : j.error}`);
}
async function createChild(token, proof, child) {
  const res = await fetch(`${API}/api/v1/family/children`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${token}`, 'X-Parent-Proof': proof },
    body: JSON.stringify(child),
  });
  const j = await res.json();
  console.log(` create ${child.nickname} (${child.avatar_id}) -> ${res.status} ${j.success ? j.data.id + ' ' + j.data.nickname : j.error}`);
  return j;
}

for (const acc of ACCOUNTS) {
  console.log(`\n=== Fix avatars ${acc.email} ===`);
  try {
    const token = await login(acc.email, acc.password);
    const existing = await getChildren(token);
    console.log(` Existing ${existing.length}: ${existing.map(c=> `${c.nickname}(${c.avatar_id})`).join(', ')}`);
    // Only fix if any avatar_id is invalid
    const invalid = existing.filter(c => !['orbit','comet','nova','luna','astro','robo','galaxy','saturn'].includes(c.avatar_id));
    if (invalid.length === 0) {
      console.log(' All avatars valid, skipping deletion');
      continue;
    }
    for (const ch of existing) {
      const proofDel = await verifyPin(token, acc.pin, 'delete_child');
      await deleteChild(token, ch.id, proofDel);
      await new Promise(r => setTimeout(r, 2500));
    }
    for (const child of CHILDREN) {
      const proofCreate = await verifyPin(token, acc.pin, 'manage_children');
      await createChild(token, proofCreate, child);
      await new Promise(r => setTimeout(r, 800));
    }
    const after = await getChildren(token);
    console.log(` After: ${after.map(c=> `${c.nickname}(${c.avatar_id})`).join(', ')}`);
  } catch (e) {
    console.error(` Failed ${acc.email}:`, e.message);
  }
}
console.log('\nDone');

