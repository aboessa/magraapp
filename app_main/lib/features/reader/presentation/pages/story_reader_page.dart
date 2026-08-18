import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:video_player/video_player.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/env/app_environment.dart';
import '../../../../core/media/bundled_story_assets.dart';
import '../../../child/application/child_provider.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/domain/content_models.dart';
import '../../application/reader_auto_turn.dart';
import '../../application/reader_narration.dart';

class _NextPageIntent extends Intent {
  const _NextPageIntent();
}

class _PreviousPageIntent extends Intent {
  const _PreviousPageIntent();
}

class _ToggleNarrationIntent extends Intent {
  const _ToggleNarrationIntent();
}

class _CloseReaderIntent extends Intent {
  const _CloseReaderIntent();
}

// Only reviewed Majarra CDN story packs may fall back to their exact bundled
// counterpart. Unknown stories never substitute unrelated artwork.
String? _localFallbackFor(String? url) => bundledStoryAssetForUrl(url);

class StoryReaderPage extends ConsumerStatefulWidget {
  const StoryReaderPage({
    required this.title,
    this.subtitle,
    this.collection,
    this.loading = false,
    this.error,
    this.onRetry,
    this.isComic = false,
    this.bookId,
    this.storyId,
    this.contentType = ReaderContentType.story,
    this.initialLanguage = 'ar',
    super.key,
  });

  final String title;
  final String? subtitle;
  final ReaderPageCollection? collection;
  final bool loading;
  final Object? error;
  final VoidCallback? onRetry;
  final bool isComic;
  final String? bookId;
  final String? storyId;
  final ReaderContentType contentType;
  final String initialLanguage;

  @override
  ConsumerState<StoryReaderPage> createState() => _StoryReaderPageState();
}

