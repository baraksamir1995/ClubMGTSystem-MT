/// Domain models for the coach app, all derived from the clby-api
/// `/api/coach/*` responses. Each parser tolerates the API's `{data: …}`
/// envelope as well as the inner shape so callers can pass either.
library;

/// State of an assignment as the design renders it.
enum AssignmentState { active, low, inactive }

AssignmentState _parseState(String? s) {
  switch (s) {
    case 'low':
      return AssignmentState.low;
    case 'inactive':
      return AssignmentState.inactive;
    case 'active':
    default:
      return AssignmentState.active;
  }
}

/// Coach identity returned by `GET /api/coach/me`.
class CoachIdentity {
  final String trainerProfileId;
  final String name;
  final String trainerType; // personal_trainer | physiotherapist | nutritionist
  final String gymId;
  final String? gymName;
  final String email;
  final String qrSeed;

  const CoachIdentity({
    required this.trainerProfileId,
    required this.name,
    required this.trainerType,
    required this.gymId,
    required this.gymName,
    required this.email,
    required this.qrSeed,
  });

  factory CoachIdentity.fromJson(Map<String, dynamic> raw) {
    final j = (raw['data'] is Map<String, dynamic>) ? raw['data'] as Map<String, dynamic> : raw;
    return CoachIdentity(
      trainerProfileId: j['trainer_profile_id']?.toString() ?? '',
      name: j['name']?.toString() ?? '',
      trainerType: j['trainer_type']?.toString() ?? '',
      gymId: j['gym_id']?.toString() ?? '',
      gymName: j['gym_name']?.toString(),
      email: j['email']?.toString() ?? '',
      qrSeed: j['qr_seed']?.toString() ?? 'clby-coach',
    );
  }
}

class CoachMember {
  final String id;
  final String name;
  final String? photoUrl;
  final DateTime? joinedAt;
  final int? memberNumber;

  const CoachMember({
    required this.id,
    required this.name,
    this.photoUrl,
    this.joinedAt,
    this.memberNumber,
  });

  factory CoachMember.fromJson(Map<String, dynamic> j) {
    return CoachMember(
      id: j['id']?.toString() ?? '',
      name: (j['name']?.toString().trim().isNotEmpty ?? false)
          ? j['name'] as String
          : 'Unnamed member',
      photoUrl: j['photo_url']?.toString(),
      joinedAt: _parseDate(j['joined_at']),
      memberNumber: (j['member_number'] is int) ? j['member_number'] as int : null,
    );
  }
}

/// One assignment row — the design's "card per session package".
class CoachAssignment {
  final String assignmentId;
  final String status; // 'active' | 'completed' (server-side raw)
  final AssignmentState state;
  final String? reason; // 'expired' | 'completed' when inactive
  final int sessionsTotal;
  final int sessionsUsed;
  final int sessionsRemaining;
  final String serviceType; // personal_trainer | physiotherapist | nutritionist
  final String packageName;
  final DateTime? assignedAt;
  final DateTime? expiresAt;
  final DateTime? lastSessionAt;
  final CoachMember member;

  const CoachAssignment({
    required this.assignmentId,
    required this.status,
    required this.state,
    required this.reason,
    required this.sessionsTotal,
    required this.sessionsUsed,
    required this.sessionsRemaining,
    required this.serviceType,
    required this.packageName,
    required this.assignedAt,
    required this.expiresAt,
    required this.lastSessionAt,
    required this.member,
  });

  factory CoachAssignment.fromJson(Map<String, dynamic> j) {
    return CoachAssignment(
      assignmentId: j['assignment_id']?.toString() ?? '',
      status: j['status']?.toString() ?? 'active',
      state: _parseState(j['state']?.toString()),
      reason: j['reason']?.toString(),
      sessionsTotal: (j['sessions_total'] as num?)?.toInt() ?? 0,
      sessionsUsed: (j['sessions_used'] as num?)?.toInt() ?? 0,
      sessionsRemaining: (j['sessions_remaining'] as num?)?.toInt() ?? 0,
      serviceType: j['service_type']?.toString() ?? '',
      packageName: j['package_name']?.toString() ?? '',
      assignedAt: _parseDate(j['assigned_at']),
      expiresAt: _parseDate(j['expires_at']),
      lastSessionAt: _parseDate(j['last_session_at']),
      member: CoachMember.fromJson(
        (j['member'] is Map<String, dynamic>)
            ? j['member'] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
    );
  }

  /// Locally-projected copy after a successful confirm (optimistic).
  CoachAssignment withDecrement() {
    final newUsed = sessionsUsed + 1;
    final newRem = (sessionsRemaining - 1).clamp(0, sessionsTotal);
    final exhausted = newUsed >= sessionsTotal;
    final newState = exhausted
        ? AssignmentState.inactive
        : (newRem < 3 ? AssignmentState.low : AssignmentState.active);
    return CoachAssignment(
      assignmentId: assignmentId,
      status: exhausted ? 'completed' : status,
      state: newState,
      reason: exhausted ? 'completed' : reason,
      sessionsTotal: sessionsTotal,
      sessionsUsed: newUsed,
      sessionsRemaining: newRem,
      serviceType: serviceType,
      packageName: packageName,
      assignedAt: assignedAt,
      expiresAt: expiresAt,
      lastSessionAt: DateTime.now(),
      member: member,
    );
  }
}

/// One row in `/api/coach/today`.
class TodayLogEntry {
  final String logId;
  final DateTime deliveredAt;
  final String? note;
  final String assignmentId;
  final String packageName;
  final String serviceType;
  final int sessionsTotal;
  final int sessionsRemaining;
  final CoachMember member;

  const TodayLogEntry({
    required this.logId,
    required this.deliveredAt,
    required this.note,
    required this.assignmentId,
    required this.packageName,
    required this.serviceType,
    required this.sessionsTotal,
    required this.sessionsRemaining,
    required this.member,
  });

  factory TodayLogEntry.fromJson(Map<String, dynamic> j) {
    return TodayLogEntry(
      logId: j['log_id']?.toString() ?? '',
      deliveredAt: _parseDate(j['delivered_at']) ?? DateTime.now(),
      note: j['note']?.toString(),
      assignmentId: j['assignment_id']?.toString() ?? '',
      packageName: j['package_name']?.toString() ?? '',
      serviceType: j['service_type']?.toString() ?? '',
      sessionsTotal: (j['sessions_total'] as num?)?.toInt() ?? 0,
      sessionsRemaining: (j['sessions_remaining'] as num?)?.toInt() ?? 0,
      member: CoachMember.fromJson(
        (j['member'] is Map<String, dynamic>)
            ? j['member'] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
    );
  }
}

class AssignmentHistoryItem {
  final String logId;
  final DateTime deliveredAt;
  final String? note;

  const AssignmentHistoryItem({
    required this.logId,
    required this.deliveredAt,
    this.note,
  });

  factory AssignmentHistoryItem.fromJson(Map<String, dynamic> j) {
    return AssignmentHistoryItem(
      logId: j['id']?.toString() ?? '',
      deliveredAt: _parseDate(j['delivered_at']) ?? DateTime.now(),
      note: j['note']?.toString(),
    );
  }
}

DateTime? _parseDate(dynamic v) {
  if (v == null) return null;
  if (v is DateTime) return v;
  final s = v.toString();
  if (s.isEmpty) return null;
  try {
    return DateTime.parse(s).toLocal();
  } catch (_) {
    return null;
  }
}
