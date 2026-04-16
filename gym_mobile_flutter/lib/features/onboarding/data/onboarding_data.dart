import 'package:flutter/material.dart';

class OnboardingItem {
  final String title;
  final String description;
  final IconData icon;
  final String? imageUrl; // Remote image from gym dashboard (overrides icon)
  final int sortOrder;

  const OnboardingItem({
    required this.title,
    required this.description,
    required this.icon,
    this.imageUrl,
    this.sortOrder = 0,
  });
}

/// Default onboarding slides — used when the gym hasn't configured custom ones.
const List<OnboardingItem> defaultOnboardingItems = [
  OnboardingItem(
    title: 'Access Your Gym,\nYour Way',
    description:
        'View your membership, check attendance, and stay on top of your fitness journey.',
    icon: Icons.fitness_center_rounded,
    sortOrder: 0,
  ),
  OnboardingItem(
    title: 'Book Classes\nin Seconds',
    description:
        'Reserve your spot in classes, sessions, and activities anytime, anywhere.',
    icon: Icons.calendar_month_rounded,
    sortOrder: 1,
  ),
  OnboardingItem(
    title: 'Track Your\nProgress',
    description:
        'Monitor your activity, attendance, and performance to stay motivated.',
    icon: Icons.trending_up_rounded,
    sortOrder: 2,
  ),
];
