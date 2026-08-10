import 'dart:io';
import 'dart:typed_data';

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
  })  : _prefs = prefs,
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

  Future<void> deleteFile(DownloadItem item) async {
    final file = await fileFor(item);
    if (await file.exists()) await file.delete();
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

  /// Removes every stored file and clears metadata. Used on sign-out.
  Future<void> wipeAll() async {
    final dir = await _dir();
    if (await dir.exists()) await dir.delete(recursive: true);
    await _prefs.remove(_metadataKey);
    await _crypto.wipeMasterKey();
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
