import pathlib, json
sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')
for gid in ['game-shape-trace-3','game-sort-animals-3']:
    idx = sql_text.find(f"'{gid}'")
    j_start = sql_text.find('\'{"pack_version"', idx)
    pack_start = j_start+1
    sq_close = sql_text.find("','published'", pack_start)
    sql_pack = sql_text[pack_start:sq_close]
    pos = 1989 if gid=='game-shape-trace-3' else 4270
    print('gid',gid,'pack len',len(sql_pack),'pos',pos)
    print(repr(sql_pack[pos-400:pos+150])[:5000])
    print('--- bracket count up to pos ---')
    open_b = sql_pack[:pos].count('{')
    close_b = sql_pack[:pos].count('}')
    print('braces {',open_b,'}',close_b,'diff',open_b-close_b)
    open_sq = sql_pack[:pos].count('[')
    close_sq = sql_pack[:pos].count(']')
    print('brackets [',open_sq,']',close_sq,'diff',open_sq-close_sq)
    # Try incremental parse to find first error earlier?
    # Use json decoder with object hook to see where it diverges
    # Simplest: try json.loads on prefix up to pos-1
    for test_pos in [pos-50, pos-10, pos-1, pos]:
        try:
            json.loads(sql_pack[:test_pos])
            print(f" prefix {test_pos} valid")
        except Exception as e:
            print(f" prefix {test_pos} invalid: {e}")
