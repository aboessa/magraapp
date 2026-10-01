/// `block_code` — Robo's grid, and a real interpreter.
///
/// Contract: `docs/games/engines/10-block-code.md`, level shape
/// `docs/games/schemas/block_code.v1.schema.json`.
///
/// ## Separation
///
/// [BlockProgram] and [BlockInterpreter] are pure Dart with no Flutter import, so
/// the semantics of `repeat`, `if_path`, collision and goal detection are testable
/// without pumping a widget. That matters more here than in any other engine: the
/// thing being taught *is* the execution model, so it has to be exactly right.
///
/// ## Two interpretations, both documented
///
/// The schema types a program as a flat `["move","repeat:3","move"]` array, which
/// leaves two things open. Rather than guess silently:
///
/// 1. **`repeat:n` repeats the single block that follows it.** A flat array cannot
///    delimit a body, and the contract's own reference solution
///    `["move","move","turn_left","repeat:3","move","collect"]` reads naturally
///    that way. Same rule for `if_path`, which guards the next block only.
/// 2. **`function` is a second strip the child fills in**, called by a `function`
///    block in the main program. The contract says «دالة بسيطة» and gives no
///    authoring slot for a body, so the body must be the child's — which is also
///    how the mechanic works in the genre. Flagged for editorial confirmation.
///
/// Neither interpretation invents a block; both are noted in the report.
///
/// ## What is not done
///
/// The grid is never mirrored in RTL. Directions are game logic, and the contract
/// lists that as an acceptance criterion.
library;

import 'package:flutter/material.dart';
import 'game_art.dart';

import 'game_board_kit.dart';
import 'game_engine_registry.dart';
import 'game_services.dart';
import 'game_session_controller.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// The blocks the contract defines. Nothing else is executable.
enum BlockKind {
  move,
  turnLeft,
  turnRight,
  repeat,
  ifPath,
  collect,
  function;

  static BlockKind? fromToken(String token) {
    switch (token) {
      case 'move':
        return BlockKind.move;
      case 'turn_left':
        return BlockKind.turnLeft;
      case 'turn_right':
        return BlockKind.turnRight;
      case 'repeat':
        return BlockKind.repeat;
      case 'if_path':
        return BlockKind.ifPath;
      case 'collect':
        return BlockKind.collect;
      case 'function':
        return BlockKind.function;
      default:
        return null;
    }
  }

  String get token {
    switch (this) {
      case BlockKind.move:
        return 'move';
      case BlockKind.turnLeft:
        return 'turn_left';
      case BlockKind.turnRight:
        return 'turn_right';
      case BlockKind.repeat:
        return 'repeat';
      case BlockKind.ifPath:
        return 'if_path';
      case BlockKind.collect:
        return 'collect';
      case BlockKind.function:
        return 'function';
    }
  }

  /// The voice key from the contract's Arabic table.
  String get voiceKey => 'vo.block.$token';

  /// The icon must carry the meaning without printed text: the contract forbids
  /// baking words into block artwork, because the labels are translated.
  IconData get icon {
    switch (this) {
      case BlockKind.move:
        return Icons.arrow_upward;
      case BlockKind.turnLeft:
        return Icons.turn_left;
      case BlockKind.turnRight:
        return Icons.turn_right;
      case BlockKind.repeat:
        return Icons.repeat;
      case BlockKind.ifPath:
        return Icons.call_split;
      case BlockKind.collect:
        return Icons.star_outline;
      case BlockKind.function:
        return Icons.functions;
    }
  }

  String get label {
    switch (this) {
      case BlockKind.move:
        return AppLocalizationsAr().gamesblockcodeengineGet01;
      case BlockKind.turnLeft:
        return AppLocalizationsAr().gamesblockcodeengineGet02;
      case BlockKind.turnRight:
        return AppLocalizationsAr().gamesblockcodeengineGet03;
      case BlockKind.repeat:
        return AppLocalizationsAr().gamesblockcodeengineGet04;
      case BlockKind.ifPath:
        return AppLocalizationsAr().gamesblockcodeengineGet05;
      case BlockKind.collect:
        return 'اجمع';
      case BlockKind.function:
        return 'الدالة';
    }
  }
}

