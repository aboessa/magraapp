import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'content_dtos.dart';

class MajarraApiException implements Exception {
  const MajarraApiException(this.message);

  final String message;

  @override
  String toString() => 'MajarraApiException: $message';
}

/// API base URLs.
///
/// ## A3 (staging/production separation) is BLOCKED — infrastructure, not code
///
/// [staging] and [production] currently hold the *same* URL. That is not an
/// oversight left in place casually: there is no staging backend to point at.
/// `dashboard/api/wrangler.jsonc` defines exactly one named environment,
/// `production`, routed to `api.majarra.app`. The top-level Wrangler config is
/// marked local-development-only and carries a warning that it must never point
/// at production queues or buckets.
///
/// Inventing a plausible-looking staging hostname would be worse than leaving
/// the duplication visible, because a build could then silently target a host
/// that does not exist, or worse, resolve to production while claiming to be
/// staging.
///
/// To unblock, infrastructure must first provide:
///   1. A `staging` environment in `wrangler.jsonc` with its own route, D1
///      database, KV namespace, R2 buckets and queues — sharing any of these
///      with production would let test traffic mutate real family data.
///   2. Separate `AUTH_TOKEN_SECRET` / `MEDIA_TOKEN_SECRET` / `ADMIN_API_KEY`
///      values for that environment.
///   3. The resulting hostname.
///
/// Once those exist, this class should become an explicit environment enum
/// selected by `--dart-define`, with the override allowlisted to https (plus
/// localhost for local development) rather than the current unrestricted
/// [custom] value. See AUDIT_FLUTTER_APP.md §9 H10 and §7.4 B11.
///
/// Until then production behaviour is deliberately left exactly as it was.
class ApiEnvironment {
  /// Placeholder only — identical to [production] because no staging backend
  /// exists yet. Do not treat a build using this as isolated from production.
  static const staging = 'https://api.majarra.app';
  static const production = 'https://api.majarra.app';

  /// Superseded workers.dev hostname, kept for reference while the custom
  /// override remains unrestricted. Not referenced by [baseUrl].
  static const legacy = 'https://majarra-api-prod.aboessa101.workers.dev';

  /// Unrestricted build-time override. Needs an allowlist (see class docs).
  static const custom = String.fromEnvironment('API_BASE_URL', defaultValue: '');
  static String get baseUrl => custom.isNotEmpty ? custom : production;
}

class MajarraApiClient {
  MajarraApiClient(this._client, {String? baseUrl, this.getAccessToken});

  static Uri get _baseUri => Uri.parse(ApiEnvironment.baseUrl);
  static const Duration _timeout = Duration(seconds: 8);

  final http.Client _client;
  final Future<String?> Function()? getAccessToken;

  // --- Catalog (عام، لا يحتاج توكن) ---
  Future<List<PlanetDto>> fetchPlanets() async {
    final data = await _getList('/api/v1/planets');
    return data.map(PlanetDto.fromJson).toList(growable: false);
  }

  Future<List<SeriesDto>> fetchSeries() async {
    final data = await _getList('/api/v1/series', query: {'limit': '100'});
    return data.map(SeriesDto.fromJson).toList(growable: false);
  }

  Future<List<EpisodeDto>> fetchEpisodes() async {
    final data = await _getList('/api/v1/episodes', query: {'limit': '100'});
    return data.map(EpisodeDto.fromJson).toList(growable: false);
  }

  Future<List<BookDto>> fetchBooks() async {
    try {
      final data = await _getList('/api/v1/books', query: {'limit': '100'});
      return data.map(BookDto.fromJson).toList(growable: false);
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
  Future<Map<String, dynamic>> createPlaybackSession({required String episodeId}) async {
    return _postJson('/api/v1/episodes/$episodeId/playback-session', auth: true, body: {});
  }

  // --- Billing ---
  Future<Map<String, dynamic>> getBillingStatus() async {
    return _getJson('/api/v1/billing/status', auth: true);
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
        .whereType<Map>()
        .map((item) => Map<String, Object?>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> _getJson(String path, {bool auth = false, Map<String, String>? query}) async {
    final headers = await _headers(auth: auth);
    final uri = _baseUri.replace(path: path, queryParameters: query);
    final res = await _client.get(uri, headers: headers).timeout(_timeout);
    return _decodeEnvelope(res);
  }

  Future<Map<String, dynamic>> _postJson(String path, {Map<String, dynamic>? body, bool auth = false}) async {
    final headers = await _headers(auth: auth);
    final uri = _baseUri.replace(path: path);
    final res = await _client.post(uri, headers: headers, body: body == null ? null : jsonEncode(body)).timeout(_timeout);
    return _decodeEnvelope(res);
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
