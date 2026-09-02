/// شريط تقدّم التلوين V2 كان يعرض رقمًا مُختلَقًا (وُجد أثناء `A11Y-102`).
///
/// ## ما كان يُعرض للطفل
///
/// `'${_ops.length} من 8 مناطق'`. البسط عددُ النقرات لا المناطق — نقرتان على
/// الموضع نفسه تُحسبان اثنتين، والتراجع يُنقصه. والمقام **8** رقمٌ حرفيّ لا
/// علاقة له برسمةٍ بعينها؛ التعليق فوقه كان يقرّ بذلك: «تقدير… بسيط حالياً».
///
/// واللوحة مبنيّة على `_floodFill` على نقطة، لا على قائمة مناطق مُعلَنة
/// (`ColorRegion` في `coloring_regions.dart` موجود ولا تستعمله هذه اللوحة)، فلا
/// يوجد في وقت التشغيل ما يُقاس عليه مقامٌ صادق. فصار الشريط يعرض ما يُعرف —
/// عدد التلوينات — ويصمت عمّا لا يُعرف.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/games/presentation/pages/coloring/coloring_board_v2.dart';

void main() {
  test('لا مقام مُختلَق ولا كلمة «مناطق» في أي صياغة', () {
    for (var n = 0; n <= 30; n++) {
      final label = coloringFillCountLabel(n);
      expect(label, isNot(contains('مناطق')));
      expect(label, isNot(contains('من 8')));
    }
  });

  test('الصياغات العربية صحيحة: مفرد ومثنّى وجمعان', () {
    // `'$n تلوينات'` وحدها تُنتج «1 تلوينات» و«2 تلوينات».
    expect(coloringFillCountLabel(0), 'ابدأ التلوين');
    expect(coloringFillCountLabel(1), 'تلوينة واحدة');
    expect(coloringFillCountLabel(2), 'تلوينتان');
    expect(coloringFillCountLabel(5), '5 تلوينات');
    expect(coloringFillCountLabel(11), '11 تلوينة');
  });

  test('عدد سالب لا يُعرض رقمًا', () {
    expect(coloringFillCountLabel(-1), 'ابدأ التلوين');
  });
}