class ProgramBlock {
  const ProgramBlock(this.kind, {this.count = 2});
  final BlockKind kind;

  /// The `n` of `repeat:n`.
  final int count;

  String get token => kind == BlockKind.repeat ? 'repeat:$count' : kind.token;

  static ProgramBlock? parse(String token) {
    final parts = token.split(':');
    final kind = BlockKind.fromToken(parts.first);
    if (kind == null) return null;
    if (parts.length == 2) {
      final n = int.tryParse(parts[1]);
      if (n != null) return ProgramBlock(kind, count: n);
    }
    return ProgramBlock(kind);
  }
}

class BlockProgram {
  const BlockProgram({required this.main, this.function = const []});
  final List<ProgramBlock> main;
  final List<ProgramBlock> function;

  static BlockProgram fromTokens(List<String> tokens) => BlockProgram(
    main: tokens.map(ProgramBlock.parse).whereType<ProgramBlock>().toList(),
  );

  /// Blocks the child placed. `repeat:3` counts as one block, which is the whole
  /// point of the optimality star.
  int get blockCount => main.length + function.length;
}

enum Facing { north, east, south, west }

Facing facingFromString(String value) {
  switch (value) {
    case 'north':
      return Facing.north;
    case 'south':
      return Facing.south;
    case 'west':
      return Facing.west;
    default:
      return Facing.east;
  }
}

/// The board, straight from the pack.
class BlockGrid {
  const BlockGrid({
    required this.width,
    required this.height,
    required this.start,
    required this.facing,
    required this.goal,
    required this.walls,
    required this.collectibles,
  });

  factory BlockGrid.fromJson(Map<String, dynamic> json) {
    List<List<int>> cells(Object? value) {
      if (value is! List) return const [];
      return value
          .map((entry) {
            if (entry is! List || entry.length < 2) return null;
            final x = entry[0], y = entry[1];
            if (x is! num || y is! num) return null;
            return [x.toInt(), y.toInt()];
          })
          .whereType<List<int>>()
          .toList();
    }

    final start = cells([json['start']]);
    final goal = cells([json['goal']]);
    return BlockGrid(
      width: intOr(json, 'w', 4),
      height: intOr(json, 'h', 4),
      start: start.isEmpty ? const [0, 0] : start.first,
      facing: facingFromString(str(json, 'facing')),
      goal: goal.isEmpty ? const [1, 1] : goal.first,
      walls: cells(json['walls']),
      collectibles: cells(json['collectibles']),
    );
  }

  final int width;
  final int height;
  final List<int> start;
  final Facing facing;
  final List<int> goal;
  final List<List<int>> walls;
  final List<List<int>> collectibles;

  bool isWall(int x, int y) => walls.any((w) => w[0] == x && w[1] == y);
  bool inBounds(int x, int y) => x >= 0 && y >= 0 && x < width && y < height;
  bool isBlocked(int x, int y) => !inBounds(x, y) || isWall(x, y);
}

/// One observable step of execution.
class BlockStep {
  const BlockStep({
    required this.blockIndex,
    required this.x,
    required this.y,
    required this.facing,
    required this.collected,
    required this.collided,
  });

  /// Index into the flattened program, for highlighting the current block.
  final int blockIndex;
  final int x;
  final int y;
  final Facing facing;
  final Set<String> collected;
  final bool collided;
}

/// Runs a program over a grid, producing every intermediate state.
///
/// Returning the whole trace rather than stepping statefully means the UI can
/// replay, pause and step back without the interpreter needing an undo, and it
/// makes the semantics assertable in a unit test.
class BlockInterpreter {
  BlockInterpreter({required this.grid, this.maxSteps = 500});

  final BlockGrid grid;

  /// Guards against a pathological `repeat` nest. The block limit already bounds
  /// the program, but a trace is cheap to cap and an infinite one is not.
  final int maxSteps;

