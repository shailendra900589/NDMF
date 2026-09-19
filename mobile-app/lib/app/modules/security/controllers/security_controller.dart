import 'package:get/get.dart';
import 'package:local_auth/local_auth.dart';
import '../../../data/services/storage_service.dart';
import '../../../data/services/security_platform_service.dart';
import '../../../routes/app_routes.dart';

class SecurityController extends GetxController {
  final StorageService _storage = Get.find<StorageService>();
  final SecurityPlatformService _platform = Get.find<SecurityPlatformService>();
  final LocalAuthentication _localAuth = LocalAuthentication();

  final pinInput = ''.obs;
  final isSettingPin = false.obs;
  final confirmPin = ''.obs;
  final pinStep = 0.obs;
  final screenshotProtectionEnabled = false.obs;
  final biometricAvailable = false.obs;

  @override
  void onInit() {
    super.onInit();
    _checkBiometric();
    if (Get.arguments == 'setup') {
      startSetPin();
    }
  }

  Future<void> _checkBiometric() async {
    try {
      biometricAvailable.value =
          await _localAuth.canCheckBiometrics || await _localAuth.isDeviceSupported();
    } catch (_) {
      biometricAvailable.value = false;
    }
  }

  bool get hasPin => _storage.hasPin;

  void addDigit(String digit) {
    if (pinInput.value.length >= 4) return;
    pinInput.value += digit;
    if (pinInput.value.length == 4) {
      _handlePinComplete();
    }
  }

  void removeDigit() {
    if (pinInput.value.isNotEmpty) {
      pinInput.value = pinInput.value.substring(0, pinInput.value.length - 1);
    }
  }

  void _handlePinComplete() {
    if (isSettingPin.value || !hasPin) {
      if (pinStep.value == 0) {
        confirmPin.value = pinInput.value;
        pinInput.value = '';
        pinStep.value = 1;
        Get.snackbar('Confirm PIN', 'Re-enter your PIN to confirm');
      } else {
        if (pinInput.value == confirmPin.value) {
          _storage.savePin(pinInput.value);
          Get.snackbar('Success', 'PIN set successfully');
          Get.offAllNamed(AppRoutes.home);
        } else {
          Get.snackbar('Error', 'PINs do not match. Try again.');
          pinInput.value = '';
          pinStep.value = 0;
          confirmPin.value = '';
        }
      }
    } else {
      if (pinInput.value == _storage.getPin()) {
        Get.offAllNamed(AppRoutes.home);
      } else {
        Get.snackbar('Error', 'Incorrect PIN');
        pinInput.value = '';
      }
    }
  }

  void startSetPin() {
    isSettingPin.value = true;
    pinStep.value = 0;
    pinInput.value = '';
  }

  Future<void> authenticateWithBiometric() async {
    if (!biometricAvailable.value) {
      Get.snackbar('Biometric', 'Biometric authentication not available on this device');
      return;
    }
    try {
      final authenticated = await _localAuth.authenticate(
        localizedReason: 'Unlock Nirmaldhara Micro Finance',
        options: const AuthenticationOptions(
          biometricOnly: true,
          stickyAuth: true,
        ),
      );
      if (authenticated) {
        Get.offAllNamed(AppRoutes.home);
      }
    } catch (e) {
      Get.snackbar('Biometric', 'Authentication failed: $e');
    }
  }

  Future<void> toggleScreenshotProtection(bool enabled) async {
    if (enabled) {
      await _platform.enableScreenshotProtection();
    } else {
      await _platform.disableScreenshotProtection();
    }
    screenshotProtectionEnabled.value = enabled;
    Get.snackbar('Security', enabled ? 'Screenshot protection enabled' : 'Screenshot protection disabled');
  }

  Future<void> logoutAllSessions() async {
    await _storage.logoutAllSessions();
    Get.offAllNamed(AppRoutes.login);
  }
}
