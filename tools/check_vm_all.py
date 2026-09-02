import pathlib, json, sqlite3, re

# Check remaining generic/fixture/missing in production local copy
db_path = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db_path))
cur = con.cursor()
rows = list(cur.execute("SELECT id, content_pack FROM games WHERE status IN ('published','ready') ORDER BY id"))
# Build set of valid asset ids
assets = set(r[0] for r in cur.execute("SELECT id FROM content_assets WHERE kind='audio' AND status='ready'"))
print(f"audio assets ready: {len(assets)}")
for gid, pack_json in rows:
    pack = json.loads(pack_json)
    vm = pack.get('voice_manifest',{})
    missing = [k for k,v in vm.items() if v not in assets]
    if missing:
        print(f"{gid:40} missing {len(missing)}/{len(vm)}: {missing[:5]} -> values {[vm[k] for k in missing[:3]]}")

# Also check wave4 packs that should have engine-specific assets now
print("\n--- sample wave4 after 0083 ---")
for gid, pack_json in rows[:3]:
    pack = json.loads(pack_json)
    print(gid, json.dumps(pack.get('voice_manifest',{}), ensure_ascii=False)[:300])

# check locally if all referenced assets exist
print("\n--- local wav coverage ---")
import pathlib as pl2
games_dir = pl2.Path('tools/tts/games')
for p in sorted(games_dir.glob('*-ar.json')):
    m = json.loads(p.read_text(encoding='utf-8'))
    missing_files = [l['file'] for l in m['lines'] if not (pl2.Path(m['out_dir'])/l['file']).exists()]
    if missing_files:
        print(p.name, "missing", missing_files[:3])
print("done")
