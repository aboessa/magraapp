import assert from 'node:assert/strict';
import test from 'node:test';

/// Home Builder end-to-end, through the **real** worker (ADMIN-002).
///
/// ## What this proves that a unit test cannot
///
/// The acceptance for ADMIN-002 is a round trip: change the order in the admin,
/// save, reload the admin, see it kept; then reload the app and see the same
/// order; then disable a block and see the app stop rendering it. That path
/// crosses the admin router, its guards, the persistence layer and the public
/// resolver, and every one of those was broken in a different way — so it is
/// exercised here as one sequence against `worker.fetch`, with a database that
/// actually stores rows.
///
/// The Flutter half of the round trip is covered by
/// `app_main/test/home_layout_test.dart`, which asserts that the resolved order is
/// preserved verbatim. No Dart is edited between the steps below, and none needs
/// to be: the app reads `/api/v1/home/resolved`, which is what is asserted here.
const { default: worker } = await import('../src/index.ts');

/**
 * A D1 double that stores rows.
 *
 * It understands only the statement shapes these handlers issue, and it throws on
 * anything else rather than quietly returning nothing — a stub that answers "no
 * rows" to an unrecognised query would make a broken handler look like a working
 * one, which is the class of defect this whole batch is about.
 */
function rowStore({ seeded = false } = {}) {
  const blocks = new Map();
  const versions = [];
  const audits = [];
  let clock = 0;

  const BLOCK_FIELDS = [
    'id', 'block_type', 'title_ar', 'sort_order', 'is_active', 'is_draft',
    'scheduled_at', 'expires_at', 'version', 'targeting_json', 'config_json',
    'created_at', 'updated_at',
  ];

  const run = (sql, params) => {
    const text = sql.replace(/\s+/g, ' ').trim();

    // --- guards -------------------------------------------------------------
    if (text.includes('FROM admin_credentials')) {
      return { first: { total: seeded ? 1 : 0 } };
    }
    if (text.includes('admin_sessions')) return { first: null, all: [] };
    if (text.includes('INTO audit_logs')) {
      audits.push({ sql: text, params });
      return { changes: 1 };
    }

    // --- versions -----------------------------------------------------------
    if (text.startsWith('INSERT INTO home_experience_versions')) {
      clock += 1;
      versions.push({
        id: params[0],
        snapshot_json: params[1],
        created_at: `2026-08-15T12:00:${String(clock).padStart(2, '0')}.000Z`,
      });
      return { changes: 1 };
    }
    if (text.startsWith('SELECT snapshot_json FROM home_experience_versions WHERE id = ?')) {
      return { first: versions.find((row) => row.id === params[0]) ?? null };
    }
    if (text.startsWith('SELECT id, snapshot_json, created_at FROM home_experience_versions')) {
      return { all: [...versions].reverse() };
    }

    // --- blocks -------------------------------------------------------------
    if (text.startsWith('INSERT INTO home_experience_blocks')) {
      const columns = text
        .slice(text.indexOf('(') + 1, text.indexOf(')'))
        .split(',').map((name) => name.trim());
      // The VALUES list mixes placeholders with literals (`version` is a literal
      // 1), so parameters are consumed per `?` rather than per column. Indexing by
      // column position silently shifted every value after the literal.
      const values = text
        .slice(text.lastIndexOf('VALUES (') + 8, text.lastIndexOf(')'))
        .split(',').map((item) => item.trim());
      assert.equal(columns.length, values.length, 'INSERT column/value arity');

      const row = Object.fromEntries(BLOCK_FIELDS.map((field) => [field, null]));
      let cursor = 0;
      columns.forEach((column, index) => {
        if (values[index] === '?') { row[column] = params[cursor]; cursor += 1; return; }
        row[column] = Number.isNaN(Number(values[index])) ? values[index] : Number(values[index]);
      });
      row.created_at = '2026-08-15T12:00:00.000Z';
      row.updated_at = row.created_at;
      blocks.set(row.id, row);
      return { changes: 1 };
    }
    if (text.startsWith('UPDATE home_experience_blocks SET')) {
      const assignments = text.slice(text.indexOf('SET') + 3, text.lastIndexOf('WHERE'));
      const id = params[params.length - 1];
      const row = blocks.get(id);
      if (!row) return { changes: 0 };
      let cursor = 0;
      for (const piece of assignments.split(',').map((item) => item.trim())) {
        const [column, value] = piece.split('=').map((item) => item.trim());
        if (value === '?') { row[column] = params[cursor]; cursor += 1; continue; }
        if (value === 'version + 1') { row.version = Number(row.version) + 1; continue; }
        if (value.startsWith("datetime(")) { row[column] = '2026-08-15T13:00:00.000Z'; continue; }
        throw new Error(`unsupported assignment: ${piece}`);
      }
      return { changes: 1 };
    }
    if (text.startsWith('DELETE FROM home_experience_blocks WHERE id = ?')) {
      return { changes: blocks.delete(params[0]) ? 1 : 0 };
    }
    if (text.startsWith('SELECT id FROM home_experience_blocks')) {
      return { all: [...blocks.values()].map((row) => ({ id: row.id })) };
    }
    if (text.includes('FROM home_experience_blocks')) {
      let rows = [...blocks.values()];
      if (text.includes('WHERE id = ?')) rows = rows.filter((row) => row.id === params[0]);
      if (text.includes('ORDER BY sort_order, id')) {
        rows.sort((left, right) => left.sort_order - right.sort_order
          || String(left.id).localeCompare(String(right.id)));
      }
      const copies = rows.map((row) => ({ ...row }));
      return { first: copies[0] ?? null, all: copies };
    }

    throw new Error(`rowStore received an unsupported statement: ${text.slice(0, 120)}`);
  };

  const statement = (sql, bound = []) => ({
    bind: (...params) => statement(sql, params),
    async first() { return run(sql, bound).first ?? null; },
    async all() { return { results: run(sql, bound).all ?? [] }; },
    async run() { return { meta: { changes: run(sql, bound).changes ?? 0 } }; },
  });

  return {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      const results = [];
      for (const item of statements) results.push(await item.run());
      return results;
    },
    /// Exposed for assertions about what was persisted, not for the handlers.
    _blocks: blocks,
    _versions: versions,
    _audits: audits,
  };
}

