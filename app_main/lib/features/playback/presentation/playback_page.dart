import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:video_player/video_player.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/security/playback_watermark.dart';
import '../../../core/security/screen_capture_guard.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';
import '../../home/domain/content_models.dart';
import '../../profile/data/progress_store.dart';

/// Cinematic player backed by a real [VideoPlayerController].
///
/// Behaviour when [EpisodeItem.videoUrl] is missing: the page stays on a poster
/// state with an explicit message instead of throwing, so catalog entries that
/// have no uploaded asset yet remain browsable.
class PlaybackPage extends ConsumerStatefulWidget {
  const PlaybackPage({required this.episodeId, super.key});
  final String episodeId;

  @override
  ConsumerState<PlaybackPage> createState() => _PlaybackPageState();
}

class _PlaybackPageState extends ConsumerState<PlaybackPage> {
  VideoPlayerController? _controller;
  Timer? _hideTimer;

  bool _showControls = true;
  bool _muted = false;
  bool _captions = false;
  bool _fullscreen = false;
  bool _initialising = false;
  String? _error;
  String _quality = 'تلقائي';
  double _speed = 1;

  /// Last observed transport state. Used to rebuild only when the play/pause or
  /// buffering icon would actually change, instead of on every position tick.
  bool _wasPlaying = false;
  bool _wasBuffering = false;

  /// Episode currently bound to [_controller]; guards against rebuilding the
  /// controller on every catalog emission.
  String? _boundEpisodeId;

  // ------------------------------------------------------------ progress sync

  /// Periodic reporter for `POST /api/v1/family/progress`.
  ///
  /// Previously nothing in the app ever called `updateProgress`, so resume
  /// position, continue-watching and the parent dashboard's watch time all had
  /// no source data. Reporting on a timer rather than on every controller tick
  /// keeps this to roughly four requests per minute.
  Timer? _progressTimer;

  /// Captured during bind so [dispose] can send a final position without calling
  /// `ref` after the element is unmounted.
  MajarraApiClient? _api;
  String? _reportingChildId;

  /// Last position actually accepted by the server, used to skip no-op reports
  /// while the video is paused.
  int _lastReportedMs = -1;

  /// Position the player was seeked to on open, when resuming a part-watched
  /// episode. Kept so the UI can acknowledge the jump instead of silently
  /// starting mid-episode, which reads as a bug.
  Duration? _resumedFrom;

  /// Pseudonymous forensic watermark label.
  ///
  /// Computed once per binding rather than per frame: the tag is bucketed to the
  /// hour, so recomputing it on every rebuild would burn a SHA-256 for an
  /// identical result. Empty until an account id is available, which the widget
  /// treats as "draw nothing" instead of inventing a tag.
  String _watermarkTag = '';

  static const _progressInterval = Duration(seconds: 15);

  /// Saved position for [episodeId], or null when there is nothing to resume.
  ///
  /// Read from the already-fetched progress map rather than issuing another
  /// request, so opening an episode costs no extra round trip.
  Duration? _resumePosition(String episodeId) {
    final saved = ref.read(progressProvider).valueOrNull?[episodeId];
    if (saved == null || !saved.isResumable) return null;
    return saved.position;
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _progressTimer?.cancel();
    // Fire-and-forget the final position before tearing the controller down.
    // Awaiting is not possible here, and a dropped final report is acceptable:
    // the periodic reports already bound how much progress can be lost.
    _reportProgress(isFinal: true);
    _controller?.removeListener(_onPlayerTick);
    _controller?.dispose();
    // Always restore the chrome the page mutated, even on an error exit.
    SystemChrome.setPreferredOrientations(DeviceOrientation.values);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    // Release the capture block so screenshots work again outside playback.
    const ScreenCaptureGuard().disable();
    super.dispose();
  }

