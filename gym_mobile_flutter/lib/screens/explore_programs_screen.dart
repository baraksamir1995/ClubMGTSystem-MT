import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/shimmer_loader.dart';

class ExploreProgramsScreen extends StatefulWidget {
  const ExploreProgramsScreen({super.key});

  @override
  State<ExploreProgramsScreen> createState() => _ExploreProgramsScreenState();
}

class _ExploreProgramsScreenState extends State<ExploreProgramsScreen> {
  List<Map<String, dynamic>> _programs = [];
  bool _loading = true;
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
    final programs = await _service.getProgramsListing(gymId);
    if (mounted) setState(() { _programs = programs; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Programs')),
      body: _loading
          ? _buildSkeleton()
          : _programs.isEmpty
              ? const Center(child: Text('No programs available'))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  itemCount: _programs.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (context, i) {
                    final id = (_programs[i]['id'] as String?) ?? '';
                    return GestureDetector(
                      onTap: () => context.push('/program/$id'),
                      child: _ProgramCard(program: _programs[i]),
                    );
                  },
                ),
    );
  }

  Widget _buildSkeleton() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => ShimmerLoader(height: 300, borderRadius: 14),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _ProgramCard extends StatelessWidget {
  final Map<String, dynamic> program;

  const _ProgramCard({required this.program});

  String _metaLine() => (program['description'] as String?) ?? '';

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final title = (program['title'] as String?) ?? '';
    final imageUrl = program['image_url'] as String?;
    final weeks = program['duration_weeks'] as int?;
    final meta = _metaLine();

    return Container(
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
          // Image + badge overlay
          ClipRRect(
            borderRadius:
                const BorderRadius.vertical(top: Radius.circular(14)),
            child: Stack(
              children: [
                SizedBox(
                  height: 200,
                  width: double.infinity,
                  child: imageUrl != null && imageUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: imageUrl,
                          fit: BoxFit.cover,
                          placeholder: (_, __) => Container(
                              color:
                                  theme.colorScheme.surfaceContainerHighest),
                          errorWidget: (_, __, ___) => Container(
                              color:
                                  theme.colorScheme.surfaceContainerHighest),
                        )
                      : Container(
                          color: theme.colorScheme.surfaceContainerHighest),
                ),
                if (weeks != null)
                  Positioned(
                    bottom: 12,
                    left: 12,
                    child: _Badge(label: '$weeks weeks'),
                  ),
              ],
            ),
          ),
          // Title + meta
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontSize: 18,
                  ),
                ),
                if (meta.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Text(
                    meta,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
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

class _Badge extends StatelessWidget {
  final String label;

  const _Badge({required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.92),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: theme.textTheme.bodySmall?.copyWith(
          fontWeight: FontWeight.w600,
          fontSize: 12,
        ),
      ),
    );
  }
}
