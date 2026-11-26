import 'dart:ui' as ui;

import 'package:clby_offline/clby_offline.dart' show OfflineEntryBlock;
import 'package:flutter/widgets.dart';

/// English + Arabic strings for the offline-attendance screens.
///
/// The rest of the coach app is English-only with no l10n setup; enabling
/// `ar` app-wide would flip every existing screen to RTL. So these screens
/// pick the language from the DEVICE locale and wrap themselves in the
/// matching [Directionality] (see [OfflineDirectionality]).
class OfflineStrings {
  const OfflineStrings._(this.lang);

  final String lang;
  bool get isRtl => lang == 'ar';
  TextDirection get direction => isRtl ? TextDirection.rtl : TextDirection.ltr;

  static const en = OfflineStrings._('en');
  static const ar = OfflineStrings._('ar');

  /// Device-locale based (`ar*` → Arabic, else English).
  static OfflineStrings current() =>
      ui.PlatformDispatcher.instance.locale.languageCode == 'ar' ? ar : en;

  String _t(String key) => (lang == 'ar' ? _ar[key] : null) ?? _en[key] ?? key;

  // Indicator
  String get online => _t('online');
  String get offline => _t('offline');
  String get syncing => _t('syncing');
  String pending(int n) => _t('pending').replaceAll('{n}', '$n');
  String get syncFailed => _t('syncFailed');
  String get dataExpired => _t('dataExpired');
  String get loginRequired => _t('loginRequired');
  String get deviceBlocked => _t('deviceBlocked');

  // Item states
  String get stateSaved => _t('stateSaved');
  String get stateSynced => _t('stateSynced');
  String stateRejected(String reason) => _t('stateRejected').replaceAll('{r}', reason);

  // Readiness
  String get readinessTitle => _t('readinessTitle');
  String get lastSync => _t('lastSync');
  String get dataAsOf => _t('dataAsOf');
  String get dataAge => _t('dataAge');
  String get cachedMembers => _t('cachedMembers');
  String get cachedAssignments => _t('cachedAssignments');
  String get offlineEnabled => _t('offlineEnabled');
  String get yes => _t('yes');
  String get no => _t('no');
  String get never => _t('never');
  String get refreshData => _t('refreshData');
  String get syncNow => _t('syncNow');
  String get thisDevice => _t('thisDevice');
  String get nothingRecorded => _t('nothingRecorded');
  String get rejectedTitle => _t('rejectedTitle');
  String get reasonCode => _t('reasonCode');
  String get recordedAt => _t('recordedAt');
  String get readOnlyNote => _t('readOnlyNote');
  String get storeUnavailable => _t('storeUnavailable');

  // Offline mode / policy
  String get offlineModeTitle => _t('offlineModeTitle');
  String get offlineModeBody => _t('offlineModeBody');
  String get onlineOnlyNotice => _t('onlineOnlyNotice');
  String get retryOnline => _t('retryOnline');
  String get policyOffNote => _t('policyOffNote');
  String get policyOffOffline => _t('policyOffOffline');

  // Log flow
  String get logSession => _t('logSession');
  String get scanPass => _t('scanPass');
  String get searchHint => _t('searchHint');
  String get pickMember => _t('pickMember');
  String get pickAssignment => _t('pickAssignment');
  String get noActiveAssignments => _t('noActiveAssignments');
  String get noteHint => _t('noteHint');
  String get confirmSession => _t('confirmSession');
  String sessionsLeft(int n) => _t('sessionsLeft').replaceAll('{n}', '$n');
  String asOf(String when) => _t('asOf').replaceAll('{t}', when);
  String get savedOnDevice => _t('savedOnDevice');
  String get syncedConfirmed => _t('syncedConfirmed');
  String get loggedOnline => _t('loggedOnline');
  String get done => _t('done');
  String get scanAgain => _t('scanAgain');
  String get confirmIdentity => _t('confirmIdentity');
  String get cameraHint => _t('cameraHint');
  String recentlyLogged(int m) => _t('recentlyLogged').replaceAll('{m}', '$m');
  String get duplicateTap => _t('duplicateTap');
  String get clockSkew => _t('clockSkew');

  /// Why offline mode couldn't be opened on this cold start.
  String entryBlocked(OfflineEntryBlock b) => _t('block_${b.name}');

  // Pass verdicts
  String get passInvalid => _t('passInvalid');
  String get passUnknownKey => _t('passUnknownKey');
  String get passWrongGym => _t('passWrongGym');
  String get passExpired => _t('passExpired');
  String get passMemberNotFound => _t('passMemberNotFound');
  String get passNeedsData => _t('passNeedsData');

