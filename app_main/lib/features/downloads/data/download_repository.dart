import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/crypto/file_crypto.dart';
import '../../../core/diagnostics/ignored_errors.dart';
import '../../../core/media/local_media_source.dart';
import '../domain/download_models.dart';

/// Persists download metadata and the encrypted media files (§3, §31).
///
/// Metadata (the [DownloadItem] list) lives in `shared_preferences` as JSON;
/// the media bytes live as AES-256-GCM ciphertext under [_directory]. The two
/// are kept consistent: deleting an item removes both its row and its file, and
/// a metadata row without a file is treated as failed rather than played.
///
/// Injectable throughout (prefs, crypto, directory) so the whole thing can be
/// unit tested against a temp directory with no plugins.
class DownloadRepository {
  DownloadRepository({
    required SharedPreferences prefs,
    required FileCrypto crypto,
    required Future<Directory> Function() directory,
    LocalMediaSource? mediaSource,
  }) : _prefs = prefs,
       _crypto = crypto,
       _directoryFn = directory,
       _mediaSource = mediaSource ?? LocalMediaSource(crypto: crypto);

  static const _metadataKey = 'majarra_downloads_v1';

  final SharedPreferences _prefs;
  final FileCrypto _crypto;
  final Future<Directory> Function() _directoryFn;
  final LocalMediaSource _mediaSource;

  List<DownloadItem> loadAll() =>
      DownloadItem.decodeList(_prefs.getString(_metadataKey));

  Future<void> saveAll(List<DownloadItem> items) async {
    await _prefs.setString(_metadataKey, DownloadItem.encodeList(items));
  }

  Future<Directory> _dir() async {
    final base = await _directoryFn();
    final dir = Directory('${base.path}/downloads');
    if (!await dir.exists()) await dir.create(recursive: true);
    return dir;
  }

  Future<File> fileFor(DownloadItem item) async {
    final dir = await _dir();
    return File('${dir.path}/${item.fileName}');
  }

  /// السياق الذي تُربَط به الحزمة تشفيريًّا (`ENC-006`).
  ///
  /// نسخ ملف من ملف طفل إلى آخر، أو استخدامه لمحتوى آخر، يفشل بعد هذا الربط
  /// حتى بالمفتاح الصحيح — والرفض تشفيري لا اعتمادًا على منطق التطبيق.
  PackageContext contextFor(DownloadItem item) => PackageContext(
    contentType: item.contentType,
    contentId: item.id,
    childId: item.childId,
  );

  /// يفتح كاتبًا يشفّر أثناء التنزيل مباشرة (`ENC-003`).
  ///
  /// الملف الجزئي هو نفسه الحزمة النهائية ناقصةَ أجزائها الأخيرة، فلا نصّ صريح
  /// على القرص في أي لحظة. [resume] يستأنف من آخر جزء كامل.
  Future<ChunkedPackageWriter> openEncryptingWriter(
    DownloadItem item, {
    required bool resume,
  }) async {
    final part = await partFileFor(item);
    return ChunkedPackageWriter.open(
      _crypto,
      part,
      context: contextFor(item),
      resume: resume,
    );
  }

  /// موضع الاستئناف بالنصّ الصريح: طول ما ثُبِّت من أجزاء كاملة.
  ///
  /// يُقصّ أي إطار ناقص من انقطاع سابق، فما يُطلَب من الخادم يبدأ من حدّ جزء.
  Future<int> resumeOffsetFor(DownloadItem item) async {
    final part = await partFileFor(item);
    if (!await part.exists()) return 0;
    final writer = await openEncryptingWriter(item, resume: true);
    final offset = writer.plainOffset;
    await writer.close();
    return offset;
  }

