import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../auth/data/installation_identity.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import '../../data/tv_session_origin.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// TV-001: sign in on a television with a code approved from a phone.
///
/// The television never sees the parent's email or password. It shows a code
/// and a QR, polls the server, and receives its own session once a parent
/// approves the code with their PIN on a phone that is already signed in.
class TvPairingPage extends ConsumerStatefulWidget {
  const TvPairingPage({super.key});

  @override
  ConsumerState<TvPairingPage> createState() => _TvPairingPageState();
}

enum _PairingPhase { requesting, waiting, signingIn, failed }

class _TvPairingPageState extends ConsumerState<TvPairingPage> {
  _PairingPhase _phase = _PairingPhase.requesting;
  String? _code;
  String? _pollSecret;
  String? _link;
  DateTime? _expiresAt;
  Duration _interval = const Duration(seconds: 5);
  Timer? _pollTimer;
  Timer? _clock;
  bool _polling = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _requestCode();
    // Drives the countdown only; polling has its own timer.
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final expiresAt = _expiresAt;
      if (_phase == _PairingPhase.waiting &&
          expiresAt != null &&
          DateTime.now().isAfter(expiresAt)) {
        _requestCode();
      } else {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _clock?.cancel();
    super.dispose();
  }

  String get _platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'tvos' : 'android_tv';

