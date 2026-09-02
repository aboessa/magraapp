/// One colouring page: a picture, and the colours offered for it.
///
/// Deliberately almost empty. A colouring page is a picture a child paints on
/// top of, so the only things the app needs to know are where the picture is and
/// what to call it. There is no geometry, no region list, no compiled sidecar —
/// adding a page means dropping an image in `assets/images/coloring/` and adding
/// three lines to `assets/data/coloring_pages.json`.
///
/// Any raster format the Flutter image decoder handles works (PNG, JPG, JPEG,
/// WebP, GIF, BMP). No format is privileged, because nothing reads the pixels as
/// data — they are only ever drawn.
library;

/// Colours offered when a page does not name its own.
///
/// Twelve rather than three or four: a child colouring a bird needs a warm set, a
/// cool set, a brown and a skin-adjacent tone, or they run out of choices and the
/// drawing ends up two colours. Ordered so the primaries a small child reaches
/// for first come first, because index 0 is preselected.
const List<String> kDefaultColoringPalette = [
  '#E23D28', // red
  '#F5A31A', // orange
  '#FFD34D', // yellow
  '#3FA845', // green
  '#1E88E5', // blue
  '#6A3DF2', // violet
  '#FF6FAE', // pink
  '#8B5A2B', // brown
  '#F2C9A0', // light tan
  '#7A8B99', // slate
  '#2B2B2B', // near-black
  '#FFFFFF', // white
];

class ColoringPage {
  const ColoringPage({
    required this.id,
    required this.label,
    required this.image,
    this.palette = kDefaultColoringPalette,
  });

  factory ColoringPage.fromJson(Map<String, dynamic> json) {
    final palette = (json['palette'] as List<dynamic>? ?? const [])
        .whereType<String>()
        .toList(growable: false);
    return ColoringPage(
      id: json['id'] as String,
      label: json['label'] as String,
      image: json['image'] as String,
      palette: palette.isEmpty ? kDefaultColoringPalette : palette,
    );
  }

  final String id;
  final String label;

  /// Asset path of the picture. Any raster format Flutter can decode.
  final String image;

  final List<String> palette;

  bool get isValid =>
      id.isNotEmpty && label.isNotEmpty && image.isNotEmpty && palette.isNotEmpty;

  Map<String, dynamic> toJson() => {
    'id': id,
    'label': label,
    'image': image,
    'palette': palette,
  };
}
