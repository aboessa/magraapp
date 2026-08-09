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
import '../../application/creation_cloud_service.dart';
import '../../data/local_creation_store.dart';
import 'my_collection_page.dart';

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
      onKeepInAlbum: (creation) => _keepInAlbum(context, ref, childId, creation),
      onRemoveFromAlbum: (creation) async {
        final removed = await ref
            .read(creationCloudServiceProvider)
            .deleteRemote(creation.uploadedCreationId!);
        if (!removed) return 'لم نتمكّن من الإزالة. رسمتك ما زالت على الجهاز.';
        await ref
            .read(localCreationStoreProvider)
            .markUploaded(childId, creation.id, '');
        return null;
      },
    );
  }

  /// Keeps a drawing in family storage, asking for consent first if needed.
  ///
  /// Consent is requested at the moment it is needed rather than at sign-up: a
  /// parent asked to agree to image retention before any drawing exists has nothing
  /// to decide about.
  Future<String?> _keepInAlbum(
    BuildContext context,
    WidgetRef ref,
    String childId,
    LocalCreation creation,
  ) async {
    final service = ref.read(creationCloudServiceProvider);

    if (!await service.hasConsent(childId)) {
      if (!context.mounted) return 'تعذّر التحقّق من الموافقة.';
      final agreed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('نحفظ رسومات طفلك؟'),
          content: const Text(
            'ستُحفظ الرسمة في مساحة خاصة بأسرتك فقط.\n\n'
            '• لا تُنشر ولا تُشارك ولا يراها أحد خارج أسرتك.\n'
            '• يمكنك حذفها أو سحب الموافقة في أي وقت.\n'
            '• الرسمة تبقى على الجهاز سواء وافقت أو لا.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('لا، اتركها على الجهاز'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('أوافق'),
            ),
          ],
        ),
      );
      if (agreed != true) return 'الرسمة باقية على هذا الجهاز فقط.';
      if (!await service.grantConsent(childId)) {
        return 'لم نتمكّن من تسجيل الموافقة. حاول لاحقًا.';
      }
    }

    final result = await service.save(creation);
    switch (result.outcome) {
      case CloudSaveOutcome.saved:
        return null;
      case CloudSaveOutcome.consentRequired:
        return 'تحتاج موافقة ولي الأمر أولًا.';
      case CloudSaveOutcome.storageUnavailable:
        return 'حفظ الأسرة غير مُهيَّأ بعد. رسمتك على الجهاز.';
      case CloudSaveOutcome.failed:
        return 'لم نتمكّن من الحفظ. رسمتك ما زالت على الجهاز.';
    }
  }
}
