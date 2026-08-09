/// Wave 2 engines: `count_quantity`, `logic_pattern`, `word_build`.
///
/// Every mechanic here is read from the canonical contracts —
/// `docs/games/engines/05-count-quantity.md`, `09-logic-pattern.md`,
/// `07-word-build.md` — and the level shapes from the matching
/// `docs/games/schemas/*.v1.schema.json`. Nothing was invented; where a contract
/// is silent the engine does the least surprising thing and says so in a comment.
///
/// ## What these three have in common
///
/// A level holds one or more discrete questions, and the child answers by
/// choosing or placing. That makes the shared shape a per-item attempt counter and
/// a help ladder that escalates *within* an item, which is what the three error
/// tables describe. It also makes scoring identical in kind: correct on the first
/// try counts, and the help ladder is recorded rather than hidden.
///
/// ## What they deliberately do not share
///
/// `count_quantity` teaches on error by counting aloud. `logic_pattern` hints at
/// the rule and never at the answer. `word_build` speaks the next letter. These
/// are different pedagogies for different ages and are implemented separately on
/// purpose.
library;

import 'package:flutter/material.dart';

import 'game_board_kit.dart';
import 'game_engine_registry.dart';
import 'game_services.dart';
import 'game_session_controller.dart';

/// Voice keys these engines use, from the contracts' Arabic voice tables.
class WaveTwoVoiceKeys {
  static const recount = 'vo.recount';
  static const explainAnswer = 'vo.explain_answer';
  static const retry = 'vo.retry';
  static const hint = 'vo.hint';
  static const hint1 = 'vo.hint_1';
  static const hint2 = 'vo.hint_2';
  static const explainRule = 'vo.explain_rule';
  static const instructionExplain = 'vo.instruction_explain';
  static const word = 'vo.word';
  static const wordSyllables = 'vo.word_syllables';

  /// `vo.count.1` … `vo.count.20`.
  ///
  /// Recorded as separate clips, not one sentence, because the engine speaks them
  /// in step with highlighting each item. The count-quantity contract calls this
  /// out as a production requirement.
  static String count(int value) => 'vo.count.$value';
}

/// How far up the help ladder an item has climbed.
///
/// The three contracts share the shape — four rungs, each more generous — while
/// differing in what each rung does. Modelling the rung separately from its effect
/// keeps `help_used` reporting identical across engines.
enum ItemHelpRung { none, first, second, third, answerShown }

ItemHelpRung rungForWrongAttempts(int wrongAttempts) {
  if (wrongAttempts <= 0) return ItemHelpRung.none;
  if (wrongAttempts == 1) return ItemHelpRung.first;
  if (wrongAttempts == 2) return ItemHelpRung.second;
  if (wrongAttempts == 3) return ItemHelpRung.third;
  return ItemHelpRung.answerShown;
}

// ------------------------------------------------------------- count_quantity

class CountQuantityEngine extends GameEngine {
  const CountQuantityEngine();

  @override
  String get engineId => 'count_quantity';

  /// Choices and a box are both D-pad reachable, and the contract marks
  /// `supports_dpad` true.
  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _CountQuantityBoard(controller: controller);
}

class _CountQuantityBoard extends StatefulWidget {
  const _CountQuantityBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_CountQuantityBoard> createState() => _CountQuantityBoardState();
}

class _CountQuantityBoardState extends State<_CountQuantityBoard> {
  int _itemIndex = 0;
  int _wrongAttempts = 0;
  int _correctFirstTry = 0;
  bool _anyHelpUsed = false;

  /// Index of the item being spoken during a guided count, or null.
  int? _countingHighlight;

  /// Items moved into the box, for `drag_amount`.
  int _inBox = 0;

  /// One fewer element to count, applied at the third rung.
  int _countReduction = 0;

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  String get _mode => str(_level, 'mode');
  List<Map<String, dynamic>> get _items => mapList(_level['items']);
  String get _numeralSystem {
    final value = _level['numeral_system'];
    return value is String ? value : 'auto';
  }

