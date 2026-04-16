import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz;
import '../firebase_options.dart';

/// Must be top-level — called by FCM when the app is in the background/terminated.
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // FCM automatically shows a system notification for messages with a
  // notification payload when the app is in the background — nothing extra needed.
}

class NotificationService {
  static final NotificationService _instance = NotificationService._();
  factory NotificationService() => _instance;
  NotificationService._();

  final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();

  // ── Firebase / FCM ──────────────────────────────────────────────────────────

  Future<void> initFirebase() async {
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);

    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // Show foreground FCM messages as local notifications
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final n = message.notification;
      if (n != null) {
        _showFcmNotification(n.title ?? '', n.body ?? '');
      }
    });
  }

  /// Returns the FCM registration token, or null if unavailable.
  Future<String?> getFcmToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('[FCM] getToken failed: $e');
      return null;
    }
  }

  Future<void> _showFcmNotification(String title, String body) async {
    await _plugin.show(
      0,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'gym_push',
          'Gym Notifications',
          channelDescription: 'Push notifications from your gym',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
    );
  }

  // ── Local notifications ─────────────────────────────────────────────────────

  Future<void> init() async {
    tz.initializeTimeZones();

    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    await _plugin.initialize(
      const InitializationSettings(
          android: androidSettings, iOS: iosSettings),
    );
  }

  Future<void> requestPermissions() async {
    await _plugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(alert: true, badge: true, sound: true);
  }

  /// Schedule a notification on the expiry date (9 AM)
  Future<void> scheduleMembershipExpiryNotification(
      DateTime expiryDate) async {
    final expiryAt9am = DateTime(
        expiryDate.year, expiryDate.month, expiryDate.day, 9, 0, 0);

    if (expiryAt9am.isBefore(DateTime.now())) return;

    await _plugin.zonedSchedule(
      1001,
      'Membership Expired',
      'Your gym membership has expired. Renew now to keep access.',
      tz.TZDateTime.from(expiryAt9am, tz.local),
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'membership_expiry',
          'Membership Expiry',
          channelDescription: 'Notifies when membership expires',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  /// Schedule a reminder 7 days before expiry
  Future<void> scheduleMembershipReminderNotification(
      DateTime expiryDate) async {
    final reminderDate = expiryDate.subtract(const Duration(days: 7));
    final reminderAt9am = DateTime(reminderDate.year, reminderDate.month,
        reminderDate.day, 9, 0, 0);

    if (reminderAt9am.isBefore(DateTime.now())) return;

    await _plugin.zonedSchedule(
      1002,
      'Membership Expiring Soon',
      'Your gym membership expires in 7 days. Renew to avoid interruption.',
      tz.TZDateTime.from(reminderAt9am, tz.local),
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'membership_reminder',
          'Membership Reminder',
          channelDescription: 'Reminds before membership expires',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
      uiLocalNotificationDateInterpretation:
          UILocalNotificationDateInterpretation.absoluteTime,
    );
  }

  Future<void> cancelMembershipNotifications() async {
    await _plugin.cancel(1001);
    await _plugin.cancel(1002);
  }

  Future<void> showBookingConfirmedNotification(
      String className, DateTime scheduledAt) async {
    final dateStr = DateFormat('EEE, MMM d \'at\' h:mm a').format(scheduledAt);
    await _plugin.show(
      2001,
      'Booking Confirmed!',
      '$className — $dateStr',
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'booking_confirmed',
          'Booking Confirmed',
          channelDescription: 'Confirms class bookings',
          importance: Importance.high,
          priority: Priority.high,
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: false,
          presentSound: true,
        ),
      ),
    );
  }
}
