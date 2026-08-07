import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';

class AudioPlayerPage extends StatefulWidget {
  const AudioPlayerPage({required this.title, this.subtitle, super.key});
  final String title;
  final String? subtitle;

  @override
  State<AudioPlayerPage> createState() => _AudioPlayerPageState();
}

class _AudioPlayerPageState extends State<AudioPlayerPage> {
  bool _playing = false;
  double _progress = 0.28;
  double _speed = 1.0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 200), (_) {
      if (_playing && mounted) setState(() => _progress = (_progress + 0.002).clamp(0, 1));
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
                    IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
                    const Spacer(),
                    Text(widget.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                    const Spacer(),
                    const SizedBox(width: 40),
                  ],
                ),
                const SizedBox(height: 24),
                // Artwork
                Center(
                  child: Container(
                    width: 220,
                    height: 220,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: const RadialGradient(center: Alignment(-0.3, -0.3), colors: [Color(0xFF6A3DF2), Color(0xFF0B1026)]),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.12), width: 1.5),
                      boxShadow: [BoxShadow(color: AppColors.cosmicPurple.withValues(alpha: 0.22), blurRadius: 32)],
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.starGold, boxShadow: [BoxShadow(color: AppColors.starGold.withValues(alpha: 0.32), blurRadius: 18)]),
                          child: const Icon(Icons.headphones_rounded, color: AppColors.deepSpace, size: 32),
                        ),
                        if (_playing)
                          SizedBox(
                            width: 220,
                            height: 220,
                            child: CircularProgressIndicator(value: _progress, strokeWidth: 2, backgroundColor: Colors.white.withValues(alpha: 0.06), valueColor: const AlwaysStoppedAnimation(AppColors.starGold)),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Text(widget.title, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                if (widget.subtitle != null) ...[const SizedBox(height: 6), Text(widget.subtitle!, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 12))],
                const Spacer(),
                // Progress
                Row(children: [Text(_fmt(_progress * 240), style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)), const Spacer(), Text(_fmt(240), style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11))]),
                const SizedBox(height: 8),
                SliderTheme(
                  data: SliderThemeData(trackHeight: 4, thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 7), activeTrackColor: AppColors.starGold, inactiveTrackColor: Colors.white.withValues(alpha: 0.12), thumbColor: Colors.white),
                  child: Slider(value: _progress, onChanged: (v) => setState(() => _progress = v)),
                ),
                const SizedBox(height: 16),
                // Controls
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(icon: const Icon(Icons.replay_10_rounded, color: Colors.white), onPressed: () => setState(() => _progress = (_progress - 0.04).clamp(0, 1))),
                    const SizedBox(width: 12),
                    IconButton(icon: const Icon(Icons.skip_previous_rounded, color: Colors.white, size: 32), onPressed: () {}),
                    const SizedBox(width: 12),
                    GestureDetector(
                      onTap: () => setState(() => _playing = !_playing),
                      child: Container(width: 64, height: 64, decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white), child: Icon(_playing ? Icons.pause_rounded : Icons.play_arrow_rounded, color: AppColors.deepSpace, size: 32)),
                    ),
                    const SizedBox(width: 12),
                    IconButton(icon: const Icon(Icons.skip_next_rounded, color: Colors.white, size: 32), onPressed: () {}),
                    const SizedBox(width: 12),
                    IconButton(icon: const Icon(Icons.forward_10_rounded, color: Colors.white), onPressed: () => setState(() => _progress = (_progress + 0.04).clamp(0, 1))),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    ActionChip(label: Text('${_speed}x', style: const TextStyle(color: Colors.white, fontSize: 11)), backgroundColor: Colors.white.withValues(alpha: 0.08), side: BorderSide(color: Colors.white.withValues(alpha: 0.08)), onPressed: () => setState(() => _speed = _speed == 1.0 ? 1.5 : 1.0)),
                    const SizedBox(width: 10),
                    ActionChip(label: const Text('نوم', style: TextStyle(color: Colors.white, fontSize: 11)), avatar: const Icon(Icons.bedtime_rounded, color: Colors.white, size: 14), backgroundColor: Colors.white.withValues(alpha: 0.08), side: BorderSide(color: Colors.white.withValues(alpha: 0.08)), onPressed: () {}),
                  ],
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _fmt(double s) {
    final m = (s ~/ 60).toString().padLeft(1, '0');
    final sec = (s % 60).round().toString().padLeft(2, '0');
    return '$m:$sec';
  }
}
