/// Tests for territory availability.
///
/// The property being pinned is the one the audit found missing: a restriction that
/// is *recorded* must actually *refuse*. So there are three groups here —
///
///  1. resolution rules, including the override semantics and the unknown-country
///     rule, which are the two places a wrong answer silently unrestricts content;
///  2. input normalisation, because a policy stored as `['sa']` against a request
///     reporting `SA` would look configured and enforce nothing;
///  3. wiring assertions that the public catalogue, the episode detail, the playback
///     start, the game endpoint and the book detail all consult it — a rule nobody
///     calls is the state this replaces.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  availabilityChainScopes,
  normalizeAvailabilityInput,
  resolveAvailability,
} from '../src/lib/availabilityPolicy.ts';

const NOW = '2026-08-09T12:00:00.000Z';

const policy = (overrides = {}) => ({
  entity_type: 'series',
  entity_id: 'series-1',
  mode: 'worldwide',
  countries: [],
  languages: [],
  platforms: [],
  starts_at: null,
  ends_at: null,
  reason: 'commercial',
  note: null,
  ...overrides,
});

const episode = { entity_type: 'episode', entity_id: 'episode-1' };
const series = { entity_type: 'series', entity_id: 'series-1' };

test('no policy anywhere means available, and says so', () => {
  const decision = resolveAvailability(series, [], { country: 'SA', now: NOW });
  assert.equal(decision.available, true);
  assert.equal(decision.source, 'default');
  assert.equal(decision.policy, null);
  assert.match(decision.message_ar, /الافتراضي/);
});

test('selected_only admits a listed country and refuses an unlisted one', () => {
  const chain = [policy({ mode: 'selected_only', countries: ['SA', 'AE'], reason: 'rights' })];
  assert.equal(resolveAvailability(series, chain, { country: 'SA', now: NOW }).available, true);

  const refused = resolveAvailability(series, chain, { country: 'FR', now: NOW });
  assert.equal(refused.available, false);
  assert.equal(refused.code, 'country_not_selected');
  assert.equal(refused.reason, 'rights');
  // The message must name the country and the permitted list; a bare refusal is
  // unanswerable for whoever gets the support ticket.
  assert.match(refused.message_ar, /FR/);
  assert.match(refused.message_ar, /SA, AE/);
});

test('worldwide_except refuses exactly the excluded countries', () => {
  const chain = [policy({ mode: 'worldwide_except', countries: ['FR'], reason: 'legal' })];
  assert.equal(resolveAvailability(series, chain, { country: 'SA', now: NOW }).available, true);
  const refused = resolveAvailability(series, chain, { country: 'FR', now: NOW });
  assert.equal(refused.code, 'country_excluded');
});

test('unavailable refuses everywhere, whatever the country list says', () => {
  const chain = [policy({ mode: 'unavailable', countries: ['SA'], reason: 'editorial', note: 'قصة موسمية' })];
  for (const country of ['SA', 'FR', null]) {
    const decision = resolveAvailability(series, chain, { country, now: NOW });
    assert.equal(decision.available, false, `country ${country}`);
    assert.equal(decision.code, 'unavailable');
  }
  assert.match(resolveAvailability(series, chain, { country: 'SA', now: NOW }).message_ar, /قصة موسمية/);
});

test('an unknown country refuses restricted content and permits worldwide', () => {
  // The conservative direction: not knowing where a request came from must not be
  // a way to bypass a territory restriction.
  const restricted = resolveAvailability(series, [policy({ mode: 'selected_only', countries: ['SA'] })], { country: null, now: NOW });
  assert.equal(restricted.available, false);
  assert.equal(restricted.code, 'country_unknown');

  const open = resolveAvailability(series, [policy({ mode: 'worldwide' })], { country: null, now: NOW });
  assert.equal(open.available, true);
});

