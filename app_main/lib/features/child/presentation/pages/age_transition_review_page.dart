import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../application/family_children_provider.dart';

/// Localized label for one of the three server-computed age tracks.
///
/// Mirrors `ChildProfile.trackLabel` (`child_switcher_page.dart`) and
/// `ChildState.trackLabel` (`child_provider.dart`) exactly in meaning —
/// `preschool`/`kids`/`junior` map to the same three concepts — but reads
/// through `AppLocalizations` instead of a hardcoded Arabic literal, because
/// this file is subject to the new-screen l10n policy (Requirement 7) that
/// those two older files predate.
String ageTrackLabel(AppLocalizations l10n, String track) => switch (track) {
      'preschool' => l10n.ageTrackLabelPreschool,
      'kids' => l10n.ageTrackLabelKids,
      'junior' => l10n.ageTrackLabelJunior,
      _ => l10n.ageTrackLabelUnknown,
    };

/// Shows a child's stored age track against the server's freshly
/// recomputed one, and lets a parent accept or defer the transition
/// (Requirement 12.4, 12.5).
///
/// Reached from `ParentDashboardPage`'s children list — see
/// `_ChildTrackTransitionBadge` there. Not registered as a `GoRoute`
/// (consistent with `ChildProfileFormPage`'s task 21 precedent): this page
/// has no deep-link entry point requirement, so a direct
/// `Navigator.push(MaterialPageRoute(...))` is enough.
///
/// Takes only [childId], not a full `ChildProfile`. The whole point of this
/// screen is comparing the server's authoritative `stored_track` against
/// its freshly computed one — trusting a possibly-stale client-side
/// `ChildProfile.ageTrack` instead would defeat that comparison, so the
/// `review` action is always called fresh on open rather than seeded from a
/// cached value.
class AgeTransitionReviewPage extends ConsumerStatefulWidget {
  const AgeTransitionReviewPage({required this.childId, super.key});

  final String childId;

  @override
  ConsumerState<AgeTransitionReviewPage> createState() =>
      _AgeTransitionReviewPageState();
}

class _AgeTransitionReviewPageState
    extends ConsumerState<AgeTransitionReviewPage> {
  Future<Map<String, dynamic>>? _reviewFuture;
  bool _busy = false;
  String? _error;

  /// Non-null once an action (accept/defer) has resolved, so the review
  /// section can be replaced with a confirmation instead of re-fetching a
  /// `review` that would now reflect the just-written state.
  String? _successMessage;

  @override
  void initState() {
    super.initState();
    _reviewFuture = _loadReview();
  }

  Future<Map<String, dynamic>> _loadReview() {
    return ref
        .read(majarraApiClientProvider)
        .trackTransition(widget.childId, action: 'review');
  }

  void _reload() {
    setState(() {
      _error = null;
      _successMessage = null;
      _reviewFuture = _loadReview();
    });
  }

  String _formatDate(int epochMs) {
    final date = DateTime.fromMillisecondsSinceEpoch(epochMs);
    final y = date.year.toString().padLeft(4, '0');
    final m = date.month.toString().padLeft(2, '0');
    final d = date.day.toString().padLeft(2, '0');
    return '$y-$m-$d';
  }

  Future<void> _accept(String computedTrack) async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(majarraApiClientProvider)
          .trackTransition(widget.childId, action: 'accept');
      if (!mounted) return;
      ref.invalidate(familyChildrenProvider);
      setState(() {
        _busy = false;
        _successMessage = l10n.ageTransitionAcceptSuccessBody(
          ageTrackLabel(l10n, computedTrack),
        );
      });
    } on MajarraApiException catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = l10n.ageTransitionErrorGeneric;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = l10n.ageTransitionErrorGeneric;
      });
    }
  }

  Future<void> _defer() async {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final envelope = await ref
          .read(majarraApiClientProvider)
          .trackTransition(widget.childId, action: 'defer');
      if (!mounted) return;
      final data = envelope['data'];
      final deferredUntil =
          data is Map ? data['deferred_until'] as num? : null;
      setState(() {
        _busy = false;
        _successMessage = deferredUntil != null
            ? l10n.ageTransitionDeferSuccessBody(
                _formatDate(deferredUntil.toInt()),
              )
            : l10n.ageTransitionErrorGeneric;
      });
    } on MajarraApiException catch (e) {
      if (!mounted) return;
      // The 409 "a deferral is already active" conflict carries its
      // `deferred_until` in the error envelope's `data` field — show that
      // date instead of a generic failure (task instructions, point 8).
      final deferredUntil = e.data?['deferred_until'];
      if (e.statusCode == 409 && deferredUntil is num) {
        setState(() {
          _busy = false;
          _successMessage = l10n.ageTransitionDeferAlreadyActiveBody(
            _formatDate(deferredUntil.toInt()),
          );
        });
        return;
      }
      setState(() {
        _busy = false;
        _error = l10n.ageTransitionErrorGeneric;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = l10n.ageTransitionErrorGeneric;
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
              _AppBar(title: l10n.ageTransitionReviewTitle),
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 560),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: _successMessage != null
                          ? _SuccessCard(message: _successMessage!)
                          : FutureBuilder<Map<String, dynamic>>(
                              future: _reviewFuture,
                              builder: (context, snapshot) {
                                if (snapshot.connectionState !=
                                    ConnectionState.done) {
                                  return const Padding(
                                    padding: EdgeInsets.symmetric(
                                      vertical: 48,
                                    ),
                                    child: Center(
                                      child: CircularProgressIndicator(
                                        color: AppColors.starGold,
                                      ),
                                    ),
                                  );
                                }
                                if (snapshot.hasError) {
                                  return _ErrorCard(
                                    message: l10n.ageTransitionLoadErrorGeneric,
                                    onRetry: _reload,
                                  );
                                }
                                final envelope = snapshot.data!;
                                final data = envelope['data'];
                                final storedTrack = data is Map
                                    ? data['stored_track']?.toString() ?? ''
                                    : '';
                                final computedTrack = data is Map
                                    ? data['computed_track']?.toString() ?? ''
                                    : '';
                                final changed =
                                    data is Map && data['changed'] == true;
                                return _ReviewBody(
                                  storedTrack: storedTrack,
                                  computedTrack: computedTrack,
                                  changed: changed,
                                  busy: _busy,
                                  error: _error,
                                  onAccept: () => _accept(computedTrack),
                                  onDefer: _defer,
                                );
                              },
                            ),
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

class _AppBar extends StatelessWidget {
  const _AppBar({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
            tooltip: l10n.back,
            onPressed: () => context.pop(),
          ),
          Expanded(
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(width: 48),
        ],
      ),
    );
  }
}