  /// Sends the current position, if there is anything meaningful to send.
  ///
  /// Skipped entirely when no child profile is active: the endpoint requires a
  /// `childId`, and inventing one would attribute watch time to the wrong
  /// profile. Failures are swallowed — progress sync must never interrupt
  /// playback or surface an error over the video.
  void _reportProgress({bool isFinal = false}) {
    final api = _api;
    final childId = _reportingChildId;
    final value = _controller?.value;
    if (api == null || childId == null || value == null) return;
    if (!value.isInitialized) return;

    final positionMs = value.position.inMilliseconds;
    final durationMs = value.duration.inMilliseconds;
    if (durationMs <= 0) return;
    // A paused player reports once, then stops repeating the same position.
    if (!isFinal && positionMs == _lastReportedMs) return;

    _lastReportedMs = positionMs;
    final episodeId = _boundEpisodeId;
    if (episodeId == null) return;

    // `event_id` gives the Durable Object an idempotency key, so a retried or
    // duplicated request is not counted twice.
    final eventId =
        '$episodeId-$childId-${DateTime.now().microsecondsSinceEpoch}';

    api
        .updateProgress(
          childId: childId,
          contentId: episodeId,
          positionMs: positionMs,
          durationMs: durationMs,
          eventId: eventId,
        )
        .catchError((Object _) => <String, dynamic>{});
  }

  void _startProgressReporting() {
    _progressTimer?.cancel();
    if (_reportingChildId == null) return;
    _progressTimer = Timer.periodic(_progressInterval, (_) {
      if (!mounted) return;
      if (_controller?.value.isPlaying ?? false) _reportProgress();
    });
  }

  // ---------------------------------------------------------------- lifecycle

  Future<void> _bind(EpisodeItem episode) async {
    if (_boundEpisodeId == episode.id || _initialising) return;
    _boundEpisodeId = episode.id;

    final source = episode.videoUrl;
    if (source == null || source.isEmpty) return;

    final previous = _controller;
    setState(() {
      _initialising = true;
      _error = null;
      _controller = null;
    });
    previous?.removeListener(_onPlayerTick);
    await previous?.dispose();

    final controller = VideoPlayerController.networkUrl(
      Uri.parse(source),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: false),
      closedCaptionFile: _captionsLoader(episode),
    );

    try {
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onPlayerTick);
      await controller.setVolume(_muted ? 0 : 1);

      // Resume from the saved position before starting, so playback never jumps
      // after the first frame. Applied only when the stored position is inside
      // the real duration: a stale position past the end would otherwise leave
      // the player parked on the closing frame.
      final resumeAt = _resumePosition(episode.id);
      if (resumeAt != null && resumeAt < controller.value.duration) {
        await controller.seekTo(resumeAt);
        _resumedFrom = resumeAt;
      }

      await controller.play();
      setState(() {
        _controller = controller;
        _initialising = false;
      });
      _scheduleHide();
      // Surfaced after the first frame so the snackbar does not compete with
      // the loading state.
      _announceResume();

      // Block platform screen capture for the duration of playback. Enabled
      // here rather than in initState so it is only applied once a licensed
      // stream is actually decoding.
      await const ScreenCaptureGuard().enable();

      // Capture the reporting dependencies now, while the element is still
      // mounted, so `dispose` can send a final position without touching `ref`.
      _api = ref.read(majarraApiClientProvider);
      _reportingChildId = ref.read(childProvider).activeChildId;
      _lastReportedMs = -1;
      _startProgressReporting();

