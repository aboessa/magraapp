$games = @("game-wave1-logic-kids","game-wave1-sim-lab","game-wave2-memory-2","game-wave2-timeline","game-wave2-rhythm","game-wave3-timeline-detail","game-wave3-block-advanced","game-wave3-sim-saturating","game-sequence-story-3a","game-logic-sequence-3b","game-rhythm-festive-3b","game-word-family-3a","game-word-animals-3b","game-letter-tracing","game-number-maze","game-animal-memory")
Set-Location "F:\Projects\cartoonapp\dashboard\api"
foreach ($p in $games) {
  Write-Host "UPLOADING $p"
  $file = "F:\Projects\cartoonapp\majarra_images\assets\games\$p\cover.jpg"
  if (Test-Path $file) {
    npx wrangler r2 object put "majarra-thumbs/public/games/$p/cover.jpg" --remote --file="$file" --content-type=image/jpeg
  } else {
    Write-Host "MISSING $file"
  }
}
Write-Host "DONE REMOTE UPLOAD"
