# 08 — خطة التنفيذ

> 🟢 **حالة فعلية — آخر تحديث بعد تنفيذ نظام الرسم.** الجداول أدناه خطة، وهذا
> الصندوق هو ما نُفِّذ بالفعل ويمكن التحقّق منه بالاختبارات:
>
> | البند | الحالة |
> |---|---|
> | 1 · `game_localizations` + فهارس | ✅ الترحيل `0024` — ar/en/fr، والهندسة لا تُكرَّر بين اللغات |
> | 2 · تحقّق Schema للحزم في مسار الإدارة | ✅ `lib/jsonSchema.ts` + `lib/gamePackValidation.ts` + `lib/gamePackGate.ts`، القواعد الاثنتا عشرة كلها |
> | 3 · `GET /api/v1/games/:id` بلغة الطفل + `fallback` صريح | ✅ `routes/games.ts` — المنشور فقط، والمسودّة لا تُسلَّم |
> | 4 · تسليم أصول الألعاب بـcapability قصيرة من R2 | ✅ رمز وسائط لكل أصل، بلا رابط عام |
> | 5 · إعداد `intl` + `l10n.yaml` + ملفات `.arb` | ✅ كان موجودًا قبل هذا العمل |
> | 6 · `GameEngineRegistry` + محرك غير معروف بأمان | ✅ `engine/game_engine_registry.dart` |
> | 7 · طبقة صوت مشتركة | ⚠️ الواجهة موجودة، والتنفيذ `SilentGameAudioService` — **لا صوت مسجَّل بعد** |
> | 8 · طبقة تشجيع مشتركة | ✅ `FeedbackService` |
> | 9 · طبقة سلّم المساعدة | ✅ `HelpLadder` + `helpLevelForStalls` |
> | 10 · إرسال `attempts` بـ`event_id` ثابت | ✅ `AttemptReporter` + `game_id` في `FamilyState` |
> | 11 · طبقة إمكانية وصول مشتركة | ✅ وضع حركي مبسّط + بديل اللمس + إخفاء على TV |
> | الموجة 2 · `trace_color` | ✅ **مُنفَّذ** قبل الموجة 1، لأن نظام الرسم كان أولوية مستقلة |
> | الموجة 1 · `match_pairs`, `sort_bins`, `memory_flip`, `sequence_order` | ❌ لم تُنفَّذ — `memory_flip` صفحة مكتوبة يدويًا لم تُنقل إلى السجل بعد |
>
> 🔴 **`trace_color` نُفِّذ خارج ترتيب الموجات** المذكور أدناه. الترتيب الأصلي
> كان يضعه في الموجة 2؛ وقد قُدِّم لأن قدرة الطفل على الرسم كانت غائبة تمامًا.

## الأساس المشترك — قبل أي محرك

يجب إنجاز هذه أولًا، وإلا تكرّر الكود في كل محرك وانكسرت السياسات.

| # | المهمة | الطبقة | حرج |
|---:|---|---|---|
| 1 | migration `game_localizations` + فهارس | D1 | |
| 2 | تحقق Schema للحزم في مسار الإدارة | Worker | ✅ |
| 3 | `GET /api/v1/games/:id` بلغة الطفل + `fallback` صريح | Worker | |
| 4 | تسليم أصول الألعاب بـcapability قصيرة من R2 | Worker | ✅ |
| 5 | إعداد `intl` + `l10n.yaml` + ملفات `.arb` | Flutter | |
| 6 | `GameEngineRegistry` يربط `engine_id` بالتنفيذ ويتعامل بأمان مع محرك غير معروف | Flutter | |
| 7 | طبقة صوت مشتركة: تحميل مسبق، إيقاف عند الخروج، احترام كتم الجهاز | Flutter | |
| 8 | **طبقة تشجيع مشتركة** تطبّق قواعد المستند 04 مركزيًا | Flutter | ✅ |
| 9 | **طبقة سلّم المساعدة المشتركة** (تلميح ← تبسيط ← حل) | Flutter | ✅ |
| 10 | إرسال `attempts` عبر `family/progress` بـ`event_id` ثابت | Flutter | ✅ |
| 11 | طبقة إمكانية وصول مشتركة: بديل السحب، D-pad، تقليل الحركة | Flutter | ✅ |

### لماذا 8 و9 و11 حرجة

لو نُفِّذت داخل كل لعبة نشأت **12 سلوكًا مختلفًا** للتشجيع والفشل وإمكانية الوصول، وانكسرت السياسة التربوية، واستحال ضمان أن الطفل «لا يعلق أبدًا».