  static const _en = <String, String>{
    'online': 'Online',
    'offline': 'Offline',
    'syncing': 'Synchronizing',
    'pending': 'Pending ({n})',
    'syncFailed': 'Sync failed',
    'dataExpired': 'Offline data expired',
    'loginRequired': 'Login required',
    'deviceBlocked': 'Device blocked',
    'stateSaved': 'Saved on this device — waiting to sync',
    'stateSynced': 'Synced — confirmed by server',
    'stateRejected': 'Rejected — {r}',
    'readinessTitle': 'Offline readiness',
    'lastSync': 'Last successful sync',
    'dataAsOf': 'Data as of',
    'dataAge': 'Data age',
    'cachedMembers': 'Cached members',
    'cachedAssignments': 'Cached assignments',
    'offlineEnabled': 'Offline mode enabled for this gym',
    'yes': 'Yes',
    'no': 'No',
    'never': 'Never',
    'refreshData': 'Refresh offline data',
    'syncNow': 'Sync now',
    'thisDevice': 'This device',
    'nothingRecorded': 'Nothing recorded on this device yet.',
    'rejectedTitle': 'Not accepted by the server',
    'reasonCode': 'Reason code',
    'recordedAt': 'Recorded at',
    'readOnlyNote': 'Recorded items can\'t be edited or deleted here.',
    'storeUnavailable': 'Offline storage is unavailable on this device right now.',
    'offlineModeTitle': 'OFFLINE MODE',
    'offlineModeBody': 'Can\'t reach the gym. You can scan passes and log sessions from the data saved on this device; they sync when you\'re back online.',
    'onlineOnlyNotice': 'Session history, today\'s log and member details need a connection.',
    'retryOnline': 'Try to reconnect',
    'policyOffNote': 'Offline mode is off for this gym — sessions are logged online.',
    'policyOffOffline': 'Offline mode is off for this gym, so sessions can\'t be logged without a connection.',
    'logSession': 'Log a session',
    'scanPass': 'Scan member pass',
    'searchHint': 'Search name or member #',
    'pickMember': 'Pick a member',
    'pickAssignment': 'Pick a package',
    'noActiveAssignments': 'No active package for this member (as of the last sync).',
    'noteHint': 'Note (optional)',
    'confirmSession': 'Confirm session',
    'sessionsLeft': '{n} left',
    'asOf': 'as of {t}',
    'savedOnDevice': 'Saved on this device — waiting to sync',
    'syncedConfirmed': 'Synced — confirmed by server',
    'loggedOnline': 'Logged — confirmed by server',
    'done': 'Done',
    'scanAgain': 'Scan again',
    'confirmIdentity': 'Check the photo and name before confirming.',
    'cameraHint': 'Point the camera at the member\'s CLBY pass.',
    'recentlyLogged': 'Already logged in the last 30 minutes — try again in {m} min.',
    'duplicateTap': 'Already saved a moment ago.',
    'clockSkew': 'This device\'s date/time is wrong. Fix it and try again.',
    'block_notSignedIn': 'Offline mode isn\'t available: you\'re not signed in on this device.',
    'block_noPreviousSession': 'Offline mode isn\'t available: sign in online once on this device first.',
    'block_differentUser': 'Offline mode isn\'t available: the saved data belongs to another account.',
    'block_differentApi': 'Offline mode isn\'t available: the saved data is for a different server.',
    'block_storeUnavailable': 'Offline mode isn\'t available: this device\'s offline storage can\'t be opened right now.',
    'block_noCachedData': 'Offline mode isn\'t available: no offline data has been downloaded yet.',
    'passInvalid': 'Not a valid CLBY member pass.',
    'passUnknownKey': 'Unknown pass key — refresh offline data while online.',
    'passWrongGym': 'This pass belongs to another gym',
    'passExpired': 'This pass has expired — ask the member to open the app online.',
    'passMemberNotFound': 'Member not in this device\'s data — refresh offline data.',
    'passNeedsData': 'Pass checking needs offline data — connect once to download it.',
  };

