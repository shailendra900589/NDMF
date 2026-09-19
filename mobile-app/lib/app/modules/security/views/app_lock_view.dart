import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../controllers/security_controller.dart';

class AppLockView extends GetView<SecurityController> {
  const AppLockView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.lock, size: 64, color: Colors.white),
            const SizedBox(height: 16),
            Obx(() => Text(
                  controller.isSettingPin.value || !controller.hasPin
                      ? controller.pinStep.value == 0
                          ? 'Set App PIN'
                          : 'Confirm PIN'
                      : 'Enter PIN',
                  style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                )),
            const SizedBox(height: 32),
            Obx(() => Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(4, (i) {
                    return Container(
                      margin: const EdgeInsets.symmetric(horizontal: 12),
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: i < controller.pinInput.value.length ? Colors.white : Colors.white24,
                        border: Border.all(color: Colors.white54),
                      ),
                    );
                  }),
                )),
            const SizedBox(height: 48),
            _pinPad(),
            const SizedBox(height: 24),
            if (controller.hasPin && !controller.isSettingPin.value)
              Obx(() => controller.biometricAvailable.value
                  ? TextButton(
                      onPressed: controller.authenticateWithBiometric,
                      child: const Text('Use Biometric', style: TextStyle(color: Colors.white70)),
                    )
                  : const SizedBox.shrink()),
            if (!controller.hasPin)
              TextButton(
                onPressed: controller.startSetPin,
                child: const Text('Set PIN', style: TextStyle(color: Colors.white70)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _pinPad() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 48),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          childAspectRatio: 1.5,
        ),
        itemCount: keys.length,
        itemBuilder: (context, index) {
          final key = keys[index];
          if (key.isEmpty) return const SizedBox.shrink();
          return InkWell(
            onTap: () {
              if (key == 'del') {
                controller.removeDigit();
              } else {
                controller.addDigit(key);
              }
            },
            borderRadius: BorderRadius.circular(40),
            child: Center(
              child: key == 'del'
                  ? const Icon(Icons.backspace_outlined, color: Colors.white, size: 24)
                  : Text(key, style: const TextStyle(color: Colors.white, fontSize: 28)),
            ),
          );
        },
      ),
    );
  }
}
