import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../../l10n/app_localizations.dart';
import '../../../../l10n/app_localizations_ar.dart';

class SupportPage extends StatelessWidget {
  const SupportPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context) ?? AppLocalizationsAr();
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
              title: Text(l10n.supportTitle, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [const Color(0xFF6A3DF2), const Color(0xFF1B2550)]),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                      child: Column(
                        children: [
                          Container(width: 56, height: 56, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.12)), child: const Icon(Icons.support_agent_rounded, color: Colors.white, size: 28)),
                          const SizedBox(height: 14),
                          Text(l10n.supportHeadline, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text(l10n.supportResponseTime, style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 12)),
                          const SizedBox(height: 16),
                          // Disabled, not silently inert. There is no support
                          // channel yet: the API has no support route, and no
                          // support address has been published. A button that
                          // looks live and swallows the tap is worse than one
                          // that states it is not ready.
                          SizedBox(width: double.infinity, height: 44, child: FilledButton.icon(onPressed: null, style: FilledButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppColors.deepSpace), icon: const Icon(Icons.chat_rounded, size: 18), label: Text(l10n.supportChannelPending))),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Every destination below is unbuilt: no FAQ content, no
                    // issue-report endpoint, no published phone number. Passing
                    // null renders each row visibly disabled.
                    _SupportTile(icon: Icons.help_outline_rounded, title: l10n.supportFaqTitle, subtitle: l10n.supportFaqSubtitle),
                    const SizedBox(height: 10),
                    _SupportTile(icon: Icons.bug_report_outlined, title: l10n.supportReportTitle, subtitle: l10n.notAvailableYet),
                    const SizedBox(height: 10),
                    _SupportTile(icon: Icons.lightbulb_outline_rounded, title: l10n.supportSuggestTitle, subtitle: l10n.notAvailableYet),
                    const SizedBox(height: 10),
                    _SupportTile(icon: Icons.phone_outlined, title: l10n.supportCallTitle, subtitle: l10n.supportCallSubtitle),
                    const SizedBox(height: 10),
                    // The one genuinely working action on this page. Also a
                    // licence obligation: the bundled Readex Pro is OFL, and
                    // main.dart registers its text for this page to show.
                    _SupportTile(
                      icon: Icons.description_outlined,
                      title: l10n.licensesTitle,
                      subtitle: l10n.licensesSubtitle,
                      onTap: () => showLicensePage(
                        context: context,
                        applicationName: l10n.appTitle,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Support row.
///
/// [onTap] is nullable on purpose: most destinations on this page do not exist
/// yet. A null callback dims the row and drops the chevron, so an unbuilt
/// feature reads as unavailable instead of broken.
class _SupportTile extends StatelessWidget {
  const _SupportTile({required this.icon, required this.title, required this.subtitle, this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;
    // Opacity is not enough on its own: `Semantics.enabled` is what tells a
    // screen reader the row cannot be actioned.
    final foreground = enabled
        ? Colors.white
        : Colors.white.withValues(alpha: 0.38);

    return Semantics(
      button: true,
      enabled: enabled,
      child: Material(
        color: const Color(0xFF111A3A).withValues(alpha: enabled ? 0.72 : 0.42),
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(border: Border.all(color: Colors.white.withValues(alpha: 0.06)), borderRadius: BorderRadius.circular(14)),
            child: Row(
              children: [
                Container(width: 40, height: 40, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.06), borderRadius: BorderRadius.circular(10)), child: Icon(icon, color: foreground, size: 20)),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: TextStyle(color: foreground, fontWeight: FontWeight.w700)),
                      Text(subtitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11)),
                    ],
                  ),
                ),
                if (enabled)
                  const Icon(Icons.chevron_left_rounded, color: AppColors.mutedText),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
