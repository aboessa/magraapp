/// Tests for the voice-over production queue.
///
/// The behaviour being pinned is that the queue is derived from the **contract**
/// and not from what a pack happens to bind. The failure it replaces was a count
/// of unresolved asset ids, which reported zero outstanding recordings for a
/// `count_quantity` pack that was twenty clips short — because nobody had created
/// the ids yet, so there was nothing to count as missing.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COUNT_CLIP_MAX,
  ENGINES_WITHOUT_FEEDBACK_VOICE,
  audioQueueAssetIds,
  buildAudioProductionQueue,
  summarizeAudioQueue,
  voiceRequirements,
} from '../src/lib/audioProductionQueue.ts';
import { BASE_REQUIRED_VOICE_KEYS } from '../src/lib/packSchema.ts';
import { ENGINE_CONTRACTS } from '../src/lib/engineContracts.ts';

const keys = (requirements) => requirements.map((entry) => entry.voiceKey);

function game(overrides = {}) {
  return {
    id: 'game-1',
    title: 'لعبة',
    engineId: 'match_pairs',
    status: 'draft',
    pack: {
      voice_manifest: {},
      levels: [{ level: 1, prompt_key: 'game.x.prompt' }],
    },
    localizations: [],
    reviews: [],
    ...overrides,
  };
}

const LANGUAGES = ['ar', 'en', 'fr'];

/* ------------------------------------------------------------ requirements */

test('every engine needs the six base keys', () => {
  for (const engineId of Object.keys(ENGINE_CONTRACTS)) {
    const required = keys(voiceRequirements(engineId, { levels: [] }));
    for (const key of BASE_REQUIRED_VOICE_KEYS) {
      assert.ok(required.includes(key), `${engineId} is missing ${key}`);
    }
  }
});

test('count_quantity needs twenty separate number clips, not one sentence', () => {
  // «أرقام العدّ: مقاطع منفصلة لكل رقم 1–20». The engine speaks numbers in
  // sequence while highlighting each element, so a recorded sentence cannot be
  // cut apart to do it.
  const required = keys(voiceRequirements('count_quantity', { levels: [] }));
  for (let number = 1; number <= COUNT_CLIP_MAX; number += 1) {
    assert.ok(required.includes(`vo.count.${number}`), `missing vo.count.${number}`);
  }
  assert.ok(required.includes('vo.recount'));
  assert.ok(required.includes('vo.explain_answer'));
  // Twenty distinct clips, so no single key stands in for the set.
  assert.equal(new Set(required.filter((key) => key.startsWith('vo.count.'))).size, 20);
});

test('block_code needs one clip per allowed block token', () => {
  const required = keys(voiceRequirements('block_code', {
    levels: [
      { level: 1, allowed_blocks: ['move', 'turn_left'] },
      { level: 2, allowed_blocks: ['move', 'repeat', 'collect'] },
    ],
  }));
  for (const token of ['move', 'turn_left', 'repeat', 'collect']) {
    assert.ok(required.includes(`vo.block.${token}`), `missing vo.block.${token}`);
  }
  // A block that no level allows is not recorded.
  assert.ok(!required.includes('vo.block.if_path'));
  assert.ok(required.includes('vo.collision'));
  assert.ok(required.includes('vo.star_optimal'));
});

test('sim_lab needs the three stage clips', () => {
  const required = keys(voiceRequirements('sim_lab', { levels: [] }));
  for (const key of ['vo.stage_predict', 'vo.stage_experiment', 'vo.stage_explain',
    'vo.trial_recorded', 'vo.need_more_trials', 'vo.explain_final']) {
    assert.ok(required.includes(key), `missing ${key}`);
  }
});

test('the two engines that must stay silent are not asked for feedback clips', () => {
  // «memory_flip: لا vo.retry إطلاقًا — صمت مقصود» and rhythm_tap has neither,
  // because the music is the feedback. Recording them would be studio time spent
  // on lines the engine is forbidden to play.
  assert.deepEqual([...ENGINES_WITHOUT_FEEDBACK_VOICE].sort(), ['memory_flip', 'rhythm_tap']);
  for (const engineId of ENGINES_WITHOUT_FEEDBACK_VOICE) {
    const required = keys(voiceRequirements(engineId, { levels: [] }));
    assert.ok(!required.includes('vo.retry'), `${engineId} should not need vo.retry`);
    assert.ok(!required.includes('vo.correct'), `${engineId} should not need vo.correct`);
  }
  assert.ok(keys(voiceRequirements('match_pairs', { levels: [] })).includes('vo.retry'));
});

