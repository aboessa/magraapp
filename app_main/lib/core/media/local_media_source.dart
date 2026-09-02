import 'dart:async';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../crypto/file_crypto.dart';

/// ENC-004 — تشغيل المحتوى المنزَّل بلا ملف صريح على القرص.
///
/// ## العلّة
///
/// كان التشغيل يفكّ الحزمة إلى `.play_<id>.mp4` صريح ويسلّمه للمشغّل. الخطة
/// تمنع ذلك في §12، والسبب عملي: مع غياب DRM (قرار مالك 2026-08-26) صار هذا
/// **أسهل طريق استخراج في المنظومة كلّها** — أسهل من كسر التشفير وأسهل من
/// التقاط الشاشة. ملف كامل قابل للقراءة، عمره عمر الجلسة، وقد يبقى بعدها إن
/// مات التطبيق قبل الحذف.
///
/// ## الحل: خادم على loopback يقدّم تدفقًا مفكوكًا
///
/// `video_player` و`just_audio` يبنيان على ExoPlayer وAVPlayer، وكلاهما يقرأ
/// من رابط لا من تدفق في الذاكرة. فالوسيط الوحيد الممكن بلا كتابة كود native
/// لكل منصّة هو خادم HTTP داخل التطبيق نفسه، مربوط على `127.0.0.1` وحده،
/// يفكّ الأجزاء المطلوبة عند الطلب.
///
/// **لا بايت صريح يلمس القرص**: البايتات تُفَك في الذاكرة جزءًا جزءًا وتُكتب
/// على المقبس.
///
/// ## القفز يعمل — وهذا ثمرة الصيغة المقسَّمة
///
/// المشغّل يطلب `Range` عند كل قفزة، والخادم يجيب من الجزء المطابق مباشرة
/// (`FileCrypto.decryptRange`). بلا تقسيم (`ENC-006`) كانت كل قفزة تعني فكّ
/// الملف من أوّله.
///
/// ## الحدّ الأمني، بصراحة
///
/// على Android يستطيع أي تطبيق آخر على الجهاز الوصول إلى `127.0.0.1`. لذلك:
///
///   * **مسار سرّي لكل جلسة**: 32 حرفًا من `Random.secure()` (128 بت). لا سبيل
///     لتخمينه، ولا فهرسة ولا مسار افتراضي يستجيب.
///   * **عمر الخادم عمر التشغيل**: يبدأ عند الفتح ويُغلق عند الخروج، فلا
///     منفذ مفتوح بلا سبب.
///   * **loopback فقط**: `InternetAddress.loopbackIPv4`، فلا وصول من الشبكة
///     المحلية ولا من جهاز آخر.
///
/// وهذا أضيق من الحالة السابقة لا أوسع: الملف الصريح كان مقروءًا من أي تطبيق
/// على جهاز مفتوح الجذر، ومن أي نسخة احتياطية، وبعمر أطول من الجلسة.
class LocalMediaSource {
  LocalMediaSource({FileCrypto? crypto}) : _crypto = crypto ?? FileCrypto();

  final FileCrypto _crypto;
  final Map<String, _ServedPackage> _served = <String, _ServedPackage>{};
  HttpServer? _server;

  /// يبدأ تقديم [package] ويُعيد الرابط الذي يُسلَّم للمشغّل.
  ///
  /// [contentType] لازم: ExoPlayer يختار الحاوية من الترويسة قبل أن يقرأ
  /// البايتات، و`application/octet-stream` تجعله يرفض ملفًا سليمًا.
  Future<Uri> serve({
    required File package,
    required PackageContext context,
    required String contentType,
  }) async {
    final server = await _ensureServer();
    final length = await _crypto.plainLengthOf(package);
    final token = _token();
    _served[token] = _ServedPackage(
      file: package,
      context: context,
      contentType: contentType,
      length: length,
    );
    return Uri.parse('http://${server.address.address}:${server.port}/$token');
  }

  /// يوقف تقديم رابط سُلِّم سابقًا. آخر رابط يُغلق الخادم.
  Future<void> release(Uri uri) async {
    final token = uri.pathSegments.isEmpty ? '' : uri.pathSegments.first;
    _served.remove(token);
    if (_served.isEmpty) await stop();
  }

  Future<void> stop() async {
    final server = _server;
    _server = null;
    _served.clear();
    if (server != null) {
      try {
        await server.close(force: true);
      } catch (_) {
        // إغلاق خادم مُغلَق أصلًا ليس خطأً يستحق الإبلاغ.
      }
    }
  }

  bool get isRunning => _server != null;

