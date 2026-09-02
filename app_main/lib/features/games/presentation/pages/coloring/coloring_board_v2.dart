/// لوحة التلوين المطابقة للتصميم Screenshot 2 — "لوّن العصفور"
///
/// المواصفات المطلوبة من الصورة:
/// - AppBar: رجوع + أيقونة قلم + "لوّن العصفور" + مساعدة + ؟
/// - خلفية الصفحة #0C1030، القماش أبيض rounded-22
/// - Card فوق القماش: badge أعلى يسار يعرض عدد المناطق الملونة + pill وسط لشرح التفاعل
/// - صورة line-art سوداء على أبيض (PNG شفافة بعد remove-background)
/// - لوحة ألوان أفقية: دائرة لون + علامة اختيار للون المختار
/// - صف أزرار ملونة 5:
///   حفظ أخضر، تلميح أصفر، من جديد أزرق، إعادة سماوي، تراجع بنفسجي
/// - زر كبير بنفسجي "تم"
/// - شريط ثانوي أفقي "رسومات أخرى" + thumbnails + Edit + مشاركة
///
/// يعيد استخدام المحرك الحالي في engine/coloring_board.dart تماماً مع واجهة
/// جديدة فقط، مع دعم Remove-Background للأصول PNG الشفافة.
///
/// يستخدم PlayVeo المولّد:
/// - prompt خطوة تبييض/threshold لإنتاج خطوط سوداء مغلقة
/// - بعدها POST /v1/images/remove-background لإزالة الخلفية → PNG شفاف
library;

import 'dart:async';
import 'dart:io' as io;
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart' show RenderRepaintBoundary;
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../../../application/creative_providers.dart';
import 'coloring_home_v2.dart';
import '../../studio/studio_app_bar.dart';
import '../../widgets/drawing_asset.dart';
import '../studio_v2/success_and_save.dart' show TutorialGate;

const _kDeepSpace = Color(0xFF0C1030);
const _kCanvasRadius = 22.0;

/// بروتوكول الألوان من الصورة الأصلية — نفس الترتيب تقريباً.
const kBoardPaletteV2 = <_PaletteEntry>[
  _PaletteEntry('#2B5AD8', Color(0xFF2B5AD8)),
  _PaletteEntry('#FF7E3A', Color(0xFFFF7E3A)),
  _PaletteEntry('#FFD400', Color(0xFFFFD400)),
  _PaletteEntry('#2EAC5A', Color(0xFF2EAC5A)),
  _PaletteEntry('#6A3DF2', Color(0xFF6A3DF2)),
  _PaletteEntry('#FF3E78', Color(0xFFFF3E78)),
  _PaletteEntry('#111111', Color(0xFF111111)),
  _PaletteEntry('#FF8F2A', Color(0xFFFF8F2A)),
];

class _PaletteEntry {
  const _PaletteEntry(this.hex, this.color);
  final String hex;
  final Color color;
}

// ──────────────────────────────────────────────────────────────────────────────
//  Public Page
// ──────────────────────────────────────────────────────────────────────────────

/// `APP-102`: `ConsumerStatefulWidget` لا `StatefulWidget`، ليقرأ الصفحةُ خدمةَ
/// الأصول من مزوّدها بدل أن تنفّذ `http.get` عاريًا بلا تثبيت شهادات.
class ColoringBoardV2Page extends ConsumerStatefulWidget {
  const ColoringBoardV2Page({
    required this.spec,
    this.thumbSpecs = const [],
    this.onSelectOther,
    this.onSave,
    this.tutorialStorageKey,
    super.key,
  });

  /// الرسمة الحالية — يمكن أن تكون FeaturedColoringSpec أو ColoringCategory item.
  final FeaturedColoringSpec spec;

  /// "رسومات أخرى" — قائمة مصغرة لأسفل.
  final List<FeaturedColoringSpec> thumbSpecs;

  final void Function(FeaturedColoringSpec other)? onSelectOther;
  final void Function(Uint8List pngBytes)? onSave;

  /// SharedPreferences key for the per-profile first-use tutorial state.
  final String? tutorialStorageKey;

  @override
  ConsumerState<ColoringBoardV2Page> createState() => _ColoringBoardV2PageState();
}