test('the availability window is evaluated before the mode', () => {
  const notStarted = resolveAvailability(series, [policy({ starts_at: '2026-09-01T00:00:00.000Z' })], { country: 'SA', now: NOW });
  assert.equal(notStarted.code, 'window_not_started');

  const ended = resolveAvailability(series, [policy({ ends_at: '2026-01-01T00:00:00.000Z' })], { country: 'SA', now: NOW });
  assert.equal(ended.code, 'window_ended');

  // A window that has ended is reported as a window, not as `unavailable`: the
  // operator action is a date, not a decision.
  assert.notEqual(ended.code, 'unavailable');
});

test('the nearest policy wins and can loosen its ancestor', () => {
  // A series restricted by licence, with one episode released worldwide as a
  // trailer. If the ancestor's restriction survived, the override would be a
  // control that does nothing.
  const chain = [
    policy({ entity_type: 'episode', entity_id: 'episode-1', mode: 'worldwide' }),
    policy({ entity_type: 'series', entity_id: 'series-1', mode: 'selected_only', countries: ['SA'], reason: 'rights' }),
  ];
  const decision = resolveAvailability(episode, chain, { country: 'FR', now: NOW });
  assert.equal(decision.available, true);
  assert.equal(decision.source, 'explicit');
  assert.equal(decision.inherited_from, null);
});

test('an inherited decision reports where it came from', () => {
  const chain = [policy({ entity_type: 'series', entity_id: 'series-1', mode: 'selected_only', countries: ['SA'], reason: 'rights' })];
  const decision = resolveAvailability(episode, chain, { country: 'SA', now: NOW });
  assert.equal(decision.available, true);
  assert.equal(decision.source, 'inherited');
  assert.deepEqual(decision.inherited_from, { entity_type: 'series', entity_id: 'series-1' });
  assert.match(decision.message_ar, /موروثة من series/);
});

test('language and platform narrow an otherwise permitted decision, and only when supplied', () => {
  const chain = [policy({ languages: ['ar'], platforms: ['ios'] })];
  assert.equal(resolveAvailability(series, chain, { country: 'SA', now: NOW }).available, true);
  assert.equal(resolveAvailability(series, chain, { country: 'SA', language: 'fr', now: NOW }).code, 'language_excluded');
  assert.equal(resolveAvailability(series, chain, { country: 'SA', platform: 'android', now: NOW }).code, 'platform_excluded');
});

test('the inheritance chain matches the schema, not an assumed hierarchy', () => {
  assert.deepEqual(availabilityChainScopes('episode'), ['episode', 'season', 'series', 'planet', 'global']);
  // Stories, books, games and projects have no season column; claiming otherwise
  // would make the resolver look for a policy that can never apply.
  assert.deepEqual(availabilityChainScopes('story'), ['story', 'series', 'planet', 'global']);
  assert.deepEqual(availabilityChainScopes('game'), ['game', 'series', 'planet', 'global']);
  assert.deepEqual(availabilityChainScopes('global'), ['global']);
});

// --- Normalisation ---------------------------------------------------------

test('country codes are upper-cased so a case mismatch cannot unrestrict content', () => {
  const result = normalizeAvailabilityInput({
    mode: 'selected_only', countries: ['sa', 'Ae', 'SA'], languages: ['AR'], platforms: ['IOS'],
    starts_at: null, ends_at: null, reason: 'rights', note: '  ملاحظة  ',
  });
  assert.ok('policy' in result);
  assert.deepEqual(result.policy.countries, ['SA', 'AE']);
  assert.deepEqual(result.policy.languages, ['ar']);
  assert.deepEqual(result.policy.platforms, ['ios']);
  assert.equal(result.policy.note, 'ملاحظة');
});

test('a restricted mode with no country list is refused rather than guessed', () => {
  // The two readings are opposites: selected_only with no countries blocks the
  // world, worldwide_except with none blocks nobody.
  for (const mode of ['selected_only', 'worldwide_except']) {
    const result = normalizeAvailabilityInput({
      mode, countries: [], languages: [], platforms: [],
      starts_at: null, ends_at: null, reason: 'rights', note: null,
    });
    assert.ok('error' in result, mode);
  }
});

