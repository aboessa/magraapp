import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../core/widgets/focusable_scale.dart';
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
    this.bookId,
    this.pageId,
    super.key,
  });

  final String title;
  final String? subtitle;

  /// Public audio source. Null when the track is private or unpublished.
  final String? audioUrl;

  /// When set, narration is fetched through a capability token instead of
  /// [audioUrl].
  final String? bookId;

  /// Optional per-page narration within [bookId].
  final String? pageId;

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
      (widget.audioUrl ?? '').isNotEmpty || (widget.bookId ?? '').isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_hasSource) _open();
  }

  @override
  void dispose() {
    _controller?.removeListener(_onTick);
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _open() async {
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
    } catch (_) {
      await controller.dispose();
      if (!mounted) return;
      setState(() {
        _initialising = false;
        _error = 'تعذّر تشغيل القصة. تحقّق من الاتصال وحاول مرة أخرى.';
      });
    }
  }

  /// A stable download id for this book's public audio, or null when there is
  /// no public source to download.
  String? get _downloadId {
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
    return VideoPlayerController.networkUrl(Uri.parse(widget.audioUrl!));
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
      session = await ref.read(majarraApiClientProvider).createAudioSession(
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

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    final isPlaying = controller?.value.isPlaying ?? false;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
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
                    const Spacer(),
                    const Text(
                      'استمع',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const Spacer(),
                    const SizedBox(width: 40),
                  ],
                ),
                const SizedBox(height: 24),
                _Artwork(controller: controller, busy: _initialising),
                const SizedBox(height: 24),
                Text(
                  widget.title,
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                if (widget.subtitle != null) ...[
                  const SizedBox(height: 6),
                  Text(
                    widget.subtitle!,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: AppColors.mutedText.withValues(alpha: 0.72),
                      fontSize: 12,
                    ),
                  ),
                ],
                const Spacer(),
                if (!_hasSource)
                  const _Notice(
                    icon: Icons.cloud_off_rounded,
                    text: 'لم يُرفع الملف الصوتي لهذه القصة بعد.',
                  )
                else if (_error != null)
                  _Notice(icon: Icons.error_outline_rounded, text: _error!)
                else ...[
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ActionChip(
                        label: Text(
                          '${_speed}x',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                          ),
                        ),
                        backgroundColor: Colors.white.withValues(alpha: 0.08),
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
                        onPressed: controller == null ? null : _cycleSpeed,
                      ),
                      // Offline download for the public audio, when one exists.
                      // Private narration is not downloadable without an offline
                      // licence endpoint, so the button appears only for a
                      // public sample source.
                      if (_downloadId != null && (widget.audioUrl ?? '').isNotEmpty) ...[
                        const SizedBox(width: 10),
                        DownloadButton(
                          request: DownloadRequest(
                            id: _downloadId!,
                            childId: ref.read(childProvider).activeChildId ?? 'guest',
                            contentType: 'audio_story',
                            title: widget.title,
                            subtitle: widget.subtitle ?? '',
                            sourceUrl: widget.audioUrl!,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Artwork extends StatelessWidget {
  const _Artwork({required this.controller, required this.busy});

  final VideoPlayerController? controller;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: SizedBox(
        width: 220,
        height: 220,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const RadialGradient(
                  center: Alignment(-0.3, -0.3),
                  colors: [Color(0xFF6A3DF2), Color(0xFF0B1026)],
                ),
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.12),
                  width: 1.5,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.cosmicPurple.withValues(alpha: 0.22),
                    blurRadius: 32,
                  ),
                ],
              ),
            ),
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.starGold,
                boxShadow: [
                  BoxShadow(
                    color: AppColors.starGold.withValues(alpha: 0.32),
                    blurRadius: 18,
                  ),
                ],
              ),
              child: const Icon(
                Icons.headphones_rounded,
                color: AppColors.deepSpace,
                size: 32,
              ),
            ),
            // Ring reflects genuine playback position.
            if (busy)
              const SizedBox(
                width: 220,
                height: 220,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.starGold,
                ),
              )
            else if (controller != null)
              SizedBox(
                width: 220,
                height: 220,
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
                      strokeWidth: 2,
                      backgroundColor: Colors.white.withValues(alpha: 0.06),
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
            : (value.position.inMilliseconds / total).clamp(0.0, 1.0).toDouble();

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
        Semantics(
          button: true,
          label: playing ? 'إيقاف مؤقت' : 'تشغيل',
          child: FocusableScale(
            onPressed: enabled ? onPlayPause : () {},
            semanticLabel: playing ? 'إيقاف مؤقت' : 'تشغيل',
            autofocus: true,
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
  const _Notice({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: AppColors.indigoSurface.withValues(alpha: 0.62),
      borderRadius: BorderRadius.circular(14),
      border: Border.all(color: AppColors.starGold.withValues(alpha: 0.24)),
    ),
    child: Row(
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
  );
}
