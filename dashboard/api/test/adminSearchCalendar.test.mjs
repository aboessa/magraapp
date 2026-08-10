/// Tests for the global search behind the command palette, and for the content calendar.
///
/// ## The claim these protect
///
/// **Search:** a palette that shows a title the operator may not open has already leaked it.
/// So the authorisation decision is asserted directly, not through a happy-path request:
/// which sources run, which are omitted, and whether the omission is stated.
///
/// **Calendar:** the calendar's most useful statement is that nothing publishes a scheduled
/// row — `scheduled/cleanup.ts` is the only cron and it deletes processed events. A calendar
/// that draws scheduled items as though a timer will publish them is worse than no calendar,
/// because it converts a missing feature into a false promise. The `no_scheduler` conflict is
/// therefore asserted on every scheduled event, and the three conflict classes are each
/// asserted in both directions: the bad state is reported, the normal state beside it is not.

import assert from 'node:assert/strict';
import test from 'node:test';

import { isUnrestricted, likeTerm, selectSources, SEARCH_TYPES } from '../src/routes/adminSearch.ts';

const NO_ADMIN_USERS = ['FROM admin_credentials', [{ total: 0 }]];

function fakeDb(matchers = []) {
  const ranked = [...matchers, NO_ADMIN_USERS].sort((a, b) => b[0].length - a[0].length);
  const terminals = (sql) => {
    const run = () => {
      const hit = ranked.find(([needle]) => sql.includes(needle));
      return hit ? hit[1] : [];
    };
    return {
      async first() { const rows = run(); return rows.length ? rows[0] : null; },
      async all() { return { results: run() }; },
      async run() { run(); return { meta: { changes: 1 } }; },
    };
  };
  return {
    prepare(sql) {
      return { bind: () => terminals(sql), ...terminals(sql) };
    },
    async batch(statements) { return statements.map(() => ({ meta: { changes: 1 } })); },
  };
}

const env = (database) => ({ DB: database, ENVIRONMENT: 'development', ADMIN_API_KEY: undefined });

async function search(database, query = 'لونا', params = '') {
  const { default: route } = await import('../src/routes/adminSearch.ts');
  const response = await route.request(`/search?q=${encodeURIComponent(query)}${params}`, {}, env(database));
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null };
}

// --- Search: query handling -------------------------------------------------

test('a LIKE wildcard in the query is escaped rather than matching everything', () => {
  assert.equal(likeTerm('%'), '%\\%%');
  assert.equal(likeTerm('a_b'), '%a\\_b%');
  assert.equal(likeTerm('لونا'), '%لونا%');
});

test('a one-character query returns nothing and says why', async () => {
  const result = await search(fakeDb(), 'ل');
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.groups, []);
  assert.equal(result.data.min_length, 2);
});

test('empty groups are dropped, so the palette shows matches rather than headings', async () => {
  const result = await search(fakeDb([
    ['FROM series s LEFT JOIN planets', [{
      id: 's1', title_ar: 'لونا', title_en: 'Luna', slug: 'luna', status: 'published',
      cover_url: null, planet_name: 'أبجد',
    }]],
  ]));
  assert.equal(result.data.groups.length, 1);
  assert.equal(result.data.groups[0].type, 'series');
  assert.equal(result.data.total, 1);
});

