import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/analytics/analytics.dart';
import '../../../../core/speech/voice_search.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../../domain/consent_types.dart';

/// Localized label for one of the five consent types (Requirement 9.1).
String consentTypeLabel(AppLocalizations l10n, String type) => switch (type) {
      kConsentTypeDataCollection => l10n.consentTypeDataCollectionLabel,
      kConsentTypeAnalytics => l10n.consentTypeAnalyticsLabel,
      kConsentTypeVoice => l10n.consentTypeVoiceLabel,
      kConsentTypePersonalization => l10n.consentTypePersonalizationLabel,
      kConsentTypeChildCreations => l10n.consentTypeChildCreationsLabel,
      _ => type,
    };

/// Plain-language explanation of what granting [type] actually means, shown
/// under its label so a parent decides on an informed basis rather than a
/// bare toggle (Requirement 9.7's "honest, non-misleading display").
String consentTypeDescription(AppLocalizations l10n, String type) => switch (type) {
      kConsentTypeDataCollection => l10n.consentTypeDataCollectionDescription,
      kConsentTypeAnalytics => l10n.consentTypeAnalyticsDescription,
      kConsentTypeVoice => l10n.consentTypeVoiceDescription,
      kConsentTypePersonalization => l10n.consentTypePersonalizationDescription,
      kConsentTypeChildCreations => l10n.consentTypeChildCreationsDescription,
      _ => '',
    };

/// Explains *why* a not-granted decision is not granted.
///
/// The server's `evaluateConsent` (`dashboard/api/src/lib/consent.ts`)
/// returns one of three distinct reasons, and collapsing them into a single
/// generic "not granted" string would hide the difference between a parent
/// who was never asked, a parent who said no on purpose, and a policy that
/// changed under an old yes (Requirement 9.4, 9.7).
String consentReasonText(AppLocalizations l10n, String? reason) => switch (reason) {
      'revoked' => l10n.consentReasonRevoked,
      'version_superseded' => l10n.consentReasonVersionSuperseded,
      _ => l10n.consentReasonNeverGranted,
    };

/// Reads and writes the parental consents surfaced by the existing
/// `GET/POST /family/consents` endpoints (Requirement 9).
///
/// Deliberately not onboarding-specific: [childId] and [onContinue] are both
/// optional constructor parameters rather than assumptions baked into the
/// widget, so a future settings entry point (a parent revisiting consents
/// after onboarding, per Requirement 9.2 not being scoped to "during
/// onboarding only") can reuse this page unchanged. When [childId] is `null`
/// every read and write is family-wide (`child_id: null`, matching
/// `evaluateConsent`'s "a family-wide row covers every child" rule); when
/// non-null, every type shown is scoped uniformly to that one child.
///
/// The displayed grant state is never flipped optimistically: a toggle stays
/// disabled (showing a small spinner) while its write is in flight, and the
/// page only updates what it shows once that write has succeeded **and** a
/// fresh `GET /family/consents` has been re-read — never from a value
/// assumed locally (Requirement 9.2, 9.7).
class ConsentPage extends ConsumerStatefulWidget {
  const ConsentPage({this.childId, this.onContinue, super.key});

  /// Scopes every read/write to this child when non-null; family-wide
  /// (`child_id: null`) when `null`. See the class doc for the rationale.
  final String? childId;

  /// Called when the parent taps the closing "continue" action. `null`
  /// hides that action entirely, which is how this page stays reusable
  /// outside a flow that has a "next step" to advance to.
  final VoidCallback? onContinue;

  @override
  ConsumerState<ConsentPage> createState() => _ConsentPageState();
}

class _ConsentPageState extends ConsumerState<ConsentPage> {
  Future<Map<String, dynamic>>? _consentsFuture;

  /// Types with a write currently in flight, so only that row shows a
  /// spinner and stays disabled while the rest of the page remains
  /// interactive (task instructions, point 8).
  final Set<String> _pendingTypes = {};

  String? _writeError;

  @override
  void initState() {
    super.initState();
    _consentsFuture = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final envelope = await ref
        .read(majarraApiClientProvider)
        .fetchConsents(childId: widget.childId);
    _syncConsentGates(envelope);
    return envelope;
  }

  /// Propagates the freshly-read `analytics`/`voice` decisions to the
  /// in-memory gates their consumers read (Requirement 9.6:
  /// [MajarraAnalytics.setAnalyticsConsent], [VoiceConsentGate.setGranted]).
  ///
  /// Called after every successful read *and* every successful write's
  /// re-fetch, so a revoke made on this page takes effect the instant this
  /// page's own read-after-write completes — no extra round trip, no
  /// separate persistence step that could go stale.
  void _syncConsentGates(Map<String, dynamic> envelope) {
    final decisions = _decisionsFrom(envelope);
    if (decisions == null) return;
    final analytics = decisions[kConsentTypeAnalytics];
    if (analytics is Map) {
      MajarraAnalytics.setAnalyticsConsent(analytics['granted'] == true);
    }
    final voice = decisions[kConsentTypeVoice];
    if (voice is Map) {
      VoiceConsentGate.setGranted(voice['granted'] == true);
    }
  }

  void _reload() {
    setState(() {
      _writeError = null;
      _consentsFuture = _load();
    });
  }

