/// Tests for the visual asset production queue.
///
/// The property being pinned is that every image comes back with a *role*, and
/// that the role carries the geometry and the brief. An asset id on its own is not
/// something an illustrator can draw, and a size guessed from a file name is a
/// size that will be wrong.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLE_LABELS,
  ROLE_SPECS,
  artQueueAssetIds,
  artRequirements,
  buildArtProductionQueue,
  summarizeArtQueue,
} from '../src/lib/artProductionQueue.ts';

function game(overrides = {}) {
  return {
    id: 'game-1',
    title: 'لعبة',
    engineId: 'match_pairs',
    status: 'draft',
    pack: { levels: [] },
    reviews: [],
    linkedAssets: [],
    ...overrides,
  };
}

const byId = (rows, id) => rows.find((row) => row.asset_id === id);

test('every role has a spec and an Arabic label', () => {
  // A role with no spec would produce a queue row with no size, which is a row an
  // illustrator cannot act on.
  for (const role of Object.keys(ROLE_SPECS)) {
    assert.ok(ROLE_LABELS[role], `${role} has no label`);
    assert.ok(ROLE_SPECS[role].aspect_ratio, `${role} has no aspect ratio`);
    assert.ok(ROLE_SPECS[role].format, `${role} has no format`);
  }
});

test('a colouring template is recognised as a template, not as generic artwork', () => {
  // The field that names an asset is the only reliable signal of its role.
  const requirements = artRequirements('trace_color', {
    levels: [{
      level: 1, mode: 'shape',
      background_asset: 'asset-bg',
      coloring: { template_asset: 'asset-template' },
    }],
  });
  assert.equal(requirements.find((r) => r.assetId === 'asset-template').role, 'template');
  assert.equal(requirements.find((r) => r.assetId === 'asset-bg').role, 'background');
});

test('a trace_color letter level produces a language-locked tracing reference', () => {
  // The glyph is the content, which is the one documented exception to "no text
  // inside an image" — and the reason the asset cannot be reused in another build.
  const requirements = artRequirements('trace_color', {
    levels: [{ level: 1, mode: 'letter', background_asset: 'asset-letter-ba' }],
  });
  const letter = requirements.find((r) => r.assetId === 'asset-letter-ba');
  assert.equal(letter.role, 'tracing_reference');
  assert.equal(letter.languageDependency, 'ar');
  assert.match(letter.brief, /بيانات لعب/);
  assert.equal(ROLE_SPECS.tracing_reference.glyph_allowed, true);
});

test('a timeline_map base map is briefed with the rules that invalidate it', () => {
  const requirements = artRequirements('timeline_map', {
    levels: [{
      level: 1, mode: 'both',
      map: { region: 'arab_world', image: 'asset-map', mirror_in_rtl: false },
      events: [{ id: 'e1', image: 'asset-baghdad', label_key: 'hist.baghdad' }],
    }],
  });
  const map = requirements.find((r) => r.assetId === 'asset-map');
  assert.equal(map.role, 'map_base');
  assert.match(map.brief, /equirectangular/);
  assert.match(map.brief, /متنازع/);
  assert.match(map.brief, /لا تُعكس/);
  assert.equal(ROLE_SPECS.map_base.size, null, 'a base map should be vector');

  const event = requirements.find((r) => r.assetId === 'asset-baghdad');
  assert.equal(event.role, 'game_illustration');
  assert.match(event.brief, /بلا نصّ مطبوع/);
});

test('the containers the gate walks are all walked here', () => {
  // Mirrors `referencedAssetIds` in gamePackGate.ts, plus panels, targets and bins
  // whose schemas define an `image` of their own.
  const requirements = artRequirements('sort_bins', {
    levels: [{
      level: 1,
      bins: [{ id: 'water', image: 'a-bin' }],
      items: [{ id: 'fish', image: 'a-item' }],
      pairs: [{ a: 'a-pair-a', b: 'a-pair-b' }],
      panels: [{ id: 'p1', image: 'a-panel' }],
      targets: [{ id: 't1', image: 'a-target' }],
      distractors: [{ id: 'd1', image: 'a-distractor' }],
      events: [{ id: 'e1', image: 'a-event' }],
    }],
  });
  const ids = requirements.map((r) => r.assetId).sort();
  assert.deepEqual(ids, [
    'a-bin', 'a-distractor', 'a-event', 'a-item', 'a-pair-a', 'a-pair-b',
    'a-panel', 'a-target',
  ]);
});

