/// 4) لوحاتي / My Boards Gallery Thumbnail اسم + آخر تعديل Continue Rename/Duplicate/Delete/Share + لوحة جديدة
/// + 7) شاشة الحفظ / تفاصيل الرسمة Preview كبير اسم تعديل متابعة حفظ كصورة Duplicate Delete
/// + 10) حالة النشاط الجاري Preview من تلوينه الحقيقي تابع التلوين نسبة/عدد المناطق
library;
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../data/creation_document.dart';
import '../../../data/local_creation_store.dart';
import '../board_editor_page.dart';
import 'image_slot.dart';

class MyBoardsV2Page extends StatefulWidget {
  const MyBoardsV2Page({required this.childId, required this.store, super.key});
  final String childId;
  final LocalCreationStore store;

  @override State<MyBoardsV2Page> createState() => _MyBoardsV2State();
}

class _MyBoardsV2State extends State<MyBoardsV2Page> {
  List<LocalCreation> _boards = const [];
  bool _loading = true;

  @override
  void initState() { super.initState(); _load(); }

  Future<void> _load() async {
    setState(() => _loading = true);
    final list = await widget.store.list(widget.childId);
    setState(() { _boards = list; _loading = false; });
  }

  Future<void> _openBoard(LocalCreation c) async {
    final doc = c.documentJson != null ? CreationDocument.tryParse(c.documentJson!) : null;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => BoardEditorPage(childId: widget.childId, creationStore: widget.store, initialDocument: doc, existingCreation: c)));
    await _load();
  }

  Future<void> _duplicateBoard(LocalCreation c) async {
    final doc = c.documentJson != null ? CreationDocument.tryParse(c.documentJson!) : null;
    if (doc == null) return;
    final dup = CreationDocument(version: doc.version, mode: doc.mode, canvasWidth: doc.canvasWidth, canvasHeight: doc.canvasHeight, boardTitle: '${doc.boardTitle ?? 'لوحة'} (نسخة)', orientation: doc.orientation, creationType: doc.creationType, backgroundAsset: doc.backgroundAsset, palette: doc.palette, strokes: doc.strokes);
    final j = dup.toJsonString();
    await widget.store.saveDocumentDirect(childId: widget.childId, gameId: c.gameId, drawingMode: c.drawingMode, documentJson: j, documentVersion: dup.version, pngBytes: c.bytes, width: c.width, height: c.height);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeep,
      appBar: deepAppBar(context, 'لوحاتي', actions: [
        Padding(padding: const EdgeInsetsDirectional.only(end: 12), child: Text('${_boards.length} رسمة', style: const TextStyle(color: Colors.white70, fontSize: 12))),
      ]),
      floatingActionButton: FloatingActionButton.extended(onPressed: () => _newBoard(context), icon: const Icon(Icons.add_rounded), label: const Text('لوحة جديدة'), backgroundColor: kPurple),
      body: _loading ? const Center(child: CircularProgressIndicator(color: kGold)) : _boards.isEmpty ? _EmptyMyBoards(onNew: () => _newBoard(context)) : GridView.builder(
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 90),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, childAspectRatio: 0.82, crossAxisSpacing: 10, mainAxisSpacing: 10),
        itemCount: _boards.length,
        itemBuilder: (_, i) => _BoardTile(creation: _boards[i], onTap: () => _openBoard(_boards[i]), onDuplicate: () => _duplicateBoard(_boards[i]), onDelete: () async { await widget.store.delete(widget.childId, _boards[i].id); await _load(); }),
      ),
    );
  }

  Future<void> _newBoard(BuildContext c) async {
    final res = await showModalBottomSheet<_BoardTypeSpec>(context: c, isScrollControlled: true, builder: (_) => const _NewBoardTypeSheet());
    if (res == null) return;
    final title = 'لوحتي ${_boards.length + 1}';
    final doc = CreationDocument(version: kCreationDocVersion, mode: 'free_draw', canvasWidth: res.w.toDouble(), canvasHeight: res.h.toDouble(), boardTitle: title, orientation: res.orientation, creationType: CreationType.freeBoard, backgroundAsset: res.bgAsset, palette: const ['#FFD34D','#00D6F5','#FF6FAE','#6A3DF2','#FF9F1C','#22C55E','#000000']);
    if (!c.mounted) return;
    await Navigator.of(c).push(MaterialPageRoute(builder: (_) => BoardEditorPage(childId: widget.childId, creationStore: widget.store, initialDocument: doc, isNewBoard: true)));
    await _load();
  }
}

