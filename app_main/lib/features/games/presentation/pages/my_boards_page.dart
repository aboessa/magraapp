/// لوحاتي — personal editable drawing boards.
/// First-class creative workspace, not a game. Uses CreationDocument via LocalCreationStore.
library;
import 'dart:async';
import 'package:flutter/material.dart';
import '../../data/creation_document.dart';
import '../../data/local_creation_store.dart';
import 'board_editor_page.dart';

class MyBoardsPage extends StatefulWidget {
  const MyBoardsPage({required this.childId, required this.creationStore, super.key});
  final String childId;
  final LocalCreationStore creationStore;
  @override State<MyBoardsPage> createState() => _MyBoardsPageState();
}

class _MyBoardsPageState extends State<MyBoardsPage> {
  List<LocalCreation> _boards = const [];
  bool _loading = true;

  @override void initState(){ super.initState(); _load(); }

  Future<void> _load() async {
    final all = await widget.creationStore.list(widget.childId);
    // Filter boards: creationType freeBoard or referenceCopy or legacy free_draw
    final boards = all.where((c){
      if(c.documentJson==null) return c.drawingMode=='free_draw' || c.drawingMode=='free_board';
      final doc = CreationDocument.tryParse(c.documentJson!);
      if(doc==null) return false;
      return doc.creationType==CreationType.freeBoard || doc.creationType==CreationType.referenceCopy || doc.mode=='free_draw';
    }).toList();
    if(!mounted) return;
    setState((){ _boards = boards; _loading=false; });
  }

  String _nextTitle(){
    final n = _boards.length+1;
    return 'لوحتي $n';
  }