class _ColoringBoardV2PageState extends ConsumerState<ColoringBoardV2Page> {
  // engine state — نسخة مصغرة مخصصة للـV2 لكن نفس فكرة replay
  ui.Image? _picture;
  Uint8List? _sourceRgba;
  int _w = 0;
  int _h = 0;
  Uint32List? _paint;
  ui.Image? _paintImage;

  final List<_RegionOp> _ops = [];
  final List<_RegionOp> _undone = [];

  String _selectedHex = kBoardPaletteV2.first.hex;
  bool _loading = true;
  int _generation = 0;
  bool _showHint = true;
  bool _isSvgFallback = false;
  String? _svgFallbackPath;

  // repaint key للحفظ
  final _canvasKey = GlobalKey();

  /// عدد التلوينات التي فعلها الطفل — لا عدد «المناطق».
  ///
  /// كان الشريط يعرض `'$_ops.length من 8 مناطق'`: البسط عددُ النقرات (نقرتان
  /// على الموضع نفسه تُحسبان اثنتين)، والمقام **8** رقمٌ حرفيّ لا علاقة له
  /// برسمةٍ بعينها. هذا التلوين مبنيّ على `_floodFill` على النقاط لا على قائمة
  /// مناطق مُعلَنة، فلا يوجد في وقت التشغيل ما يُقاس عليه مقام أصلًا
  /// (`ColorRegion` موجود في `coloring_regions.dart` ولا تستعمله هذه اللوحة).
  /// فصار الشريط يعرض ما يُعرف ويصمت عمّا لا يُعرف.
  int get _fillCount => _ops.length;

  String get _fillCountLabel => coloringFillCountLabel(_fillCount);

  @override
  void initState() {
    super.initState();
    _loadPicture(asset: widget.spec.assetPath);
  }

  @override
  void didUpdateWidget(covariant ColoringBoardV2Page old) {
    super.didUpdateWidget(old);
    if (old.spec.id != widget.spec.id) {
      _loadPicture(spec: widget.spec);
    }
  }

  @override
  void dispose() {
    _picture?.dispose();
    _paintImage?.dispose();
    super.dispose();
  }

  /// Shared decode helper: يحافظ على الحد 1024 + يصيغ rawRgba
  /// - يدعم transparent PNG بعد remove-background (alpha<10 -> أبيض)
  Future<(ui.Image, Uint8List)> _decodeImageBytes(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    ui.Image img;
    try { img = (await codec.getNextFrame()).image; } finally { codec.dispose(); }
    final longest = math.max(img.width, img.height);
    if (longest > 1024) {
      final scale = 1024 / longest;
      final sc = await ui.instantiateImageCodec(
        bytes,
        targetWidth: (img.width * scale).round(),
        targetHeight: (img.height * scale).round(),
      );
      try { final f = await sc.getNextFrame(); img.dispose(); img = f.image; } finally { sc.dispose(); }
    }
    final bd = await img.toByteData(format: ui.ImageByteFormat.rawRgba);
    if (bd == null) throw StateError('rawRgba null');
    final rgba = bd.buffer.asUint8List();
    // whiteIfTransparent: PNG الشفاف بعد remove-background: alpha<10 => white
    for (var i = 3; i < rgba.length; i += 4) {
      if (rgba[i] < 10) {
        rgba[i-3] = 0xFF; rgba[i-2] = 0xFF; rgba[i-1] = 0xFF; rgba[i] = 0xFF;
      }
    }
    return (img, rgba);
  }

