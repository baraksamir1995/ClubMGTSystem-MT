import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:clby/providers/locale_provider.dart';
import '../models/membership_summary_model.dart';
import '../providers/auth_provider.dart';
import '../providers/member_provider.dart';
import '../utils/env.dart';
import '../widgets/gym_app_bar.dart';
import '../widgets/legal_links.dart';
import '../widgets/screen_refresh_indicator.dart';

/// Profile screen — design ported from `profile.jsx` in the design bundle.
/// Layout: brand header → identity card → active services horizontal scroll
/// → share-sessions dark banner → Account list → Legal list → version
/// footer. Bottom sheets handle Edit profile / Change password / Sign out /
/// Delete account.
///
/// Color treatment:
///   - off-white bg, deep ink text, white card surfaces
///   - gym primary on the share-sessions CTA tile, "See all", service
///     progress bars, and identity-card radial glow
///   - gym secondary tint on service icon backgrounds and the avatar ring
///   - semantic warn / error / success kept

const _kBg = Color(0xFFF7F6F2);
const _kInk = Color(0xFF1F1A14);
const _kInk2 = Color(0x9E1F1A14); // 0.62
const _kInk3 = Color(0x6B1F1A14); // 0.42
const _kHair = Color(0x141F1A14); // 0.08
const _kCard = Color(0xFFFFFFFF);
const _kSuccess = Color(0xFF3F8B5C);
const _kSuccessBg = Color(0xFFE4F0E6);
const _kWarn = Color(0xFFB6531B);
const _kWarnBg = Color(0xFFFBEAD6);
const _kError = Color(0xFFC24E3D);
const _kErrorBg = Color(0xFFFBE3DE);

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isUploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadData());
  }

  Future<void> _loadData() async {
    final auth = context.read<AuthProvider>();
    // Pick up profile edits made elsewhere (e.g. an admin uploading the
    // member's photo from the dashboard) on open and on pull-to-refresh.
    await auth.refreshProfileQuietly();
    if (!mounted) return;
    final gymId = auth.profile?.gymId;
    if (gymId == null) return;
    final mp = context.read<MemberProvider>();
    await mp.ensureMemberLoaded(gymId);
    await mp.refreshMembership();
    // Pull PT / Nutrition / Physio assignments so they show up in the
    // Active services row.
    await mp.loadServiceAssignments();
  }

  String _maskPhone(String? p) {
    if (p == null || p.isEmpty) return '—';
    final digits = p.replaceAll(RegExp(r'[^0-9]'), '');
    if (digits.length <= 4) return p;
    final last = digits.substring(digits.length - 4);
    final ccMatch = RegExp(r'^(\+\d{1,4})').firstMatch(p.trim());
    final cc = ccMatch?.group(1) ?? '+20';
    return '$cc ··· ··· $last';
  }

  String _memberSince(DateTime? d) {
    if (d == null) return '';
    return DateFormat('MMM yyyy').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final mp = context.watch<MemberProvider>();
    final profile = auth.profile;
    final gym = auth.gym;
    final primary = Theme.of(context).colorScheme.primary;
    final secondary = Theme.of(context).colorScheme.secondary;

    return Scaffold(
      backgroundColor: _kBg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildHeader(primary: primary),
            Expanded(
              child: ScreenRefreshIndicator(
                onRefresh: _loadData,
                icon: Icons.person_outline_rounded,
                color: primary,
                child: ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: 32),
                  children: [
                  // Identity card
                  Padding(
                    padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
                    child: _buildIdentityCard(
                      profile: profile,
                      gymName: gym?.name,
                      memberSince: _memberSince(mp.member?.joinedAt),
                      secondary: secondary,
                    ),
                  ),

                  // Active services — membership aggregate first, then one
                  // card per active service assignment (PT / Nutrition /
                  // Physio). Horizontal scroll matches the design.
                  Builder(
                    builder: (_) {
                      final hasMembership = mp.membershipSummary != null
                          && mp.membershipSummary!.buckets.isNotEmpty;
                      final activeAssignments = mp.serviceAssignments
                          .where((a) => a.isActive)
                          .toList();
                      final totalCount = (hasMembership ? 1 : 0) + activeAssignments.length;
                      if (totalCount == 0) return const SizedBox.shrink();
                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _sectionTitle(context.l10n.profileActiveServices,
                              action: totalCount > 1
                                  ? GestureDetector(
                                      onTap: () => context.push('/membership'),
                                      child: Text(
                                        context.l10n.commonSeeAll,
                                        style: TextStyle(
                                          fontSize: 12, fontWeight: FontWeight.w600,
                                          color: primary,
                                        ),
                                      ),
                                    )
                                  : null),
                          if (totalCount == 1)
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 22),
                              child: hasMembership
                                  ? _ActiveServicesAggregateCard(
                                      summary: mp.membershipSummary!,
                                      membershipName: mp.currentMembership?.planName,
                                      primary: primary,
                                      secondary: secondary,
                                    )
                                  : _ServiceAssignmentCard(
                                      assignment: activeAssignments.first,
                                      primary: primary,
                                      secondary: secondary,
                                    ),
                            )
                          else
                            SizedBox(
                              height: _profileServiceCardHeight(activeAssignments),
                              child: ListView(
                                scrollDirection: Axis.horizontal,
                                padding: const EdgeInsets.symmetric(horizontal: 22),
                                children: [
                                  if (hasMembership) ...[
                                    SizedBox(
                                      width: 280,
                                      child: _ActiveServicesAggregateCard(
                                        summary: mp.membershipSummary!,
                                        membershipName: mp.currentMembership?.planName,
                                        primary: primary,
                                        secondary: secondary,
                                      ),
                                    ),
                                    if (activeAssignments.isNotEmpty)
                                      const SizedBox(width: 12),
                                  ],
                                  for (int i = 0; i < activeAssignments.length; i++) ...[
                                    SizedBox(
                                      width: 280,
                                      child: _ServiceAssignmentCard(
                                        assignment: activeAssignments[i],
                                        primary: primary,
                                        secondary: secondary,
                                      ),
                                    ),
                                    if (i < activeAssignments.length - 1)
                                      const SizedBox(width: 12),
                                  ],
                                ],
                              ),
                            ),
                        ],
                      );
                    },
                  ),

                  // Share sessions banner — dark with primary CTA tile.
                  // Gated on the gym's session_transfer_enabled flag (admin
                  // Settings toggle). `gym` may be null on a cold start
                  // before it loads — default to showing (?? true) so we
                  // don't flicker the banner away from gyms that have it on.
                  if (mp.membershipSummary != null
                      && mp.membershipSummary!.totalSessions > 0
                      && (gym?.sessionTransferEnabled ?? true))
                    Padding(
                      padding: const EdgeInsets.fromLTRB(22, 20, 22, 0),
                      child: _buildShareBanner(primary: primary),
                    ),

                  // Account
                  _sectionTitle(context.l10n.profileAccount),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    child: _whiteCard(
                      child: Column(
                        children: [
                          _row(
                            iconBox: const Icon(Icons.language, size: 16, color: _kInk),
                            label: context.l10n.commonLanguage.toUpperCase(),
                            value: _localeLabel(context.watch<LocaleProvider>().locale),
                            onTap: _openLanguageSheet,
                          ),
                          _row(
                            iconBox: const Icon(Icons.lock_outline_rounded, size: 16, color: _kInk),
                            label: context.l10n.profileSecurityLabel,
                            value: context.l10n.profileChangePassword,
                            onTap: _openChangePasswordSheet,
                          ),
                          _row(
                            iconBox: const Icon(Icons.logout_rounded, size: 16, color: _kInk),
                            label: context.l10n.profileSessionLabel,
                            value: context.l10n.profileSignOut,
                            onTap: _openSignOutSheet,
                          ),
                          _row(
                            iconBox: const Icon(Icons.delete_outline_rounded, size: 16, color: _kError),
                            label: context.l10n.profileAccountLabel,
                            value: context.l10n.profileDeleteAccount,
                            onTap: _openDeleteSheet,
                            danger: true,
                            last: true,
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Legal
                  _sectionTitle(context.l10n.profileLegal),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 22),
                    child: _whiteCard(
                      child: Column(
                        children: [
                          // Gym-specific contract terms (in-app screen).
                          // Distinct from the app-wide Terms of Service
                          // link below it, which opens an external URL.
                          _row(
                            iconBox: const Icon(Icons.article_outlined, size: 16, color: _kInk),
                            label: context.l10n.profileDocumentLabel,
                            value: context.l10n.contractTermsProfileValue,
                            onTap: () => context.push('/contract-terms'),
                          ),
                          _row(
                            iconBox: const Icon(Icons.description_outlined, size: 16, color: _kInk),
                            label: context.l10n.profileDocumentLabel,
                            value: context.l10n.profileTerms,
                            trailingExt: true,
                            onTap: () => openTermsOfService(),
                          ),
                          _row(
                            iconBox: const Icon(Icons.shield_outlined, size: 16, color: _kInk),
                            label: context.l10n.profileDocumentLabel,
                            value: context.l10n.profilePrivacy,
                            trailingExt: true,
                            onTap: () => openPrivacyPolicy(),
                            last: true,
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Footer
                  Padding(
                    padding: const EdgeInsets.only(top: 18),
                    child: Center(
                      child: Text(
                        '${gym?.name ?? Env.brandName} · v1.0',
                        style: const TextStyle(fontSize: 11, color: _kInk3, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
                ],
              ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Header ────────────────────────────────────────────────────────────
  // Matches the rest of the app's screen titles (e.g. GymAppBar's
  // greeting): logo left, title left-aligned next to it at fontSize 20 /
  // weight 800, edit button on the far right.
  Widget _buildHeader({required Color primary}) {
    final gym = context.watch<AuthProvider>().gym;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: SizedBox(
        height: 56,
        child: Row(
          children: [
            GymLogoMark(gym: gym, fallbackTitle: Env.brandName, size: 32, radius: 8),
            const SizedBox(width: 10),
            // "Profile" title — same scale + weight as GymAppBar greetings
            Text(
              context.l10n.profileTitle,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: _kInk,
              ),
            ),
            const Spacer(),
            // Edit profile button pinned to the trailing edge
            Material(
              color: const Color(0x0D1F1A14),
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: _openEditSheet,
                child: const SizedBox(
                  width: 40, height: 40,
                  child: Icon(Icons.edit_outlined, size: 18, color: _kInk),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Identity card ────────────────────────────────────────────────────
  Widget _buildIdentityCard({
    required dynamic profile,
    required String? gymName,
    required String memberSince,
    required Color secondary,
  }) {
    return Stack(
      children: [
        _whiteCard(
          radius: 24,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  GestureDetector(
                    onTap: _isUploadingPhoto ? null : _showPhotoOptions,
                    child: _Avatar(
                      photoUrl: profile?.avatarUrl as String?,
                      name: (profile?.fullName as String?) ?? context.l10n.profileMemberFallback,
                      size: 64,
                      ringColor: Colors.white,
                      tint: secondary.withValues(alpha: 0.45),
                      isLoading: _isUploadingPhoto,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (profile?.fullName as String?) ?? context.l10n.profileMemberFallback,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 20, fontWeight: FontWeight.w600,
                            color: _kInk, letterSpacing: -0.4,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          [
                            if (memberSince.isNotEmpty) context.l10n.profileMemberSince(memberSince),
                            if (gymName != null && gymName.isNotEmpty) gymName,
                          ].join(' · '),
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12, color: _kInk2, fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _row(
                iconBox: const Icon(Icons.mail_outline_rounded, size: 16, color: _kInk),
                label: context.l10n.profileEmailLabel,
                value: (profile?.email as String?) ?? '—',
              ),
              _row(
                iconBox: const Icon(Icons.phone_outlined, size: 16, color: _kInk),
                label: context.l10n.profileMobileLabel,
                value: _maskPhone(profile?.phone as String?),
              ),
              _row(
                iconBox: const Icon(Icons.cake_outlined, size: 16, color: _kInk),
                label: context.l10n.profileDobLabel,
                value: profile?.dateOfBirth != null
                    ? DateFormat('MMM d, yyyy').format(profile.dateOfBirth as DateTime)
                    : '—',
                last: true,
              ),
            ],
          ),
        ),
        // Decorative radial peach glow in the top-right corner
        PositionedDirectional(
          top: -30, end: -30,
          child: IgnorePointer(
            child: Container(
              width: 140, height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  center: const Alignment(-0.4, -0.4),
                  radius: 0.7,
                  colors: [
                    secondary.withValues(alpha: 0.55),
                    secondary.withValues(alpha: 0),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  // ── Share-sessions banner ────────────────────────────────────────────
  Widget _buildShareBanner({required Color primary}) {
    return Material(
      color: _kInk,
      borderRadius: BorderRadius.circular(22),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(22),
        onTap: () => context.push('/transfer-sessions'),
        child: Stack(
          children: [
            // Decorative primary radial glow
            PositionedDirectional(
              top: -40, end: -30,
              child: IgnorePointer(
                child: Container(
                  width: 160, height: 160,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      center: const Alignment(-0.4, -0.4),
                      radius: 0.7,
                      colors: [
                        primary.withValues(alpha: 0.6),
                        primary.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  // Primary icon tile
                  Container(
                    width: 48, height: 48,
                    decoration: BoxDecoration(
                      color: primary,
                      borderRadius: BorderRadius.circular(14),
                      boxShadow: [
                        BoxShadow(
                          color: primary.withValues(alpha: 0.42),
                          blurRadius: 14, offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: const Icon(Icons.send_rounded, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.l10n.profileShareSessions,
                          style: const TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w600,
                            color: Colors.white, letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          context.l10n.profileShareSessionsSubtitle,
                          style: const TextStyle(
                            fontSize: 12, color: Colors.white70,
                            fontWeight: FontWeight.w500, height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, color: Colors.white, size: 20),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── Reusable row ──────────────────────────────────────────────────────
  Widget _row({
    required Widget iconBox,
    required String label,
    required String value,
    bool danger = false,
    bool last = false,
    bool trailingExt = false,
    VoidCallback? onTap,
  }) {
    final canTap = onTap != null;
    final body = Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(
              color: danger ? _kErrorBg : const Color(0x0D1F1A14),
              borderRadius: BorderRadius.circular(10),
            ),
            alignment: Alignment.center,
            child: iconBox,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11, fontWeight: FontWeight.w600,
                    color: _kInk2, letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        value,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: danger ? _kError : _kInk,
                        ),
                      ),
                    ),
                    if (trailingExt) ...[
                      const SizedBox(width: 6),
                      const Icon(Icons.open_in_new_rounded, size: 14, color: _kInk3),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (canTap)
            const Icon(Icons.chevron_right_rounded, size: 20, color: _kInk3),
        ],
      ),
    );
    final wrapped = canTap
        ? InkWell(onTap: onTap, child: body)
        : body;
    return Container(
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: _kHair, width: 1)),
      ),
      child: wrapped,
    );
  }

  Widget _sectionTitle(String text, {Widget? action}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 22, 22, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            text.toUpperCase(),
            style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w600,
              color: _kInk2, letterSpacing: 0.6,
            ),
          ),
          if (action != null) action,
        ],
      ),
    );
  }

  Widget _whiteCard({
    required Widget child,
    double radius = 18,
    EdgeInsets padding = const EdgeInsets.symmetric(horizontal: 16),
  }) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: const [
          BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
        ],
      ),
      child: child,
    );
  }

  // ── Language ──────────────────────────────────────────────────────────
  String _localeLabel(Locale? locale) {
    switch (locale?.languageCode) {
      case 'en':
        return context.l10n.commonEnglish;
      case 'ar':
        return context.l10n.commonArabic;
      default:
        return context.l10n.commonSystemDefault;
    }
  }

  void _openLanguageSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final current = ctx.read<LocaleProvider>().locale;

        Widget option(String title, Locale? locale) {
          final selected = current?.languageCode == locale?.languageCode;
          return ListTile(
            leading: Icon(
              selected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: selected ? Theme.of(ctx).colorScheme.primary : _kInk3,
            ),
            title: Text(
              title,
              style: TextStyle(
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: _kInk,
              ),
            ),
            onTap: () {
              ctx.read<LocaleProvider>().setLocale(locale);
              Navigator.pop(ctx);
            },
          );
        }

        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0x33000000),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 12),
                option(context.l10n.commonSystemDefault, null),
                option(context.l10n.commonEnglish, const Locale('en')),
                option(context.l10n.commonArabic, const Locale('ar')),
              ],
            ),
          ),
        );
      },
    );
  }

  // ── Photo upload ──────────────────────────────────────────────────────
  void _showPhotoOptions() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(
                  color: const Color(0x33000000),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 12),
              ListTile(
                leading: const Icon(Icons.photo_camera_outlined),
                title: Text(context.l10n.profileTakePhoto),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadPhoto(ImageSource.camera);
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: Text(context.l10n.profileChooseFromLibrary),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadPhoto(ImageSource.gallery);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickAndUploadPhoto(ImageSource source) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source, imageQuality: 90);
    if (picked == null) return;

    if (!mounted) return;
    final cropTitle = context.l10n.profileCropPhoto;
    CroppedFile? cropped;
    try {
      cropped = await ImageCropper().cropImage(
        sourcePath: picked.path,
        aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
        uiSettings: [
          IOSUiSettings(title: cropTitle, aspectRatioLockEnabled: true),
          AndroidUiSettings(toolbarTitle: cropTitle, lockAspectRatio: true),
        ],
      );
    } catch (_) {
      if (mounted) _snack(context.l10n.profileCropFailed, error: true);
      return;
    }
    if (cropped == null || !mounted) return;

    setState(() => _isUploadingPhoto = true);
    final auth = context.read<AuthProvider>();
    final error = await auth.uploadAvatar(cropped.path);
    if (!mounted) return;
    setState(() => _isUploadingPhoto = false);
    _snack(error ?? context.l10n.profilePhotoUpdated, error: error != null);
  }

  void _snack(String msg, {bool error = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? _kError : _kSuccess,
      behavior: SnackBarBehavior.floating,
    ));
  }

  // ── Edit profile sheet ───────────────────────────────────────────────
  void _openEditSheet() {
    final profile = context.read<AuthProvider>().profile;
    final nameCtrl = TextEditingController(text: profile?.fullName ?? '');
    final phoneCtrl = TextEditingController(text: profile?.phone ?? '');
    DateTime? dob = profile?.dateOfBirth;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          final viewInsets = MediaQuery.of(ctx).viewInsets.bottom;
          return Padding(
            padding: EdgeInsets.fromLTRB(22, 12, 22, 26 + viewInsets),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0x331F1A14),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  context.l10n.profileEditProfile,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: _kInk, letterSpacing: -0.3),
                ),
                const SizedBox(height: 16),
                _editField(context.l10n.profileFullName, nameCtrl),
                const SizedBox(height: 10),
                _editField(context.l10n.profileMobileWithCode, phoneCtrl, keyboardType: TextInputType.phone),
                const SizedBox(height: 10),
                _editDateRow(
                  label: context.l10n.profileDateOfBirth,
                  value: dob,
                  onPick: () async {
                    final now = DateTime.now();
                    final picked = await showDatePicker(
                      context: ctx,
                      initialDate: dob ?? DateTime(now.year - 25),
                      firstDate: DateTime(now.year - 100),
                      lastDate: DateTime(now.year - 10),
                      helpText: context.l10n.profileSelectDob,
                    );
                    if (picked != null) setSheetState(() => dob = picked);
                  },
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: TextButton(
                          onPressed: () => Navigator.of(ctx).pop(),
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0x0F1F1A14),
                            foregroundColor: _kInk,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: Text(context.l10n.commonCancel, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: _kInk,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          onPressed: () async {
                            Navigator.of(ctx).pop();
                            final auth = context.read<AuthProvider>();
                            final err = await auth.updateProfile(
                              nameCtrl.text.trim(),
                              phoneCtrl.text.trim(),
                              dob,
                            );
                            if (!mounted) return;
                            _snack(err ?? context.l10n.profileUpdated, error: err != null);
                          },
                          child: Text(context.l10n.commonSave, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _editField(String label, TextEditingController ctrl, {TextInputType? keyboardType}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600,
            color: _kInk2, letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: keyboardType,
          cursorColor: _kInk,
          style: const TextStyle(fontSize: 15, color: _kInk, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _kHair),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _kHair),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _kInk, width: 1.6),
            ),
          ),
        ),
      ],
    );
  }

  Widget _editDateRow({required String label, required DateTime? value, required VoidCallback onPick}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600,
            color: _kInk2, letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onPick,
          borderRadius: BorderRadius.circular(14),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _kHair),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value != null ? DateFormat('MMM d, yyyy').format(value) : context.l10n.profileTapToChoose,
                    style: TextStyle(
                      fontSize: 15,
                      color: value != null ? _kInk : _kInk3,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
                const Icon(Icons.calendar_today_outlined, size: 16, color: _kInk2),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Change password sheet ────────────────────────────────────────────
  void _openChangePasswordSheet() {
    final pwCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    bool obscure1 = true, obscure2 = true;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final viewInsets = MediaQuery.of(ctx).viewInsets.bottom;
          return Padding(
            padding: EdgeInsets.fromLTRB(22, 12, 22, 26 + viewInsets),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0x331F1A14),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  context.l10n.profileChangePassword,
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: _kInk, letterSpacing: -0.3),
                ),
                const SizedBox(height: 16),
                _passwordField(context.l10n.profileNewPassword, pwCtrl, obscure1,
                    () => setSheet(() => obscure1 = !obscure1)),
                const SizedBox(height: 10),
                _passwordField(context.l10n.profileConfirmPassword, confirmCtrl, obscure2,
                    () => setSheet(() => obscure2 = !obscure2)),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  height: 50,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: _kInk,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    onPressed: () async {
                      final pw = pwCtrl.text;
                      if (pw.length < 8) {
                        _snack(context.l10n.profilePasswordMin, error: true);
                        return;
                      }
                      if (pw != confirmCtrl.text) {
                        _snack(context.l10n.profilePasswordsDontMatch, error: true);
                        return;
                      }
                      Navigator.of(ctx).pop();
                      final err = await context.read<AuthProvider>().changePassword(pw);
                      if (!mounted) return;
                      _snack(err ?? context.l10n.profilePasswordUpdated, error: err != null);
                    },
                    child: Text(context.l10n.profileUpdatePassword, style: const TextStyle(fontWeight: FontWeight.w600)),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _passwordField(String label, TextEditingController ctrl, bool obscure, VoidCallback toggle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 11, fontWeight: FontWeight.w600,
            color: _kInk2, letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          obscureText: obscure,
          cursorColor: _kInk,
          style: const TextStyle(fontSize: 15, color: _kInk, fontWeight: FontWeight.w500),
          decoration: InputDecoration(
            filled: true,
            fillColor: Colors.white,
            isDense: true,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            suffixIcon: IconButton(
              icon: Icon(obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  size: 18, color: _kInk2),
              onPressed: toggle,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _kHair),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _kHair),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: const BorderSide(color: _kInk, width: 1.6),
            ),
          ),
        ),
      ],
    );
  }

  // ── Sign out sheet ───────────────────────────────────────────────────
  void _openSignOutSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: _kBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 12, 22, 26),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 36, height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0x331F1A14),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                context.l10n.profileSignOutConfirmTitle,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, color: _kInk, letterSpacing: -0.3),
              ),
              const SizedBox(height: 8),
              Text(
                context.l10n.profileSignOutConfirmBody,
                style: const TextStyle(fontSize: 14, color: _kInk2, height: 1.5),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 50,
                      child: TextButton(
                        onPressed: () => Navigator.of(ctx).pop(),
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0x0F1F1A14),
                          foregroundColor: _kInk,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: Text(context.l10n.commonCancel, style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: SizedBox(
                      height: 50,
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: _kInk,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        onPressed: () async {
                          Navigator.of(ctx).pop();
                          await context.read<AuthProvider>().signOut();
                          if (!mounted) return;
                          context.go('/login');
                        },
                        child: Text(context.l10n.profileSignOut, style: const TextStyle(fontWeight: FontWeight.w600)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Delete account sheet ─────────────────────────────────────────────
  void _openDeleteSheet() {
    final ctrl = TextEditingController();
    showModalBottomSheet(
      context: context,
      backgroundColor: _kBg,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheet) {
          final viewInsets = MediaQuery.of(ctx).viewInsets.bottom;
          final ok = ctrl.text.trim().toUpperCase() == 'DELETE';
          return Padding(
            padding: EdgeInsets.fromLTRB(22, 12, 22, 26 + viewInsets),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0x331F1A14),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  width: 56, height: 56,
                  decoration: BoxDecoration(
                    color: _kErrorBg, shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.error_outline_rounded, color: _kError, size: 28),
                ),
                const SizedBox(height: 16),
                Text(
                  context.l10n.profileDeleteConfirmTitle,
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600, color: _kInk, letterSpacing: -0.4),
                ),
                const SizedBox(height: 8),
                Text.rich(
                  TextSpan(
                    style: const TextStyle(fontSize: 14, color: _kInk2, height: 1.5),
                    children: [
                      TextSpan(text: context.l10n.profileDeleteWarningPrefix),
                      TextSpan(
                        text: context.l10n.profileDeleteWarningEmphasis,
                        style: const TextStyle(color: _kInk, fontWeight: FontWeight.w600),
                      ),
                      const TextSpan(text: '.'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Text.rich(
                  TextSpan(
                    style: const TextStyle(fontSize: 12, color: _kInk2, fontWeight: FontWeight.w500),
                    children: [
                      TextSpan(text: context.l10n.profileTypeToConfirmPrefix),
                      const TextSpan(
                        text: 'DELETE',
                        style: TextStyle(
                          color: _kError, fontWeight: FontWeight.w700,
                          fontFamily: 'Menlo',
                        ),
                      ),
                      TextSpan(text: context.l10n.profileTypeToConfirmSuffix),
                    ],
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: ctrl,
                  onChanged: (_) => setSheet(() {}),
                  cursorColor: _kError,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z]')),
                  ],
                  style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600,
                    color: _kInk, letterSpacing: 1,
                  ),
                  decoration: InputDecoration(
                    hintText: 'DELETE',
                    hintStyle: const TextStyle(color: _kInk3, letterSpacing: 1),
                    filled: true,
                    fillColor: Colors.white,
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: _kHair),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: ok ? _kError : _kHair, width: ok ? 1.6 : 1),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: BorderSide(color: ok ? _kError : _kInk, width: 1.6),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 50,
                        child: TextButton(
                          onPressed: () => Navigator.of(ctx).pop(),
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0x0F1F1A14),
                            foregroundColor: _kInk,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: Text(context.l10n.commonCancel, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Opacity(
                        opacity: ok ? 1 : 0.4,
                        child: SizedBox(
                          height: 50,
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: _kError,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                            ),
                            onPressed: ok
                                ? () async {
                                    Navigator.of(ctx).pop();
                                    final err = await context.read<AuthProvider>().deleteAccount();
                                    if (!mounted) return;
                                    if (err == null) {
                                      context.go('/login');
                                    } else {
                                      _snack(err, error: true);
                                    }
                                  }
                                : null,
                            child: Text(context.l10n.profileDeleteAccount,
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ─────────────────── Avatar ───────────────────
class _Avatar extends StatelessWidget {
  final String? photoUrl;
  final String name;
  final double size;
  final Color tint;
  final Color ringColor;
  final bool isLoading;
  const _Avatar({
    required this.name,
    required this.size,
    required this.tint,
    required this.ringColor,
    this.photoUrl,
    this.isLoading = false,
  });

  @override
  Widget build(BuildContext context) {
    final initials = name
        .split(RegExp(r'\s+'))
        .where((p) => p.isNotEmpty)
        .take(2)
        .map((p) => p[0].toUpperCase())
        .join();
    final fallback = Container(
      width: size, height: size,
      decoration: BoxDecoration(
        color: tint, shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        initials.isEmpty ? '?' : initials,
        style: TextStyle(
          fontSize: size * 0.36, fontWeight: FontWeight.w600, color: _kInk,
        ),
      ),
    );
    final inner = (photoUrl != null && photoUrl!.isNotEmpty)
        ? ClipOval(
            child: CachedNetworkImage(
              imageUrl: photoUrl!,
              width: size, height: size, fit: BoxFit.cover,
              placeholder: (_, __) => fallback,
              errorWidget: (_, __, ___) => fallback,
            ),
          )
        : fallback;
    return Container(
      width: size + 8, height: size + 8,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: ringColor, shape: BoxShape.circle,
        boxShadow: const [
          BoxShadow(color: Color(0x1A1F1A14), blurRadius: 6, offset: Offset(0, 2)),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          inner,
          if (isLoading)
            const SizedBox(
              width: 22, height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
            ),
        ],
      ),
    );
  }
}

/// Approximate height for the horizontal active-services scroll. The
/// service-assignment card adds a "with [coach]" line so we reserve a few
/// extra pixels when any assignment is present.
double _profileServiceCardHeight(List assignments) =>
    assignments.any((a) => (a.trainerName as String?) != null) ? 158 : 142;

// ─────────────────── Service assignment card ───────────────────
class _ServiceAssignmentCard extends StatelessWidget {
  final dynamic assignment; // ServiceAssignment
  final Color primary;
  final Color secondary;
  const _ServiceAssignmentCard({
    required this.assignment,
    required this.primary,
    required this.secondary,
  });

  @override
  Widget build(BuildContext context) {
    final total = (assignment.sessionsTotal as int?) ?? 0;
    final used = (assignment.sessionsUsed as int?) ?? 0;
    final left = (total - used).clamp(0, total);
    final pct = total > 0 ? (used / total).clamp(0.0, 1.0) : 0.0;

    return Container(
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            (assignment.packageName as String?) ?? context.l10n.profilePackageFallback,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.w600,
              color: _kInk, letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            (assignment.serviceLabel as String?) ?? '',
            style: const TextStyle(fontSize: 12, color: _kInk2, fontWeight: FontWeight.w500),
          ),
          if ((assignment.trainerName as String?) != null && (assignment.trainerName as String).isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                context.l10n.profileWithTrainer(assignment.trainerName as String),
                maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: _kInk2, fontWeight: FontWeight.w500),
              ),
            ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                '$left',
                style: const TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w600,
                  color: _kInk, letterSpacing: -0.4,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 5),
              Text(
                context.l10n.profileOfTotalLeft(total),
                style: const TextStyle(fontSize: 13, color: _kInk2, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(3),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 6,
              backgroundColor: secondary.withValues(alpha: 0.4),
              valueColor: AlwaysStoppedAnimation(primary),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────── Active services aggregate card ───────────────────
/// Mirrors the unified membership card on the home screen — uses
/// `summary.totalSessions` and `summary.nextExpiryDate` so this surface
/// never disagrees with the headline number.
class _ActiveServicesAggregateCard extends StatelessWidget {
  final MembershipSummary summary;
  final String? membershipName;
  final Color primary;
  final Color secondary;
  const _ActiveServicesAggregateCard({
    required this.summary,
    required this.membershipName,
    required this.primary,
    required this.secondary,
  });

  @override
  Widget build(BuildContext context) {
    final hasUnlimited = summary.buckets.any((b) => b.isUnlimited);
    final total = summary.totalSessions;
    final usedTotal = summary.buckets.fold<int>(0, (acc, b) {
      if (b.isUnlimited) return acc;
      return acc + b.sessionsUsed;
    });
    final capacity = summary.buckets.fold<int>(0, (acc, b) {
      if (b.isUnlimited) return acc;
      return acc + (b.sessionsTotal ?? 0);
    });
    final pct = capacity > 0 ? (usedTotal / capacity).clamp(0.0, 1.0) : 0.0;

    final daysLeft = summary.nextExpiryDate != null
        ? summary.nextExpiryDate!.difference(DateTime.now()).inDays
        : null;
    final expiring = daysLeft != null && daysLeft >= 0 && daysLeft <= 14;

    // Title prefers the user's actual subscription plan name; falls back to
    // the first bucket's plan name, then a generic label.
    final title = (membershipName != null && membershipName!.trim().isNotEmpty)
        ? membershipName!
        : (summary.buckets.firstOrNull?.planName ?? context.l10n.profileMembershipFallback);

    return Container(
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(18),
        boxShadow: const [
          BoxShadow(color: Color(0x0A1F1A14), blurRadius: 2, offset: Offset(0, 1)),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.w600,
              color: _kInk, letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            summary.nextExpiryDate != null
                ? context.l10n.profileExpires(DateFormat('MMM d, yyyy').format(summary.nextExpiryDate!))
                : '',
            style: const TextStyle(fontSize: 12, color: _kInk2, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                hasUnlimited && total == 0 ? '∞' : '$total',
                style: const TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w600,
                  color: _kInk, letterSpacing: -0.4,
                  fontFeatures: [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(width: 5),
              Text(
                hasUnlimited && total == 0
                    ? context.l10n.profileUnlimitedSessions
                    : capacity > 0
                        ? context.l10n.profileOfTotalLeft(capacity)
                        : context.l10n.profileSessionsLeftSuffix(total),
                style: const TextStyle(fontSize: 13, color: _kInk2, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          if (capacity > 0) ...[
            const SizedBox(height: 8),
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: pct,
                minHeight: 6,
                backgroundColor: secondary.withValues(alpha: 0.4),
                valueColor: AlwaysStoppedAnimation(expiring ? _kWarn : primary),
              ),
            ),
          ],
          if (summary.transferredSessions > 0) ...[
            const SizedBox(height: 10),
            Text(
              context.l10n.profileIncludesTransfers(summary.transferredSessions),
              style: const TextStyle(
                fontSize: 11, color: _kInk2, fontWeight: FontWeight.w500,
                fontStyle: FontStyle.italic,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
