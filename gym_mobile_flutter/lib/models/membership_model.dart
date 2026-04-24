class MemberMembership {
  final String id;
  final String memberId;
  final String planId;
  final String? planName;
  final String? planType;
  final String? description;
  final double? price;
  final String? currency;
  final String? billingCycle;
  final int? sessionCount;
  final int? visitsPerWeek;
  final int? visitsPerMonth;
  final List<String> facilities;
  final List<String> addOns;
  final DateTime? startDate;
  final DateTime? endDate;
  final String? status;
  final String? paymentStatus;
  final int? sessionsUsed;
  // Per-membership-row totals (preferred over plan's session_count when set).
  // Populated directly from member_memberships.sessions_total / sessions_remaining.
  final int? sessionsTotal;
  final int? sessionsRemainingRaw;
  // If non-null, this membership row was created by a session transfer.
  final String? transferredFrom;

  // Freeze fields (plan config)
  final bool freezeEnabled;
  final int? freezeMaxDays;
  final int? freezeMaxCount;
  // Freeze fields (membership state)
  final String? freezeStatus;
  final int freezeDaysUsed;
  final int freezeCount;
  final DateTime? frozenAt;
  final DateTime? frozenUntil;

  // Invitation fields (plan config)
  final bool invitationsEnabled;
  final int? invitationsPerCycle;
  final String? invitationDurationType;
  final int? invitationDurationDays;
  final int? invitationValidityDays;
  // Invitation fields (membership state)
  final int invitationsRemaining;
  final int invitationsUsed;

  // Branch restriction (null = valid for all branches, empty list = no access)
  final List<String>? allowedBranchIds;

  const MemberMembership({
    required this.id,
    required this.memberId,
    required this.planId,
    this.planName,
    this.planType,
    this.description,
    this.price,
    this.currency,
    this.billingCycle,
    this.sessionCount,
    this.visitsPerWeek,
    this.visitsPerMonth,
    this.facilities = const [],
    this.addOns = const [],
    this.startDate,
    this.endDate,
    this.status,
    this.paymentStatus,
    this.sessionsUsed,
    this.sessionsTotal,
    this.sessionsRemainingRaw,
    this.transferredFrom,
    this.freezeEnabled = false,
    this.freezeMaxDays,
    this.freezeMaxCount,
    this.freezeStatus,
    this.freezeDaysUsed = 0,
    this.freezeCount = 0,
    this.frozenAt,
    this.frozenUntil,
    this.invitationsEnabled = false,
    this.invitationsPerCycle,
    this.invitationDurationType,
    this.invitationDurationDays,
    this.invitationValidityDays,
    this.invitationsRemaining = 0,
    this.invitationsUsed = 0,
    this.allowedBranchIds,
  });

  /// Prefer row-level sessions_remaining (post-transfer-accurate). Fall back to
  /// sessions_total - used, then plan.session_count - used for legacy rows.
  int? get sessionsRemaining {
    if (sessionsRemainingRaw != null) {
      return sessionsRemainingRaw! < 0 ? 0 : sessionsRemainingRaw;
    }
    final used = sessionsUsed ?? 0;
    final total = sessionsTotal ?? sessionCount;
    if (total == null) return null;
    final remaining = total - used;
    return remaining < 0 ? 0 : remaining;
  }

  /// Total for display ("X of Y"). Prefer row-level sessions_total.
  int? get effectiveSessionTotal => sessionsTotal ?? sessionCount;

  /// True when this row was created by an incoming session transfer.
  bool get isTransferred => transferredFrom != null;

  bool get isFrozen => freezeStatus == 'frozen';

  bool get isActive {
    if (status == 'active') {
      if (endDate != null) return endDate!.isAfter(DateTime.now());
      return true;
    }
    return false;
  }

  bool get isExpired =>
      status == 'active' && endDate != null && endDate!.isBefore(DateTime.now());

  String get displayStatus {
    if (isFrozen) return 'Frozen';
    if (isActive) return 'Active';
    if (isExpired) return 'Expired';
    if (status == 'suspended') return 'Suspended';
    return status ?? 'Inactive';
  }

  bool get canFreeze {
    if (!freezeEnabled) return false;
    if (!isActive || isFrozen || isExpired) return false;
    if (freezeMaxCount != null && freezeCount >= freezeMaxCount!) return false;
    if (freezeMaxDays != null && freezeDaysUsed >= freezeMaxDays!) return false;
    return true;
  }

  int get freezeDaysRemaining => (freezeMaxDays ?? 0) - freezeDaysUsed;

  /// O(1) branch access check — no DB call needed.
  /// allowedBranchIds == null means all_branches plan.
  bool canAccessBranch(String branchId) {
    if (allowedBranchIds == null) return true;
    return allowedBranchIds!.contains(branchId);
  }

  // Duration-based plan types
  bool get isDurationBased =>
      planType == 'monthly' ||
      planType == 'annual' ||
      planType == 'duration' ||
      planType == 'duration_session';

  // Plans that allow gym entrance QR scan. Transferred rows are session-only;
  // even if the source plan granted gym access, the receiver only gets sessions.
  bool get hasGymAccess {
    if (isTransferred) return false;
    return planType == 'monthly' ||
        planType == 'annual' ||
        planType == 'duration' ||
        planType == 'duration_session';
  }

  // Plans that allow studio/session QR scan
  bool get hasStudioAccess =>
      planType == 'sessions' ||
      planType == 'duration_session';

  factory MemberMembership.fromJson(Map<String, dynamic> json) {
    final planJson = (json['membership_plans'] ?? json['plan']) as Map<String, dynamic>?;

    List<String> parseList(dynamic value) {
      if (value == null) return [];
      if (value is List) return value.map((e) => e.toString()).toList();
      return [];
    }

    return MemberMembership(
      id: json['id'] as String,
      memberId: json['gym_member_id'] as String? ?? json['member_id'] as String? ?? '',
      planId: json['plan_id'] as String,
      planName: planJson?['name'] as String?,
      planType: planJson?['plan_type'] as String?,
      description: planJson?['description'] as String?,
      price: planJson?['price'] != null
          ? (planJson!['price'] as num).toDouble()
          : (json['final_price'] != null
              ? (json['final_price'] as num).toDouble()
              : null),
      currency: planJson?['currency'] as String?,
      billingCycle: planJson?['billing_cycle'] as String?,
      sessionCount: planJson?['session_count'] as int?,
      visitsPerWeek: planJson?['visits_per_week'] as int?,
      visitsPerMonth: planJson?['visits_per_month'] as int?,
      facilities: parseList(planJson?['facilities']),
      addOns: parseList(planJson?['add_ons']),
      startDate: json['start_date'] != null
          ? DateTime.parse(json['start_date'] as String)
          : null,
      endDate: json['end_date'] != null
          ? DateTime.parse(json['end_date'] as String)
          : null,
      status: json['status'] as String?,
      paymentStatus: json['payment_status'] as String?,
      sessionsUsed: json['sessions_used'] as int?,
      sessionsTotal: json['sessions_total'] as int?,
      sessionsRemainingRaw: json['sessions_remaining'] as int?,
      transferredFrom: json['transferred_from'] as String?,
      freezeEnabled: planJson?['freeze_enabled'] as bool? ?? false,
      freezeMaxDays: planJson?['freeze_max_days'] as int?,
      freezeMaxCount: planJson?['freeze_max_count'] as int?,
      freezeStatus: json['freeze_status'] as String?,
      freezeDaysUsed: (json['freeze_days_used'] as int?) ?? 0,
      freezeCount: (json['freeze_count'] as int?) ?? 0,
      frozenAt: json['frozen_at'] != null
          ? DateTime.parse(json['frozen_at'] as String)
          : null,
      frozenUntil: json['frozen_until'] != null
          ? DateTime.parse(json['frozen_until'] as String)
          : null,
      invitationsEnabled: planJson?['invitations_enabled'] as bool? ?? false,
      invitationsPerCycle: planJson?['invitations_per_cycle'] as int?,
      invitationDurationType: planJson?['invitation_duration_type'] as String?,
      invitationDurationDays: planJson?['invitation_duration_days'] as int?,
      invitationValidityDays: planJson?['invitation_validity_days'] as int?,
      invitationsRemaining: (json['invitations_remaining'] as int?) ?? 0,
      invitationsUsed: (json['invitations_used'] as int?) ?? 0,
      allowedBranchIds: parseList(json['allowed_branch_ids']).isEmpty
          ? null  // null = all branches
          : parseList(json['allowed_branch_ids']),
    );
  }
}
