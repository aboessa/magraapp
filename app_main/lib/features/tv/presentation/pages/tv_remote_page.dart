import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/tv_link_connection.dart';
import '../tv_cast_sheet.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// TV-002/003: the phone as a remote for one television.
///
/// State arrives over a `remote` link socket, pushed by the TV whenever it
/// changes (and every 10 s while playing). Between reports the progress bar
/// advances locally, so it moves smoothly without a message per second.
/// Commands go over HTTP so each one gets the TV's answer.
class TvRemotePage extends ConsumerStatefulWidget {
  const TvRemotePage({required this.deviceId, this.initialName, super.key});

  final String deviceId;
  final String? initialName;

  @override
  ConsumerState<TvRemotePage> createState() => _TvRemotePageState();
}

class _TvRemotePageState extends ConsumerState<TvRemotePage> {
  TvLinkConnection? _connection;
  Timer? _tick;
  String? _name;
  Map<String, Object?>? _state;
  DateTime _stateAt = DateTime.now();
  bool _connected = true;
  bool _busy = false;
  String? _error;
  double? _dragFraction;

  @override
  void initState() {
    super.initState();
    _name = widget.initialName;
    _connection = ref.read(tvLinkConnectionFactoryProvider)(
      role: 'remote',
      onMessage: _onMessage,
    )..start();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _state?['status'] == 'playing') setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    _connection?.stop();
    super.dispose();
  }

  void _onMessage(Map<String, Object?> message) {
    if (!mounted) return;
    if (message['type'] == 'devices') {
      final devices = message['devices'];
      if (devices is! List) return;
      Map<dynamic, dynamic>? mine;
      for (final device in devices) {
        if (device is Map && device['device_id'] == widget.deviceId) {
          mine = device;
        }
      }
      setState(() {
        _connected = mine != null;
        if (mine != null) {
          _name = (mine['name'] as String?) ?? _name;
          final state = mine['state'];
          if (state is Map) {
            _state = state.cast<String, Object?>();
            _stateAt = DateTime.now();
          }
        }
      });
    } else if (message['type'] == 'state' &&
        message['device_id'] == widget.deviceId) {
      final state = message['state'];
      if (state is! Map) return;
      setState(() {
        _connected = true;
        _state = state.cast<String, Object?>();
        _stateAt = DateTime.now();
      });
    }
  }

  int get _durationMs => (_state?['duration_ms'] as int?) ?? 0;

  int get _positionMs {
    final base = (_state?['position_ms'] as int?) ?? 0;
    if (_state?['status'] != 'playing') return base;
    final elapsed = DateTime.now().difference(_stateAt).inMilliseconds;
    final estimate = base + elapsed;
    return _durationMs > 0 && estimate > _durationMs ? _durationMs : estimate;
  }

  Future<void> _send(String command, {int? positionMs, int? deltaMs}) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref
          .read(majarraApiClientProvider)
          .tvLinkCommand(
            deviceId: widget.deviceId,
            command: command,
            positionMs: positionMs,
            deltaMs: deltaMs,
          );
      if (command == 'stop' && mounted) {
        context.canPop() ? context.pop() : context.go('/');
      }
    } on MajarraApiException catch (error) {
      if (mounted) setState(() => _error = castErrorMessage(error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizationsAr().tvtvremotepageError01);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  static String _clock(int ms) {
    final total = (ms / 1000).floor();
    final m = (total ~/ 60).toString();
    final s = (total % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final status = _state?['status'] as String?;
    final playing = status == 'playing';
    final title = _state?['title'] as String?;
    final duration = _durationMs;
    final position = _positionMs;
    final fraction =
        _dragFraction ??
        (duration > 0 ? (position / duration).clamp(0.0, 1.0) : 0.0);

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(_name ?? AppLocalizationsAr().tvtvremotepageBuild01),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.tv_rounded, color: AppColors.electricCyan, size: 64),
              SizedBox(height: 16),
              Text(
                !_connected
                    ? AppLocalizationsAr().tvtvremotepageText01
                    : title ??
                          (status == 'loading'
                              ? AppLocalizationsAr().tvtvremotepageText02
                              : AppLocalizationsAr().tvtvremotepageText03),
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: 4),
              Text(
                switch (status) {
                  'playing' => AppLocalizationsAr().tvtvremotepageText04,
                  'paused' => AppLocalizationsAr().tvtvremotepageText05,
                  'ended' => AppLocalizationsAr().tvtvremotepageText06,
                  'error' => AppLocalizationsAr().tvtvremotepageText07,
                  _ => '',
                },
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white60),
              ),
              const SizedBox(height: 28),
              Slider(
                value: fraction,
                onChanged: duration > 0 && _connected
                    ? (v) => setState(() => _dragFraction = v)
                    : null,
                onChangeEnd: duration > 0 && _connected
                    ? (v) {
                        setState(() => _dragFraction = null);
                        _send('seek', positionMs: (v * duration).round());
                      }
                    : null,
                activeColor: AppColors.starGold,
                semanticFormatterCallback: (v) =>
                    _clock((v * duration).round()),
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _clock(position),
                    style: TextStyle(color: Colors.white70),
                  ),
                  Text(
                    _clock(duration),
                    style: TextStyle(color: Colors.white70),
                  ),
                ],
              ),
              SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    iconSize: 44,
                    tooltip: AppLocalizationsAr().tvtvremotepageTooltip01,
                    color: Colors.white,
                    onPressed: _connected
                        ? () => _send('seek', deltaMs: -10_000)
                        : null,
                    icon: Icon(Icons.replay_10_rounded),
                  ),
                  SizedBox(width: 16),
                  IconButton.filled(
                    iconSize: 56,
                    tooltip: playing
                        ? AppLocalizationsAr().tvtvremotepageText08
                        : AppLocalizationsAr().tvtvremotepageText09,
                    style: IconButton.styleFrom(
                      backgroundColor: AppColors.starGold,
                      foregroundColor: AppColors.deepSpace,
                    ),
                    onPressed: _connected && !_busy
                        ? () => _send(playing ? 'pause' : 'resume')
                        : null,
                    icon: Icon(
                      playing ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    ),
                  ),
                  SizedBox(width: 16),
                  IconButton(
                    iconSize: 44,
                    tooltip: AppLocalizationsAr().tvtvremotepageTooltip02,
                    color: Colors.white,
                    onPressed: _connected
                        ? () => _send('seek', deltaMs: 10_000)
                        : null,
                    icon: Icon(Icons.forward_10_rounded),
                  ),
                ],
              ),
              SizedBox(height: 20),
              OutlinedButton.icon(
                onPressed: _connected && !_busy ? () => _send('stop') : null,
                icon: Icon(Icons.stop_rounded),
                label: Text(AppLocalizationsAr().tvtvremotepageText10),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: BorderSide(color: Colors.white.withValues(alpha: 0.4)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 16),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    _error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Color(0xFFFF8A8A)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
