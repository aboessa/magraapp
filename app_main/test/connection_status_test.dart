import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/net/connection_status.dart';
import 'package:majarra/features/home/data/majarra_api_client.dart';
import 'package:majarra/features/home/domain/content_models.dart';

void main() {
  group('connectionStatusFromSource', () {
    test('remote is online', () {
      expect(
        connectionStatusFromSource(ContentSource.remote),
        ConnectionStatus.online,
      );
    });

    test('mixed is treated as online (live data present)', () {
      expect(
        connectionStatusFromSource(ContentSource.mixed),
        ConnectionStatus.online,
      );
    });

    test('local means offline-with-cache', () {
      expect(
        connectionStatusFromSource(ContentSource.local),
        ConnectionStatus.offlineWithCache,
      );
    });
  });

  group('connectionStatusFromError', () {
    test('network failure is not a server error', () {
      final status = connectionStatusFromError(
        const MajarraApiException('Network request failed'),
      );
      expect(status, ConnectionStatus.offlineWithCache);
    });

    test('401 is an auth error, not offline', () {
      final status = connectionStatusFromError(
        const MajarraApiException('HTTP 401: Unauthorized'),
      );
      expect(status, ConnectionStatus.authError);
    });

    test('500 is a server error, not offline', () {
      final status = connectionStatusFromError(
        const MajarraApiException('HTTP 500: Internal server error'),
      );
      expect(status, ConnectionStatus.serverError);
    });

    test('timeout is offline-with-cache', () {
      final status = connectionStatusFromError(
        const MajarraApiException('Request timed out'),
      );
      expect(status, ConnectionStatus.offlineWithCache);
    });
  });

  group('ConnectionStatusX', () {
    test('cache and download states are usable and offline', () {
      expect(ConnectionStatus.offlineWithCache.isUsable, isTrue);
      expect(ConnectionStatus.offlineWithCache.isOffline, isTrue);
      expect(ConnectionStatus.offlineWithDownload.isUsable, isTrue);
    });

    test('auth and server errors are not usable', () {
      expect(ConnectionStatus.authError.isUsable, isFalse);
      expect(ConnectionStatus.serverError.isUsable, isFalse);
    });
  });
}
