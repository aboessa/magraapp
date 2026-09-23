#!/usr/bin/env node
// قياس الأصول المُبندَلة فعلًا مقابل الموجودة على القرص (`PERF-101`).
//
// الفرق الذي يجعل هذا القياس ممكنًا: إعلان مجلد في `pubspec.yaml` **غير
// تعاودي** — `assets/images/studio/` يُبندل ملفات المجلد نفسه لا ما في
// `studio/v2/`. وسياسة المشروع تعتمد على ذلك صراحةً (التعليق في `pubspec.yaml`:
// «إعلان المجلد غير تعاودي في Flutter، فلن يجرّ studio/v2/»). فالمسح التعاودي
// الساذج يبالغ في التقدير، وقياس «حجم الشجرة» ليس قياس حجم الحزمة.
//
// الاستعمال:
//   node tools/ci/assets-declared.mjs [--check] [--json]
//
// يطبع: المُعلَن (عددًا وحجمًا) · غير المُعلَن (عددًا وحجمًا، وأكبر المجلدات) ·
// والمُعلَن المفقود (إعلانٌ لا يقابله ملف — يُفشل البناء عند `--check`).

import { readFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

const appRoot = 'app_main';
const pubspec = join(appRoot, 'pubspec.yaml');

/** يقرأ قائمة `assets:` من `flutter:` ويتجاهل التعليقات والمُعلَّق منها. */
function declaredEntries() {
  const lines = readFileSync(pubspec, 'utf8').split(/\r?\n/);
  const start = lines.findIndex((l) => /^\s{2}assets:\s*$/.test(l));
  if (start < 0) throw new Error('لم يُعثَر على قائمة assets في pubspec.yaml');
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    // نهاية القائمة: أول سطر بمستوى مفتاح آخر (مسافتان) غير عنصر قائمة.
    if (/^\s{0,2}\S/.test(line) && !/^\s*-\s/.test(line)) break;
    const m = line.match(/^\s*-\s+(\S+)\s*$/);
    if (!m) continue; // تعليق أو عنصر معلَّق (`#- ...`)
    out.push(m[1]);
  }
  return out;
}

/** يوسّع إعلانًا إلى مجموعة مسارات فعلية، بقاعدة «المجلد غير تعاودي». */
function expand(entry) {
  const abs = join(appRoot, entry);
  if (entry.endsWith('/')) {
    if (!existsSync(abs)) return { files: [], missing: entry };
    const files = readdirSync(abs, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => posix.join(entry, d.name));
    return { files, missing: null };
  }
  if (!existsSync(abs)) return { files: [], missing: entry };
  return { files: [entry], missing: null };
}

function walk(dir) {
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name);
    if (d.isDirectory()) out.push(...walk(p));
    else if (d.isFile()) out.push(p);
  }
  return out;
}

const mb = (bytes) => (bytes / 1048576).toFixed(2);

const entries = declaredEntries();
const declared = new Set();
const missingDeclarations = [];
for (const entry of entries) {
  const { files, missing } = expand(entry);
  if (missing) missingDeclarations.push(missing);
  for (const f of files) declared.add(f);
}

const present = walk(join(appRoot, 'assets')).map((p) =>
  relative(appRoot, p).split(sep).join('/'),
);

let bundledBytes = 0;
const undeclared = [];
let undeclaredBytes = 0;
for (const rel of present) {
  const size = statSync(join(appRoot, rel)).size;
  if (declared.has(rel)) bundledBytes += size;
  else {
    undeclared.push({ rel, size });
    undeclaredBytes += size;
  }
}

// أكبر المجلدات غير المُعلَنة، لأن «231 ملفًا يتيمًا» لا يقول أين العمل.
const byDir = new Map();
for (const { rel, size } of undeclared) {
  const dir = rel.slice(0, rel.lastIndexOf('/'));
  const cur = byDir.get(dir) ?? { count: 0, bytes: 0 };
  cur.count++;
  cur.bytes += size;
  byDir.set(dir, cur);
}
const topDirs = [...byDir.entries()]
  .sort((a, b) => b[1].bytes - a[1].bytes)
  .slice(0, 15);

