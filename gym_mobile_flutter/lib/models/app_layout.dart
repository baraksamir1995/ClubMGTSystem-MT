/// Per-gym order + visibility of the Home and Explore screen sections,
/// edited from gym-admin Settings → "App Layout" (gyms.app_layout).
///
/// Keys MUST match clby-api `App\Support\AppLayout::SCREENS` and gym-admin
/// `lib/app-layout.ts`. Adding a section = add it in all three.
class AppLayout {
  static const homeKeys = <String>[
    'banners', 'membership', 'todays_classes', 'activity', 'quick_access', 'locations',
  ];
  static const exploreKeys = <String>[
    'memberships', 'offers', 'trainers', 'services', 'programs', 'session_packages', 'partners',
  ];

  /// Ordered list of VISIBLE section keys per screen.
  final List<String> home;
  final List<String> explore;

  /// Raw rows kept so the model round-trips through the secure-storage cache.
  final Map<String, dynamic>? raw;

  const AppLayout._(this.home, this.explore, this.raw);

  static const AppLayout defaults = AppLayout._(homeKeys, exploreKeys, null);

  /// Tolerant parse: unknown keys are ignored (a newer dashboard than this
  /// app build), and any section this build knows but the saved layout
  /// doesn't mention is appended visible (a newer app than the saved
  /// layout) — so new sections never silently disappear.
  factory AppLayout.fromJson(dynamic json) {
    if (json is! Map) return defaults;
    return AppLayout._(
      _resolve(json['home'], homeKeys),
      _resolve(json['explore'], exploreKeys),
      Map<String, dynamic>.from(json),
    );
  }

  static List<String> _resolve(dynamic rows, List<String> known) {
    if (rows is! List) return known;
    final seen = <String>{};
    final visible = <String>[];
    for (final row in rows) {
      if (row is! Map) continue;
      final key = row['key'];
      if (key is! String || !known.contains(key) || !seen.add(key)) continue;
      if (row['visible'] != false) visible.add(key);
    }
    for (final key in known) {
      if (!seen.contains(key)) visible.add(key);
    }
    return visible;
  }

  Map<String, dynamic>? toJson() => raw;
}
