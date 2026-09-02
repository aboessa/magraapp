import type { FamilyEvent } from '../contracts/familyEvents.ts';
import { parseFamilyEvent } from '../contracts/familyEvents.ts';
import type { Env } from '../lib/db.ts';
import { familyAuditStatement } from '../lib/familyAudit.ts';
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

  // API-105: تعديل ملف الطفل وانتقال مساره العمري.
  //
  // كان النوعان يُصدَران ويُدقَّقان **ولا يصلان إلى الإسقاط إطلاقًا**: تغييرُ اسمٍ
  // مستعار أو انتقالُ طفل من `kids` إلى `junior` لا يظهر في `child_projection`،
  // فتبقى اللوحة تعرض الاسم القديم والمسار القديم إلى الأبد.
  //
  // `COALESCE` لا إسناد مباشر: `child.updated` جزئيّ بطبيعته — يحمل ما تغيّر
  // وحده — فإسنادُ `NULL` لما لم يُرسَل كان سيمحو حقلًا لم يُطلَب تعديله.
  if (event.type === 'child.updated' || event.type === 'child.track_transitioned') {
    const childId = text(event.payload.childId);
    if (!childId) throw new Error('invalid_child_update_event');
    const ageTrack = event.payload.ageTrack === 'preschool'
      || event.payload.ageTrack === 'kids'
      || event.payload.ageTrack === 'junior'
      ? event.payload.ageTrack
      : null;
    statements.push(env.DB.prepare(`
      UPDATE child_projection
         SET nickname = COALESCE(?, nickname),
             age_track = COALESCE(?, age_track),
             avatar_id = COALESCE(?, avatar_id),
             language = COALESCE(?, language),
             last_event_at_ms = MAX(last_event_at_ms, ?),
             updated_at = datetime('now')
       WHERE child_id = ? AND ? >= last_event_at_ms
         AND NOT EXISTS (
           SELECT 1 FROM child_deletion_watermarks WHERE child_id = child_projection.child_id
         )
    `).bind(
      text(event.payload.nickname, 40),
      ageTrack,
      text(event.payload.avatarId, 100),
      text(event.payload.language, 10),
      event.occurredAt,
      childId,
      event.occurredAt,
    ));
  }

  // API-105: إسقاط التقدّم.
  //
  // الحدث يحمل كل ما يلزم أصلًا (`FamilyState.updateProgress`)، وكان يُستهلَك
  // ويُرمى: يُفكّ، ويُعَدّ في `processed_family_events`، ولا يُكتب في جدول.
  //
  // ومعرّف الحدث هو `event_id` الذي أرسله العميل — نفسه مفتاح عدم التكرار في
  // الكائن — فالتكرار مُستبعَد من طرفٍ إلى طرف بلا عمل إضافي هنا.
  if (event.type === 'progress.updated' || event.type === 'content.completed') {
    const childId = text(event.payload.childId);
    const contentId = text(event.payload.contentId);
    const contentType = text(event.payload.contentType, 32);
    if (!childId || !contentId || !contentType) throw new Error('invalid_progress_event');
    const completed = event.type === 'content.completed' || event.payload.completed === true;
    const positionMs = Number(event.payload.positionMs ?? 0);
    const durationMs = Number(event.payload.durationMs ?? 0);

    statements.push(env.DB.prepare(`
      INSERT INTO child_progress_projection (
        child_id, content_type, content_id, parent_id, position_ms, duration_ms,
        completed, completions, first_seen_at_ms, completed_at_ms, last_event_at_ms
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM child_deletion_watermarks WHERE child_id = ?
      ) AND NOT EXISTS (
        SELECT 1 FROM family_deletion_watermarks WHERE parent_id = ?
      )
      ON CONFLICT(child_id, content_type, content_id) DO UPDATE SET
        position_ms = excluded.position_ms,
        -- المدّة تُثبَّت بالأكبر: نبضةٌ مبكّرة قد تعلن مدّة صفرًا قبل أن يقرأ
        -- المشغّل الملف كاملًا، وقبولها كان سيمحو مدّة صحيحة.
        duration_ms = MAX(child_progress_projection.duration_ms, excluded.duration_ms),
        -- والإكمال لا يُنزَع: من أكمل حلقةً ثم أعاد مشاهدتها من أوّلها أكملها.
        completed = MAX(child_progress_projection.completed, excluded.completed),
        completions = child_progress_projection.completions + excluded.completions,
        completed_at_ms = COALESCE(child_progress_projection.completed_at_ms, excluded.completed_at_ms),
        last_event_at_ms = MAX(child_progress_projection.last_event_at_ms, excluded.last_event_at_ms),
        updated_at = datetime('now')
      -- حدثٌ أقدم من المُسجَّل يُهمَل: الطابور لا يضمن ترتيبًا، ونبضةٌ متأخّرة
      -- كانت سترجع الموضع إلى الوراء فيبدأ الطفل من حيث كان قبل دقيقة.
      WHERE excluded.last_event_at_ms >= child_progress_projection.last_event_at_ms
    `).bind(
      childId,
      contentType,
      contentId,
      event.parentId,
      Number.isFinite(positionMs) ? Math.max(0, Math.floor(positionMs)) : 0,
      Number.isFinite(durationMs) ? Math.max(0, Math.floor(durationMs)) : 0,
      completed ? 1 : 0,
      completed ? 1 : 0,
      event.occurredAt,
      completed ? event.occurredAt : null,
      event.occurredAt,
      childId,
      event.parentId,
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

  // ENC-001: إسقاط تراخيص الاستخدام دون إنترنت.
  if (event.type === 'offline_license.issued' || event.type === 'offline_license.renewed') {
    const licenseId = text(event.payload.licenseId);
    const childId = text(event.payload.childId);
    const deviceId = text(event.payload.deviceId);
    if (!licenseId || !childId || !deviceId) throw new Error('invalid_offline_license_event');
    const renewed = event.type === 'offline_license.renewed';
    statements.push(env.DB.prepare(`
      INSERT INTO media_licenses (
        id, parent_id, child_id, device_id, device_auth_epoch, entity_type, content_id,
        content_version, rights, required_plan, status, signature_key_id, renewed_from,
        issued_at_ms, expires_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'offline_playback', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        expires_at_ms = excluded.expires_at_ms,
        updated_at = datetime('now')
      WHERE media_licenses.status NOT IN ('revoked', 'superseded', 'expired')
    `).bind(
      licenseId,
      event.parentId,
      childId,
      deviceId,
      Number(event.payload.authEpoch ?? 0),
      text(event.payload.entityType) ?? 'unknown',
      text(event.payload.entityId) ?? 'unknown',
      Number(event.payload.contentVersion ?? 1),
      text(event.payload.requiredPlan) ?? 'family',
      // الترخيص المُجدَّد يصل نشطًا: التجديد يجري على محتوى مُنزَّل أصلًا.
      renewed ? 'active' : 'pending',
      text(event.payload.signatureKeyId),
      renewed ? text(event.payload.renewedFrom) : null,
      event.occurredAt,
      Number(event.payload.expiresAt ?? event.occurredAt),
    ));
    if (renewed) {
      const previous = text(event.payload.renewedFrom);
      if (previous) {
        statements.push(env.DB.prepare(`
          UPDATE media_licenses SET status = 'superseded', updated_at = datetime('now')
           WHERE id = ? AND status NOT IN ('revoked')
        `).bind(previous));
      }
    }
  }

  if (event.type === 'offline_license.completed') {
    const licenseId = text(event.payload.licenseId);
    if (!licenseId) throw new Error('invalid_offline_license_event');
    statements.push(env.DB.prepare(`
      UPDATE media_licenses
         SET status = 'active', completed_at_ms = ?, updated_at = datetime('now')
       WHERE id = ? AND status = 'pending'
    `).bind(event.occurredAt, licenseId));
    // ما نُزِّل فعلًا يُسجَّل عند الاكتمال لا عند الإصدار: صفٌّ لكل أصل قبل
    // اكتمال التنزيل كان سيقول إن الملف موجود على الجهاز وهو ليس كذلك.
    const assets = Array.isArray(event.payload.assets) ? event.payload.assets : [];
    for (const entry of assets) {
      const asset = entry as Record<string, unknown>;
      const assetId = text(asset.assetId ?? asset.asset_id);
      if (!assetId) continue;
      statements.push(env.DB.prepare(`
        INSERT OR IGNORE INTO child_downloads (
          license_id, asset_id, parent_id, child_id, device_id, entity_type,
          content_id, content_version, byte_size, source_sha256, created_at_ms
        )
        SELECT ?, ?, l.parent_id, l.child_id, l.device_id, l.entity_type,
               l.content_id, l.content_version, ?, ?, ?
          FROM media_licenses l WHERE l.id = ?
      `).bind(
        licenseId,
        assetId,
        typeof asset.byteSize === 'number' ? asset.byteSize : null,
        text(asset.sourceSha256 ?? asset.source_sha256),
        event.occurredAt,
        licenseId,
      ));
    }
  }

  if (event.type === 'offline_license.revoked') {
    const ids = Array.isArray(event.payload.licenseIds) ? event.payload.licenseIds : [];
    for (const value of ids) {
      const licenseId = text(value);
      if (!licenseId) continue;
      statements.push(env.DB.prepare(`
        UPDATE media_licenses
           SET status = 'revoked', revoked_at_ms = ?, updated_at = datetime('now')
         WHERE id = ? AND status IN ('pending', 'active', 'expired')
      `).bind(event.occurredAt, licenseId));
    }
  }

  // سجل الأحداث: append-only لكل ما يخصّ التنزيل، بما فيه أمر المسؤول.
  if (event.type.startsWith('offline_license.') || event.type === 'downloads.revoked') {
    statements.push(env.DB.prepare(`
      INSERT OR IGNORE INTO download_events (
        id, license_id, parent_id, child_id, device_id, event_type, detail, occurred_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      event.eventId,
      text(event.payload.licenseId),
      event.parentId,
      text(event.payload.childId),
      text(event.payload.deviceId),
      event.type,
      JSON.stringify(event.payload),
      event.occurredAt,
    ));
  }

  // PRIV-102: أثر التدقيق يُكتب في نفس الدفعة التي تطبّق الإسقاط، فلا تنجح
  // واحدة وتفشل الأخرى. `lib/familyAudit.ts` يقرّر ما يُدقَّق وما لا يُدقَّق،
  // ويعود `null` للأحداث السلوكية عالية الحجم.
  const audit = familyAuditStatement(env.DB, event);
  if (audit) statements.push(audit);

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
