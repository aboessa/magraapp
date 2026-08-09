import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/features/home/data/content_dtos.dart';

void main() {
  test('mojibake decoder preserves correct Arabic', () {
    const correct = 'أبجد';
    expect(PlanetDto.fromJson({'id': 'abjad', 'name_ar': correct}).name, 'أبجد');
  });

  test('PlanetDto displayNames override remote name', () {
    final dto = PlanetDto.fromJson({'id': 'islamic', 'name_ar': 'Remote Name'});
    expect(dto.name, 'الإيمان'); // not Remote Name
    final alias = PlanetDto.fromJson({'id': 'iman', 'name_ar': 'Remote'});
    expect(alias.name, 'الإيمان'); // alias
  });

  test('boolean tolerates 0/1 and true/false', () {
    expect(SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': 1}).isFree, isTrue);
    expect(SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': 0}).isFree, isFalse);
    expect(SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': true}).isFree, isTrue);
    expect(SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'is_free': false}).isFree, isFalse);
  });

  test('age clamping 3-12', () {
    final dto = SeriesDto.fromJson({'id': 's', 'title_ar': 't', 'age_min': 1, 'age_max': 20});
    expect(dto.ageMin, 3);
    expect(dto.ageMax, 12);
  });
}
