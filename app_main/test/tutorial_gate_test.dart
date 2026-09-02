library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/presentation/pages/studio_v2/success_and_save.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  const storageKey = 'tutorial_coloring_v2_seen_test-child';

  Widget host(Key key) => MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: TutorialGate(
            key: key,
            storageKey: storageKey,
            child: const Scaffold(body: Center(child: Text('لوحة التلوين'))),
          ),
        ),
      );

  testWidgets('tutorial is dismissed permanently after skipping', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(host(const ValueKey('first-mount')));
    await tester.pumpAndSettle();

    expect(find.text('اختر لونًا'), findsOneWidget);
    expect(find.text('لوحة التلوين'), findsOneWidget);

    await tester.tap(find.text('تخطي'));
    await tester.pumpAndSettle();

    expect(find.text('اختر لونًا'), findsNothing);
    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getBool(storageKey), isTrue);

    await tester.pumpWidget(host(const ValueKey('second-mount')));
    await tester.pumpAndSettle();

    expect(find.text('لوحة التلوين'), findsOneWidget);
    expect(find.text('اختر لونًا'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('tutorial persists completion after the final step', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(host(const ValueKey('completion-mount')));
    await tester.pumpAndSettle();

    for (var index = 0; index < 3; index++) {
      await tester.tap(find.text('التالي'));
      await tester.pumpAndSettle();
    }
    // `'تمام'` بلا علامة صح.
    //
    // الزر لم يحمل العلامة في أي إصدار، وإضافتها ليست خيارًا متاحًا:
    // `engine_content_separation_test.dart` يمنع كل محارف نطاق الرموز التصويرية
    // (ومنها `✓` عند U+2713) في كل ملفات `features/games`، لأن الإيموجي كانت
    // تقوم مقام الرسوم في نسخة سابقة. تمييز الخطوة الأخيرة بصريًّا مسؤولية
    // التصميم لا النص. وموضوع هذا الاختبار أصلًا هو حفظ الإكمال، لا الزخرفة.
    expect(find.text('تمام'), findsOneWidget);

    await tester.tap(find.text('تمام'));
    await tester.pumpAndSettle();

    final preferences = await SharedPreferences.getInstance();
    expect(preferences.getBool(storageKey), isTrue);
    expect(find.text('اختر لونًا'), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
