import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../../models/membership_model.dart';
import '../../../providers/auth_provider.dart';

enum _CardState { normal, warning, exhausted }

/// Membership card for Duration + Sessions plans.
/// Shows time progress (gym access) + session consumption separately.
/// States:
///   normal    — days > 14 AND sessions > threshold
///   warning   — days ≤ 14 OR sessions running low
///   exhausted — sessions = 0 but plan still active by date
class DurationSessionPlanCard extends StatelessWidget {
  final MemberMembership membership;

  const DurationSessionPlanCard({super.key, required this.membership});

  static const _cardBg          = Color(0xFF0D0D1A);
  static const _divider         = Color(0xFF1E1E30);
  static const _dimText         = Color(0xFF4A4A6A);
  static const _midText         = Color(0xFF8A8AAA);
  static const _sectionLbl      = Color(0xFF5A5A7A);
  static const _barBg           = Color(0xFF2A2A40);
  // _sessionActive is resolved dynamically via Theme in build()
  static const _sessionWarning  = Color(0xFFDC2626);
  static const _sessionGray     = Color(0xFF4A4A6A);
  static const _timeActive      = Color(0xFF4F46E5);
  static const _timeWarning     = Color(0xFFDC2626);
  static const _green           = Color(0xFF34D399);
  static const _amber           = Color(0xFFD97706);

  _CardState get _state {
    final remaining = membership.sessionsRemaining ?? 0;
    final total     = membership.sessionCount ?? 0;
    final daysLeft  = membership.endDate != null
        ? membership.endDate!.difference(DateTime.now()).inDays
        : null;

    if (remaining <= 0) return _CardState.exhausted;
    final lowSessions = total > 0 && remaining <= max(3, (total * 0.15).round());
    if ((daysLeft != null && daysLeft <= 14) || lowSessions) return _CardState.warning;
    return _CardState.normal;
  }

