import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/focusable_scale.dart';
import '../../../home/domain/content_models.dart';

/// Memory-match engine (`memory_flip` in docs/games/engines/04-memory-flip.md).
///
/// Rewritten from a static demo board. The previous version generated
/// `List.generate(8, (i) => i % 4)` once, never shuffled, revealed a tile only
/// while it was selected, and defined "matched" as `_hintUsed && value == 0`, so
/// the hint exposed a single arbitrary tile and pairs were never retained.
///
/// This implementation keeps real state: a shuffled deck, three tile states
/// (hidden / revealed / matched), a mismatch delay before flipping back, and
/// levels that grow the board. Per the engine spec it is entertainment-first —
/// there is no failure state and no timer.
class GamePage extends StatefulWidget {
  const GamePage({required this.experience, super.key});
  final ExperienceItem experience;

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> {
  /// Pairs per level. The board grows but stays inside the engine spec's
  /// on-screen element budget for young players.
  static const _pairsPerLevel = [3, 4, 6, 8];

  /// Not `const`: reading `.length` off a const list is not a constant
  /// expression in Dart.
  static final _maxLevel = _pairsPerLevel.length;

  /// Emoji faces stand in for artwork until game content packs ship. Chosen to
  /// be visually distinct from one another rather than thematically related.
  static const _faces = ['🌙', '⭐', '🚀', '🪐', '☄️', '🔭', '🛰️', '✨'];

  late List<int> _deck;
  final Set<int> _matched = {};
  final List<int> _revealed = [];

  int _level = 1;
  int _score = 0;
  int _moves = 0;
  bool _hintActive = false;
  bool _locked = false;
  bool _levelComplete = false;

  Timer? _mismatchTimer;
  Timer? _hintTimer;

  @override
  void initState() {
    super.initState();
    _deck = _buildDeck(_level);
  }

  @override
  void dispose() {
    _mismatchTimer?.cancel();
    _hintTimer?.cancel();
    super.dispose();
  }

  /// Builds a shuffled deck of value pairs for [level].
  ///
  /// Seeded from the experience id plus the level so a given game is stable if
  /// the widget rebuilds, but differs between levels and between games.
  List<int> _buildDeck(int level) {
    final pairs = _pairsPerLevel[(level - 1).clamp(0, _maxLevel - 1)];
    final deck = <int>[];
    for (var value = 0; value < pairs; value++) {
      deck.add(value);
      deck.add(value);
    }
    deck.shuffle(math.Random(widget.experience.id.hashCode + level * 31));
    return deck;
  }

  void _onTileTap(int index) {
    // Ignore taps on resolved tiles, the tile already face up, or while a
    // mismatch is being shown.
    if (_locked || _matched.contains(index) || _revealed.contains(index)) return;

    setState(() {
      _revealed.add(index);

      if (_revealed.length < 2) return;

      _moves++;
      final first = _revealed[0];
      final second = _revealed[1];

      if (_deck[first] == _deck[second]) {
        _matched.addAll([first, second]);
        _revealed.clear();
        // Fewer moves means a cleaner solve, so award the base score plus a
        // small bonus while the player is still efficient.
        _score += _moves <= _deck.length ? 12 : 8;
        HapticFeedback.lightImpact();

        if (_matched.length == _deck.length) {
          _levelComplete = true;
          _score += 20;
        }
      } else {
        // Hold both tiles visible briefly so the player can memorise them.
        _locked = true;
        _mismatchTimer?.cancel();
        _mismatchTimer = Timer(const Duration(milliseconds: 750), () {
          if (!mounted) return;
          setState(() {
            _revealed.clear();
            _locked = false;
          });
        });
      }
    });
  }

  /// Briefly reveals every unmatched tile. Costs score so it stays a real
  /// choice, and never blocks progress — the engine spec forbids dead ends.
  void _useHint() {
    if (_hintActive || _levelComplete) return;
    setState(() {
      _hintActive = true;
      _score = math.max(0, _score - 5);
    });
    _hintTimer?.cancel();
    _hintTimer = Timer(const Duration(milliseconds: 1400), () {
      if (!mounted) return;
      setState(() => _hintActive = false);
    });
  }

  void _nextLevel() {
    setState(() {
      _level = math.min(_level + 1, _maxLevel);
      _deck = _buildDeck(_level);
      _matched.clear();
      _revealed.clear();
      _moves = 0;
      _levelComplete = false;
      _hintActive = false;
      _locked = false;
    });
  }

  void _restartLevel() {
    _mismatchTimer?.cancel();
    _hintTimer?.cancel();
    setState(() {
      _deck = _buildDeck(_level);
      _matched.clear();
      _revealed.clear();
      _moves = 0;
      _levelComplete = false;
      _hintActive = false;
      _locked = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final pairs = _deck.length ~/ 2;
    final matchedPairs = _matched.length ~/ 2;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Column(
            children: [
              _Header(
                title: widget.experience.title,
                score: _score,
                onBack: () => context.pop(),
              ),
              _StatusBar(
                level: _level,
                maxLevel: _maxLevel,
                matchedPairs: matchedPairs,
                totalPairs: pairs,
                moves: _moves,
                hintActive: _hintActive,
                onHint: _useHint,
              ),
              const SizedBox(height: 10),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 18),
                  child: GridView.builder(
                    // Extent-based so the board keeps square-ish tiles on
                    // phones, tablets and TV instead of stretched columns.
                    gridDelegate:
                        const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 140,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: _deck.length,
                    itemBuilder: (context, index) {
                      final isMatched = _matched.contains(index);
                      final isRevealed = _revealed.contains(index);
                      return _MemoryTile(
                        face: _faces[_deck[index] % _faces.length],
                        matched: isMatched,
                        // A hint shows unmatched tiles without marking them.
                        revealed: isRevealed || (_hintActive && !isMatched),
                        autofocus: index == 0,
                        onTap: () => _onTileTap(index),
                      );
                    },
                  ),
                ),
              ),
              if (_levelComplete)
                _LevelCompleteBar(
                  score: _score,
                  moves: _moves,
                  isFinalLevel: _level >= _maxLevel,
                  onNext: _nextLevel,
                  onRestart: _restartLevel,
                )
              else
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                  child: Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _restartLevel,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(
                              color: Colors.white.withValues(alpha: 0.12),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('إعادة'),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.title,
    required this.score,
    required this.onBack,
  });

  final String title;
  final int score;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white),
              tooltip: 'رجوع',
              onPressed: onBack,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            Semantics(
              label: 'النقاط $score',
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.starGold,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.star_rounded,
                      size: 14,
                      color: AppColors.deepSpace,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '$score',
                      style: const TextStyle(
                        color: AppColors.deepSpace,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

class _StatusBar extends StatelessWidget {
  const _StatusBar({
    required this.level,
    required this.maxLevel,
    required this.matchedPairs,
    required this.totalPairs,
    required this.moves,
    required this.hintActive,
    required this.onHint,
  });

  final int level;
  final int maxLevel;
  final int matchedPairs;
  final int totalPairs;
  final int moves;
  final bool hintActive;
  final VoidCallback onHint;

  @override
  Widget build(BuildContext context) {
    final progress = totalPairs == 0 ? 0.0 : matchedPairs / totalPairs;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Column(
        children: [
          Row(
            children: [
              Text(
                'المستوى $level من $maxLevel',
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.78),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(width: 10),
              Text(
                '$matchedPairs / $totalPairs أزواج',
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.62),
                  fontSize: 11,
                ),
              ),
              const Spacer(),
              Text(
                '$moves محاولة',
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.52),
                  fontSize: 11,
                ),
              ),
              const SizedBox(width: 6),
              TextButton.icon(
                onPressed: hintActive ? null : onHint,
                icon: Icon(
                  Icons.lightbulb_outline_rounded,
                  size: 16,
                  color: hintActive ? AppColors.success : AppColors.starGold,
                ),
                label: Text(
                  hintActive ? 'تلميح' : 'تلميح −5',
                  style: TextStyle(
                    color: hintActive ? AppColors.success : AppColors.starGold,
                    fontSize: 11,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: Colors.white.withValues(alpha: 0.08),
              valueColor: const AlwaysStoppedAnimation(AppColors.starGold),
            ),
          ),
        ],
      ),
    );
  }
}

/// A single board tile with hidden / revealed / matched states.
class _MemoryTile extends StatelessWidget {
  const _MemoryTile({
    required this.face,
    required this.matched,
    required this.revealed,
    required this.onTap,
    this.autofocus = false,
  });

  final String face;
  final bool matched;
  final bool revealed;
  final VoidCallback onTap;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final showFace = matched || revealed;
    final semanticLabel = matched
        ? 'بطاقة مطابقة'
        : revealed
            ? 'بطاقة مكشوفة'
            : 'بطاقة مقلوبة، اضغط للكشف';

    return FocusableScale(
      onPressed: onTap,
      semanticLabel: semanticLabel,
      autofocus: autofocus,
      borderRadius: BorderRadius.circular(14),
      child: AnimatedContainer(
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 220),
        curve: Curves.easeOutCubic,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(14),
          color: matched
              ? AppColors.success.withValues(alpha: 0.20)
              : showFace
                  ? AppColors.indigoSurface
                  : const Color(0xFF111A3A).withValues(alpha: 0.82),
          border: Border.all(
            color: matched
                ? AppColors.success.withValues(alpha: 0.55)
                : showFace
                    ? AppColors.starGold.withValues(alpha: 0.42)
                    : Colors.white.withValues(alpha: 0.06),
          ),
        ),
        child: Center(
          child: showFace
              ? Text(face, style: const TextStyle(fontSize: 34))
              : Icon(
                  Icons.help_outline_rounded,
                  color: Colors.white.withValues(alpha: 0.22),
                  size: 26,
                ),
        ),
      ),
    );
  }
}

class _LevelCompleteBar extends StatelessWidget {
  const _LevelCompleteBar({
    required this.score,
    required this.moves,
    required this.isFinalLevel,
    required this.onNext,
    required this.onRestart,
  });

  final int score;
  final int moves;
  final bool isFinalLevel;
  final VoidCallback onNext;
  final VoidCallback onRestart;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(18, 0, 18, 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.indigoSurface.withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.32)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(
                Icons.celebration_rounded,
                color: AppColors.success,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isFinalLevel ? 'أكملت كل المستويات!' : 'أكملت المستوى!',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      'النقاط $score • $moves محاولة',
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.78),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onRestart,
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.12),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('إعادة'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton(
                  autofocus: true,
                  onPressed: isFinalLevel ? onRestart : onNext,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.starGold,
                    foregroundColor: AppColors.deepSpace,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: Text(
                    isFinalLevel ? 'العب من جديد' : 'المستوى التالي',
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
