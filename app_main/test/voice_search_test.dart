import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/speech/voice_search.dart';

/// Deterministic recognizer double.
class _FakeRecognizer implements SpeechRecognizer {
  _FakeRecognizer({this.available = true, this.emit = const ['ح', 'حكايات']});

  final bool available;
  final List<String> emit;
  bool _available = false;
  bool stopped = false;

  @override
  bool get isAvailable => _available;

  @override
  Future<bool> initialize() async => _available = available;

  @override
  Future<void> listen({
    required void Function(String transcript, bool isFinal) onResult,
    required void Function() onDone,
    String localeId = 'ar',
    Duration listenFor = const Duration(seconds: 12),
    Duration pauseFor = const Duration(seconds: 3),
  }) async {
    for (var i = 0; i < emit.length; i++) {
      onResult(emit[i], i == emit.length - 1);
    }
    onDone();
  }

  @override
  Future<void> stop() async => stopped = true;
}

void main() {
  group('VoiceConsentGate (Requirement 9.6)', () {
    test('start() is blocked while voice consent is not granted', () async {
      VoiceConsentGate.setGranted(false);
      final controller = VoiceSearchController(_FakeRecognizer());
      final transcripts = <String>[];
      final ok = await controller.start(transcripts.add);
      expect(ok, isFalse);
      expect(controller.state.status, VoiceSearchStatus.unavailable);
      expect(transcripts, isEmpty);
    });

    test('revoking mid-session blocks the very next start(), not a restart', () async {
      VoiceConsentGate.setGranted(true);
      final controller = VoiceSearchController(_FakeRecognizer());
      final first = <String>[];
      expect(await controller.start(first.add), isTrue);

      // A parent revokes consent (mirrors ConsentPage's toggle updating the
      // same gate). No app restart or new session — just the next call.
      VoiceConsentGate.setGranted(false);

      final second = <String>[];
      final ok = await controller.start(second.add);
      expect(ok, isFalse);
      expect(second, isEmpty);
    });

    test('granted again allows start() to proceed as normal', () async {
      VoiceConsentGate.setGranted(true);
      final controller = VoiceSearchController(_FakeRecognizer(emit: ['ح']));
      final transcripts = <String>[];
      final ok = await controller.start(transcripts.add);
      expect(ok, isTrue);
      expect(transcripts, isNotEmpty);
    });
  });

  test('unavailable recognition returns false and sets unavailable', () async {
    VoiceConsentGate.setGranted(true);
    final controller = VoiceSearchController(_FakeRecognizer(available: false));
    final transcripts = <String>[];
    final ok = await controller.start(transcripts.add);
    expect(ok, isFalse);
    expect(controller.state.status, VoiceSearchStatus.unavailable);
    expect(transcripts, isEmpty);
  });

  test('emits transcripts and finishes idle', () async {
    VoiceConsentGate.setGranted(true);
    final controller = VoiceSearchController(_FakeRecognizer(emit: ['ح', 'حكايات']));
    final transcripts = <String>[];
    final ok = await controller.start(transcripts.add);
    expect(ok, isTrue);
    expect(transcripts.last, 'حكايات');
    // A final result moves the session back to idle (mic released).
    expect(controller.state.status, VoiceSearchStatus.idle);
  });

  test('stop releases the recognizer', () async {
    final recognizer = _FakeRecognizer(emit: const []);
    final controller = VoiceSearchController(recognizer);
    await controller.stop();
    expect(recognizer.stopped, isTrue);
    expect(controller.state.status, VoiceSearchStatus.idle);
  });
}
