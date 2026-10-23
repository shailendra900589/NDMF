import 'package:get/get.dart';
import 'package:image_picker/image_picker.dart';
import '../../../data/models/attendance_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/tracking_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/api_errors.dart';

class AttendanceController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  LocationService get _location => Get.find<LocationService>();
  TrackingService get _tracking => Get.find<TrackingService>();
  StorageService get _storage => Get.find<StorageService>();

  final history = <AttendanceModel>[].obs;
  final isLoading = false.obs;
  final isProcessing = false.obs;
  AttendanceModel? todayRecord;

  bool get facePolicyRequired =>
      _storage.getUser()?.faceAttendanceRequired ?? true;

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
      final activeShift = history.firstWhereOrNull((a) {
        if (a.checkInTime == null || a.checkOutTime != null) return false;
        final age = today.difference(a.checkInTime!.toLocal());
        return !age.isNegative && age <= const Duration(hours: 20);
      });
      todayRecord = activeShift ??
          history.firstWhereOrNull((a) {
            final localDate = a.date.toLocal();
            return localDate.year == today.year &&
                localDate.month == today.month &&
                localDate.day == today.day;
          });
      await _tracking.syncWithAttendanceState(todayRecord);
    } catch (e) {
      Get.snackbar('Error', e.toString());
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> checkIn() async {
    if (isProcessing.value || !canCheckIn) return;
    isProcessing.value = true;
    try {
      await _api.syncSession();
      final loc = await _location.getPosition();
      if (loc == null) {
        Get.snackbar('GPS Required',
            'Enable location and allow location permission for attendance');
        return;
      }
      var verified = false;
      if (facePolicyRequired && _roleNeedsFaceWhenEnabled) {
        verified = await _verifyLiveFace();
        if (!verified) return;
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
      Get.snackbar('Check-in failed', apiErrorMessage(e));
    } finally {
      isProcessing.value = false;
    }
  }

  Future<void> checkOut() async {
    if (isProcessing.value || !canCheckOut) return;
    isProcessing.value = true;
    try {
      final loc = await _location.getCurrentLocation();
      if (loc == null) {
        Get.snackbar('GPS Required', 'Location is mandatory for attendance');
        return;
      }
      await _api.markAttendance(
          isCheckIn: false, lat: loc.latitude, lng: loc.longitude);
      await loadHistory();
      Get.snackbar('Success',
          'Checked out • route saved (${_tracking.totalKmToday.value.toStringAsFixed(2)} KM)');
    } catch (e) {
      Get.snackbar('Check-out failed', apiErrorMessage(e));
    } finally {
      isProcessing.value = false;
    }
  }

  double get distanceFromBranch {
    if (todayRecord?.checkInLat == null) return 0;
    return _location.distanceFromBranch(
        todayRecord!.checkInLat!, todayRecord!.checkInLng!);
  }

  bool get canCheckIn => todayRecord == null || !todayRecord!.isCheckedIn;
  bool get canCheckOut =>
      todayRecord != null &&
      todayRecord!.isCheckedIn &&
      !todayRecord!.isCheckedOut;

  Future<bool> _verifyLiveFace() async {
    final status = await _api.getFaceEnrollmentStatus();
    if (status['complete'] != true) {
      Get.snackbar(
          'Face enrollment',
          status['problem']?.toString() ??
              'Complete 3 different reference selfies. Your registration must be confirmed by the server.');
      Get.toNamed(AppRoutes.faceEnrollment);
      return false;
    }
    final picker = ImagePicker();
    final file = await picker.pickImage(
      source: ImageSource.camera,
      preferredCameraDevice: CameraDevice.front,
      imageQuality: 80,
      maxWidth: 1280,
      maxHeight: 1280,
    );
    if (file == null) {
      Get.snackbar('Cancelled', 'Live selfie required for attendance');
      return false;
    }
    final ok = await _api.verifyAttendanceFace(file.path);
    if (!ok) {
      Get.snackbar('Verification failed',
          'Face did not match — try again in good light');
    }
    return ok;
  }
}
