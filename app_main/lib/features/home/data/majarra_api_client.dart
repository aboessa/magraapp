import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../../../core/env/app_environment.dart';
import '../../../core/env/app_version.dart';
import 'content_dtos.dart';

class MajarraApiException implements Exception {
  const MajarraApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => 'MajarraApiException: $message';
}

/// The destructive request was dispatched but no authoritative HTTP outcome
/// was received (for example a timeout or a malformed 2xx response). Callers
/// must preserve the receipt and enter deletion-status recovery rather than
/// retrying with a fresh capability.
class AccountDeletionOutcomeUnknown implements Exception {
  const AccountDeletionOutcomeUnknown();

  @override
  String toString() => 'Account deletion outcome is unknown';
}

class ChildDeletionOutcomeUnknown implements Exception {
  const ChildDeletionOutcomeUnknown();

  @override
  String toString() => 'Child deletion outcome is unknown';
}

class AccountDeletionCapability {
  const AccountDeletionCapability({
    required this.requestId,
    required this.secret,
  });

  final String requestId;
  final String secret;
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
    this.getParentProof,
    this.updateTokens,
    this.clearAuth,
  });

  static Uri get _baseUri => Uri.parse(ApiEnvironment.baseUrl);
  static const Duration _timeout = Duration(seconds: 8);

  final http.Client _client;
  final Future<String?> Function()? getAccessToken;
  final Future<String?> Function()? getRefreshToken;
  final String? Function()? getParentProof;
  final Future<void> Function({
    required String accessToken,
    required String refreshToken,
  })?
  updateTokens;
  final Future<void> Function()? clearAuth;

  // Serialises concurrent 401 refresh attempts so a burst of parallel
  // requests does not invalidate the refresh token twice (C4).
  Future<void>? _refreshInFlight;
  bool _terminalClearScheduled = false;

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

  /// Story catalogue — canonical, not a book.
  ///
  /// Stories and books are separate content entities. Fetching stories through
  /// `/books` was the root cause of `story-bird-home` 404: the book endpoint
  /// validates against `books` and that row does not exist.
  Future<Map<String, dynamic>> fetchEpisodeDetail(String episodeId) async {
    return _getJson('/api/v1/episodes/$episodeId');
  }

  Future<List<Map<String, Object?>>> fetchStoryRows() {
    return _getList('/api/v1/stories', query: {'limit': '100'});
  }

  Future<List<StoryDto>> fetchStories() async {
    final data = await fetchStoryRows();
    return data.map(StoryDto.fromJson).toList(growable: false);
  }

  /// Reader content for a single book.
  ///
  /// Returns an empty list when the story has no published pages, so the reader
  /// shows its "not published yet" state rather than substituting other content.
  /// Pages with a missing localisation come back with a null `body_text`, and
  /// pages with no attached artwork with a null `image_url`; both are rendered
  /// as honest partial pages.
  ///
  /// This remains book-scoped. Story pages have their own method below so the
  /// two content types never share an endpoint.
  Future<ReaderPageCollectionDto> fetchStoryPages(
    String bookId, {
    String language = 'ar',
  }) async {
    final envelope = await fetchBookPagesEnvelope(bookId, language: language);
    return ReaderPageCollectionDto.fromEnvelope(
      envelope,
      requestedLanguage: language,
    );
  }

  /// Raw book pages envelope, for callers that also persist it for offline use.
  Future<Map<String, dynamic>> fetchBookPagesEnvelope(
    String bookId, {
    String language = 'ar',
  }) {
    return _getJson(
      '/api/v1/books/$bookId/pages',
      query: {'language': language},
    );
  }

  /// Reader content for a single story — canonical, not a book.
  ///
  /// Stories and books are separate entities. Reusing the book endpoint for a
  /// story was the root cause of `story-bird-home` 404: the book endpoint
  /// validates against `books` and that row does not exist.
  Future<ReaderPageCollectionDto> fetchStoryPagesForStory(
    String storyId, {
    String language = 'ar',
  }) async {
    final envelope = await fetchStoryPagesEnvelope(storyId, language: language);
    return ReaderPageCollectionDto.fromEnvelope(
      envelope,
      requestedLanguage: language,
    );
  }

  /// Raw story pages envelope, for callers that also persist it for offline use.
  Future<Map<String, dynamic>> fetchStoryPagesEnvelope(
    String storyId, {
    String language = 'ar',
  }) {
    return _getJson(
      '/api/v1/stories/$storyId/pages',
      query: {'language': language},
    );
  }

  // --- Auth ---
  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String installationId,
    required String platform,
    String? displayName,
    String? deviceName,
  }) async {
    return _postJson(
      '/api/v1/auth/register',
      body: {
        'email': email,
        'password': password,
        if (displayName != null) 'display_name': displayName,
        'installation_id': installationId,
        'platform': platform,
        if (deviceName != null) 'device_name': deviceName,
      },
    );
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    required String installationId,
    required String platform,
    String? deviceName,
  }) async {
    return _postJson(
      '/api/v1/auth/login',
      body: {
        'email': email,
        'password': password,
        'installation_id': installationId,
        'platform': platform,
        if (deviceName != null) 'device_name': deviceName,
      },
    );
  }

  Future<Map<String, dynamic>> refresh({required String refreshToken}) async {
    return _postJson(
      '/api/v1/auth/refresh',
      body: {'refresh_token': refreshToken},
    );
  }

  Future<Map<String, dynamic>> resendVerification({
    required String email,
  }) async {
    return _postJson(
      '/api/v1/auth/resend-verification',
      body: {'email': email},
    );
  }

  Future<Map<String, dynamic>> verifyEmail({required String token}) async {
    return _postJson('/api/v1/auth/verify-email', body: {'token': token});
  }

  Future<Map<String, dynamic>> forgotPassword({required String email}) async {
    return _postJson('/api/v1/auth/forgot-password', body: {'email': email});
  }

  /// Resets the password at an irreversible server commit boundary.
  ///
  /// The endpoint commits the staged hash and consumes the reset token before
  /// sending its final response. Therefore every received 2xx is success even
  /// when its optional JSON envelope is malformed; decoding must not make an
  /// already-consumed token look retryable.
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    final uri = _baseUri.replace(path: '/api/v1/auth/reset-password');
    final response = await _client
        .post(
          uri,
          headers: await _headers(),
          body: jsonEncode({'token': token, 'new_password': newPassword}),
        )
        .timeout(_timeout);
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    _decodeEnvelope(response);
    throw MajarraApiException(
      'HTTP ${response.statusCode}: ${response.body}',
      statusCode: response.statusCode,
    );
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

  // --- Account lifecycle ---
  Future<Map<String, dynamic>> getAccountProfile() async {
    return _getJson('/api/v1/account/profile', auth: true, parentProof: true);
  }

  Future<Map<String, dynamic>> updateAccountProfile({
    required String? displayName,
  }) async {
    final idempotencyKey = _newIdempotencyKey();
    return _withAuthRetry(
      auth: true,
      parentProof: true,
      doRequest: (headers) {
        final uri = _baseUri.replace(path: '/api/v1/account/profile');
        return _client
            .patch(
              uri,
              headers: {...headers, 'Idempotency-Key': idempotencyKey},
              body: jsonEncode({'display_name': displayName}),
            )
            .timeout(_timeout);
      },
    );
  }

  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final proof = await authorizeParentAction('change_password');
    return _postJson(
      '/api/v1/account/change-password',
      auth: true,
      parentProofToken: proof,
      body: {'current_password': currentPassword, 'new_password': newPassword},
    );
  }

  Future<String> exportAccountData() async {
    final proof = await authorizeParentAction('export_data');
    final response = await _withRawAuthRetry(
      parentProofToken: proof,
      doRequest: (headers) {
        final uri = _baseUri.replace(path: '/api/v1/account/export');
        return _client.get(uri, headers: headers).timeout(_timeout);
      },
    );
    return response.body;
  }

  String createChildDeletionRequestId() => _newIdempotencyKey();

  Future<Map<String, dynamic>> deleteChildAccountData({
    required String childId,
    required String idempotencyKey,
  }) async {
    final proof = await authorizeParentAction('delete_child');
    var requestInFlight = false;
    int? lastStatus;
    try {
      return await _withAuthRetry(
        auth: true,
        parentProofToken: proof,
        doRequest: (headers) {
          final uri = _baseUri.replace(
            path: '/api/v1/account/children/${Uri.encodeComponent(childId)}',
          );
          requestInFlight = true;
          return _client
              .delete(
                uri,
                headers: {...headers, 'Idempotency-Key': idempotencyKey},
              )
              .timeout(_timeout)
              .then((response) {
                requestInFlight = false;
                lastStatus = response.statusCode;
                return response;
              });
        },
      );
    } on MajarraApiException catch (error) {
      if (error.statusCode == 503 && error.code == 'deletion_outcome_unknown') {
        throw const ChildDeletionOutcomeUnknown();
      }
      final successfulResponse =
          lastStatus != null && lastStatus! >= 200 && lastStatus! < 300;
      if (error.statusCode != null ||
          (!requestInFlight && !successfulResponse)) {
        rethrow;
      }
      throw const ChildDeletionOutcomeUnknown();
    } catch (_) {
      final successfulResponse =
          lastStatus != null && lastStatus! >= 200 && lastStatus! < 300;
      if (!requestInFlight && !successfulResponse) rethrow;
      throw const ChildDeletionOutcomeUnknown();
    }
  }

  AccountDeletionCapability createAccountDeletionCapability() {
    final requestId = _newIdempotencyKey();
    final random = Random.secure();
    final bytes = Uint8List.fromList(
      List<int>.generate(32, (_) => random.nextInt(256)),
    );
    return AccountDeletionCapability(
      requestId: requestId,
      secret: base64Url.encode(bytes).replaceAll('=', ''),
    );
  }

  Future<Map<String, dynamic>> deleteAccount({
    required String currentPassword,
    required AccountDeletionCapability capability,
  }) async {
    // Proof exchange failures happen before the destructive request and are not
    // ambiguous: leave the signed-in device intact so the parent can retry.
    final proof = await authorizeParentAction('delete_account');
    var requestInFlight = false;
    int? lastStatus;
    try {
      return await _withAuthRetry(
        auth: true,
        parentProofToken: proof,
        doRequest: (headers) {
          final uri = _baseUri.replace(path: '/api/v1/account/delete');
          requestInFlight = true;
          return _client
              .delete(
                uri,
                headers: {...headers, 'Idempotency-Key': capability.requestId},
                body: jsonEncode({
                  'current_password': currentPassword,
                  'receipt_secret': capability.secret,
                }),
              )
              .timeout(_timeout)
              .then((response) {
                requestInFlight = false;
                lastStatus = response.statusCode;
                return response;
              });
        },
      );
    } on MajarraApiException catch (error) {
      if (error.statusCode == 503 && error.code == 'deletion_outcome_unknown') {
        throw const AccountDeletionOutcomeUnknown();
      }
      // Any real HTTP rejection, including 4xx/5xx, is authoritative and must
      // remain visible to the form. A status-less failure is ambiguous only
      // while the DELETE is in flight or after a malformed successful response.
      final successfulResponse =
          lastStatus != null && lastStatus! >= 200 && lastStatus! < 300;
      if (error.statusCode != null ||
          (!requestInFlight && !successfulResponse)) {
        rethrow;
      }
      throw const AccountDeletionOutcomeUnknown();
    } catch (_) {
      final successfulResponse =
          lastStatus != null && lastStatus! >= 200 && lastStatus! < 300;
      if (!requestInFlight && !successfulResponse) rethrow;
      throw const AccountDeletionOutcomeUnknown();
    }
  }

  Future<Map<String, dynamic>> getDeletionStatus(String requestId) async {
    return _getJson(
      '/api/v1/account/deletions/${Uri.encodeComponent(requestId)}',
      auth: true,
      parentProof: true,
    );
  }

  Future<Map<String, dynamic>> getAccountDeletionStatus({
    required String parentId,
    required String requestId,
    required String receiptSecret,
  }) async {
    return _postJson(
      '/api/v1/account/deletions/status',
      body: {
        'parent_id': parentId,
        'request_id': requestId,
        'receipt_secret': receiptSecret,
      },
    );
  }

  String _newIdempotencyKey() {
    final timestamp = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    final random = Random.secure().nextInt(0x7fffffff).toRadixString(36);
    return 'flutter-$timestamp-$random';
  }

  // --- Family ---
  Future<Map<String, dynamic>> getFamilyState() async {
    return _getJson('/api/v1/family/state', auth: true);
  }

  Future<Map<String, dynamic>> updateProgress({
    required String childId,
    required String contentId,
    required int positionMs,
    required int durationMs,
    required String eventId,
    String? deviceId,
  }) async {
    return _postJson(
      '/api/v1/family/progress',
      auth: true,
      body: {
        'childId': childId,
        'contentId': contentId,
        'positionMs': positionMs,
        'durationMs': durationMs,
        'eventId': eventId,
        if (deviceId != null) 'deviceId': deviceId,
      },
    );
  }

  // --- Playback (capability token) ---
  //
  // Path is `playback-sessions` (plural) to match `routes/episodes.ts`. The
  // singular form used previously always resolved to the worker's 404 handler,
  // so no capability token was ever issued.
  Future<Map<String, dynamic>> createPlaybackSession({
    required String episodeId,
    required String childId,
  }) async {
    return _postJson(
      '/api/v1/episodes/$episodeId/playback-sessions',
      auth: true,
      body: {'child_id': childId},
    );
  }

  Future<Map<String, dynamic>> playbackHeartbeat({
    required String episodeId,
    required String sessionId,
  }) async {
    return _postJson(
      '/api/v1/episodes/$episodeId/playback-sessions/$sessionId/heartbeat',
      auth: true,
      body: {},
    );
  }

  Future<Map<String, dynamic>> endPlaybackSession({
    required String episodeId,
    required String sessionId,
  }) async {
    return _postJson(
      '/api/v1/episodes/$episodeId/playback-sessions/$sessionId/end',
      auth: true,
      body: {},
    );
  }

  /// Requests a capability token for a book or story narration track.
  /// Exactly one of [bookId] and [storyId] must be supplied. The language is
  /// explicit so changing the reader language can never select an arbitrary
  /// first track on the server.
  Future<Map<String, dynamic>> createAudioSession({
    String? bookId,
    String? storyId,
    required String childId,
    String language = 'ar',
    String? pageId,
    String? bubbleId,
  }) async {
    final hasBook = bookId != null && bookId.isNotEmpty;
    final hasStory = storyId != null && storyId.isNotEmpty;
    if (hasBook == hasStory) {
      throw const MajarraApiException(
        'Exactly one narration content id is required',
      );
    }
    final segment = hasStory ? 'stories/$storyId' : 'books/$bookId';
    return _postJson(
      '/api/v1/$segment/audio-sessions',
      auth: true,
      body: {
        'child_id': childId,
        'language': language,
        if (pageId != null) 'page_id': pageId,
        if (bubbleId != null) 'bubble_id': bubbleId,
      },
    );
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
  ///
  /// Carries a `manage_children` proof: the server requires it because creating a
  /// profile sets the age band a child is served and consumes a plan slot.
  Future<Map<String, dynamic>> createChild({
    required String nickname,
    required int birthMonth,
    required int birthYear,
    required String avatarId,
    String language = 'ar',
    List<String> interests = const [],
  }) async {
    final proof = await authorizeParentAction('manage_children');
    return _postJson(
      '/api/v1/family/children',
      auth: true,
      parentProofToken: proof,
      body: {
        'nickname': nickname,
        'birth_month': birthMonth,
        'birth_year': birthYear,
        'avatar_id': avatarId,
        'language': language,
        'interests': interests,
      },
    );
  }

  // --- Family: devices ---
  Future<List<Map<String, Object?>>> fetchDevices() async {
    return _getList('/api/v1/family/devices', auth: true, parentProof: true);
  }

  /// Revokes a device using a purpose-bound, one-time parent capability.
  Future<Map<String, dynamic>> revokeDevice({required String deviceId}) async {
    final proof = await authorizeParentAction('revoke_device');
    return _postJson(
      '/api/v1/family/devices/revoke',
      auth: true,
      parentProofToken: proof,
      body: {'device_id': deviceId},
    );
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
    return _postJson(
      '/api/v1/family/favorites',
      auth: true,
      body: {
        'child_id': childId,
        'entity_type': entityType,
        'entity_id': entityId,
        'action': add ? 'add' : 'remove',
      },
    );
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

  /// Published game summaries available to one owned child.
  ///
  /// Malformed rows fail closed individually: they are omitted rather than
  /// receiving a synthetic id or capability. Transport/auth/envelope failures
  /// still propagate so callers can distinguish failure from a legitimate empty
  /// catalogue and avoid showing stale or bundled game slugs.
  Future<List<GameSummaryDto>> fetchGames({
    required String childId,
    String? language,
  }) async {
    final rows = await _getList(
      '/api/v1/games',
      auth: true,
      query: {
        'child_id': childId,
        'limit': '100',
        if (language != null) 'language': language,
      },
    );
    final byId = <String, GameSummaryDto>{};
    for (final row in rows) {
      final game = GameSummaryDto.tryParse(row);
      if (game != null) byId.putIfAbsent(game.id, () => game);
    }
    return List<GameSummaryDto>.unmodifiable(byId.values);
  }

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
      query: {'child_id': childId, if (language != null) 'language': language},
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

  /// Skill mastery for one child.
  ///
  /// Backed by `GET /api/v1/family/mastery`, which returns one row per learning
  /// objective the child has attempted, with a level and attempt counts. Used by
  /// the parent dashboard's learning summary. The server verifies the child
  /// belongs to the family and 404s otherwise.
  Future<List<Map<String, Object?>>> fetchMastery({
    required String childId,
  }) async {
    return _getList(
      '/api/v1/family/mastery',
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

  /// Grants or revokes a consent.
  ///
  /// Uses a `manage_consents` proof rather than the generic parent-area one: this
  /// writes the legal record of what the account holder permitted for a child, and
  /// the server no longer accepts a token minted for a different purpose.
  Future<Map<String, dynamic>> setConsent({
    required String consentType,
    required String version,
    String? childId,
    bool revoke = false,
  }) async {
    final proof = await authorizeParentAction('manage_consents');
    return _postJson(
      '/api/v1/family/consents',
      auth: true,
      parentProofToken: proof,
      body: {
        'consent_type': consentType,
        'version': version,
        if (childId != null) 'child_id': childId,
        'revoke': revoke,
      },
    );
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
    return _withAuthRetry(
      auth: true,
      doRequest: (headers) async {
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
            .post(
              uri,
              headers: {...headers, 'Content-Type': mimeType},
              body: bytes,
            )
            .timeout(_timeout);
      },
    );
  }

  Future<List<Map<String, Object?>>> fetchCreations({
    required String childId,
  }) async {
    return _getList(
      '/api/v1/creations',
      auth: true,
      query: {'child_id': childId},
    );
  }

  /// Deletes one creation.
  ///
  /// Carries a consumed `delete_creation` proof, matching [purgeCreations]. The
  /// server used to require a proof for purging many drawings and none for
  /// deleting one, so the gate could be bypassed by looping this call.
  Future<Map<String, dynamic>> deleteCreation({
    required String creationId,
  }) async {
    final proof = await authorizeParentAction('delete_creation');
    return _withAuthRetry(
      auth: true,
      parentProofToken: proof,
      doRequest: (headers) async {
        final uri = _baseUri.replace(path: '/api/v1/creations/$creationId');
        return _client.delete(uri, headers: headers).timeout(_timeout);
      },
    );
  }

  /// Removes every stored creation for one child, or for the whole family when
  /// [childId] is null.
  ///
  /// Called from profile deletion and account deletion. Idempotent on the server, so
  /// a retry after a dropped connection is safe.
  Future<Map<String, dynamic>> purgeCreations({String? childId}) async {
    final proof = await authorizeParentAction('purge_creations');
    return _postJson(
      '/api/v1/creations/purge',
      auth: true,
      parentProofToken: proof,
      body: {if (childId != null) 'child_id': childId},
    );
  }

  // --- Billing ---
  //
  // Reads the effective plan from the same entitlement ledger the server uses to
  // enforce limits, so the membership screen cannot advertise a tier the account
  // does not actually hold.
  Future<Map<String, dynamic>> getBillingStatus() async {
    return _getJson('/api/v1/billing/status', auth: true);
  }

  Future<Map<String, dynamic>> fetchAppConfig() async {
    return _getJson('/api/v1/app-config');
  }

  Future<Map<String, dynamic>> fetchResolvedHome({
    String? track,
    String? language,
    String? country,
    String? plan,
    String? platform,
    String? appVersion,
    bool? isNewUser,
  }) async {
    return _getJson(
      '/api/v1/home/resolved',
      query: {
        if (track != null) 'track': track,
        if (language != null) 'language': language,
        if (country != null) 'country': country,
        if (plan != null) 'plan': plan,
        if (platform != null) 'platform': platform,
        if (appVersion != null) 'app_version': appVersion,
        if (isNewUser != null) 'is_new_user': isNewUser ? '1' : '0',
      },
    );
  }

  Future<Map<String, dynamic>> fetchRecommendations({
    required String childId,
  }) async {
    return _getJson(
      '/api/v1/recommendations',
      auth: true,
      query: {'child_id': childId},
    );
  }

  Future<Map<String, dynamic>> fetchChildSettings(String childId) async {
    return _getJson('/api/v1/child-settings/$childId', auth: true);
  }

  Future<Map<String, dynamic>> updateChildSettings(
    String childId,
    Map<String, Object?> body,
  ) async {
    return _withAuthRetry(
      auth: true,
      parentProof: true,
      doRequest: (headers) async {
        final uri = _baseUri.replace(path: '/api/v1/child-settings/$childId');
        return _client
            .put(uri, headers: headers, body: jsonEncode(body))
            .timeout(_timeout);
      },
    );
  }

  Future<Map<String, dynamic>> postAnalyticsEvent(
    String event, {
    Map<String, dynamic>? params,
    String? childId,
  }) async {
    try {
      return await _postJson(
        '/api/v1/analytics/events',
        auth: true,
        body: {
          'event': event,
          'params': params ?? {},
          if (childId != null) 'child_id': childId,
        },
      );
    } catch (_) {
      return {'success': false};
    }
  }

  Future<List<Map<String, Object?>>> fetchNotifications({
    String? childId,
  }) async {
    return _getList(
      '/api/v1/notifications',
      auth: true,
      query: {if (childId != null) 'child_id': childId},
    );
  }

  // --- Parent PIN and short-lived server proof ---
  Future<Map<String, dynamic>> setParentPin({required String pin}) async {
    return _postJson(
      '/api/v1/family/parent-pin',
      auth: true,
      // Empty on first enrolment; present for a proof-authorized PIN change.
      parentProof: true,
      body: {'pin': pin},
    );
  }

  Future<Map<String, dynamic>> verifyParentPin({
    required String pin,
    String purpose = 'parent_area',
  }) async {
    return _postJson(
      '/api/v1/family/parent-pin/verify',
      auth: true,
      body: {'pin': pin, 'purpose': purpose},
    );
  }

  /// Exchanges the in-memory `parent_area` proof for a capability that is
  /// purpose-bound and consumed by the server on its first sensitive use.
  Future<String> authorizeParentAction(String purpose) async {
    final envelope = await _postJson(
      '/api/v1/family/parent-proof/authorize',
      auth: true,
      parentProof: true,
      body: {'purpose': purpose},
    );
    final data = envelope['data'];
    final proof = data is Map ? data['parent_proof'] : null;
    if (proof is! String || proof.isEmpty) {
      throw const MajarraApiException(
        'Parent authorization response is missing its proof',
      );
    }
    return proof;
  }

  Future<List<Map<String, Object?>>> _getList(
    String path, {
    Map<String, String>? query,
    bool auth = false,
    bool parentProof = false,
    String? parentProofToken,
  }) async {
    final envelope = await _withAuthRetry(
      auth: auth,
      parentProof: parentProof,
      parentProofToken: parentProofToken,
      doRequest: (headers) {
        final uri = _baseUri.replace(path: path, queryParameters: query);
        return _client.get(uri, headers: headers).timeout(_timeout);
      },
    );
    final data = envelope['data'];
    if (data is! List) {
      throw const MajarraApiException('Response data must be a list');
    }
    return data
        .whereType<Map<String, dynamic>>()
        .map((item) => Map<String, Object?>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> _getJson(
    String path, {
    bool auth = false,
    bool parentProof = false,
    String? parentProofToken,
    Map<String, String>? query,
  }) async {
    return _withAuthRetry(
      auth: auth,
      parentProof: parentProof,
      parentProofToken: parentProofToken,
      doRequest: (headers) async {
        final uri = _baseUri.replace(path: path, queryParameters: query);
        return _client.get(uri, headers: headers).timeout(_timeout);
      },
    );
  }

  Future<Map<String, dynamic>> _postJson(
    String path, {
    Map<String, dynamic>? body,
    bool auth = false,
    bool parentProof = false,
    String? parentProofToken,
  }) async {
    return _withAuthRetry(
      auth: auth,
      parentProof: parentProof,
      parentProofToken: parentProofToken,
      doRequest: (headers) async {
        final uri = _baseUri.replace(path: path);
        return _client
            .post(
              uri,
              headers: headers,
              body: body == null ? null : jsonEncode(body),
            )
            .timeout(_timeout);
      },
    );
  }

  Future<Map<String, dynamic>> _withAuthRetry({
    required bool auth,
    bool parentProof = false,
    String? parentProofToken,
    required Future<http.Response> Function(Map<String, String> headers)
    doRequest,
  }) async {
    var headers = await _headers(
      auth: auth,
      parentProof: parentProof,
      parentProofToken: parentProofToken,
    );
    var res = await doRequest(headers);
    if (res.statusCode != 401 || !auth) return _decodeEnvelope(res);
    // 401 on an authenticated request — try a single refresh and retry once.
    final refreshed = await _tryRefresh();
    if (!refreshed) return _decodeEnvelope(res);
    headers = await _headers(
      auth: auth,
      parentProof: parentProof,
      parentProofToken: parentProofToken,
    );
    res = await doRequest(headers);
    return _decodeEnvelope(res);
  }

  Future<http.Response> _withRawAuthRetry({
    required String parentProofToken,
    required Future<http.Response> Function(Map<String, String> headers)
    doRequest,
  }) async {
    var headers = await _headers(
      auth: true,
      parentProofToken: parentProofToken,
    );
    var response = await doRequest(headers);
    if (response.statusCode == 401 && await _tryRefresh()) {
      headers = await _headers(auth: true, parentProofToken: parentProofToken);
      response = await doRequest(headers);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw MajarraApiException(
        'HTTP ${response.statusCode}: ${response.body}',
        statusCode: response.statusCode,
      );
    }
    return response;
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

  void _scheduleTerminalClear() {
    if (_terminalClearScheduled || clearAuth == null) return;
    _terminalClearScheduled = true;

    // Use the next event turn rather than a microtask. Every request/writer that
    // observed the rejected refresh can then unwind before teardown drains
    // those same operations, avoiding a refresh→teardown→writer self-deadlock.
    Timer.run(() {
      unawaited(
        Future<void>.sync(() => clearAuth!.call())
            .catchError((Object _, StackTrace __) {})
            .whenComplete(() => _terminalClearScheduled = false),
      );
    });
  }

  Future<void> _performRefresh(String refreshToken) async {
    final uri = _baseUri.replace(path: '/api/v1/auth/refresh');
    final res = await _client
        .post(
          uri,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'refresh_token': refreshToken}),
        )
        .timeout(_timeout);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      // Only an explicit refresh-token rejection ends the local session. A
      // transient 429/5xx or deployment outage must remain retryable and must
      // never erase offline child data.
      if (res.statusCode == 401 && clearAuth != null) {
        _scheduleTerminalClear();
      }
      throw MajarraApiException(
        'HTTP ${res.statusCode}: ${res.body}',
        statusCode: res.statusCode,
      );
    }
    final decoded = jsonDecode(res.body);
    if (decoded is! Map<String, dynamic> || decoded['success'] != true) {
      throw const MajarraApiException('Refresh failed');
    }
    final data = decoded['data'] as Map<String, dynamic>?;
    final access = data?['access_token'] as String?;
    final refresh = data?['refresh_token'] as String?;
    if (access == null ||
        refresh == null ||
        access.isEmpty ||
        refresh.isEmpty) {
      throw const MajarraApiException('Refresh response is missing tokens');
    }
    await updateTokens!.call(accessToken: access, refreshToken: refresh);
  }

  Future<Map<String, String>> _headers({
    bool auth = false,
    bool parentProof = false,
    String? parentProofToken,
  }) async {
    final h = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      // The running build's version, not a literal. The server uses this for
      // compatibility measurement and the forced-update minimum, both of which
      // were being fed a constant.
      'X-App-Version': AppVersion.current,
      'X-Platform': 'flutter',
    };
    if (auth && getAccessToken != null) {
      final token = await getAccessToken!();
      if (token != null && token.isNotEmpty) {
        h['Authorization'] = 'Bearer $token';
      }
    }
    final proof =
        parentProofToken ?? (parentProof ? getParentProof?.call() : null);
    if (proof != null && proof.isNotEmpty) {
      // This is a dedicated signed capability, not an OAuth bearer value.
      h['X-Parent-Proof'] = proof;
    }
    return h;
  }

  Map<String, dynamic> _decodeEnvelope(http.Response res) {
    // Decode bytes explicitly as UTF-8. Relying on Response.body can interpret
    // Arabic JSON as Latin-1 when an upstream Content-Type omits its charset.
    final body = utf8.decode(res.bodyBytes);
    if (res.statusCode < 200 || res.statusCode >= 300) {
      Object? decoded;
      try {
        decoded = jsonDecode(body);
      } catch (_) {}
      final code = decoded is Map ? decoded['code']?.toString() : null;
      throw MajarraApiException(
        'HTTP ${res.statusCode}: $body',
        statusCode: res.statusCode,
        code: code,
      );
    }
    final decoded = jsonDecode(body);
    if (decoded is! Map<String, dynamic>) {
      throw const MajarraApiException('Invalid envelope');
    }
    if (decoded['success'] != true) {
      throw MajarraApiException(
        decoded['error']?.toString() ?? 'Request failed',
      );
    }
    return decoded;
  }
}
