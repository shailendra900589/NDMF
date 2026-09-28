import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../routes/app_routes.dart';
import '../theme/app_colors.dart';

bool _sessionDialogOpen = false;

Future<void> showSessionExpiredDialog() async {
  if (_sessionDialogOpen) return;
  if (Get.currentRoute == AppRoutes.login || Get.currentRoute == AppRoutes.splash) return;
  _sessionDialogOpen = true;
  await Get.dialog<void>(
    AlertDialog(
      icon: const Icon(Icons.lock_clock, color: AppColors.warning, size: 40),
      title: const Text('Session expired'),
      content: const Text(
        'Aapka login expire ho gaya hai. Dubara sign in karein.\n\nYour session has ended. Please sign in again.',
      ),
      actions: [
        FilledButton(
          onPressed: () {
            Get.back();
            Get.offAllNamed(AppRoutes.login);
          },
          child: const Text('Sign in'),
        ),
      ],
    ),
    barrierDismissible: false,
  );
  _sessionDialogOpen = false;
}
