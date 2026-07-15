import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_ar.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('ar'),
    Locale('en'),
  ];

  /// No description provided for @commonCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get commonCancel;

  /// No description provided for @commonSave.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get commonSave;

  /// No description provided for @commonConfirm.
  ///
  /// In en, this message translates to:
  /// **'Confirm'**
  String get commonConfirm;

  /// No description provided for @commonRetry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get commonRetry;

  /// No description provided for @commonClose.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get commonClose;

  /// No description provided for @commonOk.
  ///
  /// In en, this message translates to:
  /// **'OK'**
  String get commonOk;

  /// No description provided for @commonDone.
  ///
  /// In en, this message translates to:
  /// **'Done'**
  String get commonDone;

  /// No description provided for @commonDelete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get commonDelete;

  /// No description provided for @commonEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get commonEdit;

  /// No description provided for @commonBack.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get commonBack;

  /// No description provided for @commonNext.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get commonNext;

  /// No description provided for @commonSkip.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get commonSkip;

  /// No description provided for @commonLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading…'**
  String get commonLoading;

  /// No description provided for @commonError.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong. Please try again.'**
  String get commonError;

  /// No description provided for @commonNoResults.
  ///
  /// In en, this message translates to:
  /// **'No results found'**
  String get commonNoResults;

  /// No description provided for @commonSearch.
  ///
  /// In en, this message translates to:
  /// **'Search'**
  String get commonSearch;

  /// No description provided for @commonSeeAll.
  ///
  /// In en, this message translates to:
  /// **'See all'**
  String get commonSeeAll;

  /// No description provided for @commonBookNow.
  ///
  /// In en, this message translates to:
  /// **'Book now'**
  String get commonBookNow;

  /// No description provided for @commonLogout.
  ///
  /// In en, this message translates to:
  /// **'Log out'**
  String get commonLogout;

  /// No description provided for @commonYes.
  ///
  /// In en, this message translates to:
  /// **'Yes'**
  String get commonYes;

  /// No description provided for @commonNo.
  ///
  /// In en, this message translates to:
  /// **'No'**
  String get commonNo;

  /// No description provided for @commonSessions.
  ///
  /// In en, this message translates to:
  /// **'Sessions'**
  String get commonSessions;

  /// No description provided for @commonMinutes.
  ///
  /// In en, this message translates to:
  /// **'min'**
  String get commonMinutes;

  /// No description provided for @commonFree.
  ///
  /// In en, this message translates to:
  /// **'Free'**
  String get commonFree;

  /// No description provided for @commonActive.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get commonActive;

  /// No description provided for @commonExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get commonExpired;

  /// No description provided for @commonLanguage.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get commonLanguage;

  /// No description provided for @commonEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get commonEnglish;

  /// No description provided for @commonArabic.
  ///
  /// In en, this message translates to:
  /// **'العربية'**
  String get commonArabic;

  /// No description provided for @commonSystemDefault.
  ///
  /// In en, this message translates to:
  /// **'System default'**
  String get commonSystemDefault;

  /// No description provided for @authEmailLabel.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get authEmailLabel;

  /// No description provided for @authEmailPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'you@example.com'**
  String get authEmailPlaceholder;

  /// No description provided for @authPasswordLabel.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get authPasswordLabel;

  /// No description provided for @authForgotPassword.
  ///
  /// In en, this message translates to:
  /// **'Forgot password?'**
  String get authForgotPassword;

  /// No description provided for @authSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get authSignIn;

  /// No description provided for @authContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get authContinue;

  /// No description provided for @authContinueToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Continue to sign in'**
  String get authContinueToSignIn;

  /// No description provided for @authEmailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address'**
  String get authEmailInvalid;

  /// No description provided for @authAtLeast8Chars.
  ///
  /// In en, this message translates to:
  /// **'At least 8 characters'**
  String get authAtLeast8Chars;

  /// No description provided for @authOneUppercase.
  ///
  /// In en, this message translates to:
  /// **'One uppercase letter'**
  String get authOneUppercase;

  /// No description provided for @authOneNumber.
  ///
  /// In en, this message translates to:
  /// **'One number'**
  String get authOneNumber;

  /// No description provided for @authChip8Chars.
  ///
  /// In en, this message translates to:
  /// **'8+ chars'**
  String get authChip8Chars;

  /// No description provided for @authChipUppercase.
  ///
  /// In en, this message translates to:
  /// **'Uppercase'**
  String get authChipUppercase;

  /// No description provided for @authChipNumber.
  ///
  /// In en, this message translates to:
  /// **'Number'**
  String get authChipNumber;

  /// No description provided for @authStrengthTooShort.
  ///
  /// In en, this message translates to:
  /// **'Too short'**
  String get authStrengthTooShort;

  /// No description provided for @authStrengthWeak.
  ///
  /// In en, this message translates to:
  /// **'Weak'**
  String get authStrengthWeak;

  /// No description provided for @authStrengthOkay.
  ///
  /// In en, this message translates to:
  /// **'Okay'**
  String get authStrengthOkay;

  /// No description provided for @authStrengthStrong.
  ///
  /// In en, this message translates to:
  /// **'Strong'**
  String get authStrengthStrong;

  /// No description provided for @authStrengthVeryStrong.
  ///
  /// In en, this message translates to:
  /// **'Very strong'**
  String get authStrengthVeryStrong;

  /// No description provided for @authOr.
  ///
  /// In en, this message translates to:
  /// **'or'**
  String get authOr;

  /// No description provided for @authPoweredByClby.
  ///
  /// In en, this message translates to:
  /// **'Powered by CLBY'**
  String get authPoweredByClby;

  /// No description provided for @loginWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get loginWelcomeBack;

  /// No description provided for @loginSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Sign in to manage your sessions and transfers.'**
  String get loginSubtitle;

  /// No description provided for @loginEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email is required'**
  String get loginEmailRequired;

  /// No description provided for @loginPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Password is required'**
  String get loginPasswordRequired;

  /// No description provided for @loginAccountDeleted.
  ///
  /// In en, this message translates to:
  /// **'This account has been deleted. You can still restore it by signing up again.'**
  String get loginAccountDeleted;

  /// No description provided for @loginInvalidCredentials.
  ///
  /// In en, this message translates to:
  /// **'Incorrect email or password.'**
  String get loginInvalidCredentials;

  /// No description provided for @loginVerifyEmailTitle.
  ///
  /// In en, this message translates to:
  /// **'Verify your email'**
  String get loginVerifyEmailTitle;

  /// No description provided for @loginVerifyEmailBody.
  ///
  /// In en, this message translates to:
  /// **'We sent a confirmation link when you signed up. Tap the link in the email to activate your account. Check spam if you can\'t find it.'**
  String get loginVerifyEmailBody;

  /// No description provided for @loginVerificationSent.
  ///
  /// In en, this message translates to:
  /// **'Verification email sent. Check your inbox.'**
  String get loginVerificationSent;

  /// No description provided for @loginResendFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not resend. Try again in a minute.'**
  String get loginResendFailed;

  /// No description provided for @loginResendEmail.
  ///
  /// In en, this message translates to:
  /// **'Resend email'**
  String get loginResendEmail;

  /// No description provided for @loginNewHere.
  ///
  /// In en, this message translates to:
  /// **'New here? '**
  String get loginNewHere;

  /// No description provided for @loginCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create an account'**
  String get loginCreateAccount;

  /// No description provided for @forgotIntroPrefix.
  ///
  /// In en, this message translates to:
  /// **'Enter the email tied to your account. We\'ll send a reset link valid for '**
  String get forgotIntroPrefix;

  /// No description provided for @forgotIntroDuration.
  ///
  /// In en, this message translates to:
  /// **'30 minutes'**
  String get forgotIntroDuration;

  /// No description provided for @forgotSendLink.
  ///
  /// In en, this message translates to:
  /// **'Send reset link'**
  String get forgotSendLink;

  /// No description provided for @forgotCheckEmail.
  ///
  /// In en, this message translates to:
  /// **'Check your email'**
  String get forgotCheckEmail;

  /// No description provided for @forgotSentLinkTo.
  ///
  /// In en, this message translates to:
  /// **'We sent a reset link to'**
  String get forgotSentLinkTo;

  /// No description provided for @forgotSpamHint.
  ///
  /// In en, this message translates to:
  /// **'Didn\'t get it? Check your spam folder, or wait a minute before requesting another link.'**
  String get forgotSpamHint;

  /// No description provided for @forgotBackToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get forgotBackToSignIn;

  /// No description provided for @forgotLinkSentAgain.
  ///
  /// In en, this message translates to:
  /// **'Link sent again ✓'**
  String get forgotLinkSentAgain;

  /// No description provided for @forgotResendLink.
  ///
  /// In en, this message translates to:
  /// **'Resend link'**
  String get forgotResendLink;

  /// No description provided for @forgotResendIn.
  ///
  /// In en, this message translates to:
  /// **'Resend link in {seconds}s'**
  String forgotResendIn(int seconds);

  /// No description provided for @resetPwLinkExpired.
  ///
  /// In en, this message translates to:
  /// **'Reset link expired. Please request a new one.'**
  String get resetPwLinkExpired;

  /// No description provided for @resetPwTitle.
  ///
  /// In en, this message translates to:
  /// **'Set a new password'**
  String get resetPwTitle;

  /// No description provided for @resetPwSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose something you haven\'t used before.'**
  String get resetPwSubtitle;

  /// No description provided for @resetPwNewPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get resetPwNewPassword;

  /// No description provided for @resetPwConfirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get resetPwConfirmPassword;

  /// No description provided for @resetPwConfirmPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Type it again'**
  String get resetPwConfirmPlaceholder;

  /// No description provided for @resetPwMismatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords don\'t match'**
  String get resetPwMismatch;

  /// No description provided for @resetPwUpdate.
  ///
  /// In en, this message translates to:
  /// **'Update password'**
  String get resetPwUpdate;

  /// No description provided for @resetPwUpdated.
  ///
  /// In en, this message translates to:
  /// **'Password updated'**
  String get resetPwUpdated;

  /// No description provided for @resetPwUpdatedBody.
  ///
  /// In en, this message translates to:
  /// **'You can now sign in with your new password.'**
  String get resetPwUpdatedBody;

  /// No description provided for @registerTitle.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get registerTitle;

  /// No description provided for @registerSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Email and a strong password — we\'ll keep your account safe.'**
  String get registerSubtitle;

  /// No description provided for @registerAlreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? '**
  String get registerAlreadyHaveAccount;

  /// No description provided for @registerStepAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get registerStepAccount;

  /// No description provided for @registerStepYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get registerStepYou;

  /// No description provided for @registerStepClub.
  ///
  /// In en, this message translates to:
  /// **'Club'**
  String get registerStepClub;

  /// No description provided for @registerAboutYouTitle.
  ///
  /// In en, this message translates to:
  /// **'A bit about you'**
  String get registerAboutYouTitle;

  /// No description provided for @registerFullNameLabel.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get registerFullNameLabel;

  /// No description provided for @registerFullNamePlaceholder.
  ///
  /// In en, this message translates to:
  /// **'e.g. Ahmed Hassan'**
  String get registerFullNamePlaceholder;

  /// No description provided for @registerDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get registerDateOfBirth;

  /// No description provided for @registerDayHint.
  ///
  /// In en, this message translates to:
  /// **'DD'**
  String get registerDayHint;

  /// No description provided for @registerMonthHint.
  ///
  /// In en, this message translates to:
  /// **'Month'**
  String get registerMonthHint;

  /// No description provided for @registerYearHint.
  ///
  /// In en, this message translates to:
  /// **'YYYY'**
  String get registerYearHint;

  /// No description provided for @registerAgeYears.
  ///
  /// In en, this message translates to:
  /// **'{age} years old ✓'**
  String registerAgeYears(int age);

  /// No description provided for @registerAgeTooYoung.
  ///
  /// In en, this message translates to:
  /// **'You must be at least 13 to sign up.'**
  String get registerAgeTooYoung;

  /// No description provided for @registerMobile.
  ///
  /// In en, this message translates to:
  /// **'Mobile'**
  String get registerMobile;

  /// No description provided for @registerOptional.
  ///
  /// In en, this message translates to:
  /// **'Optional'**
  String get registerOptional;

  /// No description provided for @registerSelectCountry.
  ///
  /// In en, this message translates to:
  /// **'Select country'**
  String get registerSelectCountry;

  /// No description provided for @registerCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get registerCreateAccount;

  /// No description provided for @registerLegalPrefix.
  ///
  /// In en, this message translates to:
  /// **'By creating an account you agree to our '**
  String get registerLegalPrefix;

  /// No description provided for @registerClubTitle.
  ///
  /// In en, this message translates to:
  /// **'Pick your club'**
  String get registerClubTitle;

  /// No description provided for @registerClubSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This is the home location your sessions are tied to.'**
  String get registerClubSubtitle;

  /// No description provided for @registerSearchPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'Search by name or area'**
  String get registerSearchPlaceholder;

  /// No description provided for @registerNoClubs.
  ///
  /// In en, this message translates to:
  /// **'No clubs available right now.'**
  String get registerNoClubs;

  /// No description provided for @registerNoClubsMatch.
  ///
  /// In en, this message translates to:
  /// **'No clubs match \"{query}\".'**
  String registerNoClubsMatch(String query);

  /// No description provided for @registerAllSet.
  ///
  /// In en, this message translates to:
  /// **'You\'re all set'**
  String get registerAllSet;

  /// No description provided for @registerConfirmationSentTo.
  ///
  /// In en, this message translates to:
  /// **'We sent a confirmation link to'**
  String get registerConfirmationSentTo;

  /// No description provided for @registerYourInbox.
  ///
  /// In en, this message translates to:
  /// **'your inbox'**
  String get registerYourInbox;

  /// No description provided for @registerActivateHint.
  ///
  /// In en, this message translates to:
  /// **'Tap the link to activate your account, then sign in.'**
  String get registerActivateHint;

  /// No description provided for @registerEmailExists.
  ///
  /// In en, this message translates to:
  /// **'This email is already registered. Use Forgot Password if you lost access.'**
  String get registerEmailExists;

  /// No description provided for @registerPhoneExists.
  ///
  /// In en, this message translates to:
  /// **'This phone number is already registered.'**
  String get registerPhoneExists;

  /// No description provided for @registerWeakPassword.
  ///
  /// In en, this message translates to:
  /// **'Password is too weak. Use at least 8 characters.'**
  String get registerWeakPassword;

  /// No description provided for @registerMonthJanuary.
  ///
  /// In en, this message translates to:
  /// **'January'**
  String get registerMonthJanuary;

  /// No description provided for @registerMonthFebruary.
  ///
  /// In en, this message translates to:
  /// **'February'**
  String get registerMonthFebruary;

  /// No description provided for @registerMonthMarch.
  ///
  /// In en, this message translates to:
  /// **'March'**
  String get registerMonthMarch;

  /// No description provided for @registerMonthApril.
  ///
  /// In en, this message translates to:
  /// **'April'**
  String get registerMonthApril;

  /// No description provided for @registerMonthMay.
  ///
  /// In en, this message translates to:
  /// **'May'**
  String get registerMonthMay;

  /// No description provided for @registerMonthJune.
  ///
  /// In en, this message translates to:
  /// **'June'**
  String get registerMonthJune;

  /// No description provided for @registerMonthJuly.
  ///
  /// In en, this message translates to:
  /// **'July'**
  String get registerMonthJuly;

  /// No description provided for @registerMonthAugust.
  ///
  /// In en, this message translates to:
  /// **'August'**
  String get registerMonthAugust;

  /// No description provided for @registerMonthSeptember.
  ///
  /// In en, this message translates to:
  /// **'September'**
  String get registerMonthSeptember;

  /// No description provided for @registerMonthOctober.
  ///
  /// In en, this message translates to:
  /// **'October'**
  String get registerMonthOctober;

  /// No description provided for @registerMonthNovember.
  ///
  /// In en, this message translates to:
  /// **'November'**
  String get registerMonthNovember;

  /// No description provided for @registerMonthDecember.
  ///
  /// In en, this message translates to:
  /// **'December'**
  String get registerMonthDecember;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get navClasses;

  /// No description provided for @navExplore.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get navExplore;

  /// No description provided for @navProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get navProfile;

  /// No description provided for @homeGreetingMorning.
  ///
  /// In en, this message translates to:
  /// **'Good morning'**
  String get homeGreetingMorning;

  /// No description provided for @homeGreetingAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Good afternoon'**
  String get homeGreetingAfternoon;

  /// No description provided for @homeGreetingEvening.
  ///
  /// In en, this message translates to:
  /// **'Good evening'**
  String get homeGreetingEvening;

  /// No description provided for @homeGreetingWithName.
  ///
  /// In en, this message translates to:
  /// **'{greeting}, {name}'**
  String homeGreetingWithName(String greeting, String name);

  /// No description provided for @homeYourMembership.
  ///
  /// In en, this message translates to:
  /// **'Your membership'**
  String get homeYourMembership;

  /// No description provided for @homeViewPlan.
  ///
  /// In en, this message translates to:
  /// **'View plan'**
  String get homeViewPlan;

  /// No description provided for @homeTodaysClasses.
  ///
  /// In en, this message translates to:
  /// **'Today\'s classes'**
  String get homeTodaysClasses;

  /// No description provided for @homeYourActivity.
  ///
  /// In en, this message translates to:
  /// **'Your activity'**
  String get homeYourActivity;

  /// No description provided for @homeQuickAccess.
  ///
  /// In en, this message translates to:
  /// **'Quick access'**
  String get homeQuickAccess;

  /// No description provided for @homeQuickAccessSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Jump straight where you need'**
  String get homeQuickAccessSubtitle;

  /// No description provided for @homeOurLocations.
  ///
  /// In en, this message translates to:
  /// **'Our locations'**
  String get homeOurLocations;

  /// No description provided for @homeNoActiveMembership.
  ///
  /// In en, this message translates to:
  /// **'No active membership'**
  String get homeNoActiveMembership;

  /// No description provided for @homeNoPlanBody.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have a plan yet. Choose a membership to unlock full access.'**
  String get homeNoPlanBody;

  /// No description provided for @homeBrowsePlans.
  ///
  /// In en, this message translates to:
  /// **'Browse membership plans'**
  String get homeBrowsePlans;

  /// No description provided for @homeNoClassesToday.
  ///
  /// In en, this message translates to:
  /// **'No classes scheduled today'**
  String get homeNoClassesToday;

  /// No description provided for @homeClassFallback.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get homeClassFallback;

  /// No description provided for @homeSessionBooked.
  ///
  /// In en, this message translates to:
  /// **'Session booked successfully!'**
  String get homeSessionBooked;

  /// No description provided for @homeBookFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to book. Please try again.'**
  String get homeBookFailed;

  /// No description provided for @homeBookingCancelled.
  ///
  /// In en, this message translates to:
  /// **'Booking cancelled.'**
  String get homeBookingCancelled;

  /// No description provided for @homeCancelFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to cancel. Please try again.'**
  String get homeCancelFailed;

  /// No description provided for @homeCoachName.
  ///
  /// In en, this message translates to:
  /// **'Coach {name}'**
  String homeCoachName(String name);

  /// No description provided for @homeSpotsOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get homeSpotsOpen;

  /// No description provided for @homeSpotsFull.
  ///
  /// In en, this message translates to:
  /// **'Full'**
  String get homeSpotsFull;

  /// No description provided for @homeSpotsLeft.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{{count} spot left} other{{count} spots left}}'**
  String homeSpotsLeft(int count);

  /// No description provided for @homeThisMonth.
  ///
  /// In en, this message translates to:
  /// **'This month'**
  String get homeThisMonth;

  /// No description provided for @homeMonthlyVisits.
  ///
  /// In en, this message translates to:
  /// **'MONTHLY VISITS'**
  String get homeMonthlyVisits;

  /// No description provided for @homeGymCapacity.
  ///
  /// In en, this message translates to:
  /// **'GYM CAPACITY'**
  String get homeGymCapacity;

  /// No description provided for @homeCapacityNotCrowded.
  ///
  /// In en, this message translates to:
  /// **'Not crowded'**
  String get homeCapacityNotCrowded;

  /// No description provided for @homeCapacityModerate.
  ///
  /// In en, this message translates to:
  /// **'Moderately busy'**
  String get homeCapacityModerate;

  /// No description provided for @homeCapacityVeryBusy.
  ///
  /// In en, this message translates to:
  /// **'Very busy'**
  String get homeCapacityVeryBusy;

  /// No description provided for @homeQuickClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get homeQuickClasses;

  /// No description provided for @homeQuickTrainers.
  ///
  /// In en, this message translates to:
  /// **'Trainers'**
  String get homeQuickTrainers;

  /// No description provided for @homeQuickBookings.
  ///
  /// In en, this message translates to:
  /// **'Bookings'**
  String get homeQuickBookings;

  /// No description provided for @homeQuickPayments.
  ///
  /// In en, this message translates to:
  /// **'Payments'**
  String get homeQuickPayments;

  /// No description provided for @homeQuickAttendance.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get homeQuickAttendance;

  /// No description provided for @homeQuickOffers.
  ///
  /// In en, this message translates to:
  /// **'Offers'**
  String get homeQuickOffers;

  /// No description provided for @notifTitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications'**
  String get notifTitle;

  /// No description provided for @notifGroupToday.
  ///
  /// In en, this message translates to:
  /// **'TODAY'**
  String get notifGroupToday;

  /// No description provided for @notifGroupYesterday.
  ///
  /// In en, this message translates to:
  /// **'YESTERDAY'**
  String get notifGroupYesterday;

  /// No description provided for @notifGroupEarlier.
  ///
  /// In en, this message translates to:
  /// **'EARLIER'**
  String get notifGroupEarlier;

  /// No description provided for @notifFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get notifFilterAll;

  /// No description provided for @notifFilterUnread.
  ///
  /// In en, this message translates to:
  /// **'Unread'**
  String get notifFilterUnread;

  /// No description provided for @notifFilterRead.
  ///
  /// In en, this message translates to:
  /// **'Read'**
  String get notifFilterRead;

  /// No description provided for @notifEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No notifications yet'**
  String get notifEmptyTitle;

  /// No description provided for @notifEmptySubtitle.
  ///
  /// In en, this message translates to:
  /// **'You\'ll see updates about bookings, payments, and activities here.'**
  String get notifEmptySubtitle;

  /// No description provided for @notifAllCaughtUp.
  ///
  /// In en, this message translates to:
  /// **'All caught up!'**
  String get notifAllCaughtUp;

  /// No description provided for @notifNoRead.
  ///
  /// In en, this message translates to:
  /// **'No read notifications'**
  String get notifNoRead;

  /// No description provided for @notifNoUnreadSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You have no unread notifications right now.'**
  String get notifNoUnreadSubtitle;

  /// No description provided for @notifReadSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Notifications you\'ve opened will appear here.'**
  String get notifReadSubtitle;

  /// No description provided for @notifLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load notifications'**
  String get notifLoadFailed;

  /// No description provided for @notifYesterdayAt.
  ///
  /// In en, this message translates to:
  /// **'Yesterday, {time}'**
  String notifYesterdayAt(String time);

  /// No description provided for @notifDaysAgo.
  ///
  /// In en, this message translates to:
  /// **'{count} days ago'**
  String notifDaysAgo(int count);

  /// No description provided for @notifWeekAgo.
  ///
  /// In en, this message translates to:
  /// **'1 week ago'**
  String get notifWeekAgo;

  /// No description provided for @locationsTitle.
  ///
  /// In en, this message translates to:
  /// **'Our Locations'**
  String get locationsTitle;

  /// No description provided for @locationsOpenInMaps.
  ///
  /// In en, this message translates to:
  /// **'Open in Maps'**
  String get locationsOpenInMaps;

  /// No description provided for @attendanceTitle.
  ///
  /// In en, this message translates to:
  /// **'Attendance'**
  String get attendanceTitle;

  /// No description provided for @attendanceActivePlan.
  ///
  /// In en, this message translates to:
  /// **'Active Plan'**
  String get attendanceActivePlan;

  /// No description provided for @attendanceMembershipLabel.
  ///
  /// In en, this message translates to:
  /// **'MEMBERSHIP'**
  String get attendanceMembershipLabel;

  /// No description provided for @attendanceMemberNumberLabel.
  ///
  /// In en, this message translates to:
  /// **'MEMBER #'**
  String get attendanceMemberNumberLabel;

  /// No description provided for @attendanceRenewsLabel.
  ///
  /// In en, this message translates to:
  /// **'RENEWS'**
  String get attendanceRenewsLabel;

  /// No description provided for @attendanceScanQr.
  ///
  /// In en, this message translates to:
  /// **'Scan QR to check in'**
  String get attendanceScanQr;

  /// No description provided for @attendanceFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get attendanceFilterAll;

  /// No description provided for @attendanceFilterEntrance.
  ///
  /// In en, this message translates to:
  /// **'Entrance'**
  String get attendanceFilterEntrance;

  /// No description provided for @attendanceFilterClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get attendanceFilterClasses;

  /// No description provided for @attendanceFilterTransfers.
  ///
  /// In en, this message translates to:
  /// **'Transfers'**
  String get attendanceFilterTransfers;

  /// No description provided for @attendanceDateChip.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get attendanceDateChip;

  /// No description provided for @attendanceCheckInCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{{count} check-in} other{{count} check-ins}}'**
  String attendanceCheckInCount(int count);

  /// No description provided for @attendanceTransferCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{{count} transfer} other{{count} transfers}}'**
  String attendanceTransferCount(int count);

  /// No description provided for @attendanceGrantCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{{count} grant} other{{count} grants}}'**
  String attendanceGrantCount(int count);

  /// No description provided for @attendanceViewAllCheckIns.
  ///
  /// In en, this message translates to:
  /// **'View all check-ins'**
  String get attendanceViewAllCheckIns;

  /// No description provided for @attendanceClubEntrance.
  ///
  /// In en, this message translates to:
  /// **'Club Entrance'**
  String get attendanceClubEntrance;

  /// No description provided for @attendanceManualCheckIn.
  ///
  /// In en, this message translates to:
  /// **'Manual check-in'**
  String get attendanceManualCheckIn;

  /// No description provided for @attendanceTodayBadge.
  ///
  /// In en, this message translates to:
  /// **'TODAY'**
  String get attendanceTodayBadge;

  /// No description provided for @attendanceSentSessions.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{Sent {count} session to {name}} other{Sent {count} sessions to {name}}}'**
  String attendanceSentSessions(int count, String name);

  /// No description provided for @attendanceReceivedSessions.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{Received {count} session from {name}} other{Received {count} sessions from {name}}}'**
  String attendanceReceivedSessions(int count, String name);

  /// No description provided for @attendanceGrantedSessions.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{Added {count} session} other{Added {count} sessions}}'**
  String attendanceGrantedSessions(int count);

  /// No description provided for @attendanceGrantedSessionsBy.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, one{Added {count} session by {name}} other{Added {count} sessions by {name}}}'**
  String attendanceGrantedSessionsBy(int count, String name);

  /// No description provided for @attendanceEmptyTitle.
  ///
  /// In en, this message translates to:
  /// **'No attendance records found'**
  String get attendanceEmptyTitle;

  /// No description provided for @attendanceEmptySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Try a different filter or scan to check in.'**
  String get attendanceEmptySubtitle;

  /// No description provided for @attendanceLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load attendance'**
  String get attendanceLoadFailed;

  /// No description provided for @attendanceSuspendedTitle.
  ///
  /// In en, this message translates to:
  /// **'Membership suspended'**
  String get attendanceSuspendedTitle;

  /// No description provided for @attendanceNoMembershipTitle.
  ///
  /// In en, this message translates to:
  /// **'No active membership'**
  String get attendanceNoMembershipTitle;

  /// No description provided for @attendanceSuspendedBody.
  ///
  /// In en, this message translates to:
  /// **'Your membership has been suspended. Contact the gym to resolve this.'**
  String get attendanceSuspendedBody;

  /// No description provided for @attendanceNoMembershipBody.
  ///
  /// In en, this message translates to:
  /// **'Pick a plan to start checking in, booking classes, and tracking your attendance.'**
  String get attendanceNoMembershipBody;

  /// No description provided for @attendanceBrowseMemberships.
  ///
  /// In en, this message translates to:
  /// **'Browse memberships'**
  String get attendanceBrowseMemberships;

  /// No description provided for @attendanceCheckInHistory.
  ///
  /// In en, this message translates to:
  /// **'CHECK-IN HISTORY'**
  String get attendanceCheckInHistory;

  /// No description provided for @attendanceNothingYet.
  ///
  /// In en, this message translates to:
  /// **'Nothing here yet'**
  String get attendanceNothingYet;

  /// No description provided for @attendanceNothingYetBody.
  ///
  /// In en, this message translates to:
  /// **'Once you start a membership, every check-in will show up right here.'**
  String get attendanceNothingYetBody;

  /// No description provided for @attendanceFilterByDate.
  ///
  /// In en, this message translates to:
  /// **'Filter by date'**
  String get attendanceFilterByDate;

  /// No description provided for @attendanceFilterByDateSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Pick a from / to range.'**
  String get attendanceFilterByDateSubtitle;

  /// No description provided for @attendanceReset.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get attendanceReset;

  /// No description provided for @attendanceFrom.
  ///
  /// In en, this message translates to:
  /// **'From'**
  String get attendanceFrom;

  /// No description provided for @attendanceTo.
  ///
  /// In en, this message translates to:
  /// **'To'**
  String get attendanceTo;

  /// No description provided for @attendanceWeekdayLetters.
  ///
  /// In en, this message translates to:
  /// **'S,M,T,W,T,F,S'**
  String get attendanceWeekdayLetters;

  /// No description provided for @attendanceSelectDate.
  ///
  /// In en, this message translates to:
  /// **'Select date'**
  String get attendanceSelectDate;

  /// No description provided for @attendanceApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get attendanceApply;

  /// No description provided for @attHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Attendance History'**
  String get attHistoryTitle;

  /// No description provided for @attHistoryClear.
  ///
  /// In en, this message translates to:
  /// **'Clear'**
  String get attHistoryClear;

  /// No description provided for @attHistoryFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get attHistoryFilterAll;

  /// No description provided for @attHistoryGymEntrance.
  ///
  /// In en, this message translates to:
  /// **'Gym Entrance'**
  String get attHistoryGymEntrance;

  /// No description provided for @attHistoryFilterClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get attHistoryFilterClasses;

  /// No description provided for @attHistoryFilterManual.
  ///
  /// In en, this message translates to:
  /// **'Manual'**
  String get attHistoryFilterManual;

  /// No description provided for @attHistoryFromDate.
  ///
  /// In en, this message translates to:
  /// **'From date'**
  String get attHistoryFromDate;

  /// No description provided for @attHistoryToDate.
  ///
  /// In en, this message translates to:
  /// **'To date'**
  String get attHistoryToDate;

  /// No description provided for @attHistoryNoCheckIns.
  ///
  /// In en, this message translates to:
  /// **'No check-ins found'**
  String get attHistoryNoCheckIns;

  /// No description provided for @attHistoryManualCheckIn.
  ///
  /// In en, this message translates to:
  /// **'Manual Check-in'**
  String get attHistoryManualCheckIn;

  /// No description provided for @attHistoryClass.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get attHistoryClass;

  /// No description provided for @attHistoryCheckIn.
  ///
  /// In en, this message translates to:
  /// **'Check-in'**
  String get attHistoryCheckIn;

  /// No description provided for @attHistoryToday.
  ///
  /// In en, this message translates to:
  /// **'Today'**
  String get attHistoryToday;

  /// No description provided for @exploreTitle.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get exploreTitle;

  /// No description provided for @exploreOurGym.
  ///
  /// In en, this message translates to:
  /// **'Our gym'**
  String get exploreOurGym;

  /// No description provided for @exploreSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search for classes, specialists, programs or offers'**
  String get exploreSearchHint;

  /// No description provided for @exploreNoResultsFor.
  ///
  /// In en, this message translates to:
  /// **'No results for \"{query}\"'**
  String exploreNoResultsFor(String query);

  /// No description provided for @exploreMemberships.
  ///
  /// In en, this message translates to:
  /// **'Memberships'**
  String get exploreMemberships;

  /// No description provided for @exploreGymMembershipPlans.
  ///
  /// In en, this message translates to:
  /// **'{gymName} membership plans'**
  String exploreGymMembershipPlans(String gymName);

  /// No description provided for @explorePerMonth.
  ///
  /// In en, this message translates to:
  /// **'/ month'**
  String get explorePerMonth;

  /// No description provided for @explorePerYear.
  ///
  /// In en, this message translates to:
  /// **'/ year'**
  String get explorePerYear;

  /// No description provided for @explorePerQuarter.
  ///
  /// In en, this message translates to:
  /// **'/ quarter'**
  String get explorePerQuarter;

  /// No description provided for @exploreOneTime.
  ///
  /// In en, this message translates to:
  /// **'one time'**
  String get exploreOneTime;

  /// No description provided for @exploreTapSeeBenefits.
  ///
  /// In en, this message translates to:
  /// **'Tap to see full benefits'**
  String get exploreTapSeeBenefits;

  /// No description provided for @exploreViewPlans.
  ///
  /// In en, this message translates to:
  /// **'View plans ›'**
  String get exploreViewPlans;

  /// No description provided for @exploreCurrentOffers.
  ///
  /// In en, this message translates to:
  /// **'Current offers'**
  String get exploreCurrentOffers;

  /// No description provided for @exploreExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires {date}'**
  String exploreExpires(String date);

  /// No description provided for @exploreOurSpecialists.
  ///
  /// In en, this message translates to:
  /// **'Our specialists'**
  String get exploreOurSpecialists;

  /// No description provided for @exploreSpecialtyNutrition.
  ///
  /// In en, this message translates to:
  /// **'Nutrition'**
  String get exploreSpecialtyNutrition;

  /// No description provided for @exploreSpecialtyPhysio.
  ///
  /// In en, this message translates to:
  /// **'Physio'**
  String get exploreSpecialtyPhysio;

  /// No description provided for @exploreSpecialtyPt.
  ///
  /// In en, this message translates to:
  /// **'PT'**
  String get exploreSpecialtyPt;

  /// No description provided for @explorePrograms.
  ///
  /// In en, this message translates to:
  /// **'Programs'**
  String get explorePrograms;

  /// No description provided for @exploreWeeksCount.
  ///
  /// In en, this message translates to:
  /// **'{weeks} weeks'**
  String exploreWeeksCount(int weeks);

  /// No description provided for @exploreSessionPackages.
  ///
  /// In en, this message translates to:
  /// **'Session packages'**
  String get exploreSessionPackages;

  /// No description provided for @exploreSessionsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} sessions'**
  String exploreSessionsCount(int count);

  /// No description provided for @exploreSessionsPackageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'{count} sessions package'**
  String exploreSessionsPackageSubtitle(int count);

  /// No description provided for @exploreSessionsLabel.
  ///
  /// In en, this message translates to:
  /// **'sessions'**
  String get exploreSessionsLabel;

  /// No description provided for @explorePerSessionPrice.
  ///
  /// In en, this message translates to:
  /// **'{price} / session'**
  String explorePerSessionPrice(String price);

  /// No description provided for @exploreOurPartners.
  ///
  /// In en, this message translates to:
  /// **'Our partners'**
  String get exploreOurPartners;

  /// No description provided for @exploreTypeSpecialist.
  ///
  /// In en, this message translates to:
  /// **'Specialist'**
  String get exploreTypeSpecialist;

  /// No description provided for @exploreTypeProgram.
  ///
  /// In en, this message translates to:
  /// **'Program'**
  String get exploreTypeProgram;

  /// No description provided for @exploreTypeOffer.
  ///
  /// In en, this message translates to:
  /// **'Offer'**
  String get exploreTypeOffer;

  /// No description provided for @exploreTypeClass.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get exploreTypeClass;

  /// No description provided for @exploreMembershipPlansTitle.
  ///
  /// In en, this message translates to:
  /// **'Membership plans'**
  String get exploreMembershipPlansTitle;

  /// No description provided for @exploreNoPlans.
  ///
  /// In en, this message translates to:
  /// **'No plans available'**
  String get exploreNoPlans;

  /// No description provided for @exploreGetThisPlan.
  ///
  /// In en, this message translates to:
  /// **'Get this plan'**
  String get exploreGetThisPlan;

  /// No description provided for @exploreCycleMembership.
  ///
  /// In en, this message translates to:
  /// **'{cycle} membership'**
  String exploreCycleMembership(String cycle);

  /// No description provided for @exploreNoOffers.
  ///
  /// In en, this message translates to:
  /// **'No current offers'**
  String get exploreNoOffers;

  /// No description provided for @exploreNoPrograms.
  ///
  /// In en, this message translates to:
  /// **'No programs available'**
  String get exploreNoPrograms;

  /// No description provided for @exploreNoSessionPackages.
  ///
  /// In en, this message translates to:
  /// **'No session packages available'**
  String get exploreNoSessionPackages;

  /// No description provided for @exploreSessionPackagesIntro.
  ///
  /// In en, this message translates to:
  /// **'Buy sessions to use with any class or trainer. Sessions never expire.'**
  String get exploreSessionPackagesIntro;

  /// No description provided for @exploreBuySessions.
  ///
  /// In en, this message translates to:
  /// **'Buy {count} sessions'**
  String exploreBuySessions(int count);

  /// No description provided for @exploreMostPopular.
  ///
  /// In en, this message translates to:
  /// **'Most popular'**
  String get exploreMostPopular;

  /// No description provided for @trainerListTitle.
  ///
  /// In en, this message translates to:
  /// **'Our trainers'**
  String get trainerListTitle;

  /// No description provided for @trainerNoneFound.
  ///
  /// In en, this message translates to:
  /// **'No trainers found'**
  String get trainerNoneFound;

  /// No description provided for @trainerFilterAll.
  ///
  /// In en, this message translates to:
  /// **'All'**
  String get trainerFilterAll;

  /// No description provided for @trainerTypeNutritionist.
  ///
  /// In en, this message translates to:
  /// **'Nutritionist'**
  String get trainerTypeNutritionist;

  /// No description provided for @trainerTypePhysiotherapist.
  ///
  /// In en, this message translates to:
  /// **'Physiotherapist'**
  String get trainerTypePhysiotherapist;

  /// No description provided for @trainerTypePersonal.
  ///
  /// In en, this message translates to:
  /// **'Personal trainer'**
  String get trainerTypePersonal;

  /// No description provided for @trainerSpecialtiesTitle.
  ///
  /// In en, this message translates to:
  /// **'SPECIALTIES'**
  String get trainerSpecialtiesTitle;

  /// No description provided for @trainerAboutTitle.
  ///
  /// In en, this message translates to:
  /// **'ABOUT'**
  String get trainerAboutTitle;

  /// No description provided for @trainerClassesTitle.
  ///
  /// In en, this message translates to:
  /// **'CLASSES'**
  String get trainerClassesTitle;

  /// No description provided for @trainerReviewsTitle.
  ///
  /// In en, this message translates to:
  /// **'REVIEWS'**
  String get trainerReviewsTitle;

  /// No description provided for @trainerShowAllReviews.
  ///
  /// In en, this message translates to:
  /// **'Show All Reviews ({count})'**
  String trainerShowAllReviews(int count);

  /// No description provided for @trainerNoReviews.
  ///
  /// In en, this message translates to:
  /// **'No reviews yet'**
  String get trainerNoReviews;

  /// No description provided for @trainerMemberFallback.
  ///
  /// In en, this message translates to:
  /// **'Member'**
  String get trainerMemberFallback;

  /// No description provided for @offerNotFound.
  ///
  /// In en, this message translates to:
  /// **'Offer not found'**
  String get offerNotFound;

  /// No description provided for @offerClaimCta.
  ///
  /// In en, this message translates to:
  /// **'Claim this offer'**
  String get offerClaimCta;

  /// No description provided for @offerStatDiscount.
  ///
  /// In en, this message translates to:
  /// **'Discount'**
  String get offerStatDiscount;

  /// No description provided for @offerStatAccess.
  ///
  /// In en, this message translates to:
  /// **'Access'**
  String get offerStatAccess;

  /// No description provided for @offerStatOffer.
  ///
  /// In en, this message translates to:
  /// **'Offer'**
  String get offerStatOffer;

  /// No description provided for @offerPtSessions.
  ///
  /// In en, this message translates to:
  /// **'PT sessions'**
  String get offerPtSessions;

  /// No description provided for @offerAboutTitle.
  ///
  /// In en, this message translates to:
  /// **'ABOUT THIS OFFER'**
  String get offerAboutTitle;

  /// No description provided for @offerTermsTitle.
  ///
  /// In en, this message translates to:
  /// **'TERMS & CONDITIONS'**
  String get offerTermsTitle;

  /// No description provided for @offerPriceLabel.
  ///
  /// In en, this message translates to:
  /// **'Offer price'**
  String get offerPriceLabel;

  /// No description provided for @offerSaveAmount.
  ///
  /// In en, this message translates to:
  /// **'Save {amount} EGP'**
  String offerSaveAmount(String amount);

  /// No description provided for @offerTotalPrice.
  ///
  /// In en, this message translates to:
  /// **'Total price'**
  String get offerTotalPrice;

  /// No description provided for @programNotFound.
  ///
  /// In en, this message translates to:
  /// **'Program not found'**
  String get programNotFound;

  /// No description provided for @programWeeksLabel.
  ///
  /// In en, this message translates to:
  /// **'Weeks'**
  String get programWeeksLabel;

  /// No description provided for @programMinPerClass.
  ///
  /// In en, this message translates to:
  /// **'Min / class'**
  String get programMinPerClass;

  /// No description provided for @programAboutTitle.
  ///
  /// In en, this message translates to:
  /// **'ABOUT THIS PROGRAM'**
  String get programAboutTitle;

  /// No description provided for @programFocusTitle.
  ///
  /// In en, this message translates to:
  /// **'WHAT YOU\'LL WORK ON'**
  String get programFocusTitle;

  /// No description provided for @programLedByTitle.
  ///
  /// In en, this message translates to:
  /// **'LED BY'**
  String get programLedByTitle;

  /// No description provided for @programEnrolCta.
  ///
  /// In en, this message translates to:
  /// **'Enrol in this program'**
  String get programEnrolCta;

  /// No description provided for @programPriceLabel.
  ///
  /// In en, this message translates to:
  /// **'Programme price'**
  String get programPriceLabel;

  /// No description provided for @programFullDuration.
  ///
  /// In en, this message translates to:
  /// **'Full {weeks}-week programme'**
  String programFullDuration(int weeks);

  /// No description provided for @programPerSessionLabel.
  ///
  /// In en, this message translates to:
  /// **'Per session'**
  String get programPerSessionLabel;

  /// No description provided for @programSessionsTotal.
  ///
  /// In en, this message translates to:
  /// **'{count} sessions total'**
  String programSessionsTotal(int count);

  /// No description provided for @programPerSessionEgp.
  ///
  /// In en, this message translates to:
  /// **'{price} EGP/session'**
  String programPerSessionEgp(String price);

  /// No description provided for @membershipActiveServices.
  ///
  /// In en, this message translates to:
  /// **'Active Services'**
  String get membershipActiveServices;

  /// No description provided for @membershipMemberDetails.
  ///
  /// In en, this message translates to:
  /// **'Member Details'**
  String get membershipMemberDetails;

  /// No description provided for @membershipMemberNumber.
  ///
  /// In en, this message translates to:
  /// **'Member Number'**
  String get membershipMemberNumber;

  /// No description provided for @membershipNoMemberIdYet.
  ///
  /// In en, this message translates to:
  /// **'No Member ID yet'**
  String get membershipNoMemberIdYet;

  /// No description provided for @membershipStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get membershipStatus;

  /// No description provided for @membershipMemberSince.
  ///
  /// In en, this message translates to:
  /// **'Member Since'**
  String get membershipMemberSince;

  /// No description provided for @membershipGuestInvitations.
  ///
  /// In en, this message translates to:
  /// **'Guest Invitations'**
  String get membershipGuestInvitations;

  /// No description provided for @membershipGuestPasses.
  ///
  /// In en, this message translates to:
  /// **'Guest Passes'**
  String get membershipGuestPasses;

  /// No description provided for @membershipInvitationsLeft.
  ///
  /// In en, this message translates to:
  /// **'{count} left'**
  String membershipInvitationsLeft(int count);

  /// No description provided for @membershipInviteGuests.
  ///
  /// In en, this message translates to:
  /// **'Invite guests to try the gym'**
  String get membershipInviteGuests;

  /// No description provided for @membershipBilling.
  ///
  /// In en, this message translates to:
  /// **'Billing'**
  String get membershipBilling;

  /// No description provided for @membershipViewInvoices.
  ///
  /// In en, this message translates to:
  /// **'View Invoices'**
  String get membershipViewInvoices;

  /// No description provided for @membershipViewInvoicesSubtitle.
  ///
  /// In en, this message translates to:
  /// **'See your payment history & invoices'**
  String get membershipViewInvoicesSubtitle;

  /// No description provided for @membershipUnfreezeTitle.
  ///
  /// In en, this message translates to:
  /// **'Unfreeze Plan'**
  String get membershipUnfreezeTitle;

  /// No description provided for @membershipUnfreezeMessage.
  ///
  /// In en, this message translates to:
  /// **'Resume your plan now? The remaining freeze days will be forfeited.'**
  String get membershipUnfreezeMessage;

  /// No description provided for @membershipUnfreeze.
  ///
  /// In en, this message translates to:
  /// **'Unfreeze'**
  String get membershipUnfreeze;

  /// No description provided for @membershipNoActiveMembership.
  ///
  /// In en, this message translates to:
  /// **'No active membership'**
  String get membershipNoActiveMembership;

  /// No description provided for @membershipNoActiveMembershipSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Contact your gym to get a plan assigned.'**
  String get membershipNoActiveMembershipSubtitle;

  /// No description provided for @membershipExpiredBanner.
  ///
  /// In en, this message translates to:
  /// **'Your membership has expired. Contact the gym to renew.'**
  String get membershipExpiredBanner;

  /// No description provided for @membershipExpiresToday.
  ///
  /// In en, this message translates to:
  /// **'Your membership expires today!'**
  String get membershipExpiresToday;

  /// No description provided for @membershipExpiresInDays.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Your membership expires in 1 day.} other{Your membership expires in {count} days.}}'**
  String membershipExpiresInDays(int count);

  /// No description provided for @membershipSpecialist.
  ///
  /// In en, this message translates to:
  /// **'Specialist: {name}'**
  String membershipSpecialist(String name);

  /// No description provided for @membershipSessionsRemaining.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 session remaining} other{{count} sessions remaining}}'**
  String membershipSessionsRemaining(int count);

  /// No description provided for @bookingsTitle.
  ///
  /// In en, this message translates to:
  /// **'My Bookings'**
  String get bookingsTitle;

  /// No description provided for @bookingsUpcoming.
  ///
  /// In en, this message translates to:
  /// **'Upcoming'**
  String get bookingsUpcoming;

  /// No description provided for @bookingsPast.
  ///
  /// In en, this message translates to:
  /// **'Past'**
  String get bookingsPast;

  /// No description provided for @bookingsNoUpcoming.
  ///
  /// In en, this message translates to:
  /// **'No upcoming bookings'**
  String get bookingsNoUpcoming;

  /// No description provided for @bookingsNoUpcomingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Book a class from the Schedule tab'**
  String get bookingsNoUpcomingSubtitle;

  /// No description provided for @bookingsNoPast.
  ///
  /// In en, this message translates to:
  /// **'No past bookings'**
  String get bookingsNoPast;

  /// No description provided for @bookingsNoPastSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your attended and cancelled sessions will appear here'**
  String get bookingsNoPastSubtitle;

  /// No description provided for @bookingsLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load bookings'**
  String get bookingsLoadFailed;

  /// No description provided for @bookingsClassFallback.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get bookingsClassFallback;

  /// No description provided for @bookingsBookedOn.
  ///
  /// In en, this message translates to:
  /// **'Booked on {date}'**
  String bookingsBookedOn(String date);

  /// No description provided for @bookingsStatusAttended.
  ///
  /// In en, this message translates to:
  /// **'Attended'**
  String get bookingsStatusAttended;

  /// No description provided for @bookingsStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get bookingsStatusCancelled;

  /// No description provided for @bookingsStatusFinished.
  ///
  /// In en, this message translates to:
  /// **'Finished'**
  String get bookingsStatusFinished;

  /// No description provided for @bookingsStatusBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked'**
  String get bookingsStatusBooked;

  /// No description provided for @scheduleTitle.
  ///
  /// In en, this message translates to:
  /// **'Schedule'**
  String get scheduleTitle;

  /// No description provided for @scheduleBookedSuccess.
  ///
  /// In en, this message translates to:
  /// **'Session booked successfully!'**
  String get scheduleBookedSuccess;

  /// No description provided for @scheduleBookingCancelled.
  ///
  /// In en, this message translates to:
  /// **'Booking cancelled.'**
  String get scheduleBookingCancelled;

  /// No description provided for @scheduleCancelFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to cancel. Please try again.'**
  String get scheduleCancelFailed;

  /// No description provided for @scheduleSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Search classes, trainers, locations…'**
  String get scheduleSearchHint;

  /// No description provided for @scheduleClassCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 class} other{{count} classes}}'**
  String scheduleClassCount(int count);

  /// No description provided for @scheduleAllBranches.
  ///
  /// In en, this message translates to:
  /// **'All branches'**
  String get scheduleAllBranches;

  /// No description provided for @scheduleAllClasses.
  ///
  /// In en, this message translates to:
  /// **'All classes'**
  String get scheduleAllClasses;

  /// No description provided for @scheduleRestDayTitle.
  ///
  /// In en, this message translates to:
  /// **'Rest day. Officially.'**
  String get scheduleRestDayTitle;

  /// No description provided for @scheduleRestDaySubtitle.
  ///
  /// In en, this message translates to:
  /// **'No classes today. Your muscles have the day off.'**
  String get scheduleRestDaySubtitle;

  /// No description provided for @scheduleCtaStatsTitle.
  ///
  /// In en, this message translates to:
  /// **'Check your attendance stats'**
  String get scheduleCtaStatsTitle;

  /// No description provided for @scheduleCtaStatsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Admire how hard you\'ve been working'**
  String get scheduleCtaStatsSubtitle;

  /// No description provided for @scheduleCtaOffersTitle.
  ///
  /// In en, this message translates to:
  /// **'Explore membership offers'**
  String get scheduleCtaOffersTitle;

  /// No description provided for @scheduleCtaOffersSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Treat yourself. You showed up all week.'**
  String get scheduleCtaOffersSubtitle;

  /// No description provided for @scheduleNoMatchFilters.
  ///
  /// In en, this message translates to:
  /// **'No classes match your filters'**
  String get scheduleNoMatchFilters;

  /// No description provided for @scheduleClearFilters.
  ///
  /// In en, this message translates to:
  /// **'Clear filters'**
  String get scheduleClearFilters;

  /// No description provided for @scheduleLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load sessions'**
  String get scheduleLoadFailed;

  /// No description provided for @scheduleFilterClasses.
  ///
  /// In en, this message translates to:
  /// **'Filter Classes'**
  String get scheduleFilterClasses;

  /// No description provided for @scheduleReset.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get scheduleReset;

  /// No description provided for @scheduleClassType.
  ///
  /// In en, this message translates to:
  /// **'Class Type'**
  String get scheduleClassType;

  /// No description provided for @scheduleTimeOfDay.
  ///
  /// In en, this message translates to:
  /// **'Time of Day'**
  String get scheduleTimeOfDay;

  /// No description provided for @scheduleMorning.
  ///
  /// In en, this message translates to:
  /// **'Morning'**
  String get scheduleMorning;

  /// No description provided for @scheduleMorningRange.
  ///
  /// In en, this message translates to:
  /// **'6am–12pm'**
  String get scheduleMorningRange;

  /// No description provided for @scheduleAfternoon.
  ///
  /// In en, this message translates to:
  /// **'Afternoon'**
  String get scheduleAfternoon;

  /// No description provided for @scheduleAfternoonRange.
  ///
  /// In en, this message translates to:
  /// **'12–5pm'**
  String get scheduleAfternoonRange;

  /// No description provided for @scheduleEvening.
  ///
  /// In en, this message translates to:
  /// **'Evening'**
  String get scheduleEvening;

  /// No description provided for @scheduleEveningRange.
  ///
  /// In en, this message translates to:
  /// **'5–10pm'**
  String get scheduleEveningRange;

  /// No description provided for @scheduleTrainer.
  ///
  /// In en, this message translates to:
  /// **'Trainer'**
  String get scheduleTrainer;

  /// No description provided for @scheduleLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get scheduleLocation;

  /// No description provided for @scheduleApplyFilters.
  ///
  /// In en, this message translates to:
  /// **'Apply Filters'**
  String get scheduleApplyFilters;

  /// No description provided for @sessionShareFallbackName.
  ///
  /// In en, this message translates to:
  /// **'a class'**
  String get sessionShareFallbackName;

  /// No description provided for @sessionShareWith.
  ///
  /// In en, this message translates to:
  /// **' with {instructor}'**
  String sessionShareWith(String instructor);

  /// No description provided for @sessionShareMessage.
  ///
  /// In en, this message translates to:
  /// **'Join me for {className}{coachPart} at {time} on {date} 💪'**
  String sessionShareMessage(
    String className,
    String coachPart,
    String time,
    String date,
  );

  /// No description provided for @sessionShareBookHere.
  ///
  /// In en, this message translates to:
  /// **'Book here: {link}'**
  String sessionShareBookHere(String link);

  /// No description provided for @sessionShareSubject.
  ///
  /// In en, this message translates to:
  /// **'Join me for {className} on {date}'**
  String sessionShareSubject(String className, String date);

  /// No description provided for @sessionAlreadyBooked.
  ///
  /// In en, this message translates to:
  /// **'You\'ve already booked this session.'**
  String get sessionAlreadyBooked;

  /// No description provided for @sessionNowFull.
  ///
  /// In en, this message translates to:
  /// **'Sorry, this class is now full.'**
  String get sessionNowFull;

  /// No description provided for @sessionBookFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to book. Please try again.'**
  String get sessionBookFailed;

  /// No description provided for @sessionCancelFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to cancel: {error}'**
  String sessionCancelFailed(String error);

  /// No description provided for @sessionAboutClass.
  ///
  /// In en, this message translates to:
  /// **'ABOUT THIS CLASS'**
  String get sessionAboutClass;

  /// No description provided for @sessionWhatToExpect.
  ///
  /// In en, this message translates to:
  /// **'WHAT TO EXPECT'**
  String get sessionWhatToExpect;

  /// No description provided for @sessionOtherClassesToday.
  ///
  /// In en, this message translates to:
  /// **'OTHER CLASSES TODAY'**
  String get sessionOtherClassesToday;

  /// No description provided for @sessionTagCardioBursts.
  ///
  /// In en, this message translates to:
  /// **'Cardio bursts'**
  String get sessionTagCardioBursts;

  /// No description provided for @sessionTagBodyweightMoves.
  ///
  /// In en, this message translates to:
  /// **'Bodyweight moves'**
  String get sessionTagBodyweightMoves;

  /// No description provided for @sessionTagCoreWork.
  ///
  /// In en, this message translates to:
  /// **'Core work'**
  String get sessionTagCoreWork;

  /// No description provided for @sessionTagHighIntensity.
  ///
  /// In en, this message translates to:
  /// **'High intensity'**
  String get sessionTagHighIntensity;

  /// No description provided for @sessionTagNoEquipment.
  ///
  /// In en, this message translates to:
  /// **'No equipment'**
  String get sessionTagNoEquipment;

  /// No description provided for @sessionTagFlexibility.
  ///
  /// In en, this message translates to:
  /// **'Flexibility'**
  String get sessionTagFlexibility;

  /// No description provided for @sessionTagBreathing.
  ///
  /// In en, this message translates to:
  /// **'Breathing'**
  String get sessionTagBreathing;

  /// No description provided for @sessionTagBalance.
  ///
  /// In en, this message translates to:
  /// **'Balance'**
  String get sessionTagBalance;

  /// No description provided for @sessionTagMindfulness.
  ///
  /// In en, this message translates to:
  /// **'Mindfulness'**
  String get sessionTagMindfulness;

  /// No description provided for @sessionTagCardio.
  ///
  /// In en, this message translates to:
  /// **'Cardio'**
  String get sessionTagCardio;

  /// No description provided for @sessionTagLowImpact.
  ///
  /// In en, this message translates to:
  /// **'Low impact'**
  String get sessionTagLowImpact;

  /// No description provided for @sessionTagEndurance.
  ///
  /// In en, this message translates to:
  /// **'Endurance'**
  String get sessionTagEndurance;

  /// No description provided for @sessionTagMusicDriven.
  ///
  /// In en, this message translates to:
  /// **'Music-driven'**
  String get sessionTagMusicDriven;

  /// No description provided for @sessionTagStrength.
  ///
  /// In en, this message translates to:
  /// **'Strength'**
  String get sessionTagStrength;

  /// No description provided for @sessionTagFootwork.
  ///
  /// In en, this message translates to:
  /// **'Footwork'**
  String get sessionTagFootwork;

  /// No description provided for @sessionTagBagWork.
  ///
  /// In en, this message translates to:
  /// **'Bag work'**
  String get sessionTagBagWork;

  /// No description provided for @sessionTagCoreStrength.
  ///
  /// In en, this message translates to:
  /// **'Core strength'**
  String get sessionTagCoreStrength;

  /// No description provided for @sessionTagPosture.
  ///
  /// In en, this message translates to:
  /// **'Posture'**
  String get sessionTagPosture;

  /// No description provided for @sessionTagFitness.
  ///
  /// In en, this message translates to:
  /// **'Fitness'**
  String get sessionTagFitness;

  /// No description provided for @sessionTagFun.
  ///
  /// In en, this message translates to:
  /// **'Fun'**
  String get sessionTagFun;

  /// No description provided for @sessionStatusCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get sessionStatusCancelled;

  /// No description provided for @sessionStatusAttended.
  ///
  /// In en, this message translates to:
  /// **'Attended'**
  String get sessionStatusAttended;

  /// No description provided for @sessionStatusFinished.
  ///
  /// In en, this message translates to:
  /// **'Finished'**
  String get sessionStatusFinished;

  /// No description provided for @sessionStatusOngoing.
  ///
  /// In en, this message translates to:
  /// **'Ongoing'**
  String get sessionStatusOngoing;

  /// No description provided for @sessionStatusBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked'**
  String get sessionStatusBooked;

  /// No description provided for @sessionStatusFull.
  ///
  /// In en, this message translates to:
  /// **'Full'**
  String get sessionStatusFull;

  /// No description provided for @sessionStatusOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get sessionStatusOpen;

  /// No description provided for @sessionMinutesLong.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 minute} other{{count} minutes}}'**
  String sessionMinutesLong(int count);

  /// No description provided for @sessionTime.
  ///
  /// In en, this message translates to:
  /// **'Time'**
  String get sessionTime;

  /// No description provided for @sessionDate.
  ///
  /// In en, this message translates to:
  /// **'Date'**
  String get sessionDate;

  /// No description provided for @sessionDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get sessionDuration;

  /// No description provided for @sessionFitnessSpecialist.
  ///
  /// In en, this message translates to:
  /// **'Fitness Specialist'**
  String get sessionFitnessSpecialist;

  /// No description provided for @sessionCoachName.
  ///
  /// In en, this message translates to:
  /// **'Coach {name}'**
  String sessionCoachName(String name);

  /// No description provided for @sessionCapacity.
  ///
  /// In en, this message translates to:
  /// **'Session capacity'**
  String get sessionCapacity;

  /// No description provided for @sessionPercentBooked.
  ///
  /// In en, this message translates to:
  /// **'{percent}% booked'**
  String sessionPercentBooked(int percent);

  /// No description provided for @sessionSpotsLeft.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 spot left} other{{count} spots left}}'**
  String sessionSpotsLeft(int count);

  /// No description provided for @sessionClassFull.
  ///
  /// In en, this message translates to:
  /// **'Class is full'**
  String get sessionClassFull;

  /// No description provided for @sessionCancelledInfo.
  ///
  /// In en, this message translates to:
  /// **'This session has been cancelled'**
  String get sessionCancelledInfo;

  /// No description provided for @sessionGreatWork.
  ///
  /// In en, this message translates to:
  /// **'Great work — you showed up!'**
  String get sessionGreatWork;

  /// No description provided for @sessionLogged.
  ///
  /// In en, this message translates to:
  /// **'Session logged'**
  String get sessionLogged;

  /// No description provided for @sessionEndedNotAttended.
  ///
  /// In en, this message translates to:
  /// **'This class has ended · not attended'**
  String get sessionEndedNotAttended;

  /// No description provided for @sessionStartedAt.
  ///
  /// In en, this message translates to:
  /// **'Class started at {time}'**
  String sessionStartedAt(String time);

  /// No description provided for @sessionInProgress.
  ///
  /// In en, this message translates to:
  /// **'In progress'**
  String get sessionInProgress;

  /// No description provided for @sessionConfirmedInfo.
  ///
  /// In en, this message translates to:
  /// **'You\'re confirmed for this class'**
  String get sessionConfirmedInfo;

  /// No description provided for @sessionConfirmedBadge.
  ///
  /// In en, this message translates to:
  /// **'Confirmed'**
  String get sessionConfirmedBadge;

  /// No description provided for @sessionFullInfo.
  ///
  /// In en, this message translates to:
  /// **'This class has reached full capacity'**
  String get sessionFullInfo;

  /// No description provided for @sessionUsesOne.
  ///
  /// In en, this message translates to:
  /// **'Uses 1 session from your plan'**
  String get sessionUsesOne;

  /// No description provided for @sessionFreeWithPlan.
  ///
  /// In en, this message translates to:
  /// **'Free with plan'**
  String get sessionFreeWithPlan;

  /// No description provided for @sessionCancelledButton.
  ///
  /// In en, this message translates to:
  /// **'Session cancelled'**
  String get sessionCancelledButton;

  /// No description provided for @sessionClassEnded.
  ///
  /// In en, this message translates to:
  /// **'Class ended'**
  String get sessionClassEnded;

  /// No description provided for @sessionClassOngoing.
  ///
  /// In en, this message translates to:
  /// **'Class is ongoing'**
  String get sessionClassOngoing;

  /// No description provided for @sessionBookingConfirmed.
  ///
  /// In en, this message translates to:
  /// **'Booking confirmed'**
  String get sessionBookingConfirmed;

  /// No description provided for @sessionWalkInScan.
  ///
  /// In en, this message translates to:
  /// **'Walk-in · scan the studio QR'**
  String get sessionWalkInScan;

  /// No description provided for @sessionBookThisClass.
  ///
  /// In en, this message translates to:
  /// **'Book this class'**
  String get sessionBookThisClass;

  /// No description provided for @sessionRateThisClass.
  ///
  /// In en, this message translates to:
  /// **'Rate this class'**
  String get sessionRateThisClass;

  /// No description provided for @sessionCancelBooking.
  ///
  /// In en, this message translates to:
  /// **'Cancel booking'**
  String get sessionCancelBooking;

  /// No description provided for @sessionConfirmBooking.
  ///
  /// In en, this message translates to:
  /// **'Confirm Booking'**
  String get sessionConfirmBooking;

  /// No description provided for @sessionInstructor.
  ///
  /// In en, this message translates to:
  /// **'Instructor'**
  String get sessionInstructor;

  /// No description provided for @sessionTbd.
  ///
  /// In en, this message translates to:
  /// **'TBD'**
  String get sessionTbd;

  /// No description provided for @sessionAvailability.
  ///
  /// In en, this message translates to:
  /// **'Availability'**
  String get sessionAvailability;

  /// No description provided for @packagesUnitSession.
  ///
  /// In en, this message translates to:
  /// **'session'**
  String get packagesUnitSession;

  /// No description provided for @packagesUnitPack.
  ///
  /// In en, this message translates to:
  /// **'pack'**
  String get packagesUnitPack;

  /// No description provided for @packagesTagBestValue.
  ///
  /// In en, this message translates to:
  /// **'Best value'**
  String get packagesTagBestValue;

  /// No description provided for @packagesTagStarter.
  ///
  /// In en, this message translates to:
  /// **'Starter'**
  String get packagesTagStarter;

  /// No description provided for @packagesNoneAvailable.
  ///
  /// In en, this message translates to:
  /// **'No packages available'**
  String get packagesNoneAvailable;

  /// No description provided for @packagesChooseBanner.
  ///
  /// In en, this message translates to:
  /// **'Choose a package below. You\'ll pick your specialist on the next screen.'**
  String get packagesChooseBanner;

  /// No description provided for @packagesEgpPer.
  ///
  /// In en, this message translates to:
  /// **'EGP / {per}'**
  String packagesEgpPer(String per);

  /// No description provided for @packagesEgpEach.
  ///
  /// In en, this message translates to:
  /// **'{amount} EGP each'**
  String packagesEgpEach(int amount);

  /// No description provided for @packageSkillInjuryAssessment.
  ///
  /// In en, this message translates to:
  /// **'Injury assessment'**
  String get packageSkillInjuryAssessment;

  /// No description provided for @packageSkillRehabilitation.
  ///
  /// In en, this message translates to:
  /// **'Rehabilitation'**
  String get packageSkillRehabilitation;

  /// No description provided for @packageSkillPainManagement.
  ///
  /// In en, this message translates to:
  /// **'Pain management'**
  String get packageSkillPainManagement;

  /// No description provided for @packageSkillPostureCorrection.
  ///
  /// In en, this message translates to:
  /// **'Posture correction'**
  String get packageSkillPostureCorrection;

  /// No description provided for @packageSkillExerciseTherapy.
  ///
  /// In en, this message translates to:
  /// **'Exercise therapy'**
  String get packageSkillExerciseTherapy;

  /// No description provided for @packageSkillMealPlanning.
  ///
  /// In en, this message translates to:
  /// **'Meal planning'**
  String get packageSkillMealPlanning;

  /// No description provided for @packageSkillBodyComposition.
  ///
  /// In en, this message translates to:
  /// **'Body composition'**
  String get packageSkillBodyComposition;

  /// No description provided for @packageSkillDietAnalysis.
  ///
  /// In en, this message translates to:
  /// **'Diet analysis'**
  String get packageSkillDietAnalysis;

  /// No description provided for @packageSkillWeightManagement.
  ///
  /// In en, this message translates to:
  /// **'Weight management'**
  String get packageSkillWeightManagement;

  /// No description provided for @packageSkillSupplementAdvice.
  ///
  /// In en, this message translates to:
  /// **'Supplement advice'**
  String get packageSkillSupplementAdvice;

  /// No description provided for @packageSkillStrengthTraining.
  ///
  /// In en, this message translates to:
  /// **'Strength training'**
  String get packageSkillStrengthTraining;

  /// No description provided for @packageSkillCardio.
  ///
  /// In en, this message translates to:
  /// **'Cardio'**
  String get packageSkillCardio;

  /// No description provided for @packageSkillFormCoaching.
  ///
  /// In en, this message translates to:
  /// **'Form coaching'**
  String get packageSkillFormCoaching;

  /// No description provided for @packageSkillGoalSetting.
  ///
  /// In en, this message translates to:
  /// **'Goal setting'**
  String get packageSkillGoalSetting;

  /// No description provided for @packageSkillHiit.
  ///
  /// In en, this message translates to:
  /// **'HIIT'**
  String get packageSkillHiit;

  /// No description provided for @packageSkillFlexibility.
  ///
  /// In en, this message translates to:
  /// **'Flexibility'**
  String get packageSkillFlexibility;

  /// No description provided for @packageChooseCoach.
  ///
  /// In en, this message translates to:
  /// **'Choose your coach'**
  String get packageChooseCoach;

  /// No description provided for @packageYourSpecialist.
  ///
  /// In en, this message translates to:
  /// **'Your specialist'**
  String get packageYourSpecialist;

  /// No description provided for @packageRolePhysiotherapist.
  ///
  /// In en, this message translates to:
  /// **'Physiotherapist'**
  String get packageRolePhysiotherapist;

  /// No description provided for @packageRoleNutritionist.
  ///
  /// In en, this message translates to:
  /// **'Nutritionist'**
  String get packageRoleNutritionist;

  /// No description provided for @packageRolePersonalTrainer.
  ///
  /// In en, this message translates to:
  /// **'Personal Trainer'**
  String get packageRolePersonalTrainer;

  /// No description provided for @packageSessionsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'{count} sessions · {service}'**
  String packageSessionsSubtitle(int count, String service);

  /// No description provided for @packagePrice.
  ///
  /// In en, this message translates to:
  /// **'Price'**
  String get packagePrice;

  /// No description provided for @packageCurrencyEgp.
  ///
  /// In en, this message translates to:
  /// **'EGP'**
  String get packageCurrencyEgp;

  /// No description provided for @packagePricePerWithEach.
  ///
  /// In en, this message translates to:
  /// **'per {per} · {amount} EGP / session'**
  String packagePricePerWithEach(String per, int amount);

  /// No description provided for @packagePricePer.
  ///
  /// In en, this message translates to:
  /// **'per {per}'**
  String packagePricePer(String per);

  /// No description provided for @packageMinEach.
  ///
  /// In en, this message translates to:
  /// **'Min each'**
  String get packageMinEach;

  /// No description provided for @packageEgpPerSession.
  ///
  /// In en, this message translates to:
  /// **'EGP/session'**
  String get packageEgpPerSession;

  /// No description provided for @packageWhatsIncluded.
  ///
  /// In en, this message translates to:
  /// **'WHAT\'S INCLUDED'**
  String get packageWhatsIncluded;

  /// No description provided for @packageNoSpecialist.
  ///
  /// In en, this message translates to:
  /// **'No specialist assigned yet'**
  String get packageNoSpecialist;

  /// No description provided for @packageSelectCoach.
  ///
  /// In en, this message translates to:
  /// **'Select a coach to continue'**
  String get packageSelectCoach;

  /// No description provided for @packageBuyNow.
  ///
  /// In en, this message translates to:
  /// **'Buy now — {price} EGP'**
  String packageBuyNow(int price);

  /// No description provided for @packageRating.
  ///
  /// In en, this message translates to:
  /// **'{rating} rating'**
  String packageRating(String rating);

  /// No description provided for @transferLookupFailed.
  ///
  /// In en, this message translates to:
  /// **'Lookup failed. Try again.'**
  String get transferLookupFailed;

  /// No description provided for @transferFailedConnection.
  ///
  /// In en, this message translates to:
  /// **'Transfer failed. Check your connection and try again.'**
  String get transferFailedConnection;

  /// No description provided for @transferInsufficientSessions.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have enough sessions left.'**
  String get transferInsufficientSessions;

  /// No description provided for @transferNoEligibleMembership.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have a session-based membership to share.'**
  String get transferNoEligibleMembership;

  /// No description provided for @transferCannotSelf.
  ///
  /// In en, this message translates to:
  /// **'You can\'t send sessions to yourself.'**
  String get transferCannotSelf;

  /// No description provided for @transferReceiverNotInGym.
  ///
  /// In en, this message translates to:
  /// **'That member is not part of this gym.'**
  String get transferReceiverNotInGym;

  /// No description provided for @transferReceiverNotFound.
  ///
  /// In en, this message translates to:
  /// **'No member found with that phone.'**
  String get transferReceiverNotFound;

  /// No description provided for @transferTooManyAttempts.
  ///
  /// In en, this message translates to:
  /// **'Too many attempts. Wait a minute and try again.'**
  String get transferTooManyAttempts;

  /// No description provided for @transferServerError.
  ///
  /// In en, this message translates to:
  /// **'Server error during transfer. Try again or contact support.'**
  String get transferServerError;

  /// No description provided for @transferSendSessions.
  ///
  /// In en, this message translates to:
  /// **'Send Sessions'**
  String get transferSendSessions;

  /// No description provided for @transferWhoTitle.
  ///
  /// In en, this message translates to:
  /// **'Who are you sending\nsessions to?'**
  String get transferWhoTitle;

  /// No description provided for @transferSearchSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Search by their registered mobile number.'**
  String get transferSearchSubtitle;

  /// No description provided for @transferTypeAtLeast3.
  ///
  /// In en, this message translates to:
  /// **'Type at least 3 digits to search'**
  String get transferTypeAtLeast3;

  /// No description provided for @transferYouHave.
  ///
  /// In en, this message translates to:
  /// **'You have'**
  String get transferYouHave;

  /// No description provided for @transferSessionsAvailable.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 session available} other{{count} sessions available}}'**
  String transferSessionsAvailable(int count);

  /// No description provided for @transferNoSharable.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have any sharable sessions right now.'**
  String get transferNoSharable;

  /// No description provided for @transferOneMatch.
  ///
  /// In en, this message translates to:
  /// **'1 MATCH'**
  String get transferOneMatch;

  /// No description provided for @transferNoMemberFound.
  ///
  /// In en, this message translates to:
  /// **'No member found'**
  String get transferNoMemberFound;

  /// No description provided for @transferDoubleCheck.
  ///
  /// In en, this message translates to:
  /// **'Double-check the number, or ask them to register first.'**
  String get transferDoubleCheck;

  /// No description provided for @transferStartTyping.
  ///
  /// In en, this message translates to:
  /// **'Start typing your friend\'s mobile number to find them.'**
  String get transferStartTyping;

  /// No description provided for @transferMemberFallback.
  ///
  /// In en, this message translates to:
  /// **'Member'**
  String get transferMemberFallback;

  /// No description provided for @transferVerified.
  ///
  /// In en, this message translates to:
  /// **'VERIFIED'**
  String get transferVerified;

  /// No description provided for @transferHowMany.
  ///
  /// In en, this message translates to:
  /// **'How many?'**
  String get transferHowMany;

  /// No description provided for @transferSendingTo.
  ///
  /// In en, this message translates to:
  /// **'SENDING TO'**
  String get transferSendingTo;

  /// No description provided for @transferSessionsCaps.
  ///
  /// In en, this message translates to:
  /// **'SESSIONS'**
  String get transferSessionsCaps;

  /// No description provided for @transferMax.
  ///
  /// In en, this message translates to:
  /// **'Max'**
  String get transferMax;

  /// No description provided for @transferYoullHaveLeft.
  ///
  /// In en, this message translates to:
  /// **'You\'ll have left'**
  String get transferYoullHaveLeft;

  /// No description provided for @transferSessionsCount.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 session} other{{count} sessions}}'**
  String transferSessionsCount(int count);

  /// No description provided for @transferContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get transferContinue;

  /// No description provided for @transferConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Confirm Transfer'**
  String get transferConfirmTitle;

  /// No description provided for @transferFrom.
  ///
  /// In en, this message translates to:
  /// **'FROM'**
  String get transferFrom;

  /// No description provided for @transferTo.
  ///
  /// In en, this message translates to:
  /// **'TO'**
  String get transferTo;

  /// No description provided for @transferYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get transferYou;

  /// No description provided for @transferSessionType.
  ///
  /// In en, this message translates to:
  /// **'Session type'**
  String get transferSessionType;

  /// No description provided for @transferQuantity.
  ///
  /// In en, this message translates to:
  /// **'Quantity'**
  String get transferQuantity;

  /// No description provided for @transferYourBalance.
  ///
  /// In en, this message translates to:
  /// **'Your balance'**
  String get transferYourBalance;

  /// No description provided for @transferBalanceAfter.
  ///
  /// In en, this message translates to:
  /// **'Balance after'**
  String get transferBalanceAfter;

  /// No description provided for @transferGroupSessions.
  ///
  /// In en, this message translates to:
  /// **'Group sessions'**
  String get transferGroupSessions;

  /// No description provided for @transferWarning.
  ///
  /// In en, this message translates to:
  /// **'This action can\'t be undone. Transferred sessions inherit the recipient\'s expiry.'**
  String get transferWarning;

  /// No description provided for @transferSlideToSend.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Slide to send 1 session} other{Slide to send {count} sessions}}'**
  String transferSlideToSend(int count);

  /// No description provided for @transferEdit.
  ///
  /// In en, this message translates to:
  /// **'Edit transfer'**
  String get transferEdit;

  /// No description provided for @transferSending.
  ///
  /// In en, this message translates to:
  /// **'Sending…'**
  String get transferSending;

  /// No description provided for @transferTransferringTo.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Transferring 1 session to} other{Transferring {count} sessions to}}'**
  String transferTransferringTo(int count);

  /// No description provided for @transferSent.
  ///
  /// In en, this message translates to:
  /// **'Transfer sent'**
  String get transferSent;

  /// No description provided for @transferDeliveredTo.
  ///
  /// In en, this message translates to:
  /// **'have been delivered to'**
  String get transferDeliveredTo;

  /// No description provided for @transferNotificationNote.
  ///
  /// In en, this message translates to:
  /// **'They\'ll get a notification.'**
  String get transferNotificationNote;

  /// No description provided for @transferRemainingBalance.
  ///
  /// In en, this message translates to:
  /// **'Your remaining balance'**
  String get transferRemainingBalance;

  /// No description provided for @transferSendAnother.
  ///
  /// In en, this message translates to:
  /// **'Send another transfer'**
  String get transferSendAnother;

  /// No description provided for @transferFailedTitle.
  ///
  /// In en, this message translates to:
  /// **'Transfer failed'**
  String get transferFailedTitle;

  /// No description provided for @transferFailedBody.
  ///
  /// In en, this message translates to:
  /// **'We couldn\'t complete the transfer. No sessions were taken from your balance.'**
  String get transferFailedBody;

  /// No description provided for @transferUnknownError.
  ///
  /// In en, this message translates to:
  /// **'Unknown error.'**
  String get transferUnknownError;

  /// No description provided for @transferTryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get transferTryAgain;

  /// No description provided for @transferCancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel transfer'**
  String get transferCancel;

  /// No description provided for @qrScanTitle.
  ///
  /// In en, this message translates to:
  /// **'Scan QR Code'**
  String get qrScanTitle;

  /// No description provided for @qrPointInstruction.
  ///
  /// In en, this message translates to:
  /// **'Point at an entrance, studio, or specialist QR code'**
  String get qrPointInstruction;

  /// No description provided for @qrWrongGymTitle.
  ///
  /// In en, this message translates to:
  /// **'Wrong Gym'**
  String get qrWrongGymTitle;

  /// No description provided for @qrWrongGymSubtitle.
  ///
  /// In en, this message translates to:
  /// **'This QR code belongs to a different gym.'**
  String get qrWrongGymSubtitle;

  /// No description provided for @qrStudioOnlyTitle.
  ///
  /// In en, this message translates to:
  /// **'Studio access only'**
  String get qrStudioOnlyTitle;

  /// No description provided for @qrStudioOnlySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Transferred sessions can only be used at studio classes — gym-floor entry needs your own active membership.'**
  String get qrStudioOnlySubtitle;

  /// No description provided for @qrBranchNotIncludedTitle.
  ///
  /// In en, this message translates to:
  /// **'Branch Not Included'**
  String get qrBranchNotIncludedTitle;

  /// No description provided for @qrBranchNotIncludedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your plan does not include access to this branch.'**
  String get qrBranchNotIncludedSubtitle;

  /// No description provided for @qrInvalidTitle.
  ///
  /// In en, this message translates to:
  /// **'Invalid QR Code'**
  String get qrInvalidTitle;

  /// No description provided for @qrMissingStudioInfo.
  ///
  /// In en, this message translates to:
  /// **'Missing studio information.'**
  String get qrMissingStudioInfo;

  /// No description provided for @qrMissingSpecialistInfo.
  ///
  /// In en, this message translates to:
  /// **'Missing specialist information.'**
  String get qrMissingSpecialistInfo;

  /// No description provided for @qrNotRecognized.
  ///
  /// In en, this message translates to:
  /// **'This QR code is not recognized by the gym app.'**
  String get qrNotRecognized;

  /// No description provided for @qrNotRegisteredTitle.
  ///
  /// In en, this message translates to:
  /// **'Not Registered'**
  String get qrNotRegisteredTitle;

  /// No description provided for @qrNotRegisteredSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You are not registered as a member of this gym.'**
  String get qrNotRegisteredSubtitle;

  /// No description provided for @qrSpecialistFallback.
  ///
  /// In en, this message translates to:
  /// **'Specialist'**
  String get qrSpecialistFallback;

  /// No description provided for @qrWrongBranchTitle.
  ///
  /// In en, this message translates to:
  /// **'Wrong Branch'**
  String get qrWrongBranchTitle;

  /// No description provided for @qrWrongBranchSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your membership is not valid for this branch.'**
  String get qrWrongBranchSubtitle;

  /// No description provided for @qrNoSessionTodayTitle.
  ///
  /// In en, this message translates to:
  /// **'No Session Today'**
  String get qrNoSessionTodayTitle;

  /// No description provided for @qrNoSessionTodaySubtitle.
  ///
  /// In en, this message translates to:
  /// **'There is no active session for this class today.'**
  String get qrNoSessionTodaySubtitle;

  /// No description provided for @qrAlreadyCheckedInTitle.
  ///
  /// In en, this message translates to:
  /// **'Already Checked In'**
  String get qrAlreadyCheckedInTitle;

  /// No description provided for @qrAlreadyCheckedInSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You have already checked in to this session.'**
  String get qrAlreadyCheckedInSubtitle;

  /// No description provided for @qrAttendanceRecorded.
  ///
  /// In en, this message translates to:
  /// **'Your attendance for this session has already been recorded.'**
  String get qrAttendanceRecorded;

  /// No description provided for @qrAlreadyCheckedInRecently.
  ///
  /// In en, this message translates to:
  /// **'You\'ve already checked in recently. Please wait a moment before scanning again.'**
  String get qrAlreadyCheckedInRecently;

  /// No description provided for @qrNotBookedTitle.
  ///
  /// In en, this message translates to:
  /// **'Not Booked'**
  String get qrNotBookedTitle;

  /// No description provided for @qrNotBookedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have a booking for today\'s session.'**
  String get qrNotBookedSubtitle;

  /// No description provided for @qrNotBookedStudioSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have a booking for today\'s session in this studio.'**
  String get qrNotBookedStudioSubtitle;

  /// No description provided for @qrBookASession.
  ///
  /// In en, this message translates to:
  /// **'Book a Session'**
  String get qrBookASession;

  /// No description provided for @qrNoSessionsLeftTitle.
  ///
  /// In en, this message translates to:
  /// **'No Sessions Left'**
  String get qrNoSessionsLeftTitle;

  /// No description provided for @qrSessionsExhaustedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You\'ve used all the sessions in your package. Please renew or upgrade your plan.'**
  String get qrSessionsExhaustedSubtitle;

  /// No description provided for @qrSessionsExhaustedShort.
  ///
  /// In en, this message translates to:
  /// **'You\'ve used all the sessions in your package. Please renew or upgrade.'**
  String get qrSessionsExhaustedShort;

  /// No description provided for @qrTooEarlyTitle.
  ///
  /// In en, this message translates to:
  /// **'Too Early'**
  String get qrTooEarlyTitle;

  /// No description provided for @qrTooEarlySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Check-in opens 15 minutes before the session starts.'**
  String get qrTooEarlySubtitle;

  /// No description provided for @qrTooEarlySubtitleAt.
  ///
  /// In en, this message translates to:
  /// **'Check-in opens 15 minutes before the session starts at {time}.'**
  String qrTooEarlySubtitleAt(String time);

  /// No description provided for @qrSessionEndedTitle.
  ///
  /// In en, this message translates to:
  /// **'Session Ended'**
  String get qrSessionEndedTitle;

  /// No description provided for @qrSessionEndedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Check-in is no longer available. The session has already ended.'**
  String get qrSessionEndedSubtitle;

  /// No description provided for @qrSomethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get qrSomethingWentWrong;

  /// No description provided for @qrStudioNotFound.
  ///
  /// In en, this message translates to:
  /// **'This studio was not found. Please contact staff.'**
  String get qrStudioNotFound;

  /// No description provided for @qrNoActiveMembershipTitle.
  ///
  /// In en, this message translates to:
  /// **'No Active Membership'**
  String get qrNoActiveMembershipTitle;

  /// No description provided for @qrNoActiveMembershipSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have an active membership. Please speak to reception.'**
  String get qrNoActiveMembershipSubtitle;

  /// No description provided for @qrMembershipFrozenTitle.
  ///
  /// In en, this message translates to:
  /// **'Membership Frozen'**
  String get qrMembershipFrozenTitle;

  /// No description provided for @qrMembershipFrozenSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your membership is currently paused. Unfreeze it to check in.'**
  String get qrMembershipFrozenSubtitle;

  /// No description provided for @qrStudioAccessNotIncludedTitle.
  ///
  /// In en, this message translates to:
  /// **'Studio Access Not Included'**
  String get qrStudioAccessNotIncludedTitle;

  /// No description provided for @qrStudioAccessNotIncludedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your current plan only includes gym floor access. Upgrade to a sessions plan to attend classes.'**
  String get qrStudioAccessNotIncludedSubtitle;

  /// No description provided for @qrNoActiveSessionTitle.
  ///
  /// In en, this message translates to:
  /// **'No Active Session'**
  String get qrNoActiveSessionTitle;

  /// No description provided for @qrNoActiveSessionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'There is no class running in this studio right now.'**
  String get qrNoActiveSessionSubtitle;

  /// No description provided for @qrCheckinDeniedTitle.
  ///
  /// In en, this message translates to:
  /// **'Check-in Denied'**
  String get qrCheckinDeniedTitle;

  /// No description provided for @qrServicePersonalTraining.
  ///
  /// In en, this message translates to:
  /// **'Personal training'**
  String get qrServicePersonalTraining;

  /// No description provided for @qrServicePhysiotherapy.
  ///
  /// In en, this message translates to:
  /// **'Physiotherapy'**
  String get qrServicePhysiotherapy;

  /// No description provided for @qrServiceNutrition.
  ///
  /// In en, this message translates to:
  /// **'Nutrition'**
  String get qrServiceNutrition;

  /// No description provided for @qrNoPackageTitle.
  ///
  /// In en, this message translates to:
  /// **'No Package Yet'**
  String get qrNoPackageTitle;

  /// No description provided for @qrPackageExpiredTitle.
  ///
  /// In en, this message translates to:
  /// **'Package Expired'**
  String get qrPackageExpiredTitle;

  /// No description provided for @qrNoPackageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You don\'t have an active session package with this specialist.'**
  String get qrNoPackageSubtitle;

  /// No description provided for @qrViewPackages.
  ///
  /// In en, this message translates to:
  /// **'View Packages'**
  String get qrViewPackages;

  /// No description provided for @qrAlreadyLoggedTitle.
  ///
  /// In en, this message translates to:
  /// **'Already Logged'**
  String get qrAlreadyLoggedTitle;

  /// No description provided for @qrTryAgainInMinutes.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{This session was just logged. Try again in about 1 minute.} other{This session was just logged. Try again in about {count} minutes.}}'**
  String qrTryAgainInMinutes(int count);

  /// No description provided for @qrJustLogged.
  ///
  /// In en, this message translates to:
  /// **'This session was already logged a moment ago.'**
  String get qrJustLogged;

  /// No description provided for @qrSpecialistCodeInvalid.
  ///
  /// In en, this message translates to:
  /// **'This specialist code is not valid for your gym.'**
  String get qrSpecialistCodeInvalid;

  /// No description provided for @qrCouldNotLogTitle.
  ///
  /// In en, this message translates to:
  /// **'Could Not Log Session'**
  String get qrCouldNotLogTitle;

  /// No description provided for @qrGymAccessNotIncludedTitle.
  ///
  /// In en, this message translates to:
  /// **'Gym Access Not Included'**
  String get qrGymAccessNotIncludedTitle;

  /// No description provided for @qrGymAccessNotIncludedSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your current plan only includes class sessions. Upgrade to access the gym floor.'**
  String get qrGymAccessNotIncludedSubtitle;

  /// No description provided for @qrCheckinFailedTitle.
  ///
  /// In en, this message translates to:
  /// **'Check-in Failed'**
  String get qrCheckinFailedTitle;

  /// No description provided for @qrCodeReplaced.
  ///
  /// In en, this message translates to:
  /// **'This QR code has been replaced. Please scan the updated QR code.'**
  String get qrCodeReplaced;

  /// No description provided for @qrCheckedInTitle.
  ///
  /// In en, this message translates to:
  /// **'Checked In!'**
  String get qrCheckedInTitle;

  /// No description provided for @qrWelcomeBack.
  ///
  /// In en, this message translates to:
  /// **'Welcome back! Your visit has been recorded.'**
  String get qrWelcomeBack;

  /// No description provided for @qrAttendanceMarkedTitle.
  ///
  /// In en, this message translates to:
  /// **'Attendance Marked!'**
  String get qrAttendanceMarkedTitle;

  /// No description provided for @qrSessionLoggedTitle.
  ///
  /// In en, this message translates to:
  /// **'Session Logged!'**
  String get qrSessionLoggedTitle;

  /// No description provided for @qrLastSessionWith.
  ///
  /// In en, this message translates to:
  /// **'That was your last session with {name}.'**
  String qrLastSessionWith(String name);

  /// No description provided for @qrOneSessionUsedWith.
  ///
  /// In en, this message translates to:
  /// **'One session used with {name}.'**
  String qrOneSessionUsedWith(String name);

  /// No description provided for @qrCheckInTime.
  ///
  /// In en, this message translates to:
  /// **'Check-in Time'**
  String get qrCheckInTime;

  /// No description provided for @qrGymMainEntrance.
  ///
  /// In en, this message translates to:
  /// **'Gym Main Entrance'**
  String get qrGymMainEntrance;

  /// No description provided for @qrSessionLabel.
  ///
  /// In en, this message translates to:
  /// **'Session'**
  String get qrSessionLabel;

  /// No description provided for @qrServiceLabel.
  ///
  /// In en, this message translates to:
  /// **'Service'**
  String get qrServiceLabel;

  /// No description provided for @qrSessionsLeftLabel.
  ///
  /// In en, this message translates to:
  /// **'Sessions Left'**
  String get qrSessionsLeftLabel;

  /// No description provided for @qrClosingIn.
  ///
  /// In en, this message translates to:
  /// **'Closing in {seconds} seconds…'**
  String qrClosingIn(int seconds);

  /// No description provided for @qrScanAgain.
  ///
  /// In en, this message translates to:
  /// **'Scan Again'**
  String get qrScanAgain;

  /// No description provided for @qrNoGymAccessBody.
  ///
  /// In en, this message translates to:
  /// **'Your current subscription does not include gym access.\nUpgrade your plan to enter the gym.'**
  String get qrNoGymAccessBody;

  /// No description provided for @qrViewMemberships.
  ///
  /// In en, this message translates to:
  /// **'View Memberships'**
  String get qrViewMemberships;

  /// No description provided for @qrFrozenUntilBody.
  ///
  /// In en, this message translates to:
  /// **'Your membership is paused until {date}.\nYou cannot check in while frozen.'**
  String qrFrozenUntilBody(String date);

  /// No description provided for @qrFrozenBody.
  ///
  /// In en, this message translates to:
  /// **'Your membership is currently frozen.\nYou cannot check in while frozen.'**
  String get qrFrozenBody;

  /// No description provided for @qrUnfreezeFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to unfreeze: {error}'**
  String qrUnfreezeFailed(String error);

  /// No description provided for @qrResuming.
  ///
  /// In en, this message translates to:
  /// **'Resuming…'**
  String get qrResuming;

  /// No description provided for @qrResumeNow.
  ///
  /// In en, this message translates to:
  /// **'Resume Now'**
  String get qrResumeNow;

  /// No description provided for @paymobSecurePayment.
  ///
  /// In en, this message translates to:
  /// **'Secure Payment'**
  String get paymobSecurePayment;

  /// No description provided for @paymobCardPayment.
  ///
  /// In en, this message translates to:
  /// **'Card Payment'**
  String get paymobCardPayment;

  /// No description provided for @paymobTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total amount'**
  String get paymobTotalAmount;

  /// No description provided for @paymobCardDetails.
  ///
  /// In en, this message translates to:
  /// **'Card Details'**
  String get paymobCardDetails;

  /// No description provided for @paymobPayAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount}'**
  String paymobPayAmount(String amount);

  /// No description provided for @paymobProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing…'**
  String get paymobProcessing;

  /// No description provided for @paymobDeclinedCheckCard.
  ///
  /// In en, this message translates to:
  /// **'Payment was declined. Please check your card details.'**
  String get paymobDeclinedCheckCard;

  /// No description provided for @paymobSecuredFooter.
  ///
  /// In en, this message translates to:
  /// **'🔒 Secured by Paymob — your card data is never stored'**
  String get paymobSecuredFooter;

  /// No description provided for @paymentGymNotFound.
  ///
  /// In en, this message translates to:
  /// **'Unable to process payment — gym not found'**
  String get paymentGymNotFound;

  /// No description provided for @paymentPending.
  ///
  /// In en, this message translates to:
  /// **'Payment is pending. We\'ll update your account once confirmed.'**
  String get paymentPending;

  /// No description provided for @paymentDeclined.
  ///
  /// In en, this message translates to:
  /// **'Payment was declined. Please try again.'**
  String get paymentDeclined;

  /// No description provided for @paymentError.
  ///
  /// In en, this message translates to:
  /// **'Payment error: {error}'**
  String paymentError(String error);

  /// No description provided for @paymentInvalidPromo.
  ///
  /// In en, this message translates to:
  /// **'Invalid promo code'**
  String get paymentInvalidPromo;

  /// No description provided for @paymentPromoValidationFailed.
  ///
  /// In en, this message translates to:
  /// **'Could not validate promo code'**
  String get paymentPromoValidationFailed;

  /// No description provided for @paymentSummaryTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment summary'**
  String get paymentSummaryTitle;

  /// No description provided for @paymentBuyNow.
  ///
  /// In en, this message translates to:
  /// **'Buy now — {amount} EGP'**
  String paymentBuyNow(String amount);

  /// No description provided for @paymentSecuredBySsl.
  ///
  /// In en, this message translates to:
  /// **'Secured by SSL'**
  String get paymentSecuredBySsl;

  /// No description provided for @paymentCurrencyEgp.
  ///
  /// In en, this message translates to:
  /// **'EGP'**
  String get paymentCurrencyEgp;

  /// No description provided for @paymentAmountEgp.
  ///
  /// In en, this message translates to:
  /// **'{amount} EGP'**
  String paymentAmountEgp(String amount);

  /// No description provided for @paymentMemberDiscountPct.
  ///
  /// In en, this message translates to:
  /// **'{pct}% member discount'**
  String paymentMemberDiscountPct(String pct);

  /// No description provided for @paymentAppliedAsMember.
  ///
  /// In en, this message translates to:
  /// **'applied as {planName} member'**
  String paymentAppliedAsMember(String planName);

  /// No description provided for @paymentPriceBreakdown.
  ///
  /// In en, this message translates to:
  /// **'Price breakdown'**
  String get paymentPriceBreakdown;

  /// No description provided for @paymentMemberDiscountLabel.
  ///
  /// In en, this message translates to:
  /// **'Member discount ({name})'**
  String paymentMemberDiscountLabel(String name);

  /// No description provided for @paymentPctOff.
  ///
  /// In en, this message translates to:
  /// **'{pct}% off'**
  String paymentPctOff(String pct);

  /// No description provided for @paymentPromoCode.
  ///
  /// In en, this message translates to:
  /// **'Promo code'**
  String get paymentPromoCode;

  /// No description provided for @paymentSubtotal.
  ///
  /// In en, this message translates to:
  /// **'Subtotal'**
  String get paymentSubtotal;

  /// No description provided for @paymentVat.
  ///
  /// In en, this message translates to:
  /// **'VAT (14%)'**
  String get paymentVat;

  /// No description provided for @paymentTotal.
  ///
  /// In en, this message translates to:
  /// **'Total'**
  String get paymentTotal;

  /// No description provided for @paymentYouSaved.
  ///
  /// In en, this message translates to:
  /// **'You saved {amount} EGP!'**
  String paymentYouSaved(String amount);

  /// No description provided for @paymentApply.
  ///
  /// In en, this message translates to:
  /// **'Apply'**
  String get paymentApply;

  /// No description provided for @paymentMethodTitle.
  ///
  /// In en, this message translates to:
  /// **'Payment'**
  String get paymentMethodTitle;

  /// No description provided for @paymentMethodCard.
  ///
  /// In en, this message translates to:
  /// **'Credit / Debit card'**
  String get paymentMethodCard;

  /// No description provided for @paymentTypeMembershipsLower.
  ///
  /// In en, this message translates to:
  /// **'memberships'**
  String get paymentTypeMembershipsLower;

  /// No description provided for @paymentTypeOffersLower.
  ///
  /// In en, this message translates to:
  /// **'offers'**
  String get paymentTypeOffersLower;

  /// No description provided for @paymentTypeSessionPackagesLower.
  ///
  /// In en, this message translates to:
  /// **'session packages'**
  String get paymentTypeSessionPackagesLower;

  /// No description provided for @paymentTypeProgrammesLower.
  ///
  /// In en, this message translates to:
  /// **'programmes'**
  String get paymentTypeProgrammesLower;

  /// No description provided for @paymentStepEmailTitle.
  ///
  /// In en, this message translates to:
  /// **'Check your email'**
  String get paymentStepEmailTitle;

  /// No description provided for @paymentStepEmailDesc.
  ///
  /// In en, this message translates to:
  /// **'A receipt and booking confirmation have been sent to your registered email address.'**
  String get paymentStepEmailDesc;

  /// No description provided for @paymentStepMembershipActiveTitle.
  ///
  /// In en, this message translates to:
  /// **'Membership is now active'**
  String get paymentStepMembershipActiveTitle;

  /// No description provided for @paymentStepMembershipActiveDesc.
  ///
  /// In en, this message translates to:
  /// **'Your plan has been activated. Head to the home screen to view your membership details.'**
  String get paymentStepMembershipActiveDesc;

  /// No description provided for @paymentStepScanQrTitle.
  ///
  /// In en, this message translates to:
  /// **'Scan QR to check in'**
  String get paymentStepScanQrTitle;

  /// No description provided for @paymentStepScanQrDesc.
  ///
  /// In en, this message translates to:
  /// **'Open the QR tab when you arrive at the gym to log your attendance.'**
  String get paymentStepScanQrDesc;

  /// No description provided for @paymentStepSessionsAvailableTitle.
  ///
  /// In en, this message translates to:
  /// **'Sessions are now available'**
  String get paymentStepSessionsAvailableTitle;

  /// No description provided for @paymentStepSessionsAddedDesc.
  ///
  /// In en, this message translates to:
  /// **'Your {title} sessions have been added to your account. Book them from the Schedule tab.'**
  String paymentStepSessionsAddedDesc(String title);

  /// No description provided for @paymentStepScanQrDayOneTitle.
  ///
  /// In en, this message translates to:
  /// **'Scan QR on day one'**
  String get paymentStepScanQrDayOneTitle;

  /// No description provided for @paymentStepScanQrInstructorDesc.
  ///
  /// In en, this message translates to:
  /// **'Open the QR tab when you arrive. Your instructor will guide you to the right area.'**
  String get paymentStepScanQrInstructorDesc;

  /// No description provided for @paymentStepOfferMembershipDesc.
  ///
  /// In en, this message translates to:
  /// **'Your membership has been activated at the offer price. Head to the home screen to view your plan details.'**
  String get paymentStepOfferMembershipDesc;

  /// No description provided for @paymentStepOfferSessionsDesc.
  ///
  /// In en, this message translates to:
  /// **'Your sessions have been added at the offer price. Book them from the Schedule tab.'**
  String get paymentStepOfferSessionsDesc;

  /// No description provided for @paymentStepSessionsActiveTitle.
  ///
  /// In en, this message translates to:
  /// **'Sessions are now active'**
  String get paymentStepSessionsActiveTitle;

  /// No description provided for @paymentStepBookFirstDesc.
  ///
  /// In en, this message translates to:
  /// **'Head to the Schedule tab to book your first {title} session.'**
  String paymentStepBookFirstDesc(String title);

  /// No description provided for @paymentStepScanQrTrainerDesc.
  ///
  /// In en, this message translates to:
  /// **'Open the QR tab when you arrive. Your trainer will be ready at your scheduled time.'**
  String get paymentStepScanQrTrainerDesc;

  /// No description provided for @paymentSuccessTitle.
  ///
  /// In en, this message translates to:
  /// **'Purchase successful!'**
  String get paymentSuccessTitle;

  /// No description provided for @paymentOrderNumber.
  ///
  /// In en, this message translates to:
  /// **'Order #{orderNumber}'**
  String paymentOrderNumber(String orderNumber);

  /// No description provided for @paymentYourOrder.
  ///
  /// In en, this message translates to:
  /// **'YOUR ORDER'**
  String get paymentYourOrder;

  /// No description provided for @paymentItem.
  ///
  /// In en, this message translates to:
  /// **'Item'**
  String get paymentItem;

  /// No description provided for @paymentDuration.
  ///
  /// In en, this message translates to:
  /// **'Duration'**
  String get paymentDuration;

  /// No description provided for @paymentDetails.
  ///
  /// In en, this message translates to:
  /// **'Details'**
  String get paymentDetails;

  /// No description provided for @paymentStarts.
  ///
  /// In en, this message translates to:
  /// **'Starts'**
  String get paymentStarts;

  /// No description provided for @paymentOriginalPrice.
  ///
  /// In en, this message translates to:
  /// **'Original price'**
  String get paymentOriginalPrice;

  /// No description provided for @paymentOfferDiscount.
  ///
  /// In en, this message translates to:
  /// **'Offer discount'**
  String get paymentOfferDiscount;

  /// No description provided for @paymentPromoWithCode.
  ///
  /// In en, this message translates to:
  /// **'Promo ({code})'**
  String paymentPromoWithCode(String code);

  /// No description provided for @paymentTotalPaid.
  ///
  /// In en, this message translates to:
  /// **'Total paid'**
  String get paymentTotalPaid;

  /// No description provided for @paymentSavedOnOrder.
  ///
  /// In en, this message translates to:
  /// **'You saved {amount} EGP on this order'**
  String paymentSavedOnOrder(String amount);

  /// No description provided for @paymentSavingsBreakdown.
  ///
  /// In en, this message translates to:
  /// **'{offer} EGP offer + {promo} EGP promo'**
  String paymentSavingsBreakdown(String offer, String promo);

  /// No description provided for @paymentWhatHappensNext.
  ///
  /// In en, this message translates to:
  /// **'WHAT HAPPENS NEXT'**
  String get paymentWhatHappensNext;

  /// No description provided for @paymentBackToHome.
  ///
  /// In en, this message translates to:
  /// **'Back to home'**
  String get paymentBackToHome;

  /// No description provided for @paymentBrowseMore.
  ///
  /// In en, this message translates to:
  /// **'Browse more {type}'**
  String paymentBrowseMore(String type);

  /// No description provided for @profileTitle.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profileTitle;

  /// No description provided for @profileActiveServices.
  ///
  /// In en, this message translates to:
  /// **'Active services'**
  String get profileActiveServices;

  /// No description provided for @profileAccount.
  ///
  /// In en, this message translates to:
  /// **'Account'**
  String get profileAccount;

  /// No description provided for @profileSecurityLabel.
  ///
  /// In en, this message translates to:
  /// **'SECURITY'**
  String get profileSecurityLabel;

  /// No description provided for @profileSessionLabel.
  ///
  /// In en, this message translates to:
  /// **'SESSION'**
  String get profileSessionLabel;

  /// No description provided for @profileAccountLabel.
  ///
  /// In en, this message translates to:
  /// **'ACCOUNT'**
  String get profileAccountLabel;

  /// No description provided for @profileDocumentLabel.
  ///
  /// In en, this message translates to:
  /// **'DOCUMENT'**
  String get profileDocumentLabel;

  /// No description provided for @profileChangePassword.
  ///
  /// In en, this message translates to:
  /// **'Change password'**
  String get profileChangePassword;

  /// No description provided for @profileSignOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get profileSignOut;

  /// No description provided for @profileDeleteAccount.
  ///
  /// In en, this message translates to:
  /// **'Delete account'**
  String get profileDeleteAccount;

  /// No description provided for @profileLegal.
  ///
  /// In en, this message translates to:
  /// **'Legal'**
  String get profileLegal;

  /// No description provided for @profileTerms.
  ///
  /// In en, this message translates to:
  /// **'Terms & Conditions'**
  String get profileTerms;

  /// No description provided for @profilePrivacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get profilePrivacy;

  /// No description provided for @profileMemberFallback.
  ///
  /// In en, this message translates to:
  /// **'Member'**
  String get profileMemberFallback;

  /// No description provided for @profileMemberSince.
  ///
  /// In en, this message translates to:
  /// **'Member since {date}'**
  String profileMemberSince(String date);

  /// No description provided for @profileEmailLabel.
  ///
  /// In en, this message translates to:
  /// **'EMAIL'**
  String get profileEmailLabel;

  /// No description provided for @profileMobileLabel.
  ///
  /// In en, this message translates to:
  /// **'MOBILE'**
  String get profileMobileLabel;

  /// No description provided for @profileDobLabel.
  ///
  /// In en, this message translates to:
  /// **'DATE OF BIRTH'**
  String get profileDobLabel;

  /// No description provided for @profileShareSessions.
  ///
  /// In en, this message translates to:
  /// **'Share sessions'**
  String get profileShareSessions;

  /// No description provided for @profileShareSessionsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Transfer sessions to another member'**
  String get profileShareSessionsSubtitle;

  /// No description provided for @profileTakePhoto.
  ///
  /// In en, this message translates to:
  /// **'Take photo'**
  String get profileTakePhoto;

  /// No description provided for @profileChooseFromLibrary.
  ///
  /// In en, this message translates to:
  /// **'Choose from library'**
  String get profileChooseFromLibrary;

  /// No description provided for @profileCropPhoto.
  ///
  /// In en, this message translates to:
  /// **'Crop Photo'**
  String get profileCropPhoto;

  /// No description provided for @profileCropFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to crop image'**
  String get profileCropFailed;

  /// No description provided for @profilePhotoUpdated.
  ///
  /// In en, this message translates to:
  /// **'Profile photo updated'**
  String get profilePhotoUpdated;

  /// No description provided for @profileEditProfile.
  ///
  /// In en, this message translates to:
  /// **'Edit profile'**
  String get profileEditProfile;

  /// No description provided for @profileFullName.
  ///
  /// In en, this message translates to:
  /// **'Full name'**
  String get profileFullName;

  /// No description provided for @profileMobileWithCode.
  ///
  /// In en, this message translates to:
  /// **'Mobile (with country code)'**
  String get profileMobileWithCode;

  /// No description provided for @profileDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get profileDateOfBirth;

  /// No description provided for @profileSelectDob.
  ///
  /// In en, this message translates to:
  /// **'Select Date of Birth'**
  String get profileSelectDob;

  /// No description provided for @profileUpdated.
  ///
  /// In en, this message translates to:
  /// **'Profile updated'**
  String get profileUpdated;

  /// No description provided for @profileTapToChoose.
  ///
  /// In en, this message translates to:
  /// **'Tap to choose'**
  String get profileTapToChoose;

  /// No description provided for @profileNewPassword.
  ///
  /// In en, this message translates to:
  /// **'New password'**
  String get profileNewPassword;

  /// No description provided for @profileConfirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get profileConfirmPassword;

  /// No description provided for @profilePasswordMin.
  ///
  /// In en, this message translates to:
  /// **'Password must be at least 8 characters'**
  String get profilePasswordMin;

  /// No description provided for @profilePasswordsDontMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords don\'t match'**
  String get profilePasswordsDontMatch;

  /// No description provided for @profilePasswordUpdated.
  ///
  /// In en, this message translates to:
  /// **'Password updated'**
  String get profilePasswordUpdated;

  /// No description provided for @profileUpdatePassword.
  ///
  /// In en, this message translates to:
  /// **'Update password'**
  String get profileUpdatePassword;

  /// No description provided for @profileSignOutConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Sign out of your account?'**
  String get profileSignOutConfirmTitle;

  /// No description provided for @profileSignOutConfirmBody.
  ///
  /// In en, this message translates to:
  /// **'You can sign back in any time with your email and password.'**
  String get profileSignOutConfirmBody;

  /// No description provided for @profileDeleteConfirmTitle.
  ///
  /// In en, this message translates to:
  /// **'Delete your account?'**
  String get profileDeleteConfirmTitle;

  /// No description provided for @profileDeleteWarningPrefix.
  ///
  /// In en, this message translates to:
  /// **'This permanently removes your profile, sessions, and transfer history. This '**
  String get profileDeleteWarningPrefix;

  /// No description provided for @profileDeleteWarningEmphasis.
  ///
  /// In en, this message translates to:
  /// **'can\'t be undone'**
  String get profileDeleteWarningEmphasis;

  /// No description provided for @profileTypeToConfirmPrefix.
  ///
  /// In en, this message translates to:
  /// **'Type '**
  String get profileTypeToConfirmPrefix;

  /// No description provided for @profileTypeToConfirmSuffix.
  ///
  /// In en, this message translates to:
  /// **' to confirm'**
  String get profileTypeToConfirmSuffix;

  /// No description provided for @profilePackageFallback.
  ///
  /// In en, this message translates to:
  /// **'Package'**
  String get profilePackageFallback;

  /// No description provided for @profileWithTrainer.
  ///
  /// In en, this message translates to:
  /// **'with {name}'**
  String profileWithTrainer(String name);

  /// No description provided for @profileOfTotalLeft.
  ///
  /// In en, this message translates to:
  /// **'of {total} left'**
  String profileOfTotalLeft(int total);

  /// No description provided for @profileMembershipFallback.
  ///
  /// In en, this message translates to:
  /// **'Membership'**
  String get profileMembershipFallback;

  /// No description provided for @profileExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires {date}'**
  String profileExpires(String date);

  /// No description provided for @profileUnlimitedSessions.
  ///
  /// In en, this message translates to:
  /// **'unlimited sessions'**
  String get profileUnlimitedSessions;

  /// No description provided for @profileSessionsLeftSuffix.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{session left} other{sessions left}}'**
  String profileSessionsLeftSuffix(int count);

  /// No description provided for @profileIncludesTransfers.
  ///
  /// In en, this message translates to:
  /// **'Includes {count} from transfers'**
  String profileIncludesTransfers(int count);

  /// No description provided for @guestInvTitle.
  ///
  /// In en, this message translates to:
  /// **'Guest Invitations'**
  String get guestInvTitle;

  /// No description provided for @guestInvInviteGuest.
  ///
  /// In en, this message translates to:
  /// **'Invite Guest'**
  String get guestInvInviteGuest;

  /// No description provided for @guestInvNoInvitesLeft.
  ///
  /// In en, this message translates to:
  /// **'No Invites Left'**
  String get guestInvNoInvitesLeft;

  /// No description provided for @guestInvSentInvitations.
  ///
  /// In en, this message translates to:
  /// **'Sent Invitations'**
  String get guestInvSentInvitations;

  /// No description provided for @guestInvNotIncluded.
  ///
  /// In en, this message translates to:
  /// **'Guest invitations are not included in your current plan.'**
  String get guestInvNotIncluded;

  /// No description provided for @guestInvDayPass.
  ///
  /// In en, this message translates to:
  /// **'{days}-day pass'**
  String guestInvDayPass(String days);

  /// No description provided for @guestInvOneVisit.
  ///
  /// In en, this message translates to:
  /// **'1 visit'**
  String get guestInvOneVisit;

  /// No description provided for @guestInvInvitesRemaining.
  ///
  /// In en, this message translates to:
  /// **'invites remaining'**
  String get guestInvInvitesRemaining;

  /// No description provided for @guestInvEachGuestGets.
  ///
  /// In en, this message translates to:
  /// **'Each guest gets a {pass}'**
  String guestInvEachGuestGets(String pass);

  /// No description provided for @guestInvNoneSentYet.
  ///
  /// In en, this message translates to:
  /// **'No invitations sent yet'**
  String get guestInvNoneSentYet;

  /// No description provided for @guestInvInviteFriend.
  ///
  /// In en, this message translates to:
  /// **'Invite a friend and they\'ll get a free guest pass!'**
  String get guestInvInviteFriend;

  /// No description provided for @guestInvNoneRemaining.
  ///
  /// In en, this message translates to:
  /// **'You have no invites remaining.'**
  String get guestInvNoneRemaining;

  /// No description provided for @guestInvSendInvitation.
  ///
  /// In en, this message translates to:
  /// **'Send Invitation'**
  String get guestInvSendInvitation;

  /// No description provided for @guestInvDaysLeft.
  ///
  /// In en, this message translates to:
  /// **'{days}d left'**
  String guestInvDaysLeft(int days);

  /// No description provided for @guestInvHoursLeft.
  ///
  /// In en, this message translates to:
  /// **'{hours}h left'**
  String guestInvHoursLeft(int hours);

  /// No description provided for @guestInvExpiringSoon.
  ///
  /// In en, this message translates to:
  /// **'Expiring soon'**
  String get guestInvExpiringSoon;

  /// No description provided for @guestInvSentWithVisits.
  ///
  /// In en, this message translates to:
  /// **'Invitation sent! Your guest gets {count} visits.'**
  String guestInvSentWithVisits(int count);

  /// No description provided for @guestInvSentSimple.
  ///
  /// In en, this message translates to:
  /// **'Invitation sent! Your guest will receive instructions to register.'**
  String get guestInvSentSimple;

  /// No description provided for @guestInvSendGuestInvitation.
  ///
  /// In en, this message translates to:
  /// **'Send Guest Invitation'**
  String get guestInvSendGuestInvitation;

  /// No description provided for @guestInvSheetSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your guest will receive an invitation to register and get a free pass.'**
  String get guestInvSheetSubtitle;

  /// No description provided for @guestInvGuestNameOptional.
  ///
  /// In en, this message translates to:
  /// **'Guest Name (optional)'**
  String get guestInvGuestNameOptional;

  /// No description provided for @guestInvEmailRequired.
  ///
  /// In en, this message translates to:
  /// **'Email *'**
  String get guestInvEmailRequired;

  /// No description provided for @guestInvEmailIsRequired.
  ///
  /// In en, this message translates to:
  /// **'Email is required'**
  String get guestInvEmailIsRequired;

  /// No description provided for @guestInvEnterValidEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email'**
  String get guestInvEnterValidEmail;

  /// No description provided for @guestInvPhoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Phone *'**
  String get guestInvPhoneRequired;

  /// No description provided for @guestInvPhoneIsRequired.
  ///
  /// In en, this message translates to:
  /// **'Phone is required'**
  String get guestInvPhoneIsRequired;

  /// No description provided for @guestInvVisitsToAllocate.
  ///
  /// In en, this message translates to:
  /// **'Visits to allocate'**
  String get guestInvVisitsToAllocate;

  /// No description provided for @guestInvRemainingAfter.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{1 invite remaining after this} other{{count} invites remaining after this}}'**
  String guestInvRemainingAfter(int count);

  /// No description provided for @guestInvSendWithVisits.
  ///
  /// In en, this message translates to:
  /// **'Send Invitation ({count} visits)'**
  String guestInvSendWithVisits(int count);

  /// No description provided for @guestGymInfoEmpty.
  ///
  /// In en, this message translates to:
  /// **'No gym info available'**
  String get guestGymInfoEmpty;

  /// No description provided for @guestGymInfoContactLocation.
  ///
  /// In en, this message translates to:
  /// **'Contact & Location'**
  String get guestGymInfoContactLocation;

  /// No description provided for @guestGymInfoOperatingHours.
  ///
  /// In en, this message translates to:
  /// **'Operating Hours'**
  String get guestGymInfoOperatingHours;

  /// No description provided for @guestGymInfoClosed.
  ///
  /// In en, this message translates to:
  /// **'Closed'**
  String get guestGymInfoClosed;

  /// No description provided for @guestGymInfoDayMonday.
  ///
  /// In en, this message translates to:
  /// **'Monday'**
  String get guestGymInfoDayMonday;

  /// No description provided for @guestGymInfoDayTuesday.
  ///
  /// In en, this message translates to:
  /// **'Tuesday'**
  String get guestGymInfoDayTuesday;

  /// No description provided for @guestGymInfoDayWednesday.
  ///
  /// In en, this message translates to:
  /// **'Wednesday'**
  String get guestGymInfoDayWednesday;

  /// No description provided for @guestGymInfoDayThursday.
  ///
  /// In en, this message translates to:
  /// **'Thursday'**
  String get guestGymInfoDayThursday;

  /// No description provided for @guestGymInfoDayFriday.
  ///
  /// In en, this message translates to:
  /// **'Friday'**
  String get guestGymInfoDayFriday;

  /// No description provided for @guestGymInfoDaySaturday.
  ///
  /// In en, this message translates to:
  /// **'Saturday'**
  String get guestGymInfoDaySaturday;

  /// No description provided for @guestGymInfoDaySunday.
  ///
  /// In en, this message translates to:
  /// **'Sunday'**
  String get guestGymInfoDaySunday;

  /// No description provided for @guestHomeMembershipPlans.
  ///
  /// In en, this message translates to:
  /// **'Membership plans'**
  String get guestHomeMembershipPlans;

  /// No description provided for @guestHomeTodaysClasses.
  ///
  /// In en, this message translates to:
  /// **'Today\'s classes'**
  String get guestHomeTodaysClasses;

  /// No description provided for @guestHomeGymFallback.
  ///
  /// In en, this message translates to:
  /// **'the gym'**
  String get guestHomeGymFallback;

  /// No description provided for @guestHomeJoinGymToday.
  ///
  /// In en, this message translates to:
  /// **'Join {gymName} today'**
  String guestHomeJoinGymToday(String gymName);

  /// No description provided for @guestHomePlansSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose from sessions or duration memberships.\nFlexible plans for every goal.'**
  String get guestHomePlansSubtitle;

  /// No description provided for @guestHomeCheckInLocked.
  ///
  /// In en, this message translates to:
  /// **'Check in locked'**
  String get guestHomeCheckInLocked;

  /// No description provided for @guestHomeMembersOnly.
  ///
  /// In en, this message translates to:
  /// **'Members only — sign in to access'**
  String get guestHomeMembersOnly;

  /// No description provided for @guestHomeClassFallback.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get guestHomeClassFallback;

  /// No description provided for @guestHomeNoClassesToday.
  ///
  /// In en, this message translates to:
  /// **'No classes scheduled today'**
  String get guestHomeNoClassesToday;

  /// No description provided for @guestPlansEmpty.
  ///
  /// In en, this message translates to:
  /// **'No plans available'**
  String get guestPlansEmpty;

  /// No description provided for @guestPlansPriceAed.
  ///
  /// In en, this message translates to:
  /// **'AED {price}'**
  String guestPlansPriceAed(String price);

  /// No description provided for @guestPlansPerCycle.
  ///
  /// In en, this message translates to:
  /// **'/ {cycle}'**
  String guestPlansPerCycle(String cycle);

  /// No description provided for @guestPlansBillingMonthly.
  ///
  /// In en, this message translates to:
  /// **'monthly'**
  String get guestPlansBillingMonthly;

  /// No description provided for @guestPlansBillingYearly.
  ///
  /// In en, this message translates to:
  /// **'yearly'**
  String get guestPlansBillingYearly;

  /// No description provided for @guestPlansBillingWeekly.
  ///
  /// In en, this message translates to:
  /// **'weekly'**
  String get guestPlansBillingWeekly;

  /// No description provided for @guestPlansSessionsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} sessions'**
  String guestPlansSessionsCount(int count);

  /// No description provided for @guestPlansVisitsPerWeek.
  ///
  /// In en, this message translates to:
  /// **'{count}x / week'**
  String guestPlansVisitsPerWeek(int count);

  /// No description provided for @guestPlansVisitsPerMonth.
  ///
  /// In en, this message translates to:
  /// **'{count}x / month'**
  String guestPlansVisitsPerMonth(int count);

  /// No description provided for @guestPlansMonthsCount.
  ///
  /// In en, this message translates to:
  /// **'{count} months'**
  String guestPlansMonthsCount(int count);

  /// No description provided for @guestPlansGetStarted.
  ///
  /// In en, this message translates to:
  /// **'Get Started'**
  String get guestPlansGetStarted;

  /// No description provided for @guestPlansTypeUnlimited.
  ///
  /// In en, this message translates to:
  /// **'Unlimited Access'**
  String get guestPlansTypeUnlimited;

  /// No description provided for @guestPlansTypeLimited.
  ///
  /// In en, this message translates to:
  /// **'Limited Access'**
  String get guestPlansTypeLimited;

  /// No description provided for @guestPlansTypeSessions.
  ///
  /// In en, this message translates to:
  /// **'Session Pack'**
  String get guestPlansTypeSessions;

  /// No description provided for @guestPlansTypeDayPass.
  ///
  /// In en, this message translates to:
  /// **'Day Pass'**
  String get guestPlansTypeDayPass;

  /// No description provided for @guestScheduleNoClasses.
  ///
  /// In en, this message translates to:
  /// **'No classes on this day'**
  String get guestScheduleNoClasses;

  /// No description provided for @guestScheduleTryDifferentDate.
  ///
  /// In en, this message translates to:
  /// **'Try selecting a different date'**
  String get guestScheduleTryDifferentDate;

  /// No description provided for @guestScheduleLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load schedule'**
  String get guestScheduleLoadFailed;

  /// No description provided for @guestShellWelcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome'**
  String get guestShellWelcome;

  /// No description provided for @guestShellBrowsingAsGuest.
  ///
  /// In en, this message translates to:
  /// **'Browsing as guest — limited access'**
  String get guestShellBrowsingAsGuest;

  /// No description provided for @guestShellJoinNow.
  ///
  /// In en, this message translates to:
  /// **'Join Now'**
  String get guestShellJoinNow;

  /// No description provided for @guestShellNavHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get guestShellNavHome;

  /// No description provided for @guestShellNavClasses.
  ///
  /// In en, this message translates to:
  /// **'Classes'**
  String get guestShellNavClasses;

  /// No description provided for @guestShellNavExplore.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get guestShellNavExplore;

  /// No description provided for @guestShellNavProfile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get guestShellNavProfile;

  /// No description provided for @guestTrainersEmpty.
  ///
  /// In en, this message translates to:
  /// **'No trainers available'**
  String get guestTrainersEmpty;

  /// No description provided for @bannerOffer.
  ///
  /// In en, this message translates to:
  /// **'OFFER'**
  String get bannerOffer;

  /// No description provided for @bannerGetPromoCode.
  ///
  /// In en, this message translates to:
  /// **'Get promo code'**
  String get bannerGetPromoCode;

  /// No description provided for @bannerVisitHost.
  ///
  /// In en, this message translates to:
  /// **'Visit {host}'**
  String bannerVisitHost(String host);

  /// No description provided for @bannerYourPromoCode.
  ///
  /// In en, this message translates to:
  /// **'YOUR PROMO CODE'**
  String get bannerYourPromoCode;

  /// No description provided for @bannerCopy.
  ///
  /// In en, this message translates to:
  /// **'Copy'**
  String get bannerCopy;

  /// No description provided for @bannerCopied.
  ///
  /// In en, this message translates to:
  /// **'Copied'**
  String get bannerCopied;

  /// No description provided for @billingInvoicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Invoices'**
  String get billingInvoicesTitle;

  /// No description provided for @billingNoInvoicesYet.
  ///
  /// In en, this message translates to:
  /// **'No invoices yet'**
  String get billingNoInvoicesYet;

  /// No description provided for @billingEmptySubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your payment history will appear here.'**
  String get billingEmptySubtitle;

  /// No description provided for @billingLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load invoices'**
  String get billingLoadFailed;

  /// No description provided for @billingStatusPaid.
  ///
  /// In en, this message translates to:
  /// **'Paid'**
  String get billingStatusPaid;

  /// No description provided for @billingStatusPending.
  ///
  /// In en, this message translates to:
  /// **'Pending'**
  String get billingStatusPending;

  /// No description provided for @billingStatusOverdue.
  ///
  /// In en, this message translates to:
  /// **'Overdue'**
  String get billingStatusOverdue;

  /// No description provided for @invoiceDetailsTitle.
  ///
  /// In en, this message translates to:
  /// **'Invoice Details'**
  String get invoiceDetailsTitle;

  /// No description provided for @invoiceBillingPeriod.
  ///
  /// In en, this message translates to:
  /// **'Billing Period'**
  String get invoiceBillingPeriod;

  /// No description provided for @invoicePeriod.
  ///
  /// In en, this message translates to:
  /// **'Period'**
  String get invoicePeriod;

  /// No description provided for @invoiceItems.
  ///
  /// In en, this message translates to:
  /// **'Items'**
  String get invoiceItems;

  /// No description provided for @invoicePaymentInfo.
  ///
  /// In en, this message translates to:
  /// **'Payment Info'**
  String get invoicePaymentInfo;

  /// No description provided for @invoiceStatus.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get invoiceStatus;

  /// No description provided for @invoiceDueDate.
  ///
  /// In en, this message translates to:
  /// **'Due Date'**
  String get invoiceDueDate;

  /// No description provided for @invoicePaidOn.
  ///
  /// In en, this message translates to:
  /// **'Paid On'**
  String get invoicePaidOn;

  /// No description provided for @invoicePaymentMethod.
  ///
  /// In en, this message translates to:
  /// **'Payment Method'**
  String get invoicePaymentMethod;

  /// No description provided for @invoiceNotes.
  ///
  /// In en, this message translates to:
  /// **'Notes'**
  String get invoiceNotes;

  /// No description provided for @invoiceCreatedOn.
  ///
  /// In en, this message translates to:
  /// **'Created {date}'**
  String invoiceCreatedOn(String date);

  /// No description provided for @invoiceTotalAmount.
  ///
  /// In en, this message translates to:
  /// **'Total Amount'**
  String get invoiceTotalAmount;

  /// No description provided for @invoiceTotalPaid.
  ///
  /// In en, this message translates to:
  /// **'Total Paid'**
  String get invoiceTotalPaid;

  /// No description provided for @invoicePayAmount.
  ///
  /// In en, this message translates to:
  /// **'Pay {amount}'**
  String invoicePayAmount(String amount);

  /// No description provided for @invoiceLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to load invoice'**
  String get invoiceLoadFailed;

  /// No description provided for @invoicePayInvoice.
  ///
  /// In en, this message translates to:
  /// **'Pay Invoice'**
  String get invoicePayInvoice;

  /// No description provided for @invoiceAmountDue.
  ///
  /// In en, this message translates to:
  /// **'Amount Due'**
  String get invoiceAmountDue;

  /// No description provided for @invoicePaymentSubmitted.
  ///
  /// In en, this message translates to:
  /// **'Payment of {amount} submitted'**
  String invoicePaymentSubmitted(String amount);

  /// No description provided for @invoiceProcessing.
  ///
  /// In en, this message translates to:
  /// **'Processing…'**
  String get invoiceProcessing;

  /// No description provided for @invoiceConfirmPayment.
  ///
  /// In en, this message translates to:
  /// **'Confirm Payment'**
  String get invoiceConfirmPayment;

  /// No description provided for @invoicePaidOnDate.
  ///
  /// In en, this message translates to:
  /// **'Paid {date}'**
  String invoicePaidOnDate(String date);

  /// No description provided for @invoiceDueOnDate.
  ///
  /// In en, this message translates to:
  /// **'Due {date}'**
  String invoiceDueOnDate(String date);

  /// No description provided for @invoiceOfferBadge.
  ///
  /// In en, this message translates to:
  /// **'Offer'**
  String get invoiceOfferBadge;

  /// No description provided for @onboardingContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get onboardingContinue;

  /// No description provided for @onboardingGetStarted.
  ///
  /// In en, this message translates to:
  /// **'Get started'**
  String get onboardingGetStarted;

  /// No description provided for @onboardingScanToEnter.
  ///
  /// In en, this message translates to:
  /// **'SCAN TO ENTER'**
  String get onboardingScanToEnter;

  /// No description provided for @onboardingCheckedIn.
  ///
  /// In en, this message translates to:
  /// **'Checked in'**
  String get onboardingCheckedIn;

  /// No description provided for @onboardingSessionsTag.
  ///
  /// In en, this message translates to:
  /// **'SESSIONS'**
  String get onboardingSessionsTag;

  /// No description provided for @onboardingYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get onboardingYou;

  /// No description provided for @onboardingSampleFriendName.
  ///
  /// In en, this message translates to:
  /// **'Ahmed'**
  String get onboardingSampleFriendName;

  /// No description provided for @onboardingReceivedTag.
  ///
  /// In en, this message translates to:
  /// **'+3 received'**
  String get onboardingReceivedTag;

  /// No description provided for @onboardingMembershipTag.
  ///
  /// In en, this message translates to:
  /// **'MEMBERSHIP'**
  String get onboardingMembershipTag;

  /// No description provided for @onboardingSamplePlan.
  ///
  /// In en, this message translates to:
  /// **'Premium Monthly'**
  String get onboardingSamplePlan;

  /// No description provided for @onboardingMemberNumberTag.
  ///
  /// In en, this message translates to:
  /// **'MEMBER #'**
  String get onboardingMemberNumberTag;

  /// No description provided for @onboardingRenewsTag.
  ///
  /// In en, this message translates to:
  /// **'RENEWS'**
  String get onboardingRenewsTag;

  /// No description provided for @onboardingLeftTag.
  ///
  /// In en, this message translates to:
  /// **'LEFT'**
  String get onboardingLeftTag;

  /// No description provided for @welcomeTitlePrefix.
  ///
  /// In en, this message translates to:
  /// **'Welcome to '**
  String get welcomeTitlePrefix;

  /// No description provided for @welcomeSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your gym, your sessions, your friends — all in one place. Let\'s get you set up.'**
  String get welcomeSubtitle;

  /// No description provided for @welcomeCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create account'**
  String get welcomeCreateAccount;

  /// No description provided for @welcomeAlreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'I already have an account'**
  String get welcomeAlreadyHaveAccount;

  /// No description provided for @welcomeContinueAsGuest.
  ///
  /// In en, this message translates to:
  /// **'Continue as guest'**
  String get welcomeContinueAsGuest;

  /// No description provided for @welcomeLegalPrefix.
  ///
  /// In en, this message translates to:
  /// **'By continuing, you agree to our '**
  String get welcomeLegalPrefix;

  /// No description provided for @popupNotNow.
  ///
  /// In en, this message translates to:
  /// **'Not now'**
  String get popupNotNow;

  /// No description provided for @splashPoweredBy.
  ///
  /// In en, this message translates to:
  /// **'Powered by CLBY'**
  String get splashPoweredBy;

  /// No description provided for @splashLoadingYourGym.
  ///
  /// In en, this message translates to:
  /// **'Loading your gym…'**
  String get splashLoadingYourGym;

  /// No description provided for @freezeFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to freeze: {error}'**
  String freezeFailed(String error);

  /// No description provided for @freezeTitle.
  ///
  /// In en, this message translates to:
  /// **'Freeze Plan'**
  String get freezeTitle;

  /// No description provided for @freezeWillPause.
  ///
  /// In en, this message translates to:
  /// **'{planName} will be paused and the end date extended.'**
  String freezeWillPause(String planName);

  /// No description provided for @freezeYourPlan.
  ///
  /// In en, this message translates to:
  /// **'Your plan'**
  String get freezeYourPlan;

  /// No description provided for @freezeDaysAvailable.
  ///
  /// In en, this message translates to:
  /// **'Days available'**
  String get freezeDaysAvailable;

  /// No description provided for @freezeFreezesUsed.
  ///
  /// In en, this message translates to:
  /// **'Freezes used'**
  String get freezeFreezesUsed;

  /// No description provided for @freezeXOfY.
  ///
  /// In en, this message translates to:
  /// **'{a} of {b}'**
  String freezeXOfY(String a, String b);

  /// No description provided for @freezeAllDaysUsed.
  ///
  /// In en, this message translates to:
  /// **'All {days} freeze days have been used for this plan. No further freezes are allowed.'**
  String freezeAllDaysUsed(int days);

  /// No description provided for @freezeMaxCountReached.
  ///
  /// In en, this message translates to:
  /// **'Maximum freeze count ({count}) has been reached for this plan. No further freezes are allowed.'**
  String freezeMaxCountReached(int count);

  /// No description provided for @freezeHowManyDays.
  ///
  /// In en, this message translates to:
  /// **'How many days?'**
  String get freezeHowManyDays;

  /// No description provided for @freezeMaxDaysHint.
  ///
  /// In en, this message translates to:
  /// **'Max {days} days'**
  String freezeMaxDaysHint(int days);

  /// No description provided for @freezeExtendTo.
  ///
  /// In en, this message translates to:
  /// **'Your plan will extend to '**
  String get freezeExtendTo;

  /// No description provided for @freezeFreezing.
  ///
  /// In en, this message translates to:
  /// **'Freezing…'**
  String get freezeFreezing;

  /// No description provided for @guestPromptMembersOnly.
  ///
  /// In en, this message translates to:
  /// **'Members Only'**
  String get guestPromptMembersOnly;

  /// No description provided for @guestPromptDescription.
  ///
  /// In en, this message translates to:
  /// **'Create a free account to book classes, track your membership, and more.'**
  String get guestPromptDescription;

  /// No description provided for @guestPromptCreateAccount.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get guestPromptCreateAccount;

  /// No description provided for @guestPromptSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get guestPromptSignIn;

  /// No description provided for @legalConsentPrefix.
  ///
  /// In en, this message translates to:
  /// **'By continuing, you agree to our '**
  String get legalConsentPrefix;

  /// No description provided for @legalTermsOfService.
  ///
  /// In en, this message translates to:
  /// **'Terms of Service'**
  String get legalTermsOfService;

  /// No description provided for @legalAnd.
  ///
  /// In en, this message translates to:
  /// **' and '**
  String get legalAnd;

  /// No description provided for @legalPrivacyPolicy.
  ///
  /// In en, this message translates to:
  /// **'Privacy Policy'**
  String get legalPrivacyPolicy;

  /// No description provided for @memberCardMembership.
  ///
  /// In en, this message translates to:
  /// **'MEMBERSHIP'**
  String get memberCardMembership;

  /// No description provided for @memberCardStandardPlan.
  ///
  /// In en, this message translates to:
  /// **'Standard Plan'**
  String get memberCardStandardPlan;

  /// No description provided for @memberCardStart.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get memberCardStart;

  /// No description provided for @memberCardExpires.
  ///
  /// In en, this message translates to:
  /// **'Expires'**
  String get memberCardExpires;

  /// No description provided for @memberCardVisitsPerWeek.
  ///
  /// In en, this message translates to:
  /// **'{count} visits per week'**
  String memberCardVisitsPerWeek(int count);

  /// No description provided for @memberCardVisitsPerMonth.
  ///
  /// In en, this message translates to:
  /// **'{count} visits per month'**
  String memberCardVisitsPerMonth(int count);

  /// No description provided for @memberCardSessionsIncluded.
  ///
  /// In en, this message translates to:
  /// **'{count} sessions included'**
  String memberCardSessionsIncluded(int count);

  /// No description provided for @memberCardBilling.
  ///
  /// In en, this message translates to:
  /// **'{cycle} billing'**
  String memberCardBilling(String cycle);

  /// No description provided for @memberCardPlanBenefits.
  ///
  /// In en, this message translates to:
  /// **'Plan Benefits'**
  String get memberCardPlanBenefits;

  /// No description provided for @memberCardSuspended.
  ///
  /// In en, this message translates to:
  /// **'Suspended'**
  String get memberCardSuspended;

  /// No description provided for @memberCardFrozen.
  ///
  /// In en, this message translates to:
  /// **'Frozen'**
  String get memberCardFrozen;

  /// No description provided for @memberCardInactive.
  ///
  /// In en, this message translates to:
  /// **'Inactive'**
  String get memberCardInactive;

  /// No description provided for @memberCardNoActiveMembership.
  ///
  /// In en, this message translates to:
  /// **'No Active Membership'**
  String get memberCardNoActiveMembership;

  /// No description provided for @memberCardContactGym.
  ///
  /// In en, this message translates to:
  /// **'Contact the gym to get started'**
  String get memberCardContactGym;

  /// No description provided for @memberCardTransferredSessions.
  ///
  /// In en, this message translates to:
  /// **'Transferred sessions'**
  String get memberCardTransferredSessions;

  /// No description provided for @memberCardUnlimitedSessions.
  ///
  /// In en, this message translates to:
  /// **'unlimited sessions'**
  String get memberCardUnlimitedSessions;

  /// No description provided for @memberCardSessionsRemaining.
  ///
  /// In en, this message translates to:
  /// **'sessions remaining'**
  String get memberCardSessionsRemaining;

  /// No description provided for @memberCardOfTotal.
  ///
  /// In en, this message translates to:
  /// **'of {total} total'**
  String memberCardOfTotal(int total);

  /// No description provided for @memberCardDaysLeft.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{day left} other{days left}}'**
  String memberCardDaysLeft(int count);

  /// No description provided for @memberCardUntilDate.
  ///
  /// In en, this message translates to:
  /// **'until {date}'**
  String memberCardUntilDate(String date);

  /// No description provided for @memberCardNoActiveAccess.
  ///
  /// In en, this message translates to:
  /// **'no active access'**
  String get memberCardNoActiveAccess;

  /// No description provided for @memberCardMembershipExpiry.
  ///
  /// In en, this message translates to:
  /// **'Membership expiry'**
  String get memberCardMembershipExpiry;

  /// No description provided for @memberCardEndDate.
  ///
  /// In en, this message translates to:
  /// **'End date'**
  String get memberCardEndDate;

  /// No description provided for @memberCardNearestExpiry.
  ///
  /// In en, this message translates to:
  /// **'Nearest expiry'**
  String get memberCardNearestExpiry;

  /// No description provided for @memberCardFrozenUntil.
  ///
  /// In en, this message translates to:
  /// **'Frozen until'**
  String get memberCardFrozenUntil;

  /// No description provided for @memberCardFreeze.
  ///
  /// In en, this message translates to:
  /// **'Freeze'**
  String get memberCardFreeze;

  /// No description provided for @memberCardUnfreeze.
  ///
  /// In en, this message translates to:
  /// **'Unfreeze'**
  String get memberCardUnfreeze;

  /// No description provided for @memberCardSessionsPlan.
  ///
  /// In en, this message translates to:
  /// **'Sessions plan'**
  String get memberCardSessionsPlan;

  /// No description provided for @memberCardDurationPlan.
  ///
  /// In en, this message translates to:
  /// **'Duration plan'**
  String get memberCardDurationPlan;

  /// No description provided for @memberCardFullAccess.
  ///
  /// In en, this message translates to:
  /// **'Full access'**
  String get memberCardFullAccess;

  /// No description provided for @memberCardMonthlyPlan.
  ///
  /// In en, this message translates to:
  /// **'Monthly plan'**
  String get memberCardMonthlyPlan;

  /// No description provided for @memberCardAnnualPlan.
  ///
  /// In en, this message translates to:
  /// **'Annual plan'**
  String get memberCardAnnualPlan;

  /// No description provided for @memberCardIncludesTransfers.
  ///
  /// In en, this message translates to:
  /// **'{count, plural, =1{Includes 1 session from transfers} other{Includes {count} sessions from transfers}}'**
  String memberCardIncludesTransfers(int count);

  /// No description provided for @memberCardExpiresOn.
  ///
  /// In en, this message translates to:
  /// **'expires {date}'**
  String memberCardExpiresOn(String date);

  /// No description provided for @memberCardNearestExpiryOn.
  ///
  /// In en, this message translates to:
  /// **'nearest expiry {date}'**
  String memberCardNearestExpiryOn(String date);

  /// No description provided for @ratingTerrible.
  ///
  /// In en, this message translates to:
  /// **'Terrible'**
  String get ratingTerrible;

  /// No description provided for @ratingBad.
  ///
  /// In en, this message translates to:
  /// **'Bad'**
  String get ratingBad;

  /// No description provided for @ratingOkay.
  ///
  /// In en, this message translates to:
  /// **'Okay'**
  String get ratingOkay;

  /// No description provided for @ratingGood.
  ///
  /// In en, this message translates to:
  /// **'Good'**
  String get ratingGood;

  /// No description provided for @ratingExcellent.
  ///
  /// In en, this message translates to:
  /// **'Excellent'**
  String get ratingExcellent;

  /// No description provided for @ratingSubmitFailed.
  ///
  /// In en, this message translates to:
  /// **'Failed to submit: {error}'**
  String ratingSubmitFailed(String error);

  /// No description provided for @ratingTitle.
  ///
  /// In en, this message translates to:
  /// **'Rate your experience'**
  String get ratingTitle;

  /// No description provided for @ratingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Your feedback helps us improve'**
  String get ratingSubtitle;

  /// No description provided for @ratingHowWasSession.
  ///
  /// In en, this message translates to:
  /// **'How was the session overall?'**
  String get ratingHowWasSession;

  /// No description provided for @ratingOverallHint.
  ///
  /// In en, this message translates to:
  /// **'Rate your overall class experience'**
  String get ratingOverallHint;

  /// No description provided for @ratingHowWasTrainer.
  ///
  /// In en, this message translates to:
  /// **'How was {name}?'**
  String ratingHowWasTrainer(String name);

  /// No description provided for @ratingOptional.
  ///
  /// In en, this message translates to:
  /// **'optional'**
  String get ratingOptional;

  /// No description provided for @ratingTrainerHint.
  ///
  /// In en, this message translates to:
  /// **'Rate your trainer\'s performance'**
  String get ratingTrainerHint;

  /// No description provided for @ratingLeaveReview.
  ///
  /// In en, this message translates to:
  /// **'Leave a review'**
  String get ratingLeaveReview;

  /// No description provided for @ratingShareHint.
  ///
  /// In en, this message translates to:
  /// **'Share your experience with the community'**
  String get ratingShareHint;

  /// No description provided for @ratingReviewHint.
  ///
  /// In en, this message translates to:
  /// **'What did you think about this class? Your review may be shown to other members…'**
  String get ratingReviewHint;

  /// No description provided for @ratingSubmit.
  ///
  /// In en, this message translates to:
  /// **'Submit rating'**
  String get ratingSubmit;

  /// No description provided for @ratingSkipForNow.
  ///
  /// In en, this message translates to:
  /// **'Skip for now'**
  String get ratingSkipForNow;

  /// No description provided for @ratingYou.
  ///
  /// In en, this message translates to:
  /// **'You'**
  String get ratingYou;

  /// No description provided for @ratingThanks.
  ///
  /// In en, this message translates to:
  /// **'Thanks for your review!'**
  String get ratingThanks;

  /// No description provided for @ratingSubmittedDesc.
  ///
  /// In en, this message translates to:
  /// **'Your feedback has been submitted and may\nhelp other members choose their classes.'**
  String get ratingSubmittedDesc;

  /// No description provided for @ratingSessionSummary.
  ///
  /// In en, this message translates to:
  /// **'Session: {label}'**
  String ratingSessionSummary(String label);

  /// No description provided for @ratingTrainerSummary.
  ///
  /// In en, this message translates to:
  /// **'Trainer: '**
  String get ratingTrainerSummary;

  /// No description provided for @ratingJustNow.
  ///
  /// In en, this message translates to:
  /// **'Just now'**
  String get ratingJustNow;

  /// No description provided for @ratingViewBookings.
  ///
  /// In en, this message translates to:
  /// **'View my bookings'**
  String get ratingViewBookings;

  /// No description provided for @servicesTitle.
  ///
  /// In en, this message translates to:
  /// **'Services'**
  String get servicesTitle;

  /// No description provided for @sessionCardClass.
  ///
  /// In en, this message translates to:
  /// **'Class'**
  String get sessionCardClass;

  /// No description provided for @sessionCardAttended.
  ///
  /// In en, this message translates to:
  /// **'Attended'**
  String get sessionCardAttended;

  /// No description provided for @sessionCardCapacity.
  ///
  /// In en, this message translates to:
  /// **'Capacity'**
  String get sessionCardCapacity;

  /// No description provided for @sessionCardFull.
  ///
  /// In en, this message translates to:
  /// **'Full'**
  String get sessionCardFull;

  /// No description provided for @sessionCardSpotsLeft.
  ///
  /// In en, this message translates to:
  /// **'{count} spots left'**
  String sessionCardSpotsLeft(int count);

  /// No description provided for @sessionCardSessionCancelled.
  ///
  /// In en, this message translates to:
  /// **'Session Cancelled'**
  String get sessionCardSessionCancelled;

  /// No description provided for @sessionCardClassOngoing.
  ///
  /// In en, this message translates to:
  /// **'Class is ongoing'**
  String get sessionCardClassOngoing;

  /// No description provided for @sessionCardBooked.
  ///
  /// In en, this message translates to:
  /// **'Booked'**
  String get sessionCardBooked;

  /// No description provided for @sessionCardClassEnded.
  ///
  /// In en, this message translates to:
  /// **'Class ended'**
  String get sessionCardClassEnded;

  /// No description provided for @sessionCardClassFull.
  ///
  /// In en, this message translates to:
  /// **'Class is full'**
  String get sessionCardClassFull;

  /// No description provided for @sessionCardWalkInScanQr.
  ///
  /// In en, this message translates to:
  /// **'Walk-in · scan QR'**
  String get sessionCardWalkInScanQr;

  /// No description provided for @sessionCardCancelled.
  ///
  /// In en, this message translates to:
  /// **'Cancelled'**
  String get sessionCardCancelled;

  /// No description provided for @sessionCardFinished.
  ///
  /// In en, this message translates to:
  /// **'Finished'**
  String get sessionCardFinished;

  /// No description provided for @sessionCardOngoing.
  ///
  /// In en, this message translates to:
  /// **'Ongoing'**
  String get sessionCardOngoing;

  /// No description provided for @sessionCardOpen.
  ///
  /// In en, this message translates to:
  /// **'Open'**
  String get sessionCardOpen;

  /// No description provided for @sessionCardRated.
  ///
  /// In en, this message translates to:
  /// **'Rated'**
  String get sessionCardRated;

  /// No description provided for @sessionCardRate.
  ///
  /// In en, this message translates to:
  /// **'Rate'**
  String get sessionCardRate;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['ar', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'ar':
      return AppLocalizationsAr();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
