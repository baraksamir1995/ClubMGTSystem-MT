import '../../services/api_service.dart';
import 'models/invoice_model.dart';

class BillingRepository {
  final ApiService _service;

  BillingRepository({ApiService? service})
      : _service = service ?? ApiService();

  Future<List<InvoiceModel>> getInvoices(String memberId) async {
    final data = await _service.getPayments(memberId);
    return data
        .map((row) => InvoiceModel.fromJson(row))
        .toList();
  }

  Future<InvoiceDetails> getInvoiceDetails(
      String invoiceId, String memberId) async {
    final data = await _service.getPaymentById(invoiceId, memberId);
    if (data == null) throw Exception('Invoice not found');
    return InvoiceDetails.fromJson(data);
  }
}
