import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/diagnostics/ignored_errors.dart';
import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../presentation/pages/my_collection_page.dart' show EarnedSticker;

/// ملصقات الطفل النشط (`APP-102`).
///
/// كان المزوّد مُعلَنًا داخل `presentation/pages/my_collection_route.dart`.
/// ونقلُه هنا ليس ترتيبًا فحسب: هو ما يجعل «من يجلب الملصقات» قابلًا للاستبدال في
/// اختبار بلا بناء شجرة عناصر.
///
/// `EarnedSticker` ما زال مُعلَنًا في ملف الصفحة، ولذلك يُستورد بـ`show` صريح: هو
/// نموذج نطاق موضعه `domain/`، ونقلُه سحبٌ لعشرة مواضع لا يخدم هذه الدفعة —
/// والاستيراد الضيّق يجعل الدَّين **مرئيًّا** بدل أن يبدو تصميمًا.
final earnedStickersProvider = FutureProvider<List<EarnedSticker>>((ref) async {
  final childId = ref.watch(childProvider).activeChildId;
  if (childId == null || childId.isEmpty) return const [];
  final api = ref.watch(majarraApiClientProvider);
  try {
    final rows = await api.fetchRewards(childId: childId);
    return rows.map(EarnedSticker.fromJson).toList(growable: false);
  } catch (error, stack) {
    // القائمة الفارغة تبقى هي السلوك: «مجموعتي» مساحة الطفل نفسه ويجب أن تُفتح
    // حتى دون إنترنت. والفارق أن الفشل **يُسجَّل** الآن (`APP-106`): كان
    // `catch (_) { return const []; }` فيستوي «لا ملصقات بعد» بـ«فشل الجلب»،
    // ورفٌّ فارغ دائمًا لا يشتكي منه أحد ولا يظهر في أي عدّاد.
    reportIgnoredError('rewards.fetch', error, stack);
    return const [];
  }
});
