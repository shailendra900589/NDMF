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

  final capturedUrls = <String>[].obs;
  final isSaving = false.obs;

  @override
  void onInit() {
    super.onInit();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
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
    isSaving.value = true;
    try {
      await _api.saveFaceEnrollmentUrls(capturedUrls.toList());
      final user = _storage.getUser();
      if (user != null) {
        await _api.syncSession();
      }
      _goHome();
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isSaving.value = false;
    }
  }

  void _goHome() {
    if (_storage.hasPin) {
      Get.offAllNamed(AppRoutes.appLock);
    } else {
      Get.offAllNamed(AppRoutes.home);
    }
  }
}
