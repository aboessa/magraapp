import pathlib, re
p = pathlib.Path(r'F:\Projects\cartoonapp\dashboard\api\migrations\0041_drawing_production_packs.sql')
t = p.read_text(encoding='utf-8')
t = t.replace("INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, learning_objective_id, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, difficulty, content_pack, instructions_ar, help_system, is_free, status, content_class)", "INSERT OR IGNORE INTO games (id, engine_id, series_id, title_ar, learning_objective_id, age_min, age_max, reading_level, interaction_mode, supervision_level, safety_notes, difficulty, content_pack, instructions_ar, help_system, is_free)")
t = t.replace("'touch'", "'tap'")
# remove last two values: ", 'draft', NULL" before );
t = re.sub(r", 'draft', NULL\s*\n\)", "\n)", t)
t = re.sub(r", 1, 'draft', NULL", ", 1", t)
# also handle cases where there is ", 'draft', NULL" with different spacing
t = t.replace(", 'draft', NULL", "")
p.write_text(t, encoding='utf-8')
print('fixed 0041')
print(t[:800])
