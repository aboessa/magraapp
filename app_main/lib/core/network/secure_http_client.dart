/// SEC-105 — العميل الوحيد الذي يُفتح به أي اتصال HTTP في التطبيق.
///
/// التفاصيل الأمنية وإجراء دوران الجذور في `pinned_certificates.dart`. هذا
/// الملف هو التركيب: كيف تُبنى الثقة، ومتى تُفرض، وكيف يُعرض الفشل.
library;

import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import '../env/app_environment.dart';
import 'pinned_certificates.dart';

/// فشل تحقّق من هوية الخادم.
///
/// نوع مستقل عن `SocketException` عن قصد: انقطاع الشبكة حالة عابرة تُعالج
/// بإعادة المحاولة، وفشل التحقّق حالة **لا يجوز** أن تُعاد المحاولة عليها بصمت،
/// لأنها تعني إمّا اعتراضًا فعليًّا وإمّا حزمة جذور متقادمة. التمييز بينهما هو
/// ما يمنع «إعادة محاولة» تخفي اعتراضًا.
class TlsVerificationException implements Exception {
  const TlsVerificationException(this.host, [this.detail]);

  final String host;
  final String? detail;

  /// رسالة صالحة للعرض على وليّ الأمر: تقول ما حدث بلا مصطلح تقني، ولا تدّعي
  /// أن المشكلة في الإنترنت لأن الغالب أنها ليست كذلك.
  String get message =>
      'تعذّر التحقّق من هوية الخادم ($host). قد تكون الشبكة التي تستخدمها '
      'تعترض الاتصال. جرّب شبكة أخرى، وإن تكرّر الأمر فحدِّث التطبيق.';

  @override
  String toString() =>
      'TlsVerificationException($host)${detail == null ? '' : ': $detail'}';
}

/// هل التثبيت مفروض في [now]؟
///
/// دالة نقية ليكون السلوك قابلًا للاختبار بلا انتظار انقضاء التاريخ.
bool isPinningEnforced(DateTime now) =>
    now.toUtc().isBefore(pinningEnforcedUntil);

/// هل يُثبَّت على [baseUri]؟
///
/// `http` إلى loopback هو عامل محلي بلا TLS أصلًا (`AppConfig` يسمح به لبناء
/// التطوير وحده)، ولا شيء فيه ليُثبَّت. أي اتصال `https` — حتى في بناء تطوير —
/// يُثبَّت: بناء التطوير يتحدّث إلى الإنتاج نفسه، ولو استُثني لكان الاختبار
/// الحقيقي للتثبيت مؤجَّلًا إلى أول بناء إصدار.
bool shouldPin(Uri baseUri) => baseUri.scheme.toLowerCase() == 'https';

/// سياق ثقة يحوي جذور [pinnedRootsPem] **ولا شيء غيرها**.
///
/// `withTrustedRoots: false` هو جوهر البند: بها لا يُستشار مخزن النظام، فشهادة
/// جذر مزروعة على الجهاز — أداة تحليل، وكيل مؤسسي، اعتراض — لا تُبنى منها
/// سلسلة صالحة.
SecurityContext buildPinnedSecurityContext() {
  final context = SecurityContext(withTrustedRoots: false);
  context.setTrustedCertificatesBytes(utf8.encode(pinnedRootsPem));
  return context;
}

/// ينشئ عميل HTTP للتطبيق، مثبَّتًا حيث ينبغي.
///
/// [now] و[baseUrl] للاختبار فقط.
http.Client createAppHttpClient({DateTime? now, String? baseUrl}) {
  // Web: BrowserClient — pinning via dart:io SecurityContext/HttpClient غير متاح على Web
  if (kIsWeb) return http.Client();
  final base = Uri.parse(baseUrl ?? AppConfig.baseUrl);
  final at = now ?? DateTime.now();

  if (!shouldPin(base)) return http.Client();

  if (!isPinningEnforced(at)) {
    // بناء متقادم: نعود إلى ثقة النظام بدل أن نتركه معطَّلًا إلى الأبد. هذا
    // خطر مقبول ومحدود بتاريخ، والبديل — التثبيت الأبدي — يعني أن خطأً واحدًا
    // في الحزمة يقتل كل نسخة منشورة بلا علاج من جهة الخادم.
    debugPrint(
      'majarra: certificate pinning expired ($pinningEnforcedUntil); '
      'falling back to system trust store. Ship an update.',
    );
    return http.Client();
  }

  final client = HttpClient(context: buildPinnedSecurityContext())
    // فشل مغلق. الاستدعاء هنا يعني أن السلسلة لم تُبنَ إلى أي من جذورنا،
    // وإرجاع `true` كان سيُبطل التثبيت كلّه بسطر واحد.
    ..badCertificateCallback = (cert, host, port) {
      debugPrint('majarra: rejected certificate for $host:$port '
          '(subject=${cert.subject}, issuer=${cert.issuer})');
      return false;
    }
    // مهلة اتصال صريحة: معيار القبول يطلب خطأً مفهومًا لا تعليقًا أبديًا.
    ..connectionTimeout = const Duration(seconds: 10);

  return _TlsAwareClient(IOClient(client));
}

/// يحوّل `HandshakeException` إلى [TlsVerificationException].
///
/// بلا هذا التحويل يصل الفشل إلى الواجهة كنص استثناء خام من BoringSSL
/// («CERTIFICATE_VERIFY_FAILED…») فيُعرض على وليّ أمر أو يُعالَج كخطأ شبكة عابر
/// فتُعاد المحاولة على اتصال معترَض.
class _TlsAwareClient extends http.BaseClient {
  _TlsAwareClient(this._inner);

  final http.Client _inner;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    try {
      return await _inner.send(request);
    } on HandshakeException catch (error) {
      throw TlsVerificationException(request.url.host, error.message);
    } on TlsException catch (error) {
      throw TlsVerificationException(request.url.host, error.message);
    }
  }

  @override
  void close() => _inner.close();
}
