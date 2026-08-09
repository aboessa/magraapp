-- Blog CMS: authors, categories, tags, posts, revisions.
--
-- ## Same language model as `web_pages`, for the same reason
--
-- One row per `(post_key, language)`. An Arabic post can be live while its French
-- translation is in review, each has its own slug and its own SEO row, and
-- `translation_group` is what `hreflang` and the editor's translation panel read.
-- SEO metadata is not duplicated here: `seo_meta` (migration 0033) already covers
-- `blog_post`.
--
-- ## Why the body is JSON and not HTML
--
-- Editors need headings, lists, images, quotes, callouts, CTAs and related-content
-- blocks. Stored as HTML, every one of those becomes unvalidatable — an editor can paste
-- a script tag, and the renderer has no way to know a block is a CTA rather than a
-- paragraph that looks like one. A block array is validated on write
-- (`lib/blogCms.ts`), renders to safe markup, and stays queryable: "which posts embed a
-- video" is answerable.
--
-- ## Religious content
--
-- The existing governance is reused rather than reinvented: `source_type`,
-- `source_reference`, `religious_reviewer_id` and `religious_approved_at`, checked by
-- `lib/islamicContent.ts` — the same predicate and the same required fields that guard
-- series and episodes. `content_reviews` could not be used: its `entity_type` CHECK
-- covers series/episode/book/game/project and widening it needs a table rebuild, so a
-- blog review row cannot exist there. Putting the four columns on the post keeps one
-- definition of "approved by a named reviewer on a date" instead of a second, weaker one.

CREATE TABLE IF NOT EXISTS blog_authors (
  id TEXT PRIMARY KEY,
  -- Optional link to a staff account. Optional because a guest author is a real case and
  -- creating an admin login for someone who will never sign in is worse than a null.
  admin_user_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY,
  category_key TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar', 'en', 'fr')),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (category_key, language),
  UNIQUE (language, slug)
);

-- Tags carry their labels inline rather than as one row per language.
--
-- A tag is a filter, not content: it has no page of its own, no SEO row and no
-- publication state, so the three-rows-per-language model would add joins for nothing.
CREATE TABLE IF NOT EXISTS blog_tags (
  slug TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  name_fr TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  post_key TEXT NOT NULL,
  language TEXT NOT NULL CHECK (language IN ('ar', 'en', 'fr')),
  slug TEXT NOT NULL,
  -- Full public path, e.g. '/ar/blog/why-stories-matter'. UNIQUE so two posts cannot
  -- claim one URL, which is the defect that produces duplicate-content penalties.
  path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT,
  -- Block array; see the header note on why this is not HTML.
  body_json TEXT NOT NULL DEFAULT '[]',
  hero_asset_id TEXT REFERENCES content_assets(id) ON DELETE SET NULL,
  author_id TEXT REFERENCES blog_authors(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES blog_categories(id) ON DELETE SET NULL,
  translation_group TEXT NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  scheduled_at TEXT,
  published_at TEXT,

  -- Related posts and related catalogue content, as id arrays. Arrays rather than join
  -- tables because the order is editorial and a join table loses it without a sort column
  -- that nothing else needs.
  related_posts_json TEXT NOT NULL DEFAULT '[]',
  related_content_json TEXT NOT NULL DEFAULT '[]',
  cta_json TEXT NOT NULL DEFAULT '{}',

  -- Religious governance, reusing lib/islamicContent.ts. See the header note.
  source_type TEXT CHECK (source_type IS NULL OR source_type IN ('quran', 'hadith', 'sira', 'adab', 'general')),
  source_reference TEXT,
  religious_reviewer_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL,
  religious_approved_at TEXT,

  created_by TEXT REFERENCES admin_users(id),
  updated_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_key, language),
  UNIQUE (language, slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_group ON blog_posts (translation_group, language);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts (category_id, status);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_slug TEXT NOT NULL REFERENCES blog_tags(slug) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag ON blog_post_tags (tag_slug);

-- Revisions, including autosaves.
--
-- `is_autosave` separates the two so revision history stays readable: an editor looking
-- for "the version before I broke it" should not scroll through sixty autosaves, and an
-- autosave that overwrote a manual revision would lose the only checkpoint anyone chose.
CREATE TABLE IF NOT EXISTS blog_post_revisions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  is_autosave INTEGER NOT NULL DEFAULT 0 CHECK (is_autosave IN (0, 1)),
  note TEXT,
  created_by TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, version)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_revisions_post ON blog_post_revisions (post_id, version DESC);

-- Baseline taxonomy, Arabic only.
--
-- Arabic only for the same reason the page seed is: creating empty English and French
-- rows would put untranslated URLs into the sitemap as soon as anything published.
INSERT OR IGNORE INTO blog_categories (id, category_key, language, name, slug, sort_order) VALUES
('blogcat-parenting-ar', 'parenting', 'ar', 'تربية', 'parenting', 1),
('blogcat-learning-ar', 'learning', 'ar', 'تعلّم', 'learning', 2),
('blogcat-islamic-ar', 'islamic', 'ar', 'قيم إسلامية', 'islamic-values', 3),
('blogcat-product-ar', 'product', 'ar', 'أخبار مجرّة', 'majarra-news', 4),
('blogcat-safety-ar', 'safety', 'ar', 'سلامة الأطفال', 'child-safety', 5);
