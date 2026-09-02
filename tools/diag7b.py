import pathlib, json, re

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

gid='game-sort-animals-3'
idx = sql_text.find(f"'{gid}'")
j_start = sql_text.find('\'{"pack_version"', idx)
pack_start = j_start+1
sq_close = sql_text.find("','published'", pack_start)
sql_pack = sql_text[pack_start:sq_close]
pos = 4270
print("pack len", len(sql_pack), "pos", pos)
print("snippet 4270 context:")
print(sql_pack[pos-250:pos+250])
print("\n--- braces ---")
open_b = sql_pack.count('{')
close_b = sql_pack.count('}')
print(f"braces open {open_b} close {close_b} diff {open_b-close_b}")
open_sq = sql_pack.count('[')
close_sq = sql_pack.count(']')
print(f"brackets open {open_sq} close {close_sq} diff {open_sq-close_sq}")
print("\n--- last 1000 ---")
print(sql_pack[-1000:])
print("\n--- prefix validity ---")
for test_pos in [4000, 4200, 4250, 4270]:
    try:
        json.loads(sql_pack[:test_pos])
        print(f"prefix {test_pos} valid")
    except Exception as e:
        print(f"prefix {test_pos} invalid: {e}")
