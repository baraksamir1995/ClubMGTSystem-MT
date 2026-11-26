import 'dart:convert';

import 'package:drift/drift.dart';
import 'package:meta/meta.dart';

import '../db/offline_database.dart';
import '../model/calendar_date.dart';
import '../model/clock_offset.dart';
import '../model/policy_holder.dart';
import '../model/sync_models.dart';
import '../scope.dart';
import '../sync/transport.dart';

@immutable
class BootstrapResult {
  const BootstrapResult({
    required this.asOf,
    required this.pages,
    required this.members,
    required this.memberships,
    required this.branches,
    required this.classSessions,
    required this.assignments,
    required this.recentAttendance,
    required this.recentServiceLogs,
  });

  final DateTime? asOf;
  final int pages;
  final int members;
  final int memberships;
  final int branches;
  final int classSessions;
  final int assignments;
  final int recentAttendance;
  final int recentServiceLogs;

  @override
  String toString() => 'BootstrapResult(asOf=$asOf, pages=$pages, '
      'members=$members, buckets=$memberships, branches=$branches, '
      'classes=$classSessions, assignments=$assignments)';
}

/// Thrown when the server's paging misbehaves (cursor loop / too many
/// pages). The previous snapshot is left untouched.
class BootstrapPagingError implements Exception {
  const BootstrapPagingError(this.message);
  final String message;
  @override
  String toString() => 'BootstrapPagingError: $message';
}

/// Pulls the role-specific snapshot (CONTRACT §3) into the cache.
///
/// * admin / coach → `GET /offline/bootstrap`, cursor-paged;
///   member → `GET /offline/me` (single page).
/// * All pages are fetched FIRST, then the whole cache is replaced in one
///   transaction — a failure on any page leaves the previous snapshot (and
///   its `as_of`) intact.
/// * `as_of` stored = the EARLIEST `as_of` across pages (conservative).
class BootstrapService {
  BootstrapService({
    required this.db,
    required this.transport,
    required this.app,
    required this.policy,
    this.asUserId,
    DateTime Function()? now,
    this.pageLimit = 500,
    this.maxPages = 1000,
  }) : _now = now ?? DateTime.now;

  final OfflineDatabase db;
  final SyncTransport transport;
  final OfflineApp app;
  final PolicyHolder policy;
  /// Scope user: every request must go out with this user's token (D9).
  final String? asUserId;
  final int pageLimit;
  final int maxPages;
  final DateTime Function() _now;

  Future<BootstrapResult> refresh() async {
    final pages = <SnapshotPage>[];
    if (app == OfflineApp.member) {
      final page = await transport.me(asUserId: asUserId);
      await _recordOffset(page.serverTime);
      pages.add(page);
    } else {
      String? cursor;
      final seen = <String>{};
      do {
        if (pages.length >= maxPages) {
          throw BootstrapPagingError('more than $maxPages pages');
        }
        final page = await transport.bootstrapPage(
            cursor: cursor, limit: pageLimit, asUserId: asUserId);
        // Offset measured per page (right when its server_time arrived).
        await _recordOffset(page.serverTime);
        pages.add(page);
        cursor = page.nextCursor;
        if (cursor != null) {
          if (!seen.add(cursor)) {
            throw BootstrapPagingError('cursor repeated: $cursor');
          }
          await db.writeMeta(SyncMetaKeys.bootstrapCursor, cursor);
        }
      } while (cursor != null);
    }
    return _apply(pages);
  }

  /// `as_of` of the cached snapshot, or null if never bootstrapped.
  Future<DateTime?> asOf() async {
    final s = await db.readMeta(SyncMetaKeys.asOf);
    return s == null ? null : DateTime.tryParse(s);
  }

  /// True when there is no snapshot or it is older than
  /// `policy.max_data_age_hours`.
  Future<bool> isStale({DateTime? now}) async {
    final a = await asOf();
    if (a == null) return true;
    return (now ?? _now()).toUtc().difference(a.toUtc()) > policy.value.maxDataAge;
  }

