import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';

/// Anonymous forensic watermark drawn over high-value playback.
///
/// Implements `تشفير المحتوي.md:1138-1141`:
///
///   * animated and anonymous, tied to an auditable pseudonymous session id
///   * carries no nickname, email, child id, or any other PII
///   * never covers subtitles or educational text
///   * applied at display time, never baked into the stored asset
///
/// ## What this does and does not achieve
///
/// This is a distribution deterrent, not a protection mechanism. It cannot stop a
/// recording; it makes a leaked recording traceable to an account-and-hour window
/// so the source can be revoked. The plan is explicit that no measure prevents an
/// external camera (`:1141`), so this is deliberately low-contrast rather than
/// obtrusive — a watermark aggressive enough to defeat cropping would also ruin
/// the viewing experience for the paying family.
class PlaybackWatermark extends StatefulWidget {
  const PlaybackWatermark({
    required this.tag,
    this.enabled = true,
    super.key,
  });

  /// The pseudonymous label to draw. Build it with [watermarkTag]; passing a raw
  /// identifier here would violate the no-PII rule.
  final String tag;

  /// Watermarking is scoped to high-value content (`:1138`). Free content renders
  /// nothing rather than burdening every screen.
  final bool enabled;

  @override
  State<PlaybackWatermark> createState() => _PlaybackWatermarkState();
}

/// Positions the watermark cycles through.
///
/// The bottom-centre band is deliberately absent: that is where
/// `playback_page.dart` renders captions and where the scrubber sits, and
/// `تشفير المحتوي.md:1140` forbids covering subtitles or teaching text. The top
/// centre is also avoided so the title bar stays readable.
const _positions = <Alignment>[
  Alignment(-0.82, -0.62),
  Alignment(0.82, -0.62),
  Alignment(0.86, 0.10),
  Alignment(-0.86, 0.10),
  Alignment(-0.78, 0.52),
  Alignment(0.78, 0.52),
];

/// How long the mark stays in one place. Long enough not to distract, short
/// enough that cropping a single corner does not remove it from a whole session.
const _dwell = Duration(seconds: 25);

class _PlaybackWatermarkState extends State<PlaybackWatermark> {
  Timer? _timer;
  int _index = 0;

  @override
  void initState() {
    super.initState();
    if (widget.enabled) _start();
  }

  @override
  void didUpdateWidget(PlaybackWatermark oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.enabled && _timer == null) {
      _start();
    } else if (!widget.enabled) {
      _timer?.cancel();
      _timer = null;
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _start() {
    _timer = Timer.periodic(_dwell, (_) {
      if (!mounted) return;
      setState(() => _index = (_index + 1) % _positions.length);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled || widget.tag.isEmpty) return const SizedBox.shrink();

    // Under reduce-motion the mark stays put instead of sliding. It is still
    // rendered: suppressing it entirely would let an accessibility setting
    // disable a forensic control.
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    return IgnorePointer(
      child: ExcludeSemantics(
        child: AnimatedAlign(
          alignment: _positions[_index],
          duration: reduceMotion ? Duration.zero : const Duration(seconds: 3),
          curve: Curves.easeInOut,
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Text(
              widget.tag,
              textDirection: TextDirection.ltr,
              style: TextStyle(
                // Low contrast on purpose: legible in a re-encode, close to
                // invisible while watching.
                color: Colors.white.withValues(alpha: 0.18),
                fontSize: 11,
                fontWeight: FontWeight.w600,
                letterSpacing: 1.4,
                shadows: [
                  Shadow(
                    color: Colors.black.withValues(alpha: 0.28),
                    blurRadius: 2,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Builds the pseudonymous watermark label.
///
/// Returns something like `MJ 4F2A91 · 08-14`, where the hex segment is a
/// truncated SHA-256 of the account and session plus the current hour, and the
/// suffix is that hour in UTC.
///
/// Properties this is chosen to have:
///
///   * **No PII.** The inputs are opaque server identifiers and they are hashed,
///     so the drawn text reveals nothing about the family or the child even if a
///     screenshot circulates. `تشفير المحتوي.md:1139`.
///   * **Auditable.** Given a leaked frame, the backend can recompute the digest
///     for each account over the stated hour and find the match. `:1138`.
///   * **Coarse in time.** An hour bucket, not a timestamp, so the mark cannot be
///     used to reconstruct a child's viewing schedule from a single frame.
///
/// Returns an empty string when there is no identifier to bind to, which the
/// widget treats as "draw nothing" rather than inventing a placeholder tag.
String watermarkTag({
  required String? parentId,
  String? sessionId,
  DateTime? now,
}) {
  final account = (parentId ?? '').trim();
  if (account.isEmpty) return '';

  final moment = (now ?? DateTime.now()).toUtc();
  // Hour granularity: identifies the session window without timing the viewer.
  final bucket = '${moment.year}-${moment.month}-${moment.day}-${moment.hour}';
  final digest = sha256.convert(
    utf8.encode('majarra-wm|$account|${sessionId ?? ''}|$bucket'),
  );
  final short = digest.toString().substring(0, 6).toUpperCase();

  final day = moment.day.toString().padLeft(2, '0');
  final hour = moment.hour.toString().padLeft(2, '0');
  return 'MJ $short · $day-$hour';
}
