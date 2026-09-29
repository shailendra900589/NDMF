import 'dart:io';
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../widgets/custom_app_bar.dart';
import '../../../routes/app_routes.dart';
import '../../../utils/access_control.dart';
import '../controllers/profile_controller.dart';

class ProfileView extends GetView<ProfileController> {
  const ProfileView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Profile', subtitle: 'Account & security'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Container(
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Stack(
                      children: [
                        Obx(() {
                          final path = controller.photoPath.value;
                          return CircleAvatar(
                            radius: 48,
                            backgroundColor: AppColors.primary.withValues(alpha: 0.15),
                            backgroundImage: path != null ? FileImage(File(path)) : null,
                            child: path == null
                                ? Text(
                                    controller.name.isNotEmpty ? controller.name[0] : 'U',
                                    style: const TextStyle(fontSize: 36, color: AppColors.primary),
                                  )
                                : null,
                          );
                        }),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: CircleAvatar(
                            radius: 16,
                            backgroundColor: AppColors.accent,
                            child: IconButton(
                              icon: const Icon(Icons.camera_alt, size: 16, color: Colors.white),
                              onPressed: () => controller.updatePhoto(context),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(controller.name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
                    Text(controller.role, style: const TextStyle(color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _tile(Icons.badge, 'Employee ID', controller.employeeId),
            _tile(Icons.business, 'Branch', controller.branch),
            _tile(Icons.phone, 'Mobile', controller.mobile),
            _menuTile(Icons.lock, 'Change Password', controller.navigateToChangePassword),
            if (AccessControl.isAdmin)
              Container(
                margin: const EdgeInsets.only(bottom: 8),
                decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
                child: Obx(() => SwitchListTile(
                      secondary: const Icon(Icons.face_retouching_natural, color: AppColors.primary),
                      title: const Text('Face attendance policy'),
                      subtitle: const Text('OFF = GPS-only check-in for FO/BM'),
                      value: controller.faceAttendanceRequired.value,
                      onChanged: controller.facePolicySaving.value
                          ? null
                          : controller.toggleFaceAttendancePolicy,
                    )),
              ),
            Obx(() {
              if (!(AccessControl.isFieldOfficer || AccessControl.isBranchManager)) {
                return const SizedBox.shrink();
              }
              if (!controller.faceAttendanceRequired.value) {
                return const SizedBox.shrink();
              }
              return _menuTile(Icons.face, 'Face enrollment', () => Get.toNamed(AppRoutes.faceEnrollment));
            }),
            _menuTile(Icons.phone_android, 'Device Info', controller.navigateToDeviceInfo),
            _menuTile(Icons.security, 'App Lock (PIN)', () => Get.toNamed(AppRoutes.appLock, arguments: 'setup')),
            Container(
              margin: const EdgeInsets.only(bottom: 8),
              decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
              child: Obx(() => SwitchListTile(
                    secondary: const Icon(Icons.screenshot_monitor, color: AppColors.primary),
                    title: const Text('Screenshot Protection'),
                    subtitle: const Text('Prevent screenshots on sensitive screens'),
                    value: controller.screenshotProtection.value,
                    onChanged: controller.toggleScreenshotProtection,
                  )),
            ),
            _menuTile(Icons.logout, 'Logout All Sessions', () async {
              final confirm = await Get.dialog<bool>(
                AlertDialog(
                  title: const Text('Logout All Sessions'),
                  content: const Text('This will clear all local data. Continue?'),
                  actions: [
                    TextButton(onPressed: () => Get.back(result: false), child: const Text('Cancel')),
                    ElevatedButton(onPressed: () => Get.back(result: true), child: const Text('Logout')),
                  ],
                ),
              );
              if (confirm == true) await controller.logoutAllSessions();
            }),
            _menuTile(Icons.info_outline, 'App Version', () {}, trailing: Obx(() => Text('v${controller.appVersion.value}'))),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: controller.logout,
              icon: const Icon(Icons.logout, color: AppColors.error),
              label: const Text('Logout', style: TextStyle(color: AppColors.error)),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.error),
                minimumSize: const Size(double.infinity, 48),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String label, String value) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
      child: ListTile(leading: Icon(icon, color: AppColors.primary), title: Text(label), subtitle: Text(value)),
    );
  }

  Widget _menuTile(IconData icon, String label, VoidCallback onTap, {Widget? trailing}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: AppColors.surface, borderRadius: AppRadii.card, boxShadow: AppShadows.card),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(label),
        trailing: trailing ?? const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
