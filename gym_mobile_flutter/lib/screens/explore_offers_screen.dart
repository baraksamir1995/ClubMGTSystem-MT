import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../utils/theme.dart';
import '../widgets/shimmer_loader.dart';

class ExploreOffersScreen extends StatefulWidget {
  const ExploreOffersScreen({super.key});

  @override
  State<ExploreOffersScreen> createState() => _ExploreOffersScreenState();
}

class _ExploreOffersScreenState extends State<ExploreOffersScreen> {
  List<Map<String, dynamic>> _offers = [];
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
    final offers = await _service.getAllCurrentOffers(gymId);
    if (mounted) setState(() { _offers = offers; _loading = false; });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Current offers')),
      body: _loading
          ? _buildSkeleton()
          : _offers.isEmpty
              ? const Center(child: Text('No current offers'))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                  itemCount: _offers.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 12),
                  itemBuilder: (_, i) => _OfferCard(offer: _offers[i]),
                ),
    );
  }

  Widget _buildSkeleton() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: 3,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, __) => ShimmerLoader(height: 280, borderRadius: 14),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _OfferCard extends StatelessWidget {
  final Map<String, dynamic> offer;

  const _OfferCard({required this.offer});

  String _expiry() {
    final raw = offer['expires_at'] as String?;
    if (raw == null) return '';
    try {
      return 'Expires ${DateFormat('MMM d, yyyy').format(DateTime.parse(raw))}';
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
      try { tagColor = AppTheme.colorFromHex(tagColorHex); } catch (_) {}
    }

    return GestureDetector(
      onTap: () => context.push('/offer/$id'),
      child: Container(
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
            // Image
            ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(14)),
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
                                color: theme
                                    .colorScheme.surfaceContainerHighest),
                            errorWidget: (_, __, ___) => Container(
                                color: theme
                                    .colorScheme.surfaceContainerHighest),
                          )
                        : Container(
                            color: theme.colorScheme.surfaceContainerHighest),
                  ),
                  if (tagLabel.isNotEmpty)
                    Positioned(
                      bottom: 12,
                      left: 12,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: tagColor,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          tagLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
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
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                  if (description.isNotEmpty) ...[
                    const SizedBox(height: 5),
                    Text(
                      description,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                  if (expiry.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(
                      expiry,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant
                            .withValues(alpha: 0.7),
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
