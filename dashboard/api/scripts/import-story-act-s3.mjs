// Imports reviewed ACT-S3 artwork and Arabic narration into R2/D1.
// Images are public catalogue assets; paid narration remains private media.
// The script is idempotent and always leaves the story ready, never published.
//
// Usage:
//   node scripts/import-story-act-s3.mjs --dry-run
//   node scripts/import-story-act-s3.mjs
//   node scripts/import-story-act-s3.mjs --remote --confirm-production

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')

const rawArgs = process.argv.slice(2)
const allowedArgs = new Set(['--remote', '--confirm-production', '--dry-run'])
const unknownArgs = rawArgs.filter((value) => !allowedArgs.has(value))
if (unknownArgs.length) throw new Error(`unknown option(s): ${unknownArgs.join(', ')}`)

const args = new Set(rawArgs)
const isRemote = args.has('--remote')
const dryRun = args.has('--dry-run')
if (args.has('--confirm-production') && !isRemote) {
  throw new Error('--confirm-production is valid only with --remote')
}
if (isRemote && !args.has('--confirm-production')) {
  throw new Error('remote import requires --remote --confirm-production')
}
const targetFlag = isRemote ? '--remote' : '--local'
const envFlags = isRemote ? ['--env', 'production'] : []

const STORY_ID = 'story-moon-sleeps'
const STORY_SLUG = 'moon-sleeps'
const SERIES_ID = 'series-preschool-calm-tale'
const IMAGE_SOURCE_DIR = 'app_main/assets/images/stories/act-s3-playveo'
const IMAGE_PUBLIC_DIR = 'assets/images/stories/act-s3-playveo'
const AUDIO_DIR = 'assets/audio/stories/act-s3/ar'

const PAGES = [
  {
    page: 1,
    transition: 'kenburns_slow',
    dwellMs: 12900,
    text: 'هذا آدم. لا يريد أن ينام.',
    alt: 'آدم ذو الأربع سنوات يجلس في سريره بعينين مفتوحتين قرب نافذة ومصباح دافئ.',
  },
  {
    page: 2,
    transition: 'kenburns_slow',
    dwellMs: 13200,
    text: 'جلس أبوه معه عند النافذة.',
    alt: 'أبو آدم يجلس معه على حافة السرير، والقمر الطبيعي ظاهر كاملًا في النافذة.',
  },
  {
    page: 3,
    transition: 'pan_slow',
    dwellMs: 14400,
    text: 'قال آدم: القمر مستيقظ أيضًا.',
    alt: 'آدم يشير بهدوء إلى القمر الطبيعي بلا وجه، وأبوه حاضر بجانبه.',
  },
  {
    page: 4,
    transition: 'pan_slow',
    dwellMs: 16000,
    text: 'مرّت سحابة. فغطّت القمر قليلًا.',
    alt: 'سحابة زرقاء رقيقة تغطي جزءًا صغيرًا من القمر، ومعظم قرصه ما زال ظاهرًا لآدم وأبيه.',
  },
  {
    page: 5,
    transition: 'kenburns_slow',
    dwellMs: 17300,
    text: 'ثم مضت. والقمر ما زال هناك.',
    alt: 'السحابة مضت والقمر ظاهر كاملًا في النافذة، وآدم يسترخي وأبوه بجانبه.',
  },
  {
    page: 6,
    transition: 'kenburns_slow',
    dwellMs: 17000,
    text: 'قال أبوه: كأنّ القمر ينام.',
    alt: 'أبو آدم يتحدث بلطف بينما آدم مستلقٍ، والقمر الطبيعي ظاهر بلا وجه في النافذة.',
  },
  {
    page: 7,
    transition: 'static',
    dwellMs: 14600,
    text: 'فأغمض آدم عينيه. والغرفة هادئة.',
    alt: 'آدم مغمض العينين في سريره وأبوه يطمئنه، والقمر ظاهر في النافذة والغرفة هادئة.',
  },
  {
    page: 8,
    transition: 'static',
    dwellMs: 14600,
    text: 'والقمر يبدو ساكنًا في السماء.',
    alt: 'آدم نائم وأبوه جالس قربه، والقمر الطبيعي يبدو ساكنًا في نافذة الغرفة الهادئة.',
  },
]

