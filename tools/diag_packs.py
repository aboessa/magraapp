import pathlib, sqlite3, json

db = pathlib.Path('dashboard/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/18cae7f524a59861877816765fd4407fa27d29379615bd6bf0780aa20317addd.sqlite')
con = sqlite3.connect(str(db))
cur = con.cursor()

for gid in ['game-shape-trace-3','game-sort-animals-3','game-trace-color-advanced-3']:
    pack = cur.execute('SELECT content_pack FROM games WHERE id=?',(gid,)).fetchone()[0]
    print(f"\n=== {gid} len={len(pack)} ===")
    # find error pos
    try:
        json.loads(pack)
        print("valid")
        continue
    except json.JSONDecodeError as e:
        pos = e.pos
        print(f"error at {e.msg} pos {pos} line {e.lineno} col {e.colno}")
        start = max(0, pos-100)
        end = min(len(pack), pos+100)
        print(repr(pack[start:end]))
        # show with marker
        print(pack[start:pos] + " <<HERE>> " + pack[pos:end])
        # try to see what char at pos is
        print(f"char at pos: {repr(pack[pos])} ord {ord(pack[pos])}")
        # check balancing braces up to pos
        # try to find last valid prefix
        # binary search longest valid prefix
        lo, hi = 0, pos
        best = 0
        for i in range(pos-500, pos+1):
            try:
                json.loads(pack[:i])
                best = i
            except:
                pass
        # alternative: try to parse with strict=False? also check for trailing
        print(f"last valid prefix approx {best}")
        print(f"tail from best: {repr(pack[best:best+200])}")
