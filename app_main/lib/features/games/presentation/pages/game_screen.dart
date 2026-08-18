/// The screen that hosts whichever engine a pack asks for.
///
/// Deliberately thin: it resolves the engine, handles unavailable states and
/// offers controls shared by all engines. Everything about how a game plays
/// belongs to the selected engine.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;

import '../../data/creation_document.dart';
import '../../data/local_creation_store.dart';
import '../../engine/block_code_engine.dart';
import '../../engine/game_engine_registry.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_session_controller.dart';
import '../../engine/rhythm_tap_engine.dart';
import '../../engine/sim_lab_engine.dart';
import '../../engine/timeline_map_engine.dart';
import '../../engine/trace_color_engine.dart';
import '../../engine/wave_one_engines.dart';
import '../../engine/wave_two_engines.dart';

GameEngineRegistry buildDefaultRegistry() => GameEngineRegistry(const [
  TraceColorEngine(),
  MemoryFlipEngine(),
  MatchPairsEngine(),
  SortBinsEngine(),
  SequenceOrderEngine(),
  CountQuantityEngine(),
  LogicPatternEngine(),
  WordBuildEngine(),
  RhythmTapEngine(),
  BlockCodeEngine(),
  SimLabEngine(),
  TimelineMapEngine(),
]);

class GameScreen extends StatefulWidget {
  const GameScreen({
    required this.pack,
    required this.controller,
    required this.registry,
    this.isTelevision = false,
    this.requiredEngineVersion = 1,
    this.supportedEngineVersion = 1,
    this.supportedPackVersion = 1,
    this.creationStore,
    this.initialCreation,
    super.key,
  });

  final GamePack pack;
  final GameSessionController controller;
  final GameEngineRegistry registry;
  final bool isTelevision;

  /// Version of the engine implementation this content was authored against.
  final int requiredEngineVersion;

  /// Highest engine implementation version bundled with this app build.
  final int supportedEngineVersion;

  /// Highest pack JSON contract version understood by this app build.
  final int supportedPackVersion;

  /// When provided, a save button appears for levels that produce a creation.
  final LocalCreationStore? creationStore;

  /// Editable document restored when continuing a previous creation.
  final CreationDocument? initialCreation;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  final GlobalKey _captureKey = GlobalKey();

