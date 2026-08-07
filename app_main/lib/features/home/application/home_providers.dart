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
  );
});

final contentRepositoryProvider = Provider<ContentRepository>((ref) {
  return ContentRepository(ref.watch(majarraApiClientProvider));
});

final homeCatalogProvider = FutureProvider<HomeCatalog>((ref) {
  return ref.watch(contentRepositoryProvider).loadHome();
});
