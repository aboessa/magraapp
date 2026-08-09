import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/failures/app_failure.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';

void main() {
  test('maps 401 to unauthorized with login hint', () {
    final f = AppFailure.fromException(const MajarraApiException('HTTP 401: Unauthorized'));
    expect(f.kind, FailureKind.unauthorized);
    expect(f.needsLogin, isTrue);
    expect(f.message, contains('الجلسة'));
  });

  test('never leaks raw body', () {
    final raw = const MajarraApiException('HTTP 500: {"sql":"SELECT * FROM parents"}');
    final f = AppFailure.fromException(raw);
    expect(f.message, isNot(contains('SELECT')));
    expect(f.message, isNot(contains('500')));
  });

  test('network and timeout have distinct Arabic messages', () {
    expect(AppFailure.fromException(const MajarraApiException('Network request failed')).message, contains('الاتصال'));
    expect(AppFailure.fromException(const MajarraApiException('Request timed out')).message, contains('مهلة'));
  });
}
