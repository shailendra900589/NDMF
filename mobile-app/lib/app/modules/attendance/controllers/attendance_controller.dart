import 'package:get/get.dart';
import '../../../data/models/attendance_model.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/tracking_service.dart';

class AttendanceController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  LocationService get _location => Get.find<LocationService>();
  TrackingService get _tracking => Get.find<TrackingService>();

  final history = <AttendanceModel>[].obs;
  final isLoading = false.obs;
  final isProcessing = false.obs;
  AttendanceModel? todayRecord;

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
      final loc = await _location.getCurrentLocation();
      if (loc == null) {
        Get.snackbar('GPS Required', 'Location is mandatory for attendance');
        return;
      }
      await _api.markAttendance(isCheckIn: true, lat: loc.latitude, lng: loc.longitude);
      await loadHistory();
      Get.snackbar('Success', 'Checked in • GPS route tracking started');
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
}
