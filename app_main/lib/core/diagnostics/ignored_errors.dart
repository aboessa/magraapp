import 'package:flutter/foundation.dart';

/// قناة واحدة لكل خطأ يُتَّخذ قرارٌ بإهماله (`APP-106`).
///
/// ## العلّة
///
/// ستٌّ وخمسون كتلة `catch (_) {}` في التطبيق. البنية العامة لمعالجة الأخطاء
/// قوية — `runZonedGuarded` و`FlutterError.onError` و`AppFailure` — لكنها كلّها
/// تعمل على أخطاء **تصل إليها**، وهذه الكتل تمنع الوصول.
///
/// وأثر ذلك ليس نظريًّا: حفظ تقدّم المشاهدة كان يفشل بـ400 عند **كل** نداء لأن
/// العميل يرسل `childId` والخادم يقرأ `child_id`، والنداء «أطلق وانسَ» مع كتم
/// الفشل هو ما أخفى العطل شهورًا (`SEC-110`، الدفعة 18). لم يكن الخطأ في قرار
/// «لا تُقاطع المشاهدة» — بل في أن القرار كان **يمحو** الخطأ بدل أن يسجّله.
///
/// ## القاعدة
///
/// الإهمال مسموح، و**الإهمال الصامت ممنوع**. كل التقاط لا يعالج شيئًا يجب أن
/// يمرّ من هنا أو يحمل تعليقًا يشرح لماذا الإهمال صحيح في موضعه.
///
/// ## ولماذا هذا الملف لا يرفع الخطأ ولا يعرضه
///
/// لأنه يُستدعى من مسارات لا تحتمل مقاطعة: بثّ وسائط، وتنظيف ملفات، وقراءة
/// كاش. وظيفته أن يجعل الخطأ **موجودًا**: مطبوعًا في التطوير، ومعدودًا في
/// الذاكرة كي يراه اختبار أو شاشة تشخيص. ورفعه إلى خدمة رصد خارجية بند مستقلّ
/// (`OPS-106`) لأنه يحتاج قرار مزوّد.

/// خطأ مُهمَل مُسجَّل.
@immutable
class IgnoredError {
  const IgnoredError(this.area, this.error, this.at);

  /// موضع الإهمال بصيغة `طبقة.عملية` — مثل `auth_storage.write`.
  final String area;
  final Object error;
  final DateTime at;

  @override
  String toString() => '$area: $error';
}

/// آخر ما أُهمل، أحدثه أوّلًا.
///
/// السقف موجود لأن هذه ذاكرة عملية طويلة العمر: سجلّ بلا حدّ في مسار بثّ يتسرّب.
/// وثلاثون تكفي للسؤال الذي يُطرَح فعلًا: «ما الذي كان يفشل صامتًا قبل قليل؟»
List<IgnoredError> get ignoredErrors => List.unmodifiable(_recent);

const _capacity = 30;
final List<IgnoredError> _recent = <IgnoredError>[];

/// عدّاد لكل موضع. الرقم أهمّ من النصّ: `أربعمئة مرة` تعني عطلًا لا حادثة.
Map<String, int> get ignoredErrorCounts => Map.unmodifiable(_counts);

final Map<String, int> _counts = <String, int>{};

/// يسجّل خطأً أُهمل عن قصد.
///
/// [area] ثابت نصّي قصير لا رسالة: التجميع بالموضع هو ما يكشف التكرار، ورسالة
/// مختلفة لكل نداء تُفقد ذلك.
void reportIgnoredError(String area, Object error, [StackTrace? stack]) {
  _counts[area] = (_counts[area] ?? 0) + 1;
  _recent.insert(0, IgnoredError(area, error, DateTime.now()));
  if (_recent.length > _capacity) _recent.removeLast();

  // في التطوير يُطبَع فورًا: كتلة صامتة لا يراها المطوّر أثناء العمل تبقى صامتة
  // إلى الإنتاج. وفي الإصدار لا طبع — السجلّ في الذاكرة وحده.
  if (kDebugMode) {
    debugPrint('ignored [$area] ($_countsSuffix): $error');
    if (stack != null && _counts[area] == 1) debugPrintStack(stackTrace: stack);
  }
}

String get _countsSuffix => _counts.values.fold(0, (sum, value) => sum + value).toString();

/// يُصفّر السجلّ. للاختبارات وحدها.
@visibleForTesting
void resetIgnoredErrors() {
  _recent.clear();
  _counts.clear();
}
