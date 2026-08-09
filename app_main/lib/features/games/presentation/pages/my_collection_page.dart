/// «مجموعتي» — the child's own space.
///
/// ## Why one space, not two
///
/// ~15 content specs promise a sticker added to «مجموعتي», and
/// `game-letter-tracing` promises the coloured drawing is saved there too. Both
/// promises were unimplemented. Introducing a second concept («إبداعاتي») for the
/// same mental model — "things that are mine" — would fragment the word children
/// meet in the games, so this is one space with two shelves:
///
///   رسوماتي   drawings and colouring, from LocalCreationStore
///   ملصقاتي   stickers earned by finishing a game
///
/// ## Local first
///
/// Drawings are read from the device. Cloud copies exist only where a parent
/// explicitly saved one, and the badge on a card is the only place that
/// distinction is surfaced. Nothing here uploads.
library;

import 'package:flutter/material.dart';

import '../../data/local_creation_store.dart';

/// A sticker the child has earned.
class EarnedSticker {
  const EarnedSticker({
    required this.rewardKey,
    required this.sourceId,
    required this.earnedAt,
  });

  factory EarnedSticker.fromJson(Map<String, Object?> json) => EarnedSticker(
        rewardKey: json['reward_key'] as String? ?? '',
        sourceId: json['source_id'] as String? ?? '',
        earnedAt: DateTime.fromMillisecondsSinceEpoch(
          (json['earned_at'] as num?)?.toInt() ?? 0,
        ),
      );

  final String rewardKey;
  final String sourceId;
  final DateTime earnedAt;
}

class MyCollectionPage extends StatefulWidget {
  const MyCollectionPage({
    required this.childId,
    required this.creationStore,
    this.loadStickers,
    this.onKeepInAlbum,
    this.onRemoveFromAlbum,
    super.key,
  });

  final String childId;
  final LocalCreationStore creationStore;

  /// Injected so the page can be tested without a network. Returning null is a
  /// legitimate state: the sticker shelf then shows its empty message rather than
  /// an error, because a missing shelf must not break the child's own space.
  final Future<List<EarnedSticker>> Function()? loadStickers;

  /// Keeps one drawing in private family storage.
  ///
  /// Optional: when absent no cloud action is offered at all, which is the correct
  /// state for a build with no storage configured. Returning a message means the
  /// attempt did not succeed and the message explains why — most often that the
  /// parent has not granted consent yet.
  final Future<String?> Function(LocalCreation creation)? onKeepInAlbum;

  /// Removes the stored copy, leaving the device copy.
  final Future<String?> Function(LocalCreation creation)? onRemoveFromAlbum;

  @override
  State<MyCollectionPage> createState() => _MyCollectionPageState();
}

class _MyCollectionPageState extends State<MyCollectionPage> {
  List<LocalCreation> _creations = const [];
  List<EarnedSticker> _stickers = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final creations = await widget.creationStore.list(widget.childId);
    List<EarnedSticker> stickers = const [];
    if (widget.loadStickers != null) {
      try {
        stickers = await widget.loadStickers!();
      } catch (_) {
        stickers = const [];
      }
    }
    if (!mounted) return;
    setState(() {
      _creations = creations;
      _stickers = stickers;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('مجموعتي'),
          bottom: const TabBar(
            tabs: [
              Tab(text: 'رسوماتي', icon: Icon(Icons.brush_outlined)),
              Tab(text: 'ملصقاتي', icon: Icon(Icons.star_outline)),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : TabBarView(
                children: [
                  _DrawingsShelf(
                    creations: _creations,
                    onDelete: _deleteCreation,
                    onKeepInAlbum: widget.onKeepInAlbum == null ? null : _keepInAlbum,
                    onRemoveFromAlbum:
                        widget.onRemoveFromAlbum == null ? null : _removeFromAlbum,
                  ),
                  _StickersShelf(stickers: _stickers),
                ],
              ),
      ),
    );
  }

  Future<void> _deleteCreation(LocalCreation creation) async {
    await widget.creationStore.delete(widget.childId, creation.id);
    if (!mounted) return;
    setState(() {
      _creations = _creations.where((entry) => entry.id != creation.id).toList(growable: false);
    });
  }

  /// Keeps one drawing in family storage, then reloads so the badge reflects it.
  ///
  /// A returned message is shown as-is rather than translated into a generic
  /// failure: the most common one is that consent has not been granted, and that is
  /// something a parent can act on.
  Future<void> _keepInAlbum(LocalCreation creation) async {
    final message = await widget.onKeepInAlbum!(creation);
    if (!mounted) return;
    if (message != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      return;
    }
    await _load();
  }

  Future<void> _removeFromAlbum(LocalCreation creation) async {
    final message = await widget.onRemoveFromAlbum!(creation);
    if (!mounted) return;
    if (message != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      return;
    }
    await _load();
  }
}

class _DrawingsShelf extends StatelessWidget {
  const _DrawingsShelf({
    required this.creations,
    required this.onDelete,
    this.onKeepInAlbum,
    this.onRemoveFromAlbum,
  });

