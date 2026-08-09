-- 0022 — drawing/creative skills, and multi-skill learning objectives.
--
-- ## Why
--
-- Two defects blocked drawing from being pedagogically legible:
--
-- 1. `fine_motor` was registered by 0018 and then referenced by **zero**
--    objectives. Verified against local D1 before this migration:
--      SELECT count(*) FROM learning_objectives WHERE skill_id='fine_motor'; -- 0
--    Both drawing objectives pointed at `writing` instead:
--      skill.motor.pincer_grip  -> writing   (wrong: this is a motor objective)
--      lang.letters.trace_form  -> writing   (incomplete: also motor work)
--
-- 2. `learning_objectives.skill_id` is a single column, so an objective could
--    not say "this is literacy **and** fine motor". Letter tracing genuinely is
--    both, and forcing one value is what produced defect 1.
--
-- ## The mechanism
--
-- `learning_objectives.skill_id` is preserved and keeps meaning **the primary
-- skill**. Every existing reader keeps working unchanged:
--   - routes/adminCatalogue.ts  (objectives_count per skill)
--   - routes/adminMastery.ts    (skill_id filter + skills join)
--   - lib/catalogueValidation.ts
--   - front/src/pages/LearningObjectivesPage.tsx, SkillsPage.tsx
--
-- `learning_objective_skills` adds the secondary skills alongside it, and holds
-- the primary too so consumers that want the full picture read one table. A
-- partial unique index enforces at most one primary per objective, and the
-- backfill derives that primary from the legacy column — so the two can only
-- agree at the moment of migration.
--
-- Backfill is restricted to mappings verifiable from the objective's own code
-- and title. Objectives whose skill is genuinely undecided are left NULL rather
-- than guessed.

-- 1. Skills the drawing/creative curriculum actually needs -------------------
--
-- Deliberately NOT added, because an existing skill already covers the concept
-- and duplicating it would fragment reporting:
--   sequencing    -> `computational_thinking` ("تفكيك المهمة إلى خطوات مرتّبة، وتتبّعها")
--                    and existing objectives skill.ct.sequence / skill.ct.repeat_pattern
--                    already map to `coding`.
--   concentration -> `self_regulation` ("الانتظار، والعودة إلى الترتيب، وإتمام ما بُدئ به")
--   observation   -> `observation` already exists and is already used.
--   map_reading   -> already exists (0018).
--   fine_motor    -> already exists (0018); this migration finally uses it.
--
-- `creative` is a new value for skills.category. That column is plain TEXT with
-- no CHECK constraint and no enum in any consumer, so the value is additive.
INSERT OR IGNORE INTO skills (id, name_ar, category, description) VALUES
  ('hand_eye_coordination', 'التناسق بين اليد والعين', 'motor', 'توجيه اليد بناءً على ما تراه العين، ومتابعة الهدف أثناء الحركة.'),
  ('visual_motor_integration', 'التكامل البصري الحركي', 'motor', 'تحويل شكل مرئي إلى حركة تنتجه: يرى المسار فيرسمه بنفس الاتجاه والترتيب.'),
  ('creativity', 'الإبداع', 'creative', 'إنتاج شيء من تصوّر الطفل نفسه بلا نموذج يُحاكى وبلا جواب صحيح واحد.'),
  ('visual_expression', 'التعبير البصري', 'creative', 'استعمال الخط واللون والشكل للتعبير عن معنى أو شعور أو حكاية.'),
  ('spatial_awareness', 'الإدراك المكاني', 'cognitive', 'إدراك الموضع والاتجاه والمسافة: فوق وتحت وداخل وبين، وموضع الشيء على الورقة.'),
  ('shape_recognition', 'تمييز الأشكال', 'cognitive', 'تمييز الدائرة والمربع والمثلث وسواها بخصائصها لا بلونها أو حجمها.'),
  ('pattern_recognition', 'تمييز الأنماط', 'cognitive', 'إدراك التكرار المنظّم واستمراره: ما الذي يأتي بعد؟'),
  ('letter_formation', 'رسم الحروف', 'literacy', 'إنتاج شكل الحرف بترتيب رسم صحيح — الجسم قبل النقاط، والاتجاه من بيانات الحرف.'),
  ('number_formation', 'رسم الأرقام', 'numeracy', 'إنتاج شكل الرقم بترتيب رسم صحيح، بلا انعكاس.');

