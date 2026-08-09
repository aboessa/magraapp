import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../../auth/data/auth_storage.dart';
import '../data/content_repository.dart';
import '../data/majarra_api_client.dart';
import '../domain/content_models.dart';

final httpClientProvider = Provider<http.Client>((ref) {
  final client = http.Client();
  ref.onDispose(client.close);
  return client;
});

final authStorageProvider = Provider<AuthStorage>((ref) => AuthStorage());

final majarraApiClientProvider = Provider<MajarraApiClient>((ref) {
  final storage = ref.watch(authStorageProvider);
  return MajarraApiClient(
    ref.watch(httpClientProvider),
    getAccessToken: () => storage.getAccessToken(),
    getRefreshToken: () => storage.getRefreshToken(),
    updateTokens: ({required String accessToken, required String refreshToken}) =>
        storage.updateTokens(accessToken: accessToken, refreshToken: refreshToken),
    clearAuth: () => storage.clear(),
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
    FutureProvider.family<List<StoryPage>, StoryPagesRequest>((
      ref,
      request,
    ) async {
      final api = ref.watch(majarraApiClientProvider);
      final pages = await api.fetchStoryPages(
        request.bookId,
        language: request.language,
      );
      return pages.map((dto) => dto.toDomain()).toList(growable: false);
    });
