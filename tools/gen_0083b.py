import pathlib, json, sqlite3, re

# Check what keys wave4 packs actually have vs manifest engine naming
games_dir = pathlib.Path('tools/tts/games')

# But wave4 packs use engine ids like trace_color, match_pairs etc - manifests are named trace-color-ar.json etc
# So mapping is underscore -> hyphen. Our 0083 did that. But it only updated 18 of 39 packs
# Let's see which packs were NOT updated

db_path = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db_path))
cur = con.cursor()
rows = list(cur.execute("SELECT id, engine_id, content_pack FROM games WHERE status IN ('published','ready') ORDER BY id"))
# Check 0083 output says Need to update 18 games - which are the wave4 new games only?
# Wave1 games might already use fixture assets, not generic
for gid, eng, pack_json in rows:
    pack = json.loads(pack_json)
    vm = pack.get('voice_manifest',{})
    # count generic vs fixture
    generic = sum(1 for v in vm.values() if 'generic' in v)
    fixture = sum(1 for v in vm.values() if 'fixture' in v)
    games_asset = sum(1 for v in vm.values() if v.startswith('asset-games-'))
    if generic or fixture:
        print(f"{gid:40} eng={eng:16} vm_keys={list(vm.keys())[:5]} generic={generic} fixture={fixture} games={games_asset}")

# The issue: wave1 packs use fixture? Let's see if we should also map fixture -> games
# And the 0083 only replaced generic keys, not fixture keys
# Also trace-color uses vo.stroke_complete which manifest has as vo-stroke-complete -> maps correctly
# But we missed many packs: wave1/wave2/wave3 still have generic count-1..5 not in manifest keys?
# Let's see wave1 count pack
for gid, eng, pack_json in rows:
    if 'wave1-count-place' in gid or 'wave1-memory' in gid:
        pack = json.loads(pack_json)
        print(f"\n{gid} vm: {json.dumps(pack.get('voice_manifest',{}), ensure_ascii=False)}")
        print(f" assets images: {pack.get('assets',{}).get('images',[])[:5]}")
