import sqlite3, json, pathlib

db = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db))
cur = con.cursor()

rows = list(cur.execute("SELECT id, engine_id, content_pack, status FROM games WHERE status='published' ORDER BY id"))
print(f"published {len(rows)}")
for gid, eng, pack, st in rows:
    try:
        p=json.loads(pack)
        lv=p.get('levels',[])
        prog=p.get('progression',{})
        ltf=prog.get('levels_to_finish','?')
        acc=p.get('accessibility',{})
        print(f"{gid:40} {eng:16} levels={len(lv):2} finish={ltf} acc={bool(acc)} size={len(pack):5}")
    except Exception as e:
        print(gid, 'ERR', e)

print("\n--- by status ---")
for r in cur.execute('SELECT status, count(*) FROM games GROUP BY status ORDER BY status'):
    print(r)

print("\n--- assets by status ---")
for r in cur.execute("SELECT status, count(*) FROM content_assets GROUP BY status"):
    print(r)

print("\n--- audio assets ---")
for r in cur.execute("SELECT id, status, expected_path FROM content_assets WHERE kind='audio' ORDER BY id"):
    print(r)

print("\n--- game_localizations ---")
for r in cur.execute("SELECT game_id, language, status, substr(title,1,30) FROM game_localizations ORDER BY game_id"):
    print(r)

print("\n--- cover jobs ---")
import os, json as jj
jp = pathlib.Path("tools/playveo/games-unique-covers-jobs.json")
if jp.exists():
    j = jj.loads(jp.read_text(encoding='utf-8'))
    pend = [k for k,v in j.items() if v.get('status')=='pending']
    print(f"pending covers {len(pend)}: {pend}")
    print(f"completed {len([k for k,v in j.items() if v.get('status')=='completed'])} / {len(j)}")
    for k,v in sorted(j.items()):
        print(k, v.get('status'), bool(v.get('localPath') and pathlib.Path(v['localPath']).exists()), v.get('resultUrls')[:1] if v.get('resultUrls') else '')

print("\n--- local_catalog vs DTO ---")
dto = pathlib.Path("app_main/lib/features/home/data/content_dtos.dart").read_text(encoding='utf-8')
import re
ids = re.findall(r"'(game-[^']+)'\s*:", dto)
print(f"dto covers {len(ids)} unique {len(set(ids))}")
lc = pathlib.Path("app_main/lib/features/home/data/local_catalog.dart").read_text(encoding='utf-8')
lc_ids = re.findall(r"id:\s*'(game-[^']+)'", lc)
print(f"local_catalog {len(lc_ids)} ids")
covers = re.findall(r"coverUrl:\s*'([^']+)'", lc)
print(f"local_catalog covers {len(covers)} unique {len(set(covers))}")
