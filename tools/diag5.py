import pathlib, json

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

for gid in ['game-shape-trace-3','game-sort-animals-3','game-trace-color-advanced-3']:
    idx = sql_text.find(f"'{gid}'")
    j_start = sql_text.find('\'{"pack_version"', idx)
    pack_start = j_start + 1
    sq_close = sql_text.find("','published'", pack_start)
    sql_pack = sql_text[pack_start:sq_close]
    # json load attempt to get error pos
    try:
        json.loads(sql_pack)
        print(f"{gid}: SQL valid len {len(sql_pack)}")
    except json.JSONDecodeError as e:
        pos = e.pos
        # print context with safe encoding
        ctx = sql_pack[pos-150:pos+150]
        print(f"{gid}: invalid at {e.pos} col {e.colno}:")
        # use repr but replace non-ascii
        print(repr(ctx)[:3000])
        # also show raw chars around pos as hex
        snippet = sql_pack[pos-5:pos+5]
        print(f" chars around: {[hex(ord(c)) for c in snippet]} strs: {[repr(c) for c in snippet]}")
        # Check SQL file raw around sq_close for hidden chars
        raw = sql_text[pack_start+pos-30:pack_start+pos+30]
        print(f" raw file hex: {[hex(ord(c)) for c in raw]}")
