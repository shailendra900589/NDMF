import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/team_controller.dart';
import '../widgets/team_permissions_section.dart';
import '../widgets/team_role_picker.dart';

class TeamAssignView extends GetView<TeamController> {
  const TeamAssignView({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!controller.isAssignMode) Get.back();
    });

    return PopScope(
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) controller.clearAssignState();
      },
      child: Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'Assign role', subtitle: 'Update access'),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Obx(() => Text(
                  'Mobile: ${controller.editingMobile.value} • ID ${controller.editingEmployeeId.value}',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                )),
            const SizedBox(height: 16),
            TextField(
              controller: controller.nameCtrl,
              decoration: const InputDecoration(labelText: 'Full name'),
            ),
            const SizedBox(height: 12),
            const TeamRolePicker(),
            const SizedBox(height: 12),
            Obx(() {
              if (!controller.isAdmin) {
                return TextField(
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'Branch',
                    hintText: controller.selectedBranch.value,
                  ),
                );
              }
              if (controller.branches.isEmpty) {
                return TextField(
                  readOnly: true,
                  decoration: InputDecoration(
                    labelText: 'Branch',
                    hintText: controller.selectedBranch.value.isEmpty ? 'Loading…' : controller.selectedBranch.value,
                  ),
                );
              }
              final current = controller.selectedBranch.value;
              final branchValue = controller.branches.any((b) => b['name']?.toString() == current)
                  ? current
                  : controller.branches.first['name']?.toString();
              return DropdownButtonFormField<String>(
                key: ValueKey(branchValue),
                initialValue: branchValue,
                decoration: const InputDecoration(labelText: 'Branch'),
                items: controller.branches
                    .map((b) => DropdownMenuItem(
                          value: b['name']?.toString() ?? '',
                          child: Text(b['name']?.toString() ?? ''),
                        ))
                    .toList(),
                onChanged: (v) {
                  if (v != null) controller.selectedBranch.value = v;
                },
              );
            }),
            const TeamPermissionsSection(),
            const SizedBox(height: 24),
            Obx(() => ElevatedButton(
                  onPressed: controller.isSaving.value ? null : controller.assignRole,
                  child: controller.isSaving.value
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Save role assignment'),
                )),
          ],
        ),
      ),
      ),
    );
  }
}