class _BoardTile extends StatelessWidget {
  const _BoardTile({required this.creation, required this.onTap, required this.onDuplicate, required this.onDelete});
  final LocalCreation creation;
  final VoidCallback onTap;
  final VoidCallback onDuplicate;
  final VoidCallback onDelete;

  String get _title {
    if (creation.documentJson != null) {
      final d = CreationDocument.tryParse(creation.documentJson!);
      if (d?.boardTitle != null) return d!.boardTitle!;
    }
    return creation.title ?? 'لوحة';
  }

  String get _updatedAgo {
    final diff = DateTime.now().difference(creation.createdAt);
    if (diff.inMinutes < 60) return 'منذ ${diff.inMinutes} د';
    if (diff.inHours < 24) return 'منذ ${diff.inHours} س';
    return 'منذ ${diff.inDays} يوم';
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(18), border: Border.all(color: Colors.white12)),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Positioned.fill(child: _CreationPreview(creation: creation)),
          PositionedDirectional(start: 0, end: 0, bottom: 0, child: Container(
            padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
            decoration: BoxDecoration(color: const Color(0xFFF6F5FB), border: const Border(top: BorderSide(color: Color(0xFFE6E0FF)))),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_title, style: const TextStyle(color: Color(0xFF1A1A2E), fontWeight: FontWeight.w800, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 2),
              Text(_updatedAgo, style: const TextStyle(color: Color(0xFF9FA3C0), fontSize: 10, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Row(children: [
                _smallBtn(icon: Icons.play_arrow_rounded, label: 'متابعة', onTap: onTap),
                const Spacer(),
                PopupMenuButton<String>(onSelected: (v) { if (v == 'dup') onDuplicate(); if (v == 'del') onDelete(); }, itemBuilder: (_) => [const PopupMenuItem(value: 'dup', child: Text('تكرار')), const PopupMenuItem(value: 'del', child: Text('حذف'))], icon: const Icon(Icons.more_horiz_rounded, size: 18, color: Color(0xFF9FA3C0))),
              ]),
            ]),
          )),
        ]),
      ),
    );
  }

  Widget _smallBtn({required IconData icon, required String label, required VoidCallback onTap}) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(999), child: Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5), decoration: BoxDecoration(color: kPurple, borderRadius: BorderRadius.circular(999)), child: Row(mainAxisSize: MainAxisSize.min, children: [Icon(icon, size: 12, color: Colors.white), const SizedBox(width: 4), Text(label, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700))])));
}

/// Uses the flattened PNG saved alongside each editable document. Old or
/// corrupted entries remain usable through a neutral fallback rather than
/// breaking the gallery grid.
class _CreationPreview extends StatelessWidget {
  const _CreationPreview({required this.creation});

  final LocalCreation creation;

  @override
  Widget build(BuildContext context) {
    try {
      final bytes = creation.bytes;
      if (bytes.isNotEmpty) {
        return Image.memory(
          bytes,
          fit: BoxFit.contain,
          gaplessPlayback: true,
          errorBuilder: (_, __, ___) => const _CreationPreviewFallback(),
        );
      }
    } catch (_) {
      // A legacy or malformed base64 payload falls back to the empty state.
    }
    return const _CreationPreviewFallback();
  }
}

class _CreationPreviewFallback extends StatelessWidget {
  const _CreationPreviewFallback();

  @override
  Widget build(BuildContext context) => Container(
    color: Colors.white,
    alignment: Alignment.center,
    child: const Icon(
      Icons.brush_rounded,
      size: 36,
      color: Color(0xFF9FA3C0),
    ),
  );
}

class _EmptyMyBoards extends StatelessWidget {
  const _EmptyMyBoards({required this.onNew});
  final VoidCallback onNew;
  @override
  Widget build(BuildContext context) => Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
    Container(width: 96, height: 96, decoration: BoxDecoration(color: kPurple.withValues(alpha: 0.15), shape: BoxShape.circle), child: const Icon(Icons.auto_awesome_rounded, size: 48, color: kGold)),
    const SizedBox(height: 14),
    const Text('لم ترسم أي لوحة بعد', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
    const SizedBox(height: 6),
    const Text('ابدأ بلوحة فارغة أو اختر قالبًا', style: TextStyle(color: Colors.white54, fontSize: 12)),
    const SizedBox(height: 16),
    FilledButton(onPressed: onNew, style: FilledButton.styleFrom(backgroundColor: kPurple), child: const Text('لوحة جديدة +')),
  ]));
}

