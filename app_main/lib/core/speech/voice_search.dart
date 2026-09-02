import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// In-memory, session-only cache of the server's last-known decision for the
/// `voice` consent type (Requirement 9.6).
///
/// Deliberately not persisted anywhere (no `SharedPreferences`, no disk write):
/// a value written to disk could go stale relative to the server — revoked on
/// another device, or a write that succeeded on the server while the local
/// cache write was missed — and a stale "yes" is exactly what Requirement 9.6
/// forbids. This is instead a live mirror of the one answer the server has
/// already given, refreshed by whichever screen last read `/family/consents`
/// (today, `ConsentPage`), and it evaporates on app restart: a fresh session
/// starts with no assumed consent ([granted] defaults to `false`) until a real
/// read populates it again.
///
/// [VoiceSearchController.start] consults this immediately before engaging the
/// microphone, so a revoke recorded here blocks the very next start attempt —
/// not a mid-session one already listening, but the next *new* request, which
/// is what "من الطلب التالي" (from the next request) means for a request that
/// is itself the act of starting to listen.
abstract final class VoiceConsentGate {
  static bool _granted = false;

  /// Whether the last server read of the `voice` consent said granted. Safe
  /// default is `false` — assuming consent before it has ever been confirmed
  /// would be the worst possible default for a children's app.
  static bool get granted => _granted;

  static void setGranted(bool granted) {
    _granted = granted;
  }
}

/// Recognition lifecycle for the voice-search control.
enum VoiceSearchStatus { idle, initializing, listening, unavailable, error }

@immutable
class VoiceSearchState {
  const VoiceSearchState({
    this.status = VoiceSearchStatus.idle,
    this.transcript = '',
  });

  final VoiceSearchStatus status;
  final String transcript;

  bool get isListening => status == VoiceSearchStatus.listening;

  VoiceSearchState copyWith({VoiceSearchStatus? status, String? transcript}) =>
      VoiceSearchState(
        status: status ?? this.status,
        transcript: transcript ?? this.transcript,
      );
}

/// Abstraction over device speech recognition, so the controller can be tested
/// without the platform plugin.
///
/// ## Privacy stance for a children's app (§9)
///
/// This uses the platform's own speech recognition through `speech_to_text`.
/// Recognition prefers on-device where the OS provides it, and the app keeps
/// only the resulting transcript to run a text search — it never stores or
/// uploads raw microphone audio, and listening is always time-bounded so the
/// microphone can never be left open.
abstract interface class SpeechRecognizer {
  Future<bool> initialize();
  Future<void> listen({
    required void Function(String transcript, bool isFinal) onResult,
    required void Function() onDone,
    String localeId,
    Duration listenFor,
    Duration pauseFor,
  });
  Future<void> stop();
  bool get isAvailable;
}

/// Real implementation backed by the `speech_to_text` plugin.
class PlatformSpeechRecognizer implements SpeechRecognizer {
  final SpeechToText _speech = SpeechToText();
  bool _available = false;

  @override
  bool get isAvailable => _available;

  @override
  Future<bool> initialize() async {
    try {
      _available = await _speech.initialize(
        // Errors and status are handled by the controller through the listen
        // callbacks; these are required no-op sinks.
        onError: (_) {},
        onStatus: (_) {},
      );
    } catch (_) {
      _available = false;
    }
    return _available;
  }

  @override
  Future<void> listen({
    required void Function(String transcript, bool isFinal) onResult,
    required void Function() onDone,
    String localeId = 'ar',
    Duration listenFor = const Duration(seconds: 12),
    Duration pauseFor = const Duration(seconds: 3),
  }) async {
    await _speech.listen(
      onResult: (result) {
        onResult(result.recognizedWords, result.finalResult);
        if (result.finalResult) onDone();
      },
      listenOptions: SpeechListenOptions(
        localeId: localeId,
        listenFor: listenFor,
        pauseFor: pauseFor,
        cancelOnError: true,
        partialResults: true,
      ),
    );
  }

  @override
  Future<void> stop() => _speech.stop();
}

final speechRecognizerProvider =
    Provider<SpeechRecognizer>((ref) => PlatformSpeechRecognizer());

/// Owns the voice-search session: initialise, start (time-bounded), stop, and
/// surface the transcript. Never leaves the microphone open — the recognizer is
/// asked to stop after a fixed window and on the first final result.
class VoiceSearchController extends StateNotifier<VoiceSearchState> {
  VoiceSearchController(this._recognizer) : super(const VoiceSearchState());

  final SpeechRecognizer _recognizer;

  /// Starts a listening session, forwarding transcripts to [onTranscript].
  ///
  /// Returns false when recognition is unavailable (no permission, no engine),
  /// so the caller can fall back to the keyboard.
  Future<bool> start(void Function(String transcript) onTranscript) async {
    if (state.isListening) {
      await stop();
      return true;
    }
    // Requirement 9.6: a withdrawn `voice` consent blocks the next attempt to
    // engage the microphone immediately, reading the live gate rather than a
    // value cached at some earlier point in this controller's lifetime.
    if (!VoiceConsentGate.granted) {
      state = state.copyWith(status: VoiceSearchStatus.unavailable);
      return false;
    }
    state = state.copyWith(status: VoiceSearchStatus.initializing);
    final ok = await _recognizer.initialize();
    if (!ok) {
      state = state.copyWith(status: VoiceSearchStatus.unavailable);
      return false;
    }
    state = const VoiceSearchState(status: VoiceSearchStatus.listening, transcript: '');
    try {
      await _recognizer.listen(
        onResult: (transcript, isFinal) {
          state = state.copyWith(transcript: transcript);
          onTranscript(transcript);
        },
        onDone: () {
          if (mounted) state = state.copyWith(status: VoiceSearchStatus.idle);
        },
      );
    } catch (_) {
      state = state.copyWith(status: VoiceSearchStatus.error);
      return false;
    }
    return true;
  }

  Future<void> stop() async {
    await _recognizer.stop();
    if (mounted) state = state.copyWith(status: VoiceSearchStatus.idle);
  }

  @override
  void dispose() {
    // Ensure the mic is released if the page is left mid-session.
    _recognizer.stop();
    super.dispose();
  }
}

final voiceSearchControllerProvider =
    StateNotifierProvider<VoiceSearchController, VoiceSearchState>(
  (ref) => VoiceSearchController(ref.watch(speechRecognizerProvider)),
);
