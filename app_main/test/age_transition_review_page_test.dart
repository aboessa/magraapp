/// Minimal smoke test for `AgeTransitionReviewPage` (task 28), proving the
/// page renders the review comparison (stored vs computed track) and does
/// not crash when the accept/defer actions are tapped against a fake
/// `MajarraApiClient`.
///
/// This deliberately does not exercise the real network path or
/// `authorizeParentAction`'s proof exchange — those are covered by the
/// server-side track-transition tests (tasks 25-27) and the client's
/// existing `authorizeParentAction` usage elsewhere (`updateChild`,
/// `createChild`). Here, `trackTransition` is overridden directly to keep
/// the test scoped to this page's own rendering and interaction logic,
/// matching the "keep this lightweight" scope given for this task.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/features/child/presentation/pages/age_transition_review_page.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations.dart';

/// Captures `trackTransition` calls and returns a scripted response per
/// action instead of making a real request.
class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient({
    this.storedTrack = 'preschool',
    this.computedTrack = 'kids',
    this.deferConflict = false,
  }) : super(http.Client());

  final String storedTrack;
  final String computedTrack;

  /// When true, `defer` throws the 409 "already active" conflict instead of
  /// succeeding, with a `deferred_until` in the exception's `data`.
  final bool deferConflict;

  final List<String> calledActions = [];

  @override
  Future<Map<String, dynamic>> trackTransition(
    String childId, {
    required String action,
  }) async {
    calledActions.add(action);
    switch (action) {
      case 'review':
        return {
          'success': true,
          'data': {
            'child_id': childId,
            'stored_track': storedTrack,
            'computed_track': computedTrack,
            'changed': storedTrack != computedTrack,
          },
        };
      case 'accept':
        return {
          'success': true,
          'data': {
            'child_id': childId,
            'previous_track': storedTrack,
            'age_track': computedTrack,
          },
        };
      case 'defer':
        if (deferConflict) {
          throw MajarraApiException(
            'A track transition deferral is already active',
            statusCode: 409,
            data: const {'deferred_until': 1735689600000},
          );
        }
        return {
          'success': true,
          'data': {'child_id': childId, 'deferred_until': 1735689600000},
        };
      default:
        throw StateError('Unexpected action: $action');
    }
  }
}

Future<void> _pumpPage(
  WidgetTester tester,
  MajarraApiClient api, {
  String childId = 'child-1',
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [majarraApiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Navigator(
          pages: [
            const MaterialPage(child: Scaffold(body: SizedBox())),
            MaterialPage(child: AgeTransitionReviewPage(childId: childId)),
          ],
          onDidRemovePage: (page) {},
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('AgeTransitionReviewPage — review state (Requirement 12.4)', () {
    testWidgets('يعرض المسار الحالي والمحتسب عند اختلافهما ويستدعي review', (
      tester,
    ) async {
      final api = _FakeApiClient(storedTrack: 'preschool', computedTrack: 'kids');
      await _pumpPage(tester, api);

      expect(find.byType(AgeTransitionReviewPage), findsOneWidget);
      expect(api.calledActions, contains('review'));

      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.ageTrackLabelPreschool), findsOneWidget);
      expect(find.text(l10n.ageTrackLabelKids), findsOneWidget);
      expect(find.text(l10n.ageTransitionAcceptButton), findsOneWidget);
      expect(find.text(l10n.ageTransitionDeferButton), findsOneWidget);
    });

    testWidgets('يعرض حالة "لا يوجد تغيير" حين يتطابق المساران', (
      tester,
    ) async {
      final api = _FakeApiClient(storedTrack: 'kids', computedTrack: 'kids');
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.ageTransitionNoChangeTitle), findsOneWidget);
      expect(find.text(l10n.ageTransitionAcceptButton), findsNothing);
    });
  });

  group('AgeTransitionReviewPage — accept/defer actions (Requirement 12.5)', () {
    testWidgets('الضغط على تأكيد الانتقال يستدعي accept ويعرض تأكيدًا', (
      tester,
    ) async {
      final api = _FakeApiClient(storedTrack: 'preschool', computedTrack: 'kids');
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      await tester.tap(find.text(l10n.ageTransitionAcceptButton));
      await tester.pumpAndSettle();

      expect(api.calledActions, containsAllInOrder(['review', 'accept']));
      expect(find.byType(AgeTransitionReviewPage), findsOneWidget);
    });

    testWidgets('الضغط على تأجيل لاحقًا يستدعي defer ويعرض تأكيدًا', (
      tester,
    ) async {
      final api = _FakeApiClient(storedTrack: 'preschool', computedTrack: 'kids');
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      await tester.tap(find.text(l10n.ageTransitionDeferButton));
      await tester.pumpAndSettle();

      expect(api.calledActions, containsAllInOrder(['review', 'defer']));
      expect(find.byType(AgeTransitionReviewPage), findsOneWidget);
    });

    testWidgets('تأجيل ثانٍ مع تعارض 409 يعرض تاريخ التأجيل النشط لا رسالة عامة', (
      tester,
    ) async {
      final api = _FakeApiClient(
        storedTrack: 'preschool',
        computedTrack: 'kids',
        deferConflict: true,
      );
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      await tester.tap(find.text(l10n.ageTransitionDeferButton));
      await tester.pumpAndSettle();

      expect(api.calledActions, containsAllInOrder(['review', 'defer']));
      expect(
        find.textContaining('2025'),
        findsOneWidget,
        reason: 'رسالة التعارض يجب أن تعرض تاريخ deferred_until المُعاد من الخادم',
      );
    });
  });
}
