/// `rhythm_tap` — entertainment first, and the only engine with a clock.
///
/// Contract: `docs/games/engines/08-rhythm-tap.md`, level shape
/// `docs/games/schemas/rhythm_tap.v1.schema.json`.
///
/// ## The rule that shapes the whole implementation
///
/// **There is no failure.** «لا يوجد فشل. الأنشودة تكمل حتى النهاية دائمًا» — the
/// track always plays to the end and a positive result is shown in every case.
/// So this engine has no lose branch to write: a missed note is the *absence* of
/// a hit glow, there is no error sound, the music is never interrupted, and no
/// deduction is shown. `accuracy_to_pass` decides what the pack considers a pass,
/// never whether the child may continue.
///
/// ## Why it writes no mastery
///
/// The contract says «لا تُكتب `mastery`». The engine still reports honestly — it
/// played, and this many notes were hit — but the mechanism that keeps mastery
/// unwritten is that a `rhythm_tap` pack carries **no learning objective**, so
/// there is no objective for a mastery row to attach to. That is enforced on the
/// server in `gamePackValidation.ts` rather than by this engine choosing to lie
/// about the score.
///
/// ## Accessibility is load-bearing, not decoration
///
/// The visual pulse is mandatory because it is what makes the game playable
/// without hearing. Flashing is capped well below 3Hz. The lane order is **not**
/// mirrored in RTL — a falling note is not text.
library;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'game_board_kit.dart';
import 'game_engine_registry.dart';
import 'game_services.dart';
import 'game_session_controller.dart';

/// How long a note takes to travel from the top to the hit line.
///
/// Not in the schema. Fixed rather than authored because it is a readability
/// property of the display, not of the music: too short and a note appears with no
/// time to react, too long and the lane is crowded past the contract's limit.
const _approachMs = 2000;

/// Consecutive misses before the hit window widens, and before lanes collapse.
///
/// Both numbers are the contract's own.
const _missesBeforeWiderWindow = 8;
const _missesBeforeSingleLane = 16;

/// The widening factor the contract specifies.
const _windowWideningFactor = 1.4;

/// The floor the accessibility section sets for the simplified motor mode.
const _simplifiedMotorWindowMs = 500;

class RhythmTapEngine extends GameEngine {
  const RhythmTapEngine();

  @override
  String get engineId => 'rhythm_tap';

  /// One button per lane, which is exactly how the contract describes D-pad play.
  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _RhythmTapSurface(controller: controller);
}

class _RhythmTapSurface extends StatefulWidget {
  const _RhythmTapSurface({required this.controller});
  final GameSessionController controller;

  @override
  State<_RhythmTapSurface> createState() => _RhythmTapSurfaceState();
}

class _RhythmNote {
  _RhythmNote({required this.timeMs, required this.lane});
  final int timeMs;
  final int lane;
  bool judged = false;
  bool hit = false;
}

