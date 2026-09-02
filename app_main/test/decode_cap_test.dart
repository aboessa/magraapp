/// فكّ الترميز عند حجم العرض لا حجم المصدر (`PERF-102`).
///
/// ## العطل المقيس
///
/// `width`/`height` على `Image` تحدّدان التخطيط ولا تمسّان فكّ الترميز، فكان
/// المقيس: **53** `Image.asset` مقابل **3** استخدامات لـ`cacheWidth` وصفر
/// `cacheHeight` وصفر `ResizeImage`. وأثقلها: 50 أفاتارًا حتى 768×1376 (نحو 4
/// ميغابايت مفكوكة للواحد، 200 لو عاشت كلّها) في خلايا 72 بكسلًا، و10 كواكب
/// 768×768 في دوائر 58.
///
/// ## ولماذا التأكيد على `ResizeImage` لا على نصّ المصدر
///
/// `cacheWidth` غير صفريّة تجعل Flutter يلفّ المزوّد في `ResizeImage`. فالتأكيد
/// هنا على **الشيء الذي يفكّ الترميز فعلًا**: مسحُ المصدر كان سيمرّ على
/// `cacheWidth: null` وعلى تعليقٍ يذكر الكلمة.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/widgets/cinematic_image.dart';
import 'package:majarra/core/widgets/decode_cap.dart';
import 'package:majarra/features/child/presentation/widgets/child_avatars.dart';

/// كل مزوّدات الصور الشبكية/الأصلية في الشجرة، وسقفُ كلٍّ منها.
List<int?> _decodeCaps(WidgetTester tester) => tester
    .widgetList<Image>(find.byType(Image))
    .map((image) {
      final provider = image.image;
      return provider is ResizeImage ? provider.width : null;
    })
    .toList();

void main() {
  Widget host(Widget child, {double ratio = 3}) => MaterialApp(
    locale: const Locale('ar'),
    home: MediaQuery(
      data: MediaQueryData(devicePixelRatio: ratio),
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: Center(child: child),
      ),
    ),
  );

  group('السقف يُحسب بالبكسل الفيزيائي', () {
    testWidgets('حوضٌ منطقي 72 على شاشة 3× يُفكّ عند 216', (tester) async {
      late int? cap;
      await tester.pumpWidget(
        host(
          Builder(
            builder: (context) {
              cap = decodeCapFor(context, 72);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      // لا 72: تمريرُ المنطقي يُنتج صورةً ضبابية على شاشةٍ عالية الكثافة.
      expect(cap, 216);
    });

    testWidgets('شاشة 1× تُفكّ عند الحجم المنطقي نفسه', (tester) async {
      late int? cap;
      await tester.pumpWidget(
        host(
          Builder(
            builder: (context) {
              cap = decodeCapFor(context, 72);
              return const SizedBox.shrink();
            },
          ),
          ratio: 1,
        ),
      );
      expect(cap, 72);
    });

    testWidgets('حوضٌ مجهول أو ممتدّ لا سقف له', (tester) async {
      late List<int?> caps;
      await tester.pumpWidget(
        host(
          Builder(
            builder: (context) {
              caps = [
                decodeCapFor(context, null),
                decodeCapFor(context, double.infinity),
                decodeCapFor(context, 0),
                decodeCapFor(context, -8),
              ];
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      // `null` هو الجواب الصحيح لا الصفر: سقفٌ مُخترَع على حوضٍ مجهول يُنتج
      // ضبابًا في مكانٍ لم يُقَس.
      expect(caps, [null, null, null, null]);
    });
  });

  testWidgets('أفاتار الطفل يُفكّ عند حجم خليّته لا حجم مصدره', (tester) async {
    await tester.pumpWidget(
      host(
        const ChildAvatarView(avatarId: 'luna', size: 72),
      ),
    );

    final caps = _decodeCaps(tester);
    expect(caps, isNotEmpty, reason: 'لم تُبنَ أي صورة');
    expect(
      caps,
      everyElement(isNotNull),
      reason: 'أفاتار بلا سقف فكّ: 768×1376 لخليّة 72 بكسلًا',
    );
    expect(caps, everyElement(216));
  });

  testWidgets('رمز الكوكب يُفكّ عند قطر دائرته', (tester) async {
    await tester.pumpWidget(
      host(
        const PlanetSymbol(
          planetId: 'abjad',
          colorHex: '#2856D8',
          semanticLabel: 'كوكب أبجد',
          size: 58,
          imageAsset: 'assets/images/planets/planet-abjad.webp',
        ),
      ),
    );

    final caps = _decodeCaps(tester);
    expect(caps, isNotEmpty);
    // 58 × 3 = 174، مقابل 768 مصدرًا: 2.25 ميغابايت → 0.12.
    expect(caps, everyElement(174));
  });
}
