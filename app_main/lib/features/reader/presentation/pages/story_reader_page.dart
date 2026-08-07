import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/domain/content_models.dart';

enum ReadingMode { readMyself, readToMe, readTogether, silent }

class StoryReaderPage extends StatefulWidget {
  const StoryReaderPage({required this.series, super.key});
  final SeriesItem series;

  @override
  State<StoryReaderPage> createState() => _StoryReaderPageState();
}

class _StoryReaderPageState extends State<StoryReaderPage> {
  final PageController _ctrl = PageController();
  int _page = 0;
  ReadingMode _mode = ReadingMode.readMyself;
  String _lang = 'ar';
  bool _isPlaying = false;
  bool _showText = true;
  bool _modeChosen = false;

  final _pages = const [
    {
      'ar': 'كان يا ما كان، في قديم الزمان، كان هناك غابة جميلة مليئة بالأشجار العالية والأزهار الملونة.',
      'en': 'Once upon a time, there was a beautiful forest full of tall trees and colorful flowers.',
      'image': '🌳'
    },
    {
      'ar': 'في هذه الغابة عاش أرنب صغير يحب المغامرة والاستكشاف كل يوم.',
      'en': 'In this forest lived a little rabbit who loved adventure every day.',
      'image': '🐰'
    },
    {
      'ar': 'في أحد الأيام، وجد الأرنب خريطة قديمة تدل على كنز مخفي.',
      'en': 'One day, the rabbit found an old map pointing to a hidden treasure.',
      'image': '🗺️'
    },
    {
      'ar': 'انطلق الأرنب في رحلته، وتعلم أن الشجاعة والتعاون هما سر النجاح.',
      'en': 'The rabbit set off and learned that courage and cooperation are the key to success.',
      'image': '⭐'
    },
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _showModePicker());
  }

  void _showModePicker() {
    if (_modeChosen) return;
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0B1026),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(width: 36, height: 4, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.18), borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 16),
            const Text('كيف تريد القراءة؟', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 14),
            _ModeTile(icon: Icons.person_rounded, title: 'اقرأ بنفسي', subtitle: 'أقلب الصفحات بنفسي', onTap: () => _choose(ReadingMode.readMyself)),
            _ModeTile(icon: Icons.volume_up_rounded, title: 'اقرأ لي', subtitle: 'الراوي يقرأ وتتقلب الصفحات تلقائياً', onTap: () => _choose(ReadingMode.readToMe)),
            _ModeTile(icon: Icons.groups_rounded, title: 'اقرأ معي', subtitle: 'تظليل الجملة مع الصوت', onTap: () => _choose(ReadingMode.readTogether)),
            _ModeTile(icon: Icons.visibility_off_rounded, title: 'قصة صامتة', subtitle: 'صور فقط لتنمية الملاحظة', onTap: () => _choose(ReadingMode.silent)),
          ],
        ),
      ),
    );
  }

  void _choose(ReadingMode m) {
    Navigator.pop(context);
    setState(() {
      _mode = m;
      _modeChosen = true;
      _showText = m != ReadingMode.silent;
      if (m == ReadingMode.readToMe) _isPlaying = true;
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isComic = widget.series.type == 'anthology';
    final isTablet = MediaQuery.sizeOf(context).width >= 600;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Column(
            children: [
              // AppBar
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
                    const SizedBox(width: 8),
                    Expanded(child: Text(widget.series.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    const SizedBox(width: 8),
                    // Language switch
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(8)),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: _lang,
                          dropdownColor: const Color(0xFF0B1026),
                          style: const TextStyle(color: Colors.white, fontSize: 11),
                          icon: const Icon(Icons.language_rounded, color: Colors.white, size: 14),
                          items: const [DropdownMenuItem(value: 'ar', child: Text('العربية')), DropdownMenuItem(value: 'en', child: Text('English')), DropdownMenuItem(value: 'fr', child: Text('Français'))],
                          onChanged: (v) => setState(() => _lang = v ?? 'ar'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 6),
                    IconButton(icon: Icon(_mode == ReadingMode.silent ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: Colors.white, size: 18), onPressed: () => setState(() => _showText = !_showText)),
                  ],
                ),
              ),
              // Mode banner
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: _modeColor().withValues(alpha: 0.14), borderRadius: BorderRadius.circular(8), border: Border.all(color: _modeColor().withValues(alpha: 0.22))),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(_modeIcon(), color: _modeColor(), size: 14),
                      const SizedBox(width: 6),
                      Text(_modeLabel(), style: TextStyle(color: _modeColor(), fontSize: 11, fontWeight: FontWeight.w700)),
                      const SizedBox(width: 8),
                      TextButton(onPressed: _showModePicker, style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(0, 0)), child: Text('تغيير', style: TextStyle(color: Colors.white.withValues(alpha: 0.72), fontSize: 10))),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 8),
              // Progress
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: ClipRRect(borderRadius: BorderRadius.circular(99), child: LinearProgressIndicator(value: (_page + 1) / _pages.length, backgroundColor: Colors.white.withValues(alpha: 0.08), valueColor: AlwaysStoppedAnimation(_modeColor()), minHeight: 4)),
              ),
              const SizedBox(height: 8),
              Center(child: Text('${_page + 1} / ${_pages.length}', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11))),
              const SizedBox(height: 12),
              // Reader
              Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(horizontal: isTablet ? 32 : 18),
                  child: isTablet && !isComic
                      ? Row(
                          children: [
                            Expanded(child: _PageCard(page: _pages[_page], showText: _showText, lang: _lang, mode: _mode, isComic: false)),
                            const SizedBox(width: 12),
                            Expanded(child: _PageCard(page: _page < _pages.length - 1 ? _pages[_page + 1] : null, showText: _showText, lang: _lang, mode: _mode, isComic: false)),
                          ],
                        )
                      : PageView.builder(
                          controller: _ctrl,
                          onPageChanged: (i) {
                            setState(() => _page = i);
                            if (_mode == ReadingMode.readToMe) setState(() => _isPlaying = true);
                          },
                          itemCount: _pages.length,
                          itemBuilder: (context, idx) => Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: _PageCard(page: _pages[idx], showText: _showText, lang: _lang, mode: _mode, isComic: isComic),
                          ),
                        ),
                ),
              ),
              // Controls
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 12, 18, 16),
                child: Row(
                  children: [
                    IconButton(onPressed: _page > 0 ? () => _ctrl.previousPage(duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic) : null, icon: Icon(Icons.arrow_forward_rounded, color: _page > 0 ? Colors.white : AppColors.mutedText.withValues(alpha: 0.32))),
                    Expanded(
                      child: Center(
                        child: _mode == ReadingMode.readMyself
                            ? Text('اسحب للتقليب', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.52), fontSize: 11))
                            : _mode == ReadingMode.silent
                                ? Text('لاحظ التفاصيل', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.52), fontSize: 11))
                                : FilledButton.icon(
                                    onPressed: () => setState(() => _isPlaying = !_isPlaying),
                                    style: FilledButton.styleFrom(backgroundColor: _modeColor(), foregroundColor: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))),
                                    icon: Icon(_isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 20),
                                    label: Text(_isPlaying ? 'إيقاف' : 'استماع'),
                                  ),
                      ),
                    ),
                    IconButton(onPressed: _page < _pages.length - 1 ? () => _ctrl.nextPage(duration: const Duration(milliseconds: 320), curve: Curves.easeOutCubic) : null, icon: Icon(Icons.arrow_back_rounded, color: _page < _pages.length - 1 ? Colors.white : AppColors.mutedText.withValues(alpha: 0.32))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Color _modeColor() => switch (_mode) {
        ReadingMode.readMyself => AppColors.mutedText,
        ReadingMode.readToMe => AppColors.starGold,
        ReadingMode.readTogether => AppColors.electricCyan,
        ReadingMode.silent => AppColors.cosmicPurple,
      };

  IconData _modeIcon() => switch (_mode) {
        ReadingMode.readMyself => Icons.person_rounded,
        ReadingMode.readToMe => Icons.volume_up_rounded,
        ReadingMode.readTogether => Icons.groups_rounded,
        ReadingMode.silent => Icons.visibility_off_rounded,
      };

  String _modeLabel() => switch (_mode) {
        ReadingMode.readMyself => 'اقرأ بنفسي',
        ReadingMode.readToMe => 'اقرأ لي',
        ReadingMode.readTogether => 'اقرأ معي',
        ReadingMode.silent => 'قصة صامتة',
      };
}

