import { Hono } from 'hono'
import type { Env } from '../lib/db'
import { queryAll, queryFirst } from '../lib/db'
import {
  hasPermission,
  normalizeEmail,
  revokeAllSessions,
  setPassword,
  validatePassword,
  type AdminSessionUser,
} from '../lib/adminUsers'
import { requireAdmin } from '../lib/adminAuth'
import { auditStatement } from '../lib/auditLog'
import { parsePagination, UNBOUNDED_LIST_PAGINATION } from '../lib/catalogueValidation'

type AppEnv = { Bindings: Env; Variables: { adminUser?: AdminSessionUser; adminIsLegacyKey?: boolean } }

const adminUsersRoute = new Hono<AppEnv>()

adminUsersRoute.use('*', requireAdmin)

/**
 * Ø¥Ø¯Ø§Ø±Ø© Ù…Ø³ØªØ®Ø¯Ù…ÙŠ Ø§Ù„Ù„ÙˆØ­Ø©: Ø¥Ù†Ø´Ø§Ø¡ Ù…ÙˆØ¸ÙØŒ Ù…Ù†Ø­Ù‡ Ø¯ÙˆØ±Ù‹Ø§ØŒ ØªØ¹Ø·ÙŠÙ„Ù‡.
 *
 * ## Ø§Ù„Ø«ØºØ±Ø© Ø§Ù„ØªÙŠ ÙŠØ³Ø¯Ù‘Ù‡Ø§ Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù
 *
 * Ø¬Ø¯ÙˆÙ„ admin_users Ù…ÙˆØ¬ÙˆØ¯ Ù…Ù† Ø§Ù„Ù…Ù‡Ø§Ø¬Ø±Ø© 0014ØŒ ÙˆÙƒÙ„ Ø¬Ø¯ÙˆÙ„ ÙÙŠ Ù†Ø¸Ø§Ù… Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ§Øª ÙŠØ´ÙŠØ±
 * Ø¥Ù„ÙŠÙ‡: team_members.user_id Ùˆ tasks.assignee_id Ùˆ comments.author_id
 * Ùˆ access_grants.grantee_id. Ù„ÙƒÙ† **Ù„Ù… ÙŠÙƒÙ† Ù‡Ù†Ø§Ùƒ Ø£ÙŠ Ù…Ø³Ø§Ø± ÙŠÙÙ†Ø´Ø¦ ØµÙÙ‹Ø§ ÙÙŠÙ‡**ØŒ
 * ÙÙƒØ§Ù†Øª ØªÙ„Ùƒ Ø§Ù„Ù…ÙØ§ØªÙŠØ­ Ø§Ù„Ø£Ø¬Ù†Ø¨ÙŠØ© ØºÙŠØ± Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ø¥Ø±Ø¶Ø§Ø¡ØŒ ÙˆÙƒØ§Ù† POST /teams ÙŠÙØ¯Ø±Ø¬
 * Ø£Ø¹Ø¶Ø§Ø¡Ù‹ Ù„Ø§ ÙˆØ¬ÙˆØ¯ Ù„Ù‡Ù….
 *
 * ## Ù…Ù† ÙŠØ³ØªØ·ÙŠØ¹ Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†
 *
 * ØµÙ„Ø§Ø­ÙŠØ© manage_permissions ÙÙ‚Ø·ØŒ ÙˆÙ‡ÙŠ Ù…Ø±Ø¨ÙˆØ·Ø© Ø¨Ù€owner Ùˆ system_admin. Ø§Ù„Ø£Ø¯ÙˆØ§Ø±
 * Ø§Ù„Ø£Ø®Ø±Ù‰ ØªØ±Ø§Ù‡Ø§ ÙˆÙ„Ø§ ØªØ¹Ø¯Ù‘Ù„Ù‡Ø§. Ø§Ù„Ù…ÙØªØ§Ø­ Ø§Ù„Ù…Ø´ØªØ±Ùƒ ÙŠÙÙ‚Ø¨Ù„ ÙƒÙ…Ø®Ø±Ø¬ Ø·Ø§Ø±Ø¦ Ù„ÙŠØªÙ…ÙƒÙ‘Ù† Ø£ÙˆÙ„
 * Ù…Ø³Ø¤ÙˆÙ„ Ù…Ù† Ø¨Ø°Ø± Ù†ÙØ³Ù‡ØŒ ÙˆÙŠÙØ³Ø¬ÙŽÙ‘Ù„ Ø°Ù„Ùƒ ÙÙŠ Ø§Ù„ØªØ¯Ù‚ÙŠÙ‚.
 */

