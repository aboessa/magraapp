import pathlib, re, glob
base = pathlib.Path(r'F:\Projects\cartoonapp\dashboard\api\migrations')
for p in base.glob('*.sql'):
    t = p.read_text(encoding='utf-8')
    orig = t
    # fix double single quotes around identifiers: ''something'' -> 'something'
    # This pattern matches ''word'' where word is alphanumeric + - _
    t = re.sub(r"''([A-Za-z0-9_\-]+)''", r"'\1'", t)
    # Also fix ''test_fixture'' etc already handled
    # Remove UPDATE games SET content_class line if exists (since column doesn't exist)
    if "UPDATE games SET content_class" in t:
        # remove that line
        t = re.sub(r"UPDATE games SET content_class[^\n]*\n", "", t)
    if t != orig:
        p.write_text(t, encoding='utf-8')
        print(f"fixed {p.name}")
    else:
        print(f"no change {p.name}")
print("done")
