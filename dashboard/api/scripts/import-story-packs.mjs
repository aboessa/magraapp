import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')
const args = new Set(process.argv.slice(2))
const remote = args.has('--remote')
const confirmProduction = args.has('--confirm-production=majarra-api-prod')
const dryRun = args.has('--dry-run') || !remote
const target = remote ? '--remote' : '--local'

if (remote && !confirmProduction) {
  throw new Error('Production is locked. Use --remote --confirm-production=majarra-api-prod after approval.')
}

const packs = [
  ['act-s1', 'story-bird-home', 'bird-home', 'بيت الطائر', 'series-preschool-calm-tale', 3, 5, 'picture_book'],
  ['act-s4', 'story-warm-hugs', 'warm-hugs', 'أحضان الدفء', 'series-preschool-calm-tale', 3, 5, 'picture_book'],
  ['bs-s1', 'story-ant-journey', 'ant-journey', 'رحلة النملة', 'series-kids-bedtime', 6, 8, 'picture_book'],
  ['bs-s2', 'story-garden-secret', 'garden-secret', 'سر الحدائق', 'series-kids-bedtime', 6, 8, 'picture_book'],
  ['bs-s3', 'story-new-friend', 'new-friend', 'صديق جديد', 'series-kids-bedtime', 6, 8, 'picture_book'],
  ['bs-s4', 'story-rainy-night', 'rainy-night', 'ليلة المطر', 'series-kids-bedtime', 6, 8, 'picture_book'],
  ['bs-s5', 'story-old-lantern', 'old-lantern', 'الفانوس القديم', 'series-kids-bedtime', 6, 8, 'picture_book'],
  ['bs-s6', 'story-lost-star', 'lost-star', 'نجمة تائهة', 'series-kids-bedtime', 6, 8, 'picture_book'],
  ['qml-the-promised-friday', 'story-promised-friday', 'the-promised-friday', 'الجمعة الموعودة', 'series-qisas-min-alhayat', 9, 12, 'picture_book'],
  ['qml-nine-metres', 'story-nine-metres', 'nine-metres', 'تسعة أمتار', 'series-qisas-min-alhayat', 9, 12, 'picture_book'],
  ['qml-taller-than-me', 'story-taller-than-me', 'taller-than-me', 'أطول مني', 'series-qisas-min-alhayat', 9, 12, 'picture_book'],
  ['qml-the-key-that-was-left', 'story-key-left', 'key-left', 'المفتاح الذي بقي', 'series-qisas-min-alhayat', 9, 12, 'picture_book'],
  ['qml-the-extra-page', 'story-extra-page', 'extra-page', 'الورقة الزائدة', 'series-qisas-min-alhayat', 9, 12, 'picture_book'],
].map(([pack, id, slug, title, seriesId, ageMin, ageMax, type]) => ({ pack, id, slug, title, seriesId, ageMin, ageMax, type }))

const onlyArg = process.argv.find((value) => value.startsWith('--only='))?.slice('--only='.length)
const selected = onlyArg ? packs.filter((pack) => onlyArg.split(',').includes(pack.pack)) : packs
if (onlyArg && !selected.length) throw new Error(`--only=${onlyArg} matched no pack`)

const sql = (value) => value == null ? 'NULL' : typeof value === 'number' ? String(value) : `'${String(value).replaceAll("'", "''")}'`
const stableId = (prefix, value) => `${prefix}-${createHash('sha256').update(value).digest('hex').slice(0, 24)}`
const mimeFor = (file) => file.endsWith('.m4a') ? 'audio/mp4' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg'

function run(commandArgs, quiet = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrangler, remote ? [...commandArgs, '--env=production'] : commandArgs, {
      cwd: apiDir, env: { ...process.env, CI: 'true' }, shell: process.platform === 'win32', stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
    })
    let stderr = ''
    if (quiet) child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr || `wrangler exited ${code}`)))
  })
}

