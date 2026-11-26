/// `kind` of an outbox event (CONTRACT §1).
enum EventKind {
  attendance('attendance'),
  serviceSession('service_session');

  const EventKind(this.wire);
  final String wire;

  static EventKind? fromWire(String? s) =>
      values.where((e) => e.wire == s).firstOrNull;
}

/// `attendance_method` (kind=attendance only).
enum AttendanceMethod {
  staffQr('staff_qr'),
  memberQr('member_qr'),
  manual('manual');

  const AttendanceMethod(this.wire);
  final String wire;

  static AttendanceMethod? fromWire(String? s) =>
      values.where((e) => e.wire == s).firstOrNull;
}

/// Local outbox `sync_status` (CONTRACT §5).
enum OutboxStatus {
  pending('pending'),
  syncing('syncing'),
  synced('synced'),
  rejected('rejected');

  const OutboxStatus(this.wire);
  final String wire;

  static OutboxStatus fromWire(String s) =>
      values.firstWhere((e) => e.wire == s, orElse: () => pending);
}

/// Per-event server result `status` (CONTRACT §2).
enum ResultStatus {
  accepted('accepted'),
  duplicate('duplicate'),
  rejected('rejected'),
  error('error'),
  unknown('unknown');

  const ResultStatus(this.wire);
  final String wire;

  static ResultStatus fromWire(Object? s) =>
      values.firstWhere((e) => e.wire == s, orElse: () => unknown);
}
