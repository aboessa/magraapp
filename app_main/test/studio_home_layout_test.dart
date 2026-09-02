/// Layout guard for the redesigned Creative Studio home.
///
/// This file exists because building the screen was not enough to catch two real
/// defects: the centred app-bar title overflowed by 78px once a back button and a
/// profile badge shared the row, and the hero's fade used an
/// `AlignmentDirectional` inside a paint callback, which throws only when the
/// card is actually painted. Both are invisible to a plain "does it compile"
/// check, so the assertions below pump the whole page at two phone widths and
/// fail on any framework exception.
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/theme/app_theme.dart';
import 'package:majarra/features/games/presentation/studio/studio_categories.dart';
import 'package:majarra/features/games/presentation/studio/studio_home_view.dart';

void main() {
  Widget host(Widget child) => ProviderScope(
    child: MaterialApp(
      theme: AppTheme.dark,
      locale: const Locale('ar'),
      home: Directionality(textDirection: TextDirection.rtl, child: child),
    ),
  );

  /// Tall viewport so the whole page lays out in one pass. Width stays at a
  /// realistic narrow phone, which is where the overflows live.
  void useTallPhone(WidgetTester tester, {double width = 390}) {
    tester.view.physicalSize = Size(width * 3, 2400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  Widget home({int saved = 4}) => StudioHomeView(
    displayName: 'سلمى',
    savedDrawings: saved,
    resumable: const [],
    loadingCreations: false,
    creationError: null,
    onRefresh: () async {},
    onStartFreeDraw: () {},
    onOpenBoards: () {},
    onOpenReference: () {},
    onOpenCategory: (_) {},
    onOpenAllCategories: () {},
  );

  testWidgets('studio home renders every section without layout errors', (
    tester,
  ) async {
    useTallPhone(tester);
    await tester.pumpWidget(host(home()));
    await tester.pumpAndSettle();

    // `'الاستوديو'`, not `'الاستوديو الإبداعي'`.
    //
    // العنوان الطويل هو نفسه سبب الفائض الذي كُتب هذا الملف من أجله: مع زر رجوع
    // وشارة ملف في الصف نفسه على عرض 390dp، تجاوز الشريط بـ78 بكسل. تقصير
    // العنوان كان الإصلاح، وهذا التوقّع لم يُحدَّث معه — فبقي يطالب بالنص الذي
    // أُزيل عن قصد. بقية التوكيدات (وغياب أي استثناء إطار) هي الضمان الحقيقي.
    expect(find.text('الاستوديو'), findsOneWidget);
    // ## ما حُذف من هذه التوكيدات ولماذا
    //
    // كانت هنا توكيدات على عناصر أزالها إعادة تصميم الرئيسية عن قصد، موثَّقة في
    // `studio_home_view.dart` (`_hero`: «full illustrated banner replaces old
    // carousel»):
    //
    // * صف الاختصارات العلوي (`StudioQuickAction` بعنوانَي «لوحة جديدة» و«ارسم
    //   مثلي» وتعليقَي «ابدأ من الصفر» و«اتبع الخطوات»)، فصار «ارسم مثلي» يظهر
    //   مرة واحدة كبطاقة في الشبكة لا مرتين.
    // * شريط «لوحاتي» (`StudioNavStrip`)، وصارت لوحاتي تُفتح من شريط الإنجاز.
    // * نصوص البانر القديم («لوحة بيضاء»، «ابدأ الرسم»، «ارسم ما تحب»،
    //   «ابدأ الآن»)، وحلّت محلها صورة واحدة قابلة للنقر.
    //
    // التوكيدات الباقية هي ما يبقى ضمانًا: كل تصنيف أساسي يُعرض، وشريط الإنجاز
    // يعرض العدد الحقيقي، ولا يُرمى أي استثناء إطار على 390dp ولا على 320dp —
    // وهو الغرض الذي كُتب هذا الملف من أجله أصلًا.
    expect(find.text('ارسم مثلي'), findsOneWidget);
    expect(find.text('اختر نشاطك الإبداعي'), findsOneWidget);
    expect(find.text('عرض الكل'), findsOneWidget);
    for (final category in kPrimaryStudioCategories) {
      expect(find.text(category.title), findsWidgets, reason: category.title);
    }
    expect(find.text('نجوم الإبداع'), findsOneWidget);
    // The star count is the real saved-drawing count, not a rewards balance.
    expect(find.text('4 / 5'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('studio home survives a 320dp phone', (tester) async {
    useTallPhone(tester, width: 320);
    await tester.pumpWidget(host(home(saved: 0)));
    await tester.pumpAndSettle();
    expect(find.text('0 / 3'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('studio home in loading and error states', (tester) async {
    useTallPhone(tester);
    await tester.pumpWidget(
      host(
        StudioHomeView(
          savedDrawings: 0,
          resumable: const [],
          loadingCreations: true,
          creationError: null,
          onRefresh: () async {},
          onStartFreeDraw: () {},
          onOpenBoards: () {},
          onOpenReference: () {},
          onOpenCategory: (_) {},
          onOpenAllCategories: () {},
        ),
      ),
    );
    await tester.pump();
    expect(find.text('جاري تحضير الاستوديو…'), findsOneWidget);

    await tester.pumpWidget(
      host(
        StudioHomeView(
          savedDrawings: 0,
          resumable: const [],
          loadingCreations: false,
          creationError: Exception('local store unreadable'),
          onRefresh: () async {},
          onStartFreeDraw: () {},
          onOpenBoards: () {},
          onOpenReference: () {},
          onOpenCategory: (_) {},
          onOpenAllCategories: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    // The activities stay reachable: only the hero degrades.
    expect(find.text('تعذّر قراءة رسوماتك'), findsOneWidget);
    expect(find.text('اختر نشاطك الإبداعي'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('all-activities page lists every category with its subtitle', (
    tester,
  ) async {
    useTallPhone(tester);
    await tester.pumpWidget(
      host(
        StudioAllCategoriesView(
          onOpenCategory: (_) {},
          onStartFreeDraw: () {},
          onOpenReference: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();

    for (final category in kStudioCategories) {
      expect(find.text(category.title), findsWidgets, reason: category.title);
      expect(
        find.text(category.subtitle),
        findsWidgets,
        reason: category.subtitle,
      );
    }
    expect(tester.takeException(), isNull);
  });
}