  @override
  Widget build(BuildContext context) {
    final paymentsEnabled = context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true;
    final state   = _state;
    final now     = DateTime.now();
    final start   = membership.startDate;
    final end     = membership.endDate;
    final total   = membership.sessionCount ?? 0;
    final used    = membership.sessionsUsed ?? 0;
    final remaining = membership.sessionsRemaining ?? 0;

    final daysLeft   = end != null ? end.difference(now).inDays.clamp(0, 99999) : null;
    final totalDays  = (start != null && end != null) ? end.difference(start).inDays : null;
    final daysElapsed = start != null ? now.difference(start).inDays : null;

    final timeProgress = (totalDays != null && totalDays > 0 && daysElapsed != null)
        ? (daysElapsed / totalDays).clamp(0.0, 1.0)
        : 0.0;
    final timeUsedPct = totalDays != null && totalDays > 0 && daysElapsed != null
        ? ((daysElapsed / totalDays) * 100).round()
        : 0;

    final sessionProgress = total > 0 ? (used / total).clamp(0.0, 1.0) : 0.0;
    final sessionUsedPct  = total > 0 ? ((used / total) * 100).round() : 0;

    final themeSessionActive = Theme.of(context).colorScheme.primary;
    final sessionCircleColor = state == _CardState.exhausted ? _sessionGray
        : state == _CardState.warning ? _sessionWarning
        : themeSessionActive;
    final sessionBarColor = sessionCircleColor;
    final timeBarColor = state == _CardState.warning ? _timeWarning : _timeActive;

    final isFrozen = membership.isFrozen;
    final statusLabel = isFrozen ? '❄ Frozen'
        : state == _CardState.warning ? 'Expiring soon'
        : 'Active';
    final statusBg = isFrozen ? const Color(0xFF1E40AF)
        : state == _CardState.warning ? _amber
        : const Color(0xFF1D9E75);

    final subtitle = state == _CardState.exhausted
        ? 'Sessions exhausted — gym access still running'
        : state == _CardState.warning
            ? 'Expiring soon — sessions running low'
            : 'Active — $used of $total sessions used';
    final subtitleColor = state == _CardState.warning ? _amber : _sectionLbl;

    String? sessionHint;
    if (state != _CardState.exhausted && daysLeft != null && daysLeft > 0 && remaining > 0) {
      final rate = remaining / daysLeft;
      sessionHint = state == _CardState.warning
          ? 'Use ${rate.ceil()} session${rate.ceil() != 1 ? 's' : ''}/day before expiry'
          : '~${rate.toStringAsFixed(1)} sessions/day to use all by expiry';
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Subtitle ────────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Text(
            subtitle,
            style: TextStyle(
              color: subtitleColor,
              fontSize: 11,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),

        // ── Card ─────────────────────────────────────────────────────────
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: _cardBg,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ── Main content ──────────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Plan name + badge
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            membership.planName ?? 'Membership',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                              height: 1.2,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusBg,
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Text(
                            statusLabel,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 8),

                    // Pills
                    Row(
                      children: [
                        _Pill(
                          icon: Icons.fitness_center_rounded,
                          label: 'Gym access',
                          bg: const Color(0xFF1D3A2A),
                          fg: _green,
                        ),
                        const SizedBox(width: 8),
                        _Pill(
                          icon: Icons.timer_outlined,
                          label: state == _CardState.exhausted
                              ? 'All $total sessions used'
                              : '$total sessions included',
                          bg: state == _CardState.exhausted
                              ? const Color(0xFF1E1E30)
                              : const Color(0xFF2A1F4A),
                          fg: state == _CardState.exhausted
                              ? _sectionLbl
                              : const Color(0xFFAFA9EC),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // Stats row
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _StatCol(
                          label: 'Days left',
                          value: daysLeft?.toString() ?? '—',
                          sub: totalDays != null ? 'of $totalDays days' : null,
                          valueFontSize: 26,
                        ),
                        const Spacer(),
                        _StatCol(
                          label: 'Expires',
                          value: end != null ? DateFormat('MMM d').format(end) : '—',
                          sub: end != null ? DateFormat('yyyy').format(end) : null,
                          align: CrossAxisAlignment.center,
                        ),
                        const Spacer(),
                        _StatCol(
                          label: 'Sessions left',
                          value: '$remaining',
                          sub: 'of $total',
                          align: CrossAxisAlignment.end,
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // GYM ACCESS
                    _SectionLabel(label: 'GYM ACCESS'),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: timeProgress,
                        minHeight: 5,
                        backgroundColor: _barBg,
                        valueColor: AlwaysStoppedAnimation<Color>(timeBarColor),
                      ),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Day 1', style: TextStyle(color: _dimText, fontSize: 10)),
                        Text(
                          '$timeUsedPct% used · ${daysLeft ?? 0} days left',
                          style: const TextStyle(color: _midText, fontSize: 10, fontWeight: FontWeight.w500),
                        ),
                        Text(
                          totalDays != null ? 'Day $totalDays' : '',
                          style: const TextStyle(color: _dimText, fontSize: 10),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),

                    // INCLUDED SESSIONS
                    _SectionLabel(label: 'INCLUDED SESSIONS'),
                    const SizedBox(height: 10),

                    Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Sessions circle
                        Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: sessionCircleColor.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: sessionCircleColor.withValues(alpha: 0.35),
                              width: 1.5,
                            ),
                          ),
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  '$remaining',
                                  style: TextStyle(
                                    color: state == _CardState.exhausted
                                        ? _sectionLbl
                                        : Colors.white,
                                    fontSize: 18,
                                    fontWeight: FontWeight.w700,
                                    height: 1,
                                  ),
                                ),
                                const Text(
                                  'remaining',
                                  style: TextStyle(color: _sectionLbl, fontSize: 7),
                                ),
                              ],
                            ),
                          ),
                        ),

                        const SizedBox(width: 12),

                        // Progress + legend
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    state == _CardState.exhausted
                                        ? '$total of $total used'
                                        : '$used used · $remaining left',
                                    style: const TextStyle(color: _midText, fontSize: 10, fontWeight: FontWeight.w500),
                                  ),
                                  Text(
                                    '$sessionUsedPct%',
                                    style: const TextStyle(color: _midText, fontSize: 10, fontWeight: FontWeight.w500),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 5),
                              ClipRRect(
                                borderRadius: BorderRadius.circular(4),
                                child: LinearProgressIndicator(
                                  value: sessionProgress,
                                  minHeight: 5,
                                  backgroundColor: _barBg,
                                  valueColor: AlwaysStoppedAnimation<Color>(sessionBarColor),
                                ),
                              ),
                              const SizedBox(height: 6),
                              if (state != _CardState.exhausted) ...[
                                Row(
                                  children: [
                                    _LegendDot(color: _green, label: '$used attended'),
                                    const SizedBox(width: 10),
                                    _LegendDot(color: sessionBarColor, label: '$remaining remaining'),
                                  ],
                                ),
                                if (sessionHint != null) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    sessionHint,
                                    style: TextStyle(
                                      color: state == _CardState.warning
                                          ? _sessionWarning
                                          : _sectionLbl,
                                      fontSize: 10,
                                    ),
                                  ),
                                ],
                              ] else
                                const Text(
                                  'All included sessions have been used',
                                  style: TextStyle(color: _sectionLbl, fontSize: 10),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 16),
                  ],
                ),
              ),

              // ── Bottom strip ─────────────────────────────────────────
              if (state == _CardState.warning && daysLeft != null) ...[
                Container(height: 1, color: _divider),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Plan + sessions expire in ${daysLeft}d',
                          style: const TextStyle(
                            color: _amber,
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      if (paymentsEnabled)
                        GestureDetector(
                          onTap: () {},
                          child: const Text(
                            'Renew now ›',
                            style: TextStyle(
                              color: _amber,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ] else if (state == _CardState.exhausted && paymentsEnabled) ...[
                Container(height: 1, color: _divider),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Need more sessions?',
                              style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                            ),
                            Text(
                              'Buy a top-up bundle — gym access unaffected',
                              style: TextStyle(color: _sectionLbl, fontSize: 10),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        onTap: () {},
                        child: Text(
                          'Add sessions ›',
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              // ── Footer ───────────────────────────────────────────────
              Container(height: 1, color: _divider),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('View full plan ›', style: TextStyle(color: _sectionLbl, fontSize: 11)),
                    Text(
                      state == _CardState.exhausted ? 'Gym access still active' : 'Tap FAB to check in',
                      style: const TextStyle(color: _sectionLbl, fontSize: 11),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ─── Sub-widgets ───────────────────────────────────────────────────────────────

class _Pill extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color bg;
  final Color fg;
  const _Pill({required this.icon, required this.label, required this.bg, required this.fg});

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(20)),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 10, color: fg),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.w600)),
          ],
        ),
      );
}

class _StatCol extends StatelessWidget {
  final String label;
  final String value;
  final String? sub;
  final CrossAxisAlignment align;
  final double valueFontSize;
  const _StatCol({
    required this.label,
    required this.value,
    this.sub,
    this.align = CrossAxisAlignment.start,
    this.valueFontSize = 18,
  });

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: align,
        children: [
          Text(label, style: const TextStyle(color: Color(0xFF5A5A7A), fontSize: 10)),
          const SizedBox(height: 2),
          Text(value, style: TextStyle(color: Colors.white, fontSize: valueFontSize, fontWeight: FontWeight.w700, height: 1)),
          if (sub != null) Text(sub!, style: const TextStyle(color: Color(0xFF5A5A7A), fontSize: 10)),
        ],
      );
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) => Row(
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF5A5A7A),
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(width: 8),
          const Expanded(child: Divider(color: Color(0xFF1E1E30), height: 1, thickness: 1)),
        ],
      );
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 4),
          Text(label, style: const TextStyle(color: Color(0xFF8A8AAA), fontSize: 9)),
        ],
      );
}
