import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/env/app_environment.dart';
import 'content_dtos.dart';

class MajarraApiException implements Exception {
  const MajarraApiException(this.message);

  final String message;

  @override
  String toString() => 'MajarraApiException: $message';
}

/// API base URL resolution.
///
/// The environment enum, allowlist policy and `API_BASE_URL` override handling
/// now live in `core/env/app_environment.dart` (`AppConfig`). This thin shim is
/// kept so existing call sites and tests that reference `ApiEnvironment.baseUrl`
/// keep working; new code should read [AppConfig.baseUrl] directly.
///
/// H10/B11 (unrestricted override) is fixed there: an `API_BASE_URL` value is
/// now validated against a per-environment host allowlist and rejected — falling
/// back to the environment default — if it uses an unexpected scheme, carries
/// credentials, is plain `http` to a non-loopback host, or names an unlisted
/// host. A3 (real staging backend) remains an infrastructure EXTERNAL BLOCKER.
class ApiEnvironment {
  static String get baseUrl => AppConfig.baseUrl;
}

class MajarraApiClient {
  MajarraApiClient(
    this._client, {
    String? baseUrl,
    this.getAccessToken,
    this.getRefreshToken,
    this.updateTokens,
    this.clearAuth,
  });

  static Uri get _baseUri => Uri.parse(ApiEnvironment.baseUrl);
  static const Duration _timeout = Duration(seconds: 8);

  final http.Client _client;
  final Future<String?> Function()? getAccessToken;
  final Future<String?> Function()? getRefreshToken;
  final Future<void> Function({required String accessToken, required String refreshToken})? updateTokens;
  final Future<void> Function()? clearAuth;

  // Serialises concurrent 401 refresh attempts so a burst of parallel
  // requests does not invalidate the refresh token twice (C4).
  Future<void>? _refreshInFlight;

  // --- Catalog (عام، لا يحتاج توكن) ---
  //
  // Each collection is exposed twice: a `*Rows` variant returning the decoded
  // JSON rows, and a DTO variant that parses them. The repository uses the row
  // variants so it can write the untouched server payload to the disk cache
  // without re-serialising domain models, which would risk the cached shape
  // drifting from what the DTO parsers expect.

  Future<List<Map<String, Object?>>> fetchPlanetRows() {
    return _getList('/api/v1/planets');
  }

  Future<List<Map<String, Object?>>> fetchSeriesRows() {
    return _getList('/api/v1/series', query: {'limit': '100'});
  }

  Future<List<Map<String, Object?>>> fetchEpisodeRows() {
    return _getList('/api/v1/episodes', query: {'limit': '100'});
  }

  /// Book rows.
  ///
  /// Unlike the other collections this swallows failures and returns an empty
  /// list: books are an optional shelf, and a missing library must not take the
  /// whole home screen down with it.
  Future<List<Map<String, Object?>>> fetchBookRows() async {
    try {
      return await _getList('/api/v1/books', query: {'limit': '100'});
    } catch (_) {
      return const [];
    }
  }

  Future<List<PlanetDto>> fetchPlanets() async {
    final data = await fetchPlanetRows();
    return data.map(PlanetDto.fromJson).toList(growable: false);
  }

  Future<List<SeriesDto>> fetchSeries() async {
    final data = await fetchSeriesRows();
    return data.map(SeriesDto.fromJson).toList(growable: false);
  }

  Future<List<EpisodeDto>> fetchEpisodes() async {
    final data = await fetchEpisodeRows();
    return data.map(EpisodeDto.fromJson).toList(growable: false);
  }

  Future<List<BookDto>> fetchBooks() async {
    final data = await fetchBookRows();
    return data.map(BookDto.fromJson).toList(growable: false);
  }

  /// Reader content for a single book.
  ///
  /// Returns an empty list when the story has no published pages, so the reader
  /// shows its "not published yet" state rather than substituting other content.
  /// Pages with a missing localisation come back with a null `body_text`, and
  /// pages with no attached artwork with a null `image_url`; both are rendered
  /// as honest partial pages.
  Future<List<StoryPageDto>> fetchStoryPages(
    String bookId, {
    String language = 'ar',
  }) async {
    try {
      final data = await _getList(
        '/api/v1/books/$bookId/pages',
        query: {'language': language},
      );
      return data.map(StoryPageDto.fromJson).toList(growable: false);
    } catch (_) {
      return [];
    }
  }

