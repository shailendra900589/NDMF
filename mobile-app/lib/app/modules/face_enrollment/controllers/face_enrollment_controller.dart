import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/upload_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/api_errors.dart';

class FaceEnrollmentController extends GetxController {
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final UploadService _upload = Get.find<UploadService>();
  final StorageService _storage = Get.find<StorageService>();

  final List<String> capturedUrls = [];
  bool isSaving = false;
  bool isCapturing = false;

  int get capturedCount => capturedUrls.length;

  void retakePhotos() {
    if (isSaving || isCapturing) return;
    capturedUrls.clear();
    update();
  }

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
    if (isSaving || isCapturing) return;
    if (capturedUrls.length >= 3) {
      Get.snackbar('Done', 'You already have 3 reference photos');
      return;
    }
    isCapturing = true;
    update();
    try {
      final picker = ImagePicker();
      final file = await picker.pickImage(
        source: ImageSource.camera,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
        maxWidth: 1280,
        maxHeight: 1280,
      );
      if (file == null) return;
      final url = await _upload.uploadPlainFile(file.path, type: 'photo');
      if (url != null && url.contains('/uploads/')) {
        capturedUrls.add(url);
        update();
      } else {
        throw Exception(
            'Photo was not uploaded. Check your connection and capture it again.');
      }
    } catch (e) {
      Get.snackbar('Capture failed', apiErrorMessage(e));
    } finally {
      isCapturing = false;
      update();
    }
  }

  Future<void> saveAndContinue() async {
    if (isSaving || isCapturing) return;
    if (capturedUrls.length < 3) {
      Get.snackbar('Need 3 photos',
          'Capture at least 3 clear face photos (angles slightly different)');
      return;
    }
    isSaving = true;
    update();
    try {
      await _api.saveFaceEnrollmentUrls(List<String>.from(capturedUrls));
      final status = await _api.getFaceEnrollmentStatus();
      if (status['complete'] != true) {
        throw Exception(status['problem'] ??
            'Registration is not ready. Please retry saving.');
      }
      _storage.setFaceEnrollmentSkipped(false);
      // The save response already refreshed the user. A later profile timeout must
      // not turn a confirmed registration into an apparent failed registration.
      try {
        await _api.syncSession();
      } catch (_) {}
      _goHome();
    } catch (e) {
      Get.snackbar('Registration not confirmed', apiErrorMessage(e));
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
