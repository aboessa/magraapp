/// Resolves a public Majarra story CDN URL to the exact reviewed asset bundled
/// with the app. Unknown hosts, story packs, and paths never substitute artwork.
String? bundledStoryAssetForUrl(String? value) {
  if (value == null || value.isEmpty) return null;
  final uri = Uri.tryParse(value);
  if (uri == null || uri.scheme != 'https' || uri.host != 'cdn.majarra.app') {
    return null;
  }

  const publicPrefix = '/public/catalog/';
  if (!uri.path.startsWith(publicPrefix)) return null;
  final relative = uri.path.substring(publicPrefix.length);
  final segments = relative.split('/');
  if (segments.length != 5 ||
      segments[0] != 'assets' ||
      segments[1] != 'images' ||
      segments[2] != 'stories' ||
      segments.any((segment) => segment.isEmpty || segment == '..')) {
    return null;
  }

  const bundledPacks = {'act-s1-playveo', 'act-s2-playveo'};
  if (!bundledPacks.contains(segments[3])) return null;

  final file = segments[4].toLowerCase();
  final match = RegExp(
    r'^(.+)\.[0-9a-f]{16}(\.(?:jpg|jpeg|png|webp))$',
  ).firstMatch(file);
  final bundledFile = match == null
      ? file
      : '${match.group(1)}${match.group(2)}';
  if (!(bundledFile.endsWith('.jpg') ||
      bundledFile.endsWith('.jpeg') ||
      bundledFile.endsWith('.png') ||
      bundledFile.endsWith('.webp'))) {
    return null;
  }
  segments[4] = bundledFile;
  return segments.join('/');
}
