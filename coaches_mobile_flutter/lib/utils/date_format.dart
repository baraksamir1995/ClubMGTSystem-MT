import 'package:intl/intl.dart';

/// `YYYY-MM-DD` of a DateTime — the API/JSON canonical date format.
String ymd(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-'
    '${d.month.toString().padLeft(2, '0')}-'
    '${d.day.toString().padLeft(2, '0')}';

/// "21 May 2026" — used on the Member detail's Started/Expires meta.
/// Requires `initializeDateFormatting('en_GB')` (called in main.dart).
String fmtDate(DateTime d) => DateFormat('dd MMM yyyy', 'en_GB').format(d);

/// "21 May" — used on Member card EXP labels.
String fmtShort(DateTime d) => DateFormat('dd MMM', 'en_GB').format(d);

/// "Wednesday, 20 May" — Today log subtitle.
String fmtWeekdayDate(DateTime d) =>
    DateFormat('EEEE, d MMMM', 'en_GB').format(d);

/// "JUN 2026" — month-group header in Member detail's attendance.
String fmtMonthYear(DateTime d) =>
    DateFormat('MMMM yyyy', 'en_GB').format(d).toUpperCase();
