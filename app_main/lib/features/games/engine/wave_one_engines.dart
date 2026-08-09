/// The Wave 1 engines: `memory_flip`, `match_pairs`, `sort_bins`,
/// `sequence_order`.
///
/// Each is pack-driven and registry-driven, shares the feedback, audio, help and
/// attempt services, and parses the level shape its own canonical schema defines
/// (`docs/games/schemas/*.v1.schema.json`). No mechanic here is invented: the
/// match types, bin criteria, panel orders and pair types all come from those
/// schemas and the engine contracts beside them.
///
/// ## Why they live in one file
///
/// They share a single interaction primitive — tap to select, tap to place — and
/// a single failure policy: an incorrect placement returns the piece and says
/// nothing negative. Splitting that into four files would have duplicated it four
/// times, which is exactly the divergence the shared-services layer exists to
/// prevent.
///
/// ## `memory_flip` was hard-coded
///
/// It used to be a page with `_pairsPerLevel = [3,4,6,8]` and emoji placeholders,
/// no pack and no attempt reporting. Its user-visible behaviour is preserved —
/// shuffled board, three tile states, a delay before flipping back, no failure
/// state, no timer — but the board now comes from `pairs` and `grid` in the pack,
/// and it reports that it was played.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import 'game_board_kit.dart';
import 'game_engine_registry.dart';
import 'game_services.dart';
import 'game_session_controller.dart';

// The level-JSON readers, the seeded shuffle and the board chrome now live in
// `game_board_kit.dart`, shared with Wave 2.

// ---------------------------------------------------------------- memory_flip

class MemoryFlipEngine extends GameEngine {
  const MemoryFlipEngine();

  @override
  String get engineId => 'memory_flip';

  /// A grid of tiles is navigable with a D-pad, so this one is offered on TV.
  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) {
    return _MemoryFlipBoard(controller: controller);
  }
}

class _MemoryFlipBoard extends StatefulWidget {
  const _MemoryFlipBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_MemoryFlipBoard> createState() => _MemoryFlipBoardState();
}

class _MemoryFlipBoardState extends State<_MemoryFlipBoard> {
  late List<_MemoryTile> _deck;
  final Set<int> _matched = {};
  final List<int> _revealed = [];
  bool _locked = false;
  int _misses = 0;
  Timer? _flipBack;

  @override
  void initState() {
    super.initState();
    _build();
  }

  @override
  void dispose() {
    _flipBack?.cancel();
    super.dispose();
  }

  Map<String, dynamic> get _level => widget.controller.rawLevel;

  int get _columns {
    final grid = _level['grid'];
    if (grid is List && grid.length == 2 && grid[1] is num) {
      return (grid[1] as num).toInt().clamp(2, 4);
    }
    return 2;
  }

  int get _flipBackDelayMs {
    final value = _level['flip_back_delay_ms'];
    // The floor is the contract's own: a preschool child needs time to memorise
    // the tile before it turns back.
    return value is num ? value.toInt().clamp(800, 2000) : 1400;
  }

  void _build() {
    final pairs = mapList(_level['pairs']);
    final tiles = <_MemoryTile>[];
    for (var index = 0; index < pairs.length; index++) {
      final pair = pairs[index];
      tiles.add(_MemoryTile(pairIndex: index, assetId: str(pair, 'a')));
      tiles.add(_MemoryTile(pairIndex: index, assetId: str(pair, 'b')));
    }
    _deck = seededShuffle(tiles, widget.controller.gameId.hashCode + widget.controller.levelIndex);
    _matched.clear();
    _revealed.clear();
    _misses = 0;
  }

  Future<void> _tap(int index) async {
    if (_locked || _matched.contains(index) || _revealed.contains(index)) return;

    setState(() => _revealed.add(index));
    if (_revealed.length < 2) return;

    final first = _revealed[0];
    final second = _revealed[1];
    if (_deck[first].pairIndex == _deck[second].pairIndex) {
      setState(() {
        _matched.addAll([first, second]);
        _revealed.clear();
      });
      widget.controller.feedback.emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);
      if (_matched.length == _deck.length) await _finish();
      return;
    }

