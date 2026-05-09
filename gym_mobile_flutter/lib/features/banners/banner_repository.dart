import '../../models/banner_model.dart';
import '../../services/api_service.dart';

class BannerRepository {
  final ApiService _service;

  BannerRepository({ApiService? service})
      : _service = service ?? ApiService();

  /// Fetches active banners for a gym ordered by sort_order ASC.
  /// The API returns inactive rows too (admin needs them); we strip them
  /// here so members never see deactivated banners on the home carousel.
  Future<List<BannerModel>> fetchBanners(String gymId) async {
    try {
      final data = await _service.getBanners();
      return data
          .map((row) => BannerModel.fromJson(row))
          .where((b) => b.isActive)
          .toList();
    } catch (_) {
      return [];
    }
  }
}
