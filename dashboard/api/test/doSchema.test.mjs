import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

import {
  addColumn,
  applySchemaSteps,
  hasColumn,
  readSchemaState,
  statementStep,
} from '../src/lib/doSchema.ts';
import { FAMILY_SCHEMA_STEPS, FAMILY_SCHEMA_VERSION } from '../src/do/FamilyState.ts';
import { IDENTITY_SCHEMA_STEPS, IDENTITY_SCHEMA_VERSION } from '../src/do/IdentityState.ts';

/// Durable Object schema versioning (SEC-008).
///
/// ## The defect these tests pin
///
/// Nineteen schema mutations were written as `try { ALTER … } catch {}`. That made
/// three different outcomes identical: the column was added, the column already
/// existed, or the statement genuinely failed. There was no version marker, so no
/// object could report its schema and divergence between instances was
/// undetectable — and with one `FamilyState` per family, a single silent failure
/// means one family's data is shaped differently from everyone else's.

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/**
 * A minimal SQLite double.
 *
 * Only the statements this module issues are understood, and anything else throws
 * — a permissive double would let a broken migration look like a working one,
 * which is the defect under test.
 */
function fakeSql({ tables = {} } = {}) {
  const columns = new Map(Object.entries(tables).map(([name, list]) => [name, [...list]]));
  const versionRow = { version: 0, failed_version: null, failed_step: null, last_error: null };
  let versionTableExists = false;
  const log = [];

  return {
    exec(query, ...bindings) {
      const text = query.replace(/\s+/g, ' ').trim();
      log.push(text);

      if (text.startsWith('CREATE TABLE IF NOT EXISTS schema_version')) {
        versionTableExists = true;
        return { toArray: () => [] };
      }
      if (text.startsWith('INSERT OR IGNORE INTO schema_version')) {
        return { toArray: () => [] };
      }
      if (text.startsWith('SELECT version FROM schema_version')) {
        return { toArray: () => (versionTableExists ? [{ version: versionRow.version }] : []) };
      }
      if (text.startsWith('SELECT version, failed_version, failed_step, last_error FROM schema_version')) {
        return { toArray: () => [{ ...versionRow }] };
      }
      if (text.startsWith('UPDATE schema_version SET version = ?')) {
        versionRow.version = bindings[0];
        versionRow.failed_version = null;
        versionRow.failed_step = null;
        versionRow.last_error = null;
        return { toArray: () => [] };
      }
      if (text.startsWith('UPDATE schema_version SET failed_version = ?')) {
        versionRow.failed_version = bindings[0];
        versionRow.failed_step = bindings[1];
        versionRow.last_error = bindings[2];
        return { toArray: () => [] };
      }
      if (text.startsWith("SELECT 1 AS present FROM sqlite_master")) {
        return { toArray: () => (columns.has(bindings[0]) ? [{ present: 1 }] : []) };
      }
      const pragma = text.match(/^SELECT 1 AS present FROM pragma_table_info\('(\w+)'\)/);
      if (pragma) {
        const list = columns.get(pragma[1]) ?? [];
        return { toArray: () => (list.includes(bindings[0]) ? [{ present: 1 }] : []) };
      }
      const alter = text.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/);
      if (alter) {
        const [, table, column] = alter;
        const list = columns.get(table);
        if (!list) throw new Error(`no such table: ${table}`);
        // Real SQLite refuses a duplicate. The double must too, or the test would
        // not notice a migration that re-adds a column.
        if (list.includes(column)) throw new Error(`duplicate column name: ${column}`);
        list.push(column);
        return { toArray: () => [] };
      }
      if (text.startsWith('SELECT explode')) throw new Error('deliberate failure');

      throw new Error(`fakeSql received an unsupported statement: ${text.slice(0, 90)}`);
    },
    _columns: columns,
    _log: log,
    _versionRow: versionRow,
  };
}

/* ------------------------------------------------------------- fresh objects */

test('a fresh object applies every step and records the final version', () => {
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  const state = applySchemaSteps(sql, [
    addColumn('family', 'one', 'TEXT', 1),
    addColumn('family', 'two', 'INTEGER NOT NULL DEFAULT 0', 2),
  ], 'Test');

  assert.deepEqual(state.applied, ['family.one', 'family.two']);
  assert.equal(state.failure, null);
  assert.equal(state.version, 2);
  assert.deepEqual(sql._columns.get('family'), ['parent_id', 'one', 'two']);
  assert.equal(readSchemaState(sql).version, 2);
});

test('re-running changes nothing and re-applies nothing', () => {
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  const steps = [addColumn('family', 'one', 'TEXT', 1)];
  applySchemaSteps(sql, steps, 'Test');
  const second = applySchemaSteps(sql, steps, 'Test');

  // The version gate short-circuits, so the ALTER is not even attempted — which is
  // what makes "already applied" and "failed" distinguishable now.
  assert.deepEqual(second.applied, []);
  assert.deepEqual(second.skipped, []);
  assert.equal(second.version, 1);
});

