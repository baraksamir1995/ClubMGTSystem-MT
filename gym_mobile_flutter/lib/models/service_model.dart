import 'package:flutter/material.dart';

class ServiceModel {
  final String id;
  final String name;
  final String short;
  final String trainerType;
  final String iconType; // 'pt' | 'physio' | 'nutrition'
  final Color accent;
  final Color accentLight;
  final Color accentDark;

  const ServiceModel({
    required this.id,
    required this.name,
    required this.short,
    required this.trainerType,
    required this.iconType,
    required this.accent,
    required this.accentLight,
    required this.accentDark,
  });
}

const List<ServiceModel> kServices = [
  ServiceModel(
    id: 'pt',
    name: 'Personal training',
    short: 'PT sessions',
    trainerType: 'personal_trainer',
    iconType: 'pt',
    accent: Color(0xFF534AB7),
    accentLight: Color(0xFFEEEDFB),
    accentDark: Color(0xFF3B34A0),
  ),
  ServiceModel(
    id: 'physio',
    name: 'Physiotherapy',
    short: 'Physio sessions',
    trainerType: 'physiotherapist',
    iconType: 'physio',
    accent: Color(0xFF4A7FD4),
    accentLight: Color(0xFFEAF1FB),
    accentDark: Color(0xFF2E5CA8),
  ),
  ServiceModel(
    id: 'nutrition',
    name: 'Nutrition',
    short: 'Nutrition sessions',
    trainerType: 'nutritionist',
    iconType: 'nutrition',
    accent: Color(0xFF3DAA72),
    accentLight: Color(0xFFE8F7F0),
    accentDark: Color(0xFF257A52),
  ),
];
