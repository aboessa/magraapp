import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/analytics/analytics.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/speech/voice_search.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../../core/widgets/cinematic_image.dart';
import '../../child/application/child_provider.dart';
import '../../home/domain/content_models.dart';
import '../data/recent_searches_store.dart';
import '../domain/search_engine.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({
    required this.catalog,
    required this.isTelevision,
    super.key,
  });

  final HomeCatalog catalog;
  final bool isTelevision;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final TextEditingController _controller = TextEditingController();
  String _query = '';
  String _debouncedQuery = '';
  SearchResultKind? _selectedKind;
  Timer? _debounce;

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _setQuery(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (!mounted) return;
      setState(() => _debouncedQuery = value);
    });
    setState(() => _query = value);
  }

  Future<void> _remember(String query) async {
    final childId = ref.read(childProvider).activeChildId;
    await ref.read(recentSearchesStoreProvider).add(query, childId: childId);
    ref.invalidate(recentSearchesProvider(childId));
  }

  void _openResult(SearchResult result) {
    unawaited(_remember(_query));
    context.push(result.route);
  }

  @override
  Widget build(BuildContext context) {
    final childId = ref.watch(childProvider).activeChildId;
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final pagePadding = context.horizontalPagePadding;
    final padding =
        (viewportWidth > 960
                ? ((viewportWidth - 900) / 2).clamp(
                    pagePadding,
                    double.infinity,
                  )
                : pagePadding)
            .toDouble();
    final hasQuery = _query.trim().isNotEmpty;
    // Debounced query drives actual search catalog computation
    final effectiveQuery = _debouncedQuery.trim().isEmpty
        ? _query
        : _debouncedQuery;
    final kinds = _selectedKind == null
        ? const <SearchResultKind>{}
        : {_selectedKind!};
    final results = searchCatalog(widget.catalog, effectiveQuery, kinds: kinds);

    return CinematicBackground(
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            toolbarHeight: widget.isTelevision ? 82 : 72,
            backgroundColor: const Color(0xFF0B1026).withValues(alpha: 0.88),
            surfaceTintColor: Colors.transparent,
            titleSpacing: padding,
            title: Text(
              'بحث',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 16, padding, 0),
              child: TextField(
                controller: _controller,
                autofocus: !widget.isTelevision,
                textInputAction: TextInputAction.search,
                onChanged: _setQuery,
                onSubmitted: (value) {
                  if (value.trim().isEmpty) return;
                  unawaited(_remember(value));
                  MajarraAnalytics.searchPerformed(
                    resultCount: searchCatalog(widget.catalog, value).length,
                  );
                },
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'ابحث عن مسلسل، حلقة، لعبة، قصة، كتاب، أو كوكب...',
                  hintStyle: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.6),
                  ),
                  prefixIcon: const Icon(
                    Icons.search_rounded,
                    color: AppColors.mutedText,
                  ),
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _VoiceSearchButton(
                        onTranscript: (text) {
                          _controller.text = text;
                          _controller.selection = TextSelection.collapsed(
                            offset: text.length,
                          );
                          _setQuery(text);
                        },
                      ),
                      if (_query.isNotEmpty)
                        IconButton(
                          icon: const Icon(
                            Icons.clear_rounded,
                            color: AppColors.mutedText,
                          ),
                          tooltip: 'مسح البحث',
                          onPressed: () {
                            _controller.clear();
                            setState(() {
                              _query = '';
                              _selectedKind = null;
                            });
                          },
                        ),
                    ],
                  ),
                  filled: true,
                  fillColor: const Color(0xFF111A3A).withValues(alpha: 0.88),
                  border: _fieldBorder(),
                  enabledBorder: _fieldBorder(),
                  focusedBorder: _fieldBorder(
                    color: AppColors.electricCyan,
                    width: 2,
                  ),
                ),
              ),
            ),
          ),
          if (hasQuery) _buildFilters(padding),
          if (!hasQuery)
            ..._buildIdleState(context, padding, childId)
          else if (results.isEmpty)
            _buildEmptyState(context)
          else
            ..._buildResults(context, padding, results),
          SliverToBoxAdapter(
            child: SizedBox(height: widget.isTelevision ? 32 : 98),
          ),
        ],
      ),
    );
  }

  OutlineInputBorder _fieldBorder({
    Color color = const Color(0x14FFFFFF),
    double width = 1,
  }) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(14),
      borderSide: BorderSide(color: color, width: width),
    );
  }

  Widget _buildFilters(double padding) {
    final available = <SearchResultKind>[
      if (widget.catalog.series.isNotEmpty) SearchResultKind.series,
      if (widget.catalog.episodes.isNotEmpty) SearchResultKind.episode,
      if (widget.catalog.experiences.any((item) => item.isServerBacked))
        SearchResultKind.game,
      if (widget.catalog.stories.isNotEmpty) SearchResultKind.story,
      if (widget.catalog.books.isNotEmpty) SearchResultKind.book,
      if (widget.catalog.planets.isNotEmpty) SearchResultKind.planet,
    ];
    if (available.length < 2) return const SliverToBoxAdapter();

    return SliverToBoxAdapter(
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 0),
        child: Row(
          children: [
            ChoiceChip(
              label: const Text('الكل'),
              selected: _selectedKind == null,
              onSelected: (_) => setState(() => _selectedKind = null),
            ),
            for (final kind in available) ...[
              const SizedBox(width: 8),
              ChoiceChip(
                label: Text(_kindLabel(kind)),
                selected: _selectedKind == kind,
                onSelected: (_) => setState(() => _selectedKind = kind),
              ),
            ],
          ],
        ),
      ),
    );
  }

  List<Widget> _buildIdleState(
    BuildContext context,
    double padding,
    String? childId,
  ) {
    final recent =
        ref.watch(recentSearchesProvider(childId)).valueOrNull ?? const [];
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
                      child: Text(
                        'عمليات البحث الأخيرة',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () async {
                        await ref
                            .read(recentSearchesStoreProvider)
                            .clear(childId: childId);
                        ref.invalidate(recentSearchesProvider(childId));
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
                    for (final query in recent)
                      ActionChip(
                        avatar: const Icon(
                          Icons.history_rounded,
                          size: 16,
                          color: AppColors.mutedText,
                        ),
                        label: Text(query),
                        onPressed: () {
                          _controller.text = query;
                          _controller.selection = TextSelection.collapsed(
                            offset: query.length,
                          );
                          _setQuery(query);
                        },
                        backgroundColor: const Color(0xFF111A3A),
                        labelStyle: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                        ),
                        side: BorderSide(
                          color: Colors.white.withValues(alpha: 0.08),
                        ),
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
          child: const Text(
            'جرّب البحث عن',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
          ),
        ),
      ),
      SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsetsDirectional.fromSTEB(padding, 12, padding, 0),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: ['مغامرات', 'حكايات', 'علوم', 'أرقام', 'القصص']
                .map(
                  (term) => ActionChip(
                    label: Text(term),
                    onPressed: () {
                      _controller.text = term;
                      _controller.selection = TextSelection.collapsed(
                        offset: term.length,
                      );
                      _setQuery(term);
                    },
                    backgroundColor: const Color(0xFF111A3A),
                    labelStyle: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                    ),
                    side: BorderSide(
                      color: Colors.white.withValues(alpha: 0.08),
                    ),
                  ),
                )
                .toList(growable: false),
          ),
        ),
      ),
    ];
  }

  Widget _buildEmptyState(BuildContext context) {
    return SliverFillRemaining(
      hasScrollBody: false,
      child: Center(
        child: Semantics(
          liveRegion: true,
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.search_off_rounded,
                  color: AppColors.mutedText,
                  size: 48,
                ),
                const SizedBox(height: 12),
                Text(
                  'لا نتائج لـ "${_query.trim()}"',
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 6),
                Text(
                  _selectedKind == null
                      ? 'جرّب كلمات أخرى أو تحقّق من الإملاء'
                      : 'لا توجد نتائج في هذا النوع. اختر «الكل» أو جرّب كلمة أخرى.',
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.7),
                  ),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  List<Widget> _buildResults(
    BuildContext context,
    double padding,
    List<SearchResult> results,
  ) {
    const order = [
      SearchResultKind.series,
      SearchResultKind.episode,
      SearchResultKind.game,
      SearchResultKind.story,
      SearchResultKind.book,
      SearchResultKind.planet,
    ];
    final slivers = <Widget>[];
    for (final kind in order) {
      final group = results.where((result) => result.kind == kind).toList();
      if (group.isEmpty) continue;
      slivers.add(
        SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsetsDirectional.fromSTEB(padding, 20, padding, 6),
            child: Text(
              '${_kindLabel(kind)} · ${group.length}',
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: Colors.white),
            ),
          ),
        ),
      );
      slivers.add(
        SliverList.builder(
          itemCount: group.length,
          itemBuilder: (context, index) => _ResultTile(
            result: group[index],
            padding: padding,
            autofocus: widget.isTelevision && slivers.length == 2 && index == 0,
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
    SearchResultKind.game => 'ألعاب',
    SearchResultKind.story => 'قصص مصورة',
    SearchResultKind.book => 'كتب وصوتيات',
    SearchResultKind.planet => 'كواكب',
  };
}

class _ResultTile extends StatefulWidget {
  const _ResultTile({
    required this.result,
    required this.padding,
    required this.onTap,
    required this.autofocus,
  });

  final SearchResult result;
  final double padding;
  final VoidCallback onTap;
  final bool autofocus;

  @override
  State<_ResultTile> createState() => _ResultTileState();
}

class _ResultTileState extends State<_ResultTile> {
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final forwardIcon = Directionality.of(context) == TextDirection.rtl
        ? Icons.chevron_left_rounded
        : Icons.chevron_right_rounded;
    return Padding(
      padding: EdgeInsetsDirectional.fromSTEB(
        widget.padding,
        4,
        widget.padding,
        4,
      ),
      child: Semantics(
        button: true,
        label: '${result.title}، ${result.subtitle}',
        child: Material(
          color: const Color(0xFF111A3A).withValues(alpha: 0.74),
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            autofocus: widget.autofocus,
            onTap: widget.onTap,
            onFocusChange: (focused) => setState(() => _focused = focused),
            borderRadius: BorderRadius.circular(14),
            focusColor: AppColors.electricCyan.withValues(alpha: 0.12),
            child: AnimatedContainer(
              duration: MediaQuery.disableAnimationsOf(context)
                  ? Duration.zero
                  : const Duration(milliseconds: 120),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _focused
                      ? AppColors.electricCyan
                      : Colors.white.withValues(alpha: 0.06),
                  width: _focused ? 2.5 : 1,
                ),
              ),
              child: ListTile(
                contentPadding: const EdgeInsetsDirectional.fromSTEB(
                  10,
                  6,
                  12,
                  6,
                ),
                leading: ExcludeSemantics(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: SizedBox(
                      width: 68,
                      height: 54,
                      child: CinematicImage(
                        assetPath: result.imageAsset,
                        networkUrl: result.imageUrl,
                        semanticLabel: result.title,
                        decodeWidth: 68,
                      ),
                    ),
                  ),
                ),
                title: Text(
                  result.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                subtitle: Text(
                  result.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.mutedText.withValues(alpha: 0.76),
                  ),
                ),
                trailing: Icon(forwardIcon, color: AppColors.mutedText),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

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
        final available = await controller.start(onTranscript);
        MajarraAnalytics.voiceSearchUsed(available: available);
        if (!context.mounted || available) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'البحث الصوتي غير متاح — تأكّد من إذن الميكروفون، أو استخدم لوحة المفاتيح.',
            ),
          ),
        );
      },
    );
  }
}
