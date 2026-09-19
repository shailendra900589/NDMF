import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/security_platform_service.dart';
import '../../../data/services/camera_service.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/upload_service.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../routes/app_routes.dart';

class ProfileController extends GetxController {
  final StorageService _storage = Get.find<StorageService>();
  final SecurityPlatformService _security = Get.find<SecurityPlatformService>();
  final CameraService _camera = Get.find<CameraService>();
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final UploadService _upload = Get.find<UploadService>();

  final appVersion = '1.0.0'.obs;
  final screenshotProtection = false.obs;
  final photoPath = RxnString();

  @override
  void onInit() {
    super.onInit();
    photoPath.value = _storage.getUser()?.photoUrl;
  }

  String get name => _storage.getUser()?.name ?? '';
  String get employeeId => _storage.getUser()?.employeeId ?? '';
  String get branch => _storage.getUser()?.branch ?? '';
  String get mobile => _storage.getUser()?.mobile ?? '';
  String get role => _storage.getUser()?.role.label ?? '';

  Future<void> updatePhoto(BuildContext context) async {
    final path = await _camera.showImageSourceDialog(context);
    if (path == null) return;
    try {
      final url = await _upload.uploadPlainFile(path) ?? path;
      photoPath.value = url;
      final user = _storage.getUser();
      if (user != null) {
        final photo = url.contains('/uploads/') ? url.substring(url.indexOf('/uploads/')) : url;
        await _api.updateProfile(photoUrl: photo);
        _storage.saveUser(user.copyWith(photoUrl: photo));
        Get.snackbar('Success', 'Profile photo updated');
      }
    } catch (e) {
      Get.snackbar('Error', e.toString());
    }
  }

  Future<void> changePassword(String oldPass, String newPass) async {
    if (oldPass.length < 4 || newPass.length < 4) {
      Get.snackbar('Error', 'Password must be at least 4 characters');
      return;
    }
    try {
      await _api.changePassword(oldPass, newPass);
      Get.snackbar('Success', 'Password changed successfully');
      Get.back();
    } catch (e) {
      Get.snackbar('Error', e.toString());
    }
  }

  Future<void> toggleScreenshotProtection(bool value) async {
    if (value) {
      await _security.enableScreenshotProtection();
    } else {
      await _security.disableScreenshotProtection();
    }
    screenshotProtection.value = value;
  }

  Future<void> logoutAllSessions() async {
    await _storage.logoutAllSessions();
    Get.offAllNamed(AppRoutes.login);
  }

  Future<void> logout() async {
    await _storage.logoutAllSessions();
    Get.offAllNamed(AppRoutes.login);
  }

  void navigateToChangePassword() => Get.toNamed(AppRoutes.changePassword);
  void navigateToDeviceInfo() => Get.toNamed(AppRoutes.deviceInfo);
}
