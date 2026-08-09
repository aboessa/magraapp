/// `sim_lab` — predict, experiment, explain.
///
/// Contract: `docs/games/engines/11-sim-lab.md`, level shape
/// `docs/games/schemas/sim_lab.v1.schema.json`.
///
/// ## The decisive pedagogical rule
///
/// «التوقع الخاطئ **ليس فشلًا** ولا يُخصم. يُسجَّل كتعلّم. **التفسير** هو ما
/// يُقاس.» A wrong prediction is not a failure and is never deducted; the
/// explanation is what is measured. So the prediction is recorded and reported,
/// and `score` counts the explanation alone, out of a `max_score` of 1.
///
/// ## Where the numbers come from
///
/// [SimModel] derives the measured value from the level's own
/// `expected_relationships` — `positive`, `negative`, `none`, `saturating`. The
/// *relationship* is authored content and is the thing being taught; the
/// magnitudes are a monotonic illustration of it, which is why every simulation
/// still requires the scientific review the contract mandates before publish. The
/// engine does not invent a physical constant and does not claim to.
///
/// `pendulum` is the reason the `none` relationship exists: mass genuinely does not
/// affect the period, and a simulation is the only practical way to show a child
/// that a variable can have no effect.
library;

import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'game_board_kit.dart';
import 'game_engine_registry.dart';
import 'game_services.dart';
import 'game_session_controller.dart';

/// A variable the child can move.
class SimVariable {
  const SimVariable({
    required this.id,
    required this.labelKey,
    required this.min,
    required this.max,
    required this.step,
    required this.unitKey,
  });

  factory SimVariable.fromJson(Map<String, dynamic> json) => SimVariable(
        id: str(json, 'id'),
        labelKey: str(json, 'label_key'),
        min: doubleOr(json, 'min', 0),
        max: doubleOr(json, 'max', 1),
        step: doubleOr(json, 'step', 1),
        unitKey: str(json, 'unit_key'),
      );

  final String id;
  final String labelKey;
  final double min;
  final double max;
  final double step;
  final String unitKey;

  /// Position of [value] within the range, 0..1.
  double normalize(double value) {
    final span = max - min;
    if (span <= 0) return 0;
    return ((value - min) / span).clamp(0.0, 1.0);
  }
}

/// Turns variable settings into the measured value.
///
/// Pure, so the relationships are assertable: a `none` variable must not move the
/// result at all, which is the one property this engine absolutely must get right.
class SimModel {
  const SimModel({required this.variables, required this.relationships});

  final List<SimVariable> variables;

  /// Variable id -> `positive` | `negative` | `none` | `saturating`.
  final Map<String, String> relationships;

  /// The measured value for [settings], on an arbitrary but monotonic scale.
  double measure(Map<String, double> settings) {
    var total = 0.0;
    var contributing = 0;
    for (final variable in variables) {
      final relationship = relationships[variable.id] ?? 'none';
      if (relationship == 'none') continue;
      final norm = variable.normalize(settings[variable.id] ?? variable.min);
      contributing++;
      switch (relationship) {
        case 'positive':
          total += norm;
        case 'negative':
          total += 1 - norm;
        case 'saturating':
          // Rises quickly then flattens. `plant_growth` is described as طردية ثم
          // تشبّع — proportional, then saturating.
          total += 1 - math.exp(-3 * norm);
      }
    }
    if (contributing == 0) {
      // Every variable is irrelevant. A constant reading is the correct and the
      // whole point: the child should observe nothing changing.
      return 1.0;
    }
    return 1 + 9 * (total / contributing);
  }

  /// Whether [id] has any effect, which the results table needs in order not to
  /// imply one.
  bool affects(String id) => (relationships[id] ?? 'none') != 'none';
}

class SimTrial {
  const SimTrial({required this.settings, required this.measured});
  final Map<String, double> settings;
  final double measured;
}

class SimLabEngine extends GameEngine {
  const SimLabEngine();

  @override
  String get engineId => 'sim_lab';

  /// The contract lists +/- buttons as the slider alternative, which is D-pad
  /// reachable.
  @override
  bool get supportsDpad => true;

  @override
  Widget build(BuildContext context, GameSessionController controller) =>
      _SimLabSurface(controller: controller);
}

class _SimLabSurface extends StatefulWidget {
  const _SimLabSurface({required this.controller});
  final GameSessionController controller;

  @override
  State<_SimLabSurface> createState() => _SimLabSurfaceState();
}

enum _SimStage { predict, experiment, explain, done }

class _SimLabSurfaceState extends State<_SimLabSurface> {
  _SimStage _stage = _SimStage.predict;
  String? _prediction;
  final Map<String, double> _settings = {};
  final List<SimTrial> _trials = [];
  int _wrongExplanations = 0;
  bool _explanationCorrect = false;
  final Set<String> _eliminated = {};
  bool _tableHighlighted = false;

  @override
  void initState() {
    super.initState();
    for (final variable in _variables) {
      _settings[variable.id] = variable.min;
    }
  }