  bool get _recountAllowed => _level['allow_recount_button'] != false;
  bool get _countAloudOnError => _level['count_aloud_on_error'] != false;

  Map<String, dynamic>? get _item =>
      _itemIndex < _items.length ? _items[_itemIndex] : null;

  /// Total elements shown for a counting item, after any reduction.
  int _shownCount(Map<String, dynamic> item) {
    final sets = mapList(item['items']);
    final total = sets.fold<int>(0, (sum, set) => sum + intOr(set, 'count', 0));
    final reduced = total - _countReduction;
    return reduced < 1 ? 1 : reduced;
  }

  /// The expected answer, which moves with the reduction so the easier board is
  /// still asking a true question.
  Object? _expectedAnswer(Map<String, dynamic> item) {
    final answer = item['answer'];
    if (_countReduction > 0 && answer is num) {
      final reduced = answer.toInt() - _countReduction;
      return reduced < 1 ? 1 : reduced;
    }
    return answer;
  }

  /// Options still offered. The second rung removes wrong ones.
  List<Object?> _visibleOptions(Map<String, dynamic> item) {
    final options = (item['options'] as List<dynamic>? ?? const []).toList();
    if (_countReduction > 0) {
      // A reduced board needs its own options, since the authored ones no longer
      // contain the answer.
      final answer = _expectedAnswer(item);
      if (answer is int) {
        final generated = <int>{answer, answer + 1, if (answer > 1) answer - 1};
        return generated.toList()..sort();
      }
    }
    return options;
  }

  bool _isEliminated(Map<String, dynamic> item, Object? option) {
    if (rungForWrongAttempts(_wrongAttempts).index < ItemHelpRung.second.index) {
      return false;
    }
    return option != _expectedAnswer(item);
  }