class _StoryReaderPageState extends ConsumerState<StoryReaderPage>
    with WidgetsBindingObserver {
  late final PageController _controller;
  late List<StoryPage> _pages;
  late List<ReaderLanguageAvailability> _languages;

  int _page = 0;
  late String _language;
  ReadingMode _mode = ReadingMode.readMyself;
  bool _showText = true;
  bool _modeChosen = false;
  bool _autoAdvance = false;
  bool _languageLoading = false;
  String? _languageNotice;
  String? _languageError;

  VideoPlayerController? _narration;
  bool _narrationLoading = false;
  String? _narrationError;
  String? _narrationUnavailable;
  int _narrationToken = 0;

  // ── dwell / auto-turn ──────────────────────────────────────────────
  // `dwellMs` = authored illustration viewing time AFTER narration finishes.
  // Source of truth is the actual audio completion event, not a countdown from
  // `durationMs`.  No silence is baked into WAV files.
  //
  // All timing lives in `ReaderAutoTurn` so it can be tested without a video
  // player, and so the reader holds no unnamed magic numbers.
  late final ReaderAutoTurn _autoTurn = ReaderAutoTurn(onAdvance: _goNext);

  /// True once the player reported completion for the page on screen. Reset on
  /// every page change, replay and narration reload.
  bool _narrationCompleted = false;

  bool get _isRtl => _language.toLowerCase().startsWith('ar');
  String get _entityId => widget.storyId ?? widget.bookId ?? widget.title;
  String? get _contentId => widget.storyId ?? widget.bookId;
  StoryPage? get _currentPage =>
      _pages.isEmpty || _page >= _pages.length ? null : _pages[_page];
  bool get _canNarrateCurrentPage => _currentPage?.canNarrate ?? false;

  String _copy(String arabic, String english) => _isRtl ? arabic : english;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _language = widget.collection?.language ?? widget.initialLanguage;
    _pages = List.of(widget.collection?.pages ?? const <StoryPage>[]);
    _languages = List.of(
      widget.collection?.languages ?? const <ReaderLanguageAvailability>[],
    );
    _controller = PageController();
    if (_pages.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _prepareReader());
    }
  }

  @override
  void didUpdateWidget(covariant StoryReaderPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    final collection = widget.collection;
    if (collection == null || identical(collection, oldWidget.collection)) {
      return;
    }

    // Provider refreshes may only replace the local state when they represent
    // the language currently on screen. A background refresh of the initial
    // route must never overwrite a language the child selected afterward.
    if (collection.language == _language || _pages.isEmpty) {
      // A page list swap must not leave a timer from the old list alive.
      _cancelDwellTimer();
      _disposeNarration();
      _pages = List.of(collection.pages);
      _languages = List.of(collection.languages);
      _language = collection.language;
      if (_page >= _pages.length) _page = 0;
      if (_controller.hasClients && _pages.isNotEmpty) {
        _controller.jumpToPage(_page);
      }
      _precacheAround(_page);
      if (mounted) setState(() {});
      if (_pages.isNotEmpty && !_modeChosen) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _showModePicker());
      }
    }
  }

  Future<void> _prepareReader() async {
    await _restoreProgress();
    if (!mounted) return;
    _precacheAround(_page);
    if (!_modeChosen) await _showModePicker();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _autoTurn.dispose();
    _disposeNarration();
    _controller.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.detached) {
      // Pause narration AND cancel pending dwell so no page turn fires while
      // the app is in the background.
      _cancelDwellTimer();
      _narration?.pause();
      return;
    }
    if (state == AppLifecycleState.resumed && _narrationCompleted) {
      // Narration had already finished when the app went away: restart the
      // dwell from the beginning rather than turning instantly on return.
      _startDwellThenAdvance();
    }
  }

  // ── dwell helpers ──────────────────────────────────────────────────
  void _cancelDwellTimer() => _autoTurn.cancel();

  /// Called ONLY on actual audio completion — never from a duration countdown.
  void _startDwellThenAdvance() {
    final page = _currentPage;
    if (page == null) return;
    _autoTurn.onNarrationComplete(
      page: page,
      mode: _mode,
      autoAdvanceEnabled: _autoAdvance,
      isLastPage: _page >= _pages.length - 1,
    );
  }

  String _resumeKey(String childId) =>
      'majarra.reader.$childId.$_entityId.$_language';

  Future<void> _restoreProgress() async {
    final childId = ref.read(childProvider).activeChildId;
    if (childId == null || childId.isEmpty || _pages.isEmpty) return;
    final preferences = await SharedPreferences.getInstance();
    final saved = preferences.getInt(_resumeKey(childId));
    if (!mounted || saved == null || saved <= 0 || saved >= _pages.length) {
      return;
    }
    _page = saved;
    if (_controller.hasClients) _controller.jumpToPage(saved);
    setState(() {});
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          _copy(
            'المتابعة من الصفحة ${saved + 1} من ${_pages.length}',
            'Continuing from page ${saved + 1} of ${_pages.length}',
          ),
        ),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _persistProgress() async {
    final childId = ref.read(childProvider).activeChildId;
    if (childId == null || childId.isEmpty) return;
    final preferences = await SharedPreferences.getInstance();
    await preferences.setInt(_resumeKey(childId), _page);
  }

  void _disposeNarration() {
    _narrationToken += 1;
    final narration = _narration;
    _narration = null;
    if (narration == null) return;
    narration.removeListener(_onNarrationTick);
    unawaited(narration.pause());
    unawaited(narration.dispose());
  }

  void _precacheAround(int index) {
    if (_pages.isEmpty || !mounted) return;
    for (final distance in const [0, 1, -1]) {
      final target = index + distance;
      if (target < 0 || target >= _pages.length) continue;
      final url = _pages[target].imageUrl;
      if (url == null || url.isEmpty) continue;
      final local = _localFallbackFor(url);

      // DOM-backed network images are used on web below, so byte precaching
      // would only issue a CORS-restricted XMLHttpRequest that cannot warm the
      // HTML element. Native platforms keep adjacent-page warming.
      if (!kIsWeb) {
        unawaited(
          precacheImage(
            NetworkImage(url),
            context,
            onError: (error, stackTrace) {},
          ),
        );
      }
      if (local != null) {
        unawaited(
          precacheImage(
            AssetImage(local),
            context,
            onError: (error, stackTrace) {},
          ),
        );
      }
    }
  }

  Future<VideoPlayerController?> _publicNarrationController(
    StoryPage page,
  ) async {
    final value = page.audioUrl;
    if (value == null) return null;
    final uri = Uri.tryParse(value);
    if (uri == null ||
        !uri.hasScheme ||
        (uri.scheme != 'https' && uri.scheme != 'http')) {
      throw const FormatException('Invalid narration URL');
    }
    return VideoPlayerController.networkUrl(uri);
  }

  Future<void> _loadNarrationForCurrentPage() async {
    final page = _currentPage;
    if (page == null) return;
    _cancelDwellTimer();
    _narrationCompleted = false;
    setState(() {
      _narrationLoading = true;
      _narrationError = null;
      _narrationUnavailable = null;
    });
    _disposeNarration();
    // `_disposeNarration` advances the cancellation token. Claim a fresh token
    // after disposal so this request remains the active one.
    final activeToken = ++_narrationToken;

    VideoPlayerController? controller;
    try {
      if (page.hasAudio) {
        controller = await _publicNarrationController(page);
      } else if (page.hasProtectedAudio) {
        final contentId = _contentId;
        if (contentId == null || contentId.isEmpty) {
          throw const _NarrationPrecondition(
            'تعذّر تحديد القصة المطلوبة للصوت.',
          );
        }
        final childId = ref.read(childProvider).activeChildId;
        if (childId == null || childId.isEmpty) {
          throw const _NarrationPrecondition(
            'اختر ملف طفل أولًا لتشغيل الصوت.',
          );
        }
        final source = await fetchPageNarration(
          ref.read(majarraApiClientProvider),
          contentType: widget.contentType,
          contentId: contentId,
          childId: childId,
          pageId: page.id,
          language: _language,
        );
        if (source is NarrationUnavailable) {
          if (!mounted || activeToken != _narrationToken) return;
          setState(() {
            _narrationLoading = false;
            _narrationUnavailable = source.reason;
          });
          return;
        }
        final playable = source as NarrationPlayable;
        final uri = Uri.parse(AppConfig.baseUrl).resolve(playable.streamUrl);
        controller = VideoPlayerController.networkUrl(
          uri,
          httpHeaders: {'Authorization': playable.authorization},
        );
      } else {
        throw _NarrationPrecondition(
          _copy(
            'لا يوجد سرد بهذه اللغة للصفحة الحالية.',
            'This page has no narration in the selected language.',
          ),
        );
      }

      if (controller == null) {
        throw const _NarrationPrecondition('لم يُسجَّل صوت لهذه الصفحة بعد.');
      }
      await controller.initialize();
      if (!mounted || activeToken != _narrationToken) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onNarrationTick);
      setState(() {
        _narration = controller;
        _narrationLoading = false;
      });
      await controller.play();
    } on _NarrationPrecondition catch (error) {
      await controller?.dispose();
      if (!mounted || activeToken != _narrationToken) return;
      setState(() {
        _narrationLoading = false;
        _narrationUnavailable = error.message;
      });
    } on Object {
      await controller?.dispose();
      if (!mounted || activeToken != _narrationToken) return;
      setState(() {
        _narrationLoading = false;
        _narrationError = _copy(
          'تعذّر تشغيل السرد.',
          'Narration could not be played.',
        );
      });
    }
  }

  void _onNarrationTick() {
    final value = _narration?.value;
    if (value == null || !mounted) return;
    final finished =
        value.duration > Duration.zero &&
        value.position >= value.duration &&
        !value.isPlaying;
    if (finished) {
      // Dwell starts on TRUE completion event, not a countdown.
      // Cancel any prior dwell and start the new one; replay logic resets via
      // _toggleNarration -> cancel -> play -> tick again.
      _narration?.removeListener(_onNarrationTick);
      _narrationCompleted = true;
      _startDwellThenAdvance();
    }
    setState(() {});
  }

  Future<void> _toggleNarration() async {
    if (!_canNarrateCurrentPage) {
      setState(() {
        _narrationUnavailable = _copy(
          'لا يوجد سرد بهذه اللغة للصفحة الحالية.',
          'This page has no narration in the selected language.',
        );
      });
      return;
    }
    if (_narration == null) {
      if (_mode != ReadingMode.readToMe) {
        // Pressing play in `Read myself` plays this page's narration so page
        // changes keep working, but it deliberately does NOT switch on
        // auto-advance: Self Read must never start turning pages by itself.
        setState(() => _mode = ReadingMode.readToMe);
      }
      await _loadNarrationForCurrentPage();
      return;
    }
    final narration = _narration!;
    if (narration.value.isPlaying) {
      // Pausing must cancel pending dwell — do not continue counting.
      _cancelDwellTimer();
      await narration.pause();
    } else {
      if (narration.value.position >= narration.value.duration) {
        // Replay: cancel dwell, restart narration, then completion will restart dwell.
        _cancelDwellTimer();
        _narrationCompleted = false;
        await narration.seekTo(Duration.zero);
        // Re-attach listener if it was removed on previous completion.
        narration.removeListener(_onNarrationTick);
        narration.addListener(_onNarrationTick);
      } else {
        // Resume: if dwell was pending, cancel it; completion will restart it.
        _cancelDwellTimer();
        _narrationCompleted = false;
        // Ensure listener is attached after resume (it was removed on finish).
        narration.removeListener(_onNarrationTick);
        narration.addListener(_onNarrationTick);
      }
      await narration.play();
    }
    if (mounted) setState(() {});
  }

  Future<void> _retryNarration() => _loadNarrationForCurrentPage();

  void _onPageChanged(int index) {
    _cancelDwellTimer();
    _disposeNarration();
    _narrationCompleted = false;
    setState(() {
      _page = index;
      _narrationLoading = false;
      _narrationError = null;
      _narrationUnavailable = null;
    });
    unawaited(_persistProgress());
    _precacheAround(index);
    if (_mode == ReadingMode.readToMe) {
      unawaited(_loadNarrationForCurrentPage());
    }
  }

  // Named reader constants — never hard-code `+900/+400` magic numbers.
  // Transition duration is UI animation config, shared with the experience
  // estimator; it is never stored on a story page.
  static const Duration _pageTransitionDuration =
      StoryExperience.pageTransition;

  void _goNext() {
    if (_page >= _pages.length - 1 || !_controller.hasClients) return;
    _cancelDwellTimer();
    _controller.nextPage(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : _pageTransitionDuration,
      curve: Curves.easeOutCubic,
    );
  }

  void _goPrevious() {
    if (_page <= 0 || !_controller.hasClients) return;
    _cancelDwellTimer();
    _controller.previousPage(
      duration: MediaQuery.disableAnimationsOf(context)
          ? Duration.zero
          : _pageTransitionDuration,
      curve: Curves.easeOutCubic,
    );
  }

  void _handleTapUp(TapUpDetails details) {
    // Only a tap that actually navigates cancels the pending turn; `_goNext`
    // and `_goPrevious` do the cancelling.
    final width = MediaQuery.sizeOf(context).width;
    final onLeft = details.globalPosition.dx < width / 3;
    final onRight = details.globalPosition.dx > width * 2 / 3;
    if (_isRtl) {
      if (onLeft) _goNext();
      if (onRight) _goPrevious();
    } else {
      if (onRight) _goNext();
      if (onLeft) _goPrevious();
    }
  }

  ReaderLanguageAvailability? _languageOption(String code) {
    for (final option in _languages) {
      if (option.code == code) return option;
    }
    return null;
  }

  Future<void> _switchLanguage(String language) async {
    if (language == _language || _languageLoading) return;
    // Changing language reloads every page: no timer from the old language may
    // survive into the new page list.
    _cancelDwellTimer();
    final option = _languageOption(language);
    if (option != null &&
        !option.translationAvailable &&
        option.narratedPages == 0) {
      setState(() {
        _languageNotice = _copy(
          'ترجمة ${_languageName(language)} غير متاحة لهذه القصة بعد.',
          '${_languageName(language)} is not available for this story yet.',
        );
        _languageError = null;
      });
      return;
    }

    setState(() {
      _languageLoading = true;
      _languageNotice = null;
      _languageError = null;
    });

    try {
      final api = ref.read(majarraApiClientProvider);
      final dto = widget.storyId != null
          ? await api.fetchStoryPagesForStory(
              widget.storyId!,
              language: language,
            )
          : await api.fetchStoryPages(widget.bookId!, language: language);
      final result = dto.toDomain();
      final selected = result.languages
          .where((item) => item.code == language)
          .firstOrNull;
      final available =
          result.translationAvailable || (selected?.narratedPages ?? 0) > 0;
      if (!mounted) return;
      if (!available) {
        setState(() {
          _languageLoading = false;
          _languageNotice = _copy(
            'ترجمة ${_languageName(language)} غير متاحة لهذه القصة بعد.',
            '${_languageName(language)} is not available for this story yet.',
          );
        });
        return;
      }

      _disposeNarration();
      setState(() {
        _language = result.language;
        _pages = List.of(result.pages);
        _languages = List.of(result.languages);
        _page = 0;
        _languageLoading = false;
        _languageNotice = result.translationComplete
            ? null
            : _copy(
                'بعض الصفحات لم تُترجم إلى ${_languageName(language)} بعد.',
                'Some pages are not translated into ${_languageName(language)} yet.',
              );
        _narrationUnavailable = null;
        _narrationError = null;
      });
      if (_controller.hasClients && _pages.isNotEmpty) {
        _controller.jumpToPage(0);
      }
      _precacheAround(0);
      if (_mode == ReadingMode.readToMe && _canNarrateCurrentPage) {
        unawaited(_loadNarrationForCurrentPage());
      }
    } on Object {
      if (!mounted) return;
      setState(() {
        _languageLoading = false;
        _languageError = _copy(
          'تعذّر تحميل اللغة. بقيت الصفحات الحالية كما هي.',
          'The language could not be loaded. Current pages were kept.',
        );
      });
    }
  }

  Future<void> _showModePicker() async {
    if (_modeChosen || !mounted || _pages.isEmpty) return;
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _copy('كيف تريد القراءة؟', 'How would you like to read?'),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 17,
                ),
              ),
              const SizedBox(height: 14),
              _ModeTile(
                icon: Icons.person_rounded,
                title: _copy('أقرأ بنفسي', 'Read myself'),
                subtitle: _copy(
                  'أقلب الصفحات بنفسي',
                  'Turn pages at my own pace',
                ),
                onTap: () => _chooseMode(sheetContext, ReadingMode.readMyself),
              ),
              _ModeTile(
                icon: Icons.volume_up_rounded,
                title: _copy('اقرأ لي', 'Read to me'),
                subtitle: _canNarrateCurrentPage
                    ? _copy('استمع إلى سرد هذه الصفحة', 'Listen to this page')
                    : _copy(
                        'لا يوجد صوت لهذه الصفحة بهذه اللغة',
                        'No audio for this page in this language',
                      ),
                onTap: _canNarrateCurrentPage
                    ? () => _chooseMode(sheetContext, ReadingMode.readToMe)
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
    if (mounted && !_modeChosen) setState(() => _modeChosen = true);
  }

  void _chooseMode(BuildContext sheetContext, ReadingMode mode) {
    Navigator.pop(sheetContext);
    // Changing reading mode is a manual action: cancel any pending turn first.
    _cancelDwellTimer();
    setState(() {
      _mode = mode;
      _modeChosen = true;
      // `Read to Me` = narration + dwell + automatic turn, so auto-advance is
      // on by default. The child can still switch it off in reader settings.
      // `Read myself` never auto-turns.
      _autoAdvance = mode.supportsAutoTurn;
    });
    if (mode == ReadingMode.readToMe) {
      unawaited(_loadNarrationForCurrentPage());
    } else {
      _disposeNarration();
      setState(() {
        _narrationError = null;
        _narrationUnavailable = null;
      });
    }
  }

  String _languageName(String code) {
    return switch (code.toLowerCase()) {
      'ar' => _isRtl ? 'العربية' : 'Arabic',
      'en' => 'English',
      'fr' => _isRtl ? 'الفرنسية' : 'French',
      _ => code.toUpperCase(),
    };
  }

  Future<void> _showSettings() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) => StatefulBuilder(
        builder: (context, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    _copy('إعدادات القارئ', 'Reader settings'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                  const SizedBox(height: 12),
                  SwitchListTile(
                    title: Text(
                      _copy('إظهار النص', 'Show text'),
                      style: const TextStyle(color: Colors.white),
                    ),
                    value: _showText,
                    onChanged: (value) {
                      setState(() => _showText = value);
                      setSheetState(() {});
                    },
                  ),
                  SwitchListTile(
                    title: Text(
                      _copy('التالي تلقائيًا', 'Auto advance'),
                      style: const TextStyle(color: Colors.white),
                    ),
                    subtitle: Text(
                      _copy(
                        'يتقدّم بعد انتهاء السرد ووقت تأمّل الرسم',
                        'Advances after narration ends and the viewing pause',
                      ),
                      style: const TextStyle(color: Colors.white60),
                    ),
                    value: _autoAdvance,
                    onChanged: (value) {
                      // Switching it off must stop a turn that is already
                      // counting down.
                      if (!value) _cancelDwellTimer();
                      setState(() => _autoAdvance = value);
                      setSheetState(() {});
                    },
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _copy('اللغة المتاحة', 'Available language'),
                    style: const TextStyle(
                      color: Colors.white70,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _languageChoices()
                        .map((option) {
                          final available =
                              option.translationAvailable ||
                              option.narratedPages > 0;
                          return ChoiceChip(
                            selected: option.code == _language,
                            label: Text(
                              available
                                  ? _languageName(option.code)
                                  : '${_languageName(option.code)} · ${_copy('غير متاحة', 'Unavailable')}',
                            ),
                            onSelected: (_) {
                              Navigator.pop(sheetContext);
                              unawaited(_switchLanguage(option.code));
                            },
                          );
                        })
                        .toList(growable: false),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  List<ReaderLanguageAvailability> _languageChoices() {
    if (_languages.isNotEmpty) return _languages;
    return [
      ReaderLanguageAvailability(
        code: _language,
        declared: true,
        translatedPages: _pages.length,
        narratedPages: _pages.where((page) => page.canNarrate).length,
        totalPages: _pages.length,
        translationAvailable: _pages.isNotEmpty,
        translationComplete: _pages.isNotEmpty,
      ),
    ];
  }

  void _closeReader() {
    // Leaving the reader must kill any pending turn immediately, not wait for
    // `dispose` to run after the route animation.
    _cancelDwellTimer();
    _disposeNarration();
    if (context.canPop()) context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final hasPages = _pages.isNotEmpty;
    final size = MediaQuery.sizeOf(context);
    final isDesktop = size.width >= 1024;
    final isTablet = size.width >= 700 && size.width < 1024;
    final maxStageWidth = isDesktop
        ? 900.0
        : isTablet
        ? 720.0
        : 560.0;
    final initialLoading = widget.loading && !hasPages;
    final initialError = widget.error != null && !hasPages;

    final shortcuts = <ShortcutActivator, Intent>{
      const SingleActivator(LogicalKeyboardKey.pageDown):
          const _NextPageIntent(),
      const SingleActivator(LogicalKeyboardKey.pageUp):
          const _PreviousPageIntent(),
      const SingleActivator(LogicalKeyboardKey.space):
          const _ToggleNarrationIntent(),
      const SingleActivator(LogicalKeyboardKey.escape):
          const _CloseReaderIntent(),
      const SingleActivator(LogicalKeyboardKey.arrowLeft): _isRtl
          ? const _NextPageIntent()
          : const _PreviousPageIntent(),
      const SingleActivator(LogicalKeyboardKey.arrowRight): _isRtl
          ? const _PreviousPageIntent()
          : const _NextPageIntent(),
    };

    return Shortcuts(
      shortcuts: shortcuts,
      child: Actions(
        actions: <Type, Action<Intent>>{
          _NextPageIntent: CallbackAction<_NextPageIntent>(
            onInvoke: (_) {
              _goNext();
              return null;
            },
          ),
          _PreviousPageIntent: CallbackAction<_PreviousPageIntent>(
            onInvoke: (_) {
              _goPrevious();
              return null;
            },
          ),
          _ToggleNarrationIntent: CallbackAction<_ToggleNarrationIntent>(
            onInvoke: (_) {
              unawaited(_toggleNarration());
              return null;
            },
          ),
          _CloseReaderIntent: CallbackAction<_CloseReaderIntent>(
            onInvoke: (_) {
              _closeReader();
              return null;
            },
          ),
        },
        child: FocusTraversalGroup(
          child: Focus(
            autofocus: true,
            child: Scaffold(
              backgroundColor: AppColors.deepSpace,
              body: Directionality(
                textDirection: _isRtl ? TextDirection.rtl : TextDirection.ltr,
                child: SafeArea(
                  child: Column(
                    children: [
                      _ReaderHeader(
                        title: widget.title,
                        isRtl: _isRtl,
                        isComic: widget.isComic,
                        onBack: _closeReader,
                        onSettings: _showSettings,
                      ),
                      if (_languageNotice != null || _languageError != null)
                        _ReaderNotice(
                          message: _languageError ?? _languageNotice!,
                          isError: _languageError != null,
                          onDismiss: () => setState(() {
                            _languageNotice = null;
                            _languageError = null;
                          }),
                        ),
                      if (initialLoading || _languageLoading)
                        const Expanded(
                          child: Center(
                            child: CircularProgressIndicator(
                              color: AppColors.starGold,
                            ),
                          ),
                        )
                      else if (initialError)
                        Expanded(
                          child: _ReaderErrorState(
                            onRetry: widget.onRetry,
                            isRtl: _isRtl,
                          ),
                        )
                      else if (!hasPages)
                        Expanded(
                          child: _UnavailableState(
                            title: widget.title,
                            subtitle: widget.subtitle,
                            isRtl: _isRtl,
                          ),
                        )
                      else
                        Expanded(
                          child: LayoutBuilder(
                            builder: (context, constraints) {
                              return Center(
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(
                                    maxWidth: maxStageWidth,
                                    maxHeight: constraints.maxHeight,
                                  ),
                                  child: Padding(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: isDesktop ? 24 : 12,
                                      vertical: 12,
                                    ),
                                    child: Column(
                                      children: [
                                        Expanded(
                                          child: Semantics(
                                            container: true,
                                            label: _copy(
                                              'الصفحة ${_page + 1} من ${_pages.length}',
                                              'Page ${_page + 1} of ${_pages.length}',
                                            ),
                                            child: Container(
                                              decoration: BoxDecoration(
                                                color: const Color(0xFF111A3A),
                                                borderRadius:
                                                    BorderRadius.circular(20),
                                                border: Border.all(
                                                  color: Colors.white
                                                      .withValues(alpha: 0.1),
                                                ),
                                                boxShadow: [
                                                  BoxShadow(
                                                    color: Colors.black
                                                        .withValues(
                                                          alpha: 0.32,
                                                        ),
                                                    blurRadius: 24,
                                                    offset: const Offset(0, 8),
                                                  ),
                                                ],
                                              ),
                                              clipBehavior: Clip.antiAlias,
                                              child: GestureDetector(
                                                onTapUp: _handleTapUp,
                                                behavior:
                                                    HitTestBehavior.opaque,
                                                child: PageView.builder(
                                                  controller: _controller,
                                                  onPageChanged: _onPageChanged,
                                                  physics:
                                                      const ClampingScrollPhysics(),
                                                  itemCount: _pages.length,
                                                  itemBuilder: (context, index) {
                                                    final child = StoryPageView(
                                                      page: _pages[index],
                                                      showText: _showText,
                                                      isRtl: _isRtl,
                                                      narrationPositionMs:
                                                          index == _page
                                                          ? _narration
                                                                    ?.value
                                                                    .position
                                                                    .inMilliseconds ??
                                                                0
                                                          : 0,
                                                    );
                                                    return _PageTransition(
                                                      controller: _controller,
                                                      index: index,
                                                      currentPage: _page,
                                                      transition: _pages[index]
                                                          .transition,
                                                      child: child,
                                                    );
                                                  },
                                                ),
                                              ),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        _ReaderControls(
                                          page: _page,
                                          total: _pages.length,
                                          isRtl: _isRtl,
                                          canNarrate: _canNarrateCurrentPage,
                                          narrationState:
                                              _currentNarrationState(),
                                          narrationError: _narrationError,
                                          narrationUnavailable:
                                              _narrationUnavailable,
                                          controller: _narration,
                                          onPrevious: _page > 0
                                              ? _goPrevious
                                              : null,
                                          onNext: _page < _pages.length - 1
                                              ? _goNext
                                              : null,
                                          onPlayPause: _toggleNarration,
                                          onRetry: _retryNarration,
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  NarrationState _currentNarrationState() {
    if (_narrationLoading) return NarrationState.loading;
    if (_narrationError != null) return NarrationState.error;
    if (_narrationUnavailable != null || !_canNarrateCurrentPage) {
      return NarrationState.unavailable;
    }
    if (_narration?.value.isPlaying == true) return NarrationState.playing;
    if (_narration != null) return NarrationState.paused;
    return NarrationState.idle;
  }
}

class _NarrationPrecondition implements Exception {
  const _NarrationPrecondition(this.message);

  final String message;
}

class _ReaderHeader extends StatelessWidget {
  const _ReaderHeader({
    required this.title,
    required this.isRtl,
    required this.isComic,
    required this.onBack,
    required this.onSettings,
  });

  final String title;
  final bool isRtl;
  final bool isComic;
  final VoidCallback onBack;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: AppColors.deepSpace,
        border: Border(
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: Icon(
              isRtl ? Icons.arrow_forward_rounded : Icons.arrow_back_rounded,
              color: Colors.white,
            ),
            tooltip: isRtl ? 'رجوع' : 'Back',
            onPressed: onBack,
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
          ),
          if (isComic) ...[
            Semantics(
              label: isRtl ? 'قصة مصوّرة' : 'Comic story',
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                decoration: BoxDecoration(
                  color: AppColors.starGold.withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(99),
                  border: Border.all(
                    color: AppColors.starGold.withValues(alpha: 0.55),
                  ),
                ),
                child: Text(
                  isRtl ? 'كوميكس' : 'COMIC',
                  style: const TextStyle(
                    color: AppColors.starGold,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 4),
          ],
          IconButton(
            icon: const Icon(
              Icons.settings_rounded,
              color: Colors.white,
              size: 24,
            ),
            tooltip: isRtl ? 'إعدادات القارئ' : 'Reader settings',
            onPressed: onSettings,
          ),
        ],
      ),
    );
  }
}

class _ReaderNotice extends StatelessWidget {
  const _ReaderNotice({
    required this.message,
    required this.isError,
    required this.onDismiss,
  });

  final String message;
  final bool isError;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      child: Material(
        color: isError ? const Color(0xFF6B2231) : const Color(0xFF2C3D72),
        child: ListTile(
          dense: true,
          leading: Icon(
            isError ? Icons.error_outline_rounded : Icons.info_outline_rounded,
            color: Colors.white,
          ),
          title: Text(
            message,
            style: const TextStyle(color: Colors.white, fontSize: 13),
          ),
          trailing: IconButton(
            tooltip: 'إغلاق',
            icon: const Icon(Icons.close_rounded, color: Colors.white),
            onPressed: onDismiss,
          ),
        ),
      ),
    );
  }
}

enum NarrationState { idle, loading, playing, paused, unavailable, error }

class _ReaderControls extends StatelessWidget {
  const _ReaderControls({
    required this.page,
    required this.total,
    required this.isRtl,
    required this.canNarrate,
    required this.narrationState,
    required this.narrationError,
    required this.narrationUnavailable,
    required this.controller,
    required this.onPrevious,
    required this.onNext,
    required this.onPlayPause,
    required this.onRetry,
  });

  final int page;
  final int total;
  final bool isRtl;
  final bool canNarrate;
  final NarrationState narrationState;
  final String? narrationError;
  final String? narrationUnavailable;
  final VideoPlayerController? controller;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;
  final VoidCallback onPlayPause;
  final VoidCallback onRetry;

  String get _unavailableCopy => isRtl
      ? 'لا يوجد سرد بهذه اللغة للصفحة الحالية.'
      : 'No narration for this page in the selected language.';

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF0B1026),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: _buildNarrationRow(),
        ),
        Row(
          children: [
            IconButton.filledTonal(
              tooltip: isRtl ? 'الصفحة السابقة' : 'Previous page',
              onPressed: onPrevious,
              icon: Icon(
                isRtl
                    ? Icons.chevron_right_rounded
                    : Icons.chevron_left_rounded,
              ),
              style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
            ),
            const SizedBox(width: 10),
            IconButton.filled(
              tooltip: narrationState == NarrationState.playing
                  ? (isRtl ? 'إيقاف السرد مؤقتًا' : 'Pause narration')
                  : (isRtl ? 'تشغيل السرد' : 'Play narration'),
              onPressed: canNarrate && narrationState != NarrationState.loading
                  ? onPlayPause
                  : null,
              icon: Icon(
                narrationState == NarrationState.loading
                    ? Icons.hourglass_top_rounded
                    : narrationState == NarrationState.playing
                    ? Icons.pause_rounded
                    : Icons.play_arrow_rounded,
              ),
              style: IconButton.styleFrom(
                minimumSize: const Size(56, 56),
                backgroundColor: AppColors.starGold,
                foregroundColor: Colors.black,
                disabledBackgroundColor: Colors.white12,
                disabledForegroundColor: Colors.white30,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Semantics(
                label: isRtl
                    ? 'الصفحة ${page + 1} من $total'
                    : 'Page ${page + 1} of $total',
                value: '${page + 1} / $total',
                child: Column(
                  children: [
                    Directionality(
                      textDirection: TextDirection.ltr,
                      child: Text(
                        '${page + 1} / $total',
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: total == 0 ? 0 : (page + 1) / total,
                        backgroundColor: Colors.white.withValues(alpha: 0.12),
                        valueColor: const AlwaysStoppedAnimation(
                          AppColors.starGold,
                        ),
                        minHeight: 5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            IconButton.filledTonal(
              tooltip: isRtl ? 'الصفحة التالية' : 'Next page',
              onPressed: onNext,
              icon: Icon(
                isRtl
                    ? Icons.chevron_left_rounded
                    : Icons.chevron_right_rounded,
              ),
              style: IconButton.styleFrom(minimumSize: const Size(48, 48)),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          isRtl
              ? 'اسحب، اضغط الجانبين، أو استخدم الأسهم'
              : 'Swipe, tap the sides, or use arrow keys',
          textAlign: TextAlign.center,
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.55),
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  Widget _buildNarrationRow() {
    switch (narrationState) {
      case NarrationState.loading:
        return Row(
          children: [
            const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: AppColors.starGold,
              ),
            ),
            const SizedBox(width: 10),
            Text(
              isRtl ? 'يُجهَّز السرد…' : 'Preparing narration…',
              style: const TextStyle(color: Colors.white, fontSize: 13),
            ),
          ],
        );
      case NarrationState.error:
        return Row(
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: Colors.redAccent,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                narrationError ??
                    (isRtl
                        ? 'تعذّر تشغيل السرد.'
                        : 'Narration could not be played.'),
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ),
            TextButton(
              onPressed: onRetry,
              child: Text(isRtl ? 'إعادة المحاولة' : 'Retry'),
            ),
          ],
        );
      case NarrationState.unavailable:
        return Row(
          children: [
            const Icon(
              Icons.music_off_rounded,
              color: Colors.white54,
              size: 20,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                narrationUnavailable ?? _unavailableCopy,
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ),
          ],
        );
      case NarrationState.playing:
      case NarrationState.paused:
        if (controller == null) return const SizedBox.shrink();
        return ValueListenableBuilder<VideoPlayerValue>(
          valueListenable: controller!,
          builder: (context, value, _) {
            final totalMs = value.duration.inMilliseconds;
            final progress = totalMs <= 0
                ? 0.0
                : (value.position.inMilliseconds / totalMs).clamp(0.0, 1.0);
            return Semantics(
              label: isRtl ? 'تقدّم السرد' : 'Narration progress',
              value:
                  '${value.position.inSeconds} / ${value.duration.inSeconds}',
              child: Row(
                children: [
                  Icon(
                    value.isPlaying
                        ? Icons.volume_up_rounded
                        : Icons.volume_off_rounded,
                    color: AppColors.starGold,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(99),
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 4,
                        backgroundColor: Colors.white12,
                        valueColor: const AlwaysStoppedAnimation(
                          AppColors.starGold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Directionality(
                    textDirection: TextDirection.ltr,
                    child: Text(
                      '${value.position.inSeconds}s / ${value.duration.inSeconds}s',
                      style: const TextStyle(
                        color: Colors.white60,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      case NarrationState.idle:
        return Row(
          children: [
            const Icon(
              Icons.play_circle_outline_rounded,
              color: AppColors.starGold,
              size: 20,
            ),
            const SizedBox(width: 8),
            Text(
              isRtl ? 'اضغط تشغيل للاستماع' : 'Press play to listen',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        );
    }
  }
}

class _PageTransition extends StatelessWidget {
  const _PageTransition({
    required this.controller,
    required this.index,
    required this.currentPage,
    required this.transition,
    required this.child,
  });

  final PageController controller;
  final int index;
  final int currentPage;
  final String transition;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) return child;
    return AnimatedBuilder(
      animation: controller,
      child: child,
      builder: (context, child) {
        var delta = 0.0;
        if (controller.hasClients && controller.position.haveDimensions) {
          delta = (controller.page ?? currentPage.toDouble()) - index;
        }
        final magnitude = delta.abs().clamp(0.0, 1.0);
        if (transition.toLowerCase().contains('fade')) {
          return Opacity(opacity: 1 - magnitude * 0.35, child: child);
        }
        if (transition.toLowerCase().contains('none')) return child!;
        return Transform.translate(
          offset: Offset(delta.clamp(-1.0, 1.0) * 24, 0),
          child: Opacity(opacity: 1 - magnitude * 0.2, child: child),
        );
      },
    );
  }
}

class StoryPageView extends StatelessWidget {
  const StoryPageView({
    required this.page,
    required this.showText,
    required this.isRtl,
    required this.narrationPositionMs,
    super.key,
  });

  final StoryPage page;
  final bool showText;
  final bool isRtl;
  final int narrationPositionMs;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        return switch (page.layout) {
          'split' => _splitLayout(constraints),
          'text_focus' => _textFocusLayout(),
          'panels' => _panelsLayout(),
          _ => _fullBleedLayout(),
        };
      },
    );
  }

  Widget _fullBleedLayout() {
    return Stack(
      fit: StackFit.expand,
      children: [
        _StoryArtwork(page: page, isRtl: isRtl),
        if (showText && page.hasText)
          Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(20, 38, 20, 18),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.transparent, Color(0xF20B1026)],
                ),
              ),
              child: _TimedStoryText(
                page: page,
                isRtl: isRtl,
                positionMs: narrationPositionMs,
              ),
            ),
          ),
      ],
    );
  }

  Widget _splitLayout(BoxConstraints constraints) {
    final horizontal = constraints.maxWidth >= 650;
    return Flex(
      direction: horizontal ? Axis.horizontal : Axis.vertical,
      children: [
        Expanded(
          flex: 3,
          child: _StoryArtwork(page: page, isRtl: isRtl),
        ),
        if (showText)
          Expanded(
            flex: 2,
            child: _TextPanel(
              page: page,
              isRtl: isRtl,
              positionMs: narrationPositionMs,
            ),
          ),
      ],
    );
  }

  Widget _textFocusLayout() {
    return Column(
      children: [
        if (page.hasImage)
          Expanded(
            flex: 2,
            child: _StoryArtwork(page: page, isRtl: isRtl),
          ),
        if (showText)
          Expanded(
            flex: 3,
            child: _TextPanel(
              page: page,
              isRtl: isRtl,
              positionMs: narrationPositionMs,
              large: true,
            ),
          ),
      ],
    );
  }

  Widget _panelsLayout() {
    // `panels` is one authored comic image with percentage-based bubble
    // overlays. It deliberately does not split or duplicate the artwork because
    // the schema has no independent panel geometry.
    return Column(
      children: [
        Expanded(
          child: _StoryArtwork(page: page, isRtl: isRtl),
        ),
        if (showText && page.hasText)
          _TextPanel(
            page: page,
            isRtl: isRtl,
            positionMs: narrationPositionMs,
            compact: true,
          ),
      ],
    );
  }
}

class _TextPanel extends StatelessWidget {
  const _TextPanel({
    required this.page,
    required this.isRtl,
    required this.positionMs,
    this.large = false,
    this.compact = false,
  });

  final StoryPage page;
  final bool isRtl;
  final int positionMs;
  final bool large;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      color: const Color(0xFF111A3A),
      padding: EdgeInsets.symmetric(
        horizontal: large ? 28 : 18,
        vertical: compact ? 12 : 18,
      ),
      child: page.hasText
          ? Center(
              child: SingleChildScrollView(
                child: _TimedStoryText(
                  page: page,
                  isRtl: isRtl,
                  positionMs: positionMs,
                  fontSize: large ? 24 : 19,
                ),
              ),
            )
          : Center(
              child: Text(
                isRtl
                    ? 'لا يوجد نص بهذه اللغة لهذه الصفحة.'
                    : 'No text is available for this page in this language.',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, fontSize: 13),
              ),
            ),
    );
  }
}

class _TimedStoryText extends StatelessWidget {
  const _TimedStoryText({
    required this.page,
    required this.isRtl,
    required this.positionMs,
    this.fontSize = 19,
  });

  final StoryPage page;
  final bool isRtl;
  final int positionMs;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final body = page.bodyText ?? '';
    StoryTimingCue? activeCue;
    for (final cue in page.timingCues) {
      if (cue.isActiveAt(positionMs)) {
        activeCue = cue;
        break;
      }
    }
    final activeText = activeCue?.text?.trim();
    final activeIndex = activeText == null || activeText.isEmpty
        ? -1
        : body.indexOf(activeText);
    final normalStyle = TextStyle(
      color: Colors.white,
      fontSize: fontSize,
      height: 1.65,
      fontWeight: FontWeight.w600,
    );

    return Directionality(
      textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
      child: Text.rich(
        activeIndex < 0
            ? TextSpan(text: body, style: normalStyle)
            : TextSpan(
                style: normalStyle,
                children: [
                  if (activeIndex > 0)
                    TextSpan(text: body.substring(0, activeIndex)),
                  TextSpan(
                    text: body.substring(
                      activeIndex,
                      activeIndex + activeText!.length,
                    ),
                    style: const TextStyle(
                      color: Color(0xFF191200),
                      backgroundColor: AppColors.starGold,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (activeIndex + activeText.length < body.length)
                    TextSpan(
                      text: body.substring(activeIndex + activeText.length),
                    ),
                ],
              ),
        textAlign: TextAlign.center,
      ),
    );
  }
}

class _StoryArtwork extends StatelessWidget {
  const _StoryArtwork({required this.page, required this.isRtl});

  final StoryPage page;
  final bool isRtl;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFF0B1026),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final canvas = Size(constraints.maxWidth, constraints.maxHeight);
          var artworkRect = Offset.zero & canvas;
          if (page.imageWidth != null &&
              page.imageHeight != null &&
              page.imageWidth! > 0 &&
              page.imageHeight! > 0 &&
              canvas.width.isFinite &&
              canvas.height.isFinite) {
            final fitted = applyBoxFit(
              BoxFit.contain,
              Size(page.imageWidth!.toDouble(), page.imageHeight!.toDouble()),
              canvas,
            );
            artworkRect = Alignment.center.inscribe(
              fitted.destination,
              Offset.zero & canvas,
            );
          }

          return Stack(
            fit: StackFit.expand,
            clipBehavior: Clip.hardEdge,
            children: [
              _StoryImage(page: page, isRtl: isRtl),
              for (final bubble in page.bubbles)
                _BubbleOverlay(
                  bubble: bubble,
                  artworkRect: artworkRect,
                  isRtl: isRtl,
                ),
            ],
          );
        },
      ),
    );
  }
}

class _BubbleOverlay extends StatelessWidget {
  const _BubbleOverlay({
    required this.bubble,
    required this.artworkRect,
    required this.isRtl,
  });

  final StoryBubble bubble;
  final Rect artworkRect;
  final bool isRtl;

  @override
  Widget build(BuildContext context) {
    final left = artworkRect.left + artworkRect.width * bubble.positionX / 100;
    final top = artworkRect.top + artworkRect.height * bubble.positionY / 100;
    final width = artworkRect.width * bubble.width / 100;
    final height = artworkRect.height * bubble.height / 100;
    final background = switch (bubble.kind) {
      'thought' => Colors.white.withValues(alpha: 0.92),
      'caption' => const Color(0xE61B2651),
      'sound' => const Color(0xE6FECA57),
      _ => Colors.white.withValues(alpha: 0.96),
    };
    final foreground = bubble.kind == 'caption' ? Colors.white : Colors.black87;

    return Positioned(
      left: left,
      top: top,
      width: width,
      height: height,
      child: Semantics(
        label: bubble.hasText
            ? bubble.text
            : (isRtl ? 'مؤثر صوتي' : 'Sound effect'),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(
              bubble.kind == 'thought' ? 22 : 10,
            ),
            border: Border.all(color: Colors.black26),
            boxShadow: const [
              BoxShadow(
                color: Colors.black26,
                blurRadius: 5,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Center(
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (bubble.hasAudio) ...[
                    Icon(Icons.volume_up_rounded, size: 15, color: foreground),
                    const SizedBox(width: 4),
                  ],
                  if (bubble.hasText)
                    ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: width - 20),
                      child: Text(
                        bubble.text!,
                        textDirection: isRtl
                            ? TextDirection.rtl
                            : TextDirection.ltr,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: foreground,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                          height: 1.3,
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StoryImage extends StatefulWidget {
  const _StoryImage({required this.page, required this.isRtl});

  final StoryPage page;
  final bool isRtl;

  @override
  State<_StoryImage> createState() => _StoryImageState();
}

class _StoryImageState extends State<_StoryImage> {
  bool _failed = false;
  bool _loading = true;

  String get _semanticLabel =>
      widget.page.altText ??
      (widget.isRtl
          ? 'رسم الصفحة ${widget.page.pageNumber}'
          : 'Artwork for page ${widget.page.pageNumber}');

  @override
  void didUpdateWidget(covariant _StoryImage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.page.imageUrl != widget.page.imageUrl) {
      _failed = false;
      _loading = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.page.hasImage) {
      return _ImageMissing(isRtl: widget.isRtl);
    }
    if (_failed) {
      final local = _localFallbackFor(widget.page.imageUrl);
      if (local != null) {
        return Image.asset(
          local,
          fit: BoxFit.contain,
          width: double.infinity,
          height: double.infinity,
          semanticLabel: _semanticLabel,
          errorBuilder: (context, error, stackTrace) => _ImageLoadFailed(
            isRtl: widget.isRtl,
            onRetry: () => setState(() => _failed = false),
          ),
        );
      }
      return _ImageLoadFailed(
        isRtl: widget.isRtl,
        onRetry: () => setState(() => _failed = false),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        Image.network(
          widget.page.imageUrl!,
          // Flutter Web normally fetches image bytes with XHR, which requires
          // CORS headers from the public CDN. A DOM image can display the same
          // anonymous public artwork without exposing or forwarding credentials.
          webHtmlElementStrategy: WebHtmlElementStrategy.prefer,
          fit: BoxFit.contain,
          width: double.infinity,
          height: double.infinity,
          semanticLabel: _semanticLabel,
          loadingBuilder: (context, child, progress) {
            if (progress == null) {
              if (_loading) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted) setState(() => _loading = false);
                });
              }
              return child;
            }
            return const _ImageLoading();
          },
          errorBuilder: (context, error, stackTrace) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted && !_failed) setState(() => _failed = true);
            });
            return const _ImageLoading();
          },
        ),
        if (_loading) const _ImageLoading(),
      ],
    );
  }
}

class _ImageLoading extends StatelessWidget {
  const _ImageLoading();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFF0B1026),
      child: Center(
        child: SizedBox(
          width: 30,
          height: 30,
          child: CircularProgressIndicator(
            color: AppColors.starGold,
            strokeWidth: 2.5,
          ),
        ),
      ),
    );
  }
}

class _ImageMissing extends StatelessWidget {
  const _ImageMissing({required this.isRtl});

  final bool isRtl;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.image_outlined,
            color: Colors.white.withValues(alpha: 0.35),
            size: 44,
          ),
          const SizedBox(height: 8),
          Text(
            isRtl ? 'لا توجد رسمة لهذه الصفحة' : 'No artwork for this page',
            style: const TextStyle(color: Colors.white60, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

class _ImageLoadFailed extends StatelessWidget {
  const _ImageLoadFailed({required this.isRtl, required this.onRetry});

  final bool isRtl;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.broken_image_outlined,
            color: Colors.white54,
            size: 40,
          ),
          const SizedBox(height: 8),
          Text(
            isRtl ? 'فشل تحميل الصورة' : 'Artwork could not be loaded',
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
          const SizedBox(height: 10),
          OutlinedButton(
            onPressed: onRetry,
            child: Text(isRtl ? 'إعادة المحاولة' : 'Retry'),
          ),
        ],
      ),
    );
  }
}

class _ReaderErrorState extends StatelessWidget {
  const _ReaderErrorState({required this.onRetry, required this.isRtl});

  final VoidCallback? onRetry;
  final bool isRtl;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.cloud_off_rounded,
              color: Colors.white70,
              size: 52,
            ),
            const SizedBox(height: 12),
            Text(
              isRtl
                  ? 'تعذّر تحميل صفحات القصة.'
                  : 'Story pages could not be loaded.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              isRtl
                  ? 'تحقّق من الاتصال ثم حاول مرة أخرى. لم نستبدل القصة بمحتوى آخر.'
                  : 'Check your connection and retry. No other story was substituted.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 13),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh_rounded),
                label: Text(isRtl ? 'إعادة المحاولة' : 'Retry'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _UnavailableState extends StatelessWidget {
  const _UnavailableState({
    required this.title,
    required this.isRtl,
    this.subtitle,
  });

  final String title;
  final String? subtitle;
  final bool isRtl;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.menu_book_outlined,
              color: Colors.white70,
              size: 52,
            ),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60, fontSize: 13),
              ),
            ],
            const SizedBox(height: 16),
            Text(
              isRtl
                  ? 'لم تُنشر صفحات هذه القصة بعد.'
                  : 'This story has no published pages yet.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => context.pop(),
              child: Text(isRtl ? 'رجوع' : 'Back'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ModeTile extends StatelessWidget {
  const _ModeTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return ListTile(
      enabled: enabled,
      minVerticalPadding: 10,
      leading: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: enabled ? 0.12 : 0.04),
        ),
        child: Icon(icon, color: enabled ? Colors.white : Colors.white30),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: enabled ? Colors.white : Colors.white38,
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          color: Colors.white.withValues(alpha: enabled ? 0.65 : 0.35),
          fontSize: 12,
        ),
      ),
      trailing: enabled
          ? const Icon(Icons.chevron_left_rounded, color: Colors.white60)
          : null,
      onTap: onTap,
    );
  }
}
