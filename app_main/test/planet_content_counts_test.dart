import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/data/content_dtos.dart';
import 'package:majarra/features/home/domain/content_models.dart';
import 'package:majarra/features/planets/presentation/planets_page.dart';

/// «قريبًا» على البطاقة لا بعد النقر (`CNT-106`).
///
/// ## العطل
///
/// تسع بطاقات كواكب متشابهة، وبعضها لا شيء فيه. وداخل الكوكب كانت الأقسام الفارغة
/// مُعلَنة بصراحة أصلًا («لا توجد سلاسل منشورة…»)، فالخلل لم يكن غرفةً بيضاء بل أن
/// **الاختيار كان أعمى**: الطفل يدفع ثمن النقر ليعرف أن الغرفة فارغة.
///
/// ## ما تحرسه هذه الاختبارات
///
/// أن «قريبًا» تظهر عند **صفرٍ مقيس** فقط، وأن غياب العدّ (النسخة المحزومة، أو خادم
/// أقدم لا يرسل الحقل) لا يُقرأ فراغًا — فإعلانُ غيابٍ هو في الحقيقة غيابُ معرفة هو
/// نفس الكذب في الاتجاه المعاكس.
void main() {
  group('عدّ ما يمكن فتحه في الكوكب', () {
    test('صفرٌ مقيس يعني «قريبًا»', () {
      final planet = PlanetDto.fromJson({
        'id': 'islamic',
        'published_series': 0,
        'published_openable': 0,
      }).toDomain(imageAsset: 'x');
      expect(planet.publishedOpenable, 0);
      expect(planet.isMeasuredEmpty, isTrue);
    });

    test('غياب العدّ يعني «غير معروف» لا «فارغ»', () {
      final planet = PlanetDto.fromJson({
        'id': 'abjad',
      }).toDomain(imageAsset: 'x');
      expect(planet.publishedOpenable, isNull);
      expect(
        planet.isMeasuredEmpty,
        isFalse,
        reason: 'غيابُ المعرفة ليس غيابَ محتوى',
      );
    });

    test('سلاسل منشورة بلا شيء يُفتح تبقى «قريبًا»', () {
      // السلسلة مجلَّد: نشرها لا يفتح شيئًا. وهذه هي الحالة التي يخطئ فيها عدُّ
      // السلاسل وحده فيصف الكوكب ممتلئًا.
      final planet = PlanetDto.fromJson({
        'id': 'maharat',
        'published_series': 3,
        'published_openable': 0,
      }).toDomain(imageAsset: 'x');
      expect(planet.isMeasuredEmpty, isTrue);
    });

    test('كوكبٌ فيه ما يُفتح ليس «قريبًا»', () {
      final planet = PlanetDto.fromJson({
        'id': 'arqam',
        'published_series': 3,
        'published_openable': 11,
      }).toDomain(imageAsset: 'x');
      expect(planet.isMeasuredEmpty, isFalse);
    });
  });

  group('بطاقة الكوكب', () {
    Planet planet({required String id, int? openable}) => Planet(
      id: id,
      name: 'كوكب $id',
      description: 'وصف',
      colorHex: '#2856D8',
      imageAsset: 'assets/images/planets/$id.webp',
      publishedOpenable: openable,
    );

    /// تُركِّب الشاشة الحقيقية لا غلافًا للاختبار: البطاقة تُرسَم من `PlanetsPage`،
    /// واختبارُ نسخةٍ خاصّة كان سيمرّ حتى لو لم تصل العلامة إلى الشاشة الحقيقية.
    Future<void> pumpChooser(WidgetTester tester, List<Planet> planets) async {
      await tester.pumpWidget(
        MaterialApp(
          home: PlanetsPage(
            catalog: HomeCatalog(
              planets: planets,
              spotlights: const [],
              series: const [],
              episodes: const [],
              experiences: const [],
              source: ContentSource.remote,
            ),
            isTelevision: false,
          ),
        ),
      );
      await tester.pump();
    }

    testWidgets('الكوكب الفارغ المقيس يعرض «قريبًا»', (tester) async {
      await pumpChooser(tester, [planet(id: 'islamic', openable: 0)]);
      expect(find.text('قريبًا'), findsOneWidget);
    });

    testWidgets('الكوكب المملوء لا يعرضها', (tester) async {
      await pumpChooser(tester, [planet(id: 'arqam', openable: 11)]);
      expect(find.text('قريبًا'), findsNothing);
    });

    testWidgets('بلا عدٍّ لا تُعرض: الوضع غير معروف', (tester) async {
      // هذا هو المسار المحزوم/غير المتّصل. علامةٌ هنا تكذب على الطفل.
      await pumpChooser(tester, [planet(id: 'abjad')]);
      expect(find.text('قريبًا'), findsNothing);
    });

    testWidgets('التسمية الوصفية تذكر «قريبًا» فيسمعها قارئ الشاشة', (
      tester,
    ) async {
      // العلامة البصرية وحدها تُخفي الحقيقة عن طفلٍ يستعمل قارئ شاشة.
      await pumpChooser(tester, [planet(id: 'islamic', openable: 0)]);
      expect(
        find.bySemanticsLabel(RegExp('قريبًا')),
        findsOneWidget,
      );
    });
  });
}
