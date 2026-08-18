import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/cinematic_image.dart';
import '../../../../core/widgets/focusable_scale.dart';
import '../../../../core/analytics/analytics.dart';
import '../../../child/application/child_provider.dart';
import '../../../downloads/application/download_manager.dart';
import '../../../downloads/application/download_providers.dart';
import '../../../downloads/presentation/download_button.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';

/// A source that cannot be played, with copy the page can show directly.
///
/// Separate from a generic exception so the reason survives to the UI: "choose a
/// profile" and "not published yet" need different wording, and collapsing both
/// into one message would tell the user to fix something that is not wrong.
class _AudioSourceError implements Exception {
  const _AudioSourceError(this.message);
  final String message;
}

/// Audio story player.
///
/// Rewritten from a simulation. The previous version imported no audio package
/// at all: a `Timer.periodic` advanced `_progress` by `0.002` every 200ms, the
/// duration was hardcoded to 240 seconds, and the speed chip toggled a field
/// that affected nothing. Nothing was ever played.
///
/// This version drives a real [VideoPlayerController], which handles audio-only
/// sources, so no new dependency is required.
///
/// ## Two source paths
///
/// Narration is a private asset and is not reachable from the CDN, per
/// `تشفير المحتوي.md:70` ("ملف صوتي مدفوع → Streaming خاص"). When [bookId] is
/// supplied the page requests a short-lived capability token from
/// `POST /books/:id/audio-sessions` and sends it as an `Authorization` header on
/// the media request.
///
/// [audioUrl] remains supported for genuinely public audio — free samples and
/// interface sound, which the plan permits to be public (`:65-66`). Passing a
/// direct URL for paid narration will simply 401 at the media worker, which is
/// the correct outcome rather than a silent bypass.
class AudioPlayerPage extends ConsumerStatefulWidget {
  const AudioPlayerPage({
    required this.title,
    this.subtitle,
    this.audioUrl,
    this.artworkUrl,
    this.artworkAsset,
    this.bookId,
    this.pageId,
    this.downloadId,
    super.key,
  });

  final String title;
  final String? subtitle;

  /// Public audio source. Null when the track is private or unpublished.
  final String? audioUrl;

  final String? artworkUrl;
  final String? artworkAsset;

  /// When set, narration is fetched through a capability token instead of
  /// [audioUrl].
  final String? bookId;

  /// Optional per-page narration within [bookId].
  final String? pageId;

  /// Explicit offline item to open from the downloads page. This avoids
  /// deriving a content id by parsing a storage key.
  final String? downloadId;

  @override
  ConsumerState<AudioPlayerPage> createState() => _AudioPlayerPageState();
}

class _AudioPlayerPageState extends ConsumerState<AudioPlayerPage> {
  VideoPlayerController? _controller;
  bool _initialising = false;
  String? _error;
  double _speed = 1;

