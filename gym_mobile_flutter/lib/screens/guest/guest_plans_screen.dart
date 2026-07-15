import 'package:flutter/material.dart';
import 'package:clby/l10n/l10n.dart';
import '../../core/config/app_config.dart';
import '../../services/api_service.dart';
import '../../widgets/guest_register_prompt.dart';
import '../../utils/error_utils.dart';

class GuestPlansScreen extends StatefulWidget {
  const GuestPlansScreen({super.key});

  @override
  State<GuestPlansScreen> createState() => _GuestPlansScreenState();
}

class _GuestPlansScreenState extends State<GuestPlansScreen> {
  List<Map<String, dynamic>> _plans = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPlans();
  }

  Future<void> _loadPlans() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final plans = await ApiService().getMembershipPlansListing(AppConfig.gymId);
      setState(() => _plans = plans);
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
        onRefresh: _loadPlans,
        color: primary,
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)))
                : _plans.isEmpty
                    ? Center(child: Text(context.l10n.guestPlansEmpty))
                    : ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _plans.length,
                        itemBuilder: (context, index) {
                          final p = _plans[index];
                          return _PlanCard(
                            plan: p,
                            primary: primary,
                            onGetStarted: () => showGuestRegisterPrompt(context),
                          );
                        },
                      ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final Map<String, dynamic> plan;
  final Color primary;
  final VoidCallback onGetStarted;

  const _PlanCard({
    required this.plan,
    required this.primary,
    required this.onGetStarted,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final features = (plan['features'] as List<dynamic>?) ?? [];
    final facilities = (plan['facilities'] as List<dynamic>?) ?? [];
    final price = (plan['price'] as num?)?.toDouble() ?? 0.0;
    final billingCycle = plan['billing_cycle'] as String? ?? 'monthly';

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Plan name + price
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(plan['name'] ?? '',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                      if (plan['plan_type'] != null)
                        Text(_formatPlanType(context, plan['plan_type']),
                            style: theme.textTheme.bodySmall?.copyWith(
                                color: primary, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      context.l10n.guestPlansPriceAed(price.toStringAsFixed(0)),
                      style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w900, color: primary),
                    ),
                    Text(
                      context.l10n.guestPlansPerCycle(_formatBillingCycle(context, billingCycle)),
                      style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant),
                    ),
                  ],
                ),
              ],
            ),

            if (plan['description'] != null) ...[
              const SizedBox(height: 10),
              Text(plan['description'],
                  style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
            ],

            // Key details row
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                if ((plan['session_count'] as int?) != null)
                  _chip(theme, primary, Icons.event_available_outlined,
                      context.l10n.guestPlansSessionsCount(plan['session_count'] as int)),
                if ((plan['visits_per_week'] as int?) != null)
                  _chip(theme, primary, Icons.repeat_outlined,
                      context.l10n.guestPlansVisitsPerWeek(plan['visits_per_week'] as int)),
                if ((plan['visits_per_month'] as int?) != null)
                  _chip(theme, primary, Icons.calendar_month_outlined,
                      context.l10n.guestPlansVisitsPerMonth(plan['visits_per_month'] as int)),
                if ((plan['duration_months'] as int?) != null)
                  _chip(theme, primary, Icons.access_time_outlined,
                      context.l10n.guestPlansMonthsCount(plan['duration_months'] as int)),
              ],
            ),

            // Features
            if (features.isNotEmpty) ...[
              const SizedBox(height: 12),
              ...features.map((f) => Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline, size: 16, color: primary),
                        const SizedBox(width: 6),
                        Expanded(child: Text(f.toString(), style: theme.textTheme.bodySmall)),
                      ],
                    ),
                  )),
            ],

            // Facilities
            if (facilities.isNotEmpty) ...[
              const SizedBox(height: 10),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: facilities
                    .map((f) => Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: primary.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(f.toString(),
                              style: theme.textTheme.labelSmall?.copyWith(
                                  color: primary, fontWeight: FontWeight.w600)),
                        ))
                    .toList(),
              ),
            ],

            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              height: 44,
              child: ElevatedButton(
                onPressed: onGetStarted,
                style: ElevatedButton.styleFrom(
                  backgroundColor: primary,
                  foregroundColor: Colors.white,
                ),
                child: Text(context.l10n.guestPlansGetStarted,
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _chip(ThemeData theme, Color primary, IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: primary.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: primary),
          const SizedBox(width: 4),
          Text(label,
              style: theme.textTheme.labelSmall?.copyWith(
                  color: primary, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  String _formatPlanType(BuildContext context, String type) {
    switch (type) {
      case 'unlimited': return context.l10n.guestPlansTypeUnlimited;
      case 'limited': return context.l10n.guestPlansTypeLimited;
      case 'sessions': return context.l10n.guestPlansTypeSessions;
      case 'day_pass': return context.l10n.guestPlansTypeDayPass;
      default: return type.replaceAll('_', ' ').toUpperCase();
    }
  }

  String _formatBillingCycle(BuildContext context, String cycle) {
    switch (cycle) {
      case 'monthly': return context.l10n.guestPlansBillingMonthly;
      case 'yearly': return context.l10n.guestPlansBillingYearly;
      case 'weekly': return context.l10n.guestPlansBillingWeekly;
      default: return cycle;
    }
  }
}
