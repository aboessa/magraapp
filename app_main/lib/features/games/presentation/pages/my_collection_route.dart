/// Riverpod wiring for «مجموعتي».
///
/// The page itself takes plain arguments so it can be widget-tested without a
/// `ProviderScope`. This file is the only place that knows where a child id and a
/// store come from, which is what makes the route a one-line construction.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../child/application/child_provider.dart';
import '../../../home/application/home_providers.dart';
import '../../data/local_creation_store.dart';
import 'my_collection_page.dart';

/// One store for the whole app: it is stateless beyond `SharedPreferences`, and a
/// second instance would not be wrong, merely wasteful.
final localCreationStoreProvider = Provider<LocalCreationStore>((ref) {
  return LocalCreationStore();
});

/// Stickers for the active child.
///
/// Returns an empty list rather than throwing when there is no child or the
/// request fails: «مجموعتي» is the child's own space and must open even offline.
final earnedStickersProvider = FutureProvider<List<EarnedSticker>>((ref) async {
  final childId = ref.watch(childProvider).activeChildId;
  if (childId == null || childId.isEmpty) return const [];
  final api = ref.watch(majarraApiClientProvider);
  try {
    final rows = await api.fetchRewards(childId: childId);
    return rows.map(EarnedSticker.fromJson).toList(growable: false);
  } catch (_) {
    return const [];
  }
});

/// Route target for `/my-collection`.
///
/// Resolves the active child itself rather than taking it from the path, so a
/// deep link cannot be used to name another child's collection. With no child
/// selected it sends the visitor to the child switcher instead of showing an
/// empty shelf that looks like data loss.
class MyCollectionRoute extends ConsumerWidget {
  const MyCollectionRoute({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(childProvider).activeChildId;

    if (childId == null || childId.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: const Text('مجموعتي')),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.face_outlined, size: 56),
                const SizedBox(height: 12),
                Text('اختر طفلًا أولًا', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                const Text(
                  'مجموعتي تعرض رسومات طفل واحد وملصقاته.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      );
    }

    return MyCollectionPage(
      childId: childId,
      creationStore: ref.watch(localCreationStoreProvider),
      loadStickers: () async => await ref.read(earnedStickersProvider.future),
    );
  }
}
