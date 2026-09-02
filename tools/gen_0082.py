import pathlib, json, os, re

# Build content_assets INSERTs for 150 game voice wavs
# id pattern: asset-games-<engine>-<stem> e.g. asset-games-trace-color-vo-intro
# r2_key: private/audio/games/<engine>/ar/<file>.wav

games_dir = pathlib.Path('tools/tts/games')
manifests = sorted([p for p in games_dir.glob('*-ar.json')])

inserts = []
for mf in manifests:
    m = json.loads(mf.read_text(encoding='utf-8'))
    engine = mf.stem.replace('-ar','')  # e.g. trace-color
    out_dir = pathlib.Path(m['out_dir'])
    for line in m['lines']:
        fname = line['file']  # e.g. vo-intro-ar.wav
        # asset id: asset-games-{engine}-{stem without -ar}
        stem = pathlib.Path(fname).stem  # vo-intro-ar
        stem_no_ar = stem[:-3] if stem.endswith('-ar') else stem  # vo-intro
        asset_id = f"asset-games-{engine}-{stem_no_ar.replace('_','-')}"
        r2_key = f"private/audio/games/{engine}/ar/{fname}"
        title = line.get('title') or line.get('text','')[:30]
        # escape
        def esc(s): return s.replace("'", "''")
        inserts.append(f" ('{asset_id}','audio','ready','private','generated','{r2_key}','{esc(title)}','{r2_key}','majarra-media','audio/wav','2026-08-26T16:00:00Z')")

print(f"Total inserts: {len(inserts)}")
# Verify wav files exist
missing = []
for mf in manifests:
    m = json.loads(mf.read_text(encoding='utf-8'))
    out_dir = pathlib.Path(m['out_dir'])
    for line in m['lines']:
        if not (out_dir / line['file']).exists():
            missing.append(str(out_dir / line['file']))
if missing:
    print(f"Missing {len(missing)} wavs")
    for p in missing[:5]: print(p)
else:
    print("All wavs present")

# Build migration file
# Batch in groups of 50 to avoid SQL limits
out = pathlib.Path('dashboard/api/migrations/0082_games_voice_assets.sql')
lines = ["-- 0082 — تسجيل أصول الصوت الحقيقية للألعاب (150 ملف WAV بدلا من generic)", "-- يرفع كل assets/audio/games/*/ar/*.wav إلى R2 majarra-media/private/audio/games/...", "-- بعد هذا الملف تحتاج ربط voice_manifest في 0083", "PRAGMA foreign_keys=ON;", ""]
# Single INSERT with IGNORE for all
lines.append("INSERT OR IGNORE INTO content_assets (id, kind, status, visibility, source, expected_path, title_ar, r2_key, bucket, mime_type, created_at) VALUES")
for i, v in enumerate(inserts):
    comma = "," if i < len(inserts)-1 else ";"
    lines.append(v + comma)

out.write_text("\n".join(lines), encoding='utf-8')
print(f"Wrote {out} {len(out.read_text(encoding='utf-8'))} chars")

# Also build the voice_manifest linking: for each engine, we need to update games referencing that engine
# Check current voice_manifest per game
# We will generate 0083 separately