  Map<String, dynamic> get _level => widget.controller.rawLevel;
  String get _sim => str(_level, 'sim');

  List<SimVariable> get _variables =>
      mapList(_level['variables']).map(SimVariable.fromJson).toList();

  Map<String, dynamic> get _measured {
    final raw = _level['measured'];
    return raw is Map ? Map<String, dynamic>.from(raw) : const {};
  }

  Map<String, String> get _relationships {
    final raw = _level['expected_relationships'];
    if (raw is! Map) return const {};
    return {
      for (final entry in raw.entries)
        entry.key.toString(): entry.value is String ? entry.value as String : 'none',
    };
  }

  List<String> get _hypothesisOptions =>
      (_level['hypothesis_options'] as List<dynamic>? ?? const []).whereType<String>().toList();
  List<String> get _explanationOptions =>
      (_level['explanation_options'] as List<dynamic>? ?? const []).whereType<String>().toList();
  String get _explanationAnswer => str(_level, 'explanation_answer');
  int get _minTrials => intOr(_level, 'min_trials_before_explain', 2);
  String get _supervision => str(_level, 'supervision_level');
  String? get _safetyNoteKey {
    final value = _level['safety_note_key'];
    return value is String && value.isNotEmpty ? value : null;
  }

  SimModel get _model => SimModel(variables: _variables, relationships: _relationships);

  bool get _canExplain => _trials.length >= _minTrials;

  Future<void> _predict(String option) async {
    setState(() {
      _prediction = option;
      _stage = _SimStage.experiment;
    });
    // Recorded, never judged. Nothing here checks it against the relationships.
    await widget.controller.speakVoiceKey('vo.prediction_recorded');
    await widget.controller.speakVoiceKey('vo.stage_experiment');
  }

  Future<void> _runTrial() async {
    final measured = _model.measure(_settings);
    setState(() => _trials.add(SimTrial(settings: Map.of(_settings), measured: measured)));
    await widget.controller.speakVoiceKey('vo.trial_recorded');
  }

  Future<void> _goToExplain() async {
    if (!_canExplain) {
      await widget.controller.speakVoiceKey('vo.need_more_trials');
      return;
    }
    setState(() => _stage = _SimStage.explain);
    await widget.controller.speakVoiceKey('vo.stage_explain');
  }

  Future<void> _explain(String option) async {
    if (option == _explanationAnswer) {
      _explanationCorrect = true;
      await _finish();
      return;
    }
    _wrongExplanations++;
    switch (_wrongExplanations) {
      case 1:
        await widget.controller.speakVoiceKey('vo.hint');
      case 2:
        setState(() => _tableHighlighted = true);
        await widget.controller.speakVoiceKey('vo.retry_explain');
      case 3:
        final wrong = _explanationOptions.firstWhere(
          (o) => o != _explanationAnswer && !_eliminated.contains(o),
          orElse: () => '',
        );
        if (wrong.isNotEmpty) setState(() => _eliminated.add(wrong));
        await widget.controller.speakVoiceKey('vo.retry_explain');
      default:
        await widget.controller.speakVoiceKey('vo.explain_final');
        await _finish();
    }
    setState(() {});
  }

