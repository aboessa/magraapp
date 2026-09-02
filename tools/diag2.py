import pathlib, sqlite3, json, re

db = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db))
cur = con.cursor()

# Compare DB packs vs SQL file packs
sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

for gid in ['game-shape-trace-3','game-sort-animals-3','game-trace-color-advanced-3']:
    db_pack = cur.execute('SELECT content_pack FROM games WHERE id=?',(gid,)).fetchone()[0]
    # find this gid in sql file: look for ('gid',' then extract the JSON between '{
    # SQL is VALUES ('gid','engine','series',..., '{\"pack...}', 'published' ...)
    # So find pattern: 'gid' then next '{...}' quoted
    idx = sql_text.find(f"'{gid}'")
    if idx == -1:
        print(gid, "not found in sql")
        continue
    # find first '{"pack_version"' after idx
    j_start = sql_text.find('\'{"pack_version"', idx)
    # find the closing '}' followed by ','  i.e. the end of JSON literal
    # SQL literal is 'JSON' so it ends at '},' or '}'', need to handle '' escapes
    # Simplest: extract balanced braces inside single quotes
    # Find the opening single quote
    sq_open = sql_text.rfind("'", 0, j_start)  # should be the '
    # Actually j_start is at ' so pack starts at j_start+1
    pack_start = j_start + 1  # after opening '
    # find matching closing ': search for ',\n  or ','published'
    # The pattern is: JSON','published'  -> closing is ' then comma
    sq_close = sql_text.find("','published'", pack_start)
    if sq_close == -1:
        sq_close = sql_text.find("',", pack_start+1000)
    sql_pack = sql_text[pack_start:sq_close]
    # SQL escapes '' as '' (but JSON has no '')
    # Check if sql_pack contains ''
    sql_pack_unescaped = sql_pack.replace("''", "'")
    print(f"\n=== {gid} ===")
    print(f"db len {len(db_pack)} sql len {len(sql_pack_unescaped)} equal={db_pack==sql_pack_unescaped}")
    if db_pack != sql_pack_unescaped:
        # find first diff
        for i,(a,b) in enumerate(zip(db_pack, sql_pack_unescaped)):
            if a!=b:
                print(f"first diff at {i}: db={repr(a)} sql={repr(b)} context db[{i-30:i+30}]={repr(db_pack[i-30:i+30])} sql={repr(sql_pack_unescaped[i-30:i+30])}")
                break
        else:
            if len(db_pack) != len(sql_pack_unescaped):
                print(f"prefix equal, length diff db {len(db_pack)} sql {len(sql_pack_unescaped)}")
                shorter = min(len(db_pack), len(sql_pack_unescaped))
                print(f"db tail {repr(db_pack[shorter-100:shorter+100])}")
                print(f"sql tail {repr(sql_pack_unescaped[shorter-100:shorter+100])}")
    # try parse sql
    try:
        json.loads(sql_pack_unescaped)
        print(f"sql_pack JSON valid")
    except Exception as e:
        print(f"sql_pack JSON invalid: {e}")
    try:
        json.loads(db_pack)
        print(f"db_pack JSON valid")
    except Exception as e:
        print(f"db_pack JSON invalid: {e}")
        print(f" db excerpt around error: {repr(db_pack[e.pos-80:e.pos+80]) if hasattr(e,'pos') else ''}")
