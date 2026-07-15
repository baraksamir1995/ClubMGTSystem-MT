import 'package:cached_network_image/cached_network_image.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../models/checkout_item.dart';
import '../models/trainer_profile_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/shimmer_loader.dart';
import 'trainer_detail_screen.dart';

class ProgramDetailScreen extends StatefulWidget {
  final String programId;

  const ProgramDetailScreen({super.key, required this.programId});

  @override
  State<ProgramDetailScreen> createState() => _ProgramDetailScreenState();
}

class _ProgramDetailScreenState extends State<ProgramDetailScreen> {
  Map<String, dynamic>? _program;
  Map<String, dynamic>? _trainer;
  bool _loading = true;
  final _service = ApiService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    final program = await _service.getProgramById(widget.programId);

    Map<String, dynamic>? trainer;
    if (gymId != null && program != null) {
      final trainerName = program['trainer_name'] as String?;
      if (trainerName != null && trainerName.isNotEmpty) {
        trainer = await _service.getTrainerByName(trainerName, gymId);
      }
    }

    if (mounted) {
      setState(() {
        _program = program;
        _trainer = trainer;
        _loading = false;
      });
    }
  }

  Color _resolvePrimary() => Theme.of(context).colorScheme.primary;

  @override
  Widget build(BuildContext context) {
    if (_loading) return _buildSkeleton();
    if (_program == null) return _buildNotFound();
    return _buildContent();
  }

  // ── Skeleton ─────────────────────────────────────────────────────────────

  Widget _buildSkeleton() {
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ShimmerLoader(height: 300, borderRadius: 0),
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                ShimmerLoader(height: 80),
                SizedBox(height: 20),
                ShimmerLoader(height: 14, width: 160),
                SizedBox(height: 12),
                ShimmerLoader(height: 100),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────

  Widget _buildNotFound() {
    return Scaffold(
      appBar: AppBar(),
      body: Center(child: Text(context.l10n.programNotFound)),
    );
  }

  // ── Content ──────────────────────────────────────────────────────────────

  Widget _buildContent() {
    final theme = Theme.of(context);
    final primary = _resolvePrimary();
    final p = _program!;

    final title = (p['title'] as String?) ?? '';
    final description = (p['description'] as String?) ?? '';
    final imageUrl = p['image_url'] as String?;
    final weeks = p['duration_weeks'] as int?;
    final totalSessions = p['total_sessions'] as int?;
    final sessionMinutes = p['session_duration_minutes'] as int?;
    final level = p['level'] as String?;
    final category = p['category'] as String?;
    final trainerName = p['trainer_name'] as String?;
    final scheduleText = p['schedule_text'] as String?;
    final focusAreas = _parseStringList(p['focus_areas']);
    final price = (p['price'] as num?)?.toDouble();
    final perSession = (price != null && totalSessions != null && totalSessions > 0)
        ? price / totalSessions
        : null;

    // Meta line beneath title: category · trainer · schedule
    final metaParts = <String>[
      if (category != null && category.isNotEmpty) category,
      if (trainerName != null && trainerName.isNotEmpty) trainerName,
      if (scheduleText != null && scheduleText.isNotEmpty) scheduleText,
    ];

    // Stats to show (only non-null)
    final stats = <({String value, String label})>[
      if (weeks != null)
        (value: '$weeks', label: context.l10n.programWeeksLabel),
      if (totalSessions != null)
        (value: '$totalSessions', label: context.l10n.commonSessions),
      if (sessionMinutes != null)
        (value: '$sessionMinutes', label: context.l10n.programMinPerClass),
    ];

    final paymentsEnabled = context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: theme.scaffoldBackgroundColor,
        bottomNavigationBar: (price != null && paymentsEnabled)
            ? _PricingBar(
                price: price,
                perSession: perSession,
                weeks: weeks,
                accentColor: primary,
                onEnrol: () {
                  final subtitle = [
                    if (category != null && category.isNotEmpty) category,
                    if (weeks != null) context.l10n.exploreWeeksCount(weeks),
                  ].join(' · ');
                  context.push('/payment-summary', extra: CheckoutItem(
                    type: 'program',
                    id: widget.programId,
                    title: title,
                    subtitle: subtitle,
                    price: price,
                    badges: [
                      if (level != null && level.isNotEmpty) level,
                    ],
                    applyMemberDiscount: true,
                  ));
                },
              )
            : null,
        body: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Hero ──────────────────────────────────────────────────
              _HeroSection(
                imageUrl: imageUrl,
                title: title,
                level: level,
                weeks: weeks,
                metaLine: metaParts.join(' · '),
              ),

              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Pricing card ─────────────────────────────────────
                    if (price != null) ...[
                      _PricingCard(
                        price: price,
                        perSession: perSession,
                        totalSessions: totalSessions,
                        weeks: weeks,
                        accentColor: primary,
                      ),
                      const SizedBox(height: 16),
                    ],

                    // ── Stat boxes ──────────────────────────────────────
                    if (stats.isNotEmpty) ...[
                      Row(
                        children: stats
                            .asMap()
                            .entries
                            .map((e) => Expanded(
                                  child: Padding(
                                    padding: EdgeInsetsDirectional.only(
                                        end: e.key < stats.length - 1
                                            ? 10
                                            : 0),
                                    child: _StatBox(
                                      value: e.value.value,
                                      label: e.value.label,
                                      accentColor: primary,
                                    ),
                                  ),
                                ))
                            .toList(),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── About this program ──────────────────────────────
                    if (description.isNotEmpty) ...[
                      _SectionLabel(context.l10n.programAboutTitle),
                      const SizedBox(height: 10),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: theme.colorScheme.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: theme.colorScheme.outline
                                .withValues(alpha: 0.15),
                          ),
                        ),
                        child: Text(
                          description,
                          style: theme.textTheme.bodyMedium
                              ?.copyWith(height: 1.6),
                        ),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── What you'll work on ─────────────────────────────
                    if (focusAreas.isNotEmpty) ...[
                      _SectionLabel(context.l10n.programFocusTitle),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: focusAreas
                            .map((area) => _FocusChip(label: area))
                            .toList(),
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── Led by ─────────────────────────────────────────
                    if (_trainer != null || trainerName != null) ...[
                      _SectionLabel(context.l10n.programLedByTitle),
                      const SizedBox(height: 10),
                      _TrainerCard(
                        trainer: _trainer,
                        fallbackName: trainerName,
                        primary: primary,
                      ),
                      const SizedBox(height: 24),
                    ],

                    // ── Enrol button (shown when no price and payments enabled) ──
                    if (price == null && paymentsEnabled)
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(
                            backgroundColor: primary,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            padding: const EdgeInsets.symmetric(vertical: 16),
                          ),
                          onPressed: () {},
                          icon: const Icon(Icons.check_rounded,
                              size: 18, color: Colors.white),
                          label: Text(
                            context.l10n.programEnrolCta,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 16,
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<String> _parseStringList(dynamic value) {
    if (value is List) return value.map((e) => e.toString()).toList();
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing card
// ─────────────────────────────────────────────────────────────────────────────

class _PricingCard extends StatelessWidget {
  final double price;
  final double? perSession;
  final int? totalSessions;
  final int? weeks;
  final Color accentColor;

  const _PricingCard({
    required this.price,
    required this.perSession,
    required this.totalSessions,
    required this.weeks,
    required this.accentColor,
  });

  String _fmt(double v) => v.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          // Left — total price
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.programPriceLabel,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 2),
                RichText(
                  text: TextSpan(
                    children: [
                      TextSpan(
                        text: _fmt(price),
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                      TextSpan(
                        text: '  EGP',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
                if (weeks != null)
                  Text(
                    context.l10n.programFullDuration(weeks!),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
              ],
            ),
          ),
          // Divider
          Container(
            width: 1,
            height: 52,
            color: theme.colorScheme.outline.withValues(alpha: 0.15),
            margin: const EdgeInsets.symmetric(horizontal: 14),
          ),
          // Right — per session
          if (perSession != null)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    context.l10n.programPerSessionLabel,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 2),
                  RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: _fmt(perSession!),
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            color: accentColor,
                          ),
                        ),
                        TextSpan(
                          text: '  EGP',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: accentColor.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (totalSessions != null)
                    Text(
                      context.l10n.programSessionsTotal(totalSessions!),
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sticky pricing bottom bar
// ─────────────────────────────────────────────────────────────────────────────

class _PricingBar extends StatelessWidget {
  final double price;
  final double? perSession;
  final int? weeks;
  final Color accentColor;
  final VoidCallback onEnrol;

  const _PricingBar({
    required this.price,
    required this.perSession,
    required this.weeks,
    required this.accentColor,
    required this.onEnrol,
  });

  String _fmt(double v) => v.toStringAsFixed(0).replaceAllMapped(
        RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'),
        (m) => '${m[1]},',
      );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, 12 + bottomPad),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        border: Border(
          top: BorderSide(
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Price row
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.l10n.programPriceLabel,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                        fontSize: 11,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(
                            text: '${_fmt(price)} EGP',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 15,
                            ),
                          ),
                          if (perSession != null)
                            TextSpan(
                              text:
                                  '  ·  ${context.l10n.programPerSessionEgp(_fmt(perSession!))}',
                              style: TextStyle(
                                fontWeight: FontWeight.w500,
                                fontSize: 12,
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              if (weeks != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    context.l10n.exploreWeeksCount(weeks!),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: accentColor,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          // Enrol button
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: accentColor,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              onPressed: onEnrol,
              icon: const Icon(Icons.check_rounded,
                  size: 18, color: Colors.white),
              label: Text(
                context.l10n.programEnrolCta,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

class _HeroSection extends StatelessWidget {
  final String? imageUrl;
  final String title;
  final String? level;
  final int? weeks;
  final String metaLine;

  const _HeroSection({
    required this.imageUrl,
    required this.title,
    required this.level,
    required this.weeks,
    required this.metaLine,
  });

  @override
  Widget build(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;

    return SizedBox(
      height: 300 + topPadding,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Image
          imageUrl != null && imageUrl!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: imageUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, __) =>
                      const ColoredBox(color: Color(0xFFD1D5DB)),
                  errorWidget: (_, __, ___) =>
                      const ColoredBox(color: Color(0xFFD1D5DB)),
                )
              : const ColoredBox(color: Color(0xFFD1D5DB)),

          // Gradient overlay
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: [0.35, 1.0],
                colors: [Colors.transparent, Color(0xCC000000)],
              ),
            ),
          ),

          // Back button
          PositionedDirectional(
            top: topPadding + 8,
            start: 12,
            child: GestureDetector(
              onTap: () => Navigator.of(context).pop(),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.35),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_back_rounded,
                    color: Colors.white, size: 20),
              ),
            ),
          ),

          // Badges + title + meta at bottom
          PositionedDirectional(
            start: 20,
            end: 20,
            bottom: 20,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Badges row
                Row(
                  children: [
                    if (weeks != null) ...[
                      _HeroBadge(label: context.l10n.exploreWeeksCount(weeks!)),
                      const SizedBox(width: 8),
                    ],
                    if (level != null && level!.isNotEmpty)
                      _HeroBadge(label: level!),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                  ),
                ),
                if (metaLine.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    metaLine,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  final String label;
  const _HeroBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: Colors.white.withValues(alpha: 0.3), width: 0.8),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat box
// ─────────────────────────────────────────────────────────────────────────────

class _StatBox extends StatelessWidget {
  final String value;
  final String label;
  final Color accentColor;

  const _StatBox({
    required this.value,
    required this.label,
    required this.accentColor,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
      ),
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: accentColor,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section label
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String text;
  const _SectionLabel(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: Theme.of(context).textTheme.labelSmall?.copyWith(
        color: Theme.of(context).colorScheme.onSurfaceVariant,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.8,
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus area chip
// ─────────────────────────────────────────────────────────────────────────────

class _FocusChip extends StatelessWidget {
  final String label;
  const _FocusChip({required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.25)),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trainer card
// ─────────────────────────────────────────────────────────────────────────────

class _TrainerCard extends StatelessWidget {
  final Map<String, dynamic>? trainer;
  final String? fallbackName;
  final Color primary;

  const _TrainerCard({
    required this.trainer,
    required this.fallbackName,
    required this.primary,
  });

  String _trainerType(BuildContext context, String? type) {
    switch (type) {
      case 'nutritionist':    return context.l10n.trainerTypeNutritionist;
      case 'physiotherapist': return context.l10n.trainerTypePhysiotherapist;
      default:                return context.l10n.trainerTypePersonal;
    }
  }

  String _specialties(BuildContext context) {
    final specs = trainer?['specialties'] as List?;
    if (specs != null && specs.isNotEmpty) {
      return specs.take(3).map((s) => s.toString()).join(' & ');
    }
    return _trainerType(context, trainer?['trainer_type'] as String?);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = (trainer?['name'] as String?) ?? fallbackName ?? '';
    final photoUrl = trainer?['photo_url'] as String?;
    final profile = trainer != null ? TrainerProfile.fromJson(trainer!) : null;

    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: theme.colorScheme.outline.withValues(alpha: 0.15)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: profile == null
            ? null
            : () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) => TrainerDetailScreen(trainer: profile)),
                ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            children: [
              // Avatar
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: theme.colorScheme.surfaceContainerHighest,
                ),
                clipBehavior: Clip.antiAlias,
                child: photoUrl != null && photoUrl.isNotEmpty
                    ? Image.network(photoUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Icon(
                          Icons.person_outline,
                          size: 24,
                          color: theme.colorScheme.onSurfaceVariant
                              .withValues(alpha: 0.5),
                        ))
                    : Icon(
                        Icons.person_outline,
                        size: 24,
                        color: theme.colorScheme.onSurfaceVariant
                            .withValues(alpha: 0.5),
                      ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    if (trainer != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        _specialties(context),
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
              if (profile != null)
                Icon(
                  Icons.chevron_right_rounded,
                  size: 20,
                  color: theme.colorScheme.onSurfaceVariant
                      .withValues(alpha: 0.5),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
