import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/constants/app_colors.dart';
import '../services/api_service.dart';
import '../utils/env.dart';
import '../utils/logger.dart';

const _brandingKey = 'gym_branding';

/// The gym identity shown on pre-login surfaces plus the two accent colors
/// every screen themes with — all sourced from the gym-admin dashboard
/// settings (`gyms.name`, `gyms.logo_url`, `gyms.branding_config`).
class GymBranding {
  final String gymId;
  final String name;
  final String? logoUrl;
  final Color? primary;
  final Color? secondary;

  const GymBranding({
    required this.gymId,
    required this.name,
    this.logoUrl,
    this.primary,
    this.secondary,
  });

  factory GymBranding.fromGymJson(Map<String, dynamic> gym) {
    final cfg = gym['branding_config'];
    final branding = cfg is Map<String, dynamic> ? cfg : const <String, dynamic>{};
    // The dashboard's dedicated logo upload writes gyms.logo_url;
    // branding_config.logo_url is the white-label override. Prefer the latter.
    final logo = (branding['logo_url'] ?? gym['logo_url'])?.toString();
    // A color the dashboard stored but we can't parse must be loud — a
    // silently ignored branding_config is undiagnosable from support.
    Color? parseColor(String key) {
      final raw = branding[key]?.toString();
      final color = AppColors.tryParseHex(raw);
      if (color == null && raw != null && raw.trim().isNotEmpty) {
        appLog('BrandingProvider: unparseable $key "$raw" — using default');
      }
      return color;
    }

    return GymBranding(
      gymId: gym['id']?.toString() ?? '',
      name: gym['name']?.toString() ?? '',
      logoUrl: (logo != null && logo.isNotEmpty) ? logo : null,
      primary: parseColor('primary_color'),
      secondary: parseColor('secondary_color'),
    );
  }

  Map<String, dynamic> toJson() => {
        'gym_id': gymId,
        'name': name,
        'logo_url': logoUrl,
        'primary': primary?.toARGB32(),
        'secondary': secondary?.toARGB32(),
      };

  factory GymBranding.fromJson(Map<String, dynamic> m) => GymBranding(
        gymId: m['gym_id']?.toString() ?? '',
        name: m['name']?.toString() ?? '',
        logoUrl: m['logo_url']?.toString(),
        primary: m['primary'] is int ? Color(m['primary'] as int) : null,
        secondary: m['secondary'] is int ? Color(m['secondary'] as int) : null,
      );

  // Value semantics: _apply/notify (and the app-wide rebuild they trigger)
  // must be skippable when a re-sync returns byte-identical branding.
  @override
  bool operator ==(Object other) =>
      other is GymBranding &&
      other.gymId == gymId &&
      other.name == name &&
      other.logoUrl == logoUrl &&
      other.primary == primary &&
      other.secondary == secondary;

  @override
  int get hashCode => Object.hash(gymId, name, logoUrl, primary, secondary);
}

/// Loads the cached gym branding at startup (so the login screen is branded
/// even offline / before auth), then re-syncs from `GET /api/gyms/{id}`
/// whenever a coach profile with a gym_id is loaded. The cache intentionally
/// survives sign-out — the login screen keeps showing the coach's gym.
class BrandingProvider extends ChangeNotifier {
  final ApiService _service;
  final _storage = const FlutterSecureStorage();

  GymBranding? _branding;
  GymBranding? get branding => _branding;

  // Monotonic counter bumped on every APPLIED (i.e. actually different)
  // branding — main.dart keys the app subtree on it so a real mid-session
  // brand change repaints everything, while identical re-syncs are free.
  int _epoch = 0;
  int get epoch => _epoch;

  // Skip redundant gym fetches + keychain writes when the same gym was
  // synced moments ago (profile refresh loops, pull-to-refresh).
  String? _lastSyncedGymId;
  DateTime? _lastSyncedAt;
  static const _syncTtl = Duration(minutes: 5);

  BrandingProvider(this._service) {
    _init();
  }

  Future<void> _init() async {
    try {
      final raw = await _storage.read(key: _brandingKey);
      if (raw != null) {
        _apply(GymBranding.fromJson(jsonDecode(raw) as Map<String, dynamic>));
      }
    } catch (e) {
      appLog('BrandingProvider: failed to restore cache: $e');
    }
    // Single-tenant (white-label) builds know their gym at compile time —
    // fetch fresh branding before anyone logs in.
    if (Env.gymId.isNotEmpty) {
      await syncForGym(Env.gymId);
    }
  }

  /// Fetch the gym's public card and apply + persist its branding.
  /// Safe to call repeatedly; failures keep whatever is already applied.
  /// Recently-synced gyms are skipped unless [force] is set.
  Future<void> syncForGym(String? gymId, {bool force = false}) async {
    if (gymId == null || gymId.isEmpty) return;
    if (!force
        && gymId == _lastSyncedGymId
        && _lastSyncedAt != null
        && DateTime.now().difference(_lastSyncedAt!) < _syncTtl) {
      return;
    }
    try {
      final gym = await _service.getGymPublic(gymId);
      final fresh = GymBranding.fromGymJson(gym);
      _lastSyncedGymId = gymId;
      _lastSyncedAt = DateTime.now();
      if (_apply(fresh)) {
        await _storage.write(
            key: _brandingKey, value: jsonEncode(fresh.toJson()));
      }
    } catch (e) {
      appLog('BrandingProvider: sync failed for $gymId: $e');
    }
  }

  /// Applies branding if it differs from what's already applied.
  /// Returns whether anything changed. AppColors.applyBranding resets
  /// null colors to the defaults, so a gym without branding (or a cleared
  /// dashboard color) never inherits the previous gym's accents.
  bool _apply(GymBranding b) {
    if (b == _branding) return false;
    _branding = b;
    AppColors.applyBranding(primaryColor: b.primary, secondaryColor: b.secondary);
    _epoch++;
    notifyListeners();
    return true;
  }
}
