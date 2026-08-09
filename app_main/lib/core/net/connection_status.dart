import '../failures/app_failure.dart';
import '../../features/home/domain/content_models.dart';

/// A coherent, product-level connectivity state (§27).
///
/// The point of this enum is to stop the app from collapsing every failure into
/// "no internet". A 500 from a reachable server, an expired session, and a
/// genuine loss of connectivity are three different situations that call for
/// three different messages and three different recovery actions.
enum ConnectionStatus {
  /// Live server data was used.
  online,

  /// The network failed but cached/local catalogue content is being shown.
  offlineWithCache,

  /// Fully offline and playing a previously downloaded asset.
  offlineWithDownload,

  /// The server was reachable but returned an error (5xx / malformed).
  serverError,

  /// The session is invalid or expired; the user must sign in again.
  authError,
}

extension ConnectionStatusX on ConnectionStatus {
  bool get isUsable =>
      this == ConnectionStatus.online ||
      this == ConnectionStatus.offlineWithCache ||
      this == ConnectionStatus.offlineWithDownload;

  bool get isOffline =>
      this == ConnectionStatus.offlineWithCache ||
      this == ConnectionStatus.offlineWithDownload;
}

/// Derives a [ConnectionStatus] from the catalogue source the repository
/// reported.
///
/// [ContentSource.remote] means at least the primary collections came live;
/// [ContentSource.local] means nothing did and the on-device fallback is in
/// use, which is only reached after the network failed; [ContentSource.mixed]
/// is treated as online because live data is present and a stale shelf is a
/// lesser concern than a misleading "offline" banner.
ConnectionStatus connectionStatusFromSource(ContentSource source) {
  switch (source) {
    case ContentSource.remote:
    case ContentSource.mixed:
      return ConnectionStatus.online;
    case ContentSource.local:
      return ConnectionStatus.offlineWithCache;
  }
}

/// Maps a caught error into the connectivity state it implies.
///
/// Reuses the existing [AppFailure] taxonomy so there is a single source of
/// truth for what an error means, rather than re-parsing exception strings here.
ConnectionStatus connectionStatusFromError(Object error) {
  final failure = AppFailure.fromException(error);
  switch (failure.kind) {
    case FailureKind.network:
    case FailureKind.timeout:
      return ConnectionStatus.offlineWithCache;
    case FailureKind.unauthorized:
      return ConnectionStatus.authError;
    case FailureKind.server:
      return ConnectionStatus.serverError;
    case FailureKind.forbidden:
    case FailureKind.notFound:
    case FailureKind.conflict:
    case FailureKind.rateLimited:
    case FailureKind.unknown:
      return ConnectionStatus.serverError;
  }
}