  String? _saveMessage;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    widget.controller.start();
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChanged);
    super.dispose();
  }

  void _onChanged() {
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final availability = evaluateAvailability(
      registry: widget.registry,
      engineId: widget.pack.engineId,
      pack: widget.pack,
      requiredEngineVersion: widget.requiredEngineVersion,
      supportedEngineVersion: widget.supportedEngineVersion,
      supportedPackVersion: widget.supportedPackVersion,
      isTelevision: widget.isTelevision,
    );

    if (!availability.isAvailable) {
      return _UnavailableView(
        reason: availability.reason!,
        detail: kDebugMode ? availability.detail : null,
      );
    }

    final engine = widget.registry.resolve(widget.pack.engineId)!;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'المستوى ${widget.controller.levelIndex + 1} من '
          '${widget.controller.levelCount}',
        ),
        actions: [
          IconButton(
            icon: Icon(
              widget.controller.settings.simplifiedMotor
                  ? Icons.accessibility_new
                  : Icons.accessibility,
            ),
            tooltip: 'وضع حركي مبسّط',
            onPressed: _toggleSimplifiedMotor,
          ),
        ],
      ),
      body: Column(
        children: [
          if (widget.controller.settings.simplifiedMotor)
            Container(
              width: double.infinity,
              color: Theme.of(context).colorScheme.secondaryContainer,
              padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
              child: Text(
                'الوضع الحركي المبسّط مفعّل: الطريق أوسع.',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          Expanded(
            child: RepaintBoundary(
              key: _captureKey,
              child: engine.build(context, widget.controller),
            ),
          ),
          if (_saveMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                _saveMessage!,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          _buildFooter(context),
        ],
      ),
    );
  }

  void _toggleSimplifiedMotor() {
    final next = widget.controller.settings.copyWith(
      simplifiedMotor: !widget.controller.settings.simplifiedMotor,
    );
    widget.controller.updateSettings(next);
  }

  Widget _buildFooter(BuildContext context) {
    final controller = widget.controller;
    final showSave =
        widget.creationStore != null &&
        (controller.level.mode.isCreation ||
            controller.level.hasColoringStage) &&
        controller.phase != LevelPhase.drawing;
    final showNext =
        controller.phase == LevelPhase.finished &&
        controller.levelIndex + 1 < controller.levelCount;

    if (!showSave && !showNext) return const SizedBox(height: 8);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (showSave)
            OutlinedButton.icon(
              onPressed: _saving ? null : _saveDrawing,
              icon: const Icon(Icons.save_alt),
              label: const Text('احفظ رسمتي'),
            ),
          if (showSave && showNext) const SizedBox(width: 12),
          if (showNext)
            FilledButton.icon(
              onPressed: () {
                setState(() => _saveMessage = null);
                controller.nextLevel();
              },
              icon: const Icon(Icons.arrow_forward),
              label: const Text('التالي'),
            ),
        ],
      ),
    );
  }

  Future<void> _saveDrawing() async {
    final store = widget.creationStore;
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (store == null || boundary is! RenderRepaintBoundary) return;

    setState(() => _saving = true);
    final pendingJson = widget.controller.pendingDocumentJson;
    final pendingVersion = widget.controller.pendingDocumentVersion;
    CreationSaveResult result;

    if (pendingJson != null && pendingVersion != null) {
      result = await store.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.controller.childId,
        gameId: widget.controller.gameId,
        drawingMode: widget.controller.level.mode.name,
        documentJson: pendingJson,
        documentVersion: pendingVersion,
      );
    } else {
      final regionColors = widget.controller.regionColors;
      if (regionColors.isNotEmpty) {
        final document = CreationDocument(
          version: kCreationDocVersion,
          mode: widget.controller.level.mode.name,
          palette: widget.controller.level.coloring?.palette ?? const [],
          fills: regionColors.entries
              .map(
                (entry) => CreationFill(regionId: entry.key, hex: entry.value),
              )
              .toList(),
          backgroundAsset: widget.controller.level.backgroundAsset,
          templateAsset: widget.controller.level.coloring?.templateAsset,
          prompt: widget.controller.level.prompt,
          packId: widget.controller.pack.packId,
          levelIndex: widget.controller.levelIndex,
        );
        result = await store.saveFromBoundaryWithDocument(
          boundary: boundary,
          childId: widget.controller.childId,
          gameId: widget.controller.gameId,
          drawingMode: widget.controller.level.mode.name,
          documentJson: document.toJsonString(),
          documentVersion: document.version,
        );
      } else {
        result = await store.saveFromBoundary(
          boundary: boundary,
          childId: widget.controller.childId,
          gameId: widget.controller.gameId,
          drawingMode: widget.controller.level.mode.name,
        );
      }
    }

    if (!mounted) return;
    setState(() {
      _saving = false;
      _saveMessage = result.isSuccess
          ? 'حُفظت رسمتك على هذا الجهاز.'
          : 'لم نتمكّن من حفظ الرسمة. '
                '(${result.detail ?? result.outcome.name})';
    });
  }
}

class _UnavailableView extends StatelessWidget {
  const _UnavailableView({required this.reason, this.detail});

  final GameUnavailableReason reason;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final (title, body, icon) = switch (reason) {
      GameUnavailableReason.requiresTouch => (
        'هذه اللعبة تحتاج شاشة لمس',
        'التتبّع والتلوين يحتاجان إصبعًا أو قلمًا. '
            'جرّبها على الجوال أو اللوح.',
        Icons.touch_app_outlined,
      ),
      GameUnavailableReason.unsupportedEngine ||
      GameUnavailableReason.unsupportedEngineVersion => (
        'هذه اللعبة تحتاج تحديث التطبيق',
        'أضفنا نوعًا أو نسخة أحدث من الألعاب. حدّث التطبيق لتلعبها.',
        Icons.system_update_outlined,
      ),
      GameUnavailableReason.unsupportedPackVersion => (
        'هذه اللعبة تحتاج تحديث التطبيق',
        'نسخة بيانات اللعبة أحدث من نسخة التطبيق.',
        Icons.system_update_outlined,
      ),
      GameUnavailableReason.malformedPack => (
        'لم نتمكّن من فتح هذه اللعبة',
        'سنصلحها قريبًا. جرّب لعبة أخرى.',
        Icons.extension_off_outlined,
      ),
    };

    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 440),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 64),
                const SizedBox(height: 16),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  body,
                  style: Theme.of(context).textTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                if (detail != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    detail!,
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
