/// التخطيط عند تكبير الخط (`A11Y-101`).
///
/// ## لماذا هذا الملف
///
/// الأودت قاس إشارةً **واحدة** إلى `textScaler` في التطبيق كلّه، مقابل 199 إشارة
/// إلى `Semantics`. أي أن قارئ الشاشة مخدومٌ وتكبير الخط غير مخدوم — وهو إعداد شائع
/// جدًّا لدى الأهل، ونتيجته نصٌّ مقطوع أو تخطيطٌ مكسور.
///
/// ## ولماذا يفشل على «استثناء الإطار» لا على شكل بعينه
///
/// تجاوزُ `RenderFlex` يُبلَّغ استثناءً في وضع التطوير، فيُرصَد بـ`takeException`.
/// وهو أصدق من مقارنة صورة: لا يتطلّب لقطة مرجعية تتقادم، ويسمّي الودجت والمقدار.
///
/// ## وما لا يفعله
///
/// لا يُثبت مطابقة WCAG. تجاوزٌ صفريّ لا يعني أن النصّ **مقروء**: قد يتقلّص إلى
/// سطرٍ واحد بحروفٍ ناقصة (`ellipsis`) وهو تجاوزٌ صفريّ وقراءةٌ مفقودة. والتحقّق
/// الكامل يحتاج تقنيات مساعدة ومراجعة بشرية (المعيار الثالث في البند).
library;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/theme/app_theme.dart';
import 'package:majarra/features/games/presentation/studio/studio_home_view.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/planets/presentation/planets_page.dart';

/// النِّسَب المفحوصة: الافتراضية، وزيادةٌ معتادة، والحدّ الذي يطلبه البند (200%).
const _scales = <double>[1.0, 1.3, 2.0];

void main() {
  Widget host(Widget child, double scale) => ProviderScope(
    child: MaterialApp(
      theme: AppTheme.dark,
      locale: const Locale('ar'),
      home: MediaQuery(
        // `textScaler` لا `textScaleFactor`: الثانية مهجورة وتتجاهل انحناء
        // المنصّة عند النِّسَب العالية.
        data: MediaQueryData(textScaler: TextScaler.linear(scale)),
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: child,
        ),
      ),
    ),
  );

  /// شاشة هاتف ضيّقة وطويلة: العرض الضيّق هو حيث يقع القطع، والطول يسمح بتخطيط
  /// الصفحة في مرور واحد بدل أن يُخفي التمرير ما لم يُبنَ.
  void useTallPhone(WidgetTester tester, {double width = 390}) {
    tester.view.physicalSize = Size(width * 3, 2400 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
  }

  Planet planet(String id, {int? openable}) => Planet(
    id: id,
    name: 'كوكب $id',
    description: 'وصفٌ طويل بما يكفي ليضغط التخطيط عند التكبير',
    colorHex: '#2856D8',
    imageAsset: 'assets/images/planets/$id.webp',
    publishedOpenable: openable,
  );

  HomeCatalog catalog() => HomeCatalog(
    planets: [
      planet('abjad', openable: 4),
      planet('islamic', openable: 0),
      planet('arqam', openable: 11),
    ],
    spotlights: const [],
    series: const [],
    episodes: const [],
    experiences: const [],
    source: ContentSource.remote,
  );

  group('صفحة الكواكب تتحمّل تكبير الخط', () {
    for (final scale in _scales) {
      testWidgets('بلا تجاوز تخطيط عند ${(scale * 100).round()}%', (tester) async {
        useTallPhone(tester);
        await tester.pumpWidget(
          host(PlanetsPage(catalog: catalog(), isTelevision: false), scale),
        );
        await tester.pump();
        expect(
          tester.takeException(),
          isNull,
          reason: 'تجاوز أو استثناء تخطيط عند تكبير ${(scale * 100).round()}%',
        );
      });
    }
  });

  group('واجهة الاستوديو تتحمّل تكبير الخط', () {
    Widget studio() => StudioHomeView(
      displayName: 'سلمى',
      savedDrawings: 4,
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

    for (final scale in _scales) {
      testWidgets('بلا تجاوز تخطيط عند ${(scale * 100).round()}%', (tester) async {
        useTallPhone(tester);
        await tester.pumpWidget(host(studio(), scale));
        await tester.pump();
        expect(
          tester.takeException(),
          isNull,
          reason: 'تجاوز أو استثناء تخطيط عند تكبير ${(scale * 100).round()}%',
        );
      });
    }
  });

  test('النِّسَب المفحوصة ثلاث على الأقل، وفيها 200%', () {
    // المعيار الثاني في البند نصًّا: «اختبارات widget تغطّي ثلاث نسب تكبير على
    // الأقل». وحرسٌ على القائمة يمنع تقليصها إلى نسبةٍ واحدة سهلة.
    expect(_scales.length, greaterThanOrEqualTo(3));
    expect(_scales, contains(2.0));
  });
}
