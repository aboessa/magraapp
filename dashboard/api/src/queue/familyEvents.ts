import type { FamilyEvent } from '../contracts/familyEvents';
import { parseFamilyEvent } from '../contracts/familyEvents';
import type { Env } from '../lib/db';
import { isPlan } from '../lib/familyPolicy';

function text(value: unknown, maximum = 200) {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum ? value : null;
}

function parentUpsert(env: Env, event: FamilyEvent) {
  return env.DB.prepare(`
    INSERT INTO family_projection (parent_id, status, plan, last_event_at_ms)
    VALUES (?, 'active', 'free', ?)
    ON CONFLICT(parent_id) DO UPDATE SET
      last_event_at_ms = MAX(family_projection.last_event_at_ms, excluded.last_event_at_ms),
      updated_at = datetime('now')
  `).bind(event.parentId, event.occurredAt);
}

function eventStatements(env: Env, event: FamilyEvent): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [parentUpsert(env, event)];

  if (event.type === 'family.initialized') {
    const displayName = text(event.payload.displayName, 80);
    statements.push(env.DB.prepare(`
      INSERT INTO family_projection (
        parent_id, display_name, status, plan, created_at_ms, last_event_at_ms, identity_event_at_ms
      ) VALUES (?, ?, 'active', 'free', ?, ?, ?)
      ON CONFLICT(parent_id) DO UPDATE SET
        display_name = excluded.display_name,
        status = excluded.status,
        created_at_ms = COALESCE(family_projection.created_at_ms, excluded.created_at_ms),
        last_event_at_ms = MAX(family_projection.last_event_at_ms, excluded.last_event_at_ms),
        identity_event_at_ms = excluded.identity_event_at_ms,
        updated_at = datetime('now')
      WHERE excluded.identity_event_at_ms >= family_projection.identity_event_at_ms
    `).bind(event.parentId, displayName, event.occurredAt, event.occurredAt, event.occurredAt));
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
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(child_id) DO UPDATE SET
        parent_id = CASE WHEN excluded.last_event_at_ms >= child_projection.last_event_at_ms THEN excluded.parent_id ELSE child_projection.parent_id END,
        nickname = CASE WHEN excluded.last_event_at_ms >= child_projection.last_event_at_ms THEN excluded.nickname ELSE child_projection.nickname END,
        age_track = CASE WHEN excluded.last_event_at_ms >= child_projection.last_event_at_ms THEN excluded.age_track ELSE child_projection.age_track END,
        avatar_id = CASE WHEN excluded.last_event_at_ms >= child_projection.last_event_at_ms THEN excluded.avatar_id ELSE child_projection.avatar_id END,
        language = CASE WHEN excluded.last_event_at_ms >= child_projection.last_event_at_ms THEN excluded.language ELSE child_projection.language END,
        status = CASE WHEN excluded.last_event_at_ms >= child_projection.last_event_at_ms THEN excluded.status ELSE child_projection.status END,
        last_event_at_ms = MAX(child_projection.last_event_at_ms, excluded.last_event_at_ms),
        updated_at = datetime('now')
    `).bind(
      childId,
      event.parentId,
      text(event.payload.nickname, 40),
      ageTrack,
      text(event.payload.avatarId, 100),
      text(event.payload.language, 10),
      event.occurredAt,
      event.occurredAt,
    ));
  }

  if (event.type === 'entitlement.updated') {
    const effectivePlan = isPlan(event.payload.effectivePlan) ? event.payload.effectivePlan : null;
    if (!effectivePlan) throw new Error('invalid_entitlement_event');
    // Guarded by the dedicated plan watermark so unrelated event types can never
    // block a paid plan from being projected.
    statements.push(env.DB.prepare(`
      UPDATE family_projection
      SET plan = ?,
          plan_event_at_ms = ?,
          last_event_at_ms = MAX(last_event_at_ms, ?),
          updated_at = datetime('now')
      WHERE parent_id = ? AND ? >= plan_event_at_ms
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

  // The outbox delivers at least once, so a replayed event must not be applied
  // twice even where a projection statement is not naturally idempotent.
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
