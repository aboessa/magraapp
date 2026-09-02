# خطة الألعاب الكاملة — مجرة — حالة التنفيذ وما ناقص (36 لعبة)

> هذا الملف هو المرجع الوحيد المجمع للألعاب الـ12 × 3 حزم = 36 لعبة: كل محرك، ماذا تم، ماذا ناقص، وكيف تولّد النواقص عبر PlayVeo + Google AI Studio.
> تاريخ التحديث: 2026-08-22 — Wave 4 closure (18→36)
> مصدر الحقيقة: `app_main/lib/features/games/engine/` + `dashboard/api/src/routes/games.ts` + `migrations/0054-0074`
> APIs: PlayVeo image عبر `tools/playveo/wave-production.mjs` + Wave4 `generate_wave4_assets.mjs`، صوت عربي عبر `tools/tts/games/*.json` + `generate_game_voices.mjs`

## القرار المعماري

مجرة **لا تبني ألعاب منفصلة**. تبني **12 محرك لعب** + حزم محتوى في `games.content_pack`.

- 12 محرك × 3 حزم عند الإطلاق = 36 لعبة، بلا إصدار متجر لإضافة لعبة جديدة (صف في CMS).
- كل محرك: `engine_id` → تنفيذ Flutter في `GameEngineRegistry`.
- المحتوى: `pack_version`, `engine_version`, `supports_dpad`, `levels[]`, `voice_manifest`, `assets`.

### الأساس المشترك — ✅ مكتمل

| # | البند | الملف | الحالة |
|---|-------|-------|--------|
| 1 | `game_localizations` + فهارس ar/en/fr | `0024_game_localizations.sql` | ✅ |
| 2 | تحقق Schema 12 محرك | `lib/jsonSchema.ts` + `gamePackValidation.ts` + `gamePackGate.ts` + `schemas/*.v1.schema.json` (13 ملف) | ✅ |
| 3 | `GET /api/v1/games/:id` بلغة الطفل + fallback صريح | `dashboard/api/src/routes/games.ts` | ✅ منشور فقط، قدرة قصيرة R2، `contentClassPredicate` |
| 4 | تسليم أصول بـ capability | `createMediaToken` | ✅ |
| 5 | `intl` + `l10n.yaml` | `app_main/l10n/` | ✅ |
| 6 | `GameEngineRegistry` آمن لمحرك غير معروف | `engine/game_engine_registry.dart` | ✅ 12 محرك مسجل |
| 7 | طبقة صوت | `game_services.dart: SilentGameAudioService` | ⚠️ الواجهة ✅ لكن التنفيذ صامت — لا صوت مسجل |
| 8 | طبقة تشجيع | `FeedbackService` | ✅ |
| 9 | سلّم مساعدة `تلميح→تبسيط→حل` | `HelpLadder` + `helpLevelForStalls` | ✅ |
| 10 | إرسال `attempts` بـ `event_id` ثابت | `AttemptReporter` + `game_providers.dart` → `POST /family/progress` | ✅ idempotent |
| 11 | إمكانية وصول | `simplified_motor`, `sequential_tap_alternative`, `reduceMotion`, `effectiveTouchTarget`, `playableOnTelevision()` | ✅ |

### البنية العامة

```
Flutter:
  game_route.dart (/game/:gameId) → game_providers.dart → GameScreen
  GameScreen: buildDefaultRegistry() = 12 engine + evaluateAvailability() → engine.build(context, controller)
  GameSessionController: levelIndex, phase (drawing/coloring/finished), TraceSession, regionColors undo/redo 50, initialCreationJson, reportEngineAttempt()
  Backend:
  games.ts: published فقط، FamilyDO auth، age check، language localizePack()، asset tokens
  adminGames.ts: packAssets, voiceKeys, publishReadiness
  Migrations: 0054 Wave1 9 ألعاب، 0055 Wave2 6 ألعاب، 0056 Wave3 3 ألعاب = 18 منشورة (هدف 36)
```

