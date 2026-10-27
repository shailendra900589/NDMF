import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'dart:io';
import '../../../widgets/live_face_camera.dart';
import '../../../data/models/attendance_model.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/location_service.dart';
import '../../../data/services/tracking_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/api_errors.dart';
import '../../../utils/attendance_state.dart';

class AttendanceController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  LocationService get _location => Get.find<LocationService>();
  TrackingService get _tracking => Get.find<TrackingService>();
  StorageService get _storage => Get.find<StorageService>();

  final history = <AttendanceModel>[].obs;
  final isLoading = false.obs;
  final isProcessing = false.obs;
  AttendanceModel? todayRecord;
  final stateConfirmed = false.obs;
  final loadError = ''.obs;
  final matchPercentage = Rxn<double>();

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
    stateConfirmed.value = false;
    try {
      history.value = await _api.getAttendanceHistory();
      todayRecord = ownAttendanceState(history, _storage.getUser()?.id ?? '');
      stateConfirmed.value = true;
      loadError.value = '';
      try {
        await _tracking.syncWithAttendanceState(todayRecord);
      } catch (_) {
        // Attendance is confirmed even if the GPS tracking service needs to retry.
      }
    } catch (e) {
      loadError.value = apiErrorMessage(e);
    } finally {
      isLoading.value = false;
    }
  }

  Future<void> checkIn() async {
    if (isProcessing.value || !canCheckIn) return;
    isProcessing.value = true;
    try {
      await _api.syncSession();
      await loadHistory();
      if (!stateConfirmed.value || !canCheckIn) return;
      var loc = await _location.getPosition();
      if (loc == null) {
        Get.snackbar('GPS Required',
            'Enable location and allow location permission for attendance');
        return;
      }
      var verified = false;
      if (_roleNeedsFaceWhenEnabled) {
        verified = await _verifyLiveFace();
        if (!verified) return;
      }
      loc = await _location.getPosition();
      if (loc == null) return;

      final saved = await _api.markAttendance(
        isCheckIn: true,
        lat: loc.latitude,
        lng: loc.longitude,
        faceVerified: verified,
        accuracy: loc.accuracy,
        gpsRecordedAt: loc.timestamp.toUtc().toIso8601String(),
        mocked: loc.isMocked,
      );
      todayRecord = saved;
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
      await _api.syncSession();
      await loadHistory();
      if (!stateConfirmed.value) return;
      if (!canCheckOut) {
        Get.snackbar('Attendance refreshed',
            'No open check-in was found for your account.');
        return;
      }
      if (_roleNeedsFaceWhenEnabled) {
        if (!await _verifyLiveFace(purpose: 'checkout')) return;
      }
      final loc = await _location.getPosition();
      if (loc == null) {
        Get.snackbar('GPS Required', 'Location is mandatory for attendance');
        return;
      }
      final saved = await _api.markAttendance(
          isCheckIn: false,
          lat: loc.latitude,
          lng: loc.longitude,
          accuracy: loc.accuracy,
          gpsRecordedAt: loc.timestamp.toUtc().toIso8601String(),
          mocked: loc.isMocked);
      todayRecord = saved;
      await loadHistory();
      Get.snackbar('Success',
          'Checked out • route saved (${_tracking.totalKmToday.value.toStringAsFixed(2)} KM)');
    } catch (e) {
      await loadHistory();
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

  bool get canCheckIn =>
      stateConfirmed.value &&
      (todayRecord == null || !todayRecord!.isCheckedIn);
  bool get canCheckOut =>
      stateConfirmed.value &&
      todayRecord != null &&
      todayRecord!.isCheckedIn &&
      !todayRecord!.isCheckedOut;

  Future<bool> _verifyLiveFace({String purpose = 'checkin'}) async {
    matchPercentage.value=null;
    final status = await _api.getFaceEnrollmentStatus();
    if (status['complete'] != true) {
      Get.snackbar(
          'Face enrollment',
          status['problem']?.toString() ??
              'Complete 3 different reference selfies. Your registration must be confirmed by the server.');
      Get.toNamed(AppRoutes.faceEnrollment);
      return false;
    }
    final challenge = await _api.requestFaceChallenge(purpose);
    final capture = await Get.to<LiveFaceCapture>(
        () => LiveFaceCamera(action: challenge['action']?.toString()));
    if (capture == null || capture.actionPath == null) {
      Get.snackbar('Cancelled', 'Live selfie required for attendance');
      return false;
    }
    Map<String, dynamic> result;
    try {
      result = await _api.verifyLiveAttendanceFace(capture.neutralPath,
          capture.actionPath!, challenge['id'].toString(), purpose);
    } finally {
      for (final path in [capture.neutralPath, capture.actionPath!]) {
        try {
          await File(path).delete();
        } catch (_) {}
      }
    }
    final ok = result['verified'] == true && result['livenessVerified'] == true;
    matchPercentage.value = (result['matchPercentage'] as num?)?.toDouble() ??
        ((result['matchScore'] as num?)?.toDouble() ?? 0) * 100;
    if (ok)
      Get.snackbar('Live face verified',
          'Face similarity ${matchPercentage.value!.toStringAsFixed(0)}%');
    if (!ok) {
      if (result['reason'] != 'mismatch') {
        Get.snackbar(
            'Live check failed',
            result['message']?.toString() ??
                'Follow the camera instructions and retry.');
        return false;
      }
      final reset = await Get.dialog<bool>(
        AlertDialog(
          title: const Text('Face did not match'),
          content: const Text(
            'Try again in bright, even light with your face centered. If the issue continues, reset your enrollment and capture fresh reference selfies.',
          ),
          actions: [
            TextButton(
              onPressed: () => Get.back(result: false),
              child: const Text('Try again later'),
            ),
            FilledButton(
              onPressed: () => Get.back(result: true),
              child: const Text('Reset & re-register'),
            ),
          ],
        ),
      );
      if (reset == true) {
        try {
          await _api.resetFaceEnrollment();
          Get.snackbar('Face reset', 'Capture three new reference selfies.');
          Get.offNamed(AppRoutes.faceEnrollment);
        } catch (e) {
          Get.snackbar('Could not reset face', e.toString());
        }
      }
    }
    return ok;
  }
}
