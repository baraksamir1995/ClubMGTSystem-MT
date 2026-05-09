import 'package:flutter/foundation.dart';
import '../../models/banner_model.dart';
import 'banner_repository.dart';
import '../../utils/error_utils.dart';

class BannerProvider extends ChangeNotifier {
  final BannerRepository _repository;

  BannerProvider({BannerRepository? repository})
      : _repository = repository ?? BannerRepository();

  List<BannerModel> _banners = [];
  bool _isLoading = false;
  String? _error;
  String? _loadedGymId;
  Future<void>? _inFlight;

  List<BannerModel> get banners => _banners;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasBanners => _banners.isNotEmpty;

  Future<void> loadBanners(String gymId, {bool force = false}) {
    // Avoid redundant fetches unless forced
    if (_loadedGymId == gymId && _banners.isNotEmpty && !force) return Future.value();

    // Concurrent callers (pull-to-refresh + lifecycle resume + post-login)
    // share one in-flight Future so a slow first response can't overwrite a
    // fresher one that landed in between.
    final existing = _inFlight;
    if (existing != null) return existing;

    final future = _doLoad(gymId).whenComplete(() => _inFlight = null);
    _inFlight = future;
    return future;
  }

  Future<void> _doLoad(String gymId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _banners = await _repository.fetchBanners(gymId);
      _loadedGymId = gymId;
    } catch (e) {
      _error = friendlyError(e);
      _banners = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clear() {
    _banners = [];
    _loadedGymId = null;
    _error = null;
    _isLoading = false;
    _inFlight = null;
    notifyListeners();
  }
}
