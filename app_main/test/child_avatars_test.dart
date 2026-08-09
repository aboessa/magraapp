import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/child/presentation/widgets/child_avatars.dart';

void main() {
  group('ChildAvatars.byId', () {
    test('resolves every known id to itself', () {
      for (final avatar in ChildAvatars.all) {
        expect(ChildAvatars.byId(avatar.id).id, avatar.id);
      }
    });

    test('falls back for null / empty / unknown ids', () {
      expect(ChildAvatars.byId(null).id, ChildAvatars.all.first.id);
      expect(ChildAvatars.byId('').id, ChildAvatars.all.first.id);
      expect(ChildAvatars.byId('does-not-exist').id, ChildAvatars.all.first.id);
    });

    test('preserves the legacy avatar ids the create form used', () {
      // Profiles created before the picker stored these keys; they must still
      // resolve so those children do not appear to lose their avatar.
      for (final legacy in ['orbit', 'comet', 'nova', 'luna']) {
        expect(ChildAvatars.byId(legacy).id, legacy);
      }
    });

    test('ids are unique', () {
      final ids = ChildAvatars.all.map((a) => a.id).toList();
      expect(ids.toSet().length, ids.length);
    });
  });
}
