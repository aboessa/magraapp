import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/crypto/file_crypto.dart';
import 'package:majarra/core/media/local_media_source.dart';

import 'support/fake_secure_storage.dart';

/// ENC-004 — تشغيل بلا ملف صريح على القرص.
///
/// ## العلّة التي تثبّتها هذه الاختبارات
///
/// كان التشغيل يفكّ الحزمة إلى `.play_<id>.mp4` صريح ويسلّمه للمشغّل — ممنوع في
/// §12 من الخطة، وصار بعد قرار «بلا DRM» أسهل طريق استخراج في المنظومة كلها.
///
/// الآن تُفَك البايتات في الذاكرة وتُقدَّم على `127.0.0.1` بمسار سرّي. وهذه
/// الاختبارات تشغّل الخادم فعلًا وتطلب منه عبر HTTP حقيقي: القفز، والترويسات،
/// ورفض المسار المجهول.

const _context = PackageContext(
  contentType: 'episode',
  contentId: 'ep-1',
  childId: 'child-1',
);

late Directory tempDir;
late FileCrypto crypto;
late LocalMediaSource source;
late File package;
late Uint8List plain;

Uint8List _bytes(int length) {
  final random = Random(3);
  return Uint8List.fromList(List<int>.generate(length, (_) => random.nextInt(256)));
}

Future<HttpClientResponse> _get(Uri uri, {String? range, String method = 'GET'}) async {
  final client = HttpClient();
  try {
    final request = await client.openUrl(method, uri);
    if (range != null) request.headers.set(HttpHeaders.rangeHeader, range);
    return await request.close();
  } finally {
    client.close(force: false);
  }
}

