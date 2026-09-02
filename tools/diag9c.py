import pathlib, json

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

gid2='game-sort-animals-3'
idx2 = sql_text.find(f"'{gid2}'")
j_start2 = sql_text.find('\'{"pack_version"', idx2)
pack_start2 = j_start2+1
sq_close2 = sql_text.find("','published'", pack_start2)
sql_pack2 = sql_text[pack_start2:sq_close2]

# Try the other pattern variant
pat = '"}]}}],"assets"'
if pat in sql_pack2:
    fixed = sql_pack2.replace(pat, '"}]} }],"assets"'.replace(' ',''), 1)
    # Actually try: }]} -> ]}
    # The issue is ]}}], should be ]}],
    # Let's enumerate: current is items ] } level } ] levels , -> that's ]}}]
    # But we counted braces diff -1 (one extra close), so need to remove one }
    # For sort, the tail is ...items [...] } } ] , -> that's ]}}]
    # Try removing the middle }
    fixed2 = sql_pack2[:4270] + sql_pack2[4271:]  # remove char at 4270 which is extra }
    try:
        json.loads(fixed2)
        print(f"sort remove char at 4270 FIXED len {len(sql_pack2)}->{len(fixed2)}")
        print(fixed2[4260:4300])
    except Exception as e:
        print(f"still {e}")
        print(fixed2[4265:4285])

# Also test shape fix applied to sort
shape_fixed_pat = '"]}}}],"assets"'
if shape_fixed_pat in sql_pack2:
    fixed3 = sql_pack2.replace(shape_fixed_pat, '"]}}],"assets"', 1)
    try:
        json.loads(fixed3)
        print(f"sort shape pattern FIXED")
    except Exception as e:
        print(f"sort shape pattern not: {e}")
else:
    print(f"shape pattern not in sort")
    # what is the pattern around assets in sort?
    a_idx = sql_pack2.find('],"assets"')
    print(repr(sql_pack2[a_idx-50:a_idx+50]))
