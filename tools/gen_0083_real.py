import pathlib, json, sqlite3

# 0083 real: link ALL packs' voice_manifest to real asset-games-* instead of generic/fixture
# Engine mapping: engine_id -> manifest stem hyphen

db_path = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db_path))
cur = con.cursor()

games_dir = pathlib.Path('tools/tts/games')
manifests = {p.stem.replace('-ar',''): json.loads(p.read_text(encoding='utf-8')) for p in games_dir.glob('*-ar.json')}

# Build hyphen engine -> { vm_key -> asset_id }
def key_from_file(fname):
    stem = pathlib.Path(fname).stem  # vo-intro-ar
    no_ar = stem[:-3] if stem.endswith('-ar') else stem
    return no_ar.replace('-','.')  # vo-intro -> vo.intro

engine_map = {}
for eng_hyphen, m in manifests.items():
    mp = {}
    for line in m['lines']:
        k = key_from_file(line['file'])
        # handle vo-intro -> vo.intro , vo-level-complete -> vo.level.complete? But packs use vo.level_complete? Let's check
        # Packs actually use vo.level_complete? sample shows vo.level_complete? No sample shows vo.level_complete? Let's check again
        # In gen_0083b output: vm_keys=['vo.intro', 'vo.instruction', 'vo.instruction_repeat', ...]
        # But manifest keys we generate are vo.intro, vo.level.complete etc
        # Need to normalize: packs use underscore, manifests use hyphen->dot
        # So vo.level-complete -> vo.level.complete vs vo.level_complete -> different
        asset_id = f"asset-games-{eng_hyphen}-{pathlib.Path(line['file']).stem.replace('-ar','').replace('_','-')}"
        mp[k] = asset_id
    engine_map[eng_hyphen] = mp

# Check what keys packs actually have
rows = list(cur.execute("SELECT id, engine_id, content_pack FROM games WHERE status IN ('published','ready') ORDER BY id"))
sample = json.loads(rows[0][2])
print("packs use keys:", list(sample.get('voice_manifest',{}).keys())[:10])
print("manifest eng hyphen keys sample block-code:", list(engine_map.get('block-code',{}).keys())[:10])

# The packs use underscore style: vo.intro, vo.instruction, vo.instruction_repeat (not vo.instruction.repeat)
# But our manifest map uses dot style: vo.instruction.repeat
# Need to handle both: underscore vs dot variation
# Normalize: underscore and dot are equivalent? Try mapping hyphen->underscore
# Actually file vo-instruction-repeat -> vo.instruction.repeat  but pack key is vo.instruction_repeat
# So they differ by underscore vs dot
# Solution: build both variants

# Regenerate with both
engine_map_norm = {}
for eng_hyphen, m in manifests.items():
    mp = {}
    for line in m['lines']:
        fname = line['file']
        stem_no_ar = pathlib.Path(fname).stem[:-3]  # remove -ar
        # underscore version (pack style): vo-intro -> vo.intro, vo-instruction-repeat -> vo.instruction_repeat
        # pack uses vo.instruction_repeat (underscore), not dot
        # To get pack key: replace first hyphen vo- -> vo. , then keep rest with underscore?
        # e.g. vo-instruction-repeat -> vo.instruction_repeat
        # rule: vo-<rest> -> vo.<rest with hyphens->underscores>
        if stem_no_ar.startswith('vo-'):
            rest = stem_no_ar[3:]  # instruction-repeat
            pack_key = 'vo.' + rest.replace('-','_')  # vo.instruction_repeat
            dot_key = 'vo.' + rest.replace('-','.')   # vo.instruction.repeat
            asset_id = f"asset-games-{eng_hyphen}-{stem_no_ar.replace('_','-')}"
            mp[pack_key] = asset_id
            mp[dot_key] = asset_id
        else:
            k = stem_no_ar.replace('-','.')
            pack_key = stem_no_ar.replace('-','_')
            asset_id = f"asset-games-{eng_hyphen}-{stem_no_ar}"
            mp[k] = asset_id
            mp[pack_key] = asset_id
    engine_map_norm[eng_hyphen] = mp

print("\nnormalized sample block-code:", dict(list(engine_map_norm['block-code'].items())[:6]))

updates = []
for gid, eng, pack_json in rows:
    pack = json.loads(pack_json)
    vm = pack.get('voice_manifest',{})
    if not vm:
        continue
    hyphen = eng.replace('_','-')
    mp = engine_map_norm.get(hyphen, {})
    new_vm = dict(vm)
    changed = False
    for k, old_val in list(vm.items()):
        # old is generic/fixture/generic count etc
        new_asset = mp.get(k)
        if new_asset and new_asset != old_val:
            new_vm[k] = new_asset
            changed = True
    if changed:
        pack['voice_manifest'] = new_vm
        updates.append((gid, pack))

print(f"\nWill update {len(updates)} games")
for gid, p in updates[:3]:
    print(gid, json.dumps(p['voice_manifest'], ensure_ascii=False)[:300])

out = pathlib.Path('dashboard/api/migrations/0083_link_games_voice_manifest.sql')
lines = ["-- 0083 — ربط voice_manifest الحقيقي (150 ملف) بدلا من generic/fixture", "PRAGMA foreign_keys=ON;", ""]
for gid, pack in updates:
    j = json.dumps(pack, ensure_ascii=False, separators=(',',':'))
    esc = j.replace("'", "''")
    lines.append(f"UPDATE games SET content_pack = '{esc}', updated_at = datetime('now') WHERE id = '{gid}';")
out.write_text("\n".join(lines), encoding='utf-8')
print(f"\nWrote {out} lines {len(lines)}")