class _ModeTile extends StatelessWidget {
  const _ModeTile({required this.icon, required this.title, required this.subtitle, required this.onTap});
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => ListTile(
        leading: Container(width: 40, height: 40, decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.indigoSurface), child: Icon(icon, color: Colors.white)),
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
        subtitle: Text(subtitle, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 11)),
        trailing: const Icon(Icons.chevron_left_rounded, color: AppColors.mutedText),
        onTap: onTap,
      );
}

class _PageCard extends StatelessWidget {
  const _PageCard({required this.page, required this.showText, required this.lang, required this.mode, this.isComic = false});
  final Map<String, String>? page;
  final bool showText;
  final String lang;
  final ReadingMode mode;
  final bool isComic;

  @override
  Widget build(BuildContext context) {
    if (page == null) return Container(decoration: BoxDecoration(color: const Color(0xFF0B1026).withValues(alpha: 0.42), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: 0.04))));
    final text = page![lang] ?? page!['ar'] ?? '';
    return Container(
      decoration: BoxDecoration(color: const Color(0xFF111A3A).withValues(alpha: 0.92), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.white.withValues(alpha: 0.08)), boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.22), blurRadius: 16)]),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Expanded(child: Center(child: Text(page!['image']!, style: TextStyle(fontSize: isComic ? 64 : 52)))),
          if (showText) ...[
            Container(height: 1, color: Colors.white.withValues(alpha: 0.06), margin: const EdgeInsets.symmetric(vertical: 14)),
            Text(
              text,
              textAlign: TextAlign.center,
              textDirection: lang == 'ar' ? TextDirection.rtl : TextDirection.ltr,
              style: TextStyle(
                color: mode == ReadingMode.readTogether ? AppColors.starGold : Colors.white.withValues(alpha: 0.92),
                fontSize: isComic ? 13 : 15,
                height: 1.8,
                fontWeight: FontWeight.w600,
                backgroundColor: mode == ReadingMode.readTogether ? AppColors.starGold.withValues(alpha: 0.08) : null,
              ),
            ),
            if (mode == ReadingMode.readTogether) ...[
              const SizedBox(height: 8),
              Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4), decoration: BoxDecoration(color: AppColors.electricCyan.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(6)), child: Text('تظليل الجملة الحالية', style: TextStyle(color: AppColors.electricCyan, fontSize: 10, fontWeight: FontWeight.w600))),
            ],
          ] else
            Padding(
              padding: const EdgeInsets.only(top: 14),
              child: Text('لاحظ التفاصيل في الصورة', textAlign: TextAlign.center, style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.62), fontSize: 11, fontStyle: FontStyle.italic)),
            ),
        ],
      ),
    );
  }
}
