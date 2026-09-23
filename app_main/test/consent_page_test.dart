/// Minimal smoke test for `ConsentPage` (task 30), proving:
///  (a) the page renders all 5 consent types with their server-reported
///      decisions,
///  (b) granting an ungranted type calls `setConsent` with the exact
///      `required_version` read from the `GET /family/consents` response
///      (never a hardcoded value), and re-fetches afterward,
///  (c) the three `reason` values (`never_granted`, `revoked`,
///      `version_superseded`) render distinct text instead of being
///      collapsed into one generic "not granted" string.
///
/// Follows `AgeTransitionReviewPage`'s test's `_FakeApiClient` pattern:
/// `fetchConsents`/`setConsent` are overridden directly on a fake subclass
/// of `MajarraApiClient` rather than exercising the real network path or
/// `authorizeParentAction`'s proof exchange.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:majarra/core/analytics/analytics.dart';
import 'package:majarra/core/speech/voice_search.dart';
import 'package:majarra/features/home/application/home_providers.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/onboarding/presentation/pages/consent_page.dart';
import 'package:majarra/l10n/app_localizations.dart';

/// Captures `fetchConsents`/`setConsent` calls and returns scripted
/// responses instead of making real requests.
class _FakeApiClient extends MajarraApiClient {
  _FakeApiClient({required this.decisionsByType}) : super(http.Client());

  /// Mutated between calls so `_toggle`'s re-fetch-after-write observes an
  /// updated decision, exactly like the real server would after a
  /// successful write.
  Map<String, Map<String, dynamic>> decisionsByType;

  final List<Map<String, dynamic>> setConsentCalls = [];
  int fetchCount = 0;

  @override
  Future<Map<String, dynamic>> fetchConsents({String? childId}) async {
    fetchCount++;
    return {
      'success': true,
      'data': {
        'rows': const [],
        'decisions': decisionsByType,
      },
    };
  }

  @override
  Future<Map<String, dynamic>> setConsent({
    required String consentType,
    required String version,
    String? childId,
    bool revoke = false,
  }) async {
    setConsentCalls.add({
      'consent_type': consentType,
      'version': version,
      'child_id': childId,
      'revoke': revoke,
    });
    // Mirror the server: a successful grant makes the type granted at the
    // version sent; a revoke marks it not granted with reason 'revoked'.
    decisionsByType = {
      ...decisionsByType,
      consentType: revoke
          ? {
              'granted': false,
              'reason': 'revoked',
              'required_version': version,
            }
          : {'granted': true, 'required_version': version},
    };
    return {'success': true, 'data': const <String, dynamic>{}};
  }
}

/// Rejects every write the way the live API does when the family already has
/// a parent PIN and the request carries no parent proof:
/// `POST /api/v1/family/consents -> 403 "A current parent proof is required"`.
///
/// The server only waives `manage_consents` for a family with **no** PIN yet
/// (the consent step precedes PIN setup during onboarding), so any family
/// past that point hits this branch.
class _ProofRequiredApiClient extends _FakeApiClient {
  _ProofRequiredApiClient({required super.decisionsByType});

  @override
  Future<Map<String, dynamic>> setConsent({
    required String consentType,
    required String version,
    String? childId,
    bool revoke = false,
  }) async {
    throw const MajarraApiException(
      'HTTP 403: {"success":false,"error":"A current parent proof is required"}',
      statusCode: 403,
    );
  }
}

/// Fails writes with something that is *not* a proof problem, to prove the
/// 403 branch is not swallowing every error into the PIN message.
class _OfflineApiClient extends _FakeApiClient {
  _OfflineApiClient({required super.decisionsByType});

  @override
  Future<Map<String, dynamic>> setConsent({
    required String consentType,
    required String version,
    String? childId,
    bool revoke = false,
  }) async {
    throw const MajarraApiException('HTTP 500: boom', statusCode: 500);
  }
}

Map<String, Map<String, dynamic>> _defaultDecisions() => {
      'data_collection': const {
        'granted': true,
        'required_version': '1',
      },
      'analytics': const {
        'granted': false,
        'reason': 'never_granted',
        'required_version': '1',
      },
      'voice': const {
        'granted': false,
        'reason': 'revoked',
        'required_version': '1',
      },
      'personalization': const {
        'granted': false,
        'reason': 'version_superseded',
        'required_version': '2',
      },
      'child_creations': const {
        'granted': false,
        'reason': 'never_granted',
        'required_version': '1',
      },
    };

