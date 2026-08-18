/// Full drawing board — immersive canvas for personal boards.
/// Supports portrait/landscape/square, background, autosave, unsaved guard, resume.
library;

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import '../../data/creation_document.dart';
import '../../data/local_creation_store.dart';
import '../../engine/free_draw_surface.dart';
import '../../engine/game_pack.dart';
import '../../engine/game_services.dart';
import '../../engine/game_session_controller.dart';

class BoardEditorPage extends StatefulWidget {
  const BoardEditorPage({
    required this.childId,
    required this.creationStore,
    this.initialDocument,
    this.existingCreation,
    this.isNewBoard = false,
    super.key,
  });
  final String childId;
  final LocalCreationStore creationStore;
  final CreationDocument? initialDocument;
  final LocalCreation? existingCreation;
  final bool isNewBoard;
  @override
  State<BoardEditorPage> createState() => _BoardEditorPageState();
}

class _BoardEditorPageState extends State<BoardEditorPage>
    with WidgetsBindingObserver {
  final GlobalKey _captureKey = GlobalKey();
  List<FreeStroke> _strokes = [];
  Size _canvasLogicalSize = const Size.square(1024);
  bool _hasUnsaved = false;
  bool _saving = false;
  bool _saved = false;
  bool _fullscreen = false;
  int _revision = 0;
  Timer? _debounce;
  late CreationDocument _doc;
  late BoardOrientation _orientation;
  late GameSessionController _gameController;
  LocalCreation? _currentCreation;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _doc =
        widget.initialDocument ??
        CreationDocument(
          version: kCreationDocVersion,
          mode: 'free_draw',
          boardTitle: 'لوحتي 1',
          orientation: BoardOrientation.square,
          creationType: CreationType.freeBoard,
        );
    _orientation = _doc.orientation;
    _currentCreation = widget.existingCreation;
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'board-free',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {
        'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6},
        'sequential_tap_alternative': true,
        'min_touch_target_dp': 48,
      },
      'assets': {'images': [], 'audio': []},
      'voice_manifest': {},
      'levels': [
        {
          'level': 1,
          'mode': 'free_draw',
          'scoring': 'none',
          'prompt_key': 'game.board.prompt',
          'completion': {'rule': 'child_taps_done'},
          'coloring': {
            'enabled': false,
            'palette': _doc.palette.isEmpty
                ? ['#FFD34D', '#00D6F5', '#FF6FAE', '#6A3DF2']
                : _doc.palette,
          },
          'background_asset': _doc.backgroundAsset,
        },
      ],
    });
    _gameController = GameSessionController(
      pack: pack,
      gameId: 'board-free',
      childId: widget.childId,
      ageTrack: AgeTrack.kids,
      audio: SilentGameAudioService(),
      reporter: _NoopReporter(),
      eventIdFactory: () => 'board-${DateTime.now().microsecondsSinceEpoch}',
      initialCreationJson: _doc.toJsonString(),
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _gameController.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _autosaveNow();
    }
  }

  void _onInitialStrokesRestored(List<FreeStroke> strokes) {
    _strokes = List.of(strokes);
  }

  void _onStrokesChanged(List<FreeStroke> strokes) {
    _strokes = List.of(strokes);
    _revision++;
    _hasUnsaved = true;
    _saved = false;
    setState(() {});
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 800), _autosaveNow);
  }

  Future<void> _autosaveNow() async {
    if (!_hasUnsaved || _saving || !mounted) return;
    _debounce?.cancel();
    final savingRevision = _revision;
    setState(() => _saving = true);
    final newDoc = _buildCurrentDocument();
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) {
      if (mounted) setState(() => _saving = false);
      return;
    }

    try {
      final result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.childId,
        gameId: widget.existingCreation?.gameId ?? 'board-free',
        drawingMode: 'free_board',
        documentJson: newDoc.toJsonString(),
        documentVersion: newDoc.version,
        existingCreation: _currentCreation,
      );
      if (!mounted) return;
      final savedLatestRevision = savingRevision == _revision;
      setState(() {
        _saving = false;
        if (result.isSuccess && result.creation != null) {
          _currentCreation = result.creation!;
          if (savedLatestRevision) {
            _doc = newDoc;
            _saved = true;
            _hasUnsaved = false;
          } else {
            _saved = false;
            _hasUnsaved = true;
          }
        }
      });
      if (result.isSuccess && !savedLatestRevision) {
        _debounce = Timer(const Duration(milliseconds: 200), _autosaveNow);
      }
    } catch (_) {
      if (mounted) setState(() => _saving = false);
    }
  }

  CreationDocument _buildCurrentDocument() => CreationDocument(
    version: kCreationDocVersion,
    mode: 'free_draw',
    canvasWidth: _canvasLogicalSize.width,
    canvasHeight: _canvasLogicalSize.height,
    backgroundAsset: _doc.backgroundAsset,
    templateAsset: _doc.templateAsset,
    palette: _doc.palette,
    strokes: _strokes
        .map(
          (stroke) => DocStroke.fromFreeStrokeDimensions(
            stroke,
            _canvasLogicalSize.width,
            _canvasLogicalSize.height,
          ),
        )
        .toList(growable: false),
    fills: _doc.fills,
    boardTitle: _doc.boardTitle,
    orientation: _orientation,
    creationType: CreationType.freeBoard,
    referenceActivityId: _doc.referenceActivityId,
    referenceAssetId: _doc.referenceAssetId,
    referenceTitle: _doc.referenceTitle,
  );

  Future<bool> _onWillPop() async {
    if (!_hasUnsaved) return true;
    final choice = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('تغييرات غير محفوظة'),
        content: const Text('هل تريد حفظ اللوحة قبل الخروج؟'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, 'discard'),
            child: const Text('تجاهل'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, 'cancel'),
            child: const Text('متابعة الرسم'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, 'save'),
            child: const Text('حفظ وخروج'),
          ),
        ],
      ),
    );
    if (choice == 'save') return _saveAndExit();
    if (choice == 'discard') return true;
    return false;
  }

  Future<bool> _saveAndExit() async {
    if (_saving || !mounted) return false;
    final boundary = _captureKey.currentContext?.findRenderObject();
    if (boundary is! RenderRepaintBoundary) return false;
    final savingRevision = _revision;
    final newDoc = _buildCurrentDocument();
    setState(() => _saving = true);
    try {
      final result = await widget.creationStore.saveFromBoundaryWithDocument(
        boundary: boundary,
        childId: widget.childId,
        gameId: widget.existingCreation?.gameId ?? 'board-free',
        drawingMode: 'free_board',
        documentJson: newDoc.toJsonString(),
        documentVersion: newDoc.version,
        existingCreation: _currentCreation,
      );
      if (!mounted) return false;
      if (!result.isSuccess || result.creation == null) {
        setState(() => _saving = false);
        return false;
      }
      final savedLatestRevision = savingRevision == _revision;
      setState(() {
        _saving = false;
        _currentCreation = result.creation!;
        if (savedLatestRevision) {
          _doc = newDoc;
          _hasUnsaved = false;
          _saved = true;
        }
      });
      return savedLatestRevision;
    } catch (_) {
      if (mounted) setState(() => _saving = false);
      return false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final aspect = switch (_orientation) {
      BoardOrientation.portrait => 9 / 16,
      BoardOrientation.landscape => 16 / 9,
      BoardOrientation.square => 1.0,
    };
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, res) async {
        if (didPop) return;
        final should = await _onWillPop();
        if (should && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: _fullscreen
            ? null
            : AppBar(
                title: Text(_doc.boardTitle ?? 'لوحة'),
                actions: [
                  if (_saving)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Center(
                        child: SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        ),
                      ),
                    ),
                  if (!_saving && _saved)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Center(
                        child: Text('محفوظ', style: TextStyle(fontSize: 12)),
                      ),
                    ),
                  if (!_saving && _hasUnsaved)
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 12),
                      child: Center(
                        child: Text(
                          'غير محفوظ',
                          style: TextStyle(fontSize: 12),
                        ),
                      ),
                    ),
                  IconButton(
                    icon: const Icon(Icons.fullscreen),
                    tooltip: 'ملء الشاشة',
                    onPressed: () => setState(() => _fullscreen = true),
                  ),
                ],
              ),
        floatingActionButton: _fullscreen
            ? FloatingActionButton.small(
                tooltip: 'الخروج من ملء الشاشة',
                onPressed: () => setState(() => _fullscreen = false),
                child: const Icon(Icons.fullscreen_exit),
              )
            : null,
        body: Column(
          children: [
            Expanded(
              child: Center(
                child: AspectRatio(
                  aspectRatio: aspect,
                  child: FreeDrawSurface(
                    controller: _gameController,
                    initialDocument: _doc,
                    canvasAspectRatio: aspect,
                    canvasRepaintBoundaryKey: _captureKey,
                    onCanvasSizeChanged: (size) => _canvasLogicalSize = size,
                    onInitialStrokesRestored: _onInitialStrokesRestored,
                    onStrokesChanged: _onStrokesChanged,
                  ),
                ),
              ),
            ),
            if (!_fullscreen)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    FilledButton.icon(
                      onPressed: _hasUnsaved && !_saving ? _saveAndExit : null,
                      icon: const Icon(Icons.save_outlined),
                      label: const Text('حفظ'),
                    ),
                    const SizedBox(width: 12),
                    OutlinedButton(
                      onPressed: () async {
                        final ok = await _onWillPop();
                        if (ok && context.mounted) Navigator.pop(context);
                      },
                      child: const Text('خروج'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _NoopReporter implements AttemptReporter {
  @override
  Future<void> report(GameAttempt attempt) async {}
}
