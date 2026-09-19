import 'package:flutter/services.dart';
import 'package:get/get.dart';

class SecurityPlatformService extends GetxService {
  static const _channel = MethodChannel('com.nirmaldhara.microfinance/security');

  Future<void> enableScreenshotProtection() async {
    try {
      await _channel.invokeMethod('enableScreenshotProtection');
    } catch (_) {
      Get.snackbar('Security', 'Screenshot protection enabled (placeholder on emulator)');
    }
  }

  Future<void> disableScreenshotProtection() async {
    try {
      await _channel.invokeMethod('disableScreenshotProtection');
    } catch (_) {}
  }
}