  List<BlockStep> run(BlockProgram program) {
    var x = grid.start[0];
    var y = grid.start[1];
    var facing = grid.facing;
    final collected = <String>{};
    final steps = <BlockStep>[];
    var collided = false;

    void record(int blockIndex) {
      steps.add(
        BlockStep(
          blockIndex: blockIndex,
          x: x,
          y: y,
          facing: facing,
          collected: Set.of(collected),
          collided: collided,
        ),
      );
    }

    (int, int) ahead() {
      switch (facing) {
        case Facing.north:
          return (x, y - 1);
        case Facing.south:
          return (x, y + 1);
        case Facing.east:
          return (x + 1, y);
        case Facing.west:
          return (x - 1, y);
      }
    }

    /// Executes [blocks], reporting the index of each against [indexOf].
    void execute(List<ProgramBlock> blocks, int Function(int) indexOf) {
      for (var i = 0; i < blocks.length; i++) {
        if (collided || steps.length >= maxSteps) return;
        final block = blocks[i];
        switch (block.kind) {
          case BlockKind.move:
            final (nx, ny) = ahead();
            if (grid.isBlocked(nx, ny)) {
              // Robo stops. The contract wants the *causing* block identified, so
              // the collision is recorded against this index.
              collided = true;
              record(indexOf(i));
              return;
            }
            x = nx;
            y = ny;
            record(indexOf(i));
          case BlockKind.turnLeft:
            facing = Facing.values[(facing.index + 3) % 4];
            record(indexOf(i));
          case BlockKind.turnRight:
            facing = Facing.values[(facing.index + 1) % 4];
            record(indexOf(i));
          case BlockKind.collect:
            final key = '$x,$y';
            if (grid.collectibles.any((c) => c[0] == x && c[1] == y)) {
              collected.add(key);
            }
            record(indexOf(i));
          case BlockKind.repeat:
            // Repeats the single following block, n times. Documented at the top.
            if (i + 1 >= blocks.length) {
              record(indexOf(i));
              continue;
            }
            final body = [blocks[i + 1]];
            final bodyIndex = indexOf(i + 1);
            for (var r = 0; r < block.count; r++) {
              if (collided || steps.length >= maxSteps) break;
              execute(body, (_) => bodyIndex);
            }
            i++; // the body was consumed
          case BlockKind.ifPath:
            if (i + 1 >= blocks.length) {
              record(indexOf(i));
              continue;
            }
            final (nx, ny) = ahead();
            final bodyIndex = indexOf(i + 1);
            if (!grid.isBlocked(nx, ny)) {
              execute([blocks[i + 1]], (_) => bodyIndex);
            } else {
              // The guard evaluated false. Recorded so the child sees the block
              // was reached and simply did not apply.
              record(indexOf(i));
            }
            i++;
          case BlockKind.function:
            execute(program.function, (_) => indexOf(i));
        }
      }
    }

    execute(program.main, (i) => i);
    if (steps.isEmpty) record(0);
    return steps;
  }

  /// Whether [last] is a win: on the goal with everything collected.
  bool reachedGoal(BlockStep last) {
    if (last.collided) return false;
    if (last.x != grid.goal[0] || last.y != grid.goal[1]) return false;
    return last.collected.length >= grid.collectibles.length;
  }
}

class BlockCodeEngine extends GameEngine {
  const BlockCodeEngine();

  @override
  String get engineId => 'block_code';

  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _BlockCodeSurface(controller: controller);
}

class _BlockCodeSurface extends StatefulWidget {
  const _BlockCodeSurface({required this.controller});
  final GameSessionController controller;

  @override
  State<_BlockCodeSurface> createState() => _BlockCodeSurfaceState();
}

class _BlockCodeSurfaceState extends State<_BlockCodeSurface> {
  final List<ProgramBlock> _main = [];
  final List<ProgramBlock> _function = [];

  /// Which strip a tapped palette block lands in.
  bool _editingFunction = false;

  List<BlockStep> _trace = const [];
  int _traceIndex = 0;
  bool _playing = false;
  bool _paused = false;
  int _failedRuns = 0;
  bool _usedReferenceSolution = false;
  bool _solved = false;
  bool _optimal = false;
  int _removedWalls = 0;
  int _repeatCount = 2;
  late int _activeLevelIndex;
  int _executionEpoch = 0;

  static const int _minRepeatCount = 2;
  static const int _maxRepeatCount = 4;

  @override
  void initState() {
    super.initState();
    _activeLevelIndex = widget.controller.levelIndex;
  }

