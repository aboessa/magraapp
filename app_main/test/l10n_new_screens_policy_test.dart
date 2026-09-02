/// بوابة تعريب الأسطح الجديدة (Requirement 7 من app-foundation-family-journey).
///
/// هذا الملف لا يفحص المستودع كاملًا — المستودع يحمل ~1688 نصًا عربيًا محفورًا
/// في شاشات قديمة سابقة لهذا الـspec، وإعادة كتابتها خارج النطاق (Requirement 7.6).
/// بدل ذلك، يحمل قائمة صريحة تُحدَّث يدويًا مع كل مهمة تالية تُنشئ ملف شاشة جديدًا
/// (المهام 21، 23، 28، 30، 32)، ويفحص فقط تلك الملفات.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// الملفات الجديدة التي تُبنى ضمن هذا الـspec (app-foundation-family-journey)
/// وما بعده، والتي يجب أن تقرأ كل نص معروض للمستخدم من `AppLocalizations`
/// لا من literal عربي في الكود.
///
/// **صيانة هذه القائمة:** كل مهمة تُنشئ ملف شاشة جديدًا ضمن نطاق هذا الـspec
/// (أو أي spec تالٍ يعتمد عليه) يجب أن تُضيف مسار الملف هنا في نفس التغيير.
/// لا تُضاف الشاشات القديمة القائمة قبل هذا الـspec (تحمل 1688 استثناءً
/// قائمًا موصوفًا في requirements.md؛ إعادة كتابتها خارج النطاق).
const List<String> _newScreenFiles = <String>[
  'lib/features/child/presentation/pages/child_profile_form_page.dart',
  'lib/features/auth/presentation/pages/pin_setup_page.dart',
  'lib/features/auth/presentation/pages/pin_unlock_page.dart',
  'lib/features/child/presentation/pages/age_transition_review_page.dart',
  'lib/features/onboarding/presentation/pages/consent_page.dart',
  'lib/features/onboarding/presentation/pages/onboarding_flow_page.dart',
];

/// المصدر بلا تعليقات `//` أو `/* */`.
///
/// نسخة مبسطة من `_codeOnly` في `engine_content_separation_test.dart`: تتتبّع
/// حالة السلسلة النصية بحيث لا يُنهي `//` داخل نص عربي أو رابط السطرَ قبل وقته.
String _stripComments(String source) {
  final out = StringBuffer();
  var index = 0;
  while (index < source.length) {
    final ch = source[index];
    if (ch == "'" || ch == '"') {
      final quote = ch;
      out.write(ch);
      index++;
      while (index < source.length && source[index] != quote) {
        if (source[index] == r'\' && index + 1 < source.length) {
          out.write(source[index]);
          index++;
        }
        out.write(source[index]);
        index++;
      }
      if (index < source.length) out.write(source[index]);
      index++;
      continue;
    }
    if (ch == '/' && index + 1 < source.length && source[index + 1] == '/') {
      while (index < source.length && source[index] != '\n') {
        index++;
      }
      continue;
    }
    if (ch == '/' && index + 1 < source.length && source[index + 1] == '*') {
      index += 2;
      while (index + 1 < source.length &&
          !(source[index] == '*' && source[index + 1] == '/')) {
        index++;
      }
      index += 2;
      continue;
    }
    out.write(ch);
    index++;
  }
  return out.toString();
}

/// سلسلة نصية Dart حرفية مفردة القوس (`'...'`)، بمعزل عن التعليقات (المصدر
/// الممرَّر خالٍ منها فعلًا)، أحادية السطر، تحترم الهروب `\\`.
///
/// مُقسَّمة إلى نمطين بدل نمط واحد بديل (`'...'|"..."`) لتجنّب تعقيد الهروب من
/// محدِّد الاقتباس نفسه داخل raw string واحدة في Dart.
final _singleQuotedLiteral = RegExp(r"'(?:[^'\\\n]|\\.)*'");

/// سلسلة نصية Dart حرفية مزدوجة القوس (`"..."`)، بنفس القيود أعلاه.
final _doubleQuotedLiteral = RegExp(r'"(?:[^"\\\n]|\\.)*"');

/// أي حرف داخل نطاق يونيكود العربية.
final _arabicChar = RegExp(r'[\u0600-\u06FF]');

