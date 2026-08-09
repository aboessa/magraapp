import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/env/app_environment.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../child/application/child_provider.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/domain/content_models.dart';
import '../../application/reader_narration.dart';

enum ReadingMode { readMyself, readToMe, readTogether, silent }

/// Story reader.
///
/// The previous version shipped a hardcoded four-page story about a rabbit and a
/// treasure map, with emoji standing in for artwork, and displayed it for *every*
/// book the user opened. A child opening "حكاية الصدق" was shown the rabbit
/// story under that title, which is worse than showing nothing.
///
/// This version renders [StoryPage] data supplied by the caller and shows an
/// explicit unavailable state when a story has no published pages. Page content
/// lives in `story_pages` / `story_page_localizations` in D1, but there is no
/// public endpoint serving it yet and the seeded rows carry no artwork, so most
/// books legitimately reach the empty state today.
class StoryReaderPage extends ConsumerStatefulWidget {
  const StoryReaderPage({
    required this.title,
    this.subtitle,
    this.pages = const [],
    this.loading = false,
    this.isComic = false,
    this.bookId,
    super.key,
  });

  final String title;
  final String? subtitle;

  /// Pages in reading order. Empty means the story is not published yet.
  final List<StoryPage> pages;

  /// True while pages are still being fetched. Distinguished from "no pages" so
  /// the unavailable state is not shown before the request completes.
  final bool loading;

  /// Comic layouts keep a single page per view even on a tablet, because panel
  /// artwork is composed to be read one page at a time.
  final bool isComic;

  /// The book id, required for "اقرأ لي": narration is a private per-page asset
  /// reached through a capability token. Null for the series reader, where the
  /// narration modes stay unavailable.
  final String? bookId;

  @override
  ConsumerState<StoryReaderPage> createState() => _StoryReaderPageState();
}

class _StoryReaderPageState extends ConsumerState<StoryReaderPage> {
  final PageController _ctrl = PageController();
  int _page = 0;
  ReadingMode _mode = ReadingMode.readMyself;
  bool _showText = true;
  bool _modeChosen = false;

  // --- Read-To-Me narration state ---
  VideoPlayerController? _narration;
  bool _narrationLoading = false;
  String? _narrationUnavailable;
  int _narrationToken = 0; // guards against races when pages change fast.

  List<StoryPage> get _pages => widget.pages;

