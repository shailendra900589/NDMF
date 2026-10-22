import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../modules/profile/bindings/profile_binding.dart';
import '../modules/profile/controllers/profile_controller.dart';
import '../routes/app_routes.dart';

class ProfileAppBarButton extends StatelessWidget {
  const ProfileAppBarButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Profile',
      visualDensity: VisualDensity.compact,
      onPressed: () {
        if (!Get.isRegistered<ProfileController>()) {
          ProfileBinding().dependencies();
        }
        Get.toNamed(AppRoutes.profile);
      },
      icon: const Icon(Icons.person_rounded, color: Colors.white),
    );
  }
}
