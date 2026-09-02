import 'package:flutter_test/flutter_test.dart';
import 'package:majarra/core/env/app_environment.dart';

void main() {
  group('AppConfig.validateBaseUrl — production allowlist', () {
    const env = AppEnvironment.production;

    test('accepts the approved production https host', () {
      final decision = AppConfig.validateBaseUrl(
        'https://api.majarra.app',
        environment: env,
      );
      expect(decision.isValid, isTrue);
      expect(decision.url, 'https://api.majarra.app');
    });

    test('normalises a trailing path to the origin', () {
      final decision = AppConfig.validateBaseUrl(
        'https://api.majarra.app/api/v1',
        environment: env,
      );
      expect(decision.isValid, isTrue);
      expect(decision.url, 'https://api.majarra.app');
    });

    test('rejects plain http to the production host', () {
      final decision = AppConfig.validateBaseUrl(
        'http://api.majarra.app',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });

    test('rejects an arbitrary https host not on the allowlist', () {
      final decision = AppConfig.validateBaseUrl(
        'https://evil.example.com',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });

    test('rejects a majarra subdomain that is not the API host', () {
      // نطاق فرعي يبدو مألوفًا هو أخطر ما يُقبل بالخطأ: قائمة الإنتاج مضيف
      // واحد بالاسم، لا نمط على النطاق.
      final decision = AppConfig.validateBaseUrl(
        'https://staging-api.majarra.app',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });

    test('rejects loopback in production', () {
      final decision = AppConfig.validateBaseUrl(
        'http://localhost:8787',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });
  });

  group('AppConfig.validateBaseUrl — rejects hostile input', () {
    const env = AppEnvironment.development;

    test('rejects credential-bearing URL', () {
      final decision = AppConfig.validateBaseUrl(
        'https://user:pass@api.majarra.app',
        environment: env,
      );
      expect(decision.isValid, isFalse);
      expect(decision.reason, contains('credentials'));
    });

    test('rejects unexpected scheme', () {
      final decision = AppConfig.validateBaseUrl(
        'ftp://api.majarra.app',
        environment: env,
      );
      expect(decision.isValid, isFalse);
      expect(decision.reason, contains('scheme'));
    });

    test('rejects malformed URL', () {
      final decision = AppConfig.validateBaseUrl(
        'not a url',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });

    test('rejects empty URL', () {
      final decision = AppConfig.validateBaseUrl('   ', environment: env);
      expect(decision.isValid, isFalse);
    });
  });

  group('AppConfig.validateBaseUrl — development allowlist', () {
    const env = AppEnvironment.development;

    test('accepts loopback over http (locally-run worker)', () {
      final decision = AppConfig.validateBaseUrl(
        'http://localhost:8787',
        environment: env,
      );
      expect(decision.isValid, isTrue);
    });

    test('accepts the android emulator loopback', () {
      final decision = AppConfig.validateBaseUrl(
        'http://10.0.2.2:8787',
        environment: env,
      );
      expect(decision.isValid, isTrue);
    });

    test('rejects the former staging host', () {
      // كان هذا المضيف مقبولًا في بناء التطوير حين كان التعداد يحمل عضو
      // `staging`. لا توجد بيئة staging (قرار مالك: كل شيء على الإنتاج في مرحلة
      // التطوير)، فالمضيف صار مثل أي مضيف غير مُدرَج ويُرفض في كل البيئات.
      final decision = AppConfig.validateBaseUrl(
        'https://staging-api.majarra.app',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });

    test('still rejects arbitrary remote http', () {
      final decision = AppConfig.validateBaseUrl(
        'http://192.168.1.50:8787',
        environment: env,
      );
      expect(decision.isValid, isFalse);
    });
  });

  group('AppConfig defaults', () {
    test('production is the default environment', () {
      // With no --dart-define, MAJARRA_ENV defaults to production.
      expect(AppConfig.environment, AppEnvironment.production);
      expect(AppConfig.isProduction, isTrue);
    });

    test('baseUrl is the production https origin by default', () {
      expect(AppConfig.baseUrl, 'https://api.majarra.app');
    });

    test('environment banner is hidden in production', () {
      expect(AppConfig.showEnvironmentBanner, isFalse);
    });
  });
}