  Future<void> _loadPicture({FeaturedColoringSpec? spec, String? asset}) async {
    final resolved = spec ?? widget.spec;
    setState(() {
      _loading = true;
      _isSvgFallback = false;
      _svgFallbackPath = null;
    });
    Uint8List? bytes;
    // 1. جرّب R2 remote URL أولاً (transparent PNG بعد remove-background)
    final remoteUrl = resolved.bestDisplayUrl;
    final isNetworkUrl = remoteUrl != null && (remoteUrl.startsWith('http://') || remoteUrl.startsWith('https://'));
    if (isNetworkUrl) {
      // `APP-102`: كان هنا `http.get` عارٍ بمهلة ٢٠ ثانية خاصّة به — أي مسار
      // شبكة ثانٍ بلا تثبيت شهادات (`SEC-105`) على نفس عنوان الـCDN الذي تقرأه
      // الخدمة أصلًا. والخدمة تملك `fetchImageBytes` مثبَّتةً وبمهلة، فكان
      // التطبيقان لعملٍ واحد وأحدهما انحرف إلى ما هو أقل أمنًا.
      bytes = await ref.read(creativeRemoteAssetsServiceProvider).fetchImageBytes(remoteUrl);
    }
    // 2. fallback asset offline placeholder - الآن مميز لكل رسمة
    if (bytes == null) {
      final useAsset = asset ?? resolved.fallbackAsset;
      // إذا كان SVG، لا نستخدم codec بل نعرضه عبر DrawingAsset
      if (useAsset.toLowerCase().endsWith('.svg')) {
        if (mounted) {
          setState(() {
            _isSvgFallback = true;
            _svgFallbackPath = useAsset;
            _loading = false;
          });
        }
        return;
      }
      try {
        final data = await rootBundle.load(useAsset);
        bytes = data.buffer.asUint8List();
      } catch (_) {
        try {
          final data = await rootBundle.load('assets/images/coloring/bird.png');
          bytes = data.buffer.asUint8List();
        } catch (_) {}
      }
    }
    if (bytes == null) { if (mounted) setState(() => _loading = false); return; }
    try {
      final (img, rgba) = await _decodeImageBytes(bytes);
      if (!mounted) { img.dispose(); return; }
      setState(() {
        _picture?.dispose();
        _picture = img;
        _sourceRgba = rgba;
        _w = img.width; _h = img.height;
        _paint = Uint32List(img.width * img.height);
        _ops.clear(); _undone.clear();
        _loading = false;
        _isSvgFallback = false;
      });
      await _commit();
    } catch (_) {
      // لو فشل decode، جرّب عرض SVG fallback
      if (mounted) {
        setState(() {
          _isSvgFallback = true;
          _svgFallbackPath = resolved.fallbackAsset;
          _loading = false;
        });
      }
    }
  }

  static int _packHex(String hex) {
    final v = int.tryParse(hex.replaceFirst('#', ''), radix: 16) ?? 0;
    final a = 0xFF;
    final r = (v >> 16) & 0xFF;
    final g = (v >> 8) & 0xFF;
    final b = v & 0xFF;
    // ABGR packed as used in engine (little endian)
    return (a << 24) | (b << 16) | (g << 8) | r;
  }

  Future<void> _commit() async {
    final buf = _paint;
    if (buf == null) return;
    final gen = ++_generation;
    buf.fillRange(0, buf.length, 0);
    for (final op in _ops) {
      _floodFill(buf, op.x, op.y, op.argb);
    }
    final c = Completer<ui.Image>();
    ui.decodeImageFromPixels(buf.buffer.asUint8List(), _w, _h, ui.PixelFormat.rgba8888, c.complete);
    final image = await c.future;
    if (!mounted || gen != _generation) { image.dispose(); return; }
    final prev = _paintImage;
    setState(() => _paintImage = image);
    prev?.dispose();
  }

  void _floodFill(Uint32List dst, int tx, int ty, int argb) {
    final src = _sourceRgba;
    if (src == null) return;
    if (tx < 0 || ty < 0 || tx >= _w || ty >= _h) return;
    const tol = 120;
    final start = ty * _w + tx;
    final seedOff = start * 4;
    final sr = src[seedOff];
    final sg = src[seedOff+1];
    final sb = src[seedOff+2];
    final visited = Uint8List(_w * _h);
    final stack = <int>[start];
    visited[start]=1;
    while (stack.isNotEmpty) {
      final p = stack.removeLast();
      final off = p*4;
      final drift = (src[off]-sr).abs() + (src[off+1]-sg).abs() + (src[off+2]-sb).abs();
      if (drift>tol) continue;
      dst[p]=argb;
      final x = p % _w;
      if (x>0 && visited[p-1]==0) { visited[p-1]=1; stack.add(p-1); }
      if (x<_w-1 && visited[p+1]==0) { visited[p+1]=1; stack.add(p+1); }
      if (p>=_w && visited[p-_w]==0) { visited[p-_w]=1; stack.add(p-_w); }
      if (p+_w<visited.length && visited[p+_w]==0) { visited[p+_w]=1; stack.add(p+_w); }
    }
  }

