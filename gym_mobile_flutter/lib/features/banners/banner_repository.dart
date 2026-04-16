import '../../models/banner_model.dart';
import '../../services/api_service.dart';

class BannerRepository {
  final ApiService _service;

  BannerRepository({ApiService? service})
      : _service = service ?? ApiService();

  /// Fetches active banners for a gym ordered by sort_order ASC.
  Future<List<BannerModel>> fetchBanners(String gymId) async {
    try {
      final data = await _service.getBanners();
      return data
          .map((row) => BannerModel.fromJson(row))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
