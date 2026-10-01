import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';

import '../../application/trailer_providers.dart';

/// A muted, looping preview laid over the hero artwork on TV, like the big
/// streaming apps. It starts after the slide has been on screen for a moment
/// (so flicking past slides does not start downloads), fades in over the
/// banner, and simply stays absent on any failure — the artwork is always
/// underneath. Never with reduced motion. The server withholds it at bedtime.
class TvHeroTrailer extends ConsumerStatefulWidget {
  const TvHeroTrailer({required this.seriesId, super.key});

  final String seriesId;

  static const startDelay = Duration(milliseconds: 1500);

  @override
  ConsumerState<TvHeroTrailer> createState() => _TvHeroTrailerState();
}

class _TvHeroTrailerState extends ConsumerState<TvHeroTrailer> {
  Timer? _delay;
  VideoPlayerController? _controller;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    _delay = Timer(TvHeroTrailer.startDelay, _start);
  }

  Future<void> _start() async {
    if (!mounted || MediaQuery.disableAnimationsOf(context)) return;
    final url = await ref.read(
      seriesTrailerUrlProvider(widget.seriesId).future,
    );
    if (!mounted || url == null) return;
    final controller = VideoPlayerController.networkUrl(
      Uri.parse(url),
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    try {
      await controller.initialize();
      await controller.setVolume(0);
      await controller.setLooping(true);
      if (!mounted) {
        await controller.dispose();
        return;
      }
      controller.addListener(_onPlayerChange);
      await controller.play();
      setState(() {
        _controller = controller;
        _visible = true;
      });
    } catch (_) {
      // No preview is a normal state: the banner stays.
      await controller.dispose();
    }
  }

  void _onPlayerChange() {
    // A refused re-request (expired capability) or a decode error hides the
    // preview instead of freezing a broken frame over the artwork.
    if ((_controller?.value.hasError ?? false) && _visible && mounted) {
      setState(() => _visible = false);
    }
  }

  @override
  void dispose() {
    _delay?.cancel();
    final controller = _controller;
    controller?.removeListener(_onPlayerChange);
    unawaited(controller?.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;
    return IgnorePointer(
      child: ExcludeSemantics(
        child: AnimatedOpacity(
          opacity: _visible ? 1 : 0,
          duration: const Duration(milliseconds: 700),
          child: controller == null || !controller.value.isInitialized
              ? const SizedBox.shrink()
              : FittedBox(
                  fit: BoxFit.cover,
                  clipBehavior: Clip.hardEdge,
                  child: SizedBox(
                    width: controller.value.size.width,
                    height: controller.value.size.height,
                    child: VideoPlayer(controller),
                  ),
                ),
        ),
      ),
    );
  }
}
