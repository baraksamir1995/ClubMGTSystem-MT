import '../../models/popup_model.dart';
import '../../services/api_service.dart';

class PopupRepository {
  final ApiService _service;

  PopupRepository({ApiService? service})
      : _service = service ?? ApiService();

  /// Returns the single highest-priority active popup for the gym,
  /// or null if none is configured.
  Future<PopupModel?> fetchActivePopup(String gymId) async {
    try {
      final data = await _service.getActivePopup();
      if (data == null) return null;
      return PopupModel.fromJson(data);
    } catch (_) {
      return null;
    }
  }
}