  /// True when the page can attempt playback at all: either a public URL or a
  /// book id it can mint a token for.
  bool get _hasSource =>
      (widget.audioUrl ?? '').isNotEmpty ||
      (widget.bookId ?? '').isNotEmpty ||
      (widget.downloadId ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_hasSource) _open();
  }

  @override
  void dispose() {
    final downloadId = _downloadId;
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    if (downloadId != null) {
      unawaited(
        ref
            .read(downloadManagerProvider.notifier)
            .cleanupPlaybackFile(downloadId),
      );
    }
    super.dispose();
  }

  Future<void> _open() async {
    final previous = _controller;
    _controller = null;
    previous?.removeListener(_onTick);
    await previous?.dispose();
    if (!mounted) return;
    setState(() {
      _initialising = true;
      _error = null;
    });

    final VideoPlayerController controller;
    try {
      controller = await _buildController();
    } on _AudioSourceError catch (error) {
      if (!mounted) return;
      setState(() {
        _initialising = false;
        _error = error.message;
      });
      return;
    }

    try {
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onTick);
      setState(() {
        _controller = controller;
        _initialising = false;
      });
      MajarraAnalytics.contentStarted('audio_story', widget.bookId ?? 'public');
    } catch (_) {
      await controller.dispose();
      if (!mounted) return;
      MajarraAnalytics.playbackError(widget.bookId ?? 'public');
      setState(() {
        _initialising = false;
        _error = 'تعذّر تشغيل القصة. تحقّق من الاتصال وحاول مرة أخرى.';
      });
    }
  }

  /// A stable download id for this book's public audio, or null when there is
  /// no public source to download.
  String? get _downloadId {
    final explicit = widget.downloadId;
    if (explicit != null && explicit.isNotEmpty) return explicit;
    if ((widget.audioUrl ?? '').isEmpty) return null;
    final book = widget.bookId;
    return book != null && book.isNotEmpty
        ? 'audio_$book'
        : 'audio_${widget.audioUrl.hashCode}';
  }

  /// Builds a controller for whichever source path applies.
  ///
  /// Offline-first: if this book's audio has been downloaded and is ready, the
  /// decrypted local file is played so the story works with no connection. Only
  /// when nothing is stored does it fall back to the network — the private
  /// narration path when a book id is present, or the public sample otherwise.
  Future<VideoPlayerController> _buildController() async {
    final downloadId = _downloadId;
    if (downloadId != null) {
      final localPath = await ref
          .read(downloadManagerProvider.notifier)
          .preparePlayback(downloadId);
      if (localPath != null) {
        return VideoPlayerController.file(File(localPath));
      }
    }

    final bookId = widget.bookId;
    if (bookId != null && bookId.isNotEmpty) {
      return _privateController(bookId);
    }
    final publicUrl = widget.audioUrl;
    if (publicUrl == null || publicUrl.isEmpty) {
      throw const _AudioSourceError(
        'الملف المحمّل غير متاح. أعد تنزيله من صفحة القصة.',
      );
    }
    return VideoPlayerController.networkUrl(Uri.parse(publicUrl));
  }

  Future<VideoPlayerController> _privateController(String bookId) async {
    final childId = ref.read(childProvider).activeChildId;
    if (childId == null || childId.isEmpty) {
      // The server requires a child_id to check entitlement and age track, so
      // this is stated rather than sent as an empty value that would 400.
      throw const _AudioSourceError('اختر ملف طفل أولًا لتشغيل القصة.');
    }

    final Map<String, dynamic> session;
    try {
      session = await ref
          .read(majarraApiClientProvider)
          .createAudioSession(
            bookId: bookId,
            childId: childId,
            pageId: widget.pageId,
          );
    } catch (_) {
      throw const _AudioSourceError(
        'تعذّر تجهيز القصة. تحقّق من تسجيل الدخول والاشتراك.',
      );
    }

    final data = session['data'];
    if (data is! Map) {
      throw const _AudioSourceError('لم يُرفع الملف الصوتي لهذه القصة بعد.');
    }
    final payload = data.cast<String, Object?>();
    final streamUrl = payload['stream_url'];
    final authorization = payload['authorization'];
    if (streamUrl is! String || authorization is! String) {
      throw const _AudioSourceError('لم يُرفع الملف الصوتي لهذه القصة بعد.');
    }

    // `stream_url` is worker-relative; the media worker never returns an R2 URL,
    // per `تشفير المحتوي.md:1192`.
    final uri = Uri.parse(ApiEnvironment.baseUrl).resolve(streamUrl);
    return VideoPlayerController.networkUrl(
      uri,
      // The capability token travels as a header, never in the query string, so
      // it cannot leak through logs or a referrer (`تشفير المحتوي.md:253-262`).
      httpHeaders: {'Authorization': authorization},
    );
  }

  /// Only mirrors transport changes into state. Position updates are consumed by
  /// [_ProgressSection] through a [ValueListenableBuilder], so the whole page
  /// does not rebuild on every frame of playback.
  void _onTick() {
    final value = _controller?.value;
    if (value == null || !mounted) return;
    if (value.hasError && _error == null) {
      setState(() => _error = 'انقطع التشغيل. حاول مرة أخرى.');
    }
  }

  Future<void> _togglePlay() async {
    final controller = _controller;
    if (controller == null) return;
    await HapticFeedback.lightImpact();
    if (controller.value.isPlaying) {
      await controller.pause();
    } else {
      // Restarting from the end feels better than a dead button.
      if (controller.value.position >= controller.value.duration) {
        await controller.seekTo(Duration.zero);
      }
      await controller.play();
    }
    if (mounted) setState(() {});
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
  }

  Future<void> _cycleSpeed() async {
    const steps = [1.0, 1.25, 1.5, 0.75];
    final next = steps[(steps.indexOf(_speed) + 1) % steps.length];
    setState(() => _speed = next);
    await _controller?.setPlaybackSpeed(next);
  }

  Widget _playbackContent({
    required VideoPlayerController? controller,
    required bool isPlaying,
    required String? childId,
  }) {
    if (!_hasSource) {
      return const _Notice(
        icon: Icons.cloud_off_rounded,
        text: 'لم يُرفع الملف الصوتي لهذه القصة بعد.',
      );
    }
    if (_error != null) {
      return _Notice(
        icon: Icons.error_outline_rounded,
        text: _error!,
        actionLabel: 'إعادة المحاولة',
        onAction: _open,
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _ProgressSection(controller: controller),
        const SizedBox(height: 16),
        _Controls(
          playing: isPlaying,
          enabled: controller != null,
          onPlayPause: _togglePlay,
          onRewind: () => _seekBy(const Duration(seconds: -10)),
          onForward: () => _seekBy(const Duration(seconds: 10)),
        ),
        const SizedBox(height: 16),
        Wrap(
          alignment: WrapAlignment.center,
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 10,
          runSpacing: 8,
          children: [
            ActionChip(
              tooltip: 'تغيير سرعة التشغيل',
              label: Text(
                '${_speed}x',
                style: const TextStyle(color: Colors.white, fontSize: 11),
              ),
              backgroundColor: Colors.white.withValues(alpha: 0.08),
              side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
              onPressed: controller == null ? null : _cycleSpeed,
            ),
            // Private narration cannot be persisted without an offline licence.
            if (_downloadId != null &&
                (widget.audioUrl ?? '').isNotEmpty &&
                childId != null &&
                childId.isNotEmpty)
              DownloadButton(
                request: DownloadRequest(
                  id: _downloadId!,
                  childId: childId,
                  contentType: 'audio_story',
                  title: widget.title,
                  subtitle: widget.subtitle ?? '',
                  sourceUrl: widget.audioUrl!,
                  posterUrl: widget.artworkUrl,
                ),
              ),
          ],
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final isPlaying = controller?.value.isPlaying ?? false;
    final childId = ref.watch(childProvider).activeChildId;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final landscape = constraints.maxWidth > constraints.maxHeight;
              final sideBySide = landscape && constraints.maxWidth >= 620;
              final sizeBasis = landscape
                  ? constraints.maxHeight * 0.42
                  : constraints.maxWidth * 0.58;
              final artworkSize = sizeBasis.clamp(132.0, 220.0).toDouble();

              final storyDetails = Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _Artwork(
                    controller: controller,
                    busy: _initialising,
                    title: widget.title,
                    artworkUrl: widget.artworkUrl,
                    artworkAsset: widget.artworkAsset,
                    size: artworkSize,
                  ),
                  SizedBox(height: landscape ? 14 : 22),
                  Text(
                    widget.title,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  if (widget.subtitle != null &&
                      widget.subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      widget.subtitle!,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.mutedText.withValues(alpha: 0.72),
                        fontSize: 12,
                        height: 1.5,
                      ),
                    ),
                  ],
                ],
              );

              final playback = _playbackContent(
                controller: controller,
                isPlaying: isPlaying,
                childId: childId,
              );

              return SingleChildScrollView(
                padding: const EdgeInsetsDirectional.fromSTEB(20, 8, 20, 24),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 760),
                    child: FocusTraversalGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              IconButton(
                                icon: const Icon(
                                  Icons.arrow_forward_rounded,
                                  color: Colors.white,
                                ),
                                tooltip: 'رجوع',
                                onPressed: () => context.pop(),
                              ),
                              const Expanded(
                                child: Text(
                                  'استمع',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 48),
                            ],
                          ),
                          SizedBox(height: landscape ? 10 : 22),
                          if (sideBySide)
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                Expanded(child: storyDetails),
                                const SizedBox(width: 32),
                                Expanded(child: playback),
                              ],
                            )
                          else ...[
                            storyDetails,
                            const SizedBox(height: 28),
                            playback,
                          ],
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({
    required this.controller,
    required this.busy,
    required this.title,
    required this.size,
    this.artworkUrl,
    this.artworkAsset,
  });

  final VideoPlayerController? controller;
  final bool busy;
  final String title;
  final double size;
  final String? artworkUrl;
  final String? artworkAsset;

  @override
  Widget build(BuildContext context) {
    final centerSize = (size * 0.27).clamp(44.0, 58.0).toDouble();
    return Center(
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.14),
                  width: 2,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.cosmicPurple.withValues(alpha: 0.28),
                    blurRadius: 32,
                  ),
                ],
              ),
              clipBehavior: Clip.antiAlias,
              child: SizedBox.expand(
                child: CinematicImage(
                  networkUrl: artworkUrl,
                  assetPath:
                      artworkAsset ??
                      'assets/images/explore/explore-listen.webp',
                  semanticLabel: 'غلاف $title',
                  fit: BoxFit.cover,
                ),
              ),
            ),
            Container(
              width: centerSize,
              height: centerSize,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.deepSpace.withValues(alpha: 0.82),
                border: Border.all(
                  color: AppColors.starGold.withValues(alpha: 0.72),
                ),
              ),
              child: Icon(
                Icons.headphones_rounded,
                color: AppColors.starGold,
                size: centerSize * 0.48,
              ),
            ),
            if (busy)
              SizedBox.square(
                dimension: size,
                child: const CircularProgressIndicator(
                  strokeWidth: 3,
                  color: AppColors.starGold,
                ),
              )
            else if (controller != null)
              SizedBox.square(
                dimension: size,
                child: ValueListenableBuilder<VideoPlayerValue>(
                  valueListenable: controller!,
                  builder: (context, value, _) {
                    final total = value.duration.inMilliseconds;
                    final progress = total <= 0
                        ? 0.0
                        : (value.position.inMilliseconds / total)
                              .clamp(0.0, 1.0)
                              .toDouble();
                    return CircularProgressIndicator(
                      value: progress,
                      strokeWidth: 3,
                      backgroundColor: Colors.white.withValues(alpha: 0.08),
                      valueColor: const AlwaysStoppedAnimation(
                        AppColors.starGold,
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Timestamps and seek bar. Rebuilds independently of the page.
class _ProgressSection extends StatelessWidget {
  const _ProgressSection({required this.controller});

  final VideoPlayerController? controller;

  @override
  Widget build(BuildContext context) {
    final controller = this.controller;
    if (controller == null) {
      return const SizedBox(height: 62);
    }

    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final total = value.duration.inMilliseconds;
        final progress = total <= 0
            ? 0.0
            : (value.position.inMilliseconds / total)
                  .clamp(0.0, 1.0)
                  .toDouble();

        return Column(
          children: [
            Row(
              children: [
                Text(
                  _format(value.position),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                Text(
                  _format(value.duration),
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.62),
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Semantics(
              slider: true,
              label: 'موضع التشغيل',
              value: '${_format(value.position)} من ${_format(value.duration)}',
              child: SliderTheme(
                data: SliderThemeData(
                  trackHeight: 4,
                  thumbShape: const RoundSliderThumbShape(
                    enabledThumbRadius: 7,
                  ),
                  activeTrackColor: AppColors.starGold,
                  inactiveTrackColor: Colors.white.withValues(alpha: 0.12),
                  thumbColor: Colors.white,
                ),
                child: Slider(
                  value: progress,
                  onChanged: total <= 0
                      ? null
                      : (v) => controller.seekTo(
                          Duration(milliseconds: (v * total).round()),
                        ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  static String _format(Duration value) {
    final minutes = value.inMinutes;
    final seconds = value.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }
}

class _Controls extends StatelessWidget {
  const _Controls({
    required this.playing,
    required this.enabled,
    required this.onPlayPause,
    required this.onRewind,
    required this.onForward,
  });

  final bool playing;
  final bool enabled;
  final VoidCallback onPlayPause;
  final VoidCallback onRewind;
  final VoidCallback onForward;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _RoundButton(
          icon: Icons.replay_10_rounded,
          label: 'رجوع 10 ثوان',
          onPressed: enabled ? onRewind : null,
        ),
        const SizedBox(width: 20),
        FocusableScale(
          onPressed: enabled ? onPlayPause : null,
          semanticLabel: playing ? 'إيقاف مؤقت' : 'تشغيل',
          autofocus: enabled,
          borderRadius: BorderRadius.circular(32),
          focusScale: 1.07,
          child: Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: enabled
                  ? Colors.white
                  : Colors.white.withValues(alpha: 0.34),
            ),
            child: Icon(
              playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
              color: AppColors.deepSpace,
              size: 32,
            ),
          ),
        ),
        const SizedBox(width: 20),
        _RoundButton(
          icon: Icons.forward_10_rounded,
          label: 'تقديم 10 ثوان',
          onPressed: enabled ? onForward : null,
        ),
      ],
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({
    required this.icon,
    required this.label,
    required this.onPressed,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => IconButton(
    icon: Icon(
      icon,
      color: onPressed == null
          ? Colors.white.withValues(alpha: 0.34)
          : Colors.white,
    ),
    tooltip: label,
    onPressed: onPressed,
  );
}

class _Notice extends StatelessWidget {
  const _Notice({
    required this.icon,
    required this.text,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String text;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.indigoSurface.withValues(alpha: 0.62),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.starGold.withValues(alpha: 0.24)),
    ),
    child: Column(
      children: [
        Row(
          children: [
            Icon(icon, color: AppColors.starGold, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                text,
                style: const TextStyle(
                  color: AppColors.mutedText,
                  fontSize: 11.5,
                  height: 1.6,
                ),
              ),
            ),
          ],
        ),
        if (onAction != null && actionLabel != null) ...[
          const SizedBox(height: 10),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: FilledButton.icon(
              onPressed: onAction,
              icon: const Icon(Icons.refresh_rounded),
              label: Text(actionLabel!),
            ),
          ),
        ],
      ],
    ),
  );
}
