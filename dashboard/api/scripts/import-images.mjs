import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const imageRoot = path.join(rootDir, 'majarra_images')
const catalogPath = path.join(rootDir, 'IMAGE_PROMPTS_CATALOG.md')
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler')
const verificationDir = path.join(apiDir, '.tmp', 'r2-verify')

const args = new Set(process.argv.slice(2))
const isRemote = args.has('--remote')
const dryRun = args.has('--dry-run')
const summaryOnly = args.has('--summary')
const includeExtras = args.has('--include-extras')
const skipUpload = args.has('--skip-upload')
const skipDatabase = args.has('--skip-database')
const resumeUpload = args.has('--resume-upload')
const verifyR2 = args.has('--verify-r2')
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='))
const concurrency = Math.min(Math.max(Number(concurrencyArg?.split('=')[1] ?? 4), 1), 12)
const targetFlag = isRemote ? '--remote' : '--local'

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp'])
const MIME = { '.avif': 'image/avif', '.gif': 'image/gif', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

const PLANET_ID_BY_ASSET = {
  'world-language-cover': 'abjad',
  'world-numbers-cover': 'arqam',
  'world-science-cover': 'oloom',
  'world-values-cover': 'qiyam',
  'world-faith-manners-cover': 'islamic',
  'planet-abjad': 'abjad',
  'planet-numbers': 'arqam',
  'planet-science': 'oloom',
  'planet-values-islamic': 'qiyam',
  'planet-stories': 'qisas',
  'planet-creativity': 'maharat',
}

const PLANET_ICON_SOURCES = [
  ['assets/images/planets/planet-abjad.webp', 'planet-abjad.webp'],
  ['assets/images/planets/planet-numbers.webp', 'planet-numbers.webp'],
  ['assets/images/planets/planet-science.webp', 'planet-science.webp'],
  ['assets/images/planets/planet-values-islamic.webp', 'planet-values-islamic.webp'],
  ['assets/images/planets/planet-stories.webp', 'planet-stories.webp'],
  ['assets/images/planets/planet-creativity.webp', 'planet-creativity.webp'],
].map(([expectedPath, filename]) => ({
  expectedPath,
  absolute: path.join(rootDir, 'app_main', 'assets', 'images', 'planets', filename),
}))

const SERIES_ID_BY_ASSET_KEY = {
  'hekaya-wa-hikma': 'series-kids-wisdom',
  'adventures-of-numbers': 'series-kids-numbers',
  'discover-your-body': 'series-kids-body',
  'bedtime-stories': 'series-kids-bedtime',
  'try-it-at-home': 'series-kids-home',
  'preschool-luna-discovers-words': 'series-preschool-luna-words',
  'preschool-colors-around-us': 'series-preschool-colors',
  'preschool-count-with-me': 'series-preschool-count',
  'preschool-calm-little-stories': 'series-preschool-calm-tale',
  'junior-future-lab': 'series-junior-future-lab',
  'junior-robo-codes': 'series-junior-robo-codes',
  'junior-journey-civilizations': 'series-junior-civilizations',
  'junior-science-in-a-minute': 'series-junior-science-minute',
  'kids-explorers-adventures': 'series-kids-explorers',
  'preschool-noor-qalbi': 'series-faith-preschool-noor',
  'preschool-adhkar-manners-prayer': 'series-faith-preschool-manners',
  'kids-quran-treasures': 'series-faith-kids-quran',
  'kids-prophets-stories': 'series-faith-kids-prophets',
  'kids-prayer-step-by-step': 'series-faith-kids-prayer',
  'junior-quran-understanding': 'series-faith-junior-quran',
  'junior-seerah-journey': 'series-faith-junior-seerah',
  'junior-worship-with-knowledge': 'series-faith-junior-worship',
}

const EPISODE_ASSET_STEMS = new Set([
  'preschool-words-01-picture-to-object', 'preschool-words-02-listen-and-find',
  'preschool-colors-01-find-yellow', 'preschool-colors-02-sort-two-colors',
  'preschool-count-01-one-for-each', 'preschool-count-02-three-friends',
  'preschool-calm-01-bird-home', 'preschool-calm-02-goodnight-toys',
  'hekaya-01-lost-bag', 'hekaya-02-sharing-colors', 'hekaya-03-waiting-turn', 'hekaya-04-plant-responsibility',
  'numbers-01-counting-stars', 'numbers-02-more-or-less', 'numbers-03-shape-bridge', 'numbers-04-combining-groups',
  'body-01-heart', 'body-02-five-senses', 'body-03-breathing',
  'home-01-walking-water', 'home-02-magnet-test', 'home-03-float-or-sink', 'home-04-growing-seed',
  'kids-explorers-01-picture-clues', 'kids-explorers-02-teamwork-bridge',
  'junior-future-01-solar-rover', 'junior-future-02-strong-bridge',
  'junior-code-01-sequence-path', 'junior-code-02-debug-the-route',
  'junior-civilizations-01-water-engineering', 'junior-civilizations-02-observatory',
  'junior-minute-01-light-refraction', 'junior-minute-02-air-pressure',
])

const CHARACTER_IDS_BY_ASSET = {
  'nouma-character-sheet': ['character-nouma'],
  'addaad-robot-character-sheet': ['character-addaad'],
  'salma-presenter-reference': ['character-salma'],
  'luna-preschool-character-sheet': ['character-luna'],
  'robo-junior-character-sheet': ['character-robo'],
  'zaina-yasin-kids-character-sheet': ['character-zaina', 'character-yasin'],
}

const STORY_ASSET_STEMS = new Set([
  'bedtime-01-little-moon', 'bedtime-02-garden-keeper', 'bedtime-03-turtle-home', 'bedtime-04-star-over-palm',
  'bedtime-05-bird-finds-nest', 'bedtime-06-paper-boat', 'bedtime-07-patient-cloud', 'bedtime-08-library-key',
])

const GAME_ID_BY_ASSET = {
  'game-letter-tracing-cover': 'game-letter-tracing',
  'game-number-maze-cover': 'game-number-maze',
  'game-shape-matching-cover': 'game-shape-matching',
  'game-animal-memory-cover': 'game-animal-memory',
  'game-butterfly-sequence-cover': 'game-butterfly-sequence',
  'preschool-picture-match-cover': 'game-preschool-picture-match',
  'preschool-color-sort-cover': 'game-preschool-color-sort',
  'preschool-count-and-place-cover': 'game-preschool-count-place',
  'preschool-listen-and-find-cover': 'game-preschool-listen-find',
  'junior-code-sequence-cover': 'game-junior-code-sequence',
  'junior-circuit-builder-cover': 'game-junior-circuit-builder',
  'junior-civilizations-timeline-cover': 'game-junior-civilizations-timeline',
  'junior-science-evidence-cover': 'game-junior-science-evidence',
  'kids-explorers-clue-trail-cover': 'game-kids-explorers-clue-trail',
}

const BOOK_ID_BY_ASSET = {
  'book-arabic-letters-cover': 'book-arabic-letters',
  'book-counting-cover': 'book-counting',
  'book-human-body-cover': 'book-human-body',
  'book-kindness-cover': 'book-kindness',
  'book-nature-cover': 'book-nature',
  'preschool-first-words-cover': 'book-preschool-first-words',
  'preschool-my-colors-cover': 'book-preschool-colors',
  'preschool-count-with-pictures-cover': 'book-preschool-count-pictures',
  'preschool-little-bird-sleeps-cover': 'book-preschool-little-bird',
  'junior-solar-rover-guide-cover': 'book-junior-solar-rover',
  'junior-coding-logic-cover': 'book-junior-coding-logic',
  'junior-civilization-innovations-cover': 'book-junior-civilization-innovations',
  'junior-everyday-forces-cover': 'book-junior-everyday-forces',
}

const PROJECT_ID_BY_ASSET = {
  'junior-project-solar-oven-cover': 'project-junior-solar-oven',
  'junior-project-paper-bridge-cover': 'project-junior-paper-bridge',
  'junior-project-branching-story-cover': 'project-junior-branching-story',
  'junior-project-family-timeline-cover': 'project-junior-family-timeline',
  'activity-family-kindness-cover': 'activity-family-kindness',
  'activity-safe-experiment-cover': 'activity-safe-experiment',
  'activity-nature-observation-cover': 'activity-nature-observation',
}

const LANDING_ROLE_BY_ASSET = {
  'landing-hero-poster-wall-desktop': 'hero_desktop',
  'landing-hero-poster-wall-mobile': 'hero_mobile',
  'landing-library-poster-mosaic': 'library_mosaic',
  'landing-family-learning-scene': 'family_learning',
  'landing-three-tracks-showcase': 'tracks_showcase',
}

function normalize(value) {
  return value.replaceAll('\\', '/').replace(/^\/+/, '')
}

function withoutExtension(value) {
  return normalize(value).replace(/\.[^.\/]+$/, '').toLowerCase()
}

function basenameStem(value) {
  return path.basename(value, path.extname(value)).toLowerCase()
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function idFor(value) {
  return `asset-${createHash('sha1').update(value).digest('hex').slice(0, 24)}`
}

function linkIdFor(link) {
  const identity = [link.assetId, link.entityType, link.entityId, link.role, link.language ?? ''].join('|')
  return `import-link-${createHash('sha1').update(identity).digest('hex').slice(0, 24)}`
}

function inferVisibility(relativePath) {
  return /\/(landing|marketing|worlds|store)\//.test(`/${normalize(relativePath).toLowerCase()}`) ? 'public' : 'private'
}

function titleFromPath(relativePath) {
  return path.basename(relativePath, path.extname(relativePath)).replace(/[-_]+/g, ' ')
}

function inferAssetLinks(expectedPath) {
  const normalizedPath = normalize(expectedPath).toLowerCase()
  const stem = basenameStem(normalizedPath)
  const links = []
  const add = (entityType, entityId, role, sortOrder = 0) => links.push({ entityType, entityId, role, language: '', sortOrder })

  if ((normalizedPath.startsWith('assets/images/worlds/') || normalizedPath.startsWith('assets/images/islamic/world/')) && PLANET_ID_BY_ASSET[stem]) {
    add('planet', PLANET_ID_BY_ASSET[stem], 'cover')
  }

  if (normalizedPath.startsWith('assets/images/planets/') && PLANET_ID_BY_ASSET[stem]) {
    add('planet', PLANET_ID_BY_ASSET[stem], 'icon')
  }

  if (normalizedPath.startsWith('assets/images/series/posters/') || normalizedPath.startsWith('assets/images/islamic/posters/')) {
    const key = stem.replace(/-poster$/, '')
    if (SERIES_ID_BY_ASSET_KEY[key]) add('series', SERIES_ID_BY_ASSET_KEY[key], 'poster')
  }

  if (normalizedPath.startsWith('assets/images/series/banners/')) {
    const key = stem.replace(/-banner$/, '')
    if (SERIES_ID_BY_ASSET_KEY[key]) add('series', SERIES_ID_BY_ASSET_KEY[key], 'banner')
  }

  if (normalizedPath.startsWith('assets/images/episodes/') && EPISODE_ASSET_STEMS.has(stem)) {
    add('episode', `episode-${stem}`, 'thumbnail')
  }

  if (normalizedPath.startsWith('assets/images/characters/') && CHARACTER_IDS_BY_ASSET[stem]) {
    for (const characterId of CHARACTER_IDS_BY_ASSET[stem]) add('character', characterId, 'reference_sheet')
  }

  if (normalizedPath.startsWith('assets/images/stories/') && STORY_ASSET_STEMS.has(stem)) {
    add('story', `story-${stem}`, 'cover')
  }

  if (normalizedPath.startsWith('assets/images/games/') && GAME_ID_BY_ASSET[stem]) {
    add('game', GAME_ID_BY_ASSET[stem], 'cover')
  }

  if (normalizedPath.startsWith('assets/images/books/covers/') && BOOK_ID_BY_ASSET[stem]) {
    add('book', BOOK_ID_BY_ASSET[stem], 'cover')
  }

  if ((normalizedPath.startsWith('assets/images/projects/covers/') || normalizedPath.startsWith('assets/images/activities/covers/')) && PROJECT_ID_BY_ASSET[stem]) {
    add('project', PROJECT_ID_BY_ASSET[stem], 'cover')
  }

  if (normalizedPath.startsWith('assets/images/landing/') && LANDING_ROLE_BY_ASSET[stem]) {
    add('landing', 'main', LANDING_ROLE_BY_ASSET[stem])
  }

  if (normalizedPath === 'assets/images/store/store-feature-background.webp') add('landing', 'main', 'store_feature_background')

  const marketingSeries = {
    'adventures-of-numbers-story': 'series-kids-numbers',
    'discover-your-body-story': 'series-kids-body',
  }
  if (normalizedPath.startsWith('assets/images/marketing/vertical/')) {
    if (marketingSeries[stem]) add('series', marketingSeries[stem], 'marketing_vertical')
    if (stem === 'majarra-launch-story') add('landing', 'main', 'marketing_launch_vertical')
    if (stem === 'preschool-track-story') add('landing', 'track-preschool', 'marketing_vertical')
    if (stem === 'junior-track-story') add('landing', 'track-junior', 'marketing_vertical')
  }

  const islamicPlanetRoles = {
    'preschool-faith-home-banner': 'preschool_home_banner',
    'kids-faith-home-banner': 'kids_home_banner',
    'junior-faith-home-banner': 'junior_home_banner',
    'daily-adhkar-audio-cover': 'daily_adhkar_audio_cover',
    'islamic-manners-family-activity-cover': 'manners_activity_cover',
    'ramadan-family-banner': 'ramadan_banner',
    'eid-family-vertical': 'eid_vertical',
  }
  if (normalizedPath.startsWith('assets/images/islamic/') && islamicPlanetRoles[stem]) {
    add('planet', 'islamic', islamicPlanetRoles[stem])
  }

  return links
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const output = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await walk(absolute))
    else if (entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(absolute)
  }
  return output
}

function parseCatalog(source) {
  const records = []
  const seen = new Set()
  for (const raw of source.split(/\r?\n/)) {
    let line = raw.trim()
    if (!line.includes('|') || /^\|?\s*(prompt|[-: ]+)\s*\|/i.test(line)) continue
    if (line.startsWith('|')) line = line.slice(1)
    if (line.endsWith('|')) line = line.slice(0, -1)
    const last = line.lastIndexOf('|')
    if (last < 0) continue
    const sizeText = line.slice(last + 1).trim().replaceAll('`', '')
    const beforeSize = line.slice(0, last)
    const second = beforeSize.lastIndexOf('|')
    if (second < 0) continue
    const prompt = beforeSize.slice(0, second).trim()
    const expectedPath = normalize(beforeSize.slice(second + 1).trim().replaceAll('`', ''))
    if (!expectedPath.startsWith('assets/images/') || !IMAGE_EXTENSIONS.has(path.extname(expectedPath).toLowerCase()) || seen.has(expectedPath)) continue
    const dimensions = sizeText.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i)
    const aspectRatio = sizeText.match(/\((\d+\s*:\s*\d+)\)/)?.[1]?.replaceAll(' ', '') ?? null
    records.push({ expectedPath, prompt, expectedWidth: dimensions ? Number(dimensions[1]) : null, expectedHeight: dimensions ? Number(dimensions[2]) : null, aspectRatio })
    seen.add(expectedPath)
  }
  return records
}

