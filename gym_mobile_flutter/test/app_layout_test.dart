import 'package:flutter_test/flutter_test.dart';
import 'package:clby/models/app_layout.dart';

void main() {
  test('null / malformed falls back to defaults', () {
    expect(AppLayout.fromJson(null).home, AppLayout.homeKeys);
    expect(AppLayout.fromJson('x').explore, AppLayout.exploreKeys);
  });

  test('respects order, drops hidden and unknown keys, appends missing', () {
    final l = AppLayout.fromJson({
      'home': [
        {'key': 'activity', 'visible': true},
        {'key': 'banners', 'visible': false},
        {'key': 'from_the_future', 'visible': true},
        {'key': 'activity', 'visible': false},
      ],
    });
    expect(l.home.first, 'activity');
    expect(l.home, isNot(contains('banners')));
    expect(l.home, isNot(contains('from_the_future')));
    expect(l.home.where((k) => k == 'activity').length, 1);
    expect(l.home.sublist(1), ['membership', 'todays_classes', 'quick_access', 'locations']);
    expect(l.explore, AppLayout.exploreKeys);
  });
}
