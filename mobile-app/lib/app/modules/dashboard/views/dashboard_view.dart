import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../routes/app_routes.dart';
import '../../../widgets/metric_card.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../controllers/dashboard_controller.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isLoading.value && controller.stats.value == null) {
        return const DashboardSkeleton();
      }
      final stats = controller.stats.value;
      return RefreshIndicator(
        onRefresh: controller.refresh,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
                child: Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: AppDecorations.primaryGradient(radius: BorderRadius.circular(AppRadii.lg))
                      .copyWith(boxShadow: AppShadows.elevated),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Namaste, ${controller.userName}',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${controller.userRole}${stats?.branch.isNotEmpty == true ? ' · ${stats!.branch}' : ''}',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        DateFormat('EEEE, dd MMMM yyyy').format(DateTime.now()),
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(AppSpacing.md),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.25,
                  crossAxisSpacing: AppSpacing.sm,
                  mainAxisSpacing: AppSpacing.sm,
                ),
                delegate: SliverChildListDelegate([
                  MetricCard(
                    animationIndex: 0,
                    title: 'Recorded calls',
                    value: '${stats?.totalCallsWithRecording ?? 0}',
                    icon: Icons.mic_none_rounded,
                    color: AppColors.accent,
                    onTap: () => Get.toNamed(AppRoutes.callHistory),
                  ),
                  MetricCard(
                    animationIndex: 1,
                    title: 'Customers',
                    value: '${stats?.totalCustomers ?? 0}',
                    icon: Icons.groups_outlined,
                    color: AppColors.primaryDark,
                    onTap: () => Get.toNamed(AppRoutes.customers),
                  ),
                  MetricCard(
                    animationIndex: 2,
                    title: 'Calls today',
                    value: '${stats?.totalCallsToday ?? 0}',
                    icon: Icons.call_outlined,
                    color: AppColors.primary,
                    onTap: () => Get.toNamed(AppRoutes.callHistory),
                  ),
                  MetricCard(
                    animationIndex: 3,
                    title: 'Attendance',
                    value: stats?.attendanceStatus ?? '—',
                    icon: Icons.access_time_rounded,
                    color: AppColors.success,
                    onTap: () => Get.toNamed(AppRoutes.attendance),
                  ),
                  MetricCard(
                    animationIndex: 4,
                    title: 'Distance today',
                    value: '${(stats?.distanceCoveredToday ?? 0).toStringAsFixed(1)} km',
                    icon: Icons.route_rounded,
                    color: AppColors.accentDark,
                    onTap: () => Get.toNamed(AppRoutes.mapView),
                  ),
                ]),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 80)),
          ],
        ),
      );
    });
  }
}
