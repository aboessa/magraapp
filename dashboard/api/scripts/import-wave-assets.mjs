import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(scriptDir, '..')
const rootDir = path.resolve(apiDir, '..', '..')
const wrangler = path.join(
  apiDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
)

const qcPath = path.join(rootDir, 'tools', 'playveo', 'wave-assets-qc.json')
const visualManifestPath = path.join(rootDir, 'tools', 'playveo', 'wave-visual.manifest.json')
const ingestManifestPath = path.join(rootDir, 'tools', 'playveo', 'wave-ingest.manifest.json')
const migrationPaths = [
  path.join(apiDir, 'migrations', '0054_wave1_games.sql'),
  path.join(apiDir, 'migrations', '0055_wave2_depth.sql'),
  path.join(apiDir, 'migrations', '0056_wave3_final.sql'),
]
const workDir = path.join(apiDir, '.tmp', 'wave-assets')
const verifyDir = path.join(workDir, 'r2-verify')

const MANIFEST_ID = 'majarra-games-wave-media-ingest-v1'
const SOURCE_MANIFEST_ID = 'majarra-games-wave-visual-production-closure-v1'
const PRODUCTION_CONFIRMATION = 'majarra-api-prod'
const PUBLIC_BUCKET = 'majarra-thumbs'
const ASSET_BUCKET = 'thumbs'
const ASSET_VISIBILITY = 'public'
const IMPORT_ACTOR = 'wave-asset-import-v1'
const CACHE_CONTROL = 'public,max-age=31536000,immutable'
const MIME_BY_EXTENSION = new Map([
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
])
const EXPECTED_COUNTS = Object.freeze({
  assets: 107,
  canonical: 89,
  covers: 18,
  gameplay: 71,
  thumbnails: 18,
  png: 45,
  webp: 62,
  links: 36,
  games: 18,
})
const FORBIDDEN_VISUAL_ID = /^(asset-color-|asset-complete-|asset-oloom-)/
const FORBIDDEN_PACK_STRING = /(?:https?:\/\/|playveo|app_main\/|tools\/playveo|[A-Za-z]:\\)/i

const CONTENT_ASSET_COLUMNS = [
  'id', 'title_ar', 'kind', 'source', 'status', 'original_filename',
  'expected_path', 'r2_key', 'bucket', 'mime_type', 'size_bytes',
  'checksum_sha256', 'etag', 'visibility', 'language', 'quality', 'version',
  'expected_width', 'expected_height', 'aspect_ratio', 'prompt',
  'visual_style_id', 'metadata', 'uploaded_by', 'created_at', 'updated_at',
]
const ASSET_LINK_COLUMNS = [
  'id', 'asset_id', 'entity_type', 'entity_id', 'role', 'language',
  'sort_order', 'created_at',
]

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function normalize(value) {
  return String(value).replaceAll('\\', '/').replace(/^\/+/, '')
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function assetIdFor(expectedPath) {
  return `asset-wave-${sha256(`wave-asset|${expectedPath}`).slice(0, 24)}`
}

function linkIdFor(assetId, gameId, role) {
  return `wave-link-${sha256(`${assetId}|game|${gameId}|${role}|`).slice(0, 24)}`
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    )
  }
  return value
}

function stableJson(value) {
  return JSON.stringify(stableValue(value))
}

function jsonHash(value) {
  return sha256(stableJson(value))
}

function sql(value) {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') {
    assert(Number.isFinite(value), `Cannot serialize non-finite SQL number: ${value}`)
    return String(value)
  }
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlList(values) {
  assert(values.length > 0, 'Cannot build an empty SQL IN list')
  return values.map(sql).join(', ')
}

function extensionFor(filename) {
  return path.extname(filename).toLowerCase()
}

function titleFor(titleAr, slot) {
  return `${titleAr} — ${slot.replaceAll('-', ' ')}`
}

function parseArgs(argv) {
  const flags = new Set(argv.filter((arg) => !arg.includes('=')))
  const value = (name) => argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1)
  const local = flags.has('--local')
  const remote = flags.has('--remote')
  const writeManifest = flags.has('--write-manifest')
  const verify = flags.has('--verify')
  const verifyR2 = flags.has('--verify-r2')
  const phase = value('--phase') ?? null
  const confirmation = value('--confirm-production') ?? null
  // Miniflare's local R2 SQLite backend is single-writer on Windows; parallel
  // Wrangler processes can fail with `put: Unspecified error (0)`. Remote R2
  // keeps a conservative parallel default, while local rehearsals serialize.
  const concurrency = Math.min(
    Math.max(Number(value('--concurrency') ?? (local ? 1 : 4)), 1),
    8,
  )

  assert(!(local && remote), '--local and --remote are mutually exclusive')
  assert(!writeManifest || (!local && !remote && !phase && !verify), '--write-manifest is local file generation only')
  assert(!phase || ['r2', 'd1'].includes(phase), '--phase must be r2 or d1')
  assert(!phase || local || remote, '--phase requires --local or --remote')
  assert(!verify || ((local || remote) && !phase), '--verify requires one target and cannot be combined with --phase')
  assert(!verifyR2 || phase === 'r2', '--verify-r2 is only valid with --phase=r2')
  if ((local || remote) && !phase && !verify) {
    fail('A target requires either --phase=r2, --phase=d1, or --verify')
  }
  if (remote && confirmation !== PRODUCTION_CONFIRMATION) {
    fail(
      `Remote access is locked. After the mandatory approval gate, pass ` +
      `--confirm-production=${PRODUCTION_CONFIRMATION} with the exact approved command.`,
    )
  }
  const dryRun = flags.has('--dry-run') || (!local && !remote && !writeManifest)
  assert(!dryRun || (!local && !remote && !phase && !verify), '--dry-run never accepts a Cloudflare target')

  return { local, remote, writeManifest, verify, verifyR2, phase, concurrency, dryRun }
}

async function readJson(filename) {
  const text = (await fs.readFile(filename, 'utf8')).replace(/^\uFEFF/, '')
  return { text, value: JSON.parse(text) }
}

function pngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') return null
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

function webpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) return null
  const type = buffer.toString('ascii', 12, 16)
  if (type === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) }
  }
  if (type === 'VP8L') {
    const bits = buffer.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (type === 'VP8 ' && buffer.length >= 30) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    }
  }
  return null
}

function imageDimensions(buffer, extension) {
  if (extension === '.png') return pngDimensions(buffer)
  if (extension === '.webp') return webpDimensions(buffer)
  return null
}

function originalPacksFromMigrations(migrationTexts) {
  const packs = new Map()
  const expression = /\('(?<id>game-wave[123]-[^']+)'[^\r\n]*\r?\n'(?<pack>\{[^\r\n]+\})','published'/g
  for (const text of migrationTexts) {
    for (const match of text.matchAll(expression)) {
      const gameId = match.groups.id
      assert(!packs.has(gameId), `Duplicate migration GamePack for ${gameId}`)
      packs.set(gameId, JSON.parse(match.groups.pack.replaceAll("''", "'")))
    }
  }
  assert(packs.size === EXPECTED_COUNTS.games, `Expected 18 migration GamePacks, found ${packs.size}`)
  return packs
}

function clone(value) {
  return structuredClone(value)
}

function firstLevel(pack, gameId) {
  assert(Array.isArray(pack.levels) && pack.levels.length === 1, `${gameId} must retain exactly one level`)
  return pack.levels[0]
}

function recordId(recordsByLogicalKey, gameId, slot) {
  const record = recordsByLogicalKey.get(`${gameId}/${slot}`)
  assert(record, `Missing canonical ingest record ${gameId}/${slot}`)
  return record.id
}

function replaceMapped(value, replacements, context) {
  if (value === null) return null
  const replacement = replacements[value]
  assert(replacement, `${context}: no replacement declared for ${String(value)}`)
  return replacement
}

function replacementPackFor(gameId, originalPack, gameplayRecords, recordsByLogicalKey) {
  const pack = clone(originalPack)
  const level = firstLevel(pack, gameId)
  const id = (slot) => recordId(recordsByLogicalKey, gameId, slot)
  const ids = gameplayRecords.map((record) => record.id)

  pack.assets = pack.assets && typeof pack.assets === 'object' ? pack.assets : {}
  pack.assets.images = ids
  pack.assets.audio = Array.isArray(pack.assets.audio) ? pack.assets.audio : []

  switch (gameId) {
    case 'game-wave1-memory-animals': {
      const replacements = {
        'asset-color-cat': id('animal-cat'),
        'asset-color-bird': id('animal-bird'),
        'asset-color-fish': id('animal-fish'),
        'asset-color-rabbit': id('animal-rabbit'),
      }
      for (const pair of level.pairs) {
        pair.a = replaceMapped(pair.a, replacements, `${gameId}.pairs.a`)
        pair.b = replaceMapped(pair.b, replacements, `${gameId}.pairs.b`)
      }
      break
    }
    case 'game-wave2-memory-2': {
      const replacements = {
        'asset-color-lion': id('animal-lion'),
        'asset-color-turtle': id('animal-turtle'),
        'asset-color-owl': id('animal-owl'),
      }
      for (const pair of level.pairs) {
        pair.a = replaceMapped(pair.a, replacements, `${gameId}.pairs.a`)
        pair.b = replaceMapped(pair.b, replacements, `${gameId}.pairs.b`)
      }
      break
    }
    case 'game-wave1-picture-match': {
      const replacements = {
        'asset-color-cat': id('match-cat'),
        'asset-color-bird': id('match-bird'),
      }
      for (const entry of [...level.targets, ...level.items]) {
        entry.image = replaceMapped(entry.image, replacements, `${gameId}.image`)
      }
      break
    }
    case 'game-wave2-match-2': {
      const replacements = {
        'asset-color-moon': id('match-moon'),
        'asset-color-rainbow': id('match-rainbow'),
      }
      for (const entry of [...level.targets, ...level.items]) {
        entry.image = replaceMapped(entry.image, replacements, `${gameId}.image`)
      }
      break
    }
    case 'game-wave1-color-sort': {
      assert(level.bins.length === 2 && level.items.length === 4, `${gameId} visual slots drifted`)
      level.bins[0].image = id('bin-red')
      level.bins[1].image = id('bin-blue')
      const slots = ['red-apple', 'blue-fish', 'red-rocket', 'blue-sailboat']
      level.items.forEach((item, index) => { item.image = id(slots[index]) })
      break
    }
    case 'game-wave2-sort-junior': {
      assert(level.bins.length === 2 && level.items.length === 4, `${gameId} visual slots drifted`)
      level.bins[0].image = id('bin-circle')
      level.bins[1].image = id('bin-star')
      const slots = ['shape-orb', 'shape-star', 'shape-orb', 'shape-star']
      level.items.forEach((item, index) => { item.image = id(slots[index]) })
      break
    }
    case 'game-wave1-count-place':
      level.items[0].items[0].image = id('count-token-star')
      break
    case 'game-wave2-count-drag':
      level.items[0].items[0].image = id('apple-token')
      break
    case 'game-wave1-sequence-kids': {
      assert(level.panels.length === 3, `${gameId} panel count drifted`)
      const slots = ['sequence-seed', 'sequence-sprout', 'sequence-tree']
      level.panels.forEach((panel, index) => { panel.image = id(slots[index]) })
      break
    }
    case 'game-wave1-logic-kids': {
      const replacements = {
        'asset-color-cat': id('pattern-moon'),
        'asset-color-bird': id('pattern-rocket'),
        'asset-color-fish': id('pattern-comet'),
      }
      if (Array.isArray(level.items)) {
        level.items = level.items.map((value) => value === null
          ? null
          : replaceMapped(value, replacements, `${gameId}.items`))
      }
      level.options = level.options.map((value) => replaceMapped(value, replacements, `${gameId}.options`))
      level.answer = replaceMapped(level.answer, replacements, `${gameId}.answer`)
      break
    }
    case 'game-wave1-word-kids':
      // This is already a canonical word_build visual field. Audio and letter-shape
      // normalization remain Task #6 and are intentionally not invented here.
      level.word_image = id('target-house')
      break
    case 'game-wave2-timeline': {
      assert(level.events.length === 2, `${gameId} event count drifted`)
      const slots = ['event-pyramids', 'event-library']
      level.events.forEach((event, index) => { event.image = id(slots[index]) })
      break
    }
    case 'game-wave3-timeline-detail': {
      assert(level.events.length === 3, `${gameId} event count drifted`)
      const slots = ['event-carthage', 'event-house-wisdom', 'event-ibn-battuta']
      level.events.forEach((event, index) => { event.image = id(slots[index]) })
      break
    }
    case 'game-wave1-block-code':
    case 'game-wave1-sim-lab':
    case 'game-wave2-rhythm':
    case 'game-wave3-block-advanced':
    case 'game-wave3-sim-saturating':
      // Their current v1 schemas do not expose visual role fields. All Majarra art
      // is registered in assets.images; Task #7 will render it without changing
      // mechanics or fabricating unsupported pack keys.
      break
    default:
      fail(`No guarded visual transformation declared for ${gameId}`)
  }

  return pack
}

