import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../models/trainer_profile_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';

class TrainerDetailScreen extends StatefulWidget {
  final TrainerProfile trainer;

  const TrainerDetailScreen({super.key, required this.trainer});

  @override
  State<TrainerDetailScreen> createState() => _TrainerDetailScreenState();
}

class _TrainerDetailScreenState extends State<TrainerDetailScreen> {
  bool _loading = true;
  bool _reviewsLoading = false;
  TrainerProfile? _trainer; // may be enriched with avg rating
  List<Map<String, dynamic>> _sessions = [];
  List<Map<String, dynamic>> _reviews = [];
  bool _showAllReviews = false;
  static const int _reviewLimit = 5;

  @override
  void initState() {
    super.initState();
    _trainer = widget.trainer;
    _load();
  }

  Future<void> _reloadReviews() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) return;
    setState(() => _reviewsLoading = true);
    final reviews = await ApiService()
        .getTrainerReviews(widget.trainer.id, widget.trainer.name, gymId);
    if (mounted) {
      setState(() {
        _reviews = reviews;
        _reviewsLoading = false;
      });
    }
  }

  Future<void> _load() async {
    final gymId = context.read<AuthProvider>().profile?.gymId;
    if (gymId == null) {
      setState(() => _loading = false);
      return;
    }

    final isPersonalTrainer = widget.trainer.trainerType == 'personal_trainer';

    final results = await Future.wait([
      ApiService().getTrainerReviews(
          widget.trainer.id, widget.trainer.name, gymId),
      if (isPersonalTrainer)
        ApiService().getTrainerUpcomingSessions(
            widget.trainer.id, widget.trainer.name, gymId),
      // Also load full profile (enriches avg rating)
      ApiService().getTrainerFullProfile(widget.trainer.id, gymId),
    ]);

    if (!mounted) return;
    setState(() {
      _reviews = results[0] as List<Map<String, dynamic>>;
      if (isPersonalTrainer && results.length > 2) {
        _sessions = results[1] as List<Map<String, dynamic>>;
        final full = results[2] as TrainerProfile?;
        if (full != null) _trainer = full;
      } else {
        final full = results[1] as TrainerProfile?;
        if (full != null) _trainer = full;
      }
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final trainer = _trainer ?? widget.trainer;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFF5F5F0),
        body: RefreshIndicator(
              onRefresh: _reloadReviews,
              child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _TrainerHero(trainer: trainer),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Specialties
                        if (trainer.specialisations.isNotEmpty) ...[
                          const _SectionLabel('SPECIALTIES'),
                          const SizedBox(height: 10),
                          _SpecialtiesStrip(
                              specialisations: trainer.specialisations),
                          const SizedBox(height: 22),
                        ],

                        // About
                        if (trainer.bio != null &&
                            trainer.bio!.trim().isNotEmpty) ...[
                          const _SectionLabel('ABOUT'),
                          const SizedBox(height: 10),
                          _AboutCard(bio: trainer.bio!),
                          const SizedBox(height: 22),
                        ],

                        // Classes (personal trainer only)
                        if (trainer.trainerType == 'personal_trainer' &&
                            !_loading &&
                            _sessions.isNotEmpty) ...[
                          const _SectionLabel('CLASSES'),
                          const SizedBox(height: 10),
                          _ClassesStrip(sessions: _sessions),
                          const SizedBox(height: 22),
                        ],

                        // Reviews
                        const _SectionLabel('REVIEWS'),
                        const SizedBox(height: 10),
                        if (_loading || _reviewsLoading)
                          ..._skeletonReviews()
                        else if (_reviews.isEmpty)
                          _EmptyReviews()
                        else ...[
                          ...(_showAllReviews
                                  ? _reviews
                                  : _reviews.take(_reviewLimit))
                              .map((r) => _ReviewCard(data: r))
                              .toList(),
                          if (_reviews.length > _reviewLimit &&
                              !_showAllReviews)
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(vertical: 8),
                              child: SizedBox(
                                width: double.infinity,
                                child: OutlinedButton(
                                  onPressed: () =>
                                      setState(() => _showAllReviews = true),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(
                                        color: Colors.white24, width: 1),
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(12)),
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 14),
                                  ),
                                  child: Text(
                                    'Show All Reviews (${_reviews.length})',
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
        ),
      ),
    );
  }

  List<Widget> _skeletonReviews() {
    return List.generate(
      2,
      (_) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        height: 90,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
      ),
    );
  }
}