  Future<HttpServer> _ensureServer() async {
    final existing = _server;
    if (existing != null) return existing;
    // المنفذ 0 = منفذ حر يختاره النظام: منفذ ثابت يتعارض مع نسخة أخرى من
    // التطبيق ويصير بصمة قابلة للمسح من تطبيق آخر.
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server = server;
    server.listen(
      _handle,
      onError: (Object _) {},
      cancelOnError: false,
    );
    return server;
  }

  static final Random _random = Random.secure();

  String _token() {
    final bytes = List<int>.generate(16, (_) => _random.nextInt(256));
    return bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  Future<void> _handle(HttpRequest request) async {
    final response = request.response;
    try {
      final method = request.method.toUpperCase();
      if (method != 'GET' && method != 'HEAD') {
        response.statusCode = HttpStatus.methodNotAllowed;
        await response.close();
        return;
      }

      final segments = request.uri.pathSegments;
      final entry = segments.length == 1 ? _served[segments.first] : null;
      if (entry == null) {
        // لا تمييز بين «مسار خطأ» و«رمز خطأ»: كلاهما 404، فلا يتعلّم متلصّص
        // شيئًا من الفرق.
        response.statusCode = HttpStatus.notFound;
        await response.close();
        return;
      }

      final range = _parseRange(request.headers.value(HttpHeaders.rangeHeader), entry.length);
      if (range == null && request.headers.value(HttpHeaders.rangeHeader) != null) {
        response.statusCode = HttpStatus.requestedRangeNotSatisfiable;
        response.headers.set(HttpHeaders.contentRangeHeader, 'bytes */${entry.length}');
        await response.close();
        return;
      }

      final start = range?.start ?? 0;
      final endInclusive = range?.endInclusive ?? entry.length - 1;
      final count = entry.length == 0 ? 0 : endInclusive - start + 1;

      response.headers.set(HttpHeaders.acceptRangesHeader, 'bytes');
      response.headers.set(HttpHeaders.contentTypeHeader, entry.contentType);
      // لا وسيط ولا متصفّح يخزّن محتوى مرخَّصًا مفكوكًا.
      response.headers.set(HttpHeaders.cacheControlHeader, 'no-store, no-cache');
      response.headers.contentLength = count;
      if (range != null) {
        response.statusCode = HttpStatus.partialContent;
        response.headers.set(
          HttpHeaders.contentRangeHeader,
          'bytes $start-$endInclusive/${entry.length}',
        );
      }

      if (method == 'HEAD' || count == 0) {
        await response.close();
        return;
      }

      await response.addStream(
        _crypto.decryptRange(
          entry.file,
          context: entry.context,
          start: start,
          end: endInclusive + 1,
        ),
      );
      await response.close();
    } catch (error) {
      // انقطاع المشغّل أثناء البثّ حالة طبيعية (قفزة، أو إغلاق الصفحة)، ولا
      // يجوز أن يُسقِط الخادم فيفقد بقيّة الجلسة.
      if (kDebugMode) debugPrint('local media source: $error');
      try {
        await response.close();
      } catch (_) {
        // إغلاق ثانٍ لاستجابة أُغلقت أو انقطعت. لا شيء يُسجَّل: هذا هو المسار
        // المتوقّع بعد انقطاع المشغّل، وتسجيله يعني سطرًا لكل قفزة مشاهدة.
      }
    }
  }

  /// يقرأ `Range: bytes=a-b` بنطاق واحد.
  ///
  /// النطاقات المتعدّدة غير مدعومة عن قصد: لا مشغّل وسائط يطلبها، ودعمها يعني
  /// `multipart/byteranges` بلا مستفيد.
  _ByteRange? _parseRange(String? header, int length) {
    if (header == null) return null;
    final match = RegExp(r'^bytes=(\d*)-(\d*)$').firstMatch(header.trim());
    if (match == null) return null;
    final rawStart = match.group(1) ?? '';
    final rawEnd = match.group(2) ?? '';
    if (rawStart.isEmpty && rawEnd.isEmpty) return null;

    int start;
    int endInclusive;
    if (rawStart.isEmpty) {
      // `bytes=-N` أي آخر N بايت.
      final suffix = int.parse(rawEnd);
      if (suffix == 0) return null;
      start = suffix >= length ? 0 : length - suffix;
      endInclusive = length - 1;
    } else {
      start = int.parse(rawStart);
      endInclusive = rawEnd.isEmpty ? length - 1 : int.parse(rawEnd);
      if (endInclusive >= length) endInclusive = length - 1;
    }
    if (start > endInclusive || start >= length) return null;
    return _ByteRange(start, endInclusive);
  }
}

class _ByteRange {
  const _ByteRange(this.start, this.endInclusive);
  final int start;
  final int endInclusive;
}

class _ServedPackage {
  const _ServedPackage({
    required this.file,
    required this.context,
    required this.contentType,
    required this.length,
  });

  final File file;
  final PackageContext context;
  final String contentType;
  final int length;
}
