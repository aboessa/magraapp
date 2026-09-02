import pathlib
t = pathlib.Path('dashboard/api/migrations/0082_games_voice_assets.sql').read_text(encoding='utf-8')
# try validate each INSERT line standalone via python sqlite
import sqlite3, tempfile, os

# print first insert detail
lines = [l for l in t.split('\n') if l.strip().startswith("('asset-games")]
print(f"first line: {lines[0][:200]}")
# check expected_path unique constraint - maybe duplicate expected_path across inserts?
from collections import Counter
paths = []
for l in lines:
    # extract expected_path = 6th field? Pattern: ('id','audio','ready','private','generated','expected_path',...)
    # quick: find 6th quoted value
    parts = []
    in_q = False
    cur = ""
    for ch in l:
        if ch=="'" and in_q and l[l.index(ch)+1:l.index(ch)+2]=="'" if False else True:
            pass
        # simpler: split by "','"
        pass
    # just regex
    import re
    vals = re.findall(r"'([^']*(?:''[^']*)*)'", l)
    if vals:
        # vals[0]=id, [1]=audio, [2]=ready, [3]=private, [4]=generated, [5]=expected_path
        if len(vals) >= 6:
            paths.append(vals[5])

# count duplicate paths
c = Counter(paths)
dups = [(k,v) for k,v in c.items() if v>1]
print(f"total paths {len(paths)} unique {len(c)} dups {dups[:5]}")
# also r2_key = vals[7] if exists? Let's check vals length
import re
vals0 = re.findall(r"'([^']*(?:''[^']*)*)'", lines[0])
print(f"vals per row: {len(vals0)} values: {vals0}")

# Also check bucket value: allowed is 'media' or 'thumbs' or NULL, but we have 'majarra-media'
# Check schema: bucket IN ('media','thumbs')
print("check bucket")
vals_media = [v for v in vals0 if 'majarra' in v]
print(f"bucket values found: {vals_media}")
# maybe error is bucket check constraint
