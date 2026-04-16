import 'package:flutter/material.dart';
import '../../core/config/app_config.dart';
import '../../services/api_service.dart';
import '../../utils/error_utils.dart';

class GuestTrainersScreen extends StatefulWidget {
  const GuestTrainersScreen({super.key});

  @override
  State<GuestTrainersScreen> createState() => _GuestTrainersScreenState();
}

class _GuestTrainersScreenState extends State<GuestTrainersScreen> {
  List<Map<String, dynamic>> _trainers = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadTrainers();
  }

  Future<void> _loadTrainers() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final trainers = await ApiService().getTrainersListing(AppConfig.gymId);
      setState(() => _trainers = trainers);
    } catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = Theme.of(context).colorScheme.primary;

    return Scaffold(
      body: RefreshIndicator(
        onRefresh: _loadTrainers,
        color: primary,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)))
                : _trainers.isEmpty
                    ? const Center(child: Text('No trainers available'))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _trainers.length,
                        itemBuilder: (context, index) {
                          final t = _trainers[index];
                          return _TrainerCard(trainer: t, primary: primary);
                        },
                      ),
      ),
    );
  }
}

class _TrainerCard extends StatelessWidget {
  final Map<String, dynamic> trainer;
  final Color primary;

  const _TrainerCard({required this.trainer, required this.primary});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final specialties = (trainer['specialties'] as List<dynamic>?) ?? [];
    final photoUrl = trainer['photo_url'] as String?;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Avatar
            CircleAvatar(
              radius: 32,
              backgroundColor: primary.withValues(alpha: 0.12),
              backgroundImage: photoUrl != null ? NetworkImage(photoUrl) : null,
              child: photoUrl == null
                  ? Icon(Icons.person, color: primary, size: 32)
                  : null,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(trainer['full_name'] ?? '',
                      style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                  if (trainer['title'] != null)
                    Text(trainer['title'],
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: primary, fontWeight: FontWeight.w600)),
                  if (trainer['bio'] != null) ...[
                    const SizedBox(height: 6),
                    Text(trainer['bio'],
                        style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis),
                  ],
                  if (specialties.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: specialties.map((s) => Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(s.toString(),
                            style: theme.textTheme.labelSmall?.copyWith(
                                color: primary, fontWeight: FontWeight.w600)),
                      )).toList(),
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