  Future<void> _createBoard() async {
    final result = await showModalBottomSheet<_NewBoardConfig>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _NewBoardSheet(nextTitle: _nextTitle()),
    );
    if(result==null) return;
    // Storage policy: soft limit 100, warn at 80, hard cap 200 — never silently delete oldest
    if(_boards.length >= LocalCreationStore.warnAt){
      if(!mounted) return;
      final proceed = await showDialog<bool>(context: context, builder: (_)=> AlertDialog(
        title: const Text('المساحة قاربت الامتلاء'),
        content: Text('لديك ${_boards.length} لوحة. الحد الناعم ${LocalCreationStore.retainPerChild} (تحذير عند ${LocalCreationStore.warnAt}). الحد الأقصى ${LocalCreationStore.hardCap}. احذف بعض اللوحات القديمة قبل إنشاء جديدة.'),
        actions: [TextButton(onPressed: ()=> Navigator.pop(context,false), child: const Text('إلغاء')), FilledButton(onPressed: ()=> Navigator.pop(context,true), child: const Text('متابعة'))],
      ));
      if(proceed!=true) return;
    }
    if(!mounted) return;
    final doc = CreationDocument(
      version: kCreationDocVersion,
      mode: 'free_draw',
      canvasWidth: result.orientation==BoardOrientation.portrait? 720: result.orientation==BoardOrientation.landscape? 1280: 1024,
      canvasHeight: result.orientation==BoardOrientation.portrait? 1280: result.orientation==BoardOrientation.landscape? 720: 1024,
      boardTitle: result.title,
      orientation: result.orientation,
      creationType: CreationType.freeBoard,
      backgroundAsset: result.backgroundAsset,
      palette: const ['#FFD34D','#00D6F5','#FF6FAE','#6A3DF2','#FF9F1C','#22C55E','#000000'],
    );
    // Navigate to editor with new doc (not yet saved, will autosave)
    await Navigator.of(context).push(MaterialPageRoute(builder: (_)=> BoardEditorPage(childId: widget.childId, creationStore: widget.creationStore, initialDocument: doc, isNewBoard: true)));
    await _load();
  }

  Future<void> _openBoard(LocalCreation c) async {
    final doc = c.documentJson!=null ? CreationDocument.tryParse(c.documentJson!) : null;
    await Navigator.of(context).push(MaterialPageRoute(builder: (_)=> BoardEditorPage(childId: widget.childId, creationStore: widget.creationStore, initialDocument: doc, existingCreation: c)));
    await _load();
  }

  Future<void> _rename(LocalCreation c) async {
    final ctrl = TextEditingController(text: c.title ?? CreationDocument.tryParse(c.documentJson??'')?.boardTitle ?? c.displayTitle);
    final newTitle = await showDialog<String>(context: context, builder: (_)=> AlertDialog(
      title: const Text('تغيير العنوان'),
      content: TextField(controller: ctrl, maxLength: 60, decoration: const InputDecoration(hintText: 'مثلاً: لوحتي الجميلة')),
      actions: [TextButton(onPressed: ()=> Navigator.pop(context), child: const Text('إلغاء')), FilledButton(onPressed: ()=> Navigator.pop(context, ctrl.text.trim()), child: const Text('حفظ'))],
    ));
    if(newTitle==null || newTitle.isEmpty) return;
    await widget.creationStore.rename(widget.childId, c.id, newTitle);
    await _load();
  }

  Future<void> _duplicate(LocalCreation c) async {
    final doc = c.documentJson!=null ? CreationDocument.tryParse(c.documentJson!) : null;
    if(doc==null) return;
    final dupDoc = CreationDocument(
      version: doc.version,
      mode: doc.mode,
      canvasWidth: doc.canvasWidth,
      canvasHeight: doc.canvasHeight,
      backgroundAsset: doc.backgroundAsset,
      templateAsset: doc.templateAsset,
      palette: doc.palette,
      strokes: doc.strokes,
      fills: doc.fills,
      boardTitle: '${doc.boardTitle ?? c.displayTitle} نسخة',
      orientation: doc.orientation,
      creationType: doc.creationType,
      referenceActivityId: doc.referenceActivityId,
      referenceAssetId: doc.referenceAssetId,
      referenceTitle: doc.referenceTitle,
    );
    // Save duplicate as new creation with PNG copy
    await widget.creationStore.saveDocumentDirect(
      childId: widget.childId,
      gameId: c.gameId,
      drawingMode: c.drawingMode,
      documentJson: dupDoc.toJsonString(),
      documentVersion: dupDoc.version,
      pngBytes: c.bytes,
      width: c.width,
      height: c.height,
    );
    await _load();
  }

  Future<void> _delete(LocalCreation c) async {
    final isUploaded = c.isUploaded;
    final confirm = await showDialog<bool>(context: context, builder: (_)=> AlertDialog(
      title: const Text('حذف اللوحة؟'),
      content: Text(isUploaded ? 'هذه اللوحة محفوظة محلياً ومزامنة للعائلة. حذف المحلي لن يحذف النسخة العائلية. هل تريد حذف النسخة المحلية؟' : 'سيتم حذف اللوحة نهائياً من هذا الجهاز.'),
      actions: [TextButton(onPressed: ()=> Navigator.pop(context,false), child: const Text('إلغاء')), FilledButton(onPressed: ()=> Navigator.pop(context,true), child: const Text('حذف'))],
    ));
    if(confirm!=true) return;
    await widget.creationStore.delete(widget.childId, c.id);
    await _load();
  }

  @override Widget build(BuildContext context){
    return Scaffold(
      appBar: AppBar(title: const Text('لوحاتي')),
      floatingActionButton: FloatingActionButton.extended(onPressed: _createBoard, icon: const Icon(Icons.add), label: const Text('لوحة جديدة')),
      body: _loading ? const Center(child: CircularProgressIndicator()) : _boards.isEmpty ? _EmptyBoards(onCreate: _createBoard) : GridView.builder(
        padding: const EdgeInsets.fromLTRB(16,16,16,80),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(maxCrossAxisExtent: 220, childAspectRatio: 0.82, crossAxisSpacing: 12, mainAxisSpacing: 12),
        itemCount: _boards.length,
        itemBuilder: (ctx,i){
          final c = _boards[i];
          final doc = c.documentJson!=null ? CreationDocument.tryParse(c.documentJson!) : null;
          final title = c.title ?? doc?.boardTitle ?? c.displayTitle;
          final orient = doc?.orientation.name ?? 'square';
          final refBadge = doc?.referenceTitle!=null ? 'من: ${doc!.referenceTitle}' : null;
          return Card(clipBehavior: Clip.antiAlias, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children:[
            Expanded(child: GestureDetector(onTap: ()=> _openBoard(c), child: Stack(fit: StackFit.expand, children:[
              Image.memory(c.bytes, fit: BoxFit.cover),
              if(doc?.referenceTitle!=null) Positioned(top:6, left:6, child: Container(padding: const EdgeInsets.symmetric(horizontal:6, vertical:2), decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(6)), child: Text(refBadge!, style: const TextStyle(color: Colors.white, fontSize:10)))),
            ]))),
            Padding(padding: const EdgeInsets.fromLTRB(8,6,8,2), child: Text(title, maxLines:1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.titleSmall)),
            Padding(padding: const EdgeInsets.symmetric(horizontal:8), child: Row(children:[
              Icon(doc?.orientation==BoardOrientation.portrait? Icons.stay_current_portrait: doc?.orientation==BoardOrientation.landscape? Icons.stay_current_landscape: Icons.crop_square, size:14),
              const SizedBox(width:4),
              Text(orient, style: Theme.of(context).textTheme.labelSmall),
              const Spacer(),
              if(c.isUploaded) const Icon(Icons.cloud_done, size:14) else const Icon(Icons.phone_iphone, size:14),
            ])),
            Padding(padding: const EdgeInsets.symmetric(horizontal:4), child: Wrap(spacing:2, children:[
              IconButton(icon: const Icon(Icons.edit_outlined, size:18), tooltip: 'متابعة', onPressed: ()=> _openBoard(c)),
              IconButton(icon: const Icon(Icons.drive_file_rename_outline, size:18), tooltip: 'تغيير الاسم', onPressed: ()=> _rename(c)),
              IconButton(icon: const Icon(Icons.content_copy, size:18), tooltip: 'نسخ', onPressed: ()=> _duplicate(c)),
              IconButton(icon: const Icon(Icons.delete_outline, size:18), tooltip: 'حذف', onPressed: ()=> _delete(c)),
            ])),
          ]));
        },
      ),
    );
  }
}