-- 2. Multi-skill objective mapping ------------------------------------------
CREATE TABLE IF NOT EXISTS learning_objective_skills (
  objective_id TEXT NOT NULL REFERENCES learning_objectives(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'secondary' CHECK (role IN ('primary', 'secondary')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (objective_id, skill_id)
);

-- At most one primary per objective. A partial unique index is the only way to
-- express this in SQLite, and it is what keeps `skill_id` and this table from
-- disagreeing about which skill is primary.
CREATE UNIQUE INDEX IF NOT EXISTS idx_objective_skills_single_primary
  ON learning_objective_skills(objective_id) WHERE role = 'primary';
CREATE INDEX IF NOT EXISTS idx_objective_skills_skill
  ON learning_objective_skills(skill_id, role);

-- 3. Backfill the primary from the legacy column ----------------------------
-- Every objective that already declared a skill keeps exactly that skill as its
-- primary. Nothing is invented here.
INSERT OR IGNORE INTO learning_objective_skills (objective_id, skill_id, role)
SELECT id, skill_id, 'primary' FROM learning_objectives WHERE skill_id IS NOT NULL;

-- 4. Correct the two drawing objectives -------------------------------------

-- 4a. `skill.motor.pincer_grip` is a motor objective. Its criterion is
-- "يرفع 4 مشابك خشبية من 5 بالإبهام والسبّابة" — there is no literacy in it.
-- Primary moves writing -> fine_motor, in both the legacy column and the table.
UPDATE learning_objectives
   SET skill_id = 'fine_motor'
 WHERE code = 'skill.motor.pincer_grip' AND skill_id = 'writing';

UPDATE learning_objective_skills
   SET skill_id = 'fine_motor'
 WHERE role = 'primary'
   AND skill_id = 'writing'
   AND objective_id IN (SELECT id FROM learning_objectives WHERE code = 'skill.motor.pincer_grip');

-- 4b. `lang.letters.trace_form` keeps `writing` as primary — it lives in ABJAD
-- and its measured criterion is letter form — but it is also motor work, which
-- is the whole reason the game exists. Secondary skills are added, not swapped,
-- so existing ABJAD reporting is untouched.
INSERT OR IGNORE INTO learning_objective_skills (objective_id, skill_id, role)
SELECT lo.id, s.skill_id, 'secondary'
  FROM learning_objectives lo
  JOIN (SELECT 'letter_formation' AS skill_id
        UNION ALL SELECT 'fine_motor'
        UNION ALL SELECT 'visual_motor_integration') s
 WHERE lo.code = 'lang.letters.trace_form';

-- 4c. Tracing a wide path to a target is hand-eye work on top of the grip.
INSERT OR IGNORE INTO learning_objective_skills (objective_id, skill_id, role)
SELECT lo.id, 'hand_eye_coordination', 'secondary'
  FROM learning_objectives lo
 WHERE lo.code = 'skill.motor.pincer_grip';

-- 5. Fill verified NULL skills ----------------------------------------------
-- These three objectives had skill_id IS NULL, so no consumer can regress, and
-- each maps to exactly one of the skills added above by its own definition.
UPDATE learning_objectives SET skill_id = 'shape_recognition'
 WHERE code = 'world.shape.circle_square' AND skill_id IS NULL;
UPDATE learning_objectives SET skill_id = 'pattern_recognition'
 WHERE code IN ('math.pattern.complete', 'world.pattern.ab_repeat') AND skill_id IS NULL;

INSERT OR IGNORE INTO learning_objective_skills (objective_id, skill_id, role)
SELECT id, skill_id, 'primary' FROM learning_objectives
 WHERE code IN ('world.shape.circle_square', 'math.pattern.complete', 'world.pattern.ab_repeat')
   AND skill_id IS NOT NULL;