  /// يرقّي الحزمة الجزئية المكتملة إلى ملف التنزيل النهائي. يُعيد الحجم.
  ///
  /// النقل بالاسم لا بإعادة الكتابة: الملف مشفَّر أصلًا، ونسخه مرة أخرى كان
  /// سيضاعف المساحة المطلوبة لحظيًّا ويعيد كلفة قراءة نصف جيجابايت.
  Future<int> promoteCompletedPart(DownloadItem item) async {
    final part = await partFileFor(item);
    final target = await fileFor(item);
    if (await target.exists()) await target.delete();
    await part.rename(target.path);
    return target.existsSync() ? await target.length() : 0;
  }

  /// يتحقّق أن مفتاح التشفير متاح فعلًا (`ENC-011`).
  ///
  /// يرفع [SecureStorageUnavailableException] إن كان مخزن المنصّة الآمن
  /// معطّلًا، فيرفض المتصل التنزيل بدل أن يُنتج ملفًا لا يُفَك.
  Future<void> ensureEncryptionKeyAvailable() => _crypto.ensureKeyAvailable();

  Future<bool> hasFile(DownloadItem item) async {
    final file = await fileFor(item);
    return file.exists();
  }

  /// يجهّز [item] للتشغيل ويُعيد رابطًا محليًّا يقرأ منه المشغّل.
  ///
  /// ## ENC-004 — ما تغيّر
  ///
  /// كان يفكّ الحزمة إلى `.play_<id>.mp4` صريح على القرص. مع غياب DRM (قرار
  /// مالك) صار ذلك أسهل طريق استخراج في المنظومة. الآن تُفَك البايتات في
  /// الذاكرة جزءًا جزءًا وتُقدَّم على `127.0.0.1` بمسار سرّي — لا بايت صريح
  /// يلمس القرص. التفصيل في `core/media/local_media_source.dart`.
  Future<Uri> playbackSourceFor(DownloadItem item) async {
    final source = await fileFor(item);
    return _mediaSource.serve(
      package: source,
      context: contextFor(item),
      contentType: _contentTypeFor(item),
    );
  }

  /// يوقف تقديم رابط تشغيل سُلِّم سابقًا.
  Future<void> releasePlaybackSource(Uri uri) => _mediaSource.release(uri);

  /// نوع المحتوى كما يحتاجه المشغّل قبل قراءة البايتات.
  ///
  /// ExoPlayer يختار الحاوية من الترويسة، و`octet-stream` تجعله يرفض ملفًا
  /// سليمًا. فالنوع يُشتقّ من نوع المحتوى لا يُترك عامًّا.
  String _contentTypeFor(DownloadItem item) {
    switch (item.contentType) {
      case 'episode':
        return 'video/mp4';
      case 'audio_story':
        return 'audio/mp4';
      default:
        return 'application/octet-stream';
    }
  }

  Future<File> partFileFor(DownloadItem item) async {
    final dir = await _dir();
    return File('${dir.path}/${item.id}.part');
  }

  Future<void> deleteFile(DownloadItem item) async {
    final dir = await _dir();
    final files = <File>[
      File('${dir.path}/${item.fileName}'),
      File('${dir.path}/${item.id}.part'),
      File('${dir.path}/.play_${item.id}${_extensionFor(item)}'),
    ];
    Object? firstError;
    StackTrace? firstStack;
    for (final file in files) {
      try {
        if (await file.exists()) await file.delete();
      } catch (error, stack) {
        firstError ??= error;
        firstStack ??= stack;
      }
    }
    if (firstError != null) {
      Error.throwWithStackTrace(firstError, firstStack!);
    }
  }

