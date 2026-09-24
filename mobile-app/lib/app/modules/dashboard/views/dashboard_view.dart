import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:intl/intl.dart';
import '../../../theme/app_colors.dart';
import '../../../routes/app_routes.dart';
import '../../../widgets/app_loading.dart';
import '../../../widgets/dashboard_card.dart';
import '../controllers/dashboard_controller.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({super.key});

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isLoading.value && controller.stats.value == null) {
        return const AppLoading(message: 'Loading dashboard...');
      }
      final stats = controller.stats.value;
      return RefreshIndicator(
        onRefresh: controller.refresh,
        color: AppColors.primary,
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [AppColors.primaryDark, AppColors.primary],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.35),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Welcome, ${controller.userName}!',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
                      const SizedBox(height: 4),
                      Text(
                        '${controller.userRole}${stats?.branch.isNotEmpty == true ? ' • ${stats!.branch}' : ''}',
                        style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13),
                      ),
                      const SizedBox(height: 10),
                      Text(DateFormat('EEEE, dd MMMM yyyy').format(DateTime.now()),
                          style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.all(12),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                delegate: SliverChildListDelegate([
                  DashboardCard(
                    animationIndex: 0,
                    title: 'Recorded Calls',
                    value: '${stats?.totalCallsWithRecording ?? 0}',
                    icon: Icons.mic_outlined,
                    color: AppColors.accent,
                    onTap: () => Get.toNamed(AppRoutes.callHistory),
                  ),
                  DashboardCard(
                    animationIndex: 1,
                    title: 'Total Customers',
                    value: '${stats?.totalCustomers ?? 0}',
                    icon: Icons.groups_outlined,
                    color: AppColors.primaryDark,
                    onTap: () => Get.toNamed(AppRoutes.customers),
                  ),
                  DashboardCard(
                    animationIndex: 2,
                    title: 'Calls Today',
                    value: '${stats?.totalCallsToday ?? 0}',
                    icon: Icons.call_outlined,
                    color: AppColors.primary,
                    onTap: () => Get.toNamed(AppRoutes.callHistory),
                  ),
                  DashboardCard(
                    animationIndex: 3,
                    title: 'Attendance',
                    value: stats?.attendanceStatus ?? '-',
                    icon: Icons.access_time,
                    color: AppColors.success,
                    onTap: () => Get.toNamed(AppRoutes.attendance),
                  ),
                  DashboardCard(
                    animationIndex: 4,
                    title: 'Distance Today',
                    value: '${(stats?.distanceCoveredToday ?? 0).toStringAsFixed(1)} KM',
                    icon: Icons.route,
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
