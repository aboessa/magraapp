/**
 * بروفة migrations على نسخة من بيانات الإنتاج.
 *
 * ## لماذا
 *
 * تطبيق migrations واحدة واحدة على الإنتاج يكشف عيبًا واحدًا في كل مرة، وكل محاولة
 * فاشلة تترك القاعدة الحيّة في حالة وسيطة. حدث ذلك فعلًا: 0024 سقط بـFOREIGN KEY
 * لأنّ `game-yt-pinch-place` غير موجود في الإنتاج، فتوقّف كل ما بعده.
 *
 * هذا السكربت يُحمّل نسخة الإنتاج الاحتياطية في قاعدة SQLite محلية، ثم يُطبّق
 * الـmigrations المطلوبة بالترتيب، فتظهر كل الأعطال في تشغيل واحد قبل لمس الإنتاج.
 *
 * ## شرطان يجعلان البروفة صادقة
 *
 * ١. `PRAGMA foreign_keys = ON`. الافتراضي في SQLite هو OFF، أمّا D1 فيُفعّلها —
 *    وهي بالضبط ما أسقط 0024. بروفة بلا هذا السطر كانت ستنجح وتكذب.
 * ٢. البيانات نسخة الإنتاج لا قاعدة التطوير. العيب كان في *غياب* صفّ موجود محليًّا،
 *    فبروفة على قاعدة التطوير ما كانت لترصده.
 *
 * Usage:
 *   node scripts/rehearse-migrations.mjs --backup <file.sql> --from 0024 [--to 0034]
 */

import { DatabaseSync } from 'node:sqlite'
import { readFileSync, readdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(here, '..', 'migrations')

const argValue = (flag, fallback) => {
  const index = process.argv.indexOf(flag)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const backupPath = argValue('--backup', '')
/// كل ما ليس في `d1_migrations` يُطبَّق — بلا نافذة اختيارية.
///
/// كان هنا `--from` يُرشّح بـ`name >= from`، فتشغيل `--from 0024` تخطّى 0022 و0023.
/// وهما يُنشئان `learning_objective_skills` وصفوف المهارات التي يُشير إليها 0026،
/// فسقط 0026 بـ`FOREIGN KEY constraint failed` في البروفة بينما هو سليم. أي بروفة
/// تتخطّى مُتطلّبًا تُنتج فشلًا مُصطنعًا وتُرسل المُشخِّص إلى الملفّ الخطأ — وقد
/// فعلت ذلك هنا وأهدرت إصلاحًا كاملًا على تشخيص خاطئ.
///
/// المعيار الصحيح هو ما يفعله `wrangler d1 migrations apply` بالحرف: كل المعلَّق
/// بالترتيب. فلا مجال لانحراف بين البروفة والتطبيق.
const to = argValue('--to', '9999')

if (!backupPath) {
  console.error('pass --backup <production export .sql>')
  process.exit(1)
}

const scratch = join(here, '..', '.tmp', `rehearsal-${Date.now()}.sqlite`)
if (existsSync(scratch)) rmSync(scratch)

const db = new DatabaseSync(scratch)

// الترتيب مقصود: تُحمَّل البيانات بلا قيود مراجع، لأنّ ملفّ التصدير يُدرج الجداول
// بترتيب أبجدي لا بترتيب التبعية، فصفّ ابن قد يُدرج قبل أبيه. ثم تُفعَّل القيود
// قبل الـmigrations، وهي المرحلة التي نريد اختبارها فعلًا.
db.exec('PRAGMA foreign_keys = OFF');

console.log(`loading production snapshot: ${backupPath}`)
const dump = readFileSync(backupPath, 'utf8')
try {
  db.exec(dump)
} catch (error) {
  console.error(`snapshot failed to load: ${error.message}`)
  process.exit(1)
}

const count = (sql) => {
  try { return db.prepare(sql).get()?.n ?? 0 } catch { return 'n/a' }
}

console.log(`  planets=${count('SELECT COUNT(*) AS n FROM planets')}`
  + ` series=${count('SELECT COUNT(*) AS n FROM series')}`
  + ` episodes=${count('SELECT COUNT(*) AS n FROM episodes')}`
  + ` games=${count('SELECT COUNT(*) AS n FROM games')}`)

// القيود تُفعَّل الآن، فما بعدها يُقاس بمعيار D1 نفسه.
db.exec('PRAGMA foreign_keys = ON')

const applied = new Set(
  db.prepare('SELECT name FROM d1_migrations').all().map((row) => row.name),
)
console.log(`  already applied in snapshot: ${applied.size}`)

const pending = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .filter((name) => !applied.has(name))
  .filter((name) => name <= `${to}\uffff`)
  .sort()

console.log(`\nrehearsing ${pending.length} pending migrations\n`)

let failed = 0
for (const name of pending) {
  const sql = readFileSync(join(migrationsDir, name), 'utf8')
  try {
    db.exec('BEGIN')
    db.exec(sql)
    db.prepare('INSERT INTO d1_migrations (name, applied_at) VALUES (?, datetime(\'now\'))').run(name)
    db.exec('COMMIT')
    console.log(`PASS  ${name}`)
  } catch (error) {
    try { db.exec('ROLLBACK') } catch { /* الصفقة سقطت أصلًا */ }
    failed += 1
    console.log(`FAIL  ${name}`)
    console.log(`      ${error.message}`)
  }
}

// فحص سلامة القيود بعد كل شيء: migration قد ينجح ويترك مرجعًا معلَّقًا.
const violations = db.prepare('PRAGMA foreign_key_check').all()
const integrity = db.prepare('PRAGMA integrity_check').get()

console.log(`\nforeign key violations after all migrations: ${violations.length}`)
for (const row of violations.slice(0, 10)) {
  console.log(`  ${row.table} -> ${row.parent} (rowid ${row.rowid})`)
}
console.log(`integrity_check: ${Object.values(integrity)[0]}`)

console.log(`\nafter: planets=${count('SELECT COUNT(*) AS n FROM planets')}`
  + ` series=${count('SELECT COUNT(*) AS n FROM series')}`
  + ` episodes=${count('SELECT COUNT(*) AS n FROM episodes')}`
  + ` games=${count('SELECT COUNT(*) AS n FROM games')}`)

// الجداول التي يحتاجها كود مساحة عمل الكوكب. غيابها هو سبب هذه العملية كلها.
for (const table of ['production_requirements', 'content_availability', 'game_localizations']) {
  const exists = count(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='${table}'`)
  console.log(`${exists === 1 ? 'EXISTS ' : 'MISSING'}  ${table}`)
}

db.close()
rmSync(scratch, { force: true })

console.log(`\n${pending.length - failed} passed, ${failed} failed`)
process.exitCode = failed || violations.length ? 1 : 0
