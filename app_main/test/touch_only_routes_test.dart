/// أسطح الرسم على التلفاز: بوابة واحدة، ولا مسار يفوتها (`A11Y-102`).
///
/// ## العطل المقيس
///
/// `/studio` كان يفحص `deviceProfileProvider` داخل بانيه ويعرض «يحتاج شاشة
/// لمس». وثلاثة روابط عميقة تفتح **الأسطح نفسها** لم تفحص شيئًا، ولا تمرّ
/// بـ`evaluateAvailability` الذي يحجب المحركات اللمسية في `GameScreen`. فرابطٌ
/// عميق على التلفاز يُنزل الطفل على لوحة تُدار بالإصبع وحده.
///
/// ## ما تفحصه هذه الملفّة
///
/// 1. سلوك البوابة نفسها بحالات المزوّد الثلاث.
/// 2. أن **البناء لا يحدث** على التلفاز — لا مجرّد أنه لا يُرى.
/// 3. حرسٌ بنيويّ: لا مسار `/studio` يُعلَن بـ`GoRoute` عاريًا.
library;

import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/router/touch_only_surface.dart';
import 'package:majarra/core/device/device_profile.dart';

void main() {
  Widget host({
    required Future<DeviceProfile> Function() profile,
    required Widget Function(BuildContext) child,
  }) => ProviderScope(
    overrides: [deviceProfileProvider.overrideWith((ref) => profile())],
    child: MaterialApp(
      locale: const Locale('ar'),
      home: TouchOnlySurface(child: child),
    ),
  );

  group('البوابة اللمسية', () {
    testWidgets('على التلفاز: رسالة صريحة، والسطح لا يُبنى', (tester) async {
      var built = 0;
      await tester.pumpWidget(
        host(

          profile: () async => const DeviceProfile(isTelevision: true),
          child: (_) {
            built++;
            return const Text('سطح الرسم');
          },
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(TouchRequiredMessage), findsOneWidget);
      expect(find.text('سطح الرسم'), findsNothing);
      // الأهمّ: لا يُبنى السطح إطلاقًا. «لا يُرى» وحده كان سيسمح بتحميل أصلٍ
      // وفتح مخزنٍ لشيءٍ لن يُعرض.
      expect(built, 0, reason: 'بُني السطح على التلفاز');
    });

    testWidgets('على الهاتف: السطح يُبنى', (tester) async {
      await tester.pumpWidget(
        host(

          profile: () async => const DeviceProfile(isTelevision: false),
          child: (_) => const Text('سطح الرسم'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('سطح الرسم'), findsOneWidget);
      expect(find.byType(TouchRequiredMessage), findsNothing);
    });

    testWidgets('أثناء التعرّف: لا رسالة ولا سطح، مؤشّر انتظار', (tester) async {
      final gate = Completer<DeviceProfile>();
      addTearDown(() {
        if (!gate.isCompleted) {
          gate.complete(const DeviceProfile(isTelevision: false));
        }
      });
      var built = 0;
      await tester.pumpWidget(
        host(

          profile: () => gate.future,
          child: (_) {
            built++;
            return const Text('سطح الرسم');
          },
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(built, 0, reason: 'بُني السطح قبل معرفة الجهاز');
      expect(find.byType(TouchRequiredMessage), findsNothing);
    });

    testWidgets('على تعذّر التعرّف: يُبنى السطح', (tester) async {
      // قرارٌ موثَّق لا سهو: `DeviceProfileService` يلتقط استثناءَي القناة
      // ويُعيد «ليس تلفازًا»، فهذا الفرع غير قابل للوصول عمليًّا — وحجبُ السطح
      // عليه كان سيمنع الهواتف على فشلٍ لا يحدث.
      await tester.pumpWidget(
        host(

          profile: () async => throw StateError('probe failed'),
          child: (_) => const Text('سطح الرسم'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('سطح الرسم'), findsOneWidget);
    });
  });

  test('لا مسار /studio يُعلَن بـGoRoute عاريًا خارج البوابة', () {
    // حرسٌ بنيويّ: الخاصّية شاملة على الملف («كل مسار استوديو»)، وهي من نوع ما
    // لا يُقاس بطلبٍ واحد. والتعليقات تُقشَّر أوّلًا لأن حرسًا على النصّ الخام
    // يرصد **التعليق الذي يشرح العطل** فيَنجح كذبًا — أوقعتُ نفسي في هذا سابقًا.
    final source = File('lib/app/router/app_router.dart').readAsLinesSync();
    final code = source
        .where((line) => !line.trimLeft().startsWith('//'))
        .join('\n');

    final bareStudioRoutes = RegExp(
      r"GoRoute\(\s*path:\s*'(/studio[^']*)'",
    ).allMatches(code).map((m) => m.group(1)).toList();

    expect(
      bareStudioRoutes,
      isEmpty,
      reason:
          'مسار استوديو بلا بوابة لمس: $bareStudioRoutes — أعلِنه بـ'
          '_touchOnlyRoute',
    );

    // وحرسٌ مضادّ: لو أُعيدت تسمية الدالّة أو حُذفت، لا يمرّ التأكيد أعلاه
    // بصمت لأن الملف لم يعد فيه مسار استوديو أصلًا.
    final gated = RegExp(
      r"_touchOnlyRoute\(\s*path:\s*'(/studio[^']*)'",
    ).allMatches(code).map((m) => m.group(1)!).toSet();
    expect(
      gated,
      containsAll(<String>{
        '/studio',
        '/studio/coloring/:id',
        '/studio/reference/:id',
        '/studio/trace/:id',
      }),
      reason: 'المسارات المعروفة يجب أن تبقى مغلَّفة',
    );
  });
}