/// كل السلاسل النصية الحرفية التي تحتوي حرفًا عربيًا في مصدر خالٍ من التعليقات.
///
/// الأصل أن أي سلسلة عربية في ملف شاشة جديد مُشتبه بها ويجب أن تُفشل الاختبار
/// افتراضيًا؛ لا تُستثنى مفاتيح خرائط أو `ValueKey` إلا عند حاجة فعلية مُثبَتة،
/// لا نظريًا (لم تظهر هذه الحاجة بعد لأن القائمة فارغة).
List<String> _arabicLiteralOffenses(String codeOnlySource) {
  final offenses = <String>[];
  for (final match in [
    ..._singleQuotedLiteral.allMatches(codeOnlySource),
    ..._doubleQuotedLiteral.allMatches(codeOnlySource),
  ]) {
    final literal = match.group(0)!;
    if (_arabicChar.hasMatch(literal)) {
      offenses.add(literal);
    }
  }
  return offenses;
}

void main() {
  group('new-screen l10n policy (Requirement 7)', () {
    test(
      'declared new-screen files read user text from AppLocalizations, '
      'not literal Arabic strings',
      () {
        final missingFiles = <String>[];
        final offendersByFile = <String, List<String>>{};

        for (final path in _newScreenFiles) {
          final file = File(path);
          if (!file.existsSync()) {
            // مسار مُدرَج في القائمة لملف لم يُبنَ بعد هو خطأ كتابة يجب أن
            // يُكتشف صريحًا، لا أن يُتجاهَل بصمت.
            missingFiles.add(path);
            continue;
          }
          final codeOnly = _stripComments(file.readAsStringSync());
          final offenses = _arabicLiteralOffenses(codeOnly);
          if (offenses.isNotEmpty) {
            offendersByFile[path] = offenses;
          }
        }

        expect(
          missingFiles,
          isEmpty,
          reason:
              'الملفات التالية مُدرَجة في _newScreenFiles لكنها غير موجودة '
              'على القرص؛ صحّح المسار في القائمة أو أزل الإدخال حتى تُنشئ '
              'المهمة المقابلة الملف فعليًا: $missingFiles',
        );

        expect(
          offendersByFile,
          isEmpty,
          reason:
              'وُجدت سلاسل نصية عربية حرفية خارج AppLocalizations في '
              'الملفات التالية (الملف -> السلاسل المخالفة): '
              '${offendersByFile.entries.map((e) => '${e.key} -> ${e.value}').join('; ')}',
        );
      },
    );

    test(
      'the scan detects a literal Arabic string when one exists, and stays '
      'quiet when text is read from AppLocalizations',
      () {
        // إثبات أن آلية الفحص فعّالة لا زخرفية: تنشئ ملفًا مؤقتًا فيه مخالفة
        // وملفًا آخر نظيفًا، ثم تحذف كليهما داخل الاختبار نفسه.
        final tempDir = Directory.systemTemp.createTempSync(
          'l10n_policy_test_',
        );
        addTearDown(() {
          if (tempDir.existsSync()) {
            tempDir.deleteSync(recursive: true);
          }
        });

        final offendingFile = File('${tempDir.path}/offending_screen.dart')
          ..writeAsStringSync('''
import 'package:flutter/material.dart';

class OffendingScreen extends StatelessWidget {
  const OffendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Text('مرحبا بك'); // نص عربي حرفي يجب أن يُكشف
  }
}
''');

        final cleanFile = File('${tempDir.path}/clean_screen.dart')
          ..writeAsStringSync('''
import 'package:flutter/material.dart';
import '../l10n/app_localizations.dart';

class CleanScreen extends StatelessWidget {
  const CleanScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // تعليق بالعربية لا يجب أن يُفشل الاختبار
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Text(l10n.someKey);
  }
}
''');

        final offendingOffenses = _arabicLiteralOffenses(
          _stripComments(offendingFile.readAsStringSync()),
        );
        expect(
          offendingOffenses,
          isNotEmpty,
          reason: 'الفحص يجب أن يكشف السلسلة العربية الحرفية في الملف المخالف',
        );

        final cleanOffenses = _arabicLiteralOffenses(
          _stripComments(cleanFile.readAsStringSync()),
        );
        expect(
          cleanOffenses,
          isEmpty,
          reason:
              'الفحص يجب ألا يُفشل ملفًا يقرأ نصوصه من AppLocalizations '
              'فقط، حتى لو حمل تعليقًا بالعربية',
        );
      },
    );
  });
}
