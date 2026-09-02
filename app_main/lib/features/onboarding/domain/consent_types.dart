/// The five parental consent types the server tracks in
/// `parental_consents` (`CONSENT_TYPES` in
/// `dashboard/api/src/lib/consent.ts`), together with the display order and
/// localized labels a parent sees on `ConsentPage`.
///
/// This is a small, deliberately non-generic list — five known strings, not
/// an extensible taxonomy — because inventing a plugin-style registry for
/// five fixed values the server itself hardcodes would be speculative. The
/// canonical set of *type strings* lives on the server; this file only
/// mirrors them for the client to iterate over and label, plus the one
/// pre-existing type constant (`child_creations`) is intentionally reused
/// from `creation_cloud_service.dart` rather than duplicated (see
/// [kConsentTypeChildCreations] below).
library;

import '../../games/application/creation_cloud_service.dart' show kCreationsConsentType;

/// Re-exported under this file's naming so `ConsentPage` and any future
/// consumer can import one list without also depending on
/// `creation_cloud_service.dart` for the other four types.
const String kConsentTypeChildCreations = kCreationsConsentType;

const String kConsentTypeDataCollection = 'data_collection';
const String kConsentTypeAnalytics = 'analytics';
const String kConsentTypeVoice = 'voice';
const String kConsentTypePersonalization = 'personalization';

/// Display order on `ConsentPage`. Matches `CONSENT_TYPES` in
/// `dashboard/api/src/lib/consent.ts` exactly, so the order a parent reads
/// top-to-bottom matches the order the server documents them in.
const List<String> kConsentTypesOrdered = <String>[
  kConsentTypeDataCollection,
  kConsentTypeAnalytics,
  kConsentTypeVoice,
  kConsentTypePersonalization,
  kConsentTypeChildCreations,
];
