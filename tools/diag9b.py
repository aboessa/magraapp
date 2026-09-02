import pathlib, json

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

gid='game-shape-trace-3'
idx = sql_text.find(f"'{gid}'")
j_start = sql_text.find('\'{"pack_version"', idx)
pack_start = j_start+1
sq_close = sql_text.find("','published'", pack_start)
sql_pack = sql_text[pack_start:sq_close]

fd_idx = sql_pack.find('"free_draw"')
print("free_draw tail:")
print(sql_pack[fd_idx-100:fd_idx+900])
print()
pal_idx = sql_pack.find('#FF9F1C', fd_idx)
print(repr(sql_pack[pal_idx-30:pal_idx+80]))

gid2='game-sort-animals-3'
idx2 = sql_text.find(f"'{gid2}'")
j_start2 = sql_text.find('\'{"pack_version"', idx2)
pack_start2 = j_start2+1
sq_close2 = sql_text.find("','published'", pack_start2)
sql_pack2 = sql_text[pack_start2:sq_close2]
print("\nsort total len", len(sql_pack2))
# find last level
last_lvl = sql_pack2.rfind('"level":5')
print(sql_pack2[last_lvl-80:last_lvl+900])
print("\nsort last 700:")
print(sql_pack2[-750:])

# Test fixes
for name, pack in [('shape', sql_pack), ('sort', sql_pack2)]:
    # Try removing one } before ],"assets"
    # Pattern is ]}}}],"assets" -> should be ]}}],"assets" (one fewer })
    for pat in ['"]}}}],"assets"', '}]}}}],"assets"']:
        if pat in pack:
            fixed = pack.replace(pat, pat.replace('}}}', '}}', 1), 1)
            try:
                json.loads(fixed)
                print(f"{name} FIX with {repr(pat)} -> removed one }} SUCCESS len {len(pack)}->{len(fixed)}")
            except Exception as e:
                print(f"{name} still fail with {repr(pat)}: {e}")