function collectStrings(value, pathParts = [], output = []) {
  if (typeof value === 'string') output.push({ value, path: pathParts.join('.') })
  else if (Array.isArray(value)) value.forEach((item, index) => collectStrings(item, [...pathParts, String(index)], output))
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) collectStrings(item, [...pathParts, key], output)
  }
  return output
}

function collectVisualReferences(pack) {
  const references = new Set()
  const assets = pack.assets && typeof pack.assets === 'object' ? pack.assets : {}
  for (const value of Array.isArray(assets.images) ? assets.images : []) {
    if (typeof value === 'string') references.add(value)
  }
  for (const entry of collectStrings(pack.levels ?? [], ['levels'])) {
    if (entry.value.startsWith('asset-wave-') || FORBIDDEN_VISUAL_ID.test(entry.value)) {
      references.add(entry.value)
    }
  }
  return [...references].sort()
}

function validatePackSafety(game) {
  const replacement = game.replacement_pack
  const strings = collectStrings(replacement)
  for (const entry of strings) {
    assert(!FORBIDDEN_PACK_STRING.test(entry.value), `${game.game_id}: forbidden URL or local path at ${entry.path}`)
    assert(!FORBIDDEN_VISUAL_ID.test(entry.value), `${game.game_id}: legacy generic visual remains at ${entry.path}: ${entry.value}`)
  }
  const gameplay = new Set(game.gameplay_asset_ids)
  const declared = replacement.assets?.images ?? []
  assert(Array.isArray(declared), `${game.game_id}: assets.images is missing`)
  assert(declared.length === gameplay.size, `${game.game_id}: assets.images count drifted`)
  assert(declared.every((value) => gameplay.has(value)), `${game.game_id}: assets.images differs from its gameplay inventory`)
  for (const value of collectVisualReferences(replacement)) {
    assert(gameplay.has(value), `${game.game_id}: visual reference ${value} is outside its Majarra gameplay inventory`)
  }
  assert(jsonHash(game.original_pack) === game.original_pack_sha256, `${game.game_id}: original pack hash mismatch`)
  assert(jsonHash(replacement) === game.replacement_pack_sha256, `${game.game_id}: replacement pack hash mismatch`)
}

