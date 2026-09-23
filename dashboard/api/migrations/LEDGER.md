# سجل ترحيلات D1 (`DB-101`)

> **هذا الملف مصدر حقيقة، لا توثيقًا مساعدًا.** يحرسه
> `test/migrations.test.mjs`: أي ملف يُضاف أو يُحذف أو **يُعاد تسميته** بلا تحديث
> الجدول أدناه يُفشل الجولة.

## القاعدة

**لا يُعاد ترقيم ترحيل مُطبَّق، ولا يُعاد تسميته، ولا يُحرَّر محتواه.** الإصلاح
بترحيل جديد.

### الاستثناء الوحيد المُعلَن: ترحيلٌ يمنع البناء من الأصل

إن كان الترحيل نفسه **يفشل** فيوقف السلسلة عنده، فلا ترحيلٌ لاحق يصلحه — لأن
اللاحق **لا يُشغَّل**. في هذه الحالة وحدها يُحرَّر الملف الفاشل، بشرطين:

1. التحرير **أصغر ما يُمكن** ويقتصر على إزالة سبب الفشل.
2. تُقارَب حالة البيئات التي طبّقته سابقًا **بترحيل جديد** — لأن التحرير لا يعمل
   فيها، فاسم الملف مسجَّل عندها كمُطبَّق ولن يُقرأ ثانيةً.

وقد استُخدم هذا الاستثناء **مرّة واحدة**: `DB-104` أدناه.

السبب ليس نظافةً: اسم الملف هو **مفتاح** جدول `d1_migrations`. فإعادة تسميته تجعل
الملف يبدو غير مُطبَّق، فيُطبَّق **ثانيةً** — والصفّ القديم يبقى في السجل يشير إلى
ملف لا وجود له.

## الحادثة التي أثبتت ذلك

قاعدة التطوير المحلية فيها **٩٢ صفًّا مقابل ٨٩ ملفًا**. الثلاثة الزائدة:

| صفّ في السجل | لا ملف له | صار اسمه |
|---|---|---|
| `0051_wave1_games.sql` | ✗ | `0054_wave1_games.sql` |
| `0052_wave2_depth.sql` | ✗ | `0055_wave2_depth.sql` |
| `0053_wave3_final.sql` | ✗ | `0056_wave3_final.sql` |

أي أن ثلاثة ترحيلات **رُقِّمت من جديد بعد تطبيقها**، فأُعيد تنفيذ محتواها بالأسماء
الجديدة. ونجا ذلك لأن بذورها `INSERT OR IGNORE`/`CREATE TABLE IF NOT EXISTS` —
**حظًّا لا تصميمًا**. ولو كانت `ALTER TABLE` أو `UPDATE` لكانت النتيجة عمودًا
مزدوجًا أو عدًّا مضاعفًا.

وهذا أيضًا تفسير «الفجوات» عند 0052 و0053 التي رُصدت في الأودت: ليست فجوات، بل
أرقام هُجرت في إعادة الترقيم.

## الأرقام المكرَّرة — مقبولة وموثَّقة

`wrangler` يرتّب بالاسم الكامل لا بالرقم، فرقمان متشابهان لا يكسران الترتيب.
ويبقى الالتباس بشريًّا: «0051» لا تعني ملفًا واحدًا في محادثة.

| الرقم | الملفان | السبب |
|---|---|---|
| 0018 | `0018_content_class_and_project_links.sql` · `0018_site_mode.sql` | فرعان تُطبَّق كلٌّ منهما بلا الآخر |
| 0051 | `0051_home_builder_resolved.sql` · `0051_identity_account_lifecycle.sql` | نفس السبب |
| 0081 | `0081_family_audit_logs.sql` · `0081_fix_wave4_truncated_packs.sql` | إصلاح بيانات عاجل بالتوازي مع ميزة |

**لا يُضاف رقم مكرَّر جديد.** والاختبار يمنعه: القائمة أعلاه مغلقة.

## الفجوات

| الرقم | السبب |
|---|---|
| 0020 | لم يُستخدم قطّ. رقم حُجز في فرع أُلغي قبل الدمج |
| 0052 · 0053 | هُجرا في إعادة الترقيم أعلاه — الملفان صارا 0055 و0056 |

## الصيغ الفرعية `0074b/c/d`

