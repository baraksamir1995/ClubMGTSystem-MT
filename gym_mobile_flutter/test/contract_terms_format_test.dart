import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:clby/features/terms/contract_terms_screen.dart';
import 'package:clby/features/terms/models/contract_terms_model.dart';

void main() {
  group('ContractTermsResult', () {
    test('empty when no terms and not failed', () {
      const r = ContractTermsResult();
      expect(r.isEmpty, isTrue);
      expect(r.failed, isFalse);
    });

    test('a failure is not an empty state', () {
      const r = ContractTermsResult(failed: true);
      expect(r.isEmpty, isFalse);
      expect(r.failed, isTrue);
    });

    test('parses the API shape', () {
      final t = ContractTerms.fromJson({
        'id': 'abc',
        'gym_id': 'gym-1',
        'contract_terms_conditions': 'Hello',
        'terms_version': 3,
        'updated_at': '2026-08-22T10:00:00+00:00',
      });
      expect(t.content, 'Hello');
      expect(t.version, 3);
      expect(t.gymId, 'gym-1');
      expect(t.updatedAt, isNotNull);
    });
  });

  group('terms rendering', () {
    Future<void> pump(WidgetTester tester, String content) async {
      await tester.pumpWidget(MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: debugBuildFormattedTerms(content),
            ),
          ),
        ),
      ));
    }

    testWidgets('paragraphs and bullets both render as text', (tester) async {
      await pump(tester, 'INTRO\n\nA paragraph.\n- first bullet\n- second bullet');
      expect(find.text('INTRO'), findsOneWidget);
      expect(find.text('A paragraph.'), findsOneWidget);
      // Markers are stripped; the content survives.
      expect(find.text('first bullet'), findsOneWidget);
      expect(find.text('second bullet'), findsOneWidget);
      expect(find.text('- first bullet'), findsNothing);
    });

    testWidgets('all-caps and numbered lines render bold as headings', (tester) async {
      await pump(tester, 'SECTION ONE\n1. Numbered heading\nplain body line');

      // Lines with no inline markers render as plain Text; the weight
      // lives on `style` for those and on the span otherwise.
      FontWeight? weightOf(String label) {
        final w = tester.widget<Text>(find.text(label));
        return w.style?.fontWeight ?? w.textSpan?.style?.fontWeight;
      }

      expect(weightOf('SECTION ONE'), FontWeight.w700);
      expect(weightOf('1. Numbered heading'), FontWeight.w700);
      expect(weightOf('plain body line'), FontWeight.w400);
    });

    testWidgets('HTML is shown literally, never interpreted', (tester) async {
      await pump(tester, '<b>bold</b> & <script>alert(1)</script>');
      expect(find.text('<b>bold</b> & <script>alert(1)</script>'), findsOneWidget);
    });

    // Admins compose in a plain textarea and reach for **emphasis** by
    // reflex — the production terms in the dev DB are written this way.
    testWidgets('inline **bold** renders bold without literal asterisks',
        (tester) async {
      await pump(tester, 'The membership runs from the **Start Date** onward.');

      final rich = tester.widget<Text>(find.byType(Text).first);
      final span = rich.textSpan! as TextSpan;
      final children = span.children!.cast<TextSpan>();

      expect(children.map((c) => c.text).join(),
          'The membership runs from the Start Date onward.');
      final bold = children.firstWhere((c) => c.text == 'Start Date');
      expect(bold.style?.fontWeight, FontWeight.w700);
    });

    testWidgets('a fully **wrapped** line is treated as a heading',
        (tester) async {
      final widgets = debugBuildFormattedTerms('**1. Membership Agreement**');
      final text = widgets.first as Text;
      // Heading size, and the asterisks are gone from the visible text.
      expect(text.textSpan, isNotNull);
      final joined = (text.textSpan! as TextSpan)
          .children!
          .cast<TextSpan>()
          .map((c) => c.text)
          .join();
      expect(joined, '1. Membership Agreement');
      expect(text.textSpan!.style?.fontSize, 14);
      expect(text.textSpan!.style?.fontWeight, FontWeight.w700);
    });

    testWidgets('Arabic body text is not mistaken for a heading',
        (tester) async {
      // Arabic is caseless, so `line == line.toUpperCase()` is vacuously
      // true for it. Without a cased-letter guard the all-caps heuristic
      // marked every short Arabic line as a heading and the whole contract
      // rendered bold.
      final widgets = debugBuildFormattedTerms(
          'يجب على العضو الالتزام بقواعد النادي.');
      final text = widgets.first as Text;
      expect(text.textSpan!.style?.fontWeight, isNot(FontWeight.w700));
    });

    testWidgets('Arabic headings still work when explicitly marked',
        (tester) async {
      final widgets = debugBuildFormattedTerms('**شروط العضوية**');
      final text = widgets.first as Text;
      expect(text.textSpan!.style?.fontWeight, FontWeight.w700);
    });

    testWidgets('English all-caps headings are unaffected', (tester) async {
      final widgets = debugBuildFormattedTerms('MEMBERSHIP TERMS');
      final text = widgets.first as Text;
      expect(text.textSpan!.style?.fontWeight, FontWeight.w700);
    });

    testWidgets('empty content produces no widgets', (tester) async {
      expect(debugBuildFormattedTerms('   '), isEmpty);
    });

    testWidgets('long content stays scrollable', (tester) async {
      final long = List.generate(200, (i) => 'Clause $i of the agreement.').join('\n\n');
      await pump(tester, long);
      expect(find.text('Clause 0 of the agreement.'), findsOneWidget);
      // Something far down the list is built lazily off-screen but the
      // scroll view exists and can reach it.
      await tester.drag(find.byType(SingleChildScrollView), const Offset(0, -4000));
      await tester.pump();
      expect(find.byType(SingleChildScrollView), findsOneWidget);
    });
  });
}
