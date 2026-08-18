import pathlib
p = pathlib.Path(r'F:\Projects\cartoonapp\dashboard\api\migrations\0041_drawing_production_packs.sql')
t = p.read_text(encoding='utf-8')
# fix slug quoting: ''qisas'' -> 'qisas'
t = t.replace("''qisas''", "'qisas'")
t = t.replace("''oloom''", "'oloom'")
t = t.replace("''alam''", "'alam'")
# fix series_id subselect to just NULL to avoid needing planets table
# Replace the specific patterns
import re
# Replace (SELECT id FROM series WHERE planet_id = (SELECT id FROM planets WHERE slug = 'qisas' LIMIT 1) LIMIT 1) with NULL
t = re.sub(r"\(SELECT id FROM series WHERE planet_id = \(SELECT id FROM planets WHERE slug = 'qisas' LIMIT 1\) LIMIT 1\)", "NULL", t)
t = re.sub(r"\(SELECT id FROM series WHERE planet_id = \(SELECT id FROM planets WHERE slug = 'oloom' LIMIT 1\) LIMIT 1\)", "NULL", t)
t = re.sub(r"\(SELECT id FROM series WHERE planet_id = \(SELECT id FROM planets WHERE slug = 'alam' LIMIT 1\) LIMIT 1\)", "NULL", t)
p.write_text(t, encoding='utf-8')
print('fixed qisas')
print(t[2000:2500])
