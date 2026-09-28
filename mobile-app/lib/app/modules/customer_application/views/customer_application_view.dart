import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../utils/access_control.dart';
import '../controllers/customer_application_controller.dart';

class CustomerApplicationView extends GetView<CustomerApplicationController> {
  const CustomerApplicationView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('New customer application')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            const Text(
              'Separate from Customers master list. Approval: Employee → Branch + Admin; '
              'Branch → Admin only; Admin → auto-approved.',
              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 16),
            if (AccessControl.isAdmin)
              Obx(() => DropdownButtonFormField<String>(
                    initialValue: controller.selectedBranch.value.isEmpty ? null : controller.selectedBranch.value,
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
                  )),
            if (AccessControl.isAdmin) const SizedBox(height: 12),
            TextField(controller: controller.nameCtrl, decoration: const InputDecoration(labelText: 'Customer name')),
            const SizedBox(height: 10),
            TextField(
              controller: controller.mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: const InputDecoration(labelText: 'Mobile', counterText: ''),
            ),
            const SizedBox(height: 10),
            TextField(controller: controller.aadhaarCtrl, decoration: const InputDecoration(labelText: 'Aadhaar')),
            const SizedBox(height: 10),
            TextField(controller: controller.panCtrl, decoration: const InputDecoration(labelText: 'PAN')),
            const SizedBox(height: 10),
            TextField(controller: controller.addressCtrl, decoration: const InputDecoration(labelText: 'Shop address')),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: controller.captureShopGps,
              icon: const Icon(Icons.my_location),
              label: const Text('Capture shop GPS (live)'),
            ),
            const SizedBox(height: 20),
            Obx(() => SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: controller.isSaving.value ? null : controller.submit,
                    child: controller.isSaving.value
                        ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Submit application'),
                  ),
                )),
          ],
        ),
      ),
    );
  }
}
