import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../home/application/home_providers.dart';
import '../../home/data/majarra_api_client.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// The legal documents the owner publishes from the admin (migration 0105).
final legalDocumentSlugs = <String, String>{
  'privacy': AppLocalizationsAr().profilelegaldocumentsText01,
  'children-privacy': AppLocalizationsAr().profilelegaldocumentsText02,
  'terms': AppLocalizationsAr().profilelegaldocumentsText03,
  'delete-account': AppLocalizationsAr().profilelegaldocumentsText04,
};

class LegalDocument {
  const LegalDocument({
    required this.slug,
    required this.title,
    required this.body,
    required this.version,
    required this.publishedAt,
  });

  final String slug;
  final String title;
  final String body;
  final int version;
  final String publishedAt;
}

/// Null while the document is not published yet.
final legalDocumentProvider = FutureProvider.family<LegalDocument?, String>((
  ref,
  slug,
) async {
  if (!legalDocumentSlugs.containsKey(slug)) return null;
  try {
    final envelope = await ref
        .watch(majarraApiClientProvider)
        .getLegalDocument(slug);
    final data = envelope['data'];
    if (data is! Map) return null;
    return LegalDocument(
      slug: slug,
      title: data['title'] is String ? data['title'] as String : '',
      body: data['body'] is String ? data['body'] as String : '',
      version: data['version'] is num ? (data['version'] as num).toInt() : 0,
      publishedAt: data['published_at'] is String
          ? data['published_at'] as String
          : '',
    );
  } on MajarraApiException catch (error) {
    if (error.statusCode == 404) return null;
    rethrow;
  }
});

/// One block of the small Markdown subset the admin writes in.
sealed class LegalBlock {
  const LegalBlock();
}

class LegalHeading extends LegalBlock {
  const LegalHeading(this.text);
  final String text;
}

class LegalParagraph extends LegalBlock {
  const LegalParagraph(this.text);
  final String text;
}

class LegalList extends LegalBlock {
  const LegalList(this.items, {required this.ordered});
  final List<String> items;
  final bool ordered;
}

/// `## heading`, `- bullet`, `1. step`, blank-line paragraphs, the same rules
/// the website uses (`LegalPage.tsx`).
List<LegalBlock> parseLegalBody(String body) {
  final blocks = <LegalBlock>[];
  final paragraph = <String>[];
  List<String>? items;
  var ordered = false;

  void flushParagraph() {
    if (paragraph.isNotEmpty) blocks.add(LegalParagraph(paragraph.join(' ')));
    paragraph.clear();
  }

  void flushList() {
    if (items != null) blocks.add(LegalList(items!, ordered: ordered));
    items = null;
  }

  final bullet = RegExp(r'^[-*]\s+(.*)$');
  final step = RegExp(r'^\d+[.)]\s+(.*)$');
  for (final raw in body.split('\n')) {
    final line = raw.trim();
    if (line.isEmpty) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.add(LegalHeading(line.substring(3)));
      continue;
    }
    final b = bullet.firstMatch(line);
    final s = step.firstMatch(line);
    if (b != null || s != null) {
      flushParagraph();
      final isOrdered = s != null;
      if (items != null && ordered != isOrdered) flushList();
      if (items == null) {
        items = <String>[];
        ordered = isOrdered;
      }
      items!.add((b ?? s)!.group(1)!);
      continue;
    }
    flushList();
    paragraph.add(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}
