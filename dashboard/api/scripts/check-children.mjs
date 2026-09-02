const API = 'https://api.majarra.app';
async function login(email) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ email, password: 'DemoFamily123!@#', installation_id: 'check-enc-1234567890', platform: 'web', device_name: 'Web' })
  });
  const data = await res.json();
  return data.data?.access_token;
}
for (const email of ['demo.family@majarra.app', 'demo.family2@majarra.app']) {
  const token = await login(email);
  const r = await fetch(`${API}/api/v1/family/state`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  console.log(`\n== ${email} ==`);
  console.log(JSON.stringify(j.data?.children, null, 2));
  // raw bytes check
  const r2 = await fetch(`${API}/api/v1/family/children`, { headers: { Authorization: `Bearer ${token}` } });
  const j2 = await r2.json();
  console.log('children endpoint:', JSON.stringify(j2, null, 2));
}
