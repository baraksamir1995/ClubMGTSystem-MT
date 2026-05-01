/// Aggregated view of a member's session entitlements across all buckets.
///
/// `totalSessions` and the breakdown only count *bounded* buckets — unlimited
/// plans are surfaced via `buckets` so the UI can render them as "Unlimited"
/// without polluting the countable totals on the unified card.
class MembershipSummary {
  final int totalSessions;
  final DateTime? nextExpiryDate;
  final int originalSessions;
  final int transferredSessions;
  final List<MembershipBucket> buckets;

  const MembershipSummary({
    required this.totalSessions,
    required this.nextExpiryDate,
    required this.originalSessions,
    required this.transferredSessions,
    required this.buckets,
  });

  bool get isEmpty => buckets.isEmpty;
  bool get hasTransferred => transferredSessions > 0;

  factory MembershipSummary.fromJson(Map<String, dynamic> json) {
    final breakdown = json['breakdown'] as Map<String, dynamic>? ?? const {};
    final bucketsJson = json['buckets'] as List? ?? const [];
    return MembershipSummary(
      totalSessions: (json['total_sessions'] as num?)?.toInt() ?? 0,
      nextExpiryDate: json['next_expiry_date'] != null
          ? DateTime.tryParse(json['next_expiry_date'] as String)
          : null,
      originalSessions: (breakdown['original_sessions'] as num?)?.toInt() ?? 0,
      transferredSessions: (breakdown['transferred_sessions'] as num?)?.toInt() ?? 0,
      buckets: bucketsJson
          .whereType<Map<String, dynamic>>()
          .map(MembershipBucket.fromJson)
          .toList(),
    );
  }
}

class MembershipBucket {
  final String id;
  final String sourceType; // 'subscription' | 'transfer'
  final String? planName;
  final String? planType;
  final int? sessionsTotal; // null = unlimited
  final int? sessionsRemaining;
  final int sessionsUsed;
  final bool isUnlimited;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? branchId;
  final List<String>? allowedBranchIds;
  final String? freezeStatus;
  final String? transferredFrom;
  final String? transferredFromMemberName;

  const MembershipBucket({
    required this.id,
    required this.sourceType,
    this.planName,
    this.planType,
    this.sessionsTotal,
    this.sessionsRemaining,
    required this.sessionsUsed,
    required this.isUnlimited,
    this.startDate,
    this.endDate,
    this.branchId,
    this.allowedBranchIds,
    this.freezeStatus,
    this.transferredFrom,
    this.transferredFromMemberName,
  });

  bool get isTransferred => sourceType == 'transfer';
  bool get isFrozen => freezeStatus == 'frozen';

  factory MembershipBucket.fromJson(Map<String, dynamic> json) {
    List<String>? parseBranches(dynamic v) {
      if (v == null) return null;
      if (v is List) {
        final out = v.map((e) => e.toString()).toList();
        return out.isEmpty ? null : out;
      }
      return null;
    }

    return MembershipBucket(
      id: json['id'] as String,
      sourceType: json['source_type'] as String? ?? 'subscription',
      planName: json['plan_name'] as String?,
      planType: json['plan_type'] as String?,
      sessionsTotal: (json['sessions_total'] as num?)?.toInt(),
      sessionsRemaining: (json['sessions_remaining'] as num?)?.toInt(),
      sessionsUsed: (json['sessions_used'] as num?)?.toInt() ?? 0,
      isUnlimited: json['is_unlimited'] as bool?
          // Fallback: a session-based plan (sessions / duration_session)
          // with a null sessions_total is unlimited. Pure duration plans
          // also have null sessions_total but they have no session concept
          // — explicitly exclude them.
          ?? (json['sessions_total'] == null
              && (json['plan_type'] == 'sessions'
                  || json['plan_type'] == 'duration_session')),
      startDate: json['start_date'] != null
          ? DateTime.tryParse(json['start_date'] as String)
          : null,
      endDate: json['end_date'] != null
          ? DateTime.tryParse(json['end_date'] as String)
          : null,
      branchId: json['branch_id'] as String?,
      allowedBranchIds: parseBranches(json['allowed_branch_ids']),
      freezeStatus: json['freeze_status'] as String?,
      transferredFrom: json['transferred_from'] as String?,
      transferredFromMemberName: json['transferred_from_member_name'] as String?,
    );
  }
}
