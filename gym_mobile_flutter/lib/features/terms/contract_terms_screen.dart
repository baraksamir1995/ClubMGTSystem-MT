import 'package:flutter/material.dart';

import '../../l10n/l10n.dart';
import '../../services/api_service.dart';
import 'models/contract_terms_model.dart';

const _kBg = Color(0xFFF7F6F2);
const _kInk = Color(0xFF1F1A14);
const _kInk2 = Color(0x9E1F1A14);
const _kInk3 = Color(0x6B1F1A14);
const _kHair = Color(0x141F1A14);
const _kCard = Color(0xFFFFFFFF);

/// Where the Terms screen was opened from.
///
/// Profile shows the gym's current terms; an invoice shows the terms that
/// invoice was issued under (resolved from the invoice's own gym, which
/// is not necessarily the signed-in user's gym).
enum ContractTermsSource { profile, invoice }

/// The single Contract Terms & Conditions screen.
///
/// Deliberately one widget for both entry points — Profile and Invoice
/// differ only in which endpoint supplies the text, so the rendering,
/// scrolling, empty state and error state are shared rather than
/// duplicated.
class ContractTermsScreen extends StatefulWidget {
  final ContractTermsSource source;

  /// Required when [source] is [ContractTermsSource.invoice].
  final String? invoiceId;

  const ContractTermsScreen({
    super.key,
    this.source = ContractTermsSource.profile,
    this.invoiceId,
  });

  @override
  State<ContractTermsScreen> createState() => _ContractTermsScreenState();
}

