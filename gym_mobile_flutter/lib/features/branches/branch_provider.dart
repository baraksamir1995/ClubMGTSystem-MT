import 'package:flutter/material.dart';
import '../../models/branch_model.dart';
import '../../utils/logger.dart';
import 'branch_repository.dart';

class BranchProvider extends ChangeNotifier {
  final BranchRepository _repository;

  BranchProvider({BranchRepository? repository})
      : _repository = repository ?? BranchRepository();

  List<BranchModel> _branches = [];
  bool _isLoading = false;
  String? _loadedGymId;
  Future<void>? _inFlight;

  List<BranchModel> get branches => _branches;
  bool get isLoading => _isLoading;
  bool get hasBranches => _branches.isNotEmpty;
  bool get isMultiBranch => _branches.length > 1;

  BranchModel? branchById(String id) =>
      _branches.where((b) => b.id == id).firstOrNull;

  Future<void> loadBranches(String gymId, {bool force = false}) {
    if (_loadedGymId == gymId && _branches.isNotEmpty && !force) return Future.value();

    final existing = _inFlight;
    if (existing != null) return existing;

    final future = _doLoad(gymId).whenComplete(() => _inFlight = null);
    _inFlight = future;
    return future;
  }

  Future<void> _doLoad(String gymId) async {
    _isLoading = true;
    notifyListeners();

    try {
      _branches = await _repository.fetchActiveBranches(gymId);
      _loadedGymId = gymId;
    } catch (e) {
      appLog('[BranchProvider] Failed to load branches: $e');
      _branches = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void clear() {
    _branches = [];
    _loadedGymId = null;
    _isLoading = false;
    _inFlight = null;
    notifyListeners();
  }
}
