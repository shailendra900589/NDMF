import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../controllers/face_enrollment_controller.dart';

class FaceEnrollmentView extends GetView<FaceEnrollmentController> {
  const FaceEnrollmentView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Face enrollment')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'First-time setup: capture 3 live selfies for daily attendance verification. '
              'Daily check-in photos are not stored — only these reference images are saved.',
              style: TextStyle(color: AppColors.textSecondary, height: 1.4),
            ),
            const SizedBox(height: 20),
            Obx(() => Text(
                  '${controller.capturedUrls.length} / 3 reference photos',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppColors.primaryDark),
                )),
            const SizedBox(height: 16),
            Expanded(
              child: Obx(() => GridView.builder(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: 3,
                    itemBuilder: (_, i) {
                      final filled = i < controller.capturedUrls.length;
                      return Container(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                          color: filled ? AppColors.primary.withValues(alpha: 0.08) : Colors.grey.shade100,
                        ),
                        child: Icon(
                          filled ? Icons.check_circle : Icons.face_retouching_natural,
                          color: filled ? AppColors.success : Colors.grey,
                          size: 36,
                        ),
                      );
                    },
                  )),
            ),
            OutlinedButton.icon(
              onPressed: controller.captureReferencePhoto,
              icon: const Icon(Icons.camera_front),
              label: const Text('Capture reference selfie'),
            ),
            const SizedBox(height: 10),
            Obx(() => ElevatedButton(
                  onPressed: controller.isSaving.value ? null : controller.saveAndContinue,
                  child: controller.isSaving.value
                      ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Save & continue to app'),
                )),
          ],
        ),
      ),
    );
  }
}