### واجهات الطبقات المشتركة

```dart
abstract class GameEngine {
  String get engineId;
  bool get supportsDpad;
  Widget build(BuildContext context, GamePack pack, int level);
}

abstract class FeedbackService {
  void onCorrect({required AgeTrack track});
  void onIncorrect({required AgeTrack track, required int failedAttempts});
  void onLevelComplete({required AgeTrack track});
  void onGameComplete({required AgeTrack track});
  HelpAction resolveHelp({required int failedAttempts, required HelpSystem config});
}

abstract class GameAudioService {
  Future<void> preload(Map<String, String> voiceManifest);
  Future<void> speak(String key);
  Future<void> repeatInstruction();
  void stopAll();
}

abstract class AttemptReporter {
  Future<void> report(GameAttempt attempt); // event_id ثابت
}
```

## موجات المحركات

| الموجة | المحركات | السبب | تقدير |
|---|---|---|---|
| **1** | `match_pairs`, `sort_bins`, `memory_flip`, `sequence_order` | أبسط تنفيذًا، تغطي مسارين، مستقلة عن اللغة غالبًا | 2 سبرنت |
| **2** | `count_quantity`, `trace_color`, `logic_pattern` | قيمة تعليمية عالية، تعقيد متوسط | 2 سبرنت |
| **3** | `block_code`, `sim_lab`, `timeline_map` | الأعلى تعقيدًا، للروّاد | 3 سبرنت |
| **4** | `word_build`, `rhythm_tap` | يحتاجان أصولًا صوتية ولغوية مكثفة | 2 سبرنت |

**الموجة 1 تكفي لـMVP.** الباقي بعد الإطلاق.

## ترتيب داخل الموجة الأولى

| الترتيب | المحرك | السبب |
|---:|---|---|
| 1 | `match_pairs` | يختبر كل الطبقات المشتركة: سحب، صوت، تشجيع، مساعدة |
| 2 | `memory_flip` | يختبر الاستثناءات: صمت، بلا `mastery` |
| 3 | `sort_bins` | قريب من `match_pairs`، يعيد استخدام معظم الكود |
| 4 | `sequence_order` | يختبر RTL/LTR والاتجاه |

## المحتوى

- **3 حزم لكل محرك** عند الإطلاق = 36 لعبة.
- التوسعة بعدها **بلا إصدار متجر**.
- كل حزمة تمر بمراحل [`CONTENT_PRODUCTION.md`](../../CONTENT_PRODUCTION.md) قسم 7.1:
  بوابة تعريف ← تصميم مستويات ← مراجعة تربوية ولغوية ← مراجعة تخصصية ← أصول ← Voice Over ← حقوق ← QA رباعي ← نشر مجدول.

## الربط بسبرنتات MVP

المرجع: [`PLAN_PHASE_1_DETAILED.md`](../../PLAN_PHASE_1_DETAILED.md) — Sprint 4.

| القصة | المحتوى |
|---|---|
| `US16a` | `game_localizations` + تحقق Schema |
| `US16b` | endpoint الحزمة بلغة الطفل + capability للأصول |
| `US16c` | `GameEngineRegistry` + طبقة الصوت + `intl`/`.arb` |
| `US16d` | طبقة التشجيع + طبقة سلّم المساعدة |
| `US17` | `match_pairs`, `sort_bins`, `memory_flip` |
| `US18` | `sequence_order` |
| `US19` | `logic_pattern` أو مشروع |
| `US20` | كتابة المحاولات والإتقان |
| `US20a` | «لا أعلق أبدًا» |
| `US20b` | البديل البصري الكامل |
| `US20c` | بديل السحب |

## المخاطر

| الخطر | التخفيف |
|---|---|
| تكرار منطق التشجيع في المحركات | مراجعة كود ترفض أي محرك يحتوي منطقًا خاصًا |
| حزم بأصول غير جاهزة | تحقق الخادم على `content_assets.status = ready` |
| ترجمة آلية لحزمة `language_specific` | CMS يرفض عند `translated_from != NULL` |
| كسر الحزم القديمة عند ترقية محرك | `engine_version` + `pack_version` وتوافق خلفي إلزامي |
| أصول صوتية ضخمة | تحميل مسبق للمستوى الحالي فقط |
| تعقيد `block_code` و`sim_lab` | تأخيرهما للموجة 3 بعد استقرار الطبقات |
