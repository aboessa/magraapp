/// أكمل الرسمة — Board premium: reference_full صغير + challenge كبير dashed
library;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import '../../../data/creative_catalogue.dart';
import '../../../data/local_creation_store.dart';
import '../../../engine/free_draw_surface.dart';
import '../../../engine/game_pack.dart';
import '../../../engine/game_services.dart';
import '../../../engine/game_session_controller.dart';
import '../../../data/creation_document.dart';
import '../../widgets/drawing_asset.dart';

class CompleteBoardPage extends StatefulWidget {
  const CompleteBoardPage({required this.childId, required this.creationStore, required this.item, required this.titleAr, super.key});
  final String childId;
  final LocalCreationStore creationStore;
  final StudioCatalogItem item;
  final String titleAr;
  @override
  State<CompleteBoardPage> createState() => _CompleteBoardPageState();
}

class _CompleteBoardPageState extends State<CompleteBoardPage> {
  final GlobalKey _key = GlobalKey();
  final FreeDrawController _drawCtrl = FreeDrawController();
  List<FreeStroke> _strokes = [];
  late final GameSessionController _ctrl;
  bool _saving = false;

  /// The puzzle the child draws on. Deliberately `assetId` and not
  /// `previewAssetId`: previewAssetId prefers the 512px thumbnail, which is fine
  /// for a grid card but too low-res for the full-size canvas background.
  String get _challengeAsset => widget.item.assetId ?? '';

  /// The finished answer key for the side panel. Falls back to the challenge
  /// image only if an activity genuinely has no reference.
  String get _referenceAsset {
    final ref = widget.item.referenceFullAssetId;
    return (ref == null || ref.isEmpty) ? _challengeAsset : ref;
  }

  String get _itemId => widget.item.id;

