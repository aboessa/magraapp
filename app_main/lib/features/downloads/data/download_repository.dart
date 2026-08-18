import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/crypto/file_crypto.dart';
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
  }) : _prefs = prefs,
       _crypto = crypto,
       _directoryFn = directory;

  static const _metadataKey = 'majarra_downloads_v1';

  final SharedPreferences _prefs;
  final FileCrypto _crypto;
  final Future<Directory> Function() _directoryFn;

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

  /// Encrypts and stores [bytes] for [item]. Returns the on-disk size.
  Future<int> writeEncrypted(DownloadItem item, Uint8List bytes) async {
    final file = await fileFor(item);
    await _crypto.encryptBytesToFile(bytes, file);
    return file.existsSync() ? await file.length() : 0;
  }

  Future<bool> hasFile(DownloadItem item) async {
    final file = await fileFor(item);
    return file.exists();
  }

  /// Decrypts [item] to a temporary plaintext file for playback, returning it.
  /// The caller must delete it when playback finishes.
  Future<File> decryptForPlayback(DownloadItem item) async {
    final dir = await _dir();
    final source = await fileFor(item);
    final temp = File('${dir.path}/.play_${item.id}${_extensionFor(item)}');
    await _crypto.decryptFileToFile(source, temp);
    return temp;
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
        } catch (_) {}
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
