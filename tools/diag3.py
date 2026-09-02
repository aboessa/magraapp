import pathlib, sqlite3, json

db = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db))
cur = con.cursor()

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

for gid in ['game-shape-trace-3','game-sort-animals-3','game-trace-color-advanced-3']:
    db_pack = cur.execute('SELECT content_pack FROM games WHERE id=?',(gid,)).fetchone()[0]
    idx = sql_text.find(f"'{gid}'")
    j_start = sql_text.find('\'{"pack_version"', idx)
    pack_start = j_start + 1
    # closing is the next "','"published'" after pack_start
    sq_close = sql_text.find("','published'", pack_start)
    if sq_close == -1:
        sq_close = sql_text.find("',", pack_start+1000)
    sql_pack = sql_text[pack_start:sq_close].replace("''", "'")
    print(f"\n=== {gid} ===")
    print(f"db len {len(db_pack)} sql len {len(sql_pack)} equal={db_pack==sql_pack}")
    try:
        json.loads(sql_pack); print("sql JSON valid")
    except Exception as e:
        print(f"sql JSON invalid: {e}")
        if hasattr(e,'pos'):
            print(repr(sql_pack[e.pos-120:e.pos+120]))
    try:
        json.loads(db_pack); print("db JSON valid")
    except Exception as e:
        print(f"db JSON invalid: {e}")
        if hasattr(e,'pos'):
            print(repr(db_pack[e.pos-120:e.pos+120]))
    # also check if pack contains unescaped single quotes? JSON shouldn't
    if "'" in sql_pack[:2000]:
        # find single quotes inside JSON (should be none except in values, but values have no ')
        positions = [i for i,ch in enumerate(sql_pack) if ch=="'"]
        print(f"single quotes in sql_pack at {positions[:10]}")
        for p in positions[:3]:
            print(repr(sql_pack[p-30:p+30]))
