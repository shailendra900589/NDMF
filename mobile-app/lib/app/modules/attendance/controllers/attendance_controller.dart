import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import '../../../data/models/attendance_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/tracking_service.dart';
import '../../../data/services/storage_service.dart';

class AttendanceController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  LocationService get _location => Get.find<LocationService>();
  TrackingService get _tracking => Get.find<TrackingService>();
  StorageService get _storage => Get.find<StorageService>();

  final history = <AttendanceModel>[].obs;
  final isLoading = false.obs;
  final isProcessing = false.obs;
  AttendanceModel? todayRecord;

  bool get facePolicyRequired => _storage.getUser()?.faceAttendanceRequired ?? true;

  bool get _roleNeedsFaceWhenEnabled {
    final role = _storage.getUser()?.role;
    return role == UserRole.fieldOfficer || role == UserRole.branchManager;
  }

  @override
  void onInit() {
    super.onInit();
    loadHistory();
  }

  Future<void> loadHistory() async {
    isLoading.value = true;
    try {
      history.value = await _api.getAttendanceHistory();
      final today = DateTime.now();
      todayRecord = history.firstWhereOrNull(
        (a) => a.date.year == today.year && a.date.month == today.month && a.date.day == today.day,
      );
      await _tracking.syncWithAttendanceState(todayRecord);
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> checkIn() async {
    isProcessing.value = true;
    try {
      var verified = false;
      if (facePolicyRequired && _roleNeedsFaceWhenEnabled) {
        verified = await _verifyLiveFace();
        if (!verified) return;
      }

      final loc = await _location.getCurrentLocation();
      if (loc == null) {
        Get.snackbar('GPS Required', 'Location is mandatory for attendance');
        return;
      }
      await _api.markAttendance(
        isCheckIn: true,
        lat: loc.latitude,
        lng: loc.longitude,
        faceVerified: verified,
      );
      await loadHistory();
      Get.snackbar(
        'Success',
        facePolicyRequired && _roleNeedsFaceWhenEnabled
            ? 'Checked in • face + GPS verified'
            : 'Checked in • GPS verified',
      );
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isProcessing.value = false;
    }
  }

  Future<void> checkOut() async {
    isProcessing.value = true;
    try {
      final loc = await _location.getCurrentLocation();
      if (loc == null) {
        Get.snackbar('GPS Required', 'Location is mandatory for attendance');
        return;
      }
      await _api.markAttendance(isCheckIn: false, lat: loc.latitude, lng: loc.longitude);
      await loadHistory();
      Get.snackbar('Success', 'Checked out • route saved (${_tracking.totalKmToday.value.toStringAsFixed(2)} KM)');
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isProcessing.value = false;
    }
  }

  double get distanceFromBranch {
    if (todayRecord?.checkInLat == null) return 0;
    return _location.distanceFromBranch(todayRecord!.checkInLat!, todayRecord!.checkInLng!);
  }

  bool get canCheckIn => todayRecord == null || !todayRecord!.isCheckedIn;
  bool get canCheckOut => todayRecord != null && todayRecord!.isCheckedIn && !todayRecord!.isCheckedOut;

  Future<bool> _verifyLiveFace() async {
    final status = await _api.getFaceEnrollmentStatus();
    if (status['complete'] != true) {
      Get.snackbar('Face enrollment', 'Complete 3 reference selfies first (Profile → Face enrollment)');
      return false;
    }
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 80,
    );
    if (file == null) {
      Get.snackbar('Cancelled', 'Live selfie required for attendance');
      return false;
    }
    final ok = await _api.verifyAttendanceFace(file.path);
    if (!ok) {
      Get.snackbar('Verification failed', 'Face did not match — try again in good light');
    }
    return ok;
  }
}
