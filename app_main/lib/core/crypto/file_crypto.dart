import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// AES-256-GCM encryption for downloaded media at rest (§3, §32).
///
/// ## Why encrypt downloads
///
/// A downloaded episode or story is licensed content. Writing it to disk as a
/// plain `.mp4`/`.m4a` would let any file browser copy it out of the app
/// sandbox and share it freely. This layer encrypts every downloaded file with
/// AES-256-GCM under a key the app holds, so a file lifted off the device is
/// ciphertext. This is confidentiality-at-rest, NOT DRM: a determined user with
/// the running app can still reach the plaintext, and the honest claim is
/// "encrypted local storage", not "copy protection".
///
/// The primitive is the platform/BoringSSL-backed [AesGcm] from the
/// `cryptography` package — no hand-rolled crypto. Each file gets a fresh random
/// 96-bit nonce, stored alongside the ciphertext, and GCM's authentication tag
/// detects any tampering on decrypt (integrity validation).
class FileCrypto {
  FileCrypto({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _masterKeyStorageKey = 'majarra_download_master_key_v1';
  static const _nonceLength = 12; // 96-bit GCM nonce.

  final FlutterSecureStorage _storage;
  final AesGcm _algorithm = AesGcm.with256bits();

  SecretKey? _cachedKey;

  /// The app-managed master key, created on first use and kept in the platform
  /// keystore (Keychain / EncryptedSharedPreferences) via [FlutterSecureStorage].
  /// It never leaves secure storage in plaintext form elsewhere.
  Future<SecretKey> _masterKey() async {
    if (_cachedKey != null) return _cachedKey!;
    final existing = await _storage.read(key: _masterKeyStorageKey);
    if (existing != null && existing.isNotEmpty) {
      final bytes = base64Decode(existing);
      return _cachedKey = SecretKey(bytes);
    }
    final generated = await _algorithm.newSecretKey();
    final raw = await generated.extractBytes();
    await _storage.write(key: _masterKeyStorageKey, value: base64Encode(raw));
    return _cachedKey = SecretKey(raw);
  }

  /// Encrypts [plainBytes] and writes `nonce || ciphertext || tag` to [target].
  ///
  /// The nonce is prepended so decryption needs only the file and the master
  /// key; the GCM tag is appended by [SecretBox.concatenation].
  Future<void> encryptBytesToFile(Uint8List plainBytes, File target) async {
    final key = await _masterKey();
    final nonce = _algorithm.newNonce();
    final box = await _algorithm.encrypt(plainBytes, secretKey: key, nonce: nonce);
    await target.parent.create(recursive: true);
    await target.writeAsBytes(box.concatenation(), flush: true);
  }

  /// Reads and decrypts a file written by [encryptBytesToFile].
  ///
  /// Throws [SecretBoxAuthenticationError] if the file was truncated or
  /// tampered with, which the caller should treat as a corrupt download.
  Future<Uint8List> decryptFile(File source) async {
    final key = await _masterKey();
    final bytes = await source.readAsBytes();
    final box = SecretBox.fromConcatenation(
      bytes,
      nonceLength: _nonceLength,
      macLength: 16,
    );
    final clear = await _algorithm.decrypt(box, secretKey: key);
    return Uint8List.fromList(clear);
  }

  /// Decrypts [source] into [target] as plaintext, for handing to a media player
  /// that can only read an unencrypted file. The caller owns [target]'s
  /// lifecycle and must delete it when playback ends.
  Future<void> decryptFileToFile(File source, File target) async {
    final clear = await decryptFile(source);
    await target.parent.create(recursive: true);
    await target.writeAsBytes(clear, flush: true);
  }

  /// Drops the in-memory key cache. Called on sign-out; the stored key itself is
  /// removed by [wipeMasterKey].
  void forgetCachedKey() => _cachedKey = null;

  /// Removes the master key so no previously-downloaded ciphertext can ever be
  /// decrypted again. Called when downloads are purged on sign-out.
  Future<void> wipeMasterKey() async {
    _cachedKey = null;
    await _storage.delete(key: _masterKeyStorageKey);
  }
}
