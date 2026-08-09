import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthStorage {
  static const _access = 'majarra_access_token';
  static const _refresh = 'majarra_refresh_token';
  static const _parentId = 'majarra_parent_id';

  final _store = const FlutterSecureStorage();

  Future<void> save({required String accessToken, required String refreshToken, required String parentId}) async {
    await _store.write(key: _access, value: accessToken);
    await _store.write(key: _refresh, value: refreshToken);
    await _store.write(key: _parentId, value: parentId);
  }

  Future<String?> getAccessToken() => _store.read(key: _access);
  Future<String?> getRefreshToken() => _store.read(key: _refresh);
  Future<String?> getParentId() => _store.read(key: _parentId);

  Future<void> updateTokens({required String accessToken, required String refreshToken}) async {
    await _store.write(key: _access, value: accessToken);
    await _store.write(key: _refresh, value: refreshToken);
  }

  Future<void> clear() async {
    await _store.delete(key: _access);
    await _store.delete(key: _refresh);
    await _store.delete(key: _parentId);
  }
}