  bool get _canNarrate => (widget.bookId ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    // Only offer the mode picker when there is something to read.
    if (_pages.isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _showModePicker());
    }
  }

  @override
  void dispose() {
    _disposeNarration();
    _ctrl.dispose();
    super.dispose();
  }

  void _disposeNarration() {
    _narration?.removeListener(_onNarrationTick);
    _narration?.dispose();
    _narration = null;
  }

  /// Loads and starts narration for the current page.
  ///
  /// Each call bumps [_narrationToken]; a slower in-flight request for a page the
  /// child has already swiped past checks the token before touching state, so a
  /// late response cannot start audio for the wrong page.
  Future<void> _loadNarrationForCurrentPage() async {
    if (!_canNarrate || _pages.isEmpty) return;
    final childId = ref.read(childProvider).activeChildId;
    final token = ++_narrationToken;

    _disposeNarration();
    setState(() {
      _narrationLoading = true;
      _narrationUnavailable = null;
    });

    if (childId == null || childId.isEmpty) {
      if (mounted && token == _narrationToken) {
        setState(() {
          _narrationLoading = false;
          _narrationUnavailable = 'اختر ملف طفل أولًا لتشغيل الصوت.';
        });
      }
      return;
    }

    final source = await fetchPageNarration(
      ref.read(majarraApiClientProvider),
      bookId: widget.bookId!,
      childId: childId,
      pageId: _pages[_page].id,
    );
    if (!mounted || token != _narrationToken) return;

    if (source is NarrationUnavailable) {
      setState(() {
        _narrationLoading = false;
        _narrationUnavailable = source.reason;
      });
      return;
    }

    final playable = source as NarrationPlayable;
    final uri = Uri.parse(ApiEnvironment.baseUrl).resolve(playable.streamUrl);
    final controller = VideoPlayerController.networkUrl(
      uri,
      httpHeaders: {'Authorization': playable.authorization},
    );
    try {
      await controller.initialize();
      if (!mounted || token != _narrationToken) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onNarrationTick);
      setState(() {
        _narration = controller;
        _narrationLoading = false;
      });
      await controller.play();
    } catch (_) {
      await controller.dispose();
      if (!mounted || token != _narrationToken) return;
      setState(() {
        _narrationLoading = false;
        _narrationUnavailable = 'تعذّر تشغيل الصوت. حاول مرة أخرى.';
      });
    }
  }

  /// Advances to the next page when the current page's narration finishes, so a
  /// child listening hands-free moves through the story on its own.
  void _onNarrationTick() {
    final value = _narration?.value;
    if (value == null || !mounted) return;
    final finished = value.duration > Duration.zero &&
        value.position >= value.duration &&
        !value.isPlaying;
    if (finished && _page < _pages.length - 1) {
      _ctrl.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _toggleNarration() async {
    final c = _narration;
    if (c == null) return;
    if (c.value.isPlaying) {
      await c.pause();
    } else {
      if (c.value.position >= c.value.duration) await c.seekTo(Duration.zero);
      await c.play();
    }
    if (mounted) setState(() {});
  }

  Future<void> _restartNarration() async {
    final c = _narration;
    if (c == null) return;
    await c.seekTo(Duration.zero);
    await c.play();
    if (mounted) setState(() {});
  }

  void _onPageChanged(int index) {
    setState(() => _page = index);
    if (_mode == ReadingMode.readToMe) {
      _loadNarrationForCurrentPage();
    }
  }

  void _showModePicker() {
    if (_modeChosen || !mounted) return;
    showModalBottomSheet<void>(
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
              const Text(
                'كيف تريد القراءة؟',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 14),
              _ModeTile(
                icon: Icons.person_rounded,
                title: 'اقرأ بنفسي',
                subtitle: 'أقلب الصفحات بنفسي',
                onTap: () => _choose(sheetContext, ReadingMode.readMyself),
              ),
              _ModeTile(
                icon: Icons.visibility_off_rounded,
                title: 'قصة صامتة',
                subtitle: 'صور فقط لتنمية الملاحظة',
                onTap: () => _choose(sheetContext, ReadingMode.silent),
              ),
              // "اقرأ لي": per-page narration through a capability token. Enabled
              // whenever this is a book (has a bookId). If a given page has no
              // recorded narration the runtime shows a truthful per-page notice
              // rather than pretending — narration recordings are content that
              // is still being produced.
              _ModeTile(
                icon: Icons.volume_up_rounded,
                title: 'اقرأ لي',
                subtitle: _canNarrate
                    ? 'أستمع للسرد وتُقلب الصفحات تلقائيًا'
                    : 'متاح لقصص الكتب فقط',
                onTap: _canNarrate
                    ? () => _choose(sheetContext, ReadingMode.readToMe)
                    : null,
              ),
              // "اقرأ معي" needs per-word timing to highlight text in sync with
              // the narration. The content contract carries only page-level
              // duration, not word timing, so this stays honestly unavailable.
              const _ModeTile(
                icon: Icons.groups_rounded,
                title: 'اقرأ معي',
                subtitle: 'يحتاج توقيت الكلمات مع الصوت — غير متاح بعد',
                onTap: null,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _choose(BuildContext sheetContext, ReadingMode mode) {
    Navigator.pop(sheetContext);
    setState(() {
      _mode = mode;
      _modeChosen = true;
      _showText = mode != ReadingMode.silent;
    });
    if (mode == ReadingMode.readToMe) {
      _loadNarrationForCurrentPage();
    } else {
      _disposeNarration();
      setState(() => _narrationUnavailable = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTablet = MediaQuery.sizeOf(context).width >= 600;
    final hasPages = _pages.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Column(
            children: [
              _TopBar(
                title: widget.title,
                showTextToggle: hasPages,
                textVisible: _showText,
                onToggleText: () => setState(() => _showText = !_showText),
                onBack: () => context.pop(),
              ),
              if (widget.loading)
                // Distinct from the unavailable state: pages may still arrive.
                const Expanded(
                  child: Center(
                    child: CircularProgressIndicator(
                      color: AppColors.starGold,
                    ),
                  ),
                )
              else if (!hasPages)
                Expanded(
                  child: _UnavailableState(
                    title: widget.title,
                    subtitle: widget.subtitle,
                  ),
                )
              else ...[
                _ModeBanner(
                  mode: _mode,
                  onChange: () {
                    _modeChosen = false;
                    _showModePicker();
                  },
                ),
                const SizedBox(height: 8),
                _ProgressHeader(
                  page: _page,
                  total: _pages.length,
                  color: _modeColor(),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: isTablet ? 32 : 18,
                    ),
                    child: isTablet && !widget.isComic
                        ? _TabletSpread(
                            pages: _pages,
                            index: _page,
                            showText: _showText,
                            mode: _mode,
                          )
                        : PageView.builder(
                            controller: _ctrl,
                            onPageChanged: _onPageChanged,
                            itemCount: _pages.length,
                            itemBuilder: (context, idx) => Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: _PageCard(
                                page: _pages[idx],
                                showText: _showText,
                                mode: _mode,
                                isComic: widget.isComic,
                              ),
                            ),
                          ),
                  ),
                ),
                if (_mode == ReadingMode.readToMe)
                  _NarrationBar(
                    loading: _narrationLoading,
                    unavailable: _narrationUnavailable,
                    controller: _narration,
                    onToggle: _toggleNarration,
                    onRestart: _restartNarration,
                  ),
                _PagerControls(
                  page: _page,
                  total: _pages.length,
                  mode: _mode,
                  onPrevious: _page > 0
                      ? () => _ctrl.previousPage(
                          duration: const Duration(milliseconds: 320),
                          curve: Curves.easeOutCubic,
                        )
                      : null,
                  onNext: _page < _pages.length - 1
                      ? () => _ctrl.nextPage(
                          duration: const Duration(milliseconds: 320),
                          curve: Curves.easeOutCubic,
                        )
                      : null,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Color _modeColor() => switch (_mode) {
    ReadingMode.readMyself => AppColors.mutedText,
    ReadingMode.readToMe => AppColors.starGold,
    ReadingMode.readTogether => AppColors.electricCyan,
    ReadingMode.silent => AppColors.cosmicPurple,
  };
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.showTextToggle,
    required this.textVisible,
    required this.onToggleText,
    required this.onBack,
  });

  final String title;
  final bool showTextToggle;
  final bool textVisible;
  final VoidCallback onToggleText;
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
        if (showTextToggle)
          IconButton(
            icon: Icon(
              textVisible
                  ? Icons.visibility_rounded
                  : Icons.visibility_off_rounded,
              color: Colors.white,
              size: 18,
            ),
            tooltip: textVisible ? 'إخفاء النص' : 'إظهار النص',
            onPressed: onToggleText,
          ),
      ],
    ),
  );
}

class _ModeBanner extends StatelessWidget {
  const _ModeBanner({required this.mode, required this.onChange});

  final ReadingMode mode;
  final VoidCallback onChange;

  @override
  Widget build(BuildContext context) {
    final (label, icon, color) = switch (mode) {
      ReadingMode.readMyself => (
        'اقرأ بنفسي',
        Icons.person_rounded,
        AppColors.mutedText,
      ),
      ReadingMode.readToMe => (
        'اقرأ لي',
        Icons.volume_up_rounded,
        AppColors.starGold,
      ),
      ReadingMode.readTogether => (
        'اقرأ معي',
        Icons.groups_rounded,
        AppColors.electricCyan,
      ),
      ReadingMode.silent => (
        'قصة صامتة',
        Icons.visibility_off_rounded,
        AppColors.cosmicPurple,
      ),
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 18),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.22)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: color, size: 14),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: onChange,
              style: TextButton.styleFrom(
                padding: EdgeInsets.zero,
                minimumSize: const Size(0, 0),
              ),
              child: Text(
                'تغيير',
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.72),
                  fontSize: 10,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.page,
    required this.total,
    required this.color,
  });

  final int page;
  final int total;
  final Color color;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(99),
          child: LinearProgressIndicator(
            value: total == 0 ? 0 : (page + 1) / total,
            backgroundColor: Colors.white.withValues(alpha: 0.08),
            valueColor: AlwaysStoppedAnimation(color),
            minHeight: 4,
          ),
        ),
      ),
      const SizedBox(height: 8),
      Text(
        '${page + 1} / $total',
        style: TextStyle(
          color: AppColors.mutedText.withValues(alpha: 0.62),
          fontSize: 11,
        ),
      ),
    ],
  );
}

