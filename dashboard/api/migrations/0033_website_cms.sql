-- Public website CMS: pages, sections, revisions, SEO metadata and redirects.
--
-- ## Why one row per language instead of localized columns
--
-- `web_pages` is keyed `(page_key, language)`. The alternative — one row with
-- `title_ar`, `title_en`, `title_fr` — was rejected because a public page is not one
-- resource with three labels: it is three URLs, each with its own slug, its own
-- publication state, its own canonical and its own SEO metadata. Arabic may be live
-- while French is still in review, and a single row cannot express that without a
-- status column per language, which is the same table by a worse name.
--
-- `translation_group` links the three together. It is what `hreflang` needs and what
-- makes "show me the English equivalent of this page" a lookup rather than a guess by
-- slug similarity.
--
-- ## Why sections are rows with JSON content, not a single JSON blob per page
--
-- Ordering, activation and per-section media are the operations editors actually
-- perform, and all three are cheap against rows and awkward against a blob (reordering
-- means rewriting the whole page, and two editors touching different sections collide).
-- The *content* of a section is JSON because each section type has a different shape,
-- and a column per field across a dozen types would be mostly nulls.
--
-- ## Why SEO metadata is one polymorphic table
--
-- `seo_meta` serves website pages, blog posts and catalogue entities. The fields are
-- identical for all of them — title, description, canonical, robots, Open Graph,
-- structured data — and three copies of the same table would drift the first time one
-- gained a field. The polymorphic key cannot be a foreign key in SQLite, so
-- `entity_type` is constrained and the route validates the id against the right table.
--
-- ## Redirects
--
-- Global rather than per-entity: a redirect is a property of a *path*, and the whole
-- point is that the old path no longer belongs to anything. Slug changes create one of
-- these, which is the difference between renaming a page and deleting its search
-- ranking.

CREATE TABLE IF NOT EXISTS web_pages (
  id TEXT PRIMARY KEY,
  -- Stable identity across languages, e.g. 'plans'. Sections and code reference this.
  page_key TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar', 'en', 'fr')),
  -- Full public path including the language segment, e.g. '/ar/plans'. Stored rather
  -- than derived so a page can be moved without a code change, and UNIQUE so two pages
  -- cannot claim one URL.
  path TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  -- Groups the language variants of the same page. hreflang and the admin's
  -- "translations" panel both read this. (`--` not `///`: SQLite has no doc-comment
  -- syntax, and a `///` line here failed the whole migration at parse time.)
  translation_group TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  -- Scheduling is a timestamp plus a status, not a status alone: a scheduled page that
  -- forgets its time is indistinguishable from a draft.
  scheduled_at TEXT,
  published_at TEXT,

  -- Layout hint for the public renderer. Constrained so a typo cannot produce a page
  -- the site does not know how to render.
  kind TEXT NOT NULL DEFAULT 'standard' CHECK (kind IN ('home', 'standard', 'landing', 'legal', 'help', 'index')),
  -- Public pages are indexable by default; private and preview surfaces are not, and
  -- that is enforced in the renderer rather than trusted to this flag alone.
  is_indexable INTEGER NOT NULL DEFAULT 1 CHECK (is_indexable IN (0, 1)),

  created_by TEXT REFERENCES admin_users(id),
  updated_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (page_key, language)
);

CREATE INDEX IF NOT EXISTS idx_web_pages_group ON web_pages (translation_group, language);
CREATE INDEX IF NOT EXISTS idx_web_pages_status ON web_pages (status, scheduled_at);

CREATE TABLE IF NOT EXISTS web_page_sections (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES web_pages(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'hero', 'rich_text', 'feature_grid', 'media', 'cta', 'faq', 'plans',
    'content_rail', 'testimonials', 'steps', 'stats', 'partners', 'legal_text'
  )),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  -- Shape depends on section_type; validated in lib/websiteCms.ts, not here, because a
  -- CHECK cannot express "hero needs a headline and faq needs items".
  content_json TEXT NOT NULL DEFAULT '{}',
  -- Media by asset id rather than URL: an asset carries its own status, dimensions and
  -- bucket, and a pasted URL carries none of that and breaks silently when the file moves.
  media_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  cta_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_web_page_sections_page ON web_page_sections (page_id, sort_order);

