import 'package:flutter/foundation.dart';
import 'models/invoice_model.dart';
import 'billing_repository.dart';
import '../../utils/error_utils.dart';

class BillingProvider extends ChangeNotifier {
  final BillingRepository _repo;

  BillingProvider({BillingRepository? repository})
      : _repo = repository ?? BillingRepository();

  // ─── Invoice list state ───────────────────────────────────────────────────
  List<InvoiceModel> _invoices = [];
  bool _isLoadingList = false;
  String? _listError;
  String? _loadedMemberId;

  List<InvoiceModel> get invoices => _invoices;
  bool get isLoadingList => _isLoadingList;
  String? get listError => _listError;

  // ─── Invoice detail state ─────────────────────────────────────────────────
  InvoiceDetails? _selectedDetails;
  bool _isLoadingDetail = false;
  String? _detailError;

  InvoiceDetails? get selectedDetails => _selectedDetails;
  bool get isLoadingDetail => _isLoadingDetail;
  String? get detailError => _detailError;

  // ─── Actions ──────────────────────────────────────────────────────────────

  Future<void> loadInvoices(String memberId, {bool force = false}) async {
    if (_loadedMemberId == memberId && _invoices.isNotEmpty && !force) return;

    _isLoadingList = true;
    _listError = null;
    notifyListeners();

    try {
      _invoices = await _repo.getInvoices(memberId);
      _loadedMemberId = memberId;
    } catch (e) {
      _listError = friendlyError(e);
      _invoices = [];
    } finally {
      _isLoadingList = false;
      notifyListeners();
    }
  }

  Future<void> loadInvoiceDetails(String invoiceId, String memberId) async {
    _isLoadingDetail = true;
    _detailError = null;
    _selectedDetails = null;
    notifyListeners();

    try {
      _selectedDetails = await _repo.getInvoiceDetails(invoiceId, memberId);
    } catch (e) {
      _detailError = friendlyError(e);
    } finally {
      _isLoadingDetail = false;
      notifyListeners();
    }
  }

  void clearDetails() {
    _selectedDetails = null;
    _detailError = null;
    // Use Future.microtask to avoid calling notifyListeners during dispose
    Future.microtask(() => notifyListeners());
  }
}
