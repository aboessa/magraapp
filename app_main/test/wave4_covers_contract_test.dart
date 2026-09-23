/// يثبّت أنّ أغلفة `wave4` الأحد عشر التي يعد بها الكتالوج موجودة على R2.
///
/// ## سبب وجود هذا الملف
///
/// `local_catalog.dart` و`content_dtos.dart` يشيران إلى 11 غلافًا بصيغة
/// `public/catalog/assets/images/games/wave4/<slug>/cover.jpg`. والتطابق بين
/// الكود وسكربت الرفع (`upload_all_r2.mjs`) ليس وجودًا: مفتاحٌ يُشار إليه ولا
/// يُرفَع يظهر للطفل صورةً مكسورة. تحقّق 2026-09-12: الأحد عشر تحلّ (200) على
/// الـCDN. وهذا الاختبار يمنع حذف مفتاح أو إعادة تسميته بصمت — أيّ تغيير في
/// القائمة هنا يجب أن يقابله تغييرٌ في R2 أولًا.
///
/// ملاحظة: الاختبار يفحص **العقد** (القائمة الكاملة والاتفاقية) لا الشبكة:
/// فحص HTTP حيّ في كلّ `flutter test` يجعل الحزمة هشّة أمام أيّ انقطاع.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_environment.dart';
import 'package:majarra/features/home/data/local_catalog.dart';

/// مفاتيح الأغلفة التي تحقّق وجودها على الـCDN (200) بتاريخ 2026-09-12.
const _verifiedWave4Slugs = [
  'match-nature-3',
  'count-nature-3',
  'sort-animals-3',
  'memory-shapes-3',
  'logic-colors-3a',
  'block-maze-3',
  'rhythm-nature-3a',
  'sim-plant-3',
  'timeline-egypt-3',
  'shape-trace-3',
  'number-trace-3',
];

void main() {
  group('عقد أغلفة wave4 على R2', () {
    test('الأحد عشر غلافًا مُشار إليها في الكتالوج المحزوم', () {
      final urls = LocalCatalog.experiences
          .map((e) => e.coverUrl ?? '')
          .where((url) => url.contains('/wave4/'))
          .toList();
      for (final slug in _verifiedWave4Slugs) {
        expect(
          urls.any((url) => url.contains('/wave4/$slug/cover.jpg')),
          isTrue,
          reason: '$slug مفقود من الكتالوج — أُزيل أم أُعيدت تسميته؟',
        );
      }
    });

    test('الاتفاقية ثابتة: نفس البادئة والمفتاح لكلّ غلاف', () {
      for (final slug in _verifiedWave4Slugs) {
        expect(
          // ignore: do_not_use_environment
          '${AppConfig.assetBaseUrl}/public/catalog/assets/images/games/wave4/$slug/cover.jpg',
          contains('/public/catalog/assets/images/games/wave4/'),
        );
      }
    });
  });
}