  Future<BootstrapResult> _apply(List<SnapshotPage> pages) async {
    final members = <String, CachedMembersCompanion>{};
    final buckets = <String, CachedMembershipsCompanion>{};
    final branches = <String, CachedBranchesCompanion>{};
    final classes = <String, CachedClassSessionsCompanion>{};
    final assignments = <String, CachedAssignmentsCompanion>{};
    final recentAtt = <String, CachedRecentAttendanceCompanion>{};
    final recentLogs = <String, CachedRecentServiceLogsCompanion>{};
    DateTime? asOf;
    String? asOfRaw;
    String? serverTime;
    Map<String, Object?>? gym;
    Map<String, Object?>? serverPolicy;
    Map<String, Object?>? me;

    void addBuckets(String memberId, Object? list) {
      if (list is! List) return;
      for (final b in list.whereType<Map>()) {
        final id = _s(b['membership_id']);
        if (id == null) continue;
        final allowed = b['allowed_branch_ids'];
        buckets['$memberId|$id'] = CachedMembershipsCompanion.insert(
          membershipId: id,
          gymMemberId: memberId,
          planType: Value(_s(b['plan_type'])),
          sourceType: Value(_s(b['source_type'])),
          status: Value(_s(b['status'])),
          paymentStatus: Value(_s(b['payment_status'])),
          startDate: Value(CalendarDate.normalize(b['start_date'])),
          endDate: Value(CalendarDate.normalize(b['end_date'])),
          sessionsRemaining: Value(_i(b['sessions_remaining'])),
          sessionsTotal: Value(_i(b['sessions_total'])),
          freezeStatus: Value(_s(b['freeze_status'])),
          allowedBranchIds: Value(allowed is List ? jsonEncode(allowed) : null),
        );
      }
    }

    void addMember(Map<String, Object?> m) {
      final id = _s(m['gym_member_id']);
      if (id == null) return;
      final name = _s(m['full_name']) ?? '';
      final number = _s(m['member_number']);
      members[id] = CachedMembersCompanion.insert(
        gymMemberId: id,
        memberNumber: Value(number),
        fullName: name,
        searchText: '${name.toLowerCase()} ${number ?? ''}'.trim(),
        phoneLast4: Value(_s(m['phone_last4'])),
        photoUrl: Value(_s(m['photo_url'])),
        status: Value(_s(m['status'])),
      );
      addBuckets(id, m['buckets']);
    }

    for (final page in pages) {
      final pa = page.asOf;
      final parsed = pa == null ? null : DateTime.tryParse(pa);
      if (parsed != null && (asOf == null || parsed.isBefore(asOf))) {
        asOf = parsed;
        asOfRaw = pa;
      }
      serverTime ??= page.serverTime;
      gym ??= page.gym;
      serverPolicy ??= page.policy;

      for (final m in page.list('members')) {
        addMember(m);
      }
      final self = page.member;
      if (self != null) {
        me ??= self;
        addMember(self);
        final id = _s(self['gym_member_id']);
        if (id != null) addBuckets(id, page.json['buckets']);
      }
      for (final b in page.list('branches')) {
        final id = _s(b['id']);
        if (id == null) continue;
        branches[id] = CachedBranchesCompanion.insert(
          id: id,
          name: _s(b['name']) ?? '',
          isActive: Value(b['is_active'] != false),
        );
      }
      for (final c in page.list('class_sessions')) {
        final id = _s(c['id']);
        if (id == null) continue;
        classes[id] = CachedClassSessionsCompanion.insert(
          id: id,
          classId: Value(_s(c['class_id'])),
          name: Value(_s(c['name'])),
          branchId: Value(_s(c['branch_id'])),
          studioId: Value(_s(c['studio_id'])),
          startsAt: Value(_s(c['starts_at'])),
          endsAt: Value(_s(c['ends_at'])),
        );
      }
      for (final a in page.list('assignments')) {
        final id = _s(a['assignment_id']);
        final member = _s(a['gym_member_id']);
        if (id == null || member == null) continue;
        assignments[id] = CachedAssignmentsCompanion.insert(
          assignmentId: id,
          gymMemberId: member,
          memberName: Value(_s(a['member_name'])),
          memberNumber: Value(_s(a['member_number'])),
          photoUrl: Value(_s(a['photo_url'])),
          serviceType: Value(_s(a['service_type'])),
          packageName: Value(_s(a['package_name'])),
          sessionsTotal: Value(_i(a['sessions_total'])),
          sessionsUsed: Value(_i(a['sessions_used'])),
          status: Value(_s(a['status'])),
          expiresAt: Value(_s(a['expires_at'])),
          lastSessionAt: Value(_s(a['last_session_at'])),
        );
      }
      for (final r in page.list('recent_attendance')) {
        final id = _s(r['attendance_id']);
        final member = _s(r['gym_member_id']);
        if (id == null || member == null) continue;
        recentAtt[id] = CachedRecentAttendanceCompanion.insert(
          attendanceId: id,
          gymMemberId: member,
          classSessionId: Value(_s(r['class_session_id'])),
          branchId: Value(_s(r['branch_id'])),
          checkInAt: Value(_s(r['check_in_at'])),
        );
      }
      for (final r in page.list('recent_service_logs')) {
        final id = _s(r['service_log_id']);
        final a = _s(r['assignment_id']);
        if (id == null || a == null) continue;
        recentLogs[id] = CachedRecentServiceLogsCompanion.insert(
          serviceLogId: id,
          assignmentId: a,
          loggedAt: Value(_s(r['logged_at'])),
        );
      }
    }

    // Snapshot without as_of: fall back to the server clock, never to the
    // device clock.
    asOfRaw ??= serverTime;
    asOf ??= asOfRaw == null ? null : DateTime.tryParse(asOfRaw);

    await db.transaction(() async {
      await db.wipeCache();
      await db.batch((b) {
        b.insertAll(db.cachedMembers, members.values);
        b.insertAll(db.cachedMemberships, buckets.values);
        b.insertAll(db.cachedBranches, branches.values);
        b.insertAll(db.cachedClassSessions, classes.values);
        b.insertAll(db.cachedAssignments, assignments.values);
        b.insertAll(db.cachedRecentAttendance, recentAtt.values);
        b.insertAll(db.cachedRecentServiceLogs, recentLogs.values);
      });
      await db.writeMeta(SyncMetaKeys.asOf, asOfRaw);
      await db.writeMeta(SyncMetaKeys.serverTime, serverTime);
      await db.writeMeta(
          SyncMetaKeys.lastBootstrapAt, _now().toUtc().toIso8601String());
      await db.writeMeta(SyncMetaKeys.gym, gym == null ? null : jsonEncode(gym));
      await db.writeMeta(SyncMetaKeys.member, me == null ? null : jsonEncode(me));
    });
    if (serverPolicy != null) await policy.applyServerPolicy(serverPolicy);

    return BootstrapResult(
      asOf: asOf,
      pages: pages.length,
      members: members.length,
      memberships: buckets.length,
      branches: branches.length,
      classSessions: classes.length,
      assignments: assignments.length,
      recentAttendance: recentAtt.length,
      recentServiceLogs: recentLogs.length,
    );
  }

  Future<void> _recordOffset(String? serverTime) =>
      recordServerClockOffset(db, serverTime, _now());

  static String? _s(Object? v) {
    if (v == null) return null;
    final s = v.toString();
    return s.isEmpty ? null : s;
  }

  static int? _i(Object? v) =>
      v is num ? v.toInt() : (v is String ? int.tryParse(v) : null);
}
