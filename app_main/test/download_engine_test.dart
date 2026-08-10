import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/core/crypto/file_crypto.dart';
import 'package:majarra/features/downloads/application/download_manager.dart';
import 'package:majarra/features/downloads/data/download_repository.dart';
import 'package:majarra/features/downloads/domain/download_models.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A fake streamed http client that returns fixed bytes for any request.
class _FakeClient extends http.BaseClient {
  _FakeClient(this.body);
  final List<int> body;
  int sends = 0;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    sends++;
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
    test('encrypt then decrypt round-trips the bytes', () async {
      final crypto = FileCrypto();
      final plain = Uint8List.fromList(utf8.encode('hello majarra offline'));
      final file = File('${tempDir.path}/x.enc');
      await crypto.encryptBytesToFile(plain, file);

      // On-disk bytes must not equal the plaintext.
      final onDisk = await file.readAsBytes();
      expect(onDisk, isNot(equals(plain)));

      final decrypted = await crypto.decryptFile(file);
      expect(decrypted, equals(plain));
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

      // The stored file is ciphertext, and preparePlayback decrypts it back.
      final playbackPath = await manager.preparePlayback('dl1');
      expect(playbackPath, isNotNull);
      final decrypted = await File(playbackPath!).readAsBytes();
      expect(decrypted, equals(payload));
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
