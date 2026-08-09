import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/reader/application/reader_narration.dart';

void main() {
  group('resolveNarrationSource', () {
    test('parses a valid session into a playable source', () {
      final source = resolveNarrationSource({
        'success': true,
        'data': {
          'stream_url': '/media/audio/stream/abc',
          'authorization': 'Bearer xyz',
          'capability_expires_in': 180,
        },
      });
      expect(source, isA<NarrationPlayable>());
      final playable = source as NarrationPlayable;
      expect(playable.streamUrl, '/media/audio/stream/abc');
      expect(playable.authorization, 'Bearer xyz');
    });

    test('missing data object means no narration for this page', () {
      expect(resolveNarrationSource({'success': true}), isA<NarrationUnavailable>());
    });

    test('missing stream_url or authorization means unavailable', () {
      expect(
        resolveNarrationSource({'data': {'stream_url': '/x'}}),
        isA<NarrationUnavailable>(),
      );
      expect(
        resolveNarrationSource({'data': {'authorization': 'Bearer x'}}),
        isA<NarrationUnavailable>(),
      );
    });

    test('empty strings are treated as unavailable, not playable', () {
      final source = resolveNarrationSource({
        'data': {'stream_url': '', 'authorization': ''},
      });
      expect(source, isA<NarrationUnavailable>());
    });
  });
}
