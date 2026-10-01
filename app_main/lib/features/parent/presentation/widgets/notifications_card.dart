import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/push/push_service.dart';
import '../../../home/application/home_providers.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// `APP-203`: turn family notifications on for this phone, and choose kinds.
///
/// Lives in the parent area, so the Android permission prompt is shown to a
/// parent, not a child. Switching a kind needs the parent-area proof the
/// parent already holds here.
class NotificationsCard extends ConsumerStatefulWidget {
  const NotificationsCard({super.key});

  @override
  ConsumerState<NotificationsCard> createState() => _NotificationsCardState();
}

class _NotificationsCardState extends ConsumerState<NotificationsCard> {
  static final _kinds = <(String, String, String)>[
    (
      'new_episodes',
      AppLocalizationsAr().parentnotificationscardNotificationsCard01,
      AppLocalizationsAr().parentnotificationscardNotificationsCard02,
    ),
    (
      'screen_time',
      AppLocalizationsAr().parentnotificationscardNotificationsCard03,
      AppLocalizationsAr().parentnotificationscardNotificationsCard04,
    ),
    (
      'weekly_report',
      AppLocalizationsAr().parentnotificationscardNotificationsCard05,
      AppLocalizationsAr().parentnotificationscardNotificationsCard06,
    ),
  ];

  bool? _enabled;
  Map<String, bool>? _prefs;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await ref.read(majarraApiClientProvider).pushPreferences();
      if (mounted) setState(() => _prefs = prefs);
    } catch (_) {
      if (mounted) {
        setState(() => _prefs = {for (final k in _kinds) k.$1: true});
      }
    }
  }

  Future<void> _enable() async {
    setState(() => _busy = true);
    final ok = await PushService.instance.enable(
      ref.read(majarraApiClientProvider),
    );
    if (!mounted) return;
    setState(() {
      _busy = false;
      _enabled = ok;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? AppLocalizationsAr().parentnotificationscardText01
              : AppLocalizationsAr().parentnotificationscardText02,
        ),
      ),
    );
  }

  Future<void> _toggle(String kind, bool value) async {
    final previous = _prefs?[kind] ?? true;
    setState(() => _prefs = {...?_prefs, kind: value});
    try {
      await ref.read(majarraApiClientProvider).savePushPreference(kind, value);
    } catch (_) {
      if (!mounted) return;
      setState(() => _prefs = {...?_prefs, kind: previous});
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(AppLocalizationsAr().parentnotificationscardKind01),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!PushService.supported) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Color(0xFF111A3A).withValues(alpha: 0.82),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.notifications_active_rounded,
                color: AppColors.starGold,
                size: 18,
              ),
              SizedBox(width: 8),
              Text(
                AppLocalizationsAr().parentnotificationscardText03,
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          Divider(height: 18, color: Colors.white12),
          if (_enabled != true)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: FilledButton.icon(
                onPressed: _busy ? null : _enable,
                icon: Icon(Icons.notifications_rounded),
                label: Text(AppLocalizationsAr().parentnotificationscardText04),
              ),
            ),
          for (final (kind, title, subtitle) in _kinds)
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _prefs?[kind] ?? true,
              onChanged: _prefs == null
                  ? null
                  : (value) => _toggle(kind, value),
              title: Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
              subtitle: Text(
                subtitle,
                style: const TextStyle(
                  color: AppColors.mutedText,
                  fontSize: 11.5,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
