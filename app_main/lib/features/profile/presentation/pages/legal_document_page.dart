import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/widgets/cinematic_background.dart';
import '../../data/legal_documents.dart';
import 'package:majarra/l10n/app_localizations_ar.dart';

/// One published legal document, the same text as `majarra.app/legal/:slug`.
class LegalDocumentPage extends ConsumerWidget {
  const LegalDocumentPage({super.key, required this.slug});

  final String slug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final doc = ref.watch(legalDocumentProvider(slug));
    final fallbackTitle =
        legalDocumentSlugs[slug] ??
        AppLocalizationsAr().profilelegaldocumentpageBuild01;

    return Scaffold(
      backgroundColor: AppColors.deepSpace,
      body: CinematicBackground(
        child: CustomScrollView(
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: Color(0xFF0B1026).withValues(alpha: 0.88),
              leading: IconButton(
                icon: Icon(Icons.arrow_forward_rounded, color: Colors.white),
                tooltip: AppLocalizationsAr().profilelegaldocumentpageTooltip01,
                onPressed: () =>
                    context.canPop() ? context.pop() : context.go('/'),
              ),
              title: Text(
                doc.valueOrNull?.title ?? fallbackTitle,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              centerTitle: true,
            ),
            SliverToBoxAdapter(
              child: Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(maxWidth: 720),
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: doc.when(
                      loading: () => Padding(
                        padding: EdgeInsets.symmetric(vertical: 60),
                        child: Center(
                          child: CircularProgressIndicator(
                            color: AppColors.starGold,
                          ),
                        ),
                      ),
                      error: (_, _) => _Message(
                        text:
                            AppLocalizationsAr().profilelegaldocumentpageText01,
                        action: AppLocalizationsAr()
                            .profilelegaldocumentpageAction01,
                        onAction: () =>
                            ref.invalidate(legalDocumentProvider(slug)),
                      ),
                      data: (value) => value == null
                          ? _Message(
                              text:
                                  // ignore: prefer_interpolation_to_compose_strings
                                  AppLocalizationsAr()
                                      .profilelegaldocumentpageText02 +
                                  AppLocalizationsAr()
                                      .profilelegaldocumentpageText03,
                              action: AppLocalizationsAr()
                                  .profilelegaldocumentpageAction02,
                              onAction: () => context.push('/privacy'),
                            )
                          : _Body(doc: value),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Body extends StatelessWidget {
  const _Body({required this.doc});

  final LegalDocument doc;

  @override
  Widget build(BuildContext context) {
    final text = TextStyle(
      color: AppColors.starlight,
      fontSize: 14,
      height: 1.8,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          AppLocalizationsAr().profilelegaldocumentpageBuild02(
            doc.version,
            doc.publishedAt.length >= 10
                ? doc.publishedAt.substring(0, 10)
                : doc.publishedAt,
          ),
          style: const TextStyle(color: AppColors.dimText, fontSize: 12),
        ),
        const SizedBox(height: 8),
        for (final block in parseLegalBody(doc.body))
          switch (block) {
            LegalHeading(:final text) => Padding(
              padding: const EdgeInsets.only(top: 18, bottom: 8),
              child: Semantics(
                header: true,
                child: Text(
                  text,
                  style: const TextStyle(
                    color: AppColors.starGold,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
            LegalParagraph(text: final value) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(value, style: text),
            ),
            LegalList(:final items, :final ordered) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < items.length; i++)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            width: 22,
                            child: Text(
                              ordered ? '${i + 1}.' : '•',
                              style: const TextStyle(
                                color: AppColors.electricCyan,
                                fontSize: 14,
                                height: 1.8,
                              ),
                            ),
                          ),
                          Expanded(child: Text(items[i], style: text)),
                        ],
                      ),
                    ),
                ],
              ),
            ),
          },
      ],
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.text,
    required this.action,
    required this.onAction,
  });

  final String text;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 40),
    child: Column(
      children: [
        Text(
          text,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.mutedText, height: 1.7),
        ),
        const SizedBox(height: 16),
        OutlinedButton(onPressed: onAction, child: Text(action)),
      ],
    ),
  );
}
