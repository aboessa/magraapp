import '../../child/domain/child_profile.dart';
import 'tv_playback_bridge.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

typedef TvAck = ({bool ok, String? reason});

/// TV-002: what the television does with a command from a phone.
///
/// Kept free of widgets and providers so every branch is testable. The host
/// supplies how to read the family's children, how to make one the active
/// child, and how to open the player.
///
/// ## Switching child automatically
///
/// A `play` command names the child it is for, and the TV switches to that
/// child without asking. The phone already chose the child (its active
/// profile), the person holding the remote may be three metres away, and every
/// rule for that child — age, screen time, bedtime — is applied by the server
/// when the TV opens its own playback session. The switch is announced on the
/// TV («بيتفرج دلوقتي: ليلى») so nobody is surprised whose profile is running.
class TvCommandHandler {
  TvCommandHandler({
    required this.loadChildren,
    required this.selectChild,
    required this.openEpisode,
    required this.bridge,
    this.startTimeout = const Duration(seconds: 9),
  });

  final Future<List<ChildProfile>> Function() loadChildren;
  final void Function(ChildProfile child) selectChild;
  final void Function(String episodeId, int positionMs) openEpisode;
  final TvPlaybackBridge bridge;

  /// Just under the server's 10 s wait, so the TV's answer arrives first.
  final Duration startTimeout;

  Future<TvAck> handle(Map<String, Object?> message) async {
    final command = message['command'];
    switch (command) {
      case 'play':
        return _play(message);
      case 'pause':
        return _onTarget((t) => t.pause());
      case 'resume':
        return _onTarget((t) => t.resume());
      case 'stop':
        return _onTarget((t) => t.stop());
      case 'seek':
        final position = message['position_ms'];
        final delta = message['delta_ms'];
        if (position is int) {
          return _onTarget((t) => t.seekTo(Duration(milliseconds: position)));
        }
        if (delta is int) {
          return _onTarget((t) => t.seekBy(Duration(milliseconds: delta)));
        }
        return (ok: false, reason: 'invalid_command');
      default:
        return (ok: false, reason: 'unknown_command');
    }
  }

  Future<TvAck> _onTarget(
    Future<void> Function(TvPlaybackTarget target) action,
  ) async {
    final target = bridge.target;
    if (target == null) return (ok: false, reason: 'not_playing');
    try {
      await action(target);
      return (ok: true, reason: null);
    } catch (_) {
      return (ok: false, reason: 'player_error');
    }
  }

  Future<TvAck> _play(Map<String, Object?> message) async {
    final episodeId = message['episode_id'];
    final childId = message['child_id'];
    if (episodeId is! String ||
        episodeId.isEmpty ||
        childId is! String ||
        childId.isEmpty) {
      return (ok: false, reason: 'invalid_command');
    }
    List<ChildProfile> children;
    try {
      children = await loadChildren();
    } catch (_) {
      return (ok: false, reason: 'children_unavailable');
    }
    ChildProfile? child;
    for (final candidate in children) {
      if (candidate.id == childId) child = candidate;
    }
    if (child == null) return (ok: false, reason: 'child_not_found');

    final position = message['position_ms'];
    final from = message['from'];
    bridge.pendingBanner = from is String && from.isNotEmpty
        ? AppLocalizationsAr().tvtvcommandhandlerText01(child.displayName, from)
        : AppLocalizationsAr().tvtvcommandhandlerText02(child.displayName);

    final started = bridge.waitForStart(episodeId, startTimeout);
    selectChild(child);
    openEpisode(episodeId, position is int && position > 0 ? position : 0);

    final result = await started;
    if (result == null) return (ok: false, reason: 'start_timeout');
    if (result.status == 'error') {
      return (ok: false, reason: result.reason ?? 'playback_error');
    }
    return (ok: true, reason: null);
  }
}
