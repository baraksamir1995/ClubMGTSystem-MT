import 'package:drift/drift.dart';

/// Outbox of locally recorded events (CONTRACT §1 + §5).
///
/// Rows are NEVER deleted by the package while `pending`/`syncing` (a DB
/// trigger enforces it) and `rejected` rows are kept visible — only an
/// explicit, audited discard (Phase 5) may remove them.
@DataClassName('OutboxEvent')
class OutboxEvents extends Table {
  @override
  String get tableName => 'outbox_events';

  // ── Event (CONTRACT §1) ────────────────────────────────────────────────
  TextColumn get eventId => text()();
  /// `attendance` | `service_session`
  TextColumn get kind => text()();
  /// `staff_qr` | `member_qr` | `manual` (kind=attendance only)
  TextColumn get attendanceMethod => text().nullable()();
  TextColumn get gymId => text()();
  TextColumn get branchId => text().nullable()();
  TextColumn get memberId => text()();
  TextColumn get classSessionId => text().nullable()();
  TextColumn get studioId => text().nullable()();
  TextColumn get serviceAssignmentId => text().nullable()();
  /// trainer_profiles.id for a member-scanned coach QR (`kind:
  /// service_session`, `method: member_qr`). Added in schema v4.
  TextColumn get trainerId => text().nullable()();
  /// ISO-8601 with the device's UTC offset, exactly as sent. Immutable.
  TextColumn get deviceRecordedAt => text()();
  /// Same instant as UTC epoch millis — ordering key only. Immutable.
  IntColumn get deviceRecordedAtMs => integer()();
  /// IANA zone name, e.g. `Africa/Cairo`.
  TextColumn get deviceTimezone => text()();
  TextColumn get qrRaw => text().nullable()();
  TextColumn get note => text().nullable()();
  /// JSON object (≤ 4 KB), free-form, never trusted by the server.
  TextColumn get metadata => text().withDefault(const Constant('{}'))();

  // ── Client-side model (CONTRACT §5) ────────────────────────────────────
  TextColumn get actorUserId => text()();
  /// `admin` | `coach` | `member` (the app role that recorded it)
  TextColumn get actorType => text()();
  TextColumn get deviceId => text()();
  /// `pending` | `syncing` | `synced` | `rejected`
  TextColumn get syncStatus => text().withDefault(const Constant('pending'))();
  IntColumn get syncAttempts => integer().withDefault(const Constant(0))();
  /// UTC epoch millis; null = due now.
  IntColumn get nextAttemptAt => integer().nullable()();
  IntColumn get lastAttemptAt => integer().nullable()();
  TextColumn get lastSyncError => text().nullable()();
  /// Raw server status: accepted | duplicate | rejected | error.
  TextColumn get resultStatus => text().nullable()();
  TextColumn get resultCode => text().nullable()();
  TextColumn get resultMessage => text().nullable()();
  /// attendance_id (kind=attendance) or service_log_id (kind=service_session).
  TextColumn get officialId => text().nullable()();
  /// JSON array of server review flags (D2), e.g. ["sessions_exhausted"].
  TextColumn get flags => text().withDefault(const Constant('[]'))();
  TextColumn get serverReceivedAt => text().nullable()();
  TextColumn get processedAt => text().nullable()();
  /// UTC epoch micros at insert — ordering tie-breaker.
  IntColumn get createdAt => integer()();

  @override
  Set<Column<Object>> get primaryKey => {eventId};

  @override
  List<String> get customConstraints => [
        "CHECK (kind IN ('attendance','service_session'))",
        "CHECK (attendance_method IS NULL OR attendance_method IN ('staff_qr','member_qr','manual'))",
        "CHECK (sync_status IN ('pending','syncing','synced','rejected'))",
      ];
}

/// Members visible to staff (admin bootstrap). Display/search only.
@DataClassName('CachedMember')
class CachedMembers extends Table {
  @override
  String get tableName => 'cached_members';

  TextColumn get gymMemberId => text()();
  TextColumn get memberNumber => text().nullable()();
  TextColumn get fullName => text()();
  /// Lower-cased name + member number, for local search.
  TextColumn get searchText => text()();
  TextColumn get phoneLast4 => text().nullable()();
  TextColumn get photoUrl => text().nullable()();
  TextColumn get status => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {gymMemberId};
}

/// Membership buckets ("as of" the snapshot — never shown as live).
@DataClassName('CachedMembership')
class CachedMemberships extends Table {
  @override
  String get tableName => 'cached_memberships';