/// 5) اختيار نوع اللوحة الجديدة — فارغة فضاء تحت البحر حديقة سماء غرفة Grid Portrait/Landscape/Square
class _BoardTypeSpec {
  const _BoardTypeSpec({required this.label, required this.bgAsset, required this.w, required this.h, required this.orientation});
  final String label; final String? bgAsset; final int w; final int h; final BoardOrientation orientation;
}

const _newTypes = [
  _BoardTypeSpec(label: 'فارغة', bgAsset: null, w: 1024, h: 1024, orientation: BoardOrientation.square),
  _BoardTypeSpec(label: 'فضاء', bgAsset: 'board_bg_space', w: 1024, h: 1024, orientation: BoardOrientation.square),
  _BoardTypeSpec(label: 'تحت البحر', bgAsset: 'board_bg_sea', w: 1024, h: 1024, orientation: BoardOrientation.square),
  _BoardTypeSpec(label: 'حديقة', bgAsset: 'board_bg_garden', w: 1024, h: 1024, orientation: BoardOrientation.square),
  _BoardTypeSpec(label: 'سماء', bgAsset: 'board_bg_sky', w: 1024, h: 1024, orientation: BoardOrientation.square),
  _BoardTypeSpec(label: 'غرفة', bgAsset: 'board_bg_room', w: 1024, h: 1024, orientation: BoardOrientation.square),
  _BoardTypeSpec(label: 'شبكة', bgAsset: 'board_bg_grid', w: 1024, h: 1024, orientation: BoardOrientation.square),
];

class _NewBoardTypeSheet extends StatefulWidget {
  const _NewBoardTypeSheet();
  @override State<_NewBoardTypeSheet> createState() => _NewBoardTypeSheetState();
}

class _NewBoardTypeSheetState extends State<_NewBoardTypeSheet> {
  _BoardTypeSpec _picked = _newTypes.first;
  BoardOrientation _ori = BoardOrientation.square;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Color(0xFF16143A), borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
      padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 18),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Center(child: Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(999)))),
        const SizedBox(height: 14),
        const Text('اختر نوع اللوحة', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        GridView.builder(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 3, childAspectRatio: 1.1, crossAxisSpacing: 10, mainAxisSpacing: 10), itemCount: _newTypes.length, itemBuilder: (_, i) {
          final t = _newTypes[i];
          final sel = t.label == _picked.label;
          return InkWell(onTap: () => setState(() => _picked = t), borderRadius: BorderRadius.circular(16), child: Container(decoration: BoxDecoration(color: sel ? kPurple : Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16), border: Border.all(color: sel ? kGold : Colors.white12)), child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(sel ? Icons.check_rounded : _iconFor(t.label), color: Colors.white, size: 28), const SizedBox(height: 6), Text(t.label, style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))])));
        }),
        const SizedBox(height: 16),
        const Text('الاتجاه', style: TextStyle(color: Colors.white70, fontSize: 12, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        Row(children: [
          for (final o in BoardOrientation.values) Expanded(child: Padding(padding: const EdgeInsetsDirectional.only(end: 8), child: ChoiceChip(label: Text(switch (o) { BoardOrientation.portrait => 'طولي', BoardOrientation.landscape => 'عرضي', BoardOrientation.square => 'مربّع', }, style: const TextStyle(fontSize: 11)), selected: o == _ori, onSelected: (sel) { if (sel) setState(() => _ori = o); }, selectedColor: kGold))),
        ]),
        const SizedBox(height: 16),
        SizedBox(width: double.infinity, child: FilledButton(onPressed: () => Navigator.of(context).pop(_BoardTypeSpec(label: _picked.label, bgAsset: _picked.bgAsset, w: switch (_ori) { BoardOrientation.portrait => 720, BoardOrientation.landscape => 1280, BoardOrientation.square => 1024, }, h: switch (_ori) { BoardOrientation.portrait => 1280, BoardOrientation.landscape => 720, BoardOrientation.square => 1024, }, orientation: _ori)), style: FilledButton.styleFrom(backgroundColor: kPurple), child: const Text('إنشاء +', style: TextStyle(fontWeight: FontWeight.w800)))),
      ]),
    );
  }

  IconData _iconFor(String label) => switch (label) { 'فارغة' => Icons.crop_square_rounded, 'فضاء' => Icons.rocket_launch_rounded, 'تحت البحر' => Icons.water_rounded, 'حديقة' => Icons.local_florist_rounded, 'سماء' => Icons.cloud_rounded, 'غرفة' => Icons.chair_rounded, 'شبكة' => Icons.grid_on_rounded, _ => Icons.brush_rounded, };
}

