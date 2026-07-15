import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import 'package:clby/l10n/l10n.dart';
import '../models/checkout_item.dart';
import '../models/service_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/service_icon.dart';
import '../widgets/shimmer_loader.dart';
import 'service_packages_screen.dart'; // PackageDetailExtra

// ─────────────────────────────────────────────────────────────────────────────
// Screen 3 — Package detail with coach selection
// ─────────────────────────────────────────────────────────────────────────────

class PackageDetailScreen extends StatefulWidget {
  final ServiceModel service;
  final Map<String, dynamic> package;

  const PackageDetailScreen({
    super.key,
    required this.service,
    required this.package,
  });

  @override
  State<PackageDetailScreen> createState() => _PackageDetailScreenState();
}

class _PackageDetailScreenState extends State<PackageDetailScreen> {
  List<Map<String, dynamic>> _coaches = [];
  bool _loadingCoaches = true;
  Map<String, dynamic>? _selectedCoach;
  final _apiService = ApiService();

  // ── Lifecycle ────────────────────────────────────────────────────────────

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadCoaches());
  }

  Future<void> _loadCoaches() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) {
      if (mounted) setState(() => _loadingCoaches = false);
      return;
    }
    final coaches =
        await _apiService.getTrainersByType(gymId, widget.service.trainerType);
    if (mounted) {
      setState(() {
        _coaches = coaches;
        _loadingCoaches = false;
        if (coaches.length == 1) _selectedCoach = coaches[0];
      });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  List<String> get _skills {
    final l10n = context.l10n;
    switch (widget.service.iconType) {
      case 'physio':
        return [
          l10n.packageSkillInjuryAssessment,
          l10n.packageSkillRehabilitation,
          l10n.packageSkillPainManagement,
          l10n.packageSkillPostureCorrection,
          l10n.packageSkillExerciseTherapy,
        ];
      case 'nutrition':
        return [
          l10n.packageSkillMealPlanning,
          l10n.packageSkillBodyComposition,
          l10n.packageSkillDietAnalysis,
          l10n.packageSkillWeightManagement,
          l10n.packageSkillSupplementAdvice,
        ];
      default:
        return [
          l10n.packageSkillStrengthTraining,
          l10n.packageSkillCardio,
          l10n.packageSkillFormCoaching,
          l10n.packageSkillGoalSetting,
          l10n.packageSkillHiit,
          l10n.packageSkillFlexibility,
        ];
    }
  }

  String get _coachSectionLabel => widget.service.iconType == 'pt'
      ? context.l10n.packageChooseCoach
      : context.l10n.packageYourSpecialist;

  bool get _canBuy {
    if (_loadingCoaches) return false;
    if (_coaches.isEmpty) return true;
    return _selectedCoach != null;
  }

  String _coachRole(Map<String, dynamic> coach) {
    final spec = coach['specialties'];
    if (spec is List && spec.isNotEmpty) return spec.first.toString();
    if (spec is String && spec.isNotEmpty) return spec;
    switch (widget.service.trainerType) {
      case 'physiotherapist': return context.l10n.packageRolePhysiotherapist;
      case 'nutritionist': return context.l10n.packageRoleNutritionist;
      default: return context.l10n.packageRolePersonalTrainer;
    }
  }

  void _onBuy() {
    final pkg = widget.package;
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final sessionCount = (pkg['session_count'] as int?) ?? 0;
    final pkgName = (pkg['name'] as String?) ?? '';
    final coach = _selectedCoach ?? (_coaches.isNotEmpty ? _coaches[0] : null);
    final coachName = (coach?['name'] as String?) ?? '';

    final subtitle = sessionCount > 1
        ? context.l10n.packageSessionsSubtitle(sessionCount, widget.service.name)
        : widget.service.name;

    context.push('/payment-summary', extra: CheckoutItem(
      type: 'service_package',   // routes to purchaseServicePackage → member_service_assignments
      id: (pkg['id'] as String?) ?? '',
      title: pkgName,
      subtitle: subtitle,
      price: price,
      applyMemberDiscount: true,
      specialistName: coachName.isNotEmpty ? coachName : null,
    ));
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F6F2),
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        toolbarHeight: 0,
        automaticallyImplyLeading: false,
      ),
      body: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(child: _buildHero()),
                SliverToBoxAdapter(child: _buildPriceCard()),
                SliverToBoxAdapter(child: _buildStatsGrid()),
                SliverToBoxAdapter(child: _buildWhatsIncluded()),
                SliverToBoxAdapter(child: _buildCoachSection()),
                const SliverToBoxAdapter(child: SizedBox(height: 16)),
              ],
            ),
          ),
          _buildBottomBar(),
        ],
      ),
    );
  }

  // ── Hero ─────────────────────────────────────────────────────────────────

  Widget _buildHero() {
    final pkg = widget.package;
    final svc = widget.service;
    final pkgName = (pkg['name'] as String?) ?? '';
    final sub = (pkg['description'] as String?) ?? '';
    final heroUrl = _coaches.isNotEmpty ? (_coaches[0]['photo_url'] as String?) : null;
    final topPad = MediaQuery.of(context).padding.top;

    return SizedBox(
      height: 200,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Background image or solid colour
          if (heroUrl != null && heroUrl.isNotEmpty)
            CachedNetworkImage(
              imageUrl: heroUrl,
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
              errorWidget: (_, __, ___) => Container(color: svc.accent),
            )
          else
            Container(color: svc.accent),

          // Gradient overlay
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.0, 0.38, 1.0],
                colors: [
                  Color(0x61000000),
                  Color(0x0A000000),
                  Color(0xD1000000),
                ],
              ),
            ),
          ),

          // Back button — sits below the status bar
          PositionedDirectional(
            top: topPad + 8,
            start: 16,
            child: Material(
              color: Colors.transparent,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                onTap: () => context.pop(),
                customBorder: const CircleBorder(),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Color(0x59000000),
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.arrow_back_ios_new,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
              ),
            ),
          ),

          // Hero content
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Category badge
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                    decoration: BoxDecoration(
                      color: svc.accent.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      svc.short,
                      style: const TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w500,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  Text(
                    pkgName,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                      height: 1.2,
                    ),
                  ),
                  if (sub.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      sub,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0x99FFFFFF),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Price card ───────────────────────────────────────────────────────────

  Widget _buildPriceCard() {
    final pkg = widget.package;
    final svc = widget.service;
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final per = (pkg['per'] as String?) ?? context.l10n.packagesUnitSession;
    final sessionCount = (pkg['session_count'] as int?) ?? 0;
    final perSession = sessionCount > 1 ? (price / sessionCount).round() : null;
    final tag = (pkg['tag'] as String?) ?? '';

    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: svc.accent, width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.packagePrice,
                style: const TextStyle(fontSize: 11, color: Color(0xFF888780)),
              ),
              const SizedBox(height: 3),
              RichText(
                text: TextSpan(
                  style: const TextStyle(color: Color(0xFF1D1D1B)),
                  children: [
                    TextSpan(
                      text: '${price.toInt()}',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    TextSpan(
                      text: ' ${context.l10n.packageCurrencyEgp}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w400,
                        color: Color(0xFF888780),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 2),
              Text(
                perSession != null
                    ? context.l10n.packagePricePerWithEach(per, perSession)
                    : context.l10n.packagePricePer(per),
                style: const TextStyle(fontSize: 10, color: Color(0xFF888780)),
              ),
            ],
          ),
          if (tag.isNotEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
              decoration: BoxDecoration(
                color: svc.accentLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                tag,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: svc.accent,
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ── Stats grid ───────────────────────────────────────────────────────────

  Widget _buildStatsGrid() {
    final pkg = widget.package;
    final svc = widget.service;
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final sessionCount = (pkg['session_count'] as int?) ?? 0;
    final perSession = sessionCount > 1 ? (price / sessionCount).round() : price.toInt();
    final hasMultiple = sessionCount > 1;

    final stats = hasMultiple
        ? [
            _StatItem(value: '$sessionCount', label: context.l10n.commonSessions),
            _StatItem(value: '60', label: context.l10n.packageMinEach),
            _StatItem(value: '$perSession', label: context.l10n.packageEgpPerSession),
          ]
        : [
            _StatItem(value: '60', label: context.l10n.packageMinEach),
            _StatItem(value: '$perSession', label: context.l10n.packageEgpPerSession),
          ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: Row(
        children: stats
            .asMap()
            .entries
            .map((e) => Expanded(
                  child: Padding(
                    padding: EdgeInsetsDirectional.only(start: e.key > 0 ? 8 : 0),
                    child: _StatCard(item: e.value, accent: svc.accent),
                  ),
                ))
            .toList(),
      ),
    );
  }

  // ── What's included ──────────────────────────────────────────────────────

  Widget _buildWhatsIncluded() {
    final svc = widget.service;
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            context.l10n.packageWhatsIncluded,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Color(0xFF888780),
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: _skills
                .map((s) => Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 11, vertical: 4),
                      decoration: BoxDecoration(
                        color: svc.accentLight,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: svc.accent.withValues(alpha: 0.3),
                          width: 0.5,
                        ),
                      ),
                      child: Text(
                        s,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w500,
                          color: svc.accentDark,
                        ),
                      ),
                    ))
                .toList(),
          ),
        ],
      ),
    );
  }

  // ── Coach section ────────────────────────────────────────────────────────

  Widget _buildCoachSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _coachSectionLabel.toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: Color(0xFF888780),
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(height: 8),
          if (_loadingCoaches)
            Column(
              children: List.generate(
                2,
                (_) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ShimmerLoader(height: 74, borderRadius: 14),
                ),
              ),
            )
          else if (_coaches.isEmpty)
            Text(
              context.l10n.packageNoSpecialist,
              style: const TextStyle(fontSize: 13, color: Color(0xFF888780)),
            )
          else
            Column(
              children: _coaches
                  .map((c) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: _CoachCard(
                          coach: c,
                          service: widget.service,
                          isSelected: _selectedCoach?['id'] == c['id'],
                          isSingle: _coaches.length == 1,
                          role: _coachRole(c),
                          onTap: _coaches.length > 1
                              ? () => setState(() => _selectedCoach = c)
                              : null,
                        ),
                      ))
                  .toList(),
            ),
        ],
      ),
    );
  }

  // ── Bottom bar ───────────────────────────────────────────────────────────

  Widget _buildBottomBar() {
    final pkg = widget.package;
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final svc = widget.service;
    final paymentsEnabled = context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true;
    final canBuy = _canBuy && paymentsEnabled;
    final hasMultiple = _coaches.length > 1;
    final noneSelected = hasMultiple && _selectedCoach == null;

    if (!paymentsEnabled) return const SizedBox.shrink();

    return SafeArea(
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xF9F8F7F4),
          border: Border(
            top: BorderSide(color: Color(0xFFD3D1C7), width: 0.5),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            onPressed: canBuy ? _onBuy : null,
            style: ElevatedButton.styleFrom(
              backgroundColor:
                  canBuy ? svc.accent : const Color(0xFFD3D1C7),
              foregroundColor:
                  canBuy ? Colors.white : const Color(0xFFB4B2A9),
              disabledBackgroundColor: const Color(0xFFD3D1C7),
              disabledForegroundColor: const Color(0xFFB4B2A9),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
            ),
            child: noneSelected
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.timelapse_rounded, size: 16),
                      const SizedBox(width: 6),
                      Text(
                        context.l10n.packageSelectCoach,
                        style: const TextStyle(fontSize: 14),
                      ),
                    ],
                  )
                : Text(
                    context.l10n.packageBuyNow(price.toInt()),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

class _StatItem {
  final String value;
  final String label;
  const _StatItem({required this.value, required this.label});
}

class _StatCard extends StatelessWidget {
  final _StatItem item;
  final Color accent;
  const _StatCard({required this.item, required this.accent});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD3D1C7), width: 0.5),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            item.value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w500,
              color: accent,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            item.label,
            style: const TextStyle(fontSize: 9, color: Color(0xFF888780)),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Coach card
