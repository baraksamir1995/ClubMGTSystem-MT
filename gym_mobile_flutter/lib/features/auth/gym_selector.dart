import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../models/gym_model.dart';
import 'auth_widgets.dart';

/// Searchable gym selection widget for the signup flow.
class GymSelector extends StatefulWidget {
  final List<Gym> gyms;
  final Gym? selected;
  final bool isLoading;
  final String? errorText;
  final ValueChanged<Gym> onSelected;

  const GymSelector({
    super.key,
    required this.gyms,
    required this.selected,
    required this.isLoading,
    required this.onSelected,
    this.errorText,
  });

  @override
  State<GymSelector> createState() => _GymSelectorState();
}

class _GymSelectorState extends State<GymSelector> {
  bool _open = false;
  final _searchCtrl = TextEditingController();
  final _focusNode = FocusNode();

  List<Gym> get _filtered {
    final q = _searchCtrl.text.trim().toLowerCase();
    if (q.isEmpty) return widget.gyms;
    return widget.gyms.where((g) => g.name.toLowerCase().contains(q)).toList();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _toggle() {
    setState(() {
      _open = !_open;
      if (!_open) {
        _searchCtrl.clear();
        _focusNode.unfocus();
      }
    });
  }

  void _select(Gym gym) {
    widget.onSelected(gym);
    setState(() {
      _open = false;
      _searchCtrl.clear();
      _focusNode.unfocus();
    });
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final borderColor = hasError
        ? const Color(0xFFEF4444)
        : _open
            ? kAuthPrimary
            : kAuthBorder;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SELECT YOUR GYM',
          style: TextStyle(
            fontSize: 11, fontWeight: FontWeight.w500,
            color: kAuthSec, letterSpacing: 0.7,
          ),
        ),
        const SizedBox(height: 5),

        // Selector button
        GestureDetector(
          onTap: widget.isLoading ? null : _toggle,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            height: 52,
            decoration: BoxDecoration(
              color: kAuthFieldBg,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: borderColor, width: 1.5),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                if (widget.isLoading) ...[
                  const SizedBox(
                    width: 18, height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2, color: kAuthPh),
                  ),
                  const SizedBox(width: 12),
                  const Text('Loading gyms...', style: TextStyle(fontSize: 15, color: kAuthPh)),
                ] else if (widget.selected != null) ...[
                  if (widget.selected!.logoUrl != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: CachedNetworkImage(
                        imageUrl: widget.selected!.logoUrl!,
                        width: 28, height: 28, fit: BoxFit.cover,
                        placeholder: (_, __) => const SizedBox(width: 28, height: 28),
                        errorWidget: (_, __, ___) => const Icon(Icons.fitness_center, size: 20, color: kAuthPh),
                      ),
                    ),
                  if (widget.selected!.logoUrl != null) const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.selected!.name,
                      style: const TextStyle(fontSize: 15, color: kAuthText),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ] else ...[
                  const Icon(Icons.fitness_center, size: 18, color: kAuthPh),
                  const SizedBox(width: 10),
                  const Text('Choose a gym', style: TextStyle(fontSize: 15, color: kAuthPh)),
                ],
                const Spacer(),
                AnimatedRotation(
                  turns: _open ? 0.5 : 0,
                  duration: const Duration(milliseconds: 200),
                  child: const Icon(Icons.keyboard_arrow_down, color: kAuthPh, size: 22),
                ),
              ],
            ),
          ),
        ),

        // Error text
        if (hasError) ...[
          const SizedBox(height: 4),
          Text(
            widget.errorText!,
            style: const TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
          ),
        ],

        // Dropdown
        AnimatedSize(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          child: _open ? _buildDropdown() : const SizedBox.shrink(),
        ),
      ],
    );
  }

  Widget _buildDropdown() {
    final filtered = _filtered;
    return Container(
      margin: const EdgeInsets.only(top: 6),
      constraints: const BoxConstraints(maxHeight: 240),
      decoration: BoxDecoration(
        color: kAuthFieldBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: kAuthBorder, width: 1.5),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Search
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: TextField(
              controller: _searchCtrl,
              focusNode: _focusNode,
              onChanged: (_) => setState(() {}),
              style: const TextStyle(fontSize: 14, color: kAuthText),
              decoration: InputDecoration(
                hintText: 'Search gyms...',
                hintStyle: const TextStyle(color: kAuthPh, fontSize: 14),
                prefixIcon: const Icon(Icons.search, size: 18, color: kAuthPh),
                prefixIconConstraints: const BoxConstraints(minWidth: 36),
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: kAuthBorder),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: BorderSide(color: kAuthBorder),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                  borderSide: const BorderSide(color: kAuthPrimary),
                ),
                filled: true,
                fillColor: kAuthBg,
              ),
            ),
          ),

          // Results
          Flexible(
            child: filtered.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(16),
                    child: Text('No gyms found', style: TextStyle(fontSize: 13, color: kAuthPh)),
                  )
                : ListView.builder(
                    shrinkWrap: true,
                    padding: const EdgeInsets.only(bottom: 6),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final gym = filtered[i];
                      final isSelected = widget.selected?.id == gym.id;
                      return InkWell(
                        onTap: () => _select(gym),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          color: isSelected ? kAuthPrimary.withValues(alpha: 0.08) : null,
                          child: Row(
                            children: [
                              if (gym.logoUrl != null)
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: CachedNetworkImage(
                                    imageUrl: gym.logoUrl!,
                                    width: 32, height: 32, fit: BoxFit.cover,
                                    placeholder: (_, __) => Container(
                                      width: 32, height: 32,
                                      decoration: BoxDecoration(
                                        color: kAuthBorder,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                    ),
                                    errorWidget: (_, __, ___) => Container(
                                      width: 32, height: 32,
                                      decoration: BoxDecoration(
                                        color: kAuthBorder,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Icon(Icons.fitness_center, size: 16, color: kAuthPh),
                                    ),
                                  ),
                                )
                              else
                                Container(
                                  width: 32, height: 32,
                                  decoration: BoxDecoration(
                                    color: kAuthBorder,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: const Icon(Icons.fitness_center, size: 16, color: kAuthPh),
                                ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  gym.name,
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: isSelected ? kAuthPrimary : kAuthText,
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                  ),
                                ),
                              ),
                              if (isSelected)
                                const Icon(Icons.check_circle, size: 18, color: kAuthPrimary),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