test('a result carries the route, the status and the context that tells two titles apart', async () => {
  const result = await search(fakeDb([
    ['FROM episodes e LEFT JOIN series', [{
      id: 'e1', title_ar: 'الحلقة الأولى', episode_number: 1, status: 'published',
      thumbnail_url: 'https://cdn.majarra.app/public/x.webp', series_title: 'لونا',
    }]],
  ]));
  const [hit] = result.data.groups[0].results;
  assert.equal(hit.admin_route, 'episodes/e1');
  assert.equal(hit.status, 'published');
  assert.equal(hit.context, 'لونا');
  // Never an asset id: the client cannot resolve one.
  assert.match(hit.image_url, /^https:\/\//);
});

test('the payload names campaigns and releases as having no table at all', async () => {
  const result = await search(fakeDb());
  const types = result.data.unavailable.map((entry) => entry.type);
  assert.deepEqual(types, ['campaign', 'release']);
  for (const entry of result.data.unavailable) assert.ok(entry.reason.length > 10);
});

test('the type list is published so a client filter cannot invent a type', async () => {
  const result = await search(fakeDb());
  const types = result.data.types.map((entry) => entry.type);
  for (const expected of ['planet', 'series', 'episode', 'story', 'family', 'ticket', 'blog_post']) {
    assert.ok(types.includes(expected), expected);
  }
  assert.deepEqual(types, SEARCH_TYPES.map((entry) => entry.type));
});

test('a types filter runs only the named sources', async () => {
  const result = await search(fakeDb([
    ['FROM series s LEFT JOIN planets', [{
      id: 's1', title_ar: 'لونا', title_en: null, slug: 'luna', status: 'published',
      cover_url: null, planet_name: null,
    }]],
    ['FROM episodes e LEFT JOIN series', [{
      id: 'e1', title_ar: 'لونا', episode_number: 1, status: 'published',
      thumbnail_url: null, series_title: 'لونا',
    }]],
  ]), 'لونا', '&types=series');
  assert.deepEqual(result.data.groups.map((group) => group.type), ['series']);
});

// --- Search: authorisation --------------------------------------------------

test('a superuser and a platform grant are the two unrestricted cases', () => {
  assert.equal(isUnrestricted({ roles: ['owner'] }), true);
  assert.equal(isUnrestricted({ roles: ['system_admin'] }), true);
  assert.equal(isUnrestricted({ roles: ['editor'], grants: [{ scope_type: 'platform', permissions: [] }] }), true);
  assert.equal(isUnrestricted({ roles: ['editor'], grants: [{ scope_type: 'planet', scope_id: 'abjad', permissions: [] }] }), false);
});

test('the break-glass key path is unrestricted, because there is no identity to scope by', () => {
  // requireAdmin only permits it before the first admin user exists; scoping an absent
  // identity would mean the first owner cannot be seeded.
  assert.equal(isUnrestricted(null), true);
  assert.equal(isUnrestricted(undefined), true);
});

test('a scope-restricted operator gets no platform sources, and the omission is named', () => {
  const { sources, omitted } = selectSources({
    user: { roles: ['editor'], permissions: [], grants: [{ scope_type: 'planet', scope_id: 'abjad', permissions: ['view'] }] },
    requestedTypes: [],
  });
  const types = sources.map((source) => source.type);
  assert.ok(types.includes('series'));
  assert.ok(!types.includes('family'));
  assert.ok(!types.includes('ticket'));
  const omittedTypes = omitted.map((entry) => entry.type);
  assert.ok(omittedTypes.includes('family'));
  // Stated, not silent: a short list with no explanation teaches an operator the search is
  // unreliable.
  for (const entry of omitted) assert.ok(entry.reason.length > 10);
});

test('staff and teams need the permission their own screens need', () => {
  const withoutPermissions = selectSources({
    user: { roles: ['editor'], permissions: ['edit_text'], grants: [{ scope_type: 'platform', permissions: ['edit_text'] }] },
    requestedTypes: [],
  });
  const types = withoutPermissions.sources.map((source) => source.type);
  assert.ok(!types.includes('employee'));
  assert.ok(!types.includes('team'));
  assert.deepEqual(
    withoutPermissions.omitted.filter((entry) => entry.type === 'employee').map((entry) => entry.reason),
    ['يتطلّب صلاحية manage_permissions.'],
  );

  const withPermissions = selectSources({
    user: {
      roles: ['editor'],
      permissions: ['manage_permissions', 'manage_team'],
      grants: [{ scope_type: 'platform', permissions: [] }],
    },
    requestedTypes: [],
  });
  const allowed = withPermissions.sources.map((source) => source.type);
  assert.ok(allowed.includes('employee'));
  assert.ok(allowed.includes('team'));
});

test('an owner needs no explicit permission for the guarded sources', () => {
  const { sources } = selectSources({ user: { roles: ['owner'], permissions: [] }, requestedTypes: [] });
  const types = sources.map((source) => source.type);
  assert.ok(types.includes('employee'));
  assert.ok(types.includes('team'));
});

// --- Calendar ---------------------------------------------------------------

async function calendar(matchers, params = '?from=2026-08-01&to=2026-08-31') {
  const { default: route } = await import('../src/routes/adminCalendar.ts');
  const response = await route.request(`/calendar${params}`, {}, env(fakeDb(matchers)));
  const body = await response.json().catch(() => null);
  return { status: response.status, data: body?.data ?? null };
}

const EPISODES = 'FROM episodes e LEFT JOIN series';
const PAGES = 'FROM web_pages';
const POSTS = 'FROM blog_posts';
const RIGHTS_WINDOW = 'FROM content_rights\n       WHERE expiry IS NOT NULL AND expiry >= ?';
const RIGHTS_ALL = 'SELECT entity_type, entity_id, expiry FROM content_rights WHERE expiry IS NOT NULL';

test('the calendar refuses an inverted window rather than returning nothing', async () => {
  const result = await calendar([], '?from=2026-08-31&to=2026-08-01');
  assert.equal(result.status, 400);
});

test('every scheduled event carries no_scheduler, because no cron publishes one', async () => {
  const result = await calendar([
    [POSTS, [{
      id: 'p1', title: 'مقال مجدول', status: 'scheduled', language: 'ar',
      scheduled_at: '2026-08-20T09:00:00Z', published_at: null,
    }]],
  ]);
  const [event] = result.data.events;
  assert.equal(event.date_kind, 'scheduled');
  assert.ok(event.conflicts.includes('no_scheduler'));
  assert.equal(result.data.scheduler_available, false);
  assert.match(result.data.scheduler_note, /cleanup\.ts/);
});

test('a published event is not reported as unscheduled work', async () => {
  const result = await calendar([
    [POSTS, [{
      id: 'p1', title: 'مقال منشور', status: 'published', language: 'ar',
      scheduled_at: null, published_at: '2026-08-10T09:00:00Z',
    }]],
  ]);
  const [event] = result.data.events;
  assert.equal(event.date_kind, 'published');
  assert.deepEqual(event.conflicts, []);
  assert.equal(event.reschedule.supported, false);
  assert.ok(event.reschedule.reason.length > 10);
});

test('a scheduled date already past is reported as lapsed as well', async () => {
  const result = await calendar([
    [PAGES, [{
      id: 'w1', title: 'صفحة', status: 'scheduled', language: 'ar',
      scheduled_at: '2000-01-02T00:00:00Z', published_at: null,
    }]],
  ], '?from=2000-01-01&to=2000-01-31');
  const [event] = result.data.events;
  assert.ok(event.conflicts.includes('lapsed_schedule'));
  assert.equal(result.data.conflict_summary.lapsed_schedule, 1);
});

test('a rescheduleable event names the route, field and permission it needs', async () => {
  const result = await calendar([
    [PAGES, [{
      id: 'w1', title: 'صفحة', status: 'scheduled', language: 'ar',
      scheduled_at: '2026-08-20T00:00:00Z', published_at: null,
    }]],
  ]);
  const [event] = result.data.events;
  // The calendar is a read model: the entity's own endpoint stays the only writer, so the
  // revision, the validation and the audit it performs cannot be bypassed by a drag.
  assert.deepEqual(event.reschedule, {
    supported: true, method: 'PATCH', route: '/admin/website/pages/w1',
    field: 'scheduled_at', permission: 'edit_metadata',
  });
});

test('content scheduled past its licence expiry is reported', async () => {
  const result = await calendar([
    [EPISODES, [{
      id: 'e1', title_ar: 'حلقة', status: 'scheduled', published_at: '2026-08-20T00:00:00Z',
      series_title: 'لونا', planet_id: 'abjad',
    }]],
    [RIGHTS_ALL, [{ entity_type: 'episode', entity_id: 'e1', expiry: '2026-08-01' }]],
  ]);
  const [event] = result.data.events;
  assert.ok(event.conflicts.includes('rights_expiry_before_publication'));
  assert.equal(result.data.conflict_summary.rights_expiry_before_publication, 1);
});

test('content published before its licence expiry is not reported', async () => {
  const result = await calendar([
    [EPISODES, [{
      id: 'e1', title_ar: 'حلقة', status: 'published', published_at: '2026-08-10T00:00:00Z',
      series_title: 'لونا', planet_id: 'abjad',
    }]],
    [RIGHTS_ALL, [{ entity_type: 'episode', entity_id: 'e1', expiry: '2027-01-01' }]],
  ]);
  assert.deepEqual(result.data.events[0].conflicts, []);
});

test('two episodes of one series on one day are a collision; two on different days are not', async () => {
  const collide = await calendar([
    [EPISODES, [
      { id: 'e1', title_ar: 'أولى', status: 'published', published_at: '2026-08-10', series_title: 'لونا', planet_id: 'abjad' },
      { id: 'e2', title_ar: 'ثانية', status: 'published', published_at: '2026-08-10', series_title: 'لونا', planet_id: 'abjad' },
    ]],
  ]);
  assert.equal(collide.data.conflict_summary.same_day_collision, 2);

  const spread = await calendar([
    [EPISODES, [
      { id: 'e1', title_ar: 'أولى', status: 'published', published_at: '2026-08-10', series_title: 'لونا', planet_id: 'abjad' },
      { id: 'e2', title_ar: 'ثانية', status: 'published', published_at: '2026-08-17', series_title: 'لونا', planet_id: 'abjad' },
    ]],
  ]);
  assert.equal(spread.data.conflict_summary.same_day_collision, 0);
});

test('two episodes of different series on the same day are not a collision', async () => {
  const result = await calendar([
    [EPISODES, [
      { id: 'e1', title_ar: 'أولى', status: 'published', published_at: '2026-08-10', series_title: 'لونا', planet_id: 'abjad' },
      { id: 'e2', title_ar: 'ثانية', status: 'published', published_at: '2026-08-10', series_title: 'أرقام', planet_id: 'arqam' },
    ]],
  ]);
  assert.equal(result.data.conflict_summary.same_day_collision, 0);
});

test('filters narrow the set and the unfiltered total stays visible', async () => {
  const result = await calendar([
    [POSTS, [
      { id: 'p1', title: 'عربي', status: 'published', language: 'ar', scheduled_at: null, published_at: '2026-08-10' },
      { id: 'p2', title: 'English', status: 'published', language: 'en', scheduled_at: null, published_at: '2026-08-11' },
    ]],
  ], '?from=2026-08-01&to=2026-08-31&language=ar');
  assert.equal(result.data.total, 1);
  assert.equal(result.data.total_unfiltered, 2);
});

test('events are ordered by date, so a week view does not have to sort them again', async () => {
  const result = await calendar([
    [POSTS, [
      { id: 'p2', title: 'later', status: 'published', language: 'ar', scheduled_at: null, published_at: '2026-08-20' },
      { id: 'p1', title: 'earlier', status: 'published', language: 'ar', scheduled_at: null, published_at: '2026-08-02' },
    ]],
  ]);
  assert.deepEqual(result.data.events.map((event) => event.title), ['earlier', 'later']);
});

test('a home module with both a start and an end appears as two decisions', async () => {
  const result = await calendar([
    ['FROM home_experience_blocks', [{
      id: 'h1', title_ar: 'بانر موسمي', block_type: 'seasonal_banner', is_active: 1, is_draft: 0,
      scheduled_at: '2026-08-05', expires_at: '2026-08-25',
    }]],
  ]);
  assert.deepEqual(result.data.events.map((event) => event.date_kind), ['scheduled', 'expires']);
  assert.deepEqual(result.data.events.map((event) => event.id), ['h1:scheduled_at', 'h1:expires_at']);
});

test('a licence expiry is on the calendar and is not rescheduleable from it', async () => {
  const result = await calendar([
    [RIGHTS_WINDOW, [{ id: 'r1', owner: 'مالك', entity_type: 'series', entity_id: 's1', expiry: '2026-08-14' }]],
    [RIGHTS_ALL, [{ entity_type: 'series', entity_id: 's1', expiry: '2026-08-14' }]],
  ]);
  const event = result.data.events.find((entry) => entry.type === 'rights_expiry');
  assert.ok(event);
  assert.equal(event.date_kind, 'expires');
  assert.equal(event.reschedule.supported, false);
});

test('the calendar names the entities it cannot place and why', async () => {
  const result = await calendar([]);
  const types = result.data.unavailable.map((entry) => entry.type);
  for (const expected of ['campaign', 'release', 'book', 'game']) {
    assert.ok(types.includes(expected), expected);
  }
});
