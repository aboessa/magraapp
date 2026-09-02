import '../../home/data/majarra_api_client.dart';
import '../../home/domain/content_models.dart';

/// The outcome of resolving a page's narration into something playable.
sealed class NarrationSource {
  const NarrationSource();
}

class NarrationPlayable extends NarrationSource {
  const NarrationPlayable({
    required this.streamUrl,
    required this.authorization,
  });

  /// Worker-relative stream path; resolved against the configured API origin.
  final String streamUrl;

  /// Short-lived capability token sent as an `Authorization` header, never in
  /// the query string.
  final String authorization;
}

class NarrationUnavailable extends NarrationSource {
  const NarrationUnavailable(this.reason);

  final String reason;
}

String narrationUnavailableReasonForApiError(MajarraApiException error) {
  if (error.code == 'demo_narration_requires_sign_in') {
    return 'السرد غير متاح في وضع التجربة. سجّل الدخول واختر ملف طفل لتشغيله.';
  }
  if (error.statusCode == 401) {
    return 'تعذّر تشغيل الصوت. سجّل الدخول مرة أخرى ثم حاول.';
  }
  if (error.statusCode == 403) {
    return 'يتطلب تشغيل هذا الصوت اشتراكًا نشطًا.';
  }
  if (error.statusCode == 451) {
    return 'هذا الصوت غير متاح في منطقتك حاليًا.';
  }
  return 'تعذّر تجهيز الصوت. حاول مرة أخرى.';
}

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

/// Requests protected narration for one localized page of either a canonical
/// story or a book. Public narration URLs bypass this helper in the reader.
Future<NarrationSource> fetchPageNarration(
  MajarraApiClient api, {
  required ReaderContentType contentType,
  required String contentId,
  required String childId,
  required String pageId,
  required String language,
  String? bubbleId,
}) async {
  try {
    final session = await api.createAudioSession(
      bookId: contentType == ReaderContentType.book ? contentId : null,
      storyId: contentType == ReaderContentType.story ? contentId : null,
      childId: childId,
      pageId: pageId,
      language: language,
      bubbleId: bubbleId,
    );
    return resolveNarrationSource(session);
  } on MajarraApiException catch (error) {
    if (error.statusCode == 404) {
      return const NarrationUnavailable('لم يُسجَّل صوت لهذه الصفحة بعد.');
    }
    return NarrationUnavailable(narrationUnavailableReasonForApiError(error));
  }
}
