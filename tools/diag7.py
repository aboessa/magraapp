import pathlib, json

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

gid='game-sort-animals-3'
idx = sql_text.find(f"'{gid}'")
j_start = sql_text.find('\'{"pack_version"', idx)
pack_start = j_start+1
sq_close = sql_text.find("','published'", pack_start)
sql_pack = sql_text[pack_start:sq_close]
pos = 4270
print("pack len", len(sql_pack), "pos", pos)
print("snippet 4000-4300:", repr(sql_pack[4000:4350]))
print("snippet 4270 context:", repr(sql_pack[pos-250:pos+250]))
# count braces/brackets
for test_pos in [4200, 4250, 4270, 4300]:
    try:
        json.loads(sql_pack[:test_pos])
        print(f"prefix {test_pos} valid")
    except Exception as e:
        print(f"prefix {test_pos} invalid: {e}")
# Check the actual structure: find where levels array should close
# levels is array of 5 level objects, each ending with }
# Print last 500 chars as lines
print("\n--- last 800 chars ---")
print(repr(sql_pack[-800:]))
# Check if pack has duplicate closing
# Count braces
open_b = sql_pack.count('{')
close_b = sql_pack.count('}')
print(f"total braces {{{open_b} }} {close_b} diff {open_b-close_b}")
open_sq = sql_pack.count('[')
close_sq = sql_pack.count(']')
print(f"total brackets [{open_sq} ] {close_sq} diff {open_sq-close_sq}")
# Check for ]}} pattern count
import re
print("pattern ]}} count:", len(re.findall(r'\]\}\}', sql_pack))
print("pattern ]} count:", len(re.findall(r'\]\}', sql_pack)))