  Future<void> _requestCode() async {
    _pollTimer?.cancel();
    setState(() {
      _phase = _PairingPhase.requesting;
      _error = null;
    });
    try {
      final installationId = await ref
          .read(installationIdentityProvider)
          .getOrCreate();
      final envelope = await ref
          .read(majarraApiClientProvider)
          .startTvPairing(
            installationId: installationId,
            platform: _platform,
            deviceName: await televisionLabel(),
          );
      final data = envelope['data'];
      if (data is! Map) throw const MajarraApiException('Unexpected response');
      final code = data['code'];
      final secret = data['poll_secret'];
      final expiresIn = data['expires_in'];
      final interval = data['interval'];
      final link = data['verification_uri_complete'];
      if (code is! String || secret is! String || expiresIn is! int) {
        throw MajarraApiException('Unexpected response');
      }
      if (!mounted) return;
      setState(() {
        _code = code;
        _pollSecret = secret;
        _link = link is String ? link : null;
        _expiresAt = DateTime.now().add(Duration(seconds: expiresIn));
        _interval = Duration(
          seconds: interval is int && interval > 0 ? interval : 5,
        );
        _phase = _PairingPhase.waiting;
      });
      _pollTimer = Timer.periodic(_interval, (_) => _poll());
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _phase = _PairingPhase.failed;
        _error = error is MajarraApiException && error.statusCode == 429
            ? AppLocalizationsAr().tvtvpairingpageText01
            : AppLocalizationsAr().tvtvpairingpageText02;
      });
    }
  }

  Future<void> _poll() async {
    final code = _code;
    final secret = _pollSecret;
    if (_polling || code == null || secret == null) return;
    if (_phase != _PairingPhase.waiting) return;
    _polling = true;
    try {
      final envelope = await ref
          .read(majarraApiClientProvider)
          .pollTvPairing(code: code, pollSecret: secret);
      final data = envelope['data'];
      if (data is! Map || data['status'] != 'approved') return;
      _pollTimer?.cancel();
      await _signIn(data.cast<String, Object?>());
    } on MajarraApiException catch (error) {
      // An expired or consumed code is replaced rather than shown as an error:
      // the television should always have a usable code on screen.
      if (error.statusCode == 410 && mounted) unawaited(_requestCode());
      // Anything else is transient; the next tick tries again.
    } catch (_) {
      // Network blips are expected on TV Wi-Fi; keep polling.
    } finally {
      _polling = false;
    }
  }

  Future<void> _signIn(Map<String, Object?> data) async {
    final access = data['access_token'];
    final refresh = data['refresh_token'];
    final parent = data['parent'];
    final parentId = parent is Map ? parent['id']?.toString() : null;
    if (access is! String || refresh is! String || parentId == null) {
      if (mounted) unawaited(_requestCode());
      return;
    }
    if (!mounted) return;
    setState(() => _phase = _PairingPhase.signingIn);
    await ref
        .read(authStorageProvider)
        .save(accessToken: access, refreshToken: refresh, parentId: parentId);
    await TvSessionOrigin.record(TvSessionOrigin.pairing);
    ref.read(authGuardProvider).setAuthenticated(true, parentId: parentId);
    if (!mounted) return;
    context.go('/children');
  }

  String _remaining() {
    final expiresAt = _expiresAt;
    if (expiresAt == null) return '';
    final left = expiresAt.difference(DateTime.now());
    if (left.isNegative) return '0:00';
    final minutes = left.inMinutes;
    final seconds = (left.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: FocusTraversalGroup(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(32),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 960),
                  child: Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 48,
                    runSpacing: 32,
                    children: [
                      SizedBox(width: 420, child: _instructions()),
                      _codeCard(),
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

  Widget _instructions() {
    final muted = AppColors.mutedText.withValues(alpha: 0.85);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Semantics(
          header: true,
          child: Text(
            AppLocalizationsAr().tvtvpairingpageText03,
            style: TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        SizedBox(height: 16),
        for (final (index, step) in [
          AppLocalizationsAr().tvtvpairingpageText04,
          AppLocalizationsAr().tvtvpairingpageText05,
          AppLocalizationsAr().tvtvpairingpageText06,
        ].indexed)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Text(
              '${index + 1}. $step',
              style: TextStyle(color: muted, fontSize: 17, height: 1.5),
            ),
          ),
        SizedBox(height: 20),
        OutlinedButton.icon(
          onPressed: () => context.go('/login?method=email'),
          icon: Icon(Icons.mail_outline_rounded),
          label: Text(AppLocalizationsAr().tvtvpairingpageText07),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.white,
            side: BorderSide(color: Colors.white.withValues(alpha: 0.4)),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          ),
        ),
      ],
    );
  }

  Widget _codeCard() {
    return Container(
      width: 360,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: switch (_phase) {
        _PairingPhase.requesting => SizedBox(
          height: 320,
          child: Center(child: CircularProgressIndicator()),
        ),
        _PairingPhase.signingIn => SizedBox(
          height: 320,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF1E9E5A),
                  size: 56,
                ),
                SizedBox(height: 12),
                Text(
                  AppLocalizationsAr().tvtvpairingpageText08,
                  style: TextStyle(
                    color: Color(0xFF0B1026),
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
        _PairingPhase.failed => SizedBox(
          height: 320,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.wifi_off_rounded,
                color: Color(0xFF546078),
                size: 48,
              ),
              const SizedBox(height: 12),
              Text(
                _error ?? '',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFF0B1026), fontSize: 16),
              ),
              const SizedBox(height: 16),
              FilledButton(
                autofocus: true,
                onPressed: _requestCode,
                child: const Text('حاول مرة أخرى'),
              ),
            ],
          ),
        ),
        _PairingPhase.waiting => Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_link != null)
              Semantics(
                label: 'رمز QR لربط التلفزيون',
                child: QrImageView(
                  data: _link!,
                  size: 200,
                  backgroundColor: Colors.white,
                ),
              ),
            const SizedBox(height: 16),
            Semantics(
              label: 'كود الربط ${_code?.split('').join(' ')}',
              excludeSemantics: true,
              child: Text(
                _code ?? '',
                textDirection: TextDirection.ltr,
                style: const TextStyle(
                  color: Color(0xFF0B1026),
                  fontSize: 40,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 6,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'ينتهي خلال ${_remaining()}',
              style: const TextStyle(color: Color(0xFF546078), fontSize: 14),
            ),
            const SizedBox(height: 12),
            TextButton.icon(
              autofocus: true,
              onPressed: _requestCode,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('كود جديد'),
            ),
          ],
        ),
      },
    );
  }
}
