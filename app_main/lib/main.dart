import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/majarra_app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  _registerBundledFontLicenses();
  runApp(const ProviderScope(child: MajarraApp()));
}

/// Surfaces the SIL Open Font License for the bundled Readex Pro files in the
/// standard "Licenses" page (`showLicensePage`).
///
/// The OFL requires its text to accompany the font, so this is a licence
/// obligation, not a nicety.
void _registerBundledFontLicenses() {
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString('assets/fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(const ['Readex Pro'], license);
  });
}
