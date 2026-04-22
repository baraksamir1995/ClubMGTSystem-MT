import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../models/popup_model.dart';
import 'popup_overlay.dart';
import 'popup_repository.dart';

class PopupProvider extends ChangeNotifier {
  final PopupRepository _repository;
  static const _storage = FlutterSecureStorage();
  static const _dismissedKey = 'dismissed_popup_ids';

  PopupProvider({PopupRepository? repository})
      : _repository = repository ?? PopupRepository();

  PopupModel? _activePopup;
  bool _shownThisSession = false;

  PopupModel? get activePopup => _activePopup;

  Future<void> loadActivePopup(String gymId) async {
    try {
      _activePopup = await _repository.fetchActivePopup(gymId);
      notifyListeners();
    } catch (e) {
      debugPrint('[PopupProvider] Failed to load popup: $e');
    }
  }

  /// Shows the popup dialog if:
  ///   1. There is an active popup configured
  ///   2. It hasn't been shown this session already
  ///   3. The user hasn't permanently dismissed it
  Future<void> maybeShowPopup(BuildContext context) async {
    if (_shownThisSession) return;
    final popup = _activePopup;
    if (popup == null) return;

    final dismissed = await _isDismissed(popup.id);
    if (dismissed) return;

    _shownThisSession = true;

    if (!context.mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: Colors.black.withValues(alpha: 0.65),
      builder: (_) => PopupOverlay(
        popup: popup,
        onDismiss: () => _markDismissed(popup.id),
      ),
    );
  }

  Future<bool> _isDismissed(String popupId) async {
    final raw = await _storage.read(key: _dismissedKey);
    if (raw == null || raw.isEmpty) return false;
    return raw.split(',').contains(popupId);
  }

  Future<void> _markDismissed(String popupId) async {
    final raw = await _storage.read(key: _dismissedKey);
    final ids = (raw?.split(',') ?? []).where((s) => s.isNotEmpty).toSet();
    ids.add(popupId);
    await _storage.write(key: _dismissedKey, value: ids.join(','));
  }

  void clear() {
    _activePopup = null;
    _shownThisSession = false;
    notifyListeners();
  }
}