  void _handleTap(Offset local, Size box) {
    if (box.width<=0||box.height<=0) return;
    final ix = (local.dx / box.width * _w).floor();
    final iy = (local.dy / box.height * _h).floor();
    if (ix<0||iy<0||ix>=_w||iy>=_h) return;
    setState(() {
      _ops.add(_RegionOp(x: ix, y: iy, argb: _packHex(_selectedHex)));
      _undone.clear();
      _showHint = false;
    });
    unawaited(_commit());
  }

  void _undo() { if (_ops.isNotEmpty) { setState((){ _undone.add(_ops.removeLast()); }); unawaited(_commit()); }}
  void _redo() { if (_undone.isNotEmpty) { setState((){ _ops.add(_undone.removeLast()); }); unawaited(_commit()); }}
  void _clear() { if (_ops.isNotEmpty) { setState((){ _ops.clear(); _undone.clear(); }); unawaited(_commit()); }}

  @override
  Widget build(BuildContext context) {
    final label = widget.spec.label;
    return TutorialGate(
      storageKey: widget.tutorialStorageKey ?? 'tutorial_coloring_v2_seen',
      child: Scaffold(
        backgroundColor: _kDeepSpace,
        appBar: _buildAppBar(context, label),
        body: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [Color(0xFF0C1030), Color(0xFF070A1C), Color(0xFF05060F)]),
          ),
          child: Column(
            children: [
              Expanded(
                child: _loading
                    ? const Center(child: CircularProgressIndicator(color: Colors.white54))
                    : _buildCanvasArea(),
              ),
              _buildPaletteStrip(),
              _buildActionRow(),
              _buildDoneButton(context),
              _buildOtherStrip(),
              const SizedBox(height: 10),
            ],
          ),
        ),
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context, String label) {
    // The old bar carried both a "مساعدة" pill and a bare "؟" circle — two
    // controls for the same affordance, neither wired to anything.
    return StudioAppBar(
      title: 'لوّن $label',
      glyph: Icons.brush_rounded,
      actions: const [
        StudioBarCircle(icon: Icons.help_outline_rounded, label: 'مساعدة'),
      ],
    );
  }

  Widget _buildCanvasArea() {
    // عرض SVG مميز عند fallback - يمنع تكرار العصفورة
    if (_isSvgFallback && _svgFallbackPath != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: AspectRatio(
            aspectRatio: 1.0,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(_kCanvasRadius),
              child: Container(
                color: Colors.white,
                padding: const EdgeInsets.all(24),
                child: DrawingAsset(assetIdOrPath: _svgFallbackPath!, fit: BoxFit.contain),
              ),
            ),
          ),
        ),
      );
    }
    final picture = _picture;
    if (picture == null) return const SizedBox.shrink();
    return LayoutBuilder(builder: (context, constraints) {
      // نحافظ على aspect الطولي للصورة لكن داخل Padding مدور
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: AspectRatio(
            aspectRatio: _w / _h > 1.6 ? _w / _h : 1.0,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(_kCanvasRadius),
              child: RepaintBoundary(
                key: _canvasKey,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTapDown: (d) {
                    final rb = _canvasKey.currentContext?.findRenderObject() as RenderBox?;
                    if (rb==null) return;
                    final local = rb.globalToLocal(d.globalPosition);
                    _handleTap(local, rb.size);
                  },
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      Container(color: Colors.white),
                      if (_paintImage != null)
                        CustomPaint(painter: _BoardPainter(paintImage: _paintImage!, w: _w, h: _h)),
                      CustomPaint(
                        painter: _PictureMultiplyPainter(picture: picture, w: _w, h: _h),
                      ),
                      // badges
                      Positioned(
                        top: 12,
                        left: 12,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(color: const Color(0xFFFFF3C2), borderRadius: BorderRadius.circular(999), border: Border.all(color: const Color(0xFFFFD34D))),
                          child: Text(_fillCountLabel, style: const TextStyle(color: Color(0xFF0C1030), fontSize: 11, fontWeight: FontWeight.w800)),
                        ),
                      ),
                      if (_showHint)
                        Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1A2348).withValues(alpha: 0.92),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
                            ),
                            child: const Text('اضغط على اي منطقة لتلوينها', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
    });
  }

  Widget _buildPaletteStrip() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            for (final e in kBoardPaletteV2)
              Padding(
                padding: const EdgeInsetsDirectional.only(end: 10),
                child: _ColorChip(
                  color: e.color,
                  selected: _selectedHex == e.hex,
                  onTap: () => setState(() => _selectedHex = e.hex),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 6),
      child: Row(
        children: [
          // حفظ: يصدّر + يحفظ على الموبايل + share + local CreationStore
          Builder(builder: (c) => _ColorActionBtn(
            spec: const _ActionSpec(label: 'حفظ', icon: Icons.download_rounded, bg: Color(0xFF2EAC5A), fg: Colors.white),
            onTap: () => unawaited(_saveToPhone(c)),
          )),
          const SizedBox(width: 8),
          _ColorActionBtn(
            spec: const _ActionSpec(label: 'تلميح', icon: Icons.lightbulb_rounded, bg: Color(0xFFFFD34D), fg: Color(0xFF0C1030)),
            onTap: () => setState(() => _showHint = true),
          ),
          const SizedBox(width: 8),
          _ColorActionBtn(
            spec: const _ActionSpec(label: 'من جديد', icon: Icons.auto_awesome_rounded, bg: Color(0xFF6EE7FF), fg: Color(0xFF0C1030)),
            onTap: _clear,
          ),
          const SizedBox(width: 8),
          _ColorActionBtn(
            spec: const _ActionSpec(label: 'إعادة', icon: Icons.refresh_rounded, bg: Color(0xFF38E8E0), fg: Color(0xFF0C1030)),
            onTap: _redo,
          ),
          const SizedBox(width: 8),
          _ColorActionBtn(
            spec: const _ActionSpec(label: 'تراجع', icon: Icons.undo_rounded, bg: Color(0xFF9F86FF), fg: Colors.white),
            onTap: _undo,
          ),
        ],
      ),
    );
  }

  Widget _buildDoneButton(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
      child: SizedBox(
        width: double.infinity,
        height: 50,
        child: FilledButton(
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF6A3DF2),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          ),
          onPressed: () async {
            // حفظ على الموبايل أيضاً عند إنهاء اللوحة
            await _saveToPhone(context);
            if (context.mounted) await Navigator.of(context).maybePop();
          },
          child: const Text('تم', style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)),
        ),
      ),
    );
  }

  Widget _buildOtherStrip() {
    if (widget.thumbSpecs.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 6),
          child: Row(
            children: [
              const Text('رسومات أخرى', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w800)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: const Color(0xFF1E2A6A), borderRadius: BorderRadius.circular(999)),
                child: const Row(children:[Icon(Icons.edit_rounded, size: 12, color: Colors.white70), SizedBox(width:4), Text('تعديل', style: TextStyle(color: Colors.white70, fontSize: 11))]),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.ios_share_rounded, size: 16, color: Colors.white54),
            ],
          ),
        ),
        SizedBox(
          height: 78,
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            scrollDirection: Axis.horizontal,
            itemCount: widget.thumbSpecs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (c,i){
              final sp = widget.thumbSpecs[i];
              final isSel = sp.id==widget.spec.id;
              final fallback = sp.fallbackAsset;
              final remote = sp.bestDisplayUrl;
              final isNet = remote!=null && (remote.startsWith('http://')||remote.startsWith('https://'));
              Widget img;
              Widget fallbackW() => fallback.toLowerCase().endsWith('.svg') ? DrawingAsset(assetIdOrPath: fallback, fit: BoxFit.contain) : Image.asset(fallback, fit: BoxFit.contain, errorBuilder: (_, __, ___)=> const Icon(Icons.brush_outlined, color: Colors.black26));
              if (isNet) {
                img = Image.network(remote, fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => fallbackW(),
                );
              } else if (fallback.toLowerCase().endsWith('.svg')) {
                img = DrawingAsset(assetIdOrPath: fallback, fit: BoxFit.contain);
              } else if (sp.assetPath!=null) {
                img = Image.asset(sp.assetPath!, fit: BoxFit.contain, errorBuilder: (_, __, ___)=> fallbackW());
              } else {
                img = fallbackW();
              }
              return InkWell(
                onTap: () => widget.onSelectOther?.call(sp),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: 72,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isSel ? const Color(0xFF6A3DF2) : Colors.white.withValues(alpha:0.3), width: isSel?2:1),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: img,
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Future<Uint8List?> _capturePng() async {
    try {
      final boundary = _canvasKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary==null) return null;
      final img = await boundary.toImage(pixelRatio: 3.0);
      final bd = await img.toByteData(format: ui.ImageByteFormat.png);
      return bd?.buffer.asUint8List();
    } catch (_) { return null; }
  }

  /// حفظ على الموبايل + مشاركة — لا CDN، فقط PNG محلي للـ gallery
  Future<void> _saveToPhone(BuildContext context) async {
    final png = await _capturePng();
    if (png==null) return;
    widget.onSave?.call(png);
    try {
      final tmpDir = await getTemporaryDirectory();
      final file = io.File('${tmpDir.path}/coloring_${widget.spec.id}_${DateTime.now().millisecondsSinceEpoch}.png');
      await file.writeAsBytes(png);
      // share_plus يحفظ/يشارك عبر نظام الملفات
      if (!context.mounted) return;
      await Share.shareXFiles([XFile(file.path)], text: 'رسمة ${widget.spec.label} - مجرة');
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم الحفظ - يمكنك مشاركتها الان')));
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('تعذر الحفظ: $e')));
    }
  }
}

