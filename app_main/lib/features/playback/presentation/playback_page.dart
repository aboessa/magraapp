import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../home/domain/content_models.dart';
import '../../home/application/home_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PlaybackPage extends ConsumerStatefulWidget {
  const PlaybackPage({required this.episodeId, super.key});
  final String episodeId;

  @override
  ConsumerState<PlaybackPage> createState() => _PlaybackPageState();
}

class _PlaybackPageState extends ConsumerState<PlaybackPage> {
  bool _playing = false;
  double _progress = 0.22;
  bool _showControls = true;
  bool _muted = false;
  String _quality = 'تلقائي';
  bool _captions = false;
  Timer? _hideTimer;

  Timer? _progressTimer;

  @override
  void initState() {
    super.initState();
    _scheduleHide();
    // Placeholder progress animation only. No video is decoded and no progress
    // is persisted: there is no VideoPlayerController and no call to
    // POST /api/v1/family/progress yet. See AUDIT_FLUTTER_APP.md §9 H1/H2.
    _progressTimer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted || !_playing) return;
      setState(() => _progress = (_progress + 0.004).clamp(0, 1));
      if (_progress >= 0.9 && t.isActive) t.cancel();
    });
  }

  void _scheduleHide() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (_playing && mounted) setState(() => _showControls = false);
    });
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    // Previously leaked: the periodic timer was never cancelled, so it kept
    // calling setState after this route was popped.
    _progressTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalog = ref.watch(homeCatalogProvider).valueOrNull;
    final episode = catalog?.episodes.where((e) => e.id == widget.episodeId).firstOrNull;
    final series = episode != null ? catalog?.series.where((s) => s.id == episode.seriesId).firstOrNull : null;

    if (episode == null) {
      return Scaffold(
        backgroundColor: AppColors.deepSpace,
        body: CinematicBackground(
          child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [const Icon(Icons.play_disabled_rounded, color: AppColors.mutedText, size: 48), const SizedBox(height: 12), const Text('الحلقة غير متاحة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)), const SizedBox(height: 12), FilledButton(onPressed: () => context.pop(), child: const Text('رجوع'))])),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: () {
          setState(() => _showControls = !_showControls);
          if (_showControls) _scheduleHide();
        },
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Video surface - thumbnail as mock video
            CinematicImage(networkUrl: episode.thumbnailUrl, assetPath: episode.thumbnailAsset, semanticLabel: episode.title, fit: BoxFit.cover),
            // Scrim for controls
            if (_showControls)
              DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Colors.black.withValues(alpha: 0.52), Colors.transparent, Colors.black.withValues(alpha: 0.72)]))),
            // Top bar
            if (_showControls)
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Material(color: Colors.black.withValues(alpha: 0.42), shape: const CircleBorder(), child: InkWell(customBorder: const CircleBorder(), onTap: () => context.pop(), child: const Padding(padding: EdgeInsets.all(10), child: Icon(Icons.arrow_forward_rounded, color: Colors.white)))),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(episode.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 14)),
                            Text(series?.title ?? '', style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 11)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      _TopAction(icon: _captions ? Icons.closed_caption_rounded : Icons.closed_caption_off_rounded, onTap: () => setState(() => _captions = !_captions), active: _captions),
                      const SizedBox(width: 8),
                      _TopAction(icon: Icons.more_vert_rounded, onTap: () => _showQualitySheet()),
                    ],
                  ),
                ),
              ),
            // Center play
            Center(
              child: AnimatedOpacity(
                opacity: _showControls ? 1 : 0,
                duration: const Duration(milliseconds: 200),
                child: GestureDetector(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    setState(() => _playing = !_playing);
                    _scheduleHide();
                  },
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.32), blurRadius: 16)]),
                    child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 42, color: AppColors.deepSpace),
                  ),
                ),
              ),
            ),
            // Bottom controls
            Positioned(
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
                      // Progress
                      Row(
                        children: [
                          Text(_fmt(_progress * _dur(episode)), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: SliderTheme(
                              data: SliderThemeData(trackHeight: 4, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7), overlayShape: SliderComponentShape.noOverlay, activeTrackColor: AppColors.starGold, inactiveTrackColor: Colors.white.withValues(alpha: 0.22), thumbColor: Colors.white),
                              child: Slider(value: _progress, onChanged: (v) => setState(() => _progress = v)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(_fmt(_dur(episode).toDouble()), style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 11)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _BottomAction(icon: _playing ? Icons.pause_rounded : Icons.play_arrow_rounded, onTap: () => setState(() => _playing = !_playing)),
                          const SizedBox(width: 8),
                          _BottomAction(icon: Icons.skip_next_rounded, onTap: () {}),
                          const SizedBox(width: 8),
                          _BottomAction(icon: _muted ? Icons.volume_off_rounded : Icons.volume_up_rounded, onTap: () => setState(() => _muted = !_muted)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(color: _captions ? AppColors.starGold : Colors.white.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)),
                            child: InkWell(onTap: () => setState(() => _captions = !_captions), child: Text('CC', style: TextStyle(color: _captions ? AppColors.deepSpace : Colors.white, fontSize: 11, fontWeight: FontWeight.w800))),
                          ),
                          const SizedBox(width: 8),
                          _BottomAction(icon: Icons.settings_rounded, onTap: () => _showQualitySheet()),
                          const SizedBox(width: 8),
                          _BottomAction(icon: Icons.fullscreen_rounded, onTap: () {}),
                        ],
                      ),
                      const SizedBox(height: 6),
                      // Offline info
                      Row(children: [Icon(Icons.info_outline_rounded, color: AppColors.starGold.withValues(alpha: 0.9), size: 12), const SizedBox(width: 4), Text('معاينة تصميم — تشغيل الفيديو ومزامنة التقدّم غير مربوطين بعد', style: TextStyle(color: Colors.white.withValues(alpha: 0.62), fontSize: 10))]),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  int _dur(EpisodeItem ep) => ep.durationSeconds;
  String _fmt(double s) {
    final m = (s ~/ 60).toString().padLeft(1, '0');
    final sec = (s % 60).round().toString().padLeft(2, '0');
    return '$m:$sec';
  }

  void _showQualitySheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      builder: (_) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 16),
            const Text('الجودة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            const SizedBox(height: 12),
            ...['تلقائي', 'جودة عالية', 'توفير البيانات'].map((q) => ListTile(
                  title: Text(q, style: TextStyle(color: q == _quality ? AppColors.starGold : Colors.white)),
                  trailing: q == _quality ? const Icon(Icons.check_rounded, color: AppColors.starGold) : null,
                  onTap: () {
                    setState(() => _quality = q);
                    Navigator.pop(context);
                  },
                )),
          ],
        ),
      ),
    );
  }
}

class _TopAction extends StatelessWidget {
  const _TopAction({required this.icon, required this.onTap, this.active = false});
  final IconData icon;
  final VoidCallback onTap;
  final bool active;
  @override
  Widget build(BuildContext context) => Material(color: Colors.black.withValues(alpha: 0.42), shape: const CircleBorder(), child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: Padding(padding: const EdgeInsets.all(9), child: Icon(icon, color: active ? AppColors.starGold : Colors.white, size: 18))));
}

class _BottomAction extends StatelessWidget {
  const _BottomAction({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(color: Colors.white.withValues(alpha: 0.12), shape: const CircleBorder(), child: InkWell(customBorder: const CircleBorder(), onTap: onTap, child: Padding(padding: const EdgeInsets.all(8), child: Icon(icon, color: Colors.white, size: 18))));
}
