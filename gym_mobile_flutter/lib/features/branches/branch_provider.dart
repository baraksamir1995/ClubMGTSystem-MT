import 'package:flutter/material.dart';
import '../../models/branch_model.dart';
import 'branch_repository.dart';

class BranchProvider extends ChangeNotifier {
  final BranchRepository _repository;

  BranchProvider({BranchRepository? repository})
      : _repository = repository ?? BranchRepository();

  List<BranchModel> _branches = [];
  bool _isLoading = false;
  String? _loadedGymId;

  List<BranchModel> get branches => _branches;
  bool get isLoading => _isLoading;
  bool get hasBranches => _branches.isNotEmpty;
  bool get isMultiBranch => _branches.length > 1;

  BranchModel? branchById(String id) =>
      _branches.where((b) => b.id == id).firstOrNull;

  Future<void> loadBranches(String gymId, {bool force = false}) async {
    if (_loadedGymId == gymId && _branches.isNotEmpty && !force) return;

    _isLoading = true;
    notifyListeners();

    try {
      _branches = await _repository.fetchActiveBranches(gymId);
      _loadedGymId = gymId;
    } catch (e) {
      debugPrint('[BranchProvider] Failed to load branches: $e');
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
    notifyListeners();
  }
}