/// صياغة عربية صحيحة لعدد التلوينات: مفرد ومثنّى وجمعٌ قليل وجمعٌ كثير.
///
/// `'$n تلوينات'` وحدها تُنتج «1 تلوينات» و«2 تلوينات». ودالّة عامّة لا مُلحَقٌ
/// خاصّ بالحالة ليُمكن التأكيد على الصياغات مباشرةً بلا تحميل صورة.
String coloringFillCountLabel(int count) {
  if (count <= 0) return 'ابدأ التلوين';
  if (count == 1) return 'تلوينة واحدة';
  if (count == 2) return 'تلوينتان';
  if (count <= 10) return '$count تلوينات';
  return '$count تلوينة';
}

class _RegionOp { const _RegionOp({required this.x, required this.y, required this.argb}); final int x, y, argb; }

class _ActionSpec { const _ActionSpec({required this.label, required this.icon, required this.bg, required this.fg}); final String label; final IconData icon; final Color bg; final Color fg; }

class _ColorChip extends StatelessWidget {
  const _ColorChip({required this.color, required this.selected, required this.onTap});
  final Color color; final bool selected; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: selected ? Colors.white : Colors.white.withValues(alpha: 0.18), width: selected ? 3 : 1.2),
        boxShadow: selected ? [BoxShadow(color: color.withValues(alpha: 0.45), blurRadius: 10)] : null,
      ),
      child: selected ? const Icon(Icons.check_rounded, size: 18, color: Colors.white) : null,
    ),
  );
}