  final List<LocalCreation> creations;
  final ValueChanged<LocalCreation> onDelete;
  final ValueChanged<LocalCreation>? onKeepInAlbum;
  final ValueChanged<LocalCreation>? onRemoveFromAlbum;

  @override
  Widget build(BuildContext context) {
    if (creations.isEmpty) {
      return const _EmptyShelf(
        icon: Icons.brush_outlined,
        title: 'لا رسومات بعد',
        body: 'ارسم أو لوّن في إحدى الألعاب، ثم اضغط «احفظ رسمتي».',
      );
    }

    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 220,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
      ),
      itemCount: creations.length,
      itemBuilder: (context, index) {
        final creation = creations[index];
        return Semantics(
          label: 'رسمة',
          child: Card(
            clipBehavior: Clip.antiAlias,
            child: Stack(
              fit: StackFit.expand,
              children: [
                // Decoded from the device copy. There is no network image here:
                // the local file is the primary copy.
                Image.memory(creation.bytes, fit: BoxFit.contain),
                Positioned(
                  top: 4,
                  right: 4,
                  child: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    tooltip: 'احذف',
                    onPressed: () => onDelete(creation),
                  ),
                ),
                if (creation.isUploaded)
                  Positioned(
                    bottom: 4,
                    left: 4,
                    child: onRemoveFromAlbum == null
                        ? const Icon(Icons.cloud_done_outlined, size: 18)
                        : IconButton(
                            icon: const Icon(Icons.cloud_done, size: 18),
                            tooltip: 'أزِل من ألبوم العائلة',
                            onPressed: () => onRemoveFromAlbum!(creation),
                          ),
                  )
                else if (onKeepInAlbum != null)
                  Positioned(
                    bottom: 4,
                    left: 4,
                    child: IconButton(
                      // Explicit, per drawing. Nothing is uploaded automatically and
                      // the device copy is unaffected either way.
                      icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                      tooltip: 'احفظ في ألبوم العائلة',
                      onPressed: () => onKeepInAlbum!(creation),
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StickersShelf extends StatelessWidget {
  const _StickersShelf({required this.stickers});

  final List<EarnedSticker> stickers;

  @override
  Widget build(BuildContext context) {
    if (stickers.isEmpty) {
      return const _EmptyShelf(
        icon: Icons.star_outline,
        title: 'لا ملصقات بعد',
        body: 'أكمل لعبة لتحصل على ملصق. الملصق لا يُفقد أبدًا.',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: stickers.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final sticker = stickers[index];
        return ListTile(
          leading: const Icon(Icons.star, size: 32),
          title: Text(sticker.rewardKey),
          subtitle: Text(sticker.sourceId),
        );
      },
    );
  }
}

class _EmptyShelf extends StatelessWidget {
  const _EmptyShelf({required this.icon, required this.title, required this.body});

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 56),
            const SizedBox(height: 12),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text(body, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}
