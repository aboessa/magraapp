import '../../home/data/majarra_api_client.dart';

/// كتابة الضوابط الرقابية لطفل واحد (`APP-102`).
///
/// ## لماذا دالّة مسمّاة لكل ضبط، لا خريطة حرّة
///
/// `MajarraApiClient.updateChildSettings` تقبل `Map<String, Object?>` أيًّا كان.
/// وكانت لوحة وليّ الأمر تبنيها في **ستّة مواضع** داخل شجرة العناصر، كلٌّ بمفتاحه
/// النصّي الحرفي: `'daily_minutes'`، `'bedtime_start'`، `'bedtime_end'`،
/// `'allow_speed_change'`، `'autoplay_override'`.
///
/// ومفتاحٌ نصّي مكتوب بيدٍ في ستّة مواضع لا يخطئ مرّة واحدة فيُكتشف: يخطئ في
/// موضع واحد فيبقى الخمسة الباقية شاهدةً على أنه «يعمل». والخادم يقبل الحقل غير
/// المعروف أو يرفضه، وفي كلتا الحالتين لا يعلم أحد. (وهو نفس شكل العطل الذي أخفى
/// حفظ تقدّم المشاهدة شهورًا: `childId` مقابل `child_id` — `SEC-110`.)
///
/// فصار اسم الحقل مكتوبًا **مرّة واحدة** خلف دالّة لها نوع، ويثبّته اختبار.
class ChildControlsRepository {
  const ChildControlsRepository(this._api);

  final MajarraApiClient _api;

  /// دقائق الشاشة اليومية.
  Future<void> setDailyMinutes(String childId, int minutes) =>
      _api.updateChildSettings(childId, {'daily_minutes': minutes});

  /// بداية نافذة النوم بصيغة `HH:mm`.
  Future<void> setBedtimeStart(String childId, String time) =>
      _api.updateChildSettings(childId, {'bedtime_start': time});

  /// نهاية نافذة النوم بصيغة `HH:mm`.
  Future<void> setBedtimeEnd(String childId, String time) =>
      _api.updateChildSettings(childId, {'bedtime_end': time});

  /// يمسح نافذة النوم.
  ///
  /// الطرفان في طلب واحد: مسحُهما بطلبين يترك نافذةً نصفها محدَّد إن فشل الثاني —
  /// أي حالةً لم يقصدها وليّ الأمر ولا يراها.
  Future<void> clearBedtime(String childId) =>
      _api.updateChildSettings(childId, {'bedtime_start': '', 'bedtime_end': ''});

  Future<void> setAllowSpeedChange(String childId, bool allowed) =>
      _api.updateChildSettings(childId, {'allow_speed_change': allowed});

  /// `off` أو `on` أو `inherit`.
  Future<void> setAutoplayOverride(String childId, String value) =>
      _api.updateChildSettings(childId, {'autoplay_override': value});

  /// يحذف ملف الطفل وبياناته.
  ///
  /// مفتاح التكرار يُولَّد **هنا** لا في الصفحة: هو ما يمنع حذفًا ثانيًا إن أُعيدت
  /// المحاولة، وتركُه في عنصر واجهة يجعله سهل النسيان في أي نداء جديد.
  Future<void> deleteChild(String childId) async {
    final requestId = _api.createChildDeletionRequestId();
    await _api.deleteChildAccountData(childId: childId, idempotencyKey: requestId);
  }
}
