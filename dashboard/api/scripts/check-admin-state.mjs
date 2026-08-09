/**
 * يفحص حالة حسابات الإدارة على الإنتاج أو محليًا.
 *
 * قراءة فقط. لا يكتب شيئًا، فتشغيله آمن ومتكرر.
 *
 * Usage: node scripts/check-admin-state.mjs [--remote]
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const isRemote = process.argv.includes('--remote')

const CF_ACCOUNT_ID = 'dac54e3a06ab8a602a5625633e0d09e9'
const CF_DATABASE_ID = '38febc7d-3712-444c-8b89-6c047cee32ee'

async function token() {
  const configPath = path.join(
    process.env.APPDATA ?? process.env.HOME ?? '',
    'xdg.config', '.wrangler', 'config', 'default.toml',
  )
  const content = await fs.readFile(configPath, 'utf8')
  const match = content.match(/^oauth_token\s*=\s*"(.+)"/m)
  if (!match) throw new Error(`لم يُعثر على oauth_token في ${configPath}`)
  return match[1]
}

let cached = null
async function query(sql) {
  cached ??= await token()
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cached}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    },
  )
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) {
    throw new Error(body?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ?? `HTTP ${response.status}`)
  }
  return body.result?.[0]?.results ?? []
}

async function main() {
  if (!isRemote) {
    console.error('الوضع المحلي غير مدعوم؛ استخدم wrangler d1 execute --local مباشرة')
    process.exit(1)
  }

  console.log('=== حسابات الإدارة على الإنتاج ===')
  const users = await query(`
    SELECT u.id, u.email, u.display_name, u.is_active, u.is_external,
           CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END AS has_password,
           COALESCE(c.must_change_password, -1) AS must_change,
           c.last_login_at, c.locked_until, COALESCE(c.failed_login_count, -1) AS failures
      FROM admin_users u
      LEFT JOIN admin_credentials c ON c.user_id = u.id
     ORDER BY u.created_at
  `)
  if (!users.length) console.log('  لا حسابات إطلاقًا')
  for (const user of users) {
    console.log(`\n  البريد        ${user.email}`)
    console.log(`  المعرّف       ${user.id}`)
    console.log(`  الاسم         ${user.display_name}`)
    console.log(`  مُفعَّل        ${Number(user.is_active) === 1 ? 'نعم' : 'لا'}`)
    console.log(`  كلمة مرور     ${Number(user.has_password) === 1 ? 'مضبوطة' : 'غير مضبوطة'}`)
    console.log(`  تغيير إلزامي  ${Number(user.must_change) === 1 ? 'نعم' : 'لا'}`)
    console.log(`  آخر دخول      ${user.last_login_at ?? 'لم يدخل بعد'}`)
    console.log(`  مقفل حتى      ${user.locked_until ?? 'غير مقفل'}`)
    console.log(`  محاولات فاشلة ${user.failures}`)
  }

  console.log('\n=== المنح ===')
  const grants = await query(`
    SELECT grantee_type, grantee_id, role_id, scope_type, scope_id, content_type, language, valid_until
      FROM access_grants ORDER BY created_at
  `)
  if (!grants.length) console.log('  لا منح')
  for (const grant of grants) {
    console.log(`  ${grant.role_id} · ${grant.scope_type}${grant.scope_id ? `:${grant.scope_id}` : ''} · ${grant.grantee_type}=${String(grant.grantee_id).slice(0, 12)} · ينتهي=${grant.valid_until ?? 'دائم'}`)
  }

  console.log('\n=== الجلسات النشطة ===')
  const sessions = await query(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN revoked_at IS NULL AND expires_at > datetime('now') THEN 1 ELSE 0 END) AS active
      FROM admin_sessions
  `)
  console.log(`  الإجمالي ${sessions[0]?.total ?? 0} · النشطة ${sessions[0]?.active ?? 0}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