class _ColorActionBtn extends StatelessWidget {
  const _ColorActionBtn({required this.spec, this.onTap});
  final _ActionSpec spec; final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Expanded(
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 42,
        decoration: BoxDecoration(color: spec.bg, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: spec.bg.withValues(alpha: 0.25), blurRadius: 8, offset: const Offset(0,3))]),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(spec.icon, size: 18, color: spec.fg),
            const SizedBox(width: 5),
            Text(spec.label, style: TextStyle(color: spec.fg, fontSize: 12, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    ),
  );
}

class _BoardPainter extends CustomPainter {
  const _BoardPainter({required this.paintImage, required this.w, required this.h});
  final ui.Image paintImage; final int w, h;
  @override void paint(Canvas c, Size s) { c.drawImageRect(paintImage, Rect.fromLTWH(0,0,w.toDouble(),h.toDouble()), Rect.fromLTWH(0,0,s.width,s.height), Paint()); }
  @override bool shouldRepaint(_BoardPainter o) => o.paintImage!=paintImage;
}

class _PictureMultiplyPainter extends CustomPainter {
  const _PictureMultiplyPainter({required this.picture, required this.w, required this.h});
  final ui.Image picture; final int w, h;
  @override void paint(Canvas c, Size s) { c.drawImageRect(picture, Rect.fromLTWH(0,0,w.toDouble(),h.toDouble()), Offset.zero & s, Paint()..blendMode=BlendMode.multiply); }
  @override bool shouldRepaint(covariant CustomPainter old) => true;
}
