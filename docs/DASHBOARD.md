# لوحة تحكم مجرة - الدليل الشامل

> **الرابط:** `https://majarra-dashboard.pages.dev` | **الواجهة:** `React 19 + Vite 8 + TypeScript` | **الخلفية:** `Hono + D1 + R2 + Queues + Durable Objects` | **المصدر الأعلى:** `التصاريح والادوار والمستخدمين .md`

## 1. نظرة عامة

لوحة تحكم `Majarra CMS` تدير **9 كواكب** و **4 أنواع محتوى** (`Series/Season/Episode/Story/Book/Game/Project`) بثلاث مسارات عمرية (`preschool 3-5 / kids 6-8 / junior 9-12`) مع نظام تصاريح 4 طبقات (`دور + نطاق + نوع محتوى + لغة`) ومسار مراجعة `مسودة -> منشورة`.

**المسارات:** `/` (هبوط) -> `/admin` (لوحة التحكم)

---

## 2. الهيكل العام

```
AdminLayout
├── Sidebar (5 مجموعات)
│   ├── نظرة عامة: لوحة التحكم / التحليلات / مهامي
│   ├── إدارة المحتوى: الكواكب / السلاسل / المواسم / الحلقات / الشخصيات / القصص / مكتبة الوسائط / الاستايلات
│   ├── الإطار التعليمي: المهارات / الأهداف / الإتقان
│   ├── المستخدمون: أولياء الأمور / ملفات الأطفال / الأجهزة
│   └── التجارة: الاشتراكات / الحقوق / المراجعات
├── Topbar (لغة ar/en + مستخدم)
└── Page Content
```

**التقنيات:** `React Router 7`, `Vite proxy /api -> 127.0.0.1:8787`, `fetch API_ROOT = VITE_API_BASE_URL || /api/v1`, `Bearer admin-token` + `X-Admin-Actor`.

---

## 3. كل الصفحات بالتفصيل

### 3.1 `/admin` - لوحة التحكم `DashboardPage.tsx`

**الميزات:**
- **إحصائيات:** `total_series / published_series / total_episodes / published_episodes / active_parents / active_children` من `GET /admin/dashboard/stats`
- **حسب المسار:** عدد السلاسل لكل `track` (`preschool/kids/junior`)
- **حسب الحالة:** توزيع `draft/writing/review/published` pie
- **حسب الباقة:** `free/family/family_plus`
- **آخر السلاسل:** 5 سلاسل حديثة مع `planet_name / track_ids / episodes_count`
- **آخر النشاطات:** 6 سجلات من `audit_logs`

**التحكم:** قراءة فقط - لا تعديل.

### 3.2 `/admin/taxonomy` - الكواكب والتصنيفات `TaxonomyPage.tsx`

**الميزات:**
- **الكواكب:** `GET /admin/planets` + `POST/PATCH/DELETE /admin/planets/:id` - `name_ar/en`, `color_hex`, `icon_url`, `sort_order`, `is_active` - مع `series_count` و `assets_count`
- **التصنيفات:** `GET /admin/categories` - نفس الحقول + `slug`
- **الربط:** `PUT /admin/series/:id/categories` لتعيين `category_ids` و `primary_category_id`

### 3.3 `/admin/series` - السلاسل `SeriesPage.tsx`

**الميزات:**
- **جدول:** `title_ar / planet / track_ids / age_min-max / type / price_tier / status / episodes_count` مع فلترة `q/track/status/planet/type` وبحث
- **النموذج:** `title_ar/en`, `planet_id`, `type (continuous/anthology/knowledge/presenter/standalone)`, `age_min/max (3-12)`, `track_ids` (مشتقة من العمر), `reading_level`, `interaction_mode`, `supervision_level`, `production_level`, `price_tier`, `visual_style_id`, `cover_url`
- **العمليات:** `POST /admin/series` (إنشاء + `series_tracks` + `audit`), `PATCH` (تحديث + `islamic validation`), `DELETE` (أرشفة)
- **الحوكمة الإسلامية:** `migration 0011` + `validateIslamicFields()` يمنع `published` بدون `source_type/verse/hadith/reviewer/approved_at` إذا `planet_id=iman`

### 3.4 `/admin/seasons` - المواسم `SeasonsPage.tsx`

**الميزات:**
- `GET /admin/seasons?series_id` - `season_number`, `title_ar`, `theme_ar`, `episode_count`, `watch_order`, `learning_goals`, `status`
- `POST/PATCH/DELETE` مع `UNIQUE(series_id, season_number)`

### 3.5 `/admin/episodes` - الحلقات `EpisodesPage.tsx`