  /// Authoritatively removes downloads for one accepted child deletion.
  ///
  /// The caller must await `DownloadManager.shutdown()` first so no in-flight
  /// snapshot or file write can recreate deleted state. Other children's rows
  /// and files, and the shared master key, remain intact.
  Future<void> deleteAllForChild(String childId) async {
    final normalizedChildId = childId.trim();
    if (normalizedChildId.isEmpty) return;

    late final List<DownloadItem> items;
    try {
      items = loadAll();
    } catch (_) {
      throw StateError('Child download removal failed');
    }

    final retained = <DownloadItem>[];
    var matchedTarget = false;
    var removedTarget = false;
    var failed = false;
    for (final item in items) {
      if (item.childId != normalizedChildId) {
        retained.add(item);
        continue;
      }

      matchedTarget = true;
      try {
        await deleteFile(item);
        removedTarget = true;
      } catch (_) {
        failed = true;
        retained.add(item);
      }
    }
    if (!matchedTarget) return;

    var preferenceFailed = false;
    if (removedTarget) {
      try {
        bool persisted;
        if (retained.isEmpty) {
          persisted =
              !_prefs.containsKey(_metadataKey) ||
              await _prefs.remove(_metadataKey);
        } else {
          persisted = await _prefs.setString(
            _metadataKey,
            DownloadItem.encodeList(retained),
          );
        }
        if (!persisted) preferenceFailed = true;
      } catch (_) {
        preferenceFailed = true;
      }
    }

    if (preferenceFailed) {
      failed = true;
      await _reloadPreferencesAfterFailure();
    }
    if (failed) throw StateError('Child download removal failed');
  }

  Future<void> cleanupPlayFiles() async {
    // Web builds do not persist downloads in this dart:io repository. Avoid
    // invoking path_provider's unsupported application-support directory while
    // the session teardown continues with metadata and key removal in wipeAll.
    if (kIsWeb) return;

    final dir = await _dir();
    if (!await dir.exists()) return;
    await for (final entity in dir.list()) {
      final name = entity.uri.pathSegments.isEmpty
          ? ''
          : entity.uri.pathSegments.last;
      if (entity is File && name.startsWith('.play_')) {
        try {
          await entity.delete();
        } catch (error) {
          // ملف تشغيل مؤقّت قد يكون مفتوحًا الآن من مشغّل آخر، وحذفه يفشل على
          // Windows بذلك. لا يُرفَع: التنظيف يمرّ على البقيّة ويعود في المرّة
          // القادمة. ويُسجَّل لأن تكراره يعني ملفات مفكوكة تتراكم على القرص.
          reportIgnoredError('download_repository.playback_cleanup', error);
        }
      }
    }
  }

  /// Total bytes stored on disk across all downloaded files.
  Future<int> totalBytesOnDisk() async {
    final dir = await _dir();
    if (!await dir.exists()) return 0;
    var total = 0;
    await for (final entity in dir.list()) {
      if (entity is File && !entity.path.contains('/.play_')) {
        total += await entity.length();
      }
    }
    return total;
  }

  Future<void> deletePlayFile(DownloadItem item) async {
    final play = File(
      '${(await _dir()).path}/.play_${item.id}${_extensionFor(item)}',
    );
    if (await play.exists()) await play.delete();
  }

  /// Removes every stored file and clears metadata. Used on sign-out.
  Future<void> wipeAll() async {
    var failed = false;
    // Filesystem downloads are native-only. Web still has to clear the
    // account-scoped metadata and encryption key below.
    if (!kIsWeb) {
      try {
        final dir = await _dir();
        if (await dir.exists()) await dir.delete(recursive: true);
      } catch (_) {
        failed = true;
      }
    }

    var preferenceFailed = false;
    try {
      if (_prefs.containsKey(_metadataKey) &&
          !await _prefs.remove(_metadataKey)) {
        preferenceFailed = true;
      }
    } catch (_) {
      preferenceFailed = true;
    }

    try {
      await _crypto.wipeMasterKey();
    } catch (_) {
      failed = true;
    }

    if (preferenceFailed) {
      failed = true;
      await _reloadPreferencesAfterFailure();
    }
    if (failed) throw StateError('Download data removal failed');
  }

  Future<void> _reloadPreferencesAfterFailure() async {
    try {
      await _prefs.reload();
    } catch (_) {
      // The generic failure remains retryable by the teardown caller.
    }
  }

  String _extensionFor(DownloadItem item) {
    switch (item.contentType) {
      case 'episode':
        return '.mp4';
      case 'audio_story':
        return '.m4a';
      default:
        return '.bin';
    }
  }
}
