import pathlib, json, re

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

for gid in ['game-shape-trace-3','game-trace-color-advanced-3']:
    idx = sql_text.find(f"'{gid}'")
    j_start = sql_text.find('\'{"pack_version"', idx)
    pack_start = j_start + 1
    sq_close = sql_text.find("','published'", pack_start)
    sql_pack = sql_text[pack_start:sq_close]
    print(f"\n=== {gid} ===")
    print(f"pack_start {pack_start} sq_close {sq_close} len {len(sql_pack)}")
    # Show last 600 chars
    print("LAST 700:", repr(sql_pack[-700:]))
    # Look for assets section
    a_idx = sql_pack.find('"assets"')
    print(f"assets at {a_idx}, snippet: {repr(sql_pack[a_idx-20:a_idx+500])[:900]}")
    # Validate JSON up to assets
    try:
        json.loads(sql_pack)
        print("FULL valid")
    except json.JSONDecodeError as e:
        print(f"invalid at {e.pos}: {repr(sql_pack[e.pos-80:e.pos+80])}")
        # check what follows assets in file vs DB
        # raw file around sq_close
        print("RAW FILE around closing:", repr(sql_text[pack_start+len(sql_pack)-200:pack_start+len(sql_pack)+500])[:2000])
