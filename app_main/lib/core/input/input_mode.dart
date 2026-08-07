import 'dart:ui' show PointerDeviceKind;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

enum AppInputMode { touch, pointer, directional }

class AppInputModeNotifier extends ValueNotifier<AppInputMode> {
  AppInputModeNotifier() : super(AppInputMode.touch);

  void useTouch() => value = AppInputMode.touch;
  void usePointer() => value = AppInputMode.pointer;
  void useDirectional() => value = AppInputMode.directional;
}

class AppInputModeScope extends InheritedNotifier<AppInputModeNotifier> {
  const AppInputModeScope({
    required AppInputModeNotifier notifier,
    required super.child,
    super.key,
  }) : super(notifier: notifier);

  static AppInputModeNotifier of(BuildContext context) {
    final scope = context
        .dependOnInheritedWidgetOfExactType<AppInputModeScope>();
    assert(scope != null, 'AppInputModeScope is missing above this context.');
    return scope!.notifier!;
  }
}

class InputModeTracker extends StatefulWidget {
  const InputModeTracker({required this.child, super.key});

  final Widget child;

  @override
  State<InputModeTracker> createState() => _InputModeTrackerState();
}

class _InputModeTrackerState extends State<InputModeTracker> {
  final AppInputModeNotifier _notifier = AppInputModeNotifier();

  @override
  void dispose() {
    _notifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppInputModeScope(
      notifier: _notifier,
      child: Listener(
        behavior: HitTestBehavior.translucent,
        onPointerDown: (event) {
          if (event.kind == PointerDeviceKind.touch) {
            _notifier.useTouch();
          } else {
            _notifier.usePointer();
          }
        },
        onPointerHover: (_) => _notifier.usePointer(),
        child: Focus(
          canRequestFocus: false,
          onKeyEvent: (_, event) {
            if (event is KeyDownEvent || event is KeyRepeatEvent) {
              _notifier.useDirectional();
            }
            return KeyEventResult.ignored;
          },
          child: widget.child,
        ),
      ),
    );
  }
}
