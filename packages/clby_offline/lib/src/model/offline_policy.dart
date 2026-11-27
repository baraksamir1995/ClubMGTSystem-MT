import 'dart:convert';

import 'package:meta/meta.dart';

/// Server policy object (CONTRACT §4). Unknown/malformed fields fall back
/// to the documented defaults; numbers are clamped to sane ranges.
///
/// The compiled-in default has `enabled: false`: until a server policy has
/// been fetched, no new offline events can be created (already-recorded
/// events still sync).
@immutable
class OfflinePolicy {
  const OfflinePolicy({
    this.enabled = false,
    this.maxBatch = 50,
    this.maxDataAgeHours = 24,
    this.maxEventAgeDays = 7,
    this.futureSkewSeconds = 300,
    this.allowManualOffline = true,
    this.allowStaffQrOffline = true,
    this.allowMemberQrOffline = false,
    this.allowServiceSessionOffline = true,
    this.expiredCachePolicy = 'warn',
    this.retryBaseSeconds = 5,
    this.retryMaxSeconds = 900,
  });

  static const defaults = OfflinePolicy();

  /// Hard server cap (CONTRACT §2: 1..50 events per request).
  static const serverMaxBatch = 50;

  final bool enabled;
  final int maxBatch;
  final int maxDataAgeHours;
  final int maxEventAgeDays;
  final int futureSkewSeconds;
  final bool allowManualOffline;
  final bool allowStaffQrOffline;
  final bool allowMemberQrOffline;
  final bool allowServiceSessionOffline;
  /// `warn` | `block` (unknown values are treated as `warn`).
  final String expiredCachePolicy;
  final int retryBaseSeconds;
  final int retryMaxSeconds;

  Duration get maxDataAge => Duration(hours: maxDataAgeHours);
  Duration get retryBase => Duration(seconds: retryBaseSeconds);
  Duration get retryMax => Duration(seconds: retryMaxSeconds);
  bool get blocksOnExpiredCache => expiredCachePolicy == 'block';

  factory OfflinePolicy.fromJson(Object? json) {
    if (json is! Map) return defaults;
    bool b(String k, bool d) {
      final v = json[k];
      if (v is bool) return v;
      if (v is num) return v != 0;
      if (v is String) {
        if (v == 'true' || v == '1') return true;
        if (v == 'false' || v == '0') return false;
      }
      return d;
    }

    int i(String k, int d, int min, int max) {
      final v = json[k];
      final n = v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);
      if (n == null) return d;
      return n.clamp(min, max);
    }

    final base = i('retry_base_seconds', 5, 1, 3600);
    final ecp = json['expired_cache_policy'];
    return OfflinePolicy(
      enabled: b('enabled', false),
      maxBatch: i('max_batch', 50, 1, serverMaxBatch),
      maxDataAgeHours: i('max_data_age_hours', 24, 1, 24 * 90),
      maxEventAgeDays: i('max_event_age_days', 7, 1, 365),
      futureSkewSeconds: i('future_skew_seconds', 300, 0, 86400),
      allowManualOffline: b('allow_manual_offline', true),
      allowStaffQrOffline: b('allow_staff_qr_offline', true),
      allowMemberQrOffline: b('allow_member_qr_offline', false),
      allowServiceSessionOffline: b('allow_service_session_offline', true),
      expiredCachePolicy: ecp == 'block' ? 'block' : 'warn',
      retryBaseSeconds: base,
      retryMaxSeconds: i('retry_max_seconds', 900, base, 86400),
    );
  }

  factory OfflinePolicy.fromJsonString(String? s) {
    if (s == null || s.isEmpty) return defaults;
    try {
      return OfflinePolicy.fromJson(jsonDecode(s));
    } catch (_) {
      return defaults;
    }
  }

  Map<String, Object?> toJson() => {
        'enabled': enabled,
        'max_batch': maxBatch,
        'max_data_age_hours': maxDataAgeHours,
        'max_event_age_days': maxEventAgeDays,
        'future_skew_seconds': futureSkewSeconds,
        'allow_manual_offline': allowManualOffline,
        'allow_staff_qr_offline': allowStaffQrOffline,
        'allow_member_qr_offline': allowMemberQrOffline,
        'allow_service_session_offline': allowServiceSessionOffline,
        'expired_cache_policy': expiredCachePolicy,
        'retry_base_seconds': retryBaseSeconds,
        'retry_max_seconds': retryMaxSeconds,
      };
}
