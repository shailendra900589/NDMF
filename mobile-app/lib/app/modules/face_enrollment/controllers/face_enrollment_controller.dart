import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/upload_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';

class FaceEnrollmentController extends GetxController {
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final UploadService _upload = Get.find<UploadService>();
  final StorageService _storage = Get.find<StorageService>();

  final List<String> capturedUrls = [];
  bool isSaving = false;

  int get capturedCount => capturedUrls.length;

  @override
  void onInit() {
    super.onInit();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    if (kIsWeb) return;
    try {
      final s = await _api.getFaceEnrollmentStatus();
      if (s['complete'] == true) _goHome();
    } catch (_) {}
  }

  Future<void> captureReferencePhoto() async {
    if (capturedUrls.length >= 3) {
      Get.snackbar('Done', 'You already have 3 reference photos');
      return;
    }
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 85,
    );
    if (file == null) return;
    try {
      final url = await _upload.uploadPlainFile(file.path, type: 'photo');
      if (url != null && url.isNotEmpty) {
        capturedUrls.add(url);
        update();
      }
    } catch (e) {
      Get.snackbar('Upload failed', e.toString());
    }
  }

  Future<void> saveAndContinue() async {
    if (capturedUrls.length < 3) {
      Get.snackbar('Need 3 photos', 'Capture at least 3 clear face photos (angles slightly different)');
      return;
    }
    isSaving = true;
    update();
    try {
      await _api.saveFaceEnrollmentUrls(List<String>.from(capturedUrls));
      _storage.setFaceEnrollmentSkipped(false);
      await _api.syncSession();
      _goHome();
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isSaving = false;
      update();
    }
  }

  void _goHome() {
    if (_storage.hasPin) {
      Get.offAllNamed(AppRoutes.appLock);
    } else {
      Get.offAllNamed(AppRoutes.home);
    }
  }

  void skipEnrollment() {
    _storage.setFaceEnrollmentSkipped(true);
    Get.snackbar(
      'Skipped',
      'You can enroll later from Profile. Attendance may require face if admin has enabled it.',
    );
    _goHome();
  }
}