// ─── Hero ──────────────────────────────────────────────────────────────────────

class _TrainerHero extends StatelessWidget {
  final TrainerProfile trainer;

  const _TrainerHero({required this.trainer});

  @override
  Widget build(BuildContext context) {
    // Badge + gradient per type
    final Color badgeColor;
    switch (trainer.trainerType) {
      case 'nutritionist':
        badgeColor = const Color(0xFF0D6E5E);
        break;
      case 'physiotherapist':
        badgeColor = const Color(0xFF1E3A8A);
        break;
      default:
        badgeColor = const Color(0xFF4C1D95);
    }

    const gradientColors = [Color(0xFF1A1A2E), Color(0xFF2D2D3F)];

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        bottomLeft: Radius.circular(28),
        bottomRight: Radius.circular(28),
      ),
      child: SizedBox(
        height: 260,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background: photo or gradient
            if (trainer.photoUrl != null && trainer.photoUrl!.isNotEmpty)
              Image.network(
                trainer.photoUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: gradientColors,
                    ),
                  ),
                ),
              )
            else
              Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: gradientColors,
                  ),
                ),
              ),

            // Dark overlay for readability
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.3),
                    Colors.black.withValues(alpha: 0.72),
                  ],
                ),
              ),
            ),

            SafeArea(
              bottom: false,
              child: Stack(
                children: [
                  // Back button
                  Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 8),
                    child: _CircleButton(
                      icon: Icons.arrow_back_ios_new_rounded,
                      onTap: () => Navigator.of(context).pop(),
                    ),
                  ),

                  // Bottom: badge + name + stars
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 24,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Type badge
                        Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 5),
                          decoration: BoxDecoration(
                            color: badgeColor.withValues(alpha: 0.9),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            trainer.displayType,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),

                        // Name
                        Text(
                          trainer.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            height: 1.1,
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Rating
                        if (trainer.avgRating != null)
                          _HeroRatingRow(rating: trainer.avgRating!),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroRatingRow extends StatelessWidget {
  final double rating;

  const _HeroRatingRow({required this.rating});

  @override
  Widget build(BuildContext context) {
    final filled = rating.round().clamp(0, 5);
    return Row(
      children: [
        ...List.generate(
          5,
          (i) => Icon(
            i < filled ? Icons.star_rounded : Icons.star_outline_rounded,
            size: 16,
            color: i < filled
                ? const Color(0xFFFBBF24)
                : Colors.white.withValues(alpha: 0.4),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          rating.toStringAsFixed(1),
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}

// ─── Circle back button ────────────────────────────────────────────────────────

class _CircleButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _CircleButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.18),
          shape: BoxShape.circle,
        ),
        child: Icon(icon, size: 17, color: Colors.white),
      ),
    );
  }
}

// ─── Section label ─────────────────────────────────────────────────────────────

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
            letterSpacing: 1.2,
          ),
    );
  }
}

// ─── Specialties strip ────────────────────────────────────────────────────────

class _SpecialtiesStrip extends StatelessWidget {
  final List<String> specialisations;

  const _SpecialtiesStrip({required this.specialisations});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: specialisations.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => _SpecialtyChip(label: specialisations[i]),
      ),
    );
  }
}

class _SpecialtyChip extends StatelessWidget {
  final String label;