`0074_wave4_closure_36_games.sql` سلّم ثمانية عشر لعبة لا ستًّا وثلاثين، فتلاه
ثلاثة إصلاحات في نفس اليوم بحرف لاحق بدل أرقام جديدة. **صيغة لا تُتَّبع**: الحرف
لا يُرتَّب مع الأرقام بأي منطق مقروء، ويوحي بأن الملف الأصلي «نسخة أولى» بينما هو
مُطبَّق ولا يُعدَّل. الملفات الأربعة مُطبَّقة وتبقى بأسمائها.

## بناء نظيف من الصفر — **ينجح، ويحرسه CI** (`DB-104`)

مُتحقَّق منه (2026-08-28): قاعدة محلية فارغة + `wrangler d1 migrations apply`
تطبّق **٩٠ ملفًا من ٩٠**، ولا صفّ بلا ملف ولا ملف معلَّق.

وكان يتوقّف عند **`0074_wave4_closure_36_games.sql`** بـ
`FOREIGN KEY constraint failed: SQLITE_CONSTRAINT_FOREIGNKEY` — ٧١ مُطبَّقًا و١٨
معلَّقًا. أي أن مخطَّط الإنتاج **لم يكن يمكن إعادة إنتاجه من المستودع**، فلا بيئة
جديدة ولا مقارنة بيئتين.

### السبب

الملف يُدرج ترجمةً لـ`game-trace-color-advanced-3` **قبل** إدراج صفّ اللعبة نفسها
بثلاثة بيانات. و`INSERT OR IGNORE` **لا يبتلع مخالفة مفتاح أجنبي** (خيار
`ON CONFLICT` لا يشمل `FOREIGN KEY` في SQLite)، فالبيان يفشل ويسقط الملف كلّه.

والجدول الذي كان في هذا الموضع من السجل قال إن مفاتيح `game_localizations.game_id`
الثمانية عشر «كلّها مُدرَجة داخل الملف نفسه» — وهو صحيح، **وغير كافٍ**: المهم
موضعها لا وجودها. ذلك الفحص جرى على قاعدةٍ مكتملة كان الصفّ فيها موجودًا سلفًا،
فأجاب عن سؤال آخر. الدرس: فحص المفاتيح يُجرى على **الحالة عند البيان**، لا على
الحالة النهائية.

### ما جرى

1. `0074` عُدِّل: أُسقط صفّ الترجمة المُبكِّر (وحالته `draft` أصلًا)، فترجمة اللعبة
   النهائية بحالة `ready` هي البيان الأخير في الملف بعد إدراجها. أُسقط معه صفّان
   مكرَّران بلا أثر. **لا بيان جديد أُضيف، ولا قيمة تغيّرت.**
2. `0087_db104_trace_localization_convergence.sql` يقارب البيئات القائمة: الترجمة
   كانت مكتوبة مرّتين بقيمتين — `0074` بمفتاح `game.trace.word.amal` و`0074d`
   بمفتاح `game.trace.free` — وكلتاهما `INSERT OR IGNORE`، فالفائز **من يصل
   أوّلًا** لا من يكون صحيحًا. ولمّا كان `0074` يتوقّف، فازت قيمة `0074d` في كل
   بيئة قائمة، وتفوز قيمة `0074` في كل بناء نظيف بعد الإصلاح.

   والصحيح مُحدَّد لا مُختار: حزمة اللعبة (كما ثبّتها `0081_fix_wave4_truncated_packs.sql`)
   لها ثلاثة مستويات بمفاتيح `letter.alif` و`letter.baa` و`word.amal`. فـ
   `game.trace.free` مفتاحٌ **لا يطلبه أي مستوى** (منقول عن `game-shape-trace-3`)،
   ومفتاح المستوى الثالث **غائب** — أي نصّ مفقود يُعرَض للطفل في الإنتاج. فالتقريب
   إصلاح عطل، لا تسوية فرق بين بيئتين.
3. `0074d` **لم يُلمس**: تعديله لا يصلح بيئةً طبّقته، والقيمة الصحيحة تُثبَّت في
   `0087` بعده فتَغلِب في كل مسار.

### الحرس

مهمّة `migrations` في `.github/workflows/ci.yml`: العدّاء يبدأ بلا حالة، فالبناء
نظيف بحكم التعريف. ثم:

```powershell
node tools/ops/migration-ledger.mjs --local --require-applied
```

