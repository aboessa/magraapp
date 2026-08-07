# 01 — التعدد اللغوي والعالمية

## المشكلة في المخطط الحالي

`games.title_ar` و`games.instructions_ar` و`game_engines.name_ar` — مخطط أحادي اللغة يمنع الإطلاق العالمي.

## القرار

نتبع نمط `story_page_localizations` الموجود فعلًا في قاعدة البيانات. **ممنوع** إضافة أعمدة `_en` أو `_fr`.

```sql
CREATE TABLE game_localizations (
  game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  language TEXT NOT NULL,                       -- BCP 47: ar, en, fr, ur, id, tr
  title TEXT NOT NULL,
  instructions TEXT,
  content_pack TEXT NOT NULL DEFAULT '{}',      -- الحزمة المترجمة أو المؤلفة
  voice_manifest TEXT NOT NULL DEFAULT '{}',    -- مفتاح صوتي -> asset id
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','review','published')),
  translated_from TEXT,                          -- NULL إن كانت تأليفًا أصليًا
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (game_id, language)
);

CREATE INDEX idx_game_localizations_lang_status
  ON game_localizations(language, status);
```

`title_ar` و`instructions_ar` تبقى للتوافق فقط، ويُقرأ منهما عند غياب صف `ar`.

## تصنيف المحركات لغويًا — أهم قرار في هذا المستند

| الفئة | المحركات | السلوك |
|---|---|---|
| **مستقل عن اللغة** `language_neutral` | `memory_flip`, `rhythm_tap`, `logic_pattern`, `block_code`, `sim_lab` | حزمة واحدة للعالم؛ يُترجم الصوت والتعليمة فقط |
| **قابل للترجمة** `translatable` | `match_pairs`, `sort_bins`, `count_quantity`, `sequence_order`, `timeline_map` | نفس الحزمة، تُترجم التسميات والصوت |
| **يحتاج تأليفًا مستقلًا** `language_specific` | `word_build`, `trace_color` (نمط الحروف) | **لا يُترجم — يُؤلَّف من جديد لكل لغة** |

### لماذا لا تُترجم `language_specific`

«تتبّع حرف أ» **ليس ترجمة** لـ`trace letter A`. الفروق جوهرية:

| البُعد | العربية | الإنجليزية |
|---|---|---|
| عدد الحروف | 28 | 26 |
| اتجاه الكتابة | من اليمين | من اليسار |
| أشكال الحرف | 4 أشكال حسب موضعه | شكلان (كبير/صغير) |
| الاتصال | الحروف تتصل | منفصلة |
| ترتيب الرسم | الجسم ثم النقاط | يختلف كليًا |

الترجمة الآلية هنا تنتج لعبة **خاطئة تعليميًا**. لذلك:

```text
"localization": "language_neutral" | "translatable" | "language_specific"
```

وCMS **يرفض** نشر حزمة `language_specific` إذا كان `translated_from` غير فارغ.

## قواعد RTL والاتجاه

| العنصر | يُعكس في RTL؟ | السبب |
|---|---|---|
| أسهم التنقل والرجوع | ✅ نعم | اتجاهية دلاليًا |
| شريط `sequence_order` | ✅ نعم | يتبع اتجاه القراءة |
| سلات `sort_bins` | ✅ نعم | تخطيط عادي |
| خط الزمن في `timeline_map` | ✅ نعم | يتبع اتجاه القراءة |
| مسار النوتات في `rhythm_tap` | ❌ **لا** | تدفق زمني لا نصي |
| شبكة `block_code` | ❌ **لا** | الاتجاهات منطق لعبة |
| الخريطة الجغرافية | ❌ **لا** أبدًا | الجغرافيا ثابتة |
| أزرار تشغيل الصوت | ❌ لا | رمز إعلامي عالمي |
| شعار مجرة | ❌ لا | علامة تجارية |
| اتجاه كتابة الحرف في `trace_color` | ❌ لا | من بيانات الحرف لا الواجهة |

### قواعد تنفيذية

- التخطيط يستخدم `start`/`end` لا `left`/`right`.
- `Directionality` فوق كل شاشة لعبة.
- ترتيب تنقل التركيز (focus traversal) منطقي في الاتجاهين.
- اختبار النص المختلط: عربي + لاتيني + أرقام + علامات ترقيم.

## الأرقام والتقويم

- `count_quantity` يعرض الأرقام حسب المنطقة (`٣` أو `3`) ويخزّن **القيمة العددية** فقط.
- `timeline_map` يخزّن التاريخ **ميلاديًا دائمًا**، ويعرض هجريًا أو ميلاديًا حسب اللغة.
- **لا تُخزَّن قيمة معروضة مترجمة كبيانات دائمة أبدًا.**
- المدد والأزمنة تُخزَّن بالمللي ثانية وتُنسَّق للعرض فقط.

## اللغات والموجات

| الموجة | اللغات | ملاحظة |
|---|---|---|
| الإطلاق | `ar` | فصحى مبسطة |
| الموجة 2 | `en`, `fr` | تسويق دولي |
| الموجة 3 | `ur`, `id`, `tr` | أكبر جماهير مسلمة غير عربية |

- اللغة تتبع **ملف الطفل** لا نظام الجهاز، لأن الأسرة قد تُعلّم لغة ثانية لطفل واحد.
- `fallback` صريح: لغة الطفل ← `ar` ← `en`.
- «غير مترجم» ≠ «غير منشور» — الحزمة غير المنشورة لا تظهر مطلقًا، ولو كانت مترجمة.
- محتوى الـAPI يُعامل كبيانات غير موثوقة ويُتحقق منه قبل العرض.

## إعداد Flutter الناقص حاليًا

`app_main` يحتوي `flutter_localizations` فقط. الناقص:

| # | المهمة |
|---:|---|
| 1 | `intl` في `pubspec.yaml` + `flutter: generate: true` |
| 2 | `l10n.yaml` مع تحديد اللغة الأساس **صراحة** لا بترتيب الملفات |
| 3 | `.arb` لكل لغة بمفاتيح **دلالية**: `game_feedback_correct` لا `"أحسنت!"` |
| 4 | تحقق CI: تطابق المفاتيح والـplaceholders وقواعد الجمع بين كل اللغات |
| 5 | اختبار خط عربي حقيقي مع `TextScaler` حتى 2.0× وتغطية الحروف |
| 6 | التحقق من ترخيص إعادة توزيع أي خط مضمّن |

### مثال `l10n.yaml`

```yaml
arb-dir: lib/l10n
template-arb-file: app_ar.arb
output-localization-file: app_localizations.dart
output-class: AppLocalizations
preferred-supported-locales: [ar]
nullable-getter: false
```

### قاعدة تسمية المفاتيح

```
game_<engine>_<context>
game_common_<context>
```

أمثلة: `game_common_hint`, `game_common_try_again`, `game_match_pairs_instruction_relation`.

## التحقق

1. كل لغة مُعدّة تُحلَّل بنجاح.
2. المفاتيح والـplaceholders تطابق العقد الأساس.
3. حالات الجمع تغطي قواعد اللغة.
4. سلوك النقص والـfallback ظاهر ومقصود.
5. العربي والنص المختلط يُعرضان صحيحًا عند التكبير.
6. التواريخ والأرقام والمدد تطابق توقع اللغة.
7. ترتيب قارئ الشاشة وتنقل D-pad منطقي في RTL.