void main() {
  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('majarra_media_test');
    crypto = FileCrypto(storage: FakeSecureStorage());
    source = LocalMediaSource(crypto: crypto);
    plain = _bytes(9000);
    package = File('${tempDir.path}/ep-1.enc');
    await crypto.encryptStreamToFile(
      Stream.value(plain),
      package,
      context: _context,
      chunkSize: 2048,
    );
  });

  tearDown(() async {
    await source.stop();
    if (await tempDir.exists()) await tempDir.delete(recursive: true);
  });

  Future<Uri> serve() => source.serve(
    package: package,
    context: _context,
    contentType: 'video/mp4',
  );

  group('التقديم', () {
    test('الرابط على loopback بمنفذ يختاره النظام ومسار سرّي', () async {
      final uri = await serve();
      expect(uri.host, '127.0.0.1');
      expect(uri.port, greaterThan(0));
      // 128 بت مُهيَّأة كسلسلة ست عشرية: لا سبيل لتخمينها من تطبيق آخر على
      // الجهاز — وهو الحدّ الأمني الوحيد المتاح على loopback في Android.
      expect(uri.pathSegments.single.length, 32);
      expect(uri.pathSegments.single, matches(RegExp(r'^[0-9a-f]{32}$')));
    });

    test('طلب كامل يُعيد النصّ الصريح كما هو', () async {
      final response = await _get(await serve());
      expect(response.statusCode, HttpStatus.ok);
      expect(response.headers.contentType?.mimeType, 'video/mp4');
      // النوع لازم: ExoPlayer يختار الحاوية من الترويسة قبل قراءة البايتات.
      expect(response.headers.value(HttpHeaders.acceptRangesHeader), 'bytes');
      // لا وسيط يخزّن محتوى مرخَّصًا مفكوكًا.
      expect(response.headers.value(HttpHeaders.cacheControlHeader), contains('no-store'));
      expect(response.contentLength, plain.length);

      final received = await response.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      expect(received, equals(plain));
    });

    test('HEAD يُعيد الطول بلا بايتات', () async {
      // المشغّل يسأل عن الطول أولًا؛ إجابة خاطئة تعني شريط تقدّم كاذبًا.
      final response = await _get(await serve(), method: 'HEAD');
      expect(response.statusCode, HttpStatus.ok);
      expect(response.contentLength, plain.length);
      expect(await response.isEmpty, isTrue);
    });
  });

  group('القفز', () {
    test('نطاق في منتصف الملف يُعيد 206 والبايتات الصحيحة', () async {
      // هذا ما يجعل القفز ممكنًا بلا فكّ الملف من أوّله — ثمرة الصيغة
      // المقسَّمة (`ENC-006`).
      final response = await _get(await serve(), range: 'bytes=5000-5999');
      expect(response.statusCode, HttpStatus.partialContent);
      expect(response.contentLength, 1000);
      expect(
        response.headers.value(HttpHeaders.contentRangeHeader),
        'bytes 5000-5999/9000',
      );
      final received = await response.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      expect(received, equals(plain.sublist(5000, 6000)));
    });

    test('نطاق مفتوح النهاية يُكمل إلى آخر الملف', () async {
      final response = await _get(await serve(), range: 'bytes=8500-');
      expect(response.statusCode, HttpStatus.partialContent);
      final received = await response.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      expect(received, equals(plain.sublist(8500)));
    });

    test('نطاق لاحق `bytes=-N` يُعيد آخر N بايت', () async {
      final response = await _get(await serve(), range: 'bytes=-100');
      expect(response.statusCode, HttpStatus.partialContent);
      final received = await response.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      expect(received, equals(plain.sublist(plain.length - 100)));
    });

    test('نطاق يبدأ داخل جزء لا على حدّه', () async {
      // حجم الجزء 2048؛ البداية 100 داخل الجزء الأول والنهاية داخل الثالث.
      final response = await _get(await serve(), range: 'bytes=100-5000');
      final received = await response.fold<List<int>>(<int>[], (a, b) => a..addAll(b));
      expect(received, equals(plain.sublist(100, 5001)));
    });

    test('نطاق خارج الملف يُعيد 416 لا محتوى فارغًا', () async {
      // 200 بجسم فارغ يجعل المشغّل يظن الملف انتهى، فيتوقف بلا رسالة.
      final response = await _get(await serve(), range: 'bytes=99999-');
      expect(response.statusCode, HttpStatus.requestedRangeNotSatisfiable);
      expect(
        response.headers.value(HttpHeaders.contentRangeHeader),
        'bytes */9000',
      );
      await response.drain<void>();
    });
  });

  group('الحدود', () {
    test('مسار مجهول يُعيد 404', () async {
      final uri = await serve();
      final wrong = uri.replace(path: '/${'0' * 32}');
      final response = await _get(wrong);
      expect(response.statusCode, HttpStatus.notFound);
      await response.drain<void>();
    });

    test('طريقة غير GET/HEAD تُرفَض', () async {
      final response = await _get(await serve(), method: 'POST');
      expect(response.statusCode, HttpStatus.methodNotAllowed);
      await response.drain<void>();
    });

    test('إيقاف الرابط يُبطله ويُغلق الخادم عند آخر رابط', () async {
      final uri = await serve();
      expect(source.isRunning, isTrue);
      await source.release(uri);
      // منفذ يبقى مفتوحًا بعد التشغيل ومسار يبقى صالحًا = سطح تعرّض بلا سبب.
      expect(source.isRunning, isFalse);
    });

    test('رابطان يعملان معًا، وإغلاق أحدهما لا يُسقط الآخر', () async {
      final first = await serve();
      final second = await serve();
      expect(first.pathSegments.single, isNot(second.pathSegments.single));

      await source.release(first);
      expect(source.isRunning, isTrue);
      final response = await _get(second);
      expect(response.statusCode, HttpStatus.ok);
      await response.drain<void>();

      final gone = await _get(first);
      expect(gone.statusCode, HttpStatus.notFound);
      await gone.drain<void>();
    });
  });

  group('لا نصّ صريح على القرص', () {
    test('التشغيل كاملًا لا يُنشئ ملفًا في مجلد الحزمة', () async {
      // معيار القبول الجوهري: ما كان يُكتب هو `.play_*` كامل القراءة.
      final before = tempDir.listSync().map((e) => e.path).toSet();

      final uri = await serve();
      final response = await _get(uri);
      await response.drain<void>();
      await source.release(uri);

      expect(tempDir.listSync().map((e) => e.path).toSet(), before);
      // والحزمة نفسها ما زالت مشفَّرة: أوّل بايتاتها ترويسة الصيغة لا محتوى.
      final head = await package.openRead(0, 4).first;
      expect(utf8.decode(head), 'MJR1');
    });
  });

  group('طول النصّ الصريح', () {
    test('يُحسب من الملف بلا فكّ ولا مفتاح', () async {
      expect(await crypto.plainLengthOf(package), plain.length);
    });

    test('يصحّ عند حجم مضاعف تمامًا لحجم الجزء', () async {
      final exact = File('${tempDir.path}/exact.enc');
      await crypto.encryptStreamToFile(
        Stream.value(_bytes(4096)),
        exact,
        context: _context,
        chunkSize: 2048,
      );
      expect(await crypto.plainLengthOf(exact), 4096);
    });

    test('يصحّ للصيغة القديمة أيضًا', () async {
      // تنزيلات ما قبل `ENC-006` ما زالت على أجهزة المستخدمين.
      final legacy = File('${tempDir.path}/legacy.enc');
      final small = _bytes(500);
      final key = await crypto.masterKey();
      final algorithm = AesGcm.with256bits();
      final box = await algorithm.encrypt(
        small,
        secretKey: key,
        nonce: algorithm.newNonce(),
      );
      await legacy.writeAsBytes(box.concatenation(), flush: true);
      expect(await crypto.plainLengthOf(legacy), small.length);
    });
  });
}
