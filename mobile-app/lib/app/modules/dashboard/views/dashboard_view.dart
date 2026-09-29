import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_tokens.dart';
import '../../../widgets/home/dashboard_stat_chip.dart';
import '../../../widgets/home/home_premium_header.dart';
import '../../../widgets/home/home_quick_actions.dart';
import '../../../widgets/home/quick_action_banner_tile.dart';
import '../../../widgets/home/today_activity_strip.dart';
import '../../../widgets/skeleton_loaders.dart';
import '../../../widgets/today_progress_card.dart';
import '../controllers/dashboard_controller.dart';

class DashboardView extends GetView<DashboardController> {
  const DashboardView({
    super.key,
    required this.onMenu,
    required this.onNotifications,
    required this.onProfile,
  });

  final VoidCallback onMenu;
  final VoidCallback onNotifications;
  final VoidCallback onProfile;

  @override
  Widget build(BuildContext context) {
    return Obx(() {
      if (controller.isLoading.value && controller.stats.value == null) {
        return Column(
          children: [
            HomePremiumHeader(
              roleLabel: controller.userRole,
              branch: controller.userBranch,
              avatarLetter: controller.avatarLetter,
              onMenu: onMenu,
              onNotifications: onNotifications,
              onProfile: onProfile,
            ),
            const Expanded(child: DashboardSkeleton()),
          ],
        );
      }
      final stats = controller.stats.value;
      final actions = HomeQuickAction.visible();

      return RefreshIndicator(
        onRefresh: controller.refresh,
        color: AppColors.primary,
        edgeOffset: 120,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: HomePremiumHeader(
                roleLabel: controller.userRole,
                branch: controller.userBranch,
                avatarLetter: controller.avatarLetter,
                onMenu: onMenu,
                onNotifications: onNotifications,
                onProfile: onProfile,
              ),
            ),
            SliverToBoxAdapter(
              child: Transform.translate(
                offset: const Offset(0, -12),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  child: IntrinsicHeight(
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Expanded(
                          child: DashboardStatChip(
                            index: 0,
                            icon: Icons.mic_none_rounded,
                            value: '${stats?.totalCallsWithRecording ?? 0}',
                            label: 'Recorded calls',
                            color: const Color(0xFFE57373),
                            onTap: () => Get.toNamed(AppRoutes.callHistory),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DashboardStatChip(
                            index: 1,
                            icon: Icons.groups_outlined,
                            value: '${stats?.totalCustomers ?? 0}',
                            label: 'Customers',
                            color: const Color(0xFF66BB6A),
                            onTap: () => Get.toNamed(AppRoutes.customers),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DashboardStatChip(
                            index: 2,
                            icon: Icons.call_outlined,
                            value: '${stats?.totalCallsToday ?? 0}',
                            label: 'Calls today',
                            color: const Color(0xFF42A5F5),
                            onTap: () => Get.toNamed(AppRoutes.callHistory),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DashboardStatChip(
                            index: 3,
                            icon: Icons.access_time_rounded,
                            value: _shortAttendance(stats?.attendanceStatus ?? '—'),
                            label: 'Attendance',
                            color: const Color(0xFFFFB74D),
                            onTap: () => Get.toNamed(AppRoutes.attendance),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(top: 16),
                child: TodayProgressCard(
                  completed: stats?.totalListings ?? 0,
                  target: 50,
                  subtitle: 'Field target for customer applications',
                ),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 20, AppSpacing.md, 0),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Quick Actions',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: () => Get.snackbar('Quick Actions', 'Drag to reorder coming soon'),
                      icon: const Icon(Icons.tune_rounded, size: 18, color: AppColors.primary),
                      label: const Text(
                        'Customize',
                        style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (actions.isEmpty)
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Text('No modules enabled for your role.', textAlign: TextAlign.center),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 8, AppSpacing.md, 0),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 10,
                    crossAxisSpacing: 10,
                    childAspectRatio: 1.55,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final a = actions[index];
                      return QuickActionBannerTile(
                        index: index,
                        title: a.title,
                        subtitle: a.subtitle,
                        icon: a.icon,
                        color: a.color,
                        onTap: () => Get.toNamed(a.route),
                      );
                    },
                    childCount: actions.length,
                  ),
                ),
              ),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(AppSpacing.md, 24, AppSpacing.md, 32),
                child: TodayActivityStrip(
                  onViewAll: () => Get.toNamed(AppRoutes.callHistory),
                  items: [
                    TodayActivityItem(
                      icon: Icons.call_rounded,
                      value: '${stats?.totalCallsToday ?? 0}',
                      label: 'Calls',
                      color: const Color(0xFF26A69A),
                      onTap: () => Get.toNamed(AppRoutes.callHistory),
                    ),
                    TodayActivityItem(
                      icon: Icons.people_rounded,
                      value: '${stats?.totalCustomers ?? 0}',
                      label: 'Customers',
                      color: const Color(0xFF42A5F5),
                      onTap: () => Get.toNamed(AppRoutes.customers),
                    ),
                    TodayActivityItem(
                      icon: Icons.assignment_rounded,
                      value: '${stats?.pendingCustomerListing ?? stats?.totalListings ?? 0}',
                      label: 'Applications',
                      color: const Color(0xFFFFB74D),
                      onTap: () => Get.toNamed(AppRoutes.customerApplication),
                    ),
                    TodayActivityItem(
                      icon: Icons.route_rounded,
                      value: '${(stats?.distanceCoveredToday ?? 0).toStringAsFixed(1)} km',
                      label: 'Distance',
                      color: const Color(0xFF9575CD),
                      onTap: () => Get.toNamed(AppRoutes.tracking),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    });
  }

  static String _shortAttendance(String status) {
    if (status.length <= 14) return status;
    if (status.toLowerCase().contains('not')) return 'Not Checked In';
    return status;
  }
}
