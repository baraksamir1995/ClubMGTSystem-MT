import 'package:flutter_test/flutter_test.dart';

import 'package:coachesapp/models/coach_profile.dart';

void main() {
  test('CoachProfile.fromJson parses a wrapped data envelope', () {
    final p = CoachProfile.fromJson({
      'data': {
        'id': '42',
        'email': 'coach@example.com',
        'full_name': 'Jordan Coach',
        'role': 'trainer',
        'gym_id': 'gym-1',
      },
    });
    expect(p.id, '42');
    expect(p.email, 'coach@example.com');
    expect(p.displayName, 'Jordan Coach');
    expect(p.role, 'trainer');
    expect(p.gymId, 'gym-1');
  });

  test('CoachProfile.displayName falls back to email', () {
    final p = CoachProfile.fromJson({'id': '1', 'email': 'c@x.com'});
    expect(p.displayName, 'c@x.com');
  });
}