  @override
  void initState() {
    super.initState();
    final pack = GamePack.fromJson({
      'pack_version': 1,
      'engine_id': 'trace_color',
      'pack_id': 'complete-$_itemId',
      'localization': 'language_neutral',
      'supports_dpad': false,
      'progression': {'levels_to_finish': 1, 'advance_on': 'manual'},
      'accessibility': {'simplified_motor': {'tolerance_dp': 40, 'coverage_required': 0.6}, 'sequential_tap_alternative': true, 'min_touch_target_dp': 48},
      'assets': {'images': [_challengeAsset], 'audio': []},
      'voice_manifest': {},
      'levels': [{'level': 1, 'mode': 'complete_drawing', 'scoring': 'none', 'prompt_key': 'game.complete.prompt', 'completion': {'rule': 'child_taps_done'}, 'background_asset': _challengeAsset, 'coloring': {'enabled': false, 'palette': ['#FFD34D','#00D6F5','#FF6FAE','#6A3DF2']}}]
    });
    _ctrl = GameSessionController(pack: pack, gameId: 'complete-$_itemId', childId: widget.childId, ageTrack: AgeTrack.kids, audio: SilentGameAudioService(), reporter: _NoopReporter(), eventIdFactory: () => 'complete-${DateTime.now().microsecondsSinceEpoch}');
  }
  @override
  void dispose(){ _ctrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    if (_saving) return;
    final b = _key.currentContext?.findRenderObject();
    if (b is! RenderRepaintBoundary) return;
    setState(()=> _saving = true);
    final doc = CreationDocument.fromStrokes(mode: 'complete_drawing', canvasSize: b.size.width, canvasHeight: b.size.height, strokes: _strokes, fills: const {}, palette: const [], packId: _ctrl.pack.packId);
    try {
      final r = await widget.creationStore.saveFromBoundaryWithDocument(boundary: b, childId: widget.childId, gameId: _ctrl.gameId, drawingMode: 'complete_drawing', documentJson: doc.toJsonString(), documentVersion: doc.version);
      if (!mounted) return;
      setState(()=> _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(r.isSuccess ? 'رائع! حفظنا رسمتك.' : 'تعذر الحفظ')));
    } catch (_){ if(mounted) setState(()=> _saving=false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF05081A),
      appBar: AppBar(backgroundColor: const Color(0xFF05081A), leading: IconButton(icon: const Icon(Icons.arrow_back_rounded, color: Colors.white), onPressed: ()=> Navigator.maybePop(context)), title: const Text('أكمل الرسمة', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900)), centerTitle: true, actions: [Container(margin: const EdgeInsetsDirectional.only(end:12), padding: const EdgeInsets.symmetric(horizontal:10, vertical:6), decoration: BoxDecoration(color: Color(0xFF1A0B3E), borderRadius: BorderRadius.circular(999), border: Border.all(color: Color(0xFF6A3DF2))), child: const Row(children:[Icon(Icons.star_rounded, color: Color(0xFFFFD34D), size:16), SizedBox(width:4), Text('120', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800))]))]),
      body: Column(children: [
        Padding(padding: const EdgeInsets.fromLTRB(12,8,12,0), child: Container(padding: const EdgeInsets.symmetric(horizontal:12, vertical:8), decoration: BoxDecoration(color: Color(0xFF1A0B3E), borderRadius: BorderRadius.circular(999), border: Border.all(color: Color(0xFF2A2E6A))), child: Row(children:[const Icon(Icons.auto_awesome_rounded, color: Color(0xFF6A3DF2), size:16), SizedBox(width:6), Text('استكمل الرسم على الجهة اليمنى', style: TextStyle(color: Colors.white70, fontSize:12)), Spacer(), Text(widget.titleAr, style: TextStyle(color: Colors.white, fontWeight:FontWeight.w800, fontSize:12))] ))),
        const SizedBox(height: 8),
        Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal:12), child: Row(children:[
          // right side panel: reference + hint
          SizedBox(width: 120, child: Column(children:[
            Container(padding: const EdgeInsets.all(6), decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: Color(0xFF6A3DF2).withValues(alpha:0.4))), child: Column(children:[ Text('المرجع', style: TextStyle(color: Colors.white70, fontSize:11, fontWeight: FontWeight.w700)), SizedBox(height:6), Container(height:110, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(10)), clipBehavior: Clip.antiAlias, child: DrawingAsset(assetIdOrPath: _referenceAsset, fit: BoxFit.contain)), ])),
            SizedBox(height:8),
            Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: Color(0xFF1E2A6A))), child: Column(children:[ Row(children:[Icon(Icons.lightbulb_rounded, color: Color(0xFFFFD34D), size:16), SizedBox(width:4), Text('تلميح', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize:12))]), SizedBox(height:6), Text('لاحظ شكل الأجنحة وألوانها، ثم أكمل الجهة اليمنى.', style: TextStyle(color: Colors.white70, fontSize:10, height:1.4), textAlign: TextAlign.center)])),
          ])),
          SizedBox(width:8),
          Expanded(child: Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: Color(0xFF6A3DF2).withValues(alpha:0.35))), clipBehavior: Clip.antiAlias, child: Stack(fit: StackFit.expand, children:[
            // challenge as faint background? Actually FreeDrawSurface will show background_asset as challenge; we also keep white canvas
            FreeDrawSurface(controller: _ctrl, drawController: _drawCtrl, canvasRepaintBoundaryKey: _key, onStrokesChanged: (s)=> _strokes = List.of(s)),
          ]))),
        ]))),
        // tools
        Container(margin: const EdgeInsets.fromLTRB(12,8,12,0), padding: const EdgeInsets.symmetric(horizontal:6, vertical:6), decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: Color(0xFF1E2A6A))), child: Row(children:[
          for(final t in [(Icons.brush_rounded,'فرشاة'),(Icons.edit_rounded,'قلم'),(Icons.cleaning_services_rounded,'ممّحاة'),(Icons.format_color_fill_rounded,'ملء اللون'),(Icons.select_all_rounded,'تحديد'),(Icons.zoom_in_rounded,'تكبير')])
            Expanded(child: InkWell(onTap: (){ ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('أداة ${t.$2} قريباً'))); }, borderRadius: BorderRadius.circular(10), child: Container(padding: const EdgeInsets.symmetric(vertical:8), decoration: BoxDecoration(color: t.$2=='فرشاة'? Color(0xFF6A3DF2): Colors.transparent, borderRadius: BorderRadius.circular(10)), child: Column(children:[Icon(t.$1, size:18, color: Colors.white70), SizedBox(height:2), Text(t.$2, style: TextStyle(color: Colors.white70, fontSize:9))])))),
        ])),
        Container(margin: const EdgeInsets.fromLTRB(12,6,12,0), height: 42, decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(14), border: Border.all(color: Color(0xFF1E2A6A))), child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal:8, vertical:6), children:[
          for(final c in ['#FF6FAE','#EF4444','#FF9F1C','#FFD34D','#22C55E','#00D6F5','#2580FF','#9D68FF','#795548','#000000']) Container(width:30,height:30, margin: const EdgeInsetsDirectional.only(end:6), decoration: BoxDecoration(color: _parseHex(c), shape: BoxShape.circle, border: Border.all(color: Colors.white24))),
          Container(width:30,height:30, decoration: BoxDecoration(shape: BoxShape.circle, gradient: const SweepGradient(colors:[Colors.red, Colors.yellow, Colors.green, Colors.blue, Colors.purple, Colors.red]))),
        ])),
        Container(margin: const EdgeInsets.fromLTRB(12,6,12,0), child: Row(children:[
          for(final b in [(Icons.delete_forever_rounded,'إعادة','مسح الرسم'),(Icons.undo_rounded,'تراجع','خطوة للخلف'),(Icons.refresh_rounded,'من جديد','ابدأ من جديد')])
            Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal:4), child: InkWell(onTap: b.$1==Icons.delete_forever_rounded? ()=> _drawCtrl.clear(): b.$1==Icons.undo_rounded? ()=> _drawCtrl.undo(): ()=> _drawCtrl.clear(), borderRadius: BorderRadius.circular(12), child: Container(padding: const EdgeInsets.symmetric(vertical:10), decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(12), border: Border.all(color: Color(0xFF1E2A6A))), child: Column(children:[Icon(b.$1, color: b.$1==Icons.delete_forever_rounded? Color(0xFF9D68FF): Color(0xFF00D6F5), size:20), Text(b.$2, style: TextStyle(color: Colors.white, fontSize:11, fontWeight: FontWeight.w800)), Text(b.$3, style: TextStyle(color: Colors.white54, fontSize:8))]))))),
          Expanded(child: Padding(padding: const EdgeInsets.symmetric(horizontal:4), child: InkWell(onTap: (){ ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('أكمل الجهة الناقصة من الرسمة بمتابعة الخطوط المرجعية'))); }, borderRadius: BorderRadius.circular(12), child: Container(padding: const EdgeInsets.symmetric(vertical:10), decoration: BoxDecoration(color: Color(0xFF0F1433), borderRadius: BorderRadius.circular(12), border: Border.all(color: Color(0xFF1E2A6A))), child: Column(children:[Icon(Icons.help_rounded, color: Color(0xFFFFD34D), size:20), Text('أعد التعليمات', style: TextStyle(color: Colors.white, fontSize:11, fontWeight: FontWeight.w800)), Text('كيف أكمل الرسم؟', style: TextStyle(color: Colors.white54, fontSize:8))]))))),
        ])),
        Padding(padding: const EdgeInsets.fromLTRB(12,8,12,12), child: SizedBox(width: double.infinity, child: FilledButton(onPressed: _saving? null: _save, style: FilledButton.styleFrom(backgroundColor: Color(0xFF6A3DF2), padding: const EdgeInsets.symmetric(vertical:14), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14))), child: Row(mainAxisAlignment: MainAxisAlignment.center, children:[ Text(_saving? 'جاري الحفظ...':'احفظ رَسْمَتي', style: TextStyle(fontWeight: FontWeight.w900)), SizedBox(width:6), Icon(Icons.auto_awesome_rounded, size:16, color: Color(0xFFFFD34D))])))),
      ]),
    );
  }
  Color _parseHex(String h){ var s=h.replaceAll('#',''); if(s.length==6) s='FF$s'; return Color(int.parse(s, radix:16)); }
}
class _NoopReporter implements AttemptReporter { @override Future<void> report(GameAttempt a) async {}}
