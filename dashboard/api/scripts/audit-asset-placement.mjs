/**
 * Audits every content_asset against the corrected public/private classification
 * and the finalized bucket architecture, without changing anything.
 *
 * Emits a JSON plan consumed by migrate-asset-buckets.mjs so the decision logic
 * is reviewable before any object moves. See src/lib/assetClassification.ts and
 * src/lib/assetBuckets.ts for the rules.
 *
 * Usage: node scripts/audit-asset-placement.mjs [--out plan.json]
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, '..');
const rootDir = path.resolve(apiDir, '..', '..');
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');

const outArg = process.argv.find((a) => a.startsWith('--out='));
const outPath = outArg ? outArg.split('=')[1] : path.join(apiDir, '.tmp', 'asset-placement-plan.json');

// ---------------------------------------------------------------------------
// Classification, kept identical to src/lib/assetClassification.ts.
// ---------------------------------------------------------------------------
const PUBLIC_ARTWORK_SEGMENTS = [
  'landing', 'marketing', 'worlds', 'store', 'series', 'episodes', 'planets',
  'characters', 'books', 'games', 'stories', 'projects', 'quizzes',
  'flashcards', 'activities', 'audio', 'islamic', 'app',
];
const PRIVATE_MEDIA_SEGMENTS = ['downloads', 'packs', 'streams', 'video'];
const PUBLIC_ARTWORK_PATTERN = new RegExp(`/(${PUBLIC_ARTWORK_SEGMENTS.join('|')})/`);
const PRIVATE_MEDIA_PATTERN = new RegExp(`/(${PRIVATE_MEDIA_SEGMENTS.join('|')})/`);
const ALWAYS_PRIVATE_KINDS = ['video', 'archive'];

function inferVisibilityFromPath(rawPath) {
  const normalized = `/${String(rawPath ?? '').replace(/\\/g, '/').replace(/^\/+/, '').toLowerCase()}`;
  if (PRIVATE_MEDIA_PATTERN.test(normalized)) return 'private';
  return PUBLIC_ARTWORK_PATTERN.test(normalized) ? 'public' : 'private';
}

function correctedVisibility(asset) {
  if (asset.kind && ALWAYS_PRIVATE_KINDS.includes(asset.kind)) return 'private';
  const source = (asset.expected_path ?? '').trim()
    || String(asset.r2_key ?? '').replace(/^(public|private)\/(catalog\/)?/, '');
  if (!source) return 'private';
  return inferVisibilityFromPath(source);
}

function bucketForVisibility(visibility, kind) {
  if (kind && ALWAYS_PRIVATE_KINDS.includes(kind)) return 'media';
  return visibility === 'public' ? 'thumbs' : 'media';
}

function rekey(key, visibility, kind) {
  const scope = bucketForVisibility(visibility, kind) === 'thumbs' ? 'public' : 'private';
  const trimmed = String(key ?? '').replace(/^\/+/, '');
  if (!trimmed) return null;
  if (trimmed.startsWith(`${scope}/`)) return trimmed;
  return `${scope}/${trimmed.replace(/^(public|private)\//, '')}`;
}

// ---------------------------------------------------------------------------

function run(args) {
  return new Promise((resolve, reject) => {
    // Windows needs a shell to launch wrangler.cmd (spawn EINVAL otherwise), so
    // every argument must be free of spaces. SQL therefore travels via
    // --file=<path> and never inline: passing a statement here gets split on
    // spaces and wrangler rejects the fragments as unknown arguments.
    const child = spawn(wrangler, args, { cwd: apiDir, shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`wrangler ${args.join(' ')} exited ${code}\n${stderr}`));
    });
  });
}

/// Queries local D1 via a SQL file so no statement ever crosses a shell.
async function d1(sql) {
  const tempDir = path.join(apiDir, '.tmp');
  await fs.mkdir(tempDir, { recursive: true });
  const sqlPath = path.join(tempDir, `audit-${createHash('sha1').update(sql).digest('hex').slice(0, 12)}.sql`);
  await fs.writeFile(sqlPath, sql, 'utf8');
  try {
    const out = await run(['d1', 'execute', 'majarra-db', '--local', '--json', `--file=${sqlPath}`]);
    const start = out.indexOf('[');
    const parsed = JSON.parse(out.slice(start));
    return parsed[0]?.results ?? [];
  } finally {
    await fs.rm(sqlPath, { force: true });
  }
}

async function main() {
  const assets = await d1(`
    SELECT id, title_ar, kind, status, visibility, bucket, r2_key, expected_path,
           original_filename, size_bytes, checksum_sha256, mime_type, metadata
    FROM content_assets ORDER BY expected_path
  `.replace(/\s+/g, ' ').trim());

  const linkCounts = await d1(
    'SELECT asset_id, COUNT(*) AS n FROM asset_links GROUP BY asset_id',
  );
  const linksByAsset = new Map(linkCounts.map((r) => [r.asset_id, Number(r.n)]));

  const plan = [];
  const counts = {
    inspected: 0,
    already_correct: 0,
    needs_move: 0,
    needs_visibility_change: 0,
    needs_bucket_change: 0,
    needs_rekey: 0,
    no_object_yet: 0,
    source_missing: 0,
    always_private_kind: 0,
    duplicate_target_key: 0,
    migrate_via_r2_copy: 0,
  };
  const targetKeys = new Map();

  for (const asset of assets) {
    counts.inspected += 1;
    const metadata = (() => { try { return JSON.parse(asset.metadata ?? '{}'); } catch { return {}; } })();
    const targetVisibility = correctedVisibility(asset);
    const targetBucket = bucketForVisibility(targetVisibility, asset.kind);
    const targetKey = rekey(asset.r2_key, targetVisibility, asset.kind);

    if (ALWAYS_PRIVATE_KINDS.includes(asset.kind)) counts.always_private_kind += 1;

    // Resolve the original source file so the object can be re-uploaded from
    // authoritative bytes rather than copied between local buckets.
    let sourceAbsolute = null;
    if (metadata.imported_from) {
      const candidate = path.join(rootDir, metadata.imported_from);
      try { await fs.access(candidate); sourceAbsolute = candidate; } catch { /* fall through */ }
    }

    // Assets uploaded straight through the admin API have no filesystem
    // provenance. Their bytes only exist in R2, so the existing object is the
    // source and the migration copies bucket-to-bucket instead.
    const r2Source = !sourceAbsolute && asset.r2_key && asset.status === 'ready'
      ? { bucket: asset.bucket ?? 'media', r2_key: asset.r2_key }
      : null;

    const entry = {
      id: asset.id,
      kind: asset.kind,
      status: asset.status,
      expected_path: asset.expected_path,
      links: linksByAsset.get(asset.id) ?? 0,
      current: { visibility: asset.visibility, bucket: asset.bucket, r2_key: asset.r2_key },
      target: { visibility: targetVisibility, bucket: targetBucket, r2_key: targetKey },
      source_absolute: sourceAbsolute,
      r2_source: r2Source,
      checksum_sha256: asset.checksum_sha256,
      size_bytes: asset.size_bytes,
      mime_type: asset.mime_type,
      original_filename: asset.original_filename,
    };

    if (!asset.r2_key) {
      entry.action = 'no_object_yet';
      counts.no_object_yet += 1;
    } else {
      const visibilityChange = asset.visibility !== targetVisibility;
      const bucketChange = (asset.bucket ?? null) !== targetBucket;
      const keyChange = asset.r2_key !== targetKey;
      if (visibilityChange) counts.needs_visibility_change += 1;
      if (bucketChange) counts.needs_bucket_change += 1;
      if (keyChange) counts.needs_rekey += 1;

      if (!visibilityChange && !bucketChange && !keyChange) {
        entry.action = 'already_correct';
        counts.already_correct += 1;
      } else if (!sourceAbsolute && !r2Source) {
        entry.action = 'manual_review_source_missing';
        counts.source_missing += 1;
      } else {
        entry.action = 'migrate';
        entry.source_mode = sourceAbsolute ? 'filesystem' : 'r2_copy';
        counts.needs_move += 1;
        if (!sourceAbsolute) counts.migrate_via_r2_copy += 1;
      }

      const seen = targetKeys.get(targetKey);
      if (seen) {
        entry.action = 'duplicate_target_key';
        entry.duplicate_of = seen;
        counts.duplicate_target_key += 1;
      } else {
        targetKeys.set(targetKey, asset.id);
      }
    }

    plan.push(entry);
  }

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ generated_at: new Date().toISOString(), counts, plan }, null, 2), 'utf8');

  console.log('Asset placement audit');
  for (const [key, value] of Object.entries(counts)) console.log(`  ${key.padEnd(26)} ${value}`);
  const byAction = plan.reduce((acc, e) => { acc[e.action] = (acc[e.action] ?? 0) + 1; return acc; }, {});
  console.log('\nBy action:');
  for (const [action, n] of Object.entries(byAction)) console.log(`  ${action.padEnd(30)} ${n}`);
  console.log(`\nPlan written to ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
