import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// `APP-105` — لا مخلَّفات في `lib/`، ولا تحذير مُسكَت بدل أن يُحلّ.
///
/// ## العلّة
///
/// `flutter analyze` كان يمرّ نظيفًا **وفي الشجرة ٦٠٠ سطر ميت**. السبب أن
/// التحذيرات لم تُصلَح بل أُسكتت: أحد عشر `// ignore: unused_element` و
/// `unused_field` موزّعة على خمسة ملفات، كلٌّ منها بتعليقٍ يشرح لماذا «يُبقى»
/// الكود — «بديل قانوني للأمان دون إنترنت»، «مُبقًى لتوافق الـAPI»، «مُبقًى لسجلّ
/// التدقيق».
///
/// ودالّةٌ لا يناديها أحد ليست بديلًا: هي غير قابلة للوصول. والتعليق الذي يسمّيها
/// بديلًا **يمنع القارئ التالي من حذفها** ويجعله يظنّ أن هناك مسارًا ثانيًا.
///
/// ## والأخطر: إسكاتٌ متقادم
///
/// اثنان من الإسكاتات كانا يحرسان تحذيرًا **لم يعد يظهر** (`_offlinePath` و
/// `_filterAge` مقروءان فعلًا). أي أن التراكم يُخفي أيُّ إسكاتٍ لا يزال لازمًا،
/// فيصير المرء لا يعرف ما هو ميت وما هو حيّ إلا بالحذف والتجربة — وهو ما جرى في
/// هذه الدفعة.

void main() {
  final libDir = Directory('lib');

  test('لا ملف غير `.dart` في `lib/` عدا مصادر الترجمة', () {
    // ملفات `.arb` **مصدر** لا مخلَّف: `l10n.yaml` يقرأها من `lib/l10n` بحكم
    // اصطلاح Flutter، فاستثناؤها بالمسار لا بالامتداد كي لا يتسرّب `.md` أو
    // `.dart.new` إلى مكان آخر.
    final stray = <String>[];
    for (final file in libDir.listSync(recursive: true).whereType<File>()) {
      final path = file.path.replaceAll(r'\', '/');
      if (path.endsWith('.dart')) continue;
      if (path.startsWith('lib/l10n/') && path.endsWith('.arb')) continue;
      stray.add(path);
    }
    expect(
      stray,
      isEmpty,
      reason: 'كان فيها `playback_page.dart.new` (٧ بايتات فيها «PENDING») و'
          '`README_V2.md` (وثيقة تصميم موضعها `docs/`)',
    );
  });

  test('لا `ignore` لتحذيرات الكود الميت خارج الملفات المُولَّدة', () {
    // الاستثناء الوحيد `lib/l10n/app_localizations_*.dart`: مخرَج مُولِّد
    // `flutter gen-l10n`، ويُعاد توليده فيُعيد إسكاتَه — تعديله يُمحى.
    final offenders = <String>[];
    for (final file in libDir.listSync(recursive: true).whereType<File>()) {
      final path = file.path.replaceAll(r'\', '/');
      if (!path.endsWith('.dart')) continue;
      if (path.startsWith('lib/l10n/app_localizations')) continue;
      final lines = file.readAsLinesSync();
      for (var index = 0; index < lines.length; index += 1) {
        if (RegExp(r'ignore:.*unused_(element|field|import|local_variable)')
            .hasMatch(lines[index])) {
          offenders.add('$path:${index + 1}');
        }
      }
    }
    expect(
      offenders,
      isEmpty,
      reason: 'التحذير يُحلّ بالحذف لا بالإسكات؛ وحذفُ ما لا يُشار إليه '
          'حافظٌ للسلوك بحكم البناء',
    );
  });

  test('`hive_flutter` ليست في `pubspec.yaml`', () {
    // اعتمادية مُعلَنة بصفر استخدام في الشجرة كلّها: وزنٌ في الحزمة، وسطحُ توريد،
    // وتحديثٌ يُراجَع كل مرّة بلا سبب.
    final pubspec = File('pubspec.yaml').readAsStringSync();
    expect(pubspec.contains('hive'), isFalse);
  });
}
