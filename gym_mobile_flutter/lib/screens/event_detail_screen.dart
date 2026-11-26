import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:clby/l10n/l10n.dart';

import '../features/store_events/events_provider.dart';
import '../features/store_events/in_app_checkout.dart';
import '../features/store_events/store_events_ui.dart';
import '../models/event_model.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import 'paymob_webview_screen.dart' show PaymobResult;

/// Event detail: cover, date/time, location, description, seats, price,
/// option picker, and Register (free) / Pay & register (paid) — or, once
/// registered, the status badge with Cancel (free/unpaid only).
///
/// Reads the live event from [EventsProvider] so a refresh (pull-to-refresh,
/// post-payment polling) updates the screen in place. [initial] covers the
/// first frame / a deep link before the provider has loaded.
class EventDetailScreen extends StatefulWidget {
  final String eventId;
  final GymEvent? initial;

  const EventDetailScreen({super.key, required this.eventId, this.initial});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  final _api = ApiService();
  bool _busy = false;
  EventConfiguration? _selectedConfig;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = context.read<EventsProvider>();
      if (provider.byId(widget.eventId) == null) provider.load();
    });
  }

  Future<void> _refresh() =>
      context.read<EventsProvider>().load(force: true);

  void _snack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
  }

  bool _ensureConfig(GymEvent e) {
    if (e.requiresConfiguration && _selectedConfig == null) {
      _snack(context.l10n.eventsChooseOptionFirst(
          e.configurationLabel?.trim().isNotEmpty == true
              ? e.configurationLabel!.trim()
              : context.l10n.eventsOptionDefaultLabel));
      return false;
    }
    return true;
  }

  Future<void> _registerFree(GymEvent e) async {
    if (!_ensureConfig(e)) return;
    final l10n = context.l10n;
    final provider = context.read<EventsProvider>();
    setState(() => _busy = true);
    try {
      await _api.registerForEvent(e.id, configurationId: _selectedConfig?.id);
      if (!mounted) return;
      _snack(l10n.eventsRegisteredToast(e.title));
      await provider.load(force: true);
    } catch (err) {
      if (!mounted) return;
      _snack(storeEventsErrorMessage(context, err));
      await provider.load(force: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pay(GymEvent e) async {
    // A pending registration already carries its option; re-send it.
    if (!e.isRegistered && !_ensureConfig(e)) return;
    final l10n = context.l10n;
    final provider = context.read<EventsProvider>();
    String? configId = _selectedConfig?.id;
    if (configId == null && e.myRegistration?.configurationName != null) {
      for (final c in e.configurations) {
        if (c.name == e.myRegistration!.configurationName) configId = c.id;
      }
    }
    setState(() => _busy = true);
    try {
      final result = await runInAppCheckout(
        context,
        itemType: 'event',
        itemId: e.id,
        itemName: e.title,
        displayAmount: e.price,
        currency: e.currency,
        eventConfigurationId: configId,
      );
      if (!mounted) return;
      switch (result) {
        case PaymobResult.success:
          _snack(l10n.eventsPaymentReceived);
          // The webhook confirms asynchronously — poll briefly.
          await provider.refreshUntilSettled(e.id);
        case PaymobResult.pending:
          _snack(l10n.paymentPending);
          await provider.load(force: true);
        case PaymobResult.failed:
          _snack(l10n.paymentDeclined);
          await provider.load(force: true);
        case PaymobResult.cancelled:
        case null:
          // The seat may be held as pending_payment — show that state.
          await provider.load(force: true);
      }
    } catch (err) {
      if (!mounted) return;
      _snack(storeEventsErrorMessage(context, err));
      await provider.load(force: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(GymEvent e) async {
    final reg = e.myRegistration;
    if (reg == null) return;
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.eventsCancelConfirmTitle),
        content: Text(l10n.eventsCancelConfirmBody(e.title)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.eventsKeepRegistration),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: TextButton.styleFrom(foregroundColor: const Color(0xFFC24E3D)),
            child: Text(l10n.eventsCancelRegistration),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final provider = context.read<EventsProvider>();
    setState(() => _busy = true);
    try {
      await _api.cancelEventRegistration(reg.id);
      if (!mounted) return;
      _snack(l10n.eventsCancelledToast);
      setState(() => _selectedConfig = null);
    } catch (err) {
      if (!mounted) return;
      _snack(storeEventsErrorMessage(context, err));
    } finally {
      await provider.load(force: true);
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<EventsProvider>();
    final e = provider.byId(widget.eventId) ?? widget.initial;

    if (e == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: provider.isLoading || !provider.isLoaded
              ? const CircularProgressIndicator()
              : Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(context.l10n.eventsNotFound),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: _refresh,
                      child: Text(context.l10n.commonRetry),
                    ),
                  ],
                ),
        ),
      );
    }

    final theme = Theme.of(context);
    final primary = theme.colorScheme.primary;
    final paymentsEnabled =
        context.watch<AuthProvider>().gym?.mobilePaymentsEnabled ?? true;
    final reg = e.isRegistered ? e.myRegistration : null;
    final hasImage = (e.imageUrl ?? '').isNotEmpty;
    final coverHeight = MediaQuery.of(context).size.width / 2;
    final optionLabel = (e.configurationLabel ?? '').trim().isNotEmpty
        ? e.configurationLabel!.trim()
        : context.l10n.eventsOptionDefaultLabel;

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      body: RefreshIndicator(
        color: primary,
        onRefresh: _refresh,
        edgeOffset: hasImage ? coverHeight : kToolbarHeight,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              expandedHeight: hasImage ? coverHeight : null,
              backgroundColor: theme.scaffoldBackgroundColor,
              foregroundColor: kSeInk,
              flexibleSpace: hasImage
                  ? FlexibleSpaceBar(
                      background: networkImageOrPlaceholder(
                        context,
                        e.imageUrl,
                        icon: Icons.event_rounded,
                      ),
                    )
                  : null,
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        EventPricePill(event: e),
                        if (reg != null) EventStatusPill(status: reg.status),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      e.title,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: kSeInk,
                        height: 1.2,
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _InfoCard(children: [
                      if (e.startsAt != null)
                        _InfoRow(
                          icon: Icons.calendar_today_rounded,
                          text: formatEventDate(context, e.startsAt),
                          sub: e.endsAt != null
                              ? context.l10n.eventsEndsAt(formatEventDate(context, e.endsAt))
                              : null,
                        ),
                      if ((e.location ?? '').trim().isNotEmpty)
                        _InfoRow(icon: Icons.location_on_outlined, text: e.location!.trim()),
                      _InfoRow(
                        icon: Icons.event_seat_outlined,
                        text: e.seatsLeft == null
                            ? context.l10n.eventsSeatsUnlimited
                            : (e.isFull
                                ? context.l10n.eventsFull
                                : context.l10n.eventsSeatsLeft(e.seatsLeft!)),
                      ),
                      if (e.registrationDeadline != null)
                        _InfoRow(
                          icon: Icons.timer_outlined,
                          text: context.l10n.eventsRegisterBy(
                              formatEventDate(context, e.registrationDeadline)),
                        ),
                    ]),

                    // Registration state
                    if (reg != null) ...[
                      const SizedBox(height: 16),
                      _RegistrationNotice(reg: reg),
                    ],

                    if ((e.description ?? '').trim().isNotEmpty) ...[
                      const SizedBox(height: 20),
                      Text(
                        e.description!.trim(),
                        style: const TextStyle(
                          fontSize: 15,
                          height: 1.55,
                          color: kSeInk2,
                        ),
                      ),
                    ],

                    // Option picker — only while registration is possible.
                    if (reg == null &&
                        e.requiresConfiguration &&
                        !e.isFull &&
                        !e.registrationClosed) ...[
                      const SizedBox(height: 22),
                      Row(
                        children: [
                          Text(
                            optionLabel,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: kSeInk,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            context.l10n.eventsRequired,
                            style: TextStyle(
                              fontSize: 12,
                              color: theme.colorScheme.error,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          for (final c in e.configurations)
                            SeChoiceChip(
                              label: c.name,
                              selected: _selectedConfig?.id == c.id,
                              onTap: _busy
                                  ? null
                                  : () => setState(() => _selectedConfig = c),
                            ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: _buildBottomBar(e, reg, paymentsEnabled, primary),
    );
  }

  Widget _buildBottomBar(
    GymEvent e,
    MyEventRegistration? reg,
    bool paymentsEnabled,
    Color primary,
  ) {
    final l10n = context.l10n;
    Widget content;

    if (reg != null) {
      if (reg.isPaid) {
        content = _BarNote(text: l10n.eventsPaidCancelNote);
      } else if (reg.isPendingPayment) {
        content = Row(
          children: [
            Expanded(
              child: _SecondaryButton(
                label: l10n.eventsCancelRegistration,
                onPressed: _busy ? null : () => _cancel(e),
              ),
            ),
            if (paymentsEnabled) ...[
              const SizedBox(width: 10),
              Expanded(
                child: _PrimaryButton(
                  label: l10n.eventsCompletePayment,
                  busy: _busy,
                  color: primary,
                  onPressed: _busy ? null : () => _pay(e),
                ),
              ),
            ],
          ],
        );
      } else if (reg.canCancel) {
        content = _SecondaryButton(
          label: l10n.eventsCancelRegistration,
          onPressed: _busy ? null : () => _cancel(e),
          busy: _busy,
        );
      } else {
        content = _BarNote(text: l10n.eventsPaidCancelNote);
      }
    } else if (e.isFull) {
      content = _PrimaryButton(label: l10n.eventsFull, color: primary, onPressed: null);
    } else if (e.registrationClosed) {
      content = _PrimaryButton(
          label: l10n.eventsRegistrationClosed, color: primary, onPressed: null);
    } else if (e.isPaid && !paymentsEnabled) {
      content = _BarNote(text: l10n.eventsPayAtFrontDesk);
    } else {
      final configMissing = e.requiresConfiguration && _selectedConfig == null;
      content = _PrimaryButton(
        label: e.isPaid
            ? l10n.eventsPayAndRegister(formatMoney(context, e.price, e.currency))
            : l10n.eventsRegister,
        busy: _busy,
        color: primary,
        onPressed: _busy || configMissing
            ? null
            : () => e.isPaid ? _pay(e) : _registerFree(e),
      );
    }

    return Container(
      padding: EdgeInsets.fromLTRB(
          20, 12, 20, 12 + MediaQuery.of(context).padding.bottom),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: kSeHair)),
      ),
      child: content,
    );
  }
}

class _RegistrationNotice extends StatelessWidget {
  final MyEventRegistration reg;
  const _RegistrationNotice({required this.reg});

  @override
  Widget build(BuildContext context) {
    final pending = reg.isPendingPayment;
    final fg = pending ? kSeWarn : kSeSuccess;
    final bg = pending ? kSeWarnBg : kSeSuccessBg;
    final l10n = context.l10n;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            pending ? Icons.hourglass_top_rounded : Icons.check_circle_rounded,
            color: fg,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  pending ? l10n.eventsStatusPaymentProcessing : l10n.eventsYoureRegistered,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: fg,
                  ),
                ),
                if (reg.configurationName != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    reg.configurationName!,
                    style: const TextStyle(fontSize: 13, color: kSeInk),
                  ),
                ],
                if (pending) ...[
                  const SizedBox(height: 4),
                  Text(
                    l10n.eventsPaymentProcessingHint,
                    style: const TextStyle(fontSize: 12, color: kSeInk2, height: 1.4),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  final List<Widget> children;
  const _InfoCard({required this.children});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: kSeHair),
      ),
      child: Column(children: children),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  final String? sub;
  const _InfoRow({required this.icon, required this.text, this.sub});

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: primary.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, size: 16, color: primary),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    text,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: kSeInk,
                    ),
                  ),
                  if (sub != null)
                    Text(sub!, style: const TextStyle(fontSize: 12, color: kSeInk2)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  final String label;
  final Color color;
  final bool busy;
  final VoidCallback? onPressed;

  const _PrimaryButton({
    required this.label,
    required this.color,
    required this.onPressed,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      width: double.infinity,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: color,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
              )
            : Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
              ),
      ),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool busy;

  const _SecondaryButton({required this.label, required this.onPressed, this.busy = false});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFC24E3D),
          side: const BorderSide(color: kSeHair),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
        child: busy
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
      ),
    );
  }
}

class _BarNote extends StatelessWidget {
  final String text;
  const _BarNote({required this.text});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.info_outline_rounded, color: kSeInk2, size: 20),
        const SizedBox(width: 10),
        Expanded(
          child: Text(text, style: const TextStyle(fontSize: 13, color: kSeInk2, height: 1.4)),
        ),
      ],
    );
  }
}