---

## المحركات الـ12 — التفصيل

### 1) `match_pairs` — مطابقة — براعم 3-5

| البند | التفصيل |
|-------|---------|
| الملف | `wave_one_engines.dart: MatchPairsEngine` — 646 سطر مشترك مع `sort_bins`/`memory_flip` |
| الفكرة | اسحب/اضغط العنصر إلى مثيله أو ما يرتبط به |
| `supportsDpad` | true |
| التنفيذ الحالي | tap-to-select → tap target، `_placed`, `_firstTry` score أول محاولة، `seededShuffle(gameId+levelIndex)`، `distractors` لا هدف لها ترجع، يدعم `identical/shadow/relation/sound_image/part_whole` عبر schema |
| الاختبارات | `wave_one_engines_test.dart` ✅ registry، D-pad، board من pack مش emoji |
| حزم منشورة | `game-wave1-picture-match`: مستوى 1، targets=2، يدعم لغة واحدة ar |
| ماذا تم | ✅ محرك كامل، scoring، خلط، سلوك بلا فشل، `BoardScaffold`, `ChoiceTile` |
| ماذا ناقص | 🔴 أصول حقيقية — يعرض `asset-id` نصًا (`asset-color-cat`...), 🔴 صوت `vo.*` غير مسجل، ⚠️ مستوى واحد فقط (المخطط 5 مستويات متدرجة)، ⚠️ `sound_image` mode يحتاج تشغيل صوت، ⚠️ glow المساعدة بصريًا غير مصقول |

---

### 2) `trace_color` — تتبع وتلوين — براعم 3-5 — **مكتمل كمحرك خارج الموجات**

| البند | التفصيل |
|-------|---------|
| الملفات | `trace_color_engine.dart` 699 + `trace_geometry.dart` 287 + `trace_session.dart` 350 + `coloring_board.dart` + `coloring_regions.dart` + `free_draw_surface.dart` 1033 |
| الفكرة | اتبع المسار بإصبعك ثم لوّن، أوّليّ: تتبع، ثانوي: تلوين/توصيل/رسم حر/إكمال رسمة |
| `supportsDpad` | false — يختفي من TV — صحيح |
| التنفيذ الحالي | `TraceColorSurface` Stateful live points، `activePointer` guard، `DrawingMode` 12 قيمة (line/curve/shape/number/letter/path/connectDots/coloring/freeDraw/copyPattern/completeDrawing/drawFromPrompt/unknown)، `ColoringConfig` بـ `structuredRegions` polygon، `hitRegionAt()` لا تخمن منطقة أبدًا، `connect_dots` tap أقرب dot بنصف touchTarget، undo/redo 50 عبر `_fillUndo`, `_fillRedo`, `CreationDocument` حفظ PNG boundaries + JSON قابل للتعديل والمتابعة `initialCreationJson`, `SCORING_BY_MODE` يمنع scoring للتلوين والرسم الحر |
| الاختبارات | `trace_geometry_test`, `trace_session_test`, `coloring_board_test`, `game_screen_test` ✅ |
| حزم منشورة | `game-letter-tracing` + حزم act-s1 عبر migrations قديمة |
| ماذا تم | ✅ أكثر محرك نضجًا — رسم دقيق، تلوين مناطقي، حفظ إبداعات الطفل محليًا + `creationDocument`, `simplified_motor` tolerance أوسع, `reduceMotion` |
| ماذا ناقص | 🔴 مسارات SVG حقيقية لكل حرف/شكل (حاليًا دائرة واحدة اختبارية)، 🔴 `template_asset` قوالب تلوين حقيقية، 🔴 `voice_manifest` لكل مستوى (توجيه، تشجيع)، ⚠️ `reduced_motion` animations مقصرة لكن ما زالت موجودة، ⚠️ مستويات 5 مفصلة بالصعوبة لم تؤلف بعد |

---

