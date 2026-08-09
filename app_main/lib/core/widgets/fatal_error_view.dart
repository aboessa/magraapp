import 'package:flutter/material.dart';

import '../../app/theme/app_colors.dart';

/// Release-mode replacement for Flutter's default error widget.
///
/// The default is a grey box in release and carries no useful message. This is
/// installed as `ErrorWidget.builder` from `main.dart` in release builds only:
/// debug keeps Flutter's own red screen because it shows the stack trace.
///
/// It deliberately shows no technical detail. A build error can contain a
/// server payload or file path, and this widget can appear anywhere in the
/// tree, including in front of a child.
class FatalErrorView extends StatelessWidget {
  const FatalErrorView({super.key});

  @override
  Widget build(BuildContext context) {
    // No Scaffold: this may replace a widget deep inside an existing route,
    // where a second Scaffold would assert. Directionality is set explicitly
    // because an error can occur above MaterialApp, with no inherited value.
    return Directionality(
      textDirection: TextDirection.rtl,
      child: ColoredBox(
        color: AppColors.deepSpace,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.sentiment_dissatisfied_rounded,
                  color: AppColors.starGold,
                  size: 44,
                ),
                const SizedBox(height: 16),
                const Text(
                  'حدث خطأ غير متوقع',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  'أعد تشغيل التطبيق. إن تكرر الأمر فأبلغ الدعم.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.78),
                    fontSize: 12.5,
                    height: 1.7,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