      // Forensic watermark label. Derived from the account id only, hashed, and
      // bucketed to the hour — no child id, nickname or email reaches the screen
      // (`تشفير المحتوي.md:1139`).
      final accountId = await ref.read(authStorageProvider).getParentId();
      if (!mounted) return;
      setState(() => _watermarkTag = watermarkTag(parentId: accountId));
    } catch (error) {
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _initialising = false;
        _error = 'تعذّر تشغيل الحلقة. تحقّق من الاتصال وحاول مرة أخرى.';
      });
    }
  }

  /// Fetches the WebVTT track lazily. A failed or missing track resolves to an
  /// empty file so a caption problem never prevents the video from starting.
  Future<ClosedCaptionFile>? _captionsLoader(EpisodeItem episode) {
    final url = episode.captionsUrl;
    if (url == null || url.isEmpty) return null;
    return Future(() async {
      try {
        final response = await http.get(Uri.parse(url));
        if (response.statusCode != 200) return WebVTTCaptionFile('');
        return WebVTTCaptionFile(utf8.decode(response.bodyBytes));
      } catch (_) {
        return WebVTTCaptionFile('');
      }
    });
  }

  /// Listener for player state changes.
  ///
  /// Deliberately does NOT call `setState` for ordinary position ticks: the
  /// controller notifies roughly every frame, and rebuilding the whole page at
  /// that rate wasted work on TV GPUs. The progress row instead listens to the
  /// controller directly through [_ProgressListener], so only the seek bar and
  /// timestamps rebuild. This method handles the state transitions that really
  /// do affect the surrounding chrome.
  void _onPlayerTick() {
    if (!mounted) return;
    final controller = _controller;
    if (controller == null) return;
    final value = controller.value;

    if (value.hasError && _error == null) {
      setState(() => _error = 'انقطع التشغيل. حاول مرة أخرى.');
      return;
    }

    // Keep controls visible when playback ends so the next action is reachable.
    final ended = value.duration > Duration.zero &&
        value.position >= value.duration;
    if (ended && !_showControls) {
      setState(() => _showControls = true);
      return;
    }

    // Play/pause and buffering changes flip icons, so mirror them into state
    // only when they actually change.
    if (_wasPlaying != value.isPlaying || _wasBuffering != value.isBuffering) {
      setState(() {
        _wasPlaying = value.isPlaying;
        _wasBuffering = value.isBuffering;
      });
    }
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      final playing = _controller?.value.isPlaying ?? false;
      if (playing && mounted) setState(() => _showControls = false);
    });
  }

  void _revealControls() {
    setState(() => _showControls = true);
    _scheduleHide();
  }

  /// Tells the viewer the episode did not start from the beginning.
  ///
  /// Without this the player silently opens part-way through, which reads as a
  /// bug rather than as a resumed session. Offers a one-tap way back to the
  /// start, so resuming is never a trap.
  void _announceResume() {
    final resumedFrom = _resumedFrom;
    if (resumedFrom == null || !mounted) return;
    // Only announce once per binding.
    _resumedFrom = null;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 5),
        content: Text('تابعنا من ${_formatPosition(resumedFrom)}'),
        action: SnackBarAction(
          label: 'من البداية',
          onPressed: () {
            _controller?.seekTo(Duration.zero);
            _revealControls();
          },
        ),
      ),
    );
  }

  static String _formatPosition(Duration value) {
    final minutes = value.inMinutes;
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  // ------------------------------------------------------------------ actions

  Future<void> _togglePlay() async {
    final controller = _controller;
    if (controller == null) return;
    await HapticFeedback.lightImpact();
    if (controller.value.isPlaying) {
      await controller.pause();
      _hideTimer?.cancel();
      setState(() => _showControls = true);
    } else {
      await controller.play();
      _scheduleHide();
    }
  }

  Future<void> _seekBy(Duration delta) async {
    final controller = _controller;
    if (controller == null) return;
    final target = controller.value.position + delta;
    final duration = controller.value.duration;
    await controller.seekTo(
      target < Duration.zero
          ? Duration.zero
          : (target > duration ? duration : target),
    );
    _revealControls();
  }

  Future<void> _toggleMute() async {
    final controller = _controller;
    setState(() => _muted = !_muted);
    await controller?.setVolume(_muted ? 0 : 1);
    _revealControls();
  }

  Future<void> _toggleFullscreen() async {
    setState(() => _fullscreen = !_fullscreen);
    if (_fullscreen) {
      await SystemChrome.setPreferredOrientations(const [
        DeviceOrientation.landscapeLeft,
        DeviceOrientation.landscapeRight,
      ]);
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    } else {
      await SystemChrome.setPreferredOrientations(DeviceOrientation.values);
      await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
    _revealControls();
  }

  void _goToNext(HomeCatalog catalog, EpisodeItem current) {
    final siblings =
        catalog.episodes.where((e) => e.seriesId == current.seriesId).toList();
    final index = siblings.indexWhere((e) => e.id == current.id);
    if (index < 0 || index + 1 >= siblings.length) {
      _snack('هذه آخر حلقة في السلسلة.');
      return;
    }
    final next = siblings[index + 1];
    _boundEpisodeId = null;
    context.pushReplacement('/playback/${next.id}');
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  // -------------------------------------------------------------------- build

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(homeCatalogProvider).valueOrNull;
    final episode =
        catalog?.episodes.where((e) => e.id == widget.episodeId).firstOrNull;
    final series = episode != null
        ? catalog?.series.where((s) => s.id == episode.seriesId).firstOrNull
        : null;

    if (episode == null) {
      return _MissingEpisode(onBack: () => context.pop());
    }

    // Bind after the frame so the first paint is not blocked by network I/O.
    WidgetsBinding.instance.addPostFrameCallback((_) => _bind(episode));

    final controller = _controller;
    final value = controller?.value;
    final isPlaying = value?.isPlaying ?? false;
    // Used until the controller reports a real duration, so the scrubber shows a
    // plausible length instead of 0:00 during initialisation.
    final fallbackDuration = Duration(seconds: episode.durationSeconds);

    return Scaffold(
      backgroundColor: Colors.black,
      body: _PlayerShortcuts(
        onPlayPause: _togglePlay,
        onForward: () => _seekBy(const Duration(seconds: 10)),
        onRewind: () => _seekBy(const Duration(seconds: -10)),
        onReveal: _revealControls,
        onBack: () => context.pop(),
        child: GestureDetector(
          onTap: () {
            setState(() => _showControls = !_showControls);
            if (_showControls) _scheduleHide();
          },
          child: Stack(
            fit: StackFit.expand,
            children: [
              _Surface(
                controller: controller,
                episode: episode,
                initialising: _initialising,
                error: _error,
              ),
              // Forensic watermark. Drawn above the video but BELOW the caption
              // overlay and controls, so it can never obscure subtitles or
              // teaching text — see `تشفير المحتوي.md:1140`. Only shown once a
              // stream is actually decoding.
              //
              // `isFree` lives on the series, not the episode, so an unresolved
              // series means the tier is unknown. That case marks rather than
              // skips: a watermark on free content is a small cosmetic cost,
              // while omitting one from paid content loses the audit trail.
              if (controller != null && series?.isFree != true)
                PlaybackWatermark(tag: _watermarkTag),
              if (_captions && controller != null)
                // Rebuilds on its own so caption changes do not require a full
                // page rebuild on every tick.
                _ProgressListener(
                  controller: controller,
                  builder: (context, playerValue) =>
                      _CaptionOverlay(text: playerValue?.caption.text ?? ''),
                ),
              if (_showControls)
                const _Scrim(),
              if (_showControls)
                _TopBar(
                  title: episode.title,
                  subtitle: series?.title ?? '',
                  captions: _captions,
                  onBack: () => context.pop(),
                  onCaptions: () {
                    setState(() => _captions = !_captions);
                    _revealControls();
                  },
                  onMore: _showSettingsSheet,
                ),
              if (_showControls)
                _CenterControls(
                  playing: isPlaying,
                  busy: _initialising,
                  enabled: controller != null,
                  onPlayPause: _togglePlay,
                  onRewind: () => _seekBy(const Duration(seconds: -10)),
                  onForward: () => _seekBy(const Duration(seconds: 10)),
                ),
              if (_showControls)
                _BottomBar(
                  controller: controller,
                  fallbackDuration: fallbackDuration,
                  playing: isPlaying,
                  muted: _muted,
                  captions: _captions,
                  fullscreen: _fullscreen,
                  onSeek: (target) async {
                    await controller?.seekTo(target);
                    _revealControls();
                  },
                  onPlayPause: _togglePlay,
                  onNext: catalog == null
                      ? null
                      : () => _goToNext(catalog, episode),
                  onMute: _toggleMute,
                  onCaptions: () {
                    setState(() => _captions = !_captions);
                    _revealControls();
                  },
                  onSettings: _showSettingsSheet,
                  onFullscreen: _toggleFullscreen,
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSettingsSheet() {
    _hideTimer?.cancel();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) => SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              const Text(
                'الجودة',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 6),
              for (final option in const ['تلقائي', 'جودة عالية', 'توفير البيانات'])
                ListTile(
                  dense: true,
                  title: Text(
                    option,
                    style: TextStyle(
                      color: option == _quality ? AppColors.starGold : Colors.white,
                    ),
                  ),
                  trailing: option == _quality
                      ? const Icon(Icons.check_rounded, color: AppColors.starGold)
                      : null,
                  onTap: () {
                    setState(() => _quality = option);
                    Navigator.pop(sheetContext);
                  },
                ),
              const Divider(height: 22, color: Colors.white24),
              const Text(
                'سرعة التشغيل',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Wrap(
                spacing: 8,
                children: [
                  for (final rate in const [0.75, 1.0, 1.25, 1.5])
                    ChoiceChip(
                      label: Text('${rate}x'),
                      selected: _speed == rate,
                      onSelected: (_) {
                        // Pop before awaiting so the sheet's context is not used
                        // across an async gap.
                        Navigator.pop(sheetContext);
                        setState(() => _speed = rate);
                        _controller?.setPlaybackSpeed(rate);
                      },
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    ).whenComplete(_scheduleHide);
  }
}

// ------------------------------------------------------------------- widgets

class _PlayerShortcuts extends StatelessWidget {
  const _PlayerShortcuts({
    required this.child,
    required this.onPlayPause,
    required this.onForward,
    required this.onRewind,
    required this.onReveal,
    required this.onBack,
  });

  final Widget child;
  final VoidCallback onPlayPause;
  final VoidCallback onForward;
  final VoidCallback onRewind;
  final VoidCallback onReveal;
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    // Remote and keyboard control: select/enter/space toggle playback, the
    // horizontal axis seeks, and any key press re-reveals the controls.
    return Shortcuts(
      shortcuts: <ShortcutActivator, Intent>{
        const SingleActivator(LogicalKeyboardKey.select): const _PlayPauseIntent(),
        const SingleActivator(LogicalKeyboardKey.enter): const _PlayPauseIntent(),
        const SingleActivator(LogicalKeyboardKey.space): const _PlayPauseIntent(),
        const SingleActivator(LogicalKeyboardKey.mediaPlayPause):
            const _PlayPauseIntent(),
        const SingleActivator(LogicalKeyboardKey.arrowRight): const _SeekIntent(1),
        const SingleActivator(LogicalKeyboardKey.arrowLeft): const _SeekIntent(-1),
        const SingleActivator(LogicalKeyboardKey.mediaFastForward):
            const _SeekIntent(1),
        const SingleActivator(LogicalKeyboardKey.mediaRewind): const _SeekIntent(-1),
        const SingleActivator(LogicalKeyboardKey.arrowUp): const _RevealIntent(),
        const SingleActivator(LogicalKeyboardKey.arrowDown): const _RevealIntent(),
        const SingleActivator(LogicalKeyboardKey.escape): const _BackIntent(),
        const SingleActivator(LogicalKeyboardKey.goBack): const _BackIntent(),
      },
      child: Actions(
        actions: <Type, Action<Intent>>{
          _PlayPauseIntent: CallbackAction<_PlayPauseIntent>(
            onInvoke: (_) {
              onPlayPause();
              return null;
            },
          ),
          _SeekIntent: CallbackAction<_SeekIntent>(
            onInvoke: (intent) {
              intent.direction > 0 ? onForward() : onRewind();
              return null;
            },
          ),
          _RevealIntent: CallbackAction<_RevealIntent>(
            onInvoke: (_) {
              onReveal();
              return null;
            },
          ),
          _BackIntent: CallbackAction<_BackIntent>(
            onInvoke: (_) {
              onBack();
              return null;
            },
          ),
        },
        child: Focus(autofocus: true, child: child),
      ),
    );
  }
}

class _PlayPauseIntent extends Intent {
  const _PlayPauseIntent();
}

class _SeekIntent extends Intent {
  const _SeekIntent(this.direction);
  final int direction;
}

class _RevealIntent extends Intent {
  const _RevealIntent();
}

class _BackIntent extends Intent {
  const _BackIntent();
}

class _Surface extends StatelessWidget {
  const _Surface({
    required this.controller,
    required this.episode,
    required this.initialising,
    required this.error,
  });

  final VideoPlayerController? controller;
  final EpisodeItem episode;
  final bool initialising;
  final String? error;

  @override
  Widget build(BuildContext context) {
    if (controller != null && controller!.value.isInitialized) {
      return RepaintBoundary(
        child: Center(
          child: AspectRatio(
            aspectRatio: controller!.value.aspectRatio,
            child: VideoPlayer(controller!),
          ),
        ),
      );
    }

    return Stack(
      fit: StackFit.expand,
      children: [
        CinematicImage(
          networkUrl: episode.thumbnailUrl,
          assetPath: episode.thumbnailAsset,
          semanticLabel: episode.title,
          fit: BoxFit.cover,
        ),
        DecoratedBox(
          decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.45)),
        ),
        Center(
          child: initialising
              ? const CircularProgressIndicator(color: AppColors.starGold)
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 32),
                  child: Text(
                    error ??
                        (episode.isPlayable
                            ? 'جارٍ التحضير…'
                            : 'لم يُرفع ملف هذه الحلقة بعد.'),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.86),
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}

class _CaptionOverlay extends StatelessWidget {
  const _CaptionOverlay({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    if (text.isEmpty) return const SizedBox.shrink();
    return Align(
      alignment: const Alignment(0, 0.72),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 28),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.62),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _Scrim extends StatelessWidget {
  const _Scrim();

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              Colors.black.withValues(alpha: 0.56),
              Colors.transparent,
              Colors.black.withValues(alpha: 0.74),
            ],
          ),
        ),
      );
}

class _TopBar extends StatelessWidget {
  const _TopBar({
    required this.title,
    required this.subtitle,
    required this.captions,
    required this.onBack,
    required this.onCaptions,
    required this.onMore,
  });

  final String title;
  final String subtitle;
  final bool captions;
  final VoidCallback onBack;
  final VoidCallback onCaptions;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              _RoundAction(
                icon: Icons.arrow_forward_rounded,
                label: 'رجوع',
                onTap: onBack,
                dark: true,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 15,
                      ),
                    ),
                    if (subtitle.isNotEmpty)
                      Text(
                        subtitle,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.72),
                          fontSize: 12,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              _RoundAction(
                icon: captions
                    ? Icons.closed_caption_rounded
                    : Icons.closed_caption_off_rounded,
                label: 'الترجمة',
                onTap: onCaptions,
                active: captions,
                dark: true,
              ),
              const SizedBox(width: 8),
              _RoundAction(
                icon: Icons.more_vert_rounded,
                label: 'الإعدادات',
                onTap: onMore,
                dark: true,
              ),
            ],
          ),
        ),
      );
}

class _CenterControls extends StatelessWidget {
  const _CenterControls({
    required this.playing,
    required this.busy,
    required this.enabled,
    required this.onPlayPause,
    required this.onRewind,
    required this.onForward,
  });

  final bool playing;
  final bool busy;
  final bool enabled;
  final VoidCallback onPlayPause;
  final VoidCallback onRewind;
  final VoidCallback onForward;

  @override
  Widget build(BuildContext context) => Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            _RoundAction(
              icon: Icons.replay_10_rounded,
              label: 'رجوع 10 ثوان',
              onTap: enabled ? onRewind : null,
              size: 26,
              padding: 12,
            ),
            const SizedBox(width: 22),
            Semantics(
              button: true,
              label: playing ? 'إيقاف مؤقت' : 'تشغيل',
              child: GestureDetector(
                onTap: enabled && !busy ? onPlayPause : null,
                child: Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.32),
                        blurRadius: 18,
                      ),
                    ],
                  ),
                  child: busy
                      ? const Padding(
                          padding: EdgeInsets.all(24),
                          child: CircularProgressIndicator(
                            strokeWidth: 3,
                            color: AppColors.deepSpace,
                          ),
                        )
                      : Icon(
                          playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                          size: 44,
                          color: AppColors.deepSpace,
                        ),
                ),
              ),
            ),
            const SizedBox(width: 22),
            _RoundAction(
              icon: Icons.forward_10_rounded,
              label: 'تقديم 10 ثوان',
              onTap: enabled ? onForward : null,
              size: 26,
              padding: 12,
            ),
          ],
        ),
      );
}