### 3) `sort_bins` — تصنيف — براعم 3-5

| البند | التفصيل |
|-------|---------|
| الملف | `wave_one_engines.dart: SortBinsEngine` |
| الفكرة | ضع كل عنصر في سلته حسب خصيصة (لون/شكل/فئة) |
| `supportsDpad` | true |
| التنفيذ الحالي | `_selected` + `_sorted` map، `firstTry` vs `retried`، bins مميزة بـ image+text+audio وليس لون فقط (عقدة لضعاف تمييز الألوان)، `ChoiceTile` elimination في rung 2 |
| حزم منشورة | `game-wave1-color-sort`: معيار `criterion.colour`, bins=2, items=4 |
| ماذا تم | ✅ منطق كامل + scoring |
| ماذا ناقص | 🔴 أصول صور `asset-color-apple/fish/rocket/tree` placeholder، 🔴 لا سحب حقيقي drag (tap fallback فقط)، ⚠️ مستوى 1 فقط، spec يحتاج 3-4 items + خاصيتين للمستكشفين وقاعدة مجردة للروّاد، 🔴 أصوات وصف السلال |

---

### 4) `memory_flip` — ذاكرة — براعم 3-5 — **ترفيه أولاً**

| البند | التفصيل |
|-------|---------|
| الملف | `wave_one_engines.dart: MemoryFlipEngine` |
| الفكرة | اقلب البطاقات وابحث عن الأزواج — ترفيه خالص |
| `supportsDpad` | true |
| التنفيذ الحالي | خلط بـ `seededShuffle(gameId.hashCode+levelIndex)`، `grid [2,4]`، `flip_back_delay_ms` 1400 قابل للتأليف، `_matched/_revealed`، ترفيه أولاً يرسل `score 0 max 0 answers [pairs, misses]` بلا mastery (صحيح حسب `05-mastery.md`)، لا failure state، `Icons.question_mark` للمقلوب |
| الحزم | `game-wave1-memory-animals`: 4 أزواج حيوانات |
| ماذا تم | ✅ تحول من صفحة هاردكود `_pairsPerLevel = [3,4,6,8]` emoji إلى pack-driven، ✅ لا كتابة mastery (موثق)، ✅ اختبار السلوك |
| ماذا ناقص | 🔴 صور حقيقية — يعرض id نصًا، 🔴 أصوات `pair.cat`، ⚠️ مستوى واحد فقط (المخطط 3→8 أزواج)، ⚠️ 1 لعبة فقط من هذا المحرك رغم هدف 3 |

---

### 5) `count_quantity` — عد وكميات — مستكشفون 6-8

| البند | التفصيل |
|-------|---------|
| الملف | `wave_two_engines.dart: CountQuantityEngine` — جزء من 1090 سطر |
| الفكرة | عدّ، قارن، أكمل النمط العددي |
| `supportsDpad` | true |
| Modes | `count_and_pick`, `drag_amount`, `compare_sets`, `pattern_fill` — كلها منفذة |
| التنفيذ الحالي | ناضج بيداغوجيًا: `numeral_system` presentation فقط `formatNumeral()` عربي/لاتيني، `countAloudOnError` يعد بصوت مع تلوين `countingHighlight` العنصر الحالي، زر `أعد العدّ` ظاهر دائمًا (وثيقة إمكانية وصول)، rung: recount → eliminate wrong options → `_countReduction=1` board أسهل → answerShown، `drag_amount` tap-to-box أساسي مش fallback (يد طفل صغير أدق بالضغط من السحب) |
| الحزم | `game-wave1-count-place`: range 1-5، options 3 |
| ماذا تم | ✅ كل الأنماط الأربعة، help ladder تعليمي، numeral system، recount دائم |
| ماذا ناقص | 🔴 مقاطع صوتية `vo.count.1…20`, `vo.recount`، 🔴 صور النجوم `Icons.star_outline` placeholder، ⚠️ range 1-5 فقط (spec حتى 20)، ⚠️ مستوى واحد، ⚠️ pack يحتاج modalities متعددة |

