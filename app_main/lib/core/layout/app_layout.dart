import 'package:flutter/widgets.dart';

enum AppLayoutClass { compact, medium, expanded }

abstract final class AppBreakpoints {
  static const compactMax = 599.0;
  static const mediumMax = 1023.0;
  static const shortViewportMax = 479.0;

  static AppLayoutClass fromWidth(double width) {
    if (width <= compactMax) return AppLayoutClass.compact;
    if (width <= mediumMax) return AppLayoutClass.medium;
    return AppLayoutClass.expanded;
  }

  static AppLayoutClass fromSize(Size size) {
    // Short landscape phones keep compact navigation even when they are wide.
    if (size.height <= shortViewportMax) return AppLayoutClass.compact;
    return fromWidth(size.width);
  }
}

extension AppLayoutContext on BuildContext {
  AppLayoutClass get layoutClass =>
      AppBreakpoints.fromSize(MediaQuery.sizeOf(this));

  bool get isCompact => layoutClass == AppLayoutClass.compact;
  bool get isExpanded => layoutClass == AppLayoutClass.expanded;

  double get horizontalPagePadding => switch (layoutClass) {
    AppLayoutClass.compact => 18,
    AppLayoutClass.medium => 32,
    AppLayoutClass.expanded => 52,
  };
}
