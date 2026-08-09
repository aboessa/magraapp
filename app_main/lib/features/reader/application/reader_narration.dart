import '../../home/data/majarra_api_client.dart';

/// The outcome of resolving a page's narration into something playable.
///
/// A sealed result rather than throwing so the reader can distinguish "no
/// narration for this page" (a truthful, common state while content is being
/// recorded) from "choose a profile first" (a fixable precondition) and render
/// the right message for each, without pattern-matching exception strings.
sealed class NarrationSource {
  const NarrationSource();
}

class NarrationPlayable extends NarrationSource {
  const NarrationPlayable({required this.streamUrl, required this.authorization});

  /// Worker-relative stream path; resolved against the API base before use. The
  /// media worker never returns an R2 URL (`تشفير المحتوي.md:1192`).
  final String streamUrl;

  /// Short-lived capability token sent as an `Authorization` header, never in
  /// the query string.
  final String authorization;
}

class NarrationUnavailable extends NarrationSource {
  const NarrationUnavailable(this.reason);

  /// Arabic, safe-for-display reason.
  final String reason;
}

/// Parses a `POST /books/:id/audio-sessions` envelope into a [NarrationSource].
///
/// Pure and synchronous so it can be unit tested against captured payloads with
/// no network. A missing `data` object, or a data object without both a
/// `stream_url` and an `authorization`, is a page with no published narration —
/// the 404 the server returns for that case is mapped to the same unavailable
/// state upstream.
NarrationSource resolveNarrationSource(Map<String, dynamic> envelope) {
  final data = envelope['data'];
  if (data is! Map) {
    return const NarrationUnavailable('لم يُسجَّل صوت لهذه الصفحة بعد.');
  }
  final payload = data.cast<String, Object?>();
  final streamUrl = payload['stream_url'];
  final authorization = payload['authorization'];
  if (streamUrl is! String ||
      streamUrl.isEmpty ||
      authorization is! String ||
      authorization.isEmpty) {
    return const NarrationUnavailable('لم يُسجَّل صوت لهذه الصفحة بعد.');
  }
  return NarrationPlayable(streamUrl: streamUrl, authorization: authorization);
}

/// Requests narration for one page, translating transport errors into a
/// [NarrationUnavailable] so the caller never has to catch here.
///
/// A 404 ("Protected narration is unavailable") is the normal "no narration for
/// this page" outcome and is not surfaced as an error.
Future<NarrationSource> fetchPageNarration(
  MajarraApiClient api, {
  required String bookId,
  required String childId,
  required String pageId,
}) async {
  try {
    final session = await api.createAudioSession(
      bookId: bookId,
      childId: childId,
      pageId: pageId,
    );
    return resolveNarrationSource(session);
  } on MajarraApiException catch (e) {
    final raw = e.message;
    if (raw.contains('404') || raw.contains('unavailable')) {
      return const NarrationUnavailable('لم يُسجَّل صوت لهذه الصفحة بعد.');
    }
    if (raw.contains('401') || raw.contains('403')) {
      return const NarrationUnavailable(
        'تعذّر تشغيل الصوت. تحقّق من تسجيل الدخول والاشتراك.',
      );
    }
    return const NarrationUnavailable('تعذّر تجهيز الصوت. حاول مرة أخرى.');
  }
}
