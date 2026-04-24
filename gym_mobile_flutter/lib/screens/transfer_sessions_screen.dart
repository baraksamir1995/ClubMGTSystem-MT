import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/member_provider.dart';
import '../services/api_service.dart';

/// Share sessions with another member in the same gym.
///
/// Flow: phone input → lookup → confirm count → transfer.
/// The sender permanently loses the transferred count (no "sent" history on
/// their side, per product rule). The receiver gets a new membership row
/// with end_date=NULL.
class TransferSessionsScreen extends StatefulWidget {
  const TransferSessionsScreen({super.key});

  @override
  State<TransferSessionsScreen> createState() => _TransferSessionsScreenState();
}

class _TransferSessionsScreenState extends State<TransferSessionsScreen> {
  final _phoneCtrl = TextEditingController();
  int _count = 1;
  bool _isLooking = false;
  bool _isTransferring = false;
  Map<String, dynamic>? _recipient;
  String? _errorText;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _lookup() async {
    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _errorText = 'Enter a phone number');
      return;
    }
    setState(() {
      _isLooking = true;
      _errorText = null;
      _recipient = null;
    });
    try {
      final res = await ApiService().lookupMemberByPhone(phone);
      if (!mounted) return;
      if (res == null) {
        setState(() => _errorText = 'No member found with that phone');
      } else {
        setState(() => _recipient = res);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _errorText = e.message);
    } catch (_) {
      if (!mounted) return;
      setState(() => _errorText = 'Lookup failed. Try again.');
    } finally {
      if (mounted) setState(() => _isLooking = false);
    }
  }

  Future<void> _transfer() async {
    final recipient = _recipient;
    if (recipient == null) return;
    setState(() => _isTransferring = true);
    try {
      await ApiService().transferSessions(
        phone: _phoneCtrl.text.trim(),
        count: _count,
      );
      if (!mounted) return;
      // Refresh sender's membership so the reduced balance shows on the card.
      await context.read<MemberProvider>().refreshMembership();
      if (!mounted) return;
      _showSuccess(recipient['full_name'] as String? ?? 'Member');
    } on ApiException catch (e) {
      if (!mounted) return;
      _showError(_mapReason(e.message));
    } catch (_) {
      if (!mounted) return;
      _showError('Transfer failed. Try again.');
    } finally {
      if (mounted) setState(() => _isTransferring = false);
    }
  }

  String _mapReason(String raw) {
    if (raw.contains('insufficient_sessions')) return 'You don\'t have enough sessions left.';
    if (raw.contains('no_eligible_membership')) return 'You don\'t have a session-based membership to share from.';
    if (raw.contains('cannot_transfer_to_self')) return 'You can\'t send sessions to yourself.';
    if (raw.contains('receiver_not_in_gym')) return 'That member is not part of this gym.';
    if (raw.contains('receiver_not_found')) return 'No member found with that phone.';
    return 'Transfer failed. Try again.';
  }

  void _showSuccess(String name) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        icon: const Icon(Icons.check_circle, color: Colors.green, size: 48),
        title: const Text('Sessions sent'),
        content: Text('$_count ${_count == 1 ? "session has" : "sessions have"} been added to $name.'),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              Navigator.of(context).pop();
            },
            child: const Text('Done'),
          ),
        ],
      ),
    );
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final membership = context.watch<MemberProvider>().currentMembership;
    final available = membership?.sessionsRemaining ?? 0;
    final hasBalance = available > 0 && (membership?.hasStudioAccess ?? false);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Share Sessions'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Balance banner
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.account_balance_wallet_outlined, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Available to share',
                              style: TextStyle(fontSize: 12, color: Colors.grey)),
                          Text('$available ${available == 1 ? "session" : "sessions"}',
                              style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            if (!hasBalance) ...[
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'You don\'t have any sharable sessions right now.',
                  style: theme.textTheme.bodyMedium,
                ),
              ),
            ] else ...[
              Text('Recipient phone number',
                  style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _phoneCtrl,
                      keyboardType: TextInputType.phone,
                      decoration: InputDecoration(
                        hintText: '+20 100 123 4567',
                        errorText: _errorText,
                        border: const OutlineInputBorder(),
                      ),
                      onSubmitted: (_) => _lookup(),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _isLooking ? null : _lookup,
                    child: _isLooking
                        ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Find'),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              if (_recipient != null) ...[
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundImage: (_recipient!['photo_url'] as String?) != null
                          ? NetworkImage(_recipient!['photo_url'] as String)
                          : null,
                      child: (_recipient!['photo_url'] as String?) == null
                          ? const Icon(Icons.person_outline)
                          : null,
                    ),
                    title: Text(_recipient!['full_name'] as String? ?? '—'),
                    subtitle: const Text('Same gym'),
                  ),
                ),
                const SizedBox(height: 16),

                Text('How many sessions to send?',
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    IconButton.filledTonal(
                      icon: const Icon(Icons.remove),
                      onPressed: _count > 1 ? () => setState(() => _count--) : null,
                    ),
                    Expanded(
                      child: Center(
                        child: Text('$_count',
                            style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                      ),
                    ),
                    IconButton.filledTonal(
                      icon: const Icon(Icons.add),
                      onPressed: _count < available ? () => setState(() => _count++) : null,
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isTransferring ? null : _transfer,
                    child: _isTransferring
                        ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                        : Text('Send $_count ${_count == 1 ? "session" : "sessions"}'),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