/// 7) Save detail + tutorial overlay helpers outside main file for simplicity.
class SaveDetailPage extends StatefulWidget {
  const SaveDetailPage({required this.creation, required this.childId, required this.store, super.key});
  final LocalCreation creation;
  final String childId;
  final LocalCreationStore store;
  @override State<SaveDetailPage> createState() => _SaveDetailPageState();
}

class _SaveDetailPageState extends State<SaveDetailPage> {
  late TextEditingController _titleCtrl;
  @override void initState() { super.initState(); final doc = widget.creation.documentJson!=null? CreationDocument.tryParse(widget.creation.documentJson!):null; _titleCtrl = TextEditingController(text: doc?.boardTitle ?? widget.creation.title ?? 'لوحة'); }
  @override void dispose() { _titleCtrl.dispose(); super.dispose(); }

  Future<void> _exportArtwork({required bool isShare}) async {
    File? exportFile;
    try {
      final bytes = widget.creation.bytes;
      if (bytes.isEmpty) {
        throw StateError('لا توجد صورة محفوظة لهذه اللوحة بعد.');
      }

      final dir = await getTemporaryDirectory();
      exportFile = File('${dir.path}/majarra_${widget.creation.id}.png');
      await exportFile.writeAsBytes(bytes, flush: true);
      await Share.shareXFiles(
        [XFile(exportFile.path, mimeType: 'image/png')],
        text: isShare ? 'رسمتي من مجرة' : 'صورة رسمتي من مجرة',
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('لم نتمكن من تصدير الصورة: $error')),
      );
    } finally {
      try {
        if (exportFile != null && await exportFile.exists()) {
          await exportFile.delete();
        }
      } catch (_) {
        // Temporary-file cleanup is best effort after the system share flow.
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kDeep,
      appBar: deepAppBar(context, 'تفاصيل الرسم'),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Container(
          height: 360,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
          child: _CreationPreview(creation: widget.creation),
        ),
        const SizedBox(height: 12),
        TextField(controller: _titleCtrl, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700), decoration: InputDecoration(hintText: 'اسم اللوحة', hintStyle: const TextStyle(color: Colors.white38), filled: true, fillColor: Colors.white.withValues(alpha: 0.08), border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none))),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: OutlinedButton.icon(onPressed: () => _exportArtwork(isShare: true), icon: const Icon(Icons.share_rounded), label: const Text('مشاركة'), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white24)))),
          const SizedBox(width: 8),
          Expanded(child: FilledButton.icon(onPressed: () => _exportArtwork(isShare: false), icon: const Icon(Icons.download_rounded), label: const Text('تصدير صورة'), style: FilledButton.styleFrom(backgroundColor: kPurple))),
        ]),
        const SizedBox(height: 8),
        SizedBox(width: double.infinity, child: FilledButton(onPressed: () async {
          final doc = widget.creation.documentJson!=null? CreationDocument.tryParse(widget.creation.documentJson!):null;
          if (doc != null) {
            final updated = CreationDocument(version: doc.version, mode: doc.mode, canvasWidth: doc.canvasWidth, canvasHeight: doc.canvasHeight, boardTitle: _titleCtrl.text.trim(), orientation: doc.orientation, creationType: doc.creationType, backgroundAsset: doc.backgroundAsset, palette: doc.palette, strokes: doc.strokes);
            await widget.store.saveDocumentDirect(childId: widget.childId, gameId: widget.creation.gameId, drawingMode: widget.creation.drawingMode, documentJson: updated.toJsonString(), documentVersion: updated.version, pngBytes: widget.creation.bytes, width: widget.creation.width, height: widget.creation.height);
          }
          if (!context.mounted) return;
          Navigator.of(context).pop(true);
        }, style: FilledButton.styleFrom(backgroundColor: kGreen, padding: const EdgeInsets.symmetric(vertical: 14)), child: const Text('حفظ', style: TextStyle(fontWeight: FontWeight.w800)))),
        const SizedBox(height: 8),
        TextButton(onPressed: () async { await widget.store.delete(widget.childId, widget.creation.id); if (context.mounted) Navigator.of(context).pop(true); }, child: const Text('حذف اللوحة', style: TextStyle(color: Colors.redAccent))),
      ]),
    );
  }
}