  @override
  void didUpdateWidget(covariant _BlockCodeSurface oldWidget) {
    super.didUpdateWidget(oldWidget);
    final nextLevelIndex = widget.controller.levelIndex;
    if (nextLevelIndex != _activeLevelIndex) {
      _resetForLevel(nextLevelIndex);
    }
  }

  void _resetForLevel(int levelIndex) {
    _executionEpoch++;
    _activeLevelIndex = levelIndex;
    _main.clear();
    _function.clear();
    _editingFunction = false;
    _trace = const [];
    _traceIndex = 0;
    _playing = false;
    _paused = false;
    _failedRuns = 0;
    _usedReferenceSolution = false;
    _solved = false;
    _optimal = false;
    _removedWalls = 0;
    _repeatCount = _minRepeatCount;
  }

  bool _isCurrentExecution(int epoch) =>
      mounted &&
      epoch == _executionEpoch &&
      _activeLevelIndex == widget.controller.levelIndex;

  Map<String, dynamic> get _level => widget.controller.rawLevel;

  BlockGrid get _grid {
    final raw = _level['grid'];
    final grid = BlockGrid.fromJson(
      raw is Map ? Map<String, dynamic>.from(raw) : const {},
    );
    if (_removedWalls == 0 || grid.walls.isEmpty) return grid;
    // The third rung removes an obstacle rather than shrinking the grid; both are
    // offered by the contract and removing a wall cannot invalidate the goal
    // position, whereas shrinking can.
    return BlockGrid(
      width: grid.width,
      height: grid.height,
      start: grid.start,
      facing: grid.facing,
      goal: grid.goal,
      walls: grid.walls.sublist(
        0,
        (grid.walls.length - _removedWalls).clamp(0, grid.walls.length),
      ),
      collectibles: grid.collectibles,
    );
  }