---

### 6) `sequence_order` — ترتيب تسلسل — مستكشفون 6-8

| البند | التفصيل |
|-------|---------|
| الملف | `wave_one_engines.dart: SequenceOrderEngine` (400+ سطر) |
| الفكرة | رتب الأحداث أو الخطوات |
| `supportsDpad` | true |
| التنفيذ الحالي | `accepted_orders` قائمة حلول صحيحة متعددة، RTL: strip reversed للعربية + `_isRtl` من `Directionality`، زر تراجع، mastery 1/1، scoring أول محاولة، drag_order مع tap fallback |
| الحزم | `game-wave1-sequence-kids`: `process`، 3 panels، order واحد |
| ماذا تم | ✅ منطق ترتيب + RTL/LTR + حلول متعددة |
| ماذا ناقص | 🔴 صور panels `cat/tree/apple` placeholder، 🔴 مستويات قصة أعمق (دورة حياة، يوم…إلخ)، ⚠️ 1 acceptance order فقط، ⚠️ صوت شرح |

---

### 7) `word_build` — بناء الكلمة — مستكشفون 6-8 — `language_specific`

| البند | التفصيل |
|-------|---------|
| الملف | `wave_two_engines.dart: WordBuildEngine` |
| الفكرة | كوّن الكلمة من حروفها — وعي صوتي وإملاء |
| `supportsDpad` | true |
| `languageClass` | `language_specific` — لا يترجم، يؤلف من جديد لكل لغة |
| التنفيذ الحالي | متقدم لغويًا: `arabicFormGlyph` مع ZWJ للأشكال أول/وسط/آخر («بـ/ـبـ/ـب»)، tray خلط seeded + distractors، `slots` بعدد حروف الكلمة، `writing_direction rtl`، help ladder يخفي distractors، يلمّع slot، `showWordText`، `ChoiceTile` glyph بدون نص مطبوع، موثق `translated_from=NULL` must |
| الحزم | `game-wave1-word-kids`: `بيت` 3 أحرف، letters 4 |
| ماذا تم | ✅ الأشكال العربية + ZWJ + RTL + distractors |
| ماذا ناقص | 🔴 صوت حروف `word_audio`, `word_syllables_audio` (إلزامي في 03-voice)، 🔴 مراجعة لغوية `linguistic_review`، 🔴 200+ كلمة 3-5 حروف لكل مسار، ⚠️ pack واحدة فقط (بيت)، 🔴 EN/FR packs منفصلة لاتينية |

---

### 8) `rhythm_tap` — إيقاع ونغمة — مستكشفون 6-8 — **ترفيه أولاً**

| البند | التفصيل |
|-------|---------|
| الملف | `rhythm_tap_engine.dart` 372 سطر |
| الفكرة | المس على الإيقاع |
| `supportsDpad` | true — زر لكل lane |
| التنفيذ الحالي | بلا فشل أبدًا «لا يوجد فشل. الأنشودة تكمل حتى النهاية» — المسار يلعب حتى النهاية ونتيجة إيجابية دائمًا، `Ticker` elapsed، `_notes` sorted by time_ms، نبض بصري إلزامي لإمكانية الوصول (قابل للعب بدون سمع)، وميض <3Hz محدد، collapse lanes بعد 16 miss، توسيع نافذة ×1.4 بعد 8 miss، `simplified_motor` floor 500ms، entertainment-first بلا mastery (objective فارغ في D1 + `writesMastery=false` في `engineContracts.ts`) |
| الحزم | `game-wave2-rhythm` (3 نوتات) |
| ماذا تم | ✅ لا فشل، ticker، visual pulse، window widening، lane collapse، D-pad |
| ماذا ناقص | 🔴 تشغيل صوتي حقيقي — حاليًا صامت (glow فقط)، 🔴 أصل track `track-simple` غير موجود في R2، 🔴 حقوق موسيقى `music_rights` review، 🔴 haptic pulse، ⚠️ 3 نوتات فقط vs أغنية كاملة، 🔴 كتالوج أناشيد مرخصة |