const report = {
  declaredEntries: entries.length,
  bundledFiles: declared.size,
  bundledMB: Number(mb(bundledBytes)),
  undeclaredFiles: undeclared.length,
  undeclaredMB: Number(mb(undeclaredBytes)),
  missingDeclarations,
  topUndeclaredDirs: topDirs.map(([dir, v]) => ({
    dir,
    files: v.count,
    mb: Number(mb(v.bytes)),
  })),
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`إعلانات: ${report.declaredEntries}`);
  console.log(
    `مُبندَل فعلًا: ${report.bundledFiles} ملفًا · ${report.bundledMB} MB`,
  );
  console.log(
    `غير مُعلَن على القرص: ${report.undeclaredFiles} ملفًا · ${report.undeclaredMB} MB`,
  );
  if (missingDeclarations.length) {
    console.log(`إعلانات بلا ملفات: ${missingDeclarations.join(', ')}`);
  }
  console.log('\nأكبر المجلدات غير المُعلَنة:');
  for (const d of report.topUndeclaredDirs) {
    console.log(`  ${d.mb.toString().padStart(8)} MB  ${d.files
      .toString()
      .padStart(4)} ملفًا  ${d.dir}`);
  }
}

/// كل مسار `assets/...` مكتوب في `lib/` يجب أن يكون مُبندَلًا فعلًا.
///
/// هذا هو العطل الذي كشفه `PERF-101`: ملفّان في `core/media` كانا يحلّان مسارات
/// `assets/images/stories/...` و`assets/data/bundled_stories/...` — وكلاهما
/// **غير مُعلَن في pubspec بقرار مكتوب**، فما كان يمكن أن يوجد في الحزمة أصلًا.
/// ولا شيء ينبّه: الكود يترجم، والتحليل نظيف، والفشل وقتَ تشغيلٍ على جهاز طفل.
///
/// المسارات المُركَّبة (`'assets/data/x/$id.json'`) لا تُحلّ نصًّا، فيُفحَص
/// **مجلدها**: مجلدٌ غير مُعلَن لا يُبندل منه شيء، وهو الحكم الصادق المتاح.
/// دوالُّ تشتقّ رابط CDN من مسارٍ مبندل. وسيطُها **مفتاح اشتقاق لا مسار تحميل**.
///
/// ترحيل R2 (‏`heavy_assets.dart`‏) نقل 135 ملفًّا raster إلى الـCDN وأبقى
/// توأمًا WebP مبندلًا باسمٍ مختلف الامتداد. فصار المسار الحرفيّ `...png` في
/// `lib/` يؤدّي دورًا ثانيًا لم يكن موجودًا يوم كُتب هذا الفحص: مفتاحٌ يُشتقّ منه
/// الرابط، بينما المرسوم فعلًا هو `...webp`.
const CDN_KEY_HELPERS = /(?:heavyCdnUrl|heavyStudioBannerUrl)\(\s*$|(?:heavyCdnUrl|heavyStudioBannerUrl)\(\s*'/;

/// البادئات التي رُحِّلت إلى R2، **مقروءةً من سجلّ الترحيل نفسه**.
///
/// لا تُكرَّر القائمة هنا: مصدرها `_migratedPrefixes` في
/// `lib/core/images/heavy_assets.dart`، فبادئةٌ تُضاف هناك تُعرَف هنا بلا تعديل،
/// وبادئةٌ تُحذَف تعود تحت الحرس تلقائيًّا. وقائمةٌ ثانية كانت ستفترق عن الأولى
/// أوّل مرّة يُرحَّل مجلّد.
///
/// و`assets/avatars/` تُضاف صراحةً لأنها رُفعت بسكربتٍ مستقلّ
/// (`tools/upload_avatars_r2.mjs`) ولم تدخل قائمة `heavy_assets.dart`؛ والقرار
/// موثَّق في `pubspec.yaml` عند إعلان الأڤاتار: ملفٌ واحد مبندل من 67 والباقي من
/// R2 عبر `RemoteImageCache`.
function migratedPrefixes() {
  const registry = join(appRoot, 'lib', 'core', 'images', 'heavy_assets.dart');
  const prefixes = new Set(['assets/avatars/']);
  let source;
  try {
    source = readFileSync(registry, 'utf8');
  } catch {
    // السجلّ غائب: لا إعفاء. الحرس يعود إلى سلوكه قبل الترحيل بدل أن يُعفي الكل.
    return prefixes;
  }
  const block = source.slice(source.indexOf('_migratedPrefixes'));
  const end = block.indexOf('];');
  for (const m of block.slice(0, end === -1 ? undefined : end).matchAll(/'(assets\/[^']*\/)'/g)) {
    prefixes.add(m[1]);
  }
  return prefixes;
}

/// هل المسار تحت بادئةٍ مُرحَّلة؟ فإن كان، فالـCDN مصدره، وأيّ توأمٍ مبندل قرارُ
/// منتَجٍ مُسجَّل في `pubspec.yaml` لا شأن لهذه البوابة به.
function underMigratedPrefix(path, prefixes) {
  for (const prefix of prefixes) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

/// نافذة البحث عن `networkUrl:` حول المسار، بالأسطر.
///
/// بانيات الـwidgets متعدّدة الأسطر، فـ`assetPath:` و`networkUrl:` يقعان على
/// سطرين متجاورين لا سطرٍ واحد (`child_avatars.dart:245-246`،
/// `home_feed.dart:672-675`). والنافذة **ضيّقة بقصد**: انحيازها الوحيد أنها قد
/// تُغفل مسارًا وحيد-المصدر مجاورًا لصورةٍ شبكية أخرى، وهو انحياز في اتجاه
/// «أبلِغ أكثر» لا «أخفِ».
const NETWORK_SOURCE_WINDOW = 4;

/// هل هذا المسار **رُتبةَ احتياطٍ** لصورةٍ مصدرها الأوّل الشبكة؟
///
/// `CinematicImage` ترتيب مصادرها: ملفٌ مُخزَّن ← شبكة ← `assetPath` المبندل.
/// فمسارٌ يُمرَّر مع `networkUrl:` ليس وعدًا وحيدًا بل الرُّتبة الأخيرة، وقرارُ
/// بندلته مُسجَّل في `pubspec.yaml` (مثال: أڤاتار واحد مبندل من 67، والباقي من
/// R2 عبر `RemoteImageCache` — انظر التعليق عند `assets/avatars/`). وهذا قرار
/// منتَج لا شأن لهذه البوابة به.
///
/// والذي تحرسه البوابة يبقى كما وُجد (`PERF-101`): مسارٌ هو **المصدر الوحيد**
/// ولا ملف له.
function hasNetworkSibling(lines, index) {
  const from = Math.max(0, index - NETWORK_SOURCE_WINDOW);
  const to = Math.min(lines.length, index + NETWORK_SOURCE_WINDOW + 1);
  for (let i = from; i < to; i += 1) {
    if (/networkUrl:/.test(lines[i])) return true;
  }
  return false;
}

function unbundledReferences(declaredSet, declaredDirs) {
  const libFiles = walk(join(appRoot, 'lib')).filter((p) => p.endsWith('.dart'));
  const migrated = migratedPrefixes();
  const bad = [];
  for (const file of libFiles) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    // سجلّ الترحيل نفسه: بادئاتُه وأسماء لافتاته **بيانات** يُشتقّ منها، ولا
    // يُحمَّل منها شيء. الملف هو تعريف القاعدة، فمحاكمته بها دور.
    const isMigrationRegistry = file.split(sep).join('/').endsWith('lib/core/images/heavy_assets.dart');
    lines.forEach((line, i) => {
      if (line.trimStart().startsWith('///') || line.trimStart().startsWith('//')) {
        return; // تعليق: لا يُحمَّل منه أصل
      }
      for (const m of line.matchAll(/'(assets\/[^']*)'/g)) {
        const raw = m[1];
        // `'assets/'` وحدها ليست مسار تحميل بل مقارنةُ بادئة
        // (`path.startsWith('assets/')`)، فلا تُحاكَم كأصل مفقود.
        if (raw === 'assets/') continue;
        if (isMigrationRegistry) continue;
        // مفتاح اشتقاق: `heavyCdnUrl('assets/...png')`.
        const before = line.slice(0, m.index);
        if (CDN_KEY_HELPERS.test(before) || CDN_KEY_HELPERS.test(lines[i - 1] ?? '')) continue;
        if (hasNetworkSibling(lines, i)) continue;
        // تحت بادئةٍ مُرحَّلة: جداول المفاتيح (`creative_remote_assets.dart`،
        // `ChildAvatars.all`، `_fallbackLocal`) تُعلَن في موضعٍ والاشتقاق يقع في
        // آخر، فلا قربٌ نصّيّ يكشفها. والبادئة تكشفها بالتصريح.
        if (underMigratedPrefix(raw, migrated)) continue;
        const interpolated = raw.includes('$');
        const rel = interpolated
          ? raw.slice(0, raw.lastIndexOf('/', raw.indexOf('$')) + 1)
          : raw;
        const ok = interpolated
          ? declaredDirs.has(rel)
          : declaredSet.has(rel) || declaredDirs.has(rel.slice(0, rel.lastIndexOf('/') + 1));
        if (!ok) {
          bad.push({
            file: relative(appRoot, file).split(sep).join('/'),
            line: i + 1,
            path: raw,
          });
        }
      }
    });
  }
  return bad;
}