  List<BlockKind> get _allowed =>
      (_level['allowed_blocks'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .map(BlockKind.fromToken)
          .whereType<BlockKind>()
          .toList();

  int get _blockLimit => intOr(_level, 'block_limit', 8);
  int get _optimalBlocks => intOr(_level, 'optimal_blocks', _blockLimit);
  int get _stepDelayMs => intOr(_level, 'step_delay_ms', 500);
  List<String> get _referenceSolution =>
      (_level['reference_solution'] as List<dynamic>? ?? const [])
          .whereType<String>()
          .toList();

  BlockProgram get _program => BlockProgram(main: _main, function: _function);
  BlockStep? get _current =>
      _trace.isEmpty ? null : _trace[_traceIndex.clamp(0, _trace.length - 1)];
  bool get _reduceMotion =>
      widget.controller.settings.reduceMotion ||
      MediaQuery.maybeDisableAnimationsOf(context) == true;

  void _changeRepeatCount(int delta) {
    final next = (_repeatCount + delta).clamp(_minRepeatCount, _maxRepeatCount);
    if (next == _repeatCount) return;
    setState(() => _repeatCount = next);
  }

  void _addBlock(BlockKind kind) {
    if (_program.blockCount >= _blockLimit) return;
    setState(() {
      (_editingFunction ? _function : _main).add(
        ProgramBlock(kind, count: kind == BlockKind.repeat ? _repeatCount : 2),
      );
    });
    widget.controller.speakVoiceKey(kind.voiceKey);
  }

  /// Removes the last block. Always available, and never loses the rest.
  void _stepBack() {
    final strip = _editingFunction ? _function : _main;
    if (strip.isEmpty) return;
    setState(() => strip.removeLast());
  }

  void _startOver() {
    _executionEpoch++;
    setState(() {
      _main.clear();
      _function.clear();
      _trace = const [];
      _traceIndex = 0;
      _playing = false;
      _paused = false;
    });
  }

  Future<void> _run() async {
    if (_playing || _main.isEmpty) return;
    final epoch = ++_executionEpoch;
    final interpreter = BlockInterpreter(grid: _grid);
    final trace = interpreter.run(_program);
    setState(() {
      _trace = trace;
      _traceIndex = 0;
      _playing = true;
      _paused = false;
    });

    // Visible, step by step, and pausable — all three are acceptance criteria.
    while (_traceIndex < _trace.length - 1) {
      await Future<void>.delayed(
        _reduceMotion ? Duration.zero : Duration(milliseconds: _stepDelayMs),
      );
      if (!_isCurrentExecution(epoch)) return;
      if (_paused) {
        // Wait here without consuming steps until the child resumes.
        while (_paused && _isCurrentExecution(epoch)) {
          await Future<void>.delayed(const Duration(milliseconds: 100));
        }
      }
      if (!_isCurrentExecution(epoch)) return;
      setState(() => _traceIndex++);
    }

    if (!_isCurrentExecution(epoch)) return;
    setState(() => _playing = false);

    final last = _trace.last;
    if (interpreter.reachedGoal(last)) {
      await _succeed(epoch);
      return;
    }
    await _fail(last, epoch);
  }

  Future<void> _fail(BlockStep last, int epoch) async {
    if (!_isCurrentExecution(epoch)) return;
    _failedRuns++;
    if (last.collided) {
      await widget.controller.speakVoiceKey('vo.collision');
      if (!_isCurrentExecution(epoch)) return;
    }
    // The ladder from the contract's error table.
    switch (_failedRuns) {
      case 1:
        break;
      case 2:
        await widget.controller.speakVoiceKey('vo.hint');
      case 3:
        if (!_isCurrentExecution(epoch)) return;
        setState(() => _removedWalls = 1);
        await widget.controller.speakVoiceKey('vo.hint');
      default:
        await _runReferenceSolution(epoch);
    }
    if (_isCurrentExecution(epoch)) setState(() {});
  }

  /// Plays the authored solution step by step. Marks help as used.
  Future<void> _runReferenceSolution(int epoch) async {
    if (!_isCurrentExecution(epoch)) return;
    final tokens = _referenceSolution;
    if (tokens.isEmpty) return;
    _usedReferenceSolution = true;
    setState(() {
      _main
        ..clear()
        ..addAll(BlockProgram.fromTokens(tokens).main);
    });
    await widget.controller.speakVoiceKey('vo.hint');
  }

  Future<void> _succeed(int epoch) async {
    if (!_isCurrentExecution(epoch)) return;
    _solved = true;
    // The extra star. A longer solution is never penalised: this only adds.
    _optimal = _program.blockCount <= _optimalBlocks;
    if (_optimal) {
      await widget.controller.speakVoiceKey('vo.star_optimal');
      if (!_isCurrentExecution(epoch)) return;
    }
    widget.controller.feedback.emit(
      FeedbackEvent.levelComplete,
      track: widget.controller.ageTrack,
    );

    await widget.controller.reportEngineAttempt(
      score: 1 + (_optimal ? 1 : 0),
      maxScore: 2,
      helpUsed: _usedReferenceSolution,
      answers: [
        {
          'blocks_used': _program.blockCount,
          'optimal_blocks': _optimalBlocks,
          'optimal': _optimal,
          'failed_runs': _failedRuns,
          'used_reference_solution': _usedReferenceSolution,
        },
      ],
    );
    if (!_isCurrentExecution(epoch)) return;
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    final grid = _grid;
    final actionStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size(target, target)),
    );

    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      footer: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Wrap(
          spacing: 8,
          alignment: WrapAlignment.center,
          children: [
            FilledButton.icon(
              key: const Key('block_run_button'),
              onPressed: _playing ? null : _run,
              style: actionStyle,
              icon: const Icon(Icons.play_arrow),
              label: const Text('شغّل'),
            ),
            OutlinedButton.icon(
              // Pausing matters for processing difficulties; an acceptance
              // criterion, not a convenience.
              key: const Key('block_pause_button'),
              onPressed: _playing
                  ? () => setState(() => _paused = !_paused)
                  : null,
              style: actionStyle,
              icon: Icon(
                _paused ? Icons.play_arrow_outlined : Icons.pause_outlined,
              ),
              label: Text(_paused ? 'أكمل' : 'أوقف مؤقتًا'),
            ),
            OutlinedButton.icon(
              key: const Key('block_step_back_button'),
              onPressed: _stepBack,
              style: actionStyle,
              icon: const Icon(Icons.undo_outlined),
              label: const Text('رجوع خطوة'),
            ),
            OutlinedButton.icon(
              key: const Key('block_start_over_button'),
              onPressed: _startOver,
              style: actionStyle,
              icon: const Icon(Icons.restart_alt_outlined),
              label: const Text('ابدأ من جديد'),
            ),
          ],
        ),
      ),
      // Arabic controls keep the ambient RTL direction. Only game geometry is
      // pinned to LTR inside `_buildGrid`.
      child: FocusTraversalGroup(
        policy: OrderedTraversalPolicy(),
        child: SingleChildScrollView(
          child: Column(
            children: [
              LayoutBuilder(
                builder: (context, constraints) =>
                    _buildGrid(grid, constraints.maxWidth),
              ),
              const SizedBox(height: 12),
              if (_solved)
                Semantics(
                  liveRegion: true,
                  child: Text(
                    _optimal ? 'وصل روبو بحل فعّال' : 'وصل روبو',
                    key: const Key('block_result'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              const SizedBox(height: 8),
              _buildProgramStrip(),
              const SizedBox(height: 8),
              _buildPalette(target),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGrid(BlockGrid grid, double maxWidth) {
    final step = _current;
    final robotX = step?.x ?? grid.start[0];
    final robotY = step?.y ?? grid.start[1];
    final facing = step?.facing ?? grid.facing;
    final collected = step?.collected ?? const <String>{};
    final availableWidth = maxWidth.isFinite ? maxWidth : 320.0;
    final cellSize = (availableWidth / grid.width - 4).clamp(24.0, 72.0);

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Column(
        children: [
          for (var y = 0; y < grid.height; y++)
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                for (var x = 0; x < grid.width; x++)
                  _cell(
                    grid,
                    x,
                    y,
                    robotX,
                    robotY,
                    facing,
                    collected,
                    cellSize,
                  ),
              ],
            ),
        ],
      ),
    );
  }

  Widget _cell(
    BlockGrid grid,
    int x,
    int y,
    int robotX,
    int robotY,
    Facing facing,
    Set<String> collected,
    double cellSize,
  ) {
    final scheme = Theme.of(context).colorScheme;
    final isRobot = x == robotX && y == robotY;
    final hasCollision = isRobot && _current?.collided == true;
    final isGoal = x == grid.goal[0] && y == grid.goal[1];
    final isWall = grid.isWall(x, y);
    final isCollectible =
        grid.collectibles.any((c) => c[0] == x && c[1] == y) &&
        !collected.contains('$x,$y');

    final label = hasCollision
        ? 'روبو توقف أمام عائق'
        : isRobot
        ? 'روبو'
        : isWall
        ? 'عائق'
        : isGoal
        ? 'الهدف'
        : isCollectible
        ? 'نجمة'
        : 'خلية فارغة';

    return Semantics(
      label: label,
      child: Container(
        key: ValueKey('block_cell_${x}_$y'),
        width: cellSize,
        height: cellSize,
        margin: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          color: isWall
              ? scheme.errorContainer
              : isGoal
              ? scheme.tertiaryContainer
              : scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(6),
          border: hasCollision
              ? Border.all(color: scheme.error, width: 3)
              : null,
        ),
        alignment: Alignment.center,
        child: isRobot
            ? Stack(
                alignment: Alignment.center,
                children: [
                  // The robot picture stays upright; the arrow tells where it faces.
                  Padding(
                    padding: const EdgeInsets.all(2),
                    child: const GameArt(assetId: 'asset-robot-token'),
                  ),
                  if (hasCollision)
                    Positioned(
                      left: 1,
                      top: 1,
                      child: ExcludeSemantics(
                        child: Icon(
                          Icons.info_outline_rounded,
                          key: const Key('block_collision_indicator'),
                          size: 18,
                          color: scheme.error,
                        ),
                      ),
                    ),
                  Positioned(
                    right: 0,
                    bottom: 0,
                    child: Transform.rotate(
                      angle: switch (facing) {
                        Facing.north => 0,
                        Facing.east => 1.5708,
                        Facing.south => 3.1416,
                        Facing.west => 4.7124,
                      },
                      child: Icon(
                        Icons.navigation,
                        size: 16,
                        color: _current?.collided == true
                            ? scheme.error
                            : scheme.primary,
                      ),
                    ),
                  ),
                ],
              )
            : isWall
            ? const Padding(
                padding: EdgeInsets.all(3),
                child: GameArt(assetId: 'asset-obstacle-crate'),
              )
            : isGoal
            ? const Padding(
                padding: EdgeInsets.all(3),
                child: GameArt(assetId: 'asset-goal-token'),
              )
            : isCollectible
            ? const Icon(Icons.star, size: 20)
            : null,
      ),
    );
  }

  Widget _buildProgramStrip() {
    final strip = _editingFunction ? _function : _main;
    final highlight = _playing ? _current?.blockIndex : null;
    return Column(
      children: [
        if (_allowed.contains(BlockKind.function))
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('البرنامج')),
              ButtonSegment(value: true, label: Text('الدالة')),
            ],
            selected: {_editingFunction},
            onSelectionChanged: (value) =>
                setState(() => _editingFunction = value.first),
          ),
        const SizedBox(height: 8),
        Container(
          key: const Key('block_program_strip'),
          constraints: const BoxConstraints(minHeight: 56),
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            border: Border.all(
              color: Theme.of(context).colorScheme.outlineVariant,
            ),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              for (var index = 0; index < strip.length; index++)
                Container(
                  key: ValueKey('block_placed_$index'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: highlight == index && !_editingFunction
                        ? Theme.of(context).colorScheme.primaryContainer
                        : Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(8),
                    border: highlight == index && !_editingFunction
                        ? Border.all(
                            color: Theme.of(context).colorScheme.primary,
                            width: 2,
                          )
                        : null,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(strip[index].kind.icon, size: 18),
                      if (strip[index].kind == BlockKind.repeat)
                        Text(
                          ' ×${formatNumeral(strip[index].count, 'arabic_indic')}',
                        ),
                    ],
                  ),
                ),
              if (strip.isEmpty)
                Text(
                  'أضف أوامر من الأسفل',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Text(
            'الأوامر: ${_program.blockCount} من $_blockLimit',
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ),
      ],
    );
  }

  Widget _buildPalette(double target) {
    final actionStyle = ButtonStyle(
      minimumSize: WidgetStatePropertyAll(Size.square(target)),
    );
    final repeatValue = formatNumeral(_repeatCount, 'arabic_indic');

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (_allowed.contains(BlockKind.repeat)) ...[
          Semantics(
            key: const Key('block_repeat_count_selector'),
            container: true,
            label: 'عدد التكرار',
            value: '×$repeatValue',
            increasedValue: _repeatCount < _maxRepeatCount
                ? '×${formatNumeral(_repeatCount + 1, 'arabic_indic')}'
                : null,
            decreasedValue: _repeatCount > _minRepeatCount
                ? '×${formatNumeral(_repeatCount - 1, 'arabic_indic')}'
                : null,
            onIncrease: _repeatCount < _maxRepeatCount
                ? () => _changeRepeatCount(1)
                : null,
            onDecrease: _repeatCount > _minRepeatCount
                ? () => _changeRepeatCount(-1)
                : null,
            child: Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 8,
              runSpacing: 4,
              children: [
                IconButton(
                  key: const Key('block_repeat_count_decrease'),
                  style: actionStyle,
                  tooltip: 'تقليل عدد التكرار',
                  onPressed: _repeatCount > _minRepeatCount
                      ? () => _changeRepeatCount(-1)
                      : null,
                  icon: const Icon(Icons.remove),
                ),
                ExcludeSemantics(
                  child: Text(
                    'عدد التكرار: ×$repeatValue',
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
                IconButton(
                  key: const Key('block_repeat_count_increase'),
                  style: actionStyle,
                  tooltip: 'زيادة عدد التكرار',
                  onPressed: _repeatCount < _maxRepeatCount
                      ? () => _changeRepeatCount(1)
                      : null,
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
        ],
        Wrap(
          spacing: 8,
          runSpacing: 8,
          alignment: WrapAlignment.center,
          children: [
            for (final kind in _allowed)
              Semantics(
                button: true,
                // The label is translated text; the icon carries the meaning so no
                // word is baked into artwork.
                label: kind.label,
                child: InkWell(
                  key: ValueKey('block_palette_${kind.token}'),
                  onTap: () => _addBlock(kind),
                  child: Container(
                    constraints: BoxConstraints(
                      minWidth: target,
                      minHeight: target,
                    ),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(kind.icon, size: 22),
                        Text(
                          kind.label,
                          style: Theme.of(context).textTheme.labelSmall,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
