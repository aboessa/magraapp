/// قواعد قرار رحلة أوّل استخدام، دوالُّ خالصة (`BUILD-201`).
///
/// ## لماذا هنا لا في `AuthGuard` ولا في `app_router.dart`
///
/// `AuthGuard` يحمل **حالةً** ولا يقرأ مزوّدًا واحدًا — وهذا ثابتٌ مقصود موصَّف
/// في رأسه. و`_guardRedirect` يقرأ منطقيّات مُحسَّبة مسبقًا ويبقى متزامنًا.
/// فالقاعدة التي تحتاج الاثنين (حالة الأسرة + خطوةٌ محفوظة) لا موضع لها في
/// أيّهما، وتُكتب دوالَّ خالصة: مدخلاتٌ صريحة، ولا `ref`، ولا وقت، ولا تخزين.
///
/// وأثر ذلك أن كل قاعدةٍ أدناه تُختبَر بجدول قيمٍ بلا بناء شجرة widgets.
library;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/router/auth_guard.dart';
import '../../child/application/family_children_provider.dart';
import '../../child/domain/child_profile.dart';

/// يحوّل نتيجة `familyChildrenProvider` إلى [FamilyOnboardingStatus].
///
/// الترتيب حاكم: **الخطأ يُفحص قبل وجود القيمة**، لأن `AsyncValue` قد يحمل
/// قيمةً قديمة وخطأً جديدًا معًا عند إعادة الجلب، وقراءتها «بيانات» تُخفي
/// الفشل. و«لا قيمة» تعني [FamilyOnboardingStatus.loading] لا صفر أطفال —
/// وهذا هو الفرق الذي وُجد هذا النوع كلّه من أجله.
FamilyOnboardingStatus familyOnboardingStatusFor(
  AsyncValue<List<ChildProfile>> children,
) {
  if (children.hasError) return FamilyOnboardingStatus.error;
  if (!children.hasValue) return FamilyOnboardingStatus.loading;
  // `valueOrNull` لا `value`: الثانية **ترمي** على `AsyncError`. الحرس أعلاه
  // يكفي هنا، لكن الاعتماد على ترتيب سطرين أهشّ من استعمال الواجهة التي لا ترمي.
  final rows = children.valueOrNull ?? const <ChildProfile>[];
  // عدد الأطفال لا الختم: حسابٌ أُنشئ قبل وجود `onboarding_completed_at` له
  // طفلٌ بلا ختم، وهو أكمل التهيئة بمعناها. فالاستجابة الناجحة **الفارغة**
  // وحدها أسرةٌ جديدة.
  return rows.isEmpty
      ? FamilyOnboardingStatus.incomplete
      : FamilyOnboardingStatus.complete;
}

/// هل في الأسرة طفلٌ يحمل `onboarding_completed_at`؟
///
/// الختم **دليلُ أن الرحلة الحالية هي التي أنشأت هذا الطفل**، لأنه يُكتب في
/// خطوة إنشاء الطفل داخل الرحلة. وهو ما يفرّق «رحلةٌ في منتصفها» عن «حسابٌ قديم
/// خلّف خطوةً في التخزين».
/// **`valueOrNull` لا `value`.** `AsyncValue.value` ترمي الخطأ المحفوظ عند
/// `AsyncError`، فاستعمالها هنا كان يحوّل فشل جلبٍ مُعالَجًا إلى خطأٍ غير مُعالَج
/// يُصعَّد من داخل بناء الشجرة — أي أن الدالّة التي كُتبت لتقرأ الحالة كانت تُسقط
/// الإطار الذي يقرؤها.
bool anyChildCarriesOnboardingStamp(AsyncValue<List<ChildProfile>> children) {
  final rows = children.valueOrNull ?? const <ChildProfile>[];
  return rows.any((child) => child.onboardingCompletedAt != null);
}

