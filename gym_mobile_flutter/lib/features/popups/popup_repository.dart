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
      print('[PopupRepository] raw data: $data');
      if (data == null) return null;
      final popup = PopupModel.fromJson(data);
      print('[PopupRepository] parsed popup: id=${popup.id} isActive=${popup.isActive}');
      return popup;
    } catch (e, st) {
      print('[PopupRepository] parse error: $e\n$st');
      return null;
    }
  }
}
