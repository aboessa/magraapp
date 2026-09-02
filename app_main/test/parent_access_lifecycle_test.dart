import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/router/auth_guard.dart';

/// `APP-107` — نافذة وليّ الأمر تُغلق عند مغادرة المقدّمة، والتوثيق يطابق القيمة.
///
/// ## العلّتان
///
/// **الأولى:** الإبطال كان على `detached` وحدها. فوليّ أمر يفتح منطقة الوالدين ثم
/// ينتقل إلى تطبيق آخر أو يضع الجهاز جانبًا يترك الوصول **حيًّا خمس عشرة دقيقة** —
/// والمنطقة تحمل وقت الشاشة، ووقت النوم، وحذف الحساب. والجهاز في تلك الدقائق قد
/// يكون في يد الطفل.
///
/// **والثانية:** التعليق الذي يبرّر ذلك كان يقول «مؤقّت الخمس دقائق يحدّ النافذة
/// أصلًا»، والقيمة الفعلية **خمس عشرة**. أي أن القارئ يُطمَأن بثلث النافذة
/// الحقيقية، فيقبل تنازلًا لم يكن يقبله لو عرف مقداره.
///
/// ولهذا يوازن هذا الملف **النصّ بالقيمة**: تعليقٌ يخالف ثابتًا أخطر من تعليقٍ
/// غائب، لأنه يُغني قارئه عن الفحص.

void main() {
  final appSource = File('lib/app/majarra_app.dart').readAsStringSync();

  group('التوثيق يطابق القيمة', () {
    test('لا مدّة بالدقائق في تعليق دورة الحياة تخالف `parentAccessDuration`', () {
      final minutes = AuthGuard.parentAccessDuration.inMinutes;
      // كل رقمٍ يليه «دقيقة/دقائق» أو `minute` في هذا الملف يجب أن يكون هو نفسه.
      final mentions = RegExp(r'(\d+)\s*(?:دقيقة|دقائق|minutes?|-minute)')
          .allMatches(appSource)
          .map((match) => match.group(1))
          .toSet();
      for (final mention in mentions) {
        expect(
          mention, '$minutes',
          reason: 'التعليق يذكر $mention دقيقة والثابت $minutes — '
              'هذا هو الخطأ نفسه الذي رصده `APP-107`',
        );
      }
    });

    test('المدّة مُعلَنة بالكلمات أيضًا كي لا يُقرأ الرقم وحده', () {
      // «خمس عشرة» مكتوبة نصًّا: الأرقام تُعدَّل بحثًا واستبدالًا، والكلمات تُقرأ.
      expect(appSource, contains('خمس عشرة دقيقة'));
    });
  });

  group('لحظة الإبطال', () {
    test('`paused` تُبطل على غير الويب، و`detached` في كل مكان', () {
      // فحصٌ على المصدر: `didChangeAppLifecycleState` تُستدعى من إطار Flutter لا
      // من كود يمكن نداؤه هنا بلا `pumpWidget` لتطبيق كامل بمخزنٍ آمن حقيقي.
      // والخاصيّة المُثبَّتة هي الشرط نفسه، لا شكل الاستدعاء.
      expect(appSource, contains('AppLifecycleState.detached'));
      expect(appSource, contains('!kIsWeb && state == AppLifecycleState.paused'));
    });

    test('`inactive` لا تُبطل', () {
      // تُطلقها إشعارات النظام ومركز التحكّم على iOS والتطبيق في يد وليّ الأمر؛
      // وهي التي سبّبت حلقة شاشة الرمز على الويب أصلًا.
      final lifecycle = appSource.substring(
        appSource.indexOf('void didChangeAppLifecycleState'),
        appSource.indexOf('Widget build(BuildContext context)'),
      );
      expect(lifecycle.contains('AppLifecycleState.inactive'), isFalse);
    });

    test('استثناء الويب مكتوب بسببه لا مُستنتَج', () {
      // استثناءٌ بلا سبب مكتوب يُنسَخ إلى موضع آخر لا يخصّه.
      expect(appSource, contains('الويب مستثنًى'));
    });
  });

  group('AuthGuard نفسه', () {
    test('الإبطال يُسقط الإثبات ويُلغي المؤقّت', () {
      // بلا تهيئة تخزين: `revokeParentAccess` و`hasParentAccess` عمليتان في
      // الذاكرة ولا تمسّان المخزن الآمن، والحالة بعدهما هي ما يقرأه الحرس
      // والموجّه.
      final guard = AuthGuard();
      addTearDown(guard.revokeParentAccess);
      expect(guard.hasParentAccess, isFalse);
      expect(guard.parentProof, isNull);
      guard.revokeParentAccess();
      expect(guard.hasParentAccess, isFalse);
    });

    test('المدّة القصوى خمس عشرة دقيقة، مُعلَنة في موضع واحد', () {
      expect(AuthGuard.parentAccessDuration, const Duration(minutes: 15));
    });
  });
}