/// هل تُعرَض رحلة أوّل استخدام الآن؟
///
/// الحالات، وكلٌّ منها يقابل اختبارًا في
/// `test/onboarding_journey_integration_test.dart`:
///
/// | الحالة | خطوة محفوظة | طفلٌ بختم | النتيجة |
/// |---|---|---|---|
/// | `incomplete` | — | — | **نعم** — أسرةٌ بلا أطفال تبدأ الرحلة |
/// | `loading` | نعم | — | **نعم** — الخطوة المحفوظة تُستأنف قبل حسم الجلب |
/// | `loading` | لا | — | لا — شاشة الأطفال تعرض مؤشّر تحميل |
/// | `error` | لا | — | لا — شاشةٌ قابلة لإعادة المحاولة، لا رحلة |
/// | `complete` | نعم | نعم | **نعم** — رحلةٌ في منتصفها: الطفل أُنشئ قبل قليل |
/// | `complete` | نعم | لا | لا — حسابٌ قديم، والخطوة مخلَّفات (انظر [persistedStepIsStale]) |
/// | `complete` | لا | — | لا |
///
/// و[error] مع خطوةٍ محفوظة تُعيد `true`: الخطوة دليلٌ محليٌّ لا يحتاج الشبكة،
/// فحجبُ الرحلة على تعذُّر الجلب كان سيقطع مستخدمًا في منتصفها لأن الشبكة
/// انقطعت.
bool onboardingJourneyIsActive({
  required FamilyOnboardingStatus status,
  required bool hasPersistedStep,
  required bool anyChildStamped,
}) {
  switch (status) {
    case FamilyOnboardingStatus.incomplete:
      return true;
    case FamilyOnboardingStatus.loading:
    case FamilyOnboardingStatus.error:
      return hasPersistedStep;
    case FamilyOnboardingStatus.complete:
      return hasPersistedStep && anyChildStamped;
  }
}

/// خطوةٌ محفوظة لا تنتمي إلى أيّ رحلة، فتُمسح.
///
/// الشرط الثلاثي مقصود كلُّه: الحالة **مُحسَّمة** [complete] (لا تُمسح على
/// تحميلٍ أو خطأ، فقد تعود القائمة بطفلٍ مختوم)، وثمّة خطوةٌ محفوظة، ولا طفل
/// يحمل ختمًا. وبلا الشرط الأوّل كان خطأُ شبكةٍ واحد يمحو موضع مستخدمٍ في
/// منتصف رحلته.
bool persistedStepIsStale({
  required FamilyOnboardingStatus status,
  required bool hasPersistedStep,
  required bool anyChildStamped,
}) =>
    status == FamilyOnboardingStatus.complete &&
    hasPersistedStep &&
    !anyChildStamped;

/// حالة تهيئة الأسرة كمزوّدٍ مشتقّ.
///
/// ## لماذا مزوّدٌ وسيط بدل `ref.listen` مباشرةً على `familyChildrenProvider`
///
/// `ref.listen` على مزوّدٍ غير متزامن **يُصعِّد** الفشل إلى النطاق بدل أن
/// يُسلّمه إلى المستمع، فكان `StateError` الآتي من `fetchChildren` يظهر خطأً غير
/// مُعالَج ويُسقط الإطار قبل أن تُحسَب الحالة — أي أن `error` كانت غير قابلة
/// للوصول عمليًّا.
///
/// و`ref.watch` لا يرمي: يُعيد `AsyncError` **قيمةً**. فهذا المزوّد يحوّل
/// اللامتزامن إلى متزامنٍ لا يفشل، ويصير ما يستمع إليه الموجّه
/// `Provider<FamilyOnboardingStatus>` عاديًّا.
final familyOnboardingStatusProvider = Provider<FamilyOnboardingStatus>((ref) {
  return familyOnboardingStatusFor(ref.watch(familyChildrenProvider));
});

/// هل في الأسرة طفلٌ بختم تهيئة؟ مزوّدٌ مشتقّ لنفس سبب أعلاه.
final anyChildStampedProvider = Provider<bool>((ref) {
  return anyChildCarriesOnboardingStamp(ref.watch(familyChildrenProvider));
});