test('per-element label clips are derived from the level content', () => {
  const sortBins = voiceRequirements('sort_bins', {
    levels: [{
      level: 1,
      bins: [{ id: 'water', label_key: 'bin.water', audio: 'asset-vo-water' }],
      items: [{ id: 'fish', label_key: 'item.fish', audio: null }],
    }],
  });
  const water = sortBins.find((entry) => entry.voiceKey === 'vo.bin_label.water');
  assert.ok(water);
  assert.equal(water.boundAssetId, 'asset-vo-water');
  assert.equal(water.textKey, 'bin.water');
  assert.equal(water.level, 1);

  const fish = sortBins.find((entry) => entry.voiceKey === 'vo.item_label.fish');
  assert.ok(fish);
  assert.equal(fish.boundAssetId, null);
});

test('word_build needs a clip per letter and carries the word as source text', () => {
  const required = voiceRequirements('word_build', {
    levels: [{
      level: 1, language: 'ar', word: 'قمر',
      word_audio: 'asset-vo-word', word_syllables_audio: null,
      letters: [
        { char: 'ق', position: 1, form: 'initial', audio: 'asset-vo-qaf' },
        { char: 'م', position: 2, form: 'medial', audio: null },
        { char: 'ر', position: 3, form: 'final', audio: 'asset-vo-ra' },
      ],
    }],
  });
  const letters = required.filter((entry) => entry.voiceKey.startsWith('vo.letter.'));
  assert.equal(letters.length, 3);
  assert.equal(letters[0].packText, 'ق');
  assert.match(letters[0].purpose, /initial/);

  const word = required.find((entry) => entry.voiceKey === 'vo.word');
  assert.equal(word.boundAssetId, 'asset-vo-word');
  assert.equal(word.packText, 'قمر');
});

test('a distractor is named aloud like any other tile', () => {
  // A silent decoy tells a child which tiles are the decoys.
  const required = keys(voiceRequirements('match_pairs', {
    levels: [{ level: 1, items: [{ id: 'cat' }], distractors: [{ id: 'dog' }] }],
  }));
  assert.ok(required.includes('vo.item_label.cat'));
  assert.ok(required.includes('vo.item_label.dog'));
});

test('memory_flip explains a pair only from level five', () => {
  const early = voiceRequirements('memory_flip', {
    levels: [{ level: 1, pairs: [{ a: 'cow', b: 'cow' }] }],
  });
  const late = voiceRequirements('memory_flip', {
    levels: [
      { level: 1, pairs: [] }, { level: 2, pairs: [] }, { level: 3, pairs: [] },
      { level: 4, pairs: [] }, { level: 5, pairs: [{ a: 'cow', b: 'milk' }] },
    ],
  });
  assert.equal(early.find((e) => e.voiceKey.startsWith('vo.pair_explain')).required, false);
  assert.equal(late.find((e) => e.voiceKey.startsWith('vo.pair_explain')).required, true);
});

test('rhythm_tap queues its music track as a rights-bearing audio item', () => {
  const required = voiceRequirements('rhythm_tap', {
    levels: [{ level: 1, track: 'asset-track-1' }],
  });
  const track = required.find((entry) => entry.voiceKey === 'music.track');
  assert.ok(track);
  assert.equal(track.boundAssetId, 'asset-track-1');
  assert.equal(track.level, 1);
});

/* -------------------------------------------------------------------- rows */

test('nothing is reported ready unless the asset row says ready', () => {
  const rows = buildAudioProductionQueue([game({
    pack: {
      voice_manifest: {
        'vo.intro': 'asset-ready',
        'vo.instruction': 'asset-pending',
        'vo.exit_confirm': 'asset-failed',
        'vo.level_complete': 'asset-absent',
      },
      levels: [],
    },
  })], {
    languages: ['ar'],
    assetStatus: { 'asset-ready': 'ready', 'asset-pending': 'processing', 'asset-failed': 'failed' },
  });

  const status = (key) => rows.find((row) => row.voice_key === key);
  assert.equal(status('vo.intro').production_status, 'ready');
  assert.equal(status('vo.instruction').production_status, 'pending');
  // `failed` is not ready, and the raw status stays visible behind the bucket.
  assert.equal(status('vo.exit_confirm').production_status, 'pending');
  assert.equal(status('vo.exit_confirm').asset_status, 'failed');
  // An id with no row is missing, not pending: nothing was ever produced.
  assert.equal(status('vo.level_complete').production_status, 'missing');
  assert.equal(status('vo.level_complete').asset_status, null);
  // An unbound key is missing too, and says which key.
  assert.equal(status('vo.game_complete').production_status, 'missing');
  assert.match(status('vo.game_complete').blocker, /vo\.game_complete/);
});

