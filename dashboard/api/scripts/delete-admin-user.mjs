/**
 * يحذف حساب موظف من قاعدة الإنتاج أو المحلية.
 *
 * يُستخدم لإزالة حسابات الاختبار التي يُنشئها verify-admin-auth.mjs. الحذف
 * يقتصر على المعرّف المُمرَّر، ويرفض حذف أي حساب يملك دور owner حتى لا تُفقد
 * ملكية المنصّة بخطأ في سطر الأوامر.
 *
 * Usage:
 *   node scripts/delete-admin-user.mjs --id=<uuid> [--remote] [--dry-run]
 *   node scripts/delete-admin-user.mjs --email=<address> [--remote]
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const found = args.find((a) => a.startsWith(`${name}=`))
  return found ? found.slice(name.length + 1) : fallback
}

const isRemote = args.includes('--remote')
const dryRun = args.includes('--dry-run')
const targetId = valueOf('--id')
const targetEmail = valueOf('--email').trim().toLowerCase()

if (!targetId && !targetEmail) {
  console.error('يجب تمرير --id أو --email')
  process.exit(1)
}

const CF_ACCOUNT_ID = 'dac54e3a06ab8a602a5625633e0d09e9'
const CF_DATABASE_ID = '38febc7d-3712-444c-8b89-6c047cee32ee'

async function cloudflareToken() {
  const configPath = path.join(
    process.env.APPDATA ?? process.env.HOME ?? '',
    'xdg.config', '.wrangler', 'config', 'default.toml',
  )
  const text = await fs.readFile(configPath, 'utf8')
  const match = text.match(/^oauth_token\s*=\s*"(.+)"/m)
  if (!match) throw new Error(`لم يُعثر على oauth_token في ${configPath}`)
  return match[1]
}

let token = null

/// الإنتاج عبر REST: wrangler لا يُعيد صفوف الاستعلام مع --remote
async function query(sql) {
  if (!isRemote) throw new Error('الوضع المحلي غير مدعوم في هذا السكربت؛ استخدم wrangler مباشرة')
  token ??= await cloudflareToken()
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${CF_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    },
  )
  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.success) {
    const detail = body?.errors?.map((e) => `${e.code}: ${e.message}`).join('; ') ?? `HTTP ${response.status}`
    throw new Error(detail)
  }
  return body.result?.[0]?.results ?? []
}

function sqlText(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

async function main() {
  const where = targetId ? `id = ${sqlText(targetId)}` : `email = ${sqlText(targetEmail)}`
  const found = await query(`SELECT id, email, display_name, is_active FROM admin_users WHERE ${where}`)

  if (!found.length) {
    console.log('لا حساب مطابق. لا شيء ليُحذف.')
    return
  }

  const user = found[0]
  console.log(`الحساب: ${user.email} (${user.id})`)
  console.log(`  الاسم    ${user.display_name}`)
  console.log(`  مُفعَّل   ${Number(user.is_active) === 1 ? 'نعم' : 'لا'}`)

  // حماية الملكية: لا يُحذف مالك من سطر الأوامر
  const grants = await query(
    `SELECT role_id FROM access_grants WHERE grantee_type = 'user' AND grantee_id = ${sqlText(user.id)}`,
  )
  const roles = grants.map((row) => row.role_id)
  console.log(`  الأدوار  ${roles.join(', ') || 'لا شيء'}`)

  if (roles.includes('owner')) {
    console.error('\nمرفوض: هذا الحساب يملك دور owner. لا يُحذف مالك المنصّة بهذا السكربت.')
    process.exitCode = 1
    return
  }

  if (dryRun) {
    console.log('\n(تشغيل تجريبي) كان سيُحذف الحساب ومنحه وجلساته واعتماداته.')
    return
  }

  // الترتيب مقصود: المنح والجلسات والاعتمادات قبل الصف الأصلي.
  // ON DELETE CASCADE يغطّي الاعتمادات والجلسات، لكن الحذف الصريح يجعل النتيجة
  // مؤكّدة ولا تعتمد على تفعيل PRAGMA foreign_keys في اتصال D1.
  await query(`DELETE FROM access_grants WHERE grantee_type = 'user' AND grantee_id = ${sqlText(user.id)}`)
  await query(`DELETE FROM admin_sessions WHERE user_id = ${sqlText(user.id)}`)
  await query(`DELETE FROM admin_credentials WHERE user_id = ${sqlText(user.id)}`)
  await query(`DELETE FROM admin_users WHERE id = ${sqlText(user.id)}`)

  await query(
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
     VALUES (${sqlText(crypto.randomUUID())}, 'delete-admin-user-script', 'archive', 'admin_user',
             ${sqlText(user.id)}, ${sqlText(JSON.stringify({ email: user.email, reason: 'verification cleanup' }))})`,
  )

  const remaining = await query('SELECT id, email, display_name, is_active FROM admin_users ORDER BY created_at')
  const counts = await query(
    `SELECT (SELECT COUNT(*) FROM admin_users) AS users,
            (SELECT COUNT(*) FROM admin_credentials) AS credentials,
            (SELECT COUNT(*) FROM admin_sessions) AS sessions,
            (SELECT COUNT(*) FROM access_grants) AS grants`,
  )

  console.log('\nحُذف الحساب.')
  console.log('\nالحسابات المتبقية:')
  for (const row of remaining) {
    console.log(`  ${row.email}  (${Number(row.is_active) === 1 ? 'مُفعَّل' : 'معطَّل'})`)
  }
  console.log(`\nالأعداد: ${JSON.stringify(counts[0])}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
