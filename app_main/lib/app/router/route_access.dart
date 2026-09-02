/// Route access classification for [GoRouter].
///
/// This is the single source of truth that replaces the three ad-hoc
/// `public` / `parentProtected` / `childRequired` sets that used to live
/// inline inside `_guardRedirect` (`app_router.dart:70-181`). A route missing
/// from [routeAccessTable] used to fall through to an under-protected
/// default silently; `route_guard_matrix_test.dart` now fails the build
/// instead when that happens.
///
/// This file only introduces the classification table and [accessFor]. It
/// deliberately does not touch `_guardRedirect` itself — that rewrite is a
/// separate follow-up so this table can be verified against today's actual
/// redirect behaviour before anything starts depending on it.
library;

/// The four access levels a route can require.
///
/// See Requirement 1.1 in
/// `.kiro/specs/app-foundation-family-journey/requirements.md`.
enum RouteAccess {
  /// No session required at all (sign-in/legal/static screens).
  public,

  /// Requires an authenticated family session, but neither an active child
  /// nor a fresh parent proof — e.g. the child switcher itself.
  authenticatedFamily,

  /// Requires an authenticated session with an active child selected.
  childSession,

  /// Requires an authenticated session with a fresh parent PIN proof
  /// (`AuthGuard.hasParentAccess == true`).
  parentVerified,
}

/// Path prefixes matched when the exact runtime `location` is not a key in
/// [routeAccessTable] — covers parameterised routes such as
/// `/playback/:episodeId`, whose runtime location carries a real id and can
/// never match the literal `:episodeId` placeholder key stored in the table.
///
/// This is exactly the set `_guardRedirect` checked inline:
/// `loc.startsWith('/playback') || loc.startsWith('/reader') ||
/// loc.startsWith('/game') || loc.startsWith('/series')`. No other prefix is
/// (or was) special-cased — notably `/studio/...` deep links are NOT covered
/// here, see the comment on those entries below.
const Map<String, RouteAccess> _prefixAccess = {
  '/playback': RouteAccess.childSession,
  '/reader': RouteAccess.childSession,
  '/game': RouteAccess.childSession,
  '/series': RouteAccess.childSession,
};

/// Every route defined in `_routes` (`app_router.dart`), mapped to the
/// access level `_guardRedirect` already gave it before this table existed.
///
/// Keys use the same literal path strings as the `GoRoute`s they describe,
/// including `:param` placeholders where the route takes one —
/// `route_guard_matrix_test.dart` extracts the route list by name and
/// compares it against this key set, so a new route added without an entry
/// here fails that test instead of silently becoming under-protected.
const Map<String, RouteAccess> routeAccessTable = {
  // --- public: former `public` set — reachable without any session ---
  '/login': RouteAccess.public,
  '/register': RouteAccess.public,
  '/verify-email': RouteAccess.public,
  '/forgot-password': RouteAccess.public,
  '/reset-password': RouteAccess.public,
  '/deletion-status': RouteAccess.public,
  '/help-signin': RouteAccess.public,
  '/terms': RouteAccess.public,
  '/privacy': RouteAccess.public,
  '/support': RouteAccess.public,

  // --- parentVerified: former `parentProtected` set ---
  '/parent': RouteAccess.parentVerified,
  '/account': RouteAccess.parentVerified,
  '/devices': RouteAccess.parentVerified,
  // `_guardRedirect` carves out a read-only demo exception for
  // `/membership` specifically (guests may preview plans). That exception
  // is a special case layered on top of this base category, not a
  // different category — it belongs in `_guardRedirect`/its rewrite, not
  // here.
  '/membership': RouteAccess.parentVerified,
  '/settings': RouteAccess.parentVerified,

  // --- childSession: former `childRequired` set ---
  '/': RouteAccess.childSession,
  '/planets': RouteAccess.childSession,
  '/watchlist': RouteAccess.childSession,
  '/my-collection': RouteAccess.childSession,
  '/studio': RouteAccess.childSession,
  '/downloads': RouteAccess.childSession,
  '/audio': RouteAccess.childSession,
  '/watch': RouteAccess.childSession,
  '/play': RouteAccess.childSession,
  '/read': RouteAccess.childSession,
  '/listen': RouteAccess.childSession,
  '/explore': RouteAccess.childSession,
  // Parameterised — matched at runtime through the prefix rules in
  // [_prefixAccess], since the real location carries an id, not the
  // `:param` placeholder used as the key here.
  '/playback/:episodeId': RouteAccess.childSession,
  '/reader/:seriesId': RouteAccess.childSession,
  '/game/:gameId': RouteAccess.childSession,
  '/series/:seriesId': RouteAccess.childSession,

  // --- authenticatedFamily: everything else — requires a session but is in
  // none of the three lists above and matches no prefix rule, exactly as
  // today ---
  '/search': RouteAccess.authenticatedFamily,
  '/shorts': RouteAccess.authenticatedFamily,
  '/children': RouteAccess.authenticatedFamily,
  '/onboarding': RouteAccess.authenticatedFamily,
  '/parent-pin': RouteAccess.authenticatedFamily,
  '/tv-pairing': RouteAccess.authenticatedFamily,
  // These three deep links start with `/studio`, which is NOT one of the
  // four prefixes `_guardRedirect` special-cases (`/playback`, `/reader`,
  // `/game`, `/series`). Today they therefore fall through to the same
  // "just needs a session" default bucket instead of inheriting `/studio`'s
  // own `childSession` requirement. Reproduced as-is: this task only
  // extracts the existing classification, it does not change any route's
  // resulting behaviour.
  '/studio/coloring/:id': RouteAccess.authenticatedFamily,
  '/studio/reference/:id': RouteAccess.authenticatedFamily,
  '/studio/trace/:id': RouteAccess.authenticatedFamily,
};

/// Resolves the [RouteAccess] category for a runtime `location` (a
/// `GoRouterState.matchedLocation` — already resolved to real path
/// segments, never the `:param` placeholder form).
///
/// Matching order, preserved from the inline checks previously in
/// `_guardRedirect`:
/// 1. Exact match against [routeAccessTable] — covers every path with no
///    parameters, whose runtime location equals its route definition.
/// 2. Prefix match against `/playback`, `/reader`, `/game`, `/series` — the
///    only prefixes `_guardRedirect` ever checked — covers parameterised
///    routes whose runtime location carries a real id.
/// 3. [RouteAccess.authenticatedFamily] — the same "requires a session, no
///    further gate" default any route outside the old three lists received.
RouteAccess accessFor(String location) {
  final exact = routeAccessTable[location];
  if (exact != null) return exact;

  for (final entry in _prefixAccess.entries) {
    if (location.startsWith(entry.key)) return entry.value;
  }

  return RouteAccess.authenticatedFamily;
}
