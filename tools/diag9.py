import pathlib, json

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

# Shape trace - the error is at 1951 vs 1989 differing between file and DB
# The issue is the levels array closing: we have 5 levels, the last one is free_draw
# Its structure: {"level":5,"mode":"free_draw",...,"coloring":{...}}}  -> then ],"assets"
# But the file has: palette [..."]}}}],"assets"
# That's palette ] , } coloring, } level, } levels element? No - levels element closes with }, then levels array closes with ]
# So sequence should be: "palette":[...] } } ] , "assets"
# That's: ] (palette) } (coloring) } (level) ] (levels) , 
# But file has: ] } } } ] ,  -> extra }
# Let's count: for level 5, nesting is: levels[ { level:5, coloring:{ palette:[...] } } ]
# So after palette ] we have } (coloring) } (level) ] (levels)
# That's ]}}]  but file has ]}}}]
# Extra }

# Check shape trace
gid='game-shape-trace-3'
idx = sql_text.find(f"'{gid}'")
j_start = sql_text.find('\'{"pack_version"', idx)
pack_start = j_start+1
sq_close = sql_text.find("','published'", pack_start)
sql_pack = sql_text[pack_start:sq_close]

# Find free_draw level tail
fd_idx = sql_pack.find('"free_draw"')
print("free_draw section tail:")
print(sql_pack[fd_idx-200:fd_idx+800])
print("\n--- hex around palette ---")
pal_idx = sql_pack.find('#FF9F1C', fd_idx)
print(repr(sql_pack[pal_idx-50:pal_idx+100]))
# Check how many } after palette
after = sql_pack[pal_idx+6:pal_idx+30]
print(f"after FF9F1C: {repr(after)} -> {[hex(ord(c)) for c in after[:15]]}")

# Check sort_animals tail
gid2='game-sort-animals-3'
idx2 = sql_text.find(f"'{gid2}'")
j_start2 = sql_text.find('\'{"pack_version"', idx2)
pack_start2 = j_start2+1
sq_close2 = sql_text.find("','published'", pack_start2)
sql_pack2 = sql_text[pack_start2:sq_close2]
# find last level's tail
last_lvl = sql_pack2.rfind('"level":5')
print("\nsort_animals last level tail:")
print(sql_pack2[last_lvl-100:last_lvl+800])
print("\nsort_animals last 500:")
print(sql_pack2[-600:])
# Check closing braces count around error pos
pos=4270
print(f"\nsort closing around {pos}: {repr(sql_pack2[pos-30:pos+50])}")
# The correct closing should be items ] } level } ] levels , but we have ]}}]
# Let's validate fix: remove one }
for test_pack in [sql_pack, sql_pack2]:
    for extra_count in [1]:
        fixed = test_pack.replace('"]}}}],"assets"', '"]}}],"assets"', 1)
        try:
            json.loads(fixed)
            print(f"FIX ]}}}]->]}}] valid for len {len(test_pack)}")
        except Exception as e:
            print(f"still invalid: {e}")

# Test fix for sort_animals
fixed2 = sql_pack2.replace('}]}}],"assets"', '}]}}],"assets"', 1)  # try variants
# Actually sort's error is at ]}}],"assets" as well - let's brute force
for pattern, repl in [('"]}}}],"assets"', '"]}}],"assets"'), ('}]}}],"assets"', '}]}}],"assets"'), ('"}}],"assets"', '"} ],"assets"')]:
    if pattern in sql_pack2:
        f = sql_pack2.replace(pattern, repl, 1)
        try:
            json.loads(f)
            print(f"sort pattern {repr(pattern)} -> {repr(repl)} FIXED")
        except Exception as e:
            print(f"sort pattern {repr(pattern)} still {e}")
            # show where
            pass
