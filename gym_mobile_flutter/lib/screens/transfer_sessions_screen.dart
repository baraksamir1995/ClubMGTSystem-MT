import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/member_provider.dart';
import '../services/api_service.dart';

/// Share sessions with another member in the same gym.
/// Phone → lookup → count → transfer. Sender permanently loses the count.
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
      setState(() {
        _recipient = res;
        if (res == null) _errorText = 'No member found with that phone';
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _errorText = e.message);
    } catch (_) {
      if (mounted) setState(() => _errorText = 'Lookup failed. Try again.');
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
      await context.read<MemberProvider>().refreshMembership();
      if (!mounted) return;
      _showSuccess(recipient['full_name'] as String? ?? 'Member');
    } on ApiException catch (e) {
      if (mounted) _showError(_mapReason(e.message));
    } catch (_) {
      if (mounted) _showError('Transfer failed. Try again.');
    } finally {
      if (mounted) setState(() => _isTransferring = false);
    }
  }

  String _mapReason(String raw) {
    if (raw.contains('insufficient_sessions')) return 'You don\'t have enough sessions left.';
    if (raw.contains('no_eligible_membership')) return 'You don\'t have a session-based membership to share.';
    if (raw.contains('cannot_transfer_to_self')) return 'You can\'t send sessions to yourself.';
    if (raw.contains('receiver_not_in_gym')) return 'That member is not part of this gym.';
    if (raw.contains('receiver_not_found')) return 'No member found with that phone.';
    return 'Transfer failed. Try again.';
  }

  void _showSuccess(String name) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
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
    ));
  }

  @override
  Widget build(BuildContext context) {
    final membership = context.watch<MemberProvider>().currentMembership;
    final available = membership?.sessionsRemaining ?? 0;
    final hasBalance = available > 0 && (membership?.hasStudioAccess ?? false);

    return Scaffold(
      appBar: AppBar(title: const Text('Share Sessions')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Available to share',
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 4),
                  Text('$available ${available == 1 ? "session" : "sessions"}',
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
            const SizedBox(height: 20),

            if (!hasBalance)
              const Text('You don\'t have any sharable sessions right now.')
            else ...[
              const Text('Recipient phone number',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              TextField(
                controller: _phoneCtrl,
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(
                  hintText: '+20 100 123 4567',
                  errorText: _errorText,
                  border: const OutlineInputBorder(),
                ),
                onSubmitted: (_) => _lookup(),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                height: 44,
                child: ElevatedButton(
                  onPressed: _isLooking ? null : _lookup,
                  child: _isLooking
                      ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Find member'),
                ),
              ),
              const SizedBox(height: 20),

              if (_recipient != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      _RecipientAvatar(url: _recipient!['photo_url'] as String?),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(_recipient!['full_name'] as String? ?? '—',
                                style: const TextStyle(fontWeight: FontWeight.w600)),
                            const Text('Same gym',
                                style: TextStyle(fontSize: 12, color: Colors.grey)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                const Text('How many sessions?',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: OutlinedButton(
                        onPressed: _count > 1 ? () => setState(() => _count--) : null,
                        style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
                        child: const Icon(Icons.remove),
                      ),
                    ),
                    Expanded(
                      child: Center(
                        child: Text('$_count',
                            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    SizedBox(
                      width: 44,
                      height: 44,
                      child: OutlinedButton(
                        onPressed: _count < available ? () => setState(() => _count++) : null,
                        style: OutlinedButton.styleFrom(padding: EdgeInsets.zero),
                        child: const Icon(Icons.add),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton(
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

class _RecipientAvatar extends StatelessWidget {
  final String? url;
  const _RecipientAvatar({this.url});

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      return const CircleAvatar(child: Icon(Icons.person_outline));
    }
    return ClipOval(
      child: CachedNetworkImage(
        imageUrl: url!,
        width: 40,
        height: 40,
        fit: BoxFit.cover,
        errorWidget: (_, __, ___) =>
            const CircleAvatar(child: Icon(Icons.person_outline)),
        placeholder: (_, __) => const CircleAvatar(),
      ),
    );
  }
}