/// Ø­Ø±Ø³ ØµÙ„Ø§Ø­ÙŠØ©: ÙŠØ³Ù…Ø­ Ù„Ù„Ù…ÙØªØ§Ø­ Ø§Ù„Ù…Ø´ØªØ±Ùƒ Ø¨Ø§Ù„Ù…Ø±ÙˆØ± Ù„Ø£Ù†Ù‡ Ù„Ø§ ÙŠØ­Ù…Ù„ Ù‡ÙˆÙŠØ© Ø¨Ø¹Ø¯.
function canManage(c: { get: (key: 'adminUser' | 'adminIsLegacyKey') => unknown }) {
  const user = c.get('adminUser') as AdminSessionUser | undefined
  // Ø§Ù„Ù…Ø®Ø±Ø¬ Ø§Ù„Ø·Ø§Ø±Ø¦: Ø¨Ù„Ø§ Ù…Ø³ØªØ®Ø¯Ù… Ù…ÙØµØ§Ø¯ÙŽÙ‚ Ù„Ø§ Ø³Ø¨ÙŠÙ„ Ù„Ø¨Ø°Ø± Ø£ÙˆÙ„ Ø­Ø³Ø§Ø¨
  if (!user) return true
  return hasPermission(user, 'manage_permissions')
}

function actorId(c: { get: (key: 'adminUser') => unknown }) {
  const user = c.get('adminUser') as AdminSessionUser | undefined
  // لا تُقبل هوية من ترويسة يكتبها المتصل؛ في وضع break-glass فقط يكون
  // الفاعل غير منسوب إلى مستخدم، فيسجل باسم ثابت وواضح.
  return user?.id ?? 'legacy-admin-key'
}

function audit(db: D1Database, actor: string, action: string, entityId: string, details: unknown) {
  return auditStatement(db, actor, action, 'admin_user', entityId, details)
}

type UserListRow = {
  id: string
  email: string
  display_name: string
  is_active: number
  is_external: number
  created_at: string
  has_password: number
  last_login_at: string | null
  locked_until: string | null
  roles: string | null
}

