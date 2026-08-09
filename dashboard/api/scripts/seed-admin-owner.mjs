/**
 * يبذر أول حساب مالك للوحة الإدارة.
 *
 * ## لماذا سكربت لا نقطة API
 *
 * إنشاء أول مالك لا يمكن أن يكون مسارًا عامًا: من يستطيع نداءه يصير مالك
 * المنصّة. وربطه بالمفتاح المشترك يعني بقاء المفتاح بابًا دائمًا وهو ما نحاول
 * إزالته. السكربت يعمل بصلاحية من يملك وصولًا لقاعدة البيانات أصلًا، وهي
 * الصلاحية الصحيحة لهذه العملية بالضبط.
 *
 * ## آمن لإعادة التشغيل
 *
 * إن وُجد الحساب لا يُنشأ ثانية. كلمة المرور تُضبط فقط عند غياب اعتمادات، أو
 * عند تمرير --force-password صراحةً. فتشغيله مرتين لا يُبطل كلمة مرور يعمل بها
 * المالك.
 *
 * Usage:
 *   node scripts/seed-admin-owner.mjs --email=you@example.com --name="اسمك" [--remote]
 *   node scripts/seed-admin-owner.mjs --email=... --password=... [--force-password]
 *
 * عند عدم تمرير --password تُولَّد كلمة مرور قوية وتُطبع مرة واحدة.
 */

import { createHash, randomBytes, webcrypto } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')
const tempDir = path.join(apiDir, '.tmp')

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const found = args.find((a) => a.startsWith(`${name}=`))
  return found ? found.slice(name.length + 1) : fallback
}
const isRemote = args.includes('--remote')
const forcePassword = args.includes('--force-password')
const targetFlag = isRemote ? '--remote' : '--local'

const email = valueOf('--email').trim().toLowerCase()
const displayName = valueOf('--name').trim() || 'مالك المنصة'
const suppliedPassword = valueOf('--password')

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
  console.error('يجب تمرير --email=بريد صالح')
  process.exit(1)
}

/**
 * تعمية كلمة المرور بنفس صيغة src/lib/security.ts بالحرف.
 *
 * `pbkdf2-sha256$100000$saltB64Url$hashB64Url` بملح ١٦ بايت ومخرج ٢٥٦ بتًا،
 * وbase64url بلا حشو. أي انحراف هنا يُنتج تعمية لا يقبلها الخادم، فتفشل كل
 * محاولة دخول بلا سبب ظاهر.
 */
