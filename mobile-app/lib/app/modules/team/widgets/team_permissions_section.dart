import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../utils/app_permissions.dart';
import '../controllers/team_controller.dart';

class TeamPermissionsSection extends GetView<TeamController> {
  const TeamPermissionsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final keys = controller.assignablePermKeys;
      if (keys.isEmpty) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 8),
          const Text(
            'Module access',
            style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 4),
          const Text(
            'Choose what this employee can open in the app',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          ...keys.map((key) {
            final label = AppPermissions.labels[key] ?? key;
            final checked = controller.selectedPermissions[key] ?? false;
            return CheckboxListTile(
              value: checked,
              onChanged: (_) => controller.togglePermission(key),
              title: Text(label, style: const TextStyle(fontSize: 14)),
              dense: true,
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
            );
          }),
        ],
      );
    });
  }
}
