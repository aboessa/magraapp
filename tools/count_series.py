import json, pathlib, os, glob, re

root = pathlib.Path(r"F:\Projects\cartoonapp")
series_json_path = root / "_series.json"
raw = series_json_path.read_text(encoding='utf-8')
data = json.loads(raw)
if isinstance(data, list) and len(data)>0 and isinstance(data[0], dict) and 'results' in data[0]:
    data = data[0]['results']
elif isinstance(data, dict) and 'results' in data:
    data = data['results']

print(f"=== _series.json total: {len(data)} series ===")
for s in data:
    print(f"  {s.get('planet_id'):10} | {s.get('slug'):35} | eps:{s.get('eps'):2} | {s.get('title_ar')}")

print("\n=== FileSystem scan: docs/content/planets/*/* with ep-*.md ===")
planets_root = root / "docs" / "content" / "planets"
series_map = {}
for planet_dir in sorted(planets_root.glob("*")):
    if not planet_dir.is_dir():
        continue
    planet_name = planet_dir.name
    for series_dir in sorted(planet_dir.glob("*")):
        if not series_dir.is_dir():
            continue
        eps = sorted(series_dir.glob("ep-*.md"))
        if eps:
            series_map[str(series_dir)] = eps

# Group display
total_eps = 0
for full_path, eps in sorted(series_map.items(), key=lambda x: x[0]):
    p = pathlib.Path(full_path)
    planet = p.parent.name
    series_folder = p.name
    total_eps += len(eps)
    print(f"{planet:15} | {series_folder:30} | {len(eps)} eps | {full_path}")
    for ep in eps:
        print(f"    - {ep.name}")

print(f"\nTOTAL folders with ep-*.md: {len(series_map)}")
print(f"TOTAL ep-*.md files: {total_eps}")

# Also check qisas story folders
print("\n=== Qisas story folders (story-*.md) ===")
for planet_dir in sorted(planets_root.glob("*")):
    for series_dir in sorted(planet_dir.glob("*")):
        if not series_dir.is_dir():
            continue
        stories = sorted(series_dir.glob("story-*.md"))
        if stories:
            print(f"{planet_dir.name:15} | {series_dir.name:30} | {len(stories)} stories")
            for s in stories:
                print(f"    - {s.name}")

# Series bibles titles
print("\n=== Series Bibles title extraction ===")
bibles = sorted(planets_root.rglob("series-bible-*.md"))
for bible in bibles:
    text = bible.read_text(encoding='utf-8', errors='ignore')
    # try to find first '# ' or title_ar
    title_ar = ""
    # look for lines with Arabic titles
    m = re.search(r'title_ar\s*[:=]\s*"?([^"\n]+)"?', text)
    if m:
        title_ar = m.group(1).strip()
    else:
        # look for first heading
        m2 = re.search(r'^#\s+(.+)$', text, re.MULTILINE)
        if m2:
            title_ar = m2.group(1).strip()[:80]
    print(f"{bible.parent.name:15} | {bible.name:40} | {title_ar}")

# README.md parsing for mapping
print("\n=== README mapping for Arabic titles ===")
for readme in sorted(planets_root.rglob("README.md")):
    txt = readme.read_text(encoding='utf-8', errors='ignore')[:2000]
    # print first line
    print(f"\n--- {readme.relative_to(root)} ---")
    print(txt[:1000])