`--require-applied` هو ما يجعلها بوابة: تفشل إن بقي ملفٌ واحد معلَّقًا. والبوابة
تعمل حيث لا يعمل التوثيق: هذا الانهيار عاش شهورًا لأن كل بيئة قائمة بُنيت
تدريجيًّا، فلم يمرّ أحد على المسار من الصفر.

### التنصيف

```powershell
node tools/ops/migration-ledger.mjs --bisect <file>.sql
```

وأداة التنصيف نفسها كانت **تكذب** حين استُخدمت أوّل مرّة، بعطلَين أُصلحا:

* كل قطعة تبدأ بالتعليق الذي كان يعلو بيانها، وكانت القطع التي تبدأ بـ`--`
  **تُسقَط بكاملها** — فأعلنت «بيانًا واحدًا» في ملفٍ فيه تسعة. التعليقات تُقشَّر
  الآن سطرًا سطرًا ولا تُقصّ الكتلة معها.
* على Windows كان الاستعلام يُقتبَس يدويًّا ويُمرَّر عبر `cmd.exe`، فيتشوّه كل
  استعلامٍ فيه سطر جديد ويظهر الفشل **منسوبًا إلى بيان SQL سليم**. الاستعلام يُكتب
  الآن في ملف مؤقّت ويُمرَّر بـ`--file`، فلا يمرّ بصدفة.

## توثيق ما هو مُطبَّق على الإنتاج

فعلٌ للمالك، لأنه يحتاج بيانات اعتماد Cloudflare:

```powershell
cd dashboard/api
node tools/ops/migration-ledger.mjs --remote > migrations/APPLIED_PRODUCTION.md
```

تطبع الأداة: ما في السجل ولا ملف له، وما له ملف ولم يُطبَّق، والفرق مرتَّبًا.

## ترحيلتا الصوت `0088`/`0089` — أُعيد ترقيمهما قبل التطبيق، ومعهما تحفّظ مُعلَن

أُضيفتا في 2026-08-31 باسمَي `0082_games_voice_assets.sql` و
`0083_link_games_voice_manifest.sql`، **فتصادمتا في الرقم** مع
`0082_self_produced_rights.sql` و`0083_offline_licensing.sql` القائمتين. وأُعيد
ترقيمهما إلى `0088`/`0089` — وهذا **لا ينقض** قاعدة «لا يُعاد ترقيم ترحيل
مُطبَّق» أعلاه، لأنهما كانتا غير مُطبَّقتين: `d1_migrations` المحلي لا يحملهما
(آخر ما فيه `0087`)، ولم تكونا في هذا السجل. والترتيب النسبي محفوظ: `0089`
يربط `voice_manifest` بالأصول التي يُدرجها `0088`.

**تحفّظ يجب أن يُقرأ قبل التطبيق:** النصوص العربية في `0088` (`title_ar`)
**مُشوَّهة الترميز** (mojibake مزدوج: `Ø§Ù„ØµÙˆØª` بدل «الصوت»)، فتطبيقه الآن
يكتب عناوين معطوبة لـ150 صفّ أصل. والمولِّد `tools/gen_0082.py` يكتب بـ`utf-8`
صحيحًا، أي أن العطل **في مصدره** (الـmanifest الذي يقرأه). ولم أُصلح النصوص
بالتخمين: جرّبتُ فكّ الترميز فأنتج 1097 محرف إبدال — أي أن السلسلة ليست
UTF-8-كـLatin-1 بسيطة. الصحيح **إعادة توليد الملف** بعد إصلاح مصدره، لا ترقيعه.

## `0092` وتسجيل المحتوى من خارج السجلّ — `DATA-201`

إنتاج الفيديو في 2026-09-03 سجّل وسائطه في الإنتاج **بأربعة ملفات SQL شُغِّلت
بيدٍ** من `tools/ops/`، وكلّها كانت **غير متتبَّعة في git**:

| الملف | ما يكتبه |
|---|---|
| `thumbs-register.sql` | 33 أصل مصغَّرة في `content_assets` |
| `link-episodes.sql` | 66 رابطًا في `asset_links` (33 `stream` + 33 `thumbnail`) |
| `update-sizes.sql` | 33 تحديث `size_bytes` |
| `mark-33-episodes-english.sql` | وسم لغة الروابط + مسارات صوت إنجليزية |