const ctx = { waitUntil() {}, passThroughOnException() {} };

function makeEnv(db) {
  return {
    ENVIRONMENT: 'development',
    API_VERSION: 'v1',
    DB: db,
    CACHE: { async get() { return null; }, async put() {} },
  };
}

async function call(db, path, init = {}) {
  const res = await worker.fetch(
    new Request(`https://api.majarra.app${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    }),
    makeEnv(db),
    ctx,
  );
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

const post = (db, path, payload) =>
  call(db, path, { method: 'POST', body: JSON.stringify(payload ?? {}) });
const patch = (db, path, payload) =>
  call(db, path, { method: 'PATCH', body: JSON.stringify(payload) });

/// Creates three blocks and returns their ids in creation order.
async function seedBlocks(db) {
  const ids = [];
  for (const [type, title] of [
    ['hero_slider', 'الهيرو'],
    ['games', 'العب الآن'],
    ['stories', 'حكايات'],
  ]) {
    const created = await post(db, '/api/v1/admin/home-experience', {
      block_type: type, title_ar: title, is_active: true, sort_order: ids.length,
    });
    assert.equal(created.status, 201, JSON.stringify(created.body));
    ids.push(created.body.data.id);
  }
  return ids;
}

const listOrder = async (db) => {
  const res = await call(db, '/api/v1/admin/home-experience');
  assert.equal(res.status, 200);
  return res.body.data.map((block) => block.id);
};

const resolvedOrder = async (db, query = '') => {
  const res = await call(db, `/api/v1/home/resolved${query}`);
  assert.equal(res.status, 200);
  return res.body.data.blocks.map((block) => block.id);
};

/* ============================================================== the round trip */

test('E2E: reorder, reload, and the order is kept — in the admin and in the app', async () => {
  const db = rowStore();
  const [hero, games, stories] = await seedBlocks(db);

  assert.deepEqual(await listOrder(db), [hero, games, stories]);
  assert.deepEqual(await resolvedOrder(db), [hero, games, stories]);

  // Change the order and save.
  const reorder = await post(db, '/api/v1/admin/home-experience/reorder', {
    order: [stories, hero, games],
  });
  assert.equal(reorder.status, 200, JSON.stringify(reorder.body));

  // "Refresh the admin": a fresh read of the same endpoint the screen calls.
  assert.deepEqual(await listOrder(db), [stories, hero, games]);

  // "Refresh the app": the public resolver returns the same order, and the
  // positions are renumbered so the client renders them in sequence.
  const app = await call(db, '/api/v1/home/resolved');
  assert.deepEqual(app.body.data.blocks.map((block) => block.id), [stories, hero, games]);
  assert.deepEqual(app.body.data.blocks.map((block) => block.position), [0, 1, 2]);
  assert.equal(app.body.data.meta.fallback, false);
});

test('E2E: disabling a block removes it from the app, re-enabling brings it back', async () => {
  const db = rowStore();
  const [hero, games, stories] = await seedBlocks(db);
  assert.deepEqual(await resolvedOrder(db), [hero, games, stories]);

  const off = await patch(db, `/api/v1/admin/home-experience/${games}`, { is_active: false });
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.deepEqual(await resolvedOrder(db), [hero, stories]);
  // The admin still lists it — disabled is not deleted.
  assert.deepEqual(await listOrder(db), [hero, games, stories]);

  const on = await patch(db, `/api/v1/admin/home-experience/${games}`, { is_active: true });
  assert.equal(on.status, 200);
  assert.deepEqual(await resolvedOrder(db), [hero, games, stories]);
});

test('E2E: a draft block is saved but never served to the app', async () => {
  const db = rowStore();
  const [hero, games] = await seedBlocks(db);
  await patch(db, `/api/v1/admin/home-experience/${games}`, { is_draft: true });

  assert.ok((await listOrder(db)).includes(games), 'the draft is still editable');
  assert.equal((await resolvedOrder(db)).includes(games), false);
  assert.equal((await resolvedOrder(db))[0], hero);
});

test('E2E: a scheduled block is withheld until its window opens', async () => {
  const db = rowStore();
  const [hero] = await seedBlocks(db);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const later = new Date(Date.now() + 172_800_000).toISOString();

  const created = await post(db, '/api/v1/admin/home-experience', {
    block_type: 'seasonal', title_ar: 'موسم الشتاء', is_active: true,
    scheduled_at: future, expires_at: later,
  });
  assert.equal(created.status, 201);

  assert.equal((await resolvedOrder(db)).includes(created.body.data.id), false,
    'a block scheduled for tomorrow must not be served today');
  assert.ok((await listOrder(db)).includes(created.body.data.id));

  // An expired window is equally withheld.
  const expired = await post(db, '/api/v1/admin/home-experience', {
    block_type: 'welcome', title_ar: 'ترحيب', is_active: true,
    scheduled_at: '2020-01-01T00:00:00.000Z', expires_at: '2020-02-01T00:00:00.000Z',
  });
  assert.equal((await resolvedOrder(db)).includes(expired.body.data.id), false);
  assert.deepEqual(await resolvedOrder(db), [hero, ...(await resolvedOrder(db)).slice(1)]);
});

test('E2E: targeting decides who receives a block', async () => {
  const db = rowStore();
  await seedBlocks(db);
  const created = await post(db, '/api/v1/admin/home-experience', {
    block_type: 'planet_orbit', title_ar: 'كواكب مصر', is_active: true,
    targeting: { country: ['EG'], track: ['kids'], min_app_version: '2.4' },
  });
  const id = created.body.data.id;

  const matching = await resolvedOrder(db, '?country=EG&track=kids&app_version=2.5.0');
  assert.ok(matching.includes(id));

  // Wrong country, wrong track, and too-old client each withhold it.
  assert.equal((await resolvedOrder(db, '?country=SA&track=kids&app_version=2.5.0')).includes(id), false);
  assert.equal((await resolvedOrder(db, '?country=EG&track=junior&app_version=2.5.0')).includes(id), false);
  assert.equal((await resolvedOrder(db, '?country=EG&track=kids&app_version=2.3.0')).includes(id), false);
  // An unknown country cannot satisfy a country rule.
  assert.equal((await resolvedOrder(db, '?track=kids&app_version=2.5.0')).includes(id), false);
});

test('E2E: the admin preview agrees with the app, block for block', async () => {
  const db = rowStore();
  await seedBlocks(db);
  await post(db, '/api/v1/admin/home-experience', {
    block_type: 'coming_soon', title_ar: 'قريبًا', is_active: true,
    targeting: { plan: ['free'] },
  });

  const query = '?country=EG&track=kids&plan=family&platform=phone&app_version=2.5.0';
  const previewRes = await call(db, `/api/v1/admin/home-experience/preview${query}`);
  assert.equal(previewRes.status, 200);

  // The two used to be separate implementations with different rules, so a
  // preview could not be trusted.
  assert.deepEqual(
    previewRes.body.data.blocks.map((block) => block.id),
    await resolvedOrder(db, query),
  );
  assert.equal(previewRes.body.data.meta.matched, previewRes.body.data.blocks.length);
  assert.equal(previewRes.body.data.meta.total_blocks, 4);
});

/* ============================================================= real versioning */

test('E2E: an edit records an immutable version that restores every field', async () => {
  const db = rowStore();
  const [hero] = await seedBlocks(db);

  await patch(db, `/api/v1/admin/home-experience/${hero}`, {
    title_ar: 'الهيرو المعدَّل',
    targeting: { country: ['EG'] },
    config: { maxItems: 5 },
  });

  const versions = await call(db, `/api/v1/admin/home-experience/${hero}/versions`);
  assert.equal(versions.status, 200);
  // Two records: the creation and the edit.
  assert.deepEqual(versions.body.data.map((item) => item.action), ['update', 'create']);
  // The creation record has no earlier state, so it is not offered as a restore.
  assert.equal(versions.body.data.at(-1).restorable, false);

  const restorable = versions.body.data.find((item) => item.restorable);
  const rollback = await post(db, `/api/v1/admin/home-experience/${hero}/rollback`, {
    version_id: restorable.id,
  });
  assert.equal(rollback.status, 200, JSON.stringify(rollback.body));

  // Everything is back, including targeting and config — which the previous
  // implementation erased because its snapshot never held them.
  const [restored] = (await call(db, '/api/v1/admin/home-experience')).body.data
    .filter((block) => block.id === hero);
  assert.equal(restored.title_ar, 'الهيرو');
  assert.deepEqual(restored.targeting, {});
  assert.deepEqual(restored.config, {});

  // The rollback is itself a version, so it can be undone.
  const after = await call(db, `/api/v1/admin/home-experience/${hero}/versions`);
  assert.equal(after.body.data[0].action, 'rollback');
  assert.equal(after.body.data[0].restorable, true);
});

test('E2E: rolling back to a version of a different block is refused', async () => {
  const db = rowStore();
  const [hero, games] = await seedBlocks(db);
  await patch(db, `/api/v1/admin/home-experience/${games}`, { title_ar: 'العب' });
  const gamesVersions = await call(db, `/api/v1/admin/home-experience/${games}/versions`);
  const foreign = gamesVersions.body.data.find((item) => item.restorable);

  const res = await post(db, `/api/v1/admin/home-experience/${hero}/rollback`, {
    version_id: foreign.id,
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /does not describe this block/);
});

test('E2E: deleting a block records its final state', async () => {
  const db = rowStore();
  const [hero, games] = await seedBlocks(db);
  const res = await call(db, `/api/v1/admin/home-experience/${games}`, { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.deepEqual(await listOrder(db), [hero, (await listOrder(db))[1]].slice(0, 2));
  assert.equal((await resolvedOrder(db)).includes(games), false);

  const deletion = db._versions
    .map((row) => JSON.parse(row.snapshot_json))
    .find((envelope) => envelope.action === 'delete');
  assert.equal(deletion.block_id, games);
  assert.equal(deletion.before.title_ar, 'العب الآن');
  assert.equal(deletion.after, null);
});

/* ================================================================== refusals */

test('E2E: an invalid block configuration is refused, not stored', async () => {
  const db = rowStore();
  await seedBlocks(db);
  const before = db._blocks.size;

  const cases = [
    [{ block_type: 'not_a_block' }, /block_type must be one of/],
    [{ block_type: 'games', targeting: { age_min: 3 } }, /unsupported targeting dimension/],
    [{ block_type: 'games', config: { mystery: 1 } }, /unsupported config key/],
    [{ block_type: 'games', sort_order: -1 }, /sort_order/],
    [{ block_type: 'games', scheduled_at: 'soon' }, /ISO-8601/],
    [
      { block_type: 'games', scheduled_at: '2026-05-01T00:00:00Z', expires_at: '2026-04-01T00:00:00Z' },
      /expires_at must be after scheduled_at/,
    ],
  ];
  for (const [payload, pattern] of cases) {
    const res = await post(db, '/api/v1/admin/home-experience', payload);
    assert.equal(res.status, 400, JSON.stringify(payload));
    assert.match(res.body.error, pattern);
  }
  assert.equal(db._blocks.size, before, 'nothing may be stored by a refused request');
});

test('E2E: patching a block that does not exist is a 404, not a reported success', async () => {
  const db = rowStore();
  await seedBlocks(db);
  const res = await patch(db, '/api/v1/admin/home-experience/no-such-block', { title_ar: 'x' });
  // The old handler returned 200 with `{ id }`, so the screen reported saving
  // something that was never written.
  assert.equal(res.status, 404);
});

test('E2E: the block type cannot be changed after creation', async () => {
  const db = rowStore();
  const [hero] = await seedBlocks(db);
  const res = await patch(db, `/api/v1/admin/home-experience/${hero}`, { block_type: 'games' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /cannot be changed after creation/);
});

test('E2E: a partial reorder is refused rather than renumbering half the rows', async () => {
  const db = rowStore();
  const [hero, games, stories] = await seedBlocks(db);

  const partial = await post(db, '/api/v1/admin/home-experience/reorder', { order: [stories] });
  assert.equal(partial.status, 400);
  assert.match(partial.body.error, /must list every block/);

  const duplicate = await post(db, '/api/v1/admin/home-experience/reorder', {
    order: [hero, hero, games, stories],
  });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.body.error, /duplicate ids/);

  const unknown = await post(db, '/api/v1/admin/home-experience/reorder', {
    order: [hero, games, stories, 'ghost'],
  });
  assert.equal(unknown.status, 400);
  assert.match(unknown.body.error, /unknown block id/);

  // The original order survived every refusal.
  assert.deepEqual(await listOrder(db), [hero, games, stories]);
});

test('E2E: with an admin seeded, an unauthenticated caller cannot mutate anything', async () => {
  // `seeded: true` closes the pre-seed break-glass path, which is the production
  // posture.
  const db = rowStore({ seeded: true });
  const mutations = [
    ['POST', '/api/v1/admin/home-experience', { block_type: 'games' }],
    ['PATCH', '/api/v1/admin/home-experience/block-hero', { title_ar: 'x' }],
    ['POST', '/api/v1/admin/home-experience/reorder', { order: ['block-hero'] }],
    ['POST', '/api/v1/admin/home-experience/block-hero/rollback', { version_id: 'v1' }],
    ['DELETE', '/api/v1/admin/home-experience/block-hero', null],
  ];
  for (const [method, path, payload] of mutations) {
    const res = await call(db, path, {
      method,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    assert.equal(res.status, 401, `${method} ${path} must refuse`);
  }
  // Reads are refused too: this router exposes family and billing data elsewhere.
  assert.equal((await call(db, '/api/v1/admin/home-experience')).status, 401);
  assert.equal(db._blocks.size, 0, 'no unauthenticated request may write');
});

/* ================================================================== fallback */

test('E2E: an unreadable configuration yields a safe Home, not an empty one', async () => {
  const broken = {
    prepare() {
      return {
        bind: () => ({ async first() { throw new Error('D1 unavailable'); }, async all() { throw new Error('D1 unavailable'); }, async run() { throw new Error('D1 unavailable'); } }),
        async first() { throw new Error('D1 unavailable'); },
        async all() { throw new Error('D1 unavailable'); },
        async run() { throw new Error('D1 unavailable'); },
      };
    },
    async batch() { throw new Error('D1 unavailable'); },
  };

  const res = await call(broken, '/api/v1/home/resolved');
  assert.equal(res.status, 200, 'a child must still get a Home');
  assert.ok(res.body.data.blocks.length > 0, 'the fallback must not be empty');
  // And it says so, which the previous handler did not: it returned the same shape
  // as a configured Home, so a broken query was indistinguishable from a short one.
  assert.equal(res.body.data.meta.fallback, true);
  assert.equal(res.body.data.meta.fallback_reason, 'configuration_unavailable');
});

test('E2E: a configuration where nothing matches is reported as such, not as an outage', async () => {
  const db = rowStore();
  await post(db, '/api/v1/admin/home-experience', {
    block_type: 'games', title_ar: 'العب', is_active: true, targeting: { country: ['JP'] },
  });
  const res = await call(db, '/api/v1/home/resolved?country=EG');
  assert.equal(res.body.data.meta.fallback, true);
  assert.equal(res.body.data.meta.fallback_reason, 'no_blocks_matched');
  assert.equal(res.body.data.meta.configured_blocks, 1, 'the configuration was read fine');
});
