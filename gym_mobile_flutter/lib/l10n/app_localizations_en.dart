// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get commonCancel => 'Cancel';

  @override
  String get commonSave => 'Save';

  @override
  String get commonConfirm => 'Confirm';

  @override
  String get commonRetry => 'Retry';

  @override
  String get commonClose => 'Close';

  @override
  String get commonOk => 'OK';

  @override
  String get commonDone => 'Done';

  @override
  String get commonDelete => 'Delete';

  @override
  String get commonEdit => 'Edit';

  @override
  String get commonBack => 'Back';

  @override
  String get commonNext => 'Next';

  @override
  String get commonSkip => 'Skip';

  @override
  String get commonLoading => 'Loading…';

  @override
  String get commonError => 'Something went wrong. Please try again.';

  @override
  String get commonNoResults => 'No results found';

  @override
  String get commonSearch => 'Search';

  @override
  String get commonSeeAll => 'See all';

  @override
  String get commonBookNow => 'Book now';

  @override
  String get commonLogout => 'Log out';

  @override
  String get commonYes => 'Yes';

  @override
  String get commonNo => 'No';

  @override
  String get commonSessions => 'Sessions';

  @override
  String get commonMinutes => 'min';

  @override
  String get commonFree => 'Free';

  @override
  String get commonActive => 'Active';

  @override
  String get commonExpired => 'Expired';

  @override
  String get commonLanguage => 'Language';

  @override
  String get commonEnglish => 'English';

  @override
  String get commonArabic => 'العربية';

  @override
  String get commonSystemDefault => 'System default';

  @override
  String get authEmailLabel => 'Email';

  @override
  String get authEmailPlaceholder => 'you@example.com';

  @override
  String get authPasswordLabel => 'Password';

  @override
  String get authForgotPassword => 'Forgot password?';

  @override
  String get authSignIn => 'Sign in';

  @override
  String get authContinue => 'Continue';

  @override
  String get authContinueToSignIn => 'Continue to sign in';

  @override
  String get authEmailInvalid => 'Enter a valid email address';

  @override
  String get authAtLeast8Chars => 'At least 8 characters';

  @override
  String get authOneUppercase => 'One uppercase letter';

  @override
  String get authOneNumber => 'One number';

  @override
  String get authChip8Chars => '8+ chars';

  @override
  String get authChipUppercase => 'Uppercase';

  @override
  String get authChipNumber => 'Number';

  @override
  String get authStrengthTooShort => 'Too short';

  @override
  String get authStrengthWeak => 'Weak';

  @override
  String get authStrengthOkay => 'Okay';

  @override
  String get authStrengthStrong => 'Strong';

  @override
  String get authStrengthVeryStrong => 'Very strong';

  @override
  String get authOr => 'or';

  @override
  String get authPoweredByClby => 'Powered by CLBY';

  @override
  String get loginWelcomeBack => 'Welcome back';

  @override
  String get loginSubtitle => 'Sign in to manage your sessions and transfers.';

  @override
  String get loginEmailRequired => 'Email is required';

  @override
  String get loginPasswordRequired => 'Password is required';

  @override
  String get loginAccountDeleted =>
      'This account has been deleted. You can still restore it by signing up again.';

  @override
  String get loginInvalidCredentials => 'Incorrect email or password.';

  @override
  String get loginVerifyEmailTitle => 'Verify your email';

  @override
  String get loginVerifyEmailBody =>
      'We sent a confirmation link when you signed up. Tap the link in the email to activate your account. Check spam if you can\'t find it.';

  @override
  String get loginVerificationSent =>
      'Verification email sent. Check your inbox.';

  @override
  String get loginResendFailed => 'Could not resend. Try again in a minute.';

  @override
  String get loginResendEmail => 'Resend email';

  @override
  String get loginNewHere => 'New here? ';

  @override
  String get loginCreateAccount => 'Create an account';

  @override
  String get forgotIntroPrefix =>
      'Enter the email tied to your account. We\'ll send a reset link valid for ';

  @override
  String get forgotIntroDuration => '30 minutes';

  @override
  String get forgotSendLink => 'Send reset link';

  @override
  String get forgotCheckEmail => 'Check your email';

  @override
  String get forgotSentLinkTo => 'We sent a reset link to';

  @override
  String get forgotSpamHint =>
      'Didn\'t get it? Check your spam folder, or wait a minute before requesting another link.';

  @override
  String get forgotBackToSignIn => 'Back to sign in';

  @override
  String get forgotLinkSentAgain => 'Link sent again ✓';

  @override
  String get forgotResendLink => 'Resend link';

  @override
  String forgotResendIn(int seconds) {
    return 'Resend link in ${seconds}s';
  }

  @override
  String get resetPwLinkExpired =>
      'Reset link expired. Please request a new one.';

  @override
  String get resetPwTitle => 'Set a new password';

  @override
  String get resetPwSubtitle => 'Choose something you haven\'t used before.';

  @override
  String get resetPwNewPassword => 'New password';

  @override
  String get resetPwConfirmPassword => 'Confirm password';

  @override
  String get resetPwConfirmPlaceholder => 'Type it again';

  @override
  String get resetPwMismatch => 'Passwords don\'t match';

  @override
  String get resetPwUpdate => 'Update password';

  @override
  String get resetPwUpdated => 'Password updated';

  @override
  String get resetPwUpdatedBody =>
      'You can now sign in with your new password.';

  @override
  String get registerTitle => 'Create your account';

  @override
  String get registerSubtitle =>
      'Email and a strong password — we\'ll keep your account safe.';

  @override
  String get registerAlreadyHaveAccount => 'Already have an account? ';

  @override
  String get registerStepAccount => 'Account';

  @override
  String get registerStepYou => 'You';

  @override
  String get registerStepClub => 'Club';

  @override
  String get registerAboutYouTitle => 'A bit about you';

  @override
  String get registerFullNameLabel => 'Full name';

  @override
  String get registerFullNamePlaceholder => 'e.g. Ahmed Hassan';

  @override
  String get registerDateOfBirth => 'Date of birth';

  @override
  String get registerDayHint => 'DD';

  @override
  String get registerMonthHint => 'Month';

  @override
  String get registerYearHint => 'YYYY';

  @override
  String registerAgeYears(int age) {
    return '$age years old ✓';
  }

  @override
  String get registerAgeTooYoung => 'You must be at least 13 to sign up.';

  @override
  String get registerMobile => 'Mobile';

  @override
  String get registerOptional => 'Optional';

  @override
  String get registerSelectCountry => 'Select country';

  @override
  String get registerCreateAccount => 'Create account';

  @override
  String get registerLegalPrefix => 'By creating an account you agree to our ';

  @override
  String get registerClubTitle => 'Pick your club';

  @override
  String get registerClubSubtitle =>
      'This is the home location your sessions are tied to.';

  @override
  String get registerSearchPlaceholder => 'Search by name or area';

  @override
  String get registerNoClubs => 'No clubs available right now.';

  @override
  String registerNoClubsMatch(String query) {
    return 'No clubs match \"$query\".';
  }

  @override
  String get registerAllSet => 'You\'re all set';

  @override
  String get registerConfirmationSentTo => 'We sent a confirmation link to';

  @override
  String get registerYourInbox => 'your inbox';

  @override
  String get registerActivateHint =>
      'Tap the link to activate your account, then sign in.';

  @override
  String get registerEmailExists =>
      'This email is already registered. Use Forgot Password if you lost access.';

  @override
  String get registerPhoneExists => 'This phone number is already registered.';

  @override
  String get registerWeakPassword =>
      'Password is too weak. Use at least 8 characters.';

  @override
  String get registerMonthJanuary => 'January';

  @override
  String get registerMonthFebruary => 'February';

  @override
  String get registerMonthMarch => 'March';

  @override
  String get registerMonthApril => 'April';

  @override
  String get registerMonthMay => 'May';

  @override
  String get registerMonthJune => 'June';

  @override
  String get registerMonthJuly => 'July';

  @override
  String get registerMonthAugust => 'August';

  @override
  String get registerMonthSeptember => 'September';

  @override
  String get registerMonthOctober => 'October';

  @override
  String get registerMonthNovember => 'November';

  @override
  String get registerMonthDecember => 'December';

  @override
  String get navHome => 'Home';

  @override
  String get navClasses => 'Classes';

  @override
  String get navExplore => 'Explore';

  @override
  String get navProfile => 'Profile';

  @override
  String get homeGreetingMorning => 'Good morning';

  @override
  String get homeGreetingAfternoon => 'Good afternoon';

  @override
  String get homeGreetingEvening => 'Good evening';

  @override
  String homeGreetingWithName(String greeting, String name) {
    return '$greeting, $name';
  }

  @override
  String get homeYourMembership => 'Your membership';

  @override
  String get homeViewPlan => 'View plan';

  @override
  String get homeTodaysClasses => 'Today\'s classes';

  @override
  String get homeYourActivity => 'Your activity';

  @override
  String get homeQuickAccess => 'Quick access';

  @override
  String get homeQuickAccessSubtitle => 'Jump straight where you need';

  @override
  String get homeOurLocations => 'Our locations';

  @override
  String get homeNoActiveMembership => 'No active membership';

  @override
  String get homeNoPlanBody =>
      'You don\'t have a plan yet. Choose a membership to unlock full access.';

  @override
  String get homeBrowsePlans => 'Browse membership plans';

  @override
  String get homeNoClassesToday => 'No classes scheduled today';

  @override
  String get homeClassFallback => 'Class';

  @override
  String get homeSessionBooked => 'Session booked successfully!';

  @override
  String get homeBookFailed => 'Failed to book. Please try again.';

  @override
  String get homeBookingCancelled => 'Booking cancelled.';

  @override
  String get homeCancelFailed => 'Failed to cancel. Please try again.';

  @override
  String homeCoachName(String name) {
    return 'Coach $name';
  }

  @override
  String get homeSpotsOpen => 'Open';

  @override
  String get homeSpotsFull => 'Full';

  @override
  String homeSpotsLeft(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count spots left',
      one: '$count spot left',
    );
    return '$_temp0';
  }

  @override
  String get homeThisMonth => 'This month';

  @override
  String get homeMonthlyVisits => 'MONTHLY VISITS';

  @override
  String get homeGymCapacity => 'GYM CAPACITY';

  @override
  String get homeCapacityNotCrowded => 'Not crowded';

  @override
  String get homeCapacityModerate => 'Moderately busy';

  @override
  String get homeCapacityVeryBusy => 'Very busy';

  @override
  String get homeQuickClasses => 'Classes';

  @override
  String get homeQuickTrainers => 'Trainers';

  @override
  String get homeQuickBookings => 'Bookings';

  @override
  String get homeQuickPayments => 'Payments';

  @override
  String get homeQuickAttendance => 'Attendance';

  @override
  String get homeQuickOffers => 'Offers';

  @override
  String get notifTitle => 'Notifications';

  @override
  String get notifGroupToday => 'TODAY';

  @override
  String get notifGroupYesterday => 'YESTERDAY';

  @override
  String get notifGroupEarlier => 'EARLIER';

  @override
  String get notifFilterAll => 'All';

  @override
  String get notifFilterUnread => 'Unread';

  @override
  String get notifFilterRead => 'Read';

  @override
  String get notifEmptyTitle => 'No notifications yet';

  @override
  String get notifEmptySubtitle =>
      'You\'ll see updates about bookings, payments, and activities here.';

  @override
  String get notifAllCaughtUp => 'All caught up!';

  @override
  String get notifNoRead => 'No read notifications';

  @override
  String get notifNoUnreadSubtitle =>
      'You have no unread notifications right now.';

  @override
  String get notifReadSubtitle =>
      'Notifications you\'ve opened will appear here.';

  @override
  String get notifLoadFailed => 'Failed to load notifications';

  @override
  String notifYesterdayAt(String time) {
    return 'Yesterday, $time';
  }

  @override
  String notifDaysAgo(int count) {
    return '$count days ago';
  }

  @override
  String get notifWeekAgo => '1 week ago';

  @override
  String get locationsTitle => 'Our Locations';

  @override
  String get locationsOpenInMaps => 'Open in Maps';

  @override
  String get attendanceTitle => 'Attendance';

  @override
  String get attendanceActivePlan => 'Active Plan';

  @override
  String get attendanceMembershipLabel => 'MEMBERSHIP';

  @override
  String get attendanceMemberNumberLabel => 'MEMBER #';

  @override
  String get attendanceRenewsLabel => 'RENEWS';

  @override
  String get attendanceScanQr => 'Scan QR to check in';

  @override
  String get attendanceFilterAll => 'All';

  @override
  String get attendanceFilterEntrance => 'Entrance';

  @override
  String get attendanceFilterClasses => 'Classes';

  @override
  String get attendanceFilterTransfers => 'Transfers';

  @override
  String get attendanceDateChip => 'Date';

  @override
  String attendanceCheckInCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count check-ins',
      one: '$count check-in',
    );
    return '$_temp0';
  }

  @override
  String attendanceTransferCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count transfers',
      one: '$count transfer',
    );
    return '$_temp0';
  }

  @override
  String attendanceGrantCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count grants',
      one: '$count grant',
    );
    return '$_temp0';
  }

  @override
  String get attendanceViewAllCheckIns => 'View all check-ins';

  @override
  String get attendanceClubEntrance => 'Club Entrance';

  @override
  String get attendanceManualCheckIn => 'Manual check-in';

  @override
  String get attendanceTodayBadge => 'TODAY';

  @override
  String attendanceSentSessions(int count, String name) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Sent $count sessions to $name',
      one: 'Sent $count session to $name',
    );
    return '$_temp0';
  }

  @override
  String attendanceReceivedSessions(int count, String name) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Received $count sessions from $name',
      one: 'Received $count session from $name',
    );
    return '$_temp0';
  }

  @override
  String attendanceGrantedSessions(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Added $count sessions',
      one: 'Added $count session',
    );
    return '$_temp0';
  }

  @override
  String attendanceGrantedSessionsBy(int count, String name) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Added $count sessions by $name',
      one: 'Added $count session by $name',
    );
    return '$_temp0';
  }

  @override
  String get attendanceEmptyTitle => 'No attendance records found';

  @override
  String get attendanceEmptySubtitle =>
      'Try a different filter or scan to check in.';

  @override
  String get attendanceLoadFailed => 'Failed to load attendance';

  @override
  String get attendanceSuspendedTitle => 'Membership suspended';

  @override
  String get attendanceNoMembershipTitle => 'No active membership';

  @override
  String get attendanceSuspendedBody =>
      'Your membership has been suspended. Contact the gym to resolve this.';

  @override
  String get attendanceNoMembershipBody =>
      'Pick a plan to start checking in, booking classes, and tracking your attendance.';

  @override
  String get attendanceBrowseMemberships => 'Browse memberships';

  @override
  String get attendanceCheckInHistory => 'CHECK-IN HISTORY';

  @override
  String get attendanceNothingYet => 'Nothing here yet';

  @override
  String get attendanceNothingYetBody =>
      'Once you start a membership, every check-in will show up right here.';

  @override
  String get attendanceFilterByDate => 'Filter by date';

  @override
  String get attendanceFilterByDateSubtitle => 'Pick a from / to range.';

  @override
  String get attendanceReset => 'Reset';

  @override
  String get attendanceFrom => 'From';

  @override
  String get attendanceTo => 'To';

  @override
  String get attendanceWeekdayLetters => 'S,M,T,W,T,F,S';

  @override
  String get attendanceSelectDate => 'Select date';

  @override
  String get attendanceApply => 'Apply';

  @override
  String get attHistoryTitle => 'Attendance History';

  @override
  String get attHistoryClear => 'Clear';

  @override
  String get attHistoryFilterAll => 'All';

  @override
  String get attHistoryGymEntrance => 'Gym Entrance';

  @override
  String get attHistoryFilterClasses => 'Classes';

  @override
  String get attHistoryFilterManual => 'Manual';

  @override
  String get attHistoryFromDate => 'From date';

  @override
  String get attHistoryToDate => 'To date';

  @override
  String get attHistoryNoCheckIns => 'No check-ins found';

  @override
  String get attHistoryManualCheckIn => 'Manual Check-in';

  @override
  String get attHistoryClass => 'Class';

  @override
  String get attHistoryCheckIn => 'Check-in';

  @override
  String get attHistoryToday => 'Today';

  @override
  String get exploreTitle => 'Explore';

  @override
  String get exploreOurGym => 'Our gym';

  @override
  String get exploreSearchHint =>
      'Search for classes, specialists, programs or offers';

  @override
  String exploreNoResultsFor(String query) {
    return 'No results for \"$query\"';
  }

  @override
  String get exploreMemberships => 'Memberships';

  @override
  String exploreGymMembershipPlans(String gymName) {
    return '$gymName membership plans';
  }

  @override
  String get explorePerMonth => '/ month';

  @override
  String get explorePerYear => '/ year';

  @override
  String get explorePerQuarter => '/ quarter';

  @override
  String get exploreOneTime => 'one time';

  @override
  String get exploreTapSeeBenefits => 'Tap to see full benefits';

  @override
  String get exploreViewPlans => 'View plans ›';

  @override
  String get exploreCurrentOffers => 'Current offers';

  @override
  String exploreExpires(String date) {
    return 'Expires $date';
  }

  @override
  String get exploreOurSpecialists => 'Our specialists';

  @override
  String get exploreSpecialtyNutrition => 'Nutrition';

  @override
  String get exploreSpecialtyPhysio => 'Physio';

  @override
  String get exploreSpecialtyPt => 'PT';

  @override
  String get explorePrograms => 'Programs';

  @override
  String exploreWeeksCount(int weeks) {
    return '$weeks weeks';
  }

  @override
  String get exploreSessionPackages => 'Session packages';

  @override
  String exploreSessionsCount(int count) {
    return '$count sessions';
  }

  @override
  String exploreSessionsPackageSubtitle(int count) {
    return '$count sessions package';
  }

  @override
  String get exploreSessionsLabel => 'sessions';

  @override
  String explorePerSessionPrice(String price) {
    return '$price / session';
  }

  @override
  String get exploreOurPartners => 'Our partners';

  @override
  String get exploreTypeSpecialist => 'Specialist';

  @override
  String get exploreTypeProgram => 'Program';

  @override
  String get exploreTypeOffer => 'Offer';

  @override
  String get exploreTypeClass => 'Class';

  @override
  String get exploreMembershipPlansTitle => 'Membership plans';

  @override
  String get exploreNoPlans => 'No plans available';

  @override
  String get exploreGetThisPlan => 'Get this plan';

  @override
  String exploreCycleMembership(String cycle) {
    return '$cycle membership';
  }

  @override
  String get exploreNoOffers => 'No current offers';

  @override
  String get exploreNoPrograms => 'No programs available';

  @override
  String get exploreNoSessionPackages => 'No session packages available';

  @override
  String get exploreSessionPackagesIntro =>
      'Buy sessions to use with any class or trainer. Sessions never expire.';

  @override
  String exploreBuySessions(int count) {
    return 'Buy $count sessions';
  }

  @override
  String get exploreMostPopular => 'Most popular';

  @override
  String get trainerListTitle => 'Our trainers';

  @override
  String get trainerNoneFound => 'No trainers found';

  @override
  String get trainerFilterAll => 'All';

  @override
  String get trainerTypeNutritionist => 'Nutritionist';

  @override
  String get trainerTypePhysiotherapist => 'Physiotherapist';

  @override
  String get trainerTypePersonal => 'Personal trainer';

  @override
  String get trainerSpecialtiesTitle => 'SPECIALTIES';

  @override
  String get trainerAboutTitle => 'ABOUT';

  @override
  String get trainerClassesTitle => 'CLASSES';

  @override
  String get trainerReviewsTitle => 'REVIEWS';

  @override
  String trainerShowAllReviews(int count) {
    return 'Show All Reviews ($count)';
  }

  @override
  String get trainerNoReviews => 'No reviews yet';

  @override
  String get trainerMemberFallback => 'Member';

  @override
  String get offerNotFound => 'Offer not found';

  @override
  String get offerClaimCta => 'Claim this offer';

  @override
  String get offerStatDiscount => 'Discount';

  @override
  String get offerStatAccess => 'Access';

  @override
  String get offerStatOffer => 'Offer';

  @override
  String get offerPtSessions => 'PT sessions';

  @override
  String get offerAboutTitle => 'ABOUT THIS OFFER';

  @override
  String get offerTermsTitle => 'TERMS & CONDITIONS';

  @override
  String get offerPriceLabel => 'Offer price';

  @override
  String offerSaveAmount(String amount) {
    return 'Save $amount EGP';
  }

  @override
  String get offerTotalPrice => 'Total price';

  @override
  String get programNotFound => 'Program not found';

  @override
  String get programWeeksLabel => 'Weeks';

  @override
  String get programMinPerClass => 'Min / class';

  @override
  String get programAboutTitle => 'ABOUT THIS PROGRAM';

  @override
  String get programFocusTitle => 'WHAT YOU\'LL WORK ON';

  @override
  String get programLedByTitle => 'LED BY';

  @override
  String get programEnrolCta => 'Enrol in this program';

  @override
  String get programPriceLabel => 'Programme price';

  @override
  String programFullDuration(int weeks) {
    return 'Full $weeks-week programme';
  }

  @override
  String get programPerSessionLabel => 'Per session';

  @override
  String programSessionsTotal(int count) {
    return '$count sessions total';
  }

  @override
  String programPerSessionEgp(String price) {
    return '$price EGP/session';
  }

  @override
  String get membershipActiveServices => 'Active Services';

  @override
  String get membershipMemberDetails => 'Member Details';

  @override
  String get membershipMemberNumber => 'Member Number';

  @override
  String get membershipNoMemberIdYet => 'No Member ID yet';

  @override
  String get membershipStatus => 'Status';

  @override
  String get membershipMemberSince => 'Member Since';

  @override
  String get membershipGuestInvitations => 'Guest Invitations';

  @override
  String get membershipGuestPasses => 'Guest Passes';

  @override
  String membershipInvitationsLeft(int count) {
    return '$count left';
  }

  @override
  String get membershipInviteGuests => 'Invite guests to try the gym';

  @override
  String get membershipBilling => 'Billing';

  @override
  String get membershipViewInvoices => 'View Invoices';

  @override
  String get membershipViewInvoicesSubtitle =>
      'See your payment history & invoices';

  @override
  String get membershipUnfreezeTitle => 'Unfreeze Plan';

  @override
  String get membershipUnfreezeMessage =>
      'Resume your plan now? The remaining freeze days will be forfeited.';

  @override
  String get membershipUnfreeze => 'Unfreeze';

  @override
  String get membershipNoActiveMembership => 'No active membership';

  @override
  String get membershipNoActiveMembershipSubtitle =>
      'Contact your gym to get a plan assigned.';

  @override
  String get membershipExpiredBanner =>
      'Your membership has expired. Contact the gym to renew.';

  @override
  String get membershipExpiresToday => 'Your membership expires today!';

  @override
  String membershipExpiresInDays(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Your membership expires in $count days.',
      one: 'Your membership expires in 1 day.',
    );
    return '$_temp0';
  }

  @override
  String membershipSpecialist(String name) {
    return 'Specialist: $name';
  }

  @override
  String membershipSessionsRemaining(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sessions remaining',
      one: '1 session remaining',
    );
    return '$_temp0';
  }

  @override
  String get bookingsTitle => 'My Bookings';

  @override
  String get bookingsUpcoming => 'Upcoming';

  @override
  String get bookingsPast => 'Past';

  @override
  String get bookingsNoUpcoming => 'No upcoming bookings';

  @override
  String get bookingsNoUpcomingSubtitle => 'Book a class from the Schedule tab';

  @override
  String get bookingsNoPast => 'No past bookings';

  @override
  String get bookingsNoPastSubtitle =>
      'Your attended and cancelled sessions will appear here';

  @override
  String get bookingsLoadFailed => 'Failed to load bookings';

  @override
  String get bookingsClassFallback => 'Class';

  @override
  String bookingsBookedOn(String date) {
    return 'Booked on $date';
  }

  @override
  String get bookingsStatusAttended => 'Attended';

  @override
  String get bookingsStatusCancelled => 'Cancelled';

  @override
  String get bookingsStatusFinished => 'Finished';

  @override
  String get bookingsStatusBooked => 'Booked';

  @override
  String get scheduleTitle => 'Schedule';

  @override
  String get scheduleBookedSuccess => 'Session booked successfully!';

  @override
  String get scheduleBookingCancelled => 'Booking cancelled.';

  @override
  String get scheduleCancelFailed => 'Failed to cancel. Please try again.';

  @override
  String get scheduleSearchHint => 'Search classes, trainers, locations…';

  @override
  String scheduleClassCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count classes',
      one: '1 class',
    );
    return '$_temp0';
  }

  @override
  String get scheduleAllBranches => 'All branches';

  @override
  String get scheduleAllClasses => 'All classes';

  @override
  String get scheduleRestDayTitle => 'Rest day. Officially.';

  @override
  String get scheduleRestDaySubtitle =>
      'No classes today. Your muscles have the day off.';

  @override
  String get scheduleCtaStatsTitle => 'Check your attendance stats';

  @override
  String get scheduleCtaStatsSubtitle => 'Admire how hard you\'ve been working';

  @override
  String get scheduleCtaOffersTitle => 'Explore membership offers';

  @override
  String get scheduleCtaOffersSubtitle =>
      'Treat yourself. You showed up all week.';

  @override
  String get scheduleNoMatchFilters => 'No classes match your filters';

  @override
  String get scheduleClearFilters => 'Clear filters';

  @override
  String get scheduleLoadFailed => 'Failed to load sessions';

  @override
  String get scheduleFilterClasses => 'Filter Classes';

  @override
  String get scheduleReset => 'Reset';

  @override
  String get scheduleClassType => 'Class Type';

  @override
  String get scheduleTimeOfDay => 'Time of Day';

  @override
  String get scheduleMorning => 'Morning';

  @override
  String get scheduleMorningRange => '6am–12pm';

  @override
  String get scheduleAfternoon => 'Afternoon';

  @override
  String get scheduleAfternoonRange => '12–5pm';

  @override
  String get scheduleEvening => 'Evening';

  @override
  String get scheduleEveningRange => '5–10pm';

  @override
  String get scheduleTrainer => 'Trainer';

  @override
  String get scheduleLocation => 'Location';

  @override
  String get scheduleApplyFilters => 'Apply Filters';

  @override
  String get sessionShareFallbackName => 'a class';

  @override
  String sessionShareWith(String instructor) {
    return ' with $instructor';
  }

  @override
  String sessionShareMessage(
    String className,
    String coachPart,
    String time,
    String date,
  ) {
    return 'Join me for $className$coachPart at $time on $date 💪';
  }

  @override
  String sessionShareBookHere(String link) {
    return 'Book here: $link';
  }

  @override
  String sessionShareSubject(String className, String date) {
    return 'Join me for $className on $date';
  }

  @override
  String get sessionAlreadyBooked => 'You\'ve already booked this session.';

  @override
  String get sessionNowFull => 'Sorry, this class is now full.';

  @override
  String get sessionBookFailed => 'Failed to book. Please try again.';

  @override
  String sessionCancelFailed(String error) {
    return 'Failed to cancel: $error';
  }

  @override
  String get sessionAboutClass => 'ABOUT THIS CLASS';

  @override
  String get sessionWhatToExpect => 'WHAT TO EXPECT';

  @override
  String get sessionOtherClassesToday => 'OTHER CLASSES TODAY';

  @override
  String get sessionTagCardioBursts => 'Cardio bursts';

  @override
  String get sessionTagBodyweightMoves => 'Bodyweight moves';

  @override
  String get sessionTagCoreWork => 'Core work';

  @override
  String get sessionTagHighIntensity => 'High intensity';

  @override
  String get sessionTagNoEquipment => 'No equipment';

  @override
  String get sessionTagFlexibility => 'Flexibility';

  @override
  String get sessionTagBreathing => 'Breathing';

  @override
  String get sessionTagBalance => 'Balance';

  @override
  String get sessionTagMindfulness => 'Mindfulness';

  @override
  String get sessionTagCardio => 'Cardio';

  @override
  String get sessionTagLowImpact => 'Low impact';

  @override
  String get sessionTagEndurance => 'Endurance';

  @override
  String get sessionTagMusicDriven => 'Music-driven';

  @override
  String get sessionTagStrength => 'Strength';

  @override
  String get sessionTagFootwork => 'Footwork';

  @override
  String get sessionTagBagWork => 'Bag work';

  @override
  String get sessionTagCoreStrength => 'Core strength';

  @override
  String get sessionTagPosture => 'Posture';

  @override
  String get sessionTagFitness => 'Fitness';

  @override
  String get sessionTagFun => 'Fun';

  @override
  String get sessionStatusCancelled => 'Cancelled';

  @override
  String get sessionStatusAttended => 'Attended';

  @override
  String get sessionStatusFinished => 'Finished';

  @override
  String get sessionStatusOngoing => 'Ongoing';

  @override
  String get sessionStatusBooked => 'Booked';

  @override
  String get sessionStatusFull => 'Full';

  @override
  String get sessionStatusOpen => 'Open';

  @override
  String sessionMinutesLong(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count minutes',
      one: '1 minute',
    );
    return '$_temp0';
  }

  @override
  String get sessionTime => 'Time';

  @override
  String get sessionDate => 'Date';

  @override
  String get sessionDuration => 'Duration';

  @override
  String get sessionFitnessSpecialist => 'Fitness Specialist';

  @override
  String sessionCoachName(String name) {
    return 'Coach $name';
  }

  @override
  String get sessionCapacity => 'Session capacity';

  @override
  String sessionPercentBooked(int percent) {
    return '$percent% booked';
  }

  @override
  String sessionSpotsLeft(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count spots left',
      one: '1 spot left',
    );
    return '$_temp0';
  }

  @override
  String get sessionClassFull => 'Class is full';

  @override
  String get sessionCancelledInfo => 'This session has been cancelled';

  @override
  String get sessionGreatWork => 'Great work — you showed up!';

  @override
  String get sessionLogged => 'Session logged';

  @override
  String get sessionEndedNotAttended => 'This class has ended · not attended';

  @override
  String sessionStartedAt(String time) {
    return 'Class started at $time';
  }

  @override
  String get sessionInProgress => 'In progress';

  @override
  String get sessionConfirmedInfo => 'You\'re confirmed for this class';

  @override
  String get sessionConfirmedBadge => 'Confirmed';

  @override
  String get sessionFullInfo => 'This class has reached full capacity';

  @override
  String get sessionUsesOne => 'Uses 1 session from your plan';

  @override
  String get sessionFreeWithPlan => 'Free with plan';

  @override
  String get sessionCancelledButton => 'Session cancelled';

  @override
  String get sessionClassEnded => 'Class ended';

  @override
  String get sessionClassOngoing => 'Class is ongoing';

  @override
  String get sessionBookingConfirmed => 'Booking confirmed';

  @override
  String get sessionWalkInScan => 'Walk-in · scan the studio QR';

  @override
  String get sessionBookThisClass => 'Book this class';

  @override
  String get sessionRateThisClass => 'Rate this class';

  @override
  String get sessionCancelBooking => 'Cancel booking';

  @override
  String get sessionConfirmBooking => 'Confirm Booking';

  @override
  String get sessionInstructor => 'Instructor';

  @override
  String get sessionTbd => 'TBD';

  @override
  String get sessionAvailability => 'Availability';

  @override
  String get packagesUnitSession => 'session';

  @override
  String get packagesUnitPack => 'pack';

  @override
  String get packagesTagBestValue => 'Best value';

  @override
  String get packagesTagStarter => 'Starter';

  @override
  String get packagesNoneAvailable => 'No packages available';

  @override
  String get packagesChooseBanner =>
      'Choose a package below. You\'ll pick your specialist on the next screen.';

  @override
  String packagesEgpPer(String per) {
    return 'EGP / $per';
  }

  @override
  String packagesEgpEach(int amount) {
    return '$amount EGP each';
  }

  @override
  String get packageSkillInjuryAssessment => 'Injury assessment';

  @override
  String get packageSkillRehabilitation => 'Rehabilitation';

  @override
  String get packageSkillPainManagement => 'Pain management';

  @override
  String get packageSkillPostureCorrection => 'Posture correction';

  @override
  String get packageSkillExerciseTherapy => 'Exercise therapy';

  @override
  String get packageSkillMealPlanning => 'Meal planning';

  @override
  String get packageSkillBodyComposition => 'Body composition';

  @override
  String get packageSkillDietAnalysis => 'Diet analysis';

  @override
  String get packageSkillWeightManagement => 'Weight management';

  @override
  String get packageSkillSupplementAdvice => 'Supplement advice';

  @override
  String get packageSkillStrengthTraining => 'Strength training';

  @override
  String get packageSkillCardio => 'Cardio';

  @override
  String get packageSkillFormCoaching => 'Form coaching';

  @override
  String get packageSkillGoalSetting => 'Goal setting';

  @override
  String get packageSkillHiit => 'HIIT';

  @override
  String get packageSkillFlexibility => 'Flexibility';

  @override
  String get packageChooseCoach => 'Choose your coach';

  @override
  String get packageYourSpecialist => 'Your specialist';

  @override
  String get packageRolePhysiotherapist => 'Physiotherapist';

  @override
  String get packageRoleNutritionist => 'Nutritionist';

  @override
  String get packageRolePersonalTrainer => 'Personal Trainer';

  @override
  String packageSessionsSubtitle(int count, String service) {
    return '$count sessions · $service';
  }

  @override
  String get packagePrice => 'Price';

  @override
  String get packageCurrencyEgp => 'EGP';

  @override
  String packagePricePerWithEach(String per, int amount) {
    return 'per $per · $amount EGP / session';
  }

  @override
  String packagePricePer(String per) {
    return 'per $per';
  }

  @override
  String get packageMinEach => 'Min each';

  @override
  String get packageEgpPerSession => 'EGP/session';

  @override
  String get packageWhatsIncluded => 'WHAT\'S INCLUDED';

  @override
  String get packageNoSpecialist => 'No specialist assigned yet';

  @override
  String get packageSelectCoach => 'Select a coach to continue';

  @override
  String packageBuyNow(int price) {
    return 'Buy now — $price EGP';
  }

  @override
  String packageRating(String rating) {
    return '$rating rating';
  }

  @override
  String get transferLookupFailed => 'Lookup failed. Try again.';

  @override
  String get transferFailedConnection =>
      'Transfer failed. Check your connection and try again.';

  @override
  String get transferInsufficientSessions =>
      'You don\'t have enough sessions left.';

  @override
  String get transferNoEligibleMembership =>
      'You don\'t have a session-based membership to share.';

  @override
  String get transferCannotSelf => 'You can\'t send sessions to yourself.';

  @override
  String get transferReceiverNotInGym => 'That member is not part of this gym.';

  @override
  String get transferReceiverNotFound => 'No member found with that phone.';

  @override
  String get transferTooManyAttempts =>
      'Too many attempts. Wait a minute and try again.';

  @override
  String get transferServerError =>
      'Server error during transfer. Try again or contact support.';

  @override
  String get transferSendSessions => 'Send Sessions';

  @override
  String get transferWhoTitle => 'Who are you sending\nsessions to?';

  @override
  String get transferSearchSubtitle =>
      'Search by their registered mobile number.';

  @override
  String get transferTypeAtLeast3 => 'Type at least 3 digits to search';

  @override
  String get transferYouHave => 'You have';

  @override
  String transferSessionsAvailable(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sessions available',
      one: '1 session available',
    );
    return '$_temp0';
  }

  @override
  String get transferNoSharable =>
      'You don\'t have any sharable sessions right now.';

  @override
  String get transferOneMatch => '1 MATCH';

  @override
  String get transferNoMemberFound => 'No member found';

  @override
  String get transferDoubleCheck =>
      'Double-check the number, or ask them to register first.';

  @override
  String get transferStartTyping =>
      'Start typing your friend\'s mobile number to find them.';

  @override
  String get transferMemberFallback => 'Member';

  @override
  String get transferVerified => 'VERIFIED';

  @override
  String get transferHowMany => 'How many?';

  @override
  String get transferSendingTo => 'SENDING TO';

  @override
  String get transferSessionsCaps => 'SESSIONS';

  @override
  String get transferMax => 'Max';

  @override
  String get transferYoullHaveLeft => 'You\'ll have left';

  @override
  String transferSessionsCount(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count sessions',
      one: '1 session',
    );
    return '$_temp0';
  }

  @override
  String get transferContinue => 'Continue';

  @override
  String get transferConfirmTitle => 'Confirm Transfer';

  @override
  String get transferFrom => 'FROM';

  @override
  String get transferTo => 'TO';

  @override
  String get transferYou => 'You';

  @override
  String get transferSessionType => 'Session type';

  @override
  String get transferQuantity => 'Quantity';

  @override
  String get transferYourBalance => 'Your balance';

  @override
  String get transferBalanceAfter => 'Balance after';

  @override
  String get transferGroupSessions => 'Group sessions';

  @override
  String get transferWarning =>
      'This action can\'t be undone. Transferred sessions inherit the recipient\'s expiry.';

  @override
  String transferSlideToSend(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Slide to send $count sessions',
      one: 'Slide to send 1 session',
    );
    return '$_temp0';
  }

  @override
  String get transferEdit => 'Edit transfer';

  @override
  String get transferSending => 'Sending…';

  @override
  String transferTransferringTo(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Transferring $count sessions to',
      one: 'Transferring 1 session to',
    );
    return '$_temp0';
  }

  @override
  String get transferSent => 'Transfer sent';

  @override
  String get transferDeliveredTo => 'have been delivered to';

  @override
  String get transferNotificationNote => 'They\'ll get a notification.';

  @override
  String get transferRemainingBalance => 'Your remaining balance';

  @override
  String get transferSendAnother => 'Send another transfer';

  @override
  String get transferFailedTitle => 'Transfer failed';

  @override
  String get transferFailedBody =>
      'We couldn\'t complete the transfer. No sessions were taken from your balance.';

  @override
  String get transferUnknownError => 'Unknown error.';

  @override
  String get transferTryAgain => 'Try again';

  @override
  String get transferCancel => 'Cancel transfer';

  @override
  String get qrScanTitle => 'Scan QR Code';

  @override
  String get qrPointInstruction =>
      'Point at an entrance, studio, or specialist QR code';

  @override
  String get qrWrongGymTitle => 'Wrong Gym';

  @override
  String get qrWrongGymSubtitle => 'This QR code belongs to a different gym.';

  @override
  String get qrStudioOnlyTitle => 'Studio access only';

  @override
  String get qrStudioOnlySubtitle =>
      'Transferred sessions can only be used at studio classes — gym-floor entry needs your own active membership.';

  @override
  String get qrBranchNotIncludedTitle => 'Branch Not Included';

  @override
  String get qrBranchNotIncludedSubtitle =>
      'Your plan does not include access to this branch.';

  @override
  String get qrInvalidTitle => 'Invalid QR Code';

  @override
  String get qrMissingStudioInfo => 'Missing studio information.';

  @override
  String get qrMissingSpecialistInfo => 'Missing specialist information.';

  @override
  String get qrNotRecognized =>
      'This QR code is not recognized by the gym app.';

  @override
  String get qrNotRegisteredTitle => 'Not Registered';

  @override
  String get qrNotRegisteredSubtitle =>
      'You are not registered as a member of this gym.';

  @override
  String get qrSpecialistFallback => 'Specialist';

  @override
  String get qrWrongBranchTitle => 'Wrong Branch';

  @override
  String get qrWrongBranchSubtitle =>
      'Your membership is not valid for this branch.';

  @override
  String get qrNoSessionTodayTitle => 'No Session Today';

  @override
  String get qrNoSessionTodaySubtitle =>
      'There is no active session for this class today.';

  @override
  String get qrAlreadyCheckedInTitle => 'Already Checked In';

  @override
  String get qrAlreadyCheckedInSubtitle =>
      'You have already checked in to this session.';

  @override
  String get qrAttendanceRecorded =>
      'Your attendance for this session has already been recorded.';

  @override
  String get qrAlreadyCheckedInRecently =>
      'You\'ve already checked in recently. Please wait a moment before scanning again.';

  @override
  String get qrNotBookedTitle => 'Not Booked';

  @override
  String get qrNotBookedSubtitle =>
      'You don\'t have a booking for today\'s session.';

  @override
  String get qrNotBookedStudioSubtitle =>
      'You don\'t have a booking for today\'s session in this studio.';

  @override
  String get qrBookASession => 'Book a Session';

  @override
  String get qrNoSessionsLeftTitle => 'No Sessions Left';

  @override
  String get qrSessionsExhaustedSubtitle =>
      'You\'ve used all the sessions in your package. Please renew or upgrade your plan.';

  @override
  String get qrSessionsExhaustedShort =>
      'You\'ve used all the sessions in your package. Please renew or upgrade.';

  @override
  String get qrTooEarlyTitle => 'Too Early';

  @override
  String get qrTooEarlySubtitle =>
      'Check-in opens 15 minutes before the session starts.';

  @override
  String qrTooEarlySubtitleAt(String time) {
    return 'Check-in opens 15 minutes before the session starts at $time.';
  }

  @override
  String get qrSessionEndedTitle => 'Session Ended';

  @override
  String get qrSessionEndedSubtitle =>
      'Check-in is no longer available. The session has already ended.';

  @override
  String get qrSomethingWentWrong => 'Something went wrong';

  @override
  String get qrStudioNotFound =>
      'This studio was not found. Please contact staff.';

  @override
  String get qrNoActiveMembershipTitle => 'No Active Membership';

  @override
  String get qrNoActiveMembershipSubtitle =>
      'You don\'t have an active membership. Please speak to reception.';

  @override
  String get qrMembershipFrozenTitle => 'Membership Frozen';

  @override
  String get qrMembershipFrozenSubtitle =>
      'Your membership is currently paused. Unfreeze it to check in.';

  @override
  String get qrStudioAccessNotIncludedTitle => 'Studio Access Not Included';

  @override
  String get qrStudioAccessNotIncludedSubtitle =>
      'Your current plan only includes gym floor access. Upgrade to a sessions plan to attend classes.';

  @override
  String get qrNoActiveSessionTitle => 'No Active Session';

  @override
  String get qrNoActiveSessionSubtitle =>
      'There is no class running in this studio right now.';

  @override
  String get qrCheckinDeniedTitle => 'Check-in Denied';

  @override
  String get qrServicePersonalTraining => 'Personal training';

  @override
  String get qrServicePhysiotherapy => 'Physiotherapy';

  @override
  String get qrServiceNutrition => 'Nutrition';

  @override
  String get qrNoPackageTitle => 'No Package Yet';

  @override
  String get qrPackageExpiredTitle => 'Package Expired';

  @override
  String get qrNoPackageSubtitle =>
      'You don\'t have an active session package with this specialist.';

  @override
  String get qrViewPackages => 'View Packages';

  @override
  String get qrAlreadyLoggedTitle => 'Already Logged';

  @override
  String qrTryAgainInMinutes(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'This session was just logged. Try again in about $count minutes.',
      one: 'This session was just logged. Try again in about 1 minute.',
    );
    return '$_temp0';
  }

  @override
  String get qrJustLogged => 'This session was already logged a moment ago.';

  @override
  String get qrSpecialistCodeInvalid =>
      'This specialist code is not valid for your gym.';

  @override
  String get qrCouldNotLogTitle => 'Could Not Log Session';

  @override
  String get qrGymAccessNotIncludedTitle => 'Gym Access Not Included';

  @override
  String get qrGymAccessNotIncludedSubtitle =>
      'Your current plan only includes class sessions. Upgrade to access the gym floor.';

  @override
  String get qrCheckinFailedTitle => 'Check-in Failed';

  @override
  String get qrCodeReplaced =>
      'This QR code has been replaced. Please scan the updated QR code.';

  @override
  String get qrCheckedInTitle => 'Checked In!';

  @override
  String get qrWelcomeBack => 'Welcome back! Your visit has been recorded.';

  @override
  String get qrAttendanceMarkedTitle => 'Attendance Marked!';

  @override
  String get qrSessionLoggedTitle => 'Session Logged!';

  @override
  String qrLastSessionWith(String name) {
    return 'That was your last session with $name.';
  }

  @override
  String qrOneSessionUsedWith(String name) {
    return 'One session used with $name.';
  }

  @override
  String get qrCheckInTime => 'Check-in Time';

  @override
  String get qrGymMainEntrance => 'Gym Main Entrance';

  @override
  String get qrSessionLabel => 'Session';

  @override
  String get qrServiceLabel => 'Service';

  @override
  String get qrSessionsLeftLabel => 'Sessions Left';

  @override
  String qrClosingIn(int seconds) {
    return 'Closing in $seconds seconds…';
  }

  @override
  String get qrScanAgain => 'Scan Again';

  @override
  String get qrNoGymAccessBody =>
      'Your current subscription does not include gym access.\nUpgrade your plan to enter the gym.';

  @override
  String get qrViewMemberships => 'View Memberships';

  @override
  String qrFrozenUntilBody(String date) {
    return 'Your membership is paused until $date.\nYou cannot check in while frozen.';
  }

  @override
  String get qrFrozenBody =>
      'Your membership is currently frozen.\nYou cannot check in while frozen.';

  @override
  String qrUnfreezeFailed(String error) {
    return 'Failed to unfreeze: $error';
  }

  @override
  String get qrResuming => 'Resuming…';

  @override
  String get qrResumeNow => 'Resume Now';

  @override
  String get paymobSecurePayment => 'Secure Payment';

  @override
  String get paymobCardPayment => 'Card Payment';

  @override
  String get paymobTotalAmount => 'Total amount';

  @override
  String get paymobCardDetails => 'Card Details';

  @override
  String paymobPayAmount(String amount) {
    return 'Pay $amount';
  }

  @override
  String get paymobProcessing => 'Processing…';

  @override
  String get paymobDeclinedCheckCard =>
      'Payment was declined. Please check your card details.';

  @override
  String get paymobSecuredFooter =>
      '🔒 Secured by Paymob — your card data is never stored';

  @override
  String get paymentGymNotFound => 'Unable to process payment — gym not found';

  @override
  String get paymentPending =>
      'Payment is pending. We\'ll update your account once confirmed.';

  @override
  String get paymentDeclined => 'Payment was declined. Please try again.';

  @override
  String paymentError(String error) {
    return 'Payment error: $error';
  }

  @override
  String get paymentInvalidPromo => 'Invalid promo code';

  @override
  String get paymentPromoValidationFailed => 'Could not validate promo code';

  @override
  String get paymentSummaryTitle => 'Payment summary';

  @override
  String paymentBuyNow(String amount) {
    return 'Buy now — $amount EGP';
  }

  @override
  String get paymentSecuredBySsl => 'Secured by SSL';

  @override
  String get paymentCurrencyEgp => 'EGP';

  @override
  String paymentAmountEgp(String amount) {
    return '$amount EGP';
  }

  @override
  String paymentMemberDiscountPct(String pct) {
    return '$pct% member discount';
  }

  @override
  String paymentAppliedAsMember(String planName) {
    return 'applied as $planName member';
  }

  @override
  String get paymentPriceBreakdown => 'Price breakdown';

  @override
  String paymentMemberDiscountLabel(String name) {
    return 'Member discount ($name)';
  }

  @override
  String paymentPctOff(String pct) {
    return '$pct% off';
  }

  @override
  String get paymentPromoCode => 'Promo code';

  @override
  String get paymentSubtotal => 'Subtotal';

  @override
  String get paymentVat => 'VAT (14%)';

  @override
  String get paymentTotal => 'Total';

  @override
  String paymentYouSaved(String amount) {
    return 'You saved $amount EGP!';
  }

  @override
  String get paymentApply => 'Apply';

  @override
  String get paymentMethodTitle => 'Payment';

  @override
  String get paymentMethodCard => 'Credit / Debit card';

  @override
  String get paymentTypeMembershipsLower => 'memberships';

  @override
  String get paymentTypeOffersLower => 'offers';

  @override
  String get paymentTypeSessionPackagesLower => 'session packages';

  @override
  String get paymentTypeProgrammesLower => 'programmes';

  @override
  String get paymentStepEmailTitle => 'Check your email';

  @override
  String get paymentStepEmailDesc =>
      'A receipt and booking confirmation have been sent to your registered email address.';

  @override
  String get paymentStepMembershipActiveTitle => 'Membership is now active';

  @override
  String get paymentStepMembershipActiveDesc =>
      'Your plan has been activated. Head to the home screen to view your membership details.';

  @override
  String get paymentStepScanQrTitle => 'Scan QR to check in';

  @override
  String get paymentStepScanQrDesc =>
      'Open the QR tab when you arrive at the gym to log your attendance.';

  @override
  String get paymentStepSessionsAvailableTitle => 'Sessions are now available';

  @override
  String paymentStepSessionsAddedDesc(String title) {
    return 'Your $title sessions have been added to your account. Book them from the Schedule tab.';
  }

  @override
  String get paymentStepScanQrDayOneTitle => 'Scan QR on day one';

  @override
  String get paymentStepScanQrInstructorDesc =>
      'Open the QR tab when you arrive. Your instructor will guide you to the right area.';

  @override
  String get paymentStepOfferMembershipDesc =>
      'Your membership has been activated at the offer price. Head to the home screen to view your plan details.';

  @override
  String get paymentStepOfferSessionsDesc =>
      'Your sessions have been added at the offer price. Book them from the Schedule tab.';

  @override
  String get paymentStepSessionsActiveTitle => 'Sessions are now active';

  @override
  String paymentStepBookFirstDesc(String title) {
    return 'Head to the Schedule tab to book your first $title session.';
  }

  @override
  String get paymentStepScanQrTrainerDesc =>
      'Open the QR tab when you arrive. Your trainer will be ready at your scheduled time.';

  @override
  String get paymentSuccessTitle => 'Purchase successful!';

  @override
  String paymentOrderNumber(String orderNumber) {
    return 'Order #$orderNumber';
  }

  @override
  String get paymentYourOrder => 'YOUR ORDER';

  @override
  String get paymentItem => 'Item';

  @override
  String get paymentDuration => 'Duration';

  @override
  String get paymentDetails => 'Details';

  @override
  String get paymentStarts => 'Starts';

  @override
  String get paymentOriginalPrice => 'Original price';

  @override
  String get paymentOfferDiscount => 'Offer discount';

  @override
  String paymentPromoWithCode(String code) {
    return 'Promo ($code)';
  }

  @override
  String get paymentTotalPaid => 'Total paid';

  @override
  String paymentSavedOnOrder(String amount) {
    return 'You saved $amount EGP on this order';
  }

  @override
  String paymentSavingsBreakdown(String offer, String promo) {
    return '$offer EGP offer + $promo EGP promo';
  }

  @override
  String get paymentWhatHappensNext => 'WHAT HAPPENS NEXT';

  @override
  String get paymentBackToHome => 'Back to home';

  @override
  String paymentBrowseMore(String type) {
    return 'Browse more $type';
  }

  @override
  String get profileTitle => 'Profile';

  @override
  String get profileActiveServices => 'Active services';

  @override
  String get profileAccount => 'Account';

  @override
  String get profileSecurityLabel => 'SECURITY';

  @override
  String get profileSessionLabel => 'SESSION';

  @override
  String get profileAccountLabel => 'ACCOUNT';

  @override
  String get profileDocumentLabel => 'DOCUMENT';

  @override
  String get profileChangePassword => 'Change password';

  @override
  String get profileSignOut => 'Sign out';

  @override
  String get profileDeleteAccount => 'Delete account';

  @override
  String get profileLegal => 'Legal';

  @override
  String get profileTerms => 'Terms & Conditions';

  @override
  String get profilePrivacy => 'Privacy Policy';

  @override
  String get profileMemberFallback => 'Member';

  @override
  String profileMemberSince(String date) {
    return 'Member since $date';
  }

  @override
  String get profileEmailLabel => 'EMAIL';

  @override
  String get profileMobileLabel => 'MOBILE';

  @override
  String get profileDobLabel => 'DATE OF BIRTH';

  @override
  String get profileShareSessions => 'Share sessions';

  @override
  String get profileShareSessionsSubtitle =>
      'Transfer sessions to another member';

  @override
  String get profileTakePhoto => 'Take photo';

  @override
  String get profileChooseFromLibrary => 'Choose from library';

  @override
  String get profileCropPhoto => 'Crop Photo';

  @override
  String get profileCropFailed => 'Failed to crop image';

  @override
  String get profilePhotoUpdated => 'Profile photo updated';

  @override
  String get profileEditProfile => 'Edit profile';

  @override
  String get profileFullName => 'Full name';

  @override
  String get profileMobileWithCode => 'Mobile (with country code)';

  @override
  String get profileDateOfBirth => 'Date of birth';

  @override
  String get profileSelectDob => 'Select Date of Birth';

  @override
  String get profileUpdated => 'Profile updated';

  @override
  String get profileTapToChoose => 'Tap to choose';

  @override
  String get profileNewPassword => 'New password';

  @override
  String get profileConfirmPassword => 'Confirm password';

  @override
  String get profilePasswordMin => 'Password must be at least 8 characters';

  @override
  String get profilePasswordsDontMatch => 'Passwords don\'t match';

  @override
  String get profilePasswordUpdated => 'Password updated';

  @override
  String get profileUpdatePassword => 'Update password';

  @override
  String get profileSignOutConfirmTitle => 'Sign out of your account?';

  @override
  String get profileSignOutConfirmBody =>
      'You can sign back in any time with your email and password.';

  @override
  String get profileDeleteConfirmTitle => 'Delete your account?';

  @override
  String get profileDeleteWarningPrefix =>
      'This permanently removes your profile, sessions, and transfer history. This ';

  @override
  String get profileDeleteWarningEmphasis => 'can\'t be undone';

  @override
  String get profileTypeToConfirmPrefix => 'Type ';

  @override
  String get profileTypeToConfirmSuffix => ' to confirm';

  @override
  String get profilePackageFallback => 'Package';

  @override
  String profileWithTrainer(String name) {
    return 'with $name';
  }

  @override
  String profileOfTotalLeft(int total) {
    return 'of $total left';
  }

  @override
  String get profileMembershipFallback => 'Membership';

  @override
  String profileExpires(String date) {
    return 'Expires $date';
  }

  @override
  String get profileUnlimitedSessions => 'unlimited sessions';

  @override
  String profileSessionsLeftSuffix(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'sessions left',
      one: 'session left',
    );
    return '$_temp0';
  }

  @override
  String profileIncludesTransfers(int count) {
    return 'Includes $count from transfers';
  }

  @override
  String get guestInvTitle => 'Guest Invitations';

  @override
  String get guestInvInviteGuest => 'Invite Guest';

  @override
  String get guestInvNoInvitesLeft => 'No Invites Left';

  @override
  String get guestInvSentInvitations => 'Sent Invitations';

  @override
  String get guestInvNotIncluded =>
      'Guest invitations are not included in your current plan.';

  @override
  String guestInvDayPass(String days) {
    return '$days-day pass';
  }

  @override
  String get guestInvOneVisit => '1 visit';

  @override
  String get guestInvInvitesRemaining => 'invites remaining';

  @override
  String guestInvEachGuestGets(String pass) {
    return 'Each guest gets a $pass';
  }

  @override
  String get guestInvNoneSentYet => 'No invitations sent yet';

  @override
  String get guestInvInviteFriend =>
      'Invite a friend and they\'ll get a free guest pass!';

  @override
  String get guestInvNoneRemaining => 'You have no invites remaining.';

  @override
  String get guestInvSendInvitation => 'Send Invitation';

  @override
  String guestInvDaysLeft(int days) {
    return '${days}d left';
  }

  @override
  String guestInvHoursLeft(int hours) {
    return '${hours}h left';
  }

  @override
  String get guestInvExpiringSoon => 'Expiring soon';

  @override
  String guestInvSentWithVisits(int count) {
    return 'Invitation sent! Your guest gets $count visits.';
  }

  @override
  String get guestInvSentSimple =>
      'Invitation sent! Your guest will receive instructions to register.';

  @override
  String get guestInvSendGuestInvitation => 'Send Guest Invitation';

  @override
  String get guestInvSheetSubtitle =>
      'Your guest will receive an invitation to register and get a free pass.';

  @override
  String get guestInvGuestNameOptional => 'Guest Name (optional)';

  @override
  String get guestInvEmailRequired => 'Email *';

  @override
  String get guestInvEmailIsRequired => 'Email is required';

  @override
  String get guestInvEnterValidEmail => 'Enter a valid email';

  @override
  String get guestInvPhoneRequired => 'Phone *';

  @override
  String get guestInvPhoneIsRequired => 'Phone is required';

  @override
  String get guestInvVisitsToAllocate => 'Visits to allocate';

  @override
  String guestInvRemainingAfter(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: '$count invites remaining after this',
      one: '1 invite remaining after this',
    );
    return '$_temp0';
  }

  @override
  String guestInvSendWithVisits(int count) {
    return 'Send Invitation ($count visits)';
  }

  @override
  String get guestGymInfoEmpty => 'No gym info available';

  @override
  String get guestGymInfoContactLocation => 'Contact & Location';

  @override
  String get guestGymInfoOperatingHours => 'Operating Hours';

  @override
  String get guestGymInfoClosed => 'Closed';

  @override
  String get guestGymInfoDayMonday => 'Monday';

  @override
  String get guestGymInfoDayTuesday => 'Tuesday';

  @override
  String get guestGymInfoDayWednesday => 'Wednesday';

  @override
  String get guestGymInfoDayThursday => 'Thursday';

  @override
  String get guestGymInfoDayFriday => 'Friday';

  @override
  String get guestGymInfoDaySaturday => 'Saturday';

  @override
  String get guestGymInfoDaySunday => 'Sunday';

  @override
  String get guestHomeMembershipPlans => 'Membership plans';

  @override
  String get guestHomeTodaysClasses => 'Today\'s classes';

  @override
  String get guestHomeGymFallback => 'the gym';

  @override
  String guestHomeJoinGymToday(String gymName) {
    return 'Join $gymName today';
  }

  @override
  String get guestHomePlansSubtitle =>
      'Choose from sessions or duration memberships.\nFlexible plans for every goal.';

  @override
  String get guestHomeCheckInLocked => 'Check in locked';

  @override
  String get guestHomeMembersOnly => 'Members only — sign in to access';

  @override
  String get guestHomeClassFallback => 'Class';

  @override
  String get guestHomeNoClassesToday => 'No classes scheduled today';

  @override
  String get guestPlansEmpty => 'No plans available';

  @override
  String guestPlansPriceAed(String price) {
    return 'AED $price';
  }

  @override
  String guestPlansPerCycle(String cycle) {
    return '/ $cycle';
  }

  @override
  String get guestPlansBillingMonthly => 'monthly';

  @override
  String get guestPlansBillingYearly => 'yearly';

  @override
  String get guestPlansBillingWeekly => 'weekly';

  @override
  String guestPlansSessionsCount(int count) {
    return '$count sessions';
  }

  @override
  String guestPlansVisitsPerWeek(int count) {
    return '${count}x / week';
  }

  @override
  String guestPlansVisitsPerMonth(int count) {
    return '${count}x / month';
  }

  @override
  String guestPlansMonthsCount(int count) {
    return '$count months';
  }

  @override
  String get guestPlansGetStarted => 'Get Started';

  @override
  String get guestPlansTypeUnlimited => 'Unlimited Access';

  @override
  String get guestPlansTypeLimited => 'Limited Access';

  @override
  String get guestPlansTypeSessions => 'Session Pack';

  @override
  String get guestPlansTypeDayPass => 'Day Pass';

  @override
  String get guestScheduleNoClasses => 'No classes on this day';

  @override
  String get guestScheduleTryDifferentDate => 'Try selecting a different date';

  @override
  String get guestScheduleLoadFailed => 'Failed to load schedule';

  @override
  String get guestShellWelcome => 'Welcome';

  @override
  String get guestShellBrowsingAsGuest => 'Browsing as guest — limited access';

  @override
  String get guestShellJoinNow => 'Join Now';

  @override
  String get guestShellNavHome => 'Home';

  @override
  String get guestShellNavClasses => 'Classes';

  @override
  String get guestShellNavExplore => 'Explore';

  @override
  String get guestShellNavProfile => 'Profile';

  @override
  String get guestTrainersEmpty => 'No trainers available';

  @override
  String get bannerOffer => 'OFFER';

  @override
  String get bannerGetPromoCode => 'Get promo code';

  @override
  String bannerVisitHost(String host) {
    return 'Visit $host';
  }

  @override
  String get bannerYourPromoCode => 'YOUR PROMO CODE';

  @override
  String get bannerCopy => 'Copy';

  @override
  String get bannerCopied => 'Copied';

  @override
  String get billingInvoicesTitle => 'Invoices';

  @override
  String get billingNoInvoicesYet => 'No invoices yet';

  @override
  String get billingEmptySubtitle => 'Your payment history will appear here.';

  @override
  String get billingLoadFailed => 'Failed to load invoices';

  @override
  String get billingStatusPaid => 'Paid';

  @override
  String get billingStatusPending => 'Pending';

  @override
  String get billingStatusOverdue => 'Overdue';

  @override
  String get invoiceDetailsTitle => 'Invoice Details';

  @override
  String get invoiceBillingPeriod => 'Billing Period';

  @override
  String get invoicePeriod => 'Period';

  @override
  String get invoiceStartDate => 'Start Date';

  @override
  String get invoiceEndDate => 'End Date';

  @override
  String get invoiceItems => 'Items';

  @override
  String get invoicePaymentInfo => 'Payment Info';

  @override
  String get invoiceStatus => 'Status';

  @override
  String get invoiceDueDate => 'Due Date';

  @override
  String get invoicePaidOn => 'Paid On';

  @override
  String get invoicePaymentMethod => 'Payment Method';

  @override
  String get invoiceNotes => 'Notes';

  @override
  String invoiceCreatedOn(String date) {
    return 'Created $date';
  }

  @override
  String get invoiceTotalAmount => 'Total Amount';

  @override
  String get invoiceTotalPaid => 'Total Paid';

  @override
  String invoicePayAmount(String amount) {
    return 'Pay $amount';
  }

  @override
  String get invoiceLoadFailed => 'Failed to load invoice';

  @override
  String get invoicePayInvoice => 'Pay Invoice';

  @override
  String get invoiceAmountDue => 'Amount Due';

  @override
  String invoicePaymentSubmitted(String amount) {
    return 'Payment of $amount submitted';
  }

  @override
  String get invoiceProcessing => 'Processing…';

  @override
  String get invoiceConfirmPayment => 'Confirm Payment';

  @override
  String invoicePaidOnDate(String date) {
    return 'Paid $date';
  }

  @override
  String invoiceDueOnDate(String date) {
    return 'Due $date';
  }

  @override
  String get invoiceOfferBadge => 'Offer';

  @override
  String get onboardingContinue => 'Continue';

  @override
  String get onboardingGetStarted => 'Get started';

  @override
  String get onboardingScanToEnter => 'SCAN TO ENTER';

  @override
  String get onboardingCheckedIn => 'Checked in';

  @override
  String get onboardingSessionsTag => 'SESSIONS';

  @override
  String get onboardingYou => 'You';

  @override
  String get onboardingSampleFriendName => 'Ahmed';

  @override
  String get onboardingReceivedTag => '+3 received';

  @override
  String get onboardingMembershipTag => 'MEMBERSHIP';

  @override
  String get onboardingSamplePlan => 'Premium Monthly';

  @override
  String get onboardingMemberNumberTag => 'MEMBER #';

  @override
  String get onboardingRenewsTag => 'RENEWS';

  @override
  String get onboardingLeftTag => 'LEFT';

  @override
  String get welcomeTitlePrefix => 'Welcome to ';

  @override
  String get welcomeSubtitle =>
      'Your gym, your sessions, your friends — all in one place. Let\'s get you set up.';

  @override
  String get welcomeCreateAccount => 'Create account';

  @override
  String get welcomeAlreadyHaveAccount => 'I already have an account';

  @override
  String get welcomeContinueAsGuest => 'Continue as guest';

  @override
  String get welcomeLegalPrefix => 'By continuing, you agree to our ';

  @override
  String get popupNotNow => 'Not now';

  @override
  String get splashPoweredBy => 'Powered by CLBY';

  @override
  String get splashLoadingYourGym => 'Loading your gym…';

  @override
  String freezeFailed(String error) {
    return 'Failed to freeze: $error';
  }

  @override
  String get freezeTitle => 'Freeze Plan';

  @override
  String freezeWillPause(String planName) {
    return '$planName will be paused and the end date extended.';
  }

  @override
  String get freezeYourPlan => 'Your plan';

  @override
  String get freezeDaysAvailable => 'Days available';

  @override
  String get freezeFreezesUsed => 'Freezes used';

  @override
  String freezeXOfY(String a, String b) {
    return '$a of $b';
  }

  @override
  String freezeAllDaysUsed(int days) {
    return 'All $days freeze days have been used for this plan. No further freezes are allowed.';
  }

  @override
  String freezeMaxCountReached(int count) {
    return 'Maximum freeze count ($count) has been reached for this plan. No further freezes are allowed.';
  }

  @override
  String get freezeHowManyDays => 'How many days?';

  @override
  String freezeMaxDaysHint(int days) {
    return 'Max $days days';
  }

  @override
  String get freezeExtendTo => 'Your plan will extend to ';

  @override
  String get freezeFreezing => 'Freezing…';

  @override
  String get guestPromptMembersOnly => 'Members Only';

  @override
  String get guestPromptDescription =>
      'Create a free account to book classes, track your membership, and more.';

  @override
  String get guestPromptCreateAccount => 'Create Account';

  @override
  String get guestPromptSignIn => 'Sign In';

  @override
  String get legalConsentPrefix => 'By continuing, you agree to our ';

  @override
  String get legalTermsOfService => 'Terms of Service';

  @override
  String get legalAnd => ' and ';

  @override
  String get legalPrivacyPolicy => 'Privacy Policy';

  @override
  String get memberCardMembership => 'MEMBERSHIP';

  @override
  String get memberCardStandardPlan => 'Standard Plan';

  @override
  String get memberCardStart => 'Start';

  @override
  String get memberCardExpires => 'Expires';

  @override
  String memberCardVisitsPerWeek(int count) {
    return '$count visits per week';
  }

  @override
  String memberCardVisitsPerMonth(int count) {
    return '$count visits per month';
  }

  @override
  String memberCardSessionsIncluded(int count) {
    return '$count sessions included';
  }

  @override
  String memberCardBilling(String cycle) {
    return '$cycle billing';
  }

  @override
  String get memberCardPlanBenefits => 'Plan Benefits';

  @override
  String get memberCardSuspended => 'Suspended';

  @override
  String get memberCardFrozen => 'Frozen';

  @override
  String get memberCardInactive => 'Inactive';

  @override
  String get memberCardNoActiveMembership => 'No Active Membership';

  @override
  String get memberCardContactGym => 'Contact the gym to get started';

  @override
  String get memberCardTransferredSessions => 'Transferred sessions';

  @override
  String get memberCardUnlimitedSessions => 'unlimited sessions';

  @override
  String get memberCardSessionsRemaining => 'sessions remaining';

  @override
  String memberCardOfTotal(int total) {
    return 'of $total total';
  }

  @override
  String memberCardDaysLeft(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'days left',
      one: 'day left',
    );
    return '$_temp0';
  }

  @override
  String memberCardUntilDate(String date) {
    return 'until $date';
  }

  @override
  String get memberCardNoActiveAccess => 'no active access';

  @override
  String get memberCardMembershipExpiry => 'Membership expiry';

  @override
  String get memberCardEndDate => 'End date';

  @override
  String get memberCardNearestExpiry => 'Nearest expiry';

  @override
  String get memberCardFrozenUntil => 'Frozen until';

  @override
  String get memberCardFreeze => 'Freeze';

  @override
  String get memberCardUnfreeze => 'Unfreeze';

  @override
  String get memberCardSessionsPlan => 'Sessions plan';

  @override
  String get memberCardDurationPlan => 'Duration plan';

  @override
  String get memberCardFullAccess => 'Full access';

  @override
  String get memberCardMonthlyPlan => 'Monthly plan';

  @override
  String get memberCardAnnualPlan => 'Annual plan';

  @override
  String memberCardIncludesTransfers(int count) {
    String _temp0 = intl.Intl.pluralLogic(
      count,
      locale: localeName,
      other: 'Includes $count sessions from transfers',
      one: 'Includes 1 session from transfers',
    );
    return '$_temp0';
  }

  @override
  String memberCardExpiresOn(String date) {
    return 'expires $date';
  }

  @override
  String memberCardNearestExpiryOn(String date) {
    return 'nearest expiry $date';
  }

  @override
  String get ratingTerrible => 'Terrible';

  @override
  String get ratingBad => 'Bad';

  @override
  String get ratingOkay => 'Okay';

  @override
  String get ratingGood => 'Good';

  @override
  String get ratingExcellent => 'Excellent';

  @override
  String ratingSubmitFailed(String error) {
    return 'Failed to submit: $error';
  }

  @override
  String get ratingTitle => 'Rate your experience';

  @override
  String get ratingSubtitle => 'Your feedback helps us improve';

  @override
  String get ratingHowWasSession => 'How was the session overall?';

  @override
  String get ratingOverallHint => 'Rate your overall class experience';

  @override
  String ratingHowWasTrainer(String name) {
    return 'How was $name?';
  }

  @override
  String get ratingOptional => 'optional';

  @override
  String get ratingTrainerHint => 'Rate your trainer\'s performance';

  @override
  String get ratingLeaveReview => 'Leave a review';

  @override
  String get ratingShareHint => 'Share your experience with the community';

  @override
  String get ratingReviewHint =>
      'What did you think about this class? Your review may be shown to other members…';

  @override
  String get ratingSubmit => 'Submit rating';

  @override
  String get ratingSkipForNow => 'Skip for now';

  @override
  String get ratingYou => 'You';

  @override
  String get ratingThanks => 'Thanks for your review!';

  @override
  String get ratingSubmittedDesc =>
      'Your feedback has been submitted and may\nhelp other members choose their classes.';

  @override
  String ratingSessionSummary(String label) {
    return 'Session: $label';
  }

  @override
  String get ratingTrainerSummary => 'Trainer: ';

  @override
  String get ratingJustNow => 'Just now';

  @override
  String get ratingViewBookings => 'View my bookings';

  @override
  String get servicesTitle => 'Services';

  @override
  String get sessionCardClass => 'Class';

  @override
  String get sessionCardAttended => 'Attended';

  @override
  String get sessionCardCapacity => 'Capacity';

  @override
  String get sessionCardFull => 'Full';

  @override
  String sessionCardSpotsLeft(int count) {
    return '$count spots left';
  }

  @override
  String get sessionCardSessionCancelled => 'Session Cancelled';

  @override
  String get sessionCardClassOngoing => 'Class is ongoing';

  @override
  String get sessionCardBooked => 'Booked';

  @override
  String get sessionCardClassEnded => 'Class ended';

  @override
  String get sessionCardClassFull => 'Class is full';

  @override
  String get sessionCardWalkInScanQr => 'Walk-in · scan QR';

  @override
  String get sessionCardCancelled => 'Cancelled';

  @override
  String get sessionCardFinished => 'Finished';

  @override
  String get sessionCardOngoing => 'Ongoing';

  @override
  String get sessionCardOpen => 'Open';

  @override
  String get sessionCardRated => 'Rated';

  @override
  String get sessionCardRate => 'Rate';

  @override
  String get contractTermsTitle => 'Contract Terms & Conditions';

  @override
  String get contractTermsProfileValue => 'Contract Terms';

  @override
  String get contractTermsInvoiceRow => 'View contract terms';

  @override
  String contractTermsVersion(String version) {
    return 'Version $version';
  }

  @override
  String contractTermsLastUpdated(String date) {
    return 'Updated $date';
  }

  @override
  String get contractTermsAsOfPurchase => 'As of this invoice';

  @override
  String get contractTermsEmptyTitle => 'No terms available';

  @override
  String get contractTermsEmptyBody =>
      'Your gym hasn\'t published contract terms and conditions yet.';

  @override
  String get contractTermsErrorTitle => 'Couldn\'t load terms';

  @override
  String get contractTermsErrorBody => 'Check your connection and try again.';
}