function capture(commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrangler, remote ? [...commandArgs, '--env=production'] : commandArgs, {
      cwd: apiDir, env: { ...process.env, CI: 'true' }, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr || `wrangler exited ${code}`)))
  })
}

async function fileRecord(absolute, r2Key, bucket, kind, visibility) {
  const [data, stat] = await Promise.all([fs.readFile(absolute), fs.stat(absolute)])
  return { absolute, r2Key, bucket, kind, visibility, size: stat.size, checksum: createHash('sha256').update(data).digest('hex'), mime: mimeFor(absolute), id: stableId('asset-story-pack', r2Key) }
}

async function collectPack(pack) {
  const bundlePath = path.join(rootDir, 'app_main', 'assets', 'data', 'bundled_stories', `${pack.id}.json`)
  const bundle = JSON.parse(await fs.readFile(bundlePath, 'utf8'))
  if (!Array.isArray(bundle.data) || !bundle.data.length) throw new Error(`${pack.id}: missing bundled page data`)
  const imagesDir = path.join(rootDir, 'app_main', 'assets', 'images', 'stories', `${pack.pack}-playveo`)
  const audioDir = path.join(rootDir, 'assets', 'audio', 'stories', pack.pack, 'ar')
  const records = []
  const pageRecords = []
  for (const page of bundle.data) {
    const number = Number(page.page_number)
    const stem = `page-${String(number).padStart(3, '0')}`
    const image = await fileRecord(path.join(imagesDir, `${stem}.webp`), `public/catalog/stories/${pack.pack}/${stem}.webp`, 'thumbs', 'image', 'public')
    const audio = await fileRecord(path.join(audioDir, `${stem}-ar.m4a`), `private/stories/${pack.pack}/ar/${stem}-ar.m4a`, 'media', 'audio', 'private')
    records.push(image, audio)
    pageRecords.push({ ...page, number, image, audio, id: `${pack.id}-${String(number).padStart(3, '0')}` })
  }
  const cover = await fileRecord(path.join(imagesDir, 'cover.webp'), `public/catalog/stories/${pack.pack}/cover.webp`, 'thumbs', 'image', 'public')
  records.push(cover)
  return { ...pack, pages: pageRecords, records, cover }
}

function assetSql(record, title) {
  return `INSERT INTO content_assets (id,title_ar,kind,source,status,original_filename,expected_path,r2_key,bucket,mime_type,size_bytes,checksum_sha256,visibility,quality,metadata,uploaded_by,updated_at)
VALUES (${sql(record.id)},${sql(title)},${sql(record.kind)},'generated','ready',${sql(path.basename(record.absolute))},${sql(`story-packs/${record.r2Key}`)},${sql(record.r2Key)},${sql(record.bucket)},${sql(record.mime)},${sql(record.size)},${sql(record.checksum)},${sql(record.visibility)},'approved',${sql(JSON.stringify({ imported_from: path.relative(rootDir, record.absolute).replaceAll('\\', '/') }))},'story-pack-import',datetime('now'))
ON CONFLICT(id) DO UPDATE SET status='ready',r2_key=excluded.r2_key,bucket=excluded.bucket,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes,checksum_sha256=excluded.checksum_sha256,visibility=excluded.visibility,updated_at=datetime('now');`
}