وهذا ينقض بالضبط ما وُجد هذا السجلّ من أجله: القدرة على إعادة بناء الإنتاج من
المستودع. فكل تشغيلٍ لأحدها يُحدث فرقًا بين القاعدتين لا يسجّله شيء.

جُمِّعت الأربعة في `0092_register_first_episode_media.sql` — **مُولَّدًا من الملفات
نفسها لا منقولًا بيدٍ**، لأن 134 عبارة لا تُنقل بثقة. والملفات الأصلية تبقى في
`tools/ops/` كسجلٍّ لما شُغِّل، ولا تُشغَّل بعد اليوم.

### الفجوة التي لا يُغلقها `0092`، وهي أهمّ ما في البند

**لا شيء في المستودع كلّه يُنشئ صفوف أصول الفيديو `ca-episode-*-1080p` ولا صفوف
`episode_renditions`.** مقيسٌ بمسحة على `tools/` و`migrations/` معًا: الإشارة
الوحيدة إلى `episode_renditions` هي **قراءة** في
`mark-33-episodes-english.sql:31`.

أي أن 33 صفَّ أصلٍ في الإنتاج **أصلُها غير قابل للتوليد من المستودع**. وهذا هو
الضرر الحقيقي في `DATA-201` لا عَرَضه، ولم أختلق لها `r2_key` ولا `mime_type` ولا
حجمًا: بياناتٌ مُختلَقة في ترحيل أسوأ من فجوةٍ مُعلَنة.

**ما يلزم لإغلاقها:** تصدير الصفوف الـ33 من الإنتاج (`wrangler d1 execute --remote`
بـ`SELECT`) وكتابتها ترحيلًا — وهو **فعل مالك** لأنه يحتاج بيانات اعتماد
Cloudflare، كما في «توثيق ما هو مُطبَّق على الإنتاج» أعلاه.

### لماذا `0092` آمن على قاعدةٍ بُنيت من الصفر

كل عبارةٍ فيه إمّا `INSERT OR IGNORE`، أو `UPDATE ... WHERE` (تمسّ ما يوجد)، أو
`INSERT ... SELECT ... WHERE EXISTS(episode) AND EXISTS(asset)`. فالـ33 رابط
`stream` تصير **لا-عملية** حين لا أصول فيديو، بدل انتهاك مفتاح أجنبي يوقف
`migrate:local` كما أوقفه `0074` من قبل (`DB-104`).

**والمقيس على القاعدة المحلية** (التي فيها الحلقات الـ33 ولا أصول فيديو):

| | قبل | بعد | التوقّع |
|---|---:|---:|---|
| `content_assets` | 307 | **340** | +33 مصغَّرة |
| `asset_links` | 88 | **121** | +33 رابط مصغَّرة **فقط** |
| روابط `stream` لأصول 1080p | 0 | **0** | الحراسة صمدت |
| أصول `kind='video'` | 0 | **0** | لا شيء اختُلق |
| `episode_audio_tracks` | 0 | **0** | لا renditions تُقرأ منها |

وأُعيد تشغيله على نفس القاعدة: **134 عبارة نجحت وصفر صفٍّ تغيّر** — 340 و121 كما
هما. أي أن الإعادة آمنة فعلًا لا دعوى.

### ما يمنع عودة النمط

`tools/ci/content-sql-outside-migrations.mjs`، موصولةٌ في `ci.yml`: تفشل على أي
ملف `.sql` في المستودع خارج `migrations/` يكتب في جدول كتالوج. والملفات الأربعة
أعلاه في قائمةٍ **مُجمَّدة** — تبقى كسجلٍّ لما شُغِّل، وملفٌ جديد لا يُضاف إليها بل
يُضاف ترحيلًا.

وهي مجذَّرة في **جذر المستودع** لا في `dashboard/api`: أوّل نسخةٍ منها كانت اختبارًا
في هذه الحزمة فلم تر `tools/ops/` إطلاقًا — أي أنها كانت تحرس كل شيء إلا الملفات
التي أوقعت العطل.

وتفشل أيضًا على أي قاعدة `.gitignore` تُخفي ملف `.sql`، فلا مخرج من المِسحة
بالإخفاء. والقواعد الثلاث القائمة مُجمَّدة بأسمائها، وهي:

### ثلاثة ملفات تحميل أسبق، حالتها على الإنتاج غير معروفة

| الملف | ما يكتبه |
|---|---|
| `dashboard/api/_audit_apply.sql` (381 ك.ب، 2026-08-07) | `asset_links` · `content_assets` · `episodes` · `learning_objectives` · `seasons` · `series` — ويُلغي نشر حلقةٍ وسلسلةٍ ويكتب في `audit_logs` |
| `dashboard/api/_completion_load.sql` (495 ك.ب، 2026-08-08) | `books` · `episodes` · `games` · `learning_objectives` · `story_pages` · `story_page_localizations` |
| `dashboard/api/_slate_load.sql` (710 ك.ب، 2026-08-08) | ما سبق + `series` · `seasons` · `stories` |

مُولَّدة بـ`scripts/_audit_gen_sql.mjs` ومُتجاهَلة في `.gitignore`. وهي **نفس نمط
`DATA-201`** بتاريخٍ أسبق شهرًا، و**لا شيء في المستودع يُثبت هل شُغِّلت على الإنتاج
أم على قاعدةٍ محلية**. لم تُحذف: ملفٌ غير متتبَّع لا يُستعاد بـgit. ومن يعرف الجواب
يُسجّله هنا، أو يحوّل ما شُغِّل إلى ترحيل كما صار `0092`.

## `0093` والحدّ اليومي الذي لم يطلبه أحد — `DECIDE-108`

**قرار المالك (2026-09-23):** ضوابط الوقت ووقت النوم **لا تُفرَض إلا بتفعيلٍ من
ولي الأمر**. وهذا يُغلق `DECIDE-108` ويُصحّح سلوكًا قائمًا.

**ما كان يجري:** `child_settings.daily_minutes` كان
`NOT NULL DEFAULT 30 CHECK (BETWEEN 5 AND 180)` — ثلاثة قيود تجعل «لا حدّ» غير
قابل للتمثيل. والصفّ يُنشأ من **مجرّد فتح شاشة الإعدادات**
(`GET /child-settings/:childId` يُدرجه إن لم يجده). ومخطَّط `PUT` كان يقبل 5–180
ولا يقبل `null`، والشريط في `parent_dashboard_page.dart` يبدأ من 5. فكان كل طفل
يخرج بحدٍّ 30 دقيقة/يوم **لم يطلبه أحد ولا يمكن إلغاؤه** — مفروضًا على الفيديو
فعلًا في `startPlayback` و`heartbeatPlayback`.

**ما تغيّر:** العمود صار `INTEGER CHECK (daily_minutes IS NULL OR ... BETWEEN
5 AND 180)` بلا `NOT NULL` وبلا `DEFAULT` — نفس شكل `max_session_minutes`
المجاور. و`loadScreenTimePolicy` توقّفت عن استبدال 30 مكان الغياب،
و`PUT` صار يقبل `null`، وشاشة ولي الأمر صار لها مفتاح تفعيل صريح.

**الصفوف القائمة تُنقل بقيمها.** صفٌّ يحمل 30 لا يُفرَّق في البيانات عن صفٍّ
اختار ولي أمره 30، و`updated_at` مكتوبٌ في الحالتين. فتصفير كل 30 كان سيرفع حدًّا
اختاره أبٌ فعلًا.

**وفجوة مُعلَنة:** `child_settings` **صفر صفًّا** محليًّا (و`parents` و
`child_projection` صفر — المنصّة قبل الإطلاق). وعلى **الإنتاج لم يُقَس**: يحتاج
`wrangler d1 execute --remote`، وهو فعل مالك. فإن وُجدت هناك صفوفٌ بالافتراض 30
فهي تبقى محدودة حتى يغيّرها ولي أمرها. والاستعلام الذي يحسم ذلك:

```sql
SELECT COUNT(*) AS rows_at_default_30 FROM child_settings WHERE daily_minutes = 30;
```

## الملفات (96)

آخر تحديث: 2026-09-23 · `DATA-201` و`DECIDE-108`.