adminUsersRoute.get('/users', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  // ÙƒØ§Ù†Øª Ø¨Ù„Ø§ Ø­Ø¯Ù‘ Ø¥Ø·Ù„Ø§Ù‚Ù‹Ø§. Ø§Ù„Ø­Ø¯Ù‘ Ø³Ø®ÙŠÙ‘ Ù„Ø£Ù† Ø®ÙØ¶Ù‡ Ø¥Ù„Ù‰ 20 ÙŠÙØ®ÙÙŠ Ù…ÙˆØ¸ÙÙŠÙ† ØªØ¹Ø±Ø¶Ù‡Ù… Ø§Ù„Ù„ÙˆØ­Ø©
  // Ø§Ù„ÙŠÙˆÙ…ØŒ Ùˆ`meta.total` ÙŠØ¬Ø¹Ù„ Ø§Ù„Ø¹Ø¯Ø¯ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ Ù…Ø¹Ø±ÙˆÙÙ‹Ø§.
  const { limit, offset } = parsePagination(c.req.query('limit'), c.req.query('offset'), UNBOUNDED_LIST_PAGINATION)
  const total = await queryFirst<{ total: number }>(c.env.DB, 'SELECT COUNT(*) AS total FROM admin_users')
  const rows = await queryAll<UserListRow>(c.env.DB, `
    SELECT u.id, u.email, u.display_name, u.is_active, u.is_external, u.created_at,
           CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END AS has_password,
           c.last_login_at, c.locked_until,
           (SELECT GROUP_CONCAT(DISTINCT ag.role_id)
              FROM access_grants ag
             WHERE ag.grantee_type = 'user' AND ag.grantee_id = u.id
               AND (ag.valid_until IS NULL OR ag.valid_until > datetime('now'))) AS roles
      FROM admin_users u
      LEFT JOIN admin_credentials c ON c.user_id = u.id
     ORDER BY u.created_at ASC
     LIMIT ? OFFSET ?
  `, [limit, offset])

  return c.json({
    success: true,
    data: rows.map((row) => ({
      ...row,
      is_active: Number(row.is_active) === 1,
      is_external: Number(row.is_external) === 1,
      has_password: Number(row.has_password) === 1,
      roles: row.roles ? row.roles.split(',') : [],
    })),
    meta: { total: Number(total?.total ?? 0), limit, offset },
  })
})

/**
 * ÙŠÙ†Ø´Ø¦ Ù…Ø³ØªØ®Ø¯Ù…Ù‹Ø§ ÙˆÙŠØ¶Ø¨Ø· ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ±Ù‡ Ø§Ù„Ø£ÙˆÙ„Ù‰ ÙˆØ¯ÙˆØ±Ù‡.
 *
 * ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØªÙØ¶Ø¨Ø· Ø¨Ù€must_change_passwordØŒ ÙØ§Ù„Ù…Ø³Ø¤ÙˆÙ„ Ø§Ù„Ø°ÙŠ Ø£Ù†Ø´Ø£ Ø§Ù„Ø­Ø³Ø§Ø¨ ÙŠØ¹Ø±Ù
 * Ø§Ù„ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø¤Ù‚ØªØ© ÙˆÙŠØ¬Ø¨ Ø£Ù† ØªÙ†ØªÙ‡ÙŠ ØµÙ„Ø§Ø­ÙŠØªÙ‡Ø§ Ø¹Ù†Ø¯ Ø£ÙˆÙ„ Ø¯Ø®ÙˆÙ„ Ù„ØµØ§Ø­Ø¨Ù‡Ø§.
 */
