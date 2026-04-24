import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../models/booking_record_model.dart';
import '../../models/session_model.dart';
import '../../services/api_service.dart';
import '../../utils/logger.dart';
import '../../widgets/rating_sheet.dart';

class RatingReminderProvider extends ChangeNotifier {
  static const _storage = FlutterSecureStorage();

  // Keys — per booking ID so different classes don't interfere
  static String _nextShowKey(String bookingId) =>
      'rrm_next_show_$bookingId';
  static String _attemptsKey(String bookingId) =>
      'rrm_attempts_$bookingId';

  static const _maxAttempts = 3;
  static const _laterDelay = Duration(hours: 6);

  BookingRecord? _pending;
  bool _shownThisSession = false;

  BookingRecord? get pending => _pending;

  /// Called on every home-screen load. Fetches the latest unrated session,
  /// applies timing guards, then caches the result in [_pending].
  Future<void> checkPendingRating(
      ApiService service, String memberId) async {
    appLog('[Rating] checkPendingRating — shownThisSession=$_shownThisSession memberId=$memberId');
    if (_shownThisSession) return;

    try {
      final booking = await service.getLastUnratedAttendedSession(memberId);
      appLog('[Rating] booking=${booking?.id} sessionEndTime=${booking?.sessionEndTime} status=${booking?.status}');
      if (booking == null) {
        _pending = null;
        return;
      }

      final attempts =
          int.tryParse(await _storage.read(key: _attemptsKey(booking.id)) ?? '0') ?? 0;
      appLog('[Rating] attempts=$attempts');
      if (attempts >= _maxAttempts) {
        _pending = null;
        return;
      }

      final nextShowStr = await _storage.read(key: _nextShowKey(booking.id));
      appLog('[Rating] nextShowStr=$nextShowStr');
      if (nextShowStr != null) {
        final nextShow = DateTime.tryParse(nextShowStr);
        if (nextShow != null && DateTime.now().isBefore(nextShow)) {
          appLog('[Rating] suppressed until $nextShow');
          _pending = null;
          return;
        }
      }

      _pending = booking;
      notifyListeners();
    } catch (e) {
      appLog('[Rating] error: $e');
    }
  }

  /// Shows the rating reminder bottom sheet if there is a pending booking.
  /// Call this after [checkPendingRating] and after any higher-priority
  /// modals (e.g. promotional popups) have been dismissed.
  Future<void> maybeShowReminder(BuildContext context) async {
    if (_shownThisSession || _pending == null) return;
    if (!context.mounted) return;

    _shownThisSession = true;
    final booking = _pending!;

    // Build a minimal Session so we can reuse showRatingSheet as-is
    final session = _bookingToSession(booking);

    final rated = await showRatingSheet(context, session);

    if (rated == true) {
      _pending = null;
      notifyListeners();
      // Attended booking was rated — clear any stored timing/attempts
      await _clearStorageFor(booking.id);
    } else if (rated == false) {
      // User tapped "Skip for now" — schedule a retry after a delay
      await _recordLaterTap(booking.id);
      _pending = null;
      notifyListeners();
    } else {
      // User dismissed (X / swipe) — no delay, show again next session
      _pending = null;
      notifyListeners();
    }
  }

  /// Convert a BookingRecord into the minimal Session that showRatingSheet needs.
  Session _bookingToSession(BookingRecord b) {
    return Session(
      id: b.sessionId ?? '',
      classId: '',
      className: b.className,
      instructor: b.instructor,
      scheduledAt: b.sessionDate,
      endTime: b.sessionEndTime,
      classColor: b.classColor,
      classType: b.classType,
      bookingId: b.id,
      isBooked: true,
      bookingStatus: 'attended',
      hasRated: false,
    );
  }

  Future<void> _recordLaterTap(String bookingId) async {
    final current =
        int.tryParse(await _storage.read(key: _attemptsKey(bookingId)) ?? '0') ??
            0;
    await _storage.write(
        key: _attemptsKey(bookingId), value: '${current + 1}');
    final nextShow = DateTime.now().add(_laterDelay).toIso8601String();
    await _storage.write(key: _nextShowKey(bookingId), value: nextShow);
  }

  Future<void> _clearStorageFor(String bookingId) async {
    await _storage.delete(key: _attemptsKey(bookingId));
    await _storage.delete(key: _nextShowKey(bookingId));
  }

  /// Reset on logout so state doesn't bleed between accounts.
  void clear() {
    _pending = null;
    _shownThisSession = false;
    notifyListeners();
  }
}