  static const _ar = <String, String>{
    'online': 'متصل',
    'offline': 'غير متصل',
    'syncing': 'جارٍ المزامنة',
    'pending': 'قيد الانتظار ({n})',
    'syncFailed': 'فشلت المزامنة',
    'dataExpired': 'انتهت صلاحية البيانات المحفوظة',
    'loginRequired': 'يلزم تسجيل الدخول',
    'deviceBlocked': 'الجهاز محظور',
    'stateSaved': 'محفوظ على هذا الجهاز — بانتظار المزامنة',
    'stateSynced': 'تمت المزامنة — أكدها الخادم',
    'stateRejected': 'مرفوض — {r}',
    'readinessTitle': 'جاهزية العمل دون اتصال',
    'lastSync': 'آخر مزامنة ناجحة',
    'dataAsOf': 'البيانات بتاريخ',
    'dataAge': 'عمر البيانات',
    'cachedMembers': 'الأعضاء المحفوظون',
    'cachedAssignments': 'الباقات المحفوظة',
    'offlineEnabled': 'وضع عدم الاتصال مفعّل لهذا النادي',
    'yes': 'نعم',
    'no': 'لا',
    'never': 'أبدًا',
    'refreshData': 'تحديث البيانات المحفوظة',
    'syncNow': 'زامن الآن',
    'thisDevice': 'هذا الجهاز',
    'nothingRecorded': 'لم يُسجَّل شيء على هذا الجهاز بعد.',
    'rejectedTitle': 'لم يقبله الخادم',
    'reasonCode': 'رمز السبب',
    'recordedAt': 'وقت التسجيل',
    'readOnlyNote': 'لا يمكن تعديل العناصر المسجلة أو حذفها هنا.',
    'storeUnavailable': 'التخزين دون اتصال غير متاح على هذا الجهاز حاليًا.',
    'offlineModeTitle': 'وضع عدم الاتصال',
    'offlineModeBody': 'تعذّر الوصول إلى النادي. يمكنك مسح البطاقات وتسجيل الجلسات من البيانات المحفوظة على هذا الجهاز، وستتم مزامنتها عند عودة الاتصال.',
    'onlineOnlyNotice': 'سجل الجلسات وسجل اليوم وتفاصيل الأعضاء تحتاج إلى اتصال.',
    'retryOnline': 'حاول الاتصال مجددًا',
    'policyOffNote': 'وضع عدم الاتصال متوقف لهذا النادي — تُسجَّل الجلسات عبر الإنترنت.',
    'policyOffOffline': 'وضع عدم الاتصال متوقف لهذا النادي، لذا لا يمكن تسجيل الجلسات دون اتصال.',
    'logSession': 'تسجيل جلسة',
    'scanPass': 'مسح بطاقة العضو',
    'searchHint': 'ابحث بالاسم أو رقم العضوية',
    'pickMember': 'اختر عضوًا',
    'pickAssignment': 'اختر الباقة',
    'noActiveAssignments': 'لا توجد باقة نشطة لهذا العضو (حسب آخر مزامنة).',
    'noteHint': 'ملاحظة (اختياري)',
    'confirmSession': 'تأكيد الجلسة',
    'sessionsLeft': 'متبقٍ {n}',
    'asOf': 'بتاريخ {t}',
    'savedOnDevice': 'محفوظ على هذا الجهاز — بانتظار المزامنة',
    'syncedConfirmed': 'تمت المزامنة — أكدها الخادم',
    'loggedOnline': 'تم التسجيل — أكده الخادم',
    'done': 'تم',
    'scanAgain': 'امسح مجددًا',
    'confirmIdentity': 'تحقق من الصورة والاسم قبل التأكيد.',
    'cameraHint': 'وجّه الكاميرا نحو بطاقة CLBY الخاصة بالعضو.',
    'recentlyLogged': 'سُجّلت جلسة خلال آخر 30 دقيقة — حاول بعد {m} دقيقة.',
    'duplicateTap': 'تم الحفظ قبل لحظات.',
    'clockSkew': 'تاريخ/وقت هذا الجهاز غير صحيح. صحّحه وحاول مجددًا.',
    'block_notSignedIn': 'وضع عدم الاتصال غير متاح: لم تسجّل الدخول على هذا الجهاز.',
    'block_noPreviousSession': 'وضع عدم الاتصال غير متاح: سجّل الدخول مرة واحدة على هذا الجهاز وأنت متصل أولًا.',
    'block_differentUser': 'وضع عدم الاتصال غير متاح: البيانات المحفوظة تخص حسابًا آخر.',
    'block_differentApi': 'وضع عدم الاتصال غير متاح: البيانات المحفوظة لخادم مختلف.',
    'block_storeUnavailable': 'وضع عدم الاتصال غير متاح: تعذّر فتح التخزين دون اتصال على هذا الجهاز حاليًا.',
    'block_noCachedData': 'وضع عدم الاتصال غير متاح: لم يتم تنزيل بيانات للعمل دون اتصال بعد.',
    'passInvalid': 'ليست بطاقة عضوية CLBY صالحة.',
    'passUnknownKey': 'مفتاح البطاقة غير معروف — حدّث البيانات المحفوظة أثناء الاتصال.',
    'passWrongGym': 'هذه البطاقة تخص ناديًا آخر.',
    'passExpired': 'انتهت صلاحية البطاقة — اطلب من العضو فتح التطبيق وهو متصل.',
    'passMemberNotFound': 'العضو غير موجود في بيانات هذا الجهاز — حدّث البيانات المحفوظة.',
    'passNeedsData': 'التحقق من البطاقات يحتاج إلى بيانات محفوظة — اتصل مرة لتنزيلها.',
  };

  /// All keys (tests check both languages are complete).
  static Iterable<String> get keys => _en.keys;
  static bool hasArabic(String key) => _ar.containsKey(key);
}

/// Wraps an offline screen in the strings' text direction.
class OfflineDirectionality extends StatelessWidget {
  const OfflineDirectionality({super.key, required this.child, this.strings});
  final Widget child;
  final OfflineStrings? strings;

  @override
  Widget build(BuildContext context) => Directionality(
      textDirection: (strings ?? OfflineStrings.current()).direction, child: child);
}
