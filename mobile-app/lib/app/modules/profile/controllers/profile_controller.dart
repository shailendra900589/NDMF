import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/security_platform_service.dart';
import '../../../data/services/camera_service.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/upload_service.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/access_control.dart';
import '../../../utils/app_logout.dart';
import '../../../utils/app_permissions.dart';

class ProfileController extends GetxController {
  final StorageService _storage = Get.find<StorageService>();
  final SecurityPlatformService _security = Get.find<SecurityPlatformService>();
  final CameraService _camera = Get.find<CameraService>();
  final NdfaApiService _api = Get.find<NdfaApiService>();
  final UploadService _upload = Get.find<UploadService>();

  final appVersion = 'Loading…'.obs;
  final screenshotProtection = false.obs;
  final photoPath = RxnString();
  final faceAttendanceRequired = true.obs;
  final facePolicySaving = false.obs;

  @override
  void onInit() {
    super.onInit();
    _loadVersion();
    photoPath.value = _storage.getUser()?.photoUrl;
    faceAttendanceRequired.value =
        _storage.getUser()?.faceAttendanceRequired ?? true;
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      appVersion.value = '${info.version} (${info.buildNumber})';
    } catch (_) {
      appVersion.value = 'Unavailable';
    }
  }

  Future<void> toggleFaceAttendancePolicy(bool enabled) async {
    if (!AccessControl.isAdmin) return;
    facePolicySaving.value = true;
    try {
      await _api.setFaceAttendanceRequired(enabled);
      await _api.syncSession();
      faceAttendanceRequired.value =
          _storage.getUser()?.faceAttendanceRequired ?? enabled;
      if (!enabled) _storage.setFaceEnrollmentSkipped(false);
      Get.snackbar(
        'Policy updated',
        enabled
            ? 'Field staff must use face for attendance'
            : 'Attendance is GPS-only (no face verify)',
      );
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      facePolicySaving.value = false;
    }
  }

  String get name => _storage.getUser()?.name ?? '';
  String get employeeId => _storage.getUser()?.employeeId ?? '';
  String get branch => _storage.getUser()?.branch ?? '';
  String get mobile => _storage.getUser()?.mobile ?? '';
  String get role => _storage.getUser()?.role.label ?? '';
  String get userId => _storage.getUser()?.id ?? '';
  bool get faceEnrollmentComplete =>
      _storage.getUser()?.faceEnrollmentComplete ?? false;

  /// Lets an employee replace a face enrollment that no longer verifies well.
  /// The server writes an audit event and removes the old biometric references.
  Future<void> restartFaceEnrollment() async {
    try {
      await _api.resetFaceEnrollment();
      _storage.setFaceEnrollmentSkipped(false);
      Get.snackbar(
        'Face reset',
        'Capture three new reference selfies in clear, even lighting.',
      );
      Get.toNamed(AppRoutes.faceEnrollment);
    } catch (e) {
      Get.snackbar('Could not reset face', e.toString());
    }
  }

  List<String> get enabledModuleLabels {
    final user = _storage.getUser();
    if (user == null) return [];
    if (user.role == UserRole.admin) return ['All modules (Admin)'];
    return AppPermissions.keys
        .where((k) => user.permissions[k] == true)
        .map((k) => AppPermissions.labels[k] ?? k)
        .toList();
  }

  Future<void> updatePhoto(BuildContext context) async {
    final path = await _camera.showImageSourceDialog(context);
    if (path == null) return;
    try {
      final url = await _upload.uploadPlainFile(path) ?? path;
      photoPath.value = url;
      final user = _storage.getUser();
      if (user != null) {
        final photo = url.contains('/uploads/')
            ? url.substring(url.indexOf('/uploads/'))
            : url;
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
    await AppLogout.run(clearAllLocal: true);
  }

  Future<void> logout() async => AppLogout.confirmAndRun();

  void navigateToChangePassword() => Get.toNamed(AppRoutes.changePassword);
  void navigateToDeviceInfo() => Get.toNamed(AppRoutes.deviceInfo);
}