  // --- Auth ---
  Future<Map<String, dynamic>> register({required String email, required String password, String? displayName, String? installationId, String platform = 'android'}) async {
    return _postJson('/api/v1/auth/register', body: {'email': email, 'password': password, if (displayName != null) 'display_name': displayName, 'installation_id': installationId ?? 'dev-install', 'platform': platform});
  }

  Future<Map<String, dynamic>> login({required String email, required String password, String? installationId, String platform = 'android', String? deviceName}) async {
    return _postJson('/api/v1/auth/login', body: {'email': email, 'password': password, 'installation_id': installationId ?? 'dev-install-$email', 'platform': platform, if (deviceName != null) 'device_name': deviceName});
  }

  Future<Map<String, dynamic>> refresh({required String refreshToken}) async {
    return _postJson('/api/v1/auth/refresh', body: {'refresh_token': refreshToken});
  }

  Future<Map<String, dynamic>> verifyEmail({required String token}) async {
    return _postJson('/api/v1/auth/verify-email', body: {'token': token});
  }

  /// Ends the current session server-side.
  ///
  /// Matches `POST /api/v1/auth/logout` (`routes/auth.ts:240`), which revokes the
  /// session in `FamilyState` so the refresh token cannot be reused. Local token
  /// deletion alone would leave a valid session on the server until it expired.
  Future<Map<String, dynamic>> logout() async {
    return _postJson('/api/v1/auth/logout', auth: true, body: const {});
  }

  Future<Map<String, dynamic>> me() async {
    return _getJson('/api/v1/auth/me', auth: true);
  }

  // --- Family ---
  Future<Map<String, dynamic>> getFamilyState() async {
    return _getJson('/api/v1/family/state', auth: true);
  }

  Future<Map<String, dynamic>> updateProgress({required String childId, required String contentId, required int positionMs, required int durationMs, required String eventId, String? deviceId}) async {
    return _postJson('/api/v1/family/progress', auth: true, body: {'childId': childId, 'contentId': contentId, 'positionMs': positionMs, 'durationMs': durationMs, 'eventId': eventId, if (deviceId != null) 'deviceId': deviceId});
  }

  // --- Playback (capability token) ---
  //
  // Path is `playback-sessions` (plural) to match `routes/episodes.ts`. The
  // singular form used previously always resolved to the worker's 404 handler,
  // so no capability token was ever issued.
  Future<Map<String, dynamic>> createPlaybackSession({required String episodeId}) async {
    return _postJson('/api/v1/episodes/$episodeId/playback-sessions', auth: true, body: {});
  }

  Future<Map<String, dynamic>> playbackHeartbeat({required String episodeId, required String sessionId}) async {
    return _postJson('/api/v1/episodes/$episodeId/playback-sessions/$sessionId/heartbeat', auth: true, body: {});
  }

  Future<Map<String, dynamic>> endPlaybackSession({required String episodeId, required String sessionId}) async {
    return _postJson('/api/v1/episodes/$episodeId/playback-sessions/$sessionId/end', auth: true, body: {});
  }

  /// Requests a capability token for a book's narration.
  ///
  /// Narration is stored as a private asset, so it cannot be fetched from the CDN
  /// like cover art can. The server verifies the child belongs to the family and
  /// that the plan covers the story, then returns a `stream_url` plus a
  /// short-lived `Bearer` value that must be sent as an `Authorization` header on
  /// the audio request itself.
  ///
  /// `pageId` selects a per-page narration; omitting it requests the whole-book
  /// track. See `dashboard/api/src/routes/books.ts` `POST /:id/audio-sessions`.
  Future<Map<String, dynamic>> createAudioSession({
    required String bookId,
    required String childId,
    String? pageId,
  }) async {
    return _postJson('/api/v1/books/$bookId/audio-sessions', auth: true, body: {
      'child_id': childId,
      if (pageId != null) 'page_id': pageId,
    });
  }