function jpegDimensions(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null
  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue }
    const marker = buffer[offset + 1]
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue }
    const length = buffer.readUInt16BE(offset + 2)
    if (length < 2 || offset + 2 + length > buffer.length) return null
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) }
    }
    offset += 2 + length
  }
  return null
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function webpDimensions(buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') return null
  const type = buffer.toString('ascii', 12, 16)
  if (type === 'VP8X') return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
  if (type === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (type === 'VP8 ' && buffer.length >= 30) return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff }
  return null
}

function dimensions(buffer, extension) {
  if (extension === '.jpg' || extension === '.jpeg') return jpegDimensions(buffer)
  if (extension === '.png') return pngDimensions(buffer)
  if (extension === '.webp') return webpDimensions(buffer)
  return null
}

function run(commandArgs, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const scopedArgs = isRemote ? [...commandArgs, '--env=production'] : commandArgs
    const child = spawn(wrangler, scopedArgs, {
      cwd: apiDir,
      env: { ...process.env, CI: 'true' },
      stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
      shell: process.platform === 'win32',
    })
    let stderr = ''
    if (quiet) child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(stderr || `wrangler exited with code ${code}`)))
  })
}

async function pool(items, worker) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

async function retry(worker, attempts = 5) {
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await worker()
    } catch (error) {
      lastError = error
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 750))
    }
  }
  throw lastError
}

