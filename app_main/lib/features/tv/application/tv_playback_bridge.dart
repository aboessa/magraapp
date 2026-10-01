import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// TV-002: what the player reports to the remote, and what the remote can ask
/// the player to do.
///
/// The player page registers itself here while it is on screen. The TV link
/// forwards commands to it and forwards its state to the phone. Neither side
/// knows about the other: the player has no idea a phone is watching, and the
/// link has no reference to a widget.
class TvPlaybackSnapshot {
  const TvPlaybackSnapshot({
    required this.status,
    this.episodeId,
    this.title,
    this.childId,
    this.positionMs = 0,
    this.durationMs = 0,
    this.reason,
  });

  /// `idle`, `loading`, `playing`, `paused`, `ended` or `error`.
  final String status;
  final String? episodeId;
  final String? title;
  final String? childId;
  final int positionMs;
  final int durationMs;

  /// Why playback could not start, e.g. `screen_time_daily_limit`.
  final String? reason;

  Map<String, Object?> toMessage() => {
    'type': 'state',
    'status': status,
    'episode_id': episodeId,
    'title': title,
    'child_id': childId,
    'position_ms': positionMs,
    'duration_ms': durationMs,
  };
}

/// Implemented by the player while it is showing.
abstract class TvPlaybackTarget {
  Future<void> pause();
  Future<void> resume();
  Future<void> stop();
  Future<void> seekTo(Duration position);
  Future<void> seekBy(Duration delta);
}

class TvPlaybackBridge {
  TvPlaybackTarget? _target;
  TvPlaybackSnapshot? _last;
  final _waiters = <_StartWaiter>[];

  /// Set by the TV link while it is connected.
  void Function(TvPlaybackSnapshot snapshot)? onState;

  /// Shown once by the next player that starts, e.g. «بيتفرج دلوقتي: ليلى».
  String? pendingBanner;

  TvPlaybackTarget? get target => _target;
  TvPlaybackSnapshot? get last => _last;

  void attach(TvPlaybackTarget target) => _target = target;

  void detach(TvPlaybackTarget target) {
    if (!identical(_target, target)) return;
    _target = null;
    report(const TvPlaybackSnapshot(status: 'idle'));
  }

  String? takeBanner() {
    final banner = pendingBanner;
    pendingBanner = null;
    return banner;
  }

  void report(TvPlaybackSnapshot snapshot) {
    _last = snapshot;
    onState?.call(snapshot);
    for (final waiter in List.of(_waiters)) {
      if (waiter.episodeId != snapshot.episodeId) continue;
      if (snapshot.status == 'playing' || snapshot.status == 'error') {
        _waiters.remove(waiter);
        waiter.timer.cancel();
        if (!waiter.completer.isCompleted) waiter.completer.complete(snapshot);
      }
    }
  }

  /// Completes when the player for [episodeId] is playing or has failed, or
  /// with `null` after [timeout].
  Future<TvPlaybackSnapshot?> waitForStart(String episodeId, Duration timeout) {
    final completer = Completer<TvPlaybackSnapshot?>();
    late final _StartWaiter waiter;
    final timer = Timer(timeout, () {
      _waiters.remove(waiter);
      if (!completer.isCompleted) completer.complete(null);
    });
    waiter = _StartWaiter(episodeId, completer, timer);
    _waiters.add(waiter);
    return completer.future;
  }
}

class _StartWaiter {
  _StartWaiter(this.episodeId, this.completer, this.timer);
  final String episodeId;
  final Completer<TvPlaybackSnapshot?> completer;
  final Timer timer;
}

final tvPlaybackBridgeProvider = Provider<TvPlaybackBridge>(
  (ref) => TvPlaybackBridge(),
);