---

### 9) `logic_pattern` — منطق وأنماط — روّاد 9-12

| البند | التفصيل |
|-------|---------|
| الملف | `wave_two_engines.dart: LogicPatternEngine` |
| الفكرة | استنتج القاعدة وطبّقها — مصفوفة نمط |
| `supportsDpad` | true |
| التنفيذ الحالي | مرحلتان: اختيار → شرح، `maxScore` 1 بدون شرح، 2 مع شرح (بدون شرح = 50% لا يصل mastery 80%)، rungs: highlight dimensions → eliminate 2 wrong → answerShown، خلايا مميزة glyph+text مش لون، `changing_dimensions`، `require_explanation` per level، `rule_key` |
| الحزم | `game-wave1-logic-kids`: 2x2 grid، 1 فراغ |
| ماذا تم | ✅ مصفوفة + شرح + scoring تعليمي |
| ماذا ناقص | 🔴 صور منطق حقيقية، 🔴 قائمة `explain_options`، 🔴 تعريفات قواعد، ⚠️ pack بسيط 2x2، ⚠️ 1 مستوى فقط (المخطط 5 بتدرج) |

---

### 10) `block_code` — برمجة بالبلوكات — روّاد 9-12

| البند | التفصيل |
|-------|---------|
| الملف | `block_code_engine.dart` 736 سطر |
| الفكرة | رتّب أوامر لتحريك روبو — تسلسل وتكرار وشرط |
| `supportsDpad` | true |
| التنفيذ الحالي | الأكثر تعقيدًا: `BlockProgram` pure Dart بلا Flutter + `BlockInterpreter.run()` يرجع trace كامل replay/pause/stepBack، semantics: `repeat:n` يكرر block التالي واحد فقط (مصفوفة مسطحة لا تحدد body)، `if_path` يحرس التالي فقط، `function` strip ثاني يملؤه الطفل ويستدعى عبر `function` block (مُعلم editorial confirmation)، اصطدام `isBlocked`, goal+collectibles, UI خطوة بخطوة قابل للإيقاف `step_delay_ms 500`, palette `allowed_blocks`, `block_limit`, `optimal_blocks` نجمة، help 2→hint 3→remove wall 4→reference solution، لا مرآة RTL (قبول)، أيقونات بلا نص، blocks: `move/turn_left/turn_right/repeat/if_path/collect/function` |
| الحزم | `game-wave1-block-code`: 4x4, `game-wave2-block-advanced`: 5x5 optimal 8 |
| ماذا تم | ✅ مفسر حقيقي pure Dart قابل للاختبار + replay + collision + star |
| ماذا ناقص | 🔴 أصل روبوت `asset-complete-robot` placeholder، 🔴 reference solution أحيانًا فارغ، ⚠️ UX strip الدالة غير مطابق فيزيولز المواصفة، ⚠️ 2 مستوى فقط، 🔴 دليل تكرار/شرط تعليمي |

---

### 11) `sim_lab` — مختبر محاكاة — روّاد 9-12

| البند | التفصيل |
|-------|---------|
| الملف | `sim_lab_engine.dart` 510 سطر |
| الفكرة | توقع، جرب، فسر — منهج علمي |
| `supportsDpad` | true |
| التنفيذ الحالي | `SimModel.measure()` أحادي: positive `norm`, negative `1-norm`, `saturating` `1-exp(-3*norm)`, none لا تأثير constant 1.0 (حاسم لدرس البندول)، مؤشر مرحلة predict/experiment/explain، prediction مسجلة لا تُخصم، explanation عليها 1 درجة، شريط أمان `supervision_level=required`, جدول نتائج مميز، `min_trials_before_explain`, sequential tap +/- لـ D-pad |
| الحزم | `game-wave1-sim-lab`: متغير واحد حرارة، `wave3-sim-saturating`: safety_notes required |
| ماذا تم | ✅ نموذج قياس + مراحل علمية + scoring تربوي + safety banner |
| ماذا ناقص | 🔴 محاكيات حقيقية (حرارة فقط)، 🔴 مراجعة علمية `scientific_review`, 🔴 ثوابت فيزيائية حقيقية، 🔴 أصل `asset-oloom-leaf-bg` placeholder، 🔴 أصوات `vo.*`, ⚠️ 3 أنواع تجارب مطلوبة saturating فقط 1 منشور |