test('a non-Arabic language does not inherit the Arabic recording', () => {
  // At runtime the delivery layer falls back to Arabic rather than to silence.
  // That is right for playback and wrong for production: no French clip exists.
  const rows = buildAudioProductionQueue([game({
    pack: { voice_manifest: { 'vo.intro': 'asset-ar-intro' }, levels: [] },
    localizations: [
      { language: 'ar', status: 'ready', prompts: {}, voiceManifest: {} },
      { language: 'fr', status: 'draft', prompts: {}, voiceManifest: {} },
    ],
  })], { languages: LANGUAGES, assetStatus: { 'asset-ar-intro': 'ready' } });

  const arabic = rows.find((row) => row.language === 'ar' && row.voice_key === 'vo.intro');
  const french = rows.find((row) => row.language === 'fr' && row.voice_key === 'vo.intro');
  assert.equal(arabic.production_status, 'ready');
  assert.equal(arabic.asset_id, 'asset-ar-intro');
  assert.equal(french.production_status, 'missing');
  assert.equal(french.asset_id, null);

  // A real French override is honoured.
  const withOverride = buildAudioProductionQueue([game({
    pack: { voice_manifest: { 'vo.intro': 'asset-ar-intro' }, levels: [] },
    localizations: [{ language: 'fr', status: 'ready', prompts: {}, voiceManifest: { 'vo.intro': 'asset-fr-intro' } }],
  })], { languages: ['fr'], assetStatus: { 'asset-fr-intro': 'ready' } });
  assert.equal(withOverride.find((row) => row.voice_key === 'vo.intro').production_status, 'ready');
});

test('source text is quoted from a human, never generated', () => {
  const rows = buildAudioProductionQueue([game({
    pack: { voice_manifest: {}, levels: [{ level: 1, prompt_key: 'game.x.prompt' }] },
    localizations: [{
      language: 'ar', status: 'ready',
      prompts: { 'game.x.prompt': 'اختر الصورة المناسبة', 'vo.intro': 'هيا نلعب' },
      voiceManifest: {},
    }],
  })], { languages: ['ar'], assetStatus: {} });

  const instruction = rows.find((row) => row.voice_key === 'vo.instruction' && row.level === 1);
  assert.equal(instruction.source_text, 'اختر الصورة المناسبة');
  assert.equal(instruction.source_text_origin, 'localization');
  assert.equal(instruction.text_key, 'game.x.prompt');

  const intro = rows.find((row) => row.voice_key === 'vo.intro');
  assert.equal(intro.source_text, 'هيا نلعب');

  // Nothing invented for a key nobody wrote.
  const exit = rows.find((row) => row.voice_key === 'vo.exit_confirm');
  assert.equal(exit.source_text, null);
  assert.equal(exit.source_text_origin, null);
  assert.match(exit.blocker, /لا نصّ مصدر/);
});

test('a pack literal is offered as Arabic source and labelled as a pack literal', () => {
  const rows = buildAudioProductionQueue([game({
    engineId: 'word_build',
    pack: {
      voice_manifest: {},
      levels: [{ level: 1, language: 'ar', word: 'قمر', letters: [{ char: 'ق', position: 1, audio: null }] }],
    },
  })], { languages: ['ar', 'fr'], assetStatus: {} });

  const arabicWord = rows.find((row) => row.language === 'ar' && row.voice_key === 'vo.word');
  assert.equal(arabicWord.source_text, 'قمر');
  assert.equal(arabicWord.source_text_origin, 'pack');

  // A pack literal is Arabic, so it is not offered as the French script.
  const frenchWord = rows.find((row) => row.language === 'fr' && row.voice_key === 'vo.word');
  assert.equal(frenchWord.source_text, null);
});

test('every row carries the language, the game, the level and the requirement level', () => {
  const rows = buildAudioProductionQueue([game({ id: 'g-9', title: 'مطابقة' })], {
    languages: ['ar'], assetStatus: {},
  });
  for (const row of rows) {
    assert.equal(row.game_id, 'g-9');
    assert.equal(row.game_title, 'مطابقة');
    assert.equal(row.engine_id, 'match_pairs');
    assert.equal(row.expected_asset_kind, 'audio');
    assert.equal(row.language, 'ar');
    assert.ok(['required', 'optional'].includes(row.requirement));
    assert.ok(row.purpose.length > 4, `no brief for ${row.voice_key}`);
  }
});

