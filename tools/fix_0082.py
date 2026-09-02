import pathlib
p = pathlib.Path('dashboard/api/migrations/0082_games_voice_assets.sql')
t = p.read_text(encoding='utf-8')
t2 = t.replace("'majarra-media'", "'media'")
# Also the bucket column is actually ENUM ('media','thumbs') not bucket name - fix already
p.write_text(t2, encoding='utf-8')
print(f"Fixed bucket: {t.count('majarra-media')} -> {t2.count('majarra-media')} occurrences removed")
print(f"media count: {t2.count(\"'media'\")}")
# verify no syntax break
assert "''media''" not in t2
print("ok")