adminUsersRoute.post('/users', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'ØµÙŠØºØ© Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± ØµØ§Ù„Ø­Ø©' }, 400)

  const email = normalizeEmail(body.email)
  if (!email) return c.json({ success: false, error: 'Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ ØºÙŠØ± ØµØ§Ù„Ø­' }, 400)

  const displayName = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 120) : ''
  if (!displayName) return c.json({ success: false, error: 'Ø§Ù„Ø§Ø³Ù… Ù…Ø·Ù„ÙˆØ¨' }, 400)

  const password = typeof body.password === 'string' ? body.password : ''
  const weak = validatePassword(password)
  if (weak) return c.json({ success: false, error: weak }, 400)

  const roleId = typeof body.role_id === 'string' ? body.role_id.trim() : ''
  if (!roleId) return c.json({ success: false, error: 'Ø§Ù„Ø¯ÙˆØ± Ù…Ø·Ù„ÙˆØ¨' }, 400)
  const role = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM roles WHERE id = ?', [roleId])
  if (!role) return c.json({ success: false, error: 'Ø¯ÙˆØ± ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ' }, 400)

  const existing = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE email = ?', [email])
  if (existing) return c.json({ success: false, error: 'Ù‡Ø°Ø§ Ø§Ù„Ø¨Ø±ÙŠØ¯ Ù…Ø³ØªØ®Ø¯Ù… Ø¨Ø§Ù„ÙØ¹Ù„' }, 409)

  const id = crypto.randomUUID()
  const actor = actorId(c)

  await c.env.DB.prepare(`
    INSERT INTO admin_users (id, email, display_name, is_active, is_external)
    VALUES (?, ?, ?, 1, ?)
  `).bind(id, email, displayName, body.is_external ? 1 : 0).run()

  // ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ÙÙŠ Ø¹Ù…Ù„ÙŠØ© Ù…Ù†ÙØµÙ„Ø© Ù„Ø£Ù†Ù‡Ø§ ØºÙŠØ± Ù…ØªØ²Ø§Ù…Ù†Ø© (PBKDF2) ÙˆÙ„Ø§ ØªØµÙ„Ø­ Ø¯Ø§Ø®Ù„ batch
  await setPassword(c.env.DB, id, password, { mustChange: true })

  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO access_grants (id, grantee_type, grantee_id, role_id, scope_type, granted_by)
      VALUES (?, 'user', ?, ?, 'platform', ?)
    `).bind(crypto.randomUUID(), id, roleId, actor),
    audit(c.env.DB, actor, 'create', id, { email, display_name: displayName, role_id: roleId }),
  ])

  return c.json({
    success: true,
    data: { id, email, display_name: displayName, role_id: roleId, must_change_password: true },
  }, 201)
})

adminUsersRoute.patch('/users/:id', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  const id = c.req.param('id')
  const target = await queryFirst<{ id: string; email: string }>(
    c.env.DB, 'SELECT id, email FROM admin_users WHERE id = ?', [id],
  )
  if (!target) return c.json({ success: false, error: 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' }, 404)

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'ØµÙŠØºØ© Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± ØµØ§Ù„Ø­Ø©' }, 400)

  const actor = actorId(c)
  const sets: string[] = []
  const params: unknown[] = []

  if (body.display_name !== undefined) {
    const value = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 120) : ''
    if (!value) return c.json({ success: false, error: 'Ø§Ù„Ø§Ø³Ù… Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø£Ù† ÙŠÙƒÙˆÙ† ÙØ§Ø±ØºÙ‹Ø§' }, 400)
    sets.push('display_name = ?')
    params.push(value)
  }

  if (body.is_active !== undefined) {
    const active = body.is_active === true || body.is_active === 1 || body.is_active === '1'
    // Ù„Ø§ ÙŠØ³ØªØ·ÙŠØ¹ Ø£Ø­Ø¯ ØªØ¹Ø·ÙŠÙ„ Ù†ÙØ³Ù‡: ÙŠÙÙ‚Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ ÙÙˆØ±Ù‹Ø§ Ø¨Ù„Ø§ Ø³Ø¨ÙŠÙ„ Ù„Ù„ØªØ±Ø§Ø¬Ø¹
    const self = c.get('adminUser')
    if (!active && self?.id === id) {
      return c.json({ success: false, error: 'Ù„Ø§ ÙŠÙ…ÙƒÙ†Ùƒ ØªØ¹Ø·ÙŠÙ„ Ø­Ø³Ø§Ø¨Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ' }, 400)
    }
    sets.push('is_active = ?')
    params.push(active ? 1 : 0)
    // Ø§Ù„ØªØ¹Ø·ÙŠÙ„ ÙŠØ³Ø­Ø¨ Ø§Ù„Ø¬Ù„Ø³Ø§Øª ÙÙˆØ±Ù‹Ø§ØŒ ÙˆØ¥Ù„Ø§ Ø¨Ù‚ÙŠ Ø§Ù„Ù…ÙˆØ¸Ù Ø¯Ø§Ø®Ù„Ù‹Ø§ Ø­ØªÙ‰ ØªÙ†ØªÙ‡ÙŠ Ø¬Ù„Ø³ØªÙ‡
    if (!active) await revokeAllSessions(c.env.DB, id)
  }

  if (!sets.length) return c.json({ success: false, error: 'Ù„Ø§ Ø­Ù‚ÙˆÙ„ Ù„Ù„ØªØ­Ø¯ÙŠØ«' }, 400)

  sets.push(`updated_at = datetime('now')`)
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE admin_users SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id),
    audit(c.env.DB, actor, 'update', id, body),
  ])

  return c.json({ success: true, data: { id, updated: true } })
})

/**
 * ÙŠØ¹ÙŠØ¯ Ø¶Ø¨Ø· ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ù…Ø³ØªØ®Ø¯Ù….
 *
 * Ù„Ù„Ø­Ø§Ù„Ø© Ø§Ù„ØªÙŠ ÙŠÙ†Ø³Ù‰ ÙÙŠÙ‡Ø§ Ù…ÙˆØ¸Ù ÙƒÙ„Ù…ØªÙ‡: Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ ÙŠØ¶Ø¨Ø· ÙƒÙ„Ù…Ø© Ù…Ø¤Ù‚ØªØ© ØªÙÙ„Ø²Ù…Ù‡ Ø¨Ø§Ù„ØªØºÙŠÙŠØ±.
 * Ù„Ø§ ÙŠØ­ØªØ§Ø¬ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© Ù„Ø£Ù† Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ Ù„Ø§ ÙŠØ¹Ø±ÙÙ‡Ø§ØŒ ÙˆÙ„Ù‡Ø°Ø§ ØªÙØ³Ø­Ø¨ ÙƒÙ„ Ø¬Ù„Ø³Ø§Øª
 * Ø§Ù„Ø­Ø³Ø§Ø¨ Ø­ØªÙ‰ Ù„Ø§ ÙŠØ³ØªÙÙŠØ¯ Ù…Ù† Ø°Ù„Ùƒ Ù…Ù† Ø§Ø³ØªÙˆÙ„Ù‰ Ø¹Ù„Ù‰ Ø¬Ù„Ø³Ø© Ù…ÙØªÙˆØ­Ø©.
 */
adminUsersRoute.post('/users/:id/reset-password', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  const id = c.req.param('id')
  const target = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE id = ?', [id])
  if (!target) return c.json({ success: false, error: 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' }, 404)

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  const password = body && typeof body.password === 'string' ? body.password : ''
  const weak = validatePassword(password)
  if (weak) return c.json({ success: false, error: weak }, 400)

  await setPassword(c.env.DB, id, password, { mustChange: true })
  await revokeAllSessions(c.env.DB, id)
  await c.env.DB.batch([audit(c.env.DB, actorId(c), 'update', id, { change: 'password_reset' })])

  return c.json({ success: true, data: { id, must_change_password: true } })
})

/// ÙŠÙ…Ù†Ø­ Ø¯ÙˆØ±Ù‹Ø§ Ø¹Ù„Ù‰ Ù†Ø·Ø§Ù‚ Ø§Ù„Ù…Ù†ØµÙ‘Ø© Ø£Ùˆ Ù†Ø·Ø§Ù‚ Ø£Ø¶ÙŠÙ‚.
adminUsersRoute.post('/users/:id/grants', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  const id = c.req.param('id')
  const target = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM admin_users WHERE id = ?', [id])
  if (!target) return c.json({ success: false, error: 'Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' }, 404)

  const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return c.json({ success: false, error: 'ØµÙŠØºØ© Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± ØµØ§Ù„Ø­Ø©' }, 400)

  const roleId = typeof body.role_id === 'string' ? body.role_id.trim() : ''
  const role = await queryFirst<{ id: string }>(c.env.DB, 'SELECT id FROM roles WHERE id = ?', [roleId])
  if (!role) return c.json({ success: false, error: 'Ø¯ÙˆØ± ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ' }, 400)

  const SCOPES = ['platform', 'planet', 'section', 'series', 'content', 'page', 'language']
  const scopeType = typeof body.scope_type === 'string' ? body.scope_type : 'platform'
  if (!SCOPES.includes(scopeType)) return c.json({ success: false, error: 'Ù†Ø·Ø§Ù‚ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ' }, 400)
  const scopeId = typeof body.scope_id === 'string' ? body.scope_id.trim() || null : null

  const grantId = crypto.randomUUID()
  await c.env.DB.batch([
    c.env.DB.prepare(`
      INSERT INTO access_grants (id, grantee_type, grantee_id, role_id, scope_type, scope_id, granted_by)
      VALUES (?, 'user', ?, ?, ?, ?, ?)
    `).bind(grantId, id, roleId, scopeType, scopeId, actorId(c)),
    audit(c.env.DB, actorId(c), 'create', id, { grant: grantId, role_id: roleId, scope_type: scopeType }),
  ])

  return c.json({ success: true, data: { id: grantId } }, 201)
})

adminUsersRoute.delete('/users/:id/grants/:grantId', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  const id = c.req.param('id')
  const grantId = c.req.param('grantId')
  const grant = await queryFirst<{ id: string; role_id: string }>(
    c.env.DB,
    `SELECT id, role_id FROM access_grants WHERE id = ? AND grantee_type = 'user' AND grantee_id = ?`,
    [grantId, id],
  )
  if (!grant) return c.json({ success: false, error: 'Ø§Ù„Ù…Ù†Ø­ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯' }, 404)

  // Ù…Ù†Ø¹ Ø¥Ø²Ø§Ù„Ø© Ø¢Ø®Ø± Ù…Ù†Ø­ Ù…Ù„ÙƒÙŠØ©: Ø§Ù„Ù…Ù†ØµÙ‘Ø© Ø¨Ù„Ø§ Ù…Ø§Ù„Ùƒ Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø¯Ø§Ø±ØªÙ‡Ø§
  if (grant.role_id === 'owner') {
    const owners = await queryFirst<{ total: number }>(c.env.DB, `
      SELECT COUNT(*) AS total FROM access_grants
       WHERE role_id = 'owner' AND grantee_type = 'user'
         AND (valid_until IS NULL OR valid_until > datetime('now'))
    `)
    if (Number(owners?.total ?? 0) <= 1) {
      return c.json({ success: false, error: 'Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø²Ø§Ù„Ø© Ø¢Ø®Ø± Ù…Ø§Ù„Ùƒ Ù„Ù„Ù…Ù†ØµÙ‘Ø©' }, 400)
    }
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM access_grants WHERE id = ?').bind(grantId),
    audit(c.env.DB, actorId(c), 'archive', id, { removed_grant: grantId, role_id: grant.role_id }),
  ])

  return c.json({ success: true, data: { id: grantId, removed: true } })
})

/// Ø¬Ù„Ø³Ø§Øª Ù…Ø³ØªØ®Ø¯Ù… Ø§Ù„Ù†Ø´Ø·Ø©ØŒ Ù„Ù…Ø±Ø§Ø¬Ø¹ØªÙ‡Ø§ ÙˆØ³Ø­Ø¨Ù‡Ø§
adminUsersRoute.get('/users/:id/sessions', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)

  const rows = await queryAll<Record<string, unknown>>(c.env.DB, `
    SELECT id, user_agent, source_ip, created_at, last_seen_at, expires_at
      FROM admin_sessions
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > datetime('now')
     ORDER BY last_seen_at DESC
  `, [c.req.param('id')])
  return c.json({ success: true, data: rows })
})

adminUsersRoute.post('/users/:id/revoke-sessions', async (c) => {
  if (!canManage(c)) return c.json({ success: false, error: 'Ù„Ø§ ØªÙ…Ù„Ùƒ ØµÙ„Ø§Ø­ÙŠØ© Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†' }, 403)
  const id = c.req.param('id')
  await revokeAllSessions(c.env.DB, id)
  await c.env.DB.batch([audit(c.env.DB, actorId(c), 'update', id, { change: 'sessions_revoked' })])
  return c.json({ success: true, data: { id, revoked: true } })
})

export default adminUsersRoute
