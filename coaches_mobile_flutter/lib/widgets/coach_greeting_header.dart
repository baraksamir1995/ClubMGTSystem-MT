import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/constants/app_colors.dart';
import '../core/constants/app_text.dart';
import '../features/coach/coach_app_state.dart';
import '../providers/auth_provider.dart';
import '../providers/branding_provider.dart';
import 'frosted_header_shell.dart';
import 'gym_logo_tile.dart';

/// Home-tab header: time-of-day greeting + coach name on the left, the
/// gym's logo (from the dashboard branding, via [BrandingProvider]) on the
/// right. Shares [FrostedHeaderShell] with [ClbyAppBar] so the shell stays
/// visually consistent.
///
/// Watches are NARROW (`context.select` on the rendered strings only): the
/// root of this widget is a BackdropFilter, and re-rastering the blur on
/// every roster/scan notification from CoachAppState would drop frames for
/// pixels that never change.
class CoachGreetingHeader extends StatelessWidget {
  const CoachGreetingHeader({super.key});

  static String _greeting(DateTime now) {
    if (now.hour < 12) return 'GOOD MORNING';
    if (now.hour < 18) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  }

  @override
  Widget build(BuildContext context) {
    // Coach identity loads with the roster; fall back to the auth profile
    // so the name shows even while CoachAppState is still fetching.
    final identityName =
        context.select<CoachAppState, String?>((s) => s.identity?.name);
    final profileName =
        context.select<AuthProvider, String?>((a) => a.profile?.displayName);
    final name = (identityName != null && identityName.trim().isNotEmpty)
        ? identityName
        : (profileName ?? '');
    // First name keeps the greeting on one line for long full names.
    final firstName = name.trim().split(RegExp(r'\s+')).first;

    final branding =
        context.select<BrandingProvider, GymBranding?>((b) => b.branding);

    return FrostedHeaderShell(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '${_greeting(DateTime.now())},',
                  style: AppText.mono(
                    size: 10,
                    letterSpacing: 2,
                    color: AppColors.primary,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  firstName.isEmpty ? 'COACH' : firstName.toUpperCase(),
                  style: AppText.disp(
                    size: 26,
                    letterSpacing: 1.2,
                    color: AppColors.text,
                    height: 1,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          GymLogoTile(size: 42, branding: branding),
        ],
      ),
    );
  }
}
