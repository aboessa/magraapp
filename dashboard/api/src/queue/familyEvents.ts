import type { FamilyEvent } from '../contracts/familyEvents.ts';
import { parseFamilyEvent } from '../contracts/familyEvents.ts';
import type { Env } from '../lib/db.ts';
import { isPlan } from '../lib/familyPolicy.ts';

function text(value: unknown, maximum = 200) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null;
}

function parentUpsert(env: Env, event: FamilyEvent) {
  return env.DB.prepare(`
    INSERT INTO family_projection (parent_id, status, plan, last_event_at_ms)
    SELECT ?, 'active', 'free', ?
    WHERE NOT EXISTS (
      SELECT 1 FROM family_deletion_watermarks WHERE parent_id = ?
    )
    ON CONFLICT(parent_id) DO UPDATE SET
      last_event_at_ms = MAX(family_projection.last_event_at_ms, excluded.last_event_at_ms),
      updated_at = datetime('now')
    WHERE NOT EXISTS (
      SELECT 1 FROM family_deletion_watermarks WHERE parent_id = excluded.parent_id
    )
  `).bind(event.parentId, event.occurredAt, event.parentId);
}

function eventStatements(env: Env, event: FamilyEvent): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [parentUpsert(env, event)];

  if (event.type === 'family.initialized') {
    const displayName = text(event.payload.displayName, 80);
    statements.push(env.DB.prepare(`
      INSERT INTO family_projection (
        parent_id, display_name, status, plan, created_at_ms, last_event_at_ms, identity_event_at_ms
      )
      SELECT ?, ?, 'active', 'free', ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM family_deletion_watermarks WHERE parent_id = ?
      )
      ON CONFLICT(parent_id) DO UPDATE SET
        display_name = excluded.display_name,
        status = excluded.status,
        created_at_ms = COALESCE(family_projection.created_at_ms, excluded.created_at_ms),
        last_event_at_ms = MAX(family_projection.last_event_at_ms, excluded.last_event_at_ms),
        identity_event_at_ms = excluded.identity_event_at_ms,
        updated_at = datetime('now')
      WHERE excluded.identity_event_at_ms >= family_projection.identity_event_at_ms
        AND NOT EXISTS (
          SELECT 1 FROM family_deletion_watermarks WHERE parent_id = excluded.parent_id
        )
    `).bind(
      event.parentId,
      displayName,
      event.occurredAt,
      event.occurredAt,
      event.occurredAt,
      event.parentId,
    ));
  }

  if (event.type === 'family.updated') {
    const displayName = event.payload.displayName === null ? null : text(event.payload.displayName, 80);
    statements.push(env.DB.prepare(`
      UPDATE family_projection
      SET display_name = ?,
          identity_event_at_ms = ?,
          last_event_at_ms = MAX(last_event_at_ms, ?),
          updated_at = datetime('now')
      WHERE parent_id = ? AND ? >= identity_event_at_ms
        AND NOT EXISTS (
          SELECT 1 FROM family_deletion_watermarks
          WHERE family_deletion_watermarks.parent_id = family_projection.parent_id
        )
    `).bind(displayName, event.occurredAt, event.occurredAt, event.parentId, event.occurredAt));
  }

  if (event.type === 'family.deletion_requested') {
    const requestId = text(event.payload.requestId);
    const scope = event.payload.scope === 'child' || event.payload.scope === 'account'
      ? event.payload.scope
      : null;
    const childId = scope === 'child' ? text(event.payload.childId) : null;
    if (!requestId || !scope || (scope === 'child' && !childId)) {
      throw new Error('invalid_family_deletion_requested_event');
    }
    statements.push(env.DB.prepare(`
      INSERT INTO account_lifecycle_projection (
        request_id, parent_id, scope, child_id, status, attempts, requested_at_ms
      ) VALUES (?, ?, ?, ?, 'pending', 0, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        status = CASE
          WHEN account_lifecycle_projection.status = 'completed' THEN 'completed'
          ELSE 'pending'
        END,
        updated_at = datetime('now')
    `).bind(requestId, event.parentId, scope, childId, event.occurredAt));
  }

  if (event.type === 'family.deleted') {
    const requestId = text(event.payload.requestId);
    if (!requestId) throw new Error('invalid_family_deleted_event');
    statements.push(env.DB.prepare(`
      INSERT INTO family_deletion_watermarks (parent_id, deleted_at_ms)
      VALUES (?, ?)
      ON CONFLICT(parent_id) DO UPDATE SET
        deleted_at_ms = MAX(family_deletion_watermarks.deleted_at_ms, excluded.deleted_at_ms),
        updated_at = datetime('now')
    `).bind(event.parentId, event.occurredAt));
    statements.push(env.DB.prepare(`
      INSERT INTO family_projection (
        parent_id, display_name, status, plan, created_at_ms, last_event_at_ms, identity_event_at_ms
      ) VALUES (?, NULL, 'archived', 'free', NULL, ?, ?)
      ON CONFLICT(parent_id) DO UPDATE SET
        display_name = NULL,
        status = 'archived',
        plan = 'free',
        last_event_at_ms = MAX(family_projection.last_event_at_ms, excluded.last_event_at_ms),
        identity_event_at_ms = MAX(family_projection.identity_event_at_ms, excluded.identity_event_at_ms),
        updated_at = datetime('now')
    `).bind(event.parentId, event.occurredAt, event.occurredAt));
    statements.push(env.DB.prepare(`
      UPDATE child_projection
      SET nickname = NULL, age_track = NULL, avatar_id = NULL, language = NULL,
          status = 'archived', last_event_at_ms = MAX(last_event_at_ms, ?),
          updated_at = datetime('now')
      WHERE parent_id = ?
    `).bind(event.occurredAt, event.parentId));
    statements.push(env.DB.prepare(`
      INSERT INTO account_lifecycle_projection (
        request_id, parent_id, scope, child_id, status, attempts,
        requested_at_ms, completed_at_ms
      ) VALUES (?, ?, 'account', NULL, 'completed', 0, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        status = 'completed', completed_at_ms = excluded.completed_at_ms,
        last_error_code = NULL, updated_at = datetime('now')
    `).bind(requestId, event.parentId, event.occurredAt, event.occurredAt));
  }

  if (event.type === 'child.created') {
    const childId = text(event.payload.childId);
    if (!childId) throw new Error('invalid_child_created_event');
    const ageTrack = event.payload.ageTrack === 'preschool' || event.payload.ageTrack === 'kids' || event.payload.ageTrack === 'junior'
      ? event.payload.ageTrack
      : null;
    statements.push(env.DB.prepare(`
      INSERT INTO child_projection (
        child_id, parent_id, nickname, age_track, avatar_id, language,
        status, created_at_ms, last_event_at_ms
      )
      SELECT ?, ?, ?, ?, ?, ?, 'active', ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM family_deletion_watermarks WHERE parent_id = ?
      ) AND NOT EXISTS (
        SELECT 1 FROM child_deletion_watermarks WHERE child_id = ?
      )
      ON CONFLICT(child_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        nickname = excluded.nickname,
        age_track = excluded.age_track,
        avatar_id = excluded.avatar_id,
        language = excluded.language,
        status = excluded.status,
        last_event_at_ms = MAX(child_projection.last_event_at_ms, excluded.last_event_at_ms),
        updated_at = datetime('now')
      WHERE excluded.last_event_at_ms >= child_projection.last_event_at_ms
        AND NOT EXISTS (
          SELECT 1 FROM family_deletion_watermarks WHERE parent_id = excluded.parent_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM child_deletion_watermarks WHERE child_id = excluded.child_id
        )
    `).bind(
      childId,
      event.parentId,
      text(event.payload.nickname, 40),
      ageTrack,
      text(event.payload.avatarId, 100),
      text(event.payload.language, 10),
      event.occurredAt,
      event.occurredAt,
      event.parentId,
      childId,
    ));
  }

  if (event.type === 'child.deleted') {
    const childId = text(event.payload.childId);
    const requestId = text(event.payload.requestId);
    if (!childId || !requestId) throw new Error('invalid_child_deleted_event');
    statements.push(env.DB.prepare(`
      INSERT INTO child_deletion_watermarks (child_id, parent_id, deleted_at_ms)
      VALUES (?, ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        deleted_at_ms = MAX(child_deletion_watermarks.deleted_at_ms, excluded.deleted_at_ms),
        updated_at = datetime('now')
    `).bind(childId, event.parentId, event.occurredAt));
    // UPSERT, not UPDATE: a tombstone must exist even when queue reordering
    // delivers deletion before creation.
    statements.push(env.DB.prepare(`
      INSERT INTO child_projection (
        child_id, parent_id, nickname, age_track, avatar_id, language,
        status, created_at_ms, last_event_at_ms
      ) VALUES (?, ?, NULL, NULL, NULL, NULL, 'archived', NULL, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        parent_id = excluded.parent_id,
        nickname = NULL,
        age_track = NULL,
        avatar_id = NULL,
        language = NULL,
        status = 'archived',
        last_event_at_ms = MAX(child_projection.last_event_at_ms, excluded.last_event_at_ms),
        updated_at = datetime('now')
    `).bind(childId, event.parentId, event.occurredAt));
    statements.push(env.DB.prepare(`
      INSERT INTO account_lifecycle_projection (
        request_id, parent_id, scope, child_id, status, attempts,
        requested_at_ms, completed_at_ms
      ) VALUES (?, ?, 'child', ?, 'completed', 0, ?, ?)
      ON CONFLICT(request_id) DO UPDATE SET
        status = 'completed', completed_at_ms = excluded.completed_at_ms,
        last_error_code = NULL, updated_at = datetime('now')
    `).bind(requestId, event.parentId, childId, event.occurredAt, event.occurredAt));
  }

  if (event.type === 'entitlement.updated') {
    const effectivePlan = isPlan(event.payload.effectivePlan) ? event.payload.effectivePlan : null;
    if (!effectivePlan) throw new Error('invalid_entitlement_event');
    statements.push(env.DB.prepare(`
      UPDATE family_projection
      SET plan = ?,
          plan_event_at_ms = ?,
          last_event_at_ms = MAX(last_event_at_ms, ?),
          updated_at = datetime('now')
      WHERE parent_id = ? AND ? >= plan_event_at_ms
        AND NOT EXISTS (
          SELECT 1 FROM family_deletion_watermarks
          WHERE family_deletion_watermarks.parent_id = family_projection.parent_id
        )
    `).bind(effectivePlan, event.occurredAt, event.occurredAt, event.parentId, event.occurredAt));
  }

  statements.push(env.DB.prepare(`
    INSERT OR IGNORE INTO processed_family_events (
      event_id, event_type, parent_id, occurred_at_ms
    ) VALUES (?, ?, ?, ?)
  `).bind(event.eventId, event.type, event.parentId, event.occurredAt));
  return statements;
}

export async function processFamilyEvent(env: Env, value: unknown) {
  const event = parseFamilyEvent(value);
  if (!event) return { accepted: false as const, reason: 'invalid_event' as const };

  const seen = await env.DB.prepare('SELECT 1 AS seen FROM processed_family_events WHERE event_id = ?')
    .bind(event.eventId).first();
  if (seen) return { accepted: true as const, eventId: event.eventId, duplicate: true as const };

  await env.DB.batch(eventStatements(env, event));
  return { accepted: true as const, eventId: event.eventId, duplicate: false as const };
}

export async function handleFamilyEvents(batch: MessageBatch<unknown>, env: Env) {
  for (const message of batch.messages) {
    try {
      const result = await processFamilyEvent(env, message.body);
      if (!result.accepted) {
        console.warn('family_event_rejected', result.reason);
      }
      message.ack();
    } catch (error) {
      console.error('family_event_processing_failed', error instanceof Error ? error.message : String(error));
      message.retry();
    }
  }
}
