import 'package:http/http.dart' as http;

import '../../../core/diagnostics/ignored_errors.dart';

/// يتحقّق أن نقطة الحماية تُعيد وسائط لا جسد خطأ API (`APP-102`).
///
/// ## ما كان في الصفحة
///
/// كان `playback_page.dart` يبني `http.Client()` عاريًا داخل `_probeNetworkVideo`
/// — نفس علّة `CaptionRepository` قبل استخراجه: يتجاوز العميل المثبَّت
/// (`SEC-105`)، ويكسر قاعدة «لا `package:http` في `presentation/`» التي يحرسها
/// `presentation_network_layering_test.dart`.
///
/// ## القرار: الفحص يبقى، والعميل يتغيّر
///
/// الفحص نفسه سليم: Chrome يبلّغ عن الحالتين (وسائط سليمة مقابل جسد خطأ) كفشل
/// فكّ ترميز غامض، فطلب `Range: bytes=0-63` وفحص `ftyp` يميّز مبكّرًا بخطأ
/// مفهوم. ما تغيّر هو أنّ الطلب يمرّ بالعميل المثبَّت المحقون — فيُختبر وحدةً
/// بعميل مزيّف، ويُغلَق مع الـProviderScope بدل `finally` يدوي.
class MediaProbeRepository {
  const MediaProbeRepository(this._client, {Duration timeout = _defaultTimeout})
    : _timeout = timeout;

  static const Duration _defaultTimeout = Duration(seconds: 15);

  final http.Client _client;
  final Duration _timeout;

  /// نتيجة الفحص: `null` تعني وسائط سليمة، ونصٌّ تعني سبب الرفض للتشخيص.
  ///
  /// `null` لا استثناء: القارئ الوحيد (`playback_page.dart`) يحوّل الرفض إلى
  /// `StateError` برسالة الطفل الآمنة، والفصل يبقي هذه الطبقة خالصة للشبكة.
  Future<String?> probe(Uri uri) async {
    try {
      final request = http.Request('GET', uri)
        ..headers['Range'] = 'bytes=0-63';
      final streamed = await _client.send(request).timeout(_timeout);
      final bytes = await streamed.stream.toBytes();
      final prefixLength = bytes.length < 64 ? bytes.length : 64;
      final prefix = String.fromCharCodes(bytes.take(prefixLength));
      final contentType = streamed.headers['content-type'] ?? '';
      final validStatus =
          streamed.statusCode == 200 || streamed.statusCode == 206;
      final isMp4 = contentType.toLowerCase().startsWith('video/mp4') &&
          prefix.contains('ftyp');
      if (validStatus && isMp4) return null;
      return 'status=${streamed.statusCode}, '
          'type=${contentType.isEmpty ? "missing" : contentType}, '
          'range=${streamed.headers['content-range'] ?? "missing"}, '
          'ftyp=${prefix.contains('ftyp')}';
    } catch (error, stack) {
      // يشمل `TlsVerificationException`: يُسجَّل عبر `APP-106` ولا يُعرض على
      // طفل، ويُعامَل كفشل فحص — لا كتعليق أبدي ولا كإعادة محاولة صامتة.
      reportIgnoredError('media_probe.probe', error, stack);
      return 'probe failed: $error';
    }
  }
}
