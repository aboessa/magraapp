import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/theme/app_colors.dart';

class FocusableScale extends StatefulWidget {
  const FocusableScale({
    required this.child,
    required this.onPressed,
    this.semanticLabel,
    this.autofocus = false,
    this.borderRadius = const BorderRadius.all(Radius.circular(20)),
    this.focusScale = 1.045,
    this.focusOrder,
    super.key,
  });

  final Widget child;
  final VoidCallback onPressed;
  final String? semanticLabel;
  final bool autofocus;
  final BorderRadius borderRadius;
  final double focusScale;
  final FocusOrder? focusOrder;

  @override
  State<FocusableScale> createState() => _FocusableScaleState();
}

class _FocusableScaleState extends State<FocusableScale> {
  bool _focused = false;
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final highlighted = _focused || _hovered;
    final reduceMotion = MediaQuery.disableAnimationsOf(context);
    final animationDuration = reduceMotion
        ? Duration.zero
        : const Duration(milliseconds: 180);
    Widget result = Semantics(
      button: true,
      label: widget.semanticLabel,
      child: CallbackShortcuts(
        bindings: {
          const SingleActivator(LogicalKeyboardKey.select): widget.onPressed,
          const SingleActivator(LogicalKeyboardKey.enter): widget.onPressed,
          const SingleActivator(LogicalKeyboardKey.gameButtonA):
              widget.onPressed,
        },
        child: FocusableActionDetector(
          autofocus: widget.autofocus,
          mouseCursor: SystemMouseCursors.click,
          onShowFocusHighlight: (value) => setState(() => _focused = value),
          onShowHoverHighlight: (value) => setState(() => _hovered = value),
          actions: {
            ActivateIntent: CallbackAction<ActivateIntent>(
              onInvoke: (_) {
                widget.onPressed();
                return null;
              },
            ),
          },
          child: AnimatedScale(
            scale: highlighted ? widget.focusScale : 1,
            duration: animationDuration,
            curve: Curves.easeOutCubic,
            child: AnimatedContainer(
              duration: animationDuration,
              curve: Curves.easeOutCubic,
              decoration: BoxDecoration(
                borderRadius: widget.borderRadius,
                border: Border.all(
                  width: highlighted ? 2.2 : 1,
                  color: highlighted
                      ? Colors.white
                      : AppColors.starlight.withValues(alpha: 0.08),
                ),
                boxShadow: highlighted
                    ? [
                        BoxShadow(color: Colors.white.withValues(alpha: 0.92), blurRadius: 0, spreadRadius: 1),
                        BoxShadow(color: AppColors.electricCyan.withValues(alpha: 0.38), blurRadius: 22, spreadRadius: 3),
                        BoxShadow(color: Colors.black.withValues(alpha: 0.22), blurRadius: 12),
                      ]
                    : const [],
              ),
              child: ClipRRect(
                borderRadius: widget.borderRadius,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: widget.onPressed,
                  child: widget.child,
                ),
              ),
            ),
          ),
        ),
      ),
    );

    if (widget.focusOrder case final order?) {
      result = FocusTraversalOrder(order: order, child: result);
    }
    return result;
  }
}
