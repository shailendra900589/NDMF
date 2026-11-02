import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../data/services/storage_service.dart';
import '../theme/app_colors.dart';
import '../theme/app_tokens.dart';
import '../utils/access_control.dart';

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    this.message,
    this.icon = Icons.inbox_outlined,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? message;
  final IconData icon;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 48, color: AppColors.primary.withValues(alpha: 0.7)),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(title, textAlign: TextAlign.center, style: AppTextStyles.headlineMedium.copyWith(fontSize: 18)),
            if (message != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                message!,
                textAlign: TextAlign.center,
                style: AppTextStyles.bodyMedium,
              ),
            ],
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.lg),
              FilledButton.icon(
                onPressed: onAction,
                icon: const Icon(Icons.refresh),
                label: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class NoPermissionsState extends StatelessWidget {
  const NoPermissionsState({super.key});

  @override
  Widget build(BuildContext context) {
    final stopped = AccessControl.serviceStopped;
    final plan = Get.find<StorageService>().getUser()?.subscription;
    final name = plan?['name']?.toString();
    final ends = plan?['endsOn']?.toString();
    return EmptyState(
      icon: stopped ? Icons.pause_circle_outline : Icons.lock_outline,
      title: stopped ? 'Service stopped' : 'No modules assigned',
      message: stopped
          ? 'Your company plan${name != null && name.isNotEmpty ? ' ($name)' : ''}'
              '${ends != null && ends.isNotEmpty ? ' expired on $ends' : ' is inactive'}. '
              'Ask your company admin to renew from the web Plan & Billing page.'
          : 'Ask your branch to turn on the work you need.',
    );
  }
}