/// Two-page spread for tablets, mirroring a physical book.
class _TabletSpread extends StatelessWidget {
  const _TabletSpread({
    required this.pages,
    required this.index,
    required this.showText,
    required this.mode,
  });

  final List<StoryPage> pages;
  final int index;
  final bool showText;
  final ReadingMode mode;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: _PageCard(
          page: pages[index],
          showText: showText,
          mode: mode,
          isComic: false,
        ),
      ),
      const SizedBox(width: 12),
      Expanded(
        child: index < pages.length - 1
            ? _PageCard(
                page: pages[index + 1],
                showText: showText,
                mode: mode,
                isComic: false,
              )
            : const _BlankPage(),
      ),
    ],
  );
}

class _BlankPage extends StatelessWidget {
  const _BlankPage();

  @override
  Widget build(BuildContext context) => DecoratedBox(
    decoration: BoxDecoration(
      color: const Color(0xFF0B1026).withValues(alpha: 0.42),
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: Colors.white.withValues(alpha: 0.04)),
    ),
  );
}

class _PageCard extends StatelessWidget {
  const _PageCard({
    required this.page,
    required this.showText,
    required this.mode,
    required this.isComic,
  });

  final StoryPage page;
  final bool showText;
  final ReadingMode mode;
  final bool isComic;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF111A3A).withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.22),
            blurRadius: 16,
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          Expanded(
            child: page.hasImage
                ? CinematicImage(
                    // Artwork is remote-only; there is no bundled page art.
                    assetPath: 'assets/brand/majarra-logo.png',
                    networkUrl: page.imageUrl,
                    semanticLabel: page.altText ?? 'صفحة ${page.pageNumber}',
                    fit: BoxFit.cover,
                  )
                : const _MissingArt(),
          ),
          if (showText && page.hasText)
            Padding(
              padding: const EdgeInsets.all(18),
              child: Text(
                page.bodyText!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.92),
                  fontSize: isComic ? 13 : 15,
                  height: 1.8,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          else if (showText)
            Padding(
              padding: const EdgeInsets.all(18),
              child: Text(
                'لا يوجد نص لهذه الصفحة بعد.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.62),
                  fontSize: 11,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Shown for a page whose `image_asset_id` is still null.
class _MissingArt extends StatelessWidget {
  const _MissingArt();

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.indigoSurface.withValues(alpha: 0.42),
    child: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            Icons.image_outlined,
            color: AppColors.mutedText.withValues(alpha: 0.4),
            size: 34,
          ),
          const SizedBox(height: 8),
          Text(
            'رسمة الصفحة قادمة',
            style: TextStyle(
              color: AppColors.mutedText.withValues(alpha: 0.52),
              fontSize: 10.5,
            ),
          ),
        ],
      ),
    ),
  );
}