class _ContractTermsScreenState extends State<ContractTermsScreen> {
  final _api = ApiService();
  ContractTermsResult? _result;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final invoiceId = widget.invoiceId;
    final result = widget.source == ContractTermsSource.invoice && invoiceId != null
        ? await _api.getContractTermsForInvoice(invoiceId)
        : await _api.getContractTerms();
    if (!mounted) return;
    setState(() {
      _result = result;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: _kBg,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        iconTheme: const IconThemeData(color: _kInk),
        title: Text(
          context.l10n.contractTermsTitle,
          style: const TextStyle(
            color: _kInk,
            fontSize: 17,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: SafeArea(top: false, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: _kInk));
    }

    final result = _result;
    if (result == null || result.failed) return _buildError();
    if (result.isEmpty) return _buildEmpty();

    final terms = result.terms!;
    return RefreshIndicator(
      onRefresh: _load,
      color: _kInk,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 40),
        children: [
          _buildMeta(terms, result.isPinnedVersion),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: _kCard,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: _kHair),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _FormattedTerms.build(terms.content),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMeta(ContractTerms terms, bool pinned) {
    final updated = terms.updatedAt;
    return Wrap(
      spacing: 8,
      runSpacing: 6,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: _kInk.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            context.l10n.contractTermsVersion(terms.version.toString()),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: _kInk,
            ),
          ),
        ),
        if (updated != null)
          Text(
            context.l10n.contractTermsLastUpdated(_formatDate(updated)),
            style: const TextStyle(fontSize: 11, color: _kInk3),
          ),
        // Only meaningful on an invoice: says the text below is the
        // contract in force when that invoice was issued.
        if (pinned)
          Text(
            context.l10n.contractTermsAsOfPurchase,
            style: const TextStyle(fontSize: 11, color: _kInk3),
          ),
      ],
    );
  }

  String _formatDate(DateTime d) {
    final local = d.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final day = local.day.toString().padLeft(2, '0');
    return '$y-$m-$day';
  }

  Widget _buildEmpty() => _buildPlaceholder(
        icon: Icons.description_outlined,
        title: context.l10n.contractTermsEmptyTitle,
        body: context.l10n.contractTermsEmptyBody,
      );

  Widget _buildError() => _buildPlaceholder(
        icon: Icons.cloud_off_rounded,
        title: context.l10n.contractTermsErrorTitle,
        body: context.l10n.contractTermsErrorBody,
        onRetry: _load,
      );

  Widget _buildPlaceholder({
    required IconData icon,
    required String title,
    required String body,
    VoidCallback? onRetry,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 36),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 44, color: _kInk3),
            const SizedBox(height: 14),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: _kInk,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              body,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: _kInk2, height: 1.45),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 18),
              TextButton(
                onPressed: onRetry,
                child: Text(context.l10n.commonRetry),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Renders the plain-text terms with their structure preserved.
///
/// The admin editor is a plain textarea (no rich-text editor exists in
/// the dashboard), so the "formatting" we must preserve is the author's
/// line structure: blank lines separate paragraphs, "-"/"*"/"•" lines are
/// bullets, and short ALL-CAPS or numbered lines read as headings.
/// Nothing here interprets HTML or Markdown syntax — the text is only
/// ever rendered as text, never as markup.
class _FormattedTerms {
  static List<Widget> build(String raw) {
    final text = raw.replaceAll('\r\n', '\n').trim();
    if (text.isEmpty) return const [];

    final widgets = <Widget>[];
    final lines = text.split('\n');

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i].trim();

      if (line.isEmpty) {
        // Collapse runs of blank lines into a single paragraph gap.
        if (widgets.isNotEmpty) widgets.add(const SizedBox(height: 12));
        continue;
      }

      final bullet = _bulletContent(line);
      if (bullet != null) {
        widgets.add(_bulletRow(bullet));
        continue;
      }

      final heading = _isHeading(line);
      widgets.add(_richLine(
        line,
        TextStyle(
          fontSize: heading ? 14 : 13.5,
          height: 1.5,
          fontWeight: heading ? FontWeight.w700 : FontWeight.w400,
          color: _kInk,
        ),
      ));
    }

    return widgets;
  }

  /// The text after a leading bullet marker, or null if not a bullet.
  static String? _bulletContent(String line) {
    for (final marker in const ['- ', '* ', '• ']) {
      if (line.startsWith(marker)) return line.substring(marker.length).trim();
    }
    if (line == '-' || line == '*' || line == '•') return '';
    return null;
  }

  static Widget _bulletRow(String content) => Padding(
        padding: const EdgeInsets.only(bottom: 6, left: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.only(top: 7, right: 9),
              child: SizedBox(
                width: 4,
                height: 4,
                child: DecoratedBox(
                  decoration: BoxDecoration(color: _kInk3, shape: BoxShape.circle),
                ),
              ),
            ),
            Expanded(
              child: _richLine(
                content,
                const TextStyle(fontSize: 13.5, height: 1.5, color: _kInk),
              ),
            ),
          ],
        ),
      );

  /// Renders one line, honouring inline **bold** spans.
  ///
  /// Admins compose these terms in a plain textarea and reach for
  /// Markdown-style `**emphasis**` by reflex, so the double-asterisk is
  /// treated as bold rather than shown as literal punctuation. Only
  /// this one marker is interpreted — everything else, including any
  /// HTML, stays literal text.
  static Widget _richLine(String line, TextStyle base) {
    final spans = <TextSpan>[];
    final pattern = RegExp(r'\*\*(.+?)\*\*', dotAll: true);
    var index = 0;

    for (final match in pattern.allMatches(line)) {
      if (match.start > index) {
        spans.add(TextSpan(text: line.substring(index, match.start)));
      }
      spans.add(TextSpan(
        text: match.group(1),
        style: const TextStyle(fontWeight: FontWeight.w700),
      ));
      index = match.end;
    }
    if (index < line.length) spans.add(TextSpan(text: line.substring(index)));

    if (spans.isEmpty) return Text(line, style: base);
    return Text.rich(TextSpan(style: base, children: spans));
  }

  /// Heuristic: a short line that is all-caps, or begins with a section
  /// number like "1." / "2.3", reads as a heading.
  static bool _isHeading(String rawLine) {
    // Judge the text itself, not its emphasis markers.
    final line = rawLine.replaceAll('**', '').trim();
    if (line.isEmpty || line.length > 80) return false;
    // A line wholly wrapped in ** is an author-marked heading.
    if (RegExp(r'^\*\*.+\*\*$').hasMatch(rawLine.trim())) return true;
    // All-caps only means something in a bicameral script. Arabic (and
    // other caseless scripts) return true for `line == line.toUpperCase()`
    // unconditionally, which would make every short line a heading — so
    // require a cased letter that actually differs when lowercased.
    final hasCasedLetters = RegExp(r'[A-Za-z]').hasMatch(line);
    if (hasCasedLetters && line == line.toUpperCase() && line != line.toLowerCase()) {
      return true;
    }
    return RegExp(r'^\d+(\.\d+)*[.)]?\s+\S').hasMatch(line);
  }
}

/// Test-only hook onto the terms formatter.
///
/// The formatter encodes the contract's visible structure (headings,
/// bullets, paragraphs), so it is worth testing directly rather than
/// only through a full screen pump.
@visibleForTesting
List<Widget> debugBuildFormattedTerms(String raw) => _FormattedTerms.build(raw);
