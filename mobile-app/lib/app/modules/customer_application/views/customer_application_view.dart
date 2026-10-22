import 'dart:io';

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';

import '../../../data/models/customer_listing_model.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/customer_application_controller.dart';

class CustomerApplicationView extends GetView<CustomerApplicationController> {
  const CustomerApplicationView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const CustomAppBar(title: 'New customer listing', subtitle: 'Live camera, GPS and neighbors'),
      body: Obx(() {
        final step = controller.wizardStep.value;
        return SafeArea(
          top: false,
          child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
              child: Row(
                children: List.generate(4, (i) {
                  final active = i <= step;
                  return Expanded(
                    child: Container(
                      margin: EdgeInsets.only(right: i < 3 ? 6 : 0),
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
                          : (step < 3 ? controller.nextStep : controller.submit),
                      child: controller.isSaving.value
                          ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(step < 3 ? 'Next' : 'Submit'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        );
      }),
    );
  }

  Widget _stepContent(int step) {
    switch (step) {
      case 0:
        return _customerStep();
      case 1:
        return _photosStep();
      case 2:
        return _shopStep();
      default:
        return _neighborStep();
    }
  }

  Widget _customerStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Customer', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
        const SizedBox(height: AppSpacing.sm),
        Text(controller.approvalFlowHint, style: AppTextStyles.bodyMedium),
        const SizedBox(height: AppSpacing.md),
        if (controller.userBranch.isNotEmpty)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.business_outlined, color: AppColors.primary),
            title: const Text('Branch'),
            subtitle: Text(controller.userBranch),
          ),
        TextField(
          controller: controller.nameCtrl,
          decoration: AppDecorations.field(label: 'Customer name'),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: controller.mobileCtrl,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          decoration: AppDecorations.field(label: 'Mobile', hint: '10 digits'),
        ),
        TextField(
          controller: controller.aadhaarCtrl,
          keyboardType: TextInputType.number,
          decoration: AppDecorations.field(label: 'Aadhaar number'),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextField(
          controller: controller.panCtrl,
          textCapitalization: TextCapitalization.characters,
          decoration: AppDecorations.field(label: 'PAN number'),
        ),
      ],
    );
  }

  Widget _photosStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Live photos', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Camera only. Each photo is stamped with live latitude, longitude, date and time.',
          style: AppTextStyles.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.md),
        ...CustomerApplicationController.photoSlots.entries.map(
          (e) => Obx(() => _PhotoTile(
                label: e.value,
                photo: controller.slot(e.key).value,
                busy: controller.capturingSlot.value == e.key,
                onCapture: () => controller.captureSlot(e.key),
              )),
        ),
      ],
    );
  }

  Widget _shopStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Shop', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
        const SizedBox(height: AppSpacing.sm),
        const Text('Full address and a live GPS point that stays on this listing.', style: AppTextStyles.bodyMedium),
        const SizedBox(height: AppSpacing.md),
        TextField(
          controller: controller.addressCtrl,
          maxLines: 4,
          decoration: AppDecorations.field(label: 'Shop full address'),
        ),
        const SizedBox(height: AppSpacing.md),
        OutlinedButton.icon(
          onPressed: controller.captureShopGps,
          icon: const Icon(Icons.my_location_rounded),
          label: const Text('Save live shop GPS'),
        ),
        Obx(() {
          if (controller.shopLat.value == 0) return const SizedBox.shrink();
          return Padding(
            padding: const EdgeInsets.only(top: AppSpacing.sm),
            child: Text(
              'Saved ${controller.shopLat.value.toStringAsFixed(6)}, ${controller.shopLng.value.toStringAsFixed(6)}',
              style: AppTextStyles.bodyMedium,
            ),
          );
        }),
      ],
    );
  }

  Widget _neighborStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('Neighbor shops', style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
        const SizedBox(height: AppSpacing.sm),
        const Text(
          'Ask 2 or 3 shops next door. Write the shop name and what they said about this customer. Voice is optional.',
          style: AppTextStyles.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.md),
        for (var i = 0; i < 3; i++) ...[
          Text('Shop ${i + 1}', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: controller.neighborNameCtrls[i],
            decoration: AppDecorations.field(label: 'Shop name'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: controller.neighborRemarkCtrls[i],
            maxLines: 3,
            decoration: AppDecorations.field(label: 'What they said about the customer'),
          ),
          const SizedBox(height: 8),
          Obx(() {
            final recording = controller.recordingNeighbor.value == i;
            final saved = controller.neighborVoices[i] != null;
            return OutlinedButton.icon(
              onPressed: () => controller.toggleNeighborVoice(i),
              icon: Icon(recording ? Icons.stop_rounded : Icons.mic_rounded),
              label: Text(recording ? 'Stop recording' : (saved ? 'Voice saved — tap to re-record' : 'Record voice')),
            );
          }),
          const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({
    required this.label,
    required this.photo,
    required this.busy,
    required this.onCapture,
  });

  final String label;
  final GpsPhotoCapture? photo;
  final bool busy;
  final VoidCallback onCapture;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadii.card,
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              width: 72,
              height: 72,
              child: photo == null
                  ? const ColoredBox(color: AppColors.divider, child: Icon(Icons.photo_camera_outlined))
                  : Image.file(
                      File(photo!.filePath),
                      fit: BoxFit.cover,
                      cacheWidth: 216,
                      cacheHeight: 216,
                      filterQuality: FilterQuality.low,
                      errorBuilder: (_, __, ___) => const Icon(Icons.broken_image_outlined),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(
                  photo == null
                      ? 'Live camera required'
                      : '${photo!.latitude.toStringAsFixed(5)}, ${photo!.longitude.toStringAsFixed(5)}\n${DateFormat('dd MMM yyyy HH:mm').format(photo!.capturedAt)}',
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTextStyles.bodyMedium,
                ),
              ],
            ),
          ),
          busy
              ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
              : IconButton(onPressed: onCapture, icon: const Icon(Icons.photo_camera_rounded, color: AppColors.primary)),
        ],
      ),
    );
  }
}