/// Shown when a story has no published pages at all.
class _UnavailableState extends StatelessWidget {
  const _UnavailableState({required this.title, this.subtitle});

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              Icons.menu_book_outlined,
              color: AppColors.mutedText.withValues(alpha: 0.5),
              size: 52,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 6),
              Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.mutedText.withValues(alpha: 0.72),
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.indigoSurface.withValues(alpha: 0.62),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: AppColors.starGold.withValues(alpha: 0.24),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    color: AppColors.starGold,
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'لم تُنشر صفحات هذه القصة بعد. سيفتح القارئ تلقائيًا عند '
                      'إتاحة النصوص والرسومات.',
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.86),
                        fontSize: 11.5,
                        height: 1.7,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),
            FilledButton(
              autofocus: true,
              onPressed: () => context.pop(),
              child: const Text('رجوع'),
            ),
          ],
        ),
      ),
    );
  }
}

class _PagerControls extends StatelessWidget {
  const _PagerControls({
    required this.page,
    required this.total,
    required this.mode,
    required this.onPrevious,
    required this.onNext,
  });

  final int page;
  final int total;
  final ReadingMode mode;
  final VoidCallback? onPrevious;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
    child: Row(
      children: [
        IconButton(
          onPressed: onPrevious,
          tooltip: 'الصفحة السابقة',
          icon: Icon(
            Icons.arrow_forward_rounded,
            color: onPrevious == null
                ? AppColors.mutedText.withValues(alpha: 0.32)
                : Colors.white,
          ),
        ),
        Expanded(
          child: Center(
            child: Text(
              mode == ReadingMode.silent ? 'لاحظ التفاصيل' : 'اسحب للتقليب',
              style: TextStyle(
                color: AppColors.mutedText.withValues(alpha: 0.52),
                fontSize: 11,
              ),
            ),
          ),
        ),
        IconButton(
          onPressed: onNext,
          tooltip: 'الصفحة التالية',
          icon: Icon(
            Icons.arrow_back_rounded,
            color: onNext == null
                ? AppColors.mutedText.withValues(alpha: 0.32)
                : Colors.white,
          ),
        ),
      ],
    ),
  );
}