Future<void> _pumpPage(
  WidgetTester tester,
  MajarraApiClient api, {
  String? childId,
}) async {
  // The default test surface is too short to lay out all 5 consent rows at
  // once; `ListView` only builds what fits its viewport, so without this the
  // last row(s) would never exist in the widget tree for `find` to see.
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  await tester.pumpWidget(
    ProviderScope(
      overrides: [majarraApiClientProvider.overrideWithValue(api)],
      child: MaterialApp(
        locale: const Locale('ar'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: ConsentPage(childId: childId),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('ConsentPage — rendering (Requirement 9.1)', () {
    testWidgets('يعرض الأنواع الخمسة بقرارات الخادم كما هي', (tester) async {
      final api = _FakeApiClient(decisionsByType: _defaultDecisions());
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      expect(find.text(l10n.consentTypeDataCollectionLabel), findsOneWidget);
      expect(find.text(l10n.consentTypeAnalyticsLabel), findsOneWidget);
      expect(find.text(l10n.consentTypeVoiceLabel), findsOneWidget);
      expect(find.text(l10n.consentTypePersonalizationLabel), findsOneWidget);
      expect(find.text(l10n.consentTypeChildCreationsLabel), findsOneWidget);
      expect(find.byType(Switch), findsNWidgets(5));
      expect(api.fetchCount, 1);
    });
  });

  group('ConsentPage — the three reasons render distinctly (Requirement 9.4, 9.7)', () {
    testWidgets('never_granted و revoked و version_superseded تظهر بنصوص مختلفة', (
      tester,
    ) async {
      final api = _FakeApiClient(decisionsByType: _defaultDecisions());
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      // analytics -> never_granted, voice -> revoked,
      // personalization -> version_superseded: three distinct strings.
      expect(find.text(l10n.consentReasonNeverGranted), findsNWidgets(2)); // analytics + child_creations
      expect(find.text(l10n.consentReasonRevoked), findsOneWidget);
      expect(find.text(l10n.consentReasonVersionSuperseded), findsOneWidget);
      expect(find.text(l10n.consentStatusGranted), findsOneWidget); // data_collection
    });
  });

  group('ConsentPage — granting writes then re-fetches (Requirement 9.2, 9.3)', () {
    testWidgets('تفعيل نوع غير ممنوح يستدعي setConsent بالنسخة الصحيحة ويعيد الجلب', (
      tester,
    ) async {
      final api = _FakeApiClient(decisionsByType: _defaultDecisions());
      await _pumpPage(tester, api, childId: 'child-1');

      // Toggle 'analytics' (never_granted, required_version '1'). Row order
      // follows `kConsentTypesOrdered`: data_collection(0), analytics(1),
      // voice(2), personalization(3), child_creations(4).
      const analyticsIndex = 1;
      final l10n = lookupAppLocalizations(const Locale('ar'));

      await tester.tap(find.byType(Switch).at(analyticsIndex));
      await tester.pumpAndSettle();

      expect(api.setConsentCalls, hasLength(1));
      expect(api.setConsentCalls.single['consent_type'], 'analytics');
      expect(api.setConsentCalls.single['version'], '1'); // read from decision, not hardcoded
      expect(api.setConsentCalls.single['child_id'], 'child-1');
      expect(api.setConsentCalls.single['revoke'], false);
      expect(api.fetchCount, 2); // initial load + re-fetch after write

      // Display now reflects the server-confirmed granted state.
      expect(find.text(l10n.consentStatusGranted), findsNWidgets(2));
      expect(find.byType(Switch), findsNWidgets(5));
    });

    testWidgets('عائلي بالكامل حين لا يوجد childId (child_id: null)', (
      tester,
    ) async {
      final api = _FakeApiClient(decisionsByType: _defaultDecisions());
      await _pumpPage(tester, api);

      final l10n = lookupAppLocalizations(const Locale('ar'));
      final analyticsSwitchIndex = 1;
      expect(find.text(l10n.consentTypeAnalyticsLabel), findsOneWidget);
      await tester.tap(find.byType(Switch).at(analyticsSwitchIndex));
      await tester.pumpAndSettle();

      expect(api.setConsentCalls.single['child_id'], isNull);
    });
  });

  group(
    'ConsentPage — revoking updates the live consumption gates immediately (Requirement 9.6)',
    () {
      testWidgets(
        'سحب موافقة analytics يوقف MajarraAnalytics فورًا بلا إعادة تحميل',
        (tester) async {
          final decisions = _defaultDecisions();
          decisions['analytics'] = const {
            'granted': true,
            'required_version': '1',
          };
          final api = _FakeApiClient(decisionsByType: decisions);
          await _pumpPage(tester, api);

          // The initial read already grants analytics via `_load`.
          expect(MajarraAnalytics.analyticsConsentGranted, isTrue);

          const analyticsIndex = 1;
          await tester.tap(find.byType(Switch).at(analyticsIndex));
          await tester.pumpAndSettle();

          // `_toggle`'s write-then-refetch cycle has completed synchronously
          // within `pumpAndSettle` — no new app session or extra read is
          // needed for the in-memory gate to reflect the revoke.
          expect(api.setConsentCalls.single['revoke'], true);
          expect(MajarraAnalytics.analyticsConsentGranted, isFalse);
        },
      );

      testWidgets(
        'سحب موافقة voice يوقف VoiceConsentGate فورًا بلا إعادة تحميل',
        (tester) async {
          final decisions = _defaultDecisions();
          decisions['voice'] = const {
            'granted': true,
            'required_version': '1',
          };
          final api = _FakeApiClient(decisionsByType: decisions);
          await _pumpPage(tester, api);

          expect(VoiceConsentGate.granted, isTrue);

          const voiceIndex = 2;
          await tester.tap(find.byType(Switch).at(voiceIndex));
          await tester.pumpAndSettle();

          expect(api.setConsentCalls.single['revoke'], true);
          expect(VoiceConsentGate.granted, isFalse);
        },
      );

      testWidgets(
        'التحميل الأولي يزامن البوابتين من قرارات الخادم مباشرة',
        (tester) async {
          final decisions = _defaultDecisions();
          decisions['analytics'] = const {
            'granted': true,
            'required_version': '1',
          };
          decisions['voice'] = const {
            'granted': false,
            'reason': 'revoked',
            'required_version': '1',
          };
          final api = _FakeApiClient(decisionsByType: decisions);
          await _pumpPage(tester, api);

          expect(MajarraAnalytics.analyticsConsentGranted, isTrue);
          expect(VoiceConsentGate.granted, isFalse);
        },
      );
    },
  );

  group('ConsentPage — 403 يعني «الرمز مطلوب» لا فشلًا عامًّا', () {
    testWidgets(
      'رفض الإثبات يعرض رسالة الرمز مع إجراء فتحٍ بدل رسالة عامة',
      (tester) async {
        final api = _ProofRequiredApiClient(
          decisionsByType: _defaultDecisions(),
        );
        await _pumpPage(tester, api);

        final l10n = lookupAppLocalizations(const Locale('ar'));
        const analyticsIndex = 1;
        await tester.tap(find.byType(Switch).at(analyticsIndex));
        await tester.pumpAndSettle();

        // الرسالة الخاصة، لا العامة التي تدعو لإعادة محاولة لا تنجح أبدًا.
        expect(find.text(l10n.consentWriteRequiresParentPin), findsOneWidget);
        expect(find.text(l10n.consentWriteErrorGeneric), findsNothing);
        // ومعها طريق إلى شاشة الرمز.
        expect(find.text(l10n.consentUnlockAction), findsOneWidget);
      },
    );

    testWidgets(
      'الفشل غير المتعلق بالإثبات يبقى على الرسالة العامة بلا إجراء رمز',
      (tester) async {
        final api = _OfflineApiClient(decisionsByType: _defaultDecisions());
        await _pumpPage(tester, api);

        final l10n = lookupAppLocalizations(const Locale('ar'));
        const analyticsIndex = 1;
        await tester.tap(find.byType(Switch).at(analyticsIndex));
        await tester.pumpAndSettle();

        expect(find.text(l10n.consentWriteErrorGeneric), findsOneWidget);
        expect(find.text(l10n.consentWriteRequiresParentPin), findsNothing);
        expect(find.text(l10n.consentUnlockAction), findsNothing);
      },
    );

    testWidgets(
      'الفشل لا يقلب المفتاح: يبقى العرض على آخر حالة أكّدها الخادم',
      (tester) async {
        final api = _ProofRequiredApiClient(
          decisionsByType: _defaultDecisions(),
        );
        await _pumpPage(tester, api);

        final l10n = lookupAppLocalizations(const Locale('ar'));
        // قبل المحاولة: ممنوح واحد فقط (data_collection).
        expect(find.text(l10n.consentStatusGranted), findsOneWidget);

        const analyticsIndex = 1;
        await tester.tap(find.byType(Switch).at(analyticsIndex));
        await tester.pumpAndSettle();

        // وبعد الرفض: ما زال واحدًا — لا تفاؤل بنجاحٍ لم يحدث (المتطلب 9.7).
        expect(find.text(l10n.consentStatusGranted), findsOneWidget);
        expect(api.fetchCount, 1); // لا إعادة جلب بعد كتابة فاشلة
      },
    );
  });
}
