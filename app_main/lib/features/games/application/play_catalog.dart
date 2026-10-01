import 'package:flutter/foundation.dart';

import '../../home/domain/content_models.dart';

/// ما تعرضه شاشة «العب»، ومن أين جاء (`APP-103`).
@immutable
class PlayCatalog {
  const PlayCatalog({required this.games, required this.usesBundled});

  final List<ExperienceItem> games;

  /// المعروض من الحزمة المبندلة لا من الخادم، فيجب أن **يُقال للمستخدم**.
  final bool usesBundled;
}

/// حالة طلب قائمة الألعاب الخاصة بالطفل.
enum PlayServerState { loading, completed, error }

/// يختار مصدر ألعاب واحدًا: الخادم، ثم الكاتالوج البعيد، ثم بديل الانقطاع.
///
/// كل رد مكتمل من الخادم حاكم، حتى القائمة الفارغة، لأنه يطبّق حالة النشر
/// والمسار العمري والاستحقاق. لا تظهر المصادر البديلة أثناء التحميل، ولا تُستخدم
/// بعد اكتمال الطلب. والكاتالوج المبندل لا يُستخدم إلا عند انقطاع معلن.
PlayCatalog resolvePlayableGames({
  required PlayServerState serverState,
  required List<ExperienceItem> server,
  required List<ExperienceItem> catalog,
  required List<ExperienceItem> bundled,
  required bool catalogIsBundled,
  required bool allowBundledFallback,
}) {
  if (serverState == PlayServerState.completed) {
    return PlayCatalog(games: List.unmodifiable(server), usesBundled: false);
  }

  if (serverState == PlayServerState.loading) {
    return const PlayCatalog(games: <ExperienceItem>[], usesBundled: false);
  }

  if (!catalogIsBundled && catalog.isNotEmpty) {
    return PlayCatalog(games: List.unmodifiable(catalog), usesBundled: false);
  }

  if (allowBundledFallback && bundled.isNotEmpty) {
    return PlayCatalog(games: List.unmodifiable(bundled), usesBundled: true);
  }

  return const PlayCatalog(games: <ExperienceItem>[], usesBundled: false);
}