/* ---------------------------------------------------------- upgraded objects */

test('an object that already has the columns converges without failing', () => {
  // This is the pre-versioning population: the ALTERs ran under the old code, so
  // the columns exist while the version row says 0. Under `try/catch` every step
  // would raise "duplicate column name" and the errors would be discarded; here
  // inspection reports them as already present.
  const sql = fakeSql({ tables: { family: ['parent_id', 'one', 'two'] } });
  const state = applySchemaSteps(sql, [
    addColumn('family', 'one', 'TEXT', 1),
    addColumn('family', 'two', 'INTEGER', 2),
  ], 'Test');

  assert.deepEqual(state.applied, []);
  assert.deepEqual(state.skipped, ['family.one', 'family.two']);
  assert.equal(state.failure, null);
  assert.equal(state.version, 2, 'the version must still advance');
});

test('fresh and upgraded objects reach the same schema and the same version', () => {
  const steps = [
    addColumn('family', 'one', 'TEXT', 1),
    addColumn('family', 'two', 'INTEGER', 2),
    addColumn('family', 'three', 'TEXT', 3),
  ];
  const fresh = fakeSql({ tables: { family: ['parent_id'] } });
  const partial = fakeSql({ tables: { family: ['parent_id', 'one'] } });

  const freshState = applySchemaSteps(fresh, steps, 'Test');
  const partialState = applySchemaSteps(partial, steps, 'Test');

  assert.deepEqual(
    [...fresh._columns.get('family')].sort(),
    [...partial._columns.get('family')].sort(),
  );
  assert.equal(freshState.version, partialState.version);
  assert.equal(freshState.failure, null);
  assert.equal(partialState.failure, null);
  // The half-migrated object applied only what it was missing.
  assert.deepEqual(partialState.applied, ['family.two', 'family.three']);
  assert.deepEqual(partialState.skipped, ['family.one']);
});

test('a step whose table does not exist is skipped, not failed', () => {
  // The tables are created by `CREATE TABLE IF NOT EXISTS` in the same
  // constructor, so a missing table means the feature is absent from this object,
  // not that the migration broke.
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  const state = applySchemaSteps(sql, [addColumn('nonexistent', 'x', 'TEXT', 1)], 'Test');
  assert.equal(state.failure, null);
  assert.deepEqual(state.skipped, ['nonexistent.x']);
});

/* ------------------------------------------------------- failures are visible */

test('a deliberately failing step is reported, recorded, and stops the run', () => {
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  let state;
  try {
    state = applySchemaSteps(sql, [
      addColumn('family', 'one', 'TEXT', 1),
      statementStep('family.explode', 2, 'SELECT explode'),
      addColumn('family', 'three', 'TEXT', 3),
    ], 'Test');
  } finally {
    console.error = original;
  }

  // Visible in logs, with enough detail to act on.
  assert.ok(errors.some((line) => line.includes('do_schema_step_failed')
    && line.includes('Test') && line.includes('family.explode')), errors.join('\n'));
  // Visible in the object's own state.
  assert.equal(state.failure.version, 2);
  assert.equal(state.failure.name, 'family.explode');
  assert.match(state.failure.message, /deliberate failure/);
  assert.equal(readSchemaState(sql).failed_step, 'family.explode');
  assert.equal(readSchemaState(sql).failed_version, 2);
  // The version stays at the last success, so the failure is not papered over.
  assert.equal(state.version, 1);
  // And step 3 did not run: a later step may depend on the failed one, and
  // applying it anyway is how divergence becomes invisible.
  assert.equal(sql._columns.get('family').includes('three'), false);
  assert.deepEqual(state.applied, ['family.one']);
});

test('a resolved failure clears the recorded error on the next run', () => {
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  const original = console.error;
  console.error = () => {};
  try {
    applySchemaSteps(sql, [statementStep('family.explode', 1, 'SELECT explode')], 'Test');
    assert.equal(readSchemaState(sql).failed_step, 'family.explode');
    // The operator fixes the step; the next instantiation succeeds.
    applySchemaSteps(sql, [addColumn('family', 'one', 'TEXT', 1)], 'Test');
  } finally {
    console.error = original;
  }
  assert.equal(readSchemaState(sql).failed_step, null);
  assert.equal(readSchemaState(sql).version, 1);
});

test('duplicate version numbers are refused outright', () => {
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  // Two steps at the same version make "newer than current" ambiguous and would
  // silently skip one of the pair on an upgraded object.
  assert.throws(
    () => applySchemaSteps(sql, [
      addColumn('family', 'one', 'TEXT', 1),
      addColumn('family', 'two', 'TEXT', 1),
    ], 'Test'),
    /two steps at version 1/,
  );
});