const COVER_ASSETS = [
  { file: 'cover.webp', role: 'cover', aspect: '1:1', title: 'غلاف القمر ينام' },
  { file: 'hero.webp', role: 'hero', aspect: '16:9', title: 'صورة رئيسية للقمر ينام' },
  { file: 'thumb.webp', role: 'thumbnail', aspect: '3:4', title: 'مصغرة القمر ينام' },
]

const MIME = { '.webp': 'image/webp', '.wav': 'audio/wav' }

function contentAddressedKey(prefix, relativePath, checksum) {
  const extension = path.extname(relativePath)
  const stem = relativePath.slice(0, -extension.length)
  return `${prefix}/${stem}.${checksum.slice(0, 16)}${extension}`
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function run(argv, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(wrangler, argv, {
      cwd: apiDir,
      stdio: options.quiet ? 'pipe' : 'inherit',
      shell: process.platform === 'win32',
    })
    let stderr = ''
    if (options.quiet) child.stderr?.on('data', (chunk) => { stderr += chunk })
    child.on('error', reject)
    child.on('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`wrangler command exited ${code}${stderr ? `: ${stderr.slice(0, 400)}` : ''}`)))
  })
}

function wavDurationMs(buffer) {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null
  let offset = 12
  let byteRate = 0
  let dataSize = 0
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4)
    const size = buffer.readUInt32LE(offset + 4)
    const body = offset + 8
    if (id === 'fmt ') byteRate = buffer.readUInt32LE(body + 8)
    if (id === 'data') dataSize = Math.min(size, buffer.length - body)
    offset = body + size + (size % 2)
  }
  return byteRate && dataSize ? Math.round((dataSize / byteRate) * 1000) : null
}

async function readRecord({ sourcePath, publicPath = sourcePath, ...details }) {
  const absolute = path.join(rootDir, sourcePath)
  const data = await fs.readFile(absolute)
  const extension = path.extname(sourcePath).toLowerCase()
  return {
    ...details,
    absolute,
    sourcePath,
    publicPath,
    file: path.basename(sourcePath),
    data,
    size: data.length,
    checksum: createHash('sha256').update(data).digest('hex'),
    mime: MIME[extension] ?? 'application/octet-stream',
    durationMs: extension === '.wav' ? wavDurationMs(data) : null,
  }
}

