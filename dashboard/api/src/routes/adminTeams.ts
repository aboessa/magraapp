import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { pathParam } from '../lib/routeParams.ts'
import { queryAll, queryFirst } from '../lib/db'
import { auditActor, requireAdmin, requirePermission } from '../lib/adminAuth'
import { actorId, auditStatement } from '../lib/auditLog'
import { parsePagination, UNBOUNDED_LIST_PAGINATION } from '../lib/catalogueValidation'
import { checkSelfApproval, SELF_APPROVAL_ERROR } from '../lib/separationOfDuties'
import type { AdminSessionUser } from '../lib/adminUsers'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }
const route = new Hono<AppEnv>()

/// Ø­Ø±Ø³ ØµØ±ÙŠØ­ Ù„Ø§ Ø¶Ù…Ù†ÙŠ.
///
/// ÙƒØ§Ù† Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù Ø¨Ù„Ø§ `use()` Ø¥Ø·Ù„Ø§Ù‚Ù‹Ø§ØŒ ÙØ­Ù…Ø§ÙŠØªÙ‡ ØªØ¹ØªÙ…Ø¯ Ø¹Ù„Ù‰ Ø£Ù† ÙˆØ³ÙŠØ· adminRoute
/// Ø§Ù„Ù…Ø±ÙƒÙ‘Ø¨ Ø¹Ù„Ù‰ `/api/v1/admin/*` ÙŠØªÙ‘Ø³Ø¹ Ù„ÙŠØ·Ø§Ø¨Ù‚ Ù…Ø³Ø§Ø±Ø§ØªÙ‡ØŒ ÙˆØ¹Ù„Ù‰ ØªØ±ØªÙŠØ¨ Ø§Ù„ØªØ±ÙƒÙŠØ¨ ÙÙŠ
/// admin.ts. Ø§Ù„Ù…Ø³Ø§Ø±Ø§Øª Ù‡Ù†Ø§ ØªÙ…Ù†Ø­ Ø§Ù„Ø£Ø¯ÙˆØ§Ø± ÙˆØªØ¹ØªÙ…Ø¯ Ø®Ø·ÙˆØ§Øª Ø³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„ØŒ Ø£ÙŠ Ø£Ù†Ù‡Ø§ Ø£Ø®Ø·Ø±
/// Ù…Ø§ ÙÙŠ Ø§Ù„Ù„ÙˆØ­Ø©: Ù…Ù† ÙŠØµÙ„ Ø¥Ù„Ù‰ `POST /grants` ÙŠÙ…Ù†Ø­ Ù†ÙØ³Ù‡ Ø§Ù„Ù…Ù„ÙƒÙŠØ©.
route.use('*', requireAdmin)

/**
 * ## Ø§Ù„Ø«ØºØ±Ø© Ø§Ù„ØªÙŠ ÙŠØ³Ø¯Ù‘Ù‡Ø§ ÙØ­Øµ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ© ÙÙŠ Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù
 *
 * `requireAdmin` ÙŠØ¬ÙŠØ¨ Ø¹Ù† Â«Ù‡Ù„ Ù‡Ø°Ø§ Ù…ÙˆØ¸Ù Ù…ÙØµØ§Ø¯ÙŽÙ‚ØŸÂ» ÙˆÙ„Ø§ ÙŠØ¬ÙŠØ¨ Ø¹Ù† Â«Ù‡Ù„ ÙŠÙ…Ù„Ùƒ Ø­Ù‚ Ù‡Ø°Ø§
 * Ø§Ù„ÙØ¹Ù„ØŸÂ». ÙˆÙƒØ§Ù† Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù Ø¨Ù„Ø§ `requirePermission` Ø¹Ù„Ù‰ Ø£ÙŠ Ù…Ø³Ø§Ø± Ù…Ù† Ù…Ø³Ø§Ø±Ø§ØªÙ‡
 * Ø§Ù„Ø§Ø«Ù†ÙŠ Ø¹Ø´Ø±ØŒ ÙÙƒØ§Ù† Ø£ÙŠ Ø­Ø³Ø§Ø¨ Ù„ÙˆØ­Ø© â€” Ø¨Ø£ÙŠ Ø¯ÙˆØ±ØŒ Ø­ØªÙ‰ `viewer` â€” ÙŠØ³ØªØ·ÙŠØ¹ Ù†Ø¯Ø§Ø¡
 * `POST /grants` ÙˆÙŠÙ…Ù†Ø­ Ù†ÙØ³Ù‡ Ø¯ÙˆØ± `owner`. Ø§Ù„ØªØ¹Ù„ÙŠÙ‚ Ø£Ø¹Ù„Ø§Ù‡ ÙƒØ§Ù† ÙŠØµÙ Ø§Ù„Ø®Ø·Ø± Ø¨Ø¯Ù‚Ù‘Ø©
 * Ù„ÙƒÙ† Ø§Ù„Ø­Ø±Ø³ Ø§Ù„Ù…ÙƒØªÙˆØ¨ Ù„Ù… ÙŠÙƒÙ† ÙŠÙ…Ù†Ø¹Ù‡.
 *
 * `manage_permissions` Ù…Ù‚ØµÙˆØ±Ø© Ø¹Ù„Ù‰ owner Ùˆ system_admin (Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0019 ØªØ³ØªØ«Ù†ÙŠ
 * `planet_manager` Ù…Ù†Ù‡Ø§ ØµØ±Ø§Ø­Ø©Ù‹)ØŒ ÙÙ…Ù†Ø­ Ø§Ù„Ø£Ø¯ÙˆØ§Ø± ØµØ§Ø± Ø­ÙƒØ±Ù‹Ø§ Ø¹Ù„ÙŠÙ‡Ù…Ø§.
 */

