import 'package:flutter/foundation.dart';

/// Analytics آمن - لا PII، معرفات داخلية مجهولة فقط
/// MAJARRA_CINEMATIC_STREAMING_UX_PLAN.md:594
class MajarraAnalytics {
  static const _allowedEvents = {
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
  };

  static void log(String event, {Map<String, dynamic>? params}) {
    if (!_allowedEvents.contains(event)) {
      if (kDebugMode) print('[analytics] blocked disallowed event: $event');
      return;
    }
    // لا ترسل nickname/mيلاد/نص بحث خام/معرف إعلاني
    final safeParams = <String, dynamic>{};
    params?.forEach((k, v) {
      if (k.contains('nickname') || k.contains('email') || k.contains('birth')) return;
      safeParams[k] = v;
    });
    if (kDebugMode) {
      print('[analytics] $event ${safeParams.isEmpty ? '' : safeParams}');
    }
    // TODO: Queue -> Analytics Engine / R2
  }

  static void heroImpression(String spotlightId) => log('hero_impression', params: {'spotlight_id': spotlightId});
  static void heroAction(String spotlightId) => log('hero_primary_action', params: {'spotlight_id': spotlightId});
  static void portalOpened() => log('portal_opened');
  static void portalRotated(int index) => log('portal_ring_rotated', params: {'index': index});
  static void planetSelected(String planetId) => log('portal_planet_selected', params: {'planet_id': planetId});
}
