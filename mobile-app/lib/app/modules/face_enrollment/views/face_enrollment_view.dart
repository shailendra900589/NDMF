import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../widgets/custom_app_bar.dart';
import '../controllers/face_enrollment_controller.dart';

class FaceEnrollmentView extends GetView<FaceEnrollmentController> {
  const FaceEnrollmentView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: const CustomAppBar(
          title: 'Face enrollment', subtitle: '3 reference photos'),
      body: GetBuilder<FaceEnrollmentController>(
        builder: (c) {
          final count = c.capturedCount;
          final saving = c.isSaving || c.isCapturing;
          return Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: AppDecorations.surfaceCard(),
                  child: kIsWeb
                      ? const Text(
                          'Camera enrollment works best on Android. You may skip and continue testing.',
                          style: TextStyle(
                              color: AppColors.textSecondary, height: 1.45),
                        )
                      : const Text(
                          '3 clear selfies capture karein, phir Save face registration dabayein. Photos upload hona aur registration save hona alag steps hain. Attendance ke liye server confirmation zaroori hai.',
                          style: TextStyle(
                              color: AppColors.textSecondary, height: 1.45),
                        ),
                ),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: List.generate(3, (i) {
                    final done = i < count;
                    return Expanded(
                      child: Container(
                        margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                        height: 6,
                        decoration: BoxDecoration(
                          color: done ? AppColors.primary : AppColors.divider,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    );
                  }),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  '$count / 3 reference photos uploaded',
                  style: AppTextStyles.titleMedium
                      .copyWith(color: AppColors.primaryDark),
                ),
                const SizedBox(height: AppSpacing.md),
                Expanded(
                  child: GridView.builder(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 3,
                      crossAxisSpacing: 8,
                      mainAxisSpacing: 8,
                    ),
                    itemCount: 3,
                    itemBuilder: (_, i) {
                      final filled = i < count;
                      return Container(
                        decoration: BoxDecoration(
                          color: filled
                              ? AppColors.primary.withValues(alpha: 0.1)
                              : AppColors.divider.withValues(alpha: 0.4),
                          borderRadius: AppRadii.card,
                          border: Border.all(
                            color:
                                filled ? AppColors.primary : AppColors.divider,
                            width: filled ? 2 : 1,
                          ),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              filled
                                  ? Icons.check_circle_rounded
                                  : Icons.face_rounded,
                              size: 36,
                              color: filled
                                  ? AppColors.success
                                  : AppColors.textSecondary,
                            ),
                            const SizedBox(height: 4),
                            Text('${i + 1}', style: AppTextStyles.bodyMedium),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                OutlinedButton(
                  onPressed: saving ? null : c.skipEnrollment,
                  child: const Text('Skip for now'),
                ),
                if (count > 0)
                  TextButton(
                    onPressed: saving ? null : c.retakePhotos,
                    child: const Text('Retake reference photos'),
                  ),
                const SizedBox(height: AppSpacing.sm),
                FilledButton.icon(
                  onPressed: saving
                      ? null
                      : (count >= 3
                          ? c.saveAndContinue
                          : (kIsWeb ? null : c.captureReferencePhoto)),
                  icon: Icon(count >= 3
                      ? Icons.check_rounded
                      : Icons.camera_front_rounded),
                  label: Text(c.isCapturing
                      ? 'Uploading photo…'
                      : c.isSaving
                          ? 'Confirming registration…'
                          : count >= 3
                              ? 'Save face registration'
                              : 'Capture selfie'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
