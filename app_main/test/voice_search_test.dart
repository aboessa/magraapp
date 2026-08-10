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
  test('unavailable recognition returns false and sets unavailable', () async {
    final controller = VoiceSearchController(_FakeRecognizer(available: false));
    final transcripts = <String>[];
    final ok = await controller.start(transcripts.add);
    expect(ok, isFalse);
    expect(controller.state.status, VoiceSearchStatus.unavailable);
    expect(transcripts, isEmpty);
  });

  test('emits transcripts and finishes idle', () async {
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
