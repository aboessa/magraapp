import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../home/domain/content_models.dart';

/// Reading modes offered by the reader.
///
/// `readAlong` (sentence highlighting) is phase 2 and deliberately absent:
/// `timing_cues` is `NULL` for every published page today, so there is no
/// reliable timing to hang an automatic turn on. See
/// `docs/content/planets/05-qisas/00-story-page-model.md` §4.
enum ReadingMode {
  /// Child turns pages. Never auto-turns, even when `dwellMs` is authored.
  readMyself,

  /// Narration plays, then the authored dwell elapses, then the page turns.
  readToMe;

  /// Only `Read to Me` has a narration completion event to anchor timing on.
  bool get supportsAutoTurn => this == ReadingMode.readToMe;
}

/// Post-narration auto-turn timing for the story reader.
///
/// The contract is:
///
///   real audio completion event → `dwellMs` → page transition
///
/// `durationMs` is never used as a countdown: a page turns when the player
/// reports completion, not when an estimated duration elapses. `dwellMs` is
/// authored illustration viewing time and is not silence inside the audio file.
///
/// Transition animation duration is UI configuration and lives in the widget,
/// not here and not in story page data.
class ReaderAutoTurn {
  ReaderAutoTurn({required this.onAdvance});

  /// Invoked when the dwell has fully elapsed and the reader should turn.
  final VoidCallback onAdvance;

  /// Fallback for legacy pages with no authored `dwellMs`.
  ///
  /// Zero preserves the behaviour those stories already had (turn as soon as
  /// narration ends). A legacy story is never silently given a long pause.
  static const int legacyDwellFallbackMs = 0;

  Timer? _timer;
  int _token = 0;
  int? _pendingDwellMs;
  bool _disposed = false;

  /// True while a dwell is counting down towards a page turn.
  bool get isPending => _timer != null;

  /// The dwell currently being awaited, for diagnostics and tests.
  int? get pendingDwellMs => _pendingDwellMs;

  /// Authored dwell for [page], or the documented legacy fallback.
  static int dwellForPage(StoryPage page) {
    final authored = page.dwellMs;
    if (authored != null && authored >= 0) return authored;
    return legacyDwellFallbackMs;
  }

  /// Starts the dwell for [page]. Call this **only** from a real narration
  /// completion event.
  ///
  /// Returns true when a turn was scheduled or performed.
  bool onNarrationComplete({
    required StoryPage page,
    required ReadingMode mode,
    required bool autoAdvanceEnabled,
    required bool isLastPage,
  }) {
    cancel();
    if (_disposed) return false;
    // Self Read never auto-turns, whatever the authored dwell says.
    if (!mode.supportsAutoTurn) return false;
    if (!autoAdvanceEnabled) return false;
    // The last page has nowhere to turn to; its authored dwell is viewing time.
    if (isLastPage) return false;

    final dwellMs = dwellForPage(page);
    if (dwellMs <= 0) {
      onAdvance();
      return true;
    }

    final token = ++_token;
    _pendingDwellMs = dwellMs;
    _timer = Timer(Duration(milliseconds: dwellMs), () {
      if (_disposed || token != _token) return;
      _timer = null;
      _pendingDwellMs = null;
      onAdvance();
    });
    return true;
  }

  /// Cancels any pending turn.
  ///
  /// Every manual action must call this: swipe, tap, next/previous button,
  /// jump to page, close reader, mode change, language change, replay, pause
  /// and app backgrounding. A stale timer must never advance a new page.
  void cancel() {
    _timer?.cancel();
    _timer = null;
    _pendingDwellMs = null;
    _token += 1;
  }

  void dispose() {
    cancel();
    _disposed = true;
  }
}

/// Derived page/story experience estimates.
///
/// Nothing here is stored: `durationMs` and `dwellMs` are the only persisted
/// timing fields, and the estimate is recomputed wherever it is displayed.
abstract final class StoryExperience {
  /// Reader page transition animation duration — UI configuration.
  static const Duration pageTransition = Duration(milliseconds: 280);

  /// Narration + dwell for a single page (excludes the transition).
  static int pageMs(StoryPage page) =>
      (page.durationMs ?? 0) + ReaderAutoTurn.dwellForPage(page);

  /// Estimated whole-story experience.
  ///
  /// Only pages before the last one contribute a dwell and a transition,
  /// because the reader does not auto-advance off the final page.
  static int storyMs(List<StoryPage> pages) {
    if (pages.isEmpty) return 0;
    var total = 0;
    for (var index = 0; index < pages.length; index += 1) {
      total += pages[index].durationMs ?? 0;
      if (index < pages.length - 1) {
        total += ReaderAutoTurn.dwellForPage(pages[index]);
        total += pageTransition.inMilliseconds;
      }
    }
    return total;
  }
}