    // Hold both visible so the child can memorise them, then turn them back.
    // Not a failure: entertainment-first, and the contract gives it no score.
    _misses++;
    setState(() => _locked = true);
    _flipBack?.cancel();
    _flipBack = Timer(Duration(milliseconds: _flipBackDelayMs), () {
      if (!mounted) return;
      setState(() {
        _revealed.clear();
        _locked = false;
      });
    });
  }

  Future<void> _finish() async {
    // `memory_flip` is entertainment-first: the mastery document lists it as
    // writing attempts but no mastery, so it reports 0 of 0 — it happened, and it
    // is not a mark.
    await widget.controller.reportEngineAttempt(
      score: 0,
      maxScore: 0,
      answers: [{'pairs': _deck.length ~/ 2, 'misses': _misses}],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      child: GridView.builder(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: _columns,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
        ),
        itemCount: _deck.length,
        itemBuilder: (context, index) {
          final isUp = _matched.contains(index) || _revealed.contains(index);
          return Semantics(
            button: true,
            label: isUp ? 'بطاقة مكشوفة' : 'بطاقة مقلوبة',
            child: InkWell(
              // Position-stable key: the tile stays addressable as it flips, which
              // a reveal-state finder cannot do.
              key: ValueKey('memory_tile_$index'),
              onTap: () => _tap(index),
              child: Container(
                constraints: BoxConstraints(minWidth: target, minHeight: target),
                decoration: BoxDecoration(
                  color: _matched.contains(index)
                      ? Theme.of(context).colorScheme.primaryContainer
                      : isUp
                          ? Theme.of(context).colorScheme.surfaceContainerHighest
                          : Theme.of(context).colorScheme.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                alignment: Alignment.center,
                child: isUp
                    // Artwork is referenced by asset id; until packs ship art the
                    // id itself is shown rather than a fabricated picture.
                    ? Text(
                        _deck[index].assetId,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall,
                      )
                    : const Icon(Icons.question_mark, size: 28),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _MemoryTile {
  const _MemoryTile({required this.pairIndex, required this.assetId});
  final int pairIndex;
  final String assetId;
}

// --------------------------------------------------------------- match_pairs

class MatchPairsEngine extends GameEngine {
  const MatchPairsEngine();

  @override
  String get engineId => 'match_pairs';

  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) {
    return _MatchPairsBoard(controller: controller);
  }
}

class _MatchPairsBoard extends StatefulWidget {
  const _MatchPairsBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_MatchPairsBoard> createState() => _MatchPairsBoardState();
}

class _MatchPairsBoardState extends State<_MatchPairsBoard> {
  String? _selectedItem;

  /// item id -> target id, for the items placed so far.
  final Map<String, String> _placed = {};

  /// Items placed correctly on the first try, which is what `score` counts.
  final Set<String> _firstTry = {};
  final Set<String> _retried = {};

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  List<Map<String, dynamic>> get _targets => mapList(_level['targets']);
  List<Map<String, dynamic>> get _items => mapList(_level['items']);
  List<Map<String, dynamic>> get _distractors => mapList(_level['distractors']);

  /// Items plus distractors. A distractor belongs to no target, so tapping it on
  /// one is simply returned.
  List<Map<String, dynamic>> get _tray {
    final all = [..._items, ..._distractors];
    if (_level['shuffle'] == false) return all;
    return seededShuffle(all, widget.controller.gameId.hashCode + widget.controller.levelIndex);
  }

  Future<void> _placeOn(String targetId) async {
    final itemId = _selectedItem;
    if (itemId == null) return;
    final item = _items.firstWhere(
      (entry) => str(entry, 'id') == itemId,
      orElse: () => const {},
    );
    final belongsTo = str(item, 'target');

    if (belongsTo != targetId) {
      // Wrong placement returns the piece and says nothing negative. The contract
      // forbids a failure state; this only records that a retry happened, which is
      // what keeps `score` "correct on the first attempt".
      setState(() {
        _retried.add(itemId);
        _selectedItem = null;
      });
      return;
    }

    setState(() {
      _placed[itemId] = targetId;
      if (!_retried.contains(itemId)) _firstTry.add(itemId);
      _selectedItem = null;
    });
    widget.controller.feedback.emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);

    if (_placed.length == _items.length) await _finish();
  }

  Future<void> _finish() async {
    await widget.controller.reportEngineAttempt(
      score: _firstTry.length,
      maxScore: _items.length,
      answers: _items.map((item) {
        final id = str(item, 'id');
        return <String, Object?>{
          'item': id,
          'correct': _placed.containsKey(id),
          'attempts': _retried.contains(id) ? 2 : 1,
        };
      }).toList(growable: false),
      helpUsed: _retried.isNotEmpty,
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      child: Column(
        children: [
          Expanded(
            child: Row(
              children: [
                for (final entry in _targets)
                  Expanded(
                    child: _DropTarget(
                      label: str(entry, 'id'),
                      minSize: target,
                      accepting: _selectedItem != null,
                      placed: _placed.entries
                          .where((placed) => placed.value == str(entry, 'id'))
                          .map((placed) => placed.key)
                          .toList(growable: false),
                      onTap: () => _placeOn(str(entry, 'id')),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final item in _tray)
                if (!_placed.containsKey(str(item, 'id')))
                  _TrayChip(
                    id: str(item, 'id'),
                    minSize: target,
                    selected: _selectedItem == str(item, 'id'),
                    onTap: () => setState(() => _selectedItem = str(item, 'id')),
                  ),
            ],
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------------ sort_bins

class SortBinsEngine extends GameEngine {
  const SortBinsEngine();

  @override
  String get engineId => 'sort_bins';

  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) {
    return _SortBinsBoard(controller: controller);
  }
}

class _SortBinsBoard extends StatefulWidget {
  const _SortBinsBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_SortBinsBoard> createState() => _SortBinsBoardState();
}

class _SortBinsBoardState extends State<_SortBinsBoard> {
  String? _selected;
  final Map<String, String> _sorted = {};
  final Set<String> _firstTry = {};
  final Set<String> _retried = {};

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  List<Map<String, dynamic>> get _bins => mapList(_level['bins']);
  List<Map<String, dynamic>> get _items => mapList(_level['items']);

  Future<void> _drop(String binId) async {
    final itemId = _selected;
    if (itemId == null) return;
    final item = _items.firstWhere(
      (entry) => str(entry, 'id') == itemId,
      orElse: () => const {},
    );
    if (str(item, 'bin') != binId) {
      setState(() {
        _retried.add(itemId);
        _selected = null;
      });
      return;
    }
    setState(() {
      _sorted[itemId] = binId;
      if (!_retried.contains(itemId)) _firstTry.add(itemId);
      _selected = null;
    });
    widget.controller.feedback.emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);
    if (_sorted.length == _items.length) await _finish();
  }

  Future<void> _finish() async {
    await widget.controller.reportEngineAttempt(
      score: _firstTry.length,
      maxScore: _items.length,
      answers: _items.map((item) {
        final id = str(item, 'id');
        return <String, Object?>{
          'item': id,
          'correct': _sorted.containsKey(id),
          'attempts': _retried.contains(id) ? 2 : 1,
        };
      }).toList(growable: false),
      helpUsed: _retried.isNotEmpty,
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      child: Column(
        children: [
          Expanded(
            child: Row(
              children: [
                for (final bin in _bins)
                  Expanded(
                    child: _DropTarget(
                      // A bin is distinguished by image, text and audio, never by
                      // colour alone — the contract is explicit, because colour
                      // alone excludes colour-blind children.
                      label: str(bin, 'id'),
                      minSize: target,
                      accepting: _selected != null,
                      placed: _sorted.entries
                          .where((entry) => entry.value == str(bin, 'id'))
                          .map((entry) => entry.key)
                          .toList(growable: false),
                      onTap: () => _drop(str(bin, 'id')),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final item in _items)
                if (!_sorted.containsKey(str(item, 'id')))
                  _TrayChip(
                    id: str(item, 'id'),
                    minSize: target,
                    selected: _selected == str(item, 'id'),
                    onTap: () => setState(() => _selected = str(item, 'id')),
                  ),
            ],
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------- sequence_order

class SequenceOrderEngine extends GameEngine {
  const SequenceOrderEngine();

  @override
  String get engineId => 'sequence_order';

  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) {
    return _SequenceOrderBoard(controller: controller);
  }
}

class _SequenceOrderBoard extends StatefulWidget {
  const _SequenceOrderBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_SequenceOrderBoard> createState() => _SequenceOrderBoardState();
}

class _SequenceOrderBoardState extends State<_SequenceOrderBoard> {
  /// Panel ids in the order the child has placed them.
  final List<String> _order = [];

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  List<Map<String, dynamic>> get _panels => mapList(_level['panels']);

  /// Every logically acceptable order. More than one can be correct, which is why
  /// the schema stores a list rather than a single answer.
  List<List<String>> get _accepted {
    final raw = _level['accepted_orders'];
    if (raw is! List) return const [];
    return raw
        .map((entry) => entry is List ? entry.whereType<String>().toList(growable: false) : null)
        .whereType<List<String>>()
        .toList(growable: false);
  }

  /// True when the strip runs right-to-left.
  ///
  /// `direction: reading_order` means the strip follows the interface direction,
  /// which for Arabic is RTL. This is the one place a direction *should* come from
  /// the UI, unlike letter stroke direction which comes from the letter.
  bool get _isRtl => Directionality.of(context) == TextDirection.rtl;

  Future<void> _place(String panelId) async {
    if (_order.contains(panelId)) return;
    setState(() => _order.add(panelId));
    widget.controller.feedback.emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);
    if (_order.length == _panels.length) await _finish();
  }

  void _undo() {
    if (_order.isEmpty) return;
    setState(_order.removeLast);
  }

  bool get _isCorrect => _accepted.any((accepted) =>
      accepted.length == _order.length &&
      List.generate(_order.length, (i) => accepted[i] == _order[i]).every((match) => match));

  Future<void> _finish() async {
    // The mastery document scores this engine 1 for a correct order, out of 1 —
    // not per panel, because a sequence is right or it is not yet right.
    await widget.controller.reportEngineAttempt(
      score: _isCorrect ? 1 : 0,
      maxScore: 1,
      answers: [
        {'ordered': _order.length, 'panels': _panels.length, 'correct': _isCorrect},
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    final strip = [
      for (var slot = 0; slot < _panels.length; slot++)
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(4),
            constraints: BoxConstraints(minHeight: target),
            decoration: BoxDecoration(
              border: Border.all(color: Theme.of(context).colorScheme.outline),
              borderRadius: BorderRadius.circular(12),
            ),
            alignment: Alignment.center,
            child: Text(
              slot < _order.length ? _order[slot] : '${slot + 1}',
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
        ),
    ];

    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      footer: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: OutlinedButton.icon(
          onPressed: _undo,
          icon: const Icon(Icons.undo),
          label: const Text('رجوع'),
        ),
      ),
      child: Column(
        children: [
          Row(children: _isRtl ? strip.reversed.toList(growable: false) : strip),
          const SizedBox(height: 16),
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final panel in _panels)
                  if (!_order.contains(str(panel, 'id')))
                    _TrayChip(
                      id: str(panel, 'id'),
                      minSize: target,
                      selected: false,
                      onTap: () => _place(str(panel, 'id')),
                    ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ------------------------------------------------------------ shared widgets

class _DropTarget extends StatelessWidget {
  const _DropTarget({
    required this.label,
    required this.minSize,
    required this.accepting,
    required this.placed,
    required this.onTap,
  });

  final String label;
  final double minSize;
  final bool accepting;
  final List<String> placed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.all(6),
          constraints: BoxConstraints(minWidth: minSize, minHeight: minSize),
          decoration: BoxDecoration(
            border: Border.all(
              color: accepting
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.outline,
              width: accepting ? 3 : 1,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label, style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 6),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: 4,
                children: [
                  for (final id in placed)
                    Chip(label: Text(id, style: Theme.of(context).textTheme.labelSmall)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TrayChip extends StatelessWidget {
  const _TrayChip({
    required this.id,
    required this.minSize,
    required this.selected,
    required this.onTap,
  });

  final String id;
  final double minSize;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      child: InkWell(
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minWidth: minSize, minHeight: minSize),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: selected
                ? Theme.of(context).colorScheme.primaryContainer
                : Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : Colors.transparent,
              width: 2,
            ),
          ),
          alignment: Alignment.center,
          child: Text(id, style: Theme.of(context).textTheme.labelMedium),
        ),
      ),
    );
  }
}