class _ReviewBody extends StatelessWidget {
  const _ReviewBody({
    required this.storedTrack,
    required this.computedTrack,
    required this.changed,
    required this.busy,
    required this.error,
    required this.onAccept,
    required this.onDefer,
  });

  final String storedTrack;
  final String computedTrack;
  final bool changed;
  final bool busy;
  final String? error;
  final VoidCallback onAccept;
  final VoidCallback onDefer;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    final storedLabel = ageTrackLabel(l10n, storedTrack);
    final computedLabel = ageTrackLabel(l10n, computedTrack);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Expanded(
              child: _TrackTile(
                label: l10n.ageTransitionCurrentTrackLabel,
                value: storedLabel,
                highlight: false,
              ),
            ),
            const SizedBox(width: 12),
            const Icon(
              Icons.arrow_back_rounded,
              color: AppColors.mutedText,
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _TrackTile(
                label: l10n.ageTransitionComputedTrackLabel,
                value: computedLabel,
                highlight: changed,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        if (!changed)
          _InfoCard(
            title: l10n.ageTransitionNoChangeTitle,
            body: l10n.ageTransitionNoChangeBody,
          )
        else ...[
          _InfoCard(
            title: l10n.ageTransitionReviewTitle,
            body: l10n.ageTransitionChangeDescription(
              storedLabel,
              computedLabel,
            ),
          ),
          const SizedBox(height: 20),
          if (error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.danger.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(
                  color: AppColors.danger.withValues(alpha: 0.22),
                ),
              ),
              child: Text(
                error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12),
              ),
            ),
            const SizedBox(height: 14),
          ],
          FilledButton(
            onPressed: busy ? null : onAccept,
            style: FilledButton.styleFrom(
              backgroundColor: AppColors.starGold,
              foregroundColor: AppColors.deepSpace,
              minimumSize: const Size.fromHeight(52),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: busy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.deepSpace,
                    ),
                  )
                : Text(
                    l10n.ageTransitionAcceptButton,
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                    ),
                  ),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: busy ? null : onDefer,
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white70,
              minimumSize: const Size.fromHeight(48),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.14)),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
            ),
            child: Text(
              l10n.ageTransitionDeferButton,
              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
            ),
          ),
        ],
      ],
    );
  }
}

class _TrackTile extends StatelessWidget {
  const _TrackTile({
    required this.label,
    required this.value,
    required this.highlight,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: highlight
            ? AppColors.starGold.withValues(alpha: 0.12)
            : const Color(0xFF111A3A).withValues(alpha: 0.78),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: highlight
              ? AppColors.starGold.withValues(alpha: 0.4)
              : Colors.white.withValues(alpha: 0.08),
        ),
      ),
      child: Column(
        children: [
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.mutedText, fontSize: 10.5),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: highlight ? AppColors.starGold : Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: const TextStyle(
              color: AppColors.mutedText,
              fontSize: 12,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _SuccessCard extends StatelessWidget {
  const _SuccessCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.28)),
      ),
      child: Column(
        children: [
          const Icon(
            Icons.check_circle_rounded,
            color: AppColors.success,
            size: 32,
          ),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 13,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Column(
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
    );
  }
}
