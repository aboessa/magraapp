/// أطفال الأسرة، ومراجعة انتقال المسار العمري (`APP-102`).
///
/// كان المزوّدان مُعلَنَين داخل `presentation/pages/child_switcher_page.dart`.
/// و`familyChildrenProvider` **ليس تفصيلًا في صفحة**: يقرأه `app_router.dart`
/// ليقرّر ما إذا كانت الأسرة أكملت التهيئة، ولوحة وليّ الأمر، ونموذج ملف الطفل،
/// وصفحة مراجعة العمر، وخطوة الضوابط في التهيئة — سبعة مواضع تستورد **ملف صفحة**
/// لتصل إلى حالة تخصّ التطبيق كلّه.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../home/application/home_providers.dart';
import '../domain/child_profile.dart';

final familyChildrenProvider = FutureProvider<List<ChildProfile>>((ref) async {
  // `authSessionKeyProvider` لا `authGuardProvider` وحده: الثاني `Provider`
  // يُعيد `ChangeNotifier` **ثابت الهوية**، فـ`ref.watch` عليه لا يُعيد الحساب
  // عند إخطاره — والنتيجة أن هذا المزوّد كان يُحسب مرّة واحدة قبل الدخول
  // (`isLoading == true`)، فيُخزَّن `const []` ولا يُعاد جلبه بعد نجاح الدخول:
  // «من يشاهد الآن؟» تبقى فارغة رغم أن الخادم يُعيد الأطفال.
  ref.watch(authSessionKeyProvider);
  final guard = ref.read(authGuardProvider);
  // No authenticated session yet — don't hit the API, otherwise every guest
  // on /login triggers GET /family/children → 401 (seen in DevTools).
  // Demo returns its local child without ever calling the server.
  if (guard.isDemo) return _demoChildren;
  if (!guard.isAuthenticated || guard.isLoading) return const <ChildProfile>[];
  // الفشل يُرفَع ولا يُبتلَع (`APP-205`, `BUILD-201`).
  //
  // كان هنا `catch (_) { return const []; }` بحجّة «لا تُلقِ من مستمع الموجّه».
  // والحجّة سقطت من طرفين: الحالتان التي كانت تحميان منها (`401` قبل استقرار
  // الحراسة، وجلسةٌ لم تُحمَّل بعد) يحسمهما الشرطان أعلاه بعودةٍ مبكّرة قبل أي
  // نداء؛ وثمنُها أن **قائمةً فارغة صارت جواب الفشل أيضًا**، فيقرأ الموجّه
  // «أسرةٌ جديدة» على انقطاع شبكةٍ عابر ويُعيد رحلة أوّل استخدام على أسرةٍ
  // أكملتها.
  //
  // ومستهلِكا هذا المزوّد يتعاملان مع الخطأ صراحةً اليوم: `ChildSwitcherPage`
  // يعرض `_RosterLoadError` بزرّ إعادة محاولة، ومستمع `routerProvider` يحوّله
  // إلى `FamilyOnboardingStatus.error` — وكلاهما أصدق من فراغٍ بشكل نجاح.
  final api = ref.watch(majarraApiClientProvider);
  final rows = await api.fetchChildren();
  return rows
      .map(ChildProfile.fromJson)
      .where((c) => c.id.isNotEmpty)
      .toList(growable: false);
});

const _demoChildren = <ChildProfile>[
  ChildProfile(id: 'demo-child', nickname: 'الضيف', ageTrack: 'preschool', birthMonth: 6, birthYear: 2021, avatarId: 'luna'),
];

/// Whether a child's server-recomputed age track differs from the one
/// currently stored, keyed by child id.
///
/// Calls the no-write `review` action of `POST
/// .../track-transition` (task 25) rather than recomputing the track
/// locally — Requirement 12.6 forbids the client deriving `age_track`
/// independently, so the server's `deriveAgeTrack` comparison is the only
/// source of truth for "has this child's age track changed".
///
/// A `FutureProvider.family` rather than a single bulk fetch: there is no
/// batched review endpoint (out of scope to add one for this task), and the
/// family size a plan allows (`PLAN_LIMITS`) is small — at most a handful of
/// children — so one `review` call per visible child stays a bounded,
/// small cost rather than a scalability concern. Consumed by
/// `ParentDashboardPage`'s children list to decide, per child, whether to
/// surface an entry point into `AgeTransitionReviewPage`.
final childTrackTransitionReviewProvider =
    FutureProvider.family<Map<String, dynamic>, String>((ref, childId) async {
  final api = ref.watch(majarraApiClientProvider);
  return api.trackTransition(childId, action: 'review');
});
