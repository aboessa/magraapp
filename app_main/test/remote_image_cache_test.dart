/// يحرس عقد `RemoteImageCache`: مصدر القرص أوّلًا، والتحقق الشرطي، والإخلاء.
///
/// ## لماذا هذا الملف
///
/// `RemoteImageCache` هو العقد المقابل لنقل الصور إلى R2: بلا كاش قرصٍ كانت كلّ
/// صورة أُخرجت من الـAPK ستُعاد تنزيلها في كلّ جلسة. وأخطر انحدارٍ هنا صامت:
/// كسرُ مفتاح `sha256(url)` أو إسقاط `If-None-Match` لا يفشل أيّ بناء — فقط
/// يعيد التطبيق تنزيل كلّ شيء بصمت.
///
/// ## ما يُفحَص وما لا يُفحَص
///
/// تُحقَن كلّ الاعتماديات (عميل HTTP مزيّف، مجلد مؤقّت، ساعة ثابتة) فلا شبكة
/// ولا قنوات منصّة. `path_provider` لا يُمَسّ لأنّ `rootDir` مُمرَّر دائمًا.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/core/env/app_environment.dart';
import 'package:majarra/core/images/remote_image_cache.dart';

String _cdn(String path) => '${AppConfig.assetBaseUrl}$path';

/// عميل مزيّف يردّ ببايتات وترويسات مبرمجة لكلّ طلب، ويحفظ آخر طلب للفحص.
class _FakeImageClient extends http.BaseClient {
  _FakeImageClient({
    required this.body,
    this.status = 200,
    this.etag,
  });

  List<int> body;
  int status;
  String? etag;
  int sends = 0;
  Map<String, String> lastHeaders = const {};
  String lastUrl = '';

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends++;
    lastHeaders = Map<String, String>.from(request.headers);
    lastUrl = request.url.toString();
    final headers = <String, String>{};
    if (etag != null) headers['etag'] = etag!;
    return http.StreamedResponse(
      Stream.fromIterable([Uint8List.fromList(body)]),
      status,
      headers: headers,
    );
  }
}

/// عميلٌ يردّ [firstStatus] في أوّل طلب ثم 200 بالبايتات دائمًا.
///
/// لمسار «304 بلا ملفّ»: الطلب الأوّل المشروط يُقابَل بـ304 فيُسقَط الـ`ETag`
/// المتناقض، والطلب الثاني بلا شرط يُقابَل بـ200. و`onSecond` يثبت أنّ إعادة
/// المحاولة حدثت فعلًا لا أنّ الأوّل نجح.
class _FlipClient extends http.BaseClient {
  _FlipClient({
    required this.firstStatus,
    required this.body,
    required this.onSecond,
  });

  final int firstStatus;
  final List<int> body;
  final void Function() onSecond;
  int sends = 0;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends++;
    if (sends == 1) {
      return http.StreamedResponse(
        const Stream<List<int>>.empty(),
        firstStatus,
      );
    }
    onSecond();
    return http.StreamedResponse(
      Stream.fromIterable([Uint8List.fromList(body)]),
      200,
    );
  }
}