test('nested counting sets and grids are reached', () => {
  const counting = artRequirements('count_quantity', {
    levels: [{
      level: 1, mode: 'compare_sets',
      items: [{
        id: 'i1',
        set_a: { image: 'a-set-a', count: 3 },
        set_b: { image: 'a-set-b', count: 5 },
        items: [{ image: 'a-nested', count: 2 }],
      }],
    }],
  });
  const ids = counting.map((r) => r.assetId).sort();
  assert.deepEqual(ids, ['a-nested', 'a-set-a', 'a-set-b']);

  const logic = artRequirements('logic_pattern', {
    levels: [{
      level: 1, mode: 'matrix_3x3',
      grid: [['a-c1', 'a-c2'], ['a-c3', null]],
      options: ['a-o1', 'a-o2'],
      answer: 'a-o1',
    }],
  });
  assert.deepEqual(logic.map((r) => r.assetId).sort(), ['a-c1', 'a-c2', 'a-c3', 'a-o1', 'a-o2']);
});

test('an id reused across levels is one drawing, not two commissions', () => {
  const requirements = artRequirements('match_pairs', {
    levels: [
      { level: 1, items: [{ id: 'cat', image: 'a-cat' }] },
      { level: 2, items: [{ id: 'cat', image: 'a-cat' }] },
    ],
  });
  assert.equal(requirements.filter((r) => r.assetId === 'a-cat').length, 1);
  assert.equal(requirements[0].level, 1);
});

test('an asset declared in the bundle but used by no level is flagged, not hidden', () => {
  const requirements = artRequirements('match_pairs', {
    levels: [{ level: 1, items: [{ id: 'cat', image: 'a-cat' }] }],
    assets: { images: ['a-cat', 'a-orphan'] },
  });
  const orphan = requirements.find((r) => r.assetId === 'a-orphan');
  assert.ok(orphan);
  assert.equal(orphan.level, null);
  assert.match(orphan.brief, /لا يستخدمه أي مستوى/);
});

/* -------------------------------------------------------------------- rows */

test('nothing is reported ready unless the asset row says ready', () => {
  const rows = buildArtProductionQueue([game({
    pack: {
      levels: [{
        level: 1,
        items: [
          { id: 'a', image: 'a-ready' },
          { id: 'b', image: 'a-planned' },
          { id: 'c', image: 'a-absent' },
        ],
      }],
    },
  })], {
    assets: {
      'a-ready': { status: 'ready' },
      'a-planned': { status: 'planned' },
    },
  });

  assert.equal(byId(rows, 'a-ready').production_status, 'ready');
  assert.equal(byId(rows, 'a-planned').production_status, 'pending');
  assert.equal(byId(rows, 'a-absent').production_status, 'missing');
  assert.equal(byId(rows, 'a-absent').asset_status, null);
  assert.match(byId(rows, 'a-absent').blocker, /لم يُرسم/);
  assert.equal(byId(rows, 'a-ready').blocker, null);
});

test('a visual requirement pointing at an audio row is a blocker', () => {
  // It passes every existence check and then renders nothing.
  const rows = buildArtProductionQueue([game({
    pack: { levels: [{ level: 1, items: [{ id: 'a', image: 'a-wrong-kind' }] }] },
  })], { assets: { 'a-wrong-kind': { status: 'ready', kind: 'audio' } } });
  assert.match(byId(rows, 'a-wrong-kind').blocker, /audio/);
});

test('a language-locked asset filed under the wrong language is a blocker', () => {
  const rows = buildArtProductionQueue([game({
    engineId: 'trace_color',
    pack: { levels: [{ level: 1, mode: 'letter', background_asset: 'a-letter' }] },
  })], { assets: { 'a-letter': { status: 'ready', kind: 'image', language: 'fr' } } });
  const row = byId(rows, 'a-letter');
  assert.equal(row.language_dependency, 'ar');
  assert.match(row.blocker, /"ar"/);
  assert.match(row.blocker, /"fr"/);
});

