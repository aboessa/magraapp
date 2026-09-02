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

/// يوحّد مصادر الألعاب بقاعدة واحدة: **الخادم هو المصدر، والمبندل بديلٌ مُعلَن**.
///
/// ## ما كان في `play_page.dart`
///
/// كانت الصفحة تدمج ثلاثة مصادر **بلا شرط**: ألعاب الخادم، ثم
/// `LocalCatalog.experiences` مباشرةً، ثم `catalog.experiences` — ثم إن خلا الكل
/// أضافت **ثلاث ألعاب مكتوبة في الكود** كـ«بديل مطلق». وتعليقها يقول عن المبندل
/// «always exists» كأن ذلك ميزة.
///
/// وأثره أن الطفل يرى ألعابًا من الحزمة **حتى والشبكة سليمة تمامًا**. وردّ الخادم
/// `fetchGames(childId:)` هو ما يطبّق حالة النشر والمسار العمري والاستحقاق؛
/// و`ExperienceItem` المبندل لا يحمل حالةً ولا عمرًا، فلا شيء منها يُطبَّق عليه.
/// أي أن **سياسة النشر تُتجاوز في كل جولة**، لا في الانقطاع وحده — وهو ما وصفه
/// `APP-103` بأنه يحدث «في وضع الانقطاع».
///
/// ## القاعدة هنا
///
/// المبندل يُستخدم **فقط** إذا لم يُنتج الخادم ولا الكاتالوج شيئًا **و**كان
/// الكاتالوج نفسه على المسار المبندل (أي أن الشبكة فشلت فعلًا). فالمبندل بديلُ
/// انقطاعٍ لا إضافةً دائمة. ولا ألعاب مكتوبة في الكود بحال: «بديل مطلق» يعني
/// محتوًى لا يعرفه الخادم ولا يستطيع أحد سحبه.
PlayCatalog resolvePlayableGames({
  required List<ExperienceItem> server,
  required List<ExperienceItem> catalog,
  required List<ExperienceItem> bundled,
  required bool catalogIsBundled,
}) {
  final seen = <String>{};
  final games = <ExperienceItem>[];

  void addAll(Iterable<ExperienceItem> items) {
    for (final item in items) {
      // المعرّفات تُقارَن بعد تطبيع سابقة `game-`: الخادم والحزمة كتباها بصيغتين.
      final id = item.id;
      final prefixed = id.startsWith('game-') ? id : 'game-$id';
      final bare = id.startsWith('game-') ? id.substring(5) : id;
      if (seen.contains(id) || seen.contains(prefixed) || seen.contains(bare)) {
        continue;
      }
      seen
        ..add(id)
        ..add(prefixed)
        ..add(bare);
      games.add(item);
    }
  }

  addAll(server);
  addAll(catalog);

  // الشرطان معًا: لا شيء حيّ، **و**الكاتالوج يعلن أنه مبندل. فردٌّ فارغ صحيح من
  // الخادم (الطفل التجريبي يُعيد `[]` بقصد) لا يُعتبر انقطاعًا فتُحشَر له الحزمة.
  if (games.isEmpty && catalogIsBundled) {
    addAll(bundled);
    return PlayCatalog(games: List.unmodifiable(games), usesBundled: games.isNotEmpty);
  }

  return PlayCatalog(games: List.unmodifiable(games), usesBundled: false);
}
