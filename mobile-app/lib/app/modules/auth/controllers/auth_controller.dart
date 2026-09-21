import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../data/models/enums/app_enums.dart';
import '../../../data/services/ndfa_api_service.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/data_refresh_service.dart';
import '../../../config/demo_credentials.dart';
import '../../../routes/app_routes.dart';

class AuthController extends GetxController {
  NdfaApiService get _api => Get.find<NdfaApiService>();
  StorageService get _storage => Get.find<StorageService>();

  final mobileField = TextEditingController();
  final passwordField = TextEditingController();
  final rememberMe = false.obs;
  final isLoading = false.obs;
  final selectedRole = UserRole.fieldOfficer.obs;
  final obscurePassword = true.obs;

  @override
  void onInit() {
    super.onInit();
    rememberMe.value = _storage.rememberMe;
    // Production: do not auto-fill demo credentials
  }

  @override
  void onClose() {
    mobileField.dispose();
    passwordField.dispose();
    super.onClose();
  }

  void fillFieldOfficerDemo() {
    selectedRole.value = UserRole.fieldOfficer;
    mobileField.text = DemoCredentials.fieldOfficerMobile;
    passwordField.text = DemoCredentials.password;
  }

  void togglePasswordVisibility() => obscurePassword.value = !obscurePassword.value;

  Future<void> login() async {
    final mobile = mobileField.text.trim();
    final password = passwordField.text;
    if (mobile.length < 10) {
      Get.snackbar('Error', 'Enter valid 10-digit mobile number');
      return;
    }
    if (password.length < 4) {
      Get.snackbar('Error', 'Password must be at least 4 characters');
      return;
    }

    isLoading.value = true;
    try {
      await _api.login(
        mobile,
        password,
        selectedRole.value,
      );
      _storage.setRememberMe(rememberMe.value);
      if (Get.isRegistered<DataRefreshService>()) {
        await Get.find<DataRefreshService>().refreshAll(silent: true);
      }
      _navigateAfterLogin();
    } catch (e) {
      final raw = e.toString();
      final msg = raw.contains('SocketException') ||
              raw.contains('Connection') ||
              raw.contains('Failed host lookup') ||
              raw.contains('internet')
          ? 'Cannot reach live server. Check internet and try again.'
          : raw.replaceFirst('Exception: ', '');
      Get.snackbar('Login Failed', msg);
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

  void forgotPassword() {
    Get.snackbar('Forgot Password', 'OTP will be sent to your registered mobile number.');
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
              if (mobileField.text.trim().length < 10) {
                fillFieldOfficerDemo();
              }
              isLoading.value = true;
              try {
                await _api.verifyOtp(mobileField.text.trim(), otpCtrl.text, selectedRole.value);
                _storage.setRememberMe(rememberMe.value);
                if (Get.isRegistered<DataRefreshService>()) {
                  await Get.find<DataRefreshService>().refreshAll(silent: true);
                }
                _navigateAfterLogin();
              } catch (e) {
                Get.snackbar('OTP Failed', e.toString());
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