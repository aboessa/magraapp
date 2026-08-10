import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/analytics/analytics.dart';
import '../../../core/speech/voice_search.dart';
import '../../home/domain/content_models.dart';
import '../data/recent_searches_store.dart';
import '../domain/search_engine.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({required this.catalog, required this.isTelevision, super.key});
  final HomeCatalog catalog;
  final bool isTelevision;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final TextEditingController _ctrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _setQuery(String value) => setState(() => _query = value);

  /// Records a query the user actually acted on (opened a result or submitted).
  Future<void> _remember(String query) async {
    final store = ref.read(recentSearchesStoreProvider);
    await store.add(query);
    ref.invalidate(recentSearchesProvider);
  }

  void _openResult(SearchResult result) {
    _remember(_query);
    context.push(result.route);
  }

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding;
    final results = searchCatalog(widget.catalog, _query);
    final hasQuery = _query.trim().isNotEmpty;

    return CinematicBackground(
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            toolbarHeight: widget.isTelevision ? 82 : 72,
            backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
            titleSpacing: padding,
            title: Text('بحث', style: Theme.of(context).textTheme.headlineMedium),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 16, padding, 0),
              child: TextField(
                controller: _ctrl,
                autofocus: !widget.isTelevision,
                textInputAction: TextInputAction.search,
                onChanged: _setQuery,
                onSubmitted: (v) {
                  if (v.trim().isEmpty) return;
                  _remember(v);
                  // Measured by outcome only — the typed text is never sent.
                  MajarraAnalytics.searchPerformed(
                    resultCount: searchCatalog(widget.catalog, v).length,
                  );
                },
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'ابحث عن مسلسل، حلقة، قصة، لعبة، أو كوكب...',
                  hintStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.6)),
                  prefixIcon: const Icon(Icons.search_rounded, color: AppColors.mutedText),
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _VoiceSearchButton(
                        onTranscript: (text) {
                          _ctrl.text = text;
                          _ctrl.selection = TextSelection.collapsed(offset: text.length);
                          _setQuery(text);
                        },
                      ),
                      if (_query.isNotEmpty)
                        IconButton(
                          icon: const Icon(Icons.clear_rounded, color: AppColors.mutedText),
                          tooltip: 'مسح',
                          onPressed: () {
                            _ctrl.clear();
                            _setQuery('');
                          },
                        ),
                    ],
                  ),
                  filled: true,
                  fillColor: const Color(0xFF111A3A).withValues(alpha: 0.88),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide(color: Colors.white.withValues(alpha: 0.08))),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppColors.electricCyan)),
                ),
              ),
            ),
          ),
          if (!hasQuery)
            ..._buildIdleState(context, padding)
          else if (results.isEmpty)
            _buildEmptyState(context)
          else
            ..._buildResults(context, padding, results),
          SliverToBoxAdapter(child: SizedBox(height: widget.isTelevision ? 32 : 98)),
        ],
      ),
    );
  }

  List<Widget> _buildIdleState(BuildContext context, double padding) {
    final recent = ref.watch(recentSearchesProvider).valueOrNull ?? const [];
    return [
      if (recent.isNotEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 20, padding, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text('عمليات البحث الأخيرة',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    ),
                    TextButton(
                      onPressed: () async {
                        await ref.read(recentSearchesStoreProvider).clear();
                        ref.invalidate(recentSearchesProvider);
                      },
                      child: const Text('مسح'),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final q in recent)
                      ActionChip(
                        avatar: const Icon(Icons.history_rounded, size: 16, color: AppColors.mutedText),
                        label: Text(q),
                        onPressed: () {
                          _ctrl.text = q;
                          _setQuery(q);
                        },
                        backgroundColor: const Color(0xFF111A3A),
                        labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                        side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(padding, 24, padding, 0),
          child: const Text('جرّب البحث عن',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ),
      ),
      SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 0),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['مغامرات', 'حكايات', 'علوم', 'أرقام', 'القصص']
                .map((t) => ActionChip(
                      label: Text(t),
                      onPressed: () {
                        _ctrl.text = t;
                        _setQuery(t);
                      },
                      backgroundColor: const Color(0xFF111A3A),
                      labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                      side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                    ))
                .toList(),
          ),
        ),
      ),
    ];
  }

  Widget _buildEmptyState(BuildContext context) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.search_off_rounded, color: AppColors.mutedText, size: 48),
            const SizedBox(height: 12),
            Text('لا نتائج لـ "${_query.trim()}"', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            Text('جرّب كلمات أخرى أو تحقّق من الإملاء',
                style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7))),
          ]),
        ),
      ),
    );
  }

  List<Widget> _buildResults(BuildContext context, double padding, List<SearchResult> results) {
    // Group by kind so results read as sections (مسلسلات / حلقات / قصص / ألعاب / كواكب).
    const order = [
      SearchResultKind.series,
      SearchResultKind.episode,
      SearchResultKind.book,
      SearchResultKind.game,
      SearchResultKind.planet,
    ];
    final slivers = <Widget>[];
    for (final kind in order) {
      final group = results.where((r) => r.kind == kind).toList();
      if (group.isEmpty) continue;
      slivers.add(
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 20, padding, 6),
            child: Text('${_kindLabel(kind)} · ${group.length}',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white)),
          ),
        ),
      );
      slivers.add(
        SliverList.builder(
          itemCount: group.length,
          itemBuilder: (context, index) => _ResultTile(
            result: group[index],
            padding: padding,
            onTap: () => _openResult(group[index]),
          ),
        ),
      );
    }
    return slivers;
  }

  String _kindLabel(SearchResultKind kind) => switch (kind) {
        SearchResultKind.series => 'مسلسلات',
        SearchResultKind.episode => 'حلقات',
        SearchResultKind.book => 'قصص',
        SearchResultKind.game => 'ألعاب',
        SearchResultKind.planet => 'كواكب',
      };
}

