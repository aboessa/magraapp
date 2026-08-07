import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../../home/domain/content_models.dart';

class GamePage extends StatefulWidget {
  const GamePage({required this.experience, super.key});
  final ExperienceItem experience;

  @override
  State<GamePage> createState() => _GamePageState();
}

class _GamePageState extends State<GamePage> {
  int _score = 0;
  int _level = 1;
  bool _hintUsed = false;
  final _selected = <int>{};
  final _cards = List.generate(8, (i) => i % 4);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  children: [
                    IconButton(icon: const Icon(Icons.arrow_forward_rounded, color: Colors.white), onPressed: () => context.pop()),
                    const SizedBox(width: 8),
                    Expanded(child: Text(widget.experience.title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800))),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(color: AppColors.starGold, borderRadius: BorderRadius.circular(8)),
                      child: Row(children: [const Icon(Icons.star_rounded, size: 14, color: AppColors.deepSpace), const SizedBox(width: 4), Text('$_score', style: const TextStyle(color: AppColors.deepSpace, fontWeight: FontWeight.w800))]),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 18),
                child: Row(
                  children: [
                    Text('المستوى $_level', style: TextStyle(color: AppColors.mutedText.withValues(alpha: 0.72), fontSize: 11)),
                    const Spacer(),
                    TextButton.icon(onPressed: () => setState(() => _hintUsed = true), icon: const Icon(Icons.lightbulb_outline_rounded, size: 16, color: AppColors.starGold), label: Text(_hintUsed ? 'تلميح ✓' : 'تلميح', style: TextStyle(color: _hintUsed ? AppColors.success : AppColors.starGold, fontSize: 11))),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(18),
                  child: GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 4, crossAxisSpacing: 10, mainAxisSpacing: 10),
                    itemCount: _cards.length,
                    itemBuilder: (context, index) {
                      final selected = _selected.contains(index);
                      final matched = _hintUsed && _cards[index] == 0;
                      return Material(
                        color: selected ? AppColors.starGold : matched ? AppColors.success.withValues(alpha: 0.22) : const Color(0xFF111A3A).withValues(alpha: 0.82),
                        borderRadius: BorderRadius.circular(14),
                        child: InkWell(
                          onTap: () {
                            setState(() {
                              if (selected) {
                                _selected.remove(index);
                              } else {
                                _selected.add(index);
                              }
                              if (_selected.length == 2) {
                                final a = _selected.elementAt(0);
                                final b = _selected.elementAt(1);
                                if (_cards[a] == _cards[b]) {
                                  _score += 10;
                                  _selected.clear();
                                  if (_score >= 20) _level++;
                                } else {
                                  Future.delayed(const Duration(milliseconds: 500), () => setState(() => _selected.clear()));
                                }
                              }
                            });
                          },
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: selected ? AppColors.starGold : Colors.white.withValues(alpha: 0.06))),
                            child: Center(child: selected ? Text('${_cards[index]}', style: const TextStyle(color: AppColors.deepSpace, fontSize: 20, fontWeight: FontWeight.w800)) : Icon(_hintUsed && matched ? Icons.check_rounded : Icons.help_outline_rounded, color: matched ? AppColors.success : Colors.white.withValues(alpha: 0.22))),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
                child: Row(
                  children: [
                    Expanded(child: OutlinedButton(onPressed: () => setState(() { _selected.clear(); _hintUsed = false; }), style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: BorderSide(color: Colors.white.withValues(alpha: 0.12))), child: const Text('إعادة'))),
                    const SizedBox(width: 10),
                    Expanded(child: FilledButton(onPressed: () => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('إتقان! نقاط: $_score'))), style: FilledButton.styleFrom(backgroundColor: AppColors.starGold, foregroundColor: AppColors.deepSpace), child: const Text('تحقق'))),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