  Future<void> _countAloud(Map<String, dynamic> item) async {
    if (!_countAloudOnError) return;
    final total = _shownCount(item);
    for (var index = 0; index < total; index++) {
      if (!mounted) return;
      setState(() => _countingHighlight = index);
      await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.count(index + 1));
    }
    if (!mounted) return;
    setState(() => _countingHighlight = null);
  }

  Future<void> _recount() async {
    final item = _item;
    if (item == null) return;
    _anyHelpUsed = true;
    await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.recount);
    await _countAloud(item);
  }

  Future<void> _answer(Object? option) async {
    final item = _item;
    if (item == null) return;
    if (option == _expectedAnswer(item)) {
      if (_wrongAttempts == 0 && _countReduction == 0) _correctFirstTry++;
      widget.controller.feedback
          .emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);
      await _nextItem();
      return;
    }

    // Wrong. The contract is explicit that this is a teaching moment, so nothing
    // negative is said and the board becomes more helpful instead.
    _wrongAttempts++;
    _anyHelpUsed = true;
    final rung = rungForWrongAttempts(_wrongAttempts);
    setState(() {});
    switch (rung) {
      case ItemHelpRung.first:
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.recount);
        await _countAloud(item);
      case ItemHelpRung.second:
        // Only the correct numbers remain among the options.
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.hint);
      case ItemHelpRung.third:
        setState(() => _countReduction = 1);
        await _countAloud(item);
      case ItemHelpRung.answerShown:
        await _countAloud(item);
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.explainAnswer);
        await _nextItem();
      case ItemHelpRung.none:
        break;
    }
  }

  Future<void> _nextItem() async {
    if (_itemIndex + 1 >= _items.length) {
      await _finish();
      return;
    }
    setState(() {
      _itemIndex++;
      _wrongAttempts = 0;
      _countReduction = 0;
      _inBox = 0;
      _countingHighlight = null;
    });
  }

  Future<void> _finish() async {
    await widget.controller.reportEngineAttempt(
      // The contract: items correct on the first attempt, out of the item count.
      score: _correctFirstTry,
      maxScore: _items.length,
      helpUsed: _anyHelpUsed,
      answers: [
        {
          'mode': _mode,
          'items_total': _items.length,
          'items_correct_first_try': _correctFirstTry,
        },
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    if (item == null) {
      return BoardScaffold(
        controller: widget.controller,
        prompt: widget.controller.prompt,
        child: const Center(child: Text('لا توجد بنود في هذا المستوى')),
      );
    }

    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      footer: _recountAllowed
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: OutlinedButton.icon(
                // Always visible, per the accessibility section — not gated on
                // having got something wrong.
                key: const Key('count_recount_button'),
                onPressed: _recount,
                icon: const Icon(Icons.replay_outlined),
                label: const Text('أعد العدّ'),
                style: ButtonStyle(
                  minimumSize: WidgetStatePropertyAll(Size(target, target)),
                ),
              ),
            )
          : null,
      child: switch (_mode) {
        'compare_sets' => _buildCompare(item, target),
        'pattern_fill' => _buildPattern(item, target),
        'drag_amount' => _buildDragAmount(item, target),
        _ => _buildCountAndPick(item, target),
      },
    );
  }

  /// A fixed grid of identical elements.
  ///
  /// Laid out in a grid with a stable order and no animation: the contract
  /// requires that elements do not move while a child is counting them.
  Widget _elementGrid(Map<String, dynamic> item, {required int count}) {
    final sets = mapList(item['items']);
    final asset = sets.isEmpty ? '' : str(sets.first, 'image');
    return GridView.builder(
      key: const Key('count_element_grid'),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 5,
        mainAxisSpacing: 8,
        crossAxisSpacing: 8,
      ),
      itemCount: count,
      itemBuilder: (context, index) {
        final highlighted = _countingHighlight == index;
        return Semantics(
          label: '$asset ${index + 1}',
          child: Container(
            key: ValueKey('count_element_$index'),
            decoration: BoxDecoration(
              color: highlighted
                  ? Theme.of(context).colorScheme.primaryContainer
                  : Theme.of(context).colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(12),
              border: highlighted
                  ? Border.all(color: Theme.of(context).colorScheme.primary, width: 3)
                  : null,
            ),
            alignment: Alignment.center,
            child: const Icon(Icons.star_outline),
          ),
        );
      },
    );
  }

  /// Numeral plus its written name.
  ///
  /// The accessibility section asks for both. The name is derived from the
  /// numeral, not translated content, so it stays correct without a string file.
  Widget _numberLabel(int value) {
    return Text(
      formatNumeral(value, _numeralSystem),
      textAlign: TextAlign.center,
      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
    );
  }

  Widget _optionRow(Map<String, dynamic> item, double target) {
    final options = _visibleOptions(item);
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      alignment: WrapAlignment.center,
      children: [
        for (final option in options)
          SizedBox(
            width: target + 24,
            child: ChoiceTile(
              key: ValueKey('count_option_$option'),
              label: option is int
                  ? formatNumeral(option, _numeralSystem)
                  : option.toString(),
              semanticsLabel: option.toString(),
              selected: false,
              eliminated: _isEliminated(item, option),
              touchTarget: target,
              onPressed: () => _answer(option),
            ),
          ),
      ],
    );
  }

  Widget _buildCountAndPick(Map<String, dynamic> item, double target) {
    return SingleChildScrollView(
      child: Column(
        children: [
          _elementGrid(item, count: _shownCount(item)),
          const SizedBox(height: 16),
          _optionRow(item, target),
        ],
      ),
    );
  }

  Widget _buildDragAmount(Map<String, dynamic> item, double target) {
    final available = _shownCount(item);
    final required = _expectedAnswer(item);
    return SingleChildScrollView(
      child: Column(
        children: [
          // Tapping an element then the box is the primary interaction, not a
          // fallback: the contract lists it as the drag alternative and a
          // preschool hand is more reliable at tapping than dragging.
          Wrap(
            spacing: 8,
            runSpacing: 8,
            alignment: WrapAlignment.center,
            children: [
              for (var index = 0; index < available - _inBox; index++)
                InkWell(
                  key: ValueKey('drag_source_$index'),
                  onTap: () => setState(() => _inBox++),
                  child: Container(
                    width: target,
                    height: target,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    alignment: Alignment.center,
                    child: const Icon(Icons.star_outline),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            key: const Key('drag_box'),
            height: target * 2,
            decoration: BoxDecoration(
              border: Border.all(
                color: Theme.of(context).colorScheme.outline,
                width: 2,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Semantics(
              liveRegion: true,
              child: _numberLabel(_inBox),
            ),
          ),
          const SizedBox(height: 8),
          if (_inBox > 0)
            TextButton(
              key: const Key('drag_take_back'),
              onPressed: () => setState(() => _inBox--),
              child: const Text('أرجع واحدًا'),
            ),
          const SizedBox(height: 8),
          FilledButton(
            key: const Key('drag_confirm'),
            onPressed: () => _answer(_inBox == required ? required : _inBox),
            style: ButtonStyle(
              minimumSize: WidgetStatePropertyAll(Size(target * 2, target)),
            ),
            child: const Text('انتهيت'),
          ),
        ],
      ),
    );
  }

  Widget _buildCompare(Map<String, dynamic> item, double target) {
    Widget setColumn(String key, String label) {
      final set = item[key];
      final count = set is Map ? intOr(Map<String, dynamic>.from(set), 'count', 0) : 0;
      return Expanded(
        child: Column(
          children: [
            Text(label, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              alignment: WrapAlignment.center,
              children: [
                for (var index = 0; index < count; index++)
                  const Icon(Icons.star_outline, size: 24),
              ],
            ),
          ],
        ),
      );
    }

    final labels = {
      'set_a': 'المجموعة الأولى',
      'set_b': 'المجموعة الثانية',
      'equal': 'متساويتان',
    };

    return SingleChildScrollView(
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              setColumn('set_a', labels['set_a']!),
              const SizedBox(width: 12),
              setColumn('set_b', labels['set_b']!),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: [
              for (final option in _visibleOptions(item))
                SizedBox(
                  width: target * 2,
                  child: ChoiceTile(
                    key: ValueKey('compare_option_$option'),
                    label: labels[option] ?? option.toString(),
                    selected: false,
                    eliminated: _isEliminated(item, option),
                    touchTarget: target,
                    onPressed: () => _answer(option),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPattern(Map<String, dynamic> item, double target) {
    final sequence = nullableInts(item['sequence']);
    return SingleChildScrollView(
      child: Column(
        children: [
          Wrap(
            spacing: 12,
            alignment: WrapAlignment.center,
            children: [
              for (var index = 0; index < sequence.length; index++)
                Container(
                  key: ValueKey('pattern_cell_$index'),
                  width: target,
                  height: target,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(12),
                    border: sequence[index] == null
                        ? Border.all(
                            color: Theme.of(context).colorScheme.primary,
                            width: 3,
                          )
                        : null,
                  ),
                  alignment: Alignment.center,
                  child: sequence[index] == null
                      ? const Text('؟', style: TextStyle(fontSize: 22))
                      : _numberLabel(sequence[index]!),
                ),
            ],
          ),
          const SizedBox(height: 16),
          _optionRow(item, target),
        ],
      ),
    );
  }
}

// -------------------------------------------------------------- logic_pattern

class LogicPatternEngine extends GameEngine {
  const LogicPatternEngine();

  @override
  String get engineId => 'logic_pattern';

  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _LogicPatternBoard(controller: controller);
}

class _LogicPatternBoard extends StatefulWidget {
  const _LogicPatternBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_LogicPatternBoard> createState() => _LogicPatternBoardState();
}

/// Which half of the level the child is on.
enum _LogicStage { choose, explain, done }

class _LogicPatternBoardState extends State<_LogicPatternBoard> {
  _LogicStage _stage = _LogicStage.choose;
  int _wrongAttempts = 0;
  bool _answerCorrectFirstTry = false;
  bool _explanationCorrect = false;
  bool _anyHelpUsed = false;
  bool _dimensionsHighlighted = false;
  final Set<String> _eliminated = {};

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  String get _mode => str(_level, 'mode');
  List<String> get _options =>
      (_level['options'] as List<dynamic>? ?? const []).whereType<String>().toList();
  String get _answer => str(_level, 'answer');
  List<String> get _changingDimensions => (_level['changing_dimensions'] as List<dynamic>? ?? const [])
      .whereType<String>()
      .toList();

  bool get _requiresExplanation => _level['require_explanation'] == true;
  List<String> get _explainOptions => (_level['explain_options'] as List<dynamic>? ?? const [])
      .whereType<String>()
      .toList();
  String get _explainAnswer => str(_level, 'explain_answer');

  /// `max_score` is 1 without an explanation stage and 2 with one.
  ///
  /// This is what makes "a correct explanation is required to reach
  /// `independent`" true without any extra rule: an unexplained correct answer
  /// scores 1 of 2, which is 50% and cannot reach the 80% the mastery ladder
  /// requires. The pedagogy is enforced by the score model, not by a special case.
  int get _maxScore => _requiresExplanation ? 2 : 1;

  Future<void> _choose(String option) async {
    if (option == _answer) {
      if (_wrongAttempts == 0) _answerCorrectFirstTry = true;
      widget.controller.feedback
          .emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);
      if (_requiresExplanation) {
        setState(() => _stage = _LogicStage.explain);
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.instructionExplain);
        return;
      }
      await _finish();
      return;
    }

    _wrongAttempts++;
    _anyHelpUsed = true;
    // The ladder points at the rule, never at the answer, until the last rung.
    switch (rungForWrongAttempts(_wrongAttempts)) {
      case ItemHelpRung.first:
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.retry);
      case ItemHelpRung.second:
        setState(() => _dimensionsHighlighted = true);
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.hint2);
      case ItemHelpRung.third:
        final wrong = _options.where((o) => o != _answer).take(2);
        setState(() => _eliminated.addAll(wrong));
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.hint2);
      case ItemHelpRung.answerShown:
        await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.explainRule);
        setState(() => _eliminated
          ..clear()
          ..addAll(_options.where((o) => o != _answer)));
      case ItemHelpRung.none:
        break;
    }
  }

  Future<void> _explain(String option) async {
    _explanationCorrect = option == _explainAnswer;
    if (!_explanationCorrect) {
      _anyHelpUsed = true;
      await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.explainRule);
    }
    await _finish();
  }

  Future<void> _finish() async {
    setState(() => _stage = _LogicStage.done);
    final score = (_answerCorrectFirstTry ? 1 : 0) +
        (_requiresExplanation && _explanationCorrect ? 1 : 0);
    await widget.controller.reportEngineAttempt(
      score: score,
      maxScore: _maxScore,
      helpUsed: _anyHelpUsed,
      answers: [
        {
          'mode': _mode,
          'answer_correct_first_try': _answerCorrectFirstTry,
          'explanation_required': _requiresExplanation,
          'explanation_correct': _requiresExplanation ? _explanationCorrect : null,
          'changing_dimensions': _changingDimensions.length,
        },
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  /// A cell, distinguished by glyph and text rather than by colour.
  Widget _cell(String? assetId, {required int patternSeed}) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      // Every cell has a text alternative, which the contract requires.
      label: assetId ?? 'الخلية الناقصة',
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(12),
          border: assetId == null
              ? Border.all(color: scheme.primary, width: 3)
              : _dimensionsHighlighted
                  ? Border.all(color: scheme.tertiary, width: 2)
                  : null,
        ),
        alignment: Alignment.center,
        child: assetId == null
            ? const Text('؟', style: TextStyle(fontSize: 24))
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(nonColourGlyph(patternSeed), size: 22),
                  Text(
                    assetId,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.labelSmall,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildPuzzle() {
    final grid = _level['grid'];
    if (grid is List && grid.isNotEmpty) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var row = 0; row < grid.length; row++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (final cell in nullableStrings(grid[row]))
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: _cell(cell, patternSeed: cell?.hashCode ?? row),
                    ),
                ],
              ),
            ),
        ],
      );
    }

    final sequence = nullableStrings(_level['sequence']);
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      alignment: WrapAlignment.center,
      children: [
        for (var index = 0; index < sequence.length; index++)
          _cell(sequence[index], patternSeed: sequence[index]?.hashCode ?? index),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    final explaining = _stage == _LogicStage.explain;

    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      child: SingleChildScrollView(
        child: Column(
          children: [
            _buildPuzzle(),
            const SizedBox(height: 20),
            if (explaining)
              Column(
                children: [
                  Text(
                    'أي قاعدة استخدمت؟',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 12),
                  for (final option in _explainOptions)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: ChoiceTile(
                        key: ValueKey('logic_explain_$option'),
                        label: option,
                        selected: false,
                        touchTarget: target,
                        onPressed: () => _explain(option),
                      ),
                    ),
                ],
              )
            else if (_stage == _LogicStage.choose)
              Wrap(
                spacing: 12,
                runSpacing: 12,
                alignment: WrapAlignment.center,
                children: [
                  for (var index = 0; index < _options.length; index++)
                    SizedBox(
                      width: 96,
                      child: ChoiceTile(
                        key: ValueKey('logic_option_${_options[index]}'),
                        label: _options[index],
                        patternIndex: _options[index].hashCode,
                        selected: false,
                        eliminated: _eliminated.contains(_options[index]),
                        touchTarget: target,
                        onPressed: () => _choose(_options[index]),
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

// ----------------------------------------------------------------- word_build

/// Zero-width joiner. Forces a letter to render in a joining form without needing
/// the Arabic Presentation Forms-B block or a font-specific hack.
const _zwj = '\u200D';

/// The letter as it appears *in the word*.
///
/// `docs/games/engines/07-word-build.md` is emphatic: «ق» in «قمر» differs in
/// shape from an isolated «ق», and ignoring `form` teaches the wrong shape. A
/// letter rendered on its own always draws isolated, so the joining form has to be
/// requested explicitly.
String arabicFormGlyph(String char, String? form) {
  switch (form) {
    case 'initial':
      return '$char$_zwj';
    case 'medial':
      return '$_zwj$char$_zwj';
    case 'final':
      return '$_zwj$char';
    default:
      return char;
  }
}

class WordBuildEngine extends GameEngine {
  const WordBuildEngine();

  @override
  String get engineId => 'word_build';

  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _WordBuildBoard(controller: controller);
}

class _WordBuildBoard extends StatefulWidget {
  const _WordBuildBoard({required this.controller});
  final GameSessionController controller;

  @override
  State<_WordBuildBoard> createState() => _WordBuildBoardState();
}

class _WordBuildBoardState extends State<_WordBuildBoard> {
  /// Slot index -> the tile placed there.
  final Map<int, _LetterTile> _placed = {};

  /// Tile the child has picked up, for the tap-then-tap alternative.
  _LetterTile? _selected;

  int _wrongAttempts = 0;
  bool _anyHelpUsed = false;
  bool _showWordText = false;
  bool _hideDistractors = false;
  int? _glowingSlot;

  late List<_LetterTile> _tray;

  @override
  void initState() {
    super.initState();
    _buildTray();
  }

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  String get _word => str(_level, 'word');
  int get _slots => intOr(_level, 'slots', _word.characters.length);
  bool get _isRtl => str(_level, 'writing_direction') != 'ltr';
  String get _language => str(_level, 'language');

  void _buildTray() {
    final letters = mapList(_level['letters'])
        .map((json) => _LetterTile.fromJson(json, isDistractor: false))
        .toList();
    final distractors = mapList(_level['distractors'])
        .map((json) => _LetterTile.fromJson(json, isDistractor: true))
        .toList();
    _tray = seededShuffle(
      [...letters, ...distractors],
      widget.controller.gameId.hashCode + widget.controller.levelIndex,
    );
  }

  List<_LetterTile> get _visibleTray {
    final placed = _placed.values.toSet();
    return _tray
        .where((tile) => !placed.contains(tile))
        .where((tile) => !(_hideDistractors && tile.isDistractor))
        .toList(growable: false);
  }

  /// The next empty slot, in writing order.
  int? get _nextSlot {
    for (var index = 0; index < _slots; index++) {
      if (!_placed.containsKey(index)) return index;
    }
    return null;
  }

  _LetterTile? get _nextCorrectTile {
    final slot = _nextSlot;
    if (slot == null) return null;
    return _tray.firstWhere(
      (tile) => !tile.isDistractor && tile.position == slot + 1,
      orElse: () => _tray.first,
    );
  }

  Future<void> _place(int slotIndex, _LetterTile tile) async {
    final correct = !tile.isDistractor && tile.position == slotIndex + 1;
    if (!correct) {
      // Bounces back. Nothing negative is said, and there is no attempt limit.
      _wrongAttempts++;
      _anyHelpUsed = true;
      setState(() => _selected = null);
      switch (rungForWrongAttempts(_wrongAttempts)) {
        case ItemHelpRung.first:
          await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.retry);
        case ItemHelpRung.second:
          final next = _nextCorrectTile;
          if (next != null) {
            setState(() => _glowingSlot = _nextSlot);
            await widget.controller.speakVoiceKey(next.audioKey);
          }
        case ItemHelpRung.third:
          setState(() => _hideDistractors = true);
          await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.hint);
        case ItemHelpRung.answerShown:
          final next = _nextCorrectTile;
          final slot = _nextSlot;
          if (next != null && slot != null) {
            setState(() => _placed[slot] = next);
            await widget.controller.speakVoiceKey(WaveTwoVoiceKeys.word);
          }
          await _checkComplete();
        case ItemHelpRung.none:
          break;
      }
      return;
    }

    setState(() {
      _placed[slotIndex] = tile;
      _selected = null;
      _glowingSlot = null;
    });
    widget.controller.feedback
        .emit(FeedbackEvent.strokeComplete, track: widget.controller.ageTrack);
    await _checkComplete();
  }

  Future<void> _checkComplete() async {
    if (_placed.length < _slots) return;
    await widget.controller.reportEngineAttempt(
      // One word per level, so the contract's "words correct on the first
      // attempt out of the word count" is 1 of 1 here.
      score: _wrongAttempts == 0 ? 1 : 0,
      maxScore: 1,
      helpUsed: _anyHelpUsed,
      answers: [
        {
          'language': _language,
          'letters': _slots,
          'wrong_placements': _wrongAttempts,
          // The word itself is authored content, not child input, so recording
          // its length rather than the word keeps the payload free of anything
          // the child produced.
          'word_length': _word.characters.length,
        },
      ],
    );
    await widget.controller.finishLevelFromEngine();
  }

  @override
  Widget build(BuildContext context) {
    final target = effectiveTouchTarget(widget.controller.pack.accessibility);
    return BoardScaffold(
      controller: widget.controller,
      prompt: widget.controller.prompt,
      footer: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            OutlinedButton.icon(
              // Mandatory: it is what makes the game playable without hearing.
              key: const Key('word_show_text_button'),
              onPressed: () => setState(() => _showWordText = !_showWordText),
              icon: const Icon(Icons.text_fields_outlined),
              label: Text(_showWordText ? 'أخفِ الكلمة' : 'اعرض الكلمة مكتوبة'),
              style: ButtonStyle(
                minimumSize: WidgetStatePropertyAll(Size(target, target)),
              ),
            ),
            const SizedBox(width: 12),
            IconButton(
              key: const Key('word_play_audio_button'),
              onPressed: () => widget.controller.speakVoiceKey(WaveTwoVoiceKeys.word),
              icon: const Icon(Icons.volume_up_outlined),
              tooltip: 'اسمع الكلمة',
            ),
          ],
        ),
      ),
      child: SingleChildScrollView(
        child: Column(
          children: [
            if (_showWordText)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _word,
                  key: const Key('word_text_reveal'),
                  // Scalable to 2.0x per the accessibility section; the theme's
                  // text scaler applies on top of this size.
                  style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
                ),
              ),
            // The slot row follows the *word's* direction, from the pack, never
            // the interface direction.
            Directionality(
              textDirection: _isRtl ? TextDirection.rtl : TextDirection.ltr,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var index = 0; index < _slots; index++)
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: _slotBox(index, target),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              alignment: WrapAlignment.center,
              children: [
                for (final tile in _visibleTray)
                  _trayTile(tile, target),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _slotBox(int index, double target) {
    final tile = _placed[index];
    final glowing = _glowingSlot == index;
    return DragTarget<_LetterTile>(
      onAcceptWithDetails: (details) => _place(index, details.data),
      builder: (context, candidate, rejected) {
        return Semantics(
          label: 'خانة ${index + 1}',
          child: InkWell(
            key: ValueKey('word_slot_$index'),
            // Tap-to-place: the mandatory drag alternative.
            onTap: () {
              final selected = _selected;
              if (selected != null) _place(index, selected);
            },
            child: Container(
              width: target,
              height: target,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: glowing
                      ? Theme.of(context).colorScheme.primary
                      : Theme.of(context).colorScheme.outlineVariant,
                  width: glowing ? 3 : 1,
                ),
              ),
              alignment: Alignment.center,
              child: tile == null
                  ? null
                  : Text(
                      arabicFormGlyph(tile.char, tile.form),
                      style: const TextStyle(fontSize: 26),
                    ),
            ),
          ),
        );
      },
    );
  }

  Widget _trayTile(_LetterTile tile, double target) {
    final selected = _selected == tile;
    final child = Container(
      width: target,
      height: target,
      decoration: BoxDecoration(
        color: selected
            ? Theme.of(context).colorScheme.primaryContainer
            : Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: selected
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.outline,
          width: selected ? 3 : 1,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        arabicFormGlyph(tile.char, tile.form),
        style: const TextStyle(fontSize: 26),
      ),
    );

    return Semantics(
      button: true,
      selected: selected,
      label: tile.char,
      child: Draggable<_LetterTile>(
        data: tile,
        feedback: Material(color: Colors.transparent, child: child),
        childWhenDragging: Opacity(opacity: 0.3, child: child),
        child: InkWell(
          key: ValueKey('word_tile_${tile.char}_${tile.position}'),
          onTap: () {
            setState(() => _selected = selected ? null : tile);
            widget.controller.speakVoiceKey(tile.audioKey);
          },
          child: child,
        ),
      ),
    );
  }
}

class _LetterTile {
  const _LetterTile({
    required this.char,
    required this.audioKey,
    required this.isDistractor,
    this.form,
    this.position,
  });

  factory _LetterTile.fromJson(Map<String, dynamic> json, {required bool isDistractor}) {
    return _LetterTile(
      char: str(json, 'char'),
      form: json['form'] is String ? json['form'] as String : null,
      position: json['position'] is num ? (json['position'] as num).toInt() : null,
      audioKey: str(json, 'audio'),
      isDistractor: isDistractor,
    );
  }

  final String char;
  final String? form;
  final int? position;
  final String audioKey;
  final bool isDistractor;
}