async function main() {
  const collected = await Promise.all(selected.map(collectPack))
  const allRecords = collected.flatMap((pack) => pack.records)
  const pages = collected.reduce((total, pack) => total + pack.pages.length, 0)
  console.log(`Validated ${collected.length} story packs: ${pages} pages, ${allRecords.filter((item) => item.kind === 'image').length} images, ${allRecords.filter((item) => item.kind === 'audio').length} private narration tracks.`)
  if (dryRun) return

  for (const record of allRecords) {
    await run(['r2', 'object', 'put', `${record.bucket === 'thumbs' ? 'majarra-thumbs' : 'majarra-media'}/${record.r2Key}`, `--file=${record.absolute}`, `--content-type=${record.mime}`, `--cache-control=${record.visibility === 'public' ? 'public,max-age=31536000,immutable' : 'private,no-store'}`, target, '--force'], true)
  }

  const statements = ['PRAGMA foreign_keys = ON;']
  // Assets must exist before any page or localization references them.
  for (const pack of collected) {
    for (const record of pack.records) statements.push(assetSql(record, pack.title))
  }
  for (const pack of collected) {
    statements.push(`INSERT INTO stories (id,series_id,slug,title_ar,type,age_min,age_max,reading_level,interaction_mode,supervision_level,default_language,languages,status,is_free,price_tier,sort_order,published_at,updated_at)
VALUES (${sql(pack.id)},${sql(pack.seriesId)},${sql(pack.slug)},${sql(pack.title)},${sql(pack.type)},${pack.ageMin},${pack.ageMax},'emerging','guided','recommended','ar','["ar"]','published',1,'family',0,datetime('now'),datetime('now'))
ON CONFLICT(id) DO UPDATE SET status='published',published_at=COALESCE(stories.published_at,datetime('now')),updated_at=datetime('now');`)
    statements.push(`INSERT INTO asset_links (id,asset_id,entity_type,entity_id,role,language,sort_order) VALUES (${sql(stableId('story-link', `${pack.id}|cover`))},${sql(pack.cover.id)},'story',${sql(pack.id)},'cover','',0) ON CONFLICT(id) DO UPDATE SET asset_id=excluded.asset_id;`)
    for (const page of pack.pages) {
      statements.push(`INSERT INTO story_pages (id,story_id,page_number,layout,image_asset_id,duration_ms,dwell_ms,transition,sort_order,updated_at) VALUES (${sql(page.id)},${sql(pack.id)},${page.number},${sql(page.layout ?? 'full_bleed')},${sql(page.image.id)},${Number(page.duration_ms) || 8000},${Number(page.dwell_ms) || 1000},${sql(page.transition ?? 'fade')},${page.number},datetime('now')) ON CONFLICT(story_id,page_number) DO UPDATE SET image_asset_id=excluded.image_asset_id,layout=excluded.layout,duration_ms=excluded.duration_ms,dwell_ms=excluded.dwell_ms,transition=excluded.transition,updated_at=datetime('now');`)
      // page_id is resolved from the table rather than assumed: several of these
      // stories already had pages with their own identifiers, and referencing a
      // minted id is what failed the foreign key on the first attempt.
      statements.push(`INSERT INTO story_page_localizations (page_id,language,body_text,alt_text,narration_asset_id,timing_cues,updated_at)
SELECT sp.id,'ar',${sql(page.body_text ?? '')},${sql(page.alt_text)},${sql(page.audio.id)},${sql(JSON.stringify(page.timing_cues ?? []))},datetime('now')
  FROM story_pages sp WHERE sp.story_id = ${sql(pack.id)} AND sp.page_number = ${page.number}
ON CONFLICT(page_id,language) DO UPDATE SET body_text=excluded.body_text,alt_text=excluded.alt_text,narration_asset_id=excluded.narration_asset_id,timing_cues=excluded.timing_cues,updated_at=datetime('now');`)
    }
  }
  statements.push(`INSERT INTO audit_logs (id,actor_id,action,entity_type,entity_id,details) VALUES (${sql(randomUUID())},'story-pack-import','bulk_import','story','story-packs',${sql(JSON.stringify({ packs: collected.map((pack) => pack.id), pages, assets: allRecords.length }))});`)
  const file = path.join(apiDir, '.tmp', 'import-story-packs.sql')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, statements.join('\n'), 'utf8')
  try { await run(['d1', 'execute', 'majarra-db', target, `--file=${file}`]) } finally { await fs.rm(file, { force: true }) }
  console.log(`Imported ${collected.length} packs into ${remote ? 'production' : 'local'} D1/R2.`)
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