class _ResultTile extends StatelessWidget {
  const _ResultTile({required this.result, required this.padding, required this.onTap});

  final SearchResult result;
  final double padding;
  final VoidCallback onTap;

  IconData get _icon => switch (result.kind) {
        SearchResultKind.series => Icons.movie_rounded,
        SearchResultKind.episode => Icons.play_circle_rounded,
        SearchResultKind.book => Icons.menu_book_rounded,
        SearchResultKind.game => Icons.videogame_asset_rounded,
        SearchResultKind.planet => Icons.public_rounded,
      };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(padding, 4, padding, 4),
      child: Material(
        color: const Color(0xFF111A3A).withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        child: ListTile(
          leading: CircleAvatar(
            backgroundColor: AppColors.royalBlue.withValues(alpha: 0.3),
            child: Icon(_icon, color: AppColors.electricCyan, size: 20),
          ),
          title: Text(result.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          subtitle: Text(result.subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7))),
          trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.mutedText),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          onTap: onTap,
        ),
      ),
    );
  }
}


/// Microphone control for voice search (§9).
///
/// Tapping starts a time-bounded listening session through
/// [voiceSearchControllerProvider]; the transcript flows into the search field
/// as it arrives. While listening the icon pulses; if recognition is
/// unavailable (permission denied or no engine) a short notice explains that
/// the keyboard still works, and nothing pretends to transcribe.
class _VoiceSearchButton extends ConsumerWidget {
  const _VoiceSearchButton({required this.onTranscript});

  final ValueChanged<String> onTranscript;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(voiceSearchControllerProvider);
    final controller = ref.read(voiceSearchControllerProvider.notifier);
    final listening = state.isListening;

    return IconButton(
      icon: Icon(
        listening ? Icons.mic_rounded : Icons.mic_none_rounded,
        color: listening ? AppColors.starGold : AppColors.mutedText,
      ),
      tooltip: listening ? 'إيقاف الاستماع' : 'بحث صوتي',
      onPressed: () async {
        final ok = await controller.start(onTranscript);
        MajarraAnalytics.voiceSearchUsed(available: ok);
        if (!context.mounted) return;
        if (!ok) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'البحث الصوتي غير متاح — تأكّد من إذن الميكروفون، أو استخدم لوحة المفاتيح.',
              ),
            ),
          );
        }
      },
    );
  }
}