test('the expected geometry falls back to the brand spec and is overridden by the row', () => {
  const rows = buildArtProductionQueue([game({
    pack: {
      levels: [{
        level: 1,
        items: [{ id: 'a', image: 'a-declared' }, { id: 'b', image: 'a-spec' }],
      }],
    },
  })], {
    assets: {
      'a-declared': { status: 'ready', kind: 'image', expectedWidth: 800, expectedHeight: 800, aspectRatio: '1:1' },
      'a-spec': { status: 'ready', kind: 'image' },
    },
  });
  assert.equal(byId(rows, 'a-declared').expected_size, '800×800');
  assert.equal(byId(rows, 'a-spec').expected_size, ROLE_SPECS.game_illustration.size);
  assert.equal(byId(rows, 'a-spec').expected_aspect_ratio, '1:1');
});

test('the cover is queued even though the pack never mentions it', () => {
  // A game with no cover is a blank tile in a child's library, and a board that
  // only knows about pack assets never shows it.
  const rows = buildArtProductionQueue([game({
    linkedAssets: [{ role: 'cover', assetId: 'a-cover' }],
  })], { assets: {} });
  const cover = byId(rows, 'a-cover');
  assert.equal(cover.role, 'cover');
  assert.equal(cover.production_status, 'missing');
  assert.match(cover.brief, /1200/);
  assert.match(cover.brief, /بلا نصّ مطبوع/);
});

test('every row names its game, level, owner and review', () => {
  const rows = buildArtProductionQueue([game({
    id: 'g-7', title: 'ترتيب',
    pack: { levels: [{ level: 2, items: [{ id: 'a', image: 'a-1' }] }] },
    reviews: [{ role: 'qa', status: 'needs_changes' }],
  })], { assets: { 'a-1': { status: 'ready', kind: 'image', uploadedBy: 'admin-3' } } });

  const row = byId(rows, 'a-1');
  assert.equal(row.game_id, 'g-7');
  assert.equal(row.game_title, 'ترتيب');
  assert.equal(row.level, 2);
  assert.equal(row.assigned_owner, 'admin-3');
  assert.equal(row.review_role, 'qa');
  assert.equal(row.review_status, 'needs_changes');
  assert.match(row.blocker, /needs_changes/);
  assert.ok(row.brief.length > 20);
  assert.equal(row.role_label_ar, ROLE_LABELS.game_illustration);
});

test('no review record is reported as no record', () => {
  const rows = buildArtProductionQueue([game({
    pack: { levels: [{ level: 1, items: [{ id: 'a', image: 'a-1' }] }] },
  })], { assets: {} });
  assert.equal(byId(rows, 'a-1').review_status, 'no_review_record');
});

test('the asset id collector covers pack assets and linked assets', () => {
  const games = [game({
    pack: { levels: [{ level: 1, items: [{ id: 'a', image: 'a-pack' }] }] },
    linkedAssets: [{ role: 'cover', assetId: 'a-cover' }],
  })];
  assert.deepEqual(artQueueAssetIds(games).sort(), ['a-cover', 'a-pack']);
});

test('the summary partitions the rows and counts language locks', () => {
  const rows = buildArtProductionQueue([game({
    engineId: 'trace_color',
    pack: {
      levels: [
        { level: 1, mode: 'letter', background_asset: 'a-letter' },
        { level: 2, mode: 'shape', background_asset: 'a-bg', coloring: { template_asset: 'a-tpl' } },
      ],
    },
  })], { assets: { 'a-letter': { status: 'ready', kind: 'image' } } });

  const summary = summarizeArtQueue(rows);
  assert.equal(summary.total, 3);
  assert.equal(summary.ready + summary.pending + summary.missing, 3);
  assert.equal(summary.ready, 1);
  assert.equal(summary.language_locked, 1);
  assert.equal(summary.by_role.tracing_reference.total, 1);
  assert.equal(summary.by_role.template.total, 1);
});