  TextColumn get membershipId => text()();
  TextColumn get gymMemberId => text()();
  TextColumn get planType => text().nullable()();
  TextColumn get sourceType => text().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get paymentStatus => text().nullable()();
  TextColumn get startDate => text().nullable()();
  TextColumn get endDate => text().nullable()();
  IntColumn get sessionsRemaining => integer().nullable()();
  IntColumn get sessionsTotal => integer().nullable()();
  TextColumn get freezeStatus => text().nullable()();
  /// JSON array, or NULL = all branches.
  TextColumn get allowedBranchIds => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {gymMemberId, membershipId};
}

@DataClassName('CachedBranch')
class CachedBranches extends Table {
  @override
  String get tableName => 'cached_branches';

  TextColumn get id => text()();
  TextColumn get name => text()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();
  /// Current `branches.qr_token` (member snapshot, Phase 3): a v2 branch
  /// QR must carry exactly this token. Added in schema v3.
  TextColumn get qrToken => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

@DataClassName('CachedClassSession')
class CachedClassSessions extends Table {
  @override
  String get tableName => 'cached_class_sessions';

  TextColumn get id => text()();
  TextColumn get classId => text().nullable()();
  TextColumn get name => text().nullable()();
  TextColumn get branchId => text().nullable()();
  TextColumn get studioId => text().nullable()();
  TextColumn get startsAt => text().nullable()();
  TextColumn get endsAt => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// Coach PT/physio assignments (coach bootstrap).
@DataClassName('CachedAssignment')
class CachedAssignments extends Table {
  @override
  String get tableName => 'cached_assignments';

  TextColumn get assignmentId => text()();
  TextColumn get gymMemberId => text()();
  /// Trainer of the assignment (member snapshot; schema v4).
  TextColumn get trainerId => text().nullable()();
  TextColumn get memberName => text().nullable()();
  TextColumn get memberNumber => text().nullable()();
  TextColumn get photoUrl => text().nullable()();
  TextColumn get serviceType => text().nullable()();
  TextColumn get packageName => text().nullable()();
  IntColumn get sessionsTotal => integer().nullable()();
  IntColumn get sessionsUsed => integer().nullable()();
  TextColumn get status => text().nullable()();
  TextColumn get expiresAt => text().nullable()();
  TextColumn get lastSessionAt => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {assignmentId};
}

/// Server-confirmed attendance from the snapshot (last 48 h) — feeds the
/// local (member, class_session) duplicate check.
@DataClassName('CachedRecentAttendanceRow')
class CachedRecentAttendance extends Table {
  @override
  String get tableName => 'cached_recent_attendance';

  TextColumn get attendanceId => text()();
  TextColumn get gymMemberId => text()();
  TextColumn get classSessionId => text().nullable()();
  TextColumn get branchId => text().nullable()();
  TextColumn get checkInAt => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {attendanceId};
}

@DataClassName('CachedRecentServiceLog')
class CachedRecentServiceLogs extends Table {
  @override
  String get tableName => 'cached_recent_service_logs';

  TextColumn get serviceLogId => text()();
  TextColumn get assignmentId => text()();
  TextColumn get loggedAt => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {serviceLogId};
}

/// Trainers of the member's gym (member snapshot, Phase 3 Amendment 2):
/// a coach QR must name a cached ACTIVE trainer. Added in schema v4.
@DataClassName('CachedTrainer')
class CachedTrainers extends Table {
  @override
  String get tableName => 'cached_trainers';

  TextColumn get id => text()();
  TextColumn get name => text().withDefault(const Constant(''))();
  TextColumn get serviceType => text().nullable()();
  BoolColumn get isActive => boolean().withDefault(const Constant(true))();

  @override
  Set<Column<Object>> get primaryKey => {id};
}

/// Member-pass verification keys (PHASE2-CONTRACT "Keys"), from the
/// bootstrap's `pass_keys`. Public keys only. Added in schema v2.
@DataClassName('CachedPassKey')
class CachedPassKeys extends Table {
  @override
  String get tableName => 'cached_pass_keys';

  TextColumn get kid => text()();
  /// Ed25519 public key, base64url (32 bytes).
  TextColumn get publicKey => text()();
  /// `active` | `retired`.
  TextColumn get status => text()();
  /// ISO-8601; for retired keys, passes signed by it are accepted until
  /// then. NULL = no limit (active key).
  TextColumn get validUntil => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {kid};
}

/// Key/value sync bookkeeping (as_of, last successful sync, policy JSON,
/// cursors, gym/member identity JSON). See [SyncMetaKeys].
@DataClassName('SyncMetaEntry')
class SyncMeta extends Table {
  @override
  String get tableName => 'sync_meta';

  TextColumn get key => text()();
  TextColumn get value => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {key};
}
