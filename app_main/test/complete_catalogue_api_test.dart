import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:majarra/features/games/application/creative_catalogue_provider.dart';

void main() {
  test('maps complete drawing API records to their three R2 URLs', () async {
    final client = MockClient((request) async {
      expect(request.url.path, '/api/v1/creative-studio/drawings');
      expect(request.url.queryParameters['category'], 'complete');
      return http.Response.bytes(
        utf8.encode(jsonEncode({
          'success': true,
          'data': [
            {
              'id': 'complete-cat-01',
              'title_ar': 'Cat',
              'difficulty': 'easy',
              'urls': {
                'main': 'https://cdn.example.test/challenge.png',
                'thumb': 'https://cdn.example.test/thumbnail.jpg',
              },
              'reference_full_url':
                  'https://cdn.example.test/reference_full.png',
              'extra': {'group': 'animals'},
            },
          ],
        })),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final items = await fetchCompleteFromApi(
      'https://api.example.test',
      client: client,
    );

    expect(items, hasLength(1));
    expect(items.single.assetId, 'https://cdn.example.test/challenge.png');
    expect(items.single.thumbnailAssetId, 'https://cdn.example.test/thumbnail.jpg');
    expect(
      items.single.referenceFullAssetId,
      'https://cdn.example.test/reference_full.png',
    );
    expect(items.single.group, 'animals');
  });

  test('drops incomplete complete drawing API records', () async {
    final client = MockClient((_) async => http.Response(
          jsonEncode({
            'data': [
              {
                'id': 'incomplete',
                'title_ar': 'Incomplete',
                'urls': {'main': 'https://cdn.example.test/challenge.png'},
              },
            ],
          }),
          200,
        ));

    expect(
      await fetchCompleteFromApi('https://api.example.test', client: client),
      isEmpty,
    );
  });

  test('maps ordered normalized Connect Dots geometry from the API', () async {
    final client = MockClient((request) async {
      expect(request.url.queryParameters['category'], 'connect_dots');
      return http.Response(jsonEncode({
        'data': [
          {
            'id': 'connect-dots-star',
            'title_ar': 'Star',
            'difficulty': 'easy',
            'urls': {'main': 'https://cdn.example.test/star.png'},
            'geometry': {
              'dots': [
                {'id': 'd1', 'order': 1, 'at': [0.5, 0.2]},
                {'id': 'd2', 'order': 2, 'at': [0.8, 0.7]},
              ],
            },
          },
        ],
      }), 200);
    });

    final items = await fetchDotsFromApi('https://api.example.test', client: client);

    expect(items, hasLength(1));
    expect(items.single.assetId, 'https://cdn.example.test/star.png');
    expect(items.single.dots.map((dot) => dot['order']), [1, 2]);
  });

  test('drops remote Connect Dots records with invalid point ordering', () async {
    final client = MockClient((_) async => http.Response(jsonEncode({
      'data': [
        {
          'id': 'bad-dots',
          'title_ar': 'Bad',
          'urls': {'main': 'https://cdn.example.test/bad.png'},
          'geometry': {
            'dots': [
              {'id': 'd1', 'order': 2, 'at': [0.5, 0.2]},
              {'id': 'd2', 'order': 1, 'at': [0.8, 0.7]},
            ],
          },
        },
      ],
    }), 200));

    expect(
      await fetchDotsFromApi('https://api.example.test', client: client),
      isEmpty,
    );
  });

  test('maps remote trace geometry and derives the letter runtime mode', () async {
    final client = MockClient((request) async {
      expect(request.url.queryParameters['category'], 'letters');
      return http.Response.bytes(
        utf8.encode(jsonEncode({
          'data': [
            {
              'id': 'letter-alif',
              'category': 'letters',
              'title_ar': 'ا',
              'urls': {'main': 'https://cdn.example.test/alif.svg'},
              'geometry': {
                'strokePaths': [
                  {
                    'id': 's1',
                    'order': 1,
                    'type': 'stroke',
                    'points': [[0.5, 0.2], [0.5, 0.8]],
                  },
                ],
              },
            },
          ],
        })),
        200,
        headers: {'content-type': 'application/json'},
      );
    });

    final items = await fetchTraceCategoryFromApi(
      'https://api.example.test',
      'letters',
      client: client,
    );

    expect(items, hasLength(1));
    expect(items.single.assetId, 'https://cdn.example.test/alif.svg');
    expect(items.single.mode, 'letter');
    expect(items.single.strokePaths.single['type'], 'stroke');
  });

  test('drops remote trace records with invalid stroke geometry', () async {
    final client = MockClient((_) async => http.Response(jsonEncode({
      'data': [
        {
          'id': 'bad-trace',
          'category': 'trace',
          'title_ar': 'Bad',
          'urls': {'main': 'https://cdn.example.test/bad.svg'},
          'geometry': {
            'strokePaths': [
              {
                'id': 's1',
                'order': 1,
                'type': 'stroke',
                'points': [[1.1, 0.2], [0.5, 0.8]],
              },
            ],
          },
        },
      ],
    }), 200));

    expect(
      await fetchTraceCategoryFromApi(
        'https://api.example.test',
        'trace',
        client: client,
      ),
      isEmpty,
    );
  });
}