test('invalid modes, reasons, codes and windows are rejected', () => {
  const base = {
    mode: 'worldwide', countries: [], languages: [], platforms: [],
    starts_at: null, ends_at: null, reason: 'rights', note: null,
  };
  assert.ok('error' in normalizeAvailabilityInput({ ...base, mode: 'somewhere' }));
  assert.ok('error' in normalizeAvailabilityInput({ ...base, reason: 'because' }));
  assert.ok('error' in normalizeAvailabilityInput({ ...base, mode: 'selected_only', countries: ['SAU'] }));
  assert.ok('error' in normalizeAvailabilityInput({ ...base, platforms: ['fridge'] }));
  assert.ok('error' in normalizeAvailabilityInput({ ...base, starts_at: 'soon' }));
  assert.ok('error' in normalizeAvailabilityInput({
    ...base, starts_at: '2026-09-01T00:00:00.000Z', ends_at: '2026-08-01T00:00:00.000Z',
  }));
});

// --- Enforcement wiring ----------------------------------------------------

const routesDir = fileURLToPath(new URL('../src/routes/', import.meta.url));
const read = (file) => readFileSync(routesDir + file, 'utf8');
const stripComments = (source) => source
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

for (const file of ['series.ts', 'episodes.ts', 'games.ts', 'books.ts']) {
  test(`${file} enforces availability server-side`, () => {
    const code = stripComments(read(file));
    assert.match(code, /availabilityFor\(|availabilityForBatch\(/, `${file} never resolves availability`);
    assert.match(code, /availabilityRefusal\(|withheld_in_territory/, `${file} never acts on the decision`);
  });
}

test('the playback start refuses restricted territories with 451', () => {
  const code = stripComments(read('episodes.ts'));
  const start = code.indexOf("episodesRoute.post('/:id/playback-sessions'");
  assert.notEqual(start, -1);
  const handler = code.slice(start, code.indexOf('\nepisodesRoute.', start + 1));
  assert.match(handler, /availabilityFor\(c\.env, 'episode'/);
  assert.match(handler, /451/);
  // Refuse before the lease is created: a lease plus a media token is the actual
  // grant, and issuing one then refusing later would already have handed it over.
  assert.ok(
    handler.indexOf('availabilityRefusal') < handler.indexOf("'/playback/start'"),
    'availability is checked after the lease is requested',
  );
});

test('country-filtered catalogue responses are cached per country', () => {
  // Without a country in the cache key, a page filtered for one territory is served
  // verbatim to every other one, and the enforcement becomes decorative with a
  // cache hit as the only evidence.
  for (const file of ['series.ts', 'episodes.ts']) {
    const code = stripComments(read(file));
    assert.match(code, /cachedPublicJson\([\s\S]*?context\.country \?\? 'unknown'\)/, file);
  }
  const cache = stripComments(readFileSync(fileURLToPath(new URL('../src/lib/publicCache.ts', import.meta.url)), 'utf8'));
  assert.match(cache, /variant/);
});

test('the development country header is refused in production', () => {
  const geo = stripComments(readFileSync(fileURLToPath(new URL('../src/lib/requestGeo.ts', import.meta.url)), 'utf8'));
  assert.match(geo, /cf\?\.country/);
  assert.match(geo, /isProduction/);
  // The header may only be honoured when NOT production, and that must be a code
  // condition rather than a configuration value someone can flip.
  assert.match(geo, /if \(!isProduction && claimed/);
});

test('availability writes are audited as their own action', () => {
  const code = stripComments(read('adminAvailability.ts'));
  assert.match(code, /'availability_set'/);
  assert.match(code, /'availability_cleared'/);
  assert.match(code, /requirePermission\('publish'\)/);
  // The platform default must not be deletable: nothing would inherit from it and
  // the resolver treats a missing chain as available.
  assert.match(code, /scope === 'global'[\s\S]{0,200}409/);
});
