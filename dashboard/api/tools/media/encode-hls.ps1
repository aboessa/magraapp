# CONTENT-001: encode one episode MP4 into multi-bitrate HLS (fMP4, byte-range).
#
# Output layout (relative URIs, so the delivery route can serve it under one
# capability path):
#   <out>/master.m3u8
#   <out>/<rendition>/index.m3u8      one per rendition
#   <out>/<rendition>/media.mp4       init + all fragments in one file (EXT-X-BYTERANGE)
#
# One media file per rendition instead of hundreds of .ts segments keeps the
# object count at 9 per episode. The ladder never exceeds the source: a
# rendition taller than the input is skipped, and bitrates are capped near the
# source bitrate (the 1080p masters are ~2.8 Mbps).
#
# Usage: ./encode-hls.ps1 -Source in.mp4 -Out outdir
param(
  [Parameter(Mandatory)] [string] $Source,
  [Parameter(Mandatory)] [string] $Out
)
$ErrorActionPreference = 'Stop'

$ladder = @(
  @{ name = '1080p'; h = 1080; v = '2800k'; max = '3000k'; buf = '6000k'; a = '128k' },
  @{ name = '720p';  h = 720;  v = '1600k'; max = '1800k'; buf = '3600k'; a = '96k' },
  @{ name = '480p';  h = 480;  v = '850k';  max = '950k';  buf = '1900k'; a = '96k' },
  @{ name = '360p';  h = 360;  v = '450k';  max = '500k';  buf = '1000k'; a = '64k' }
)

$probe = ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 $Source
$srcHeight = [int]$probe
$hasAudio = [bool](ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 $Source)
$rungs = @($ladder | Where-Object { $_.h -le $srcHeight })
if ($rungs.Count -eq 0) { $rungs = @($ladder[-1]) }

New-Item -ItemType Directory -Force $Out | Out-Null
$n = $rungs.Count
$split = "[0:v]split=$n" + (($rungs | ForEach-Object -Begin { $i = 0 } -Process { "[s$i]"; $i++ }) -join '')
$scales = for ($i = 0; $i -lt $n; $i++) { "[s$i]scale=-2:$($rungs[$i].h):flags=lanczos,format=yuv420p[v$i]" }
$filter = ($split + ';' + ($scales -join ';'))

$args = @('-hide_banner', '-loglevel', 'error', '-y', '-i', $Source, '-filter_complex', $filter)
$map = @()
for ($i = 0; $i -lt $n; $i++) {
  $r = $rungs[$i]
  $args += @('-map', "[v$i]", "-c:v:$i", 'libx264', "-b:v:$i", $r.v, "-maxrate:v:$i", $r.max, "-bufsize:v:$i", $r.buf)
  if ($hasAudio) {
    $args += @('-map', 'a:0', "-c:a:$i", 'aac', "-b:a:$i", $r.a, "-ac:a:$i", '2')
    $map += "v:$i,a:$i,name:$($r.name)"
  } else {
    $map += "v:$i,name:$($r.name)"
  }
}
$args += @(
  '-preset', 'medium', '-profile:v', 'main',
  # Aligned keyframes every 4 s across renditions, so the player can switch
  # quality at any segment boundary.
  '-force_key_frames', 'expr:gte(t,n_forced*4)', '-sc_threshold', '0',
  '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'vod',
  '-hls_segment_type', 'fmp4', '-hls_flags', 'single_file+independent_segments',
  '-hls_segment_filename', (Join-Path $Out '%v/media.mp4'),
  '-master_pl_name', 'master.m3u8',
  '-var_stream_map', ($map -join ' '),
  (Join-Path $Out '%v/index.m3u8')
)
& ffmpeg @args
if ($LASTEXITCODE -ne 0) { throw "ffmpeg failed for $Source" }

# ffmpeg on Windows writes variant URIs with backslashes; URIs need '/'.
$master = Join-Path $Out 'master.m3u8'
$text = [IO.File]::ReadAllText($master).Replace('\', '/')
[IO.File]::WriteAllText($master, $text, [Text.UTF8Encoding]::new($false))
