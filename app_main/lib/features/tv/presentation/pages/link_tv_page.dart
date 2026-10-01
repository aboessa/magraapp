import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/auth_guard.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../home/application/home_providers.dart';
import '../../../home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// TV-001: the phone half of television sign-in.
///
/// Reached from the devices screen, or directly from the QR on the television
/// (`majarra://app/link-tv?code=…`). The parent types or confirms the code, sees
/// which device is asking, and approves it with their PIN. The television then
/// signs itself in; nothing is typed on the TV.
class LinkTvPage extends ConsumerStatefulWidget {
  const LinkTvPage({this.initialCode, super.key});

  final String? initialCode;

  @override
  ConsumerState<LinkTvPage> createState() => _LinkTvPageState();
}

enum _LinkStep { enterCode, confirm, done }

class _LinkTvPageState extends ConsumerState<LinkTvPage> {
  late final TextEditingController _code;
  _LinkStep _step = _LinkStep.enterCode;
  bool _busy = false;
  String? _error;
  bool _deviceLimit = false;
  Map<String, Object?>? _device;

  @override
  void initState() {
    super.initState();
    _code = TextEditingController(text: _format(widget.initialCode ?? ''));
    // A code carried by the QR link is looked up straight away.
    if (_normalized(_code.text) != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _lookup());
    }
  }

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  static final _alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  static String? _normalized(String value) {
    final code = value.toUpperCase().replaceAll(RegExp(r'[\s-]'), '');
    if (code.length != 8) return null;
    for (final character in code.split('')) {
      if (!_alphabet.contains(character)) return null;
    }
    return code;
  }

  static String _format(String value) {
    final code = value.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');
    final trimmed = code.length > 8 ? code.substring(0, 8) : code;
    return trimmed.length > 4
        ? '${trimmed.substring(0, 4)}-${trimmed.substring(4)}'
        : trimmed;
  }

  Future<void> _lookup() async {
    final code = _normalized(_code.text);
    if (code == null) {
      setState(() => _error = AppLocalizationsAr().tvlinktvpageError01);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _deviceLimit = false;
    });
    try {
      final envelope = await ref
          .read(majarraApiClientProvider)
          .lookupTvPairing(code: code);
      final data = envelope['data'];
      if (!mounted) return;
      setState(() {
        _device = data is Map
            ? data.cast<String, Object?>()
            : <String, Object?>{};
        _step = _LinkStep.confirm;
      });
    } on MajarraApiException catch (error) {
      if (!mounted) return;
      setState(
        () => _error = error.statusCode == 404
            ? AppLocalizationsAr().tvlinktvpageText01
            : AppLocalizationsAr().tvlinktvpageText02,
      );
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizationsAr().tvlinktvpageError02);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approve() async {
    final code = _normalized(_code.text);
    if (code == null) return;
    // Approval needs a fresh parent PIN proof. The PIN screen returns here with
    // `true` rather than navigating away, so the code on screen is kept.
    if (!ref.read(authGuardProvider).hasParentAccess) {
      final unlocked = await context.push<bool>('/parent-pin?from=/link-tv');
      if (!mounted || unlocked != true) return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _deviceLimit = false;
    });
    try {
      await ref.read(majarraApiClientProvider).approveTvPairing(code: code);
      if (!mounted) return;
      setState(() => _step = _LinkStep.done);
    } on MajarraApiException catch (error) {
      if (!mounted) return;
      final message = error.message.toLowerCase();
      final limit =
          error.statusCode == 403 &&
          (message.contains('device limit') || message.contains('tv limit'));
      setState(() {
        _deviceLimit = limit;
        _error = switch (error.statusCode) {
          404 => AppLocalizationsAr().tvlinktvpageText03,
          409 => AppLocalizationsAr().tvlinktvpageText04,
          403 when limit => AppLocalizationsAr().tvlinktvpageText05,
          403 => AppLocalizationsAr().tvlinktvpageText06,
          _ => AppLocalizationsAr().tvlinktvpageText07,
        };
      });
    } catch (_) {
      if (mounted) {
        setState(() => _error = AppLocalizationsAr().tvlinktvpageError03);
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: Text(AppLocalizationsAr().tvlinktvpageBuild01),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            switch (_step) {
              _LinkStep.enterCode => _enterCode(),
              _LinkStep.confirm => _confirm(),
              _LinkStep.done => _done(),
            },
            if (_error != null) ...[
              SizedBox(height: 16),
              Semantics(
                liveRegion: true,
                child: Text(
                  _error!,
                  style: TextStyle(color: Color(0xFFFF8A8A), fontSize: 14),
                ),
              ),
            ],
            if (_deviceLimit) ...[
              SizedBox(height: 8),
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: () => context.push('/devices'),
                  child: Text(AppLocalizationsAr().tvlinktvpageText08),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _enterCode() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.tv_rounded, color: AppColors.starGold, size: 48),
        SizedBox(height: 12),
        Text(
          AppLocalizationsAr().tvlinktvpageText09,
          style: TextStyle(color: Colors.white, fontSize: 16, height: 1.5),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: _code,
          autofocus: widget.initialCode == null,
          textDirection: TextDirection.ltr,
          textAlign: TextAlign.center,
          textCapitalization: TextCapitalization.characters,
          autocorrect: false,
          enableSuggestions: false,
          maxLength: 9,
          style: TextStyle(
            color: Colors.white,
            fontSize: 28,
            letterSpacing: 4,
            fontWeight: FontWeight.w800,
          ),
          inputFormatters: [
            TextInputFormatter.withFunction((oldValue, newValue) {
              final formatted = _format(newValue.text);
              return TextEditingValue(
                text: formatted,
                selection: TextSelection.collapsed(offset: formatted.length),
              );
            }),
          ],
          decoration: InputDecoration(
            labelText: AppLocalizationsAr().tvlinktvpageLabelText01,
            hintText: 'ABCD-EF23',
            counterText: '',
            labelStyle: const TextStyle(color: Colors.white70),
            hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.3)),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(
                color: Colors.white.withValues(alpha: 0.3),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide(color: AppColors.starGold, width: 2),
            ),
          ),
          onSubmitted: (_) => _lookup(),
        ),
        SizedBox(height: 20),
        SizedBox(
          height: 52,
          child: FilledButton(
            onPressed: _busy ? null : _lookup,
            child: _busy
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(AppLocalizationsAr().tvlinktvpageText10),
          ),
        ),
      ],
    );
  }

  Widget _confirm() {
    final platform = _device?['platform'] == 'tvos' ? 'Apple TV' : 'Android TV';
    final name = (_device?['device_name'] as String?)?.trim();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Color(0xFF111A3A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Row(
            children: [
              Icon(Icons.tv_rounded, color: AppColors.electricCyan, size: 36),
              SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name == null || name.isEmpty
                          ? AppLocalizationsAr().tvlinktvpageText11
                          : name,
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      AppLocalizationsAr().tvlinktvpageText12(
                        platform,
                        _device?['code'] ?? _code.text,
                      ),
                      textDirection: TextDirection.ltr,
                      style: TextStyle(color: Colors.white70, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        SizedBox(height: 16),
        Text(
          AppLocalizationsAr().tvlinktvpageText13,
          style: TextStyle(color: Colors.white, fontSize: 15, height: 1.5),
        ),
        SizedBox(height: 20),
        SizedBox(
          height: 52,
          child: FilledButton.icon(
            onPressed: _busy ? null : _approve,
            icon: Icon(Icons.lock_open_rounded),
            label: _busy
                ? SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(AppLocalizationsAr().tvlinktvpageText14),
          ),
        ),
        SizedBox(height: 8),
        TextButton(
          onPressed: _busy
              ? null
              : () => setState(() {
                  _step = _LinkStep.enterCode;
                  _error = null;
                  _deviceLimit = false;
                }),
          child: Text(AppLocalizationsAr().tvlinktvpageText15),
        ),
      ],
    );
  }

  Widget _done() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Icon(Icons.check_circle_rounded, color: Color(0xFF3DDC84), size: 56),
        SizedBox(height: 12),
        Text(
          AppLocalizationsAr().tvlinktvpageText16,
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white, fontSize: 17, height: 1.5),
        ),
        SizedBox(height: 8),
        Text(
          AppLocalizationsAr().tvlinktvpageText17,
          textAlign: TextAlign.center,
          style: TextStyle(color: Colors.white70, fontSize: 14),
        ),
        SizedBox(height: 20),
        FilledButton(
          onPressed: () => context.canPop() ? context.pop() : context.go('/'),
          child: Text(AppLocalizationsAr().tvlinktvpageText18),
        ),
      ],
    );
  }
}
