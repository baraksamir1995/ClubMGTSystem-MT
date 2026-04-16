import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/checkout_item.dart';
import '../models/trainer_profile_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../widgets/services_section.dart';
import '../widgets/shimmer_loader.dart';
import '../widgets/screen_refresh_indicator.dart';
import 'trainer_detail_screen.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  // Above-fold data (Memberships, Offers, Trainers) — loads immediately
  List<Map<String, dynamic>> _plans = [];
  List<Map<String, dynamic>> _offers = [];
  List<Map<String, dynamic>> _trainers = [];
  bool _loadingAboveFold = true;

  // Below-fold data (Programs, Session packages, Partners) — lazy on scroll
  List<Map<String, dynamic>> _programs = [];
  List<Map<String, dynamic>> _sessionPackages = [];
  List<Map<String, dynamic>> _partners = [];
  Map<String, int> _servicePackageCounts = {};
  bool _belowFoldLoaded = false;

  // Search
  bool _searchActive = false;
  final _searchController = TextEditingController();
  List<Map<String, dynamic>> _searchResults = [];
  bool _searchLoading = false;

  final _scrollController = ScrollController();
  final _service = ApiService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadAll());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) {
      if (mounted) setState(() => _loadingAboveFold = false);
      return;
    }

    final results = await Future.wait([
      _service.getMembershipPlansForExplore(gymId),
      _service.getCurrentOffers(gymId),
      _service.getTrainersForExplore(gymId),
      _service.getProgramsForExplore(gymId),
      _service.getSessionPackagesForExplore(gymId),
      _service.getPartnersForExplore(gymId),
      _service.getServicePackageCounts(gymId),
    ]);

    if (mounted) {
      setState(() {
        _plans           = results[0] as List<Map<String, dynamic>>;
        _offers          = results[1] as List<Map<String, dynamic>>;
        _trainers        = results[2] as List<Map<String, dynamic>>;
        _programs        = results[3] as List<Map<String, dynamic>>;
        _sessionPackages = results[4] as List<Map<String, dynamic>>;
        _partners        = results[5] as List<Map<String, dynamic>>;
        _servicePackageCounts = results[6] as Map<String, int>;
        _loadingAboveFold = false;
        _belowFoldLoaded  = true;
      });
    }
  }

  Future<void> _onRefresh() async {
    _belowFoldLoaded = false;
    setState(() => _loadingAboveFold = true);
    await _loadAll();
  }

  void _toggleSearch() {
    setState(() {
      _searchActive = !_searchActive;
      if (!_searchActive) {
        _searchController.clear();
        _searchResults = [];
        _searchLoading = false;
      }
    });
  }

  Future<void> _onSearchChanged(String query) async {
    if (query.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _searchLoading = false;
      });
      return;
    }
    setState(() => _searchLoading = true);

    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) return;

    final results = await _service.searchExplore(gymId, query.trim());
    if (mounted && _searchController.text.trim() == query.trim()) {
      setState(() {
        _searchResults = results;
        _searchLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: _buildAppBar(theme, primary),
      body: _searchActive
          ? _buildSearchBody(theme, primary)
          : ScreenRefreshIndicator(
              onRefresh: _onRefresh,
              icon: Icons.explore_rounded,
              color: primary,
              child: SingleChildScrollView(
                controller: _scrollController,
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(0, 16, 0, 32),
                child: _loadingAboveFold
                    ? _buildSkeleton()
                    : _buildFeed(theme, primary),
              ),
            ),
    );
  }

  // ── App bar ────────────────────────────────────────────────────────────────

  PreferredSizeWidget _buildAppBar(ThemeData theme, Color primary) {
    return AppBar(
      automaticallyImplyLeading: false,
      titleSpacing: 20,
      title: _searchActive
          ? TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search classes, specialists, programs…',
                hintStyle: TextStyle(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontSize: 15,
                ),
                border: InputBorder.none,
              ),
              style: const TextStyle(fontSize: 15),
            )
          : Text(
              'Explore',
              style: theme.textTheme.titleLarge
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
      actions: [
        GestureDetector(
          onTap: _toggleSearch,
          behavior: HitTestBehavior.opaque,
          child: Container(
            margin: const EdgeInsets.only(right: 16),
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest
                  .withValues(alpha: 0.5),
              shape: BoxShape.circle,
            ),
            child: Icon(
              _searchActive ? Icons.close_rounded : Icons.search_rounded,
              size: 20,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
      ],
      backgroundColor: theme.colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Divider(
          height: 1,
          thickness: 1,
          color: theme.colorScheme.outline.withValues(alpha: 0.12),
        ),
      ),
    );
  }

  // ── Feed ───────────────────────────────────────────────────────────────────

  Widget _buildFeed(ThemeData theme, Color primary) {
    final gymName =
        context.read<AuthProvider>().gym?.name ?? 'Our gym';

    final sections = <Widget>[];

    if (_plans.isNotEmpty) {
      sections.add(_MembershipsSection(
        plans: _plans,
        gymName: gymName,
        primary: primary,
      ));
    }

    if (_offers.isNotEmpty) {
      sections.add(_CurrentOffersSection(offers: _offers, primary: primary));
    }

    if (_trainers.isNotEmpty) {
      sections.add(_TrainersSection(trainers: _trainers, primary: primary));
    }

    // Services section (PT / Physio / Nutrition)
    if (_belowFoldLoaded) {
      sections.add(const ServicesSection());
    }

    if (_programs.isNotEmpty) {
      sections.add(_ProgramsSection(programs: _programs, primary: primary));
    }

    if (_sessionPackages.isNotEmpty) {
      sections.add(
          _SessionPackagesSection(packages: _sessionPackages, primary: primary));
    }

    if (_partners.isNotEmpty) {
      sections.add(_PartnersSection(partners: _partners));
    }

    if (sections.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: sections,
    );
  }

  // ── Skeleton ───────────────────────────────────────────────────────────────

  Widget _buildSkeleton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ShimmerLoader(height: 14, width: 110),
          const SizedBox(height: 12),
          const ShimmerLoader(height: 160),
          const SizedBox(height: 28),
          const ShimmerLoader(height: 14, width: 110),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: ShimmerLoader(height: 210, borderRadius: 14)),
              const SizedBox(width: 12),
              Expanded(child: ShimmerLoader(height: 210, borderRadius: 14)),
            ],
          ),
          const SizedBox(height: 28),
          const ShimmerLoader(height: 14, width: 110),
          const SizedBox(height: 12),
          Row(
            children: List.generate(3, (i) {
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(right: i < 2 ? 16 : 0),
                  child: Column(
                    children: const [
                      ShimmerLoader(height: 80, borderRadius: 40),
                      SizedBox(height: 8),
                      ShimmerLoader(height: 12, width: 56),
                      SizedBox(height: 4),
                      ShimmerLoader(height: 10, width: 42),
                    ],
                  ),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }

  // ── Search body ────────────────────────────────────────────────────────────

  Widget _buildSearchBody(ThemeData theme, Color primary) {
    if (_searchController.text.trim().isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Text(
            'Search for classes, specialists, programs or offers',
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }

    if (_searchLoading) {
      return Center(
          child: CircularProgressIndicator(color: primary, strokeWidth: 2));
    }

    if (_searchResults.isEmpty) {
      return Center(
        child: Text(
          'No results for "${_searchController.text.trim()}"',
          style: theme.textTheme.bodyMedium?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 20),
      itemCount: _searchResults.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) => _SearchResultTile(
        item: _searchResults[i],
        primary: primary,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared section header
// ─────────────────────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;
  final Color primary;

  const _SectionHeader({
    required this.title,
    required this.primary,
    this.actionLabel,
    this.onAction,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            title,
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
          if (actionLabel != null && onAction != null)
            GestureDetector(
              onTap: onAction,
              behavior: HitTestBehavior.opaque,
              child: Text(
                actionLabel!,
                style: TextStyle(
                  color: primary,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Memberships teaser
// ─────────────────────────────────────────────────────────────────────────────

class _MembershipsSection extends StatelessWidget {
  final List<Map<String, dynamic>> plans;
  final String gymName;
  final Color primary;

  const _MembershipsSection({
    required this.plans,
    required this.gymName,
    required this.primary,
  });

  Color _priceColorForIndex(int index, Color primary) {
    if (index == 0) return const Color(0xFF1A1A2E);
    if (index == 1) return const Color(0xFFD97706);
    return primary;
  }

  String _formatPrice(Map<String, dynamic> plan) {
    final price = (plan['price'] as num?)?.toDouble() ?? 0;
    final currency = (plan['currency'] as String?) ?? 'EGP';
    final isWhole = price == price.floorToDouble();
    final fmt = isWhole
        ? NumberFormat('#,###', 'en_US').format(price.toInt())
        : NumberFormat('#,##0.##', 'en_US').format(price);
    if (currency == 'USD') return '\$$fmt';
    return '$fmt $currency';
  }

  String _formatCycle(String? cycle) {
    switch (cycle) {
      case 'monthly':
        return '/ month';
      case 'yearly':
        return '/ year';
      case 'quarterly':
        return '/ quarter';
      case 'one_time':
        return 'one time';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final displayPlans = plans.take(3).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'Memberships',
          primary: primary,
        ),
        const SizedBox(height: 12),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              children: [
                // Dark header
                Container(
                  color: const Color(0xFF1A1A2E),
                  padding: const EdgeInsets.fromLTRB(16, 14, 14, 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '$gymName membership plans',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            const Text(
                              'Gym access + optional session bundles',
                              style: TextStyle(
                                color: Colors.white60,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(Icons.chevron_right,
                          color: Colors.white54, size: 22),
                    ],
                  ),
                ),
                // White body
                Container(
                  color: Colors.white,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 14, 12, 4),
                        child: Column(
                          children: [
                            // ── Names row — all plans in the same row so
                            //    heights match regardless of text length ──────
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: displayPlans.asMap().entries.map((e) {
                                final name =
                                    (e.value['name'] as String?) ?? '';
                                return Expanded(
                                  child: Text(
                                    name,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.black54,
                                      fontWeight: FontWeight.w500,
                                      height: 1.25,
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: 6),
                            // ── Prices row — always on the same baseline ────
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.baseline,
                              textBaseline: TextBaseline.alphabetic,
                              children: displayPlans.asMap().entries.map((e) {
                                return Expanded(
                                  child: Text(
                                    _formatPrice(e.value),
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w800,
                                      color: _priceColorForIndex(
                                          e.key, primary),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                            const SizedBox(height: 2),
                            // ── Billing cycles row ──────────────────────────
                            Row(
                              children: displayPlans.asMap().entries.map((e) {
                                final cycle = _formatCycle(
                                    e.value['billing_cycle'] as String?);
                                return Expanded(
                                  child: Text(
                                    cycle,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.black45,
                                    ),
                                  ),
                                );
                              }).toList(),
                            ),
                          ],
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Divider(height: 16, thickness: 0.5),
                      ),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Tap to see full benefits',
                              style: TextStyle(
                                color: Colors.grey.shade400,
                                fontSize: 12,
                              ),
                            ),
                            GestureDetector(
                              onTap: () => context.push('/explore/memberships'),
                              child: Text(
                                'View plans \u203a',
                                style: TextStyle(
                                  color: primary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Current offers
// ─────────────────────────────────────────────────────────────────────────────

class _CurrentOffersSection extends StatelessWidget {
  final List<Map<String, dynamic>> offers;
  final Color primary;

  const _CurrentOffersSection(
      {required this.offers, required this.primary});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'Current offers',
          actionLabel: 'See all',
          onAction: () => context.push('/explore/offers'),
          primary: primary,
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 230,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: offers.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) =>
                _OfferCard(offer: offers[i], primary: primary),
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

class _OfferCard extends StatelessWidget {
  final Map<String, dynamic> offer;
  final Color primary;

  const _OfferCard({required this.offer, required this.primary});

  String _expiry() {
    final raw = offer['expires_at'] as String?;
    if (raw == null) return '';
    try {
      final date = DateTime.parse(raw);
      return 'Expires ${DateFormat('MMM d').format(date)}';
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final id = (offer['id'] as String?) ?? '';
    final title = (offer['title'] as String?) ?? '';
    final description = (offer['short_description'] as String?) ?? '';
    final imageUrl = offer['hero_image_url'] as String?;
    final tagLabel = (offer['tag_label'] as String?) ?? '';
    final tagColorHex = offer['tag_color'] as String?;
    final expiry = _expiry();

    Color tagColor = const Color(0xFFF59E0B);
    if (tagColorHex != null && tagColorHex.isNotEmpty) {
      try {
        tagColor = AppTheme.colorFromHex(tagColorHex);
      } catch (_) {}
    }

    return GestureDetector(
      onTap: () => context.push('/offer/$id'),
      child: Container(
        width: 200,
        decoration: BoxDecoration(
          color: theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
              color: theme.colorScheme.outline.withValues(alpha: 0.12)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Image area — 110px height per spec
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(14)),
              child: Stack(
                children: [
                  SizedBox(
                    height: 110,
                    width: double.infinity,
                    child: imageUrl != null && imageUrl.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: imageUrl,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                                color: theme
                                    .colorScheme.surfaceContainerHighest),
                            errorWidget: (_, __, ___) => Container(
                                color: theme
                                    .colorScheme.surfaceContainerHighest),
                          )
                        : Container(
                            color:
                                theme.colorScheme.surfaceContainerHighest,
                          ),
                  ),
                  // Tag pill
                  if (tagLabel.isNotEmpty)
                    Positioned(
                      bottom: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: tagColor,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          tagLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Content
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      description,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                  if (expiry.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      expiry,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant
                            .withValues(alpha: 0.7),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Our trainers
// ─────────────────────────────────────────────────────────────────────────────

class _TrainersSection extends StatelessWidget {
  final List<Map<String, dynamic>> trainers;
  final Color primary;

  const _TrainersSection({required this.trainers, required this.primary});

  Color _dotColor(String? trainerType, Color primary) {
    switch (trainerType) {
      case 'nutritionist':
        return const Color(0xFF10B981);
      case 'physiotherapist':
        return const Color(0xFF0EA5E9);
      default:
        return primary;
    }
  }

  String _specialty(Map<String, dynamic> trainer) {
    final type = trainer['trainer_type'] as String?;
    final specs = trainer['specialties'] as List?;
    if (specs != null && specs.isNotEmpty) {
      return specs.first.toString();
    }
    switch (type) {
      case 'nutritionist':
        return 'Nutrition';
      case 'physiotherapist':
        return 'Physio';
      default:
        return 'PT';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'Our specialists',
          actionLabel: 'See all',
          onAction: () => context.push('/explore/trainers'),
          primary: primary,
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 110,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: trainers.length,
            separatorBuilder: (_, __) => const SizedBox(width: 16),
            itemBuilder: (context, i) {
              final t = trainers[i];
              return _TrainerCircle(
                name: (t['name'] as String?) ?? '',
                photoUrl: t['photo_url'] as String?,
                specialty: _specialty(t),
                dotColor: _dotColor(t['trainer_type'] as String?, primary),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TrainerDetailScreen(
                      trainer: TrainerProfile.fromJson(t),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

class _TrainerCircle extends StatelessWidget {
  final String name;
  final String? photoUrl;
  final String specialty;
  final Color dotColor;
  final VoidCallback? onTap;

  const _TrainerCircle({
    required this.name,
    required this.photoUrl,
    required this.specialty,
    required this.dotColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: SizedBox(
      width: 72,
      child: Column(
        children: [
          Stack(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: theme.colorScheme.surfaceContainerHighest,
                ),
                clipBehavior: Clip.antiAlias,
                child: photoUrl != null && photoUrl!.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: photoUrl!,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => const SizedBox.shrink(),
                        errorWidget: (_, __, ___) => const Icon(
                          Icons.person_outline,
                          size: 28,
                          color: Colors.white54,
                        ),
                      )
                    : const Icon(
                        Icons.person_outline,
                        size: 28,
                        color: Colors.white54,
                      ),
              ),
              Positioned(
                bottom: 2,
                right: 2,
                child: Container(
                  width: 12,
                  height: 12,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 1.5),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            name.split(' ').first,
            style: theme.textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            specialty,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontSize: 11,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Programs
// ─────────────────────────────────────────────────────────────────────────────

class _ProgramsSection extends StatelessWidget {
  final List<Map<String, dynamic>> programs;
  final Color primary;

  const _ProgramsSection({required this.programs, required this.primary});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'Programs',
          actionLabel: 'See all',
          onAction: () => context.push('/explore/programs'),
          primary: primary,
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 270,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: programs.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) =>
                _ProgramCard(program: programs[i], primary: primary),
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

class _ProgramCard extends StatelessWidget {
  final Map<String, dynamic> program;
  final Color primary;

  const _ProgramCard({required this.program, required this.primary});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = (program['title'] as String?) ?? '';
    final description = (program['description'] as String?) ?? '';
    final imageUrl = program['image_url'] as String?;
    final weeks = program['duration_weeks'] as int?;

    final id = (program['id'] as String?) ?? '';
    return GestureDetector(
      onTap: () => context.push('/program/$id'),
      child: Container(
      width: 280,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image with duration pill overlay
          ClipRRect(
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(16)),
            child: Stack(
              children: [
                SizedBox(
                  height: 180,
                  width: double.infinity,
                  child: imageUrl != null && imageUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                              color: theme.colorScheme.surfaceContainerHighest),
                          errorWidget: (_, __, ___) => Container(
                              color: theme.colorScheme.surfaceContainerHighest),
                        )
                      : Container(
                          color: theme.colorScheme.surfaceContainerHighest),
                ),
                // Duration pill
                if (weeks != null)
                  Positioned(
                    bottom: 12,
                    left: 12,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surface
                            .withValues(alpha: 0.92),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '$weeks weeks',
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // Title + subtitle
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall
                      ?.copyWith(fontWeight: FontWeight.w800, fontSize: 16),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (description.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    ));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Session packages
// ─────────────────────────────────────────────────────────────────────────────

class _SessionPackagesSection extends StatelessWidget {
  final List<Map<String, dynamic>> packages;
  final Color primary;

  const _SessionPackagesSection(
      {required this.packages, required this.primary});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: 'Session packages',
          actionLabel: 'See all',
          onAction: () => context.push('/explore/session-packages'),
          primary: primary,
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 210,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: packages.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) {
              final pkg = packages[i];
              final name = (pkg['name'] as String?) ?? '';
              final sessions = (pkg['session_count'] as int?) ?? 0;
              final price = (pkg['price'] as num?)?.toDouble() ?? 0;
              final currency = (pkg['currency'] as String?) ?? '';
              final paymentsEnabled =
                  context.read<AuthProvider>().gym?.mobilePaymentsEnabled ??
                      true;
              return _SessionPackageCard(
                name: name,
                sessions: sessions,
                totalPrice: price,
                currency: currency,
                accentIndex: i,
                primary: primary,
                onTap: paymentsEnabled
                    ? () => context.push(
                          '/payment-summary',
                          extra: CheckoutItem(
                            type: 'session_package',
                            id: (pkg['id'] as String?) ?? '',
                            title: name.isNotEmpty ? name : '$sessions sessions',
                            subtitle: '$sessions sessions package',
                            price: price,
                          ),
                        )
                    : null,
              );
            },
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

class _SessionPackageCard extends StatelessWidget {
  final String name;
  final int sessions;
  final double totalPrice;
  final String currency;
  final int accentIndex;
  final Color primary;
  final VoidCallback? onTap;

  const _SessionPackageCard({
    required this.name,
    required this.sessions,
    required this.totalPrice,
    required this.currency,
    required this.accentIndex,
    required this.primary,
    this.onTap,
  });

  static const _accents = [
    Color(0xFF6B7280), // gray — Starter
    Color(0xFFD97706), // amber — Popular
    Color(0xFF6366F1), // indigo — Best value
  ];

  static const _borderColors = [
    Color(0xFFE5E7EB),
    Color(0xFFFBBF24),
    Color(0xFFA5B4FC),
  ];

  String _fmt(double price, String cur) {
    final s = price == price.floorToDouble()
        ? price.toInt().toString()
        : price.toStringAsFixed(0);
    if (cur == 'USD') return '\$$s';
    return '$s $cur';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final accent = _accents[accentIndex % _accents.length];
    final borderColor = _borderColors[accentIndex % _borderColors.length];
    final perSession = sessions > 0 ? totalPrice / sessions : 0.0;

    return GestureDetector(
      onTap: onTap,
      child: Container(
      width: 170,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor, width: accentIndex == 1 ? 2 : 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Large session count
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$sessions',
                style: TextStyle(
                  fontSize: 42,
                  fontWeight: FontWeight.w800,
                  color: accent,
                  height: 1,
                ),
              ),
              Text(
                'sessions',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ),
          // Price block
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _fmt(totalPrice, currency),
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: accent,
                ),
              ),
              Text(
                '${_fmt(perSession.toDouble(), currency)} / session',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 10),
              // Badge pill
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: accent.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  name,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: accent,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Our partners (no "See all")
// ─────────────────────────────────────────────────────────────────────────────

class _PartnersSection extends StatelessWidget {
  final List<Map<String, dynamic>> partners;

  const _PartnersSection({required this.partners});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // No "See all" for partners per user story
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            'Our partners',
            style: theme.textTheme.titleMedium
                ?.copyWith(fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 120,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            itemCount: partners.length,
            separatorBuilder: (_, __) => const SizedBox(width: 12),
            itemBuilder: (context, i) => _PartnerCard(partner: partners[i]),
          ),
        ),
        const SizedBox(height: 28),
      ],
    );
  }
}

class _PartnerCard extends StatelessWidget {
  final Map<String, dynamic> partner;

  const _PartnerCard({required this.partner});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final imageUrl = partner['image_url'] as String?;

    return Container(
      width: 150,
      height: 110,
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.12)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: imageUrl != null && imageUrl.isNotEmpty
          ? CachedNetworkImage(
              imageUrl: imageUrl,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(
                  color: theme.colorScheme.surfaceContainerHighest),
              errorWidget: (_, __, ___) => Container(
                  color: theme.colorScheme.surfaceContainerHighest),
            )
          : Container(color: theme.colorScheme.surfaceContainerHighest),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search result tile
// ─────────────────────────────────────────────────────────────────────────────

class _SearchResultTile extends StatelessWidget {
  final Map<String, dynamic> item;
  final Color primary;

  const _SearchResultTile({required this.item, required this.primary});

  IconData _icon(String type) {
    switch (type) {
      case 'trainer':
        return Icons.person_outline_rounded;
      case 'program':
        return Icons.fitness_center_outlined;
      case 'offer':
        return Icons.local_offer_outlined;
      default:
        return Icons.calendar_month_outlined; // class
    }
  }

  String _label(String type) {
    switch (type) {
      case 'trainer':
        return 'Specialist';
      case 'program':
        return 'Program';
      case 'offer':
        return 'Offer';
      default:
        return 'Class';
    }
  }

  String _title() {
    final type = item['type'] as String? ?? '';
    if (type == 'program') return (item['title'] as String?) ?? '';
    return (item['name'] as String?) ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final type = (item['type'] as String?) ?? 'class';

    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: primary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(_icon(type), size: 20, color: primary),
      ),
      title: Text(
        _title(),
        style: theme.textTheme.bodyMedium
            ?.copyWith(fontWeight: FontWeight.w600),
      ),
      subtitle: Text(
        _label(type),
        style: theme.textTheme.bodySmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}
