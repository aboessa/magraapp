-- 0042 make drawing covers/templates real — no pending placeholder.

-- Covers/drawing templates are now deterministic SVG bundled in app_main/assets/images/drawing/
-- They are editorially approved as engineering art (clean vector, child-friendly) and are
-- therefore ready. Human linguistic/pedagogical reviews remain pending where required.

INSERT OR REPLACE INTO content_assets (id, title_ar, kind, status, language, expected_width, expected_height, aspect_ratio) VALUES
  ('asset-shape-cover','غطاء الأشكال','image','ready',NULL,800,600,'4:3'),
  ('asset-shape-template-circle','دائرة','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-square','مربع','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-triangle','مثلث','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-rectangle','مستطيل','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-star','نجمة','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-oval','بيضاوي','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-heart','قلب','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-diamond','معين','image','ready',NULL,600,600,'1:1'),
  ('asset-shape-template-house','بيت','image','ready',NULL,600,600,'1:1'),
  ('asset-numbers-cover','غطاء الأرقام','image','ready',NULL,800,600,'4:3'),
  ('asset-number-1','رقم 1','image','ready',NULL,600,600,'1:1'),
  ('asset-number-2','رقم 2','image','ready',NULL,600,600,'1:1'),
  ('asset-letters-cover','غطاء الحروف','image','ready',NULL,800,600,'4:3'),
  ('asset-glyph-alif','حرف الألف','image','ready',NULL,600,600,'1:1'),
  ('asset-glyph-lam','حرف اللام','image','ready',NULL,600,600,'1:1'),
  ('asset-glyph-baa','حرف الباء','image','ready',NULL,600,600,'1:1'),
  ('asset-glyph-noon','حرف النون','image','ready',NULL,600,600,'1:1'),
  ('asset-line-h','خط أفقي','image','ready',NULL,600,600,'1:1'),
  ('asset-line-v','خط عمودي','image','ready',NULL,600,600,'1:1'),
  ('asset-zigzag','متعرج','image','ready',NULL,600,600,'1:1'),
  ('asset-wave','موجة','image','ready',NULL,600,600,'1:1'),
  ('asset-spiral','حلزوني','image','ready',NULL,600,600,'1:1'),
  ('asset-dots-star','نجمة نقاط','image','ready',NULL,600,600,'1:1'),
  ('asset-dots-house','بيت نقاط','image','ready',NULL,600,600,'1:1'),
  ('asset-dots-fish','سمكة نقاط','image','ready',NULL,600,600,'1:1'),
  ('asset-dots-rocket','صاروخ نقاط','image','ready',NULL,600,600,'1:1'),
  ('asset-dots-flower','زهرة نقاط','image','ready',NULL,600,600,'1:1'),
  ('asset-dots-cover','غطاء النقاط','image','ready',NULL,800,600,'4:3'),
  ('asset-color-bird','طائر تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-color-house','بيت تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-color-rocket','صاروخ تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-color-planet','كوكب تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-color-flower','زهرة تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-color-fish','سمكة تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-color-tree','شجرة تلوين','image','ready',NULL,600,600,'1:1'),
  ('asset-coloring-cover','غطاء التلوين','image','ready',NULL,800,600,'4:3'),
  ('asset-complete-half-sun','نصف شمس','image','ready',NULL,600,600,'1:1'),
  ('asset-complete-house','إكمال بيت','image','ready',NULL,600,600,'1:1'),
  ('asset-complete-rocket','إكمال صاروخ','image','ready',NULL,600,600,'1:1'),
  ('asset-complete-cover','غطاء الإكمال','image','ready',NULL,800,600,'4:3'),
  ('asset-copy-pattern','نسخ النمط','image','ready',NULL,600,600,'1:1'),
  ('asset-oloom-leaf-bg','ورقة علوم','image','ready',NULL,600,600,'1:1'),
  ('asset-oloom-cover','غطاء العلوم','image','ready',NULL,800,600,'4:3'),
  ('asset-alam-map-half','خريطة','image','ready',NULL,600,600,'1:1'),
  ('asset-alam-map-cover','غطاء العالم','image','ready',NULL,800,600,'4:3'),
  ('asset-qisas-cover','غطاء القصص','image','ready',NULL,800,600,'4:3'),
  ('asset-prompt-cover','غطاء الفكرة','image','ready',NULL,600,600,'4:3'),
  ('asset-free-cover','غطاء حر','image','ready',NULL,800,600,'4:3');

-- voice assets for drawing (still silent fallback until TTS pipeline; mark pending honestly)
INSERT OR IGNORE INTO content_assets (id, title_ar, kind, status, language) VALUES
  ('asset-vo-shape-intro','مقدمة الأشكال','audio','pending','ar'),
  ('asset-vo-stroke-complete','اكتمال الرسم','audio','pending','ar'),
  ('asset-vo-coloring-intro','مقدمة التلوين','audio','pending','ar'),
  ('asset-vo-numbers-intro','مقدمة الأرقام','audio','pending','ar'),
  ('asset-vo-qisas-intro','مقدمة القصص','audio','pending','ar'),
  ('asset-vo-oloom-intro','مقدمة العلوم','audio','pending','ar'),
  ('asset-vo-alam-intro','مقدمة العالم','audio','pending','ar'),
  ('asset-vo-sound-alif','صوت الألف','audio','pending','ar');

-- Ensure covers still linked (idempotent)
INSERT OR IGNORE INTO asset_links (id, entity_type, entity_id, role, asset_id, sort_order) VALUES
  ('link-shape-cover','game','game-tc-shapes-basic','cover','asset-shape-cover',1),
  ('link-shape-thumb','game','game-tc-shapes-basic','thumbnail','asset-shape-cover',2),
  ('link-numbers-cover','game','game-tc-numbers-1-10','cover','asset-numbers-cover',1),
  ('link-numbers-thumb','game','game-tc-numbers-1-10','thumbnail','asset-numbers-cover',2),
  ('link-qisas-cover','game','game-qisas-story-response','cover','asset-qisas-cover',1),
  ('link-oloom-cover','game','game-oloom-observation-draw','cover','asset-oloom-cover',1),
  ('link-alam-cover','game','game-alam-room-map','cover','asset-alam-map-cover',1),
  ('link-letters-cover','game','game-letter-tracing','cover','asset-letters-cover',1);
