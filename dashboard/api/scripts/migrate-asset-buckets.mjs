/**
 * Migrates existing catalogue assets onto the finalized bucket architecture.
 *
 *   THUMBS_BUCKET (majarra-thumbs) = public catalogue artwork, CDN origin
 *   MEDIA_BUCKET  (majarra-media)  = private video/streams/downloads, never CDN
 *
 * These assets were imported before the visibility/key classification fix, so
 * catalogue artwork carries `private/` keys inside the private bucket and can
 * never resolve on cdn.majarra.app.
 *
 * ## Safety properties
 *
 * - **Idempotent.** Every step re-checks live state, so re-running converges.
 *   An asset already at its target key with a matching SHA-256 is skipped.
 * - **Resumable.** Progress lives in R2 and D1, not in memory. Killing the
 *   process mid-run and restarting continues where it stopped.
 * - **Non-destructive.** Originals are left in place. D1 is only repointed after
 *   the replacement object is verified byte-for-byte by SHA-256. Deleting the
 *   originals is a separate opt-in pass (`--delete-originals`) that re-verifies
 *   the replacement first and refuses to delete anything still referenced.
 * - **Copy-then-verify-then-flip.** At no point is an asset row pointing at an
 *   object that does not exist.
 *
 * Usage:
 *   node scripts/migrate-asset-buckets.mjs --dry-run
 *   node scripts/migrate-asset-buckets.mjs [--limit=N] [--concurrency=N]
 *   node scripts/migrate-asset-buckets.mjs --delete-originals
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(scriptDir, '..');
const wrangler = path.join(apiDir, 'node_modules', '.bin', process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler');
const tempDir = path.join(apiDir, '.tmp');
const workDir = path.join(tempDir, 'bucket-migration');

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const valueOf = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`${name}=`));
  return found ? found.split('=')[1] : fallback;
};

const dryRun = has('--dry-run');
const isRemote = has('--remote');
const deleteOriginals = has('--delete-originals');
const limit = Number(valueOf('--limit', '0')) || 0;
const concurrency = Math.min(Math.max(Number(valueOf('--concurrency', '4')), 1), 8);
const planPath = valueOf('--plan', path.join(tempDir, 'asset-placement-plan.json'));
const targetFlag = isRemote ? '--remote' : '--local';

/// Local buckets are addressed by their configured bucket_name, which carries a
/// -dev suffix in the development environment.
const BUCKET_NAME = {
  media: isRemote ? 'majarra-media' : 'majarra-media-dev',
  thumbs: isRemote ? 'majarra-thumbs' : 'majarra-thumbs-dev',
};

const CACHE_CONTROL = {
  public: 'public,max-age=31536000,immutable',
  private: 'private,no-store',
};

function run(cmdArgs, { allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    // Windows needs a shell to launch wrangler.cmd, so every argument must be
    // free of spaces: SQL travels via --file=, never inline.
    const child = spawn(wrangler, cmdArgs, { cwd: apiDir, shell: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) resolve({ code, stdout, stderr });
      else reject(new Error(`wrangler ${cmdArgs.join(' ')} exited ${code}\n${stderr}`));
    });
  });
}

async function d1Query(sql) {
  await fs.mkdir(tempDir, { recursive: true });
  const sqlPath = path.join(tempDir, `mig-q-${createHash('sha1').update(sql).digest('hex').slice(0, 12)}.sql`);
  await fs.writeFile(sqlPath, sql, 'utf8');
  try {
    const { stdout } = await run(['d1', 'execute', 'majarra-db', targetFlag, '--json', `--file=${sqlPath}`]);
    return JSON.parse(stdout.slice(stdout.indexOf('[')))[0]?.results ?? [];
  } finally {
    await fs.rm(sqlPath, { force: true });
  }
}

async function d1Exec(statements) {
  if (!statements.length) return;
  await fs.mkdir(tempDir, { recursive: true });
  const sqlPath = path.join(tempDir, `mig-x-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sql`);
  await fs.writeFile(sqlPath, statements.join('\n'), 'utf8');
  try {
    await run(['d1', 'execute', 'majarra-db', targetFlag, `--file=${sqlPath}`]);
  } finally {
    await fs.rm(sqlPath, { force: true });
  }
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/// Downloads an object, returning its bytes or null when absent.
async function r2Get(bucket, key) {
  await fs.mkdir(workDir, { recursive: true });
  const destination = path.join(workDir, `get-${createHash('sha1').update(`${bucket}/${key}`).digest('hex').slice(0, 16)}.bin`);
  await fs.rm(destination, { force: true });
  const { code } = await run(
    ['r2', 'object', 'get', `${bucket}/${key}`, `--file=${destination}`, targetFlag],
    { allowFailure: true },
  );
  if (code !== 0) { await fs.rm(destination, { force: true }); return null; }
  try {
    return await fs.readFile(destination);
  } catch {
    return null;
  } finally {
    await fs.rm(destination, { force: true });
  }
}

async function r2Put(bucket, key, filePath, mime, visibility) {
  await run([
    'r2', 'object', 'put', `${bucket}/${key}`,
    `--file=${filePath}`,
    `--content-type=${mime || 'application/octet-stream'}`,
    `--cache-control=${CACHE_CONTROL[visibility] ?? CACHE_CONTROL.private}`,
    targetFlag,
    '--force',
  ]);
}

async function r2Delete(bucket, key) {
  await run(['r2', 'object', 'delete', `${bucket}/${key}`, targetFlag], { allowFailure: true });
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function pool(items, worker) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

// ---------------------------------------------------------------------------

async function migrate(plan) {
  const candidates = plan.filter((e) => e.action === 'migrate');
  const selected = limit ? candidates.slice(0, limit) : candidates;

  const counts = {
    inspected: plan.length,
    selected: selected.length,
    migrated: 0,
    skipped_already_migrated: 0,
    skipped_no_object: plan.filter((e) => e.action === 'no_object_yet').length,
    skipped_already_correct: plan.filter((e) => e.action === 'already_correct').length,
    duplicate: plan.filter((e) => e.action === 'duplicate_target_key').length,
    failed: 0,
    manual_review: plan.filter((e) => e.action === 'manual_review_source_missing').length,
  };
  const failures = [];
  const pending = [];
  let processed = 0;

  await fs.mkdir(workDir, { recursive: true });

  await pool(selected, async (entry) => {
    const targetBucket = BUCKET_NAME[entry.target.bucket];
    const targetKey = entry.target.r2_key;
    try {
      // --- Resume check: is the replacement already in place and valid? ------
      const existing = await r2Get(targetBucket, targetKey);
      if (existing && (!entry.checksum_sha256 || sha256(existing) === entry.checksum_sha256)) {
        const rowIsCurrent = entry.current.bucket === entry.target.bucket
          && entry.current.r2_key === targetKey
          && entry.current.visibility === entry.target.visibility;
        if (!rowIsCurrent) {
          pending.push(entry);
          counts.migrated += 1;
        } else {
          counts.skipped_already_migrated += 1;
        }
        return;
      }

      // --- Resolve authoritative bytes --------------------------------------
      let sourcePath = entry.source_absolute;
      let temporary = null;
      if (!sourcePath) {
        if (!entry.r2_source) throw new Error('no source available');
        const bytes = await r2Get(BUCKET_NAME[entry.r2_source.bucket], entry.r2_source.r2_key);
        if (!bytes) throw new Error(`source object missing: ${entry.r2_source.bucket}/${entry.r2_source.r2_key}`);
        temporary = path.join(workDir, `src-${entry.id}.bin`);
        await fs.writeFile(temporary, bytes);
        sourcePath = temporary;
      }

      try {
        const sourceBytes = await fs.readFile(sourcePath);
        const sourceDigest = sha256(sourceBytes);

        if (dryRun) { counts.migrated += 1; return; }

        await r2Put(targetBucket, targetKey, sourcePath, entry.mime_type, entry.target.visibility);

        // --- Verify the replacement before D1 is touched --------------------
        const written = await r2Get(targetBucket, targetKey);
        if (!written) throw new Error('replacement object not readable after write');
        const writtenDigest = sha256(written);
        if (writtenDigest !== sourceDigest) {
          throw new Error(`replacement digest mismatch: ${writtenDigest} != ${sourceDigest}`);
        }
        if (entry.checksum_sha256 && writtenDigest !== entry.checksum_sha256) {
          // The recorded checksum came from the original import. A mismatch here
          // means the source on disk changed since then; surface it rather than
          // silently rewriting the catalogue.
          throw new Error(`source drifted from recorded checksum: ${writtenDigest} != ${entry.checksum_sha256}`);
        }

        pending.push({ ...entry, verified_sha256: writtenDigest, verified_size: written.length });
        counts.migrated += 1;
      } finally {
        if (temporary) await fs.rm(temporary, { force: true });
      }
    } catch (error) {
      counts.failed += 1;
      failures.push(`${entry.id} (${entry.expected_path}): ${error instanceof Error ? error.message : error}`);
    } finally {
      processed += 1;
      if (processed % 20 === 0 || processed === selected.length) {
        console.log(`  progress ${processed}/${selected.length} (migrated ${counts.migrated}, failed ${counts.failed})`);
      }
    }
  });

  // --- Flip D1 in one transaction, only for verified objects ----------------
  if (!dryRun && pending.length) {
    const statements = ['PRAGMA foreign_keys = ON;'];
    for (const entry of pending) {
      statements.push(
        `UPDATE content_assets SET visibility = ${sqlString(entry.target.visibility)}, `
        + `bucket = ${sqlString(entry.target.bucket)}, r2_key = ${sqlString(entry.target.r2_key)}, `
        + `updated_at = datetime('now') WHERE id = ${sqlString(entry.id)};`,
      );
    }
    statements.push(
      `INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details) VALUES (`
      + `${sqlString(crypto.randomUUID())}, 'bucket-migration-script', 'migrate_bucket', 'content_asset', 'bulk', `
      + `${sqlString(JSON.stringify({ migrated: pending.length, failed: counts.failed, target: isRemote ? 'remote' : 'local' }))});`,
    );
    await d1Exec(statements);
  }

  return { counts, failures, pending };
}

/// Opt-in cleanup. Re-verifies the replacement, then removes the stale original.
async function purgeOriginals(plan) {
  const counts = { considered: 0, deleted: 0, kept_unverified: 0, kept_same_key: 0 };
  const live = await d1Query(
    'SELECT id, bucket, r2_key, visibility, checksum_sha256 FROM content_assets WHERE r2_key IS NOT NULL;',
  );
  const liveById = new Map(live.map((r) => [r.id, r]));

  for (const entry of plan.filter((e) => e.action === 'migrate')) {
    counts.considered += 1;
    const row = liveById.get(entry.id);
    if (!row) { counts.kept_unverified += 1; continue; }

    const originalBucket = BUCKET_NAME[entry.current.bucket];
    const originalKey = entry.current.r2_key;
    // Never delete the object the catalogue currently points at.
    if (row.bucket === entry.current.bucket && row.r2_key === originalKey) { counts.kept_same_key += 1; continue; }

    const replacement = await r2Get(BUCKET_NAME[row.bucket], row.r2_key);
    if (!replacement) { counts.kept_unverified += 1; continue; }
    if (row.checksum_sha256 && sha256(replacement) !== row.checksum_sha256) { counts.kept_unverified += 1; continue; }

    if (!dryRun) await r2Delete(originalBucket, originalKey);
    counts.deleted += 1;
  }
  return counts;
}

async function main() {
  const raw = await fs.readFile(planPath, 'utf8').catch(() => {
    throw new Error(`Plan not found at ${planPath}. Run scripts/audit-asset-placement.mjs first.`);
  });
  const { plan } = JSON.parse(raw);

  console.log(`Bucket migration ${dryRun ? '(DRY RUN)' : ''} target=${isRemote ? 'REMOTE' : 'local'}`);
  console.log(`  public bucket : ${BUCKET_NAME.thumbs}`);
  console.log(`  private bucket: ${BUCKET_NAME.media}`);

  if (deleteOriginals) {
    const counts = await purgeOriginals(plan);
    console.log('\nOriginal cleanup:');
    for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(26)} ${v}`);
    return;
  }

  const { counts, failures } = await migrate(plan);
  console.log('\nMigration counts:');
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(26)} ${v}`);
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const failure of failures.slice(0, 30)) console.log(`  ${failure}`);
  }
  await fs.rm(workDir, { recursive: true, force: true });
  if (counts.failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
