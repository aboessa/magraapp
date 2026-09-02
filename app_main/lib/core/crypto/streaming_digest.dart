// ignore_for_file: close_sinks
//
// ## لماذا القاعدة مُسكَتة في هذا الملف وحده
//
// `close_sinks` تبحث عن `close()` في نطاق إنشاء الـsink نفسه. هنا الإغلاق يجري
// عبر [StreamingDigest.close] — أي في دالة أخرى من الصفّ — فلا تراه القاعدة.
// الإغلاق مضمون: [StreamingDigest.hex] يُغلق قبل القراءة، و[close] يُستدعى في
// `finally` عند كل مسار فشل أو إلغاء، وكلاهما مرة واحدة.
//
// الإسكات على مستوى الملف لا الملف الذي يستعمله: هذا الملف سطران ونصفٌّ واحد،
// فنطاق الإسكات محدود بما يُراجَع بنظرة. إسكاتها في `download_manager.dart`
// (1400 سطر) كان سيُخفي تسريبًا حقيقيًّا لاحقًا.

import 'dart:convert';

import 'package:crypto/crypto.dart';

/// بصمة SHA-256 تُحسب أثناء تدفّق البايتات لا بعد تجميعها.
///
/// ENC-007: العميل يتحقّق أن ما نزّله هو ما نشره الخادم. حساب البصمة بعد الكتابة
/// كان يعني قراءة الملف كاملًا مرة ثانية — وهو ما أُزيل في `ENC-006` لأنه يحمل
/// نصف جيجابايت في الذاكرة. و`convert` يبني الملخّص من مصفوفة واحدة، فالمسار
/// الوحيد الذي يقبل الأجزاء هو `startChunkedConversion`.
class StreamingDigest {
  StreamingDigest() {
    _sink = sha256.startChunkedConversion(_output);
  }

  final _DigestCollector _output = _DigestCollector();
  late final ByteConversionSink _sink;
  bool _closed = false;

  void add(List<int> chunk) {
    if (!_closed) _sink.add(chunk);
  }

  /// يُغلق التحويل ويعيد البصمة بست عشري صغير الأحرف، كما يخزّنها الخادم.
  ///
  /// `null` إن لم يُنتَج ملخّص — لا يحدث في الاستخدام العادي، والعائد قابل
  /// للعدم بدل `!` التي كانت ستنهار على حالة لا نتوقّعها.
  String? hex() {
    close();
    return _output.digest?.toString();
  }

  /// يُغلق بلا قراءة، لمسار الفشل والإلغاء: تدفّق مفتوح على جري منتهٍ تسريب.
  void close() {
    if (_closed) return;
    _closed = true;
    _sink.close();
  }
}

class _DigestCollector implements Sink<Digest> {
  Digest? digest;

  @override
  void add(Digest data) => digest = data;

  @override
  void close() {}
}
