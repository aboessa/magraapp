import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme/app_colors.dart';
import '../../../core/layout/app_layout.dart';
import '../../../core/widgets/cinematic_background.dart';
import '../../home/domain/content_models.dart';
import '../../home/presentation/widgets/content_cards.dart';

class SearchPage extends StatefulWidget {
  const SearchPage({required this.catalog, required this.isTelevision, super.key});
  final HomeCatalog catalog;
  final bool isTelevision;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  final TextEditingController _ctrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final padding = context.horizontalPagePadding;
    final query = _query.trim().toLowerCase();
    final filtered = query.isEmpty
        ? <SeriesItem>[]
        : widget.catalog.series.where((s) => s.title.toLowerCase().contains(query) || s.description.toLowerCase().contains(query)).toList();

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
                onChanged: (v) => setState(() => _query = v),
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'ابحث عن مسلسل، قصة، أو شخصية...',
                  hintStyle: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.6)),
                  prefixIcon: const Icon(Icons.search_rounded, color: AppColors.mutedText),
                  suffixIcon: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: Icon(Icons.mic_rounded, color: _query.isNotEmpty ? AppColors.mutedText : AppColors.starGold),
                        tooltip: 'بحث صوتي',
                        onPressed: () async {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('البحث الصوتي - اضغط مطولاً على بوابة مجرة')));
                          // Long-press portal is the alternative access
                        },
                      ),
                      if (_query.isNotEmpty) IconButton(icon: const Icon(Icons.clear_rounded, color: AppColors.mutedText), onPressed: () => setState(() { _ctrl.clear(); _query = ''; })),
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
          if (query.isEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 20, padding, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('جرب البحث عن', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: ['مغامرات', 'حكايات', 'علوم', 'أرقام', 'القصص'].map((t) => ActionChip(
                            label: Text(t),
                            onPressed: () => setState(() { _ctrl.text = t; _query = t; }),
                            backgroundColor: const Color(0xFF111A3A),
                            labelStyle: const TextStyle(color: Colors.white, fontSize: 12),
                            side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
                          )).toList(),
                    ),
                  ],
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsetsDirectional.fromSTEB(padding, 28, padding, 0),
                child: Text('اقتراحات', style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white)),
              ),
            ),
            SliverPadding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 14, padding, 0),
              sliver: SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: widget.isTelevision ? 4 : 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
                delegate: SliverChildBuilderDelegate((context, index) {
                  final item = widget.catalog.series[index % widget.catalog.series.length];
                  return SeriesCard(item: item, isTelevision: widget.isTelevision, onPressed: () => context.push('/series/${item.id}'));
                }, childCount: 6),
              ),
            ),
          ] else if (filtered.isEmpty) ...[
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.search_off_rounded, color: AppColors.mutedText, size: 48),
                    const SizedBox(height: 12),
                    Text('لا نتائج لـ "$_query"', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 6),
                    Text('جرب كلمات أخرى', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.7))),
                  ]),
                ),
              ),
            ),
          ] else ...[
            SliverPadding(
              padding: EdgeInsetsDirectional.fromSTEB(padding, 18, padding, 0),
              sliver: SliverGrid(
                gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: widget.isTelevision ? 4 : 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.72),
                delegate: SliverChildBuilderDelegate((context, index) {
                  final item = filtered[index];
                  return SeriesCard(item: item, isTelevision: widget.isTelevision, onPressed: () => context.push('/series/${item.id}'));
                }, childCount: filtered.length),
              ),
            ),
          ],
          SliverToBoxAdapter(child: SizedBox(height: widget.isTelevision ? 32 : 98)),
        ],
      ),
    );
  }
}