  /// Defensive parsing mirroring `CreationCloudService.hasConsent`'s style
  /// (`is Map` at every level, no shape assumed) — see
  /// `creation_cloud_service.dart`.
  Map<String, dynamic>? _decisionsFrom(Map<String, dynamic> envelope) {
    final data = envelope['data'];
    if (data is! Map) return null;
    final decisions = data['decisions'];
    if (decisions is! Map) return null;
    return decisions.map((key, value) => MapEntry(key.toString(), value));
  }

  /// Grants or revokes [type], then re-fetches before changing what is
  /// displayed — never optimistically (Requirement 9.2, 9.7).
  Future<void> _toggle({
    required String type,
    required String requiredVersion,
    required bool grant,
  }) async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _pendingTypes.add(type);
      _writeError = null;
    });
    final api = ref.read(majarraApiClientProvider);
    try {
      await api.setConsent(
        consentType: type,
        version: requiredVersion,
        childId: widget.childId,
        revoke: !grant,
      );
      final fresh = await api.fetchConsents(childId: widget.childId);
      _syncConsentGates(fresh);
      if (!mounted) return;
      setState(() {
        _pendingTypes.remove(type);
        _consentsFuture = Future.value(fresh);
      });
    } catch (_) {
      // The write (or the re-fetch after it) failed: the display must stay
      // on the last server-confirmed state, not flip to what the parent
      // asked for (Requirement 9.7 — no success shown that did not happen).
      if (!mounted) return;
      setState(() {
        _pendingTypes.remove(type);
        _writeError = l10n.consentWriteErrorGeneric;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 4),
                child: Text(
                  l10n.consentPageTitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 8),
                child: Text(
                  l10n.consentPageIntro,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: AppColors.mutedText,
                    fontSize: 12.5,
                    height: 1.6,
                  ),
                ),
              ),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: FutureBuilder<Map<String, dynamic>>(
                      future: _consentsFuture,
                      builder: (context, snapshot) {
                        if (snapshot.connectionState != ConnectionState.done) {
                          return const Center(
                            child: CircularProgressIndicator(
                              color: AppColors.starGold,
                            ),
                          );
                        }
                        if (snapshot.hasError) {
                          return _ErrorState(
                            message: l10n.consentLoadErrorGeneric,
                            onRetry: _reload,
                          );
                        }
                        final decisions = _decisionsFrom(snapshot.data!);
                        if (decisions == null) {
                          return _ErrorState(
                            message: l10n.consentLoadErrorGeneric,
                            onRetry: _reload,
                          );
                        }
                        return ListView(
                          padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                          children: [
                            if (_writeError != null) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: AppColors.danger.withValues(
                                    alpha: 0.10,
                                  ),
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: AppColors.danger.withValues(
                                      alpha: 0.22,
                                    ),
                                  ),
                                ),
                                child: Text(
                                  _writeError!,
                                  style: const TextStyle(
                                    color: AppColors.danger,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                            for (final type in kConsentTypesOrdered)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _ConsentRow(
                                  type: type,
                                  decision: decisions[type] is Map
                                      ? (decisions[type] as Map).map(
                                          (key, value) =>
                                              MapEntry(key.toString(), value),
                                        )
                                      : null,
                                  pending: _pendingTypes.contains(type),
                                  onToggle: (grant, requiredVersion) => _toggle(
                                    type: type,
                                    requiredVersion: requiredVersion,
                                    grant: grant,
                                  ),
                                ),
                              ),
                            if (widget.onContinue != null) ...[
                              const SizedBox(height: 8),
                              FilledButton(
                                onPressed: widget.onContinue,
                                style: FilledButton.styleFrom(
                                  backgroundColor: AppColors.starGold,
                                  foregroundColor: AppColors.deepSpace,
                                  minimumSize: const Size.fromHeight(52),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
                                child: Text(
                                  l10n.consentContinueButton,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        );
                      },
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ConsentRow extends StatelessWidget {
  const _ConsentRow({
    required this.type,
    required this.decision,
    required this.pending,
    required this.onToggle,
  });

  final String type;

  /// The server's decision for [type], already unwrapped from the envelope.
  /// `null` when the response did not carry a usable entry for this type —
  /// the row then renders disabled rather than guessing a state.
  final Map<String, dynamic>? decision;

  final bool pending;

  /// `grant`: true to request granting, false to request revoking.
  /// `requiredVersion`: the exact `required_version` read from [decision],
  /// never a hardcoded literal (Requirement 9.4).
  final void Function(bool grant, String requiredVersion) onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final granted = decision?['granted'] == true;
    final reason = decision?['reason'] as String?;
    final requiredVersion = decision?['required_version'];
    final canToggle = requiredVersion is String && requiredVersion.isNotEmpty;

    final statusText = granted
        ? l10n.consentStatusGranted
        : consentReasonText(l10n, reason);
    final statusColor = granted ? AppColors.success : AppColors.mutedText;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  consentTypeLabel(l10n, type),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 13.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  consentTypeDescription(l10n, type),
                  style: const TextStyle(
                    color: AppColors.mutedText,
                    fontSize: 11.5,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  statusText,
                  style: TextStyle(
                    color: statusColor,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          pending
              ? const SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : Switch(
                  value: granted,
                  onChanged: !canToggle
                      ? null
                      : (value) => onToggle(value, requiredVersion),
                  activeThumbColor: AppColors.starGold,
                ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: AppColors.mutedText,
              size: 28,
            ),
            const SizedBox(height: 12),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.mutedText, fontSize: 12),
            ),
            const SizedBox(height: 14),
            TextButton(
              onPressed: onRetry,
              child: Text(
                l10n.retry,
                style: const TextStyle(
                  color: AppColors.starGold,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