**الميزات:**
- **جدول:** `title_ar / series_title / track_ids / duration / age / status / is_published`
- **الفلترة:** `q/series_id/track/status`
- **النموذج:** `title_ar`, `series_id`, `season_id`, `episode_number`, `description_ar`, `video_master_url`, `video_hls_1080/480`, `thumbnail_url`, `duration_seconds`, `age_min/max`, `reading_level` إلخ + `POST /admin/episodes` مع `episode_tracks`

### 3.6 `/admin/characters` - الشخصيات `CharactersPage.tsx`

**الميزات:**
- `series_id`, `name_ar`, `role (hero/side/villain)`, `age`, `traits`, `speech_style`, `reference_images`, `voice_actor`, `languages`

### 3.7 `/admin/stories` - القصص والكوميكس `StoriesPage.tsx` (نظام 26 نقطة)

**الميزات (3 أعمدة):**
- **يسار:** قائمة مصغرات قابلة للسحب `Drag & Drop` لإعادة الترتيب + `+ صفحة`
- **وسط:** محرر الصفحة:
  - رفع `صورة` (`image`) - سحب أو اختيار من المكتبة
  - تبويبات `عربي/EN/FR` - `body_text`, `alt_text`, `narration_asset_id`
  - فقاعات حوار `Dialogue` (اختيارية)
  - `layout: full_bleed/split/panels/text_focus`
- **يمين:** حالة `الصور/النص/الصوت` + أخطاء النشر + `معاينة موبايل/تابلت/TV` + `JSON`
- **الأنواع:** `picture_book / comic / audio_story / interactive` - كل نوع له `interaction_mode` و `layout` مختلف
- **الرفع:** `Bulk images` (ينشئ صفحات تلقائياً) + `ZIP` (`images/page_*.webp + audio/ar/*.m4a + story.xlsx`) + `Drag & Drop` + `Progress`
- **اللغات:** `ar/en/fr` - كل صفحة نص وصوت مستقل + `timing_cues` للكوميكس + `visual_style_id`
- **الحالات:** `draft/writing/review_edu/review_lang/review_sharia/production/qa/ready/scheduled/published/archived`
- **الإصدارات:** `content_versions` - لا يعدل المنشور مباشرة، ينشئ `Draft` جديد

**API:** `GET/POST /admin/stories`, `GET /admin/stories/:id` (مع `pages/bubbles/localizations`), `POST /admin/stories/:id/pages`, `PUT /admin/story-pages/:id/localizations/:lang`, `POST /admin/story-pages/:id/bubbles`

### 3.8 `/admin/library-content` - الكتب والألعاب والمشروعات

**الميزات:**
- **الكتب `books`:** `title_ar, type (picture_book), pages, age_min/max, reading_level`
- **الألعاب `games`:** `engine_id, title_ar, age_min/max, difficulty, content_pack, help_system, is_free` - مربوطة بـ `game_engines`
- **المشروعات `projects`:** `materials, steps, learning_objective_ids`

### 3.9 `/admin/media` - مكتبة الوسائط `MediaLibraryPage.tsx`

**الميزات:**
- `GET /admin/assets` مع `kind (image/audio/video)`, `status`, `visibility`
- `POST /admin/assets` + `PUT /admin/assets/:id/content` (مباشر حتى `95MB`) أو `asset-upload-sessions` مجزأ
- `GET /admin/assets/stats` - `total/ready/planned` + `import-catalog` من `IMAGE_PROMPTS_CATALOG`
- `PUT /admin/assets/:id/links` لربط `entity_type/entity_id` + `R2` (`MEDIA_BUCKET/THUMBS_BUCKET`)

### 3.10 `/admin/visual-styles` - الاستايلات البصرية

**الميزات:**
- `medium (2d/3d/mixed)`, `prompt_fragment`, `negative_prompt`, `production_level`, `age_tracks`, `source_reference`

### 3.11 `/admin/parents` + `/admin/children` - المستخدمون

**الحالة:** الآن **قراءة فقط** من `FamilyState DO` عبر `adminFamilyProjection.ts` (الملكية انتقلت للـ DO في `2026-08`). المعاملات القديمة `/admin/parents` و `/admin/children` (الكتابة في `children_profiles` D1) **محذوفة** - بقيت `family_projection/child_projection` للقراءة فقط.

- `GET /admin/parents` - `display_name, email, plan, children_count`
- `GET /admin/children` - `nickname, age_track, parent_name, status`

### 3.12 `/admin/teams` - الفرق `TeamsPage.tsx` (جديد)

**الميزات:**
- `GET /admin/teams` - `name_ar, planet_id, section, members_count`
- `POST /admin/teams` - `name_ar, planet_id, section, member_ids` -> `teams + team_members`

### 3.13 `/admin/roles` - الأدوار `RolesPage.tsx` (جديد)

