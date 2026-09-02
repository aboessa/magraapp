import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:majarra/app/router/app_router.dart';

/// `APP-108` — الاتجاه يُقرَّر من بيانات المسار، لا من مطابقة نصّ.
///
/// ## العطل كان أسوأ من «هشاشة»
///
/// الشرط كان:
///
/// ```dart
/// ModalRoute.of(context)?.settings.name?.contains('playback')
/// ```
///
/// داخل `MaterialApp.router(builder:)`. وذلك الموضع **فوق الـNavigator**، فلا
/// `ModalRoute` أعلاه — والقيمة `null` **دائمًا**. أي أن الشرط لم يكن «قد يفشل في
/// الاتجاهين» كما وصفه البند: كان **مكسورًا في اتجاه واحد ثابت**، فتُغطّى شاشة
/// المُشغِّل بدعوة «أدِر الجهاز» في الوضع الأفقي — وهو الوضع الذي يفتحه المُشغِّل
/// بنفسه للفيديو على هاتف مضغوط.
///
/// ولذلك يثبّت هذا الملف الأمرين: أن `fullPath` يُعطي **نمط** المسار فعلًا (وهو
/// الافتراض الذي يقوم عليه الإصلاح)، وأن الشرط النصّي لم يعد في المصدر.

void main() {
  /// موجّه بأقلّ ما يكفي: مسار عادي، ومسار المُشغِّل بنفس النمط المُعلَن في التطبيق.
  GoRouter buildRouter() => GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (_, _) => const Text('HOME')),
      GoRoute(
        path: '/playback/:episodeId',
        builder: (_, state) => Text('PLAY ${state.pathParameters['episodeId']}'),
      ),
      GoRoute(path: '/read', builder: (_, _) => const Text('READ')),
    ],
  );

  Future<GoRouter> pumpRouter(WidgetTester tester) async {
    final router = buildRouter();
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    return router;
  }

  group('routeAllowsLandscape', () {
    testWidgets('الرئيسية لا تسمح بالأفقي', (tester) async {
      final router = await pumpRouter(tester);
      expect(routeAllowsLandscape(router), isFalse);
    });

    testWidgets('مسار المُشغِّل يسمح، بأي معرّف حلقة', (tester) async {
      final router = await pumpRouter(tester);

      router.go('/playback/ep-1');
      await tester.pumpAndSettle();
      expect(find.text('PLAY ep-1'), findsOneWidget);
      // الافتراض الذي يقوم عليه الإصلاح: `fullPath` هو **النمط** لا الموقع.
      expect(
        router.routerDelegate.currentConfiguration.fullPath,
        '/playback/:episodeId',
      );
      expect(routeAllowsLandscape(router), isTrue);

      // معرّف آخر، ونفس النمط — فلا حاجة إلى تحليل نصّي للعنوان.
      router.go('/playback/another-episode-id');
      await tester.pumpAndSettle();
      expect(routeAllowsLandscape(router), isTrue);
    });

    testWidgets('الخروج من المُشغِّل يُعيد المنع', (tester) async {
      // معيار القبول يطلب تغطية الدخول **والخروج**: قرارٌ يُمنَح ولا يُسحَب أسوأ من
      // قرارٍ لا يُمنَح، لأن كل الشاشات بعده تُعرَض بتخطيط مكسور.
      final router = await pumpRouter(tester);
      router.go('/playback/ep-1');
      await tester.pumpAndSettle();
      expect(routeAllowsLandscape(router), isTrue);

      router.go('/read');
      await tester.pumpAndSettle();
      expect(routeAllowsLandscape(router), isFalse);
    });
  });

  group('المصدر', () {
    final appSource = File('lib/app/majarra_app.dart').readAsStringSync();

    test('لا مطابقة نصّية على اسم المسار في حاجز الاتجاه', () {
      // التعليقات تُقشَّر: الشرح **يقتبس** الكود القديم، وفحصُ الملف كلّه كان
      // يرصد الشرح فيبلّغ عن الملف الذي أُصلح — نفس درس الدفعتين 29 و33.
      final executable = appSource
          .split('\n')
          .where((line) => !line.trimLeft().startsWith('//'))
          .join('\n');
      expect(executable.contains("contains('playback')"), isFalse);
      // و`ModalRoute` لا مكان له هنا: `builder` فوق الـNavigator.
      expect(executable.contains('ModalRoute.of(context)'), isFalse);
    });

    test('الحاجز يُعاد بناؤه عند التنقّل', () {
      // بلا الاستماع إلى المُفوِّض يبقى القرار معلَّقًا على `MediaQuery` وحده،
      // فيتأخّر إلى أوّل تغيّر حجمٍ بعد التنقّل.
      expect(appSource, contains('listenable: router.routerDelegate'));
      expect(appSource, contains('routeAllowsLandscape(router)'));
    });

    test('مسار المُشغِّل مُعلَن في مجموعة واحدة', () {
      final routerSource = File('lib/app/router/app_router.dart').readAsStringSync();
      expect(routerSource, contains('landscapeCapableRoutes'));
      expect(landscapeCapableRoutes, {'/playback/:episodeId'});
    });
  });
}