// Teams
route.get('/teams', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const total = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM teams')
  const rows = await queryAll(c.env.DB, `
    SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id) as members_count
      FROM teams t
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?
  `, [limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.post('/teams', requirePermission('manage_team'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.name_ar) return c.json({ success: false, error: 'name_ar required' }, 400)
  const id = body.id || `team-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO teams (id, name_ar, description_ar, planet_id, section) VALUES (?,?,?,?,?)`).bind(id, body.name_ar, body.description_ar || null, body.planet_id || null, body.section || null).run()
  if (Array.isArray(body.member_ids)) {
    for (const uid of body.member_ids) {
      await c.env.DB.prepare(`INSERT OR IGNORE INTO team_members (team_id, user_id) VALUES (?,?)`).bind(id, uid).run()
    }
  }
  return c.json({ success: true, data: { id } }, 201)
})

route.get('/teams/:id', async (c) => {
  const team = await queryFirst(c.env.DB, `SELECT * FROM teams WHERE id=?`, [pathParam(c, 'id')])
  if (!team) return c.json({ success: false, error: 'Team not found' }, 404)
  const members = await queryAll(c.env.DB, `SELECT u.id, u.display_name, u.email FROM team_members tm JOIN admin_users u ON u.id=tm.user_id WHERE tm.team_id=?`, [pathParam(c, 'id')])
  return c.json({ success: true, data: { ...team, members } })
})

/**
 * Ø§Ù„Ø£Ø¯ÙˆØ§Ø± Ù…Ø¹ ØµÙ„Ø§Ø­ÙŠØ§Øª ÙƒÙ„ Ø¯ÙˆØ±.
 *
 * ÙƒØ§Ù† ÙŠÙØ¹ÙŠØ¯ `permissions_count` ÙÙ‚Ø·ØŒ ÙÙ„Ù… ØªØ³ØªØ·Ø¹ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø¨Ù†Ø§Ø¡ Ù…ØµÙÙˆÙØ© Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª
 * Ù…Ù† Ø¨ÙŠØ§Ù†Ø§Øª Ø­Ù‚ÙŠÙ‚ÙŠØ© â€” ÙˆÙ„Ù‡Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ù…ØµÙÙˆÙØ© ÙÙŠ RolesPage Ù…ÙƒØªÙˆØ¨Ø© Ø«Ø§Ø¨ØªØ© ÙÙŠ Ø§Ù„ÙƒÙˆØ¯
 * Ø¨Ù„Ø§ ØµÙ„Ø© Ø¨Ù€role_permissions. Ø§Ù„Ø¢Ù† ØªÙØ¹Ø§Ø¯ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…Ø¹Ø±Ù‘ÙØ§Øª ÙØªÙØ¨Ù†Ù‰ Ø§Ù„Ù…ØµÙÙˆÙØ© Ù…Ù†
 * Ø§Ù„Ø­Ù‚ÙŠÙ‚Ø©.
 *
 * GROUP_CONCAT Ø£Ø±Ø®Øµ Ù…Ù† Ø§Ø³ØªØ¹Ù„Ø§Ù… Ø«Ø§Ù†Ù Ù„ÙƒÙ„ Ø¯ÙˆØ±: ØµÙÙŒ ÙˆØ§Ø­Ø¯ Ù„ÙƒÙ„ Ø¯ÙˆØ± Ø¨Ø¯Ù„ N+1.
 */
route.get('/roles', async (c) => {
  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT r.*,
           (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS permissions_count,
           (SELECT GROUP_CONCAT(rp.permission_id) FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_ids
      FROM roles r
     ORDER BY r.name_ar
  `)
  return c.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      permissions: typeof row.permission_ids === 'string' && row.permission_ids
        ? row.permission_ids.split(',')
        : [],
    })),
  })
})

// Permissions
//
// Ø¨Ù„Ø§ ØªØ±Ù‚ÙŠÙ… Ø¹Ù† Ù‚ØµØ¯: Ø§Ù„ØµÙÙˆÙ Ù…Ø¨Ø°ÙˆØ±Ø© ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0014 ÙˆØ¹Ø¯Ø¯Ù‡Ø§ 22ØŒ ÙˆÙ„Ø§ Ù…Ø³Ø§Ø± ÙŠÙÙ†Ø´Ø¦
// ØµÙ„Ø§Ø­ÙŠØ© Ø¬Ø¯ÙŠØ¯Ø©. Ù‚Ø§Ø¦Ù…Ø© Ù…ØºÙ„Ù‚Ø© Ø§Ù„Ø­Ø¬Ù… Ù„Ø§ ØªØ­ØªØ§Ø¬ Ø­Ø¯Ù‹Ù‘Ø§ØŒ ÙˆØ¥Ø¶Ø§ÙØ© ÙˆØ§Ø­Ø¯ ØªØ¹Ù†ÙŠ Ø­Ø¯Ù‹Ù‘Ø§ ÙˆÙ‡Ù…ÙŠÙ‹Ù‘Ø§
// ÙŠÙˆØ­ÙŠ Ø¨Ø£Ù† Ø§Ù„Ø¬Ø¯ÙˆÙ„ ÙŠÙ†Ù…Ùˆ.
route.get('/permissions', async (c) => {
  const rows = await queryAll(c.env.DB, `SELECT * FROM permissions ORDER BY action`)
  return c.json({ success: true, data: rows })
})

// Access Grants - 4 layers
//
// Ø§Ù„Ù‚Ø±Ø§Ø¡Ø© Ù†ÙØ³Ù‡Ø§ ØªØªØ·Ù„Ù‘Ø¨ manage_permissions Ù„Ø§ 'view': Ø®Ø±ÙŠØ·Ø© Â«Ù…Ù† ÙŠÙ…Ù„Ùƒ Ù…Ø§Ø°Ø§Â» Ù‡ÙŠ
// Ø®Ø±ÙŠØ·Ø© Ø§Ù„Ù‡Ø¬ÙˆÙ… Ø¹Ù„Ù‰ Ø§Ù„Ù…Ù†ØµÙ‘Ø©. Ù…Ù† Ù„Ø§ ÙŠÙ…Ù„Ùƒ Ø­Ù‚ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª Ù„Ø§ Ø­Ø§Ø¬Ø© Ù„Ù‡ Ø¨Ù…Ø¹Ø±ÙØ©
// Ø£ÙŠ Ø­Ø³Ø§Ø¨ ÙŠØ­Ù…Ù„ Ø¯ÙˆØ± Ø§Ù„Ù…Ø§Ù„Ùƒ.
route.get('/grants', requirePermission('manage_permissions'), async (c) => {
  // ÙƒØ§Ù† `LIMIT 100` Ù…Ø«Ø¨ÙŽÙ‘ØªÙ‹Ø§ ÙÙŠ Ø§Ù„ÙƒÙˆØ¯ Ø¨Ù„Ø§ offsetØŒ ÙØ§Ù„Ù…Ù†Ø­ Ø±Ù‚Ù… 101 Ù„Ø§ Ø³Ø¨ÙŠÙ„ Ù„Ø±Ø¤ÙŠØªÙ‡
  // Ø¥Ø·Ù„Ø§Ù‚Ù‹Ø§ â€” Ù„Ø§ Ø¨Ø²ÙŠØ§Ø¯Ø© Ø§Ù„Ø­Ø¯Ù‘ ÙˆÙ„Ø§ Ø¨Ø§Ù„ØªØµÙÙ‘Ø­.
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const total = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM access_grants')
  const rows = await queryAll(c.env.DB, `
    SELECT ag.*, r.name_ar as role_name
      FROM access_grants ag
      LEFT JOIN roles r ON r.id=ag.role_id
     ORDER BY ag.created_at DESC
     LIMIT ? OFFSET ?
  `, [limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

route.post('/grants', requirePermission('manage_permissions'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  if (!body?.grantee_id || !body?.role_id) return c.json({ success: false, error: 'grantee_id and role_id required' }, 400)
  const id = `grant-${Date.now()}`
  await c.env.DB.prepare(`INSERT INTO access_grants (id, grantee_type, grantee_id, role_id, scope_type, scope_id, content_type, language, valid_until, granted_by) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(
    // granted_by ÙƒØ§Ù† Ø§Ù„Ù†Øµ Ø§Ù„Ø­Ø±ÙÙŠ 'admin-api-key'ØŒ ÙˆÙ‡Ùˆ Ù„ÙŠØ³ Ù…Ø¹Ø±Ù‘ÙÙ‹Ø§ ØµØ§Ù„Ø­Ù‹Ø§ ÙÙŠ
    // admin_users. Ø§Ù„Ù…ÙØªØ§Ø­ Ø§Ù„Ø£Ø¬Ù†Ø¨ÙŠ Ù„Ù… ÙŠÙ…Ù†Ø¹Ù‡ Ù„Ø£Ù† D1 Ù„Ø§ ÙŠÙØ±Ø¶ Ø§Ù„Ù‚ÙŠÙˆØ¯ Ø¨Ù„Ø§
    // PRAGMA foreign_keys Ù„ÙƒÙ„ Ø§ØªØµØ§Ù„ØŒ ÙÙƒØ§Ù† Ø³Ø¬Ù„ Â«Ù…Ù† Ù…Ù†Ø­ Ù‡Ø°Ù‡ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ©Â» Ø¨Ù„Ø§ Ù‚ÙŠÙ…Ø©.
    // Ø§Ù„Ø¢Ù† Ù‡ÙˆÙŠØ© Ø§Ù„Ø¬Ù„Ø³Ø© Ø§Ù„Ù…ÙØµØ§Ø¯ÙŽÙ‚Ø©.
    id, body.grantee_type || 'user', body.grantee_id, body.role_id, body.scope_type || 'platform', body.scope_id || null, body.content_type || null, body.language || null, body.valid_until || null, auditActor(c)
  ).run()
  return c.json({ success: true, data: { id } }, 201)
})

route.delete('/grants/:id', requirePermission('manage_permissions'), async (c) => {
  await c.env.DB.prepare(`DELETE FROM access_grants WHERE id=?`).bind(pathParam(c, 'id')).run()
  return c.json({ success: true, data: { deleted: true } })
})

// Workflow
route.get('/workflows/runs', async (c) => {
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const total = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM workflow_runs')
  const rows = await queryAll(c.env.DB, `
    SELECT wr.*, (SELECT COUNT(*) FROM workflow_step_reviews wsr WHERE wsr.run_id=wr.id) as reviews_count
      FROM workflow_runs wr
     ORDER BY wr.updated_at DESC
     LIMIT ? OFFSET ?
  `, [limit, offset])
  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

/**
 * ÙŠØ³Ø¬Ù‘Ù„ Ù‚Ø±Ø§Ø± Ù…Ø±Ø§Ø¬Ø¹Ø© Ø¹Ù„Ù‰ Ø®Ø·ÙˆØ© Ø³ÙŠØ± Ø¹Ù…Ù„.
 *
 * ## Ø«Ù„Ø§Ø« Ø¹Ù„Ù„ ÙƒØ§Ù†Øª Ù‡Ù†Ø§
 *
 * Ù¡. **`reviewer_id` Ù…Ù† Ø¬Ø³Ù… Ø§Ù„Ø·Ù„Ø¨.** ÙƒØ§Ù† `body.reviewer_id || 'admin'`ØŒ ÙØ§Ù„Ù…Ø±Ø§Ø¬Ø¹
 *    ÙŠÙ†Ø³Ø¨ Ù‚Ø±Ø§Ø±Ù‡ Ù„Ø£ÙŠ Ø´Ø®ØµØŒ ÙˆØ§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ© `'admin'` Ù„ÙŠØ³Øª Ù…Ø¹Ø±Ù‘ÙÙ‹Ø§ ÙÙŠ
 *    admin_users Ø£ØµÙ„Ù‹Ø§. Ø³Ø¬Ù„ Â«Ù…Ù† Ø§Ø¹ØªÙ…Ø¯ Ù‡Ø°Ø§Â» ÙƒØ§Ù† Ø¨Ù„Ø§ Ù‚ÙŠÙ…Ø©. Ø§Ù„Ø¢Ù† Ù…Ù† Ø§Ù„Ø¬Ù„Ø³Ø©
 *    Ø§Ù„Ù…ÙØµØ§Ø¯ÙŽÙ‚Ø© Ø¹Ø¨Ø± `actorId(c)`ØŒ ØªÙ…Ø§Ù…Ù‹Ø§ ÙƒÙ…Ø§ ÙÙŠ adminCatalogue.ts.
 *
 * Ù¢. **Ø¨Ù„Ø§ ÙØ­Øµ ØµÙ„Ø§Ø­ÙŠØ©.** Ø£ÙŠ Ø­Ø³Ø§Ø¨ Ù…ÙØµØ§Ø¯ÙŽÙ‚ ÙƒØ§Ù† ÙŠØ¹ØªÙ…Ø¯ Ø£ÙŠ Ø¹Ù…Ù„. Ø§Ù„Ø¢Ù† `approve`ØŒ
 *    ÙˆÙ‡ÙŠ Ù…Ù‚ØµÙˆØ±Ø© Ø¹Ù„Ù‰ reviewer Ùˆ content_manager Ùˆ owner Ùˆ system_admin.
 *
 * Ù£. **Ø¨Ù„Ø§ ÙØµÙ„ Ø¨ÙŠÙ† Ø§Ù„Ø¥Ù†Ø´Ø§Ø¡ ÙˆØ§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯.** `lib/separationOfDuties.ts` ÙƒØ§Ù† Ù…ÙˆØ¬ÙˆØ¯Ù‹Ø§
 *    ÙˆÙ…Ø³ØªØ®Ø¯Ù…Ù‹Ø§ ÙÙŠ adminCatalogue.ts ÙˆØ­Ø¯Ù‡ØŒ ÙÙƒØ§Ù† Ø§Ù„Ù…Ø³Ø§Ø± Ù‡Ø°Ø§ Ø¨Ø§Ø¨Ù‹Ø§ Ø®Ù„ÙÙŠÙ‹Ø§ ÙŠØªØ¬Ø§ÙˆØ²
 *    Ø§Ù„Ù‚Ø§Ø¹Ø¯Ø© Ù†ÙØ³Ù‡Ø§: Ù…Ù† ÙŠÙÙ†Ø´Ø¦ Ù…Ø­ØªÙˆÙ‰ ÙŠØ¹ØªÙ…Ø¯Ù‡ Ù…Ù† Ù‡Ù†Ø§. Ø§Ù„ÙØ­Øµ ÙŠØ¬Ø±ÙŠ Ø¹Ù„Ù‰
 *    `content_type/content_id` Ù„Ù„ØªØ´ØºÙŠÙ„Ø© Ù„Ø§ Ø¹Ù„Ù‰ Ù…Ø¹Ø±Ù‘Ù Ø§Ù„ØªØ´ØºÙŠÙ„Ø©ØŒ Ù„Ø£Ù† Ø³Ø¬Ù„ Ø§Ù„ØªØ£Ù„ÙŠÙ
 *    ÙÙŠ audit_logs Ù…Ø±Ø¨ÙˆØ· Ø¨Ø§Ù„Ù…Ø­ØªÙˆÙ‰.
 *
 * Ø§Ù„Ø±ÙØ¶ ÙˆØ§Ù„ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ Ù„Ø§ ÙŠØ®Ø¶Ø¹Ø§Ù† Ù„Ù„ÙØµÙ„: Ø§Ù„Ù‚Ø§Ø¹Ø¯Ø© ØªØ­Ù…ÙŠ Ù…Ù† Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø°Ø§ØªÙŠ Ù„Ø§
 * Ù…Ù† Ù†Ù‚Ø¯ Ø§Ù„Ø°Ø§ØªØŒ ÙˆÙ‡Ùˆ Ù…Ø§ ÙŠÙ‚Ø±Ù‘Ø±Ù‡ `isApproval` ÙÙŠ ØªÙ„Ùƒ Ø§Ù„ÙˆØ­Ø¯Ø©.
 */
route.post('/workflows/runs/:id/review', requirePermission('approve'), async (c) => {
  const body = await c.req.json().catch(() => null) as any
  const decision = body?.decision
  if (!['approved', 'rejected', 'changes_requested'].includes(decision)) return c.json({ success: false, error: 'Invalid decision' }, 400)
  const runId = pathParam(c, 'id')

  // Ø§Ù„ØªØ´ØºÙŠÙ„Ø© ØªÙÙ‚Ø±Ø£ Ø£ÙˆÙ„Ù‹Ø§: Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯ Ø¹Ù„Ù‰ ØªØ´ØºÙŠÙ„Ø© ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯Ø© ÙƒØ§Ù† ÙŠÙØ¯Ø±Ø¬ ØµÙÙ‹Ø§ ÙŠØªÙŠÙ…Ù‹Ø§
  // ÙˆÙŠÙØ¹ÙŠØ¯ Ù†Ø¬Ø§Ø­Ù‹Ø§ØŒ Ù„Ø£Ù† D1 Ù„Ø§ ÙŠÙØ±Ø¶ Ø§Ù„Ù…ÙØ§ØªÙŠØ­ Ø§Ù„Ø£Ø¬Ù†Ø¨ÙŠØ© Ø¨Ù„Ø§ PRAGMA Ù„ÙƒÙ„ Ø§ØªØµØ§Ù„.
  const run = await queryFirst<{ content_type: string; content_id: string; current_step: string; status: string }>(
    c.env.DB,
    `SELECT content_type, content_id, current_step, status FROM workflow_runs WHERE id=?`,
    [runId],
  )
  if (!run) return c.json({ success: false, error: 'Workflow run not found' }, 404)
  if (run.status !== 'running') return c.json({ success: false, error: 'Workflow run is not accepting review records' }, 409)

  const reviewerId = actorId(c)
  const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''
  if (comment.length > 2_000) return c.json({ success: false, error: 'Comment must be 2000 characters or fewer' }, 400)

  if (decision === 'approved') {
    const separation = await checkSelfApproval(c.env.DB, {
      entityType: run.content_type,
      entityId: run.content_id,
      approverId: reviewerId,
    })
    if (!separation.ok) {
      return c.json({ success: false, error: SELF_APPROVAL_ERROR }, 409)
    }
  }

  const id = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO workflow_step_reviews (id, run_id, step, reviewer_id, decision, comment) VALUES (?,?,?,?,?,?)`)
      .bind(id, runId, run.current_step, reviewerId, decision, comment || null),
    auditStatement(c.env.DB, reviewerId, 'review', 'workflow_run', runId, {
      review_id: id,
      decision,
      step: run.current_step,
      has_comment: Boolean(comment),
    }),
  ])
  return c.json({ success: true, data: { id } })
})

// Tasks - My tasks
route.get('/tasks', async (c) => {
  const assignee = c.req.query('assignee_id')
  const status = c.req.query('status')
  let sql = `SELECT t.*, s.title_ar as series_title FROM tasks t LEFT JOIN series s ON s.id=t.content_id ORDER BY t.created_at DESC`
  const params: unknown[] = []
  const clauses: string[] = []
  if (assignee) { clauses.push('t.assignee_id=?'); params.push(assignee) }
  if (status) { clauses.push('t.status=?'); params.push(status) }
  if (clauses.length) sql = `SELECT t.*, s.title_ar as series_title FROM tasks t LEFT JOIN series s ON s.id=t.content_id WHERE ${clauses.join(' AND ')} ORDER BY t.created_at DESC`
  const rows = await queryAll(c.env.DB, sql, params)
  return c.json({ success: true, data: rows })
})

/// Ø³Ø¬Ù„ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚ Ù„Ù‡ ØµÙ„Ø§Ø­ÙŠØªÙ‡ Ø§Ù„Ø®Ø§ØµØ© `view_audit_log` ÙÙŠ Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0014ØŒ ÙˆÙ„Ù… ØªÙƒÙ†
/// Ù…Ø³ØªØ®Ø¯Ù…Ø© ÙÙŠ Ø£ÙŠ Ù…ÙƒØ§Ù†. Ø§Ù„Ø³Ø¬Ù„ ÙŠÙƒØ´Ù Ù…Ù† ÙØ¹Ù„ Ù…Ø§Ø°Ø§ ÙˆÙ…ØªÙ‰ØŒ ÙˆÙ‡Ùˆ Ø§Ø³ØªØ·Ù„Ø§Ø¹ Ø¬Ø§Ù‡Ø² Ù„Ù…Ù† ÙŠØ±ÙŠØ¯
/// Ù…Ø¹Ø±ÙØ© Ø£Ù†Ø´Ø· Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª ÙˆØ£Ø¹Ù„Ø§Ù‡Ø§ ØµÙ„Ø§Ø­ÙŠØ©.
// `from`/`to` تصفّي على `created_at` نفسه، لا على تاريخ محسوب في الواجهة.
// created_at نصّ ISO-8601 UTC (datetime('now') في SQLite)، فالمقارنة النصية
// >=/<= تطابق ترتيبًا زمنيًا صحيحًا طالما الصيغة ثابتة. قيمة غير صالحة تُرفض
// بـ400 بدل أن تصمت وتُعيد نتيجة غير مصفّاة: فلترة تاريخ صامتة الفشل أخطر من
// غياب الفلتر، لأن المسؤول يظن النتيجة مصفّاة وهي ليست.
route.get('/audit-logs', requirePermission('view_audit_log'), async (c) => {
  // كان `LIMIT 50` مثبَّتًا بلا offset، فالسجل الحادي والخمسون لا سبيل لرؤيته.
  // وسجل التدقيق هو أسرع الجداول نموًّا: صفٌّ لكل تعديل في اللوحة.
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const actor = c.req.query('actor_id')?.trim()
  const entityType = c.req.query('entity_type')?.trim()
  // `entity_id` أُضيف ليتمكّن مساحةُ عمل كيان واحد من عرض سجلّه وحده. بلا هذا
  // الفلتر كان على الواجهة جلب الصفحات ثم التصفية محليًا، فتُعرض «لا سجلّ» على
  // كيان له سجلّ خارج أول خمسين صفًّا — وهو أسوأ من غياب القسم.
  const entityId = c.req.query('entity_id')?.trim()
  const action = c.req.query('action')?.trim()
  const from = c.req.query('from')?.trim()
  const to = c.req.query('to')?.trim()

  // ISO 8601: تاريخ فقط أو تاريخ+وقت. لا نص حرّ يدخل مباشرة في مقارنة SQL.
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/
  if (from && !isoDatePattern.test(from)) return c.json({ success: false, error: 'from must be an ISO 8601 date' }, 400)
  if (to && !isoDatePattern.test(to)) return c.json({ success: false, error: 'to must be an ISO 8601 date' }, 400)
  if (from && to && from > to) return c.json({ success: false, error: 'from must not be after to' }, 400)

  const clauses: string[] = []
  const params: unknown[] = []
  if (actor) { clauses.push('actor_id = ?'); params.push(actor) }
  if (entityType) { clauses.push('entity_type = ?'); params.push(entityType) }
  if (entityId) { clauses.push('entity_id = ?'); params.push(entityId) }
  if (action) { clauses.push('action = ?'); params.push(action) }
  // "from" بلا وقت يعني بداية اليوم، و"to" بلا وقت يعني نهايته — لا منتصف
  // الليل فقط، وإلا يُستبعَد اليوم كله المطلوب تضمينه.
  if (from) { clauses.push('created_at >= ?'); params.push(from.length === 10 ? `${from} 00:00:00` : from) }
  if (to) { clauses.push('created_at <= ?'); params.push(to.length === 10 ? `${to} 23:59:59` : to) }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''

  const total = await queryFirst<{ total: number }>(
    c.env.DB, `SELECT COUNT(*) AS total FROM audit_logs ${where}`, params,
  )
  const rows = await queryAll(c.env.DB, `
    SELECT id, actor_id, action, entity_type, entity_id, details, created_at
      FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?
  `, [...params, limit, offset])

  return c.json({ success: true, data: rows, meta: { total: Number(total?.total ?? 0), limit, offset } })
})

export default route