  // --- Family: children ---
  Future<List<Map<String, Object?>>> fetchChildren() async {
    return _getList('/api/v1/family/children', auth: true);
  }

  /// Creates a child profile.
  ///
  /// Field names are snake_case and the age track is deliberately NOT sent: the
  /// Durable Object derives it from the birth date via `deriveAgeTrack`, and
  /// rejects a profile outside 3–12. Letting the client assert a track would
  /// allow an age-inappropriate library to be requested.
  /// See `dashboard/api/src/do/FamilyState.ts:447`.
  Future<Map<String, dynamic>> createChild({
    required String nickname,
    required int birthMonth,
    required int birthYear,
    required String avatarId,
    String language = 'ar',
    List<String> interests = const [],
  }) async {
    return _postJson('/api/v1/family/children', auth: true, body: {
      'nickname': nickname,
      'birth_month': birthMonth,
      'birth_year': birthYear,
      'avatar_id': avatarId,
      'language': language,
      'interests': interests,
    });
  }

  // --- Family: devices ---
  Future<List<Map<String, Object?>>> fetchDevices() async {
    return _getList('/api/v1/family/devices', auth: true);
  }

  /// Revokes a device session.
  ///
  /// The body key is snake_case `device_id`: unlike `/progress`, the server route
  /// validates this exact field and rejects the camelCase form with a 400.
  /// See `dashboard/api/src/routes/family.ts:120`.
  Future<Map<String, dynamic>> revokeDevice({required String deviceId}) async {
    return _postJson('/api/v1/family/devices/revoke', auth: true, body: {'device_id': deviceId});
  }

  // --- Family: favorites ---
  //
  // Favourites are stored per child, not per account: the Durable Object rejects
  // the update unless `child_id` matches an active profile on the family. Field
  // names are snake_case and `action` is `add` or `remove`.
  // See `dashboard/api/src/do/FamilyState.ts:580`.
  Future<Map<String, dynamic>> updateFavorite({
    required String childId,
    required String entityId,
    String entityType = 'series',
    bool add = true,
  }) async {
    return _postJson('/api/v1/family/favorites', auth: true, body: {
      'child_id': childId,
      'entity_type': entityType,
      'entity_id': entityId,
      'action': add ? 'add' : 'remove',
    });
  }

  /// Reads saved progress for one child.
  ///
  /// Returns the rows `GET /api/v1/family/progress` produces, newest first. The
  /// route verifies the child belongs to the family and 404s otherwise.
  Future<List<Map<String, Object?>>> fetchProgress({
    required String childId,
  }) async {
    return _getList(
      '/api/v1/family/progress',
      auth: true,
      query: {'childId': childId},
    );
  }

  // --- Games ---

  /// The published, localised pack for one game.
  ///
  /// Matches `GET /api/v1/games/:id` (`routes/games.ts`). The server resolves the
  /// language with an explicit Arabic-first fallback and reports which language it
  /// actually served, so the client never has to guess.
  Future<Map<String, dynamic>> fetchGame({
    required String gameId,
    required String childId,
    String? language,
  }) async {
    return _getJson(
      '/api/v1/games/$gameId',
      auth: true,
      query: {
        'child_id': childId,
        if (language != null) 'language': language,
      },
    );
  }

  /// Reports one completed level.
  ///
  /// Goes through `POST /api/v1/family/progress`, which is the only write path
  /// into a child's record: the game never touches D1 directly. `event_id` inside
  /// [payload] is stable for the attempt, so a retry after a dropped connection
  /// cannot double-count it.
  Future<Map<String, dynamic>> postGameAttempt(
    Map<String, Object?> payload,
  ) async {
    return _postJson('/api/v1/family/progress', auth: true, body: payload);
  }

  /// Stickers earned by one child.
  ///
  /// Backed by `GET /api/v1/family/rewards`. Rewards are kept forever, so there
  /// is no paging and no expiry to account for.
  Future<List<Map<String, Object?>>> fetchRewards({
    required String childId,
  }) async {
    return _getList(
      '/api/v1/family/rewards',
      auth: true,
      query: {'child_id': childId},
    );
  }

  // --- Child creations ---
  //
  // Nothing here is called automatically. A drawing lives on the device, and these
  // are only reached when a parent explicitly asks to keep one, after granting the
  // `child_creations` consent.

