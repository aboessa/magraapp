import pathlib, json

sql_text = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').read_text(encoding='utf-8')

gid='game-sort-animals-3'
idx = sql_text.find(f"'{gid}'")
j_start = sql_text.find('\'{"pack_version"', idx)
pack_start = j_start+1
sq_close = sql_text.find("','published'", pack_start)
sql_pack = sql_text[pack_start:sq_close]

# The error is }]"assets" - let's examine character by character around 4270
pos=4270
print("around pos as chars:")
for i in range(pos-10, pos+20):
    ch = sql_pack[i] if 0 <= i < len(sql_pack) else '?'
    print(f"{i}: {repr(ch)} ord {ord(ch) if ch!='?' else '?'}")

# The closing sequence is ]}}],"assets"
# ] closes items, } closes bins wrapper? } closes level? } closes levels? ] closes levels array
# Structure: levels:[ {level1 items:[...]} , {level2 ...}, {level3 levels ... items:[...] ] , criterion? 
# Let's parse levels array structure more carefully
# Print level boundaries
import re
level_starts = [m.start() for m in re.finditer(r'"level":', sql_pack)]
print(f"\nlevel starts at: {level_starts}")
for ls in level_starts:
    print(f" level at {ls}: {sql_pack[ls-10:ls+40]}")
# Check what should be at pos: after level 3's items
# Level 3 is sort_bins with bins:[...] items:[...] but no audio? Let's compare to level 2
# Print level 2 and 3 slices
l2_start = level_starts[1] if len(level_starts)>1 else 0
l3_start = level_starts[2] if len(level_starts)>2 else 0
print(f"\nlevel 2 slice start: {sql_pack[l2_start-100:l2_start+300]}")
print(f"\nlevel 3 slice start: {sql_pack[l3_start-100:l3_start+600]}")

# Check tail after level 3
tail_start = sql_pack.rfind('"level":3')
print(f"\n tail from level3:")
print(sql_pack[tail_start:tail_start+1200])
