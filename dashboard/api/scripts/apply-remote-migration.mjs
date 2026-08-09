/**
 * يطبّق ملف مهاجرة على D1 الإنتاج عبر واجهة REST مباشرة.
 *
 * ## لماذا لا wrangler
 *
 * `wrangler d1 execute --remote --file=...` يرفع الملف إلى نقطة `/import`،
 * وهي تُرجع `Authentication error [code: 10000]` بالرمز الحالي. نقطة `/query`
 * تعمل بالرمز نفسه، فالمشكلة في صلاحية الاستيراد لا في الاتصال. هذا السكربت
 * يقسّم الملف إلى تعليمات ويُرسلها عبر `/query`.
 *
 * ## الأمان
 *
 * يرفض أي ملف يحتوي تعليمة مدمّرة (DROP / DELETE / TRUNCATE / ALTER ... DROP).
 * المهاجرات المقصودة كلها `CREATE TABLE IF NOT EXISTS` و`INSERT OR IGNORE`،
 * أي قابلة لإعادة التشغيل بلا أثر جانبي. الرفض صريح حتى لا يُستخدم هذا
 * السكربت لاحقًا في تطبيق مهاجرة تحذف بيانات بلا مراجعة.
 *
 * يسجّل الملف في d1_migrations بعد النجاح، فلا يعيد wrangler تطبيقه.
 *
 * Usage:
 *   node scripts/apply-remote-migration.mjs --file=0019_admin_auth.sql [--dry-run]
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')

const args = process.argv.slice(2)
const valueOf = (name, fallback = '') => {
  const found = args.find((a) => a.startsWith(`${name}=`))
  return found ? found.slice(name.length + 1) : fallback
}
const dryRun = args.includes('--dry-run')
const fileName = valueOf('--file')

const ACCOUNT_ID = valueOf('--account', 'dac54e3a06ab8a602a5625633e0d09e9')
const DATABASE_ID = valueOf('--database', '38febc7d-3712-444c-8b89-6c047cee32ee')

if (!fileName) {
  console.error('يجب تمرير --file=اسم_ملف_المهاجرة')
  process.exit(1)
}

/// يقرأ رمز OAuth من إعداد wrangler المحلي، فلا يُمرَّر سرّ في سطر الأوامر.
async function readToken() {
  const configPath = path.join(
    process.env.APPDATA ?? process.env.HOME ?? '',
    'xdg.config', '.wrangler', 'config', 'default.toml',
  )
  const text = await fs.readFile(configPath, 'utf8')
  const match = text.match(/^oauth_token\s*=\s*"(.+)"/m)
  if (!match) throw new Error(`لم يُعثر على oauth_token في ${configPath}`)
  return match[1]
}

/**
 * يقسّم SQL إلى تعليمات، مع احترام النصوص والتعليقات.
 *
 * التقسيم الساذج على ';' يكسر أي تعليمة تحتوي فاصلة منقوطة داخل نص، وهي
 * موجودة فعلًا في بذور الأدوار والصلاحيات.
 */
