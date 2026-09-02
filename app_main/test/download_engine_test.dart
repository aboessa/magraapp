import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/core/crypto/file_crypto.dart';
import 'package:majarra/core/crypto/streaming_digest.dart';
import 'package:majarra/features/downloads/application/download_manager.dart';
import 'package:majarra/features/downloads/data/download_repository.dart';
import 'package:majarra/features/downloads/domain/download_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fake_secure_storage.dart';

/// A fake streamed http client that returns fixed bytes for any request.
class _FakeClient extends http.BaseClient {
  _FakeClient(this.body);
  final List<int> body;
  int sends = 0;

  /// آخر ترويسات ورابط، لفحص أن القدرة تسافر في ترويسة (`ENC-008`).
  Map<String, String> lastHeaders = const {};
  String lastUrl = '';

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends++;
    lastHeaders = Map<String, String>.from(request.headers);
    lastUrl = request.url.toString();
    return http.StreamedResponse(
      Stream.fromIterable([body]),
      200,
      contentLength: body.length,
    );
  }
}

void main() {
  late Directory tempDir;

  setUp(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    FlutterSecureStorage.setMockInitialValues({});
    tempDir = await Directory.systemTemp.createTemp('majarra_dl_test');
  });

  tearDown(() async {
    if (await tempDir.exists()) await tempDir.delete(recursive: true);
  });

  Future<DownloadRepository> buildRepo() async {
    final prefs = await SharedPreferences.getInstance();
    return DownloadRepository(
      prefs: prefs,
      crypto: FileCrypto(),
      directory: () async => tempDir,
    );
  }

  group('formatBytes', () {
    test('formats across units', () {
      expect(formatBytes(0), '0 ب');
      expect(formatBytes(512), contains('ب'));
      expect(formatBytes(2048), contains('ك.ب'));
      expect(formatBytes(5 * 1024 * 1024), contains('م.ب'));
    });
  });

  group('DownloadItem json + expiry', () {
    test('round-trips through json', () {
      const item = DownloadItem(
        id: 'a', childId: 'c1', contentType: 'audio_story',
        title: 't', subtitle: 's', sourceUrl: 'https://x/y.m4a',
        fileName: 'a.enc', status: DownloadStatus.ready,
        receivedBytes: 10, totalBytes: 10, createdAt: 1, expiresAt: 999,
      );
      final back = DownloadItem.fromJson(
        jsonDecode(jsonEncode(item.toJson())) as Map<String, Object?>,
      );
      expect(back.id, 'a');
      expect(back.status, DownloadStatus.ready);
      expect(back.expiresAt, 999);
    });

    test('isExpired compares against expiry', () {
      const item = DownloadItem(
        id: 'a', childId: 'c1', contentType: 'audio_story', title: 't',
        subtitle: 's', sourceUrl: 'u', fileName: 'a.enc',
        status: DownloadStatus.ready, receivedBytes: 1, totalBytes: 1,
        createdAt: 0, expiresAt: 1000,
      );
      expect(item.isExpired(DateTime.fromMillisecondsSinceEpoch(500)), isFalse);
      expect(item.isExpired(DateTime.fromMillisecondsSinceEpoch(2000)), isTrue);
    });
  });

  group('FileCrypto', () {
    // ENC-006: الواجهة صارت تدفقية ومربوطة بسياق. الاختبار المفصَّل للصيغة —
    // الأجزاء وAAD والتلاعب والـnonce — في `file_crypto_chunked_test.dart`،
    // وهذا يبقي التحقّق الأساسي هنا حيث بقية محرّك التنزيل.
    //
    // والمخزن مُحاكى الآن بدل الإضافة الحقيقية: كان الاختبار يمرّ عبر مسار
    // «فشل المخزن مكتوم» نفسه الذي يُنتج في الإنتاج تنزيلات لا تُفَك
    // (`ENC-011`)، لأن الإضافة غير مسجَّلة في اختبار الوحدة.
    test('encrypt then decrypt round-trips the bytes', () async {
      final crypto = FileCrypto(storage: FakeSecureStorage());
      final plain = Uint8List.fromList(utf8.encode('hello majarra offline'));
      final file = File('${tempDir.path}/x.enc');
      const context = PackageContext(
        contentType: 'episode',
        contentId: 'x',
        childId: 'child-1',
      );
      await crypto.encryptStreamToFile(Stream.value(plain), file, context: context);

      // On-disk bytes must not equal the plaintext.
      final onDisk = await file.readAsBytes();
      expect(onDisk, isNot(equals(plain)));

      final decrypted = await crypto.decryptToBytes(file, context: context);
      expect(decrypted, equals(plain));
    });
  });

  group('ENC-007 — سلامة ما نُزِّل', () {
    DownloadAuthorization authorization(String? sha) => DownloadAuthorization(
      licenceId: 'lic-1',
      licenceToken: 'token',
      url: 'https://api.majarra.app/api/v1/media/assets/asset-1',
      authorization: 'Bearer capability',
      sourceSha256: sha,
    );

    test('البصمة التدفّقية تطابق الحساب على مصفوفة واحدة', () {
      final payload = utf8.encode('the-audio-bytes');
      final streaming = StreamingDigest();
      // أجزاء بأحجام تعسّفية كما تُسلّمها الشبكة.
      streaming.add(payload.sublist(0, 3));
      streaming.add(payload.sublist(3, 4));
      streaming.add(payload.sublist(4));
      expect(streaming.hex(), sha256.convert(payload).toString());
    });

    test('بصمة غير مطابقة تُفشل التنزيل ولا تُظهره جاهزًا', () async {
      // TLS وETag لا يكفيان: استجابة مقطوعة يقبلها الطرفان كـ200 تُخزَّن
      // مشفَّرة وتُعتبر سليمة، ثم تفشل عند التشغيل بعد أيام بلا سبب ظاهر.
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(utf8.encode('the-audio-bytes')),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
        authorize: (_) async => authorization('0' * 64),
      );

      expect(await manager.enqueue(_req()), DownloadRejection.none);
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.failed);
      expect(manager.byId('dl1')!.status, DownloadStatus.failed);
      // ولا حزمة جزئية تبقى: البناء عليها في محاولة تالية يعني استئنافًا فوق
      // بايتات خطأ.
      expect(File('${tempDir.path}/downloads/dl1.part').existsSync(), isFalse);
    });

    test('بصمة مطابقة تُكمل التنزيل', () async {
      final payload = utf8.encode('the-audio-bytes');
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(payload),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
        authorize: (_) async => authorization(sha256.convert(payload).toString()),
      );

      expect(await manager.enqueue(_req()), DownloadRejection.none);
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.ready);
      expect(manager.byId('dl1')!.status, DownloadStatus.ready);
    });

    test('غياب البصمة يُقبل ولا يُعامَل كعدم تطابق', () async {
      // كثير من الأصول القائمة بلا بصمة (30 صوتيًّا، 16 منها فقط لها بصمة)،
      // ورفضها كان سيمنع تنزيل محتوى سليم منشور.
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(utf8.encode('bytes')),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
        authorize: (_) async => authorization(null),
      );

      expect(await manager.enqueue(_req()), DownloadRejection.none);
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.ready);
      expect(manager.byId('dl1')!.status, DownloadStatus.ready);
    });

    test('القدرة تُرسَل في ترويسة لا في سلسلة استعلام', () async {
      // ENC-008: سلسلة الاستعلام تظهر في السجلات وتاريخ الوسائط.
      final repo = await buildRepo();
      final client = _FakeClient(utf8.encode('bytes'));
      final manager = DownloadManager(
        repository: repo,
        client: client,
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
        authorize: (_) async => authorization(null),
      );
      await manager.enqueue(_req());
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.ready);

      expect(client.lastHeaders['Authorization'], 'Bearer capability');
      expect(client.lastUrl, isNot(contains('token=')));
    });
  });

  group('DownloadManager gating', () {
    test('refuses when not entitled', () async {
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(utf8.encode('data')),
        isEntitled: () async => false,
        networkAllowsDownload: () async => true,
      );
      final result = await manager.enqueue(_req());
      expect(result, DownloadRejection.notEntitled);
      expect(manager.state, isEmpty);
    });

    test('refuses when offline / metered', () async {
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(utf8.encode('data')),
        isEntitled: () async => true,
        networkAllowsDownload: () async => false,
      );
      expect(await manager.enqueue(_req()), DownloadRejection.offlineOrMetered);
    });

    test('refuses an empty source', () async {
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(const []),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
      );
      expect(
        await manager.enqueue(_req(url: '')),
        DownloadRejection.noSource,
      );
    });
  });

  group('DownloadManager lifecycle', () {
    test('downloads, encrypts, becomes ready and is playable', () async {
      final repo = await buildRepo();
      final payload = utf8.encode('the-audio-bytes');
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(payload),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
      );

      final result = await manager.enqueue(_req());
      expect(result, DownloadRejection.none);

      // Let the async download complete.
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.ready);

      final item = manager.byId('dl1')!;
      expect(item.status, DownloadStatus.ready);
      expect(item.expiresAt, isNotNull);

      // ENC-004: `preparePlayback` لم يعد يُعيد مسار ملف صريح — يُعيد رابطًا
      // محليًّا على loopback يفكّ الأجزاء عند الطلب، فلا نصّ صريح على القرص.
      final playbackSource = await manager.preparePlayback('dl1');
      expect(playbackSource, isNotNull);
      final uri = Uri.parse(playbackSource!);
      expect(uri.scheme, 'http');
      expect(uri.host, '127.0.0.1');

      // البايتات نفسها تُتحقَّق عبر HTTP حقيقي في `local_media_source_test.dart`:
      // `TestWidgetsFlutterBinding` يستبدل `HttpClient` فيُعيد 400 لكل طلب،
      // فالتحقّق الشبكي مكانه مجموعة لا تستعمل هذا الربط. هنا نتحقّق أن ما
      // يُقدَّم هو الحزمة الصحيحة، من طبقة التشفير مباشرة.
      final stored = await repo.fileFor(item);
      final onDisk = await stored.readAsBytes();
      expect(onDisk, isNot(equals(payload)), reason: 'ما على القرص مشفَّر');
      expect(
        await FileCrypto().decryptToBytes(stored, context: repo.contextFor(item)),
        equals(payload),
      );

      // ولا ملف تشغيل صريح في مجلد التنزيلات — وهو ما كان يُكتب سابقًا.
      final playFiles = Directory('${tempDir.path}/downloads')
          .listSync()
          .where((entity) => entity.path.contains('.play_'));
      expect(playFiles, isEmpty);

      await manager.cleanupPlaybackFile('dl1');
    });

    test('delete removes the item and its file', () async {
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(utf8.encode('bytes')),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
      );
      await manager.enqueue(_req());
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.ready);

      await manager.delete('dl1');
      expect(manager.byId('dl1'), isNull);
    });

    test('a ready-but-expired item is not playable', () async {
      final repo = await buildRepo();
      final manager = DownloadManager(
        repository: repo,
        client: _FakeClient(utf8.encode('bytes')),
        isEntitled: () async => true,
        networkAllowsDownload: () async => true,
        offlineLicenseDuration: Duration.zero, // expires immediately.
      );
      await manager.enqueue(_req());
      await _pumpUntil(() => manager.byId('dl1')?.status == DownloadStatus.ready);

      final path = await manager.preparePlayback('dl1');
      expect(path, isNull);
      expect(manager.byId('dl1')?.status, DownloadStatus.expired);
    });
  });
}

DownloadRequest _req({String url = 'https://api.majarra.app/sample.m4a'}) =>
    DownloadRequest(
      id: 'dl1',
      childId: 'c1',
      contentType: 'audio_story',
      title: 'قصة',
      subtitle: 'عيّنة',
      sourceUrl: url,
    );

Future<void> _pumpUntil(bool Function() condition, {int maxTicks = 50}) async {
  for (var i = 0; i < maxTicks; i++) {
    if (condition()) return;
    await Future<void>.delayed(const Duration(milliseconds: 20));
  }
}