void main() {
  late Directory tempDir;

  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    tempDir = await Directory.systemTemp.createTemp('majarra_img_cache_test');
  });

  tearDown(() async {
    if (await tempDir.exists()) await tempDir.delete(recursive: true);
  });

  /// عميلٌ يردّ 304 مرّة واحدة (الـ`ETag` اليتيم) ثم 200 بالبايتات.
  ///
  /// يحاكي خادمًا حقيقيًّا: بعد إسقاط الشرط المتناقض تُعاد المحاولة بلا شرط
  /// فيردّ النسخة كاملة. عميلٌ يردّ 304 إلى الأبد كان سيُدخِل `fetch` في عودٍ
  /// لا نهائي — وهذا بالضبط ما يمنعه تصميم الاختبار هنا.
  RemoteImageCache cacheWith(_FakeImageClient client, {int? maxTotalBytes}) =>
      RemoteImageCache(
        httpClient: client,
        rootDir: tempDir,
        now: () => DateTime.utc(2026, 9, 10),
        maxTotalBytes: maxTotalBytes ?? 150 * 1024 * 1024,
      );

  final bytes = List<int>.generate(64, (i) => i);

  group('بوّابة القبول', () {
    test('يرفض غير الـCDN: مضيف أجنبي وhttp عادي', () {
      expect(
        RemoteImageCache.isCacheableUrl('https://evil-cdn.majarra.app/x.png'),
        isFalse,
        reason: 'مضيف يبدأ بالنطاق ولا يملكه',
      );
      expect(
        RemoteImageCache.isCacheableUrl('http://cdn.majarra.app/x.png'),
        isFalse,
      );
      expect(RemoteImageCache.isCacheableUrl('not-a-url'), isFalse);
      expect(
        RemoteImageCache.isCacheableUrl(_cdn('/public/avatars/luna.webp')),
        isTrue,
      );
    });

    test('يرفض الامتداد المجهول قبل أي شبكة', () async {
      final client = _FakeImageClient(body: bytes);
      final hit = await cacheWith(client).fetch(_cdn('/public/x.unknownext'));
      expect(hit, isNull);
      expect(client.sends, 0);
    });

    test('لا نطاق حرفيًّا في طبقة الكاش — المصدر `AppConfig` وحده', () {
      // `play_catalog_test.dart` يفحص `lib/` كلّها، وهذا تأكيدٌ موضعي يسمّي
      // البديل الصحيح عند الفشل.
      final source = File(
        'lib/core/images/remote_image_cache.dart',
      ).readAsStringSync();
      expect(source, contains('AppConfig.assetHost'));
      expect(source, isNot(contains('cdn.majarra.app')));
    });
  });

  group('مفتاح القرص', () {
    test('استعلام `?v=3` جزء من المفتاح لا معالجة خاصة', () {
      expect(
        RemoteImageCache.keyForUrl(_cdn('/a.png?v=3')),
        isNot(RemoteImageCache.keyForUrl(_cdn('/a.png'))),
      );
      // ثابت الطول مهما طال الـURL.
      expect(RemoteImageCache.keyForUrl(_cdn('/a.png')).length, 64);
    });

    test('الامتداد من مسار الـURL لا من `Content-Type`', () {
      expect(RemoteImageCache.extensionForUrl(_cdn('/a.svg?x=1')), '.svg');
      expect(RemoteImageCache.extensionForUrl(_cdn('/A.WEBP')), '.webp');
      expect(RemoteImageCache.extensionForUrl(_cdn('/a.jpeg')), '.jpg');
      expect(RemoteImageCache.extensionForUrl(_cdn('/a.bin')), '.bin');
    });
  });

  group('ترتيب المصادر: قرص ← شبكة ← لا شيء', () {
    test('الطلب الثاني يُقرأ من القرص بلا اتصال', () async {
      final client = _FakeImageClient(body: bytes, etag: '"v1"');
      final cache = cacheWith(client);
      final url = _cdn('/public/studio/cat.png');

      final first = await cache.fetch(url);
      expect(first, isNotNull);
      expect(first!.downloaded, isTrue);
      expect(await first.file.readAsBytes(), bytes);

      final second = await cache.fetch(url);
      expect(second, isNotNull);
      expect(second!.downloaded, isFalse);
      expect(second.revalidated, isFalse);
      expect(client.sends, 1, reason: 'الثاني من القرص بلا شبكة');
    });

    test('خطأ الشبكة يُعيد `null` ولا يرمي — العارض يرسم البديل', () async {
      final client = _FakeImageClient(body: bytes, status: 500);
      expect(
        await cacheWith(client).fetch(_cdn('/public/studio/cat.png')),
        isNull,
      );
    });

    test('ملفّ صفريّ ليس مخزّنًا: بقايا كتابة ميتة تُعاد من الشبكة', () async {
      final client = _FakeImageClient(body: bytes);
      final cache = cacheWith(client);
      final url = _cdn('/public/studio/cat.png');

      // بذرة: ملفّ صفريّ بالاسم المتوقَّع كما تتركه كتابةٌ ماتت في منتصفها.
      final key = RemoteImageCache.keyForUrl(url);
      await File('${tempDir.path}/$key.png').writeAsBytes([]);
      expect(await cache.fetch(url), isNotNull);
      expect(client.sends, 1);
    });
  });

  group('التحقق الشرطي `ETag`', () {
    test('الزيارة التالية تُرسل `If-None-Match` المحفوظ', () async {
      // عميلٌ بذاكرة: 200 مع البايتات في غياب الشرط، و304 عند مطابقته.
      final server = _FakeImageClient(body: bytes, etag: '"v1"');
      final cache = cacheWith(server);
      final url = _cdn('/public/studio/cat.png');

      expect(await cache.fetch(url), isNotNull);

      // الزيارة التالية: `fetch` يقرأ من القرص مباشرة بلا شبكة — وهي الحالة
      // الشائعة. والتحقق الشرطي يحدث فقط حين ضاع الملفّ وبقي الـ`ETag`.
      expect((await cache.fetch(url))!.downloaded, isFalse);
      expect(server.sends, 1);

      // إسقاط الصورة مع إبقاء الـ`ETag`: الآن يُرسَل `If-None-Match`.
      final key = RemoteImageCache.keyForUrl(url);
      await File('${tempDir.path}/$key.png').delete();
      server.status = 200;
      await cache.fetch(url);
      expect(server.lastHeaders['If-None-Match'], '"v1"');

      // و`304` مع ملفّ محلّي صالح تعني إعادة استعمال بلا كتابة.
      server.status = 304;
      server.body = [];
      final revalidated = await cache.fetch(url);
      expect(revalidated, isNotNull);
      expect(revalidated!.revalidated, isFalse,
          reason: 'الملفّ موجود: يُقرأ من القرص قبل أي شبكة');
    });

    test('`304` بلا ملفّ محلّي تناقض: يُسقَط الـ`ETag` ويُعاد التنزيل', () async {
      final server = _FakeImageClient(body: bytes, etag: '"v1"');
      final cache = cacheWith(server);
      final url = _cdn('/public/studio/orphan.png');
      await cache.fetch(url);

      final key = RemoteImageCache.keyForUrl(url);
      await File('${tempDir.path}/$key.png').delete();

      // خادمٌ يردّ 304 مرّة ثم 200: التناقض يُسقِط الشرط ويُعيد المحاولة.
      var calls = 0;
      final flip = _FlipClient(
        firstStatus: 304,
        body: bytes,
        onSecond: () => calls++,
      );
      final cache2 = RemoteImageCache(
        httpClient: flip,
        rootDir: tempDir,
        now: () => DateTime.utc(2026, 9, 10),
      );
      final hit = await cache2.fetch(url);
      expect(hit, isNotNull);
      expect(hit!.downloaded, isTrue);
      expect(calls, 1);
      expect(File('${tempDir.path}/$key.etag').existsSync(), isFalse,
          reason: 'الـ`ETag` اليتيم الذي أنتج 304 بلا ملفّ لا يُحتفَظ به');
    });
  });

  group('الإخلاء LRU بسقف البايتات', () {
    test('عند الامتلاء يُخلَى الأقلّ استعمالًا ويُكنَس الـ`etag` اليتيم', () async {
      final first = _FakeImageClient(body: List.filled(60, 1), etag: '"a"');
      final cache = cacheWith(first, maxTotalBytes: 100);
      final urlA = _cdn('/public/studio/a.png');
      final urlB = _cdn('/public/studio/b.png');

      expect(await cache.fetch(urlA), isNotNull);
      final keyA = RemoteImageCache.keyForUrl(urlA);
      expect(File('${tempDir.path}/$keyA.png').existsSync(), isTrue);

      // كتابة ثانية تتجاوز السقف (60 + 60 > 100): الأولى ضحيّة الإخلاء.
      final second = _FakeImageClient(body: List.filled(60, 2), etag: '"b"');
      final cache2 = RemoteImageCache(
        httpClient: second,
        rootDir: tempDir,
        now: () => DateTime.utc(2026, 9, 10, 0, 0, 1),
        maxTotalBytes: 100,
      );
      expect(await cache2.fetch(urlB), isNotNull);
      expect(File('${tempDir.path}/$keyA.png').existsSync(), isFalse,
          reason: 'الأقلّ استعمالًا يُخلَى أوّلًا');
      expect(File('${tempDir.path}/$keyA.etag').existsSync(), isFalse,
          reason: 'ملفّ `.etag` اليتيم بلا صورة يُكنَس معها');
    });

    test('ملفّ شاذ فوق `maxFileBytes` يُرفَض قبل الكتابة', () async {
      final client = _FakeImageClient(body: List.filled(200, 7));
      final cache = RemoteImageCache(
        httpClient: client,
        rootDir: tempDir,
        maxFileBytes: 100,
      );
      expect(await cache.fetch(_cdn('/public/studio/huge.png')), isNull);
      expect(
        tempDir.listSync().whereType<File>().where((f) => !f.path.endsWith('.etag')),
        isEmpty,
      );
    });
  });
}