async function r2ObjectMatches(record, attempts = 1) {
  await fs.mkdir(verificationDir, { recursive: true })
  const destination = path.join(verificationDir, `${record.id}.bin`)
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    await fs.rm(destination, { force: true })
    try {
      await run(['r2', 'object', 'get', `majarra-media/${record.r2Key}`, `--file=${destination}`, targetFlag], { quiet: true })
      const data = await fs.readFile(destination)
      if (createHash('sha256').update(data).digest('hex') === record.checksum) return true
    } catch {
      // Missing objects and transient Wrangler failures both get another attempt.
    } finally {
      await fs.rm(destination, { force: true })
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500))
  }
  return false
}

async function main() {
  const [catalogText, files] = await Promise.all([fs.readFile(catalogPath, 'utf8'), walk(imageRoot)])
  const catalog = parseCatalog(catalogText)
  const actualByStem = new Map(files.map((absolute) => {
    const relative = normalize(path.relative(imageRoot, absolute))
    return [withoutExtension(relative), { absolute, relative }]
  }))

  const records = []
  const matchedActual = new Set()
  for (const item of catalog) {
    const actual = actualByStem.get(withoutExtension(item.expectedPath)) ?? null
    if (actual) matchedActual.add(actual.absolute)
    records.push({ ...item, actual, id: idFor(item.expectedPath) })
  }

  const planetIcons = await Promise.all(PLANET_ICON_SOURCES.map(async ({ expectedPath, absolute }) => {
    await fs.access(absolute)
    return {
      expectedPath,
      prompt: null,
      expectedWidth: null,
      expectedHeight: null,
      aspectRatio: null,
      actual: { absolute, relative: expectedPath },
      id: idFor(expectedPath),
    }
  }))
  records.push(...planetIcons)

  const ignoredExtras = files.filter((absolute) => !matchedActual.has(absolute))
  if (includeExtras) {
    for (const absolute of ignoredExtras) {
      const relative = normalize(path.relative(imageRoot, absolute))
      records.push({ expectedPath: relative, prompt: null, expectedWidth: null, expectedHeight: null, aspectRatio: null, actual: { absolute, relative }, extra: true, id: idFor(relative) })
    }
  }

  let dimensionMismatches = 0
  let missing = 0
  let ready = 0
  for (const record of records) {
    if (!record.actual) { missing += 1; continue }
    const data = await fs.readFile(record.actual.absolute)
    const stat = await fs.stat(record.actual.absolute)
    const ext = path.extname(record.actual.absolute).toLowerCase()
    const actualDimensions = dimensions(data, ext)
    const dimensionMatch = !record.expectedWidth || !record.expectedHeight || !actualDimensions || (record.expectedWidth === actualDimensions.width && record.expectedHeight === actualDimensions.height)
    if (!dimensionMatch) dimensionMismatches += 1
    Object.assign(record, {
      size: stat.size,
      mime: MIME[ext] ?? 'application/octet-stream',
      checksum: createHash('sha256').update(data).digest('hex'),
      dimensions: actualDimensions,
      dimensionMatch,
      visibility: inferVisibility(record.expectedPath),
    })
    record.r2Key = `${record.visibility}/catalog/${record.actual.relative}`
    ready += 1
  }

  const inferredLinks = records.flatMap((record) => inferAssetLinks(record.expectedPath).map((link) => ({ ...link, assetId: record.id })))
  const linkedAssetIds = new Set(inferredLinks.map((link) => link.assetId))
  const extra = records.filter((item) => item.extra).length
  const catalogReady = catalog.length - missing
  console.log(`Catalog assets: ${catalog.length}`)
  console.log(`Catalog ready: ${catalogReady}`)
  console.log(`Planet icons from app_main: ${planetIcons.length}`)
  console.log(`Ready for upload: ${ready}`)
  console.log(`Planned catalog assets: ${missing}`)
  console.log(`Image files found in majarra_images: ${files.length}`)
  console.log(`Ignored out-of-scope image files: ${includeExtras ? 0 : ignoredExtras.length}`)
  console.log(`Included extra image files: ${extra}`)
  console.log(`Dimension mismatches: ${dimensionMismatches}`)
  console.log(`Inferred content links: ${inferredLinks.length}`)
  console.log(`Assets with no direct content entity: ${records.length - linkedAssetIds.size}`)
  console.log(`Target: ${isRemote ? 'REMOTE R2/D1' : 'local R2/D1'}`)

  if (dryRun) {
    const missingPaths = records.filter((item) => !item.actual).map((item) => item.expectedPath)
    const mismatchPaths = records.filter((item) => item.actual && !item.dimensionMatch).map((item) => ({ path: item.expectedPath, expected: `${item.expectedWidth}x${item.expectedHeight}`, actual: item.dimensions ? `${item.dimensions.width}x${item.dimensions.height}` : 'unknown' }))
    const unlinkedPaths = records.filter((item) => !linkedAssetIds.has(item.id)).map((item) => item.expectedPath)
    if (!summaryOnly && missingPaths.length) console.log('\nMissing:', missingPaths)
    if (!summaryOnly && mismatchPaths.length) console.log('\nDimension mismatches:', mismatchPaths)
    if (!summaryOnly && unlinkedPaths.length) console.log('\nNo direct content entity:', unlinkedPaths)
    return
  }

  const uploadable = records.filter((item) => item.actual)
  if (!skipUpload) {
    let processed = 0
    let uploaded = 0
    let reused = 0
    const failures = []
    console.log(`Uploading ${uploadable.length} files with concurrency ${concurrency}${resumeUpload ? ' (resume mode)' : ''}...`)
    await pool(uploadable, async (record) => {
      try {
        if (resumeUpload && await r2ObjectMatches(record, 2)) {
          reused += 1
        } else {
          await retry(() => run([
            'r2', 'object', 'put', `majarra-media/${record.r2Key}`,
            `--file=${record.actual.absolute}`,
            `--content-type=${record.mime}`,
            `--cache-control=${record.visibility === 'public' ? 'public,max-age=31536000,immutable' : 'private,no-store'}`,
            targetFlag,
            '--force',
          ], { quiet: true }))
          uploaded += 1
        }
      } catch (error) {
        failures.push(`${record.actual.relative}: ${error instanceof Error ? error.message : error}`)
      } finally {
        processed += 1
        if (processed % 10 === 0 || processed === uploadable.length) console.log(`Upload pass ${processed}/${uploadable.length} (${uploaded} written, ${reused} already valid)`)
      }
    })
    if (failures.length) throw new Error(`R2 upload failed for ${failures.length} object(s):\n${failures.join('\n')}`)
  }

  if (verifyR2) {
    let verified = 0
    const failures = []
    console.log(`Verifying ${uploadable.length} R2 objects by SHA-256...`)
    await pool(uploadable, async (record) => {
      if (await r2ObjectMatches(record, 3)) verified += 1
      else failures.push(record.r2Key)
      const checked = verified + failures.length
      if (checked % 10 === 0 || checked === uploadable.length) console.log(`Verified ${checked}/${uploadable.length}`)
    })
    if (failures.length) throw new Error(`R2 verification failed for ${failures.length} object(s):\n${failures.join('\n')}`)
    console.log(`R2 integrity verified: ${verified}/${uploadable.length}`)
  }

  if (!skipDatabase) {
    await run(['d1', 'migrations', 'apply', 'majarra-db', targetFlag], { quiet: false })
    const statements = ['PRAGMA foreign_keys = ON;']
    for (const record of records) {
      const actual = record.actual
      const metadata = {
        imported_from: actual ? normalize(path.relative(rootDir, actual.absolute)) : null,
        generated_extension: actual ? path.extname(actual.absolute).slice(1).toLowerCase() : null,
        requested_extension: path.extname(record.expectedPath).slice(1).toLowerCase(),
        actual_dimensions: record.dimensions ?? null,
        dimension_match: record.dimensionMatch ?? null,
        extra_file: Boolean(record.extra),
      }
      statements.push(`
INSERT INTO content_assets (
  id, title_ar, kind, source, status, original_filename, expected_path, r2_key, bucket,
  mime_type, size_bytes, checksum_sha256, visibility, quality, expected_width, expected_height,
  aspect_ratio, prompt, metadata, uploaded_by, updated_at
) VALUES (
  ${sql(record.id)}, ${sql(titleFromPath(record.expectedPath))}, 'image',
  ${actual ? "'generated'" : "'catalog'"}, ${actual ? "'ready'" : "'planned'"},
  ${sql(actual ? path.basename(actual.absolute) : path.basename(record.expectedPath))}, ${sql(record.expectedPath)},
  ${sql(actual ? record.r2Key : null)}, ${actual ? "'media'" : 'NULL'}, ${sql(record.mime ?? MIME[path.extname(record.expectedPath).toLowerCase()] ?? 'image/webp')},
  ${sql(record.size)}, ${sql(record.checksum)}, ${sql(record.visibility ?? inferVisibility(record.expectedPath))},
  ${sql(actual ? (record.dimensionMatch ? 'approved_size' : 'temporary_size_mismatch') : null)},
  ${sql(record.expectedWidth)}, ${sql(record.expectedHeight)}, ${sql(record.aspectRatio)}, ${sql(record.prompt)},
  ${sql(JSON.stringify(metadata))}, 'image-import-script', datetime('now')
)
ON CONFLICT(expected_path) DO UPDATE SET
  title_ar = excluded.title_ar,
  source = excluded.source,
  status = excluded.status,
  original_filename = excluded.original_filename,
  r2_key = excluded.r2_key,
  bucket = excluded.bucket,
  mime_type = excluded.mime_type,
  size_bytes = excluded.size_bytes,
  checksum_sha256 = excluded.checksum_sha256,
  visibility = excluded.visibility,
  quality = excluded.quality,
  expected_width = excluded.expected_width,
  expected_height = excluded.expected_height,
  aspect_ratio = excluded.aspect_ratio,
  prompt = excluded.prompt,
  metadata = excluded.metadata,
  uploaded_by = excluded.uploaded_by,
  updated_at = datetime('now');`)
    }
    statements.push(`DELETE FROM asset_links WHERE id LIKE 'import-link-%';`)
    for (const link of inferredLinks) {
      statements.push(`INSERT INTO asset_links (id, asset_id, entity_type, entity_id, role, language, sort_order) VALUES (${sql(linkIdFor(link))}, ${sql(link.assetId)}, ${sql(link.entityType)}, ${sql(link.entityId)}, ${sql(link.role)}, ${sql(link.language)}, ${sql(link.sortOrder)});`)
    }
    statements.push(`INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES (${sql(crypto.randomUUID())}, 'image-import-script', 'bulk_import', 'content_asset', 'majarra_images', ${sql(JSON.stringify({ catalog: catalog.length, files: files.length, ready, missing, extra, dimension_mismatches: dimensionMismatches, links: inferredLinks.length, target: isRemote ? 'remote' : 'local' }))});`)
    const tempDir = path.join(apiDir, '.tmp')
    const sqlPath = path.join(tempDir, 'import-images.sql')
    await fs.mkdir(tempDir, { recursive: true })
    await fs.writeFile(sqlPath, statements.join('\n'), 'utf8')
    try {
      await run(['d1', 'execute', 'majarra-db', targetFlag, `--file=${sqlPath}`])
    } finally {
      await fs.rm(sqlPath, { force: true })
    }
  }

  await fs.rm(verificationDir, { recursive: true, force: true })
  console.log(`Import complete: ${ready} ready assets, ${missing} planned assets, ${inferredLinks.length} content links.`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
