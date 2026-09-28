import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../utils/access_control.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/customer_application_controller.dart';

class CustomerApplicationView extends GetView<CustomerApplicationController> {
  const CustomerApplicationView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(title: 'New application', subtitle: 'Step-by-step wizard'),
      body: Obx(() {
        final step = controller.wizardStep.value;
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
              child: Row(
                children: List.generate(3, (i) {
                  final active = i <= step;
                  return Expanded(
                    child: Container(
                      margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                      height: 4,
                      decoration: BoxDecoration(
                        color: active ? AppColors.primary : AppColors.divider,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  );
                }),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: _stepContent(step),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  if (step > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: controller.prevStep,
                        child: const Text('Back'),
                      ),
                    ),
                  if (step > 0) const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    flex: 2,
                    child: FilledButton(
                      onPressed: controller.isSaving.value
                          ? null
                          : (step < 2 ? controller.nextStep : controller.submit),
                      child: controller.isSaving.value
                          ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(step < 2 ? 'Next' : 'Submit'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      }),
    );
  }

  Widget _stepContent(int step) {
    switch (step) {
      case 0:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Shop & contact', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
            const SizedBox(height: AppSpacing.sm),
            const Text('Basic details for field visit', style: AppTextStyles.bodyMedium),
            const SizedBox(height: AppSpacing.md),
            if (AccessControl.isAdmin)
              Obx(() => DropdownButtonFormField<String>(
                    initialValue: controller.selectedBranch.value.isEmpty ? null : controller.selectedBranch.value,
                    decoration: AppDecorations.field(label: 'Branch'),
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
            if (AccessControl.isAdmin) const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: controller.nameCtrl,
              decoration: AppDecorations.field(label: 'Customer name', subtitleEn: 'Shop owner name'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: controller.mobileCtrl,
              keyboardType: TextInputType.phone,
              maxLength: 10,
              decoration: AppDecorations.field(label: 'Mobile', hint: '10 digits', subtitleEn: 'Registered mobile'),
            ),
          ],
        );
      case 1:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('KYC', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
            const SizedBox(height: AppSpacing.sm),
            const Text('PAN and government ID (masked on lists)', style: AppTextStyles.bodyMedium),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: controller.aadhaarCtrl,
              keyboardType: TextInputType.number,
              decoration: AppDecorations.field(label: 'Government ID', subtitleEn: '12-digit ID'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: controller.panCtrl,
              textCapitalization: TextCapitalization.characters,
              decoration: AppDecorations.field(label: 'PAN', subtitleEn: 'e.g. ABCDE1234F'),
            ),
          ],
        );
      default:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Location', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
            const SizedBox(height: AppSpacing.sm),
            const Text('Shop address and live GPS required', style: AppTextStyles.bodyMedium),
            const SizedBox(height: AppSpacing.md),
            TextField(
              controller: controller.addressCtrl,
              maxLines: 3,
              decoration: AppDecorations.field(label: 'Shop address'),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton.icon(
              onPressed: controller.captureShopGps,
              icon: const Icon(Icons.my_location_rounded),
              label: const Text('Capture live GPS'),
            ),
            if (controller.shopLat != 0)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.sm),
                child: Text(
                  'Lat ${controller.shopLat.toStringAsFixed(5)}, Lng ${controller.shopLng.toStringAsFixed(5)}',
                  style: AppTextStyles.bodyMedium,
                ),
              ),
          ],
        );
    }
  }
}
