/// بوابة واحدة للأسطح التي لا تُشغَّل بلا مؤشّر (`A11Y-102`).
///
/// ## ما كان
///
/// `/studio` كان يفحص `deviceProfileProvider` **داخل بانيه** ويعرض رسالة «يحتاج
/// شاشة لمس» على التلفاز. وثلاثة روابط عميقة تفتح **الأسطح نفسها** —
/// `/studio/coloring/:id` و`/studio/reference/:id` و`/studio/trace/:id` — لم
/// تفحص شيئًا، ولا تمرّ بفحص `evaluateAvailability` الذي يحجب المحركات اللمسية
/// في `GameScreen`. فرابطٌ عميق على التلفاز كان يُنزل الطفل على لوحة رسمٍ
/// تُدار بالإصبع وحده: لا رسالة، ولا سبيل إلى الرسم بالريموت.
///
/// ## ولماذا هنا لا في كل مسار
///
/// البوابة داخل بانيَة المسار (`touchOnlyRoute`)، فمسارُ استوديو جديد يُكتب
/// عبرها **يحملها بالبناء** لا بتذكّر كاتبه. الدرس نفسه من `ADM-102`: قائمةٌ
/// ثانية تُطابَق يدويًّا تخالف الأولى عند أوّل إضافة.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/device/device_profile.dart';

/// يبني [child] إلا على التلفاز، فيعرض سببًا صريحًا بدل سطحٍ لا يُدار.
class TouchOnlySurface extends ConsumerWidget {
  const TouchOnlySurface({required this.child, super.key});

  /// دالّة لا ودجت: على التلفاز **لا يُبنى** السطح إطلاقًا، فلا يُحمَّل أصلٌ
  /// ولا يُفتح مخزنٌ لشيءٍ لن يُرى.
  final Widget Function(BuildContext context) child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final device = ref.watch(deviceProfileProvider);
    return device.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      // على تعذّر التعرّف يُبنى السطح: `DeviceProfileService` يلتقط
      // `PlatformException` و`MissingPluginException` ويُعيد «ليس تلفازًا»، فهذا
      // الفرع غير قابل للوصول عمليًّا — وحجبُ السطح عليه كان سيمنع الهواتف
      // (وهي الغالبية) على فشلٍ لا يحدث.
      error: (_, __) => child(context),
      data: (profile) =>
          profile.isTelevision ? const TouchRequiredMessage() : child(context),
    );
  }
}

/// الرسالة المعروضة على التلفاز. مُصدَّرة ليُمكن التأكيد على ظهورها بالنوع لا
/// بنصٍّ يُعاد كتابته.
class TouchRequiredMessage extends StatelessWidget {
  const TouchRequiredMessage({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFF070B1D),
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.touch_app_outlined,
              size: 58,
              color: Color(0xFF8FA0D8),
            ),
            const SizedBox(height: 14),
            Text(
              'الاستوديو يحتاج شاشة لمس',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'افتح الاستوديو على الهاتف أو الجهاز اللوحي للرسم.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
}
