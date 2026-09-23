/// يحرس `MediaProbeRepository`: وسائط سليمة تُقبَل، وجسد خطأ يُرفَض، وفشل
/// الشبكة يُسجَّل ولا يرمي (`APP-102`).
///
/// ## لماذا هذا الملف
///
/// كان الفحص `http.Client()` عاريًا داخل `playback_page.dart` — بلا تثبيت
/// شهادات وبلا اختبار وحدة (لا شيء يُختبَر بلا `pumpWidget`). والاستخراج إلى
/// `data/` بالعميل المحقون يجعل العقد قابلًا للفحص هنا بعميل مزيّف.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/features/playback/data/media_probe_repository.dart';

/// بايتات MP4 مصغّرة: `ftyp` في المقدّمة كما يفحص المستودع.
List<int> _mp4Bytes() => [
  ...'....ftypisom'.codeUnits,
  ...List<int>.filled(56, 0),
];

void main() {
  test('يقبل 206 بـ`video/mp4` و`ftyp`', () async {
    final client = MockClient((request) async {
      expect(request.headers['Range'], 'bytes=0-63');
      return http.Response.bytes(
        _mp4Bytes(),
        206,
        headers: {'content-type': 'video/mp4'},
      );
    });
    expect(
      await MediaProbeRepository(client).probe(Uri.parse('https://cdn/x.mp4')),
      isNull,
    );
  });

  test('يرفض جسد خطأ API (200 بلا `ftyp`) بتشخيص لا توكن فيه', () async {
    final client = MockClient(
      (_) async => http.Response(
        '{"error":"forbidden"}',
        200,
        headers: {'content-type': 'application/json'},
      ),
    );
    final rejection = await MediaProbeRepository(
      client,
    ).probe(Uri.parse('https://api/x?token=SECRET'));
    expect(rejection, isNotNull);
    expect(rejection, contains('status=200'));
    expect(rejection, isNot(contains('SECRET')));
  });

  test('فشل الشبكة يُعيد رفضًا ولا يرمي', () async {
    final client = MockClient((_) async => throw const SocketException());
    final repo = MediaProbeRepository(client);
    expect(
      await repo.probe(Uri.parse('https://cdn/x.mp4')),
      contains('probe failed'),
    );
  });
}

/// `dart:io` غير متاح على الويب — تعريف محلي خفيف بدل الاستيراد.
class SocketException implements Exception {
  const SocketException();
}
