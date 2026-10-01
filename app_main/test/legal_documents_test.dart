import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/app/router/route_access.dart';
import 'package:majarra/features/profile/data/legal_documents.dart';

void main() {
  test('the legal body parses like the website renders it', () {
    final blocks = parseLegalBody(
      '## من نحن\nفقرة\nتكملة\n\n- نقطة\n- ثانية\n1. خطوة\n2. تانية\n\nآخر',
    );
    expect(blocks[0], isA<LegalHeading>());
    expect((blocks[1] as LegalParagraph).text, 'فقرة تكملة');
    expect((blocks[2] as LegalList).ordered, isFalse);
    expect((blocks[2] as LegalList).items, ['نقطة', 'ثانية']);
    expect((blocks[3] as LegalList).ordered, isTrue);
    expect((blocks[4] as LegalParagraph).text, 'آخر');
  });

  test('legal pages are reachable without an account', () {
    for (final slug in legalDocumentSlugs.keys) {
      expect(accessFor('/legal/$slug'), RouteAccess.public, reason: slug);
    }
    expect(accessFor('/terms'), RouteAccess.public);
  });
}
