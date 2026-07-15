import 'package:flutter/widgets.dart';
import 'app_localizations.dart';

export 'app_localizations.dart';

/// Shorthand so call sites read `context.l10n.commonSave` instead of
/// `AppLocalizations.of(context).commonSave`.
extension L10nX on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this);
}