function splitStatements(sql) {
  const statements = []
  let current = ''
  let inSingle = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index]
    const next = sql[index + 1]

    if (inLineComment) {
      if (char === '\n') { inLineComment = false; current += char }
      continue
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') { inBlockComment = false; index += 1 }
      continue
    }
    if (!inSingle && char === '-' && next === '-') { inLineComment = true; index += 1; continue }
    if (!inSingle && char === '/' && next === '*') { inBlockComment = true; index += 1; continue }

    if (char === "'") {
      // '' داخل نص هو اقتباس مهروب لا نهاية للنص
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

const DESTRUCTIVE = /^\s*(DROP\b|DELETE\s+FROM\b|TRUNCATE\b)|ALTER\s+TABLE[\s\S]*\bDROP\b/i

/// أخطاء تعني «مُطبَّق سابقًا» لا فشلًا.
///
/// `ALTER TABLE ... ADD COLUMN` غير قابلة لإعادة التشغيل في SQLite: لا يوجد
/// `IF NOT EXISTS` لها. مهاجرة توقّفت في منتصفها لا يمكن إكمالها إن عُدّ
/// «duplicate column» فشلًا، مع أن العمود موجود وهو المطلوب بالضبط.
const ALREADY_APPLIED = /duplicate column name|already exists/i

async function query(token, sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
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

async function main() {
  const filePath = path.join(apiDir, 'migrations', fileName)
  const sql = await fs.readFile(filePath, 'utf8')
  const statements = splitStatements(sql)

  console.log(`الملف: ${fileName}`)
  console.log(`التعليمات: ${statements.length}`)

  const destructive = statements.filter((s) => DESTRUCTIVE.test(s))
  if (destructive.length) {
    console.error(`\nمرفوض: الملف يحتوي ${destructive.length} تعليمة مدمّرة.`)
    for (const s of destructive) console.error(`  ${s.slice(0, 120)}`)
    console.error('\nهذا السكربت للمهاجرات غير المدمّرة فقط. راجعها يدويًا.')
    process.exit(1)
  }
  console.log('فحص الأمان: لا تعليمات مدمّرة ✓')

  if (dryRun) {
    console.log('\n(تشغيل تجريبي) التعليمات التي كانت ستُنفَّذ:')
    for (const [index, statement] of statements.entries()) {
      console.log(`  ${index + 1}. ${statement.replace(/\s+/g, ' ').slice(0, 110)}`)
    }
    return
  }

  const token = await readToken()

  // الفحص أولًا: هل الملف مسجَّل بالفعل؟
  const applied = await query(
    token,
    `SELECT name FROM d1_migrations WHERE name = '${fileName.replace(/'/g, "''")}'`,
  )
  if ((applied[0]?.results ?? []).length) {
    console.log('\nالملف مسجَّل بالفعل في d1_migrations.')
    console.log('التعليمات كلها IF NOT EXISTS / OR IGNORE، فسيُعاد تنفيذها بلا أثر.')
  }

  let ok = 0
  let skipped = 0
  const failures = []
  for (const [index, statement] of statements.entries()) {
    try {
      await query(token, statement)
      ok += 1
    } catch (error) {
      // `ALTER TABLE ... ADD COLUMN` ليست قابلة لإعادة التشغيل: لا يوجد
      // `ADD COLUMN IF NOT EXISTS` في SQLite، فإعادة تطبيق مهاجرة مطبَّقة
      // جزئيًا تفشل بـ"duplicate column". العمود موجود بالفعل وهذا هو
      // المطلوب، فيُحتسب تخطّيًا لا فشلًا — وإلا استحال إكمال مهاجرة توقّفت
      // في منتصفها.
      if (ALREADY_APPLIED.test(error.message)) {
        skipped += 1
      } else {
        failures.push({ index: index + 1, statement, message: error.message })
      }
    }
    if ((index + 1) % 5 === 0 || index === statements.length - 1) {
      console.log(`  تقدّم ${index + 1}/${statements.length} (نجح ${ok}، مُطبَّق سابقًا ${skipped}، فشل ${failures.length})`)
    }
  }

  if (failures.length) {
    console.error(`\nفشل ${failures.length} تعليمة:`)
    for (const failure of failures) {
      console.error(`  ${failure.index}. ${failure.message}`)
      console.error(`     ${failure.statement.replace(/\s+/g, ' ').slice(0, 140)}`)
    }
    process.exitCode = 1
    return
  }

  // التسجيل في السجل حتى لا يعيد wrangler التطبيق
  await query(
    token,
    `INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES ('${fileName.replace(/'/g, "''")}', CURRENT_TIMESTAMP)`,
  )

  console.log(`\nنجح: ${ok}/${statements.length} تعليمة، وسُجّل الملف في d1_migrations.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
