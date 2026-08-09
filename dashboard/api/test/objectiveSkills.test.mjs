/// Tests for lib/objectiveSkills.ts — the multi-skill learning objective model
/// added by migration 0022.
///
/// The behaviour under test is the invariant that made the migration necessary:
/// `learning_objectives.skill_id` stays authoritative for the primary skill, and
/// the join table carries the primary plus the secondaries so the two cannot
/// disagree.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  collapseObjectiveSkills,
  isSkillRole,
  objectiveSkillWrites,
  parseObjectiveSkills,
  referencedSkillIds,
  serializeObjectiveSkills,
} from '../src/lib/objectiveSkills.ts';

test('a primary and its secondaries collapse into a stable shape', () => {
  const result = collapseObjectiveSkills([
    { skill_id: 'writing', role: 'primary' },
    { skill_id: 'visual_motor_integration', role: 'secondary' },
    { skill_id: 'fine_motor', role: 'secondary' },
    { skill_id: 'letter_formation', role: 'secondary' },
  ]);
  assert.equal(result.primary, 'writing');
  // Sorted so the API response does not reorder between requests.
  assert.deepEqual(result.secondary, ['fine_motor', 'letter_formation', 'visual_motor_integration']);
});

test('an objective with no skill collapses to a null primary rather than throwing', () => {
  // 60 of the 121 seeded objectives have skill_id IS NULL, so this is a real
  // state and not an edge case.
  const result = collapseObjectiveSkills([]);
  assert.equal(result.primary, null);
  assert.deepEqual(result.secondary, []);
});

test('duplicate rows collapse once and a second primary is demoted', () => {
  // The partial unique index prevents this in D1; the function is also used on
  // payloads that have not been written yet.
  const result = collapseObjectiveSkills([
    { skill_id: 'fine_motor', role: 'primary' },
    { skill_id: 'fine_motor', role: 'secondary' },
    { skill_id: 'creativity', role: 'primary' },
  ]);
  assert.equal(result.primary, 'fine_motor');
  assert.deepEqual(result.secondary, ['creativity']);
});

test('serialization puts the primary first and carries display fields', () => {
  const result = serializeObjectiveSkills([
    { skill_id: 'fine_motor', role: 'primary', name_ar: 'المهارة الحركية الدقيقة', category: 'motor' },
    { skill_id: 'hand_eye_coordination', role: 'secondary', name_ar: 'التناسق بين اليد والعين', category: 'motor' },
  ]);
  assert.equal(result.primary_skill_id, 'fine_motor');
  assert.deepEqual(result.secondary_skill_ids, ['hand_eye_coordination']);
  assert.equal(result.skills[0].role, 'primary');
  assert.equal(result.skills[0].name_ar, 'المهارة الحركية الدقيقة');
  assert.equal(result.skills[1].skill_id, 'hand_eye_coordination');
  assert.equal(result.skills.length, 2);
});

test('a skill cannot be both the primary and a secondary', () => {
  // Silently de-duplicating would make the API report a skill it did not store,
  // and the join table primary key would reject the second row anyway.
  const result = parseObjectiveSkills('fine_motor', ['fine_motor']);
  assert.ok('error' in result);
  assert.match(result.error, /already the primary skill/);
});

test('a skill listed twice as a secondary is rejected', () => {
  const result = parseObjectiveSkills('writing', ['fine_motor', 'fine_motor']);
  assert.ok('error' in result);
  assert.match(result.error, /listed twice/);
});

test('secondary skills without a primary are rejected', () => {
  // A supporting skill with nothing to support is a data-entry mistake, and it
  // would produce an objective invisible to every skill_id consumer.
  const result = parseObjectiveSkills(null, ['fine_motor']);
  assert.ok('error' in result);
  assert.match(result.error, /require a primary/);
});

test('a null primary with no secondaries is accepted', () => {
  const result = parseObjectiveSkills(null, undefined);
  assert.ok('payload' in result);
  assert.equal(result.payload.primary, null);
  assert.deepEqual(result.payload.secondary, []);
});

test('an empty-string primary is treated as null, not as a skill named ""', () => {
  const result = parseObjectiveSkills('', undefined);
  assert.ok('payload' in result);
  assert.equal(result.payload.primary, null);
});

test('non-array and non-string secondary values are rejected', () => {
  assert.ok('error' in parseObjectiveSkills('writing', 'fine_motor'));
  assert.ok('error' in parseObjectiveSkills('writing', [42]));
  assert.ok('error' in parseObjectiveSkills('writing', ['   ']));
});

test('the write set always rebuilds the primary from skill_id', () => {
  // This is what keeps the column and the table in agreement: the primary row
  // is never carried over from what was already stored.
  const parsed = parseObjectiveSkills('writing', ['fine_motor', 'letter_formation']);
  assert.ok('payload' in parsed);
  const writes = objectiveSkillWrites(parsed.payload);
  assert.deepEqual(writes, [
    { skill_id: 'writing', role: 'primary' },
    { skill_id: 'fine_motor', role: 'secondary' },
    { skill_id: 'letter_formation', role: 'secondary' },
  ]);
  assert.equal(writes.filter((row) => row.role === 'primary').length, 1);
});

test('a null primary writes no rows at all', () => {
  assert.deepEqual(objectiveSkillWrites({ primary: null, secondary: [] }), []);
});

test('referenced skill ids cover every row that needs an existence check', () => {
  const ids = referencedSkillIds({ primary: 'writing', secondary: ['fine_motor', 'letter_formation'] });
  assert.deepEqual(ids, ['writing', 'fine_motor', 'letter_formation']);
});

test('only the two defined roles are accepted', () => {
  assert.ok(isSkillRole('primary'));
  assert.ok(isSkillRole('secondary'));
  assert.ok(!isSkillRole('tertiary'));
  assert.ok(!isSkillRole(undefined));
});

test('the letter-tracing assignment from migration 0022 round-trips', () => {
  // The real shape: primary stays `writing` so ABJAD reporting is untouched,
  // and the motor skills are added alongside rather than replacing it.
  const parsed = parseObjectiveSkills('writing', ['fine_motor', 'letter_formation', 'visual_motor_integration']);
  assert.ok('payload' in parsed);
  const serialized = serializeObjectiveSkills(
    objectiveSkillWrites(parsed.payload).map((row) => ({ ...row, name_ar: null, category: null })),
  );
  assert.equal(serialized.primary_skill_id, 'writing');
  assert.deepEqual(serialized.secondary_skill_ids, ['fine_motor', 'letter_formation', 'visual_motor_integration']);
});

test('the pincer-grip assignment from migration 0022 round-trips', () => {
  // Primary moved writing -> fine_motor. This is the mapping the audit found
  // wrong, so it is pinned by a test.
  const parsed = parseObjectiveSkills('fine_motor', ['hand_eye_coordination']);
  assert.ok('payload' in parsed);
  assert.equal(parsed.payload.primary, 'fine_motor');
  assert.notEqual(parsed.payload.primary, 'writing');
});
