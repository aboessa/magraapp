const API = 'https://api.majarra.app';

const ACCOUNTS = [
  { email: 'demo.family@majarra.app', password: 'DemoFamily123!@#' },
  { email: 'demo.family2@majarra.app', password: 'DemoFamily123!@#' },
];

const EPISODES = [
  'episode-numbers-01-counting-stars',
  'episode-hekaya-03-waiting-turn',
  'episode-body-01-heart',
];

async function login(email, password) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email, password,
      installation_id: 'prod-install-1234567890',
      platform: 'web',
      device_name: 'Web',
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Login failed ${email}: ${data.error}`);
  return { token: data.data.access_token, parentId: data.data.parent.id, plan: data.data.parent.plan };
}

async function getState(token) {
  const res = await fetch(`${API}/api/v1/family/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data;
}

async function seedProgress(token, childId, episodeId) {
  await fetch(`${API}/api/v1/family/progress`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      child_id: childId,
      content_type: 'episode',
      content_id: episodeId,
      event_id: crypto.randomUUID(),
      position_ms: 120000,
      duration_ms: 300000,
      completed: false,
    }),
  }).catch(() => {});
  await fetch(`${API}/api/v1/family/favorites`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ child_id: childId, entity_type: 'episode', entity_id: episodeId }),
  }).catch(() => {});
}

for (const acc of ACCOUNTS) {
  console.log(`\n=== ${acc.email} ===`);
  try {
    const { token, plan } = await login(acc.email, acc.password);
    console.log(`Login OK plan=${plan}`);
    const stateRes = await getState(token);
    const children = stateRes.data?.children || [];
    console.log(`Children count: ${children.length}`);
    for (const child of children) {
      console.log(` - ${child.id} ${child.age_track} avatar=${child.avatar_id}`);
      const ep = EPISODES[Math.floor(Math.random()*EPISODES.length)];
      await seedProgress(token, child.id, ep);
      console.log(`   -> seeded progress ${ep}`);
    }
    // billing
    const billingRes = await fetch(`${API}/api/v1/billing/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const billing = await billingRes.json();
    console.log('Billing:', billing.data?.plan, billing.data?.subscription?.status, `usage children ${billing.data?.usage?.children}`);
  } catch (e) {
    console.error(e);
  }
}

console.log('\nDone');
