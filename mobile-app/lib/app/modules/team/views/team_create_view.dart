import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../controllers/team_controller.dart';

class TeamCreateView extends GetView<TeamController> {
  const TeamCreateView({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => controller.prepareCreateScreen());

    return Scaffold(
      appBar: AppBar(title: const Text('Create employee')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Create user, select role, and assign branch. Admin can create Field Officer, Branch Manager, or Admin.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller.nameCtrl,
              decoration: const InputDecoration(labelText: 'Full name'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller.mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(labelText: 'Mobile (10 digits)', counterText: ''),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller.employeeIdCtrl,
              decoration: const InputDecoration(labelText: 'Employee ID (Login ID)'),
            ),
            const SizedBox(height: 12),
            Obx(() => DropdownButtonFormField<String>(
                  initialValue: controller.canCreateRoles.contains(controller.selectedRole.value)
                      ? controller.selectedRole.value
                      : null,
                  decoration: const InputDecoration(labelText: 'Role'),
                  items: controller.canCreateRoles
                      .map((r) => DropdownMenuItem(value: r, child: Text(controller.roleLabel(r))))
                      .toList(),
                  onChanged: (v) {
                    if (v != null) controller.selectedRole.value = v;
                  },
                )),
            const SizedBox(height: 12),
            Obx(() {
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
              return DropdownButtonFormField<String>(
                initialValue: controller.branches.any((b) => b['name']?.toString() == current)
                    ? current
                    : controller.branches.first['name']?.toString(),
                decoration: const InputDecoration(labelText: 'Branch (select)'),
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
            const SizedBox(height: 12),
            TextField(
              controller: controller.passwordCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Initial password'),
            ),
            const SizedBox(height: 24),
            Obx(() => ElevatedButton(
                  onPressed: controller.isSaving.value ? null : controller.createEmployee,
                  child: controller.isSaving.value
                      ? const SizedBox(
                          height: 22,
                          width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Create & assign'),
                )),
          ],
        ),
      ),
    );
  }
}
