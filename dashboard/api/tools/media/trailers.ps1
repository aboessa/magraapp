# APP-204: a short, muted preview per series for the TV home hero.
#
# Cut from the series' first episode: 12 s starting at a quarter of the way in
# (past any title card), 720p, no audio, faststart. Stored PRIVATE in
# majarra-media/private/series/<id>/trailer.mp4 and served only through a
# short capability (`GET /api/v1/series/:id/trailer`), like every other video.
# Writes $Work/trailers.sql to register them (kind video, role `trailer`).
param([string] $Work = "$env:TEMP\majarra-hls")
$ErrorActionPreference = 'Stop'
$series = Get-Content "$Work\series.json" -Raw | ConvertFrom-Json
$episodes = Get-Content "$Work\episodes.json" -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force "$Work\trailers", "$Work\src" | Out-Null
$sql = @()
foreach ($s in $series) {
  $sid = $s.series_id; $eid = $s.first_episode
  if ($sid -notmatch '^[a-z0-9][a-z0-9-]{0,120}$') { continue }
  $ep = $episodes | Where-Object id -eq $eid | Select-Object -First 1
  if (-not $ep) { Write-Warning "no source for $sid"; continue }
  try {
    $src = "$Work\src\$eid.mp4"
    if (-not (Test-Path $src)) {
      npx wrangler r2 object get "majarra-media/$($ep.r2_key)" --file $src --remote 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'download failed' }
    }
    $duration = [double](ffprobe -v error -show_entries format=duration -of csv=p=0 $src)
    $start = [math]::Max(0, [math]::Min($duration * 0.25, $duration - 12))
    $out = "$Work\trailers\$sid.mp4"
    ffmpeg -hide_banner -loglevel error -y -ss $start -t 12 -i $src -an `
      -vf "scale=-2:720:flags=lanczos,format=yuv420p" -c:v libx264 -preset medium -crf 26 `
      -movflags +faststart $out
    if ($LASTEXITCODE -ne 0) { throw 'encode failed' }
    npx wrangler r2 object put "majarra-media/private/series/$sid/trailer.mp4" --file $out --content-type video/mp4 --remote 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'upload failed' }
    $size = (Get-Item $out).Length
    $sql += @"
INSERT INTO content_assets (id, title_ar, kind, source, status, original_filename, r2_key, bucket, mime_type, size_bytes, visibility, version, metadata)
VALUES ('ca-$sid-trailer', 'Trailer $sid', 'video', 'generated', 'ready', 'trailer.mp4', 'private/series/$sid/trailer.mp4', 'media', 'video/mp4', $size, 'private', 1, '{"from_episode":"$eid","seconds":12,"muted":true}')
ON CONFLICT(id) DO UPDATE SET status = 'ready', size_bytes = excluded.size_bytes, updated_at = datetime('now');
INSERT OR IGNORE INTO asset_links (id, asset_id, entity_type, entity_id, role, sort_order)
VALUES ('al-$sid-trailer', 'ca-$sid-trailer', 'series', '$sid', 'trailer', 0);
"@
    Write-Host "ok $sid ($([math]::Round($size/1KB)) KB)"
  } catch { Write-Warning "FAILED $sid : $_" }
}
[IO.File]::WriteAllText("$Work\trailers.sql", ($sql -join "`n"), [Text.UTF8Encoding]::new($false))
Write-Host "trailers.sql: $($sql.Count)"
