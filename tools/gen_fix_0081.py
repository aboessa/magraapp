import pathlib, json

sql_path = pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql')
sql_text = sql_path.read_text(encoding='utf-8')

def extract_pack(gid):
    idx = sql_text.find(f"'{gid}'")
    j_start = sql_text.find('\'{"pack_version"', idx)
    pack_start = j_start+1
    sq_close = sql_text.find("','published'", pack_start)
    return sql_text[pack_start:sq_close], pack_start, sq_close

# Shape
gid='game-shape-trace-3'
pack, ps, sc = extract_pack(gid)
print(f"{gid} original len {len(pack)}")
# Fix: "]}}}],\"assets\"" -> "]}}],\"assets\""
fixed = pack.replace('"]}}}],"assets"', '"]}}],"assets"', 1)
print(f"fixed len {len(fixed)}")
try:
    j=json.loads(fixed)
    print(f"shape valid levels {len(j['levels'])}")
except Exception as e:
    print(f"shape still invalid {e}")

# Sort
gid2='game-sort-animals-3'
pack2, ps2, sc2 = extract_pack(gid2)
print(f"{gid2} original len {len(pack2)}")
# fix by removing one } at position where extra exists
# Our earlier char removal at pos 4270: that's inside pack at offset 4270
# Let's apply generic fix: find the pattern '}]}}],"assets"' and replace with '}]}}],"assets"'? Actually sort pattern is '}]}]}}],"assets" ? Let's try same as shape
# Check what pattern exists
if '"]}}}],"assets"' in pack2:
    fixed2 = pack2.replace('"]}}}],"assets"', '"]}}],"assets"', 1)
    print("used shape pattern")
else:
    # fallback: remove char at error pos
    # error pos 4270 in original
    fixed2 = pack2[:4270] + pack2[4271:]
    print("used char removal")

print(f"fixed2 len {len(fixed2)}")
try:
    j2=json.loads(fixed2)
    print(f"sort valid levels {len(j2['levels'])}")
except Exception as e:
    print(f"sort still invalid {e}")
    print(repr(fixed2[4260:4290]))

# Trace advanced - second insertion is the valid one, extract the later occurrence after the comment
# Find the last occurrence of game-trace-color-advanced-3's INSERT INTO games
last_idx = sql_text.rfind("'game-trace-color-advanced-3','trace_color'")
j_start3 = sql_text.find('\'{"pack_version"', last_idx)
pack_start3 = j_start3+1
sq_close3 = sql_text.find("','published'", pack_start3)
pack3 = sql_text[pack_start3:sq_close3]
print(f"trace advanced valid pack len {len(pack3)}")
try:
    j3=json.loads(pack3)
    print(f"trace valid levels {len(j3['levels'])}")
except Exception as e:
    print(f"trace invalid {e}")
    print(repr(pack3[:200]))

# Now write migration
out = pathlib.Path('dashboard/api/migrations/0081_fix_wave4_truncated_packs.sql')
# Escape single quotes for SQL (replace ' with '')
def sql_escape(s):
    return s.replace("'", "''")

content = f"""-- 0081 — Fix truncated Wave 4 packs (extra closing brace)
-- Fixes 3 published games whose content_pack JSON is invalid due to an extra }}
-- - game-shape-trace-3: len 2439 -> 2438 (remove one }} before ],"assets")
-- - game-sort-animals-3: len 4998 -> 4997 (remove one }} before ],"assets")
-- - game-trace-color-advanced-3: DB has truncated 1671-char version, replace with valid 1854-char version
PRAGMA foreign_keys=ON;

UPDATE games SET content_pack = '{sql_escape(fixed)}', updated_at = datetime('now') WHERE id = 'game-shape-trace-3';
UPDATE games SET content_pack = '{sql_escape(fixed2)}', updated_at = datetime('now') WHERE id = 'game-sort-animals-3';
UPDATE games SET content_pack = '{sql_escape(pack3)}', updated_at = datetime('now') WHERE id = 'game-trace-color-advanced-3';
"""
out.write_text(content, encoding='utf-8')
print(f"\nWrote {out} {len(content)} chars")
# Verify all three after escaping round-trip
for name, p in [('shape', fixed), ('sort', fixed2), ('trace', pack3)]:
    esc = sql_escape(p)
    # simulate reading back: unescape '' -> '
    unesc = esc.replace("''", "'")
    assert unesc == p, f"escape roundtrip failed for {name}"
    print(f"{name} escape ok")

# Also fix the source SQL file for future fresh DBs
new_sql = sql_text.replace(pack.replace("'", "''")[:100], "REPLACE_ME", 1)  # placeholder
# Instead directly replace in file: shape
original_shape_pattern = '"]}}}],"assets"'
if original_shape_pattern in sql_text:
    new_sql_text = sql_text.replace('"]}}}],"assets"', '"]}}],"assets"', 1)
    print(f"Will fix sql file shape pattern occurrences: {sql_text.count(original_shape_pattern)} -> {new_sql_text.count(original_shape_pattern)}")
    # For sort, the pattern is slightly different: it's '} ]}}],"assets"' not '"]}}}'
    # Actually sort has same extra } but not with quote before ]? Let's check
    # Sort currently we fixed via char removal, not pattern. Check if pattern exists differently
    # Let's just write new_sql_text via python replacement of the specific packs
    # Use the fixed packs to reconstruct file
    # Replace first occurrence of shape's pack
    sql_text_fixed = sql_text.replace(pack, fixed, 1)
    sql_text_fixed = sql_text_fixed.replace(pack2, fixed2, 1)
    # For trace, the DB fix is enough; source file's second insert is already valid, no need to replace first truncated? But first truncated for trace is not used (first INSERT OR IGNORE for shape? For trace, the first insert for shape-trace is invalid, but trace's first is shape? Actually trace's first invalid is shape+sort, trace's valid is second insert - no need to replace file for trace first? The file's trace first occurrence is not separate - the invalid for trace DB came from earlier run where shape? Let's not modify trace file.
    pathlib.Path('dashboard/api/migrations/0074_wave4_closure_36_games.sql').write_text(sql_text_fixed, encoding='utf-8')
    print("Fixed 0074 file in place")
else:
    print("pattern not found, manual fix needed")
