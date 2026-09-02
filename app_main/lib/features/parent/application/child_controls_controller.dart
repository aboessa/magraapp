import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/diagnostics/ignored_errors.dart';
import '../../../core/failures/app_failure.dart';
import '../../home/application/home_providers.dart';
import '../data/child_controls_repository.dart';

final childControlsRepositoryProvider = Provider<ChildControlsRepository>(
  (ref) => ChildControlsRepository(ref.watch(majarraApiClientProvider)),
);

/// حالة كتابة ضبطٍ رقابي.
@immutable
class ChildControlsState {
  const ChildControlsState({this.saving = false, this.failure});

  /// كتابةٌ جارية الآن.
  final bool saving;

  /// رسالة صالحة للعرض على وليّ الأمر، أو `null` إن لم يفشل شيء.
  ///
  /// من `AppFailure` لا من `toString()` الاستثناء: الأخير يعرض نصّ الخادم أو
  /// `SocketException` على وليّ أمر.
  final String? failure;

  ChildControlsState copyWith({bool? saving, String? failure, bool clearFailure = false}) =>
      ChildControlsState(
        saving: saving ?? this.saving,
        failure: clearFailure ? null : (failure ?? this.failure),
      );
}

/// كتابة الضوابط الرقابية لطفل، بنتيجةٍ **ظاهرة** (`APP-102`).
///
/// ## العطل الذي يُغلقه هذا الملف
///
/// ستّ كتابات لضوابط رقابية كانت مكتوبة داخل `onChanged`/`onPressed` في شجرة
/// العناصر، **خمسٌ منها بلا أي `catch`** والسادسة بـ`try/finally` بلا `catch`.
///
/// وأثر ذلك ليس تقنيًّا: وليّ الأمر يسحب شريط «وقت الشاشة اليومي» إلى ٣٠ دقيقة،
/// أو يضبط نافذة النوم، فيفشل الطلب — ولا يُخبَره أحد. الاستثناء يهرب من نداء
/// غير متزامن في مُعالِج حدث إلى منطقة أخطاء التطبيق، والشاشة تُعيد رسم **القيمة
/// القديمة** بلا كلمة. فيخرج من الصفحة وهو يظنّ الضبط ساريًا، والطفل يشاهد بلا
/// حدّ.
///
/// وهذا أخطر ما وجدته في `APP-102`: البند يصف «طبقات غير متسقة»، والأثر الفعلي
/// **ضابط أمان للطفل يفشل صامتًا**.
///
/// ## القرار: لا يُرفَع، ويُعرَض
///
/// المتحكّم **لا يعيد رفع** الاستثناء: نداء من مُعالِج حدث لا يملك من يلتقطه،
/// ورفعُه هو ما جعله صامتًا أوّلًا. بدلًا من ذلك يضع رسالةً في حالته لتعرضها
/// الشاشة، ويسجّل الفشل عبر قناة `APP-106`.
///
/// و`childSettingsProvider` **لا يُبطَل إلا عند النجاح**: إبطاله بعد فشلٍ يُعيد
/// جلب نفس القيَم القديمة، فيبدو الأمر كأن الشاشة «حدّثت» ولم يتغيّر شيء — وهو
/// أسوأ من عدم التحديث لأنه يُقرأ نجاحًا.
class ChildControlsController extends StateNotifier<ChildControlsState> {
  ChildControlsController(this._ref, this._childId) : super(const ChildControlsState());

  final Ref _ref;
  final String _childId;

  Future<void> setDailyMinutes(int minutes) =>
      _write('daily_minutes', (repo) => repo.setDailyMinutes(_childId, minutes));

  Future<void> setBedtimeStart(String time) =>
      _write('bedtime_start', (repo) => repo.setBedtimeStart(_childId, time));

  Future<void> setBedtimeEnd(String time) =>
      _write('bedtime_end', (repo) => repo.setBedtimeEnd(_childId, time));

  Future<void> clearBedtime() =>
      _write('bedtime_clear', (repo) => repo.clearBedtime(_childId));

  Future<void> setAllowSpeedChange(bool allowed) =>
      _write('allow_speed_change', (repo) => repo.setAllowSpeedChange(_childId, allowed));

  Future<void> setAutoplayOverride(String value) =>
      _write('autoplay_override', (repo) => repo.setAutoplayOverride(_childId, value));

  /// يُخفي رسالة الفشل بعد عرضها.
  void acknowledgeFailure() {
    if (state.failure == null) return;
    state = state.copyWith(clearFailure: true);
  }

  /// مسار واحد لكل الكتابات: علَم الحفظ، والإبطال عند النجاح وحده، والرسالة عند
  /// الفشل. ستّة مسارات كانت تعني ستّ فرص للاختلاف — وقد اختلفت.
  Future<void> _write(
    String field,
    Future<void> Function(ChildControlsRepository repo) request,
  ) async {
    state = state.copyWith(saving: true, clearFailure: true);
    try {
      await request(_ref.read(childControlsRepositoryProvider));
      _ref.invalidate(childSettingsProvider(_childId));
      // `mounted` يُفحَص بعد كل `await`: قد يُتخلَّص من المتحكّم أثناء الطلب إن
      // خرج وليّ الأمر من الصفحة، وضبطُ الحالة بعده يرمي.
      if (mounted) state = state.copyWith(saving: false);
    } catch (error, stack) {
      reportIgnoredError('child_controls.$field', error, stack);
      if (mounted) {
        state = ChildControlsState(
          saving: false,
          failure: AppFailure.fromException(error).message,
        );
      }
    }
  }
}

final childControlsControllerProvider =
    StateNotifierProvider.family<ChildControlsController, ChildControlsState, String>(
      (ref, childId) => ChildControlsController(ref, childId),
    );
