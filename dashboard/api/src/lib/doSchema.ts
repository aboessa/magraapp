/**
 * Versioned, forward-only schema migration for Durable Objects.
 *
 * ## Why this exists
 *
 * Nineteen schema mutations across `FamilyState` and `IdentityState` were written
 * as `try { this.sql.exec('ALTER TABLE …') } catch {}`. That pattern has three
 * distinct problems, and they compound:
 *
 * 1. **A failed migration is indistinguishable from an already-applied one.**
 *    "duplicate column name" — expected on every instantiation after the first —
 *    and "no such table" or a disk error all land in the same empty catch. An
 *    object could be missing a column for the rest of its life and nothing would
 *    say so.
 * 2. **There is no version marker**, so no object can report what schema it is
 *    on, and divergence across instances cannot be detected. With one object per
 *    family, a single silently-failed step means one family's data is shaped
 *    differently from everyone else's.
 * 3. **The intent was idempotence, but the mechanism was suppression.** These
 *    steps run in a constructor on every instantiation, so they must be safe to
 *    re-enter — the answer is to *inspect* before mutating, not to discard the
 *    outcome.
 *
 * ## Design
 *
 * - `schema_version` holds one row: the version reached, plus the last failure if
 *   there was one.
 * - Steps are numbered, ordered, and run only when `version > current`.
 * - `addColumn` checks `pragma_table_info` first, so re-running is a no-op by
 *   inspection and any error the `ALTER` does raise is a genuine one.
 * - A failing step **stops the run**. Later steps may depend on it, so advancing
 *   past a failure would produce exactly the silent divergence this replaces. The
 *   failure is logged and recorded, and the object keeps serving on its old schema
 *   rather than throwing from its constructor and becoming unreachable.
 */

/// The minimal surface this module needs from a Durable Object's SQL storage.
export interface SqlStorage {
  exec(query: string, ...bindings: unknown[]): { toArray(): Record<string, unknown>[] }
}

export interface SchemaStep {
  /// Monotonic. Never renumber a released step: the number is what an existing
  /// object has recorded.
  version: number
  /// Short identifier for logs, e.g. `family.parent_pin_hash`.
  name: string
  /// Returns `applied` when it changed something, `already_present` when the
  /// desired state was already true. Throwing means a genuine failure.
  apply(sql: SqlStorage): 'applied' | 'already_present'
}

export interface SchemaState {
  version: number
  /// Steps applied during this run.
  applied: string[]
  /// Steps that were already satisfied.
  skipped: string[]
  /// Set when a step failed. The object continues on `version`.
  failure: { version: number; name: string; message: string } | null
}

const VERSION_TABLE = `
  CREATE TABLE IF NOT EXISTS schema_version (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL DEFAULT 0,
    failed_version INTEGER,
    failed_step TEXT,
    last_error TEXT,
    updated_at INTEGER NOT NULL DEFAULT 0
  )
`

/// Whether `table` already has `column`.
export function hasColumn(sql: SqlStorage, table: string, column: string): boolean {
  // `pragma_table_info` is queryable as a table-valued function, so this needs no
  // string parsing of a PRAGMA result. The table name cannot be bound as a
  // parameter, so every call site passes a literal — none of these come from a
  // request.
  const rows = sql.exec(
    `SELECT 1 AS present FROM pragma_table_info('${table}') WHERE name = ? LIMIT 1`,
    column,
  ).toArray()
  return rows.length > 0
}

function hasTable(sql: SqlStorage, table: string): boolean {
  return sql.exec(
    `SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1`,
    table,
  ).toArray().length > 0
}

/**
 * A step that adds one column.
 *
 * Replaces `try { ALTER } catch {}`. If the table does not exist the step reports
 * `already_present` rather than failing: the tables are created by
 * `CREATE TABLE IF NOT EXISTS` in the same constructor, so a missing table means
 * the feature that owns it is not present in this object, not that the migration
 * broke.
 */
export function addColumn(table: string, column: string, definition: string, version: number): SchemaStep {
  return {
    version,
    name: `${table}.${column}`,
    apply(sql) {
      if (!hasTable(sql, table)) return 'already_present'
      if (hasColumn(sql, table, column)) return 'already_present'
      sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
      return 'applied'
    },
  }
}

/// A step that runs arbitrary SQL once, guarded by the version marker alone.
export function statementStep(name: string, version: number, query: string): SchemaStep {
  return {
    version,
    name,
    apply(sql) {
      sql.exec(query)
      return 'applied'
    },
  }
}

function readVersion(sql: SqlStorage): number {
  const row = sql.exec('SELECT version FROM schema_version WHERE id = 1').toArray()[0]
  return row === undefined ? 0 : Number(row.version) || 0
}

/**
 * Runs every step newer than the recorded version.
 *
 * `label` names the object class in logs, so a failure can be attributed without
 * guessing which of the two objects raised it.
 */
export function applySchemaSteps(sql: SqlStorage, steps: SchemaStep[], label: string): SchemaState {
  sql.exec(VERSION_TABLE)
  sql.exec('INSERT OR IGNORE INTO schema_version (id, version, updated_at) VALUES (1, 0, 0)')

  const ordered = [...steps].sort((left, right) => left.version - right.version)
  // A duplicated version number would make "steps newer than current" ambiguous
  // and could skip one of the pair. Caught here rather than in review.
  const versions = new Set<number>()
  for (const step of ordered) {
    if (versions.has(step.version)) {
      throw new Error(`${label} schema has two steps at version ${step.version} (${step.name})`)
    }
    versions.add(step.version)
  }

  const current = readVersion(sql)
  const state: SchemaState = { version: current, applied: [], skipped: [], failure: null }

  for (const step of ordered) {
    if (step.version <= current) continue
    try {
      const outcome = step.apply(sql)
      if (outcome === 'applied') state.applied.push(step.name)
      else state.skipped.push(step.name)
      state.version = step.version
      sql.exec(
        'UPDATE schema_version SET version = ?, failed_version = NULL, failed_step = NULL,'
        + ' last_error = NULL, updated_at = ? WHERE id = 1',
        step.version, Date.now(),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Surfaced, not swallowed. This is the whole point of the change: an
      // operator can see that one object is behind and why.
      console.error('do_schema_step_failed', label, step.version, step.name, message)
      state.failure = { version: step.version, name: step.name, message }
      try {
        sql.exec(
          'UPDATE schema_version SET failed_version = ?, failed_step = ?, last_error = ?,'
          + ' updated_at = ? WHERE id = 1',
          step.version, step.name, message, Date.now(),
        )
      } catch {
        // The version table itself is unwritable. Nothing further can be recorded
        // here; the console line above is the remaining signal.
      }
      // Stop rather than continue: a later step may depend on this one, and
      // applying it anyway is how divergence becomes invisible.
      break
    }
  }

  return state
}

/// Reads the recorded state without running anything, for a status endpoint.
export function readSchemaState(sql: SqlStorage): {
  version: number
  failed_version: number | null
  failed_step: string | null
  last_error: string | null
} {
  sql.exec(VERSION_TABLE)
  const row = sql.exec(
    'SELECT version, failed_version, failed_step, last_error FROM schema_version WHERE id = 1',
  ).toArray()[0]
  return {
    version: row === undefined ? 0 : Number(row.version) || 0,
    failed_version: row?.failed_version === null || row?.failed_version === undefined
      ? null : Number(row.failed_version),
    failed_step: (row?.failed_step as string | null) ?? null,
    last_error: (row?.last_error as string | null) ?? null,
  }
}