test('review status is resolved per artefact: language for speech, rights for music', () => {
  const rows = buildAudioProductionQueue([game({
    engineId: 'rhythm_tap',
    pack: { voice_manifest: {}, levels: [{ level: 1, track: 'asset-track' }] },
    reviews: [{ role: 'lang', status: 'approved' }, { role: 'rights', status: 'pending' }],
  })], { languages: ['ar'], assetStatus: { 'asset-track': 'ready' } });

  const intro = rows.find((row) => row.voice_key === 'vo.intro');
  assert.equal(intro.review_role, 'lang');
  assert.equal(intro.review_status, 'approved');

  const track = rows.find((row) => row.voice_key === 'music.track');
  assert.equal(track.review_role, 'rights');
  assert.equal(track.review_status, 'pending');
});

test('a refused language review becomes a blocker on every speech row', () => {
  const rows = buildAudioProductionQueue([game({
    pack: { voice_manifest: { 'vo.intro': 'a1' }, levels: [] },
    localizations: [{ language: 'ar', status: 'ready', prompts: { 'vo.intro': 'مرحبًا' }, voiceManifest: {} }],
    reviews: [{ role: 'lang', status: 'needs_changes' }],
  })], { languages: ['ar'], assetStatus: { a1: 'ready' } });

  const intro = rows.find((row) => row.voice_key === 'vo.intro');
  assert.equal(intro.production_status, 'ready');
  assert.match(intro.blocker, /needs_changes/);
});

test('no review record is reported as no record, not as approved', () => {
  const rows = buildAudioProductionQueue([game()], { languages: ['ar'], assetStatus: {} });
  assert.equal(rows[0].review_status, 'no_review_record');
});

test('the asset id collector finds every id the rows could name', () => {
  const games = [game({
    engineId: 'word_build',
    pack: {
      voice_manifest: { 'vo.intro': 'a-manifest' },
      levels: [{ level: 1, language: 'ar', word: 'قمر', word_audio: 'a-word', letters: [{ char: 'ق', position: 1, audio: 'a-letter' }] }],
    },
    localizations: [{ language: 'fr', status: 'draft', prompts: {}, voiceManifest: { 'vo.intro': 'a-fr' } }],
  })];
  const ids = audioQueueAssetIds(games).sort();
  assert.deepEqual(ids, ['a-fr', 'a-letter', 'a-manifest', 'a-word']);
});

test('the summary is computed from the rows it summarises', () => {
  const rows = buildAudioProductionQueue([game({
    pack: { voice_manifest: { 'vo.intro': 'a-ready' }, levels: [] },
  })], { languages: ['ar'], assetStatus: { 'a-ready': 'ready' } });

  const summary = summarizeAudioQueue(rows);
  assert.equal(summary.total, rows.length);
  assert.equal(summary.ready + summary.pending + summary.missing, rows.length);
  assert.equal(summary.required + summary.optional, rows.length);
  assert.equal(summary.ready, 1);
  assert.equal(summary.required_outstanding, rows.filter((row) => row.requirement === 'required' && row.production_status !== 'ready').length);
  assert.equal(summary.by_language.ar.total, rows.length);
});

test('a count_quantity pack with six bound keys still reports twenty outstanding clips', () => {
  // The regression this whole module exists for: the old count reported zero
  // missing recordings here, because the twenty ids did not exist to be counted.
  const rows = buildAudioProductionQueue([game({
    engineId: 'count_quantity',
    pack: {
      voice_manifest: Object.fromEntries(BASE_REQUIRED_VOICE_KEYS.map((key) => [key, `a-${key}`])),
      levels: [{ level: 1, mode: 'count_and_pick', items: [] }],
    },
  })], {
    languages: ['ar'],
    assetStatus: Object.fromEntries(BASE_REQUIRED_VOICE_KEYS.map((key) => [`a-${key}`, 'ready'])),
  });

  const countRows = rows.filter((row) => row.voice_key.startsWith('vo.count.'));
  assert.equal(countRows.length, 20);
  assert.ok(countRows.every((row) => row.production_status === 'missing'));
  assert.ok(summarizeAudioQueue(rows).required_outstanding >= 20);
});