  const _SpecialtyChip({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.25),
        ),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w500,
            ),
      ),
    );
  }
}

// ─── About card ───────────────────────────────────────────────────────────────

class _AboutCard extends StatelessWidget {
  final String bio;

  const _AboutCard({required this.bio});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color:
              Theme.of(context).colorScheme.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Text(
        bio,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.6,
            ),
      ),
    );
  }
}

// ─── Classes strip ────────────────────────────────────────────────────────────

class _ClassesStrip extends StatelessWidget {
  final List<Map<String, dynamic>> sessions;

  const _ClassesStrip({required this.sessions});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 90,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: sessions.length,
        separatorBuilder: (_, __) => const SizedBox(width: 10),
        itemBuilder: (_, i) => _ClassTile(session: sessions[i]),
      ),
    );
  }
}

class _ClassTile extends StatelessWidget {
  final Map<String, dynamic> session;

  const _ClassTile({required this.session});

  @override
  Widget build(BuildContext context) {
    final classInfo = session['classes'] as Map<String, dynamic>?;
    final name = classInfo?['name'] as String? ?? 'Class';
    final rawColor = classInfo?['color'] as String? ?? '#6b7280';
    final color = _hexColor(rawColor);
    final timeStr =
        (session['start_time'] as String?)?.substring(0, 5) ?? '';
    final imageUrl = classInfo?['image_url'] as String?;

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: 110,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Background: image or color tint
            if (imageUrl != null && imageUrl.isNotEmpty)
              Image.network(
                imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: color.withValues(alpha: 0.15),
                ),
              )
            else
              Container(color: color.withValues(alpha: 0.15)),

            // Dark gradient overlay
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.65),
                  ],
                ),
              ),
            ),

            // Text at bottom
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Text(
                    name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      height: 1.2,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    timeStr,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _hexColor(String hex) {
    final buffer = StringBuffer();
    if (hex.length == 6 || hex.length == 7) buffer.write('ff');
    buffer.write(hex.replaceFirst('#', ''));
    return Color(int.tryParse(buffer.toString(), radix: 16) ?? 0xFF6b7280);
  }
}

// ─── Review card ──────────────────────────────────────────────────────────────

class _ReviewCard extends StatelessWidget {
  final Map<String, dynamic> data;

  const _ReviewCard({required this.data});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final memberName = data['member_name'] as String? ?? 'Member';
    // Prefer trainer-specific rating; fall back to session rating
    final trainerRating = (data['trainer_rating'] as num?)?.toInt()
        ?? (data['session_rating'] as num?)?.toInt()
        ?? 0;
    final review = data['review'] as String? ?? '';
    final createdAt = data['created_at'] as String?;
    final dateStr = createdAt != null
        ? DateFormat('MMM d').format(DateTime.parse(createdAt))
        : '';

    final initials = memberName
        .trim()
        .split(' ')
        .take(2)
        .map((w) => w.isNotEmpty ? w[0].toUpperCase() : '')
        .join();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: theme.colorScheme.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: theme.colorScheme.primaryContainer,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                initials,
                style: TextStyle(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),

          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Name + date + stars
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        memberName,
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    // Stars
                    Row(
                      children: List.generate(
                        5,
                        (i) => Icon(
                          i < trainerRating
                              ? Icons.star_rounded
                              : Icons.star_outline_rounded,
                          size: 13,
                          color: i < trainerRating
                              ? const Color(0xFFFBBF24)
                              : Colors.grey.shade400,
                        ),
                      ),
                    ),
                  ],
                ),
                Text(
                  dateStr,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                if (review.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    review,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      height: 1.5,
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

// ─── Empty reviews ────────────────────────────────────────────────────────────

class _EmptyReviews extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.1),
        ),
      ),
      child: Column(
        children: [
          Icon(Icons.star_outline_rounded,
              size: 32, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(
            'No reviews yet',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
          ),
        ],
      ),
    );
  }
}

