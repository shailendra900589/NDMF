import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/services/api_constants.dart';
import '../data/services/ndfa_api_service.dart';
import '../data/services/remote_api_service.dart';
import '../data/services/storage_service.dart';
import '../data/services/tracking_service.dart';
import '../routes/app_routes.dart';
import 'attendance_state.dart';

/// Sign out — optional API call, clear session, navigate to login.
class AppLogout {
  AppLogout._();

  static Future<void> confirmAndRun({bool clearAllLocal = false}) async {
    if (Get.isRegistered<TrackingService>() &&
        Get.find<TrackingService>().isTracking.value) {
      Get.snackbar(
        'Check out first',
        'Duty GPS stays on until you check out from Attendance. Logout is blocked while you are on duty.',
        snackPosition: SnackPosition.BOTTOM,
        duration: const Duration(seconds: 4),
      );
      return;
    }
    try {
      if (Get.isRegistered<NdfaApiService>() && ApiConstants.useRemoteApi) {
        final history = await Get.find<NdfaApiService>().getAttendanceHistory();
        final today = ownAttendanceState(
            history, Get.find<StorageService>().getUser()?.id ?? '');
        if (today != null && today.isCheckedIn && !today.isCheckedOut) {
          Get.snackbar(
            'Check out first',
            'You are still checked in. Complete check-out so duty GPS can stop safely.',
            snackPosition: SnackPosition.BOTTOM,
            duration: const Duration(seconds: 4),
          );
          return;
        }
      }
    } catch (_) {}

    final confirm = await Get.dialog<bool>(
      AlertDialog(
        title: const Text('Logout'),
        content: Text(
          clearAllLocal
              ? 'This will sign out and clear all local app data. Continue?'
              : 'Are you sure you want to sign out?',
        ),
        actions: [
          TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Get.back(result: true), child: const Text('Logout')),
        ],
      ),
    );
    if (confirm == true) await run(clearAllLocal: clearAllLocal);
  }

  static Future<void> run({bool clearAllLocal = false}) async {
    if (ApiConstants.useRemoteApi) {
      try {
        await Get.find<RemoteApiService>().logout();
      } catch (_) {}
    }
    await Get.find<StorageService>().logoutAllSessions();
    Get.offAllNamed(AppRoutes.login);
  }
}
