import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../controllers/team_controller.dart';

/// Role choices a branch can give an employee.
class TeamRolePicker extends GetView<TeamController> {
  const TeamRolePicker({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      final roles = controller.canCreateRoles;
      if (roles.isEmpty) {
        return const Text(
          'No roles available for your account.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        );
      }
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Select role',
            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: roles.map((role) {
              final selected = controller.selectedRole.value == role;
              return ChoiceChip(
                label: Text(controller.roleLabel(role)),
                selected: selected,
                onSelected: (_) {
                  controller.selectedRole.value = role;
                  controller.applyPermissionsForRole(role);
                },
                selectedColor: AppColors.primary.withValues(alpha: 0.2),
                labelStyle: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: selected ? AppColors.primaryDark : AppColors.textPrimary,
                ),
              );
            }).toList(),
          ),
        ],
      );
    });
  }
}
