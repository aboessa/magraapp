import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../auth/data/installation_identity.dart';
import '../../child/application/child_provider.dart';
import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// The TV the phone handed playback to.
typedef TvCastChoice = ({String deviceId, String? name});

/// TV-002: pick a connected TV and start this episode on it.
///
/// Returns the chosen TV once it has confirmed playback, or null if the sheet
/// was dismissed. The command carries the active child, so the TV plays as that
/// child and applies that child's rules.
Future<TvCastChoice?> showTvCastSheet(
  BuildContext context, {
  required String episodeId,
  required int positionMs,
}) {
  return showModalBottomSheet<TvCastChoice>(
    context: context,
    backgroundColor: const Color(0xFF111A3A),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (_) => TvCastSheet(episodeId: episodeId, positionMs: positionMs),
  );
}

class TvCastSheet extends ConsumerStatefulWidget {
  const TvCastSheet({
    required this.episodeId,
    required this.positionMs,
    super.key,
  });

  final String episodeId;
  final int positionMs;

  @override
  ConsumerState<TvCastSheet> createState() => _TvCastSheetState();
}

class _TvCastSheetState extends ConsumerState<TvCastSheet> {
  List<Map<String, Object?>>? _devices;
  String? _busyDevice;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _devices = null;
      _error = null;
    });
    try {
      final devices = await ref.read(majarraApiClientProvider).tvLinkDevices();
      if (mounted) setState(() => _devices = devices);
    } catch (_) {
      if (mounted) {
        setState(() {
          _devices = [];
          _error = AppLocalizationsAr().tvtvcastsheetError01;
        });
      }
    }
  }

  Future<void> _cast(Map<String, Object?> device) async {
    final deviceId = device['device_id'];
    if (deviceId is! String) return;
    final childId = ref.read(childProvider).activeChildId;
    if (childId == null) {
      setState(() => _error = AppLocalizationsAr().tvtvcastsheetError02);
      return;
    }
    setState(() {
      _busyDevice = deviceId;
      _error = null;
    });
    try {
      await ref
          .read(majarraApiClientProvider)
          .tvLinkCommand(
            deviceId: deviceId,
            command: 'play',
            episodeId: widget.episodeId,
            childId: childId,
            positionMs: widget.positionMs,
            from: currentDeviceLabel,
          );
      if (!mounted) return;
      Navigator.of(context).pop<TvCastChoice>((
        deviceId: deviceId,
        name: device['name'] as String?,
      ));
    } on MajarraApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = castErrorMessage(error));
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizationsAr().tvtvcastsheetError03);
      }
    } finally {
      if (mounted) setState(() => _busyDevice = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final devices = _devices;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              AppLocalizationsAr().tvtvcastsheetBuild01,
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            SizedBox(height: 12),
            if (devices == null)
              Padding(
                padding: EdgeInsets.all(24),
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.starGold),
                ),
              )
            else if (devices.isEmpty && _error == null)
              Column(
                children: [
                  Icon(Icons.tv_off_rounded, color: Colors.white54, size: 40),
                  SizedBox(height: 8),
                  Text(
                    AppLocalizationsAr().tvtvcastsheetText01,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, height: 1.5),
                  ),
                  TextButton(
                    onPressed: _load,
                    child: Text(AppLocalizationsAr().tvtvcastsheetText02),
                  ),
                ],
              )
            else
              for (final device in devices)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    Icons.tv_rounded,
                    color: AppColors.electricCyan,
                  ),
                  title: Text(
                    (device['name'] as String?) ??
                        AppLocalizationsAr().tvtvcastsheetText03,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  subtitle: Text(
                    _statusLine(device),
                    style: const TextStyle(color: Colors.white60),
                  ),
                  trailing: _busyDevice == device['device_id']
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(
                          Icons.play_circle_fill_rounded,
                          color: AppColors.starGold,
                        ),
                  onTap: _busyDevice == null ? () => _cast(device) : null,
                ),
            if (_error != null) ...[
              SizedBox(height: 8),
              Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Color(0xFFFF8A8A)),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static String _statusLine(Map<String, Object?> device) {
    final state = device['state'];
    if (state is Map && state['status'] == 'playing') {
      final title = state['title'];
      return title is String
          ? AppLocalizationsAr().tvtvcastsheetText04(title)
          : AppLocalizationsAr().tvtvcastsheetText05;
    }
    return AppLocalizationsAr().tvtvcastsheetText06;
  }
}

/// Plain words for why a TV did not start. Shared with the remote screen.
String castErrorMessage(MajarraApiException error) {
  final code = error.code ?? '';
  if (code == 'tv_offline' ||
      error.statusCode == 404 && code != 'child_not_found') {
    return AppLocalizationsAr().tvtvcastsheetCastErrorMessage01;
  }
  if (code == 'tv_timeout' || code == 'start_timeout') {
    return AppLocalizationsAr().tvtvcastsheetCastErrorMessage02;
  }
  if (code == 'child_not_found') {
    return AppLocalizationsAr().tvtvcastsheetCastErrorMessage03;
  }
  if (code.contains('dailyLimit') || code.contains('daily_limit')) {
    return AppLocalizationsAr().tvtvcastsheetCastErrorMessage04;
  }
  if (code.contains('bedtime')) {
    return AppLocalizationsAr().tvtvcastsheetCastErrorMessage05;
  }
  if (code.contains('sessionLimit') || code.contains('session_limit')) {
    return AppLocalizationsAr().tvtvcastsheetCastErrorMessage06;
  }
  if (code.contains('concurrent')) {
    return AppLocalizationsAr().tvtvcastsheetText07;
  }
  if (code.contains('forbidden')) {
    return AppLocalizationsAr().tvtvcastsheetText08;
  }
  if (code == 'not_playing') return AppLocalizationsAr().tvtvcastsheetText09;
  return AppLocalizationsAr().tvtvcastsheetText10;
}
