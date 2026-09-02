Set-Location F:\Projects\cartoonapp
Write-Host "=== Generate trace-color ==="
node tools/tts/games/generate_game_voices.mjs --only trace-color --voice Kore 2>&1 | Out-File C:\Temp\tts_trace2.log -Encoding utf8
Get-Content C:\Temp\tts_trace2.log | Select-Object -Last 15

Write-Host "`n=== Generate word-build Leda ==="
Start-Sleep -Seconds 4
node tools/tts/games/generate_game_voices.mjs --only word-build --voice Leda 2>&1 | Out-File C:\Temp\tts_word2.log -Encoding utf8
Get-Content C:\Temp\tts_word2.log | Select-Object -Last 15

Write-Host "`n=== Generate sequence-order ==="
Start-Sleep -Seconds 4
node tools/tts/games/generate_game_voices.mjs --only sequence-order --voice Kore 2>&1 | Out-File C:\Temp\tts_seq2.log -Encoding utf8
Get-Content C:\Temp\tts_seq2.log | Select-Object -Last 15

Write-Host "`n=== Generate sort-bins missing 2 ==="
Start-Sleep -Seconds 3
node tools/tts/games/generate_game_voices.mjs --only sort-bins --voice Kore 2>&1 | Out-File C:\Temp\tts_sort.log -Encoding utf8
Get-Content C:\Temp\tts_sort.log | Select-Object -Last 15

Write-Host "`n=== WAV COUNT FINAL ==="
Get-ChildItem assets/audio/games -Recurse -File -Filter "*.wav" | Measure-Object | Select-Object Count
Get-ChildItem assets/audio/games -Recurse -File -Filter "*.wav" | Measure-Object Length -Sum | Select-Object @{N="MB";E={[math]::Round($_.Sum/1MB,1)}}

Write-Host "`n=== Try PlayVeo one cover ==="
node tools/playveo/generate_wave4_assets.mjs --plan 2>&1 | Select-Object -Last 10

node tools/playveo/generate_wave4_assets.mjs --submit --only game-match-nature-3/cover --limit 1 2>&1 | Select-Object -Last 20

Start-Sleep -Seconds 3
node tools/playveo/generate_wave4_assets.mjs --poll --only game-match-nature-3/cover --limit 1 2>&1 | Select-Object -Last 20

Write-Host "`n=== output files ==="
Get-ChildItem tools/playveo/output/wave4 -Recurse -File -ErrorAction SilentlyContinue | Select-Object FullName, Length -First 10
