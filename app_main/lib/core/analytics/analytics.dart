import 'package:flutter/foundation.dart';

import '../env/app_environment.dart';

/// Privacy-safe product analytics — anonymous internal ids only, never PII (§34).
///
/// Two guarantees enforce the privacy stance for a children's app:
///  1. An event allowlist: anything not declared here is dropped, so a stray
///     `log(...)` cannot start collecting something new by accident.
///  2. A parameter denylist: keys that could carry personal or free-form data
///     (nickname, email, birth date, raw search text, a transcript, drawing
///     coordinates) are stripped even for allowed events. Search is measured by
///     result count, never by what the child typed.
///
/// Dispatch is gated on [AppConfig.analyticsEnabled] (off in development), so
/// local runs never pollute product metrics, and separately on the parent's
/// live `analytics` consent decision (Requirement 9.6): see
/// [MajarraAnalytics.setAnalyticsConsent].
class MajarraAnalytics {
  /// In-memory, session-only mirror of the server's last-known decision for
  /// the `analytics` consent type.
  ///
  /// This is deliberately not a `SharedPreferences`-persisted flag. A value
  /// written to disk could go stale relative to the server (revoked on
  /// another device, or a write that succeeded server-side while the local
  /// cache write was missed), and Requirement 9.6 explicitly rules out tying
  /// behavior to a separate local flag for exactly that reason. Instead this
  /// evaporates on app restart — a fresh session assumes no consent
  /// ([_analyticsConsentGranted] defaults to `false`, the safe default) until
  /// whichever screen reads `/family/consents` (today, `ConsentPage`) calls
  /// [setAnalyticsConsent] with a real server answer.
  ///
  /// [MajarraAnalytics] stays a static class rather than a Riverpod service
  /// because dozens of call sites across the app invoke `log`/the typed
  /// helpers directly with no `Ref`/`WidgetRef` threaded through — converting
  /// every one of them just to gate on consent would be a large, invasive
  /// refactor disproportionate to what Requirement 9.6 asks for. A single
  /// static field checked at the one chokepoint every call site already
  /// funnels through ([log]) satisfies "stops immediately, from the next
  /// request" with none of that churn.
  static bool _analyticsConsentGranted = false;

  /// The last-known `analytics` consent decision. Exposed (not just the
  /// setter) so [log] can read it and so tests can assert the effect of a
  /// revoke without a contorted seam.
  static bool get analyticsConsentGranted => _analyticsConsentGranted;

  /// Called by whichever screen last read the parent's consent decisions
  /// (today, `ConsentPage`'s `_load`/`_toggle`) with the freshly-read
  /// `analytics` decision's `granted` value. A revoke recorded here blocks
  /// the very next [log] call anywhere in the app — no new session or app
  /// restart required.
  static void setAnalyticsConsent(bool granted) {
    _analyticsConsentGranted = granted;
  }

  static const _allowedEvents = {
    // Existing home/portal surface.
    'home_feed_loaded',
    'home_block_impression',
    'hero_impression',
    'hero_primary_action',
    'feed_filter_selected',
    'portal_opened',
    'portal_ring_rotated',
    'portal_mode_selected',
    'portal_planet_selected',
    'pick_for_me_accepted',
    'continue_resumed',
    // Content lifecycle.
    'content_started',
    'content_completed',
    'playback_error',
    // Discovery.
    'search_performed',
    'voice_search_used',
    // Learning / play.
    'game_started',
    'game_completed',
    'reader_opened',
    // Offline.
    'download_succeeded',
    'download_failed',
  };

  /// Substrings that must never appear in a parameter key. Free-form or personal
  /// values are dropped regardless of the event.
  static const _blockedKeySubstrings = [
    'nickname', 'email', 'birth', 'name', 'query', 'text', 'transcript',
    'coordinate', 'coord', 'pixel', 'audio', 'address', 'phone',
  ];

  static void log(String event, {Map<String, dynamic>? params}) {
    if (!_allowedEvents.contains(event)) {
      if (kDebugMode) debugPrint('[analytics] blocked disallowed event: $event');
      return;
    }

    final safeParams = <String, dynamic>{};
    params?.forEach((k, v) {
      final key = k.toLowerCase();
      if (_blockedKeySubstrings.any(key.contains)) return;
      // Only scalar values are allowed through; a nested map/list could smuggle
      // free-form content past the key filter.
      if (v is num || v is bool || v is String && v.length <= 64) {
        safeParams[k] = v;
      }
    });

    if (kDebugMode) {
      debugPrint('[analytics] $event ${safeParams.isEmpty ? '' : safeParams}');
    }

    // Dispatch only where analytics is enabled (never in development)...
    if (!AppConfig.analyticsEnabled) return;
    // ...and only where the parent's live `analytics` consent is currently
    // granted (Requirement 9.6). Reading the in-memory gate here — rather
    // than a value cached at some earlier point per call site — is what
    // makes a revoke stop dispatch starting with the very next call.
    if (!_analyticsConsentGranted) return;
    // TODO(backend): queue -> Analytics Engine / R2. Transport is a backend
    // integration; the safe event/param shape above is what will be sent.
  }

  // --- Typed helpers -------------------------------------------------------

  static void heroImpression(String spotlightId) => log('hero_impression', params: {'spotlight_id': spotlightId});
  static void heroAction(String spotlightId) => log('hero_primary_action', params: {'spotlight_id': spotlightId});
  static void portalOpened() => log('portal_opened');
  static void portalRotated(int index) => log('portal_ring_rotated', params: {'index': index});
  static void planetSelected(String planetId) => log('portal_planet_selected', params: {'planet_id': planetId});

  /// Content id is an internal catalogue id, not personal data.
  static void contentStarted(String contentType, String contentId) =>
      log('content_started', params: {'content_type': contentType, 'content_id': contentId});
  static void contentCompleted(String contentType, String contentId) =>
      log('content_completed', params: {'content_type': contentType, 'content_id': contentId});
  static void playbackError(String contentId) =>
      log('playback_error', params: {'content_id': contentId});

  /// Search is measured by outcome, never by the typed text.
  static void searchPerformed({required int resultCount}) =>
      log('search_performed', params: {'result_count': resultCount});
  static void voiceSearchUsed({required bool available}) =>
      log('voice_search_used', params: {'available': available});

  static void gameStarted(String gameId) => log('game_started', params: {'game_id': gameId});
  static void gameCompleted(String gameId) => log('game_completed', params: {'game_id': gameId});
  static void readerOpened(String bookId) => log('reader_opened', params: {'book_id': bookId});

  static void downloadSucceeded(String contentType) =>
      log('download_succeeded', params: {'content_type': contentType});
  static void downloadFailed(String contentType) =>
      log('download_failed', params: {'content_type': contentType});
}
