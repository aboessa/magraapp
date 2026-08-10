import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/failures/app_failure.dart';
import 'package:majarra/core/widgets/app_error_view.dart';

Widget _host(Widget child) => MaterialApp(
      home: Directionality(
        textDirection: TextDirection.rtl,
        child: Scaffold(body: child),
      ),
    );

void main() {
  group('AppErrorView', () {
    testWidgets('shows the failure message and a retry button that fires', (tester) async {
      var retried = 0;
      await tester.pumpWidget(_host(AppErrorView(
        error: AppFailure.network(),
        onRetry: () => retried++,
      )));

      expect(find.text('تعذّر الاتصال. تحقّق من الإنترنت وحاول مجددًا'), findsOneWidget);
      expect(find.text('إعادة المحاولة'), findsOneWidget);

      await tester.tap(find.text('إعادة المحاولة'));
      expect(retried, 1);
    });

    testWidgets('an unauthorized failure offers sign-in', (tester) async {
      var loggedIn = 0;
      await tester.pumpWidget(_host(AppErrorView(
        error: const AppFailure(FailureKind.unauthorized, 'انتهت الجلسة', needsLogin: true),
        onLogin: () => loggedIn++,
        onRetry: () {},
      )));

      expect(find.text('تسجيل الدخول'), findsOneWidget);
      await tester.tap(find.text('تسجيل الدخول'));
      expect(loggedIn, 1);
    });

    testWidgets('an entitlement failure offers upgrade', (tester) async {
      await tester.pumpWidget(_host(AppErrorView(
        error: const AppFailure(FailureKind.forbidden, 'يتطلب اشتراكًا', needsUpgrade: true),
        onUpgrade: () {},
      )));
      expect(find.text('عرض الاشتراك'), findsOneWidget);
    });

    testWidgets('parent-facing diagnostic detail shows the failure kind', (tester) async {
      await tester.pumpWidget(_host(AppErrorView(
        error: AppFailure.timeout(),
        showDiagnosticDetail: true,
      )));
      expect(find.textContaining('timeout'), findsOneWidget);
    });
  });

  group('OfflineNotice', () {
    testWidgets('renders message and optional refresh', (tester) async {
      var refreshed = 0;
      await tester.pumpWidget(_host(OfflineNotice(onRetry: () => refreshed++)));
      expect(find.textContaining('بلا اتصال'), findsOneWidget);
      await tester.tap(find.text('تحديث'));
      expect(refreshed, 1);
    });
  });
}
