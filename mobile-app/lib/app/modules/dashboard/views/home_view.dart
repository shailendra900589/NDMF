import 'package:flutter/material.dart';
import 'package:get/get.dart';
import '../../../routes/app_routes.dart';
import '../../../theme/app_colors.dart';
import '../../../utils/access_control.dart';
import '../../../widgets/empty_state.dart';
import '../../../widgets/home/home_bottom_nav.dart';
import '../../../widgets/home/home_premium_header.dart';
import '../../../widgets/home/home_quick_actions.dart';
import '../../../widgets/home/quick_action_banner_tile.dart';
import '../../../widgets/offline_banner.dart';
import '../../../widgets/team_inbox.dart';
import '../controllers/dashboard_controller.dart';
import 'dashboard_view.dart';

class HomeView extends GetView<DashboardController> {
  const HomeView({super.key});

  void _onBottomNav(int index) {
    if (index == 0) {
      controller.homeNavIndex.value = 0;
      return;
    }
    controller.homeNavIndex.value = 0;
    if (index == 2 && AccessControl.canAccess('customerListings')) {
      Get.toNamed(AppRoutes.customerApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final showDashboard = AccessControl.showDashboard;
    return Obx(() => Scaffold(
          backgroundColor: AppColors.background,
          body: Column(
            children: [
              const OfflineBanner(),
              const TeamInboxButton(),
              Expanded(
                child: showDashboard ? const DashboardView() : const _QuickActionsOnly(),
              ),
            ],
          ),
          bottomNavigationBar: HomeBottomNav(
            currentIndex: controller.homeNavIndex.value,
            onTap: _onBottomNav,
            showApplications: AccessControl.canAccess('customerListings'),
          ),
        ));
  }
}

class _QuickActionsOnly extends GetView<DashboardController> {
  const _QuickActionsOnly();

  @override
  Widget build(BuildContext context) {
    final actions = HomeQuickAction.visible();
    if (actions.isEmpty) {
      return const Column(
        children: [
          HomePremiumHeader(),
          Expanded(child: NoPermissionsState()),
        ],
      );
    }
    return ListView(
      padding: const EdgeInsets.only(bottom: 24),
      children: [
        const HomePremiumHeader(),
        Padding(
          padding: const EdgeInsets.all(16),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: MediaQuery.sizeOf(context).width < 340 ? 1 : 2,
              mainAxisSpacing: 10,
              crossAxisSpacing: 10,
              mainAxisExtent: 78,
            ),
            itemCount: actions.length,
            itemBuilder: (context, index) {
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
          ),
        ),
      ],
    );
  }
}