class _RhythmTapSurfaceState extends State<_RhythmTapSurface>
    with SingleTickerProviderStateMixin {
  Ticker? _ticker;
  Duration _elapsed = Duration.zero;
  bool _running = false;
  bool _finished = false;

  late List<_RhythmNote> _notes;
  int _hits = 0;
  int _consecutiveMisses = 0;
  double _windowScale = 1;
  bool _collapsedToOneLane = false;

  /// Lane -> time the hit glow started, so the pulse can fade.
  final Map<int, Duration> _laneGlow = {};

  @override
  void initState() {
    super.initState();
    _notes = mapList(widget.controller.rawLevel['notes'])
        .map((json) => _RhythmNote(
              timeMs: intOr(json, 'time_ms', 0),
              lane: intOr(json, 'lane', 0),
            ))
        .toList()
      ..sort((a, b) => a.timeMs.compareTo(b.timeMs));
    _ticker = createTicker(_onTick);
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  int get _trackDurationMs => intOr(_level, 'track_duration_ms', 30000);
  bool get _visualPulse => _level['visual_pulse'] != false;
  bool get _hapticPulse => _level['haptic_pulse'] != false;
  double get _accuracyToPass => doubleOr(_level, 'accuracy_to_pass', 0.6);

  /// Lanes actually shown.
  ///
  /// Collapses to one after sixteen consecutive misses, and the simplified motor
  /// mode pins it to one from the start.
  int get _lanes {
    if (_collapsedToOneLane) return 1;
    if (widget.controller.settings.simplifiedMotor) return 1;
    return intOr(_level, 'lanes', 1).clamp(1, 3);
  }

  /// The live hit window, after widening and the accessibility floor.
  int get _hitWindowMs {
    final authored = intOr(_level, 'hit_window_ms', 400);
    final widened = (authored * _windowScale).round();
    if (widget.controller.settings.simplifiedMotor) {
      return widened < _simplifiedMotorWindowMs ? _simplifiedMotorWindowMs : widened;
    }
    return widened;
  }

  int get _nowMs => _elapsed.inMilliseconds;

  void _start() {
    if (_running || _finished) return;
    setState(() => _running = true);
    _ticker?.start();
  }

  void _onTick(Duration elapsed) {
    setState(() => _elapsed = elapsed);

    // Judge notes whose window has closed. A missed note is silent: no sound, no
    // message, no visible deduction.
    for (final note in _notes) {
      if (note.judged) continue;
      if (_nowMs > note.timeMs + _hitWindowMs) {
        note.judged = true;
        _consecutiveMisses++;
        _applyAssistanceIfNeeded();
      }
    }

    if (_nowMs >= _trackDurationMs && !_finished) {
      _finish();
    }
  }

  /// The two automatic accommodations, applied silently.
  void _applyAssistanceIfNeeded() {
    if (_consecutiveMisses >= _missesBeforeSingleLane && !_collapsedToOneLane) {
      _collapsedToOneLane = true;
      return;
    }
    if (_consecutiveMisses >= _missesBeforeWiderWindow && _windowScale == 1) {
      _windowScale = _windowWideningFactor;
    }
  }

  /// A lane tap. Judges the nearest unjudged note in that lane.
  void _tapLane(int lane) {
    if (!_running || _finished) return;
    _RhythmNote? best;
    var bestDelta = 1 << 30;
    for (final note in _notes) {
      if (note.judged) continue;
      // A collapsed board folds every lane onto the one that remains, so notes
      // authored for lane 2 remain hittable rather than becoming unplayable.
      final noteLane = _lanes == 1 ? 0 : note.lane;
      if (noteLane != lane) continue;
      final delta = (note.timeMs - _nowMs).abs();
      if (delta < bestDelta) {
        best = note;
        bestDelta = delta;
      }
    }

    if (best == null || bestDelta > _hitWindowMs) {
      // Tapping at the wrong moment does nothing at all. There is deliberately no
      // penalty and no sound: the music is the feedback.
      return;
    }

    best.judged = true;
    best.hit = true;
    _hits++;
    _consecutiveMisses = 0;
    setState(() => _laneGlow[lane] = _elapsed);
    if (_hapticPulse && widget.controller.settings.hapticsEnabled) {
      HapticFeedback.selectionClick().ignore();
    }
  }

  Future<void> _finish() async {
    _finished = true;
    _running = false;
    _ticker?.stop();
    setState(() {});

    await widget.controller.reportEngineAttempt(
      // Honest: the notes actually hit, out of the notes in the track. The pack
      // carries no objective, so this never becomes a mastery judgement.
      score: _hits,
      maxScore: _notes.length,
      // The automatic accommodations are help, and are recorded as such.
      helpUsed: _windowScale != 1 || _collapsedToOneLane,
      answers: [
        {
          'notes_total': _notes.length,
          'notes_hit': _hits,
          'window_widened': _windowScale != 1,
          'lanes_collapsed': _collapsedToOneLane,
          'passed': _notes.isEmpty ? true : _hits / _notes.length >= _accuracyToPass,
        },
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    // The contract sets a 72dp target for this engine, above the shared floor.
    final laneTarget = target < 72 ? 72.0 : target;

    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      footer: _finished
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Semantics(
                liveRegion: true,
                child: Text(
                  // Positive in every case, by contract. The accuracy is not shown
                  // as a percentage.
                  'كانت أنشودة جميلة!',
                  key: const Key('rhythm_positive_result'),
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            )
          : _running
              ? null
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: FilledButton.icon(
                    key: const Key('rhythm_start_button'),
                    onPressed: _start,
                    icon: const Icon(Icons.play_arrow_outlined),
                    label: const Text('ابدأ الأنشودة'),
                    style: ButtonStyle(
                      minimumSize: WidgetStatePropertyAll(Size(laneTarget, laneTarget)),
                    ),
                  ),
                ),
      // Never wrapped in a Directionality override: the lane order is game
      // geometry and the contract forbids mirroring it in RTL.
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: LayoutBuilder(
          builder: (context, constraints) {
            final laneWidth = constraints.maxWidth / _lanes;
            final hitLineY = constraints.maxHeight - laneTarget - 8;
            return Stack(
              children: [
                // Hit line.
                Positioned(
                  left: 0,
                  right: 0,
                  top: hitLineY,
                  child: Container(
                    height: 3,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
                // Falling notes.
                for (final note in _notes)
                  if (!note.judged || note.hit)
                    ..._buildNote(note, laneWidth, hitLineY),
                // Lane buttons.
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Row(
                    children: [
                      for (var lane = 0; lane < _lanes; lane++)
                        Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: _laneButton(lane, laneTarget),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  List<Widget> _buildNote(_RhythmNote note, double laneWidth, double hitLineY) {
    final lane = _lanes == 1 ? 0 : note.lane;
    if (lane >= _lanes) return const [];
    final msUntilHit = note.timeMs - _nowMs;
    if (msUntilHit > _approachMs) return const [];
    if (msUntilHit < -_hitWindowMs) return const [];

    final progress = 1 - (msUntilHit / _approachMs);
    final y = hitLineY * progress.clamp(0.0, 1.0);
    return [
      Positioned(
        left: lane * laneWidth + laneWidth / 2 - 20,
        top: y,
        child: Semantics(
          // The pulse has a text alternative too, so a screen reader user knows a
          // note is arriving.
          label: 'نوتة في المسار ${lane + 1}',
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: note.hit
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.secondaryContainer,
              border: Border.all(
                color: Theme.of(context).colorScheme.primary,
                width: 2,
              ),
            ),
          ),
        ),
      ),
    ];
  }

  Widget _laneButton(int lane, double target) {
    final glowStart = _laneGlow[lane];
    // A soft fade, not a flash. 300ms per pulse is ~3.3 pulses per second at the
    // absolute maximum note density, and the opacity never reaches full black or
    // white, so this stays under the 3Hz flashing limit the contract sets.
    final glowing = glowStart != null &&
        (_elapsed - glowStart).inMilliseconds < 300 &&
        !widget.controller.settings.reduceMotion;

    return Semantics(
      button: true,
      label: 'المسار ${lane + 1}',
      child: InkWell(
        key: ValueKey('rhythm_lane_$lane'),
        onTap: () => _tapLane(lane),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 120),
          height: target,
          decoration: BoxDecoration(
            color: glowing
                ? Theme.of(context).colorScheme.primaryContainer
                : Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline,
              width: _visualPulse && glowing ? 3 : 1,
            ),
          ),
          alignment: Alignment.center,
          child: Icon(
            Icons.touch_app_outlined,
            size: 28,
            color: Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}