---

### 12) `timeline_map` — خط زمني وخريطة — روّاد 9-12

| البند | التفصيل |
|-------|---------|
| الملف | `timeline_map_engine.dart` 542 سطر |
| الفكرة | ضع الحدث في زمنه ومكانه |
| `supportsDpad` | true |
| التنفيذ الحالي | `hijriYearForGregorian()` تقريبي `(greg-622)/0.970229` لا يُخزن — عرض فقط، `centuryDescription` أردية عربية، `MapBounds` مناطق معروفة `middle_east_north_africa/arab_world/world`, `project/unproject` equirectangular, `distanceKm` great-circle، timeline يعكس في RTL wrapper vs map لا يعكس أبدًا (قاعدة المواصفة)، modes `timeline/map/both`, تضييق range rung2, تثبيت anchor rung3, auto-place+explain rung4, `display_calendar` يعرض الهجري والميلادي |
| الحزم | `wave2-timeline` + `wave3-timeline-detail` mode both |
| ماذا تم | ✅ هجري/ميلادي + إسقاط + مسافة + modes ثلاثة + تدرج مساعدة |
| ماذا ناقص | 🔴 بلاطات خريطة حقيقية/إسقاط beyond equirectangular، 🔴 صور أحداث `mountain/book/boat` placeholder، 🔴 مراجعة تاريخية `historical_review`, ⚠️ 2-3 أحداث فقط vs 5 تدرج، 🔴 `tolerance_years` 100 واسع — يحتاج تضييق، 🔴 مراجع تاريخية |

---

## الملخص الرقمي

| المحور | مكتمل | ناقص | ملاحظة |
|-------|-------|------|--------|
| 12 محرك كود | 12/12 100% | 0 | لا stub engines — كلها full |
| أساس مشترك 11 بند | 10/11 | صوت صامت | |
| Schemas | 13/13 | 0 | |
| ألعاب منشورة | 18 | 18 للوصول 36 | 1 مستوى/لعبة بدل 5 |
| أصول R2 حقيقية | 0/18 | 18 | كلها `asset-color-*` placeholders |
| صوت عربي مسجل | 0/12 | 12 | `vo.intro/instruction/count/...` |
| ترجمات en/fr | 0 | 36 | ar فقط ready |
| مراجعات تخصصية | 0 | 4 أنواع | linguistic/scientific/historical/music_rights |
| `supports_dpad` + TV filter | 12/12 | 0 | |
| accessibility | ✅ | — | target 48-64dp, simplified_motor, sequential_tap |
| attempts/mastery/reporting | ✅ | — | idempotent event_id |
| preservation إبداعات | ✅ trace_color | باقي المحركات لا تنتج إبداعًا | PNG+JSON local |

## ما ناقص بوضوح — مرتب بالأولوية

### P0 — يمنع الإطلاق التجريبي

1. **أصول مرئية حقيقية** — كل الحزم 18 تشير لـ `asset-color-*` placeholder يرندر نص id. يجب رسم/استيراد SVG/أشكال والمطابقة: قطة/طير/سمكة/أرنب/تفاحة/بيت/نجوم...
2. **مسارات Trace حقيقية** — `stroke_paths` لـ حروف عربية (`أ ب ت...`) وأشكال (دائرة/مربع) + `template_asset` تلوين
3. **صوت عربي** — `SilentGameAudioService` → `Howler/AudioPlayer` + تسجيل `vo.intro`, `vo.instruction`, `vo.count.1-20`, `vo.block.move`… لا لعبة تقول شيئًا الآن
4. **مستويات 3-5 لكل محرك** — الم spec 5 مستويات متدرجة، الحالي 1