-- Revisions: a full snapshot per save, which is what makes rollback a single write
-- rather than a replay of diffs. Cheap because a page is small and editors do not save
-- thousands of times.
CREATE TABLE IF NOT EXISTS web_page_revisions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES web_pages(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  note TEXT,
  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (page_id, version)
);

CREATE INDEX IF NOT EXISTS idx_web_page_revisions_page ON web_page_revisions (page_id, version DESC);

CREATE TABLE IF NOT EXISTS seo_meta (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('web_page', 'blog_post', 'series', 'story', 'planet')),
  entity_id TEXT NOT NULL,
  seo_title TEXT,
  meta_description TEXT,
  -- An override only. When null the renderer emits the page's own URL, which is correct
  -- far more often than any value an editor would type.
  canonical_url TEXT,
  robots_index INTEGER NOT NULL DEFAULT 1 CHECK (robots_index IN (0, 1)),
  robots_follow INTEGER NOT NULL DEFAULT 1 CHECK (robots_follow IN (0, 1)),
  og_title TEXT,
  og_description TEXT,
  og_image_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  -- Editor-supplied JSON-LD, merged with what the renderer derives. Stored as text and
  -- validated on write so an invalid blob cannot reach a public page.
  structured_data_json TEXT,
  updated_by TEXT REFERENCES admin_users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS web_redirects (
  id TEXT PRIMARY KEY,
  from_path TEXT NOT NULL UNIQUE,
  to_path TEXT NOT NULL,
  -- 301 by default: a slug change is permanent, and 302 tells search engines to keep
  -- the old URL, which is the opposite of the intent.
  status_code INTEGER NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 308)),
  reason TEXT,
  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The page set, seeded as drafts.
--
-- Seeded so the CMS is usable immediately and so the SEO audit has something to audit,
-- and as *drafts* so nothing appears publicly until an editor publishes it. Arabic only:
-- creating empty English and French rows would put three untranslated URLs into the
-- sitemap the moment the first page went live.
INSERT OR IGNORE INTO web_pages (id, page_key, language, path, slug, title, translation_group, kind) VALUES
('page-home-ar', 'home', 'ar', '/ar', '', 'مجرّة', 'home', 'home'),
('page-explore-ar', 'explore', 'ar', '/ar/explore', 'explore', 'استكشف', 'explore', 'standard'),
('page-planets-ar', 'planets', 'ar', '/ar/planets', 'planets', 'الكواكب', 'planets', 'index'),
('page-series-ar', 'series', 'ar', '/ar/series', 'series', 'السلاسل', 'series', 'index'),
('page-stories-ar', 'stories', 'ar', '/ar/stories', 'stories', 'القصص', 'stories', 'index'),
('page-games-ar', 'games', 'ar', '/ar/games', 'games', 'الألعاب', 'games', 'index'),
('page-audio-ar', 'audio', 'ar', '/ar/audio', 'audio', 'الصوتيات', 'audio', 'index'),
('page-learning-ar', 'learning', 'ar', '/ar/learning', 'learning', 'التعلّم', 'learning', 'standard'),
('page-parents-ar', 'parents', 'ar', '/ar/parents', 'parents', 'لأولياء الأمور', 'parents', 'standard'),
('page-safety-ar', 'safety', 'ar', '/ar/safety', 'safety', 'السلامة', 'safety', 'standard'),
('page-plans-ar', 'plans', 'ar', '/ar/plans', 'plans', 'الباقات', 'plans', 'landing'),
('page-devices-ar', 'devices', 'ar', '/ar/devices', 'devices', 'الأجهزة المدعومة', 'devices', 'standard'),
('page-download-ar', 'download', 'ar', '/ar/download', 'download', 'تحميل التطبيق', 'download', 'landing'),
('page-originals-ar', 'originals', 'ar', '/ar/originals', 'originals', 'إنتاج مجرّة', 'originals', 'standard'),
('page-about-ar', 'about', 'ar', '/ar/about', 'about', 'عن مجرّة', 'about', 'standard'),
('page-partners-ar', 'partners', 'ar', '/ar/partners', 'partners', 'الشراكات', 'partners', 'standard'),
('page-help-ar', 'help', 'ar', '/ar/help', 'help', 'المساعدة', 'help', 'help'),
('page-blog-ar', 'blog', 'ar', '/ar/blog', 'blog', 'المدونة', 'blog', 'index'),
('page-legal-ar', 'legal', 'ar', '/ar/legal', 'legal', 'الشؤون القانونية', 'legal', 'legal');
