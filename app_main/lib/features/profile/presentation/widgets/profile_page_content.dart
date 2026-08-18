import 'package:flutter/material.dart';

/// Centers profile/account content and prevents phone-oriented cards from
/// stretching across an entire tablet, desktop, or television canvas.
class ProfilePageContent extends StatelessWidget {
  const ProfilePageContent({
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.maxWidth = 720,
    super.key,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: BoxConstraints(maxWidth: maxWidth),
      child: SizedBox(
        width: double.infinity,
        child: Padding(padding: padding, child: child),
      ),
    ),
  );
}