async function main() {
  const records = []

  for (const page of PAGES) {
    const number = String(page.page).padStart(3, '0')
    records.push(await readRecord({
      sourcePath: `${IMAGE_SOURCE_DIR}/page-${number}.webp`,
      publicPath: `${IMAGE_PUBLIC_DIR}/page-${number}.webp`,
      id: `asset-act-s3-page-${number}`,
      kind: 'image',
      title: `القمر ينام — الصفحة ${page.page}`,
      aspect: '16:9',
      language: null,
      page: page.page,
      purpose: 'page-image',
      visibility: 'public',
      bucket: 'thumbs',
    }))
  }

  for (const cover of COVER_ASSETS) {
    records.push(await readRecord({
      sourcePath: `${IMAGE_SOURCE_DIR}/${cover.file}`,
      publicPath: `${IMAGE_PUBLIC_DIR}/${cover.file}`,
      id: `asset-act-s3-${cover.role === 'thumbnail' ? 'thumb' : cover.role}`,
      kind: 'image',
      title: cover.title,
      aspect: cover.aspect,
      language: null,
      page: null,
      purpose: 'cover',
      role: cover.role,
      visibility: 'public',
      bucket: 'thumbs',
    }))
  }

  for (const page of PAGES) {
    const number = String(page.page).padStart(3, '0')
    const record = await readRecord({
      sourcePath: `${AUDIO_DIR}/page-${number}-ar.wav`,
      id: `asset-act-s3-vo-ar-${number}`,
      kind: 'audio',
      title: `سرد القمر ينام — الصفحة ${page.page}`,
      aspect: null,
      language: 'ar',
      page: page.page,
      purpose: 'narration',
      visibility: 'private',
      bucket: 'media',
    })
    if (!record.durationMs) throw new Error(`could not measure duration for ${record.file}`)
    records.push(record)
  }

  for (const record of records) {
    record.r2Key = record.visibility === 'public'
      ? contentAddressedKey('public/catalog', record.publicPath, record.checksum)
      : contentAddressedKey('private/audio/stories/act-s3/ar', record.file, record.checksum)
  }

  const durationSidecar = JSON.parse(await fs.readFile(path.join(rootDir, AUDIO_DIR, '_durations.json'), 'utf8'))
  for (const page of PAGES) {
    const measured = records.find((record) => record.kind === 'audio' && record.page === page.page)?.durationMs
    const sidecar = durationSidecar.pages.find((entry) => entry.page === page.page)?.measuredDurationMs
    if (measured !== sidecar) {
      throw new Error(`page ${page.page}: WAV is ${measured}ms but _durations.json is ${sidecar}ms`)
    }
  }

  console.log(`act-s3: ${records.length} assets (11 images, 8 private Arabic narrations)`)
  console.log(`target: ${isRemote ? 'REMOTE production' : 'local'}`)

  if (dryRun) {
    for (const record of records) {
      console.log(`  ${record.id.padEnd(30)} ${String(record.size).padStart(8)}B ${record.visibility.padEnd(7)} ${record.r2Key}`)
    }
    console.log('\ndry run: nothing written')
    return
  }

  for (const [index, record] of records.entries()) {
    const bucketName = record.bucket === 'thumbs' ? 'majarra-thumbs' : 'majarra-media'
    await run([
      'r2', 'object', 'put', `${bucketName}/${record.r2Key}`,
      `--file=${record.absolute}`,
      `--content-type=${record.mime}`,
      targetFlag,
    ], { quiet: true })
    if ((index + 1) % 5 === 0 || index + 1 === records.length) {
      console.log(`uploaded ${index + 1}/${records.length}`)
    }
  }

  const statements = []
  for (const record of records) {
    const metadata = {
      story: 'act-s3',
      purpose: record.purpose,
      ...(record.page ? { page: record.page } : {}),
      ...(record.durationMs ? { duration_ms: record.durationMs } : {}),
      source_manifest: record.kind === 'audio'
        ? 'tools/tts/act-s3.narration.ar.json'
        : 'tools/playveo/act-s3.manifest.json',
    }
    statements.push(`
INSERT INTO content_assets (
  id, title_ar, kind, source, status, original_filename, expected_path, r2_key, bucket,
  mime_type, size_bytes, checksum_sha256, visibility, language, aspect_ratio, metadata,
  uploaded_by, updated_at
) VALUES (
  ${sql(record.id)}, ${sql(record.title)}, ${sql(record.kind)}, 'generated', 'ready',
  ${sql(record.file)}, ${sql(record.publicPath)}, ${sql(record.r2Key)}, ${sql(record.bucket)},
  ${sql(record.mime)}, ${record.size}, ${sql(record.checksum)}, ${sql(record.visibility)},
  ${sql(record.language)}, ${sql(record.aspect)}, ${sql(JSON.stringify(metadata))},
  'story-import-act-s3', datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  title_ar = excluded.title_ar, status = excluded.status, original_filename = excluded.original_filename,
  expected_path = excluded.expected_path, r2_key = excluded.r2_key, bucket = excluded.bucket,
  mime_type = excluded.mime_type, size_bytes = excluded.size_bytes,
  checksum_sha256 = excluded.checksum_sha256, visibility = excluded.visibility,
  language = excluded.language, aspect_ratio = excluded.aspect_ratio,
  etag = NULL,
  version = CASE
    WHEN content_assets.checksum_sha256 IS NOT excluded.checksum_sha256 THEN content_assets.version + 1
    ELSE content_assets.version
  END,
  metadata = excluded.metadata, updated_at = datetime('now');`)
  }

  statements.push(`
INSERT INTO stories (
  id, series_id, slug, title_ar, description_ar, type, age_min, age_max,
  reading_level, interaction_mode, supervision_level, default_language, languages,
  status, is_free, price_tier, sort_order, updated_at
) VALUES (
  ${sql(STORY_ID)}, ${sql(SERIES_ID)}, ${sql(STORY_SLUG)}, 'القمر ينام',
  'طفل ينظر من نافذته، فيرى القمر يهدأ معه', 'picture_book', 3, 5,
  'pre_reader', 'guided', 'recommended', 'ar', '["ar"]',
  'ready', 0, 'family', 3, datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  series_id = excluded.series_id, slug = excluded.slug, title_ar = excluded.title_ar,
  description_ar = excluded.description_ar, type = excluded.type,
  age_min = excluded.age_min, age_max = excluded.age_max,
  reading_level = excluded.reading_level, interaction_mode = excluded.interaction_mode,
  supervision_level = excluded.supervision_level, default_language = excluded.default_language,
  languages = excluded.languages, status = excluded.status, is_free = excluded.is_free,
  price_tier = excluded.price_tier, sort_order = excluded.sort_order,
  updated_at = datetime('now');`)

  for (const page of PAGES) {
    const number = String(page.page).padStart(3, '0')
    const pageId = `page-moon-sleeps-${number}`
    const imageId = `asset-act-s3-page-${number}`
    const narrationId = `asset-act-s3-vo-ar-${number}`
    const durationMs = records.find((record) => record.id === narrationId).durationMs

    statements.push(`
INSERT INTO story_pages (
  id, story_id, page_number, layout, image_asset_id, duration_ms, dwell_ms,
  transition, sort_order, updated_at
) VALUES (
  ${sql(pageId)}, ${sql(STORY_ID)}, ${page.page}, 'full_bleed', ${sql(imageId)},
  ${durationMs}, ${page.dwellMs}, ${sql(page.transition)}, ${page.page}, datetime('now')
)
ON CONFLICT(id) DO UPDATE SET
  story_id = excluded.story_id, page_number = excluded.page_number,
  image_asset_id = excluded.image_asset_id, duration_ms = excluded.duration_ms,
  dwell_ms = excluded.dwell_ms, transition = excluded.transition,
  sort_order = excluded.sort_order, layout = excluded.layout, updated_at = datetime('now');`)

    statements.push(`
INSERT INTO story_page_localizations (
  page_id, language, body_text, alt_text, narration_asset_id, timing_cues, updated_at
) VALUES (
  ${sql(pageId)}, 'ar', ${sql(page.text)}, ${sql(page.alt)}, ${sql(narrationId)}, '[]', datetime('now')
)
ON CONFLICT(page_id, language) DO UPDATE SET
  body_text = excluded.body_text, alt_text = excluded.alt_text,
  narration_asset_id = excluded.narration_asset_id,
  timing_cues = excluded.timing_cues, updated_at = datetime('now');`)
  }

  for (const cover of COVER_ASSETS) {
    const assetId = `asset-act-s3-${cover.role === 'thumbnail' ? 'thumb' : cover.role}`
    statements.push(`
INSERT INTO asset_links (id, asset_id, entity_type, entity_id, role, sort_order)
VALUES (${sql(`link-act-s3-${cover.role}`)}, ${sql(assetId)}, 'story', ${sql(STORY_ID)}, ${sql(cover.role)}, 0)
ON CONFLICT(id) DO UPDATE SET asset_id = excluded.asset_id, role = excluded.role;`)
  }

  statements.push(`
INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details)
VALUES (${sql(`audit-import-act-s3-${Date.now()}`)}, 'story-import-act-s3', 'bulk_import',
  'story', ${sql(STORY_ID)}, ${sql(JSON.stringify({ assets: records.length, pages: PAGES.length, languages: ['ar'], target: isRemote ? 'remote' : 'local' }))});`)

  const tempDir = path.join(apiDir, '.tmp')
  await fs.mkdir(tempDir, { recursive: true })
  const sqlPath = path.join(tempDir, 'import-story-act-s3.sql')
  const sqlDocument = ['PRAGMA foreign_keys = ON;', ...statements].join('\n')
  await fs.writeFile(sqlPath, sqlDocument, 'utf8')
  try {
    await run(['d1', 'execute', 'majarra-db', targetFlag, ...envFlags, '--yes', `--file=${sqlPath}`])
  } finally {
    await fs.rm(sqlPath, { force: true })
  }

  console.log(`imported ${records.length} assets and ${PAGES.length} Arabic story pages; status=ready`)
}

await main()