const PASSWORD_ITERATIONS = 100000

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hashPassword(password) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const key = await webcrypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'],
  )
  const derived = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PASSWORD_ITERATIONS, hash: 'SHA-256' },
    key, 256,
  )
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${base64Url(salt)}$${base64Url(new Uint8Array(derived))}`
}

/// كلمة مرور مولَّدة: حروف وأرقام بلا رموز ملتبسة، ٢٤ محرفًا.
function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = randomBytes(24)
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join('')
}

function run(cmdArgs) {
  return new Promise((resolve, reject) => {
    // Windows يحتاج shell لتشغيل wrangler.cmd، فكل وسيط يجب أن يخلو من الفراغات:
    // SQL يمرّ عبر --file دائمًا لا مضمّنًا.
    const child = spawn(wrangler, cmdArgs, { cwd: apiDir, shell: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`wrangler ${cmdArgs.join(' ')} exited ${code}\n${stderr}`))
    })
  })
}

/**
 * يستخرج مصفوفة JSON من مخرَج wrangler المحلي.
 *
 * البحث عن أول `[` وحده لا يكفي: wrangler يطبع أسطرًا قبل الـJSON تحتوي
 * أقواسًا مربّعة (مثل `[WARNING]`). فتُجرَّب كل المواضع حتى ينجح التحليل
 * ويكون الناتج بالشكل المتوقّع.
 */
function extractJsonArray(out) {
  for (let index = out.indexOf('['); index !== -1; index = out.indexOf('[', index + 1)) {
    try {
      const parsed = JSON.parse(out.slice(index))
      // شكل wrangler: [{ results: [...], success: true, meta: {...} }]
      if (Array.isArray(parsed) && parsed.every((item) => item && typeof item === 'object' && 'results' in item)) {
        return parsed
      }
    } catch {
      // ليس بداية JSON صالح: جرّب الموضع التالي
    }
  }
  throw new Error(`لم يُعثر على JSON في مخرَج wrangler:\n${out.slice(0, 300)}`)
}

const CF_ACCOUNT_ID = 'dac54e3a06ab8a602a5625633e0d09e9'
const CF_DATABASE_ID = '38febc7d-3712-444c-8b89-6c047cee32ee'

let cachedToken = null

/// يقرأ رمز OAuth من إعداد wrangler المحلي، فلا يُمرَّر سرّ في سطر الأوامر.
async function cloudflareToken() {
  if (cachedToken) return cachedToken
  const configPath = path.join(
    process.env.APPDATA ?? process.env.HOME ?? '',
    'xdg.config', '.wrangler', 'config', 'default.toml',
  )
  const text = await fs.readFile(configPath, 'utf8')
  const match = text.match(/^oauth_token\s*=\s*"(.+)"/m)
  if (!match) throw new Error(`لم يُعثر على oauth_token في ${configPath}`)
  cachedToken = match[1]
  return cachedToken
}

/**
 * يُنفّذ SQL على الإنتاج عبر واجهة REST.
 *
 * ## لماذا لا wrangler للإنتاج
 *
 * `wrangler d1 execute --remote --file=... --json` **لا يُعيد صفوف الاستعلام**:
 * يُعيد ملخّص الرفع (`Total queries executed`, `Rows read`, `Database size`).
 * فكان كل قراءة من الإنتاج تُنتج صفًا زائفًا بلا `id`، فيظنّ السكربت أن الحساب
 * موجود ويتخطّى إدراج admin_users، ثم يفشل admin_credentials على قيد المفتاح
 * الأجنبي. نقطة `/query` تُعيد الصفوف فعلًا، وهي نفسها التي يستعملها
 * apply-remote-migration.mjs.
 */
async function remoteQuery(sql) {
  const token = await cloudflareToken()
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
  return body.result ?? []
}

/**
 * يقسّم SQL إلى تعليمات، مع احترام النصوص والتعليقات.
 *
 * نقطة `/query` تقبل تعليمة واحدة لكل نداء، والتقسيم الساذج على ';' يكسر أي
 * تعليمة تحتوي فاصلة منقوطة داخل نص.
 */
function splitStatements(sql) {
  const statements = []
  let current = ''
  let inSingle = false
  let inLineComment = false

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (inLineComment) {
      if (char === '\n') { inLineComment = false; current += char }
      continue
    }
    if (!inSingle && char === '-' && next === '-') { inLineComment = true; index += 1; continue }

    if (char === "'") {
      if (inSingle && next === "'") { current += "''"; index += 1; continue }
      inSingle = !inSingle
      current += char
      continue
    }

    if (char === ';' && !inSingle) {
      const trimmed = current.trim()
      if (trimmed) statements.push(trimmed)
      current = ''
      continue
    }
    current += char
  }

  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

async function d1(sql, { json = false } = {}) {
  // الإنتاج يمرّ عبر REST لأن wrangler لا يُعيد الصفوف مع --remote --file
  if (isRemote) {
    const results = []
    for (const statement of splitStatements(sql)) {
      const outcome = await remoteQuery(statement)
      results.push(...(outcome[0]?.results ?? []))
    }
    return json ? results : null
  }

  await fs.mkdir(tempDir, { recursive: true })
  const sqlPath = path.join(tempDir, `seed-${createHash('sha1').update(sql).digest('hex').slice(0, 12)}.sql`)
  await fs.writeFile(sqlPath, sql, 'utf8')
  try {
    const flags = ['d1', 'execute', 'majarra-db', targetFlag, `--file=${sqlPath}`]
    if (json) flags.splice(4, 0, '--json')
    const out = await run(flags)
    if (!json) return null
    return extractJsonArray(out)[0]?.results ?? []
  } finally {
    await fs.rm(sqlPath, { force: true })
  }
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

async function main() {
  console.log(`الهدف: ${isRemote ? 'قاعدة الإنتاج' : 'قاعدة محلية'}`)

  const existing = await d1(
    `SELECT id, email, display_name, is_active FROM admin_users WHERE email = ${sql(email)};`,
    { json: true },
  )
  const user = existing[0] ?? null

  const userId = user?.id ?? webcrypto.randomUUID()
  if (user) {
    console.log(`الحساب موجود: ${user.id}`)
  } else {
    console.log(`إنشاء حساب جديد: ${userId}`)
  }

  const credentials = await d1(
    `SELECT user_id FROM admin_credentials WHERE user_id = ${sql(userId)};`,
    { json: true },
  )
  const hasCredentials = credentials.length > 0

  // كلمة المرور تُضبط عند غياب الاعتمادات فقط، أو بطلب صريح. غير ذلك تُترك
  // كما هي حتى لا يُبطِل تشغيلٌ ثانٍ كلمةً يعمل بها المالك.
  const shouldSetPassword = !hasCredentials || forcePassword
  const password = shouldSetPassword ? (suppliedPassword || generatePassword()) : null
  const passwordHash = password ? await hashPassword(password) : null

  const statements = ['PRAGMA foreign_keys = ON;']

  if (!user) {
    statements.push(`
INSERT INTO admin_users (id, email, display_name, is_active, is_external)
VALUES (${sql(userId)}, ${sql(email)}, ${sql(displayName)}, 1, 0);`)
  } else {
    // الحساب المبذور يُعاد تنشيطه: البذر نية صريحة لإتاحة الدخول
    statements.push(`
UPDATE admin_users SET display_name = ${sql(displayName)}, is_active = 1, updated_at = datetime('now')
WHERE id = ${sql(userId)};`)
  }

  if (passwordHash) {
    // must_change_password = 0 للمالك المبذور: لا مسؤول أعلى منه يضبط له كلمة،
    // والكلمة المولَّدة عشوائية قوية لا مؤقتة ضعيفة.
    statements.push(`
INSERT INTO admin_credentials (user_id, password_hash, must_change_password)
VALUES (${sql(userId)}, ${sql(passwordHash)}, 0)
ON CONFLICT(user_id) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_updated_at = datetime('now'),
  must_change_password = 0,
  failed_login_count = 0,
  locked_until = NULL,
  updated_at = datetime('now');`)
  }

  // منح الملكية على نطاق المنصّة. INSERT ... SELECT ... WHERE NOT EXISTS
  // يجعله آمنًا للتكرار بلا قيد فريد على الجدول.
  statements.push(`
INSERT INTO access_grants (id, grantee_type, grantee_id, role_id, scope_type, granted_by)
SELECT ${sql(webcrypto.randomUUID())}, 'user', ${sql(userId)}, 'owner', 'platform', ${sql(userId)}
 WHERE NOT EXISTS (
   SELECT 1 FROM access_grants
    WHERE grantee_type = 'user' AND grantee_id = ${sql(userId)}
      AND role_id = 'owner' AND scope_type = 'platform'
 );`)

  statements.push(`
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
VALUES (${sql(webcrypto.randomUUID())}, 'seed-admin-owner-script', 'create', 'admin_user', ${sql(userId)},
        ${sql(JSON.stringify({ email, role: 'owner', password_set: !!passwordHash }))});`)

  await d1(statements.join('\n'))

  // التحقق من النتيجة بقراءة مستقلة لا بافتراض نجاح الكتابة
  const verify = await d1(`
SELECT u.id, u.email, u.display_name, u.is_active,
       CASE WHEN c.user_id IS NULL THEN 0 ELSE 1 END AS has_password,
       (SELECT GROUP_CONCAT(role_id) FROM access_grants
         WHERE grantee_type = 'user' AND grantee_id = u.id) AS roles
  FROM admin_users u
  LEFT JOIN admin_credentials c ON c.user_id = u.id
 WHERE u.id = ${sql(userId)};`, { json: true })

  const row = verify[0]
  console.log('\nالنتيجة:')
  console.log(`  المعرّف       ${row?.id}`)
  console.log(`  البريد        ${row?.email}`)
  console.log(`  الاسم         ${row?.display_name}`)
  console.log(`  مُفعَّل        ${Number(row?.is_active) === 1 ? 'نعم' : 'لا'}`)
  console.log(`  كلمة مرور     ${Number(row?.has_password) === 1 ? 'مضبوطة' : 'غير مضبوطة'}`)
  console.log(`  الأدوار       ${row?.roles ?? 'لا شيء'}`)

  if (password) {
    console.log('\n──────────────────────────────────────────────')
    console.log('  كلمة المرور (تُطبع مرة واحدة، احفظها الآن):')
    console.log(`  ${password}`)
    console.log('──────────────────────────────────────────────')
    console.log('  غيّرها من اللوحة بعد أول دخول.')
  } else {
    console.log('\nكلمة المرور لم تُلمس. استخدم --force-password لإعادة ضبطها.')
  }

  const ok = row && Number(row.is_active) === 1 && Number(row.has_password) === 1
    && String(row.roles ?? '').includes('owner')
  if (!ok) {
    console.error('\nالتحقق فشل: الحساب غير مكتمل.')
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
