import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// مخزن آمن في الذاكرة للاختبارات.
///
/// ## لماذا صار لازمًا
///
/// `FileCrypto` كان يبتلع كل خطأ من `FlutterSecureStorage` بصمت
/// (`ENC-011`)، فكان يعمل في الاختبارات «بالخطأ»: الإضافة غير مسجَّلة في بيئة
/// اختبار الوحدة، فترفع `MissingPluginException`، فيُقرأ ذلك كـ«لا مفتاح» ثم
/// يُكمل بمفتاح في الذاكرة. أي أن الاختبارات كانت تمرّ عبر نفس المسار الذي
/// يُنتج في الإنتاج تنزيلات لا تُفَك.
///
/// بعد أن صار الفشل صريحًا، على الاختبار أن يوفّر مخزنًا حقيقيًّا يعمل. وهذا
/// المخزن يفعل ذلك، ويستطيع أيضًا محاكاة الفشل عبر [failReads] و[failWrites]
/// حتى يُختبر المسار الجديد نفسه.
class FakeSecureStorage extends FlutterSecureStorage {
  FakeSecureStorage({this.failReads = false, this.failWrites = false});

  final Map<String, String> values = <String, String>{};
  bool failReads;
  bool failWrites;

  @override
  Future<String?> read({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (failReads) throw Exception('secure storage read failed');
    return values[key];
  }

  @override
  Future<void> write({
    required String key,
    required String? value,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    if (failWrites) throw Exception('secure storage write failed');
    if (value == null) {
      values.remove(key);
    } else {
      values[key] = value;
    }
  }

  @override
  Future<void> delete({
    required String key,
    IOSOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    MacOsOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    values.remove(key);
  }
}