**الميزات:**
- `GET /admin/roles` (12 دور نظامي: `owner/system_admin/content_manager/planet_manager/section_lead/content_creator/illustrator/sound_engineer/translator/reviewer/publisher/viewer`)
- `GET /permissions` (20 صلاحية: `view/create/edit_text/upload_images/review/approve/publish...`)
- `GET /grants` - عرض `4 طبقات: دور+نطاق(منصة/كوكب/قسم/سلسلة/قصة/صفحة/لغة)+نوع محتوى+لغة+صلاحية زمنية`
- `POST /admin/grants` - منح `grantee_type/user|team + role + scope + language + valid_until`

### 3.14 `/admin/tasks` - مهامي `MyTasksPage.tsx` (جديد)

**الميزات:**
- `GET /admin/tasks?assignee_id&status` - `title_ar, content_id, planet_id, priority, status, due_date`
- حالات `pending/in_progress/review/changes_requested/approved/done/late`
- `Durable Object` اختياري لكل قصة للـ `Presence` وقفل الصفحة

### 3.15 `/admin/billing` - الاشتراكات `BillingPage.tsx` (جديد)

**الميزات:**
- `GET /admin/billing/stats` - `by_plan (free/family/family_plus)` من `family_projection` + `recent_purchases` من `billing_audit` + `recent_entitlements` من `processed_family_events`
- `GET /admin/billing/purchases` - `purchase_token_hash, status, expires_at`
- `GET /admin/billing/entitlements` - `plan/status` غير `free`

### 3.16 `/admin/analytics` - الإحصائيات `AnalyticsPage.tsx` (جديد)

**الميزات:**
- `GET /admin/analytics/overview` - `total_plays, by_track, mastery (independent/practicing/introduced), recent_events`
- `GET /admin/analytics/children/:childId` - `content_progress` لكل طفل (مجهول - `child_id` فقط)

### 3.17 `/admin/devices` (ناقص - `soon`)

- كان في `Sidebar` لكنه `soon` - الآن `FamilyState` يدير `devices` و `auth_sessions` ولا واجهة لها. المطلوب: `GET /admin/parents/:id/devices` + `POST /devices/revoke` عبر `FamilyState`.

---

## 4. الشريط الجانبي

```
نظرة عامة: لوحة التحكم / التحليلات / مهامي
إدارة المحتوى: الكواكب / السلاسل / المواسم / الحلقات / الشخصيات / القصص / مكتبة الوسائط / الاستايلات / الكتب والألعاب
الإطار التعليمي: المهارات / الأهداف / الإتقان
المستخدمون: أولياء الأمور / ملفات الأطفال / الأجهزة / الفرق / الأدوار
التجارة: الاشتراكات / الحقوق / المراجعات
```

كل قسم غير مسموح به **لا يظهر**، وحتى عند فتح رابط مباشر يرفض `Worker` الطلب (`Deny by default`).

## 5. الإشعارات

تُرسل عند: `تعيين مهمة / تعليق / طلب تعديل / اعتماد / اقتراب موعد / تأخر / اكتمال ZIP / جدولة / نشر` - تظهر داخل اللوحة + `Queues` لإرسال `البريد/Slack` لاحقاً.

## 6. التقنيات

- **Frontend:** `React 19 + Vite 8 + TypeScript + React Router 7` - `VITE_API_BASE_URL` (افتراضي `/api/v1` مع `proxy` لـ `8787`)
- **Backend:** `Hono + D1 (catalog) + R2 (media) + Queues (ZIP/validation) + Durable Objects (Family/Identity + اختياري لكل قصة لـ Presence)`
- **النشر:** `Cloudflare Pages` (`majarra-dashboard.pages.dev`) + `Workers` (`api.majarra.app`) - `wrangler pages deploy` و `wrangler deploy --env production`

## 7. ما يمكن التحكم به الآن

| المجال | التحكم |
|---|---|
| **المحتوى الكامل** | إنشاء/تعديل/أرشفة كواكب/سلاسل/حلقات/قصص/شخصيات/وسائط |
| **الفرق والأدوار** | إنشاء فرق بنطاق + منح 4 طبقات + صلاحية زمنية |
| **المراجعات** | `draft->review->approved->scheduled->published` + `audit_logs` |
| **المستخدمون** | عرض `family/child` من `DO` (قراءة فقط) |
| **الاشتراكات** | عرض `by_plan` و `billing_audit` (لا تعديل - Google Play هو المصدر) |
| **الإحصائيات** | `by_track` و `mastery` و `recent_events` (مجهولة) |

## 8. الناقص الوحيد

* **الأجهزة والتنزيلات:** لا واجهة إدارة أجهزة فعلية (موجود في `Sidebar` كـ `soon` - يحتاج `GET /admin/parents/:id/devices`)
* **المحرر المتزامن:** `Presence` وقفل الصفحة يحتاج `Durable Object` لكل قصة (مذكور في الخطة `13` لكنه `المرحلة الثالثة`)
