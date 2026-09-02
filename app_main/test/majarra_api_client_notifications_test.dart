import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';

void main() {
  test('markNotificationRead POSTs to the notification read endpoint', () async {
    Uri? capturedUri;
    String? capturedMethod;

    final client = MockClient((request) async {
      capturedUri = request.url;
      capturedMethod = request.method;
      return http.Response(
        jsonEncode({'success': true}),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final api = MajarraApiClient(
      client,
      getAccessToken: () async => 'test-access-token',
    );

    final result = await api.markNotificationRead('notif-1');

    expect(capturedMethod, 'POST');
    expect(capturedUri?.path, '/api/v1/notifications/notif-1/read');
    expect(result['success'], isTrue);
  });

  test('markNotificationRead percent-encodes the notification id', () async {
    Uri? capturedUri;

    final client = MockClient((request) async {
      capturedUri = request.url;
      return http.Response(
        jsonEncode({'success': true}),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final api = MajarraApiClient(
      client,
      getAccessToken: () async => 'test-access-token',
    );

    await api.markNotificationRead('notif/with space');

    expect(capturedUri?.path, '/api/v1/notifications/notif%2Fwith%20space/read');
  });
}