  Future<void> _finish() async {
    setState(() => _stage = _SimStage.done);
    await widget.controller.reportEngineAttempt(
      // The explanation alone. A wrong prediction cannot reduce this.
      score: _explanationCorrect ? 1 : 0,
      maxScore: 1,
      helpUsed: _wrongExplanations > 0,
      answers: [
        {
          'sim': _sim,
          'trials': _trials.length,
          'explanation_correct': _explanationCorrect,
          'wrong_explanations': _wrongExplanations,
          // Recorded as learning, exactly as the contract asks, and never scored.
          'prediction_recorded': _prediction != null,
          'prediction_matched_outcome': _prediction == null
              ? null
              : _prediction == _explanationAnswer,
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
      header: _supervision == 'required' && _safetyNoteKey != null
          ? Container(
              key: const Key('sim_safety_banner'),
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(Icons.shield_outlined),
                  const SizedBox(width: 8),
                  Expanded(child: Text(_safetyNoteKey!)),
                ],
              ),
            )
          : null,
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _stageIndicator(),
            const SizedBox(height: 12),
            switch (_stage) {
              _SimStage.predict => _buildPredict(target),
              _SimStage.experiment => _buildExperiment(target),
              _SimStage.explain => _buildExplain(target),
              _SimStage.done => _buildDone(),
            },
          ],
        ),
      ),
    );
  }

  Widget _stageIndicator() {
    const labels = ['توقّع', 'جرّب', 'فسّر'];
    final active = switch (_stage) {
      _SimStage.predict => 0,
      _SimStage.experiment => 1,
      _SimStage.explain => 2,
      _SimStage.done => 2,
    };
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var index = 0; index < labels.length; index++) ...[
          if (index > 0) const Icon(Icons.chevron_right, size: 18),
          Text(
            labels[index],
            style: TextStyle(
              fontWeight: index == active ? FontWeight.bold : FontWeight.normal,
              decoration: index < active ? TextDecoration.lineThrough : null,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPredict(double target) {
    return Column(
      children: [
        Text('ما توقعك؟', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 12),
        for (final option in _hypothesisOptions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ChoiceTile(
              key: ValueKey('sim_hypothesis_$option'),
              label: option,
              selected: _prediction == option,
              touchTarget: target,
              onPressed: () => _predict(option),
            ),
          ),
      ],
    );
  }

  Widget _buildExperiment(double target) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final variable in _variables) _variableControl(variable, target),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surfaceContainerHighest,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Semantics(
            liveRegion: true,
            child: Text(
              '${str(_measured, 'label_key')}: '
              '${_model.measure(_settings).toStringAsFixed(1)} '
              '${str(_measured, 'unit_key')}',
              key: const Key('sim_measured_value'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          key: const Key('sim_record_trial'),
          onPressed: _runTrial,
          icon: const Icon(Icons.science_outlined),
          label: const Text('سجّل النتيجة'),
        ),
        const SizedBox(height: 12),
        _resultsTable(),
        const SizedBox(height: 12),
        OutlinedButton(
          key: const Key('sim_go_explain'),
          onPressed: _goToExplain,
          child: Text(_canExplain
              ? 'انتقل إلى التفسير'
              : 'جرّب ${_minTrials - _trials.length} مرة أخرى'),
        ),
      ],
    );
  }

  Widget _variableControl(SimVariable variable, double target) {
    final value = _settings[variable.id] ?? variable.min;

    Future<void> nudge(double delta) async {
      final next = (value + delta).clamp(variable.min, variable.max);
      setState(() => _settings[variable.id] = next);
      // Every value is spoken on change, per the accessibility section.
      await widget.controller.speakVoiceKey(variable.labelKey);
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('${variable.labelKey}  ${value.toStringAsFixed(0)} ${variable.unitKey}'),
          Row(
            children: [
              // The +/- buttons are the mandatory slider alternative, and are
              // present regardless of whether the slider is usable.
              IconButton(
                key: ValueKey('sim_minus_${variable.id}'),
                onPressed: () => nudge(-variable.step),
                icon: const Icon(Icons.remove_circle_outline),
                iconSize: 28,
              ),
              Expanded(
                child: Slider(
                  key: ValueKey('sim_slider_${variable.id}'),
                  value: value,
                  min: variable.min,
                  max: variable.max,
                  divisions: variable.step <= 0
                      ? null
                      : ((variable.max - variable.min) / variable.step).round().clamp(1, 100),
                  label: value.toStringAsFixed(0),
                  onChanged: (next) => setState(() => _settings[variable.id] = next),
                ),
              ),
              IconButton(
                key: ValueKey('sim_plus_${variable.id}'),
                onPressed: () => nudge(variable.step),
                icon: const Icon(Icons.add_circle_outline),
                iconSize: 28,
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// The results table, as text.
  ///
  /// Text and not only a chart, which the accessibility section requires. It is
  /// also what the explanation hints point back at.
  Widget _resultsTable() {
    if (_trials.isEmpty) {
      return Text('لا نتائج بعد', style: Theme.of(context).textTheme.bodySmall);
    }
    return Container(
      key: const Key('sim_results_table'),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _tableHighlighted
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.outlineVariant,
          width: _tableHighlighted ? 3 : 1,
        ),
      ),
      child: Table(
        defaultColumnWidth: const IntrinsicColumnWidth(),
        children: [
          TableRow(children: [
            for (final variable in _variables)
              Padding(
                padding: const EdgeInsets.all(4),
                child: Text(variable.labelKey,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            Padding(
              padding: const EdgeInsets.all(4),
              child: Text(str(_measured, 'label_key'),
                  style: const TextStyle(fontWeight: FontWeight.bold)),
            ),
          ]),
          for (final trial in _trials)
            TableRow(children: [
              for (final variable in _variables)
                Padding(
                  padding: const EdgeInsets.all(4),
                  child: Text((trial.settings[variable.id] ?? 0).toStringAsFixed(0)),
                ),
              Padding(
                padding: const EdgeInsets.all(4),
                child: Text(trial.measured.toStringAsFixed(1)),
              ),
            ]),
        ],
      ),
    );
  }

  Widget _buildExplain(double target) {
    return Column(
      children: [
        _resultsTable(),
        const SizedBox(height: 16),
        Text('فسّر ما حدث', style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 12),
        for (final option in _explanationOptions)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ChoiceTile(
              key: ValueKey('sim_explanation_$option'),
              label: option,
              selected: false,
              eliminated: _eliminated.contains(option),
              touchTarget: target,
              onPressed: () => _explain(option),
            ),
          ),
      ],
    );
  }

  Widget _buildDone() {
    return Semantics(
      liveRegion: true,
      child: Column(
        children: [
          Text(
            _explanationCorrect ? 'أتممت التجربة وفسّرتها' : 'أتممت التجربة',
            key: const Key('sim_result'),
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 12),
          _resultsTable(),
        ],
      ),
    );
  }
}