class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.controller,
    required this.fallbackDuration,
    required this.playing,
    required this.muted,
    required this.captions,
    required this.fullscreen,
    required this.onSeek,
    required this.onPlayPause,
    required this.onNext,
    required this.onMute,
    required this.onCaptions,
    required this.onSettings,
    required this.onFullscreen,
  });

  final VideoPlayerController? controller;

  /// Shown until the controller reports a real duration.
  final Duration fallbackDuration;
  final bool playing;
  final bool muted;
  final bool captions;
  final bool fullscreen;
  final ValueChanged<Duration> onSeek;
  final VoidCallback onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback onMute;
  final VoidCallback onCaptions;
  final VoidCallback onSettings;
  final VoidCallback onFullscreen;

  @override
  Widget build(BuildContext context) {
    final enabled = controller != null;

    return Positioned(
      left: 0,
      right: 0,
      bottom: 0,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 0, 14, 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Only this subtree rebuilds while the position advances.
              _ProgressListener(
                controller: controller,
                builder: (context, value) => _ProgressRow(
                  position: value?.position ?? Duration.zero,
                  duration: (value?.duration ?? Duration.zero) > Duration.zero
                      ? value!.duration
                      : fallbackDuration,
                  buffered: value?.buffered ?? const <DurationRange>[],
                  enabled: enabled,
                  onSeek: onSeek,
                ),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  _RoundAction(
                    icon: playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    label: playing ? 'إيقاف مؤقت' : 'تشغيل',
                    onTap: enabled ? onPlayPause : null,
                  ),
                  const SizedBox(width: 8),
                  _RoundAction(
                    icon: Icons.skip_next_rounded,
                    label: 'الحلقة التالية',
                    onTap: onNext,
                  ),
                  const SizedBox(width: 8),
                  _RoundAction(
                    icon: muted
                        ? Icons.volume_off_rounded
                        : Icons.volume_up_rounded,
                    label: muted ? 'إلغاء الكتم' : 'كتم الصوت',
                    onTap: onMute,
                  ),
                  const Spacer(),
                  _RoundAction(
                    icon: captions
                        ? Icons.closed_caption_rounded
                        : Icons.closed_caption_off_rounded,
                    label: 'الترجمة',
                    onTap: onCaptions,
                    active: captions,
                  ),
                  const SizedBox(width: 8),
                  _RoundAction(
                    icon: Icons.settings_rounded,
                    label: 'الجودة والسرعة',
                    onTap: onSettings,
                  ),
                  const SizedBox(width: 8),
                  _RoundAction(
                    icon: fullscreen
                        ? Icons.fullscreen_exit_rounded
                        : Icons.fullscreen_rounded,
                    label: fullscreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة',
                    onTap: onFullscreen,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

}

/// Rebuilds [builder] whenever the controller reports new state.
///
/// Scoping the listener to the small widgets that depend on position keeps the
/// per-frame rebuild off the rest of the player chrome.
class _ProgressListener extends StatelessWidget {
  const _ProgressListener({required this.controller, required this.builder});

  final VideoPlayerController? controller;
  final Widget Function(BuildContext context, VideoPlayerValue? value) builder;

  @override
  Widget build(BuildContext context) {
    final controller = this.controller;
    if (controller == null) return builder(context, null);
    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: controller,
      builder: (context, value, _) => builder(context, value),
    );
  }
}

/// Timestamps, buffered bar and seek slider.
class _ProgressRow extends StatelessWidget {
  const _ProgressRow({
    required this.position,
    required this.duration,
    required this.buffered,
    required this.enabled,
    required this.onSeek,
  });

  final Duration position;
  final Duration duration;
  final List<DurationRange> buffered;
  final bool enabled;
  final ValueChanged<Duration> onSeek;

  @override
  Widget build(BuildContext context) {
    final total = duration.inMilliseconds;
    final progress = total <= 0
        ? 0.0
        : (position.inMilliseconds / total).clamp(0.0, 1.0).toDouble();
    final bufferedFraction = total <= 0 || buffered.isEmpty
        ? 0.0
        : (buffered.last.end.inMilliseconds / total).clamp(0.0, 1.0).toDouble();

    return Row(
      children: [
        Text(
          _format(position),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Semantics(
            slider: true,
            label: 'موضع التشغيل',
            value: '${_format(position)} من ${_format(duration)}',
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Buffered indicator sits behind the interactive track.
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(3),
                    child: LinearProgressIndicator(
                      value: bufferedFraction,
                      minHeight: 4,
                      backgroundColor: Colors.white.withValues(alpha: 0.18),
                      valueColor: AlwaysStoppedAnimation<Color>(
                        Colors.white.withValues(alpha: 0.34),
                      ),
                    ),
                  ),
                ),
                SliderTheme(
                  data: SliderThemeData(
                    trackHeight: 4,
                    thumbShape:
                        const RoundSliderThumbShape(enabledThumbRadius: 7),
                    overlayShape: SliderComponentShape.noOverlay,
                    activeTrackColor: AppColors.starGold,
                    inactiveTrackColor: Colors.transparent,
                    thumbColor: Colors.white,
                  ),
                  child: Slider(
                    value: progress,
                    onChanged: enabled && total > 0
                        ? (v) => onSeek(
                              Duration(milliseconds: (v * total).round()),
                            )
                        : null,
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          _format(duration),
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.72),
            fontSize: 12,
          ),
        ),
      ],
    );
  }

  static String _format(Duration value) {
    final hours = value.inHours;
    final minutes = value.inMinutes.remainder(60);
    final seconds = value.inSeconds.remainder(60);
    final mm = minutes.toString().padLeft(hours > 0 ? 2 : 1, '0');
    final ss = seconds.toString().padLeft(2, '0');
    return hours > 0 ? '$hours:$mm:$ss' : '$mm:$ss';
  }
}

/// Focusable, labelled circular control. Focus support makes every player
/// affordance reachable by remote on Android TV.
class _RoundAction extends StatelessWidget {
  const _RoundAction({
    required this.icon,
    required this.label,
    required this.onTap,
    this.active = false,
    this.dark = false,
    this.size = 18,
    this.padding = 9,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final bool active;
  final bool dark;
  final double size;
  final double padding;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    return Semantics(
      button: true,
      enabled: enabled,
      label: label,
      child: Tooltip(
        message: label,
        child: Material(
          color: dark
              ? Colors.black.withValues(alpha: 0.42)
              : Colors.white.withValues(alpha: 0.12),
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: Padding(
              padding: EdgeInsets.all(padding),
              child: Icon(
                icon,
                size: size,
                color: !enabled
                    ? Colors.white.withValues(alpha: 0.34)
                    : (active ? AppColors.starGold : Colors.white),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MissingEpisode extends StatelessWidget {
  const _MissingEpisode({required this.onBack});
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: AppColors.deepSpace,
        body: CinematicBackground(
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.play_disabled_rounded,
                  color: AppColors.mutedText,
                  size: 48,
                ),
                const SizedBox(height: 12),
                const Text(
                  'الحلقة غير متاحة',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  autofocus: true,
                  onPressed: onBack,
                  child: const Text('رجوع'),
                ),
              ],
            ),
          ),
        ),
      );
}