let failed = false;

if (process.argv.includes('--check')) {
  const declaredDirs = new Set(entries.filter((e) => e.endsWith('/')));
  const dangling = unbundledReferences(declared, declaredDirs);
  if (dangling.length) {
    console.error('\nمسارات أصول في lib/ ليست مُبندَلة (ستفشل وقت التشغيل):');
    for (const d of dangling) {
      console.error(`  ${d.file}:${d.line} → ${d.path}`);
    }
    failed = true;
  }

  if (missingDeclarations.length) {
    console.error(
      `\nإعلان أصول لا يقابله ملف (سيفشل بناء Flutter): ${missingDeclarations.join(', ')}`,
    );
    failed = true;
  }

  // الحدّ **مقيسٌ** لا مُختار: 116.12 MB هي حِمل اليوم الفعلي (2026-08-29).
  // والهامش صغير مقصودًا — الغرض ليس نحت كيلوبايتات بل رصد ما يُقفز بالحِمل
  // مئاتَ الميغابايتات: إعلانُ مجلدٍ بالخطأ (`assets/images/stories/` وحدها
  // 242 MB على القرص غير مُعلَنة). حدٌّ فضفاض لا يرصد ذلك، وحدٌّ ملتصق يفشل
  // على إضافة أيقونة.
  // قابل للتجاوز بـ`--max-mb=` ليُمكن **رؤية الحرس يفشل** بلا تعديل الأداة.
  // حرسٌ لم أرَه يفشل ليس حرسًا.
  const flag = process.argv.find((a) => a.startsWith('--max-mb='));
  const ceilingMB = flag ? Number(flag.split('=')[1]) : 125;
  if (report.bundledMB > ceilingMB) {
    console.error(
      `\nحِمل الأصول المُبندَلة ${report.bundledMB} MB تجاوز الحدّ المعلَن ` +
        `${ceilingMB} MB. إن كانت الزيادة مقصودة فارفع الحدّ **بقياس** ووثّق سببه.`,
    );
    failed = true;
  }
}

if (failed) process.exit(1);
