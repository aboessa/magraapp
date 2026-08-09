/// The screen that hosts whichever engine a pack asks for.
///
/// Deliberately thin: it resolves the engine, handles the states where a game
/// cannot be played, and offers the cross-engine controls (accessibility, save).
/// Everything about *how* a game plays belongs to the engine.
///
/// Kept free of Riverpod so it can be pumped in a widget test with a pack built
/// in the test itself. The provider that fetches a pack from the API lives in
/// `game_providers.dart`.
library;

import 'package:flutter/material.dart';
// RenderRepaintBoundary lives in the rendering layer; material re-exports widgets
// but not render objects.
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;

import '../../data/local_creation_store.dart';
import '../../engine/game_engine_registry.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_session_controller.dart';
import '../../engine/trace_color_engine.dart';
import '../../engine/wave_one_engines.dart';

/// Engines this build can run.
///
/// One place to register an implementation. Everything listed here has a real
/// pack-driven implementation; an engine with no implementation must not appear,
/// because the registry is what the catalogue and the game screen trust.
GameEngineRegistry buildDefaultRegistry() => GameEngineRegistry(const [
      TraceColorEngine(),
      MemoryFlipEngine(),
      MatchPairsEngine(),
      SortBinsEngine(),
      SequenceOrderEngine(),
    ]);

class GameScreen extends StatefulWidget {
  const GameScreen({
    required this.pack,
    required this.controller,
    required this.registry,
    this.isTelevision = false,
    this.engineVersionSupported = 1,
    this.creationStore,
    super.key,
  });

  final GamePack pack;
  final GameSessionController controller;
  final GameEngineRegistry registry;
  final bool isTelevision;
  final int engineVersionSupported;

  /// When provided, a save button appears for levels that produce a creation.
  final LocalCreationStore? creationStore;

  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> {
  /// Wraps the engine so a drawing can be captured without the engine knowing
  /// anything about saving.
  final GlobalKey _captureKey = GlobalKey();

  String? _saveMessage;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChanged);
    // Fire-and-forget: the intro voice-over should not delay first paint.
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
      engineVersionSupported: widget.engineVersionSupported,
      isTelevision: widget.isTelevision,
    );

    if (!availability.isAvailable) {
      return _UnavailableView(reason: availability.reason!, detail: availability.detail);
    }

    final engine = widget.registry.resolve(widget.pack.engineId)!;

    return Scaffold(
      appBar: AppBar(
        title: Text('المستوى ${widget.controller.levelIndex + 1} من ${widget.controller.levelCount}'),
        actions: [
          IconButton(
            icon: Icon(widget.controller.settings.simplifiedMotor
                ? Icons.accessibility_new
                : Icons.accessibility),
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
            // RepaintBoundary is what makes the drawing capturable. It wraps only
            // the engine, so controls and chrome are never part of a saved image.
            child: RepaintBoundary(
              key: _captureKey,
              child: engine.build(context, widget.controller),
            ),
          ),
          if (_saveMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_saveMessage!, style: Theme.of(context).textTheme.bodySmall),
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
    final showSave = widget.creationStore != null &&
        (controller.level.mode.isCreation || controller.level.hasColoringStage) &&
        controller.phase != LevelPhase.drawing;
    final showNext = controller.phase == LevelPhase.finished &&
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
              // Explicit and optional. Nothing is saved automatically and nothing
              // leaves the device here.
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
    final result = await store.saveFromBoundary(
      boundary: boundary,
      childId: widget.controller.childId,
      gameId: widget.controller.gameId,
      drawingMode: widget.controller.level.mode.name,
    );
    if (!mounted) return;
    setState(() {
      _saving = false;
      _saveMessage = result.isSuccess
          ? 'حُفظت رسمتك على هذا الجهاز.'
          : 'لم نتمكّن من حفظ الرسمة. (${result.detail ?? result.outcome.name})';
    });
  }
}

/// Shown when a game cannot be played, with a reason that is true.
///
/// Never an error dialog: an unsupported engine is not the child's fault and not
/// a crash. `docs/games/08-implementation-plan.md` requires the registry to
/// "يتعامل بأمان مع محرك غير معروف".
class _UnavailableView extends StatelessWidget {
  const _UnavailableView({required this.reason, this.detail});

  final GameUnavailableReason reason;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    final (title, body, icon) = switch (reason) {
      GameUnavailableReason.requiresTouch => (
          'هذه اللعبة تحتاج شاشة لمس',
          'التتبّع والتلوين يحتاجان إصبعًا أو قلمًا. جرّبها على الجوال أو اللوح.',
          Icons.touch_app_outlined,
        ),
      GameUnavailableReason.unsupportedEngine => (
          'هذه اللعبة تحتاج تحديث التطبيق',
          'أضفنا نوعًا جديدًا من الألعاب. حدّث التطبيق لتلعبها.',
          Icons.system_update_outlined,
        ),
      GameUnavailableReason.unsupportedPackVersion => (
          'هذه اللعبة تحتاج تحديث التطبيق',
          'نسخة اللعبة أحدث من نسخة التطبيق.',
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
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 64),
              const SizedBox(height: 16),
              Text(title, style: Theme.of(context).textTheme.titleLarge, textAlign: TextAlign.center),
              const SizedBox(height: 8),
              Text(body, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
              if (detail != null) ...[
                const SizedBox(height: 16),
                // Useful in development, harmless to a child, and never the
                // headline.
                Text(detail!, style: Theme.of(context).textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
