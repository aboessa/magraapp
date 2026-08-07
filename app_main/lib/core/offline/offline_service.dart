import '../../app/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Placeholder constants and UI for the planned offline-download feature.
///
/// NOT WIRED UP: nothing in the app references this class yet, and the Majarra
/// API has no download or licence endpoints at all (no routes, and no
/// `media_licenses` / `child_downloads` tables in any migration). It is retained
/// as the intended shape of the feature. See AUDIT_FLUTTER_APP.md §9 L3.
class OfflineService {
  static const maxDownloads = 25;
  static const licenseDays = 30;

  static bool canDownload({required int currentCount, required bool hasEntitlement}) {
    return hasEntitlement && currentCount < maxDownloads;
  }

  static String licenseExpiry() {
    final d = DateTime.now().add(const Duration(days: licenseDays));
    return '${d.day}/${d.month}/${d.year}';
  }

  static void showDownloadSheet(BuildContext context, String title) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 16),
            const Icon(Icons.download_rounded, color: AppColors.starGold, size: 32),
            const SizedBox(height: 12),
            Text('حمّل "$title" للمشاهدة دون اتصال؟', textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text('التنزيل غير متاح بعد', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11)),
            const SizedBox(height: 16),
            SizedBox(width: double.infinity, height: 46, child: FilledButton(onPressed: () => Navigator.pop(context), style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace), child: const Text('حمّل الآن'))),
          ],
        ),
      ),
    );
  }
}
