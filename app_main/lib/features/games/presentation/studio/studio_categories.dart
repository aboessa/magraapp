/// The canonical list of Creative Studio activities.
///
/// ## Why this list exists
///
/// The studio home used to be a single scroll of eleven grids, one per activity
/// type, each rendering its whole catalogue. A child arriving at the screen saw
/// roughly 130 tiles and no structure, and the eleven section headers were
/// declared inline in `creative_studio_page.dart` with their own copy. This file
/// makes the activity list data: the home shows one card per activity, and each
/// card opens a page that shows that activity's items.
///
/// ## `isPrimary`
///
/// The home grid shows the primary activities only; the rest are one tap away
/// behind "عرض الكل". The split is editorial, not technical — the six primary
/// ones are the activities a 3–5 year old can start without being read to. Order
/// in [kStudioCategories] is the display order, so moving a card is a one-line
/// change here rather than a widget reshuffle.
///
/// ## `artAsset`
///
/// Illustrated covers produced by `tools/playveo/studio-artwork.manifest.json`
/// and converted by `tools/playveo/prepare-studio-assets.py`. Each is a 600x600
/// WebP composed so its lower fifth is empty, because [StudioCategoryCard] draws
/// a translucent label strip across that edge.
///
/// The field stays nullable and every consumer must still handle null by falling
/// back to [StudioCategory.icon] over [StudioCategory.gradient]. That is not
/// dead defensiveness: the gradient is a complete design on its own, so a cover
/// that fails to decode degrades to a plain card rather than a broken image, and
/// a newly added activity can ship before its artwork exists.
library;

import 'package:flutter/material.dart';

import 'studio_design.dart';

enum StudioCategoryId {
  coloring,
  freeDraw,
  drawLikeMe,
  complete,
  copyPattern,
  connectDots,
  trace,
  letters,
  numbers,
  promptDraw,
}

@immutable
class StudioCategory {
  const StudioCategory({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.gradient,
    required this.isPrimary,
    this.artAsset,
    this.opensCanvasDirectly = false,
  });

  final StudioCategoryId id;

  /// Short label under the card. Kept to two words so it never wraps or
  /// ellipsises at the 3-column tile width.
  final String title;

  /// One line shown on the category page and in the "عرض الكل" list. Not shown
  /// on the home tile, where there is no room for it.
  final String subtitle;

  final IconData icon;
  final LinearGradient gradient;
  final bool isPrimary;

  /// Illustrated cover, or null while the art pass is pending. See the library
  /// note above.
  final String? artAsset;

  /// True for activities that have no catalogue to browse and go straight to a
  /// canvas. Only ارسم بحرية today. The home card for these shows no item count.
  final bool opensCanvasDirectly;
}

/// Display order for the studio home and the all-activities page.
const List<StudioCategory> kStudioCategories = <StudioCategory>[
  StudioCategory(
    id: StudioCategoryId.coloring,
    artAsset: 'assets/images/studio/card-coloring.webp', // 16:9 full-bleed, no safe area crop - must be cover center
    title: 'لوّن',
    subtitle: 'اختر صورة ولوّنها بالفرشاة أو الدلو',
    icon: Icons.palette_rounded,
    gradient: StudioGradients.coloring,
    isPrimary: true,
  ),
  StudioCategory(
    id: StudioCategoryId.freeDraw,
    artAsset: 'assets/images/studio/card-free-draw.webp',
    title: 'ارسم بحرية',
    subtitle: 'لوحة بيضاء فارغة — ارسم ما تحب',
    icon: Icons.brush_rounded,
    gradient: StudioGradients.freeDraw,
    isPrimary: true,
    opensCanvasDirectly: true,
  ),
  StudioCategory(
    id: StudioCategoryId.drawLikeMe,
    artAsset: 'assets/images/studio/card-draw-like-me.webp',
    title: 'ارسم مثلي',
    subtitle: 'اتبع الخطوات وارسم مثل الصورة',
    icon: Icons.content_copy_rounded,
    gradient: StudioGradients.reference,
    isPrimary: true,
  ),
  StudioCategory(
    id: StudioCategoryId.complete,
    artAsset: 'assets/images/studio/card-complete.webp',
    title: 'أكمل الرسمة',
    subtitle: 'أكمل الجزء الناقص من الرسمة',
    icon: Icons.extension_rounded,
    gradient: StudioGradients.complete,
    isPrimary: true,
  ),
  StudioCategory(
    id: StudioCategoryId.copyPattern,
    artAsset: 'assets/images/studio/card-copy-pattern.webp',
    title: 'انسخ النمط',
    subtitle: 'انسخ التسلسل كما تراه',
    icon: Icons.grid_view_rounded,
    gradient: StudioGradients.copyPattern,
    isPrimary: true,
  ),
  StudioCategory(
    id: StudioCategoryId.connectDots,
    artAsset: 'assets/images/studio/card-connect-dots.webp',
    title: 'صل النقاط',
    subtitle: 'صل النقاط بالترتيب لتظهر الصورة',
    icon: Icons.timeline_rounded,
    gradient: StudioGradients.connectDots,
    isPrimary: true,
  ),
  StudioCategory(
    id: StudioCategoryId.trace,
    artAsset: 'assets/images/studio/card-trace.webp',
    title: 'تتبّع',
    subtitle: 'تتبّع الخطوط والأشكال',
    icon: Icons.gesture_rounded,
    gradient: StudioGradients.trace,
    isPrimary: false,
  ),
  StudioCategory(
    id: StudioCategoryId.letters,
    artAsset: 'assets/images/studio/card-letters.webp',
    title: 'الحروف',
    subtitle: 'تتبّع الحروف العربية',
    icon: Icons.abc_rounded,
    gradient: StudioGradients.letters,
    isPrimary: false,
  ),
  StudioCategory(
    id: StudioCategoryId.numbers,
    artAsset: 'assets/images/studio/card-numbers.webp',
    title: 'الأرقام',
    subtitle: 'تتبّع الأرقام ١–١٠',
    icon: Icons.pin_rounded,
    gradient: StudioGradients.numbers,
    isPrimary: false,
  ),
  StudioCategory(
    id: StudioCategoryId.promptDraw,
    artAsset: 'assets/images/studio/card-prompt-draw.webp',
    title: 'ارسم من الفكرة',
    subtitle: 'اختر فكرة وارسم ما تتخيله',
    icon: Icons.lightbulb_rounded,
    gradient: StudioGradients.promptDraw,
    isPrimary: false,
  ),
];

List<StudioCategory> get kPrimaryStudioCategories =>
    kStudioCategories.where((category) => category.isPrimary).toList();