test('steps run in version order regardless of declaration order', () => {
  const sql = fakeSql({ tables: { family: ['parent_id'] } });
  const state = applySchemaSteps(sql, [
    addColumn('family', 'third', 'TEXT', 3),
    addColumn('family', 'first', 'TEXT', 1),
    addColumn('family', 'second', 'TEXT', 2),
  ], 'Test');
  assert.deepEqual(state.applied, ['family.first', 'family.second', 'family.third']);
});

test('column inspection is exact', () => {
  const sql = fakeSql({ tables: { family: ['parent_id', 'parent_pin_hash'] } });
  assert.equal(hasColumn(sql, 'family', 'parent_pin_hash'), true);
  assert.equal(hasColumn(sql, 'family', 'parent_pin'), false, 'a prefix must not match');
  assert.equal(hasColumn(sql, 'family', 'PARENT_PIN_HASH'), false, 'the check is case-exact');
});

/* ------------------------------------------------- the two real object schemas */

test('both objects declare contiguous, uniquely numbered steps', () => {
  for (const [label, steps, expected] of [
    ['FamilyState', FAMILY_SCHEMA_STEPS, FAMILY_SCHEMA_VERSION],
    ['IdentityState', IDENTITY_SCHEMA_STEPS, IDENTITY_SCHEMA_VERSION],
  ]) {
    const versions = steps.map((step) => step.version);
    assert.deepEqual(
      versions, [...versions].sort((a, b) => a - b),
      `${label} steps must be declared in order`,
    );
    assert.equal(new Set(versions).size, versions.length, `${label} has a duplicate version`);
    // Contiguous from 1: a gap would suggest a step was deleted, which breaks the
    // forward-only guarantee for objects that stopped at the removed number.
    assert.deepEqual(
      versions, versions.map((_, index) => index + 1),
      `${label} versions must run 1..n with no gaps`,
    );
    assert.equal(expected, versions.length);
    for (const step of steps) {
      assert.match(step.name, /^\w+\.\w+$/, `${label} step name "${step.name}" is not table.column`);
    }
  }
});

test('the twelve family and seven identity mutations are all accounted for', () => {
  // The audit counted nineteen bare ALTERs across the two objects. All nineteen are
  // now numbered steps, so none was quietly dropped in the conversion.
  assert.equal(FAMILY_SCHEMA_STEPS.length, 12);
  assert.equal(IDENTITY_SCHEMA_STEPS.length, 7);
  assert.equal(FAMILY_SCHEMA_STEPS.length + IDENTITY_SCHEMA_STEPS.length, 19);

  for (const [label, steps, expected] of [
    ['FamilyState', FAMILY_SCHEMA_STEPS, [
      'family.parent_pin_hash', 'family.parent_pin_failed_count', 'family.parent_pin_locked_until',
      'family.parent_pin_version', 'family.deleted_at', 'family.profile_intent_version',
      'family.profile_applied_version', 'lifecycle_jobs.processing_started_at',
      'lifecycle_jobs.receipt_hash', 'profile_sync_jobs.intent_version',
      'attempts.game_id', 'attempts.content_type',
    ]],
    ['IdentityState', IDENTITY_SCHEMA_STEPS, [
      'identity.status', 'identity.deletion_request_id', 'identity.deleted_at',
      'identity.profile_version', 'password_reset_tokens.pending_password_hash',
      'password_reset_tokens.claimed_at', 'password_reset_tokens.completed_at',
    ]],
  ]) {
    assert.deepEqual(steps.map((step) => step.name), expected, label);
  }
});

test('no bare try/ALTER/catch survives in any Durable Object', () => {
  for (const file of ['src/do/FamilyState.ts', 'src/do/IdentityState.ts', 'src/do/StoryCollab.ts', 'src/do/RateLimiter.ts']) {
    const source = read(file);
    assert.equal(
      /try \{ this\.sql\.exec\(`ALTER/.test(source), false,
      `${file} still applies a schema change through a discarded outcome`,
    );
  }
});

test('each object reports its schema version over its own fetch interface', () => {
  // "Each DO reports its schema version" is the acceptance criterion; without an
  // endpoint the version row would be as invisible as the errors were.
  assert.match(read('src/do/FamilyState.ts'), /'GET \/schema'/);
  assert.match(read('src/do/FamilyState.ts'), /expected_version: FAMILY_SCHEMA_VERSION/);
  const identity = read('src/do/IdentityState.ts');
  assert.match(identity, /path === '\/schema'/);
  assert.match(identity, /expected_version: IDENTITY_SCHEMA_VERSION/);
  // The identity object must not allocate storage just to answer a probe.
  assert.match(identity, /this\.schemaExists\(\)\s*\n?\s*\?/);
  assert.match(identity, /provisioned: false/);
});
