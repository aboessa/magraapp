import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../../app/router/auth_guard.dart';
import '../../../core/cache/reader_page_cache.dart';
import '../../../core/env/app_version.dart';
import '../../../core/errors/crash_reporter.dart';
import '../../auth/application/auth_controller.dart';
import '../../auth/data/auth_storage.dart';
import '../../child/application/child_provider.dart';
import '../data/content_dtos.dart';
import '../data/content_repository.dart';
import '../data/majarra_api_client.dart';
import '../domain/content_models.dart';
import '../domain/feed_blocks.dart';
import 'home_layout.dart';

final httpClientProvider = Provider<http.Client>((ref) {
  final client = http.Client();
  ref.onDispose(client.close);
  return client;
});

final authStorageProvider = Provider<AuthStorage>((ref) => AuthStorage());

final majarraApiClientProvider = Provider<MajarraApiClient>((ref) {
  final storage = ref.watch(authStorageProvider);
  final guard = ref.watch(authGuardProvider);
  return MajarraApiClient(
    ref.watch(httpClientProvider),
    getAccessToken: () => storage.getAccessToken(),
    getRefreshToken: () => storage.getRefreshToken(),
    getParentProof: () => guard.parentProof,
    updateTokens:
        ({required String accessToken, required String refreshToken}) => storage
            .updateTokens(accessToken: accessToken, refreshToken: refreshToken),
    clearAuth: () => ref.read(authControllerProvider).handleRefreshFailure(),
  );
});

final contentRepositoryProvider = Provider<ContentRepository>((ref) {
  return ContentRepository(ref.watch(majarraApiClientProvider));
});

final homeCatalogProvider = FutureProvider<HomeCatalog>((ref) {
  return ref.watch(contentRepositoryProvider).loadHome();
});

/// Identifies a reader request: which book, in which language.
class StoryPagesRequest {
  const StoryPagesRequest({required this.bookId, this.language = 'ar'});

  final String bookId;
  final String language;

  @override
  bool operator ==(Object other) =>
      other is StoryPagesRequest &&
      other.bookId == bookId &&
      other.language == language;

  @override
  int get hashCode => Object.hash(bookId, language);
}

/// Reader pages for one book.
///
/// Kept separate from [homeCatalogProvider] because page bodies and artwork are
/// far larger than catalogue rows: loading them for every book on the home screen
/// would be wasteful. The reader requests only the story being opened.
///
/// An empty list is a legitimate result, not an error: it means the story has no
/// published pages yet, and the reader renders its unavailable state.
final storyPagesProvider =
    FutureProvider.family<ReaderPageCollection, StoryPagesRequest>((
      ref,
      request,
    ) async {
      return _loadReaderPages(
        ref,
        request: request,
        kind: ReaderPageCacheKind.book,
        fetch: (api) =>
            api.fetchBookPagesEnvelope(request.bookId, language: request.language),
      );
    });

/// Reader pages for one story — canonical, not a book.
///
/// Stories and books are separate entities. Reusing the book endpoint for a
/// story was the root cause of `story-bird-home` 404.
final storyStoryPagesProvider =
    FutureProvider.family<ReaderPageCollection, StoryPagesRequest>((
      ref,
      request,
    ) async {
      return _loadReaderPages(
        ref,
        request: request,
        kind: ReaderPageCacheKind.story,
        fetch: (api) => api.fetchStoryPagesEnvelope(
          request.bookId,
          language: request.language,
        ),
      );
    });

/// Fetches reader pages, persisting the envelope so a later offline open keeps
/// the full page metadata — narration `duration_ms` and dwell `dwell_ms`
/// included — and needs no network during playback.
Future<ReaderPageCollection> _loadReaderPages(
  Ref ref, {
  required StoryPagesRequest request,
  required ReaderPageCacheKind kind,
  required Future<Map<String, dynamic>> Function(MajarraApiClient api) fetch,
}) async {
  final api = ref.watch(majarraApiClientProvider);
  const cache = ReaderPageCache();
  try {
    final envelope = await fetch(api);
    await cache.save(
      kind: kind,
      contentId: request.bookId,
      language: request.language,
      envelope: envelope,
    );
    return ReaderPageCollectionDto.fromEnvelope(
      envelope,
      requestedLanguage: request.language,
    ).toDomain();
  } on Object {
    final cached = await cache.read(
      kind: kind,
      contentId: request.bookId,
      language: request.language,
    );
    // No snapshot means the reader must surface the real error rather than an
    // empty or substituted story.
    if (cached == null) rethrow;
    return ReaderPageCollectionDto.fromEnvelope(
      cached,
      requestedLanguage: request.language,
    ).toDomain();
  }
}

final recommendationsProvider = FutureProvider.family<List<String>, String>((
  ref,
  childId,
) async {
  final api = ref.watch(majarraApiClientProvider);
  final res = await api.fetchRecommendations(childId: childId);
  final data = res['data'];
  if (data is! List) return const [];
  return data
      .map((e) => (e is Map ? e['series_id']?.toString() ?? '' : ''))
      .where((s) => s.isNotEmpty)
      .toList();
});

final childSettingsProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, childId) async {
      final api = ref.watch(majarraApiClientProvider);
      final res = await api.fetchChildSettings(childId);
      return (res['data'] as Map?)?.cast<String, dynamic>() ?? {};
    });

/// One block of the Home configuration, as the server resolved it.
class ResolvedHomeBlock {
  const ResolvedHomeBlock({
    required this.id,
    required this.type,
    this.title,
    this.subtitle,
    this.source,
    this.cardStyle,
    this.maxItems,
    this.isSystem = false,
    this.position = 0,
  });
  final String id;
  final String type;
  final String? title;
  final String? subtitle;
  final String? source;
  final String? cardStyle;
  final int? maxItems;
  final bool isSystem;
  final int position;

  factory ResolvedHomeBlock.fromJson(Map<String, dynamic> j) {
    final config = j['config'];
    final configMap = config is Map ? config.cast<String, dynamic>() : const {};
    return ResolvedHomeBlock(
      id: j['id'] as String,
      type: (j['type'] as String?) ?? (j['block_type'] as String? ?? ''),
      title: j['title'] as String?,
      subtitle: j['subtitle'] as String?,
      source: j['source'] as String?,
      cardStyle: j['card_style'] as String?,
      maxItems: (configMap['maxItems'] as num?)?.toInt(),
      isSystem: j['is_system'] as bool? ?? j['source'] == 'system',
      position:
          (j['position'] as num?)?.toInt() ??
          (j['sort_order'] as num?)?.toInt() ??
          99,
    );
  }
}

/// The Home configuration response, including whether the server itself fell back.
class ResolvedHomeResponse {
  const ResolvedHomeResponse({required this.blocks, required this.serverFallback});
  final List<ResolvedHomeBlock> blocks;

  /// The server reported that it could not read a configuration and served its
  /// own minimal layout. Distinguished from a configured Home because they mean
  /// different things operationally, and the previous endpoint made them look
  /// identical.
  final bool serverFallback;
}

/// Fetches the resolved Home configuration for the active child.
///
/// Targeting is sent from what the client actually knows. The track comes from
/// the active child's age band; sending a guess would target the wrong band, and
/// omitting it lets the server apply its own default rather than the client
/// inventing one.
final resolvedHomeProvider = FutureProvider<ResolvedHomeResponse>((ref) async {
  final api = ref.watch(majarraApiClientProvider);
  final res = await api.fetchResolvedHome(
    track: ref.watch(childProvider).ageTrack,
    language: 'ar',
    platform: 'phone',
    appVersion: AppVersion.current,
  );
  final data = res['data'];
  final map = data is Map<String, dynamic> ? data : const <String, dynamic>{};
  final rawBlocks = map['blocks'] ?? (data is List ? data : null);
  final meta = map['meta'];
  final serverFallback =
      meta is Map && meta['fallback'] == true;
  if (rawBlocks is! List) {
    return const ResolvedHomeResponse(blocks: [], serverFallback: true);
  }
  return ResolvedHomeResponse(
    blocks: rawBlocks
        .whereType<Map<Object?, Object?>>()
        .map((e) => ResolvedHomeBlock.fromJson(e.cast<String, dynamic>()))
        .toList(),
    serverFallback: serverFallback,
  );
});

/// The layout the Home screen renders.
///
/// This is the provider `HomeFeed` reads, and it is the reason the Home Builder
/// is no longer write-only: the dashboard's order, titles, subtitles, enable
/// flags, targeting and scheduling all arrive here.
///
/// It never fails. A network error, an unparseable payload or a configuration
/// containing nothing this build can render all resolve to
/// [HomeFeedContract.fallback], because a child opening the app is not the right
/// audience for a configuration problem. The origin is reported on the result so
/// the screen can say which it is showing.
final homeLayoutProvider = FutureProvider<HomeLayout>((ref) async {
  final unsupported = <String>[];
  try {
    final resolved = await ref.watch(resolvedHomeProvider.future);
    final contract = contractFromResolvedBlocks(
      [
        for (final block in resolved.blocks)
          ResolvedHomeBlockConfig(
            id: block.id,
            type: block.type,
            title: block.title,
            subtitle: block.subtitle,
            cardStyle: block.cardStyle,
            maxItems: block.maxItems,
            isSystem: block.isSystem,
          ),
      ],
      unsupported: unsupported,
    );
    if (contract == null) {
      return HomeLayout(
        contract: HomeFeedContract.fallback(),
        source: resolved.serverFallback
            ? HomeLayoutSource.serverFallback
            : HomeLayoutSource.localFallback,
        unsupportedTypes: unsupported,
      );
    }
    return HomeLayout(
      contract: contract,
      source: resolved.serverFallback
          ? HomeLayoutSource.serverFallback
          : HomeLayoutSource.server,
      unsupportedTypes: unsupported,
    );
  } on Object catch (error, stack) {
    // Reported, not swallowed. The previous provider ended in `catch (_) { return
    // const []; }`, so a persistently failing endpoint was invisible.
    CrashReporter.report(error, stack, context: 'home_layout_resolve');
    return HomeLayout(
      contract: HomeFeedContract.fallback(),
      source: HomeLayoutSource.localFallback,
      unsupportedTypes: unsupported,
    );
  }
});
