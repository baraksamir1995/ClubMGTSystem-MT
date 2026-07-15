import 'package:cached_network_image/cached_network_image.dart';
import 'package:clby/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../features/branches/branch_provider.dart';
import '../models/branch_model.dart';
import '../models/trainer_profile_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/shimmer_loader.dart';
import 'trainer_detail_screen.dart';

class ExploreTrainersScreen extends StatefulWidget {
  const ExploreTrainersScreen({super.key});

  @override
  State<ExploreTrainersScreen> createState() => _ExploreTrainersScreenState();
}

class _ExploreTrainersScreenState extends State<ExploreTrainersScreen> {
  List<Map<String, dynamic>> _allTrainers = [];
  bool _loading = true;
  String? _filterBranchId;
  final _service = ApiService();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    final trainers = await _service.getTrainersListing(gymId);
    if (mounted) setState(() { _allTrainers = trainers; _loading = false; });
  }

  List<Map<String, dynamic>> get _visibleTrainers {
    if (_filterBranchId == null) return _allTrainers;
    return _allTrainers.where((t) {
      final tb = t['trainer_branches'] as List?;
      if (tb == null) return false;
      return tb.any((r) => (r as Map<String, dynamic>)['branch_id'] == _filterBranchId);
    }).toList();
  }

  Color _resolvePrimary() => Theme.of(context).colorScheme.primary;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = _resolvePrimary();
    final branchProvider = context.watch<BranchProvider>();
    final isMultiBranch = branchProvider.isMultiBranch;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: Text(context.l10n.trainerListTitle)),
      body: _loading
          ? _buildSkeleton()
          : Column(
              children: [
                // Branch filter chips (multi-branch only)
                if (isMultiBranch)
                  _buildBranchChips(branchProvider.branches, theme, primary),

                Expanded(
                  child: _visibleTrainers.isEmpty
                      ? Center(child: Text(context.l10n.trainerNoneFound))
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                          children: [
                            Container(
                              decoration: BoxDecoration(
                                color: theme.colorScheme.surface,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: theme.colorScheme.outline
                                      .withValues(alpha: 0.12),
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withValues(alpha: 0.04),
                                    blurRadius: 8,
                                    offset: const Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Column(
                                children: _visibleTrainers
                                    .asMap()
                                    .entries
                                    .map((e) => _TrainerRow(
                                          trainer: e.value,
                                          primary: primary,
                                          showDivider:
                                              e.key < _visibleTrainers.length - 1,
                                        ))
                                    .toList(),
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
    );
  }

  Widget _buildBranchChips(List<BranchModel> branches, ThemeData theme, Color primary) {
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        children: [
          // "All" chip
          _BranchChip(
            label: context.l10n.trainerFilterAll,
            selected: _filterBranchId == null,
            primary: primary,
            onTap: () => setState(() => _filterBranchId = null),
          ),
          ...branches.map((b) => _BranchChip(
            label: b.name,
            selected: _filterBranchId == b.id,
            primary: primary,
            onTap: () => setState(() => _filterBranchId = b.id),
          )),
        ],
      ),
    );
  }

  Widget _buildSkeleton() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: List.generate(
              5,
              (i) => Padding(
                padding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 14),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          ShimmerLoader(height: 14, width: 160),
                          const SizedBox(height: 6),
                          ShimmerLoader(height: 11, width: 200),
                          const SizedBox(height: 5),
                          ShimmerLoader(height: 11, width: 120),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _BranchChip extends StatelessWidget {
  final String label;
  final bool selected;
  final Color primary;
  final VoidCallback onTap;

  const _BranchChip({
    required this.label,
    required this.selected,
    required this.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsetsDirectional.only(end: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? primary : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: selected ? primary : Colors.grey.withValues(alpha: 0.3),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : Colors.grey,
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _TrainerRow extends StatelessWidget {
  final Map<String, dynamic> trainer;
  final Color primary;
  final bool showDivider;

  const _TrainerRow({
    required this.trainer,
    required this.primary,
    required this.showDivider,
  });

  Color _dotColor() {
    switch (trainer['trainer_type'] as String?) {
      case 'nutritionist':    return const Color(0xFF10B981);
      case 'physiotherapist': return const Color(0xFF0EA5E9);
      default:                return primary;
    }
  }

  String _typeLabel(BuildContext context) {
    switch (trainer['trainer_type'] as String?) {
      case 'nutritionist':    return context.l10n.trainerTypeNutritionist;
      case 'physiotherapist': return context.l10n.trainerTypePhysiotherapist;
      default:                return context.l10n.trainerTypePersonal;
    }
  }

  String _specialties() {
    final specs = trainer['specialties'] as List?;
    if (specs != null && specs.isNotEmpty) {
      return specs.take(2).map((s) => s.toString()).join(' · ');
    }
    return '';
  }

  String _subtitleLine(BuildContext context) {
    final type = _typeLabel(context);
    final specs = _specialties();
    return specs.isNotEmpty ? '$type · $specs' : type;
  }


  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final name = (trainer['name'] as String?) ?? '';
    final profile = TrainerProfile.fromJson(trainer);

    return Column(
      children: [
        InkWell(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => TrainerDetailScreen(trainer: profile)),
          ),
          borderRadius: BorderRadius.circular(showDivider ? 0 : 14),
          child: Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 14, 12),
            child: Row(
              children: [
                // Avatar
                _TrainerAvatar(
                  photoUrl: trainer['photo_url'] as String?,
                  dotColor: _dotColor(),
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
                          fontSize: 15,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        _subtitleLine(context),
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    color: _dotColor(),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
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
        if (showDivider)
          Divider(
            height: 1,
            thickness: 0.5,
            indent: 72, // avatar (44) + gap (12) + left padding (16)
            color: theme.colorScheme.outline.withValues(alpha: 0.12),
          ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _TrainerAvatar extends StatelessWidget {
  final String? photoUrl;
  final Color dotColor;

  const _TrainerAvatar({required this.photoUrl, required this.dotColor});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Stack(
      children: [
        Container(
          width: 44,
          height: 44,
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
                  errorWidget: (_, __, ___) => Icon(
                    Icons.person_outline,
                    size: 22,
                    color: theme.colorScheme.onSurfaceVariant
                        .withValues(alpha: 0.5),
                  ),
                )
              : Icon(
                  Icons.person_outline,
                  size: 22,
                  color: theme.colorScheme.onSurfaceVariant
                      .withValues(alpha: 0.5),
                ),
        ),
        PositionedDirectional(
          bottom: 1,
          end: 1,
          child: Container(
            width: 11,
            height: 11,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