// ─────────────────────────────────────────────────────────────────────────────

class _CoachCard extends StatelessWidget {
  final Map<String, dynamic> coach;
  final ServiceModel service;
  final bool isSelected;
  final bool isSingle;
  final String role;
  final VoidCallback? onTap;

  const _CoachCard({
    required this.coach,
    required this.service,
    required this.isSelected,
    required this.isSingle,
    required this.role,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final svc = service;
    final name = (coach['name'] as String?) ?? '';
    final photoUrl = (coach['photo_url'] as String?) ?? '';
    final rating = coach['rating'];

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsetsDirectional.fromSTEB(12, 12, 14, 12),
        decoration: BoxDecoration(
          color: isSelected
              ? svc.accentLight.withValues(alpha: 0.5)
              : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? svc.accent : const Color(0xFFD3D1C7),
            width: isSelected ? 1.5 : 0.5,
          ),
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: isSelected ? svc.accent : svc.accentLight,
                  width: 2.5,
                ),
              ),
              child: ClipOval(
                child: photoUrl.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: photoUrl,
                        fit: BoxFit.cover,
                        errorWidget: (_, __, ___) => _avatarFallback(svc),
                      )
                    : _avatarFallback(svc),
              ),
            ),
            const SizedBox(width: 12),
            // Name / role / rating
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: Color(0xFF1D1D1B),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    role,
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF888780),
                    ),
                  ),
                  if (rating != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      context.l10n.packageRating(rating.toString()),
                      style: const TextStyle(
                        fontSize: 9,
                        color: Color(0xFF888780),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (!isSingle)
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected ? svc.accent : const Color(0xFFD3D1C7),
                    width: 1.5,
                  ),
                  color: isSelected ? svc.accent : Colors.transparent,
                ),
                child: isSelected
                    ? const Icon(Icons.check, color: Colors.white, size: 14)
                    : null,
              )
            else
              const Icon(
                Icons.chevron_right,
                color: Color(0xFFD3D1C7),
                size: 18,
              ),
          ],
        ),
      ),
    );
  }

  Widget _avatarFallback(ServiceModel svc) {
    return Container(
      color: svc.accentLight,
      child: Icon(Icons.person, color: svc.accent, size: 24),
    );
  }
}
