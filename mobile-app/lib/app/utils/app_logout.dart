import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/services/api_constants.dart';
import '../data/services/remote_api_service.dart';
import '../data/services/storage_service.dart';
import '../routes/app_routes.dart';

/// Sign out — optional API call, clear session, navigate to login.
class AppLogout {
  AppLogout._();

  static Future<void> confirmAndRun({bool clearAllLocal = false}) async {
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