  /// Parental consents and the server's decision per type.
  ///
  /// The decision is taken from the server rather than recomputed here: two copies
  /// of a consent policy would eventually disagree, and the client's copy is the one
  /// that would be wrong.
  Future<Map<String, dynamic>> fetchConsents({String? childId}) async {
    return _getJson(
      '/api/v1/family/consents',
      auth: true,
      query: {if (childId != null) 'child_id': childId},
    );
  }

  Future<Map<String, dynamic>> setConsent({
    required String consentType,
    required String version,
    String? childId,
    bool revoke = false,
  }) async {
    return _postJson('/api/v1/family/consents', auth: true, body: {
      'consent_type': consentType,
      'version': version,
      if (childId != null) 'child_id': childId,
      'revoke': revoke,
    });
  }

  /// Uploads one drawing to private family storage.
  ///
  /// The body is the raw PNG and the metadata travels as query parameters, matching
  /// `POST /api/v1/creations`. A 403 carries `consent_required`, which the caller
  /// surfaces as a request for consent rather than a failure.
  Future<Map<String, dynamic>> uploadCreation({
    required String childId,
    required String gameId,
    required String drawingMode,
    required int width,
    required int height,
    required Uint8List bytes,
    String mimeType = 'image/png',
  }) async {
    return _withAuthRetry(auth: true, doRequest: (headers) async {
      final uri = _baseUri.replace(
        path: '/api/v1/creations',
        queryParameters: {
          'child_id': childId,
          'game_id': gameId,
          'drawing_mode': drawingMode,
          'width': '$width',
          'height': '$height',
        },
      );
      return _client
          .post(uri, headers: {...headers, 'Content-Type': mimeType}, body: bytes)
          .timeout(_timeout);
    });
  }

  Future<List<Map<String, Object?>>> fetchCreations({required String childId}) async {
    return _getList('/api/v1/creations', auth: true, query: {'child_id': childId});
  }

  Future<Map<String, dynamic>> deleteCreation({required String creationId}) async {
    return _withAuthRetry(auth: true, doRequest: (headers) async {
      final uri = _baseUri.replace(path: '/api/v1/creations/$creationId');
      return _client.delete(uri, headers: headers).timeout(_timeout);
    });
  }

  /// Removes every stored creation for one child, or for the whole family when
  /// [childId] is null.
  ///
  /// Called from profile deletion and account deletion. Idempotent on the server, so
  /// a retry after a dropped connection is safe.
  Future<Map<String, dynamic>> purgeCreations({String? childId}) async {
    return _postJson('/api/v1/creations/purge', auth: true, body: {
      if (childId != null) 'child_id': childId,
    });
  }

  // --- Billing ---
  //
  // Reads the effective plan from the same entitlement ledger the server uses to
  // enforce limits, so the membership screen cannot advertise a tier the account
  // does not actually hold.
  Future<Map<String, dynamic>> getBillingStatus() async {
    return _getJson('/api/v1/billing/status', auth: true);
  }

  // --- Parent PIN (server-side gate, C2) ---
  Future<Map<String, dynamic>> setParentPin({required String pin}) async {
    return _postJson('/api/v1/family/parent-pin', auth: true, body: {'pin': pin});
  }

  Future<Map<String, dynamic>> verifyParentPin({required String pin}) async {
    return _postJson('/api/v1/family/parent-pin/verify', auth: true, body: {'pin': pin});
  }

