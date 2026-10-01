# CONTENT-001: encode every published episode to HLS and upload it to R2.
#
# Reads the episode list from $Work/episodes.json (id, r2_key of the MP4),
# downloads each source MP4, encodes with encode-hls.ps1, uploads the folder to
# majarra-media/private/episodes/<id>/hls/, and writes $Work/register.sql,
# which registers each master as a `manifest` asset linked with role `hls`.
# Nothing is registered for an episode whose encode or upload failed, so a
# partial run never advertises a broken stream. Re-running skips finished ones.
param(
  [string] $Work = "$env:TEMP\majarra-hls",
  [int] $Limit = 0,
  [switch] $Reverse,
  [switch] $NoRegister
)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$episodes = Get-Content "$Work\episodes.json" -Raw | ConvertFrom-Json
if ($Limit -gt 0) { $episodes = $episodes | Select-Object -First $Limit }
$done = @()
$doneFile = "$Work\uploaded.txt"
if (Test-Path $doneFile) { $done = Get-Content $doneFile }

if ($Reverse) { [array]::Reverse($episodes) }
New-Item -ItemType Directory -Force "$Work\lock" | Out-Null

foreach ($ep in $episodes) {
  $id = $ep.id
  # Re-read per episode: another worker may have finished it meanwhile.
  $done = if (Test-Path $doneFile) { Get-Content $doneFile } else { @() }
  if ($done -contains $id) { Write-Host "skip $id (already uploaded)"; continue }
  if ($id -notmatch '^[a-z0-9][a-z0-9-]{0,120}$') { Write-Warning "bad id $id"; continue }
  # One worker per episode: creating the lock file fails if another holds it.
  try { New-Item -ItemType File -Path "$Work\lock\$id" -ErrorAction Stop | Out-Null }
  catch { Write-Host "skip $id (another worker)"; continue }
  try {
    $src = "$Work\src\$id.mp4"
    if (-not (Test-Path $src)) {
      npx wrangler r2 object get "majarra-media/$($ep.r2_key)" --file $src --remote 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path $src)) { throw "download failed" }
    }
    $out = "$Work\out\$id"
    if (-not (Test-Path "$out\master.m3u8")) { & "$here\encode-hls.ps1" -Source $src -Out $out }

    # Every file of the folder, one bulk upload (wrangler r2 bulk put).
    $prefix = "private/episodes/$id/hls/"
    $pairs = Get-ChildItem -Recurse -File $out | ForEach-Object {
      $rel = $_.FullName.Substring($out.Length + 1).Replace('\', '/')
      [pscustomobject]@{ key = "$prefix$rel"; file = $_.FullName }
    }
    foreach ($p in $pairs) {
      $ct = if ($p.key.EndsWith('.m3u8')) { 'application/vnd.apple.mpegurl' } else { 'video/mp4' }
      $attempt = 0
      do {
        $attempt++
        npx wrangler r2 object put "majarra-media/$($p.key)" --file $p.file --content-type $ct --remote 2>&1 | Out-Null
      } while ($LASTEXITCODE -ne 0 -and $attempt -lt 3)
      if ($LASTEXITCODE -ne 0) { throw "upload failed: $($p.key)" }
    }
    Add-Content $doneFile $id
    Write-Host "ok $id ($($pairs.Count) files)"
  } catch {
    Write-Warning "FAILED $id : $_"
    # Free the episode so a re-run can retry it.
    Remove-Item "$Work\lock\$id" -ErrorAction SilentlyContinue
  }
}
if ($NoRegister) { return }

# Registration SQL for every uploaded episode (idempotent).
$uploaded = Get-Content $doneFile
$sql = foreach ($id in $uploaded) {
  $asset = "ca-$id-hls"
  $key = "private/episodes/$id/hls/master.m3u8"
  @"
INSERT INTO content_assets (id, title_ar, kind, source, status, original_filename, r2_key, bucket, mime_type, visibility, version, metadata)
VALUES ('$asset', 'HLS $id', 'manifest', 'generated', 'ready', 'master.m3u8', '$key', 'media', 'application/vnd.apple.mpegurl', 'private', 1, '{"format":"hls_fmp4","renditions":["1080p","720p","480p","360p"]}')
ON CONFLICT(id) DO UPDATE SET status = 'ready', r2_key = excluded.r2_key, updated_at = datetime('now');
INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, sort_order)
VALUES ('al-$id-hls', '$asset', 'episode', '$id', 'hls', 0);
"@
}
[IO.File]::WriteAllText("$Work\register.sql", ($sql -join "`n"), [Text.UTF8Encoding]::new($false))
Write-Host "register.sql: $($uploaded.Count) episodes"