### P1 — يمنع MVP

5. **محتوى 36 لعبة** — هدف 36، الحالي 18. نحتاج 18 إضافية (rhythm 2 + timeline 1 + sort 1...)
6. **أرقام Tracks موسيقية مرخصة لـ rhythm_tap** — `track-simple` غير موجود + `music_rights` مراجعة
7. **مراجعات: linguistic لـ word_build, scientific لـ sim_lab, historical لـ timeline_map, music_rights لـ rhythm_tap** — كود `engineContracts.requiredReview` يطلبها
8. **كلمات word_build كتالوج** — 200+ كلمة 3-5 حروف عربية بتشكيل وأشكال + أصوات

### P2 — جودة

9. **Drag حقيقي** — `sort_bins`, `match_pairs`, `sequence_order` tap fallback فقط، المواصفة `drag_match/drag_order`
10. **Block code UX شريط الدالة** — مطابق لفيزيولز الماركة
11. **EN/FR localizations** — `game_localizations` جدول جاهز لكن فاضي
12. **خرائط وأحداث تاريخية** — بلاطات حقيقية + 50 حدث هجري/ميلادي (حج، فتح مكة...)

---

## خطة التنفيذ المقترحة (من 08-implementation-plan مع تحديث الواقع)

الموجات الأصلية كانت: 1 أبسط, 2 متوسط, 3 معقد, 4 صوتي. الواقع: `trace_color` قُدم خارج الترتيب لأنه قدرة رسم.

| الموجة القادمة | المحركات | تركيز المحتوى | سبرنت |
|---|---|---|---|
| **A — سد فجوة الأصول** | الكل 12 | رسم SVG packs 36 + صوت intro/instruction لكل لعبة | 2 |
| **B — أصوات كاملة** | `count_quantity`, `word_build`, `block_code`, `sim_lab`, `timeline_map`, `logic_pattern` | `vo.count.*`, `word_audio`, `block.*`, `stage_predict`… | 2 |
| **C — مستويات 2-5** | 12 | تصميم 5 مستويات متدرجة لكل محرك + 18 لعبة إضافية | 3 |
| **D — مراجعات وحقوق** | `word_build`, `sim_lab`, `timeline_map`, `rhythm_tap` | linguistic/scientific/historical/music + EN/FR | 2 |

MVP يبقى بموجة 1 الكودية (نُفذت) + موجة A أصول = 18 لعبة قابلة للعرض بلا صوت.

---

## روابط سريعة

- الكود: `app_main/lib/features/games/engine/{game_engine_registry,game_pack,game_board_kit,game_services,game_session_controller,trace_*,wave_one_engines,wave_two_engines,block_code_engine,rhythm_tap_engine,sim_lab_engine,timeline_map_engine}`
- الشاشة: `presentation/pages/{game_screen,game_route}` + `application/game_providers.dart`
- الخادم: `dashboard/api/src/routes/games.ts` + `lib/{gamePackValidation,gamePackGate,engineContracts,jsonSchema}` + `adminGames.ts`
- DB: `migrations/0024,0054,0055,0056`
- المواصفات: `docs/games/00-overview`…`09-definition-of-done` + `docs/games/engines/01-12`
- Schemas: `docs/games/schemas/*.v1.schema.json` (13)
- الاختبارات: `app_main/test/{wave_one_engines, wave_two_engines, game_screen, trace_geometry, trace_session, coloring_board}_test.dart` + `dashboard/api/test/{gameDelivery,gamePackValidation,gameLocalizations,adminGamesProduction}.test.mjs`