class _NewBoardConfig {
  _NewBoardConfig({required this.title, required this.orientation, this.backgroundAsset});
  final String title;
  final BoardOrientation orientation;
  final String? backgroundAsset;
}

class _NewBoardSheet extends StatefulWidget {
  const _NewBoardSheet({required this.nextTitle});
  final String nextTitle;
  @override State<_NewBoardSheet> createState()=> _NewBoardSheetState();
}

class _NewBoardSheetState extends State<_NewBoardSheet> {
  late TextEditingController _titleCtrl;
  BoardOrientation _orient = BoardOrientation.square;
  String? _bg;
  @override void initState(){ super.initState(); _titleCtrl=TextEditingController(text: widget.nextTitle); }
  @override void dispose(){ _titleCtrl.dispose(); super.dispose(); }
  @override Widget build(BuildContext context){
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children:[
            Text('لوحة جديدة', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height:12),
            TextField(controller: _titleCtrl, decoration: const InputDecoration(labelText: 'عنوان اللوحة', hintText: 'لوحتي 1'), maxLength: 60),
            const SizedBox(height:8),
            Text('الاتجاه', style: Theme.of(context).textTheme.labelLarge),
            SegmentedButton<BoardOrientation>(
              segments: const [
                ButtonSegment(value: BoardOrientation.portrait, label: Text('طولي'), icon: Icon(Icons.stay_current_portrait)),
                ButtonSegment(value: BoardOrientation.square, label: Text('مربع'), icon: Icon(Icons.crop_square)),
                ButtonSegment(value: BoardOrientation.landscape, label: Text('عرضي'), icon: Icon(Icons.stay_current_landscape)),
              ],
              selected: {_orient},
              onSelectionChanged: (s)=> setState(()=> _orient=s.first),
            ),
            const SizedBox(height:12),
            Text('الخلفية', style: Theme.of(context).textTheme.labelLarge),
            Wrap(spacing:8, children: [
              for(final opt in _bgOptions) ChoiceChip(
                label: Text(opt.label),
                selected: _bg==opt.asset,
                onSelected: (v)=> setState(()=> _bg = v? opt.asset: null),
              ),
            ]),
            const SizedBox(height:16),
            FilledButton(onPressed: (){
              Navigator.pop(context, _NewBoardConfig(title: _titleCtrl.text.trim().isEmpty? widget.nextTitle: _titleCtrl.text.trim(), orientation: _orient, backgroundAsset: _bg));
            }, child: const Text('إنشاء')),
          ]),
        ),
      ),
    );
  }
}

class _BgOpt { const _BgOpt(this.label, this.asset); final String label; final String? asset; }
const _bgOptions = [
  _BgOpt('أبيض', null),
  _BgOpt('فضاء', 'asset-color-stars'),
  _BgOpt('تحت الماء', 'asset-color-sea'),
  _BgOpt('حديقة', 'asset-color-forest'),
  _BgOpt('سماء', 'asset-color-rainbow'),
  _BgOpt('غرفة', 'asset-alam-map-half'),
  _BgOpt('شبكة', 'asset-trace-maze'),
];

class _EmptyBoards extends StatelessWidget {
  const _EmptyBoards({required this.onCreate});
  final VoidCallback onCreate;
  @override Widget build(BuildContext context){
    return Center(child: Padding(padding: const EdgeInsets.all(32), child: Column(mainAxisAlignment: MainAxisAlignment.center, children:[
      const Icon(Icons.dashboard_customize_outlined, size:64),
      const SizedBox(height:12),
      Text('لا لوحات بعد', style: Theme.of(context).textTheme.titleMedium),
      const SizedBox(height:6),
      const Text('أنشئ أول لوحة وارسم ما تحب', textAlign: TextAlign.center),
      const SizedBox(height:16),
      FilledButton.icon(onPressed: onCreate, icon: const Icon(Icons.add), label: const Text('لوحة جديدة')),
    ])));
  }
}
