/// مخزن المنصّة الآمن غير متاح.
///
/// نوع مستقل حتى يستطيع المستدعي رفض البدء برسالة صحيحة، بدل أن يُعالَج كخطأ
/// شبكة فيُعاد المحاولة إلى الأبد أو يُنتج تنزيلًا لا يُفَك.
///
/// ## لماذا انتقل إلى `core/failures/`
///
/// كان معرَّفًا داخل `core/crypto/file_crypto.dart` لأن أوّل من احتاجه مسار
/// التشفير (`ENC-011`). ثم احتاجه `auth_storage` (`APP-106`)، ومخزن التوكنات لا
/// شأن له بالتشفير: استيراده لملف الحزم كان سيجرّ مسار التنزيل كلّه إلى مسار
/// الإقلاع. والنوع نفسه لا يخصّ طبقة واحدة — الفشل هو فشل مخزن المنصّة.
///
/// و`file_crypto.dart` يُصدّره حتى يبقى مستوردوه القائمون يعملون.
class SecureStorageUnavailableException implements Exception {
  const SecureStorageUnavailableException(this.operation, [this.cause]);

  /// الموضع بصيغة `طبقة.عملية` — مثل `auth_storage.write`.
  final String operation;
  final Object? cause;

  /// رسالة للعرض: تشرح السبب ولا تكشف أي تفصيل تشفيري.
  String get message =>
      'التخزين الآمن على هذا الجهاز غير متاح، فلا يمكن حفظ المحتوى للاستخدام دون إنترنت.';

  @override
  String toString() => 'SecureStorageUnavailableException($operation)';
}
