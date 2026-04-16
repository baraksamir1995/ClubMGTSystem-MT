import '../../models/branch_model.dart';
import '../../services/api_service.dart';

class BranchRepository {
  final ApiService _service;

  BranchRepository({ApiService? service})
      : _service = service ?? ApiService();

  Future<List<BranchModel>> fetchActiveBranches(String gymId) async {
    try {
      final data = await _service.getBranches();
      return data
          .map((row) => BranchModel.fromJson(row))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
