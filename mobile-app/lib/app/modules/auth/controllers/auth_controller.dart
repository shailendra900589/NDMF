import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/data_refresh_service.dart';
import '../../../routes/app_routes.dart';

class AuthController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  StorageService get _storage => Get.find<StorageService>();

  final loginIdField = TextEditingController();
  final passwordField = TextEditingController();
  final rememberMe = false.obs;
  final isLoading = false.obs;
  final obscurePassword = true.obs;

  @override
  void onInit() {
    super.onInit();
    rememberMe.value = _storage.rememberMe;
  }

  @override
  void onClose() {
    loginIdField.dispose();
    passwordField.dispose();
    super.onClose();
  }

  void togglePasswordVisibility() => obscurePassword.value = !obscurePassword.value;

  Future<void> login() async {
    final loginId = loginIdField.text.trim();
    final password = passwordField.text;
    if (loginId.length < 3) {
      Get.snackbar('Error', 'Enter Login ID (Employee ID or mobile)');
      return;
    }
    if (password.length < 4) {
      Get.snackbar('Error', 'Password must be at least 4 characters');
      return;
    }

    isLoading.value = true;
    try {
      await _api.login(loginId, password);
      await _api.syncSession();
      _storage.setRememberMe(rememberMe.value);
      if (Get.isRegistered<DataRefreshService>()) {
        Get.find<DataRefreshService>().refreshAll(silent: true);
      }
      _navigateAfterLogin();
    } catch (e) {
      Get.snackbar('Login Failed', e.toString().replaceFirst('Exception: ', ''));
    } finally {
      isLoading.value = false;
    }
  }

  void _navigateAfterLogin() {
    if (_storage.hasPin) {
      Get.offAllNamed(AppRoutes.appLock);
    } else {
      Get.offAllNamed(AppRoutes.home);
    }
  }

  void showOtpLogin() {
    final otpCtrl = TextEditingController();
    Get.dialog(
      AlertDialog(
        title: const Text('OTP Login'),
        content: TextField(
          controller: otpCtrl,
          keyboardType: TextInputType.number,
          maxLength: 6,
          decoration: const InputDecoration(
            labelText: 'Enter OTP',
            hintText: '123456',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Get.back(), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (otpCtrl.text.length < 6) {
                Get.snackbar('Error', 'Enter 6-digit OTP');
                return;
              }
              Get.back();
              final loginId = loginIdField.text.trim();
              if (loginId.length < 3) {
                Get.snackbar('Error', 'Enter Login ID first');
                return;
              }
              isLoading.value = true;
              try {
                await _api.sendOtp(loginId);
                await _api.verifyOtp(loginId, otpCtrl.text);
                _storage.setRememberMe(rememberMe.value);
                if (Get.isRegistered<DataRefreshService>()) {
                  Get.find<DataRefreshService>().refreshAll(silent: true);
                }
                _navigateAfterLogin();
              } catch (e) {
                Get.snackbar('OTP Failed', e.toString().replaceFirst('Exception: ', ''));
              } finally {
                isLoading.value = false;
              }
            },
            child: const Text('Verify & Login'),
          ),
        ],
      ),
    );
  }

  Future<void> logout() async {
    await _storage.logoutAllSessions();
    Get.offAllNamed(AppRoutes.login);
  }
}
