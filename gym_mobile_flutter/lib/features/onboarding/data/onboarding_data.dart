import 'package:flutter/material.dart';

/// One slide in the onboarding flow.
///
/// `kind` selects the bespoke illustration when no `imageUrl` is provided.
/// White-label gyms can override slides remotely with their own images.
enum OnboardingKind { attend, share, manage }

class OnboardingItem {
  final String title;
  final String description;
  final OnboardingKind kind;
  final IconData icon;
  final String? imageUrl; // remote override from gym dashboard
  final int sortOrder;

  const OnboardingItem({
    required this.title,
    required this.description,
    required this.icon,
    this.kind = OnboardingKind.attend,
    this.imageUrl,
    this.sortOrder = 0,
  });
}

const List<OnboardingItem> defaultOnboardingItems = [
  OnboardingItem(
    title: 'Skip the front desk',
    description:
        'Scan one QR code at the entrance and your check-in is logged automatically — every visit, every class.',
    kind: OnboardingKind.attend,
    icon: Icons.qr_code_scanner_rounded,
    sortOrder: 0,
  ),
  OnboardingItem(
    title: 'Share sessions with friends',
    description:
        'Got a guest pass or extra sessions? Send them to anyone in seconds. They show up in their balance instantly.',
    kind: OnboardingKind.share,
    icon: Icons.swap_horiz_rounded,
    sortOrder: 1,
  ),
  OnboardingItem(
    title: 'Your membership, in your pocket',
    description:
        'See your plan, member number, renewal date and remaining sessions at a glance. No more lost membership cards.',
    kind: OnboardingKind.manage,
    icon: Icons.badge_outlined,
    sortOrder: 2,
  ),
];
