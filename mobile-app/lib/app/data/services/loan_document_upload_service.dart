import 'package:get/get.dart';
import '../models/loan_model.dart';
import 'upload_service.dart';

/// Uploads loan KYC documents to server before submit/sync.
class LoanDocumentUploadService {
  UploadService get _upload => Get.find<UploadService>();

  Future<LoanModel> uploadAll(LoanModel loan) async {
    final d = loan.documents;
    d.aadhaarPhoto = await _uploadDoc(d.aadhaarPhoto);
    d.panPhoto = await _uploadDoc(d.panPhoto);
    d.customerPhoto = await _uploadDoc(d.customerPhoto);
    d.shopFront = await _uploadDoc(d.shopFront);
    d.shopInside = await _uploadDoc(d.shopInside);
    d.businessActivity = await _uploadDoc(d.businessActivity);
    return loan;
  }

  Future<String?> _uploadDoc(String? path) async {
    if (path == null || path.isEmpty) return path;
    if (path.contains('/uploads/') || path.startsWith('http')) return path;
    return _upload.uploadPlainFile(path, type: 'photo');
  }
}