  Future<List<Map<String, Object?>>> _getList(
    String path, {
    Map<String, String>? query,
    bool auth = false,
  }) async {
    final headers = await _headers(auth: auth);
    final uri = _baseUri.replace(path: path, queryParameters: query);
    late final http.Response response;
    try {
      response = await _client.get(uri, headers: headers).timeout(_timeout);
    } on TimeoutException {
      throw const MajarraApiException('Request timed out');
    } on http.ClientException {
      throw const MajarraApiException('Network request failed');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MajarraApiException('Unexpected status ${response.statusCode}: ${response.body}');
    }

    Object? decoded;
    try {
      decoded = jsonDecode(response.body);
    } on FormatException {
      throw const MajarraApiException('Response is not valid JSON');
    }

    if (decoded is! Map) {
      throw const MajarraApiException('Response root must be an object');
    }
    final envelope = Map<String, Object?>.from(decoded);
    if (envelope['success'] != true || envelope['data'] is! List) {
      throw const MajarraApiException('Response envelope is invalid');
    }

    return (envelope['data'] as List)
        .whereType<Map<String, dynamic>>()
        .map((item) => Map<String, Object?>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> _getJson(String path, {bool auth = false, Map<String, String>? query}) async {
    return _withAuthRetry(auth: auth, doRequest: (headers) async {
      final uri = _baseUri.replace(path: path, queryParameters: query);
      return _client.get(uri, headers: headers).timeout(_timeout);
    });
  }

  Future<Map<String, dynamic>> _postJson(String path, {Map<String, dynamic>? body, bool auth = false}) async {
    return _withAuthRetry(auth: auth, doRequest: (headers) async {
      final uri = _baseUri.replace(path: path);
      return _client.post(uri, headers: headers, body: body == null ? null : jsonEncode(body)).timeout(_timeout);
    });
  }

  Future<Map<String, dynamic>> _withAuthRetry({
    required bool auth,
    required Future<http.Response> Function(Map<String, String> headers) doRequest,
  }) async {
    var headers = await _headers(auth: auth);
    var res = await doRequest(headers);
    if (res.statusCode != 401 || !auth) return _decodeEnvelope(res);
    // 401 on an authenticated request — try a single refresh and retry once.
    final refreshed = await _tryRefresh();
    if (!refreshed) return _decodeEnvelope(res);
    headers = await _headers(auth: auth);
    res = await doRequest(headers);
    return _decodeEnvelope(res);
  }

  Future<bool> _tryRefresh() async {
    if (getRefreshToken == null || updateTokens == null) return false;
    // Coalesce parallel refreshes.
    if (_refreshInFlight != null) {
      try {
        await _refreshInFlight;
        return true;
      } catch (_) {
        return false;
      }
    }
    final refreshToken = await getRefreshToken!.call();
    if (refreshToken == null || refreshToken.isEmpty) return false;
    final future = _performRefresh(refreshToken);
    _refreshInFlight = future;
    try {
      await future;
      return true;
    } catch (_) {
      return false;
    } finally {
      _refreshInFlight = null;
    }
  }

  Future<void> _performRefresh(String refreshToken) async {
    final uri = _baseUri.replace(path: '/api/v1/auth/refresh');
    final res = await _client
        .post(uri, headers: {'Accept': 'application/json', 'Content-Type': 'application/json'}, body: jsonEncode({'refresh_token': refreshToken}))
        .timeout(_timeout);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      if (clearAuth != null) await clearAuth!.call();
      throw MajarraApiException('HTTP ${res.statusCode}: ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! Map<String, dynamic> || decoded['success'] != true) {
      if (clearAuth != null) await clearAuth!.call();
      throw const MajarraApiException('Refresh failed');
    }
    final data = decoded['data'] as Map<String, dynamic>?;
    final access = data?['access_token'] as String?;
    final refresh = data?['refresh_token'] as String?;
    if (access == null || refresh == null || access.isEmpty || refresh.isEmpty) {
      if (clearAuth != null) await clearAuth!.call();
      throw const MajarraApiException('Refresh response is missing tokens');
    }
    await updateTokens!.call(accessToken: access, refreshToken: refresh);
  }

  Future<Map<String, String>> _headers({bool auth = false}) async {
    final h = <String, String>{'Accept': 'application/json', 'Content-Type': 'application/json'};
    if (auth && getAccessToken != null) {
      final token = await getAccessToken!();
      if (token != null && token.isNotEmpty) h['Authorization'] = 'Bearer $token';
    }
    return h;
  }

  Map<String, dynamic> _decodeEnvelope(http.Response res) {
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw MajarraApiException('HTTP ${res.statusCode}: ${res.body}');
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! Map<String, dynamic>) throw const MajarraApiException('Invalid envelope');
    if (decoded['success'] != true) throw MajarraApiException(decoded['error']?.toString() ?? 'Request failed');
    return decoded;
  }
}
