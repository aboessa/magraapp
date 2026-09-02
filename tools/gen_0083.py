import pathlib, json, re

# Generate 0083: link voice_manifest in games.content_pack to new asset ids
# Currently all packs point to asset-vo-*-generic
# New assets: asset-games-<engine>-vo-<name>  e.g. asset-games-count-quantity-vo-count-1

games_dir = pathlib.Path('tools/tts/games')
manifests = {p.stem.replace('-ar',''): json.loads(p.read_text(encoding='utf-8')) for p in games_dir.glob('*-ar.json')}

# Build engine -> { old_key -> new_asset_id } mapping
# But we need to know what keys the packs currently use
# Inspect DB: SELECT content_pack from games -> voice_manifest keys
import sqlite3
import pathlib as pl

# Use local DB
db_path = pl.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db_path))
cur = con.cursor()

rows = list(cur.execute("SELECT id, content_pack FROM games WHERE status IN ('published','ready')"))
print(f"games {len(rows)}")

# Build mapping: engine -> {generic_key -> new_asset}
# manifests have lines with file vo-intro-ar.wav etc, but voice_manifest keys are like vo.intro, vo.correct etc?
# Let's see what keys manifests think they provide vs what packs have
# Check one pack
sample = json.loads(rows[0][1])
print("sample pack voice_manifest:", json.dumps(sample.get('voice_manifest',{}), ensure_ascii=False)[:1000])
print("sample assets:", json.dumps(sample.get('assets',{}), ensure_ascii=False)[:1000])

# For each manifest, build new asset mapping from its lines
engine_asset_map = {}
for engine, m in manifests.items():
    mp = {}
    for line in m['lines']:
        fname = line['file']  # vo-intro-ar.wav
        stem = pathlib.Path(fname).stem  # vo-intro-ar
        stem_no_ar = stem[:-3] if stem.endswith('-ar') else stem  # vo-intro
        asset_id = f"asset-games-{engine}-{stem_no_ar.replace('_','-')}"
        # voice_manifest key is file without extension? Check actual keys in packs
        # Packs use keys like "vo.intro", "vo.correct" etc. Let's map file stem_no_ar dot style?
        # e.g. vo-intro -> vo.intro, vo-count-1 -> vo.count.1 ?
        # Need to find pattern from manifests: they likely have audio_tag or purpose?
        # Let's print a sample
        if 'vo-' in stem_no_ar:
            key = stem_no_ar.replace('-','.').replace('vo.','vo.')
            # vo-intro -> vo.intro, vo-count-1 -> vo.count.1
            mp[key] = asset_id
    engine_asset_map[engine] = mp

print("\nengine asset map sample:")
for eng, mp in list(engine_asset_map.items())[:2]:
    print(eng, dict(list(mp.items())[:5]))

# Now for each game, try to update voice_manifest keys that exist in engine map
# But games have engine_id like 'count_quantity' -> manifest key 'count-quantity'
updates = []
for gid, pack_json in rows:
    pack = json.loads(pack_json)
    engine = pack.get('engine_id','')
    manifest_engine = engine.replace('_','-')
    mp = engine_asset_map.get(manifest_engine, {})
    vm = pack.get('voice_manifest',{})
    if not vm:
        continue
    new_vm = dict(vm)
    changed = False
    for k, old_val in list(vm.items()):
        if old_val in ('asset-vo-intro-generic','asset-vo-instruction-generic','asset-vo-instruction-repeat-generic','asset-vo-level-complete-generic','asset-vo-game-complete-generic','asset-vo-exit-confirm-generic','asset-vo-correct-generic','asset-vo-retry-generic','asset-vo-hint-generic','asset-vo-count-1','asset-vo-count-2','asset-vo-count-3','asset-vo-count-4','asset-vo-count-5'):
            # try to find new asset for this k
            # k like vo.intro, vo.correct
            new_asset = mp.get(k)
            if new_asset:
                new_vm[k] = new_asset
                changed = True
    if changed:
        pack['voice_manifest'] = new_vm
        updates.append((gid, pack))

print(f"\nNeed to update {len(updates)} games")
for gid, p in updates[:3]:
    print(gid, json.dumps(p['voice_manifest'], ensure_ascii=False)[:500])

# Generate SQL
out = pathlib.Path('dashboard/api/migrations/0083_link_games_voice_manifest.sql')
lines = ["-- 0083 — ربط voice_manifest الحقيقي لكل لعبة (بدلا من generic)", "-- يحدث content_pack ليستخدم asset-games-* المسجلة في 0082", "PRAGMA foreign_keys=ON;", ""]
for gid, pack in updates:
    j = json.dumps(pack, ensure_ascii=False, separators=(',',':'))
    esc = j.replace("'", "''")
    lines.append(f"UPDATE games SET content_pack = '{esc}', updated_at = datetime('now') WHERE id = '{gid}';")

out.write_text("\n".join(lines), encoding='utf-8')
print(f"\nWrote {out} lines {len(lines)} size {len(out.read_text(encoding='utf-8'))}")