async function buildIngestManifest() {
  const [{ text: qcText, value: qc }, { text: visualText, value: visual }, ...migrationReads] = await Promise.all([
    readJson(qcPath),
    readJson(visualManifestPath),
    ...migrationPaths.map((filename) => fs.readFile(filename, 'utf8').then((text) => ({ text }))),
  ])
  assert(qc.manifest_id === SOURCE_MANIFEST_ID, `Unexpected QC manifest ${qc.manifest_id}`)
  assert(visual.manifest_id === SOURCE_MANIFEST_ID, `Unexpected visual manifest ${visual.manifest_id}`)
  assert(Array.isArray(qc.assets) && qc.assets.length === EXPECTED_COUNTS.canonical, 'QC canonical inventory must be 89')
  assert(Array.isArray(qc.thumbnails) && qc.thumbnails.length === EXPECTED_COUNTS.thumbnails, 'QC thumbnail inventory must be 18')
  assert(Array.isArray(visual.games) && visual.games.length === EXPECTED_COUNTS.games, 'Visual game inventory must be 18')

  const originalPacks = originalPacksFromMigrations(migrationReads.map((item) => item.text))
  const gamesById = new Map(visual.games.map((game) => [game.game_id, game]))
  const gameOrder = new Map(visual.games.map((game, index) => [game.game_id, index]))
  const records = []

  for (const item of qc.assets) {
    const game = gamesById.get(item.game_id)
    assert(game, `QC references unknown game ${item.game_id}`)
    const localFile = normalize(item.target_file)
    const expectedPath = localFile.replace(/^app_main\//, '')
    assert(expectedPath.startsWith('assets/images/games/wave/'), `Out-of-scope target ${expectedPath}`)
    const extension = extensionFor(expectedPath)
    const mimeType = MIME_BY_EXTENSION.get(extension)
    assert(mimeType, `Unsupported canonical extension ${extension}`)
    const logicalSlot = item.key.slice(item.game_id.length + 1)
    const checksum = item.target_checksum_sha256
    const relativeWavePath = expectedPath.replace(/^assets\/images\/games\/wave\//, '')
    const directory = path.posix.dirname(relativeWavePath)
    const stem = path.posix.basename(relativeWavePath, extension)
    const r2Key = `public/catalog/images/games/wave/${directory}/${stem}-${checksum.slice(0, 16)}${extension}`
    const dimensions = item.metrics?.size
    assert(Array.isArray(dimensions) && dimensions.length === 2, `Missing dimensions for ${item.key}`)
    const reviewStates = [...game.reviews]
    assert(reviewStates.length > 0 && reviewStates.every((state) => state.endsWith('_PENDING')), `${item.game_id} review state must remain pending`)
    records.push({
      id: assetIdFor(expectedPath),
      logical_key: item.key,
      game_id: item.game_id,
      usage: item.asset === 'cover' ? 'cover' : 'gameplay',
      role: item.asset,
      member: item.member,
      title_ar: titleFor(game.title_ar, logicalSlot),
      local_file: localFile,
      expected_path: expectedPath,
      original_filename: path.posix.basename(expectedPath),
      mime_type: mimeType,
      width: Number(dimensions[0]),
      height: Number(dimensions[1]),
      size_bytes: Number(item.target_bytes),
      checksum_sha256: checksum,
      r2_key: r2Key,
      bucket: ASSET_BUCKET,
      visibility: ASSET_VISIBILITY,
      source: 'generated',
      status: 'ready',
      quality: item.metrics.status === 'WARN'
        ? 'automatic_qc_warn_art_review_pending'
        : 'automatic_qc_pass_art_review_pending',
      metadata: {
        ownership: 'Majarra',
        operation: 'wave_visual_production_closure',
        manifest_id: SOURCE_MANIFEST_ID,
        game_id: item.game_id,
        logical_key: item.key,
        role: item.asset,
        member: item.member,
        usage: item.asset === 'cover' ? 'cover' : 'gameplay',
        transparent: item.transparent === true,
        qc_status: item.metrics.status,
        review_states: reviewStates,
      },
      _order: records.length,
    })
  }

  for (const thumbnail of qc.thumbnails) {
    const game = gamesById.get(thumbnail.game_id)
    assert(game, `Thumbnail references unknown game ${thumbnail.game_id}`)
    const localFile = normalize(thumbnail.thumbnail_file)
    const expectedPath = localFile.replace(/^app_main\//, '')
    const extension = extensionFor(expectedPath)
    const checksum = thumbnail.checksum_sha256
    const relativeWavePath = expectedPath.replace(/^assets\/images\/games\/wave\//, '')
    const directory = path.posix.dirname(relativeWavePath)
    const stem = path.posix.basename(relativeWavePath, extension)
    records.push({
      id: assetIdFor(expectedPath),
      logical_key: `${thumbnail.game_id}/thumbnail`,
      game_id: thumbnail.game_id,
      usage: 'thumbnail',
      role: 'thumbnail',
      member: null,
      title_ar: titleFor(game.title_ar, 'thumbnail'),
      local_file: localFile,
      expected_path: expectedPath,
      original_filename: path.posix.basename(expectedPath),
      mime_type: MIME_BY_EXTENSION.get(extension),
      width: Number(thumbnail.size[0]),
      height: Number(thumbnail.size[1]),
      size_bytes: Number(thumbnail.bytes),
      checksum_sha256: checksum,
      r2_key: `public/catalog/images/games/wave/${directory}/${stem}-${checksum.slice(0, 16)}${extension}`,
      bucket: ASSET_BUCKET,
      visibility: ASSET_VISIBILITY,
      source: 'generated',
      status: 'ready',
      quality: 'contact_sheet_review_pending',
      metadata: {
        ownership: 'Majarra',
        operation: 'wave_thumbnail_derivation',
        manifest_id: SOURCE_MANIFEST_ID,
        game_id: thumbnail.game_id,
        logical_key: `${thumbnail.game_id}/thumbnail`,
        role: 'thumbnail',
        member: null,
        usage: 'thumbnail',
        transparent: false,
        qc_status: thumbnail.status,
        review_states: [...game.reviews, 'CONTACT_SHEET_REVIEW_PENDING'],
      },
      _order: records.length,
    })
  }

  records.sort((left, right) => {
    const gameDifference = gameOrder.get(left.game_id) - gameOrder.get(right.game_id)
    if (gameDifference !== 0) return gameDifference
    const usageOrder = { cover: 0, gameplay: 1, thumbnail: 2 }
    const usageDifference = usageOrder[left.usage] - usageOrder[right.usage]
    return usageDifference || left._order - right._order
  })
  for (const record of records) delete record._order

  const recordsByLogicalKey = new Map(records.map((record) => [record.logical_key, record]))
  assert(recordsByLogicalKey.size === records.length, 'Duplicate logical asset key')

  const games = visual.games.map((game) => {
    const originalPack = originalPacks.get(game.game_id)
    assert(originalPack, `Missing original GamePack for ${game.game_id}`)
    const gameRecords = records.filter((record) => record.game_id === game.game_id)
    const gameplayRecords = gameRecords.filter((record) => record.usage === 'gameplay')
    const cover = gameRecords.find((record) => record.usage === 'cover')
    const thumbnail = gameRecords.find((record) => record.usage === 'thumbnail')
    assert(cover && thumbnail, `${game.game_id} must have one cover and one thumbnail`)
    const replacementPack = replacementPackFor(
      game.game_id,
      originalPack,
      gameplayRecords,
      recordsByLogicalKey,
    )
    return {
      game_id: game.game_id,
      engine_id: game.engine,
      title_ar: game.title_ar,
      effective_status: game.effective_status,
      review_states: [...game.reviews],
      cover_asset_id: cover.id,
      thumbnail_asset_id: thumbnail.id,
      gameplay_asset_ids: gameplayRecords.map((record) => record.id),
      original_pack_sha256: jsonHash(originalPack),
      replacement_pack_sha256: jsonHash(replacementPack),
      original_pack: originalPack,
      replacement_pack: replacementPack,
    }
  })

  const links = games.flatMap((game) => [
    {
      id: linkIdFor(game.cover_asset_id, game.game_id, 'cover'),
      asset_id: game.cover_asset_id,
      entity_type: 'game',
      entity_id: game.game_id,
      role: 'cover',
      language: '',
      sort_order: 0,
    },
    {
      id: linkIdFor(game.thumbnail_asset_id, game.game_id, 'thumbnail'),
      asset_id: game.thumbnail_asset_id,
      entity_type: 'game',
      entity_id: game.game_id,
      role: 'thumbnail',
      language: '',
      sort_order: 0,
    },
  ])

  return {
    schema_version: 1,
    manifest_id: MANIFEST_ID,
    source_manifest_id: SOURCE_MANIFEST_ID,
    generated_at: qc.generated_at,
    scope: 'Wave-only Media Library ingest for the 18 existing Majarra games',
    policy: {
      ownership: 'Majarra',
      public_bucket: PUBLIC_BUCKET,
      immutable_content_addressed_keys: true,
      provider_metadata_included: false,
      provider_urls_included: false,
      production_lifecycle_change: false,
      human_reviews_auto_approved: false,
      broad_deletes_allowed: false,
    },
    source_fingerprints: {
      qc_sha256: sha256(qcText),
      visual_manifest_sha256: sha256(visualText),
      wave_migrations_sha256: sha256(migrationReads.map((item) => item.text).join('\n')),
    },
    counts: {
      assets: records.length,
      canonical: records.filter((record) => record.usage !== 'thumbnail').length,
      covers: records.filter((record) => record.usage === 'cover').length,
      gameplay: records.filter((record) => record.usage === 'gameplay').length,
      thumbnails: records.filter((record) => record.usage === 'thumbnail').length,
      png: records.filter((record) => record.mime_type === 'image/png').length,
      webp: records.filter((record) => record.mime_type === 'image/webp').length,
      links: links.length,
      games: games.length,
    },
    assets: records,
    links,
    games,
  }
}

async function validateManifest(manifest, { verifyFiles }) {
  assert(manifest.schema_version === 1, 'Wave ingest manifest schema_version must be 1')
  assert(manifest.manifest_id === MANIFEST_ID, `Unexpected ingest manifest ${manifest.manifest_id}`)
  assert(manifest.source_manifest_id === SOURCE_MANIFEST_ID, 'Source manifest id drifted')
  assert(manifest.policy?.provider_metadata_included === false, 'Provider metadata must be excluded')
  assert(manifest.policy?.provider_urls_included === false, 'Provider URLs must be excluded')
  assert(manifest.policy?.production_lifecycle_change === false, 'Importer must not change lifecycle state')
  assert(manifest.policy?.human_reviews_auto_approved === false, 'Importer must not approve human reviews')
  assert(manifest.policy?.broad_deletes_allowed === false, 'Importer must not permit broad deletes')

  for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
    assert(manifest.counts?.[key] === expected, `Manifest count ${key} must be ${expected}, found ${manifest.counts?.[key]}`)
  }
  assert(Array.isArray(manifest.assets) && manifest.assets.length === EXPECTED_COUNTS.assets, 'Asset inventory must be 107')
  assert(Array.isArray(manifest.links) && manifest.links.length === EXPECTED_COUNTS.links, 'Link inventory must be 36')
  assert(Array.isArray(manifest.games) && manifest.games.length === EXPECTED_COUNTS.games, 'Game inventory must be 18')

  const serialized = JSON.stringify(manifest)
  assert(!/https?:\/\//i.test(serialized), 'Sanitized ingest manifest must not contain any URL')
  assert(!/playveo/i.test(serialized), 'Sanitized ingest manifest must not contain provider names')
  assert(!/(provider_result|result_url|api_key)/i.test(serialized), 'Sanitized ingest manifest contains provider fields')

  const uniqueFields = ['id', 'logical_key', 'local_file', 'expected_path', 'r2_key']
  for (const field of uniqueFields) {
    const values = manifest.assets.map((record) => record[field])
    assert(new Set(values).size === values.length, `Duplicate asset ${field}`)
  }

  const gameIds = new Set(manifest.games.map((game) => game.game_id))
  const assetIds = new Set(manifest.assets.map((record) => record.id))
  const recordById = new Map(manifest.assets.map((record) => [record.id, record]))
  const gameplayIds = new Set(manifest.assets.filter((record) => record.usage === 'gameplay').map((record) => record.id))
  assert(gameIds.size === EXPECTED_COUNTS.games, 'Duplicate game id')
  assert(assetIds.size === EXPECTED_COUNTS.assets, 'Duplicate asset id')
  assert(gameplayIds.size === EXPECTED_COUNTS.gameplay, 'Gameplay ids must be 71 distinct records')

  let totalBytes = 0
  for (const record of manifest.assets) {
    assert(gameIds.has(record.game_id), `${record.id}: unknown game ${record.game_id}`)
    assert(record.id === assetIdFor(record.expected_path), `${record.id}: deterministic id mismatch`)
    assert(record.expected_path.startsWith('assets/images/games/wave/'), `${record.id}: expected_path out of scope`)
    assert(record.local_file === `app_main/${record.expected_path}`, `${record.id}: local_file does not match expected_path`)
    assert(record.r2_key.startsWith('public/catalog/images/games/wave/'), `${record.id}: R2 key out of scope`)
    assert(record.r2_key.includes(`-${record.checksum_sha256.slice(0, 16)}`), `${record.id}: R2 key is not content addressed`)
    assert(record.bucket === ASSET_BUCKET && record.visibility === ASSET_VISIBILITY, `${record.id}: public bucket classification drifted`)
    assert(record.source === 'generated' && record.status === 'ready', `${record.id}: source/status drifted`)
    assert(record.metadata?.ownership === 'Majarra', `${record.id}: Majarra ownership missing`)
    assert(record.metadata?.manifest_id === SOURCE_MANIFEST_ID, `${record.id}: sanitized lineage missing`)
    assert(Array.isArray(record.metadata?.review_states), `${record.id}: review state missing`)
    assert(record.metadata.review_states.every((state) => state.endsWith('_PENDING')), `${record.id}: review was auto-approved`)
    assert(MIME_BY_EXTENSION.get(extensionFor(record.expected_path)) === record.mime_type, `${record.id}: MIME mismatch`)
    assert(/^[a-f0-9]{64}$/.test(record.checksum_sha256), `${record.id}: invalid checksum`)
    assert(Number.isInteger(record.size_bytes) && record.size_bytes > 0, `${record.id}: invalid size`)
    assert(Number.isInteger(record.width) && record.width > 0, `${record.id}: invalid width`)
    assert(Number.isInteger(record.height) && record.height > 0, `${record.id}: invalid height`)
    totalBytes += record.size_bytes

    if (verifyFiles) {
      const absolute = path.join(rootDir, ...record.local_file.split('/'))
      const data = await fs.readFile(absolute)
      const dimensions = imageDimensions(data, extensionFor(record.local_file))
      assert(data.length === record.size_bytes, `${record.local_file}: byte count changed`)
      assert(sha256(data) === record.checksum_sha256, `${record.local_file}: checksum changed`)
      assert(dimensions, `${record.local_file}: dimensions could not be read`)
      assert(dimensions.width === record.width && dimensions.height === record.height, `${record.local_file}: dimensions changed`)
    }
  }

  const linkIds = new Set()
  for (const link of manifest.links) {
    assert(!linkIds.has(link.id), `Duplicate link ${link.id}`)
    linkIds.add(link.id)
    assert(assetIds.has(link.asset_id), `${link.id}: asset does not exist in manifest`)
    assert(link.entity_type === 'game' && gameIds.has(link.entity_id), `${link.id}: link is outside Wave games`)
    assert(['cover', 'thumbnail'].includes(link.role), `${link.id}: unsupported link role`)
    const record = recordById.get(link.asset_id)
    assert(record.usage === link.role, `${link.id}: link role does not match asset usage`)
    assert(link.id === linkIdFor(link.asset_id, link.entity_id, link.role), `${link.id}: deterministic link id mismatch`)
  }

  const packGameplayIds = []
  for (const game of manifest.games) {
    assert(game.engine_id === game.original_pack.engine_id, `${game.game_id}: original engine mismatch`)
    assert(game.engine_id === game.replacement_pack.engine_id, `${game.game_id}: replacement engine mismatch`)
    assert(game.effective_status === 'VISUAL_ASSETS_PENDING', `${game.game_id}: effective status changed`)
    assert(game.review_states.every((state) => state.endsWith('_PENDING')), `${game.game_id}: review was auto-approved`)
    assert(recordById.get(game.cover_asset_id)?.usage === 'cover', `${game.game_id}: invalid cover asset`)
    assert(recordById.get(game.thumbnail_asset_id)?.usage === 'thumbnail', `${game.game_id}: invalid thumbnail asset`)
    assert(new Set(game.gameplay_asset_ids).size === game.gameplay_asset_ids.length, `${game.game_id}: duplicate gameplay asset`)
    assert(game.gameplay_asset_ids.every((id) => gameplayIds.has(id) && recordById.get(id).game_id === game.game_id), `${game.game_id}: gameplay asset scope mismatch`)
    validatePackSafety(game)
    packGameplayIds.push(...game.gameplay_asset_ids)
  }
  assert(packGameplayIds.length === EXPECTED_COUNTS.gameplay, 'GamePacks must contain 71 gameplay image ids')
  assert(new Set(packGameplayIds).size === EXPECTED_COUNTS.gameplay, 'GamePack gameplay image ids must be globally distinct')

  return { totalBytes, assetIds, gameIds, gameplayIds, recordById }
}

class CommandError extends Error {
  constructor(message, { code, stdout, stderr }) {
    super(message)
    this.code = code
    this.stdout = stdout
    this.stderr = stderr
  }
}

function runWrangler(commandArgs, options, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const args = [...commandArgs]
    if (options.remote) args.push('--env=production')
    const child = spawn(wrangler, args, {
      cwd: apiDir,
      env: { ...process.env, CI: 'true', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('exit', (code) => {
      if (!quiet && stdout.trim()) process.stdout.write(stdout)
      if (!quiet && stderr.trim()) process.stderr.write(stderr)
      if (code === 0) resolve({ stdout, stderr })
      else reject(new CommandError(`wrangler exited with code ${code}: ${(stderr || stdout).trim()}`, { code, stdout, stderr }))
    })
  })
}

async function pool(items, concurrency, worker) {
  let cursor = 0
  let stopped = false
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!stopped) {
      const index = cursor++
      if (index >= items.length) return
      try {
        await worker(items[index], index)
      } catch (error) {
        stopped = true
        throw error
      }
    }
  })
  await Promise.all(runners)
}

function targetFlag(options) {
  return options.remote ? '--remote' : '--local'
}

function missingObjectError(error) {
  const message = `${error?.message ?? ''}\n${error?.stderr ?? ''}\n${error?.stdout ?? ''}`.toLowerCase()
  return /not found|does not exist|no such key|nosuchkey|404/.test(message)
}

const r2StageRoot = path.join(workDir, 'r2-stage')
const CDN_BASE_URL = 'https://cdn.majarra.app'

async function verifyStagedR2Source(record, filename) {
  const data = await fs.readFile(filename)
  const dimensions = imageDimensions(data, extensionFor(record.local_file))
  assert(data.length === record.size_bytes, `${record.local_file}: staged byte count changed`)
  assert(sha256(data) === record.checksum_sha256, `${record.local_file}: staged checksum changed`)
  assert(dimensions, `${record.local_file}: staged dimensions could not be read`)
  assert(dimensions.width === record.width && dimensions.height === record.height, `${record.local_file}: staged dimensions changed`)
  return { bytes: data.length, checksum: record.checksum_sha256 }
}

async function stageR2Sources(manifest) {
  const operationDir = path.join(r2StageRoot, randomUUID())
  const stagedById = new Map()
  await fs.mkdir(operationDir, { recursive: true })
  try {
    await pool(manifest.assets, Math.min(4, manifest.assets.length), async (record) => {
      const source = path.join(rootDir, ...record.local_file.split('/'))
      const staged = path.join(operationDir, `${record.id}${extensionFor(record.local_file)}`)
      await fs.copyFile(source, staged)
      await verifyStagedR2Source(record, staged)
      stagedById.set(record.id, staged)
    })
    assert(stagedById.size === EXPECTED_COUNTS.assets, `Staged ${stagedById.size}/107 immutable upload sources`)
    return {
      operationDir,
      stagedById,
      cleanup: () => fs.rm(operationDir, { recursive: true, force: true }),
    }
  } catch (error) {
    await fs.rm(operationDir, { recursive: true, force: true })
    throw error
  }
}

function cdnObjectUrl(r2Key) {
  return `${CDN_BASE_URL}/${r2Key.split('/').map(encodeURIComponent).join('/')}`
}

async function remoteObjectMetadata(record) {
  const response = await fetch(cdnObjectUrl(record.r2_key), {
    method: 'HEAD',
    cache: 'no-store',
    headers: { 'cache-control': 'no-cache' },
  })
  if (!response.ok) {
    return {
      state: 'unavailable',
      status: response.status,
      content_type: response.headers.get('content-type'),
      cache_control: response.headers.get('cache-control'),
      content_length: response.headers.get('content-length'),
    }
  }
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? null
  const cacheControl = response.headers.get('cache-control')?.replace(/\s+/g, '') ?? null
  const contentLengthHeader = response.headers.get('content-length')
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader)
  const matches = contentType === record.mime_type &&
    cacheControl === CACHE_CONTROL &&
    (contentLength === null || contentLength === record.size_bytes)
  return {
    state: matches ? 'match' : 'mismatch',
    status: response.status,
    content_type: contentType,
    cache_control: cacheControl,
    content_length: contentLength,
  }
}

async function r2ObjectState(record, options, { verifyMetadata = false } = {}) {
  await fs.mkdir(verifyDir, { recursive: true })
  const destination = path.join(verifyDir, `${record.id}-${randomUUID()}.bin`)
  try {
    await runWrangler([
      'r2', 'object', 'get', `${PUBLIC_BUCKET}/${record.r2_key}`,
      `--file=${destination}`,
      targetFlag(options),
    ], options)
    const data = await fs.readFile(destination)
    const checksum = sha256(data)
    const bodyState = checksum === record.checksum_sha256 && data.length === record.size_bytes
      ? 'match'
      : 'collision'
    let metadata = {
      state: 'not_verifiable',
      reason: 'Wrangler local R2 get does not expose stored HTTP metadata.',
    }
    if (verifyMetadata && options.remote && bodyState === 'match') {
      metadata = await remoteObjectMetadata(record)
    }
    return { state: bodyState, checksum, bytes: data.length, metadata }
  } catch (error) {
    if (missingObjectError(error)) return { state: 'missing', metadata: { state: 'not_checked' } }
    throw error
  } finally {
    await fs.rm(destination, { force: true })
  }
}

async function putStagedR2Object(record, stagedFile, options) {
  // Re-hash the private staging copy immediately before handing its path to
  // Wrangler. Wrangler 4.118.0 has no conditional-create flag, so the second
  // key read below narrows—but cannot eliminate—a concurrent-writer window.
  await verifyStagedR2Source(record, stagedFile)
  const immediatelyBefore = await r2ObjectState(record, options, { verifyMetadata: options.remote })
  if (immediatelyBefore.state === 'collision') {
    fail(`Immutable R2 key collision immediately before put: ${record.r2_key} has checksum ${immediatelyBefore.checksum}`)
  }
  if (immediatelyBefore.state === 'match' && (!options.remote || immediatelyBefore.metadata.state === 'match')) {
    return { action: 'reused', state: immediatelyBefore }
  }

  await runWrangler([
    'r2', 'object', 'put', `${PUBLIC_BUCKET}/${record.r2_key}`,
    `--file=${stagedFile}`,
    `--content-type=${record.mime_type}`,
    `--cache-control=${CACHE_CONTROL}`,
    targetFlag(options),
    '--force',
  ], options)
  const after = await r2ObjectState(record, options, { verifyMetadata: options.remote })
  assert(after.state === 'match', `R2 post-upload body verification failed for ${record.r2_key}`)
  if (options.remote) {
    assert(after.metadata.state === 'match', `R2/CDN metadata verification failed for ${record.r2_key}: ${JSON.stringify(after.metadata)}`)
  }
  return {
    action: immediatelyBefore.state === 'match' ? 'metadata_repaired' : 'uploaded',
    state: after,
  }
}

async function uploadR2(manifest, options) {
  let checked = 0
  let uploaded = 0
  let reused = 0
  let metadataRepaired = 0
  const uploadedKeys = []
  const staged = await stageR2Sources(manifest)
  console.log(`R2 staging target: ${options.remote ? 'PRODUCTION' : 'local'} ${PUBLIC_BUCKET}`)
  console.log(`Stable upload sources: ${path.relative(rootDir, staged.operationDir)} (107/107 hash-verified)`)
  try {
    await pool(manifest.assets, options.concurrency, async (record) => {
      const stagedFile = staged.stagedById.get(record.id)
      assert(stagedFile, `${record.id}: stable staging file is missing`)
      const result = await putStagedR2Object(record, stagedFile, options)
      if (result.action === 'uploaded') {
        uploaded += 1
        uploadedKeys.push(record.r2_key)
      } else if (result.action === 'metadata_repaired') {
        metadataRepaired += 1
        uploadedKeys.push(record.r2_key)
      } else {
        reused += 1
      }
      checked += 1
      if (checked % 10 === 0 || checked === manifest.assets.length) {
        console.log(`R2 staged ${checked}/${manifest.assets.length} (${uploaded} uploaded, ${metadataRepaired} metadata repaired, ${reused} reused)`)
      }
    })
  } finally {
    await staged.cleanup()
  }

  await fs.mkdir(workDir, { recursive: true })
  const reportPath = path.join(workDir, `r2-upload-${options.remote ? 'production' : 'local'}-${Date.now()}.json`)
  const metadataVerification = options.remote
    ? { method: 'cdn_head', base_url: CDN_BASE_URL, verified: checked }
    : { method: 'unavailable', verified: 0, limitation: 'Wrangler local R2 get does not expose Content-Type or Cache-Control; local verification covers body bytes only.' }
  await fs.writeFile(reportPath, `${JSON.stringify({
    manifest_id: manifest.manifest_id,
    target: options.remote ? 'production' : 'local',
    bucket: PUBLIC_BUCKET,
    stable_sources_verified: EXPECTED_COUNTS.assets,
    body_verified: checked,
    metadata_verification: metadataVerification,
    conditional_create: {
      supported_by_wrangler: false,
      mitigation: 'The immutable key is re-read immediately before put and verified immediately afterward; a residual concurrent-writer race remains.',
    },
    uploaded,
    metadata_repaired: metadataRepaired,
    reused,
    written_keys: uploadedKeys,
    rollback_policy: 'Objects are immutable and are not auto-deleted; remove only after confirming no references.',
  }, null, 2)}\n`, 'utf8')
  return { uploaded, metadata_repaired: metadataRepaired, reused, reportPath, metadata_verification: metadataVerification }
}

async function verifyR2(manifest, options) {
  let checked = 0
  let metadataVerified = 0
  const failures = []
  await pool(manifest.assets, options.concurrency, async (record) => {
    const state = await r2ObjectState(record, options, { verifyMetadata: options.remote })
    if (state.state !== 'match' || (options.remote && state.metadata.state !== 'match')) {
      failures.push({
        r2_key: record.r2_key,
        state: state.state,
        checksum: state.checksum ?? null,
        bytes: state.bytes ?? null,
        metadata: state.metadata,
      })
    } else if (options.remote) {
      metadataVerified += 1
    }
    checked += 1
    if (checked % 10 === 0 || checked === manifest.assets.length) {
      console.log(`R2 body verified ${checked}/${manifest.assets.length}`)
    }
  })
  assert(failures.length === 0, `R2 integrity failed for ${failures.length} object(s):\n${JSON.stringify(failures, null, 2)}`)
  return {
    body_verified: checked,
    metadata_verified: options.remote ? metadataVerified : 0,
    metadata_verification: options.remote
      ? 'cdn_head'
      : 'not_available_for_local_wrangler_r2',
  }
}

function parseWranglerJson(stdout) {
  const clean = stdout.replace(/\u001b\[[0-9;]*m/g, '')
  for (let index = clean.indexOf('['); index !== -1; index = clean.indexOf('[', index + 1)) {
    try {
      const parsed = JSON.parse(clean.slice(index))
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Wrangler can print a banner before JSON; try the next opening bracket.
    }
  }
  fail(`Could not parse Wrangler JSON output: ${clean.slice(0, 500)}`)
}

const GAME_COLUMNS = [
  'id', 'engine_id', 'series_id', 'episode_id', 'title_ar',
  'learning_objective_id', 'age_min', 'age_max', 'reading_level',
  'interaction_mode', 'supervision_level', 'safety_notes', 'difficulty',
  'content_pack', 'instructions_ar', 'max_attempts', 'help_system',
  'is_free', 'created_at', 'status', 'updated_at', 'translated_from',
]
const WAVE_GUARD_TABLES = [
  '__wave_asset_cutover_guard_v1',
  '__wave_asset_operation_guard_v2',
  '__wave_expected_assets_v2',
  '__wave_expected_games_v2',
  '__wave_expected_links_v2',
  '__wave_operation_clock_v2',
]
const ASSET_REFERENCE_SPECS = [
  { table: 'asset_links', column: 'asset_id', onDelete: 'CASCADE' },
  { table: 'asset_uploads', column: 'asset_id', onDelete: 'CASCADE' },
  { table: 'story_pages', column: 'image_asset_id', onDelete: 'SET NULL' },
  { table: 'story_pages', column: 'background_asset_id', onDelete: 'SET NULL' },
  { table: 'story_page_localizations', column: 'narration_asset_id', onDelete: 'SET NULL' },
  { table: 'playback_leases', column: 'asset_id', onDelete: 'RESTRICT' },
  { table: 'web_page_sections', column: 'media_asset_id', onDelete: 'SET NULL' },
  { table: 'seo_meta', column: 'og_image_asset_id', onDelete: 'SET NULL' },
  { table: 'blog_authors', column: 'avatar_asset_id', onDelete: 'SET NULL' },
  { table: 'blog_posts', column: 'hero_asset_id', onDelete: 'SET NULL' },
  { table: 'questions', column: 'media_asset_id', onDelete: 'SET NULL' },
  { table: 'episode_audio_tracks', column: 'asset_id', onDelete: 'RESTRICT' },
  { table: 'episode_subtitle_tracks', column: 'asset_id', onDelete: 'RESTRICT' },
  { table: 'episode_renditions', column: 'asset_id', onDelete: 'RESTRICT' },
]

function quoteIdentifier(value) {
  assert(/^[a-z_][a-z0-9_]*$/i.test(value), `Unsafe SQL identifier: ${value}`)
  return `"${value}"`
}

function columnSql(columns) {
  return columns.map(quoteIdentifier).join(', ')
}

function assetReferenceTables() {
  return [...new Set(ASSET_REFERENCE_SPECS.map((spec) => spec.table))]
}

function assetScopeWhere(manifest) {
  return `id IN (${sqlList(manifest.assets.map((record) => record.id))})` +
    ` OR COALESCE(expected_path IN (${sqlList(manifest.assets.map((record) => record.expected_path))}), 0)` +
    ` OR COALESCE(r2_key IN (${sqlList(manifest.assets.map((record) => record.r2_key))}), 0)`
}

function gameScopeWhere(manifest) {
  return `id IN (${sqlList(manifest.games.map((game) => game.game_id))})`
}

function linkScopeWhere(manifest) {
  return `id IN (${sqlList(manifest.links.map((link) => link.id))})` +
    ` OR (entity_type = 'game'` +
    ` AND entity_id IN (${sqlList(manifest.games.map((game) => game.game_id))})` +
    ` AND role IN ('cover', 'thumbnail'))`
}

function sortedRows(rows) {
  return [...rows].sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
}

function rowsFingerprint(rows) {
  const canonical = sortedRows(rows)
  return { count: canonical.length, sha256: jsonHash(canonical) }
}

function assertRowsExact(actual, expected, label) {
  const actualCanonical = sortedRows(actual)
  const expectedCanonical = sortedRows(expected)
  assert(
    stableJson(actualCanonical) === stableJson(expectedCanonical),
    `${label} drifted: expected ${expectedCanonical.length} row(s) ${jsonHash(expectedCanonical)}, found ${actualCanonical.length} row(s) ${jsonHash(actualCanonical)}`,
  )
}

function rowDiff(actual, expected) {
  const actualById = new Map(actual.map((row) => [row.id, row]))
  const expectedById = new Map(expected.map((row) => [row.id, row]))
  let added = 0
  let removed = 0
  let changed = 0
  for (const [id, row] of actualById) {
    if (!expectedById.has(id)) added += 1
    else if (stableJson(row) !== stableJson(expectedById.get(id))) changed += 1
  }
  for (const id of expectedById.keys()) {
    if (!actualById.has(id)) removed += 1
  }
  return { added, removed, changed, total: added + removed + changed }
}

function unrelatedFingerprints(state) {
  return {
    games: rowsFingerprint(state.unrelated.games),
    content_assets: rowsFingerprint(state.unrelated.assets),
    asset_links: rowsFingerprint(state.unrelated.links),
  }
}

function compareUnrelatedScopes(before, after, stage) {
  const details = {
    games: rowDiff(after.unrelated.games, before.unrelated.games),
    content_assets: rowDiff(after.unrelated.assets, before.unrelated.assets),
    asset_links: rowDiff(after.unrelated.links, before.unrelated.links),
  }
  const total = Object.values(details).reduce((sum, item) => sum + item.total, 0)
  assert(total === 0, `${stage}: unrelated D1 scope changed: ${JSON.stringify(details)}`)
  return { total, details, fingerprints: unrelatedFingerprints(after) }
}

function compareNonLinkReferences(before, after, stage) {
  for (const spec of ASSET_REFERENCE_SPECS.filter((item) => item.table !== 'asset_links')) {
    const key = `${spec.table}.${spec.column}`
    assertRowsExact(after.references[key], before.references[key], `${stage}: ${key} references`)
  }
}

async function d1ResultSets(queries, options) {
  await fs.mkdir(workDir, { recursive: true })
  const queryPath = path.join(workDir, `query-${randomUUID()}.sql`)
  const body = queries
    .map((query, index) => `-- wave snapshot query ${index + 1}\n${query.trim().replace(/;?\s*$/, ';')}`)
    .join('\n')
  await fs.writeFile(queryPath, `${body}\n`, 'utf8')
  try {
    const result = await runWrangler([
      'd1', 'execute', 'majarra-db',
      targetFlag(options),
      '--json',
      `--file=${queryPath}`,
    ], options)
    const parsed = parseWranglerJson(result.stdout)
    assert(parsed.length === queries.length, `D1 snapshot returned ${parsed.length}/${queries.length} result sets`)
    return parsed.map((entry, index) => {
      assert(entry?.success !== false, `D1 snapshot query ${index + 1} failed`)
      return entry?.results ?? []
    })
  } finally {
    await fs.rm(queryPath, { force: true })
  }
}

async function runD1File(statements, label, options) {
  await fs.mkdir(workDir, { recursive: true })
  const filename = path.join(workDir, `${label}-${randomUUID()}.sql`)
  await fs.writeFile(filename, `${statements.join('\n')}\n`, 'utf8')
  try {
    await runWrangler([
      'd1', 'execute', 'majarra-db',
      targetFlag(options),
      `--file=${filename}`,
      '--yes',
    ], options)
    console.log(`D1 batch ${label}: ${statements.length} guarded statement(s) applied`)
  } finally {
    await fs.rm(filename, { force: true })
  }
}

async function loadDbState(manifest, options) {
  const assetIds = manifest.assets.map((record) => record.id)
  const assetScope = assetScopeWhere(manifest)
  const gameScope = gameScopeWhere(manifest)
  const linkScope = linkScopeWhere(manifest)
  const queries = [
    `SELECT ${columnSql(CONTENT_ASSET_COLUMNS)} FROM content_assets WHERE ${assetScope} ORDER BY id`,
    `SELECT ${columnSql(GAME_COLUMNS)} FROM games WHERE ${gameScope} ORDER BY id`,
    `SELECT ${columnSql(ASSET_LINK_COLUMNS)} FROM asset_links WHERE ${linkScope} ORDER BY id`,
    `SELECT ${columnSql(CONTENT_ASSET_COLUMNS)} FROM content_assets WHERE NOT (${assetScope}) ORDER BY id`,
    `SELECT ${columnSql(GAME_COLUMNS)} FROM games WHERE NOT (${gameScope}) ORDER BY id`,
    `SELECT ${columnSql(ASSET_LINK_COLUMNS)} FROM asset_links WHERE NOT (${linkScope}) ORDER BY id`,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${sqlList(WAVE_GUARD_TABLES)}) ORDER BY name`,
    `SELECT cid, name FROM pragma_table_info('content_assets') ORDER BY cid`,
    `SELECT cid, name FROM pragma_table_info('games') ORDER BY cid`,
    `SELECT cid, name FROM pragma_table_info('asset_links') ORDER BY cid`,
    ...assetReferenceTables().map((table) =>
      `SELECT ${sql(table)} AS table_name, fk."from" AS column_name, upper(fk.on_delete) AS on_delete FROM pragma_foreign_key_list(${sql(table)}) AS fk WHERE fk."table" = 'content_assets' ORDER BY fk."from"`),
    ...ASSET_REFERENCE_SPECS.map((spec) =>
      `SELECT * FROM ${quoteIdentifier(spec.table)} WHERE ${quoteIdentifier(spec.column)} IN (${sqlList(assetIds)}) ORDER BY 1`),
  ]
  const sets = await d1ResultSets(queries, options)
  const referenceTableCount = assetReferenceTables().length
  const referenceRowsOffset = 10 + referenceTableCount
  const references = {}
  ASSET_REFERENCE_SPECS.forEach((spec, index) => {
    references[`${spec.table}.${spec.column}`] = sets[referenceRowsOffset + index]
  })
  return {
    assets: sets[0],
    games: sets[1],
    links: sets[2],
    unrelated: { assets: sets[3], games: sets[4], links: sets[5] },
    guardTables: sets[6],
    schema: {
      contentAssetColumns: sets[7].map((row) => row.name),
      gameColumns: sets[8].map((row) => row.name),
      assetLinkColumns: sets[9].map((row) => row.name),
      foreignKeys: sets.slice(10, referenceRowsOffset).flat(),
    },
    references,
  }
}

function checkDbSchema(state) {
  assert(stableJson(state.schema.contentAssetColumns) === stableJson(CONTENT_ASSET_COLUMNS), 'content_assets schema changed; review importer guards before continuing')
  assert(stableJson(state.schema.gameColumns) === stableJson(GAME_COLUMNS), 'games schema changed; review importer guards before continuing')
  assert(stableJson(state.schema.assetLinkColumns) === stableJson(ASSET_LINK_COLUMNS), 'asset_links schema changed; review importer guards before continuing')
  const expectedForeignKeys = ASSET_REFERENCE_SPECS
    .map((spec) => ({ table_name: spec.table, column_name: spec.column, on_delete: spec.onDelete }))
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
  const actualForeignKeys = [...state.schema.foreignKeys]
    .sort((left, right) => stableJson(left).localeCompare(stableJson(right)))
  assert(
    stableJson(actualForeignKeys) === stableJson(expectedForeignKeys),
    `content_assets foreign-key surface changed: ${stableJson(actualForeignKeys)}`,
  )
}

function checkDbPreflight(manifest, state) {
  assert(state.guardTables.length === 0, `Stale Wave operation table(s) exist: ${state.guardTables.map((row) => row.name).join(', ')}`)
  checkDbSchema(state)
  assert(state.games.length === EXPECTED_COUNTS.games, `Expected 18 target games in D1, found ${state.games.length}`)
  const gamePlanById = new Map(manifest.games.map((game) => [game.game_id, game]))
  for (const row of state.games) {
    const plan = gamePlanById.get(row.id)
    assert(plan, `Unexpected game row ${row.id}`)
    assert(row.engine_id === plan.engine_id, `${row.id}: D1 engine drifted to ${row.engine_id}`)
    let current
    try { current = JSON.parse(row.content_pack) } catch { fail(`${row.id}: current D1 GamePack is invalid JSON`) }
    const currentHash = jsonHash(current)
    assert(
      currentHash === plan.original_pack_sha256 || currentHash === plan.replacement_pack_sha256,
      `${row.id}: D1 GamePack drifted from both guarded versions (${currentHash})`,
    )
  }

  for (const row of state.assets) {
    const matches = manifest.assets.filter((record) =>
      record.id === row.id ||
      record.expected_path === row.expected_path ||
      record.r2_key === row.r2_key)
    assert(matches.length === 1, `D1 content_asset collision around ${row.id}`)
    const expected = matches[0]
    assert(row.id === expected.id, `${expected.logical_key}: expected_path/r2_key belongs to different asset id ${row.id}`)
    assert(row.expected_path === expected.expected_path, `${row.id}: expected_path collision`)
    assert(row.r2_key === expected.r2_key, `${row.id}: immutable r2_key collision`)
    if (row.checksum_sha256) assert(row.checksum_sha256 === expected.checksum_sha256, `${row.id}: checksum collision`)
    if (row.bucket) assert(row.bucket === ASSET_BUCKET, `${row.id}: bucket collision`)
    if (row.visibility) assert(row.visibility === ASSET_VISIBILITY, `${row.id}: visibility collision`)
  }

  const plannedLinks = new Map(manifest.links.map((link) => [link.id, link]))
  for (const row of state.links.filter((link) => plannedLinks.has(link.id))) {
    const expected = plannedLinks.get(row.id)
    for (const field of ['asset_id', 'entity_type', 'entity_id', 'role', 'language', 'sort_order']) {
      assert(row[field] === expected[field], `${row.id}: link id collision in ${field}`)
    }
  }
}

function expectedAssetRow(record, prior, operationAt) {
  return {
    id: record.id,
    title_ar: record.title_ar,
    kind: 'image',
    source: 'generated',
    status: 'ready',
    original_filename: record.original_filename,
    expected_path: record.expected_path,
    r2_key: record.r2_key,
    bucket: ASSET_BUCKET,
    mime_type: record.mime_type,
    size_bytes: record.size_bytes,
    checksum_sha256: record.checksum_sha256,
    etag: prior?.etag ?? null,
    visibility: ASSET_VISIBILITY,
    language: prior?.language ?? null,
    quality: record.quality,
    version: prior?.version ?? 1,
    expected_width: record.width,
    expected_height: record.height,
    aspect_ratio: `${record.width}:${record.height}`,
    prompt: null,
    visual_style_id: null,
    metadata: JSON.stringify(record.metadata),
    uploaded_by: IMPORT_ACTOR,
    created_at: prior?.created_at ?? operationAt,
    updated_at: operationAt,
  }
}

function buildD1OperationPlan(manifest, before) {
  const operationAt = new Date().toISOString()
  const priorAssets = new Map(before.assets.map((row) => [row.id, row]))
  const gamePlans = new Map(manifest.games.map((game) => [game.game_id, game]))
  const assetsAfter = manifest.assets.map((record) =>
    expectedAssetRow(record, priorAssets.get(record.id), operationAt))
  const gamesAfter = before.games.map((row) => ({
    ...row,
    content_pack: JSON.stringify(gamePlans.get(row.id).replacement_pack),
    updated_at: operationAt,
  }))
  const linksAfter = manifest.links.map((link) => ({ ...link, created_at: operationAt }))
  return {
    operation_at: operationAt,
    assets_after_registration: assetsAfter,
    games_after_cutover: gamesAfter,
    links_after_cutover: linksAfter,
  }
}

function rowExactClause(row, columns) {
  return columns.map((column) => {
    assert(Object.hasOwn(row, column), `Missing ${column} while building exact row guard`)
    return `${quoteIdentifier(column)} IS ${sql(row[column])}`
  }).join(' AND ')
}

function insertRowsSql(table, columns, rows, expressions = {}) {
  return rows.map((row) => {
    const values = columns.map((column) => {
      assert(Object.hasOwn(row, column), `Missing ${column} while inserting expected ${table} row`)
      return Object.hasOwn(expressions, column) ? expressions[column] : sql(row[column])
    })
    return `INSERT INTO ${quoteIdentifier(table)} (${columnSql(columns)}) VALUES (${values.join(', ')});`
  })
}

function guardScalarSql(kind, expression, expected) {
  return `INSERT INTO __wave_asset_operation_guard_v2 (kind, actual, expected) SELECT ${sql(kind)}, (${expression}), ${Number(expected)};`
}

function guardChangesSql(kind, expected = 1) {
  return guardScalarSql(kind, 'SELECT changes()', expected)
}

function schemaGuardSql() {
  const statements = [
    guardScalarSql('schema_assets_column_count', `SELECT COUNT(*) FROM pragma_table_info('content_assets')`, CONTENT_ASSET_COLUMNS.length),
    guardScalarSql('schema_assets_column_identity', `SELECT COUNT(*) FROM pragma_table_info('content_assets') WHERE name IN (${sqlList(CONTENT_ASSET_COLUMNS)})`, CONTENT_ASSET_COLUMNS.length),
    guardScalarSql('schema_games_column_count', `SELECT COUNT(*) FROM pragma_table_info('games')`, GAME_COLUMNS.length),
    guardScalarSql('schema_games_column_identity', `SELECT COUNT(*) FROM pragma_table_info('games') WHERE name IN (${sqlList(GAME_COLUMNS)})`, GAME_COLUMNS.length),
    guardScalarSql('schema_links_column_count', `SELECT COUNT(*) FROM pragma_table_info('asset_links')`, ASSET_LINK_COLUMNS.length),
    guardScalarSql('schema_links_column_identity', `SELECT COUNT(*) FROM pragma_table_info('asset_links') WHERE name IN (${sqlList(ASSET_LINK_COLUMNS)})`, ASSET_LINK_COLUMNS.length),
    guardScalarSql('schema_asset_reference_table_count', `SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name <> 'content_assets' AND instr(lower(COALESCE(sql, '')), 'content_assets') > 0`, assetReferenceTables().length),
  ]
  assetReferenceTables().forEach((table, index) => {
    const expected = ASSET_REFERENCE_SPECS.filter((spec) => spec.table === table)
    const identity = expected.map((spec) =>
      `(fk."from" = ${sql(spec.column)} AND upper(fk.on_delete) = ${sql(spec.onDelete)})`).join(' OR ')
    statements.push(
      guardScalarSql(`schema_asset_ref_${index}_count`, `SELECT COUNT(*) FROM pragma_foreign_key_list(${sql(table)}) AS fk WHERE fk."table" = 'content_assets'`, expected.length),
      guardScalarSql(`schema_asset_ref_${index}_identity`, `SELECT COUNT(*) FROM pragma_foreign_key_list(${sql(table)}) AS fk WHERE fk."table" = 'content_assets' AND (${identity})`, expected.length),
    )
  })
  return statements
}

function operationSetupSql() {
  return [
    'PRAGMA foreign_keys = ON;',
    `CREATE TABLE __wave_asset_operation_guard_v2 (
      kind TEXT PRIMARY KEY,
      actual INTEGER NOT NULL,
      expected INTEGER NOT NULL,
      CHECK (actual = expected)
    );`,
    `CREATE TABLE __wave_expected_assets_v2 AS SELECT ${columnSql(CONTENT_ASSET_COLUMNS)} FROM content_assets WHERE 0;`,
    `CREATE TABLE __wave_expected_games_v2 AS SELECT ${columnSql(GAME_COLUMNS)} FROM games WHERE 0;`,
    `CREATE TABLE __wave_expected_links_v2 AS SELECT ${columnSql(ASSET_LINK_COLUMNS)} FROM asset_links WHERE 0;`,
    ...schemaGuardSql(),
  ]
}

function operationCleanupSql() {
  return [
    'DROP TABLE IF EXISTS __wave_expected_assets_v2;',
    'DROP TABLE IF EXISTS __wave_expected_games_v2;',
    'DROP TABLE IF EXISTS __wave_expected_links_v2;',
    'DROP TABLE IF EXISTS __wave_operation_clock_v2;',
    'DROP TABLE __wave_asset_operation_guard_v2;',
  ]
}

function replaceExpectedRowsSql(table, columns, rows, expressions = {}) {
  return [
    `DELETE FROM ${quoteIdentifier(table)};`,
    ...insertRowsSql(table, columns, rows, expressions),
  ]
}

function exactSetGuardSql(kind, expectedTable, actualTable, columns, actualWhere, expectedCount) {
  const selected = columnSql(columns)
  return [
    guardScalarSql(`${kind}_expected_count`, `SELECT COUNT(*) FROM ${quoteIdentifier(expectedTable)}`, expectedCount),
    guardScalarSql(`${kind}_actual_count`, `SELECT COUNT(*) FROM ${quoteIdentifier(actualTable)} WHERE ${actualWhere}`, expectedCount),
    guardScalarSql(
      `${kind}_missing`,
      `SELECT COUNT(*) FROM (SELECT ${selected} FROM ${quoteIdentifier(expectedTable)} EXCEPT SELECT ${selected} FROM ${quoteIdentifier(actualTable)} WHERE ${actualWhere}) AS missing_rows`,
      0,
    ),
    guardScalarSql(
      `${kind}_unexpected`,
      `SELECT COUNT(*) FROM (SELECT ${selected} FROM ${quoteIdentifier(actualTable)} WHERE ${actualWhere} EXCEPT SELECT ${selected} FROM ${quoteIdentifier(expectedTable)}) AS unexpected_rows`,
      0,
    ),
  ]
}

function casUpdateSql(table, columns, current, next, kind, expressions = {}) {
  const assignments = columns
    .filter((column) => column !== 'id')
    .map((column) => `${quoteIdentifier(column)} = ${Object.hasOwn(expressions, column) ? expressions[column] : sql(next[column])}`)
  return [
    `UPDATE ${quoteIdentifier(table)} SET ${assignments.join(', ')} WHERE ${rowExactClause(current, columns)};`,
    guardChangesSql(kind),
  ]
}

function assetRegistrationSql(manifest, before, plan, auditId) {
  const priorAssets = new Map(before.assets.map((row) => [row.id, row]))
  const expectedAssets = new Map(plan.assets_after_registration.map((row) => [row.id, row]))
  const statements = [
    ...operationSetupSql(),
    ...replaceExpectedRowsSql('__wave_expected_assets_v2', CONTENT_ASSET_COLUMNS, before.assets),
    ...replaceExpectedRowsSql('__wave_expected_games_v2', GAME_COLUMNS, before.games),
    ...replaceExpectedRowsSql('__wave_expected_links_v2', ASSET_LINK_COLUMNS, before.links),
    ...exactSetGuardSql('register_assets_before', '__wave_expected_assets_v2', 'content_assets', CONTENT_ASSET_COLUMNS, assetScopeWhere(manifest), before.assets.length),
    ...exactSetGuardSql('register_games_before', '__wave_expected_games_v2', 'games', GAME_COLUMNS, gameScopeWhere(manifest), before.games.length),
    ...exactSetGuardSql('register_links_before', '__wave_expected_links_v2', 'asset_links', ASSET_LINK_COLUMNS, linkScopeWhere(manifest), before.links.length),
  ]

  manifest.assets.forEach((record, index) => {
    const expected = expectedAssets.get(record.id)
    const prior = priorAssets.get(record.id)
    if (prior) {
      statements.push(...casUpdateSql('content_assets', CONTENT_ASSET_COLUMNS, prior, expected, `register_asset_update_${index}`))
    } else {
      statements.push(...insertRowsSql('content_assets', CONTENT_ASSET_COLUMNS, [expected]))
      statements.push(guardChangesSql(`register_asset_insert_${index}`))
    }
  })

  statements.push(
    ...replaceExpectedRowsSql('__wave_expected_assets_v2', CONTENT_ASSET_COLUMNS, plan.assets_after_registration),
    ...exactSetGuardSql('register_assets_after', '__wave_expected_assets_v2', 'content_assets', CONTENT_ASSET_COLUMNS, assetScopeWhere(manifest), EXPECTED_COUNTS.assets),
    ...exactSetGuardSql('register_games_after', '__wave_expected_games_v2', 'games', GAME_COLUMNS, gameScopeWhere(manifest), before.games.length),
    ...exactSetGuardSql('register_links_after', '__wave_expected_links_v2', 'asset_links', ASSET_LINK_COLUMNS, linkScopeWhere(manifest), before.links.length),
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES (
      ${sql(auditId)}, ${sql(IMPORT_ACTOR)}, 'wave_asset_register', 'content_asset',
      ${sql(MANIFEST_ID)},
      ${sql(JSON.stringify({ assets: 107, bucket: PUBLIC_BUCKET, scope: 'wave-only', games_and_links_cas_unchanged: true }))}
    );`,
    ...operationCleanupSql(),
  )
  return statements
}

function assertPostRegistrationState(before, registered, plan) {
  checkDbSchema(registered)
  assert(registered.guardTables.length === 0, 'Registration left a Wave guard table behind')
  assertRowsExact(registered.assets, plan.assets_after_registration, 'Post-registration manifest assets')
  assertRowsExact(registered.games, before.games, 'Post-registration target games')
  assertRowsExact(registered.links, before.links, 'Post-registration target links')
  compareNonLinkReferences(before, registered, 'Post-registration')
  return compareUnrelatedScopes(before, registered, 'Post-registration')
}

function cutoverSql(manifest, before, plan, auditId) {
  const expectedGames = new Map(plan.games_after_cutover.map((row) => [row.id, row]))
  const statements = [
    ...operationSetupSql(),
    ...replaceExpectedRowsSql('__wave_expected_assets_v2', CONTENT_ASSET_COLUMNS, plan.assets_after_registration),
    ...replaceExpectedRowsSql('__wave_expected_games_v2', GAME_COLUMNS, before.games),
    ...replaceExpectedRowsSql('__wave_expected_links_v2', ASSET_LINK_COLUMNS, before.links),
    ...exactSetGuardSql('cutover_assets_before', '__wave_expected_assets_v2', 'content_assets', CONTENT_ASSET_COLUMNS, assetScopeWhere(manifest), EXPECTED_COUNTS.assets),
    ...exactSetGuardSql('cutover_games_before', '__wave_expected_games_v2', 'games', GAME_COLUMNS, gameScopeWhere(manifest), before.games.length),
    ...exactSetGuardSql('cutover_links_before', '__wave_expected_links_v2', 'asset_links', ASSET_LINK_COLUMNS, linkScopeWhere(manifest), before.links.length),
    `DELETE FROM asset_links WHERE ${linkScopeWhere(manifest)};`,
    guardChangesSql('cutover_links_delete', before.links.length),
  ]

  plan.links_after_cutover.forEach((row, index) => {
    statements.push(...insertRowsSql('asset_links', ASSET_LINK_COLUMNS, [row]))
    statements.push(guardChangesSql(`cutover_link_insert_${index}`))
  })
  before.games.forEach((row, index) => {
    statements.push(...casUpdateSql('games', GAME_COLUMNS, row, expectedGames.get(row.id), `cutover_game_update_${index}`))
  })

  statements.push(
    ...replaceExpectedRowsSql('__wave_expected_games_v2', GAME_COLUMNS, plan.games_after_cutover),
    ...replaceExpectedRowsSql('__wave_expected_links_v2', ASSET_LINK_COLUMNS, plan.links_after_cutover),
    ...exactSetGuardSql('cutover_assets_after', '__wave_expected_assets_v2', 'content_assets', CONTENT_ASSET_COLUMNS, assetScopeWhere(manifest), EXPECTED_COUNTS.assets),
    ...exactSetGuardSql('cutover_games_after', '__wave_expected_games_v2', 'games', GAME_COLUMNS, gameScopeWhere(manifest), EXPECTED_COUNTS.games),
    ...exactSetGuardSql('cutover_links_after', '__wave_expected_links_v2', 'asset_links', ASSET_LINK_COLUMNS, linkScopeWhere(manifest), EXPECTED_COUNTS.links),
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES (
      ${sql(auditId)}, ${sql(IMPORT_ACTOR)}, 'wave_pack_asset_cutover', 'game',
      ${sql(MANIFEST_ID)},
      ${sql(JSON.stringify({ games: 18, links: 36, gameplay_images: 71, exact_before_snapshot_cas: true }))}
    );`,
    ...operationCleanupSql(),
  )
  return statements
}

function rollbackReferenceGuardSql(manifest, before, plan) {
  const beforeIds = new Set(before.assets.map((row) => row.id))
  const newIds = plan.assets_after_registration.filter((row) => !beforeIds.has(row.id)).map((row) => row.id)
  if (newIds.length === 0) return []
  const plannedLinkIds = plan.links_after_cutover.map((row) => row.id)
  const statements = []
  for (const spec of ASSET_REFERENCE_SPECS) {
    let query = `SELECT COUNT(*) FROM ${quoteIdentifier(spec.table)} WHERE ${quoteIdentifier(spec.column)} IN (${sqlList(newIds)})`
    if (spec.table === 'asset_links') query += ` AND id NOT IN (${sqlList(plannedLinkIds)})`
    statements.push(guardScalarSql(`rollback_new_ref_${spec.table}_${spec.column}`, query, 0))
  }
  statements.push(
    guardScalarSql(
      'rollback_new_ref_non_target_game_json',
      `SELECT COUNT(*) FROM games AS game, json_tree(CASE WHEN json_valid(game.content_pack) THEN game.content_pack ELSE '{}' END) AS node WHERE game.id NOT IN (${sqlList(manifest.games.map((game) => game.game_id))}) AND node.type = 'text' AND node.value IN (${sqlList(newIds)})`,
      0,
    ),
    guardScalarSql(
      'rollback_new_ref_question_media_json',
      `SELECT COUNT(*) FROM questions AS question, json_each(CASE WHEN json_valid(question.media_asset_ids) THEN question.media_asset_ids ELSE '[]' END) AS item WHERE item.value IN (${sqlList(newIds)})`,
      0,
    ),
  )
  return statements
}

function rollbackSql(manifest, before, plan, snapshotId) {
  const priorAssets = new Map(before.assets.map((row) => [row.id, row]))
  const expectedAssets = new Map(plan.assets_after_registration.map((row) => [row.id, row]))
  const currentGames = new Map(plan.games_after_cutover.map((row) => [row.id, row]))
  const clockExpression = '(SELECT value FROM __wave_operation_clock_v2)'
  const restoredAssets = before.assets.map((row) => ({ ...row, updated_at: null }))
  const restoredGames = before.games.map((row) => ({ ...row, updated_at: null }))
  const statements = [
    ...operationSetupSql(),
    'CREATE TABLE __wave_operation_clock_v2 (value TEXT NOT NULL);',
    `INSERT INTO __wave_operation_clock_v2 (value) VALUES (datetime('now'));`,
    ...replaceExpectedRowsSql('__wave_expected_assets_v2', CONTENT_ASSET_COLUMNS, plan.assets_after_registration),
    ...replaceExpectedRowsSql('__wave_expected_games_v2', GAME_COLUMNS, plan.games_after_cutover),
    ...replaceExpectedRowsSql('__wave_expected_links_v2', ASSET_LINK_COLUMNS, plan.links_after_cutover),
    ...exactSetGuardSql('rollback_assets_before', '__wave_expected_assets_v2', 'content_assets', CONTENT_ASSET_COLUMNS, assetScopeWhere(manifest), EXPECTED_COUNTS.assets),
    ...exactSetGuardSql('rollback_games_before', '__wave_expected_games_v2', 'games', GAME_COLUMNS, gameScopeWhere(manifest), EXPECTED_COUNTS.games),
    ...exactSetGuardSql('rollback_links_before', '__wave_expected_links_v2', 'asset_links', ASSET_LINK_COLUMNS, linkScopeWhere(manifest), EXPECTED_COUNTS.links),
    ...rollbackReferenceGuardSql(manifest, before, plan),
  ]

  plan.links_after_cutover.forEach((row, index) => {
    statements.push(`DELETE FROM asset_links WHERE ${rowExactClause(row, ASSET_LINK_COLUMNS)};`)
    statements.push(guardChangesSql(`rollback_link_delete_${index}`))
  })
  before.games.forEach((row, index) => {
    const current = currentGames.get(row.id)
    statements.push(
      `UPDATE games SET content_pack = ${sql(row.content_pack)}, updated_at = ${clockExpression} WHERE ${rowExactClause(current, GAME_COLUMNS)};`,
      guardChangesSql(`rollback_game_restore_${index}`),
    )
  })
  plan.assets_after_registration.forEach((current, index) => {
    const prior = priorAssets.get(current.id)
    if (prior) {
      const restored = { ...prior, updated_at: null }
      statements.push(...casUpdateSql('content_assets', CONTENT_ASSET_COLUMNS, current, restored, `rollback_asset_restore_${index}`, { updated_at: clockExpression }))
    } else {
      statements.push(
        `DELETE FROM content_assets WHERE ${rowExactClause(expectedAssets.get(current.id), CONTENT_ASSET_COLUMNS)};`,
        guardChangesSql(`rollback_asset_delete_${index}`),
      )
    }
  })
  before.links.forEach((row, index) => {
    statements.push(...insertRowsSql('asset_links', ASSET_LINK_COLUMNS, [row]))
    statements.push(guardChangesSql(`rollback_link_restore_${index}`))
  })

  statements.push(
    ...replaceExpectedRowsSql('__wave_expected_assets_v2', CONTENT_ASSET_COLUMNS, restoredAssets, { updated_at: clockExpression }),
    ...replaceExpectedRowsSql('__wave_expected_games_v2', GAME_COLUMNS, restoredGames, { updated_at: clockExpression }),
    ...replaceExpectedRowsSql('__wave_expected_links_v2', ASSET_LINK_COLUMNS, before.links),
    ...exactSetGuardSql('rollback_assets_after', '__wave_expected_assets_v2', 'content_assets', CONTENT_ASSET_COLUMNS, assetScopeWhere(manifest), before.assets.length),
    ...exactSetGuardSql('rollback_games_after', '__wave_expected_games_v2', 'games', GAME_COLUMNS, gameScopeWhere(manifest), before.games.length),
    ...exactSetGuardSql('rollback_links_after', '__wave_expected_links_v2', 'asset_links', ASSET_LINK_COLUMNS, linkScopeWhere(manifest), before.links.length),
    `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES (
      ${sql(randomUUID())}, ${sql(IMPORT_ACTOR)}, 'wave_asset_rollback', 'game',
      ${sql(MANIFEST_ID)},
      ${sql(JSON.stringify({ snapshot_id: snapshotId, strict_current_state_guards: true, r2_objects_deleted: false }))}
    );`,
    ...operationCleanupSql(),
  )
  return statements
}

async function writeRollbackBundle(manifest, before, plan, options) {
  await fs.mkdir(workDir, { recursive: true })
  const timestamp = plan.operation_at.replaceAll(':', '-').replaceAll('.', '-')
  const target = options.remote ? 'production' : 'local'
  const snapshotId = `wave-rollback-${target}-${timestamp}`
  const jsonPath = path.join(workDir, `${snapshotId}.json`)
  const sqlPath = path.join(workDir, `${snapshotId}.sql`)
  const existingIds = new Set(before.assets.map((row) => row.id))
  const bundle = {
    snapshot_id: snapshotId,
    manifest_id: manifest.manifest_id,
    target,
    created_at: plan.operation_at,
    games_before: before.games,
    target_links_before: before.links,
    content_assets_before: before.assets,
    expected_after_registration: plan.assets_after_registration,
    expected_games_after_cutover: plan.games_after_cutover,
    expected_links_after_cutover: plan.links_after_cutover,
    newly_registered_asset_ids: manifest.assets.filter((record) => !existingIds.has(record.id)).map((record) => record.id),
    unrelated_scope_before: unrelatedFingerprints(before),
    non_link_reference_fingerprints_before: Object.fromEntries(
      ASSET_REFERENCE_SPECS
        .filter((spec) => spec.table !== 'asset_links')
        .map((spec) => [`${spec.table}.${spec.column}`, rowsFingerprint(before.references[`${spec.table}.${spec.column}`])]),
    ),
    schema_identity: before.schema,
    rollback_guards: {
      exact_current_assets: EXPECTED_COUNTS.assets,
      exact_current_games: EXPECTED_COUNTS.games,
      exact_current_links: EXPECTED_COUNTS.links,
      reject_new_non_planned_references: true,
      restored_updated_at_uses_execution_time: true,
    },
    r2_policy: 'Immutable R2 objects are retained by rollback and require a separately approved targeted cleanup.',
  }
  await fs.writeFile(jsonPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8')
  await fs.writeFile(sqlPath, `${rollbackSql(manifest, before, plan, snapshotId).join('\n')}\n`, 'utf8')
  return { snapshotId, jsonPath, sqlPath }
}

async function verifyD1(manifest, options, expected = null) {
  const state = await loadDbState(manifest, options)
  checkDbSchema(state)
  assert(state.guardTables.length === 0, 'D1 verification found a stale Wave operation table')
  const manifestAssets = new Map(manifest.assets.map((record) => [record.id, record]))
  const exactRows = state.assets.filter((row) => manifestAssets.has(row.id))
  assert(exactRows.length === EXPECTED_COUNTS.assets, `D1 has ${exactRows.length}/107 manifest content_assets`)
  for (const row of exactRows) {
    const record = manifestAssets.get(row.id)
    const expectedFields = {
      expected_path: record.expected_path,
      r2_key: record.r2_key,
      mime_type: record.mime_type,
      checksum_sha256: record.checksum_sha256,
      status: 'ready',
      source: 'generated',
      bucket: ASSET_BUCKET,
      visibility: ASSET_VISIBILITY,
    }
    for (const [field, value] of Object.entries(expectedFields)) {
      assert(row[field] === value, `${row.id}: D1 ${field} mismatch`)
    }
    assert(Number(row.size_bytes) === record.size_bytes, `${row.id}: D1 size mismatch`)
    assert(Number(row.expected_width) === record.width, `${row.id}: D1 width mismatch`)
    assert(Number(row.expected_height) === record.height, `${row.id}: D1 height mismatch`)
    const metadata = JSON.parse(row.metadata)
    assert(metadata.ownership === 'Majarra' && metadata.manifest_id === SOURCE_MANIFEST_ID, `${row.id}: D1 metadata lineage mismatch`)
    assert(metadata.review_states.every((review) => review.endsWith('_PENDING')), `${row.id}: D1 metadata auto-approved a review`)
  }

  const targetLinks = state.links.filter((link) =>
    link.entity_type === 'game' &&
    manifest.games.some((game) => game.game_id === link.entity_id) &&
    ['cover', 'thumbnail'].includes(link.role))
  assert(targetLinks.length === EXPECTED_COUNTS.links, `D1 has ${targetLinks.length}/36 target links`)
  const expectedLinks = new Map(manifest.links.map((link) => [link.id, link]))
  for (const row of targetLinks) {
    const planned = expectedLinks.get(row.id)
    assert(planned, `Unexpected Wave cover/thumbnail link ${row.id}`)
    for (const field of ['asset_id', 'entity_type', 'entity_id', 'role', 'language', 'sort_order']) {
      assert(row[field] === planned[field], `${row.id}: link mismatch in ${field}`)
    }
  }

  assert(state.games.length === EXPECTED_COUNTS.games, `D1 has ${state.games.length}/18 Wave games`)
  const plans = new Map(manifest.games.map((game) => [game.game_id, game]))
  const referencedImages = new Set()
  const genericVisualIds = new Set()
  let providerOrLocalPathReferences = 0
  for (const row of state.games) {
    const game = plans.get(row.id)
    assert(game, `Unexpected Wave game ${row.id}`)
    assert(row.engine_id === game.engine_id, `${row.id}: engine changed during cutover`)
    const pack = JSON.parse(row.content_pack)
    assert(jsonHash(pack) === game.replacement_pack_sha256, `${row.id}: replacement GamePack is not active`)
    const serialized = JSON.stringify(pack)
    if (FORBIDDEN_PACK_STRING.test(serialized)) providerOrLocalPathReferences += 1
    validatePackSafety({ ...game, replacement_pack: pack })
    for (const image of pack.assets.images) {
      referencedImages.add(image)
      if (FORBIDDEN_VISUAL_ID.test(image)) genericVisualIds.add(image)
    }
  }
  assert(referencedImages.size === EXPECTED_COUNTS.gameplay, `GamePacks reference ${referencedImages.size}/71 distinct gameplay images`)
  let unavailableImageReferences = 0
  for (const id of referencedImages) {
    const record = manifestAssets.get(id)
    const row = exactRows.find((asset) => asset.id === id)
    if (!(record?.usage === 'gameplay' && row?.status === 'ready')) unavailableImageReferences += 1
  }
  assert(unavailableImageReferences === 0, `GamePacks contain ${unavailableImageReferences} unavailable image reference(s)`)

  let unrelatedScopeChanges = null
  let lifecycleChanges = null
  if (expected) {
    assertRowsExact(state.assets, expected.plan.assets_after_registration, 'Final manifest assets')
    assertRowsExact(state.games, expected.plan.games_after_cutover, 'Final target games')
    assertRowsExact(state.links, expected.plan.links_after_cutover, 'Final target links')
    compareNonLinkReferences(expected.before, state, 'Final verification')
    unrelatedScopeChanges = compareUnrelatedScopes(expected.before, state, 'Final verification').total
    const beforeStatuses = new Map(expected.before.games.map((row) => [row.id, row.status]))
    lifecycleChanges = state.games.filter((row) => row.status !== beforeStatuses.get(row.id)).length
    assert(lifecycleChanges === 0, `Lifecycle changed for ${lifecycleChanges} Wave game(s)`)
  }

  return {
    ready_generated_images: exactRows.length,
    public_thumbs_with_key_and_checksum: exactRows.filter((row) => row.visibility === 'public' && row.bucket === 'thumbs' && row.r2_key && row.checksum_sha256).length,
    links: targetLinks.length,
    replacement_packs_active: state.games.length,
    gameplay_image_ids: referencedImages.size,
    unavailable_image_references: unavailableImageReferences,
    generic_visual_ids: genericVisualIds.size,
    provider_or_local_path_references: providerOrLocalPathReferences,
    unrelated_scope_changes: unrelatedScopeChanges,
    lifecycle_changes: lifecycleChanges,
    review_state_validation: 'all imported metadata review states remain pending',
  }
}

async function applyD1(manifest, options) {
  console.log('Verifying all R2 object bodies before any D1 registration...')
  const r2Verification = await verifyR2(manifest, options)
  if (!options.remote) {
    console.log('Local R2 limitation: Content-Type and Cache-Control cannot be read through Wrangler local R2; body bytes were verified.')
  }
  const before = await loadDbState(manifest, options)
  checkDbPreflight(manifest, before)
  const plan = buildD1OperationPlan(manifest, before)
  const rollback = await writeRollbackBundle(manifest, before, plan, options)
  console.log(`Rollback snapshot: ${path.relative(rootDir, rollback.jsonPath)}`)
  console.log(`Rollback SQL: ${path.relative(rootDir, rollback.sqlPath)}`)

  await runD1File(assetRegistrationSql(manifest, before, plan, randomUUID()), 'wave-assets-register', options)
  const registered = await loadDbState(manifest, options)
  const registrationMeasurement = assertPostRegistrationState(before, registered, plan)

  // The second read is diagnostic only. The cutover batch repeats exact guards for
  // all original games/links and all 107 registered assets, anchored to `before`.
  await runD1File(cutoverSql(manifest, before, plan, randomUUID()), 'wave-pack-cutover', options)
  const summary = await verifyD1(manifest, options, { before, plan })
  return { summary: { ...summary, r2_body_verified_before_d1: r2Verification.body_verified, registration_unrelated_scope_changes: registrationMeasurement.total }, rollback }
}

function printPlan(manifest, validated, target = 'none') {
  console.log(JSON.stringify({
    manifest_id: manifest.manifest_id,
    target,
    mode: target === 'none' ? 'dry-run' : 'verification',
    assets: manifest.counts.assets,
    canonical: manifest.counts.canonical,
    covers: manifest.counts.covers,
    gameplay: manifest.counts.gameplay,
    thumbnails: manifest.counts.thumbnails,
    png: manifest.counts.png,
    webp: manifest.counts.webp,
    bytes: validated.totalBytes,
    links: manifest.counts.links,
    games: manifest.counts.games,
    bucket: PUBLIC_BUCKET,
    declared_policy: {
      lifecycle_change: 'forbidden',
      human_review_auto_approval: 'forbidden',
      provider_or_local_references: 'forbidden',
      broad_deletes: 'forbidden',
    },
    measurement_scope: target === 'none'
      ? 'manifest and local source files only; no database before/after measurement was performed'
      : 'target verification; unrelated/lifecycle deltas require an apply baseline and are null in standalone verification',
  }, null, 2))
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.writeManifest) {
    const manifest = await buildIngestManifest()
    await validateManifest(manifest, { verifyFiles: true })
    await fs.writeFile(ingestManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${path.relative(rootDir, ingestManifestPath)} (${manifest.assets.length} assets, ${manifest.links.length} links, ${manifest.games.length} games).`)
    return
  }

  const [{ value: manifest }, rebuilt] = await Promise.all([
    readJson(ingestManifestPath),
    buildIngestManifest(),
  ])
  assert(stableJson(manifest) === stableJson(rebuilt), 'Checked-in wave-ingest.manifest.json is stale; run --write-manifest and review the diff')
  const validated = await validateManifest(manifest, { verifyFiles: true })

  if (options.dryRun) {
    printPlan(manifest, validated)
    return
  }

  const target = options.remote ? 'PRODUCTION' : 'local'
  if (options.phase === 'r2') {
    const upload = await uploadR2(manifest, options)
    const verification = await verifyR2(manifest, options)
    console.log(JSON.stringify({ target, phase: 'r2', upload, verification }, null, 2))
    return
  }
  if (options.phase === 'd1') {
    const result = await applyD1(manifest, options)
    console.log(JSON.stringify({
      target,
      phase: 'd1',
      ...result.summary,
      rollback_snapshot: path.relative(rootDir, result.rollback.jsonPath),
      rollback_sql: path.relative(rootDir, result.rollback.sqlPath),
    }, null, 2))
    return
  }
  if (options.verify) {
    const r2 = await verifyR2(manifest, options)
    const d1 = await verifyD1(manifest, options)
    printPlan(manifest, validated, target)
    console.log(JSON.stringify({ target, r2, d1 }, null, 2))
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
