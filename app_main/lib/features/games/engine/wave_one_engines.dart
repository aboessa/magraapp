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

import '../presentation/widgets/drawing_asset.dart';
import 'game_art.dart';
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
  bool _retrying = false;
  int _misses = 0;
  Timer? _flipBack;
  late int _activeLevelIndex;
  int _levelGeneration = 0;

  @override
  void initState() {
    super.initState();
    _activeLevelIndex = widget.controller.levelIndex;
    _build();
  }

  @override
  void didUpdateWidget(covariant _MemoryFlipBoard oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextLevelIndex = widget.controller.levelIndex;
    if (nextLevelIndex != _activeLevelIndex) {
      _resetForLevel(nextLevelIndex);
    }
  }

  void _resetForLevel(int levelIndex) {
    _levelGeneration++;
    _activeLevelIndex = levelIndex;
    _flipBack?.cancel();
    _flipBack = null;
    _locked = false;
    _build();
  }

  bool _isCurrentLevel(int generation) =>
      mounted &&
      generation == _levelGeneration &&
      _activeLevelIndex == widget.controller.levelIndex;

  @override
  void dispose() {
    _levelGeneration++;
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
    _deck = seededShuffle(
      tiles,
      widget.controller.gameId.hashCode + widget.controller.levelIndex,
    );
    _matched.clear();
    _revealed.clear();
    _locked = false;
    _retrying = false;
    _misses = 0;
  }

  Future<void> _tap(int index) async {
    if (_locked || _matched.contains(index) || _revealed.contains(index)) {
      return;
    }

    setState(() {
      _retrying = false;
      _revealed.add(index);
    });
    if (_revealed.length < 2) return;

    final first = _revealed[0];
    final second = _revealed[1];
    if (_deck[first].pairIndex == _deck[second].pairIndex) {
      setState(() {
        _matched.addAll([first, second]);
        _revealed.clear();
      });
      widget.controller.feedback.emit(
        FeedbackEvent.strokeComplete,
        track: widget.controller.ageTrack,
      );
      if (_matched.length == _deck.length) await _finish();
      return;
    }

    // Hold both visible so the child can memorise them, then turn them back.
    // Not a failure: entertainment-first, and the contract gives it no score.
    _misses++;
    setState(() {
      _locked = true;
      _retrying = true;
    });
    _flipBack?.cancel();
    final generation = _levelGeneration;
    _flipBack = Timer(Duration(milliseconds: _flipBackDelayMs), () {
      if (!_isCurrentLevel(generation)) return;
      setState(() {
        _revealed.clear();
        _locked = false;
        _retrying = false;
      });
    });
  }

  Future<void> _finish() async {
    final generation = _levelGeneration;
    // `memory_flip` is entertainment-first: the mastery document lists it as
    // writing attempts but no mastery, so it reports 0 of 0 — it happened, and it
    // is not a mark.
    await widget.controller.reportEngineAttempt(
      score: 0,
      maxScore: 0,
      answers: [
        {'pairs': _deck.length ~/ 2, 'misses': _misses},
      ],
    );
    if (!_isCurrentLevel(generation)) return;
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    // Guard against empty pack data — prevents RangeError on web (js_primitives max 0) and shows honest message
    if (_deck.isEmpty) {
      return BoardScaffold(
        controller: widget.controller,
        prompt: widget.controller.prompt,
        child: const Center(
          child: GameStatePanel(
            kind: GameStateKind.empty,
            title: 'هذا المستوى فارغ الآن',
            message: 'اختر لعبة أخرى وسنجهّز هذا المستوى قريبًا.',
            compact: true,
          ),
        ),
      );
    }
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
          final isMatched = _matched.contains(index);
          final isUp = isMatched || _revealed.contains(index);
          final isRetry = _retrying && _revealed.contains(index);
          final scheme = Theme.of(context).colorScheme;
          final cardBack = gameRoleArtPath(
            role: GameArtRole.cardBack,
            gameId: widget.controller.gameId,
          );
          final cardIdentity = safeChildFacingLabel(
            artId: _deck[index].assetId,
            arabicFallback:
                'الزوج رقم ${formatNumeral(_deck[index].pairIndex + 1, 'arabic_indic')}',
          );
          final stateLabel = isMatched
              ? 'بطاقة متطابقة: $cardIdentity'
              : isRetry
              ? 'بطاقة مكشوفة: $cardIdentity، جرّب بطاقة أخرى'
              : isUp
              ? 'بطاقة مكشوفة: $cardIdentity'
              : 'بطاقة مقلوبة';
          return Semantics(
            button: true,
            excludeSemantics: true,
            selected: isUp,
            label: stateLabel,
            value: isRetry ? 'حاول مرة أخرى' : null,
            child: InkWell(
              // Position-stable key: the tile stays addressable as it flips, which
              // a reveal-state finder cannot do.
              key: ValueKey('memory_tile_$index'),
              onTap: () => _tap(index),
              child: Container(
                constraints: BoxConstraints(
                  minWidth: target,
                  minHeight: target,
                ),
                decoration: BoxDecoration(
                  color: isMatched
                      ? scheme.primaryContainer
                      : isUp
                      ? scheme.surfaceContainerHighest
                      : scheme.primary,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isMatched || isRetry
                        ? scheme.primary
                        : isUp
                        ? scheme.secondary
                        : scheme.outlineVariant,
                    width: isMatched || isUp ? 3 : 1,
                  ),
                ),
                alignment: Alignment.center,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (isUp)
                      Padding(
                        padding: const EdgeInsets.all(8),
                        child: _CardFace(assetId: _deck[index].assetId),
                      )
                    else if (cardBack != null)
                      ClipRRect(
                        borderRadius: BorderRadius.circular(14),
                        child: DecorativeGameArt(
                          role: GameArtRole.cardBack,
                          gameId: widget.controller.gameId,
                        ),
                      )
                    else
                      const Center(child: Icon(Icons.question_mark, size: 28)),
                    if (isMatched || isUp)
                      PositionedDirectional(
                        top: 4,
                        end: 4,
                        child: Icon(
                          isMatched
                              ? Icons.check_circle
                              : isRetry
                              ? Icons.refresh_rounded
                              : Icons.visibility_outlined,
                          key: ValueKey(
                            isMatched
                                ? 'memory_matched_$index'
                                : isRetry
                                ? 'memory_retry_$index'
                                : 'memory_revealed_$index',
                          ),
                          size: 22,
                          color: scheme.primary,
                        ),
                      ),
                  ],
                ),
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

/// وجه البطاقة المكشوفة: فنٌّ حقيقي متى تحلّل المعرّف، ونصٌّ مميِّز متى لم يتحلّل.
///
/// ## لماذا لا يُنادى `DrawingAsset` مباشرةً
///
/// بديل `DrawingAsset` عند تعذّر التحليل أيقونة **واحدة** موحّدة
/// (`Icons.image_outlined`, انظر `_placeholder`). وهذا مقبول في التلوين — صورة
/// واحدة على الشاشة — لكنه **يُفسد لعبة الذاكرة**: البطاقات تتشابه فيصير
/// المطابَقة تخمينًا أعمى لا تذكُّرًا، وهو أسوأ من عرض المعرّف نصًّا.
///
/// ولأن حِزم `wave4` تُشير إلى معرّفات لم يُنتَج فنّها بعد
/// (`asset-wave4-cat` وأمثاله، ٢٠ معرّفًا)، فالحالتان **قائمتان معًا** في نفس
/// اللعبة اليوم. فالفحص هنا شرطٌ للصحة لا احتياطًا.
class _CardFace extends StatelessWidget {
  const _CardFace({required this.assetId});

  final String assetId;

  @override
  Widget build(BuildContext context) {
    final path = gameArtPath(assetId);
    if (path == null) {
      final name = arabicNameFor(assetId);
      // المعرّف بلا فنّ أو ترجمة يبقى قابلًا للتمييز بعلامة هندسية ثابتة لا
      // تعتمد على اللون، من دون كشف مفتاح الحزمة التقني للطفل.
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(nonColourGlyph(_fallbackCardIndex(assetId)), size: 34),
          const SizedBox(height: 6),
          Text(
            name ?? 'بطاقة مصوّرة',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      );
    }
    return DrawingAsset(
      // الصورة الملوّنة أولًا (`game_art.dart`)، لا رسم التلوين الأبيض والأسود.
      assetIdOrPath: path,
      fit: BoxFit.contain,
      // التسمية الدلالية الآمنة يعلنها الأب بعد الكشف؛ يظل وجه الصورة نفسه
      // مستبعدًا من الدمج حتى لا يكرر قارئ الشاشة الاسم.
      fallbackIsShrink: true,
    );
  }
}

int _fallbackCardIndex(String assetId) {
  return assetId.codeUnits.fold<int>(0, (sum, code) => sum + code);
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
  String? _retryMessage;

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  List<Map<String, dynamic>> get _targets => mapList(_level['targets']);
  List<Map<String, dynamic>> get _items => mapList(_level['items']);
  List<Map<String, dynamic>> get _distractors => mapList(_level['distractors']);

  /// Items plus distractors. A distractor belongs to no target, so tapping it on
  /// one is simply returned.
  List<Map<String, dynamic>> get _tray {
    final all = [..._items, ..._distractors];
    if (_level['shuffle'] == false) return all;
    return seededShuffle(
      all,
      widget.controller.gameId.hashCode + widget.controller.levelIndex,
    );
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
        _retryMessage = 'ليست هنا. جرّب هدفًا آخر.';
      });
      return;
    }

    setState(() {
      _placed[itemId] = targetId;
      if (!_retried.contains(itemId)) _firstTry.add(itemId);
      _selectedItem = null;
      _retryMessage = null;
    });
    widget.controller.feedback.emit(
      FeedbackEvent.strokeComplete,
      track: widget.controller.ageTrack,
    );

    if (_placed.length == _items.length) await _finish();
  }

  Future<void> _finish() async {
    await widget.controller.reportEngineAttempt(
      score: _firstTry.length,
      maxScore: _items.length,
      answers: _items
          .map((item) {
            final id = str(item, 'id');
            return <String, Object?>{
              'item': id,
              'correct': _placed.containsKey(id),
              'attempts': _retried.contains(id) ? 2 : 1,
            };
          })
          .toList(growable: false),
      helpUsed: _retried.isNotEmpty,
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    if (_targets.isEmpty || _items.isEmpty) {
      return BoardScaffold(
        controller: widget.controller,
        prompt: widget.controller.prompt,
        child: const Center(
          child: GameStatePanel(
            kind: GameStateKind.empty,
            title: 'هذا المستوى فارغ الآن',
            message: 'لا توجد عناصر للمطابقة هنا. جرّب مستوى آخر.',
          ),
        ),
      );
    }
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
                      id: str(entry, 'id'),
                      artId: str(entry, 'image'),
                      label: arabicNameFor(str(entry, 'label_key')),
                      minSize: target,
                      accepting: _selectedItem != null,
                      completed: _placed.values.contains(str(entry, 'id')),
                      placed: _placed.entries
                          .where((placed) => placed.value == str(entry, 'id'))
                          .map((placed) => _imageOf(placed.key))
                          .toList(growable: false),
                      onTap: () => _placeOn(str(entry, 'id')),
                    ),
                  ),
              ],
            ),
          ),
          if (_retryMessage != null) ...[
            const SizedBox(height: 10),
            Semantics(
              liveRegion: true,
              label: _retryMessage,
              child: Container(
                key: const Key('match_retry_feedback'),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainer,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.primary,
                    width: 2,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.refresh_rounded),
                    const SizedBox(width: 8),
                    Flexible(child: Text(_retryMessage!)),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              for (final item in _tray)
                if (!_placed.containsKey(str(item, 'id')))
                  _TrayChip(
                    id: str(item, 'id'),
                    artId: str(item, 'image'),
                    label: arabicNameFor(str(item, 'label_key')),
                    minSize: target,
                    selected: _selectedItem == str(item, 'id'),
                    retried: _retried.contains(str(item, 'id')),
                    reduceMotion: widget.controller.settings.reduceMotion,
                    onTap: () =>
                        setState(() => _selectedItem = str(item, 'id')),
                  ),
            ],
          ),
        ],
      ),
    );
  }

  String? _imageOf(String itemId) {
    for (final item in [..._items, ..._distractors]) {
      if (str(item, 'id') == itemId) return str(item, 'image');
    }
    return null;
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
    widget.controller.feedback.emit(
      FeedbackEvent.strokeComplete,
      track: widget.controller.ageTrack,
    );
    if (_sorted.length == _items.length) await _finish();
  }

  Future<void> _finish() async {
    await widget.controller.reportEngineAttempt(
      score: _firstTry.length,
      maxScore: _items.length,
      answers: _items
          .map((item) {
            final id = str(item, 'id');
            return <String, Object?>{
              'item': id,
              'correct': _sorted.containsKey(id),
              'attempts': _retried.contains(id) ? 2 : 1,
            };
          })
          .toList(growable: false),
      helpUsed: _retried.isNotEmpty,
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    if (_bins.isEmpty || _items.isEmpty) {
      return BoardScaffold(
        controller: widget.controller,
        prompt: widget.controller.prompt,
        child: const Center(
          child: GameStatePanel(
            kind: GameStateKind.empty,
            title: 'هذا المستوى فارغ الآن',
            message: 'لا توجد عناصر للفرز هنا. جرّب مستوى آخر.',
          ),
        ),
      );
    }
    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      child: Column(
        children: [
          Expanded(
            child: Row(
              children: [
                for (var index = 0; index < _bins.length; index++)
                  Expanded(
                    child: _DropTarget(
                      // A bin is distinguished by image, text and audio, never by
                      // colour alone — the contract is explicit, because colour
                      // alone excludes colour-blind children.
                      id: str(_bins[index], 'id'),
                      artId: _binArt(_bins[index]),
                      label: _binLabel(_bins[index], index),
                      minSize: target,
                      accepting: _selected != null,
                      placed: _sorted.entries
                          .where(
                            (entry) => entry.value == str(_bins[index], 'id'),
                          )
                          .map((entry) => _imageOf(entry.key))
                          .toList(growable: false),
                      onTap: () => _drop(str(_bins[index], 'id')),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              for (var index = 0; index < _items.length; index++)
                if (!_sorted.containsKey(str(_items[index], 'id')))
                  _TrayChip(
                    id: str(_items[index], 'id'),
                    artId: str(_items[index], 'image'),
                    label: _itemLabel(_items[index], index),
                    minSize: target,
                    selected: _selected == str(_items[index], 'id'),
                    reduceMotion: widget.controller.settings.reduceMotion,
                    onTap: () =>
                        setState(() => _selected = str(_items[index], 'id')),
                  ),
            ],
          ),
        ],
      ),
    );
  }

  String _binLabel(Map<String, dynamic> bin, int index) {
    return safeChildFacingLabel(
      technicalId: str(bin, 'label_key'),
      artId: _binArt(bin),
      arabicFallback: 'السلة ${formatNumeral(index + 1, 'arabic_indic')}',
    );
  }

  String _itemLabel(Map<String, dynamic> item, int index) {
    return safeChildFacingLabel(
      technicalId: str(item, 'label_key'),
      artId: str(item, 'image'),
      arabicFallback: 'القطعة ${formatNumeral(index + 1, 'arabic_indic')}',
    );
  }

  /// A produced basket for the bin's category when one exists (`bin.red` →
  /// `asset-bin-red`), else the pack's own emblem image.
  String? _binArt(Map<String, dynamic> bin) {
    final key = str(bin, 'label_key');
    if (key.startsWith('bin.')) {
      final basket = 'asset-bin-${key.substring(4)}';
      if (gameArtPath(basket) != null) return basket;
    }
    final image = str(bin, 'image');
    return image.isEmpty ? null : image;
  }

  String? _imageOf(String itemId) {
    for (final item in _items) {
      if (str(item, 'id') == itemId) return str(item, 'image');
    }
    return null;
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
  final Map<String, FocusNode> _panelFocusNodes = {};

  @override
  void initState() {
    super.initState();
    for (final panel in _panels) {
      final id = str(panel, 'id');
      if (id.isNotEmpty) _panelFocusNodes[id] = FocusNode();
    }
  }

  @override
  void dispose() {
    for (final node in _panelFocusNodes.values) {
      node.dispose();
    }
    super.dispose();
  }

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  List<Map<String, dynamic>> get _panels => mapList(_level['panels']);

  /// Every logically acceptable order. More than one can be correct, which is why
  /// the schema stores a list rather than a single answer.
  List<List<String>> get _accepted {
    final raw = _level['accepted_orders'];
    if (raw is! List) return const [];
    return raw
        .map(
          (entry) => entry is List
              ? entry.whereType<String>().toList(growable: false)
              : null,
        )
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

    // Inserting remains a single tap/activate action. Because that action removes
    // its focused tray card, move focus deterministically to the next unplaced
    // card after layout instead of letting primary focus fall out of the board.
    final nextPanelId = _panels
        .map((panel) => str(panel, 'id'))
        .where((id) => !_order.contains(id))
        .firstOrNull;
    if (nextPanelId != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _panelFocusNodes[nextPanelId]?.requestFocus();
      });
    }

    widget.controller.feedback.emit(
      FeedbackEvent.strokeComplete,
      track: widget.controller.ageTrack,
    );
    if (_order.length == _panels.length) await _finish();
  }

  void _undo() {
    if (_order.isEmpty) return;
    setState(_order.removeLast);
  }

  bool get _isCorrect => _accepted.any(
    (accepted) =>
        accepted.length == _order.length &&
        List.generate(
          _order.length,
          (i) => accepted[i] == _order[i],
        ).every((match) => match),
  );

  Future<void> _finish() async {
    // The mastery document scores this engine 1 for a correct order, out of 1 —
    // not per panel, because a sequence is right or it is not yet right.
    await widget.controller.reportEngineAttempt(
      score: _isCorrect ? 1 : 0,
      maxScore: 1,
      answers: [
        {
          'ordered': _order.length,
          'panels': _panels.length,
          'correct': _isCorrect,
        },
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);

    Map<String, dynamic>? panelOf(String panelId) {
      for (final panel in _panels) {
        if (str(panel, 'id') == panelId) return panel;
      }
      return null;
    }

    String panelCaption(Map<String, dynamic> panel, int index) {
      return safeChildFacingLabel(
        authoredText: str(panel, 'caption'),
        technicalId: str(panel, 'caption_key'),
        arabicFallback: 'الخطوة ${formatNumeral(index + 1, 'arabic_indic')}',
      );
    }

    String panelCaptionForId(String panelId) {
      final panels = _panels;
      for (var index = 0; index < panels.length; index++) {
        if (str(panels[index], 'id') == panelId) {
          return panelCaption(panels[index], index);
        }
      }
      return 'خطوة مصوّرة';
    }

    if (_panels.isEmpty || _accepted.isEmpty) {
      return BoardScaffold(
        controller: widget.controller,
        prompt: widget.controller.prompt,
        child: const Center(
          child: GameStatePanel(
            kind: GameStateKind.empty,
            title: 'هذا المستوى فارغ الآن',
            message: 'لا توجد خطوات للترتيب هنا. جرّب مستوى آخر.',
          ),
        ),
      );
    }

    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      footer: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: OutlinedButton.icon(
          key: const Key('sequence_undo_button'),
          style: gameActionStyle(target),
          onPressed: _undo,
          icon: const Icon(Icons.undo),
          label: const Text('رجوع'),
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          children: [
            // The child list stays in logical order. The surrounding Arabic Row
            // places slot zero on the right; reversing it here would mirror the
            // reading order a second time.
            Row(
              textDirection: _isRtl ? TextDirection.rtl : TextDirection.ltr,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var slot = 0; slot < _panels.length; slot++)
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(4),
                      child: _SequencePanelFrame(
                        key: ValueKey('sequence_slot_$slot'),
                        panel: slot < _order.length
                            ? panelOf(_order[slot])
                            : null,
                        caption: slot < _order.length
                            ? panelCaptionForId(_order[slot])
                            : 'الخطوة ${formatNumeral(slot + 1, 'arabic_indic')}',
                        minHeight: target,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 16),
            Wrap(
              textDirection: _isRtl ? TextDirection.rtl : TextDirection.ltr,
              spacing: 8,
              runSpacing: 8,
              alignment: WrapAlignment.center,
              children: [
                for (var index = 0; index < _panels.length; index++)
                  if (!_order.contains(str(_panels[index], 'id')))
                    SizedBox(
                      width: (target + 32) * 4 / 3,
                      child: Semantics(
                        button: true,
                        label: panelCaption(_panels[index], index),
                        child: InkWell(
                          key: ValueKey('tray_${str(_panels[index], 'id')}'),
                          focusNode:
                              _panelFocusNodes[str(_panels[index], 'id')],
                          onTap: () => _place(str(_panels[index], 'id')),
                          borderRadius: BorderRadius.circular(12),
                          child: _SequencePanelFrame(
                            panel: _panels[index],
                            caption: panelCaption(_panels[index], index),
                            minHeight: target,
                          ),
                        ),
                      ),
                    ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// A responsive 4:3 story panel. Art is always rendered under LTR directionality
/// so Arabic reading order can move the cards without ever mirroring an image.
class _SequencePanelFrame extends StatelessWidget {
  const _SequencePanelFrame({
    required this.panel,
    required this.caption,
    required this.minHeight,
    super.key,
  });

  final Map<String, dynamic>? panel;
  final String caption;
  final double minHeight;

  @override
  Widget build(BuildContext context) {
    final artId = panel == null ? null : str(panel!, 'image');
    final path = gameArtPath(artId);
    final scheme = Theme.of(context).colorScheme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: Container(
            constraints: BoxConstraints(minHeight: minHeight),
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: scheme.surfaceContainerLow,
              border: Border.all(color: scheme.outlineVariant, width: 1.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: path == null
                ? Center(
                    child: Icon(
                      Icons.photo_size_select_actual_outlined,
                      color: scheme.outline,
                    ),
                  )
                : Directionality(
                    textDirection: TextDirection.ltr,
                    child: GameArt(assetId: artId),
                  ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          caption,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.labelLarge,
        ),
      ],
    );
  }
}

// ------------------------------------------------------------ shared widgets

class _DropTarget extends StatelessWidget {
  const _DropTarget({
    required this.id,
    required this.minSize,
    required this.accepting,
    required this.placed,
    required this.onTap,
    this.completed = false,
    this.artId,
    this.label,
  });

  /// Stable id, used for the key only — never shown to the child.
  final String id;
  final String? artId;

  /// Arabic caption under the picture (bins need it: colour alone excludes
  /// colour-blind children).
  final String? label;
  final double minSize;
  final bool accepting;

  /// A correct placement is announced and shown without relying on colour.
  final bool completed;

  /// Art ids of the pieces already placed here.
  final List<String?> placed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final caption = safeChildFacingLabel(
      authoredText: label,
      artId: artId,
      arabicFallback: 'مكان الصورة',
    );
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      label: caption,
      value: completed ? 'تم وضع الصورة الصحيحة' : null,
      child: InkWell(
        key: ValueKey('drop_target_$id'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          margin: const EdgeInsets.all(6),
          constraints: BoxConstraints(minWidth: minSize, minHeight: minSize),
          decoration: BoxDecoration(
            color: scheme.surfaceContainerLow,
            border: Border.all(
              color: completed
                  ? scheme.tertiary
                  : accepting
                  ? scheme.primary
                  : scheme.outlineVariant,
              width: completed || accepting ? 3 : 1.5,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.all(8),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (completed)
                ExcludeSemantics(
                  child: Icon(
                    Icons.check_circle_outline_rounded,
                    key: ValueKey('drop_target_completed_$id'),
                    color: scheme.tertiary,
                  ),
                ),
              Expanded(
                child: GameArt(assetId: artId, label: label),
              ),
              if (gameArtPath(artId) != null) ...[
                const SizedBox(height: 4),
                Text(caption, style: Theme.of(context).textTheme.labelLarge),
              ],
              if (placed.isNotEmpty) ...[
                const SizedBox(height: 6),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    for (final art in placed)
                      SizedBox.square(
                        dimension: 36,
                        child: GameArt(assetId: art),
                      ),
                  ],
                ),
              ],
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
    required this.reduceMotion,
    required this.onTap,
    this.retried = false,
    this.artId,
    this.label,
  });

  /// Stable id, used for the key only — never shown to the child.
  final String id;
  final String? artId;
  final String? label;
  final double minSize;
  final bool selected;
  final bool retried;
  final bool reduceMotion;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final side = minSize + 24;
    final effectiveReduceMotion =
        reduceMotion || MediaQuery.maybeDisableAnimationsOf(context) == true;
    final scheme = Theme.of(context).colorScheme;
    final caption = safeChildFacingLabel(
      authoredText: label,
      artId: artId,
      arabicFallback: 'قطعة مصوّرة',
    );
    return Semantics(
      button: true,
      selected: selected,
      label: caption,
      value: retried ? 'أعد المحاولة' : null,
      child: InkWell(
        key: ValueKey('tray_$id'),
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: effectiveReduceMotion
              ? Duration.zero
              : const Duration(milliseconds: 150),
          width: side,
          height: side,
          padding: const EdgeInsets.all(6),
          transform: selected && !effectiveReduceMotion
              ? Matrix4.diagonal3Values(1.08, 1.08, 1)
              : null,
          transformAlignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected
                ? scheme.primaryContainer
                : scheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: selected || retried
                  ? scheme.primary
                  : scheme.outlineVariant,
              width: selected || retried ? 3 : 1,
            ),
          ),
          alignment: Alignment.center,
          child: Stack(
            fit: StackFit.expand,
            children: [
              Center(
                child: GameArt(assetId: artId, label: label),
              ),
              if (selected || retried)
                PositionedDirectional(
                  top: 0,
                  end: 0,
                  child: Icon(
                    selected ? Icons.touch_app_outlined : Icons.refresh_rounded,
                    key: ValueKey(
                      selected ? 'tray_selected_$id' : 'tray_retry_$id',
                    ),
                    size: 20,
                    color: scheme.primary,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