<!-- MIGRATION-LIST:BEGIN — يُحدَّث بـ`node tools/ops/migration-ledger.mjs --list` -->
0001_init.sql
0002_content_cms.sql
0003_launch_content.sql
0004_asset_link_books.sql
0005_library_game_project_lifecycle.sql
0006_parent_auth_entitlements.sql
0007_refresh_token_reuse.sql
0008_family_projections_billing_audit.sql
0009_projection_watermarks.sql
0010_cleanup_dead_d1_tables.sql
0011_islamic_review.sql
0012_qisas_slate.sql
0013_qisas_pages.sql
0014_teams_roles_permissions.sql
0015_app_experience.sql
0016_app_experience_advanced.sql
0017_partnerships_settings.sql
0018_content_class_and_project_links.sql
0018_site_mode.sql
0019_admin_auth.sql
0021_dlq_family_events.sql
0022_drawing_skills_and_objective_skills.sql
0023_trace_color_runtime_packs.sql
0024_game_localizations.sql
0025_child_creations_consent.sql
0026_trace_color_launch_packs.sql
0027_cross_planet_drawing.sql
0028_dev_drawing_fixture.sql
0029_content_availability.sql
0030_workflow_engine.sql
0031_support_crm.sql
0032_production_requirements.sql
0033_website_cms.sql
0034_blog_cms.sql
0035_content_reviews_story.sql
0036_question_bank.sql
0037_translation_center.sql
0038_commerce_pricing_costs.sql
0039_campaigns_partnership_enhancements.sql
0040_ops_reliability.sql
0041_drawing_production_packs.sql
0042_drawing_assets_ready.sql
0043_coloring_40_library.sql
0044_reference_activities.sql
0045_creative_reviews.sql
0046_reference_localization.sql
0047_episode_streaming_contract.sql
0048_episode_renditions_manifest.sql
0049_parental_controls_phase2.sql
0050_analytics_notifications_phase3.sql
0051_home_builder_resolved.sql
0051_identity_account_lifecycle.sql
0054_wave1_games.sql
0055_wave2_depth.sql
0056_wave3_final.sql
0057_content_factory.sql
0058_story_page_dwell.sql
0059_story_page_dwell_backfill.sql
0060_story_page_dwell_recompute.sql
0061_creative_registry_hardening.sql
0062_publish_drawing_packs.sql
0063_ai_provider_registry.sql
0064_ai_provider_meta_model_api.sql
0065_creative_studio_drawings.sql
0066_draw_like_me_hero.sql
0067_draw_like_me_50.sql
0068_remove_duplicate_planets_home_block.sql
0069_complete_drawing_50.sql
0070_google_play_price_drafts.sql
0071_fix_complete_drawing_r2_prefix.sql
0072_connect_dots_seed.sql
0073_trace_learning_svg_seed.sql
0074_wave4_closure_36_games.sql
0074b_wave4_fix.sql
0074c_wave4_games.sql
0074d_final6_games.sql
0075_billing_payment_methods.sql
0076_billing_controls_hardening.sql
0077_schools_b2b.sql
0078_refunds_billing.sql
0079_billing_permission.sql
0080_learning_objectives_catalog_72.sql
0081_family_audit_logs.sql
0081_fix_wave4_truncated_packs.sql
0082_self_produced_rights.sql
0083_offline_licensing.sql
0084_ops_alert_delivery.sql
0085_drop_plan_limits_table.sql
0086_child_progress_projection.sql
0087_db104_trace_localization_convergence.sql
0088_games_voice_assets.sql
0089_link_games_voice_manifest.sql
0090_drop_dead_child_profile_fks.sql
0091_drop_dead_parents_fks.sql
0092_register_first_episode_media.sql
0093_daily_limit_opt_in.sql
<!-- MIGRATION-LIST:END -->

## ما حُذف

`migrations/catalog/0001_catalog_init.sql` — حُذف في الدفعة 26.

كان **خارج** `migrations_dir` المُعلَن في `wrangler.jsonc`، فلا `wrangler d1
migrations apply` يطبّقه ولا أي سكربت ينادِيه — بحثتُ في المستودع كلّه فلا مرجع
له. ومع ذلك كان يُعلن `series` و`episodes` بأربعة أعمدة لكلٍّ منهما، مقابل
التعريفين الحقيقيين في `0001_init.sql` بثلاثين عمودًا وأكثر.

أي أنه **مخطَّط ثانٍ متناقض ينتظر من يطبّقه بالخطأ**. وسكتشُ «قاعدة كاتالوج للقراءة
فقط» الذي كُتب لأجله لا وجود له في البنية.
