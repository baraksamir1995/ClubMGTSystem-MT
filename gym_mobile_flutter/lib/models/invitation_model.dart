class GuestInvitation {
  final String id;
  final String inviterMemberId;
  final String membershipId;
  final String? guestName;
  final String guestEmail;
  final String guestPhone;
  final String invitationToken;
  final InvitationStatus status;
  final InvitationDurationType durationType;
  final int? durationDays;
  final int maxVisits;
  final int visitsUsed;
  final DateTime expiresAt;
  final DateTime? acceptedAt;
  final DateTime? activatedAt;
  final DateTime? passExpiresAt;
  final DateTime? invalidatedAt;
  final DateTime createdAt;

  const GuestInvitation({
    required this.id,
    required this.inviterMemberId,
    required this.membershipId,
    this.guestName,
    required this.guestEmail,
    required this.guestPhone,
    required this.invitationToken,
    required this.status,
    required this.durationType,
    this.durationDays,
    required this.maxVisits,
    required this.visitsUsed,
    required this.expiresAt,
    this.acceptedAt,
    this.activatedAt,
    this.passExpiresAt,
    this.invalidatedAt,
    required this.createdAt,
  });

  factory GuestInvitation.fromJson(Map<String, dynamic> json) {
    return GuestInvitation(
      id: json['id'] as String,
      inviterMemberId: json['inviter_member_id'] as String,
      membershipId: json['membership_id'] as String,
      guestName: json['guest_name'] as String?,
      guestEmail: json['guest_email'] as String,
      guestPhone: json['guest_phone'] as String,
      invitationToken: json['invitation_token'] as String,
      status: InvitationStatus.fromString(json['status'] as String? ?? 'pending'),
      durationType: InvitationDurationType.fromString(json['duration_type'] as String? ?? 'per_visit'),
      durationDays: json['duration_days'] as int?,
      maxVisits: (json['max_visits'] as int?) ?? 1,
      visitsUsed: (json['visits_used'] as int?) ?? 0,
      expiresAt: DateTime.parse(json['expires_at'] as String),
      acceptedAt: json['accepted_at'] != null ? DateTime.parse(json['accepted_at'] as String) : null,
      activatedAt: json['activated_at'] != null ? DateTime.parse(json['activated_at'] as String) : null,
      passExpiresAt: json['pass_expires_at'] != null ? DateTime.parse(json['pass_expires_at'] as String) : null,
      invalidatedAt: json['invalidated_at'] != null ? DateTime.parse(json['invalidated_at'] as String) : null,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  bool get isPending => status == InvitationStatus.pending;
  bool get isActive => status == InvitationStatus.active;

  /// Days remaining before the invitation offer expires (null if not pending).
  int? get daysUntilExpiry {
    if (!isPending) return null;
    final diff = expiresAt.difference(DateTime.now()).inDays;
    return diff < 0 ? 0 : diff;
  }

  /// Pass description label for display.
  String get passLabel {
    if (durationType == InvitationDurationType.timeBased) {
      return '${durationDays ?? '?'}-day pass';
    }
    return '$maxVisits visit${maxVisits != 1 ? 's' : ''}';
  }
}

enum InvitationStatus {
  pending,
  accepted,
  active,
  expired,
  invalidated;

  static InvitationStatus fromString(String s) {
    switch (s) {
      case 'accepted':    return InvitationStatus.accepted;
      case 'active':      return InvitationStatus.active;
      case 'expired':     return InvitationStatus.expired;
      case 'invalidated': return InvitationStatus.invalidated;
      default:            return InvitationStatus.pending;
    }
  }

  String get label {
    switch (this) {
      case InvitationStatus.pending:     return 'Pending';
      case InvitationStatus.accepted:    return 'Accepted';
      case InvitationStatus.active:      return 'Active';
      case InvitationStatus.expired:     return 'Expired';
      case InvitationStatus.invalidated: return 'Invalidated';
    }
  }
}

enum InvitationDurationType {
  perVisit,
  timeBased;

  static InvitationDurationType fromString(String s) {
    return s == 'time_based' ? InvitationDurationType.timeBased : InvitationDurationType.perVisit;
  }
}
