import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../models/service_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../widgets/service_icon.dart';
import '../widgets/shimmer_loader.dart';

// Passed as `extra` when navigating to PackageDetailScreen.
class PackageDetailExtra {
  final ServiceModel service;
  final Map<String, dynamic> package;
  const PackageDetailExtra({required this.service, required this.package});
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen 2 — Package listing for a service
// ─────────────────────────────────────────────────────────────────────────────

class ServicePackagesScreen extends StatefulWidget {
  final ServiceModel service;
  const ServicePackagesScreen({super.key, required this.service});

  @override
  State<ServicePackagesScreen> createState() => _ServicePackagesScreenState();
}

class _ServicePackagesScreenState extends State<ServicePackagesScreen> {
  List<Map<String, dynamic>> _packages = [];
  bool _loading = true;
  final _svc = ApiService();

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
    final pkgs = await _svc.getSessionPackagesForService(gymId, widget.service.trainerType);
    if (mounted) setState(() { _packages = pkgs; _loading = false; });
  }

  String _per(Map<String, dynamic> pkg) =>
      ((pkg['session_count'] as int?) ?? 0) <= 1 ? 'session' : 'pack';

  double _perSession(Map<String, dynamic> pkg) {
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final count = (pkg['session_count'] as int?) ?? 1;
    return count > 0 ? price / count : price;
  }

  int _bestValueIndex() {
    if (_packages.length < 2) return -1;
    int bestIdx = 0;
    double bestPer = _perSession(_packages[0]);
    for (int i = 1; i < _packages.length; i++) {
      final per = _perSession(_packages[i]);
      if (per < bestPer) {
        bestPer = per;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  bool _isFeatured(int i) => i == _bestValueIndex();

  String _tag(int i) {
    if (_isFeatured(i)) return 'Best value';
    if (i == 0 && _packages.length > 2) return 'Starter';
    return '';
  }

  void _openDetail(int i) {
    final pkg = _packages[i];
    context.push(
      '/package-detail/${pkg['id']}',
      extra: PackageDetailExtra(
        service: widget.service,
        package: {
          ...pkg,
          'per': _per(pkg),
          'tag': _tag(i),
          'isFeatured': _isFeatured(i),
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final svc = widget.service;
    return Scaffold(
      backgroundColor: const Color(0xFFF7F6F2),
      appBar: AppBar(
        title: Text(
          svc.name,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new, size: 18),
          onPressed: () => context.pop(),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF1D1D1B),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(0.5),
          child: Container(color: const Color(0xFFD3D1C7), height: 0.5),
        ),
      ),
      body: _loading ? _buildSkeleton() : _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_packages.isEmpty) {
      return const Center(child: Text('No packages available'));
    }
    return ListView(
      padding: EdgeInsets.zero,
      children: [
        _InfoBanner(service: widget.service),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
          child: Column(
            children: List.generate(_packages.length, (i) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: _PackageCard(
                pkg: _packages[i],
                service: widget.service,
                isFeatured: _isFeatured(i),
                tag: _tag(i),
                per: _per(_packages[i]),
                onTap: () => _openDetail(i),
              ),
            )),
          ),
        ),
      ],
    );
  }

  Widget _buildSkeleton() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Column(
        children: List.generate(
          3,
          (_) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: ShimmerLoader(height: 84, borderRadius: 16),
          ),
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Info banner
// ─────────────────────────────────────────────────────────────────────────────

class _InfoBanner extends StatelessWidget {
  final ServiceModel service;
  const _InfoBanner({required this.service});

  @override
  Widget build(BuildContext context) {
    final svc = service;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: svc.accentLight,
        border: Border.all(
          color: svc.accent.withValues(alpha: 0.3),
          width: 0.5,
        ),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: svc.accent,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: ServiceIcon(iconType: svc.iconType, color: Colors.white, size: 20),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              "Choose a package below. You'll pick your specialist on the next screen.",
              style: TextStyle(
                fontSize: 11,
                color: svc.accentDark,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Package card
// ─────────────────────────────────────────────────────────────────────────────

class _PackageCard extends StatelessWidget {
  final Map<String, dynamic> pkg;
  final ServiceModel service;
  final bool isFeatured;
  final String tag;
  final String per;
  final VoidCallback onTap;

  const _PackageCard({
    required this.pkg,
    required this.service,
    required this.isFeatured,
    required this.tag,
    required this.per,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final svc = service;
    final name = (pkg['name'] as String?) ?? '';
    final sub = (pkg['description'] as String?) ?? '';
    final price = (pkg['price'] as num?)?.toDouble() ?? 0;
    final sessionCount = (pkg['session_count'] as int?) ?? 0;
    final perSession = sessionCount > 1 ? (price / sessionCount).round() : null;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isFeatured ? svc.accent : const Color(0xFFD3D1C7),
            width: isFeatured ? 1.5 : 0.5,
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(14, isFeatured ? 22 : 14, 14, 14),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // Left: name + sub + tag
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
                        if (sub.isNotEmpty) ...[
                          const SizedBox(height: 3),
                          Text(
                            sub,
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF888780),
                            ),
                          ),
                        ],
                        if (!isFeatured && tag.isNotEmpty) ...[
                          const SizedBox(height: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 7,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: svc.accentLight,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              tag,
                              style: TextStyle(
                                fontSize: 8,
                                fontWeight: FontWeight.w500,
                                color: svc.accent,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Right: price
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '${price.toInt()}',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w500,
                          color: svc.accent,
                        ),
                      ),
                      Text(
                        'EGP / $per',
                        style: const TextStyle(
                          fontSize: 9,
                          color: Color(0xFF888780),
                        ),
                      ),
                      if (perSession != null)
                        Text(
                          '$perSession EGP each',
                          style: TextStyle(fontSize: 9, color: svc.accent),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            // Featured badge
            if (isFeatured && tag.isNotEmpty)
              Positioned(
                top: -1,
                right: 14,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(10, 3, 10, 3),
                  decoration: BoxDecoration(
                    color: svc.accent,
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(8),
                      bottomRight: Radius.circular(8),
                    ),
                  ),
                  child: Text(
                    tag,
                    style: const TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w500,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
