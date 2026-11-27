import 'package:meta/meta.dart';

import '../db/offline_database.dart';

/// A calendar day with no time or zone (CONTRACT §6.4: `start_date`,
/// `end_date`, date-only `expires_at` are `YYYY-MM-DD` strings). Never
/// convert these to instants — `DateTime.parse('2027-07-26')` is UTC
/// midnight and shows the previous day west of UTC.
@immutable
class CalendarDate implements Comparable<CalendarDate> {
  const CalendarDate(this.year, this.month, this.day);

  final int year;
  final int month;
  final int day;

  static final _re = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');

  /// Parses strict `YYYY-MM-DD` (rejects impossible dates like 02-30).
  /// Anything else → null.
  static CalendarDate? tryParse(Object? v) {
    if (v == null) return null;
    final m = _re.firstMatch(v.toString().trim());
    if (m == null) return null;
    final y = int.parse(m.group(1)!), mo = int.parse(m.group(2)!), d = int.parse(m.group(3)!);
    if (mo < 1 || mo > 12 || d < 1) return null;
    final check = DateTime.utc(y, mo, d);
    if (check.year != y || check.month != mo || check.day != d) return null;
    return CalendarDate(y, mo, d);
  }

  /// Canonical `YYYY-MM-DD` for storage, or null when not a valid date-only
  /// value (old servers sending instants are not guessed at).
  static String? normalize(Object? v) => tryParse(v)?.toString();

  /// The day as a local-midnight DateTime (for display / day arithmetic).
  DateTime toLocalDateTime() => DateTime(year, month, day);

  /// The day containing [t] in the device's local zone.
  static CalendarDate fromDateTime(DateTime t) {
    final l = t.isUtc ? t.toLocal() : t;
    return CalendarDate(l.year, l.month, l.day);
  }

  bool isBefore(CalendarDate o) => compareTo(o) < 0;
  bool isAfter(CalendarDate o) => compareTo(o) > 0;

  @override
  int compareTo(CalendarDate o) =>
      year != o.year ? year - o.year : (month != o.month ? month - o.month : day - o.day);

  @override
  bool operator ==(Object other) =>
      other is CalendarDate &&
      other.year == year &&
      other.month == month &&
      other.day == day;

  @override
  int get hashCode => Object.hash(year, month, day);

  @override
  String toString() =>
      '${year.toString().padLeft(4, '0')}-${month.toString().padLeft(2, '0')}-${day.toString().padLeft(2, '0')}';
}

/// Date-only accessors for cached buckets (stored as `YYYY-MM-DD`).
extension CachedMembershipDates on CachedMembership {
  CalendarDate? get startDay => CalendarDate.tryParse(startDate);
  CalendarDate? get endDay => CalendarDate.tryParse(endDate);
}

/// `expires_at` may be date-only (→ [expiresDay]) or a timestamp (null).
extension CachedAssignmentDates on CachedAssignment {
  CalendarDate? get expiresDay => CalendarDate.tryParse(expiresAt);
}
