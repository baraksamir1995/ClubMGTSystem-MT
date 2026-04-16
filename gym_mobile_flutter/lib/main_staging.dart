// Staging entry point.
// Build with:
//   flutter build ipa \
//     --target lib/main_staging.dart \
//     --dart-define=IS_STAGING=true \
//     --export-options-plist ios/ExportOptions-Staging.plist
import 'main.dart' as app;

void main() => app.main();
