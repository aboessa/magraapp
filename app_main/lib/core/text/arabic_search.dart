/// Arabic-aware text normalisation for search (§10).
///
/// Naive `contains` over raw strings fails Arabic badly: a child typing "حكايه"
/// would not match a title stored as "حكاية", and "علوم" would miss "عُلوم"
/// because of the diacritic. This normaliser folds the differences that a child
/// should not be expected to reproduce, so search matches on meaning rather than
/// exact code points.
///
/// It applies, in order: removal of Arabic diacritics (tashkeel) and the tatweel
/// elongation, unification of the alef forms (أ إ آ ٱ → ا), teh marbuta → heh
/// (ة → ه), alef maqsura → yeh (ى → ي), Arabic-Indic digits → ASCII, and a
/// lowercase + whitespace collapse so Latin titles fold too.
abstract final class ArabicSearch {
  // Tashkeel (harakat) and the tatweel/kashida.
  static final _diacritics = RegExp(
    r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u0640]',
  );

  static final _whitespace = RegExp(r'\s+');

  static const _arabicIndicDigits = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    // Extended (Persian) forms, sometimes present in content.
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };

  /// Folds [input] to its searchable normal form.
  static String normalize(String input) {
    if (input.isEmpty) return '';
    var text = input.replaceAll(_diacritics, '');

    final buffer = StringBuffer();
    for (final rune in text.runes) {
      final ch = String.fromCharCode(rune);
      switch (ch) {
        case 'أ':
        case 'إ':
        case 'آ':
        case 'ٱ':
        case 'ا':
          buffer.write('ا');
        case 'ة':
          buffer.write('ه');
        case 'ى':
          buffer.write('ي');
        case 'ؤ':
          buffer.write('و');
        case 'ئ':
          buffer.write('ي');
        default:
          buffer.write(_arabicIndicDigits[ch] ?? ch);
      }
    }

    text = buffer.toString().toLowerCase().trim();
    return text.replaceAll(_whitespace, ' ');
  }

  /// Whether [haystack] contains [needle] after both are normalised.
  ///
  /// An empty needle matches nothing (the caller decides what to show for an
  /// empty query), which stops a blank query from "matching" everything.
  static bool matches(String needle, String haystack) {
    final n = normalize(needle);
    if (n.isEmpty) return false;
    return normalize(haystack).contains(n);
  }

  /// Splits a query into normalised tokens and returns true only when every
  /// token is found somewhere in [haystack]. Lets "مغامرات ارقام" match a title
  /// containing both words in any order.
  static bool matchesAllTokens(String query, String haystack) {
    final normalizedHaystack = normalize(haystack);
    final tokens = normalize(query).split(' ').where((t) => t.isNotEmpty);
    if (tokens.isEmpty) return false;
    return tokens.every(normalizedHaystack.contains);
  }
}