/// Read-To-Me transport for the current page.
///
/// Shows a spinner while a page's narration is being fetched, a truthful notice
/// when the page has no recorded narration, or play/pause + restart controls
/// when it does. The bar only appears in [ReadingMode.readToMe].
class _NarrationBar extends StatelessWidget {
  const _NarrationBar({
    required this.loading,
    required this.unavailable,
    required this.controller,
    required this.onToggle,
    required this.onRestart,
  });

  final bool loading;
  final String? unavailable;
  final VideoPlayerController? controller;
  final VoidCallback onToggle;
  final VoidCallback onRestart;

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (loading) {
      body = const Row(
        children: [
          SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.starGold),
          ),
          SizedBox(width: 12),
          Text('يُجهَّز الصوت…', style: TextStyle(color: Colors.white, fontSize: 12)),
        ],
      );
    } else if (unavailable != null) {
      body = Row(
        children: [
          const Icon(Icons.music_off_rounded, color: AppColors.mutedText, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              unavailable!,
              style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.86), fontSize: 11.5),
            ),
          ),
        ],
      );
    } else if (controller != null) {
      body = ValueListenableBuilder<VideoPlayerValue>(
        valueListenable: controller!,
        builder: (context, value, _) {
          final total = value.duration.inMilliseconds;
          final progress = total <= 0
              ? 0.0
              : (value.position.inMilliseconds / total).clamp(0.0, 1.0).toDouble();
          return Row(
            children: [
              Semantics(
                button: true,
                label: value.isPlaying ? 'إيقاف السرد' : 'تشغيل السرد',
                child: IconButton(
                  onPressed: onToggle,
                  icon: Icon(
                    value.isPlaying ? Icons.pause_circle_rounded : Icons.play_circle_rounded,
                    color: AppColors.starGold,
                    size: 34,
                  ),
                ),
              ),
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 4,
                    backgroundColor: Colors.white.withValues(alpha: 0.08),
                    valueColor: const AlwaysStoppedAnimation(AppColors.starGold),
                  ),
                ),
              ),
              IconButton(
                onPressed: onRestart,
                tooltip: 'إعادة السرد',
                icon: const Icon(Icons.replay_rounded, color: Colors.white, size: 20),
              ),
            ],
          );
        },
      );
    } else {
      body = const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 4, 18, 0),
      child: Container(
        padding: const EdgeInsetsDirectional.fromSTEB(12, 4, 4, 4),
        decoration: BoxDecoration(
          color: AppColors.indigoSurface.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.starGold.withValues(alpha: 0.18)),
        ),
        child: body,
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
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.indigoSurface.withValues(alpha: enabled ? 1 : 0.5),
        ),
        child: Icon(
          icon,
          color: enabled ? Colors.white : Colors.white.withValues(alpha: 0.38),
        ),
      ),
      title: Text(
        title,
        style: TextStyle(
          color: enabled ? Colors.white : Colors.white.withValues(alpha: 0.45),
          fontWeight: FontWeight.w700,
          fontSize: 13,
        ),
      ),
      subtitle: Text(
        subtitle,
        style: TextStyle(
          color: AppColors.mutedText.withValues(alpha: enabled ? 0.72 : 0.45),
          fontSize: 11,
        ),
      ),
      trailing: enabled
          ? const Icon(Icons.chevron_left_rounded, color: AppColors.mutedText)
          : null,
      onTap: onTap,
    );
  }
}
