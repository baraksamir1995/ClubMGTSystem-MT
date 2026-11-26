import 'package:flutter_test/flutter_test.dart';
import 'package:clby/models/event_model.dart';
import 'package:clby/models/product_model.dart';

void main() {
  group('Product', () {
    test('without variants, untracked stock', () {
      final p = Product.fromJson({
        'id': 'p1',
        'name': 'Shaker',
        'description': null,
        'image_url': null,
        'before_price': null,
        'price': 120.0,
        'currency': 'EGP',
        'stock': null,
        'is_active': true,
        'display_order': 0,
        'variants': [],
      });
      expect(p.hasVariants, isFalse);
      expect(p.stock, isNull);
      expect(p.isOutOfStock, isFalse);
      expect(p.hasDiscount, isFalse);
      expect(p.displayPrice, 120.0);
      expect(p.hasPriceRange, isFalse);
    });

    test('without variants, tracked stock 0 is out of stock; string numbers parse', () {
      final p = Product.fromJson({
        'id': 'p2',
        'name': 'Towel',
        'before_price': '350',
        'price': '300.00',
        'stock': 0,
      });
      expect(p.price, 300.0);
      expect(p.beforePrice, 350.0);
      expect(p.hasDiscount, isTrue);
      expect(p.isOutOfStock, isTrue);
      expect(p.currency, 'EGP'); // defaulted
    });

    test('with variants: availability + price come from variants', () {
      final p = Product.fromJson({
        'id': 'p3',
        'name': 'Club Tee',
        'price': 300,
        'stock': 12, // ignored when variants exist
        'variants': [
          {'id': 'vL', 'name': 'L', 'price': 320, 'stock': 0, 'display_order': 1},
          {'id': 'vM', 'name': 'M', 'price': 300, 'stock': 2, 'display_order': 0},
          {'id': 'vX', 'name': 'XL', 'price': 340, 'stock': 5, 'is_active': false},
        ],
      });
      expect(p.hasVariants, isTrue);
      expect(p.variants.map((v) => v.name), ['M', 'L']); // sorted, inactive dropped
      expect(p.variants.last.isOutOfStock, isTrue);
      expect(p.isOutOfStock, isFalse);
      expect(p.displayPrice, 300);
      expect(p.hasPriceRange, isTrue);
    });

    test('all variants sold out → product out of stock; null variant stock = unlimited', () {
      final soldOut = Product.fromJson({
        'id': 'p4',
        'name': 'Cap',
        'price': 100,
        'variants': [
          {'id': 'a', 'name': 'Red', 'price': 100, 'stock': 0},
        ],
      });
      expect(soldOut.isOutOfStock, isTrue);

      final unlimited = Product.fromJson({
        'id': 'p5',
        'name': 'Cap',
        'price': 100,
        'variants': [
          {'id': 'a', 'name': 'Red', 'price': 100, 'stock': null},
        ],
      });
      expect(unlimited.variants.single.stock, isNull);
      expect(unlimited.isOutOfStock, isFalse);
    });

    test('ProductPage parses a Laravel paginator', () {
      final page = ProductPage.fromJson({
        'current_page': 1,
        'last_page': 3,
        'total': 45,
        'data': [
          {'id': 'p1', 'name': 'A', 'price': 1},
          {'id': 'p2', 'name': 'B', 'price': 2},
        ],
      });
      expect(page.items.length, 2);
      expect(page.hasMore, isTrue);
      expect(page.total, 45);
      expect(ProductPage.fromJson(null).items, isEmpty);
    });
  });

  group('GymEvent', () {
    test('free event, no registration, unlimited seats', () {
      final e = GymEvent.fromJson({
        'id': 'e1',
        'title': 'Open Day',
        'starts_at': '2030-01-10T10:00:00.000000Z',
        'ends_at': null,
        'registration_deadline': null,
        'capacity': null,
        'is_paid': false,
        'price_cents': null,
        'currency': 'EGP',
        'configuration_label': 'Level',
        'configurations': [
          {'id': 'c1', 'name': 'Beginner'},
          {'id': 'c2', 'name': 'Advanced'},
        ],
        'seats_left': null,
        'my_registration': null,
      });
      expect(e.isPaid, isFalse);
      expect(e.price, 0);
      expect(e.startsAt, isNotNull);
      expect(e.seatsLeft, isNull);
      expect(e.isFull, isFalse);
      expect(e.requiresConfiguration, isTrue);
      expect(e.configurations.map((c) => c.name), ['Beginner', 'Advanced']);
      expect(e.myRegistration, isNull);
      expect(e.isRegistered, isFalse);
    });

    test('paid event with pending registration, full', () {
      final e = GymEvent.fromJson({
        'id': 'e2',
        'title': 'Workshop',
        'starts_at': '2030-01-10T10:00:00Z',
        'capacity': 10,
        'is_paid': 1,
        'price_cents': 15000,
        'currency': 'EGP',
        'configurations': [],
        'seats_left': 0,
        'my_registration': {
          'id': 'r1',
          'status': 'pending_payment',
          'payment_status': 'unpaid',
          'configuration_name': null,
        },
      });
      expect(e.isPaid, isTrue);
      expect(e.price, 150.0);
      expect(e.isFull, isTrue);
      expect(e.requiresConfiguration, isFalse);
      expect(e.isRegistered, isTrue);
      expect(e.myRegistration!.isPendingPayment, isTrue);
      expect(e.myRegistration!.canCancel, isTrue);
    });

    test('parses Postgres-style timestamps from the API', () {
      final e = GymEvent.fromJson({
        'id': 'e3',
        'title': 'Open Day',
        'starts_at': '2026-12-20 12:00:00+02',
      });
      expect(e.startsAt, isNotNull);
      expect(e.startsAt!.toUtc(), DateTime.utc(2026, 12, 20, 10));
    });

    test('paid confirmed registration cannot be self-cancelled', () {
      final r = MyEventRegistration.fromJson({
        'id': 'r2',
        'status': 'confirmed',
        'payment_status': 'paid',
        'configuration_name': 'Advanced',
      });
      expect(r.isConfirmed, isTrue);
      expect(r.isPaid, isTrue);
      expect(r.canCancel, isFalse);
      expect(r.configurationName, 'Advanced');
    });

    test('my registrations row', () {
      final r = EventRegistrationSummary.fromJson({
        'id': 'r3',
        'event_id': 'e1',
        'status': 'confirmed',
        'payment_status': 'na',
        'attended': false,
        'configuration_name': 'Beginner',
        'title': 'Open Day',
        'starts_at': '2000-01-01T10:00:00Z',
        'ends_at': null,
        'location': 'Main hall',
        'image_url': null,
      });
      expect(r.eventId, 'e1');
      expect(r.isPast, isTrue);
      expect(r.canCancel, isFalse); // past
    });
  });
}
