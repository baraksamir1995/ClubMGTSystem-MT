import 'package:firebase_analytics/firebase_analytics.dart';

import '../../models/banner_model.dart';

/// Single source of truth for banner analytics events.
///
/// Every event includes `banner_id` so funnels can join across:
///   banner_view → banner_tap → sponsor_code_revealed → sponsor_url_visited
///
/// All calls are fire-and-forget; failures are swallowed so analytics never
/// blocks UI.
class BannerAnalytics {
  BannerAnalytics._();

  static FirebaseAnalytics get _fa => FirebaseAnalytics.instance;

  static void _send(String name, BannerModel banner, [Map<String, Object>? extra]) {
    // Wrap in try/catch — `FirebaseAnalytics.instance` throws synchronously
    // when Firebase isn't initialized (misconfigured flavor, missing
    // GoogleService-Info.plist, etc.), and we don't want a missed analytics
    // event to crash the home carousel timer that called us.
    try {
      final params = <String, Object>{
        'banner_id': banner.id,
        'banner_action_type': banner.actionType,
        if (extra != null) ...extra,
      };
      // Don't await — analytics shouldn't block carousel transitions or taps.
      _fa.logEvent(name: name, parameters: params).catchError((_) {});
    } catch (_) {
      // Swallow: analytics is best-effort.
    }
  }

  /// Carousel snapped to this banner (initial display + auto-advance + swipe).
  static void logView(BannerModel banner) => _send('banner_view', banner);

  /// User tapped the banner card on Home.
  static void logTap(BannerModel banner) => _send('banner_tap', banner);

  /// Sponsor variant: user pressed "Get promo code" and the code was copied.
  static void logSponsorCodeRevealed(BannerModel banner) {
    _send('sponsor_code_revealed', banner, {
      'has_promo_code': banner.sponsorPromoCode != null && banner.sponsorPromoCode!.isNotEmpty ? 1 : 0,
    });
  }

  /// Sponsor variant: user tapped "Visit website" — opens the external URL.
  static void logSponsorUrlVisited(BannerModel banner) {
    _send('sponsor_url_visited', banner);
  }
}
